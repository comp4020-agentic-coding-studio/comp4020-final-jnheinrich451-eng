import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkSound(browser,mobile=false){
 const f=await wreckRecoveryFixture({sea:true});
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  await context.addInitScript(()=>{
   window.audioStarts=0;window.decodedSounds=[];window.playedSounds=[];
   // Measure the native signal in the actual final output path. Merely decoding
   // a file or starting a source cannot catch a disconnected master/compressor.
   // This probe only inserts a transparent analyser where production code
   // already connects to the destination; it never repairs a missing edge.
   window.outputMeters=[];window.outputPeak=0;
   const connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(destination,...ports){
    if(destination instanceof AudioDestinationNode){
     const analyser=this.context.createAnalyser();analyser.fftSize=1024;
     connect.call(this,analyser,...ports);connect.call(analyser,destination);
     window.outputMeters.push(analyser);return destination;
    }
    return connect.call(this,destination,...ports);
   };
   setInterval(()=>{
    for(const analyser of window.outputMeters){
     const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);
     for(const value of samples)window.outputPeak=Math.max(window.outputPeak,Math.abs(value));
    }
   },16);
   const encoded=new WeakMap(),decoded=new WeakMap(),records=new WeakMap(),intervals=[],fetchAudio=window.fetch;
   let metricStart=0;
   const endAt=r=>Math.min(r.naturalEnd,r.stopAt??Infinity);
   Object.defineProperty(window,'activeAudioVoices',{get:()=>intervals.filter(({context,record})=>record.startAt<=context.currentTime&&endAt(record)>context.currentTime).length});
   Object.defineProperty(window,'maxAudioVoices',{
    set:()=>{metricStart=intervals.length;},
    get:()=>{
     let peak=0;
     for(const context of new Set(intervals.slice(metricStart).map(i=>i.context))){
      const events=intervals.slice(metricStart).filter(i=>i.context===context&&endAt(i.record)>i.record.startAt)
       .flatMap(({record:r})=>[[r.startAt,1],[endAt(r),-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      let active=0;for(const [,change]of events){active+=change;peak=Math.max(peak,active);}
     }
     return peak;
    },
   });
   window.fetch=async function(...args){
    const response=await fetchAudio.apply(this,args),url=String(args[0]?.url||args[0]);
    if(url.includes('/audio/effects/')){
     const arrayBuffer=response.arrayBuffer.bind(response);
     response.arrayBuffer=async()=>{const bytes=await arrayBuffer();encoded.set(bytes,url);return bytes;};
    }
    return response;
   };
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){
    window.audioStarts++;
    const record={file:decoded.get(this.buffer),loop:this.loop,rate:this.playbackRate.value,offset:args[1]||0,bufferDuration:this.buffer?.duration,startAt:Math.max(args[0]||0,this.context.currentTime)};
    record.naturalEnd=record.loop?Infinity:record.startAt+Math.min(record.bufferDuration-record.offset,args[2]??Infinity)/record.rate;
    records.set(this,record);intervals.push({context:this.context,record});window.playedSounds.push(record);
    return start.apply(this,args);
   };
   const stop=AudioBufferSourceNode.prototype.stop;
   AudioBufferSourceNode.prototype.stop=function(...args){
    const record=records.get(this);
    if(record&&endAt(record)>this.context.currentTime){record.stopAt=Math.max(args[0]||0,this.context.currentTime);if(args[0]>this.context.currentTime+.001)record.scheduledDuration=args[0]-record.startAt;}
    const result=stop.apply(this,args);
    window.onAudioStop?.({record,remaining:record?.stopAt-this.context.currentTime});return result;
   };
   const decode=AudioContext.prototype.decodeAudioData;
   AudioContext.prototype.decodeAudioData=async function(...args){
    const file=encoded.get(args[0]),b=await decode.apply(this,args);decoded.set(b,file);
    window.decodedSounds.push({file,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate});return b;
   };
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  expect(await page.evaluate(()=>window.audioStarts)).toBe(0);
  await page.locator('#hud-menu-button').click().then(()=>page.locator('#help-button').click());
  await expect(page.locator('#sound-status')).toContainText('ready',{timeout:15000});
  const metadata=await page.evaluate(()=>window.decodedSounds);
  const files=await page.evaluate(async()=>[...new Set(Object.values((await import('/sound.js')).SOUND_FILES))]);
  expect(files.length).toBeGreaterThan(30);expect(files.every(file=>file.startsWith('generated/')&&file.endsWith('.ogg'))).toBe(true);
  expect(metadata).toHaveLength(files.length);expect(metadata.every(b=>b.duration>0&&b.duration<10&&b.channels===2)).toBe(true);
  expect(new Set(metadata.map(b=>b.file)).size).toBe(files.length);
  for(const file of files){
   const response=await context.request.get(f.url+'/audio/effects/'+file);
   expect(response.status()).toBe(200);expect(response.headers()['content-type']).toBe('audio/ogg');
   expect(Number(response.headers()['content-length'])).toBe((await response.body()).length);
  }
  // Decode every prepared asset as well as the selected runtime palette. This
  // catches an invalid codec/container even for an optional shared sound.
  if(!mobile){
   const prepared=await page.evaluate(async()=>{
    const manifest=await (await fetch('/audio/effects/generated/manifest.json')).json(),audio=new AudioContext();
    try{
     const result=[];
     for(const entry of manifest.files){
      const response=await fetch('/audio/effects/generated/'+entry.file),buffer=await audio.decodeAudioData(await response.arrayBuffer());
      result.push({source:entry.source,duration:buffer.duration,channels:buffer.numberOfChannels,mime:response.headers.get('content-type')});
     }
     return result;
    }finally{await audio.close();}
   });
   expect(prepared).toHaveLength(files.length);expect(prepared.every(b=>b.duration>0&&b.channels===2&&b.mime==='audio/ogg')).toBe(true);
  }
  await page.locator('#sound-volume').fill('40');
  await page.screenshot({path:'.local/sound-'+(mobile?'phone':'desktop')+'.png'});
  await page.keyboard.press('Escape');
  // A rejected real server command must not sound. A confirmed naval shot must.
  expect((await f.post('ships/fire',{x:-1,y:0})).status).toBe(400);
  // The occupied transport now has an engine bed; a rejected weapon command
  // must add no one-shot even while that legitimate continuous sound plays.
  expect(await page.evaluate(()=>window.playedSounds.filter(sound=>!sound.loop))).toHaveLength(0);
  const fire=await f.post('ships/fire',{x:30.5,y:20.5,mode:'salvo'});
  expect(fire.status,JSON.stringify(fire.data)).toBe(200);
  await expect.poll(()=>page.evaluate(()=>window.playedSounds.filter(sound=>!sound.loop).length)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.outputPeak),{message:'Confirmed gunfire must produce nonzero samples in the speaker-output chain'}).toBeGreaterThan(.0001);
  const outputSignal=await page.evaluate(()=>({peak:window.outputPeak,paths:window.outputMeters.length}));
  await expect.poll(()=>page.evaluate(()=>window.playedSounds.some(s=>s.file?.endsWith('/sfx_wpn_naval_406mm_single_shot_01.ogg')))).toBe(true);
  await expect.poll(async()=>(await f.state()).combat.impacts.length,{timeout:7000}).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.audioStarts)).toBeGreaterThan(1);
  await expect.poll(()=>page.evaluate(()=>window.playedSounds.some(s=>s.file?.endsWith('/sfx_exp_naval_406mm_he_impact_01.ogg')))).toBe(true);
  await page.locator('#hud-menu-button').click().then(()=>page.locator('#help-button').click());await page.locator('#sound-toggle').click();
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#hud-menu-button').click().then(()=>page.locator('#help-button').click());await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#sound-volume')).toHaveValue('40');expect(await page.evaluate(()=>window.audioStarts)).toBe(0);
  // Isolate the browser mixer to exercise busy snapshots, mute, hidden and resets
  // against real decoded files and native Web Audio, without changing any save.
  const mixer=await context.newPage();mixer.on('pageerror',e=>errors.push(e.message));await mixer.goto(f.url+'/readme/');
  await mixer.setContent('<button id="sound-toggle"></button><input id="sound-volume" type="range" min="0" max="100"><p id="sound-status"></p>');
  await mixer.evaluate(async()=>{
   localStorage.removeItem('frontier-sound');window.soundActive=true;
   window.mixer=(await import('/sound.js')).setupSound({listener:()=>({x:10,y:10}),active:()=>window.soundActive});
   window.pushSound=(time,shots=[],extra={})=>window.mixer.ingest({epoch:'test',time,shots,...extra});
   window.pushSound(0);
  });
  await mixer.locator('#sound-volume').click();await expect(mixer.locator('#sound-status')).toContainText('ready',{timeout:15000});
  // An ordinary APCR event must select the supplied single-shot machine gun
  // and produce native output, without relying on an explicit sound override.
  expect(await mixer.evaluate(()=>window.outputPeak)).toBe(0);
  await mixer.evaluate(()=>window.pushSound(100,[{id:1,at:100,x:10,y:10,weapon:'APCR',mount:'coax'}]));
  await expect.poll(()=>mixer.evaluate(()=>window.outputPeak),{message:'APCR single-shot machine gun must reach the speaker-output chain'}).toBeGreaterThan(.0001);
  const machineGunSignal=await mixer.evaluate(()=>({peak:window.outputPeak,played:window.playedSounds}));
  expect(machineGunSignal.played).toHaveLength(1);
  expect(machineGunSignal.played[0].file).toContain('/sfx_wpn_mg_762mm_shot_single_01.ogg');
  expect(machineGunSignal.played[0]).toMatchObject({loop:false,rate:1});
  const mapped=await mixer.evaluate(()=>{
   const pairs=[
    ['tank-shot','tank-impact','HE','coax'],
    ['naval-secondary-shot','naval-secondary-impact','NAVAL_APCR','naval-secondary'],
    ['gunship-105-shot','gunship-105-impact','APCR','air-gunship-105'],
    ['heli-cannon-shot','heli-cannon-impact','APCR','helicopter-cannon'],
    ['magnetic-shot','magnetic-impact','MAGNETIC','coax'],
   ];
   return pairs.map(([shotSound,impactSound,weapon,mount])=>{
    window.mixer.reset();window.pushSound(0);const before=window.playedSounds.length;
    window.pushSound(100,[{id:1,at:100,x:10,y:10,weapon,mount,sound:shotSound,first:true}],
     {impacts:[{id:2,at:100,x:10,y:10,weapon,sound:impactSound}]});
    return {shotSound,impactSound,played:window.playedSounds.slice(before)};
   });
  });
  const expectedFiles=[
   ['sfx_wpn_tank_120mm_shot_01.ogg','sfx_exp_he_120mm_impact_dirt_01.ogg'],
   ['sfx_wpn_naval_127mm_single_shot_01.ogg','sfx_exp_he_127mm_impact_01.ogg'],
   ['sfx_wpn_gunship_105mm_shot_01.ogg','sfx_exp_105mm_he_impact_01.ogg'],
   ['sfx_wpn_heli_30mm_single_shot_01.ogg',null],
   ['sfx_wpn_railgun_120mm_shot_01.ogg','sfx_impact_railgun_120mm_hypervelocity_01.ogg'],
  ];
  for(const [i,pair]of mapped.entries()){
   expect(pair.played,pair.shotSound).toHaveLength(2);
   for(const [j,file]of expectedFiles[i].entries())if(file)expect(pair.played[j].file).toContain(file);
   expect(pair.played.every(s=>s.loop===false&&s.rate===1)).toBe(true);
   // A single accepted shot keeps its supplied tail, rather than the old
   // shared palette's sub-second truncation. A source may end naturally.
   expect(pair.played.every(s=>s.scheduledDuration===undefined||s.scheduledDuration>=s.bufferDuration-.1)).toBe(true);
  }
  const traces=await mixer.evaluate(()=>{
   window.mixer.reset();window.pushSound(0);const before=window.audioStarts;
   window.pushSound(100,[{id:1,at:100,x:10,y:10,weapon:'AA35',mount:'aa-35mm',sound:'aa-shot'}]);
   const fired=window.audioStarts-before;
   window.pushSound(200,[{id:2,at:200,x:11,y:10,weapon:'AA35',mount:'aa-tracer'},
    {id:3,at:200,x:12,y:10,weapon:'MAGNETIC',first:false},{id:4,at:200,x:13,y:10,weapon:'MAC',first:false}]);
   return {fired,afterTraces:window.audioStarts-before};
  });expect(traces).toEqual({fired:1,afterTraces:1});
  const flame=await mixer.evaluate(()=>{
   window.mixer.reset();window.pushSound(0);const before=window.audioStarts;
   for(let i=1;i<=8;i++)window.pushSound(i*100,[{id:i,at:i*100,x:10,y:10,owner:'robot',weapon:'FLAME'}]);
   return {starts:window.audioStarts-before,active:window.activeAudioVoices,loop:window.playedSounds.at(-1).loop};
  });expect(flame).toEqual({starts:1,active:1,loop:false});
  await expect.poll(()=>mixer.evaluate(()=>window.activeAudioVoices),{timeout:1500}).toBe(0);
  await mixer.evaluate(()=>window.pushSound(900,[{id:9,at:900,x:10,y:10,owner:'robot',weapon:'FLAME'}]));
  expect(await mixer.evaluate(()=>window.activeAudioVoices)).toBe(1);
  await mixer.locator('#sound-toggle').click();expect(await mixer.evaluate(()=>window.activeAudioVoices)).toBe(0);
  await mixer.locator('#sound-toggle').click();
  const expiryRace=await mixer.evaluate(()=>new Promise((resolve,reject)=>{
   window.mixer.reset();window.pushSound(0);const before=window.audioStarts;
   const timeout=setTimeout(()=>reject(new Error('Flame expiry did not schedule its fade')),1500);
   window.onAudioStop=({record,remaining})=>{
    if(!record?.file?.includes('flame_robot')||remaining<.02||remaining>.06)return;
    window.onAudioStop=null;
    queueMicrotask(()=>{
     window.pushSound(200,[{id:2,at:200,x:10,y:10,owner:'expiry-race',weapon:'FLAME'}]);
     clearTimeout(timeout);resolve({starts:window.audioStarts-before,active:window.activeAudioVoices});
    });
   };
   window.pushSound(100,[{id:1,at:100,x:10,y:10,owner:'expiry-race',weapon:'FLAME'}]);
  }));
  expect(expiryRace.starts).toBe(2);expect(expiryRace.active).toBeGreaterThan(0);
  // Start the count-based checks with a fresh baseline after mapping probes.
  await mixer.evaluate(()=>{window.mixer.reset();window.pushSound(0);window.audioStarts=0;window.maxAudioVoices=0;});
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
  const voiceCap=await mixer.evaluate(()=>{
   window.mixer.reset();window.pushSound(0);
   for(let round=0;round<8;round++){
    const kinds=['tank-shot','naval-main-shot','railway-shot','gunship-105-shot','mac-shot','missile-shot','rocket-shot','laser-shot'];
    window.pushSound(100+round*100,Array.from({length:6},(_,i)=>({id:1000+round*10+i,at:100+round*100,x:4+i*4,y:10,weapon:'HE',sound:kinds[round]})));
   }
   return window.maxAudioVoices;
  });expect(voiceCap).toBeLessThanOrEqual(16);
  await mixer.locator('#sound-toggle').click();
  const muted=await mixer.evaluate(()=>{const before=window.audioStarts;window.pushSound(400,[{id:500,at:400,x:10,y:10,weapon:'HE'}]);return window.audioStarts-before;});expect(muted).toBe(0);
  await mixer.locator('#sound-toggle').click();
  const unmuted=await mixer.evaluate(()=>{const before=window.audioStarts;window.pushSound(400,[{id:500,at:400,x:10,y:10,weapon:'HE'}]);return window.audioStarts-before;});expect(unmuted).toBe(0);
  const inactive=await mixer.evaluate(()=>{
   const before=window.audioStarts;window.soundActive=false;
   window.pushSound(450,[{id:550,at:450,x:10,y:10,weapon:'HE'}]);window.soundActive=true;
   window.pushSound(450,[{id:550,at:450,x:10,y:10,weapon:'HE'}]);return window.audioStarts-before;
  });expect(inactive).toBe(0);
  const hidden=await mixer.evaluate(()=>{
   const before=window.audioStarts;
   Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
   window.pushSound(500);window.pushSound(600,[{id:600,at:600,x:10,y:10,weapon:'HE'}]);
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
   window.pushSound(600,[{id:600,at:600,x:10,y:10,weapon:'HE'}]);
   return window.audioStarts-before;
  });expect(hidden).toBe(0);
  // Exercise the compatibility path with actual browser decoders. Invalid Ogg
  // bytes make native decodeAudioData reject; the prepared PCM copy must still
  // load and reach the real output chain. No game save is changed by this probe.
  async function isolatedMixer(){
   const probe=await context.newPage();probe.on('pageerror',e=>errors.push(e.message));
   await probe.goto(f.url+'/readme/');
   await probe.setContent('<button id="sound-toggle"></button><input id="sound-volume" type="range" min="0" max="100"><p id="sound-status"></p>');
   await probe.evaluate(async()=>{
    localStorage.removeItem('frontier-sound');
    window.mixer=(await import('/sound.js')).setupSound({listener:()=>({x:10,y:10}),active:()=>true});
    window.pushSound=(time,shots=[])=>window.mixer.ingest({epoch:'fallback-test',time,shots});
    window.pushSound(0);
   });
   return probe;
  }
  const compatible=await isolatedMixer();
  await compatible.route('**/audio/effects/**/*.ogg',route=>route.fulfill({status:200,contentType:'audio/ogg',body:'invalid Ogg bytes: exercise native decode failure'}));
  await compatible.locator('#sound-volume').click();
  await expect(compatible.locator('#sound-status')).toContainText('ready',{timeout:20000});
  const fallbackDecoded=await compatible.evaluate(()=>window.decodedSounds);
  expect(fallbackDecoded).toHaveLength(files.length);
  expect(fallbackDecoded.every(b=>b.file.endsWith('.wav')&&b.duration>0)).toBe(true);
  await compatible.evaluate(()=>window.pushSound(100,[{id:1,at:100,x:10,y:10,weapon:'HE'}]));
  await expect.poll(()=>compatible.evaluate(()=>window.outputPeak),{message:'PCM fallback must reach the speaker-output chain'}).toBeGreaterThan(.0001);
  expect(await compatible.evaluate(()=>window.playedSounds[0].file)).toContain('sfx_wpn_tank_120mm_shot_01.wav');
  const pcm=await context.request.get(f.url+'/audio/effects/'+files[0].replace(/\.ogg$/,'.wav'));
  expect(pcm.status()).toBe(200);expect(pcm.headers()['content-type']).toBe('audio/wav');
  expect(Number(pcm.headers()['content-length'])).toBe((await pcm.body()).length);
  await compatible.close();

  // A network failure of both encodings must stop loading, explain which file
  // failed, and recover through the existing toggle without replaying old shots.
  const retry=await isolatedMixer();let unavailable=true;
  await retry.route('**/audio/effects/**',route=>unavailable
   ?route.fulfill({status:503,contentType:'text/plain',body:'Audio temporarily unavailable'})
   :route.continue());
  await retry.locator('#sound-volume').click();
  await expect(retry.locator('#sound-status')).toContainText(/failed|unavailable/i,{timeout:15000});
  await expect(retry.locator('#sound-status')).not.toContainText('Loading');
  const failureText=await retry.locator('#sound-status').textContent();
  expect(failureText).toMatch(/sfx_.*\.(?:ogg|wav)/);expect(failureText).toContain('503');
  await retry.evaluate(()=>window.pushSound(100,[{id:1,at:100,x:10,y:10,weapon:'HE'}]));
  expect(await retry.evaluate(()=>window.audioStarts)).toBe(0);
  unavailable=false;await retry.locator('#sound-toggle').click();await retry.locator('#sound-toggle').click();
  await expect(retry.locator('#sound-status')).toContainText('ready',{timeout:20000});
  await retry.evaluate(()=>window.pushSound(200,[{id:1,at:100,x:10,y:10,weapon:'HE'}]));
  expect(await retry.evaluate(()=>window.audioStarts)).toBe(0);
  await retry.evaluate(()=>window.pushSound(300,[{id:2,at:300,x:10,y:10,weapon:'HE'}]));
  await expect.poll(()=>retry.evaluate(()=>window.outputPeak),{message:'Recovered loading must produce new sound without replaying missed shots'}).toBeGreaterThan(.0001);
  await retry.close();
  expect(errors).toEqual([]);console.log('PASS weapon audio '+(mobile?'phone':'desktop'),{outputSignal,machineGunSignal,decoded:files.length,fallbackDecoded:fallbackDecoded.length,counts,batch,voiceCap,traces});
 }finally{await context.close();await f.close();}
}
