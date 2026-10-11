import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { newAirbase } from '../../public/aircraft.js';

for (const mobile of [false, true]) test(`flak warning, steering escape and saved pilot recovery ${mobile ? 'phone' : 'desktop'}`, async ({ browser }, info) => {
  test.setTimeout(80000);
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-flak-')), contexts = [];
  const app = createApp({ dataDir: dir, logSink: () => {} });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    const owner = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1920,height:1080}, isMobile:mobile, hasTouch:mobile });
    const other = await browser.newContext(); contexts.push(owner, other);
    const post = async (c, route, data) => { const r = await c.request.post(origin+route,{data,headers:{Origin:origin}}); expect(r.status(),await r.text()).toBeLessThan(300); return r.json(); };
    const credentials = {name:'Flak pilot',kind:'demo',email:'flak@frontier.test',password:'unique flak test password 123!'};
    await post(owner,'/api/auth/register',credentials);
    const inbox = await (await owner.request.get(origin+'/api/auth/inbox')).json();
    await post(owner,'/api/auth/verify',{token:inbox.messages[0].href.split('#token=')[1]});await post(owner,'/api/auth/login',credentials);
    const {id} = await post(owner,'/api/campaigns/create',{name:'Flak rehearsal'});await post(owner,'/api/campaigns/enter',{id});
    const route=`/api/campaign-world/${id}`, state=async()=>(await owner.request.get(origin+route+'/world')).json();
    const initial=await state(), pilot=initial.me.id;
    const site=initial.combat.sites.find(s=>s.kind==='anti-air');expect(site).toBeTruthy();
    const plane=async()=>(await state()).airbases[0].aircraft;
    async function ready(health) {
      await post(owner,'/api/campaigns/leave',{});
      const db=new DatabaseSync(path.join(dir,'campaigns',id,'world.sqlite'));
      try {
        const world=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='world'").get().value);world.terrain.fill(2);
        db.prepare("UPDATE meta SET value=? WHERE key='world'").run(JSON.stringify(world));
        const saved=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
        saved.enemies=[];saved.flakShells=[];
        for(const s of saved.sites){s.guardsRemaining=0;s.pending=null;s.nextCall=1e9;if(s.id===site.id){s.x=60;s.y=40;delete s.aa;}else Object.assign(s,{hp:0,state:'conquered',conqueredAt:-100000});}
        db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
        db.prepare('INSERT OR IGNORE INTO cores VALUES (?,?,?,?,?)').run('recovery-core',pilot,10,10,99);
        const base=newAirbase('flak-base',pilot,20,66);
        Object.assign(base.aircraft,{health,state:'flying',x:61.5,y:60.5,speed:6,angle:0,leftBase:true,occupant:pilot});
        db.prepare('INSERT INTO airbases VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(base.id,JSON.stringify(base));
      } finally {db.close();}
      await post(owner,'/api/campaigns/enter',{id});
    }
    await ready(180);
    const page=await owner.newPage(),peer=await other.newPage(),errors=[];
    for(const p of [page,peer]){p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Original=window.EventSource;window.EventSource=class extends Original{constructor(...args){super(...args);this.addEventListener('message',e=>{try{window.lastBattle=JSON.parse(e.data);}catch{}});}};});}
    await page.goto(origin+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
    await expect(page.locator('#aircraft-status')).toContainText('INCOMING FLAK');
    // Use actual keyboard or touch steering while the fixed burst is pending.
    await page.locator('#world-canvas').focus();
    if(mobile){const b=await page.locator('[data-direction="right"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();}
    else await page.keyboard.down('d');
    try {
      await expect.poll(async()=>Math.abs((await plane()).angle)).toBeGreaterThan(.8);
      const panel=await page.locator('#aircraft-controls').boundingBox();
      expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(page.viewportSize().width);
      await expect(page.locator('#aircraft-readout')).toContainText('HULL 180/180');
      await page.screenshot({path:info.outputPath('flak-evasion.png')});
      await expect.poll(async()=>(await state()).combat.flakShells.some(s=>s.impacted),{timeout:5000,intervals:[50]}).toBe(true);
      expect((await plane()).health).toBe(180);
    } finally {if(mobile)await page.mouse.up();else await page.keyboard.up('d');}
    // Restart the isolated encounter with a damaged plane to exercise loss quickly.
    await page.goto('about:blank');await ready(40);await page.goto(origin+'/?campaign='+id);await expect(page.locator('#connection')).toContainText('live');
    const invite=await post(owner,'/api/campaigns/invite',{id});const joined=await post(other,'/api/campaigns/join',{code:invite.code});
    await peer.goto(origin+joined.next);await expect(peer.locator('#connection')).toContainText('live');await page.bringToFront();
    await page.getByRole('button',{name:'Locate anti-air outpost'}).click();await expect(page.locator('#combat-status')).toContainText('Spore flak');
    await expect(page.locator('#recovery-title')).toHaveText('Bomber shot down',{timeout:7000});
    await expect.poll(()=>peer.evaluate(()=>window.lastBattle?.airbases[0].aircraft.state)).toBe('destroyed');
    expect((await plane()).occupant).toBeNull();await page.screenshot({path:info.outputPath('bomber-shot-down.png')});
    // Close and reopen the saved runtime while replacement is pending.
    await post(owner,'/api/campaigns/leave',{});await page.waitForURL('**/campaigns/');await post(owner,'/api/campaigns/enter',{id});
    expect((await state()).me).toMatchObject({life:'disabled',lostVehicle:'aircraft'});
    expect((await plane()).state).toBe('destroyed');
    await page.goto(origin+'/?campaign='+id);await expect(page.locator('#recovery-panel')).toBeVisible();
    await page.locator('#recovery-core').selectOption('recovery-core');await expect(page.locator('#revive-button')).toBeEnabled({timeout:5000});await page.locator('#revive-button').click();
    await expect(page.locator('#recovery-panel')).toBeHidden({timeout:5000});expect((await state()).me).toMatchObject({body:'robot',life:'active',health:100});
    await expect.poll(async()=>(await plane()).state,{timeout:22000}).toBe('parked');expect(await plane()).toMatchObject({health:180,runs:2,occupant:null,x:22,y:73.5});
    if(!mobile){await page.setViewportSize({width:900,height:700});}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);expect(errors).toEqual([]);
  } finally {await Promise.all(contexts.map(c=>c.close()));await app.close();await rm(dir,{recursive:true,force:true});}
});
