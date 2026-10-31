// A saved objective roster prevents a missing record from looking like victory.
// Legacy checkpoints adopt their present sites and declared compound members once.
const validId = id => typeof id === 'string' && id.length > 0;

export function createPlanetConquest(sites = [], saved = null) {
  const state = { version: 1, requiredIds: [...new Set((saved?.requiredIds || []).filter(validId))], announced: saved?.announced === true };
  rememberPlanetObjectives(state, sites);
  return state;
}

export function rememberPlanetObjectives(state, sites = []) {
  const ids = new Set(state.requiredIds);
  for (const site of sites) {
    if (validId(site.id)) ids.add(site.id);
    for (const group of [site.settlement, site.encounter]) {
      for (const id of group?.requiredIds || []) if (validId(id)) ids.add(id);
    }
  }
  state.requiredIds = [...ids];
}

export function planetConquestStatus(state, sites = [], enemies = []) {
  rememberPlanetObjectives(state, sites);
  const byId = new Map(sites.map(site => [site.id, site]));
  const total = state.requiredIds.length;
  const cleared = state.requiredIds.filter(id => byId.get(id)?.state === 'conquered').length;
  const complete = total > 0 && cleared === total && sites.every(site => validId(site.id) && site.state === 'conquered');
  const survivors = new Set(enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)).size;
  return { state: complete ? 'conquered' : 'contested', total, cleared, survivors };
}
