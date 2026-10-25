import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const actions = new Set(`world events orbital/strike logistics/bridge logistics/board logistics/exit logistics/deploy logistics/command logistics/launch logistics/repair logistics/cancel recovery/orbit ships/order ships/recall aircraft/deliver aircraft/cruise aircraft/mission aircraft/recall aircraft/strafe input navigate fire charge/cancel revive drill cores buildings dismantle sentry-mode tanks tanks/board tanks/exit tank-weapon vehicles/replace ships ships/board ships/exit ships/fire ships/secondary ships/ammo ships/contact ships/cargo ships/ramp ships/depth airbases aircraft/board aircraft/exit aircraft/launch aircraft/bomb artillery artillery/ammo artillery/command artillery/control artillery/fire artillery/input artillery/move artillery/rotate missiles rail rails rails/remove rails/switch auth/status auth/inbox auth/register auth/login auth/verify auth/logout auth/guest auth/open-inbox auth/resend auth/recover auth/reset campaigns/list campaigns/create campaigns/enter campaigns/join campaigns/leave campaigns/invite campaigns/revoke-invites campaigns/pause`.split(' '));
for(const action of ['communication','frenzy/test','aircraft/helicopter-fire','aircraft/payload','facilities/vehicle','shipyards','shipyards/build','shipyards/dismantle','shipyards/retire'])actions.add(action);
const frequent = new Set(['input', 'navigate', 'fire', 'charge/cancel', 'ships/secondary', 'artillery/input', 'artillery/command', 'artillery/rotate', 'artillery/move']);
frequent.add('aircraft/helicopter-fire');frequent.add('aircraft/strafe');
actions.add('aircraft/order');actions.add('ships/remote-action');actions.add('aircraft/sling');actions.add('aircraft/gunship-fire');frequent.add('aircraft/gunship-fire');
const fields = new Set(['requestId', 'campaignId', 'actorId', 'pilotId', 'kind', 'name', 'action', 'outcome', 'reason', 'status', 'targetId', 'projectileId', 'sourceId', 'weapon', 'x', 'y', 'hp', 'count', 'durationMs', 'cause', 'saved', 'bodyType', 'unitType', 'unitId', 'unitState', 'controlMode', 'unitAfterType', 'unitAfterId', 'unitAfterState', 'bodyAfter', 'command', 'direction', 'rotation', 'throttle', 'aimDirection', 'targetType', 'targetX', 'targetY', 'shotsFired', 'firstAt', 'lastAt']);
const safe = details => Object.fromEntries(Object.entries(details).filter(([key, value]) => fields.has(key) && (typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value))).map(([key, value]) => [key, typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 160) : value]));
for (const field of ['instanceId', 'machineId', 'buildId', 'runtimeId', 'revision', 'firstRevision', 'connections', 'connectedPlayers', 'participants', 'queuedWrites', 'droppedStreams', 'transport']) fields.add(field);

// One JSON line per meaningful outcome. Never serialize requests, account rows,
// response bodies, headers, URLs or Error objects. The sink is injectable in tests.
export function createAudit(write = line => console.log(line), metadata = {}) {
  const storage = new AsyncLocalStorage(), summaries = new Map();
  const instance = safe({ ...metadata, instanceId: randomUUID(), machineId: process.env.FLY_MACHINE_ID || 'local' });
  const emit = (event, details = {}) => {
    try {
      const detail=safe(details),who=detail.name||detail.actorId||(detail.kind==='system'?'system':'anonymous');
      const message=[who,detail.unitType,detail.command||detail.action||event,detail.outcome,
        detail.unitAfterType?'now using '+detail.unitAfterType:null,detail.count!=null?detail.count+' requests/events':null,detail.reason].filter(Boolean).join(' | ').slice(0,600);
      write(JSON.stringify({ at: new Date().toISOString(), event, ...detail, ...instance, message }));
    }
    catch { /* Logging failure must not change a committed game outcome. */ }
  };
  const bind = details => { const context = storage.getStore(); if (context) Object.assign(context, safe(details)); };
  const actor = (identity, pilotId = identity?.id) => {
    if (identity) bind({ actorId: identity.id, pilotId, name: identity.name, kind: identity.kind || 'guest' });
  };
  function flush() {
    for (const { event, detail } of summaries.values()) emit(event, detail);
    summaries.clear();
  }
  function group(event, key, detail, totals = []) {
    key = event + ':' + key;
    if (!summaries.has(key) && summaries.size >= 512) flush();
    const prior = summaries.get(key)?.detail, at = new Date().toISOString();
    const next = { ...safe(detail), firstAt: prior?.firstAt || at, lastAt: at, count: (prior?.count || 0) + 1 };
    for (const field of totals) next[field] = (prior?.[field] || 0) + (detail[field] || 0);
    if (detail.revision != null) next.firstRevision = prior?.firstRevision ?? detail.revision;
    summaries.set(key, { event, detail: next });
  }
  // HTTP arrival and authenticated dispatch are distinct. Frequent controls are
  // bounded summaries; neither record implies the action was accepted.
  function receipt(event, context) {
    if (frequent.has(context.action)) group(event + '.summary', JSON.stringify([context.campaignId, context.runtimeId, context.actorId, context.pilotId, context.action]), context);
    else emit(event, context);
  }
  function received() {
    const context = storage.getStore();
    if (!context || context.dispatched) return;
    context.dispatched = true;
    receipt('action.received', safe(context));
  }
  const broadcastRooms = new Set();
  function broadcast(detail) {
    // Show the first active broadcast immediately, then aggregate by room.
    if (!detail.connections && !detail.droppedStreams) return;
    const key = JSON.stringify([detail.campaignId, detail.runtimeId]);
    if (!broadcastRooms.has(key)) {
      if (broadcastRooms.size >= 512) broadcastRooms.clear();
      broadcastRooms.add(key); emit('state.broadcast', { ...detail, count: 1, firstRevision: detail.revision });
    } else group('state.broadcast.summary', key, detail, ['queuedWrites', 'droppedStreams']);
  }
  const timer = setInterval(flush, 5000); timer.unref();
  function run(req, res, handler) {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { return handler(); } // Let the HTTP handler reject malformed URLs.
    if (!pathname.startsWith('/api/')) return handler();
    const match = pathname.match(/^\/api\/campaign-world\/([a-f0-9-]{36})\/(.+)$/);
    const raw = match ? match[2] : pathname.slice(5);
    const action = actions.has(raw) ? raw : 'unknown';
    const context = { requestId: randomUUID(), action, campaignId: match?.[1] || 'legacy', kind: 'anonymous' };
    const started = performance.now();
    if (req.method !== 'GET') receipt('request.received', context);
    res.once('finish', () => {
      if (req.method === 'GET' && res.statusCode < 400) return;
      const detail = { ...context, status: res.statusCode, outcome: res.statusCode < 400 ? 'accepted' : 'denied', durationMs: Math.round(performance.now() - started) };
      if (frequent.has(action)) {
        const key = JSON.stringify([context.campaignId, context.runtimeId, context.actorId, context.pilotId, action, res.statusCode, context.reason, context.unitType, context.unitId, context.unitState, context.command]);
        group('activity.summary', key, detail);
      } else emit('action.result', detail);
    });
    return storage.run(context, handler);
  }
  function result(status, body) {
    const item = body?.building || body?.core || body?.tank || body?.ship || body?.base || body?.gun;
    if (status >= 400) bind({ reason: status === 500 ? 'internal_error' : body?.error || 'request_rejected' });
    else {
      if(Number.isFinite(body?.fired))bind({shotsFired:body.fired,...(body.fired===0?{reason:'no_side_gun_fired'}:{})});
      bind({ saved: body?.saved, targetId: item?.id, x: item?.x, y: item?.y });
      if (body?.takeoverRequired) bind({ reason: 'takeover_confirmation_required' });
      else if (body?.next === '/demo-inbox/') bind({ reason: 'activation_required' });
    }
  }
  return { run, bind, actor, result, emit, received, broadcast, context: () => safe({ ...storage.getStore() }),
    close() { clearInterval(timer); flush(); } };
}
