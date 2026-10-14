import { SHIPYARD, dockRecords, yardFromShip, linkYard, syncShipyards, shipyardSite, yardBuildError, rememberWreck, tickDockRepair } from './public/shipyard.js';
import { newRampGun } from './public/ramp-sentry.js';
import { isTransport, carriedVehicles, transportVehicles, loadError, unloadPoint, driveOnError } from './public/transport.js';
import { BRIDGE, isBuilder, bridgeReady, bridgeDuration, bridgeCost } from './public/bridge-geometry.js';
import { bridgeError } from './public/bridge.js';
import { RECYCLER, recyclerStep, recyclerExit, parkedTask } from './public/recycler.js';
import { seedSettlement } from './public/settlement.js';
import { ECONOMY, COSTS, LOGISTICS_SIZE, freshLogistics, migrateLogistics, LOCAL_KINDS, poolFor, poolLabel, supportSources, salvageReceivers, unloadSalvage, orbitalDuration, credit, readyFactory, facilityCenter, quote, emergencyTankError, tickSupplies, collectSalvage, tickLaunch, facilityTargets, facilityDistance } from './public/logistics.js';
import { constructionError } from './public/construction.js';
import { missionActive, missionError, strikePlan, validateMission, assignMission, abortMission, tickMission } from './public/bomber-mission.js';
import { AIR, airbaseError, newAirbase, airbaseGate, launchAircraft, tickAircraft, tickAirRepair, deliverAircraft } from './public/aircraft.js';
import { seedConquest } from './public/conquest.js';
import { surfaced, resetDepth, requestDepth, tickDepth } from './public/submarine-depth.js';
import http from 'node:http';
import { createAudit } from './observability.js';
import { isSubmarine } from './public/submarine.js';
import { VEHICLE, hullHealth, operational } from './public/vehicle.js';
import { stepShipMounts, tickMainReloads } from './public/ship-armament.js';
import { SHIP, dockComplete, shipKind, shipSite, replacementShipError, mooredDock, boardingPoint, shoreRampSite, sailStep, shipSolution, recallShipError } from './public/ship.js';
import { TANK, tankPodCells, tankPlacementError, tankArrivalPosition } from './public/tank.js';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { lockWorld } from './world-maintenance.js';
import { createAccounts } from './accounts/service.js';
import { smtpMailer } from './accounts/mail.js';
import { createCampaigns } from './campaigns/service.js';
import { createWorld, canStand, clearSpawn, findPath, placementError, SPEED } from './public/world.js';
import { createCombat } from './public/combat.js';
import { turnTurret } from './public/turret.js';
import { CORE, corePlacementError, coreSentries, coreExit, coreCells } from './public/core.js';
import { loadout } from './public/weapons.js';
import { recoveryCores, freshLife, lifeRecord, beginRecovery, tickLife, hurtRobot } from './public/survival.js';
import { RAIL, railSegment, railError, carriageError, moveCarriage, driveCarriage, tickCarriage, artilleryFireError, artillerySolution } from './public/rail.js';
import { artilleryBlocks } from './public/footprints.js';
import { ARTILLERY_HE, ARTILLERY_SHELLS } from './public/weapons.js';
import { expandWorld } from './public/expansion.js';
import { switchAt, switchLocked, switchConnectionError } from './public/switches.js';
import { isCurve, joinedShape, curveBounds, insideBounds } from './public/track.js';
import { MISSILE, missileAim, isMissile, missilePlacementError, missileFireError, tickBattery } from './public/missile.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
// Loaded client modules must match the simulation's snapshot format after restart.
const buildHash = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url)));
for (const name of readdirSync(publicDir).filter(name => /\.(js|css|html)$/.test(name)).sort()) buildHash.update(name).update(readFileSync(path.join(publicDir, name)));
const clientBuild = buildHash.digest('hex').slice(0, 16);
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createApp({ dataDir = process.env.DATA_DIR || path.join(root, '.local', 'data'), emailDelivery = smtpMailer(), logSink = line => console.log(line) } = {}) {
  const release = lockWorld(dataDir);
  const audit = createAudit(logSink);
  try {
    let campaigns;
    const app = createWorldApp(dataDir, emailDelivery, { audit, onRevoke: (...args) => campaigns?.revoke(...args) });
    campaigns = createCampaigns({ dataDir, legacy: app, audit, createRuntime: (dir, options) => createWorldApp(dir, emailDelivery, { ...options, audit }) });
    const handler = app.server.listeners('request')[0];
    app.server.removeListener('request', handler);
    app.server.on('request', (req, res) => audit.run(req, res, () => campaigns.route(req, res, handler)));
    let closing;
    return { server: app.server, close: () => closing ??= campaigns.close().then(() => app.close()).finally(() => { audit.close(); release(); }) };
  } catch (error) {
    audit.emit("server.start_failed", { reason: error.code || "initialization_failed" }); audit.close(); release();
    throw error;
  }
}

function createWorldApp(dataDir, emailDelivery, options = {}) {
  const audit = options.audit, campaignId = options.campaignId || 'legacy';
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'world.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS airbases (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ships (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tanks (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS equipment (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scouts (token TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, angle REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS buildings (id TEXT PRIMARY KEY, x INTEGER NOT NULL, y INTEGER NOT NULL, owner TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(x,y));
    CREATE TABLE IF NOT EXISTS cores (id TEXT PRIMARY KEY, owner TEXT UNIQUE NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, elapsed REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS robot_states (scout_id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rails (x INTEGER NOT NULL, y INTEGER NOT NULL, shape TEXT NOT NULL, owner TEXT NOT NULL, PRIMARY KEY(x,y));
    CREATE TABLE IF NOT EXISTS artillery (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rail_switches (x INTEGER NOT NULL, y INTEGER NOT NULL, route TEXT NOT NULL CHECK(route IN ('curve','straight')), PRIMARY KEY(x,y));`);
  if (!db.prepare('SELECT value FROM meta WHERE key=?').get('world')) db.prepare('INSERT INTO meta VALUES (?,?)').run('world', JSON.stringify(createWorld()));
  const oldWorldText = db.prepare('SELECT value FROM meta WHERE key=?').get('world').value;
  const oldWorld = JSON.parse(oldWorldText), world = expandWorld(oldWorld);
  if (world !== oldWorld) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT OR IGNORE INTO meta VALUES (?,?)').run('world-before-expansion-v2', oldWorldText);
      db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(world), 'world'); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  world.airbases=db.prepare('SELECT value FROM airbases ORDER BY rowid').all().map(row=>{const base=JSON.parse(row.value);if(!missionActive(base.aircraft))base.aircraft.releaseRemaining=0;return base;});
  const writeAirbase=db.prepare('INSERT INTO airbases VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value'),savedAirbases=new Map();
  const saveAirbase=base=>{const value=JSON.stringify(base,(key,value)=>key==='damageDirty'?undefined:value);if(savedAirbases.get(base.id)!==value){writeAirbase.run(base.id,value);savedAirbases.set(base.id,value);}};
  const pilotedBase=id=>world.airbases.find(b=>b.aircraft.occupant===id);
  const boardedAircraft=id=>pilotedBase(id)?.aircraft;
  world.cores = db.prepare('SELECT * FROM cores ORDER BY rowid').all();
  world.rails = db.prepare('SELECT * FROM rails ORDER BY y,x').all();
  world.switches = db.prepare('SELECT * FROM rail_switches ORDER BY y,x').all();
  world.artillery = db.prepare('SELECT value FROM artillery ORDER BY rowid').all().map(row => ({ elevation: RAIL.defaultElevation, ...JSON.parse(row.value), target: null, operator: null, lease: 0, input: null, inputTime: 0 }));
  world.tanks = db.prepare('SELECT value FROM tanks ORDER BY rowid').all().map(row => ({health:VEHICLE.tank,hurt:0,...JSON.parse(row.value)}));
  const writeTank = db.prepare('INSERT INTO tanks VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value');
  const saveTank = tank => writeTank.run(tank.id, JSON.stringify(Object.fromEntries(Object.entries(tank).filter(([key])=>!['damageDirty','timerDirty'].includes(key)))));
  world.ships = db.prepare('SELECT value FROM ships ORDER BY rowid').all().map(row => ({health:VEHICLE.ship,hurt:0,...JSON.parse(row.value),speed:0,launchRemaining:0,repairing:false}));
  const writeShip=db.prepare('INSERT INTO ships VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value'), savedShips=new Map();
  for(const ship of world.ships)if(isSubmarine(ship))Object.assign(ship,{depth:'surfaced',depthRemaining:0,diveBattery:30,...ship});
  const saveShip=ship=>{const {speed,damageDirty,timerDirty,target,launchRemaining,...record}=ship,value=JSON.stringify(record);if(savedShips.get(ship.id)!==value){writeShip.run(ship.id,value);savedShips.set(ship.id,value);}};
  const boardedShip=id=>world.ships.find(s=>!s.destroyed&&s.occupant===id);
  const boardedTank = id => world.tanks.find(t => !t.destroyed && t.occupant === id);
  const logisticsRow = db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get();
  if (!logisticsRow && db.prepare('SELECT COUNT(*) AS n FROM scouts').get().n) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, 'before-logistics-' + randomUUID() + '.sqlite'));
  }
  world.logistics = logisticsRow ? JSON.parse(logisticsRow.value) : freshLogistics();
  if(world.logistics.version===1){const directory=path.join(dataDir,'backups');mkdirSync(directory,{recursive:true});db.prepare('VACUUM INTO ?').run(path.join(directory,'before-split-supplies-'+randomUUID()+'.sqlite'));}
  migrateLogistics(world.logistics);
  const saveLogistics = () => db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('logistics-v1', JSON.stringify(world.logistics));
  world.logistics.bridges ||= [];
  // Add independent dock records without moving legacy hulls or charging owners.
  const unlinked=world.ships.filter(s=>!(world.logistics.shipyards||[]).some(y=>y.id===(s.yardId||s.id)));
  if(unlinked.length){const directory=path.join(dataDir,'backups');mkdirSync(directory,{recursive:true});db.prepare('VACUUM INTO ?').run(path.join(directory,'before-shipyards-'+randomUUID()+'.sqlite'));}
  db.exec('BEGIN IMMEDIATE');
  try {
  world.logistics.shipyards ||= [];
  world.logistics.wrecks ||= [];
  for(const s of unlinked)world.logistics.shipyards.push(yardFromShip(s));
  syncShipyards(world);
  for(const s of world.ships){s.rampGun ||= newRampGun(s);rememberWreck(world,s);saveShip(s);}
  saveLogistics();db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  for(const r of world.logistics.recyclers)Object.assign(r,{speed:0,idle:0});
  const boardedRecycler = id => world.logistics.recyclers.find(r=>r.occupant===id);
  const constructing = id => !!world.logistics.jobs[id];
  // The same transaction pays for an accepted placement and saves its object.
  function purchase(kind, data, object, write, yardBuild = false) {
    if(!Object.hasOwn(COSTS,kind))return 'Unknown deployment type.';
    const l=world.logistics, factory=data.method==='factory', local=factory||yardBuild;
    if(data.method!==undefined&&!['orbital','factory'].includes(data.method))return 'Choose orbital or factory construction.';
    let workshop;
    if(factory){
      if(!LOCAL_KINDS.includes(kind))return 'This deployment uses orbital delivery.';
      workshop=supportSources(world).find(f=>f.id===data.factoryId);
      if(!workshop)return 'Choose a completed friendly factory.';
      const siteX=kind==='tank'?object.podX:['recycler','builder'].includes(kind)?object.x-.5:object.x;
      const siteY=kind==='tank'?object.podY:['recycler','builder'].includes(kind)?object.y-.5:object.y;
      const support=constructionError({...world,cores:workshop.kind==='core'?[workshop]:[],logistics:{facilities:workshop.kind==='core'?[]:[workshop]}},['submarine','transport'].includes(kind)?'ship':kind,siteX,siteY,object);
      if(support)return support;
    }
    let price=quote(kind,local);const pool=poolFor(kind,local),freeBomber=kind==='aircraft'&&object.aircraft?.kind==='bomber'&&!l.freeBomberUsed;if(freeBomber)price=0;
    if(kind==='core'&&(!l.deployments[object.owner]||!world.cores.length))price=0;
    const emergency=kind==='tank'&&data.emergency===true;
    if(emergency){const error=emergencyTankError(world);if(error)return error;price=0;object.emergency=true;object.weapon='HE';object.secondary='APCR';}
    if((l[pool]||0)+1e-8<price)return `Need ${price} ${poolLabel(pool)}; ${Math.floor(l[pool]||0)} available.`;
    const previous=structuredClone(l);
    db.exec('BEGIN IMMEDIATE');
    try {
      l[pool]-=price;
      if(freeBomber)l.freeBomberUsed=true;
      if(emergency)l.emergency=ECONOMY.emergencyCooldown;
      if(kind==='core')l.deployments[object.owner]=true;
      if(factory)l.jobs[object.id]={remaining:ECONOMY.factoryTime,duration:ECONOMY.factoryTime,method:'factory',factoryId:workshop.id,kind,cost:price,pool,droneBay:{x:Math.floor(object.x),y:Math.floor(object.y)}};
      else if(yardBuild){object.assemblyRemaining=ECONOMY.factoryTime;object.assemblyDuration=ECONOMY.factoryTime;}
      else if(['airbase','artillery','missile','sentry'].includes(kind)){const duration=orbitalDuration(kind);l.jobs[object.id]={remaining:duration,duration,method:'orbital',kind,cost:price,pool};}
      if(factory&&['factory','uplink','outpost','recycler','builder'].includes(kind))object.remaining=ECONOMY.factoryTime;
      write();saveLogistics();db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');world.logistics=previous;savedShips.clear();savedAirbases.clear();savedGuns.clear();throw error;}
    return null;
  }
  const equipped = p => boardedTank(p.id) || equipment.get('player:' + p.id) || {};
  const equipment = new Map(db.prepare('SELECT * FROM equipment').all().map(row => [row.id, JSON.parse(row.value)]));
  const equip = (id, value) => { db.prepare('INSERT INTO equipment VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(id, JSON.stringify(value)); equipment.set(id, value); };
  const people = new Map(), streams = new Map();
  let buildings = db.prepare('SELECT * FROM buildings ORDER BY created').all();
  const savedCombat = options.campaign ? JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()?.value || 'null') : null;
  const introduceConquest = options.campaign && !savedCombat?.sites;
  if (introduceConquest) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, `before-conquest-${randomUUID()}.sqlite`));
    world.sites = seedConquest(world, buildings, [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])]);
  }
  const combat = createCombat(world, savedCombat, () => audit.context());
  function flushCombatEvents() {
    for (const { event, ...details } of combat.drainEvents()) audit.emit(event, { ...details, campaignId, saved: !!options.campaign });
  }
  if (introduceConquest) {
    db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
    audit.emit('campaign.migrated', { campaignId, cause: 'conquest_checkpoint_added_with_backup', count: world.sites.length, saved: true });
  }
  if (options.campaign && !db.prepare("SELECT value FROM meta WHERE key='mortar-outpost-v1'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, `before-mortar-${randomUUID()}.sqlite`));
    const additions = world.sites.some(s => s.kind === 'mortar' && !s.settlement) ? [] : seedConquest(world, buildings,
      [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])], 'mortar');
    world.sites.push(...additions);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.prepare('INSERT INTO meta VALUES (?,?)').run('mortar-outpost-v1', JSON.stringify({ placed: world.sites.some(s => s.kind === 'mortar' && !s.settlement) }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    audit.emit('campaign.migrated', { campaignId, cause: 'mortar_outpost_added_with_backup', count: additions.length, saved: true });
  }
  if (options.campaign && !db.prepare("SELECT value FROM meta WHERE key='environment-modifier-v1'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, `before-modifier-${randomUUID()}.sqlite`));
    const additions = world.sites.some(s => s.kind === 'modifier' && !s.settlement) ? [] : seedConquest(world, buildings,
      [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])], 'modifier');
    world.sites.push(...additions);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.prepare('INSERT INTO meta VALUES (?,?)').run('environment-modifier-v1', JSON.stringify({ placed: world.sites.some(s => s.kind === 'modifier' && !s.settlement) }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    audit.emit('campaign.migrated', { campaignId, cause: 'environment_modifier_added_with_backup', count: additions.length, saved: true });
  }
  if (options.campaign && !db.prepare("SELECT value FROM meta WHERE key='alien-settlement-v1'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, 'before-settlement-' + randomUUID() + '.sqlite'));
    const additions = seedSettlement(world, buildings, [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])]);
    world.sites.push(...additions);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.prepare('INSERT INTO meta VALUES (?,?)').run('alien-settlement-v1', JSON.stringify({ placed: world.sites.some(s => s.settlement) }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    audit.emit('campaign.migrated', { campaignId, cause: 'alien_settlement_added_with_backup', count: additions.length, saved: true });
  }
  if (options.campaign && !db.prepare("SELECT value FROM meta WHERE key='air-contaminator-v1'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, 'before-contaminator-' + randomUUID() + '.sqlite'));
    const additions = world.sites.some(s => s.kind === 'contaminator') ? [] : seedConquest(world, buildings,
      [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])], 'contaminator');
    world.sites.push(...additions);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.prepare('INSERT INTO meta VALUES (?,?)').run('air-contaminator-v1', JSON.stringify({ placed: world.sites.some(s => s.kind === 'contaminator') }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    audit.emit('campaign.migrated', { campaignId, cause: 'air_contaminator_added_with_backup', count: additions.length, saved: true });
  }
  if (options.campaign && !db.prepare("SELECT value FROM meta WHERE key='laser-tower-v1'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, 'before-laser-' + randomUUID() + '.sqlite'));
    const additions = world.sites.some(s => s.kind === 'laser') ? [] : seedConquest(world, buildings,
      [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])], 'laser');
    world.sites.push(...additions);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.prepare('INSERT INTO meta VALUES (?,?)').run('laser-tower-v1', JSON.stringify({ placed: world.sites.some(s => s.kind === 'laser') }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    audit.emit('campaign.migrated', { campaignId, cause: 'laser_tower_added_with_backup', count: additions.length, saved: true });
  }
  if (options.campaign && !db.prepare("SELECT value FROM meta WHERE key='anti-air-v1'").get()) {
    const directory = path.join(dataDir, 'backups'); mkdirSync(directory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(directory, 'before-anti-air-' + randomUUID() + '.sqlite'));
    const additions = world.sites.some(s => s.kind === 'anti-air') ? [] : seedConquest(world, buildings,
      [...db.prepare('SELECT x,y FROM scouts').all(), ...(savedCombat?.enemies || [])], 'anti-air');
    world.sites.push(...additions);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.prepare('INSERT INTO meta VALUES (?,?)').run('anti-air-v1', JSON.stringify({ placed: world.sites.some(s => s.kind === 'anti-air') }));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    audit.emit('campaign.migrated', { campaignId, cause: 'anti_air_added_with_backup', count: additions.length, saved: true });
  }
  let revision = 0, closed = false, combatDirty = false;
  const save = db.prepare('UPDATE scouts SET x=?,y=?,angle=? WHERE id=?');
  const saveCore = db.prepare('UPDATE cores SET elapsed=? WHERE id=?');
  const readLife = db.prepare('SELECT value FROM robot_states WHERE scout_id=?');
  const saveLife = db.prepare('INSERT INTO robot_states VALUES (?,?) ON CONFLICT(scout_id) DO UPDATE SET value=excluded.value');
  const writeGun = db.prepare('INSERT INTO artillery VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value');
  const savedGuns = new Map();
  const saveGun = gun => {
    const { operator, lease, input, inputTime, driveBlocked, ...saved } = gun, value = JSON.stringify(saved);
    if (savedGuns.get(gun.id) !== value) { writeGun.run(gun.id, value); savedGuns.set(gun.id, value); }
  };
  const controlledBy = id => world.artillery.find(g => g.operator === id);
  const canManage = (owner, pilot) => owner === pilot || !!options.canManage?.(owner, pilot);
  const releaseGun = id => { const gun = controlledBy(id); if (gun) { gun.operator = null; gun.lease = 0; gun.input = null; gun.inputTime = 0; } };
  const allBuildings = () => [...buildings, ...coreSentries(world.cores)].map(b => ({ ...b, weapon: equipment.get('sentry:' + b.id)?.weapon || 'APCR' }));
  const incomingCore = id => world.cores.find(c => c.owner === id && c.elapsed < CORE.duration);
  const pendingDeletes=[], pendingLives=new Map(), logisticsEvents=[];
  function dropCargo(x,y,amount){
    if(!(amount>0))return;
    const l=world.logistics;
    if(l.crates.length>=64){l.crates[0].amount+=amount;return;}
    l.crates.push({id:randomUUID(),x,y,amount});
  }
  const constructionTarget = id => facilityTargets(world,buildings,true).find(f=>f.object.id===id) || world.tanks.filter(t=>t.id===id).map(object=>({id:'tank:'+id,kind:'tank',object}))[0];
  function destroyFacility(f, cancelled=false){
    const l=world.logistics,o=f.object,job=l.jobs[o.id];
    logisticsEvents.push({event:cancelled?'construction.cancelled':'facility.destroyed',targetId:o.id,cause:f.kind,kind:'system'});
    if(cancelled&&job)credit(l,Math.floor(job.cost/2),job.pool||'supplies');
    delete l.jobs[o.id];
    if(f.kind==='core'){
      if(o.elapsed>=CORE.duration)l.floors=[...new Set([...(l.floors||[]),...coreCells(o.x,o.y).map(c=>c.y*world.width+c.x)])];
      const row=db.prepare('SELECT * FROM scouts WHERE id=?').get(o.owner);
      if(row){const p=people.get(o.owner);if(p)p.deployed=true;else pendingLives.set(o.owner,{...freshLife(),...JSON.parse(readLife.get(o.owner)?.value||'{}'),deployed:true});}
      world.cores=world.cores.filter(c=>c.id!==o.id);pendingDeletes.push(['cores',o.id]);
    }else if(f.kind==='tank'){world.tanks=world.tanks.filter(t=>t.id!==o.id);pendingDeletes.push(['tanks',o.id]);
    }else if(f.kind==='sentry'){
      buildings=buildings.filter(b=>b.id!==o.id);pendingDeletes.push(['buildings',o.id]);equipment.delete('sentry:'+o.id);pendingDeletes.push(['equipment','sentry:'+o.id]);
    }else if(['artillery','missile'].includes(f.kind)){
      world.artillery=world.artillery.filter(g=>g.id!==o.id);pendingDeletes.push(['artillery',o.id]);savedGuns.delete(o.id);
    }else if(f.kind==='airbase'){
      if(cancelled){world.airbases=world.airbases.filter(b=>b.id!==o.id);pendingDeletes.push(['airbases',o.id]);savedAirbases.delete(o.id);}
      else {o.destroyed=true;const p=o.aircraft;if(['parked','delivering','landing'].includes(p.state))Object.assign(p,{health:0,state:'destroyed',remaining:20,damageDirty:true});}
    }else if(f.kind==='dock'){
      if(cancelled){world.ships=world.ships.filter(s=>s.id!==o.id);world.logistics.shipyards=world.logistics.shipyards.filter(y=>y.id!==o.id);pendingDeletes.push(['ships',o.id]);savedShips.delete(o.id);}
      else o.dockDestroyed=true;
      syncShipyards(world);
    }else if(f.kind==='ramp'){
      o.destroyed=true;
    }else if(f.kind==='recycler'){
      if(o.occupant){
        let pilot=people.get(o.occupant);if(!pilot){const row=db.prepare('SELECT * FROM scouts WHERE id=?').get(o.occupant);if(row)pilot={...row,...freshLife(),...JSON.parse(readLife.get(row.id)?.value||'{}')};}
        if(pilot){pilot.shield=0;hurtRobot(pilot,Math.max(1,pilot.health));pilot.lostVehicle='recycler';pilot.x=o.x;pilot.y=o.y;pilot.dirty=true;pendingLives.set(pilot.id,lifeRecord(pilot));combat.cancelCharge(pilot.id);}
      }
      l.bridges=l.bridges.filter(b=>b.builderId!==o.id||bridgeReady(b));
      dropCargo(o.x,o.y,o.cargo);l.recyclers=l.recyclers.filter(r=>r.id!==o.id);
    }else{
      const p=facilityCenter(o);dropCargo(p.x,p.y,(o.cargo||0)+(o.inFlight||0));l.facilities=l.facilities.filter(v=>v.id!==o.id);
      // A destroyed workshop cannot finish its pending orders. Half their cost
      // returns to its original pool; completed equipment remains operational.
    }
    if(['core','factory','outpost'].includes(f.kind))for(const [id,j] of Object.entries(l.jobs))if(j.factoryId===o.id){const target=constructionTarget(id);if(target)destroyFacility(target,true);}
    if(!['airbase','dock','ramp'].includes(f.kind)||cancelled)delete l.durability[f.id];
  }
  function tickLogistics(dt){
    const l=world.logistics,before=l.supplies+(l.groundSupplies||0),wasEmergency=l.emergency;
    const active=l.bridges.some(b=>!bridgeReady(b))||l.facilities.some(f=>f.remaining>0||f.launch>0||f.cooldown>0)||Object.keys(l.jobs).length>0||l.recyclers.some(r=>r.remaining>0||r.occupant||r.path?.length||r.task&&!r.blocked);
    tickSupplies(l,dt);
    for(const f of l.facilities){if(!constructing(f.id))f.remaining=Math.max(0,f.remaining-dt);if(l.jobs[f.id])f.remaining=l.jobs[f.id].remaining;const before=l.shipments;if(!f.remaining&&!constructing(f.id))tickLaunch(l,f,dt);if(l.shipments>before)logisticsEvents.push({event:'supply.shipped',sourceId:f.id,kind:'system',count:l.shipments});}
    for(const [id,job]of Object.entries(l.jobs)){
      job.remaining=Math.max(0,job.remaining-dt);
      if(job.remaining<1e-8){
        if(job.method==='factory'){const f=[...l.facilities,...l.recyclers].find(o=>o.id===id);if(f)f.remaining=0;const t=world.tanks.find(o=>o.id===id);if(t){t.elapsed=TANK.duration;Object.assign(t,tankArrivalPosition(t));saveTank(t);}}
        if(job.kind==='repair'){
          const object=job.repair==='dock'?dockRecords(world).find(s=>s.id===id):world.airbases.find(b=>b.id===id);
          if(object){if(job.repair==='dock')object.dockDestroyed=false;else object.destroyed=false;delete l.durability[job.repair+':'+id];}
        }
        logisticsEvents.push({event:'construction.completed',targetId:id,cause:job.kind,kind:'system'});
        delete l.jobs[id];
      }
    }
    for(const b of l.bridges)if(!bridgeReady(b)){b.elapsed=Math.min(bridgeDuration(b),b.elapsed+dt);if(bridgeReady(b))logisticsEvents.push({event:'construction.completed',targetId:b.id,cause:'bridge',kind:'system'});}
    for(const truck of l.recyclers){
      if(isBuilder(truck)&&l.bridges.some(b=>b.builderId===truck.id&&!bridgeReady(b))){truck.speed=0;continue;}
      if(constructing(truck.id)){truck.remaining=l.jobs[truck.id].remaining;continue;}
      if(truck.remaining>0){truck.remaining=Math.max(0,truck.remaining-dt);continue;}
      if(truck.occupant){
        const driver=people.get(truck.occupant);truck.speed=0;
        if(!driver||!streams.has(driver.id)||driver.life!=='active'){truck.idle=0;continue;}
        const input=driver.inputUntil>Date.now()?driver.input:null;
        recyclerStep(world,allBuildings(),truck,input,dt,groundPeople().filter(p=>streams.has(p.id)&&!boardedRecycler(p.id)));
        if(isBuilder(truck)||truck.idle<RECYCLER.idleTime)continue;
        const task=parkedTask(world,truck);
        if(truck.task?.id!==task?.id||truck.task?.action!==task?.action)truck.collecting=0;
        truck.task=task;truck.blocked=false;
      }
      if(!truck.occupant&&truck.path?.length){
        const next=truck.path[0],distance=Math.hypot(next.x-truck.x,next.y-truck.y),step=Math.min(distance,2.5*dt);
        if(distance<.01){truck.path.shift();continue;}
        const x=truck.x+(next.x-truck.x)*step/distance,y=truck.y+(next.y-truck.y)*step/distance;
        if(!canStand(world,allBuildings(),x,y)||l.recyclers.some(r=>r!==truck&&Math.hypot(r.x-x,r.y-y)<.8)){truck.path=[];truck.blocked=true;continue;}
        truck.angle=Math.atan2(next.x-truck.x,truck.y-next.y);truck.x=x;truck.y=y;truck.blocked=false;continue;
      }
      if(!truck.task||truck.blocked)continue;
      const {action,id}=truck.task;
      if(action==='collect'){
        const site=world.sites.find(s=>s.id===id);
        if(!collectSalvage(l,site,truck,dt))truck.task=null;
      }else if(action==='deliver'){
        unloadSalvage(world,truck,id,dt);
        if(truck.cargo<=0||!salvageReceivers(world).some(f=>f.id===id))truck.task=null;
      }else if(action==='recover'){
        const crate=l.crates.find(c=>c.id===id);
        if(crate&&Math.hypot(truck.x-crate.x,truck.y-crate.y)<=(truck.occupant?RECYCLER.pickupRange:4)){const amount=Math.min(crate.amount,ECONOMY.cargo-truck.cargo);truck.cargo+=amount;crate.amount-=amount;l.crates=l.crates.filter(c=>c.amount>0);}
        truck.task=null;
      }
    }
    return active||before!==l.supplies+(l.groundSupplies||0)||wasEmergency!==l.emergency;
  }
  const playerBody = p => boardedAircraft(p.id) ? 'aircraft' : boardedShip(p.id) ? 'ship' : boardedTank(p.id) ? 'rover' : boardedRecycler(p.id) ? 'recycler' : (p.deployed || world.cores.some(c => c.owner === p.id)) ? 'robot' : 'orbital';
  const groundPeople = () => [...people.values()].filter(p => playerBody(p) !== 'orbital');
  const isGuarding = p => playerBody(p) === 'robot' && p.life === 'active' && !incomingCore(p.id) && streams.has(p.id) && (controlledBy(p.id)?.lease || 0) > 0;
  const playerView = p => ({ id: p.id, name: p.name, x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, angle: p.angle, aim: p.aim, turret: p.turret, body: playerBody(p), utilityKind: boardedRecycler(p.id)?.kind || 'recycler', recyclerId: boardedRecycler(p.id)?.id || null, aircraftId: boardedAircraft(p.id)?.id || null, shipId: boardedShip(p.id)?.id || null, vehicleId: boardedTank(p.id)?.id || null, tankWeapon: equipped(p).weapon || 'HE', tankSecondary: equipped(p).secondary || 'APCR', deploying: !!incomingCore(p.id), guarding: isGuarding(p), ...lifeRecord(p) });
  function persist(person, changedTank = boardedTank(person.id), changedShip = boardedShip(person.id), changedBase = pilotedBase(person.id)) {
    db.exec('BEGIN IMMEDIATE');
    try { if(changedBase)saveAirbase(changedBase); if (changedShip) saveShip(changedShip); if (changedTank) saveTank(changedTank); save.run(person.x, person.y, person.angle, person.id); saveLife.run(person.id, JSON.stringify(lifeRecord(person))); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); if(changedBase)savedAirbases.delete(changedBase.id);if(changedShip)savedShips.delete(changedShip.id); throw error; }
    person.dirty = false; person.lifeDirty = false;
  }
  function snapshot() {
    syncShipyards(world);
    return { clientBuild, revision, logistics:world.logistics, room: options.roomView?.() || null, airbases:world.airbases, ships: world.ships, tanks: world.tanks, cores: world.cores, rails: world.rails, switches: world.switches, artillery: world.artillery, buildings: allBuildings(), combat: combat.snapshot(), players: [...people.values()].filter(p => streams.has(p.id)).map(playerView) };
  }
  function broadcast() {
    revision++;
    const message = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const set of streams.values()) for (const response of set) {
      // A suspended browser must not accumulate an unbounded outgoing buffer.
      if (response.writableLength > 64 * 1024) response.destroy(); else response.write(message);
    }
  }
  function guestRow(req, res) {
    const token = req.headers.cookie?.match(/(?:^|;\s*)frontier=([a-f0-9-]{36})(?:;|$)/)?.[1];
    let row = token ? db.prepare('SELECT * FROM scouts WHERE token=?').get(token) : null;
    if (!row) {
      const count = db.prepare('SELECT COUNT(*) AS n FROM scouts').get().n;
      if (count >= 2000) throw Object.assign(new Error('This prototype has reached its guest limit.'), { status: 503 });
      // An orbital identity has no ground collision or spawn-space requirement.
      const spawn = world.spawn;
      row = { token: randomUUID(), id: randomUUID(), name: `Scout ${String(count + 1).padStart(2, '0')}`, ...spawn, angle: 0 };
      db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(row.token, row.id, row.name, row.x, row.y, row.angle);
      const prior = res.getHeader('Set-Cookie') || [];
      res.setHeader('Set-Cookie', [...(Array.isArray(prior) ? prior : [prior]), `frontier=${row.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`]);
    }
    return row;
  }
  function endPlayerAccess(id, message, details) {
    options.onRevoke?.(id, message, details);
    const person = people.get(id);
    combat.cancelCharge(id); releaseGun(id);
    if (person) { person.path = []; person.input = { x: 0, y: 0 }; person.inputUntil = 0; persist(person); }
    const old = streams.get(id); streams.delete(id); people.delete(id);
    for (const response of old || []) {
      response.write(`event: ${options.campaign ? 'room-ended' : 'session-ended'}\ndata: ${JSON.stringify({ message })}\n\n`); response.end();
      setTimeout(() => response.destroy(), 1000).unref();
    }
  }
  const accounts = options.accounts || createAccounts(db, { mailer: emailDelivery, guest: guestRow, revokePlayer: endPlayerAccess, audit });
  function identity(req, res) {
    const account = accounts.account(req);
    if (accounts.hasCookie(req) && !account) throw Object.assign(new Error('Your account session has ended. Sign in again.'), { status: 401 });
    const row = account ? db.prepare('SELECT * FROM scouts WHERE id=?').get(account.player_id) : guestRow(req, res);
    if (!row) throw Object.assign(new Error('Your saved player is unavailable.'), { status: 409 });
    const actor = { id: row.id, name: row.name, accountId: account?.id || null, kind: account?.kind || 'guest', credential: account?.session_hash || row.token };
    audit.actor(actor); return actor;
  }
  function validIdentity(actor, req) {
    if (actor.accountId) { const current = accounts.account(req); return current?.id === actor.accountId && current.session_hash === actor.credential; }
    return !accounts.hasCookie(req) && db.prepare('SELECT token FROM scouts WHERE id=?').get(actor.id)?.token === actor.credential;
  }
  function session(req, res) {
    const account = accounts.account(req);
    if (accounts.hasCookie(req) && !account) throw Object.assign(new Error('Your account session has ended. Sign in again or choose Play as guest.'), { status: 401 });
    const actor = options.campaign ? req.campaignIdentity : null;
    if (options.campaign && !actor) throw Object.assign(new Error('Enter this campaign through the lobby.'), { status: 403 });
    if (actor) db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(actor.id, actor.id, actor.name, world.spawn.x, world.spawn.y, 0);
    const row = actor ? db.prepare('SELECT * FROM scouts WHERE id=?').get(actor.id) : account ? db.prepare('SELECT * FROM scouts WHERE id=?').get(account.player_id) : guestRow(req, res);
    if (!row) throw Object.assign(new Error('Your saved player is unavailable.'), { status: 409 });
    if (!options.campaign) audit.actor({ id: row.id, name: row.name, kind: account?.kind || 'guest' });
    if (!people.has(row.id)) {
      const vehicle = boardedAircraft(row.id) || boardedShip(row.id) || boardedTank(row.id) || boardedRecycler(row.id);
      people.set(row.id, { ...row, ...freshLife(), ...JSON.parse(readLife.get(row.id)?.value || '{}'), aim: vehicle?.turret ?? row.angle, turret: vehicle?.turret ?? row.angle, input: { x: 0, y: 0 }, inputUntil: 0, path: [], dirty: false, touched: Date.now() });
    }
    const person = people.get(row.id); person.touched = Date.now();
    if(world.cores.some(c=>c.owner===person.id))person.deployed=true;
    const plane=boardedAircraft(person.id), ship = boardedShip(person.id), vehicle = plane || ship || boardedTank(person.id) || boardedRecycler(person.id);
    if (vehicle) Object.assign(person, { x: vehicle.x, y: vehicle.y, angle: vehicle.angle });
    const incoming = incomingCore(person.id);
    if (incoming) Object.assign(person, coreExit(incoming));
    else if (playerBody(person) !== 'orbital' && !plane && !ship && person.life === 'active' && !canStand(world, allBuildings(), person.x, person.y, vehicle?.id, vehicle ? TANK.radius : .21)) {
      const spawn = clearSpawn(world, allBuildings());
      if (!spawn) throw Object.assign(new Error('No clear arrival space. Wait for a carriage to move.'), { status: 503 });
      Object.assign(person, spawn); persist(person);
    }
    return person;
  }
  const json = (res, status, body) => { if (options.campaign && status < 300 && res.req.method === 'POST') checkpoint(); audit.result(status, body); if (!options.campaign) flushCombatEvents(); res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  async function body(req) {
    let text = '';
    for await (const chunk of req) { text += chunk; if (text.length > 4096) throw Object.assign(new Error('Request is too large.'), { status: 413 }); }
    try {
      const data = JSON.parse(text || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
      return data;
    } catch { throw Object.assign(new Error('A JSON object is required.'), { status: 400 }); }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/auth/')) {
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
        const action = url.pathname.slice('/api/auth/'.length);
        if (req.method === 'GET' && ['status', 'inbox'].includes(action)) return json(res, 200, await accounts.handle(action, req, res));
        if (req.method !== 'POST' || ['status', 'inbox'].includes(action)) return json(res, 405, { error: 'Method not allowed.' });
        const expected = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`;
        if (!req.headers.origin || req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Use the Frontier account page to make this change.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'JSON is required.' });
        return json(res, 200, await accounts.handle(action, req, res, await body(req)));
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host))) return json(res, 403, { error: 'Use the game page to change this world.' });
        if (req.method !== 'GET' && !req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'JSON is required.' });
        const player = session(req, res);
        if (req.method === 'GET' && url.pathname === '/api/world') return json(res, 200, { world, ...snapshot(), me: playerView(player), accountKind: accounts.account(req)?.kind || null });
        if (req.method === 'GET' && url.pathname === '/api/events') {
          if ([...streams.values()].reduce((n, set) => n + set.size, 0) >= 16) return json(res, 503, { error: 'The test world is full. Try again shortly.' });
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write('retry: 2000\n\n');
          res.accountSessionHash = accounts.sessionHash(req);
          const wasDisconnected = !streams.get(player.id)?.size;
          if (!streams.has(player.id)) streams.set(player.id, new Set());
          streams.get(player.id).add(res);
          if (wasDisconnected) audit.emit('participant.connected', { ...audit.context(), cause: 'event_stream_opened' });
          broadcast();
          req.on('close', () => {
            if (closed) return;
            streams.get(player.id)?.delete(res);
            if (!streams.get(player.id)?.size) { streams.delete(player.id); combat.cancelCharge(player.id); releaseGun(player.id); player.path = []; player.inputUntil = 0; persist(player); }
            broadcast();
          });
          return;
        }
        if (req.method === 'POST') {
          const data = await body(req);
          audit.bind({ targetId: typeof data.id === 'string' ? data.id : undefined });
          // A slow request body can finish after logout, takeover or guest
          // attachment. Recheck authority immediately before mutating the world.
          const stillAuthorized = options.campaign ? options.authorized(req) && !options.frozen() : accounts.hasCookie(req)
            ? accounts.account(req)?.player_id === player.id
            : db.prepare('SELECT token FROM scouts WHERE id=?').get(player.id)?.token === player.token;
          if (options.campaign && options.authorized(req) && options.frozen()) return json(res, 409, { error: 'The campaign is paused or waiting for its owner.' });
          if (!stillAuthorized) return json(res, options.campaign ? 403 : 401, { error: 'Your session or room changed. Return to the lobby before controlling this player.' });
          if(url.pathname==='/api/recovery/orbit'){
            if(!streams.has(player.id)||player.life!=='disabled'||recoveryCores(world).length)return json(res,409,{error:'Emergency orbital recovery is available after all cores are lost.'});
            Object.assign(player,freshLife(),{deployed:false,inputUntil:0,path:[]});persist(player);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/ships/cargo'&&data.action==='drive-off'){
            const current=boardedTank(player.id)||boardedRecycler(player.id);
            if(current?.id===data.vehicleId&&world.ships.some(s=>s.lastUnloaded===data.vehicleId))return json(res,200,{saved:true});
          }
          const isMissionOrder=['/api/aircraft/mission','/api/aircraft/recall'].includes(url.pathname);
          if(boardedRecycler(player.id)&&!isMissionOrder&&!['/api/input','/api/logistics/exit','/api/logistics/bridge','/api/logistics/launch','/api/charge/cancel'].includes(url.pathname))return json(res,409,{error:'Exit your recycler before building or using weapons. Park to collect or unload.'});
          if (playerBody(player) === 'orbital' && url.pathname !== '/api/cores') return json(res, 409, { error: 'You are in orbit. Choose a landing site and deploy your core first.' });
          if (incomingCore(player.id) && !['/api/cores', '/api/charge/cancel'].includes(url.pathname)) return json(res, 409, { error: 'Deployment in progress. Controls unlock when the robot exits.' });
          if (url.pathname === '/api/revive') {
            if (!streams.has(player.id)) return json(res, 409, { error: 'Connect to the battlefield before requesting recovery.' });
            const error = beginRecovery(player, world, allBuildings(), [...groundPeople(), ...combat.snapshot().enemies], data.coreId);
            if (error) return json(res, 409, { error });
            persist(player); broadcast(); return json(res, 200, { me: playerView(player), saved: true });
          }
          if (player.life !== 'active') return json(res, 409, { error: player.life === 'arriving' ? 'Replacement pod incoming. Controls unlock on landing.' : 'Robot disabled. Choose a friendly core for recovery.' });
          const plane=boardedAircraft(player.id);
          if(plane&&!isMissionOrder&&!['/api/input','/api/drill','/api/aircraft/bomb','/api/aircraft/strafe','/api/aircraft/launch','/api/aircraft/exit','/api/charge/cancel'].includes(url.pathname))return json(res,409,{error:'Land and disembark before using ground equipment.'});
          const ship = boardedShip(player.id);
          if(ship && !isMissionOrder && !['/api/input','/api/drill','/api/ships/board','/api/ships/exit','/api/ships/fire','/api/ships/secondary','/api/ships/ammo','/api/ships/contact','/api/ships/ramp','/api/ships/depth','/api/ships/cargo','/api/charge/cancel'].includes(url.pathname))return json(res,409,{error:'Disembark at a dock before using ground equipment.'});
          if (url.pathname === '/api/vehicles/replace') {
            if (!streams.has(player.id) || playerBody(player)!=='robot' || incomingCore(player.id) || controlledBy(player.id)) return json(res,409,{error:'Return to your active robot to request a replacement.'});
            const naval = data.kind==='ship', list = naval ? world.ships : world.tanks, old = list.find(v=>v.id===data.id && v.owner===player.id);
            if (!['tank','ship'].includes(data.kind) || !old) return json(res,404,{error:'Choose your own destroyed vehicle.'});
            if (!old.destroyed) return json(res,200,{saved:true,vehicle:old});
            if (old.replacement>.001) return json(res,409,{error:'Replacement cargo is still preparing.'});
            const filtered={...world,[naval?'ships':'tanks']:list.filter(v=>v.id!==old.id)}, occupants=[...groundPeople().map(p=>({...p,body:playerBody(p)})),...combat.snapshot().enemies];
            let next,error;
            if (naval) {
              const yard=dockRecords(world).find(y=>y.id===(data.yardId||old.yardId||old.id));
              const kind=data.vesselKind||shipKind(old);
              error=yardBuildError(world,yard,player.id,kind,old,occupants);
              if(!error){next={...old,kind,ammo:kind===shipKind(old)?old.ammo:'HE',x:yard.berthX,y:yard.berthY,angle:yard.dock.angle,turret:yard.dock.angle,cargo:null,lastUnloaded:null,assemblyRemaining:SHIPYARD.buildTime,wreckRecorded:false};linkYard(next,yard);}
            } else {
              error=tankPlacementError(filtered,allBuildings(),occupants,old.podX,old.podY,player.id);
              next={...old,...tankArrivalPosition({...old,elapsed:0}),angle:Math.PI/2,turret:Math.PI/2};
            }
            if(error)return json(res,409,{error:'Original delivery site blocked: '+error});
            Object.assign(next,{elapsed:0,health:VEHICLE[data.kind],hurt:0,destroyed:false,replacement:0,occupant:null,speed:0,reload:0});
            if(naval&&next.dockDestroyed)return json(res,409,{error:'Rebuild the destroyed dock before replacing its ship.'});
            if(naval){next.repairDelay=0;next.repairing=false;next.repairTime=0;next.rampGun=newRampGun(next);resetDepth(next);next.launchRemaining=0;next.mainReloads={fore:0,aft:0};next.nextMainMount='fore';next.ramp=null;next.target=null;next.aftTurret=next.turret;next.portTurret=-Math.PI/2;next.starboardTurret=Math.PI/2;}
            const payment=purchase(naval?(shipKind(next)==='gunship'?'ship':shipKind(next)):'tank',{method:'orbital',emergency:data.emergency},next,()=>{if(naval){rememberWreck(world,old);delete world.logistics.durability['ramp:'+next.id];saveShip(next);}else saveTank(next);},naval);if(payment)return json(res,409,{error:payment});Object.assign(old,next);broadcast();return json(res,200,{saved:true,vehicle:old});
          }
          if(url.pathname==='/api/ships/recall') {
            if(!streams.has(player.id)||playerBody(player)!=='robot'||incomingCore(player.id)||controlledBy(player.id))return json(res,409,{error:'Return to your active robot before recalling a naval deployment.'});
            const vessel=world.ships.find(s=>s.id===data.id);
            if(!vessel||vessel.owner!==player.id)return json(res,403,{error:'Only the owner can recall this ship and dock.'});
            const error=recallShipError(world,vessel,groundPeople().map(p=>({...p,body:playerBody(p)})),!!data.keepYard);if(error)return json(res,409,{error});
            const before=structuredClone(world.logistics);
            db.exec('BEGIN IMMEDIATE');try{
              rememberWreck(world,vessel);
              db.prepare('DELETE FROM ships WHERE id=?').run(vessel.id);
              if(!data.keepYard){world.logistics.shipyards=world.logistics.shipyards.filter(y=>y.id!==(vessel.yardId||vessel.id));delete world.logistics.durability['dock:'+(vessel.yardId||vessel.id)];}
              delete world.logistics.durability['ramp:'+vessel.id];saveLogistics();db.exec('COMMIT');
            }catch(error){db.exec('ROLLBACK');world.logistics=before;throw error;}
            savedShips.delete(vessel.id);world.ships=world.ships.filter(s=>s.id!==vessel.id);
            broadcast();return json(res,200,{saved:true,id:vessel.id});
          }
          if(url.pathname==='/api/shipyards'){
            if(!streams.has(player.id)||playerBody(player)!=='robot'||incomingCore(player.id)||controlledBy(player.id))return json(res,409,{error:'Return to your active robot to deploy a shipyard.'});
            const previous=world.logistics.shipyards.find(y=>y.owner===player.id&&y.siteX===data.x&&y.siteY===data.y);
            if(previous)return json(res,200,{yard:previous,saved:true});
            const site=shipyardSite(world,allBuildings(),[...groundPeople(),...combat.snapshot().enemies],data.x,data.y,player.id);
            const error=site.error;if(error)return json(res,409,{error});
            const yard=yardFromShip({...site.ship,id:randomUUID()});
            const payment=purchase('shipyard',{method:'orbital'},yard,()=>world.logistics.shipyards.push(yard));if(payment)return json(res,409,{error:payment});broadcast();return json(res,201,{yard,saved:true});
          }
          if(url.pathname==='/api/shipyards/retire'){
            const yard=world.logistics.shipyards.find(y=>y.id===data.id&&y.owner===player.id);
            if(!yard||playerBody(player)!=='robot'||!streams.has(player.id))return json(res,403,{error:'Use your robot to select your own empty shipyard.'});
            if(world.ships.some(s=>(s.yardId||s.id)===yard.id)||world.logistics.jobs[yard.id])return json(res,409,{error:'Retire its vessel and finish repairs first.'});
            const error=recallShipError(world,{...yard,destroyed:true},groundPeople().map(p=>({...p,body:playerBody(p)})));if(error)return json(res,409,{error});
            world.logistics.shipyards=world.logistics.shipyards.filter(y=>y.id!==yard.id);delete world.logistics.durability['dock:'+yard.id];checkpoint();broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/ships/ramp-repair'){
            const vessel=world.ships.find(s=>s.id===data.id&&s.owner===player.id);
            if(!vessel||!streams.has(player.id)||playerBody(player)!=='robot'||!operational(vessel)||!mooredDock(world,vessel)||vessel.occupant)return json(res,409,{error:'Dock, surface and disembark to service the ramp sentry.'});
            const hp=world.logistics.durability['ramp:'+vessel.id];
            if(!vessel.rampGun?.destroyed&&(!hp||hp.health===hp.max))return json(res,200,{saved:true});
            const next={...vessel,rampGun:newRampGun(vessel)};const payment=purchase('rampRepair',{method:'orbital'},next,()=>{delete world.logistics.durability['ramp:'+vessel.id];saveShip(next);});if(payment)return json(res,409,{error:payment});Object.assign(vessel,next);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/ships/contact') {
            if(!ship||!streams.has(player.id))return json(res,409,{error:'Board a ship to request a naval contact.'});
            const error=combat.contact(ship);if(error)return json(res,409,{error});broadcast();return json(res,200,{ok:true});
          }
          if(url.pathname==='/api/ships') {
            if(!streams.has(player.id)||incomingCore(player.id)||controlledBy(player.id)||playerBody(player)!=='robot')return json(res,409,{error:'Return to your active robot to call an orbital ship.'});
            const kind=data.kind??'gunship';if(!['gunship','submarine','transport'].includes(kind))return json(res,400,{error:'Choose a gunship, submarine or armored transport.'});
            const old=world.ships.find(s=>s.owner===player.id&&shipKind(s)===kind);
            if(data.yardId){
              const yard=dockRecords(world).find(y=>y.id===data.yardId);
              const resident=world.ships.find(s=>s.owner===player.id&&(s.yardId||s.id)===data.yardId);
              if(resident&&!resident.destroyed&&shipKind(resident)===kind)return json(res,200,{ship:resident,saved:true});
              const error=yardBuildError(world,yard,player.id,kind,null,[...groundPeople(),...combat.snapshot().enemies]);if(error)return json(res,409,{error});
              const vessel={id:randomUUID(),kind,owner:player.id,x:yard.berthX,y:yard.berthY,angle:yard.dock.angle,turret:yard.dock.angle,elapsed:0,assemblyRemaining:SHIPYARD.buildTime,health:VEHICLE.ship,hurt:0,ammo:'HE',reload:0,occupant:null};
              linkYard(vessel,yard);resetDepth(vessel);vessel.rampGun=newRampGun(vessel);
              const payment=purchase(kind==='gunship'?'ship':kind,{method:'orbital'},vessel,()=>saveShip(vessel),true);if(payment)return json(res,409,{error:payment});world.ships.push(vessel);broadcast();return json(res,201,{ship:vessel,saved:true});
            }
            if(old&&(old.siteX??old.berthX-.5)===data.x&&(old.siteY??old.berthY-.5)===data.y)return json(res,200,{ship:old,saved:true});
            const site=shipSite(world,allBuildings(),[...groundPeople(),...combat.snapshot().enemies],data.x,data.y,player.id,kind,data.dockStyle||'legacy');
            const supportError=site.error;
            if(supportError)return json(res,409,{error:supportError});
            const vessel={...site.ship,id:randomUUID(),health:VEHICLE.ship,hurt:0};resetDepth(vessel);vessel.rampGun=newRampGun(vessel);const yard=yardFromShip(vessel);linkYard(vessel,yard);const payment=purchase(kind==='gunship'?'ship':kind,data,vessel,()=>{world.logistics.shipyards.push(yard);saveShip(vessel);});if(payment)return json(res,409,{error:payment});world.ships.push(vessel);broadcast();return json(res,201,{ship:vessel,saved:true});
          }
          if(url.pathname==='/api/ships/cargo') {
            if(!ship||!isTransport(ship)||!streams.has(player.id)||!operational(ship))return json(res,409,{error:'Board your ready armored transport first.'});
            if(!['load','unload','drive-off'].includes(data.action)||typeof data.vehicleId!=='string')return json(res,400,{error:'Choose a vehicle and Load or Unload.'});
            // Identical retries are durable no-ops, including after reconnect/restart.
            if(data.action==='load'&&ship.cargo?.vehicle.id===data.vehicleId)return json(res,200,{saved:true});
            if(data.action==='unload'&&!ship.cargo&&ship.lastUnloaded===data.vehicleId)return json(res,200,{saved:true});
            const occupants=[...groundPeople(),...combat.snapshot().enemies].filter(p=>p.id!==player.id);
            const cargo=data.action==='load'?transportVehicles(world).find(c=>c.vehicle.id===data.vehicleId):ship.cargo;
            if(!cargo||cargo.vehicle.id!==data.vehicleId)return json(res,409,{error:'That vehicle is not available for this transfer.'});
            if(data.action==='load'&&!canManage(cargo.vehicle.owner,player.id))return json(res,403,{error:'Only load vehicles you can manage.'});
            const error=data.action==='load'?loadError(world,allBuildings(),occupants,ship,cargo):null;
            if(error)return json(res,409,{error});
            const point=data.action!=='load'?unloadPoint(world,allBuildings(),occupants,ship,data.action==='drive-off'):null;
            if(data.action!=='load'&&!point)return json(res,409,{error:'Stop at a dock or deployed ramp with a clear vehicle-width landing area.'});
            transferVehicle(ship,cargo,player,point,data.action==='drive-off');
            broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/ships/depth') {
            if(!ship||!streams.has(player.id))return json(res,409,{error:'Board a connected submarine first.'});
            if(!['dive','surface'].includes(data.action))return json(res,400,{error:'Choose dive or surface.'});
            const error=requestDepth(ship,data.action);if(error)return json(res,409,{error});
            player.inputUntil=0;player.path=[];ship.speed=0;persist(player,null,ship);broadcast();return json(res,200,{saved:true,depth:ship.depth});
          }
          if(url.pathname==='/api/ships/ramp') {
            if(!ship||!streams.has(player.id)||!operational(ship))return json(res,409,{error:'Board a ready ship to operate its shore ramp.'});
            if(!surfaced(ship))return json(res,409,{error:'Surface fully before operating the shore ramp.'});
            if(typeof data.deployed!=='boolean')return json(res,400,{error:'Choose deploy or retract.'});
            if(data.deployed&&!ship.ramp){
              const point=shoreRampSite(world,allBuildings(),[...groundPeople(),...combat.snapshot().enemies],ship);
              if(!point)return json(res,409,{error:'No clear shore within two tiles of the hull. Sail closer to an open beach.'});
              ship.ramp={...point,shipX:ship.x,shipY:ship.y,shipAngle:ship.angle};
            }else if(!data.deployed)ship.ramp=null;
            ship.speed=0;player.inputUntil=0;player.path=[];persist(player,null,ship);broadcast();return json(res,200,{saved:true,ramp:ship.ramp});
          }
          if(url.pathname==='/api/ships/board') {
            if(ship?.id===data.id)return json(res,200,{saved:true});
            const vessel=world.ships.find(s=>s.id===data.id),dock=vessel&&boardingPoint(world,vessel,allBuildings(),player);
            if(!streams.has(player.id)||playerBody(player)!=='robot'||incomingCore(player.id)||controlledBy(player.id))return json(res,409,{error:'Approach a dock or deployed shore ramp with your active robot.'});
            if(!vessel||constructing(vessel.id)||!operational(vessel)||vessel.occupant||!dock)return json(res,409,{error:'The ship must be unoccupied at a dock or deployed shore ramp.'});
            if(Math.hypot(player.x-dock.x,player.y-dock.y)>SHIP.boardRange||!canStand(world,allBuildings(),dock.x,dock.y))return json(res,409,{error:'Approach the clear shoreline boarding point.'});
            vessel.target=null;vessel.occupant=player.id;Object.assign(player,{x:vessel.x,y:vessel.y,angle:vessel.angle,turret:vessel.turret,aim:vessel.turret,inputUntil:0,path:[]});combat.cancelCharge(player.id);persist(player,null,vessel);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/ships/exit') {
            if(!ship)return json(res,200,{saved:true});
            if(!surfaced(ship))return json(res,409,{error:'Surface fully before disembarking.'});const dock=boardingPoint(world,ship,allBuildings());
            if(!dock||!canStand(world,allBuildings(),dock.x,dock.y)||[...groundPeople(),...combat.snapshot().enemies].some(p=>p.id!==player.id&&p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&Math.hypot(p.x-dock.x,p.y-dock.y)<.8))return json(res,409,{error:'Return to a dock or deploy the shore ramp near clear land. Keep the shore exit clear.'});
            ship.occupant=null;ship.speed=0;Object.assign(player,{x:dock.x,y:dock.y,inputUntil:0,path:[],vx:0,vy:0});persist(player,null,ship);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/ships/secondary') {
            if(!ship||!streams.has(player.id))return json(res,409,{error:'Board a ship before firing its side guns.'});
            const result=combat.navalSecondary(ship,data,allBuildings());if(result.error)return json(res,400,result);
            ship.target={x:data.x,y:data.y};if(result.fired)broadcast();return json(res,200,result);
          }
          if(url.pathname==='/api/ships/ammo'||url.pathname==='/api/ships/fire') {
            if(!ship||!streams.has(player.id))return json(res,409,{error:'Board a ship before operating its cannon.'});
            if(url.pathname.endsWith('/ammo')) {if(!['HE','INCENDIARY','GAS'].includes(data.ammo))return json(res,400,{error:'Choose HE, Fire or Gas.'});ship.ammo=data.ammo;saveShip(ship);broadcast();return json(res,200,{saved:true});}
            if(![data.x,data.y].every(Number.isFinite)||data.x<0||data.y<0||data.x>=world.width||data.y>=world.height)return json(res,400,{error:'Aim inside the battlefield.'});
            if(isSubmarine(ship)){
              if(data.rotated!==undefined&&typeof data.rotated!=='boolean')return json(res,400,{error:'Choose a valid area orientation.'});
              const error=combat.submarineStrike(ship,data,!!data.rotated);if(error)return json(res,409,{error});
              player.inputUntil=0;ship.speed=0;saveShip(ship);if(combat.snapshot().naval.count===0)combat.contact(ship);broadcast();return json(res,200,{ok:true});
            }
            const target=shipSolution(ship,data);if(!target.inRange)return json(res,409,{error:'Naval cannon range is 6 to 40 tiles.'});
            const error=combat.navalSalvo(ship,data,data.mode??'volley');if(error)return json(res,409,{error});
            saveShip(ship);if(combat.snapshot().naval.count===0)combat.contact(ship);broadcast();return json(res,200,{ok:true});
          }
          const vehicle = boardedTank(player.id);
          if (vehicle && !['/api/fire', '/api/input', '/api/drill', '/api/charge/cancel', '/api/tank-weapon', '/api/tanks/board', '/api/tanks/exit'].includes(url.pathname)) return json(res, 409, { error: 'Exit your tank before building or operating a facility.' });
          if(url.pathname.startsWith('/api/logistics/')){
            if(!streams.has(player.id)||!['robot','recycler'].includes(playerBody(player))||controlledBy(player.id))return json(res,409,{error:'Use logistics from your connected robot or recycler.'});
            const l=world.logistics;
            if(url.pathname==='/api/logistics/board'){
              const truck=l.recyclers.find(r=>r.id===data.id);
              if(playerBody(player)!=='robot'||!truck||constructing(truck.id)||truck.remaining>0||truck.occupant||Math.hypot(player.x-truck.x,player.y-truck.y)>RECYCLER.boardRange)return json(res,409,{error:'Approach an unoccupied, ready recycler within 1.8 tiles.'});
              truck.occupant=player.id;truck.path=[];truck.task=null;truck.collecting=0;truck.idle=0;truck.blocked=false;
              Object.assign(player,{x:truck.x,y:truck.y,angle:truck.angle,inputUntil:0,path:[],dirty:true});combat.cancelCharge(player.id);checkpoint();broadcast();return json(res,200,{saved:true});
            }
            if(url.pathname==='/api/logistics/exit'){
              const truck=boardedRecycler(player.id);if(!truck)return json(res,409,{error:'You are not driving a recycler.'});
              const point=recyclerExit(world,allBuildings(),truck,[...groundPeople(),...combat.snapshot().enemies]);if(!point)return json(res,409,{error:'No clear exit. Drive to open ground first.'});
              truck.occupant=null;truck.speed=0;truck.task=null;truck.collecting=0;truck.idle=0;Object.assign(player,point,{inputUntil:0,path:[],dirty:true});checkpoint();broadcast();return json(res,200,{saved:true});
            }
            if(url.pathname==='/api/logistics/bridge'){
              const truck=boardedRecycler(player.id);
              if(!isBuilder(truck)||truck.remaining>0)return json(res,409,{error:'Board a ready bridge builder first.'});
              const same=l.bridges.find(b=>b.builderId===truck.id&&b.from.x===data.from?.x&&b.from.y===data.from?.y&&b.to.x===data.to?.x&&b.to.y===data.to?.y);
              if(same)return json(res,200,{saved:true,bridge:same});
              if(l.bridges.some(b=>b.builderId===truck.id&&!bridgeReady(b)))return json(res,409,{error:'Finish the current bridge first.'});
              const error=bridgeError(world,allBuildings(),[...groundPeople(),...combat.snapshot().enemies],truck,data.from,data.to);if(error)return json(res,409,{error});
              const price=bridgeCost(data);if(l.groundSupplies<price)return json(res,409,{error:'Need '+price+' ground SUP for this crossing.'});
              const bridge={id:randomUUID(),owner:player.id,builderId:truck.id,from:{x:data.from.x,y:data.from.y},to:{x:data.to.x,y:data.to.y},elapsed:0,cost:price};
              l.groundSupplies-=price;l.bridges.push(bridge);truck.path=[];truck.task=null;truck.speed=0;player.inputUntil=0;try{checkpoint();}catch(error){l.groundSupplies+=price;l.bridges=l.bridges.filter(b=>b!==bridge);throw error;}broadcast();return json(res,201,{saved:true,bridge});
            }
            if(url.pathname==='/api/logistics/deploy'){

              const kind=data.kind,size=LOGISTICS_SIZE[kind],utilityFleet=[...l.recyclers,...carriedVehicles(world).filter(c=>c.kind==='utility').map(c=>c.vehicle)];
              if(!Object.hasOwn(LOGISTICS_SIZE,kind))return json(res,400,{error:'Choose a factory, launch station or recycler.'});
              if(['recycler','builder'].includes(kind)&&(utilityFleet.some(r=>r.owner===player.id&&(r.kind||'recycler')===kind)||utilityFleet.filter(r=>(r.kind||'recycler')===kind).length>=ECONOMY.maxRecyclers))return json(res,409,{error:'One of each utility vehicle per scout; four of each per room.'});
              if(!['recycler','builder'].includes(kind)&&l.facilities.length>=ECONOMY.maxFacilities)return json(res,409,{error:'Twelve construction facilities per room.'});
              if(![data.x,data.y].every(Number.isInteger))return json(res,400,{error:'Choose a tile.'});
              for(let y=data.y;y<data.y+size;y++)for(let x=data.x;x<data.x+size;x++){
                const error=placementError(world,allBuildings(),[...groundPeople(),...combat.snapshot().enemies,...l.recyclers],x,y);
                if(error)return json(res,409,{error});
              }
              const object={id:randomUUID(),owner:player.id,kind,x:data.x,y:data.y,remaining:8,cargo:0,launch:0};
              if(['recycler','builder'].includes(kind))Object.assign(object,{x:data.x+.5,y:data.y+.5,remaining:4.5,angle:0,task:null,path:[],collecting:0});
              const payment=purchase(kind,data,object,()=>{(['recycler','builder'].includes(kind)?l.recyclers:l.facilities).push(object);});
              if(payment)return json(res,409,{error:payment});broadcast();return json(res,201,{saved:true,facility:object});
            }
            if(url.pathname==='/api/logistics/command'){
              const truck=l.recyclers.find(r=>r.id===data.id&&canManage(r.owner,player.id));
              if(!truck||isBuilder(truck)||constructing(truck.id)||truck.remaining>0||truck.occupant)return json(res,409,{error:'Choose your ready, unoccupied recycler. Exit before issuing remote orders.'});
              if(data.action==='stop'){truck.path=[];truck.task=null;truck.collecting=0;checkpoint();broadcast();return json(res,200,{saved:true});}
              const target=data.action==='collect'?(world.sites||[]).find(s=>s.id===data.targetId&&s.state==='conquered')
                :data.action==='deliver'?salvageReceivers(world).find(f=>f.id===data.targetId)
                :data.action==='recover'?l.crates.find(c=>c.id===data.targetId):null;
              if(!target)return json(res,409,{error:'Choose conquered ruins, a cargo crate or a ready launch station.'});
              if(data.action==='collect'&&((l.salvage[target.id]??ECONOMY.salvage)<=0||truck.cargo>=ECONOMY.cargo))return json(res,409,{error:'Ruins exhausted or recycler cargo full.'});
              if(data.action==='deliver'&&!truck.cargo)return json(res,409,{error:'Collect cargo before delivering.'});
              const center=data.action==='recover'?target:data.action==='collect'?{x:target.x+1.5,y:target.y+1.5}:target.center||facilityCenter(target);
              const choices=[];for(let y=Math.floor(center.y)-3;y<=center.y+3;y++)for(let x=Math.floor(center.x)-3;x<=center.x+3;x++){
                if(Math.hypot(x+.5-center.x,y+.5-center.y)<=3.5&&canStand(world,allBuildings(),x+.5,y+.5)&&!l.recyclers.some(r=>r.id!==truck.id&&Math.hypot(r.x-x-.5,r.y-y-.5)<1))choices.push({x:x+.5,y:y+.5});
              }
              choices.sort((a,b)=>Math.hypot(a.x-truck.x,a.y-truck.y)-Math.hypot(b.x-truck.x,b.y-truck.y));
              let route;for(const goal of choices.slice(0,16)){route=findPath(world,allBuildings(),truck,goal);if(route)break;}
              if(!route)return json(res,409,{error:'No clear land route to that site. Clear an approach first.'});
              truck.blocked=false;truck.path=route;truck.task={action:data.action,id:target.id};truck.collecting=0;checkpoint();broadcast();return json(res,200,{saved:true});
            }
            if(url.pathname==='/api/logistics/launch'){
              const station=l.facilities.find(f=>f.id===data.id&&f.kind==='uplink'&&f.remaining<=0);
              if(!station)return json(res,409,{error:'Choose a ready launch station.'});
              if(station.launch>0)return json(res,200,{saved:true});
              if(station.cooldown>0)return json(res,409,{error:'Cargo rocket returns in '+Math.ceil(station.cooldown)+' seconds.'});
              if(!station.cargo)return json(res,409,{error:'Deliver cargo to a ready launch station first.'});
              if(l.supplies>=ECONOMY.capacity)return json(res,409,{error:'Orbital storage full. Cargo remains safe at the station.'});
              station.inFlight=station.cargo;station.cargo=0;station.cooldown=ECONOMY.rocketCycle;station.launch=ECONOMY.launchTime;checkpoint();broadcast();return json(res,200,{saved:true});
            }
            if(url.pathname==='/api/logistics/repair'){
              const object=data.kind==='dock'?dockRecords(world).find(s=>s.id===data.id&&canManage(s.owner,player.id)):data.kind==='airbase'?world.airbases.find(b=>b.id===data.id&&canManage(b.owner,player.id)):null;
              if(!object)return json(res,403,{error:'Choose your damaged dock or airbase.'});
              if(constructing(object.id)||!(data.kind==='dock'?object.dockDestroyed:object.destroyed))return json(res,409,{error:'This facility does not need a new repair order.'});
              const error=purchase(data.kind==='dock'?'dockRepair':'baseRepair',{method:'orbital'},object,()=>{l.jobs[object.id]={remaining:8,kind:'repair',repair:data.kind,cost:0};});
              if(error)return json(res,409,{error});broadcast();return json(res,200,{saved:true});
            }
            if(url.pathname==='/api/logistics/cancel'){
              const job=l.jobs[data.id],target=constructionTarget(data.id);
              if(!job||job.kind==='repair'||!target||!canManage(target.object.owner,player.id))return json(res,409,{error:'Choose your unfinished construction order.'});
              destroyFacility(target,true);checkpoint();broadcast();return json(res,200,{saved:true});
            }
            return json(res,404,{error:'Unknown logistics action.'});
          }
          if(isMissionOrder){
            if(!streams.has(player.id))return json(res,409,{error:'Connect to the battlefield before issuing air orders.'});
            const base=world.airbases.find(b=>b.id===data.id);if(!base)return json(res,404,{error:'Choose an existing airbase.'});
            if(url.pathname.endsWith('/recall')){abortMission(base.aircraft);checkpoint();broadcast();return json(res,200,{saved:true});}
            if(typeof data.orderId!=='string'||! /^[a-zA-Z0-9-]{8,64}$/.test(data.orderId))return json(res,400,{error:'A mission request identifier is required.'});
            if(base.aircraft.mission?.id===data.orderId)return json(res,200,{saved:true,mission:base.aircraft.mission});
            const plan=strikePlan(world,data.target,data.bearing),error=missionError(world,base)||plan.error||validateMission(world,base,plan);
            if(error)return json(res,409,{error});
            const previous=structuredClone(base.aircraft);assignMission(base,plan,data.orderId,player.id);base.aircraft.mission.context=audit.context();
            try{checkpoint();}catch(e){base.aircraft=previous;throw e;}
            broadcast();return json(res,201,{saved:true,mission:base.aircraft.mission});
          }
          if(url.pathname==='/api/airbases'){

            if(!streams.has(player.id)||playerBody(player)!=='robot'||incomingCore(player.id)||controlledBy(player.id))return json(res,409,{error:'Deploy an airbase from your active robot.'});
            if(data.kind!==undefined&&!['bomber','attack-jet'].includes(data.kind))return json(res,400,{error:'Choose a bomber or attack jet.'});
            const old=world.airbases.find(b=>b.owner===player.id);if(old&&old.x===data.x&&old.y===data.y)return json(res,200,{saved:true,airbase:old});
            const error=airbaseError(world,allBuildings(),[...groundPeople(),...combat.snapshot().enemies],data.x,data.y,player.id);if(error)return json(res,409,{error});
            const base=newAirbase(randomUUID(),player.id,data.x,data.y,data.kind||'bomber');if(data.kind==='attack-jet')deliverAircraft(base,'attack-jet');const payment=purchase('airbase',data,base,()=>saveAirbase(base));if(payment)return json(res,409,{error:payment});world.airbases.push(base);broadcast();return json(res,201,{saved:true,airbase:base});
          }
          if(url.pathname==='/api/aircraft/deliver'){
            const base=world.airbases.find(b=>b.id===data.id);
            if(!streams.has(player.id)||playerBody(player)!=='robot'||incomingCore(player.id)||controlledBy(player.id)||!base||base.owner!==player.id)return json(res,409,{error:'Call a replacement from your robot to your own airbase.'});
            if(base.aircraft.state==='delivering'&&base.aircraft.kind===data.kind)return json(res,200,{saved:true});
            if(base.destroyed||constructing(base.id))return json(res,409,{error:'Rebuild the airbase before requesting aircraft.'});
            const next=structuredClone(base);
            if(next.aircraft.state==='destroyed'){if(next.aircraft.remaining>.001)return json(res,409,{error:'Replacement cargo is preparing.'});next.aircraft=newAirbase(base.id,base.owner,base.x,base.y,data.kind).aircraft;}
            const error=deliverAircraft(next,data.kind);if(error)return json(res,409,{error});
            const payment=purchase('aircraft',{method:'orbital'},next,()=>saveAirbase(next));if(payment)return json(res,409,{error:payment});Object.assign(base,next);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/aircraft/board'){
            const base=world.airbases.find(b=>b.id===data.id),gate=base&&airbaseGate(base);
            if(!streams.has(player.id)||playerBody(player)!=='robot'||incomingCore(player.id)||controlledBy(player.id)||!base||base.destroyed||constructing(base.id)||base.aircraft.occupant||Math.hypot(player.x-gate.x,player.y-gate.y)>1.8)return json(res,409,{error:'Approach the airbase boarding apron with your robot. One pilot at a time.'});
            const error=launchAircraft(base.aircraft);if(error)return json(res,409,{error});
            base.aircraft.occupant=player.id;Object.assign(player,{x:base.aircraft.x,y:base.aircraft.y,angle:0,inputUntil:0,path:[]});combat.cancelCharge(player.id);persist(player);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/aircraft/launch'||url.pathname==='/api/aircraft/bomb'||url.pathname==='/api/aircraft/strafe'){
            if(!plane||!streams.has(player.id))return json(res,409,{error:'Board a connected aircraft first.'});
            const error=url.pathname.endsWith('/strafe')?combat.strafe(plane):url.pathname.endsWith('/bomb')?combat.bombRun(plane):launchAircraft(plane);if(error)return json(res,409,{error});
            persist(player);broadcast();return json(res,200,{saved:true});
          }
          if(url.pathname==='/api/aircraft/exit'){
            if(!plane)return json(res,200,{saved:true});
            if(!streams.has(player.id)||plane.state!=='parked')return json(res,409,{error:'Return slowly to your airbase and land before disembarking.'});
            const base=pilotedBase(player.id),gate=airbaseGate(base);
            if(!canStand(world,allBuildings(),gate.x,gate.y)||[...groundPeople(),...combat.snapshot().enemies].some(p=>p.id!==player.id&&p.life!=='disabled'&&(p.hp===undefined||p.hp>0)&&!boardedAircraft(p.id)&&Math.hypot(p.x-gate.x,p.y-gate.y)<.8))return json(res,409,{error:'Keep the boarding apron clear before disembarking.'});
            // Keep the occupied seat until persist has atomically saved both records.
            Object.assign(player,{...gate,angle:0,inputUntil:0,path:[]});
            db.exec('BEGIN IMMEDIATE');try{plane.occupant=null;saveAirbase(base);save.run(player.x,player.y,player.angle,player.id);saveLife.run(player.id,JSON.stringify(lifeRecord(player)));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');savedAirbases.delete(base.id);plane.occupant=player.id;throw e;}
            broadcast();return json(res,200,{saved:true});
          }
          if (url.pathname === '/api/tanks') {
            if (!streams.has(player.id) || incomingCore(player.id) || controlledBy(player.id) || playerBody(player) !== 'robot') return json(res, 409, { error: 'Deploy your core and return to your active robot before calling a tank.' });
            const old = world.tanks.find(t => t.owner === player.id);
            if (old && !data.emergency && old.podX === data.x && old.podY === data.y) return json(res, 200, { tank: old, saved: true });
            const tankWorld = data.emergency && old?.destroyed ? {...world,tanks:world.tanks.filter(t=>t!==old)} : world;
            const error = tankPlacementError(tankWorld, allBuildings(), [...groundPeople(), ...combat.snapshot().enemies], data.x, data.y, player.id);
            if (error) return json(res, 409, { error });
            const tank = { health:VEHICLE.tank,hurt:0,id: data.emergency&&old?.destroyed?old.id:randomUUID(), owner: player.id, podX: data.x, podY: data.y, elapsed: 0, x: data.x + .5, y: data.y + .5, angle: Math.PI / 2, turret: Math.PI / 2, occupant: null, weapon: 'HE', secondary: 'APCR' };
            const payment=purchase('tank',data,tank,()=>saveTank(tank));if(payment)return json(res,409,{error:payment});if(data.emergency&&old?.destroyed)world.tanks=world.tanks.filter(t=>t!==old);world.tanks.push(tank); broadcast(); return json(res, 201, { tank, saved: true });
          }
          if (url.pathname === '/api/tanks/board') {
            const tank = world.tanks.find(t => t.id === data.id);
            if (vehicle?.id === data.id) return json(res, 200, { saved: true });
            if (!streams.has(player.id) || vehicle || incomingCore(player.id) || controlledBy(player.id) || playerBody(player) !== 'robot') return json(res, 409, { error: 'Approach the tank with your active robot.' });
            if (!tank || constructing(tank.id) || !operational(tank) || tank.occupant) return json(res, 409, { error: 'This tank is arriving or already occupied.' });
            if (Math.hypot(player.x - tank.x, player.y - tank.y) > TANK.boardRange) return json(res, 409, { error: 'Move within 1.8 tiles of the tank to board.' });
            tank.occupant = player.id;
            Object.assign(player, { x: tank.x, y: tank.y, angle: tank.angle, turret: tank.turret, aim: tank.turret, inputUntil: 0, path: [] });
            combat.cancelCharge(player.id); persist(player, tank); broadcast(); return json(res, 200, { saved: true });
          }
          if (url.pathname === '/api/tanks/exit') {
            if (!vehicle) return json(res, 200, { saved: true });
            const occupants = groundPeople().filter(p => p.id !== player.id).concat(combat.snapshot().enemies.filter(e => e.hp > 0));
            const offsets = [[1.1,0],[-1.1,0],[0,1.1],[0,-1.1],[1.1,1.1],[-1.1,1.1],[1.1,-1.1],[-1.1,-1.1]];
            const exitBuildings = allBuildings();
            const clearPassage = p => Array.from({length:16},(_,i)=>(i+1)/16).every(t => canStand(world,exitBuildings,vehicle.x+(p.x-vehicle.x)*t,vehicle.y+(p.y-vehicle.y)*t,vehicle.id));
            const point = offsets.map(([dx,dy]) => ({x:vehicle.x+dx,y:vehicle.y+dy})).find(p => canStand(world,exitBuildings,p.x,p.y) && clearPassage(p) && !occupants.some(o => o.life !== 'disabled' && Math.hypot(o.x-p.x,o.y-p.y)<.8));
            if (!point) return json(res, 409, { error: 'No clear exit beside the tank. Move to open ground first.' });
            vehicle.occupant = null; combat.cancelCharge(player.id);
            Object.assign(player, point, { inputUntil:0,path:[],vx:0,vy:0 }); persist(player, vehicle); broadcast(); return json(res, 200, { saved: true });
          }
          if (url.pathname.startsWith('/api/rail') || url.pathname.startsWith('/api/artillery') || url.pathname === '/api/missiles') {
            if (!streams.has(player.id) || incomingCore(player.id)) return json(res, 409, { error: 'Connect with an active body before using the railway.' });
            if (controlledBy(player.id) && ['/api/rails', '/api/rails/remove', '/api/artillery', '/api/missiles'].includes(url.pathname)) return json(res, 409, { error: 'Release the facility before building or removing rails.' });
            const occupants = [...groundPeople(), ...combat.snapshot().enemies];
            if (url.pathname === '/api/rails/switch') {
              const rail = world.rails.find(r => r.x === data.x && r.y === data.y && isCurve(r));
              if (!rail) return json(res, 404, { error: 'Select an existing broad curve.' });
              const state = switchAt(world, rail);
              if (!state && !canManage(rail.owner, player.id)) return json(res, 403, { error: 'Only the curve owner can install its junction switch.' });
              if (!['curve', 'straight'].includes(data.route)) return json(res, 400, { error: 'Choose straight or curve.' });
              if (state?.route === data.route) return json(res, 200, { saved: true });
              if (switchLocked(world, rail)) return json(res, 409, { error: 'Junction locked. Move every cannon completely clear of its turning apron first.' });
              const error = switchConnectionError(world, rail, data.route) || (!state && (switchConnectionError(world, rail, 'straight') || switchConnectionError(world, rail, 'curve')));
              if (error) return json(res, 409, { error });
              db.prepare('INSERT INTO rail_switches VALUES (?,?,?) ON CONFLICT(x,y) DO UPDATE SET route=excluded.route').run(rail.x, rail.y, data.route);
              if (state) state.route = data.route; else world.switches.push({ x: rail.x, y: rail.y, route: data.route });
              broadcast(); return json(res, 200, { saved: true });
            }
            if (url.pathname === '/api/rails') {
              const length = data.length ?? 5, error = railError(world, allBuildings(), data.x, data.y, data.shape, length, player.id);
              if (error) return json(res, 409, { error });
              const additions = railSegment(data.x, data.y, data.shape, length).map(r => {
                const old = world.rails.find(t => t.x === r.x && t.y === r.y);
                return { ...r, shape: joinedShape(old, r.shape), owner: old?.owner || player.id };
              }).filter(r => !world.rails.some(t => t.x === r.x && t.y === r.y && t.shape === r.shape));
              db.exec('BEGIN IMMEDIATE');
              try { for (const r of additions) db.prepare('INSERT INTO rails VALUES (?,?,?,?) ON CONFLICT(x,y) DO UPDATE SET shape=excluded.shape').run(r.x, r.y, r.shape, r.owner); db.exec('COMMIT'); }
              catch (error) { db.exec('ROLLBACK'); throw error; }
              for (const r of additions) { const old = world.rails.find(t => t.x === r.x && t.y === r.y); if (old) old.shape = r.shape; else world.rails.push(r); }
              broadcast(); return json(res, 201, { saved: true });
            }
            if (url.pathname === '/api/rails/remove') {
              const rail = world.rails.find(r => r.x === data.x && r.y === data.y);
              if (!rail || !canManage(rail.owner, player.id)) return json(res, 403, { error: 'Only the rail owner can remove it.' });
              if (world.rails.some(r => isCurve(r) && switchAt(world, r) && insideBounds(curveBounds(r), rail.x, rail.y) && switchLocked(world, r))) return json(res, 409, { error: 'Junction locked. Clear its turning apron before removing track.' });
              if (artilleryBlocks(world, rail.x, rail.y)) return json(res, 409, { error: 'Move the carriage clear before removing this rail.' });
              db.exec('BEGIN IMMEDIATE');
              try { db.prepare('DELETE FROM rail_switches WHERE x=? AND y=?').run(rail.x, rail.y); db.prepare('DELETE FROM rails WHERE x=? AND y=?').run(rail.x, rail.y); db.exec('COMMIT'); }
              catch (error) { db.exec('ROLLBACK'); throw error; }
              world.rails = world.rails.filter(r => r !== rail); world.switches = world.switches.filter(s => s.x !== rail.x || s.y !== rail.y);
              broadcast(); return json(res, 200, { saved: true });
            }
            if (url.pathname === '/api/missiles') {
              const old = world.artillery.find(g => isMissile(g) && g.owner === player.id);
              if (old && old.x === data.x && old.y === data.y) return json(res, 200, { gun: old, saved: true });
              const error = missilePlacementError(world, allBuildings(), occupants, data.x, data.y, player.id);
              if (error) return json(res, 409, { error });
              const gun = { id: randomUUID(), kind: 'missile', owner: player.id, x: data.x, y: data.y, ammo: 'HE', rotated: false, reload: 0, target: null, operator: null, lease: 0 };
              const payment=purchase('missile',data,gun,()=>saveGun(gun));if(payment)return json(res,409,{error:payment});world.artillery.push(gun); broadcast(); return json(res, 201, { gun, saved: true });
            }
            if (url.pathname === '/api/artillery') {
              const old = world.artillery.find(g => !isMissile(g) && g.owner === player.id);
              if (old) return json(res, old.x === data.x && old.y === data.y ? 200 : 409, old.x === data.x && old.y === data.y ? { gun: old } : { error: 'One railway cannon per scout in this field test.' });
              if (world.artillery.filter(g => !isMissile(g)).length >= RAIL.maxGuns) return json(res, 409, { error: 'This island has reached its eight-cannon limit.' });
              const rail = world.rails.find(r => r.x === data.x && r.y === data.y);
              const error = carriageError(world, allBuildings(), occupants, data.x, data.y, rail?.shape);
              if (error) return json(res, 409, { error });
              const gun = { id: randomUUID(), owner: player.id, x: data.x, y: data.y, shape: rail.shape, angle: Math.PI / 2, aim: Math.PI / 2, elevation: RAIL.defaultElevation, target: null, move: null, brace: RAIL.braceTime, reload: 0, operator: null, lease: 0, input: null, inputTime: 0 };
              const payment=purchase('artillery',data,gun,()=>saveGun(gun));if(payment)return json(res,409,{error:payment});world.artillery.push(gun); broadcast(); return json(res, 201, { gun, saved: true });
            }
            const gun = world.artillery.find(g => g.id === data.id);
            if (gun && constructing(gun.id)) return json(res,409,{error:'Factory construction in progress.'});
            if (!gun) return json(res, 404, { error: 'Select a railway cannon.' });
            if (url.pathname === '/api/artillery/control') {
              if (data.release) { audit.bind({ reason: gun.operator === player.id ? 'control_released' : 'already_released' }); if (gun.operator === player.id) releaseGun(player.id); }
              else {
                if (gun.operator && gun.operator !== player.id) return json(res, 409, { error: 'Another scout is operating this cannon.' });
                audit.bind({ reason: 'control_acquired' }); releaseGun(player.id); gun.operator = player.id; gun.lease = RAIL.leaseTime; player.inputUntil = 0; player.path = []; player.vx = 0; player.vy = 0;
              }
              broadcast(); return json(res, 200, { ok: true });
            }
            if (gun.operator !== player.id) return json(res, 403, { error: 'Take control of the cannon first.' });
            gun.lease = RAIL.leaseTime;
            let error;
            if (isMissile(gun) && url.pathname !== '/api/artillery/command') {
              if (url.pathname === '/api/artillery/rotate') {
                if (typeof data.rotated !== 'boolean') return json(res, 400, { error: 'Choose a target-area orientation.' });
                gun.rotated = data.rotated;
              } else if (url.pathname === '/api/artillery/fire') {
                // Fire carries the exact displayed point, avoiding a race with the aim heartbeat.
                const target = data.target || gun.target, rotated = data.rotated ?? gun.rotated;
                if (typeof rotated !== 'boolean') return json(res, 400, { error: 'Choose a target-area orientation.' });
                const error = missileFireError(gun, world, target, rotated, combat.snapshot().barrages, combat.snapshot().fields, combat.snapshot().salvos);
                if (error) return json(res, 409, { error });
                gun.target = missileAim(gun, world, target, rotated); gun.rotated = rotated;
                gun.reload = MISSILE.reload + (MISSILE.count - 1) * MISSILE.interval;
                saveGun(gun); combat.barrage(gun, gun.target, rotated);
              } else if (url.pathname === '/api/artillery/ammo' && ['HE', 'INCENDIARY', 'GAS'].includes(data.ammo)) gun.ammo = data.ammo;
              else return json(res, 409, { error: 'Fixed battery: choose HE, Fire or Gas, aim an area, rotate it or fire.' });
              saveGun(gun); broadcast(); return json(res, 200, { ok: true, saved: true });
            }
            if (url.pathname === '/api/artillery/command') {
              if (![data.x, data.y].every(v => [-1, 0, 1].includes(v)) || !data.target || ![data.target.x, data.target.y].every(Number.isFinite) || data.target.x < 0 || data.target.y < 0 || data.target.x >= world.width || data.target.y >= world.height) return json(res, 400, { error: 'Choose a direction and a target inside the battlefield.' });
              const aimChanged = gun.target?.x !== data.target.x || gun.target?.y !== data.target.y;
              gun.target = { x: data.target.x, y: data.target.y };
              gun.input = { mode: 'pointer', x: data.x, y: data.y }; gun.inputTime = RAIL.inputTime;
              if (aimChanged) broadcast();
              return json(res, 200, { ok: true });
            } else if (url.pathname === '/api/artillery/input') {
              if (![data.traverse, data.elevate].every(v => [-1, 0, 1].includes(v))) return json(res, 400, { error: 'Choose a cannon direction: -1, 0 or 1.' });
              gun.input = { traverse: data.traverse, elevate: data.elevate }; gun.inputTime = RAIL.inputTime;
              return json(res, 200, { ok: true });
            } else if (url.pathname === '/api/artillery/move') error = moveCarriage(gun, data.step, world, allBuildings(), occupants);
            else if (url.pathname === '/api/artillery/ammo') {
              if (!Object.hasOwn(ARTILLERY_SHELLS, data.ammo)) return json(res, 400, { error: 'Choose HE, incendiary or gas.' });
              gun.ammo = data.ammo;
            } else if (url.pathname === '/api/artillery/fire') {
              error = artilleryFireError(gun, world);
              const solution = artillerySolution(gun);
              if (!error) error = combat.lob({ id: gun.id, x: gun.x + .5, y: gun.y + .5 }, solution.x, solution.y, solution, gun.ammo || 'HE');
              if (!error) gun.reload = ARTILLERY_SHELLS[gun.ammo || 'HE'].cooldown / 1000;
            } else return json(res, 404, { error: 'Unknown railway action.' });
            if (error) return json(res, 409, { error });
            saveGun(gun); broadcast(); return json(res, 200, { ok: true, saved: true });
          }
          if (controlledBy(player.id) && ['/api/input', '/api/navigate', '/api/fire', '/api/cores', '/api/buildings', '/api/dismantle'].includes(url.pathname)) return json(res, 409, { error: 'Release artillery control before controlling your body or building.' });
          if (url.pathname === '/api/cores') {
            if (!streams.has(player.id)) return json(res, 409, { error: 'Connect to the battlefield before deploying.' });
            // A retry after a lost acknowledgement returns the existing core.
            const existing = world.cores.find(c => c.owner === player.id);
            if (existing && existing.x === data.x && existing.y === data.y) return json(res, 200, { core: existing, saved: true });
            const occupants = [...groundPeople(), ...combat.snapshot().enemies];
            const error = corePlacementError(world, allBuildings(), occupants, data.x, data.y, player.id);
            if (error) return json(res, 409, { error });
            const core = { id: randomUUID(), owner: player.id, x: data.x, y: data.y, elapsed: 0 };
            const exit = coreExit(core);
            const payment=purchase('core',data,core,()=>{
              db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run(core.id,core.owner,core.x,core.y,0);
              save.run(exit.x,exit.y,Math.PI/2,player.id);
            });
            if(payment)return json(res,409,{error:payment});
            world.cores.push(core); Object.assign(player, exit, { deployed:true, angle: Math.PI / 2, turret: Math.PI / 2, aim: Math.PI / 2, inputUntil: 0, path: [], dirty: false });
            broadcast(); return json(res, 201, { core, saved: true });
          }
          if (incomingCore(player.id) && ['/api/fire', '/api/input', '/api/navigate', '/api/buildings', '/api/drill'].includes(url.pathname)) return json(res, 409, { error: 'Deployment in progress. Controls unlock when the robot exits.' });
          if (url.pathname === '/api/fire' || url.pathname === '/api/drill') {
            if (!streams.has(player.id)) return json(res, 409, { error: 'Connect to the battlefield before starting combat.' });
            const choices = equipped(player), weapons = loadout(playerBody(player), choices.weapon, choices.secondary), weapon = data.weapon ?? weapons.primary;
            if (url.pathname === '/api/fire' && ![weapons.primary, weapons.secondary].includes(weapon)) return json(res, 409, { error: 'That weapon is not equipped on this body.' });
            const error = url.pathname === '/api/fire' ? combat.shoot(player, data.x, data.y, weapon, allBuildings()) : combat.start(allBuildings(), data.frontId ?? 'landing');
            if (error) return json(res, 409, { error });
            if (url.pathname === '/api/fire') player.aim = Math.atan2(data.y - player.y, data.x - player.x) + Math.PI / 2;
            combatDirty = true; return json(res, 200, { ok: true });
          }
          if (url.pathname === '/api/input') {
            if (![data.x, data.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1)) return json(res, 400, { error: 'Invalid movement.' });
            if (data.aim !== undefined && (!Number.isFinite(data.aim) || Math.abs(data.aim) > Math.PI * 2)) return json(res, 400, { error: 'Invalid aim.' });
            if (data.aim !== undefined && data.aim !== player.aim) { player.aim = data.aim; player.aimDirty = true; }
            if(ship && data.target && [data.target.x,data.target.y].every(Number.isFinite) && data.target.x>=0 && data.target.y>=0 && data.target.x<world.width && data.target.y<world.height)ship.target={x:data.target.x,y:data.target.y};
            else if(ship && data.aim!==undefined)ship.target=null;
            player.input = { x: data.x, y: data.y }; player.inputUntil = Date.now() + 400; player.path = [];
            return json(res, 200, { ok: true });
          }
          if (url.pathname === '/api/navigate') {
            if (!Number.isInteger(data.x) || !Number.isInteger(data.y)) return json(res, 400, { error: 'Select a destination tile.' });
            const route = findPath(world, allBuildings(), player, data);
            if (!route) return json(res, 409, { error: 'No land route. Choose a clear tile on this island.' });
            player.path = route; player.inputUntil = 0;
            return json(res, 200, { ok: true, path: route });
          }
          if (url.pathname === '/api/charge/cancel') { combat.cancelCharge(player.id); broadcast(); return json(res, 200, { ok: true }); }
          if (url.pathname === '/api/tank-weapon') {
            if (playerBody(player) !== 'rover' || controlledBy(player.id)) return json(res, 409, { error: 'Return to your tank to change its cannon.' });
            const secondary = data.slot === 'secondary';
            if (!(secondary ? ['APCR', 'HEAVY_FLAME'] : ['HE', 'MAGNETIC']).includes(data.weapon)) return json(res, 400, { error: 'Choose a valid tank weapon.' });
            if (!secondary) combat.cancelCharge(player.id);
            if (vehicle) { vehicle[secondary ? 'secondary' : 'weapon'] = data.weapon; saveTank(vehicle); }
            else equip('player:' + player.id, { ...equipped(player), [secondary ? 'secondary' : 'weapon']: data.weapon }); broadcast(); return json(res, 200, { saved: true });
          }
          if (url.pathname === '/api/sentry-mode') {
            const sentry = allBuildings().find(b => b.id === data.id);
            if (!sentry || !canManage(sentry.owner, player.id)) return json(res, 403, { error: 'Only the sentry owner can change its mode.' });
            if (!['APCR', 'HEAVY_FLAME'].includes(data.weapon)) return json(res, 400, { error: 'Choose machine gun or flamethrower.' });
            equip('sentry:' + sentry.id, { weapon: data.weapon }); broadcast(); return json(res, 200, { saved: true });
          }
          if (url.pathname === '/api/buildings') {
            const error = placementError(world, allBuildings(), groundPeople().filter(p => streams.has(p.id) || p.id === player.id), data.x, data.y)
              || (combat.snapshot().enemies.some(e => Math.abs(e.x - data.x - .5) < .75 && Math.abs(e.y - data.y - .5) < .75) ? 'An enemy is too close to this site.' : null);
            if (error) return json(res, 409, { error });
            const building = { id: randomUUID(), x: data.x, y: data.y, owner: player.id, created: new Date().toISOString() };
            const payment=purchase('sentry',data,building,()=>db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run(building.id,building.x,building.y,building.owner,building.created));
            if(payment)return json(res,409,{error:payment});
            buildings.push(building); broadcast();
            return json(res, 201, { building, saved: true });
          }
          if (url.pathname === '/api/dismantle') {
            const building = buildings.find(b => b.id === data.id);
            if (!building || !canManage(building.owner, player.id)) return json(res, 403, { error: 'Only the scout who placed this foundation can remove it.' });
            db.exec('BEGIN');
            try {
              db.prepare('DELETE FROM buildings WHERE id=?').run(building.id);
              db.prepare('DELETE FROM equipment WHERE id=?').run('sentry:' + building.id);
              db.exec('COMMIT');
            } catch (error) { db.exec('ROLLBACK'); throw error; }
            equipment.delete('sentry:' + building.id); buildings = buildings.filter(b => b.id !== building.id);
            broadcast();
            return json(res, 200, { saved: true });
          }
        }
        return json(res, 404, { error: 'Unknown action.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
      if (url.pathname === '/readme/' || url.pathname === '/readme') {
        const readme = await readFile(path.join(root, 'README.md'), 'utf8');
        const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>About Frontier</title><link rel="stylesheet" href="/style.css"><body class="readme-page"><main><a href="/">← Return to the island</a><h1>About this field test</h1><pre>${escapeHtml(readme)}</pre></main></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(req.method === 'HEAD' ? '' : html);
      }
      const accountPage = /^\/(login|register|account|demo-inbox|verify|forgot-password|reset-password)\/?$/.test(url.pathname);
      if (accountPage) { res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store'); }
      const lobbyPage = ['/campaigns', '/campaigns/'].includes(url.pathname) ||
        (url.pathname === '/' && !url.searchParams.has('campaign') && url.searchParams.get('legacy') !== '1');
      const relative = decodeURIComponent(accountPage ? '/account.html' : lobbyPage ? '/campaigns.html' : url.pathname === '/' ? '/index.html' : url.pathname);
      const filename = path.resolve(publicDir, `.${relative}`);
      if (!filename.startsWith(publicDir + path.sep)) return json(res, 403, { error: 'Forbidden.' });
      const info = await stat(filename);
      if (!info.isFile()) return json(res, 404, { error: 'Not found.' });
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.json': 'application/json', '.woff2': 'font/woff2' }[path.extname(filename)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': accountPage ? 'no-store' : /^(image|font)\//.test(mime) ? 'public, max-age=3600' : 'no-cache' });
      const content = req.method === 'HEAD' ? '' : await readFile(filename);
      res.end(path.basename(filename) === 'index.html' ? content.toString().replace('FRONTIER_CLIENT_BUILD', clientBuild) : content);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      if (status === 500) console.error(error);
      json(res, status, { error: status === 500 ? 'The server could not complete that action. Your last saved changes are safe.' : error.message });
    }
  });
  let lastTick = Date.now(), lastSave = Date.now(), lastSlowTick = 0, dockRepairElapsed = 0;
  const tick = setInterval(() => {
    const tickStarted = performance.now();
    const now = Date.now(), dt = Math.min((now - lastTick) / 1000, 0.15); lastTick = now;
    if (options.frozen?.()) return;
    let changed = combatDirty; combatDirty = false;
    if (streams.size) for (const core of world.cores) if (core.elapsed < CORE.duration) {
      core.elapsed = Math.min(CORE.duration, core.elapsed + dt); changed = true;
      const owner = people.get(core.owner), exit = coreExit(core);
      if (owner) Object.assign(owner, exit, { angle: Math.PI / 2, inputUntil: 0, path: [], dirty: true });
      if (core.elapsed === CORE.duration) {
        db.exec('BEGIN IMMEDIATE');
        try { saveCore.run(core.elapsed, core.id); save.run(exit.x, exit.y, Math.PI / 2, core.owner); db.exec('COMMIT'); }
        catch (error) { db.exec('ROLLBACK'); throw error; }
        if (owner) owner.dirty = false;
      }
    }
    if (streams.size) for (const tank of world.tanks) if (!constructing(tank.id)&&tank.elapsed < TANK.duration) {
      tank.elapsed = Math.min(TANK.duration, tank.elapsed + dt); Object.assign(tank, tankArrivalPosition(tank)); changed = true;
      if (tank.elapsed === TANK.duration) saveTank(tank);
    }
    if(streams.size)for(const yard of world.logistics.shipyards){
      if(constructing(yard.id)&&world.logistics.jobs[yard.id].kind!=='repair')continue;
      if(!yard.dockDestroyed&&yard.elapsed<SHIP.duration){yard.elapsed=Math.min(SHIP.duration,yard.elapsed+dt);yard.dockReady=yard.elapsed===SHIP.duration;changed=true;}
    }
    syncShipyards(world);
    if(streams.size)for(const ship of world.ships){
      if(constructing(ship.id)&&world.logistics.jobs[ship.id].kind!=='repair')continue;
      ship.speed=0;
      if(ship.assemblyRemaining>0){
        if(!ship.dockDestroyed&&!world.logistics.jobs[ship.yardId]){ship.assemblyRemaining=Math.max(0,ship.assemblyRemaining-dt);ship.elapsed=(1-ship.assemblyRemaining/(ship.assemblyDuration||SHIPYARD.buildTime))*SHIP.duration;changed=true;}
      }else if(ship.elapsed<SHIP.duration){ship.elapsed=Math.min(SHIP.duration,ship.elapsed+dt);changed=true;if(ship.elapsed===SHIP.duration){ship.dockReady=true;saveShip(ship);}}
      const previousDepth=ship.depth;
      if(tickDepth(ship,dt)){changed=true;if(previousDepth!==ship.depth)saveShip(ship);}
      if(isSubmarine(ship)){if(ship.reload>0||ship.launchRemaining>0){ship.reload=Math.max(0,ship.reload-dt);ship.launchRemaining=Math.max(0,(ship.launchRemaining||0)-dt);changed=true;if(!ship.reload)saveShip(ship);}}
      else if(tickMainReloads(ship,dt)){changed=true;if(!ship.reload)saveShip(ship);}
    }
    if(streams.size) for(const v of [...world.tanks,...world.ships]) if(v.destroyed && v.replacement>0) {v.replacement=Math.max(0,v.replacement-dt);v.timerDirty=true;if(!v.replacement)v.damageDirty=true;changed=true;}
    if(streams.size)changed=tickLogistics(dt)||changed;
    const obstacles = allBuildings();
    if(streams.size)for(const base of world.airbases){
      if(constructing(base.id)&&world.logistics.jobs[base.id].kind!=='repair')continue;
      const plane=base.aircraft,pilot=people.get(plane.occupant),before=plane.state;
      const input=pilot&&streams.has(pilot.id)&&pilot.inputUntil>now?{steer:pilot.input.x,throttle:-pilot.input.y}:null;
      if(missionActive(plane)){
        const phase=plane.mission.phase,released=plane.mission.released;
        tickMission(world,base,dt,p=>combat.bombRun(p));changed=true;
        if(phase!==plane.mission.phase||released!==plane.mission.released)checkpoint();
      }else if(tickAircraft(world,base,input,dt)){changed=true;if(before!==plane.state)saveAirbase(base);}
    }
    const recoveryOccupants = [...groundPeople(), ...combat.snapshot().enemies];
    for (const p of people.values()) {
      if (p.vx || p.vy) changed = true;
      p.vx = 0; p.vy = 0;
      if (!streams.has(p.id)) { if (now - p.touched > 60000) { if (p.dirty || p.lifeDirty) persist(p); people.delete(p.id); } continue; }
      if (playerBody(p) === 'orbital' || incomingCore(p.id)) continue;
      if (tickLife(p, dt, world, obstacles, recoveryOccupants)) changed = true;
      if (p.life !== 'active' || controlledBy(p.id)) continue;
      if (p.aimDirty) { p.aimDirty = false; changed = true; }
      const plane=boardedAircraft(p.id);
      if(plane){Object.assign(p,{x:plane.x,y:plane.y,angle:plane.angle,turret:plane.angle,vx:plane.state==='flying'?Math.sin(plane.angle)*plane.speed:0,vy:plane.state==='flying'?-Math.cos(plane.angle)*plane.speed:0,dirty:true});continue;}
      const ship=boardedShip(p.id);
      if(ship){
        const before={x:ship.x,y:ship.y,angle:ship.angle,turret:ship.turret,aftTurret:ship.aftTurret,portTurret:ship.portTurret,starboardTurret:ship.starboardTurret};
        if(p.inputUntil>now)sailStep(world,ship,p.input.x,-p.input.y,dt);
        if(!isSubmarine(ship))stepShipMounts(ship,ship.target,dt,p.aim);
        ship.speed=Math.hypot(ship.x-before.x,ship.y-before.y)/dt;
        Object.assign(p,{x:ship.x,y:ship.y,angle:ship.angle,turret:ship.turret,vx:(ship.x-before.x)/dt,vy:(ship.y-before.y)/dt});
        if(Object.keys(before).some(k=>before[k]!==ship[k])){p.dirty=true;changed=true;}continue;
      }
      const truck=boardedRecycler(p.id);
      if(truck){Object.assign(p,{x:truck.x,y:truck.y,angle:truck.angle,turret:truck.angle,vx:Math.sin(truck.angle)*(truck.speed||0),vy:-Math.cos(truck.angle)*(truck.speed||0),dirty:true});continue;}
      const vehicle = boardedTank(p.id);
      const robot = playerBody(p) === 'robot';
      const turret = turnTurret(p.turret, p.aim, dt, loadout(playerBody(p)).turnSpeed);
      if (Math.abs(turret - p.turret) > 1e-8) { p.turret = turret; changed = true; }
      if (robot && p.angle !== p.turret) { p.angle = p.turret; p.dirty = true; changed = true; }
      if (vehicle && vehicle.turret !== p.turret) { vehicle.turret = p.turret; p.dirty = true; }
      let dx = 0, dy = 0;
      if (p.inputUntil > now) { dx = p.input.x; dy = p.input.y; }
      else if (p.path.length) {
        const next = p.path[0], distance = Math.hypot(next.x - p.x, next.y - p.y);
        if (distance < 0.04) { p.path.shift(); continue; }
        dx = (next.x - p.x) / distance; dy = (next.y - p.y) / distance;
        const step = Math.min(SPEED * dt, distance);
        dx *= step / (SPEED * dt); dy *= step / (SPEED * dt);
      }
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      if (length > 1) { dx /= length; dy /= length; }
      const nx = p.x + dx * SPEED * dt, ny = p.y + dy * SPEED * dt;
      const oldX = p.x, oldY = p.y;
      let moved = false;
      const driveClear = (x, y) => canStand(world, obstacles, x, y, vehicle?.id, vehicle ? TANK.radius : .21) && (!vehicle || !groundPeople().some(other => other.id !== p.id && streams.has(other.id) && !boardedTank(other.id) && other.life === 'active' && Math.abs(other.x-x) < .65 && Math.abs(other.y-y) < .65));
      if (driveClear(nx, p.y)) { moved ||= nx !== p.x; p.x = nx; }
      if (driveClear(p.x, ny)) { moved ||= ny !== p.y; p.y = ny; }
      if (!moved) p.path = [];
      else { if (!robot) p.angle = Math.atan2(dy, dx) + Math.PI / 2; p.vx = (p.x - oldX) / dt; p.vy = (p.y - oldY) / dt; p.dirty = true; changed = true; }
    }
    for (const p of people.values()) { const tank = boardedTank(p.id); if (tank) Object.assign(tank, { x:p.x,y:p.y,angle:p.angle,turret:p.turret }); }
    // Drive into a marked loading ramp: one atomic ground-seat -> helm handoff.
    for(const p of people.values()){
      if(!streams.has(p.id)||p.life!=='active'||p.inputUntil<=now||controlledBy(p.id))continue;
      const v=boardedTank(p.id)||boardedRecycler(p.id);if(!v)continue;
      const cargo={kind:boardedTank(p.id)?'tank':'utility',vehicle:v};
      if(!canManage(v.owner,p.id))continue;
      const occupants=[...groundPeople().map(o=>({...o,body:playerBody(o)})),...combat.snapshot().enemies].filter(o=>o.id!==p.id);
      const ship=world.ships.find(s=>!constructing(s.id)&&!driveOnError(world,obstacles,occupants,s,cargo,p.id,p.input));
      if(ship){combat.cancelCharge(p.id);transferVehicle(ship,cargo,p,null,true);changed=true;}
    }
    // Movement is checkpointed; building edits are committed before their acknowledgement.
    if (now - lastSave >= 500) { for(const base of world.airbases)saveAirbase(base); for (const p of people.values()) if (p.dirty) persist(p); for (const c of world.cores) if (c.elapsed < CORE.duration) saveCore.run(c.elapsed, c.id); for (const t of world.tanks) if (t.elapsed < TANK.duration) saveTank(t); for(const s of world.ships){saveShip(s);delete s.timerDirty;} for(const v of world.tanks)if(v.timerDirty){saveTank(v);delete v.timerDirty;} lastSave = now; }
    const robots = [...people.values()].filter(p => streams.has(p.id) && playerBody(p) === 'robot' && !incomingCore(p.id));
    for (const robot of robots) robot.guarding = isGuarding(robot);
    const beforeSiteHp = world.sites.map(s => s.hp).join(',');
    if (streams.size && combat.tick(dt, obstacles, robots, groundPeople().filter(p => streams.has(p.id)).map(p => ({ ...p, body: playerBody(p), tankWeapon: equipped(p).weapon || 'HE', deploying: !!incomingCore(p.id), operating: !!controlledBy(p.id) })))) changed = true;

    for(const target of facilityTargets(world,buildings))void target; // Register newly placed facilities before the next tick.
    const lost=facilityTargets(world,buildings,true).filter(f=>f.hp.health<=0);
    if(lost.length){for(const f of lost)destroyFacility(f);changed=true;}
    if (!options.campaign) flushCombatEvents();
    // A vehicle loss and its pilot's disabled state are one durable transition.
    for(const v of [...world.tanks,...world.ships]) if(v.damageDirty) {
      delete v.damageDirty;
      const recordedWreck=v.berthX!==undefined&&rememberWreck(world,v);
      let pilot;
      const lostCargo=v.destroyed&&v.cargo;
      if(lostCargo){
        const cargo=v.cargo;v.cargo=null;v.lastUnloaded=null;
        if(cargo.kind==='tank'){const t=cargo.vehicle;Object.assign(t,{destroyed:true,health:0,occupant:null,speed:0,replacement:VEHICLE.replacement,x:t.podX+.5,y:t.podY+.5});world.tanks.push(t);}
        else delete world.logistics.durability['recycler:'+cargo.vehicle.id];
      }
      if(v.destroyed && v.occupant) {
        pilot=people.get(v.occupant);
        if(!pilot){const row=db.prepare('SELECT * FROM scouts WHERE id=?').get(v.occupant);if(row)pilot={...row,...freshLife(),...JSON.parse(readLife.get(row.id)?.value||'{}')};}
        if(pilot){pilot.shield=0;hurtRobot(pilot,Math.max(1,pilot.health));pilot.lostVehicle=v.berthX!==undefined?'ship':'tank';pilot.x=v.x;pilot.y=v.y;combat.cancelCharge(pilot.id);releaseGun(pilot.id);}
        v.occupant=null;v.speed=0;
      }
      if(lostCargo||recordedWreck)checkpoint(pilot?[pilot]:[]);
      else if(pilot) persist(pilot,v.berthX===undefined?v:null,v.berthX!==undefined?v:null);
      else if(v.berthX!==undefined)saveShip(v);else saveTank(v);
      changed=true;
    }
    let aircraftDamaged = false;
    const disabledPilots = [];
    for (const base of world.airbases) if (base.aircraft.damageDirty) {
      const p = base.aircraft; delete p.damageDirty;
      let pilot;
      if (p.state === 'destroyed' && p.occupant) {
        pilot = people.get(p.occupant);
        if (!pilot) { const row = db.prepare('SELECT * FROM scouts WHERE id=?').get(p.occupant); if (row) pilot = { ...row, ...freshLife(), ...JSON.parse(readLife.get(row.id)?.value || '{}') }; }
        if (pilot) { pilot.shield = 0; hurtRobot(pilot, Math.max(1, pilot.health)); pilot.lostVehicle = 'aircraft'; pilot.x = p.x; pilot.y = p.y; combat.cancelCharge(pilot.id); releaseGun(pilot.id); }
        p.occupant = null;
      }
      if (pilot) disabledPilots.push(pilot);
      aircraftDamaged = true; changed = true;
    }
    // Impact consumption, aircraft loss and even an offline pilot are committed
    // together, so a restart cannot replay a hit against already-reduced health.
    if (lost.length || aircraftDamaged || options.campaign && beforeSiteHp !== world.sites.map(s => s.hp).join(',')) checkpoint(disabledPilots);
    // Persist damage and recovery transitions before broadcasting; reconnecting
    // or restarting must not revive a disabled body or restore lost health.
    for (const p of people.values()) if (p.lifeDirty) persist(p);
    for (const gun of world.artillery) {
      if(constructing(gun.id))continue;
      if (gun.operator && (!streams.has(gun.operator) || people.get(gun.operator)?.life !== 'active')) { gun.operator = null; gun.lease = 0; changed = true; }
      if (streams.size && !isMissile(gun) && gun.operator && gun.input?.mode === 'pointer' && gun.inputTime > 0 && gun.lease > 0) {
        const error = !gun.move && (gun.input.x || gun.input.y) ? driveCarriage(gun, gun.input.x, gun.input.y, world, obstacles, groundPeople().filter(p => streams.has(p.id)).concat(combat.snapshot().enemies)) : null;
        if ((gun.driveBlocked || null) !== error) { gun.driveBlocked = error; changed = true; }
        if (gun.move) { saveGun(gun); changed = true; }
      }
      if (streams.size && (isMissile(gun) ? tickBattery(gun, dt) : tickCarriage(gun, dt))) { saveGun(gun); changed = true; }
    }
    // Batch dock health and its supply charge into the same saved transaction.
    if(streams.size)dockRepairElapsed+=dt;
    if(dockRepairElapsed>=.5){
      let serviced=false;
      for(const b of world.airbases)if(tickAirRepair(world,b,dockRepairElapsed))serviced=true;
      for(const s of world.ships)if(tickDockRepair(world,s,dockRepairElapsed))serviced=true;
      dockRepairElapsed=0;
      if(serviced){checkpoint();changed=true;}
    }
    if (streams.size && now - lastCheckpoint >= 500) checkpoint();
    const durationMs = Math.round(performance.now() - tickStarted);
    if (durationMs > 100 && now - lastSlowTick > 30000) {
      audit.emit('simulation.slow_tick', { campaignId, durationMs, count: streams.size, cause: 'tick_exceeded_100ms' }); lastSlowTick = now;
    }
    if (changed) broadcast();
  }, 100);
  const heartbeat = setInterval(() => {
    for (const [id, set] of streams) {
      if ([...set].some(res => res.accountSessionHash && !accounts.sessionByHash(res.accountSessionHash))) endPlayerAccess(id, 'Session expired. Sign in again.');
      else for (const res of set) res.write(': heartbeat\n\n');
    }
  }, 15000);
  let lastCheckpoint = Date.now();
  // Cargo, driver and ship are committed together. Never create two active seats.
  function transferVehicle(ship,cargo,player,point=null,drive=false){
    const oldTanks=world.tanks,oldLogistics=structuredClone(world.logistics),oldShip={...ship,cargo:ship.cargo,lastUnloaded:ship.lastUnloaded},oldPlayer={...player},deleteCount=pendingDeletes.length;
    try{
      if(!point){
        ship.cargo=structuredClone(cargo);Object.assign(ship.cargo.vehicle,{occupant:null,speed:0,path:[],task:null});ship.lastUnloaded=null;
        if(cargo.kind==='tank'){
          const floors=new Set(world.logistics.floors);for(const cell of tankPodCells(cargo.vehicle.podX,cargo.vehicle.podY))floors.add(cell.y*world.width+cell.x);world.logistics.floors=[...floors];
          world.tanks=world.tanks.filter(v=>v.id!==cargo.vehicle.id);pendingDeletes.push(['tanks',cargo.vehicle.id]);
        }else world.logistics.recyclers=world.logistics.recyclers.filter(v=>v.id!==cargo.vehicle.id);
        if(drive){ship.occupant=player.id;ship.target=null;Object.assign(player,{x:ship.x,y:ship.y,angle:ship.angle,turret:ship.turret,aim:ship.turret});}
      }else{
        const angle=drive?Math.atan2(point.x-ship.x,-(point.y-ship.y)):ship.angle;
        const vehicle={...cargo.vehicle,x:point.x,y:point.y,angle,speed:0,occupant:drive?player.id:null,path:[],task:null,collecting:0,idle:0};
        if(cargo.kind==='tank')world.tanks=[...world.tanks,vehicle];else world.logistics.recyclers.push(vehicle);
        ship.cargo=null;ship.lastUnloaded=cargo.vehicle.id;
        if(drive){ship.occupant=null;Object.assign(player,{x:point.x,y:point.y,angle,turret:vehicle.turret??angle,aim:vehicle.turret??angle});}
      }
      Object.assign(player,{inputUntil:0,input:{x:0,y:0},path:[],vx:0,vy:0});ship.speed=0;checkpoint();
    }catch(error){world.tanks=oldTanks;world.logistics=oldLogistics;Object.assign(ship,oldShip);Object.assign(player,oldPlayer);pendingDeletes.length=deleteCount;throw error;}
  }
  function checkpoint(extraPeople = []) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const p of people.values()) { save.run(p.x, p.y, p.angle, p.id); saveLife.run(p.id, JSON.stringify(lifeRecord(p))); }
      for (const p of extraPeople) { save.run(p.x, p.y, p.angle, p.id); saveLife.run(p.id, JSON.stringify(lifeRecord(p))); }
      for (const c of world.cores) saveCore.run(c.elapsed, c.id);
      for (const gun of world.artillery) saveGun(gun);
      for (const tank of world.tanks) saveTank(tank);
      for (const base of world.airbases) saveAirbase(base);
      for (const ship of world.ships) saveShip(ship);
      saveLogistics();
      for(const [id,life]of pendingLives)saveLife.run(id,JSON.stringify(life));
      for(const [table,id] of pendingDeletes)db.prepare('DELETE FROM '+table+' WHERE id=?').run(id);
      if (options.campaign) db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('combat-checkpoint-v1', JSON.stringify(combat.checkpoint()));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); savedGuns.clear(); savedShips.clear(); savedAirbases.clear(); audit.emit('checkpoint.failed', { campaignId, reason: error.code || 'storage_error' }); throw error; }
    flushCombatEvents();
    for (const p of people.values()) { p.dirty = false; p.lifeDirty = false; }
    pendingDeletes.length=0;pendingLives.clear();
    for(const {event,...details}of logisticsEvents.splice(0))audit.emit(event,{...details,campaignId,saved:true});
    lastCheckpoint = Date.now();
  }
  function stopInputs(pilot = null) {
    for (const p of people.values()) if (!pilot || p.id === pilot) {
      p.input = { x: 0, y: 0 }; p.inputUntil = 0; p.path = []; p.vx = 0; p.vy = 0; combat.cancelCharge(p.id);
      const gun = controlledBy(p.id); if (gun) { gun.input = null; gun.inputTime = 0; }
    }
  }
  function abandon(id) {
    endPlayerAccess(id, 'Guest visit ended. Contributions remain with the host.');
    for (const vehicle of [...world.tanks, ...world.ships, ...world.logistics.recyclers]) if (vehicle.occupant === id) { vehicle.occupant = null; vehicle.speed = 0; }
    for (const base of world.airbases) if (base.aircraft.occupant === id) base.aircraft.occupant = null;
    checkpoint();
  }
  async function close() {
    stopInputs(); checkpoint();
    closed = true; clearInterval(tick); clearInterval(heartbeat);
    for (const p of people.values()) if (p.dirty || p.lifeDirty) persist(p);
    for (const c of world.cores) saveCore.run(c.elapsed, c.id);
    for (const gun of world.artillery) saveGun(gun);
    for (const tank of world.tanks) saveTank(tank);
    for (const base of world.airbases) saveAirbase(base);
    for (const ship of world.ships) saveShip(ship);
    for (const set of streams.values()) for (const res of set) res.end();
    server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); if (!options.accounts) await accounts.close(); db.close();
  }
  return { server, close, db, accounts, identity, validIdentity, endPlayerAccess, checkpoint, stopInputs, abandon, broadcast, connected: id => !!streams.get(id)?.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  try {
    const app = createApp();
    app.server.once('error', async error => {
      console.error(error.code === 'EADDRINUSE'
        ? `Frontier cannot start: port ${port} is already in use. Stop the existing server before running pnpm dev again. If Frontier is already running, open http://localhost:${port}. Your saved world has not been reset.`
        : `Frontier cannot start: ${error.message}`);
      await app.close();
      process.exitCode = 1;
    });
    app.server.listen(port, '0.0.0.0', () => console.log(`Frontier is ready at http://localhost:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
  } catch (error) {
    console.error(`Frontier cannot start: ${error.message}`);
    process.exitCode = 1;
  }
}
