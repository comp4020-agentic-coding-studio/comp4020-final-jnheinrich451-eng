import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';

it('keeps undeployed guests in orbit across restart and out of other players landing footprints', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-orbit-'));
  let app = createApp({ dataDir });
  const stream = new AbortController();
  async function listen() {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    return `http://127.0.0.1:${address.port}`;
  }
  let base = await listen();
  const state = async (cookie: string) => (await fetch(`${base}/api/world`, { headers: { Cookie: cookie } })).json();
  const post = (cookie: string, route: string, data: unknown) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    const a = await fetch(`${base}/api/world`), b = await fetch(`${base}/api/world`);
    const cookieA = a.headers.get('set-cookie')!.split(';')[0], cookieB = b.headers.get('set-cookie')!.split(';')[0];
    const initial = await a.json();
    expect(initial.me.body).toBe('orbital');
    expect((await b.json()).me.body).toBe('orbital');
    for (const route of ['input', 'fire', 'revive', 'tanks/board', 'rails', 'drill']) {
      expect((await post(cookieA, route, { x: 1, y: 0 })).status).toBe(409);
    }
    await app.close(); app = createApp({ dataDir }); base = await listen();
    expect((await state(cookieA)).me).toMatchObject({ id: initial.me.id, body: 'orbital', x: initial.me.x, y: initial.me.y });
    const response = await fetch(`${base}/api/events`, { headers: { Cookie: cookieA }, signal: stream.signal });
    const reader = response.body!.getReader();
    void (async () => { try { while (!(await reader.read()).done) { /* drain */ } } catch { /* closed by test */ } })();
    // Both guests' stored reference coordinates lie inside this former helipad
    // footprint. Neither has a physical body that can block the other's drop.
    expect((await post(cookieA, 'cores', { x: 24, y: 18 })).status).toBe(201);
    expect((await state(cookieA)).me).toMatchObject({ body: 'robot', deploying: true });
    expect((await state(cookieB)).me).toMatchObject({ body: 'orbital', x: initial.me.x, y: initial.me.y });
    expect((await post(cookieA, 'tanks', { x: 30, y: 20 })).status).toBe(409);
    expect((await post(cookieA, 'cores', { x: 24, y: 18 })).status).toBe(200);
    expect((await state(cookieA)).cores).toHaveLength(1);
  } finally { stream.abort(); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
