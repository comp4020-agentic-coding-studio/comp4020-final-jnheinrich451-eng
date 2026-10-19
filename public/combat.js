import { createDirector, tickDirector, pressureGroups, sleepEnemies, raidContacts, raidPointClear } from './encounter-director.js';
import { tankGuardStep } from './tank-guard.js';
import { mobileLaser, tickMobileLaser, cancelMobileLaser } from './mobile-laser.js';
import { airRecords } from './air-traffic.js';
import { helicopterFireError, helicopterPoint, spendHelicopterShot, HELI_CANNON, HELI_ROCKET } from './helicopter.js';
import { orbitalProfile, orbitalHazard, orderOrbital, tickOrbital } from './orbital.js';
import { createEnemyNavigator } from './enemy-navigation.js';
import { enemyProfile, canDamageEnemy, newGroundEnemy } from './enemy-profiles.js';
import { LAND_AI, landTarget, rememberTarget, targetDistance, attackGoals } from './land-ai.js';
import { frenzyActive, planFrenzy, tickFrenzy } from './frenzy.js';
import { makeOrbitalField, landOrbitalField } from './orbital-fields.js';
import { rampSentryStep } from './ramp-sentry.js';
import { addRemains, facilityTargets, facilityPoint, facilityDistance, hurtFacility } from './logistics.js';
import { tickAntiAir } from './anti-air.js';
import { tickLasers } from './laser-tower.js';
import { missileAim } from './missile.js';
import { submarineAim } from './submarine.js';
import { AIR, bombError, makeBombRun } from './aircraft.js';
import { bomberPayload, payloadProfile } from './bomber-payloads.js';
import { JET, strafeError, strafePoint } from './attack-jet.js';
import { fogRadius } from './contaminator.js';
import { ALERT, damageSites, siteDistance, tickSites, queuePressure } from './conquest.js';
import { SCANNER } from './sensors.js';
import { tickMortars } from './mortar.js';
import { reportSectorAttack, investigationPoint } from './sector-defense.js';
import { hostileAt } from './footprints.js';
import { surfaced } from './submarine-depth.js';
import { mainSalvo, mainMounts, mainReload, readyMainMounts, SIDE_MOUNTS, sideSolution } from './ship-armament.js';
import { SHIP } from './ship.js';
import { isSubmarine, SUBMARINE, submarineFireError, makeSubmarineBarrage } from './submarine.js';
import { SWIMMER, navalSpawn, swimStep, canSwim } from './naval.js';
import { hullHealth, hullDistance, hullPoint, operational, hurtVehicle } from './vehicle.js';
import { canStand, findPath, tileAt } from './world.js';
import { turnTurret, angleDelta, SENTRY_TURRET } from './turret.js';
import { HE, APCR, FLAME, WEAPONS } from './weapons.js';
import { raycast } from './raycast.js';
import { SURVIVAL, hurtRobot } from './survival.js';
import { ARTILLERY_HE, ARTILLERY_SHELLS } from './weapons.js';
import { artilleryBlocks } from './footprints.js';
import { guardStep } from './guard.js';
import { fieldCapacityError, makeField, contactField, fireBlocked, heatSpeed, lureRoute, insideField } from './hazards.js';
import { makeBarrageField, landBarrageSector, tickField, keepField } from './missile-fields.js';
import { MISSILE, MISSILE_HE, makeBarrage, inTargetBox } from './missile.js';

export { HE, APCR } from './weapons.js';
/** @param {number} distance @param {{radius:number, lethalRadius:number, damage:number, edgeDamage:number}} profile */
export function blastDamage(distance, profile = HE) {
  if (distance > profile.radius) return 0;
  if (distance <= profile.lethalRadius) return profile.damage;
  return Math.round(profile.damage - (profile.damage - profile.edgeDamage) * (distance - profile.lethalRadius) / (profile.radius - profile.lethalRadius));
}

// Transient combat simulation. Only enemy entities can receive weapon damage.
/** @param {any} world @param {any} [saved] @param {null | (() => Record<string, any>)} [auditContext] @param {string|null} [encounterSeed] */
export function createCombat(world, saved = null, auditContext = null, encounterSeed = null) {
  world.sites = saved?.sites || world.sites || [];
  const director=saved?.director?structuredClone(saved.director):encounterSeed?createDirector(encounterSeed):null;
  const damageTargets=()=>enemies.concat(director?.sleeping||[]);
  let serial = 0, now = 0, enemies = [], shells = [], impacts = [], status = 'ready', health = 100, kills = 0;
  let shots = [], marks = [], jets = [], salvos = [], fields = [], barrages = [], charges = structuredClone(saved?.tankCharges || []);
  const acidShells = structuredClone(saved?.acidShells || []);
  const flakShells = structuredClone(saved?.flakShells || []);
  const epoch = `${Date.now()}-${Math.random()}`;
  const causes = new Map(saved?.causes || []), events = [], automatic = new Map();
  let lastAutomaticSummary = 0;
  const drainEvents = () => events.splice(0);
  function track(fn) {
    return (...args) => {
      const before = serial, result = fn(...args);
      if (auditContext) for (const p of [...shells.filter(s => s.weapon === 'HE'), ...salvos, ...barrages]) if (p.id > before) {
        const context = { ...((fn===bombRun||fn===strafe||fn===helicopterFire)&&args[0].mission?.context||auditContext()), projectileId: p.id, sourceId: args[0].id, weapon: p.weapon };
        causes.set(p.id, context); events.push({ event: 'weapon.launched', ...context });
      }
      return result;
    };
  }
  function objectiveHits(projectile, hits) {
    for (const hit of hits) if (hit.kind === 'station') {
      const site = world.sites.find(s => s.id === hit.id);
      events.push({ event: hit.killed ? 'objective.conquered' : 'objective.damaged',
        ...(causes.get(projectile.id) || { kind: 'system', cause: 'unattributed_saved_projectile', projectileId: projectile.id }),
        targetId: hit.id, hp: site.hp, weapon: projectile.weapon });
    }
  }
  let navalCooldown = 0, navalStatus = 'ready';
  function contact(ship) {
    if (!operational(ship)) return 'Board a ready ship first.';
    if(!surfaced(ship))return 'Surface fully before requesting a naval contact.';
    if (navalCooldown > 0) return 'Sonar is resetting. Wait for the contact timer.';
    if (enemies.filter(e => e.kind === 'swimmer').length >= SWIMMER.max) return 'Six swimmers are already active.';
    const remaining=ALERT.globalMax-enemies.filter(e=>e.hp>0).length-world.sites.reduce((n,s)=>n+(s.pending?.points.length||0),0)-(frenzy?.phase==='warning'?frenzy.points.length:0);
    if(remaining<=0)return 'Enemy capacity is reserved. Finish the current encounter first.';
    const points = navalSpawn(world,ship,enemies).slice(0,Math.min(remaining,SWIMMER.max-enemies.filter(e=>e.kind==='swimmer').length));
    if (!points.length) return 'No reachable water approach here. Sail farther from shore.';
    for (const p of points) enemies.push({id:++serial,...p,kind:'swimmer',hp:SWIMMER.health,angle:0,path:[],reroute:0,targetId:ship.id,behavior:'hunting'});
    navalCooldown=SWIMMER.contactCooldown;navalStatus='active';return null;
  }
  let objective = { ...world.spawn, id: 'landing', label: 'Caldera landing' };
  const cooldowns = new Map(), sentryMounts = new Map(), guards = new Map();
  const navigator = createEnemyNavigator(world);
  let frenzy=structuredClone(saved?.frenzy||null);
  function startFrenzy(caller,buildings,people=[]){
    if(frenzy&&frenzy.phase!=='complete')return 'Wait for the current frenzy and recovery timer.';
    const reserved=world.sites.reduce((n,s)=>n+(s.pending?.points.length||0),0);
    const plan=planFrenzy(world,buildings,people,enemies,caller,now,'frenzy-'+(serial+1),ALERT.globalMax-enemies.filter(e=>e.hp>0).length-reserved);
    if(!plan)return 'No safe land approach. Move into a larger clear area or approach existing defenders.';
    serial++;frenzy=plan;events.push({event:'frenzy.warning',kind:'system',sourceId:frenzy.id,count:frenzy.members.length+frenzy.points.length});return null;
  }
  // Campaign checkpoints use simulation time, never wall-clock catch-up. Cosmetic
  // history and held charges are deliberately not resumed as fresh attacks.
  if (saved) {
    if (saved.version !== 1) throw new Error('Unsupported combat checkpoint.');
    ({ serial, now, enemies, shells, status, health, kills, jets, salvos, fields, barrages, navalCooldown, navalStatus, objective } = saved);
    for (const entry of saved.cooldowns) cooldowns.set(...entry);
    for (const entry of saved.sentryMounts) sentryMounts.set(...entry);
  }
  fields=fields.filter(f=>!f.orbital).concat(world.logistics?.orbitalFields||[]);
  serial=Math.max(serial,...fields.map(f=>f.id));
  function orbitalOrder(data,caller){
    const result=orderOrbital(world,data,caller,plan=>orbitalHazard(plan.payload)?fieldCapacityError(fields,salvos,plan.payload,plan.box.width*plan.box.height):null);
    if(result.order&&!result.duplicate&&orbitalHazard(result.order.payload)){
      const field=makeOrbitalField(result.order,++serial,now);result.order.fieldId=field.id;
      fields.push(field);(world.logistics.orbitalFields ||= []).push(field);
    }
    return result;
  }
  const rollbackOrbital=id=>{fields=fields.filter(f=>f.id!==id);};
  const checkpoint = () => JSON.parse(JSON.stringify({ version: 1, serial, now, sites: world.sites, ...(director?{director}:{}),
    enemies, shells, status, health, kills, jets, salvos, tankCharges:charges.filter(c=>c.tankId&&!c.cancelled), fields:fields.filter(f=>!f.orbital), barrages, acidShells, flakShells, causes: [...causes],
    navalCooldown, navalStatus, objective, frenzy, cooldowns: [...cooldowns], sentryMounts: [...sentryMounts] }));
  const frenzyRoster=()=>{
    const roster={hunter:0,breaker:0,bulwark:0,'twin-lens':0,'heavy-lens':0,...(frenzy?.source==='natural'?{swimmer:0}:{})};if(!frenzy)return roster;
    for(const e of enemies)if(e.hp>0&&frenzy.members.includes(e.id))roster[Object.hasOwn(roster,e.kind)?e.kind:'hunter']++;
    if(frenzy.phase==='warning')for(const p of frenzy.points)roster[Object.hasOwn(roster,p.kind)?p.kind:'hunter']++;
    return roster;
  };
  const frenzyView=()=>frenzy?{roster:frenzyRoster(),source:frenzy.source,medium:frenzy.medium,id:frenzy.id,phase:frenzy.phase,until:frenzy.until,outcome:frenzy.outcome,points:frenzy.points.map(p=>({...p})),count:enemies.filter(e=>e.hp>0&&frenzy.members.includes(e.id)).length,hunters:Object.values(frenzy.orders).filter(o=>o.role==='hunt').length,raiders:Object.values(frenzy.orders).filter(o=>o.role==='raid').length}:null;
  const snapshot = () => ({ encounters:director?{elapsed:director.elapsed,nextRaid:director.nextRaid,sequence:director.sequence,sleeping:director.sleeping.length}:null, frenzy:frenzyView(), sites: structuredClone(world.sites), naval: {status:navalStatus,cooldown:navalCooldown,count:enemies.filter(e=>e.kind==='swimmer').length}, charges: charges.map(c => ({ ...c })), epoch, time: now, status, health, kills, objective: { ...objective }, weapon: 'HE', blastRadius: HE.radius, salvos: salvos.map(s => ({ ...s })),
    barrages: barrages.map(b => ({ ...b, ...(b.profile?{profile:{...b.profile}}:{}), box: { ...b.box }, missiles: b.missiles.map(m => ({ ...m, ...(m.sector?{sector:{...m.sector}}:{}) })) })), fields: fields.map(f => ({ ...f, ...(f.sectors ? { box: { ...f.box }, sectors: f.sectors.map(s => ({ ...s })) } : {}) })), enemies: damageTargets().map(({ path, reroute, lurePath, ...e }) => structuredClone(e)), shots: shots.map(s => ({ ...s })), marks: marks.map(m => ({ ...m })),
    flakShells: structuredClone(flakShells), acidShells: structuredClone(acidShells), jets: jets.map(j => ({ ...j })), shells: shells.map(s => ({ ...s })), impacts: impacts.map(i => ({ ...i, hits: i.hits.map(h => ({ ...h })) })), sentries: Object.fromEntries([...sentryMounts].map(([id, mount]) => [id, { ...mount }])) });
  function damage(enemy, amount, weapon) {
    if (enemy.hp > 0 && amount > 0) reportSectorAttack(world.sites, enemies, enemy.x, enemy.y, now, event => events.push(event));
    const blocked = !canDamageEnemy(enemy, weapon);
    if (blocked) enemy.armorHitAt = now;
    else enemy.hp = Math.max(0, enemy.hp - amount);
    if (!enemy.hp) { enemy.behavior = 'dead'; cancelMobileLaser(enemy); }
    return { id: enemy.id, x: enemy.x, y: enemy.y, angle: enemy.angle, kind:enemy.kind, blocked, killed: enemy.hp === 0 };
  }
  function impact(weapon, x, y, hits, radius = 0, craterSize = 1.9, minorBlast = false) {
    for (const hit of hits) if (hit.kind === 'station') reportSectorAttack(world.sites, enemies, hit.x, hit.y, now, event => events.push(event));
    if (weapon !== 'HE') for (const site of world.sites) if (site.state === 'hostile' && siteDistance(site, { x, y }) <= Math.max(.03, radius)) {
      reportSectorAttack(world.sites, enemies, x, y, now, event => events.push(event));
      site.blockedAt = now; site.blockedWeapon = weapon; site.alarmUntil = Math.max(site.alarmUntil || 0, now + ALERT.grace); site.awake = true;
      site.disturbance = { x, y, until: now + ALERT.grace };
    }
    const event = { id: ++serial, weapon, x, y, at: now, ttl: weapon === 'HE' || minorBlast ? 1.6 : .45, minorBlast, radius, surface: tileAt(world, x, y), hits };
    if ((weapon === 'HE' || minorBlast) && event.surface !== 0) marks.push({ id: event.id, kind: 'crater', x, y, size: craterSize, at: now });
    for (const hit of hits) if (hit.killed && hit.kind !== 'station' && !world.logistics) marks.push({ ...hit, kind: 'remains', charred: ['FLAME', 'BURN', 'INCENDIARY'].includes(weapon), at: now });
    marks = marks.slice(-48); impacts.push(event); impacts = impacts.slice(-64);
  }
  function shoot(source, x, y, weapon = 'HE', buildings = []) {
    if (!Object.hasOwn(WEAPONS, weapon)) return 'Unknown weapon.';
    const profile = WEAPONS[weapon];
    if(weapon==='NAVAL_APCR' && source.mount!=='naval-secondary')return 'Use an eligible ship side mount.';
    if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x >= world.width || y >= world.height) return 'Aim inside the battlefield.';
    const distance = Math.hypot(x - source.x, y - source.y);
    if (distance < .2) return 'Aim at least 0.2 tiles away.';
    if (weapon === 'NAVAL_APCR' && distance > profile.range) return 'Side gun target is beyond its range.';
    // A tank's weapon reload belongs to its hull, across automatic/manual control.
    const firingTank=(world.tanks||[]).find(t=>t.id===source.id||t.occupant===source.id);
    const cooldownKey = `${firingTank?.id||source.id}:${weapon}`;
    if (weapon === 'MAGNETIC' && charges.some(c => c.owner === source.id)) return 'Magnetic cannon charging.';
    if ((cooldowns.get(cooldownKey) || 0) > now) return 'Weapon reloading.';
    if (['HE', 'APCR', 'NAVAL_APCR'].includes(weapon) && shells.length + charges.length >= 64) return 'Too many shells in flight. Try again shortly.';
    if (['FLAME', 'HEAVY_FLAME'].includes(weapon) && (jets.length >= 96 || jets.filter(j => j.owner === source.id).length >= 12)) return 'Fuel stream at capacity.';
    if (weapon === 'MAGNETIC') {
      if (charges.length >= 16 || shells.length + charges.length >= 64) return 'Weapon capacity reached.';
      cooldowns.set(cooldownKey, now + profile.charge + profile.cooldown);
      charges.push({ owner: source.id, ...(source.autoTank?{tankId:source.id,targetId:source.guard.targetId}:{}), x: source.x, y: source.y, angle: source.turret || 0, remaining: profile.charge, duration: profile.charge }); return null;
    }
    // Player and sentry projectiles follow the server's actual mount bearing.
    const angle = Number.isFinite(source.turret) ? source.turret : Math.atan2(y - source.y, x - source.x) + Math.PI / 2;
    cooldowns.set(cooldownKey, now + profile.cooldown);
    const id = ++serial, dx = Math.sin(angle), dy = -Math.cos(angle);
    const shot = { id, weapon, mount: source.mount || 'coax', owner: source.id, x: source.x, y: source.y, angle, at: now };
    if (weapon === 'LASER') {
      const hit = raycast(world, buildings, source, dx, dy, profile.range, damageTargets());
      Object.assign(shot, { endX: hit.x, endY: hit.y });
      const hits = [];
      if (hit.enemy) {
        hits.push(damage(hit.enemy, profile.damage, weapon));
        if (hit.enemy.hp > 0 && canDamageEnemy(hit.enemy, weapon)) {
          const wasBurning = hit.enemy.burnUntil > now;
          Object.assign(hit.enemy, { burnUntil: now + profile.burnDuration, burnDps: profile.burnDps, heatX: source.x, heatY: source.y, behavior: 'fleeing' });
          if (!wasBurning) { hit.enemy.path = []; hit.enemy.reroute = 0; }
        }
      }
      if (hit.enemy || hit.blocked) impact('LASER', hit.x, hit.y, hits);
    } else if (['FLAME', 'HEAVY_FLAME'].includes(weapon)) {
      const muzzle = source.mount === 'sentry' ? .5 / Math.max(Math.abs(dx), Math.abs(dy)) + .02 : 0;
      jets.push({ id, owner: source.id, weapon, speed: profile.speed, width: profile.width, x: source.x + dx * muzzle, y: source.y + dy * muzzle, dx, dy, remaining: profile.range - muzzle, at: now });
    } else shells.push({ id, weapon, speed: profile.speed, x: source.x, y: source.y, dx, dy, remaining: weapon === 'HE' ? Math.min(distance, profile.range) : profile.range, blast: weapon === 'HE' ? { ...profile } : null, owner: source.id });
    if (auditContext && (source.mount === 'sentry' || source.guarding || source.autoTank)) {
      const key = source.id + ':' + weapon, previous = automatic.get(key);
      automatic.set(key, { sourceId: source.id, weapon, count: (previous?.count || 0) + 1, kind: 'system', cause: source.autoTank?'tank_guarding':source.mount === 'sentry' ? 'sentry_targeting' : 'robot_guarding' });
    }
    shots.push(shot);
    shots = shots.slice(-64);
    return null;
  }
  /** @param {{id:string|number,x:number,y:number}} source @param {number} x @param {number} y
   * @param {{duration:number,verticalSpeed:number,gravity:number,elevation:number}|null} [trajectory] */
  function lob(source, x, y, trajectory = null, weapon = 'HE') {
    if (!Object.hasOwn(ARTILLERY_SHELLS, weapon)) return 'Choose HE, incendiary or gas.';
    const distance = Math.hypot(x - source.x, y - source.y);
    if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x >= world.width || y >= world.height || distance < ARTILLERY_HE.minRange || distance > ARTILLERY_HE.range + .000001) return 'Heavy HE range is 6 to 60 tiles inside the battlefield.';
    if (salvos.length >= 8) return 'Too many heavy shells in flight.';
    const limit = fieldCapacityError(fields, salvos, weapon); if (limit) return limit;
    const id = ++serial, angle = Math.atan2(y - source.y, x - source.x) + Math.PI / 2;
    salvos.push({ id, weapon, x: source.x, y: source.y, targetX: x, targetY: y, elapsed: 0, duration: trajectory?.duration ?? 1 + distance / 18,
      verticalSpeed: trajectory?.verticalSpeed, gravity: trajectory?.gravity, elevation: trajectory?.elevation, profile: { ...ARTILLERY_SHELLS[weapon] } });
    shots.push({ id, weapon, mount: 'artillery', owner: source.id, x: source.x, y: source.y, angle, elevation: trajectory?.elevation, at: now }); shots = shots.slice(-64);
    return null;
  }
  function navalSalvo(ship,target,mode='salvo') {
    if(ship.kind==='carrier')return 'The carrier has defensive side guns only.';
    if(isSubmarine(ship))return 'Use the submarine missile tubes.';
    if(!operational(ship))return 'This ship cannot fire.';
    if(!['volley','salvo'].includes(mode))return 'Choose volley or salvo.';
    if(![target.x,target.y].every(Number.isFinite)||target.x<0||target.y<0||target.x>=world.width||target.y>=world.height)return 'Aim inside the battlefield.';
    const range=Math.hypot(target.x-ship.x,target.y-ship.y);
    if(range<SHIP.minRange||range>SHIP.range)return 'Naval cannon range is 6 to 40 tiles.';
    const ready=readyMainMounts(ship);
    if(!ready.length)return 'Both main turrets are reloading.';
    const mounts=mode==='salvo'?ready:[ready.find(m=>m.id===ship.nextMainMount)||ready[0]];
    const rounds=mainSalvo(ship,target,mounts),weapon=ship.ammo||'HE';
    if(!Object.hasOwn(ARTILLERY_SHELLS,weapon))return 'Choose HE, Fire or Gas.';
    if(salvos.length+rounds.length>8)return `Need ${rounds.length} free heavy-shell slots for this shot.`;
    const reserved=[...salvos];
    for(const r of rounds){
      if(r.targetX<0||r.targetY<0||r.targetX>=world.width||r.targetY>=world.height)return 'The complete salvo must land inside the battlefield.';
      const error=fieldCapacityError(fields,reserved,weapon);if(error)return error;reserved.push({weapon});
    }
    for(const r of rounds){const id=++serial;salvos.push({...r,id,weapon,elapsed:0,profile:{...ARTILLERY_SHELLS[weapon]}});shots.push({id,weapon,mount:'naval-main',owner:r.owner,x:r.x,y:r.y,angle:r.angle,at:now});}
    ship.mainReloads=Object.fromEntries(mainMounts(ship).map(m=>[m.id,mounts.includes(m)?SHIP.reload:mainReload(ship,m.id)]));
    ship.reload=Math.max(...Object.values(ship.mainReloads));
    ship.nextMainMount=mounts.at(-1).id==='fore'?'aft':'fore';
    shots=shots.slice(-64);return null;
  }
  function navalSecondary(ship,target,buildings=[]) {
    if(isSubmarine(ship))return {error:'This submarine has no secondary gun.',fired:0};
    if(!operational(ship))return {error:'This ship cannot fire.',fired:0};
    if(![target.x,target.y].every(Number.isFinite)||target.x<0||target.y<0||target.x>=world.width||target.y>=world.height)return {error:'Aim inside the battlefield.',fired:0};
    let fired=0,ready=0;
    for(const m of SIDE_MOUNTS){const aim=sideSolution(ship,target,m);if(!aim.inArc||!aim.inRange||!aim.aligned)continue;ready++;
      if(!shoot({...aim,id:ship.id+':'+m.id,turret:aim.angle,mount:'naval-secondary'},target.x,target.y,'NAVAL_APCR',buildings))fired++;
    }
    return {error:null,fired,ready};
  }
  function start(buildings, frontId = 'landing') {
    if(frenzyActive(frenzy))return 'Finish the frenzy before starting a drill.';
    if (status === 'active') return 'A drill is already in progress.';
    const front = (world.fronts || [{ ...world.spawn, id: 'landing', label: 'Caldera landing' }]).find(f => f.id === frontId);
    if (!front) return 'Choose a known drill sector.';
    const spawn = front, candidates = [];
    for (let y = Math.max(0, Math.floor(spawn.y) - 8); y <= Math.min(world.height - 1, Math.floor(spawn.y) + 8); y++) for (let x = Math.max(0, Math.floor(spawn.x) - 8); x <= Math.min(world.width - 1, Math.floor(spawn.x) + 8); x++) {
      const distance = Math.hypot(x + .5 - spawn.x, y + .5 - spawn.y);
      if (distance >= 6 && distance <= 8 && canStand(world, buildings, x + .5, y + .5)) candidates.push({ x: x + .5, y: y + .5 });
    }
    // Favor the north approach to keep the first drill easy to find on a phone.
    candidates.sort((a, b) => a.y - b.y || Math.abs(a.x - spawn.x) - Math.abs(b.x - spawn.x));
    const swimmers = enemies.filter(e=>e.kind==='swimmer' || e.siteId || e.eventSpawn);
    const slots=Math.min(3,ALERT.globalMax-swimmers.filter(e=>e.hp>0).length-world.sites.reduce((n,s)=>n+(s.pending?.points.length||0),0));
    if(slots<=0)return 'Enemy capacity is reserved. Finish the current encounter first.';
    enemies = [];
    for (const candidate of candidates) {
      if (!canStand(world, buildings, candidate.x, candidate.y)) continue;
      if (enemies.some(e => Math.hypot(e.x - candidate.x, e.y - candidate.y) < 2)) continue;
      const path = findPath(world, buildings, candidate, spawn);
      if (path) enemies.push({ id: ++serial, ...candidate, hp: 60, angle: 0, path, reroute: now + 1000 });
      if (enemies.length === slots) break;
    }
    if (!enemies.length) { enemies=swimmers; return 'No clear approach to the drill beacon. Clear a route first.'; }
    enemies.push(...swimmers);
    objective = { ...front };
    if (!world.sites.length) { shells = []; jets = []; impacts = []; }
    kills = 0; health = 100; status = 'active';
    for (const e of enemies) e.reroute = 0;
    return null;
  }
  function tick(dt, buildings, robots = [], weaponSources = robots) {
    now += dt * 1000;
    const facilities = facilityTargets(world, buildings);
    const wasNaval = navalCooldown>0 || enemies.some(e=>e.kind==='swimmer'); navalCooldown=Math.max(0,navalCooldown-dt);
    let changed = !!director || !!frenzy&&frenzy.phase!=='complete' || wasNaval || enemies.length > 0 || charges.length > 0 || status === 'active' || barrages.length > 0 || fields.some(f => f.weapon === 'INCENDIARY') || salvos.length > 0 || shells.length > 0 || jets.length > 0 || impacts.length > 0 || shots.length > 0;
    // Keep broadcasting/checkpointing through the last clearing tick even when
    // this was the final hostile site and the room is otherwise idle.
    changed ||= world.sites.some(s => s.state === 'conquered' && fogRadius(s, now - dt * 1000) > 0);
    const sensorBefore = auditContext ? world.sites.map(s => ({ id: s.id, mode: s.sensor?.mode, pending: s.pending?.at })) : [];
    const beforeArrivals = serial;
    const contacts=raidContacts(world,weaponSources);
    const pending=()=>world.sites.reduce((n,s)=>n+(s.pending?.points.length||0),0)+(frenzy?.phase==='warning'?frenzy.points.length:0);
    const capacity=()=>Math.max(0,ALERT.globalMax-enemies.filter(e=>e.hp>0).length-pending());
    if(director){
      sleepEnemies(director,world,buildings,contacts,enemies,facilities,now,pending(),frenzy);
      const plan=tickDirector(director,world,buildings,weaponSources,enemies,now,dt,frenzy,c=>pressureGroups(director,world,c,enemies,capacity,
        (site,roster)=>queuePressure(site,world,buildings,weaponSources,damageTargets(),roster,now,fireBlocked(fields))),capacity);
      if(plan){frenzy=plan;events.push({event:'frenzy.warning',kind:'system',cause:'natural_encounter',sourceId:plan.id,count:plan.points.length+plan.members.length});}
    }
    changed = tickSites(world.sites, world, buildings, weaponSources, enemies, now, () => ++serial, fireBlocked(fields), frenzy?.phase==='warning'?frenzy.points.length:0,director) || changed;
    changed = tickMortars(world, robots, acidShells, now, dt, () => ++serial, event => events.push(event), facilities) || changed;
    changed = tickLasers(world, buildings, robots, dt, event => events.push(event)) || changed;
    changed = tickAntiAir(world, flakShells, now, dt, () => ++serial, event => events.push(event)) || changed;
    for (const before of sensorBefore) {
      const site = world.sites.find(s => s.id === before.id);
      if (before.mode && before.mode !== site.sensor.mode) events.push({ event: 'sensor.changed', kind: 'system', sourceId: site.id, targetId: site.sensor.targetId || undefined, cause: site.sensor.mode });
      if (before.pending !== site.pending?.at) events.push({ event: 'reinforcement.changed', kind: 'system', sourceId: site.id,
        cause: site.pending ? 'warning' : 'resolved_or_cancelled', count: enemies.filter(e => e.siteId === site.id && e.id > beforeArrivals).length });
    }
    const tankActions=new Map();
    for(const tank of world.tanks||[]){
      const action=tankGuardStep(world,buildings,tank,enemies,dt);
      if(action){tankActions.set(tank.id,{tank,action});changed=true;}
    }
    for (const charge of charges) {
      const automatic=tankActions.get(charge.tankId);
      const source = charge.tankId
        ? automatic?.action.weapon==='MAGNETIC'&&automatic.action.target.id===charge.targetId?automatic.tank:null
        : weaponSources.find(p => p.id === charge.owner && p.life === 'active' && !p.deploying && !p.operating && p.body !== 'robot' && p.tankWeapon === 'MAGNETIC');
      if (!source) { charge.cancelled = true; continue; }
      charge.x = source.x; charge.y = source.y; charge.angle = source.turret;
      charge.remaining = Math.max(0, charge.remaining - dt * 1000);
      if (!charge.remaining) {
        const p = WEAPONS.MAGNETIC;
        shells.push({ id: ++serial, owner: source.id, weapon: 'MAGNETIC', x: source.x, y: source.y, dx: Math.sin(source.turret), dy: -Math.cos(source.turret), speed: p.speed, remaining: p.range });
      }
    }
    charges = charges.filter(c => !c.cancelled && c.remaining > 0);
    for(const {tank,action}of tankActions.values()){
      const before=serial;
      shoot({...tank,autoTank:true},action.target.x,action.target.y,action.weapon,buildings);
      if(auditContext)for(const shell of shells)if(shell.id>before&&shell.weapon==='HE')causes.set(shell.id,{kind:'system',cause:'tank_guarding',sourceId:tank.id,projectileId:shell.id,weapon:'HE'});
    }
    const previousCount = fields.length;
    let expiredSector = false;
    for (const f of fields) expiredSector = tickField(f, dt) || expiredSector;
    fields = fields.filter(keepField);
    if(world.logistics?.orbitalFields)world.logistics.orbitalFields=fields.filter(f=>f.orbital);
    if (now - lastAutomaticSummary >= 5000) {
      for (const detail of automatic.values()) events.push({ event: 'defense.activity', ...detail });
      automatic.clear(); lastAutomaticSummary = now;
    }
    const pendingIds = new Set([...shells, ...salvos, ...barrages].map(p => p.id));
    for (const id of causes.keys()) if (!pendingIds.has(id)) causes.delete(id);
    if (expiredSector || previousCount !== fields.length) for (const e of enemies) e.reroute = 0;
    const blockedByFire = fireBlocked(fields);
    navigator.begin(buildings, blockedByFire, now);
    const combatants=robots.filter(p=>p.life==='active'&&p.health>0&&!p.deploying&&p.shield<=0)
      .concat((world.tanks||[]).filter(v=>operational(v)&&v.occupant).map(v=>({id:'vehicle:'+v.id,x:v.x,y:v.y,vehicle:v})))
      .concat(facilities.filter(f=>f.kind==='recycler'&&f.object.occupant).map(f=>({id:f.id,x:f.x,y:f.y,facility:f})));
    const raidTargets=facilities.filter(f=>f.hp.health>0&&!(f.kind==='recycler'&&f.object.occupant)).map(f=>({id:f.id,x:f.x,y:f.y,facility:f}));
    tickFrenzy(frenzy,world,enemies,director?combatants.filter(p=>contacts.some(c=>c.targetId===p.id||c.id===p.id)):combatants,raidTargets,now,point=>{
      if(mobileLaser(point)&&enemies.filter(e=>e.hp>0&&mobileLaser(e)).length>=4)return null;
      const swimmer=point.kind==='swimmer';
      if(swimmer&&enemies.filter(e=>e.hp>0&&e.kind==='swimmer').length>=SWIMMER.max)return null;
      if(frenzy.source==='natural'&&!raidPointClear(world,buildings,contacts,damageTargets(),point))return null;
      const reservedSites=world.sites.reduce((n,s)=>n+(s.pending?.points.length||0),0);
      if(enemies.filter(e=>e.hp>0).length+reservedSites>=ALERT.globalMax||!(swimmer?canSwim(world,point.x,point.y):canStand(world,buildings,point.x,point.y))||blockedByFire(point.x,point.y)||combatants.concat(enemies).some(p=>Math.hypot(p.x-point.x,p.y-point.y)<3))return null;
      const e={...(swimmer?{id:++serial,x:point.x,y:point.y,kind:'swimmer',hp:SWIMMER.health,angle:0,path:[],reroute:0,targetId:point.targetId,behavior:'hunting'}:newGroundEnemy(point.kind||'hunter',++serial,{x:point.x,y:point.y})),eventSpawn:true,emergedAt:now,rally:{x:point.x,y:point.y}};enemies.push(e);return e;
    },event=>events.push(event),contacts);
    function fieldContact(e) {
      const field = contactField(fields, e);
      if (!field) return false;
      impact(field.weapon, e.x, e.y, [damage(e, e.hp, field.weapon)]); e.attack = null; return true;
    }
    impacts = impacts.filter(i => (i.ttl -= dt) > 0);
    shots = shots.filter(s => now - s.at < 1000);
    for (const [id, until] of cooldowns) if (until <= now) cooldowns.delete(id);
    for (const id of guards.keys()) if (!robots.some(p => p.id === id && p.guarding && p.life === 'active')) guards.delete(id);
    const buildingIds = new Set(buildings.map(b => b.id));
    for (const id of sentryMounts.keys()) if (!buildingIds.has(id)) { sentryMounts.delete(id); changed = true; }
    for (const b of buildings) if (!sentryMounts.has(b.id)) {
      sentryMounts.set(b.id, { angle: SENTRY_TURRET.restAngle, aim: SENTRY_TURRET.restAngle, targetId: null }); changed = true;
    }
    for(const e of director?.sleeping||[]){
      if(e.hp<=0||fieldContact(e))continue;
      const burning=Math.min(dt,Math.max(0,((e.burnUntil||0)-(now-dt*1000))/1000));
      if(burning)damage(e,e.burnDps*burning,'BURN');
    }
    const aircraft=airRecords(world).map(b=>b.aircraft);
    if (status === 'active' || enemies.length) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (fieldContact(e)) continue;
        const burningTime = Math.min(dt, Math.max(0, ((e.burnUntil || 0) - (now - dt * 1000)) / 1000));
        if (burningTime) {
          const hit = damage(e, e.burnDps * burningTime, 'BURN');
          if (hit.killed || now >= (e.burnFeedback || 0)) { impact('BURN', e.x, e.y, [hit]); e.burnFeedback = now + 500; }
          if (hit.killed) continue;
        }
        if (e.kind === 'swimmer') { swimStep(world,e,world.ships||[],fields,now,dt); fieldContact(e); continue; }
        const role = enemyProfile(e);
        if(e.frenzyRecoveryUntil>now){e.attack=null;e.path=[];cancelMobileLaser(e);continue;}
        if (e.behavior === 'fleeing' && e.burnUntil <= now) { e.behavior = 'attacking'; e.reroute = 0; e.path = []; }
        const station = world.sites.find(s => s.id === e.siteId);
        const inFrenzy=frenzy?.phase==='surge'&&frenzy.members.includes(e.id);
        const reports = (station?.sensor?.marks || []).filter(m => m.ground && m.until > now);
        const report = reports.find(m => m.targetId === e.targetId) || reports[0];
        const leash = report ? SCANNER.pursuit : ALERT.pursuit;
        const withinHome = p => inFrenzy || (!e.siteId&&!e.rally) || Math.hypot(p.x-(e.rally?.x??e.homeX),p.y-(e.rally?.y??e.homeY))<=leash;
        let investigation = withinHome(e) && [report, e.lastContact, e.investigation, station?.defenseReport, station?.disturbance].find(p => p && p.until > now && withinHome(p));
        const available = robots.filter(p => p.life === 'active' && p.health > 0 && !p.deploying && p.shield <= 0).concat((world.tanks||[]).filter(operational).map(v=>({id:'vehicle:'+v.id,x:v.x,y:v.y,health:hullHealth(v),life:'active',vehicle:v})))
          .concat(facilities.filter(f=>f.hp.health>0).map(f=>({id:f.id,x:f.x,y:f.y,facility:f})))
          .filter(p => withinHome(p) && withinHome(e));
        const distanceTo = p => targetDistance(e,p);
        let victim = inFrenzy ? null : landTarget(e,available,now);
        // Only a fresh beam report grants remote knowledge. Lost lock routes to
        // the saved point; ordinary local sensing still works on arrival.
        if (!inFrenzy && !victim && report && station.state === 'hostile' && report.seenAt === now) victim = available.find(p => p.id === report.targetId);
        if(inFrenzy){
          const order=frenzy.orders[e.id],actual=available.find(p=>p.id===order?.targetId);
          if(actual)victim={...actual,x:order.x,y:order.y,...(actual.vehicle?{vehicle:{...actual.vehicle,x:order.x,y:order.y}}:{})};
        }
        rememberTarget(e,victim,now);
        if(!victim&&e.lastContact?.until>now&&withinHome(e.lastContact)&&withinHome(e))investigation=e.lastContact;
        if (now >= e.reroute && e.behavior !== 'fleeing') {
          const lure = lureRoute(world, buildings, e, fields, blockedByFire, (_w,_b,start,goal)=>{
            const result=navigator.route('lure:'+e.id,start,[goal]);return result.status==='found'?result.path:null;
          });
          e.lureId = lure?.id ?? null; e.lurePath = lure?.path;
          if (lure) { e.path = lure.path; e.behavior = 'lured'; }
          else if (e.behavior === 'lured') e.behavior = 'attacking';
        }
        if (e.behavior === 'lured' && !fields.some(f => f.id === e.lureId && f.capacity > 0)) { e.behavior = 'attacking'; e.lureId = null; e.path = []; e.reroute = 0; }
        if (e.behavior === 'fleeing' || e.behavior === 'lured') { victim = null; e.attack = null; }
        if (mobileLaser(e)) {
          if (['fleeing','lured'].includes(e.behavior)) cancelMobileLaser(e);
          else { tickMobileLaser(e,aircraft,dt,now,(x,y)=>canStand(world,buildings,x,y)&&!blockedByFire(x,y),event=>events.push(event));fieldContact(e);continue; }
        }
        if ((victim?.id ?? null) !== (e.targetId ?? null)) { e.targetId = victim?.id ?? null; e.path = []; e.reroute = 0; navigator.forget(e.id); }
        if (e.strike && now - e.strike.at > 250) e.strike = null;
        if (e.attack) {
          if (now >= e.attack.at) {
            const target = available.find(p => p.id === e.attack.targetId);
            let hit = false;
            if (target && (target.facility ? facilityDistance(target.facility,e.attack) : target.vehicle ? hullDistance(target.vehicle,e.attack) : Math.hypot(target.x-e.attack.x,target.y-e.attack.y)) <= role.radius) {
              const point = target.facility ? facilityPoint(target.facility,e) : target.vehicle ? hullPoint(target.vehicle,e) : target;
              const distance = Math.hypot(point.x-e.x,point.y-e.y);
              if (distance <= role.reach + role.radius && !raycast(world, buildings, e, (point.x-e.x)/(distance||1), (point.y-e.y)/(distance||1), Math.max(0,distance-(target.facility ? .12 : 0))).blocked) hit = target.facility ? hurtFacility(target.facility,role.damage,role.penetration) : target.vehicle ? hurtVehicle(target.vehicle,role.damage) : hurtRobot(target,role.damage);
            }
            e.strike = { ...e.attack, at: now, hit }; e.attack = null; e.reroute = 0;
          }
          // Wind-up anchors the strike on the ground; moving out makes it miss.
          continue;
        }
        if (victim && distanceTo(victim) <= role.reach && now >= (e.nextAttack || 0)) {
          e.attack = { ...(victim.facility ? facilityPoint(victim.facility,e) : victim.vehicle ? hullPoint(victim.vehicle,e) : {x:victim.x,y:victim.y}), targetId: victim.id, at: now + role.windup, windup: role.windup, radius: role.radius };
          e.nextAttack = now + role.windup + role.cooldown;
          e.angle = Math.atan2(victim.y - e.y, victim.x - e.x) + Math.PI / 2;
          continue;
        }
        if (now >= e.reroute) {
          e.path = [];
          let routeResult;
          if (e.behavior === 'fleeing') {
            const away = Math.atan2(e.y - e.heatY, e.x - e.heatX);
            for (const offset of [0, .6, -.6, 1.2, -1.2]) {
              const goal = { x: Math.floor(e.x + Math.cos(away + offset) * 3), y: Math.floor(e.y + Math.sin(away + offset) * 3) };
              if (!canStand(world, buildings, goal.x + .5, goal.y + .5)) continue;
              routeResult = navigator.route(e.id,e,[goal]);
              if (routeResult.status === 'found' || routeResult.status === 'pending') { e.path = routeResult.path; break; }
            }
          } else if (e.behavior === 'lured') e.path = e.lurePath || [];
          else {
            const ground = investigation && investigationPoint(investigation, e, (x, y) => withinHome({ x, y }) && canStand(world, buildings, x, y) && (role.hazardImmune || !blockedByFire(x, y)));
            // A conquered home's survivors keep their current local area.
            if(station?.state==='conquered'&&!e.rally)e.rally={x:e.x,y:e.y};
            const goal=ground || e.rally || (e.siteId ? {x:e.homeX,y:e.homeY} : objective);
            routeResult=navigator.route(e.id,e,victim?attackGoals(world,buildings,victim,role.reach):[goal],!!role.hazardImmune);
            e.path=routeResult.path;
            if(victim&&['blocked','limited'].includes(routeResult.status))e.failedTarget={id:victim.id,until:now+LAND_AI.retry,cause:routeResult.status};
          }
          e.reroute = now + (routeResult?.status==='pending'?100:routeResult?.status==='limited'||routeResult?.status==='blocked'?LAND_AI.retry:e.behavior === 'fleeing' ? 750 : 1000);
        }
        // Carry unused travel through waypoints: no one-tick pause at each tile.
        let travel = dt * (e.behavior === 'fleeing' ? Math.min(1.5, role.speed) : role.speed) * heatSpeed(fields, e);
        for (let steps = 0; steps < 8 && travel > 0 && e.path.length; steps++) {
          const target = e.path[0], dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy);
          if (d < .0001) { e.path.shift(); continue; }
          const step = Math.min(travel, d, .25), x = e.x + dx / d * step, y = e.y + dy / d * step;
          if ((!role.hazardImmune && fields.some(f => f.weapon === 'INCENDIARY' && insideField(f, x, y))) || !canStand(world, buildings, x, y)) { e.reroute = 0; break; }
          e.x = x; e.y = y; e.angle = Math.atan2(dy, dx) + Math.PI / 2; travel -= step;
          if (step >= d - .0001) e.path.shift();
          if (fieldContact(e)) break;
        }
        if (e.hp <= 0) continue;
        if (fieldContact(e)) continue;
        if (!e.siteId && !e.eventSpawn && !inFrenzy && !victim && !['fleeing', 'lured'].includes(e.behavior) && Math.hypot(e.x - objective.x, e.y - objective.y) < .8) health = Math.max(0, health - dt * 10);
      }
      for (const robot of robots) if (robot.guarding) {
        if (!guards.has(robot.id)) guards.set(robot.id, { search: guards.size % 5 * .1 });
        const action = guardStep(robot, guards.get(robot.id), enemies, world, buildings, dt);
        if (action) shoot(robot, action.target.x, action.target.y, action.weapon, buildings);
      }
      for (const b of buildings) {
        if(world.logistics?.jobs?.[b.id])continue;
        const weapon = b.weapon === 'HEAVY_FLAME' ? 'HEAVY_FLAME' : 'APCR', rangeLimit = weapon === 'HEAVY_FLAME' ? WEAPONS.HEAVY_FLAME.range : 7;
        const source = { id: b.id, x: b.x + .5, y: b.y + .5, mount: 'sentry' };
        const mount = sentryMounts.get(b.id);
        // Keep a valid target so nearby enemies cannot make the mount chatter.
        let target = enemies.find(e => e.id === mount.targetId && e.hp > 0 && canDamageEnemy(e, weapon) && Math.hypot(e.x - source.x, e.y - source.y) < rangeLimit), range = rangeLimit;
        if (!target) for (const e of enemies) {
          const distance = Math.hypot(e.x - source.x, e.y - source.y);
          if (e.hp > 0 && canDamageEnemy(e, weapon) && distance < range) { target = e; range = distance; }
        }
        mount.targetId = target?.id ?? null;
        mount.aim = target ? Math.atan2(target.y - source.y, target.x - source.x) + Math.PI / 2 : mount.angle;
        mount.angle = turnTurret(mount.angle, mount.aim, dt, SENTRY_TURRET.speed);
        if (target && Math.abs(angleDelta(mount.angle, mount.aim)) <= SENTRY_TURRET.tolerance) {
          shoot({ ...source, turret: mount.angle }, target.x, target.y, weapon);
        }
      }
    }
    for(const ship of world.ships||[])if(rampSentryStep(world,ship,enemies,buildings,dt,shoot))changed=true;
    let hazardsLanded = false;
    changed = tickOrbital(world,dt,(order,point)=>{
      const profile=orbitalProfile(order);
      if(orbitalHazard(order.payload)){
        landOrbitalField(fields.find(f=>f.id===order.fieldId),point,order,now);hazardsLanded=true;
        impact(order.payload,point.x,point.y,[],1.2,profile.craterSize,true);return;
      }
      const weapon=order.payload==='BEAM'?'BEAM':'HE',projectile={id:++serial,weapon},hits=[];
      causes.set(projectile.id,{...order.context,actorId:order.context?.actorId||order.callerId,sourceId:'orbital',projectileId:projectile.id,weapon});
      for(const e of damageTargets())if(e.hp>0){const amount=blastDamage(Math.hypot(e.x-point.x,e.y-point.y),profile);if(amount)hits.push(damage(e,amount,weapon));}
      hits.push(...damageSites(world.sites,point.x,point.y,profile,now,blastDamage));
      objectiveHits(projectile,hits);impact(weapon,point.x,point.y,hits,profile.radius,profile.craterSize);causes.delete(projectile.id);
    }) || changed;
    for (const barrage of barrages) {
      barrage.age += dt;
      for (const m of barrage.missiles) if (!m.landed && barrage.age >= m.launch + m.flight) {
        m.landed = true; const hits = [];
        if (barrage.weapon !== 'HE') {
          const field = fields.find(f => f.id === barrage.id);
          landBarrageSector(field, m, now); hazardsLanded = true;
          impact(barrage.weapon, m.x, m.y, [], 1.2, m.craterSize, true);
          continue;
        }
        const profile=barrage.profile||MISSILE_HE;
        for (const e of damageTargets()) if (e.hp > 0 && inTargetBox(barrage.box, e.x, e.y)) {
          const amount = blastDamage(Math.hypot(e.x - m.x, e.y - m.y), profile);
          if (amount) hits.push(damage(e, amount, 'HE'));
        }
        hits.push(...damageSites(world.sites, m.x, m.y, profile, now, blastDamage));
        objectiveHits(barrage, hits);
        impact('HE', m.x, m.y, hits, profile.radius, m.craterSize ?? MISSILE_HE.craterSize);
      }
    }
    barrages = barrages.filter(b => b.missiles.some(m => !m.landed));
    for (const salvo of salvos) {
      salvo.elapsed += dt;
      if (salvo.elapsed < salvo.duration) continue;
      if (salvo.weapon !== 'HE') {
        fields.push(makeField(salvo.id, salvo.weapon, salvo.targetX, salvo.targetY, now));
        impact(salvo.weapon, salvo.targetX, salvo.targetY, [], salvo.profile.radius);
        hazardsLanded = true;
        continue;
      }
      const hits = [];
      for (const e of damageTargets()) if (e.hp > 0) {
        const amount = blastDamage(Math.hypot(e.x - salvo.targetX, e.y - salvo.targetY), salvo.profile);
        if (amount) hits.push(damage(e, amount, 'HE'));
      }
      hits.push(...damageSites(world.sites, salvo.targetX, salvo.targetY, salvo.profile, now, blastDamage));
      objectiveHits(salvo, hits);
      impact('HE', salvo.targetX, salvo.targetY, hits, salvo.profile.radius, salvo.profile.craterSize);
    }
    salvos = salvos.filter(s => s.elapsed < s.duration);
    // Resolve all new regions together: simultaneous fire wins over gas.
    if (hazardsLanded) for (const e of damageTargets()) { e.reroute = 0; if (e.hp > 0) fieldContact(e); }
    for (const jet of jets) {
      const travel = Math.min(dt * (jet.speed || FLAME.speed), jet.remaining);
      const hit = raycast(world, buildings, jet, jet.dx, jet.dy, travel, damageTargets(), .38 + (jet.width || FLAME.width));
      jet.x = hit.x; jet.y = hit.y; jet.remaining -= travel;
      if (hit.enemy || hit.blocked) {
        if (hit.enemy) impact('FLAME', hit.x, hit.y, [damage(hit.enemy, hit.enemy.hp, jet.weapon)]);
        else impact('FLAME', hit.x, hit.y, []);
        jet.remaining = 0;
      }
    }
    jets = jets.filter(j => j.remaining > .001);
    for (const s of shells) {
      if (s.weapon === 'MAGNETIC') {
        const travel = Math.min(dt * s.speed, s.remaining), hit = raycast(world, buildings, s, s.dx, s.dy, travel, damageTargets());
        shots.push({ id: ++serial, weapon: 'MAGNETIC', owner: s.owner, x: s.x, y: s.y, endX: hit.x, endY: hit.y, angle: Math.atan2(s.dx, -s.dy), at: now }); shots = shots.slice(-64);
        s.x = hit.x; s.y = hit.y; s.remaining -= travel;
        if (hit.enemy || hit.blocked) { impact('MAGNETIC', s.x, s.y, hit.enemy ? [damage(hit.enemy, WEAPONS.MAGNETIC.damage, 'MAGNETIC')] : []); s.remaining = 0; }
        continue;
      }
      // Small substeps prevent fast shells tunnelling through a robot or a rock.
      let travel = Math.min(dt * s.speed, s.remaining), hit = false, directTarget;
      while (travel > 0 && !hit) {
        const step = Math.min(travel, .12); travel -= step; s.remaining -= step; s.x += s.dx * step; s.y += s.dy * step;
        const enemy = damageTargets().find(e => e.hp > 0 && Math.hypot(e.x - s.x, e.y - s.y) < .38);
        // Terrain takes priority when an enemy is next to the blocking tile.
        if (tileAt(world, s.x, s.y) === 3 || artilleryBlocks(world, s.x, s.y) || hostileAt(world, s.x, s.y)) hit = true;
        else if (enemy) { hit = true; directTarget = enemy; }
      }
      if (hit || s.remaining < .001) {
        s.remaining = 0;
        if (['APCR','NAVAL_APCR'].includes(s.weapon) && !hit) continue; // Missed bullets expire without a blast.
        const hits = [];
        // A single radial damage event; decorative particles never apply damage.
        for (const enemy of damageTargets()) {
          if (enemy.hp <= 0) continue;
          const amount = s.weapon === 'HE' ? blastDamage(Math.hypot(enemy.x - s.x, enemy.y - s.y), s.blast) : enemy === directTarget ? WEAPONS[s.weapon].damage : 0;
          if (amount) hits.push(damage(enemy, amount, s.weapon));
        }
        if (s.weapon === 'HE') hits.push(...damageSites(world.sites, s.x, s.y, s.blast, now, blastDamage));
        objectiveHits(s, hits);
        impact(s.weapon, s.x, s.y, hits, s.blast?.radius || 0);
      }
    }
    shells = shells.filter(s => s.remaining > 0);
    fields = fields.filter(keepField);
    if(world.logistics?.orbitalFields)world.logistics.orbitalFields=fields.filter(f=>f.orbital);
    for(const v of [...(world.tanks||[]),...(world.ships||[])]) if(v.lossPending){delete v.lossPending;impact('HE',v.x,v.y,[],v.berthX!==undefined?2:1.2,2.2,true);}
    for(const e of damageTargets())if(e.hp<=0&&tileAt(world,e.x,e.y)!==0)addRemains(world.logistics,e,epoch+':'+e.id);
    kills += damageTargets().filter(e => e.hp <= 0).length; enemies = enemies.filter(e => e.hp > 0);
    if(director)director.sleeping=director.sleeping.filter(e=>e.hp>0);
    if (status === 'active' && health <= 0) { status = 'failed'; enemies = enemies.filter(e=>e.kind==='swimmer' || e.siteId || e.eventSpawn); }
    else if (status === 'active' && !enemies.some(e=>e.kind!=='swimmer' && !e.siteId)) status = 'cleared';
    if(navalStatus==='active'&&!enemies.some(e=>e.kind==='swimmer'))navalStatus='cleared';
    if (status !== 'active' && !enemies.length) for (const mount of sentryMounts.values()) { mount.targetId = null; mount.aim = mount.angle; }
    return changed;
  }
  function barrage(gun, target, rotated) {
    if (barrages.length >= MISSILE.maxVolleys) return 'Two missile volleys are already in flight.';
    const weapon = gun.ammo || 'HE';
    if (!['HE', 'INCENDIARY', 'GAS'].includes(weapon)) return 'Choose HE, incendiary or gas.';
    const limit = fieldCapacityError(fields, salvos, weapon, MISSILE.width * MISSILE.height); if (limit) return limit;
    const volley = makeBarrage(gun, missileAim(gun, world, target, rotated), rotated, ++serial);
    if (weapon !== 'HE') fields.push(makeBarrageField(volley, now));
    barrages.push(volley); return null;
  }
  function submarineStrike(ship,target,rotated=false){
    const error=submarineFireError(ship,world,target,rotated,barrages,fields,salvos);if(error)return error;
    const volley=makeSubmarineBarrage(ship,submarineAim(ship,world,target,rotated),rotated,++serial);
    if(volley.weapon!=='HE')fields.push(makeBarrageField(volley,now));
    barrages.push(volley);ship.launchRemaining=(SUBMARINE.count-1)*SUBMARINE.interval;ship.reload=SUBMARINE.reload+ship.launchRemaining;return null;
  }
  function bombRun(plane){
    const error=bombError(world,plane);if(error)return error;
    if(barrages.length>=MISSILE.maxVolleys)return 'Two bombardments are already in flight.';
    const volley=makeBombRun(plane,serial+1),profile=payloadProfile(bomberPayload(plane));
    const limit=fieldCapacityError(fields,salvos,volley.weapon,volley.box.width*volley.box.height);if(limit)return limit;
    serial++;if(volley.weapon!=='HE')fields.push(makeBarrageField(volley,now));
    barrages.push(volley);plane.runs-=profile.cost;plane.releaseRemaining=(profile.count-1)*AIR.interval;return null;
  }
  function helicopterFire(plane,target,rocket=false){
    const error=helicopterFireError(world,plane,target,rocket);if(error)return error;
    if(salvos.length>=JET.maxRounds)return 'Air-to-ground projectile capacity reached.';
    const profile=rocket?HELI_ROCKET:HELI_CANNON,point=helicopterPoint(world,plane,target,rocket),id=++serial;
    salvos.push({id,kind:rocket?'heli-rocket':'strafe',weapon:'HE',owner:plane.id,x:plane.x,y:plane.y,targetX:point.x,targetY:point.y,angle:plane.turret,elapsed:0,duration:profile.flight,profile:{...profile}});
    shots.push({id,weapon:rocket?'HE':'APCR',owner:plane.id,x:plane.x,y:plane.y,angle:plane.turret,at:now});
    spendHelicopterShot(plane,rocket);return null;
  }
  function strafe(plane){
    const error=strafeError(world,plane);if(error)return error;
    const key=plane.id+':strafe';if((cooldowns.get(key)||0)>now)return 'Autocannon reloading.';
    if(salvos.length>=JET.maxRounds)return 'Air-to-ground projectile capacity reached.';
    const point=strafePoint(plane),id=++serial;
    salvos.push({id,kind:'strafe',weapon:'HE',owner:plane.id,x:plane.x,y:plane.y,targetX:point.x,targetY:point.y,angle:plane.angle,elapsed:0,duration:JET.flight,profile:{...JET}});
    shots.push({id,weapon:'APCR',owner:plane.id,x:plane.x,y:plane.y,angle:plane.angle,at:now});
    plane.rounds--;cooldowns.set(key,now+JET.cooldown);return null;
  }
  return { checkpoint, drainEvents, startFrenzy, orbitalOrder, rollbackOrbital, helicopterFire:track(helicopterFire), strafe: track(strafe), bombRun: track(bombRun), snapshot, shoot: track(shoot), lob: track(lob), navalSalvo: track(navalSalvo), navalSecondary, submarineStrike: track(submarineStrike), barrage: track(barrage), start, contact, tick, cancelCharge: owner => { charges = charges.filter(c => c.owner !== owner); } };
}
