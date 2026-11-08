import { COLONY, CROPS, SHIPPABLE, cropById, bedReady, colonyPlacementError, colonyBuildCost } from './colonization.js';
import { createColonyRenderer, cropIcon } from './colony-art.js';
import { COLONY_DEPTH, colonyScreenDelta } from './colony-view.js';
import { receiveColonyPlayers, advanceColonyPlayers } from './colony-motion.js';
import { environmentAt, decorationItems, decorationAt, cinemaPosition } from './colony-ambience.js';
import { createColonyCinema } from './colony-cinema.js';
import { renderCampPanel, updateCinemaStatus } from './colony-camp-ui.js';
import { BED_INSPECTION, bedEdgeDistance, nearbyColonyBed } from './colony-nearby.js';
import { INDUSTRY, INDUSTRY_ITEMS, industryItems, industryAt, industryPlacementError, industryStored, nextIndustryDirection } from './colony-industry.js';
import { INDUSTRY_DIRECTIONS, industryPanelKey, renderIndustryPanel, updateIndustryLivePanel } from './colony-industry-ui.js';
import { SETTLEMENT, settlementDefinition, settlementItems, settlementAt, settlementPlacementError, settlementBuildCost, settlementSize, settlementProjectStatus } from './colony-settlement.js';
import { renderSettlementPanel } from './colony-settlement-ui.js';
import { renderExplorationPanel, closestDiscovery } from './colony-exploration-ui.js';
import { groundSummary } from './colony-ground.js';
import { nearestCrate } from './colony-crates.js';
import { REST_LABELS, nearestRest, nearestWater, restKind } from './colony-rest.js';
import { createFishingUI } from './colony-fishing-ui.js';
import { renderCompanionPanel } from './colony-companion-ui.js';
import { PET, petAt } from './colony-pet.js';
import { setupMusic } from './music.js';
import { setupColonySound } from './colony-sound.js';
import { colonyPlanetById } from './colony-planets.js';

const $=id=>document.getElementById(id),canvas=$('colony-canvas'),renderer=createColonyRenderer(canvas);
const campaignId=new URLSearchParams(location.search).get('campaign');
const music=setupMusic();
const endpoint='/api/campaign-world/'+encodeURIComponent(campaignId||'')+'/';
const camera={x:36,y:29,tile:matchMedia('(max-width:760px)').matches?29:45};
const keys=new Set(),touch={x:0,y:0};
const renderedPlayers=new Map();
let cinema;
cinema=createColonyCinema({onStatus:()=>{if(cinema)updateCinemaStatus(cinema);}});
const industryKind=kind=>Object.hasOwn(INDUSTRY.kinds,kind);
const furnishingKind=kind=>!!settlementDefinition(kind);
const placing=()=>['bed','sprinkler','campfire','cinema'].includes(mode)||industryKind(mode)||furnishingKind(mode);
let world=null,snapshot=null,state=null,source=null,live=false,ended=false,busy=false,mode='inspect',panel='intro',selected=null;
const sound=setupColonySound({listener:()=>camera,active:()=>live&&!ended&&!snapshot?.room?.paused&&snapshot?.room?.state!=='reconnecting'});
let pointer=null,drag=null,lastPacket=0,toastTimer=0,lastInput='',lastInputAt=0,inputSequence=Date.now(),renderKey='',frameTime=0,lastFrame=0,panFollow=true;
// Full animation is the default whatever the system setting; only the header switch reduces it (author, 8 November 2026).
let reduced=false;
const pageBuild=document.querySelector('meta[name="frontier-build"]')?.content;
let seenRuntime=null,seenRevision=-1,refreshingBuild=false;
let parcelChoice={};
let industryDirection=1;
let furnishingMove=null;
const settlementPreferences={tab:'catalogue',category:'Paths',variant:'ivory'};
let clockReceivedAt=0,clockSample=-1;
let automaticBed=false,manualInspectionPoint=null,lastNearbyCheck=0;
const dismissedBeds=new Set();
try{reduced=localStorage.getItem('frontier-colony-reduced')==='1';}catch{/* Preferences are optional. */}
// The switch also stills the interface's own transitions, through the root class.
function showEffects(){const button=$('effects-toggle');button.setAttribute('aria-pressed',String(reduced));document.documentElement.classList.toggle('reduced-motion',reduced);button.title=reduced?'Reduced animation is on: machines rest and the shuttle fades. Click for full animation.':'Reduce animation';}
showEffects();

const bed=()=>state?.beds.find(b=>b.id===selected);
const fullState=()=>state&&({...state,world,players:snapshot?.players||[]});
const remainingText=seconds=>seconds<60?`${Math.max(0,Math.ceil(seconds))}s`:`${Math.floor(seconds/60)}m ${Math.ceil(seconds%60)}s`;
const editable=event=>event.target instanceof HTMLElement&&!!event.target.closest('input,textarea,select,[contenteditable=true]');
const canAct=()=>live&&!ended&&!snapshot?.room?.paused&&!busy;
const atHome=()=>!state?.regionId||state.regionId==='home';
const morrow=()=>world?.template==='morrow-v1';
// Furnish and Explore open on every civilian world; legacy expeditions keep their old tools.
const furnished=()=>!!colonyPlanetById(world?.template);
function shipmentLeg(){
  if(!state?.shipment)return '';
  if(!morrow())return 'Shuttle in flight';
  const phase=1-state.shipment.remaining/state.shipment.duration;
  return phase<.15?'Loading harvest':phase<.5?'Departing for MYCORRHIZAL':phase<.6?'Exchanging supplies aboard MYCORRHIZAL':phase<.925?'Returning with materials':'Unloading materials';
}
function colonyMenuHref(view='colony',next='/campaigns/'){
  const url=new URL(next,location.href);
  if(url.origin===location.origin&&/^\/campaigns\/?$/.test(url.pathname))url.hash=new URLSearchParams({view,planet:world?.template||'morrow-v1',mode:'colonization'}).toString();
  return url.href;
}

function toast(message,error=false){clearTimeout(toastTimer);$('colony-toast').textContent=message;$('colony-toast').classList.toggle('error',error);$('colony-toast').hidden=false;toastTimer=setTimeout(()=>{$('colony-toast').hidden=true;},error?6500:3800);}
function setConnection(connected){live=connected;$('connection-dot').classList.toggle('live',connected&&!snapshot?.room?.paused);$('colony-connection').textContent=ended?'Expedition saved':!connected?'Reconnecting…':snapshot?.room?.state==='reconnecting'?'Waiting for your host':snapshot?.room?.paused?'Taking a little break':'Together, growing';if(!connected){sound.reset();stopInput();}updateControls();}
function stopInput(){keys.clear();touch.x=touch.y=0;lastInput='';void sendInput(true);}
function markTool(){for(const b of document.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(!(b.dataset.tool==='inspect'&&!atHome())&&(b.dataset.tool===mode||b.dataset.tool==='inspect'&&['bed','sprinkler'].includes(mode)||b.dataset.tool==='camp'&&['campfire','cinema'].includes(mode)||b.dataset.tool==='industry'&&industryKind(mode)||b.dataset.tool==='settlement'&&furnishingKind(mode))));}
function setTool(next){
  if(!atHome()&&!['inspect','explore'].includes(next)){toast('Return home to tend or build in the settlement.');return;}
  if(!furnishingKind(next))furnishingMove=null;
  mode=next;pointer=null;canvas.classList.toggle('placing',placing());$('placement-note').hidden=!placing();
  document.body.classList.toggle('colony-placing',placing());
  $('placement-rotate').hidden=!industryKind(next)&&!furnishingKind(next);$('placement-note').classList.toggle('industry-placement',industryKind(next)||furnishingKind(next));
  markTool();
  if(placing()){
    hideInspector();$('room-panel').hidden=true;$('room-open').setAttribute('aria-expanded','false');
    $('placement-title').textContent=furnishingKind(next)?`${furnishingMove?'Move':'Deliver'} · ${settlementDefinition(next).name}`:industryKind(next)?INDUSTRY.kinds[next].name:{bed:'Find a sunny spot',sprinkler:'A little rain, right where you need it',campfire:'A warm place to gather',cinema:'An evening under the stars'}[next];
    $('placement-reason').textContent=furnishingKind(next)?`${furnishingMove?'Move for free':settlementBuildCost(state,next)===0?'From your storage':settlementBuildCost(state,next)+' materials'} · Choose a clear site. Rotate / R.`:industryKind(next)?`${INDUSTRY.kinds[next].cost} materials · ${INDUSTRY_DIRECTIONS[industryDirection]} · ${next==='outlet'?'Place beside a growing bed.':'Select clear ground; arrows show flow.'}`:next==='cinema'?'Choose three clear tiles near your garden.':next==='campfire'?'Select clear ground near your hub.':'Select conditioned ground; crops widen it.';
    $('placement-rotate').textContent=`${INDUSTRY_DIRECTIONS[industryDirection]} / R`;
  }
  canvas.focus({preventScroll:true});
}
function pickFurnishing(kind,item=null){furnishingMove=item;industryDirection=item?.dir||0;setTool(kind);}
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
  const soundRegion=state.regionId||'home';
  const soundTarget=action==='harvest'?state.beds.find(b=>b.id===data.bedId):action==='collect-crate'?(state.crates||[]).find(c=>c.id===data.crateId):null;
  const soundPoint=soundTarget?{x:soundTarget.x+.5,y:soundTarget.y+.5}:{x:snapshot.me?.x,y:snapshot.me?.y,local:true};
  if(action==='travel-region')stopInput();
  busy=true;updateControls();
  try{
    if(action.startsWith('industry-')&&data.machineId){const current=industryItems(state).find(item=>item.id===data.machineId);if(current)data={...data,revision:current.revision};}
    const order={action,requestId:crypto.randomUUID(),regionId:state.regionId||'home',...data};
    let result;
    try{result=await request(endpoint+'colony',order);}
    catch(error){
      if(error.status!==429)throw error;
      // Keep the original receipt identity while a rapid building burst settles.
      await new Promise(resolve=>setTimeout(resolve,1050));
      if(!live||ended||snapshot?.room?.paused)throw new Error('Your order is waiting. Resume or reconnect, then place it again.');
      result=await request(endpoint+'colony',order);
    }
    if(result.snapshot)receive(result.snapshot);
    // Accepted actions sound once here; failed requests and snapshot repeats do not.
    if(result.ok&&(state.regionId||'home')===soundRegion){
      if(action==='harvest')sound.cue('harvest',soundPoint);
      else if(action==='collect-crate')sound.cue('item-collect',soundPoint);
      else if(action==='land'&&typeof result.landed==='boolean')sound.cue(result.landed?'fish-catch':'fish-escape',soundPoint);
    }
    // Read the acknowledged state too: controls need not wait for the next stream tick.
    await loadWorld();
    if(!(action==='land'&&result.landed))toast(result.message||({plant:'A little beginning. Your seed is planted.',water:'A lovely drink for those roots.',harvest:'Freshly picked, and safely in your basket.',ship:'A little sunshine is on its way.','build-bed':'Your growing bed is ready.','build-sprinkler':'Let the sprinkler take care of the watering.',clear:'A fresh start for this bed.'}[action]||'All done.'));
    if(action==='travel-region'){setTool(atHome()?'inspect':'explore');selected=null;showPanel(atHome()?'garden':'explore');}
    else if(action==='discover-region'){showPanel('explore',data.discoveryId);}
    else if(action==='build-furnishing'||action==='furnishing-retrieve'){
      if(settlementDefinition(data.kind)?.category==='Paths'&&state.settlement.deliveries.length<SETTLEMENT.queueLimit){if(pointer)refreshPlacement(pointer);}
      else{setTool('settlement');showPanel('settlement',result.targetId);}
    }else if(action==='furnishing-move'||action==='furnishing-rotate'){setTool('settlement');showPanel('settlement',result.targetId);}
    else if(action==='furnishing-store'||action==='settlement-undo'){setTool('settlement');selected=null;showPanel('settlement');}
    else if(action==='build-bed'){
      const fresh=state.beds.find(b=>b.x===data.x&&b.y===data.y);setTool('inspect');if(fresh){focusBed(fresh);showPanel('bed',fresh.id);}
    }else if(action==='build-sprinkler'){setTool('inspect');showPanel('garden');}
    else if(action==='build-campfire'||action==='build-cinema'){
      setTool('camp');const item=decorationItems(state).find(d=>d.x===data.x&&d.y===data.y);if(item)focusBed(item);showPanel('camp');
    }
    else if(action==='build-industry'){
      const fresh=industryAt(state,data.x,data.y);
      if(data.kind==='belt'){if(pointer)refreshPlacement(pointer);}
      else if(fresh){setTool('industry');focusBed(fresh);showPanel('industry',fresh.id);}
    }else if(action==='industry-remove'){selected=null;showPanel('industry');}
    else if(action==='ship'||action==='ship-provisions')showPanel('shipment');
    else if(action==='reel'&&result.fight)fishing.start(result.fight,state.template);
    else if(action==='land'&&result.landed)fishing.showCatch(result.fish,result.kept);
    return result;
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
  const regionChanged=!!snapshot&&(value.colony.regionId||'home')!==(state?.regionId||'home');
  if(newRuntime){seenRuntime=value.runtimeId;seenRevision=-1;}
  if(Number.isFinite(value.revision)&&value.revision<seenRevision)return;
  if(newRuntime||regionChanged||value.room?.paused||value.room?.state==='reconnecting')sound.reset();
  const newMotionSample=newRuntime||!snapshot||!Number.isFinite(value.revision)||value.revision>seenRevision;
  seenRevision=value.revision??seenRevision;
  if(value.world){world=value.world;music.setWorld(world,'colonization');for(const link of document.querySelectorAll('[data-colony-menu]'))link.href=colonyMenuHref();}
  if(!world)return;
  const first=!snapshot,previousShipments=state?.shipments||0;
  const packetTime=performance.now();
  if(newRuntime||clockSample!==value.colony.time||snapshot?.room?.paused!==value.room?.paused){clockSample=value.colony.time;clockReceivedAt=packetTime;}
  if(regionChanged)renderedPlayers.clear();
  if(newMotionSample||regionChanged)receiveColonyPlayers(renderedPlayers,value.players||[],packetTime,newRuntime||regionChanged);
  snapshot=value;state=value.colony;lastPacket=packetTime;
  document.body.classList.toggle('expanded-expedition',furnished());document.body.classList.toggle('colony-exploring',!atHome());
  for(const element of document.querySelectorAll('[data-expansion]'))element.hidden=!furnished();
  if(first){camera.x=atHome()?state.hub.x+1.6:value.me.x;camera.y=atHome()?state.hub.y+1:value.me.y;panFollow=false;arrive();setTool(atHome()?'inspect':'explore');showPanel(atHome()?(state.beds.length?'garden':'intro'):'explore',null,{automatic:true});}
  if(regionChanged){camera.x=value.me.x;camera.y=value.me.y;panFollow=true;selected=null;dismissedBeds.clear();setTool(atHome()?'inspect':'explore');showPanel(atHome()?'garden':'explore');$('region-arrival-name').textContent=world.district||world.name;$('region-arrival-caption').textContent=atHome()?'Back at your settlement':`A new corner of ${world.name||'this world'}`;$('region-arrival').hidden=false;setTimeout(()=>{$('region-arrival').hidden=true;},reduced?700:1600);}
  if(value.build&&document.documentElement.dataset.build&&value.build!==document.documentElement.dataset.build){location.reload();return;}
  if(value.build)document.documentElement.dataset.build=value.build;
  $('colony-name').textContent=value.room?.name||'Our little outpost';$('colony-planet').textContent=`${world.name||'Your planet'} · ${atHome()?'Peaceful expedition':world.district}`;
  $('materials-count').textContent=state.materials;$('crew-count').textContent=String((value.crew||value.players)?.length||1);
  $('garden-tool-label').textContent=atHome()?'Garden':'Home';
  $('tool-inspect').title=atHome()?'View your garden':'Return home to your garden and buildings';
  $('bed-count').textContent=atHome()?`${state.beds.length} / ${COLONY.bedLimit} beds · ${groundSummary(fullState()).conditioned} ground`:'Return to garden';
  $('companion-label').textContent=state.pet?state.pet.name:'Adopt a spider';
  $('shipment-count').textContent=state.shipment?'Shuttle away':state.shipments?`${state.shipments} deliveries`:'First delivery';
  for(const item of document.querySelectorAll('[data-milestone]')){const done=!!state.milestones?.[item.dataset.milestone];item.classList.toggle('done',done);item.querySelector('i').textContent=done?'✓':String([...item.parentNode.children].indexOf(item)+1);}
  // The frontier has moved once a live crop has raised any tile: the header asks for a seed until then.
  const nextStep=!atHome()?`Explore ${world.name||'this world'}`:!(state.ground?.revision>0)?'Plant a seed to widen your ground':!state.milestones.firstPlant?'Plant your first seed':!state.milestones.firstHarvest?'Gather your first harvest':!state.milestones.firstShipment?'Send a sample shipment':furnished()?(settlementProjectStatus(state).find(p=>!p.claimed)?.name||'A place to call home'):'Garden established';
  if($('project-label'))$('project-label').textContent=nextStep;
  $('moss-message').textContent=mossAdvice();
  if(state.shipments>previousShipments&&!first)toast('A parcel from home! New materials and a little celebration for your garden.');
  setConnection(true);
  sound.ingest({epoch:campaignId+':'+seenRuntime+':'+(state.regionId||'home'),time:state.time,colony:state,players:value.players||[],localId:value.me?.id,world});
  renderPanel();renderRoom();
}
function mossAdvice(){
  if(snapshot?.room?.paused)return 'Everything can wait. Your garden is safe while we take a little break.';
  if(!atHome())return 'Your settlement is waiting at home. Record a discovery, or use Return home to visit your garden.';
  if(!state.beds.length)return 'Your first growing bed is a gift from the ship. Find a sunny patch and make it yours.';
  if(state.beds.some(b=>bedReady(b)))return 'Something lovely is ready to pick. It will happily wait until you are.';
  if(state.beds.some(b=>b.crop&&b.water<=0))return 'A few roots would love a drink. Dry plants take a nap; they never disappear.';
  if(!state.milestones?.firstPlant)return 'Choose a seed from our little library. There is always another seed to try.';
  if(state.shipment)return 'The shuttle is carrying your harvest home. A fresh parcel is coming back soon.';
  if(Object.values(state.storage).some(n=>n>=1)&&!state.shipments)return 'Your harvest makes a lovely first parcel. Visit the orbital post when you are ready.';
  if(!state.sprinklers.length)return 'A sprinkler can tend nearby beds while you explore. No pipes or fuss.';
  return 'The sprinkler has the watering covered. Plant something different, or just enjoy the view.';
}
function connect(){
  source?.close();source=new EventSource(endpoint+'events');
  source.onmessage=event=>{try{receive(JSON.parse(event.data));}catch(error){console.error('Could not read expedition update',error);}};
  source.onerror=()=>{if(!ended)setConnection(false);};
  source.addEventListener('session-ended',event=>{let value={};try{value=JSON.parse(event.data);}catch{/* End gracefully even without an explanation. */}
    // The host's own Save and leave also ends this stream; that departure shows no reason.
    if(choosingToLeave){source.close();return;}
    depart(colonyMenuHref('continue',value.next||'/campaigns/'),{reason:value.message||'This expedition has closed. Your progress is saved.',seconds:2.2});});
}
// Transitions run through black, as the menu's descent ends: the garden fades in from it,
// and leaving or a closed room fades back into it before the menu (author, 8 November 2026).
let choosingToLeave=false,departing=null,departed=false;
function fadeLayer(kind,seconds){const layer=$('colony-fade');layer.hidden=false;layer.className=`colony-fade ${kind}`;layer.style.animationDuration=`${seconds}s`;return layer;}
function arrive(){
  $('colony-loading').hidden=true;$('colony-loading').classList.remove('waiting');if(reduced)return;
  const layer=fadeLayer('fade-in',1.2),done=()=>{if(layer.classList.contains('fade-in'))layer.hidden=true;};
  layer.addEventListener('animationend',done,{once:true});setTimeout(done,1700);
}
function farewellCard(reason){const card=$('colony-loading');card.classList.remove('waiting');card.querySelector('h2').textContent='Your garden will be waiting.';$('loading-message').textContent=reason;card.hidden=false;return card;}
function depart(next,{reason=null,seconds=1.2}={}){
  if(departed)return;departed=true;ended=true;sound.reset();stopInput();source?.close();if(reason)setConnection(false);
  if(reason){try{sessionStorage.setItem('frontier-room-ended',reason);}catch{/* The farewell card says it as well. */}}
  const leave=()=>location.assign(next);
  const run=()=>{
    $('room-panel').hidden=true;hideInspector();
    departing={start:performance.now(),tile:camera.tile,seconds:reduced?0:seconds};fadeLayer('fade-out',reduced?0:seconds);
    if(!reason){setTimeout(leave,reduced?150:seconds*1000+80);return;}
    // A closed room says why on the dark, then returns to the menu, which keeps the reason.
    setTimeout(()=>{const card=farewellCard(reason),go=event=>{if(event?.target?.closest?.('a'))return;leave();};
      card.addEventListener('pointerdown',go,{once:true});addEventListener('keydown',go,{once:true});setTimeout(leave,4200);},reduced?0:seconds*1000);
  };
  // A hidden tab would play the farewell unseen: wait until the page is looked at again.
  if(document.hidden)document.addEventListener('visibilitychange',function shown(){if(document.hidden)return;document.removeEventListener('visibilitychange',shown);run();});else run();
}

function updateControls(){
  const disabled=!canAct();for(const b of document.querySelectorAll('[data-colony-action]'))b.disabled=disabled||b.dataset.unavailable==='true';
  for(const id of ['tool-industry','tool-shipment','tool-camp','tool-companion','tool-settlement'])$(id).disabled=!atHome()||disabled;
  $('tool-explore').disabled=disabled;
  $('tool-inspect').disabled=!atHome()&&disabled;
  for(const select of document.querySelectorAll('[data-camp-host]'))select.disabled=disabled||snapshot?.room?.ownerPilot!==snapshot?.me?.id;
  if(panel==='industry'&&state)updateIndustryLivePanel({body:$('inspector-body'),state:fullState(),selectedId:selected,canAct:!disabled});
}
function actionButton(id,text,action,data,css='soft-button',unavailable=false){const b=document.createElement('button');b.id=id;b.className=css;b.textContent=text;b.dataset.colonyAction=action;b.dataset.unavailable=String(unavailable);b.disabled=!canAct()||unavailable;b.onclick=()=>act(action,typeof data==='function'?data():data);return b;}
function textElement(tag,text,css){const node=document.createElement(tag);node.textContent=text;if(css)node.className=css;return node;}
function groundReadout(){const summary=groundSummary(fullState()),row=document.createElement('div');row.id='ground-readout';row.className='industry-power ground-readout';row.append(textElement('span','Conditioned ground'),textElement('strong',`${summary.conditioned} tiles · ${summary.frontier} growing`));return row;}
function panelHeading(eyebrow,title){$('inspector-eyebrow').textContent=eyebrow;$('inspector-title').textContent=title;}
function renderPanel(){
  if(!state||!panel)return;
  const body=$('inspector-body');
  // Never rebuild the companion panel under a half-typed name.
  if(panel==='companion'&&document.activeElement?.id==='pet-name')return;
  // A machine card is never rebuilt under a focused or pressed control: live
  // readouts and availability update in place instead (the catalog still re-renders).
  if(panel==='industry'&&selected&&body.dataset.industrySelected===String(selected)&&
      (body.contains(document.activeElement)&&['SELECT','BUTTON'].includes(document.activeElement.tagName)||body.querySelector(':active'))){
    updateIndustryLivePanel({body,state:fullState(),selectedId:selected,canAct:canAct()});return;
  }
  const b=bed(),key=JSON.stringify([panel,selected,panel==='bed'?[b?.crop,b?.revision,Math.floor(b?.growth||0),Math.ceil(b?.water||0)]:null,state.beds.map(v=>[v.id,v.crop,bedReady(v),v.water>0]),state.ground?.revision,state.materials,state.storage,state.industry?.storage,state.shipments,Math.ceil(state.shipment?.remaining||0),busy,live,snapshot?.room?.paused,panel==='camp'?[state.environment,state.decorations,state.cinema?.revision,state.cinema?.playing]:null,panel==='companion'?[!!state.pet,state.pet?.pets,state.pet?.fed,state.pet?.name,state.fishing?.treats,state.fishing?.catches?.length]:null,panel==='garden'?state.sprinklers.length:null,panel==='industry'?industryPanelKey(fullState()):null,panel==='settlement'?[state.settlement?.revision,Math.floor(state.settlement?.deliveries?.[0]?.elapsed||0),settlementPreferences,state.decorations?.items?.length]:null,panel==='explore'?[state.regionId,state.exploration?.revision,(state.regionDiscoveries||[]).map(d=>Math.ceil(Math.hypot(d.x-snapshot.me.x,d.y-snapshot.me.y)*2))]:null]);
  const panelKey=key+shipmentLeg();
  if(panelKey===renderKey)return;renderKey=panelKey;
  $('inspector').dataset.panel=panel;
  // Preserve keyboard focus through routine growth updates.
  const focused=document.activeElement?.id,selection=document.activeElement?.dataset?.plant,scrollTop=$('inspector').scrollTop,skyOpen=$('camp-sky')?.open,creditsOpen=document.querySelector('.camp-credits')?.open,equipmentOpen=document.querySelector('.industry-machines')?.open,journalOpen=$('field-journal')?.open,furnishingsOpen=document.querySelector('.settlement-items')?.open;
  body.replaceChildren();
  if(panel==='intro'){
    panelHeading('FIRST PLANTING','Start a garden');
    body.append(textElement('p','Place a bed, choose a seed, then water it.','panel-copy'));
    const button=document.createElement('button');button.id='place-bed-gift';button.className='primary-button wide';button.textContent=state.beds.length?'Place another bed':'Place first bed · free';button.onclick=()=>{if(state.beds.length){setTool('bed');return;}const candidates=[{x:32,y:31},{x:32,y:27},{x:36,y:34}];const spot=candidates.find(p=>!colonyPlacementError(fullState(),'bed',p.x,p.y));if(spot)void act('build-bed',spot);else setTool('bed');};button.disabled=!canAct();body.append(button,textElement('p','Crops condition the ground beside them; build on conditioned ground.','keyboard-note'),textElement('p','Seeds and water are free.','keyboard-note'));
    const dismiss=document.createElement('button');dismiss.className='quiet-button dismiss-intro';dismiss.textContent='Explore';dismiss.onclick=hideInspector;body.append(dismiss);
    if(furnished()){const build=document.createElement('button');build.id='intro-furnish';build.className='soft-button wide';build.textContent='Make it yours · open furnishing kit';build.onclick=()=>{setTool('settlement');selected=null;showPanel('settlement');};body.append(build);}
  }else if(panel==='garden'){
    panelHeading('EXPEDITION','Garden');
    body.append(groundReadout());
    // Beds and sprinklers are placed from here: the dock keeps one Garden button for both.
    const bedCost=colonyBuildCost(fullState(),'bed'),build=document.createElement('div');build.className='action-pair garden-build';
    const place=(id,text,next,unavailable,css='soft-button')=>{const b=document.createElement('button');b.id=id;b.type='button';b.className=css;b.textContent=text;b.dataset.colonyAction='garden';b.dataset.unavailable=String(unavailable);b.disabled=!canAct()||unavailable;b.onclick=()=>setTool(next);return b;};
    build.append(place('place-bed',bedCost===0?'Place bed · free':`Place bed · ${bedCost}`,'bed',state.beds.length>=COLONY.bedLimit||state.materials<bedCost,state.beds.length?'soft-button':'primary-button'),
      place('place-sprinkler',`Place sprinkler · ${COLONY.sprinklerCost}`,'sprinkler',state.sprinklers.length>=COLONY.sprinklerLimit||state.materials<COLONY.sprinklerCost));
    body.append(build,textElement('p',`${state.beds.length} / ${COLONY.bedLimit} beds · ${state.sprinklers.length} / ${COLONY.sprinklerLimit} sprinklers · B places a bed`,'keyboard-note'));
    if(state.beds.length){
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
    body.append(textElement('p',`Each crop earns ${COLONY.cropReward} materials, each provision ${COLONY.provisionReward}. The shuttle returns in ${COLONY.shipmentDuration}s.`,'panel-copy'));
    const cargoTypes=SHIPPABLE.map(id=>CROPS.find(c=>c.id===id)||INDUSTRY_ITEMS.find(item=>item.id===id));
    if(state.shipment){
      const list=document.createElement('ul');list.className='storage-list';for(const [id,amount] of Object.entries(state.shipment.cargo||{})){const li=document.createElement('li');li.append(textElement('span',cargoTypes.find(c=>c.id===id)?.name||id),textElement('strong',String(amount)));list.append(li);}body.append(list);
      body.append(textElement('p',`${shipmentLeg()} · ${remainingText(state.shipment.remaining)}`,'shipment-summary'));const track=document.createElement('div');track.className='progress-track';const fill=document.createElement('div');fill.className='progress-fill';fill.style.width=(1-state.shipment.remaining/state.shipment.duration)*100+'%';track.append(fill);body.append(track);
    }else{
      // Every row starts at all of that cargo; the player may lower any of them.
      const list=document.createElement('ul');list.className='storage-list parcel-list';const launch=document.createElement('button');
      const chosen=()=>Object.fromEntries(cargoTypes.map(c=>[c.id,Math.max(0,Math.min(industryStored(state,c.id),parcelChoice[c.id]??industryStored(state,c.id)))]).filter(([,n])=>n>0));
      const summarize=()=>{const cargo=chosen(),count=Object.values(cargo).reduce((t,n)=>t+n,0),reward=Object.entries(cargo).reduce((t,[id,n])=>t+n*(id==='provisions'?COLONY.provisionReward:COLONY.cropReward),0);launch.textContent=count?`Launch ${count} ${count===1?'item':'items'} · +${reward} materials`:'Choose something to send';launch.disabled=!canAct()||!count;launch.dataset.unavailable=String(!count);};
      for(const crop of cargoTypes){
        const stored=industryStored(state,crop.id),li=document.createElement('li'),input=document.createElement('input');
        input.type='number';input.id=`parcel-${crop.id}`;input.min='0';input.max=String(stored);input.step='1';input.inputMode='numeric';input.value=String(Math.min(stored,parcelChoice[crop.id]??stored));input.disabled=!stored;input.setAttribute('aria-label',`${crop.name} to send, of ${stored}`);
        input.oninput=()=>{const value=Math.floor(Number(input.value));parcelChoice[crop.id]=Number.isFinite(value)?Math.max(0,Math.min(stored,value)):0;summarize();};
        input.onchange=()=>{input.value=String(parcelChoice[crop.id]??stored);};
        li.append(textElement('span',crop.name),textElement('small',`of ${stored}`),input);list.append(li);
      }
      body.append(list);
      launch.id='ship-cargo';launch.className='primary-button peach wide';launch.dataset.colonyAction='ship';launch.onclick=()=>{const cargo=chosen();parcelChoice={};void act('ship',{cargo});};summarize();body.append(launch);
      if(!cargoTypes.some(c=>industryStored(state,c.id)>0))body.append(textElement('p','Harvest crops or make provisions to fill a parcel.','keyboard-note'));
    }
    if(state.shipments)body.append(textElement('p',`${state.shipments} deliveries completed`,'shipment-summary'));
  }else if(panel==='industry'){
    const machine=industryItems(state).find(item=>item.id===selected);
    panelHeading(machine?`EQUIPMENT · ${machine.x}:${machine.y}`:'GROW · MAKE · SEND',machine?INDUSTRY.kinds[machine.kind].name:'Industry');
    renderIndustryPanel({body,state:fullState(),selectedId:selected,canAct:canAct(),act,pick:setTool,inspect:id=>{selected=id;const item=industryItems(state).find(v=>v.id===id);if(item)focusBed(item);showPanel('industry');},showShipment:()=>{setTool('shipment');showPanel('shipment');}});
    if(document.querySelector('.industry-machines'))document.querySelector('.industry-machines').open=!!equipmentOpen;
  }else if(panel==='settlement'){
    const furnishing=settlementItems(state).find(item=>item.id===selected);
    panelHeading(`${(world.name||'Expedition').toUpperCase()} · MAKING A HOME`,furnishing?settlementDefinition(furnishing.kind).name:'Your settlement');
    renderSettlementPanel({body,state:fullState(),selectedId:selected,actorId:snapshot.me.id,canAct:canAct(),act,pick:pickFurnishing,preferences:settlementPreferences,refresh:()=>{renderKey='';renderPanel();},inspect:id=>{selected=id;const item=settlementItems(state).find(v=>v.id===id);if(item)focusBed(item);showPanel('settlement');}});
    if(document.querySelector('.settlement-items'))document.querySelector('.settlement-items').open=!!furnishingsOpen;
  }else if(panel==='explore'){
    panelHeading(`${(world.name||'Expedition').toUpperCase()} · FIELD NOTES`,atHome()?'Beyond the garden':world.district||'Exploration');
    renderExplorationPanel({body,state:fullState(),worker:snapshot.me,canAct:canAct(),act,selectedId:selected,focus:item=>{selected=item.id;focusBed(item);renderKey='';renderPanel();}});
    if($('field-journal'))$('field-journal').open=!!journalOpen;
  }else if(panel==='camp'){
    panelHeading('SETTLEMENT LIFE','Camp');
    renderCampPanel({body,state,owner:snapshot.room?.ownerPilot===snapshot.me?.id,canAct:canAct(),act,pick:setTool,focus:focusBed,cinema});
    if($('camp-sky'))$('camp-sky').open=!!skyOpen;
    if(document.querySelector('.camp-credits'))document.querySelector('.camp-credits').open=!!creditsOpen;
  }else if(panel==='companion'){
    panelHeading('COMPANION',state.pet?.name||'Adopt a spider');
    renderCompanionPanel({body,state,canAct:canAct(),act,focus:focusBed});
  }else if(panel==='bed'){showPanel('garden');return;}
  if(focused&&document.getElementById(focused))document.getElementById(focused).focus({preventScroll:true});
  else if(selection)body.querySelector(`[data-plant="${selection}"]`)?.focus({preventScroll:true});
  $('inspector').scrollTop=scrollTop;
  updateControls();
}

function renderRoom(){
  if(!snapshot)return;const owner=snapshot.room?.ownerPilot===snapshot.me?.id,participants=snapshot.room?.players??snapshot.players?.length??0;
  const crew=snapshot.crew||snapshot.players||[],list=$('crew-list'),signature=JSON.stringify(crew.map(p=>[p.id,p.name,p.regionId]));if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren(...crew.map(p=>textElement('li',`${p.name||'Gardener'}${p.id===snapshot.me?.id?' · you':''}${p.id===snapshot.room?.ownerPilot?' · host':''}${p.regionId&&p.regionId!=='home'?' · exploring':''}`)));}
  $('room-status').textContent=snapshot.room?.notice||'The whole crew shares the garden, harvest and building materials.';
  $('colony-invite').disabled=!owner||!live||busy;$('colony-pause').hidden=!owner;
  $('colony-pause').textContent=snapshot.room?.soloPaused?'Resume expedition':'Pause expedition';$('colony-pause').disabled=!live||busy||participants>1;
  if(participants>1&&!snapshot.room?.paused)$('room-status').textContent='Your garden keeps growing while teammates are here. The host can save and close the expedition for everyone.';
}
async function roomAction(action,data={}){
  stopInput();if(action==='leave')choosingToLeave=true;try{const result=await request('/api/campaigns/'+action,{id:campaignId,...data});if(action==='leave'){depart(colonyMenuHref('continue',result.next||'/campaigns/'));}else if(action==='invite'){$('invite-box').hidden=false;$('invite-code').value=result.code;toast('A little invitation, ready to share.');}else if(action==='pause'){await loadWorld();renderRoom();}}catch(error){if(action==='leave')choosingToLeave=false;toast(error.message,true);}
}

function movement(){if(document.hidden||!document.hasFocus()||!$('room-panel').hidden||$('colony-help-dialog')?.open)return{x:0,y:0};return{x:touch.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y:touch.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)};}
async function sendInput(forceStop=false){
  if(!snapshot||!live||ended||snapshot.room?.paused)return;
  const now=performance.now(),v=forceStop?{x:0,y:0}:movement();v.x=Math.max(-1,Math.min(1,v.x));v.y=Math.max(-1,Math.min(1,v.y));const signature=`${v.x},${v.y}`;
  if(!forceStop&&signature===lastInput&&(!v.x&&!v.y||now-lastInputAt<120))return;
  lastInput=signature;lastInputAt=now;inputSequence=Math.max(inputSequence+1,Date.now());if(v.x||v.y)panFollow=true;
  try{await request(endpoint+'input',{...v,seq:inputSequence,regionId:state.regionId||'home'});}catch(error){if(error.status===403||error.status===401)setConnection(false);}
}

function eventWorld(event){const r=canvas.getBoundingClientRect();return renderer.screenToWorld(event.clientX-r.left,event.clientY-r.top,camera);}
function refreshPlacement(point){
  if(!state||!placing())return;pointer={x:Math.floor(point.x),y:Math.floor(point.y),dir:industryDirection};
  pointer.variant=furnishingMove?.variant||settlementPreferences.variant;
  pointer.error=furnishingKind(mode)?settlementPlacementError(fullState(),mode,pointer.x,pointer.y,industryDirection,furnishingMove?.id||null):industryKind(mode)?industryPlacementError(fullState(),mode,pointer.x,pointer.y,industryDirection):colonyPlacementError(fullState(),mode,pointer.x,pointer.y);
  if(furnishingKind(mode)&&!furnishingMove&&(state.settlement?.deliveries.length||0)>=SETTLEMENT.queueLimit)pointer.error='The shuttle queue is full. Wait for a delivery to finish.';
  const cost=furnishingKind(mode)?furnishingMove?0:settlementBuildCost(state,mode):industryKind(mode)?INDUSTRY.kinds[mode].cost:colonyBuildCost(fullState(),mode);
  $('placement-reason').textContent=pointer.error||`${furnishingKind(mode)?settlementDefinition(mode).name:industryKind(mode)?INDUSTRY_DIRECTIONS[industryDirection]:{bed:'Growing bed',sprinkler:'Sprinkler',campfire:'Bonfire',cinema:'Movie screen'}[mode]} · ${cost===0?furnishingKind(mode)?'free':'a gift from the ship':cost+' materials'} · select to ${furnishingMove?'move':furnishingKind(mode)?'request delivery':'place'}`;
}
function rotateIndustry(){
  if(industryKind(mode)||furnishingKind(mode)){industryDirection=(industryDirection+1)%4;$('placement-rotate').textContent=`${INDUSTRY_DIRECTIONS[industryDirection]} / R`;if(pointer)refreshPlacement(pointer);else $('placement-reason').textContent=furnishingKind(mode)?'Choose the site for your furnishing.':`${INDUSTRY.kinds[mode].cost} materials · ${INDUSTRY_DIRECTIONS[industryDirection]} · arrows show flow.`;}
  else if(panel==='industry'){const machine=industryItems(state).find(item=>item.id===selected);if(machine)void act('industry-rotate',{machineId:machine.id,revision:machine.revision,dir:nextIndustryDirection(fullState(),machine)});}
}
canvas.addEventListener('pointerdown',event=>{if(!world)return;canvas.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false,button:event.button};canvas.setPointerCapture(event.pointerId);if(event.button===1){event.preventDefault();canvas.classList.add('panning');}});
canvas.addEventListener('pointermove',event=>{
  if(!world)return;
  if(drag&&drag.id===event.pointerId){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7)drag.moved=true;if(drag.moved){panFollow=false;const delta=colonyScreenDelta(event.clientX-drag.lastX,event.clientY-drag.lastY,camera);camera.x-=delta.x;camera.y-=delta.y;camera.x=Math.max(0,Math.min(world.width,camera.x));camera.y=Math.max(0,Math.min(world.height,camera.y));canvas.classList.add('panning');}drag.lastX=event.clientX;drag.lastY=event.clientY;}
  refreshPlacement(eventWorld(event));
});
canvas.addEventListener('pointerup',event=>{
  if(!drag||drag.id!==event.pointerId)return;const was=drag;drag=null;canvas.classList.remove('panning');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(was.moved||was.button!==0)return;
  const p=eventWorld(event);if(placing()){refreshPlacement(p);if(pointer.error){toast(pointer.error,true);return;}if(furnishingKind(mode)){void act(furnishingMove?'furnishing-move':'build-furnishing',{kind:mode,x:pointer.x,y:pointer.y,dir:industryDirection,variant:pointer.variant,...(furnishingMove?{itemId:furnishingMove.id,revision:furnishingMove.revision}:{})});}else void act(industryKind(mode)?'build-industry':'build-'+mode,{x:pointer.x,y:pointer.y,...(industryKind(mode)?{kind:mode,dir:industryDirection}:{})});return;}
  if(!atHome()){const discovery=(state.regionDiscoveries||[]).find(d=>Math.hypot(p.x-d.x,p.y-d.y)<1.5);if(discovery){setTool('explore');showPanel('explore',discovery.id);}else hideInspector();return;}
  const furnishing=settlementAt(state,Math.floor(p.x),Math.floor(p.y));
  const selectedMachine=industryAt(state,Math.floor(p.x),Math.floor(p.y));
  const selectedBed=state.beds.find(b=>Math.abs(p.x-(b.x+.5))<=1.5&&Math.abs(p.y-(b.y+.5))<=1.5);
  // The spider is small and stands above the ground: its body sits a little north of its feet.
  const shownPet=petSmooth||state.pet;
  if(shownPet&&Math.hypot(p.x-shownPet.x,p.y-(shownPet.y-.2))<.8){setTool('companion');showPanel('companion');}
  else if(furnishing){setTool('settlement');focusBed(furnishing);showPanel('settlement',furnishing.id);}
  else if(selectedMachine){setTool('industry');focusBed(selectedMachine);showPanel('industry',selectedMachine.id);}
  else if(selectedBed){selected=selectedBed.id;focusBed(selectedBed);showPanel('bed',selected);}
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
$('effects-toggle').onclick=()=>{reduced=!reduced;showEffects();try{localStorage.setItem('frontier-colony-reduced',reduced?'1':'0');}catch{/* Cosmetic preference only. */}toast(reduced?'Reduced animation: machines rest and the shuttle fades away instead of flying.':'Full animation: machines run and the shuttle flies.');};
$('tool-inspect').onclick=()=>{if(!atHome()){void act('travel-region',{destination:'home'});return;}setTool('inspect');showPanel('garden');};$('tool-shipment').onclick=()=>{setTool('shipment');showPanel('shipment');};
$('tool-settlement').onclick=()=>{setTool('settlement');selected=null;showPanel('settlement');};
$('tool-explore').onclick=()=>{setTool('explore');selected=null;showPanel('explore');};
$('exploration-return').onclick=()=>act('travel-region',{destination:'home'});
$('exploration-record').onclick=()=>{const discovery=closestDiscovery(state,snapshot.me);if(discovery?.distance<=2.6)void act('discover-region',{discoveryId:discovery.id});else{setTool('explore');showPanel('explore',discovery?.id||null);}};
$('tool-camp').onclick=()=>{setTool('camp');showPanel('camp');};
$('tool-companion').onclick=()=>{setTool('companion');showPanel('companion');};
$('tool-industry').onclick=()=>{setTool('industry');selected=null;showPanel('industry');};
$('placement-rotate').onclick=rotateIndustry;
$('collect-crate').onclick=()=>{const id=$('collect-crate').dataset.crate;if(id)void act('collect-crate',{crateId:id});};
function nearbyPrompt(){
  const me=snapshot?.me;if(!me||!atHome())return null;const colony=fullState();
  if(me.activity){if(me.activity.kind==='fish')return me.activity.fight?null:me.activity.bite?{label:'Reel in',action:'reel'}:{label:'Stop fishing',action:'stand'};return{label:'Stand up',action:'stand'};}
  const rest=nearestRest(colony,me.x,me.y);if(rest)return{label:REST_LABELS[restKind(rest)]||'Rest',action:'rest',data:{itemId:rest.id}};
  if(nearestWater(colony,me.x,me.y))return{label:'Fish',action:'fish'};
  if(petAt(colony,me.x,me.y))return{label:'Pet',action:'pet-pet'};
  return null;
}
let petSmooth=null,petSmoothAt=0;
// The companion moves on the server; the picture eases toward each packet so it never jitters.
function smoothPet(){
  const pet=state?.pet;if(!pet||!atHome()){petSmooth=null;return null;}
  const now=performance.now(),dt=petSmoothAt?Math.min(.25,(now-petSmoothAt)/1000):0;petSmoothAt=now;
  if(!petSmooth||Math.hypot(pet.x-petSmooth.x,pet.y-petSmooth.y)>4)petSmooth={x:pet.x,y:pet.y,angle:pet.angle||0};
  const k=Math.min(1,dt*9);petSmooth.x+=(pet.x-petSmooth.x)*k;petSmooth.y+=(pet.y-petSmooth.y)*k;
  const da=(((pet.angle||0)-petSmooth.angle+Math.PI*3)%(Math.PI*2))-Math.PI;petSmooth.angle+=da*k;
  return{...pet,x:petSmooth.x,y:petSmooth.y,angle:petSmooth.angle,moving:pet.moving||Math.hypot(pet.x-petSmooth.x,pet.y-petSmooth.y)>.05};
}
const fishing=createFishingUI({$,act,toast,reduced:()=>reduced});
$('rest-prompt').onclick=()=>{const prompt=nearbyPrompt();if(prompt)void act(prompt.action,prompt.data||{});};
$('placement-cancel').onclick=()=>setTool('inspect');$('inspector-close').onclick=hideInspector;
for(const event of ['focusout','pointerup'])$('inspector').addEventListener(event,()=>{if(panel==='industry')requestAnimationFrame(()=>renderPanel());});
$('project-toggle').onclick=()=>{if(furnished()&&(state?.milestones.firstShipment||!atHome())){setTool(atHome()?'settlement':'explore');selected=null;settlementPreferences.tab='projects';showPanel(atHome()?'settlement':'explore');return;}const expanded=$('project-toggle').getAttribute('aria-expanded')!=='true';$('project-toggle').setAttribute('aria-expanded',String(expanded));document.querySelector('.welcome-card').classList.toggle('expanded',expanded);};
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
    if(fishing.cardOpen)fishing.hideCatch();
    else if($('colony-help-dialog')?.open){$('colony-help-dialog').close();canvas.focus({preventScroll:true});}
    else if(!$('room-panel').hidden)setRoomMenu(false);
    else if(mode!=='inspect'){setTool('inspect');hideInspector();}
    else if(!$('inspector').hidden)hideInspector();
    else if(snapshot&&!ended)setRoomMenu(true);
    stopInput();return;
  }
  if(editable(event))return;
  if(fishing.active&&(key==='e'||key===' ')){event.preventDefault();if(!event.repeat)fishing.hold(true);return;}
  if(fishing.cardOpen&&(key==='e'||key==='enter')){event.preventDefault();if(!event.repeat)fishing.hideCatch();return;}
  if(key==='f1'){event.preventDefault();if(!event.repeat)showHelp();return;}
  if($('colony-help-dialog')?.open)return;
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);void sendInput();return;}
  if(event.repeat)return;
  if(key==='c'){event.preventDefault();recenter();}
  else if(key==='b'){event.preventDefault();setTool(mode==='bed'?'inspect':'bed');}
  else if(key==='r'&&(industryKind(mode)||furnishingKind(mode)||panel==='industry')){event.preventDefault();rotateIndustry();}
  else if(key==='e'){event.preventDefault();if(!atHome()){const discovery=closestDiscovery(state,snapshot.me);if(discovery?.distance<=2.6)void act('discover-region',{discoveryId:discovery.id});else{setTool('explore');showPanel('explore');}return;}const crate=snapshot?.me?nearestCrate(fullState(),snapshot.me.x,snapshot.me.y):null;if(crate){void act('collect-crate',{crateId:crate.id});return;}const prompt=nearbyPrompt();if(prompt){void act(prompt.action,prompt.data||{});return;}const selectedBed=bed();if(selectedBed&&panel==='bed'){if(bedReady(selectedBed))void act('harvest',{bedId:selectedBed.id,revision:selectedBed.revision});else if(selectedBed.crop)void act('water',{bedId:selectedBed.id,revision:selectedBed.revision});}else showPanel('garden');}
});
addEventListener('keyup',event=>{const key=event.key.toLowerCase();if(key==='e'||key===' ')fishing.hold(false);if(keys.delete(key))void sendInput();});
addEventListener('blur',()=>{fishing.hold(false);stopInput();});document.addEventListener('visibilitychange',()=>{if(document.hidden){fishing.hold(false);stopInput();cinema.update({position:cinemaPosition(state),playing:false,visible:false,active:false});}});
addEventListener('pagehide',()=>{stopInput();source?.close();cinema.update({position:0,playing:false,visible:false,active:false});});
addEventListener('pageshow',event=>{if(event.persisted&&!ended){void loadWorld().then(connect).catch(error=>toast(error.message,true));}});
setInterval(()=>{void sendInput();if(live&&performance.now()-lastPacket>6000)setConnection(false);},120);

function draw(now){
  requestAnimationFrame(draw);if(document.hidden||!world||!state)return;
  const dt=Math.min(.1,(now-lastFrame)/1000||0);lastFrame=now;if(!reduced&&live&&!snapshot.room?.paused)frameTime+=dt;
  advanceColonyPlayers(renderedPlayers,fullState(),now,dt,live&&!snapshot.room?.paused);
  const following=renderedPlayers.get(snapshot.me?.id)||snapshot.me;
  fishing.update(now,atHome()?snapshot.me?.activity:null,state.template);
  sound.setReeling(fishing.reeling,{x:following?.x,y:following?.y,local:true});
  if(now-lastNearbyCheck>=100){lastNearbyCheck=now;inspectNearbyBed(following);const nearCrate=atHome()&&snapshot?.me?nearestCrate(fullState(),snapshot.me.x,snapshot.me.y):null;$('collect-crate').hidden=!nearCrate;$('collect-crate').dataset.crate=nearCrate?.id||'';const prompt=nearCrate?null:nearbyPrompt();$('rest-prompt').hidden=!prompt;$('rest-prompt').dataset.action=prompt?.action||'';$('rest-prompt').firstChild.textContent=prompt?`${prompt.label} `:'';$('exploration-hint').hidden=atHome();if(!atHome()){const discovery=closestDiscovery(state,snapshot.me);$('exploration-nearest').textContent=discovery?`${discovery.name} · ${Math.ceil(discovery.distance)} steps`:'This region is in your journal';$('exploration-record').textContent=discovery?.distance<=2.6?'Record · E':'Field notes';$('exploration-record').disabled=!canAct();}}
  if(panFollow&&following){const speed=1-Math.exp(-dt*5);camera.x+=(following.x-camera.x)*speed;camera.y+=(following.y-camera.y)*speed;}
  if(departing?.seconds){const t=Math.min(1,(now-departing.start)/(departing.seconds*1000));camera.tile=departing.tile*(1-.36*t*t*(3-2*t));}
  const active=live&&!ended&&!snapshot.room?.paused&&snapshot.room?.state!=='reconnecting';
  const ambientTime=state.time+(active?Math.min(.35,Math.max(0,(now-clockReceivedAt)/1000)):0);
  const environment=environmentAt(state,ambientTime),screen=decorationItems(state).find(d=>d.kind==='cinema');
  const screenPoint=screen&&renderer.worldToScreen({x:screen.x+.5,y:screen.y+.5},camera);
  const visible=!!screenPoint&&screenPoint.x+2*camera.tile>0&&screenPoint.x-2*camera.tile<canvas.clientWidth&&screenPoint.y+camera.tile>0&&screenPoint.y-4*camera.tile<canvas.clientHeight;
  const position=cinemaPosition(state,ambientTime);
  cinema.update({position,playing:!!state.cinema?.playing,visible,active});
  const progress=$('cinema-progress');
  if(progress){const label=`${Math.floor(position/60)}:${String(Math.floor(position%60)).padStart(2,'0')} / 9:56 · ${state.cinema?.playing?'Playing':'Paused'}`;if(progress.textContent!==label)progress.textContent=label;}
  renderer.draw({world,colony:state,pet:smoothPet(),players:[...renderedPlayers.values()],me:snapshot.me,camera,selected:panel==='bed'?selected:null,industrySelected:panel==='industry'?selected:null,furnishingSelected:panel==='settlement'?selected:null,discoverySelected:panel==='explore'?selected:null,placement:placing()?{kind:mode,...pointer}:null,time:frameTime,reduced,environment,ambientTime,movie:cinema.getStatus().ready?cinema.video:null});
}
requestAnimationFrame(draw);
if(!campaignId){$('colony-loading').classList.remove('waiting');$('loading-message').textContent='Choose Colonization, then New expedition to begin a peaceful garden.';}
else{try{await loadWorld();connect();}catch(error){$('colony-loading').classList.remove('waiting');$('loading-message').textContent=error.message;setConnection(false);
  // A closed room or ended visit returns to the menu by itself, which keeps the reason.
  if(error.status===403){const reason=String(error.message).replace(/\s*Return to campaigns\.?$/,'');farewellCard(reason);try{sessionStorage.setItem('frontier-room-ended',reason);}catch{/* The card says it. */}setTimeout(()=>location.assign(colonyMenuHref('continue')),4200);}}}
