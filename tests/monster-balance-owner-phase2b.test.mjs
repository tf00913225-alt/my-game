import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
import {buildDailyTtkMatrix} from '../scripts/daily-balance-ttk-matrix.mjs';
const plain=v=>JSON.parse(JSON.stringify(v));
const fields=['maxHP','maxSP','attack','magicAttack','defense','agility','attackPoints','intelligencePoints','vitalityPoints','energyPoints','defensePoints','agilityPoints'];
const project=m=>Object.fromEntries(fields.map(k=>[k,m[k]]));
const run=(c,s)=>plain(vm.runInContext(s,c));
const fixture=fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8');
function runtime(){const {context:c}=loadLegacyRuntime();vm.runInContext(fixture,c);return c;}
test('972 formal Daily identities equal previews through repeated formal preparation hooks',()=>{
 const c=runtime();let count=0;
 for(const level of [10,20,30,50,70,100])for(const size of [1,2,3])for(const type of ['exp','material','gold']){
  c.__input={level,size,type};
  const data=run(c,`(()=>{
   const {level,size,type}=__input;prepareWildBalanceReferenceParty(level,size);
   const built=v148BuildDailyDungeonWaves(type),before=built.waves.map(w=>w.map(m=>JSON.parse(JSON.stringify(m))));
   window.v132ActiveDungeonRun={mode:'daily',partySize:size,highestPartyLevel:level,dailyDungeonType:type};currentZone='dungeon';battleActive=true;
   for(const wave of built.waves){monsters=wave;currentBattleMonsters=wave.map((_,i)=>i);battleToken++;v141PrepareBattleRender();v144ConfigureDungeonBattleSkillsAfterRender();v141PrepareBattleRender();v144ConfigureDungeonBattleSkillsAfterRender();}
   const after=built.waves.map(w=>w.map(m=>JSON.parse(JSON.stringify(m))));
   const reentry=v148BuildDailyDungeonWaves(type).waves;
   return {before,after,reentry};
  })()`);
  for(let w=0;w<3;w++)for(let slot=0;slot<6;slot++){
   const before=data.before[w][slot],after=data.after[w][slot],next=data.reentry[w][slot];
   const expected=MonsterBalance.build(before.balanceProjection.identity);
   assert.equal(before.mode,'daily');assert.equal(before.dailyType,type);assert.equal(before.wave,w+1);assert.equal(before.slot,slot);
   assert.deepEqual(before.balanceProjection,expected.balanceProjection);
   assert.deepEqual(project(before),project(expected));assert.deepEqual(project(after),project(before));assert.deepEqual(project(next),project(before));
   assert.equal(after.skillChance,before.skillChance);assert.equal(before.balanceProjection.legacyMultiplier,'NONE');
   assert.equal(after.v173DailyDungeonBaseStats,undefined);assert.equal(after.v173DailyDungeonScaleFactor,undefined);count++;
  }
 }
 assert.equal(count,972);
});
test('Rank V1 affects durability and one outgoing pressure only; budget and raw attacks unchanged',()=>{
 const c=runtime();vm.runInContext('prepareWildBalanceReferenceParty(50,3)',c);
 const m=plain(c.v148BuildDailyDungeonWaves('exp').waves[0][0]);
 for(const [rank,hp,defense,damage] of [['regular',1,1,1],['elite',1.5,1.1,1.1],['boss',2,1.15,1.15]]){
  const regular=MonsterBalance.build({...m.balanceProjection.identity,rank:'regular'}),entity=MonsterBalance.build({...m.balanceProjection.identity,rank});
  assert.deepEqual(entity.balanceProjection.allocation,regular.balanceProjection.allocation);
  assert.equal(entity.attack,regular.attack);assert.equal(entity.magicAttack,regular.magicAttack);assert.equal(entity.maxSP,regular.maxSP);
  assert.equal(entity.maxHP,regular.maxHP*hp);assert.equal(entity.defense,regular.defense*defense);
  c.__entity=entity;
  const d=run(c,`(()=>{Math.random=()=>.5;const a=__entity;const p=getEnemyPressureMultiplier(a,player);const damage=calculateDamage(a.magicAttack,0,50,50,'fire','fire',{attacker:a,target:player});a.v132Dungeon=false;return {p,damage,again:getEnemyPressureMultiplier(a,player)};})()`);
  assert.equal(d.p,damage);assert.equal(d.again,damage);
 }
});
test('Party size changes HP and beginner gameplay protection; no level/points/SP/defense/speed mutation',()=>{
 const c=runtime();vm.runInContext('prepareWildBalanceReferenceParty(50,3)',c);
 const spec=plain(c.v148BuildDailyDungeonWaves('exp').waves[0][0].balanceProjection.identity),all=[];
 for(const partySize of [1,2,3])all.push(MonsterBalance.build({...spec,partySize}));
 for(const m of all){assert.deepEqual(m.balanceProjection.allocation,all[0].balanceProjection.allocation);for(const k of fields.filter(k=>k!=='maxHP'))assert.equal(m[k],all[0][k]);assert.equal(m.level,50);}
 assert.deepEqual(all.map(m=>m.balanceProjection.profiles.mode.partySizeDurability),[.04,.08,.12]);
});
test('same name has fixed archetype across elements, every type shares Owner, no constructor wrapper',()=>{
 const c=runtime(),seen=new Map();vm.runInContext('prepareWildBalanceReferenceParty(50,3)',c);
 const mapping=JSON.parse(fs.readFileSync('config/daily-monster-archetypes.json','utf8')).entries;
 for(const type of ['exp','material','gold'])for(const wave of c.v148BuildDailyDungeonWaves(type).waves)for(const m of wave){
  assert.equal(m.archetype,mapping[m.monsterKey].archetype);assert.equal(m.balanceOwner,'MonsterBalance');
  if(seen.has(m.name))assert.equal(m.archetype,seen.get(m.name));seen.set(m.name,m.archetype);
 }
 assert.equal(seen.size,9);assert.ok(new Set(seen.values()).size>=4);
 const source=fs.readFileSync('js/42-v148-combat-dungeon-fixes.js','utf8');
 const builder=source.slice(source.indexOf('    function buildDailyWave('),source.indexOf('    function dailyDungeonAvailable('));
 assert.doesNotMatch(builder,/v132BuildDungeonMonster|makeZoneMonster|scale|Multiplier/);
 assert.match(builder,/MonsterBalance\.build/);
});
test('V158 post-render scaling and inactive equipment stat builders are physically retired',()=>{
 const v158=fs.readFileSync('js/47-v158-combat-tuning.js','utf8'),v132=fs.readFileSync('js/27-v132-content-expansion.js','utf8');
 assert.doesNotMatch(v158,/DAILY_DUNGEON_SCALE_FIELDS|DAILY_DUNGEON_DIFFICULTY_MULTIPLIER|normalizeDailyDungeonMonster|getDailyDungeonScaleContext|v158PrepareBattleRender|v173DailyDungeonBaseStats/);
 assert.doesNotMatch(v132,/EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS|EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS|applyEquipmentDungeonRankStrength|buildEquipmentDungeonMonster|buildEquipmentDungeonRoster|beginEquipmentDungeon/);
 const map=JSON.parse(fs.readFileSync('docs/monster-balance-owner-retirement-map.json'));
 for(const id of ['coreStats','coreAllocation','dungeonStrength','dungeonNormal','dungeonRank','enemyPressure'])assert.equal(map.items.find(x=>x.id===id).dailyForbidden,true);
 for(const id of ['equipmentRank','dailyScaling'])assert.equal(map.items.find(x=>x.id===id).decision,'RETIRED');
});
test('beginner six-enemy layouts, no-boost and skill cooldown protection persist',()=>{
 const c=runtime();vm.runInContext('prepareWildBalanceReferenceParty(20,1)',c);
 const waves=plain(c.v148BuildDailyDungeonWaves('gold').waves);
 assert.deepEqual(waves.map(w=>w.length),[6,6,6]);
 assert.deepEqual(waves.map(w=>w.filter(m=>m.rank==='elite').length),[0,1,1]);
 assert.deepEqual(waves.map(w=>w.filter(m=>m.rank==='boss').length),[0,0,1]);
 for(const m of waves.flat()){assert.equal(m.v173DailySoloProtected,true);assert.equal(m.v173DailyNoAccuracyCritBoost,true);assert.equal(m.skillChance,m.wave===1?0:.21);assert.equal(m.balanceProjection.profiles.mode.damage,.5);}
 const source=fs.readFileSync('js/47-v158-combat-tuning.js','utf8');assert.match(source,/v173DailyBossUsedSkillLastAction===true/);assert.match(source,/v173DailyBossUsedSkillLastAction=usedSkill/);
});
test('54 reference encounters / 162 cumulative resource waves clear in <=2 rounds with survivors',()=>{
 const report=buildDailyTtkMatrix();assert.equal(report.rows.length,54);
 for(const r of report.rows)for(const w of r.waves){assert.ok(w.clear,JSON.stringify({level:r.level,size:r.partySize,type:r.type,wave:w.wave}));assert.ok(w.rounds<=2);assert.ok(w.after.some(hp=>hp>0));assert.ok(r.reference.skillCost<=r.reference.skillBudget);}
});
