import { LOCAL_KINDS, supportSources } from './logistics.js';
import { constructionError } from './construction.js';

export function deploymentSources(world, kind, point, ship = null) {
  if (!LOCAL_KINDS.includes(kind)) return [];
  return supportSources(world).filter(f => !constructionError({
    ...world, cores: f.kind === 'core' ? [f] : [],
    logistics: { facilities: f.kind === 'core' ? [] : [f] },
  }, kind, point.x, point.y, ship));
}

// Two real buttons, never nested buttons or a coordinate-dependent click target.
export function prepareDeploymentCards(assets, choose, inspect) {
  for (const asset of assets) {
    const card = document.getElementById(asset.card);
    if (asset.kind === 'orbitalStrike') continue;
    card.onclick = () => choose(asset, 'orbital');
    card.dataset.method = 'orbital';
    if (!LOCAL_KINDS.includes(asset.kind)) continue;
    const wrapper = document.createElement('div'); wrapper.className = 'deployment-choice';
    wrapper.dataset.force = asset.tab; wrapper.hidden = card.hidden;
    card.before(wrapper); wrapper.append(card);
    const ground = card.cloneNode(true); ground.id = asset.card + '-ground'; ground.hidden = true;
    delete ground.dataset.force; ground.dataset.method = 'factory'; ground.classList.add('ground-choice');
    ground.querySelector('.asset-key')?.remove();
    ground.onclick = () => choose(asset, 'factory');
    ground.addEventListener('focus', () => inspect(asset.card));
    ground.addEventListener('pointerenter', () => inspect(asset.card));
    wrapper.append(ground);
  }
}
