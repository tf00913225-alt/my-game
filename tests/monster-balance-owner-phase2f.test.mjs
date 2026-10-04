import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
import {loadBossDiagnostic,buildBossTtkMatrix} from '../scripts/boss-balance-ttk-matrix.mjs';
const plain=v=>JSON.parse(JSON.stringify(v));
const stats=m=>[m.maxHP,m.maxSP,m.attack,m.magicAttack,m.defense,m.agility];
function verify(m){
 const p=MonsterBalance.preview(m.balanceProjection.identity);
 assert.equal(m.balanceOwner,'MonsterBalance');assert.deepEqual(plain(m.balanceProjection),p);
 assert.deepEqual(stats(m),Object.values(p.final));
 assert.equal(p.base.abilityPointBudget,(m.level-1)*5);
 assert.equal(Object.values(p.allocation).reduce((a,b)=>a+b,0),(m.level-1)*5);
 assert.deepEqual(p.pendingProductDecisions,[]);assert.equal(p.legacyMultiplier,'NONE');
 assert.equal(m.v132Dungeon,undefined);assert.equal(m.v141ExtraHP,undefined);
}
test('nine Personal identities and sixteen World stages have deterministic boss projections',()=>{
 const c=loadBossDiagnostic();
 assert.equal(c.GameplaySystem.personalBosses.length,9);assert.equal(c.GameplaySystem.worldBosses.length,4);
 for(const [type,definitions] of [['personal',c.GameplaySystem.personalBosses],['world',c.GameplaySystem.worldBosses]])for(const d of definitions)for(const stage of type==='world'?[1,2,3,4]:[1]){
  const a=c.__bossDiagnostic.build(d,{mode:type,stage}),b=c.__bossDiagnostic.build(d,{mode:type,stage});verify(a);
  assert.equal(a.rank,'boss');assert.equal(a.mode,type==='world'?'worldBoss':'personalBoss');
  assert.equal(a.level,d.level);assert.equal(a.archetype,'balanced');assert.deepEqual(plain(a.balanceProjection),plain(b.balanceProjection));
  const elite=MonsterBalance.preview({...a.balanceProjection.identity,rank:'elite'});assert.deepEqual(elite.allocation,a.balanceProjection.allocation);
  assert.equal(c.getEnemyPressureMultiplier(a,vm.runInContext('player',c)),a.balanceProjection.finalDamagePressure);
  a.v132Dungeon=true;a.v141Abyss=true;assert.equal(c.getEnemyPressureMultiplier(a,vm.runInContext('player',c)),a.balanceProjection.finalDamagePressure);
  assert.ok(a.skillIds.every(id=>vm.runInContext("skillDatabase",c)[id].element===d.element));
 }
});
test('World stage stats and pressure are owner-only; reinforcements retain Elite profiles',()=>{
 const c=loadBossDiagnostic(),d=c.GameplaySystem.worldBosses[0];let previous;
 for(const stage of [1,2,3,4]){
  const boss=c.__bossDiagnostic.build(d,{mode:'world',stage});verify(boss);
  if(previous){assert.ok(boss.maxHP>previous.maxHP);assert.ok(boss.balanceProjection.finalDamagePressure>previous.balanceProjection.finalDamagePressure);assert.equal(boss.attack,previous.attack);}
  previous=boss;
  const guards=c.__bossDiagnostic.support(d,{mode:'world',stage});assert.equal(guards.length,2);
  for(const m of guards){verify(m);assert.equal(m.rank,'elite');assert.equal(m.balanceProjection.profiles.stage.hp,1);assert.equal(m.balanceProjection.profiles.rank.hp,1.5);}
 }
 for(const worldStage of [0,5,1.5,null])assert.throws(()=>MonsterBalance.build({...previous.balanceProjection.identity,worldStage}));
 assert.throws(()=>MonsterBalance.build({...previous.balanceProjection.identity,rank:'smallBoss'}));
});
test('formal shield/object/summon lifecycle retains one snapshot and original slots',()=>{
 const c=loadBossDiagnostic();vm.runInContext('prepareWildBalanceReferenceParty(100,3);battleActive=false;vGameplayStartBoss("personal","personal-100");',c);
 const boss=vm.runInContext('monsters[0]',c),owner=c.FourSymbolsBattlefieldSlots,snapshot=owner.getActiveEnemySnapshot();verify(boss);
 assert.deepEqual(Array.from(c.FourSymbolsBossBattle.getBossFootprintSlots()).sort(),['ENEMY_B2','ENEMY_B3','ENEMY_B4','ENEMY_F2','ENEMY_F3','ENEMY_F4']);
 const shield=c.GameplaySystem.debugSpawnBossObject('shield','fixture');assert.equal(shield.amount,Math.round(boss.maxHP*.24));
 assert.equal(c.FourSymbolsBossBattle.getShieldState().current,shield.amount);
 const object=c.GameplaySystem.debugSpawnBossObject('defense','fixture');assert.equal(object.balanceOwner,undefined);assert.equal(object.canAct,false);assert.equal(object.noRewards,true);
 assert.equal(object.maxHP,Math.max(Math.round(boss.maxHP*.18),(180+boss.level*28)*3));
 assert.equal(object.defense,Math.round(boss.defense*.4));
 object.alive=false;object.hp=0;c.FourSymbolsBossBattle.onEnemyDeath(1,object);
 boss.hp=boss.maxHP*.2;c.FourSymbolsBossBattle.processRound();
 const guards=vm.runInContext('monsters.filter(m=>m.vGameplayBossSupport)',c);assert.equal(guards.length,2);
 guards.forEach(verify);assert.deepEqual(Array.from(guards,m=>m.vGameplayBattlefieldSlot),['ENEMY_B1','ENEMY_B5']);
 assert.equal(owner.getActiveEnemySnapshot(),snapshot);assert.equal(c.FourSymbolsBossBattle.ownsEnemyFormationSnapshot(snapshot),true);
 verify(boss);
});
test('all formal Runtime legacy numerical builders and unused defense metadata are physically retired',()=>{
 const source=['js/00-main.js','js/27-v132-content-expansion.js','js/gameplay-boss-tower-system.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
 assert.doesNotMatch(source,/makeLegacyModeMonster|generateMonsterAttributePoints|v132BuildDungeonMonster|applyDungeonMonsterStrength|applyDungeonNormalBonus|applyDungeonRankStrength|bossBalanceProfile|defenseMultiplier/);
 const boss=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8');
 assert.doesNotMatch(boss,/hpFactor|attackFactor|monster\.(maxHP|attack|magicAttack|defense|agility)\s*=/);
 const c=loadBossDiagnostic();assert.equal(c.v132BuildDungeonMonster,undefined);assert.equal(c.makeLegacyModeMonster,undefined);
 assert.throws(()=>c.makeZoneMonster('ambiguous',40,'fire','boss'));
});
test('formal TTK matrix executes all Boss mechanisms, survives and obeys control caps',()=>{
 for(const randomPolicy of ['neutral','seeded']){
  const r=buildBossTtkMatrix({randomPolicy});assert.equal(r.cases,25);assert.equal(r.gate.passed,true);
  for(const row of r.rows){assert.ok(row.clear&&row.survivors>0);assert.ok(row.rounds>1&&row.rounds<30);assert.ok(row.mechanismEvents.every(e=>e.snapshotOwner));assert.ok(row.controls.every(e=>e.chance<=60));}
  assert.ok(r.rows.some(r=>r.shieldUsage>0));assert.ok(r.rows.some(r=>r.reinforcementUsage===2));assert.ok(r.rows.some(r=>r.mechanismEvents.some(e=>e.objects.length)));
 }
});

test('288 frozen starting-dev projections preserve every prior-mode numerical profile',()=>{
 const evidence=JSON.parse(fs.readFileSync('tests/fixtures/monster-balance-p2f-prior-modes.json','utf8'));
 assert.equal(evidence.sourceHead,'9fff3664d2767739fe8cd5c893f2985f8032d5ef');
 assert.equal(evidence.rows.length,288);
 assert.deepEqual([...new Set(evidence.rows.map(r=>r.spec.mode))].sort(),['abyss','adventure','daily','tower','wild']);
 for(const row of evidence.rows){const p=MonsterBalance.preview(row.spec);assert.deepEqual(p.allocation,row.allocation);assert.deepEqual(p.final,row.final);assert.equal(p.finalDamagePressure,row.pressure);}
});
