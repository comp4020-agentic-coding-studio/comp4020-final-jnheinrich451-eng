import {SOUND_PROFILES} from './sound-catalog.js';

// Presentation only: consume authoritative snapshots, never input attempts.
function shotSound(s) {
  if (s.mount === 'aa-tracer' || ['MAC','MAGNETIC'].includes(s.weapon) && s.first === false) return null;
  if (s.weapon === 'MAC' && !s.first) return null;
  if (s.sound && SOUND_PROFILES[s.sound]) return s.sound;
  if (s.mount?.startsWith('air-gunship-')) return 'gunship-' + s.mount.slice(12) + '-shot';
  if (s.mount === 'jet-30mm') return 'jet-30-shot';
  if (s.mount === 'jet-cannon') return 'jet-40-shot';
  if (s.mount === 'artillery') return 'railway-shot';
  if (s.mount === 'naval-main') return 'naval-main-shot';
  return {HE:'tank-shot', APCR:'machine-gun', AA35:'aa-shot', NAVAL_APCR:'naval-side-shot',
    MAC:'mac-shot', MAGNETIC:'magnetic-shot', LASER:'laser-shot', FLAME:'flame', HEAVY_FLAME:'heavy-flame'}[s.weapon];
}
function impactSound(i) {
  if (i.sound === 'tank-impact' && i.hits?.some(h => ['breaker','bulwark','centipede'].includes(h.kind))) return 'tank-armor-impact';
  if (i.sound && SOUND_PROFILES[i.sound]) return i.sound;
  if (i.weapon === 'INCENDIARY' || i.weapon === 'GAS') return i.minorBlast || i.radius > 0 ? (i.weapon === 'GAS' ? 'gas-impact' : 'incendiary-impact') : null;
  return {HE:i.radius >= 3 ? 'railway-impact' : 'tank-impact', MAC:'mac-impact', MAGNETIC:'magnetic-impact',
    LASER:'laser-impact', AA35:'aa-impact', BEAM:'orbital-beam'}[i.weapon];
}
export class SoundEvents {
  constructor() { this.reset(); }
  reset() { this.epoch = null; this.time = -Infinity; this.seen = new Set(); }
  ingest(state) {
    const baseline = this.epoch !== state.epoch || state.time < this.time;
    const advancing = state.time > this.time;
    const current = new Set(), fresh = [];
    const add = (key, event, kind, age = state.time - event.at) => {
      current.add(key);
      if (!baseline && !this.seen.has(key) && age >= 0 && age <= 350 && SOUND_PROFILES[kind] &&
          Number.isFinite(event.x) && Number.isFinite(event.y)) fresh.push({...event, kind});
    };
    for (const s of state.shots || []) {
      const kind = shotSound(s), sustain = ['flame','heavy-flame'].includes(kind) ? kind + ':' + (s.owner ?? s.id) : null;
      add('shot:' + s.id, {...s, ...(sustain ? {sustain} : {})}, kind);
    }
    for (const i of state.impacts || []) {
      const kind = impactSound(i), sustain = kind === 'orbital-beam' ? kind + ':' + (i.soundSource ?? 'shared') : null;
      add('impact:' + i.id, {...i, ...(sustain ? {sustain} : {})}, kind);
    }
    for (const b of state.barrages || []) {
      const kind = b.kind === 'bomber' ? (b.payload === 'HEAVY' ? 'heavy-bomb-fall' : 'bomb-fall')
        : b.kind === 'submarine' ? 'submarine-shot' : 'missile-shot';
      for (const [index, m] of (b.missiles || []).entries()) {
        if (b.age < m.launch || m.launchPending) continue;
        const age = (b.age - m.launch) * 1000;
        add('launch:' + b.id + ':' + index, {owner:b.owner, at:state.time-age,
          x:m.originX ?? b.x, y:m.originY ?? b.y,
          ...(b.kind === 'bomber' ? {duration:m.flight} : {})}, kind, age);
      }
    }
    // Enemy projectiles already expose launch and resolved-impact times.
    for (const [field, launch, impact] of [['acidShells','acid-shot','acid-impact'], ['flakShells','spore-shot','spore-impact'], ['aerialShots','bile-shot','bile-impact']]) {
      for (const p of state[field] || []) {
        const bile = p.weapon === 'BILE';
        add(field + ':launch:' + p.id, {...p, owner:p.sourceId, x:p.fromX, y:p.fromY}, bile ? 'bile-shot' : launch);
        if (p.impacted) add(field + ':impact:' + p.id, {...p, owner:p.sourceId, at:p.landAt}, bile ? 'bile-impact' : impact);
      }
    }
    for (const e of state.enemies || []) {
      if (e.strike?.hit) add('strike:' + e.id + ':' + e.strike.at, {...e.strike, owner:e.id},
        ['breaker','bulwark','centipede'].includes(e.kind) ? 'creature-slam' : 'creature-bite');
    }
    for (const f of state.aquaticClouds || []) if (f.kind === 'vent' && state.time >= f.activeAt)
      add('vent:' + f.id, {...f, at:f.activeAt}, 'toxic-vent');
    // These are live firing phases, never a charging/warning phase or damage tick.
    // One finite voice per emitter is kept alive while the phase is confirmed.
    const beam = (id, x, y, m, kind) => {
      if (!baseline && advancing && m?.phase === 'firing' && m.remaining > 0)
        fresh.push({kind, x, y, at:state.time, owner:id, sustain:'beam:' + id});
    };
    for (const s of state.sites || []) if (s.state === 'hostile') beam(s.id, s.x + 1.5, s.y + 1.5, s.laser, 'alien-heavy-laser');
    for (const e of state.enemies || []) if (e.hp > 0) beam(e.id, e.x, e.y, e.airLaser, e.kind === 'heavy-lens' ? 'alien-heavy-laser' : 'alien-laser');
    const order = state.orbital;
    if (order?.payload === 'CLUSTER') for (const [index,p] of order.points.entries()) {
      if (p.stage !== 'parent') continue;
      const age = (order.age - (order.delay + p.offset - 1)) * 1000;
      if (age >= 0) add('orbital-fall:' + order.id + ':' + index, {...p, owner:order.id, at:state.time-age, duration:1}, 'orbital-cluster-fall', age);
    }
    this.epoch = state.epoch; this.time = state.time; this.seen = current;
    return fresh;
  }
}

// World tiles, independent of zoom: overview must not make a planet audible.
export function spatialSound(event, listener) {
  const dx = event.x - listener.x, dy = event.y - listener.y;
  const range = SOUND_PROFILES[event.kind]?.range ?? 32;
  const distance = Math.hypot(dx, dy);
  return {gain: Math.max(0, 1 - distance / range) ** 2, pan: Math.max(-1, Math.min(1, dx / 16))};
}
