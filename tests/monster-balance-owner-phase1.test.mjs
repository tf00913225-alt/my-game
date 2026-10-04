import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {CombatLevelBase} from '../js/combat/level-base-contract.mjs';
import {ARCHETYPES,allocatePoints,STAT_ORDER} from '../js/combat/monster-archetypes.mjs';
import {MonsterBalance,GLOBAL_CALIBRATION} from '../js/combat/monster-balance-owner.mjs';
import {buildMatrix,loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
const spec={monsterKey:'daily/diagnostic',dailyType:'exp',wave:1,slot:0,partySize:3,highestPartyLevel:50,skillFrequency:.45,name:'測試怪物',level:50,element:'fire',archetype:'physical',rank:'regular',mode:'wild',context:'wild/map-1'};
const inventory=JSON.parse(fs.readFileSync('docs/monster-balance-owner-retirement-map.json'));
test('shared level base begins at Lv1, not zero; all six checkpoints exact',()=>{
 for(const level of [1,10,30,50,70,100]){
  assert.deepEqual(CombatLevelBase.preview(level),{physicalAttack:30+(level-1)*4,magicAttack:30+(level-1)*2.75,defense:30+(level-1)*4,abilityPointBudget:(level-1)*5});
 }
 assert.deepEqual(CombatLevelBase.coefficients,{attack:4,intelligence:2.75,vitality:50,energy:15,defense:4,agility:1});
 for(const level of [0,101,1.5,NaN,'50'])assert.throws(()=>CombatLevelBase.preview(level));
});
test('six registries sum to 100 and largest-remainder allocation conserves every point',()=>{
 assert.equal(Object.keys(ARCHETYPES).length,6);
 for(const [id,entry] of Object.entries(ARCHETYPES)){
  assert.equal(Object.values(entry.weights).reduce((a,b)=>a+b,0),100);
  assert.deepEqual(new Set(Object.keys(entry.weights)),new Set(STAT_ORDER));
  for(let budget=0;budget<=495;budget++){
   const allocation=allocatePoints(budget,id);
   assert.equal(Object.values(allocation).reduce((a,b)=>a+b,0),budget);
   for(const stat of STAT_ORDER)assert.ok(Math.abs(allocation[stat+'Points']-budget*entry.weights[stat]/100)<1);
  }
 }
 assert.deepEqual(allocatePoints(5,'balanced'),{attackPoints:1,intelligencePoints:1,vitalityPoints:1,energyPoints:1,defensePoints:1,agilityPoints:0});
 assert.throws(()=>allocatePoints(1,'unknown'));
});
test('100 repeated previews per archetype stable, no random or cross-call mutable state',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('allocation must never roll');};
 try{
  for(const archetype of Object.keys(ARCHETYPES)){
   const input={...spec,archetype},expected=MonsterBalance.preview(input);
   for(let i=0;i<100;i++)assert.deepEqual(MonsterBalance.preview(input),expected);
   expected.allocation.attackPoints=999;expected.breakdown[1].weights.attack=999;
   assert.notEqual(MonsterBalance.preview(input).allocation.attackPoints,999);
   assert.notEqual(ARCHETYPES[archetype].weights.attack,999);
  }
 }finally{Math.random=original;}
});
test('Shadow never modifies a frozen formal entity or aliases its nested data',()=>{
 const entity=Object.freeze({...spec,hp:666,attack:999,activeBuffs:Object.freeze([{id:'formal'}])});
 const before=JSON.stringify(entity),result=MonsterBalance.preview(entity);
 assert.equal(JSON.stringify(entity),before);
 assert.equal(result.derived.maxHP,100+result.allocation.vitalityPoints*50);
 assert.equal(result.derived.maxSP,50+result.allocation.energyPoints*15);
 assert.equal(Object.hasOwn(result.final,'evasion'),false);
 assert.deepEqual(result.pendingProductDecisions,[]); // Phase 2A ratifies no monster level HP/SP bonus.
});
test('rank adds no points; seven modes explicit and isolated',()=>{
 assert.deepEqual(MonsterBalance.modes,['wild','daily','tower','abyss','adventure','personalBoss','worldBoss']);
 for(const mode of MonsterBalance.modes)for(const rank of MonsterBalance.ranks.filter(r=>r==='boss'?mode==='daily':r==='smallBoss'?!['wild','daily'].includes(mode):true)){
  const input=mode==='abyss'?{...spec,mode,rank,level:40,monsterKey:'abyss.test',abyssDifficulty:40,abyssRegion:'east',abyssStage:0,context:'abyss/40/east/stage/1'}:{...spec,mode,rank};const row=MonsterBalance.preview(input);
  assert.equal(row.base.abilityPointBudget,mode==='abyss'?195:245);assert.equal(row.profiles.mode.id,mode);
  assert.deepEqual(row.allocation,MonsterBalance.preview({...input,rank:'regular'}).allocation);
  assert.equal(row.profiles.rank.status,mode==='abyss'?'ABYSS_RUNTIME_V1':['wild','daily','tower'].includes(mode)?'RANK_V1':'PENDING_PRODUCT_CALIBRATION');
 }
 for(const invalid of [{mode:'boss'},{mode:'legacy-dungeon'},{rank:'boss'},{archetype:'unknown'},{context:''},{element:''}])assert.throws(()=>MonsterBalance.preview({...spec,...invalid}));
});
test('floor N is preview LvN; fixed 10 roster and existing rank composition',()=>{
 for(let floor=1;floor<=100;floor++){
  const roster=MonsterBalance.previewTowerRoster(spec,floor);
  assert.equal(roster.length,10);
  assert.ok(roster.every(m=>m.identity.level===floor&&m.base.abilityPointBudget===(floor-1)*5));
  assert.equal(roster.filter(m=>m.identity.rank==='elite').length,floor%5===0?2:0);
  assert.equal(roster.filter(m=>m.identity.rank==='smallBoss').length,floor%10===0?1:0);
 }
});
test('existing Tower element profile math only; global defaults all1, other modes isolated',()=>{
 assert.deepEqual(GLOBAL_CALIBRATION,{hp:1,sp:1,damage:1,defense:1});
 const earth=MonsterBalance.preview({...spec,element:'earth',mode:'tower'});
 assert.equal(earth.final.maxHP,Math.round(earth.derived.maxHP*earth.profiles.mode.hp*1.15));
 assert.equal(earth.final.defense,Math.round(earth.derived.defense*1.15));
 const wind=MonsterBalance.preview({...spec,element:'wind',mode:'tower'});
 assert.equal(wind.final.speed,wind.derived.speed*1.15);
 assert.deepEqual(wind.profiles.element.metadata,{evasionBonusPercent:15});
 for(const mode of ['daily','adventure','personalBoss','worldBoss']){
  const row=MonsterBalance.preview({...spec,mode,element:'earth'});
  if(mode==='daily'){assert.equal(row.final.maxHP,Math.round(row.derived.maxHP*row.profiles.mode.partySizeDurability));assert.equal(row.final.physicalAttack,row.derived.physicalAttack);}
  else assert.deepEqual(row.final,row.derived);
 }
});
test('AI intent carries required function, no new executable skills',()=>{
 assert.deepEqual(ARCHETYPES.support.aiIntent.priority,['healLowHpAlly','missingImportantBuff','cleanseDebuff','attack']);
 assert.ok(ARCHETYPES.tank.aiIntent.requiredCapabilities.length);
 assert.ok(ARCHETYPES.speedControl.aiIntent.requiredCapabilities.length);
 for(const entry of Object.values(ARCHETYPES))assert.equal(entry.aiIntent.policy,'only-existing-carried-legal-affordable-skills');
});
test('retirement inventory is complete and preserves grandfathered source paths honestly',()=>{
 const ids=['coreAllocation','coreStats','wildV131','wildV141','wildRank','dungeonStrength','dungeonNormal','dungeonRank','equipmentRank','beginnerScaling','dailyScaling','legacyAbyss','abyssDurability','bossMultipliers','towerElement','enemyPressure','adventureBuild','v144Wrapper','bossUnusedDefense'];
 for(const id of ids)assert.ok(inventory.items.some(item=>item.id===id),id);
 for(const item of inventory.items){
  assert.ok(['TO RETIRE','TO MIGRATE','KEEP','RETIRED','COMPATIBILITY FOR NON-WILD ONLY','COMPATIBILITY FOR NON-DAILY ONLY'].includes(item.decision));assert.ok(item.phase&&item.reason&&item.retirementGate);
  assert.equal(fs.readFileSync(item.file,'utf8').includes(item.sourceToken),item.decision!=='RETIRED',item.id);
 }
});
test('constructor wrapper retirement and pure canonical source remain enforced',()=>{
 const actual={};
 function walk(path){for(const entry of fs.readdirSync(path,{withFileTypes:true})){const file=path+'/'+entry.name;if(entry.isDirectory())walk(file);else if(file.endsWith('.js')||file.endsWith('.mjs')){
  const count=(fs.readFileSync(file,'utf8').match(/\bmakeZoneMonster\s*=\s*(?:function\b|\(?[^;\n]*=>)/g)||[]).length;if(count)actual[file]=count;
 }}}
 walk('js');assert.deepEqual(actual,inventory.grandfatheredWrappers);
 assert.match(fs.readFileSync('scripts/build-production.mjs','utf8'),/syncMonsterBalanceRuntime\(ROOT,checkOnly\)/);
 for(const path of Object.values(inventory.canonicalOwners))assert.doesNotMatch(fs.readFileSync(path,'utf8'),/\b(?:window|document|setTimeout|setInterval|makeZoneMonster|Math\.random)\b/);
});
test('540 comparison rows deterministic; old actual builders remain unchanged after shadow',()=>{
 const first=buildMatrix(),second=buildMatrix();assert.deepEqual(first,second);
 assert.equal(first.matrixRows,540);assert.equal(first.abyssCompatibility.length,50);
 assert.ok(first.rows.every(r=>Object.values(r.shadowAllocation).reduce((a,b)=>a+b,0)===r.shadowBase.abilityPointBudget));
 assert.ok(first.rows.some(r=>r.spec.mode==='abyss'&&!r.legacyContext.sameLevel));
 const {context}=loadLegacyRuntime();
 const old=()=>context.v132BuildDungeonMonster('unchanged',50,'fire','elite');
 const before=JSON.stringify(old());
 // skill loadout can roll; compare actual six stats and resources only.
 const project=entity=>Object.fromEntries(['maxHP','maxSP','attack','magicAttack','defense','agility','attackPoints','intelligencePoints','vitalityPoints','energyPoints','defensePoints','agilityPoints'].map(key=>[key,entity[key]]));
 const entity=old(),expected=project(entity);
 MonsterBalance.preview({...spec,...entity,rank:'elite',mode:'daily'});
 assert.deepEqual(project(entity),expected);assert.deepEqual(project(old()),expected);
 assert.ok(before.length);
});
