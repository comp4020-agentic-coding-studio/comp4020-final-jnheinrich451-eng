// Saved geometry version: old berths and hulls keep their original clearance.
export const LARGE_DOCK = Object.freeze({version:2,width:7,length:12,siteDistance:8,berthWidth:8,berthLength:14,berthOffset:8});
export const largeHull=s=>s?.navalScale===2;
export const largeDock=s=>s?.dockScale===2;
const sizes=Object.freeze({gunship:{width:4,length:12},transport:{width:4.5,length:10},carrier:{width:6,length:12},submarine:{width:2.5,length:12}});
export function shipDimensions(s){
 const kind=s?.kind||'gunship';
 return largeHull(s)?sizes[kind]||sizes.gunship:kind==='carrier'?{width:3,length:5}:{width:2,length:4};
}
export function shipArtScale(s){const d=shipDimensions(s);return {x:d.width/(s?.kind==='carrier'?3:2),y:d.length/(s?.kind==='carrier'?5:4)};}
export const navalWeaponScale=s=>largeHull(s)?1.5:1;
export function submarineTubeLocal(s,index){return largeHull(s)?{x:(index%2?1:-1)*.34,y:-1.39+Math.floor(index/2)*.48}:{x:(index%2-.5)*.53,y:-.46+Math.floor(index/2)*.17};}
export function dockDimensions(s){return largeDock(s)?LARGE_DOCK:{width:3,length:5,siteDistance:3,berthWidth:3,berthLength:5,berthOffset:3};}
