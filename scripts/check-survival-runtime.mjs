// Mutating workload: use a disposable server, never a user's saved world.
import { writeFile } from 'node:fs/promises';
if (process.env.ISOLATED_TEST !== '1') throw new Error('ISOLATED_TEST=1 and an isolated APP_URL are required.');
const base = process.env.APP_URL || 'http://localhost:8084', abort = new AbortController(), clients = [], readers = [];
let snapshots = 0, bytes = 0, maximumSnapshot = 0;
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

  const player = () => clients[0].state.players?.find(p => p.id === clients[0].id);
  async function until(test, label) {
    const start = performance.now();
    while (!test()) {
      if (performance.now() - start > 25000) throw new Error(label + ' timed out');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  await post(clients[0], 'navigate', { x: 24, y: 11 });
  await until(() => Math.hypot(player().x - 24.5, player().y - 11.5) < .1, 'approach');
  await post(clients[0], 'drill', {});
  await until(() => player().life === 'disabled', 'enemy attacks');
  const hits = player().hurt;
  await until(() => player().recovery <= .001, 'replacement preparation');
  const core = clients[0].state.cores.find(c => c.owner === clients[1].id);
  await post(clients[0], 'revive', { coreId: core.id });
  await until(() => player().life === 'active', 'replacement landing');
  if (player().health !== 100 || player().reviveCore !== core.id) throw new Error('Recovery did not restore the robot at the selected friendly core');
  const report = { seconds: (performance.now() - began) / 1000, clients: 4, completedCores: 2, enemyHits: hits, recoveredHealth: player().health, snapshots, bytes, maximumSnapshot };
  await writeFile('.local/survival-runtime.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { abort.abort(); await Promise.allSettled(readers); }
