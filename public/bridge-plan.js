import { BRIDGE, BRIDGE_PROFILES } from './bridge-geometry.js';
import { bridgeError } from './bridge.js';
import { tileAt } from './world.js';

export const bridgeFacing = angle => ((Math.round((angle || 0)/(Math.PI/2))%4)+4)%4;
// Bounded survey of nearby parallel corridors. Keep the exact accepted endpoints
// in the existing bridge order; the server validates them again before spending.
export function planBridgeAhead(world,buildings,people,builder,bearing,profile='standard'){
  if(!Object.hasOwn(BRIDGE_PROFILES,profile))return {error:'Choose a standard or heavy bridge.'};
  const spec=BRIDGE_PROFILES[profile];
  if(!builder||!Number.isInteger(bearing)||bearing<0||bearing>3)return {error:'Board a bridge builder and choose a direction.'};
  const dx=[0,1,0,-1][bearing],dy=[-1,0,1,0][bearing];
  const land=t=>[1,2,4].includes(t),inside=p=>p.x>=0&&p.y>=0&&p.x<world.width&&p.y<world.height;
  const row=p=>Array.from({length:spec.width},(_,i)=>i-(spec.width-1)/2).map(side=>({x:p.x-side*dy,y:p.y+side*dx}));
  const landRow=p=>row(p).every(c=>inside(c)&&land(tileAt(world,c.x,c.y)));
  let hasStart=false,failure=null;
  for(const side of [0,-1,1,-2,2,-3,3])for(const forward of [1,0,2,3,4]){
    const from={x:Math.floor(builder.x)+dx*forward-dy*side,y:Math.floor(builder.y)+dy*forward+dx*side};
    if(Math.hypot(from.x+.5-builder.x,from.y+.5-builder.y)>BRIDGE.reach||!landRow(from)||!landRow({x:from.x-dx,y:from.y-dy}))continue;
    hasStart=true;let water=false;
    for(let distance=1;distance<=spec.maxSpan+1;distance++){
      const to={x:from.x+dx*distance,y:from.y+dy*distance},cells=row(to);
      if(cells.some(c=>!inside(c)))break;
      const tiles=cells.map(c=>tileAt(world,c.x,c.y));
      if(tiles.some(t=>t!==0&&!land(t))){failure ||= 'Rocks block the crossing ahead. Move along the bank or choose another direction.';break;}
      if(tiles.includes(0)){water=true;continue;}
      if(!water||distance<2||!landRow({x:to.x+dx,y:to.y+dy}))continue;
      const error=bridgeError(world,buildings,people,builder,from,to,profile);
      if(!error)return {from,to,profile,error:null,shift:side};
      failure ||= error;break;
    }
  }
  return {error:failure||(hasStart?`No suitable opposite bank within ${spec.maxSpan} deck rows. Move along the shore or choose another direction.`:`No room for a ${spec.width}-tile anchor ahead. Back away from the water or move along the shore.`)};
}
