import { SETTLEMENT_CATALOGUE, SETTLEMENT, settlementDefinition, settlementItems, settlementStored, settlementBuildCost, settlementProjectStatus } from './colony-settlement.js';
import { drawSettlementBase } from './colony-settlement-art.js';

const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
function button(id, text, fn, cls = 'soft-button', disabled = false) {
  const b = node('button', text, cls); b.id = id; b.type = 'button'; b.disabled = disabled; b.onclick = fn; return b;
}
const categories = ['Paths', 'Garden', 'Lights', 'Living', 'Furniture', 'Shelters'];
export function furnishingThumbnail(kind, variant = 'ivory') {
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 120; canvas.className = 'furnishing-thumb'; canvas.setAttribute('aria-hidden', 'true');
  const c = canvas.getContext('2d'), spec = settlementDefinition(kind), scale = Math.min(37, 140 / Math.max(spec.width, spec.height + 1));
  c.translate(90 - spec.width * scale / 2, 77 - spec.height * .82 * scale / 2); c.scale(scale, scale);
  drawSettlementBase(c, { id: 'preview', kind, x: 0, y: 0, dir: 0, variant, status: 'ready' }); return canvas;
}
/** @param {any} options */
export function renderSettlementPanel({ body, state, selectedId, actorId, canAct, act, pick, inspect, preferences, refresh }) {
  const current = settlementItems(state).find(item => item.id === selectedId);
  const deliveries = state.settlement?.deliveries || [];
  if (current) {
    const spec = settlementDefinition(current.kind), flight = deliveries.find(d => d.itemId === current.id), queued=!!flight&&deliveries[0]!==flight;
    const summary = node('div', undefined, 'furnishing-detail'); summary.append(furnishingThumbnail(current.kind, current.variant));
    const copy = node('div'); copy.append(node('p', spec.description, 'panel-copy'), node('p', flight ? queued?'Queued for the shuttle':'Orbital delivery in progress' : `${current.variant} · ${spec.solid ? 'Solid furnishing' : 'Walkable surface'}`, 'fine')); summary.append(copy); body.append(summary);
    if (flight) body.append(node('p', `Reserved site · ${Math.ceil(flight.duration - flight.elapsed)}s of active flight remaining`, 'delivery-status'));
    const controls = node('div', undefined, 'industry-controls');
    controls.append(button('furnishing-move', 'Move', () => pick(current.kind, { ...current }), 'soft-button', !canAct || !!flight),
      button('furnishing-rotate', 'Rotate', () => act('furnishing-rotate', { itemId: current.id, revision: current.revision }), 'soft-button', !canAct || !!flight),
      button('furnishing-store', 'Store', () => act('furnishing-store', { itemId: current.id, revision: current.revision }), 'soft-button', !canAct || !!flight));
    body.append(controls, button('furnishing-back', '← Furnishing collection', () => inspect(null), 'quiet-button'));
    return;
  }
  const tabs = node('div', undefined, 'settlement-tabs'); tabs.setAttribute('aria-label', 'Settlement views');
  for (const [id, label] of [['catalogue', 'Furnish'], ['projects', 'Projects'], ['stored', 'Storage']]) {
    const b = button(`settlement-tab-${id}`, label, () => { preferences.tab = id; refresh(); }, 'quiet-button');
    b.setAttribute('aria-pressed', String(preferences.tab === id)); tabs.append(b);
  }
  body.append(tabs);
  if (deliveries.length) {
    const flight = deliveries[0], item = settlementItems(state).find(i => i.id === flight.itemId), remaining = Math.max(0, Math.ceil(flight.duration - flight.elapsed));
    const label = flight.elapsed < 2 ? 'Approaching' : flight.elapsed < 5 ? 'Lowering cargo' : flight.elapsed < 6 ? 'Assembling' : 'Departing';
    const strip = node('div', undefined, 'settlement-delivery'); strip.id = 'settlement-delivery';
    strip.append(node('span', `${label} · ${settlementDefinition(item?.kind)?.name || 'Furnishing'}`), node('strong', `${remaining}s${deliveries.length > 1 ? ` + ${deliveries.length - 1} queued` : ''}`)); body.append(strip);
  }
  if (preferences.tab === 'projects') {
    body.append(node('p', 'Small projects for a place that feels like yours. Take them at your own pace.', 'panel-copy'));
    for (const project of settlementProjectStatus(state)) {
      const card = node('article', undefined, 'settlement-project'); card.dataset.projectId = project.id;
      card.append(node('strong', project.name), node('p', project.description, 'fine'));
      const track = node('div', undefined, 'progress-track'), fill = node('div', undefined, 'progress-fill'); fill.style.width = `${project.current / project.total * 100}%`; track.append(fill); card.append(track);
      card.append(button(`claim-${project.id}`, project.claimed ? 'Completed' : project.ready ? `Complete · +${project.reward} materials` : `${project.current} / ${project.total} · +${project.reward} materials`, () => act('claim-settlement-project', { projectId: project.id }), project.ready && !project.claimed ? 'primary-button' : 'quiet-button', !canAct || !project.ready || project.claimed)); body.append(card);
    }
  } else {
    const stockView = preferences.tab === 'stored';
    if (!stockView) {
      const filters = node('div', undefined, 'furnishing-filters'); filters.setAttribute('aria-label', 'Furnishing categories');
      for (const category of categories) { const b = button(`furnishing-category-${category.toLowerCase()}`, category, () => { preferences.category = category; refresh(); }, 'quiet-button'); b.setAttribute('aria-pressed', String(preferences.category === category)); filters.append(b); } body.append(filters);
    }
    const finishes = node('div', undefined, 'furnishing-finishes'); finishes.append(node('span', 'Finish', 'fine'));
    for (const variant of ['ivory', 'sage', 'violet']) { const b = button(`furnishing-finish-${variant}`, variant, () => { preferences.variant = variant; refresh(); }, 'finish-swatch'); b.dataset.finish = variant; b.setAttribute('aria-pressed', String(preferences.variant === variant)); finishes.append(b); } body.append(finishes);
    const catalog = node('div', undefined, 'furnishing-catalogue');
    const entries = SETTLEMENT_CATALOGUE.filter(spec => stockView ? settlementStored(state, spec.id) > 0 : spec.category === preferences.category);
    for (const spec of entries) {
      const stock = settlementStored(state, spec.id), cost = settlementBuildCost(state, spec.id);
      const b = button(`place-furnishing-${spec.id}`, '', () => pick(spec.id), 'furnishing-card', !canAct || cost > state.materials || deliveries.length >= SETTLEMENT.queueLimit);
      b.append(furnishingThumbnail(spec.id, preferences.variant), node('strong', spec.name), node('small', stock > 0 ? `${stock} in storage · free to place` : `${cost} materials`, 'fine')); catalog.append(b);
    }
    body.append(catalog);
    if (!entries.length) body.append(node('p', 'Stored furnishings will appear here. Store an object to place it again for free.', 'panel-copy'));
    else body.append(node('p', 'Choose a piece, then select its site. The shuttle delivers it; moving and storing are free.', 'furnishing-guidance'));
  }
  const undo = state.settlement?.undo, canUndo = undo && undo.actorId === actorId && undo.revision === state.settlement.revision;
  const footer = node('div', undefined, 'settlement-footer'); footer.append(node('span', `${settlementItems(state).length} furnishings`, 'fine'), button('settlement-undo', 'Undo last edit', () => act('settlement-undo', { revision: state.settlement.revision }), 'quiet-button', !canAct || !canUndo)); body.append(footer);
  const items = settlementItems(state);
  if (items.length) {
    const list = node('details', undefined, 'settlement-items'); list.append(node('summary', 'Find a furnishing'));
    for (const item of items) { const b = button(`find-${item.id}`, `${settlementDefinition(item.kind).name}${item.status === 'delivery' ? ' · arriving' : ''}`, () => inspect(item.id), 'industry-machine-link'); b.dataset.furnishingId = item.id; list.append(b); } body.append(list);
  }
}
