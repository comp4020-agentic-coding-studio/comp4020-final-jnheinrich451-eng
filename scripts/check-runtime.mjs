// Small exploration workload, not a combat-capacity benchmark. Use a test world.
import { performance } from 'node:perf_hooks';
const base = process.env.APP_URL || 'http://localhost:8083';
const abort = new AbortController(), times = [], clients = [];
let events = 0;
try {
  for (let i = 0; i < 4; i++) {
    const response = await fetch(`${base}/api/world`);
    if (!response.ok) throw new Error(`World HTTP ${response.status}`);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    const stream = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: abort.signal });
    if (!stream.ok) throw new Error(`Stream HTTP ${stream.status}`);
    clients.push({ cookie, reader: stream.body.getReader() });
  }
  const readers = clients.map(async client => {
    try { while (!(await client.reader.read()).done) events++; }
    catch (error) { if (!abort.signal.aborted) throw error; }
  });
  const start = performance.now();
  for (let tick = 0; tick < 100; tick++) {
    await Promise.all(clients.map(async client => {
      const before = performance.now();
      const response = await fetch(`${base}/api/input`, { method: 'POST', headers: { Cookie: client.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ x: tick % 20 < 10 ? 1 : -1, y: 0 }) });
      await response.json();
      if (!response.ok) throw new Error(`Movement HTTP ${response.status}`);
      times.push(performance.now() - before);
    }));
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  const state = await (await fetch(`${base}/api/world`, { headers: { Cookie: clients[0].cookie } })).json();
  if (state.players.length !== 4 || events < 20) throw new Error('Expected four active scouts and shared state events.');
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ scope: 'Four scouts moving; no enemies or combat', seconds: Math.round((performance.now() - start) / 1000), requests: times.length, eventChunks: events, medianMs: Math.round(times[Math.floor(times.length / 2)]), p95Ms: Math.round(times[Math.floor(times.length * .95)]) }, null, 2));
  abort.abort(); await Promise.all(readers);
} finally { abort.abort(); }
