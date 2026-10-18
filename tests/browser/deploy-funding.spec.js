import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLife} from '../../public/survival.js';
import {freshLogistics,quote} from '../../public/logistics.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

for(const mobile of [false,true])test('deployment funding follows the selected footprint / '+(mobile?'phone':'desktop'),async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-deploy-funding-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;await app.close();
 const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify({...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Builder',15,15,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));
 db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('core','pilot',10,10,99);
 db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify({...freshLogistics(),supplies:1200,groundSupplies:300}));db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#build-mode').click();await page.locator('[data-force-tab="logistics"]').click();
  await expect(page.locator('#outpost-card')).toContainText(quote('outpost')+' ORB');await expect(page.locator('#outpost-card-ground')).toContainText(quote('outpost',true)+' GND');
  await page.screenshot({path:'.local/deploy-prices-'+mobile+'.png'});
  await page.locator('#outpost-card-ground').click();await page.locator('#coordinate-details summary').click();
  async function site(x,y){await page.locator('#tile-x').fill(String(x));await page.locator('#tile-y').fill(String(y));await page.locator('#select-tile').click();}
  await site(20,18);await expect(page.locator('#construction-method option')).toHaveCount(2);await expect(page.locator('#delivery-ground')).toHaveAttribute('aria-pressed','true');
  await page.locator('#delivery-ground').click();await expect(page.locator('#deployment-cost')).toContainText(quote('outpost',true)+' GND');
  // The old local source must not survive a move beyond its support circle.
  await site(90,70);await expect(page.locator('#construction-method option')).toHaveCount(1);await expect(page.locator('#construction-method')).toHaveValue('orbital');await expect(page.locator('#delivery-ground')).toBeHidden();
  await expect(page.locator('#deployment-cost')).toContainText(quote('outpost')+' ORB');await expect(page.locator('#construction-availability')).toContainText('Outside construction support');
  await site(20,18);await page.locator('#delivery-ground').click();await expect(page.locator('#place-building')).toBeEnabled();
  await page.screenshot({path:'.local/deploy-local-choice-'+mobile+'.png'});await page.locator('#place-building').click();
  const state=()=>page.evaluate(async()=>(await fetch('/api/world')).json());
  await expect.poll(async()=>(await state()).logistics.facilities.length).toBe(1);
  const after=await state(),job=Object.values(after.logistics.jobs)[0];expect(job.method).toBe('factory');expect(job.pool).toBe('groundSupplies');expect(after.logistics.groundSupplies).toBe(300-quote('outpost',true));expect(after.logistics.supplies).toBe(1200);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context?.close();await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-deploy-funding-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});}
});
