import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';

export function buildAbyssTtkMatrix({randomPolicy='neutral',caseFilter=null}={}){
  if(!['neutral','seeded'].includes(randomPolicy))throw new TypeError('Unknown Abyss diagnostic random policy');
  const {context:c}=loadLegacyRuntime();
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  vm.runInContext('updateUI=()=>{};saveGame=()=>{};renderPlayers=()=>{};populateSkillQuickBar=()=>{};renderBattle=()=>{v138EnsureEnemyFormationSnapshot(currentBattleMonsters);};v154PreparePortraitsForEncounter=()=>({state:"ready"});',c);
  const timers=new Map();let timerId=0,clock=0;
  c.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:clock+Math.max(0,Number(ms)||0)});return id;};
  c.clearTimeout=id=>timers.delete(id);c.performance.now=()=>clock;
  c.__advanceDiagnosticClock=()=>{const entry=Array.from(timers).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)return false;timers.delete(entry[0]);clock=entry[1].at;entry[1].fn();return true;};
  const rows=[];
  for(const difficulty of [20,40])for(const offset of [0,10,20])for(let region=0;region<5;region++)for(let stage=0;stage<5;stage++){
    if(caseFilter&&!caseFilter({difficulty,partyLevel:difficulty+offset,region,stage})){continue;}
    timers.clear();clock=0;
    c.__abyssInput={difficulty,partyLevel:difficulty+offset,region,stage,randomPolicy};
    const row=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
      const {difficulty,partyLevel,region,stage,randomPolicy}=__abyssInput;
      const randomSeed=difficulty*100000+region*1000+stage*100+partyLevel;let randomState=randomSeed;
      Math.random=randomPolicy==='neutral'?()=>.5:()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
      const partySize=partyLevel>=50?3:2;
      const reference=prepareWildBalanceReferenceParty(partyLevel,partySize);
      const waves=v174AbyssBuildWaves(difficulty,region,stage),roster=waves.flat();
      let outcome=null;window.v132ActiveDungeonRun=null;battleActive=false;
      FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();
      v131GrantElementBoxHours(1,32);autoConfig.enabled=true;autoConfig.skill=reference.skill;autoBattle=true;for(const i of getExistingPartyIndexes()){const config=getPartyAutoConfig(i);config.enabled=true;config.skill=reference.skill;}
      const initialParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
      const initialMonsters=roster.map(m=>({name:m.name,rank:m.rank,level:m.level,element:m.element,hp:m.maxHP,sp:m.maxSP,attack:m.attack,magicAttack:m.magicAttack,defense:m.defense,speed:m.agility,owner:m.balanceOwner||'legacy',pressure:getEnemyPressureMultiplier(m,player),skillFrequency:m.skillChance,skillIds:m.skillIds,supportIds:m.v141SupportSkillIds||[]}));
      let rounds=0,firstRoundParty=null;const skills=[],controlRolls=[];const badgeOwner=showMonsterSkillNameBadge,statusRollOwner=rollStatusEffectHit;
      rollStatusEffectHit=function(...args){const hit=statusRollOwner(...args);if(args[5])controlRolls.push({round:turn,targetRank:args[6],chance:calculateStatusEffectChance(...args),hit});return hit;};
      showMonsterSkillNameBadge=function(name,...args){skills.push(name);return badgeOwner(name,...args);};
      const unsubscribeRound=FourSymbolsBattleFlow.subscribeRoundEnd(()=>{if(turn===1)firstRoundParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);});
      try{
        if(!v132LaunchDungeonBattle(waves[0],result=>{outcome=result.result;},{mode:'abyss',waves,normalizeFailureResources:false})){throw new Error('formal Abyss launch refused');}
        for(let step=0;step<20000&&outcome===null;step++){
          if(turn>60){v132AbortDungeonBattle('diagnostic-round-limit');break;}
          if(!__advanceDiagnosticClock()){throw new Error('formal Abyss queue stalled '+JSON.stringify({battlePhase,turn,initiativeIndex,queue:initiativeQueue.length,battleActive,autoBattle,locks:battlePresentationLocks.size,wave:FourSymbolsBattleWaves.getState(),actionReady,activeBattleCharacterIndex}));}
          rounds=Math.max(rounds,turn);
          if(turn>1&&!firstRoundParty){firstRoundParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);}
        }
        if(outcome===null){throw new Error('formal Abyss diagnostic clock exhausted');}
        if(!firstRoundParty){firstRoundParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);}
      }finally{unsubscribeRound();showMonsterSkillNameBadge=badgeOwner;rollStatusEffectHit=statusRollOwner;}
      return {difficulty,partyLevel,region,stage,randomPolicy,randomSeed:randomPolicy==='seeded'?randomSeed:null,partySize,reference,rounds,clear:outcome==='win',survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,initialParty,firstRoundParty,finalParty:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),initialMonsters,enemySkillActions:skills,finalMonsters:roster.map(m=>({name:m.name,hp:m.hp,sp:m.sp,statuses:m.statusEffects})),controlUsage:{attempts:controlRolls.length,hits:controlRolls.filter(r=>r.hit).length,rolls:controlRolls}};
    })())`,c));
    rows.push(row);
  }
  const failures=rows.filter(r=>!r.clear||r.survivors===0);
  const unexpectedLosses=failures.filter(r=>!(r.difficulty===40&&r.partyLevel===40&&r.region===4&&r.stage===4));
  const instantWipes=rows.filter(r=>r.firstRoundParty.every(hp=>hp<=0));
  const gate={passed:unexpectedLosses.length===0&&instantWipes.length===0,policy:'All unlock/+10/+20 references clear+survive, except the explicitly retained unequipped two-member Lv40 final challenge loss. Final +10/+20 three-member references must clear; no first-round wipe, no 2-round target.',unexpectedLosses,instantWipes};
  return {gate,randomPolicy,workId:'MONSTER-BALANCE-OWNER-P2D-ABYSS-20261004',method:'Formal Abyss roster, current player stat/skill owners, the actual shared launch, two-wave controller, Core Queue, enemy AI, damage/status and round-end owners under a deterministic diagnostic timer. Default neutral0.5 or per-case seeded LCG rolls recorded in randomPolicy/randomSeed; two members below Lv50, three from Lv50, no equipment; animation lifecycle requires separate Chrome evidence.',cases:rows.length,failures,rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=buildAbyssTtkMatrix({randomPolicy:process.argv.includes('--seeded')?'seeded':'neutral'});
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({gate:report.gate.passed,cases:report.cases,failures:report.failures.map(({difficulty,partyLevel,region,stage,rounds,clear,survivors})=>({difficulty,partyLevel,region,stage,rounds,clear,survivors})),ranges:Object.fromEntries([20,40].map(d=>[d,Object.fromEntries([0,10,20].map(offset=>{const rows=report.rows.filter(r=>r.difficulty===d&&r.partyLevel===d+offset);return [d+offset,{min:Math.min(...rows.map(r=>r.rounds)),max:Math.max(...rows.map(r=>r.rounds)),clears:rows.filter(r=>r.clear&&r.survivors>0).length}];}))]))}));
  if(!report.gate.passed&&!process.argv.includes('--baseline'))process.exitCode=1;
}
