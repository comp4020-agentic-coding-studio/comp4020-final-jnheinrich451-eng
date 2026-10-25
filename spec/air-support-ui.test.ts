import {it,expect,vi,afterEach} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {newAirbase} from '../public/aircraft.js';
import {bomberUI} from '../public/bomber-ui.js';
import {aircraftOption,aircraftStatus} from '../public/air-support-status.js';
let dom:JSDOM;
afterEach(()=>{dom?.window.close();vi.unstubAllGlobals();});
function setup(){
 dom=new JSDOM(readFileSync('public/index.html','utf8'));vi.stubGlobal('document',dom.window.document);vi.stubGlobal('Option',dom.window.Option);
 const a:any=newAirbase('a','pilot',20,20),b:any=newAirbase('b','pilot',60,40),c:any=newAirbase('c','pilot',80,60);
 b.aircraft.state='vacant';c.aircraft.state='flying';c.aircraft.mission={id:'hold',kind:'cruise',phase:'cruise',target:{x:100,y:80},bearing:0,points:[]};
 const world:any={width:160,height:120,airbases:[a,b,c],logistics:{jobs:{}}},me={id:'pilot',body:'robot',life:'active',x:61,y:41};
 const api=vi.fn(async()=>{}),ui=bomberUI({state:()=>({world,me,connected:true,players:[]}),api,stop:()=>{},notify:()=>{},overview:()=>{}});
 const $=(id:string)=>dom.window.document.getElementById(id) as any;
 return {world,me,a,b,c,api,ui,$};
}
it('opens on a cruising aircraft and the robot current free runway; sends that destination in recall',async()=>{
 const {ui,$,api}=setup();ui.open();expect($('bomber-select').value).toBe('c');expect($('bomber-landing-base').value).toBe('b');
 expect($('bomber-select').selectedOptions[0].text).toContain('CRUISING');expect($('bomber-landing-base').selectedOptions[0].text).toContain('YOU ARE HERE');
 expect($('bomber-recall').disabled).toBe(false);await $('bomber-recall').onclick();expect(api).toHaveBeenCalledWith('aircraft/recall',{id:'c',landingBaseId:'b'});
});
it('updates live statuses without replacing dropdown options or overriding the chosen landing destination',()=>{
 const {ui,$,c}=setup();ui.open();const option=$('bomber-select').selectedOptions[0];
 $('bomber-landing-base').value='c';$('bomber-landing-base').onchange();ui.update();expect($('bomber-landing-base').value).toBe('c');
 c.aircraft.mission.phase='return';ui.update();expect($('bomber-select').selectedOptions[0]).toBe(option);expect(option.text).toContain('RETURNING');
 expect($('bomber-recall').disabled).toBe(true);expect($('bomber-recall-help').textContent).toContain('Recovery already in progress');
 c.aircraft.state='parked';c.aircraft.mission.phase='complete';ui.update();expect(option.text).toContain('PARKED');expect($('bomber-status').textContent).toContain('PARKED');
});
it('explains parked and unavailable-runway states and formats floating carrier coordinates cleanly',()=>{
 const {ui,$,world,b,c}=setup();ui.open();$('bomber-select').value='a';$('bomber-select').onchange();
 expect($('bomber-recall-help').textContent).toContain('Already on the ground');expect($('bomber-recall').disabled).toBe(true);
 $('bomber-select').value='c';b.destroyed=true;c.destroyed=true;$('bomber-select').onchange();expect($('bomber-recall').disabled).toBe(true);expect($('bomber-recall-help').textContent).toContain('No compatible free');
 c.x=44.000016;c.y=54.99999;expect(aircraftOption(world,c,1)).toContain('Runway 44:55');expect(aircraftOption(world,c,1)).not.toContain('000016');
 expect(aircraftStatus({...c.aircraft,state:'parked',rearm:5})).toBe('PARKED');
 expect(aircraftStatus({...c.aircraft,kind:'helicopter',state:'parked',rearm:5})).toBe('REARMING');
});
