import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';
import {ORBITAL_PAYLOADS} from '../../public/orbital.js';

export async function checkOrbitalExpansion(browser,payload,mobile=false){
 const f=await wreckRecoveryFixture(),profile=ORBITAL_PAYLOADS[payload];
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.keyboard.press('e');await expect.poll(async()=>(await f.state()).me.recyclerId).toBeFalsy();
  await page.locator('#build-mode').click();await page.locator('[data-force-tab="strike"]').click();
  await page.locator('[data-orbital-payload="'+payload+'"]').click();await expect(page.locator('#orbital-status')).toContainText(profile.label);
  await expect(page.locator('#deployment-tray')).toBeHidden();
  // Reopen without spending; choosing a new payload must hide the catalogue again.
  if(mobile)await page.locator('#orbital-reselect').click();else await page.keyboard.press('b');
  await expect(page.locator('#deployment-tray')).toBeVisible();await expect(page.locator('#orbital-panel')).toBeHidden();
  expect((await f.state()).logistics.orbital?.order).toBeFalsy();
  const alternate=payload==='HEAVY'?'CLUSTER':'HEAVY';
  await page.locator('[data-orbital-payload="'+alternate+'"]').click();
  await expect(page.locator('#orbital-status')).toContainText(ORBITAL_PAYLOADS[alternate].label);
  await expect(page.locator('#deployment-tray')).toBeHidden();
  if(mobile)await page.locator('#orbital-reselect').click();else await page.keyboard.press('b');
  expect((await f.state()).logistics.supplies).toBe(1200);
  await page.locator('[data-orbital-payload="'+payload+'"]').click();await expect(page.locator('#deployment-tray')).toBeHidden();
  const point=await page.evaluate(()=>{
   const c=document.getElementById('world-canvas').getBoundingClientRect(),top=100,bottom=Math.max(top+120,innerHeight-190);
   return{x:c.left+c.width/2,y:c.top+(top+bottom)/2,tile:Math.min((c.width-24)/128,(bottom-top)/96)};
  });
  const click=(x,y)=>mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  if(payload==='CLUSTER'){
   if(mobile)await page.locator('#orbital-rotate').click();else await page.keyboard.press('r');
   await expect(page.locator('#orbital-rotate')).toContainText('East');
  }else await expect(page.locator('#orbital-rotate')).toBeHidden();
  if(payload==='BEAM'){
   await click(point.x-36*point.tile,point.y);expect((await f.state()).logistics.orbital?.order).toBeFalsy();
   await expect(page.locator('#orbital-instructions')).toContainText('72');
   if(!mobile)await page.mouse.move(point.x+36*point.tile,point.y);
  }else if(!mobile)await page.mouse.move(point.x,point.y);
  await page.screenshot({path:'.local/orbital-new-'+payload+'-'+mobile+'-preview.png'});
  await click(point.x+(payload==='BEAM'?36*point.tile:0),point.y);
  await expect.poll(async()=>(await f.state()).logistics.orbital?.order?.payload).toBe(payload);
  const accepted=(await f.state()).logistics.orbital.order;
  expect((await f.state()).logistics.supplies).toBe(1200-profile.cost);
  expect(accepted.points).toHaveLength({HEAVY:1,BARRAGE:31,CLUSTER:21,BEAM:121}[payload]);
  await click(point.x,point.y);expect((await f.state()).logistics.supplies).toBe(1200-profile.cost);
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#build-mode').click();await page.locator('[data-force-tab="strike"]').click();
  await page.locator('[data-orbital-payload="'+payload+'"]').click();
  expect((await f.state()).logistics.orbital.order.points.map(({landed,...p})=>p)).toEqual(accepted.points.map(({landed,...p})=>p));
  await expect.poll(async()=>(await f.state()).logistics.orbital.order.points.filter(p=>p.landed).length,{timeout:22000,intervals:[50]}).toBeGreaterThan(0);
  await page.locator('#orbital-close').click();
  if(payload==='BEAM'||payload==='BARRAGE')await expect.poll(async()=>{const o=(await f.state()).logistics.orbital.order;return o.age-o.delay;},{timeout:6000}).toBeGreaterThan(2);
  await page.screenshot({path:'.local/orbital-new-'+payload+'-'+mobile+'-impact.png'});
  await expect.poll(async()=>(await f.state()).logistics.orbital.order.points.every(p=>p.landed),{timeout:23000,intervals:[200]}).toBe(true);
  const finished=(await f.state()).logistics.orbital;
  expect(finished.cooldown).toBeGreaterThan(profile.cooldown-3);expect((await f.state()).logistics.supplies).toBe(1200-profile.cost);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  console.log('PASS orbital expansion',payload,mobile?'phone':'desktop');
 }finally{await context.close();await f.close();}
}
