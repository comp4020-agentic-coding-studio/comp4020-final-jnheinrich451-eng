import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkCommunication(browser,mobile=false,{snapshotCrates=0}={}){
 const f=await wreckRecoveryFixture({snapshotCrates}),contexts=[];
 try{
  const pages=[];
  for(let i=0;i<2;i++){
   const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});contexts.push(c);
   await c.addCookies([{name:'frontier',value:f.tokens[i],url:f.url}]);const page=await c.newPage();pages.push(page);
   await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  }
  const [p,peer]=pages,errors=[];p.on('pageerror',e=>errors.push(e.message));peer.on('pageerror',e=>errors.push(e.message));
  if(snapshotCrates){
   // Actual EventSource reconnect, not just a page reload or an HTTP snapshot.
   await contexts[0].setOffline(true);await expect(p.locator('#connection')).toContainText('Reconnecting');
   await contexts[0].setOffline(false);await expect(p.locator('#connection')).toContainText('live');
  }
  const channel=async()=>(await contexts[0].request.get(f.url+'/api/communication')).json();
  const open=async()=>{if(mobile)await p.locator('#chat-open').click();else{await p.locator('#world-canvas').focus();await p.keyboard.press('Enter');}};
  await open();await expect(p.locator('#chat-input')).toBeFocused();await p.keyboard.press('Enter');
  await expect(p.locator('#chat-form')).toBeHidden();expect((await channel()).messages).toHaveLength(0);
  await open();await p.locator('#chat-input').fill('Keep my draft');await p.keyboard.press('Escape');
  await expect(p.locator('#chat-form')).toBeHidden();await open();await expect(p.locator('#chat-input')).toHaveValue('Keep my draft');
  await p.keyboard.press('Enter');await expect(p.locator('#chat-form')).toBeHidden();
  await expect(peer.locator('#chat-messages')).toContainText('Keep my draft');
  await open();await p.locator('#chat-input').fill('IME text');
  await p.locator('#chat-input').dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
  await expect(p.locator('#chat-form')).toBeVisible();expect((await channel()).messages).toHaveLength(1);
  const before=(await f.state()).me;
  await p.locator('#chat-input').fill('');await p.keyboard.type('wasd bq 123');
  expect(await p.locator('#deployment-tray').isVisible()).toBe(false);await expect(p.locator('.emote-cover')).toBeHidden();
  const after=(await f.state()).me;expect(Math.hypot(before.x-after.x,before.y-after.y)).toBeLessThan(.01);
  await p.locator('#chat-input').fill('<img src=x onerror=alert(1)>');await p.keyboard.press('Enter');
  await expect(peer.locator('#chat-messages')).toContainText('<img src=x onerror=alert(1)>');expect(await peer.locator('#chat-messages img').count()).toBe(0);
  if(mobile)await p.locator('#emote-open').click();else await p.keyboard.down('q');
  await expect(p.locator('.emote-cover')).toBeVisible();
  await p.screenshot({path:'.local/communication-wheel-'+(mobile?'phone':'desktop')+'.png'});
  const choice=p.locator('[data-emote="thanks"]');
  if(mobile)await choice.click();else{await choice.hover();await p.keyboard.up('q');}
  await expect(p.locator('.emote-cover')).toBeHidden();
  await expect.poll(async()=>(await channel()).emotes.length).toBe(1);
  const event=(await channel()).emotes[0];expect(event.emote).toBe('thanks');expect(event.anchor).toEqual({kind:'recycler',id:'r0'});
  await p.locator('#chat-history-toggle').click();
  await p.screenshot({path:'.local/communication-bubble-'+(mobile?'phone':'desktop')+'.png'});
  await p.locator('#emote-open').click();await p.keyboard.press('Escape');expect((await channel()).emotes[0]?.id).toBe(event.id);
  await p.locator('#world-canvas').focus();await p.keyboard.press('e');await expect.poll(async()=>(await f.state()).me.body).toBe('robot');await expect(p.locator('#build-mode')).toBeEnabled();await p.keyboard.press('b');await expect(p.locator('#deployment-tray')).toBeVisible();await p.keyboard.press('Escape');
  if(!mobile){
   const start=(await f.state()).me.y;await p.keyboard.down('w');await expect.poll(async()=>(await f.state()).me.y).toBeLessThan(start-.2);
   await p.keyboard.press('Enter');await expect.poll(async()=>(await f.state()).me.vy).toBe(0);await p.keyboard.press('Escape');
   const inputs=[];p.on('request',req=>{if(req.url().endsWith('/api/input')&&req.method()==='POST')inputs.push(req.postDataJSON());});
   await p.keyboard.down('w'); // Held-key repeat after closing chat must not restart movement.
   await p.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
   expect(inputs.some(i=>i.x||i.y)).toBe(false);await p.keyboard.up('w');
   await p.keyboard.down('w');await expect.poll(async()=>(await f.state()).me.vy).toBeLessThan(0);await p.keyboard.up('w');
  }
  await peer.reload();await expect(peer.locator('#connection')).toContainText('live');await expect(peer.locator('#chat-messages li')).toHaveCount(2);
  await p.route('**/api/communication',route=>route.request().method()==='POST'?route.abort():route.continue());
  await open();await p.locator('#chat-input').fill('Retry after disconnect');await p.keyboard.press('Enter');
  await expect(p.locator('#chat-status')).toContainText('Draft kept');await p.unroute('**/api/communication');
  await open();await expect(p.locator('#chat-input')).toHaveValue('Retry after disconnect');await p.keyboard.press('Enter');
  await expect(peer.locator('#chat-messages')).toContainText('Retry after disconnect');
  await open();await p.locator('#chat-input').fill('Draft after refresh');await p.keyboard.press('Escape');await p.reload();
  await expect(p.locator('#connection')).toContainText('live');await open();await expect(p.locator('#chat-input')).toHaveValue('Draft after refresh');
  await p.screenshot({path:'.local/communication-chat-'+(mobile?'phone':'desktop')+'.png'});
  await p.keyboard.press('Escape');if(!mobile)await p.setViewportSize({width:1024,height:768});
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  console.log('PASS communication '+(mobile?'phone':'desktop'));
 }finally{for(const c of contexts)await c.close();await f.close();}
}
