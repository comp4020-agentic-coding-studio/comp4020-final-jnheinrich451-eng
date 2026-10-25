// Template v1 is immutable once saved. Cosmetic variation is coordinate seeded.
export const VESPER_SEED=2401024;
export const terrainHash=(x,y,seed=VESPER_SEED)=>{let n=Math.imul(x+seed,374761393)^Math.imul(y-seed,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;};
export function createVesper(){
 const width=512,height=384,terrain=Array(width*height).fill(0),mountains=Array(width*height).fill(0),waterKinds=Array(width*height).fill(1);
 const continents=[[96,86,77,65],[307,88,106,62],[172,278,118,77],[414,270,66,85]];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let coast=Infinity;for(const[cx,cy,rx,ry]of continents){const a=Math.atan2((y-cy)/ry,(x-cx)/rx);coast=Math.min(coast,Math.hypot((x-cx)/rx,(y-cy)/ry)-1-.045*Math.sin(a*5)-.025*Math.cos(a*7));}
  const i=y*width+x;terrain[i]=coast<-.07?2:coast<0?1:0;if(terrain[i])waterKinds[i]=0;
 }
 const ellipse=(cx,cy,rx,ry,fn)=>{for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(height-1,cy+ry);y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(width-1,cx+rx);x++)if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)fn(y*width+x,x,y);};
 const stroke=(points,radius,fn)=>{for(let n=1;n<points.length;n++){const a=points[n-1],b=points[n],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);for(let k=0;k<=steps;k++){const t=k/steps;ellipse(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,radius,radius,fn);}}};
 const ridge=(points,r)=>stroke(points,r,(i,x,y)=>{if(terrain[i]===2){terrain[i]=3;mountains[i]=1+terrainHash(x>>2,y>>2)%3;}});
 // Broken chains create real passes, not sealed rings around starting territory.
 ridge([[105,37],[117,49],[125,62]],5);ridge([[131,85],[138,103],[136,121]],6);
 ridge([[255,65],[281,56],[305,65]],7);ridge([[333,75],[356,89],[371,112]],6);
 ridge([[100,251],[125,235],[147,238]],7);ridge([[180,250],[203,269],[220,294]],7);
 ridge([[411,209],[425,228],[431,248]],6);ridge([[420,284],[405,306],[408,330]],6);
 const lake=(x,y,rx,ry)=>ellipse(x,y,rx,ry,i=>{terrain[i]=0;waterKinds[i]=3;mountains[i]=0;});
 lake(105,108,14,10);lake(316,110,19,12);lake(159,292,23,15);lake(393,257,12,17);
 const river=points=>stroke(points,3.5,i=>{if(terrain[i]!==0||waterKinds[i]!==1){terrain[i]=0;waterKinds[i]=2;mountains[i]=0;}});
 river([[104,113],[91,126],[86,147],[80,158]]);river([[316,115],[330,131],[349,139],[362,153]]);
 river([[159,299],[151,320],[162,337],[174,358]]);river([[388,259],[373,269],[351,278],[339,280]]);
 // Flat, unobstructed landing/airfield reserve. Also keep an authored straight
 // coast for the first large dock: shore x=32, offshore site x=24, y=80.
 for(let y=54;y<=106;y++)for(let x=50;x<=92;x++){const i=y*width+x;terrain[i]=2;waterKinds[i]=0;mountains[i]=0;}
 for(let y=64;y<=96;y++)for(let x=0;x<=48;x++){const i=y*width+x;terrain[i]=x<32?0:x<35?1:2;waterKinds[i]=x<32?1:0;mountains[i]=0;}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(terrain[i]===2&&Math.hypot(x-72,y-80)>32&&terrainHash(x,y)%173===0)terrain[i]=3;}
 return{version:3,id:'vesper-01',template:'vesper-v1',name:'Vesper',designation:'VSP / 02',seed:VESPER_SEED,width,height,terrain,mountains,waterKinds,spawn:{x:72.5,y:80.5},orbitalOrigin:{x:72,y:80},fronts:[{id:'landing',label:'Vesper landing',x:72,y:80},{id:'uplands',label:'Slate uplands',x:302,y:94},{id:'watershed',label:'Southern watershed',x:172,y:278}],regions:[{id:'landing',label:'Vesper / landing plain',x:72,y:80},{id:'aurora',label:'Crown / northern ridge',x:307,y:88},{id:'lake',label:'Glassmere / lake and river',x:316,y:110},{id:'haven',label:'Moss basin / southern lakes',x:172,y:278},{id:'meridian',label:'Eastern spine / high peaks',x:414,y:270},{id:'ocean',label:'Open-water passage',x:256,y:192}]};
}
