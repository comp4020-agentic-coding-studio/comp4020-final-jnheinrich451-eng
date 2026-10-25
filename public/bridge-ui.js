import { BRIDGE_PROFILES, isBuilder, bridgeCost, bridgeDuration, bridgeReady, bridgeFromBuilder } from './bridge-geometry.js';
import { bridgeError, bridgeSupplyError } from './bridge.js';
import { bridgeFacing, planBridgeAhead } from './bridge-plan.js';

export function bridgeUI({state,api,stop,notify,frame}){
  const $=id=>document.getElementById(id),panel=$('bridge-planner');let choosing='from',busy=false,cache=null;
  const automatic=()=>$('bridge-method').value==='ahead';
  const profile=()=>$('bridge-profile').value;
  const point=bank=>({x:Number($('bridge-'+bank+'-x').value),y:Number($('bridge-'+bank+'-y').value)});
  const active=()=>!panel.hidden;
  function preview(){
    if(!active())return null;const {world,buildings,players,me,truck,revision}=state();let plan;
    if(automatic()){
      const bearing=Number($('bridge-direction').value),signature=[world,buildings,revision,truck?.x,truck?.y,bearing,profile()];
      if(!cache||signature.some((v,i)=>v!==cache.signature[i]))cache={signature,plan:planBridgeAhead(world,buildings,players,truck,bearing,profile())};
      plan=cache.plan;
    }else{const {from,to}=bridgeFromBuilder(truck,point('from'),point('to'));plan={from,to,error:bridgeError(world,buildings,players,truck,from,to,profile())};}
    const {from,to}=plan;let error=plan.error;
    const price=from&&to?bridgeCost({from,to,profile:profile()}):0;if(!error)error=bridgeSupplyError(world,price);
    if(!error&&world.logistics.bridges?.some(b=>b.builderId===truck?.id&&!bridgeReady(b)))error='Finish the current bridge first.';
    if(!isBuilder(truck)||me.life!=='active')error='Board your bridge builder to plan a crossing.';
    return {from,to,profile:profile(),elapsed:0,error,price};
  }
  function update(){
    if(!active())return;if(!isBuilder(state().truck)){panel.hidden=true;return;}
    const p=preview(),spec=BRIDGE_PROFILES[profile()];$('bridge-title').textContent=`${spec.label.toUpperCase()} BRIDGE / ${spec.width} WIDE`;
    $('bridge-message').textContent=p.error||`${p.price} ground SUP / ${bridgeDuration(p).toFixed(1)}s / Two cables, then 1 x ${spec.width} deck sections. Opens when complete.`;
    const l=state().world.logistics;$('bridge-budget').textContent=`Shared GND: ${Math.floor(l.groundSupplies||0)} / ORB: ${Math.floor(l.supplies||0)}. Bridges use shared GND, not ORB or carrier stores.`;
    $('bridge-confirm').disabled=busy||!!p.error;
    for(const bank of ['from','to'])$('bridge-pick-'+bank).setAttribute('aria-pressed',String(choosing===bank));
    $('bridge-coordinates').hidden=automatic();$('bridge-direction-label').hidden=!automatic();
    $('bridge-route').textContent=p.from&&p.to?`Build from (${p.from.x}, ${p.from.y}) to (${p.to.x}, ${p.to.y})`:'';
    $('bridge-pick-hint').textContent=(automatic()?'Face the water; choose a direction or tap that way on the map.':'Pick bank '+(choosing==='from'?'A':'B')+' on clear land. Either bank can be first.')+` ${spec.width}-tile-wide anchors and approaches; up to ${spec.maxSpan} deck rows. Works over sea, rivers and lakes. Ships pass beneath completed ocean spans only.`;
  }
  function open(){
    const {truck}=state();if(!isBuilder(truck))return;stop();
    if(!panel.dataset.initialized){for(const bank of ['from','to']){ $('bridge-'+bank+'-x').value=String(Math.floor(truck.x)+(bank==='from'?2:8));$('bridge-'+bank+'-y').value=String(Math.floor(truck.y));}panel.dataset.initialized='true';}
    choosing='from';$('bridge-method').value='ahead';$('bridge-direction').value=String(bridgeFacing(truck.angle));cache=null;panel.hidden=false;update();const p=preview();if(!p.error)frame(p);
  }
  function pick(x,y){if(!active())return false;if(automatic()){const {truck}=state();$('bridge-direction').value=String(bridgeFacing(Math.atan2(x-truck.x,truck.y-y)));cache=null;update();return true;}$('bridge-'+choosing+'-x').value=String(Math.floor(x));$('bridge-'+choosing+'-y').value=String(Math.floor(y));choosing=choosing==='from'?'to':'from';update();return true;}
  $('builder-plan').onclick=open;$('bridge-close').onclick=()=>panel.hidden=true;
  $('bridge-profile').onchange=()=>{cache=null;update();const p=preview();if(p.from&&p.to)frame(p);};
  $('bridge-method').onchange=()=>{cache=null;update();};$('bridge-direction').onchange=()=>{cache=null;update();const p=preview();if(!p.error)frame(p);};
  for(const bank of ['from','to']){$('bridge-pick-'+bank).onclick=()=>{choosing=bank;update();};for(const axis of ['x','y'])$('bridge-'+bank+'-'+axis).oninput=update;}
  $('bridge-confirm').onclick=async()=>{const p=preview();if(!p||p.error||busy)return;busy=true;update();try{await api('logistics/bridge',{from:p.from,to:p.to,profile:p.profile});panel.hidden=true;frame(p);notify('Anchors set. Cables tensioning, then deck unrolling. The builder stays anchored until complete.');}catch(e){$('bridge-message').textContent=e.message;}finally{busy=false;$('bridge-confirm').disabled=!!preview()?.error;}};
  return {active,preview,update,pick,close:()=>panel.hidden=true};
}
