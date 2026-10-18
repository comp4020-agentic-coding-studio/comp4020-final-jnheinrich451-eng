import {test,expect} from '@playwright/test';
import {isolatedField} from './rover-helper.js';

for(const mobile of [false,true])test('local frenzy warning and shared signal / '+(mobile?'phone':'desktop'),async({browser})=>{
 const field=await isolatedField('frenzy',[{x:24.5,y:18.5}]);let context;
 try{
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
  await field.seat(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(field.base+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#frenzy-test')).toBeEnabled();await page.locator('#frenzy-test').click();
  await expect(page.locator('#frenzy-status')).toContainText('SURGE IN');await expect(page.locator('#frenzy-test')).toBeDisabled();
  await page.screenshot({path:'.local/frenzy-warning-'+mobile+'.png'});
  await expect(page.locator('#frenzy-status')).toContainText('TRACKING SIGNAL',{timeout:8000});
  const state=await page.evaluate(async()=>{const s=await(await fetch('/api/world')).json();return {frenzy:s.combat.frenzy,enemies:s.combat.enemies};});
  expect(state.enemies.length).toBeGreaterThan(0);expect(state.enemies.length).toBeLessThanOrEqual(12);expect(state.frenzy.hunters).toBeGreaterThan(0);
  await page.reload();await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#frenzy-status')).toContainText('TRACKING SIGNAL');
  await page.screenshot({path:'.local/frenzy-surge-'+mobile+'.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await field.close();}
});
