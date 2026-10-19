import { expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

it('h local analogue: two participants recover committed construction after abrupt server death', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-multiplayer-crash-'));
  let child: ChildProcess | undefined, base = '';
  const streams: AbortController[] = [];
  async function start() {
    child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { createApp } from './server.js';
      const app = createApp({dataDir:process.env.DATA_DIR,logSink:()=>{}});
      app.server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:app.server.address().port})));
    `], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '';
    const running = child;
    running.stderr!.on('data', data => { errors += data; });
    base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child server startup timed out: ' + errors)), 15000);
      running.once('error', error => { clearTimeout(timer); reject(error); });
      running.once('exit', code => { clearTimeout(timer); reject(new Error(`Child exited ${code}: ${errors}`)); });
      running.stdout!.on('data', data => {
        output += data;
        const match = output.match(/\{"port":(\d+)\}/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
    });
  }
  async function crash() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  }
  function client() {
    const cookies = new Map<string, string>();
    const header = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    return { header, async request(route: string, data?: unknown) {
      const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST',
        headers: { Cookie: header(), Origin: base, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) { const [key, value] = raw.split(';')[0].split('='); if (value) cookies.set(key, value); else cookies.delete(key); }
      return { status: response.status, data: await response.json() };
    } };
  }
  async function account(name: string) {
    const c = client(), credentials = { name, email: `${name}@frontier.test`, kind: 'demo', password: 'unique crash rehearsal password 123!' };
    expect((await c.request('/api/auth/register', credentials)).status).toBe(200);
    const inbox = (await c.request('/api/auth/inbox')).data;
    expect((await c.request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] })).status).toBe(200);
    expect((await c.request('/api/auth/login', credentials)).status).toBe(200); return c;
  }
  async function connect(c: ReturnType<typeof client>, id: string) {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(base + `/api/campaign-world/${id}/events`, { headers: { Cookie: c.header() }, signal: controller.signal });
    expect(response.status).toBe(200); let output = '';
    void (async () => { try { for await (const data of response.body as any) output += new TextDecoder().decode(data); } catch { /* crash closes stream */ } })();
    return () => output;
  }
  try {
    await start(); const owner = await account('CrashOwner'), peer = await account('CrashPeer');
    const id = (await owner.request('/api/campaigns/create', { name: 'Crash recovery' })).data.id;
    expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200); await connect(owner, id);
    const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
    expect((await peer.request('/api/campaigns/join', { code })).status).toBe(200); const received = await connect(peer, id);
    const route = `/api/campaign-world/${id}`;
    const identities = await Promise.all([owner, peer].map(async c => (await c.request(route + '/world')).data.me.id));
    const built = await owner.request(route + '/cores', { x: 24, y: 18 }); expect(built.status).toBe(201);
    const before = (await owner.request(route + '/world')).data.cores;
    expect(before).toHaveLength(1); await expect.poll(received).toContain(before[0].id);
    // No app.close(), checkpoint request or graceful signal after this acknowledgement.
    await crash(); streams.splice(0).forEach(controller => controller.abort());
    await start();
    expect((await peer.request('/api/campaigns/enter', { id })).status).toBe(409);
    expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200); await connect(owner, id);
    expect((await peer.request('/api/campaigns/enter', { id })).status).toBe(200); const recoveredStream = await connect(peer, id);
    const recovered = await Promise.all([owner, peer].map(async c => (await c.request(route + '/world')).data));
    expect(recovered.map(s => s.me.id)).toEqual(identities);
    for (const state of recovered) {
      expect(state.room.players).toBe(2); expect(state.cores).toHaveLength(1);
      expect(state.cores[0]).toMatchObject({ id: before[0].id, owner: identities[0], x: 24, y: 18 });
    }
    await expect.poll(recoveredStream).toContain(before[0].id);
  } finally { streams.forEach(controller => controller.abort()); await crash(); await rm(dir, { recursive: true, force: true }); }
}, 40000);
