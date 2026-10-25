import { ECONOMY } from './logistics.js';
import { waterTileAt } from './world.js';
import { shipStopped } from './ship-motion.js';

export const RECOVERY = Object.freeze({reach:2,rate:20,settle:.5});
export const recoveryType = kind => ['submarine','transport','carrier','gunship'].includes(kind)?'ship':kind==='shipyard'?'dock':kind==='helipad'?'airbase':kind==='builder'?'recycler':kind==='mac'?'artillery':kind;
export const recoveryKey = (kind,id) => recoveryType(kind)+':'+id;

export function recordPayment(state,kind,asset,receipt){
  (state.purchases ||= {})[recoveryKey(kind,asset.id)]={...receipt};
}

// Keep exhausted entries as tombstones: deletion/reconnect must never refill them.
export function rememberRecovery(world,kind,asset,point=asset,cargo=0){
  const l=world.logistics,sourceKey=recoveryKey(kind,asset.id),records=l.recovery ||= {};
  const receipt=l.purchases?.[sourceKey]||(recoveryType(kind)==='dock'&&asset.purchase?.kind!=='shipyard'?null:asset.purchase);
  const key=sourceKey+(receipt?.id?':'+receipt.id:'');
  if(records[key])return false;
  const paid=Number.isFinite(receipt?.paid)&&receipt.paid>0?receipt.paid:0;
  const stored=Number.isFinite(cargo)?Math.max(0,cargo):0;
  const amount=paid*.5+stored;
  records[key]={id:key,sourceId:asset.id,kind:asset.kind||kind,x:point.x,y:point.y,angle:asset.angle||0,
    medium:waterTileAt(world,point.x,point.y)===0?'sea':'land',amount,initial:amount,paid,pool:receipt?.pool||null};
  return true;
}

export function nearbyRecovery(world,point,medium){
  return Object.values(world.logistics?.recovery||{}).filter(w=>w.amount>0&&w.medium===medium&&Math.hypot(w.x-point.x,w.y-point.y)<=RECOVERY.reach)
    .sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)||a.id.localeCompare(b.id))[0];
}

// One server-owned balance is debited in the same mutation that fills the hold.
export function collectRecovery(world,truck,wreck,dt){
  if(!wreck||!Number.isFinite(dt)||dt<=0)return 0;
  const amount=Math.max(0,Math.min(wreck.amount,ECONOMY.cargo-(truck.cargo||0),RECOVERY.rate*Math.min(dt,.5)));
  if(!amount)return 0;
  wreck.amount=Math.max(0,wreck.amount-amount);truck.cargo=(truck.cargo||0)+amount;
  if(wreck.amount<1e-8)wreck.amount=0;
  return amount;
}

export function tickSeaRecovery(world,dt,commit=()=>{}){
  let changed=false;const undo=[];
  for(const ship of world.ships||[]){
    const truck=ship.cargo?.kind==='utility'?ship.cargo.vehicle:null;
    if(!truck)continue;
    truck.recovering=null;
    if(ship.kind!=='transport'||ship.destroyed||ship.health<=0||ship.assemblyRemaining>0||ship.elapsed<4.5||!shipStopped(ship)||truck.kind==='builder'||truck.destroyed||truck.remaining>0){
      truck.recoveryIdle=0;truck.recoveryWork=0;continue;
    }
    truck.recoveryIdle=(truck.recoveryIdle||0)+dt;
    if(truck.recoveryIdle<RECOVERY.settle)continue;
    const wreck=nearbyRecovery(world,ship,'sea');
    if(!wreck){truck.recoveryWork=0;continue;}
    truck.recovering=truck.cargo<ECONOMY.cargo?wreck.id:null;
    truck.recoveryWork=(truck.recoveryWork||0)+dt;
    if(truck.recoveryWork<.5)continue;
    const before=[wreck.amount,truck.cargo||0];truck.recoveryWork=0;
    if(collectRecovery(world,truck,wreck,.5)>0){undo.push(()=>{wreck.amount=before[0];truck.cargo=before[1];truck.recovering=null;});if(truck.cargo>=ECONOMY.cargo)truck.recovering=null;changed=true;}
  }
  if(changed)try{commit();}catch(error){for(const restore of undo.reverse())restore();throw error;}
  return changed;
}

export function drawRecoveryLabels(c,world,T,zoom,medium=null){
  if(zoom<.4)return;
  c.save();c.font=`bold ${10/zoom}px monospace`;c.textAlign='center';
  const groups=new Map();
  for(const w of Object.values(world.logistics?.recovery||{}))if(w.amount>0&&(!medium||w.medium===medium)){const key=w.medium+':'+Math.round(w.x*4)+':'+Math.round(w.y*4),group=groups.get(key);if(group)group.amount+=w.amount;else groups.set(key,{...w});}
  for(const w of groups.values()){
    const text=(w.medium==='sea'?'SEA WRECK / ':'SALVAGE / ')+Math.ceil(w.amount),width=c.measureText(text).width;
    c.fillStyle='#152c31db';c.fillRect(w.x*T-width/2-3,(w.y+.9)*T-11/zoom,width+6,14/zoom);
    c.fillStyle=w.medium==='sea'?'#9ddbdc':'#dfbd7a';c.fillText(text,w.x*T,(w.y+.9)*T);
  }
  c.restore();
}
