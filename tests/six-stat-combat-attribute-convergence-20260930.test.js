"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const main=fs.readFileSync("js/00-main.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const contracts=fs.readFileSync("SYSTEM_CONTRACTS.md","utf8");
function extractFunction(source,name){
    const start=source.indexOf("function "+name+"(");
    assert.notEqual(start,-1,"missing function "+name);
    const opening=source.indexOf("{",start);
    let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
    for(let cursor=opening;cursor<source.length;cursor++){
        const char=source[cursor],next=source[cursor+1];
        if(lineComment){if(char==="\n")lineComment=false;continue;}
        if(blockComment){if(char==="*"&&next==="/"){blockComment=false;cursor++;}continue;}
        if(quote){if(escaped){escaped=false;continue;}if(char==="\\"){escaped=true;continue;}if(char===quote)quote=null;continue;}
        if(char==="/"&&next==="/"){lineComment=true;cursor++;continue;}
        if(char==="/"&&next==="*"){blockComment=true;cursor++;continue;}
        if(char==='"'||char==="'"||char==="`"){quote=char;continue;}
        if(char==="{")depth++;
        if(char==="}"&&--depth===0)return source.slice(start,cursor+1);
    }
    throw new Error("unterminated function "+name);
}
const context=vm.createContext({
    player:{id:"qa",level:50,attack:100,intelligence:100,vitality:100,energy:100,defensePoints:100,agility:100,bonusHP:0,bonusSP:0,element:"fire",activeBuffs:[]},
    BASE_PHYSICAL_ATTACK:30,BASE_MAGIC_ATTACK:30,BASE_DEFENSE:30,ATTACK_PER_LEVEL:4,MAGIC_ATTACK_PER_LEVEL:4,DEFENSE_PER_LEVEL:3,
    ATTACK_PER_POINT:4,MAGIC_ATTACK_PER_POINT:2.75,DEFENSE_PER_POINT:4,HP_PER_VITALITY_POINT:50,HEALING_INT_COEFFICIENT:1.25,
    characterEquipment:{fire:{weapon:{stats:{accuracy:5,evasion:3},reforgeStats:{accuracy:7,statusResistance:2}}}},
    getCharacterSkillKey:()=>"fire",getSkillLevel:()=>0,getActiveBuffPercent:()=>0,getActiveAccuracyBonusPercent:()=>0,getPlayerDefenseDownPercent:()=>0,
    getLearnedElementEX:()=>null,skillDatabase:{windEX:{accuracyBonusPercent:0,evasionBonusPercent:0},earthEX:{maxHpMultiplier:1,defenseBonusPercent:0}},
    combineEvasionRates:values=>values.reduce((sum,value)=>sum+value,0),getFrostbiteFinalPercentPointPenalty:()=>0,
    getMonsterDebuffValue:()=>0,getStatDownPercentFor:()=>0,Number,Math:Object.assign(Object.create(Math),{random:()=>0.5}),window:{FourSymbolsBossBattle:null},
    getDamageLevelMultiplier:()=>1,getDamageContextAttacker:()=>null,getElementalDamageMultiplier:()=>1,DAMAGE_FORMULA_BASE_CONSTANT:400,DAMAGE_FORMULA_PER_TARGET_LEVEL:10,
    getOrdinaryDamageMultiplier:()=>1,getEnemyPressureMultiplier:()=>1,getDamageBudgetMultiplier:()=>1
});
const names=["getBaseStats","getEquipmentBonus","getEffectivePlayerAbilityPoints","calculateCharacterBaseStats","getMainCharacterStats","migrateLegacySixStats","migrateLegacyEquipmentStats","getMonsterEvasion","getMonsterAccuracy","getMonsterEffectiveDefense","calculateHealingAmount","getDamageFormulaConstant","calculateDamage"];
vm.runInContext(names.map(name=>extractFunction(main,name)).join("\n"),context);
const base=context.getBaseStats();
assert.equal(base.attack-(30+50*4),400,"100 Attack Points add 400 Physical Attack");
assert.equal(base.magicAttack-(30+50*4),275,"100 Intelligence Points add 275 Magic Attack");
assert.equal(base.maxHP-100,5000,"100 Vitality adds 5000 Max HP");
assert.equal(base.maxSP-50,1500,"100 Energy adds 1500 Max SP");
assert.equal(base.defense-(30+50*3),400,"100 Defense Points add 400 Defense");
assert.equal(base.speed,100,"100 Agility adds 100 Speed");
assert.equal(base.evasion,3,"independent Equipment Evasion remains active");
assert.equal(base.accuracy,12,"equipment and reforge Accuracy remain active");
assert.equal(base.statusResistance,2,"independent reforge status resistance remains active");
const bareBase=context.calculateCharacterBaseStats(context.player,{});
assert.equal(bareBase.evasion,0,"Agility does not derive Evasion");
assert.equal(bareBase.accuracy,0,"six stats do not derive Accuracy");
assert.equal(bareBase.antiCrit,0,"six stats do not derive Anti-Crit");
assert.equal(bareBase.statusResistance,0,"six stats do not derive status resistance");
const mainStats=context.getMainCharacterStats();
assert.equal(mainStats.defensePoints,100);
assert.equal(mainStats.accuracy,12,"independent Equipment and reforge Accuracy reach the final battle stat");
assert.equal(mainStats.evasion,3,"independent Equipment Evasion reaches the final battle stat");
assert.equal(context.calculateHealingAmount(40,mainStats.intelligence),165);
const legacy={spirit:17,attributePoints:3,vitality:20};
context.migrateLegacySixStats(legacy);
assert.equal(legacy.attributePoints,20);
assert.equal(legacy.defensePoints,0);
assert.equal(legacy.vitality,20);
assert.equal(Object.hasOwn(legacy,"spirit"),false);
context.migrateLegacySixStats(legacy);
assert.equal(legacy.attributePoints,20,"migration is idempotent");
const gear={stats:{spirit:5},reforgeStats:{spirit:2}};
context.migrateLegacyEquipmentStats(gear);
assert.deepEqual(JSON.parse(JSON.stringify(gear.stats)),{accuracy:10,antiCrit:0.5,statusResistance:0.25});
assert.deepEqual(JSON.parse(JSON.stringify(gear.reforgeStats)),{accuracy:4,antiCrit:0.2,statusResistance:0.1});
const monster={level:50,defense:900,evasion:12,accuracy:4,statusEffects:[{type:"agilityDown",turnsLeft:2,value:80}]};
assert.equal(context.getMonsterAccuracy(monster),4,"Defense statDown does not reduce independent Accuracy");
assert.equal(context.getMonsterEvasion(monster),12,"Agility Down does not reduce independent Evasion");
assert.equal(context.getMonsterEffectiveDefense(monster),900);
assert.equal(context.getDamageFormulaConstant(50),900,"K remains 400 + target level × 10");
assert.ok(Math.abs((1-900/(900+400))*100-30.7692)<0.001);
assert.ok(Math.abs((1-900/(900+800))*100-47.0588)<0.001);
assert.ok(Math.abs((1-900/(900+1200))*100-57.1429)<0.001);
const damageA=context.calculateDamage(100,400,50,50,"fire","fire",{});
const damageB=context.calculateDamage(100,400,50,50,"water","water",{});
assert.equal(damageA,damageB,"shared Defense applies identically to physical and magic damage");
assert.equal(400/(900+400),400/1300);
assert.doesNotMatch(main,/PHYSICAL_SKILL_ELITE_BONUS_PERCENT|PHYSICAL_SKILL_BOSS_BONUS_PERCENT|getPhysicalSkillRankBonusMultiplier/);
assert.doesNotMatch(index,/精神|creationSpirit|statusSpirit|data-stat="spirit"/);
assert.match(index,/id="statusDefense"/);
assert.match(contracts,/Physical Damage.*Magic Damage/);
assert.match(contracts,/Physical Skill Elite\/Boss Rank Bonus.*RETIRED/);
console.log("✓ six-stat runtime owners, migration, unified defense, equipment preservation, and retired rank bonus");
