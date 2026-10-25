import { createPlanet } from './planet-templates.js';
import { terrainColor } from './terrain-rules.js';


const $ = id => document.getElementById(id);
let state, selectedPlanet = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let rotationPaused = reducedMotion.matches;
function updateMotion() {
  document.body.classList.toggle('rotation-paused', rotationPaused || document.hidden);
  $('motion').textContent = rotationPaused ? 'Play rotation' : 'Pause rotation';
  $('motion').setAttribute('aria-pressed', String(rotationPaused));
}
$('motion').onclick = () => { rotationPaused = !rotationPaused; updateMotion(); };
reducedMotion.addEventListener('change', () => { rotationPaused = reducedMotion.matches; updateMotion(); });
document.addEventListener('visibilitychange', updateMotion);
updateMotion();

// A one-time painting of the existing terrain, animated only by the browser.
// This globe previews a template, never another player's saved world/progress.
function planetImage(id){
 const terrain=createPlanet(id),preview=document.createElement('canvas');preview.width=terrain.width;preview.height=terrain.height;
 const context=preview.getContext('2d');for(let y=0;y<terrain.height;y++)for(let x=0;x<terrain.width;x++){context.fillStyle=terrainColor(terrain,x,y);context.fillRect(x,y,1,1);}return preview.toDataURL();
}
function renderSelection() {
  for (const card of $('planet-list').children) {
    const selected = card.dataset.planet === selectedPlanet;
    card.classList.toggle('selected', selected);
    card.querySelector('button').setAttribute('aria-pressed', String(selected));
    const planet = state.planets.find(p => p.id === card.dataset.planet);
    card.querySelector('button').textContent = selected ? `${planet.name} selected` : `Select ${planet.name}`;
  }
  const planet = state.planets.find(p => p.id === selectedPlanet);
  $('create-panel').hidden = !planet || state.identity.kind === 'guest';
  $('register-panel').hidden = state.identity.kind !== 'guest';
  if (planet) {
    $('create').elements.template.value = planet.id;
    $('create-detail').textContent = `${planet.name} · one saved world · 1–${state.roomLimit} players including you.`;
  }
}
function renderPlanets() {
  if ($('planet-list').childElementCount) return;
  for (const planet of state.planets) {
    const card = document.createElement('article'); card.className = 'planet-card'; card.dataset.planet = planet.id;
    const visual = document.createElement('div'); visual.className = 'planet-visual'; visual.setAttribute('aria-hidden', 'true');
    const designation = document.createElement('span'); designation.className = 'planet-designation'; designation.textContent = `${planet.name.toUpperCase()} / ${planet.designation}`;
    const globe = document.createElement('div'); globe.className = 'globe';
    const surface = document.createElement('div'); surface.className = 'planet-surface'; surface.style.backgroundImage = `url(${planetImage(planet.id)})`;
    globe.append(surface); visual.append(designation, globe);
    const details = document.createElement('div'); details.className = 'planet-details';
    const label = document.createElement('p'); label.className = 'eyebrow'; label.textContent = 'GROUND / NAVAL / AIR';
    const title = document.createElement('h3'); title.textContent = planet.name;
    const description = document.createElement('p'); description.textContent = planet.description;
    const button = document.createElement('button'); button.type = 'button';
    button.onclick = () => { selectedPlanet = planet.id; renderSelection(); };
    details.append(label, title, description, button); card.append(visual, details); $('planet-list').append(card);
  }
}
async function request(action, data) {
  const res = await fetch('/api/campaigns/' + action, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error);
  return value;
}
async function refresh() {
  state = await request('list');
  $('identity').textContent = `${state.identity.name} · ${state.identity.kind === 'guest' ? 'Guest visitor' : state.identity.kind === 'demo' ? 'Demo account' : 'Email account'}`;
  renderPlanets(); renderSelection();
  $('active').hidden = !state.active; $('resume').href = '/?campaign=' + state.active;
  $('campaign-list').replaceChildren();
  for (const campaign of state.campaigns) {
    const card = document.createElement('div'); card.className = 'campaign-card';
    const name = document.createElement('strong'); name.textContent = campaign.name;
    const planetName = state.planets.find(p => p.id === campaign.template)?.name || 'Unknown planet';
    const detail = document.createElement('p'); detail.textContent = `${planetName} · ${campaign.owner ? 'Your campaign' : 'Member'} · ${campaign.open ? 'Room open' : 'Room closed'}`;
    const button = document.createElement('button'); button.textContent = campaign.owner ? 'Open / resume' : 'Join room'; button.disabled = !campaign.owner && !campaign.open;
    button.onclick = () => perform('enter', { id: campaign.id }); card.append(name, detail, button); $('campaign-list').append(card);
  }
  if (!state.campaigns.length) $('campaign-list').textContent = 'No saved campaigns yet.';
}
let busy = false;
async function perform(action, data = {}) {
  if (busy) return; busy = true;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  try {
    const result = await request(action, data);
    if (result.next && action !== 'leave') { location.assign(result.next); return; }
    $('message').textContent = action === 'create' ? 'Campaign saved. Open it when you are ready to land.' : 'Room left. Progress saved.';
  } catch (error) { $('message').textContent = error.message; }
  finally { busy = false; for (const button of document.querySelectorAll('button')) button.disabled = false; await refresh().catch(error => { $('message').textContent = error.message; }); }
}
for (const action of ['create', 'join']) $(action).onsubmit = event => { event.preventDefault(); perform(action, Object.fromEntries(new FormData(event.target))); };
$('leave').onclick = () => perform('leave');
$('refresh').onclick = () => refresh().catch(error => { $('message').textContent = error.message; });
await refresh().catch(error => { $('message').textContent = error.message; });
