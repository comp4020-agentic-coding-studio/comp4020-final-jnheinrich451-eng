import {test,expect} from '@playwright/test';
import {wreckRecoveryFixture} from '../helpers/wreck-recovery-fixture.js';
import {shipyardSite,yardFromShip} from '../../public/shipyard.js';

for(const mobile of [false,true])test('dock planning runs only for visible naval controls or active placement / '+(mobile?'phone':'desktop'),async({browser})=>{
 const f=await wreckRecoveryFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  const original=await f.state(),w={...original.world,logistics:original.logistics,ships:original.ships};
  const plan=shipyardSite(w,original.buildings||[],[],55,30,'pilot0',2);expect(plan.error).toBeNull();
  await f.restart(db=>{
   const l=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get().value);
   l.shipyards=[yardFromShip({...plan.ship,id:'catalogue-dock',elapsed:4.5})];l.recyclers=[];l.groundSupplies=10;
   db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
   db.prepare("UPDATE scouts SET x=?,y=? WHERE id='pilot0'").run(plan.ship.dock.x,plan.ship.dock.y);
  });
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  await context.addInitScript(()=>{
   window.catalogueSnapshots=0;window.dockPlanningCalls=0;
   const Native=window.EventSource;
   window.EventSource=class extends Native{constructor(...args){super(...args);this.addEventListener('message',()=>window.catalogueSnapshots++);}};
  });
  // Count calls at the browser module boundary, without production telemetry or
  // a wall-clock performance threshold. The real validator still runs normally.
  await context.route('**/shipyard.js*',async route=>{
   const response=await route.fetch(),source=await response.text();
   const instrumented=source.replace(/(export function shipyardSite\([^)]*\) \{)/,'$1 window.dockPlanningCalls++;');
   expect(instrumented).not.toBe(source);await route.fulfill({response,body:instrumented});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  const waitSnapshots=async()=>{const n=await page.evaluate(()=>window.catalogueSnapshots);await expect.poll(()=>page.evaluate(()=>window.catalogueSnapshots)).toBeGreaterThan(n+2);};
  const calls=()=>page.evaluate(()=>window.dockPlanningCalls);
  await expect(page.locator('#deployment-tray')).toBeHidden();await waitSnapshots();expect(await calls()).toBe(0);
  await page.locator('#world-canvas').focus();await page.keyboard.press('b');await expect(page.locator('#deployment-tray')).toBeVisible();
  await waitSnapshots();expect(await calls()).toBe(0); // Ground tab needs no dock search.
  await page.locator('#tab-navy').click();await expect.poll(calls).toBeGreaterThan(0);
  const openCount=await calls();await waitSnapshots();expect(await calls()).toBeGreaterThan(openCount);
  await page.locator('#world-canvas').focus();await page.keyboard.press('Escape');await expect(page.locator('#deployment-tray')).toBeHidden();
  const closedCount=await calls();await waitSnapshots();expect(await calls()).toBe(closedCount);
  await page.keyboard.press('b');await expect(page.locator('#deployment-tray')).toBeVisible();await expect.poll(calls).toBeGreaterThan(closedCount);
  // Number-key selection still starts placement, which must keep revalidating
  // even though choosing the card closes the catalogue itself.
  await page.keyboard.press('5');await expect(page.locator('#site-panel')).toBeVisible();await expect(page.locator('#deployment-tray')).toBeHidden();
  const placingCount=await calls();await waitSnapshots();expect(await calls()).toBeGreaterThan(placingCount);
  expect(errors).toEqual([]);
 }finally{try{await context.close();}finally{await f.close();}}
});
