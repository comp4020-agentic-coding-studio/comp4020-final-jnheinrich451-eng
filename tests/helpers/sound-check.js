import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkSound(browser,mobile=false){
 const f=await wreckRecoveryFixture({sea:true});
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  await context.addInitScript(()=>{
   window.audioStarts=0;window.decodedSounds=[];
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){window.audioStarts++;return start.apply(this,args);};
   const decode=AudioContext.prototype.decodeAudioData;
   AudioContext.prototype.decodeAudioData=async function(...args){const b=await decode.apply(this,args);window.decodedSounds.push({duration:b.duration,channels:b.numberOfChannels});return b;};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  expect(await page.evaluate(()=>window.audioStarts)).toBe(0);
  await page.locator('#help-button').click();
  await expect(page.locator('#sound-status')).toContainText('ready');
  const metadata=await page.evaluate(()=>window.decodedSounds);
  expect(metadata).toHaveLength(6);expect(metadata.every(b=>b.duration>0&&b.duration<10)).toBe(true);
  for(const file of ['gun','cannon','rail','blast','missile','rumble']){
   const response=await context.request.get(f.url+'/audio/effects/'+file+'.ogg');
   expect(response.status()).toBe(200);expect(response.headers()['content-type']).toBe('audio/ogg');
   expect(Number(response.headers()['content-length'])).toBe((await response.body()).length);
  }
  await page.locator('#sound-volume').fill('40');
  await page.screenshot({path:'.local/sound-'+(mobile?'phone':'desktop')+'.png'});
  await page.keyboard.press('Escape');
  // A rejected real server command must not sound. A confirmed naval shot must.
  expect((await f.post('ships/fire',{x:-1,y:0})).status).toBe(400);
  expect(await page.evaluate(()=>window.audioStarts)).toBe(0);
  const fire=await f.post('ships/fire',{x:30.5,y:20.5,mode:'salvo'});
  expect(fire.status,JSON.stringify(fire.data)).toBe(200);
  await expect.poll(()=>page.evaluate(()=>window.audioStarts)).toBeGreaterThan(0);
  await expect.poll(async()=>(await f.state()).combat.impacts.length,{timeout:7000}).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.audioStarts)).toBeGreaterThan(1);
  await page.locator('#help-button').click();await page.locator('#sound-toggle').click();
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#help-button').click();await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#sound-volume')).toHaveValue('40');expect(await page.evaluate(()=>window.audioStarts)).toBe(0);
  // Isolate the browser mixer to exercise busy snapshots, mute, hidden and resets
  // against real decoded files and native Web Audio, without changing any save.
  const mixer=await context.newPage();await mixer.goto(f.url+'/readme/');
  await mixer.setContent('<button id="sound-toggle"></button><input id="sound-volume" type="range" min="0" max="100"><p id="sound-status"></p>');
  await mixer.evaluate(async()=>{
   localStorage.removeItem('frontier-sound');window.soundActive=true;
   window.mixer=(await import('/sound.js')).setupSound({listener:()=>({x:10,y:10}),active:()=>window.soundActive});
   window.pushSound=(time,shots=[])=>window.mixer.ingest({epoch:'test',time,shots});
   window.pushSound(0);
  });
  await mixer.locator('#sound-volume').click();await expect(mixer.locator('#sound-status')).toContainText('ready');
  const counts=await mixer.evaluate(()=>{
   const shot=(id,x=10,y=10)=>({id,at:100,x,y,weapon:'HE'});
   window.pushSound(100,Array.from({length:100},(_,i)=>shot(i)));
   const grouped=window.audioStarts;
   window.pushSound(100,Array.from({length:100},(_,i)=>shot(i)));
   const repeated=window.audioStarts;
   window.mixer.reset();window.pushSound(100,[shot(100)]);
   const reconnect=window.audioStarts;
   window.pushSound(100,[shot(101,1000)]);
   return {grouped,repeated,reconnect,far:window.audioStarts};
  });
  expect(counts).toEqual({grouped:1,repeated:1,reconnect:1,far:1});
  const batch=await mixer.evaluate(()=>{
   window.mixer.reset();window.pushSound(200);
   const before=window.audioStarts;
   window.pushSound(300,Array.from({length:100},(_,i)=>({id:200+i,at:300,x:(i%10)*4,y:Math.floor(i/10)*4,weapon:'HE'})));
   return window.audioStarts-before;
  });expect(batch).toBeLessThanOrEqual(6);expect(batch).toBeGreaterThan(0);
  await mixer.locator('#sound-toggle').click();
  const muted=await mixer.evaluate(()=>{const before=window.audioStarts;window.pushSound(400,[{id:500,at:400,x:10,y:10,weapon:'HE'}]);return window.audioStarts-before;});expect(muted).toBe(0);
  await mixer.locator('#sound-toggle').click();
  const hidden=await mixer.evaluate(()=>{
   const before=window.audioStarts;
   Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
   window.pushSound(500);window.pushSound(600,[{id:600,at:600,x:10,y:10,weapon:'HE'}]);
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
   window.pushSound(600,[{id:600,at:600,x:10,y:10,weapon:'HE'}]);
   return window.audioStarts-before;
  });expect(hidden).toBe(0);
  expect(errors).toEqual([]);console.log('PASS weapon audio '+(mobile?'phone':'desktop'),{metadata,counts,batch});
 }finally{await context.close();await f.close();}
}
