import {it,expect} from 'vitest';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
import {NAVAL_GUN,secondaryMounts,sideSolution,secondaryRound,secondaryEnvelope,stepShipMounts,TWIN_BATTERY} from '../public/ship-armament.js';
import {angleDelta} from '../public/turret.js';
const ship=():any=>({id:'ship',kind:'gunship',x:20,y:20,angle:0,turret:0,elapsed:99,health:300,ammo:'HE',reload:4});
const world=():any=>({...createWorld(),width:48,height:36,terrain:Array(48*36).fill(0),sites:[],ships:[],tanks:[],cores:[]});

it('cycles three twin mounts per broadside at the old total damage cadence, skipping invalid mounts',()=>{
 const s=ship(),c=createCombat(world()),target={x:16,y:20};stepShipMounts(s,target,1);
 const owners=[];
 for(let i=0;i<6;i++){
  expect(c.navalSecondary(s,target).fired).toBe(2);
  const pair=c.snapshot().shots.slice(-2);owners.push(pair[0].owner.split(':')[1]);
  expect(pair.map(r=>r.barrel)).toEqual([-1,1]);expect(pair.every(r=>r.batterySide==='port')).toBe(true);
  expect(c.navalSecondary(s,target).fired).toBe(0);c.tick(.179,[]);
  expect(c.navalSecondary(s,target).fired).toBe(0);c.tick(.001,[]);
 }
 expect(owners).toEqual(['port-fore','port','port-aft','port-fore','port','port-aft']);
 expect(s.reload).toBe(4);expect(TWIN_BATTERY.damage*2).toBe(10);
 const partial=ship();partial.portForeTurret=0;partial.portAftTurret=0;
 expect(c.navalSecondary({...partial,id:'partial'},target).fired).toBe(2);
 expect(c.snapshot().shots.at(-1)?.owner).toBe('partial:port:1');
});

it('keeps dispersion inside the displayed aim-plane envelope and every outward arc at all headings',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,-Math.PI+.001])for(const side of [-1,1]){
  const s=ship();s.angle=heading;
  const target={x:s.x+Math.cos(heading)*side*6,y:s.y+Math.sin(heading)*side*6};stepShipMounts(s,target,2);
  const envelope=secondaryEnvelope(s,target)!;expect(envelope).not.toBeNull();
  for(const m of secondaryMounts(s)){
   const aim=sideSolution(s,target,m);if(!aim.inArc)continue;
   for(let sequence=0;sequence<20;sequence++)for(const barrel of [-1,1]){
    const r=secondaryRound(s,target,m,barrel,sequence),dx=Math.sin(r.angle),dy=-Math.cos(r.angle);
    expect(Math.abs(angleDelta(s.angle+m.center,r.angle))).toBeLessThanOrEqual(NAVAL_GUN.halfArc+1e-9);
    const fx=Math.sin(aim.angle),fy=-Math.cos(aim.angle),t=((target.x-r.x)*fx+(target.y-r.y)*fy)/(dx*fx+dy*fy);
    expect(Math.hypot(r.x+dx*t-target.x,r.y+dy*t-target.y)).toBeLessThanOrEqual(envelope.radius+1e-9);
    expect(r).toEqual(secondaryRound(s,target,m,barrel,sequence));
   }
  }
 }
});

it('rejects a whole pair at capacity and does not consume cadence or order on rejection',()=>{
 const w=world(),s=ship(),base=createCombat(w).checkpoint(),target={x:16,y:20};stepShipMounts(s,target,1);
 base.shells=Array.from({length:63},(_,i)=>({id:100+i,weapon:'APCR',owner:'other',x:2,y:2,dx:1,dy:0,speed:28,remaining:8,blast:null}));base.serial=200;
 const c=createCombat(w,base),before=c.checkpoint(),record=JSON.stringify(s);
 expect(c.navalSecondary(s,target).fired).toBe(0);expect(c.checkpoint()).toEqual(before);expect(JSON.stringify(s)).toBe(record);
 base.shells.pop();const room=createCombat(w,base);expect(room.navalSecondary(s,target).fired).toBe(2);expect(room.snapshot().shells).toHaveLength(64);
});

it('restores accepted five-damage bullets and broadside cooldown without retargeting or extra automatic shots',()=>{
 const w=world(),s=ship(),target={x:16,y:20};stepShipMounts(s,target,1);
 const c=createCombat(w);expect(c.navalSecondary(s,target).fired).toBe(2);
 const saved=c.checkpoint(),bullets=structuredClone(saved.shells),hull=JSON.parse(JSON.stringify(s));
 const resumed=createCombat(w,saved);expect(resumed.snapshot().shells).toEqual(bullets);
 expect(bullets.map((b:any)=>b.damage)).toEqual([5,5]);
 expect(resumed.navalSecondary(hull,target).fired).toBe(0);stepShipMounts(hull,{x:24,y:20},1);
 expect(resumed.snapshot().shells).toEqual(bullets);resumed.tick(.2,[]);expect(resumed.snapshot().shots).toHaveLength(0);
 stepShipMounts(hull,target,1);expect(resumed.navalSecondary(hull,target).fired).toBe(2);
 expect(resumed.snapshot().shots[0].owner).toBe('ship:port:-1');
});

it('applies ten damage for a close twin hit while leaving friendly crew untouched',()=>{
 const w=world(),s=ship(),target={x:16,y:20};stepShipMounts(s,target,1);
 const c=createCombat(w);c.navalSecondary(s,target);const saved=c.checkpoint();
 saved.enemies=[{id:99,x:16,y:20,hp:100,angle:0,kind:'crawler',behavior:'idle',path:[],reroute:1e9}];
 const restored=createCombat(w,saved),friendly:any={id:'crew',x:16,y:20,health:100,life:'active',shield:0};restored.tick(.1,[],[friendly]);
 expect(restored.snapshot().enemies[0].hp).toBe(90);expect(friendly.health).toBe(100);
});

it('retains single side guns on transports/carriers, no submarine battery, and legacy poses',()=>{
 const s=ship();s.portTurret=-1.3;s.starboardTurret=1.4;stepShipMounts(s,null,0);
 expect(s.portForeTurret).toBe(-1.3);expect(s.portAftTurret).toBe(-1.3);expect(s.starboardAftTurret).toBe(1.4);
 for(const kind of ['carrier','transport']){
  const hull={...ship(),kind},c=createCombat(world());expect(secondaryMounts(hull)).toHaveLength(2);stepShipMounts(hull,{x:16,y:20},1);
  expect(c.navalSecondary(hull,{x:16,y:20}).fired).toBe(1);expect(c.snapshot().shots[0].owner).toBe('ship:port');
 }
 expect(secondaryMounts({...ship(),kind:'submarine'})).toHaveLength(0);
});
