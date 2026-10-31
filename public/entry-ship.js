// Presentation only: the Cuculidae hovering over a destination, its jump between
// worlds and the drop-pod dive. Nothing here reads or decides game or save state.
export const JUMP = Object.freeze({ charge: 500, streak: 250, arrive: 850, total: 1600 });
export const DROP = Object.freeze({ zoom: 1500, release: 1500, dive: 4000, total: 7000 });
// Row offsets are measured from the keel of the 1455 x 194 source image.
const SPRITE = { src: '/assets/entry/cuculidae-top.png', width: 1455, height: 194, keel: 100.5, nozzles: [-45, 4, 47] };
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
let effects = null;
const sprites = () => effects ||= { flame: makeFlame(), glow: makeGlow() };

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
// A stubby ochre canister with dark caps, after the row under the concept's hull.
// Its heat shield is at +x.
export function paintPod(ctx, x, y, angle, size, heat = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size, size);
  const hull = () => { ctx.beginPath(); ctx.moveTo(-.5, -.25); ctx.lineTo(-.4, -.36); ctx.lineTo(.36, -.36); ctx.lineTo(.5, -.2); ctx.lineTo(.5, .2); ctx.lineTo(.36, .36); ctx.lineTo(-.4, .36); ctx.lineTo(-.5, .25); ctx.closePath(); };
  const skin = ctx.createLinearGradient(0, -.36, 0, .36);
  skin.addColorStop(0, '#5f4d26'); skin.addColorStop(.28, '#c7a24a'); skin.addColorStop(.62, '#a7883c'); skin.addColorStop(1, '#3f3219');
  hull(); ctx.fillStyle = skin; ctx.fill();
  ctx.save(); hull(); ctx.clip();
  ctx.fillStyle = '#1f2529'; ctx.fillRect(-.5, -.4, .17, .8); ctx.fillRect(.3, -.4, .2, .8);
  ctx.fillStyle = '#3b444b'; ctx.fillRect(-.46, -.4, .05, .8);
  // Scuffed paint and seams keep it from reading as a flat icon.
  ctx.fillStyle = '#2d2616b0'; ctx.fillRect(-.14, -.4, .018, .8); ctx.fillRect(.12, -.4, .018, .8); ctx.fillRect(-.08, .03, .15, .022); ctx.fillRect(.02, -.17, .08, .016);
  if (heat) { ctx.fillStyle = `rgba(255,${130 - heat * 70 | 0},40,${heat * .55})`; ctx.fillRect(-.5, -.4, 1, .8); ctx.fillStyle = `rgba(255,214,150,${heat * .9})`; ctx.fillRect(.3, -.4, .2, .8); }
  ctx.restore();
  ctx.strokeStyle = '#0d1012'; ctx.lineWidth = .018; hull(); ctx.stroke();
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
  const { flame, glow } = sprites(), pod = size * lerp(1, clamp(width * .18 / size, 1, 1.4), smooth(progress / .4));
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
  // Atmosphere flames: a comet tail streaming back past the camera.
  ctx.globalCompositeOperation = 'lighter';
  if (heat) for (let i = 0; i < 7; i++) {
    const length = height * (.26 + heat * .5) * (.72 + Math.sin(time * .017 + i * 1.3) * .28), thick = pod * (.6 + heat * .7) * (i % 2 ? .6 : 1);
    ctx.save(); ctx.translate(x, y + pod * .12); ctx.rotate(Math.PI / 2 + (i - 3) * .055 + Math.sin(time * .0031 + i * 1.7) * .13);
    ctx.globalAlpha = heat * .9; ctx.drawImage(flame, -length, -thick / 2, length, thick); ctx.restore();
  }
  ctx.fillStyle = '#ffb066';
  for (let i = 0; i < 30; i++) {
    const life = (time * .0011 * (.6 + seeded(i, 4) * .7) + seeded(i, 5)) % 1, wander = (seeded(i, 6) - .5) * pod * (1.4 + life * 4);
    ctx.globalAlpha = (1 - life) * heat; const dot = 1.2 + seeded(i, 7) * 2.4;
    ctx.fillRect(x + wander, y - life * height * .62, dot, dot * 2.6);
  }
  ctx.restore();
  paintPod(ctx, x, y, Math.PI / 2, pod, heat);
  ctx.save();
  // The bow shock sits on the heat shield, the leading edge of the fall.
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = heat;
  const bow = pod * (1.9 + heat * 2.2), deep = pod * (.9 + heat * .9);
  ctx.drawImage(glow, x - bow / 2, y + pod * .46 - deep / 2, bow, deep);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const edge = ctx.createRadialGradient(x, y, reach * .22, x, y, reach * .62);
  edge.addColorStop(0, '#00000000'); edge.addColorStop(1, `rgba(20,4,0,${.2 + heat * .5})`);
  ctx.fillStyle = edge; ctx.fillRect(-1, -1, width + 2, height + 2);
  ctx.restore();
}
