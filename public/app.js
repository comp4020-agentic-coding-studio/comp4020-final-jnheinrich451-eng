import { drawFlak } from './anti-air-effects.js';
import { JET, isAttackJet, aircraftName, strafeError } from './attack-jet.js';
import { AIR_HULL, aircraftHealth } from './aircraft.js';
import { drawLaserBeams } from './laser-tower-effects.js';
import { beamRay as laserBeamRay } from './sensors.js';
import { missileAim } from './missile.js';
import { submarineAim } from './submarine.js';
import { CONTAMINATOR, concealed, fogRadius } from './contaminator.js';
import { drawContamination, drawContaminationMap } from './contaminator-effects.js';
import { settlements } from './settlement.js';
import { ECONOMY, COSTS, LOGISTICS_SIZE, quote, emergencyTankError, readyFactory } from './logistics.js';
import { logisticsUI } from './logistics-ui.js';
import { drawLogistics } from './logistics-effects.js';
import { CONSTRUCTION, constructionCores, constructionError, needsConstruction } from './construction.js';
import { AIR, airbaseError, airbaseGate, bombError } from './aircraft.js';
import { drawConquest, drawConquestMap } from './conquest-effects.js';
import { drawConvertedGround } from './modifier-effects.js';
import { MODIFIER } from './modifier.js';
import { detectionFor } from './sensors.js';
import { drawAcid } from './mortar-effects.js';
import { MORTAR } from './mortar.js';
import { drawAirbase, drawAircraft, drawBombPrediction, drawBombRuns } from './aircraft-effects.js';
import { depthState, surfaced, diveBattery, depthError } from './submarine-depth.js';
import { isSubmarine, SUBMARINE, submarineBox, submarineTargetError } from './submarine.js';
import { NAVAL_GUN, SIDE_MOUNTS, sideSolution, mainSalvo, MAIN_MOUNTS, mainReload, readyMainMounts } from './ship-armament.js';
import { VEHICLE, hullHealth } from './vehicle.js';
import { drawVehicleState, drawSwimmer } from './vehicle-effects.js';
import { SHIP, shipKind, shipName, shipSite, boardingPoint, shoreRampSite, shipSolution, recallShipError } from './ship.js';
import { ShipEffects, drawShip } from './ship-effects.js';
import { TANK, tankPlacementError, tankArrivalPosition } from './tank.js';
import { switchAt, switchLocked, switchConnectionError } from './switches.js';
import { drawHazards } from './hazard-effects.js';
import { fieldCapacityError } from './hazards.js';
import { tileAt, LABELS, placementError } from './world.js';
import { hudState, coreSiteAnalysis, orbitStep, landingLog } from './hud.js';
import { TABS, ASSETS, assetByCard, assetsIn, orbitalPrice, specRows } from './catalogue.js';
import { BINDINGS, SCOPES, POINTER, keyOf } from './keymap.js';
import { drawGraticule, drawScaleBar, telemetry } from './instruments.js';
import { CombatEffects, drawCrawler } from './effects.js';
import { turnTurret, angleDelta, SENTRY_TURRET } from './turret.js';
import { CORE, corePlacementError } from './core.js';
import { CoreEffects } from './core-effects.js';
import { WEAPONS, loadout, ARTILLERY_SHELLS } from './weapons.js';
import { drawRobot, drawFuel } from './robot.js';
import { raycast } from './raycast.js';
import { SURVIVAL } from './survival.js';
import { drawReplacement, drawAttack } from './survival-effects.js';
import { RAIL, railSegment, railError, carriageError, artilleryFireError, artillerySolution, artilleryAim, gunPosition } from './rail.js';
import { drawRail, drawRailGun, drawSalvos, drawSwitch } from './rail-effects.js';
import { MISSILE, isMissile, missilePlacementError, missileFireError, missileTargetError } from './missile.js';
import { drawBattery, drawTargetBox, drawBarrages } from './missile-effects.js';
import { isCurve, isCompact, joinedShape, curveBounds, curveEnds } from './track.js';

const $ = id => document.getElementById(id);
const campaignId = new URLSearchParams(location.search).get('campaign');
const worldAPI = campaignId ? `/api/campaign-world/${encodeURIComponent(campaignId)}/` : '/api/';
let roomState = null, roomNotice = '';
let selectedSiteId = null;
const canManageOwner = owner => owner === me?.id || roomState?.ownerPilot === me?.id && roomState.abandoned.includes(owner);
async function roomRequest(action, extra = {}) {
  const response = await fetch('/api/campaigns/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campaignId, ...extra }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error);
  if (result.room) updateRoom(result.room); return result;
}
function updateRoom(room) {
  roomState = room;
  $('room-name').textContent = room.name;
  $('room-status').textContent = room.notice || (room.paused ? 'Battle paused.' : `${room.players} / ${room.limit} players · battle running`);
  $('room-owner-controls').hidden = me?.id !== room.ownerPilot;
  if (room.notice && room.notice !== roomNotice) notify(room.notice);
  roomNotice = room.notice;
}
const clientBuild = document.querySelector('meta[name="frontier-build"]')?.content;
let updatingClient = false;
const canvas = $('world-canvas'), ctx = canvas.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');
const T = 48, images = {}, keys = new Set(), positions = new Map();
const effects = new CombatEffects(T), monsterPositions = new Map();
const sentryPositions = new Map();
const shipEffects = new ShipEffects(T), shipPositions = new Map();
const currentAirbase=()=>world?.airbases?.find(b=>b.aircraft.id===me?.aircraftId);
const currentAircraft=()=>currentAirbase()?.aircraft;
const currentShip = () => world?.ships?.find(s => s.id === me?.shipId);
const coreEffects = new CoreEffects(T), tankEffects = new CoreEffects(T, 1);
let deploymentShipKind='gunship',subRotated=false;
const selectedVessel=()=>world?.ships?.find(s=>s.id===$('navy-vessel').value&&s.owner===me.id)||world?.ships?.find(s=>s.owner===me.id);
let emergencyDeployment = false;
let deploymentKind = 'sentry', deploymentFocus = null, floorKey = '';
let feedbackTimer, lastFeedback = -1, lastEffectEpoch, lastFrame = 0;
let world, me, buildings = [], players = [], mode = 'explore', selected = { x: 24, y: 18 };
let width = 0, height = 0, terrainCanvas, mapGrid = false, connected = false, pending = false;
let camera = { x: 24.5 * T, y: 18.5 * T, zoom: 0.7 }, following = false, pointer = null, hover = null;
let path = [], toastTimer, moved = false, seenRevision = -1, lastMini = 0;
let initialFoundations = 0, inputBusy = false, lastInput = '0,0', failedInputs = 0, lastAim = null;
let combat = { status: 'ready', health: 100, enemies: [], shells: [], impacts: [], sentries: {} }, aim = null, mouseAim = null, stateReceived = 0;
let lastPointerKind = 'mouse';
let locatedSite = false; try { locatedSite = sessionStorage.getItem('frontier-located') === '1'; } catch {}
const ASSET_NAMES = { core: 'Orbital core', sentry: 'APCR sentry', tank: 'Tank drop pod', rail: 'Rail track', artillery: 'Railway cannon', missile: 'Missile battery', airbase: 'Airbase', factory: 'Factory', uplink: 'Launch station', recycler: 'Recycler' };
// State banner and first-landing log. Presentation only; derived from the current snapshot.
function updateHud() {
  if (!me || !world) return;
  const gun = controlledGun(), ship = currentShip(), plane = me.aircraftId ? currentAircraft() : null;
  const placingLabel = deploymentKind === 'ship' ? shipName({ kind: deploymentShipKind }) : deploymentKind === 'airbase' && deploymentAircraftKind === 'attack-jet' ? 'Airbase + attack jet' : ASSET_NAMES[deploymentKind];
  const state = hudState({ me, mode, deploymentKind, gun: gun && (isMissile(gun) ? 'Missile battery' : 'Rail cannon').toUpperCase(), ship: ship && shipName(ship).toUpperCase(), aircraft: plane && aircraftName(plane).toUpperCase(), placingLabel });
  $('state-banner').textContent = state.label;
  document.querySelector('.battlefield').dataset.state = state.key;
  const log = landingLog({ world, buildings, me, located: locatedSite }), list = $('landing-log');
  list.hidden = !['ground', 'placing'].includes(state.key) || log.every(item => item.done);
  const key = log.map(item => item.id + ':' + item.done).join();
  if (!list.hidden && list.dataset.key !== key) {
    list.dataset.key = key;
    list.replaceChildren(...log.map(item => {
      const li = document.createElement('li'); li.classList.toggle('done', item.done);
      li.append((item.done ? '✓ ' : '○ ') + item.label);
      if (item.key && !item.done) li.append(' ', Object.assign(document.createElement('kbd'), { textContent: item.key }));
      return li;
    }));
  }
}
// Deployment catalogue: one tab at a time; specs and prices come from catalogue.js.
let forceTab = 'ground', specCard = null;
function setForceTab(tab, focus = false) {
  forceTab = tab;
  for (const button of document.querySelectorAll('[data-force-tab]')) {
    const active = button.dataset.forceTab === tab;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    if (active) { $('tray-panel').setAttribute('aria-labelledby', button.id); if (focus) button.focus(); }
  }
  for (const element of document.querySelectorAll('[data-force]')) element.hidden = !element.dataset.force.split(' ').includes(tab);
  if (world) { $('switches-open').hidden = tab !== 'rail' || !world.rails.some(isCurve); updateShips(); updateAircraft(); }
  showSpec(assetsIn(tab)[0]?.card);
  updateCatalogue();
}
function showSpec(cardId) {
  const asset = assetByCard(cardId); if (!asset) return;
  specCard = cardId;
  const art = $(cardId).querySelector('.unit-art')?.cloneNode(true);
  const title = Object.assign(document.createElement('div'), { className: 'spec-title' });
  title.append(Object.assign(document.createElement('span'), { className: 'asset-code', textContent: asset.code }), Object.assign(document.createElement('strong'), { textContent: asset.name }));
  const list = document.createElement('dl');
  for (const [term, value] of specRows(asset)) list.append(Object.assign(document.createElement('dt'), { textContent: term }), Object.assign(document.createElement('dd'), { textContent: value }));
  $('asset-spec').replaceChildren(...(art ? [art] : []), title, list);
}
function updateCatalogue() {
  if (!world || !me) return;
  const supplies = Math.floor(world.logistics?.supplies ?? 0), allowed = connected && me.life === 'active' && me.body === 'robot';
  $('tray-supplies').textContent = 'SUP ' + supplies;
  const mine = list => (list || []).filter(o => o.owner === me.id && !o.destroyed);
  const owned = { 'core-card': mine(world.cores).length, 'tank-card': mine(world.tanks).length, 'ship-card': mine(world.ships).filter(s => shipKind(s) === 'gunship').length, 'submarine-card': mine(world.ships).filter(s => shipKind(s) === 'submarine').length, 'airbase-card': mine(world.airbases).length };
  const firstCore = !world.logistics?.deployments?.[me.id] || !world.cores.length;
  for (const asset of ASSETS) {
    const card = $(asset.card), price = asset.card === 'core-card' && firstCore ? 0 : orbitalPrice(asset), short = price > supplies;
    card.classList.toggle('short', short); card.classList.toggle('in-field', !!owned[asset.card]);
    card.querySelector('.asset-cost').textContent = (price ? price + ' SUP' : 'FREE') + (short ? ' · short ' + (price - supplies) : '') + (owned[asset.card] ? ' · IN FIELD' : '');
    if (asset.tab === 'logistics') card.disabled = !allowed || short;
  }
}
const deployLogistics = (kind, emergency = false) => { emergencyDeployment = emergency; $('construction-method').value = 'orbital'; beginCoreSurvey(kind); };
function noteLocated() { locatedSite = true; try { sessionStorage.setItem('frontier-located', '1'); } catch {} updateHud(); }
// Site analysis for an orbital core: measured footprint facts plus the client preview's verdict.
function renderSiteAnalysis(a, error) {
  const supplies = Math.floor(world.logistics?.supplies ?? 0), terrain = [['grass', a.grass], ['sand', a.sand], ['rock', a.rock], ['water', a.water], ['floor', a.floor]].filter(([, n]) => n).map(([name, n]) => name + ' ' + n).join(' · ');
  const rows = [
    ['Footprint', a.cells + '-cell cross'],
    ['Terrain', terrain || '—'],
    ['Flooring', a.rock + ' rock' + (a.rock === 1 ? '' : 's') + ' covered'],
    ['Hostile', a.nearest ? 'nearest ' + a.nearest.distance.toFixed(1) + ' t · ' + (a.territory ? 'inside red territory' : 'outside red territory') : 'none surveyed'],
    ['Cost', deploymentPrice() + ' SUP · balance ' + supplies],
  ];
  const checks = [['inside map', a.inside], ['land', a.water === 0], ['1 core per scout', !world.cores.some(c => c.owner === me.id)]];
  const items = rows.flatMap(([term, value]) => [Object.assign(document.createElement('dt'), { textContent: term }), Object.assign(document.createElement('dd'), { textContent: value })]);
  const verdict = Object.assign(document.createElement('dd'), { className: 'checks' });
  for (const [label, ok] of checks) verdict.append(Object.assign(document.createElement('span'), { className: ok ? 'ok' : 'fail', textContent: (ok ? '✓ ' : '✗ ') + label }));
  verdict.append(Object.assign(document.createElement('span'), { className: error ? 'fail verdict' : 'ok verdict', textContent: error ? '✗ ' + error : '✓ clear · server confirms on drop' }));
  $('site-analysis').replaceChildren(...items, Object.assign(document.createElement('dt'), { textContent: 'Checks' }), verdict);
}
let eventStream;
const firing = new Set(), heldGun = new Set(), heldPrimary = new Set(), nextFire = { HE: 0, APCR: 0, FLAME: 0, LASER: 0 }, flashTimers = {};
let displayedBody;
let recoveryPending = false, recoveryError = '', lastHurt, hurtTimer;
let selectedGunId = '', lastControlledId = null, gunBusy = false;
let orbitalView = false, bodyCamera = null;
const controlledGun = () => world?.artillery?.find(g => g.operator === me?.id);
const alive = () => !me || !me.life || me.life === 'active';
const inOrbit = () => me?.body === 'orbital';
const groundPlayers = () => players.filter(p => p.body !== 'orbital');
function stopFiring() { cancelShipClick(); heldGun.clear(); heldPrimary.clear(); if (connected && combat.charges?.some(c => c.owner === me?.id)) void api('charge/cancel', {}).catch(() => {}); }
function combatInputAllowed() { return connected && world && !roomState?.paused && !$('logistics-dialog').open && !$('room-dialog').open && !inOrbit() && alive() && !controlledGun() && !me.deploying && mode !== 'build' && $('deployment-tray').hidden && $('site-panel').hidden && !$('help-dialog').open && !document.hidden; }

function placementSupportError(x, y) {
  if (inOrbit() && deploymentKind !== 'core') return 'Deploy your core before using ground equipment.';
  if(me.aircraftId)return 'Land and disembark before building.';
  if(LOGISTICS_SIZE[deploymentKind]){
    if(me.body!=='robot')return 'Disembark before building logistics facilities.';
    const size=LOGISTICS_SIZE[deploymentKind];
    for(let cy=y;cy<y+size;cy++)for(let cx=x;cx<x+size;cx++){const error=placementError(world,buildings,[...groundPlayers(),...combat.enemies,...(world.logistics?.recyclers||[])],cx,cy);if(error)return error;}
    return constructionError(world,deploymentKind,x,y);
  }
  if(deploymentKind==='airbase')return me.body!=='robot'?'Deploy your core first, then build from your robot.':airbaseError(world,buildings,[...groundPlayers(),...combat.enemies],x,y,me.id) || constructionError(world,'airbase',x,y);
  if (me.shipId) return 'Disembark at a dock before building.';
  if (deploymentKind === 'ship') {
    if (me.body !== 'robot') return 'Deploy your orbital core first, then call a ship with your robot.';
    const site = shipSite(world, buildings, [...groundPlayers(), ...combat.enemies], x, y, me.id,deploymentShipKind,'unfolding');
    return site.error || constructionError(world,'ship',x,y,site.ship);
  }
  if (me.vehicleId) return 'Exit your tank before building.';
  if (deploymentKind === 'tank') return me.body !== 'robot' ? 'Deploy your orbital core first, then call a tank with your robot.' : tankPlacementError(emergencyDeployment?{...world,tanks:world.tanks.filter(t=>t.owner!==me.id||!t.destroyed)}:world, buildings, [...groundPlayers(), ...combat.enemies], x, y, me.id);
  if (deploymentKind === 'missile') return missilePlacementError(world, buildings, [...groundPlayers(), ...combat.enemies], x, y, me.id) || constructionError(world,'missile',x,y);
  if (deploymentKind === 'core') return corePlacementError(world, buildings, [...groundPlayers(), ...combat.enemies], x, y, me.id);
  if (deploymentKind === 'rail') return railError(world, buildings, x, y, $('rail-shape').value, Number($('rail-length').value), me.id);
  if (deploymentKind === 'artillery') {
    if (world.artillery.some(g => !isMissile(g) && g.owner === me.id)) return 'Your railway cannon is already deployed.';
    return carriageError(world, buildings, [...groundPlayers(), ...combat.enemies], x, y, world.rails.find(r => r.x === x && r.y === y)?.shape) || constructionError(world,'artillery',x,y);
  }
  return placementError(world, buildings, groundPlayers(), x, y);
}
function deliveryData(){const value=$('construction-method').value;return ['airbase','ship','artillery','missile'].includes(deploymentKind)&&value!=='orbital'?{method:'factory',factoryId:value}:{method:'orbital'};}
function deploymentPrice(){
  const kind=deploymentKind==='ship'&&deploymentShipKind==='submarine'?'submarine':deploymentKind;
  if(kind==='rail'||kind==='core'&&(!world.logistics?.deployments[me.id]||!world.cores.length)||kind==='tank'&&emergencyDeployment)return 0;
  return COSTS[kind]===undefined?0:quote(kind,deliveryData().method==='factory');
}
function deploymentError(x,y){
  const error=placementSupportError(x,y);if(error)return error;
  if(deploymentKind==='tank'&&emergencyDeployment)return emergencyTankError(world);
  const delivery=deliveryData();
  if(delivery.method==='factory'){
    const f=world.logistics.facilities.find(f=>f.id===delivery.factoryId&&readyFactory(f));if(!f)return 'Choose a completed friendly factory.';
    const ship=deploymentKind==='ship'?shipSite(world,buildings,[...groundPlayers(),...combat.enemies],x,y,me.id,deploymentShipKind,'unfolding').ship:null;
    const support=constructionError({...world,cores:[],logistics:{facilities:[f]}},deploymentKind,x,y,ship);if(support)return support;
  }
  const price=deploymentPrice();return world.logistics&&world.logistics.supplies+1e-8<price?'Need '+price+' supplies; '+Math.floor(world.logistics.supplies)+' available.':null;
}
const logistics=logisticsUI({state:()=>({world,me,connected,canManage:canManageOwner}),api,notify,
  stop:()=>{keys.clear();stopFiring();},locate:p=>{camera.x=p.x*T;camera.y=p.y*T;camera.zoom=width<760?.45:.7;following=false;},
  deploy:(kind,emergency=false)=>deployLogistics(kind,emergency)
});
let airBusy=false;
let deploymentAircraftKind='bomber', nextStrafe=0;
async function requestAircraft(kind){
 const base=world.airbases.find(b=>b.owner===me.id);deploymentAircraftKind=kind;
 if(!base){beginCoreSurvey('airbase');return;}
 try{await api('aircraft/deliver',{id:base.id,kind});toggleTray(false);locateAirbase();notify('Orbital aircraft delivery incoming. Board after the capsule opens.');}
 catch(e){notify(e.message);}
}
function nearbyAirbase(){return world?.airbases?.find(b=>Math.hypot(me.x-airbaseGate(b).x,me.y-airbaseGate(b).y)<=1.8);}
function updateAircraft(){
 const base=currentAirbase(),p=base?.aircraft,near=nearbyAirbase();
 document.querySelector('.battlefield').classList.toggle('aircraft-control',!!p);$('aircraft-controls').hidden=!p;
 const own=world.airbases.find(b=>b.owner===me.id);
 for(const id of ['airbase-card','attack-jet-card'])$(id).disabled=!connected||!alive()||me.body!=='robot'||!!controlledGun()||!!(own&&(own.destroyed||world.logistics?.jobs[own.id]||!['parked','destroyed'].includes(own.aircraft.state)||own.aircraft.state==='destroyed'&&own.aircraft.remaining>0||own.aircraft.occupant||own.aircraft.rearm>0));
 $('airbase-card').title=$('attack-jet-card').title=own?'Replace or exchange aircraft for 100 supplies at your airbase.':'Deploy a runway and aircraft.';
 $('air-delivery-help').textContent=own?'100 supplies to exchange or replace aircraft. Rebuild a destroyed airbase through Logistics first.':'Choose an aircraft, then a clear 6 x 10 site inside a friendly core construction circle.';
 $('airbase-find').disabled=!world.airbases.some(b=>b.owner===me.id);
 const button=$('aircraft-interact');button.hidden=!alive()||mode==='build'||!!controlledGun()||(!p&&(me.body!=='robot'||!near));
 button.textContent=p?'Disembark / E':['destroyed','delivering'].includes(near?.aircraft.state)?'Arrival / '+Math.ceil(near.aircraft.remaining)+'s':near?.aircraft.occupant?'Aircraft occupied':'Board + take off / E';
 button.disabled=!connected||airBusy||!!(near&&(near.destroyed||world.logistics?.jobs[near.id]))||(p?p.state!=='parked':!!near?.aircraft.occupant||near?.aircraft.state!=='parked'||near?.aircraft.rearm>0);
 for(const button of document.querySelectorAll('[data-direction]')){const key=button.dataset.direction;button.setAttribute('aria-label',(p?{up:'Increase airspeed',down:'Reduce airspeed',left:'Turn left',right:'Turn right'}:{up:'Move north',down:'Move south',left:'Move west',right:'Move east'})[key]);button.textContent=(p?{up:'W +',down:'S -',left:'A <',right:'D >'}:{up:'↑',down:'↓',left:'←',right:'→'})[key];}
 if(!p)return;
 const jet=isAttackJet(p);$('aircraft-name').textContent=aircraftName(p).toUpperCase();$('aircraft-controls').setAttribute('aria-label',jet?'Attack jet controls':'Bomber controls');
 $('aircraft-bomb').textContent=jet?'Hold LMB / Autocannon':'LMB / Drop 6 HE';
 document.querySelector('.mode-dock').hidden=true;$('build-mode').disabled=true;
 const threatened=world.sites.some(s=>s.state==='hostile'&&s.aa?.targetId===p.id)||(combat.flakShells||[]).some(s=>!s.impacted&&s.targetId===p.id);
 $('aircraft-status').textContent=threatened?'INCOMING FLAK / TURN':p.releaseRemaining>0?'RELEASING / HOLDING COURSE':p.edgeTurn?'BOUNDARY TURN':p.state.toUpperCase();
 $('aircraft-readout').textContent='HULL '+Math.ceil(aircraftHealth(p))+'/'+AIR_HULL.health+' / SPEED '+p.speed.toFixed(1)+' / '+(jet?p.rounds+' ROUNDS':p.runs+' OF 2 HE RUNS')+' / BASE '+Math.round(Math.hypot(p.x-(base.x+2),p.y-(base.y+7.5)))+' TILES';
 const error=jet?strafeError(world,p):bombError(world,p);$('aircraft-bomb').disabled=!connected||(!jet&&airBusy)||!!error;
 $('aircraft-launch').hidden=p.state!=='parked';$('aircraft-launch').disabled=!connected||airBusy||p.rearm>0;
 $('aircraft-manual').textContent=p.state==='parked'?(p.rearm>0?'REARMING '+p.rearm.toFixed(1)+'s':'READY / Take off or E disembark'):(error||(jet?'Hold LMB / Forward HE autocannon':'LMB drops 6 HE'))+' / Slow to 7 or less near base to land';
 $('map-hint').textContent='W faster / S slower / A D turn / '+(jet?'Hold LMB strafe':'LMB bomb')+' / C follow';
}
async function aircraftAction(action){
 if(airBusy||!connected||!alive()||(!['board','exit'].includes(action)&&!combatInputAllowed()))return;
 if(action==='bomb'&&isAttackJet(currentAircraft())){action='strafe';if(performance.now()<nextStrafe||strafeError(world,currentAircraft()))return;nextStrafe=performance.now()+JET.cooldown+20;}
 airBusy=true;if(action!=='strafe')stopFiring();
 try{await api('aircraft/'+action,{id:nearbyAirbase()?.id});if(!['bomb','strafe'].includes(action)){keys.clear();setMode('explore');recenter();camera.zoom=width<760?.25:.5;following=true;}canvas.focus({preventScroll:true});}
 catch(e){if(!e.message.includes('reloading')){stopFiring();notify(e.message);}}finally{airBusy=false;updateAircraft();}
}
function locateAirbase(){const b=currentAirbase()||world.airbases.find(b=>b.owner===me.id);if(!b)return;toggleTray(false);camera={x:(b.x+3)*T,y:(b.y+5)*T,zoom:width<760?.35:.6};following=false;}
let shipBusy = false, sideBusy = false, nextSideShot = 0, lastShipTarget = null, lastShipUi = 0, rampPreview = null;
let shipClick=null;
function cancelShipClick(){if(shipClick)clearTimeout(shipClick.timer);shipClick=null;}
function nearbyShip() {
  return world?.ships?.find(s => {
    const dock = boardingPoint(world, s, buildings);
    return dock && !s.destroyed && s.elapsed >= SHIP.duration && Math.hypot(me.x-dock.x, me.y-dock.y) <= SHIP.boardRange;
  });
}
function updateShips() {
  const ship = currentShip(), near = nearbyShip(), button = $('ship-interact');
  document.querySelector('.battlefield').classList.toggle('ship-control', !!ship);
  $('ship-controls').hidden = !ship;
  if (ship) document.querySelector('.mode-dock').hidden = true;
  button.hidden = !alive() || mode === 'build' || !!controlledGun() || (!ship && (me.body !== 'robot' || !near));
  button.textContent = ship ? 'Disembark / E' : near?.occupant ? 'Ship occupied' : 'Board ship / E';
  button.disabled = !connected || shipBusy || (!ship && !!near?.occupant);
  for(const[kind,id]of[['gunship','ship-card'],['submarine','submarine-card']])$(id).disabled=!connected||me.body!=='robot'||world.ships.some(s=>s.owner===me.id&&shipKind(s)===kind);
  const fleet=$('navy-vessel'),ownedShips=world.ships.filter(s=>s.owner===me.id),signature=ownedShips.map(s=>s.id).join(',');
  if(fleet.dataset.ships!==signature){const selected=fleet.value;fleet.replaceChildren(...ownedShips.map(s=>Object.assign(document.createElement('option'),{value:s.id,textContent:shipName(s)})));if(ownedShips.some(s=>s.id===selected))fleet.value=selected;fleet.dataset.ships=signature;}
  fleet.disabled=!ownedShips.length;
  const owned = world.ships.some(s => s.owner === me.id);
  $('ship-find').disabled = $('ship-dock-find').disabled = !owned;
  const recallError=recallShipError(world,selectedVessel());
  $('ship-recall').disabled=shipBusy||!connected||!alive()||me.body!=='robot'||!!controlledGun()||!!recallError;
  $('ship-recall-help').textContent=recallError||'Removes the selected ship and its dock. You can deploy a new pair afterwards.';
  updateReplacement('ship',world.ships);updateReplacement('tank',world.tanks);
  $('build-mode').disabled ||= !!ship;
  if (!ship) { rampPreview=null; return; }
  rampPreview=ship.ramp?null:shoreRampSite(world,buildings,[...groundPlayers(),...combat.enemies],ship);
  $('ship-ramp').disabled=!connected||shipBusy;
  $('ship-ramp').textContent=ship.ramp?'G / Retract ramp':'G / Shore ramp';
  $('ship-ramp').setAttribute('aria-pressed',String(!!ship.ramp));
  const solution = shipSolution(ship, aim), dock = boardingPoint(world, ship, buildings);
  $('ship-contact').disabled = !connected || (combat.naval?.cooldown||0)>0 || (combat.naval?.count||0)>=6;
  $('ship-contact').textContent = combat.naval?.count ? `${combat.naval.count} swimmers / ${Math.ceil(combat.naval.cooldown)}s` : combat.naval?.cooldown>0 ? `Sonar ${Math.ceil(combat.naval.cooldown)}s` : 'Naval contact';
  $('ship-status').textContent = MAIN_MOUNTS.map(m=>`${m.id==='fore'?'FORE':'AFT'} ${mainReload(ship,m.id)>.001?mainReload(ship,m.id).toFixed(1)+'s':'READY'}`).join(' / ');
  $('ship-manual').textContent = `W/S forward/reverse / A/D steer / Mouse aim / ${ship.ramp ? 'ANCHORED / E ashore / G retract ramp' : dock ? 'Docked: E ashore / G shore ramp' : rampPreview ? 'SHORE IN REACH / G anchor + ramp' : 'G shore ramp / Approach clear land within 2 tiles'}`;
  $('map-hint').textContent = 'LMB volley / Double-click salvo / Hold RMB side guns / WASD sail / 1 2 3 shells';
  for (const b of document.querySelectorAll('[data-ship-shell]')) { b.disabled = !connected || shipBusy; b.setAttribute('aria-pressed', String(b.dataset.shipShell === ship.ammo)); }
  for(const m of SIDE_MOUNTS){const a=sideSolution(ship,aim,m),b=$('ship-'+m.id+'-status'),ready=a.inArc&&a.inRange&&a.aligned;
    b.textContent=(m.id==='port'?'Port':'Starboard')+' / '+(!a.inRange?'8 tiles':!a.inArc?'Outside arc':!a.aligned?'Tracking':'Ready');b.dataset.ready=String(ready);b.classList.toggle('firing',combat.shots.some(s=>s.owner===ship.id+':'+m.id&&combat.time-s.at<180));}
  $('ship-secondary').disabled=!connected||!alive();
  $('ship-fire').disabled = !connected || shipBusy || !readyMainMounts(ship).length || !solution.inRange;
  const sub=isSubmarine(ship);$('ship-title').textContent=shipName(ship).toUpperCase();
  $('ship-secondary').closest('.ship-secondary-row').hidden=sub;$('submarine-rotate').hidden=!sub;$('submarine-depth').hidden=!sub;
  $('ship-fire').textContent=sub?'LMB / Launch 6':'LMB / Volley';$('ship-fire').title=sub?'Launch six missiles at the selected area':'One click: one ready turret. Double-click: all ready turrets.';
  if(sub){
    const error=!surfaced(ship)?'Surface fully to launch':submarineTargetError(ship,world,aim,subRotated);
    const state=depthState(ship),battery=diveBattery(ship);
    $('submarine-battery').textContent=`${state.toUpperCase()}${ship.depthRemaining>0?' '+ship.depthRemaining.toFixed(1)+'s':''} / BATTERY ${battery.toFixed(1)}s`;
    $('submarine-dive').disabled=!connected||shipBusy||state!=='surfaced'||!!depthError(ship,'dive');
    $('submarine-surface').disabled=!connected||shipBusy||!['diving','submerged'].includes(state);
    $('submarine-dive').title=depthError(ship,'dive')||'Dive for up to 30 seconds';
    $('ship-ramp').disabled ||= !surfaced(ship);$('ship-contact').disabled ||= !surfaced(ship);
    button.disabled ||= !surfaced(ship);
    $('ship-status').textContent=ship.launchRemaining>0?'LAUNCHING / BRACED':ship.reload>0?'TUBES '+ship.reload.toFixed(1)+'s':surfaced(ship)?'TUBES READY':'TUBES SEALED';
    $('ship-fire').disabled=!connected||shipBusy||ship.reload>.001||!!error;
    $('submarine-rotate').textContent='R / '+(subRotated?'8 x 6':'6 x 8');
    $('map-hint').textContent='LMB launch / Ctrl dive / Space surface / WASD sail / 1 2 3 warheads';
    $('ship-manual').textContent=(error||'6 missiles / 18s reload after last launch')+' / '+(ship.ramp?'ANCHORED / G retract ramp':ship.launchRemaining>0?'LAUNCHING / Hold position':surfaced(ship)?'G ramp / Surface recharges battery':state==='submerged'?'HIDDEN FROM SWIMMERS / Auto-surface at zero':'TRANSITION / Still vulnerable');
  }
}
async function shipInteract() {
  if (shipBusy || !connected) return;
  const entering=!me.shipId&&nearbyShip();
  shipBusy = true; keys.clear(); stopFiring();
  try { await api(me.shipId ? 'ships/exit' : 'ships/board', {id:nearbyShip()?.id}); setMode('explore'); recenter(); if(isSubmarine(entering))camera.zoom=width<760?.12:.3;canvas.focus({preventScroll:true}); }
  catch (e) { notify(e.message); }
  finally { shipBusy = false; updateShips(); }
}
async function shipDepth(action) {
  if(!combatInputAllowed()||shipBusy||!isSubmarine(currentShip()))return;
  shipBusy=true;keys.clear();stopFiring();
  try{await api('ships/depth',{action});canvas.focus({preventScroll:true});}
  catch(e){notify(e.message);}finally{shipBusy=false;updateShips();}
}
async function shipRamp() {
  const ship=currentShip();if(!ship||shipBusy||!connected||!combatInputAllowed())return;
  const deployed=!ship.ramp;
  shipBusy=true;keys.clear();stopFiring();
  try{await api('ships/ramp',{deployed});notify(deployed?'Shore ramp deployed. Anchored / E to disembark.':'Ramp retracted. Ready to sail.');canvas.focus({preventScroll:true});}
  catch(e){notify(e.message);}finally{shipBusy=false;updateShips();}
}
async function shipAmmo(ammo) {
  if (!currentShip() || shipBusy || !connected) return;
  cancelShipClick();
  shipBusy = true;
  try { await api('ships/ammo', {ammo}); } catch (e) { notify(e.message); }
  finally { shipBusy = false; updateShips(); }
}
function shipFire() {
  if (!combatInputAllowed() || !currentShip() || shipBusy || !aim) return;
  const ship=currentShip();
  if(isSubmarine(ship)){void commitShipFire(ship.id,{...aim},'strike');return;}
  if(shipClick&&shipClick.shipId===ship.id){cancelShipClick();void commitShipFire(ship.id,{...aim},'salvo');return;}
  const shot={shipId:ship.id,target:{...aim},timer:null};
  shot.timer=setTimeout(()=>{shipClick=null;void commitShipFire(shot.shipId,shot.target,'volley');},240);shipClick=shot;
}
async function commitShipFire(shipId,target,mode) {
  if(!combatInputAllowed()||currentShip()?.id!==shipId||shipBusy)return;
  shipBusy = true;
  try { await api('ships/fire', {...target,mode,rotated:subRotated}); } catch (e) { notify(e.message); }
  finally { shipBusy = false; updateShips(); }
}
async function shipSecondary() {
  if(!combatInputAllowed() || !currentShip() || isSubmarine(currentShip()) || sideBusy || !aim || performance.now()<nextSideShot)return;
  sideBusy=true;nextSideShot=performance.now()+180;
  try{await api('ships/secondary',aim);}catch(e){stopFiring();notify(e.message);}finally{sideBusy=false;}
}
function updateReplacement(kind,list) {
  const v=kind==='ship'?selectedVessel():list.find(v=>v.owner===me.id),b=$(kind+'-replace');b.hidden=!v?.destroyed || forceTab!==(kind==='ship'?'navy':'ground');
  b.disabled=!connected || !alive() || me.body!=='robot' || (v?.replacement||0)>.001;
  b.textContent=(v?.replacement||0)>.001 ? 'Replacement ready in '+Math.ceil(v.replacement)+'s' : 'Replace destroyed '+kind+' / Original drop site';
}
async function replaceVehicle(kind) {
  const v=kind==='ship'?selectedVessel():world.tanks.find(v=>v.owner===me.id);if(!v)return;
  try { const result=await api('vehicles/replace',{kind,id:v.id});deploymentFocus=result.vehicle.id;setMode('explore'); } catch(e){notify(e.message);}
}
function findShip(dock = false) {
  const ship = currentShip() || selectedVessel();
  if (!ship) return;
  const p = dock ? ship.dock : ship;
  toggleTray(false); camera = {x:p.x*T,y:p.y*T,zoom:width<760?.5:.8}; following = false;
}
function drawShipAim(ship) {
  if(isSubmarine(ship)){
    const b=submarineBox(submarineAim(ship,world,aim,subRotated),subRotated),valid=surfaced(ship)&&!submarineTargetError(ship,world,aim,subRotated);
    ctx.save();ctx.strokeStyle=valid?'#f5d48c':'#ed977c';ctx.fillStyle=valid?'#f5d48c14':'#ed977c18';ctx.lineWidth=1.5/camera.zoom;
    ctx.fillRect(b.x*T,b.y*T,b.width*T,b.height*T);ctx.strokeRect(b.x*T,b.y*T,b.width*T,b.height*T);ctx.setLineDash([5/camera.zoom,6/camera.zoom]);
    const cols=subRotated?3:2,rows=subRotated?2:3;
    for(let i=1;i<cols;i++){const x=(b.x+b.width*i/cols)*T;ctx.beginPath();ctx.moveTo(x,b.y*T);ctx.lineTo(x,(b.y+b.height)*T);ctx.stroke();}
    for(let i=1;i<rows;i++){const y=(b.y+b.height*i/rows)*T;ctx.beginPath();ctx.moveTo(b.x*T,y);ctx.lineTo((b.x+b.width)*T,y);ctx.stroke();}
    ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(ship.x*T,ship.y*T);ctx.lineTo(aim.x*T,aim.y*T);ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);ctx.fillStyle=valid?'#f5d48c':'#ed977c';ctx.font=`bold ${11/camera.zoom}px monospace`;ctx.fillText('6 '+(ship.ammo==='INCENDIARY'?'FIRE':ship.ammo)+' / '+b.width+' x '+b.height,b.x*T,b.y*T-8/camera.zoom);ctx.restore();return;
  }
  const actual=shipSolution(ship,aim),r=8/camera.zoom,sides=SIDE_MOUNTS.map(m=>({...sideSolution(ship,aim,m),mount:m}));
  const close=sides.some(a=>a.inRange),ready=sides.some(a=>a.inArc&&a.inRange&&a.aligned);
  ctx.save();ctx.lineWidth=1.5/camera.zoom;ctx.strokeStyle=close?(ready?'#a3f1c7':'#efb17f'):actual.inRange?'#ffe1a2':'#ef9479';
  ctx.beginPath();ctx.moveTo(aim.x*T-r,aim.y*T);ctx.lineTo(aim.x*T+r,aim.y*T);ctx.moveTo(aim.x*T,aim.y*T-r);ctx.lineTo(aim.x*T,aim.y*T+r);ctx.stroke();
  if(actual.inRange&&!heldGun.size)for(const round of mainSalvo(ship,aim)){
    ctx.strokeStyle='#bceaf1';ctx.beginPath();ctx.moveTo(round.targetX*T,round.targetY*T-r);ctx.lineTo(round.targetX*T+r,round.targetY*T);ctx.lineTo(round.targetX*T,round.targetY*T+r);ctx.lineTo(round.targetX*T-r,round.targetY*T);ctx.closePath();ctx.stroke();
    if(round.barrel===-1){ctx.globalAlpha=.3;ctx.setLineDash([5/camera.zoom,6/camera.zoom]);ctx.beginPath();ctx.arc(round.targetX*T,round.targetY*T,ARTILLERY_SHELLS[ship.ammo].radius*T,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
  }
  if(close||heldGun.size)for(const a of sides){
    const from=ship.angle+a.mount.center-NAVAL_GUN.halfArc-Math.PI/2,to=from+NAVAL_GUN.halfArc*2;
    ctx.strokeStyle=a.inArc&&a.inRange?'#a3f1c7':'#bdd5d277';ctx.globalAlpha=.3;ctx.setLineDash([5/camera.zoom,8/camera.zoom]);ctx.beginPath();ctx.moveTo(a.x*T,a.y*T);ctx.arc(a.x*T,a.y*T,NAVAL_GUN.range*T,from,to);ctx.closePath();ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    const range=Math.min(NAVAL_GUN.range,a.distance),x=(a.x+Math.sin(a.angle)*range)*T,y=(a.y-Math.cos(a.angle)*range)*T;
    ctx.beginPath();ctx.arc(x,y,4/camera.zoom,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}

function updateArtillery() {
  const gun = controlledGun(), select = $('artillery-select');
  const signature = world.artillery.map(g => `${g.id}:${g.x}:${g.y}`).join(',');
  if (select.dataset.guns !== signature) {
    select.replaceChildren(...world.artillery.map(g => Object.assign(document.createElement('option'), { value: g.id, textContent: `${isMissile(g) ? (g.owner === me.id ? 'Your battery' : 'Friendly battery') : (g.owner === me.id ? 'Your cannon' : 'Friendly cannon')} · ${g.x}:${g.y}` })));
    select.dataset.guns = signature;
  }
  if (gun) selectedGunId = gun.id;
  if (!world.artillery.some(g => g.id === selectedGunId)) selectedGunId = world.artillery[0]?.id || '';
  select.value = selectedGunId; select.disabled = !!gun;
  document.querySelector('.battlefield').classList.toggle('artillery-control', !!gun);
  if ((gun?.id || null) !== lastControlledId) {
    keys.clear(); stopFiring(); path = []; lastInput = '0,0'; lastAim = null;
    if (gun) { bodyCamera = { ...camera }; $('artillery-panel').hidden = true; setMode('explore'); aim = isMissile(gun) ? gun.target || { x: Math.min(world.width - 9, gun.x + 32), y: Math.max(9, Math.min(world.height - 9, gun.y + 2)) } : artillerySolution(gun); mouseAim = null; setOrbitalView(true); }
    else if (lastControlledId) { setOrbitalView(false); if (bodyCamera) camera = { ...bodyCamera }; bodyCamera = null; setMode('explore'); recenter(); notify('Artillery control released. Your body is available.'); }
    lastControlledId = gun?.id || null;
  }
  if (!alive()) $('artillery-panel').hidden = true;
  if (gun) $('map-hint').textContent = 'Mouse aim / LMB fire / WASD rails / 1 2 3 shells / Wheel zoom';
  $('build-mode').disabled ||= !!gun;
  const selected = world.artillery.find(g => g.id === selectedGunId);
  $('artillery-control-button').disabled = !connected || !alive() || !selected || gunBusy || (!!selected.operator && selected.operator !== me.id);
  $('artillery-control-button').textContent = gun ? 'Release cannon / return to body' : selected?.operator ? 'Cannon occupied' : 'Take control';
  document.querySelector('.facility-heading strong').textContent = isMissile(gun) ? 'MISSILE BATTERY' : 'RAILWAY CANNON';
  document.querySelector('.facility-movement').hidden = isMissile(gun);
  $('missile-rotate').hidden = !isMissile(gun);
  if (isMissile(gun)) {
    const target = aim || gun.target, reason = missileFireError(gun, world, target, gun.rotated, combat.barrages || [], combat.fields || [], combat.salvos || []);
    const volley = combat.barrages?.find(b => b.owner === gun.id && b.age < 2.75);
    $('map-hint').textContent = 'Mouse / Tap area · LMB volley · R rotate · Wheel zoom';
    $('facility-controls').hidden = false; document.querySelector('.mode-dock').hidden = true; $('artillery-panel').hidden = true; $('facility-switches').hidden = true;
    $('artillery-status').textContent = volley ? `LAUNCHING ${Math.min(12, Math.floor(volley.age / .25) + 1)} / 12` : gun.reload > .001 ? `RELOADING ${gun.reload.toFixed(1)}s` : reason || (gun.ammo === 'INCENDIARY' ? 'FIRE' : gun.ammo || 'HE') + ' VOLLEY READY';
    $('artillery-trajectory').textContent = `12 missiles · ${gun.rotated ? '18 × 12' : '12 × 18'} area · 15–100 tiles`;
    $('artillery-guard').textContent = me.guarding ? 'Robot guarding' : 'Body parked · Escape returns';
    $('artillery-ammo-info').textContent = gun.ammo === 'INCENDIARY' ? 'Lethal fire / 18s per sector. Heat slows; enemies avoid it.' : gun.ammo === 'GAS' ? 'Lures nearby enemies / 18 shared kills. No timer.' : 'HE bombardment / scattered blasts and overlapping craters.';
    for (const button of document.querySelectorAll('[data-shell]')) { button.disabled = !connected || gunBusy; button.setAttribute('aria-pressed', String(button.dataset.shell === (gun.ammo || 'HE'))); }
    $('artillery-fire').textContent = 'LMB / 12 ' + (gun.ammo === 'INCENDIARY' ? 'Fire' : gun.ammo === 'GAS' ? 'Gas' : 'HE'); $('artillery-fire').disabled = !!reason || !connected || gunBusy || $('help-dialog').open;
    $('missile-rotate').disabled = !connected || gunBusy; return;
  }
  const reason = gun ? artilleryFireError(gun, world) || fieldCapacityError(combat.fields || [], combat.salvos || [], gun.ammo || 'HE') : 'Take control, then point to aim.';
  const solution = gun ? artillerySolution(gun) : null;
  $('artillery-trajectory').textContent = solution ? `Bearing ${(gun.angle * 180 / Math.PI).toFixed(1)}° · Elevation ${solution.elevation.toFixed(1)}° · ${solution.range.toFixed(1)} tiles · Flight ${solution.duration.toFixed(1)}s` : '';
  $('artillery-guard').textContent = gun ? me.guarding ? 'Robot guarding · Fuel nearby / Laser at distance' : 'Body parked · Manual return with Escape' : '';

  $('artillery-status').textContent = !gun ? reason : gun.move ? 'RELOCATING' : gun.brace > .001 ? `BRACING · ${gun.brace.toFixed(1)}s` : gun.reload > .001 ? `RELOADING · ${gun.reload.toFixed(1)}s` : gun.driveBlocked || reason || `${ARTILLERY_SHELLS[gun.ammo || 'HE'].label.toUpperCase()} READY`;
  const ammo = gun?.ammo || selected?.ammo || 'HE';
  $('facility-controls').hidden = !gun;
  document.querySelector('.mode-dock').hidden = !!gun;
  if (gun) $('artillery-panel').hidden = true;
  for (const button of document.querySelectorAll('[data-shell]')) { button.setAttribute('aria-pressed', String(button.dataset.shell === ammo)); button.disabled = !gun || !connected || gunBusy; }
  $('artillery-fire').textContent = 'LMB / Fire ' + (ammo === 'HE' ? 'HE' : ammo === 'GAS' ? 'Gas' : 'Fire');
  $('artillery-ammo-info').textContent = ammo === 'INCENDIARY' ? '3-tile lethal core / 18s. Outer heat slows. Enemies avoid fire.' : ammo === 'GAS' ? '2.6-tile cloud / 6 kills. Lures within 10 tiles. No timer.' : '3-tile blast / 8-tile cosmetic crater.';
  $('artillery-fire').disabled = !gun || !!reason || !connected || gunBusy || $('help-dialog').open;
}
async function gunAction(action, extra = {}) {
  if (gunBusy || !connected || !alive()) return;
  gunBusy = true;
  try { await api(`artillery/${action}`, { id: controlledGun()?.id || selectedGunId, ...extra }); }
  catch (error) { notify(error.message); }
  finally { gunBusy = false; updateArtillery(); }
}
function releaseArtillery() { if (controlledGun()) void gunAction('control', { release: true }); }
function heavyFire() { const gun = controlledGun(); if (gun && !$('help-dialog').open && !document.hidden) return gunAction('fire', isMissile(gun) ? { target: aim || gun.target, rotated: gun.rotated } : {}); }
function setOrbitalView(open) {
  orbitalView = open; document.querySelector('.battlefield').classList.toggle('artillery-orbit', open);
  if (open) fitOrbitalView(); following = false;
}
function fitOrbitalView() {
  const top = 90, bottom = width > 760 ? 180 : 250;
  camera.zoom = Math.min(.7, (width - 40) / (world.width * T), Math.max(120, height - top - bottom) / (world.height * T));
  camera.x = world.width * T / 2; camera.y = world.height * T / 2 + (bottom - top) / 2 / camera.zoom;
  $('zoom-label').textContent = Math.round(camera.zoom * 100) + '%';
}

function updateSurvival() {
  const aircraft = currentAircraft();
  const vehicle = currentShip() || world.tanks.find(t=>t.id===me.vehicleId), robot = me.body === 'robot', inactive = !alive();
  $('robot-health').hidden = !robot && !vehicle && !aircraft;
  $('health-value').textContent = `${Math.ceil(me.health ?? 100)} / ${SURVIVAL.health}`;
  $('health-meter').value = me.health ?? 100;
  $('health-label').textContent = me.shield > 0 ? 'LANDING SHIELD' : inactive ? 'BODY OFFLINE' : 'ROBOT HULL';
  if (me.guarding) $('health-label').textContent = 'ROBOT GUARDING';
  $('health-meter').max=vehicle?VEHICLE[me.shipId?'ship':'tank']:SURVIVAL.health;
  if(vehicle){$('health-label').textContent=me.shipId?'SHIP HULL':'TANK HULL';$('health-value').textContent=Math.ceil(hullHealth(vehicle))+' / '+$('health-meter').max;$('health-meter').value=hullHealth(vehicle);}
  if(aircraft){$('health-label').textContent=isAttackJet(aircraft)?'JET HULL':'BOMBER HULL';$('health-value').textContent=Math.ceil(aircraftHealth(aircraft))+' / '+AIR_HULL.health;$('health-meter').max=AIR_HULL.health;$('health-meter').value=aircraftHealth(aircraft);}
  document.querySelector('.battlefield').classList.toggle('recovering', inactive);
  $('recovery-panel').hidden = !inactive;
  for (const id of ['build-mode', 'site-button', 'sentry-card', 'start-drill']) $(id).disabled = inactive || !connected || (id === 'start-drill' && combat.status === 'active');
  $('fire-button').disabled = $('machine-gun-button').disabled = inactive || !connected || mode === 'build';
  if (lastHurt !== undefined && me.hurt > lastHurt) {
    document.querySelector('.battlefield').classList.add('hurt'); clearTimeout(hurtTimer);
    hurtTimer = setTimeout(() => document.querySelector('.battlefield').classList.remove('hurt'), 240);
  }
  lastHurt = me.hurt;
  if (!inactive) return;
  const activeCores = world.cores.filter(c => c.elapsed >= CORE.duration), select = $('recovery-core');
  const chosen = select.value || me.reviveCore || activeCores.find(c => c.owner === me.id)?.id;
  const signature = activeCores.map(c => c.id).join(',');
  if (select.dataset.cores !== signature) {
    select.replaceChildren(...activeCores.map(c => Object.assign(document.createElement('option'), { value: c.id, textContent: `${c.owner === me.id ? 'Your core' : 'Friendly core'} · ${c.x}:${c.y}` })));
    select.dataset.cores = signature;
    if (activeCores.some(c => c.id === chosen)) select.value = chosen;
  }
  const arriving = me.life === 'arriving';
  if (arriving) select.value = me.reviveCore;
  select.disabled = arriving || recoveryPending;
  $('recovery-title').textContent = arriving ? 'Replacement incoming' : me.lostVehicle ? (me.lostVehicle === 'aircraft' ? 'Aircraft shot down' : me.lostVehicle === 'ship' ? 'Ship destroyed' : 'Tank destroyed') : 'Robot disabled';
  $('recovery-message').textContent = recoveryError || (arriving ? 'Pod descending. Controls return on landing.' : me.recovery > .001 ? `Preparing replacement · ${Math.ceil(me.recovery)}s` : 'Choose a friendly core. A clear landing point will be selected within its circle.');
  $('revive-button').disabled = !connected || arriving || me.recovery > .001 || !activeCores.length || recoveryPending;
  $('revive-button').textContent = arriving ? 'Pod incoming…' : recoveryPending ? 'Requesting pod…' : 'Deploy replacement';
}
function inspectRecoveryCore() {
  const core = world.cores?.find(c => c.id === $('recovery-core').value);
  if (core) { camera.x = (core.x + 1.5) * T; camera.y = (core.y + 1.5) * T; camera.zoom = Math.min(.9, width / (15 * T), (height - 260) / (15 * T)); following = false; }
}

function notify(message) {
  if (!alive()) { recoveryError = message; $('recovery-message').textContent = message; return; }
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3600);
}
async function api(route, data) {
  const response = await fetch(`${worldAPI}${route}`, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (campaignId && response.status === 403 && /room|session|lobby/i.test(result.error || '')) { eventStream?.close(); location.assign('/campaigns/'); }
  if (response.status === 401) { eventStream?.close(); keys.clear(); stopFiring(); location.assign('/login/'); }
  if (!response.ok) throw new Error(result.error || 'Could not reach the outpost.');
  return result;
}
function connection(ok) {
  connected = ok;
  $('connection').classList.toggle('offline', !ok);
  $('connection').replaceChildren(Object.assign(document.createElement('i'), {}), document.createTextNode(ok ? 'Uplink live' : 'Reconnecting'));
  $('save-status').textContent = ok ? 'Server autosave on' : 'Offline · edits paused';
  updateSelection();
  $('fire-button').disabled = !ok || mode === 'build';
  $('machine-gun-button').disabled = !ok || mode === 'build';
  if (!ok) { stopFiring(); keys.clear(); }
  $('start-drill').disabled = !ok || combat.status === 'active';
  if (me) { updateSurvival(); if (world?.ships) updateShips(); }
}
function subscribe() {
  eventStream?.close();
  if (!navigator.onLine) { connection(false); return; }
  eventStream = new EventSource(worldAPI + 'events');
  eventStream.addEventListener('room-ended', () => { eventStream.close(); keys.clear(); stopFiring(); location.assign('/campaigns/'); });
  eventStream.addEventListener('session-ended', () => { eventStream.close(); keys.clear(); stopFiring(); location.assign('/login/'); });
  eventStream.onopen = () => { seenRevision = -1; connection(true); };
  eventStream.onmessage = event => updateState(JSON.parse(event.data));
  eventStream.onerror = () => connection(false);
}
window.addEventListener('offline', () => { eventStream?.close(); connection(false); });
window.addEventListener('online', () => { if (world) subscribe(); });
function updateState(state) {
  if (state.room) updateRoom(state.room);
  if (updatingClient) return;
  if (clientBuild && state.clientBuild && clientBuild !== state.clientBuild) {
    updatingClient = true; stopFiring(); keys.clear(); eventStream?.close();
    location.reload(); return;
  }
  if (state.revision < seenRevision) return;
  seenRevision = state.revision;
  buildings = state.buildings; players = state.players;
  world.logistics=state.logistics||world.logistics;
  const previousContacts = combat.naval?.count || 0;
  world.airbases=state.airbases||[];world.cores = state.cores || []; world.tanks = state.tanks || []; world.ships = state.ships || [];
  for (const tank of world.tanks) if (players.some(p => p.vehicleId === tank.id)) positions.delete(tank.id);
  world.rails = state.rails || []; world.switches = state.switches || []; world.artillery = state.artillery || [];
  $('switches-open').hidden = forceTab !== 'rail' || !world.rails.some(isCurve);
  $('facility-switches').hidden = !world.switches.length;
  const nextFloorKey = [...world.cores, ...world.tanks].filter(c => c.elapsed >= CORE.duration).map(c => c.id).join(',');
  if (floorKey !== nextFloorKey) { floorKey = nextFloorKey; paintTerrain(); }
  if (state.combat) {
    const previousSites = combat.sites || [];
    combat = state.combat;
    world.sites = combat.sites || [];
    for (const site of world.sites) if (site.state === 'conquered' && previousSites.some(s => s.id === site.id && s.state === 'hostile')) notify(`${site.settlement ? 'STRUCTURE DESTROYED' : 'REGION CONQUERED'} / ${site.kind === 'anti-air' ? 'Spore flak silenced. Airspace clear' : site.kind === 'laser' ? 'Lance tower silenced' : site.kind === 'contaminator' ? 'Air contaminator destroyed. Fog clearing' : site.kind === 'modifier' ? 'Blight root destroyed. Terrain recovering' : site.kind === 'mortar' ? 'Mortar outpost silenced' : 'Alert station silenced'} permanently. Surviving defenders remain.`);
    for (const group of settlements(world.sites)) if (group.state === 'conquered' && settlements(previousSites).some(s => s.id === group.id && s.state === 'hostile')) notify(`SETTLEMENT CONQUERED / ${group.name}. All three structures destroyed. Permanent progress saved.`);
    if(previousContacts===0 && combat.naval?.count>0) notify('SONAR CONTACT / Swimmers approaching ships. Watch their strike circles.');
    stateReceived = performance.now(); effects.ingest(combat, stateReceived);
    if (lastEffectEpoch !== combat.epoch) { lastEffectEpoch = combat.epoch; lastFeedback = -1; monsterPositions.clear(); sentryPositions.clear(); }
    for (const impact of combat.impacts) if (impact.id > lastFeedback) {
      lastFeedback = impact.id;
      if (!impact.hits?.length || combat.time - impact.at > 500 || concealed(world.sites, impact, combat.time)) continue;
      const killed = impact.hits.filter(h => h.killed).length;
      $('hit-feedback').textContent = killed ? `${killed} NEUTRALIZED` : 'HIT';
      $('hit-feedback').classList.add('visible');
      clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => $('hit-feedback').classList.remove('visible'), 1100);
    }
  }
  $('combat-status').textContent = ({ ready: 'Establish a foothold.', active: `Defend the beacon · ${combat.enemies.length} hostiles`, cleared: 'Sector clear. Good work.', failed: 'Beacon overrun. Try again.' })[combat.status];
  $('objective-health').textContent = `Drill beacon · ${Math.ceil(combat.health)}%`;
  if (combat.objective?.id !== 'landing' && combat.objective) $('objective-health').textContent = `${combat.objective.label} · ${Math.ceil(combat.health)}%`;
  const station = world.sites?.find(s => s.id === selectedSiteId) || world.sites?.[0];
  $('locate-station').hidden = !world.sites?.some(s => s.kind === 'alert');
  $('locate-anti-air').hidden = !world.sites?.some(s => s.kind === 'anti-air');
  $('locate-laser').hidden = !world.sites?.some(s => s.kind === 'laser');
  $('locate-contaminator').hidden = !world.sites?.some(s => s.kind === 'contaminator');
  $('locate-mortar').hidden = !world.sites?.some(s => s.kind === 'mortar');
  const colony = settlements(world.sites)[0];
  $('locate-settlement').hidden = !colony;
  $('settlement-objective').hidden = !colony || !station?.settlement;
  if (colony) {
    $('settlement-progress').textContent = colony.name + ' · ' + colony.cleared + '/3' + (colony.state === 'conquered' ? ' · Permanently conquered' : ' · Destroy all structures');
    const key = colony.members.map(s => s?.id + ':' + s?.state).join(',');
    if ($('settlement-targets').dataset.key !== key) {
      $('settlement-targets').dataset.key = key;
      $('settlement-targets').replaceChildren(...colony.members.map((site, i) => {
        const button = document.createElement('button');
        button.textContent = (site?.state === 'conquered' ? '✓ ' : '○ ') + ['Crown', 'Mortar', 'Root'][i];
        button.setAttribute('aria-label', 'Locate colony ' + ['crown', 'mortar', 'root'][i]);
        button.disabled = !site; button.onclick = () => locateSite(null, site.id); return button;
      }));
    }
  }
  $('locate-modifier').hidden = !world.sites?.some(s => s.kind === 'modifier');
  if (station && (combat.status !== 'active' || ['contaminator', 'laser', 'anti-air'].includes(station.kind))) {
    $('combat-status').textContent = station.state === 'conquered' ? 'Region conquered · Crown silenced' : 'Conquer the alert station · Use HE';
    $('objective-health').textContent = station.state === 'conquered' ? 'Permanent progress saved' : `${Math.ceil(station.hp)} / ${station.maxHp} HP · ${station.alarm ? 'Alarm active' : 'Quiet'}`;
    if (station.kind === 'mortar') {
      $('combat-status').textContent = station.state === 'conquered' ? 'Region conquered · Mortar silenced' : 'Conquer the mortar outpost · Use HE';
      if (station.state !== 'conquered') $('objective-health').textContent = `${Math.ceil(station.hp)} / ${station.maxHp} HP · ${station.mortar?.charge ? 'Launching acid' : station.mortar?.nextShot > combat.time ? 'Reloading' : 'Watching'}`;
    }
    if (station.kind === 'anti-air') {
      $('combat-status').textContent=station.state==='conquered'?'Spore flak silenced':'Spore flak / Use HE';
      $('objective-health').textContent=station.state==='conquered'?'Permanent progress saved':Math.ceil(station.hp)+' / '+station.maxHp+' HP / '+(station.aa?.phase||'watching')+' / Air targets only';
    }
    if (station.kind === 'laser') {
      $('combat-status').textContent = station.state === 'conquered' ? 'Lance tower silenced' : 'Lance tower / Use HE';
      $('objective-health').textContent = station.state === 'conquered' ? 'Permanent progress saved' : Math.ceil(station.hp) + ' / ' + station.maxHp + ' HP / ' + (station.laser?.phase || 'watching') + ' / Keep moving; use cover';
    }
    if (station.kind === 'modifier') {
      $('combat-status').textContent = station.state === 'conquered' ? 'Region conquered · Blight cleared' : 'Destroy the environment modifier · Use HE';
      $('objective-health').textContent = station.state === 'conquered' ? (combat.time - station.conqueredAt < MODIFIER.recovery ? 'Terrain recovering · Progress saved' : 'Natural terrain restored · Progress saved') : `${Math.ceil(station.hp)} / ${station.maxHp} HP · Alien terrain`;
    }
    if (station.state === 'hostile' && station.defenseReport?.until > combat.time) $('objective-health').textContent += ' · Sector alerted';
    if (station.kind === 'contaminator') {
      $('combat-status').textContent = station.state === 'conquered' ? 'Contaminator destroyed' : 'Air contaminator / Use HE';
      $('objective-health').textContent = 'Surveyed center: ' + (station.x + 1.5) + ', ' + (station.y + 1.5) + (station.state === 'conquered' ? (fogRadius(station, combat.time) > 0 ? ' / Fog clearing' : ' / Air clear, progress saved') : ' / Live status obscured');
    } else if (concealed(world.sites, { x: station.x + 1.5, y: station.y + 1.5 }, combat.time) && station.state !== 'conquered') {
      $('objective-health').textContent = 'Live status obscured by contamination';
    }
    if (station.settlement && station.state === 'conquered') $('combat-status').textContent = `${station.name} destroyed · ${colony.cleared}/3 objectives`;
  }
  $('drill-front').disabled = combat.status === 'active' || !connected;
  $('start-drill').textContent = combat.status === 'active' ? 'Drill live' : combat.status === 'ready' ? 'Start drill' : 'Retry drill';
  $('start-drill').disabled = !connected || combat.status === 'active';
  const mine = players.find(p => p.id === me.id);
  const threats = (world.sites || []).filter(s => s.state === 'hostile' && s.mortar?.charge).map(s => s.mortar.charge).concat((combat.acidShells || []).filter(s => !s.impacted));
  const position = mine || me;
  const fogged = position.body !== 'orbital' && concealed(world.sites, position, combat.time);
  $('fog-status').hidden = !fogged;
  $('coordinates').hidden = fogged;
  $('acid-warning').hidden = fogged || !['robot', 'rover'].includes(position.body) || position.life !== 'active' || !threats.some(s => Math.hypot(s.x - position.x, s.y - position.y) <= MORTAR.radius + .5);
  const detected = detectionFor(world.sites || [], me.id, combat.time);
  $('detection-status').hidden = !detected;
  if (detected) $('detection-status').textContent = combat.time - detected.seenAt <= 150
    ? 'DETECTED · Break the tracking beam with cover'
    : `CONTACT LOST · Detected ${Math.ceil((detected.until - combat.time) / 1000)}s`;
  if (mine) {
    if (mine.aircraftId !== me.aircraftId || mine.vehicleId !== me.vehicleId || mine.shipId !== me.shipId) { keys.clear(); stopFiring(); positions.delete(me.id); lastInput = '0,0'; lastAim = null; }
    const startedLanding = mine.deploying && !me.deploying;
    const previousLife = me.life;
    me = { ...me, ...mine };
    if (startedLanding) { deploymentFocus = world.cores.find(c => c.owner === me.id)?.id; positions.delete(me.id); keys.clear(); stopFiring(); lastInput = '0,0'; lastAim = null; setMode('explore'); canvas.focus({ preventScroll: true }); }
    if (previousLife !== me.life) {
      recoveryError = '';
      keys.clear(); stopFiring(); positions.delete(me.id); setMode('explore');
      $('toast').classList.remove('visible');
      if (previousLife === 'arriving' && me.life === 'disabled') notify('Landing was blocked. Choose a clear core and try again.');
      if (me.life === 'active') { recenter(); notify('Replacement online. Landing shield active for two seconds.'); }
    }
    if (Math.hypot(me.x - world.spawn.x, me.y - world.spawn.y) > 0.8) moved = true;
  }
  $('presence').textContent = roomState ? `${roomState.players} / ${roomState.limit} · ${roomState.paused ? 'PAUSED' : 'CAMPAIGN'}` : `${players.length || 1} SCOUTS · LEGACY WORLD`;
  document.querySelector('.battlefield').classList.toggle('in-orbit', inOrbit());
  $('explore-mode').disabled = inOrbit();
  $('building-count').textContent = `${buildings.length} ${buildings.length === 1 ? 'FOUNDATION' : 'FOUNDATIONS'}`;
  $('task-explore').classList.toggle('done', moved);
  $('task-build').classList.toggle('done', buildings.some(b => b.owner === me.id));
  $('task-save').classList.toggle('done', initialFoundations > 0);
  logistics.update(); updateCatalogue();
  updateSelection();
  if(inOrbit()&&mode!=='build')beginCoreSurvey('core');
  $('core-card').disabled = !!world.cores.find(c => c.owner === me.id) || !connected;
  document.querySelector('.battlefield').classList.toggle('deploying', !!me.deploying);
  $('tank-loadout').hidden = me.body !== 'rover' || !!controlledGun() || mode === 'build';
  $('tank-primary').value = me.tankWeapon || 'HE'; $('tank-secondary').value = me.tankSecondary || 'APCR';
  if (displayedBody !== me.body + ':' + (me.tankWeapon || 'HE') + ':' + (me.tankSecondary || 'APCR')) {
    stopFiring(); displayedBody = me.body + ':' + (me.tankWeapon || 'HE') + ':' + (me.tankSecondary || 'APCR');
    const equipped = loadout(me.body, me.tankWeapon, me.tankSecondary);
    $('weapon-he').querySelector('span').textContent = WEAPONS[equipped.primary].label;
    $('weapon-mg').querySelector('span').textContent = WEAPONS[equipped.secondary].label;
    $('fire-button').querySelector('small').textContent = me.body === 'robot' ? 'HOLD FUEL' : me.tankWeapon === 'MAGNETIC' ? 'CHARGE' : 'CANNON';
    $('machine-gun-button').querySelector('small').textContent = me.body === 'robot' ? 'HOLD LASER' : me.tankSecondary === 'HEAVY_FLAME' ? 'HOLD FUEL' : 'HOLD MG';
    $('fire-button').setAttribute('aria-label', me.body === 'robot' ? 'Fire fuel jet' : me.tankWeapon === 'MAGNETIC' ? 'Charge magnetic cannon' : 'Fire cannon');
    $('machine-gun-button').setAttribute('aria-label', me.body === 'robot' ? 'Fire laser rifle' : me.tankSecondary === 'HEAVY_FLAME' ? 'Fire heavy fuel jet' : 'Fire machine gun');
  }
  const recoveryWasHidden = $('recovery-panel').hidden;
  updateSurvival();
  updateArtillery(); updateSwitches(); updateTankControl(); updateShips(); updateAircraft();
  if (recoveryWasHidden && !alive()) { inspectRecoveryCore(); $('recovery-core').focus({ preventScroll: true }); }
  updateHud();
}
function setMode(next) {
  stopFiring();
  if (inOrbit()) { next = 'build'; deploymentKind = 'core'; }
  mode = next;
  document.querySelector('.battlefield').classList.toggle('surveying', next === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind));
  $('fire-button').disabled = !connected || next === 'build';
  $('machine-gun-button').disabled = !connected || next === 'build';
  for (const name of ['explore', 'build']) {
    $(`${name}-mode`).classList.toggle('active', name === next);
    $(`${name}-mode`).setAttribute('aria-pressed', String(name === next));
  }
  const coarse = matchMedia('(pointer:coarse)').matches;
  $('map-hint').textContent = next === 'build' ? (coarse ? 'Tap a clear site · Confirm below' : 'Click a site · Enter confirm · Shift+Enter keep placing' + (deploymentKind === 'rail' ? ' · R shape · T length' : '') + ' · Esc cancel') : coarse ? 'Tap to aim · Buttons fire · Pad moves' : 'WASD move · Mouse aim · B deploy · F1 keys';
  toggleTray(false); toggleSite(false);
  updateSelection(); if (world) { updateTankControl(); updateShips(); updateAircraft(); }
  if (inOrbit()) { following = false; $('map-hint').textContent = 'In orbit / Choose a core landing site / Confirm orbital drop'; toggleSite(true); }
  updateHud();
}
function beginCoreSurvey(kind = 'core') {
  if(kind!=='tank')emergencyDeployment=false;
  if (!world || me.deploying || !alive()) return;
  deploymentKind = kind; keys.clear(); setMode('build'); following = false; mouseAim = null;
  let best, distance = Infinity;
  for (let y = 4; y < world.height - 6; y++) for (let x = 4; x < world.width - 6; x++) {
    const d = Math.hypot(x + 1.5 - me.x, y + 1.5 - me.y);
    if (d < distance && !deploymentError(x, y)) { best = { x, y }; distance = d; }
  }
  if (best) select(best.x, best.y);
  camera = { x: world.width * T / 2, y: world.height * T / 2, zoom: Math.min((width - 24) / (world.width * T), (height - 210) / (world.height * T)) };
  $('map-hint').textContent = 'Orbital survey · Choose the centre block · Confirm landing';
  toggleSite(true); canvas.focus({ preventScroll: true });
}
function toggleTray(open) {
  if (inOrbit()) { if (open) beginCoreSurvey(); return; }
  if (open && (controlledGun() || me.vehicleId || me.shipId || me.aircraftId)) { notify('Release the cannon before building.'); return; }
  $('deployment-tray').hidden = !open;
  $('build-mode').setAttribute('aria-expanded', String(open));
  if (open && !alive()) { $('deployment-tray').hidden = true; return; }
  if (open) { stopFiring(); toggleSite(false); updateCatalogue(); }
}
function toggleSite(open) {
  if (inOrbit()) open = true;
  if (open) $('artillery-panel').hidden = true;
  else if (controlledGun()) $('artillery-panel').hidden = false;
  $('site-panel').hidden = !open;
  $('site-button').setAttribute('aria-expanded', String(open));
  if (open) {
    stopFiring();
    toggleTray(false);
    // Keep the chosen site above the phone's confirmation sheet.
    if (world && width <= 760 && mode === 'build' && deploymentKind !== 'core') {
      camera.x = (selected.x + .5) * T;
      camera.y = (selected.y + .5) * T + height * .14 / camera.zoom;
      following = false;
    }
  }
}
async function fire(weapon = 'HE') {
  if(me?.aircraftId)return weapon==='HE'?aircraftAction('bomb'):undefined;
  if (me?.shipId) return weapon === 'HE' ? shipFire() : shipSecondary();
  const primary = weapon === 'HE';
  weapon = loadout(me?.body, me?.tankWeapon, me?.tankSecondary)[primary ? 'primary' : 'secondary'];
  if (!combatInputAllowed() || firing.has(weapon) || performance.now() < nextFire[weapon] || !aim) return;
  firing.add(weapon); nextFire[weapon] = performance.now() + WEAPONS[weapon].cooldown + (WEAPONS[weapon].charge || 0) + (weapon === 'HE' ? 50 : 30);
  try {
    await api('fire', { ...aim, weapon });
    const readout = $(primary ? 'weapon-he' : 'weapon-mg');
    readout.classList.add('firing'); clearTimeout(flashTimers[weapon]);
    flashTimers[weapon] = setTimeout(() => readout.classList.remove('firing'), 110);
  }
  catch (error) { if (!error.message.includes('reloading')) { stopFiring(); notify(error.message); } }
  finally { firing.delete(weapon); }
}
function select(x, y, center = false) {
  selected = { x: Math.max(0, Math.min(world.width - 1, Math.floor(x))), y: Math.max(0, Math.min(world.height - 1, Math.floor(y))) };
  $('tile-x').value = selected.x; $('tile-y').value = selected.y;
  if (center) { camera.x = (selected.x + 0.5) * T; camera.y = (selected.y + 0.5) * T; following = false; }
  if (mode !== 'build') { mouseAim = null; aim = { x: selected.x + .5, y: selected.y + .5 }; }
  updateSelection();
}
function updateSelection() {
  if (!world) return;
  const { x, y } = selected, terrain = tileAt(world, x, y), building = buildings.find(b => b.x === x && b.y === y);
  const coreMode = mode === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind);
  const error = mode === 'build' ? deploymentError(x, y) : placementError(world, buildings, groundPlayers(), x, y);
  $('rail-options').hidden = !(mode === 'build' && deploymentKind === 'rail');
  $('tile-coordinate').textContent = `${String(x).padStart(2, '0')} : ${String(y).padStart(2, '0')}`;
  $('terrain-name').textContent = building ? (building.weapon === 'HEAVY_FLAME' ? 'Flamethrower sentry' : 'APCR sentry') : LABELS[terrain];
  $('terrain-swatch').style.backgroundColor = ['#31585b', '#d2c6a1', '#93a57a', '#7b8371', '#647071'][terrain];
  $('terrain-description').textContent = building ? (building.owner === me.id ? 'Placed by you' : 'Placed by another scout') : terrain === 0 ? 'Naval territory · not walkable' : terrain === 3 ? 'Obstructed terrain' : 'Ground territory · walkable';
  $('site-title').textContent = coreMode ? 'Orbital landing site' : deploymentKind === 'rail' && mode === 'build' ? 'Lay railway track' : deploymentKind === 'artillery' && mode === 'build' ? 'Railway cannon site' : 'Deployment site';
  $('site-reason').textContent = error || (coreMode ? '57 tiles reserved. Covered rocks become flooring. One saved core per scout in this field test.' : mode === 'build' && deploymentKind === 'rail' ? 'Centered on this tile. Keep three tiles of corridor width clear.' : mode === 'build' && deploymentKind === 'artillery' ? 'Clear 3 × 3 platform. Three straight rail tiles required beneath it.' : 'Clear ground. A 1 × 1 foundation fits here.');
  if(mode==='build'&&deploymentKind==='airbase'){$('site-title').textContent='Airbase site / 6 x 10';if(!error)$('site-reason').textContent='Clear land / Selected tile is the top-left corner. Approach the gold apron to board and launch.';}
  if (mode === 'build' && deploymentKind === 'ship') { $('site-title').textContent = shipName({kind:deploymentShipKind})+' drop site'; if (!error) $('site-reason').textContent = '3 x 1 shore platform / 3 x 5 offshore dock / ship alongside. Approach the shore point after unfolding to board.'; }
  if (mode === 'build' && deploymentKind === 'tank') { $('site-title').textContent = 'Tank drop site'; if (!error) $('site-reason').textContent = '1 x 1 pod / four 1 x 4 panels / 17 tiles. Rocks become flooring. Approach the tank after landing to board.'; }
  const curve = { ...selected, shape: $('rail-shape').value };
  if (mode === 'build' && deploymentKind === 'missile') { $('site-title').textContent = 'Missile battery site'; if (!error) $('site-reason').textContent = '4 × 4 fixed battery. Selected tile is the top-left corner. 12 missiles / HE, Fire, Gas / 15s reload.'; }
  $('construction-help').hidden = mode !== 'build' || !needsConstruction(deploymentKind);
  $('construction-method-row').hidden=mode!=='build'||!['airbase','ship','missile','artillery'].includes(deploymentKind);
  $('deployment-cost').textContent=mode==='build'?`${deploymentPrice()} supplies / ${deliveryData().method==='factory'?'Factory construction: 20 seconds':'Orbital delivery'}${emergencyDeployment&&deploymentKind==='tank'?' / Emergency HE':''}`:'';
  if(mode==='build'&&LOGISTICS_SIZE[deploymentKind]){$('site-title').textContent=deploymentKind==='uplink'?'Cargo launch station':deploymentKind==='factory'?'Construction factory':'Mobile recycler';if(!error)$('site-reason').textContent=deploymentKind==='recycler'?'Remotely drive to conquered ruins from Logistics. Cargo must be shipped to orbit.':'Fixed, destructible infrastructure. Assembly takes eight seconds.';}
  $('construction-help').textContent = `Blue circle: ${CONSTRUCTION.radius}-tile construction support from a completed friendly core or factory. ${deploymentKind === 'ship' ? 'Keep the shore platform inside; the offshore dock may extend beyond it.' : 'Keep the whole facility inside one circle.'}`;
  $('rail-length').disabled = isCurve(curve) || isCompact(curve);
  if (isCompact(curve)) $('rail-length').value = '1';
  if (mode === 'build' && deploymentKind === 'rail' && !error) $('site-reason').textContent = 'Corners and junctions occupy one tile. Crossing your EW and NS rails creates a junction. WASD chooses a connected exit; leave room for the cannon body.';
  if (mode === 'build' && deploymentKind === 'rail' && isCurve(curve) && !error) $('site-reason').textContent = `Clear 8 × 8 turning apron. Connect three straight tiles centered at ${curveEnds(curve).map(e => `${e.x}:${e.y} (${e.shape})`).join(' and ')}.`;
  $('place-building').disabled = !!error || !connected || pending || me.deploying || !alive();
  const analysis = mode === 'build' && deploymentKind === 'core' ? coreSiteAnalysis(world, x, y) : null;
  $('site-analysis').hidden = !analysis; if (analysis) renderSiteAnalysis(analysis, error);
  $('site-reason').hidden = !!analysis; $('deployment-cost').hidden = !!analysis;
  const step = orbitStep({ error, pending });
  for (const li of $('orbit-steps').children) { const n = Number(li.dataset.step); li.classList.toggle('done', n < step); li.classList.toggle('current', n === step); li.toggleAttribute('aria-current', n === step); }
  $('place-building').replaceChildren(document.createTextNode(pending ? 'Saving deployment…' : !connected ? 'Waiting for connection' : error ? 'Choose a clear site' : coreMode ? 'Confirm orbital drop' : mode === 'build' && deploymentKind === 'rail' ? 'Lay rails' : mode === 'build' && deploymentKind === 'artillery' ? 'Deploy railway cannon' : mode === 'build' && deploymentKind === 'missile' ? 'Deploy missile battery' : LOGISTICS_SIZE[deploymentKind] ? 'Deploy '+deploymentKind : 'Deploy sentry'), Object.assign(document.createElement('span'), { textContent: '+' }));
  const selectedCurve = world.rails.find(r => r.x === x && r.y === y && isCurve(r));
  $('enable-switch').hidden = !selectedCurve || selectedCurve.owner !== me.id || !!switchAt(world, selectedCurve);
  $('enable-switch').disabled = !connected || !!controlledGun() || (selectedCurve && switchLocked(world, selectedCurve));
  $('remove-rail').hidden = !world.rails?.some(r => r.x === x && r.y === y && canManageOwner(r.owner));
  $('remove-building').hidden = !building || !canManageOwner(building.owner) || !!building.coreId;
  $('remove-building').disabled = pending || !connected;
  $('sentry-options').hidden = !building; $('sentry-weapon').value = building?.weapon || 'APCR'; $('sentry-weapon').disabled = !building || !canManageOwner(building.owner) || !connected || pending;
}
async function place() {
  if (pending || $('place-building').disabled) return;
  pending = true; updateSelection();
  try {
    if(mode==='build'&&LOGISTICS_SIZE[deploymentKind]){const result=await api('logistics/deploy',{...selected,kind:deploymentKind});setMode('explore');camera.x=(result.facility.x+LOGISTICS_SIZE[deploymentKind]/2)*T;camera.y=(result.facility.y+LOGISTICS_SIZE[deploymentKind]/2)*T;camera.zoom=width<760?.45:.7;following=false;notify('Orbital logistics delivery accepted. Open Supplies / Logistics to operate it.');return;}
    if(mode==='build'&&deploymentKind==='airbase'){const result=await api('airbases',{...selected,kind:deploymentAircraftKind,...deliveryData()});if(!world.airbases.some(b=>b.id===result.airbase.id))world.airbases.push(result.airbase);setMode('explore');locateAirbase();notify(deploymentAircraftKind==='attack-jet'?'Airbase ready. Orbital jet arriving at the runway.':'Airbase ready. Approach the gold apron and press E to board.');return;}
    if (mode === 'build' && deploymentKind === 'ship') {
      const { ship } = await api('ships', {...selected,kind:deploymentShipKind,dockStyle:'unfolding',...deliveryData()}); if (!world.ships.some(s => s.id === ship.id)) world.ships.push(ship);
      deploymentFocus = ship.id; keys.clear(); stopFiring(); setMode('explore'); return;
    }
    if (mode === 'build' && deploymentKind === 'tank') {
      const { tank } = await api('tanks', {...selected,emergency:emergencyDeployment}); if (!world.tanks.some(t => t.id === tank.id)) world.tanks.push(tank);
      deploymentFocus = tank.id; keys.clear(); stopFiring(); setMode('explore'); return;
    }
    if (mode === 'build' && deploymentKind === 'missile') {
      const { gun } = await api('missiles', {...selected,...deliveryData()}); selectedGunId = gun.id;
      if (!world.artillery.some(g => g.id === gun.id)) world.artillery.push(gun);
      if(deliveryData().method==='factory'){setMode('explore');notify('Factory order placed. Ready in 20 seconds.');return;}
      await gunAction('control'); return;
    }
    if (mode === 'build' && deploymentKind === 'rail') {
      await api('rails', { ...selected, shape: $('rail-shape').value, length: Number($('rail-length').value) }); notify('Track saved. Connect the approaches, then deploy or relocate your cannon.'); return;
    }
    if (mode === 'build' && deploymentKind === 'artillery') {
      const { gun } = await api('artillery', {...selected,...deliveryData()}); selectedGunId = gun.id; setMode('explore'); $('artillery-panel').hidden = false;
      if(deliveryData().method==='factory'){notify('Factory order placed. Ready in 20 seconds.');return;}
      await gunAction('control'); notify('Cannon deployed. Mouse aims, LMB fires, WASD travels on rails. 1/2/3 selects shells.'); return;
    }
    if (deploymentKind === 'core' && mode === 'build') {
      const { core } = await api('cores', selected);
      deploymentFocus = core.id; keys.clear(); stopFiring(); setMode('explore');
      $('toast').classList.remove('visible'); return;
    }
    const { building } = await api('buildings', selected);
    if (!buildings.some(b => b.id === building.id)) buildings.push(building);
    $('task-build').classList.add('done');
    notify('Sentry placed and saved. Ready to defend.');
    if (!keepPlacing) setMode('explore');
  } catch (error) { notify(error.message); }
  finally { pending = false; keepPlacing = false; updateSelection(); }
}
function resize() {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  width = rect.width; height = rect.height;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (orbitalView && world) fitOrbitalView();
}
function recenter() { if (inOrbit()) { beginCoreSurvey(); return; } if (me) { const point = controlledGun() ? gunPosition(controlledGun()) : me; camera.x = point.x * T; camera.y = point.y * T; following = !controlledGun(); } }
function zoom(factor) {
  camera.zoom = Math.max(orbitalView || currentAircraft() || isSubmarine(currentShip()) || (mode === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind)) ? .035 : 0.35, Math.min(1.8, camera.zoom * factor));
  $('zoom-label').textContent = `${Math.round(camera.zoom * 100)}%`;
}
function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((clientX - rect.left - width / 2) / camera.zoom + camera.x) / T, y: ((clientY - rect.top - height / 2) / camera.zoom + camera.y) / T };
}
function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
function roundRect(c, x, y, w, h, r = 4) { c.beginPath(); c.roundRect(x, y, w, h, r); }

const terrainChunks = new Map();
let oceanRestrictionCanvas;
function paintTerrain() {
  terrainChunks.clear();
  terrainCanvas = document.createElement('canvas'); terrainCanvas.width = world.width * 4; terrainCanvas.height = world.height * 4;
  const c = terrainCanvas.getContext('2d');
  oceanRestrictionCanvas = document.createElement('canvas'); oceanRestrictionCanvas.width = world.width; oceanRestrictionCanvas.height = world.height;
  const ocean = oceanRestrictionCanvas.getContext('2d'); ocean.fillStyle = '#ed505063';
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
    c.fillStyle = ['#31585b', '#cfc29b', '#93a17c', '#607160', '#798d89'][tileAt(world, x, y)]; c.fillRect(x * 4, y * 4, 4, 4);
    if (tileAt(world, x, y) === 0) ocean.fillRect(x, y, 1, 1);
  }
}
function drawTerrain() {
  const left = Math.max(0, Math.floor((camera.x - width / camera.zoom / 2) / (T * 16))), right = Math.min(Math.ceil(world.width / 16) - 1, Math.floor((camera.x + width / camera.zoom / 2) / (T * 16)));
  const top = Math.max(0, Math.floor((camera.y - height / camera.zoom / 2) / (T * 16))), bottom = Math.min(Math.ceil(world.height / 16) - 1, Math.floor((camera.y + height / camera.zoom / 2) / (T * 16)));
  if (camera.zoom < .5 || (right - left + 1) * (bottom - top + 1) > 32) { ctx.drawImage(terrainCanvas, 0, 0, world.width * T, world.height * T); return; }
  for (let cy = top; cy <= bottom; cy++) for (let cx = left; cx <= right; cx++) {
    const key = cx + ',' + cy; let chunk = terrainChunks.get(key);
    if (!chunk) chunk = makeTerrainChunk(cx, cy);
    terrainChunks.delete(key); terrainChunks.set(key, chunk);
    ctx.drawImage(chunk, cx * 16 * T, cy * 16 * T);
  }
  while (terrainChunks.size > 32) terrainChunks.delete(terrainChunks.keys().next().value);
}
function makeTerrainChunk(cx, cy) {
  const tileCanvas = document.createElement('canvas'); tileCanvas.width = tileCanvas.height = 16 * T;
  const c = tileCanvas.getContext('2d'); c.translate(-cx * 16 * T, -cy * 16 * T);
  c.fillStyle = '#31585b'; c.fillRect(cx * 16 * T, cy * 16 * T, 16 * T, 16 * T);
  // Coast shallows are an overlay; collision is always the stored terrain type.
  for (let y = cy * 16; y < Math.min(world.height, (cy + 1) * 16); y++) for (let x = cx * 16; x < Math.min(world.width, (cx + 1) * 16); x++) {
    if (tileAt(world, x, y)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(world, x + dx, y + dy));
    if (near) { c.fillStyle = '#58817a'; c.fillRect(x * T, y * T, T, T); }
    else if (hash(x, y) % 3 === 0) {
      c.strokeStyle = '#b2c9ae16'; c.lineWidth = 1; c.beginPath();
      c.moveTo(x * T + 9, y * T + 25); c.quadraticCurveTo(x * T + 16, y * T + 21, x * T + 23, y * T + 25); c.stroke();
    }
  }
  for (let y = cy * 16; y < Math.min(world.height, (cy + 1) * 16); y++) for (let x = cx * 16; x < Math.min(world.width, (cx + 1) * 16); x++) {
    const kind = tileAt(world, x, y); if (!kind) continue;
    const px = x * T, py = y * T;
    c.fillStyle = kind === 1 ? '#cfc29b' : '#93a17c'; c.fillRect(px, py, T, T);
    const texture = images[`${kind === 1 ? 'tileSand' : 'tileGrass'}${hash(x, y) % 2 + 1}.png`];
    c.globalAlpha = .23; c.drawImage(texture, px, py, T, T); c.globalAlpha = 1;
    if (kind === 4) { c.fillStyle = '#798d89'; c.fillRect(px, py, T, T); c.strokeStyle = '#b6c5ae'; c.lineWidth = 2; c.strokeRect(px + 3, py + 3, T - 6, T - 6); }
    if (kind === 3) {
      c.fillStyle = '#607160'; c.beginPath(); c.moveTo(px + 5, py + 22); c.lineTo(px + 16, py + 8); c.lineTo(px + 35, py + 11); c.lineTo(px + 43, py + 29); c.lineTo(px + 32, py + 41); c.lineTo(px + 10, py + 38); c.closePath(); c.fill();
      c.strokeStyle = '#c8d0b750'; c.beginPath(); c.moveTo(px + 12, py + 20); c.lineTo(px + 20, py + 13); c.lineTo(px + 34, py + 15); c.stroke();
    }
    if (kind === 2 && hash(x, y) % 29 === 0 && Math.hypot(x - 24, y - 18) > 5) {
      c.globalAlpha = .7; c.drawImage(images['treeGreen_small.png'], px + 8, py + 8, 29, 29); c.globalAlpha = 1;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!tileAt(world, x + dx, y + dy)) {
      c.strokeStyle = '#e6dcba'; c.lineWidth = 3; c.beginPath();
      if (dx) { const xx = px + (dx > 0 ? T - 1 : 1); c.moveTo(xx, py); c.lineTo(xx, py + T); }
      else { const yy = py + (dy > 0 ? T - 1 : 1); c.moveTo(px, yy); c.lineTo(px + T, yy); } c.stroke();
    }
  }
  return tileCanvas;
}
function drawBuilding(building, ghost = false, dt = 0, now = performance.now()) {
  const x = (building.x + .5) * T, y = (building.y + .5) * T;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = ghost ? .55 : 1;
  ctx.fillStyle = '#263a3330'; roundRect(ctx, -17, -14, 38, 36, 5); ctx.fill();
  ctx.fillStyle = '#566c58'; roundRect(ctx, -19, -19, 38, 38, 4); ctx.fill();
  ctx.strokeStyle = '#cbd1ad'; ctx.lineWidth = 2; ctx.strokeRect(-15, -15, 30, 30);
  ctx.fillStyle = '#34493c'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  let angle = SENTRY_TURRET.restAngle;
  if (!ghost) {
    const mount = combat.sentries[building.id];
    const actual = mount?.angle ?? SENTRY_TURRET.restAngle;
    const projected = turnTurret(actual, mount?.aim ?? actual, connected ? Math.min((now - stateReceived) / 1000, .1) : 0, SENTRY_TURRET.speed);
    angle = turnTurret(sentryPositions.get(building.id) ?? actual, projected, dt, SENTRY_TURRET.speed);
    sentryPositions.set(building.id, angle);
  }
  ctx.rotate(angle); ctx.drawImage(images['tankDark_barrel1.png'], -4, -25 + effects.recoil(building.id, now, 'APCR'), 8, 32);
  ctx.fillStyle = building.weapon === 'HEAVY_FLAME' ? '#f17739' : '#dcb26f'; ctx.fillRect(-3, -2, 6, 4); ctx.restore();
}
function drawScout(player, dt, now) {
  if (player.body === 'orbital') return;
  if (player.aircraftId || player.shipId || player.body === 'ship' || (player.life==='disabled' && player.lostVehicle==='ship')) return;
  if (player.life === 'arriving') { drawReplacement(ctx, player, T, connected ? Math.min((now - stateReceived) / 1000, .1) : 0, effects.reduced); positions.delete(player.id); return; }
  const arrival = world.cores?.find(c => c.owner === player.id && c.elapsed < CORE.duration);
  if (arrival && arrival.elapsed < CORE.exit) return;
  let position = positions.get(player.id);
  if (!position) { position = { x: player.x, y: player.y, angle: player.angle, turret: player.turret ?? player.angle }; positions.set(player.id, position); }
  position.phase = (position.phase || 0) + Math.hypot(player.x - position.x, player.y - position.y) * .3 * 8;
  position.x += (player.x - position.x) * .3; position.y += (player.y - position.y) * .3;
  let da = ((player.angle - position.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  position.angle += da * .25;
  const mine = player.id === me.id, x = position.x * T, y = position.y * T;
  ctx.save(); ctx.translate(x, y);
  if (player.life === 'disabled') {
    ctx.save(); ctx.rotate(.55); ctx.scale(1.15, .65); ctx.globalAlpha = .6; drawRobot(ctx, position.turret, 0, 0, 0, false); ctx.restore();
    ctx.strokeStyle = '#f2a078'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke(); ctx.restore(); return;
  }
  if (player.shield > 0) { ctx.strokeStyle = '#9ceada'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = mine ? '#f9d490' : '#bfdad7'; ctx.lineWidth = 1.5 / camera.zoom; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
  const speed = loadout(player.body).turnSpeed;
  const projected = turnTurret(player.turret ?? player.angle, player.aim ?? player.angle, connected ? Math.min((now - stateReceived) / 1000, .1) : 0, speed);
  position.turret = turnTurret(position.turret, projected, dt, speed);
  if (player.body === 'robot') {
    drawRobot(ctx, position.turret, player.vx || 0, player.vy || 0, position.phase, mine);
  } else {
    ctx.save(); ctx.rotate(position.angle); ctx.globalAlpha = .18; ctx.fillStyle = '#0e2b2a'; ctx.fillRect(-7, -10, 20, 31); ctx.globalAlpha = 1;
    ctx.drawImage(images[mine ? 'tankBody_sand.png' : 'tankBody_dark.png'], -14, -17, 28, 34);
    ctx.rotate(position.turret - position.angle);
    ctx.drawImage(images[mine ? 'tankSand_barrel1.png' : 'tankDark_barrel1.png'], -5, -25 + effects.recoil(player.id, now), 10, 27);
    ctx.fillStyle = '#354238'; ctx.fillRect(8, -27 + effects.recoil(player.id, now, 'APCR'), 4, 20); ctx.restore();
  }
  ctx.font = `${10 / camera.zoom}px monospace`; ctx.textAlign = 'center';
  const label = mine ? 'YOU' : player.name.toUpperCase(), labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = '#243b31cf'; roundRect(ctx, -labelWidth / 2 - 5 / camera.zoom, 26, labelWidth + 10 / camera.zoom, 16 / camera.zoom, 2); ctx.fill();
  ctx.fillStyle = mine ? '#f8d99b' : '#d7e6d7'; ctx.fillText(label, 0, 26 + 11 / camera.zoom); ctx.restore();
}
function drawMinimap() {
  if (!world) return;
  const sx = mini.width / world.width, sy = mini.height / world.height;
  mctx.drawImage(terrainCanvas, 0, 0, mini.width, mini.height);
  drawConquestMap(mctx, world.sites || [], sx, sy);
  for (const b of buildings) { mctx.fillStyle = '#273c31'; mctx.fillRect(b.x * sx, b.y * sy, sx, sy); }
  for (const ship of world.ships || []) { mctx.fillStyle = '#a7e4df'; mctx.fillRect(ship.x*sx-2,ship.y*sy-2,4,4); mctx.strokeStyle = '#e7c58c'; mctx.strokeRect(ship.dock.x*sx-2,ship.dock.y*sy-2,4,4); }
  for (const e of combat.enemies) { mctx.fillStyle = '#f28e63'; mctx.fillRect(e.x * sx - 2, e.y * sy - 2, 4, 4); }
  mctx.strokeStyle = '#f4edd099'; mctx.lineWidth = 1;
  mctx.strokeRect((camera.x - width / 2 / camera.zoom) / T * sx, (camera.y - height / 2 / camera.zoom) / T * sy, width / camera.zoom / T * sx, height / camera.zoom / T * sy);
  if (!inOrbit()) { mctx.fillStyle = '#f4aa66'; mctx.beginPath(); mctx.arc(me.x * sx, me.y * sy, 3.2, 0, Math.PI * 2); mctx.fill(); }
  drawContaminationMap(mctx, world.sites || [], sx, sy, combat.time || 0);
}
function drawCombat() {
  const clock = roomState?.paused ? stateReceived : performance.now(), elapsed = Math.min((clock - stateReceived) / 1000, .1);
  if (combat.objective?.id && combat.objective.id !== 'landing') {
    const point = combat.objective; ctx.save(); ctx.strokeStyle = '#efcf84'; ctx.lineWidth = 2 / camera.zoom; ctx.setLineDash([8 / camera.zoom, 5 / camera.zoom]);
    ctx.beginPath(); ctx.arc(point.x * T, point.y * T, 1.5 * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `${11 / camera.zoom}px monospace`; ctx.textAlign = 'center'; ctx.fillStyle = '#f4dba1'; ctx.fillText(point.label, point.x * T, point.y * T - 1.7 * T); ctx.restore();
  }
  if (!alive()) {
    const core = world.cores.find(c => c.id === $('recovery-core').value);
    if (core) { ctx.save(); ctx.strokeStyle = '#bfe9ce'; ctx.fillStyle = '#96ddb512'; ctx.lineWidth = 2 / camera.zoom; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc((core.x + 1.5) * T, (core.y + 1.5) * T, SURVIVAL.radius * T, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  for (const e of combat.enemies) {
    drawAttack(ctx, e, combat.time + elapsed * 1000, T);
    let position = monsterPositions.get(e.id);
    if (!position) { position = { x: e.x, y: e.y }; monsterPositions.set(e.id, position); }
    position.x += (e.x - position.x) * .3; position.y += (e.y - position.y) * .3;
    if(e.kind==='swimmer')drawSwimmer(ctx,{...e,x:position.x,y:position.y},clock/1000,T,effects.reduced,effects.hit(e.id,clock));
    else {
      const emerging = Math.max(0, Math.min(1, ((combat.time + elapsed * 1000) - (e.emergedAt ?? -10000)) / 650));
      ctx.save();
      if (emerging < 1 && !effects.reduced) {
        ctx.translate(position.x * T, position.y * T); ctx.scale(.5 + emerging * .5, .5 + emerging * .5); ctx.translate(-position.x * T, -position.y * T);
        ctx.globalAlpha = .4 + emerging * .6;
      }
      drawCrawler(ctx, { ...e, x: position.x * T, y: position.y * T }, clock / 1000, effects.hit(e.id, clock)); ctx.restore();
    }
    if (camera.zoom < .3) { ctx.fillStyle = '#ff6d52'; ctx.beginPath(); ctx.arc(e.x * T, e.y * T, 2.5 / camera.zoom, 0, Math.PI * 2); ctx.fill(); }
    if (e.hp < 60) {
      ctx.fillStyle = '#352e29'; ctx.fillRect(position.x * T - 16, position.y * T - 39, 32, 3);
      ctx.fillStyle = '#f2a776'; ctx.fillRect(position.x * T - 16, position.y * T - 39, 32 * e.hp / 60, 3);
    }
  }
  for (const id of monsterPositions.keys()) if (!combat.enemies.some(e => e.id === id)) monsterPositions.delete(id);
  for (const s of combat.shells) {
    const bullet = s.weapon !== 'HE', travel = Math.min(s.remaining, elapsed * (s.speed || 12)), x = (s.x + s.dx * travel) * T, y = (s.y + s.dy * travel) * T;
    ctx.strokeStyle = bullet ? '#e7c77f' : '#f8d491'; ctx.lineWidth = bullet ? 1.4 : 3; ctx.beginPath(); ctx.moveTo(x - s.dx * (bullet ? 12 : 16), y - s.dy * (bullet ? 12 : 16)); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff7d2'; ctx.beginPath(); ctx.arc(x, y, bullet ? 1.3 : 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const charge of combat.charges || []) {
    const progress = 1 - charge.remaining / charge.duration; ctx.save(); ctx.translate(charge.x * T, charge.y * T); ctx.rotate(charge.angle);
    ctx.fillStyle = '#88e8ff'; ctx.globalAlpha = .3 + progress * .65; ctx.beginPath(); ctx.arc(0, -29, 4 + progress * 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  drawFuel(ctx, combat, world, buildings, T, elapsed, effects.reduced);
  effects.draw(ctx, clock);
  drawSalvos(ctx, combat.salvos, T, elapsed, effects.reduced);
  drawBarrages(ctx, combat.barrages, T, elapsed, effects.reduced, camera.zoom);
  if (!controlledGun() && !me.aircraftId && !me.shipId && alive() && mode !== 'build' && aim) {
    const x = aim.x * T, y = aim.y * T;
    const equipment = loadout(me.body, me.tankWeapon, me.tankSecondary), weapon = WEAPONS[heldGun.size ? equipment.secondary : equipment.primary];
    ctx.strokeStyle = '#ffe1a2'; ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath(); ctx.arc(x, y, 13 / camera.zoom, 0, Math.PI * 2); ctx.moveTo(x - 20 / camera.zoom, y); ctx.lineTo(x + 20 / camera.zoom, y); ctx.moveTo(x, y - 20 / camera.zoom); ctx.lineTo(x, y + 20 / camera.zoom); ctx.stroke();
    const position = positions.get(me.id);
    if (position) {
      const range = weapon.radius ? Math.min(weapon.range, Math.hypot(aim.x - me.x, aim.y - me.y)) : weapon.range;
      const dx = Math.sin(position.turret), dy = -Math.cos(position.turret);
      const end = !weapon.radius ? raycast(world, buildings, position, dx, dy, range, combat.enemies) : { x: position.x + dx * range, y: position.y + dy * range };
      const tx = end.x * T, ty = end.y * T, r = 7 / camera.zoom;
      ctx.strokeStyle = '#bceaf1';
      // The ring previews unobstructed HE detonation, not a collision prediction.
      ctx.globalAlpha = .28; ctx.setLineDash([4 / camera.zoom, 6 / camera.zoom]);
      if (weapon.radius) { ctx.beginPath(); ctx.arc(tx, ty, weapon.radius * T, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty - r); ctx.lineTo(tx + r, ty); ctx.lineTo(tx, ty + r); ctx.lineTo(tx - r, ty); ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = .65; ctx.beginPath(); ctx.moveTo(position.x * T + dx * 35, position.y * T + dy * 35); ctx.lineTo(position.x * T + dx * 60, position.y * T + dy * 60); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
}
function drawHeavyAim() {
  const elapsed = connected && !roomState?.paused ? Math.min((performance.now() - stateReceived) / 1000, .1) : 0;
  if (isMissile(controlledGun()) && (aim || controlledGun().target)) drawTargetBox(ctx, missileAim(controlledGun(), world, aim || controlledGun().target, controlledGun().rotated), controlledGun().rotated, T, camera.zoom, !missileTargetError(controlledGun(), world, aim || controlledGun().target, controlledGun().rotated), controlledGun().ammo);
  if (controlledGun() && !isMissile(controlledGun())) {
    const gun = controlledGun(), p = gunPosition(gun, elapsed), target = artillerySolution(gun), cross = 9 / camera.zoom;
    const desired = aim || gun.target || target, desiredState = artilleryAim(gun, desired);
    ctx.save(); ctx.strokeStyle = desiredState.inRange ? '#f2d39a' : '#ed9178'; ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath(); ctx.moveTo(desired.x * T - cross, desired.y * T); ctx.lineTo(desired.x * T + cross, desired.y * T); ctx.moveTo(desired.x * T, desired.y * T - cross); ctx.lineTo(desired.x * T, desired.y * T + cross); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = artilleryFireError(gun, world) ? '#efb17d' : '#b9e8f2'; ctx.lineWidth = 1.5 / camera.zoom;
    ctx.setLineDash([6 / camera.zoom, 6 / camera.zoom]); ctx.beginPath(); ctx.arc(target.x * T, target.y * T, ARTILLERY_SHELLS[gun.ammo || 'HE'].radius * T, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(target.x * T, target.y * T - cross); ctx.lineTo(target.x * T + cross, target.y * T); ctx.lineTo(target.x * T, target.y * T + cross); ctx.lineTo(target.x * T - cross, target.y * T); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = .4; ctx.beginPath(); ctx.moveTo(p.x * T, p.y * T); ctx.lineTo(target.x * T, target.y * T); ctx.stroke(); ctx.restore();
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max(0, (now - lastFrame) / 1000), .1); lastFrame = now;
  if (!world || document.hidden) return;
  effects.prune(now);
  const primary = loadout(me.body, me.tankWeapon).primary, charging = combat.charges?.find(c => c.owner === me.id);
  $('tank-charge').textContent = charging ? 'CHARGING ' + Math.ceil((1 - charging.remaining / charging.duration) * 100) + '%' : primary === 'MAGNETIC' && now < nextFire.MAGNETIC ? 'MAGNETIC / RELOADING' : 'READY';
  const readiness = primary + (now < nextFire[primary] ? ' / RELOADING' : ' / READY');
  if ($('ammo-status').textContent !== readiness) $('ammo-status').textContent = readiness;
  if (following) { camera.x += ((me.x+(currentAircraft()?Math.sin(me.angle)*5:0)) * T - camera.x) * .08; camera.y += ((me.y-(currentAircraft()?Math.cos(me.angle)*5:0)) * T - camera.y) * .08; }
  const focusedShip = world.ships?.find(s => s.id === deploymentFocus);
  const focusedTank = world.tanks?.find(t => t.id === deploymentFocus);
  const focusedCore = world.cores?.find(c => c.id === deploymentFocus) || (focusedShip && {...focusedShip, x:focusedShip.berthX-1.5, y:focusedShip.berthY-1.5}) || (focusedTank && { ...focusedTank, x: focusedTank.podX - 1, y: focusedTank.podY - 1 });
  if (focusedCore) {
    const targetZoom = Math.min(1, (width - 30) / (11 * T), (height - 180) / (11 * T));
    camera.x += ((focusedCore.x + 1.5) * T - camera.x) * .1; camera.y += ((focusedCore.y + 1.5) * T - camera.y) * .1;
    camera.zoom += (targetZoom - camera.zoom) * .06; following = false;
    if (focusedCore.elapsed >= CORE.duration) { deploymentFocus = null; notify(focusedShip ? 'Ship ready. Approach its shoreline dock and press E or Board ship.' : focusedTank ? 'Tank ready. Approach it and press E or Board tank. Drop site and vehicle saved.' : 'Core online. Robot deployed. Your base is saved.'); }
  }
  const myCore = world.cores?.find(c => c.owner === me.id && c.elapsed < CORE.duration) || world.tanks?.find(t => t.owner === me.id && t.elapsed < TANK.duration) || world.ships?.find(s => s.owner === me.id && s.elapsed < SHIP.duration);
  const deploymentText = myCore ? myCore.elapsed < CORE.impact ? 'ORBITAL DESCENT' : myCore.elapsed < CORE.unfold ? 'GROUND CONTACT' : myCore.elapsed < CORE.exit ? 'PANELS UNFOLDING' : myCore.berthX !== undefined ? 'SHIP RELEASED' : myCore.podX !== undefined ? 'TANK ROLLING OUT' : 'ROBOT DEPLOYING' : mode === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind) ? 'ORBITAL SURVEY · SELECT LANDING SITE' : '';
  $('core-status').hidden = !deploymentText; if ($('core-status').textContent !== deploymentText) $('core-status').textContent = deploymentText;
  if (mouseAim && mode !== 'build') aim = toWorld(mouseAim.x, mouseAim.y);
  if (me.shipId && now-lastShipUi > 100) { updateShips(); lastShipUi=now; }
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#284e52'; ctx.fillRect(0, 0, width, height);
  const shake = effects.offset(now, camera, camera.zoom);
  for (const core of world.cores || []) { const offset = coreEffects.shake(core, coreEffects.time(core, stateReceived, now, connected), camera, effects.reduced, effects.shakeEnabled); shake.x += offset.x; shake.y += offset.y; }
  for (const tank of world.tanks || []) { const pod = { ...tank, x: tank.podX, y: tank.podY }; const offset = tankEffects.shake(pod, tankEffects.time(pod, stateReceived, now, connected), camera, effects.reduced, effects.shakeEnabled); shake.x += offset.x; shake.y += offset.y; }
  ctx.save(); ctx.translate(width / 2 + shake.x, height / 2 + shake.y); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
  drawTerrain();
  drawConvertedGround(ctx, world, T, (combat.time || 0) + (roomState?.paused || !connected ? 0 : Math.min(150, Math.max(0, now - stateReceived))), effects.reduced);
  if (mode === 'build' && ['missile', 'tank', 'airbase'].includes(deploymentKind) && oceanRestrictionCanvas) {
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(oceanRestrictionCanvas, 0, 0, world.width * T, world.height * T); ctx.restore();
  }
  effects.drawGround(ctx, now, 'crater');
  drawHazards(ctx, combat.fields, T, combat.time + (connected ? Math.min(now - stateReceived, 100) : 0), effects.reduced, camera.zoom);
  effects.drawGround(ctx, now, 'remains');
  for (const core of world.cores || []) coreEffects.draw(ctx, core, coreEffects.time(core, stateReceived, now, connected), effects.reduced);
  for (const tank of world.tanks || []) { const pod = { ...tank, x: tank.podX, y: tank.podY }; tankEffects.draw(ctx, pod, tankEffects.time(pod, stateReceived, now, connected), effects.reduced); }
  for (const ship of world.ships || []) { shipEffects.dock(ctx, ship, camera.zoom); if(!ship.destroyed)shipEffects.ramp(ctx,ship,ship.ramp|| (ship.id===me.shipId?rampPreview:null),camera.zoom,!ship.ramp); shipEffects.drawPod(ctx, ship, shipEffects.time(ship, stateReceived, now, connected), effects.reduced); }
  for(const base of world.airbases)drawAirbase(ctx,base,T,camera.zoom);
  drawConquest(ctx, world.sites || [], T, camera.zoom, (combat.time || 0) + (roomState?.paused || !connected ? 0 : Math.min(150, Math.max(0, now - stateReceived))), effects.reduced, world, buildings, { orbital: inOrbit(), inspectedId: following ? null : selectedSiteId });
  drawLogistics(ctx,world,buildings,T,camera.zoom,effects.reduced);
  drawAcid(ctx, combat, T, camera.zoom, (combat.time || 0) + (roomState?.paused || !connected ? 0 : Math.min(150, Math.max(0, now - stateReceived))), effects.reduced);
  for (const rail of world.rails) drawRail(ctx, rail, T);
  for (const state of world.switches || []) { const rail = world.rails.find(r => r.x === state.x && r.y === state.y); if (rail) drawSwitch(ctx, rail, state, switchLocked(world, rail), T, camera.zoom); }
  if (mapGrid || mode === 'build') {
    ctx.strokeStyle = '#172f2926'; ctx.lineWidth = 1 / camera.zoom; ctx.beginPath();
    for (let x = 0; x <= world.width; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, world.height * T); }
    for (let y = 0; y <= world.height; y++) { ctx.moveTo(0, y * T); ctx.lineTo(world.width * T, y * T); } ctx.stroke();
  }
  if (mode === 'build' && needsConstruction(deploymentKind)) {
    ctx.save(); ctx.strokeStyle = '#8bd9ef'; ctx.lineWidth = 2 / camera.zoom; ctx.setLineDash([10 / camera.zoom, 6 / camera.zoom]);
    for (const core of constructionCores(world)) {
      ctx.beginPath(); ctx.arc((core.x + 1.5) * T, (core.y + 1.5) * T, CONSTRUCTION.radius * T, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (path.length) {
    while (path.length && Math.hypot(path[0].x - me.x, path[0].y - me.y) < .3) path.shift();
    ctx.strokeStyle = '#f2d8a69c'; ctx.lineWidth = 2 / camera.zoom; ctx.setLineDash([3 / camera.zoom, 7 / camera.zoom]); ctx.beginPath(); ctx.moveTo(me.x * T, me.y * T);
    for (const point of path) ctx.lineTo(point.x * T, point.y * T); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const id of sentryPositions.keys()) if (!buildings.some(b => b.id === id)) sentryPositions.delete(id);
  for (const b of buildings) drawBuilding(b, false, dt, now);
  for (const gun of world.artillery) { if (isMissile(gun)) drawBattery(ctx, gun, T, gun.id === controlledGun()?.id); else drawRailGun(ctx, gun, T, connected ? Math.min((now - stateReceived) / 1000, .1) : 0, effects.recoil(gun.id, now, gun.ammo || 'HE'), gun.id === controlledGun()?.id); }
  const target = mode === 'build' && hover && $('site-panel').hidden ? hover : selected;
  const coreMode = mode === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind);
  const error = mode === 'build' ? deploymentError(target.x, target.y) : placementError(world, buildings, groundPlayers(), target.x, target.y);
  ctx.fillStyle = mode === 'build' ? error ? '#d284642c' : '#eddfa03d' : '#e8d8a518';
  ctx.strokeStyle = mode === 'build' && error ? '#ef9c76' : '#efdbad'; ctx.lineWidth = 1.5 / camera.zoom;
  if(coreMode&&deploymentKind==='airbase')drawAirbase(ctx,target,T,camera.zoom,true,!error);
  else if (coreMode && deploymentKind === 'ship') {
    const site = shipSite(world, buildings, [...groundPlayers(), ...combat.enemies], target.x, target.y, me.id,deploymentShipKind,'unfolding');
    shipEffects.preview(ctx, { ...site, error }, target.x, target.y, camera.zoom);
  }
  else if (coreMode) (deploymentKind === 'tank' ? tankEffects : coreEffects).preview(ctx, target.x, target.y, !error, camera.zoom);
  else { ctx.fillRect(target.x * T, target.y * T, T, T); ctx.strokeRect(target.x * T + 1, target.y * T + 1, T - 2, T - 2); }
  if(mode==='build'&&LOGISTICS_SIZE[deploymentKind]){const size=LOGISTICS_SIZE[deploymentKind];ctx.fillRect(target.x*T,target.y*T,size*T,size*T);ctx.strokeRect(target.x*T,target.y*T,size*T,size*T);}
  if (mode === 'build' && deploymentKind === 'rail') for (const rail of railSegment(target.x, target.y, $('rail-shape').value, Number($('rail-length').value))) {
    drawRail(ctx, { ...rail, shape: joinedShape(world.rails.find(r => r.x === rail.x && r.y === rail.y), rail.shape) || rail.shape }, T, true);
    if (isCurve(rail)) { const b = curveBounds(rail); ctx.fillRect(b.minX * T, b.minY * T, (b.maxX - b.minX + 1) * T, (b.maxY - b.minY + 1) * T); ctx.strokeRect(b.minX * T, b.minY * T, (b.maxX - b.minX + 1) * T, (b.maxY - b.minY + 1) * T); }
  }
  if (mode === 'build' && deploymentKind === 'artillery') ctx.strokeRect((target.x - 1) * T, (target.y - 1) * T, 3 * T, 3 * T);
  if (mode === 'build' && deploymentKind === 'missile') drawBattery(ctx, { ...target, reload: 0 }, T, true, true, !error);
  if (mode === 'build' && deploymentKind === 'sentry' && !error) drawBuilding(target, true);
  const visible = players.some(p => p.id === me.id) ? players : [...players, me];
  for (const tank of world.tanks || []) if (!tank.destroyed && tank.elapsed >= TANK.exit && !players.some(p => p.vehicleId === tank.id)) {
    const point = tank.elapsed < TANK.duration ? tankArrivalPosition(tank, tankEffects.time(tank, stateReceived, now, connected)) : tank;
    drawScout({ ...tank, ...point, id: tank.id, body: 'rover', name: tank.occupant ? 'Occupied tank' : 'Tank', life: 'active', aim: tank.turret }, dt, now);
  }
  for (const ship of world.ships || []) if (!ship.destroyed && ship.elapsed >= SHIP.exit) {
    const old = shipPositions.get(ship.id) || {...ship}, blend = Math.min(1,dt*16);
    const pose = {...ship,x:old.x+(ship.x-old.x)*blend,y:old.y+(ship.y-old.y)*blend,angle:old.angle+angleDelta(old.angle,ship.angle)*blend,turret:old.turret+angleDelta(old.turret,ship.turret)*blend};
    shipPositions.set(ship.id,pose); drawShip(ctx,pose,T,ship.id===me.shipId,camera.zoom,now,effects.reduced,(id,ammo)=>effects.recoil(id,now,ammo));
  }
  for (const p of visible) drawScout(p, dt, now);
  for(const v of [...world.tanks,...world.ships]) if(v.elapsed>=TANK.exit)drawVehicleState(ctx,v,T,camera.zoom,now,effects.reduced);
  drawCombat();
  for(const base of world.airbases)drawAircraft(ctx,base.aircraft,T,camera.zoom,base.aircraft.id===me.aircraftId,connected?(now-stateReceived)/1000:0,effects.reduced);
  drawBombRuns(ctx,combat.barrages||[],T,connected?Math.min((now-stateReceived)/1000,.1):0,camera.zoom);
  drawFlak(ctx, world.sites || [], combat.flakShells || [], combat.time, T, camera.zoom, effects.reduced);
  drawLaserBeams(ctx, world.sites || [], T, camera.zoom, world, buildings, laserBeamRay);
  drawContamination(ctx, world.sites || [], T, combat.time || 0, effects.reduced);
  drawHeavyAim();
  if (currentShip() && aim && mode !== 'build') drawShipAim(currentShip());
  if (currentAircraft()) drawBombPrediction(ctx,world,currentAircraft(),currentAirbase(),T,camera.zoom, p => concealed(world.sites, p, combat.time));
  for (const id of positions.keys()) if (!visible.some(p => p.id === id)) positions.delete(id);
  ctx.restore();
  if (coreMode) {
    // A thin survey cloud band preserves the legibility of placement tiles.
    const drift = effects.reduced ? 0 : Math.sin(now / 15000) * width * .1;
    const cloud = ctx.createLinearGradient(0, 100, 0, height * .65); cloud.addColorStop(0, '#d6e4d000'); cloud.addColorStop(.4, '#d6e4d018'); cloud.addColorStop(.6, '#d6e4d028'); cloud.addColorStop(1, '#d6e4d000');
    ctx.fillStyle = cloud; ctx.fillRect(drift - width * .2, 100, width * 1.4, height * .55);
  }
  // Survey instruments: graticule and scale bar, then cursor telemetry from you (or your facility).
  if (width > 760 || inOrbit() || overviewReturn || orbitalView) {
    drawGraticule(ctx, { camera, width, height, T, world, top: width > 760 ? 92 : 80, left: width > 760 ? 10 : 6 });
    if (width > 760) drawScaleBar(ctx, { camera, T, x: 22, y: height - 50 });
  }
  const gun = controlledGun(), cursor = hover ? { x: hover.x + .5, y: hover.y + .5 } : aim && mode !== 'build' ? aim : null;
  const readout = telemetry(cursor || me, cursor && !inOrbit() ? (gun ? gunPosition(gun) : me) : null);
  if ($('coordinates').textContent !== readout) $('coordinates').textContent = readout;
  const zoomText = Math.round(camera.zoom * 100) + '%'; // camera animations change zoom too
  if ($('zoom-label').textContent !== zoomText) $('zoom-label').textContent = zoomText;
  if (now - lastMini > 250) { drawMinimap(); lastMini = now; }
}

$('explore-mode').onclick = () => { releaseArtillery(); setMode('explore'); };
function updateSwitches() {
  if (!world) return;
  const select = $('switch-select'), list = world.switches || [], chosen = select.value;
  const signature = list.map(s => s.x + ':' + s.y).join(',');
  if (select.dataset.items !== signature) { select.replaceChildren(...list.map(s => Object.assign(document.createElement('option'), { value: s.x + ':' + s.y, textContent: 'Junction ' + s.x + ':' + s.y }))); select.dataset.items = signature; if (list.some(s => s.x + ':' + s.y === chosen)) select.value = chosen; }
  const state = list.find(s => s.x + ':' + s.y === select.value), rail = state && world.rails.find(r => r.x === state.x && r.y === state.y);
  const locked = rail && switchLocked(world, rail), next = state?.route === 'curve' ? 'straight' : 'curve';
  const error = rail ? switchConnectionError(world, rail, next) : null;
  $('switch-status').textContent = !state ? 'No junctions yet. Lay and connect a curve, inspect its center tile, then install its switch.' : (locked ? 'LOCKED / Cannon in turning apron. ' : '') + 'Selected route: ' + state.route.toUpperCase() + (error ? '. ' + error : '');
  $('switch-route').textContent = 'Select ' + (next === 'curve' ? 'curved route' : 'straight route');
  $('switch-route').disabled = !state || !connected || !alive() || locked || !!error;
  $('switch-inspect').disabled = !state; select.disabled = !list.length;
}
function openSwitches() { keys.clear(); stopFiring(); $('switch-panel').hidden = false; updateSwitches(); }
$('switches-open').onclick = () => { toggleTray(false); openSwitches(); };
$('facility-switches').onclick = openSwitches;
$('switch-close').onclick = () => { $('switch-panel').hidden = true; canvas.focus({ preventScroll: true }); };
$('switch-select').onchange = updateSwitches;
$('switch-inspect').onclick = () => { const [x, y] = $('switch-select').value.split(':').map(Number); camera.x = (x + .5) * T; camera.y = (y + .5) * T; camera.zoom = width > 760 ? .75 : .5; following = false; mouseAim = null; $('zoom-label').textContent = Math.round(camera.zoom * 100) + '%'; };
$('switch-route').onclick = async () => { const [x, y] = $('switch-select').value.split(':').map(Number), state = switchAt(world, { x, y }); if (!state) return; try { await api('rails/switch', { x, y, route: state.route === 'curve' ? 'straight' : 'curve' }); } catch (e) { notify(e.message); } updateSwitches(); };
$('enable-switch').onclick = async () => { try { await api('rails/switch', { ...selected, route: 'curve' }); notify('Junction installed. Select its route before a cannon enters.'); openSwitches(); } catch (e) { notify(e.message); } };
$('rail-card').onclick = () => { deploymentKind = 'rail'; setMode('build'); toggleSite(true); };
$('artillery-card').onclick = () => { deploymentKind = 'artillery'; setMode('build'); toggleSite(true); };
$('construction-method').onchange=()=>updateSelection();
$('missile-card').onclick = () => { deploymentKind = 'missile'; setMode('build'); toggleSite(true); };
$('missile-rotate').onclick = () => { const gun = controlledGun(); if (isMissile(gun)) void gunAction('rotate', { rotated: !gun.rotated }); };
$('rail-shape').onchange = $('rail-length').onchange = updateSelection;
$('remove-rail').onclick = async () => { try { await api('rails/remove', selected); notify('Rail tile removed.'); } catch (error) { notify(error.message); } };
$('artillery-open').onclick = () => { setMode('explore'); $('artillery-panel').hidden = false; updateArtillery(); };
$('artillery-close').onclick = () => { releaseArtillery(); $('artillery-panel').hidden = true; };
$('artillery-select').onchange = () => { selectedGunId = $('artillery-select').value; updateArtillery(); };
$('artillery-control-button').onclick = () => gunAction('control', { release: !!controlledGun() });
$('artillery-fire').onclick = heavyFire;
$('facility-exit').onclick = releaseArtillery;
for (const button of document.querySelectorAll('[data-shell]')) button.onclick = () => { void gunAction('ammo', { ammo: button.dataset.shell }); canvas.focus({ preventScroll: true }); };
$('recovery-core').onchange = () => { recoveryError = ''; inspectRecoveryCore(); updateSurvival(); };
$('revive-button').onclick = async () => {
  if (recoveryPending || $('revive-button').disabled) return;
  recoveryPending = true; recoveryError = ''; updateSurvival();
  try { await api('revive', { coreId: $('recovery-core').value }); }
  catch (error) { notify(error.message); }
  finally { recoveryPending = false; updateSurvival(); }
};
$('fire-button').onclick = event => { if (me?.body !== 'robot' || event.detail === 0) fire('HE'); };
try {
  const preference = localStorage.getItem('frontier-effects');
  if (preference !== null) effects.reduced = preference === 'reduced';
  effects.shakeEnabled = localStorage.getItem('frontier-shake') !== 'off';
} catch { /* Private browsing may deny storage; session controls still work. */ }
$('reduced-effects').checked = effects.reduced;
$('screen-shake').checked = effects.shakeEnabled;
$('reduced-effects').onchange = event => { effects.reduced = event.target.checked; try { localStorage.setItem('frontier-effects', effects.reduced ? 'reduced' : 'full'); } catch {} };
$('screen-shake').onchange = event => { effects.shakeEnabled = event.target.checked; try { localStorage.setItem('frontier-shake', effects.shakeEnabled ? 'on' : 'off'); } catch {} };
$('start-drill').onclick = async () => {
  if (!connected) return;
  try {
    const frontId = $('drill-front').value;
    await api('drill', { frontId });
    const front = world.fronts?.find(f => f.id === frontId);
    if (front && frontId !== 'landing') {
      if (controlledGun()) setOrbitalView(true);
      else { camera.x = front.x * T; camera.y = front.y * T; camera.zoom = .65; following = false; }
    }
    notify(`Crawlers approaching ${front?.label || 'the drill beacon'} from the north.`);
  }
  catch (error) { notify(error.message); }
};
$('build-mode').onclick = () => toggleTray($('deployment-tray').hidden);
$('tank-secondary').onchange = async () => { stopFiring(); try { await api('tank-weapon', { slot: 'secondary', weapon: $('tank-secondary').value }); } catch (e) { notify(e.message); } };
function nearbyTank() {
  return world?.tanks?.filter(t => !t.destroyed && t.elapsed >= TANK.duration && Math.hypot(t.x-me.x,t.y-me.y) <= TANK.boardRange).sort((a,b) => Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y))[0];
}
function updateTankControl() {
  const near = nearbyTank(), button = $('tank-interact');
  button.hidden = !alive() || !!controlledGun() || mode === 'build' || (!me.vehicleId && (me.body !== 'robot' || !near));
  button.textContent = me.vehicleId ? 'Exit tank / E' : near?.occupant ? 'Tank occupied' : 'Board tank / E';
  button.disabled = !connected || (!me.vehicleId && !!near?.occupant);
  $('tank-card').disabled = !!me.vehicleId || me.body !== 'robot' || !connected || world.tanks.some(t => t.owner === me.id);
  $('tank-find').disabled = !world.tanks.some(t => t.owner === me.id);
  $('build-mode').disabled ||= !!me.vehicleId;
}
async function tankInteract() {
  keys.clear(); stopFiring();
  try { await api(me.vehicleId ? 'tanks/exit' : 'tanks/board', { id: nearbyTank()?.id }); setMode('explore'); recenter(); canvas.focus({preventScroll:true}); }
  catch (e) { notify(e.message); }
}
$('tank-interact').onclick = tankInteract;
$('tank-find').onclick = () => { const tank = world.tanks.find(t => t.owner === me.id); if (!tank) return; toggleTray(false); camera = {x:tank.x*T,y:tank.y*T,zoom:width<760?.7:.9}; following=false; };
$('tank-primary').onchange = async () => { stopFiring(); try { await api('tank-weapon', { weapon: $('tank-primary').value }); } catch (e) { notify(e.message); } };
$('sentry-weapon').onchange = async () => { const b = buildings.find(b => b.x === selected.x && b.y === selected.y); if (!b) return; try { await api('sentry-mode', { id: b.id, weapon: $('sentry-weapon').value }); } catch (e) { notify(e.message); } };
$('sentry-card').onclick = () => { deploymentKind = 'sentry'; setMode('build'); canvas.focus({ preventScroll: true }); };
$('core-card').onclick = () => beginCoreSurvey();
$('tank-card').onclick = () => beginCoreSurvey('tank');
$('airbase-card').onclick=()=>requestAircraft('bomber');$('attack-jet-card').onclick=()=>requestAircraft('attack-jet');
$('airbase-find').onclick=locateAirbase;$('aircraft-home').onclick=locateAirbase;
$('aircraft-bomb').onclick=event=>{if(!isAttackJet(currentAircraft())||event.detail===0)void aircraftAction('bomb');};
$('aircraft-bomb').addEventListener('pointerdown',event=>{if(!isAttackJet(currentAircraft())||!combatInputAllowed())return;event.preventDefault();$('aircraft-bomb').setPointerCapture(event.pointerId);heldPrimary.add('air:'+event.pointerId);void aircraftAction('bomb');});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('aircraft-bomb').addEventListener(name,event=>heldPrimary.delete('air:'+event.pointerId));$('aircraft-launch').onclick=()=>aircraftAction('launch');
$('aircraft-interact').onclick=()=>aircraftAction(currentAircraft()?'exit':'board');
$('ship-card').onclick = () => {deploymentShipKind='gunship';beginCoreSurvey('ship');};
$('submarine-card').onclick=()=>{deploymentShipKind='submarine';beginCoreSurvey('ship');};
$('navy-vessel').onchange=()=>updateShips();
$('submarine-dive').onclick=()=>shipDepth('dive');
$('submarine-surface').onclick=()=>shipDepth('surface');
$('submarine-rotate').onclick=()=>{subRotated=!subRotated;updateShips();};
$('ship-interact').onclick = shipInteract;
$('ship-contact').onclick = async()=>{try{await api('ships/contact',{});}catch(e){notify(e.message);}};
$('tank-replace').onclick=()=>replaceVehicle('tank');$('ship-replace').onclick=()=>replaceVehicle('ship');
$('ship-fire').onclick = shipFire;
const sideButton=$('ship-secondary');
sideButton.addEventListener('pointerdown',e=>{e.preventDefault();if(!combatInputAllowed())return;sideButton.setPointerCapture(e.pointerId);heldGun.add('side:'+e.pointerId);void shipSecondary();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])sideButton.addEventListener(event,e=>heldGun.delete('side:'+e.pointerId));
sideButton.addEventListener('click',e=>{if(e.detail===0)void shipSecondary();});
$('ship-ramp').onclick=shipRamp;
$('ship-home').onclick = () => findShip(true);
$('ship-find').onclick = () => findShip();
$('ship-dock-find').onclick = () => findShip(true);
$('ship-recall').onclick = async () => {
  const vessel=selectedVessel();if(!vessel||$('ship-recall').disabled)return;
  if(!window.confirm('Recall '+shipName(vessel)+' and its dock? Both will be removed from this save. You can then deploy a new ship with the unfolding dock.'))return;
  shipBusy=true;updateShips();
  try{await api('ships/recall',{id:vessel.id});world.ships=world.ships.filter(s=>s.id!==vessel.id);notify('Ship and dock recalled. The site is clear for a new deployment.');}
  catch(e){notify(e.message);}finally{shipBusy=false;updateShips();}
};
for (const button of document.querySelectorAll('[data-ship-shell]')) button.onclick = () => shipAmmo(button.dataset.shipShell);
for (const button of document.querySelectorAll('[data-force-tab]')) button.onclick = () => setForceTab(button.dataset.forceTab);
// Arrow keys move between tabs (WAI-ARIA tabs) without also moving the robot.
$('force-tabs').addEventListener('keydown', event => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]; if (!step) return;
  event.preventDefault(); event.stopPropagation();
  const index = TABS.findIndex(t => t.id === forceTab);
  setForceTab(TABS[(index + step + TABS.length) % TABS.length].id, true);
});
for (const asset of ASSETS) { const card = $(asset.card); card.addEventListener('pointerenter', () => showSpec(asset.card)); card.addEventListener('focus', () => showSpec(asset.card)); }
for (const kind of ['factory', 'uplink', 'recycler']) $(kind + '-card').onclick = () => deployLogistics(kind);
$('logistics-open').onclick = () => { toggleTray(false); $('supplies-button').click(); };
setForceTab('ground');
$('close-deployment').onclick = () => { toggleTray(false); $('build-mode').focus(); };
$('close-site').onclick = () => { toggleSite(false); canvas.focus({ preventScroll: true }); };
$('site-button').onclick = () => toggleSite($('site-panel').hidden);
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { notify('This browser does not support fullscreen. The game still fills this view.'); }
};
if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
$('place-building').onclick = event => { keepPlacing = event.shiftKey; void place(); };
$('remove-building').onclick = async () => {
  const building = buildings.find(b => b.x === selected.x && b.y === selected.y);
  if (!building || pending) return;
  pending = true; updateSelection();
  try { await api('dismantle', { id: building.id }); buildings = buildings.filter(b => b.id !== building.id); notify('Foundation removed. Change saved.'); }
  catch (error) { notify(error.message); } finally { pending = false; updateSelection(); }
};
$('select-tile').onclick = () => { const x = Number($('tile-x').value), y = Number($('tile-y').value); if (world && Number.isFinite(x) && Number.isFinite(y)) select(x, y, true); };
$('zoom-in').onclick = () => zoom(1.2); $('zoom-out').onclick = () => zoom(1 / 1.2); $('center').onclick = recenter;
$('grid-toggle').onclick = () => { mapGrid = !mapGrid; $('grid-toggle').setAttribute('aria-pressed', String(mapGrid)); };
$('help-button').onclick = () => { stopFiring(); keys.clear(); $('help-dialog').showModal(); if (campaignId) roomRequest('pause', { paused: true }).catch(e => notify(e.message)); };
$('keys-dialog').addEventListener('close', () => { if (campaignId) roomRequest('pause', { paused: false }).catch(e => notify(e.message)); canvas.focus({ preventScroll: true }); });
$('keys-open').onclick = () => { $('help-dialog').close(); openKeys(); };
$('overview-button').onclick = () => toggleOverview();
$('help-dialog').addEventListener('close', () => { if (campaignId) roomRequest('pause', { paused: false }).catch(e => notify(e.message)); });
$('room-button').hidden = !campaignId;
$('campaign-link').hidden = !!campaignId;
$('room-button').onclick = async () => {
  keys.clear(); stopFiring(); $('room-dialog').showModal();
  try { await roomRequest('pause', { paused: true }); } catch (e) { $('room-status').textContent = e.message; }
};
$('room-resume').onclick = () => $('room-dialog').close();
$('room-dialog').addEventListener('close', () => { if (campaignId) roomRequest('pause', { paused: false }).catch(e => notify(e.message)); canvas.focus({ preventScroll: true }); });
$('room-invite').onclick = async () => { try { const invite = await roomRequest('invite'); $('room-code').value = invite.code; $('room-code').select(); } catch (e) { $('room-status').textContent = e.message; } };
$('room-revoke').onclick = async () => { try { await roomRequest('revoke-invites'); $('room-code').value = ''; $('room-status').textContent = 'Unused invitation codes revoked.'; } catch (e) { $('room-status').textContent = e.message; } };
$('room-leave').onclick = async () => { try { await roomRequest('leave'); eventStream?.close(); location.assign('/campaigns/'); } catch (e) { $('room-status').textContent = e.message; } };
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
// Desktop combat uses mouse buttons; middle-drag is the distinct pan gesture.
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('mousedown', event => {
  if (lastPointerKind === 'touch' || event.sourceCapabilities?.firesTouchEvents) return;
  if (!world) return;
  if (event.button === 1) { event.preventDefault(); return; }
  event.preventDefault(); canvas.focus({ preventScroll: true });
  mouseAim = { x: event.clientX, y: event.clientY }; aim = toWorld(event.clientX, event.clientY);
  if (mode === 'build') { if (event.button === 2) setMode('explore'); return; }
  if (controlledGun()) { if (event.button === 0 && $('site-panel').hidden) heavyFire(); return; }
  if(currentAircraft()){if(event.button===0){if(isAttackJet(currentAircraft())&&combatInputAllowed())heldPrimary.add('mouse');void aircraftAction('bomb');}return;}
  if (event.button === 0) {
    const gun = world.artillery.find(g => isMissile(g) ? aim.x >= g.x && aim.x < g.x + 4 && aim.y >= g.y && aim.y < g.y + 4 : Math.abs(g.x + .5 - aim.x) < 1.5 && Math.abs(g.y + .5 - aim.y) < 1.5);
    if (gun) { selectedGunId = gun.id; $('artillery-panel').hidden = false; updateArtillery(); return; }
  }
  if (event.button === 0) { if (me.body === 'robot' && combatInputAllowed()) heldPrimary.add('mouse'); fire('HE'); }
  if (event.button === 2 && combatInputAllowed()) { heldGun.add('mouse'); fire('APCR'); }
});
window.addEventListener('mouseup', event => { if (event.button === 2) heldGun.delete('mouse'); if (event.button === 0) heldPrimary.delete('mouse'); });
canvas.addEventListener('pointerdown', event => {
  lastPointerKind = event.pointerType;
  if (!world || pointer) return;
  if (event.pointerType === 'mouse' && event.button !== 1 && !(mode === 'build' && event.button === 0)) return;
  canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
  stopFiring();
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: camera.x, cy: camera.y, dragged: false, pan: event.pointerType !== 'mouse' || event.button === 1 };
});
canvas.addEventListener('pointermove', event => {
  if (!world) return;
  const tile = toWorld(event.clientX, event.clientY); hover = { x: Math.floor(tile.x), y: Math.floor(tile.y) };
  if (event.pointerType === 'mouse' && mode !== 'build') { mouseAim = { x: event.clientX, y: event.clientY }; aim = tile; }
  if (!pointer || event.pointerId !== pointer.id || !pointer.pan) return;
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  if (Math.hypot(dx, dy) > 5) pointer.dragged = true;
  if (pointer.dragged) {
    camera.x = Math.max(0, Math.min(world.width * T, pointer.cx - dx / camera.zoom));
    camera.y = Math.max(0, Math.min(world.height * T, pointer.cy - dy / camera.zoom));
    following = false; canvas.classList.add('panning');
  }
});
canvas.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const wasDragged = pointer.dragged; pointer = null; canvas.classList.remove('panning');
  if (!wasDragged && world && event.button !== 1) {
    const tile = toWorld(event.clientX, event.clientY); select(tile.x, tile.y);
    if (mode !== 'build') { mouseAim = null; aim = tile; }
    else { hover = null; toggleSite(true); }
    if (mode !== 'build' && !controlledGun() && !currentAircraft()) {
      const gun = world.artillery.find(g => isMissile(g) ? tile.x >= g.x && tile.x < g.x + 4 && tile.y >= g.y && tile.y < g.y + 4 : Math.abs(g.x + .5 - tile.x) < 1.5 && Math.abs(g.y + .5 - tile.y) < 1.5);
      if (gun) { selectedGunId = gun.id; $('artillery-panel').hidden = false; updateArtillery(); }
    }
  }
});
const cancelPointer = () => { pointer = null; canvas.classList.remove('panning'); heldGun.delete('mouse'); heldPrimary.delete('mouse'); };
canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', cancelPointer);
canvas.addEventListener('pointerleave', () => { hover = null; heldGun.delete('mouse'); heldPrimary.delete('mouse'); if (!pointer?.pan) mouseAim = null; });
const primaryButton = $('fire-button');
primaryButton.addEventListener('pointerdown', event => {
  if (me?.body !== 'robot') return;
  event.preventDefault(); if (!combatInputAllowed()) return;
  primaryButton.setPointerCapture(event.pointerId); heldPrimary.add('touch:' + event.pointerId); fire('HE');
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) primaryButton.addEventListener(eventName, event => heldPrimary.delete('touch:' + event.pointerId));
const gunButton = $('machine-gun-button');
gunButton.addEventListener('pointerdown', event => {
  event.preventDefault(); if (!combatInputAllowed()) return;
  gunButton.setPointerCapture(event.pointerId); heldGun.add('touch:' + event.pointerId); fire('APCR');
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) gunButton.addEventListener(eventName, event => heldGun.delete('touch:' + event.pointerId));
gunButton.addEventListener('click', event => { if (event.detail === 0) fire('APCR'); });
setInterval(() => { if (heldGun.size) fire('APCR'); if (heldPrimary.size) fire('HE'); }, 30);
canvas.addEventListener('wheel', event => { if (!world) return; event.preventDefault(); zoom(event.deltaY > 0 ? 1 / 1.1 : 1.1); }, { passive: false });
mini.addEventListener('pointerdown', event => {
  if (!world) return; const r = mini.getBoundingClientRect(); camera.x = (event.clientX - r.left) / r.width * world.width * T; camera.y = (event.clientY - r.top) / r.height * world.height * T; following = false;
});
function locateSite(kind, id = null) {
  const site = world?.sites?.find(s => id ? s.id === id : s.kind === kind); if (!site) return;
  noteLocated();
  selectedSiteId = site.id;
  following = false; camera.x = (site.x + 1.5) * T; camera.y = (site.y + 1.5) * T;
  camera.zoom = Math.max(.45, camera.zoom); canvas.focus();
  if (kind === 'contaminator') camera.zoom = Math.min(.45, (width - 40) / (CONTAMINATOR.radius * 2.4 * T), (height - 180) / (CONTAMINATOR.radius * 2.4 * T));
}
$('locate-station').onclick = () => locateSite('alert');
$('locate-mortar').onclick = () => locateSite('mortar');
$('locate-modifier').onclick = () => locateSite('modifier');
$('locate-anti-air').onclick = () => locateSite('anti-air');
$('locate-laser').onclick = () => locateSite('laser');
$('locate-contaminator').onclick = () => locateSite('contaminator');
$('locate-settlement').onclick = () => {
  const colony = settlements(world?.sites)[0]; if (!colony) return;
  noteLocated();
  selectedSiteId = (colony.members.find(s => s?.state === 'hostile') || colony.members.find(Boolean)).id;
  following = false; camera.x = colony.x * T; camera.y = colony.y * T; camera.zoom = .35; canvas.focus();
};
const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
// Keyboard: BINDINGS (keymap.js) fixes precedence and labels; KEY_ACTIONS supplies
// each binding's guard and effect. The first matching binding whose guard passes wins.
let keepPlacing = false, overviewReturn = null, objectiveIndex = -1;
const onCanvas = event => event.target === canvas;
const trayOpen = () => !$('deployment-tray').hidden;
const choosingSite = event => mode === 'build' && !$('site-panel').hidden && (event.target === canvas || event.target === document.body);
const inTank = () => me.body === 'rover' && !!me.vehicleId && !controlledGun();
const shellFor = event => ['HE', 'INCENDIARY', 'GAS'][Number(keyOf(event)) - 1];
const once = run => event => { if (!event.repeat) run(event); };
const KEY_ACTIONS = {
  'aircraft-board': { when: event => !event.repeat && !$('aircraft-interact').hidden, run: () => { if (!$('aircraft-interact').disabled) void aircraftAction(currentAircraft() ? 'exit' : 'board'); } },
  'aircraft-space': { when: event => !!currentAircraft() && onCanvas(event), run: () => {} },
  'sub-depth': { when: event => isSubmarine(currentShip()) && onCanvas(event), run: once(event => { if (combatInputAllowed()) void shipDepth(keyOf(event) === ' ' ? 'surface' : 'dive'); }) },
  'missile-rotate': { when: () => isMissile(controlledGun()), run: once(() => $('missile-rotate').click()) },
  'catalogue-prev': { when: trayOpen, run: once(() => cycleTab(-1)) },
  'catalogue-next': { when: trayOpen, run: once(() => cycleTab(1)) },
  'catalogue-pick': { when: trayOpen, run: once(event => { const card = assetsIn(forceTab).map(a => $(a.card))[Number(keyOf(event)) - 1]; if (card && !card.disabled) { card.click(); if (mode === 'build' && $('site-panel').hidden) toggleSite(true); } }) },
  'gun-ammo': { when: () => !!controlledGun(), run: once(event => void gunAction('ammo', { ammo: shellFor(event) })) },
  'ship-ammo': { when: () => !!me.shipId, run: once(event => void shipAmmo(shellFor(event))) },
  'tank-primary': { when: inTank, run: once(event => setTankWeapon('tank-primary', ['HE', 'MAGNETIC'][Number(keyOf(event)) - 1])) },
  'tank-secondary': { when: inTank, run: once(() => setTankWeapon('tank-secondary', $('tank-secondary').value === 'APCR' ? 'HEAVY_FLAME' : 'APCR')) },
  'ship-board': { when: event => !event.repeat && !$('ship-interact').hidden, run: () => void shipInteract() },
  'tank-board': { when: event => !event.repeat && !$('tank-interact').hidden, run: () => void tankInteract() },
  'place-confirm': { when: choosingSite, run: once(() => { keepPlacing = false; void place(); }) },
  'place-repeat': { when: choosingSite, run: once(() => { keepPlacing = true; void place(); }) },
  'rail-shape': { when: () => mode === 'build' && deploymentKind === 'rail', run: once(() => cycleSelect('rail-shape')) },
  'rail-length': { when: () => mode === 'build' && deploymentKind === 'rail' && !$('rail-length').disabled, run: once(() => cycleSelect('rail-length')) },
  deploy: { when: () => true, prevent: false, run: () => { toggleTray($('deployment-tray').hidden); if (trayOpen()) (assetsIn(forceTab).map(a => $(a.card)).find(card => !card.disabled) || $('close-deployment')).focus(); } },
  secondary: { when: event => onCanvas(event) && combatInputAllowed(), run: once(() => { heldGun.add('keyboard'); fire('APCR'); }) },
  primary: { when: onCanvas, run: once(() => { if (controlledGun()) { heavyFire(); return; } if ((me.body === 'robot' || isAttackJet(currentAircraft())) && combatInputAllowed()) heldPrimary.add('keyboard'); fire('HE'); }) },
  back: { when: () => true, prevent: false, run: () => { releaseArtillery(); setMode('explore'); } },
  'sub-rotate': { when: event => isSubmarine(currentShip()) && !event.repeat, run: () => { subRotated = !subRotated; updateShips(); } },
  recenter: { when: () => true, prevent: false, run: () => { overviewReturn = null; recenter(); } },
  'ship-ramp': { when: event => !!currentShip() && !event.repeat, run: () => void shipRamp() },
  grid: { when: event => !event.repeat, prevent: false, run: () => $('grid-toggle').click() },
  logistics: { when: event => !event.repeat, run: () => $('supplies-button').click() },
  overview: { when: event => !event.repeat, run: () => toggleOverview() },
  'objective-next': { when: event => !event.repeat, run: () => cycleObjective(1) },
  'objective-prev': { when: event => !event.repeat, run: () => cycleObjective(-1) },
  room: { when: event => !event.repeat, run: () => { if ($('room-button').hidden || $('room-button').disabled) notify('The room menu is available in named campaigns.'); else $('room-button').click(); } },
  keys: { when: event => !event.repeat, run: () => openKeys() },
  'zoom-in': { when: () => true, prevent: false, run: () => zoom(1.1) },
  'zoom-out': { when: () => true, prevent: false, run: () => zoom(1 / 1.1) },
};
function cycleTab(step) { const index = TABS.findIndex(t => t.id === forceTab); setForceTab(TABS[(index + step + TABS.length) % TABS.length].id, true); }
function cycleSelect(id) { const select = $(id); select.selectedIndex = (select.selectedIndex + 1) % select.options.length; select.dispatchEvent(new Event('change')); }
function setTankWeapon(id, value) { if ($(id).value === value) return; $(id).value = value; $(id).dispatchEvent(new Event('change')); }
// M: whole-map survey overview, returning to the previous camera on the second press.
function toggleOverview() {
  if (controlledGun()) { setOrbitalView(!orbitalView); return; }
  if (overviewReturn) { camera = overviewReturn.camera; following = overviewReturn.following; overviewReturn = null; }
  else {
    overviewReturn = { camera: { ...camera }, following }; following = false;
    camera = { x: world.width * T / 2, y: world.height * T / 2, zoom: Math.min((width - 24) / (world.width * T), (height - 210) / (world.height * T)) };
  }
  $('zoom-label').textContent = Math.round(camera.zoom * 100) + '%';
}
// O / Shift+O: hostile sites ordered by distance from you.
function cycleObjective(step) {
  const from = me || world.spawn, distance = s => Math.hypot(s.x + 1.5 - from.x, s.y + 1.5 - from.y);
  const hostile = (world.sites || []).filter(s => s.state === 'hostile').sort((a, b) => distance(a) - distance(b));
  if (!hostile.length) { notify('No hostile sites surveyed in this world.'); return; }
  objectiveIndex = objectiveIndex < 0 ? (step > 0 ? 0 : hostile.length - 1) : (objectiveIndex + step + hostile.length) % hostile.length;
  const site = hostile[objectiveIndex]; overviewReturn = null; locateSite(null, site.id);
  notify(`Hostile site ${objectiveIndex + 1}/${hostile.length} · ${site.name || site.kind} · ${distance(site).toFixed(1)} t`);
}
// F1: the bindings valid right now, grouped by scope, plus the always-on pointer controls.
function openKeys() {
  stopFiring(); keys.clear();
  const groups = new Map();
  for (const binding of BINDINGS) {
    if (binding.id === 'aircraft-space') continue;
    const probe = { target: canvas, repeat: false, shiftKey: !!binding.shift };
    if (binding.scope !== 'global' && !KEY_ACTIONS[binding.id]?.when(probe)) continue;
    if (!groups.has(binding.scope)) groups.set(binding.scope, []);
    groups.get(binding.scope).push(binding);
  }
  const section = (title, rows) => {
    const list = document.createElement('dl');
    for (const [key, text] of rows) list.append(Object.assign(document.createElement('dt'), { textContent: key }), Object.assign(document.createElement('dd'), { textContent: text }));
    return [Object.assign(document.createElement('h2'), { textContent: title }), list];
  };
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === 'global') - (b === 'global'));
  $('keys-now').replaceChildren(...ordered.flatMap(([scope, list]) => section(SCOPES[scope], list.map(b => [b.label, b.text]))), ...section('Pointer and movement', POINTER));
  $('keys-dialog').showModal();
  if (campaignId) roomRequest('pause', { paused: true }).catch(e => notify(e.message));
}
window.addEventListener('keydown', event => {
  if (!world || roomState?.paused || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || ['logistics-dialog', 'room-dialog', 'help-dialog', 'keys-dialog'].some(id => $(id).open)) return;
  const key = keyOf(event);
  if (movementKeys.has(key)) { event.preventDefault(); if (alive() && !me.deploying && !(mode === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind))) { keys.add(key); if (!controlledGun()) { following = true; path = []; overviewReturn = null; } } return; }
  for (const binding of BINDINGS) {
    if (!binding.keys.includes(key) || (binding.shift !== undefined && binding.shift !== event.shiftKey)) continue;
    const action = KEY_ACTIONS[binding.id];
    if (!action?.when(event)) continue;
    if (action.prevent !== false) event.preventDefault();
    action.run(event); return;
  }
});
window.addEventListener('keyup', event => { const key = keyOf(event); keys.delete(key); if (key === 'j') heldGun.delete('keyboard'); if (key === ' ') heldPrimary.delete('keyboard'); });
window.addEventListener('blur', () => { keys.clear(); stopFiring(); cancelPointer(); });
window.addEventListener('blur', releaseArtillery);
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); stopFiring(); cancelPointer(); releaseArtillery(); } });
const directionKey = { up: 'w', left: 'a', down: 's', right: 'd' };
for (const button of document.querySelectorAll('[data-direction]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(directionKey[button.dataset.direction]); following = !controlledGun(); path = []; });
  const release = () => keys.delete(directionKey[button.dataset.direction]);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
setInterval(async () => {
  if (!connected || inputBusy || !world || roomState?.paused || $('logistics-dialog').open || $('room-dialog').open || inOrbit() || !alive() || me.deploying || (mode === 'build' && ['core', 'tank', 'ship', 'airbase'].includes(deploymentKind))) return;
  if (controlledGun()) {
    if (document.hidden || gunBusy) return;
    inputBusy = true;
    const x = $('help-dialog').open ? 0 : Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    const y = $('help-dialog').open ? 0 : Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    const point = aim || controlledGun().target || (isMissile(controlledGun()) ? { x: 64, y: 48 } : artillerySolution(controlledGun()));
    const target = { x: Math.max(0, Math.min(world.width - .001, point.x)), y: Math.max(0, Math.min(world.height - .001, point.y)) };
    try { await api('artillery/command', { id: controlledGun().id, x, y, target }); failedInputs = 0; }
    catch (error) { if (++failedInputs === 1) notify(error.message); }
    finally { inputBusy = false; }
    return;
  }
  const x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  const y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  const current = `${x},${y}`;
  const angle = aim ? Math.atan2(aim.y - me.y, aim.x - me.x) + Math.PI / 2 : me.angle;
  const pointChanged = me.shipId && aim && (!lastShipTarget || Math.hypot(aim.x-lastShipTarget.x,aim.y-lastShipTarget.y)>.1);
  const aimChanged = !!pointChanged || lastAim === null || Math.abs(angleDelta(lastAim, angle)) > .025;
  if (!x && !y && lastInput === current && !aimChanged) return;
  inputBusy = true;
  try { await api('input', { x, y, aim: angle, ...(me.shipId&&aim?{target:aim}:{}) }); lastShipTarget=aim?{...aim}:null; lastInput = current; lastAim = angle; failedInputs = 0; }
  catch { if (++failedInputs === 1) notify('Movement paused. Waiting for the connection.'); }
  finally { inputBusy = false; }
}, 140);

async function start() {
  try {
    const assetNames = ['tileGrass1.png', 'tileGrass2.png', 'tileSand1.png', 'tileSand2.png', 'tankBody_sand.png', 'tankSand_barrel1.png', 'tankBody_dark.png', 'tankDark_barrel1.png', 'treeBrown_small.png', 'treeGreen_small.png'];
    const [data] = await Promise.all([api('world'), ...assetNames.map(name => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => { images[name] = img; resolve(); }; img.onerror = () => reject(new Error(`Could not load ${name}. Reload to try again.`)); img.src = `/assets/kenney/${name}`;
    }))]);
    world = data.world; me = data.me; buildings = data.buildings; players = data.players;
    $('account-link').textContent = data.accountKind === 'demo' ? 'DEMO' : 'ID';
    $('account-link').title = data.accountKind === 'demo' ? 'Demo account / simulated email verification' : data.accountKind ? 'Player account' : 'Sign in or link this guest';
    $('drill-front').replaceChildren(...(world.fronts || [{ id: 'landing', label: 'Caldera landing' }]).map(f => Object.assign(document.createElement('option'), { value: f.id, textContent: f.label })));
    if (me.deploying) deploymentFocus = world.cores.find(c => c.owner === me.id)?.id;
    initialFoundations = buildings.filter(b => b.owner === me.id).length;
    moved = Math.hypot(me.x - world.spawn.x, me.y - world.spawn.y) > .8;
    $('scout-name').textContent = me.name.toUpperCase();
    $('tile-x').max = world.width - 1; $('tile-y').max = world.height - 1;
    paintTerrain(); resize();
    camera = { x: me.x * T, y: me.y * T, zoom: currentAircraft()?(width<760?.25:.5):isSubmarine(currentShip()) ? (width<760?.12:.3) : width < 760 ? .7 : .75 };
    if(currentAircraft())following=true;zoom(1); select(Math.floor(me.x), Math.floor(me.y)); aim = { x: me.x, y: Math.max(.5, me.y - 5) }; updateState(data); setMode('explore'); drawMinimap();
    $('loading').classList.add('hidden'); requestAnimationFrame(frame);
    subscribe();
    if (inOrbit()) beginCoreSurvey();
    if (initialFoundations && alive()) notify('Welcome back. Your outpost is right where you left it.');
  } catch (error) {
    $('loading').querySelector('strong').textContent = 'Uplink unavailable'; $('loading').querySelector('p').textContent = `${error.message} Refresh to reconnect.`;
  }
}
new ResizeObserver(resize).observe(canvas);
start();
