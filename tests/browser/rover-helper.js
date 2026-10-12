// Isolated legacy-field saves for browser specs. Since orbital entry, a new guest
// starts in orbit with no body; the original rover weapons (HE cannon + APCR
// machine gun) now belong to a boarded tank. `rovers` seeds scouts already
// seated in tanks, the same fixture shape tank-range.spec.js uses.
import { createApp } from '../../server.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function isolatedField(prefix, rovers = []) {
  const dataDir = await mkdtemp(path.join(tmpdir(), `frontier-${prefix}-`));
  let app = createApp({ dataDir, logSink: () => {} }); await app.close();
  const seats = rovers.map(r => ({ token: randomUUID(), id: randomUUID(), ...r }));
  if (seats.length) {
    const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
    try {
      for (const s of seats) {
        db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(s.token, s.id, s.name || 'Rover tester', s.x, s.y, 0);
        const tank = { id: `tank-${s.id}`, owner: s.id, occupant: s.id, x: s.x, y: s.y, podX: 10, podY: 10,
          elapsed: 99, health: 200, angle: 0, turret: 0, weapon: 'HE', secondary: 'APCR' };
        db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
      }
    } finally { db.close(); }
  }
  app = createApp({ dataDir, logSink: () => {} });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    base, seats,
    seat: (context, i = 0) => context.addCookies([{ name: 'frontier', value: seats[i].token, url: base }]),
    async close() {
      await app.close();
      if (!path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep + `frontier-${prefix}-`)) throw new Error('Unexpected test directory');
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

// Lands this page's orbital core through the normal API and waits for the robot.
export async function landCore(page, x = 29, y = 13) {
  const result = await page.evaluate(async ({ x, y }) => { const r = await fetch('/api/cores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }); return { status: r.status, error: (await r.json()).error }; }, { x, y });
  if (result.status !== 201) throw new Error(`Core landing at ${x}, ${y} rejected: ${result.status} ${result.error}`);
  const deadline = Date.now() + 12000;
  while (true) {
    const me = await page.evaluate(async () => (await (await fetch('/api/world')).json()).me);
    if (me.body === 'robot' && !me.deploying) return;
    if (Date.now() > deadline) throw new Error('Core landing did not finish');
    await page.waitForTimeout(100);
  }
}
