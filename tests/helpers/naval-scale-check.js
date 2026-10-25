import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkNavalScale(browser,mobile=false){
 const f=await wreckRecoveryFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(f.url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');
  await p.locator('#world-canvas').focus();await p.keyboard.press('e');await expect.poll(async()=>(await f.state()).me.body).toBe('robot');
  await p.locator('#build-mode').click();await p.locator('#tab-navy').click();await p.locator('#dock-card').click();
  await p.locator('#coordinate-details summary').click();await p.locator('#tile-x').fill('47');await p.locator('#tile-y').fill('30');await p.locator('#select-tile').click();
  await expect(p.locator('#place-building')).toBeEnabled();await p.screenshot({path:'.local/naval-large-preview-'+mobile+'.png'});await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).logistics.shipyards.length).toBe(1);const yard=(await f.state()).logistics.shipyards[0];expect(yard.dockScale).toBe(2);
  await expect.poll(async()=>(await f.state()).logistics.shipyards[0].dockReady,{timeout:15000}).toBe(true);
  await p.locator('#build-mode').click();await p.locator('#tab-navy').click();await p.locator('#carrier-card').click();
  if(!await p.locator('#tile-x').isVisible())await p.locator('#coordinate-details summary').click();
  await p.locator('#tile-x').fill(String(Math.floor(yard.dock.x)));await p.locator('#tile-y').fill(String(Math.floor(yard.dock.y)));await p.locator('#select-tile').click();
  await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  await expect.poll(async()=>(await f.state()).ships.length).toBe(1);expect((await f.state()).ships[0]).toMatchObject({kind:'carrier',navalScale:2,yardId:yard.id});
  await p.screenshot({path:'.local/naval-large-assembly-'+mobile+'.png'});
  // Fast-forward only this disposable save, then exercise real restore and drawing.
  await context.clearCookies();await p.goto('about:blank');await f.restart(db=>{const row=db.prepare('SELECT * FROM ships LIMIT 1').get(),s=JSON.parse(row.value);s.assemblyRemaining=0;s.elapsed=4.5;db.prepare('UPDATE ships SET value=? WHERE id=?').run(JSON.stringify(s),s.id);});
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);await p.goto(f.url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');expect((await f.state()).ships[0]).toMatchObject({navalScale:2,assemblyRemaining:0});
  await p.locator('#remote-mode').click();await expect(p.locator('[data-remote-id^="ship:"]')).toBeVisible();await p.locator('[data-remote-id^="ship:"]').click();
  await p.screenshot({path:'.local/naval-large-restored-'+mobile+'.png'});expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context.close();await f.close();}
}
