import { projectColonyPoint, COLONY_DEPTH } from './colony-view.js';
import { settlementDefinition, settlementItems, settlementSize, SETTLEMENT } from './colony-settlement.js';

// Original illustrated furnishings. World coordinates and the same camera as
// the agricultural worker; no external textures or floating DOM furniture.
const TAU = Math.PI * 2;
const M = { ink: '#59686b', dark: '#48585c', white: '#edf0e6', shade: '#bccbc4', gold: '#b6975c', wood: '#ba9673', woodDark: '#92775f', glass: '#b5d8d1', flower: '#dcabbd', leaf: '#8da789', soil: '#766e57' };
const tones = { ivory: '#edece0', sage: '#b3c8ae', violet: '#c3b5cb' };
// Life-pace furnishings: both 1 x 1 and solid. The catalogue row ('Brew kettle',
// 'Charging post') belongs to colony-settlement.js; this fallback only keeps the
// art drawable for previews and ghosts while that row is still being wired.
const ART_FALLBACK = Object.freeze({
  'charging-post': Object.freeze({ id: 'charging-post', width: 1, height: 1, solid: true }),
  kettle: Object.freeze({ id: 'kettle', width: 1, height: 1, solid: true }),
});
const artDefinition = kind => settlementDefinition(kind) || ART_FALLBACK[kind] || null;
const projected = (x, y, z = 0) => { const p = projectColonyPoint(x, y, z); return [p.x, p.y]; };
function poly(c, points, fill, stroke = M.ink, width = .021) { c.beginPath(); c.moveTo(...points[0]); for (let i = 1; i < points.length; i++) c.lineTo(...points[i]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function line(c, points, color = M.ink, width = .028) { c.beginPath(); c.moveTo(...points[0]); for (let i = 1; i < points.length; i++) c.lineTo(...points[i]); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function ellipse(c, x, y, rx, ry, fill, stroke = null) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = .02; c.stroke(); } }
function painter(c, item) {
  const spec = artDefinition(item.kind), w = spec.width, h = spec.height, dir = item.dir || 0;
  const world = (x, y, z = 0) => dir === 1 ? [item.x + h - y, item.y + x, z] : dir === 2 ? [item.x + w - x, item.y + h - y, z] : dir === 3 ? [item.x + y, item.y + w - x, z] : [item.x + x, item.y + y, z];
  const pt = (x, y, z = 0) => projected(...world(x, y, z));
  const box = (x, y, hx, hy, z, height, fill = M.white) => {
    const corners = [[x - hx, y - hy], [x + hx, y - hy], [x + hx, y + hy], [x - hx, y + hy]];
    const faces = corners.map((a, i) => { const b = corners[(i + 1) % 4]; return { a, b, y: (world(...a)[1] + world(...b)[1]) / 2 }; }).sort((a, b) => a.y - b.y);
    for (const face of faces) poly(c, [pt(...face.a, z), pt(...face.b, z), pt(...face.b, z + height), pt(...face.a, z + height)], face.y >= world(x, y)[1] ? M.shade : M.dark);
    poly(c, corners.map(p => pt(...p, z + height)), fill);
  };
  const stroke = (points, color, width) => line(c, points.map(p => pt(...p)), color, width);
  const shape = (points, fill, edge) => poly(c, points.map(p => pt(...p)), fill, edge);
  const disc = (x, y, z, rx, ry, fill, edge = null) => { const [px, py] = pt(x, y, z); ellipse(c, px, py, rx, ry, fill, edge); };
  const depth = (x, y) => world(x, y)[1];
  return { spec, w, h, pt, box, stroke, shape, disc, depth };
}
const heights = { cabin: 2.15, pergola: 1.75, trellis: 1.25, 'hanging-lights': 1.5, 'petal-lamp': 1.2, 'wind-sculpture': 1.65, pennant: 1.6, wayfinder: 1.1, 'charging-post': 1.4, kettle: 1.3 };
export function settlementArtBounds(item) {
  const { width, height } = settlementSize(item.kind, item.dir || 0), z = heights[item.kind] || 1;
  return [-.30, -z * .65 - .25, width + .60, height * COLONY_DEPTH + z * .65 + .60];
}
export const SETTLEMENT_ART_BOUNDS = Object.freeze(Object.fromEntries(['stepping-stones','ivory-paving','timber-deck','garden-border','low-fence','path-lamp','petal-lamp','hanging-lights','bench','parking-seat','worktable','wayfinder','pennant','flower-planter','reed-planter','specimen-case','trellis','pergola','cabin','wind-sculpture','pond','observation-deck','charging-post','kettle'].map(kind => [kind, settlementArtBounds({ kind, dir: 0 })])));

function plant(p, x, y, z, reed = false, variant = 'ivory') {
  const color = variant === 'violet' ? '#d3a7c8' : variant === 'sage' ? '#d6dba1' : '#e7c5ad';
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4, dx = Math.cos(angle) * .19, dy = Math.sin(angle) * .15, height = reed ? .55 + i % 3 * .07 : .28 + i % 2 * .10;
    p.stroke([[x, y, z], [x + dx * .6, y + dy * .6, z + height * .6], [x + dx, y + dy, z + height]], M.leaf, reed ? .021 : .03);
    p.disc(x + dx * .8, y + dy * .8, z + height * .5, .10, .045, '#91ae88');
    p.disc(x + dx, y + dy, z + height, reed ? .033 : .075, reed ? .075 : .051, reed ? '#c6bd96' : color);
    if (!reed) p.disc(x + dx, y + dy, z + height + .01, .025, .022, '#edd89d');
  }
}
export function drawSettlementBase(c, item) {
  const spec = artDefinition(item.kind); if (!spec) return;
  const p = painter(c, item), { w, h, box, stroke, shape, disc } = p, x = w / 2, y = h / 2, accent = tones[item.variant] || tones.ivory;
  if (item.status && item.status !== 'ready') {
    shape([[.05,.05,.01],[w-.05,.05,.01],[w-.05,h-.05,.01],[.05,h-.05,.01]], '#b9c6b54f', '#a9ad83');
    for (const [cx, cy] of [[.12,.12],[w-.12,.12],[w-.12,h-.12],[.12,h-.12]]) { box(cx, cy, .045, .045, .03, .12, M.gold); }
    stroke([[x-.2,y,.025],[x+.2,y,.025]], '#f4e6bd', .05); stroke([[x,y-.2,.025],[x,y+.2,.025]], '#f4e6bd', .05); return;
  }
  if (spec.solid) { const [sx, sy] = p.pt(x + .10, y + .12); ellipse(c, sx, sy, Math.max(.35, w * .48), Math.max(.23, h * .32), '#53695820'); }
  if (item.kind === 'stepping-stones') {
    for (let i = 0; i < 3; i++) { const dx = [.27,.67,.42][i], dy = [.22,.49,.78][i]; disc(dx,dy,.025,.20,.115,accent,'#a3b0a0'); } return;
  }
  if (['ivory-paving','timber-deck','observation-deck'].includes(item.kind)) {
    box(x,y,w*.48,h*.48,.01,.06,item.kind === 'ivory-paving' ? accent : M.wood);
    for(let i=0;i<(item.kind==='ivory-paving'?2:w*5);i++){const px=.12+i*(w-.24)/(item.kind==='ivory-paving'?1:w*5-1);stroke([[px,.04,.08],[px,h-.04,.08]],item.kind==='ivory-paving'?'#c6ccbb':M.woodDark,.014);}
    if(item.kind==='observation-deck')for(const cx of[.08,w-.08]){box(cx,h-.08,.055,.05,.05,.55);stroke([[cx,.08,.6],[cx,h-.08,.6]],M.white,.055);} return;
  }
  if(item.kind==='garden-border'){for(let i=0;i<4;i++)disc(.13+i*.24,.55+(i%2)*.03,.04,.14,.08,'#c2c5ad', '#9aa58f');plant(p,.5,.46,.03,false,item.variant);return;}
  if(item.kind==='parking-seat'){disc(x,y,.02,.40,.27,accent,M.ink);disc(x,y,.03,.27,.18,M.shade);stroke([[x-.12,y,.04],[x+.12,y,.04]],M.gold,.035);return;}
  if(item.kind==='low-fence'){for(const px of[.08,.92])box(px,.5,.05,.055,.02,.62);for(const z of[.28,.53])box(.5,.5,.46,.035,z,.07,M.wood);return;}
  if(['bench','worktable'].includes(item.kind)){
    for(const dx of[.17,w-.17])for(const dy of[.23,h-.23])box(dx,dy,.055,.055,.02,item.kind==='bench'?.35:.65);
    box(x,y,w*.46,h*.32,item.kind==='bench'?.36:.66,.10,item.kind==='bench'?M.wood:accent);
    if(item.kind==='bench'){box(x,.22,w*.46,.035,.47,.30,M.wood);for(const z of[.55,.68])stroke([[.10,.18,z],[w-.1,.18,z]],M.woodDark,.016);}else{box(.5,.5,.19,.15,.77,.13,M.gold);plant(p,w-.45,.48,.78,false,item.variant);}return;
  }
  if(['path-lamp','petal-lamp'].includes(item.kind)){
    const z=item.kind==='path-lamp'?.65:1.06;box(x,y,.17,.17,.01,.09,M.shade);box(x,y,.055,.055,.1,z-.14,M.white);disc(x,y,z,.17,.085,'#f3d69d',M.gold);
    if(item.kind==='petal-lamp'){for(let i=0;i<5;i++)disc(x+Math.cos(i*TAU/5)*.19,y+Math.sin(i*TAU/5)*.19,z+.09,.14,.06,accent,M.ink);}else box(x,y,.23,.16,z+.04,.06,accent);return;
  }
  if(item.kind==='hanging-lights'){
    for(const px of[.12,w-.12])box(px,y,.045,.045,.01,1.5);stroke([[.12,y,1.5],[x,y,1.22],[w-.12,y,1.5]],M.dark,.022);
    for(let i=0;i<5;i++){const px=.28+i*(w-.56)/4,z=1.23+Math.abs(px-x)*.21;disc(px,y,z-.08,.07,.09,'#f2d49c',M.gold);}return;
  }
  if(['wayfinder','pennant'].includes(item.kind)){
    // The pennant's cloth waves in drawSettlementMotion; only the pole is cached.
    box(x,y,.035,.035,.01,item.kind==='pennant'?1.6:1.03); if(item.kind!=='pennant'){box(x,y,.38,.05,.66,.22,accent);stroke([[x-.24,y+.055,.76],[x+.20,y+.055,.76]],M.gold,.04);}return;
  }
  if(['flower-planter','reed-planter','specimen-case'].includes(item.kind)){
    box(x,y,.34,.29,.03,.29,accent);box(x,y,.28,.23,.32,.035,M.soil);plant(p,x,y,.36,item.kind==='reed-planter',item.variant);
    if(item.kind==='specimen-case'){shape([[.15,.2,.35],[.85,.2,.35],[.85,.2,1.05],[.15,.2,1.05]],'#bce3d946','#a9c8c0');for(const dx of[.15,.85])stroke([[dx,.2,.32],[dx,.2,1.05],[dx,.8,1.05],[dx,.8,.32]],M.white,.025);shape([[.15,.2,1.05],[.85,.2,1.05],[.85,.8,1.05],[.15,.8,1.05]],'#d3e9dd55');}return;
  }
  if(item.kind==='trellis'){
    for(const px of[.1,w-.1])box(px,y,.04,.04,.02,1.3);
    for(let i=0;i<5;i++)stroke([[.1,y,.25+i*.24],[w-.1,y,.25+i*.24]],M.wood,.035);
    for(let i=0;i<5;i++){const px=.23+i*.37;stroke([[px,y,.12],[px,y,1.3]],M.wood,.03);plant(p,px,y,.25+(i%3)*.23,false,item.variant);}return;
  }
  if(item.kind==='pergola'){
    for(const dx of[.12,w-.12])for(const dy of[.12,h-.12])box(dx,dy,.075,.075,.02,1.65);
    for(let i=0;i<7;i++)box(.08+i*(w-.16)/6,y,.055,h*.52,1.65,.10,i%2?M.wood:accent);
    box(x,.12,w*.49,.065,1.48,.14);box(x,h-.12,w*.49,.065,1.48,.14);return;
  }
  if(item.kind==='cabin'){
    box(x,y,w*.46,h*.45,.04,.13,M.dark);box(x,y,w*.43,h*.42,.17,1.35,M.wood);
    shape([[.22,h-.23,.18],[w-.22,h-.23,.18],[w-.22,h-.23,1.52],[.22,h-.23,1.52]],M.wood);
    for(let i=0;i<6;i++)stroke([[.22,h-.23,.28+i*.19],[w-.22,h-.23,.28+i*.19]],M.woodDark,.018);
    for(const dx of[.22,w-.22])for(const dy of[.23,h-.23])box(dx,dy,.065,.065,.16,1.47);
    // Ridge runs from the back to the front gable. Both roof slopes meet the
    // same ridge; standing seams reveal its depth at normal playing scale.
    shape([[.12,.15,1.53],[x,.15,2.13],[x,h-.15,2.13],[.12,h-.15,1.53]],'#c4d3cb');
    shape([[x,.15,2.13],[w-.12,.15,1.53],[w-.12,h-.15,1.53],[x,h-.15,2.13]],accent);
    for(let i=1;i<7;i++){const ry=.15+i*(h-.3)/7;stroke([[.15,ry,1.55],[x,ry,2.14],[w-.15,ry,1.55]],'#a4b7b0',.014);}
    stroke([[x,.13,2.15],[x,h-.13,2.15]],M.white,.05);
    shape([[.2,h-.14,1.53],[w-.2,h-.14,1.53],[x,h-.14,2.08]],M.wood);
    stroke([[.18,h-.13,1.53],[x,h-.13,2.11],[w-.18,h-.13,1.53]],M.white,.065);
    stroke([[x,h-.12,1.54],[x,h-.12,2.05]],M.white,.035);
    shape([[x-.32,h-.16,.18],[x+.32,h-.16,.18],[x+.32,h-.16,1.09],[x-.32,h-.16,1.09]],M.dark,M.white);
    shape([[x-.23,h-.145,.56],[x+.23,h-.145,.56],[x+.23,h-.145,.98],[x-.23,h-.145,.98]],M.glass);
    disc(x+.22,h-.14,.47,.028,.028,M.gold);
    for(const dx of[.65,w-.65]){shape([[dx-.23,h-.16,.72],[dx+.23,h-.16,.72],[dx+.23,h-.16,1.18],[dx-.23,h-.16,1.18]],'#d9cba8',M.white);stroke([[dx,h-.15,.74],[dx,h-.15,1.15]],M.white,.027);}
    box(x,h-.02,.68,.12,.06,.12,M.wood);return;
  }
  if(item.kind==='wind-sculpture'){
    // The five leaves turn in drawSettlementMotion; plinth and mast are cached.
    box(x,y,.28,.23,.02,.15,M.shade);stroke([[x,y,.15],[x,y,1.6]],M.gold,.047);return;
  }
  if(item.kind==='charging-post'){
    // White upright post on a graphite plate; the variant band sits mid-height
    // under a fixed violet trim. The head carries a cable hook on its camera
    // face (+y) with a short coiled lead, and a small cyan standby lamp whose
    // glow lives in drawSettlementMotion / drawSettlementLights.
    box(x,y,.19,.17,.01,.07,M.shade);box(x,y,.075,.075,.08,1.04,M.white);
    box(x,y,.085,.085,.56,.11,accent);stroke([[x-.085,y+.09,.70],[x+.085,y+.09,.70]],'#a89bc0',.028);
    box(x,y,.135,.115,1.12,.15,M.dark);box(x,y,.11,.09,1.27,.035,M.shade);
    stroke([[x,y+.12,1.19],[x,y+.22,1.19],[x,y+.22,1.08]],M.ink,.032);
    for(let i=0;i<3;i++)disc(x+.02,y+.21,.98-i*.09,.065,.035,'#4e5c62','#8a989b');
    stroke([[x-.07,y+.12,1.15],[x+.07,y+.12,1.15]],'#a89bc0',.02);
    disc(x-.08,y+.118,1.22,.028,.024,'#9ee4e6',M.ink);return;
  }
  if(item.kind==='kettle'){
    // A low white stand with a variant-coloured shelf, a timber tray on top,
    // a white kettle with graphite lid, spout and arch handle, and two cups.
    for(const dx of[.22,.78])for(const dy of[.26,.74])box(dx,dy,.04,.04,.02,.52,M.white);
    box(x,y,.33,.27,.22,.05,accent);box(x,y,.37,.31,.54,.08,M.white);
    box(x,y,.31,.23,.62,.035,M.wood);stroke([[x-.31,y+.23,.66],[x+.31,y+.23,.66]],M.woodDark,.016);
    box(x-.13,y+.01,.12,.11,.655,.22,M.white);box(x-.13,y+.01,.075,.065,.875,.03,M.dark);disc(x-.13,y+.01,.915,.026,.02,M.gold);
    stroke([[x-.25,y+.02,.76],[x-.33,y+.02,.86],[x-.345,y+.02,.885]],M.dark,.036);
    stroke([[x-.13,y-.09,.87],[x-.13,y-.10,.99],[x-.13,y+.11,.99],[x-.13,y+.12,.87]],M.dark,.03);
    for(const [cx,cy] of[[x+.16,y-.09],[x+.21,y+.12]]){box(cx,cy,.05,.05,.655,.09,M.white);disc(cx,cy,.75,.04,.027,'#7a5a46');stroke([[cx+.05,cy,.72],[cx+.085,cy,.72],[cx+.05,cy,.68]],M.ink,.016);}
    return;
  }
  if(item.kind==='pond'){
    disc(x,y,.04,.91,.59,'#c5c9b7',M.ink);disc(x,y,.06,.78,.48,'#85b4b5');disc(x-.12,y-.06,.065,.59,.32,'#a0c6c2');
    for(let i=0;i<5;i++)disc(x+Math.cos(i*1.3)*.83,y+Math.sin(i*1.3)*.79,.09,.16,.1,'#ccd0b8', '#9da890');
    plant(p,.35,.32,.10,true,item.variant);disc(1.28,1.05,.085,.16,.07,'#a7bd91');return;
  }
}

/** Night light is separate from cached geometry. @param {any} c @param {any} item @param {any} environment */
export function drawSettlementLights(c, item, environment = 1) {
  if (item.status !== 'ready') return;
  const night = typeof environment === 'number' ? environment : environment.night || 0;
  if (night < .05 || !['path-lamp','petal-lamp','hanging-lights','cabin','charging-post'].includes(item.kind)) return;
  const p = painter(c, item), x=p.w/2,y=p.h/2;
  c.save();c.globalCompositeOperation='screen';
  if(item.kind==='charging-post'){
    // A cool standby pool, smaller and dimmer than the amber lamps.
    c.globalAlpha=Math.min(.22,night*.18);const [cx,cy]=p.pt(x,y+.1,.15);ellipse(c,cx,cy,.5,.3,'#8fd6dc');
    c.globalAlpha=night*.6;p.disc(x-.08,y+.118,1.22,.09,.055,'#c8f4f6');c.restore();return;
  }
  c.globalAlpha=Math.min(.35,night*.3);
  const [px,py]=p.pt(x,y,.15);ellipse(c,px,py,Math.max(.65,p.w*.58),Math.max(.4,p.h*.45),'#f0cc83');
  c.globalAlpha=night*.7;
  if(item.kind==='cabin'){for(const dx of[.65,p.w-.65])p.disc(dx,p.h-.14,.95,.18,.11,'#e6bd71');}
  else if(item.kind==='hanging-lights'){for(let i=0;i<5;i++)p.disc(.28+i*(p.w-.56)/4,y,1.15,.08,.06,'#ffe5aa');}
  else p.disc(x,y,item.kind==='path-lamp'?.65:1.06,.18,.08,'#ffe5aa');
  c.restore();
}

/** Per-frame furnishing motion, drawn right after each ready item's cached base sprite.
 * Moving cloth and leaves live here, never in the cached base; glow pulses are additive.
 * `inUse` is the runtime's word that a worker is at this furnishing: the kettle
 * steams and the charging post's lamp pulses; otherwise both rest. Existing kinds ignore it.
 * @param {any} c @param {any} item @param {number} time @param {boolean} [reduced] @param {any} [environment] @param {boolean} [inUse] */
const MOTION_KINDS = new Set(['pennant','wind-sculpture','hanging-lights','path-lamp','petal-lamp','pond','charging-post','kettle']);
const LEAF_ORDER = [0, 1, 2, 3, 4], LEAF_DEPTH = new Float64Array(5), byLeafDepth = (a, b) => LEAF_DEPTH[a] - LEAF_DEPTH[b];
export function drawSettlementMotion(c, item, time, reduced = false, environment = 0, inUse = false) {
  if (item.status !== 'ready' || !MOTION_KINDS.has(item.kind)) return;
  const night = typeof environment === 'number' ? environment : environment?.night || 0;
  const p = painter(c, item), { w, h, shape, disc } = p, x = w / 2, y = h / 2, accent = tones[item.variant] || tones.ivory;
  const phase = item.x * .7 + item.y * 1.1, alpha = c.globalAlpha;
  if (item.kind === 'charging-post') {
    // Steady faint standby light; in use it pulses brighter about once a second.
    // Reduced motion holds a fixed level either way (brighter when in use).
    const pulse = !inUse ? 0 : reduced ? .8 : Math.sin(time * TAU / 1.1 + phase) * .5 + .5;
    const level = .35 + .65 * pulse, scale = .55 + .45 * night;
    c.save(); c.globalCompositeOperation = 'screen';
    c.globalAlpha = alpha * (.10 + .30 * pulse) * scale; disc(x - .08, y + .118, 1.22, .16 + pulse * .08, .10 + pulse * .05, '#9fe9ee');
    c.globalAlpha = alpha * level * .7; disc(x - .08, y + .118, 1.22, .045, .034, '#e6ffff');
    c.restore();
    return;
  }
  if (item.kind === 'kettle') {
    // Three steam puffs climb from the spout, spreading and fading. Idle kettles
    // are still; reduced motion shows one fixed puff so use still reads.
    if (!inUse) return;
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      const t = reduced ? .35 : ((time * .45 + i / 3 + phase * .1) % 1 + 1) % 1;
      c.globalAlpha = alpha * (1 - t) * .5;
      disc(x - .35 + (reduced ? 0 : Math.sin(time * 1.1 + i * 2.1) * .04), y + .02, .92 + t * .5, .04 + t * .07, .03 + t * .05, '#f4f8f2');
      if (reduced) break;
    }
    c.restore();
    return;
  }
  if (item.kind === 'pennant') {
    // Gentle wind: 0.6 Hz with a second harmonic, the lower corner lagging the tip.
    const gust = reduced ? 0 : Math.sin(time * TAU * .6 + phase) * .07 + Math.sin(time * TAU * 1.2 + phase * 1.7 + .9) * .03;
    const lag = reduced ? 0 : Math.sin(time * TAU * .6 + phase - 1.1) * .07 + Math.sin(time * TAU * 1.2 + phase * 1.7 - .4) * .03;
    shape([[x, y, 1.54], [x + .22, y + gust * .45, 1.49 + gust * .25], [x + .43, y + gust, 1.44 + gust * .5], [x + .33, y + lag, 1.13 + lag * .5], [x, y, 1.19]], accent);
    return;
  }
  if (item.kind === 'wind-sculpture') {
    // One turn per nine seconds; far leaves draw first so the near ones cover them.
    const spin = reduced ? .6 : time * TAU / 9 + phase;
    for (let i = 0; i < 5; i++) { const a = spin + i * TAU / 5; LEAF_ORDER[i] = i; LEAF_DEPTH[i] = p.depth(x + Math.sin(a) * .44, y + Math.cos(a) * .44); }
    LEAF_ORDER.sort(byLeafDepth);
    for (const i of LEAF_ORDER) {
      const a = spin + i * TAU / 5, b = a + .45;
      shape([[x, y, 1.35], [x + Math.sin(a) * .44, y + Math.cos(a) * .44, 1.56], [x + Math.sin(b) * .36, y + Math.cos(b) * .36, 1.30]], i % 2 ? accent : M.white);
    }
    return;
  }
  const nightScale = .35 + .65 * night;
  if (item.kind === 'hanging-lights') {
    c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const px = .28 + i * (w - .56) / 4, z = 1.23 + Math.abs(px - x) * .21;
      let level = .7;
      if (!reduced) { const d = ((time * 1.6 + i * .8) % 5 + 5) % 5, near = Math.min(d, 5 - d); level = .3 + .7 * Math.max(0, 1 - near / 1.5); }
      c.globalAlpha = alpha * level * nightScale * .6;
      disc(px, y, z - .08, .15 + level * .06, .11 + level * .04, '#ffd98f');
    }
    c.restore();
    return;
  }
  if (item.kind === 'path-lamp' || item.kind === 'petal-lamp') {
    const z = item.kind === 'path-lamp' ? .65 : 1.06, pulse = reduced ? .5 : Math.sin(time * TAU / 2.4 + phase) * .5 + .5;
    c.save(); c.globalCompositeOperation = 'screen';
    c.globalAlpha = alpha * (.14 + .10 * pulse) * nightScale; disc(x, y, z, .30 + pulse * .05, .16 + pulse * .03, '#ffd98f');
    c.globalAlpha = alpha * (.28 + .14 * pulse) * nightScale; disc(x, y, z, .17, .085, '#fff1c4');
    c.restore();
    return;
  }
  if (item.kind === 'pond') {
    // Two expanding rings from near the centre, then a drifting shimmer on the water.
    const [cx, cy] = p.pt(x - .08, y + .05, .07);
    c.save(); c.strokeStyle = '#e4f3ec'; c.lineWidth = .022;
    for (let k = 0; k < 2; k++) {
      const t = reduced ? .5 : ((time / 2.6 + k * .5 + phase * .13) % 1 + 1) % 1, r = .08 + t * .55;
      c.globalAlpha = alpha * (1 - t) * .5;
      c.beginPath(); c.ellipse(cx, cy, r, r * .62, 0, 0, TAU); c.stroke();
      if (reduced) break;
    }
    if (!reduced) {
      c.globalCompositeOperation = 'screen'; c.globalAlpha = alpha * .3;
      disc(x - .12 + Math.sin(time * .37 + phase) * .25, y - .06 + Math.cos(time * .29 + phase) * .12, .075, .18, .07, '#d6ebe4');
    }
    c.restore();
  }
}

/** Shared flight phase; only the small cosmetic cable/engine effects are local. */
export function settlementDeliveryPose(state, time = state.time || 0) {
  const delivery = state.settlement?.deliveries?.[0]; if (!delivery) return null;
  const item = settlementItems(state).find(value => value.id === delivery.itemId); if (!item) return null;
  const size=settlementSize(item.kind,item.dir),target={x:item.x+size.width/2,y:item.y+size.height/2};
  const elapsed=Math.min(delivery.duration,delivery.elapsed+Math.max(0,time-(state.time||0))),t=elapsed/delivery.duration;
  const smooth=n=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
  const arrival=smooth(elapsed/2),departure=smooth((elapsed-6)/2);
  const from={x:state.pad.x+.5,y:state.pad.y+.5};
  const blend=elapsed<2?arrival:elapsed>6?1-departure:1;
  const x=from.x+(target.x-from.x)*blend,y=from.y+(target.y-from.y)*blend;
  const z=elapsed<2?2.5+3*(1-arrival):elapsed>6?2.5+3*departure:2.5;
  const crateZ=elapsed<2?z-.7:elapsed<5?z-.7-(z-.8)*smooth((elapsed-2)/3):.1;
  return {item,delivery,elapsed,t,x,y,z,crateZ,lowering:elapsed>=2&&elapsed<5,crateVisible:elapsed<SETTLEMENT.assemblySeconds};
}
export function drawSettlementDelivery(c,state,time=state.time||0,reduced=false){
  const pose=settlementDeliveryPose(state,time);if(!pose)return;
  const {x,y,z,item}=pose,size=settlementSize(item.kind,item.dir);
  const cx=item.x+size.width/2,cy=item.y+size.height/2;
  if(reduced){const [px,py]=projected(cx,cy,.15);ellipse(c,px,py,.35,.22,'#c9b985',M.gold);return;}
  const fake={kind:'worktable',x:x-1,y:y-.5,dir:1,variant:'ivory'},p=painter(c,fake);
  const [sx,sy]=projected(x,y);ellipse(c,sx,sy,.9,.45,'#3b525621');
  // This carrier is a utility cargo shuttle: white shoulders, dark belly,
  // cyan cockpit and two downward-facing lift nacelles.
  const hull=(dx,dy,hx,hy,zz,hh,color)=>{
    const temporary=painter(c,{kind:'worktable',x:x-1,y:y-.5,dir:0});temporary.box(1+dx,.5+dy,hx,hy,zz,hh,color);
  };
  hull(0,0,.72,.37,z,.18,M.white);hull(0,0,.50,.28,z-.12,.13,M.dark);
  hull(.50,0,.21,.25,z+.17,.16,M.glass);hull(-.40,0,.15,.29,z+.18,.075,M.gold);
  for(const side of[-1,1]){hull(-.08,side*.52,.44,.14,z-.04,.16,M.white);const[ex,ey]=projected(x-.05,y+side*.52,z-.13);ellipse(c,ex,ey,.15,.08,'#c4e4de');}
  if(pose.crateVisible){
    const crateX=pose.elapsed<2?x:cx,crateY=pose.elapsed<2?y:cy;
    for(const side of[-1,1])line(c,[projected(x+side*.30,y,z-.12),projected(crateX+side*.25,crateY,pose.crateZ+.4)],'#819495',.018);
    const q=painter(c,{kind:'flower-planter',x:crateX-.5,y:crateY-.5,dir:0});q.box(.5,.5,.34,.29,pose.crateZ,.40,'#d3bc8e');q.stroke([[.5,.21,pose.crateZ+.41],[.5,.79,pose.crateZ+.41]],M.white,.055);
  }
}
