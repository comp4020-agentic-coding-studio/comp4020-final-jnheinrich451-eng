import { ECONOMY, COSTS, emergencyTankError, readyFactory } from './logistics.js';

export function logisticsUI({ state, api, deploy, locate, stop, notify }) {
  const $=id=>document.getElementById(id), dialog=$('logistics-dialog');
  function options(id,entries){
    const select=$(id),old=select.value,signature=JSON.stringify(entries);
    if(select.dataset.signature===signature)return;
    select.replaceChildren(...entries.map(([value,textContent])=>Object.assign(document.createElement('option'),{value,textContent})));
    select.dataset.signature=signature;if(entries.some(e=>e[0]===old))select.value=old;
  }
  async function action(route,data){try{await api('logistics/'+route,data);}catch(error){$('logistics-message').textContent=error.message;}}
  $('supplies-button').onclick=()=>{stop();update();dialog.showModal();};
  for(const button of document.querySelectorAll('[data-logistics-deploy]'))button.onclick=()=>{dialog.close();deploy(button.dataset.logisticsDeploy);};
  $('emergency-tank').onclick=()=>{dialog.close();deploy('tank',true);};
  $('emergency-orbit').onclick=async()=>{try{await api('recovery/orbit',{});notify('Emergency core available. Choose a new landing site.');}catch(e){notify(e.message);}};
  $('recycler-collect').onclick=()=>{const value=$('salvage-target').value,split=value.indexOf(':');return action('command',{id:$('recycler-select').value,action:value.slice(0,split)==='site'?'collect':'recover',targetId:value.slice(split+1)});};
  $('recycler-stop').onclick=()=>action('command',{id:$('recycler-select').value,action:'stop'});
  $('recycler-deliver').onclick=()=>action('command',{id:$('recycler-select').value,action:'deliver',targetId:$('uplink-select').value});
  $('cargo-launch').onclick=async()=>{const station=state().world.logistics.facilities.find(f=>f.id===$('uplink-select').value);try{await api('logistics/launch',{id:station?.id});dialog.close();locate({x:station.x+1.5,y:station.y+1.5});notify('Cargo rocket launching. Supplies arrive when it clears the atmosphere.');}catch(e){$('logistics-message').textContent=e.message;}};
  $('logistics-rebuild').onclick=()=>{const [kind,id]=$('logistics-repair').value.split(':');return action('repair',{kind,id});};
  $('logistics-cancel').onclick=()=>action('cancel',{id:$('logistics-order').value});
  $('recycler-locate').onclick=()=>{const r=state().world.logistics.recyclers.find(r=>r.id===$('recycler-select').value);if(r){dialog.close();locate(r);}};
  function update(){
    const {world,me,connected,canManage}=state(),l=world?.logistics;if(!l)return;
    const rising=l.supplies<ECONOMY.reserve;$('supplies-button').textContent=`SUP ${Math.floor(l.supplies)}${rising?' ▲':''}`;
    $('supplies-button').setAttribute('aria-label',`Supplies ${Math.floor(l.supplies)}${rising?', refilling':''}. Open logistics`);
    $('logistics-balance').textContent=`${Math.floor(l.supplies)} / ${ECONOMY.capacity} supplies shared by the room. +${ECONOMY.income}/s while running, until ${ECONOMY.reserve}. Salvage shipments can fill the rest.`;
    const allowed=connected&&me?.life==='active'&&me.body==='robot';
    for(const b of document.querySelectorAll('[data-logistics-deploy]'))b.disabled=!allowed||l.supplies<COSTS[b.dataset.logisticsDeploy];
    const reason=emergencyTankError(world);$('emergency-tank').disabled=!allowed||!!reason;
    $('emergency-reason').textContent=reason||'One free HE tank can restore the offensive. Choose a clear land drop site.';
    $('emergency-orbit').hidden=me?.life!=='disabled'||world.cores.length>0;
    options('recycler-select',l.recyclers.filter(r=>canManage(r.owner)).map(r=>[r.id,`Recycler / ${r.cargo}/${ECONOMY.cargo} cargo / ${r.remaining>0?'incoming':r.blocked?'route blocked':r.path.length?'driving':r.task?.action||'idle'}`]));
    options('salvage-target',[...(world.sites||[]).filter(s=>s.state==='conquered'&&(l.salvage[s.id]??ECONOMY.salvage)>0).map(s=>['site:'+s.id,`${s.name} / ${l.salvage[s.id]??ECONOMY.salvage} salvage / ${s.x}:${s.y}`]),...l.crates.map(c=>['crate:'+c.id,`Recover ${c.amount} cargo / ${Math.floor(c.x)}:${Math.floor(c.y)}`])]);
    options('uplink-select',l.facilities.filter(f=>f.kind==='uplink').map(f=>[f.id,`Launch station ${f.x}:${f.y} / ${f.cargo} cargo${f.remaining>0?' / building':f.launch>0?' / launching '+Math.ceil(f.launch)+'s':''}`]));
    const repairs=[...world.ships.filter(s=>s.dockDestroyed&&canManage(s.owner)).map(s=>['dock:'+s.id,`Dock ${s.dock.x}:${s.dock.y} / ${COSTS.dockRepair} supplies`]),...world.airbases.filter(b=>b.destroyed&&canManage(b.owner)).map(b=>['airbase:'+b.id,`Airbase ${b.x}:${b.y} / ${COSTS.baseRepair} supplies`])];
    options('logistics-repair',repairs);
    const objects=[...world.airbases,...world.ships,...world.artillery];
    options('logistics-order',Object.entries(l.jobs).filter(([id,j])=>j.kind!=='repair'&&objects.some(o=>o.id===id&&canManage(o.owner))).map(([id,j])=>[id,`${j.kind} / ${Math.ceil(j.remaining)}s / cancel returns ${Math.floor(j.cost/2)}`]));
    for(const id of ['recycler-collect','recycler-stop','recycler-deliver','recycler-locate'])$(id).disabled=!allowed||!$('recycler-select').value||(id==='recycler-collect'&&!$('salvage-target').value)||(id==='recycler-deliver'&&!$('uplink-select').value);
    $('cargo-launch').disabled=!allowed||!$('uplink-select').value;
    $('logistics-rebuild').disabled=!allowed||!$('logistics-repair').value;
    $('logistics-cancel').disabled=!allowed||!$('logistics-order').value;
    options('construction-method',[['orbital','Orbital / full cost / immediate delivery'],...l.facilities.filter(readyFactory).map(f=>[f.id,`Factory ${f.x}:${f.y} / 40% cheaper / 20s`])]);
  }
  return {update};
}
