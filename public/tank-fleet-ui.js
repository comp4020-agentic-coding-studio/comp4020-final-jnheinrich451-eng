import { tankRecords, TANK } from './tank.js';
import { COSTS } from './logistics.js';

export function tankFleetUI({state,api,locate,notify,replaced}){
  const $=id=>document.getElementById(id),select=document.createElement('select');
  select.id='tank-select';select.setAttribute('aria-label','Your tanks');
  const label=document.createElement('label');label.textContent='Your tanks';label.append(select);
  $('field-equipment').prepend(label);
  let busy=false;
  const records=()=>tankRecords(state().world).filter(({tank})=>tank.owner===state().me?.id);
  const selected=()=>records().find(({tank})=>tank.id===select.value);
  function update(){
    const {world,me,connected}=state();if(!world||!me)return;
    const entries=records(),ids=entries.map(({tank})=>tank.id),old=select.value;
    if(JSON.stringify(ids)!==select.dataset.ids){
      select.replaceChildren(...ids.map(value=>Object.assign(document.createElement('option'),{value})));
      if(ids.includes(old))select.value=old;select.dataset.ids=JSON.stringify(ids);
    }
    entries.forEach(({tank,carrier},i)=>{
      const job=world.logistics?.jobs?.[tank.id],point=carrier||tank;
      const status=carrier?(carrier.kind==='helicopter'?'HELICOPTER SLING':'ABOARD TRANSPORT'):tank.destroyed?'DESTROYED':job?`BUILDING ${Math.ceil(job.remaining)}s`:tank.elapsed<TANK.duration?'ARRIVING':tank.occupant?'OCCUPIED':tank.guard?.targetId!=null?'ENGAGING':'GUARD';
      select.options[i].textContent=`Tank ${tank.id.slice(0,6)} / ${tank.weapon||'HE'} / ${status} / ${Math.floor(point.x)}:${Math.floor(point.y)}`;
    });
    label.hidden=!entries.length;
    const record=selected(),v=record?.tank,button=$('tank-replace');
    $('tank-find').disabled=!record;$('tank-find').textContent=record?.carrier?'Find selected tank / carrier':'Find selected tank';
    button.hidden=!v?.destroyed||!!v.replacedBy||!!record?.carrier;
    const reason=!connected?'Reconnect first.':me.body!=='robot'||me.life!=='active'?'Return to your active robot.':v?.replacement>.001?`Replacement ready in ${Math.ceil(v.replacement)}s.`:(world.logistics?.supplies||0)<COSTS.tank?`Need ${COSTS.tank} ORB for replacement.`:null;
    button.textContent=v?.replacement>.001?'Replacement ready in '+Math.ceil(v.replacement)+'s':`Build new tank / ${COSTS.tank} ORB / original site`;
    button.disabled=busy||!v?.destroyed||!!record?.carrier||!!reason;button.title=reason||'Build a new tank at the original drop site; the old wreck stays.';
  }
  select.onchange=update;
  $('tank-find').onclick=()=>{const record=selected();if(record)locate(record.carrier||record.tank);};
  $('tank-replace').onclick=async()=>{
    const record=selected();if(busy||!record||$('tank-replace').disabled)return;
    busy=true;update();
    try{const result=await api('vehicles/replace',{kind:'tank',id:record.tank.id});replaced(result.vehicle);}
    catch(e){notify(e.message);}finally{busy=false;update();}
  };
  return {update};
}
