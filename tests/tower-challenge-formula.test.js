'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=fs.readFileSync('js/00-main.js','utf8'),base=fs.readFileSync('js/34-v141-core-systems.js','utf8');
function fn(source,name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('\n}',start);if(end>=0&&source===core)return source.slice(start,end+2);const next=source.indexOf('\n    }',start);return source.slice(start,next+6);}
const c={window:null,Math:Object.create(Math),Number,String,Array,Object,CRIT_CHANCE_MAX:95,CRIT_CHANCE_MIN_AFTER_ANTI_CRIT:5,STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT:.05,STATUS_HIT_MIN_PERCENT:5,STATUS_HIT_MAX_PERCENT:95,
 getActiveRageCriticalBonuses:m=>({chance:m?.rage||0}),getDamageContextAttacker:o=>o.attacker,getDamageLevelMultiplier:()=>1,getElementalDamageMultiplier:()=>1,getDamageFormulaConstant:()=>100,getOrdinaryDamageMultiplier:()=>1,getEnemyPressureMultiplier:()=>1,getDamageBudgetMultiplier:()=>1,syncMonsterShield:()=>0,
 isMonsterFrozen:m=>!!m.frozen,isMonsterPetrified:()=>false,skillDatabase:{attack:{category:'magic',spCost:10},heal:{category:'heal',spCost:10}},getPersistentStateConflict:()=>null,getMonsterTimedStatusResistanceBonus:()=>0};
c.window=c;vm.createContext(c);
vm.runInContext(core.match(/const LOCKDOWN_HIT_BOUNDS = \{[\s\S]*?\n\};/)[0],c);
for(const n of ['getTowerDirectDamageMultiplier','getTowerStatusAccuracyBonus','getMonsterCriticalChance','calculateDamage','chooseEnemySkillCategory','calculateStatusEffectChance','rollNamedPersistentStatusEffect'])vm.runInContext(fn(core,n),c);
const ai=core.slice(core.indexOf('window.FourSymbolsEnemySkillAI=Object.freeze({'),core.indexOf('\n});',core.indexOf('window.FourSymbolsEnemySkillAI=Object.freeze({'))+4);vm.runInContext(ai,c);
vm.runInContext(fn(base,'healMonsterPreservingShield'),c);
c.Math.random=()=>.5;
const fire={vGameplayTower:true,vTowerDirectDamageMultiplier:1.15,vTowerCriticalBonusPercent:15};
assert.equal(c.getMonsterCriticalChance(fire),25);assert.equal(c.getMonsterCriticalChance({...fire,rage:200}),95);assert.equal(c.getMonsterCriticalChance({}),10);
assert.equal(c.calculateDamage(1000,0,1,1,'fire','water',{attacker:fire}),1150);
for(const category of ['physical','magic'])assert.equal(c.calculateDamage(1000,0,1,1,'fire','water',{attacker:fire,skill:{category}}),1150);
for(const damageKind of ['dot','burn','reflect','relic','object','hp-cost','self','environment'])assert.equal(c.calculateDamage(1000,0,1,1,'fire','water',{attacker:fire,damageKind}),1000);
assert.equal(c.getTowerDirectDamageMultiplier({...fire,canAct:false}),1);assert.equal(c.getTowerDirectDamageMultiplier({vTowerDirectDamageMultiplier:1.15}),1);
const water={element:"water",vGameplayTower:true,vTowerHealingMultiplier:1.15,vTowerStatusAccuracyPercent:15};
let target={alive:true,maxHP:2000,hp:0,sp:20};assert.equal(c.healMonsterPreservingShield(target,1000,water),1150);assert.equal(target.sp,20);assert.equal(c.healMonsterPreservingShield({...target,hp:0},1000,{}),1000);
const bonus=c.getTowerStatusAccuracyBonus(water);
assert.equal(c.calculateStatusEffectChance(30,1,1,0,0,false,'player',0,bonus),45);
assert.equal(c.calculateStatusEffectChance(30,1,1,0,0,true,'player',0,bonus),45);
assert.equal(c.calculateStatusEffectChance(52,1,1,0,0,true,'player',0,bonus),60);
for(const [rank,cap] of [['regular',90],['elite',75],['boss',60],['player',60]])assert.equal(c.calculateStatusEffectChance(999,1,1,0,0,true,rank),cap);
assert.equal(c.calculateStatusEffectChance(-999,1,1,0,0,true,'player'),5);assert.equal(c.calculateStatusEffectChance(999,1,1,0,0,false,'player'),95);
let rollArgs;c.rollStatusEffectHit=(...args)=>{rollArgs=args;return true;};c.rollNamedPersistentStatusEffect({},'freeze',[52,1,1,0,0,true,'boss',0,15],'player',0);assert.equal(rollArgs[6],'player');assert.equal(rollArgs[8],15);
for(const chance of [.65,.7,.75,.8]){
 const monster={...water,alive:true,skillIds:['attack'],v141SupportSkillIds:['heal'],sp:100,skillChance:chance};
 let successes=0;for(let i=0;i<1000;i++)successes+=Number(c.FourSymbolsEnemySkillAI.enterSkillDecision(monster,(i+.5)/1000));assert.equal(successes,chance*1000);
 assert.equal(c.FourSymbolsEnemySkillAI.enterSkillDecision({...monster,canAct:false},0),false);assert.equal(c.FourSymbolsEnemySkillAI.enterSkillDecision({...monster,sp:0},0),false);assert.equal(c.FourSymbolsEnemySkillAI.enterSkillDecision({...monster,frozen:true},0),false);
}
assert.equal(c.chooseEnemySkillCategory(['attack'],['buff'],.5,water),'buff');assert.equal(c.chooseEnemySkillCategory(['attack'],['buff'],.5,{}),'attack');
console.log('Tower direct damage exclusions, crit, HP healing, status bounds and single skill probability gate passed.');
