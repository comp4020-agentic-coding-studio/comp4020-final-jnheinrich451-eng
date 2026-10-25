import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLogistics} from '../../public/logistics.js';
import {freshLife} from '../../public/survival.js';
import {bridgeReady} from '../../public/bridge-geometry.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export async function checkHeavyBridge(browser,mobile=false,previewOnly=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-heavy-bridge-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 try{
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite')),token=randomUUID();
  const w={...createWorld(),version:2,width:128,height:96,terrain:Array(128*96).fill(2),sites:[]};
  for(let y=0;y<96;y++)for(let x=35;x<=64;x++)w.terrain[y*128+x]=0;
  const l={...freshLogistics(),groundSupplies:1200,recyclers:[{id:'builder',kind:'builder',owner:'pilot',x:33.5,y:42.5,remaining:0,cargo:0,path:[],angle:Math.PI/2}]};
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
  db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot','Engineer',32.5,42.5,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run('pilot',JSON.stringify({...freshLife(),deployed:true}));db.close();
  app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');
  const state=async()=>await(await context.request.get(url+'/api/world')).json();
  await p.locator('#recycler-interact').click();await p.locator('#builder-plan').click();await expect(p.locator('#bridge-profile')).toHaveValue('standard');await expect(p.locator('#bridge-confirm')).toBeDisabled();
  expect(await p.locator('#bridge-profile').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);
  await p.locator('#bridge-profile').selectOption('heavy');await expect(p.locator('#bridge-title')).toContainText('5 WIDE');await expect(p.locator('#bridge-confirm')).toBeEnabled();await expect(p.locator('#bridge-message')).toContainText('350 ground SUP / 35.8s');
  await p.locator('#bridge-method').selectOption('manual');for(const [id,value]of [['from-x','34'],['from-y','42'],['to-x','65'],['to-y','42']])await p.locator('#bridge-'+id).fill(value);
  await expect(p.locator('#bridge-confirm')).toBeEnabled();await p.locator('#bridge-profile').selectOption('standard');await expect(p.locator('#bridge-message')).toContainText('24');await expect(p.locator('#bridge-confirm')).toBeDisabled();
  await p.locator('#bridge-profile').selectOption('heavy');await p.locator('#bridge-method').selectOption('ahead');await expect(p.locator('#bridge-confirm')).toBeEnabled();
  await p.screenshot({path:'.local/heavy-bridge-preview-'+mobile+'.png'});
  if(previewOnly){expect(errors).toEqual([]);expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);return;}
  await p.locator('#bridge-confirm').click();await expect.poll(async()=>(await state()).logistics.bridges.length).toBe(1);
  await p.screenshot({path:'.local/heavy-bridge-cables-'+mobile+'.png'});await expect.poll(async()=>(await state()).logistics.bridges[0].elapsed,{timeout:8000}).toBeGreaterThan(5);
  await p.screenshot({path:'.local/heavy-bridge-deck-'+mobile+'.png'});await expect.poll(async()=>bridgeReady((await state()).logistics.bridges[0]),{timeout:40000}).toBe(true);
  expect((await state()).logistics.groundSupplies).toBe(850);await p.locator('#world-canvas').focus();
  await p.keyboard.down('w');try{await expect.poll(async()=>(await state()).me.x,{timeout:18000}).toBeGreaterThan(66);}finally{await p.keyboard.up('w');}
  await p.screenshot({path:'.local/heavy-bridge-complete-'+mobile+'.png'});await p.reload();await expect(p.locator('#connection')).toContainText('live');const saved=await state();expect(saved.logistics.bridges[0]).toMatchObject({profile:'heavy',width:5,cost:350});expect(bridgeReady(saved.logistics.bridges[0])).toBe(true);
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-heavy-bridge-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}
}
