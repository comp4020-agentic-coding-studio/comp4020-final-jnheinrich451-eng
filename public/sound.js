import {SoundEvents, spatialSound} from './sound-events.js';

export const SOUND_FILES = Object.freeze({
  gun:'gun.ogg', cannon:'cannon.ogg', blast:'blast.ogg', rail:'rail.ogg',
  missile:'missile.ogg', rumble:'rumble.ogg'
});
const voices = {
  gun:{file:'gun',gain:.18,rate:1.1,duration:.22},
  cannon:{file:'cannon',gain:.42,rate:.75,duration:.65},
  heavy:{file:'cannon',gain:.52,rate:.55,duration:.9},
  rail:{file:'rail',gain:.28,rate:1,duration:.65},
  missile:{file:'missile',gain:.22,rate:1.15,duration:.65},
  blast:{file:'blast',gain:.38,rate:1,duration:1.2},
  blastHeavy:{file:'rumble',gain:.5,rate:.85,duration:1.8}
};

export function setupSound({listener, active}) {
  const toggle=document.getElementById('sound-toggle'), slider=document.getElementById('sound-volume');
  const status=document.getElementById('sound-status'), events=new SoundEvents();
  let enabled=true, volume=.55, context=null, master=null, loading=null, failed=false;
  const buffers=new Map(), playing=new Set(), groups=new Map();
  try {
    const saved=JSON.parse(localStorage.getItem('frontier-sound') || 'null');
    if(typeof saved?.enabled==='boolean')enabled=saved.enabled;
    if(Number.isFinite(saved?.volume))volume=Math.max(0,Math.min(1,saved.volume));
  } catch {}
  const wanted=()=>enabled && volume>0 && !document.hidden && active();
  function render() {
    toggle.textContent=enabled?'Effects on':'Effects off';toggle.setAttribute('aria-pressed',String(enabled));
    slider.value=String(Math.round(volume*100));
    status.textContent=!enabled?'Sound effects off.':volume===0?'Effects muted.':failed?
      'Some sounds unavailable. Toggle effects off and on to retry.':loading?'Loading weapon sounds…':
      context?.state==='running'?'Weapon sounds ready / distance and stereo positioning.':'Sounds start after a click, tap or key press.';
  }
  function save(){try{localStorage.setItem('frontier-sound',JSON.stringify({enabled,volume}));}catch{}}
  function stop() {
    for(const voice of [...playing]) {try{voice.source.stop();}catch{} voice.dispose();}
    groups.clear();
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
      }
      master.gain.setTargetAtTime(volume,context.currentTime,.02);
      await context.resume();
      if(!loading && buffers.size<Object.keys(SOUND_FILES).length) {
        failed=false;
        loading=Promise.all(Object.entries(SOUND_FILES).map(async([key,file])=>{
          if(buffers.has(key))return;
          try {
            const response=await fetch('/audio/effects/'+file);
            if(!response.ok)throw new Error('Sound unavailable');
            const buffer=await context.decodeAudioData(await response.arrayBuffer());
            // Normalize differing source peaks once, never per frame.
            let peak=0;
            for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(value));
            buffers.set(key,{buffer,scale:peak>0?.8/peak:1});
          }catch{failed=true;}
        })).finally(()=>{loading=null;render();});
      }
    } catch {failed=true;}
    render();
  }
  function play(event, spatial) {
    const profile=voices[event.kind], sample=buffers.get(profile.file);
    if(!sample || context?.state!=='running' || !wanted())return;
    const now=context.currentTime, key=event.kind+':'+Math.floor(event.x/4)+':'+Math.floor(event.y/4);
    // Collapse co-located rapid rounds and nine-shell volleys into bounded voices.
    if(now-(groups.get(key) ?? -Infinity)<.09)return;
    const priority=spatial.gain*(event.kind==='gun'?.6:1);
    if(playing.size>=16) {
      const quietest=[...playing].sort((a,b)=>a.priority-b.priority)[0];
      if(quietest.priority>=priority)return;
      quietest.source.stop();quietest.dispose();
    }
    groups.set(key,now);if(groups.size>128)groups.delete(groups.keys().next().value);
    const source=context.createBufferSource(), gain=context.createGain(), pan=context.createStereoPanner();
    source.buffer=sample.buffer;source.playbackRate.value=profile.rate;
    const duration=Math.min(profile.duration,sample.buffer.duration/profile.rate), level=profile.gain*sample.scale*spatial.gain;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+.005);
    gain.gain.setValueAtTime(level,now+Math.max(.006,duration-.06));gain.gain.linearRampToValueAtTime(0,now+duration);
    pan.pan.value=spatial.pan;source.connect(gain);gain.connect(pan);pan.connect(master);
    const voice={source,priority,dispose:()=>{playing.delete(voice);source.disconnect();gain.disconnect();pan.disconnect();}};
    playing.add(voice);source.onended=voice.dispose;
    source.start(now);source.stop(now+duration);return true;
  }
  toggle.onclick=()=>{enabled=!enabled;save();if(!enabled)stop();else void unlock();render();};
  slider.oninput=()=>{volume=Number(slider.value)/100;save();if(master)master.gain.setTargetAtTime(volume,context.currentTime,.02);if(!volume)stop();void unlock();render();};
  const gesture=e=>{if(e.type==='keydown'&&(e.repeat||['Shift','Control','Alt','Meta'].includes(e.key)))return;if(!context || context.state!=='running')void unlock();};
  window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture);
  document.addEventListener('visibilitychange',()=>{events.reset();stop();if(document.hidden)void context?.suspend();else if(context)void unlock();});
  render();
  return {
    reset(){events.reset();stop();},
    ingest(state){
      const fresh=events.ingest(state);
      if(!wanted()){stop();return;}
      const point=listener();
      const candidates=fresh.map(event=>({event,spatial:spatialSound(event,point)}))
        .filter(c=>c.spatial.gain>.005).sort((a,b)=>b.spatial.gain-a.spatial.gain);
      // A delayed network batch cannot produce an unbounded audio burst.
      let count=0;for(const c of candidates){if(play(c.event,c.spatial) && ++count>=6)break;}
    }
  };
}
