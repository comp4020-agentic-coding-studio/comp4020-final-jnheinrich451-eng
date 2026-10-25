// Optional saved masks: old worlds keep their original movement rules.
export const mountainAt=(w,x,y)=>x>=0&&y>=0&&x<w.width&&y<w.height?w.mountains?.[Math.floor(y)*w.width+Math.floor(x)]||0:0;
export const inlandWaterAt=(w,x,y)=>x>=0&&y>=0&&x<w.width&&y<w.height&&(w.waterKinds?.[Math.floor(y)*w.width+Math.floor(x)]||0)>1;
// Mountain masks are immutable saved terrain. A summed-area table makes repeated
// aircraft clearance checks constant-time, even with a wide turning margin.
const mountainTables=new WeakMap();
function mountainTable(w){
 let table=mountainTables.get(w.mountains);if(table)return table;
 const stride=w.width+1,data=new Uint32Array(stride*(w.height+1));
 for(let y=0;y<w.height;y++){let row=0;for(let x=0;x<w.width;x++){row+=w.mountains[y*w.width+x]?1:0;data[(y+1)*stride+x+1]=data[y*stride+x+1]+row;}}
 table={stride,data};mountainTables.set(w.mountains,table);return table;
}
export function mountainClear(w,p,r=.7){
 if(!w.mountains)return true;
 const x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),x1=Math.min(w.width,Math.floor(p.x+r)+1),y1=Math.min(w.height,Math.floor(p.y+r)+1);
 if(x0>=x1||y0>=y1)return true;
 const {stride:s,data:d}=mountainTable(w);return d[y1*s+x1]-d[y0*s+x1]-d[y1*s+x0]+d[y0*s+x0]===0;
}
export function flightLineClear(w,a,b,r=.7){
 if(!w.mountains)return true;const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2));
 for(let i=0;i<=steps;i++)if(!mountainClear(w,{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},r))return false;
 return true;
}
export function terrainColor(w,x,y,kind=w.terrain[Math.floor(y)*w.width+Math.floor(x)]){
 if(w.template!=='vesper-v1')return ['#31585b','#cfc29b','#93a17c','#607160','#798d89'][kind]||'#31585b';
 const peak=mountainAt(w,x,y);if(peak&&kind!==4)return ['','#4c5863','#77848b','#b1bab9'][peak];
 if(kind===0)return inlandWaterAt(w,x,y)?'#427e83':'#234c61';
 return ['#234c61','#b9b39b','#718c70','#596872','#798d89'][kind]||'#718c70';
}
