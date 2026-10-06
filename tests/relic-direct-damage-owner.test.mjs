import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';

const {context:c}=loadLegacyRuntime();
const run=source=>vm.runInContext(source,c);
run('Math.random=()=>0.5; player.level=30; player.hp=1000;');
const target=run('player');
const damage=(attacker,options={})=>c.calculateDamage(1000,0,30,30,'fire','fire',
  {attacker,target,...options});

test('the final loaded canonical damage owner consumes incoming relic reduction before shields',()=>{
  for(const mode of ['wild','daily','tower','abyss','adventure','personalBoss','worldBoss']){
    const enemy={level:30,element:'fire',mode,rank:'regular'};
    c.v174RelicDamageModifiers={incomingReduction:()=>0,outgoingReduction:()=>0};
    const baseline=damage(enemy);
    c.v174RelicDamageModifiers={incomingReduction:()=>10,outgoingReduction:()=>0};
    assert.equal(c.applyPlayerDirectIncomingModifiers(target,baseline,{attacker:enemy}),Math.floor(baseline*.9),mode);
    assert.equal(damage(enemy),baseline,'incoming reduction is settled once before absorption');
  }
});

test('per-effect enemy final damage suppression covers normal, physical and magic direct damage',()=>{
  const enemy={level:30,element:'fire',rank:'boss'};
  c.v174RelicDamageModifiers={incomingReduction:()=>0,outgoingReduction:()=>0};
  const baseline=damage(enemy);
  c.v174RelicDamageModifiers={incomingReduction:()=>0,outgoingReduction:()=>9.6};
  for(const skill of [undefined,{category:'physical'},{category:'magic'}]){
    assert.equal(damage(enemy,{skill}),Math.round(baseline*.904));
  }
});

test('non-direct damage and Boss objects bypass relic direct modifiers',()=>{
  const enemy={level:30,element:'fire',rank:'regular'};
  c.v174RelicDamageModifiers={incomingReduction:()=>0,outgoingReduction:()=>0};
  const baseline=damage(enemy);
  c.v174RelicDamageModifiers={incomingReduction:()=>50,outgoingReduction:()=>50};
  for(const sourceType of ['relic','dot','reflect','environment','self','hpCost']){
    assert.equal(damage(enemy,{sourceType}),baseline,sourceType);
  }
  assert.equal(damage(enemy,{damageKind:'dot'}),baseline);
  assert.equal(damage({...enemy,vGameplayBossObject:true}),baseline);
});

test('feedback no longer performs HP refund as a second reduction owner',()=>{
  const source=fs.readFileSync('js/60-team-relic-system.js','utf8');
  const feedback=source.slice(source.indexOf('    if(typeof showPlayerHit==='),source.indexOf('    if(typeof tickStatusEffects==='));
  assert.doesNotMatch(feedback,/damageReductionPercent|const refund|character\.hp\+refund/);
});

test('fully loaded character and party getters project final relic evasion exactly once',()=>{
  c.v174GetRelicFinalEvasionPercent=()=>0;
  const base=c.getMainCharacterStats().evasion;
  c.v174GetRelicFinalEvasionPercent=()=>8;
  assert.equal(c.getMainCharacterStats().evasion,base+8);
  assert.equal(c.getPartyBattleStats(0).evasion,base+8);
  c.v174GetRelicFinalEvasionPercent=()=>0;
});

test('ordinary relic bonus shares the existing 50% cap, skill final bonus is applied once',()=>{
  const enemy={level:30,element:'fire',rank:'regular'};
  c.v174RelicDamageModifiers={ordinaryBonus:()=>10,skillFinalBonus:(_actor,source)=>source==='activeSkill'?20:0};
  assert.equal(c.getOrdinaryDamageBonusPercent({attacker:target,ordinaryDamageBonusPercent:100}),50);
  assert.equal(c.getRelicDirectDamageMultiplier(target,enemy,{attacker:target,sourceType:'activeSkill'}),1.2);
  for(const sourceType of ['normalAttack','counter','followUp','dot','relic','reflect','item','hpCost','environment']){
    assert.equal(c.getRelicDirectDamageMultiplier(target,enemy,{attacker:target,sourceType}),1,sourceType);
  }
});

test('final relic crit chance keeps the canonical 95% cap',()=>{
  run('player.activeBuffs=[]; Math.random=()=>.95;');
  const originalStats=c.getPartyBattleStats;
  c.getPartyBattleStats=index=>({...originalStats(index),statusAccuracy:100});
  c.v174RelicDamageModifiers={critBonus:()=>8};
  assert.equal(c.rollCritical(target).isCrit,false);
  run('Math.random=()=>.94999;');assert.equal(c.rollCritical(target).isCrit,true);
  run('player.activeBuffs=[];Math.random=()=>.5;');
  c.getPartyBattleStats=originalStats;
});
