import { test, expect } from '@playwright/test';
import { createApp } from '../../server.js';
import { corePlacementError } from '../../public/core.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('accounts created in one browser get independent robots and cores when joining from isolated sessions',async({browser})=>{
 test.setTimeout(40000);
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-identity-browser-')),app=createApp({dataDir:dir,logSink:()=>{}}),contexts=[];
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  const owner=await browser.newContext(),friend=await browser.newContext();contexts.push(owner,friend);
  const post=async(c,route,data={})=>{const r=await c.request.post(base+route,{data,headers:{Origin:base}});expect(r.status(),await r.text()).toBeLessThan(300);return r.json();};
  const credentials=name=>({name,kind:'demo',email:name.toLowerCase()+'@frontier.test',password:'independent pilots test 123!'});
  // Reproduce creating both accounts in the same cookie jar, with explicit logout.
  for(const name of ['Alpha','Bravo']){
   await post(owner,'/api/auth/register',credentials(name));const inbox=await(await owner.request.get(base+'/api/auth/inbox')).json();
   await post(owner,'/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post(owner,'/api/auth/login',credentials(name));await post(owner,'/api/auth/logout');
  }
  await post(owner,'/api/auth/login',credentials('Alpha'));
  const {id}=await post(owner,'/api/campaigns/create',{name:'Independent pilots'});await post(owner,'/api/campaigns/enter',{id});
  const a=await owner.newPage(),sameProfile=await owner.newPage(),b=await friend.newPage(),route='/api/campaign-world/'+id;
  const state=p=>p.evaluate(async route=>await(await fetch(route+'/world')).json(),route);
  await a.goto(base+'/?campaign='+id);await expect(a.locator('#connection')).toContainText('live');
  await sameProfile.goto(base+'/?campaign='+id);await expect(sameProfile.locator('#connection')).toContainText('live');
  expect((await state(sameProfile)).me.id).toBe((await state(a)).me.id);
  expect((await state(a)).players).toHaveLength(1); // Two ordinary tabs are one player.
  await sameProfile.close();
  await post(friend,'/api/auth/login',credentials('Bravo'));const {code}=await post(owner,'/api/campaigns/invite',{id});await post(friend,'/api/campaigns/join',{code});
  await b.goto(base+'/?campaign='+id);await expect(b.locator('#connection')).toContainText('live');
  const aid=(await state(a)).me.id,bid=(await state(b)).me.id;expect(aid).not.toBe(bid);
  await expect.poll(async()=>(await state(a)).players.length).toBe(2);
  for(const[c,p]of[[owner,a],[friend,b]]){
   const s=await state(p);expect(s.me.body).toBe('orbital');let point;
   const w={...s.world,cores:s.cores,sites:s.combat.sites,airbases:s.airbases,ships:s.ships,tanks:s.tanks,artillery:s.artillery,rails:s.rails};
   for(let y=6;y<w.height-7&&!point;y++)for(let x=6;x<w.width-7&&!point;x++)if(!corePlacementError(w,s.buildings,s.players.filter(v=>v.body!=='orbital'),x,y,s.me.id))point={x,y};
   expect(point).toBeTruthy();await post(c,route+'/cores',point);
   await expect.poll(async()=>(await state(p)).me.deploying,{timeout:6000}).toBe(false);expect((await state(p)).me.body).toBe('robot');
  }
  const beforeA=(await state(a)).me,beforeB=(await state(b)).me;
  expect(new Set((await state(a)).cores.map(c=>c.owner))).toEqual(new Set([aid,bid]));
  await b.bringToFront();await b.locator('#world-canvas').focus();await b.keyboard.down('d');
  await expect.poll(async()=>(await state(b)).me.x,{timeout:3000}).toBeGreaterThan(beforeB.x+.2);await b.keyboard.up('d');
  const afterA=(await state(a)).me;expect(afterA.x).toBe(beforeA.x);expect(afterA.y).toBe(beforeA.y);
  expect((await state(a)).players.find(p=>p.id===bid).x).toBeGreaterThan(beforeB.x+.2);
 }finally{await Promise.all(contexts.map(c=>c.close()));await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-identity-browser-'))throw Error('Bad temp path');await rm(dir,{recursive:true,force:true});}
});
