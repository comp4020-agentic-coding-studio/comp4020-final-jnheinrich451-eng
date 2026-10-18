import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.js';

it('disables both the test capability and API on a server without test events',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-frenzy-access-'));
 const app=createApp({dataDir:dir,testEvents:false,logSink:()=>{}});
 try{
  await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(app.server.address() as any).port}`;
  const res=await fetch(base+'/api/world'),cookie=res.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  expect((await res.json()).testEvents).toBe(false);
  const denied=await fetch(base+'/api/frenzy/test',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});
  expect(denied.status).toBe(404);expect((await denied.json()).error).toContain('disabled');
 }finally{
  await app.close();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'frontier-frenzy-access-'))throw Error('Unexpected test path');await rm(dir,{recursive:true,force:true});
 }
});
