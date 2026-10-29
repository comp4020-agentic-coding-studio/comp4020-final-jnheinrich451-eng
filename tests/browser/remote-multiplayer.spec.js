import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {navalRemoteFixture} from '../helpers/naval-remote-fixture.js';

test('two browser pilots see, contest, reconnect and restore shared remote ship orders',async({browser},info)=>{
 test.setTimeout(60000);
 const f=await navalRemoteFixture(),contexts=[],pages=[],errors=[],timings=[];let projection;
 const ship=s=>s.ships.find(v=>v.id==='ship');
 const snapshot=page=>page.evaluate(()=>window.remoteTestSnapshot);
 try{
  for(let i=0;i<2;i++){
   const context=await browser.newContext({viewport:i?{width:390,height:844}:{width:1920,height:1080},isMobile:!!i,hasTouch:!!i});contexts.push(context);
   await context.addCookies([{name:'frontier',value:f.tokens[i],url:f.url}]);
   await context.addInitScript(()=>{
    const Native=window.EventSource;
    window.EventSource=class extends Native{constructor(...args){super(...args);this.addEventListener('message',event=>{window.remoteTestSnapshot=JSON.parse(event.data);});}};
   });
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
   await page.locator('#remote-mode').click();
   if(i===0){const a=await page.locator('[data-remote-id="ship:ship"]').boundingBox(),b=await page.locator('[data-remote-id="ship:carrier"]').boundingBox();projection={x:a.x+a.width/2,y:a.y+a.height/2,scale:(b.x+b.width/2-a.x-a.width/2)/10};}
   await page.locator('[data-remote-id="ship:ship"]').click();
  }
  const [owner,peer]=pages;
  expect((await f.state(0)).me.id).not.toBe((await f.state(1)).me.id);
  // Both planners start at revision null. The desktop issues an actual map order.
  const started=performance.now();
  await owner.mouse.click(projection.x,projection.y-8*projection.scale);
  await expect(owner.locator('#remote-naval')).toBeHidden();
  await peer.waitForFunction(()=>document.querySelector('#remote-naval [role="status"]')?.textContent.includes('move / moving'));
  await peer.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  timings.push({action:'desktop map move to phone rendered status',ms:Math.round(performance.now()-started)});
  const first=ship(await snapshot(peer)).remoteOrder;
  expect(first).toMatchObject({kind:'move',actorId:'pilot0'});
  expect(Math.abs(first.target.y-42.5)).toBeLessThan(.1);
  await expect.poll(async()=>ship(await snapshot(peer)).y).toBeLessThan(50.4);
  // A peer who opened the planner earlier cannot silently overwrite that order.
  const conflict=peer.waitForResponse(r=>r.url().endsWith('/api/ships/order'));
  await peer.locator('#remote-naval [data-command="stop"]').tap();expect((await conflict).status()).toBe(409);
  await expect(peer.locator('#remote-naval')).toBeVisible();expect(ship(await f.state()).remoteOrder.id).toBe(first.id);
  await expect(peer.locator('#remote-naval [data-command="stop"]')).toBeEnabled();
  const retry=peer.waitForResponse(r=>r.url().endsWith('/api/ships/order'));
  await peer.locator('#remote-naval [data-command="stop"]').tap();expect((await retry).status()).toBe(201);
  await owner.locator('[data-remote-id="ship:ship"]').click();
  await expect(owner.locator('#remote-naval [role="status"]')).toContainText('stop / holding');
  const stopped=ship(await snapshot(owner)).remoteOrder;expect(stopped.actorId).toBe('pilot1');

  // Same-revision requests racing through two separate browser cookie jars.
  const order=(i)=>({id:'ship',action:'move',target:{x:35.5+i*5,y:40.5},orderId:'parallel-remote-'+i,expectedOrderId:stopped.id});
  const responses=await Promise.all(contexts.map((c,i)=>c.request.post(f.url+'/api/ships/order',{data:order(i)})));
  expect(responses.map(r=>r.status()).sort()).toEqual([201,409]);
  const winner=responses.findIndex(r=>r.status()===201),winning=order(winner);
  for(const page of pages)await expect.poll(async()=>ship(await snapshot(page)).remoteOrder.id).toBe(winning.orderId);
  const replay=await contexts[winner].request.post(f.url+'/api/ships/order',{data:winning});expect(replay.status()).toBe(200);
  const foreign=await contexts[1].request.post(f.url+'/api/ships/order',{data:{...winning,id:'ship-from-another-world',orderId:'remote-foreign-0001'}});expect(foreign.status()).toBe(404);

  await peer.reload();await expect(peer.locator('#connection')).toContainText('live');
  await peer.locator('#remote-mode').click();await peer.locator('[data-remote-id="ship:ship"]').click();
  await expect.poll(async()=>ship(await snapshot(peer)).remoteOrder.id).toBe(winning.orderId);
  expect((await f.state(1)).me.id).toBe('pilot1');
  await peer.screenshot({path:info.outputPath('remote-phone-reconnected-2026-10-29.png')});
  await owner.screenshot({path:info.outputPath('remote-desktop-shared-2026-10-29.png')});
  // Stop every browser connection before a real server close/reopen on the same save.
  await Promise.all(pages.map(p=>p.goto('about:blank')));await f.restart();
  for(let i=0;i<2;i++){
   await contexts[i].addCookies([{name:'frontier',value:f.tokens[i],url:f.url}]);
   await pages[i].goto(f.url+'/?legacy=1');await expect(pages[i].locator('#connection')).toContainText('live');
   await expect.poll(async()=>ship(await snapshot(pages[i])).remoteOrder.id).toBe(winning.orderId);
  }
  const restored=ship(await f.state()).remoteOrder;expect(restored.actorId).toBe('pilot'+winner);
  expect((await contexts[winner].request.post(f.url+'/api/ships/order',{data:winning})).status()).toBe(200);
  const report={date:'2026-10-29',scope:'Local loopback disposable legacy world; two isolated Chrome contexts at desktop 1920x1080 and phone 390x844. Not Fly, named-room invitation or sustained-load evidence.',timings,checks:['actual UI move','peer SSE and rendered order status','shared movement','stale peer rejection and retry','simultaneous requests yield one winner','unknown-world ship rejection','browser reconnect','server restart','saved retry receipt']};
  await writeFile(info.outputPath('remote-multiplayer-2026-10-29.json'),JSON.stringify(report,null,2));
  console.log('Remote multiplayer:',JSON.stringify(report));
  expect(timings.every(t=>t.ms<1000)).toBe(true);
  expect(errors).toEqual([]);for(const page of pages)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{try{await Promise.all(contexts.map(c=>c.close()));}finally{await f.close();}}
});
