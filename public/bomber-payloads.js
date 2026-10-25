// Aircraft load, gameplay radius and cosmetic crater size are separate values.
// Unlimited payloads use one shared aircraft cooldown; legacy bay counts are ignored.
export const BOMBER_PAYLOADS = Object.freeze({
 HE: Object.freeze({label:'HE carpet',short:'12 HE',weapon:'HE',count:12,rows:2,interval:.5,cooldown:8,cost:0,radius:2,lethalRadius:.7,damage:110,edgeDamage:15,craterSize:4,color:'#f4d087'}),
 HEAVY: Object.freeze({label:'Heavy HE bomb',short:'Heavy HE',weapon:'HE',count:1,rows:1,interval:0,cooldown:14,cost:0,radius:10,lethalRadius:4,damage:600,edgeDamage:80,craterSize:24,color:'#ffdca5'}),
 INCENDIARY: Object.freeze({label:'Incendiary carpet',short:'12 fire',weapon:'INCENDIARY',count:12,rows:2,interval:.5,cooldown:12,cost:0,radius:1.8,craterSize:4,color:'#ffac68'}),
 GAS: Object.freeze({label:'Gas carpet',short:'12 gas',weapon:'GAS',count:12,rows:2,interval:.5,cooldown:12,cost:0,radius:1.8,craterSize:4,gasCapacity:18,color:'#c9e79b'})
});
export const bombReleaseDuration = profile => (profile.count/profile.rows-1)*profile.interval;
export const validPayload = key => typeof key==='string' && Object.hasOwn(BOMBER_PAYLOADS,key);
export const bomberPayload = p => p.mission && !['complete','lost'].includes(p.mission.phase) && p.mission.kind!=='recovery' ? p.mission.payload||'HE' : p.payload||'HE';
export const payloadProfile = key => BOMBER_PAYLOADS[validPayload(key)?key:'HE'];
// Presentation only: simulation still uses the existing positive-speed flight.
export function bomberDive(p){
 const m=p.mission;if(!m||m.kind==='recovery')return 0;
 if(m.phase==='dive')return Math.max(0,Math.min(1,1-Math.hypot(p.x-m.release.x,p.y-m.release.y)/6));
 if(m.phase==='release')return 1;
 if(m.phase==='return'&&m.released)return Math.max(0,1-m.returnTime/1.2);
 return 0;
}
