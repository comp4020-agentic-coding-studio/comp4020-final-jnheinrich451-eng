import {expect} from '@playwright/test';
import {navalRemoteFixture} from './naval-remote-fixture.js';
export async function checkNavalReturn(browser,phone,screenshot,options={}){
 const f=await navalRemoteFixture({returning:true,...options});let context;
 try{
  context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1920,height:1080},isMobile:phone,hasTouch:phone});
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  if(phone){await expect(page.locator('.service-return')).toBeVisible();await page.locator('.service-return').click();}
  else{
   await page.locator('#remote-mode').click();await page.locator('[data-remote-id="ship:ship"]').click();
   await expect(page.locator('#remote-naval [data-command="dock"]')).toBeEnabled();
   await page.screenshot({path:screenshot('return-command')});await page.locator('#remote-naval [data-command="dock"]').click();
   await expect(page.locator('#remote-naval')).toBeHidden();await page.keyboard.press('Escape');
  }
  const ship=async()=>(await f.state()).ships.find(s=>s.id==='ship');
  await expect.poll(async()=>(await ship()).remoteOrder?.kind).toBe('dock');
  await expect.poll(async()=>(await ship()).remoteOrder.phase,{timeout:60000}).toBe('docked');
  const s=await ship();expect(Math.hypot(s.x-s.berthX,s.y-s.berthY)).toBeLessThan(.8);expect(s.speed).toBe(0);
  await page.screenshot({path:screenshot('home-berth')});
  await page.locator('#world-canvas').focus();const before=(await f.state()).me.y;await page.keyboard.down('s');
  await expect.poll(async()=>(await f.state()).me.y).toBeGreaterThan(before+.2);await page.keyboard.up('s');
  await page.setViewportSize({width:phone?844:1280,height:phone?390:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
}
