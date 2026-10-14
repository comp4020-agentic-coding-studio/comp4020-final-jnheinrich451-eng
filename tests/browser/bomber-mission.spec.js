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
for(const mobile of [false,true])test('automatic bomber mission / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(70000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-bomber-browser-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 const world={...createWorld(),width:128,height:96,version:2,terrain:Array(128*96).fill(2),sites:[]};db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',54.6,56.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',63,60,4.5);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 db.prepare('INSERT INTO airbases VALUES (?,?)').run('base',JSON.stringify(newAirbase('base','pilot',48,48)));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await fetch('/api/world')).json());
  await page.locator('#bomber-open').click();await expect(page.locator('#bomber-panel')).toBeVisible();await page.locator('#bomber-x').fill('85');await page.locator('#bomber-y').fill('40');await page.locator('#bomber-bearing').selectOption('1');await expect(page.locator('#bomber-dispatch')).toBeEnabled();
  await page.screenshot({path:'.local/bomber-plan-'+(mobile?'phone':'desktop')+'.png'});await page.locator('#bomber-dispatch').click();await expect.poll(async()=>(await state()).airbases[0].aircraft.mission?.phase).toBe('takeoff');expect((await state()).me.body).toBe('robot');await expect(page.locator('#bomber-dispatch')).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.locator('#bomber-panel')).toBeHidden();await page.reload();await expect(page.locator('#connection')).toContainText('live');await page.keyboard.press('h');await expect(page.locator('#bomber-panel')).toBeVisible();await expect(page.locator('#bomber-dispatch')).toBeDisabled();
  await expect.poll(async()=>(await state()).airbases[0].aircraft.mission.released,{timeout:20000}).toBe(true);await page.screenshot({path:'.local/bomber-release-'+(mobile?'phone':'desktop')+'.png'});
  await expect.poll(async()=>(await state()).airbases[0].aircraft.mission.phase,{timeout:30000}).toBe('complete');await expect(page.locator('#bomber-status')).toContainText('COMPLETE');await expect(page.locator('#bomber-dispatch')).toBeEnabled();expect((await state()).airbases[0].aircraft.runs).toBe(2);
  await page.locator('#bomber-x').fill('2');await page.locator('#bomber-y').fill('2');await page.locator('#bomber-y').press('Tab');await expect(page.locator('#bomber-dispatch')).toBeDisabled();expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-bomber-browser-'))throw Error('Unexpected test directory');await rm(dir,{recursive:true,force:true});}
});
