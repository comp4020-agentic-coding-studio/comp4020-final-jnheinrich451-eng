import {expect} from '@playwright/test';
import {helicopterFieldFixture} from './helicopter-field-fixture.js';
const plane=s=>s.airbases.find(b=>b.id==='pad').aircraft;
export async function checkHelicopterField(browser,mobile=false){
 const f=await helicopterFieldFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(f.url+'/?legacy=1');
  await expect(page.locator('#connection')).toContainText('live');await expect(page.locator('#aircraft-manual')).toContainText('E to land on clear ground');
  // Zoom onto the aircraft using the existing follow/recentre control.
  await page.locator('#world-canvas').focus();await page.keyboard.press('c');
  const suffix=mobile?'phone':'desktop';await page.screenshot({path:'.local/helicopter-field-'+suffix+'-preview.png'});
  if(mobile)await page.locator('#aircraft-interact').tap();else await page.keyboard.press('e');
  await expect.poll(async()=>plane(await f.state()).state,{timeout:10000}).toBe('parked');
  await expect(page.locator('#aircraft-manual')).toContainText('FIELD PARKED');
  if(mobile)await page.locator('#aircraft-interact').tap();else await page.keyboard.press('e');
  await expect.poll(async()=>plane(await f.state()).occupant).toBeNull();
  await expect(page.locator('#aircraft-interact')).toHaveText('Board helicopter / E');
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#aircraft-interact')).toBeEnabled();
  if(mobile)await page.locator('#aircraft-interact').tap();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');}
  await expect.poll(async()=>plane(await f.state()).occupant).toBe('pilot0');
  expect(plane(await f.state()).state).toBe('parked');
  await expect(page.locator('#aircraft-launch')).toBeVisible();await page.screenshot({path:'.local/helicopter-field-'+suffix+'-parked.png'});
  await page.locator('#aircraft-launch').click();await expect.poll(async()=>plane(await f.state()).state,{timeout:10000}).toBe('flying');
  expect(plane(await f.state())).toMatchObject({rounds:17,rockets:3,health:80});
  await page.locator('#world-canvas').focus();await page.keyboard.down('d');await expect.poll(async()=>plane(await f.state()).speed).toBeGreaterThan(1);await page.keyboard.up('d');
  await expect.poll(async()=>plane(await f.state()).speed).toBe(0);expect(plane(await f.state()).state).toBe('flying');
  await page.setViewportSize(mobile?{width:844,height:390}:{width:1280,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context.close();await f.close();}
}
