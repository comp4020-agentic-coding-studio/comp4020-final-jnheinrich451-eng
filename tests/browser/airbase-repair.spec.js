import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase,airbaseGate} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`permanent ruins keep E for tanks and expose no repair action on ${mobile?'phone':'desktop'}`,async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-airbase-repair-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 const w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
 const base=newAirbase('near','pilot',40,40),gate=airbaseGate(base);
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',gate.x,gate.y,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',36,28,4.5);
 db.prepare('INSERT INTO tanks VALUES (?,?)').run('tank',JSON.stringify({id:'tank',owner:'pilot',occupant:null,x:gate.x-1,y:gate.y,podX:60,podY:20,elapsed:99,health:200,angle:0,turret:0,weapon:'HE',secondary:'APCR'}));
 const l=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get().value);l.groundSupplies=300;
 for(const b of [newAirbase('far','pilot',70,60),base]){
   b.destroyed=true;Object.assign(b.aircraft,{state:'destroyed',health:0,remaining:0});
   l.durability['airbase:'+b.id]={health:0,max:500,armor:2};
   db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));
 }
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.close();
 app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080}});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await(await fetch('/api/world')).json()));
  await expect(page.locator('#facility-service')).toBeHidden();
  await page.locator('#world-canvas').focus();await page.keyboard.press('e');
  await expect.poll(async()=>(await state()).me.body).toBe('rover');
  await page.keyboard.press('t');expect((await state()).logistics.jobs.near).toBeUndefined();
  await page.keyboard.press('e');await expect.poll(async()=>(await state()).me.body).toBe('robot');
  await page.locator('#world-canvas').focus();await page.keyboard.press('l');
  await expect(page.locator('#logistics-dialog')).toBeVisible();
  await expect(page.locator('#logistics-repair-help')).toContainText('cannot be repaired');
  await expect(page.locator('#logistics-rebuild')).toHaveText('Locate ruin');
  await page.locator('#logistics-repair-help').scrollIntoViewIfNeeded();
  await page.screenshot({path:'.local/permanent-ruins-'+(mobile?'phone':'desktop')+'.png'});
  await page.locator('#logistics-rebuild').click();await expect(page.locator('#logistics-dialog')).toBeHidden();
  await page.screenshot({path:'.local/permanent-ruins-map-'+(mobile?'phone':'desktop')+'.png'});
  await page.locator('#world-canvas').focus();await page.keyboard.press('l');
  await page.keyboard.press('Escape');await expect(page.locator('#logistics-dialog')).toBeHidden();
  await page.setViewportSize(mobile?{width:844,height:390}:{width:1440,height:900});
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  const s=await state();expect(s.airbases.every(b=>b.destroyed)).toBe(true);expect(s.logistics.groundSupplies).toBe(300);expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();
  if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-airbase-repair-'))throw Error('Unexpected test path');
  await rm(dir,{recursive:true,force:true});
 }
});
