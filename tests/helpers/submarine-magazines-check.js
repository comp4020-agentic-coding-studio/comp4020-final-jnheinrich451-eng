import {expect} from '@playwright/test';
import {navalRemoteFixture} from './naval-remote-fixture.js';
export async function checkSubmarineMagazines(browser,phone=false){
 const f=await navalRemoteFixture({returning:true,submarine:true});let context;
 try{
  context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1920,height:1080},isMobile:phone,hasTouch:phone});await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(f.url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');await p.locator('.service-manage').click();await p.locator('#yard-board').click();
  await expect(p.locator('#submarine-helm-magazine')).toHaveText('4/4 GROUPS READY');
  await p.locator('#submarine-helm-dive').click();await expect.poll(async()=>(await f.state()).ships.find(s=>s.id==='ship').depth,{timeout:6000}).toBe('submerged');
  const box=await p.locator('#world-canvas').boundingBox(),target={x:box.width*(phone?.5:.7),y:box.height*(phone?.65:.42)};
  if(phone)await p.touchscreen.tap(target.x,target.y);else await p.mouse.move(target.x,target.y);
  for(let i=0;i<4;i++){
   const response=p.waitForResponse(r=>r.url().endsWith('/api/ships/fire'));
   if(phone){await p.locator('#ship-systems-toggle').click();await p.locator('#ship-fire').click();await p.locator('#ship-systems-close').click();}else await p.mouse.click(target.x,target.y);
   expect((await response).status()).toBe(200);await expect(p.locator('#submarine-helm-magazine')).toHaveText((3-i)+'/4 GROUPS READY');
  }
  let s=await f.state();expect(s.combat.barrages.map(b=>b.group)).toEqual([0,1,2,3]);await p.screenshot({path:'.local/submarine-groups-empty-'+phone+'.png'});
  expect((await f.post('ships/fire',{x:120,y:50})).status).toBe(409);
  await p.reload();await expect(p.locator('#connection')).toContainText('live');await expect(p.locator('#submarine-helm-magazine')).toHaveText('0/4 GROUPS READY');
  if(!phone){
   await expect.poll(async()=>{const ship=(await f.state()).ships.find(s=>s.id==='ship');return ship.siloReloads.filter(r=>r<=.001).length;},{timeout:22000,intervals:[100]}).toBeGreaterThan(0);
   const response=p.waitForResponse(r=>r.url().endsWith('/api/ships/fire'));await p.mouse.click(target.x,target.y);expect((await response).status()).toBe(200);
   s=await f.state();expect(s.combat.barrages.at(-1).group).toBe(0);
  }
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
}
