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
  const getActive=()=>read(KEYS.active,null);
  const getSessions=()=>read(KEYS.sessions,[]);

  function elapsedSec(session=getActive(),now=Date.now()){
    if(!session)return 0;
    return Math.max(0,Math.floor((now-Number(session.startedAt))/1000));
  }

  function startWorkSession({cargoId,stage,stageLabel}){
    if(getActive())throw new Error('ACTIVE_SESSION_EXISTS');
    const cargo=getCargo();
    const c=cargo.find(x=>x.id===cargoId);
    if(!c)throw new Error('CARGO_NOT_FOUND');
    const active={
      sessionId:uid(),
      cargoId:c.id,
      cargoTitle:c.title,
      category:c.category,
      stage,
      stageLabel,
      startedAt:Date.now()
    };
    c.currentStageKey=stage;
    c.currentState='active';
    c.currentStage=stageLabel+'中';
    c.updatedAt=nowISO();
    write(KEYS.cargo,cargo);
    write(KEYS.active,active);
    return active;
  }

  function closeWorkSession(done){
    const active=getActive();
    if(!active)return null;
    const end=Date.now();
    const sessions=getSessions();
    const record={
      id:active.sessionId,
      cargoId:active.cargoId,
      cargoTitle:active.cargoTitle,
      category:active.category,
      stage:active.stage,
      stageLabel:active.stageLabel,
      startedAt:new Date(Number(active.startedAt)).toISOString(),
      endedAt:new Date(end).toISOString(),
      durationSec:Math.max(0,Math.floor((end-Number(active.startedAt))/1000)),
      endReason:done?'completed':'paused'
    };
    sessions.push(record);
    write(KEYS.sessions,sessions);

    const cargo=getCargo();
    const c=cargo.find(x=>x.id===active.cargoId);
    if(c){
      c.currentStageKey=active.stage;
      c.currentState=done?'completed':'active';
      c.currentStage=active.stageLabel+(done?'済':'中');
      c.updatedAt=nowISO();
      write(KEYS.cargo,cargo);
    }
    localStorage.removeItem(KEYS.active);
    return record;
  }

  window.HubSession={
    KEYS,
    read,
    write,
    getCargo,
    getActive,
    getSessions,
    elapsedSec,
    startWorkSession,
    pauseWorkSession:()=>closeWorkSession(false),
    completeWorkSession:()=>closeWorkSession(true)
  };
})();
