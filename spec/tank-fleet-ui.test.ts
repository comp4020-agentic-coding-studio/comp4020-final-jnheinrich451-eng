import {it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {tankFleetUI} from '../public/tank-fleet-ui.js';

let dom:JSDOM;
afterEach(()=>{dom?.window.close();vi.unstubAllGlobals();});
it('selects a specific wreck for replacement while retaining a live sibling and finding transported tanks',async()=>{
  dom=new JSDOM(readFileSync('public/index.html','utf8'));vi.stubGlobal('document',dom.window.document);
  const tank=(id:string)=>({id,owner:'pilot',x:10,y:20,elapsed:99,weapon:'HE'});
  const a=tank('alive'),b={...tank('broken'),destroyed:true,replacement:0},cargo=tank('cargo');
  const carrier={id:'ship',x:40,y:50,cargo:{kind:'tank',vehicle:cargo}};
  const world:any={tanks:[a,b],ships:[carrier],logistics:{supplies:120, jobs:{}}};
  const me={id:'pilot',body:'robot',life:'active'},api=vi.fn(async()=>({vehicle:b})),locate=vi.fn(),replaced=vi.fn();
  const ui=tankFleetUI({state:()=>({world,me,connected:true}),api,locate,replaced,notify:vi.fn()});
  const $=(id:string)=>dom.window.document.getElementById(id) as any;
  ui.update();expect($('tank-select').options).toHaveLength(3);expect($('tank-replace').hidden).toBe(true);
  $('tank-select').value='broken';$('tank-select').onchange();expect($('tank-replace').hidden).toBe(false);expect($('tank-replace').disabled).toBe(false);
  const option=$('tank-select').selectedOptions[0];a.x=15;ui.update();expect($('tank-select').value).toBe('broken');expect($('tank-select').selectedOptions[0]).toBe(option);
  await $('tank-replace').onclick();expect(api).toHaveBeenCalledWith('vehicles/replace',{kind:'tank',id:'broken'});expect(replaced).toHaveBeenCalledWith(b);
  world.logistics.supplies=99;ui.update();expect($('tank-replace').disabled).toBe(true);expect($('tank-replace').title).toContain('100 ORB');
  $('tank-select').value='cargo';$('tank-select').onchange();expect($('tank-select').selectedOptions[0].text).toContain('ABOARD TRANSPORT');expect($('tank-replace').hidden).toBe(true);
  $('tank-find').onclick();expect(locate).toHaveBeenCalledWith(carrier);
  world.ships=[];world.tanks.push(cargo);ui.update();expect($('tank-select').value).toBe('cargo');expect($('tank-select').selectedOptions[0].text).toContain('GUARD');
});
