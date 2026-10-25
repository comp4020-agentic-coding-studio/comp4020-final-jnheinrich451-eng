import {expect,it} from 'vitest';
import {createCombat} from '../public/combat.js';
import {AQUATIC,makeAquaticHive,seedAquaticHive,aquaticTargets,tickAquatic} from '../public/aquatic-hive.js';
import {createVesper} from '../public/vesper-world.js';
import {freshLogistics,facilityTargets} from '../public/logistics.js';
import {damageSites,tickSites} from '../public/conquest.js';
import {canSwim} from '../public/naval.js';
import {fieldCapacityError,makeField} from '../public/hazards.js';

function setup(){
 const world:any={width:96,height:80,spawn:{x:10,y:10},terrain:Array(96*80).fill(0),ships:[],tanks:[],airbases:[],cores:[],rails:[],artillery:[],logistics:freshLogistics(),sites:[makeAquaticHive('hive',40,40)]};
 for(let y=0;y<80;y++)for(let x=0;x<38;x++)world.terrain[y*96+x]=2;
 const robot:any={id:'p',x:36.5,y:41.5,body:'robot',life:'active',health:100,shield:0,hurt:0};
 return {world,site:world.sites[0],robot};
}
function advance(c:any,seconds:number,robots:any[]=[]){for(let i=0;i<Math.round(seconds*20);i++)c.tick(.05,[],robots);}
it('seeds one reachable lakeshore hive only on Vesper, preserving all terrain and avoiding assets',()=>{
 const w:any={...createVesper(),logistics:freshLogistics()},before=JSON.stringify(w),sites=seedAquaticHive(w);expect(sites).toHaveLength(1);expect(JSON.stringify(w)).toBe(before);
 expect(seedAquaticHive({...w,sites})).toEqual([]);expect(seedAquaticHive({...w,template:'caldera-v1'})).toEqual([]);
 const blocked=seedAquaticHive(w,[],[{x:316,y:110}]);expect(blocked).toEqual([]);
 const s=sites[0];w.logistics.bridges=[{from:{x:s.x-15,y:s.y+1},to:{x:s.x+15,y:s.y+1},width:5,elapsed:0}];
 expect(seedAquaticHive(w).some(h=>h.x===s.x&&h.y===s.y)).toBe(false);
 for(let y=s.y;y<s.y+3;y++)for(let x=s.x;x<s.x+3;x++)expect(w.terrain[y*w.width+x]).toBe(0);
});
it('heals only after eight seconds without HE damage and never revives a conquered hive',()=>{
 const {world,site}=setup(),c=createCombat(world);site.hp=900;site.hitAt=0;advance(c,8);expect(site.hp).toBe(900);advance(c,1);expect(site.hp).toBeCloseTo(930);
 damageSites([site],41,41,{radius:1,damage:100},9000,()=>100);advance(c,7);expect(site.hp).toBeCloseTo(830);
 damageSites([site],41,41,{radius:1,damage:2000},16000,()=>2000);expect(site.state).toBe('conquered');advance(c,30);expect(site.hp).toBe(0);expect(c.snapshot().enemies).toEqual([]);
});
it('spawns water-only spitters with both a six-defender and global living cap, never land guards',()=>{
 const {world,site,robot}=setup();robot.x=20;const c=createCombat(world,null,null,'aquatic-test');advance(c,42,[robot]);const enemies=c.snapshot().enemies;
 expect(enemies).toHaveLength(6);expect(enemies.every((e:any)=>e.kind==='swimmer'&&e.variant==='bile-spitter'&&e.siteId===site.id&&canSwim(world,e.x,e.y))).toBe(true);
 const saved=c.checkpoint();saved.enemies=Array.from({length:24},(_,i)=>({id:100+i,kind:'swimmer',hp:60,x:70+i%4,y:50+Math.floor(i/4),path:[],reroute:0}));
 const full=createCombat(structuredClone(world),saved);advance(full,10,[robot]);expect(full.snapshot().enemies).toHaveLength(24);
 const spawned:any[]=[];tickSites([site],world,[],[robot],spawned,99000,()=>1);expect(spawned).toEqual([]);expect(site.pending).toBeNull();
});
it('warns before poison, allows escape, and cancels an unvented cloud on conquest',()=>{
 const {world,site,robot}=setup();site.aquatic.nextSpawn=999999;const c=createCombat(world);advance(c,1,[robot]);expect(c.snapshot().aquaticClouds).toHaveLength(1);expect(robot.health).toBe(100);
 robot.x=20;advance(c,8,[robot]);expect(robot.health).toBe(100);expect(c.snapshot().aquaticClouds).toHaveLength(0);
 robot.x=36.5;advance(c,8,[robot]);expect(c.snapshot().aquaticClouds).toHaveLength(1);site.hp=0;site.state='conquered';site.conqueredAt=c.snapshot().time;advance(c,5,[robot]);expect(robot.health).toBe(100);expect(c.snapshot().aquaticClouds).toHaveLength(0);
});
it('damages exposed hulls and utility vehicles once, excluding crew, protected cores, air and submerged boats',()=>{
 const {world,robot}=setup();world.sites=[];
 world.tanks=[{id:'tank',x:40,y:40,elapsed:99,health:200,occupant:robot.id}];world.ships=[{id:'sub',kind:'submarine',angle:0,dockDestroyed:true,berthX:40,x:40,y:40,elapsed:99,health:300,depth:'submerged'},{id:'ship',angle:0,dockDestroyed:true,berthX:40,x:40,y:40,elapsed:99,health:300}];
 world.logistics.recyclers=[{id:'r',x:40,y:40,remaining:0,occupant:'driver'}];
 const air={...robot,id:'air',body:'aircraft',x:40,y:40},driver={...robot,id:'driver',body:'recycler',x:40,y:40},foot={...robot,id:'foot',x:40,y:40};
 const targets=aquaticTargets(world,[robot,air,driver,foot],facilityTargets(world).concat([{id:'protected',x:40,y:40,protected:true,hp:{health:100}}]));
 expect(targets.some((t:any)=>t.id==='protected')).toBe(false);
 const clouds:any[]=[{id:1,weapon:'TOXIC',kind:'puddle',x:40,y:40,radius:6,activeAt:0,expiresAt:6000}],shots:any[]=[];
 tickAquatic(world,[],[],targets,clouds,shots,1000,1,()=>2,()=>0,()=>true);
 expect(world.tanks[0].health).toBe(192);expect(world.ships.map((s:any)=>s.health)).toEqual([300,292]);expect(world.logistics.durability['recycler:r'].health).toBe(152);expect(foot.health).toBe(92);for(const p of [robot,air,driver])expect(p.health).toBe(100);
});
it('saves a fixed-point bile shot and pending puddle, permits dodging, and resolves accepted damage once after shooter loss',()=>{
 const {world,robot}=setup();world.sites=[];const initial=createCombat(world).checkpoint();initial.enemies=[{id:1,kind:'swimmer',variant:'bile-spitter',hp:100,maxHp:100,x:42,y:41.5,homeX:42,homeY:41.5,path:[],reroute:0,angle:0}];initial.serial=1;
 const c=createCombat(world,initial);advance(c,.1,[robot]);expect(c.snapshot().enemies[0].attack).toMatchObject({x:36.5,y:41.5});advance(c,1.2,[robot]);const saved=c.checkpoint();expect(saved.acidShells).toHaveLength(1);expect(saved.aquaticClouds).toHaveLength(1);saved.enemies=[];
 const dodge={...robot,x:20};const safe=createCombat(structuredClone(world),structuredClone(saved));advance(safe,6,[dodge]);expect(dodge.health).toBe(100);
 const stepped={...robot},jump=createCombat(structuredClone(world),structuredClone(saved));jump.tick(10,[],[stepped]);expect(stepped.health).toBeCloseTo(100-AQUATIC.damage-AQUATIC.poisonDps*AQUATIC.puddleDuration/1000);
 const hit=createCombat(structuredClone(world),saved);advance(hit,6,[robot]);expect(robot.health).toBeCloseTo(100-AQUATIC.damage-AQUATIC.poisonDps*AQUATIC.puddleDuration/1000);
 const again=createCombat(structuredClone(world),hit.checkpoint()),hp=robot.health;advance(again,6,[robot]);expect(robot.health).toBe(hp);expect(again.snapshot().acidShells).toEqual([]);expect(again.snapshot().aquaticClouds).toEqual([]);
});
it('shares projectile and hazard admission, retaining hard bounds under sustained pressure',()=>{
 const {world,site,robot}=setup();site.aquatic.nextSpawn=999999;const saved=createCombat(world).checkpoint();saved.fields=Array.from({length:12},(_,i)=>makeField(i+1,'GAS',80,70,0));saved.serial=12;
 const blocked=createCombat(world,saved);advance(blocked,5,[robot]);expect(blocked.snapshot().aquaticClouds).toEqual([]);
 const w=setup().world,c=createCombat(w);advance(c,30,[{...robot,health:10000}]);expect(c.snapshot().aquaticClouds.length).toBeLessThanOrEqual(AQUATIC.maxFields);expect(c.snapshot().acidShells.filter((s:any)=>!s.impacted).length).toBeLessThanOrEqual(8);
 const combined=Array.from({length:12},(_,i)=>({weapon:'TOXIC',radius:1,id:i}));expect(fieldCapacityError(combined,[],'GAS')).toContain('limit');
});
it('ordinary HE bombardment damages and sustained HE conquers the hive and permanently stops its production across restart',()=>{
 const {world,site}=setup(),c=createCombat(world);expect(c.barrage({id:'battery',x:12,y:41,ammo:'HE'},{x:41.5,y:41.5},false)).toBeNull();advance(c,12);expect(site.hp).toBeLessThan(AQUATIC.hp);
 for(let i=0;i<25&&site.state==='hostile';i++){expect(c.shoot({id:'tank',x:37,y:41.5},41.5,41.5,'HE')).toBeNull();advance(c,1);}
 expect(site.state).toBe('conquered');expect(site.hp).toBe(0);
 const restored=createCombat(structuredClone(world),c.checkpoint());advance(restored,40,[setup().robot]);expect(restored.snapshot().sites[0].state).toBe('conquered');expect(restored.snapshot().enemies).toEqual([]);
});
