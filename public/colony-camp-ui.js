import { AMBIENCE, decorationItems, environmentAt } from './colony-ambience.js';

const node = (tag, text, className = '') => {
  const item = document.createElement(tag); item.textContent = text; item.className = className; return item;
};

export function renderCampPanel({ body, state, owner, canAct, act, pick, focus, cinema }) {
  const items = decorationItems(state), movie = state.cinema;
  const button = (id, text, callback, disabled = false, shared = true) => {
    const b = node('button', text, 'soft-button'); b.id = id; b.type = 'button';
    if (shared) { b.dataset.colonyAction = 'camp'; b.dataset.unavailable = String(disabled); }
    b.disabled = disabled || shared && !canAct; b.onclick = callback; return b;
  };
  const build = node('div', '', 'action-pair');
  build.append(button('place-campfire', 'Place bonfire', () => pick('campfire'), items.filter(d => d.kind === 'campfire').length >= AMBIENCE.fireLimit),
    button('place-cinema', 'Place movie screen', () => pick('cinema'), items.some(d => d.kind === 'cinema')));
  body.append(build, node('p', 'Camp furnishings are free · up to 4 bonfires and 1 screen', 'keyboard-note'));
  const list = node('div', '', 'camp-items');
  for (const item of items) {
    const row = node('div', '', 'camp-item');
    row.append(button(`find-${item.id}`, item.kind === 'campfire' ? `Bonfire · ${item.lit ? 'lit' : 'unlit'}` : 'Outdoor cinema', () => focus(item), false, false));
    if (item.kind === 'campfire') row.append(button(`toggle-${item.id}`, item.lit ? 'Extinguish' : 'Light', () => act('toggle-campfire', { decorationId: item.id, revision: item.revision })));
    const remove = button(`remove-${item.id}`, 'Remove', () => act('remove-decoration', { decorationId: item.id, revision: item.revision }));
    remove.className = 'quiet-button'; row.append(remove); list.append(row);
  }
  body.append(list);
  if (items.some(d => d.kind === 'cinema')) {
    const section = node('section', '', 'camp-cinema');
    section.append(node('strong', 'Big Buck Bunny'), node('p', '', 'fine'));
    section.lastChild.id = 'cinema-progress';
    const controls = node('div', '', 'camp-movie-controls');
    controls.append(button('cinema-play', movie?.playing ? 'Pause film' : 'Play film', () => act(movie?.playing ? 'cinema-pause' : 'cinema-play', { revision: movie?.revision ?? 0 })),
      button('cinema-restart', 'Restart', () => act('cinema-restart', { revision: movie?.revision ?? 0 })),
      button('cinema-sound', cinema.getStatus().muted ? 'Sound on' : 'Mute', async () => {
        if (cinema.getStatus().muted) await cinema.enableAudio(); else cinema.setMuted(true);
        updateCinemaStatus(cinema);
      }, false, false));
    section.append(controls, node('p', '', 'keyboard-note'));
    section.lastChild.id = 'cinema-status';
    const credits = node('details', '', 'camp-credits'); credits.append(node('summary', 'Film credits'));
    credits.append(node('p', 'Big Buck Bunny · © 2008 Blender Foundation. The complete ending credits are retained.', 'fine'));
    for (const [text, href] of [['Official movie', 'https://peach.blender.org/'], ['CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/']]) {
      const link = node('a', text); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; credits.append(link);
    }
    section.append(credits); body.append(section);
  }
  const environment = environmentAt(state);
  const sky = node('details', '', 'camp-sky'); sky.id = 'camp-sky';
  sky.append(node('summary', owner ? 'Atmosphere · shared with your crew' : 'Atmosphere · set by the host'));
  sky.append(node('p', 'Natural follows the expedition clock. Choose a scene to enjoy together.', 'keyboard-note'));
  const selectors = node('div', '', 'action-pair');
  for (const [key, title, values, current] of [
    ['lighting', 'Light', ['natural', 'sunrise', 'day', 'sunset', 'night'], environment.lightingPreset],
    ['weather', 'Weather', ['natural', 'clear', 'cloudy', 'rain'], environment.weatherPreset],
  ]) {
    const label = node('label', title, 'fine'), select = document.createElement('select');
    select.id = `camp-${key}`; select.dataset.campHost = 'true'; select.disabled = !owner || !canAct;
    for (const value of values) { const option = node('option', value[0].toUpperCase() + value.slice(1)); option.value = value; select.append(option); }
    select.value = current || 'natural'; select.onchange = () => act('set-environment', { [key]: select.value });
    label.append(select); selectors.append(label);
  }
  sky.append(selectors); body.append(sky); updateCinemaStatus(cinema);
}

export function updateCinemaStatus(cinema) {
  const status = cinema.getStatus(), sound = document.getElementById('cinema-sound'), message = document.getElementById('cinema-status');
  if (sound) sound.textContent = status.muted ? 'Sound on' : 'Mute';
  if (message) message.textContent = status.error ? 'The film could not load. Reopen the expedition to retry.'
    : status.blocked ? 'Press Sound on to allow playback in this browser.' : 'Shared film · sound is just for you';
}
