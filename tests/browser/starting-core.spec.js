import {test,expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {freshLife} from '../../public/survival.js';
import {createWorld} from '../../public/world.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';

for(const hasCore of [false,true])test(hasCore?'recover at a teammates protected starting core':'explain and open emergency recovery when every core is lost',async({browser})=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-starting-core-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
 db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify({...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2)}));
 db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Pilot',44.5,35.5,0);
 db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),health:0,life:'disabled',deployed:true}));
 if(hasCore)db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('anchor','friend',36,28,4.5);
 db.close();app=createApp({dataDir:dir,logSink:()=>{}});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  context=await browser.newContext({viewport:{width:1280,height:960}});await context.addCookies([{name:'frontier',value:token,url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await expect(page.locator('#recovery-panel')).toBeVisible();
  if(hasCore){
   await expect(page.locator('#recovery-core option')).toContainText('Starting core / protected');
   await expect(page.locator('#emergency-orbit')).toBeHidden();
   await expect(page.locator('#revive-button')).toBeEnabled();
   await page.screenshot({path:'.local/starting-core-recovery.png'});
   await page.locator('#revive-button').click();
   await expect(page.locator('#recovery-panel')).toBeHidden({timeout:6000});
   const state=await page.evaluate(async()=>await(await fetch('/api/world')).json());
   expect(state.me.health).toBe(100);expect(state.me.reviveCore).toBe('anchor');
  }else{
   await expect(page.locator('#recovery-core')).toBeDisabled();await expect(page.locator('#revive-button')).toBeHidden();
   await expect(page.locator('#recovery-message')).toContainText('No recovery base remains');
   await expect(page.locator('#emergency-orbit')).toBeVisible();
   await page.screenshot({path:'.local/no-core-recovery.png'});
   await page.locator('#emergency-orbit').click();await expect(page.locator('#recovery-panel')).toBeHidden();
   await expect.poll(async()=>page.evaluate(async()=>(await(await fetch('/api/world')).json()).me.body)).toBe('orbital');
  }
  expect(errors).toEqual([]);
 }finally{
  await context?.close();await app.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-starting-core-'))throw Error('Unexpected test path');
  await rm(dir,{recursive:true,force:true});
 }
});
