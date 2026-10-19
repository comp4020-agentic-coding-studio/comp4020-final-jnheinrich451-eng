import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {newGroundEnemy} from '../../public/enemy-profiles.js';
import {freshLife} from '../../public/survival.js';
import {newAirbase} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test('mobile lens enemies telegraph, hit a hovering aircraft and survive refresh / '+(mobile?'phone':'desktop'),async({browser})=>{
  test.setTimeout(40000);
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-mobile-laser-'));
  const app=createApp({dataDir:dir,logSink:()=>{}});let context;
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
    const post=async(route,data)=>{const r=await context.request.post(url+route,{data,headers:{Origin:url}});expect(r.status(),await r.text()).toBeLessThan(300);return r.json();};
    const credentials={name:'Lens observer',kind:'demo',email:'lens@frontier.test',password:'lens test password 123!'};
    await post('/api/auth/register',credentials);const inbox=await(await context.request.get(url+'/api/auth/inbox')).json();
    await post('/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post('/api/auth/login',credentials);
    const {id}=await post('/api/campaigns/create',{name:'Lens rehearsal'});await post('/api/campaigns/enter',{id});
    const route='/api/campaign-world/'+id+'/world',initial=await(await context.request.get(url+route)).json(),pilot=initial.me.id;
    await post('/api/campaigns/leave',{});
    const db=new DatabaseSync(path.join(dir,'campaigns',id,'world.sqlite'));
    const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);w.terrain.fill(2);
    db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
    const checkpoint=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
    checkpoint.sites=[];checkpoint.enemies=[newGroundEnemy('twin-lens',1,{x:48,y:44}),newGroundEnemy('heavy-lens',2,{x:54,y:44})];checkpoint.serial=2;
    db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(checkpoint));
    const base=newAirbase('pad',pilot,40,30,'helicopter','helipad');
    Object.assign(base.aircraft,{state:'flying',x:50,y:38,leftBase:true,mission:{id:'hover',kind:'cruise',phase:'cruise',elapsed:0,cruiseCenter:{x:50,y:38}}});
    db.prepare('UPDATE scouts SET x=51,y=41 WHERE id=?').run(pilot);
    db.prepare('INSERT INTO robot_states VALUES (?,?) ON CONFLICT(scout_id) DO UPDATE SET value=excluded.value').run(pilot,JSON.stringify({...freshLife(),deployed:true}));
    db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core',pilot,40,50,99);
    db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();await post('/api/campaigns/enter',{id});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
    const state=async()=>(await context.request.get(url+route)).json();
    await expect.poll(async()=>(await state()).combat.enemies.some(e=>e.airLaser?.phase==='charging'),{timeout:12000}).toBe(true);
    await page.screenshot({path:'.local/mobile-laser-charge-'+mobile+'.png'});
    await expect.poll(async()=>(await state()).combat.enemies.some(e=>e.airLaser?.beam),{timeout:12000}).toBe(true);
    await page.screenshot({path:'.local/mobile-laser-beam-'+mobile+'.png'});
    let s=await state();expect(s.me.health).toBe(100);expect(s.airbases[0].aircraft.health).toBeLessThan(180);
    const before=s.airbases[0].aircraft.health;
    await page.reload();await expect(page.locator('#connection')).toContainText('live');s=await state();
    expect(s.airbases[0].aircraft.health).toBeLessThanOrEqual(before);expect(s.combat.enemies).toHaveLength(2);
    expect(s.combat.enemies.map(e=>e.kind)).toEqual(['twin-lens','heavy-lens']);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{
    await context?.close();await app.close();
    if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-mobile-laser-'))throw Error('Unexpected fixture path');
    await rm(dir,{recursive:true,force:true});
  }
});
