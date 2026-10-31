// Per-tab presentation state only. Never store account fields, tokens, room IDs,
// form drafts or gameplay state here. Denied/full storage leaves entry usable.
import { PLANETS as CATALOGUE } from './planets.js';
const KEY = 'frontier-entry-scene-v1';
const VIEWS = new Set(['login', 'account', 'menu', 'new', 'continue', 'join']);
const PLANETS = new Set(CATALOGUE.map(p=>p.id));
const BODIES = new Set([...PLANETS, 'moon']);
const inRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function snapshot(value) {
  if (!value || !inRange(value.elapsed, 0, 1e12) || !VIEWS.has(value.view) || !PLANETS.has(value.planet)) return null;
  if (!Array.isArray(value.camera) || value.camera.length !== 3) return null;
  const camera = [];
  for (const body of value.camera) {
    if (!body || !BODIES.has(body.id) || !inRange(body.x, -2, 3) || !inRange(body.y, -2, 3) || !inRange(body.r, 0.001, 3) || !inRange(body.alpha, 0, 1)) return null;
    camera.push({ id: body.id, x: body.x, y: body.y, r: body.r, alpha: body.alpha });
  }
  const pointer = {
    x: inRange(value.pointer?.x, -.5, .5) ? value.pointer.x : 0,
    y: inRange(value.pointer?.y, -.5, .5) ? value.pointer.y : 0,
  };
  const orbitSide = value.orbitSide === 1 ? 1 : -1;
  return { version: 1, elapsed: value.elapsed, view: value.view, planet: value.planet, camera, pointer, orbitSide };
}

export function loadEntryScene() {
  try {
    const text = sessionStorage.getItem(KEY);
    if (!text || text.length > 4096) return null;
    const value = JSON.parse(text);
    return value?.version === 1 ? snapshot(value) : null;
  } catch { return null; }
}

export function saveEntryScene(value) {
  const state = snapshot(value);
  if (!state) return false;
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
