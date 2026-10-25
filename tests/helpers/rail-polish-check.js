import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkRailPolish(browser,mobile=false){
 const f=await wreckRecoveryFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.keyboard.press('e');await expect.poll(async()=>(await f.state()).me.recyclerId).toBeFalsy();
  await page.locator('#build-mode').click();await page.locator('#tab-ground').click();
  await expect(page.locator('#artillery-card')).toBeHidden();await expect(page.locator('#missile-card')).toBeVisible();
  await page.locator('#tab-rail').click();await expect(page.locator('#artillery-card')).toBeVisible();await expect(page.locator('#rail-card')).toBeVisible();
  await page.screenshot({path:'.local/rail-catalogue-'+mobile+'.png'});await page.keyboard.press('Escape');
  const start=await f.post('rails',{x:72,y:44,shape:'EW',length:5});expect(start.status,JSON.stringify(start.data)).toBe(201);
  await expect.poll(async()=>(await f.state()).logistics.cargoPods?.find(p=>p.layout==='rail-line')?.remaining).toBeGreaterThan(0);
  // Saved payload survives a server restart, without creating duplicate tracks.
  const pod=(await f.state()).logistics.cargoPods.find(p=>p.layout==='rail-line');
  await f.restart();await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const restored=(await f.state()).logistics.cargoPods.find(p=>p.id===pod.id);
  if(restored)expect(restored.remaining).toBeLessThanOrEqual(pod.remaining);
  await expect.poll(async()=>(await f.state()).logistics.cargoPods?.some(p=>p.id===pod.id),{timeout:7000,intervals:[100]}).toBe(false);
  const after=await f.state();expect(after.rails).toHaveLength(5);
  for(let x=70;x<=74;x++)expect(after.logistics.floors).toContain(44*after.world.width+x);
  const corner=await f.post('rails',{x:78,y:44,shape:'CNE',length:1});expect(corner.status,JSON.stringify(corner.data)).toBe(201);
  const cornerPod=(await f.state()).logistics.cargoPods.find(p=>p.layout==='rail-crate');expect(cornerPod).toBeTruthy();
  expect((await f.post('rails',{x:78,y:44,shape:'CNE',length:1})).status).toBe(201);
  expect((await f.state()).logistics.cargoPods.filter(p=>p.layout==='rail-crate')).toHaveLength(1);
  await f.restart();await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await expect.poll(async()=>(await f.state()).logistics.cargoPods.some(p=>p.id===cornerPod.id),{timeout:5000,intervals:[100]}).toBe(false);
  const afterCorner=await f.state();expect(afterCorner.rails).toHaveLength(6);
  expect(afterCorner.logistics.floors).toEqual([...after.logistics.floors,44*afterCorner.world.width+78]);
  const single=await f.post('rails',{x:79,y:44,shape:'EW',length:1});expect(single.status,JSON.stringify(single.data)).toBe(201);
  const singlePod=(await f.state()).logistics.cargoPods.find(p=>p.x===79&&p.y===44);
  expect(singlePod).toMatchObject({layout:'rail-crate',duration:cornerPod.duration});
  await expect.poll(async()=>(await f.state()).logistics.cargoPods.some(p=>p.id===singlePod.id),{timeout:5000,intervals:[100]}).toBe(false);
  expect((await f.state()).logistics.floors).toEqual([...afterCorner.logistics.floors,44*afterCorner.world.width+79]);
  const created=await f.post('artillery',{x:72,y:44});expect(created.status,JSON.stringify(created.data)).toBe(201);
  const gun=created.data.gun;
  await expect.poll(async()=>(await f.state()).logistics.jobs[gun.id],{timeout:7000,intervals:[100]}).toBeFalsy();
  await page.locator('#remote-mode').click();await page.locator('[data-remote-id="'+gun.id+'"]').click();
  await expect(page.locator('#facility-controls')).toBeVisible();
  expect((await f.state()).artillery.find(g=>g.id===gun.id).operator).toBe('pilot0');
  await page.screenshot({path:'.local/rail-cannon-'+mobile+'.png'});
  expect(errors).toEqual([]);
  console.log('PASS rail polish '+(mobile?'phone':'desktop'));
 }finally{await context.close();await f.close();}
}
