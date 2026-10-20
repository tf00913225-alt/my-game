import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';
import {fileURLToPath} from 'node:url';

// Isolated diagnostic: real launch/queue/AI/settlement/waves, virtual presentation clock.
// Does not model human decisions, device rendering or player experience acceptance.
export function loadTowerAiRuntime(){
  const {context:c}=loadLegacyRuntime();
  const timers=new Map();let id=100,clock=0;
  c.Date=class extends Date {static now(){return (c.__diagnosticNow||Date.UTC(2026,9,20))+clock;}};
  c.setTimeout=(fn,ms)=>{timers.set(++id,{fn,at:clock+Math.max(0,Number(ms)||0)});return id;};
  c.clearTimeout=key=>timers.delete(key);
  c.queueMicrotask=queueMicrotask;
  c.requestAnimationFrame=fn=>c.setTimeout(()=>fn(clock),16);
  c.cancelAnimationFrame=c.clearTimeout;
  c.performance.now=()=>clock;
  c.v154PreparePortraitsForEncounter=()=>({state:'ready'});
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  const run=source=>vm.runInContext(source,c,{timeout:10000});
  const json=source=>JSON.parse(run('JSON.stringify('+source+')'));
  run(`
    showPage=()=>{};saveGame=()=>{};updateUI=()=>{};renderPlayers=()=>{};populateSkillQuickBar=()=>{};
    renderBattle=()=>{v138EnsureEnemyFormationSnapshot(currentBattleMonsters);};
    window.v141PresentBattleWave=({replace,complete})=>{replace();complete();return ()=>{};};
    window.v142GetRemainingAnimationMs=()=>0;
    v131GrantElementBoxHours(8,32);
    window.__declarations=[];window.__outcomes=[];
    const diagnosticBadge=showMonsterSkillNameBadge;
    showMonsterSkillNameBadge=function(name,element,index){
      const m=monsters[index];
      const skillId=Object.keys(skillDatabase).find(id=>skillDatabase[id].name===name)||'normal';
      __declarations.push({round:turn,token:battleToken,index,initiative:initiativeIndex,skillId,sp:m.sp,role:m.vTowerCombatRole});
      return diagnosticBadge.apply(this,arguments);
    };
  `);
  function next(){
    const entry=Array.from(timers).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!entry)return false;
    timers.delete(entry[0]);clock=entry[1].at;entry[1].fn();return true;
  }
  function setElement(element){
    for(let i=0;i<4;i++){const now=Date.UTC(2026,9,20)+i*7*86400000;const week=c.GameplaySystem.getWeekInfo(now);if(week.element===element){c.__diagnosticNow=now;run("GameplaySystem.debugReloadState({},Date.now())");return;}}
    throw new Error("element week missing");
  }
  return {c,run,json,next,timers,setElement};
}
export async function simulateTowerAi({elements=['fire','earth','water','wind'],floors=[10,50,100],seeds=Array.from({length:16},(_,i)=>i+1)}={}){
  const rows=[];
  for(const element of elements)for(const floor of floors)for(const seed of seeds){
    const r=loadTowerAiRuntime();
    r.c.__case={element,floor,seed};r.timers.clear();r.setElement(element);
    r.run(`
      battleActive=false;autoPatrolEnabled=false;autoBattle=true;autoBattleTimer=0;
      prepareWildBalanceReferenceParty(Math.max(30,__case.floor),__case.floor>=50?3:2);
      {let seed=__case.seed;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
      {const state=GameplaySystem.getSerializableState();state.tower.element=__case.element;GameplaySystem.debugReloadState(state);}
      __declarations=[];__outcomes=[];
      __waves=GameplaySystem.buildTowerWaves(__case.floor);
      for(const i of getExistingPartyIndexes()){const config=getPartyAutoConfig(i);config.enabled=true;config.skill=__case.floor>=30?'phoenixCry':'fireRocket';}
      v132LaunchDungeonBattle(__waves[0],outcome=>__outcomes.push(outcome.result),{mode:'tower',waves:__waves});
    `);
    let steps=0;
    while(!r.json('__outcomes.length')&&steps++<25000){if(!r.next())break;await new Promise(resolve=>setImmediate(resolve));if(r.run('turn')>100)break;}
    const row=r.json(`({element:__case.element,floor:__case.floor,seed:__case.seed,rounds:turn,outcomes:__outcomes,declarations:__declarations,wave:FourSymbolsBattleWaves.getState(),active:battleActive})`);
    row.steps=steps;
    const seen=new Set();row.followUpCasts=[];
    row.declarations=row.declarations.filter(d=>{const key=[d.token,d.round,d.initiative,d.index].join(":");if(seen.has(key)){row.followUpCasts.push(d);return false;}seen.add(key);return true;});
    rows.push(row);
    // Release the formal session before replacing diagnostic actors.
    if(r.run('battleActive'))r.run("v132AbortDungeonBattle('diagnostic-bound');");
  }
  return {workId:'TOWER-AI-DIVERSITY-20261020',method:'Formal launcher, initiative queue, round boundaries, skill/target/damage/status/heal owners and two-wave settlement; seeded RNG; virtual presentation clock; no human experience acceptance.',rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=await simulateTowerAi();
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:report.rows.length,outcomes:report.rows.reduce((a,r)=>(a[r.outcomes[0]||'unfinished']=(a[r.outcomes[0]||'unfinished']||0)+1,a),{}),declarations:report.rows.reduce((n,r)=>n+r.declarations.length,0),maxRounds:Math.max(...report.rows.map(r=>r.rounds))}));
}
