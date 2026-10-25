import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkMAC(browser,mobile=false){
 const f=await wreckRecoveryFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 context.setDefaultTimeout(10000);
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.keyboard.press('e');await expect.poll(async()=>(await f.state()).me.recyclerId).toBeFalsy();
  expect((await f.post('rails',{x:72,y:44,shape:'EW',length:5})).status).toBe(201);
  await page.locator('#build-mode').click();await page.locator('#tab-rail').click();
  await expect(page.locator('#mac-card')).toContainText('280 ORB');await page.locator('#mac-card').click();
  await expect(page.locator('#site-title')).toContainText('Rail MAC');
  await page.locator('#coordinate-details summary').click();
  await page.locator('#tile-x').fill('72');await page.locator('#tile-y').fill('44');await page.locator('#select-tile').click();
  await expect(page.locator('#place-building')).toBeEnabled();await page.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).artillery.find(g=>g.kind==='mac')?.id).toBeTruthy();
  const gun=(await f.state()).artillery.find(g=>g.kind==='mac');expect((await f.state()).logistics.supplies).toBe(920);
  await expect.poll(async()=>(await f.state()).logistics.jobs[gun.id],{timeout:7000,intervals:[100]}).toBeFalsy();
  await page.locator('#remote-mode').click();const marker=page.locator('[data-remote-id="'+gun.id+'"]');
  await expect(marker).toHaveText('MAC');await marker.click();
  await expect(page.locator('.facility-heading strong')).toHaveText('RAIL MAC');
  for(const ammo of ['HE','INCENDIARY','GAS'])await expect(page.locator('[data-shell="'+ammo+'"]')).toBeHidden();
  await expect(page.locator('#artillery-fire')).toBeEnabled({timeout:4000});
  await page.locator('#artillery-fire').click();await expect(page.locator('#artillery-status')).toContainText('CHARGING');
  const accepted=(await f.state()).combat.salvos.find(s=>s.kind==='mac');expect(accepted).toBeTruthy();
  await page.screenshot({path:'.local/mac-charge-'+mobile+'.png'});
  await page.locator('#facility-exit').click();
  await expect.poll(async()=>(await f.state()).artillery.find(g=>g.id===gun.id).operator).toBeFalsy();
  await expect.poll(async()=>(await f.state()).combat.salvos.some(s=>s.id===accepted.id),{timeout:5000,intervals:[100]}).toBe(false);
  await page.locator('#remote-mode').click();await marker.click();
  await expect(page.locator('#artillery-status')).toContainText('COOLING');await expect(page.locator('#artillery-fire')).toBeDisabled();
  const box=await page.locator('#facility-controls').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(errors).toEqual([]);console.log('PASS rail MAC '+(mobile?'phone':'desktop'));
 }finally{await context.close();await f.close();}
}
