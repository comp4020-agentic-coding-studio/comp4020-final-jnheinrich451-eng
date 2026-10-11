import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { resetWorld } from '../world-maintenance.js';

const password = 'a unique test password 123!';
const registration = { kind: 'demo', email: 'pilot@frontier.test', name: 'Pilot', password };
async function fixture(run: (h: any) => Promise<void>, available = false) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-accounts-'));
  const sent: { email: string; token: string; purpose: string }[] = [];
  let failMail = false;
  const emailDelivery = { available, async send(email: string, token: string, purpose: string) { if (failMail) throw new Error('Test SMTP failure'); sent.push({ email, token, purpose }); } };
  let app = createApp({ dataDir: dir, emailDelivery }), base = '';
  const streams: AbortController[] = [];
  async function listen() { await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve)); const a = app.server.address(); if (!a || typeof a === 'string') throw new Error(); base = `http://127.0.0.1:${a.port}`; }
  function client() {
    const cookies = new Map<string, string>();
    return { cookies, async request(route: string, data?: unknown, origin = true) {
      const res = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(data === undefined ? {} : { 'Content-Type': 'application/json', ...(origin ? { Origin: base } : {}) }) }, body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of res.headers.getSetCookie()) { const [k, v] = raw.split(';')[0].split('='); if (v) cookies.set(k, v); else cookies.delete(k); }
      return { status: res.status, data: await res.json(), headers: res.headers };
    } };
  }
  const database = (fn: (db: DatabaseSync) => any) => { const db = new DatabaseSync(path.join(dir, 'world.sqlite')); try { return fn(db); } finally { db.close(); } };
  const connect = async (c: ReturnType<typeof client>) => {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(base + '/api/events', { signal: controller.signal, headers: { Cookie: [...c.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } });
    const reader = response.body!.getReader(); let output = '';
    void (async () => { try { while (true) { const chunk = await reader.read(); if (chunk.done) break; output += new TextDecoder().decode(chunk.value); } } catch { /* closed by test */ } })();
    return { output: () => output };
  };
  const activateDemo = async (c: ReturnType<typeof client>) => {
    const reg = await c.request('/api/auth/register', registration); expect(reg.status).toBe(200);
    const mail = await c.request('/api/auth/inbox'); expect(mail.status).toBe(200);
    const token = mail.data.messages[0].href.split('#token=')[1];
    expect((await c.request('/api/auth/verify', { token })).status).toBe(200);
    return token;
  };
  const restart = async (reset = false) => { streams.splice(0).forEach(c => c.abort()); await app.close(); if (reset) await resetWorld(dir); app = createApp({ dataDir: dir, emailDelivery }); await listen(); };
  try { await listen(); await run({ client, database, connect, activateDemo, restart, sent, base: () => base, server: () => app.server, failMail: (value: boolean) => { failMail = value; } }); }
  finally { streams.forEach(c => c.abort()); await app.close(); await rm(dir, { recursive: true, force: true }); }
}

it('links a guest to a persistent Demo account without replacing ownership or exposing real verification', async () => fixture(async h => {
  const c = h.client(), initial = (await c.request('/api/world')).data;
  const oldCookie = c.cookies.get('frontier');
  h.database((db: DatabaseSync) => db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('saved-sentry', 28, 18, initial.me.id, 'test'));
  const token = await h.activateDemo(c);
  expect(h.sent).toHaveLength(0);
  expect((await c.request('/api/auth/verify', { token })).status).toBe(400);
  const logged = await c.request('/api/auth/login', registration);
  expect(logged.data.account).toMatchObject({ kind: 'demo', playerId: initial.me.id, verifiedEmail: false });
  const bearer = c.cookies.get('frontier_account');
  const row = h.database((db: DatabaseSync) => db.prepare('SELECT * FROM account_sessions').get());
  expect(row.hash).not.toBe(bearer);
  expect(h.database((db: DatabaseSync) => db.prepare('SELECT password_hash FROM accounts').get()).password_hash).not.toBe(password);
  await h.restart();
  const state = (await c.request('/api/world')).data;
  expect(state.me.id).toBe(initial.me.id);
  expect(state.buildings).toContainEqual(expect.objectContaining({ id: 'saved-sentry', owner: initial.me.id }));
  expect(JSON.stringify(state)).not.toContain('pilot@frontier.test');
  const stale = h.client(); stale.cookies.set('frontier', oldCookie);
  expect((await stale.request('/api/world')).data.me.id).not.toBe(initial.me.id);
}));

it('requires deliberate takeover, closes live control, and retains an unrelated guest when logging out', async () => fixture(async h => {
  const first = h.client(); await h.activateDemo(first); await first.request('/api/auth/login', registration);
  const oldToken = first.cookies.get('frontier_account');
  const stream = await h.connect(first);
  const second = h.client(), guestId = (await second.request('/api/world')).data.me.id;
  const challenge = await second.request('/api/auth/login', registration);
  expect(challenge.data.takeoverRequired).toBe(true);
  expect((await first.request('/api/world')).status).toBe(200);
  expect((await second.request('/api/auth/login', { ...registration, takeover: true })).status).toBe(200);
  await expect.poll(stream.output).toContain('session-ended');
  expect((await first.request('/api/input', { x: 1, y: 0 })).status).toBe(401);
  expect((await second.request('/api/world')).data.me.id).not.toBe(guestId);
  await second.request('/api/auth/logout', {});
  expect((await second.request('/api/world')).data.me.id).toBe(guestId);
  const expired = h.client(); expired.cookies.set('frontier_account', oldToken);
  expect((await expired.request('/api/world')).status).toBe(401);
}));

it('keeps Demo inboxes private and prevents duplicate signup from replacing credentials', async () => fixture(async h => {
  const owner = h.client(); await h.activateDemo(owner);
  const stranger = h.client();
  expect((await stranger.request('/api/auth/inbox')).status).toBe(401);
  await stranger.request('/api/auth/register', { ...registration, name: 'Intruder', password: 'a completely different password' });
  expect((await stranger.request('/api/auth/inbox')).status).toBe(401);
  expect((await stranger.request('/api/auth/login', { ...registration, password: 'a completely different password' })).status).toBe(401);
  expect((await owner.request('/api/auth/login', registration)).data.account.name).toBe('Pilot');
  await stranger.request('/api/auth/recover', registration);
  expect((await stranger.request('/api/auth/inbox')).status).toBe(401);
  expect(h.database((db: DatabaseSync) => db.prepare("SELECT COUNT(*) AS n FROM account_tokens WHERE purpose='reset'").get()).n).toBe(0);
}));

it('resets Demo passwords only with inbox access, consumes the link once and revokes old sessions', async () => fixture(async h => {
  const c = h.client(); await h.activateDemo(c); await c.request('/api/auth/login', registration);
  const id = (await c.request('/api/world')).data.me.id, old = c.cookies.get('frontier_account');
  await c.request('/api/auth/recover', registration);
  const token = (await c.request('/api/auth/inbox')).data.messages.find((m: any) => m.purpose === 'reset').href.split('#token=')[1];
  const newPassword = 'a new unique test password 456!';
  expect((await c.request('/api/auth/reset', { token, password: newPassword })).status).toBe(200);
  expect((await c.request('/api/auth/reset', { token, password: newPassword })).status).toBe(400);
  expect((await c.request('/api/auth/login', registration)).status).toBe(401);
  const stale = h.client(); stale.cookies.set('frontier_account', old);
  expect((await stale.request('/api/world')).status).toBe(401);
  expect((await c.request('/api/auth/login', { ...registration, password: newPassword })).data.account.playerId).toBe(id);
}));

it('supports non-ANU real email through injected delivery, enforces mode separation and rejects expired links', async () => fixture(async h => {
  const c = h.client(), real = { ...registration, kind: 'email', email: 'pilot@example.org' };
  expect((await c.request('/api/auth/register', { ...real, kind: 'demo' })).status).toBe(400);
  expect((await c.request('/api/auth/register', real)).status).toBe(200);
  expect(h.sent).toHaveLength(1); expect(h.sent[0].email).toBe(real.email);
  expect((await c.request('/api/auth/inbox')).status).toBe(401);
  expect((await c.request('/api/auth/login', real)).status).toBe(409);
  const expired = h.sent[0].token;
  h.database((db: DatabaseSync) => db.exec('UPDATE account_tokens SET expires_at=0'));
  expect((await c.request('/api/auth/verify', { token: expired })).status).toBe(400);
  await c.request('/api/auth/resend', real);
  await expect.poll(() => h.sent.length).toBe(2);
  expect((await c.request('/api/auth/verify', { token: h.sent[1].token })).status).toBe(200);
  expect((await c.request('/api/auth/login', real)).data.account.verifiedEmail).toBe(true);
  await c.request('/api/auth/recover', real);
  await expect.poll(() => h.sent.length).toBe(3);
  expect(h.sent[2].purpose).toBe('reset');
}, true));

it('keeps failed delivery unverified and rejects cross-site or missing-origin account changes', async () => fixture(async h => {
  const c = h.client(), real = { ...registration, kind: 'email', email: 'pilot@example.org' };
  expect((await c.request('/api/auth/register', registration, false)).status).toBe(403);
  h.failMail(true);
  expect((await c.request('/api/auth/register', real)).status).toBe(503);
  expect(h.database((db: DatabaseSync) => db.prepare('SELECT activated_at FROM accounts').get()).activated_at).toBeNull();
  expect(h.database((db: DatabaseSync) => db.prepare('SELECT COUNT(*) AS n FROM account_tokens').get()).n).toBe(0);
  h.failMail(false); await c.request('/api/auth/resend', real);
  await expect.poll(() => h.sent.length).toBe(1);
  expect((await c.request('/api/auth/verify', { token: h.sent[0].token })).status).toBe(200);
}, true));

it('keeps account identity through a local world reset and signs out old sessions', async () => fixture(async h => {
  const c = h.client(); await h.activateDemo(c); await c.request('/api/auth/login', registration);
  const id = (await c.request('/api/world')).data.me.id;
  h.database((db: DatabaseSync) => db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('to-reset', 28, 18, id, 'test'));
  await h.restart(true);
  expect((await c.request('/api/world')).status).toBe(401);
  expect((await c.request('/api/auth/login', registration)).data.account.playerId).toBe(id);
  const state = (await c.request('/api/world')).data;
  expect(state.me.body).toBe('orbital'); expect(state.buildings).toHaveLength(0);
}));

it('leaves guest and Demo access available when real email is not configured', async () => fixture(async h => {
  const c = h.client();
  expect((await c.request('/api/auth/status')).data.smtpAvailable).toBe(false);
  expect((await c.request('/api/auth/register', { ...registration, kind: 'email', email: 'pilot@example.org' })).status).toBe(503);
  expect((await c.request('/api/world')).status).toBe(200);
  await h.activateDemo(c);
}));

it('rejects an old controller whose delayed request body finishes after takeover', async () => fixture(async h => {
  const first = h.client(); await h.activateDemo(first); await first.request('/api/auth/login', registration);
  const received = new Promise<void>(resolve => h.server().once('request', () => resolve()));
  const body = '{"x":1,"y":0}';
  let finish: http.ClientRequest | undefined;
  const result = new Promise<number | undefined>((resolve, reject) => {
    finish = http.request(h.base() + '/api/input', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Cookie: 'frontier_account=' + first.cookies.get('frontier_account') } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    finish.on('error', reject); finish.write(body.slice(0, 5));
  });
  try {
    await received;
    const second = h.client();
    expect((await second.request('/api/auth/login', { ...registration, takeover: true })).status).toBe(200);
    finish!.end(body.slice(5));
    expect(await result).toBe(401);
  } finally { finish?.destroy(); }
}));
