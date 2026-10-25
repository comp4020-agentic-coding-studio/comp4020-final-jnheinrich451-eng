import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { lockWorld } from '../world-maintenance.js';
import { PLANETS } from '../public/planets.js';

const digest = text => createHash('sha256').update(text).digest('hex');
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
export const ROOM_LIMIT = 4, ACTIVE_LIMIT = 2, RECONNECT_MS = 30000;

// Accounts and this registry stay in the original database. Each new campaign
// has an independent world database and bounded, lazily loaded simulation.
export function createCampaigns({ dataDir, legacy, createRuntime, audit }) {
  const json = (res, status, data) => { audit.result(status, data); res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const lifecycle = (event, room, cause) => audit.emit(event, { campaignId: room.record.id, sourceId: room.ownerPilot, kind: 'system', cause, ...roomCounts(room.record.id) });
  const db = legacy.db;
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name='campaigns'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, `before-campaigns-${randomUUID()}.sqlite`));
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, template TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS campaign_members(campaign_id TEXT NOT NULL, identity_id TEXT NOT NULL, account_id TEXT, pilot_id TEXT NOT NULL, PRIMARY KEY(campaign_id, identity_id));
    CREATE TABLE IF NOT EXISTS campaign_invites(hash TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, expires_at INTEGER NOT NULL, used_by TEXT);
    CREATE TABLE IF NOT EXISTS campaign_abandoned(campaign_id TEXT NOT NULL, pilot_id TEXT NOT NULL, PRIMARY KEY(campaign_id,pilot_id));
    CREATE TABLE IF NOT EXISTS campaign_limits(identity_id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  `);
  // Room visits are deliberately not restored after a process restart. Preserve
  // a crashed guest's construction while ending their ephemeral membership.
  db.exec(`INSERT OR IGNORE INTO campaign_abandoned SELECT campaign_id,pilot_id FROM campaign_members WHERE account_id IS NULL;
    DELETE FROM campaign_members WHERE account_id IS NULL;
    DELETE FROM campaign_invites; DELETE FROM campaign_limits WHERE expires_at <= ${Date.now()};`);
  const rooms = new Map(), visits = new Map(), closing = new Map();
  let stopped = false;
  const campaign = id => db.prepare('SELECT * FROM campaigns WHERE id=?').get(id);
  const member = (id, actor) => db.prepare('SELECT * FROM campaign_members WHERE campaign_id=? AND identity_id=?').get(id, actor.id);
  const owns = (record, actor) => !!actor.accountId && record.owner_id === actor.accountId;
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function rate(actor) {
    const now = Date.now(), previous = db.prepare('SELECT * FROM campaign_limits WHERE identity_id=?').get(actor.id);
    if (previous?.expires_at > now && previous.count >= 60) fail('Too many room requests. Try again in a minute.', 429);
    db.prepare('INSERT INTO campaign_limits VALUES (?,?,?) ON CONFLICT(identity_id) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at')
      .run(actor.id, previous?.expires_at > now ? previous.count + 1 : 1, previous?.expires_at > now ? previous.expires_at : now + 60000);
  }
  const occupants = id => [...visits.values()].filter(v => v.campaignId === id);
  const roomCounts = id => {
    const members = occupants(id);
    return { participants: members.length, connectedPlayers: members.filter(v => v.connections.size > 0).length, connections: members.reduce((n, v) => n + v.connections.size, 0) };
  };
  function frozen(room) { return room.state !== 'open' || !room.ownerConnected || room.paused; }
  function view(room) {
    return { id: room.record.id, name: room.record.name, state: room.ownerConnected ? 'open' : 'reconnecting',
      paused: frozen(room), soloPaused: room.paused, players: occupants(room.record.id).length,
      limit: ROOM_LIMIT, notice: room.notice, ownerPilot: room.ownerPilot,
      abandoned: db.prepare('SELECT pilot_id FROM campaign_abandoned WHERE campaign_id=?').all(room.record.id).map(r => r.pilot_id) };
  }
  function authorized(req) {
    try {
      const actor = legacy.identity(req, req.campaignResponse), visit = visits.get(actor.id), room = rooms.get(req.campaignId);
      return !stopped && room?.state === 'open' && visit?.campaignId === req.campaignId &&
        room === req.campaignRoom && visit === req.campaignVisit &&
        visit.credential === actor.credential && visit.pilotId === req.campaignIdentity?.id;
    } catch { return false; }
  }
  function load(record, actor, pilotId) {
    if (rooms.has(record.id)) return rooms.get(record.id);
    if (rooms.size + closing.size >= ACTIVE_LIMIT) fail('Both active campaign slots are in use. Close a room before opening another.', 503);
    const room = { record, ownerPilot: pilotId, ownerConnected: false, deadline: Date.now() + RECONNECT_MS,
      state: 'open', paused: false, notice: '', runtime: null };
    const dir = path.join(dataDir, 'campaigns', record.id);
    const release = lockWorld(dir);
    try {
      room.runtime = createRuntime(dir, { campaign: true, campaignId: record.id, planetTemplate:record.template, accounts: legacy.accounts,
        frozen: () => frozen(room), roomView: () => view(room), authorized,
        canManage: (owner, pilot) => pilot === room.ownerPilot && !!db.prepare('SELECT 1 FROM campaign_abandoned WHERE campaign_id=? AND pilot_id=?').get(record.id, owner) });
    } catch (error) { release(); throw error; }
    const shutdown = room.runtime.close;
    let closed;
    room.runtime.close = () => closed ??= shutdown().finally(release);
    for (const abandoned of db.prepare('SELECT pilot_id FROM campaign_abandoned WHERE campaign_id=?').all(record.id)) room.runtime.abandon(abandoned.pilot_id);
    rooms.set(record.id, room); lifecycle('campaign.opened', room, 'owner_entered');
    return room;
  }
  function expireGuest(visit, room) {
    db.prepare('INSERT OR IGNORE INTO campaign_abandoned VALUES (?,?)').run(visit.campaignId, visit.pilotId);
    db.prepare('DELETE FROM campaign_members WHERE campaign_id=? AND identity_id=? AND account_id IS NULL').run(visit.campaignId, visit.actor.id);
    room.runtime.abandon(visit.pilotId);
  }
  function closeRoom(id, message = 'The owner closed this room. Progress is saved.') {
    const room = rooms.get(id);
    if (!room) return closing.get(id) || Promise.resolve();
    room.state = 'closed'; rooms.delete(id);
    for (const visit of occupants(id)) {
      visits.delete(visit.actor.id);
      if (!visit.actor.accountId) expireGuest(visit, room);
      else room.runtime.endPlayerAccess(visit.pilotId, message);
    }
    db.prepare('DELETE FROM campaign_invites WHERE campaign_id=?').run(id);
    const job = room.runtime.close().then(() => lifecycle('campaign.closed', room, message)).catch(error => { lifecycle('campaign.close_failed', room, error.code || 'storage_error'); throw error; }).finally(() => closing.delete(id)); closing.set(id, job);
    return job;
  }
  function leave(actorId, message) {
    const visit = visits.get(actorId); if (!visit) return Promise.resolve();
    const room = rooms.get(visit.campaignId); if (!room) { visits.delete(actorId); return Promise.resolve(); }
    if (owns(room.record, visit.actor)) return closeRoom(visit.campaignId, message);
    visits.delete(actorId);
    if (!visit.actor.accountId) expireGuest(visit, room);
    else room.runtime.endPlayerAccess(visit.pilotId, message || 'You left the room. Progress is saved.');
    room.runtime.checkpoint(); room.runtime.broadcast();
    audit.emit('participant.left', { campaignId: visit.campaignId, actorId: visit.actor.id, pilotId: visit.pilotId, name: visit.actor.name, kind: visit.actor.kind, cause: message || 'visit_ended', saved: true, ...roomCounts(visit.campaignId) });
    return Promise.resolve();
  }
  // Called synchronously before account credentials rotate. Promotion keeps the
  // guest's campaign pilot/ownership, then revokes live control like normal login.
  function revoke(id, message, details) {
    if (details?.linkingAccountId) {
      db.prepare('UPDATE campaign_members SET account_id=? WHERE identity_id=?').run(details.linkingAccountId, id);
      const visit = visits.get(id); if (visit) visit.actor.accountId = details.linkingAccountId;
    }
    void leave(id, message).catch(error => console.error('Campaign close failed:', error.message));
  }
  function checkCapacity(room, actor) {
    if (!owns(room.record, actor) && !room.ownerConnected) fail('The owner must be connected to open this room.');
    if (!visits.has(actor.id) && occupants(room.record.id).length >= ROOM_LIMIT) fail('This room is full (four players).');
  }
  function attach(room, actor, membership) {
    const existing = visits.get(actor.id);
    if (existing && existing.campaignId !== room.record.id) fail('Leave your current room before entering another.');
    if (existing && existing.credential !== actor.credential) fail('Your session changed. Re-enter from the lobby.', 401);
    visits.set(actor.id, existing || { actor, credential: actor.credential, campaignId: room.record.id, pilotId: membership.pilot_id, deadline: Date.now() + RECONNECT_MS, connections: new Set() });
    if (room.paused && occupants(room.record.id).length > 1) {
      room.paused = false; room.notice = 'A teammate joined. The battle has resumed; menus do not pause multiplayer.';
      room.runtime.stopInputs(); room.runtime.broadcast(); lifecycle('campaign.resumed', room, 'teammate_joined');
    }
    audit.bind({ campaignId: room.record.id }); audit.actor(actor, membership.pilot_id);
    if (!existing) audit.emit('participant.joined', { ...audit.context(), ...roomCounts(room.record.id), cause: 'visit_admitted' });
    return { next: `/?campaign=${room.record.id}`, room: view(room) };
  }
  async function handle(action, req, res) {
    const actor = legacy.identity(req, res);
    const startingVisit = visits.get(actor.id);
    if (startingVisit) { audit.bind({ campaignId: startingVisit.campaignId }); audit.actor(actor, startingVisit.pilotId); }
    if (req.method !== 'GET') audit.received();
    if (req.method === 'GET' && action === 'list') {
      const rows = actor.accountId ? db.prepare('SELECT c.* FROM campaigns c JOIN campaign_members m ON c.id=m.campaign_id WHERE m.identity_id=? AND m.account_id=? ORDER BY c.created_at DESC').all(actor.id, actor.accountId) : [];
      const visit = visits.get(actor.id);
      return { identity: { name: actor.name, kind: actor.kind }, active: visit?.campaignId || null,
        campaigns: rows.map(c => ({ id: c.id, name: c.name, template: c.template, owner: owns(c, actor), open: !!rooms.get(c.id)?.ownerConnected })),
        planets: PLANETS, roomLimit: ROOM_LIMIT, activeLimit: ACTIVE_LIMIT };
    }
    if (req.method !== 'POST') fail('Method not allowed.', 405);
    const expected = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`;
    if (req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') fail('Use the campaign page to make this change.', 403);
    if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON is required.', 415);
    let input = ''; for await (const chunk of req) { input += chunk; if (input.length > 4096) fail('Request too large.', 413); }
    let data; try { data = JSON.parse(input || '{}'); } catch { fail('Invalid JSON.', 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('A JSON object is required.', 400);
    if (!legacy.validIdentity(actor, req)) fail('Your session changed. Sign in again.', 401);
    if (['leave', 'pause', 'invite', 'revoke-invites'].includes(action) && visits.get(actor.id) !== startingVisit) fail('Your room changed. Refresh the lobby before trying again.');
    rate(actor);
    if (action === 'create') {
      if (!actor.accountId) fail('Sign in with an Email or Demo account to host a campaign.', 403);
      const template = data.template === undefined ? 'caldera-v1' : data.template;
      if (!PLANETS.some(planet => planet.id === template)) fail('Choose an available planet template.', 400);
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 48 || /[\x00-\x1f]/.test(name)) fail('Choose a campaign name of 1–48 characters.', 400);
      if (db.prepare('SELECT COUNT(*) AS n FROM campaigns WHERE owner_id=?').get(actor.accountId).n >= 3) fail('This prototype allows three saved campaigns per account.');
      if (db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n >= 1000) fail('The saved campaign limit has been reached.', 503);
      const id = randomUUID();
      transaction(() => {
        db.prepare('INSERT INTO campaigns VALUES (?,?,?,?,?)').run(id, actor.accountId, name, template, Date.now());
        db.prepare('INSERT INTO campaign_members VALUES (?,?,?,?)').run(id, actor.id, actor.accountId, actor.id);
      });
      audit.bind({ campaignId: id }); return { id, saved: true };
    }
    if (action === 'leave') { await leave(actor.id); return { next: '/campaigns/' }; }
    if (action === 'join') {
      if (visits.has(actor.id)) fail('Leave your current room before accepting an invitation.');
      const code = typeof data.code === 'string' ? data.code.trim().toUpperCase().replace(/-/g, '') : '';
      if (!/^[A-F0-9]{24}$/.test(code)) fail('Invalid or expired invitation.', 400);
      const invite = db.prepare('SELECT * FROM campaign_invites WHERE hash=? AND used_by IS NULL AND expires_at>?').get(digest(code), Date.now());
      if (!invite) fail('Invalid, expired or already used invitation.', 400);
      const room = rooms.get(invite.campaign_id); if (!room) fail('The owner has not opened this room.');
      checkCapacity(room, actor);
      let membership = member(room.record.id, actor);
      transaction(() => {
        if (!db.prepare('UPDATE campaign_invites SET used_by=? WHERE hash=? AND used_by IS NULL AND expires_at>?').run(actor.id, invite.hash, Date.now()).changes) fail('Invitation already used.', 400);
        if (!membership) {
          membership = { pilot_id: actor.accountId ? actor.id : randomUUID() };
          db.prepare('INSERT INTO campaign_members VALUES (?,?,?,?)').run(room.record.id, actor.id, actor.accountId, membership.pilot_id);
        }
      });
      return attach(room, actor, membership);
    }
    const record = typeof data.id === 'string' ? campaign(data.id) : null;
    audit.bind({ campaignId: record?.id });
    const membership = record ? member(record.id, actor) : null;
    if (!record || !membership) fail('Campaign unavailable or membership required.', 403);
    if (action === 'enter') {
      if (visits.has(actor.id) && visits.get(actor.id).campaignId !== record.id) fail('Leave your current room first.');
      if (closing.has(record.id)) fail('This campaign is saving. Try again shortly.');
      let room = rooms.get(record.id);
      if (!room && !owns(record, actor)) fail('Wait for the owner to open this campaign.');
      room ||= load(record, actor, membership.pilot_id);
      checkCapacity(room, actor); return attach(room, actor, membership);
    }
    const room = rooms.get(record.id), visit = visits.get(actor.id);
    if (!room || visit?.campaignId !== record.id) fail('Enter the campaign first.');
    if (action === 'invite' || action === 'revoke-invites') {
      if (!owns(record, actor) || !room.ownerConnected) fail('Only the connected owner can issue or revoke invitations.', 403);
      db.prepare('DELETE FROM campaign_invites WHERE expires_at<=?').run(Date.now());
      if (action === 'revoke-invites') { db.prepare('DELETE FROM campaign_invites WHERE campaign_id=? AND used_by IS NULL').run(record.id); return { revoked: true }; }
      if (db.prepare('SELECT COUNT(*) AS n FROM campaign_invites WHERE campaign_id=? AND used_by IS NULL').get(record.id).n >= 8) fail('Revoke unused invitations before creating more.');
      const code = randomBytes(12).toString('hex').toUpperCase(), expiresAt = Date.now() + 30 * 60000;
      db.prepare('INSERT INTO campaign_invites VALUES (?,?,?,NULL)').run(digest(code), record.id, expiresAt);
      return { code: code.match(/.{6}/g).join('-'), expiresAt, message: 'Single use; expires in 30 minutes or when the room closes. Anyone holding this code can redeem it first.' };
    }
    if (action === 'pause') {
      if (typeof data.paused !== 'boolean') fail('Specify pause or resume.', 400);
      if (!room.ownerConnected) fail('Waiting for the owner to reconnect.');
      room.runtime.stopInputs(visit.pilotId);
      room.paused = occupants(record.id).length === 1 && owns(record, actor) && data.paused;
      room.notice = room.paused ? 'Solo campaign paused.' : occupants(record.id).length > 1 ? 'Multiplayer continues while menus are open.' : '';
      room.runtime.checkpoint(); room.runtime.broadcast(); audit.bind({ reason: room.paused ? 'solo_paused' : 'battle_running' }); return { room: view(room) };
    }
    fail('Unknown campaign action.', 404);
  }
  async function route(req, res, fallback) {
    try {
      if (stopped) return json(res, 503, { error: 'Server is restarting.' });
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/campaigns/')) return json(res, 200, await handle(url.pathname.slice(15), req, res));
      const match = url.pathname.match(/^\/api\/campaign-world\/([a-f0-9-]{36})\/(.+)$/);
      if (!match) return fallback(req, res);
      const actor = legacy.identity(req, res), room = rooms.get(match[1]), visit = visits.get(actor.id);
      if (!room || room.state !== 'open' || visit?.campaignId !== match[1] || visit.credential !== actor.credential) fail('This room is closed or your visit has ended. Return to campaigns.', 403);
      if (!['world', 'events', 'communication'].includes(match[2]) && req.method === 'GET') fail('Unknown action.', 404);
      if (req.method !== 'GET' && frozen(room)) fail('The campaign is paused or waiting for its owner.');
      audit.actor(actor, visit.pilotId);
      req.campaignId = match[1]; req.campaignResponse = res;
      req.campaignRoom = room; req.campaignVisit = visit;
      req.campaignIdentity = { id: visit.pilotId, name: actor.name };
      if (match[2] === 'events' && req.method === 'GET') {
        visit.connections.add(res); visit.deadline = Infinity;
        if (owns(room.record, actor)) {
          if (!room.ownerConnected && room.notice.startsWith('Owner reconnecting')) room.notice = room.paused ? 'Owner reconnected. Solo campaign paused.' : 'Owner reconnected. Battle resumed.';
          if (!room.ownerConnected) lifecycle('campaign.owner_connected', room, room.paused ? 'solo_pause_retained' : 'battle_resumed');
          room.ownerConnected = true; room.deadline = Infinity;
        }
        res.on('close', () => {
          visit.connections.delete(res);
          if (visits.get(actor.id) !== visit || visit.connections.size) return;
          visit.deadline = Date.now() + RECONNECT_MS;
          if (owns(room.record, actor) && room.state === 'open') {
            room.ownerConnected = false; room.deadline = visit.deadline; room.notice = 'Owner reconnecting. Battle frozen for up to 30 seconds.';
            room.runtime.stopInputs(); room.runtime.checkpoint(); room.runtime.broadcast(); lifecycle('campaign.frozen', room, 'owner_disconnected');
          }
          audit.emit('participant.disconnected', { campaignId: room.record.id, actorId: actor.id, pilotId: visit.pilotId, name: actor.name, kind: actor.kind, cause: 'event_stream_closed', ...roomCounts(room.record.id) });
        });
      }
      req.url = '/api/' + match[2] + url.search;
      room.runtime.server.emit('request', req, res);
    } catch (error) {
      if (res.headersSent) return res.end();
      if (!error.status) console.error(error);
      json(res, error.status || 500, { error: error.status ? error.message : 'Campaign operation failed. Saved worlds were retained.' });
    }
  }
  const timer = setInterval(() => {
    for (const room of rooms.values()) if (!room.ownerConnected && Date.now() >= room.deadline) void closeRoom(room.record.id, 'Owner reconnect grace expired. Progress is saved.').catch(console.error);
    for (const visit of visits.values()) {
      const validAccount = !visit.actor.accountId || legacy.accounts.sessionByHash(visit.credential);
      if (!validAccount || !visit.connections.size && Date.now() >= visit.deadline) void leave(visit.actor.id).catch(console.error);
    }
  }, 1000);
  return { route, revoke, async close() { stopped = true; clearInterval(timer); await Promise.all([...rooms.keys()].map(id => closeRoom(id, 'Server restarting. Progress is saved.'))); await Promise.all([...closing.values()]); } };
}
