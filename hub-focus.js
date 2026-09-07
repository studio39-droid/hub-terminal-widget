(()=>{
  'use strict';
  const STATE_KEY='hub-pomo-state-v1';
  const SESSIONS_KEY='hub-focus-sessions-v1';
  const SETTINGS_KEY='hub-pomo-settings-v1';
  const DEFAULTS={focusDurationSec:1500,breakDurationSec:300};

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
  const settings=()=>({...DEFAULTS,...read(SETTINGS_KEY,DEFAULTS)});
  const saveSettings=s=>{const v={...settings(),...s};write(SETTINGS_KEY,v);return v};
  const defaultState=()=>({mode:'off',startedAt:null,focusId:null,boundWorkSessionId:null,boundCargoId:null,boundCargoTitle:null,boundStage:null,boundStageLabel:null});
  const getState=()=>({...defaultState(),...read(STATE_KEY,defaultState())});
  const getSessions=()=>read(SESSIONS_KEY,[]);

  function snapshotWork(work){
    return work?{
      boundWorkSessionId:work.sessionId||null,
      boundCargoId:work.cargoId||null,
      boundCargoTitle:work.cargoTitle||null,
      boundStage:work.stage||null,
      boundStageLabel:work.stageLabel||null
    }:{boundWorkSessionId:null,boundCargoId:null,boundCargoTitle:null,boundStage:null,boundStageLabel:null};
  }

  function startFocus(work=null,now=Date.now()){
    const state={mode:'focus',startedAt:now,focusId:uid(),...snapshotWork(work)};
    write(STATE_KEY,state);
    return state;
  }

  function closeFocus(reason='manual',endedAt=Date.now()){
    const state=getState();
    if(state.mode!=='focus'||!state.startedAt||!state.focusId)return null;
    const end=Math.max(Number(state.startedAt),Number(endedAt)||Date.now());
    const sessions=getSessions();
    const record={
      id:state.focusId,
      startedAt:new Date(Number(state.startedAt)).toISOString(),
      endedAt:new Date(end).toISOString(),
      durationSec:Math.max(0,Math.floor((end-Number(state.startedAt))/1000)),
      endReason:reason,
      workSessionId:state.boundWorkSessionId,
      cargoId:state.boundCargoId,
      cargoTitle:state.boundCargoTitle,
      stage:state.boundStage,
      stageLabel:state.boundStageLabel
    };
    if(!sessions.some(x=>x.id===record.id))sessions.push(record);
    write(SESSIONS_KEY,sessions);
    return record;
  }

  function switchMode(mode,work=null,now=Date.now(),reason='manual_switch'){
    if(!['focus','break'].includes(mode))throw new Error('INVALID_POMO_MODE');
    const prev=getState();
    if(prev.mode==='focus')closeFocus(reason,now);
    const state=mode==='focus'
      ?{mode:'focus',startedAt:now,focusId:uid(),...snapshotWork(work)}
      :{mode:'break',startedAt:now,focusId:null,...snapshotWork(null)};
    write(STATE_KEY,state);
    return state;
  }

  function stop(reason='manual_off',endedAt=Date.now()){
    closeFocus(reason,endedAt);
    const state=defaultState();
    write(STATE_KEY,state);
    return state;
  }

  function resetPhase(now=Date.now(),work=null){
    const state=getState();
    if(state.mode==='off')return state;
    if(state.mode==='focus')closeFocus('phase_reset',now);
    const next=state.mode==='focus'
      ?{mode:'focus',startedAt:now,focusId:uid(),...snapshotWork(work)}
      :{...state,startedAt:now};
    write(STATE_KEY,next);
    return next;
  }

  function elapsedSec(now=Date.now()){
    const state=getState();
    if(state.mode==='off'||!state.startedAt)return 0;
    return Math.max(0,Math.floor((now-Number(state.startedAt))/1000));
  }

  function durationFor(state=getState()){
    const s=settings();
    return state.mode==='break'?s.breakDurationSec:s.focusDurationSec;
  }

  function setDuration(mode,sec){
    sec=Math.max(60,Math.floor(Number(sec)||0));
    if(mode==='focus')return saveSettings({focusDurationSec:sec});
    if(mode==='break')return saveSettings({breakDurationSec:sec});
    throw new Error('INVALID_POMO_MODE');
  }

  function focusTotalForWorkSession(workSessionId,{includeActive=true,now=Date.now()}={}){
    if(!workSessionId)return 0;
    let total=getSessions().filter(x=>x.workSessionId===workSessionId).reduce((s,x)=>s+(Number(x.durationSec)||0),0);
    const state=getState();
    if(includeActive&&state.mode==='focus'&&state.boundWorkSessionId===workSessionId&&state.startedAt){
      total+=Math.max(0,Math.floor((now-Number(state.startedAt))/1000));
    }
    return total;
  }

  window.HubFocus={
    KEYS:{state:STATE_KEY,sessions:SESSIONS_KEY,settings:SETTINGS_KEY},
    DEFAULTS,getState,getSessions,settings,saveSettings,elapsedSec,durationFor,setDuration,
    startFocus,switchMode,stop,resetPhase,closeFocus,focusTotalForWorkSession
  };
})();
