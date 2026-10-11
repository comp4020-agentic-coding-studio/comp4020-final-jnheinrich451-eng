import { expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { createAudit } from '../observability.js';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { seedConquest } from '../public/conquest.js';

it('allowlists metadata, separates async actors and bounds high-rate summaries', async () => {
  const lines: any[] = [], audit = createAudit((line: string) => lines.push(JSON.parse(line)));
  try {
    expect(audit.run({ url: 'http://[invalid', method: 'GET' }, new EventEmitter(), () => 'handled')).toBe('handled');
    await Promise.all(['alpha', 'bravo'].map(async name => {
      const res: any = new EventEmitter(); res.statusCode = 200;
      await audit.run({ url: '/api/buildings?password=secret-query', method: 'POST' }, res, async () => {
        audit.actor({ id: name, name, kind: 'guest', credential: 'secret-cookie' });
        audit.bind({ password: 'secret-password', token: 'secret-token' });
        await new Promise(resolve => setTimeout(resolve, name === 'alpha' ? 10 : 1));
        audit.result(200, { building: { id: name + '-building' }, password: 'secret-response' });
        res.emit('finish');
      });
    }));
    expect(lines.map(e => [e.actorId, e.targetId])).toEqual([['bravo', 'bravo-building'], ['alpha', 'alpha-building']]);
    for (let i = 0; i < 100; i++) {
      const res: any = new EventEmitter(); res.statusCode = 409;
      audit.run({ url: '/api/fire', method: 'POST' }, res, () => { audit.result(409, { error: 'Weapon reloading.' }); res.emit('finish'); });
    }
    expect(lines).toHaveLength(2); audit.close();
    expect(lines.at(-1)).toMatchObject({ event: 'activity.summary', count: 100, outcome: 'denied', reason: 'Weapon reloading.' });
    expect(JSON.stringify(lines)).not.toContain('secret-');
  } finally { audit.close(); }
});

it('correlates delayed conquest after checkpoint restore without exposing audit metadata in snapshots', () => {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), tanks: [], cores: [], rails: [], artillery: [], airbases: [], ships: [] };
  world.sites = seedConquest(world, [], []); const site = world.sites[0]; site.hp = 10;
  const context = { requestId: 'original-request', actorId: 'original-actor', pilotId: 'guest-pilot', kind: 'guest', name: 'Scout', campaignId: 'saved-campaign' };
  const combat = createCombat(world, null, () => context);
  expect(combat.lob({ id: 'shared-gun', x: site.x - 10, y: site.y + 1.5 }, site.x + 1.5, site.y + 1.5)).toBeNull();
  const launch = combat.drainEvents()[0]; expect(launch).toMatchObject({ event: 'weapon.launched', ...context, sourceId: 'shared-gun' });
  expect(JSON.stringify(combat.snapshot())).not.toContain('original-request');
  const restored = createCombat(world, combat.checkpoint());
  for (let i = 0; i < 30; i++) restored.tick(.1, []);
  const outcomes = restored.drainEvents();
  expect(outcomes.filter(e => e.event === 'objective.conquered')).toEqual([expect.objectContaining({ event: 'objective.conquered', ...context, projectileId: launch.projectileId, targetId: site.id, hp: 0 })]);
  expect(outcomes.some(e => e.event === 'sector.alerted')).toBe(true);
  expect(restored.checkpoint().causes).toEqual([]);
  expect(restored.drainEvents()).toEqual([]);
});
