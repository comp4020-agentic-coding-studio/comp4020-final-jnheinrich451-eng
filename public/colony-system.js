// Cached civilian sky layers and a cosmetic, interruptible system transition.
export const COLONY_WORMHOLE = Object.freeze({ collapse: 850, converge: 200, expand: 750, total: 1800 });
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const p = clamp(x); return p * p * (3 - 2 * p); };

export function colonyWormholeState(age) {
  const { collapse, converge, expand, total } = COLONY_WORMHOLE, clock = Math.max(0, age);
  const phase = clock < collapse ? 'collapse' : clock < collapse + converge ? 'converge' : 'expand';
  const phaseProgress = clamp(phase === 'collapse' ? clock / collapse : phase === 'converge' ? (clock - collapse) / converge : (clock - collapse - converge) / expand);
  return { phase, phaseProgress, progress: clamp(clock / total),
    aperture: phase === 'collapse' ? 1 - smooth(phaseProgress) : phase === 'expand' ? smooth(phaseProgress) : 0,
    lens: phase === 'collapse' ? smooth(phaseProgress * 1.8) : phase === 'expand' ? 1 - smooth(phaseProgress) : 1,
    done: clock >= total };
}

export function colonyWormholeGeometry(state, width, height, options = {}) {
  const fallback = { x: width * .5, y: height * .48, radius: Math.min(width, height) * .6 };
  const outgoing = { ...fallback, ...options.focus }, incoming = { ...outgoing, ...options.incomingFocus };
  const blend = state.phase === 'collapse' ? 0 : state.phase === 'expand' ? 1 : smooth(state.phaseProgress);
  const x = outgoing.x + (incoming.x - outgoing.x) * blend, y = outgoing.y + (incoming.y - outgoing.y) * blend;
  const planetRadius = outgoing.radius + (incoming.radius - outgoing.radius) * blend;
  const reach = Math.max(Math.hypot(x, y), Math.hypot(width - x, y), Math.hypot(x, height - y), Math.hypot(width - x, height - y)) + 2;
  const radius = 3.5 + (reach - 3.5) * state.aperture;
  const band = Math.min(radius * .04, Math.max(2, Math.min(9, planetRadius * .02)) * (.4 + state.lens * .6));
  return { x, y, radius, band, planetRadius };
}

function tinted(source, color) {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export function createColonySky(nebula, shafts) {
  return { mist: tinted(nebula, '#fffdf2'), gold: tinted(nebula, '#e9cd8e'), shafts: tinted(shafts, '#ffe3a0') };
}

export function paintColonySky(ctx, layers, width, height, time, sun) {
  const span = Math.max(width, height) * .7, haze = .025 + sun.visible * .15;
  ctx.fillStyle = '#080c0d'; ctx.fillRect(0, 0, width, height);
  // Thin illuminated dust stays around the star; the surrounding universe is open.
  ctx.save(); ctx.translate(width * (.5 + .48 * sun.x), height * (.48 + .65 * sun.y)); ctx.rotate(-.42 + time * .000014);
  ctx.globalAlpha = haze; ctx.drawImage(layers.mist, -span * .8, -span * .45, span * 1.6, span * .9);
  ctx.rotate(1.2); ctx.globalAlpha = haze * .42; ctx.drawImage(layers.gold, -span * .62, -span * .28, span * 1.3, span * .56); ctx.restore();
}

export function paintColonySun(ctx, shafts, sun, width, height, time) {
  if (sun.visible <= 0) return;
  const unit = Math.min(width, height), x = width * (.5 + .48 * sun.x), y = height * (.48 + .65 * sun.y), size = unit * .34;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = sun.visible * sun.pulse;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size);
  for (const [at, color] of [[0, '#ffffffff'], [.045, '#fff9dfff'], [.09, '#ffe6a1e8'], [.22, '#edc35c81'], [.6, '#d9a13f2a'], [1, '#d9a13f00']]) glow.addColorStop(at, color);
  ctx.fillStyle = glow; ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.translate(x, y); ctx.rotate(time * .000025);
  ctx.drawImage(shafts, -size * 1.65, -size * 1.65, size * 3.3, size * 3.3);
  ctx.rotate(-time * .000025 - .12);
  const trace = ctx.createLinearGradient(-size * 1.7, 0, size * 1.7, 0);
  trace.addColorStop(0, '#ffe4a300'); trace.addColorStop(.5, '#fff8dce8'); trace.addColorStop(1, '#ffe4a300');
  ctx.fillStyle = trace; ctx.fillRect(-size * 1.7, -1, size * 3.4, 2);
  ctx.fillStyle = '#fffdf0'; ctx.beginPath(); ctx.arc(0, 0, Math.max(3, unit * .012), 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export function captureColonyFrame(source) {
  const canvas = document.createElement('canvas'), scale = Math.min(1, 1100 / source.width);
  canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height); return canvas;
}

export function paintColonyWormhole(ctx, outgoing, incoming, state, width, height, options = {}) {
  if (state.done) return;
  const { x, y, radius, band, planetRadius } = colonyWormholeGeometry(state, width, height, options);
  const source = state.phase === 'collapse' ? outgoing : state.phase === 'expand' ? incoming : null;
  const colors = options.direction === 'blue'
    ? { main: '#9bdfff', bright: '#f0fcff', split: '#bcbaff', fringe: '#ffd4a0' }
    : { main: '#ffe1a0', bright: '#fff9e7', split: '#a6d9e8', fringe: '#efb9bc' };
  // The caller paints live stars first. Transparent cached celestial layers are
  // revealed at their original screen geometry, never scaled into a thumbnail.
  if (source) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(source, 0, 0, width, height); ctx.restore();
  }
  ctx.save(); ctx.translate(x, y);
  if (source && state.lens > 0 && radius > 6) {
    const sourceWidth = source.width || source.naturalWidth || width, sourceHeight = source.height || source.naturalHeight || height;
    const sx = sourceWidth / width, sy = sourceHeight / height;
    const cropWidth = Math.max(2, 9 * sx), cropHeight = Math.max(2, 4 * sy);
    const touch = clamp((planetRadius * 1.35 - radius) / Math.max(1, planetRadius * .45));
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, radius + band, 0, Math.PI * 2); ctx.arc(0, 0, Math.max(0, radius - band), 0, Math.PI * 2, true); ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = state.lens * (.15 + touch * .20);
    // Sixteen tiny source crops stretch along the rim tangent. The narrow
    // annular clip turns them into slit-scan arcs instead of a shrinking globe.
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8 + state.progress * .24;
      const sampleX = (x + Math.cos(angle) * radius) * sx, sampleY = (y + Math.sin(angle) * radius) * sy;
      if (sampleX < 0 || sampleY < 0 || sampleX >= sourceWidth || sampleY >= sourceHeight) continue;
      const left = Math.max(0, Math.min(sourceWidth - cropWidth, sampleX - cropWidth / 2));
      const top = Math.max(0, Math.min(sourceHeight - cropHeight, sampleY - cropHeight / 2));
      const length = Math.max(16, radius * (1.10 + Math.sin(i * 2.7) * .20));
      ctx.save(); ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.rotate(angle + Math.PI / 2);
      ctx.drawImage(source, left, top, cropWidth, cropHeight, -length / 2, -band * .225, length, band * .45); ctx.restore();
    }
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'screen';
  for (const [lineWidth, alpha] of [[band * 1.45, .035], [2.4, .10], [.9, .30]]) {
    ctx.strokeStyle = colors.main; ctx.globalAlpha = state.lens * alpha; ctx.lineWidth = lineWidth;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  }
  // Sparse color-separated arcs, four glints and two lens ellipses are derived
  // from the clock; none allocate particles or read screen pixels per frame.
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.43 + state.progress * .46, spread = .24 + (i % 3) * .13;
    ctx.strokeStyle = i % 2 ? colors.split : colors.fringe; ctx.globalAlpha = state.lens * (.42 + i % 3 * .06); ctx.lineWidth = .95 + i % 2 * .55;
    ctx.beginPath(); ctx.arc(0, 0, radius + (i % 2 ? band * .8 + 2 : -band * .65 - 1), angle, angle + spread); ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const angle = i * 1.71 + state.progress * .35, r = radius + band * Math.sin(i * 2.1) * .35;
    ctx.fillStyle = i % 2 ? colors.split : colors.bright;
    ctx.globalAlpha = state.lens * (.42 + i * .08); ctx.beginPath(); ctx.ellipse(Math.cos(angle) * r, Math.sin(angle) * r, 1.2 + i % 2, .7, angle, 0, Math.PI * 2); ctx.fill();
  }
  if (radius > 18) for (let i = 0; i < 2; i++) {
    const angle = .8 + i * 3.1 + state.progress * .3, r = radius + (i ? -1 : 1) * (band * 1.2 + 2);
    ctx.strokeStyle = i ? colors.fringe : colors.split; ctx.globalAlpha = state.lens * .42; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.ellipse(Math.cos(angle) * r, Math.sin(angle) * r, Math.min(24, Math.max(6, radius * .07)), 2.3, angle + Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
  }
  const core = state.phase === 'converge' ? 1 : smooth((.075 - state.aperture) / .075);
  if (core) {
    const glowRadius = 24 + core * 13, glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    glow.addColorStop(0, colors.bright); glow.addColorStop(.09, colors.main); glow.addColorStop(1, options.direction === 'blue' ? '#75cfff00' : '#f6ce7e00');
    ctx.globalAlpha = core * .84; ctx.fillStyle = glow; ctx.fillRect(-glowRadius, -glowRadius, glowRadius * 2, glowRadius * 2);
    for (let i = 0; i < 2; i++) {
      ctx.globalAlpha = core * (.22 - i * .06); ctx.strokeStyle = i ? colors.split : colors.main; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.ellipse(0, 0, 9 + i * 4, 4 + i * 2, -.4 + i * .9, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
