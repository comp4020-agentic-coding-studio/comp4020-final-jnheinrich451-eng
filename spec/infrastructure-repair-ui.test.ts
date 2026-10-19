import {it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createWorld} from '../public/world.js';
import {freshLogistics} from '../public/logistics.js';
import {shipSite} from '../public/ship.js';
import {yardFromShip} from '../public/shipyard.js';
import {shipyardUI} from '../public/shipyard-ui.js';
import {logisticsUI} from '../public/logistics-ui.js';

let dom:JSDOM;
afterEach(()=>{dom?.window.close();vi.unstubAllGlobals();});
function setup(){
  dom=new JSDOM(readFileSync('public/index.html','utf8'));vi.stubGlobal('document',dom.window.document);
  const world:any={...createWorld(),width:128,height:96,terrain:Array.from({length:128*96},(_,i)=>i%128>=21&&i%128<60?0:2),sites:[],ships:[],cores:[],tanks:[],artillery:[],rails:[],airbases:[],logistics:freshLogistics()};
  const vessel:any={...shipSite(world,[],[],23,25,'pilot','gunship','unfolding').ship,id:'yard:original',elapsed:4.5,dockReady:true};
  const yard=yardFromShip(vessel);yard.dockDestroyed=true;
  world.logistics.shipyards=[yard];world.logistics.groundSupplies=68;
  const me:any={id:'pilot',body:'robot',life:'active',x:19.5,y:25.5};
  const state=()=>({world,me,connected:true,buildings:[],players:[],placing:false,canManage:(id:string)=>id===me.id});
  const api=vi.fn(async()=>{}),noop=()=>{},args={state,api,notify:noop,stop:noop,deploy:noop,locate:noop,boarded:noop};
  const $=(id:string)=>dom.window.document.getElementById(id) as any;
  return {world,me,yard,api,args,$};
}
it('offers dock rebuilding in the shipyard and explains the ground-supply shortage',async()=>{
  const {world,me,yard,api,args,$}=setup(),ui=shipyardUI(args);ui.update();
  expect($('dock-rebuild').hidden).toBe(false);expect($('dock-rebuild').disabled).toBe(true);
  expect($('dock-rebuild-help').textContent).toContain('Need 90 GND; 68 available');
  world.logistics.groundSupplies=90;ui.update();expect($('dock-rebuild').disabled).toBe(false);
  await $('dock-rebuild').onclick();expect(api).toHaveBeenCalledWith('logistics/repair',{kind:'dock',id:yard.id});
  world.logistics.jobs[yard.id]={kind:'repair',remaining:6.2};ui.update();
  expect($('dock-rebuild').disabled).toBe(true);expect($('dock-rebuild').textContent).toContain('7s');
  delete world.logistics.jobs[yard.id];me.body='tank';ui.update();expect($('dock-rebuild').disabled).toBe(true);
  me.body='robot';yard.dockDestroyed=false;ui.update();expect($('dock-rebuild').hidden).toBe(true);
});
it('shows repair cost and progress in Field logistics and preserves IDs containing colons',async()=>{
  const {world,yard,api,args,$}=setup(),ui=logisticsUI(args);ui.update();
  expect($('logistics-repair').value).toBe('dock:'+yard.id);
  expect($('logistics-rebuild').disabled).toBe(true);expect($('logistics-repair-help').textContent).toContain('Need 90 GND; 68 available');
  world.logistics.groundSupplies=90;ui.update();expect($('logistics-rebuild').disabled).toBe(false);
  await $('logistics-rebuild').onclick();expect(api).toHaveBeenCalledWith('logistics/repair',{kind:'dock',id:yard.id});
  world.logistics.jobs[yard.id]={kind:'repair',remaining:3.4};ui.update();expect($('logistics-rebuild').disabled).toBe(true);expect($('logistics-rebuild').textContent).toContain('4s');
  delete world.logistics.jobs[yard.id];yard.dockDestroyed=false;ui.update();expect($('logistics-rebuild').disabled).toBe(true);expect($('logistics-repair-help').textContent).toContain('No destroyed docks');
});
it('recalculates affordability when switching from a dock to a more expensive airbase repair',()=>{
  const {world,args,$}=setup();world.logistics.groundSupplies=100;world.airbases=[{id:'base',owner:'pilot',destroyed:true,x:50,y:50}];
  const ui=logisticsUI(args);ui.update();expect($('logistics-rebuild').disabled).toBe(false);
  $('logistics-repair').value='airbase:base';$('logistics-repair').onchange();
  expect($('logistics-rebuild').disabled).toBe(true);expect($('logistics-repair-help').textContent).toContain('Need 150 GND; 100 available');
});
