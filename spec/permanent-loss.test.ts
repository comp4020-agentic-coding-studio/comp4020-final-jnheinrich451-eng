import {it,expect} from 'vitest';
import {airbaseError,newAirbase} from '../public/aircraft.js';
import {freshLogistics} from '../public/logistics.js';
import {shipyardSite,yardFromShip,yardBuildError} from '../public/shipyard.js';
import {shipSite,SHIP} from '../public/ship.js';
import {rememberRuin} from '../public/ruins.js';

const world=():any=>({width:160,height:120,terrain:Array(160*120).fill(2),airbases:[],ships:[],cores:[],tanks:[],artillery:[],rails:[],sites:[],logistics:freshLogistics()});
it.each(['airbase','helipad'])('%s counts active and incoming construction, never ten abandoned ruins',kind=>{
 const w=world(),limit=kind==='helipad'?8:4;
 for(let i=0;i<10;i++)w.airbases.push({...newAirbase('ruin'+i,'a',20,20,'bomber',kind),destroyed:true});
 for(let i=0;i<limit;i++)w.airbases.push(newAirbase('live'+i,'a',40,20,'bomber',kind));
 w.logistics.jobs['live0']={kind,remaining:60};
 expect(airbaseError(w,[],[],130,70,'a',kind)).toContain(`(${limit}/${limit})`);
 w.airbases.find((b:any)=>b.id==='live1').destroyed=true;
 expect(airbaseError(w,[],[],130,70,'a',kind)).toBeNull();
});
it('releases destroyed dock and hull capacity while retaining the separate living fleet limit',()=>{
 const w=world();w.terrain=w.terrain.map((_:number,i:number)=>i%160>=21&&i%160<60?0:2);
 const vessel={...shipSite(w,[],[],23,25,'a','gunship','unfolding').ship,id:'template',elapsed:SHIP.duration,dockReady:true};
 w.logistics.shipyards=Array.from({length:12},(_,i)=>({...yardFromShip(vessel),id:'old'+i,dockDestroyed:true}));
 expect(shipyardSite(w,[],[],23,70,'a').error).toBeNull();
 const yard={...yardFromShip(vessel),id:'new'};w.logistics.shipyards.push(yard);
 w.ships=Array.from({length:10},(_,i)=>({...vessel,id:'wreck'+i,yardId:'new',destroyed:true}));
 expect(yardBuildError(w,yard,'a','gunship')).toBeNull();
 for(let i=0;i<SHIP.max;i++)w.ships.push({...vessel,id:'live'+i,yardId:'other'+i,x:40,y:75+i*6});
 expect(yardBuildError(w,yard,'a','gunship')).toContain('Fleet limit');
 yard.dockDestroyed=true;expect(yardBuildError(w,yard,'a','gunship')).toContain('permanently');
});
it('stores a static ruin once without adding a live facility or resource credit',()=>{
 const w=world();rememberRuin(w,'lost','factory',10,11);rememberRuin(w,'lost','factory',10,11);
 expect(JSON.parse(JSON.stringify(w.logistics)).ruins).toEqual([{id:'lost',kind:'factory',x:10,y:11,angle:0}]);
 expect(w.logistics.facilities).toEqual([]);expect(w.logistics.supplies).toBe(1200);
});
