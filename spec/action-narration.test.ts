import {it,expect} from 'vitest';
import {EventEmitter} from 'node:events';
import {controlledUnit,describeCommand} from '../action-narration.js';
import {createAudit} from '../observability.js';
import {parseAuditLine,presentAudit} from '../log-presentation.js';
const player={id:'pilot',x:20,y:20,life:'active'};
const robot=()=>controlledUnit({},player,'robot');
it('translates world movement and aiming without treating keyboard input as completed movement',()=>{
 for(const [x,y,direction]of [[0,-1,'north'],[1,0,'east'],[0,1,'south'],[-1,0,'west'],[-1,-1,'north-west'],[0,0,'stop']]){
  expect(describeCommand('input',{x,y},{},robot())).toMatchObject({unitType:'robot',direction});
 }
 expect(describeCommand('input',{x:0,y:-1,aim:Math.PI/2},{},robot()).command).toBe('move north; aim east');
 expect(describeCommand('input',{x:NaN,y:0},{},robot()).direction).toBe('invalid');
});
it('distinguishes naval steering, fixed-wing throttle and helicopter movement',()=>{
 const ship:any={id:'ship',occupant:'pilot',angle:Math.PI/2};
 const w:any={ships:[ship]},u=controlledUnit(w,player,'ship');
 expect(describeCommand('input',{x:-1,y:0,throttle:4},w,u)).toMatchObject({unitType:'gunship',rotation:'left',throttle:'Full',command:'Full; turn left'});
 const p:any={id:'plane',kind:'bomber',occupant:'pilot',state:'flying'};w.airbases=[{id:'base',aircraft:p}];w.ships=[];
 expect(describeCommand('input',{x:1,y:1},w,controlledUnit(w,player,'aircraft')).command).toBe('decelerate; turn right');
 p.kind='helicopter';expect(describeCommand('input',{x:1,y:1},w,controlledUnit(w,player,'aircraft')).command).toBe('move south-east');
});
it('uses the real controlled unit and weapon; names missile, cannon, rocket and charge commands',()=>{
 const w:any={artillery:[{id:'battery',kind:'missile',operator:'pilot',ammo:'GAS'}]};
 expect(describeCommand('artillery/fire',{},w,controlledUnit(w,player,'robot'))).toMatchObject({bodyType:'robot',unitType:'missile-launcher',unitId:'battery',controlMode:'remote',command:'launch missiles / gas',weapon:'GAS'});
 expect(describeCommand('fire',{weapon:'MAGNETIC'},{},robot()).command).toBe('charge magnetic cannon');
 expect(describeCommand('aircraft/helicopter-fire',{weapon:'rockets'},{},robot()).command).toBe('fire rocket pods');
 expect(describeCommand('fire',{weapon:'arbitrary-secret',unitType:'spoofed'},{},robot())).toMatchObject({unitType:'robot',weapon:'unknown',command:'fire unknown weapon'});
 expect(describeCommand('fire',{weapon:{toString:0,valueOf:0}},{},robot()).command).toBe('fire unknown weapon');
 expect(describeCommand('fire',{weapon:'constructor'},{},robot()).command).toBe('fire unknown weapon');
});
it('groups repeated commands but keeps north, south, weapons and units separate for the same actor',()=>{
 const lines:any[]=[],audit=createAudit(line=>lines.push(JSON.parse(line)));
 const send=(meta:any)=>{const res:any=new EventEmitter();res.statusCode=200;audit.run({url:'/api/input',method:'POST'},res,()=>{audit.actor({id:'a',name:'Alex',kind:'demo'});audit.bind(meta);res.emit('finish');});};
 try{
  for(let i=0;i<20;i++)send({unitType:'robot',unitId:'a',command:'move north'});
  send({unitType:'robot',unitId:'a',command:'move south'});send({unitType:'tank',unitId:'t',command:'move north'});
  audit.close();const results=lines.filter(e=>e.event==='activity.summary');expect(results).toHaveLength(3);expect(results[0]).toMatchObject({count:20,command:'move north'});
  expect(results[0].firstAt).toBeTruthy();expect(results[0].lastAt).toBeTruthy();expect(results[0].message).toContain('Alex | robot | move north | accepted');
 }finally{audit.close();}
});
it('renders raw, Fly-prefixed and wrapped log records, ignoring non-audit text and preserving player distinction',()=>{
 const event={at:'2026-10-19T04:00:00Z',event:'activity.summary',name:'Alex',actorId:'actor-one',unitType:'tank',command:'fire HE cannon',outcome:'denied',reason:'Weapon reloading.',count:3};
 for(const line of [JSON.stringify(event),'2026-10-19 app[abc] [info] '+JSON.stringify(event),JSON.stringify({message:JSON.stringify(event)})])expect(parseAuditLine(line)).toEqual(event);
 expect(parseAuditLine('password=secret accidental debug')).toBeNull();expect(parseAuditLine('{malformed')).toBeNull();
 expect(presentAudit(event)).toContain('Alex (actor-one) | tank | activity.summary | fire HE cannon | denied | 3 requests');
 expect(presentAudit({...event,actorId:'actor-two'})).toContain('actor-two');
});

it('keeps transport evidence and instance identities visible in the readable log view',()=>{
 const text=presentAudit({at:'2026-10-22T05:00:00Z',event:'state.broadcast.summary',campaignId:'room',kind:'system',count:10,firstRevision:2,revision:11,connections:3,connectedPlayers:2,queuedWrites:29,droppedStreams:1,transport:'sse',machineId:'fly-machine',instanceId:'boot-id',runtimeId:'room-run',buildId:'build-id'});
 for(const part of ['state.broadcast.summary','revision 2..11','2 connected players','3 streams','29 queued writes','1 skipped streams','machine fly-machine','instance boot-id','runtime room-run','build build-id'])expect(text).toContain(part);
 expect(text).not.toContain('delivered');
});
