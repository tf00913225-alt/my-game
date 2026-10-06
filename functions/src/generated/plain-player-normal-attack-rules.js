// GENERATED from js/00-main.js by production build. DO NOT EDIT.
"use strict";
function createPlainPlayerRules(player,random){
    const Math=Object.create(globalThis.Math);
    Math.random=random;
    const window=Object.freeze({});
    const getStatDownPercentFor=()=>0;
    const getMonsterDebuffValue=()=>0;
    const getLearnedElementEX=()=>null;
    const getPartyCharacterIndex=entity=>entity===player?0:-1;
    const getPartyBattleStats=()=>stats;
    const battleStatisticsRecordCriticalByActor=()=>{};
const BASE_PHYSICAL_ATTACK = 30;

const BASE_MAGIC_ATTACK = 30;

const BASE_DEFENSE = 30;

const ATTACK_PER_LEVEL = 4;

const MAGIC_ATTACK_PER_LEVEL = 4;

const DEFENSE_PER_LEVEL = 3;

const ATTACK_PER_POINT = 4;

const MAGIC_ATTACK_PER_POINT = 2.75;

const DEFENSE_PER_POINT = 4;

const HP_PER_VITALITY_POINT = 50;

const DAMAGE_FORMULA_BASE_CONSTANT = 400;

const DAMAGE_FORMULA_PER_TARGET_LEVEL = 10;

const NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX = 1.50;

const FINAL_CRITICAL_MULTIPLIER_MAX = 2.25;

const ELEMENT_COUNTER_MAP = {
    earth:"water",
    water:"fire",
    fire:"wind",
    wind:"earth"
};

const ELEMENT_ADVANTAGE_MULTIPLIER = 1.20;

const ELEMENT_DISADVANTAGE_MULTIPLIER = 0.85;

const ENEMY_PRESSURE_RANK_BONUS = Object.freeze({
    regular:0,
    elite:0.10,
    boss:0.20
});

const ENEMY_PRESSURE_DAILY_DUNGEON_BONUS = 0.05;

const ENEMY_PRESSURE_ABYSS_BONUS = 0.15;

const HIT_CHANCE_BASE = 95;

const HIT_CHANCE_MIN_PERCENT = 5;

const HIT_CHANCE_MAX_PERCENT = 99;

const CRIT_CHANCE_BASE=10;

const CRIT_CHANCE_MAX=95;

const CRIT_MULTIPLIER_BASE=1.5;

const CRIT_MULTIPLIER_MAX=2.25;

function getEffectivePlayerAbilityPoints(character,equipmentBonus,statName){
    if(!character){ return 0; }

    const basePoints=Number(character[statName])||0;
    const equipmentPoints=Number(equipmentBonus&&equipmentBonus[statName])||0;

    const statDown=getStatDownPercentFor(character,statName);

    let effective=(basePoints+equipmentPoints)*(1-statDown/100);

    if(statName==="agility"){
        const agilityDown=getMonsterDebuffValue(character,"agilityDown");
        effective*=1-agilityDown/100;
    }

    return Math.max(0,effective);
}

function calculateCharacterBaseStats(character,equipmentBonus){
    const source=character&&typeof character==="object"?character:{};
    const bonus=equipmentBonus&&typeof equipmentBonus==="object"?equipmentBonus:{};
    const level=Math.max(1,Number(source.level)||1);
    const points={};
    ["attack","intelligence","vitality","energy","defensePoints","agility"].forEach(stat=>{
        points[stat]=getEffectivePlayerAbilityPoints(source,bonus,stat);
    });
    return {
        maxHP:100+points.vitality*HP_PER_VITALITY_POINT+(Number(source.bonusHP)||0)+(Number(bonus.maxHP)||0),
        maxSP:50+points.energy*15+(Number(source.bonusSP)||0)+(Number(bonus.maxSP)||0),
        attack:BASE_PHYSICAL_ATTACK+level*ATTACK_PER_LEVEL+points.attack*ATTACK_PER_POINT,
        attackPoints:points.attack,
        defense:BASE_DEFENSE+level*DEFENSE_PER_LEVEL+points.defensePoints*DEFENSE_PER_POINT+(Number(bonus.defense)||0),
        defensePoints:points.defensePoints,
        magicAttack:BASE_MAGIC_ATTACK+level*MAGIC_ATTACK_PER_LEVEL+points.intelligence*MAGIC_ATTACK_PER_POINT,
        accuracy:Number(bonus.accuracy)||0,
        statusResistance:Number(bonus.statusResistance)||0,
        antiCrit:Number(bonus.antiCrit)||0,
        criticalChance:(Number(bonus.criticalChance)||0)+(Number(bonus.crit)||0),
        criticalDamage:Number(bonus.criticalDamage)||0,
        statusAccuracy:Number(bonus.statusAccuracy)||0,
        speed:points.agility,
        evasion:Number(bonus.evasion)||0,
        vitality:points.vitality,
        energy:points.energy,
        intelligence:points.intelligence,
        agility:points.agility
    };
}

function getDamageFormulaConstant(targetLevel){
    const resolvedTargetLevel=Math.max(1,Number(targetLevel)||1);
    return DAMAGE_FORMULA_BASE_CONSTANT+resolvedTargetLevel*DAMAGE_FORMULA_PER_TARGET_LEVEL;
}

function getDamageLevelMultiplier(casterLevel,targetLevel){
    /* V2: validate Level Contract inputs; never cap/floor the multiplier. */
    const caster=Number(casterLevel);
    const target=Number(targetLevel);
    const resolvedCasterLevel=Number.isSafeInteger(caster)&&caster>=1&&caster<=100?caster:1;
    const resolvedTargetLevel=Number.isSafeInteger(target)&&target>=1&&target<=100?target:1;
    const levelDiff=resolvedCasterLevel-resolvedTargetLevel;
    return Math.pow(1.01,levelDiff);
}

function getElementalDamageMultiplier(casterElement,targetElement){
    if(!casterElement||!targetElement){ return 1; }
    if(ELEMENT_COUNTER_MAP[casterElement]===targetElement){ return ELEMENT_ADVANTAGE_MULTIPLIER; }
    if(ELEMENT_COUNTER_MAP[targetElement]===casterElement){ return ELEMENT_DISADVANTAGE_MULTIPLIER; }
    return 1;
}

function getDamageContextAttacker(options){
    if(options&&options.attacker){ return options.attacker; }
    if(typeof window.v155GetCurrentDamageActor==="function"){
        return window.v155GetCurrentDamageActor();
    }
    return window.v149CurrentDamageActor||null;
}

function getOrdinaryDamageBonusPercent(options){
    const resolved=options&&typeof options==="object"?options:{};
    const attacker=getDamageContextAttacker(resolved);
    const target=resolved.target||null;
    const skill=resolved.skill||null;
    let total=0;

    if(attacker&&typeof getElementDamagePassiveMultiplier==="function"){
        total+=(Math.max(0,Number(getElementDamagePassiveMultiplier(attacker))||1)-1)*100;
    }
    if(
        attacker&&target&&attacker.element==="fire"&&
        typeof getLearnedElementEX==="function"&&getLearnedElementEX(attacker,"fire")&&
        Array.isArray(target.statusEffects)&&
        target.statusEffects.some(effect=>effect&&Number(effect.turnsLeft)>0)
    ){
        total+=Number(skillDatabase.fireEX&&skillDatabase.fireEX.statusTargetDamageBonusPercent)||0;
    }
    if(attacker&&typeof window.v155GetPhoenixMightMultiplier==="function"){
        total+=(Math.max(0,Number(window.v155GetPhoenixMightMultiplier(attacker))||1)-1)*100;
    }
    if(skill&&Number.isFinite(Number(skill.damageBonusPercent))){
        total+=Number(skill.damageBonusPercent);
    }
    if(attacker&&typeof window!=="undefined"&&window.FourSymbolsSkillDamageContext&&
        window.FourSymbolsSkillDamageContext.attacker===attacker&&
        window.FourSymbolsSkillDamageContext.skill===skill){
        total+=Number(window.FourSymbolsSkillDamageContext.directSkillBonusPercent)||0;
    }

    const extras=Array.isArray(resolved.ordinaryDamageBonusPercent)
        ?resolved.ordinaryDamageBonusPercent
        :[resolved.ordinaryDamageBonusPercent];
    extras.forEach(value=>{
        if(Number.isFinite(Number(value))){ total+=Number(value); }
    });

    if(attacker&&typeof getOutgoingDamageDownPercent==="function"){
        total-=getOutgoingDamageDownPercent(attacker);
    }
    return Math.max(-100,Math.min(50,total));
}

function getOrdinaryDamageMultiplier(options){
    return Math.max(
        0,
        Math.min(NORMAL_DAMAGE_BONUS_MULTIPLIER_MAX,1+getOrdinaryDamageBonusPercent(options)/100)
    );
}

function isPartyDamageTarget(entity){
    return !!(
        entity&&typeof getPartyCharacterIndex==="function"&&getPartyCharacterIndex(entity)>=0
    );
}

function getEnemyPressureMultiplier(attacker,target){
    if(!attacker||!target||isPartyDamageTarget(attacker)||!isPartyDamageTarget(target)){
        return 1;
    }
    if(["wild","daily","tower","abyss","adventure","personalBoss","worldBoss"].includes(attacker.mode)&&attacker.balanceOwner==="MonsterBalance"){
        return attacker.balanceProjection.finalDamagePressure;
    }
    const rank=typeof getMonsterRank==="function"?getMonsterRank(attacker):"regular";
    let bonus=ENEMY_PRESSURE_RANK_BONUS[rank]||0;
    if(attacker.v141Abyss){ bonus+=ENEMY_PRESSURE_ABYSS_BONUS; }
    else if(attacker.v132Dungeon||attacker.v132EquipmentDungeon){
        bonus+=ENEMY_PRESSURE_DAILY_DUNGEON_BONUS;
    }
    return 1+bonus;
}

function getDamageBudgetMultiplier(skillOrOptions){
    const options=skillOrOptions&&typeof skillOrOptions==="object"?skillOrOptions:{};
    const skill=options.skill||options;
    const explicit=Number(options.damageBudgetMultiplier);
    const configured=Number(skill&&skill.damageBudgetMultiplier);
    if(Number.isFinite(explicit)){ return Math.max(0,explicit); }
    if(Number.isFinite(configured)){ return Math.max(0,configured); }
    return 1;
}

function getTowerDirectDamageMultiplier(attacker,damageOptions){
    const options=damageOptions||{};
    const kind=String(options.damageKind||"direct");
    const skill=options.skill;
    const directSkill=!skill||skill.category==="physical"||skill.category==="magic";
    return attacker&&attacker.vGameplayTower===true&&attacker.canAct!==false&&
        attacker.vGameplayBossObject!==true&&kind==="direct"&&directSkill
        ?Math.max(1,Number(attacker.vTowerDirectDamageMultiplier)||1):1;
}

function calculateDamage(
    attack,
    defense,
    casterLevel,
    targetLevel,
    casterElement,
    targetElement,
    damageOptions
){
    const options=damageOptions&&typeof damageOptions==="object"?damageOptions:{};
    const safeAttack=Math.max(0,Number(attack)||0);
    const safeDefense=Math.max(0,Number(defense)||0);
    const levelFactor=getDamageLevelMultiplier(casterLevel,targetLevel);
    /* Element counter is character DNA, never the skill visual identity. */
    const attacker=getDamageContextAttacker(options);
    const elementFactor=getElementalDamageMultiplier((attacker&&attacker.element)||casterElement,targetElement);
    const formulaConstant=getDamageFormulaConstant(targetLevel);
    const defenseFactor=formulaConstant/(formulaConstant+safeDefense);
    const ordinaryFactor=getOrdinaryDamageMultiplier(options);
    const requestedCrit=Number(options.critMultiplier);
    const criticalFactor=Number.isFinite(requestedCrit)
        ?Math.max(1,Math.min(FINAL_CRITICAL_MULTIPLIER_MAX,requestedCrit))
        :1;
    const pressureFactor=getEnemyPressureMultiplier(attacker,options.target||null);
    const bossOwner=typeof window!=="undefined"?window.FourSymbolsBossBattle:null;
    const bossDamageFactor=bossOwner&&typeof bossOwner.getOutgoingDamageMultiplier==="function"
        ?Math.max(0,Number(bossOwner.getOutgoingDamageMultiplier(attacker))||0):1;
    const towerFactor=getTowerDirectDamageMultiplier(attacker,options);
    const budgetFactor=getDamageBudgetMultiplier(options);
    const randomFactor=0.95+Math.random()*0.10;

    const result=
        safeAttack*levelFactor*elementFactor*defenseFactor*
        ordinaryFactor*criticalFactor*pressureFactor*bossDamageFactor*towerFactor*budgetFactor*randomFactor;

    if(!Number.isFinite(result)){ return 1; }
    return Math.max(1,Math.round(result));
}

function calculateHitChancePercent(
    casterAccuracy,
    targetEvasion,
    directChanceReductionPercent,
    directChanceBonusPercent,
    targetCharacter
){
    const chance=
        HIT_CHANCE_BASE+
        (Number(casterAccuracy)||0)+
        (Number(directChanceBonusPercent)||0)-
        Math.max(0,Number(targetEvasion)||0)-
        Math.max(0,Number(directChanceReductionPercent)||0);

    const normalFinalChance=Math.max(
        HIT_CHANCE_MIN_PERCENT,
        Math.min(HIT_CHANCE_MAX_PERCENT,chance)
    );
    return normalFinalChance;
}

function getCriticalStatPoints(character){
    const index=getPartyCharacterIndex(character);
    const stats=index>=0?getPartyBattleStats(index):null;
    return Math.max(0,Number(stats&&stats.criticalChance!==undefined?stats.criticalChance:character&&character.criticalChance)||0);
}

function rollCritical(character,category="physical",targetAntiCritPercent=0,target){
    if(target&&target.vBossShield&&Number(target.vBossShield.current)>0){ return {isCrit:false,multiplier:1}; }
    const stats=getPartyCharacterIndex(character)>=0?getPartyBattleStats(getPartyCharacterIndex(character)):null;
    let chance=Math.min(CRIT_CHANCE_MAX,CRIT_CHANCE_BASE+getCriticalStatPoints(character)+(Number(stats&&stats.statusAccuracy)||0));
    let multiplier=CRIT_MULTIPLIER_BASE+(Number(stats&&stats.criticalDamage)||0)/100;
    const ex=character&&character.element==="fire"?getLearnedElementEX(character,"fire"):null;
    if(ex){ chance+=Number(ex.critChanceBonusPercent)||0; multiplier+=(Number(ex.critDamageBonusPercent)||0)/100; }
    const rage=(character&&character.activeBuffs||[]).find(b=>b&&b.type==="rage");
    if(rage){ chance+=Number(rage.bonusPercent)||0; multiplier+=(Number(rage.bonusPercent)||0)/100; }
    chance=Math.max(5,chance-Math.max(0,Number(targetAntiCritPercent)||0));
    const isCrit=Math.random()*100<chance;
    if(isCrit){ battleStatisticsRecordCriticalByActor(character); }
    return {isCrit:isCrit,multiplier:isCrit?Math.min(CRIT_MULTIPLIER_MAX,multiplier):1};
}
    const stats=calculateCharacterBaseStats(player,{});
    return Object.freeze({stats,
        hit:enemy=>random()*100<calculateHitChancePercent(stats.accuracy,enemy.evasion,0,0),
        critical:enemy=>rollCritical(player,"physical",enemy.antiCrit,enemy),
        damage:(enemy,critical)=>calculateDamage(stats.attack,enemy.defense,player.level,enemy.level,
            player.element,enemy.element,{attacker:player,target:enemy,critMultiplier:critical.multiplier})
    });
}
module.exports={createPlainPlayerRules};
