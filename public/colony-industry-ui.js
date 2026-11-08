import { INDUSTRY, INDUSTRY_ITEMS, industryItems, industryStatus, industryStored, loadChoice, nextIndustryDirection, reachableCrates } from './colony-industry.js';

export const INDUSTRY_DIRECTIONS = ['↑ North', '→ East', '↓ South', '← West'];
const node = (tag, text, className = '') => {
  const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
};
const itemName = id => INDUSTRY_ITEMS.find(item => item.id === id)?.name || id;
const total = values => Object.values(values || {}).reduce((sum, value) => sum + value, 0);
const cargoWords = (values, empty) => Object.entries(values || {}).filter(([, count]) => count > 0).map(([id, count]) => `${count} ${itemName(id)}`).join(', ') || empty;
const livePanels = new WeakMap();
const icons = {
  belt: '<rect x="3" y="8" width="26" height="16" rx="4"/><path d="M8 9v14M14 9v14M20 9v14M26 9v14M12 4h9m-3-3 3 3-3 3"/>',
  outlet: '<path d="M4 4h12v12H4zM10 4v12M4 10h12M16 10h8v12M19 18l5 5 5-5M20 27h8"/><path d="M7 7h6M7 13h6"/>',
  processor: '<rect x="5" y="7" width="22" height="22" rx="3"/><path d="M9 7V3h14v4M5 21H1M27 21h4M9 26h14M16 10v3m0 10v-3m-6-4h3m10 0h-3"/><circle cx="16" cy="16" r="4"/>',
  generator: '<rect x="5" y="5" width="22" height="24" rx="4"/><path d="M9 1v4M23 1v4M10 26h12M17 8l-5 9h5l-2 7 7-11h-6z"/>',
  collector: '<rect x="4" y="16" width="24" height="12" rx="3"/><path d="M10 16v-4h12v4M16 12V5l9-3M25 2l3 4M10 22h12"/><circle cx="16" cy="5" r="1.5"/>',
  warehouse: '<path d="M3 13l13-8 13 8v15H3z"/><path d="M7 28V17h7v11M18 28v-7h7v7M7 22h7M11 17v11"/>'
};
const descriptions = {
  belt: 'Carries one item · no power needed',
  outlet: 'Beside a bed · harvests when powered',
  processor: 'Any crop → provisions + biomass',
  generator: 'Biomass or crops → shared power',
  collector: 'Gathers crates within 7 tiles · 1 power each',
  warehouse: 'Shows your reserve · its drone fetches crates'
};

// One card, three lines: the status word, what the machine holds, and what it needs next.
// Everything a player can set is a plain button; the server chooses recipes and fuel.
function holdingLine(state, machine) {
  if (machine.kind === 'belt') return machine.item ? `Carrying ${itemName(machine.item)}` : 'Nothing on the belt';
  if (machine.kind === 'generator') return `${Math.ceil(machine.fuelEnergy || 0)} power left in the burner · ${cargoWords(machine.input, 'no fuel')} waiting`;
  if (machine.kind === 'processor') return `${cargoWords(machine.input, 'no crops')} in · ${machine.job ? `cooking ${itemName(machine.job.crop)} · ` : ''}${cargoWords(machine.output, 'nothing')} out`;
  if (machine.kind === 'collector') { const crates = reachableCrates(state, machine).length + (machine.task ? 1 : 0); return `${crates} crate${crates === 1 ? '' : 's'} in reach`; }
  if (machine.kind === 'warehouse') { const products = ['sundrop', 'moonberry', 'cloudmelon', 'provisions', 'biomass'].reduce((sum, id) => sum + industryStored(state, id), 0); return `${state.materials} materials in the yard · ${products} product${products === 1 ? '' : 's'} on the shelves`; }
  const bed = state.beds.find(item => item.id === machine.bedId);
  return bed ? `Bed ${state.beds.indexOf(bed) + 1} · ${cargoWords(machine.output, 'nothing')} waiting` : 'No bed attached';
}
const hints = {
  'Needs fuel': 'Load a crop or biomass, or belt biomass into its IN side.',
  'Needs crops': 'Load crops, or belt a harvest into its IN side.',
  'Needs power': 'Fuel a generator.',
  'Output full': 'The belt or machine on its OUT side is full, or the reserve is.',
  'Plant the attached bed': 'Plant the bed beside it.',
  'Waiting for space': 'The next tile is occupied.',
  'Waiting for crates': 'Crates land beside the pad when the shuttle returns.'
};
const hintLine = (state, machine) => hints[industryStatus(state, machine)] || '';
const loadLabel = choice => choice ? `Load ${choice.amount} ${itemName(choice.item)}` : 'Load';

// Rounded progress values keep the inspector stable between server ticks.
export function industryPanelKey(state) {
  return [Math.floor(state.industry?.energy || 0), state.industry?.storage, industryItems(state).map(machine => [
    machine.id, machine.revision, machine.dir, machine.enabled, machine.input, machine.output, machine.item,
    machine.job && [machine.job.crop, Math.floor(machine.job.elapsed), machine.job.seconds], machine.task?.crateId,
    Math.floor(machine.fuelEnergy || 0), industryStatus(state, machine)
  ])];
}

// Live readouts and command availability follow the host without rebuilding the card,
// so a pressed or focused button is never replaced under the player's finger.
export function updateIndustryLivePanel({ body, state, selectedId, canAct }) {
  const view = livePanels.get(body);
  if (view?.selectedId === selectedId) view.update(state, canAct);
}

export function renderIndustryPanel({ body, state, selectedId, canAct, act, pick, inspect, showShipment }) {
  const items = industryItems(state);
  let machine = items.find(item => item.id === selectedId);
  body.dataset.industrySelected = String(selectedId);
  livePanels.delete(body);
  const button = (id, label, callback, unavailable = false, shared = true, css = 'soft-button') => {
    const el = node('button', label, css); el.id = id; el.type = 'button';
    if (shared) { el.dataset.colonyAction = 'industry'; el.dataset.unavailable = String(unavailable); }
    el.disabled = unavailable || shared && !canAct; el.onclick = callback; return el;
  };
  const power = node('div', '', 'industry-power'); power.id = 'industry-power';
  power.append(node('span', 'Shared power'), node('strong', `${Math.floor(state.industry?.energy || 0)} / ${INDUSTRY.energyCapacity}`));
  body.append(power);
  if (!machine) {
    const catalog = node('div', '', 'industry-catalog');
    for (const [kind, config] of Object.entries(INDUSTRY.kinds)) {
      if (config.hidden) continue;
      const count = items.filter(item => item.kind === kind).length;
      const unavailable = state.materials < config.cost || count >= config.limit;
      const build = button(`place-industry-${kind}`, '', () => pick(kind), unavailable, true, 'industry-build');
      const art = node('span', '', 'industry-icon'); art.setAttribute('aria-hidden', 'true');
      art.innerHTML = `<svg viewBox="0 0 32 32">${icons[kind] || ''}</svg>`;
      const text = node('span', '', 'industry-build-copy');
      text.append(node('strong', config.name), node('small', `${config.cost} materials · ${config.size} × ${config.size}`), node('small', descriptions[kind]));
      build.append(art, text); build.title = count >= config.limit ? `All ${config.limit} placed` : state.materials < config.cost ? `Need ${config.cost} materials` : `Place ${config.name.toLowerCase()}`;
      catalog.append(build);
    }
    body.append(catalog, node('p', `Power starts at ${INDUSTRY.starterEnergy}. Machines pass cargo by touch, and a free OUT side fills the reserve. A warehouse shows the reserve and its drone fetches the shuttle's crates. R turns equipment.`, 'industry-guidance'));
    if (items.length) {
      const list = node('details', '', 'industry-machines'); list.append(node('summary', `Find equipment · ${items.length}`));
      for (const item of items) {
        const row = button(`find-industry-${item.id}`, `${INDUSTRY.kinds[item.kind].name} · ${item.x}:${item.y} · ${industryStatus(state, item)}`, () => inspect(item.id), false, false, 'industry-machine-link');
        row.dataset.industrySelect = item.id; list.append(row);
      }
      body.append(list);
    }
    const reserve = node('div', '', 'industry-reserve');
    reserve.append(node('span', `Reserve · ${industryStored(state, 'provisions')} provisions · ${industryStored(state, 'biomass')} biomass`), button('industry-ship', 'Orbital post ↗', showShipment, false, false, 'quiet-button'));
    body.append(reserve); return;
  }

  // Resolve the current revision at click time through the app's action adapter.
  const command = (action, extra = {}) => act(action, { machineId: machine.id, revision: machine.revision, ...extra });
  const top = node('div', '', 'industry-status-row');
  top.append(button('industry-back', '← Equipment', () => inspect(null), false, false, 'quiet-button'));
  const status = node('strong', industryStatus(state, machine), 'industry-status'); status.id = 'industry-status'; top.append(status); body.append(top);
  const holding = node('p', holdingLine(state, machine), 'industry-line'); holding.id = 'industry-holding';
  const hint = node('p', hintLine(state, machine), 'industry-hint'); hint.id = 'industry-hint'; hint.hidden = !hint.textContent;
  body.append(holding, hint);
  let progress = null, fill = null;
  if (machine.kind === 'processor') {
    progress = node('div', '', 'progress-track'); progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', 'Food processing'); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
    fill = node('div', '', 'progress-fill'); progress.append(fill); body.append(progress);
  }
  const controls = node('div', '', 'industry-controls');
  let choice = loadChoice(state, machine);
  const load = machine.kind === 'generator' || machine.kind === 'processor'
    ? button('industry-load', loadLabel(choice), () => { if (choice) command('industry-load', choice); }, !choice) : null;
  if (load) controls.append(load);
  if (machine.kind === 'belt' || machine.kind === 'outlet') controls.append(button('industry-rotate', 'Rotate', () => command('industry-rotate', { dir: nextIndustryDirection(state, machine) })));
  if (machine.kind !== 'belt') controls.append(button('industry-toggle', machine.enabled ? 'Pause' : 'Resume', () => command('industry-toggle')));
  controls.append(button('industry-remove', 'Remove', () => command('industry-remove'), false, true, 'quiet-button'));
  body.append(controls);
  const refresh = () => {
    status.textContent = industryStatus(state, machine);
    holding.textContent = holdingLine(state, machine);
    hint.textContent = hintLine(state, machine); hint.hidden = !hint.textContent;
    if (progress) {
      const percent = machine.job ? Math.min(100, Math.floor(machine.job.elapsed / machine.job.seconds * 100)) : 0;
      progress.hidden = !machine.job; progress.setAttribute('aria-valuenow', String(percent)); fill.style.width = `${percent}%`;
    }
    if (load) { choice = loadChoice(state, machine); load.textContent = loadLabel(choice); load.dataset.unavailable = String(!choice); }
    const toggle = controls.querySelector('#industry-toggle'); if (toggle) toggle.textContent = machine.enabled ? 'Pause' : 'Resume';
    for (const control of body.querySelectorAll('[data-colony-action]')) control.disabled = !canAct || control.dataset.unavailable === 'true';
  };
  refresh();
  livePanels.set(body, { selectedId, update(nextState, available) {
    state = nextState; canAct = available;
    const current = industryItems(state).find(item => item.id === selectedId);
    if (!current) {
      status.textContent = 'Equipment removed';
      for (const control of body.querySelectorAll('[data-colony-action]')) control.disabled = true;
      return;
    }
    machine = current;
    power.querySelector('strong').textContent = `${Math.floor(state.industry?.energy || 0)} / ${INDUSTRY.energyCapacity}`;
    refresh();
  } });
}
