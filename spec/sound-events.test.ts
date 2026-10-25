import {expect,it} from 'vitest';
import {SoundEvents,spatialSound} from '../public/sound-events.js';

const shot=(id:number,at=100)=>({id,at,x:10,y:10,weapon:'HE'});
const state=(time:number,shots:object[]=[],extra:object={})=>({epoch:'room',time,shots,impacts:[],barrages:[],...extra});
it('plays one MAC discharge across multiple authoritative flight traces',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 expect(feed.ingest(state(100,[{...shot(1),weapon:'MAC',first:true}]))).toMatchObject([{kind:'rail'}]);
 expect(feed.ingest(state(200,[{...shot(2,200),weapon:'MAC',first:false}]))).toEqual([]);
 expect(feed.ingest(state(300,[{...shot(3,300),weapon:'MAC',first:false}]))).toEqual([]);
});
it('baselines joins and reconnects, deduplicates snapshots and never queues stale events',()=>{
 const feed=new SoundEvents();
 expect(feed.ingest(state(100,[shot(1)]))).toEqual([]);
 expect(feed.ingest(state(200,[shot(1),shot(2,200)]))).toMatchObject([{id:2,kind:'cannon'}]);
 expect(feed.ingest(state(200,[shot(1),shot(2,200)]))).toEqual([]);
 expect(feed.ingest(state(1000,[shot(3,300)]))).toEqual([]);
 feed.reset();expect(feed.ingest(state(1100,[shot(4,1100)]))).toEqual([]);
 expect(feed.ingest(state(1200,[shot(5,1200)],{epoch:'new-runtime'}))).toEqual([]);
 expect(feed.ingest(state(0,[shot(6,0)],{epoch:'new-runtime'}))).toEqual([]);
});
it('keeps launch and impact distinct, maps naval and energy weapons, and omits ongoing flame damage',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const sounds=feed.ingest(state(100,[{...shot(1),mount:'naval-main'},{...shot(2),weapon:'MAGNETIC'},{...shot(3),weapon:'FLAME'},
  {...shot(4),weapon:'NAVAL_APCR'}],{impacts:[{...shot(1),radius:6},{...shot(8),weapon:'BURN'}]}));
 expect(sounds.map((s:{kind:string})=>s.kind)).toEqual(['heavy','rail','gun','blastHeavy']);
});
it('plays each actual missile launch once and skips bomber releases, pending tubes and old launches',()=>{
 const feed=new SoundEvents();feed.ingest(state(0));
 const barrage={id:7,x:10,y:12,age:.1,missiles:[{launch:0},{launch:.25},{launch:.5,launchPending:true}]};
 expect(feed.ingest(state(100,[],{barrages:[barrage,{...barrage,id:8,kind:'bomber'}]}))).toHaveLength(1);
 expect(feed.ingest(state(300,[],{barrages:[{...barrage,age:.3}]}))).toHaveLength(1);
 expect(feed.ingest(state(600,[],{barrages:[{...barrage,age:.6}]}))).toHaveLength(0);
 expect(feed.ingest(state(650,[],{barrages:[{...barrage,id:8,kind:'submarine',age:.65,missiles:[{launch:.5,originX:15,originY:17}]}]}))).toMatchObject([{x:15,y:17,kind:'missile'}]);
 expect(feed.ingest(state(2000,[],{barrages:[{...barrage,id:9,age:2}]}))).toHaveLength(0);
});
it('attenuates by world distance and pans left/right without making overview globally audible',()=>{
 const listener={x:10,y:10};
 expect(spatialSound({x:10,y:10,kind:'gun'},listener)).toEqual({gain:1,pan:0});
 expect(spatialSound({x:19,y:10,kind:'gun'},listener).gain).toBe(.25);
 expect(spatialSound({x:0,y:10,kind:'gun'},listener).pan).toBeLessThan(0);
 expect(spatialSound({x:70,y:10,kind:'heavy'},listener).gain).toBe(0);
});
