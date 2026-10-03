import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadLegacyRuntime} from './monster-balance-shadow-matrix.mjs';

const ELEMENTS=['fire','water','wind','earth'];
const CASES=[
  ...[9,29,49,69,99].map(floor=>({floor,kind:'regular'})),
  ...[5,25,45,65,95].map(floor=>({floor,kind:'elite'})),
  ...[10,30,50,70,100].map(floor=>({floor,kind:'smallBoss'}))
];

export function buildTowerTtkMatrix(){
  const {context:c}=loadLegacyRuntime();
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  vm.runInContext('updateUI=()=>{};saveGame=()=>{};Math.random=()=>.5;',c);
  const rows=[];
  for(const element of ELEMENTS)for(const entry of CASES){
    c.__towerInput={element,...entry};
    const row=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
      const {element,floor,kind}=__towerInput;
      const partySize=floor>=50?3:2;
      const reference=prepareWildBalanceReferenceParty(floor,partySize);
      const roster=[];
      if(kind==='smallBoss'){
        roster.push(__shadowTower.boss({id:'tower-diagnostic-'+floor,name:'守關者',level:floor,element},floor));
        roster.push(__shadowTower.troop(floor,element,'elite',floor,0));
        roster.push(__shadowTower.troop(floor,element,'elite',floor,1));
      }else if(kind==='elite'){
        roster.push(__shadowTower.troop(floor,element,'elite',floor,0));
        roster.push(__shadowTower.troop(floor,element,'elite',floor,1));
      }
      while(roster.length<10)roster.push(__shadowTower.troop(floor,element,'regular',floor,roster.length));
      monsters=roster;currentZone='dungeon';currentBattleMonsters=roster.map((m,i)=>i);
      window.v132ActiveDungeonRun={mode:'tower'};battleToken++;battleActive=true;battlePhase='resolve';actionReady=true;
      FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();Math.random=()=>.5;
      const initialParty=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
      const initialMonsters=roster.map(m=>({rank:m.rank,level:m.level,hp:m.maxHP,sp:m.maxSP,attack:m.attack,magicAttack:m.magicAttack,defense:m.defense,speed:m.agility,owner:m.balanceOwner,pressure:m.balanceProjection.finalDamagePressure}));
      let rounds=0;
      for(let round=1;round<=12;round++){
        turn=round;rounds++;
        for(const action of buildInitiativeQueue()){
          if(monsters.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
          if(action.type==='monster'){processSingleMonsterAttack(action.monsterIndex,battleToken);continue;}
          const i=action.characterIndex;activeBattleCharacterIndex=i;
          if(getPartyCharacterByIndex(i).hp<=0)continue;
          queuedPlayerActions[i]=chooseWildBalanceReferenceAction(i,reference.skill);
          resolveQueuedPlayerAction(i,battleToken);
        }
        consumeRoundEndDurations();
        if(monsters.every(m=>!m.alive||m.hp<=0)||getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp<=0))break;
      }
      return {
        element,floor,kind,partySize,reference,rounds,
        clear:monsters.every(m=>!m.alive||m.hp<=0),
        survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,
        initialParty,finalParty:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),
        initialMonsters
      };
    })())`,c));
    rows.push(row);
  }
  const failures=rows.filter(row=>!row.clear||row.survivors===0);
  return {
    workId:'MONSTER-BALANCE-OWNER-P2C-TOWER-20261004',
    method:'Formal current player stats/skills, initiative, enemy AI, damage and status owners; neutral 0.5 rolls; 2 members below floor50 and 3 members from floor50. Animation lifecycle is verified separately in Chrome.',
    cases:rows.length,failures,rows
  };
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=buildTowerTtkMatrix();
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
  const summary={
    cases:report.cases,
    failures:report.failures.map(r=>({element:r.element,floor:r.floor,kind:r.kind,rounds:r.rounds,clear:r.clear,survivors:r.survivors})),
    maxRounds:Math.max(...report.rows.map(r=>r.rounds)),
    byKind:Object.fromEntries(['regular','elite','smallBoss'].map(kind=>[kind,{
      min:Math.min(...report.rows.filter(r=>r.kind===kind).map(r=>r.rounds)),
      max:Math.max(...report.rows.filter(r=>r.kind===kind).map(r=>r.rounds))
    }]))
  };
  console.log(JSON.stringify(summary));
  if(report.failures.length)process.exitCode=1;
}
