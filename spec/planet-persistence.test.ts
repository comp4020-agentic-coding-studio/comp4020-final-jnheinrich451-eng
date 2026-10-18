import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server.js';
import { createWorld } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { freshLogistics } from '../public/logistics.js';

it('backs up the full database, migrates floor indices atomically, and is stable on reopening', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-planet-'));
  let app = createApp({ dataDir: dir, logSink: () => {} }); await app.close();
  const file = path.join(dir, 'world.sqlite'), original = expandWorld(createWorld());
  original.terrain[20 * 128 + 60] = 4;
  const floors = [40 * 128 + 80, 41 * 128 + 80], supplies = { ...freshLogistics(), supplies: 432, groundSupplies: 123, floors };
  let db = new DatabaseSync(file);
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(original));
  db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(supplies));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run('token', 'pilot', 'Explorer', 26, 18, .5);
  db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('sentry', 28, 19, 'pilot', 'saved');
  db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(40, 18, 'ew', 'pilot');
  const read = (key: string) => JSON.parse(db.prepare('SELECT value FROM meta WHERE key=?').get(key)!.value as string);
  const checkpoint = { sites: [{ id: 'saved-site', state: 'conquered', x: 80, y: 28 }], shells: [{ id: 'pending', x: 70, y: 30, landAt: 1800 }] };
  db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run('combat-checkpoint-v1', JSON.stringify(checkpoint));
  db.close();
  const backupsBefore = await readdir(path.join(dir, 'backups'));
  try {
    for (let i = 0; i < 2; i++) {
      app = createApp({ dataDir: dir, logSink: () => {} }); await app.close();
      db = new DatabaseSync(file);
      const world = read('world'), logistics = read('logistics-v1');
      expect([world.width, world.height, world.version]).toEqual([512, 384, 3]);
      for (let y = 0; y < 96; y++) expect(world.terrain.slice(y * 512, y * 512 + 128)).toEqual(original.terrain.slice(y * 128, (y + 1) * 128));
      expect(logistics).toMatchObject({ supplies: 432, groundSupplies: 123, floors: [40 * 512 + 80, 41 * 512 + 80] });
      expect(db.prepare('SELECT * FROM scouts').get()).toMatchObject({ x: 26, y: 18, angle: .5 });
      expect(db.prepare('SELECT * FROM buildings').get()).toMatchObject({ id: 'sentry', x: 28, y: 19 });
      expect(db.prepare('SELECT * FROM rails').get()).toMatchObject({ x: 40, y: 18 });
      expect(read('combat-checkpoint-v1')).toEqual(checkpoint);
      db.close();
    }
    const added = (await readdir(path.join(dir, 'backups'))).filter(f => !backupsBefore.includes(f));
    expect(added).toHaveLength(1); expect(added[0]).toMatch(/^before-planet-v3-/);
    db = new DatabaseSync(path.join(dir, 'backups', added[0]));
    expect(read('world')).toEqual(original); expect(read('logistics-v1')).toEqual(supplies);
    expect(db.prepare('SELECT * FROM buildings').get()).toMatchObject({ id: 'sentry' }); db.close();
  } finally {
    await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-planet-')) throw Error('Unexpected path');
    await rm(dir, { recursive: true, force: true });
  }
});
