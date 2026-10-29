import {test,expect} from '@playwright/test';
import {wreckRecoveryFixture} from '../helpers/wreck-recovery-fixture.js';

async function fixture(browser,mobile,full=false){
 const f=await wreckRecoveryFixture();
 await f.restart(db=>{
  const l=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get().value);
  l.supplies=full?2000:1200;l.facilities=[{id:'rocket',kind:'uplink',owner:'pilot0',x:72,y:49,remaining:0,cargo:full?180:0,launch:0,cooldown:0}];
  l.recyclers=full?[]:[{id:'hauler',kind:'recycler',owner:'pilot0',x:65.5,y:50.5,angle:Math.PI/2,cargo:180,remaining:0,path:[],occupant:null}];
  db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  db.prepare("UPDATE scouts SET x=74.5,y=53.5 WHERE id='pilot0'").run();
 });
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 const open=async()=>{await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');};
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const close=async()=>{try{await context.close();}finally{await f.close();}};
 try{await open();}catch(e){await close();throw e;}
 return {f,page,errors,close};
}

for(const mobile of [false,true]){
 test('send station cargo directly, without a modal / '+(mobile?'phone':'desktop'),async({browser})=>{
  test.setTimeout(45000);const {f,page,errors,close}=await fixture(browser,mobile);
  try{
   const button=page.locator('#station-interact');
   await expect(button).toBeVisible();await expect(button).toBeDisabled();await expect(button).toContainText('No cargo');
   expect((await f.post('logistics/command',{id:'hauler',action:'deliver',targetId:'rocket'})).status).toBe(200);
   await expect(button).toContainText('180 SUP',{timeout:15000});await expect(button).toBeEnabled();
   await page.screenshot({path:'.local/uplink-control-ready-'+mobile+'.png'});
   let requests=0;page.on('request',r=>{if(r.url().endsWith('/api/logistics/launch'))requests++;});
   if(mobile)await button.tap();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');await page.keyboard.press('e');}
   await expect(button).toContainText('Launching');await expect(button).toBeDisabled();await expect(page.locator('#logistics-dialog')).not.toBeVisible();
   await page.screenshot({path:'.local/uplink-control-launch-'+mobile+'.png'});
   await expect.poll(async()=>(await f.state()).logistics.shipments,{timeout:8000}).toBe(1);
   expect((await f.state()).logistics.supplies).toBe(1380);expect(requests).toBe(1);
   await expect(button).toContainText('Rocket returning');
   await page.reload();await expect(page.locator('#connection')).toContainText('live');await expect(button).toContainText('Rocket returning');await expect(button).toBeDisabled();
   expect((await f.state()).logistics.facilities[0].cargo).toBe(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await close();}
 });
 test('full orbital storage keeps station cargo safe / '+(mobile?'phone':'desktop'),async({browser})=>{
  const {f,page,errors,close}=await fixture(browser,mobile,true);
  try{
   const button=page.locator('#station-interact');await expect(button).toContainText('ORB full');await expect(button).toBeDisabled();
   await page.locator('#world-canvas').focus();await page.keyboard.press('e');
   await expect(page.locator('#logistics-dialog')).not.toBeVisible();const state=await f.state();
   expect(state.logistics.facilities[0].cargo).toBe(180);expect(state.logistics.shipments).toBe(0);expect(errors).toEqual([]);
  }finally{await close();}
 });
}
