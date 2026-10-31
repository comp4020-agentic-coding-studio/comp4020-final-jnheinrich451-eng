import { DROP } from './entry-ship.js';
import { PLANETS } from './planets.js';
const $ = id => document.getElementById(id);
// Fictional setting data only. Saved template IDs come from the server.
const survey = {
  'sirocco-v1': [['Radius', '5,760 km'], ['Mass', '4.38 × 10²⁴ kg'], ['Sector position', '+06.1 / −01.2 / +00.4 ly'], ['Atmosphere', 'N₂ 76% · O₂ 19% · Ar 4% · dust traces 1%']],
  'caldera-v1': [['Radius', '6,180 km'], ['Mass', '5.14 × 10²⁴ kg'], ['Sector position', '+04.8 / −02.1 / +00.6 ly'], ['Atmosphere', 'N₂ 78% · O₂ 18% · Ar 3% · traces 1%']],
  'vesper-v1': [['Radius', '7,020 km'], ['Mass', '6.72 × 10²⁴ kg'], ['Sector position', '+05.2 / −01.7 / +00.8 ly'], ['Atmosphere', 'N₂ 72% · O₂ 20% · CO₂ 6% · Ar 2%']],
};
const views = ['menu', 'new', 'continue', 'join'];
const initialRoute = locationView();
let state, view = views.includes(initialRoute.view) ? initialRoute.view : 'menu';
let selectedPlanet = PLANETS.some(p => p.id === initialRoute.planet) ? initialRoute.planet : 'caldera-v1';
let chosen = false, busy = false, refreshVersion = 0, pendingDelete = null, messageTimer;
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
  if ($('destination').hidden) return;
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
function locationView() { const params = new URLSearchParams(location.hash.slice(1)); return { view: params.get('view'), planet: params.get('planet') }; }
function saveLocation(replace = false) {
  const hash = new URLSearchParams({ view, planet: selectedPlanet });
  history[replace ? 'replaceState' : 'pushState']({ frontierEntry: true }, '', `${location.pathname}${location.search}#${hash}`);
}
function showView(next, { replace = false, historyChange = true, focus = true, clearMessage = true } = {}) {
  if (!state) return;
  view = state.identity.kind === 'guest' ? 'join' : views.includes(next) ? next : 'menu';
  pendingDelete = null;
  if (view !== 'new') chosen = false;
  if (clearMessage) message();
  if (historyChange) saveLocation(replace);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) $(view === 'menu' ? 'menu-heading' : view === 'join' ? 'join-heading' : view === 'continue' ? 'saves-heading' : 'planet-heading').focus({ preventScroll: true });
}
function changePlanet(direction) {
  if (busy || !state) return;
  const index = state.planets.findIndex(p => p.id === selectedPlanet);
  selectedPlanet = state.planets[(index + direction + state.planets.length) % state.planets.length].id;
  chosen = false; pendingDelete = null; saveLocation(true); render();
  // Optional presentation hint. Navigation and forms work without the canvas.
  document.dispatchEvent(new CustomEvent('frontier:planet-select', { detail: { planet: selectedPlanet, direction } }));
}
function render() {
  if (!state) return;
  const guest = state.identity.kind === 'guest';
  const planet = state.planets.find(p => p.id === selectedPlanet) || state.planets[0]; selectedPlanet = planet.id;
  const owned = state.campaigns.filter(c => c.owner).length;
  document.body.dataset.entryView = view; document.body.dataset.entryPlanet = planet.id;
  document.title = `${view === 'menu' ? 'Orbital command' : view === 'new' ? 'New Game' : view === 'continue' ? 'Continue' : 'Join'} · Frontier`;
  $('lobby').setAttribute('aria-busy', String(busy));
  $('identity').textContent = `${state.identity.name} · ${guest ? 'Guest visitor' : state.identity.kind === 'demo' ? 'Demo account' : 'Email account'}`;
  for (const name of views) $(name + '-view').hidden = name !== view;
  $('view-label').textContent = { menu: 'ORBITAL COMMAND', new: 'NEW GAME / SELECT DESTINATION', continue: 'CONTINUE / SAVED WORLDS', join: 'JOIN / INVITATION' }[view];
  $('back').hidden = view === 'menu' || guest;
  // Continue owns the current-room controls. Guests only have Join, so their
  // existing visit must remain reachable there.
  $('active').hidden = !state.active || (view !== 'continue' && !guest); $('resume').href = '/?campaign=' + encodeURIComponent(state.active || '');
  const active = state.campaigns.find(c => c.id === state.active);
  $('leave-help').textContent = active?.owner ? 'Leaving saves this world and returns your teammates to the menu.' : 'Leave this room before entering another. Your contributions stay in its world.';
  $('guest-help').hidden = !guest;
  $('destination').hidden = !['new', 'continue'].includes(view);
  $('planet-heading').textContent = planet.name; $('designation').textContent = planet.designation; $('planet-description').textContent = planet.description;
  $('planet-facts').replaceChildren(...(survey[planet.id] || []).map(([label, value]) => {
    const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
    term.textContent = label; detail.textContent = value; row.append(term, detail); return row;
  }));
  $('select-planet').textContent = chosen ? `${planet.name} selected` : `Select ${planet.name}`;
  $('select-planet').setAttribute('aria-pressed', String(chosen));
  $('create-panel').hidden = view !== 'new' || !chosen || guest; $('create').elements.template.value = planet.id;
  $('create-detail').textContent = `${planet.name} · 1–${state.roomLimit} players · saved automatically`;
  $('create-room-help').hidden = !state.active;
  $('save-limit').textContent = owned >= 3 ? 'All three owned save slots are in use. Continue an existing campaign.' : `${owned} / 3 owned saves used across all planets.`;
  $('owned-count').textContent = `${owned} / 3 owned saves · joined campaigns do not use your slots.`;
  for (const button of document.querySelectorAll('#lobby button')) button.disabled = busy;
  $('select-planet').disabled = busy || chosen || owned >= 3;
  $('create-submit').disabled = busy || guest || owned >= 3 || !!state.active;
  $('join-submit').disabled = busy || !!state.active;
  $('new-game').disabled = busy || guest; $('continue-game').disabled = busy || guest;
  renderCampaigns();
  syncDestinationLayout();
}
function renderCampaigns() {
  if (!state.campaigns.some(c => c.id === pendingDelete && c.owner && c.canDelete)) pendingDelete = null;
  const cards = state.campaigns.filter(c => c.template === selectedPlanet).map(campaign => {
    const card = document.createElement('article'); card.className = 'campaign-card'; card.dataset.campaignId = campaign.id;
    const text = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('p'), button = document.createElement('button');
    name.textContent = campaign.name;
    const roomStatus = campaign.open ? 'Room open' : campaign.owner && campaign.canDelete === false ? 'Room reconnecting or saving' : 'Room closed';
    detail.textContent = `${campaign.owner ? 'Your campaign' : 'Member'} · ${roomStatus}${state.active && state.active !== campaign.id ? ' · leave current room first' : ''}`;
    button.textContent = state.active === campaign.id ? 'Return' : 'Enter'; button.setAttribute('aria-label', `${button.textContent} ${campaign.name}`);
    button.disabled = busy || (!campaign.owner && !campaign.open) || (!!state.active && state.active !== campaign.id);
    button.onclick = () => perform('enter', { id: campaign.id });
    const actions = document.createElement('div'); actions.className = 'campaign-actions'; actions.append(button);
    if (campaign.owner) {
      const remove = document.createElement('button'); remove.className = 'delete-campaign text-button'; remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${campaign.name}`); remove.disabled = busy || !campaign.canDelete;
      if (!campaign.canDelete) remove.title = 'Save and leave this room, then wait for it to finish saving.';
      remove.onclick = () => { pendingDelete = campaign.id; renderCampaigns(); document.querySelector('.delete-cancel')?.focus(); };
      actions.append(remove);
    }
    text.append(name, detail); card.append(text, actions);
    if (pendingDelete === campaign.id) {
      const confirmation = document.createElement('div'); confirmation.className = 'delete-confirmation';
      confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', `Delete ${campaign.name}?`);
      const warning = document.createElement('p'); warning.textContent = `Delete “${campaign.name}” and its progress for everyone? This cannot be undone.`;
      const cancel = document.createElement('button'); cancel.className = 'delete-cancel text-button'; cancel.textContent = 'Cancel'; cancel.disabled = busy;
      cancel.onclick = cancelDelete;
      const confirm = document.createElement('button'); confirm.className = 'delete-confirm text-button'; confirm.textContent = 'Delete save'; confirm.disabled = busy;
      confirm.onclick = () => perform('delete', { id: campaign.id, confirm: true });
      confirmation.append(warning, cancel, confirm); card.append(confirmation);
    }
    return card;
  });
  if (!cards.length) { const empty = document.createElement('p'); empty.className = 'empty-saves'; empty.textContent = `No saved campaigns on ${state.planets.find(p => p.id === selectedPlanet).name} yet. Choose another planet or start a new game.`; cards.push(empty); }
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
// The dive is cosmetic. The pod only leaves once the server has admitted the player,
// and a stopped animation (hidden tab, no canvas) can never hold up entry.
function startDive() {
  const body = document.body, hint = $('dive-skip'), started = performance.now();
  const animated = body.dataset.sceneReady === 'canvas' && !body.classList.contains('entry-motion-paused');
  let skipped = false, goDark = null;
  const skip = event => { if (event.repeat || event.isComposing) return; skipped = true; goDark?.(); };
  const stop = () => { removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); hint.hidden = true; };
  if (animated) {
    body.classList.add('entry-diving'); hint.hidden = false;
    addEventListener('pointerdown', skip, true); addEventListener('keydown', skip, true);
    document.dispatchEvent(new CustomEvent('frontier:drop-start'));
  }
  return {
    cancel() { stop(); body.classList.remove('entry-diving'); document.dispatchEvent(new CustomEvent('frontier:drop-cancel')); },
    land: () => new Promise(resolve => {
      let dark = false, limit = 0;
      goDark = () => {
        if (dark) return;
        dark = true; clearTimeout(limit); stop();
        body.classList.toggle('entry-fast', skipped); body.classList.add('entry-dark');
        setTimeout(resolve, !animated ? 120 : skipped ? 450 : 1000);
      };
      document.dispatchEvent(new CustomEvent('frontier:drop-accept'));
      if (!animated || skipped) { goDark(); return; }
      limit = setTimeout(goDark, Math.max(0, DROP.total + 1500 - (performance.now() - started)));
      document.addEventListener('frontier:drop-dark', goDark, { once: true });
    }),
  };
}
async function perform(action, data = {}) {
  if (busy) return;
  const dive = action === 'create' || (action === 'enter' && data.id !== state.active) ? startDive() : null;
  busy = true; ++refreshVersion; render(); message('Connecting…');
  let created = false, navigating = false;
  try {
    let result = await request(action, data);
    if (action === 'create') {
      // A save now exists: an enter failure must not repeat creation.
      created = true; selectedPlanet = data.template; chosen = false; message('Campaign saved. Establishing uplink…');
      result = await request('enter', { id: result.id });
    }
    if (result.next && action !== 'leave') { navigating = true; await dive?.land(); location.assign(result.next); return; }
    await refresh();
    if (action === 'leave') { showView('continue', { clearMessage: false }); message('Room left. Progress saved.'); }
    if (action === 'delete') { pendingDelete = null; message('Save deleted. Slot available.'); $('saves-heading').focus({ preventScroll: true }); }
  } catch (error) {
    dive?.cancel();
    if (created) { showView('continue', { clearMessage: false }); message(`Your campaign was saved. ${error.message} Use Enter below to retry.`, true); await refresh().catch(() => {}); }
    else { if (action === 'delete') await refresh().catch(() => {}); message(error.message || 'Connection interrupted. Please try again.', true); }
  } finally {
    busy = false;
    if (!navigating) {
      render();
      if (!$('message').classList.contains('error')) message($('message').textContent);
    }
  }
}
function back() { if (!busy && view !== 'menu' && state?.identity.kind !== 'guest') showView('menu'); }
$('back').onclick = back;
$('new-game').onclick = () => showView('new');
$('continue-game').onclick = () => { if (!state.campaigns.some(c => c.template === selectedPlanet) && state.campaigns.length) selectedPlanet = state.campaigns[0].template; showView('continue'); };
$('create-room-continue').onclick = () => { if (busy) return; selectedPlanet = state.campaigns.find(c => c.id === state.active)?.template || selectedPlanet; showView('continue'); };
$('join-game').onclick = () => showView('join'); $('empty-new').onclick = () => showView('new');
$('planet-prev').onclick = () => changePlanet(-1); $('planet-next').onclick = () => changePlanet(1);
$('select-planet').onclick = () => { if (busy) return; chosen = true; render(); $('campaign-name').focus(); };
for (const action of ['create', 'join']) $(action).onsubmit = event => { event.preventDefault(); if (!$(action + '-submit').disabled) void perform(action, Object.fromEntries(new FormData(event.target))); };
$('leave').onclick = () => perform('leave');
$('refresh').onclick = () => refresh().then(() => message('Room list updated.')).catch(error => message(error.message, true));
// Observe only the content above the destination, avoiding a feedback loop
// when the globe's geometry changes the height of the destination itself.
const layoutObserver = new ResizeObserver(syncDestinationLayout);
for (const element of document.querySelectorAll('.entry-header, .view-top, #active')) layoutObserver.observe(element);
window.addEventListener('resize', syncDestinationLayout);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); if (pendingDelete) cancelDelete(); else back(); } });
window.addEventListener('popstate', () => { if (busy) return; const route = locationView(); if (state?.planets.some(p => p.id === route.planet)) selectedPlanet = route.planet; showView(route.view, { historyChange: false }); });
window.addEventListener('focus', () => { if (state && !busy) void refresh().catch(error => message(error.message, true)); });
// Browser Back may restore the disabled outgoing DOM from its page cache.
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  busy = false;
  document.body.classList.remove('entry-diving', 'entry-dark', 'entry-fast'); $('dive-skip').hidden = true;
  document.dispatchEvent(new CustomEvent('frontier:drop-reset'));
  void refresh().catch(error => { render(); message(error.message, true); });
});
try {
  await refresh();
  if (state && !(state.identity.kind === 'guest' && location.pathname === '/' && !state.active)) {
    const route = locationView(); if (state.planets.some(p => p.id === route.planet)) selectedPlanet = route.planet;
    showView(route.view, { replace: true, focus: false });
    try { if (sessionStorage.getItem('frontier-entry-login') === '1') { sessionStorage.removeItem('frontier-entry-login'); document.body.classList.add('signal-arrival'); setTimeout(() => document.body.classList.remove('signal-arrival'), 300); } } catch { /* Cosmetic cue only; storage is optional. */ }
  }
} catch (error) { message(error.message || 'Could not reach command. Reload to retry.', true); $('signin').hidden = false; $('lobby').setAttribute('aria-busy', 'false'); }
