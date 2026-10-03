import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';
export function buildWildTtkMatrix(){
 const rows=[];
 for(const level of [10,30,50,70,100])for(const element of ['fire','water','wind','earth'])for(const elite of [false,true]){
  const {context:c}=loadLegacyRuntime();
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  c.__input={level,element,elite};
  const row=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
   updateUI=()=>{};saveGame=()=>{};const {level,element,elite}=__input;
   const reference=prepareWildBalanceReferenceParty(level),encounter=buildWildBalanceReferenceRoster(level,element,elite);
   monsters=encounter.roster;currentZone=encounter.zone;currentBattleMonsters=monsters.map((m,i)=>i);
   battleToken++;battleActive=true;battlePhase='resolve';actionReady=true;Math.random=()=>.5;
   FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();const history=[];
   for(let round=1;round<=12;round++){
    turn=round;
    for(const entry of buildInitiativeQueue()){
     if(monsters.every(m=>!m.alive||m.hp<=0))break;
     if(entry.type==='monster'){processSingleMonsterAttack(entry.monsterIndex,battleToken);continue;}
     const i=entry.characterIndex;activeBattleCharacterIndex=i;
     if(getPartyCharacterByIndex(i).hp<=0)continue;
     queuedPlayerActions[i]=chooseWildBalanceReferenceAction(i,reference.skill);resolveQueuedPlayerAction(i,battleToken);
    }
    consumeRoundEndDurations();history.push(monsters.map(m=>m.hp));
    if(monsters.every(m=>!m.alive||m.hp<=0))break;
   }
   return {level,element,elite,reference,rounds:history.length,clear:monsters.every(m=>!m.alive||m.hp<=0),survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,history};
  })())`,c));
  rows.push(row);
 }
 return {workId:'MONSTER-BALANCE-OWNER-P2A-WILD-20261003',method:'Formal action/stat/damage/status functions in isolated VM; no animation timers. Natural lifecycle separately verified in Chrome.',rows};
}
if(process.argv[1]?.endsWith('wild-balance-ttk-matrix.mjs')){
 const report=buildWildTtkMatrix();
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({rows:report.rows.length,maxRegular:Math.max(...report.rows.filter(r=>!r.elite).map(r=>r.rounds)),maxElite:Math.max(...report.rows.filter(r=>r.elite).map(r=>r.rounds))}));
}
