import {orbitalPlan,ORBITAL,ORBITAL_PAYLOADS,orbitalHazard} from '../public/orbital.js';
import {freshLife} from '../public/survival.js';
import { expect, it, vi } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.js';
import { createCombat } from '../public/combat.js';
import { newAirbase } from '../public/aircraft.js';
import { resetWorld } from '../world-maintenance.js';

const password = 'a unique campaign password 123!';
const worldRoute = (id: string, action = 'world') => `/api/campaign-world/${id}/${action}`;

it('persists a paid rail MAC and one locked charge across release and campaign restart',async()=>fixture(async h=>{
 const owner=await h.account('mac-owner'),id=await h.open(owner),pilot=(await owner.request(worldRoute(id))).data.me.id;
 await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);w.terrain.fill(2);w.sites=[];
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('mac-core',pilot,30,60,99);
  db.prepare('UPDATE scouts SET x=32,y=65 WHERE id=?').run(pilot);
  db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot,JSON.stringify({...freshLife(),deployed:true}));
  for(const center of [40,55])for(let x=center-2;x<=center+2;x++)db.prepare('INSERT INTO rails VALUES (?,?,?,?)').run(x,40,'EW',pilot);
  db.prepare('INSERT INTO artillery VALUES (?,?)').run('old-he',JSON.stringify({id:'old-he',owner:pilot,x:55,y:40,shape:'EW',angle:0,aim:0,elevation:75,reload:0,brace:0}));
  const l=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get()!.value as string);l.supplies=1200;l.groundSupplies=1000;db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);saved.sites=[];saved.enemies=[];db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
 const request=(action:string,data:any)=>owner.request(worldRoute(id,action),data),state=async()=>(await owner.request(worldRoute(id))).data;
 expect((await request('artillery',{kind:'forged',x:40,y:40})).status).toBe(400);
 const first=await request('artillery',{kind:'mac',x:40,y:40});expect(first.status,JSON.stringify(first.data)).toBe(201);
 const gun=first.data.gun,paid=(await state()).logistics.supplies;
 expect(gun.kind).toBe('mac');expect(paid).toBeCloseTo(920,0);
 expect((await request('artillery',{kind:'mac',x:40,y:40})).status).toBe(200);expect((await state()).logistics.supplies).toBe(paid);
 expect((await state()).artillery).toHaveLength(2);
 await expect.poll(async()=>(await state()).logistics.jobs[gun.id],{timeout:7000,interval:100}).toBeFalsy();
 expect((await request('artillery/fire',{id:gun.id})).status).toBe(403);
 expect((await request('artillery/control',{id:gun.id})).status).toBe(200);
 expect((await request('artillery/ammo',{id:gun.id,ammo:'HE'})).status).toBe(409);
 await expect.poll(async()=>(await state()).artillery.find((g:any)=>g.id===gun.id).brace,{timeout:3000,interval:100}).toBe(0);
 expect((await request('artillery/fire',{id:gun.id})).status).toBe(200);
 expect((await request('artillery/fire',{id:gun.id})).status).toBe(409);
 expect((await request('artillery/move',{id:gun.id,step:1})).status).toBe(409);
 const accepted=(await state()).combat.salvos.find((s:any)=>s.kind==='mac');expect(accepted.hitIds).toEqual([]);
 await request('artillery/control',{id:gun.id,release:true});await owner.request('/api/campaigns/leave',{});await h.restart();
 await owner.request('/api/campaigns/enter',{id});const paused=await state();
 expect(paused.artillery.find((g:any)=>g.id===gun.id).operator).toBeNull();
 expect(paused.combat.salvos.filter((s:any)=>s.kind==='mac')).toHaveLength(1);
 expect(paused.combat.salvos.find((s:any)=>s.kind==='mac')).toMatchObject({id:accepted.id,dx:accepted.dx,dy:accepted.dy});
 await h.connect(owner,id);
 await expect.poll(async()=>(await state()).combat.salvos.some((s:any)=>s.kind==='mac'),{timeout:5000,interval:100}).toBe(false);
 expect((await state()).artillery.find((g:any)=>g.id===gun.id).reload).toBeGreaterThan(0);
 expect(h.logs.filter((e:any)=>e.event==='weapon.launched'&&e.weapon==='MAC')).toHaveLength(1);
}),20000);

it('checkpoints remote submarine missiles and receipts together in a named campaign',async()=>fixture(async h=>{
 const owner=await h.account('remote-submarine'),id=await h.open(owner),pilot=(await owner.request(worldRoute(id))).data.me.id;
 await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);w.terrain.fill(2);for(let y=0;y<w.height;y++)for(let x=0;x<90;x++)w.terrain[y*w.width+x]=0;db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('sub-core',pilot,100,100,99);db.prepare('UPDATE scouts SET x=110,y=110 WHERE id=?').run(pilot);db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot,JSON.stringify({...freshLife(),deployed:true}));
  const s={id:'remote-sub',owner:pilot,kind:'submarine',x:65,y:70,angle:0,elapsed:99,health:300,ammo:'HE',depth:'submerged',diveBattery:250,diveCapacity:300,occupant:null,berthX:87.5,berthY:70,dock:{x:90.5,y:70,angle:-Math.PI/2}};db.prepare('INSERT INTO ships VALUES (?,?)').run(s.id,JSON.stringify(s));
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);saved.sites=[];saved.enemies=[];db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
 const order={id:'remote-sub',action:'strike',target:{x:110,y:70},ammo:'HE',rotated:false,expected:0,orderId:'campaign-remote-sub-strike'};
 const first=await owner.request(worldRoute(id,'ships/remote-action'),order);expect(first.status,JSON.stringify(first.data)).toBe(201);
 const volley=(await owner.request(worldRoute(id))).data.combat.barrages[0];expect(volley.missiles).toHaveLength(6);expect(volley.missiles[0].underwater).toBe(true);
 await owner.request('/api/campaigns/leave',{});await h.restart();await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
 expect((await owner.request(worldRoute(id,'ships/remote-action'),order)).status).toBe(200);
 const after=(await owner.request(worldRoute(id))).data;expect(after.combat.barrages).toHaveLength(1);expect(after.combat.barrages[0].id).toBe(volley.id);const sub=after.ships.find((s:any)=>s.id==='remote-sub');expect(sub.siloReloads[0]).toBeGreaterThan(0);expect(sub.siloReloads.slice(1)).toEqual([0,0,0]);expect(sub.nextSiloGroup).toBe(1);expect(sub.reload).toBe(0);
 expect(h.logs.some((e:any)=>e.event==='weapon.launched'&&e.action==='ships/remote-action')).toBe(true);
}),15000);

it('backs up the Bulwark roster upgrade once without refilling guards or replacing living enemies', async () => fixture(async h => {
  const owner = await h.account('armorowner'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  expect(initial.combat.sites.some((s: any) => s.guardRoster?.includes('bulwark'))).toBe(true);
  await owner.request('/api/campaigns/leave', {});
  let original: any, eligible: string, expected: any;
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    for (const site of saved.sites) if (site.guardRoster) site.guardRoster = site.guardRoster.map((role: string) => role === 'bulwark' ? 'hunter' : role);
    const groups = new Set(saved.sites.filter((s: any) => s.encounter && s.kind === 'mortar').map((s: any) => s.encounter.id));
    const guards = saved.sites.filter((s: any) => groups.has(s.encounter?.id) && s.guardRoster?.length);
    expect(guards.length).toBeGreaterThan(2); eligible = guards[0].id;
    Object.assign(guards[1], { state: 'conquered', hp: 0, guardsRemaining: 0, guardRoster: [], pending: null });
    guards[2].pending = { kind: 'guards', count: 3, remaining: 1, x: guards[2].x, y: guards[2].y };
    saved.enemies = [{ id: ++saved.serial, kind: 'breaker', hp: 93, maxHp: 180, x: 24.5, y: 18.5, angle: 0, path: [], reroute: 0, eventSpawn: true }];
    original = structuredClone(saved);
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare("DELETE FROM meta WHERE key='bulwark-roster-v1'").run();
  });
  await owner.request('/api/campaigns/enter', { id });
  const after = (await owner.request(worldRoute(id))).data;
  expected = after.combat.sites;
  expect(expected.find((s: any) => s.id === eligible!).guardRoster).toContain('bulwark');
  expect(after.combat.enemies).toEqual(original.enemies.map(({ path, reroute, ...enemy }: any) => enemy));
  expect(after.logistics).toEqual(initial.logistics); expect(after.world.terrain).toEqual(initial.world.terrain);
  for (const old of original.sites) {
    const current = expected.find((s: any) => s.id === old.id);
    expect({ ...current, guardRoster: old.guardRoster }).toEqual(old);
    if (old.pending || old.state === 'conquered') expect(current).toEqual(old);
  }
  await owner.request('/api/campaigns/leave', {}); await h.restart(); await owner.request('/api/campaigns/enter', { id });
  expect((await owner.request(worldRoute(id))).data.combat.sites).toEqual(expected);
  const backups = (await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-bulwark-roster-'));
  expect(backups).toHaveLength(2);
  expect(backups.some(file => {
    const db = new DatabaseSync(path.join(h.dir, 'campaigns', id, 'backups', file), { readOnly: true });
    try { return JSON.stringify(JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string)) === JSON.stringify(original); }
    finally { db.close(); }
  })).toBe(true);
}), 15000);

it('adds denser fronts once to a seven-compound save while preserving conquered sites, guards, construction and supplies', async () => fixture(async h => {
  const owner = await h.account('denseowner'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  const newSite = initial.combat.sites.find((s: any) => s.id.startsWith('front-v2-'));
  expect(newSite).toBeTruthy(); await owner.request('/api/campaigns/leave', {});
  let kept: any, economy: any, marker: any;
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    saved.sites = saved.sites.filter((s: any) => !s.id.startsWith('front-v2-'));
    const groups = saved.sites.filter((s: any) => s.encounter);
    Object.assign(groups[0], { hp: 0, state: 'conquered', conqueredAt: 20, guardsRemaining: 0, guardRoster: [], pending: null });
    groups[1].hp = 52; kept = structuredClone(saved.sites);
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare("DELETE FROM meta WHERE key='seeded-fronts-v2'").run();
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('dense-kept', newSite.x, newSite.y, initial.me.id, 'saved');
    economy = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get()!.value as string);
    economy.supplies = 400; economy.groundSupplies = 75; economy.salvage[groups[0].id] = 0;
    db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(economy));
  });
  await owner.request('/api/campaigns/enter', { id });
  const added = (await owner.request(worldRoute(id))).data;
  expect(added.combat.sites.filter((s: any) => !s.id.startsWith('front-v2-'))).toEqual(kept);
  expect(added.combat.sites.filter((s: any) => s.id.startsWith('front-v2-')).length).toBeGreaterThan(10);
  expect(added.combat.sites.filter((s: any) => s.id.startsWith('front-v2-')).every((s: any) => Math.hypot(s.x + 1.5 - newSite.x, s.y + 1.5 - newSite.y) >= 40)).toBe(true);
  expect(added.logistics).toEqual(economy); expect(added.world.terrain).toEqual(initial.world.terrain);
  expect(added.buildings.some((b: any) => b.id === 'dense-kept')).toBe(true);
  h.database(id, (db: DatabaseSync) => { marker = db.prepare("SELECT value FROM meta WHERE key='seeded-fronts-v2'").get()!.value; });
  await owner.request('/api/campaigns/leave', {}); await h.restart(); await owner.request('/api/campaigns/enter', { id });
  expect((await owner.request(worldRoute(id))).data.combat.sites).toEqual(added.combat.sites);
  h.database(id, (db: DatabaseSync) => expect(db.prepare("SELECT value FROM meta WHERE key='seeded-fronts-v2'").get()!.value).toBe(marker));
  const backups = (await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-dense-fronts-'));
  expect(backups).toHaveLength(2);
  expect(backups.some(file => {
    const db = new DatabaseSync(path.join(h.dir, 'campaigns', id, 'backups', file), { readOnly: true });
    try { return JSON.stringify(JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string).sites) === JSON.stringify(kept); }
    finally { db.close(); }
  })).toBe(true);
}), 15000);

it('backs up seeded additions atomically, shares one layout, and retains partial conquest and supplies across restart', async () => fixture(async h => {
  const owner = await h.account('seedowner'), friend = await h.account('seedfriend'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  const otherId = await h.open(friend);
  const other = (await friend.request(worldRoute(otherId))).data;
  expect(initial.combat.sites.filter((s: any) => s.encounter).length).toBeGreaterThan(0);
  expect(initial.combat.sites.filter((s: any) => s.encounter).map((s: any) => [s.x, s.y, s.kind]))
    .not.toEqual(other.combat.sites.filter((s: any) => s.encounter).map((s: any) => [s.x, s.y, s.kind]));
  await friend.request('/api/campaigns/leave', {});
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await friend.request('/api/campaigns/join', { code });
  const layout = (sites: any[]) => sites.map(s => ({ id: s.id, x: s.x, y: s.y, kind: s.kind, encounter: s.encounter }));
  expect(layout((await friend.request(worldRoute(id))).data.combat.sites)).toEqual(layout(initial.combat.sites));
  await owner.request('/api/campaigns/leave', {});
  let preserved: any, marker: any, seeded: any;
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    saved.sites = saved.sites.filter((s: any) => !s.encounter);
    Object.assign(saved.sites[0], { hp: 0, state: 'conquered', conqueredAt: 22, pending: null });
    saved.sites[1].hp = 87; preserved = structuredClone(saved.sites);
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare("DELETE FROM meta WHERE key='seeded-fronts-v1'").run();
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('seed-kept', 230, 94, initial.me.id, 'saved');
    const economy = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get()!.value as string);
    economy.supplies = 450; economy.groundSupplies = 125; economy.salvage[saved.sites[0].id] = 0;
    db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(economy));
  });
  await owner.request('/api/campaigns/enter', { id });
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites.filter((s: any) => !s.encounter)).toEqual(preserved);
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  expect(migrated.buildings.some((b: any) => b.id === 'seed-kept')).toBe(true);
  expect(migrated.logistics).toMatchObject({ supplies: 450, groundSupplies: 125, salvage: { [preserved[0].id]: 0 } });
  const added = migrated.combat.sites.filter((s: any) => s.encounter);
  expect(added.every((s: any) => Math.hypot(s.x + 1.5 - 230, s.y + 1.5 - 94) >= 40)).toBe(true);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    marker = db.prepare("SELECT value FROM meta WHERE key='seeded-fronts-v1'").get()!.value;
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    const members = saved.sites.filter((s: any) => s.encounter);
    Object.assign(members[0], { hp: 0, state: 'conquered', conqueredAt: 33 }); members[1].hp = 42;
    seeded = structuredClone(members);
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  expect((await owner.request(worldRoute(id))).data.combat.sites.filter((s: any) => s.encounter)).toEqual(seeded);
  h.database(id, (db: DatabaseSync) => expect(db.prepare("SELECT value FROM meta WHERE key='seeded-fronts-v1'").get()!.value).toBe(marker));
  const backups = (await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-seeded-fronts-'));
  expect(backups).toHaveLength(2);
  // At least the migration rehearsal backup contains the exact pre-addition state.
  expect(backups.some(file => {
    const db = new DatabaseSync(path.join(h.dir, 'campaigns', id, 'backups', file), { readOnly: true });
    try { return JSON.stringify(JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string).sites) === JSON.stringify(preserved); }
    finally { db.close(); }
  })).toBe(true);
}), 20000);

it('restricts the local frenzy to the owner and saves the shared warning through room closure',async()=>fixture(async h=>{
 const owner=await h.account('frenzyowner'),friend=await h.account('frenzyfriend'),id=await h.open(owner);
 const code=(await owner.request('/api/campaigns/invite',{id})).data.code;await friend.request('/api/campaigns/join',{code});
 const pilot=(await owner.request(worldRoute(id))).data.me.id;
 expect((await friend.request(worldRoute(id,'frenzy/test'),{})).status).toBe(403);
 expect((await owner.request(worldRoute(id,'frenzy/test'),{})).status).toBe(409);
 await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);w.terrain.fill(2);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('frenzy-core',pilot,30,30,99);
  db.prepare('UPDATE scouts SET x=40.5,y=40.5 WHERE id=?').run(pilot);db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot,JSON.stringify({...freshLife(),deployed:true}));
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);for(const s of saved.sites)Object.assign(s,{hp:0,state:'conquered',pending:null});saved.enemies=[];
  db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);await friend.request('/api/campaigns/enter',{id});await h.connect(friend,id);
 expect((await owner.request(worldRoute(id,'frenzy/test'),{})).status).toBe(200);
 const warned=(await owner.request(worldRoute(id))).data.combat.frenzy;
 expect((await friend.request(worldRoute(id))).data.combat.frenzy).toEqual(warned);
 expect((await owner.request(worldRoute(id,'frenzy/test'),{})).status).toBe(409);
 await owner.request('/api/campaigns/leave',{});await h.restart();await owner.request('/api/campaigns/enter',{id});
 const resumed=(await owner.request(worldRoute(id))).data;
 expect(resumed.combat.frenzy).toEqual(warned);const time=resumed.combat.time;
 await new Promise(r=>setTimeout(r,100));expect((await owner.request(worldRoute(id))).data.combat.time).toBe(time);
 await h.connect(owner,id);await expect.poll(async()=>(await owner.request(worldRoute(id))).data.combat.frenzy.phase,{timeout:7000}).toBe('surge');
 expect(h.logs.filter((l:any)=>l.event==='frenzy.warning')).toHaveLength(1);
 await expect.poll(()=>h.logs.filter((l:any)=>l.event==='frenzy.started').length).toBe(1);
}),15000);

it('shares distant planetary construction through terrain-free live updates and saves both fronts', async () => fixture(async h => {
  const owner = await h.account('planetowner'), friend = await h.account('planetfriend'), id = await h.open(owner);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await friend.request('/api/campaigns/join', { code });
  const pilots = [(await owner.request(worldRoute(id))).data.me.id, (await friend.request(worldRoute(id))).data.me.id];
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    for (const [i, pilot] of pilots.entries()) {
      const x = i ? 370 : 225, y = i ? 250 : 94;
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('planet-core-' + pilot, pilot, x - 10, y - 10, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(x, y, pilot);
      db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot, JSON.stringify({ ...freshLife(), deployed: true }));
    }
  });
  await owner.request('/api/campaigns/enter', { id }); const ownerStream = await h.connect(owner, id);
  expect((await friend.request('/api/campaigns/enter', { id })).status).toBe(200);
  const streams = [ownerStream, await h.connect(friend, id)];
  const built = await Promise.all([owner.request(worldRoute(id, 'buildings'), { x: 230, y: 94 }), friend.request(worldRoute(id, 'buildings'), { x: 375, y: 250 })]);
  expect(built.map(r => r.status)).toEqual([201, 201]);
  await expect.poll(() => streams.every(s => built.every(b => s.output().includes(b.data.building.id)))).toBe(true);
  for (const stream of streams) expect(stream.output()).not.toContain('"terrain"');
  await owner.request('/api/campaigns/leave', {}); await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const saved = (await owner.request(worldRoute(id))).data;
  expect([saved.world.width, saved.world.height]).toEqual([512, 384]);
  for(const result of built){
    const {purchase,...building}=result.data.building;
    expect(saved.buildings).toEqual(expect.arrayContaining([expect.objectContaining(building)]));
    // Buildings use SQL columns; their payment provenance lives in logistics.
    expect(saved.logistics.purchases['sentry:'+building.id]).toEqual(purchase);
  }
}), 15000);

it.each([false, true])('saves flak consumption, aircraft loss and an offline=%s pilot together before reporting damage', async offline => fixture(async h => {
  const owner = await h.account('flak-save'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  const pilot = offline ? 'offline-pilot' : initial.me.id;
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);
    world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
    if (offline) db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run('offline-token',pilot,'Disconnected',60,50,0);
    db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('flak-core',pilot,10,10,99);
    const base = newAirbase('flak-base',pilot,20,66);
    Object.assign(base.aircraft,{health:40,state:'flying',x:60,y:50,speed:6,angle:0,occupant:pilot,leftBase:true});
    db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    for(const s of saved.sites)Object.assign(s,{state:'conquered',hp:0,pending:null,conqueredAt:-100000});
    saved.enemies=[];
    saved.flakShells=[{id:++saved.serial,sourceId:'saved-aa',targetId:base.aircraft.id,x:60,y:50,fromX:60,fromY:35,at:saved.now-1000,landAt:saved.now+50,impacted:false}];
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
  await vi.waitFor(async()=>expect((await owner.request(worldRoute(id))).data.airbases[0].aircraft.state).toBe('destroyed'));
  h.database(id,(db:DatabaseSync)=>{
    const plane = JSON.parse(db.prepare('SELECT value FROM airbases WHERE id=?').get('flak-base')!.value as string).aircraft;
    const life = JSON.parse(db.prepare('SELECT value FROM robot_states WHERE scout_id=?').get(pilot)!.value as string);
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    expect(plane).toMatchObject({state:'destroyed',health:0,occupant:null});
    expect(life).toMatchObject({life:'disabled',health:0,lostVehicle:'aircraft'});
    expect(saved.flakShells[0].impacted).toBe(true);
  });
  await h.restart();await owner.request('/api/campaigns/enter',{id});
  expect((await owner.request(worldRoute(id))).data.airbases[0].aircraft).toMatchObject({state:'destroyed',health:0,occupant:null});
}),15000);

it('adds the complete settlement once and retains its partial conquest across restart', async () => fixture(async h => {
  const owner = await h.account('colony'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  expect(initial.combat.sites.filter((s: any) => s.settlement)).toHaveLength(3);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    saved.sites = saved.sites.filter((s: any) => !s.settlement);
    Object.assign(saved.sites[0], { state: 'conquered', hp: 0, conqueredAt: 42 });
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare("DELETE FROM meta WHERE key='alien-settlement-v1'").run();
  });
  await owner.request('/api/campaigns/enter', { id });
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites.filter((s: any) => s.settlement)).toHaveLength(3);
  expect(migrated.combat.sites[0]).toMatchObject({ state: 'conquered', conqueredAt: 42 });
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    Object.assign(saved.sites.find((s: any) => s.settlement), { state: 'conquered', hp: 0, conqueredAt: 50 });
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const members = (await owner.request(worldRoute(id))).data.combat.sites.filter((s: any) => s.settlement);
  expect(members).toHaveLength(3);
  expect(members.filter((s: any) => s.state === 'conquered')).toHaveLength(1);
  expect((await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-settlement-'))).toHaveLength(2);
}), 15000);

it('serializes named-room construction and boarding races, with private attributable outcome logs', async () => fixture(async h => {
  const owner = await h.account('raceowner'), friend = await h.account('racefriend'), id = await h.open(owner);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await friend.request('/api/campaigns/join', { code }); await h.connect(friend, id);
  const a = (await owner.request(worldRoute(id))).data.me.id, b = (await friend.request(worldRoute(id))).data.me.id;
  expect((await friend.request('/api/campaigns/invite', { id })).status).toBe(403);
  expect((await friend.request('/api/campaigns/revoke-invites', { id })).status).toBe(403);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);
    world.terrain.fill(2); db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
    for (const [pilot, x, y, cy] of [[a, 22.9, 18.5, 10], [b, 24.5, 16.9, 30]]) {
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core-' + pilot, pilot, 10, cy, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(x, y, pilot);
    }
    const tank = { id: 'shared-tank', owner: a, occupant: null, health: 180, hurt: 0, x: 24.5, y: 18.5, podX: 40, podY: 40, elapsed: 99, angle: 0, turret: 0, weapon: 'HE', secondary: 'APCR' };
    db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id, JSON.stringify(tank));
  });
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  await friend.request('/api/campaigns/enter', { id }); await h.connect(friend, id);
  // c: prove server admission in the same wall-clock second, not just Promise.all.
  await new Promise(resolve => setTimeout(resolve, 1020 - Date.now() % 1000));
  const raceLogStart = h.logs.length;
  const placed = await Promise.all([owner, friend].map(c => c.request(worldRoute(id, 'buildings'), { x: 30, y: 22 })));
  expect(placed.map(r => r.status).sort()).toEqual([201, 409]);
  const raceLogs = h.logs.slice(raceLogStart).filter((e: any) => e.action === 'buildings' && e.event === 'action.result');
  expect(raceLogs).toHaveLength(2);
  expect(new Set(raceLogs.map((e: any) => e.at.slice(0, 19))).size).toBe(1);
  expect(new Set(raceLogs.map((e: any) => e.actorId))).toEqual(new Set([a, b]));
  const winner = placed.findIndex(r => r.status === 201), building = placed[winner].data.building;
  expect((await [owner, friend][1 - winner].request(worldRoute(id, 'dismantle'), { id: building.id })).status).toBe(403);
  const boards = await Promise.all([owner, friend].map(c => c.request(worldRoute(id, 'tanks/board'), { id: 'shared-tank' })));
  expect(boards.map(r => r.status).sort()).toEqual([200, 409]);
  const states = await Promise.all([owner, friend].map(c => c.request(worldRoute(id))));
  expect(states[0].data.tanks).toEqual(states[1].data.tanks);
  expect(states[0].data.buildings).toEqual(states[1].data.buildings);
  expect(states[0].data.tanks[0].occupant).toBe([a, b][boards.findIndex(r => r.status === 200)]);
  await expect.poll(() => h.logs.filter((e: any) => e.action === 'tanks/board' && e.event === 'action.result').length).toBe(2);
  const outcomes = h.logs.filter((e: any) => e.action === 'tanks/board' && e.event === 'action.result');
  expect(new Set(outcomes.map((e: any) => e.actorId))).toEqual(new Set([a, b]));
  expect(outcomes.every((e: any) => e.campaignId === id && e.requestId && e.targetId === 'shared-tank')).toBe(true);
  expect(outcomes.map((e: any) => e.outcome).sort()).toEqual(['accepted', 'denied']);
  expect(h.logs.some((e: any) => e.action === 'auth/login' && e.reason === 'session_established' && e.actorId === a)).toBe(true);
  const driver=[owner,friend][boards.findIndex(r=>r.status===200)],walker=[owner,friend][boards.findIndex(r=>r.status!==200)];
  expect(outcomes.find((e:any)=>e.outcome==='accepted')).toMatchObject({command:'board vehicle',unitType:'robot',unitAfterType:'tank',unitAfterId:'shared-tank'});
  expect(outcomes.find((e:any)=>e.outcome==='denied').unitAfterType).toBeUndefined();
  for(const c of [driver,walker]){
    expect((await c.request(worldRoute(id,'input'),{x:0,y:-1,unitType:'spoofed-carrier',password:'never-log-this'})).status).toBe(200);
    expect((await c.request(worldRoute(id,'input'),{x:0,y:1})).status).toBe(200);
  }
  expect((await driver.request(worldRoute(id,'fire'),{x:24.5,y:10.5,weapon:'APCR'})).status).toBe(200);
  expect((await walker.request(worldRoute(id,'fire'),{x:24.5,y:10.5,weapon:'LASER'})).status).toBe(200);
  await h.restart(); // Close flushes the pending bounded summaries.
  const inputs=h.logs.filter((e:any)=>e.action==='input'&&e.outcome==='accepted');
  expect(inputs.map((e:any)=>[e.unitType,e.command]).sort()).toEqual([['robot','move north'],['robot','move south'],['tank','forward; hold heading'],['tank','reverse; hold heading']]);
  expect(h.logs.some((e:any)=>e.unitType==='tank'&&e.command==='fire machine gun'&&e.outcome==='accepted')).toBe(true);
  expect(h.logs.some((e:any)=>e.unitType==='robot'&&e.command==='fire laser rifle'&&e.outcome==='accepted')).toBe(true);
  const serialized = JSON.stringify(h.logs);expect(serialized).not.toContain('spoofed-carrier');expect(serialized).not.toContain('never-log-this');
  for (const secret of [password, code, code.replaceAll('-', ''), 'raceowner@frontier.test', ...owner.cookies.values(), ...friend.cookies.values()]) expect(serialized).not.toContain(secret);
}), 20000);
it('logs initial snapshots, bounded room broadcasts, stream counts and restart identities without private state', async () => fixture(async h => {
  const boot = h.logs.find((e: any) => e.event === 'server.started');
  expect(boot).toMatchObject({ kind: 'system', cause: 'listening' });
  expect(boot.instanceId).toBeTruthy(); expect(boot.buildId).toBeTruthy();
  const owner = await h.account('logowner'), friend = await h.account('logfriend'), id = await h.open(owner);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await friend.request('/api/campaigns/join', { code });
  const stream = await h.connect(friend, id);
  const state = (await friend.request(worldRoute(id))).data, pilot = state.me.id;
  expect(h.logs.some((e: any) => e.event === 'participant.joined' && e.campaignId === id && e.pilotId === pilot && e.participants === 2)).toBe(true);
  expect(h.logs.some((e: any) => e.event === 'participant.connected' && e.pilotId === pilot && e.connectedPlayers === 2 && e.connections === 2)).toBe(true);
  const httpSnapshot = h.logs.findLast((e: any) => e.event === 'state.snapshot' && e.pilotId === pilot && e.transport === 'http');
  expect(httpSnapshot).toMatchObject({ campaignId: id, revision: state.revision, outcome: 'written' });
  const sseSnapshot = h.logs.find((e: any) => e.event === 'state.snapshot' && e.pilotId === pilot && e.transport === 'sse');
  expect(sseSnapshot).toMatchObject({ campaignId: id, connections: 2, connectedPlayers: 2, outcome: 'queued' });
  await expect.poll(stream.output).toContain('"revision":' + sseSnapshot.revision);
  const extra = await h.connect(friend, id);
  expect(h.logs.findLast((e: any) => e.event === 'state.snapshot' && e.transport === 'sse')).toMatchObject({ connections: 3, connectedPlayers: 2 });
  extra.abort();
  expect((await friend.request('/api/campaigns/invite', { id })).status).toBe(403);
  const denied = h.logs.findLast((e: any) => e.event === 'action.result' && e.action === 'campaigns/invite' && e.outcome === 'denied');
  expect(h.logs.some((e: any) => e.event === 'request.received' && e.requestId === denied.requestId)).toBe(true);
  expect(h.logs.some((e: any) => e.event === 'action.received' && e.requestId === denied.requestId && e.pilotId === pilot)).toBe(true);
  stream.abort();
  await expect.poll(() => h.logs.some((e: any) => e.event === 'participant.disconnected' && e.pilotId === pilot && e.connectedPlayers === 1 && e.connections === 1)).toBe(true);
  const other = await h.account('logoutsider'), otherId = await h.open(other);
  expect(h.logs.filter((e: any) => e.event === 'state.broadcast').map((e: any) => e.campaignId)).toEqual([id, otherId]);
  await h.restart();
  expect(h.logs.some((e: any) => e.event === 'state.broadcast.summary' && e.campaignId === id && e.queuedWrites > 0 && e.revision >= e.firstRevision)).toBe(true);
  expect(h.logs.filter((e: any) => e.event === 'server.started')).toHaveLength(2);
  const next = h.logs.findLast((e: any) => e.event === 'server.started');
  expect(next.instanceId).not.toBe(boot.instanceId); expect(next.buildId).toBe(boot.buildId);
  expect(h.logs.some((e: any) => e.event === 'server.stopped' && e.instanceId === boot.instanceId && e.saved)).toBe(true);
  const serialized = JSON.stringify(h.logs);
  for (const secret of [password, code, 'logowner@frontier.test', ...owner.cookies.values(), ...friend.cookies.values()]) expect(serialized).not.toContain(secret);
  expect(h.logs.some((e: any) => 'world' in e || 'terrain' in e || 'cookies' in e)).toBe(false);
}), 15000);

it('counts buffered writes as queued and reports a slow stream skipped by the real broadcaster', async () => fixture(async h => {
  const responses: any[] = [];
  h.server().prependListener('request', (req: any, res: any) => {
    if (!req.url.endsWith('/events')) return;
    responses.push(res);
    const write = res.write;
    res.write = function (...args: any[]) { write.apply(this, args); return false; };
  });
  const owner = await h.account('bufferowner'), id = await h.open(owner);
  const first = h.logs.find((e: any) => e.event === 'state.broadcast');
  expect(first).toMatchObject({ campaignId: id, queuedWrites: 1, droppedStreams: 0 });
  // Model a browser that stopped draining, without filling a real socket with MBs.
  Object.defineProperty(responses[0], 'writableLength', { configurable: true, value: (responses[0].snapshotBytes || 0) + 65537 });
  const second = await h.connect(owner, id);
  await expect.poll(second.output).toContain('"revision":');
  await h.restart(); // Flush the summary after the old stream was removed.
  expect(h.logs.some((e: any) => e.event === 'state.broadcast.summary' && e.campaignId === id && e.droppedStreams === 1 && e.queuedWrites >= 1)).toBe(true);
}), 15000);

it('communication stays room-local, streams to peers, survives reconnect without duplicate sends and ends with the runtime',async()=>fixture(async h=>{
 const owner=await h.account('chat-owner'),peer=h.client(),other=await h.account('chat-other');
 const id=await h.open(owner),otherId=await h.open(other);
 const code=(await owner.request('/api/campaigns/invite',{id})).data.code;
 await peer.request('/api/campaigns/join',{code});const stream=await h.connect(peer,id);
 const route=worldRoute(id,'communication'),packet={kind:'chat',text:'private-crew-text',requestId:'message-owner-001'};
 const results=await Promise.all([owner.request(route,packet),peer.request(route,{kind:'chat',text:'peer-answer',requestId:'message-peer-001'})]);
 expect(results.map(r=>r.status)).toEqual([200,200]);
 await expect.poll(()=>stream.output()).toContain('private-crew-text');
 expect((await peer.request(route)).data.messages).toHaveLength(2);
 expect((await owner.request(route,packet)).data.duplicate).toBe(true);
 expect((await other.request(route)).status).toBe(403);
 expect((await other.request(worldRoute(otherId,'communication'))).data.messages).toHaveLength(0);
 const rejoined=await h.connect(peer,id);await expect.poll(()=>rejoined.output()).toContain('"type":"history"');
 expect((await peer.request(route)).data.messages).toHaveLength(2);
 expect(JSON.stringify(h.logs)).not.toContain('private-crew-text');expect(h.logs.some((e:any)=>e.event==='communication.delivered'&&e.count>=2)).toBe(true);
 await peer.request('/api/campaigns/leave',{});expect((await peer.request(route,packet)).status).toBe(403);
 await h.restart();await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
 expect((await owner.request(route)).data.messages).toHaveLength(0);
}),20000);

async function fixture(run: (h: any) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-campaigns-'));
  const logs: any[] = [];
  const logSink = (line: string) => logs.push(JSON.parse(line));
  let app = createApp({ dataDir: dir, logSink }), base = '';
  const streams: AbortController[] = [];
  async function listen() { await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(app.server.address() as any).port}`; }
  function client() {
    const cookies = new Map<string, string>();
    const header = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    return { cookies, header, async request(route: string, data?: any, withOrigin = true) {
      const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: header(), ...(data === undefined ? {} : { 'Content-Type': 'application/json', ...(withOrigin ? { Origin: base } : {}) }) }, body: data === undefined ? undefined : JSON.stringify(data) });
      for (const raw of response.headers.getSetCookie()) { const [key, value] = raw.split(';')[0].split('='); if (value) cookies.set(key, value); else cookies.delete(key); }
      return { status: response.status, data: await response.json() };
    } };
  }
  async function account(name: string) {
    const c = client(), credentials = { name, email: `${name}@frontier.test`, password, kind: 'demo' };
    expect((await c.request('/api/auth/register', credentials)).status).toBe(200);
    const mail = await c.request('/api/auth/inbox');
    expect((await c.request('/api/auth/verify', { token: mail.data.messages[0].href.split('#token=')[1] })).status).toBe(200);
    expect((await c.request('/api/auth/login', credentials)).status).toBe(200); return c;
  }
  async function connect(c: any, id: string) {
    const controller = new AbortController(); streams.push(controller);
    const response = await fetch(base + worldRoute(id, 'events'), { headers: { Cookie: c.header() }, signal: controller.signal });
    expect(response.status).toBe(200); let output = '';
    void (async () => { try { for await (const chunk of response.body as any) output += new TextDecoder().decode(chunk); } catch { /* closed */ } })();
    return { abort: () => controller.abort(), output: () => output };
  }
  async function open(c: any, name = 'Operation Caldera') {
    const created = await c.request('/api/campaigns/create', { name }); expect(created.status).toBe(200);
    const id = created.data.id; expect((await c.request('/api/campaigns/enter', { id })).status).toBe(200);
    await connect(c, id); return id;
  }
  const database = (id: string | null, fn: (db: DatabaseSync) => any) => {
    const db = new DatabaseSync(id ? path.join(dir, 'campaigns', id, 'world.sqlite') : path.join(dir, 'world.sqlite'));
    try { return fn(db); } finally { db.close(); }
  };
  async function restart(reset = false) { streams.splice(0).forEach(s => s.abort()); await app.close(); if (reset) await resetWorld(dir); app = createApp({ dataDir: dir, logSink }); await listen(); }
  try { await listen(); await run({ logs, client, account, connect, open, database, restart, dir, base: () => base, server: () => app.server }); }
  finally { vi.restoreAllMocks(); streams.forEach(s => s.abort()); await app.close(); await rm(dir, { recursive: true, force: true }); }
}

it('adds conquest to a pre-stage campaign once, backing up and preserving occupied terrain', async () => fixture(async h => {
  const owner = await h.account('migration'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data, oldSite = initial.combat.sites[0];
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    delete saved.sites;
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('existing-sentry', oldSite.x, oldSite.y, initial.me.id, Date.now());
  });
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200);
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites).toHaveLength(1);
  expect(migrated.combat.sites[0]).not.toMatchObject({ x: oldSite.x, y: oldSite.y });
  expect(migrated.buildings.some((b: any) => b.id === 'existing-sentry')).toBe(true);
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  expect((await owner.request(worldRoute(id))).data.combat.sites).toEqual(migrated.combat.sites);
  expect((await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith('before-conquest-'))).toHaveLength(2);
}), 15000);

it.each(['mortar', 'modifier', 'contaminator', 'laser', 'anti-air'])('adds a %s once with a backup, preserving conquered sites and player construction across restart', async kind => fixture(async h => {
  const marker = kind === 'anti-air' ? 'anti-air-v1' : kind === 'laser' ? 'laser-tower-v1' : kind === 'contaminator' ? 'air-contaminator-v1' : kind === 'mortar' ? 'mortar-outpost-v1' : 'environment-modifier-v1';
  const owner = await h.account('outpost'), id = await h.open(owner);
  const initial = (await owner.request(worldRoute(id))).data;
  expect(initial.combat.sites.some((s: any) => s.kind === kind && !s.settlement && !s.encounter)).toBe(true);
  await owner.request('/api/campaigns/leave', {});
  let oldSite: any;
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    saved.sites = saved.sites.filter((s: any) => s.kind !== kind || s.settlement || s.encounter);
    // Rehearse older migrations against a save from before the later fog stage.
    if (kind !== 'anti-air') {
      saved.sites = saved.sites.filter((s: any) => s.kind !== 'anti-air');
      db.prepare("DELETE FROM meta WHERE key='anti-air-v1'").run();
    }
    if (!['laser', 'anti-air'].includes(kind)) {
      saved.sites = saved.sites.filter((s: any) => s.kind !== 'laser');
      db.prepare("DELETE FROM meta WHERE key='laser-tower-v1'").run();
    }
    if (!['contaminator', 'laser', 'anti-air'].includes(kind)) {
      saved.sites = saved.sites.filter((s: any) => s.kind !== 'contaminator');
      db.prepare("DELETE FROM meta WHERE key='air-contaminator-v1'").run();
    }
    Object.assign(saved.sites[0], { state: 'conquered', hp: 0, pending: null, conqueredAt: 42 });
    oldSite = structuredClone(saved.sites[0]); delete saved.acidShells;
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    db.prepare('DELETE FROM meta WHERE key=?').run(marker);
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('kept-sentry', 24, 18, initial.me.id, 'saved');
  });
  await owner.request('/api/campaigns/enter', { id });
  const migrated = (await owner.request(worldRoute(id))).data;
  expect(migrated.combat.sites.filter((s: any) => s.kind === kind && !s.settlement && !s.encounter)).toHaveLength(1);
  expect(migrated.combat.sites.find((s: any) => s.kind === 'alert')).toEqual(oldSite);
  expect(migrated.buildings.some((b: any) => b.id === 'kept-sentry')).toBe(true);
  expect(migrated.world.terrain).toEqual(initial.world.terrain);
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
    Object.assign(saved.sites.find((s: any) => s.kind === kind && !s.settlement && !s.encounter), { state: 'conquered', hp: 0, conqueredAt: 50 });
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  });
  await h.restart(); await owner.request('/api/campaigns/enter', { id });
  const resumed = (await owner.request(worldRoute(id))).data;
  expect(resumed.combat.sites.filter((s: any) => s.kind === kind && !s.settlement && !s.encounter)).toEqual([expect.objectContaining({ state: 'conquered', hp: 0, conqueredAt: 50 })]);
  expect((await readdir(path.join(h.dir, 'campaigns', id, 'backups'))).filter(n => n.startsWith(`before-${kind}-`))).toHaveLength(2);
}), 15000);

it('lists available planets and rejects unknown templates without creating a save', async () => fixture(async h => {
  const owner = await h.account('planet');
  const catalogue = (await owner.request('/api/campaigns/list')).data;
  expect(catalogue.planets.map((p: any) => p.id)).toEqual(['caldera-v1','vesper-v1']);
  for (const template of ['unavailable', null, { id: 'caldera-v1' }]) {
    expect((await owner.request('/api/campaigns/create', { name: 'Invalid', template })).status).toBe(400);
  }
  expect((await owner.request('/api/campaigns/list')).data.campaigns).toHaveLength(0);
  expect((await owner.request('/api/campaigns/create', { name: 'Selected world', template: catalogue.planets[0].id })).status).toBe(200);
  expect((await owner.request('/api/campaigns/list')).data.campaigns[0]).toMatchObject({ name: 'Selected world', template: 'caldera-v1' });
}));

it('creates Vesper separately and preserves its terrain masks and Caldera across restart',async()=>fixture(async h=>{
 const owner=await h.account('vesper-owner'),legacy=(await owner.request('/api/world')).data.world;
 const caldera=await h.open(owner),old=(await owner.request(worldRoute(caldera))).data.world;await owner.request('/api/campaigns/leave',{});
 const created=await owner.request('/api/campaigns/create',{name:'Vesper expedition',template:'vesper-v1'});expect(created.status).toBe(200);const id=created.data.id;
 expect((await owner.request('/api/campaigns/enter',{id})).status).toBe(200);await h.connect(owner,id);
 const first=(await owner.request(worldRoute(id))).data;expect(first.world).toMatchObject({name:'Vesper',template:'vesper-v1',width:512,height:384});
 expect(first.world.mountains.some(Boolean)).toBe(true);expect(first.world.waterKinds.includes(3)).toBe(true);expect(first.me).toMatchObject({x:72.5,y:80.5});
 expect((await owner.request(worldRoute(id,'cores'),{x:72,y:80})).status).toBe(201);
 await owner.request('/api/campaigns/leave',{});await h.restart();await owner.request('/api/campaigns/enter',{id});
 const saved=(await owner.request(worldRoute(id))).data;expect(saved.world.terrain).toEqual(first.world.terrain);expect(saved.world.mountains).toEqual(first.world.mountains);expect(saved.world.waterKinds).toEqual(first.world.waterKinds);expect(saved.cores).toHaveLength(1);
 await owner.request('/api/campaigns/leave',{});await owner.request('/api/campaigns/enter',{id:caldera});expect((await owner.request(worldRoute(caldera))).data.world.terrain).toEqual(old.terrain);
 expect((await owner.request('/api/world')).data.world.terrain).toEqual(legacy.terrain);
}),20000);

it('isolates reads, writes and streams while preserving legacy saves and campaign landing across restart', async () => fixture(async h => {
  const a = await h.account('alpha'), b = await h.account('bravo');
  const legacyId = (await a.request('/api/world')).data.me.id;
  const aid = await h.open(a), bid = await h.open(b);
  await expect(resetWorld(path.join(h.dir, 'campaigns', aid))).rejects.toThrow('World is in use');
  const third = await h.account('charlie');
  const thirdId = (await third.request('/api/campaigns/create', { name: 'Standby campaign' })).data.id;
  expect((await third.request('/api/campaigns/enter', { id: thirdId })).status).toBe(503);
  expect((await a.request(worldRoute(aid))).data.me.id).toBe(legacyId);
  expect((await b.request(worldRoute(aid))).status).toBe(403);
  expect((await b.request(worldRoute(aid, 'events'))).status).toBe(403);
  expect((await a.request(worldRoute(bid, 'cores'), { x: 24, y: 18 })).status).toBe(403);
  expect((await a.request(worldRoute(aid, 'cores'), { x: 24, y: 18 })).status).toBe(201);
  expect((await b.request(worldRoute(bid))).data.cores).toHaveLength(0);
  expect((await a.request('/api/world')).data.cores).toHaveLength(0);
  expect((await a.request('/api/campaigns/list')).data.campaigns.map((c: any) => c.id)).toEqual([aid]);
  await h.restart();
  expect((await a.request(worldRoute(aid))).status).toBe(403);
  expect((await a.request('/api/campaigns/enter', { id: aid })).status).toBe(200);
  const state = (await a.request(worldRoute(aid))).data;
  expect(state.cores).toHaveLength(1); expect(state.me).toMatchObject({ id: legacyId, deploying: true });
  expect((await readdir(path.join(h.dir, 'backups'))).some(n => n.startsWith('before-campaigns-'))).toBe(true);
}), 15000);

it('redeems codes once, remembers account membership and closes all access on owner exit', async () => fixture(async h => {
  const owner = await h.account('owner'), a = await h.account('friend'), b = h.client(), id = await h.open(owner);
  const invite = (await owner.request('/api/campaigns/invite', { id })).data;
  const results = await Promise.all([a.request('/api/campaigns/join', { code: invite.code }), b.request('/api/campaigns/join', { code: invite.code })]);
  expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  // Ensure the durable account is also admitted if the guest won the race.
  if (results[0].status !== 200) { const code = (await owner.request('/api/campaigns/invite', { id })).data.code; expect((await a.request('/api/campaigns/join', { code })).status).toBe(200); }
  const stream = await h.connect(a, id);
  expect((await a.request('/api/campaigns/invite', { id })).status).toBe(403);
  expect((await owner.request('/api/campaigns/leave', {})).status).toBe(200);
  await expect.poll(stream.output).toContain('room-ended');
  expect((await a.request(worldRoute(id))).status).toBe(403);
  expect((await a.request('/api/campaigns/enter', { id })).status).toBe(409);
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200); await h.connect(owner, id);
  expect((await a.request('/api/campaigns/enter', { id })).status).toBe(200);
}), 15000);

it('pauses solo simulation, resumes on joining and freezes only during owner reconnect grace', async () => fixture(async h => {
  const owner = await h.account('pause'), guest = h.client(), id = await h.open(owner);
  expect((await owner.request('/api/campaigns/pause', { id, paused: true })).data.room.soloPaused).toBe(true);
  const before = (await owner.request(worldRoute(id))).data.combat.time;
  await new Promise(r => setTimeout(r, 250)); expect((await owner.request(worldRoute(id))).data.combat.time).toBe(before);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  const joined = await guest.request('/api/campaigns/join', { code }); expect(joined.status).toBe(200);
  expect(joined.data.room).toMatchObject({ paused: false, players: 2 }); expect(joined.data.room.notice).toContain('resumed');
  await h.connect(guest, id);
  expect((await guest.request('/api/campaigns/pause', { id, paused: true })).data.room.paused).toBe(false);
  // Close every owner response using an account logout: explicit revocation closes
  // the room immediately, unlike a transient transport interruption.
  await owner.request('/api/auth/logout', {});
  expect((await guest.request(worldRoute(id))).status).toBe(403);
}), 15000);

it('freezes for reconnect, resumes the same visit and closes after the 30-second grace', async () => fixture(async h => {
  const owner = await h.account('reconnect');
  const id = (await owner.request('/api/campaigns/create', { name: 'Reconnect' })).data.id;
  await owner.request('/api/campaigns/enter', { id }); const stream = await h.connect(owner, id);
  stream.abort();
  await expect.poll(async () => (await owner.request(worldRoute(id))).data.room.state).toBe('reconnecting');
  const frozenState = (await owner.request(worldRoute(id))).data, time = frozenState.combat.time;
  await new Promise(r => setTimeout(r, 250)); const stayed = (await owner.request(worldRoute(id))).data; expect(stayed.combat.time).toBe(time);
  expect(stayed.logistics.time).toBe(frozenState.logistics.time); expect(stayed.logistics.supplies).toBe(frozenState.logistics.supplies);
  const again = await h.connect(owner, id); expect((await owner.request(worldRoute(id))).data.room.state).toBe('open');
  again.abort(); await expect.poll(async () => (await owner.request(worldRoute(id))).data.room.state).toBe('reconnecting');
  const now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now + 31000);
  await expect.poll(async () => (await owner.request(worldRoute(id))).status, { timeout: 2500 }).toBe(403);
}), 15000);

it('retains guest contributions under host management while expiring the guest personal visit', async () => fixture(async h => {
  const owner = await h.account('host'), guest = h.client(), id = await h.open(owner);
  expect((await guest.request('/api/campaigns/create', { name: 'Forbidden' })).status).toBe(403);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await guest.request('/api/campaigns/join', { code }); await h.connect(guest, id);
  const guestPilot = (await guest.request(worldRoute(id))).data.me.id;
  expect(h.logs.some((e: any) => e.event === 'participant.connected' && e.pilotId === guestPilot && e.actorId !== guestPilot && e.campaignId === id && e.kind === 'guest')).toBe(true);
  expect((await guest.request(worldRoute(id, 'cores'), { x: 24, y: 18 })).status).toBe(201);
  await guest.request('/api/campaigns/leave', {});
  const state = (await owner.request(worldRoute(id))).data;
  expect(state.cores[0].owner).toBe(guestPilot); expect(state.room.abandoned).toContain(guestPilot);
  expect((await guest.request('/api/campaigns/enter', { id })).status).toBe(403);
  const newCode = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await guest.request('/api/campaigns/join', { code: newCode });
  const newState = (await guest.request(worldRoute(id))).data;
  expect(newState.me.id).not.toBe(guestPilot); expect(newState.me.body).toBe('orbital');
  const ownerPilot = (await owner.request(worldRoute(id))).data.me.id;
  await owner.request('/api/campaigns/leave', {});
  h.database(id, (db: DatabaseSync) => {
    db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('host-core', ownerPilot, 38, 18, 999);
    db.prepare('INSERT INTO buildings VALUES (?,?,?,?,?)').run('guest-sentry', 35, 18, guestPilot, 'fixture');
  });
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  expect((await owner.request(worldRoute(id, 'sentry-mode'), { id: 'guest-sentry', weapon: 'HEAVY_FLAME' })).status).toBe(200);
  expect((await owner.request(worldRoute(id, 'dismantle'), { id: 'guest-sentry' })).status).toBe(200);
  expect((await owner.request(worldRoute(id))).data.buildings.some((b: any) => b.id === 'guest-sentry')).toBe(false);
}), 15000);

it('retains enemies, pending strikes and hazard capacity through campaign closure, restart and legacy reset', async () => fixture(async h => {
  const owner = await h.account('combat'), id = await h.open(owner);
  await owner.request('/api/campaigns/leave', {});
  const checkpoint = h.database(id, (db: DatabaseSync) => {
    const world = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);
    const combat = createCombat(world); expect(combat.start([])).toBeNull();
    expect(combat.lob({ id: 'test-gun', x: 24, y: 18 }, 24, 30, null, 'GAS')).toBeNull();
    const saved = combat.checkpoint(); db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved)); return saved;
  });
  await h.restart(true);
  await owner.request('/api/auth/login', { kind: 'demo', email: 'combat@frontier.test', password });
  expect((await owner.request('/api/campaigns/enter', { id })).status).toBe(200);
  const state = (await owner.request(worldRoute(id))).data;
  expect(state.combat.enemies).toHaveLength(checkpoint.enemies.length);
  expect(state.combat.salvos).toHaveLength(1); expect(state.combat.salvos[0].weapon).toBe('GAS');
  expect(state.combat.time).toBe(checkpoint.now);
}), 15000);

it('enforces four distinct players and preserves a code when admission is full; rejects missing Origin', async () => fixture(async h => {
  const owner = await h.account('capacity'), id = await h.open(owner);
  expect((await owner.request('/api/campaigns/invite', { id }, false)).status).toBe(403);
  const guests = [];
  for (let i = 0; i < 3; i++) {
    const guest = h.client(); guests.push(guest);
    const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
    expect((await guest.request('/api/campaigns/join', { code })).status).toBe(200); await h.connect(guest, id);
  }
  const spare = h.client(), code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  expect((await spare.request('/api/campaigns/join', { code })).status).toBe(409);
  await guests[0].request('/api/campaigns/leave', {});
  expect((await spare.request('/api/campaigns/join', { code })).status).toBe(200);
}), 15000);

it('rejects a delayed command from the previous room instance after the owner closes and reopens it', async () => fixture(async h => {
  const owner = await h.account('delayed'), id = await h.open(owner);
  const payload = JSON.stringify({ x: 24, y: 18 });
  const received = new Promise<void>(resolve => h.server().once('request', () => resolve()));
  let finish: () => void = () => {};
  const result = new Promise<number>((resolve, reject) => {
    const request = http.request(h.base() + worldRoute(id, 'cores'), { method: 'POST', headers: { Cookie: owner.header(), Origin: h.base(), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, response => { response.resume(); resolve(response.statusCode!); });
    request.on('error', reject); request.write(payload.slice(0, -1)); finish = () => request.end(payload.slice(-1));
  });
  await received; await owner.request('/api/campaigns/leave', {});
  await owner.request('/api/campaigns/enter', { id }); await h.connect(owner, id);
  finish(); expect(await result).toBe(403);
  expect((await owner.request(worldRoute(id))).data.cores).toHaveLength(0);
}), 15000);

it('promotes a visiting guest to an account without replacing their campaign pilot or core', async () => fixture(async h => {
  const owner = await h.account('promotehost'), guest = h.client(), id = await h.open(owner);
  const code = (await owner.request('/api/campaigns/invite', { id })).data.code;
  await guest.request('/api/campaigns/join', { code }); await h.connect(guest, id);
  const pilot = (await guest.request(worldRoute(id))).data.me.id;
  await guest.request(worldRoute(id, 'cores'), { x: 24, y: 18 });
  const credentials = { name: 'Promoted', email: 'promoted@frontier.test', password, kind: 'demo' };
  expect((await guest.request('/api/auth/register', credentials)).status).toBe(200);
  const inbox = (await guest.request('/api/auth/inbox')).data;
  await guest.request('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
  await guest.request('/api/auth/login', credentials);
  expect((await guest.request('/api/campaigns/enter', { id })).status).toBe(200);
  const state = (await guest.request(worldRoute(id))).data;
  expect(state.me.id).toBe(pilot); expect(state.cores[0].owner).toBe(pilot); expect(state.room.abandoned).not.toContain(pilot);
}), 15000);

it.each(['HE','HEAVY','INCENDIARY','GAS'])('shares one %s bomber order, preserves the caller body and checkpoints one accepted release across restart',async(payload)=>fixture(async h=>{
 const owner=await h.account('bomberowner'),friend=await h.account('bomberfriend'),id=await h.open(owner);
 const code=(await owner.request('/api/campaigns/invite',{id})).data.code;await friend.request('/api/campaigns/join',{code});await h.connect(friend,id);
 const a=(await owner.request(worldRoute(id))).data.me.id,b=(await friend.request(worldRoute(id))).data.me.id;await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const world=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);world.terrain.fill(2);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
  for(const [pilot,y] of [[a,10],[b,30]])db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('air-core-'+pilot,pilot,10,y,99);
  for(const pilot of [a,b])db.prepare('UPDATE scouts SET x=53.8,y=56.5 WHERE id=?').run(pilot);
  const base=newAirbase('mission-base',a,48,48);db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);for(const site of saved.sites)Object.assign(site,{state:'conquered',hp:0});saved.enemies=[];db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);await friend.request('/api/campaigns/enter',{id});await h.connect(friend,id);
 const route=worldRoute(id,'aircraft/mission'),orders=[{id:'mission-base',orderId:'owner-mission',payload,target:{x:85,y:40},bearing:1},{id:'mission-base',orderId:'friend-mission',payload,target:{x:85,y:40},bearing:1}];
 const results=await Promise.all([owner,friend].map((c,i)=>c.request(route,orders[i])));expect(results.map(r=>r.status).sort()).toEqual([201,409]);const winner=results.findIndex(r=>r.status===201);
 expect((await [owner,friend][winner].request(route,orders[winner])).status).toBe(200);expect((await friend.request(worldRoute(id,'aircraft/board'),{id:'mission-base'})).status).toBe(409);
 expect((await owner.request(worldRoute(id))).data.me.body).toBe('robot');expect((await friend.request(worldRoute(id))).data.airbases[0].aircraft.mission.id).toBe(orders[winner].orderId);
 await owner.request('/api/campaigns/leave',{});
 // Resume just before release, exercising the real server tick and campaign transaction.
 h.database(id,(db:DatabaseSync)=>{const base=JSON.parse(db.prepare('SELECT value FROM airbases WHERE id=?').get('mission-base')!.value as string),m=base.aircraft.mission;Object.assign(base.aircraft,{state:'flying',speed:6,x:m.release.x-.3,y:m.release.y,angle:m.angle,leftBase:true});m.phase='approach';db.prepare('UPDATE airbases SET value=? WHERE id=?').run(JSON.stringify(base),base.id);});
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
 await expect.poll(async()=>(await owner.request(worldRoute(id))).data.airbases[0].aircraft.mission.released).toBe(true);
 await owner.request('/api/campaigns/leave',{});await h.restart();await owner.request('/api/campaigns/enter',{id});
 const first=(await owner.request(worldRoute(id))).data;expect(first.airbases[0].aircraft.bombCooldown).toBeGreaterThan(0);expect(first.airbases[0].aircraft.mission.payload).toBe(payload);expect(first.combat.barrages[0].payload).toBe(payload);expect(first.combat.barrages[0].missiles).toHaveLength(payload==='HEAVY'?1:12);if(['INCENDIARY','GAS'].includes(payload))expect(first.combat.fields[0]).toMatchObject({weapon:payload,pending:12});expect(first.combat.barrages).toHaveLength(1);const projectile=first.combat.barrages[0].id;
 await new Promise(r=>setTimeout(r,150));expect((await owner.request(worldRoute(id))).data.airbases[0].aircraft.x).toBe(first.airbases[0].aircraft.x);
 await h.connect(owner,id);await new Promise(r=>setTimeout(r,250));const next=(await owner.request(worldRoute(id))).data;expect(next.combat.barrages.map((r:any)=>r.id)).toEqual([projectile]);expect(next.airbases[0].aircraft.bombCooldown).toBeGreaterThan(0);
 expect(h.logs.some((e:any)=>e.event==='weapon.launched'&&e.action==='aircraft/mission'&&e.pilotId===[a,b][winner])).toBe(true);
}),15000);

it('returns a departed manual pilot to base, frees the saved seat and lets a teammate reuse the aircraft',async()=>fixture(async h=>{
 const owner=await h.account('recoveryowner'),friend=await h.account('recoverypilot'),id=await h.open(owner);
 const code=(await owner.request('/api/campaigns/invite',{id})).data.code;await friend.request('/api/campaigns/join',{code});await h.connect(friend,id);
 const a=(await owner.request(worldRoute(id))).data.me.id,b=(await friend.request(worldRoute(id))).data.me.id;await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const world=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);world.terrain.fill(2);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
  for(const [pilot,y] of [[a,10],[b,30]]){db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('return-core-'+pilot,pilot,10,y,99);db.prepare('UPDATE scouts SET x=53.8,y=56.5 WHERE id=?').run(pilot);}
  const base=newAirbase('manual-base',a,48,48);Object.assign(base.aircraft,{state:'flying',x:85,y:60,angle:1,speed:12,leftBase:true,occupant:b});db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);for(const site of saved.sites)Object.assign(site,{state:'conquered',hp:0});saved.enemies=[];db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);await friend.request('/api/campaigns/enter',{id});await h.connect(friend,id);
 expect((await owner.request(worldRoute(id,'aircraft/recall'),{id:'manual-base'})).status).toBe(409);
 await friend.request('/api/campaigns/leave',{});
 let state=(await owner.request(worldRoute(id))).data;expect(state.airbases[0].aircraft.mission).toMatchObject({kind:'recovery',phase:'return'});
 await friend.request('/api/campaigns/enter',{id});await h.connect(friend,id);expect((await friend.request(worldRoute(id))).data.airbases[0].aircraft.mission).toMatchObject({phase:'complete',reason:'Pilot reconnected / manual control'});
 await friend.request('/api/campaigns/leave',{});
 await h.restart();await owner.request('/api/campaigns/enter',{id});state=(await owner.request(worldRoute(id))).data;const pose=state.airbases[0].aircraft.x;
 await new Promise(r=>setTimeout(r,150));expect((await owner.request(worldRoute(id))).data.airbases[0].aircraft.x).toBe(pose);await h.connect(owner,id);
 await expect.poll(async()=>(await owner.request(worldRoute(id))).data.airbases[0].aircraft.occupant,{timeout:18000}).toBeNull();
 await friend.request('/api/campaigns/enter',{id});await h.connect(friend,id);expect((await friend.request(worldRoute(id))).data.me.body).toBe('robot');
 await expect.poll(async()=>(await owner.request(worldRoute(id))).data.airbases[0].aircraft.rearm,{timeout:10000}).toBe(0);
 expect((await owner.request(worldRoute(id,'aircraft/board'),{id:'manual-base'})).status).toBe(200);state=(await owner.request(worldRoute(id))).data;expect(state.airbases).toHaveLength(1);expect(state.me.body).toBe('aircraft');expect(state.combat.barrages).toHaveLength(0);
}),35000);

it('checkpoints an emergency return wreck and an offline pilot loss together',async()=>fixture(async h=>{
 const owner=await h.account('emergencyreturn'),id=await h.open(owner);await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run('lost-token','lost-pilot','Absent pilot',50,55.5,0);
  const base:any=newAirbase('lost-base','lost-pilot',48,48);base.destroyed=true;Object.assign(base.aircraft,{state:'emergency-landing',remaining:.025,occupant:'lost-pilot',mission:{id:'lost-flight',kind:'recovery',phase:'emergency',elapsed:10,returnTime:8,released:false,target:{x:50,y:55.5},entry:{x:50,y:55.5},points:[],bearing:0,angle:0}});db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);await expect.poll(async()=>(await owner.request(worldRoute(id))).data.airbases[0].aircraft.state).toBe('destroyed');
 h.database(id,(db:DatabaseSync)=>{const base=JSON.parse(db.prepare('SELECT value FROM airbases WHERE id=?').get('lost-base')!.value as string),life=JSON.parse(db.prepare('SELECT value FROM robot_states WHERE scout_id=?').get('lost-pilot')!.value as string);expect(base.aircraft.occupant).toBeNull();expect(base.wrecks).toHaveLength(1);expect(life).toMatchObject({life:'disabled',health:0,lostVehicle:'aircraft'});});
 await h.restart();await owner.request('/api/campaigns/enter',{id});expect((await owner.request(worldRoute(id))).data.airbases[0].wrecks).toHaveLength(1);
}),12000);

it('saves shared orbital spending, successive impacts, pause and caller departure without replay',async()=>fixture(async h=>{
 const owner=await h.account('orbitalowner'),friend=await h.account('orbitalfriend'),id=await h.open(owner);
 const code=(await owner.request('/api/campaigns/invite',{id})).data.code;await friend.request('/api/campaigns/join',{code});
 const a=(await owner.request(worldRoute(id))).data.me.id,b=(await friend.request(worldRoute(id))).data.me.id;
 await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);w.terrain.fill(2);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  for(const [pid,y] of [[a,10],[b,25]] as const){db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('orbital-core-'+pid,pid,10,y,99);db.prepare('UPDATE scouts SET x=15,y=? WHERE id=?').run(y,pid);db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pid,JSON.stringify({...freshLife(),deployed:true}));}
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string),p:any=orbitalPlan(w,{x:64,y:48},1);
  saved.sites=[{...saved.sites[0],id:'orbital-test',x:p.points[0].x-1.5,y:p.points[0].y-1.5,hp:100,state:'hostile',pending:null}];saved.enemies=[];
  db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);await friend.request('/api/campaigns/enter',{id});await h.connect(friend,id);
 const order={orderId:'orbital-http-first',sequence:1,payload:'HE',target:{x:64,y:48},bearing:1};
 const results=await Promise.all([owner.request(worldRoute(id,'orbital/strike'),order),friend.request(worldRoute(id,'orbital/strike'),{...order,orderId:'orbital-http-second'})]);
 expect(results.map(r=>r.status).sort()).toEqual([200,409]);const winner=results[0].status===200?owner:friend,accepted=results[0].status===200?order:{...order,orderId:'orbital-http-second'};
 expect((await winner.request(worldRoute(id,'orbital/strike'),accepted)).status).toBe(200);
 let state=(await owner.request(worldRoute(id))).data;expect(state.logistics.supplies).toBe(1200-ORBITAL.cost);expect(state.logistics.groundSupplies).toBe(0);
 await friend.request('/api/campaigns/leave',{});expect((await owner.request('/api/campaigns/pause',{id,paused:true})).status).toBe(200);const age=(await owner.request(worldRoute(id))).data.logistics.orbital.order.age;
 await new Promise(r=>setTimeout(r,150));expect((await owner.request(worldRoute(id))).data.logistics.orbital.order.age).toBe(age);expect((await owner.request(worldRoute(id,'orbital/strike'),{...order,sequence:2})).status).toBe(409);
 await owner.request('/api/campaigns/pause',{id,paused:false});
 await expect.poll(async()=>(await owner.request(worldRoute(id))).data.logistics.orbital.order.points.filter((p:any)=>p.landed).length,{timeout:11000,interval:40}).toBeGreaterThan(0);
 await owner.request('/api/campaigns/leave',{});await h.restart();
 await owner.request('/api/campaigns/enter',{id});state=(await owner.request(worldRoute(id))).data;const landed=state.logistics.orbital.order.points.filter((p:any)=>p.landed).length;
 expect(landed).toBeGreaterThan(0);expect(landed).toBeLessThan(15);expect(state.combat.sites.find((s:any)=>s.id==='orbital-test').state).toBe('conquered');expect(state.logistics.supplies).toBe(1200-ORBITAL.cost);
 await h.connect(owner,id);await expect.poll(async()=>(await owner.request(worldRoute(id))).data.logistics.orbital.order.points.filter((p:any)=>p.landed).length,{timeout:10000}).toBe(15);
 state=(await owner.request(worldRoute(id))).data;expect(state.logistics.orbital.cooldown).toBeGreaterThan(40);expect(state.logistics.supplies).toBe(1200-ORBITAL.cost);
 expect(h.logs.filter((l:any)=>l.event==='orbital.ordered')).toHaveLength(1);expect(h.logs.filter((l:any)=>l.event==='objective.conquered'&&l.targetId==='orbital-test')).toHaveLength(1);
 await h.restart();await owner.request('/api/campaigns/enter',{id});state=(await owner.request(worldRoute(id))).data;expect(state.logistics.orbital.order.points.every((p:any)=>p.landed)).toBe(true);expect(state.combat.sites.find((s:any)=>s.id==='orbital-test').state).toBe('conquered');
}),30000);

it.each(['INCENDIARY','GAS','BEAM','HEAVY','BARRAGE','CLUSTER'])('checkpoints orbital %s payload, reservation and effects without recharge on resume',async payload=>fixture(async h=>{
 const owner=await h.account('orbitalpayload'),id=await h.open(owner),pilot=(await owner.request(worldRoute(id))).data.me.id;await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get()!.value as string);w.terrain.fill(2);db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('payload-core',pilot,10,10,99);db.prepare('UPDATE scouts SET x=15,y=15 WHERE id=?').run(pilot);db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(pilot,JSON.stringify({...freshLife(),deployed:true}));
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);saved.sites=[];saved.enemies=[];db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await owner.request('/api/campaigns/enter',{id});await h.connect(owner,id);
 const data={orderId:'orbital-saved-'+payload,sequence:1,payload,target:{x:64,y:48},bearing:1,end:{x:80,y:48}};
 expect((await owner.request(worldRoute(id,'orbital/strike'),data)).status).toBe(200);expect((await owner.request(worldRoute(id,'orbital/strike'),data)).status).toBe(200);
 let state=(await owner.request(worldRoute(id))).data;expect(state.logistics.supplies).toBe(1200-ORBITAL_PAYLOADS[payload as keyof typeof ORBITAL_PAYLOADS].cost);if(orbitalHazard(payload))expect(state.combat.fields).toHaveLength(1);
 await owner.request('/api/campaigns/leave',{});await h.restart();await owner.request('/api/campaigns/enter',{id});state=(await owner.request(worldRoute(id))).data;const age=state.logistics.orbital.order.age;expect(state.logistics.orbital.order.payload).toBe(payload);
 if(orbitalHazard(payload))expect(state.combat.fields).toHaveLength(1);await new Promise(r=>setTimeout(r,100));expect((await owner.request(worldRoute(id))).data.logistics.orbital.order.age).toBe(age);
 await h.connect(owner,id);await expect.poll(async()=>(await owner.request(worldRoute(id))).data.logistics.orbital.order.points.every((p:any)=>p.landed),{timeout:32000}).toBe(true);
 await owner.request('/api/campaigns/pause',{id,paused:true});state=(await owner.request(worldRoute(id))).data;
 if(payload==='BEAM')expect(state.logistics.orbital.scars).toHaveLength(1);else if(orbitalHazard(payload)) expect(state.combat.fields[0].sectors).toHaveLength(7);
 const before=structuredClone(state.logistics.orbitalFields||[]);await h.restart();await owner.request('/api/campaigns/enter',{id});state=(await owner.request(worldRoute(id))).data;
 expect(state.logistics.supplies).toBe(1200-ORBITAL_PAYLOADS[payload as keyof typeof ORBITAL_PAYLOADS].cost);expect(state.logistics.orbitalFields||[]).toEqual(before);expect(state.combat.fields).toHaveLength(orbitalHazard(payload)?1:0);
 if(payload==='BEAM')expect(state.logistics.orbital.scars).toHaveLength(1);
}),40000);


it('adds one aquatic hive to saved Vesper with backup, shares its state, and preserves conquest and accepted bile across restart',async()=>fixture(async h=>{
 const owner=await h.account('aquatic-owner'),friend=await h.account('aquatic-friend');
 const id=(await owner.request('/api/campaigns/create',{name:'Aquatic trial',template:'vesper-v1'})).data.id;
 await owner.request('/api/campaigns/enter',{id});
 const first=(await owner.request(worldRoute(id))).data;
 expect(first.combat.sites.filter((s:any)=>s.kind==='aquatic-hive')).toHaveLength(1);
 const hive=first.combat.sites.find((s:any)=>s.kind==='aquatic-hive');
 await owner.request('/api/campaigns/leave',{});
 // Recreate a pre-stage save, including existing assets and terrain.
 h.database(id,(db:DatabaseSync)=>{
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string);
  saved.sites=saved.sites.filter((s:any)=>s.kind!=='aquatic-hive');
  db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
  db.prepare("DELETE FROM meta WHERE key='aquatic-hive-v1'").run();
 });
 await owner.request('/api/campaigns/enter',{id});
 const migrated=(await owner.request(worldRoute(id))).data;
 expect(migrated.world).toEqual(first.world);expect(migrated.combat.sites.filter((s:any)=>s.kind==='aquatic-hive')).toEqual([hive]);
 const backups=(await readdir(path.join(h.dir,'campaigns',id,'backups'))).filter(n=>n.startsWith('before-aquatic-hive-'));expect(backups).toHaveLength(2);
 expect(backups.some(name=>{const db=new DatabaseSync(path.join(h.dir,'campaigns',id,'backups',name),{readOnly:true});try{return !JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string).sites.some((s:any)=>s.kind==='aquatic-hive');}finally{db.close();}})).toBe(true);
 await h.connect(owner,id);const invitation=await owner.request('/api/campaigns/invite',{id});expect(invitation.status,JSON.stringify(invitation.data)).toBe(200);const code=invitation.data.code;const joined=await friend.request('/api/campaigns/join',{code});expect(joined.status,JSON.stringify(joined.data)).toBe(200);const entered=await friend.request('/api/campaigns/enter',{id});expect(entered.status,JSON.stringify(entered.data)).toBe(200);
 expect((await friend.request(worldRoute(id))).data.combat.sites.find((s:any)=>s.id===hive.id)).toMatchObject(hive);
 await friend.request('/api/campaigns/leave',{});await owner.request('/api/campaigns/leave',{});
 h.database(id,(db:DatabaseSync)=>{
  const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get()!.value as string),site=saved.sites.find((s:any)=>s.id===hive.id);
  Object.assign(site,{hp:0,state:'conquered',conqueredAt:saved.now});
  saved.acidShells=[{id:++saved.serial,sourceId:999,weapon:'BILE',fromX:330,fromY:110,x:335,y:110,at:saved.now,landAt:saved.now+1400,impacted:false}];
  saved.aquaticClouds=[{id:++saved.serial,sourceId:999,weapon:'TOXIC',kind:'puddle',x:335,y:110,radius:1.6,activeAt:saved.now+1400,expiresAt:saved.now+4900}];
  db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
 });
 await h.restart();await owner.request('/api/campaigns/enter',{id});
 const restored=(await owner.request(worldRoute(id))).data;
 expect(restored.combat.sites.filter((s:any)=>s.kind==='aquatic-hive')).toHaveLength(1);expect(restored.combat.sites.find((s:any)=>s.id===hive.id)).toMatchObject({hp:0,state:'conquered'});
 expect(restored.combat.acidShells).toHaveLength(1);expect(restored.combat.aquaticClouds).toHaveLength(1);for(const key of ['terrain','waterKinds','mountains'])expect(restored.world[key]).toEqual(first.world[key]);
 expect((await readdir(path.join(h.dir,'campaigns',id,'backups'))).filter(n=>n.startsWith('before-aquatic-hive-'))).toHaveLength(2);
 expect((await owner.request('/api/world')).data.world.template).not.toBe('vesper-v1');
}),20000);
