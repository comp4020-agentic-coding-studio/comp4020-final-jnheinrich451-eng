import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {freshLogistics} from '../../public/logistics.js';
import {newAirbase} from '../../public/aircraft.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
async function field(browser,mobile=false,cruise=false,landing=null){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-helicopter-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 const w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),supplies:1600,groundSupplies:1000}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',47.5,42.5,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',42,47,99);
 const b=newAirbase('pad','pilot',45,40,'helicopter','helipad'),empty=newAirbase('runway','pilot',60,40);empty.aircraft.state='vacant';
 if(landing){b.destroyed=landing==='destroyed';Object.assign(b.aircraft,{state:'flying',occupant:'pilot',x:46.5,y:41.5,leftBase:false});}
 if(cruise)Object.assign(b.aircraft,{state:'flying',x:50,y:40,leftBase:true,mission:{id:'hold',kind:'cruise',phase:'cruise',elapsed:0,cruiseCenter:{x:50,y:40}}});
 for(const base of [b,empty])db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();
 app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
 return {page,errors,state:()=>page.evaluate(async()=>(await fetch('/api/world')).json()),post:(route,data)=>page.evaluate(async({route,data})=>{const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};},{route,data}),async close(){await context.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-helicopter-'))throw Error('Bad fixture path');await rm(dir,{recursive:true,force:true});}};
}
const plane=s=>s.airbases.find(b=>b.id==='pad').aircraft;
async function tile(p,x,y){if(!await p.locator('#tile-x').isVisible())await p.locator('#coordinate-details summary').click();await p.locator('#tile-x').fill(String(x));await p.locator('#tile-y').fill(String(y));await p.locator('#select-tile').click();}
for(const mobile of [false,true])test('helicopter manual flight and sweeping rocket pods / '+(mobile?'phone':'desktop'),async({browser})=>{
 test.setTimeout(45000);const f=await field(browser,mobile),p=f.page;try{
  await expect(p.locator('#facility-service')).toContainText('Helipad workshop');await expect(p.locator('#facility-service [data-kind="helicopter"]')).toBeVisible();await expect(p.locator('#facility-service [data-kind="bomber"]')).toHaveCount(0);
  await p.locator('#aircraft-interact').click();await expect.poll(async()=>{const a=plane(await f.state());return {state:a.state,remaining:a.remaining,errors:f.errors};},{timeout:12000}).toMatchObject({state:'flying',remaining:0,errors:[]});
  await expect(p.locator('#aircraft-name')).toHaveText('HELICOPTER');await expect(p.locator('#aircraft-payload-label')).toBeHidden();await expect(p.locator('#helicopter-rockets')).toBeVisible();
  await p.locator('#world-canvas').focus();await p.keyboard.down('d');await expect.poll(async()=>plane(await f.state()).x).toBeGreaterThan(49);await p.keyboard.up('d');
  const box=await p.locator('#world-canvas').boundingBox(),x=box.x+box.width*.65,y=box.y+box.height*.32;await p.mouse.move(x,y);
  if(mobile){await p.locator('#world-canvas').tap({position:{x:box.width*.65,y:box.height*.32}});const button=await p.locator('#helicopter-rockets').boundingBox();await p.mouse.move(button.x+button.width/2,button.y+button.height/2);await p.mouse.down();}
  else await p.mouse.down({button:'right'});
  await expect.poll(async()=>plane(await f.state()).rockets).toBeLessThan(39);
  if(!mobile)await p.mouse.move(box.x+box.width*.3,box.y+box.height*.4);else await p.touchscreen.tap(box.x+box.width*.25,box.y+box.height*.35);
  await expect.poll(async()=>plane(await f.state()).turret).toBeLessThan(0);
  await p.mouse.up({button:mobile?'left':'right'});const spent=plane(await f.state()).rockets;expect(spent).toBeLessThan(40);
  const cannon=await p.locator('#aircraft-bomb').boundingBox();await p.mouse.move(cannon.x+cannon.width/2,cannon.y+cannon.height/2);await p.mouse.down();await expect.poll(async()=>plane(await f.state()).rounds).toBeLessThan(119);await p.mouse.up();
  await p.screenshot({path:'.local/helicopter-flight-'+mobile+'.png'});
  await p.reload();await expect(p.locator('#connection')).toContainText('live');expect(plane(await f.state()).rockets).toBeLessThanOrEqual(spent);await expect(p.locator('#aircraft-name')).toHaveText('HELICOPTER');
  expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('helipad deployment and helicopter delivery respect prices and runway compatibility',async({browser})=>{
 const f=await field(browser),p=f.page;try{
  await p.locator('#build-mode').click();await p.locator('#tab-air').click();await p.locator('#helipad-card').click();await tile(p,35,35);await expect(p.locator('#site-title')).toContainText('3 x 3');await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).airbases.length).toBe(3);let s=await f.state(),pad=s.airbases.find(b=>b.x===35);expect(pad.kind).toBe('helipad');expect(pad.aircraft.state).toBe('vacant');expect(s.logistics.supplies).toBe(1440);
  await expect.poll(async()=>!!(await f.state()).logistics.jobs[pad.id],{timeout:15000}).toBe(false);
  await p.locator('#build-mode').click();await p.locator('#tab-air').click();await p.locator('#helicopter-card').click();await tile(p,61,42);await expect(p.locator('#place-building')).toBeDisabled();expect((await f.post('aircraft/deliver',{id:'runway',kind:'helicopter',newOnly:true})).status).toBe(409);
  await tile(p,36,36);await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  s=await f.state();expect(s.logistics.supplies).toBe(1380);expect(s.logistics.freeBomberUsed).toBe(false);expect(s.airbases.some(b=>b.aircraft.kind==='helicopter'&&b.aircraft.baseId===pad.id&&b.aircraft.state==='delivering')).toBe(true);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('remote helicopter support accepts an area while the robot keeps moving',async({browser})=>{
 const f=await field(browser,false,true),p=f.page;try{
  await p.locator('#remote-mode').click();await p.locator('[data-remote-id="air:pad"]').click();await expect(p.locator('#remote-air-name')).toContainText('HELICOPTER');await expect(p.locator('#remote-air-payload')).toBeHidden();
  await p.locator('#world-canvas').focus();const before=(await f.state()).me.x;await p.keyboard.down('d');await expect.poll(async()=>(await f.state()).me.x).toBeGreaterThan(before+.3);await p.keyboard.up('d');
  const box=await p.locator('#world-canvas').boundingBox();await p.mouse.click(box.x+box.width*.6,box.y+box.height*.4);
  await expect.poll(async()=>plane(await f.state()).mission?.weapon).toBe('helicopter');await expect(p.locator('#remote-air')).toBeHidden();expect(plane(await f.state()).occupant).toBeNull();expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

for(const destroyed of [false,true])test('helicopter E landing distinguishes intact and destroyed pads / '+destroyed,async({browser})=>{
 test.setTimeout(30000);const f=await field(browser,false,false,destroyed?'destroyed':'intact'),p=f.page;
 try{
  await expect(p.locator('#aircraft-interact')).toHaveText('Land / E');await expect(p.locator('#aircraft-interact')).toBeEnabled();
  await p.locator('#world-canvas').focus();await p.keyboard.press('e');
  if(destroyed){
   await expect(p.locator('#aircraft-status')).toHaveText('HELIPAD DESTROYED');await expect(p.locator('#aircraft-manual')).toContainText('Helipad destroyed');
   const s=await f.state();expect(plane(s).state).toBe('flying');expect(plane(s).occupant).toBe('pilot');
   const result=await f.post('aircraft/exit',{});expect(result.status).toBe(409);expect(result.body.error).toContain('Helipad destroyed');
   await p.screenshot({path:'.local/helipad-destroyed-feedback.png'});
  }else{
   await expect(p.locator('#aircraft-interact')).toHaveText('Landing / wait');
   await expect.poll(async()=>plane(await f.state()).state,{timeout:12000}).toBe('parked');
   await expect(p.locator('#aircraft-interact')).toHaveText('Disembark / E');await expect(p.locator('#aircraft-interact')).toBeEnabled();
   await p.locator('#world-canvas').focus();await p.keyboard.press('e');
   await expect.poll(async()=>(await f.state()).me.body).toBe('robot');expect(plane(await f.state()).occupant).toBeNull();
  }
  expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
