import { BRIDGE, bridgeLength, bridgeCells, bridgeAt } from './bridge-geometry.js';
import { tileAt, canStand } from './world.js';
import { logisticsAt, hostileAt, airbaseAt, artilleryBlocks, railCorridor } from './footprints.js';
import { dockAt, shipBlocks } from './ship.js';
import { coreCell } from './core.js';
import { tankBlocks, tankPodCell } from './tank.js';

export function bridgeSupplyError(world,price){
  const available=world.logistics?.groundSupplies||0;
  return available+1e-8>=price?null:`Need ${price} GND; shared ground pool has ${Math.floor(available)} (short ${Math.ceil(price-available)}). Unload salvage at a core or outpost to earn GND.`;
}

export function bridgeError(world, buildings, people, builder, from, to){
  if(!from||!to||![from.x,from.y,to.x,to.y].every(Number.isInteger))return 'Choose the center tile of each 3 x 1 bank anchor.';
  if((from.x===to.x)===(from.y===to.y))return 'Align the banks north-south or east-west.';
  const bridge={from,to},length=bridgeLength(bridge);
  if(length<1||length>BRIDGE.maxSpan)return `Keep between 1 and ${BRIDGE.maxSpan} deck rows between the anchors.`;
  if((world.logistics?.bridges?.length||0)>=BRIDGE.maxCount)return 'Eight field bridges per campaign.';
  if(!builder||Math.min(...[from,to].map(p=>Math.hypot(builder.x-p.x-.5,builder.y-p.y-.5)))>BRIDGE.reach)return 'Drive the builder within four tiles of either bank.';
  let crossesWater=false;
  for(const cell of bridgeCells(bridge)){
    const {x,y}=cell;
    if(x<0||y<0||x>=world.width||y>=world.height)return 'The entire bridge must fit inside the map.';
    if(bridgeAt(world,x,y))return 'An existing bridge reserves this crossing.';
    if(logisticsAt(world,x,y)||hostileAt(world,x,y)||airbaseAt(world,x,y)||dockAt(world,x,y)||artilleryBlocks(world,x,y)||railCorridor(world,x,y)||world.cores?.some(c=>coreCell(c,x,y))||world.tanks?.some(t=>tankPodCell(t,x,y))||buildings.some(b=>b.x===x&&b.y===y))return 'Keep both anchors and the whole crossing clear of facilities, docks and rail corridors.';
    if(shipBlocks(world,x+.5,y+.5,.5)||tankBlocks(world,x+.5,y+.5,.5)||people.some(p=>p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&p.body!=='aircraft'&&Math.abs(p.x-x-.5)<.85&&Math.abs(p.y-y-.5)<.85)||world.logistics.recyclers.some(r=>Math.abs(r.x-x-.5)<.85&&Math.abs(r.y-y-.5)<.85))return 'A unit occupies the crossing. Park the builder beside the bank anchor.';
    const terrain=tileAt(world,x,y);
    if(cell.anchor ? ![1,2,4].includes(terrain) : ![0,1,2,4].includes(terrain))return cell.anchor?'Both 3 x 1 anchors need clear land. Move the anchor farther inland.':'Keep the deck clear of rocks and obstacles; clear land and water are allowed.';
    if(!cell.anchor&&terrain===0)crossesWater=true;
  }
  if(!crossesWater)return 'The bridge must cross some open water. Choose banks on either side of a crossing.';
  const dx=Math.sign(to.x-from.x),dy=Math.sign(to.y-from.y);
  for(const [p,d] of [[from,-1],[to,1]])for(let side=-1;side<=1;side++)if(!canStand(world,buildings,p.x+.5+d*dx-side*dy,p.y+.5+d*dy+side*dx))return 'Each bank needs a clear three-tile approach behind its anchor.';
  return null;
}
