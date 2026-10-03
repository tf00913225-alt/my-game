import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';
export function buildDailyTtkMatrix(){
 const rows=[];
 const {context:c}=loadLegacyRuntime();
 vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
 vm.runInContext('updateUI=()=>{};saveGame=()=>{};Math.random=()=>.5;',c);
 for(const level of [10,20,30,50,70,100])for(const partySize of [1,2,3])for(const type of ['exp','material','gold']){
  c.__input={level,partySize,type};
  const row=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
   const {level,partySize,type}=__input,reference=prepareWildBalanceReferenceParty(level,partySize);
   const built=v148BuildDailyDungeonWaves(type),waves=[];
   window.v132ActiveDungeonRun={mode:'daily',partySize,highestPartyLevel:level,dailyDungeonType:type};
   for(let wave=0;wave<3;wave++){
    monsters=built.waves[wave];currentZone='dungeon';currentBattleMonsters=monsters.map((m,i)=>i);
    const initial=monsters.map(m=>MonsterBalance.debug(m)),before=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
    battleToken++;battleActive=true;battlePhase='resolve';actionReady=true;
    FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();let rounds=0;const hits=[];
    for(let round=1;round<=10;round++){
     turn=round;rounds++;
     for(const entry of buildInitiativeQueue()){
      if(monsters.every(m=>!m.alive||m.hp<=0))break;
      if(entry.type==='monster'){
       const b=getExistingPartyIndexes().reduce((s,i)=>s+getPartyCharacterByIndex(i).hp,0);
       let skillName=null;const badge=showMonsterSkillNameBadge;
       showMonsterSkillNameBadge=function(name){skillName=String(name);return badge.apply(this,arguments);};
       try{processSingleMonsterAttack(entry.monsterIndex,battleToken);}finally{showMonsterSkillNameBadge=badge;}
       const a=getExistingPartyIndexes().reduce((s,i)=>s+getPartyCharacterByIndex(i).hp,0);
       hits.push({rank:getMonsterRank(monsters[entry.monsterIndex]),skillName,damage:b-a});continue;
      }
      const i=entry.characterIndex;activeBattleCharacterIndex=i;
      if(getPartyCharacterByIndex(i).hp<=0)continue;
      queuedPlayerActions[i]=chooseWildBalanceReferenceAction(i,reference.skill);resolveQueuedPlayerAction(i,battleToken);
     }
     consumeRoundEndDurations();
     if(monsters.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
    }
    const after=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
    waves.push({wave:wave+1,rounds,clear:monsters.every(m=>!m.alive||m.hp<=0),before,after,averageDamageTaken:before.reduce((s,n,i)=>s+n-after[i],0)/partySize,hits,initial});
   }
   return {level,partySize,type,reference,waves};
  })())`,c));rows.push(row);
 }
 return {workId:'MONSTER-BALANCE-OWNER-P2B-DAILY-20261003',method:'Existing reference party; formal action/stat/damage/status owners with .5 rolls in isolated VM. Three waves retain cumulative player HP/SP. Animation/lifecycle verified separately in Chrome.',rows};
}
if(process.argv[1]?.endsWith('daily-balance-ttk-matrix.mjs')){
 const report=buildDailyTtkMatrix();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:report.rows.length,waves:report.rows.length*3,maxRounds:Math.max(...report.rows.flatMap(r=>r.waves.map(w=>w.rounds))),fail:report.rows.flatMap(r=>r.waves.filter(w=>!w.clear||w.rounds>2).map(w=>({level:r.level,size:r.partySize,type:r.type,wave:w.wave,rounds:w.rounds,clear:w.clear}))) }));
}
