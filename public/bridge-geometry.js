export const BRIDGE = Object.freeze({ maxSpan:24, maxCount:8, cableTime:2, rowTime:.65, baseCost:30, rowCost:6, reach:4 });
export const BRIDGE_PROFILES=Object.freeze({
  standard:Object.freeze({label:'Standard',width:3,maxSpan:24,cableTime:2,rowTime:.65,baseCost:30,rowCost:6}),
  heavy:Object.freeze({label:'Heavy',width:5,maxSpan:48,cableTime:2*5/3,rowTime:.65*5/3,baseCost:50,rowCost:10}),
});
export const bridgeProfile=b=>BRIDGE_PROFILES[b?.profile||'standard']||BRIDGE_PROFILES.standard;
export const bridgeWidth=b=>b.width??bridgeProfile(b).width;
export const bridgeTiming=b=>({cableTime:b.cableTime??bridgeProfile(b).cableTime,rowTime:b.rowTime??bridgeProfile(b).rowTime});
export const isBuilder = unit => unit?.kind === 'builder';
// Endpoint selection order does not choose the construction bank.
export function bridgeFromBuilder(builder,from,to){
  const distance=p=>Math.hypot(builder.x-p.x-.5,builder.y-p.y-.5);
  return builder&&from&&to&&distance(to)<distance(from)?{from:to,to:from}:{from,to};
}
export const bridgeLength = b => Math.abs(b.to.x-b.from.x)+Math.abs(b.to.y-b.from.y)-1;
export const bridgeDuration = b => b.duration??(bridgeTiming(b).cableTime + bridgeLength(b)*bridgeTiming(b).rowTime);
export const bridgeCost = b => bridgeProfile(b).baseCost+bridgeLength(b)*bridgeProfile(b).rowCost;
export const bridgeReady = b => b.elapsed >= bridgeDuration(b);
const authoredDecks=new WeakMap();
export function bridgeDeckAt(world,x,y){
  const b=bridgeAt(world,x,y);if(b&&bridgeReady(b))return true;
  const cells=world.bridges;if(!cells?.length)return false;
  if(!authoredDecks.has(cells))authoredDecks.set(cells,new Set(cells.map(p=>p.x+','+p.y)));
  return authoredDecks.get(cells).has(Math.floor(x)+','+Math.floor(y));
}
export function bridgeCells(b){
  const dx=Math.sign(b.to.x-b.from.x),dy=Math.sign(b.to.y-b.from.y),n=bridgeLength(b)+1,cells=[];
  const half=(bridgeWidth(b)-1)/2;
  for(let row=0;row<=n;row++)for(let side=-half;side<=half;side++)cells.push({x:b.from.x+row*dx-side*dy,y:b.from.y+row*dy+side*dx,row,anchor:row===0||row===n});
  return cells;
}
export function bridgeAt(world,x,y){
  x=Math.floor(x);y=Math.floor(y);
  return (world.logistics?.bridges||[]).find(b=>b.from.x===b.to.x?Math.abs(x-b.from.x)<bridgeWidth(b)/2&&y>=Math.min(b.from.y,b.to.y)&&y<=Math.max(b.from.y,b.to.y):Math.abs(y-b.from.y)<bridgeWidth(b)/2&&x>=Math.min(b.from.x,b.to.x)&&x<=Math.max(b.from.x,b.to.x));
}
