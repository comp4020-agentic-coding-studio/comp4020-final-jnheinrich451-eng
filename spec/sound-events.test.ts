import {expect,it} from 'vitest';
import {SoundEvents,spatialSound} from '../public/sound-events.js';
import {SOUND_FILES} from '../public/sound-catalog.js';
import {SOUND_ASSETS} from '../public/audio/effects/generated/manifest.js';

const shot=(id:number,at=100)=>({id,at,x:10,y:10,weapon:'HE'});
const state=(time:number,shots:object[]=[],extra:object={})=>({epoch:'room',time,shots,impacts:[],barrages:[],...extra});
it('plays one MAC discharge across multiple authoritative flight traces',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 expect(feed.ingest(state(100,[{...shot(1),weapon:'MAC',first:true}]))).toMatchObject([{kind:'mac-shot'}]);
 expect(feed.ingest(state(200,[{...shot(2,200),weapon:'MAC',first:false}]))).toEqual([]);
 expect(feed.ingest(state(300,[{...shot(3,300),weapon:'MAC',first:false}]))).toEqual([]);
});
it('baselines joins and reconnects, deduplicates snapshots and never queues stale events',()=>{
 const feed=new SoundEvents();
 expect(feed.ingest(state(100,[shot(1)]))).toEqual([]);
 expect(feed.ingest(state(200,[shot(1),shot(2,200)]))).toMatchObject([{id:2,kind:'tank-shot'}]);
 expect(feed.ingest(state(200,[shot(1),shot(2,200)]))).toEqual([]);
 expect(feed.ingest(state(1000,[shot(3,300)]))).toEqual([]);
 feed.reset();expect(feed.ingest(state(1100,[shot(4,1100)]))).toEqual([]);
 expect(feed.ingest(state(1200,[shot(5,1200)],{epoch:'new-runtime'}))).toEqual([]);
 expect(feed.ingest(state(0,[shot(6,0)],{epoch:'new-runtime'}))).toEqual([]);
});
it('keeps launch and impact distinct, maps naval, energy and flame firing, and omits burn damage',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const sounds=feed.ingest(state(100,[{...shot(1),mount:'naval-main'},{...shot(2),weapon:'MAGNETIC'},{...shot(3),weapon:'FLAME'},
  {...shot(4),weapon:'NAVAL_APCR'}],{impacts:[{...shot(1),radius:6},{...shot(8),weapon:'BURN'}]}));
 expect(sounds.map((s:{kind:string})=>s.kind)).toEqual(['naval-main-shot','magnetic-shot','flame','naval-side-shot','railway-impact']);
});
it('plays each actual missile launch once and distinguishes bomber releases and skips pending tubes and old launches',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const barrage={id:7,x:10,y:12,age:.1,missiles:[{launch:0},{launch:.25},{launch:.5,launchPending:true}]};
 expect(feed.ingest(state(100,[],{barrages:[barrage,{...barrage,id:8,kind:'bomber'}]}))).toHaveLength(2);
 expect(feed.ingest(state(300,[],{barrages:[{...barrage,age:.3}]}))).toHaveLength(1);
 expect(feed.ingest(state(600,[],{barrages:[{...barrage,age:.6}]}))).toHaveLength(0);
 expect(feed.ingest(state(650,[],{barrages:[{...barrage,id:8,kind:'submarine',age:.65,missiles:[{launch:.5,originX:15,originY:17}]}]}))).toMatchObject([{x:15,y:17,kind:'submarine-shot'}]);
 expect(feed.ingest(state(2000,[],{barrages:[{...barrage,id:9,age:2}]}))).toHaveLength(0);
});
it('attenuates by world distance and pans left/right without making overview globally audible',()=>{
 const listener={x:10,y:10};
 expect(spatialSound({x:10,y:10,kind:'machine-gun'},listener)).toEqual({gain:1,pan:0});
 expect(spatialSound({x:19,y:10,kind:'machine-gun'},listener).gain).toBe(.25);
 expect(spatialSound({x:0,y:10,kind:'machine-gun'},listener).pan).toBeLessThan(0);
 expect(spatialSound({x:70,y:10,kind:'railway-shot'},listener).gain).toBe(0);
});

it('maps every selected recording and references only exported browser files',()=>{
 const files=new Set(Object.values(SOUND_FILES));
 expect(files).toEqual(new Set(SOUND_ASSETS.map(asset=>'generated/'+asset.file)));
 expect(SOUND_ASSETS).toHaveLength(files.size);
 expect(SOUND_FILES['machine-gun']).toBe('generated/sfx_wpn_mg_762mm_shot_single_01.ogg');
 expect(files.has('generated/sfx_wpn_mg_762mm_shot_loop.ogg')).toBe(false);
});

it('plays only the discharge of AA and magnetic projectiles, not moving traces',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const sounds=feed.ingest(state(100,[
  {...shot(1),weapon:'AA35',mount:'aa-35mm'},
  {...shot(2),weapon:'AA35',mount:'aa-tracer',sound:'aa-shot'},
  {...shot(3),weapon:'MAGNETIC',first:true},
  {...shot(4),weapon:'MAGNETIC',first:false,sound:'magnetic-shot'},
 ]));
 expect(sounds.map(s=>s.kind)).toEqual(['aa-shot','magnetic-shot']);
});

it('uses explicit aircraft identities and distinct hazard impacts',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const shots=[{...shot(1),weapon:'APCR',mount:'air-gunship-25'},
  {...shot(2),weapon:'APCR',mount:'air-gunship-40'},
  {...shot(3),weapon:'APCR',mount:'air-gunship-105'},
  {...shot(4),weapon:'APCR',sound:'heli-cannon-shot'},
  {...shot(5),weapon:'APCR',mount:'jet-30mm'},
  {...shot(6),weapon:'APCR',mount:'jet-cannon'}];
 expect(feed.ingest(state(100,shots)).map(s=>s.kind)).toEqual([
  'gunship-25-shot','gunship-40-shot','gunship-105-shot','heli-cannon-shot','jet-30-shot','jet-40-shot']);
 const impacts=[{...shot(20,200),weapon:'INCENDIARY',minorBlast:true},
  {...shot(21,200),weapon:'GAS',minorBlast:true},
  {...shot(22,200),sound:'tank-impact',hits:[{kind:'bulwark'}]},
  {...shot(23,200),weapon:'INCENDIARY',radius:0}];
 expect(feed.ingest(state(200,[],{impacts})).map(s=>s.kind)).toEqual(['incendiary-impact','gas-impact','tank-armor-impact']);
});

it('tracks enemy launch and resolved hit separately and ignores warnings/missed melee',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const acid={...shot(1),fromX:4,fromY:5,landAt:400,impacted:false};
 const flak={...acid,id:2}, bile={...acid,id:3,weapon:'BILE'};
 const launch=feed.ingest(state(100,[],{acidShells:[acid,bile],flakShells:[flak]}));
 expect(launch.map(s=>s.kind)).toEqual(['acid-shot','bile-shot','spore-shot']);
 expect(launch.every(s=>s.x===4&&s.y===5)).toBe(true);
 const impacts=feed.ingest(state(400,[],{acidShells:[{...acid,impacted:true},{...bile,impacted:true}],
  flakShells:[{...flak,impacted:true}], enemies:[
   {id:'b',kind:'bulwark',strike:{...shot(20,400),hit:true}},
   {id:'h',kind:'hunter',strike:{...shot(21,400),hit:false}}]}));
 expect(impacts.map(s=>s.kind)).toEqual(['acid-impact','bile-impact','spore-impact','creature-slam']);
 expect(feed.ingest(state(450,[],{acidShells:[{...acid,impacted:true}]}))).toEqual([]);
});

it('renews finite flame and beam voices from fresh firing only',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const flame={...shot(1),weapon:'FLAME',owner:'robot'};
 const site={id:'tower',x:10,y:10,state:'hostile',laser:{phase:'charging',remaining:1}};
 const mobile={id:'lens',x:4,y:4,hp:50,kind:'twin-lens',airLaser:{phase:'firing',remaining:2}};
 expect(feed.ingest(state(100,[flame],{sites:[site],enemies:[mobile]}))).toMatchObject([
  {kind:'flame',sustain:'flame:robot'},{kind:'alien-laser',sustain:'beam:lens'}]);
 expect(feed.ingest(state(100,[flame],{sites:[site],enemies:[mobile]}))).toEqual([]);
 expect(feed.ingest(state(200,[],{sites:[{...site,laser:{phase:'firing',remaining:2}}]}))).toMatchObject([
  {kind:'alien-heavy-laser',sustain:'beam:tower'}]);
 expect(feed.ingest(state(300,[],{sites:[{...site,laser:{phase:'cooling',remaining:5}}]}))).toEqual([]);
});

it('plays one cluster parent incoming cue near its committed arrival, not each bomblet',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const orbital={id:'strike',payload:'CLUSTER',delay:6,age:5.1,points:[
  {x:10,y:10,offset:0,stage:'parent'}, {x:11,y:10,offset:.45,stage:'bomblet'}]};
 expect(feed.ingest(state(100,[],{orbital}))).toMatchObject([{kind:'orbital-cluster-fall',duration:1}]);
 expect(feed.ingest(state(200,[],{orbital:{...orbital,age:5.2}}))).toEqual([]);
 expect(feed.ingest(state(1000,[],{orbital:{...orbital,id:'late',age:6}}))).toEqual([]);
});
