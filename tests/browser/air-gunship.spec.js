import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase,parkingPoint} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])for(const kind of ['bomber','air-gunship'])test(`aligned parked ${kind} and manual guns on ${mobile?'phone':'desktop'}`,async({browser},info)=>{
 test.setTimeout(45000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-ac130-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:3,width:512,height:512,terrain:Array(512*512).fill(2),sites:[]},b=newAirbase('base','pilot',244,244,kind);
 Object.assign(b.aircraft,{...parkingPoint(b),state:'parked',occupant:'pilot'});
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',246,251.5,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',235,244,4.5);db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=async()=>await(await context.request.get(url+'/api/world')).json(),plane=async()=>(await state()).airbases[0].aircraft;
  await expect(page.locator('#aircraft-controls')).toBeVisible();await expect(page.locator('#aircraft-interact')).toHaveText('Disembark / E');
  for(const id of ['flight-weapons','aircraft-controls']){const stripe=await page.locator('#aircraft-interact').boundingBox(),box=await page.locator('#'+id).boundingBox();expect(Math.abs(box.x-stripe.x)).toBeLessThan(1);expect(Math.abs(box.width-stripe.width)).toBeLessThan(1);}
  await expect(page.locator('#aircraft-payload-label')).toBeHidden();await expect(page.locator('#aircraft-bomb')).toBeHidden();await page.screenshot({path:info.outputPath('parked.png')});
  if(kind==='air-gunship'){
   await expect(page.locator('[data-flight-gun="105"]')).toBeVisible();await expect(page.locator('[data-flight-payload="HE"]')).toBeHidden();
   await page.locator('#aircraft-launch').click();await expect.poll(async()=>(await plane()).state).toBe('flying');
   await page.locator('#world-canvas').focus();await page.keyboard.down('w');await expect.poll(async()=>(await plane()).speed).toBeGreaterThan(5);await page.keyboard.up('w');
   await page.keyboard.down('d');await expect.poll(async()=>(await plane()).bank).toBeGreaterThan(.15);await page.keyboard.up('d');
   await page.keyboard.press('c');
   for(const [i,weapon] of ['25','40','105'].entries()){
    await page.locator('#world-canvas').focus();await page.keyboard.press(String(i+1));await expect(page.locator('[data-flight-gun="'+weapon+'"]').first()).toHaveAttribute('aria-pressed','true');
    const box=await page.locator('#world-canvas').boundingBox();await page.mouse.move(box.x+box.width/2-(mobile?108:216),box.y+box.height/2);
    await page.mouse.down();await expect.poll(async()=>(await state()).combat.shots.filter(s=>s.mount==='air-gunship-'+weapon).length,{timeout:4000,intervals:[50]}).toBeGreaterThan(weapon==='25'?2:0);await page.mouse.up();
   }
   await page.screenshot({path:info.outputPath('left-battery.png')});
   expect((await plane()).gunshipCooldowns['105']).toBeGreaterThan(0);
   const p=await plane(),bad=await context.request.post(url+'/api/aircraft/gunship-fire',{data:{weapon:'105',target:{x:p.x+10,y:p.y}}});expect(bad.status()).toBe(409);
   const forged=await context.request.post(url+'/api/aircraft/gunship-fire',{data:{weapon:'999',target:{x:p.x-10,y:p.y}}});expect(forged.status()).toBe(400);
   await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await plane()).kind).toBe(kind);await expect(page.locator('[data-flight-gun="105"]')).toHaveAttribute('aria-pressed','true');
   await page.locator('#world-canvas').focus();await page.keyboard.down('a');await expect.poll(async()=>(await plane()).bank).toBeLessThan(-.15);await page.keyboard.up('a');
  }else{await page.locator('#world-canvas').focus();await page.keyboard.press('2');await expect(page.locator('[data-flight-payload="HEAVY"]')).toHaveAttribute('aria-pressed','true');}
  if(mobile){await page.setViewportSize({width:844,height:390});await expect(page.locator('#flight-fire')).toBeInViewport();await page.screenshot({path:info.outputPath('landscape.png')});}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await app.close();if(path.dirname(dir)!==tmpdir()||!path.basename(dir).startsWith('frontier-ac130-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
