import { COLONY, cropById, bedReady } from './colonization.js';
import { COLONY_DEPTH, projectColonyPoint, colonyScreenToWorld, colonyWorldToScreen, colonyVisibleBounds } from './colony-view.js';
import { drawColonyRobot } from './colony-robot.js';
import { colonyPlanetById } from './colony-planets.js';
import { drawCampfireBase, drawCampfire, drawCinemaBase, drawCinema, createColonyAtmosphere } from './colony-ambience-art.js';

const TAU = Math.PI * 2;
const hash = (x,y,salt=0) => { const n=Math.sin(x*127.1+y*311.7+salt*73.3)*43758.5453;return n-Math.floor(n); };
const palette = template => colonyPlanetById(template)?.surface ?? (template==='sirocco-v1'
  ? {water:'#a5c9c0',shore:'#ead0a2',land:'#d9c395',dark:'#b6a77f',leaf:'#819d86',bloom:'#c99d9e'}
  : template==='vesper-v1'
    ? {water:'#a0c5c9',shore:'#ded6b9',land:'#b4c5b2',dark:'#819f89',leaf:'#71927f',bloom:'#bba7c4'}
    : {water:'#a3c9c5',shore:'#e3d6b4',land:'#bdcfa3',dark:'#8ca67c',leaf:'#78996b',bloom:'#d9ae8c'});
const metal={ink:'#52616a',dark:'#44525a',shade:'#bdc8c6',side:'#d2dcd7',white:'#f0f2eb',light:'#fffef2',gold:'#bc9a5c',violet:'#aaa0bc',joint:'#3f535b',glass:'#8fbec3',cyan:'#b6e4df'};
const pt=(x,y,z=0)=>{const p=projectColonyPoint(x,y,z);return[p.x,p.y];};
function rounded(c,x,y,w,h,r,fill,stroke,width=.025){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill,rotation=0){c.beginPath();c.ellipse(x,y,Math.max(.001,rx),Math.max(.001,ry),rotation,0,TAU);c.fillStyle=fill;c.fill();}
function line(c,points,color,width=.025){if(!points.length)return;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function polygon(c,points,fill,stroke=metal.ink,width=.022){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
function poly3(c,points,fill,stroke,width){polygon(c,points.map(p=>pt(...p)),fill,stroke,width);}
function line3(c,points,color,width){line(c,points.map(p=>pt(...p)),color,width);}
function groundEllipse(c,x,y,rx,ry,fill){ellipse(c,x,y*COLONY_DEPTH,rx,ry*COLONY_DEPTH,fill);}
function slab(c,x,y,halfX,halfY,z,fill=metal.white){
  poly3(c,[[x-halfX,y+halfY,0],[x+halfX,y+halfY,0],[x+halfX,y+halfY,z],[x-halfX,y+halfY,z]],metal.shade,metal.ink);
  poly3(c,[[x-halfX,y-halfY,z],[x+halfX,y-halfY,z],[x+halfX,y+halfY,z],[x-halfX,y+halfY,z]],fill,metal.ink);
  line3(c,[[x-halfX+.05,y-halfY+.05,z+.01],[x+halfX-.06,y-halfY+.06,z+.01]],metal.light,.025);
}
// Shared chamfered shells keep the fixed-view machinery in the worker's family.
function machineBox(c,x,y,hx,hy,z,height,fill=metal.white,edge=.09){
  const b=Math.min(edge,hx*.4,hy*.4),outline=[[-hx+b,-hy],[hx-b,-hy],[hx,-hy+b],[hx,hy-b],[hx-b,hy],[-hx+b,hy],[-hx,hy-b],[-hx,-hy+b]];
  for(let i=0;i<outline.length;i++){
    const a=outline[i],d=outline[(i+1)%outline.length];
    poly3(c,[[x+a[0],y+a[1],z],[x+d[0],y+d[1],z],[x+d[0],y+d[1],z+height],[x+a[0],y+a[1],z+height]],i===4?metal.shade:i<4?metal.dark:metal.side,metal.ink,.018);
  }
  poly3(c,outline.map(([dx,dy])=>[x+dx,y+dy,z+height]),fill,metal.ink,.022);
  line3(c,[[x-hx+b,y-hy+.025,z+height+.01],[x+hx-b,y-hy+.025,z+height+.01]],metal.light,.028);
  line3(c,[[x-hx+.025,y-hy+b,z+height+.01],[x-hx+.025,y+hy-b,z+height+.01]],'#fffef2ba',.019);
}
function frontPanel(c,x,y,z,w,h,fill=metal.joint,cut=.04){
  poly3(c,[[x-w/2+cut,y,z],[x+w/2-cut,y,z],[x+w/2,y,z+cut],[x+w/2,y,z+h-cut],[x+w/2-cut,y,z+h],[x-w/2+cut,y,z+h],[x-w/2,y,z+h-cut],[x-w/2,y,z+cut]],fill,metal.ink,.018);
}
function frontVent(c,x,y,z,w,h,count=4){
  frontPanel(c,x,y,z,w,h,metal.joint,.03);
  for(let i=0;i<count;i++){const vz=z+(i+.5)*h/count;line3(c,[[x-w*.39,y+.008,vz],[x+w*.39,y+.008,vz]],'#a7b7b6',.022);}
}
function leaf(c,x,y,size,angle,color){c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-size*.6,-size*.45,0,-size);c.quadraticCurveTo(size*.6,-size*.45,0,0);c.fillStyle=color;c.fill();c.strokeStyle='#506e4338';c.lineWidth=.014;c.stroke();c.restore();}
function blossom(c,x,y,size,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);for(let i=0;i<5;i++){const a=i*TAU/5;ellipse(c,Math.cos(a)*size*.56,Math.sin(a)*size*.56,size*.42,size*.28,color,a);}ellipse(c,0,0,size*.27,size*.27,'#f5e4a0');c.restore();}

// Stable brushwork is generated once; it never flickers or jitters between frames.
function terrainCache(world){
  const buffer=document.createElement('canvas'),tile=32,p=palette(world.template);buffer.width=world.width*tile;buffer.height=world.height*tile;
  const c=buffer.getContext('2d');c.scale(tile,tile);c.fillStyle=p.water;c.fillRect(0,0,world.width,world.height);
  const kindAt=(x,y)=>x>=0&&y>=0&&x<world.width&&y<world.height?world.terrain[y*world.width+x]:0;
  c.beginPath();for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++)if(kindAt(x,y))c.rect(x,y,1.006,1.006);
  c.save();c.clip();c.fillStyle=p.land;c.fillRect(0,0,world.width,world.height);
  const colonyWorld=!!colonyPlanetById(world.template),nacre=world.template==='nacre-v1',aurelia=world.template==='aurelia-v1';
  for(let y=0;y<world.height;y+=3)for(let x=0;x<world.width;x+=3){const n=hash(x,y,15);ellipse(c,x+hash(x,y,8)*2,y+hash(x,y,9)*2,2+n*2.3,1.1+n*1.6,n>.45?(nacre?'#e8e7f321':'#f8edc222'):(nacre?'#8e91ad17':aurelia?'#a6935f15':'#71977712'),n*.5);}
  if(aurelia)for(let row=1;row<world.height;row+=3.2){
    const points=Array.from({length:world.width*2},(_,i)=>{const x=i*.5;return[x,row+Math.sin(x*.18+row*.26)*.72];});
    line(c,points,'#947e4e20',.12);line(c,points.map(([x,y])=>[x,y-.09]),'#fff0c333',.07);
  }
  for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++){
    const kind=kindAt(x,y),n=hash(x,y);
    if(kind===1){c.fillStyle=p.shore;c.fillRect(x,y,1.004,1.004);if(n>.45)ellipse(c,x+.5,y+.55,.45,.10,'#f9edcf35',n-.5);}
    if(kind&&n<.20){const px=x+.15+hash(x,y,2)*.7,py=y+.3+hash(x,y,3)*.4;line(c,[[px-.05,py],[px-.09,py-.1],[px,py],[px+.035,py-.13]],kind===1?'#b5a68055':p.dark+'55',.018);}
    if(colonyWorld&&kind===2&&n>.63&&n<.70){
      const px=x+.35,py=y+.65;
      if(nacre){ellipse(c,px,py,.28,.10,'#e6dce928');line(c,[[px-.10,py],[px-.06,py-.27],[px+.02,py],[px+.12,py-.24]],'#8d91a447',.022);}
      else if(aurelia)for(let i=0;i<3;i++){const xx=px+i*.07;line(c,[[xx,py],[xx+.05,py-.20]],'#ac955744',.018);ellipse(c,xx+.05,py-.22,.025,.055,'#f2df9d77',.2);}
      else{leaf(c,px,py,.23,-.65,p.dark+'44');leaf(c,px+.05,py,.21,.8,p.leaf+'55');}
    }
    if(kind&&n>.89){ellipse(c,x+.4,y+.6,.028,.021,'#f7edce99');ellipse(c,x+.66,y+.34,.020,.016,'#fcf3d877');}
    if(kind)for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])if(!kindAt(x+dx,y+dy)){
      const edge=dx?[[x+(dx>0?.96:.04),y],[x+(dx>0?.96:.04),y+1]]:[[x,y+(dy>0?.96:.04)],[x+1,y+(dy>0?.96:.04)]];
      line(c,edge,'#f4e9ca',.11);line(c,edge,'#8da99b66',.018);
    }
  }
  c.restore();for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++)if(!kindAt(x,y)){
    if(hash(x,y)>.80)line(c,[[x+.12,y+.55],[x+.35,y+.59],[x+.62,y+.55]],'#e5eee345',.027);
    if(nacre&&hash(x,y,27)>.77&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>kindAt(x+dx,y+dy))){ellipse(c,x+.48,y+.52,.23,.15,'#a5c8b6',.2);line(c,[[x+.48,y+.52],[x+.66,y+.44]],'#719e9888',.02);blossom(c,x+.43,y+.46,.08,'#e1c7d4');}
  }
  return buffer;
}
// Each new destination has its own local vegetation silhouette as well as color.
function colonyPlant(c,x,y,p,time,template){
  const n=hash(x,y,4),a=hash(x,y,5)*TAU,[sx,sy]=pt(x,y),tall=n>(template==='nacre-v1'?.67:.75);
  groundEllipse(c,x+.13,y+.12,tall?.75:.22,tall?.39:.13,'#59724421');c.save();c.translate(sx,sy);
  if(tall&&template==='nacre-v1'){
    line(c,[[0,.03],[.03,-1.03]],'#879ca6',.14);line(c,[[-.025,.01],[.005,-1.03]],'#eee2da',.065);
    c.beginPath();c.moveTo(-.79,-.78);c.bezierCurveTo(-.74,-1.22,-.24,-1.49,.05,-1.45);c.bezierCurveTo(.43,-1.42,.77,-1.20,.81,-.80);c.quadraticCurveTo(.40,-.65,0,-.70);c.quadraticCurveTo(-.41,-.63,-.79,-.78);c.fillStyle='#a7a6c1';c.fill();c.strokeStyle='#7a8b9b';c.lineWidth=.024;c.stroke();
    for(const dx of[-.54,-.28,0,.28,.54])line(c,[[dx,-.80],[dx*.60,-1.22]],'#e3dbe475',.018);
    line(c,[[-.68,-.81],[-.27,-.74],[.20,-.76],[.68,-.82]],'#f3e8e3',.032);
    for(const[dx,dy]of[[-.33,-1.10],[.21,-1.20],[.51,-.99]])ellipse(c,dx,dy,.07,.04,'#e7d4db');
    line(c,[[.48,.02],[.48,-.35]],'#d8d9d1',.07);ellipse(c,.48,-.36,.29,.13,'#a6c1be');
  }else if(tall&&template==='aurelia-v1'){
    line(c,[[-.03,.02],[-.04,-.70],[.03,-1.10]],'#8d8066',.16);line(c,[[0,.01],[.015,-.69],[.065,-1.09]],'#d4bd8e',.075);
    for(let i=0;i<7;i++){const ang=-1.35+i*.45;leaf(c,.04,-.91,.85,ang,p.leaf);}
    for(let i=0;i<5;i++)leaf(c,.04,-.94,.67,-1.05+i*.52,'#c9c583');
    line(c,[[-.57,-1.18],[-.16,-1.55],[.24,-1.43]],'#f0dfab80',.025);
    for(const dx of[-.12,.08,.25])ellipse(c,dx,-.79,.068,.09,p.bloom);
  }else if(tall){
    line(c,[[-.03,.03],[0,-.83]],'#7b8270',.14);line(c,[[.02,.02],[.04,-.83]],'#c5b89a',.065);
    polygon(c,[[-.65,-.57],[-.77,-.90],[-.59,-1.14],[-.29,-1.30],[.08,-1.33],[.49,-1.16],[.70,-.88],[.56,-.53],[.14,-.43],[-.31,-.46]],p.leaf,'#647e64',.025);
    ellipse(c,-.20,-1.02,.42,.23,'#a3bf91');ellipse(c,.30,-.73,.29,.23,'#82a47d');
    for(const[dx,dy]of[[-.45,-.94],[-.12,-1.19],[.31,-1.04],[.46,-.64],[-.25,-.59]])blossom(c,dx,dy,.095,p.bloom,dx);
    line(c,[[-.62,-.88],[-.35,-1.02],[-.05,-1.00]],'#e7e5bd66',.025);
  }else if(template==='nacre-v1'){
    const sway=Math.sin(time+x)*.025;for(let i=0;i<3;i++){const dx=(i-1)*.11;line(c,[[dx,.03],[dx+sway,-.28-i*.035]],'#869ba5',.028);ellipse(c,dx+sway,-.29-i*.035,.065,.075,i===1?'#e3c5d7':'#bdc7d1');}leaf(c,0,0,.26,.8,p.leaf);leaf(c,-.05,.02,.22,-.6,p.leaf);
  }else if(template==='aurelia-v1'){
    for(let i=0;i<4;i++){const dx=(i-1.5)*.055,sway=Math.sin(time+x+i)*.025;line(c,[[dx,.03],[dx+sway,-.26]],p.dark,.019);ellipse(c,dx+sway,-.29,.035,.075,'#efe0ad',.15);}
  }else{
    const sway=Math.sin(time*1.1+x)*.025;line(c,[[0,.02],[sway,-.22]],p.dark,.022);leaf(c,0,.01,.18,.85,p.leaf);leaf(c,0,.01,.16,-.8,p.leaf);blossom(c,sway,-.25,.12,n>.45?p.bloom:'#f4e8bc',a);
  }
  c.restore();
}
function wildPlant(c,x,y,p,time,template){
  if(colonyPlanetById(template)){colonyPlant(c,x,y,p,time,template);return;}
  const n=hash(x,y,4),a=hash(x,y,5)*TAU,[sx,sy]=pt(x,y);groundEllipse(c,x+.13,y+.12,n>.8?.64:.19,n>.8?.35:.12,'#59724421');c.save();c.translate(sx,sy);
  if(n>.8){
    if(template==='sirocco-v1'){
      for(let i=0;i<7;i++)leaf(c,0,-.07,.69,a+i*TAU/7,p.leaf);for(let i=0;i<4;i++)leaf(c,0,-.08,.43,a+i*TAU/4,'#aebfa0');blossom(c,0,-.20,.13,p.bloom);
    }else if(template==='vesper-v1'){
      line(c,[[0,.02],[.02,-.77]],'#8b8e81',.13);line(c,[[-.025,.01],[-.005,-.76]],'#ddd3b8',.065);
      polygon(c,[[-.62,-.70],[-.41,-.97],[.04,-1.11],[.43,-.94],[.62,-.73],[.34,-.62],[-.27,-.60]],'#b9abc0','#778c7b',.022);
      line(c,[[-.53,-.71],[-.10,-.73],[.34,-.67],[.52,-.73]],'#e5d9e1',.028);
      for(const[dx,dy]of[[-.25,-.87],[.15,-.94],[.35,-.78]])ellipse(c,dx,dy,.055,.035,'#e8ddd9');line(c,[[.45,.14],[.45,-.23]],'#d7cdb6',.075);ellipse(c,.45,-.24,.27,.15,'#aaafbc');
    }else{
      line(c,[[-.03,.04],[.01,-.83]],'#778369',.13);line(c,[[0,.02],[.035,-.83]],'#ae9878',.065);
      polygon(c,[[-.63,-.52],[-.69,-.87],[-.49,-1.12],[-.17,-1.21],[.10,-1.30],[.47,-1.12],[.64,-.85],[.56,-.51],[.18,-.39],[-.27,-.41]],p.leaf,'#667f5d',.025);
      ellipse(c,-.20,-.96,.38,.23,'#a5bc8a');ellipse(c,.29,-.70,.29,.24,'#8ba779');line(c,[[-.51,-.81],[-.28,-.92],[-.02,-.90]],'#dde2ad66',.024);blossom(c,.24,-1.02,.11,'#e8c4a2');blossom(c,-.39,-.63,.075,'#f1e4bd');
    }
  }else{const sway=Math.sin(time*1.1+x)*.025;line(c,[[0,.02],[sway,-.18]],p.dark,.022);leaf(c,0,-.01,.16,.9,p.leaf);leaf(c,0,-.02,.14,-1,p.leaf);blossom(c,sway,-.21,.10,n>.4?p.bloom:'#f4e8b9',a);}
  c.restore();
}
function drawRock(c,x,y){groundEllipse(c,x+.12,y+.18,.46,.29,'#65796722');poly3(c,[[x-.42,y+.27,0],[x+.34,y+.29,0],[x+.41,y-.11,.28],[x+.13,y-.32,.43],[x-.25,y-.30,.35],[x-.45,y-.01,.18]],'#acb5a4','#7e8e7e',.022);line3(c,[[x-.25,y-.30,.36],[x-.06,y+.03,.40],[x+.41,y-.11,.29]],'#e0e2cc',.025);}
function drawHub(c,hub){
  const{x,y}=hub;groundEllipse(c,x+.20,y+.28,1.35,1.02,'#516b5730');
  for(const dx of[-.91,.91])for(const dy of[-.84,.88])machineBox(c,x+dx,y+dy,.18,.18,.025,.12,metal.dark,.05);
  machineBox(c,x,y,1.12,1.08,.12,.15,metal.dark,.13);
  machineBox(c,x,y,1.06,1.02,.27,.35,metal.white,.13);
  // A translucent cultivation vault sits within the white service chassis.
  const arch=(t,depth)=>[x+Math.cos(t)*.86,y+depth,.67+Math.sin(t)*1.10];
  for(let i=0;i<8;i++){const a=Math.PI-i*Math.PI/8,b=Math.PI-(i+1)*Math.PI/8;poly3(c,[arch(a,-.89),arch(b,-.89),arch(b,.81),arch(a,.81)],i<4?'#a9cfd0':'#8db4bb','#789d9f',.014);}
  for(const dx of[-.57,-.22,.21,.56]){
    const[tx,ty]=pt(x+dx,y+.72,.75);rounded(c,tx-.13,ty-.02,.26,.14,.025,'#698778');leaf(c,tx,ty,.24,-.5,'#779d69');leaf(c,tx,ty,.29,.55,'#a9bf83');
  }
  const front=[...Array.from({length:17},(_,i)=>arch(Math.PI-i*Math.PI/16,.83)),[x-.86,y+.83,.67]];poly3(c,front,'#d1ebde38',metal.ink,.025);
  for(const depth of[-.9,-.34,.26,.84]){
    const points=Array.from({length:21},(_,i)=>arch(Math.PI-i*Math.PI/20,depth));line3(c,points,metal.dark,.082);line3(c,points.map(([ax,ay,az])=>[ax-.014,ay-.008,az+.034]),metal.white,.048);
  }
  for(const t of[Math.PI*.30,Math.PI*.73])line3(c,[arch(t,-.87),arch(t,.80)],'#f1fff0b8',.024);
  line3(c,[arch(Math.PI*.66,-.80),arch(Math.PI*.66,-.11)],'#fffef2cf',.038);
  // Continuous side sleeves and exposed hinges make the glass enclosure modular.
  for(const side of[-1,1]){
    machineBox(c,x+side*.94,y-.02,.15,.94,.50,.24,side<0?metal.white:metal.side,.07);
    for(const dy of[-.72,.56]){const[px,py]=pt(x+side*.94,y+dy,.77);ellipse(c,px,py,.073,.051,metal.dark);ellipse(c,px,py,.035,.025,metal.violet);}
  }
  machineBox(c,x+.93,y-.58,.22,.29,.66,.53,metal.white,.08);
  frontVent(c,x+.93,y-.28,.78,.30,.28,4);
  poly3(c,[[x+.79,y-.81,1.20],[x+1.07,y-.81,1.20],[x+1.07,y-.56,1.20],[x+.79,y-.56,1.20]],metal.violet,metal.ink,.016);
  line3(c,[[x+.87,y-.78,1.21],[x+.87,y-.78,1.98]],metal.dark,.04);
  line3(c,[[x+.87,y-.78,1.60],[x+.87,y-.78,1.91]],metal.white,.061);
  const[ax,ay]=pt(x+.87,y-.78,2.0);ellipse(c,ax,ay,.052,.034,metal.gold);
  // Front service pods flank a recessed, chamfered airlock.
  for(const side of[-1,1])machineBox(c,x+side*.77,y+.91,.25,.18,.28,.45,metal.white,.07);
  frontVent(c,x-.77,y+1.10,.39,.35,.24,3);
  frontPanel(c,x+.77,y+1.10,.38,.35,.25,metal.violet,.035);
  const[ix,iy]=pt(x+.77,y+1.115,.46);c.fillStyle='#795f31';c.font='.105px "IBM Plex Mono",monospace';c.textAlign='center';c.fillText('M / 01',ix,iy);
  line3(c,[[x-1.00,y+1.11,.26],[x-.52,y+1.11,.26]],metal.dark,.055);line3(c,[[x+.52,y+1.11,.26],[x+1,y+1.11,.26]],metal.dark,.055);
  frontPanel(c,x,y+1.035,.19,.91,1.0,metal.white,.13);
  frontPanel(c,x,y+1.045,.27,.65,.76,metal.joint,.08);
  frontPanel(c,x-.153,y+1.055,.31,.278,.66,'#708b91',.045);frontPanel(c,x+.153,y+1.055,.31,.278,.66,'#627b83',.045);
  line3(c,[[x,y+1.07,.31],[x,y+1.07,.95]],metal.dark,.027);
  for(const dx of[-.15,.15])line3(c,[[x+dx-.078,y+1.07,.84],[x+dx+.078,y+1.07,.84]],metal.cyan,.075);
  line3(c,[[x-.10,y+1.075,.55],[x-.10,y+1.075,.64]],metal.gold,.035);
  line3(c,[[x-.27,y+1.075,1.08],[x+.27,y+1.075,1.08]],metal.violet,.055);
  machineBox(c,x,y+1.17,.41,.14,.04,.12,metal.shade,.06);
  line3(c,[[x-.31,y+1.22,.17],[x+.31,y+1.22,.17]],metal.light,.033);
}
function drawCrop(c,cropId,x,y,growth,time,seed,ready,reduced){
  const crop=cropById(cropId);if(!crop)return;const f=Math.min(1,growth/crop.growTime),s=.35+f*.65,sway=reduced?0:Math.sin(time*1.6+seed)*.027,[sx,sy]=pt(x,y,.17);
  c.save();c.translate(sx,sy);c.rotate(sway);c.scale(s,s);ellipse(c,.04,.04,.28,.10,'#514a3625');
  if(f<.2){leaf(c,0,.04,.30,-.75,'#94ac73');leaf(c,0,.04,.24,.7,'#b2c68b');line(c,[[0,.1],[0,-.1]],'#688c53',.025);}
  else if(cropId==='sundrop'){
    for(const[a,l,col]of[[-1.2,.43,'#839e5b'],[1,.42,'#a0b875'],[-.3,.44,'#acc482'],[.3,.32,'#789850']])leaf(c,0,.04,l,a,col);
    if(f>.43){ellipse(c,0,-.12,.18+f*.06,.18+f*.07,ready?'#edb24f':'#baca7d');line(c,[[-.19,-.10],[-.13,-.27],[.02,-.34]],'#7f794c88',.018);ellipse(c,-.06,-.2,.055,.07,ready?'#f5d688':'#d4dfa4');line(c,[[0,-.34],[.04,-.4]],'#729557',.025);}
  }else if(cropId==='moonberry'){
    ellipse(c,0,-.13,.34,.30,'#84a67e');ellipse(c,-.17,-.27,.21,.18,'#9db78d');ellipse(c,.15,-.04,.21,.19,'#749b76');if(f>.4)for(let i=0;i<5;i++){const a=i*2.4+seed,bx=Math.sin(a)*.21,by=-.12+Math.cos(a)*.19;ellipse(c,bx,by,.075+f*.025,.085+f*.025,ready?'#a88abd':'#c5bbbc');ellipse(c,bx-.025,by-.03,.025,.025,'#ead7e9');}
  }else{for(let i=0;i<4;i++)leaf(c,0,.06,.45,i*TAU/4,'#95aa70');if(f>.38){ellipse(c,0,-.08,.23+f*.08,.23+f*.09,ready?'#bbce85':'#a6bd7b');for(const dx of[-.12,0,.12]){c.beginPath();c.ellipse(dx*.3,-.08,.12+Math.abs(dx),.26,0,-1.2,1.2);c.strokeStyle=ready?'#e5e9b1':'#c5d493';c.lineWidth=.022;c.stroke();}leaf(c,0,-.36,.16,.7,'#719458');}}
  if(ready){const b=reduced?0:(Math.sin(time*1.8+seed)+1)*.5;ellipse(c,.32,-.37,.025+b*.009,.025+b*.009,'#fff4c8');}c.restore();
}
function drawBedBase(c,bed,selected){
  const x=bed.x+.5,y=bed.y+.5;groundEllipse(c,x+.08,y+.13,1.57,1.12,'#53674720');
  machineBox(c,x,y,1.45,1.45,.015,.055,metal.dark,.09);machineBox(c,x,y,1.47,1.47,.07,.09,metal.white,.11);
  poly3(c,[[x-1.28,y-1.28,.17],[x+1.28,y-1.28,.17],[x+1.28,y+1.28,.17],[x-1.28,y+1.28,.17]],bed.water>0?'#92795f':'#ac9678','#7c7965',.018);
  for(let row=0;row<3;row++){const cy=y+(row-1)*.77;poly3(c,[[x-1.17,cy-.27,.18],[x+1.17,cy-.27,.18],[x+1.17,cy+.27,.18],[x-1.17,cy+.27,.18]],bed.water>0?'#81684e':'#9e8466',null);line3(c,[[x-1.08,cy+.11,.19],[x+1.06,cy+.12,.19]],'#574e3928',.022);}
  // Recessed irrigation lines and four substantial white corner clamps.
  for(const dx of[-1.35,1.35]){
    line3(c,[[x+dx,y-1.20,.19],[x+dx,y+1.20,.19]],metal.joint,.04);
    for(const dy of[-.77,0,.77])line3(c,[[x+dx,y+dy,.20],[x+Math.sign(dx)*1.20,y+dy,.20]],bed.water>0?metal.glass:metal.shade,.035);
  }
  for(const dx of[-1.31,1.31])for(const dy of[-1.31,1.31]){
    machineBox(c,x+dx,y+dy,.16,.16,.17,.09,metal.white,.045);
    const[px,py]=pt(x+dx,y+dy,.28);ellipse(c,px,py,.042,.030,metal.dark);ellipse(c,px-.008,py-.006,.017,.012,metal.light);
  }
  machineBox(c,x,y+1.405,1.08,.06,.10,.14,metal.side,.035);
  frontVent(c,x-.68,y+1.472,.105,.40,.115,2);
  frontPanel(c,x+.64,y+1.478,.10,.43,.13,metal.violet,.025);
  for(const dx of[.54,.65,.76]){const[lx,ly]=pt(x+dx,y+1.49,.17);ellipse(c,lx,ly,.022,.021,bed.water>0?metal.cyan:metal.shade);}
  line3(c,[[x-.14,y+1.48,.16],[x+.13,y+1.48,.16]],metal.gold,.032);
  if(selected){const[px,py]=pt(x-1.56,y-1.56,.20);rounded(c,px,py,3.12,3.12*COLONY_DEPTH,.11,null,'#fbfff0',.065);}
}
function drawBedSign(c,bed){const x=bed.x+1.68,y=bed.y+1.81,ready=bedReady(bed),[sx,sy]=pt(x,y,.44);line3(c,[[x,y,0],[x,y,.63]],metal.dark,.035);rounded(c,sx-.15,sy-.13,.30,.26,.035,metal.white,metal.ink,.018);if(ready)line(c,[[sx-.08,sy],[sx-.01,sy+.06],[sx+.10,sy-.06]],'#729a61',.035);else if(bed.crop)ellipse(c,sx,sy,.055,.06,cropById(bed.crop).color);}
function drawSprinklerBase(c,s){
  const x=s.x+.5,y=s.y+.5;groundEllipse(c,x+.07,y+.12,.43,.31,'#506a5928');
  const hose=Array.from({length:18},(_,i)=>{const a=.15+i*Math.PI*1.7/17;return[x+Math.cos(a)*.36,y+Math.sin(a)*.29,.035];});line3(c,hose,metal.dark,.065);line3(c,hose.map(([px,py,pz])=>[px-.01,py-.008,pz+.015]),metal.shade,.021);
  machineBox(c,x,y,.29,.28,.035,.10,metal.dark,.07);machineBox(c,x-.05,y-.05,.24,.23,.135,.28,metal.white,.075);
  frontVent(c,x-.13,y+.19,.19,.24,.16,3);frontPanel(c,x+.12,y+.19,.20,.13,.15,metal.violet,.025);
  line3(c,[[x+.055,y+.015,.25],[x+.055,y+.015,.80]],metal.joint,.12);
  line3(c,[[x+.025,y+.005,.32],[x+.025,y+.005,.64]],metal.white,.085);
  const[rx,ry]=pt(x+.055,y+.015,.75);ellipse(c,rx,ry,.13,.08,metal.dark);ellipse(c,rx-.015,ry-.02,.095,.052,metal.violet);
}
function drawSprinkler(c,s,time,reduced){
  const x=s.x+.5,y=s.y+.5;
  const a=reduced?.35:time*.7,dx=Math.cos(a)*.34,dy=Math.sin(a)*.34;
  for(const sign of[-1,1]){
    const mx=x+.055+sign*dx*.56,my=y+.015+sign*dy*.56,ex=x+.055+sign*dx,ey=y+.015+sign*dy;
    line3(c,[[x+.055,y+.015,.78],[mx,my,.90],[ex,ey,.84]],metal.dark,.095);
    line3(c,[[x+.04,y+.01,.81],[mx-.013,my-.008,.93],[ex-.012,ey-.008,.87]],metal.white,.056);
    const[jx,jy]=pt(mx,my,.91);ellipse(c,jx,jy,.052,.046,metal.dark);ellipse(c,jx-.008,jy-.008,.025,.021,metal.shade);
    const[nx,ny]=pt(ex,ey,.84);ellipse(c,nx,ny,.066,.045,metal.gold);
  }
  if(!reduced)for(const sign of[-1,1]){
    // Droplets retain their launch bearing while the nozzle keeps sweeping.
    // A faint arc makes the irrigation legible even at the phone's small scale.
    const arc=[];
    for(let i=0;i<=8;i++){const t=i/8,d=.35+t*2.7,bearing=a-t*.56;arc.push(pt(x+.055+sign*Math.cos(bearing)*d,y+.015+sign*Math.sin(bearing)*d,.84*(1-t)+Math.sin(t*Math.PI)*.65));}
    line(c,arc,'#d7f1e950',.023);
    for(let i=0;i<7;i++){
      const t=(time*1.12+i/7)%1,d=.35+t*2.7,bearing=a-t*.56,[px,py]=pt(x+.055+sign*Math.cos(bearing)*d,y+.015+sign*Math.sin(bearing)*d,.84*(1-t)+Math.sin(t*Math.PI)*.65);
      c.globalAlpha=(1-t)*.55;ellipse(c,px,py,.022+t*.02,.035+t*.025,'#f5fff7');
    }
    const phase=(time*1.12)%1,ex=x+.055+sign*Math.cos(a-.56)*3.05,ey=y+.015+sign*Math.sin(a-.56)*3.05;
    c.globalAlpha=(1-phase)*.34;c.strokeStyle='#f2fff1';c.lineWidth=.018;c.beginPath();c.ellipse(ex,ey*COLONY_DEPTH,.05+phase*.20,(.05+phase*.20)*COLONY_DEPTH*.5,0,0,TAU);c.stroke();
  }c.globalAlpha=1;
}
function drawPadBase(c,pad){
  const x=pad.x+.5,y=pad.y+.5;groundEllipse(c,x+.14,y+.18,1.7,1.35,'#52665d20');
  machineBox(c,x,y,1.46,1.46,.015,.05,metal.dark,.18);machineBox(c,x,y,1.48,1.48,.065,.065,metal.white,.19);
  const deck=[[-1.13,-1.28],[1.13,-1.28],[1.28,-1.13],[1.28,1.13],[1.13,1.28],[-1.13,1.28],[-1.28,1.13],[-1.28,-1.13]];
  poly3(c,deck.map(([dx,dy])=>[x+dx,y+dy,.135]),'#c3d0cb',metal.ink,.020);
  for(const side of[-1,1]){
    line3(c,[[x+side*1.13,y-1.07,.145],[x+side*1.13,y+1.07,.145]],'#f5f5e8',.027);
    for(const dy of[-.88,.88])line3(c,[[x+side*1.12,y+dy,.15],[x+side*.88,y+dy,.15]],metal.dark,.030);
    line3(c,[[x-.85,y+side*.85,.15],[x+.85,y+side*.85,.15]],'#a9b9b4',.018);
    machineBox(c,x+side*1.32,y,.065,.70,.135,.025,metal.white,.03);
  }
  const[cx,cy]=pt(x,y,.15);c.beginPath();c.ellipse(cx,cy,.89,.89*COLONY_DEPTH,0,0,TAU);c.strokeStyle=metal.light;c.lineWidth=.05;c.stroke();
  for(const dx of[-1.31,1.31])for(const dy of[-1.31,1.31]){
    machineBox(c,x+dx,y+dy,.09,.09,.135,.025,metal.dark,.03);const[lx,ly]=pt(x+dx,y+dy,.17);rounded(c,lx-.047,ly-.025,.094,.05,.012,metal.cyan);
  }
  // A cargo transfer lip and two recessed utility covers face the player.
  machineBox(c,x,y+1.37,.50,.095,.08,.12,metal.white,.06);
  for(const dx of[-.35,-.175,0,.175,.35])line3(c,[[x+dx,y+1.31,.205],[x+dx,y+1.43,.205]],metal.dark,.025);
  for(const dx of[-.91,.91]){frontPanel(c,x+dx,y+1.47,.075,.45,.08,metal.violet,.018);line3(c,[[x+dx-.12,y+1.48,.12],[x+dx+.12,y+1.48,.12]],metal.shade,.018);}
  poly3(c,[[x-.20,y-1.39,.14],[x+.20,y-1.39,.14],[x+.20,y-1.30,.14],[x-.20,y-1.30,.14]],metal.gold,null);
}
function drawShuttle(c,pad,colony,time,reduced){
  const x=pad.x+.5,y=pad.y+.5,active=colony.shipment,phase=active?1-active.remaining/active.duration:0;
  // The earned pennant belongs to the pad, including while the shuttle is away.
  if(colony.decorations?.pennant){const[px,py]=pt(x+1.60,y+.70,.83);line3(c,[[x+1.60,y+.70,0],[x+1.60,y+.70,1.25]],metal.dark,.035);polygon(c,[[px,py-.24],[px+.48,py-.12],[px,py+.04]],'#cfad6f',null);}
  // Height is projected: a distant orthographic object never changes its scale.
  const lift=active&&!reduced?(phase<.28?phase/.28*6:phase>.74?(1-phase)/.26*6:6):0;if(active&&!reduced&&phase>.28&&phase<.74)return;
  groundEllipse(c,x+.12,y+.16,Math.max(.2,1.25-lift*.10),Math.max(.15,.67-lift*.06),'#4f66552b');const z=.36+lift;
  if(lift>0&&!reduced)for(const dx of[-.75,.58]){const[px,py]=pt(x+dx,y+.34,z-.22);ellipse(c,px,py,.09,.21+Math.sin(time*17)*.025,'#e9c488aa');ellipse(c,px,py,.035,.15,'#fff7dd');}
  for(const dx of[-.86,.58])for(const dy of[-.41,.48]){line3(c,[[x+dx,y+dy,z],[x+dx+.06,y+dy,.12+lift]],metal.dark,.055);line3(c,[[x+dx-.10,y+dy,.12+lift],[x+dx+.17,y+dy,.12+lift]],'#687a77',.07);}
  const hull=[[-1.23,-.43],[-.92,-.60],[.56,-.60],[1.15,-.35],[1.31,.09],[1.14,.39],[.63,.56],[-1.12,.56],[-1.27,.32]];poly3(c,hull.map(([dx,dy])=>[x+dx,y+dy,z]),metal.shade,metal.ink,.028);
  poly3(c,[[x-1.12,y+.56,z],[x+.63,y+.56,z],[x+1.14,y+.39,z],[x+.99,y+.39,z+.47],[x+.49,y+.47,z+.47],[x-1.07,y+.47,z+.47]],metal.white,metal.ink,.027);
  const roof=[[-1.12,-.38],[-.91,-.49],[.49,-.49],[.99,-.28],[1.13,.04],[.99,.39],[.49,.47],[-1.07,.47]];poly3(c,roof.map(([dx,dy])=>[x+dx,y+dy,z+.47]),'#f5f5e9',metal.ink,.024);
  poly3(c,[[x+.69,y-.30,z+.49],[x+.96,y-.19,z+.49],[x+1.07,y+.04,z+.49],[x+.95,y+.18,z+.49],[x+.69,y+.19,z+.49]],'#648b8f',metal.ink,.018);line3(c,[[x+.84,y-.23,z+.50],[x+.88,y+.17,z+.50]],'#bfdad2',.018);
  poly3(c,[[x-.91,y-.34,z+.49],[x+.26,y-.34,z+.49],[x+.26,y+.31,z+.49],[x-.91,y+.31,z+.49]],'#617b72',metal.ink,.020);
  for(const[dx,dy,color]of[[-.65,-.12,'#a7b488'],[-.24,-.12,'#b39b6a'],[-.65,.18,'#c5bb96'],[-.20,.18,'#8caa88']]){poly3(c,[[x+dx-.15,y+dy-.12,z+.51],[x+dx+.15,y+dy-.12,z+.51],[x+dx+.15,y+dy+.12,z+.51],[x+dx-.15,y+dy+.12,z+.51]],color,metal.ink,.016);line3(c,[[x+dx,y+dy-.12,z+.52],[x+dx,y+dy+.12,z+.52]],'#f3e7be',.020);}
  machineBox(c,x-.33,y-.43,.64,.055,z+.49,.035,metal.white,.025);
  line3(c,[[x-.97,y+.34,z+.50],[x+.31,y+.34,z+.50]],metal.light,.035);
  for(const dx of[-.58,.20])frontPanel(c,x+dx,y+.565,z+.12,.65,.25,metal.white,.045);
  frontPanel(c,x-.89,y+.575,z+.15,.16,.20,metal.violet,.025);
  line3(c,[[x-1.05,y+.575,z+.08],[x+.60,y+.575,z+.08]],metal.dark,.045);
  line3(c,[[x+.57,y+.51,z+.18],[x+.86,y+.44,z+.18]],metal.gold,.035);
  for(const dy of[-.26,.26]){const[px,py]=pt(x-1.20,y+dy,z+.22);ellipse(c,px,py,.105,.11,metal.dark);ellipse(c,px-.012,py-.012,.077,.081,metal.shade);ellipse(c,px,py,.052,.063,metal.joint);ellipse(c,px,py,.026,.035,metal.violet);}
}

export function createColonyRenderer(canvas){
  const c=canvas.getContext('2d');let cachedWorld=null,terrain=null,scenery=[],w=0,h=0,dpr=1,previousColony=null;const celebrations=[];
  const atmosphere=createColonyAtmosphere();
  // Fixed machinery does not change with snapshots or camera movement. Rasterize
  // each visual state once at the current display scale; retain only that scale.
  const machinery=new Map();let machineryScale=0,machineryFontReady=false;
  function machine(key,x,y,paint,alpha=1){
    let sprite=machinery.get(key);
    if(!sprite){
      const image=document.createElement('canvas'),scale=machineryScale;
      const bounds={bed:[-1.3,-1.1,3.7,3],pad:[-1.3,-1.1,3.7,3],hub:[-1.4,-2,3,3.2],shuttle:[-1.3,-1.1,4.1,2.6],sprinkler:[-.1,-.2,1.3,1.3],campfire:[-.15,-.25,1.3,1.3],cinema:[-1.10,-1.65,3.25,2.65]}[key.split(':')[0]];
      const[left,top,width,height]=bounds;
      image.width=Math.ceil(width*scale);image.height=Math.ceil(height*scale);
      const context=image.getContext('2d');context.setTransform(scale,0,0,scale,-left*scale,-top*scale);
      // Bake the existing per-primitive fade into its own sprite. Applying alpha
      // after compositing would change translucent glass and overlapping panels.
      context.globalAlpha=alpha;paint(context);sprite={image,left,top};machinery.set(key,sprite);
    }
    c.drawImage(sprite.image,x+sprite.left,y*COLONY_DEPTH+sprite.top,sprite.image.width/machineryScale,sprite.image.height/machineryScale);
  }
  function resize(){w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}}
  function draw({world,colony,players=[],me,camera,selected=null,placement=null,time=0,reduced=false,environment=null,ambientTime=colony?.time||0,movie=null}){
    resize();c.setTransform(dpr,0,0,dpr,0,0);const colors=palette(world?.template);c.fillStyle=colors.water;c.fillRect(0,0,w,h);if(!world||!colony)return;
    if(previousColony!==colony){if(previousColony&&!reduced){for(const b of colony.beds){const before=previousColony.beds.find(old=>old.id===b.id);if(before&&bedReady(before)&&b.harvests>before.harvests)celebrations.push({x:b.x+.5,y:b.y+.5,time,color:cropById(before.crop)?.color||'#e8c381'});}if(colony.shipments>previousColony.shipments)celebrations.push({x:colony.pad.x+.5,y:colony.pad.y+.5,time,color:'#d2ad6d'});}previousColony=colony;if(celebrations.length>8)celebrations.splice(0,celebrations.length-8);}
    // Terrain is immutable; acknowledged snapshots may have a new object identity.
    if(!terrain||cachedWorld?.id!==world.id||cachedWorld?.version!==world.version||cachedWorld?.template!==world.template){
      cachedWorld=world;terrain=terrainCache(world);scenery=[];
      for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++){
        const kind=world.terrain[y*world.width+x];
        if(kind===3||((kind===1||kind===2)&&hash(x,y,11)>.945))scenery.push({x,y,kind});
      }
    }
    const tile=camera.tile,fontReady=document.fonts?.check('10px "IBM Plex Mono"')??true;
    if(machineryScale!==tile*dpr||machineryFontReady!==fontReady){machinery.clear();machineryScale=tile*dpr;machineryFontReady=fontReady;}
    c.save();c.translate(w/2-camera.x*tile,h/2-camera.y*tile*COLONY_DEPTH);c.scale(tile,tile);c.drawImage(terrain,0,0,world.width,world.height*COLONY_DEPTH);
    const bounds=colonyVisibleBounds(camera,w,h,4),left=Math.max(0,bounds.left),right=Math.min(world.width,bounds.right),top=Math.max(0,bounds.top),bottom=Math.min(world.height,bounds.bottom);
    const items=colony.decorations?.items||[],objects=[],selectedBed=colony.beds.find(b=>b.id===selected),attention=[...players,...(selectedBed?[{x:selectedBed.x+.5,y:selectedBed.y+.5}]:[])];
    const fades=(x,y,width,height)=>attention.some(p=>Math.abs(p.x-x)<width&&p.y<y+.40&&p.y>y-height);const object=(y,draw)=>objects.push({y,draw});
    const visible=(x,y,radius=2,height=3)=>x+radius>=left&&x-radius<=right&&y+radius>=top&&y-height<=bottom;
    // Tall scenery shares depth order with machines and people.
    for(const{x,y,kind}of scenery){
      if(x<left||x>=right||y<top||y>=bottom)continue;
      if(kind===3){object(y+.8,()=>drawRock(c,x+.5,y+.5));continue;}
      const nearHub=Math.hypot(x-colony.hub.x,y-colony.hub.y)<3,occupied=colony.beds.some(b=>Math.abs(b.x-x)<=2&&Math.abs(b.y-y)<=2)||Math.hypot(x-colony.pad.x,y-colony.pad.y)<3||items.some(item=>Math.abs(item.x-x)<(item.kind==='cinema'?2:1)&&Math.abs(item.y-y)<1.5);
      if(!nearHub&&!occupied)object(y+.58,()=>{c.save();if(fades(x+.5,y+.5,.75,1.8))c.globalAlpha=.38;wildPlant(c,x+.5,y+.5,colors,reduced?0:time,world.template);c.restore();});
    }
    for(let i=0;i<8;i++){const x=colony.hub.x+1.55+i*.67,y=colony.hub.y+1.25+Math.sin(i*.5)*.22;groundEllipse(c,x,y,.21,.14,'#dce0c4');}
    if(placement){c.save();c.strokeStyle='#f8fff277';c.lineWidth=.035;c.setLineDash([.12,.17]);c.beginPath();c.ellipse(colony.hub.x,colony.hub.y*COLONY_DEPTH,COLONY.surveyRadius,COLONY.surveyRadius*COLONY_DEPTH,0,0,TAU);c.stroke();c.restore();}
    // Low floors draw first. Individual crops never hide a walking robot under a slab.
    if(visible(colony.pad.x,colony.pad.y))machine('pad',colony.pad.x,colony.pad.y,context=>drawPadBase(context,{x:0,y:0}));
    for(const b of colony.beds){
      if(!visible(b.x,b.y))continue;
      const wet=b.water>0,chosen=selected===b.id;
      machine(`bed:${wet}:${chosen}`,b.x,b.y,context=>drawBedBase(context,{x:0,y:0,water:wet?1:0},chosen));
      if(b.crop)for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=b.x+.5+(col-1)*.77,y=b.y+.5+(row-1)*.77;object(y+.02,()=>{c.save();if(players.some(p=>Math.hypot(p.x-x,p.y-y)<.48))c.globalAlpha=.48;drawCrop(c,b.crop,x,y,b.growth,time,row*3+col+b.x,bedReady(b),reduced);c.restore();});}if(b.crop)object(b.y+1.82,()=>drawBedSign(c,b));
    }
    for(const s of colony.sprinklers)if(visible(s.x,s.y,4))object(s.y+.53,()=>{machine('sprinkler',s.x,s.y,context=>drawSprinklerBase(context,{x:0,y:0}));drawSprinkler(c,s,time,reduced);});
    for(const item of items)if(visible(item.x,item.y,item.kind==='cinema'?2:1,4))object(item.y+.57,()=>{
      if(item.kind==='campfire'){machine('campfire',item.x,item.y,context=>drawCampfireBase(context,{x:0,y:0}));drawCampfire(c,item,ambientTime,reduced);}
      else if(item.kind==='cinema'){machine('cinema',item.x,item.y,context=>drawCinemaBase(context,{x:0,y:0}));drawCinema(c,item,movie);}
    });
    if(visible(colony.hub.x,colony.hub.y))object(colony.hub.y+1.02,()=>{const fade=fades(colony.hub.x,colony.hub.y,1.25,2.2);machine(`hub:${fade}`,colony.hub.x,colony.hub.y,context=>drawHub(context,{x:0,y:0}),fade?.42:1);});
    if(visible(colony.pad.x,colony.pad.y,2,6))object(colony.pad.y+1.05,()=>{
      const fade=fades(colony.pad.x+.5,colony.pad.y+.5,1.4,1.4);
      if(!colony.shipment||reduced)machine(`shuttle:${fade}:${!!colony.decorations?.pennant}`,colony.pad.x,colony.pad.y,context=>drawShuttle(context,{x:0,y:0},colony,time,reduced),fade?.55:1);
      else{c.save();if(fade)c.globalAlpha=.55;drawShuttle(c,colony.pad,colony,time,reduced);c.restore();}
    });
    for(const p of players)if(visible(p.x,p.y))object(p.y+.20,()=>drawColonyRobot(c,p,time,p.id===me?.id,reduced));objects.sort((a,b)=>a.y-b.y);for(const entry of objects)entry.draw();
    if(!reduced){for(let i=0;i<3;i++){const t=time*.32+i*TAU/3,x=colony.hub.x+Math.sin(t)*5.4,y=colony.hub.y+Math.cos(t*.7+i)*4.6,[px,py]=pt(x,y,.6),wing=.035+Math.abs(Math.sin(time*13+i))*.055;ellipse(c,px-wing,py,wing,.045,i===1?'#eee9c6':'#e2b9a4',-.3);ellipse(c,px+wing,py,wing,.045,i===1?'#eee9c6':'#e2b9a4',.3);}for(let i=celebrations.length-1;i>=0;i--){const effect=celebrations[i],age=time-effect.time;if(age>1.8){celebrations.splice(i,1);continue;}c.globalAlpha=Math.max(0,1-age/1.8);for(let j=0;j<12;j++){const a=j*TAU/12,speed=.7+hash(j,i)*.8,[px,py]=pt(effect.x+Math.cos(a)*age*speed,effect.y+Math.sin(a)*age*speed,age*.8);ellipse(c,px,py,.045,.075,j%3?effect.color:'#fff4ce',a+age*2);}c.globalAlpha=1;}}
    if(placement&&Number.isFinite(placement.x)){
      const size=placement.kind==='bed'||placement.kind==='cinema'?3:1,depth=placement.kind==='bed'?3:1,x=placement.x+.5,y=placement.y+.5,valid=!placement.error;
      if(placement.kind==='sprinkler'){groundEllipse(c,x,y,COLONY.sprinklerRadius,COLONY.sprinklerRadius,valid?'#eaf8e329':'#ebbeab20');c.strokeStyle=valid?'#f6fff0aa':'#b58470';c.lineWidth=.03;c.setLineDash([.12,.15]);c.beginPath();c.ellipse(x,y*COLONY_DEPTH,COLONY.sprinklerRadius,COLONY.sprinklerRadius*COLONY_DEPTH,0,0,TAU);c.stroke();c.setLineDash([]);}
      const[px,py]=pt(x-size/2,y-depth/2);rounded(c,px,py,size,depth*COLONY_DEPTH,.10,valid?'#eff9e35c':'#edc3ac63',valid?'#fffef0':'#b6745e',.055);c.font='.23px "IBM Plex Sans",sans-serif';c.textAlign='center';c.fillStyle=valid?'#4c6656':'#905c4c';c.fillText(valid?'Place here':'Blocked',x,py-.19);
    }
    c.restore();const glow=c.createRadialGradient(w*.2,h*.1,0,w*.5,h*.5,Math.max(w,h)*.8);glow.addColorStop(0,'#fff8db0a');glow.addColorStop(.65,'#fff4cd00');glow.addColorStop(1,'#6a805b0a');c.fillStyle=glow;c.fillRect(0,0,w,h);
    atmosphere(c,{width:w,height:h,camera,environment,time:ambientTime,reduced,items,hub:colony.hub,movie,world});
  }
  return {draw,resize,screenToWorld:(x,y,camera)=>{resize();return colonyScreenToWorld(x,y,camera,w,h);},worldToScreen:(point,camera)=>{resize();return colonyWorldToScreen(point,camera,w,h);}};
}

export function cropIcon(id){
  if(id==='moonberry')return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 38V16" fill="none" stroke="#78966d" stroke-width="3"/><path d="M24 23C9 24 9 11 12 10C23 11 24 23 24 23M24 18C25 8 35 7 38 10C37 20 24 18 24 18" fill="#96b586"/><circle cx="17" cy="29" r="8" fill="#ad8dbe"/><circle cx="30" cy="27" r="8" fill="#9879ae"/><circle cx="25" cy="36" r="7" fill="#b89ac6"/><circle cx="15" cy="26" r="2" fill="#e8d7ed"/><circle cx="28" cy="24" r="2" fill="#e8d7ed"/></svg>';
  if(id==='cloudmelon')return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M25 15C21 6 31 5 34 8" fill="none" stroke="#789c62" stroke-width="3"/><path d="M24 16C11 17 8 9 12 7C21 8 24 16 24 16" fill="#9ab978"/><ellipse cx="24" cy="29" rx="16" ry="14" fill="#b8cb87"/><path d="M23 16C13 25 14 38 23 42M27 16C35 25 34 38 27 42M25 16V42" fill="none" stroke="#e4e9ae" stroke-width="2"/></svg>';
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 20C9 19 8 8 12 6C22 8 24 20 24 20M25 20C24 9 33 4 38 7C40 17 25 20 25 20" fill="#99b776"/><path d="M24 22V10" fill="none" stroke="#78975b" stroke-width="3"/><circle cx="24" cy="31" r="14" fill="#ecb253"/><ellipse cx="19" cy="26" rx="4" ry="5" fill="#f6d891"/></svg>';
}
