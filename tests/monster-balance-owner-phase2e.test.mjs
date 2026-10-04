import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {MonsterBalance} from '../js/combat/monster-balance-owner.mjs';
import {loadAdventureDiagnostic,buildAdventureTtkMatrix} from '../scripts/adventure-balance-ttk-matrix.mjs';
import {collectNonWildOutputs} from '../scripts/monster-balance-non-wild-output.mjs';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
const plain=v=>JSON.parse(JSON.stringify(v));
function verify(m){
  const p=MonsterBalance.preview(m.balanceProjection.identity);
  assert.deepEqual(plain(m.balanceProjection),p);
  for(const [key,value] of Object.entries({maxHP:p.final.maxHP,maxSP:p.final.maxSP,attack:p.final.physicalAttack,magicAttack:p.final.magicAttack,defense:p.final.defense,agility:p.final.speed}))assert.equal(m[key],value,key);
  assert.equal(m.balanceOwner,'MonsterBalance');assert.equal(m.mode,'adventure');
  assert.equal(p.base.abilityPointBudget,(m.level-1)*5);
  assert.equal(Object.values(p.allocation).reduce((a,b)=>a+b,0),(m.level-1)*5);
  for(const key of ['v132Dungeon','v132EquipmentDungeon','v141ExtraHP','v174AbyssDurabilityMultiplier'])assert.equal(Object.hasOwn(m,key),false,key);
  assert.equal(p.legacyMultiplier,'NONE');assert.deepEqual(p.pendingProductDecisions,[]);
}
test('all three formal encounters, nine identities, fixed levels and archetypes use one projection',()=>{
  const c=loadAdventureDiagnostic();c.makeZoneMonster=c.makeLegacyModeMonster=c.v132BuildDungeonMonster=()=>{throw Error('retired Adventure caller');};
  const seen=new Map();let count=0;
  for(const e of Object.values(c.FourSymbolsAdventureContent.encounters)){
    const a=c.__adventureDiagnosticBuild(e.id),b=c.__adventureDiagnosticBuild(e.id);assert.equal(a.length,3);
    assert.deepEqual(plain(a.map(m=>m.balanceProjection)),plain(b.map(m=>m.balanceProjection)));
    for(let i=0;i<a.length;i++){
      const m=a[i],spec=e.enemies[i];verify(m);count++;
      assert.equal(m.level,spec.level);assert.equal(m.rank,spec.rank);assert.equal(m.element,spec.element);
      assert.equal(m.context,`adventure/chapter_v1/${e.id}`);assert.equal(m.vAdventureEncounterId,e.id);assert.equal(m.vAdventureSlot,i);
      if(seen.has(m.name))assert.equal(seen.get(m.name),m.archetype);seen.set(m.name,m.archetype);
      c.configureBuiltMonster(m);verify(m);assert.equal(c.getMonsterRank(m),m.rank==='smallBoss'?'boss':m.rank);
    }
  }
  assert.equal(count,9);assert.equal(seen.size,8);
});
test('rank never adds points; stable explicit Adventure context fails closed',()=>{
  for(const level of [8,10,12,50,100])for(const archetype of Object.keys(MonsterBalance.archetypes)){
    const input={monsterKey:'test',name:'test',level,element:'earth',archetype,mode:'adventure',chapterId:'chapter_v1',encounterId:'enc_boss',context:'adventure/chapter_v1/enc_boss'};
    const regular=MonsterBalance.preview({...input,rank:'regular'});
    for(const rank of ['elite','smallBoss'])assert.deepEqual(MonsterBalance.preview({...input,rank}).allocation,regular.allocation);
    assert.throws(()=>MonsterBalance.build({...input,rank:'boss'}));assert.throws(()=>MonsterBalance.build({...input,rank:'regular',context:'wrong'}));
  }
});
test('original carried skills, frequency, identity and portrait continuity survive migration',()=>{
  const c=loadAdventureDiagnostic();vm.runInContext('Math.random=()=>.5',c);
  const baseline=JSON.parse(fs.readFileSync('docs/monster-balance-adventure-baseline-20261004.json','utf8'));
  assert.equal(baseline.sourceHead,'a0c4cf3ccf6b83278f9940da7f71516d9c98cfa4');
  for(const row of baseline.rows.filter(r=>r.partySize===1&&[8,10,12].includes(r.partyLevel))){
    const a=c.__adventureDiagnosticBuild(row.encounterId);
    for(let i=0;i<a.length;i++){
      const m=a[i],old=row.initialMonsters[i];
      assert.deepEqual(plain({name:m.name,level:m.level,element:m.element,skills:m.skillIds,support:m.v141SupportSkillIds||[],frequency:m.skillChance,portrait:m.portraitKey||null}),{name:old.name,level:old.level,element:old.element,skills:old.skillIds,support:old.supportIds,frequency:old.skillFrequency,portrait:old.portraitKey});
    }
  }
});
test('Adventure pressure is consumed once and shared Boss legacy baseline is immutable',()=>{
  const c=loadAdventureDiagnostic(),target=vm.runInContext('player',c);
  for(const e of Object.keys(c.FourSymbolsAdventureContent.encounters))for(const m of c.__adventureDiagnosticBuild(e)){
    assert.equal(c.getEnemyPressureMultiplier(m,target),m.balanceProjection.finalDamagePressure);
    m.v132Dungeon=true;m.v141Abyss=true;assert.equal(c.getEnemyPressureMultiplier(m,target),m.balanceProjection.finalDamagePressure);assert.equal(c.getEnemyPressureMultiplier(m,m),1);
  }
  const old=JSON.parse(fs.readFileSync('tests/fixtures/monster-balance-p2a-extra-non-wild.json','utf8')).rows;
  const actual=collectNonWildOutputs(loadLegacyRuntime),boss=r=>['personal','world'].includes(r.mode);
  assert.deepEqual(actual.filter(boss),old.filter(boss));assert.equal(actual.filter(boss).length,48);
});
test('original adventure numerical edge is physically absent; shared legacy builder remains',()=>{
  const s=fs.readFileSync('js/adventure/adventure-runtime-v1-20260915.js','utf8');
  assert.doesNotMatch(s,/makeZoneMonster|makeLegacyModeMonster|v132BuildDungeonMonster|monster\.(maxHP|hp|attack|magicAttack|defense|agility|level|rank|element)\s*=/);
  assert.match(fs.readFileSync('js/00-main.js','utf8'),/function makeLegacyModeMonster/);
});
test('all formal Adventure TTK references survive without a forced two-round target',()=>{
  for(const randomPolicy of ['neutral','seeded']){
    const r=buildAdventureTtkMatrix({randomPolicy});assert.equal(r.cases,18);assert.equal(r.gate.passed,true);assert.deepEqual(r.gate.failures,[]);
    assert.ok(r.rows.some(x=>x.rounds>2));
    for(const row of r.rows){assert.ok(row.rounds<=6);assert.ok(row.reference.skillCost<=row.reference.skillBudget);assert.ok(row.initialMonsters.every(m=>m.owner==='MonsterBalance'));for(const roll of row.controlUsage)assert.ok(roll.chance<=({regular:90,elite:75}[roll.targetRank]||60));}
  }
});
