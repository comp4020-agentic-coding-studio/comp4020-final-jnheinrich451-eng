import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { turnTurret, angleDelta } from '../public/turret.js';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { createApp } from '../server.js';

it('turns at 180 degrees/second, takes the short route across angle wrap and never overshoots', () => {
  expect(turnTurret(0, Math.PI, .1)).toBeCloseTo(Math.PI / 10);
  const radians = (degrees: number) => degrees * Math.PI / 180;
  expect(angleDelta(radians(179), turnTurret(radians(179), radians(-179), 1 / 180))).toBeCloseTo(radians(1));
  expect(turnTurret(radians(179), radians(-179), .1)).toBeCloseTo(radians(-179));
  let angle = 0;
  for (let i = 0; i < 60; i++) angle = turnTurret(angle, Math.PI, 1 / 60);
  expect(Math.abs(angleDelta(angle, Math.PI))).toBeLessThan(1e-8);
  expect(turnTurret(.4, .5, .1)).toBeCloseTo(.5);
});

it('both weapons follow the actual barrel even when the cursor and hull point elsewhere', () => {
  const world = createWorld(), combat = createCombat(world);
  const source = { id: 'player', ...world.spawn, angle: Math.PI, turret: 0 };
  for (const weapon of ['HE', 'APCR']) expect(combat.shoot(source, source.x + 5, source.y, weapon)).toBeNull();
  const state = combat.snapshot();
  for (const shell of state.shells) { expect(shell.dx).toBeCloseTo(0); expect(shell.dy).toBeCloseTo(-1); }
  expect(state.shells[0].remaining).toBe(5);
  expect(state.shells[1].remaining).toBe(14);
  expect(state.shots.every(s => s.angle === 0)).toBe(true);
  expect(source.turret).toBe(0);
});

it('mount speed is configurable without changing player traverse or angle wrapping', () => {
  expect(turnTurret(0, Math.PI / 2, .1, Math.PI / 4)).toBeCloseTo(Math.PI / 40);
  expect(turnTurret(0, Math.PI / 2, .1, Math.PI * 1.5)).toBeCloseTo(Math.PI * .15);
  expect(turnTurret(0, Math.PI / 2, .1)).toBeCloseTo(Math.PI / 10);
  expect(turnTurret(.5, 2, .1, 0)).toBeCloseTo(.5);
});

it('the HTTP server owns traverse and ignores forged firing angles while the hull turns independently', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-turret-'));
  const app = createApp({ dataDir }), stream = new AbortController();
  try {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    const base = `http://127.0.0.1:${address.port}`;
    const guest = await fetch(`${base}/api/world`), cookie = guest.headers.get('set-cookie')!.split(';')[0];
    const initial = await guest.json();
    const events = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: stream.signal });
    // Keep the simulated browser connection alive through the final shot.
    void (async () => { try { for await (const chunk of events.body as any) {} } catch {} })();
    const state = async () => (await fetch(`${base}/api/world`, { headers: { Cookie: cookie } })).json();
    const post = (route: string, body: unknown) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    // A forged desired target / turret cannot teleport the actual firing bearing.
    expect((await post('fire', { x: initial.me.x + 5, y: initial.me.y, weapon: 'HE', turret: Math.PI / 2 })).status).toBe(200);
    expect((await state()).combat.shots[0].angle).toBe(0);
    await expect.poll(async () => (await state()).me.turret).toBeCloseTo(Math.PI / 2, 4);
    await post('input', { x: -1, y: 0, aim: Math.PI / 2, turret: -Math.PI / 2 });
    await expect.poll(async () => angleDelta((await state()).me.angle, -Math.PI / 2)).toBeCloseTo(0, 4);
    const turned = await state();
    expect(turned.me.x).toBeLessThan(initial.me.x);
    expect(turned.me.turret).toBeCloseTo(Math.PI / 2);
    expect((await post('fire', { x: turned.me.x, y: turned.me.y - 5, weapon: 'APCR', turret: 0 })).status).toBe(200);
    const shot = (await state()).combat.shots.find((s: { weapon: string }) => s.weapon === 'APCR');
    expect(shot.angle).toBeCloseTo(Math.PI / 2);
  } finally { stream.abort(); await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
