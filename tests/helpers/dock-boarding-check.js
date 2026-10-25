import {expect} from '@playwright/test';
import {createApp} from '../../server.js';
import {createWorld} from '../../public/world.js';
import {freshLogistics} from '../../public/logistics.js';
import {shipyardSite,yardFromShip,linkYard} from '../../public/shipyard.js';
import {freshLife} from '../../public/survival.js';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

export async function checkDockBoarding(browser,mobile=false){
 const dir=await mkdtemp(path.join(tmpdir(),'frontier-dock-boarding-'));let app=createApp({dataDir:dir,logSink:()=>{}}),context,blockerContext,db;
 try{
  await app.close();db=new DatabaseSync(path.join(dir,'world.sqlite'));const token=randomUUID(),blockerToken=randomUUID();
  const w={...createWorld(),version:3,width:160,height:128,terrain:Array.from({length:160*128},(_,i)=>i%160<80?0:2),sites:[],ships:[],cores:[],tanks:[],rails:[],artillery:[],airbases:[],logistics:freshLogistics()};
  const site=shipyardSite(w,[],[],72,60,'pilot',2);expect(site.error).toBeNull();const yard=yardFromShip({...site.ship,id:'yard',elapsed:99});
  const ship={id:'carrier',kind:'carrier',owner:'pilot',x:yard.berthX+.504932617,y:yard.berthY+.713051326,angle:yard.dock.angle-.028638415,turret:yard.dock.angle,elapsed:99,health:600,occupant:'pilot'};linkYard(ship,yard);
  const l={...freshLogistics(),shipyards:[yard],wrecks:[{id:'old',kind:'carrier',navalScale:2,x:yard.berthX,y:yard.berthY,angle:yard.dock.angle}],recovery:{old:{id:'old',sourceId:'old',medium:'sea',x:yard.berthX,y:yard.berthY,amount:50}}};
  db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(w));db.prepare("UPDATE meta SET value=? WHERE key='logistics-v1'").run(JSON.stringify(l));db.prepare('INSERT INTO ships VALUES (?,?)').run(ship.id,JSON.stringify(ship));
  for(const [id,credential,x,y]of [['pilot',token,ship.x,ship.y],['blocker',blockerToken,yard.dock.x,yard.dock.y]]){
   db.prepare('INSERT INTO scouts VALUES (?,?,?,?,?,?)').run(credential,id,id,x,y,0);db.prepare('INSERT INTO robot_states VALUES (?,?)').run(id,JSON.stringify({...freshLife(),deployed:true}));
  }db.close();db=null;app=createApp({dataDir:dir,logSink:()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});await context.addCookies([{name:'frontier',value:token,url}]);
  blockerContext=await browser.newContext();await blockerContext.addCookies([{name:'frontier',value:blockerToken,url}]);const other=await blockerContext.newPage();await other.goto(url+'/?legacy=1');await expect(other.locator('#connection')).toContainText('live');
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/?legacy=1');await expect(p.locator('#connection')).toContainText('live');
  await expect(p.locator('#ship-manual')).toContainText('Docked: E ashore');await p.locator('#ship-interact').click();
  const state=async()=>await(await context.request.get(url+'/api/world')).json();await expect.poll(async()=>(await state()).me.body).toBe('robot');
  const before=await state();expect(Math.hypot(before.me.x-yard.dock.x,before.me.y-yard.dock.y)).toBeGreaterThanOrEqual(.8);expect(before.ships[0].occupant).toBeNull();expect(before.logistics.recovery.old.amount).toBe(50);
  await p.screenshot({path:'.local/dock-boarding-'+mobile+'.png'});await p.reload();await expect(p.locator('#connection')).toContainText('live');expect((await state()).me.body).toBe('robot');expect(errors).toEqual([]);
 }catch(error){console.error(error);throw error;}finally{db?.close();await blockerContext?.close();await context?.close();await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('frontier-dock-boarding-'))throw Error('Unsafe fixture path');await rm(dir,{recursive:true,force:true});}
}
