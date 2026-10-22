import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`tank acceleration, coasting, reverse and turns / ${mobile?'phone':'desktop'}`,async({browser},info)=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-tank-handling-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
 db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(w),'world');
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',50.5,50.5,0);
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',36,28,4.5);
 db.prepare('INSERT INTO tanks VALUES (?,?)').run('tank',JSON.stringify({id:'tank',owner:'pilot',occupant:'pilot',x:50.5,y:50.5,podX:35,podY:50,elapsed:99,health:200,angle:0,turret:0,weapon:'HE',secondary:'APCR'}));db.close();
 app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const state=()=>page.evaluate(async()=>(await(await fetch('/api/world')).json()));
  const start=async(key,direction)=>{if(mobile){const box=await page.locator(`[data-direction="${direction}"]`).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();}else{await page.locator('#world-canvas').focus();await page.keyboard.down(key);}};
  const release=async(key)=>{if(mobile)await page.mouse.up();else await page.keyboard.up(key);};
  await start('w','up');await expect.poll(async()=>-(await state()).me.vy,{intervals:[100],timeout:10000}).toBeGreaterThan(2.9);
  const braking=(await state()).me;await release('w');
  await expect.poll(async()=>Math.hypot((await state()).me.vx,(await state()).me.vy),{intervals:[50]}).toBe(0);
  // Browser sampling includes gesture delivery and network latency. The domain
  // test separately checks the physical 0.71-tile stopping distance.
  const stopped=(await state()).me;expect(braking.y-stopped.y).toBeGreaterThan(.1);expect(braking.y-stopped.y).toBeLessThan(3);
  await page.waitForTimeout(300);expect((await state()).me.y).toBe(stopped.y);
  await start('s','down');await expect.poll(async()=>(await state()).me.vy,{intervals:[50]}).toBeGreaterThan(1.4);
  const reverse=(await state()).me;expect(reverse.vy).toBeLessThanOrEqual(1.61);expect(Math.abs(reverse.angle)).toBeLessThan(.05);
  await release('s');await expect.poll(async()=>(await state()).me.vy).toBe(0);
  await start('d','right');await expect.poll(async()=>(await state()).me.angle,{intervals:[50]}).toBeGreaterThan(.15);
  expect((await state()).me.angle).toBeLessThan(Math.PI/2);
  await expect.poll(async()=>(await state()).me.vx,{intervals:[50]}).toBeGreaterThan(2.9);await release('d');
  await expect.poll(async()=>(await state()).me.vx).toBe(0);
  await page.screenshot({path:info.outputPath('tank-handling.png')});
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await state()).me.vehicleId).toBe('tank');
  expect((await state()).me.vx).toBe(0);expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();
  if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-tank-handling-'))throw Error('Unexpected test path');
  await rm(dir,{recursive:true,force:true});
 }
});
