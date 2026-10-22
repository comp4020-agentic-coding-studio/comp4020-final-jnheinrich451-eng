import {it,expect} from 'vitest';
import {AIR,newAirbase,tickAircraft} from '../public/aircraft.js';
function fixture(kind='bomber'){
 const b:any=newAirbase('b','pilot',240,240,kind);Object.assign(b.aircraft,{state:'flying',x:256,y:256,angle:0,speed:6,bank:0});
 return{b,p:b.aircraft,w:{width:512,height:512,airbases:[b],ships:[],logistics:{jobs:{}}}};
}
it('rolls into a manual turn, levels gradually, and holds heading after levelling',()=>{
 const {w,b,p}=fixture();tickAircraft(w,b,{steer:1},.1);expect(p.bank).toBeGreaterThan(0);expect(p.bank).toBeLessThan(1);
 tickAircraft(w,b,{steer:1},.6);expect(p.bank).toBe(1);const heading=p.angle;
 tickAircraft(w,b,{steer:0},.1);expect(p.bank).toBeGreaterThan(0);expect(p.bank).toBeLessThan(1);expect(p.angle).toBeGreaterThan(heading);
 tickAircraft(w,b,{steer:0},1);expect(p.bank).toBe(0);const level=p.angle;tickAircraft(w,b,{steer:0},.2);expect(p.angle).toBe(level);
});
it('gives the jet faster roll and acceleration while retaining forward flight limits',()=>{
 const bomber=fixture(),jet=fixture('attack-jet');for(const f of [bomber,jet])tickAircraft(f.w,f.b,{steer:1,throttle:1},.2);
 expect(jet.p.bank).toBeGreaterThan(bomber.p.bank);expect(jet.p.speed).toBeGreaterThan(bomber.p.speed);expect(jet.p.angle).toBeGreaterThan(bomber.p.angle);
 for(const f of [bomber,jet]){tickAircraft(f.w,f.b,{throttle:1},5);expect(f.p.speed).toBe(AIR.maxSpeed);tickAircraft(f.w,f.b,{throttle:-1},5);expect(f.p.speed).toBe(AIR.minSpeed);}
});
it('maintains equivalent manual turns across different tick sizes',()=>{
 const a=fixture(),b=fixture();tickAircraft(a.w,a.b,{steer:1,throttle:1},1);for(let i=0;i<20;i++)tickAircraft(b.w,b.b,{steer:1,throttle:1},.05);
 for(const k of ['x','y','angle','speed','bank'])expect(a.p[k]).toBeCloseTo(b.p[k],8);
});
it('drops stale bank on input loss and keeps accepted bomb release on its course',()=>{
 const {w,b,p}=fixture();p.bank=1;const a=p.angle;tickAircraft(w,b,null,.1);expect(p.bank).toBe(0);expect(p.angle).toBe(a);
 p.bank=1;p.releaseRemaining=1;const speed=p.speed;tickAircraft(w,b,{steer:-1,throttle:1},.2);expect(p.bank).toBe(0);expect(p.angle).toBe(a);expect(p.speed).toBe(speed);
});
it('keeps the automatic controller independent of manual weight and previous bank',()=>{
 for(const kind of ['bomber','attack-jet']){const {w,b,p}=fixture(kind);p.bank=-1;tickAircraft(w,b,{steer:1,throttle:0,automatic:true},.1);expect(p.angle).toBeCloseTo(AIR.turnSpeed*.1);expect(p.bank).toBe(0);}
});
it('boundary assistance overrides an outward manual bank and stays within the map',()=>{
 const {w,b,p}=fixture();Object.assign(p,{x:2,y:256,angle:-Math.PI/2,speed:12,bank:-1});
 // A safe approach starts before the edge, with the same boundary authority as missions.
 p.x=24;for(let i=0;i<400;i++){tickAircraft(w,b,{steer:-1,throttle:0},.025);expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(w.width);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(w.height);}
});
