import {newAirbase} from '../../public/aircraft.js';
import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

async function field(browser,mobile,airKind=null){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-remote-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID(),peerToken=randomUUID(),peerAbort=new AbortController();
 const w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',45.5,40.5,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',42,47,99);
 for(const gun of [
  {id:'cannon',owner:'pilot',x:35,y:35,shape:'EW',angle:Math.PI/2,aim:Math.PI/2,elevation:75,move:null,brace:0,input:null,inputTime:0},
  {id:'missile',owner:'pilot',kind:'missile',x:70,y:30,rotated:false}
 ])db.prepare('INSERT INTO artillery VALUES (?,?)').run(gun.id,JSON.stringify({ammo:'HE',reload:0,target:null,operator:null,lease:0,...gun}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(peerToken,'peer','Peer',48.5,40.5,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('peer',JSON.stringify({...freshLife(),deployed:true}));
 if(airKind){const b=newAirbase('air','pilot',48,48,airKind);Object.assign(b.aircraft,{x:50,y:55,state:'flying',speed:6,angle:Math.PI/2,leftBase:true,mission:{id:'cruise',kind:'cruise',phase:'cruise',cruiseCenter:{x:50,y:55},cruiseIndex:0,elapsed:0}});db.prepare('INSERT INTO airbases VALUES (?,?)').run(b.id,JSON.stringify(b));}
 db.close();app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+app.server.address().port,context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
 return {page,errors,async connectPeer(){const response=await fetch(url+'/api/events',{headers:{cookie:'frontier='+peerToken},signal:peerAbort.signal});void response.text().catch(()=>{});},async peerControl(release=false){return fetch(url+'/api/artillery/control',{method:'POST',headers:{cookie:'frontier='+peerToken,'Content-Type':'application/json'},body:JSON.stringify({id:'cannon',release})});},state:()=>page.evaluate(async()=>(await fetch('/api/world')).json()),async close(){peerAbort.abort();await context.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-remote-'))throw Error('Bad fixture path');await rm(dir,{recursive:true,force:true});}};
}
for(const mobile of [false,true])test('Ground catalogue and direct remote control / '+(mobile?'phone':'desktop'),async({browser})=>{
 const f=await field(browser,mobile),p=f.page;try{
  await p.locator('#build-mode').click();await p.locator('#tab-ground').click();
  for(const id of ['artillery-card','missile-card'])await expect(p.locator('#'+id)).toBeVisible();
  await p.locator('#tab-rail').click();await expect(p.locator('#artillery-card')).toBeHidden();await expect(p.locator('#rail-card')).toBeVisible();
  await p.locator('#tab-strike').click();await expect(p.locator('#missile-card')).toBeHidden();
  await p.keyboard.press('Escape');await expect(p.locator('#artillery-panel')).toHaveCount(0);
  for(const id of ['cannon','missile']){
   await p.locator('#remote-mode').click();await expect(p.locator('#remote-markers')).toBeVisible();
   const marker=p.locator('[data-remote-id="'+id+'"]');await expect(marker).toBeEnabled();
   const box=await marker.boundingBox(),view=p.viewportSize();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(view.width);
   await p.screenshot({path:'.local/remote-'+id+'-'+mobile+'.png'});
   if(mobile)await marker.tap();else await marker.click();
   await expect(p.locator('#facility-controls')).toBeVisible();await expect(p.locator('#remote-markers')).toBeHidden();
   await expect.poll(async()=>(await f.state()).artillery.find(g=>g.id===id).operator).toBe('pilot');
   expect((await f.state()).combat.salvos).toHaveLength(0);
   await p.keyboard.press('3');await expect.poll(async()=>(await f.state()).artillery.find(g=>g.id===id).ammo).toBe('GAS');
   await p.keyboard.press('Escape');await expect(p.locator('#facility-controls')).toBeHidden();
   await expect.poll(async()=>(await f.state()).artillery.find(g=>g.id===id).operator).toBeNull();
  }
  await p.locator('#world-canvas').focus();await p.keyboard.press('f');await expect(p.locator('#remote-markers')).toBeVisible();
  const before=(await f.state()).me.x;await p.keyboard.down('d');await expect.poll(async()=>(await f.state()).me.x-before).toBeGreaterThan(.2);await p.keyboard.up('d');
  await p.keyboard.press('l');await expect(p.locator('#logistics-dialog')).toBeVisible();await expect(p.locator('#remote-markers')).toBeHidden();await p.keyboard.press('Escape');expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

test('cancel an in-flight remote request releases its control lease',async({browser})=>{
 const f=await field(browser,false),p=f.page;try{
  let resume;const gate=new Promise(r=>resume=r);let entered=false;
  await p.route('**/api/artillery/control',async route=>{if(!route.request().postDataJSON().release){entered=true;await gate;}await route.continue();});
  await p.locator('#remote-mode').click();await p.locator('[data-remote-id="cannon"]').click();await expect.poll(()=>entered).toBe(true);
  await p.keyboard.press('Escape');resume();await expect(p.locator('#remote-markers')).toBeHidden();
  await expect.poll(async()=>await p.locator('#remote-mode').isEnabled()).toBe(true);
  expect((await f.state()).artillery.every(g=>!g.operator)).toBe(true);await expect(p.locator('#facility-controls')).toBeHidden();expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

 test('occupied facilities stay unavailable and concurrent acquisition is rejected',async({browser})=>{
  const f=await field(browser,false),p=f.page;try{
   await f.connectPeer();expect((await f.peerControl()).status).toBe(200);
   await p.locator('#remote-mode').click();const marker=p.locator('[data-remote-id="cannon"]');
   await expect(marker).toBeDisabled();await expect(marker).toHaveAttribute('title','Operated by another scout');
   expect((await f.peerControl(true)).status).toBe(200);await expect(marker).toBeEnabled();
   await p.route('**/api/artillery/control',async route=>{expect((await f.peerControl()).status).toBe(200);await route.continue();});
   await marker.click();await expect(p.locator('#toast')).toContainText('Another scout');
   await expect(p.locator('#remote-markers')).toBeVisible();await expect(p.locator('#facility-controls')).toBeHidden();
   expect((await f.state()).artillery.find(g=>g.id==='cannon').operator).toBe('peer');expect(f.errors).toEqual([]);
  }finally{await f.close();}
 });

for(const mobile of [false,true])for(const kind of ['bomber','attack-jet'])test('remote '+kind+' map strike keeps robot movement / '+(mobile?'phone':'desktop'),async({browser})=>{
 const f=await field(browser,mobile,kind),p=f.page;try{
  await p.locator('#remote-mode').click();const a=await p.locator('[data-remote-id="cannon"]').boundingBox(),b=await p.locator('[data-remote-id="missile"]').boundingBox();
  const scale=(b.x+b.width/2-a.x-a.width/2)/(72-35.5),x=a.x+a.width/2+(78-35.5)*scale,y=a.y+a.height/2+(45-35.5)*scale;
  const marker=p.locator('[data-remote-id="air:air"]');await expect(marker).toBeEnabled();if(mobile)await marker.tap();else await marker.click();
  await expect(p.locator('#remote-air')).toBeVisible();await expect(p.locator('#bomber-panel')).toBeHidden();
  const before=(await f.state()).me.x;await p.keyboard.down('d');await expect.poll(async()=>(await f.state()).me.x-before).toBeGreaterThan(.2);await p.keyboard.up('d');
  if(mobile){const move=p.locator('[data-direction="right"]'),box=await move.boundingBox();expect(await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('data-direction'),{x:box.x+box.width/2,y:box.y+box.height/2})).toBe('right');const start=(await f.state()).me.x;await move.hover();await p.mouse.down();await expect.poll(async()=>(await f.state()).me.x-start).toBeGreaterThan(.2);await p.mouse.up();}
  await p.keyboard.press('r');await expect(p.locator('#remote-air-rotate')).toContainText('East');
  if(!mobile)await p.mouse.move(x,y);await p.screenshot({path:'.local/remote-air-'+kind+'-'+mobile+'.png'});
  const response=p.waitForResponse(r=>r.url().endsWith('/api/aircraft/mission'));
  if(mobile)await p.touchscreen.tap(x,y);else await p.mouse.click(x,y);
  const result=await response;expect(await result.json()).toMatchObject({saved:true});expect(result.status()).toBe(201);
  await expect(p.locator('#remote-air')).toBeHidden();const state=await f.state();expect(state.me.body).toBe('robot');expect(state.airbases[0].aircraft.occupant).toBeNull();expect(state.airbases[0].aircraft.mission.resumeCruise).toBe(true);
  expect(state.airbases[0].aircraft.mission.weapon).toBe(kind==='bomber'?'bombs':'strafe');
  if(kind==='attack-jet'&&!mobile)await expect.poll(async()=>(await f.state()).airbases[0].aircraft.rounds,{timeout:22000}).toBeLessThan(90);
  expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
