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
    expect(lines.filter(e => e.event === 'action.result').map(e => [e.actorId, e.targetId])).toEqual([['bravo', 'bravo-building'], ['alpha', 'alpha-building']]);
    for (let i = 0; i < 100; i++) {
      const res: any = new EventEmitter(); res.statusCode = 409;
      audit.run({ url: '/api/fire', method: 'POST' }, res, () => { audit.result(409, { error: 'Weapon reloading.' }); res.emit('finish'); });
    }
    expect(lines).toHaveLength(4); audit.close();
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

it('records arrival before dispatch, correlates the authenticated actor and logs unfinished requests', () => {
  const lines: any[] = [], audit = createAudit(line => lines.push(JSON.parse(line)), { buildId: 'test-build', password: 'secret-metadata' });
  try {
    const res: any = new EventEmitter(); res.statusCode = 403;
    audit.run({ url: '/api/buildings?token=secret-query', method: 'POST' }, res, () => {
      expect(lines[0]).toMatchObject({ event: 'request.received', kind: 'anonymous', action: 'buildings' });
      audit.actor({ id: 'pilot', name: 'Pilot', kind: 'demo' }); audit.received(); audit.received();
      audit.result(403, { error: 'Not your facility.' }); res.emit('finish');
    });
    expect(lines.map(e => e.event)).toEqual(['request.received', 'action.received', 'action.result']);
    expect(new Set(lines.map(e => e.requestId)).size).toBe(1);
    expect(lines[1]).toMatchObject({ actorId: 'pilot', pilotId: 'pilot' });
    expect(lines[2]).toMatchObject({ outcome: 'denied', reason: 'Not your facility.' });
    const pending: any = new EventEmitter();
    audit.run({ url: '/api/cores', method: 'POST' }, pending, () => {});
    expect(lines.at(-1)).toMatchObject({ event: 'request.received', action: 'cores' });
    expect(lines.every(e => e.instanceId === lines[0].instanceId && e.buildId === 'test-build')).toBe(true);
    expect(JSON.stringify(lines)).not.toContain('secret-');
  } finally { audit.close(); }
});

it('bounds broadcast and receipt volume, preserves room counts and never logs full state', () => {
  const lines: any[] = [], audit = createAudit(line => lines.push(JSON.parse(line)));
  try {
    for (let revision = 1; revision <= 100; revision++) {
      audit.broadcast({ campaignId: 'room-a', revision, connections: 2, connectedPlayers: 2, queuedWrites: 2, droppedStreams: 0, world: { password: 'secret-state' } });
      const res: any = new EventEmitter(); res.statusCode = 200;
      audit.run({ url: '/api/input', method: 'POST' }, res, () => { audit.actor({ id: 'a', name: 'A' }); audit.received(); res.emit('finish'); });
    }
    audit.broadcast({ campaignId: 'room-b', revision: 1, connections: 1, connectedPlayers: 1, queuedWrites: 0, droppedStreams: 1 });
    expect(lines).toHaveLength(2); audit.close();
    const summary = lines.find(e => e.event === 'state.broadcast.summary');
    expect(summary).toMatchObject({ campaignId: 'room-a', count: 99, firstRevision: 2, revision: 100, queuedWrites: 198, droppedStreams: 0, connections: 2 });
    for (const event of ['request.received.summary', 'action.received.summary', 'activity.summary']) expect(lines.find(e => e.event === event).count).toBe(100);
    expect(lines).toHaveLength(6);
    expect(JSON.stringify(lines)).not.toContain('secret-state');
  } finally { audit.close(); }
});

it('does not merge revision ranges when the same campaign is reopened', () => {
  const lines: any[] = [], audit = createAudit(line => lines.push(JSON.parse(line)));
  try {
    for (const [runtimeId, revisions] of [['old-run', [90, 91]], ['new-run', [1, 2]]] as const)
      for (const revision of revisions) audit.broadcast({ campaignId: 'same-room', runtimeId, revision, connections: 1, queuedWrites: 1, droppedStreams: 0 });
    audit.close();
    expect(lines.filter(e => e.event === 'state.broadcast').map(e => [e.runtimeId, e.revision])).toEqual([['old-run', 90], ['new-run', 1]]);
    expect(lines.filter(e => e.event === 'state.broadcast.summary').map(e => [e.runtimeId, e.firstRevision, e.revision])).toEqual([['old-run', 91, 91], ['new-run', 2, 2]]);
  } finally { audit.close(); }
});
