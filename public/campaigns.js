import { DROP } from './entry-ship.js';
import { COLONY_ENTRY } from './colony-entry-ship.js';
import { PLANETS } from './planets.js';
import { COLONY_PLANETS, colonyPlanetById, colonySavePlanetId } from './colony-planets.js';
const $ = id => document.getElementById(id);
// Fictional setting data only. Saved template IDs come from the server.
const survey = {
  'sirocco-v1': [['Radius', '5,760 km'], ['Mass', '4.38 × 10²⁴ kg'], ['Sector position', '+06.1 / −01.2 / +00.4 ly'], ['Atmosphere', 'N₂ 76% · O₂ 19% · Ar 4% · dust traces 1%']],
  'caldera-v1': [['Radius', '6,180 km'], ['Mass', '5.14 × 10²⁴ kg'], ['Sector position', '+04.8 / −02.1 / +00.6 ly'], ['Atmosphere', 'N₂ 78% · O₂ 18% · Ar 3% · traces 1%']],
  'vesper-v1': [['Radius', '7,020 km'], ['Mass', '6.72 × 10²⁴ kg'], ['Sector position', '+05.2 / −01.7 / +00.8 ly'], ['Atmosphere', 'N₂ 72% · O₂ 20% · CO₂ 6% · Ar 2%']],
};
const views = ['menu', 'colony', 'new', 'continue', 'join'];
const colonyDescriptions = {
  'caldera-v1': 'A peaceful garden district with soft meadows and a sparkling shoreline. Plant a little joy, help your friends and send your first harvest to the stars.',
  'vesper-v1': 'A quiet valley with cool water and gentle woodland colors. A fresh expedition is ready to grow a home, one happy harvest at a time.',
  'sirocco-v1': 'Warm sands, sheltered growing beds and a turquoise oasis. Your condenser keeps the garden watered while you discover a softer side of Sirocco.',
};
const initialRoute = locationView();
let state, view = views.includes(initialRoute.view) ? initialRoute.view : 'menu';
let selectedMode = initialRoute.mode === 'colonization' || initialRoute.view === 'colony' ? 'colonization' : 'combat';
let selectedPlanet = destinationForMode(initialRoute.planet, selectedMode);
let displayedPlanet = selectedPlanet, pendingPlanetTravel = null, planetRequestSequence = 0;
let chosen = false, busy = false, refreshVersion = 0, pendingDelete = null, messageTimer, activeArrival = null;
const modeOf = campaign => campaign?.mode === 'colonization' ? 'colonization' : 'combat';
function availablePlanets() {
  if (selectedMode !== 'colonization') return state?.planets || PLANETS;
  return COLONY_PLANETS;
}
function destinationForMode(id, mode) {
  if (mode === 'colonization') return colonySavePlanetId(id);
  return PLANETS.some(planet => planet.id === id) ? id : PLANETS[0].id;
}
function selectBranch(mode, next) {
  if (busy || !state) return;
  clearPlanetTravel();
  const previousMode = selectedMode, previousView = view;
  if (previousMode !== mode) document.dispatchEvent(new CustomEvent('frontier:system-transition', { detail: { from: previousMode, to: mode } }));
  selectedMode = mode;
  const saves = state.campaigns.filter(c => modeOf(c) === mode);
  // Starting a new browse from the civilian hub always begins at Morrow. A
  // save on an old combat template must never redirect the visible destination.
  if (mode === 'colonization' && ((previousMode !== mode && next === 'colony') || (previousView === 'colony' && ['new', 'continue'].includes(next)))) selectedPlanet = COLONY_PLANETS[0].id;
  else if (mode !== 'colonization' && next === 'continue' && !saves.some(c => c.template === selectedPlanet) && saves.length) selectedPlanet = saves[0].template;
  view = next;
  if (!availablePlanets().some(p => p.id === selectedPlanet)) selectedPlanet = availablePlanets()[0].id;
  showView(next);
}
function message(text = '', error = false) {
  clearTimeout(messageTimer);
  $('message').textContent = text; $('message').classList.toggle('error', error);
  // Routine feedback floats briefly; errors remain readable until the next
  // action. Neither kind participates in the planet/form layout.
  if (text && !error && !busy) messageTimer = setTimeout(() => { $('message').textContent = ''; }, 5000);
}
// The notices above the destination are real document content. Share their
// measured origin with the canvas instead of assuming a fixed header height.
function syncDestinationLayout() {
  if ($('destination').hidden || pendingPlanetTravel) return;
  const documentTop = element => element.getBoundingClientRect().top + scrollY;
  const origin = documentTop($('destination'));
  const baseline = documentTop(document.querySelector('.view-top')) + document.querySelector('.view-top').getBoundingClientRect().height;
  const values = { '--entry-content-top': origin, '--entry-lobby-top': documentTop($('lobby')), '--entry-notice-offset': origin - baseline };
  let changed = false;
  for (const [name, value] of Object.entries(values)) {
    const next = value + 'px';
    if (document.body.style.getPropertyValue(name) !== next) { document.body.style.setProperty(name, next); changed = true; }
  }
  if (changed) document.dispatchEvent(new CustomEvent('frontier:entry-layout'));
}
function locationView() { const params = new URLSearchParams(location.hash.slice(1)); return { view: params.get('view'), planet: params.get('planet'), mode: params.get('mode') }; }
function saveLocation(replace = false) {
  const hash = new URLSearchParams({ view, planet: selectedPlanet });
  if (selectedMode === 'colonization') hash.set('mode', selectedMode);
  history[replace ? 'replaceState' : 'pushState']({ frontierEntry: true }, '', `${location.pathname}${location.search}#${hash}`);
}
function showView(next, { replace = false, historyChange = true, focus = true, clearMessage = true } = {}) {
  if (!state) return;
  clearPlanetTravel();
  view = state.identity.kind === 'guest' ? 'join' : views.includes(next) ? next : 'menu';
  if (!availablePlanets().some(p => p.id === selectedPlanet)) selectedPlanet = availablePlanets()[0].id;
  pendingDelete = null;
  if (view !== 'new') chosen = false;
  if (clearMessage) message();
  if (historyChange) saveLocation(replace);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) $(view === 'menu' ? 'menu-heading' : view === 'colony' ? 'colony-heading' : view === 'join' ? 'join-heading' : view === 'continue' ? 'saves-heading' : 'planet-heading').focus({ preventScroll: true });
}
function changePlanet(direction) {
  if (busy || !state) return;
  const planets = availablePlanets(), index = planets.findIndex(p => p.id === selectedPlanet);
  selectedPlanet = planets[(index + direction + planets.length) % planets.length].id;
  const request = { planet: selectedPlanet, requestId: ++planetRequestSequence, mode: selectedMode, view, started: false };
  pendingPlanetTravel = request; saveLocation(true); render();
  // The scene acknowledges an animated voyage synchronously. With reduced
  // motion, unavailable canvas or no scene listener, navigation remains immediate.
  document.dispatchEvent(new CustomEvent('frontier:planet-select', { detail: { planet: selectedPlanet, direction, requestId: request.requestId } }));
  if (pendingPlanetTravel === request && !request.started) commitPlanetTravel(request);
}
function clearPlanetTravel() {
  pendingPlanetTravel = null;
  if (displayedPlanet !== selectedPlanet) { chosen = false; pendingDelete = null; }
  displayedPlanet = selectedPlanet;
}
function matchesPlanetTravel(detail) {
  return pendingPlanetTravel && detail?.requestId === pendingPlanetTravel.requestId && detail.planet === pendingPlanetTravel.planet &&
    detail.mode === pendingPlanetTravel.mode && detail.view === pendingPlanetTravel.view && selectedMode === detail.mode && view === detail.view && selectedPlanet === detail.planet;
}
function commitPlanetTravel(request, defer = false) {
  if (pendingPlanetTravel !== request) return;
  pendingPlanetTravel = null;
  if (displayedPlanet !== selectedPlanet) { chosen = false; pendingDelete = null; }
  displayedPlanet = selectedPlanet;
  if (defer) queueMicrotask(() => render()); else render();
}
document.addEventListener('frontier:planet-travel-start', event => {
  if (matchesPlanetTravel(event.detail)) pendingPlanetTravel.started = true;
});
document.addEventListener('frontier:planet-travel-end', event => {
  if (matchesPlanetTravel(event.detail) && ['arrived', 'settled', 'cancelled'].includes(event.detail.reason)) commitPlanetTravel(pendingPlanetTravel, true);
});
function changeMode(mode) {
  if (busy || !state || mode === selectedMode) return;
  clearPlanetTravel();
  selectedMode = mode; chosen = false; selectedPlanet = availablePlanets()[0].id; saveLocation(true); render();
}
function render() {
  if (!state) return;
  const guest = state.identity.kind === 'guest';
  const planets = availablePlanets(), target = planets.find(p => p.id === selectedPlanet) || planets[0]; selectedPlanet = target.id;
  if (pendingPlanetTravel && (pendingPlanetTravel.planet !== selectedPlanet || pendingPlanetTravel.mode !== selectedMode || pendingPlanetTravel.view !== view)) clearPlanetTravel();
  if (!pendingPlanetTravel) displayedPlanet = selectedPlanet;
  const planet = planets.find(p => p.id === displayedPlanet) || target;
  const travelling = !!pendingPlanetTravel;
  const owned = state.campaigns.filter(c => c.owner).length;
  const peaceful = selectedMode === 'colonization';
  document.body.dataset.entryView = view; document.body.dataset.entryPlanet = selectedPlanet; document.body.dataset.entryMode = selectedMode;
  document.body.dataset.entryDisplayedPlanet = planet.id;
  if (travelling) { document.body.dataset.entryPlanetPending = selectedPlanet; document.body.dataset.entryPlanetRequest = String(pendingPlanetTravel.requestId); }
  else { delete document.body.dataset.entryPlanetPending; delete document.body.dataset.entryPlanetRequest; }
  document.title = `${view === 'menu' ? 'Orbital command' : view === 'colony' ? 'Colonization' : view === 'new' ? peaceful ? 'New expedition' : 'New Game' : view === 'continue' ? 'Continue' : 'Join'} · Frontier`;
  $('lobby').setAttribute('aria-busy', String(busy));
  $('identity').textContent = `${state.identity.name} · ${guest ? 'Guest visitor' : state.identity.kind === 'demo' ? 'Demo account' : 'Email account'}`;
  for (const name of views) $(name + '-view').hidden = name !== view;
  $('view-label').textContent = { menu: 'ORBITAL COMMAND', colony: 'MYCORRHIZAL / CIVILIAN EXPEDITIONS', new: peaceful ? 'NEW EXPEDITION / SELECT DESTINATION' : 'NEW GAME / SELECT DESTINATION', continue: peaceful ? 'CONTINUE / SAVED EXPEDITIONS' : 'CONTINUE / SAVED WORLDS', join: 'JOIN / INVITATION' }[view];
  $('back').hidden = view === 'menu' || view === 'colony' || guest;
  $('mode-picker').hidden = true;
  $('mode-combat').setAttribute('aria-pressed', String(!peaceful));
  $('mode-colonization').setAttribute('aria-pressed', String(peaceful));
  $('menu-motto').textContent = peaceful ? 'GROW / CARE / CONNECT' : 'ESTABLISH / DEFEND / CONQUER';
  $('entry-mode-caption').textContent = peaceful ? 'FRONTIER / PEACEFUL EXPEDITIONS' : 'FRONTIER / DEEP SPACE OPERATIONS';
  // Continue owns the current-room controls. Guests only have Join, so their
  // existing visit must remain reachable there.
  $('active').hidden = !state.active || (!['continue', 'colony'].includes(view) && !guest);
  $('resume').href = (state.activeMode === 'colonization' ? '/colony/' : '/') + '?campaign=' + encodeURIComponent(state.active || '');
  $('resume').textContent = state.activeMode === 'colonization' ? 'Return to your garden' : 'Return to battlefield';
  const active = state.campaigns.find(c => c.id === state.active);
  $('leave-help').textContent = active?.owner ? 'Leaving saves this world and returns your teammates to the menu.' : 'Leave this room before entering another. Your contributions stay in its world.';
  $('guest-help').hidden = !guest;
  $('destination').hidden = !['new', 'continue'].includes(view);
  $('planet-heading').textContent = planet.name; $('designation').textContent = planet.designation;
  $('planet-description').textContent = peaceful ? colonyPlanetById(planet.id)?.description || colonyDescriptions[planet.id] : planet.description;
  $('planet-status').textContent = peaceful ? '✿ PEACEFUL EXPEDITION' : '● HOSTILE';
  const facts = colonyPlanetById(planet.id) ? [['Radius', planet.radius], ['Mass', planet.mass], ['Sector position', planet.position], ['Atmosphere', planet.atmosphere]] : survey[planet.id] || [];
  $('planet-facts').replaceChildren(...facts.map(([label, value]) => {
    const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
    term.textContent = label; detail.textContent = value; row.append(term, detail); return row;
  }));
  $('select-planet').textContent = chosen ? `${planet.name} selected` : `Select ${planet.name}`;
  $('select-planet').setAttribute('aria-pressed', String(chosen));
  $('create-panel').hidden = view !== 'new' || !chosen || guest; $('create').elements.template.value = planet.id;
  $('create').elements.mode.value = selectedMode;
  $('create-heading').textContent = peaceful ? 'Name your expedition' : 'Name your campaign';
  $('campaign-name').placeholder = peaceful ? 'Meadowlight' : 'Operation First Light';
  $('create-detail').textContent = `${planet.name} · ${peaceful ? 'peaceful gardening · ' : ''}1–${state.roomLimit} players · saved automatically`;
  $('create-room-help').hidden = !state.active;
  $('save-limit').textContent = owned >= 3 ? 'All three owned save slots are in use. Continue or delete a closed save.' : `${owned} / 3 owned saves used across all planets and modes.`;
  $('owned-count').textContent = `${owned} / 3 owned saves · joined campaigns do not use your slots.`;
  $('saves-heading').textContent = peaceful ? 'Saved expeditions' : 'Save slots';
  $('save-kind').textContent = peaceful ? 'PEACEFUL EXPEDITIONS' : 'PERSISTENT CAMPAIGNS';
  $('empty-new').textContent = peaceful ? 'New expedition ↗' : 'New Game ↗';
  $('join-heading').textContent = peaceful ? 'Join an expedition.' : 'Join a frontier.';
  for (const button of document.querySelectorAll('#lobby button')) button.disabled = busy;
  $('select-planet').disabled = busy || travelling || chosen || owned >= 3;
  $('create-submit').disabled = busy || travelling || guest || owned >= 3 || !!state.active;
  $('campaign-name').disabled = busy || travelling;
  $('join-submit').disabled = busy || !!state.active;
  for (const id of ['new-game', 'continue-game', 'colonization-game', 'new-expedition', 'continue-expedition', 'war-zone']) $(id).disabled = busy || guest;
  renderCampaigns();
  syncDestinationLayout();
}
function renderCampaigns() {
  if (!state.campaigns.some(c => c.id === pendingDelete && c.owner && c.canDelete)) pendingDelete = null;
  const cards = state.campaigns.filter(c => modeOf(c) === selectedMode && (selectedMode === 'colonization' ? colonySavePlanetId(c.template) : c.template) === displayedPlanet).map(campaign => {
    const card = document.createElement('article'); card.className = 'campaign-card'; card.dataset.campaignId = campaign.id;
    const text = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('p'), button = document.createElement('button');
    name.textContent = campaign.name;
    const roomStatus = campaign.open ? 'Room open' : campaign.owner && campaign.canDelete === false ? 'Room reconnecting or saving' : 'Room closed';
    detail.textContent = `${campaign.mode === 'colonization' ? 'Colonization' : 'Combat'} · ${campaign.owner ? 'Your save' : 'Member'} · ${roomStatus}${state.active && state.active !== campaign.id ? ' · leave current room first' : ''}`;
    if (selectedMode === 'colonization' && !colonyPlanetById(campaign.template)) {
      const original = PLANETS.find(planet => planet.id === campaign.template)?.name || 'original world';
      detail.textContent += ` · Legacy ${original} garden`;
    }
    button.textContent = state.active === campaign.id ? 'Return' : 'Enter'; button.setAttribute('aria-label', `${button.textContent} ${campaign.name}`);
    button.disabled = busy || !!pendingPlanetTravel || (!campaign.owner && !campaign.open) || (!!state.active && state.active !== campaign.id);
    button.onclick = () => perform('enter', { id: campaign.id });
    const actions = document.createElement('div'); actions.className = 'campaign-actions'; actions.append(button);
    if (campaign.owner) {
      const remove = document.createElement('button'); remove.className = 'delete-campaign text-button'; remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${campaign.name}`); remove.disabled = busy || !!pendingPlanetTravel || !campaign.canDelete;
      if (!campaign.canDelete) remove.title = 'Save and leave this room, then wait for it to finish saving.';
      remove.onclick = () => { if (busy || pendingPlanetTravel) return; pendingDelete = campaign.id; renderCampaigns(); document.querySelector('.delete-cancel')?.focus(); };
      actions.append(remove);
    }
    text.append(name, detail); card.append(text, actions);
    if (pendingDelete === campaign.id) {
      const confirmation = document.createElement('div'); confirmation.className = 'delete-confirmation';
      confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', `Delete ${campaign.name}?`);
      const warning = document.createElement('p'); warning.textContent = `Delete “${campaign.name}” and its progress for everyone? This cannot be undone.`;
      const cancel = document.createElement('button'); cancel.className = 'delete-cancel text-button'; cancel.textContent = 'Cancel'; cancel.disabled = busy;
      cancel.onclick = cancelDelete;
      const confirm = document.createElement('button'); confirm.className = 'delete-confirm text-button'; confirm.textContent = 'Delete save'; confirm.disabled = busy || !!pendingPlanetTravel;
      confirm.onclick = () => perform('delete', { id: campaign.id, confirm: true });
      confirmation.append(warning, cancel, confirm); card.append(confirmation);
    }
    return card;
  });
  if (!cards.length) { const empty = document.createElement('p'); empty.className = 'empty-saves'; empty.textContent = `No saved ${selectedMode === 'colonization' ? 'expeditions' : 'campaigns'} on ${availablePlanets().find(p => p.id === displayedPlanet)?.name || 'this world'} yet. Choose another planet or start a new ${selectedMode === 'colonization' ? 'expedition' : 'game'}.`; cards.push(empty); }
  $('campaign-list').replaceChildren(...cards);
}
function cancelDelete() {
  if (busy) return;
  const id = pendingDelete; pendingDelete = null; renderCampaigns();
  [...document.querySelectorAll('.campaign-card')].find(card => card.dataset.campaignId === id)?.querySelector('.delete-campaign')?.focus();
}
async function request(action, data) {
  const response = await fetch('/api/campaigns/' + action, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const value = await response.json();
  if (!response.ok) { if (response.status === 401) $('signin').hidden = false; throw new Error(value.error || 'Command unavailable. Please try again.'); }
  return value;
}
async function refresh() {
  const version = ++refreshVersion, result = await request('list'); if (version !== refreshVersion) return;
  state = result;
  if (state.identity.kind === 'guest' && location.pathname === '/' && !state.active) { location.replace('/login/'); return; }
  if (state.identity.kind === 'guest') view = 'join'; render();
}
// The arrival is cosmetic. The craft only leaves once the server has admitted the player,
// and a stopped animation (hidden tab, no canvas) can never hold up entry.
function startDive(civilian = false) {
  const body = document.body, hint = $('dive-skip'), started = performance.now();
  const animated = body.dataset.sceneReady === 'canvas' && !body.classList.contains('entry-motion-paused') && (!civilian || body.dataset.entryColonyShip === 'ready');
  let skipped = false, cancelled = false, goDark = null, limit = 0, finish = 0, settle = null;
  const skip = event => { if (event.repeat || event.isComposing) return; skipped = true; goDark?.(); };
  const stop = () => { removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); hint.hidden = true; };
  if (animated) {
    body.classList.add('entry-diving'); hint.hidden = false;
    addEventListener('pointerdown', skip, true); addEventListener('keydown', skip, true);
    document.dispatchEvent(new CustomEvent('frontier:drop-start'));
  }
  return {
    cancel() {
      cancelled = true; clearTimeout(limit); clearTimeout(finish); stop();
      if (goDark) document.removeEventListener('frontier:drop-dark', goDark);
      body.classList.remove('entry-diving', 'entry-dark', 'entry-fast');
      document.dispatchEvent(new CustomEvent('frontier:drop-cancel')); settle?.(false);
    },
    land: () => new Promise(resolve => {
      if (cancelled) { resolve(false); return; }
      settle = resolve;
      let dark = false;
      goDark = () => {
        if (dark) return;
        dark = true; clearTimeout(limit); stop();
        document.removeEventListener('frontier:drop-dark', goDark);
        body.classList.toggle('entry-fast', skipped); body.classList.add('entry-dark');
        finish = setTimeout(() => resolve(true), !animated ? 120 : skipped ? 450 : 1000);
      };
      document.dispatchEvent(new CustomEvent('frontier:drop-accept'));
      if (!animated || skipped) { goDark(); return; }
      // Allow the complete post-admission flight even after a slow server reply.
      const timing = civilian ? COLONY_ENTRY : DROP;
      limit = setTimeout(goDark, Math.max(timing.total - timing.zoom + 1500, timing.total + 1500 - (performance.now() - started)));
      document.addEventListener('frontier:drop-dark', goDark, { once: true });
    }),
  };
}
async function perform(action, data = {}) {
  if (busy || (pendingPlanetTravel && ['create', 'enter', 'delete'].includes(action))) return;
  const targetMode = action === 'create' ? data.mode : modeOf(state.campaigns.find(c => c.id === data.id));
  const dive = action === 'create' || (action === 'enter' && data.id !== state.active) ? startDive(targetMode === 'colonization') : null;
  activeArrival = dive;
  busy = true; ++refreshVersion; render(); message('Connecting…');
  let created = false, navigating = false;
  try {
    let result = await request(action, data);
    if (action === 'create') {
      // A save now exists: an enter failure must not repeat creation.
      created = true; selectedPlanet = data.template; chosen = false; message('Campaign saved. Establishing uplink…');
      result = await request('enter', { id: result.id });
    }
    if (result.next && action !== 'leave') { navigating = true; if (await dive?.land() === false) { navigating = false; return; } location.assign(result.next); return; }
    await refresh();
    if (action === 'leave') { showView('continue', { clearMessage: false }); message('Room left. Progress saved.'); }
    if (action === 'delete') { pendingDelete = null; message('Save deleted. Slot available.'); $('saves-heading').focus({ preventScroll: true }); }
  } catch (error) {
    dive?.cancel();
    if (created) { showView('continue', { clearMessage: false }); message(`Your campaign was saved. ${error.message} Use Enter below to retry.`, true); await refresh().catch(() => {}); }
    else { if (action === 'delete') await refresh().catch(() => {}); message(error.message || 'Connection interrupted. Please try again.', true); }
  } finally {
    if (activeArrival === dive) activeArrival = null;
    busy = false;
    if (!navigating) {
      render();
      if (!$('message').classList.contains('error')) message($('message').textContent);
    }
  }
}
function back() { if (!busy && view !== 'menu' && state?.identity.kind !== 'guest') { if (selectedMode === 'colonization' && view !== 'colony') showView('colony'); else selectBranch('combat', 'menu'); } }
$('back').onclick = back;
$('new-game').onclick = () => selectBranch('combat', 'new');
$('colonization-game').onclick = () => selectBranch('colonization', 'colony');
$('war-zone').onclick = () => selectBranch('combat', 'menu');
$('new-expedition').onclick = () => selectBranch('colonization', 'new');
$('continue-expedition').onclick = () => selectBranch('colonization', 'continue');
$('join-expedition').onclick = () => selectBranch('colonization', 'join');
$('mode-combat').onclick = () => changeMode('combat');
$('mode-colonization').onclick = () => changeMode('colonization');
$('continue-game').onclick = () => selectBranch('combat', 'continue');
$('create-room-continue').onclick = () => { if (busy) return; const active = state.campaigns.find(c => c.id === state.active), mode = state.activeMode || modeOf(active); selectedPlanet = mode === 'colonization' ? colonySavePlanetId(active?.template) : active?.template || selectedPlanet; selectBranch(mode, 'continue'); };
$('join-game').onclick = () => selectBranch('combat', 'join'); $('empty-new').onclick = () => selectBranch(selectedMode, 'new');
$('planet-prev').onclick = () => changePlanet(-1); $('planet-next').onclick = () => changePlanet(1);
$('select-planet').onclick = () => { if (busy || pendingPlanetTravel) return; chosen = true; render(); $('campaign-name').focus(); };
for (const action of ['create', 'join']) $(action).onsubmit = event => { event.preventDefault(); if (!$(action + '-submit').disabled) void perform(action, Object.fromEntries(new FormData(event.target))); };
$('leave').onclick = () => perform('leave');
$('refresh').onclick = () => refresh().then(() => message('Room list updated.')).catch(error => message(error.message, true));
// Observe only the content above the destination, avoiding a feedback loop
// when the globe's geometry changes the height of the destination itself.
const layoutObserver = new ResizeObserver(syncDestinationLayout);
for (const element of document.querySelectorAll('.entry-header, .view-top, #active')) layoutObserver.observe(element);
window.addEventListener('resize', syncDestinationLayout);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); if (pendingDelete) cancelDelete(); else back(); } });
window.addEventListener('popstate', () => { if (busy) return; const route = locationView(); selectedMode = route.mode === 'colonization' || route.view === 'colony' ? 'colonization' : 'combat'; selectedPlanet = destinationForMode(route.planet, selectedMode); showView(route.view, { historyChange: false }); });
window.addEventListener('focus', () => { if (state && !busy) void refresh().catch(error => message(error.message, true)); });
// Browser Back may restore the disabled outgoing DOM from its page cache.
window.addEventListener('pagehide', () => { activeArrival?.cancel(); activeArrival = null; clearPlanetTravel(); });
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  busy = false;
  clearPlanetTravel();
  document.body.classList.remove('entry-diving', 'entry-dark', 'entry-fast'); $('dive-skip').hidden = true;
  document.dispatchEvent(new CustomEvent('frontier:drop-reset'));
  if (state) render();
  void refresh().catch(error => { render(); message(error.message, true); });
});
try {
  await refresh();
  if (state && !(state.identity.kind === 'guest' && location.pathname === '/' && !state.active)) {
    const route = locationView(); selectedPlanet = destinationForMode(route.planet, selectedMode);
    showView(route.view, { replace: true, focus: false });
    try { if (sessionStorage.getItem('frontier-entry-login') === '1') { sessionStorage.removeItem('frontier-entry-login'); document.body.classList.add('signal-arrival'); setTimeout(() => document.body.classList.remove('signal-arrival'), 300); } } catch { /* Cosmetic cue only; storage is optional. */ }
  }
} catch (error) { message(error.message || 'Could not reach command. Reload to retry.', true); $('signin').hidden = false; $('lobby').setAttribute('aria-busy', 'false'); }
