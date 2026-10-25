import { gunPosition, RAIL, isMAC, macCharging } from './rail.js';
import { MAC } from './weapons.js';
import { turnTurret } from './turret.js';
import { isCurve, isCompact, railPorts, CURVES, curveEnds } from './track.js';
import { POD } from './pod.js';

// Purely cosmetic: accepted rails retain their existing immediate availability.
// The saved cargo clock prevents a new descent when a spectator joins/reloads.
export function drawRailDelivery(c,p,time,tile,cargo,reduced,rails) {
  if(p.layout==='rail-crate'){
    const rail=rails.find(r=>r.x===p.x&&r.y===p.y&&r.shape===p.shape);if(!rail)return;
    const reveal=Math.max(0,Math.min(1,(time-POD.unfold)/.5));
    if(time>=POD.impact){c.save();c.translate(p.x*tile,p.y*tile);cargo.metal(c,1,1);c.restore();}
    if(reveal>0){c.save();c.globalAlpha=reveal;drawRail(c,rail,tile);c.restore();}
    if(reveal<1){
      const fall=time<POD.impact?1-Math.min(1,time/POD.impact)**2:0;
      c.save();c.translate((p.x+.5)*tile,(p.y+.5)*tile);c.globalAlpha=1-reveal;
      if(!reduced){c.translate(fall*5*tile,-fall*9*tile);c.scale(1+fall*.3,1+fall*.3);}
      c.scale(1/3,1/3);cargo.box(c,Math.max(0,time-POD.impact));c.restore();
    }
    const age=time-POD.impact;
    if(!reduced&&age>=0&&age<.5){c.save();c.translate((p.x+.5)*tile,(p.y+.5)*tile);cargo.dust(c,0,0,age,.5,8,4,1);c.restore();}
    return;
  }
  const smooth=n=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
  const progress=[1,...[0,1].map(i=>Math.sin(smooth((time-POD.unfold-i*POD.panelDuration)/POD.panelDuration)*Math.PI/2))];
  if(time>=POD.impact){
    for(const offset of [0,-1,1,-2,2]){
      const stage=Math.abs(offset),fraction=progress[stage];if(fraction<=0)continue;
      const x=p.x+(p.shape==='EW'?offset:0),y=p.y+(p.shape==='NS'?offset:0);
      const rail=rails.find(r=>r.x===x&&r.y===y);if(!rail)continue;
      c.save();
      // Hinges pivot at the edge nearest the centre, opening both sides together.
      const horizontal=p.shape==='EW',positive=offset>0;
      const hx=(x+(horizontal&&!positive&&offset!==0?1:0))*tile;
      const hy=(y+(!horizontal&&!positive&&offset!==0?1:0))*tile;
      c.translate(hx,hy);c.scale(horizontal?fraction:1,horizontal?1:fraction);c.translate(-hx,-hy);
      c.save();c.translate(x*tile,y*tile);cargo.metal(c,1,1);c.restore();drawRail(c,rail,tile);
      c.restore();
    }
  }
  const open=smooth((time-POD.unfold)/POD.panelDuration);
  if(open<1){
    const fall=time<POD.impact?1-Math.min(1,time/POD.impact)**2:0;
    c.save();c.translate((p.x+.5)*tile,(p.y+.5)*tile);c.globalAlpha=1-open;
    if(!reduced){c.translate(fall*5*tile,-fall*9*tile);c.scale(1+fall*.3,1+fall*.3);}
    c.scale(1/3,1/3);cargo.box(c,Math.max(0,time-POD.impact));c.restore();
  }
  if(!reduced)for(const at of [POD.impact,POD.unfold+POD.panelDuration,POD.unfold+2*POD.panelDuration]){
    const age=time-at;if(age>=0&&age<.5){c.save();c.translate((p.x+.5)*tile,(p.y+.5)*tile);cargo.dust(c,0,0,age,.5,8,4,1);c.restore();}
  }
}

export function drawSwitch(c, rail, state, locked, tile, zoom) {
  const [a] = curveEnds(rail), color = locked ? '#f0ad77' : '#a4e5d0';
  c.save(); c.strokeStyle = color; c.lineWidth = 2 / zoom;
  c.beginPath();
  if (state.route === 'curve') c.arc((rail.x + .5) * tile, (rail.y + .5) * tile, tile * 3, CURVES[rail.shape], CURVES[rail.shape] + Math.PI / 2);
  else { c.moveTo((a.x + .5 - a.dx) * tile, (a.y + .5 - a.dy) * tile); c.lineTo((a.x + .5 + a.dx * 2) * tile, (a.y + .5 + a.dy * 2) * tile); }
  c.stroke();
  const x = (rail.x + .5) * tile, y = (rail.y + .5) * tile, size = 5 / zoom;
  c.fillStyle = '#19352e'; c.fillRect(x - size, y - size, size * 2, size * 2); c.strokeRect(x - size, y - size, size * 2, size * 2);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + size * .7, y - (state.route === 'curve' ? size * .7 : 0)); c.stroke();
  if (zoom >= .2) { c.font = `${10 / zoom}px monospace`; c.textAlign = 'center'; const text = locked ? 'LOCKED' : state.route.toUpperCase(); const width = c.measureText(text).width; c.fillStyle = '#19352ee6'; c.fillRect(x - width / 2 - 3, y + size + 2, width + 6, 14 / zoom); c.fillStyle = color; c.fillText(text, x, y + size + 12 / zoom); }
  c.restore();
}

export function drawRail(c, rail, tile, ghost = false) {
  if (isCompact(rail)) {
    c.save(); c.translate((rail.x + .5) * tile, (rail.y + .5) * tile); c.globalAlpha = ghost ? .5 : 1;
    c.beginPath(); c.rect(-tile / 2, -tile / 2, tile, tile); c.clip();
    const ends = { N: [0, -tile / 2], E: [tile / 2, 0], S: [0, tile / 2], W: [-tile / 2, 0] }, ports = [...railPorts(rail)];
    const path = () => { c.beginPath(); if (rail.shape === 'J') { c.moveTo(-tile / 2, 0); c.lineTo(tile / 2, 0); c.moveTo(0, -tile / 2); c.lineTo(0, tile / 2); }
      else { c.moveTo(...ends[ports[0]]); c.quadraticCurveTo(0, 0, ...ends[ports[1]]); } };
    for (const [color, width] of [['#605f4c', 32], ['#b6bab0', 26], ['#243b3e', 21], ['#655e48', 16]]) { path(); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
    if (rail.shape === 'J') { c.fillStyle = '#a4e5d0'; c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill(); }
    c.restore(); return;
  }
  if (isCurve(rail)) {
    c.save(); c.translate((rail.x + .5) * tile, (rail.y + .5) * tile); c.globalAlpha = ghost ? .5 : 1;
    const start = CURVES[rail.shape], radius = tile * 3;
    c.strokeStyle = '#605f4c80'; c.lineWidth = 32; c.beginPath(); c.arc(0, 0, radius, start, start + Math.PI / 2); c.stroke();
    for (let i = 0; i <= 18; i++) { c.save(); c.rotate(start + i / 18 * Math.PI / 2); c.translate(radius, 0); c.fillStyle = '#4c4739'; c.fillRect(-19, -2.5, 38, 5); c.restore(); }
    for (const offset of [-11, 11]) { c.strokeStyle = '#243b3e'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, radius + offset, start, start + Math.PI / 2); c.stroke(); c.strokeStyle = '#b6bab0'; c.lineWidth = 2; c.stroke(); }
    c.restore(); return;
  }
  c.save(); c.translate((rail.x + .5) * tile, (rail.y + .5) * tile); if (rail.shape === 'NS') c.rotate(Math.PI / 2);
  c.globalAlpha = ghost ? .5 : 1;
  c.fillStyle = '#605f4c80'; c.fillRect(-tile / 2, -16, tile, 32);
  for (let x = -20; x <= 20; x += 10) { c.fillStyle = '#4c4739'; c.fillRect(x, -19, 5, 38); c.fillStyle = '#a2a095'; c.fillRect(x + 1, -14, 2, 3); c.fillRect(x + 1, 12, 2, 3); }
  for (const y of [-11, 11]) { c.fillStyle = '#243b3e'; c.fillRect(-tile / 2, y - 2, tile, 5); c.fillStyle = '#b6bab0'; c.fillRect(-tile / 2, y - 2, tile, 2); }
  c.restore();
}
export function drawRailGun(c, gun, tile, elapsed, recoil = 0, selected = false, reduced = false) {
  const p = gunPosition(gun, elapsed), braced = gun.move ? 0 : 1 - Math.min(1, gun.brace / RAIL.braceTime);
  c.save(); c.translate(p.x * tile, p.y * tile);
  if (selected) { c.strokeStyle = '#f2d39a'; c.lineWidth = 2; c.strokeRect(-1.5 * tile, -1.5 * tile, 3 * tile, 3 * tile); }
  c.scale(tile / 48, tile / 48);
  c.fillStyle = '#162c3444'; c.fillRect(-56, -49, 116, 102);
  c.save(); c.rotate(p.chassis ?? (gun.shape === 'NS' ? Math.PI / 2 : 0));
  // Rail bogies and an armored carriage; stabilizers still follow brace state.
  for (const x of [-40, 40]) {
    c.fillStyle = '#1c3033'; c.fillRect(x - 13, -38, 26, 76);
    for (const y of [-29, -12, 12, 29]) {
      c.fillStyle = '#8c9b91'; c.fillRect(x - 11, y - 4, 22, 8);
      c.fillStyle = '#344a48'; c.fillRect(x - 7, y - 3, 14, 6);
    }
  }
  c.fillStyle = '#536562'; c.fillRect(-58, -32, 116, 64);
  c.strokeStyle = '#aebca5'; c.lineWidth = 2; c.strokeRect(-54, -28, 108, 56);
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const px = x * (46 + braced * 18), py = y * (37 + braced * 25);
    c.strokeStyle = '#253b3e'; c.lineWidth = 10; c.beginPath(); c.moveTo(x * 37, y * 24); c.lineTo(px, py); c.stroke();
    c.strokeStyle = '#899c92'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#d3bd84'; c.fillRect(px - 6, py - 5, 12, 10);
    c.fillStyle = '#4c605a'; c.fillRect(px - 3, py - 2, 6, 4);
  }
  for (const x of [-47, 38]) for (let y = -19; y <= 19; y += 6) {
    c.fillStyle = '#263e3e'; c.fillRect(x, y, 9, 3);
  }
  c.restore();
  c.fillStyle = '#2b4142'; c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#9aa98f'; c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 12; i++) {
    c.save(); c.rotate(i * Math.PI / 6); c.fillStyle = '#d2c294'; c.fillRect(-2, 29, 4, 3); c.restore();
  }
  c.rotate(turnTurret(gun.angle, gun.aim, macCharging(gun)?0:elapsed, RAIL.turnSpeed));
  if(isMAC(gun)){
    drawMACMount(c,gun,elapsed,recoil,reduced);c.restore();return;
  }
  // Revised sketch: 1.7x barrel reach, larger bore, two gently tapered sections.
  // Modest foreshortening keeps the silhouette legible at the high ballistic arc.
  c.save(); c.scale(1, .7 + .3 * Math.cos((gun.elevation ?? RAIL.defaultElevation) * Math.PI / 180));
  c.translate(0, recoil * 2);
  c.fillStyle = '#536b68'; c.strokeStyle = '#b7c5b2'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-19,-10); c.lineTo(-12,-114); c.lineTo(12,-114); c.lineTo(19,-10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#9dad9f';
  c.beginPath(); c.moveTo(-11,-114); c.lineTo(-9,-216); c.lineTo(9,-216); c.lineTo(11,-114); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#506964'; c.beginPath(); c.moveTo(5,-115); c.lineTo(5,-215); c.lineTo(8,-215); c.lineTo(10,-115); c.closePath(); c.fill();
  c.fillStyle = '#1d3337'; c.fillRect(-9,-216,18,3);
  c.strokeStyle = '#d2d7bf'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-13,-29); c.lineTo(-8,-110); c.moveTo(-7,-117); c.lineTo(-6,-211); c.stroke();
  c.fillStyle = '#2c4244'; c.fillRect(-20,-22,40,8);
  c.fillStyle = '#a8b7a3'; c.fillRect(-19,-22,38,3);
  c.restore();
  c.fillStyle = '#b6ab85'; c.beginPath(); c.moveTo(-18, -18); c.lineTo(18, -18); c.lineTo(28, 1); c.lineTo(24, 25); c.lineTo(15, 30); c.lineTo(-15, 30); c.lineTo(-24, 25); c.lineTo(-28, 1); c.closePath(); c.fill();
  c.strokeStyle = '#ead49e'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#817e64'; c.fillRect(-16, -12, 32, 27);
  c.fillStyle = '#d4c591'; c.fillRect(-11, -9, 22, 19);
  c.fillStyle = '#455d58'; c.fillRect(-18, 18, 12, 6); c.fillRect(6, 18, 12, 6);
  c.fillStyle = gun.operator ? '#9ee2d2' : '#526660'; c.fillRect(-4, 21, 8, 4);
  c.restore();
}
function macGear(c,x,y,r,phase,teeth=12){
  c.save();c.translate(x,y);c.rotate(phase);
  c.fillStyle='#526a68';c.strokeStyle='#b8c9b9';c.lineWidth=1.5;
  c.beginPath();
  for(let i=0;i<teeth*4;i++){
    const a=i*Math.PI*2/(teeth*4),radius=i%4===1||i%4===2?r:r-2.8;
    const px=Math.cos(a)*radius,py=Math.sin(a)*radius;
    if(i)c.lineTo(px,py);else c.moveTo(px,py);
  }
  c.closePath();c.fill();c.stroke();
  c.fillStyle='#203b40';c.beginPath();c.arc(0,0,r*.64,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle='#8ea9a3';c.lineWidth=2;
  for(let i=0;i<4;i++){c.rotate(Math.PI/2);c.beginPath();c.moveTo(3,0);c.lineTo(r*.6,0);c.stroke();}
  c.fillStyle='#c1cbb4';c.beginPath();c.arc(0,0,2.5,0,Math.PI*2);c.fill();c.restore();
}
function drawMACMount(c,gun,elapsed,recoil,reduced){
  const left=Math.max(0,(gun.reload||0)-elapsed),charging=left>MAC.cooldown;
  const power=charging?Math.max(0,Math.min(1,1-(left-MAC.cooldown)/MAC.charge)):0;
  // Cosmetic clock stays continuous between server snapshots; reduced effects freeze it.
  const rotation=reduced?0:performance.now()*.00055;
  c.save();c.translate(0,recoil);
  // Armoured cable loop and exposed drive gears sit outside the breech block.
  c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(27,10);c.bezierCurveTo(52,10,52,-8,46,-24);c.bezierCurveTo(55,-42,44,-57,25,-54);
  c.strokeStyle='#183035';c.lineWidth=8;c.stroke();
  c.strokeStyle='#85998b';c.lineWidth=4;c.stroke();
  c.strokeStyle='#344f50';c.lineWidth=1.5;c.stroke();
  for(const [x,y,a] of [[42,3,.6],[48,-9,0],[48,-34,-.3]]){
    c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#b2b9a0';c.fillRect(-4,-2,8,4);c.restore();
  }
  macGear(c,29,-45,16,rotation);
  macGear(c,41,-22,10,-rotation*1.6,10);
  // Twin parallel rails with inboard teeth, matching the author's second sketch.
  for(const side of [-1,1]){
    c.fillStyle='#607b79';c.strokeStyle='#b5c6b5';c.lineWidth=2;
    c.beginPath();c.moveTo(side*8,-28);c.lineTo(side*9,-151);c.lineTo(side*20,-151);c.lineTo(side*22,-28);c.closePath();c.fill();c.stroke();
    for(let y=-141;y<-38;y+=15){c.fillStyle='#233e43';c.fillRect(side<0?-14:8,y,6,7);}
    c.fillStyle=charging?'#9cf0ee':'#527a7b';c.globalAlpha=charging?.35+.65*power:1;
    c.fillRect(side<0?-18:14,-148,3,113);c.globalAlpha=1;
  }
  // Two metal collars at the muzzle, retaining the original rail length and gap.
  for(const y of [-149,-139]){
    c.fillStyle='#718980';c.strokeStyle='#cad4bd';c.lineWidth=1.5;
    c.beginPath();c.ellipse(0,y,23,4,0,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#203c40';c.beginPath();c.ellipse(0,y-1,18,1.8,0,0,Math.PI*2);c.fill();
    for(const side of [-1,1]){c.fillStyle='#d1d6bc';c.fillRect(side*20-1,y-1,2,3);}
  }
  // Rectangular coupling block ahead of the radiator, with a recessed rotating ring.
  c.fillStyle='#476260';c.strokeStyle='#b7c6b2';c.lineWidth=2;
  c.fillRect(-27,-64,54,32);c.strokeRect(-27,-64,54,32);
  c.fillStyle='#90a799';c.fillRect(-25,-62,50,3);
  c.fillStyle='#263f42';c.fillRect(-23,-38,46,5);
  c.fillStyle='#142f35';c.fillRect(-18,-57,36,16);
  c.strokeStyle='#79968e';c.lineWidth=1;c.strokeRect(-18,-57,36,16);
  c.save();c.translate(0,-49);c.scale(1,.48);macGear(c,0,0,15,-rotation,16);c.restore();
  for(const x of [-22,22])for(const y of [-58,-42]){c.fillStyle='#c1cbb3';c.fillRect(x-1,y-1,2,2);}
  c.fillStyle='#536963';c.strokeStyle='#c0c8aa';c.lineWidth=2;
  c.beginPath();c.moveTo(-28,-35);c.lineTo(28,-35);c.lineTo(33,24);c.lineTo(24,35);c.lineTo(-24,35);c.lineTo(-33,24);c.closePath();c.fill();c.stroke();
  c.fillStyle='#263e42';c.fillRect(-23,-26,46,47);
  for(let i=0;i<7;i++){
    c.fillStyle=charging&&i<=power*7?'#9ee6da':left>0&&!charging?'#bb8d62':'#8d9e91';
    c.fillRect(-20+i*6,-23,3,40);c.fillStyle='#23393d';c.fillRect(-20+i*6,8,3,3);
  }
  c.strokeStyle='#809b99';c.strokeRect(-25,-28,50,51);
  c.fillStyle=gun.operator?'#a6eddf':'#667c70';c.fillRect(-7,27,14,4);
  if(charging&&!reduced){c.globalAlpha=power*.5;c.strokeStyle='#cbffff';c.lineWidth=1+power*2;c.beginPath();c.moveTo(-8,-40);c.lineTo(7,-57);c.lineTo(-7,-79);c.lineTo(7,-107);c.stroke();}
  c.restore();
}
export function drawSalvos(c, salvos, tile, elapsed, reduced) {
  for (const s of salvos || []) {
    if(s.kind==='mac')continue; // Charge belongs to the mount; fast trace uses shots.
    if(s.kind==='jet-burst')continue; // Ground impacts only; no per-bullet trail.
    if(s.kind==='heli-rocket'){
      const t=Math.min(1,(s.elapsed+elapsed)/s.duration),prior=Math.max(0,t-.22),dx=s.targetX-s.x,dy=s.targetY-s.y;
      c.save();c.strokeStyle='#d8c5a380';c.lineWidth=2;c.beginPath();c.moveTo((s.x+dx*prior)*tile,(s.y+dy*prior)*tile);c.lineTo((s.x+dx*t)*tile,(s.y+dy*t)*tile);c.stroke();c.translate((s.x+dx*t)*tile,(s.y+dy*t)*tile);c.rotate(Math.atan2(dy,dx));c.fillStyle='#ffb45b';c.fillRect(-tile*.25,-tile*.04,tile*.2,tile*.08);c.fillStyle='#ded6b5';c.fillRect(-tile*.08,-tile*.055,tile*.22,tile*.11);c.restore();continue;
    }
    if(s.kind==='strafe'){
      const t=Math.min(1,(s.elapsed+elapsed)/s.duration),before=Math.max(0,t-.18);
      c.save();c.strokeStyle='#ffe4a3';c.lineWidth=2;c.beginPath();c.moveTo((s.x+(s.targetX-s.x)*before)*tile,(s.y+(s.targetY-s.y)*before)*tile);c.lineTo((s.x+(s.targetX-s.x)*t)*tile,(s.y+(s.targetY-s.y)*t)*tile);c.stroke();c.restore();continue;
    }
    const t = Math.min(1, (s.elapsed + elapsed) / s.duration), groundX = (s.x + (s.targetX - s.x) * t) * tile, groundY = (s.y + (s.targetY - s.y) * t) * tile;
    const seconds = t * s.duration, priorSeconds = Math.max(0, seconds - .08), priorT = priorSeconds / s.duration;
    const altitude = at => s.gravity ? Math.max(0, s.verticalSpeed * at - .5 * s.gravity * at * at) : Math.sin(at / s.duration * Math.PI) * 16;
    const lift = reduced ? 0 : altitude(seconds) * tile * .12;
    c.save(); c.fillStyle = '#172e3544'; c.beginPath(); c.ellipse(groundX, groundY, 8, 4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = s.weapon === 'GAS' ? '#d5eea5' : s.weapon === 'INCENDIARY' ? '#ff9a49' : '#ffe2a7'; c.lineWidth = 3; c.beginPath(); c.moveTo((s.x + (s.targetX - s.x) * priorT) * tile, (s.y + (s.targetY - s.y) * priorT) * tile - (reduced ? 0 : altitude(priorSeconds) * tile * .12)); c.lineTo(groundX, groundY - lift); c.stroke();
    c.fillStyle = '#fff1c5'; c.beginPath(); c.arc(groundX, groundY - lift, 4, 0, Math.PI * 2); c.fill(); c.restore();
  }
}
