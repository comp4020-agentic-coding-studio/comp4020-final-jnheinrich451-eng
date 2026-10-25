import { hullHealth, hullMaximum } from './vehicle.js';
import { isHelipad } from './helicopter.js';
import { returnDockError } from './naval-orders.js';
import { SERVICE_KINDS, serviceName, serviceState, serviceQuote, serviceVersion, serviceError, nearbyService, carrierServiceAircraft, carrierRecycleQuote } from './facility-service.js';

const refundLabel=refund=>[['groundSupplies','GND'],['supplies','ORB']].filter(([pool])=>refund[pool]>0).map(([pool,label])=>'+'+Number(refund[pool].toFixed(2))+' '+label).join(' / ')||'0 SUP';

export function facilityServiceUI({state,api,notify,manage,airSupport,stop}) {
  const panel=document.createElement('aside');panel.id='facility-service';panel.className='facility-service';panel.hidden=true;
  panel.setAttribute('aria-label','Dock and airbase workshop');
  panel.innerHTML='<button class="service-close" aria-label="Close workshop">×</button><h2></h2><p class="service-status"></p><div class="service-choices"></div><p class="service-help"></p><button class="service-manage">Dock controls</button>';
  document.querySelector('.battlefield').append(panel);
  const rebuild=document.createElement('button');rebuild.className='service-rebuild';rebuild.hidden=true;panel.append(rebuild);
  const recall=document.createElement('button');recall.className='service-return';recall.textContent='Return ship to dock';recall.hidden=true;panel.append(recall);
  recall.onclick=async()=>{
    if(busy||current?.type!=='dock')return;
    const {world}=state(),v=serviceState(world,current.type,current.id).vehicle;
    if(returnDockError(world,v))return;
    busy=true;update();
    try{await api('ships/order',{id:v.id,action:'dock',orderId:crypto.randomUUID(),expectedOrderId:v.remoteOrder?.id||null});notify('Ship returning to its home dock.');}
    catch(e){notify(e.message);}finally{busy=false;update();}
  };
  let current=null,entered=null,dismissed=null,busy=false,signature='';
  const key=s=>s?`${s.type}:${s.id}`:null;
  const close=()=>{dismissed=key(current);current=null;panel.hidden=true;};
  panel.querySelector('.service-close').onclick=close;
  panel.querySelector('.service-manage').onclick=()=>{const id=current?.id,air=current?.type==='airbase';close();if(air)airSupport(id);else manage(id);};
  function open(value){current=value;dismissed=null;stop();update();}

  function update(){
    const {world,me,connected,blocked,players=[]}=state();if(!world||!me)return;
    const near=nearbyService(world,me),nearKey=key(near);
    if(nearKey!==entered){entered=nearKey;dismissed=null;current=near;if(near)stop();}
    if(!near){current=null;dismissed=null;}
    if(near&&dismissed!==nearKey&&!current)current=near;
    panel.hidden=!current||blocked||!connected||me.body!=='robot'||me.life!=='active';
    if(panel.hidden)return;
    const {facility,vehicle}=serviceState(world,current.type,current.id);
    if(!facility){close();return;}
    const air=current.type==='airbase', assembling=air?vehicle?.state==='delivering':vehicle?.assemblyRemaining>0;
    panel.querySelector('h2').textContent=air?(isHelipad(facility)?'Helipad workshop':'Airbase workshop'):'Dock workshop';
    const ruined=air?facility.destroyed:facility.dockDestroyed;
    recall.hidden=air||ruined||!vehicle||vehicle.destroyed||vehicle.kind==='submarine';
    if(!recall.hidden){
      const returning=vehicle.remoteOrder?.kind==='dock'&&vehicle.remoteOrder.phase==='moving';
      recall.disabled=busy||returning||!!returnDockError(world,vehicle);
      recall.textContent=returning?'Ship returning to dock...':'Return ship to dock';
      recall.title=returnDockError(world,vehicle)||vehicle.remoteOrder?.reason||'Sail home and align at this berth';
    }
    rebuild.hidden=true;
    panel.querySelector('.service-choices').hidden=ruined;
    panel.querySelector('.service-manage').hidden=ruined;
    if(ruined){
      panel.querySelector('.service-status').textContent='Permanent ruin / slot released';
      panel.querySelector('.service-help').textContent='Open Deploy (B) to build a new facility. This ruin cannot be repaired.';
      return;
    }
    panel.querySelector('.service-status').textContent=(vehicle?serviceName(vehicle.kind)+(assembling?' / assembling '+Math.ceil(air?vehicle.remaining:vehicle.assemblyRemaining)+'s':vehicle.destroyed?' / lost':air?' / assigned':` / active / ${Math.ceil(hullHealth(vehicle))}/${hullMaximum(vehicle)} HP`):'Empty slot')+' · '+Math.floor(world.logistics.groundSupplies)+' GND available';
    panel.querySelector('.service-help').textContent='60s drone assembly. Exchange: 80% of recorded GND payment; no cash refund. '+(vehicle&&!vehicle.purchase?'This older vehicle has no purchase receipt, so no trade-in credit.':'ORB purchases and free vehicles give no GND credit.');
    panel.querySelector('.service-manage').textContent=air?'Aircraft / recall (H)':'Dock controls';
    const next=current.type+(isHelipad(facility)?':heli':'');
    if(signature!==next){
      const choices=panel.querySelector('.service-choices');choices.replaceChildren();
      for(const kind of SERVICE_KINDS[current.type].filter(kind=>!air||isHelipad(facility)===(kind==='helicopter'))){
        const button=document.createElement('button');button.dataset.kind=kind;
        button.onclick=()=>order(kind);choices.append(button);
      }signature=next;
    }
    for(const button of panel.querySelectorAll('[data-kind]')){
      const kind=button.dataset.kind,price=serviceQuote(kind,vehicle),recycle=air?{aircraft:[],refund:{groundSupplies:0,supplies:0}}:carrierRecycleQuote(world,vehicle,kind);
      const reason=serviceError(world,current.type,current.id,me.id,kind,players);
      button.textContent=(vehicle&&!vehicle.destroyed?'Exchange → ':'Build ')+serviceName(kind)+' / '+price.due+' GND';
      const breakdown=document.createElement('small');breakdown.textContent=price.cost+' price − '+price.credit+' credit';button.append(breakdown);
      button.title=reason||`${price.cost} GND price − ${price.credit} trade-in = ${price.due} GND. 60s assembly.`;
      if(recycle.aircraft.length){const note=document.createElement('small');note.textContent=`Recycle ${recycle.aircraft.length} aircraft / ${refundLabel(recycle.refund)}`;button.append(note);button.title+=' Aircraft recycled automatically: '+refundLabel(recycle.refund)+'.';}
      button.disabled=busy||!!reason||world.logistics.groundSupplies+recycle.refund.groundSupplies+1e-8<price.due;
      button.setAttribute('aria-label',button.textContent);
    }
    const reason=serviceError(world,current.type,current.id,me.id,(isHelipad(facility)?'helicopter':SERVICE_KINDS[current.type][0]),players);
    if(reason)panel.querySelector('.service-help').textContent=reason;
    else if(!air&&carrierServiceAircraft(world,vehicle).length)panel.querySelector('.service-help').textContent='Another carrier keeps its aircraft. Other ship types automatically recycle the assigned parked aircraft for 50% of their actual payment, returned to GND or ORB. Free aircraft and missing receipts return 0 SUP. No confirmation; 60s ship assembly.';
  }
  async function order(kind){
    if(busy||!current)return;
    const {world}=state(),selection={...current},vehicle=serviceState(world,current.type,current.id).vehicle;
    busy=true;update();
    try{const result=await api('facilities/vehicle',{...selection,kind,expected:serviceVersion(vehicle),orderId:crypto.randomUUID()});notify('Vehicle assembly started / 60s.'+(result.recycledAircraft?` Recycled ${result.recycledAircraft} aircraft / ${refundLabel(result.refund)}.`:''));}
    catch(e){notify(e.message);}finally{busy=false;update();}
  }
  return {update,open,close,active:()=>!panel.hidden};
}
