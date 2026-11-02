import { COLONY, CROPS, cropById, bedReady, colonyPlacementError, colonyBuildCost } from './colonization.js';
import { createColonyRenderer, cropIcon } from './colony-art.js';
import { COLONY_DEPTH, colonyScreenDelta } from './colony-view.js';
import { receiveColonyPlayers, advanceColonyPlayers } from './colony-motion.js';
import { environmentAt, decorationItems, decorationAt, cinemaPosition } from './colony-ambience.js';
import { createColonyCinema } from './colony-cinema.js';
import { renderCampPanel, updateCinemaStatus } from './colony-camp-ui.js';
import { BED_INSPECTION, bedEdgeDistance, nearbyColonyBed } from './colony-nearby.js';

const $=id=>document.getElementById(id),canvas=$('colony-canvas'),renderer=createColonyRenderer(canvas);
const campaignId=new URLSearchParams(location.search).get('campaign');
const endpoint='/api/campaign-world/'+encodeURIComponent(campaignId||'')+'/';
const camera={x:36,y:29,tile:matchMedia('(max-width:760px)').matches?29:45};
const keys=new Set(),touch={x:0,y:0};
const renderedPlayers=new Map();
let cinema;
cinema=createColonyCinema({onStatus:()=>{if(cinema)updateCinemaStatus(cinema);}});
const placing=()=>['bed','sprinkler','campfire','cinema'].includes(mode);
let world=null,snapshot=null,state=null,source=null,live=false,ended=false,busy=false,mode='inspect',panel='intro',selected=null;
let pointer=null,drag=null,lastPacket=0,toastTimer=0,lastInput='',lastInputAt=0,inputSequence=Date.now(),renderKey='',frameTime=0,lastFrame=0,panFollow=true;
let reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const pageBuild=document.querySelector('meta[name="frontier-build"]')?.content;
let seenRuntime=null,seenRevision=-1,refreshingBuild=false;
let shipmentCrop=null;
let clockReceivedAt=0,clockSample=-1;
let automaticBed=false,manualInspectionPoint=null,lastNearbyCheck=0;
const dismissedBeds=new Set();
try{reduced ||=localStorage.getItem('frontier-colony-reduced')==='1';}catch{/* Preferences are optional. */}
$('effects-toggle').setAttribute('aria-pressed',String(reduced));

const bed=()=>state?.beds.find(b=>b.id===selected);
const fullState=()=>state&&({...state,world,players:snapshot?.players||[]});
const remainingText=seconds=>seconds<60?`${Math.max(0,Math.ceil(seconds))}s`:`${Math.floor(seconds/60)}m ${Math.ceil(seconds%60)}s`;
const editable=event=>event.target instanceof HTMLElement&&!!event.target.closest('input,textarea,select,[contenteditable=true]');
const canAct=()=>live&&!ended&&!snapshot?.room?.paused&&!busy;
function colonyMenuHref(view='colony',next='/campaigns/'){
  const url=new URL(next,location.href);
  if(url.origin===location.origin&&/^\/campaigns\/?$/.test(url.pathname))url.hash=new URLSearchParams({view,planet:world?.template||'morrow-v1',mode:'colonization'}).toString();
  return url.href;
}

function toast(message,error=false){clearTimeout(toastTimer);$('colony-toast').textContent=message;$('colony-toast').classList.toggle('error',error);$('colony-toast').hidden=false;toastTimer=setTimeout(()=>{$('colony-toast').hidden=true;},error?6500:3800);}
function setConnection(connected){live=connected;$('connection-dot').classList.toggle('live',connected&&!snapshot?.room?.paused);$('colony-connection').textContent=ended?'Expedition saved':!connected?'Reconnecting…':snapshot?.room?.state==='reconnecting'?'Waiting for your host':snapshot?.room?.paused?'Taking a little break':'Together, growing';if(!connected)stopInput();updateControls();}
function stopInput(){keys.clear();touch.x=touch.y=0;lastInput='';void sendInput(true);}
function markTool(){for(const b of document.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===mode||b.dataset.tool==='camp'&&['campfire','cinema'].includes(mode)));}
function setTool(next){
  mode=next;pointer=null;canvas.classList.toggle('placing',placing());$('placement-note').hidden=!placing();
  markTool();
  if(placing()){
    hideInspector();$('room-panel').hidden=true;$('room-open').setAttribute('aria-expanded','false');
    $('placement-title').textContent={bed:'Find a sunny spot',sprinkler:'A little rain, right where you need it',campfire:'A warm place to gather',cinema:'An evening under the stars'}[next];
    $('placement-reason').textContent=next==='cinema'?'Choose three clear tiles near your garden.':'Select clear ground near your hub.';
  }
  canvas.focus({preventScroll:true});
}
const inspectionWorker=()=>renderedPlayers.get(snapshot?.me?.id)||snapshot?.me;
function hideInspector({automatic=false}={}){
  if(!automatic)for(const item of state?.beds||[])if(bedEdgeDistance(item,inspectionWorker())<=BED_INSPECTION.leave)dismissedBeds.add(item.id);
  automaticBed=false;manualInspectionPoint=null;panel=null;$('inspector').hidden=true;document.body.classList.remove('colony-game-inspecting','colony-game-nearby');renderKey='';
}
function showPanel(next,id=null,{automatic=false}={}){
  panel=next;if(id!==null)selected=id;automaticBed=automatic&&next==='bed';
  const worker=inspectionWorker();manualInspectionPoint=!automatic&&['bed','garden'].includes(next)&&worker?{x:worker.x,y:worker.y,walked:false}:null;
  $('inspector').hidden=false;document.body.classList.add('colony-game-inspecting');document.body.classList.toggle('colony-game-nearby',automaticBed);renderKey='';renderPanel();
}
function inspectNearbyBed(worker){
  if(!worker||!state)return;
  for(const id of dismissedBeds){const item=state.beds.find(b=>b.id===id);if(!item||bedEdgeDistance(item,worker)>BED_INSPECTION.leave)dismissedBeds.delete(id);}
  if(!live||ended||busy||snapshot?.room?.paused||placing()||drag||!$('room-panel').hidden||$('colony-help-dialog').open||
      panel&&!['bed','garden','intro'].includes(panel)||editable({target:document.activeElement}))return;
  let releasedManual=false;
  if(manualInspectionPoint){
    const input=movement();manualInspectionPoint.walked ||=!!(input.x||input.y);
    if(!manualInspectionPoint.walked||Math.hypot(worker.x-manualInspectionPoint.x,worker.y-manualInspectionPoint.y)<.5)return;
    manualInspectionPoint=null;releasedManual=true;
  }
  // Keep a displayed action under the pointer stable while it is being used.
  if(!$('inspector').hidden&&$('inspector').querySelector(':active'))return;
  const next=nearbyColonyBed(state.beds,worker,automaticBed||releasedManual?selected:null,dismissedBeds);
  if(next){
    if(!automaticBed||panel!=='bed'||selected!==next.id){mode='inspect';markTool();showPanel('bed',next.id,{automatic:true});}
  }else if(automaticBed||releasedManual&&panel==='bed')hideInspector({automatic:true});
}
function focusBed(item){panFollow=false;const phone=matchMedia('(max-width:760px)').matches;camera.x=item.x+.5;camera.y=item.y+.5+(phone?1.8:1.2)/COLONY_DEPTH;}
// Auto-inspection must leave touch movement usable. Measure only on panel size
// changes, not during the animation loop, and keep the pad just above the sheet.
new ResizeObserver(entries=>{const height=Math.ceil(entries[0].borderBoxSize?.[0]?.blockSize||$('inspector').offsetHeight);document.body.style.setProperty('--nearby-panel-height',`${height}px`);}).observe($('inspector'));

async function request(path,data){
  const response=await fetch(path,data===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let result;try{result=await response.json();}catch{throw new Error('The ship did not answer. Please try again.');}
  if(!response.ok)throw Object.assign(new Error(result.error||'That task is not available yet.'),{status:response.status});return result;
}
async function act(action,data={}){
  if(!canAct()){if(!live)toast('Waiting for your expedition to reconnect.',true);else if(snapshot?.room?.paused)toast('Resume the expedition to tend your garden.');return;}
  busy=true;updateControls();
  try{
    const result=await request(endpoint+'colony',{action,requestId:crypto.randomUUID(),...data});
    if(result.snapshot)receive(result.snapshot);
    // Read the acknowledged state too: controls need not wait for the next stream tick.
    await loadWorld();
    toast(result.message||({plant:'A little beginning. Your seed is planted.',water:'A lovely drink for those roots.',harvest:'Freshly picked, and safely in your basket.',ship:'A little sunshine is on its way.','build-bed':'Your growing bed is ready.','build-sprinkler':'Let the sprinkler take care of the watering.',clear:'A fresh start for this bed.'}[action]||'All done.'));
    if(action==='build-bed'){
      const fresh=state.beds.find(b=>b.x===data.x&&b.y===data.y);setTool('inspect');if(fresh){focusBed(fresh);showPanel('bed',fresh.id);}
    }else if(action==='build-sprinkler'){setTool('inspect');showPanel('garden');}
    else if(action==='build-campfire'||action==='build-cinema'){
      setTool('camp');const item=decorationItems(state).find(d=>d.x===data.x&&d.y===data.y);if(item)focusBed(item);showPanel('camp');
    }
    else if(action==='ship')showPanel('shipment');
  }catch(error){toast(error.message,true);if(error.status===401||error.status===403){setConnection(false);}}
  finally{busy=false;renderKey='';renderPanel();updateControls();}
}
async function loadWorld(){const result=await request(endpoint+'world');if(result.mode!=='colonization')throw new Error('This save belongs to another mode. Open your expedition from the Colonization menu.');receive(result);}
function receive(value){
  if(ended||!value?.colony)return;
  const incomingBuild=value.build||value.clientBuild;
  if(pageBuild&&pageBuild!=='FRONTIER_CLIENT_BUILD'&&incomingBuild&&incomingBuild!==pageBuild){
    if(!refreshingBuild){refreshingBuild=true;stopInput();source?.close();location.reload();}return;
  }
  const newRuntime=value.runtimeId!==seenRuntime;
  if(newRuntime){seenRuntime=value.runtimeId;seenRevision=-1;}
  if(Number.isFinite(value.revision)&&value.revision<seenRevision)return;
  const newMotionSample=newRuntime||!snapshot||!Number.isFinite(value.revision)||value.revision>seenRevision;
  seenRevision=value.revision??seenRevision;
  if(value.world){world=value.world;for(const link of document.querySelectorAll('[data-colony-menu]'))link.href=colonyMenuHref();}
  if(!world)return;
  const first=!snapshot,previousShipments=state?.shipments||0;
  const packetTime=performance.now();
  if(newRuntime||clockSample!==value.colony.time||snapshot?.room?.paused!==value.room?.paused){clockSample=value.colony.time;clockReceivedAt=packetTime;}
  if(newMotionSample)receiveColonyPlayers(renderedPlayers,value.players||[],packetTime,newRuntime);
  snapshot=value;state=value.colony;lastPacket=packetTime;
  if(first){camera.x=state.hub.x+1.6;camera.y=state.hub.y+1;panFollow=false;$('colony-loading').hidden=true;showPanel(state.beds.length?'garden':'intro',null,{automatic:true});}
  if(value.build&&document.documentElement.dataset.build&&value.build!==document.documentElement.dataset.build){location.reload();return;}
  if(value.build)document.documentElement.dataset.build=value.build;
  $('colony-name').textContent=value.room?.name||'Our little outpost';$('colony-planet').textContent=`${world.name||'Your planet'} · Peaceful expedition`;
  $('materials-count').textContent=state.materials;$('crew-count').textContent=String(value.players?.length||1);
  $('bed-count').textContent=`${state.beds.length} / ${COLONY.bedLimit} growing beds`;
  $('bed-cost').textContent=colonyBuildCost(fullState(),'bed')===0?'First bed · a gift':`${COLONY.bedCost} materials`;
  $('sprinkler-cost').textContent=`${COLONY.sprinklerCost} materials`;
  $('shipment-count').textContent=state.shipment?'Shuttle is on its way':state.shipments?`${state.shipments} happy deliveries`:'Your first delivery';
  for(const item of document.querySelectorAll('[data-milestone]')){const done=!!state.milestones?.[item.dataset.milestone];item.classList.toggle('done',done);item.querySelector('i').textContent=done?'✓':String([...item.parentNode.children].indexOf(item)+1);}
  const nextStep=!state.milestones.firstPlant?'Plant your first seed':!state.milestones.firstHarvest?'Gather your first harvest':!state.milestones.firstShipment?'Send a sample shipment':'Garden established';
  if($('project-label'))$('project-label').textContent=nextStep;
  $('moss-message').textContent=mossAdvice();
  if(state.shipments>previousShipments&&!first)toast('A parcel from home! New materials and a little celebration for your garden.');
  setConnection(true);renderPanel();renderRoom();
}
function mossAdvice(){
  if(snapshot?.room?.paused)return 'Everything can wait. Your garden is safe while we take a little break.';
  if(!state.beds.length)return 'Your first growing bed is a gift from the ship. Find a sunny patch and make it yours.';
  if(state.beds.some(b=>bedReady(b)))return 'Something lovely is ready to pick. It will happily wait until you are.';
  if(state.beds.some(b=>b.crop&&b.water<=0))return 'A few roots would love a drink. Dry plants take a nap; they never disappear.';
  if(!state.milestones?.firstPlant)return 'Choose a seed from our little library. There is always another seed to try.';
  if(state.shipment)return 'The shuttle is carrying your harvest home. A fresh parcel is coming back soon.';
  if(Object.values(state.storage).some(n=>n>=2)&&!state.shipments)return 'Two matching samples make a lovely first parcel. Visit the orbital post when you are ready.';
  if(!state.sprinklers.length)return 'A sprinkler can tend nearby beds while you explore. No pipes or fuss.';
  return 'The sprinkler has the watering covered. Plant something different, or just enjoy the view.';
}
function connect(){
  source?.close();source=new EventSource(endpoint+'events');
  source.onmessage=event=>{try{receive(JSON.parse(event.data));}catch(error){console.error('Could not read expedition update',error);}};
  source.onerror=()=>{if(!ended)setConnection(false);};
  source.addEventListener('session-ended',event=>{let value={};try{value=JSON.parse(event.data);}catch{/* End gracefully even without an explanation. */}ended=true;source.close();setConnection(false);$('colony-loading').hidden=false;$('colony-loading').querySelector('h2').textContent='Your garden will be waiting.';$('loading-message').textContent=value.message||'This expedition has closed. Your progress is saved.';});
}

function updateControls(){
  const disabled=!canAct();for(const b of document.querySelectorAll('[data-colony-action]'))b.disabled=disabled||b.dataset.unavailable==='true';
  $('tool-bed').disabled=!live||ended||busy||snapshot?.room?.paused||!!state&&(state.beds.length>=COLONY.bedLimit||state.materials<colonyBuildCost(fullState(),'bed'));
  $('tool-sprinkler').disabled=!live||ended||busy||snapshot?.room?.paused||!!state&&(state.sprinklers.length>=COLONY.sprinklerLimit||state.materials<COLONY.sprinklerCost);
  for(const select of document.querySelectorAll('[data-camp-host]'))select.disabled=disabled||snapshot?.room?.ownerPilot!==snapshot?.me?.id;
}
function actionButton(id,text,action,data,css='soft-button',unavailable=false){const b=document.createElement('button');b.id=id;b.className=css;b.textContent=text;b.dataset.colonyAction=action;b.dataset.unavailable=String(unavailable);b.disabled=!canAct()||unavailable;b.onclick=()=>act(action,typeof data==='function'?data():data);return b;}
function textElement(tag,text,css){const node=document.createElement(tag);node.textContent=text;if(css)node.className=css;return node;}
function panelHeading(eyebrow,title){$('inspector-eyebrow').textContent=eyebrow;$('inspector-title').textContent=title;}
function renderPanel(){
  if(!state||!panel)return;
  const b=bed(),key=JSON.stringify([panel,selected,panel==='bed'?[b?.crop,b?.revision,Math.floor(b?.growth||0),Math.ceil(b?.water||0)]:null,state.beds.map(v=>[v.id,v.crop,bedReady(v),v.water>0]),state.materials,state.storage,state.shipments,Math.ceil(state.shipment?.remaining||0),busy,live,snapshot?.room?.paused,panel==='camp'?[state.environment,state.decorations,state.cinema?.revision,state.cinema?.playing]:null]);
  if(key===renderKey)return;renderKey=key;
  const body=$('inspector-body');$('inspector').dataset.panel=panel;
  // Preserve keyboard focus through routine growth updates.
  const focused=document.activeElement?.id,selection=document.activeElement?.dataset?.plant,scrollTop=$('inspector').scrollTop,skyOpen=$('camp-sky')?.open,creditsOpen=document.querySelector('.camp-credits')?.open;
  body.replaceChildren();
  if(panel==='intro'){
    panelHeading('FIRST PLANTING','Start a garden');
    body.append(textElement('p','Place a bed, choose a seed, then water it.','panel-copy'));
    const button=document.createElement('button');button.id='place-bed-gift';button.className='primary-button wide';button.textContent=state.beds.length?'Place another bed':'Place first bed · free';button.onclick=()=>{if(state.beds.length){setTool('bed');return;}const candidates=[{x:32,y:31},{x:32,y:27},{x:36,y:34}];const spot=candidates.find(p=>!colonyPlacementError(fullState(),'bed',p.x,p.y));if(spot)void act('build-bed',spot);else setTool('bed');};button.disabled=!canAct();body.append(button,textElement('p','Seeds and water are free.','keyboard-note'));
    const dismiss=document.createElement('button');dismiss.className='quiet-button dismiss-intro';dismiss.textContent='Explore';dismiss.onclick=hideInspector;body.append(dismiss);
  }else if(panel==='garden'){
    panelHeading('EXPEDITION','Garden');
    if(!state.beds.length){const button=document.createElement('button');button.className='primary-button wide';button.textContent='Place first bed · free';button.onclick=()=>setTool('bed');body.append(button);}
    else{
      const list=document.createElement('div');list.className='bed-list';
      state.beds.forEach((item,index)=>{const crop=cropById(item.crop),row=document.createElement('button');row.className='bed-row';row.dataset.bedId=item.id;row.dataset.selectBed=item.id;const dot=document.createElement('span');dot.className='bed-dot';dot.style.setProperty('--crop-color',crop?.color||'#cdb38a');const label=document.createElement('span');label.append(textElement('strong',crop?.name||`Growing bed ${index+1}`),textElement('small',!crop?'Ready for a seed':bedReady(item)?'Ripe and waiting':item.water<=0?'Having a nap · needs water':'Growing happily'));row.append(dot,label);if(bedReady(item))row.append(textElement('span','HARVEST','ready-label'));row.onclick=()=>{selected=item.id;focusBed(item);showPanel('bed',item.id);};list.append(row);});body.append(list);
    }
  }else if(panel==='bed'&&b){
    const crop=cropById(b.crop);panelHeading(`${automaticBed?'NEARBY · ':''}BED ${state.beds.indexOf(b)+1}`,crop?.name||'Choose a seed');
    if(!crop){
      const cards=document.createElement('div');cards.className='seed-cards';
      for(const seed of CROPS){const button=document.createElement('button');button.className='seed-card';button.dataset.plant=seed.id;button.dataset.colonyAction='plant';button.disabled=!canAct();const icon=document.createElement('span');icon.className='seed-art';icon.style.setProperty('--seed-bg',seed.id==='sundrop'?'#f3e1b6':seed.id==='moonberry'?'#ece1ec':'#e6edcc');icon.innerHTML=cropIcon(seed.id);const words=document.createElement('span');words.append(textElement('strong',seed.name),textElement('small',`${remainingText(seed.growTime)} · ${seed.yield} crops${seed.regrows?' · regrows':''}`));button.append(icon,words,textElement('span','+','seed-select'));button.onclick=()=>act('plant',{bedId:b.id,crop:seed.id,revision:b.revision});cards.append(button);}body.append(cards);
    }else{
      const ready=bedReady(b),summary=document.createElement('div'),art=document.createElement('span'),detail=document.createElement('div');summary.className='crop-summary';art.className='crop-symbol';art.setAttribute('aria-hidden','true');art.innerHTML=cropIcon(b.crop);detail.className='crop-detail';
      const heading=document.createElement('div');heading.className='growth-heading';heading.append(textElement('strong',ready?'Ready when you are':b.water>0?'Growing happily':'A little thirsty'),textElement('span',ready?`${crop.yield} to gather`:remainingText(Math.max(0,crop.growTime-b.growth))));
      const track=document.createElement('div');track.className='progress-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Crop growth');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.round(Math.min(1,b.growth/crop.growTime)*100)));const fill=document.createElement('div');fill.className='progress-fill';fill.style.width=Math.min(100,b.growth/crop.growTime*100)+'%';track.append(fill);
      const irrigated=state.sprinklers.some(s=>Math.hypot(s.x-b.x,s.y-b.y)<=COLONY.sprinklerRadius);
      const water=textElement('p',irrigated?'Sprinkler · automatic':b.water>0?`Watered · ${remainingText(b.water)}`:'Dry · water to resume growth','water-status'+(b.water<=0?' dry':''));
      const actions=document.createElement('div');actions.className='action-pair';actions.append(actionButton('water-bed','Water','water',{bedId:b.id,revision:b.revision},'soft-button water-button'),actionButton('harvest-bed','Gather','harvest',{bedId:b.id,revision:b.revision},'soft-button harvest-button',!ready));
      detail.append(heading,track,water);summary.append(art,detail);body.append(summary,actions);
      const utilities=document.createElement('div');utilities.className='crop-utilities';
      if(!irrigated){const candidates=[[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]].map(([dx,dy])=>({x:b.x+dx,y:b.y+dy}));const spot=candidates.find(p=>!colonyPlacementError(fullState(),'sprinkler',p.x,p.y));if(spot)utilities.append(actionButton('add-sprinkler-nearby',`Add sprinkler · ${COLONY.sprinklerCost}`,'build-sprinkler',spot,'quiet-button'));}
      utilities.append(actionButton('clear-bed','Clear crop','clear',{bedId:b.id,revision:b.revision},'quiet-button'));body.append(utilities);
    }
  }else if(panel==='shipment'){
    panelHeading('MYCORRHIZAL','Orbital post');
    body.append(textElement('p','2 matching crops → 16 materials · 8s','panel-copy'));
    const list=document.createElement('ul');list.className='storage-list';for(const crop of CROPS){const li=document.createElement('li');li.append(textElement('span',crop.name),textElement('strong',String(state.storage[crop.id]||0)));list.append(li);}body.append(list);
    if(state.shipment){body.append(textElement('p',`Shuttle in flight · parcel arrives in ${remainingText(state.shipment.remaining)}`,'shipment-summary'));const track=document.createElement('div');track.className='progress-track';const fill=document.createElement('div');fill.className='progress-fill';fill.style.width=(1-state.shipment.remaining/state.shipment.duration)*100+'%';track.append(fill);body.append(track);}
    else{
      const available=CROPS.filter(c=>(state.storage[c.id]||0)>=2);
      if(!available.some(c=>c.id===shipmentCrop))shipmentCrop=available[0]?.id||null;
      if(available.length>1){const label=textElement('label','Choose your samples','fine'),select=document.createElement('select');select.id='shipment-crop';for(const crop of available){const option=document.createElement('option');option.value=crop.id;option.textContent=crop.name;select.append(option);}select.value=shipmentCrop;select.onchange=()=>{shipmentCrop=select.value;};label.append(select);body.append(label);}
      body.append(actionButton('ship-cargo','Send samples','ship',()=>({crop:$('shipment-crop')?.value||available[0]?.id}),'primary-button peach wide',!available.length));
      if(!available.length)body.append(textElement('p','Needs 2 of one crop.','keyboard-note'));
    }
    if(state.shipments)body.append(textElement('p',`${state.shipments} deliveries completed`,'shipment-summary'));
  }else if(panel==='camp'){
    panelHeading('SETTLEMENT LIFE','Camp');
    renderCampPanel({body,state,owner:snapshot.room?.ownerPilot===snapshot.me?.id,canAct:canAct(),act,pick:setTool,focus:focusBed,cinema});
    if($('camp-sky'))$('camp-sky').open=!!skyOpen;
    if(document.querySelector('.camp-credits'))document.querySelector('.camp-credits').open=!!creditsOpen;
  }else if(panel==='bed'){showPanel('garden');return;}
  if(focused&&document.getElementById(focused))document.getElementById(focused).focus({preventScroll:true});
  else if(selection)body.querySelector(`[data-plant="${selection}"]`)?.focus({preventScroll:true});
  $('inspector').scrollTop=scrollTop;
  updateControls();
}

function renderRoom(){
  if(!snapshot)return;const owner=snapshot.room?.ownerPilot===snapshot.me?.id,participants=snapshot.room?.players??snapshot.players?.length??0;
  const list=$('crew-list'),signature=JSON.stringify(snapshot.players?.map(p=>[p.id,p.name]));if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren(...(snapshot.players||[]).map(p=>textElement('li',`${p.name||'Gardener'}${p.id===snapshot.me?.id?' · you':''}${p.id===snapshot.room?.ownerPilot?' · host':''}`)));}
  $('room-status').textContent=snapshot.room?.notice||'The whole crew shares the garden, harvest and building materials.';
  $('colony-invite').disabled=!owner||!live||busy;$('colony-pause').hidden=!owner;
  $('colony-pause').textContent=snapshot.room?.soloPaused?'Resume expedition':'Pause expedition';$('colony-pause').disabled=!live||busy||participants>1;
  if(participants>1&&!snapshot.room?.paused)$('room-status').textContent='Your garden keeps growing while teammates are here. The host can save and close the expedition for everyone.';
}
async function roomAction(action,data={}){
  stopInput();try{const result=await request('/api/campaigns/'+action,{id:campaignId,...data});if(action==='leave'){ended=true;source?.close();location.assign(colonyMenuHref('continue',result.next||'/campaigns/'));}else if(action==='invite'){$('invite-box').hidden=false;$('invite-code').value=result.code;toast('A little invitation, ready to share.');}else if(action==='pause'){await loadWorld();renderRoom();}}catch(error){toast(error.message,true);}
}

function movement(){if(document.hidden||!document.hasFocus()||!$('room-panel').hidden||$('colony-help-dialog')?.open)return{x:0,y:0};return{x:touch.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y:touch.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)};}
async function sendInput(forceStop=false){
  if(!snapshot||!live||ended||snapshot.room?.paused)return;
  const now=performance.now(),v=forceStop?{x:0,y:0}:movement();v.x=Math.max(-1,Math.min(1,v.x));v.y=Math.max(-1,Math.min(1,v.y));const signature=`${v.x},${v.y}`;
  if(!forceStop&&signature===lastInput&&(!v.x&&!v.y||now-lastInputAt<120))return;
  lastInput=signature;lastInputAt=now;inputSequence=Math.max(inputSequence+1,Date.now());if(v.x||v.y)panFollow=true;
  try{await request(endpoint+'input',{...v,seq:inputSequence});}catch(error){if(error.status===403||error.status===401)setConnection(false);}
}

function eventWorld(event){const r=canvas.getBoundingClientRect();return renderer.screenToWorld(event.clientX-r.left,event.clientY-r.top,camera);}
function refreshPlacement(point){if(!state||!placing())return;pointer={x:Math.floor(point.x),y:Math.floor(point.y)};pointer.error=colonyPlacementError(fullState(),mode,pointer.x,pointer.y);$('placement-reason').textContent=pointer.error||`${{bed:'Growing bed',sprinkler:'Sprinkler',campfire:'Bonfire',cinema:'Movie screen'}[mode]} · ${colonyBuildCost(fullState(),mode)===0?'a gift from the ship':colonyBuildCost(fullState(),mode)+' materials'} · select to place`;}
canvas.addEventListener('pointerdown',event=>{if(!world)return;canvas.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false,button:event.button};canvas.setPointerCapture(event.pointerId);if(event.button===1){event.preventDefault();canvas.classList.add('panning');}});
canvas.addEventListener('pointermove',event=>{
  if(!world)return;
  if(drag&&drag.id===event.pointerId){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7)drag.moved=true;if(drag.moved){panFollow=false;const delta=colonyScreenDelta(event.clientX-drag.lastX,event.clientY-drag.lastY,camera);camera.x-=delta.x;camera.y-=delta.y;camera.x=Math.max(0,Math.min(world.width,camera.x));camera.y=Math.max(0,Math.min(world.height,camera.y));canvas.classList.add('panning');}drag.lastX=event.clientX;drag.lastY=event.clientY;}
  refreshPlacement(eventWorld(event));
});
canvas.addEventListener('pointerup',event=>{
  if(!drag||drag.id!==event.pointerId)return;const was=drag;drag=null;canvas.classList.remove('panning');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(was.moved||was.button!==0)return;
  const p=eventWorld(event);if(placing()){refreshPlacement(p);if(pointer.error){toast(pointer.error,true);return;}void act('build-'+mode,{x:pointer.x,y:pointer.y});return;}
  const selectedBed=state.beds.find(b=>Math.abs(p.x-(b.x+.5))<=1.5&&Math.abs(p.y-(b.y+.5))<=1.5);
  if(selectedBed){selected=selectedBed.id;focusBed(selectedBed);showPanel('bed',selected);}
  else if(Math.hypot(p.x-(state.pad.x+.5),p.y-(state.pad.y+.5))<2){mode='shipment';showPanel('shipment');}
  else if(Math.hypot(p.x-state.hub.x,p.y-state.hub.y)<2){setTool('inspect');showPanel('garden');}
  else if(decorationAt(fullState(),Math.floor(p.x),Math.floor(p.y))){setTool('camp');showPanel('camp');}
  else hideInspector();
});
canvas.addEventListener('pointercancel',()=>{drag=null;canvas.classList.remove('panning');});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1.12:1/1.12);},{passive:false});
function zoom(factor){camera.tile=Math.max(14,Math.min(78,camera.tile*factor));}
$('colony-zoom-in').onclick=()=>zoom(1.18);$('colony-zoom-out').onclick=()=>zoom(1/1.18);
function recenter(){if(snapshot?.me){camera.x=snapshot.me.x;camera.y=snapshot.me.y;panFollow=true;}}
$('colony-recenter').onclick=recenter;
$('effects-toggle').onclick=()=>{reduced=!reduced;$('effects-toggle').setAttribute('aria-pressed',String(reduced));try{localStorage.setItem('frontier-colony-reduced',reduced?'1':'0');}catch{/* Cosmetic preference only. */}};
$('tool-inspect').onclick=()=>{setTool('inspect');showPanel('garden');};$('tool-bed').onclick=()=>setTool('bed');$('tool-sprinkler').onclick=()=>setTool('sprinkler');$('tool-shipment').onclick=()=>{setTool('shipment');showPanel('shipment');};
$('tool-camp').onclick=()=>{setTool('camp');showPanel('camp');};
$('placement-cancel').onclick=()=>setTool('inspect');$('inspector-close').onclick=hideInspector;
$('project-toggle').onclick=()=>{const expanded=$('project-toggle').getAttribute('aria-expanded')!=='true';$('project-toggle').setAttribute('aria-expanded',String(expanded));document.querySelector('.welcome-card').classList.toggle('expanded',expanded);};
function showHelp(){stopInput();if(!$('colony-help-dialog').open)$('colony-help-dialog').showModal();}
if($('colony-help'))$('colony-help').onclick=showHelp;
if($('colony-help-close'))$('colony-help-close').onclick=()=>$('colony-help-dialog').close();
function setRoomMenu(open){
  $('room-panel').hidden=!open;$('room-open').setAttribute('aria-expanded',String(open));
  stopInput();
  if(open){setTool('inspect');hideInspector();$('room-panel').hidden=false;$('room-open').setAttribute('aria-expanded','true');renderRoom();$('room-close').focus({preventScroll:true});}
  else canvas.focus({preventScroll:true});
}
$('room-open').onclick=()=>setRoomMenu($('room-panel').hidden);
$('room-close').onclick=()=>setRoomMenu(false);
$('colony-invite').onclick=()=>roomAction('invite');$('colony-pause').onclick=()=>roomAction('pause',{paused:!snapshot?.room?.soloPaused});$('colony-leave').onclick=()=>roomAction('leave');
$('invite-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite-code').value);toast('Invitation copied.');}catch{$('invite-code').focus();$('invite-code').select();toast('Select and copy this invitation code.');}};
for(const button of document.querySelectorAll('.colony-touch-pad button')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touch.x=Number(button.dataset.dx);touch.y=Number(button.dataset.dy);void sendInput();});
  const release=()=>{touch.x=touch.y=0;void sendInput(true);};for(const type of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
}
addEventListener('keydown',event=>{
  if(event.isComposing)return;const key=event.key.toLowerCase();
  if(key==='escape'){
    event.preventDefault();if(event.repeat)return;
    if($('colony-help-dialog')?.open){$('colony-help-dialog').close();canvas.focus({preventScroll:true});}
    else if(!$('room-panel').hidden)setRoomMenu(false);
    else if(mode!=='inspect'){setTool('inspect');hideInspector();}
    else if(!$('inspector').hidden)hideInspector();
    else if(snapshot&&!ended)setRoomMenu(true);
    stopInput();return;
  }
  if(editable(event))return;
  if(key==='f1'){event.preventDefault();if(!event.repeat)showHelp();return;}
  if($('colony-help-dialog')?.open)return;
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);void sendInput();return;}
  if(event.repeat)return;
  if(key==='c'){event.preventDefault();recenter();}
  else if(key==='b'){event.preventDefault();setTool(mode==='bed'?'inspect':'bed');}
  else if(key==='e'){event.preventDefault();const selectedBed=bed();if(selectedBed&&panel==='bed'){if(bedReady(selectedBed))void act('harvest',{bedId:selectedBed.id,revision:selectedBed.revision});else if(selectedBed.crop)void act('water',{bedId:selectedBed.id,revision:selectedBed.revision});}else showPanel('garden');}
});
addEventListener('keyup',event=>{if(keys.delete(event.key.toLowerCase()))void sendInput();});
addEventListener('blur',stopInput);document.addEventListener('visibilitychange',()=>{if(document.hidden){stopInput();cinema.update({position:cinemaPosition(state),playing:false,visible:false,active:false});}});
addEventListener('pagehide',()=>{stopInput();source?.close();cinema.update({position:0,playing:false,visible:false,active:false});});
addEventListener('pageshow',event=>{if(event.persisted&&!ended){void loadWorld().then(connect).catch(error=>toast(error.message,true));}});
setInterval(()=>{void sendInput();if(live&&performance.now()-lastPacket>6000)setConnection(false);},120);

function draw(now){
  requestAnimationFrame(draw);if(document.hidden||!world||!state)return;
  const dt=Math.min(.1,(now-lastFrame)/1000||0);lastFrame=now;if(!reduced&&live&&!snapshot.room?.paused)frameTime+=dt;
  advanceColonyPlayers(renderedPlayers,fullState(),now,dt,live&&!snapshot.room?.paused);
  const following=renderedPlayers.get(snapshot.me?.id)||snapshot.me;
  if(now-lastNearbyCheck>=100){lastNearbyCheck=now;inspectNearbyBed(following);}
  if(panFollow&&following){const speed=1-Math.exp(-dt*5);camera.x+=(following.x-camera.x)*speed;camera.y+=(following.y-camera.y)*speed;}
  const active=live&&!ended&&!snapshot.room?.paused&&snapshot.room?.state!=='reconnecting';
  const ambientTime=state.time+(active?Math.min(.35,Math.max(0,(now-clockReceivedAt)/1000)):0);
  const environment=environmentAt(state,ambientTime),screen=decorationItems(state).find(d=>d.kind==='cinema');
  const screenPoint=screen&&renderer.worldToScreen({x:screen.x+.5,y:screen.y+.5},camera);
  const visible=!!screenPoint&&screenPoint.x+2*camera.tile>0&&screenPoint.x-2*camera.tile<canvas.clientWidth&&screenPoint.y+camera.tile>0&&screenPoint.y-4*camera.tile<canvas.clientHeight;
  const position=cinemaPosition(state,ambientTime);
  cinema.update({position,playing:!!state.cinema?.playing,visible,active});
  const progress=$('cinema-progress');
  if(progress){const label=`${Math.floor(position/60)}:${String(Math.floor(position%60)).padStart(2,'0')} / 9:56 · ${state.cinema?.playing?'Playing':'Paused'}`;if(progress.textContent!==label)progress.textContent=label;}
  renderer.draw({world,colony:state,players:[...renderedPlayers.values()],me:snapshot.me,camera,selected:panel==='bed'?selected:null,placement:placing()?{kind:mode,...pointer}:null,time:frameTime,reduced,environment,ambientTime,movie:cinema.getStatus().ready?cinema.video:null});
}
requestAnimationFrame(draw);
if(!campaignId){$('loading-message').textContent='Choose Colonization, then New expedition to begin a peaceful garden.';}
else{try{await loadWorld();connect();}catch(error){$('loading-message').textContent=error.message;setConnection(false);}}
