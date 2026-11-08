import { expect, it, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';
import { resetWorld } from '../world-maintenance.js';

async function fixture(run: (h: any) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-delete-')), logs: any[] = [], streams: AbortController[] = [];
  const logSink = (line: string) => logs.push(JSON.parse(line));
  let app = createApp({ dataDir: dir, logSink }), base = '';
  async function listen() { await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(app.server.address() as any).port}`; }
  function client() {
    const cookies = new Map<string, string>(), header = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    return { header, async request(route: string, data?: any, origin?: string) {
      const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST',
        headers: { Cookie: header(), ...(data === undefined ? {} : { Origin: origin || base, 'Content-Type': 'application/json' }) },
        body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) { const [k, v] = raw.split(';')[0].split('='); if (v) cookies.set(k, v); else cookies.delete(k); }
      return { status: response.status, data: await response.json() };
    } };
  }
  async function account(name: string) {
    const c = client(), credentials = { name, email: `${name}@frontier.test`, password: 'isolated deletion account password 123!', kind: 'demo' };
    expect((await c.request('/api/auth/register', credentials)).status).toBe(200);
    const inbox = (await c.request('/api/auth/inbox')).data;
    expect((await c.request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] })).status).toBe(200);
    expect((await c.request('/api/auth/login', credentials)).status).toBe(200); return c;
  }
  async function create(c: any, name = 'Disposable save') {
    const response = await c.request('/api/campaigns/create', { name }); expect(response.status).toBe(200); return response.data.id;
  }
  async function connect(c: any, id: string) {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(`${base}/api/campaign-world/${id}/events`, { headers: { Cookie: c.header() }, signal: controller.signal });
    expect(response.status).toBe(200);
    void (async () => { try { for await (const chunk of response.body as any) { void chunk; } } catch { /* fixture closed */ } })();
    return controller;
  }
  const database = (fn: (db: DatabaseSync) => any) => { const db = new DatabaseSync(path.join(dir, 'world.sqlite')); try { return fn(db); } finally { db.close(); } };
  async function restart(resetLegacy = false) {
    streams.splice(0).forEach(s => s.abort()); await app.close();
    if (resetLegacy) await resetWorld(dir);
    app = createApp({ dataDir: dir, logSink }); await listen();
  }
  try { await listen(); await run({ account, client, create, connect, database, restart, logs, dir, base: () => base }); }
  finally {
    vi.restoreAllMocks(); streams.forEach(s => s.abort()); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-delete-')) throw Error('Unexpected fixture path');
    await rm(dir, { recursive: true, force: true });
  }
}
const deletion = (client: any, id: string) => client.request('/api/campaigns/delete', { id, confirm: true });
const listed = async (client: any, id: string) => (await client.request('/api/campaigns/list')).data.campaigns.find((c: any) => c.id === id);

it('requires the owner, explicit confirmation, same origin and a truly closed campaign', async () => fixture(async h => {
  const owner = await h.account('delete-owner'), other = await h.account('delete-other'), guest = h.client();
  const id = await h.create(owner);
  expect(await listed(owner, id)).toMatchObject({ owner: true, canDelete: true });
  expect((await deletion(other, id)).status).toBe(403); expect((await deletion(guest, id)).status).toBe(403);
  expect((await owner.request('/api/campaigns/delete', { id })).status).toBe(400);
  expect((await owner.request('/api/campaigns/delete', { id, confirm: false })).status).toBe(400);
  expect((await owner.request('/api/campaigns/delete', { id, confirm: true }, 'https://unrelated.invalid')).status).toBe(403);
  expect((await deletion(owner, '../world')).status).toBe(400);
  await owner.request('/api/campaigns/enter', { id });
  // Initial admission and reconnect grace are both live rooms, even when open=false.
  expect(await listed(owner, id)).toMatchObject({ open: false, canDelete: false });
  expect((await deletion(owner, id)).status).toBe(409);
  const stream = await h.connect(owner, id);
  expect(await listed(owner, id)).toMatchObject({ open: true, canDelete: false });
  expect((await owner.request('/api/campaigns/pause', { id, paused: true })).status).toBe(200);
  expect((await deletion(owner, id)).status).toBe(409);
  stream.abort(); await expect.poll(async () => (await listed(owner, id)).open).toBe(false);
  expect(await listed(owner, id)).toMatchObject({ canDelete: false }); expect((await deletion(owner, id)).status).toBe(409);
  expect((await owner.request('/api/campaigns/leave', {})).status).toBe(200);
  expect(await listed(owner, id)).toMatchObject({ canDelete: true }); expect((await deletion(owner, id)).status).toBe(200);
}), 15000);

it('frees an owned slot, revokes joined access and persists idempotent deletion without touching other saves or accounts', async () => fixture(async h => {
  const owner = await h.account('delete-persist-owner'), peer = await h.account('delete-persist-peer'), guest = h.client();
  const id = await h.create(owner, 'Retired campaign'), kept = await h.create(owner, 'Keep this save'); await h.create(owner, 'Third slot');
  expect((await owner.request('/api/campaigns/create', { name: 'Full' })).status).toBe(409);
  await owner.request('/api/campaigns/enter', { id: kept });
  const keptWorld = (await owner.request(`/api/campaign-world/${kept}/world`)).data.world;
  await owner.request('/api/campaigns/leave', {});
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  const initial = (await owner.request(`/api/campaign-world/${id}/world`)).data;
  for (const member of [peer, guest]) {
    const invite = await owner.request('/api/campaigns/invite', { id }); expect(invite.status).toBe(200);
    expect((await member.request('/api/campaigns/join', { code: invite.data.code })).status).toBe(200);
  }
  const unused = (await owner.request('/api/campaigns/invite', { id })).data.code;
  expect(await listed(peer, id)).toMatchObject({ owner: false, canDelete: false });
  await owner.request('/api/campaigns/leave', {});
  expect((await deletion(peer, id)).status).toBe(403);
  const legacyWorldBefore = h.database((db: DatabaseSync) => db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value);
  const replies = await Promise.all([deletion(owner, id), deletion(owner, id)]);
  expect(replies.map(r => r.status)).toEqual([200, 200]); expect(replies[0].data).toEqual({ deleted: true, id });
  expect(await listed(owner, id)).toBeUndefined(); expect(await listed(peer, id)).toBeUndefined();
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(403);
  expect((await peer.request('/api/campaigns/enter', { id })).status).toBe(403);
  expect((await guest.request('/api/campaigns/join', { code: unused })).status).toBe(400);
  h.database((db: DatabaseSync) => {
    expect(db.prepare('SELECT * FROM campaigns WHERE id=?').get(id)).toBeUndefined();
    for (const table of ['campaign_members', 'campaign_invites', 'campaign_abandoned']) expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE campaign_id=?`).get(id)!.n).toBe(0);
    expect(db.prepare('SELECT * FROM campaign_deleted WHERE id=?').get(id)).toBeTruthy();
    expect(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value).toBe(legacyWorldBefore);
  });
  const replacement = await h.create(owner, 'Freed slot'); expect(replacement).not.toBe(id);
  // Private recovery files remain; player-facing deletion is not a disk purge.
  expect((await stat(path.join(h.dir, 'campaigns', id, 'world.sqlite'))).isFile()).toBe(true);
  const archived = new DatabaseSync(path.join(h.dir, 'campaigns', id, 'world.sqlite'), { readOnly: true });
  try { expect(JSON.parse(archived.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string).terrain).toEqual(initial.world.terrain); }
  finally { archived.close(); }
  await h.restart();
  expect(await listed(owner, id)).toBeUndefined(); expect(await listed(peer, id)).toBeUndefined();
  expect(await listed(owner, kept)).toMatchObject({ name: 'Keep this save', canDelete: true });
  expect(await listed(owner, replacement)).toBeTruthy(); expect((await deletion(owner, id)).status).toBe(200);
  expect((await deletion(peer, id)).status).toBe(403);
  await owner.request('/api/campaigns/enter', { id: kept });
  expect((await owner.request(`/api/campaign-world/${kept}/world`)).data.world.terrain).toEqual(keptWorld.terrain);
  expect(h.logs.filter((entry: any) => entry.event === 'campaign.deleted' && entry.campaignId === id)).toHaveLength(1);
  const tombstone = h.database((db: DatabaseSync) => db.prepare('SELECT * FROM campaign_deleted WHERE id=?').get(id));
  await h.restart(true);
  // The legacy world reset must preserve campaign ownership and deletion records.
  expect(h.database((db: DatabaseSync) => db.prepare('SELECT * FROM campaign_deleted WHERE id=?').get(id))).toEqual(tombstone);
  expect((await owner.request('/api/auth/login', { email: 'delete-persist-owner@frontier.test', password: 'isolated deletion account password 123!', kind: 'demo' })).status).toBe(200);
  expect(await listed(owner, id)).toBeUndefined(); expect(await listed(owner, kept)).toMatchObject({ owner: true, canDelete: true });
  expect((await deletion(owner, id)).status).toBe(200);
  expect((await stat(path.join(h.dir, 'campaigns', id, 'world.sqlite'))).isFile()).toBe(true);
}), 15000);

it('serializes enter versus delete and refuses deletion while the closed runtime is still saving', async () => fixture(async h => {
  const owner = await h.account('delete-race-owner'), id = await h.create(owner);
  const responses = await Promise.all([deletion(owner, id), owner.request('/api/campaigns/enter', { id })]);
  expect([[200, 403], [409, 200]]).toContainEqual(responses.map(r => r.status));
  if (responses[1].status === 200) { await owner.request('/api/campaigns/leave', {}); expect((await deletion(owner, id)).status).toBe(200); }
  const saving = await h.create(owner); await owner.request('/api/campaigns/enter', { id: saving });
  const originalClose = http.Server.prototype.close; let finishClose: (() => void) | undefined;
  const spy = vi.spyOn(http.Server.prototype, 'close').mockImplementation(function(this: http.Server, ...args: any[]) {
    if (!this.listening && !finishClose) { finishClose = () => { originalClose.apply(this, args as any); }; return this; }
    return originalClose.apply(this, args as any);
  });
  let leaving: Promise<any> | undefined;
  try {
    leaving = owner.request('/api/campaigns/leave', {}); await expect.poll(() => !!finishClose).toBe(true);
    expect(await listed(owner, saving)).toMatchObject({ open: false, canDelete: false });
    expect((await deletion(owner, saving)).status).toBe(409);
    spy.mockRestore(); finishClose!(); finishClose = undefined;
    expect((await leaving).status).toBe(200);
  } finally { spy.mockRestore(); finishClose?.(); if (leaving) await leaving; }
  expect((await deletion(owner, saving)).status).toBe(200);
  await h.restart(); expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(403);
}), 15000);

it('rolls back a failed deletion and counts recovery archives toward the global storage allowance', async () => fixture(async h => {
  const owner = await h.account('delete-rollback-owner'), id = await h.create(owner);
  h.database((db: DatabaseSync) => db.exec("CREATE TRIGGER reject_campaign_delete BEFORE DELETE ON campaigns BEGIN SELECT RAISE(ABORT,'fixture storage failure'); END"));
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  try { expect((await deletion(owner, id)).status).toBe(500); }
  finally { logged.mockRestore(); }
  expect(await listed(owner, id)).toMatchObject({ canDelete: true });
  h.database((db: DatabaseSync) => {
    expect(db.prepare('SELECT * FROM campaign_deleted WHERE id=?').get(id)).toBeUndefined();
    expect(db.prepare('SELECT COUNT(*) AS n FROM campaign_members WHERE campaign_id=?').get(id)!.n).toBe(1);
    db.exec('DROP TRIGGER reject_campaign_delete');
    const insert = db.prepare('INSERT INTO campaign_deleted VALUES (?,?,?)');
    // One transaction: row-by-row commits can block this shared event loop past
    // the server's keep-alive timeout, resetting the next request's socket.
    db.exec('BEGIN');
    for (let i = 0; i < 999; i++) insert.run(randomUUID(), 'archive-fixture-owner', Date.now());
    db.exec('COMMIT');
  });
  expect((await deletion(owner, id)).status).toBe(200);
  expect((await owner.request('/api/campaigns/create', { name: 'Storage full' })).status).toBe(503);
  expect((await owner.request('/api/campaigns/list')).data.campaigns).toEqual([]);
}), 15000);

it('rechecks credentials after receiving a delayed deletion body', async () => fixture(async h => {
  const owner = await h.account('delete-expired-owner'), id = await h.create(owner), body = JSON.stringify({ id, confirm: true });
  let request: http.ClientRequest;
  const completed = new Promise<{ status: number | undefined; data: any }>((resolve, reject) => {
    request = http.request(h.base() + '/api/campaigns/delete', { method: 'POST', headers: {
      Cookie: owner.header(), Origin: h.base(), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, response => {
      let result = ''; response.on('data', chunk => result += chunk); response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(result) }));
    });
    request.on('error', reject); request.write(body.slice(0, -1));
  });
  void completed.catch(() => {});
  try {
    await expect.poll(() => h.logs.some((entry: any) => entry.event === 'action.received' && entry.action === 'campaigns/delete')).toBe(true);
    expect((await owner.request('/api/auth/login', { email: 'delete-expired-owner@frontier.test', password: 'isolated deletion account password 123!', kind: 'demo' })).status).toBe(200);
    request!.end(body.slice(-1)); const response = await completed;
    expect(response.status).toBe(401); expect(response.data.error).toContain('session changed');
    expect(await listed(owner, id)).toMatchObject({ canDelete: true });
  } finally { request!.destroy(); await completed.catch(() => {}); }
}), 15000);

it('keeps three war-zone and three peaceful saves per account, each mode freed only by its own deletion', async () => fixture(async h => {
  const owner = await h.account('per-mode-owner');
  const make = (name: string, mode: string) => owner.request('/api/campaigns/create', { name, mode });
  const war: string[] = [], peaceful: string[] = [];
  for (let i = 0; i < 3; i++) { const r = await make(`War ${i}`, 'combat'); expect(r.status).toBe(200); war.push(r.data.id); }
  const fourthWar = await make('War 3', 'combat');
  expect(fourthWar.status).toBe(409); expect(fourthWar.data.error).toContain('war-zone');
  // A full war zone does not block peaceful expeditions, which have their own three.
  for (let i = 0; i < 3; i++) { const r = await make(`Garden ${i}`, 'colonization'); expect(r.status).toBe(200); peaceful.push(r.data.id); }
  const fourthPeace = await make('Garden 3', 'colonization');
  expect(fourthPeace.status).toBe(409); expect(fourthPeace.data.error).toContain('expedition');
  const listing = (await owner.request('/api/campaigns/list')).data;
  expect(listing.saveLimit).toBe(3);
  expect(listing.campaigns.filter((c: any) => c.owner && c.mode === 'combat')).toHaveLength(3);
  expect(listing.campaigns.filter((c: any) => c.owner && c.mode === 'colonization')).toHaveLength(3);
  // Deleting an expedition frees an expedition slot only.
  expect((await deletion(owner, peaceful[0])).status).toBe(200);
  expect((await make('War 4', 'combat')).status).toBe(409);
  expect((await make('Garden 4', 'colonization')).status).toBe(200);
  // And deleting a war-zone campaign frees a war-zone slot only.
  expect((await deletion(owner, war[0])).status).toBe(200);
  expect((await make('Garden 5', 'colonization')).status).toBe(409);
  expect((await make('War 5', 'combat')).status).toBe(200);
}), 20000);
