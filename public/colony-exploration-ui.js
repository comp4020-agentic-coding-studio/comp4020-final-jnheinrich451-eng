import { regionsFor, regionDiscoveries } from './colony-regions.js';
import { colonyPlanetById } from './colony-planets.js';
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
export const discoveredIds = state => state.exploration?.discoveries || [];
export const closestDiscovery = (state, worker) => (state.regionDiscoveries || []).filter(d => !discoveredIds(state).includes(d.id)).map(d => ({ ...d, distance: Math.hypot(d.x - worker.x, d.y - worker.y) })).sort((a,b) => a.distance - b.distance)[0];
function morrowArt(kind) {
  if (kind === 'home') return '<svg viewBox="0 0 180 70" aria-hidden="true"><path d="M0 47Q45 13 91 36T180 27V70H0Z" fill="#cbd6ad"/><path d="M17 58Q83 41 163 61" fill="none" stroke="#f0e8d0" stroke-width="5"/><path d="M59 48V24Q80 7 101 24V48Z" fill="#e9efdf" stroke="#7c9780"/><path d="M65 39V26Q80 16 95 26V39Z" fill="#9fcbc4"/><path d="M80 19V47M59 40H101" stroke="#7c9780"/><path d="M110 46h22v10h-22Z" fill="#aa8e71"/><circle cx="120" cy="43" r="8" fill="#99b97e"/></svg>';
  if (kind === 'lake') return '<svg viewBox="0 0 180 70" aria-hidden="true"><path d="M0 16Q50 36 93 14T180 26V70H0Z" fill="#cbd6ad"/><path d="M18 57Q32 18 94 27T169 48Q131 69 18 57" fill="#94bfbc"/><path d="M48 48h31m28-9h22m-40 15h32" stroke="#e9f2db" stroke-width="2"/><path d="M26 48V19m5 31V25m119 31V24m7 29V18" stroke="#7a9575" stroke-width="2"/><path d="M23 18h6m125 0h6" stroke="#b39f74" stroke-width="4"/></svg>';
  return '<svg viewBox="0 0 180 70" aria-hidden="true"><path d="M0 48Q53 21 180 43V70H0Z" fill="#cbd6ad"/><path d="M43 61V19m47 43V12m44 49V24" stroke="#8c816a" stroke-width="3"/><g fill="#8baa7e"><ellipse cx="43" cy="24" rx="25" ry="17"/><ellipse cx="90" cy="17" rx="29" ry="18"/><ellipse cx="134" cy="28" rx="25" ry="18"/></g><g fill="#e8c5b0"><circle cx="34" cy="19" r="5"/><circle cx="53" cy="28" r="4"/><circle cx="81" cy="12" r="5"/><circle cx="100" cy="25" r="4"/><circle cx="141" cy="22" r="5"/></g></svg>';
}
// Other worlds reuse Morrow's survey sketches in their own surface colours.
function mapArt(region, template) {
  const art = morrowArt(region.kind), surface = template === 'morrow-v1' ? null : colonyPlanetById(template)?.surface;
  if (!surface) return art;
  return [['#cbd6ad', surface.land], ['#94bfbc', surface.water], ['#8baa7e', surface.leaf], ['#99b97e', surface.leaf], ['#e8c5b0', surface.bloom]].reduce((svg, [from, to]) => svg.replaceAll(from, to), art);
}
/** @param {any} options */
export function renderExplorationPanel({body,state,worker,canAct,act,selectedId,focus}) {
  const regionId = state.regionId || 'home';
  const regions = regionsFor(state.template), planet = colonyPlanetById(state.template)?.name || 'this world';
  const intro = node('p', regionId === 'home' ? `Visit a separate region and bring a little of ${planet} home. Your buildings stay here.` : 'Your buildings are in the home district, where your garden keeps growing. Use Return home or Home in the toolbar whenever you like.', 'panel-copy'); body.append(intro);
  const map = node('div', undefined, 'region-map');
  for (const region of regions) {
    const b = node('button', undefined, 'region-card'); b.id = `travel-${region.id}`; b.setAttribute('aria-current', String(region.id === regionId));
    b.disabled = !canAct || region.id === regionId; b.onclick = () => act('travel-region',{destination:region.id});
    const art = node('span', undefined, 'region-card-art'); art.innerHTML = mapArt(region, state.template);
    b.append(art, node('strong',region.name || region.title), node('small',region.id === regionId ? 'You are here' : region.id === 'home' ? 'Return home' : 'Travel by survey shuttle')); map.append(b);
  } body.append(map);
  const known = discoveredIds(state), discoveries = state.regionDiscoveries || [];
  if (discoveries.length) {
    const list = node('div', undefined, 'discovery-list');
    for (const d of discoveries) {
      const done = known.includes(d.id), distance = Math.hypot(d.x - worker.x, d.y - worker.y);
      const card = node('article', undefined, 'discovery-card' + (d.id === selectedId ? ' selected' : '')); card.dataset.discoveryId = d.id;
      card.append(node('strong', d.name), node('p',done ? d.description : `${distance <= 2.6 ? 'Within reach' : `${Math.ceil(distance)} steps away`} · ${d.hint || d.description}`, 'fine'));
      const controls = node('div', undefined, 'discovery-controls');
      const point = node('button','Locate','quiet-button'); point.onclick=()=>focus(d); controls.append(point);
      const scan = node('button',done?'Recorded':distance<=2.6?'Record specimen · +3 materials':'Walk closer to record','soft-button'); scan.id=`discover-${d.id}`; scan.dataset.discoverId=d.id; scan.disabled=!canAct||done||distance>2.6; scan.onclick=()=>act('discover-region',{discoveryId:d.id}); controls.append(scan); card.append(controls);if(d.giftName)card.append(node('p',`${done?'Sent to home storage':'A gift for your home'} · ${d.giftName}`,'fine'));list.append(card);
    } body.append(list);
  }
  const journal=node('details',undefined,'field-journal');journal.id='field-journal';journal.append(node('summary',`Field journal · ${known.length} / ${regions.reduce((n, r) => n + regionDiscoveries(r.id).length, 0)} discoveries`));
  for(const region of regions.filter(r=>r.id!=='home'))for(const d of regionDiscoveries(region.id)){
    const entry=node('article',undefined,'journal-entry');entry.append(node('strong',known.includes(d.id)?d.name:'Unrecorded specimen'),node('p',known.includes(d.id)?d.description:`Find it in ${region.name||region.title}.`,'fine'));journal.append(entry);
  }body.append(journal);
}
