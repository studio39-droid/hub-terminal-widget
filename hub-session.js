(()=>{
  'use strict';

  const KEYS={
    cargo:'hub-cargo-v1',
    active:'hub-active-session-v1',
    sessions:'hub-work-sessions-v1'
  };

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
  const nowISO=()=>new Date().toISOString();
  const getCargo=()=>read(KEYS.cargo,[]);
  const getSessions=()=>read(KEYS.sessions,[]);

  function normalizeActive(raw){
    if(!raw)return null;
    if(raw.sessionStartedAt&&raw.phase&&raw.phaseStartedAt)return raw;
    const started=Number(raw.startedAt)||Date.now();
    const migrated={
      sessionId:raw.sessionId||uid(),
      cargoId:raw.cargoId||null,
      cargoTitle:raw.cargoTitle||null,
      category:raw.category||null,
      stage:raw.stage||null,
      stageLabel:raw.stageLabel||null,
      sessionStartedAt:started,
      phase:'work',
      phaseStartedAt:started,
      workAccumSec:0,
      breakAccumSec:0,
      migratedFromV4:true
    };
    write(KEYS.active,migrated);
    return migrated;
  }

  const getActive=()=>normalizeActive(read(KEYS.active,null));

  function phaseElapsedSec(session=getActive(),now=Date.now()){
    if(!session||!session.phaseStartedAt)return 0;
    return Math.max(0,Math.floor((now-Number(session.phaseStartedAt))/1000));
  }

  function workElapsedSec(session=getActive(),now=Date.now()){
    if(!session)return 0;
    return Math.max(0,Number(session.workAccumSec)||0)+(session.phase==='work'?phaseElapsedSec(session,now):0);
  }

  function breakElapsedSec(session=getActive(),now=Date.now()){
    if(!session)return 0;
    return Math.max(0,Number(session.breakAccumSec)||0)+(session.phase==='break'?phaseElapsedSec(session,now):0);
  }

  function sessionElapsedSec(session=getActive(),now=Date.now()){
    if(!session)return 0;
    return Math.max(0,Math.floor((now-Number(session.sessionStartedAt))/1000));
  }

  function setCargoStage(cargoId,stage,stageLabel,state){
    const cargo=getCargo();
    const c=cargo.find(x=>x.id===cargoId);
    if(!c)return;
    c.currentStageKey=stage;
    c.currentState=state;
    c.currentStage=stageLabel+(state==='completed'?'済':'中');
    c.updatedAt=nowISO();
    write(KEYS.cargo,cargo);
  }

  function startWorkSession({cargoId,stage,stageLabel}){
    const existing=getActive();
    if(existing){
      if(existing.cargoId===cargoId&&existing.stage===stage&&existing.phase==='break')return resumeWork();
      throw new Error('ACTIVE_SESSION_EXISTS');
    }
    const cargo=getCargo();
    const c=cargo.find(x=>x.id===cargoId);
    if(!c)throw new Error('CARGO_NOT_FOUND');
    const now=Date.now();
    const active={
      sessionId:uid(),
      cargoId:c.id,
      cargoTitle:c.title,
      category:c.category,
      stage,
      stageLabel,
      sessionStartedAt:now,
      phase:'work',
      phaseStartedAt:now,
      workAccumSec:0,
      breakAccumSec:0
    };
    setCargoStage(c.id,stage,stageLabel,'active');
    write(KEYS.active,active);
    return active;
  }

  function pauseWork(now=Date.now()){
    const active=getActive();
    if(!active)return null;
    if(active.phase==='break')return active;
    active.workAccumSec=workElapsedSec(active,now);
    active.phase='break';
    active.phaseStartedAt=now;
    write(KEYS.active,active);
    return active;
  }

  function resumeWork(now=Date.now()){
    const active=getActive();
    if(!active)throw new Error('NO_ACTIVE_SESSION');
    if(active.phase==='work')return active;
    active.breakAccumSec=breakElapsedSec(active,now);
    active.phase='work';
    active.phaseStartedAt=now;
    write(KEYS.active,active);
    return active;
  }

  function resetWorkClock(now=Date.now()){
    const active=getActive();
    if(!active)return null;
    active.workAccumSec=0;
    if(active.phase==='work')active.phaseStartedAt=now;
    write(KEYS.active,active);
    return active;
  }

  function upsertSession(record){
    const sessions=getSessions();
    const i=sessions.findIndex(x=>x.id===record.id);
    if(i>=0)sessions[i]=record;else sessions.push(record);
    write(KEYS.sessions,sessions);
  }

  function closeSession({completeStage=false,reason='closed',focusDurationSec=0,endedAt=Date.now()}={}){
    const active=getActive();
    if(!active)return null;
    const end=Math.max(Number(active.sessionStartedAt)||0,Number(endedAt)||Date.now());
    const workSec=workElapsedSec(active,end);
    const breakSec=breakElapsedSec(active,end);
    const record={
      id:active.sessionId,
      cargoId:active.cargoId,
      cargoTitle:active.cargoTitle,
      category:active.category,
      stage:active.stage,
      stageLabel:active.stageLabel,
      startedAt:new Date(Number(active.sessionStartedAt)).toISOString(),
      endedAt:new Date(end).toISOString(),
      sessionDurationSec:sessionElapsedSec(active,end),
      workDurationSec:workSec,
      breakDurationSec:breakSec,
      focusDurationSec:Math.max(0,Math.floor(Number(focusDurationSec)||0)),
      endReason:reason,
      stageCompleted:!!completeStage
    };

    // Retry-safe close: save/upsert first; only clear active after all durable writes succeed.
    upsertSession(record);
    setCargoStage(active.cargoId,active.stage,active.stageLabel,completeStage?'completed':'active');
    localStorage.removeItem(KEYS.active);
    return record;
  }

  function taskTotals(cargoId,stage=null){
    return getSessions().filter(s=>s.cargoId===cargoId&&(!stage||s.stage===stage)).reduce((a,s)=>{
      a.sessionSec+=Number(s.sessionDurationSec??s.durationSec??0)||0;
      a.workSec+=Number(s.workDurationSec??s.durationSec??0)||0;
      a.breakSec+=Number(s.breakDurationSec??0)||0;
      a.focusSec+=Number(s.focusDurationSec??0)||0;
      a.count++;
      return a;
    },{sessionSec:0,workSec:0,breakSec:0,focusSec:0,count:0});
  }

  window.HubSession={
    KEYS,read,write,getCargo,getActive,getSessions,
    phaseElapsedSec,workElapsedSec,breakElapsedSec,sessionElapsedSec,
    startWorkSession,pauseWork,resumeWork,resetWorkClock,closeSession,taskTotals
  };
})();
