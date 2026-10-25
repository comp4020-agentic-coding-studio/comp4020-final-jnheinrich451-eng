import {it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createWorld} from '../public/world.js';
import {freshLogistics} from '../public/logistics.js';
import {shipSite} from '../public/ship.js';
import {yardFromShip} from '../public/shipyard.js';
import {shipyardUI} from '../public/shipyard-ui.js';
import {logisticsUI} from '../public/logistics-ui.js';
import {facilityServiceUI} from '../public/facility-service-ui.js';
import {newAirbase} from '../public/aircraft.js';

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
it('marks a lost dock as a permanent ruin and leaves new deployment available',()=>{
  const {world,args,$}=setup(),ui=shipyardUI(args);world.logistics.supplies=300;ui.update();
  expect($('dock-rebuild').hidden).toBe(true);expect($('dock-rebuild-help').textContent).toContain('permanent ruin');
  expect($('shipyard-new-dialog').disabled).toBe(false);
  expect($('yard-build-gunship').disabled).toBe(true);
});
it('locates an abandoned facility without payment and preserves IDs containing colons',()=>{
  const {world,yard,api,args,$}=setup(),locate=vi.fn();$('logistics-dialog').close=()=>{};
  const ui=logisticsUI({...args,locate});ui.update();
  expect($('logistics-repair').value).toBe('dock:'+yard.id);expect($('logistics-rebuild').disabled).toBe(false);
  expect($('logistics-repair-help').textContent).toContain('cannot be repaired');
  $('logistics-rebuild').onclick();expect(locate).toHaveBeenCalledWith({x:yard.dock.x,y:yard.dock.y});expect(api).not.toHaveBeenCalled();expect(world.logistics.groundSupplies).toBe(68);
  yard.dockDestroyed=false;ui.update();expect($('logistics-rebuild').disabled).toBe(true);
});
it('offers manufacturing at a new intact base instead of reopening an overlapping abandoned runway',()=>{
  const {world,me,args}=setup();const old:any={...newAirbase('old','pilot',40,40),destroyed:true};old.aircraft.state='destroyed';
  const fresh:any=newAirbase('new','pilot',40,40);fresh.aircraft.state='vacant';world.airbases=[old];Object.assign(me,{x:42,y:43});
  const ui=facilityServiceUI({...args,manage:()=>{},airSupport:()=>{}});ui.update();const panel=document.querySelector('#facility-service') as HTMLElement;
  expect(panel.hidden).toBe(true);world.airbases.push(fresh);world.logistics.groundSupplies=300;ui.update();
  expect(panel.hidden).toBe(false);expect((panel.querySelector('.service-rebuild') as HTMLElement).hidden).toBe(true);
  expect((panel.querySelector('[data-kind="bomber"]') as HTMLButtonElement).disabled).toBe(false);
});
