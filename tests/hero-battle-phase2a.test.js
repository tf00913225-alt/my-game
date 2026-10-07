'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../functions/src/hero-core');
const main=fs.readFileSync('js/00-main.js','utf8');
const decl=name=>{const m=main.match(new RegExp('^function '+name+'\\([^]*?^\\}','m'));assert.ok(m,name);return m[0];};
const plain=x=>JSON.parse(JSON.stringify(x));
function runtime(count=2){
 const players=[0,1,2].map(i=>({id:'player-'+i,level:50-i,hp:100,sp:100}));
 let account=core.normalizeAccountState();
 const math=Object.create(Math);let random=0;math.random=()=>random;
 const noop=()=>{};
 const ctx={console,Math:math,player:players[0],player2:players[1],player3:players[2],battleActive:false,battleToken:7,turn:1,
 autoConfig:{enabled:false},autoConfig2:{enabled:false},autoConfig3:{enabled:false},
 activeBattleCharacterIndex:3,queuedPlayerActions:{},activeBattleStatisticsAction:null,
 monsters:[{id:'enemy',name:'enemy',hp:1000,alive:true,canAct:true,level:50,element:'water'}],currentBattleMonsters:[0],
 BASE_PHYSICAL_ATTACK:30,BASE_MAGIC_ATTACK:30,BASE_DEFENSE:30,ATTACK_PER_LEVEL:4,MAGIC_ATTACK_PER_LEVEL:4,DEFENSE_PER_LEVEL:3,
 ATTACK_PER_POINT:3,MAGIC_ATTACK_PER_POINT:3,DEFENSE_PER_POINT:2,HP_PER_VITALITY_POINT:20,
 getEffectivePlayerAbilityPoints:(c,b,k)=>Number(c[k]||0),
 getEquipmentBonus:()=>({}),getActiveBuffPercent:(c,k)=>c.activeBuffs?.find(b=>b.type===k)?.percent||0,
 getPlayerDefenseDownPercent:()=>0,getWindEXFinalEvasionBonusPercent:()=>0,getRelicFinalEvasionPercent:()=>0,
 getFrostbiteFinalPercentPointPenalty:()=>0,combineEvasionRates:values=>Math.max(0,values.reduce((a,b)=>a+b,0)),projectRelicBattleStats:(_,s)=>s,
 getSkillLevel:()=>1,getMainCharacterStats:()=>({agility:1,maxHP:100,maxSP:100}),getPlayer2BattleStats:()=>({agility:2,maxHP:100,maxSP:100}),getPlayer3BattleStats:()=>({agility:3,maxHP:100,maxSP:100}),
 getMonsterAgility:()=>5,getCharacterBattleArtworkPath:()=>'',
 canSelectHostileBattlePrimary:(_,i)=>ctx.getPartyCharacterByIndex(i)?.hp>0&&!ctx.getPartyCharacterByIndex(i).stealth,
 normalizeBattleTargetType:x=>x,
 getMonsterEvasion:()=>0,getFinalHitReductionPercent:()=>0,getFinalAccuracyBonusPercent:()=>0,
 getMonsterEffectiveAntiCrit:()=>0,getMonsterEffectiveDefense:()=>0,
 findAliveTargetIndex:i=>i??0,rollHitChance:()=>true,rollCritical:()=>({isCrit:true,multiplier:1.5}),
 calculateDamage:(...args)=>{ctx.damageArgs=args;return 20;},settleBattleHpDamage:(target,damage)=>{target.hp=Math.max(0,target.hp-damage);},getDamageContextAttacker:()=>ctx.getPartyCharacterByIndex(ctx.activeBattleCharacterIndex),
 showMissEffect:()=>ctx.misses++,misses:0,lungePlayerCard:noop,showSkillNameBadge:noop,showMonsterHit:noop,addBattleLog:noop,updateUI:noop,killMonster:noop,
 finishPlayerAction:()=>ctx.finishes++,finishes:0,
 document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:noop,readyState:'complete'},
 setTimeout:noop,clearTimeout:noop,
 skillDatabase:{revive:{name:'Revive',spCost:1,reviveHealPercentByLevel:[20]},waterEX:{}},healBonusMultiplier:1,
 spendActiveSkillSP:(c,n)=>c.sp-=n,showPlayerSpPopup:noop,showPlayerHit:noop};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(decl('calculateCharacterBaseStats'),ctx);
 for(const id of core.listHeroDefinitions().map(d=>d.heroId))account=core.createDomain(account,()=>players,ctx.calculateCharacterBaseStats,()=>null).unlockHeroDirect(id,10);
 const original=JSON.stringify(account);
 const domain=core.createDomain(account,()=>players,ctx.calculateCharacterBaseStats,()=>null);
 const ids=core.listHeroDefinitions().map(d=>d.heroId);
 // Capacity fixture only: no production registry/save changes or duplicate real Hero identity.
 const third='fixture-third-hero';
 const d=count===3?{...domain,listHeroDefinitions:()=>[...domain.listHeroDefinitions(),{heroId:third,name:'Fixture'}],getHeroDefinition:id=>id===third?{heroId:third,name:'Fixture',element:'earth'}:domain.getHeroDefinition(id),isHeroUnlocked:id=>id===third||domain.isHeroUnlocked(id),getHeroBaseStats:id=>domain.getHeroBaseStats(id===third?ids[0]:id),getHeroLevel:id=>domain.getHeroLevel(id===third?ids[0]:id),getHeroAllocatedStats:id=>domain.getHeroAllocatedStats(id===third?ids[0]:id)}:domain;
 if(count===3){d.getHeroSkillProjection=id=>domain.getHeroSkillProjection(id===third?ids[0]:id);}
 ctx.FourSymbolsHeroSystem={getDomain:()=>d};
 vm.runInContext(main.slice(main.indexOf('// Battle-only roster.'),main.indexOf('function getCharacterArtworkPath(')),ctx);
 ctx.FourSymbolsHeroBattle.setRoster([...ids,third].slice(0,count));
 ctx.initializeHeroBattleCombatants();ctx.battleActive=true;
 for(const n of ['getAdditionalCharacterBattleStats','getPartyBattleStats','getLivingParty','getRevivableAllySlots','buildInitiativeQueue','getBattleStatisticsOwner','getBattleStatisticsCombatantKind','buildBattleStatisticsCombatant','beginBattleStatisticsSession','battleStatisticsBeginAction','battleStatisticsFinishAction','createEnemyActionTargetSnapshot','resolveEnemyActionTargets','secondaryCharacterNormalAttack','castReviveSkill'])vm.runInContext(decl(n),ctx);
 vm.runInContext(fs.readFileSync('js/battlefield-slot-owner.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('js/battle-statistics-system.js','utf8'),ctx);
 ctx.resolveBattlefieldTargets=(_,i,shape)=>ctx.FourSymbolsBattlefieldSlots.resolveAllyTargets(ctx.FourSymbolsBattlefieldSlots.ensureAllyFormation(ctx.getExistingPartyIndexes()),i,shape,j=>ctx.getPartyCharacterByIndex(j)?.hp>0);
 return {ctx,domain,account,original,setRandom:v=>random=v};
}
for(const count of [0,1,2,3])test(count+' Hero roster, six-slot capacity, unique initiative and statistics kind',()=>{
 const {ctx,domain,account,original}=runtime(count);
 assert.deepEqual(Array.from(ctx.getExistingPartyIndexes()),Array.from({length:3+count},(_,i)=>i));
 const q=ctx.buildInitiativeQueue(),allies=q.filter(e=>e.type!=='monster');
 assert.equal(allies.length,3+count);assert.equal(new Set(allies.map(e=>e.characterIndex)).size,3+count);
 assert.equal(allies.filter(e=>e.type==='heroNpc').length,count);
 for(const e of allies.filter(e=>e.type==='heroNpc')){const h=ctx.getPartyCharacterByIndex(e.characterIndex);assert.equal(h.combatantKind,'heroNpc');assert.equal(ctx.getPartyCharacterKey(e.characterIndex),null);assert.equal(ctx.getPartyCharacterIndex(h),e.characterIndex);assert.equal(h.level,48);}
 const owner=ctx.FourSymbolsBattlefieldSlots,f=owner.ensureAllyFormation(ctx.getExistingPartyIndexes());
 assert.equal(new Set(Object.values(f.characterIndexToSlot)).size,3+count);
 assert.deepEqual(Object.keys(owner.getSerializableAllyFormation([0,1,2]).characterIndexToSlot),['0','1','2']);
 ctx.beginBattleStatisticsSession();const stats=ctx.FourSymbolsBattleStatistics.getSnapshot();
 assert.equal(stats.combatants.length,3+count);assert.equal(stats.combatants.filter(c=>c.kind==='heroNpc').length,count);
 assert.equal(JSON.stringify(account),original);assert.deepEqual(plain(domain.serialize()),plain(account));
 ctx.battleActive=false;assert.deepEqual(Array.from(ctx.getExistingPartyIndexes()),[0,1,2]);
});
test('Hero uses domain projection and shared Buff projection; no player EX/loadout',()=>{
 const {ctx,domain}=runtime(2);const h=ctx.getPartyCharacterByIndex(3);
 assert.deepEqual(plain(ctx.getPartyBattleStats(3)),plain(domain.getHeroBaseStats(h.heroId)));
 h.activeBuffs.push({type:'dodgeSkill',percent:25,turnsLeft:1});assert.equal(ctx.getPartyBattleStats(3).evasion,25);
 assert.throws(()=>ctx.FourSymbolsHeroBattle.setRoster([]),/during battle/);
 ctx.battleActive=false;assert.throws(()=>ctx.FourSymbolsHeroBattle.setRoster(['unknown']));assert.throws(()=>ctx.FourSymbolsHeroBattle.setRoster([h.heroId,h.heroId]));
});
test('Natural Hero declaration queues one basic action per identity and clears prior manual highlight',()=>{
 const {ctx}=runtime(3);let cleared=0,resolved=0;
 Object.assign(ctx,{battlePresentationLocks:new Set(),declaredCharacterIndexes:new Set(),autoBattle:false,
  closeMenus:()=>{},clearBattleTargetSelectionMode:()=>{},clearActiveCharacterHighlight:()=>cleared++,
  startResolutionPhase:()=>resolved++,isBattleTargetAlive:(kind,index)=>kind==='monster'&&ctx.monsters[index]?.hp>0,
  canSelectHostileBattlePrimary:(kind,index)=>kind==='monster'&&ctx.monsters[index]?.hp>0});
 for(const name of ['autoActionForCharacter','beginCharacterTurn'])vm.runInContext(decl(name),ctx);
 for(const index of [3,4,5]){
  ctx.activeBattleCharacterIndex=index;ctx.beginCharacterTurn(7);ctx.beginCharacterTurn(7);
  assert.deepEqual(plain(ctx.queuedPlayerActions[index]),{action:'normal',target:0});
 }
 assert.equal(ctx.finishes,3);assert.equal(cleared,3);assert.deepEqual(Array.from(ctx.declaredCharacterIndexes),[3,4,5]);
 ctx.activeBattleCharacterIndex=6;ctx.beginCharacterTurn(7);assert.equal(resolved,1);
});
test('Hero basic attack shares hit, critical and damage settlement; MISS finishes once',()=>{
 const {ctx}=runtime(1);const h=ctx.getPartyCharacterByIndex(3);
 ctx.secondaryCharacterNormalAttack(3,0);assert.equal(ctx.monsters[0].hp,980);assert.equal(ctx.finishes,1);assert.equal(ctx.damageArgs[6].attacker,h);
 ctx.rollHitChance=()=>false;ctx.secondaryCharacterNormalAttack(3,0);assert.equal(ctx.monsters[0].hp,980);assert.equal(ctx.misses,1);assert.equal(ctx.finishes,2);
});
test('Enemy targeting reaches every Hero, death excludes it, legal revive preserves identity',()=>{
 const {ctx,setRandom}=runtime(3);ctx.beginBattleStatisticsSession();
 for(const [roll,index] of [[.51,3],[.7,4],[.99,5]]){setRandom(roll);assert.equal(ctx.createEnemyActionTargetSnapshot(0,7).primary.index,index);}
 const h=ctx.getPartyCharacterByIndex(5),id=ctx.FourSymbolsBattleStatistics.getCombatantIdByBattleIndex(5);h.hp=0;
 const snapshot=ctx.createEnemyActionTargetSnapshot(0,7);assert.ok(!snapshot.targets.some(e=>e.index===5));assert.ok(!ctx.getLivingParty().includes(5));assert.ok(!ctx.buildInitiativeQueue().some(e=>e.characterIndex===5));
 ctx.castReviveSkill('revive',5);assert.ok(h.hp>0);assert.equal(ctx.getPartyCharacterByIndex(5),h);assert.equal(ctx.FourSymbolsBattleStatistics.getCombatantIdByBattleIndex(5),id);
 assert.ok(ctx.buildInitiativeQueue().some(e=>e.type==='heroNpc'&&e.characterIndex===5));assert.ok(ctx.createEnemyActionTargetSnapshot(0,7).targets.some(e=>e.character===h));
 assert.ok(!ctx.resolveEnemyActionTargets(snapshot,'all').targets.some(e=>e.index===5),'revive never widens earlier action snapshot');
});
test('Hero damage taken/dealt and healing use same statistics HP deltas',()=>{
 const {ctx}=runtime(1);ctx.beginBattleStatisticsSession();const h=ctx.getPartyCharacterByIndex(3);
 ctx.battleStatisticsBeginAction({type:'heroNpc',characterIndex:3});ctx.monsters[0].hp-=20;ctx.battleStatisticsFinishAction();
 ctx.battleStatisticsBeginAction({type:'monster',monsterIndex:0});h.hp-=10;ctx.battleStatisticsFinishAction();
 const row=ctx.FourSymbolsBattleStatistics.getSnapshot().combatants.find(c=>c.kind==='heroNpc');assert.equal(row.damageDealt,20);assert.equal(row.damageTaken,10);
 const old=h;ctx.initializeHeroBattleCombatants();assert.notEqual(ctx.getPartyCharacterByIndex(3),old);assert.equal(ctx.getPartyCharacterByIndex(3).activeBuffs.length,0);
});

test('Phase 2B action completion counts MISS, deduplicates incoming hits, preserves death state and resets new battle',()=>{
 const {ctx,account,original}=runtime(2),h=ctx.getPartyCharacterByIndex(3);
 const basic={entity:h,entry:{type:'heroNpc'},basicAttackPerformed:true};
 ctx.finishHeroBattleAction({action:basic});ctx.finishHeroBattleAction({action:basic});
 assert.equal(h.rage,1);assert.equal(h.phoenixBurnStacks,1);
 ctx.battleDurationAction={entity:ctx.monsters[0],entry:{type:'monster'}};
 for(let i=0;i<5;i++)ctx.recordHeroEnemyActionReceipt({target:h,hit:false});
 ctx.recordHeroEnemyActionReceipt({target:h,damageKind:'reflect',sourceType:'reflect'});
 h.hp=0;ctx.finishHeroBattleAction({action:ctx.battleDurationAction});
 assert.equal(h.rage,2);assert.equal(h.phoenixBurnStacks,1);
 for(const sourceType of ['dot','reflect','self','environment','hpCost','relic']){
  ctx.battleDurationAction={entity:ctx.monsters[0],entry:{type:'monster'}};
  ctx.recordHeroEnemyActionReceipt({target:h,sourceType});ctx.finishHeroBattleAction({action:ctx.battleDurationAction});
 }
 assert.equal(h.rage,2);h.rage=12;ctx.addHeroBattleRage(h);assert.equal(h.rage,12);
 assert.deepEqual(plain(ctx.getBattleSecondaryResource(h,{maxSP:999})),{kind:'rage',current:12,max:12});
 assert.deepEqual(plain(ctx.getBattleSecondaryResource(ctx.player,{maxSP:100})),{kind:'sp',current:100,max:100});
 ctx.initializeHeroBattleCombatants();assert.equal(ctx.getPartyCharacterByIndex(3).rage,0);assert.equal(ctx.getPartyCharacterByIndex(3).phoenixBurnStacks,0);
 assert.equal(JSON.stringify(account),original);
});

test('Phase 2B Vajra passive chooses absolute HP and canonical slot tie; uses named one-round Stealth',()=>{
 const {ctx}=runtime(2),actor=ctx.getPartyCharacterByIndex(4);
 Object.assign(ctx,{canApplyNamedPersistentState:(t)=>!t.activeBuffs?.some(b=>b.type==='stealthSkill'),markPersistentStateName:s=>s,emitCombatEvent:()=>{}});
 for(const i of ctx.getExistingPartyIndexes())ctx.getPartyCharacterByIndex(i).hp=50;
 ctx.getPartyCharacterByIndex(3).hp=1;
 ctx.finishHeroBattleAction({action:{entity:actor,basicAttackPerformed:true}});
 assert.deepEqual(plain(ctx.getPartyCharacterByIndex(3).activeBuffs),[{type:'stealthSkill',turnsLeft:1}]);
 ctx.getPartyCharacterByIndex(3).hp=50;
 ctx.finishHeroBattleAction({action:{entity:actor,basicAttackPerformed:true}});
 const slots=ctx.FourSymbolsBattlefieldSlots,first=slots.getCharacterAtAllySlot(slots.allySlots[0]);
 assert.equal(ctx.getPartyCharacterByIndex(first).activeBuffs[0].type,'stealthSkill');
 assert.equal(actor.rage,2);
});

test('Phase 2B Hero cast uses Core level, Rage only and local burn bonus; invalid targets retain resources',()=>{
 const {ctx}=runtime(1),h=ctx.getPartyCharacterByIndex(3);h.rage=4;h.phoenixBurnStacks=2;
 const skill={id:'phoenixCry',name:'火鳳天鳴',element:'fire',category:'magic',targetType:'all',spCost:999,baseDamage:1,burnChance:35,burnDuration:2,burnPercentByLevel:Array(10).fill(5)};
 ctx.skillDatabase.phoenixCry=skill;
 Object.assign(ctx,{getEffectiveSkillTargetType:s=>s.targetType,getSkillTargets:()=>[],getMonsterEffectiveStatusResistance:()=>0,
 calculateSkillDamage:args=>{ctx.skillArgs=args;return 20;},rollNamedPersistentStatusEffect:(_,type,args)=>{ctx.statusArgs=args;return {hit:true};},applyBurnEffect:()=>{},applySkillDebuffEffects:()=>{}});
 vm.runInContext(decl('castSecondaryCharacterSkill'),ctx);
 const sp=h.sp;ctx.castSecondaryCharacterSkill(3,'phoenixCry',null);
 assert.equal(h.rage,4);assert.equal(h.phoenixBurnStacks,2);
 ctx.getSkillTargets=()=>[0];ctx.castSecondaryCharacterSkill(3,'phoenixCry',null);
 assert.equal(h.rage,0);assert.equal(h.sp,sp);assert.equal(h.phoenixBurnStacks,0);
 assert.equal(ctx.skillArgs.skillLevel,5);assert.equal(ctx.statusArgs[0],65);assert.equal(skill.burnChance,35);
});
