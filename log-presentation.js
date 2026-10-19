// Read our JSON events from plain stdout or a Fly-prefixed line. Unknown output
// is ignored rather than echoing potentially sensitive arbitrary server text.
export function parseAuditLine(line){
 let value=line;
 for(let depth=0;depth<3;depth++){
  if(typeof value==='string'){
   const start=value.indexOf('{');if(start<0)return null;
   try{value=JSON.parse(value.slice(start));}catch{return null;}
  }
  if(value&&typeof value.event==='string'&&typeof value.at==='string')return value;
  value=value?.message??value?.log?.message;
 }
 return null;
}
const clean=v=>String(v).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,200);
const short=v=>clean(v).slice(0,12);
export function presentAudit(event){
 const who=event.actorId?`${event.name||'Player'} (${short(event.actorId)})`:event.kind==='system'?'system':'anonymous';
 const parts=[event.at,'room '+(event.campaignId?short(event.campaignId):'-'),who];
 if(event.unitType)parts.push(event.unitType+(event.unitId?' '+short(event.unitId):'')+(event.unitState?' ['+event.unitState+']':''));
 parts.push(event.command||event.action||event.event);
 if(event.outcome)parts.push(event.outcome);
 if(event.unitAfterType)parts.push('now using '+event.unitAfterType);
 if(event.count!=null)parts.push(event.count+(event.event==='activity.summary'?' requests':' events'));
 if(event.targetType)parts.push('target '+event.targetType+(event.targetId?' '+short(event.targetId):''));
 else if(event.targetId)parts.push('target '+short(event.targetId));
 if(event.weapon)parts.push(event.weapon);
 if(event.hp!=null)parts.push('HP '+event.hp);
 if(event.reason||event.cause)parts.push(event.reason||event.cause);
 if(event.requestId)parts.push('request '+short(event.requestId));
 return parts.map(clean).join(' | ');
}
