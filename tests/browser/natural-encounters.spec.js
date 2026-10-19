import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('saved campaign automatically warns and starts a raid without the test endpoint',async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-natural-raid-'));
 const app=createApp({dataDir:dir,logSink:()=>{}});let context;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:{width:1440,height:900}});
  const post=async(route,data)=>{const r=await context.request.post(url+route,{data,headers:{Origin:url}});expect(r.status(),await r.text()).toBeLessThan(300);return r.json();};
  const credentials={name:'Encounter observer',kind:'demo',email:'encounter@frontier.test',password:'encounter test password 123!'};
  await post('/api/auth/register',credentials);const inbox=await(await context.request.get(url+'/api/auth/inbox')).json();
  await post('/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post('/api/auth/login',credentials);
  const {id}=await post('/api/campaigns/create',{name:'Natural encounters'});await post('/api/campaigns/enter',{id});
  const route='/api/campaign-world/'+id,read=async()=>(await context.request.get(url+route+'/world')).json(),pilot=(await read()).me.id;
  await post('/api/campaigns/leave',{});
  const db=new DatabaseSync(path.join(dir,'campaigns',id,'world.sqlite'));
  const w=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);w.terrain.fill(2);
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
  const checkpoint=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
  // Only accelerate this isolated fixture's first deadline. No production test command.
  checkpoint.sites=[];checkpoint.enemies=[];checkpoint.director.nextRaid=0;
  db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(checkpoint));
  db.prepare('UPDATE scouts SET x=40.5,y=40.5 WHERE id=?').run(pilot);
  db.prepare('INSERT INTO robot_states VALUES (?,?) ON CONFLICT(scout_id) DO UPDATE SET value=excluded.value').run(pilot,JSON.stringify({...freshLife(),deployed:true,shield:0}));
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core',pilot,20,20,99);db.close();await post('/api/campaigns/enter',{id});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#frenzy-status')).toContainText('RAID IN');
  // Same banner remains readable in HUD modes that hide the ordinary objectives.
  await page.evaluate(()=>document.body.classList.add('aircraft-control'));
  await expect(page.locator('#frenzy-status')).toBeVisible();
  await page.evaluate(()=>document.body.classList.remove('aircraft-control'));
  const first=await read();expect(first.combat.frenzy.source).toBe('natural');expect(first.combat.encounters.sequence).toBe(1);
  await page.reload();await expect(page.locator('#frenzy-status')).toContainText('RAID IN');
  await expect.poll(async()=>(await read()).combat.frenzy?.phase,{timeout:12000}).toBe('surge');
  const state=await read();expect(state.combat.enemies.length).toBeGreaterThan(0);expect(state.combat.encounters.sequence).toBe(1);
  await page.screenshot({path:'.local/natural-raid.png'});expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-natural-raid-'))throw Error('Unexpected fixture path');await rm(dir,{recursive:true,force:true});
 }
});
