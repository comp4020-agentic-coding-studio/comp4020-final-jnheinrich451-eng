import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])test('manual flight instruments and bank / '+(mobile?'bomber phone':'jet desktop'),async({browser},info)=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-flight-handling-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:3,width:512,height:512,terrain:Array(512*512).fill(2),sites:[]};
 const base=newAirbase('base','pilot',244,244,mobile?'bomber':'attack-jet');Object.assign(base.aircraft,{x:256,y:256,state:'flying',angle:0,speed:6,occupant:'pilot',leftBase:true});
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',256,256,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',240,240,4.5);db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await(await fetch('/api/world')).json()).airbases[0].aircraft);
  const hold=async(key,direction,ms)=>{if(mobile){const b=await page.locator('[data-direction="'+direction+'"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();}else{await page.locator('#world-canvas').focus();await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}};
  await expect(page.locator('#flight-meter')).toBeVisible();await expect(page.locator('#aircraft-controls')).toBeHidden();
  await hold('w','up',900);await expect.poll(async()=>(await state()).speed).toBeGreaterThan(7);
  await hold('d','right',300);await expect.poll(async()=>(await state()).angle).toBeGreaterThan(.01);await expect.poll(async()=>(await state()).bank).toBe(0);
  const level=await state();await page.waitForTimeout(400);expect((await state()).angle).toBeCloseTo(level.angle,5);expect((await state()).speed).toBeCloseTo(level.speed,3);
  await expect(page.locator('#aircraft-controls')).toBeHidden();await page.locator('#flight-systems-toggle').click();await expect(page.locator('#aircraft-controls')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#aircraft-controls')).toBeHidden();
  await page.waitForTimeout(250);await expect(page.locator('#aircraft-controls')).toBeHidden();await page.keyboard.press('u');await expect(page.locator('#aircraft-controls')).toBeVisible();await page.locator('#flight-systems-close').click();
  await page.screenshot({path:info.outputPath('flight-meter.png')});
  const saved=new DatabaseSync(path.join(dir,'world.sqlite'),{readOnly:true});expect(JSON.parse(saved.prepare('SELECT value FROM airbases WHERE id=?').get('base').value).aircraft.bank).toBeUndefined();saved.close();
  await page.reload();await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#flight-meter')).toBeVisible();expect((await state()).bank||0).toBe(0);await expect(page.locator('#aircraft-controls')).toBeHidden();
  if(mobile){await page.setViewportSize({width:844,height:390});await expect(page.locator('#flight-systems-toggle')).toBeInViewport();await page.screenshot({path:info.outputPath('flight-meter-landscape.png')});}
  expect(errors).toEqual([]);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-flight-handling-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
