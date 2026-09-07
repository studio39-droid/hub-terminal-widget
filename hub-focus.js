(()=>{
  'use strict';
  const STATE_KEY='hub-pomo-state-v1';
  const SESSIONS_KEY='hub-focus-sessions-v1';
  const FOCUS_SEC=1500;
  const BREAK_SEC=300;

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
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
    sessions.push(record);
    write(SESSIONS_KEY,sessions);
    return record;
  }

  function startBreak(now=Date.now(),reason='break'){
    closeFocus(reason,now);
    const state={mode:'break',startedAt:now,focusId:null,...snapshotWork(null)};
    write(STATE_KEY,state);
    return state;
  }

  function reset(reason='reset',endedAt=Date.now()){
    closeFocus(reason,endedAt);
    const state=defaultState();
    write(STATE_KEY,state);
    return state;
  }

  function elapsedSec(now=Date.now()){
    const state=getState();
    if(state.mode==='off'||!state.startedAt)return 0;
    return Math.max(0,Math.floor((now-Number(state.startedAt))/1000));
  }

  window.HubFocus={
    KEYS:{state:STATE_KEY,sessions:SESSIONS_KEY},
    FOCUS_SEC,
    BREAK_SEC,
    getState,
    getSessions,
    elapsedSec,
    startFocus,
    startBreak,
    reset
  };
})();
