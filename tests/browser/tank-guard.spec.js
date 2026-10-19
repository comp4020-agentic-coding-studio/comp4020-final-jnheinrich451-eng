import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {newGroundEnemy} from '../../public/enemy-profiles.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const weapon of ['HE','MAGNETIC'])test('empty tank guards then yields to its pilot / '+weapon,async({browser})=>{
 test.setTimeout(40000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-tank-guard-'));
 const app=createApp({dataDir:dir,logSink:()=>{}});let context;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:{width:1440,height:900}});
  const post=async(route,data)=>{const r=await context.request.post(url+route,{data,headers:{Origin:url}});expect(r.status(),await r.text()).toBeLessThan(300);return r.json();};
  const credentials={name:'Tank observer',kind:'demo',email:'tank@frontier.test',password:'tank test password 123!'};
  await post('/api/auth/register',credentials);const inbox=await(await context.request.get(url+'/api/auth/inbox')).json();
  await post('/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post('/api/auth/login',credentials);
  const {id}=await post('/api/campaigns/create',{name:'Tank guard rehearsal'});await post('/api/campaigns/enter',{id});
  const route='/api/campaign-world/'+id,read=async()=>(await context.request.get(url+route+'/world')).json(),pilot=(await read()).me.id;
  await post('/api/campaigns/leave',{});
  const db=new DatabaseSync(path.join(dir,'campaigns',id,'world.sqlite'));
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);w.terrain.fill(2);
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  const checkpoint=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
  checkpoint.sites=[];checkpoint.enemies=[{...newGroundEnemy('bulwark',1,{x:36.5,y:30.5}),frenzyRecoveryUntil:1e8}];checkpoint.serial=1;
  db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(checkpoint));
  db.prepare('UPDATE scouts SET x=31.6,y=30.5 WHERE id=?').run(pilot);
  db.prepare('INSERT INTO robot_states VALUES (?,?) ON CONFLICT(scout_id) DO UPDATE SET value=excluded.value').run(pilot,JSON.stringify({...freshLife(),deployed:true}));
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core',pilot,20,20,99);
  const tank={id:'tank',owner:pilot,occupant:null,x:30.5,y:30.5,podX:30,podY:30,elapsed:99,health:200,angle:0,turret:Math.PI/2,weapon,secondary:'APCR'};
  db.prepare('INSERT INTO tanks VALUES (?,?)').run(tank.id,JSON.stringify(tank));db.close();await post('/api/campaigns/enter',{id});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
  const hp=async()=>(await read()).combat.enemies[0]?.hp??0;
  await expect.poll(hp,{timeout:10000,intervals:[100]}).toBeLessThan(450);
  await page.screenshot({path:'.local/tank-guard-'+weapon+'.png'});
  await post(route+'/tanks/board',{id:'tank'});await expect.poll(async()=>(await read()).me.body).not.toBe('robot');
  // Accepted HE shells finish after takeover; no new automatic shot follows.
  await page.waitForTimeout(700);const health=await hp();await page.waitForTimeout(900);expect(await hp()).toBe(health);
  expect((await read()).combat.charges.filter(c=>c.tankId)).toHaveLength(0);
  await post(route+'/tanks/exit',{});await expect.poll(async()=>(await read()).me.body).toBe('robot');
  await expect.poll(hp,{timeout:10000,intervals:[100]}).toBeLessThan(health);
  const state=await read();expect(state.tanks[0]).toMatchObject({x:30.5,y:30.5,angle:0,occupant:null});
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await read()).tanks[0].occupant).toBeNull();expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-tank-guard-'))throw Error('Unexpected fixture path');await rm(dir,{recursive:true,force:true});
 }
});
