export function frenzyUI({api,notify}){
 const button=document.getElementById('frenzy-test'),status=document.getElementById('frenzy-status');let enabled=false,busy=false;
 button.onclick=async()=>{busy=true;button.disabled=true;try{await api('frenzy/test',{});notify('Mixed surge incoming. Bring HE or magnetic rounds for Bulwarks.');}catch(e){notify(e.message);}finally{busy=false;}};
 function update(state,me,connected){
  if(typeof state.testEvents==='boolean')enabled=state.testEvents;
  const f=state.combat?.frenzy,active=f&&f.phase!=='complete';
  button.hidden=!enabled||(state.room&&state.room.ownerPilot!==me?.id);
  button.disabled=busy||!connected||!!active||!!state.room?.paused||me?.life!=='active'||!['robot','tank','rover'].includes(me?.body);
  status.hidden=!active;if(!active)return;
  const seconds=Math.max(0,Math.ceil((f.until-state.combat.time)/1000));
  status.dataset.source=f.source||'test';
  status.textContent=f.phase==='warning'?`${f.source==='natural'?'RAID':'TEST SURGE'} IN ${seconds}s / ${f.count+f.points.length} incoming`:
   f.phase==='surge'?`TRACKING SIGNAL ${seconds}s / ${f.hunters} hunters + ${f.raiders} raiders`:
   `SIGNAL ENDED / recovery ${seconds}s`;
  if(f.medium==='sea')status.textContent+=` / ${f.roster?.swimmer||0} swimmers`;
  if(f.roster&&['warning','surge'].includes(f.phase))status.textContent+=` / Hunter ${f.roster.hunter} · Breaker ${f.roster.breaker} · Bulwark ${f.roster.bulwark} / Twin ${f.roster['twin-lens']||0} / Heavy lens ${f.roster['heavy-lens']||0}`;
 }
 return {update};
}
