import {it,expect} from 'vitest';
import {createDirector,ENCOUNTERS,raidContacts,planNaturalRaid,tickDirector,pressureGroups,sleepEnemies} from '../public/encounter-director.js';
import {createCombat} from '../public/combat.js';
import {makeSite} from '../public/conquest.js';
import {newGroundEnemy} from '../public/enemy-profiles.js';
import {freshLife} from '../public/survival.js';
const world=():any=>({width:200,height:100,terrain:Array(20000).fill(2),spawn:{x:40.5,y:40.5},sites:[],cores:[],tanks:[],ships:[],airbases:[],artillery:[],rails:[]});
const player=(id='a',x=40.5,y=40.5):any=>({id,x,y,body:'robot',...freshLife(),shield:0});
function due(w:any){const s=createCombat(w,null,null,'campaign-a').checkpoint();s.director.nextRaid=0;return createCombat(w,s,null,'campaign-a');}

it('seeds and saves active-play deadlines, pauses with no eligible player and never catches up stacked raids',()=>{
 const a:any=createDirector('alpha'),b=createDirector('alpha');expect(a).toEqual(b);expect(a.nextRaid).toBeGreaterThanOrEqual(180000);expect(a.nextRaid).toBeLessThanOrEqual(300000);
 expect(createDirector('beta').nextRaid).not.toBe(a.nextRaid);
 const w=world(),p=player();tickDirector(a,w,[],[],[],1e9,9999,null,()=>{},()=>24);expect(a.elapsed).toBe(0);
 a.nextRaid=0;const f:any=tickDirector(a,w,[],[p],[],100,0.1,null,()=>{},()=>24);expect(f).toMatchObject({source:'natural',phase:'warning',until:8100});expect(a.sequence).toBe(1);
 expect(tickDirector(a,w,[],[p],[],1e8,99999,f,()=>{},()=>24)).toBeNull();expect(a.sequence).toBe(1);
 f.phase='complete';tickDirector(a,w,[],[p],[],1e8,0.1,f,()=>{},()=>24);expect(a.nextRaid-a.elapsed).toBeGreaterThanOrEqual(120000);expect(a.nextRaid-a.elapsed).toBeLessThanOrEqual(300000);
});
it('normal campaign starts a warned raid without a test request and restores the same plan across restart',()=>{
 const w=world(),p=player(),c=due(w);c.tick(.1,[],[p]);const checkpoint=c.checkpoint();
 expect(checkpoint.frenzy).toMatchObject({source:'natural',phase:'warning'});expect(checkpoint.enemies).toHaveLength(0);expect(checkpoint.frenzy.points.length).toBeGreaterThan(3);
 const resumed=createCombat(structuredClone(w),structuredClone(checkpoint),null,'other-seed');expect(resumed.checkpoint()).toEqual(checkpoint);
 for(let i=0;i<81;i++){c.tick(.1,[],[p]);resumed.tick(.1,[],[structuredClone(p)]);}
 expect(resumed.checkpoint()).toEqual(c.checkpoint());expect(c.snapshot().frenzy!.phase).toBe('surge');expect(c.snapshot().enemies.length).toBeGreaterThan(0);
 expect(c.drainEvents().filter((e:any)=>e.event==='frenzy.started')).toHaveLength(1);
});
it('rechecks warning locations and never spawns on a player who moved into the marked zone',()=>{
 const w=world(),p=player(),c=due(w);c.tick(.1,[],[p]);const spot=c.checkpoint().frenzy.points[0];p.x=spot.x;p.y=spot.y;
 // Resolve in one step so survivors cannot walk after arrival in this assertion.
 const s=c.checkpoint();s.frenzy.until=s.now;const resumed=createCombat(w,s);resumed.tick(0,[],[p]);
 expect(resumed.snapshot().enemies.every((e:any)=>Math.hypot(e.x-p.x,e.y-p.y)>=8)).toBe(true);
});
it('replenishes hostile compounds up to six, replaces losses, and permanently stops when conquered',()=>{
 const w=world(),p=player('a',35.5,45.5);w.sites=[{...makeSite('modifier','nest',50,40),guardsRemaining:0}];
 const c=createCombat(w,null,null,'pressure');for(let i=0;i<1000;i++)c.tick(.1,[],[],[p]);
 let s=c.checkpoint();expect(s.enemies.length).toBe(6);expect(s.director.groups.nest.wave).toBe(3);
 s.enemies[0].hp=0;const resumed=createCombat(w,s);for(let i=0;i<380;i++)resumed.tick(.1,[],[],[p]);
 s=resumed.checkpoint();expect(s.enemies.length).toBe(6);expect(s.director.groups.nest.wave).toBe(4);
 s.sites[0].state='conquered';s.enemies=[];s.director.nextRaid=1e9;
 const cleared=createCombat(w,s);for(let i=0;i<1000;i++)cleared.tick(.1,[],[],[p]);
 expect(cleared.snapshot().enemies).toHaveLength(0);expect(cleared.snapshot().sites[0].state).toBe('conquered');
});
it('shares caps across a compound including reserved arrivals and distant sleeping survivors',()=>{
 const w=world(),d:any=createDirector('caps'),p=player('a',30.5,30.5);
 w.sites=['a','b'].map((id,i)=>({...makeSite('modifier',id,30+i*6,30),guardsRemaining:0,encounter:{id:'group'}}));
 d.sleeping=Array.from({length:5},(_,i)=>({...newGroundEnemy('hunter',i,{x:160,y:80}),siteId:'a'}));
 w.sites[1].pending={points:[{x:30,y:30}]};const queued:any[]=[];
 pressureGroups(d,w,[p],[],()=>24,(s:any,r:any)=>{queued.push(r);return true;});expect(queued).toHaveLength(0);
 w.sites[1].pending=null;pressureGroups(d,w,[p],[],()=>1,(s:any,r:any)=>{queued.push(r);return true;});expect(queued[0]).toHaveLength(1);
});
it('selects swimmers at sea, adds shore ambushes, keeps submarines hidden and defers aircraft over open ocean',()=>{
 const w=world();w.terrain.fill(0);const p=player();p.body='ship';w.ships=[{id:'ship',berthX:40,berthY:40,occupant:'a',x:40.5,y:40.5,angle:0,elapsed:99,health:300}];
 const d=createDirector('sea'),contacts=raidContacts(w,[p]),f:any=planNaturalRaid(d,w,[],contacts,[],0,24);
 expect(f.medium).toBe('sea');expect(f.points).toHaveLength(3);expect(f.points.every((p:any)=>p.kind==='swimmer')).toBe(true);
 for(let y=0;y<w.height;y++)for(let x=48;x<w.width;x++)w.terrain[y*w.width+x]=2;
 const coast:any=planNaturalRaid(d,w,[],contacts,[],0,24);expect(coast.points.some((p:any)=>p.kind==='hunter'||p.kind==='breaker')).toBe(true);
 w.ships[0].kind='submarine';w.ships[0].depth='submerged';expect(raidContacts(w,[p])).toHaveLength(0);
 w.terrain.fill(0);expect(planNaturalRaid(d,w,[],[{...contacts[0],medium:'air'}],[],0,24)).toBeNull();
});
it('air raids use bounded lens counts and all players share one wave and warning',()=>{
 const w=world(),d=createDirector('air'),contacts=raidContacts(w,[player('a'),player('b',44.5)]).map((p:any)=>({...p,medium:'air'}));
 const f:any=planNaturalRaid(d,w,[],contacts,[],0,24);expect(f.points.map((p:any)=>p.kind).sort()).toEqual(['heavy-lens','twin-lens']);
 const lenses=Array.from({length:4},(_,i)=>newGroundEnemy('twin-lens',i,{x:150,y:50}));expect(planNaturalRaid(d,w,[],contacts,lenses,0,24)).toBeNull();
});
it('a normal sea raid remains active without ground combatants and swimmers threaten the occupied ship',()=>{
 const w=world();w.terrain.fill(0);const p=player();p.body='ship';
 w.ships=[{id:'ship',berthX:40,berthY:40,occupant:'a',x:40.5,y:40.5,angle:0,elapsed:99,health:300}];
 const c=due(w);for(let i=0;i<82;i++)c.tick(.1,[],[],[p]);
 expect(c.snapshot().frenzy!.phase).toBe('surge');expect(c.snapshot().enemies.filter((e:any)=>e.kind==='swimmer')).toHaveLength(3);
 for(let i=0;i<90;i++)c.tick(.1,[],[],[p]);expect(w.ships[0].health).toBeLessThan(300);
});
it('an unsuitable focus defers without starving the next teammate, and losing all contacts cancels a warning',()=>{
 const w=world(),d:any=createDirector('focus');w.terrain.fill(0);
 for(let y=0;y<100;y++)for(let x=110;x<200;x++)w.terrain[y*200+x]=2;
 const a=player('a'),b=player('b',150.5);a.body='aircraft';d.nextRaid=0;
 expect(tickDirector(d,w,[],[a,b],[],100,.1,null,()=>{},()=>24)).toBeNull();expect(d.focusCursor).toBe(1);
 const f:any=tickDirector(d,w,[],[a,b],[],30200,30.1,null,()=>{},()=>24);expect(f.focus).toBe('b');
 const c=due(world());c.tick(.1,[],[player()]);c.tick(.1,[],[]);expect(c.snapshot().frenzy!.outcome).toBe('no_ground_targets');
});
it('sleeps distant survivors without healing, wakes near players and applies offscreen explosions to sleeping bodies',()=>{
 const w=world(),d:any=createDirector('sleep'),e:any=newGroundEnemy('hunter',1,{x:160.5,y:40.5});e.hp=17;const units:any[]=[e],p=player();
 sleepEnemies(d,w,[],[p],units,[],0,0,null);expect(units).toHaveLength(0);expect(d.sleeping[0].hp).toBe(17);
 sleepEnemies(d,w,[],[player('a',150.5)],units,[],100,0,null);expect(units[0].hp).toBe(17);expect(d.sleeping).toHaveLength(0);
 const c=createCombat(w,null,null,'damage'),s=c.checkpoint();s.director.sleeping=[e];s.serial=1;s.director.nextRaid=1e9;
 const resumed=createCombat(w,s);expect(resumed.lob({id:'gun',x:120.5,y:40.5},160.5,40.5)).toBeNull();
 for(let i=0;i<40;i++)resumed.tick(.1,[],[p]);expect(resumed.snapshot().kills).toBe(1);expect(resumed.checkpoint().director.sleeping).toHaveLength(0);
});
it('does not wake beyond the shared active plus reserved limit or sleep a live event member',()=>{
 const w=world(),d:any=createDirector('limits'),p=player(),e=newGroundEnemy('hunter',100,{x:40.5,y:44.5});d.sleeping=[e];
 const units:any[]=Array.from({length:23},(_,i)=>newGroundEnemy('hunter',i,{x:40.5,y:45.5}));sleepEnemies(d,w,[],[p],units,[],0,1,null);expect(d.sleeping).toHaveLength(1);
 const far=newGroundEnemy('hunter',101,{x:160.5,y:40.5});units.push(far);sleepEnemies(d,w,[],[p],units,[],0,0,{phase:'warning',members:[101]});expect(units).toContain(far);
 expect(ENCOUNTERS.sleepLimit).toBe(128);
});
