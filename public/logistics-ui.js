import { dockRecords } from './shipyard.js';
import { recoveryCores } from './survival.js';
import { ECONOMY, COSTS, emergencyTankError, supportSources, salvageReceivers, readyFactory, supplyReserve } from './logistics.js';
import { airSize } from './helicopter.js';

export function logisticsUI({ state, api, deploy, locate, stop, notify }) {
  const $=id=>document.getElementById(id), dialog=$('logistics-dialog');
  let launching=false;
  function launchStatus(stationId){
    const {world,me,connected,paused}=state(),l=world?.logistics;
    const station=l?.facilities.find(f=>f.id===stationId&&f.kind==='uplink');
    const blocked=(label,reason)=>({disabled:true,label,reason});
    if(!connected)return blocked('Send to orbit / Offline','Reconnect to send cargo.');
    if(paused)return blocked('Send to orbit / Paused','Resume the battle to send cargo.');
    if(!station||station.remaining>0||l.jobs?.[station.id])return blocked('Send to orbit / Unavailable','Choose a completed launch station.');
    if(me?.life!=='active'||!['robot','recycler'].includes(me.body))return blocked('Send to orbit','Use your robot or recycler to send cargo.');
    if(launching)return blocked('Sending to orbit…','Launch requested.');
    if(station.launch>0)return blocked('Launching / '+Math.ceil(station.inFlight||0)+' SUP','Cargo is on its way to orbit.');
    if(station.cooldown>0)return blocked('Rocket returning / '+Math.ceil(station.cooldown)+'s',Math.ceil(station.cargo||0)+' SUP stored; wait for the rocket to return.');
    if(!station.cargo)return blocked('Send to orbit / No cargo','Park a loaded recycler beside this station to unload salvage.');
    if(l.supplies>=ECONOMY.capacity)return blocked('Send to orbit / ORB full','Orbital storage is full. Cargo stays at the station.');
    return {disabled:false,label:'Send to orbit / '+Math.ceil(station.cargo)+' SUP',reason:'Launch stored salvage. Supplies arrive when the rocket clears the atmosphere.'};
  }
  async function launch(stationId,overview=false){
    const status=launchStatus(stationId);if(status.disabled)return;
    const station=state().world.logistics.facilities.find(f=>f.id===stationId);
    launching=true;update();
    try{
      await api('logistics/launch',{id:stationId});
      if(overview){dialog.close();locate({x:station.x+1.5,y:station.y+1.5});}
      notify('Cargo rocket launching. Supplies arrive when it clears the atmosphere.');
    }catch(e){if(dialog.open)$('logistics-message').textContent=e.message;else notify(e.message);}
    finally{launching=false;update();}
  }
  const repairSites=()=>{
    const {world,canManage}=state();
    return [
      ...dockRecords(world).filter(s=>s.dockDestroyed&&canManage(s.owner)).map(s=>({value:'dock:'+s.id,name:'Dock',x:s.dock.x,y:s.dock.y,cx:s.dock.x,cy:s.dock.y})),
      ...world.airbases.filter(b=>b.destroyed&&canManage(b.owner)).map(b=>({value:'airbase:'+b.id,name:b.kind==='helipad'?'Helipad':'Airbase',x:b.x,y:b.y,cx:b.x+airSize(b).width/2,cy:b.y+airSize(b).height/2}))
    ];
  };
  function options(id,entries){
    const select=$(id),old=select.value,signature=JSON.stringify(entries);
    if(select.dataset.signature===signature)return;
    select.replaceChildren(...entries.map(([value,textContent])=>Object.assign(document.createElement('option'),{value,textContent})));
    select.dataset.signature=signature;if(entries.some(e=>e[0]===old))select.value=old;
  }
  async function action(route,data){try{await api('logistics/'+route,data);}catch(error){$('logistics-message').textContent=error.message;}}
  function open(stationId,repairId){
    stop();update();if(stationId)$('uplink-select').value=stationId;
    const {me}=state(),sites=repairSites(),nearest=sites.find(s=>s.value==='airbase:'+repairId)||sites.sort((a,b)=>Math.hypot(a.cx-me.x,a.cy-me.y)-Math.hypot(b.cx-me.x,b.cy-me.y))[0];
    if(nearest)$('logistics-repair').value=nearest.value;
    update();dialog.showModal();dialog.querySelector('button').focus();
  }
  $('supplies-button').onclick=()=>open();
  for(const button of document.querySelectorAll('[data-logistics-deploy]'))button.onclick=()=>{dialog.close();deploy(button.dataset.logisticsDeploy);};
  $('emergency-tank').onclick=()=>{dialog.close();deploy('tank',true);};
  $('emergency-orbit').onclick=async()=>{try{await api('recovery/orbit',{});notify('Emergency core available. Choose a new landing site.');}catch(e){notify(e.message);}};
  $('recycler-collect').onclick=()=>{const value=$('salvage-target').value,split=value.indexOf(':');return action('command',{id:$('recycler-select').value,action:value.slice(0,split)==='site'?'collect':value.slice(0,split)==='wreck'?'wreck':'recover',targetId:value.slice(split+1)});};
  $('recycler-stop').onclick=()=>action('command',{id:$('recycler-select').value,action:'stop'});
  $('recycler-deliver').onclick=()=>action('command',{id:$('recycler-select').value,action:'deliver',targetId:$('uplink-select').value});
  $('cargo-launch').onclick=()=>launch($('uplink-select').value,true);
  const repairSelection=()=>{const value=$('logistics-repair').value,split=value.indexOf(':');return {kind:value.slice(0,split),id:value.slice(split+1)};};
  $('logistics-rebuild').onclick=()=>{const selection=repairSelection(),site=repairSites().find(s=>s.value===selection.kind+':'+selection.id);if(site){dialog.close();locate({x:site.cx,y:site.cy});}};
  $('logistics-cancel').onclick=()=>action('cancel',{id:$('logistics-order').value});
  $('recycler-locate').onclick=()=>{const r=state().world.logistics.recyclers.find(r=>r.id===$('recycler-select').value);if(r){dialog.close();locate(r);}};
  function update(){
    const {world,me,connected,buildings=[],canManage}=state(),l=world?.logistics;if(!l)return;
    const reserve=world.supplyReserve||supplyReserve(1),rising=connected&&(l.supplies<reserve.orbital||(l.groundSupplies||0)<reserve.ground);$('supplies-button').textContent='GND '+Math.floor(l.groundSupplies||0)+' /\nORB '+Math.floor(l.supplies);
    $('supplies-button').setAttribute('aria-label',`Ground supplies ${Math.floor(l.groundSupplies||0)}, orbital supplies ${Math.floor(l.supplies)}${rising?', refilling':''}. Open logistics`);
    $('logistics-balance').textContent=`Ground ${Math.floor(l.groundSupplies||0)} / ${ECONOMY.capacity}: local building and repairs. Orbital ${Math.floor(l.supplies)} / ${ECONOMY.capacity}: orbital delivery. Shared by all teammates and cores. ${reserve.players} connected player${reserve.players===1?'':'s'}: ORB +${ECONOMY.income}/s up to ${reserve.orbital}; GND +${ECONOMY.groundIncome}/s up to ${reserve.ground}, while the map is running. Salvage can exceed these refill thresholds.`;
    const operating=connected&&me?.life==='active'&&['robot','recycler'].includes(me.body),allowed=operating&&me.body==='robot';
    for(const b of document.querySelectorAll('[data-logistics-deploy]'))b.disabled=!allowed||l.supplies<COSTS[b.dataset.logisticsDeploy];
    const reason=emergencyTankError(world);$('emergency-tank').disabled=!allowed||!!reason;
    $('emergency-reason').textContent=reason||'One free HE tank can restore the offensive. Choose a clear land drop site.';
    $('emergency-orbit').hidden=me?.life!=='disabled'||recoveryCores(world).length>0;
    options('recycler-select',l.recyclers.filter(r=>r.kind!=='builder'&&(canManage(r.owner)||r.occupant===me?.id)).map(r=>[r.id,`Recycler / ${Math.ceil(r.cargo)}/${ECONOMY.cargo} cargo / ${r.remaining>0?'incoming':r.occupant?'occupied':r.blocked?'route blocked':r.path.length?'driving':r.task?.action||'idle'}`]));
    options('salvage-target',[...(world.sites||[]).filter(s=>s.state==='conquered'&&(l.salvage[s.id]??ECONOMY.salvage)>0).map(s=>['site:'+s.id,`${s.name} / ${l.salvage[s.id]??ECONOMY.salvage} salvage / ${s.x}:${s.y}`]),...Object.values(l.recovery||{}).filter(w=>w.medium==='land'&&w.amount>0).map(w=>['wreck:'+w.id,`Friendly ${w.kind} wreck / ${Math.ceil(w.amount)} salvage / ${Math.floor(w.x)}:${Math.floor(w.y)}`]),...l.crates.map(c=>['crate:'+c.id,`${c.kind==='remains'?'Alien remains':'Recover'} ${c.amount} cargo / ${Math.floor(c.x)}:${Math.floor(c.y)}`])]);
    options('uplink-select',salvageReceivers(world).map(f=>[f.id,f.kind==='uplink'?`Orbital rocket ${f.x}:${f.y} / ${f.cargo} stored / ${f.inFlight||0} airborne${f.cooldown>0?' / returns '+Math.ceil(f.cooldown)+'s':''}`:`Ground receiver ${f.x}:${f.y} / ${f.kind}`]));
    const repairs=[...dockRecords(world).filter(s=>s.dockDestroyed&&canManage(s.owner)).map(s=>['dock:'+s.id,`Dock ${s.dock.x}:${s.dock.y} / permanent ruin`]),...world.airbases.filter(b=>b.destroyed&&canManage(b.owner)).map(b=>['airbase:'+b.id,`Airbase ${b.x}:${b.y} / permanent ruin`])];
    options('logistics-repair',repairs);
    const objects=[...world.airbases,...world.ships,...world.artillery,...world.tanks,...l.facilities,...l.recyclers,...buildings];
    options('logistics-order',Object.entries(l.jobs).filter(([id,j])=>j.kind!=='repair'&&objects.some(o=>o.id===id&&canManage(o.owner))).map(([id,j])=>[id,`${j.kind} / ${Math.ceil(j.remaining)}s / cancel returns ${Math.floor(j.cost/2)}`]));
    for(const id of ['recycler-collect','recycler-stop','recycler-deliver','recycler-locate'])$(id).disabled=!allowed||!$('recycler-select').value||(id==='recycler-collect'&&!$('salvage-target').value)||(id==='recycler-deliver'&&!$('uplink-select').value);
    const status=launchStatus($('uplink-select').value);
    $('cargo-launch').disabled=status.disabled;$('cargo-launch').textContent=status.label;$('cargo-launch').title=status.reason;
    $('logistics-rebuild').disabled=!repairs.length;
    $('logistics-rebuild').textContent='Locate ruin';
    $('logistics-repair-help').textContent='Destroyed facilities cannot be repaired and do not occupy a slot. Use Deploy (B) to build a new one. Damaged surviving vehicles still receive normal repairs.';
    $('logistics-cancel').disabled=!allowed||!$('logistics-order').value;
  }
  $('uplink-select').onchange=()=>update();
  $('logistics-repair').onchange=()=>update();
  return {update,open,launch,launchStatus};
}
