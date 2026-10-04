import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';

export function loadBossDiagnostic(){
  const {context:c}=loadLegacyRuntime();
  c.__gameplayBossTowerInstalled=false;
  const src=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8').replace('    window.GameplaySystem=Object.freeze({','    window.__bossDiagnostic={build:buildBossMonster,support:buildBossSupportRoster,context:()=>activeBattleContext};\n    window.GameplaySystem=Object.freeze({');
  vm.runInContext(src,c);
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  vm.runInContext(`updateUI=()=>{};saveGame=()=>{};finishPlayerAction=()=>{};renderBattle=()=>{};
    checkBattleEnd=()=>monsters.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0);
    v132LaunchDungeonBattle=(roster,callback)=>{monsters=roster;currentBattleMonsters=roster.map((m,i)=>i);battleActive=true;battleToken++;battlePhase='resolve';actionReady=true;return true;};`,c);
  return c;
}
export function buildBossTtkMatrix({randomPolicy='neutral'}={}){
  if(!['neutral','seeded'].includes(randomPolicy))throw new TypeError('Unknown random policy');
  const rows=[];
  const catalog=loadBossDiagnostic().GameplaySystem;
  const cases=[...catalog.personalBosses.map(d=>({type:'personal',id:d.id,level:d.level,stage:1})),...catalog.worldBosses.flatMap(d=>[1,2,3,4].map(stage=>({type:'world',id:d.id,level:d.level,stage})))];
  for(const spec of cases){
    const c=loadBossDiagnostic();c.__bossInput={...spec,randomPolicy};
    rows.push(JSON.parse(vm.runInContext(`JSON.stringify((()=>{
      const {type,id,level,stage,randomPolicy}=__bossInput;
      const randomSeed=level*100+stage;let state=randomSeed;
      Math.random=randomPolicy==='neutral'?()=>.5:()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
      const reference=prepareWildBalanceReferenceParty(level,level<60?2:3);
      battleActive=false;turn=1;
      if(type==='world'){const s=GameplaySystem.getSerializableState();s.world[id].completedStages=stage-1;GameplaySystem.debugReloadState(s);}
      if(!vGameplayStartBoss(type,id))throw Error('Formal Boss entry rejected '+id);
      const boss=monsters[0],ctx=__bossDiagnostic.context();
      const projection={id,level,element:boss.element,archetype:boss.archetype||null,HP:boss.maxHP,SP:boss.maxSP,attack:boss.attack,magicAttack:boss.magicAttack,defense:boss.defense,speed:boss.agility,pressure:getEnemyPressureMultiplier(boss,player),owner:boss.balanceOwner||'legacy',skillChance:boss.skillChance,phases:ctx.totalPhases,mechanism:ctx.objectPlan,summon:ctx.summonPlan};
      const initialParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
      const skills=[],controls=[],mechanismEvents=[];const badge=showMonsterSkillNameBadge,roll=rollStatusEffectHit;
      showMonsterSkillNameBadge=(name,...args)=>{skills.push({round:turn,name});return badge(name,...args);};
      rollStatusEffectHit=(...args)=>{const hit=roll(...args);if(args[5])controls.push({round:turn,chance:calculateStatusEffectChance(...args),rank:args[6],hit});return hit;};
      autoBattle=true;for(const i of getExistingPartyIndexes()){const cfg=getPartyAutoConfig(i);cfg.enabled=true;cfg.skill=reference.skill;}
      let rounds=0,firstRoundParty;
      for(let round=1;round<=60;round++){
        turn=round;rounds++;
        FourSymbolsBossBattle.processRound();
        const snapshot=FourSymbolsBattlefieldSlots.getActiveEnemySnapshot();
        mechanismEvents.push({round,phase:ctx.combatPhase,shield:FourSymbolsBossBattle.getShieldState(),objects:FourSymbolsBossBattle.getActiveMechanisms(),reinforcements:monsters.filter(m=>m.vGameplayBossSupport).length,snapshotOwner:FourSymbolsBossBattle.ownsEnemyFormationSnapshot(snapshot)});
        for(const action of buildInitiativeQueue()){
          if(checkBattleEnd())break;
          if(action.type==='monster'){processSingleMonsterAttack(action.monsterIndex,battleToken);continue;}
          const i=action.characterIndex;activeBattleCharacterIndex=i;if(getPartyCharacterByIndex(i).hp<=0)continue;
          autoActionForCharacter(i,battleToken);resolveQueuedPlayerAction(i,battleToken);
        }
        consumeRoundEndDurations();
        if(round===1)firstRoundParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
        if(checkBattleEnd())break;
      }
      return {...projection,type,stage,randomPolicy,randomSeed,reference,rounds,clear:monsters.every(m=>!m.alive||m.hp<=0),survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,initialParty,firstRoundParty,playerHPAfter:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),skills,controls,mechanismEvents,shieldUsage:mechanismEvents.filter(e=>e.shield).length,reinforcementUsage:ctx.supportCount,finalBossHP:boss.hp,finalEnemies:monsters.map(m=>({name:m.name,hp:m.hp,alive:m.alive,kind:m.unitKind}))};
    })())`,c)));
  }
  const failures=rows.filter(r=>!r.clear||!r.survivors);
  return {workId:'MONSTER-BALANCE-OWNER-P2F-BOSS-20261004',randomPolicy,cases:rows.length,method:'Formal Boss definitions/entry, reference player stats and skills, initiative, enemy skills/AI, damage/status, Round End and Boss mechanism owner (shield/object/charge/heal/summon/phase); isolated synchronous diagnostic, not natural browser proof.',gate:{passed:failures.length===0,failures:failures.map(({id,stage,rounds,clear,survivors})=>({id,stage,rounds,clear,survivors}))},rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=buildBossTtkMatrix({randomPolicy:process.argv.includes('--seeded')?'seeded':'neutral'});
  const output=process.argv.slice(2).find(a=>!a.startsWith('--'));if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({cases:report.cases,gate:report.gate,rows:report.rows.map(({id,stage,rounds,clear,survivors,HP,attack,pressure,shieldUsage,reinforcementUsage})=>({id,stage,rounds,clear,survivors,HP,attack,pressure,shieldUsage,reinforcementUsage}))}));
  if(!report.gate.passed&&!process.argv.includes('--baseline'))process.exitCode=1;
}
