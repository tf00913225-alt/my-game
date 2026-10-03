import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {collectNonWildOutputs} from '../scripts/monster-balance-non-wild-output.mjs';
import {buildWildTtkMatrix} from '../scripts/wild-balance-ttk-matrix.mjs';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
import {syncMonsterBalanceRuntime} from '../scripts/lib/monster-balance-runtime-source.mjs';

const fields=['maxHP','maxSP','attack','magicAttack','defense','agility','attackPoints','intelligencePoints','vitalityPoints','energyPoints','defensePoints','agilityPoints'];
const plain=value=>JSON.parse(JSON.stringify(value));
const project=m=>Object.fromEntries(fields.map(k=>[k,m[k]]));
const evaluate=(c,source)=>plain(vm.runInContext(source,c));

test('528 Wild rank/element/archetype/level projections match the executed Runtime authority',()=>{
 syncMonsterBalanceRuntime(process.cwd(),true);
 const {context:c}=loadLegacyRuntime();
 let count=0;
 for(const level of [1,10,20,30,40,50,60,70,80,90,100])
 for(const archetype of Object.keys(MonsterBalance.archetypes))
 for(const rank of ['regular','elite'])for(const element of ['fire','water','wind','earth']){
  const spec={monsterKey:'diagnostic/wild',name:'診斷',level,archetype,rank,element,mode:'wild',context:'wild/zone-'+String(Math.max(1,Math.ceil(level/10))).padStart(2,'0')};
  const expected=MonsterBalance.preview(spec),actual=c.MonsterBalance.build(spec);
  assert.deepEqual(plain(actual.balanceProjection),expected);
  assert.deepEqual(c.MonsterBalance.debug(actual),plain(actual.balanceProjection));
  assert.equal(Object.values(actual.balanceProjection.allocation).reduce((a,b)=>a+b,0),(level-1)*5);
  count++;
 }
 assert.equal(count,528);
});

test('full loader, every actual zone and duplicate identity have no late stat mutation',()=>{
 const {context:c}=loadLegacyRuntime();
 const zones=evaluate(c,'Object.keys(zoneConfig).map(k=>({key:k,roster:zoneConfig[k].monsters()}))');
 const seen=new Map(),archetypes=new Set();
 for(const zone of zones)for(const m of zone.roster){
  assert.equal(m.mode,'wild');assert.equal(m.balanceOwner,'MonsterBalance');assert.ok(m.monsterKey);
  archetypes.add(m.archetype);
  const p=MonsterBalance.preview(m.balanceProjection.identity);
  assert.equal(m.maxHP,p.final.maxHP);assert.equal(m.maxSP,p.final.maxSP);
  assert.equal(m.attack,p.final.physicalAttack);assert.equal(m.magicAttack,p.final.magicAttack);
  assert.equal(m.defense,p.final.defense);assert.equal(m.agility,p.final.speed);
  if(seen.has(m.monsterKey))assert.deepEqual(project(m),seen.get(m.monsterKey));
  seen.set(m.monsterKey,project(m));
  assert.equal(m._v131StrengthApplied,undefined);assert.equal(m.v17342BeginnerStatsHalved,undefined);
 }
 assert.equal(seen.size,56);assert.equal(archetypes.size,6);
});

test('canonical Elite rerolls rebuild rank once, preserve raw points and attacks, and pressure once',()=>{
 const {context:c}=loadLegacyRuntime();
 const data=evaluate(c,`(()=>{
  monsters=zone10Monsters;currentBattleMonsters=[0];
  Math.random=()=>.5;v141RollWildMonsterRanks([0]);const regular=JSON.parse(JSON.stringify(monsters[0]));
  Math.random=()=>0;v141RollWildMonsterRanks([0]);const elite=JSON.parse(JSON.stringify(monsters[0]));
  const once=monsters[0].maxHP;v141RollWildMonsterRanks([0]);
  Object.assign(player,{id:'pressure target',level:100,element:'fire'});
  Math.random=()=>.5;
  const damage=m=>calculateDamage(m.attack,0,100,100,'fire','fire',{attacker:m,target:player});
  return {regular,elite,repeat:monsters[0].maxHP,once,pressure:getEnemyPressureMultiplier(monsters[0],player),damageRegular:damage(regular),damageElite:damage(elite)};
 })()`);
 const {regular:r,elite:e}=data;
 assert.equal(e.rank,'elite');assert.equal(e.v141BattleRank,'elite');assert.equal(r.rank,'regular');
 for(const k of fields.filter(k=>k.endsWith('Points')||['attack','magicAttack'].includes(k)))assert.equal(e[k],r[k],k);
 assert.equal(e.maxHP,r.maxHP*1.5);assert.equal(e.defense,r.defense*1.1);
 assert.equal(data.repeat,data.once);assert.equal(data.pressure,1.1);
 assert.ok(Math.abs(data.damageElite-data.damageRegular*1.1)<=1);
});

test('unmigrated common builders and all 50 real Abyss rosters retain starting outputs',()=>{
 const {context:c}=loadLegacyRuntime();
 const baseline=JSON.parse(fs.readFileSync('tests/fixtures/monster-balance-p2a-non-wild-baseline.json','utf8'));
 for(const r of baseline.rows){
  assert.deepEqual(project(c.makeZoneMonster('Non-wild reference',r.level,r.element,r.rank)),r.legacy);
  assert.deepEqual(project(c.v132BuildDungeonMonster('Non-wild reference',r.level,r.element,r.rank)),r.daily);
 }
 for(const r of baseline.abyss){
  const actual=c.v174AbyssBuildRoster(r.difficulty,r.region,r.stage).map(m=>({name:m.name,level:m.level,rank:m.rank,element:m.element,...project(m)}));
  assert.deepEqual(plain(actual),r.roster);
 }
});

test('physical retirement forbids all old Wild writers and constructor wrapper chains',()=>{
 const source=['js/25-v131-fix-batch.js','js/34-v141-core-systems.js','js/40-v144-rules-and-abyss.js','js/47-v158-combat-tuning.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
 assert.doesNotMatch(source,/strengthenMonster|strengthenAllZoneMonsters|strengthenNewWildMonster|V173_32_WILD_ZONE_STRENGTHS|halveMonsterCoreStats|_v131StrengthApplied|v17342BeginnerStatsHalved|previousMakeZoneMonster|originalMakeZoneMonster|makeZoneMonster\s*=\s*function/);
 assert.doesNotMatch(source,/VALID_RANKS\.has\(monster\.v141BattleRank\)/);
});

test('beginner zero-speed and attack/crit/skill protection survive without point halving',()=>{
 const {context:c}=loadLegacyRuntime();
 const roster=evaluate(c,'forestMonsters');
 for(const m of roster){
  assert.equal(m.agility,0);assert.equal(m.v173BeginnerForest,true);assert.equal(m.skillIds.length,0);
  assert.equal(Object.values(m.balanceProjection.allocation).reduce((a,b)=>a+b,0),(m.level-1)*5);
 }
 assert.equal(evaluate(c,'Math.random=()=>0;rollBeginnerForestNormalAttackDamage()'),5);
 assert.equal(evaluate(c,'Math.random=()=>.999;rollBeginnerForestNormalAttackDamage()'),8);
 const main=fs.readFileSync('js/00-main.js','utf8');
 assert.match(main,/const monsterCritChance=isBeginnerForestNormalAttack[\s\S]*?\?0/);
});

test('Wild archetypes carry functional legal skills through the actual encounter hook',()=>{
 const {context:c}=loadLegacyRuntime();
 const data=evaluate(c,`(()=>{
  const output=[];
  Object.keys(zoneConfig).forEach(k=>zoneConfig[k].monsters().forEach(m=>{
   v144ConfigureMonsterEncounterSkills(m);
   output.push({archetype:m.archetype,level:m.level,skills:m.skillIds.map(id=>skillDatabase[id]),supports:m.v141SupportSkillIds.map(id=>skillDatabase[id]),element:m.element});
  }));return output;
 })()`);
 for(const m of data){
  assert.ok([...m.skills,...m.supports].every(s=>s.element===m.element));
  if(m.level<=10)continue;
  if(['physical','magic'].includes(m.archetype))assert.ok(m.skills.length&&m.skills.every(s=>s.category===m.archetype));
  if(m.archetype==='support')assert.ok(m.supports.some(s=>s.category==='heal'));
  if(m.archetype==='speedControl')assert.ok(m.skills.some(s=>s.agilityDownChance||s.stunChance||s.defenseDownChance||s.freezeChance));
 }
});

test('formal reference party and damage/action owners satisfy Wild TTK across 40 cases',()=>{
 const {rows}=buildWildTtkMatrix();assert.equal(rows.length,40);
 for(const r of rows){assert.ok(r.clear);assert.ok(r.rounds<=(r.elite?3:2),JSON.stringify({level:r.level,element:r.element,elite:r.elite,rounds:r.rounds}));assert.ok(r.survivors>0);assert.ok(r.reference.skillCost<=r.reference.skillBudget);}
});

test('123 actual Tower, Tower Boss, Personal/World Boss and Adventure projections match starting dev',()=>{
 const baseline=JSON.parse(fs.readFileSync('tests/fixtures/monster-balance-p2a-extra-non-wild.json','utf8'));
 const actual=collectNonWildOutputs(loadLegacyRuntime);assert.equal(actual.length,123);assert.deepEqual(actual,baseline.rows);
});
