import http from 'node:http';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { createColony, colonyAction, tickColony, stepColonyRobot, colonyCanStand } from './public/colonization.js';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const record = person => ({ id: person.id, name: person.name, x: person.x, y: person.y, angle: person.angle || 0 });

// A peaceful runtime: no combat world, enemy scheduler, weapon endpoint or SUP ledger.
// Campaign identity, invitations and owner lifecycle remain enforced by the registry.
export function createColonizationRuntime(dataDir, options) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'colony.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS gardeners(id TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts(pilot_id TEXT NOT NULL,request_id TEXT NOT NULL,fingerprint TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(pilot_id,request_id));`);
  const readState = db.prepare("SELECT value FROM meta WHERE key='colony-v1'");
  const writeState = db.prepare("INSERT INTO meta VALUES ('colony-v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  let state;
  try {
    const saved = readState.get();
    state = saved ? JSON.parse(saved.value) : createColony(options.planetTemplate);
    if (state.version !== 1 || state.mode !== 'colonization' || state.template !== options.planetTemplate) throw Error('Unsupported colonization save.');
    if (!saved) writeState.run(JSON.stringify(state));
  } catch (error) { db.close(); throw error; }
  const writePerson = db.prepare('INSERT INTO gardeners VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value');
  const people = new Map(), streams = new Map(), limits = new Map();
  const runtimeId = randomUUID(), audit = options.audit;
  let closed = false, storageFailed = false, revision = 0, lastTick = performance.now(), lastSave = lastTick, lastBroadcast = lastTick, growthElapsed = 0;
  const frozen = () => closed || storageFailed || options.frozen();

  function checkpoint() {
    if (closed) return;
    db.exec('BEGIN IMMEDIATE');
    try {
      writeState.run(JSON.stringify(state));
      for (const person of people.values()) writePerson.run(person.id, JSON.stringify(record(person)));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    lastSave = performance.now();
  }
  function personFor(req) {
    const actor = req.campaignIdentity;
    if (!actor || !options.authorized(req)) fail('Enter this expedition through the campaign menu.', 403);
    let person = people.get(actor.id);
    if (!person) {
      const saved = db.prepare('SELECT value FROM gardeners WHERE id=?').get(actor.id);
      person = { ...state.world.spawn, angle: 0, ...(saved ? JSON.parse(saved.value) : {}), id: actor.id, name: actor.name,
        input: { x: 0, y: 0 }, inputUntil: 0, seq: -1 };
      if (!colonyCanStand(state, person.x, person.y)) Object.assign(person, state.world.spawn);
      writePerson.run(person.id, JSON.stringify(record(person)));
      people.set(person.id, person);
    }
    person.name = actor.name;
    return person;
  }
  function snapshot(person, includeWorld = false) {
    const { world, ...colony } = state;
    return { mode: 'colonization', build: options.clientBuild, clientBuild: options.clientBuild, runtimeId, revision,
      ...(includeWorld ? { world } : {}), colony, me: record(person),
      players: [...people.values()].filter(p => streams.get(p.id)?.size).map(record),
      room: { ...options.roomView(), ...(storageFailed ? { paused: true, notice: 'Saving is unavailable. The expedition is paused; your last saved garden is retained.' } : {}) } };
  }
  function writeSnapshot(res, person, includeWorld = false) {
    if (res.destroyed || res.writableEnded) return false;
    if (res.writableLength > 128 * 1024) { res.destroy(); return false; }
    res.write(`data: ${JSON.stringify(snapshot(person, includeWorld))}\n\n`);
    return true;
  }
  function broadcast() {
    if (closed) return;
    revision++;
    let connections = 0, queuedWrites = 0, droppedStreams = 0;
    for (const [id, responses] of streams) for (const res of responses) {
      connections++;
      if (writeSnapshot(res, people.get(id))) queuedWrites++; else droppedStreams++;
    }
    audit.broadcast({ campaignId: options.campaignId, runtimeId, revision, connectedPlayers: streams.size, connections, queuedWrites, droppedStreams });
    lastBroadcast = performance.now();
  }
  function stopInputs(id = null) {
    for (const p of people.values()) if (!id || p.id === id) { p.input = { x: 0, y: 0 }; p.inputUntil = 0; }
  }
  function endPlayerAccess(id, message = 'Your expedition visit has ended.') {
    stopInputs(id);
    const person = people.get(id);
    if (person && !closed) writePerson.run(id, JSON.stringify(record(person)));
    const responses = streams.get(id); streams.delete(id); people.delete(id); limits.delete(id);
    for (const res of responses || []) {
      if (!res.destroyed) res.end(`event: session-ended\ndata: ${JSON.stringify({ message, next: '/campaigns/' })}\n\n`);
    }
  }
  function abandon(id) {
    endPlayerAccess(id, 'Your visit has ended. The garden remains with the expedition.');
    db.prepare('DELETE FROM gardeners WHERE id=?').run(id);
    db.prepare('DELETE FROM receipts WHERE pilot_id=?').run(id);
    checkpoint();
  }
  const json = (res, status, value) => {
    audit.result(status, value);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON is required.', 415);
    const origin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`;
    if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') fail('Use the expedition page to make this change.', 403);
    let text = '';
    for await (const chunk of req) { text += chunk; if (text.length > 4096) fail('Request is too large.', 413); }
    let data;
    try { data = JSON.parse(text); } catch { fail('A JSON object is required.', 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('A JSON object is required.', 400);
    return data;
  }
  function rate(id, input) {
    const now = performance.now(), key = input ? 'input' : 'action';
    const limit = limits.get(id) || { input: { start: now, count: 0 }, action: { start: now, count: 0 } };
    if (now - limit[key].start > 1000) limit[key] = { start: now, count: 0 };
    limits.set(id, limit);
    if (++limit[key].count > (input ? 30 : 12)) fail('A little too fast. Please try again in a moment.', 429);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      if (closed) fail('This expedition has closed. Return to campaigns.', 403);
      const url = new URL(req.url, 'http://localhost');
      const person = personFor(req);
      audit.bind({ campaignId: options.campaignId, runtimeId, unitType: 'gardener', unitId: person.id, unitState: 'tending' });
      if (req.method === 'GET' && url.pathname === '/api/world') {
        audit.emit('state.snapshot', { ...audit.context(), revision, cause: 'expedition_join', saved: true });
        return json(res, 200, snapshot(person, true));
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if ((streams.get(person.id)?.size || 0) >= 3) fail('This expedition is already open in three tabs.', 429);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        if (!streams.has(person.id)) streams.set(person.id, new Set());
        streams.get(person.id).add(res);
        res.on('close', () => {
          streams.get(person.id)?.delete(res);
          if (!streams.get(person.id)?.size) { streams.delete(person.id); stopInputs(person.id); person.seq = -1; }
        });
        writeSnapshot(res, person, true); broadcast(); return;
      }
      if (!['/api/colony', '/api/input'].includes(url.pathname)) fail('This action is not available in a peaceful expedition.', 404);
      if (req.method !== 'POST') fail('Method not allowed.', 405);
      audit.received();
      const data = await body(req);
      // Recheck authority after reading the request: signout/leave/pause may race it.
      if (!options.authorized(req)) fail('Your expedition visit has ended. Return to campaigns.', 403);
      if (frozen()) fail('The expedition is paused or waiting for its host.');
      if (!streams.get(person.id)?.size) fail('Reconnect to your expedition before sending orders.');
      rate(person.id, url.pathname === '/api/input');
      if (url.pathname === '/api/input') {
        if (![data.x, data.y].every(Number.isFinite) || Math.abs(data.x) > 1 || Math.abs(data.y) > 1 || !Number.isSafeInteger(data.seq) || data.seq < 0) fail('Choose a valid movement direction.', 400);
        if (data.seq > person.seq) {
          person.seq = data.seq; person.input = { x: data.x, y: data.y }; person.inputUntil = performance.now() + 450;
        }
        return json(res, 200, { ok: true });
      }
      if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(data.requestId)) fail('This garden order needs a valid request identifier.', 400);
      const orderedData = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'requestId').sort(([a], [b]) => a.localeCompare(b)));
      const fingerprint = createHash('sha256').update(JSON.stringify(orderedData)).digest('hex');
      const old = db.prepare('SELECT * FROM receipts WHERE pilot_id=? AND request_id=?').get(person.id, data.requestId);
      if (old) {
        if (old.fingerprint !== fingerprint) fail('That request identifier belongs to a different order.');
        return json(res, 200, { ...JSON.parse(old.value), replayed: true });
      }
      const next = structuredClone(state);
      const result = { ...colonyAction(next, { ...record(person), isHost: options.roomView().ownerPilot === person.id,
        players: [...people.values()].map(record) }, data.action, data), saved: true };
      db.exec('BEGIN IMMEDIATE');
      try {
        writeState.run(JSON.stringify(next));
        db.prepare('INSERT INTO receipts VALUES (?,?,?,?)').run(person.id, data.requestId, fingerprint, JSON.stringify(result));
        db.prepare('DELETE FROM receipts WHERE pilot_id=? AND rowid NOT IN (SELECT rowid FROM receipts WHERE pilot_id=? ORDER BY rowid DESC LIMIT 128)').run(person.id, person.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      state = next;
      audit.bind({ command: data.action, targetId: data.bedId, x: data.x, y: data.y, saved: true });
      audit.emit('colony.order', { ...audit.context(), outcome: 'accepted' });
      broadcast(); return json(res, 200, result);
    } catch (error) {
      if (res.headersSent) return res.end();
      if (!error.status) audit.emit('colony.error', { campaignId: options.campaignId, cause: error.code || 'operation_failed' });
      json(res, error.status || 500, { error: error.status ? error.message : 'Your order could not be saved. Please try again.' });
    }
  });
  const timer = setInterval(() => {
    const now = performance.now(), dt = Math.max(0, Math.min(.25, (now - lastTick) / 1000)); lastTick = now;
    if (closed || frozen() || !streams.size) {
      growthElapsed = 0;
      // Paused rooms still prove that their stream is alive; their garden clock
      // remains stopped. The owner must be able to use Resume after a long pause.
      if (!closed && streams.size && now - lastBroadcast >= 1000) broadcast();
      return;
    }
    try {
      for (const p of people.values()) if (streams.has(p.id)) {
        const input = p.inputUntil > now ? p.input : { x: 0, y: 0 };
        stepColonyRobot(state, p, input.x, input.y, dt);
      }
      growthElapsed += dt;
      if (growthElapsed >= .25) { tickColony(state, growthElapsed); growthElapsed = 0; }
      if (now - lastSave >= 1000) checkpoint();
      if (now - lastBroadcast >= 250) broadcast();
    } catch (error) {
      storageFailed = true; stopInputs();
      audit.emit('colony.frozen', { campaignId: options.campaignId, cause: error.code || 'save_failed' }); broadcast();
    }
  }, 50);
  const heartbeat = setInterval(() => { for (const responses of streams.values()) for (const res of responses) if (!res.destroyed && res.writableLength < 128 * 1024) res.write(': garden heartbeat\n\n'); }, 15000);
  let closing;
  async function closeOnce() {
    stopInputs(); clearInterval(timer); clearInterval(heartbeat);
    try { checkpoint(); }
    finally {
      closed = true;
      for (const responses of streams.values()) for (const res of responses) res.end();
      streams.clear(); server.closeIdleConnections();
      await new Promise(resolve => server.close(resolve)); db.close();
    }
  }
  return { server, db, checkpoint, broadcast, stopInputs, endPlayerAccess, abandon,
    connected: id => !!streams.get(id)?.size, close: () => closing ??= closeOnce() };
}
