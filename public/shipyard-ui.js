import { COSTS } from './logistics.js';
import { dockRecords, yardBuildError, SHIPYARD } from './shipyard.js';
import { shipKind, shipName, dockComplete } from './ship.js';

export function shipyardUI({state,api,notify,deploy,locate}) {
  const $=id=>document.getElementById(id);
  const selected=()=>dockRecords(state().world).find(y=>y.id===$('shipyard-select').value);
  const kind=()=>$('shipyard-kind').value;
  function update(){
    const {world,me,connected}=state();if(!world||!me)return;
    const yards=dockRecords(world).filter(y=>y.owner===me.id),select=$('shipyard-select'),old=select.value;
    const entries=yards.map(y=>{const s=world.ships.find(s=>(s.yardId||s.id)===y.id);return[y.id,`Yard ${Math.floor(y.dock.x)}:${Math.floor(y.dock.y)} / ${y.dockDestroyed?'damaged':!dockComplete(y)?'arriving':s?s.destroyed?'ship lost':s.assemblyRemaining>0?'building '+Math.ceil(s.assemblyRemaining)+'s':shipName(s):'empty'}`];});
    const signature=JSON.stringify(entries);if(select.dataset.signature!==signature){select.replaceChildren(...entries.map(([value,textContent])=>Object.assign(document.createElement('option'),{value,textContent})));if(entries.some(e=>e[0]===old))select.value=old;select.dataset.signature=signature;}
    const yard=selected(),v=world.ships.find(s=>s.owner===me.id&&shipKind(s)===kind());
    const price=COSTS[kind()==='gunship'?'ship':kind()];
    const reason=!connected?'Reconnect first.':me.body!=='robot'?'Return to your robot first.':me.life==='disabled'?'Revive your robot first.':yardBuildError(world,yard,me.id,kind(),v?.destroyed?v:null) || (world.logistics.supplies<price?`Need ${price} supplies.`:null);
    $('shipyard-build').disabled=!!reason;$('shipyard-build').textContent=(v?.destroyed?'Rebuild ':'Build ')+shipName({kind:kind()})+' / '+price+' SUP';
    $('shipyard-help').textContent=reason||`12s assembly. Existing dock retained; ${SHIPYARD.max} yards and four vessels maximum per campaign.`;
    $('shipyard-new').disabled=!connected||me.body!=='robot'||world.logistics.supplies<COSTS.shipyard||yards.length>=SHIPYARD.perOwner||dockRecords(world).length>=SHIPYARD.max;
    $('shipyard-find').disabled=!yard;
    $('shipyard-retire').disabled=!connected||me.body!=='robot'||!yard||world.ships.some(s=>(s.yardId||s.id)===yard?.id);
    const vessel=world.ships.find(s=>s.id===$('navy-vessel').value),hp=world.logistics.durability['ramp:'+vessel?.id];
    $('ramp-repair').disabled=!connected||!vessel||!vessel.rampGun?.destroyed&&(!hp||hp.health>=hp.max);
  }
  async function action(route,data){try{await api(route,data);notify('Order accepted.');}catch(e){notify(e.message);}}
  $('shipyard-select').onchange=update;$('shipyard-kind').onchange=update;
  $('shipyard-new').onclick=deploy;
  $('shipyard-find').onclick=()=>{const y=selected();if(y)locate(y.dock);};
  $('shipyard-build').onclick=()=>{const {world,me}=state(),v=world.ships.find(s=>s.owner===me.id&&shipKind(s)===kind());return v?.destroyed?action('vehicles/replace',{kind:'ship',id:v.id,yardId:selected()?.id}):action('ships',{kind:kind(),yardId:selected()?.id});};
  $('shipyard-retire').onclick=()=>action('shipyards/retire',{id:selected()?.id});
  $('ramp-repair').onclick=()=>action('ships/ramp-repair',{id:$('navy-vessel').value});
  return {update};
}
