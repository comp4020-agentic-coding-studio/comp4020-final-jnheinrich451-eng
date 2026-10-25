import {expect,it} from 'vitest';
import {wreckRecoveryFixture} from '../tests/helpers/wreck-recovery-fixture.js';

it('keeps a large initial world snapshot and communication history on the same live connection',async()=>{
 const f=await wreckRecoveryFixture({snapshotCrates:1600}),controller=new AbortController();
 try{
  const response=await fetch(f.url+'/api/events',{headers:{Cookie:'frontier='+f.tokens[0]},signal:controller.signal});
  expect(response.status).toBe(200);
  const packets:any[]=[],decoder=new TextDecoder();let pending='',streamError:any;
  const reading=(async()=>{try{for await(const chunk of response.body as any){
   pending+=decoder.decode(chunk,{stream:true});let end;
   while((end=pending.indexOf('\n\n'))>=0){const raw=pending.slice(0,end);pending=pending.slice(end+2);const data=raw.split('\n').find(line=>line.startsWith('data: '));if(data)packets.push({event:raw.startsWith('event: communication')?'communication':'state',data:JSON.parse(data.slice(6)),bytes:Buffer.byteLength(raw)});}
  }}catch(error){if(!controller.signal.aborted)streamError=error;}})();
  await expect.poll(()=>packets.some(p=>p.event==='communication'&&p.data.type==='history'),{timeout:4000}).toBe(true);
  const initial=packets.find(p=>p.event==='state');expect(initial.bytes).toBeGreaterThan(64*1024);
  expect((await f.post('communication',{kind:'chat',text:'large world remains connected',requestId:'large-message-01'})).status).toBe(200);
  await expect.poll(()=>packets.some(p=>p.event==='communication'&&p.data.event?.text==='large world remains connected')).toBe(true);
  const y=(await f.state()).me.y;
  expect((await f.post('input',{x:0,y:-1})).status).toBe(200);
  await expect.poll(async()=>(await f.state()).me.y).toBeLessThan(y-.01);
  await expect.poll(()=>packets.filter(p=>p.event==='state').length).toBeGreaterThan(2);
  expect(streamError).toBeUndefined();controller.abort();await reading;
 }finally{controller.abort();await f.close();}
},10000);
