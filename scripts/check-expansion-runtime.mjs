// Mutating workload: use a disposable server, never a user's saved world.
import { writeFile } from 'node:fs/promises';
if (process.env.ISOLATED_TEST !== '1') throw new Error('ISOLATED_TEST=1 and an isolated APP_URL are required.');
const base = process.env.APP_URL || 'http://localhost:8084', abort = new AbortController(), clients = [], readers = [];
const seenShots = new Map();
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
            snapshots++; maximumSnapshot = Math.max(maximumSnapshot, Buffer.byteLength(message)); client.state = { ...client.state, ...JSON.parse(message.slice(6)) }; for (const shot of client.state.combat.shots) seenShots.set(shot.id, shot);
          }
        }
      } catch (error) { if (!abort.signal.aborted) throw error; }
    })());
  }
  let keeper = null; const delay = ms => new Promise(r => setTimeout(r, ms));
  async function until(test, label) {
    const start = performance.now();
    while (!test()) { if (performance.now() - start > 35000) throw new Error(label + ' timed out');
      if (keeper) await post(keeper, 'artillery/input', { id: keeper.state.artillery[0].id, traverse: 0, elevate: 0 }); await delay(140); }
  }
  for (const data of [{ x: 68, y: 19, shape: 'EW' }, { x: 71, y: 22, shape: 'NS' }, { x: 68, y: 22, shape: 'NE' }]) await post(clients[0], 'rails', data);
  const { gun } = await post(clients[0], 'artillery', { x: 68, y: 19 });
  await post(clients[0], 'cores', { x: 29, y: 13 });
  await until(() => clients[0].state.cores?.[0]?.elapsed === 4.5, 'core');
  const player = () => clients[0].state.players.find(p => p.id === clients[0].id), carriage = () => clients[0].state.artillery[0];
  await post(clients[0], 'navigate', { x: 30, y: 11 });
  await until(() => Math.hypot(player().x - 30.5, player().y - 11.5) < .1, 'guard position');
  await post(clients[0], 'artillery/control', { id: gun.id }); keeper = clients[0];
  await post(clients[0], 'drill', {}); await until(() => clients[0].state.combat.status === 'cleared', 'guard defence');
  const guardedShots = [...seenShots.values()].filter(s => s.owner === clients[0].id);
  if (!guardedShots.some(s => s.weapon === 'LASER') || Math.hypot(player().x - 30.5, player().y - 11.5) > .1) throw new Error('Guard did not defend in place');
  await post(clients[0], 'artillery/move', { id: gun.id, step: 1 });
  await until(() => carriage().move?.curve, 'curve start'); await until(() => carriage().move === null, 'curve finish');
  if (carriage().x !== 71 || carriage().y !== 22 || carriage().shape !== 'NS') throw new Error('Curve destination incorrect');
  await post(clients[0], 'drill', { frontId: 'east' });
  while (carriage().elevation > 68) { await post(clients[0], 'artillery/input', { id: gun.id, traverse: 0, elevate: -1 }); await delay(140); }
  await post(clients[0], 'artillery/input', { id: gun.id, traverse: 0, elevate: 0 });
  await until(() => carriage().brace <= .001, 'stabilizers'); await post(clients[0], 'artillery/fire', { id: gun.id });
  await until(() => clients.every(c => c.state.combat.salvos.length === 1), 'shared shell');
  const shell = clients[0].state.combat.salvos[0], range = Math.hypot(shell.targetX - shell.x, shell.targetY - shell.y);
  if (range <= 30) throw new Error('Long-range shot was too short');
  await until(() => clients.every(c => c.state.combat.salvos.length === 0), 'impact');
  await post(clients[2], 'navigate', { x: 72, y: 24 });
  await until(() => { const p = clients[2].state.players.find(p => p.id === clients[2].id); return Math.hypot(p.x - 72.5, p.y - 24.5) < .1; }, 'cross-map travel');
  await post(clients[0], 'artillery/control', { id: gun.id, release: true }); keeper = null;
  const report = { seconds: (performance.now() - began) / 1000, clients: 4, world: [clients[0].state.world.width, clients[0].state.world.height], guardShots: guardedShots.length, guardedHealth: player().health, curve: 'NE', cannon: [carriage().x, carriage().y], shellRange: range, crossedCauseway: true, snapshots, bytes, maximumSnapshot, maximumRequestMs: Math.max(...times) };
  await writeFile('.local/expansion-runtime.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { abort.abort(); await Promise.allSettled(readers); }
