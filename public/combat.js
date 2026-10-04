import { AIR, bombError, makeBombRun } from './aircraft.js';
import { surfaced } from './submarine-depth.js';
import { mainSalvo, MAIN_MOUNTS, mainReload, readyMainMounts, SIDE_MOUNTS, sideSolution } from './ship-armament.js';
import { SHIP } from './ship.js';
import { isSubmarine, SUBMARINE, submarineFireError, makeSubmarineBarrage } from './submarine.js';
import { SWIMMER, navalSpawn, swimStep } from './naval.js';
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
export function createCombat(world) {
  let serial = 0, now = 0, enemies = [], shells = [], impacts = [], status = 'ready', health = 100, kills = 0;
  let shots = [], marks = [], jets = [], salvos = [], fields = [], barrages = [], charges = [];
  const epoch = `${Date.now()}-${Math.random()}`;
  let navalCooldown = 0, navalStatus = 'ready';
  function contact(ship) {
    if (!operational(ship)) return 'Board a ready ship first.';
    if(!surfaced(ship))return 'Surface fully before requesting a naval contact.';
    if (navalCooldown > 0) return 'Sonar is resetting. Wait for the contact timer.';
    if (enemies.filter(e => e.kind === 'swimmer').length >= SWIMMER.max) return 'Six swimmers are already active.';
    const points = navalSpawn(world,ship,enemies).slice(0,SWIMMER.max-enemies.filter(e=>e.kind==='swimmer').length);
    if (!points.length) return 'No reachable water approach here. Sail farther from shore.';
    for (const p of points) enemies.push({id:++serial,...p,kind:'swimmer',hp:SWIMMER.health,angle:0,path:[],reroute:0,targetId:ship.id,behavior:'hunting'});
    navalCooldown=SWIMMER.contactCooldown;navalStatus='active';return null;
  }
  let objective = { ...world.spawn, id: 'landing', label: 'Caldera landing' };
  const cooldowns = new Map(), sentryMounts = new Map(), guards = new Map();
  const snapshot = () => ({ naval: {status:navalStatus,cooldown:navalCooldown,count:enemies.filter(e=>e.kind==='swimmer').length}, charges: charges.map(c => ({ ...c })), epoch, time: now, status, health, kills, objective: { ...objective }, weapon: 'HE', blastRadius: HE.radius, salvos: salvos.map(s => ({ ...s })),
    barrages: barrages.map(b => ({ ...b, box: { ...b.box }, missiles: b.missiles.map(m => ({ ...m, ...(m.sector?{sector:{...m.sector}}:{}) })) })), fields: fields.map(f => ({ ...f, ...(f.sectors ? { box: { ...f.box }, sectors: f.sectors.map(s => ({ ...s })) } : {}) })), enemies: enemies.map(({ path, reroute, lurePath, ...e }) => e), shots: shots.map(s => ({ ...s })), marks: marks.map(m => ({ ...m })),
    jets: jets.map(j => ({ ...j })), shells: shells.map(s => ({ ...s })), impacts: impacts.map(i => ({ ...i, hits: i.hits.map(h => ({ ...h })) })), sentries: Object.fromEntries([...sentryMounts].map(([id, mount]) => [id, { ...mount }])) });
  function damage(enemy, amount) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    if (!enemy.hp) enemy.behavior = 'dead';
    return { id: enemy.id, x: enemy.x, y: enemy.y, angle: enemy.angle, kind:enemy.kind, killed: enemy.hp === 0 };
  }
  function impact(weapon, x, y, hits, radius = 0, craterSize = 1.9, minorBlast = false) {
    const event = { id: ++serial, weapon, x, y, at: now, ttl: weapon === 'HE' || minorBlast ? 1.6 : .45, minorBlast, radius, surface: tileAt(world, x, y), hits };
    if ((weapon === 'HE' || minorBlast) && event.surface !== 0) marks.push({ id: event.id, kind: 'crater', x, y, size: craterSize, at: now });
    for (const hit of hits) if (hit.killed) marks.push({ ...hit, kind: 'remains', charred: ['FLAME', 'BURN', 'INCENDIARY'].includes(weapon), at: now });
    marks = marks.slice(-48); impacts.push(event); impacts = impacts.slice(-64);
  }
  function shoot(source, x, y, weapon = 'HE', buildings = []) {
    if (!Object.hasOwn(WEAPONS, weapon)) return 'Unknown weapon.';
    const profile = WEAPONS[weapon];
    if(weapon==='NAVAL_APCR' && source.mount!=='naval-secondary')return 'Use an eligible ship side mount.';
    if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x >= world.width || y >= world.height) return 'Aim inside the battlefield.';
    const distance = Math.hypot(x - source.x, y - source.y);
    if (distance < .2 || (['HE', 'APCR', 'NAVAL_APCR'].includes(weapon) && distance > profile.range)) return 'Aim between 0.2 and 14 tiles away.';
    const cooldownKey = `${source.id}:${weapon}`;
    if (weapon === 'MAGNETIC' && charges.some(c => c.owner === source.id)) return 'Magnetic cannon charging.';
    if ((cooldowns.get(cooldownKey) || 0) > now) return 'Weapon reloading.';
    if (['HE', 'APCR', 'NAVAL_APCR'].includes(weapon) && shells.length + charges.length >= 64) return 'Too many shells in flight. Try again shortly.';
    if (['FLAME', 'HEAVY_FLAME'].includes(weapon) && (jets.length >= 96 || jets.filter(j => j.owner === source.id).length >= 12)) return 'Fuel stream at capacity.';
    if (weapon === 'MAGNETIC') {
      if (charges.length >= 16 || shells.length + charges.length >= 64) return 'Weapon capacity reached.';
      cooldowns.set(cooldownKey, now + profile.charge + profile.cooldown);
      charges.push({ owner: source.id, x: source.x, y: source.y, angle: source.turret || 0, remaining: profile.charge, duration: profile.charge }); return null;
    }
    // Player and sentry projectiles follow the server's actual mount bearing.
    const angle = Number.isFinite(source.turret) ? source.turret : Math.atan2(y - source.y, x - source.x) + Math.PI / 2;
    cooldowns.set(cooldownKey, now + profile.cooldown);
    const id = ++serial, dx = Math.sin(angle), dy = -Math.cos(angle);
    const shot = { id, weapon, mount: source.mount || 'coax', owner: source.id, x: source.x, y: source.y, angle, at: now };
    if (weapon === 'LASER') {
      const hit = raycast(world, buildings, source, dx, dy, profile.range, enemies);
      Object.assign(shot, { endX: hit.x, endY: hit.y });
      const hits = [];
      if (hit.enemy) {
        hits.push(damage(hit.enemy, profile.damage));
        if (hit.enemy.hp > 0) {
          const wasBurning = hit.enemy.burnUntil > now;
          Object.assign(hit.enemy, { burnUntil: now + profile.burnDuration, burnDps: profile.burnDps, heatX: source.x, heatY: source.y, behavior: 'fleeing' });
          if (!wasBurning) { hit.enemy.path = []; hit.enemy.reroute = 0; }
        }
      }
      if (hit.enemy || hit.blocked) impact('LASER', hit.x, hit.y, hits);
    } else if (['FLAME', 'HEAVY_FLAME'].includes(weapon)) {
      const muzzle = source.mount === 'sentry' ? .5 / Math.max(Math.abs(dx), Math.abs(dy)) + .02 : 0;
      jets.push({ id, owner: source.id, weapon, speed: profile.speed, width: profile.width, x: source.x + dx * muzzle, y: source.y + dy * muzzle, dx, dy, remaining: profile.range - muzzle, at: now });
    } else shells.push({ id, weapon, speed: profile.speed, x: source.x, y: source.y, dx, dy, remaining: weapon === 'HE' ? distance : profile.range, blast: weapon === 'HE' ? { ...profile } : null, owner: source.id });
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
    ship.mainReloads=Object.fromEntries(MAIN_MOUNTS.map(m=>[m.id,mounts.includes(m)?SHIP.reload:mainReload(ship,m.id)]));
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
    const swimmers = enemies.filter(e=>e.kind==='swimmer');
    enemies = [];
    for (const candidate of candidates) {
      if (!canStand(world, buildings, candidate.x, candidate.y)) continue;
      if (enemies.some(e => Math.hypot(e.x - candidate.x, e.y - candidate.y) < 2)) continue;
      const path = findPath(world, buildings, candidate, spawn);
      if (path) enemies.push({ id: ++serial, ...candidate, hp: 60, angle: 0, path, reroute: now + 1000 });
      if (enemies.length === 3) break;
    }
    if (!enemies.length) { enemies=swimmers; return 'No clear approach to the landing pad. Clear a route first.'; }
    enemies.push(...swimmers);
    objective = { ...front };
    shells = []; jets = []; impacts = []; kills = 0; health = 100; status = 'active';
    for (const e of enemies) e.reroute = 0;
    return null;
  }
  function tick(dt, buildings, robots = [], weaponSources = robots) {
    now += dt * 1000;
    const wasNaval = navalCooldown>0 || enemies.some(e=>e.kind==='swimmer'); navalCooldown=Math.max(0,navalCooldown-dt);
    let changed = wasNaval || charges.length > 0 || status === 'active' || barrages.length > 0 || fields.some(f => f.weapon === 'INCENDIARY') || salvos.length > 0 || shells.length > 0 || jets.length > 0 || impacts.length > 0 || shots.length > 0;
    for (const charge of charges) {
      const source = weaponSources.find(p => p.id === charge.owner && p.life === 'active' && !p.deploying && !p.operating && p.body !== 'robot' && p.tankWeapon === 'MAGNETIC');
      if (!source) { charge.cancelled = true; continue; }
      charge.x = source.x; charge.y = source.y; charge.angle = source.turret;
      charge.remaining = Math.max(0, charge.remaining - dt * 1000);
      if (!charge.remaining) {
        const p = WEAPONS.MAGNETIC;
        shells.push({ id: ++serial, owner: source.id, weapon: 'MAGNETIC', x: source.x, y: source.y, dx: Math.sin(source.turret), dy: -Math.cos(source.turret), speed: p.speed, remaining: p.range });
      }
    }
    charges = charges.filter(c => !c.cancelled && c.remaining > 0);
    const previousCount = fields.length;
    let expiredSector = false;
    for (const f of fields) expiredSector = tickField(f, dt) || expiredSector;
    fields = fields.filter(keepField);
    if (expiredSector || previousCount !== fields.length) for (const e of enemies) e.reroute = 0;
    const blockedByFire = fireBlocked(fields);
    function fieldContact(e) {
      const field = contactField(fields, e);
      if (!field) return false;
      impact(field.weapon, e.x, e.y, [damage(e, e.hp)]); e.attack = null; return true;
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
    if (status === 'active' || enemies.some(e=>e.kind==='swimmer')) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (fieldContact(e)) continue;
        const burningTime = Math.min(dt, Math.max(0, ((e.burnUntil || 0) - (now - dt * 1000)) / 1000));
        if (burningTime) {
          const hit = damage(e, e.burnDps * burningTime);
          if (hit.killed || now >= (e.burnFeedback || 0)) { impact('BURN', e.x, e.y, [hit]); e.burnFeedback = now + 500; }
          if (hit.killed) continue;
        }
        if (e.kind === 'swimmer') { swimStep(world,e,world.ships||[],fields,now,dt); fieldContact(e); continue; }
        if (e.behavior === 'fleeing' && e.burnUntil <= now) { e.behavior = 'attacking'; e.reroute = 0; e.path = []; }
        const available = robots.filter(p => p.life === 'active' && p.health > 0 && !p.deploying && p.shield <= 0).concat((world.tanks||[]).filter(operational).map(v=>({id:'vehicle:'+v.id,x:v.x,y:v.y,health:hullHealth(v),life:'active',vehicle:v})));
        const distanceTo = p => p.vehicle ? hullDistance(p.vehicle,e) : Math.hypot(p.x-e.x,p.y-e.y);
        let victim = available.find(p => p.id === e.targetId && distanceTo(p) < SURVIVAL.aggro + 2);
        if (!victim) victim = available.filter(p => distanceTo(p) < SURVIVAL.aggro).sort((a,b)=>distanceTo(a)-distanceTo(b))[0];
        if (now >= e.reroute && e.behavior !== 'fleeing') {
          const lure = lureRoute(world, buildings, e, fields, blockedByFire);
          e.lureId = lure?.id ?? null; e.lurePath = lure?.path;
          if (lure) { e.path = lure.path; e.behavior = 'lured'; }
          else if (e.behavior === 'lured') e.behavior = 'attacking';
        }
        if (e.behavior === 'lured' && !fields.some(f => f.id === e.lureId && f.capacity > 0)) { e.behavior = 'attacking'; e.lureId = null; e.path = []; e.reroute = 0; }
        if (e.behavior === 'fleeing' || e.behavior === 'lured') { victim = null; e.attack = null; }
        if ((victim?.id ?? null) !== (e.targetId ?? null)) { e.targetId = victim?.id ?? null; e.path = []; e.reroute = 0; }
        if (e.strike && now - e.strike.at > 250) e.strike = null;
        if (e.attack) {
          if (now >= e.attack.at) {
            const target = available.find(p => p.id === e.attack.targetId);
            let hit = false;
            if (target && (target.vehicle ? hullDistance(target.vehicle,e.attack) : Math.hypot(target.x-e.attack.x,target.y-e.attack.y)) <= SURVIVAL.strikeRadius) {
              const point = target.vehicle ? hullPoint(target.vehicle,e) : target;
              const distance = Math.hypot(point.x-e.x,point.y-e.y);
              if (distance <= SURVIVAL.reach + SURVIVAL.strikeRadius && !raycast(world, buildings, e, (point.x-e.x)/(distance||1), (point.y-e.y)/(distance||1), distance).blocked) hit = target.vehicle ? hurtVehicle(target.vehicle,SURVIVAL.damage) : hurtRobot(target,SURVIVAL.damage);
            }
            e.strike = { ...e.attack, at: now, hit }; e.attack = null; e.reroute = 0;
          }
          // Wind-up anchors the strike on the ground; moving out makes it miss.
          continue;
        }
        if (victim && distanceTo(victim) <= SURVIVAL.reach && now >= (e.nextAttack || 0)) {
          e.attack = { ...(victim.vehicle ? hullPoint(victim.vehicle,e) : {x:victim.x,y:victim.y}), targetId: victim.id, at: now + SURVIVAL.windup };
          e.nextAttack = now + SURVIVAL.windup + SURVIVAL.cooldown;
          e.angle = Math.atan2(victim.y - e.y, victim.x - e.x) + Math.PI / 2;
          continue;
        }
        if (now >= e.reroute) {
          e.path = [];
          if (e.behavior === 'fleeing') {
            const away = Math.atan2(e.y - e.heatY, e.x - e.heatX);
            for (const offset of [0, .6, -.6, 1.2, -1.2]) {
              const goal = { x: Math.floor(e.x + Math.cos(away + offset) * 3), y: Math.floor(e.y + Math.sin(away + offset) * 3) };
              if (!canStand(world, buildings, goal.x + .5, goal.y + .5)) continue;
              const route = findPath(world, buildings, e, goal, blockedByFire);
              if (route?.length) { e.path = route; break; }
            }
          } else if (e.behavior === 'lured') e.path = e.lurePath || [];
          else if (victim?.vehicle) {
            const v=victim.vehicle,goals=[];
            for(let y=Math.floor(v.y)-2;y<=Math.floor(v.y)+2;y++)for(let x=Math.floor(v.x)-2;x<=Math.floor(v.x)+2;x++)if(hullDistance(v,{x:x+.5,y:y+.5})<=SURVIVAL.reach&&canStand(world,buildings,x+.5,y+.5))goals.push({x:x+.5,y:y+.5});
            goals.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
            for(const goal of goals){const route=findPath(world,buildings,e,goal,blockedByFire);if(route){e.path=route;break;}}
          } else e.path = findPath(world, buildings, e, victim || objective, blockedByFire) || [];
          e.reroute = now + (e.behavior === 'fleeing' ? 750 : 1000);
        }
        const target = e.path[0];
        if (target) {
          const d = Math.hypot(target.x - e.x, target.y - e.y), step = Math.min(dt * (e.behavior === 'fleeing' ? 1.5 : 1.1) * heatSpeed(fields, e), d);
          if (d < .03) e.path.shift();
          else {
            const x = e.x + (target.x - e.x) / d * step, y = e.y + (target.y - e.y) / d * step;
            if (!fields.some(f => f.weapon === 'INCENDIARY' && insideField(f, x, y)) && canStand(world, buildings, x, y)) { e.x = x; e.y = y; e.angle = Math.atan2(target.y - e.y, target.x - e.x) + Math.PI / 2; }
            else e.reroute = 0;
          }
        }
        if (fieldContact(e)) continue;
        if (!victim && !['fleeing', 'lured'].includes(e.behavior) && Math.hypot(e.x - objective.x, e.y - objective.y) < .8) health = Math.max(0, health - dt * 10);
      }
      for (const robot of robots) if (robot.guarding) {
        if (!guards.has(robot.id)) guards.set(robot.id, { search: guards.size % 5 * .1 });
        const action = guardStep(robot, guards.get(robot.id), enemies, world, buildings, dt);
        if (action) shoot(robot, action.target.x, action.target.y, action.weapon, buildings);
      }
      for (const b of buildings) {
        const weapon = b.weapon === 'HEAVY_FLAME' ? 'HEAVY_FLAME' : 'APCR', rangeLimit = weapon === 'HEAVY_FLAME' ? WEAPONS.HEAVY_FLAME.range : 7;
        const source = { id: b.id, x: b.x + .5, y: b.y + .5, mount: 'sentry' };
        const mount = sentryMounts.get(b.id);
        // Keep a valid target so nearby enemies cannot make the mount chatter.
        let target = enemies.find(e => e.id === mount.targetId && e.hp > 0 && Math.hypot(e.x - source.x, e.y - source.y) < rangeLimit), range = rangeLimit;
        if (!target) for (const e of enemies) {
          const distance = Math.hypot(e.x - source.x, e.y - source.y);
          if (e.hp > 0 && distance < range) { target = e; range = distance; }
        }
        mount.targetId = target?.id ?? null;
        mount.aim = target ? Math.atan2(target.y - source.y, target.x - source.x) + Math.PI / 2 : mount.angle;
        mount.angle = turnTurret(mount.angle, mount.aim, dt, SENTRY_TURRET.speed);
        if (target && Math.abs(angleDelta(mount.angle, mount.aim)) <= SENTRY_TURRET.tolerance) {
          shoot({ ...source, turret: mount.angle }, target.x, target.y, weapon);
        }
      }
    }
    let hazardsLanded = false;
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
        for (const e of enemies) if (e.hp > 0 && inTargetBox(barrage.box, e.x, e.y)) {
          const amount = blastDamage(Math.hypot(e.x - m.x, e.y - m.y), MISSILE_HE);
          if (amount) hits.push(damage(e, amount));
        }
        impact('HE', m.x, m.y, hits, MISSILE_HE.radius, m.craterSize ?? MISSILE_HE.craterSize);
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
      for (const e of enemies) if (e.hp > 0) {
        const amount = blastDamage(Math.hypot(e.x - salvo.targetX, e.y - salvo.targetY), salvo.profile);
        if (amount) hits.push(damage(e, amount));
      }
      impact('HE', salvo.targetX, salvo.targetY, hits, salvo.profile.radius, salvo.profile.craterSize);
    }
    salvos = salvos.filter(s => s.elapsed < s.duration);
    // Resolve all new regions together: simultaneous fire wins over gas.
    if (hazardsLanded) for (const e of enemies) { e.reroute = 0; if (e.hp > 0) fieldContact(e); }
    for (const jet of jets) {
      const travel = Math.min(dt * (jet.speed || FLAME.speed), jet.remaining);
      const hit = raycast(world, buildings, jet, jet.dx, jet.dy, travel, enemies, .38 + (jet.width || FLAME.width));
      jet.x = hit.x; jet.y = hit.y; jet.remaining -= travel;
      if (hit.enemy || hit.blocked) {
        if (hit.enemy) impact('FLAME', hit.x, hit.y, [damage(hit.enemy, hit.enemy.hp)]);
        else impact('FLAME', hit.x, hit.y, []);
        jet.remaining = 0;
      }
    }
    jets = jets.filter(j => j.remaining > .001);
    for (const s of shells) {
      if (s.weapon === 'MAGNETIC') {
        const travel = Math.min(dt * s.speed, s.remaining), hit = raycast(world, buildings, s, s.dx, s.dy, travel, enemies);
        shots.push({ id: ++serial, weapon: 'MAGNETIC', owner: s.owner, x: s.x, y: s.y, endX: hit.x, endY: hit.y, angle: Math.atan2(s.dx, -s.dy), at: now }); shots = shots.slice(-64);
        s.x = hit.x; s.y = hit.y; s.remaining -= travel;
        if (hit.enemy || hit.blocked) { impact('MAGNETIC', s.x, s.y, hit.enemy ? [damage(hit.enemy, WEAPONS.MAGNETIC.damage)] : []); s.remaining = 0; }
        continue;
      }
      // Small substeps prevent fast shells tunnelling through a robot or a rock.
      let travel = Math.min(dt * s.speed, s.remaining), hit = false, directTarget;
      while (travel > 0 && !hit) {
        const step = Math.min(travel, .12); travel -= step; s.remaining -= step; s.x += s.dx * step; s.y += s.dy * step;
        const enemy = enemies.find(e => e.hp > 0 && Math.hypot(e.x - s.x, e.y - s.y) < .38);
        // Terrain takes priority when an enemy is next to the blocking tile.
        if (tileAt(world, s.x, s.y) === 3 || artilleryBlocks(world, s.x, s.y)) hit = true;
        else if (enemy) { hit = true; directTarget = enemy; }
      }
      if (hit || s.remaining < .001) {
        s.remaining = 0;
        if (['APCR','NAVAL_APCR'].includes(s.weapon) && !hit) continue; // Missed bullets expire without a blast.
        const hits = [];
        // A single radial damage event; decorative particles never apply damage.
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const amount = s.weapon === 'HE' ? blastDamage(Math.hypot(enemy.x - s.x, enemy.y - s.y), s.blast) : enemy === directTarget ? WEAPONS[s.weapon].damage : 0;
          if (amount) hits.push(damage(enemy, amount));
        }
        impact(s.weapon, s.x, s.y, hits, s.blast?.radius || 0);
      }
    }
    shells = shells.filter(s => s.remaining > 0);
    fields = fields.filter(keepField);
    for(const v of [...(world.tanks||[]),...(world.ships||[])]) if(v.lossPending){delete v.lossPending;impact('HE',v.x,v.y,[],v.berthX!==undefined?2:1.2,2.2,true);}
    kills += enemies.filter(e => e.hp <= 0).length; enemies = enemies.filter(e => e.hp > 0);
    if (status === 'active' && health <= 0) { status = 'failed'; enemies = enemies.filter(e=>e.kind==='swimmer'); }
    else if (status === 'active' && !enemies.some(e=>e.kind!=='swimmer')) status = 'cleared';
    if(navalStatus==='active'&&!enemies.some(e=>e.kind==='swimmer'))navalStatus='cleared';
    if (status !== 'active' && !enemies.some(e=>e.kind==='swimmer')) for (const mount of sentryMounts.values()) { mount.targetId = null; mount.aim = mount.angle; }
    return changed;
  }
  function barrage(gun, target, rotated) {
    if (barrages.length >= MISSILE.maxVolleys) return 'Two missile volleys are already in flight.';
    const weapon = gun.ammo || 'HE';
    if (!['HE', 'INCENDIARY', 'GAS'].includes(weapon)) return 'Choose HE, incendiary or gas.';
    const limit = fieldCapacityError(fields, salvos, weapon, MISSILE.width * MISSILE.height); if (limit) return limit;
    const volley = makeBarrage(gun, target, rotated, ++serial);
    if (weapon !== 'HE') fields.push(makeBarrageField(volley, now));
    barrages.push(volley); return null;
  }
  function submarineStrike(ship,target,rotated=false){
    const error=submarineFireError(ship,world,target,rotated,barrages,fields,salvos);if(error)return error;
    const volley=makeSubmarineBarrage(ship,target,rotated,++serial);
    if(volley.weapon!=='HE')fields.push(makeBarrageField(volley,now));
    barrages.push(volley);ship.launchRemaining=(SUBMARINE.count-1)*SUBMARINE.interval;ship.reload=SUBMARINE.reload+ship.launchRemaining;return null;
  }
  function bombRun(plane){
    const error=bombError(world,plane);if(error)return error;
    if(barrages.length>=MISSILE.maxVolleys)return 'Two bombardments are already in flight.';
    barrages.push(makeBombRun(plane,++serial));plane.runs--;plane.releaseRemaining=(AIR.count-1)*AIR.interval;return null;
  }
  return { bombRun, snapshot, shoot, lob, navalSalvo, navalSecondary, submarineStrike, barrage, start, contact, tick, cancelCharge: owner => { charges = charges.filter(c => c.owner !== owner); } };
}
