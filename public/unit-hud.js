// Readouts drawn on the unit and the cursor instead of in screen corners. Everything
// comes from values the HUD already shows; nothing here decides health or reloads.
export const LOCATOR_MS = 3500;
const TAU = Math.PI * 2;
export const ringColor = fraction => fraction > .5 ? '#7fe0b0' : fraction > .25 ? '#f0c44c' : '#ff5e57';
export const spineLights = (fraction, count = 5) => Math.max(fraction > 0 ? 1 : 0, Math.ceil(fraction * count));

// World units, so it sits with the body. The arc's length carries the value and the
// colour only repeats it. Low health pulses unless reduced effects are on.
export function drawHealthRing(c, fraction, radius, zoom, now, reduced = false) {
  const value = Math.max(0, Math.min(1, fraction)), r = Math.max(radius, 18 / zoom);
  c.save(); c.lineCap = 'round'; c.lineWidth = 3 / zoom;
  c.strokeStyle = '#00000040'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  c.strokeStyle = ringColor(value); if (value <= .25 && !reduced) c.globalAlpha = .65 + Math.sin(now * .012) * .35;
  c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * value); c.stroke(); c.restore();
}
// The recycler's load on the ring around it: a faint track and a gold arc, in world units.
export function drawCargoRing(c, fraction, radius, zoom) {
  const value = Math.max(0, Math.min(1, fraction));
  c.save(); c.lineCap = 'round'; c.lineWidth = 3 / zoom;
  c.strokeStyle = '#f0d48a40'; c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.stroke();
  if (value > 0) { c.strokeStyle = '#f0d48a'; c.beginPath(); c.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + TAU * value); c.stroke(); }
  c.restore();
}
// Screen units around the cursor: `left` runs from 1 just after firing down to 0.
export function drawReloadArc(c, x, y, left) {
  if (left <= 0) return;
  c.save(); c.lineCap = 'round'; c.lineWidth = 3; c.strokeStyle = '#a9dcffd9';
  c.beginPath(); c.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - Math.min(1, left))); c.stroke(); c.restore();
}
// Evenly spaced points from the unit toward a target, stopping short of it.
export function locatorPoints(from, to, spacing = 46, count = 6, start = 62) {
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx), points = [];
  for (let i = 0; i < count; i++) {
    const along = start + i * spacing; if (along > distance - 16) break;
    points.push({ x: from.x + Math.cos(angle) * along, y: from.y + Math.sin(angle) * along, angle });
  }
  return points;
}
// Gold chevrons run outward along the ground, then fade: the path-finding glove,
// but as a bearing, because the enemy's own routes are not shown to the player.
export function drawLocator(c, from, to, label, age, reduced = false) {
  const points = locatorPoints(from, to), fade = Math.max(0, Math.min(1, (LOCATOR_MS - age) / 700));
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = '#f0c44c';
  points.forEach((point, i) => {
    const pulse = reduced ? 1 : Math.max(.3, 1 - Math.abs(((age / 700) % 1.4) - i * .2) * 1.6);
    c.save(); c.translate(point.x, point.y); c.rotate(point.angle); c.globalAlpha = fade * pulse; c.shadowColor = '#000a'; c.shadowBlur = 4;
    c.beginPath(); c.moveTo(-7, -10); c.lineTo(5, 0); c.lineTo(-7, 10); c.stroke(); c.restore();
  });
  const end = points.at(-1);
  if (end) {
    const side = Math.cos(end.angle) < 0 ? -1 : 1;
    c.globalAlpha = fade; c.font = '600 13px "IBM Plex Sans",sans-serif'; c.textBaseline = 'middle'; c.textAlign = side > 0 ? 'left' : 'right';
    c.lineWidth = 4; c.strokeStyle = '#000a'; c.strokeText(label, end.x + side * 18, end.y); c.fillStyle = '#f0d48a'; c.fillText(label, end.x + side * 18, end.y);
  }
  c.restore();
}
