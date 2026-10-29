import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export async function checkSupplyReserve(browser,mobile){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-supply-ui-')),tokens=[randomUUID(),randomUUID(),randomUUID()],streams=[];
 let app=createApp({dataDir:dir,logSink:()=>{}}),context;
 try{
  await app.close();const db=new DatabaseSync(path.join(dir,'world.sqlite'));
  for(const [i,token] of tokens.entries())db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(token,'pilot-'+i,'Pilot '+i,20+i,20,0);
  db.close();app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
  await context.addCookies([{name:'frontier',value:tokens[0],url}]);const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');await p.locator('#supplies-button').click();
  const balance=p.locator('#logistics-balance');await expect(balance).toContainText('1 connected player: ORB +2/s up to 250; GND +0.4/s up to 50');
  const connect=async i=>{const c=new AbortController();streams.push(c);const r=await fetch(url+'/api/events',{headers:{Cookie:'frontier='+tokens[i]},signal:c.signal});void(async()=>{try{for await(const chunk of r.body){}}catch{}})();};
  await connect(0);await expect(balance).toContainText('1 connected player:');
  await connect(1);await expect(balance).toContainText('2 connected players: ORB +2/s up to 400; GND +0.4/s up to 85');
  await connect(2);await expect(balance).toContainText('3 connected players: ORB +2/s up to 650; GND +0.4/s up to 135');
  await p.screenshot({path:'.local/supply-reserve-'+(mobile?'phone':'desktop')+'.png'});
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  streams[2].abort();await expect(balance).toContainText('2 connected players:');expect(errors).toEqual([]);
 }finally{
  streams.forEach(c=>c.abort());await context?.close();await app.close();
  if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-supply-ui-'))throw Error('Unsafe fixture path');
  await rm(dir,{recursive:true,force:true});
 }
}
