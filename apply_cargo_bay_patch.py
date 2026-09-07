from pathlib import Path
import re, sys

p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
t=p.read_text(encoding='utf-8')
original=t

# Shared engines must load before the inline widget script.
if '<script src="./hub-session.js"></script>' not in t:
    t=t.replace('<script>', '<script src="./hub-session.js"></script>\n<script>', 1)
if '<script src="./hub-focus.js"></script>' not in t:
    t=t.replace('<script src="./hub-session.js"></script>', '<script src="./hub-session.js"></script>\n<script src="./hub-focus.js"></script>', 1)

# v5-only styles. Append safely before the first responsive block.
style='''
.meterHead{display:flex;align-items:center;justify-content:space-between;gap:6px}
.meterReset,.phaseSwitch{border:0;background:transparent;color:var(--muted2);cursor:pointer;padding:0;line-height:1}.meterReset{font-size:16px}.phaseSwitch{font-size:11px;border:1px solid var(--border2);border-radius:6px;padding:2px 6px}.phaseSwitch:disabled{opacity:.35;cursor:default}
.pomoConfig{display:flex;align-items:center;gap:4px;margin-top:4px;color:var(--muted2);font-size:10px;white-space:nowrap}.miniSel{height:22px;padding:0 3px;border:1px solid var(--border2);border-radius:6px;background:var(--control);color:var(--muted);font-size:10px}
.timerBlink{animation:timerBlink .18s linear 5 alternate}@keyframes timerBlink{from{opacity:1}to{opacity:.15}}
'''
if '.meterHead{' not in t:
    pos=t.find('@media(max-width:1180px)')
    if pos<0: raise SystemExit('ERROR: responsive style marker missing')
    t=t[:pos]+style+t[pos:]

# Replace current v4 Timer panel markup only.
old=re.compile(r'''<section class="panel">\s*<div class="taskrow">\s*<div class="activeTask"><div id="activeTaskTitle" class="activeTaskTitle">作業なし</div><div id="activeTaskStage" class="activeTaskStage">Cargo Bayから開始</div></div>\s*<div class="actions">.*?</div>\s*</div>\s*<div class="times">\s*<div class="meter"><div class="label">Work</div><div id="work" class="value">00:00:00</div><div id="workSub" class="tiny">Idle</div></div>\s*<div class="meter"><div class="label">Pomodoro</div><div id="pomoTime" class="value off">Off</div><div id="pomoSub" class="tiny">Focus 25 / Break 5</div></div>\s*</div>\s*</section>''',re.S)
new='''<section class="panel">
      <div class="taskrow">
        <div class="activeTask"><div id="activeTaskTitle" class="activeTaskTitle">作業なし</div><div id="activeTaskStage" class="activeTaskStage">Cargo Bayから開始</div></div>
        <div class="actions">
          <button id="pomoBtn" class="pomoBtn" title="Pomodoro ON/OFF">POMO</button>
          <button id="resume" class="btn" disabled title="Work再開">▶</button>
          <button id="pause" class="btn" disabled title="Work中断 / Sessionは継続">⏸</button>
          <button id="sessionClose" class="btn" disabled title="Session終了">■</button>
        </div>
      </div>
      <div class="times">
        <div class="meter">
          <div class="meterHead"><div class="label">Work</div><button id="workReset" class="meterReset" title="このSessionのWork時間だけリセット">↻</button></div>
          <div id="work" class="value">00:00:00</div><div id="workSub" class="tiny">Idle</div>
        </div>
        <div class="meter">
          <div class="meterHead"><div class="label">Pomodoro</div><button id="pomoReset" class="meterReset" title="現在のFocus / Breakを今からやり直す">↻</button></div>
          <div id="pomoTime" class="value off">Off</div><div id="pomoSub" class="tiny">Focus 25 / Break 5</div>
          <div class="pomoConfig">F <select id="focusDuration" class="miniSel"><option>15</option><option>20</option><option selected>25</option><option>30</option><option>45</option><option>60</option></select> B <select id="breakDuration" class="miniSel"><option selected>5</option><option>10</option><option>15</option><option>20</option></select><button id="phaseSwitch" class="phaseSwitch" disabled>F/B</button></div>
        </div>
      </div>
    </section>'''
t,n=old.subn(new,t,count=1)
if n!=1: raise SystemExit('ERROR: current v4 Timer HTML not found; patch aborted')

# Replace Timer/Pomo JS only. Clock / Weather / Vocabulary are outside this range.
a=t.find('// Timer / Pomo')
b=t.find('// Weather',a)
if a<0 or b<0: raise SystemExit('ERROR: Timer/Weather markers missing')
js=r'''// Timer / Pomo
const work=q('#work'),workSub=q('#workSub'),pomoTime=q('#pomoTime'),pomoSub=q('#pomoSub'),pomoBtn=q('#pomoBtn'),resume=q('#resume'),pause=q('#pause'),sessionClose=q('#sessionClose'),workReset=q('#workReset'),pomoReset=q('#pomoReset'),phaseSwitch=q('#phaseSwitch'),focusDuration=q('#focusDuration'),breakDuration=q('#breakDuration'),activeTaskTitle=q('#activeTaskTitle'),activeTaskStage=q('#activeTaskStage'),HS=window.HubSession,HF=window.HubFocus,K=HS.KEYS;
let lastPomoRemaining=null,lastPomoTickAt=Date.now();
const activeSession=()=>HS.getActive();
function mmssSigned(sec){const sign=sec<0?'+':'';return sign+mmss(Math.abs(sec))}
function syncDurationControls(){const s=HF.settings();focusDuration.value=String(Math.round(s.focusDurationSec/60));breakDuration.value=String(Math.round(s.breakDurationSec/60))}
function pomoRemaining(state){return HF.durationFor(state)-HF.elapsedSec()}
function maybeBlinkPomo(state,remaining,now){const foregroundGap=now-lastPomoTickAt<2200;if(state.mode!=='off'&&lastPomoRemaining!==null&&lastPomoRemaining>0&&remaining<=0&&foregroundGap){pomoTime.classList.remove('timerBlink');void pomoTime.offsetWidth;pomoTime.classList.add('timerBlink')}lastPomoRemaining=state.mode==='off'?null:remaining;lastPomoTickAt=now}
function buttons(){const a=activeSession(),ps=HF.getState(),has=!!a,working=has&&a.phase==='work';resume.disabled=!has||working;pause.disabled=!has||!working;sessionClose.disabled=!has;workReset.disabled=!has;pomoReset.disabled=ps.mode==='off';phaseSwitch.disabled=ps.mode==='off';pomoBtn.classList.toggle('active',ps.mode!=='off')}
function render(){const now=Date.now(),a=activeSession(),ps=HF.getState();work.textContent=hms(HS.workElapsedSec(a,now));activeTaskTitle.textContent=a?.cargoTitle||'作業なし';activeTaskStage.textContent=a?(a.stageLabel+' · '+(a.phase==='break'?'Break':'Working')):'Cargo Bayから開始';workSub.textContent=a?(a.stageLabel+(a.phase==='break'?' · Break '+mmss(HS.breakElapsedSec(a,now)):' · Working')):'Idle';if(ps.mode==='off'){pomoTime.textContent='Off';pomoTime.className='value off';pomoSub.textContent='Focus '+focusDuration.value+' / Break '+breakDuration.value;maybeBlinkPomo(ps,0,now)}else{const rem=pomoRemaining(ps);pomoTime.className='value';pomoTime.textContent=mmssSigned(rem);pomoSub.textContent=ps.mode==='focus'?'Focus':'Break';maybeBlinkPomo(ps,rem,now)}buttons()}
function stopPomoForWork(reason,end=Date.now()){if(HF.getState().mode!=='off')HF.stop(reason,end)}
function closeCurrentSession(completeStage=false,reason='closed'){const a=activeSession();if(!a)return;const end=Date.now();stopPomoForWork(reason,end);const focusSec=HF.focusTotalForWorkSession(a.sessionId,{includeActive:false,now:end});try{HS.closeSession({completeStage,reason,focusDurationSec:focusSec,endedAt:end})}catch(e){console.error(e);alert('Session保存に失敗しました。タイマーは保持されています。\n'+e.message);return}lastPomoRemaining=null;render()}
setInterval(render,1000);
resume.onclick=()=>{try{HS.resumeWork()}catch(e){console.error(e)}render()};
pause.onclick=()=>{if(!activeSession())return;HS.pauseWork();stopPomoForWork('work_paused');render()};
sessionClose.onclick=()=>closeCurrentSession(false,'closed');
workReset.onclick=()=>{if(activeSession())HS.resetWorkClock();render()};
pomoBtn.onclick=()=>{const ps=HF.getState();if(ps.mode==='off')HF.startFocus(activeSession());else HF.stop('manual_off');lastPomoRemaining=null;render()};
pomoReset.onclick=()=>{HF.resetPhase(Date.now(),activeSession());lastPomoRemaining=null;render()};
phaseSwitch.onclick=()=>{const ps=HF.getState();if(ps.mode==='off')return;HF.switchMode(ps.mode==='focus'?'break':'focus',activeSession(),Date.now(),'manual_phase');lastPomoRemaining=null;render()};
focusDuration.onchange=()=>{HF.setDuration('focus',Number(focusDuration.value)*60);render()};
breakDuration.onchange=()=>{HF.setDuration('break',Number(breakDuration.value)*60);render()};
window.addEventListener('storage',e=>{if(Object.values(K).includes(e.key)||Object.values(HF.KEYS).includes(e.key)){syncDurationControls();render()}});
syncDurationControls();

'''
t=t[:a]+js+t[b:]

backup=p.with_suffix(p.suffix+'.before-v5')
backup.write_text(original,encoding='utf-8')
p.write_text(t,encoding='utf-8')
print('patched:',p)
print('backup:',backup)
