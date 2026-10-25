import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLogistics} from '../../public/logistics.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`ground crew crosses above a ship, then the ship sails beneath / ${mobile?'phone':'desktop'}`,async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-underpass-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),tokens=[randomUUID(),randomUUID()];
 const world={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=30&&i%128<=41?0:2),sites:[],bridges:[]};
 const l=freshLogistics();l.bridges=[{id:'bridge',from:{x:29,y:40},to:{x:42,y:40},elapsed:99}];
 l.recyclers=[{id:'truck',kind:'recycler',owner:'crew',occupant:'crew',x:32.5,y:40.5,angle:Math.PI/2,cargo:0,remaining:0,path:[]}];
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
 for(const [i,id] of ['pilot','crew'].entries()){
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(tokens[i],id,id,i?32.5:35.5,40.5,0);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));
 }
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','crew',20,55,4.5);
 const ship={id:'ship',kind:'gunship',owner:'pilot',occupant:'pilot',x:35.5,y:40.5,berthX:32.5,berthY:46.5,dock:{x:29.5,y:46.5,angle:Math.PI/2},angle:0,turret:0,elapsed:4.5,health:300,ammo:'HE',reload:0};
 db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 const contexts=[];
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`,pages=[],errors=[];
  for(let i=0;i<2;i++){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});contexts.push(context);
   await context.addCookies([{name:'frontier',value:tokens[i],url}]);const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  }
  const [pilot,crew]=pages,state=()=>pilot.evaluate(async()=>(await fetch('/api/world')).json());
  await crew.bringToFront();await crew.locator('#world-canvas').focus();await crew.keyboard.down('d');
  await expect.poll(async()=>(await state()).logistics.recyclers[0].x,{timeout:6000}).toBeGreaterThan(37);
  await crew.keyboard.up('d');
  expect((await state()).ships[0].y).toBe(40.5);
  await pilot.bringToFront();await pilot.screenshot({path:`.local/bridge-underpass-${mobile?'mobile':'desktop'}.png`});
  await pilot.locator('#world-canvas').focus();for(let i=0;i<4;i++)await pilot.keyboard.press('w');
  await expect.poll(async()=>(await state()).ships[0].y,{timeout:10000}).toBeLessThan(34.5);
  expect(await pilot.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{
  await Promise.all(contexts.map(c=>c.close()));await app.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-underpass-'))throw Error('Bad fixture path');
  await rm(dir,{recursive:true,force:true});
 }
});
