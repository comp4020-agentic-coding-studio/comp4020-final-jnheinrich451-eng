// Mutating workload: disposable server only, never the user's saved game.
import { writeFile } from 'node:fs/promises';
if (process.env.ISOLATED_TEST !== '1') throw new Error('Use ISOLATED_TEST=1 with a disposable server.');
const base = process.env.APP_URL || 'http://localhost:8085', abort = new AbortController(), clients = [], readers = [], impacts = new Set();
let bytes = 0, snapshots = 0, maximumSnapshot = 0, maximumVolleys = 0, maximumSectors = 0, lured = false; const began = performance.now(), times = [];
const delay = ms => new Promise(r => setTimeout(r, ms));
async function post(c, route, data, expected = 200) {
  const at = performance.now(), res = await fetch(`${base}/api/${route}`, { method: 'POST', headers: { Cookie: c.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  times.push(performance.now() - at); const result = await res.json(); if (res.status !== expected) throw Error(`${route}: ${res.status} ${JSON.stringify(result)}`); return result;
}
try {
  for (let i = 0; i < 4; i++) {
    const response = await fetch(`${base}/api/world`), c = { cookie: response.headers.get('set-cookie').split(';')[0], state: await response.json() }; clients.push(c);
    const stream = await fetch(`${base}/api/events`, { headers: { Cookie: c.cookie }, signal: abort.signal }), reader = stream.body.getReader();
    readers.push((async () => { let buffer = ''; const decoder = new TextDecoder();
      try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; buffer += decoder.decode(part.value, { stream: true }); let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2); if (!frame.startsWith('data: ')) continue;
          snapshots++; maximumSnapshot = Math.max(maximumSnapshot, Buffer.byteLength(frame)); c.state = { ...c.state, ...JSON.parse(frame.slice(6)) };
          maximumVolleys = Math.max(maximumVolleys, c.state.combat.barrages.length); maximumSectors = Math.max(maximumSectors, c.state.combat.fields.reduce((n,f)=>n+(f.sectors?.length || 0),0)); lured ||= c.state.combat.enemies.some(e=>e.behavior === 'lured'); for (const hit of c.state.combat.impacts) impacts.add(hit.id);
        }
      } } catch (e) { if (!abort.signal.aborted) throw e; }
    })());
    c.gun = (await post(c, 'missiles', { x: 64 + i * 8, y: 22 }, 201)).gun;
    await post(c, 'artillery/control', { id: c.gun.id });
  }
  const target = { x: 24.5, y: 18.5 };
  const renew = async () => { for (const c of clients) await post(c, 'artillery/command', { id: c.gun.id, x: 0, y: 0, target }); };
  const waitUntil = async (test, label) => { const at = performance.now(); while (!test()) { if (performance.now() - at > 25000) throw Error(`${label} timed out`); await renew(); await delay(150); } };
  await post(clients[0], 'artillery/ammo', { id: clients[0].gun.id, ammo: 'INCENDIARY' });
  await post(clients[1], 'artillery/ammo', { id: clients[1].gun.id, ammo: 'GAS' });
  await post(clients[0], 'artillery/fire', { id: clients[0].gun.id, target: {x:24.5,y:23.5} });
  await post(clients[1], 'artillery/fire', { id: clients[1].gun.id, target: {x:33.5,y:18.5} });
  await waitUntil(() => clients[0].state.combat.barrages.length === 0, 'landed sectors');
  await post(clients[2], 'artillery/ammo', { id: clients[2].gun.id, ammo: 'GAS' });
  await post(clients[2], 'artillery/fire', { id: clients[2].gun.id, target }, 409);
  if (clients[2].state.artillery.find(g => g.id === clients[2].gun.id).reload !== 0) throw Error('Rejected area spent reload');
  let kills = 0;
  for (let i=0;i<3;i++) {
    await post(clients[0], 'drill', {});
    await waitUntil(() => clients[0].state.combat.status === 'active', 'drill start snapshot');
    await waitUntil(() => clients[0].state.combat.status !== 'active', 'gas lure drill');
    if (clients[0].state.combat.kills !== 3) throw Error('Gas did not resolve all three crawlers');
    kills += clients[0].state.combat.kills;
  }
  await waitUntil(() => !clients[0].state.combat.fields.some(f=>f.weapon === 'INCENDIARY'), 'fire expiry');
  const gas = clients[0].state.combat.fields.find(f=>f.weapon === 'GAS');
  if (!gas || gas.capacity !== 9 || !lured || maximumSectors !== 24) throw Error('Unexpected shared field outcomes');
  const result = { seconds:(performance.now()-began)/1000, clients:4, maximumVolleys, maximumSectors, kills, gasRemaining:gas.capacity, lured, snapshots, bytes, maximumSnapshot, slowestRequestMs:Math.max(...times) };
  await writeFile(process.env.REPORT_PATH || '.local/missile-fields-runtime.json', JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} finally { abort.abort(); await Promise.allSettled(readers); }
