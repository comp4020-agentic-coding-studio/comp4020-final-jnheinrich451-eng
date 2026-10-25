import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLogistics} from '../../public/logistics.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export async function checkGroundSteering(browser,kind,mobile=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-ground-steering-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context,db;
 try{
  await app.close();db=new DatabaseSync(path.join(dir,'world.sqlite'));const token=randomUUID();
  const w={...createWorld(),version:3,width:96,height:96,terrain:Array(96*96).fill(2),sites:[]},l=freshLogistics();
  const vehicle={id:'vehicle',kind,owner:'pilot',occupant:'pilot',x:40.5,y:40.5,angle:Math.PI/2,turret:0,elapsed:99,podX:38,podY:40,remaining:0,cargo:0,path:[],health:200};
  if(kind==='tank')db.prepare('INSERT INTO tanks VALUES (?,?)').run(vehicle.id,JSON.stringify(vehicle));else l.recyclers=[vehicle];
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',40.5,40.5,Math.PI/2);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.close();db=null;
  app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');
  const state=async()=>await(await context.request.get(url+'/api/world')).json(),body=async()=>{const s=await state();return kind==='tank'?s.me:s.logistics.recyclers[0];};
  await expect(p.locator('#map-hint')).toContainText('W/S forward/reverse');
  const press=async(key,direction)=>{if(mobile){const b=await p.locator('[data-direction="'+direction+'"]').boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();}else{await p.locator('#world-canvas').focus();await p.keyboard.down(key);}};
  const release=async key=>{const stopped=p.waitForResponse(r=>{if(!r.url().endsWith('/api/input')||r.request().method()!=='POST')return false;const d=r.request().postDataJSON();return d.x===0&&d.y===0;});if(mobile)await p.mouse.up();else await p.keyboard.up(key);await stopped;};
  await p.screenshot({path:'.local/steering-start-'+kind+'-'+mobile+'.png'});const start=await body();await press('d','right');try{await expect.poll(async()=>(await body()).angle).toBeGreaterThan(start.angle+.25);}finally{await release('d');}
  await expect.poll(async()=>(await body()).vx||0).toBe(0);const turned=await body();expect(turned.x).toBeCloseTo(start.x);expect(turned.y).toBeCloseTo(start.y);
  const forward=q=>(q.x-turned.x)*Math.sin(turned.angle)-(q.y-turned.y)*Math.cos(turned.angle);
  await press('w','up');try{await expect.poll(async()=>forward(await body())).toBeGreaterThan(1);}finally{await release('w');}
  await expect.poll(async()=>{const b=await body();return Math.hypot(b.vx||0,b.vy||0);}).toBe(0);const parked=await body(),distance=forward(parked);
  await press('s','down');try{await expect.poll(async()=>forward(await body())).toBeLessThan(distance-.5);}finally{await release('s');}
  await expect.poll(async()=>{const b=await body();return Math.hypot(b.vx||0,b.vy||0);}).toBe(0);expect((await body()).angle).toBeCloseTo(turned.angle);
  await p.screenshot({path:'.local/ground-steering-'+kind+'-'+mobile+'.png'});await p.reload();await expect(p.locator('#connection')).toContainText('live');expect((await body()).angle).toBeCloseTo(turned.angle);expect(errors).toEqual([]);
 }finally{db?.close();await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-ground-steering-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}
}
