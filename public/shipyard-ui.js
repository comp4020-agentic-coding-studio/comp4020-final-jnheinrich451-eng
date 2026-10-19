import { COSTS, quote } from './logistics.js';
import { dockRecords, yardBuildError, nearbyShipyard, dockBoardingShip, SHIPYARD } from './shipyard.js';
import { shipName, dockComplete, recallShipError, boardingPoint, SHIP, mooredDock } from './ship.js';
import { hullHealth, hullMaximum, VEHICLE } from './vehicle.js';

export function shipyardUI({state,api,notify,deploy,locate,stop,boarded}) {
  const $=id=>document.getElementById(id),dialog=$('shipyard-dialog');
  const selected=()=>dockRecords(state().world).find(y=>y.id===$('shipyard-select').value);
  const selectedShip=()=>state().world?.ships.find(s=>(s.yardId||s.id)===selected()?.id);
  const boardingVessel=()=>dockBoardingShip(state().world,selected());
  const near=()=>nearbyShipyard(state().world,state().me);
  let busy=false;
  function update(){
    const {world,me,connected,buildings=[],players=[],placing}=state();if(!world||!me)return;
    const yards=dockRecords(world).filter(y=>y.owner===me.id),select=$('shipyard-select'),old=select.value;
    const entries=yards.map(y=>[y.id,`Dock ${Math.floor(y.dock.x)}:${Math.floor(y.dock.y)}`]);
    const signature=JSON.stringify(entries);if(select.dataset.signature!==signature){select.replaceChildren(...entries.map(([value,textContent])=>Object.assign(document.createElement('option'),{value,textContent})));if(entries.some(e=>e[0]===old))select.value=old;select.dataset.signature=signature;}
    const yard=selected(),v=selectedShip(),active=v&&!v.destroyed,moored=active&&mooredDock(world,v);
    const actorError=!connected?'Reconnect first.':me.body!=='robot'?'Return to your robot first.':me.life==='disabled'?'Revive your robot first.':me.life!=='active'?'Wait for your robot to finish landing.':null;
    const repairJob=yard&&world.logistics.jobs[yard.id],repairing=repairJob?.kind==='repair';
    const repairReason=actorError||(repairJob?'Dock rebuild in progress.':world.logistics.groundSupplies+1e-8<COSTS.dockRepair?`Need ${COSTS.dockRepair} GND; ${Math.floor(world.logistics.groundSupplies)} available.`:null);
    $('dock-rebuild').hidden=!yard?.dockDestroyed;
    $('dock-rebuild').disabled=busy||!yard?.dockDestroyed||!!repairReason;
    $('dock-rebuild').textContent=repairing?`Rebuilding dock / ${Math.ceil(repairJob.remaining)}s`:`Rebuild dock / ${COSTS.dockRepair} GND / 8s`;
    $('dock-rebuild').title=repairReason||'Rebuild this dock in its original position. Your vessel is kept.';
    $('dock-rebuild-help').hidden=!yard?.dockDestroyed;
    $('dock-rebuild-help').textContent=repairing?'Construction drones are rebuilding this dock.':repairReason||'Rebuild in place. Your assigned vessel is kept; no new dock is needed.';
    $('shipyard-select-label').hidden=yards.length<2;
    $('shipyard-title').textContent=yard?`Shipyard / ${Math.floor(yard.dock.x)}:${Math.floor(yard.dock.y)}`:'Shipyard';
    $('shipyard-status').textContent=!yard?'Deploy a dock to create your first ship slot.':yard.dockDestroyed?'Dock destroyed. Use Rebuild dock below, or press L for Field logistics → Damaged infrastructure.':!dockComplete(yard)?'Dock unfolding...':!v?'Empty berth / choose a vessel':v.destroyed?'Vessel lost / choose its replacement':v.assemblyRemaining>0?`${shipName(v)} / assembling ${Math.ceil(v.assemblyRemaining)}s`:`${shipName(v)} / ${Math.ceil(hullHealth(v))}/${hullMaximum(v)} HP / ${v.repairing?'REPAIRING':moored?'DOCKED':'AT SEA'}`;
    $('shipyard-choices').hidden=!!active;
    for(const kind of ['gunship','submarine','transport','carrier']){
      const price=quote(kind==='gunship'?'ship':kind,true),b=$('yard-build-'+kind);
      const reason=actorError||yardBuildError(world,yard,me.id,kind,v?.destroyed?v:null,players)||(world.logistics.groundSupplies+1e-8<price?`Need ${price} ground SUP.`:null);
      b.disabled=busy||!!reason;b.title=reason||'60 seconds to assemble';$('yard-reason-'+kind).textContent=reason||'60s assembly';
      b.textContent=shipName({kind})+' / '+price+' GND';
      b.setAttribute('aria-label',(v?.destroyed?'Replace with ':'Build ')+b.textContent);
    }
    $('shipyard-help').textContent=active?'One ship per dock, including ships at sea. Stationary ships repair at any intact dock: 10 HP/s for 2 GND/s, starting 5 seconds after damage.':actorError||(!yard?'Select Deploy shipyard below.':yardBuildError(world,yard,me.id,'gunship',v?.destroyed?v:null,players))||'Choose one vessel. 60s assembly; up to four active ships per campaign. ';
    for(const id of ['shipyard-new','shipyard-new-dialog'])$(id).disabled=busy||!!actorError||world.logistics.supplies+1e-8<COSTS.shipyard||yards.length>=SHIPYARD.perOwner||dockRecords(world).length>=SHIPYARD.max;
    $('shipyard-retire').hidden=!!v||!yard;$('shipyard-retire').disabled=busy||!!actorError;
    $('ship-find').hidden=!active;$('ship-find').disabled=!active;
    $('ship-dock-find').disabled=!yard;
    $('ship-recall').hidden=!v;$('ship-recall').disabled=busy||!!actorError||!!recallShipError(world,v,players,true);$('ship-recall').title=recallShipError(world,v,players,true)||'Keep the dock; no refund.';
    const visitor=boardingVessel(),point=visitor&&boardingPoint(world,visitor,buildings,me);
    $('yard-board').hidden=!active&&!visitor;$('yard-board').textContent=visitor&&visitor.id!==v?.id?'Board visiting '+shipName(visitor):'Board vessel';$('yard-board').disabled=busy||!!actorError||!visitor||!!visitor.occupant||!point||Math.hypot(me.x-point.x,me.y-point.y)>SHIP.boardRange;
    const hp=world.logistics.durability['ramp:'+v?.id],damaged=v?.rampGun?.destroyed||hp&&hp.health<hp.max;
    $('ramp-repair').hidden=!active||!damaged;$('ramp-repair').disabled=busy||!!actorError||!moored||!!v?.occupant||world.logistics.groundSupplies+1e-8<25;
    $('shipyard-interact').hidden=!connected||!near()||me.body!=='robot'||placing||dialog.open;
  }
  function open(kind=null,id=null){stop();update();if(id)$('shipyard-select').value=id;update();dialog.showModal();$('shipyard-close').focus();update();const b=kind&&$('yard-build-'+kind);if(b&&!b.disabled)b.focus();}
  async function action(route,data){if(busy)return false;busy=true;update();try{await api(route,data);notify('Order accepted.');return true;}catch(e){notify(e.message);$('shipyard-help').textContent=e.message;return false;}finally{busy=false;update();}}
  $('shipyard-select').onchange=update;
  for(const id of ['shipyard-new','shipyard-new-dialog'])$(id).onclick=()=>{dialog.close();deploy();};
  $('shipyard-open').onclick=()=>open();$('shipyard-interact').onclick=()=>open(null,near()?.yard.id);
  $('shipyard-close').onclick=()=>dialog.close();dialog.addEventListener('close',update);
  $('ship-dock-find').onclick=()=>{const y=selected();if(y){dialog.close();locate(y.dock);}};
  $('ship-find').onclick=()=>{const v=selectedShip();if(v){dialog.close();locate(v);}};
  for(const kind of ['gunship','submarine','transport','carrier'])$('yard-build-'+kind).onclick=()=>{const v=selectedShip();return v?.destroyed?action('vehicles/replace',{kind:'ship',vesselKind:kind,id:v.id,yardId:selected()?.id}):action('ships',{kind,yardId:selected()?.id});};
  $('shipyard-retire').onclick=()=>{if(window.confirm('Dismantle this empty dock? No supplies are refunded.'))return action('shipyards/retire',{id:selected()?.id});};
  $('ship-recall').onclick=()=>{const v=selectedShip();if(v&&window.confirm('Retire '+shipName(v)+'? Its dock stays. No supplies are refunded.'))return action('ships/recall',{id:v.id,keepYard:true});};
  $('ramp-repair').onclick=()=>action('ships/ramp-repair',{id:selectedShip()?.id});
  $('dock-rebuild').onclick=()=>action('logistics/repair',{kind:'dock',id:selected()?.id});
  $('yard-board').onclick=async()=>{const v=boardingVessel();if(await action('ships/board',{id:v?.id})){dialog.close();boarded(v);}};
  return {update,open,near,selectedShip};
}
