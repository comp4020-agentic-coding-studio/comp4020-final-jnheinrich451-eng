import { longitude, latitude, projectPoint, surfacePoint } from './planet.js';

export function planetUI({ state, stop, visit }) {
  const $ = id => document.getElementById(id), dialog = $('planet-dialog'), canvas = $('planet-globe'), ctx = canvas.getContext('2d');
  const texture = document.createElement('canvas'); texture.width = texture.height = 320;
  const paint = texture.getContext('2d'), pixels = paint.createImageData(320, 320);
  const palette = [[42, 91, 107], [205, 188, 137], [115, 150, 101], [113, 119, 102], [118, 137, 140]];
  let lon = 0, lat = 0, frame = 0, last = 0, pointer = null, selected = null;
  const active = () => dialog.open;
  function queue() { if (active() && !frame) frame = requestAnimationFrame(render); }
  function center(point) { const { world } = state(); lon = longitude(point.x, world.width); lat = latitude(point.y, world.height); selected = point; queue(); }
  function rotate(dx, dy) { lon += dx; lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, lat + dy)); selected = null; queue(); }
  function render() {
    frame = 0; if (!active()) return;
    last = performance.now();
    const { world, me, players, sites } = state(), floors = new Set(world.logistics?.floors || []);
    const n = 320, radius = 148, mid = n / 2, bytes = pixels.data;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const nx = (x + .5 - mid) / radius, ny = (mid - y - .5) / radius, i = (y * n + x) * 4;
      const p = surfacePoint(nx, ny, world.width, world.height, lon, lat);
      if (!p) { bytes[i + 3] = 0; continue; }
      const index = Math.floor(p.y) * world.width + Math.floor(p.x), color = palette[floors.has(index) ? 4 : world.terrain[index]] || palette[0];
      const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), light = .38 + .62 * Math.max(0, -.3 * nx + .4 * ny + .85 * z);
      for (let k = 0; k < 3; k++) bytes[i + k] = Math.min(255, color[k] * light + (1 - z) ** 4 * [9, 30, 46][k]);
      bytes[i + 3] = 255;
    }
    paint.putImageData(pixels, 0, 0);
    const size = 640, r = radius * 2, c = size / 2;
    ctx.clearRect(0, 0, size, size);
    const glow = ctx.createRadialGradient(c, c, r - 4, c, c, r + 18);
    glow.addColorStop(0, '#8fd8df99'); glow.addColorStop(1, '#8fd8df00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size); ctx.drawImage(texture, 0, 0, size, size);
    const dot = (p, color, radius = 3) => {
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return;
      const q = projectPoint(p.x, p.y, world.width, world.height, lon, lat); if (q.z <= .025) return;
      ctx.beginPath(); ctx.arc(c + q.x * r, c - q.y * r, radius, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#07151e'; ctx.lineWidth = 1.5; ctx.stroke();
    };
    // Same surveyed objectives as the tactical map; never reveal hidden enemies.
    for (const s of sites || []) dot(s, s.state === 'conquered' ? '#79caff' : '#ff707c', 4);
    for (const b of [...(world.cores || []), ...(world.airbases || []), ...(world.logistics?.shipyards || []), ...(world.logistics?.facilities || [])]) if (!b.destroyed && !b.dockDestroyed) dot(b.dock || b, '#79caff', 3.5);
    for (const p of players || []) if (p.body !== 'orbital') dot(p, '#fff2b5', 3);
    if (me) dot(me, '#ffe19a', 6);
    if (selected) dot(selected, '#ffffff', 5);
    canvas.dataset.longitude = String(lon); canvas.dataset.latitude = String(lat);
    const status = `${world.width} × ${world.height} tiles · ${(sites || []).filter(s => s.state === 'conquered').length} / ${(sites || []).length} sites conquered`;
    if ($('planet-status').textContent !== status) $('planet-status').textContent = status;
  }
  function open() {
    const { world, me } = state(); if (!world) return;
    stop(); $('planet-title').textContent = world.name || 'Caldera';
    $('planet-regions').replaceChildren(new Option('Current position', ''), ...world.regions.map(p => new Option(p.label, p.id)));
    dialog.showModal(); center(me || world.spawn); canvas.focus();
  }
  function go(point) { dialog.close(); visit(point); }
  $('planet-open').onclick = open;
  $('planet-close').onclick = () => dialog.close();
  $('planet-regions').onchange = () => center(state().world.regions.find(p => p.id === $('planet-regions').value) || state().me || state().world.spawn);
  $('planet-visit').onclick = () => go(selected || surfacePoint(0, 0, state().world.width, state().world.height, lon, lat));
  for (const b of dialog.querySelectorAll('[data-planet-turn]')) b.onclick = () => { const [dx, dy] = b.dataset.planetTurn.split(',').map(Number); rotate(dx, dy); };
  canvas.onpointerdown = e => { canvas.setPointerCapture(e.pointerId); pointer = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false }; };
  canvas.onpointermove = e => {
    if (!pointer) return;
    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 5) pointer.moved = true;
    if (pointer.moved) rotate(-(e.clientX - pointer.x) / canvas.clientWidth * 4, (e.clientY - pointer.y) / canvas.clientHeight * 3);
    pointer.x = e.clientX; pointer.y = e.clientY;
  };
  canvas.onpointerup = e => {
    if (!pointer) return; const moved = pointer.moved; pointer = null;
    if (moved) return;
    const box = canvas.getBoundingClientRect(), { world } = state();
    const p = surfacePoint((e.clientX - box.left - box.width / 2) / (box.width * 148 / 320), (box.top + box.height / 2 - e.clientY) / (box.height * 148 / 320), world.width, world.height, lon, lat);
    if (p) go(p);
  };
  canvas.onpointercancel = () => { pointer = null; };
  canvas.onkeydown = e => {
    const turns = { ArrowLeft: [-.15, 0], ArrowRight: [.15, 0], ArrowUp: [0, .12], ArrowDown: [0, -.12] };
    if (turns[e.key]) { e.preventDefault(); rotate(...turns[e.key]); }
    if (e.key === 'Enter') { e.preventDefault(); $('planet-visit').click(); }
  };
  dialog.addEventListener('close', () => { pointer = null; document.getElementById('world-canvas').focus({ preventScroll: true }); });
  return { open, active, update: () => { if (performance.now() - last > 500) queue(); } };
}
