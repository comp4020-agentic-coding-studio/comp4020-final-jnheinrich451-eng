// Local simulation-only probe; excludes HTTP/SSE, SQLite and other rooms.
import {performance} from 'node:perf_hooks';
import {createWorld} from '../public/world.js';
import {createCombat} from '../public/combat.js';
import {freshLife} from '../public/survival.js';

const world={...createWorld(),width:512,height:384,terrain:Array(512*384).fill(2),sites:[],cores:[],tanks:[]};
for(let y=0;y<384;y++)world.terrain[y*512+256]=0;
const saved=createCombat(world).checkpoint();
saved.enemies=Array.from({length:24},(_,i)=>({id:i+1,x:50.5+i%6*3,y:60.5+Math.floor(i/6)*3,hp:60,path:[],reroute:0,angle:0,eventSpawn:true,rally:{x:50.5,y:60.5}}));saved.serial=24;
saved.frenzy={id:'probe',phase:'surge',until:60000,members:saved.enemies.map(e=>e.id),points:[],orders:{},nextPulse:0,outcome:null};
const combat=createCombat(world,saved),players=[140,180,300,330].map((x,i)=>({id:'p'+i,x:x+.5,y:100.5+i*15,...freshLife(),health:100000}));
const times=[];let peakRss=0;
for(let tick=0;tick<600;tick++){
 const start=performance.now();combat.tick(.05,[],players);times.push(performance.now()-start);peakRss=Math.max(peakRss,process.memoryUsage().rss);
}
times.sort((a,b)=>a-b);
console.log(JSON.stringify({scope:'local simulation only; 24 enemies, 4 ground targets, 512x384, split landmass',simulatedSeconds:30,ticks:times.length,p95Ms:+times[Math.floor(times.length*.95)].toFixed(2),maxMs:+times.at(-1).toFixed(2),peakRssMiB:+(peakRss/1048576).toFixed(1)},null,2));
