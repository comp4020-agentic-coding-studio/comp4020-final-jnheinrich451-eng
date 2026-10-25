import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export async function checkVesper(browser,mobile=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-vesper-')),app=createApp({dataDir:dir,logSink:()=>{}});let context;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const post=(route,data)=>context.request.post(url+route,{data,headers:{Origin:url}}),credentials={name:'Explorer',email:'vesper@frontier.test',password:'a unique vesper password 123!',kind:'demo'};
  expect((await post('/api/auth/register',credentials)).status()).toBe(200);const inbox=await(await context.request.get(url+'/api/auth/inbox')).json();await post('/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});expect((await post('/api/auth/login',credentials)).status()).toBe(200);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await expect(p.getByRole('button',{name:'Select Vesper'})).toBeVisible();
  await p.getByRole('button',{name:'Select Vesper'}).click();await p.locator('#create input[name=name]').fill('Vesper expedition');await p.locator('#create button').click();await expect(p.locator('.campaign-card')).toContainText('Vesper expedition');
  await p.screenshot({path:'.local/vesper-lobby-'+mobile+'.png',fullPage:true});await p.getByRole('button',{name:'Open / resume'}).click();await expect(p.locator('#connection')).toContainText('live');await expect(p.locator('.brand small')).toContainText('VSP');
  const id=new URL(p.url()).searchParams.get('campaign'),state=async()=>await(await context.request.get(url+'/api/campaign-world/'+id+'/world')).json();expect((await state()).world.template).toBe('vesper-v1');
  await p.locator('#coordinate-details summary').click();await p.locator('#tile-x').fill('72');await p.locator('#tile-y').fill('80');await p.locator('#select-tile').click();await expect(p.locator('#place-building')).toBeEnabled();await p.locator('#place-building').click();
  await expect.poll(async()=>(await state()).me.body,{timeout:12000}).toBe('robot');await expect.poll(async()=>(await state()).me.deploying,{timeout:12000}).toBe(false);await p.locator('#world-canvas').focus();const before=(await state()).me.x;await p.keyboard.down('d');try{await expect.poll(async()=>(await state()).me.x).toBeGreaterThan(before+.4);}finally{await p.keyboard.up('d');}
  await p.locator('#planet-open').click();await expect(p.locator('#planet-title')).toHaveText('Vesper');await p.locator('#planet-regions').selectOption('lake');await p.screenshot({path:'.local/vesper-globe-'+mobile+'.png'});await p.locator('#planet-visit').click();
  for(let i=0;i<3;i++)await p.locator('#zoom-out').click();await p.screenshot({path:'.local/vesper-terrain-'+mobile+'.png'});
  await p.locator('#planet-open').click();await p.locator('#planet-regions').selectOption('meridian');await p.locator('#planet-visit').click();await p.screenshot({path:'.local/vesper-ridge-'+mobile+'.png'});
  await p.reload();await expect(p.locator('#connection')).toContainText('live');expect((await state()).cores).toHaveLength(1);expect((await state()).world.name).toBe('Vesper');expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 }finally{await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-vesper-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}
}
