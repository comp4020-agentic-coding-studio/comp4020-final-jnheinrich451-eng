import {test,expect} from '@playwright/test';
import {isolatedField,landCore} from './rover-helper.js';

for(const mobile of [false,true])test(`Escape navigation and compact map tools ${mobile?'phone':'desktop'}`,async({browser},info)=>{
 test.setTimeout(60000);
 const arena=await isolatedField('navigation');
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(arena.base+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');await landCore(page);
  expect(await page.locator('.map-tools button').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual(['zoom-in','zoom-out','center','locate-station','planet-open','overview-button','grid-toggle']);
  for(const size of mobile?[{width:390,height:844},{width:844,height:390}]:[{width:1440,height:900}]){
   await page.setViewportSize(size);
   const map=await page.locator('.survey').boundingBox(),tools=await page.locator('.map-tools').boundingBox();
   expect(tools.y).toBeGreaterThanOrEqual(map.y+map.height+7);
   expect(tools.y+tools.height).toBeLessThan(size.height);
  }
  if(mobile)await page.setViewportSize({width:390,height:844});
  await page.locator('#build-mode').click();await expect(page.locator('#deployment-tray')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#deployment-tray')).toBeHidden();
  await page.locator('#build-mode').click();await page.locator('#sentry-card').click();
  await page.locator('#coordinate-details summary').click();await page.locator('#tile-x').focus();
  await page.keyboard.press('Escape');await expect(page.locator('#site-panel')).toBeHidden();
  await expect(page.locator('#help-dialog')).toBeHidden();
  await page.keyboard.press('Escape');await expect(page.locator('#help-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#help-dialog')).toBeHidden();
  await page.keyboard.press('l');await expect(page.locator('#logistics-dialog')).toBeVisible();
  await page.locator('#site-button').click();
  await expect(page.locator('#logistics-dialog')).toBeHidden();await expect(page.locator('#site-panel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#site-panel')).toBeHidden();
  await page.keyboard.press('F1');await expect(page.locator('#keys-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#keys-dialog')).toBeHidden();
  await page.locator('#planet-open').click();await expect(page.locator('#planet-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#planet-dialog')).toBeHidden();
  await page.screenshot({path:info.outputPath('compact-toolbar.png')});
  expect(errors).toEqual([]);
 }finally{await context.close();await arena.close();}
});
