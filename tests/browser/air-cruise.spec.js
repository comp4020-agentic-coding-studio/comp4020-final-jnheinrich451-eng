import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase} from '../../public/aircraft.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
for(const mobile of [false,true])test('shared airfield cruise / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(50000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-air-cruise-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify({...createWorld(),width:128,height:96,version:2,terrain:Array(128*96).fill(2),sites:[]}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',54.6,56.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',63,60,4.5);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 const a=newAirbase('source','pilot',48,48),b=newAirbase('destination','pilot',85,48);b.aircraft.state='vacant';b.aircraft.health=0;for(const base of [a,b])db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await fetch('/api/world')).json()),plane=async()=>(await state()).airbases.find(b=>b.id==='source').aircraft;
  await expect(page.locator('#aircraft-interact')).toBeEnabled();await expect(page.locator('#aircraft-cruise')).toBeEnabled();await page.screenshot({path:'.local/cruise-apron-'+mobile+'.png'});
  await page.locator('#aircraft-cruise').click();await expect.poll(async()=>(await plane()).mission?.phase,{timeout:5000}).toBe('cruise');expect((await state()).me.body).toBe('robot');
  await page.reload();await expect(page.locator('#connection')).toContainText('live');await page.locator('#bomber-open').click();await expect(page.locator('#bomber-status')).toContainText('CRUISE');await expect(page.locator('#bomber-select option:checked')).toContainText('CRUISING');await expect(page.locator('#bomber-payload')).toBeEnabled();
  await page.locator('#bomber-x').fill('85');await page.locator('#bomber-y').fill('40');await page.locator('#bomber-bearing').selectOption('1');await page.locator('#bomber-payload').selectOption('HEAVY');await expect(page.locator('#bomber-dispatch')).toBeEnabled();
  await page.locator('#bomber-landing-base').selectOption('destination');await page.screenshot({path:'.local/cruise-planner-'+mobile+'.png'});await page.locator('#bomber-recall').click();
  await expect.poll(async()=>(await plane()).baseId).toBe('destination');await expect(page.locator('#bomber-select option:checked')).toContainText('RETURNING');await expect.poll(async()=>(await plane()).state,{timeout:22000}).toBe('parked');await expect(page.locator('#bomber-select option:checked')).toContainText(/PARKED|REARMING/);await expect(page.locator('#bomber-recall-help')).toContainText('Already on the ground');
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await plane()).baseId).toBe('destination');expect((await plane()).x).toBe(87);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-air-cruise-'))throw Error('Unexpected test directory');await rm(dir,{recursive:true,force:true});}
});
