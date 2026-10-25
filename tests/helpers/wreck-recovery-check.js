import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkWreckRecovery(browser,mobile=false){
 for(const sea of [false,true]){
  const f=await wreckRecoveryFixture({sea}),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
  try{
   await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
   if(sea){
    await page.locator('#ship-systems-toggle').click();await expect(page.locator('#transport-status')).toContainText('salvage');
    await expect.poll(async()=>(await f.state()).ships.find(s=>s.id==='transport').cargo.vehicle.cargo,{timeout:5000}).toBe(180);
    await expect(page.locator('#transport-status')).toContainText('180/180');
   }else{
    await expect.poll(async()=>(await f.state()).logistics.recyclers.find(r=>r.id==='r0').cargo,{timeout:7000}).toBeCloseTo(50);
    await page.locator('#supplies-button').click();
    await expect(page.locator('#salvage-target')).toContainText('Friendly factory wreck / 75 salvage');
    await page.keyboard.press('Escape');
   }
   await page.screenshot({path:'.local/wreck-'+(sea?'sea':'land')+'-'+(mobile?'phone':'desktop')+'.png'});
   await page.reload();await expect(page.locator('#connection')).toContainText('live');
   if(sea)expect((await f.state()).ships.find(s=>s.id==='transport').cargo.vehicle.cargo).toBe(180);
   else expect((await f.state()).logistics.recyclers.find(r=>r.id==='r0').cargo).toBeCloseTo(50);
   if(!mobile)await page.setViewportSize({width:1024,height:768});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await context.close();await f.close();}
 }
}
