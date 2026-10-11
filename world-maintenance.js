import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

// A separate SQLite lock survives neither a crash nor a killed process. Unlike
// a PID file it needs no stale-file recovery. The gameplay database stays free
// to commit normally while this connection protects its lifetime from reset.
export function lockWorld(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const lock = new DatabaseSync(path.join(dataDir, 'world-maintenance.sqlite'));
  try {
    lock.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;');
  } catch (cause) {
    lock.close();
    throw new Error('World is in use. Stop the Frontier server before resetting or reopening this data directory.', { cause });
  }
  return () => lock.close();
}

// Fail closed if a future schema introduces account/campaign data: that stage
// must define what a world reset retains before extending this list.
const worldTables = new Set([
  'airbases', 'ships', 'tanks', 'equipment', 'meta', 'scouts', 'buildings',
  'cores', 'robot_states', 'rails', 'artillery', 'rail_switches',
]);
const accountTables = new Set(['accounts', 'account_sessions', 'account_tokens', 'demo_inboxes', 'demo_messages', 'account_limits']);
const campaignTables = new Set(['campaigns', 'campaign_members', 'campaign_invites', 'campaign_abandoned', 'campaign_limits']);

export async function resetWorld(dataDir) {
  const release = lockWorld(dataDir);
  let db;
  try {
    // Do not accidentally create a new database for a misspelled directory.
    if (!existsSync(path.join(dataDir, 'world.sqlite'))) throw new Error('No world.sqlite exists in this data directory. Nothing was reset.');
    db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => String(row.name));
    if (!tables.includes('scouts') || !tables.includes('meta') || tables.some(name => !worldTables.has(name) && !accountTables.has(name) && !campaignTables.has(name))) {
      throw new Error('Unrecognized world schema. Nothing was reset; review the reset scope before continuing.');
    }
    const backupDir = path.join(dataDir, 'backups');
    mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `world-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.sqlite`);
    // SQLite backup includes committed WAL data. Never copy just the main file.
    await backup(db, backupPath);
    const spawn = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()?.value || '{}').spawn || { x: 24.5, y: 18.5 };
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of tables) if (worldTables.has(table) && table !== 'scouts') db.exec(`DELETE FROM "${table}"`);
      if (tables.includes('accounts')) {
        // Accounts remain usable; only their campaign progress is reset. Keep
        // pending attachment IDs too so verification cannot point at a lost save.
        db.exec('DELETE FROM scouts WHERE id NOT IN (SELECT player_id FROM accounts WHERE player_id IS NOT NULL UNION SELECT pending_player_id FROM accounts WHERE pending_player_id IS NOT NULL)');
        db.prepare('UPDATE scouts SET x=?,y=?,angle=0').run(spawn.x, spawn.y);
        db.exec('DELETE FROM account_sessions');
      } else db.exec('DELETE FROM scouts');
      // This command resets only the legacy world. Named campaign databases,
      // ownership and membership are retained; invitation capabilities expire.
      if (tables.includes('campaign_invites')) db.exec('DELETE FROM campaign_invites; DELETE FROM campaign_limits;');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return backupPath;
  } finally {
    if (db?.isOpen) db.close();
    release();
  }
}
