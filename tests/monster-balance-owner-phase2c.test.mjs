import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {MonsterBalance,TOWER_MODE_PROFILE} from '../js/combat/monster-balance-owner.mjs';

const elements=['fire','water','earth','wind'];
const baseSpec=(floor,element,rank='regular',slot=0)=>({
  monsterKey:`tower.${element}.${rank}.${floor}.${slot}`,
  name:rank==='smallBoss'?'四象守關者':'四象塔衛',
  level:floor,element,archetype:'balanced',rank,mode:'tower',context:`tower/floor/${floor}`
});

test('Tower Runtime build is explicit, floor=N, deterministic and owner-only',()=>{
  for(const element of elements)for(let floor=1;floor<=100;floor++){
    const ranks=floor%10===0?['smallBoss','elite','elite',...Array(7).fill('regular')]
      :floor%5===0?['elite','elite',...Array(8).fill('regular')]
      :Array(10).fill('regular');
    const roster=ranks.map((rank,slot)=>MonsterBalance.build(baseSpec(floor,element,rank,slot)));
    assert.equal(roster.length,10);
    assert.equal(roster.filter(m=>m.rank==='smallBoss').length,floor%10===0?1:0);
    assert.equal(roster.filter(m=>m.rank==='elite').length,floor%5===0?2:0);
    for(const monster of roster){
      assert.equal(monster.level,floor);
      assert.equal(monster.mode,'tower');
      assert.equal(monster.context,`tower/floor/${floor}`);
      assert.equal(monster.balanceOwner,'MonsterBalance');
      assert.equal(monster.archetype,'balanced');
      assert.equal(Object.hasOwn(monster,'v132Dungeon'),false);
      assert.equal(Object.hasOwn(monster,'v132EquipmentDungeon'),false);
      assert.equal(monster.balanceProjection.legacyMultiplier,'NONE');
      assert.equal(monster.balanceProjection.pendingProductDecisions.length,0);
      assert.equal(monster.balanceProjection.base.abilityPointBudget,(floor-1)*5);
      assert.deepEqual(monster.balanceProjection.allocation,MonsterBalance.preview(baseSpec(floor,element,monster.rank)).allocation);
    }
  }
});

test('Tower ranks change only approved final profiles, never the six-stat budget',()=>{
  for(const floor of [1,5,10,30,50,70,100])for(const element of elements){
    const regular=MonsterBalance.preview(baseSpec(floor,element,'regular'));
    const elite=MonsterBalance.preview(baseSpec(floor,element,'elite'));
    assert.deepEqual(elite.allocation,regular.allocation);
    assert.equal(elite.profiles.rank.hp,1.5);
    assert.equal(elite.profiles.rank.defense,1.1);
    assert.equal(elite.profiles.rank.finalDamagePressure,1.1);
    assert.equal(elite.finalDamagePressure,1.1*TOWER_MODE_PROFILE.damage);
    assert.equal(elite.final.physicalAttack,elite.derived.physicalAttack);
    assert.equal(elite.final.magicAttack,elite.derived.magicAttack);
    if(floor%10===0){
      const boss=MonsterBalance.preview(baseSpec(floor,element,'smallBoss'));
      assert.deepEqual(boss.allocation,regular.allocation);
      assert.equal(boss.profiles.rank.hp,3);
      assert.equal(boss.profiles.rank.defense,1.15);
      assert.equal(boss.profiles.rank.finalDamagePressure,1.15);
      assert.equal(boss.finalDamagePressure,1.15*TOWER_MODE_PROFILE.damage);
    }
  }
});

test('Tower element stat projection is owned once while gameplay metadata stays explicit',()=>{
  const fire=MonsterBalance.preview(baseSpec(50,'fire'));
  assert.deepEqual(fire.profiles.element.metadata,{criticalBonusPercent:15,directDamageMultiplier:1.15});
  const water=MonsterBalance.preview(baseSpec(50,'water'));
  assert.deepEqual(water.profiles.element.metadata,{healingMultiplier:1.15,statusAccuracyPercent:15,aiPreference:'support'});
  const wind=MonsterBalance.preview(baseSpec(50,'wind'));
  assert.equal(wind.final.speed,wind.derived.speed*1.15);
  assert.deepEqual(wind.profiles.element.metadata,{evasionBonusPercent:15});
  const earth=MonsterBalance.preview(baseSpec(50,'earth'));
  assert.equal(earth.final.maxHP,Math.round(earth.derived.maxHP*TOWER_MODE_PROFILE.hp*1.15));
  assert.equal(earth.final.defense,Math.round(earth.derived.defense*1.15));
});

test('Tower construction no longer calls legacy V132 stats or post-writes migrated stats',()=>{
  const gameplay=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8');
  const troop=gameplay.slice(gameplay.indexOf('function buildTowerTroop('),gameplay.indexOf('function buildTowerRoster('));
  assert.match(troop,/buildTowerBalanceMonster/);
  assert.doesNotMatch(troop,/buildBaseMonster|v132BuildDungeonMonster|bossBalanceProfile/);
  assert.doesNotMatch(gameplay,/function towerMonsterLevel\s*\(/);
  const element=gameplay.slice(gameplay.indexOf('function applyTowerElementProfile('),gameplay.indexOf('function bindTowerMonsterIdentity('));
  assert.doesNotMatch(element,/monster\.agility\s*=|monster\.defense\s*=|monster\.maxHP\s*=|monster\.hp\s*=\s*monster\.maxHP/);
  assert.match(element,/vTowerCriticalBonusPercent=15/);
  assert.match(element,/vTowerStatusAccuracyPercent=15/);
  assert.match(element,/monster\.evasion=numeric\(monster\.evasion,0\)\+15/);
});

test('core settlement consumes Tower owner pressure and smallBoss keeps boss compatibility semantics',()=>{
  const core=fs.readFileSync('js/00-main.js','utf8');
  assert.match(core,/\["wild","daily","tower","abyss"\]\.includes\(attacker\.mode\)/);
  assert.match(core,/monster\.rank==="smallBoss"[\s\S]{0,80}return "boss"/);
  const legacy=fs.readFileSync('js/27-v132-content-expansion.js','utf8');
  assert.match(legacy,/NON-DAILY COMPATIBILITY ONLY/);
});

console.log('Monster Balance Owner Phase 2C Tower contract passed.');
