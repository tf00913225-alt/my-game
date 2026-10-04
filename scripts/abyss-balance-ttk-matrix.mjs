import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';

export function buildAbyssTtkMatrix(){
  const {context:c}=loadLegacyRuntime();
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  vm.runInContext('updateUI=()=>{};saveGame=()=>{};finishPlayerAction=()=>{};',c);
  const rows=[];
  for(const difficulty of [20,40])for(const offset of [0,10,20])for(let region=0;region<5;region++)for(let stage=0;stage<5;stage++){
    c.__abyssInput={difficulty,partyLevel:difficulty+offset,region,stage};
    const row=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
      const {difficulty,partyLevel,region,stage}=__abyssInput;
      Math.random=()=>.5;
      const partySize=partyLevel>=50?3:2;
      const reference=prepareWildBalanceReferenceParty(partyLevel,partySize);
      const roster=v174AbyssBuildRoster(difficulty,region,stage);
      monsters=roster;currentZone='dungeon';currentBattleMonsters=roster.map((m,i)=>i);
      window.v132ActiveDungeonRun={mode:'abyss'};battleToken++;battleActive=true;battlePhase='resolve';actionReady=true;
      FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();
      autoBattle=true;for(const i of getExistingPartyIndexes()){const config=getPartyAutoConfig(i);config.enabled=true;config.skill=reference.skill;}
      const initialParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
      const initialMonsters=roster.map(m=>({name:m.name,rank:m.rank,level:m.level,element:m.element,hp:m.maxHP,sp:m.maxSP,attack:m.attack,magicAttack:m.magicAttack,defense:m.defense,speed:m.agility,owner:m.balanceOwner||'legacy',pressure:getEnemyPressureMultiplier(m,player),skillFrequency:m.skillChance,skillIds:m.skillIds,supportIds:m.v141SupportSkillIds||[]}));
      let rounds=0,firstRoundParty=null;const skills=[];const badgeOwner=showMonsterSkillNameBadge;
      showMonsterSkillNameBadge=function(name,...args){skills.push(name);return badgeOwner(name,...args);};
      try{
        for(let round=1;round<=60;round++){
          turn=round;rounds++;
          for(const action of buildInitiativeQueue()){
            if(monsters.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
            if(action.type==='monster'){processSingleMonsterAttack(action.monsterIndex,battleToken);continue;}
            const i=action.characterIndex;activeBattleCharacterIndex=i;
            if(getPartyCharacterByIndex(i).hp<=0)continue;
            autoActionForCharacter(i,battleToken);
            resolveQueuedPlayerAction(i,battleToken);
          }
          consumeRoundEndDurations();
          if(round===1)firstRoundParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
          if(monsters.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
        }
      }finally{showMonsterSkillNameBadge=badgeOwner;}
      return {difficulty,partyLevel,region,stage,partySize,reference,rounds,clear:monsters.every(m=>!m.alive||m.hp<=0),survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,initialParty,firstRoundParty,finalParty:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),initialMonsters,enemySkillActions:skills,finalMonsters:roster.map(m=>({name:m.name,hp:m.hp,sp:m.sp,statuses:m.statusEffects})),controlUsage:skills.filter(name=>/冰|石|凍|封/.test(name)).length};
    })())`,c));
    rows.push(row);
  }
  const failures=rows.filter(r=>!r.clear||r.survivors===0);
  const unexpectedLosses=failures.filter(r=>!(r.difficulty===40&&r.partyLevel===40&&r.region===4&&r.stage===4));
  const instantWipes=rows.filter(r=>r.firstRoundParty.every(hp=>hp<=0));
  const gate={passed:unexpectedLosses.length===0&&instantWipes.length===0,policy:'All unlock/+10/+20 references clear+survive, except the explicitly retained unequipped two-member Lv40 final challenge loss. Final +10/+20 three-member references must clear; no first-round wipe, no 2-round target.',unexpectedLosses,instantWipes};
  return {gate,workId:'MONSTER-BALANCE-OWNER-P2D-ABYSS-20261004',method:'Formal Abyss roster, current player stat/skill owners, initiative, enemy AI, damage/status and round-end owners. Neutral 0.5 rolls; two members below Lv50, three from Lv50, no equipment; animation lifecycle requires separate Chrome evidence.',cases:rows.length,failures,rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=buildAbyssTtkMatrix();
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({gate:report.gate.passed,cases:report.cases,failures:report.failures.map(({difficulty,partyLevel,region,stage,rounds,clear,survivors})=>({difficulty,partyLevel,region,stage,rounds,clear,survivors})),ranges:Object.fromEntries([20,40].map(d=>[d,Object.fromEntries([0,10,20].map(offset=>{const rows=report.rows.filter(r=>r.difficulty===d&&r.partyLevel===d+offset);return [d+offset,{min:Math.min(...rows.map(r=>r.rounds)),max:Math.max(...rows.map(r=>r.rounds)),clears:rows.filter(r=>r.clear&&r.survivors>0).length}];}))]))}));
  if(!report.gate.passed&&!process.argv.includes('--baseline'))process.exitCode=1;
}
