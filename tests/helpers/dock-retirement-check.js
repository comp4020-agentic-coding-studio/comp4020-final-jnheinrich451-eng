import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkDockRetirement(browser,mobile=false){
 const f=await wreckRecoveryFixture();let context;
 try{
  await f.restart(db=>{
   const row=db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get(),l=JSON.parse(row.value);
   l.recyclers=[];l.shipyards=[{id:'empty-yard',owner:'pilot0',dock:{x:55.5,y:30.5,angle:-Math.PI/2},dockStyle:'unfolding',dockScale:2,berthX:47.5,berthY:22.5,elapsed:4.5,dockReady:true}];
   db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.prepare("UPDATE scouts SET x=49.5,y=30.5 WHERE id='pilot0'").run();
  });
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(f.url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');
  await p.locator('#shipyard-interact').click();await expect(p.locator('#shipyard-retire')).toBeDisabled();await expect(p.locator('#shipyard-help')).toContainText('Your robot is on the offshore dock at 49:30');
  const blocked=await f.post('shipyards/retire',{id:'empty-yard'});expect(blocked.status).toBe(409);expect(blocked.data.error).toContain('Your robot');
  await p.screenshot({path:'.local/dock-retire-blocked-'+mobile+'.png'});await p.keyboard.press('Escape');await p.locator('#world-canvas').focus();await p.keyboard.down('d');
  try{await expect.poll(async()=>(await f.state()).me.x,{timeout:10000,intervals:[100]}).toBeGreaterThan(55.4);}finally{await p.keyboard.up('d');}
  await p.locator('#shipyard-interact').click();await expect(p.locator('#shipyard-retire')).toBeEnabled();p.once('dialog',d=>d.accept());await p.locator('#shipyard-retire').click();
  await expect.poll(async()=>(await f.state()).logistics.shipyards.length).toBe(0);expect((await f.state()).me.x).toBeGreaterThan(55);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
}
