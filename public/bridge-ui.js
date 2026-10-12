import { BRIDGE, isBuilder, bridgeCost, bridgeReady } from './bridge-geometry.js';
import { bridgeError } from './bridge.js';

export function bridgeUI({state,api,stop,notify,frame}){
  const $=id=>document.getElementById(id),panel=$('bridge-planner');let choosing='from',busy=false;
  const point=bank=>({x:Number($('bridge-'+bank+'-x').value),y:Number($('bridge-'+bank+'-y').value)});
  const active=()=>!panel.hidden;
  function preview(){
    if(!active())return null;const {world,buildings,players,me,truck}=state(),from=point('from'),to=point('to');
    let error=bridgeError(world,buildings,players,truck,from,to);
    const price=bridgeCost({from,to});if(!error&&world.logistics.supplies<price)error='Need '+price+' supplies for this crossing.';
    if(!error&&world.logistics.bridges?.some(b=>b.builderId===truck?.id&&!bridgeReady(b)))error='Finish the current bridge first.';
    if(!isBuilder(truck)||me.life!=='active')error='Board your bridge builder to plan a crossing.';
    return {from,to,elapsed:0,error,price};
  }
  function update(){
    if(!active())return;if(!isBuilder(state().truck)){panel.hidden=true;return;}
    const p=preview();$('bridge-message').textContent=p.error||`${p.price} supplies / Two cables, then 1 x 3 deck sections. Opens when complete.`;
    $('bridge-confirm').disabled=busy||!!p.error;
    for(const bank of ['from','to'])$('bridge-pick-'+bank).setAttribute('aria-pressed',String(choosing===bank));
    $('bridge-pick-hint').textContent='Click or tap the '+(choosing==='from'?'near':'far')+' bank center. Maximum '+BRIDGE.maxSpan+' water tiles. Ships cannot pass underneath.';
  }
  function open(){
    const {truck}=state();if(!isBuilder(truck))return;stop();
    if(!panel.dataset.initialized){for(const bank of ['from','to']){ $('bridge-'+bank+'-x').value=String(Math.floor(truck.x)+(bank==='from'?2:8));$('bridge-'+bank+'-y').value=String(Math.floor(truck.y));}panel.dataset.initialized='true';}
    choosing='from';panel.hidden=false;update();
  }
  function pick(x,y){if(!active())return false;$('bridge-'+choosing+'-x').value=String(Math.floor(x));$('bridge-'+choosing+'-y').value=String(Math.floor(y));choosing=choosing==='from'?'to':'from';update();return true;}
  $('builder-plan').onclick=open;$('bridge-close').onclick=()=>panel.hidden=true;
  for(const bank of ['from','to']){$('bridge-pick-'+bank).onclick=()=>{choosing=bank;update();};for(const axis of ['x','y'])$('bridge-'+bank+'-'+axis).oninput=update;}
  $('bridge-confirm').onclick=async()=>{const p=preview();if(!p||p.error||busy)return;busy=true;update();try{await api('logistics/bridge',{from:p.from,to:p.to});panel.hidden=true;frame(p);notify('Anchors set. Cables tensioning, then deck unrolling. The builder stays anchored until complete.');}catch(e){$('bridge-message').textContent=e.message;}finally{busy=false;$('bridge-confirm').disabled=!!preview()?.error;}};
  return {active,preview,update,pick,close:()=>panel.hidden=true};
}
