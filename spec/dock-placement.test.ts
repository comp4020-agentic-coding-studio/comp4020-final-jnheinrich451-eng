import {expect,it} from 'vitest';
import type {DatabaseSync} from 'node:sqlite';
import {createWorld,canStand} from '../public/world.js';
import {freshLogistics} from '../public/logistics.js';
import {shipyardSite,shipyardPreview,yardFromShip} from '../public/shipyard.js';
import {dockRects,hullCells,canSail,shipSite} from '../public/ship.js';
import {wreckRecoveryFixture} from '../tests/helpers/wreck-recovery-fixture.js';

const coast=():any=>({...createWorld(),width:160,height:128,terrain:Array.from({length:160*128},(_,i)=>i%160<80?0:2),sites:[],cores:[],ships:[],tanks:[],rails:[],artillery:[],airbases:[],logistics:freshLogistics()});
it.each([[80,60],[83,60],[79,60],[72,60]])('snaps coastal click %s:%s to the same clear full-size dock', (x,y)=>{
 const w=coast(),site=shipyardSite(w,[],[],x,y,'pilot',2);expect(site.error).toBeNull();
 expect(site.ship).toMatchObject({siteX:72,siteY:60,requestX:x,requestY:y,dock:{x:80.5,y:60.5}});
 expect(dockRects(site.ship).map(r=>hullCells(r).length)).toEqual([7,84]);
 expect(canSail(w,site.ship,site.ship.x,site.ship.y,site.ship.angle,true)).toBe(true);
});
it.each([0,1,2,3])('bridges a stepped coast in orientation %s with a clear carrier berth',rotation=>{
 const w=coast();w.width=w.height=160;
 const rotate=(x:number,y:number)=>rotation===0?[x,y]:rotation===1?[159-y,x]:rotation===2?[159-x,159-y]:[y,159-x];
 w.terrain=Array(160*160).fill(0);
 for(let y=0;y<160;y++)for(let x=0;x<160;x++){const [rx,ry]=rotate(x,y);w.terrain[ry*160+rx]=x<60+Math.floor(y/2)?0:2;}
 const [x,y]=rotate(90,60),site=shipyardSite(w,[],[],x,y,'pilot',2);expect(site.error).toBeNull();
 const [shore,pier]=dockRects(site.ship).map(hullCells),land=shore.filter(p=>w.terrain[p.y*w.width+p.x]!==0);
 expect(land.length).toBeGreaterThan(0);expect(land.length).toBeLessThan(7);
 expect(pier).toHaveLength(84);expect(pier.every(p=>w.terrain[p.y*w.width+p.x]===0)).toBe(true);
 expect(canSail(w,{...site.ship,kind:'carrier'})).toBe(true);
 w.logistics.shipyards=[yardFromShip({...site.ship,id:'new',elapsed:4.5})];
 expect([...shore,...pier].every(p=>canStand(w,[],p.x+.5,p.y+.5))).toBe(true);
});
it('rejects open ocean, inland ground, invalid coordinates, blocked coast and fleet limits',()=>{
 const w=coast();
 for(const [x,y] of [[20,60],[120,60],[-1,60],[80.2,60]])expect(shipyardSite(w,[],[],x,y,'pilot',2).error).toBeTruthy();
 const buildings=Array.from({length:128},(_,y)=>({x:80,y}));
 expect(shipyardSite(w,buildings,[],80,60,'pilot',2).error).toContain('No clear dock');
 w.waterKinds=w.terrain.map((t:number)=>t===0?2:0);
 expect(shipyardSite(w,[],[],80,60,'pilot',2).error).toBeTruthy();
 w.logistics.shipyards=Array.from({length:4},(_,i)=>({id:'yard'+i,owner:'pilot'}));
 expect(shipyardSite(w,[],[],80,60,'pilot',2).error).toContain('four per scout');
});
it('still rejects land inside the pier and keeps saved legacy shore validation strict',()=>{
 const w=coast();w.terrain[60*w.width+75]=2;
 expect(shipSite(w,[],[],72,60,'pilot','gunship','unfolding',null,true,null,2).error).toBeTruthy();
 const legacy=coast();legacy.terrain[59*legacy.width+80]=0;
 expect(shipyardSite(legacy,[],[],77,60,'pilot').error).toBeTruthy();
});
it('admits the previewed shore click once, persists it, and retries without spending twice',async()=>{
 const f=await wreckRecoveryFixture();
 try{
  await f.connect();expect((await f.post('logistics/exit')).status).toBe(200);
  const before=await f.state(),point={x:55,y:30,method:'orbital'};
  const preview=shipyardSite({...before.world,logistics:before.logistics,ships:before.ships},before.buildings||[],[],point.x,point.y,'pilot0',2);
  expect(preview.error).toBeNull();
  const placed=await f.post('shipyards',point);expect(placed.status,JSON.stringify(placed.data)).toBe(201);
  expect(placed.data.yard).toMatchObject({dock:preview.ship.dock,siteX:preview.ship.siteX,siteY:preview.ship.siteY,requestX:55,requestY:30});
  const repeat=await f.post('shipyards',point);expect(repeat.status).toBe(200);expect(repeat.data.yard.id).toBe(placed.data.yard.id);
  expect((await f.post('shipyards',{})).status).toBe(409);
  expect((await f.state()).logistics.supplies).toBe(before.logistics.supplies-120);
  await f.restart();await f.connect();expect((await f.post('shipyards',point)).status).toBe(200);
  const after=await f.state();expect(after.logistics.shipyards).toHaveLength(1);expect(after.logistics.supplies).toBe(before.logistics.supplies-120);
 }finally{await f.close();}
},30000);
it('rejects a stale dock preview without spending or relocating when a teammate enters the shore',async()=>{
 const f=await wreckRecoveryFixture();
 try{
  await f.connect();expect((await f.post('logistics/exit')).status).toBe(200);
  const point={x:55,y:30,method:'orbital'},before=await f.state();
  const planned=shipyardSite({...before.world,logistics:before.logistics,ships:before.ships},before.buildings||[],before.players,point.x,point.y,'pilot0',2);
  expect(planned.error).toBeNull();const preview=shipyardPreview(planned.ship);
  // The browser saw this site before the second player moved into its platform.
  await f.restart((db:DatabaseSync)=>{
   const l=JSON.parse(String(db.prepare("SELECT value FROM meta WHERE key='logistics-v1'").get()?.value));
   l.recyclers=l.recyclers.filter((r:any)=>r.occupant!=='pilot1');
   db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));
   db.prepare("UPDATE scouts SET x=?,y=? WHERE id='pilot1'").run(planned.ship.dock.x,planned.ship.dock.y);
  });
  await f.connect();await f.connect(1);
  const blocked=await f.post('shipyards',{...point,preview});expect(blocked.status).toBe(409);
  expect(blocked.data.error).toContain('Review the updated preview');
  const unchanged=await f.state();expect(unchanged.logistics.shipyards).toHaveLength(0);
  expect(unchanged.logistics.supplies).toBe(before.logistics.supplies);
  const updated=shipyardSite({...unchanged.world,logistics:unchanged.logistics,ships:unchanged.ships},unchanged.buildings||[],unchanged.players,point.x,point.y,'pilot0',2);
  expect(updated.error).toBeNull();const fresh=shipyardPreview(updated.ship)!;expect(fresh).not.toEqual(preview);
  // Binding includes berth side, not only the canonical shore coordinate.
  for(const bad of [null,{},'invalid',{...fresh,berthX:fresh.berthX+1}]){
   expect((await f.post('shipyards',{...point,preview:bad})).status).toBe(409);
  }
  const accepted=await f.post('shipyards',{...point,preview:fresh});expect(accepted.status).toBe(201);
  expect(shipyardPreview(accepted.data.yard)).toEqual(fresh);
  expect((await f.post('shipyards',{...point,preview:fresh})).status).toBe(200);
  await f.restart();await f.connect();
  expect((await f.post('shipyards',{...point,preview:fresh})).status).toBe(200);
  const after=await f.state();expect(after.logistics.shipyards).toHaveLength(1);
  expect(after.logistics.supplies).toBe(before.logistics.supplies-120);
 }finally{await f.close();}
},30000);
