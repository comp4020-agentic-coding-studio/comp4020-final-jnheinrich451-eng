import {test,expect} from '@playwright/test';
import {navalRemoteFixture} from '../helpers/naval-remote-fixture.js';
for(const phone of [false,true])test('remote ship reverses away from a bow-in shore / '+(phone?'phone':'desktop'),async({browser},info)=>{
 test.setTimeout(45000);const f=await navalRemoteFixture({bowIn:true});let context;
 try{
  context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1920,height:1080},isMobile:phone,hasTouch:phone});await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');await page.locator('#remote-mode').click();
  const marker=page.locator('[data-remote-id="ship:ship"]'),other=page.locator('[data-remote-id="ship:carrier"]'),a=await marker.boundingBox(),b=await other.boundingBox(),scale=(a.x+a.width/2-b.x-b.width/2)/(97.9-40.5),target={x:a.x+a.width/2-10*scale,y:a.y+a.height/2-scale};
  await marker.click();if(phone)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);await expect(page.locator('#remote-naval')).toBeHidden();
  const ship=async()=>(await f.state()).ships.find(s=>s.id==='ship');await expect.poll(async()=>(await ship()).driveSpeed,{timeout:5000}).toBeLessThan(-.1);
  await expect.poll(async()=>(await ship()).x,{timeout:5000}).toBeLessThan(97);
  await marker.click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));await page.screenshot({path:info.outputPath('backing-out.png')});
  await expect.poll(async()=>(await ship()).remoteOrder.phase,{timeout:30000}).toBe('holding');const end=await ship();expect(Math.hypot(end.x-87.9,end.y-49.5)).toBeLessThan(.25);expect(end.speed).toBe(0);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
});
for(const phone of [false,true])test('remote naval orders, targets and carrier launch / '+(phone?'phone':'desktop'),async({browser},info)=>{
 test.setTimeout(60000);const f=await navalRemoteFixture();let context;
 try{
  context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1920,height:1080},isMobile:phone,hasTouch:phone});
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#remote-mode').click();const marker=page.locator('[data-remote-id="ship:ship"]'),carrier=page.locator('[data-remote-id="ship:carrier"]');await expect(marker).toBeVisible();
  const a=await marker.boundingBox(),b=await carrier.boundingBox(),scale=(b.x+b.width/2-a.x-a.width/2)/10;
  const project=(x,y)=>({x:a.x+a.width/2+(x-30.5)*scale,y:a.y+a.height/2+(y-50.5)*scale});
  const tap=async(x,y)=>{const p=project(x,y);if(phone)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);};
  await marker.click();await expect(page.locator('#remote-naval')).toBeVisible();
  const before=(await f.state()).me.y;await page.locator('#world-canvas').focus();await page.keyboard.down('w');await expect.poll(async()=>(await f.state()).me.y).toBeLessThan(before-.25);await page.keyboard.up('w');
  await tap(30.5,42.5);await expect(page.locator('#remote-naval')).toBeHidden();
  await expect.poll(async()=>(await f.state()).ships.find(s=>s.id==='ship').remoteOrder?.kind).toBe('move');
  await expect.poll(async()=>(await f.state()).ships.find(s=>s.id==='ship').y,{timeout:5000}).toBeLessThan(50);
  await marker.click();await page.locator('#remote-naval [data-command="stop"]').click();await expect(page.locator('#remote-naval')).toBeHidden();
  await marker.click();await page.locator('#remote-naval [data-command="bombard"]').click();
  await tap(75.5,40.5);await expect(page.locator('#remote-naval [role="status"]')).toContainText('target 2/3');
  await tap(75.5,50.5);await expect(page.locator('#remote-naval [role="status"]')).toContainText('target 3/3');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:info.outputPath('three-target-planning.png')});
  await tap(75.5,60.5);await expect(page.locator('#remote-naval')).toBeHidden();
  const ordered=(await f.state()).ships.find(s=>s.id==='ship').remoteOrder;for(const [i,p] of ordered.targets.entries()){expect(Math.abs(p.x-75.5)).toBeLessThan(.1);expect(Math.abs(p.y-(40.5+i*10))).toBeLessThan(.1);}
  await expect.poll(async()=>(await f.state()).ships.find(s=>s.id==='ship').remoteOrder?.fired,{timeout:7000}).toBe(1);
  await marker.click();await page.screenshot({path:info.outputPath('barrage-progress.png')});
  await page.keyboard.press('Escape');await expect(page.locator('#remote-naval')).toBeHidden();await expect(marker).toBeVisible();
  // Carrier and parked plane markers share a location: both must remain clickable.
  await carrier.click();await page.locator('#remote-naval [data-command="launch"]').click();await expect(page.locator('#remote-naval')).toBeHidden();
  expect((await f.state()).ships.find(s=>s.id==='carrier').aircraft.mission.kind).toBe('cruise');
  await page.reload();await expect(page.locator('#connection')).toContainText('live');expect((await f.state()).ships.find(s=>s.id==='ship').remoteOrder.kind).toBe('bombard');
  if(phone){await page.setViewportSize({width:844,height:390});await page.locator('#remote-mode').click();await page.locator('[data-remote-id="ship:ship"]').click();await page.screenshot({path:info.outputPath('landscape.png')});}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
});
