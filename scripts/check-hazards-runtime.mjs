// Mutating workload: use a disposable server, never a user's saved world.
import { writeFile } from 'node:fs/promises';
if (process.env.ISOLATED_TEST !== '1') throw new Error('ISOLATED_TEST=1 and an isolated APP_URL are required.');
const base = process.env.APP_URL || 'http://localhost:8084', abort = new AbortController(), clients = [], readers = [];
const seenShots = new Map(), seenImpacts = new Map();
let snapshots = 0, bytes = 0, maximumSnapshot = 0;
const times = [], began = performance.now();
async function post(client, action, data) {
  const at = performance.now();
  const response = await fetch(`${base}/api/${action}`, { method: 'POST', headers: { Cookie: client.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: abort.signal });
  times.push(performance.now() - at); const result = await response.json();
  if (!response.ok) throw new Error(`${action}: ${result.error}`);
  return result;
}
try {
  for (let i = 0; i < 4; i++) {
    const response = await fetch(`${base}/api/world`), initial = await response.json();
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const client = { cookie, state: initial, id: initial.me.id }; clients.push(client);
    const stream = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: abort.signal }), reader = stream.body.getReader();
    readers.push((async () => {
      let buffer = ''; const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength; buffer += decoder.decode(part.value, { stream: true });
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const message = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (!message.startsWith('data: ')) continue;
            snapshots++; maximumSnapshot = Math.max(maximumSnapshot, Buffer.byteLength(message)); client.state = { ...client.state, ...JSON.parse(message.slice(6)) }; for (const shot of client.state.combat.shots) seenShots.set(shot.id, shot); for (const impact of client.state.combat.impacts) seenImpacts.set(impact.id, impact);
          }
        }
      } catch (error) { if (!abort.signal.aborted) throw error; }
    })());
  }
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const guns=[];
  async function renew() { for(let i=0;i<4;i++) await post(clients[i], 'artillery/input', {id:guns[i].id,traverse:0,elevate:0}); }
  async function until(test,label,timeout=35000) {const at=performance.now();while(!test()){if(performance.now()-at>timeout)throw Error(label+' timed out');await renew();await delay(140);}}
  for(let i=0;i<4;i++) {
    const y=20+i*5;
    await post(clients[i],'rails',{x:62,y,shape:'EW'});
    const {gun}=await post(clients[i],'artillery',{x:62,y});guns.push(gun);
    await post(clients[i],'artillery/control',{id:gun.id});
  }
  const liveGun=i=>clients[i].state.artillery.find(g=>g.id===guns[i].id);
  while(guns.some((g,i)=>liveGun(i).elevation<85)) {
    for(let i=0;i<4;i++)await post(clients[i],'artillery/input',{id:guns[i].id,traverse:0,elevate:liveGun(i).elevation<85?1:0}); await delay(140);
  }
  await renew();
  for(let round=0;round<3;round++) {
    await until(()=>guns.every((g,i)=>liveGun(i).reload<=.001 && liveGun(i).brace<=.001),'reload');
    for(let i=0;i<4;i++) {await post(clients[i],'artillery/ammo',{id:guns[i].id,ammo:round<2?'GAS':'INCENDIARY'});await post(clients[i],'artillery/fire',{id:guns[i].id});}
    await until(()=>clients.every(c=>c.state.combat.fields.length===(round+1)*4),'shared fields');
  }
  const maximumFields=clients[0].state.combat.fields.length;
  // Active fire obstructs the gas lure routes at the eastern drill objective.
  await post(clients[0],'drill',{frontId:'east'});
  await until(()=>clients.every(c=>!c.state.combat.fields.some(f=>f.weapon==='INCENDIARY')),'fire expiry');
  await until(()=>clients.every(c=>c.state.combat.status==='cleared'),'gas attraction and kills');
  const charges=clients[0].state.combat.fields.filter(f=>f.weapon==='GAS').reduce((n,f)=>n+f.capacity,0);
  const killedBy=weapon=>[...seenImpacts.values()].filter(i=>i.weapon===weapon).flatMap(i=>i.hits).filter(h=>h.killed).length;
  const fireKills=killedBy('INCENDIARY'), gasKills=killedBy('GAS');
  if(fireKills+gasKills!==3 || charges!==48-gasKills)throw Error('Field kill accounting mismatch');
  const report={seconds:(performance.now()-began)/1000,clients:4,guns:4,maximumFields,fireKills,gasKills,gasChargesRemaining:charges,kills:clients[0].state.combat.kills,snapshots,bytes,maximumSnapshot,maximumRequestMs:Math.max(...times)};
  await writeFile('.local/hazards-runtime.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {abort.abort();await Promise.allSettled(readers);}
