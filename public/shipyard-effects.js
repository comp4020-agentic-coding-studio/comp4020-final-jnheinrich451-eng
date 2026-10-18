import { isCarrier } from './carrier.js';
import { SHIPYARD } from './shipyard.js';
import { mooredDock } from './ship.js';
import { drawShip } from './ship-effects.js';
export function drawWrecks(c,world,T,zoom){
  c.save();
  for(const w of world.logistics?.wrecks||[]){
    c.save();c.translate(w.x*T,w.y*T);c.rotate(w.angle);
    c.fillStyle='#0c252d80';c.beginPath();c.ellipse(0,0,T*1.2,T*2.2,0,0,Math.PI*2);c.fill();
    c.fillStyle='#3a5358b0';c.strokeStyle='#84948780';c.lineWidth=1/zoom;
    c.beginPath();c.moveTo(0,-1.8*T);c.lineTo(.8*T,-T);c.lineTo(.4*T,.2*T);c.lineTo(-.7*T,.1*T);c.lineTo(-.8*T,-T);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(-.65*T,.5*T);c.lineTo(.7*T,.3*T);c.lineTo(.5*T,1.7*T);c.lineTo(-.6*T,1.5*T);c.closePath();c.fill();c.stroke();c.restore();
  }c.restore();
}
export function drawShipAssembly(c,world,ship,T,zoom,reduced,effects){
  if(ship.destroyed)return;
  if(ship.repairing){
    const dock=mooredDock(world,ship);
    if(dock){c.save();c.translate(ship.x*T,ship.y*T);
      effects.workers(c,{cores:[{x:dock.x-1.5,y:dock.y-1.5,elapsed:4.5}]},ship,2,{time:2+(ship.repairTime||0),reveal:.5},reduced);
      c.fillStyle='#a9e7cf';c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillText('DOCK REPAIR',0,2.4*T+28/zoom);c.restore();}
  }
  if(!(ship.assemblyRemaining>0))return;
  const reveal=1-ship.assemblyRemaining/(ship.assemblyDuration||SHIPYARD.buildTime);
  c.save();c.translate(ship.x*T,ship.y*T);c.rotate(ship.angle);
  c.beginPath();c.rect((isCarrier(ship)?-1.5:-1)*T,((isCarrier(ship)?2.5:2)-(isCarrier(ship)?5:4)*reveal)*T,(isCarrier(ship)?3:2)*T,(isCarrier(ship)?5:4)*T*reveal);c.clip();
  c.rotate(-ship.angle);c.translate(-ship.x*T,-ship.y*T);
  drawShip(c,ship,T,false,zoom,0,true);c.restore();
  c.save();c.translate(ship.x*T,ship.y*T);
  c.strokeStyle='#b1dace';c.lineWidth=1/zoom;c.setLineDash([5/zoom,4/zoom]);c.strokeRect((isCarrier(ship)?-1.5:-1)*T,(isCarrier(ship)?-2.5:-2)*T,(isCarrier(ship)?3:2)*T,(isCarrier(ship)?5:4)*T);c.setLineDash([]);
  // Work from the dock, rather than treating these workers as simulated units.
  if(!ship.dockDestroyed)effects.workers(c,{cores:[{x:ship.dock.x-1.5,y:ship.dock.y-1.5,elapsed:4.5}]},ship,2,{time:1.75+(ship.assemblyDuration||SHIPYARD.buildTime)-ship.assemblyRemaining,reveal},reduced);
  c.font=`bold ${11/zoom}px monospace`;c.textAlign='center';c.fillStyle='#ecce89';c.fillText(ship.dockDestroyed?'SHIPYARD DAMAGED / REPAIR':`ASSEMBLING ${Math.ceil(ship.assemblyRemaining)}s`,0,2.8*T);c.restore();
}
