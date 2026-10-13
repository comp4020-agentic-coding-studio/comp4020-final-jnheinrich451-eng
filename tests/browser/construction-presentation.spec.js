import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { createWorld } from '../../public/world.js';
import { freshLogistics } from '../../public/logistics.js';
import { freshLife } from '../../public/survival.js';
import { shipSite } from '../../public/ship.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test(`construction presentation and funded naval replacement on ${mobile?'phone':'desktop'}`,async({browser})=>{
  test.setTimeout(40000);
  const dir=await mkdtemp(path.join(tmpdir(),'frontier-assembly-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
  await app.close();
  const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
  const world={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[],cores:[],ships:[]};
  for(let y=0;y<96;y++)for(let x=21;x<=40;x++)world.terrain[y*128+x]=0;
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Builder',19.6,25.5,0);
  db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',10,18,4.5);
  db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
  const ship={...shipSite(world,[],[],23,25,'pilot','gunship','unfolding').ship,id:'gunship',elapsed:4.5,dockReady:true,destroyed:true,health:0,replacement:0};
  db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));
  const logistics=freshLogistics();logistics.supplies=423;logistics.groundSupplies=100;
  db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(logistics));db.close();
  app=createApp({dataDir:dir,logSink:()=>{}});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
    context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
    const state=()=>page.evaluate(async()=>(await fetch('/api/world')).json());
    // The dock is the contextual interaction, on keyboard and touch.
    await expect(page.locator('#shipyard-interact')).toBeVisible();
    if(mobile)await page.locator('#shipyard-interact').click();else await page.keyboard.press('e');
    await expect(page.locator('#shipyard-dialog')).toBeVisible();
    await expect(page.locator('#shipyard-status')).toContainText('Vessel lost');
    await expect(page.locator('#navy-vessel')).toHaveCount(0);await expect(page.locator('#shipyard-kind')).toHaveCount(0);
    await expect(page.locator('#yard-build-gunship')).toBeEnabled();await page.screenshot({path:`.local/naval-rebuild-${mobile?'phone':'desktop'}.png`});
    await page.locator('#yard-build-gunship').click();await expect.poll(async()=>(await state()).ships[0].destroyed).toBe(false);
    const after=await state();expect(after.ships).toHaveLength(1);expect(after.logistics.groundSupplies).toBe(40);expect(after.logistics.supplies).toBe(423);
    await expect(page.locator('#shipyard-choices')).toBeHidden();
    await page.locator('#shipyard-close').click();
    await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();await expect(page.locator('#ship-card')).toContainText('60 GND / AT SHIPYARD');await page.locator('#ship-card').click();expect((await state()).ships).toHaveLength(1);
    await page.locator('#shipyard-new-dialog').click();await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').fill('23');await page.locator('#tile-y').fill('36');await page.locator('#select-tile').click();await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
    await expect.poll(async()=>(await state()).logistics.shipyards.length).toBe(2);
    const yard=(await state()).logistics.shipyards.find(y=>y.id!=='gunship');
    await expect.poll(async()=>(await state()).logistics.shipyards.find(y=>y.id===yard.id).dockReady,{timeout:6500}).toBe(true);
    await page.locator('#build-mode').click();await page.locator('[data-force-tab="navy"]').click();await page.locator('#submarine-card').click();await page.locator('#shipyard-select').selectOption(yard.id);await expect(page.locator('#yard-build-submarine')).toBeDisabled();await expect(page.locator('#yard-reason-submarine')).toContainText('Need 70 ground SUP');
    await expect(page.locator('#shipyard-dialog')).toBeVisible();await page.screenshot({path:'.local/shipyards-'+(mobile?'phone':'desktop')+'.png'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#shipyard-close').click();
    // Render known saved countdowns through the actual logistics renderer. This
    // makes each phase reviewable without racing a 1.35-second landing window.
    const result=await page.evaluate(async()=>{
      const {ConstructionEffects,assemblyStage}=await import('/construction-effects.js');
      const {drawLogistics}=await import('/logistics-effects.js');
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=540;canvas.id='assembly-review';document.body.append(canvas);
      Object.assign(canvas.style,{position:'fixed',inset:'0',zIndex:'100',width:'100vw',height:'auto',background:'#24433c'});
      const c=canvas.getContext('2d'),T=42,effects=new ConstructionEffects(T);
      const w={width:24,height:12,terrain:Array(288).fill(2),cores:[{x:1,y:3,elapsed:4.5}],tanks:[],ships:[],airbases:[],artillery:[],sites:[],logistics:{facilities:[],recyclers:[],salvage:{},crates:[],jobs:{},durability:{}}};
      for(const [i,remaining]of[7.7,4.5,0].entries()){
        const x=3+i*7;w.logistics.facilities.push({id:'uplink-'+i,kind:'uplink',x,y:5,remaining,cargo:0,launch:0});
        w.logistics.recyclers.push({id:'recycler-'+i,kind:'recycler',x:x+1.5,y:10,remaining:i===0?4.2:i===1?1:0,angle:0,cargo:0});
      }
      c.fillStyle='#24433c';c.fillRect(0,0,1000,540);drawLogistics(c,w,[],T,1,false,'pilot',effects,0);
      const pixels=()=>c.getImageData(0,0,1000,540).data.reduce((n,v)=>n+v,0);
      const before=pixels();c.clearRect(0,0,1000,540);c.fillStyle='#24433c';c.fillRect(0,0,1000,540);drawLogistics(c,w,[],T,1,false,'pilot',effects,0);const same=before===pixels();
      return {same,phase:assemblyStage(.01,8,20).phase,active:assemblyStage(.01,8,20).active};
    });
    expect(result).toEqual({same:true,phase:'ASSEMBLING',active:true});
    await page.locator('#assembly-review').screenshot({path:`.local/construction-phases-${mobile?'phone':'desktop'}.png`});
    await page.evaluate(async()=>{
      const {ShipEffects,drawShip}=await import('/ship-effects.js'),{ConstructionEffects}=await import('/construction-effects.js'),{drawWrecks,drawShipAssembly}=await import('/shipyard-effects.js');
      const canvas=document.querySelector('#assembly-review'),c=canvas.getContext('2d'),T=42;
      c.fillStyle='#31575c';c.fillRect(0,0,1000,540);c.fillStyle='#94a676';c.fillRect(0,0,1000,120);
      const effects=new ShipEffects(T),workers=new ConstructionEffects(T),yard={dock:{x:4,y:2.5,angle:Math.PI},berthX:7,berthY:5.5,dockStyle:'unfolding',dockReady:true,elapsed:4.5};effects.dock(c,yard,1);
      const ship={...yard,id:'review',kind:'gunship',x:7,y:5.5,angle:Math.PI,turret:Math.PI,elapsed:2,assemblyRemaining:6};
      drawShipAssembly(c,{},ship,T,1,false,workers);
      drawWrecks(c,{logistics:{wrecks:[{x:12,y:8,angle:.7}]}},T,1);
      const docked={...ship,repairing:true,repairTime:1,x:19,y:5.5,angle:Math.PI/2,turret:0,elapsed:4.5,assemblyRemaining:0,ramp:{x:19,y:2.5},rampGun:{angle:-Math.PI/2,destroyed:false}};
      drawShip(c,docked,T,false,1,0,true);effects.ramp(c,docked,docked.ramp,1);drawShipAssembly(c,{ships:[],logistics:{shipyards:[{...yard,berthX:19,berthY:5.5,dock:{x:19,y:2.5,angle:Math.PI/2}}]}},docked,T,1,false,workers);
      c.fillStyle='#f0dfac';c.font='18px monospace';c.fillText('SHIPYARD ASSEMBLY',100,470);c.fillText('SINKING TRACE',450,470);c.fillText('SENTRY + REPAIR',735,470);
    });
    await page.locator('#assembly-review').screenshot({path:'.local/naval-effects-'+(mobile?'phone':'desktop')+'.png'});
    await page.evaluate(async()=>{const{ConstructionEffects}=await import('/construction-effects.js');const canvas=document.querySelector('#assembly-review');const c=canvas.getContext('2d');new ConstructionEffects(42).draw(c,{cores:[],logistics:{facilities:[]}}, {x:2,y:2},1,{active:true,time:.4,reveal:0,phase:'INBOUND'},1,true);canvas.remove();});
    expect(errors).toEqual([]);
  }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-assembly-'))throw Error('Unexpected path');await rm(dir,{recursive:true,force:true});}
});
