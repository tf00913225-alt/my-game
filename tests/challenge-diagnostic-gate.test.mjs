import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MonsterBalance,towerLevelForFloor} from '../js/combat/monster-balance-owner.mjs';
import {evaluateChallengeDiagnostic} from '../scripts/lib/challenge-diagnostic-gate.mjs';

function matrix(){
  return ['fire','water','wind','earth'].flatMap(element=>['regular','elite','smallBoss'].flatMap(kind=>[10,30,50,70,100].map(floor=>{
    const spec={monsterKey:'gate.test',name:'塔衛',element,rank:kind,archetype:'balanced',level:towerLevelForFloor(floor),mode:'tower',context:'tower/floor/'+floor};
    const p=MonsterBalance.preview(spec);
    const monster={spec,owner:'MonsterBalance',level:spec.level,hp:p.final.maxHP,sp:p.final.maxSP,attack:p.final.physicalAttack,magicAttack:p.final.magicAttack,defense:p.final.defense,speed:p.final.speed,pressure:p.finalDamagePressure};
    return {element,floor,kind,partySize:2,rounds:10,clear:false,survivors:0,initialParty:[100,100],finalParty:[0,0],reference:{skillCost:1,skillBudget:2},initialMonsters:Array.from({length:10},()=>structuredClone(monster))};
  })));
}

test('unequipped losses are evidence while incorrect projections still fail',()=>{
  const rows=matrix();
  assert.equal(evaluateChallengeDiagnostic(rows,'tower').passed,true);
  for(const mutate of [
    r=>{r[0].initialMonsters[0].hp+=1500;},
    r=>{r[0].initialMonsters[0].level=10;},
    r=>{r[0].initialMonsters[0].pressure*=2;},
    r=>{r[0].finalParty[0]=NaN;},
    r=>{r[0].reference.skillCost=3;},
    r=>{r[0].controlUsage={rolls:[{targetRank:'boss',chance:61}]};},
    r=>{r[0].rounds=61;},
    r=>{r[1]=r[0];},
    r=>{r.pop();}
  ]){
    const corrupt=structuredClone(rows);mutate(corrupt);
    assert.equal(evaluateChallengeDiagnostic(corrupt,'tower').passed,false);
  }
});
