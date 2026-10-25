import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {newAirbase} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
for(const mobile of [false,true])for(const kind of ['bomber','attack-jet'])test(`refined ${kind} weapons and HUD on ${mobile?'phone':'desktop'}`,async({browser},info)=>{
 test.setTimeout(45000);const dir=await mkdtemp(path.join(tmpdir(),'frontier-air-power-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context,peerContext;
 await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:3,width:512,height:512,terrain:Array(512*512).fill(2),sites:[]},b=newAirbase('base','pilot',244,244,kind);
 Object.assign(b.aircraft,{x:256,y:256,state:'takeoff',remaining:2,angle:0,speed:6,occupant:'pilot',leftBase:true,runs:0,rounds:0});
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',256,256,0);db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',240,240,4.5);db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  peerContext=await browser.newContext();const peer=await peerContext.newPage();await peer.goto(url+'/?legacy=1');const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');await page.bringToFront();
  const state=()=>peer.evaluate(async()=>await(await fetch('/api/world')).json()),plane=async()=>(await state()).airbases[0].aircraft;
  await expect(page.locator('#flight-weapons')).toBeVisible();await expect(page.locator('#aircraft-controls')).toBeHidden();await page.screenshot({path:info.outputPath('takeoff.png')});await expect.poll(async()=>(await plane()).state).toBe('flying');
  if(kind==='bomber'){
   await page.locator('#world-canvas').focus();await page.keyboard.press('2');await expect(page.locator('[data-flight-payload="HEAVY"]')).toHaveAttribute('aria-pressed','true');
   await page.screenshot({path:info.outputPath('heavy-preview.png')});await page.locator('#flight-fire').click();await expect.poll(async()=>(await plane()).bombCooldown).toBeGreaterThan(10);
   await page.locator('[data-flight-payload="HE"]').click();await expect(page.locator('#flight-fire')).toBeDisabled();
   await expect.poll(async()=>(await state()).combat.marks.some(m=>m.kind==='crater'&&m.size===24)).toBe(true);
   await expect(page.locator('#flight-fire')).toBeEnabled({timeout:18000});await page.locator('#flight-fire').click();await expect.poll(async()=>(await state()).combat.barrages[0]?.missiles.length).toBe(12);
  }else{
   for(const id of ['flight-fire','flight-rapid']){const pos=await page.locator('#'+id).boundingBox(),button=!mobile&&id==='flight-rapid'?'right':'left';await page.mouse.move(mobile?pos.x+pos.width/2:960,mobile?pos.y+pos.height/2:500);await page.mouse.down({button});await expect.poll(async()=>(await state()).combat.shots.filter(s=>s.mount===(id==='flight-fire'?'jet-cannon':'jet-30mm')).length,{intervals:[50]}).toBeGreaterThan(2);await page.screenshot({path:info.outputPath(id+'.png')});await page.mouse.up({button});
    const last=(await state()).combat.shots.at(-1)?.id;await page.waitForTimeout(350);expect((await state()).combat.shots.at(-1)?.id).toBe(last);
   }
   expect((await state()).combat.marks.some(m=>m.size===.55)).toBe(true);expect((await plane()).rounds).toBe(0);
   await page.locator('#world-canvas').focus();await page.keyboard.down('j');await page.waitForTimeout(220);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const last=(await state()).combat.shots.at(-1)?.id;await page.waitForTimeout(350);expect((await state()).combat.shots.at(-1)?.id).toBe(last);await page.keyboard.up('j');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  }
  await page.locator('#world-canvas').focus();await page.keyboard.down('d');await expect.poll(async()=>(await plane()).bank).toBeGreaterThan(.1);await page.screenshot({path:info.outputPath('bank.png')});await page.keyboard.up('d');
  await page.locator('#flight-systems-toggle').click();await expect(page.locator('#aircraft-controls')).toBeHidden();await page.locator('#world-canvas').focus();await page.keyboard.press('c');await page.keyboard.press('u');await expect(page.locator('#aircraft-controls')).toBeHidden();await page.keyboard.press('c');
  await page.reload();await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#flight-weapons')).toBeVisible();
  await page.screenshot({path:info.outputPath('hud.png')});if(mobile){await page.setViewportSize({width:844,height:390});await expect(page.locator('#flight-fire')).toBeInViewport();await page.screenshot({path:info.outputPath('landscape.png')});}
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await peerContext?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-air-power-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
