// Local full-server probe, one four-player campaign; no real accounts or emails.
// Run each mode in a fresh process: node scripts/probe-front-density.mjs [--dense]
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { createApp } from '../server.js';
import { seedFronts, seedDenseFronts } from '../public/seeded-fronts.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { freshLife } from '../public/survival.js';

const dense = process.argv.includes('--dense'), dir = await mkdtemp(path.join(tmpdir(), 'frontier-density-'));
const app = createApp({ dataDir: dir, logSink: () => {} }), streams = [];
let sampler;
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const client = () => {
    const cookies = new Map();
    return { header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), async request(route, data) {
      const response = await fetch(origin + route, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: this.header(), Origin: origin, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) { const [k, v] = raw.split(';')[0].split('='); if (v) cookies.set(k, v); else cookies.delete(k); }
      const value = await response.json(); if (!response.ok) throw new Error(`${route}: ${response.status} ${value.error}`); return value;
    } };
  };
  const clients = [];
  for (let i = 0; i < 4; i++) {
    const c = client(), credentials = { name: `Probe ${i}`, kind: 'demo', email: `probe${i}@frontier.test`, password: 'isolated probe password 123!' };
    await c.request('/api/auth/register', credentials);
    const inbox = await c.request('/api/auth/inbox'); await c.request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await c.request('/api/auth/login', credentials); clients.push(c);
  }
  const owner = clients[0], { id } = await owner.request('/api/campaigns/create', { name: 'Density probe' });
  await owner.request('/api/campaigns/enter', { id }); const route = `/api/campaign-world/${id}/`, pilots = [];
  const setupStream = new AbortController(); streams.push(setupStream);
  const setupResponse = await fetch(origin + route + 'events', { headers: { Cookie: owner.header() }, signal: setupStream.signal });
  void (async () => { try { for await (const _ of setupResponse.body) { /* consume setup messages */ } } catch { /* closed */ } })();
  for (const c of clients) {
    if (c !== owner) { const invite = await owner.request('/api/campaigns/invite', { id }); await c.request('/api/campaigns/join', { code: invite.code }); }
    pilots.push((await c.request(route + 'world')).me.id);
  }
  await owner.request('/api/campaigns/leave', {});
  const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
  let groups, siteCount, setupSiteBytes;
  try {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
    const authored = saved.sites.filter(s => !s.encounter), original = seedFronts(world, [], [], 'budget-sample');
    world.sites = authored.concat(original.sites);
    if (dense) world.sites.push(...seedDenseFronts(world, [], [], 'budget-sample').sites);
    groups = [...new Map(world.sites.filter(s => s.encounter).map(s => [s.encounter.id, s.encounter])).values()];
    saved.sites = world.sites; siteCount = saved.sites.length; setupSiteBytes = Buffer.byteLength(JSON.stringify(saved.sites));
    saved.enemies = groups.slice(0, 4).flatMap((g, n) => Array.from({ length: 6 }, (_, i) => ({ ...newGroundEnemy(i < 2 ? 'breaker' : 'hunter', n * 6 + i + 1,
      { x: g.x - 10, y: g.y - 4 + i * 2 }), siteId: g.requiredIds[0], homeX: g.x - 10, homeY: g.y })));
    saved.serial = 24;
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    for (const [i, pilot] of pilots.entries()) {
      const g = groups[i];
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run(`probe-core-${i}`, pilot, 220 + i * 12, 85, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(g.x - 15, g.y, pilot);
      db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot, JSON.stringify({ ...freshLife(), deployed: true, health: 100000 }));
    }
  } finally { db.close(); }
  let bytes = 0, peakRss = process.memoryUsage().rss, peakHeap = process.memoryUsage().heapUsed;
  const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
  const started = performance.now(), cpu = process.cpuUsage();
  for (const c of clients) {
    await c.request('/api/campaigns/enter', { id });
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(origin + route + 'events', { headers: { Cookie: c.header() }, signal: controller.signal });
    if (!response.ok) throw new Error('SSE connection failed');
    void (async () => { try { for await (const chunk of response.body) bytes += chunk.length; } catch { /* aborted */ } })();
  }
  sampler = setInterval(() => { const m = process.memoryUsage(); peakRss = Math.max(peakRss, m.rss); peakHeap = Math.max(peakHeap, m.heapUsed); }, 100);
  await new Promise(resolve => setTimeout(resolve, 30000));
  clearInterval(sampler); delay.disable();
  const used = process.cpuUsage(cpu), seconds = (performance.now() - started) / 1000, end = await owner.request(route + 'world');
  await owner.request('/api/campaigns/leave', {});
  console.log(JSON.stringify({ scope: 'local Node full server plus local clients; one room, four SSE clients, 24 mixed defenders; no browser rendering',
    dense, compounds: groups.length, sites: siteCount, siteKiB: +(setupSiteBytes / 1024).toFixed(1),
    combatSnapshotKiB: +(Buffer.byteLength(JSON.stringify(end.combat)) / 1024).toFixed(1), livingEnemies: end.combat.enemies.length,
    seconds: +seconds.toFixed(1), peakRssMiB: +(peakRss / 1048576).toFixed(1), peakHeapMiB: +(peakHeap / 1048576).toFixed(1),
    processCpuPercent: +((used.user + used.system) / 10000 / seconds).toFixed(1), eventLoopP95Ms: +(delay.percentile(95) / 1e6).toFixed(2),
    totalSseKiBPerSecond: +(bytes / 1024 / seconds).toFixed(1) }, null, 2));
} finally {
  clearInterval(sampler); streams.forEach(s => s.abort()); await app.close();
  if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-density-')) throw new Error('Unexpected probe directory');
  await rm(dir, { recursive: true, force: true });
}
