import {expect} from '@playwright/test';
import {helicopterFieldFixture} from './helicopter-field-fixture.js';
import {navalRemoteFixture} from './naval-remote-fixture.js';
export async function checkRemoteBranches(browser,mobile=false){
 for(const kind of ['helicopter','submarine']){
  const heli=kind==='helicopter',f=heli?await helicopterFieldFixture({remote:true,sling:'recycler'}):await navalRemoteFixture({submarine:true});
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
  try{
   await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');await page.locator('#remote-mode').click();
   const marker=page.locator('[data-remote-id="'+(heli?'air:pad':'ship:ship')+'"]');await expect(marker).toBeEnabled();
   await expect.poll(async()=>(await marker.boundingBox()).x).toBeGreaterThan(20);
   const a=await marker.boundingBox(),origin={x:a.x+a.width/2,y:a.y+a.height/2};
   const tap=async(x,y)=>{if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);};
   const plane=async()=>(await f.state()).airbases.find(b=>b.id==='pad').aircraft;
   let scale=0;if(!heli){const b=await page.locator('[data-remote-id="ship:carrier"]').boundingBox();scale=(origin.x-b.x-b.width/2)/(97.5-40.5);}
   await marker.click();
   const before=(await f.state()).me.x;await page.locator('#world-canvas').focus();await page.keyboard.down('a');await expect.poll(async()=>(await f.state()).me.x).toBeLessThan(before-.25);await page.keyboard.up('a');
   if(heli){
    await page.locator('[data-heli="pickup"]').click();await page.screenshot({path:'.local/remote-helicopter-'+(mobile?'phone':'desktop')+'.png'});await tap(origin.x,origin.y);
    await expect.poll(async()=>(await plane()).sling?.vehicle.id).toBe('cargo');await expect.poll(async()=>(await plane()).mission.phase,{timeout:7000}).toBe('holding');
    await marker.click();await page.locator('[data-heli="drop"]').click();await tap(origin.x+45,origin.y-30);
    await expect.poll(async()=>!!(await plane()).sling,{timeout:18000}).toBe(false);expect((await f.state()).logistics.recyclers[0]).toMatchObject({id:'cargo',cargo:73});
    await marker.click();await page.keyboard.press('Escape');await expect(page.locator('#remote-air')).toBeHidden();
   }else{
    await page.locator('#world-canvas').focus();await page.keyboard.press('ControlLeft');await expect.poll(async()=>(await f.state()).ships.find(s=>s.id==='ship').depth,{timeout:5000}).toBe('submerged');
    await marker.click();await page.locator('[data-command="strike"]').click();await page.locator('#world-canvas').focus();await page.keyboard.press('r');await expect(page.locator('[data-command="rotate"]')).toContainText('8 x 6');
    await page.screenshot({path:'.local/remote-submarine-'+(mobile?'phone':'desktop')+'.png'});await tap(origin.x+(120-97.5)*scale,origin.y);
    await expect.poll(async()=>(await f.state()).combat.barrages.length).toBe(1);expect((await f.state()).combat.barrages[0].missiles[0].underwater).toBe(true);
   }
   await page.setViewportSize(mobile?{width:844,height:390}:{width:1280,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await context.close();await f.close();}
 }
}
