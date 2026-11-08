import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';

// Read-only preview server: no game server, accounts, or campaign access.
const root = resolve('public');
const out = resolve('output/enemy-review');
await mkdir(out, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><title>Frontier enemy reference</title>
<style>body{margin:0;background:#121b22;color:#efe8d7;font-family:Arial,sans-serif}section{padding:38px;width:1364px;box-sizing:border-box}h1{font-size:34px;margin:0 0 10px}p{color:#b8c5c8;margin:0 0 25px;font-size:17px;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{background:#202c35;border:1px solid #40505a;border-radius:12px;overflow:hidden}h2{font-size:22px;margin:17px 20px 7px}.role{font-size:15px;margin:0 20px 10px;height:20px;color:#ddc296}canvas{display:block;width:100%;height:230px;background:#b2b0a0}.source{font:12px monospace;color:#b8c5c8;padding:12px 20px}.structures .grid{grid-template-columns:repeat(4,1fr)}.structures canvas{height:260px}.structures h2{font-size:20px}.structures .role{font-size:13px}.note{padding:25px 5px 0;font-size:15px}</style>
<section id="mobile"><h1>FRONTIER / Existing mobile enemies</h1><p>Current Canvas artwork, rendered directly from the game source • 08 November 2026<br>Neutral background, fixed pose; enlarged individually for inspection. Sizes between cards are not to scale.</p><div class="grid"></div><p class="note">01–09 are reference IDs for this review. Bile Spitter is a Swimmer variant. No redesigns are shown here.</p></section>
<section id="structures" class="structures"><h1>FRONTIER / Existing hostile structures</h1><p>Current game renderer, including rooted bases • 08 November 2026<br>Normal healthy state; combat labels and health bars hidden for art inspection.</p><div class="grid"></div><p class="note">10–16 are reference IDs for this review. These structures are separate from the mobile enemy roster.</p></section>
<script type="module">
import { drawCrawler } from '/effects.js';
import { drawSkimmer } from '/skimmer-art.js';
import { drawCentipede } from '/centipede-art.js';
import { drawSwimmer } from '/vehicle-effects.js';
import { drawBileSpitter } from '/aquatic-effects.js';
import { drawConquest } from '/conquest-effects.js';
import { makeSite } from '/conquest.js';
const units=[
['01','Hunter','Fast melee hunter','hunter','effects.js',2.5],
['02','Breaker','Heavy melee attacker','breaker','effects.js',2],
['03','Bulwark','Armored melee attacker','bulwark','effects.js',1.8],
['04','Twin lens','Mobile anti-air / twin lenses','twin-lens','mobile-laser-effects.js',2.4],
['05','Heavy lens','Heavy mobile anti-air / single lens','heavy-lens','mobile-laser-effects.js',2.1],
['06','Skimmer','Flying bile attacker','skimmer','skimmer-art.js',1.15],
['07','Siege centipede','Eight-segment armored nursery','centipede','centipede-art.js',1.05],
['08','Swimmer','Aquatic melee attacker','swimmer','vehicle-effects.js',3],
['09','Bile spitter','Aquatic ranged variant','bile-spitter','aquatic-effects.js',2.6]];
function card(section,id,name,role,source){const el=document.createElement('article');el.className='card';el.innerHTML='<h2>'+id+' / '+name+'</h2><div class="role">'+role+'</div><canvas width="820" height="460"></canvas><div class="source">'+source+'</div>';document.querySelector('#'+section+' .grid').append(el);return el.querySelector('canvas');}
window.artCanvases=[];
for(const [id,name,role,kind,source,scale] of units){
 const canvas=card('mobile',id,name,role,source),c=canvas.getContext('2d');c.scale(2,2);c.translate(205,kind==='skimmer'?82:118);c.scale(scale,scale);
 const e={id:2,kind,x:0,y:0,angle:0,hp:100,maxHp:100,behavior:'patrolling',airLaser:{phase:'watching',angle:0},height:2.5};
 if(kind==='skimmer')drawSkimmer(c,e,0,48,true);
 else if(kind==='centipede'){e.angle=-Math.PI/2;e.body=Array.from({length:8},(_,i)=>({x:-2.625+i*.75,y:0,angle:-Math.PI/2}));drawCentipede(c,e,0,48,true);}
 else if(kind==='swimmer')drawSwimmer(c,e,0,48,true);
 else if(kind==='bile-spitter')drawBileSpitter(c,{...e,kind:'swimmer',variant:'bile-spitter'},0,48,true);
 else drawCrawler(c,e,0);
 window.artCanvases.push([id+'-'+kind,canvas]);
}
const sites=[['10','Sensory crown','Detection and defender alerts','alert'],['11','Bile mortar','Lobbed acid artillery','mortar'],['12','Blight root','Terrain alteration / centipede source','modifier'],['13','Lance tower','Fixed beam weapon','laser'],['14','Spore flak','Fixed anti-air weapon','anti-air'],['15','Air contaminator','Air contamination emitter','contaminator'],['16','Aquatic hive','Regeneration / aquatic production','aquatic-hive']];
for(const [id,name,role,kind] of sites){const canvas=card('structures',id,name,role,'conquest-effects.js + body renderer');canvas.width=600;canvas.height=520;const c=canvas.getContext('2d');c.scale(2,2);c.translate(150,133);
 // Keep the complete original body renderer; suppress only its HUD text/bars.
 const drawContext=new Proxy(c,{get(target,key){if(key==='fillText')return ()=>{};if(key==='fillRect')return (...args)=>{if(Math.abs(target.getTransform().a)>3)target.fillRect(...args);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){return Reflect.set(target,key,value,target);}});
 drawConquest(drawContext,[makeSite(kind,id,-1.5,-1.5)],53,1,5000,true,null,[],{});window.artCanvases.push([id+'-'+kind,canvas]);}
window.ready=true;
</script>`;
await writeFile(resolve(out,'reference.html'),html);
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.writeHead(403).end();return;}res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready,{timeout:20000});
 for(const section of ['mobile','structures'])await page.locator('#'+section).screenshot({path:resolve(out,'existing-'+section+'-v1.png')});
 const images=await page.evaluate(()=>window.artCanvases.map(([name,c])=>({name,data:c.toDataURL().split(',')[1]})));
 for(const {name,data} of images)await writeFile(resolve(out,name+'.png'),Buffer.from(data,'base64'));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(JSON.stringify({output:out,cards:images.length,browserErrors:errors},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
