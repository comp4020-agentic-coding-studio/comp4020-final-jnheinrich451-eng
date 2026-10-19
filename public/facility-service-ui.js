import { isHelipad } from './helicopter.js';
import { SERVICE_KINDS, serviceName, serviceState, serviceQuote, serviceVersion, serviceError, nearbyService } from './facility-service.js';

export function facilityServiceUI({state,api,notify,manage,airSupport,stop}) {
  const panel=document.createElement('aside');panel.id='facility-service';panel.className='facility-service';panel.hidden=true;
  panel.setAttribute('aria-label','Dock and airbase workshop');
  panel.innerHTML='<button class="service-close" aria-label="Close workshop">×</button><h2></h2><p class="service-status"></p><div class="service-choices"></div><p class="service-help"></p><button class="service-manage">Dock controls</button>';
  document.querySelector('.battlefield').append(panel);
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
    panel.querySelector('.service-status').textContent=(vehicle?serviceName(vehicle.kind)+(assembling?' / assembling '+Math.ceil(air?vehicle.remaining:vehicle.assemblyRemaining)+'s':vehicle.destroyed?' / lost':' / assigned'):'Empty slot')+' · '+Math.floor(world.logistics.groundSupplies)+' GND available';
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
      const kind=button.dataset.kind,price=serviceQuote(kind,vehicle);
      const reason=serviceError(world,current.type,current.id,me.id,kind,players);
      button.textContent=(vehicle&&!vehicle.destroyed?'Exchange → ':'Build ')+serviceName(kind)+' / '+price.due+' GND';
      const breakdown=document.createElement('small');breakdown.textContent=price.cost+' price − '+price.credit+' credit';button.append(breakdown);
      button.title=reason||`${price.cost} GND price − ${price.credit} trade-in = ${price.due} GND. 60s assembly.`;
      button.disabled=busy||!!reason||world.logistics.groundSupplies+1e-8<price.due;
      button.setAttribute('aria-label',button.textContent);
    }
    const reason=serviceError(world,current.type,current.id,me.id,(isHelipad(facility)?'helicopter':SERVICE_KINDS[current.type][0]),players);
    if(reason)panel.querySelector('.service-help').textContent=reason;
  }
  async function order(kind){
    if(busy||!current)return;
    const {world}=state(),selection={...current},vehicle=serviceState(world,current.type,current.id).vehicle;
    busy=true;update();
    try{await api('facilities/vehicle',{...selection,kind,expected:serviceVersion(vehicle),orderId:crypto.randomUUID()});notify('Vehicle assembly started / 60s.');}
    catch(e){notify(e.message);}finally{busy=false;update();}
  }
  return {update,open,close,active:()=>!panel.hidden};
}
