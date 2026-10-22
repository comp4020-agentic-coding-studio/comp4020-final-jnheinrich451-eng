export const BRIDGE = Object.freeze({ maxSpan:24, maxCount:8, cableTime:2, rowTime:.65, baseCost:30, rowCost:6, reach:4 });
export const isBuilder = unit => unit?.kind === 'builder';
// Endpoint selection order does not choose the construction bank.
export function bridgeFromBuilder(builder,from,to){
  const distance=p=>Math.hypot(builder.x-p.x-.5,builder.y-p.y-.5);
  return builder&&from&&to&&distance(to)<distance(from)?{from:to,to:from}:{from,to};
}
export const bridgeLength = b => Math.abs(b.to.x-b.from.x)+Math.abs(b.to.y-b.from.y)-1;
export const bridgeDuration = b => BRIDGE.cableTime + bridgeLength(b)*BRIDGE.rowTime;
export const bridgeCost = b => BRIDGE.baseCost+bridgeLength(b)*BRIDGE.rowCost;
export const bridgeReady = b => b.elapsed >= bridgeDuration(b);
export function bridgeCells(b){
  const dx=Math.sign(b.to.x-b.from.x),dy=Math.sign(b.to.y-b.from.y),n=bridgeLength(b)+1,cells=[];
  for(let row=0;row<=n;row++)for(let side=-1;side<=1;side++)cells.push({x:b.from.x+row*dx-side*dy,y:b.from.y+row*dy+side*dx,row,anchor:row===0||row===n});
  return cells;
}
export function bridgeAt(world,x,y){
  x=Math.floor(x);y=Math.floor(y);
  return (world.logistics?.bridges||[]).find(b=>b.from.x===b.to.x?Math.abs(x-b.from.x)<=1&&y>=Math.min(b.from.y,b.to.y)&&y<=Math.max(b.from.y,b.to.y):Math.abs(y-b.from.y)<=1&&x>=Math.min(b.from.x,b.to.x)&&x<=Math.max(b.from.x,b.to.x));
}
