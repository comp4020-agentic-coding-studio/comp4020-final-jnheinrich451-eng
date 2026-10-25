// Presentation only: consume authoritative combat snapshots, never input clicks.
export class SoundEvents {
  constructor() { this.reset(); }
  reset() { this.epoch = null; this.time = -Infinity; this.seen = new Set(); }
  ingest(state) {
    const baseline = this.epoch !== state.epoch || state.time < this.time;
    const current = new Set(), fresh = [];
    const add = (key, event, kind, age = state.time - event.at) => {
      current.add(key);
      if (!baseline && !this.seen.has(key) && age >= 0 && age <= 350 && kind &&
          Number.isFinite(event.x) && Number.isFinite(event.y)) fresh.push({...event, kind});
    };
    for (const s of state.shots || []) {
      const kind = s.weapon==='MAC'?(s.first?'rail':null):s.weapon === 'MAGNETIC' || s.weapon === 'LASER' ? 'rail'
        : ['FLAME','HEAVY_FLAME'].includes(s.weapon) ? null
        : s.mount === 'artillery' || s.mount === 'naval-main' ? 'heavy'
        : ['APCR','NAVAL_APCR'].includes(s.weapon) ? 'gun' : 'cannon';
      add('shot:' + s.id, s, kind);
    }
    for (const i of state.impacts || []) add('impact:' + i.id, i,
      i.weapon === 'HE' || i.minorBlast ? (i.radius >= 3 ? 'blastHeavy' : 'blast') : null);
    for (const b of state.barrages || []) {
      // Bomb releases are not rocket motors. Submarines resolve each moving tube's origin.
      if (b.kind && b.kind !== 'submarine') continue;
      for (const [index, m] of (b.missiles || []).entries()) {
        if (b.age < m.launch || m.launchPending) continue;
        add('missile:' + b.id + ':' + index,
          {x:m.originX ?? b.x, y:m.originY ?? b.y}, 'missile', (b.age - m.launch) * 1000);
      }
    }
    this.epoch = state.epoch; this.time = state.time; this.seen = current;
    return fresh;
  }
}

// Distance is in world tiles, independent of overview zoom: the whole planet
// must never become audible just because the camera zoomed out.
export function spatialSound(event, listener) {
  const dx = event.x - listener.x, dy = event.y - listener.y;
  const range = ['heavy','blastHeavy'].includes(event.kind) ? 48 : event.kind === 'gun' ? 18 : 32;
  const distance = Math.hypot(dx, dy);
  return {gain: Math.max(0, 1 - distance / range) ** 2, pan: Math.max(-1, Math.min(1, dx / 16))};
}
