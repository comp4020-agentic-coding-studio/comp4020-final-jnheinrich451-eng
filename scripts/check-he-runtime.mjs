// Run ONLY against an isolated test server: this starts drills and fires weapons.
import { performance } from 'node:perf_hooks';
if (process.env.ISOLATED_TEST !== '1') throw new Error('Set ISOLATED_TEST=1 and APP_URL to an isolated test world.');
const base = process.env.APP_URL || 'http://localhost:8083', abort = new AbortController();
const mixedFire = process.env.MIXED_FIRE === '1';
const clients = [], times = [], readers = [];
let frames = 0, bytes = 0, shots = 0, bullets = 0, reloads = 0, drills = 0, maximumSnapshotBytes = 0, maximumMarks = 0;
const blastIds = new Set();
async function post(client, action, body) {
  const begin = performance.now();
  const response = await fetch(`${base}/api/${action}`, { method: 'POST', headers: { Cookie: client.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abort.signal });
  const data = await response.json(); times.push(performance.now() - begin);
  if (mixedFire && action === 'fire' && response.status === 409 && data.error.includes('reloading')) { reloads++; return null; }
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status}: ${data.error}`);
  return data;
}
try {
  for (let i = 0; i < 4; i++) {
    const response = await fetch(`${base}/api/world`), state = await response.json();
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const stream = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: abort.signal });
    if (!stream.ok) throw new Error(`SSE HTTP ${stream.status}`);
    const client = { cookie, state, reader: stream.body.getReader() }; clients.push(client);
    readers.push((async () => {
      let buffer = ''; const decoder = new TextDecoder();
      try {
        while (true) {
          const chunk = await client.reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength; buffer += decoder.decode(chunk.value, { stream: true });
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const message = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (!message.startsWith('data: ')) continue;
            frames++; maximumSnapshotBytes = Math.max(maximumSnapshotBytes, Buffer.byteLength(message));
            const update = JSON.parse(message.slice(6)); client.state = { ...client.state, ...update };
            maximumMarks = Math.max(maximumMarks, update.combat.marks.length);
            for (const impact of update.combat.impacts) if (impact.weapon !== 'APCR') blastIds.add(impact.id);
          }
        }
      } catch (error) { if (!abort.signal.aborted) throw error; }
    })());
  }
  const begin = performance.now();
  for (let tick = 0; tick < 300; tick++) {
    if (tick % 4 === 0) {
      if (clients[0].state.combat.status !== 'active') { await post(clients[0], 'drill', {}); drills++; }
      await Promise.all(clients.map(async (client, i) => {
        const enemies = client.state.combat.enemies, target = enemies[i % Math.max(1, enemies.length)] || { x: 24.5, y: 12.5 };
        if (await post(client, 'fire', { x: target.x, y: target.y, weapon: 'HE' })) shots++;
      }));
    }
    if (mixedFire) await Promise.all(clients.map(async (client, i) => {
      const enemies = client.state.combat.enemies, target = enemies[i % Math.max(1, enemies.length)] || { x: 24.5, y: 12.5 };
      if (await post(client, 'fire', { x: target.x, y: target.y, weapon: 'APCR' })) bullets++;
    }));
    await Promise.all(clients.map(client => post(client, 'input', { x: tick % 20 < 10 ? .5 : -.5, y: 0 })));
    await new Promise(resolve => setTimeout(resolve, Math.max(0, begin + (tick + 1) * 200 - performance.now())));
  }
  const seconds = (performance.now() - begin) / 1000; times.sort((a, b) => a - b);
  console.log(JSON.stringify({ scope: mixedFire ? 'Four moving guests firing HE and APCR, repeating three-crawler drills' : 'Four moving/firing guests, repeating three-crawler drills; isolated local HE test', seconds: +seconds.toFixed(2), requests: times.length, shots, bullets, reloads, drills, uniqueBlasts: blastIds.size, receivedSnapshots: frames, streamBytes: bytes, maximumSnapshotBytes, maximumMarks, medianMs: +times[Math.floor(times.length / 2)].toFixed(2), p95Ms: +times[Math.floor(times.length * .95)].toFixed(2) }, null, 2));
} finally { abort.abort(); await Promise.allSettled(readers); }
