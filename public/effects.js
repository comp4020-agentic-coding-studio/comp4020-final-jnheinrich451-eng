// Client-only presentation: the server sends outcomes, never individual particles.
const TAU = Math.PI * 2;
function random(seed) { let n = seed | 0; return () => { n = Math.imul(n ^ n >>> 15, 1 | n); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
function ellipse(c, x, y, rx, ry, color, angle = 0) { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fill(); }
function sprite(size, paint) { const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; paint(canvas.getContext('2d'), size); return canvas; }
function cloud(inner, outer) {
  return sprite(96, (c, s) => { const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, inner); g.addColorStop(.45, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, s, s); });
}

export function drawCrawler(c, e, time, hit = 0, dead = false) {
  c.save(); c.translate(e.x, e.y); c.rotate(e.angle || 0);
  const gait = dead ? 0 : Math.sin(time * 13 + e.id) * 4;
  ellipse(c, 3, 5, 22, 27, '#1c231944');
  // Six articulated limbs, with alternating strides and pale claws.
  for (let side = -1; side <= 1; side += 2) for (let leg = 0; leg < 3; leg++) {
    const y = -9 + leg * 10, stride = gait * ((leg % 2) * 2 - 1) * side;
    const knee = side * (21 + (dead ? -4 : 0)), foot = side * (25 + (dead ? -8 : 0));
    c.strokeStyle = '#432823'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(side * 7, y); c.lineTo(knee, y + 4 + stride); c.lineTo(foot, y - 4 + stride); c.stroke();
    c.strokeStyle = dead ? '#592e32' : '#a3513e'; c.lineWidth = 3; c.beginPath(); c.moveTo(side * 8, y - 1); c.lineTo(knee, y + 3 + stride); c.stroke();
    c.strokeStyle = '#ba9d76'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(foot, y - 4 + stride); c.lineTo(foot + side * 2, y - 8 + stride); c.stroke();
  }
  ellipse(c, 0, 10, 11, 15, dead ? '#48282c' : '#6e302b');
  ellipse(c, 0, -1, 14, 19, dead ? '#542c32' : hit ? '#d49d7e' : '#a34b38');
  ellipse(c, -3, -3, 8, 16, dead ? '#63343d' : '#c16a47');
  for (let i = 0; i < 4; i++) { c.strokeStyle = dead ? '#341f27' : '#5e3029'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9 + i, 1 + i * 5); c.quadraticCurveTo(0, 5 + i * 5, 9 - i, 1 + i * 5); c.stroke(); }
  // Two necks and skulls remain readable from directly overhead.
  for (const side of [-1, 1]) {
    const x = side * 8, bob = dead ? 4 : side * gait * .25;
    ellipse(c, x, -20 + bob, 8, 11, dead ? '#572e36' : '#79362e', side * .18);
    ellipse(c, x - 2, -23 + bob, 5, 7, dead ? '#62343c' : hit ? '#edbd98' : '#be694d', side * .18);
    if (!dead) {
      ellipse(c, x + side * 3, -25 + bob, 1.6, 2.3, '#f2d087');
      c.strokeStyle = '#d5ba8d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 4, -28 + bob); c.lineTo(x - 2, -32 + bob); c.moveTo(x + 4, -28 + bob); c.lineTo(x + 2, -32 + bob); c.stroke();
    }
  }
  if (e.behavior === 'fleeing' && !dead) {
    ellipse(c, 0, 0, 11, 18, '#202324aa');
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 8, y = Math.sin(time * 15 + i * 2) * 3;
      c.fillStyle = '#e97430'; c.beginPath(); c.moveTo(x - 4, y + 7); c.quadraticCurveTo(x - 6, y, x + 2, y - 12); c.quadraticCurveTo(x + 6, y + 3, x + 3, y + 7); c.fill();
      ellipse(c, x, y + 3, 2, 4, '#ffd67c');
    }
  }
  c.restore();
}

export class CombatEffects {
  constructor(tileSize) {
    this.tile = tileSize; this.epoch = null; this.seen = new Set(); this.bursts = []; this.bulletHits = []; this.muzzles = []; this.hits = new Map(); this.marks = [];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; this.shakeEnabled = true;
    this.dust = cloud('#a08d6a99', '#8b806300'); this.smoke = cloud('#43413a99', '#514b4100');
    this.glow = cloud('#fff6c5ff', '#ff8b1900'); this.splash = cloud('#bfdad888', '#bedad800');
    this.craters = Array.from({ length: 4 }, (_, index) => sprite(128, (c) => {
      const rand = random(index + 417); c.translate(64, 64);
      const halo = c.createRadialGradient(0, 0, 10, 0, 0, 60); halo.addColorStop(0, '#252219aa'); halo.addColorStop(.55, '#37302170'); halo.addColorStop(1, '#66563700'); c.fillStyle = halo; c.fillRect(-64, -64, 128, 128);
      const rim = Array.from({ length: 22 }, (_, i) => ({ a: i / 22 * TAU, r: 27 + rand() * 9 }));
      c.beginPath(); for (const p of rim) c.lineTo(Math.cos(p.a) * p.r, Math.sin(p.a) * p.r); c.closePath(); c.fillStyle = '#403b2fbb'; c.fill(); c.strokeStyle = '#c4a57788'; c.lineWidth = 3; c.stroke();
      ellipse(c, 0, 2, 24, 21, '#292b26aa'); ellipse(c, -4, -4, 18, 16, '#1d251e44');
      for (let i = 0; i < 36; i++) { const a = rand() * TAU, r = 34 + rand() * 23; c.fillStyle = i % 2 ? '#b39b6e88' : '#3d3b2b99'; c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1 + rand() * 4, 1 + rand() * 3); }
    }));
    this.remains = Array.from({ length: 4 }, (_, i) => sprite(112, c => {
      const rand = random(i + 92); c.translate(56, 56);
      for (let j = 0; j < 18; j++) { const a = rand() * TAU, r = rand() * 30; ellipse(c, Math.cos(a) * r, Math.sin(a) * r, 2 + rand() * 5, 1 + rand() * 4, j % 2 ? '#62374c88' : '#895b7788', a); }
      c.scale(.82, .72); drawCrawler(c, { x: 0, y: 0, angle: .4, id: i }, 0, 0, true);
    }));
    this.charredRemains = this.remains.map(image => sprite(112, c => { c.filter = 'brightness(.3)'; c.drawImage(image, 0, 0); }));
  }
  ingest(state, clock) {
    if (this.epoch !== state.epoch) { this.epoch = state.epoch; this.seen.clear(); this.bursts = []; this.bulletHits = []; this.muzzles = []; this.hits.clear(); }
    this.marks = state.marks || [];
    const current = new Set();
    for (const event of [...(state.shots || []), ...(state.impacts || [])]) {
      current.add(event.id); if (this.seen.has(event.id)) continue; this.seen.add(event.id);
      const age = Math.max(0, (state.time - event.at) / 1000), born = clock - age * 1000;
      // Combat snapshots are batched at 10 Hz. Preserve a brief muzzle flash even
      // when the first snapshot arrives after that very short visual would expire.
      if (event.owner !== undefined) { if (age < .25) this.muzzles.push({ ...event, born: clock - Math.min(age, .025) * 1000 }); continue; }
      if (age >= 1.6) continue;
      for (const hit of event.hits) this.hits.set(hit.id, { born, killed: hit.killed });
      if (event.weapon !== 'HE' && !event.minorBlast) { if (age < .35) this.bulletHits.push({ ...event, born }); continue; }
      const rand = random(event.id + 23), count = event.minorBlast ? (this.reduced ? 6 : 14) : this.reduced ? 10 : 24;
      const particles = Array.from({ length: count }, (_, i) => ({ a: rand() * TAU, speed: 35 + rand() * 160, size: 1 + rand() * 3, spin: rand() * TAU, dust: i % 3 === 0, hot: i % 3 === 1, heat: .75 + rand() * .25 }));
      this.bursts.push({ ...event, born, particles });
    }
    for (const id of this.seen) if (!current.has(id)) this.seen.delete(id);
    this.bursts = this.bursts.slice(this.reduced ? -4 : -10); this.muzzles = this.muzzles.slice(-24);
    // Hidden tabs still receive snapshots: prune here as well as during rendering.
    this.prune(clock);
  }
  prune(clock) {
    this.bursts = this.bursts.filter(b => clock - b.born < 1600).slice(this.reduced ? -4 : -10);
    this.muzzles = this.muzzles.filter(b => clock - b.born < 250);
    this.bulletHits = this.bulletHits.filter(b => clock - b.born < 350).slice(this.reduced ? -10 : -24);
    for (const [id, hit] of this.hits) if (clock - hit.born > 400) this.hits.delete(id);
  }
  recoil(id, clock, weapon = 'HE') { const shot = this.muzzles.findLast(s => s.owner === id && (s.weapon || 'HE') === weapon); return shot ? Math.max(0, 1 - (clock - shot.born) / 250) * (weapon === 'HE' ? 6 : 2) : 0; }
  hit(id, clock) { const hit = this.hits.get(id); return hit ? Math.max(0, 1 - (clock - hit.born) / 250) : 0; }
  offset(clock, camera, zoom) {
    if (this.reduced || !this.shakeEnabled) return { x: 0, y: 0 };
    let amplitude = 0;
    for (const b of this.bursts) { const age = (clock - b.born) / 1000, distance = Math.hypot(b.x * this.tile - camera.x, b.y * this.tile - camera.y) * zoom;
      amplitude = Math.max(amplitude, Math.max(0, 1 - age / .22) * Math.max(0, 1 - distance / 500) * (b.minorBlast ? 1.2 : 3)); }
    return { x: Math.sin(clock * .079) * amplitude, y: Math.cos(clock * .063) * amplitude };
  }
  drawGround(c, clock, layer = null) {
    for (const mark of this.marks) {
      if (layer && mark.kind !== layer) continue;
      const image = (mark.kind === 'crater' ? this.craters : mark.charred ? this.charredRemains : this.remains)[mark.id % 4], size = mark.kind === 'crater' ? this.tile * (mark.size || 1.9) : this.tile * 1.35;
      const hit = this.hits.get(mark.id), age = hit ? Math.max(0, (clock - hit.born) / 350) : 1;
      c.save(); c.translate(mark.x * this.tile, mark.y * this.tile); c.rotate(mark.kind === 'remains' ? mark.angle || 0 : mark.id * 2.4);
      const collapse = mark.kind === 'remains' ? 1 + Math.max(0, 1 - age) * .18 : 1;
      c.scale(collapse, collapse); c.drawImage(image, -size / 2, -size / 2, size, size); c.restore();
    }
  }
  draw(c, clock) {
    for (const shot of this.muzzles) {
      const age = (clock - shot.born) / 1000; if (age > .16) continue;
      c.save(); c.translate(shot.x * this.tile, shot.y * this.tile); c.rotate(shot.angle);
      if (shot.mount === 'artillery') { c.translate(0, -(78 * (.3 + .7 * Math.cos((shot.elevation ?? 75) * Math.PI / 180))) + 40); c.scale(1.3, 1.3); }
      if (shot.weapon === 'LASER' || shot.weapon === 'MAGNETIC') {
        const distance = Math.hypot(shot.endX - shot.x, shot.endY - shot.y) * this.tile;
        c.globalAlpha = Math.max(0, 1 - age / .16) * (this.reduced ? .65 : 1);
        for (const [width, color] of (shot.weapon === 'MAGNETIC' ? [[5, '#79d9ff88'], [1.8, '#e4fcff']] : this.reduced ? [[2, '#ff6570']] : [[10, '#ff203c38'], [4, '#ff304e'], [1.5, '#fff0ed']])) {
          c.lineWidth = width; c.strokeStyle = color; c.beginPath(); c.moveTo(0, -Math.min(24, distance)); c.lineTo(0, -distance); c.stroke();
        }
        c.restore(); continue;
      }
      if (['FLAME', 'HEAVY_FLAME'].includes(shot.weapon)) { c.restore(); continue; }
      if (shot.mount === 'naval-main') c.translate(0,32);
      if (['APCR','NAVAL_APCR'].includes(shot.weapon)) {
        if (shot.mount === 'naval-secondary') c.translate(0,7);
        if (shot.mount === 'coax') c.translate(10, 0);
        c.globalAlpha = Math.max(0, 1 - age / .085) * (this.reduced ? .4 : .8);
        c.fillStyle = '#e9ca85'; c.beginPath(); c.moveTo(-2, -24); c.lineTo(-4, -30); c.lineTo(0, -37); c.lineTo(3, -29); c.lineTo(2, -24); c.fill(); c.restore(); continue;
      }
      c.globalAlpha = (1 - age / .16) * (this.reduced ? .45 : 1); c.drawImage(this.glow, -19, -51, 38, 38);
      c.fillStyle = '#ffebad'; c.beginPath(); c.moveTo(-4, -22); c.lineTo(-7, -31); c.lineTo(0, -47); c.lineTo(6, -30); c.lineTo(4, -22); c.fill(); c.restore();
    }
    for (const hit of this.bulletHits) {
      const age = (clock - hit.born) / 1000;
      c.save(); c.translate(hit.x * this.tile, hit.y * this.tile); c.globalAlpha = Math.max(0, 1 - age / .35);
      for (let i = 0; i < (this.reduced ? 2 : 5); i++) {
        const a = hit.id + i * 2.4, radius = 2 + age * (18 + i * 9);
        const color = hit.weapon === 'GAS' ? '#d5eea5' : hit.weapon === 'LASER' ? '#ff8b91' : ['FLAME', 'BURN', 'INCENDIARY'].includes(hit.weapon) ? '#ffbe61' : hit.hits.length ? '#985a83' : '#d0ba83';
        ellipse(c, Math.cos(a) * radius, Math.sin(a) * radius, 1.7, .9, color, a);
      }
      c.restore();
    }
    for (const b of this.bursts) {
      const age = Math.max(0, (clock - b.born) / 1000), fade = Math.max(0, 1 - age / 1.6), water = b.surface === 0;
      c.save(); c.translate(b.x * this.tile, b.y * this.tile);
      if (b.minorBlast) c.scale(.65, .65);
      if (age < .28) {
        c.globalAlpha = (1 - age / .28) * (this.reduced ? .35 : .7); c.strokeStyle = water ? '#dbefec' : '#d6bf8d'; c.lineWidth = 5 * (1 - age / .28) + 1;
        c.beginPath(); c.arc(0, 0, 8 + b.radius * this.tile * Math.min(1, age / .28), 0, TAU); c.stroke();
      }
      // Analytic trajectories need no per-particle physics or network traffic.
      for (const p of b.particles.slice(0, this.reduced ? 10 : 24)) {
        const distance = p.speed * (1 - Math.exp(-age * 3)) / 3, x = Math.cos(p.a) * distance, y = Math.sin(p.a) * distance;
        const lift = Math.max(0, Math.sin(Math.min(1, age / .7) * Math.PI)) * p.speed * .14;
        if (p.dust) {
          const size = 16 + age * 35 + p.size * 3;
          c.globalAlpha = fade * (this.reduced ? .24 : .45); c.drawImage(water ? this.splash : age > .65 ? this.smoke : this.dust, x - size / 2, y - lift - size / 2, size, size);
        } else if (age < .95) {
          const hot = p.hot && !water, cooling = age / p.heat;
          const color = cooling < .22 ? '#ffe396' : cooling < .5 ? '#ff9c3b' : '#d94b2c';
          if (hot) {
            // A short trail follows the same curved flight as the shard itself.
            const previousAge = Math.max(0, age - .055), previousDistance = p.speed * (1 - Math.exp(-previousAge * 3)) / 3;
            const previousLift = Math.max(0, Math.sin(Math.min(1, previousAge / .7) * Math.PI)) * p.speed * .14;
            c.globalAlpha = (1 - age / .95) * (this.reduced ? .3 : .65); c.strokeStyle = color; c.lineWidth = Math.max(1, p.size * .6);
            c.beginPath(); c.moveTo(Math.cos(p.a) * previousDistance, Math.sin(p.a) * previousDistance - previousLift); c.lineTo(x, y - lift); c.stroke();
            if (!this.reduced) { const glow = p.size * 5; c.globalAlpha = Math.max(0, .4 - cooling * .4); c.drawImage(this.glow, x - glow / 2, y - lift - glow / 2, glow, glow); }
          }
          c.globalAlpha = (1 - age / .95) * .4; ellipse(c, x + 2, y + 3, p.size * 1.5, p.size, '#233024');
          c.globalAlpha = 1 - age / .95; c.save(); c.translate(x, y - lift); c.rotate(p.spin + age * 7);
          c.fillStyle = water ? '#d1e4d9' : hot ? color : '#4e4431';
          c.beginPath(); c.moveTo(-p.size * 1.6, -p.size * .35); c.lineTo(p.size, -p.size * .65); c.lineTo(p.size * .5, p.size * .75); c.lineTo(-p.size * .7, p.size * .3); c.closePath(); c.fill();
          if (hot && cooling < .45) { c.strokeStyle = '#ffeabb'; c.lineWidth = .7; c.beginPath(); c.moveTo(-p.size, -p.size * .3); c.lineTo(p.size * .6, -p.size * .5); c.stroke(); }
          c.restore();
        }
      }
      if (age < .3 && water) {
        c.globalAlpha=(1-age/.3)*(this.reduced?.2:.55);c.fillStyle='#a6e9e1';c.beginPath();c.ellipse(0,0,12+age*120,8+age*80,0,0,TAU);c.fill();
      }
      if (age < .23 && !water) {
        const size = 35 + age * 220; c.globalAlpha = (1 - age / .23) * (this.reduced ? .3 : 1); c.drawImage(this.glow, -size / 2, -size / 2, size, size);
        c.fillStyle = '#fff2c8'; c.beginPath(); c.arc(0, 0, Math.max(1, 12 * (1 - age / .23)), 0, TAU); c.fill();
      }
      // A few purple flecks mark a hit, with no dismemberment.
      for (const victim of b.hits) for (let i = 0; i < (this.reduced ? 3 : 6); i++) {
        if (age > .45) continue;
        const a = i / 6 * TAU + victim.id, r = age * (35 + i * 7);
        c.globalAlpha = Math.max(0, 1 - age / .45); ellipse(c, (victim.x - b.x) * this.tile + Math.cos(a) * r, (victim.y - b.y) * this.tile + Math.sin(a) * r, 2.8, 1.8, '#81516e', a);
      }
      c.restore();
    }
  }
}
