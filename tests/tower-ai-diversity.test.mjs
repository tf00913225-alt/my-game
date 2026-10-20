import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTowerAiRuntime,simulateTowerAi} from '../scripts/tower-ai-diversity-simulation.mjs';

const r=loadTowerAiRuntime();
const database=r.run("skillDatabase");
function setup(element='water',floor=100,count=6){
 r.timers.clear();r.setElement(element);r.c.__setup={floor,count};
 r.run(`
  battleActive=false;prepareWildBalanceReferenceParty(100,3);
  monsters=GameplaySystem.buildTowerWaves(__setup.floor)[0];
  while(monsters.length<__setup.count)monsters.push(__shadowTower.troop(100,'water','elite',100,2));
  currentBattleMonsters=monsters.map((m,i)=>i);battleActive=true;battleToken++;turn=1;battlePhase='resolve';
  battleRoundBoundaryKeys=new Set();FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();
  v138EnsureEnemyFormationSnapshot(currentBattleMonsters);
  notifyBattleRoundBoundary('round_start',battleToken);
  __declarations=[];__finished=0;window.__savedFinish=finishPlayerAction;finishPlayerAction=()=>{__finished++;};
 `);
}
function attack(index,random=0){r.run(`Math.random=()=>${random};processSingleMonsterAttack(${index},battleToken);`);}
function round(n){r.run(`notifyBattleRoundBoundary('round_end',battleToken);turn=${n};notifyBattleRoundBoundary('round_start',battleToken);`);}
function cleanup(){r.run('finishPlayerAction=__savedFinish;battleActive=false;');}

test('four elements, floor/level boundaries: legal final-data IDs, ranks, roles, SP fallback and unchanged wave topology',()=>{
 for(const element of ['fire','earth','water','wind']){
  r.setElement(element);
  for(const floor of [1,5,10,20,21,30,31,40,41,60,61,90,91,100]){
   r.c.__floor=floor;const waves=r.run('GameplaySystem.buildTowerWaves(__floor)');
   assert.deepEqual(Array.from(waves,w=>w.length),[6,6]);
   const sets=new Set();
   for(const m of waves.flat()){
    sets.add(m.skillIds.join(','));assert.ok(m.skillIds.length>=2);
    assert.ok(m.skillIds.some(id=>database[id].spCost<=10));
    for(const id of [...m.skillIds,...m.v141SupportSkillIds]){
     const skill=database[id];assert.ok(skill,id);assert.equal(skill.element,element);assert.notEqual(skill.category,'passive');assert.ok(!id.endsWith('EX'));
    }
    if(m.vGameplayTowerBoss)assert.ok(m.skillIds.length>=8);
   }
   assert.ok(sets.size>=2,element+' floor '+floor);
   assert.equal(waves[1].filter(m=>m.rank==='smallBoss').length,floor%10===0?1:0);
  }
 }
 assert.equal(database.freeze.spCost,32);assert.equal(database.healSpell.spCost,45);
});

test('single decision roll, no same skill while another affordable option exists, SP exhaustion uses normal attack',()=>{
 setup('water');r.run(`monsters[0].skillIds=['waterKnife','waterBall'];monsters[0].v141SupportSkillIds=[];monsters[0].skillChance=1;`);
 attack(0);attack(0);assert.deepEqual(r.json('__declarations.map(d=>d.skillId)'),['waterKnife','waterBall']);
 r.run('monsters[0].sp=0;');attack(0);assert.equal(r.json('__declarations.at(-1).skillId'),'normal');
 assert.equal(r.run('__finished'),3);cleanup();
});

test('water ten-enemy pressure: each team quota counts declaration even if freeze is resisted/MISS; skips/death consume neither action nor quota',()=>{
 setup('water',100,10);
 r.run(`monsters.forEach(m=>{m.skillIds=['freeze','waterKnife'];m.v141SupportSkillIds=[];m.skillChance=1;});rollNamedPersistentStatusEffect=()=>false;`);
 // Force the legal carried freeze; failure is still a declaration.
 for(let i=0;i<10;i++){r.run(`monsters[${i}].v175ForcedAttackSkillId='freeze';`);attack(i);}
 assert.equal(r.json('__declarations.filter(d=>d.skillId==="freeze").length'),2);
 assert.equal(r.run('__finished'),10);
 assert.ok(r.json('__declarations.filter(d=>d.skillId!=="freeze").every(d=>d.skillId==="waterKnife")'));
 round(2);r.run(`monsters[2].alive=false;monsters[3].statusEffects=[{type:'freeze',turnsLeft:2}];`);
 attack(2);attack(3);
 // Neither departed nor skipped caster refreshed the team quota.
 assert.equal(r.json('__declarations.filter(d=>d.round===2).length'),0);
 r.run('monsters[4].v175ForcedAttackSkillId="freeze";');attack(4);
 assert.equal(r.json('__declarations.filter(d=>d.round===2&&d.skillId==="freeze").length'),1);cleanup();
});

test('freeze cooldown N+1/N+2, duplicate boundaries and same-round replacement wave cannot reset quotas; new token resets',()=>{
 setup();r.run(`monsters.forEach(m=>{m.skillIds=['freeze','waterKnife'];m.v141SupportSkillIds=[];m.skillChance=1;});`);
 for(const i of [0,1]){r.run(`monsters[${i}].v175ForcedAttackSkillId='freeze';`);attack(i);}
 r.run(`notifyBattleRoundBoundary('round_start',battleToken);monsters[2]=__shadowTower.troop(100,'water','elite',100,2);monsters[2].skillIds=['freeze','waterKnife'];monsters[2].v141SupportSkillIds=[];monsters[2].skillChance=1;monsters[2].v175ForcedAttackSkillId='freeze';`);attack(2);
 assert.equal(r.json('__declarations.filter(d=>d.skillId==="freeze").length'),2);
 for(const n of [2,3]){round(n);r.run('monsters[0].v175ForcedAttackSkillId="freeze";');attack(0);assert.notEqual(r.json('__declarations.at(-1).skillId'),'freeze');}
 round(4);r.run('monsters[0].v175ForcedAttackSkillId="freeze";');attack(0);assert.equal(r.json('__declarations.at(-1).skillId'),'freeze');
 r.run(`battleToken++;turn=1;notifyBattleRoundBoundary('round_start',battleToken);monsters[0].v175ForcedAttackSkillId='freeze';`);attack(0);assert.equal(r.json('__declarations.at(-1).skillId'),'freeze');cleanup();
});

test('healing uses actual HP <40%, HP-ranked formal tri targets, exact heal/SP and two declarations/round with individual cooldown',()=>{
 setup('water',100,10);
 r.run(`monsters.forEach(m=>{m.hp=m.maxHP*.39;m.skillIds=['waterKnife'];m.v141SupportSkillIds=['healSpell'];m.skillChance=1;});`);
 for(let i=0;i<4;i++){r.run(`monsters[${i}].v175ForcedSupportSkillId='healSpell';`);attack(i,.9);}
 assert.equal(r.json('__declarations.filter(d=>d.skillId==="healSpell").length'),2);
 assert.equal(r.run('__finished'),4);
 for(const n of [2,3]){round(n);r.run('monsters[0].hp=100;monsters[0].v175ForcedSupportSkillId="healSpell";');attack(0,.9);assert.notEqual(r.json('__declarations.at(-1).skillId'),'healSpell');}
 round(4);r.run('monsters[0].hp=100;monsters[0].v175ForcedSupportSkillId="healSpell";');attack(0,.9);assert.equal(r.json('__declarations.at(-1).skillId'),'healSpell');cleanup();
 setup();r.run(`monsters.forEach(m=>{m.hp=m.maxHP;m.sp=0;});monsters[2].sp=200;monsters[2].skillIds=['waterKnife'];monsters[2].v141SupportSkillIds=['healSpell'];monsters[2].skillChance=1;monsters[0].hp=monsters[0].maxHP*.4;`);
 attack(2,.9);assert.notEqual(r.json('__declarations.at(-1).skillId'),'healSpell');
 r.run(`monsters[0].hp=100;monsters[2].v175ForcedSupportSkillId='healSpell';window.__before=monsters.map(m=>({hp:m.hp,sp:m.sp}));`);
 attack(2,.9);
 assert.equal(r.json('__declarations.at(-1).skillId'),'healSpell');
 assert.equal(r.run('monsters[0].hp-__before[0].hp'),Math.floor(640*1.15)); // forced Lv4 at tower Lv100
 assert.equal(r.run('monsters[2].sp'),r.run('__before[2].sp')-45,'caster does not restore own SP');
 assert.ok(r.run('monsters.every(m=>m.hp<=m.maxHP)'));cleanup();
});

test('seeded complete queue battles across four elements and low/mid/high floors finish exactly once',async()=>{
 const report=await simulateTowerAi({seeds:[1,7]});
 for(const row of report.rows){
  assert.equal(row.outcomes.length,1,JSON.stringify({...row,declarations:undefined}));
  assert.equal(row.active,false);assert.ok(row.rounds<=100);
  const rounds=new Map(),last=new Map();
  for(const d of row.declarations){
   if(!['freeze','healSpell'].includes(d.skillId))continue;
   const key=d.round+':'+d.skillId;rounds.set(key,(rounds.get(key)||0)+1);assert.ok(rounds.get(key)<=2);
   const caster=d.index+':'+d.skillId;
   if(last.has(caster))assert.ok(d.round-last.get(caster)>=3);
   last.set(caster,d.round);
  }
 }
});
