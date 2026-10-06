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
