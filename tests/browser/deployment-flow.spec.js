import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {freshLogistics} from '../../public/logistics.js';
import {newAirbase} from '../../public/aircraft.js';
import {shipSite,SHIP} from '../../public/ship.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

async function field(browser,body='robot',mobile=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-deploy-flow-'));let app=createApp({dataDir:dir,logSink:()=>{}});await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 const w={...createWorld(),version:2,width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128<30?0:2),sites:[],ships:[]};
 const l={...freshLogistics(),supplies:1800,groundSupplies:1200};
 const a=newAirbase('occupied','pilot',60,55),b=newAirbase('empty','pilot',85,55);Object.assign(b.aircraft,{state:'vacant',health:0});
 let x=45.5,y=40.5;
 if(body==='air-workshop'){x=65.5;y=63.5;a.aircraft.purchase={id:'paid-bomber',pool:'groundSupplies',paid:25};}
 if(body==='dock-workshop'){const ship={...shipSite(w,[],[],27,40,'pilot','gunship','unfolding').ship,id:'service-ship',elapsed:SHIP.duration,health:300,purchase:{id:'paid-ship',pool:'groundSupplies',paid:60}};db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));x=ship.dock.x;y=ship.dock.y;}
 if(body==='aircraft'){Object.assign(a.aircraft,{occupant:'pilot',state:'flying',x:65,y:40,speed:8,leftBase:true});x=65;y=40;}
 if(body==='ship'){const ship={...shipSite(w,[],[],27,40,'pilot','gunship','unfolding').ship,id:'ship',elapsed:SHIP.duration,occupant:'pilot',x:20,y:40};db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));x=20;y=40;}
 if(body==='rover'||body==='wreck')db.prepare('INSERT INTO tanks VALUES (?,?)').run('tank',JSON.stringify({id:'tank',owner:'pilot',occupant:body==='wreck'?null:'pilot',destroyed:body==='wreck',replacement:0,x,y,podX:40,podY:40,elapsed:99,health:body==='wreck'?0:200,angle:0,turret:0,weapon:'HE',secondary:'APCR'}));
 if(body==='recycler')l.recyclers=[{id:'recycler',owner:'pilot',occupant:'pilot',x,y,remaining:0,angle:0,cargo:0,path:[]}];
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',x,y,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',42,47,99);
 for(const base of [a,b])db.prepare('INSERT INTO airbases VALUES (?,?)').run(base.id,JSON.stringify(base));db.close();
 app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
 return {page,errors,state:()=>page.evaluate(async()=>(await fetch('/api/world')).json()),post:(route,data)=>page.evaluate(async({route,data})=>{const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,body:await r.json()};},{route,data}),async close(){await context.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-deploy-flow-'))throw Error('Bad fixture path');await rm(dir,{recursive:true,force:true});}};
}
async function tile(page,x,y){if(!await page.locator('#tile-x').isVisible())await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill(String(x));await page.locator('#tile-y').fill(String(y));await page.locator('#select-tile').click();}
for(const mobile of [false,true])test('separate empty airbase and map-selected aircraft / '+(mobile?'phone':'desktop'),async({browser})=>{
 const f=await field(browser,'robot',mobile),p=f.page;try{
  await p.locator('#build-mode').click();await p.locator('#tab-air').click();
  await expect(p.locator('#airbase-card')).toContainText('Empty airbase');await expect(p.locator('#bomber-card')).toBeVisible();await expect(p.locator('#attack-jet-card')).toBeVisible();await expect(p.locator('#airbase-delivery-select')).toBeHidden();
  await p.locator('#airbase-card').click();await tile(p,40,18);await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).airbases.length).toBe(3);let s=await f.state();expect(s.airbases.find(b=>b.x===40).aircraft.state).toBe('vacant');expect(s.airbases.find(b=>b.id==='occupied').aircraft.kind).toBe('bomber');
  const spent=s.logistics.supplies;
  await p.locator('#build-mode').click();await p.locator('#tab-air').click();await p.locator('#attack-jet-card').click();
  await tile(p,62,58);await expect(p.locator('#site-reason')).toContainText('occupied');await expect(p.locator('#place-building')).toBeDisabled();
  const blocked=await f.post('aircraft/deliver',{id:'occupied',kind:'attack-jet',newOnly:true});expect(blocked.status).toBe(409);s=await f.state();expect(s.logistics.supplies).toBe(spent);expect(s.airbases.find(b=>b.id==='occupied').aircraft.kind).toBe('bomber');
  await p.keyboard.press('Escape');await p.locator('#build-mode').click();await p.locator('#tab-air').click();await p.locator('#bomber-card').click();await tile(p,87,58);
  await expect(p.locator('#place-building')).toBeEnabled();await p.screenshot({path:'.local/air-deploy-'+mobile+'.png'});await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).airbases.find(b=>b.id==='empty').aircraft.state).toBe('delivering');s=await f.state();expect(s.logistics.freeBomberUsed).toBe(true);expect(s.logistics.supplies).toBe(spent);expect(s.airbases).toHaveLength(3);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
test('naval deployment separates an empty dock from its map-selected ship',async({browser})=>{
 const f=await field(browser),p=f.page;try{
  await p.locator('#build-mode').click();await p.locator('#tab-navy').click();await p.locator('#dock-card').click();await tile(p,27,30);await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).logistics.shipyards.length).toBe(1);let s=await f.state();expect(s.ships).toHaveLength(0);const yard=s.logistics.shipyards[0];
  await expect.poll(async()=>(await f.state()).logistics.shipyards[0].elapsed,{timeout:10000}).toBeGreaterThanOrEqual(SHIP.duration);
  await p.locator('#build-mode').click();await p.locator('#tab-navy').click();await p.locator('#transport-card').click();await expect(p.locator('#shipyard-dialog')).toBeHidden();await tile(p,Math.floor(yard.dock.x),Math.floor(yard.dock.y));
  await expect(p.locator('#place-building')).toContainText('50 GND');await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).ships.length).toBe(1);s=await f.state();expect(s.ships[0]).toMatchObject({kind:'transport',yardId:yard.id,purchase:{paid:50,pool:'groundSupplies'}});expect(s.logistics.shipyards).toHaveLength(1);expect(s.logistics.groundSupplies).toBe(1150);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
for(const mobile of [false,true])for(const type of ['air','dock'])test('automatic '+type+' workshop exchanges and keeps WASD / '+(mobile?'phone':'desktop'),async({browser})=>{
 const f=await field(browser,type+'-workshop',mobile),p=f.page;try{
  const panel=p.locator('#facility-service');await expect(panel).toBeVisible();await expect(panel.locator('h2')).toHaveText(type==='air'?'Airbase workshop':'Dock workshop');
  const before=(await f.state()).me;await p.keyboard.down('w');await expect.poll(async()=>before.y-(await f.state()).me.y,{intervals:[50,100]}).toBeGreaterThan(.2);await p.keyboard.up('w');
  await expect(panel).toBeVisible();const choice=panel.locator('[data-kind="'+(type==='air'?'attack-jet':'submarine')+'"]');await expect(choice).toContainText(type==='air'?'5 GND':'22 GND');await expect(choice).toBeEnabled();await p.screenshot({path:'.local/workshop-'+type+'-'+mobile+'.png'});await choice.click();
  await expect.poll(async()=>{const s=await f.state();return type==='air'?s.airbases.find(b=>b.id==='occupied').aircraft.kind:s.ships[0].kind;}).toBe(type==='air'?'attack-jet':'submarine');
  await expect(panel.locator('.service-status')).toContainText('assembling');await expect(choice).toBeDisabled();const s=await f.state();expect(s.logistics.groundSupplies).toBe(type==='air'?1195:1178);expect(s.logistics.supplies).toBe(1800);expect(f.errors).toEqual([]);
  await p.keyboard.press('Escape');await expect(panel).toBeHidden();await p.waitForTimeout(300);await expect(panel).toBeHidden();
 }finally{await f.close();}
});
for(const body of ['robot','rover','recycler','ship','aircraft'])test('WASD controls '+body+' while deployment and logistics panels are open',async({browser})=>{
 const f=await field(browser,body),p=f.page,inputs=[];p.on('request',r=>{if(r.url().endsWith('/api/input'))inputs.push(r.postDataJSON());});try{
  await expect.poll(async()=>(await f.state()).me.body).toBe(body);
  await p.locator('#world-canvas').focus();await p.keyboard.press('b');await expect(p.locator('#deployment-tray')).toBeVisible();
  const before=(await f.state()).me,dir=body==='ship'?'w':'d';await p.keyboard.down(dir);
  await expect.poll(async()=>{const m=(await f.state()).me;return body==='aircraft'?Math.abs(m.angle-before.angle):Math.hypot(m.x-before.x,m.y-before.y);}).toBeGreaterThan(.3);await p.keyboard.up(dir);
  await expect.poll(()=>inputs.at(-1)?.x===0&&inputs.at(-1)?.y===0).toBe(true);expect(inputs.some(i=>dir==='w'?i.y===-1:i.x===1)).toBe(true);
  // A modal owns the mouse, but its close button must not consume driving keys.
  await p.keyboard.press('Escape');await p.locator('#world-canvas').focus();await p.keyboard.press('l');await expect(p.locator('#logistics-dialog')).toBeVisible();inputs.length=0;await p.keyboard.down(dir);await expect.poll(()=>inputs.some(i=>dir==='w'?i.y===-1:i.x===1)).toBe(true);await p.keyboard.up(dir);await expect.poll(()=>inputs.at(-1)?.x===0&&inputs.at(-1)?.y===0).toBe(true);
  if(body==='robot'){await expect(p.locator('#field-equipment')).toBeVisible();await expect(p.locator('#tank-find')).toBeVisible();await expect(p.locator('#artillery-open')).toBeVisible();}
  // Native select input owns keystrokes. No movement command should leak through.
  await p.locator('#recycler-select').focus();inputs.length=0;await p.keyboard.press('w');await p.waitForTimeout(350);expect(inputs.every(i=>i.x===0&&i.y===0)).toBe(true);
  expect(f.errors).toEqual([]);
 }finally{await f.close();}
});

test('tank replacement remains in Logistics after leaving the Ground catalogue',async({browser})=>{
 const f=await field(browser,'wreck'),p=f.page;try{
  await p.locator('#build-mode').click();await p.locator('#tab-air').click();await p.keyboard.press('Escape');await p.locator('#world-canvas').focus();await p.keyboard.press('l');
  await expect(p.locator('#tank-replace')).toBeVisible();await expect(p.locator('#tank-replace')).toBeEnabled();await p.locator('#tank-replace').click();await expect.poll(async()=>(await f.state()).tanks[0].destroyed).toBe(false);expect(f.errors).toEqual([]);
 }finally{await f.close();}
});
