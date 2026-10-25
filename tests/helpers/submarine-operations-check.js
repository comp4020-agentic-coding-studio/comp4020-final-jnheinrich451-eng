import {expect} from '@playwright/test';
import {navalRemoteFixture} from './naval-remote-fixture.js';
export async function checkSubmarineOperations(browser,phone,screenshot){
 const f=await navalRemoteFixture({returning:true,submarine:true});let context;
 try{
  context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1920,height:1080},isMobile:phone,hasTouch:phone});
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.locator('.service-manage').click();await page.locator('#yard-board').click();
  const ship=async()=>(await f.state()).ships.find(s=>s.id==='ship');
  await expect(page.locator('#submarine-helm-depth')).toBeVisible();await expect(page.locator('#submarine-helm-status')).toContainText('5:00');
  await page.locator('[data-ship-throttle="4"]').first().click();await expect.poll(async()=>(await ship()).speed).toBeGreaterThan(.5);
  const before=(await ship()).x;await page.locator('#world-canvas').focus();
  if(phone)await page.locator('#submarine-helm-dive').click();else await page.keyboard.press('ControlLeft');
  await expect.poll(async()=>(await ship()).depth,{timeout:10000}).toBe('submerged');
  expect((await ship()).x).toBeLessThan(before-1);expect((await ship()).throttle).toBe(4);
  // Select a ground target through the real map, then launch using LMB.
  const box=await page.locator('#world-canvas').boundingBox();
  const target={x:box.x+box.width*(phone?.5:.7),y:box.y+box.height*(phone?.65:.42)};
  await page.locator('#world-canvas').focus();
  if(phone)await page.touchscreen.tap(target.x,target.y);else await page.mouse.move(target.x,target.y);
  await page.screenshot({path:screenshot('aim-before-launch')});
  const firing=page.waitForResponse(r=>r.url().endsWith('/api/ships/fire'),{timeout:5000});
  if(phone){await page.locator('#ship-systems-toggle').click();await page.locator('#ship-fire').click();await page.locator('#ship-systems-close').click();}
  else{await page.mouse.down();await page.mouse.up();}
  const fired=await firing;expect(fired.status(),await fired.text()).toBe(200);
  await expect.poll(async()=>(await f.state()).combat.barrages.length).toBe(1);
  const launched=(await f.state()).combat.barrages[0];expect(launched.missiles[0].underwater).toBe(true);
  await page.screenshot({path:screenshot('underwater-launch')});
  expect((await ship()).throttle).toBe(4);const moving=(await ship()).x;
  if(phone)await page.locator('#submarine-helm-surface').click();else{await page.locator('#world-canvas').focus();await page.keyboard.press('Space');}
  await expect.poll(async()=>(await ship()).depth,{timeout:10000}).toBe('surfaced');
  expect((await ship()).x).toBeLessThan(moving-1);expect((await ship()).throttle).toBe(4);
  await page.screenshot({path:screenshot('surfacing-under-way')});
  await page.locator('[data-ship-throttle="0"]').first().click();
  await page.setViewportSize({width:phone?844:1280,height:phone?390:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
}
