import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { VEHICLE, hullHealth, hurtVehicle, hullDistance } from '../public/vehicle.js';
import { SWIMMER, canSwim, waterRoute, swimStep } from '../public/naval.js';
import { shipSite } from '../public/ship.js';
import { makeField } from '../public/hazards.js';
const coast=()=>({...createWorld(),terrain:Array.from({length:48*36},(_,i)=>i%48<20?0:2 as number),ships:[] as any[],tanks:[] as any[]});
const ship=()=>({...shipSite(coast(),[],[],17,12,'a').ship!,id:'s',elapsed:4.5,health:VEHICLE.ship,angle:0,destroyed:false,replacement:0,hurt:0});
it('defaults old saves to full hulls and destroys each vehicle once without friendly weapon damage',()=>{
 const t:any={id:'t',x:25.5,y:15.5,podX:23,podY:15,elapsed:4.5};expect(hullHealth(t)).toBe(VEHICLE.tank);
 for(let i=0;i<8;i++)expect(hurtVehicle(t,25)).toBe(true);expect(t).toMatchObject({health:0,destroyed:true,replacement:12,hurt:8});expect(hurtVehicle(t,25)).toBe(false);
 const w=coast(),s=ship();w.ships.push(s);w.tanks.push(t);expect(canStand(w,[],25.5,15.5)).toBe(true);
 const c=createCombat(w);for(const ammo of ['HE','INCENDIARY','GAS']){expect(c.lob({id:'friendly',x:s.x-8,y:s.y},s.x,s.y,{duration:.1,verticalSpeed:0,gravity:0,elevation:0},ammo)).toBeNull();c.tick(.1,[]);}
 expect(s.health).toBe(VEHICLE.ship);
});
it('swimmer strikes have a windup, hit once, miss moving hulls and cancel during burning',()=>{
 const w=coast(),s=ship();w.ships.push(s);const e:any={id:1,x:s.x+1.7,y:s.y,hp:60,reroute:0};
 swimStep(w,e,[s],[],100,.1);expect(e.attack).toBeTruthy();expect(s.health).toBe(300);
 swimStep(w,e,[s],[],1099,.1);expect(s.health).toBe(300);swimStep(w,e,[s],[],1100,.1);expect(s.health).toBe(265);swimStep(w,e,[s],[],1200,.1);expect(s.health).toBe(265);
 e.nextAttack=0;swimStep(w,e,[s],[],2000,.1);s.y+=4;swimStep(w,e,[s],[],3000,.1);expect(s.health).toBe(265);expect(e.strike.hit).toBe(false);
 s.y-=4;e.nextAttack=0;swimStep(w,e,[s],[],3100,.1);e.burnUntil=6000;e.heatX=s.x;e.heatY=s.y;swimStep(w,e,[s],[],4200,.1);expect(e.attack).toBeNull();expect(s.health).toBe(265);
});
it('routes on water around obstacles with a bounded search and cannot pass hulls or land',()=>{
 const w=coast(),s=ship();w.ships.push(s);expect(canSwim(w,s.x,s.y)).toBe(false);expect(canSwim(w,20.5,12.5)).toBe(false);
 for(let y=0;y<36;y++)w.terrain[y*48+10]=2;
 expect(waterRoute(w,{x:7.5,y:12.5},(x,y)=>x>12,()=>false,100)).toBeNull();
 w.terrain[10*48+10]=0;const route=waterRoute(w,{x:7.5,y:12.5},(x,y)=>x>12,()=>false,1024)!;expect(route.length).toBeGreaterThan(5);expect(route.every(p=>canSwim(w,p.x,p.y))).toBe(true);
});
it('naval contacts coexist with ground drills, are capped, and can be killed by HE, fire and gas',()=>{
 for(const ammo of ['HE','INCENDIARY','GAS']){
 const w=coast(),s=ship();w.ships.push(s);const c=createCombat(w);expect(c.contact(s)).toBeNull();expect(c.snapshot().naval.count).toBe(3);expect(c.contact(s)).toContain('timer');
 expect(c.start([])).toBeNull();expect(c.snapshot().enemies.filter(e=>e.kind==='swimmer')).toHaveLength(3);expect(c.snapshot().enemies.filter(e=>e.kind!=='swimmer')).toHaveLength(3);
 const enemy=c.snapshot().enemies.find(e=>e.kind==='swimmer');const initial=c.snapshot().naval.count;
 expect(c.lob({id:'gun',x:enemy.x,y:enemy.y+7},enemy.x,enemy.y,{duration:.1,verticalSpeed:0,gravity:0,elevation:0},ammo)).toBeNull();c.tick(.1,[]);
 expect(c.snapshot().naval.count).toBeLessThan(initial);expect(c.snapshot().status).toBe('active');expect(s.health).toBe(300);
 if(ammo==='HE'){expect(c.snapshot().impacts.at(-1)?.surface).toBe(0);expect(c.snapshot().marks.some(m=>m.kind==='crater')).toBe(false);}
 if(ammo==='GAS')expect(c.snapshot().fields[0].capacity).toBe(6-(initial-c.snapshot().naval.count));
 }
});
it('swimmers avoid heat and follow gas, then become capable of destroying a stationary ship',()=>{
 const w=coast(),s=ship();w.ships.push(s);const c=createCombat(w);c.contact(s);
 for(let i=0;i<500&&!s.destroyed;i++)c.tick(.1,[]);expect(s.destroyed).toBe(true);expect(s.health).toBe(0);
 const e:any={id:8,x:7.5,y:10.5,hp:60,path:[],reroute:0};const gas=makeField(1,'GAS',7.5,6.5,0),fire=makeField(2,'INCENDIARY',8.5,8.5,0);
 swimStep(w,e,[],[gas],100,.1);expect(e.behavior).toBe('lured');expect(e.path.length).toBeGreaterThan(0);
 e.reroute=0;swimStep(w,e,[],[gas,fire],200,.1);expect(e.path.every((p:{x:number,y:number})=>Math.hypot(p.x-fire.x,p.y-fire.y)>fire.radius)).toBe(true);
});
it('ground crawlers select, approach and damage a deployed tank',()=>{
 const w=coast(),t:any={id:'t',x:24.5,y:11.5,podX:22,podY:11,elapsed:4.5,health:200};w.tanks.push(t);const c=createCombat(w);expect(c.start([])).toBeNull();
 for(let i=0;i<200&&t.health===200;i++)c.tick(.1,[]);expect(t.health).toBeLessThan(200);expect(c.snapshot().enemies.some(e=>e.targetId==='vehicle:t')).toBe(true);
});
it('limits concurrent swimmers to six even when another contact timer has elapsed',()=>{
 const w=coast(),s=ship();w.ships.push(s);const c=createCombat(w);
 expect(c.contact(s)).toBeNull();c.tick(30,[]);expect(c.contact(s)).toBeNull();expect(c.snapshot().naval.count).toBe(6);
 c.tick(30,[]);expect(c.contact(s)).toContain('Six');expect(c.snapshot().naval.count).toBe(6);
});
