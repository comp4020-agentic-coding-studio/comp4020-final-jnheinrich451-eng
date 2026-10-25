// One shared recovery anchor per campaign; additional cores remain vulnerable.
export const isStartingCore=(world,core)=>!!core&&world.logistics?.startingCoreId===core.id;
export function claimStartingCore(logistics,core){
  if(!core||logistics.startingCoreId)return false;
  logistics.startingCoreId=core.id;
  // A legacy surviving core may already have damage awaiting destruction.
  delete logistics.durability['core:'+core.id];
  return true;
}
