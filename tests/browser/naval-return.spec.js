import {test,expect} from '@playwright/test';
import {checkNavalReturn} from '../helpers/naval-return-check.js';
import {navalRemoteFixture} from '../helpers/naval-remote-fixture.js';
for(const phone of [false,true])test('return to dock from '+(phone?'phone workshop':'desktop Remote'),async({browser},info)=>{
 test.setTimeout(90000);await checkNavalReturn(browser,phone,name=>info.outputPath(name+'.png'));
});

test('return completes the turn outside a tight dock corner',async({browser},info)=>{
 test.setTimeout(90000);await checkNavalReturn(browser,false,name=>info.outputPath(name+'.png'),{tightDock:true});
});

test('RMB on another friendly dock moors the ship there and keeps its home',async({browser})=>{
 test.setTimeout(90000);const f=await navalRemoteFixture({returning:true});let context;
 try{
  context=await browser.newContext({viewport:{width:1920,height:1080}});await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#remote-mode').click();const marker=page.locator('[data-remote-id="ship:ship"]'),other=page.locator('[data-remote-id="ship:carrier"]'),a=await marker.boundingBox(),b=await other.boundingBox();
  const scale=(a.x+a.width/2-b.x-b.width/2)/50,dock={x:a.x+a.width/2+7*scale,y:a.y+a.height/2+26*scale};
  await marker.click();await page.mouse.move(dock.x,dock.y);await page.mouse.click(dock.x,dock.y,{button:'right'});
  const ship=async()=>(await f.state()).ships.find(s=>s.id==='ship');
  await expect.poll(async()=>(await ship()).remoteOrder?.yardId).toBe('carrier');
  await expect.poll(async()=>(await ship()).remoteOrder.phase,{timeout:60000}).toBe('docked');
  const s=await ship();expect(Math.hypot(s.x-97.5,s.y-80.5)).toBeLessThan(.8);expect(s.dock.y).toBe(50.5);expect(errors).toEqual([]);
 }finally{await context?.close();await f.close();}
});
