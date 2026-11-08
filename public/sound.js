import {SoundEvents, spatialSound} from './sound-events.js';
import {WorldSoundEvents} from './world-sound-events.js';
import {SOUND_PROFILES, SOUND_FILES} from './sound-catalog.js';
export {SOUND_FILES};

export function setupSound({listener, active}) {
  const toggle=document.getElementById('sound-toggle'), slider=document.getElementById('sound-volume');
  const status=document.getElementById('sound-status'), events=new SoundEvents(), worldEvents=new WorldSoundEvents(), quick=document.getElementById('sound-quick');
  let enabled=true, volume=.55, context=null, master=null, loading=null, failed=false, failureDetail='';
  const files=[...new Set(Object.values(SOUND_FILES))];
  const buffers=new Map(), loadFailures=new Map(), playing=new Set(), retiring=new Set(), groups=new Map(), sustained=new Map(), loops=new Map();
  let loopEpoch=null, loopTime=-Infinity;
  try {
    const saved=JSON.parse(localStorage.getItem('frontier-sound') || 'null');
    if(typeof saved?.enabled==='boolean')enabled=saved.enabled;
    if(Number.isFinite(saved?.volume))volume=Math.max(0,Math.min(1,saved.volume));
  } catch {}
  const wanted=()=>enabled && volume>0 && !document.hidden && active();
  function render() {
    toggle.textContent=enabled?'Effects on':'Effects off';toggle.setAttribute('aria-pressed',String(enabled));
    if(quick){quick.setAttribute('aria-pressed',String(enabled));quick.title=enabled?'Sound effects on':'Sound effects off';}
    slider.value=String(Math.round(volume*100));
    status.textContent=!enabled?'Sound effects off.':volume===0?'Effects muted.':failed?
      (loadFailures.size?'Some sounds unavailable ('+loadFailures.size+'/'+files.length+'): ':'Audio unavailable: ')+failureDetail+'. Toggle effects off and on to retry.':loading?'Loading sound effects...':
      context?.state==='running'?'Sound effects ready / distance and stereo positioning.':'Sounds start after a click, tap or key press.';
  }
  function save(){try{localStorage.setItem('frontier-sound',JSON.stringify({enabled,volume}));}catch{}}
  function stopVoice(voice) { try{voice.source.stop();}catch{} voice.dispose(); }
  function retireVoice(voice, until) {
    if(voice.disposed || retiring.has(voice))return;
    clearTimeout(voice.expiry);playing.delete(voice);retiring.add(voice);
    if(sustained.get(voice.sustain)===voice)sustained.delete(voice.sustain);
    if(loops.get(voice.loopId)===voice)loops.delete(voice.loopId);
    voice.stopAt=until;
    voice.gain.gain.cancelAndHoldAtTime(context.currentTime);
    voice.gain.gain.linearRampToValueAtTime(0,until);
    voice.source.stop(until);
  }
  function stop() {
    for(const voice of [...playing,...retiring])stopVoice(voice);
    groups.clear();sustained.clear();loops.clear();
  }
  // New voices wait until existing fades finish, so retired sources cannot
  // temporarily exceed the shared sixteen-voice physical output budget.
  const afterFades=()=>Math.max(context.currentTime,...[...retiring].map(v=>v.stopAt));
  async function loadSample(file) {
    // Some browser/OS combinations cannot decode the compressed export. Keep
    // PCM available without making every browser download the larger originals.
    let failure;
    for(const candidate of [file,file.replace(/\.ogg$/,'.wav')]) {
      try {
        const response=await fetch('/audio/effects/'+candidate,{cache:'no-cache'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const bytes=await response.arrayBuffer();
        let buffer;
        try{buffer=await context.decodeAudioData(bytes);}
        catch(error){throw new Error('decode failed ('+(error.name||'audio format')+')');}
        let peak=0;
        for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(value));
        return {buffer,scale:peak>0?.8/peak:1};
      }catch(error){failure=new Error(candidate.split('/').pop()+': '+error.message);}
    }
    throw failure;
  }
  async function unlock() {
    if(!enabled || document.hidden)return;
    try {
      if(!context) {
        context=new AudioContext();master=context.createGain();
        const limiter=context.createDynamicsCompressor();
        limiter.threshold.value=-16;limiter.knee.value=10;limiter.ratio.value=8;
        limiter.attack.value=.003;limiter.release.value=.18;
        master.connect(limiter);limiter.connect(context.destination);
        context.addEventListener('statechange',render);
      }
      master.gain.setTargetAtTime(volume,context.currentTime,.02);
      await context.resume();
      if(!loading && buffers.size<files.length) {
        failed=false;failureDetail='';
        const queue=files.filter(file=>!buffers.has(file));
        const worker=async()=>{
          while(queue.length){
            const file=queue.shift();
            try{
              buffers.set(file,await loadSample(file));loadFailures.delete(file);
            }catch(error){failed=true;failureDetail=error.message;loadFailures.set(file,error.message);}
          }
        };
        loading=Promise.all(Array.from({length:4},worker)).finally(()=>{loading=null;render();});
      }
    }catch(error){failed=true;failureDetail=error.name+': '+error.message;}
    render();
  }
  function renew(voice, spatial, profile, sample) {
    const now=context.currentTime;
    voice.gain.gain.setTargetAtTime(profile.gain*sample.scale*spatial.gain,now,.02);
    voice.pan.pan.setTargetAtTime(spatial.pan,now,.02);
    clearTimeout(voice.expiry);
    // A missing snapshot, release, pause or destroyed emitter ends the sound.
    // No seamless loop is assumed: each supplied clip always runs forward once.
    voice.expiry=setTimeout(()=>{
      if(voice.disposed)return;
      if(sustained.get(voice.sustain)===voice)sustained.delete(voice.sustain);
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setTargetAtTime(0,context.currentTime,.012);
      voice.source.stop(context.currentTime+.04);
    },300);
  }
  function play(event, spatial) {
    const profile=SOUND_PROFILES[event.kind];
    if(!profile || profile.loop)return false;
    const sample=buffers.get(profile.file);
    if(!sample || context?.state!=='running' || !wanted())return false;
    const existing=event.sustain&&sustained.get(event.sustain);
    if(existing&&!existing.disposed){renew(existing,spatial,profile,sample);return false;}
    const now=context.currentTime, cell=Math.floor(event.x/4)+':'+Math.floor(event.y/4);
    const key=event.kind+':'+cell;
    // Bound co-located volleys without replaying an entire prebuilt salvo.
    if(!event.sustain && now-(groups.get(key) ?? -Infinity)<.09)return false;
    const sourceKey=event.kind+':'+(event.owner ?? event.soundSource ?? cell);
    const same=[...playing].filter(v=>v.sourceKey===sourceKey);
    let startAt=afterFades();
    if(same.length>=profile.maxPerSource){retireVoice(same[0],now+.012);startAt=afterFades();}
    const priority=spatial.gain*profile.priority;
    if(playing.size>=16){
      const quietest=[...playing].sort((a,b)=>a.priority-b.priority)[0];
      if(quietest.priority>priority)return false;
      retireVoice(quietest,now+.012);startAt=afterFades();
    }
    groups.set(key,now);if(groups.size>128)groups.delete(groups.keys().next().value);
    const source=context.createBufferSource(), gain=context.createGain(), pan=context.createStereoPanner();
    source.buffer=sample.buffer;source.playbackRate.value=1;source.loop=false;
    const duration=Math.max(.01,Math.min(sample.buffer.duration,Number.isFinite(event.duration)?event.duration:sample.buffer.duration));
    const level=profile.gain*sample.scale*spatial.gain;
    gain.gain.setValueAtTime(0,startAt);gain.gain.linearRampToValueAtTime(level,startAt+Math.min(.004,duration/4));
    if(!event.sustain){
      gain.gain.setValueAtTime(level,startAt+Math.max(.005,duration-.04));
      gain.gain.linearRampToValueAtTime(0,startAt+duration);
    }
    pan.pan.value=spatial.pan;source.connect(gain);gain.connect(pan);pan.connect(master);
    const voice={source,gain,pan,priority,sourceKey,sustain:event.sustain,disposed:false,expiry:null,dispose:()=>{
      if(voice.disposed)return;voice.disposed=true;clearTimeout(voice.expiry);playing.delete(voice);retiring.delete(voice);
      if(event.sustain&&sustained.get(event.sustain)===voice)sustained.delete(event.sustain);
      source.disconnect();gain.disconnect();pan.disconnect();
    }};
    playing.add(voice);source.onended=voice.dispose;
    if(event.sustain){sustained.set(event.sustain,voice);renew(voice,spatial,profile,sample);}
    source.start(startAt);source.stop(startAt+duration);return true;
  }
  function updateLoop(voice, event, spatial, profile, sample) {
    const level=profile.gain*sample.scale*spatial.gain*Math.max(0,Math.min(1,event.gain??1));
    const now=Math.max(context.currentTime,voice.startAt);
    voice.gain.gain.setTargetAtTime(level,now,.06);
    voice.pan.pan.setTargetAtTime(spatial.pan,now,.06);
    voice.source.playbackRate.setTargetAtTime(Math.max(.8,Math.min(1.2,event.rate??1)),now,.1);
    voice.priority=spatial.gain*profile.priority*(event.gain??1);
    clearTimeout(voice.expiry);
    voice.expiry=setTimeout(()=>retireVoice(voice,context.currentTime+.06),500);
  }
  function syncLoops(emitters, point) {
    if(context?.state!=='running')return;
    const selected=emitters.map(event=>({event,profile:SOUND_PROFILES[event.kind],spatial:spatialSound(event,point),id:event.kind+':'+event.id}))
      .filter(c=>c.profile?.loop && c.spatial.gain>.005 && (c.event.gain??1)>0)
      .sort((a,b)=>b.spatial.gain*b.profile.priority*(b.event.gain??1)-a.spatial.gain*a.profile.priority*(a.event.gain??1)).slice(0,6);
    const ids=new Set(selected.map(c=>c.id));
    for(const [id,voice] of loops)if(!ids.has(id))retireVoice(voice,context.currentTime+.06);
    for(const {id,event,profile,spatial} of selected){
      const sample=buffers.get(profile.file);if(!sample)continue;
      let voice=loops.get(id);
      if(voice){updateLoop(voice,event,spatial,profile,sample);continue;}
      const priority=spatial.gain*profile.priority*(event.gain??1);
      if(playing.size>=16){
        const quietest=[...playing].sort((a,b)=>a.priority-b.priority)[0];
        if(quietest.priority>=priority)continue;
        retireVoice(quietest,context.currentTime+.06);
      }
      const source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner(),startAt=afterFades();
      source.buffer=sample.buffer;source.loop=true;
      gain.gain.setValueAtTime(0,startAt);pan.pan.value=spatial.pan;
      source.connect(gain);gain.connect(pan);pan.connect(master);
      voice={source,gain,pan,startAt,priority,loopId:id,sourceKey:id,disposed:false,expiry:null,dispose:()=>{
        if(voice.disposed)return;voice.disposed=true;clearTimeout(voice.expiry);playing.delete(voice);retiring.delete(voice);
        if(loops.get(id)===voice)loops.delete(id);
        source.disconnect();gain.disconnect();pan.disconnect();
      }};
      loops.set(id,voice);playing.add(voice);source.onended=voice.dispose;
      updateLoop(voice,event,spatial,profile,sample);source.start(startAt);
    }
  }
  toggle.onclick=()=>{enabled=!enabled;save();if(!enabled)stop();else void unlock();render();};
  if(quick)quick.onclick=()=>toggle.click();
  slider.oninput=()=>{volume=Number(slider.value)/100;save();if(master)master.gain.setTargetAtTime(volume,context.currentTime,.02);if(!volume)stop();void unlock();render();};
  const gesture=e=>{if(e.type==='keydown'&&(e.repeat||['Shift','Control','Alt','Meta'].includes(e.key)))return;if(!context || context.state!=='running')void unlock();};
  window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture);
  function reset(){events.reset();worldEvents.reset();loopEpoch=null;loopTime=-Infinity;stop();}
  document.addEventListener('visibilitychange',()=>{reset();if(document.hidden)void context?.suspend();else if(context)void unlock();});
  window.addEventListener('pagehide',reset);
  render();
  return {
    reset,
    ingest(state){
      const scene=worldEvents.ingest(state), fresh=[...events.ingest(state),...scene.events];
      const sceneAdvancing=state.epoch!==loopEpoch || state.time>loopTime || state.time<loopTime;
      if(state.epoch!==loopEpoch || state.time<loopTime)stop();
      loopEpoch=state.epoch;loopTime=state.time;
      if(!wanted()){stop();return;}
      const point=listener();
      const candidates=fresh.map(event=>({event,spatial:spatialSound(event,point)}))
        .filter(c=>c.spatial.gain>.005).sort((a,b)=>b.spatial.gain-a.spatial.gain);
      let count=0;
      for(const c of candidates){
        if(count>=6 && !(c.event.sustain&&sustained.has(c.event.sustain)))continue;
        if(play(c.event,c.spatial))count++;
      }
      if(sceneAdvancing)syncLoops(scene.loops,point);
    }
  };
}
