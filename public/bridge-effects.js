import { bridgeProfile, bridgeWidth, bridgeTiming, bridgeCells, bridgeLength, bridgeReady } from './bridge-geometry.js';

// Mask water-level artwork beneath the unchanged deck. Call within save/restore;
// ground vehicles and airborne aircraft are drawn outside this clipping region.
export function clipUnderBridges(c,world,T){
  const spans=(world.logistics?.bridges||[]).filter(bridgeReady);
  if(!spans.length&&!world.bridges?.length)return;
  c.beginPath();c.rect(-10*T,-10*T,(world.width+20)*T,(world.height+20)*T);
  const seen=new Set();
  for(const cell of [...(world.bridges||[]),...spans.flatMap(bridgeCells)]){
    const key=cell.x+','+cell.y;if(seen.has(key))continue;seen.add(key);
    c.rect(cell.x*T,cell.y*T,T,T);
  }
  c.clip('evenodd');
}

export function drawBridges(c,world,T,zoom,preview=null){
  c.save();
  for(const b of [...(world.logistics?.bridges||[]),...(preview?[preview]:[])]){
    if(!b.from||!b.to)continue;
    const ghost=b===preview,ready=!ghost&&bridgeReady(b),n=bridgeLength(b),dx=Math.sign(b.to.x-b.from.x),dy=Math.sign(b.to.y-b.from.y);
    if(n<1||n>bridgeProfile(b).maxSpan||(dx&&dy))continue;
    const {cableTime,rowTime}=bridgeTiming(b),edge=bridgeWidth(b)/2-.14;
    const rows=ready?n:Math.max(0,Math.min(n,((b.elapsed||0)-cableTime)/rowTime));
    for(const cell of bridgeCells(b)){
      const visible=cell.anchor||cell.row<=Math.floor(rows);
      if(!ghost&&!visible)continue;
      const x=cell.x*T,y=cell.y*T;c.globalAlpha=ghost?.35:1;
      c.fillStyle=ghost?(b.error?'#c46453':'#83bcaf'):cell.anchor?'#4c676a':'#576f72';c.fillRect(x+1,y+1,T-2,T-2);
      c.strokeStyle=cell.anchor?'#d4b36e':'#93b4b7';c.lineWidth=1/zoom;c.strokeRect(x+3,y+3,T-6,T-6);
      if(!ghost){c.fillStyle='#263e42';for(let i=1;i<=3;i++)if(dx)c.fillRect(x+i*T/4,y+6,2,T-12);else c.fillRect(x+6,y+i*T/4,T-12,2);}
    }
    c.globalAlpha=1;
    const cable=ghost||ready?1:Math.min(1,(b.elapsed||0)/cableTime);
    for(const side of [-1,1]){
      const ax=(b.from.x+.5-dy*side*edge)*T,ay=(b.from.y+.5+dx*side*edge)*T;
      c.strokeStyle=ghost?(b.error?'#ee9b83':'#a3dcce'):'#c6d1cf';c.lineWidth=2/zoom;c.beginPath();c.moveTo(ax,ay);c.lineTo(ax+(b.to.x-b.from.x)*T*cable,ay+(b.to.y-b.from.y)*T*cable);c.stroke();
      for(const p of [b.from,b.to]){c.fillStyle='#d9b36e';c.fillRect((p.x+.5-dy*side*edge)*T-4,(p.y+.5+dx*side*edge)*T-4,8,8);}
    }
    if(!ghost&&!ready&&(b.elapsed||0)>=cableTime){
      const travel=rows+.5,x=(b.from.x+.5+dx*travel)*T,y=(b.from.y+.5+dy*travel)*T;
      const roller=bridgeWidth(b)/2-.08;
      c.save();c.translate(x,y);c.rotate(dx?0:Math.PI/2);c.fillStyle='#bfab78';c.fillRect(-T*.14,-T*roller,T*.28,T*roller*2);c.strokeStyle='#e0d3aa';c.lineWidth=2/zoom;c.strokeRect(-T*.14,-T*roller,T*.28,T*roller*2);c.restore();
    }
    if(!ghost){const label=ready?'BRIDGE OPEN':(b.elapsed||0)<cableTime?'TENSIONING CABLES':`DECK ${Math.floor(rows)} / ${n}`;c.font=`${10/zoom}px monospace`;c.textAlign='center';c.fillStyle='#10282be8';const w=c.measureText(label).width,x=(b.from.x+b.to.x+1)*T/2,y=(b.from.y+b.to.y+1)*T/2;c.fillRect(x-w/2-4,y-13/zoom,w+8,18/zoom);c.fillStyle=ready?'#a4dec8':'#efd38a';c.fillText(label,x,y);}
  }
  c.restore();
}
