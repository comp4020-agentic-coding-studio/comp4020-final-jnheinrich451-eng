import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { resetWorld } from '../world-maintenance.js';

it('refuses a running world, backs up all progress, and reopens as a clean shared world', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-reset-'));
  let app: ReturnType<typeof createApp> | undefined;
  try {
    app = createApp({ dataDir });
    await expect(resetWorld(dataDir)).rejects.toThrow('World is in use');
    expect(() => createApp({ dataDir })).toThrow('World is in use');
    await app.close(); app = undefined;
    const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
    const originalWorld = db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value;
    db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run('old-token', 'old-player', 'Pilot', 20, 18, 0);
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('sentry', 28, 18, 'old-player', 'test');
    db.prepare('INSERT INTO equipment VALUES (?,?)').run('player:old-player', '{"weapon":"HE"}');
    db.close();
    const backupPath = await resetWorld(dataDir);
    expect(path.dirname(backupPath)).toBe(path.join(dataDir, 'backups'));
    const saved = new DatabaseSync(backupPath, { readOnly: true });
    try {
      expect(saved.prepare('SELECT id FROM scouts').all()).toEqual([{ id: 'old-player' }]);
      expect(saved.prepare('SELECT owner FROM buildings').all()).toEqual([{ owner: 'old-player' }]);
      expect(saved.prepare('SELECT * FROM equipment').all()).toHaveLength(1);
      expect(saved.prepare("SELECT value FROM meta WHERE key='world'").get()!.value).toBe(originalWorld);
      expect(saved.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
    } finally { saved.close(); }
    app = createApp({ dataDir });
    const fresh = new DatabaseSync(path.join(dataDir, 'world.sqlite'), { readOnly: true });
    try {
      expect(fresh.prepare('SELECT * FROM scouts').all()).toHaveLength(0);
      expect(fresh.prepare('SELECT * FROM buildings').all()).toHaveLength(0);
      expect(fresh.prepare('SELECT * FROM equipment').all()).toHaveLength(0);
      expect(fresh.prepare("SELECT value FROM meta WHERE key='world'").get()).toBeDefined();
    } finally { fresh.close(); }
  } finally {
    await app?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
// Includes multiple durable SQLite backups/reopens; allow disk contention when
// the complete integration suite runs in parallel. Integrity assertions remain.
}, 15000);

it('refuses an unknown future schema without clearing records', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'frontier-reset-schema-'));
  try {
    const app = createApp({ dataDir }); await app.close();
    const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
    db.exec("CREATE TABLE future_campaigns (id TEXT); INSERT INTO future_campaigns VALUES ('keep-campaign');");
    db.close();
    await expect(resetWorld(dataDir)).rejects.toThrow('Unrecognized world schema');
    const saved = new DatabaseSync(path.join(dataDir, 'world.sqlite'), { readOnly: true });
    try {
      expect(saved.prepare('SELECT * FROM future_campaigns').all()).toEqual([{ id: 'keep-campaign' }]);
      expect(saved.prepare("SELECT value FROM meta WHERE key='world'").get()).toBeDefined();
    } finally { saved.close(); }
  } finally { await rm(dataDir, { recursive: true, force: true }); }
});
