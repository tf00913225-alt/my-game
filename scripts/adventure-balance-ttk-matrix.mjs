import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';

export function loadAdventureDiagnostic(){
  const {context:c}=loadLegacyRuntime();
  for(const file of ['adventure-content','adventure-runtime']){
    let source=fs.readFileSync(`js/adventure/${file}-v1-20260915.js`,'utf8');
    // Private builder exposure stays inside this isolated diagnostic VM.
    if(file==='adventure-runtime')source=source.replace('    window.FourSymbolsAdventure=Object.freeze({','    window.__adventureDiagnosticBuild=buildEncounter;\n    window.FourSymbolsAdventure=Object.freeze({');
    vm.runInContext(source,c);
  }
  return c;
}
export function buildAdventureTtkMatrix({randomPolicy='neutral'}={}){
  if(!['neutral','seeded'].includes(randomPolicy))throw new TypeError('Unknown random policy');
  const c=loadAdventureDiagnostic();
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  vm.runInContext('updateUI=()=>{};saveGame=()=>{};finishPlayerAction=()=>{};',c);
  const rows=[];
  for(const [encounterIndex,encounter] of Object.values(c.FourSymbolsAdventureContent.encounters).entries())for(const offset of [0,5,10])for(const partySize of [1,2]){
    const node=c.FourSymbolsAdventureContent.chapters.chapter_v1.nodes.find(n=>n.encounterId===encounter.id);
    c.__adventureInput={encounterId:encounter.id,partyLevel:node.suggestedLevel+offset,partySize,encounterIndex,randomPolicy};
    rows.push(JSON.parse(vm.runInContext(`JSON.stringify((()=>{
      const {encounterId,partyLevel,partySize,encounterIndex,randomPolicy}=__adventureInput;
      const randomSeed=10000+encounterIndex*1000+partyLevel*10+partySize;let randomState=randomSeed;
      Math.random=randomPolicy==='neutral'?()=>.5:()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
      const reference=prepareWildBalanceReferenceParty(partyLevel,partySize),roster=__adventureDiagnosticBuild(encounterId);
      monsters=roster;currentZone='dungeon';currentBattleMonsters=roster.map((m,i)=>i);
      window.v132ActiveDungeonRun={mode:'adventure'};battleToken++;battleActive=true;battlePhase='resolve';actionReady=true;
      FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();autoBattle=true;
      for(const i of getExistingPartyIndexes()){const config=getPartyAutoConfig(i);config.enabled=true;config.skill=reference.skill;}
      const initialParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
      const initialMonsters=roster.map(m=>({name:m.name,key:m.monsterKey,rank:m.rank,level:m.level,element:m.element,hp:m.maxHP,sp:m.maxSP,attack:m.attack,magicAttack:m.magicAttack,defense:m.defense,speed:m.agility,owner:m.balanceOwner||'legacy',pressure:getEnemyPressureMultiplier(m,player),skillFrequency:m.skillChance,skillIds:m.skillIds,supportIds:m.v141SupportSkillIds||[],portraitKey:m.portraitKey||null}));
      const skills=[],controlRolls=[];let rounds=0,firstRoundParty;
      const badgeOwner=showMonsterSkillNameBadge,statusOwner=rollStatusEffectHit;
      showMonsterSkillNameBadge=function(name,...args){skills.push({name,round:turn});return badgeOwner(name,...args);};
      rollStatusEffectHit=function(...args){const hit=statusOwner(...args);if(args[5])controlRolls.push({round:turn,targetRank:args[6],chance:calculateStatusEffectChance(...args),hit});return hit;};
      try{for(let round=1;round<=60;round++){
        turn=round;rounds++;
        for(const action of buildInitiativeQueue()){
          if(roster.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
          if(action.type==='monster'){processSingleMonsterAttack(action.monsterIndex,battleToken);continue;}
          const i=action.characterIndex;activeBattleCharacterIndex=i;if(getPartyCharacterByIndex(i).hp<=0)continue;
          autoActionForCharacter(i,battleToken);resolveQueuedPlayerAction(i,battleToken);
        }
        consumeRoundEndDurations();
        if(round===1)firstRoundParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
        if(roster.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
      }}finally{showMonsterSkillNameBadge=badgeOwner;rollStatusEffectHit=statusOwner;}
      return {encounterId,partyLevel,partySize,randomPolicy,randomSeed,reference,rounds,clear:roster.every(m=>!m.alive||m.hp<=0),survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,initialParty,firstRoundParty,finalParty:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),initialMonsters,skillUsage:skills,controlUsage:controlRolls};
    })())`,c)));
  }
  const failures=rows.filter(r=>!r.clear||!r.survivors),instantWipes=rows.filter(r=>r.firstRoundParty.every(hp=>hp<=0));
  return {workId:'MONSTER-BALANCE-OWNER-P2E-ADVENTURE-20261004',randomPolicy,cases:rows.length,method:'All three formal encounters; suggested/+5/+10 level, legal solo/two-member unequipped reference, final stat/skill/initiative/AI/damage/status/round-end owners. No asynchronous animation claims.',gate:{passed:failures.length===0&&instantWipes.length===0,failures,instantWipes},rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=buildAdventureTtkMatrix({randomPolicy:process.argv.includes('--seeded')?'seeded':'neutral'});
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({cases:report.cases,gate:report.gate.passed,rows:report.rows.map(({encounterId,partyLevel,partySize,rounds,clear,survivors})=>({encounterId,partyLevel,partySize,rounds,clear,survivors}))}));
  if(!report.gate.passed&&!process.argv.includes('--baseline'))process.exitCode=1;
}
