// Gravitational-lens wormhole for the War Zone <-> Colonization branch change.
// Presentation only: no save, account, world or server state is read here.
//
// Two real optical effects drive the picture, both in closed form:
//  - A point-mass lens, beta = theta - thetaE^2 / theta, bends the origin sky
//    around the wormhole mouth: an Einstein ring, tangential arcs and inverted
//    secondary images inside the ring.
//  - Relativistic aberration. Treating the sky picture as a stereographic
//    projection, a boost toward the mouth is an exact zoom about it by
//    k = sqrt((1 - b) / (1 + b)): the universe is drawn into the hole. The
//    Doppler factor brightens the forward sky and dims the edge of view.
// Through the throat the whole destination sky fills the disc (rho = theta /
// (1 - theta^2 / T^2)), so it reads as a small world inside the hole that
// relaxes to the ordinary view once the throat is behind the camera.
// Timing, the photon-ring tint and the tempered brightness are art direction.
import { colonyWormholeState } from './colony-system.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
const mix = (a, b, t) => a + (b - a) * t;

export const WORMHOLE_LENS = Object.freeze({
  speed: .06,       // aberration zoom at the throat (camera speed about 0.993 c)
  einstein: .5,     // Einstein radius once the lens has formed, in source-planet radii
  ring: 1.05,       // ... at the throat; closer to a lens its Einstein angle grows
  throatOpen: .28,  // throat radius / Einstein radius while the lens forms
  throatClose: .70, // ... and once the approach ends
  swallow: 1.9,     // throat radius, in source-planet radii, after it swallows the planet
  focal: .45,       // stereographic focal length / max(width, height)
  field: .77,       // radius of the forward star disc / max(width, height)
  margin: .22,      // sky painted beyond each screen edge / max(width, height)
});

// Lens parameters at one moment. Every quantity is in static-frame CSS pixels
// except k. Start and end are exact identities: k = 1, no lens, no throat at
// age 0, and an infinite throat at the end. The lens forms first; the camera
// then accelerates into it.
export function wormholeLensState(age, planetRadius) {
  const base = colonyWormholeState(age), P = Math.max(1, planetRadius || 1);
  const { speed, einstein, ring, throatOpen, throatClose, swallow } = WORMHOLE_LENS;
  const fullEinstein = ring * P, approached = fullEinstein * throatClose, swallowed = swallow * P;
  let k, lens, throat;
  if (base.phase === 'collapse') {
    // The lens forms, then grows into an Einstein ring of the whole planet as
    // the camera accelerates into it and the sky is drawn in.
    const u = base.phaseProgress, approach = smooth((u - .38) / .62);
    lens = P * (einstein * smooth(u / .5) + (ring - einstein) * approach);
    throat = lens * (throatOpen + (throatClose - throatOpen) * smooth((u - .3) / .7));
    k = Math.pow(speed, approach);
  } else if (base.phase === 'converge') {
    lens = fullEinstein; throat = mix(approached, swallowed, smooth(base.phaseProgress)); k = speed;
  } else {
    // Exactly the ordinary view for the last 15%, so the final lens frames
    // already equal the live scene that replaces them.
    const s = smooth(base.phaseProgress / .85);
    lens = fullEinstein; throat = s >= 1 ? Infinity : swallowed / Math.pow(1 - s, 1.5); k = s >= 1 ? 1 : Math.pow(speed, 1 - s);
  }
  return { ...base, k, einstein: lens, throat, planetRadius: P };
}

// Point-lens images of a source at radius beta >= 0: the primary (same side,
// outside the Einstein ring) and the secondary (negative: opposite side, inside).
export function lensImages(beta, einstein) {
  const root = Math.sqrt(beta * beta + 4 * einstein * einstein);
  return [(beta + root) / 2, (beta - root) / 2];
}
export function lensSource(theta, einstein) { return theta - einstein * einstein / theta; }

// Through the throat: an image at theta < T shows the destination at rho.
export function throatSource(theta, throat) {
  if (!Number.isFinite(throat)) return theta;
  const x = theta / throat; return x >= 1 ? Infinity : theta / (1 - x * x);
}
export function throatImage(rho, throat) {
  if (!Number.isFinite(throat) || rho <= 0) return Math.max(0, rho);
  const q = 1 / (throat * throat), s = 4 * rho * rho * q;
  return s < 1e-6 ? rho * (1 - rho * rho * q) : (Math.sqrt(1 + s) - 1) / (2 * rho * q);
}

// Doppler factor of light arriving at screen radius R for the boost with zoom
// k. It is 1/k straight ahead and exactly 1 at rest.
export function dopplerFactor(k, radius, focal) {
  if (k >= 1) return 1;
  const b = (1 - k * k) / (1 + k * k), gamma = (1 + k * k) / (2 * k), psi = 2 * Math.atan(radius / (2 * focal));
  return 1 / (gamma * (1 - b * Math.cos(psi)));
}

// The painted sky extends beyond the screen so a compressed view still shows
// whole planets and nebulae. Margins are whole backing pixels, so screen
// texels sit exactly on the display grid; the rectangle is in CSS pixels.
export function lensLayer(width, height, backingWidth = width, backingHeight = height, maxTexture = 4096) {
  const sx = backingWidth / width, sy = backingHeight / height;
  const fit = Math.max(0, Math.min(WORMHOLE_LENS.margin * Math.max(width, height),
    (maxTexture - backingWidth) / (2 * sx), (maxTexture - backingHeight) / (2 * sy)));
  const marginX = Math.floor(fit * sx), marginY = Math.floor(fit * sy);
  return { x: -marginX / sx, y: -marginY / sy, width: (backingWidth + 2 * marginX) / sx, height: (backingHeight + 2 * marginY) / sy,
    marginX, marginY, backingWidth: backingWidth + 2 * marginX, backingHeight: backingHeight + 2 * marginY };
}

// How much of a sky point the painted layer holds. Uncompressed, everything a
// screen pixel can sample is inside. As the sky is drawn in, the layer fades
// out radially before its rectangle could show; mapped stars continue beyond.
export function skyCover(k, focus, layer) {
  const left = focus.x - layer.x, top = focus.y - layer.y, right = layer.x + layer.width - focus.x, bottom = layer.y + layer.height - focus.y;
  const inscribed = Math.max(24, Math.min(left, top, right, bottom));
  const corner = Math.max(Math.hypot(left, top), Math.hypot(right, top), Math.hypot(left, bottom), Math.hypot(right, bottom));
  const c = k >= 1 ? 0 : smooth((.9 - k) / .45), outer = mix(corner * 1.05, inscribed * .98, c), band = mix(1, inscribed * .45, c);
  return [inscribed * .15 * c, outer - band, band];
}
export function coverAt(x, y, focus, cover, layer) {
  const edge = Math.min(x - layer.x, y - layer.y, layer.x + layer.width - x, layer.y + layer.height - y);
  if (edge < 0) return 0;
  const rect = cover[0] > .001 ? smooth(edge / cover[0]) : 1;
  return rect * (1 - smooth((Math.hypot(x - focus.x, y - focus.y) - cover[1]) / cover[2]));
}

// The rest of the celestial sphere beyond the forward star disc: uniform on
// the sphere, stored as stereographic tan(psi / 2), with the forward disc's
// density where they meet. Seeded separately from the entry scene.
export function createRearStars(forward = 1150) {
  let seed = 90371;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const { focal, field } = WORMHOLE_LENS, edge = field / (2 * focal);
  const start = Math.cos(2 * Math.atan(edge)), end = Math.cos(179.4 * Math.PI / 180);
  // Forward stars are uniform over a square of side 1.54 span; per steradian
  // that is n * F^2 * (1 + (rho / 2F)^2)^2 at the disc edge.
  const perSteradian = forward / (1.54 * 1.54) * focal * focal * (1 + edge * edge) ** 2;
  const count = Math.round(perSteradian * 2 * Math.PI * (start - end));
  return Array.from({ length: count }, () => ({
    angle: random() * Math.PI * 2, tan: Math.tan(Math.acos(start + (end - start) * random()) / 2),
    z: .25 + random() * .75, phase: random() * Math.PI * 2, size: random(),
  }));
}

// Stars the painted layers do not hold: those beyond them and the rear sky.
// Each is mapped through the same lens, throat and aberration as the shader,
// so they stream into the hole with the rest of the universe.
export function paintLensStars(ctx, sky, state, view) {
  const { centre, focal, width, height, layer, origin, destination } = view;
  const { k, einstein, throat } = state;
  const draw = (colours, bright, x, y, size, alpha) => {
    if (x < -2 || y < -2 || x > width + 2 || y > height + 2 || alpha < .01) return;
    ctx.globalAlpha = Math.min(1, alpha); ctx.fillStyle = bright ? colours.bright : colours.dim;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };
  for (let i = 0; i < sky.count; i++) {
    const x = sky.x[i], y = sky.y[i], base = sky.alpha[i], size = sky.size[i], bright = sky.bright[i];
    let dx = x - origin.focus.x, dy = y - origin.focus.y, weight = 1 - coverAt(x, y, origin.focus, origin.cover, layer);
    const beta = Math.hypot(dx, dy);
    if (weight > .01 && beta > .01) {
      const root = Math.sqrt(beta * beta + 4 * einstein * einstein);
      for (let image = 0; image < 2; image++) {
        const theta = image ? (beta - root) / 2 : (beta + root) / 2, slope = image ? (1 - beta / root) / 2 : (1 + beta / root) / 2;
        if (Math.abs(theta) <= throat) continue;
        const radius = Math.abs(theta) * k, scale = (theta < 0 ? -radius : radius) / beta;
        const gain = clamp(Math.sqrt(Math.abs(theta / beta * slope)), .2, 2) * clamp(Math.sqrt(dopplerFactor(k, radius, focal)), .6, 1.8);
        draw(origin, bright, centre.x + dx * scale, centre.y + dy * scale, size, base * weight * gain);
      }
    }
    if (throat <= 0) continue;
    dx = x - destination.focus.x; dy = y - destination.focus.y; weight = 1 - coverAt(x, y, destination.focus, destination.cover, layer);
    const rho = Math.hypot(dx, dy);
    if (weight <= .01 || rho <= .01) continue;
    const theta = throatImage(rho, throat), radius = theta * k, scale = radius / rho;
    const q = Number.isFinite(throat) ? 1 / (throat * throat) : 0, squeeze = 1 - q * theta * theta;
    const magnification = theta / rho * squeeze * squeeze / (1 + q * theta * theta);
    const gain = clamp(Math.pow(magnification, .35), .15, 1.6) * clamp(Math.sqrt(dopplerFactor(k, radius, focal)), .6, 1.8);
    draw(destination, bright, centre.x + dx * scale, centre.y + dy * scale, size, base * weight * gain);
  }
  ctx.globalAlpha = 1;
}

// The throat edge (photon ring), where both skies are squeezed into one thin
// line, and the blueshifted forward light gathered there at peak speed.
export function paintThroatLight(ctx, state, centre, colors, unit) {
  const rim = state.k * state.throat, u = state.phaseProgress;
  const visible = state.phase === 'collapse' ? smooth(u / .35) : state.phase === 'converge' ? 1 : 1 - smooth((u - .4) / .3);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  if (visible > 0 && rim > 1.5 && rim < unit * 4) {
    ctx.strokeStyle = colors.main; ctx.globalAlpha = visible * .2; ctx.lineWidth = clamp(rim * .08, 2, 9);
    ctx.beginPath(); ctx.arc(centre.x, centre.y, rim, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = colors.bright; ctx.globalAlpha = visible * .78; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(centre.x, centre.y, rim, 0, Math.PI * 2); ctx.stroke();
  }
  const core = state.phase === 'collapse' ? smooth((u - .6) / .4) : state.phase === 'converge' ? 1 : 1 - smooth(u / .3);
  if (core > 0) {
    const radius = Math.min(unit * .1, 12 + rim * 1.2), glow = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, radius);
    glow.addColorStop(0, colors.bright); glow.addColorStop(.18, colors.main); glow.addColorStop(1, colors.clear);
    ctx.globalAlpha = core * .55; ctx.fillStyle = glow; ctx.fillRect(centre.x - radius, centre.y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

export const THROAT_COLORS = Object.freeze({
  gold: Object.freeze({ main: '#ffe1a0', bright: '#fff9e7', clear: '#f6ce7e00' }),
  blue: Object.freeze({ main: '#9bdfff', bright: '#f0fcff', clear: '#75cfff00' }),
});

const VERTEX = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0); }`;

// One pass per frame: each display pixel finds the sky point whose light
// reaches it. Both lookups stay outside branches so mipmap levels come from
// true derivatives; compressed regions average instead of shimmering.
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uOrigin, uDestination;
uniform vec2 uView, uBacking, uCentre, uOriginFocus, uDestinationFocus;
uniform vec4 uLayer;
uniform vec3 uOriginCover, uDestinationCover;
uniform float uK, uEinstein, uThroat, uFocal, uBeta, uGamma;
out vec4 colour;
float cover(vec2 p, vec2 focus, vec3 c) {
  vec2 a = p - uLayer.xy, b = uLayer.xy + uLayer.zw - p;
  float edge = min(min(a.x, a.y), min(b.x, b.y));
  float rect = c.x > 0.001 ? smoothstep(0.0, c.x, edge) : step(0.0, edge);
  return rect * (1.0 - smoothstep(c.y, c.y + c.z, distance(p, focus)));
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uBacking.y - gl_FragCoord.y) * (uView / uBacking);
  vec2 d = p - uCentre;
  float radius = length(d);
  vec2 dir = radius > 1e-4 ? d / radius : vec2(1.0, 0.0);
  float theta = radius / uK;
  float x = theta / max(uThroat, 1e-3);
  float rho = min(theta / max(1.0 - x * x, 1e-4), 1e5);
  float beta = clamp(theta - uEinstein * uEinstein / max(theta, 1e-3), -1e5, 1e5);
  vec2 po = uOriginFocus + dir * beta, pd = uDestinationFocus + dir * rho;
  vec4 origin = texture(uOrigin, (po - uLayer.xy) / uLayer.zw) * cover(po, uOriginFocus, uOriginCover);
  vec4 destination = texture(uDestination, (pd - uLayer.xy) / uLayer.zw) * cover(pd, uDestinationFocus, uDestinationCover);
  float pixel = uView.x / uBacking.x, rim = uK * uThroat;
  float inside = uThroat > 0.0 ? 1.0 - smoothstep(rim - pixel, rim + pixel, radius) : 0.0;
  vec4 light = mix(origin, destination, inside);
  if (uK < 0.9999) {
    float D = 1.0 / (uGamma * (1.0 - uBeta * cos(2.0 * atan(radius / (2.0 * uFocal)))));
    float shift = clamp(log2(D) / 3.0, -1.0, 1.0);
    vec3 tint = shift > 0.0 ? mix(vec3(1.0), vec3(0.88, 0.97, 1.14), shift) : mix(vec3(1.0), vec3(1.12, 0.92, 0.78), -shift);
    light.rgb = min(light.rgb * clamp(pow(D, 0.5), 0.55, 1.8) * tint, vec3(light.a));
  }
  colour = light;
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

// Returns null where WebGL2 or the shader is unavailable; the caller keeps the
// earlier 2D iris. A lost context reports unusable and the caller falls back.
export function createWormholeLens() {
  let canvas, gl;
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  } catch { return null; }
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX), fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const uniform = Object.fromEntries(['uOrigin', 'uDestination', 'uView', 'uBacking', 'uCentre', 'uOriginFocus', 'uDestinationFocus', 'uLayer',
    'uOriginCover', 'uDestinationCover', 'uK', 'uEinstein', 'uThroat', 'uFocal', 'uBeta', 'uGamma'].map(name => [name, gl.getUniformLocation(program, name)]));
  const vao = gl.createVertexArray(), anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
  const textures = [gl.createTexture(), gl.createTexture()], sizes = [[0, 0], [0, 0]];
  for (const texture of textures) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  let lost = false;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; });
  const check = () => { if (lost || gl.isContextLost()) throw new Error('Lens context lost'); };
  return {
    canvas, maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    get usable() { return !lost && !gl.isContextLost(); },
    // Slot 0 holds the origin sky (uploaded once), slot 1 the live destination.
    upload(slot, source) {
      check();
      gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, textures[slot]);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      if (sizes[slot][0] === source.width && sizes[slot][1] === source.height) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); sizes[slot] = [source.width, source.height]; }
      gl.generateMipmap(gl.TEXTURE_2D);
    },
    render({ state, centre, layer, origin, destination, width, height, backingWidth, backingHeight, focal }) {
      check();
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) { canvas.width = backingWidth; canvas.height = backingHeight; }
      const k = state.k, b = (1 - k * k) / (1 + k * k), gamma = (1 + k * k) / (2 * k);
      gl.viewport(0, 0, backingWidth, backingHeight); gl.useProgram(program); gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[0]); gl.uniform1i(uniform.uOrigin, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[1]); gl.uniform1i(uniform.uDestination, 1);
      gl.uniform2f(uniform.uView, width, height); gl.uniform2f(uniform.uBacking, backingWidth, backingHeight);
      gl.uniform2f(uniform.uCentre, centre.x, centre.y); gl.uniform4f(uniform.uLayer, layer.x, layer.y, layer.width, layer.height);
      gl.uniform2f(uniform.uOriginFocus, origin.focus.x, origin.focus.y); gl.uniform2f(uniform.uDestinationFocus, destination.focus.x, destination.focus.y);
      gl.uniform3f(uniform.uOriginCover, ...origin.cover); gl.uniform3f(uniform.uDestinationCover, ...destination.cover);
      gl.uniform1f(uniform.uK, k); gl.uniform1f(uniform.uEinstein, state.einstein);
      gl.uniform1f(uniform.uThroat, Number.isFinite(state.throat) ? state.throat : 1e9);
      gl.uniform1f(uniform.uFocal, focal); gl.uniform1f(uniform.uBeta, b); gl.uniform1f(uniform.uGamma, gamma);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      check();
    },
    // Free the large textures between transitions; the context is reused.
    release() {
      if (!this.usable) return;
      for (let slot = 0; slot < 2; slot++) {
        gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, textures[slot]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); sizes[slot] = [1, 1];
      }
      canvas.width = canvas.height = 1;
    },
  };
}
