import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
import {buildAbyssTtkMatrix} from '../scripts/abyss-balance-ttk-matrix.mjs';
const plain=v=>JSON.parse(JSON.stringify(v));
const assertProjection=m=>{
  const p=MonsterBalance.preview(m.balanceProjection.identity);
  assert.deepEqual(plain(m.balanceProjection),p);
  for(const [field,value] of Object.entries({maxHP:p.final.maxHP,maxSP:p.final.maxSP,attack:p.final.physicalAttack,magicAttack:p.final.magicAttack,defense:p.final.defense,agility:p.final.speed}))assert.equal(m[field],value,field);
  assert.equal(m.balanceOwner,'MonsterBalance');assert.equal(m.mode,'abyss');
  assert.equal(p.base.abilityPointBudget,(m.level-1)*5);
  assert.equal(Object.values(p.allocation).reduce((a,b)=>a+b,0),(m.level-1)*5);
  for(const token of ['v132Dungeon','v132EquipmentDungeon','v141ExtraHP','v174AbyssHpMultiplier','v174AbyssDurabilityMultiplier'])assert.equal(Object.hasOwn(m,token),false,token);
  assert.equal(p.legacyMultiplier,'NONE');assert.deepEqual(p.pendingProductDecisions,[]);
};
test('all 50 formal encounters / 402 projections / 14 identities are stable and owner-only',()=>{
  const {context:c}=loadLegacyRuntime();
  c.v132BuildDungeonMonster=()=>{throw new Error('retired Abyss stat edge');};
  const identities=new Map();let projections=0;
  for(const level of [20,40])for(let region=0;region<5;region++)for(let stage=0;stage<5;stage++){
    const roster=c.v174AbyssBuildRoster(level,region,stage),again=c.v174AbyssBuildRoster(level,region,stage);
    assert.deepEqual(plain(roster.map(m=>m.balanceProjection)),plain(again.map(m=>m.balanceProjection)));
    assert.equal(roster.length,level===40&&region===4&&stage===4?10:8);
    assert.equal(roster.filter(m=>m.rank==='smallBoss').length,stage<4?0:level===40&&region===4?5:1);
    for(const m of roster){
      assertProjection(m);projections++;
      assert.equal(m.context,`abyss/${level}/${c.v174AbyssRegions[region].id}/stage/${stage+1}`);
      assert.equal(m.level,level);
      if(identities.has(m.monsterKey))assert.equal(m.archetype,identities.get(m.monsterKey));
      identities.set(m.monsterKey,m.archetype);
      const before=plain(m.balanceProjection.final);
      c.v144ConfigureMonsterEncounterSkills(m);
      assert.deepEqual(plain(m.balanceProjection.final),before);assertProjection(m);
      assert.equal(c.getMonsterRank(m),m.rank==='smallBoss'?'boss':m.rank);
      assert.ok([...m.skillIds,...(m.v141SupportSkillIds||[])].every(id=>c.v144IsMonsterSkillElementLegal(m,id)));
    }
  }
  assert.equal(projections,402);assert.equal(identities.size,14);
});
test('Abyss rank changes final profiles without changing points; invalid contexts fail closed',()=>{
  for(const level of [20,40])for(const element of ['fire','water','wind','earth','light'])for(const archetype of Object.keys(MonsterBalance.archetypes)){
    const spec={monsterKey:'abyss/test',name:'test',level,element,archetype,mode:'abyss',context:`abyss/${level}/east/stage/5`,abyssDifficulty:level,abyssRegion:'east',abyssStage:4};
    const regular=MonsterBalance.preview({...spec,rank:'regular'});
    for(const rank of ['elite','smallBoss'])assert.deepEqual(MonsterBalance.preview({...spec,rank}).allocation,regular.allocation);
    assert.throws(()=>MonsterBalance.build({...spec,rank:'boss'}));
    assert.throws(()=>MonsterBalance.build({...spec,rank:'regular',level:30}));
    assert.throws(()=>MonsterBalance.build({...spec,rank:'regular',context:'wrong'}));
  }
});
test('formal Abyss carried skills and frequency retain the starting dev baseline',()=>{
  const {context:c}=loadLegacyRuntime();
  vm.runInContext('Math.random=()=>.5',c);
  const baseline=JSON.parse(fs.readFileSync('docs/monster-balance-abyss-baseline-20261004.json','utf8'));
  assert.equal(baseline.sourceHead,'f47862cc592870e359d31da5da52a5d530c831a8');
  const encounters=baseline.rows.filter(row=>row.partyLevel===row.difficulty);
  assert.equal(encounters.length,50);
  for(const row of encounters){
    const actual=c.v174AbyssBuildRoster(row.difficulty,row.region,row.stage);
    assert.equal(actual.length,row.initialMonsters.length);
    for(let i=0;i<actual.length;i++){
      const m=actual[i],old=row.initialMonsters[i];
      c.v144ConfigureMonsterEncounterSkills(m);
      assert.deepEqual(plain({name:m.name,level:m.level,element:m.element,skillFrequency:m.skillChance,skillIds:m.skillIds,supportIds:m.v141SupportSkillIds||[]}),
        {name:old.name,level:old.level,element:old.element,skillFrequency:old.skillFrequency,skillIds:old.skillIds,supportIds:old.supportIds});
      assertProjection(m);
    }
  }
});
test('pressure is consumed exactly once despite legacy-looking compatibility flags',()=>{
  const {context:c}=loadLegacyRuntime();
  const target=vm.runInContext('player',c);
  for(const level of [20,40])for(const region of [0,4])for(const m of c.v174AbyssBuildRoster(level,region,4)){
    const expected=m.balanceProjection.finalDamagePressure;
    assert.equal(c.getEnemyPressureMultiplier(m,target),expected);
    m.v132Dungeon=true;m.v141Abyss=true;
    assert.equal(c.getEnemyPressureMultiplier(m,target),expected);
    assert.equal(c.getEnemyPressureMultiplier(m,m),1);
  }
});
test('shared launcher preparation preserves fixed geometry and pre-battle projections',()=>{
  const {context:c}=loadLegacyRuntime();
  const rows=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
    const rows=[];autoBattle=false;autoPatrolEnabled=false;renderBattle=()=>{};renderPlayers=()=>{};updateUI=()=>{};
    for(const level of [20,40])for(const region of [0,3,4])for(const stage of [0,4]){
      battleActive=false;window.v132ActiveDungeonRun=null;
      const roster=v174AbyssBuildRoster(level,region,stage);
      const before=JSON.stringify(roster.map(m=>[m.maxHP,m.maxSP,m.attack,m.magicAttack,m.defense,m.agility,m.rank,m.element]));
      if(!v132LaunchDungeonBattle(roster,()=>{},{mode:'abyss'}))throw new Error('launch refused');
      renderBattle();updateUI();
      const after=JSON.stringify(monsters.map(m=>[m.maxHP,m.maxSP,m.attack,m.magicAttack,m.defense,m.agility,m.rank,m.element]));
      const ids=currentBattleMonsters.slice();const snapshot=v138EnsureEnemyFormationSnapshot(ids);const slots=ids.map(i=>FourSymbolsBattlefieldSlots.getEnemySlotForMonster(snapshot,i));
      const original=slots.slice();monsters[ids[0]].alive=false;monsters[ids[0]].hp=0;renderBattle();
      rows.push({before,after,slots,afterDeath:ids.map(i=>FourSymbolsBattlefieldSlots.getEnemySlotForMonster(v138EnsureEnemyFormationSnapshot(ids),i)),original});
    }
    return rows;
  })())`,c));
  for(const row of rows){assert.equal(row.before,row.after);assert.equal(new Set(row.slots).size,row.slots.length);assert.deepEqual(row.afterDeath,row.original);}
});
test('formal Abyss entry hands off a fresh snapshot without clearing a live battle',()=>{
  const {context:c}=loadLegacyRuntime();
  const result=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
    player.level=60;v174AbyssSelectDifficulty(20);
    const slots=FourSymbolsBattlefieldSlots;
    const stale=slots.createEnemyFormationSnapshot([0,1,2,3,4,5,6,7],{originalFormationType:8});slots.setActiveEnemySnapshot(stale);
    let fresh=false,kept=false;
    v132LaunchDungeonBattle=(roster,done,options)=>{fresh=slots.getActiveEnemySnapshot()===null;return false;};
    battleActive=false;v174AbyssStartEncounter();
    slots.setActiveEnemySnapshot(stale);battleActive=true;
    v132LaunchDungeonBattle=()=>{kept=slots.getActiveEnemySnapshot()===stale;return false;};v174AbyssStartEncounter();
    return {fresh,kept};
  })())`,c));
  assert.deepEqual(result,{fresh:true,kept:true});
});
test('retired Abyss writers are physically absent and legacy shared callers remain',()=>{
  const abyss=fs.readFileSync('js/59-abyss-two-tier-runtime.js','utf8');
  assert.doesNotMatch(abyss,/v132BuildDungeonMonster|applyHpMultiplier|HP_DURABILITY_MULTIPLIER|stageHpMultipliers|bossEliteHpMultiplier|bossHpMultiplier|monster\.(maxHP|hp|defense|attack|magicAttack|agility|level|element)\s*=/);
  const v141=fs.readFileSync('js/36-v141-content-systems.js','utf8');
  assert.doesNotMatch(v141,/function makeAbyssMonster|monster\.maxHP\+=extraHp|monster\.v141ExtraHP=/);
  assert.match(v141,/window\.v174AbyssBuildRoster\(40/);
  assert.match(fs.readFileSync('js/27-v132-content-expansion.js','utf8'),/window\.v132BuildDungeonMonster=buildDungeonMonster/);
});
test('formal challenge TTK matrix preserves the bare Lv40 final challenge and clears all progression references',()=>{
  for(const randomPolicy of ['neutral','seeded']){const report=buildAbyssTtkMatrix({randomPolicy});assert.equal(report.cases,150);
  assert.equal(report.gate.passed,true);
  assert.deepEqual(report.gate.unexpectedLosses,[]);assert.deepEqual(report.gate.instantWipes,[]);
  for(const r of report.failures)assert.deepEqual([r.difficulty,r.partyLevel,r.region,r.stage],[40,40,4,4]);
  assert.ok(report.rows.some(r=>r.rounds>2));
  for(const row of report.rows){assert.ok(row.rounds<=60);assert.ok(row.reference.skillCost<=row.reference.skillBudget);assert.ok(row.initialMonsters.every(m=>m.owner==='MonsterBalance'));for(const roll of row.controlUsage.rolls){const cap=roll.targetRank==='regular'?90:roll.targetRank==='elite'?75:60;assert.ok(roll.chance<=cap,'formal hard-control cap');}}
  }
});
