// Mutating workload: use a disposable server, never a user's saved world.
import { writeFile } from 'node:fs/promises';
if (process.env.ISOLATED_TEST !== '1') throw new Error('ISOLATED_TEST=1 and an isolated APP_URL are required.');
const base = process.env.APP_URL || 'http://localhost:8084', abort = new AbortController(), clients = [], readers = [];
let snapshots = 0, bytes = 0, maximumSnapshot = 0, shots = 0;
const times = [], began = performance.now();
async function post(client, action, data) {
  const at = performance.now();
  const response = await fetch(`${base}/api/${action}`, { method: 'POST', headers: { Cookie: client.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: abort.signal });
  times.push(performance.now() - at); const result = await response.json();
  if (!response.ok) throw new Error(`${action}: ${result.error}`);
  return result;
}
try {
  for (let i = 0; i < 4; i++) {
    const response = await fetch(`${base}/api/world`), initial = await response.json();
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const client = { cookie, state: initial, id: initial.me.id }; clients.push(client);
    const stream = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: abort.signal }), reader = stream.body.getReader();
    readers.push((async () => {
      let buffer = ''; const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength; buffer += decoder.decode(part.value, { stream: true });
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const message = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (!message.startsWith('data: ')) continue;
            snapshots++; maximumSnapshot = Math.max(maximumSnapshot, Buffer.byteLength(message)); client.state = { ...client.state, ...JSON.parse(message.slice(6)) };
          }
        }
      } catch (error) { if (!abort.signal.aborted) throw error; }
    })());
  }
  await post(clients[0], 'cores', { x: 29, y: 13 });
  await post(clients[1], 'cores', { x: 20, y: 21 });
  while (!clients.every(c => c.state.cores?.length === 2 && c.state.cores.every(core => core.elapsed === 4.5))) {
    if (performance.now() - began > 15000) throw new Error('Deployment did not complete for all four observers');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await post(clients[0], 'drill', {});
  for (let tick = 0; tick < 40; tick++) {
    await Promise.all(clients.map(async client => {
      const player = client.state.players.find(p => p.id === client.id);
      await post(client, 'fire', { x: player.x, y: player.y - 5, weapon: player.body === 'robot' ? (tick % 2 ? 'LASER' : 'FLAME') : 'APCR' }); shots++;
    }));
    await new Promise(resolve => setTimeout(resolve, 220));
  }
  const coreId = clients[0].state.cores[0].id;
  const retry = await post(clients[0], 'cores', { x: 29, y: 13 });
  if (retry.core.id !== coreId) throw new Error('Retry duplicated the deployment');
  times.sort((a, b) => a - b);
  const report = { seconds: +(performance.now() - began).toFixed(2) / 1000, clients: 4, completedCores: 2, shots, snapshots, bytes, maximumSnapshot, medianMs: times[Math.floor(times.length * .5)], p95Ms: times[Math.floor(times.length * .95)] };
  await writeFile('.local/core-runtime.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { abort.abort(); await Promise.allSettled(readers); }
