from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html"); t=p.read_text(encoding="utf-8"); original=t
if '<script src="./hub-session.js"></script>' not in t:
    t=t.replace('<script>', '<script src="./hub-session.js"></script>\n<script>', 1)
if '<script src="./hub-focus.js"></script>' not in t:
    t=t.replace('<script src="./hub-session.js"></script>', '<script src="./hub-session.js"></script>\n<script src="./hub-focus.js"></script>', 1)
t=t.replace(""".taskrow{display:grid;grid-template-columns:minmax(116px,1fr) auto;gap:6px;align-items:center}
.sel{width:100%;min-width:0;height:38px;padding:0 10px;border-radius:8px;border:1px solid var(--border2);background:var(--sub);color:var(--fg);font-size:14px}""",""".taskrow{display:grid;grid-template-columns:minmax(116px,1fr) auto;gap:6px;align-items:center}
.activeTask{min-width:0;height:38px;padding:5px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--sub);display:flex;flex-direction:column;justify-content:center}.activeTaskTitle{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.activeTaskStage{font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}""")
t=t.replace(".btn{width:38px;font-size:16px}#start{font-size:13px}.btn#stop,.btn#finish{font-size:19px}",".btn{width:38px;font-size:16px}.btn#stop,.btn#finish{font-size:19px}")
old="""        <select id="task" class="sel">
          <option value="">— Select task —</option>
          <option>Hub Terminal UI設計</option>
          <option>Deco Reco 仕様変更</option>
          <option>Ticket 構想整理</option>
          <option>その他</option>
        </select>
        <div class="actions">
          <button id="pomoBtn" class="pomoBtn">POMO</button>
          <button id="start" class="btn active">▶</button>
          <button id="stop" class="btn" disabled>⏸</button>
          <button id="finish" class="btn" disabled>✓</button>
        </div>
        <div id="err" class="err"></div>"""
new="""        <div class="activeTask"><div id="activeTaskTitle" class="activeTaskTitle">作業なし</div><div id="activeTaskStage" class="activeTaskStage">Cargo Bayから開始</div></div>
        <div class="actions"><button id="pomoBtn" class="pomoBtn">POMO</button><button id="stop" class="btn" disabled title="中断">⏸</button><button id="finish" class="btn" disabled title="完了">✓</button></div>"""
if old not in t: raise SystemExit("ERROR: timer HTML changed; patch aborted")
t=t.replace(old,new); a=t.find("// Timer / Pomo"); b=t.find("// Weather",a)
if a<0 or b<0: raise SystemExit("ERROR: timer markers missing")
js="""// Timer / Pomo
const work=q('#work'),workSub=q('#workSub'),pomoTime=q('#pomoTime'),pomoSub=q('#pomoSub'),stop=q('#stop'),finish=q('#finish'),pomoBtn=q('#pomoBtn'),activeTaskTitle=q('#activeTaskTitle'),activeTaskStage=q('#activeTaskStage'),HS=window.HubSession,HF=window.HubFocus,K=HS.KEYS;
let lastWorkSessionId=HS.getActive()?.sessionId||null;
const activeSession=()=>HS.getActive(),elapsedWork=()=>HS.elapsedSec();
function mmssSigned(sec){const sign=sec<0?'+':'';return sign+mmss(Math.abs(sec))}
function phaseDuration(state){return state.mode==='break'?HF.BREAK_SEC:HF.FOCUS_SEC}
function formatPomo(state){if(state.mode==='off')return'Off';const rem=phaseDuration(state)-HF.elapsedSec();return mmssSigned(rem)}
function buttons(){const r=!!activeSession(),ps=HF.getState();stop.classList.toggle('active',r);finish.classList.toggle('active',r);stop.disabled=!r;finish.disabled=!r;pomoBtn.classList.toggle('active',ps.mode!=='off');pomoBtn.textContent=ps.mode==='focus'?'BREAK':ps.mode==='break'?'FOCUS':'POMO'}
function workEndFor(boundId){if(!boundId)return Date.now();const rec=[...HS.getSessions()].reverse().find(x=>x.id===boundId);return rec?.endedAt?new Date(rec.endedAt).getTime():Date.now()}
function reconcilePomoWithWork(){const ps=HF.getState(),a=activeSession();if(ps.mode==='focus'&&ps.boundWorkSessionId&&!a){HF.reset('work_ended',workEndFor(ps.boundWorkSessionId))}}
function render(){reconcilePomoWithWork();const x=activeSession(),ps=HF.getState();work.textContent=hms(elapsedWork());activeTaskTitle.textContent=x?.cargoTitle||'作業なし';activeTaskStage.textContent=x?.stageLabel||'Cargo Bayから開始';workSub.textContent=x?(x.stageLabel+' · Working'):'Idle';if(ps.mode==='off'){pomoTime.textContent='Off';pomoTime.className='value off';pomoSub.textContent='Focus 25 / Break 5'}else{pomoTime.className='value';pomoTime.textContent=formatPomo(ps);pomoSub.textContent=ps.mode==='break'?'Break · 手動でFocusへ':'Focus · 手動でBreakへ'}buttons()}
setInterval(render,1000);
stop.onclick=()=>{const a=activeSession();HS.pauseWorkSession();if(HF.getState().mode!=='off')HF.reset('work_paused',a?workEndFor(a.sessionId):Date.now());lastWorkSessionId=null;render()};
finish.onclick=()=>{const a=activeSession();HS.completeWorkSession();if(HF.getState().mode!=='off')HF.reset('work_completed',a?workEndFor(a.sessionId):Date.now());lastWorkSessionId=null;render()};
pomoBtn.onclick=()=>{const ps=HF.getState();if(ps.mode==='off')HF.startFocus(activeSession());else if(ps.mode==='focus')HF.startBreak(Date.now(),'manual_break');else HF.startFocus(activeSession());render()};
window.addEventListener('storage',e=>{const focusKeys=Object.values(HF.KEYS);if(!Object.values(K).includes(e.key)&&!focusKeys.includes(e.key))return;const a=activeSession();if(e.key===K.active&&lastWorkSessionId&&!a&&HF.getState().mode!=='off')HF.reset('work_ended',workEndFor(lastWorkSessionId));lastWorkSessionId=a?.sessionId||null;render()});

"""
t=t[:a]+js+t[b:]; p.with_suffix(p.suffix+".before-cargo").write_text(original,encoding="utf-8"); p.write_text(t,encoding="utf-8"); print("patched:",p)
