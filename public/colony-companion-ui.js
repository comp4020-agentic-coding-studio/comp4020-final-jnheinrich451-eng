// The companion's own dock panel: the spider, its name, and the fish that are its treats.
// Presentation only: adopting, renaming, petting and feeding stay server actions.
import { PET } from './colony-pet.js';
import { drawColonyPet } from './colony-pet-art.js';
import { catchName, fishingSummary } from './colony-rest.js';
import { fishGenome } from './colony-fish.js';
import { drawAlienFish } from './colony-fish-art.js';

const node = (tag, text, css) => { const n = document.createElement(tag); n.textContent = text; if (css) n.className = css; return n; };

// The garden's own drawing, seated and still, so the panel shows the spider before adoption too.
// A three-quarter turn shows both its eyes and the violet panel on its back.
function portrait() {
  const width = 116, height = 84, scale = 2, art = document.createElement('canvas');
  art.width = width * scale; art.height = height * scale; art.className = 'companion-portrait'; art.setAttribute('aria-hidden', 'true');
  const c = art.getContext('2d');
  c.scale(scale, scale); c.translate(width / 2, height * .66); c.scale(132, 132);
  drawColonyPet(c, { x: 0, y: 0, angle: Math.PI * .75, mode: 'sit', name: '' }, 0, true);
  return art;
}

export function renderCompanionPanel({ body, state, canAct, act, focus }) {
  const pet = state.pet, card = node('div', '', 'companion-card'); card.id = 'companion-card';
  const head = node('div', '', 'companion-head'), words = node('div', '', 'companion-words');
  if (pet) words.append(node('p', `Petted ${pet.pets} time${pet.pets === 1 ? '' : 's'} · fed ${pet.fed} fish`, 'panel-copy'), node('p', 'Walk up and press E to pet it. A fish in the warehouse becomes a treat.', 'fine'));
  else words.append(node('p', 'A furry mechanical spider', 'panel-copy'), node('p', 'It follows you, sits beside you when you rest, and loves a fish.', 'fine'));
  head.append(portrait(), words); card.append(head);
  if (pet) {
    const form = node('form', '', 'pet-rename'), field = document.createElement('input'), rename = node('button', 'Rename', 'soft-button');
    form.id = 'pet-rename'; field.id = 'pet-name'; field.type = 'text'; field.maxLength = PET.nameLength * 2; field.value = pet.name;
    field.setAttribute('aria-label', 'Companion name'); field.autocomplete = 'off'; field.spellcheck = false;
    rename.type = 'submit'; rename.id = 'pet-rename-button'; rename.disabled = !canAct;
    form.onsubmit = event => { event.preventDefault(); field.blur(); void act('rename-pet', { name: field.value }); };
    const find = node('button', `Find ${pet.name}`, 'quiet-button'); find.type = 'button'; find.id = 'pet-find'; find.onclick = () => focus(pet);
    form.append(field, rename); card.append(form, find);
  } else {
    const adopt = node('button', `Adopt a companion · ${PET.cost} materials`, 'primary-button wide'), short = state.materials < PET.cost;
    adopt.id = 'adopt-pet'; adopt.type = 'button'; adopt.dataset.colonyAction = 'adopt-pet'; adopt.dataset.unavailable = String(short);
    adopt.disabled = !canAct || short; adopt.onclick = () => act('adopt-pet', {}); card.append(adopt);
  }
  const creel = fishingSummary(state), recent = (state.fishing?.catches || []).slice(-6).reverse(), kinds = Object.keys(creel.record).length;
  const best = Object.entries(creel.record).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id, length]) => `${catchName({ species: id })} ${length} cm`).join(', ');
  card.append(node('p', creel.catches ? `Warehouse · ${creel.treats} fish · ${kinds} ${kinds === 1 ? 'kind' : 'kinds'} caught · longest ${best}` : 'Fish at the lake shore or a pond: walk up and press E. Every catch goes to the warehouse and is a treat for your companion.', 'fine'));
  if (recent.some(entry => entry.seed)) {
    const gallery = node('div', '', 'creel-gallery'); gallery.id = 'creel-gallery';
    for (const entry of recent.filter(e => e.seed)) {
      const figure = document.createElement('figure'), art = document.createElement('canvas'), genome = fishGenome(entry.seed, entry.planet);
      art.width = 128; art.height = 72; const context = art.getContext('2d'); context.scale(2, 2);
      drawAlienFish(context, genome, 32, 18, 50, 0, { swim: false });
      figure.title = `${genome.name} · ${entry.length} cm`; figure.append(art, node('figcaption', genome.name)); gallery.append(figure);
    }
    card.append(gallery);
  }
  body.append(card);
}
