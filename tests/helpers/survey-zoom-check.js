import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkSurveyZoom(browser,mobile=false){
 const f=await wreckRecoveryFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.keyboard.press('e');await expect.poll(async()=>(await f.state()).me.recyclerId).toBeFalsy();
  const box=await page.locator('#world-canvas').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(let i=0;i<60;i++)await page.mouse.wheel(0,120);
  const zoom=()=>page.locator('#zoom-label').textContent().then(s=>parseInt(s));
  await expect.poll(zoom).toBeLessThanOrEqual(4);
  const before=(await f.state()).me;
  await page.keyboard.down('w');
  try{await expect.poll(async()=>Math.hypot((await f.state()).me.x-before.x,(await f.state()).me.y-before.y)).toBeGreaterThan(.2);}
  finally{await page.keyboard.up('w');}
  expect(await zoom()).toBeLessThanOrEqual(4);
  await page.screenshot({path:'.local/robot-survey-zoom-'+mobile+'.png'});
  for(let i=0;i<60;i++)await page.mouse.wheel(0,-120);
  await expect.poll(zoom).toBe(180);
  expect((await f.state()).me.body).toBe('robot');expect(errors).toEqual([]);
  console.log('PASS robot survey wheel zoom '+(mobile?'phone':'desktop'));
 }finally{await context.close();await f.close();}
}
