import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase,airbaseGate} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const method of ['key','button'])test(`direct airbase repair by ${method} keeps E for tanks`,async({browser})=>{
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
  context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await(await fetch('/api/world')).json()));
  await expect(page.locator('.service-rebuild')).toBeEnabled();
  await page.locator('.service-close').click();await page.locator('#world-canvas').focus();await page.keyboard.press('e');
  await expect.poll(async()=>(await state()).me.body).toBe('rover');
  expect((await state()).logistics.groundSupplies).toBe(300);
  await page.keyboard.press('t');expect((await state()).logistics.jobs.near).toBeUndefined();
  await page.keyboard.press('e');await expect.poll(async()=>(await state()).me.body).toBe('robot');
  await expect(page.locator('#aircraft-interact')).toHaveText('Rebuild airbase / 150 GND / T');
  await expect(page.locator('#aircraft-interact')).toBeEnabled();
  if(method==='key'){await page.locator('#world-canvas').focus();await page.keyboard.down('t');await page.keyboard.down('t');await page.keyboard.up('t');}
  else await page.locator('#aircraft-interact').click();
  await expect(page.locator('#logistics-dialog')).toBeHidden();
  await expect(page.locator('#aircraft-interact')).toContainText('Rebuilding /');
  await expect(page.locator('#aircraft-interact')).toBeDisabled();
  await expect.poll(async()=>(await state()).airbases.find(b=>b.id==='near').destroyed,{timeout:12000}).toBe(false);
  let s=await state();expect(s.logistics.groundSupplies).toBe(150);expect(s.airbases.find(b=>b.id==='far').destroyed).toBe(true);
  await page.keyboard.press('Escape');await page.reload();await expect(page.locator('#connection')).toContainText('live');
  const build=page.locator('#facility-service [data-kind="bomber"]');await expect(build).toBeEnabled();await build.click();
  await expect.poll(async()=>(await state()).airbases.some(b=>b.aircraft.state==='delivering')).toBe(true);
  s=await state();expect(s.logistics.groundSupplies).toBe(125);expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();
  if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-airbase-repair-'))throw Error('Unexpected test path');
  await rm(dir,{recursive:true,force:true});
 }
});
