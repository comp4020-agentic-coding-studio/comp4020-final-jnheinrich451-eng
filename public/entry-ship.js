// Presentation only: the Cuculidae hovering over a destination, its jump between
// worlds and the drop-pod dive. Nothing here reads or decides game or save state.
export const JUMP = Object.freeze({ charge: 500, streak: 250, arrive: 850, total: 1600 });
export const DROP = Object.freeze({ zoom: 1500, release: 1500, dive: 4000, total: 7000 });
export const WARP = Object.freeze({ approach: 1300, line: 500, expand: 700, hold: 300, total: 2800 });
// Row offsets are measured from the keel of the 1455 x 194 source image.
const SPRITE = { src: '/assets/entry/cuculidae-top.png', width: 1455, height: 194, keel: 100.5, nozzles: [-45, 4, 47] };
const POD_SPRITE = '/assets/entry/cuculidae-pod-top.png';
const TAU = Math.PI * 2, DIVE_ZOOM = 6;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
const turnTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Hovers nose up and slightly right. Position and length follow the globe, so the
// ship scrolls and resizes with its destination. Phones have a small globe under a
// large title, so the ship sits lower and shorter there to stay clear of it.
export function shipPose(globe, time, compact = false) {
  return {
    x: globe.x + globe.r * ((compact ? -.2 : -.30) + Math.sin(time * .0009) * .018),
    y: globe.y + globe.r * ((compact ? .36 : .08) + Math.sin(time * .0007 + 1) * .022),
    angle: -Math.PI / 2 + .2 + Math.sin(time * .0005) * .02,
    length: globe.r * (compact ? .64 : .8),
  };
}
// Offsets are in ship lengths along the direction of travel. The globes swap at
// the flash's peak, the moment `swapped` first becomes true.
export function jumpState(age) {
  const { charge, streak, arrive, total } = JUMP;
  if (age < charge) { const p = smooth(age / charge); return { phase: 'charge', swapped: false, turn: p, stretch: 1, offset: 0, flash: 0, stars: p * .25, glow: p }; }
  if (age < charge + streak) { const p = (age - charge) / streak; return { phase: 'streak', swapped: false, turn: 1, stretch: 1 + p * p * 15, offset: p * p * p * 9, flash: p * p, stars: .25 + p * .75, glow: 1 }; }
  const p = clamp((age - charge - streak) / arrive), settle = 1 - (1 - p) ** 3;
  return { phase: age >= total ? 'done' : 'arrive', swapped: true, turn: 1 - smooth((p - .45) / .55), stretch: 1 + (1 - settle) ** 2 * 12,
    offset: (settle - 1) * 7, flash: (1 - p) ** 3, stars: (1 - p) ** 2, glow: 1 - p };
}
export function jumpPose(pose, state, direction) {
  const travel = direction > 0 ? 0 : Math.PI;
  return { ...pose, angle: pose.angle + turnTo(pose.angle, travel) * state.turn,
    x: pose.x + Math.cos(travel) * pose.length * state.offset, y: pose.y + Math.sin(travel) * pose.length * state.offset };
}
// Join's lead-in. The host's world swings to the front, then the ship falls out of
// warp onto it: a line from beyond the frame that shortens into the hull.
export function warpState(age) {
  const { approach, line, expand, total } = WARP;
  if (age < approach) return { phase: 'approach', line: 0, expand: 0, stretch: 1, flash: 0, done: false };
  if (age < approach + line) return { phase: 'line', line: (age - approach) / line, expand: 0, stretch: 1, flash: 0, done: false };
  const p = clamp((age - approach - line) / expand), settle = 1 - (1 - p) ** 3;
  return { phase: 'expand', line: 1, expand: settle, stretch: 1 + (1 - settle) ** 2 * 22, flash: (1 - p) ** 4, done: age >= total };
}
// The nose stays put as the stretched hull contracts, so the ship ends exactly on `pose`.
export function warpPose(pose, state) {
  const back = (state.stretch - 1) * pose.length / 2;
  return { ...pose, x: pose.x - Math.cos(pose.angle) * back, y: pose.y - Math.sin(pose.angle) * back };
}
export function dropState(age) {
  const { zoom, release, dive, total } = DROP;
  if (age < zoom) return { phase: 'zoom', zoom: smooth(age / zoom), release: 0, dive: 0, done: false };
  if (age < zoom + release) return { phase: 'release', zoom: 1, release: (age - zoom) / release, dive: 0, done: false };
  return { phase: 'dive', zoom: 1, release: 1, dive: clamp((age - zoom - release) / dive), done: age >= total };
}
// The pod slides out from under the hull on the port side, then swings its heat
// shield toward the planet. The ship then runs ahead and leaves the frame.
export function podPose(pose, state) {
  const out = smooth(state.release / .6) * .135, forward = -.06, a = pose.angle, port = a - Math.PI / 2;
  const down = Math.PI / 2;
  return { x: pose.x + (Math.cos(a) * forward + Math.cos(port) * out) * pose.length, y: pose.y + (Math.sin(a) * forward + Math.sin(port) * out) * pose.length,
    angle: a + turnTo(a, down) * smooth((state.release - .3) / .7), size: pose.length * .05 };
}
export function shipDeparture(pose, state) {
  const run = smooth((state.release - .35) / .65) ** 2 * 1.6;
  return { pose: { ...pose, x: pose.x + Math.cos(pose.angle) * pose.length * run, y: pose.y + Math.sin(pose.angle) * pose.length * run }, glow: run ? 1 : 0 };
}
const reachOf = (width, height) => Math.max(height, width * .6) * 1.25;
export const podScreenSize = (width, height) => reachOf(width, height) * .0675;
// World point (fx, fy) lands on screen point (x, y) at scale z. It starts as the
// identity on the hovering ship, so the cut into the sequence cannot jump.
export function dropCamera(pose, state, pod, width, height) {
  const settle = smooth(state.release), fill = reachOf(width, height) / pose.length;
  return { z: lerp(1, fill, state.zoom) * (1 + .35 * settle) * DIVE_ZOOM ** (state.dive ** 1.7),
    fx: lerp(pose.x, pod.x, settle), fy: lerp(pose.y, pod.y, settle),
    x: lerp(pose.x, width / 2, state.zoom), y: lerp(pose.y, height * .46, state.zoom) };
}

function layer(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return { canvas, ctx: canvas.getContext('2d') }; }
function makeFlame() {
  // Root at the right edge, tail running left. One sprite, so a hovering ship and
  // the dive's flame tongues cost a few image draws per frame, not fresh gradients.
  const { canvas, ctx } = layer(320, 96);
  const tongue = (reach, tall, stops) => {
    ctx.save(); ctx.translate(304, 48); ctx.scale(reach / 48, tall / 48);
    const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
    for (const [at, color] of stops) fill.addColorStop(at, color);
    ctx.fillStyle = fill; ctx.fillRect(-48, -48, 96, 96); ctx.restore();
  };
  tongue(300, 46, [[0, '#ff2a14c0'], [.45, '#e0141070'], [1, '#a0100000']]);
  tongue(190, 26, [[0, '#ffb45ce8'], [.5, '#ff5a2288'], [1, '#ff301000']]);
  tongue(90, 11, [[0, '#fff8e8ff'], [.6, '#ffd9a0b0'], [1, '#ffb06000']]);
  return canvas;
}
function makeGlow() {
  const { canvas, ctx } = layer(120, 120), fill = ctx.createRadialGradient(60, 60, 0, 60, 60, 60);
  fill.addColorStop(0, '#fff6e6ff'); fill.addColorStop(.3, '#ffc27ac0'); fill.addColorStop(.65, '#ff6a2a50'); fill.addColorStop(1, '#ff300000');
  ctx.fillStyle = fill; ctx.fillRect(0, 0, 120, 120); return canvas;
}
function makeFlare() {
  const { canvas, ctx } = layer(120, 120), fill = ctx.createRadialGradient(60, 60, 0, 60, 60, 60);
  fill.addColorStop(0, '#ffffffff'); fill.addColorStop(.22, '#cfeaffd8'); fill.addColorStop(.55, '#5cb2ff58'); fill.addColorStop(1, '#2a7fff00');
  ctx.fillStyle = fill; ctx.fillRect(0, 0, 120, 120); return canvas;
}
// A pointed tongue, root at the right edge. Drawn opaque rather than additive, so the
// ring keeps its red and gold over bright cloud.
function makeTongue(root, middle, tip) {
  const { canvas, ctx } = layer(160, 64), fill = ctx.createLinearGradient(160, 0, 0, 0);
  fill.addColorStop(0, root); fill.addColorStop(.5, middle); fill.addColorStop(1, tip);
  ctx.filter = 'blur(5px)'; ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(160, 6); ctx.quadraticCurveTo(50, 8, 8, 32); ctx.quadraticCurveTo(50, 56, 160, 58); ctx.closePath(); ctx.fill();
  return canvas;
}
let effects = null;
const sprites = () => effects ||= { flame: makeFlame(), glow: makeGlow(), flare: makeFlare(), red: makeTongue('#ff4a14', '#e01c0c', '#a00c0400'), gold: makeTongue('#fff6c0', '#ffc62e', '#ff8a1400') };

// Halved copies keep the hovering ship from shimmering when the 1455 px source is
// drawn small. The zoom climbs back through them to the full image.
function shipImages(image) {
  const images = [image]; let source = image;
  while (source.width > 320) {
    const { canvas, ctx } = layer(source.width >> 1, source.height >> 1);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    images.push(canvas); source = canvas;
  }
  return images;
}
export function loadShip(ready) {
  const image = new Image();
  image.onload = () => ready(shipImages(image));
  image.src = SPRITE.src;
}
let podImage = null;
export function loadPod() {
  if (podImage) return;
  podImage = new Image(); podImage.src = POD_SPRITE;
}
export function paintShip(ctx, images, pose, { alpha = 1, stretch = 1, glow = 0, time = 0, pixels = 1 } = {}) {
  const L = pose.length, unit = L / SPRITE.width, { flame, glow: light } = sprites();
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.angle); ctx.globalAlpha = alpha;
  // Red tails go down first so the hull overlaps their roots.
  ctx.globalCompositeOperation = 'lighter';
  SPRITE.nozzles.forEach((row, i) => {
    const flicker = .9 + Math.sin(time * .023 + i * 2.1) * .06 + Math.sin(time * .061 + i) * .04;
    const length = L * (.24 + glow * .22) * flicker * (i === 1 ? .62 : 1), thick = L * (i === 1 ? .034 : .05) * (1 + glow * .25);
    ctx.drawImage(flame, -L / 2 * stretch - length + L * .012, row * unit - thick / 2, length, thick);
  });
  ctx.globalCompositeOperation = 'source-over';
  const image = images.findLast(candidate => candidate.width >= L * stretch * pixels) || images[0];
  const tall = SPRITE.height * unit / stretch ** .6;
  ctx.drawImage(image, -L / 2 * stretch, -SPRITE.keel / SPRITE.height * tall, L * stretch, tall);
  if (stretch > 1) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * clamp((stretch - 1) / 4);
    ctx.drawImage(light, -L * .6 * stretch, -L * .04, L * 1.2 * stretch, L * .08);
  }
  ctx.restore();
}
// Warp's line of light, then the hull it shortens into. The line starts beyond the
// frame on the ship's own heading, so it is already moving as it enters.
export function paintWarp(ctx, images, pose, state, { width, height, time = 0, pixels = 1 }) {
  const nose = pose.length / 2, { flare } = sprites(), dx = -Math.cos(pose.angle), dy = -Math.sin(pose.angle);
  const noseX = pose.x - dx * nose, noseY = pose.y - dy * nose;
  // How far back along the heading the frame ends, so the line is seen for its whole run.
  const entry = Math.min(dx > 0 ? (width - noseX) / dx : dx < 0 ? noseX / -dx : Infinity, dy > 0 ? (height - noseY) / dy : dy < 0 ? noseY / -dy : Infinity) + 30;
  const head = lerp(-entry, 0, state.line), tail = lerp(-entry - 240, -pose.length, state.expand), fade = 1 - state.expand;
  ctx.save(); ctx.translate(noseX, noseY); ctx.rotate(pose.angle); ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(tail, 0, head, 0);
  beam.addColorStop(0, '#2a7fff00'); beam.addColorStop(.55, '#7cc4ffb0'); beam.addColorStop(1, '#ffffff');
  ctx.globalAlpha = fade; ctx.fillStyle = beam; ctx.fillRect(tail, -1.5, Math.max(0, head - tail), 3);
  const bloom = pose.length * (.18 + state.flash * .9);
  ctx.globalAlpha = Math.max(state.flash, state.expand ? 0 : .8); ctx.drawImage(flare, head - bloom / 2, -bloom / 2, bloom, bloom);
  ctx.restore();
  if (state.expand > 0) paintShip(ctx, images, warpPose(pose, state), { alpha: clamp(state.expand * 2.2), stretch: state.stretch, glow: fade, time, pixels });
}
// The design sheet's TOP view: the dive looks straight down on the pod's armoured cap.
export function paintPod(ctx, x, y, angle, size) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (podImage?.complete && podImage.naturalWidth) ctx.drawImage(podImage, -size / 2, -size / 2, size, size);
  else { ctx.fillStyle = '#2b2e33'; ctx.fillRect(-size / 2, -size / 2, size, size); }
  ctx.restore();
}
// Re-entry plasma wrapped around the cap, after the author's sketch: a gold ring
// inside a red one. Tongues start on the square's edge so the ring follows the pod.
function paintHeatRing(ctx, x, y, pod, heat, time) {
  const { red, gold, glow } = sprites(), halo = pod * (2.3 + heat * 1.6);
  const ring = (image, count, offset, reach, wide) => {
    for (let i = 0; i < count; i++) {
      const angle = (i + offset) / count * TAU + Math.sin(time * .0009 + i) * .06, cos = Math.cos(angle), sin = Math.sin(angle);
      const edge = pod * .44 / Math.max(Math.abs(cos), Math.abs(sin));
      // Slow swells shape the outline; the fast terms are only the flicker along it.
      const lick = .78 + Math.sin(i * .7 + time * .0043) * .16 + Math.sin(i * 1.9 - time * .0071) * .12 + Math.sin(time * .023 + i * 3.1) * .08;
      ctx.save(); ctx.translate(x + cos * edge, y + sin * edge); ctx.rotate(angle + Math.PI);
      ctx.drawImage(image, -reach * lick, -wide / 2, reach * lick, wide); ctx.restore();
    }
  };
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = heat * .6;
  ctx.drawImage(glow, x - halo / 2, y - halo / 2, halo, halo);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = heat * .92;
  ring(red, 44, 0, pod * (.55 + heat * .8), pod * .62);
  ring(gold, 44, .5, pod * (.28 + heat * .36), pod * .5);
  ctx.restore();
}
export function paintFlash(ctx, width, height, amount) {
  if (amount <= 0) return;
  // One slightly oversized fill. The peak hides the globe swap without a pure white frame.
  ctx.fillStyle = `rgba(206,232,255,${amount * .88})`; ctx.fillRect(-1, -1, width + 2, height + 2);
}
const seeded = (i, salt) => { const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return n - Math.floor(n); };
// Screen-space layers while the camera follows the pod. Everything is derived from
// the clock and a fixed count, so a long dive cannot accumulate browser work.
export function paintDive(ctx, { width, height, progress, time, size, clouds }) {
  const heat = smooth((progress - .02) / .38), rush = smooth((progress - .2) / .5), shake = heat * Math.min(3, size * .035);
  const x = width / 2 + Math.sin(time * .047) * shake, y = height * .46 + Math.cos(time * .059) * shake, reach = Math.hypot(width, height);
  const pod = size * lerp(1, clamp(width * .22 / size, 1, 1.7), smooth(progress / .4));
  ctx.save();
  ctx.fillStyle = `rgba(255,${lerp(150, 84, heat) | 0},${lerp(90, 30, heat) | 0},${.04 + heat * .1})`; ctx.fillRect(-1, -1, width + 2, height + 2);
  // Clouds tear past the edges of the frame. The centre stays clear, so the ground
  // the pod is falling toward is never hidden.
  if (clouds && rush) for (let i = 0; i < 7; i++) {
    const phase = (time * .00062 * (.8 + seeded(i, 8) * .5) + seeded(i, 9)) % 1, angle = seeded(i, 10) * TAU;
    const span = (.3 + phase * 1.1) * reach, far = (.16 + phase * phase * .62) * reach;
    ctx.save(); ctx.translate(x + Math.cos(angle) * far, y + Math.sin(angle) * far); ctx.rotate(angle);
    ctx.globalAlpha = Math.sin(Math.PI * phase) * .52 * rush; ctx.drawImage(clouds, -span / 2, -span / 3, span, span * .66); ctx.restore();
  }
  // Thin air lines race outward from the point of descent.
  if (rush) {
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const angle = seeded(i, 1) * TAU, phase = (time * .0013 * (.7 + seeded(i, 2) * .6) + seeded(i, 3)) % 1, near = phase * phase * reach * .62, far = near * 1.28;
      ctx.moveTo(x + Math.cos(angle) * near, y + Math.sin(angle) * near); ctx.lineTo(x + Math.cos(angle) * far, y + Math.sin(angle) * far);
    }
    ctx.strokeStyle = `rgba(255,226,190,${rush * .34})`; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
  if (heat) paintHeatRing(ctx, x, y, pod, heat, time);
  // Embers shed from the ring run outward with the air.
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb066';
  for (let i = 0; i < 30; i++) {
    const life = (time * .0011 * (.6 + seeded(i, 4) * .7) + seeded(i, 5)) % 1, angle = seeded(i, 6) * TAU, far = pod * .7 + life * life * reach * .42;
    ctx.globalAlpha = (1 - life) * heat; const dot = 1.2 + seeded(i, 7) * 2.4;
    ctx.fillRect(x + Math.cos(angle) * far, y + Math.sin(angle) * far, dot, dot);
  }
  ctx.restore();
  paintPod(ctx, x, y, Math.PI / 2, pod);
  ctx.save();
  const edge = ctx.createRadialGradient(x, y, reach * .22, x, y, reach * .62);
  edge.addColorStop(0, '#00000000'); edge.addColorStop(1, `rgba(20,4,0,${.2 + heat * .5})`);
  ctx.fillStyle = edge; ctx.fillRect(-1, -1, width + 2, height + 2);
  ctx.restore();
}
