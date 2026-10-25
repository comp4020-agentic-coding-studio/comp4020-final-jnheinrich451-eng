import {expect} from '@playwright/test';
import {helicopterFieldFixture} from './helicopter-field-fixture.js';
const plane=s=>s.airbases.find(b=>b.id==='pad').aircraft;
export async function checkHelicopterSling(browser,mobile=false){
 const kind=mobile?'recycler':'tank',f=await helicopterFieldFixture({sling:kind});
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#helicopter-dashboard')).toBeVisible();
  await expect(page.locator('#helicopter-sling')).toHaveText('Lift vehicle / V');
  const land=await page.locator('#aircraft-interact').boundingBox(),lift=await page.locator('#helicopter-sling').boundingBox();
  expect(Math.abs(land.y-lift.y)).toBeLessThan(1);expect(lift.x).toBeGreaterThan(land.x+land.width);
  expect(lift.x+lift.width).toBeLessThanOrEqual(mobile?390:1920);
  const suffix=mobile?'phone':'desktop';await page.screenshot({path:'.local/helicopter-sling-'+suffix+'-normal.png'});
  if(mobile)await page.locator('#aircraft-interact').tap();else{await page.locator('#world-canvas').focus();await page.keyboard.press('e');}
  await expect(page.locator('#toast')).toContainText(/obstructed|occupied/);expect(plane(await f.state()).state).toBe('flying');
  await page.screenshot({path:'.local/helicopter-sling-'+suffix+'-blocked.png'});
  await page.waitForTimeout(1200);await page.screenshot({path:'.local/helicopter-sling-'+suffix+'-clear.png'});
  if(mobile)await page.locator('#helicopter-sling').tap();else await page.keyboard.press('v');
  await expect.poll(async()=>plane(await f.state()).sling?.vehicle.id).toBe('cargo');
  await expect.poll(async()=>!!plane(await f.state()).slingOperation,{timeout:10000}).toBe(false);
  await expect(page.locator('#helicopter-sling')).toContainText('Set down');
  const picked=await f.state();expect(kind==='tank'?picked.tanks:picked.logistics.recyclers).toHaveLength(0);
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect(plane(await f.state()).sling.vehicle.cargo).toBe(73);
  await page.locator('#world-canvas').focus();await page.keyboard.down('d');await expect.poll(async()=>plane(await f.state()).speed).toBe(2.5);
  await expect(page.locator('#heli-speed')).toContainText('2.5');
  await expect(page.locator('#heli-roll')).not.toContainText('LEVEL');
  await page.screenshot({path:'.local/helicopter-sling-'+suffix+'-loaded.png'});
  await expect.poll(async()=>plane(await f.state()).x).toBeGreaterThan(55);await page.keyboard.up('d');await expect.poll(async()=>plane(await f.state()).speed).toBe(0);
  await expect(page.locator('#heli-speed')).toContainText('0.0');await expect(page.locator('#heli-roll')).toContainText('LEVEL');
  const drop=plane(await f.state());
  if(mobile)await page.locator('#helicopter-sling').tap();else await page.keyboard.press('v');
  await expect.poll(async()=>!!plane(await f.state()).sling,{timeout:10000}).toBe(false);
  const state=await f.state(),v=(kind==='tank'?state.tanks:state.logistics.recyclers).find(v=>v.id==='cargo');
  expect(v).toMatchObject({health:123,cargo:73,weapon:'MAGNETIC',occupant:null,x:Math.floor(drop.x)+.5,y:Math.floor(drop.y)+.5});
  await page.setViewportSize(mobile?{width:844,height:390}:{width:1280,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await context.close();await f.close();}
}
