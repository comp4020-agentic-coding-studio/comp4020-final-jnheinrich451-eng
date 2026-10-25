import {expect} from '@playwright/test';
import {wreckRecoveryFixture} from './wreck-recovery-fixture.js';

export async function checkMusic(browser,mobile=false){
 const f=await wreckRecoveryFixture(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},isMobile:mobile,hasTouch:mobile});
 try{
  await context.addCookies([{name:'frontier',value:f.tokens[0],url:f.url}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/?legacy=1');await expect(page.locator('#connection')).toContainText('live');
  expect(await page.locator('#background-music').evaluate(a=>a.paused)).toBe(true);
  await page.locator('#help-button').click();
  await expect.poll(()=>page.locator('#background-music').evaluate(a=>!a.paused&&a.currentTime>0)).toBe(true);
  await expect.poll(()=>page.locator('#background-music').evaluate(a=>Number.isFinite(a.duration))).toBe(true);
  const meta=await page.locator('#background-music').evaluate(a=>({duration:a.duration,loop:a.loop,volume:a.volume}));
  expect(meta.duration).toBeGreaterThan(30);expect(meta.loop).toBe(true);expect(meta.volume).toBe(.25);
  const response=await context.request.get(f.url+'/audio/Apex_Of_Conquest.mp3');
  expect(response.headers()['content-type']).toBe('audio/mpeg');expect((await response.body()).length).toBe(4255518);
  if(!mobile)console.log('Decoded MP3',await page.evaluate(async()=>{
   const context=new AudioContext();
   try{
    const buffer=await context.decodeAudioData(await(await fetch('/audio/Apex_Of_Conquest.mp3')).arrayBuffer());
    const channel=buffer.getChannelData(0),threshold=.001;
    let start=0,end=channel.length-1;
    while(start<channel.length&&Math.abs(channel[start])<threshold)start++;
    while(end>start&&Math.abs(channel[end])<threshold)end--;
    return {duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,quietStart:start/buffer.sampleRate,quietEnd:(channel.length-1-end)/buffer.sampleRate};
   }finally{await context.close();}
  }));
  await page.locator('#music-volume').fill('40');
  await expect.poll(()=>page.locator('#background-music').evaluate(a=>a.volume)).toBe(.4);
  await page.locator('#music-toggle').click();expect(await page.locator('#background-music').evaluate(a=>a.paused)).toBe(true);
  await page.reload();await expect(page.locator('#connection')).toContainText('live');
  await page.locator('#help-button').click();await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed','false');
  expect(await page.locator('#background-music').evaluate(a=>a.paused)).toBe(true);await expect(page.locator('#music-volume')).toHaveValue('40');
  await page.locator('#music-toggle').click();await expect.poll(()=>page.locator('#background-music').evaluate(a=>!a.paused&&Number.isFinite(a.duration))).toBe(true);
  await page.locator('#background-music').evaluate(a=>{a.currentTime=a.duration-.2;});
  await expect.poll(()=>page.locator('#background-music').evaluate(a=>a.currentTime<2&&!a.paused),{timeout:10000}).toBe(true);
  // Dispatch browser visibility states deterministically in headless Chrome.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.locator('#background-music').evaluate(a=>a.paused)).toBe(true);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>page.locator('#background-music').evaluate(a=>!a.paused)).toBe(true);
  await page.screenshot({path:'.local/music-'+(mobile?'phone':'desktop')+'.png'});
  await page.keyboard.press('Escape');await expect(page.locator('#help-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);console.log('PASS music '+(mobile?'phone':'desktop'),meta);
 }finally{await context.close();await f.close();}
}
