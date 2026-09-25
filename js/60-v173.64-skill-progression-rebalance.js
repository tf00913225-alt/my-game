/* =====================================================
   V173.64 — 四元素技能成長節奏正式 owner
   玩家技能樹專用：學習資格、境界門檻、技能點成本、技能頁提示。
   怪物／深淵／符咒不經過本層 learn/upgrade gate。
===================================================== */
(function installV17364SkillProgression(){
    "use strict";

    if(typeof window==="undefined"||window.__v17364SkillProgressionInstalled){ return; }
    window.__v17364SkillProgressionInstalled=true;

    const SKILL_UPGRADE_COST_BY_TARGET_LEVEL=Object.freeze({
        2:1,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1
    });
    const PLAYER_DAMAGE_SKILL_IDS=Object.freeze([
        "flameSlash","fireCritical","explosiveFlurry","dragonSlash",
        "fireRocket","blazeSpell","flameTornado","phoenixCry",
        "waterKnife","frostPunch","iceSpin","frostCrush",
        "waterBall","floodBeast","iceArrowRain",
        "stormFist","stormFlurry","windCrossSlash","dizzyFist",
        "windSpell","stormCircle","windHowlLightning","stormRain",
        "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush",
        "stoneThrow","sandWind","flyingSandStrike","dustStorm"
    ]);
    const PLAYER_DAMAGE_SKILL_ID_SET=new Set(PLAYER_DAMAGE_SKILL_IDS);
    const FIRE_MOMENTUM_BY_LEVEL=Object.freeze([12,15,18,21,25]);
    const BLOOD_BURN_HP_COST_BY_LEVEL=Object.freeze([20,25,30,35,40]);
    const BLOOD_BURN_BY_LEVEL=Object.freeze([20,25,30,35,50]);
    const HEAL_HP_BY_LEVEL=Object.freeze([550,580,610,640,670]);
    const HEAL_SP_PERCENT_BY_LEVEL=Object.freeze([0,0,5,10,15]);
    const FREEZE_CHANCE_BY_LEVEL=Object.freeze([55,65,75,85,95]);
    const FREEZE_DURATION_BY_LEVEL=Object.freeze([3,3,3,4,5]);
    const PURIFY_TARGET_COUNT_BY_LEVEL=Object.freeze([1,1,3]);
    const FINAL_POINT_DAMAGE_LEVELS=Object.freeze([5,7,9,11,13,15,17,19,22,25]);
    const DODGE_BY_LEVEL=Object.freeze([5,10,15,20,25]);
    const STEALTH_DURATION_BY_LEVEL=Object.freeze([2,3,4]);
    const CALM_RESIST_BY_LEVEL=Object.freeze([5,8,10,12,15]);
    const CALM_ACCURACY_BY_LEVEL=Object.freeze([5,10,15,20,25]);
    const ROCK_WALL_BY_LEVEL=Object.freeze([15,20,25,30,35]);
    const EARTH_SHIELD_BY_LEVEL=Object.freeze([20,40,60,80,100]);
    const EARTH_SHIELD_DURATION_BY_LEVEL=Object.freeze([3,3,3,3,4]);
    const EARTH_SHIELD_BLOCKS_BY_LEVEL=Object.freeze([2,2,2,2,3]);
    const BARRIER_DURATION_BY_LEVEL=Object.freeze([3,3,3,4,5]);
    const GROUP_ORDER=Object.freeze({physical:0,magic:1,tactical:2,ex:3});

    function numeric(value,fallback){
        const number=Number(value);
        return Number.isFinite(number)?number:(fallback===undefined?0:fallback);
    }
    window.v173GetInitialLearnCost=function(character,skill){
        const base=Math.max(0,Math.floor(numeric(skill&&skill.learnCost)));
        const cross=!!(character&&skill&&character.element&&skill.element&&character.element!==skill.element);
        return base*(cross?2:1);
    };
    function clampLevel(value,maxLevel){
        return Math.max(1,Math.min(Math.max(1,numeric(maxLevel,1)),Math.floor(numeric(value,1))));
    }
    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level,1))-1));
        return numeric(values[index]);
    }
    function notify(message){
        if(typeof alert==="function"){ alert(message); }
        return false;
    }
    function copyArray(value){ return Array.isArray(value)?value.slice():value; }
    function skillById(skillId){
        return typeof skillDatabase!=="undefined"&&skillDatabase?skillDatabase[skillId]:null;
    }
    function skillLabel(skillId){
        const skill=skillById(skillId);
        return skill&&skill.name?skill.name:String(skillId||"");
    }
    function sanitizeDescription(value){
        return String(value||"")
            .replace(/初次學習需\s*\d+\s*技能點[。；，,]?/g,"")
            .replace(/每升\s*1\s*級消耗\s*1\s*技能點[。；，,]?/g,"")
            .replace(/最高\s*5\s*級，\s*(?=傷害|效果|$)/g,"最高5級，")
            .replace(/\s{2,}/g," ")
            .trim();
    }

    const FINAL_PROGRESSION={
        flameSlash:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        fireCritical:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        explosiveFlurry:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        dragonSlash:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        fireRocket:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        blazeSpell:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        flameTornado:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        phoenixCry:{learnLevel:30,learnCost:16,progressionGroup:"magic"},
        rage:{learnLevel:18,learnCost:10,maxLevel:5,upgradeCost:1,progressionGroup:"tactical",
            targetType:"allyTri",spCost:50,duration:3,requires:["explosiveFlurry","flameTornado"]},
        fireSoulResonance:{
            id:"fireSoulResonance",name:"炎魂共鳴",element:"fire",category:"buff",targetType:"self",
            learnLevel:25,learnCost:14,maxLevel:5,spCost:45,duration:3,requires:["rage"],progressionGroup:"tactical",
            momentumBonusByLevel:FIRE_MOMENTUM_BY_LEVEL.slice(),maxExtensionRounds:3,maxExtensionsPerRound:1,icon:"炎",
            iconAssetPath:null,vfxAssetPath:null
        },
        bloodBurnArt:{
            id:"bloodBurnArt",name:"焚血訣",element:"fire",category:"buff",targetType:"self",
            learnLevel:35,learnCost:18,maxLevel:5,spCost:35,duration:3,requires:["fireSoulResonance"],progressionGroup:"tactical",
            hpCostPercentByLevel:BLOOD_BURN_HP_COST_BY_LEVEL.slice(),
            directDamageBonusByLevel:BLOOD_BURN_BY_LEVEL.slice(),fireActionCharges:4,icon:"血",
            iconAssetPath:null,vfxAssetPath:null
        },
        fireEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"},

        waterKnife:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        frostPunch:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        iceSpin:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        frostCrush:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        waterBall:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        floodBeast:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        iceArrowRain:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        healSpell:{
            learnLevel:15,learnCost:8,maxLevel:5,upgradeCost:1,requires:["frostPunch","floodBeast"],progressionGroup:"tactical",
            targetType:"allyTri",spCost:45,baseHeal:550,healPerLevel:30,
            healHpByLevel:HEAL_HP_BY_LEVEL.slice(),spRestorePercentByLevel:HEAL_SP_PERCENT_BY_LEVEL.slice(),cleanseAll:true
        },
        revive:{learnLevel:20,learnCost:10,maxLevel:5,upgradeCost:1,requires:["healSpell","frostCrush"],progressionGroup:"tactical"},
        freeze:{
            learnLevel:25,learnCost:14,maxLevel:5,upgradeCost:1,requires:["iceSpin","iceArrowRain"],progressionGroup:"tactical",
            targetType:"column",targetTypeAtMaxLevel:"tri",spCost:32,
            freezeChanceByLevel:FREEZE_CHANCE_BY_LEVEL.slice(),freezeDurationByLevel:FREEZE_DURATION_BY_LEVEL.slice()
        },
        purifyMind:{
            learnLevel:35,learnCost:18,maxLevel:3,upgradeCost:1,requires:["healSpell","frostCrush"],progressionGroup:"tactical",
            targetType:"ally",enemyTargetAllowed:true,spCost:22,removeAllStates:true,
            targetCountByLevel:PURIFY_TARGET_COUNT_BY_LEVEL.slice()
        },
        waterEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"},

        stormFist:{
            learnLevel:1,learnCost:2,progressionGroup:"physical",
            agilityDownByLevel:FINAL_POINT_DAMAGE_LEVELS.slice()
        },
        stormFlurry:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        windCrossSlash:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        dizzyFist:{
            learnLevel:30,learnCost:16,progressionGroup:"physical",
            missBonusByLevel:FINAL_POINT_DAMAGE_LEVELS.slice()
        },
        windSpell:{
            learnLevel:1,learnCost:2,progressionGroup:"magic",
            agilityDownByLevel:FINAL_POINT_DAMAGE_LEVELS.slice()
        },
        stormCircle:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        windHowlLightning:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        stormRain:{
            learnLevel:30,learnCost:16,progressionGroup:"magic",
            missBonusByLevel:FINAL_POINT_DAMAGE_LEVELS.slice()
        },
        dodgeSkill:{
            learnLevel:18,learnCost:10,maxLevel:5,progressionGroup:"tactical",
            evasionBonusPercentByLevel:DODGE_BY_LEVEL.slice()
        },
        stealthSkill:{
            learnLevel:25,learnCost:14,maxLevel:3,upgradeCost:1,progressionGroup:"tactical",
            targetType:"ally",spCost:45,durationByLevel:STEALTH_DURATION_BY_LEVEL.slice()
        },
        dinghaishenzhen:{
            learnLevel:35,learnCost:18,maxLevel:5,upgradeCost:1,progressionGroup:"tactical",
            targetType:"allyAll",spCost:77,duration:3,
            statusResistBonusByLevel:CALM_RESIST_BY_LEVEL.slice(),
            accuracyBonusPercentByLevel:CALM_ACCURACY_BY_LEVEL.slice()
        },
        windEX:{
            learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex",
            evasionBonusPercent:15,accuracyBonusPercent:15
        },

        stoneSlash:{learnLevel:1,learnCost:2,progressionGroup:"physical"},
        petrifyFist:{learnLevel:7,learnCost:6,progressionGroup:"physical"},
        stoneBreakSky:{learnLevel:14,learnCost:10,progressionGroup:"physical"},
        earthquakeCrush:{learnLevel:30,learnCost:16,progressionGroup:"physical"},
        stoneThrow:{learnLevel:1,learnCost:2,progressionGroup:"magic"},
        sandWind:{learnLevel:7,learnCost:6,progressionGroup:"magic"},
        flyingSandStrike:{learnLevel:14,learnCost:10,progressionGroup:"magic"},
        dustStorm:{learnLevel:30,learnCost:16,progressionGroup:"magic"},
        rockWall:{
            learnLevel:18,learnCost:10,maxLevel:5,upgradeCost:1,requires:["petrifyFist","sandWind"],progressionGroup:"tactical",
            targetType:"allyTri",spCost:45,duration:4,defenseBonusPercentByLevel:ROCK_WALL_BY_LEVEL.slice()
        },
        earthShield:{
            learnLevel:25,learnCost:14,maxLevel:5,upgradeCost:1,requires:["rockWall"],progressionGroup:"tactical",
            targetType:"self",spCost:45,reflectPercentByLevel:EARTH_SHIELD_BY_LEVEL.slice(),
            durationByLevel:EARTH_SHIELD_DURATION_BY_LEVEL.slice(),remainingBlocksByLevel:EARTH_SHIELD_BLOCKS_BY_LEVEL.slice()
        },
        barrier:{
            learnLevel:35,learnCost:18,maxLevel:5,upgradeCost:1,requires:["earthShield"],progressionGroup:"tactical",
            targetType:"ally",spCost:40,
            durationByLevel:BARRIER_DURATION_BY_LEVEL.slice()
        },
        earthEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"}
    };

    /* This is the only final-value table.  Historical V140/V149/V169 modules may
       provide compatibility helpers, but must not become a second balance source. */
    const FINAL_REBALANCE_DATA=Object.freeze({
        flameSlash:{baseDamage:30,damagePerLevel:6,spCost:10,targetType:"single",requires:[],followUpOnCriticalOrDefeat:true,followUpMaxCasts:1},
        fireCritical:{baseDamage:45,damagePerLevel:9,spCost:28,targetType:"single",requires:["flameSlash"],followUpOnCriticalOrDefeat:true,followUpMaxCasts:1},
        explosiveFlurry:{baseDamage:50,damagePerLevel:10,spCost:47,targetType:"tri",requires:["fireCritical"],followUpOnCriticalOrDefeat:true,followUpMaxCasts:1},
        dragonSlash:{baseDamage:165,damagePerLevel:33,spCost:65,targetType:"single",requires:["explosiveFlurry"],followUpOnCriticalOrDefeat:true,followUpMaxCasts:2},
        fireRocket:{baseDamage:13,damagePerLevel:4,spCost:10,targetType:"tri",requires:[],
            burnChance:40,burnDuration:2,burnPercentByLevel:[2,2,2,2,3,3,3,3,3,4]},
        blazeSpell:{baseDamage:45,damagePerLevel:9,spCost:28,targetType:"single",requires:["fireRocket"],
            burnChance:45,burnDuration:2,burnPercentByLevel:[3,3,3,3,4,4,4,4,4,6]},
        flameTornado:{baseDamage:150,damagePerLevel:30,spCost:47,targetType:"single",requires:["blazeSpell"],
            burnChance:60,guaranteedBurn:false,burnDuration:2,burnPercentByLevel:[4,4,4,4,5,5,5,5,5,7]},
        phoenixCry:{baseDamage:28,damagePerLevel:6,spCost:60,targetType:"all",requires:["flameTornado"],
            burnChance:50,burnDuration:2,burnPercentByLevel:[5,5,5,5,7,7,7,7,7,9],
            burnBonusThreshold:3,nextRoundDamageBonusPercent:30,nextRoundDamageBonusDuration:1},
        waterKnife:{baseDamage:21,damagePerLevel:5,spCost:6,targetType:"single",requires:[],frostbiteChance:50,frostbiteDuration:3,lifestealPercentByLevel:[4,4,4,4,7,7,7,7,7,10],spStealPercentByLevel:[4,4,4,4,7,7,7,7,7,10]},
        frostPunch:{baseDamage:32,damagePerLevel:7,spCost:17,targetType:"single",requires:["waterKnife"],frostbiteChance:40,frostbiteDuration:2,lifestealPercentByLevel:[5,5,5,5,6,6,6,6,6,7]},
        iceSpin:{baseDamage:35,damagePerLevel:7,spCost:45,targetType:"tri",requires:["frostPunch"],frostbiteChance:35,frostbiteDuration:2,lifestealPercentByLevel:[6,6,6,6,7,7,7,7,7,8]},
        frostCrush:{baseDamage:116,damagePerLevel:24,spCost:60,targetType:"single",requires:["iceSpin"],frostbiteChance:45,frostbiteDuration:2,lifestealPercentByLevel:[5,5,5,5,6,6,6,6,8,9]},
        waterBall:{baseDamage:10,damagePerLevel:2,spCost:8,targetType:"tri",requires:[],frostbiteChance:50,frostbiteDuration:2,lifestealPercentByLevel:[3,3,3,3,4,4,4,4,4,6]},
        floodBeast:{baseDamage:105,damagePerLevel:21,spCost:35,targetType:"single",requires:["waterBall"],frostbiteChance:40,frostbiteDuration:2,lifestealPercentByLevel:[6,6,6,6,7,7,7,7,7,9],spStealPercentByLevel:[4,4,4,4,7,7,7,7,7,9]},
        iceArrowRain:{baseDamage:30,damagePerLevel:6,spCost:75,targetType:"all",requires:["floodBeast"],frostbiteChance:35,frostbiteDuration:2,lifestealPercentByLevel:[4,4,4,4,5,5,5,5,5,6]},
        stormFist:{baseDamage:26,damagePerLevel:6,spCost:7,targetType:"single",requires:[],agilityDownChance:50,agilityDownDuration:1,agilityDownByLevel:[10,15,20,25,30,30,35,35,40,45]},
        stormFlurry:{baseDamage:13,damagePerLevel:3,spCost:20,targetType:"tri",requires:["stormFist"],damageDownChance:50,damageDownDuration:2,damageDownByLevel:[10,15,20,25,30,35,40,45,50,55]},
        windCrossSlash:{baseDamage:128,damagePerLevel:26,spCost:39,targetType:"single",requires:["stormFlurry"],damageDownChance:65,damageDownDuration:1,damageDownByLevel:[20,20,20,20,30,30,30,30,40,50]},
        dizzyFist:{baseDamage:141,damagePerLevel:29,spCost:55,targetType:"single",requires:["stormFlurry"],stunChance:65,stunDuration:5,missBonusByLevel:FINAL_POINT_DAMAGE_LEVELS.slice()},
        windSpell:{baseDamage:12,damagePerLevel:3,spCost:9,targetType:"tri",requires:[],agilityDownChance:50,agilityDownDuration:1,agilityDownByLevel:[10,15,20,25,30,30,35,35,40,45]},
        stormCircle:{baseDamage:14,damagePerLevel:4,spCost:18,targetType:"tri",requires:["windSpell"],damageDownChance:55,damageDownDuration:1,damageDownByLevel:[10,15,25,30,40,40,40,40,40,50]},
        windHowlLightning:{baseDamage:128,damagePerLevel:26,spCost:55,targetType:"single",requires:["stormCircle"],damageDownChance:65,damageDownDuration:1,damageDownByLevel:[10,15,25,30,40,50,50,50,55,60]},
        stormRain:{baseDamage:24,damagePerLevel:5,spCost:75,targetType:"all",requires:["windHowlLightning"],stunChance:35,stunDuration:1,missBonusByLevel:FINAL_POINT_DAMAGE_LEVELS.slice()},
        stoneSlash:{baseDamage:26,damagePerLevel:6,spCost:7,targetType:"single",requires:[],defenseDownChance:75,defenseDownDuration:1,defenseDownByLevel:[10,20,25,30,40,40,45,55,65,70]},
        petrifyFist:{baseDamage:13,damagePerLevel:3,spCost:26,targetType:"tri",requires:["stoneSlash"],selfShieldByLevel:[100,125,150,175,200,300,400,500,600,750]},
        stoneBreakSky:{baseDamage:128,damagePerLevel:26,spCost:42,targetType:"single",requires:["petrifyFist"],selfShieldByLevel:[100,125,150,175,200,250,300,350,400,500]},
        earthquakeCrush:{baseDamage:47,damagePerLevel:9,spCost:55,targetType:"tri",requires:["stoneBreakSky"],petrifyChanceByLevel:[30,33,36,39,45,48,51,54,57,65],petrifyDuration:2,selfShieldByLevel:null},
        stoneThrow:{baseDamage:12,damagePerLevel:3,spCost:7,targetType:"tri",requires:[],defenseDownChance:75,defenseDownDuration:1,defenseDownByLevel:[10,20,25,30,40,40,45,55,65,70]},
        sandWind:{baseDamage:14,damagePerLevel:4,spCost:19,targetType:"tri",requires:["stoneThrow"],defenseDownChance:65,defenseDownDuration:1,defenseDownByLevel:[15,20,25,30,30,40,50,55,55,60]},
        flyingSandStrike:{baseDamage:24,damagePerLevel:5,spCost:55,targetType:"all",requires:["sandWind"],defenseDownChance:60,defenseDownDuration:2,defenseDownByLevel:[10,15,20,25,35,35,35,35,35,35]},
        dustStorm:{baseDamage:140,damagePerLevel:28,spCost:65,targetType:"single",requires:["flyingSandStrike"],petrifyChanceByLevel:[15,20,25,30,35,40,45,50,55,60],petrifyDuration:2},
        rage:{critChanceBonusByLevel:[10,15,20,25,30],critDamageBonusByLevel:[15,25,35,45,55],critBonusByLevel:[10,15,20,25,30]},
        fireSoulResonance:{momentumBonusByLevel:[12,15,18,21,25]},
        fireEX:{damageBonusPercent:10,critChanceBonusPercent:5,critDamageBonusPercent:25,statusTargetDamageBonusPercent:5},
        waterEX:{lifestealMultiplier:1.2,spDrainMultiplier:1.2,healBonusPercent:15,turnStartCleanseChance:35,statusResistBonus:null},
        windEX:{evasionBonusPercent:15,accuracyBonusPercent:15,lowHpFinalHitCapPercent:50},
        earthEX:{defenseBonusPercent:35,maxHpMultiplier:1.2}
    });

    function extendLevelArrayToTen(values){
        if(!Array.isArray(values)||!values.length){ return values; }
        const result=values.slice(0,10);
        while(result.length<10){ result.push(result[result.length-1]); }
        return result;
    }

    function escapeText(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function targetLabel(skill,level){
        if(!skill){ return "—"; }
        if(skill.id==="freeze"){
            return level>=5?"敵方中、左、右最多3名":"同一直列前、後最多2名敵人";
        }
        if(skill.id==="purifyMind"){
            return level>=3?"我方或敵方中、左、右最多3名":"我方或敵方1名";
        }
        const labels={
            single:"敵方1名",tri:"同排中、左、右最多3名",row:"敵方同排",
            column:"同一直列前、後最多2名",all:"敵方全體",
            self:"自己",ally:"我方1名",allyTri:"我方中、左、右最多3名",
            allyAll:"我方全體",deadAlly:"死亡友方1名",none:"被動"
        };
        return labels[skill.targetType]||"技能目標";
    }

    function skillDamageValue(skill,level){
        if(!PLAYER_DAMAGE_SKILL_ID_SET.has(skill&&skill.id)){ return null; }
        return typeof getSkillDamageAtLevel==="function"
            ?getSkillDamageAtLevel(skill,level)
            :null;
    }

    function damageStatusParts(skill,level){
        const parts=[];
        const lv=clampLevel(level,skill&&skill.maxLevel||1);
        if(numeric(skill&&skill.burnChance)>0&&Array.isArray(skill.burnPercentByLevel)){
            const burnLead=skill.guaranteedBurn===true
                ?"燃燒：必定生效"
                :"燃燒："+numeric(skill.burnChance)+"%基礎機率";
            parts.push(burnLead+"，"+
                levelValue(skill.burnPercentByLevel,lv,0)+"%最大HP／回合，"+
                Math.max(1,numeric(skill.burnDuration)||1)+"回合");
        }
        if(numeric(skill&&skill.frostbiteChance)>0){
            parts.push("凍傷："+numeric(skill.frostbiteChance)+"%基礎機率，"+
                Math.max(1,numeric(skill.frostbiteDuration)||1)+
                "回合；期間傷害-30%、最終閃躲-25%、最終異常狀態抗性-25%");
        }
        if(Array.isArray(skill&&skill.lifestealPercentByLevel)){
            parts.push("吸血："+levelValue(skill.lifestealPercentByLevel,lv,0)+"%實際傷害回復自身HP");
        }
        if(Array.isArray(skill&&skill.defenseDownByLevel)){
            parts.push("破防："+numeric(skill.defenseDownChance)+"%基礎機率，防禦-"+
                levelValue(skill.defenseDownByLevel,lv,0)+"%，"+
                Math.max(1,numeric(skill.defenseDownDuration)||1)+"回合");
        }
        if(Array.isArray(skill&&skill.damageDownByLevel)){
            parts.push("殤風："+numeric(skill.damageDownChance)+"%基礎機率，傷害-"+
                levelValue(skill.damageDownByLevel,lv,0)+"%，"+
                Math.max(1,numeric(skill.damageDownDuration)||1)+"回合");
        }
        if(Array.isArray(skill&&skill.agilityDownByLevel)){
            const value=levelValue(skill.agilityDownByLevel,lv,0);
            parts.push("重力："+numeric(skill.agilityDownChance)+"%基礎機率，敏捷-"+
                value+"%、最終閃躲-"+value+"%，"+
                Math.max(1,numeric(skill.agilityDownDuration)||1)+"回合");
        }
        if(Array.isArray(skill&&skill.missBonusByLevel)){
            parts.push("暈眩："+numeric(skill.stunChance)+"%基礎機率，最終命中率-"+
                levelValue(skill.missBonusByLevel,lv,0)+"%，"+
                Math.max(1,numeric(skill.stunDuration)||1)+"回合");
        }
        if(Array.isArray(skill&&skill.petrifyChanceByLevel)){
            parts.push("石化："+levelValue(skill.petrifyChanceByLevel,lv,0)+"%基礎機率，"+
                Math.max(1,numeric(skill.petrifyDuration)||1)+"回合");
        }
        if(Array.isArray(skill&&skill.selfShieldByLevel)){
            parts.push("自身護盾："+levelValue(skill.selfShieldByLevel,lv,0)+"，"+
                Math.max(1,numeric(skill.shieldDuration)||1)+"回合");
        }
        if(Array.isArray(skill&&skill.allyShieldByLevel)){
            parts.push("我方護盾："+levelValue(skill.allyShieldByLevel,lv,0)+"，"+
                Math.max(1,numeric(skill.shieldDuration)||1)+"回合");
        }
        if(skill&&skill.followUpOnCriticalOrDefeat){
            const maxCasts=Math.max(1,Math.floor(numeric(skill.followUpMaxCasts,1)));
            parts.push("追擊：爆擊或擊敗目標時免費再施放，最多額外"+
                maxCasts+"次；免費追擊不消耗SP");
        }
        if(skill&&skill.id==="phoenixCry"){
            parts.push("鳳威：本次實際新增燃燒少於"+
                Math.max(1,Math.floor(numeric(skill.burnBonusThreshold,3)))+
                "名時，施法者獲得"+
                Math.max(1,Math.floor(numeric(skill.nextRoundDamageBonusDuration,1)))+
                "回合鳳威，所有傷害+"+
                Math.max(0,numeric(skill.nextRoundDamageBonusPercent,30))+"%");
        }
        return parts;
    }

    function supportEffectText(skill,level){
        if(!skill){ return ""; }
        const lv=clampLevel(level,skill.maxLevel||1);
        if(skill.id==="fireSoulResonance"){
            return "炎魂共鳴使直接攻擊技能傷害+"+levelValue(skill.momentumBonusByLevel,lv,0)+
                "%，基礎3回合"+(lv>=5?"；爆擊或成功新增燃燒時每回合最多延長1回合、整次最多+3回合":"");
        }
        if(skill.id==="bloodBurnArt"){
            return "消耗最大HP "+levelValue(skill.hpCostPercentByLevel,lv,0)+
                "%；接下來4次成功施放的直接攻擊技能傷害+"+
                levelValue(skill.directDamageBonusByLevel,lv,0)+
                "%；不強化DoT；免費追擊沿用本次加成但不額外消耗次數";
        }
        if(skill.id==="healSpell"){
            return "恢復"+levelValue(skill.healHpByLevel,lv,0)+" HP，並恢復目標最大SP的"+
                levelValue(skill.spRestorePercentByLevel,lv,0)+
                "%；解除所有可解除負面狀態；施放者不恢復自身SP";
        }
        if(skill.id==="revive"){
            return "復活1名死亡友方並恢復最大HP的"+
                levelValue(skill.reviveHealPercentByLevel,lv,0)+"%；不恢復SP";
        }
        if(skill.id==="freeze"){
            return levelValue(skill.freezeChanceByLevel,lv,0)+"%基礎機率冰封，持續"+
                levelValue(skill.freezeDurationByLevel,lv,0)+"回合；完全無法行動，受硬控命中上限與冰封／石化互斥限制";
        }
        if(skill.id==="purifyMind"){
            return "立即清除所有可解除的臨時Buff、Debuff、Shield、Barrier與異常狀態；"+
                "不清除永久被動、EX、裝備效果、Boss固有機制、HP／SP或死亡狀態";
        }
        if(skill.id==="dodgeSkill"){
            return "最終閃躲+"+levelValue(skill.evasionBonusPercentByLevel,lv,0)+"%，持續3回合";
        }
        if(skill.id==="stealthSkill"){
            return "隱身"+levelValue(skill.durationByLevel,lv,2)+"回合；無法被單體技能選中，仍受範圍技能影響";
        }
        if(skill.id==="dinghaishenzhen"){
            return "最終異常狀態抗性+"+levelValue(skill.statusResistBonusByLevel,lv,0)+
                "%、最終命中率+"+levelValue(skill.accuracyBonusPercentByLevel,lv,0)+
                "%，持續3回合";
        }
        if(skill.id==="rockWall"){
            return "防禦+"+levelValue(skill.defenseBonusPercentByLevel,lv,0)+"%，持續4回合";
        }
        if(skill.id==="earthShield"){
            return "直接傷害減少並反射"+levelValue(skill.reflectPercentByLevel,lv,0)+"%，可觸發"+
                levelValue(skill.remainingBlocksByLevel,lv,2)+"次，持續"+
                levelValue(skill.durationByLevel,lv,3)+"回合；同名不可疊加或刷新";
        }
        if(skill.id==="barrier"){
            return "持續"+levelValue(skill.durationByLevel,lv,3)+"回合；免疫一般直接傷害、DoT與反傷，"+
                "但不免疫狀態、硬控或淨心訣";
        }
        if(skill.id==="fireEX"){
            return "火元素角色傷害 +"+numeric(skill.damageBonusPercent)+
                "%、爆擊率"+numeric(skill.critChanceBonusPercent)+
                "%、爆擊傷害"+numeric(skill.critDamageBonusPercent)+
                "%；對有異常狀態的目標傷害再+"+numeric(skill.statusTargetDamageBonusPercent)+"%";
        }
        if(skill.id==="waterEX"){
            return "吸血效果 +20%、吸 SP 效果 +20%、回復類技能HP恢復量 +"+numeric(skill.healBonusPercent)+
                "%；每回合開始前有"+numeric(skill.turnStartCleanseChance)+
                "%機率解除自身所有可解除負面狀態";
        }
        if(skill.id==="windEX"){
            return "最終閃躲 +"+numeric(skill.evasionBonusPercent)+"%，最終命中 +"+
                numeric(skill.accuracyBonusPercent)+"%；自身 HP 低於 25% 時，敵方對自己的最終命中率最高為 50%。";
        }
        if(skill.id==="earthEX"){
            return "永久提升防禦力"+numeric(skill.defenseBonusPercent)+"%、最大HP +"+
                Math.round((numeric(skill.maxHpMultiplier,1)-1)*100)+"%";
        }
        if(skill.id==="rage"&&Array.isArray(skill.critBonusByLevel)){
            const chance=levelValue(skill.critChanceBonusByLevel||skill.critBonusByLevel,lv,0);
            const damage=levelValue(skill.critDamageBonusByLevel||skill.critBonusByLevel,lv,0);
            return "爆擊率+"+chance+"%、爆擊傷害+"+damage+"%，持續"+
                Math.max(1,numeric(skill.duration)||1)+"回合";
        }
        return String(skill.description||"");
    }

    function effectText(skill,level){
        if(!skill){ return ""; }
        const damage=skillDamageValue(skill,level);
        const parts=[];
        if(damage!==null){ parts.push("傷害 "+damage); }
        if(skill.id==="freeze"||skill.category==="buff"||skill.category==="heal"||skill.category==="revive"){
            const support=supportEffectText(skill,level);
            if(support){ parts.push(support); }
        }else{
            parts.push(...damageStatusParts(skill,level));
        }
        if(skill.category==="passive"){
            const passive=supportEffectText(skill,level);
            if(passive){ parts.push(passive); }
        }
        return parts.filter(Boolean).join("｜");
    }

    function descriptionFor(skill){
        if(!skill){ return ""; }
        const max=Math.max(1,Math.floor(numeric(skill.maxLevel,1)));
        const firstTarget=targetLabel(skill,1);
        const finalTarget=targetLabel(skill,max);
        const parts=["範圍："+firstTarget];
        if(max>1&&finalTarget!==firstTarget){
            parts.push("滿級範圍："+finalTarget);
        }
        if(PLAYER_DAMAGE_SKILL_ID_SET.has(skill.id)){
            parts.push("Lv1傷害 "+skillDamageValue(skill,1));
            parts.push("Lv5突破 "+skillDamageValue(skill,5));
            parts.push("Lv10突破 "+skillDamageValue(skill,10));
            const extras=damageStatusParts(skill,Math.min(max,10));
            if(extras.length){ parts.push(extras.join("；")); }
        }else{
            parts.push(supportEffectText(skill,1));
            if(max>1){ parts.push("最高 Lv"+max); }
        }
        if(skill.spCost!==undefined){ parts.push("SP "+numeric(skill.spCost)); }
        return parts.filter(Boolean).join("。")+"。";
    }

    function levelBreakdownHtml(skill){
        if(!skill){ return ""; }
        const max=Math.max(1,Math.floor(numeric(skill.maxLevel,1)));
        return Array.from({length:max},(_,index)=>{
            const level=index+1;
            const breakthrough=PLAYER_DAMAGE_SKILL_ID_SET.has(skill.id)&&(level===5||level===10)
                ?"（突破×1.5）":"";
            return '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);">'+
                '<span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.'+level+'</span>'+
                '<span style="flex:1;">'+escapeText(effectText(skill,level)+breakthrough)+'</span></div>';
        }).join("");
    }

    function applyFinalProgressionData(){
        if(typeof skillDatabase==="undefined"||!skillDatabase){ return false; }
        /* Some older save-era bases never declared Purify in the initial table.
           Its canonical definition belongs here with the final progression data,
           rather than relying on the retired V169 data patch to create it. */
        if(!skillDatabase.purifyMind){
            skillDatabase.purifyMind={
                id:"purifyMind",name:"淨心訣",element:"water",category:"buff",targetType:"ally",
                description:"解除目標所有可解除的臨時 Buff、Debuff、Shield、Barrier 與異常狀態。"
            };
        }
        Object.entries(FINAL_PROGRESSION).forEach(([skillId,fields])=>{
            if(!skillDatabase[skillId]){
                if(skillId!=="fireSoulResonance"&&skillId!=="bloodBurnArt"){ return; }
                skillDatabase[skillId]={id:skillId};
            }
            const skill=skillDatabase[skillId];
            Object.entries(fields).forEach(([key,value])=>{ skill[key]=copyArray(value); });
            skill.id=skill.id||skillId;

            if(PLAYER_DAMAGE_SKILL_ID_SET.has(skillId)){
                skill.maxLevel=10;
                skill.upgradeCost=1;
                Object.keys(skill).forEach(key=>{
                    if(/ByLevel$/.test(key)&&Array.isArray(skill[key])){
                        skill[key]=extendLevelArrayToTen(skill[key]);
                    }
                });
            }

            if(numeric(skill.maxLevel,1)>1){
                skill.upgradeCost=1;
                skill.upgradeCostByTargetLevel=SKILL_UPGRADE_COST_BY_TARGET_LEVEL;
            }else{
                delete skill.upgradeCostByTargetLevel;
            }
            skill.description=sanitizeDescription(skill.description);
        });

        const heal=skillDatabase.healSpell;
        if(heal){
            heal.baseHeal=550; heal.healPerLevel=30;
            heal.healHpByLevel=HEAL_HP_BY_LEVEL.slice();
            heal.spRestorePercentByLevel=HEAL_SP_PERCENT_BY_LEVEL.slice();
            delete heal.baseHealSP; delete heal.healSPPerLevel;
            heal.description="我方中、左、右最多3名存活角色恢復550/580/610/640/670 HP，並依等級恢復目標最大SP的0%/0%/5%/10%/15%；解除所有可解除負面狀態。施放者可恢復自身HP，但不恢復自身SP。SP 45。";
        }
        const freeze=skillDatabase.freeze;
        if(freeze){
            freeze.freezeChanceByLevel=FREEZE_CHANCE_BY_LEVEL.slice();
            freeze.freezeDurationByLevel=FREEZE_DURATION_BY_LEVEL.slice();
            delete freeze.freezeChance; delete freeze.freezeDuration;
            delete freeze.baseDamage; delete freeze.damagePerLevel;
            freeze.description="Lv1～4攻擊同一直列前、後最多2名敵人；Lv5攻擊中、左、右最多3名敵人。基礎冰封機率55%/65%/75%/85%/95%，持續3/3/3/4/5回合；仍受正式硬控命中上限與冰封／石化互斥規則限制。SP 32。";
        }
        const purify=skillDatabase.purifyMind;
        if(purify){
            purify.targetCountByLevel=PURIFY_TARGET_COUNT_BY_LEVEL.slice();
            purify.description="Lv1～2選擇1名我方或敵方；Lv3選擇中、左、右最多3名目標。立即清除所有可解除的臨時Buff、Debuff、Shield、Barrier與異常狀態；不清除永久被動、EX、裝備、Boss固有機制、HP/SP或死亡狀態。SP 22。";
        }
        const dodge=skillDatabase.dodgeSkill;
        if(dodge){
            dodge.evasionBonusPercentByLevel=DODGE_BY_LEVEL.slice();
            dodge.targetType="allyTri"; dodge.duration=3; dodge.spCost=20;
            delete dodge.evasionBonusPercent;
            dodge.description="我方中、左、右最多3名存活角色最終閃躲提升5/10/15/20/25%，持續3回合。SP 20。";
        }
        const stealth=skillDatabase.stealthSkill;
        if(stealth){
            stealth.durationByLevel=STEALTH_DURATION_BY_LEVEL.slice();
            stealth.duration=2; stealth.targetType="ally"; stealth.spCost=45;
            stealth.description="我方1人隱身2/3/4回合；無法被單體技能選中，仍會受到範圍技能影響。SP 45。";
        }
        const calm=skillDatabase.dinghaishenzhen;
        if(calm){
            calm.statusResistBonusByLevel=CALM_RESIST_BY_LEVEL.slice();
            calm.accuracyBonusPercentByLevel=CALM_ACCURACY_BY_LEVEL.slice();
            calm.targetType="allyAll"; calm.duration=3; calm.spCost=77;
            delete calm.statusResistBonus; delete calm.accuracyBonusPercent;
            calm.description="我方全體最終異常狀態抗性提升5/8/10/12/15%、最終命中率提升5/10/15/20/25%，持續3回合。SP 77。";
        }
        const wall=skillDatabase.rockWall;
        if(wall){
            wall.defenseBonusPercentByLevel=ROCK_WALL_BY_LEVEL.slice();
            wall.targetType="allyTri"; wall.duration=4; wall.spCost=45; wall.requires=["petrifyFist","sandWind"];
            delete wall.defenseBonusPercent;
            wall.description="我方中、左、右最多3名存活角色防禦提升15%/20%/25%/30%/35%，持續4回合。SP 45。";
        }
        const shield=skillDatabase.earthShield;
        if(shield){
            shield.reflectPercentByLevel=EARTH_SHIELD_BY_LEVEL.slice();
            shield.durationByLevel=EARTH_SHIELD_DURATION_BY_LEVEL.slice();
            shield.remainingBlocksByLevel=EARTH_SHIELD_BLOCKS_BY_LEVEL.slice();
            shield.targetType="self"; shield.spCost=45; shield.requires=["rockWall"];
            delete shield.reflectPercent;
            shield.description="我方1人獲得萬象土盾；直接傷害減少並反射20%/40%/60%/80%/100%，可觸發2/2/2/2/3次，持續3/3/3/3/4回合。SP 45。";
        }
        const barrier=skillDatabase.barrier;
        if(barrier){
            barrier.durationByLevel=BARRIER_DURATION_BY_LEVEL.slice();
            barrier.targetType="ally"; barrier.spCost=40; barrier.requires=["earthShield"];
            delete barrier.barrierBlockCountByLevel; delete barrier.barrierBlockCount; delete barrier.duration;
            barrier.description="我方1人獲得結界，持續3/3/3/4/5回合；免疫一般直接傷害、DoT與反傷，但不免疫狀態、硬控或淨心訣。SP 40。";
        }
        Object.entries(FINAL_REBALANCE_DATA).forEach(([skillId,fields])=>{
            const skill=skillDatabase[skillId];
            if(!skill){ return; }
            Object.entries(fields).forEach(([key,value])=>{
                if(value===null){ delete skill[key]; }
                else{ skill[key]=copyArray(value); }
            });
        });
        /* The final Water Warrior data uses Frostbite, not the retired per-skill
           Freeze payloads that older modules attached to these attacks. */
        ["waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain"].forEach(skillId=>{
            const skill=skillDatabase[skillId];
            if(!skill){ return; }
            ["freezeChance","freezeDuration","freezeSingleTarget","teamFreezeChance","teamFreezeDuration"].forEach(field=>delete skill[field]);
        });
        if(skillDatabase.flyingSandStrike){ delete skillDatabase.flyingSandStrike.petrifyChanceByLevel; }
        if(skillDatabase.dustStorm){ delete skillDatabase.dustStorm.defenseDownChance; delete skillDatabase.dustStorm.defenseDownByLevel; }
        if(skillDatabase.earthShield){
            skillDatabase.earthShield.description="我方1人獲得萬象土盾；直接傷害減少並反射20%/40%/60%/80%/100%，每次成功抵擋消耗2/2/2/2/3次中的1次，持續3/3/3/3/4回合。DoT不觸發。SP 45。";
        }
        if(skillDatabase.barrier){
            skillDatabase.barrier.description="我方1人獲得結界，持續3/3/3/4/5回合；免疫一般直接傷害、DoT與反傷，但不免疫狀態、硬控或淨心訣。SP 40。";
        }
        Object.values(skillDatabase).forEach(skill=>{
            if(!skill||!skill.id){ return; }
            if(PLAYER_DAMAGE_SKILL_ID_SET.has(skill.id)||[
                "rage","fireSoulResonance","bloodBurnArt","healSpell","revive","freeze","purifyMind",
                "dodgeSkill","stealthSkill","dinghaishenzhen","rockWall","earthShield","barrier",
                "fireEX","waterEX","windEX","earthEX"
            ].includes(skill.id)){
                skill.description=descriptionFor(skill);
            }
        });
        return true;
    }

    function getRequiredCharacterLevelForSkillLevel(skill,targetSkillLevel){
        const learnLevel=Math.max(1,Math.floor(numeric(skill&&skill.learnLevel,1)));
        const target=Math.max(1,Math.floor(numeric(targetSkillLevel,1)));
        if(target<=1){ return learnLevel; }
        if(target===2){ return Math.max(learnLevel+8,15); }
        if(target===3){ return Math.max(learnLevel+18,30); }
        if(target===4){ return Math.max(learnLevel+30,50); }
        return Math.max(learnLevel+45,80);
    }
    function getUpgradeCostForTargetLevel(skill,targetSkillLevel){
        if(!skill||numeric(skill.maxLevel,1)<=1){ return 0; }
        return numeric(SKILL_UPGRADE_COST_BY_TARGET_LEVEL[Math.floor(numeric(targetSkillLevel))],0);
    }
    function getSkillContext(characterKey){
        const key=characterKey!==undefined&&characterKey!==null?characterKey:
            (typeof currentSkillCharacter!=="undefined"?currentSkillCharacter:null);
        const loadout=typeof characterSkillLoadouts!=="undefined"&&characterSkillLoadouts&&key!==null
            ?characterSkillLoadouts[key]:null;
        let character=null;
        if(typeof getSkillCharacterObject==="function"&&key!==null){ character=getSkillCharacterObject(key); }
        if(!character&&key!==null){
            if(key==="player2"&&typeof player2!=="undefined"){ character=player2; }
            else if(key==="player3"&&typeof player3!=="undefined"){ character=player3; }
            else if(typeof player!=="undefined"){ character=player; }
        }
        return {key,character,loadout};
    }
    function learnedLevel(context,skillId){
        return Math.max(0,Math.floor(numeric(context&&context.loadout&&context.loadout.skillLevels&&context.loadout.skillLevels[skillId])));
    }
    function isCrossElementSkill(character,skill){
        return !!(character&&skill&&character.element&&skill.element&&character.element!==skill.element);
    }
    function hasLearnedNativeSkill(context){
        const levels=context&&context.loadout&&context.loadout.skillLevels||{};
        return Object.keys(levels).some(id=>numeric(levels[id])>0&&skillById(id)&&skillById(id).element===context.character.element);
    }
    function crossLearnGate(context,skill){
        if(!isCrossElementSkill(context.character,skill)){ return {ok:true,cross:false}; }
        if(/EX$/.test(String(skill.id||""))||skill.category==="passive"){
            return {ok:false,cross:true,reason:"本命元素限定"};
        }
        if(!hasLearnedNativeSkill(context)){
            return {ok:false,cross:true,reason:"需先學會至少 1 招本命元素技能"};
        }
        return {ok:true,cross:true};
    }
    function initialLearnCost(context,skill){
        return Math.max(0,Math.floor(numeric(skill&&skill.learnCost)))*(isCrossElementSkill(context&&context.character,skill)?2:1);
    }
    function normalizeCrossElementEquip(loadout,character){
        if(!loadout||!character||!Array.isArray(loadout.equippedSkills)){ return false; }
        let seen=false,changed=false;
        loadout.equippedSkills=loadout.equippedSkills.filter(skillId=>{
            const skill=skillById(skillId);
            if(!skill||!isCrossElementSkill(character,skill)){ return true; }
            if(!seen){ seen=true; return true; }
            changed=true; return false;
        }).slice(0,4);
        return changed;
    }
    function normalizeAllCrossElementEquips(){
        if(typeof characterSkillLoadouts==="undefined"||!characterSkillLoadouts){ return false; }
        let changed=false;
        Object.keys(characterSkillLoadouts).forEach(key=>{
            const loadout=characterSkillLoadouts[key];
            const character=typeof getSkillCharacterObject==="function"?getSkillCharacterObject(key):null;
            if(normalizeCrossElementEquip(loadout,character)){ changed=true; }
        });
        return changed;
    }
    window.v173NormalizeCrossElementEquips=normalizeAllCrossElementEquips;
    function prerequisiteMet(levels,skill){
        const required=Array.isArray(skill&&skill.requires)?skill.requires.filter(Boolean):[];
        if(!required.length){ return true; }
        return required.some(skillId=>numeric(levels&&levels[skillId])>0);
    }
    function prerequisiteLabel(skill){
        const required=Array.isArray(skill&&skill.requires)?skill.requires.filter(Boolean):[];
        if(!required.length){ return "無"; }
        return required.map(skillLabel).join(" 或 ");
    }
    function finalizeSkillMutation(){
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
        if(typeof updateUI==="function"){ updateUI(); }
    }

    applyFinalProgressionData();
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){
        /* Re-project after every final data field is installed.  V169 loads
           before the role helper, so Water cannot rely on a historical call. */
        window.v173ApplyFormalDamageRoleProfiles(PLAYER_DAMAGE_SKILL_IDS);
    }

    if(typeof learnSkill==="function"){
        learnSkill=function(skillId){
            const skill=skillById(skillId);
            const context=getSkillContext();
            if(!skill||!context.character||!context.loadout){ return notify("目前無法取得角色技能資料。"); }
            context.loadout.skillLevels=context.loadout.skillLevels||{};
            if(learnedLevel(context,skillId)>0){ return true; }
            const characterLevel=Math.max(1,Math.floor(numeric(context.character.level,1)));
            const requiredLevel=getRequiredCharacterLevelForSkillLevel(skill,1);
            const levels=context.loadout.skillLevels;
            const cross=crossLearnGate(context,skill);
            const prereqOk=cross.cross?true:prerequisiteMet(levels,skill);
            if(characterLevel<requiredLevel){
                return notify(prereqOk
                    ?("角色 Lv"+requiredLevel+" 才能學習「"+skill.name+"」。")
                    :("需要 Lv"+requiredLevel+"・前置："+prerequisiteLabel(skill)));
            }
            if(!cross.ok){ return notify(cross.reason); }
            if(!prereqOk){ return notify("需要前置："+prerequisiteLabel(skill)); }
            const learnCost=initialLearnCost(context,skill);
            const points=Math.max(0,Math.floor(numeric(context.character.skillPoints)));
            if(points<learnCost){ return notify("技能點不足，需要"+learnCost+"點。"); }
            context.character.skillPoints=points-learnCost;
            context.loadout.skillLevels[skillId]=1;
            finalizeSkillMutation();
            return true;
        };
    }

    if(typeof upgradeSkill==="function"){
        upgradeSkill=function(skillId){
            const skill=skillById(skillId);
            const context=getSkillContext();
            if(!skill||!context.character||!context.loadout){ return notify("目前無法取得角色技能資料。"); }
            context.loadout.skillLevels=context.loadout.skillLevels||{};
            const current=learnedLevel(context,skillId);
            const maxLevel=Math.max(1,Math.floor(numeric(skill.maxLevel,1)));
            if(current<=0){ return notify("請先學會「"+skill.name+"」。"); }
            if(current>=maxLevel){ return notify("「"+skill.name+"」已達最高技能等級。"); }
            const target=current+1;
            const requiredLevel=getRequiredCharacterLevelForSkillLevel(skill,target);
            const characterLevel=Math.max(1,Math.floor(numeric(context.character.level,1)));
            if(characterLevel<requiredLevel){
                return notify("角色 Lv"+requiredLevel+" 可升至技能 Lv"+target+"。");
            }
            const cost=getUpgradeCostForTargetLevel(skill,target);
            const points=Math.max(0,Math.floor(numeric(context.character.skillPoints)));
            if(points<cost){ return notify("技能點不足，升至技能 Lv"+target+"需要"+cost+"點。"); }
            context.character.skillPoints=points-cost;
            context.loadout.skillLevels[skillId]=target;
            finalizeSkillMutation();
            return true;
        };
    }

    if(typeof equipSkill==="function"){
        equipSkill=function(skillId){
            const skill=skillById(skillId),context=getSkillContext();
            if(!skill||!context.character||!context.loadout||learnedLevel(context,skillId)<=0){ return false; }
            normalizeCrossElementEquip(context.loadout,context.character);
            const equipped=context.loadout.equippedSkills=context.loadout.equippedSkills||[];
            if(equipped.includes(skillId)){ return true; }
            if(isCrossElementSkill(context.character,skill)&&equipped.some(id=>{
                const equippedSkill=skillById(id); return equippedSkill&&isCrossElementSkill(context.character,equippedSkill);
            })){ return notify("每名角色最多攜帶 1 招跨元素技能。"); }
            if(equipped.length>=4){ return notify("每個角色最多只能攜帶4個技能。"); }
            equipped.push(skillId);
            if(typeof populateAutoSkillOptions==="function"){ populateAutoSkillOptions(); }
            if(typeof populateAutoSkillOptions2==="function"){ populateAutoSkillOptions2(); }
            finalizeSkillMutation();
            return true;
        };
    }

    function actionCardForRow(row){
        const cards=Array.from(row&&row.querySelectorAll?row.querySelectorAll(".skill-action-card"):[]);
        return cards.find(card=>{
            const onclick=String(card.getAttribute&&card.getAttribute("onclick")||"");
            const label=card.querySelector&&card.querySelector(".skill-action-card-label");
            const text=String(label&&label.textContent||"");
            return /learnSkill|upgradeSkill/.test(onclick)||/學習|升級|技能點|滿級/.test(text);
        })||cards[0]||null;
    }
    function setActionCard(card,enabled,label,onclick){
        if(!card){ return; }
        const target=card.querySelector(".skill-action-card-label");
        if(target){ target.textContent=label; }
        card.classList.toggle("disabled",!enabled);
        card.setAttribute("aria-disabled",enabled?"false":"true");
        if(enabled&&onclick){ card.setAttribute("onclick",onclick); }
        else{ card.removeAttribute("onclick"); }
    }
    function rowSkillId(row){
        const icon=row&&row.querySelector?row.querySelector("[id^='skillIcon_']"):null;
        return icon?icon.id.slice("skillIcon_".length):"";
    }
    function decorateSkillProgressionUi(){
        if(typeof document==="undefined"){ return; }
        const list=document.getElementById("allSkillsList");
        const context=getSkillContext();
        if(!list||!context.character||!context.loadout){ return; }
        context.loadout.skillLevels=context.loadout.skillLevels||{};
        const rows=Array.from(list.querySelectorAll(".skill-row"));
        rows.forEach(row=>{
            const skillId=rowSkillId(row);
            if(skillId==="stormSpell"){
                row.remove();
                return;
            }
            const skill=skillById(skillId);
            if(!skill||!Object.prototype.hasOwnProperty.call(skill,"learnLevel")){ return; }
            const current=learnedLevel(context,skillId);
            const level=Math.max(1,Math.floor(numeric(context.character.level,1)));
            const points=Math.max(0,Math.floor(numeric(context.character.skillPoints)));
            const card=actionCardForRow(row);
            const levels=context.loadout.skillLevels;
            const cross=crossLearnGate(context,skill);
            if(current<=0){
                const prereqOk=cross.cross?true:prerequisiteMet(levels,skill);
                const levelOk=level>=skill.learnLevel;
                const cost=initialLearnCost(context,skill);
                const costOk=points>=cost;
                if(levelOk&&cross.ok&&prereqOk&&costOk){
                    setActionCard(card,true,(cross.cross?"跨修學習・":"學習・")+cost+"點","learnSkill('"+skillId+"')");
                }else{
                    const reasons=[];
                    if(!levelOk){ reasons.push("Lv"+skill.learnLevel+" 解鎖"); }
                    if(!cross.ok){ reasons.push(cross.reason); }
                    if(!cross.cross&&!prereqOk){ reasons.push("前置："+prerequisiteLabel(skill)); }
                    if(levelOk&&cross.ok&&prereqOk&&!costOk){ reasons.push("需要 "+cost+" 技能點"); }
                    setActionCard(card,false,reasons.join("・"),"");
                }
            }else if(current<numeric(skill.maxLevel,1)){
                const target=current+1;
                const required=getRequiredCharacterLevelForSkillLevel(skill,target);
                const cost=getUpgradeCostForTargetLevel(skill,target);
                if(level<required){
                    setActionCard(card,false,"角色 Lv"+required+" 可升至技能 Lv"+target,"");
                }else if(points<cost){
                    setActionCard(card,false,"升至 Lv"+target+" 需要 "+cost+" 技能點","");
                }else{
                    setActionCard(card,true,"升至 Lv"+target+"・"+cost+"點","upgradeSkill('"+skillId+"')");
                }
            }
        });
        const sorted=Array.from(list.querySelectorAll(".skill-row")).sort((left,right)=>{
            const a=skillById(rowSkillId(left))||{};
            const b=skillById(rowSkillId(right))||{};
            const ga=numeric(GROUP_ORDER[a.progressionGroup],9),gb=numeric(GROUP_ORDER[b.progressionGroup],9);
            if(ga!==gb){ return ga-gb; }
            const la=numeric(a.learnLevel,999),lb=numeric(b.learnLevel,999);
            if(la!==lb){ return la-lb; }
            return String(a.name||a.id||"").localeCompare(String(b.name||b.id||""),"zh-Hant");
        });
        sorted.forEach(row=>list.appendChild(row));
    }

    if(typeof getSkillEffectPreviewText==="function"){
        getSkillEffectPreviewText=function(skill,level){
            return effectText(skill,level);
        };
    }
    if(typeof buildSkillLevelBreakdownHTML==="function"){
        buildSkillLevelBreakdownHTML=function(skill){
            return levelBreakdownHtml(skill);
        };
    }
    if(typeof window.getSkillPreviewSummary==="function"){
        window.getSkillPreviewSummary=function(skill){
            return descriptionFor(skill);
        };
    }

    if(typeof renderSkillLoadout==="function"){
        const previousRenderSkillLoadout=renderSkillLoadout;
        renderSkillLoadout=function(){
            const context=getSkillContext();
            if(context.loadout&&context.character){ normalizeCrossElementEquip(context.loadout,context.character); }
            const result=previousRenderSkillLoadout.apply(this,arguments);
            decorateSkillProgressionUi();
            return result;
        };
    }

    function renderSkillDetailProgression(skillId){
        if(typeof document==="undefined"){ return; }
        const skill=skillById(skillId);
        if(!skill||!Object.prototype.hasOwnProperty.call(skill,"learnLevel")){ return; }
        const host=document.getElementById("skillDetailStats");
        const context=getSkillContext();
        if(!host||!context.loadout){ return; }
        const old=host.querySelector(".v17364-progression-detail");
        if(old){ old.remove(); }
        const current=learnedLevel(context,skillId);
        const next=current>0&&current<numeric(skill.maxLevel,1)?current+1:null;
        const block=document.createElement("div");
        block.className="v17364-progression-detail";
        let upgradeText="—";
        if(numeric(skill.maxLevel,1)>1){
            upgradeText=next
                ?getUpgradeCostForTargetLevel(skill,next)+" 技能點"
                :"每次升級固定 1 技能點";
        }
        const rows=[
            ["最低學習等級","Lv"+skill.learnLevel],
            ["目前技能等級",current>0?"Lv"+current:"尚未學習"],
            ["下一級角色需求",next?"角色 Lv"+getRequiredCharacterLevelForSkillLevel(skill,next):"—"],
            ["技能元素",skill.element||"—"],
            ["學習成本",initialLearnCost(context,skill)+" 技能點"+(isCrossElementSkill(context.character,skill)?"（跨修）":"")],
            ["升級成本",upgradeText],
            ["前置技能",isCrossElementSkill(context.character,skill)?"跨修免前置":prerequisiteLabel(skill)]
        ];
        rows.forEach(([label,value])=>{
            const row=document.createElement("div");
            const strong=document.createElement("strong");
            const span=document.createElement("span");
            strong.textContent=label;
            span.textContent=value;
            row.appendChild(strong);row.appendChild(span);block.appendChild(row);
        });
        host.appendChild(block);
    }

    if(typeof showSkillDetail==="function"){
        const previousShowSkillDetail=showSkillDetail;
        showSkillDetail=function(skillId){
            const result=previousShowSkillDetail.apply(this,arguments);
            renderSkillDetailProgression(skillId);
            return result;
        };
    }

    function actorByPartyIndex(index){
        if(typeof getPartyCharacterByIndex==="function"){ return getPartyCharacterByIndex(index); }
        if(index===1&&typeof player2!=="undefined"){ return player2; }
        if(index===2&&typeof player3!=="undefined"){ return player3; }
        return typeof player!=="undefined"?player:null;
    }
    function keyByPartyIndex(index,actor){
        if(typeof getPartyCharacterKey==="function"){
            const key=getPartyCharacterKey(index);
            if(key!==undefined&&key!==null){ return key; }
        }
        if(typeof getCharacterSkillKey==="function"&&actor){
            const key=getCharacterSkillKey(actor);
            if(key!==undefined&&key!==null){ return key; }
        }
        if(index===1){ return "player2"; }
        if(index===2){ return "player3"; }
        return actor&&actor.element?actor.element:(typeof currentSkillCharacter!=="undefined"?currentSkillCharacter:null);
    }
    function partySkillLevel(index,skillId){
        const actor=actorByPartyIndex(index);
        const context=getSkillContext(keyByPartyIndex(index,actor));
        return learnedLevel(context,skillId);
    }
    function activeBuff(actor,type){
        return actor&&Array.isArray(actor.activeBuffs)
            ?actor.activeBuffs.find(buff=>buff&&buff.type===type&&numeric(buff.turnsLeft,1)>0)||null:null;
    }
    function removeBuff(actor,buff){
        if(!actor||!buff||!Array.isArray(actor.activeBuffs)){ return; }
        actor.activeBuffs=actor.activeBuffs.filter(entry=>entry!==buff);
    }
    function canAddNamedBuff(actor,type,index,label){
        if(activeBuff(actor,type)){ return false; }
        if(typeof window.v173CanApplyNamedPersistentState==="function"){
            return window.v173CanApplyNamedPersistentState(actor,type,"player",index,label)!==false;
        }
        return true;
    }
    function addNamedBuff(actor,type,index,label,turns,extra){
        if(!canAddNamedBuff(actor,type,index,label)){ return null; }
        actor.activeBuffs=Array.isArray(actor.activeBuffs)?actor.activeBuffs:[];
        const buff=Object.assign({type,turnsLeft:Math.max(1,Math.floor(numeric(turns,1)))},extra||{});
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(buff,type);
        }
        actor.activeBuffs.push(buff);
        return buff;
    }
    function actorMaxHp(actor,index){
        let max=numeric(actor&&actor.maxHP);
        if(max<=0&&typeof getPartyBattleStats==="function"){
            const stats=getPartyBattleStats(index);
            max=numeric(stats&&(stats.maxHP||stats.maxHp||stats.hpMax));
        }
        if(max<=0){ max=Math.max(1,numeric(actor&&actor.hp,1)); }
        return Math.max(1,max);
    }
    function announceSkill(actorIndex,skill){
        if(typeof showSkillNameBadge==="function"){
            showSkillNameBadge(skill.name,skill.element||"fire",actorIndex,actorIndex,[actorIndex],"player","self");
        }
        if(typeof addBattleLog==="function"){ addBattleLog((actorByPartyIndex(actorIndex)?.id||"角色")+"施放「"+skill.name+"」。"); }
    }
    function finishTacticalAction(){
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
    }
    function castNewFireTactical(actorIndex,skillId){
        const actor=actorByPartyIndex(actorIndex);
        const skill=skillById(skillId);
        const level=partySkillLevel(actorIndex,skillId);
        if(!actor||!skill||level<=0){ return notify("尚未學會「"+(skill&&skill.name||skillId)+"」。"); }
        const cost=Math.max(0,numeric(skill.spCost));
        if(numeric(actor.sp)<cost){ return notify("SP不足，需要"+cost+"點。"); }
        if(skillId==="fireSoulResonance"){
            if(!canAddNamedBuff(actor,"fireSoulResonance",actorIndex,"炎魂共鳴")){
                return notify("炎魂共鳴仍在持續中，無法重複施放或刷新。");
            }
            actor.sp=numeric(actor.sp)-cost;
            const resolvedLevel=clampLevel(level,5);
            const resonance=addNamedBuff(actor,"fireSoulResonance",actorIndex,"炎魂共鳴",3,{
                skillLevel:resolvedLevel,extensionCount:0,lastExtendedRound:null
            });
            if(resonance){
                addNamedBuff(actor,"fireMomentum",actorIndex,"炎勢",3,{
                    skillLevel:resolvedLevel,
                    bonusPercent:FIRE_MOMENTUM_BY_LEVEL[resolvedLevel-1],
                    resonanceLinked:true
                });
            }
            announceSkill(actorIndex,skill);finishTacticalAction();return true;
        }
        if(skillId==="bloodBurnArt"){
            if(activeBuff(actor,"bloodBurn")){
                return notify("焚血尚未消耗，無法重複施放或刷新。");
            }
            const maxHp=actorMaxHp(actor,actorIndex);
            if(!canAddNamedBuff(actor,"bloodBurn",actorIndex,"焚血")){
                return notify("焚血尚未消耗，無法重複施放或刷新。");
            }
            const resolvedLevel=clampLevel(level,5);
            const hpCost=Math.max(1,Math.round(maxHp*(BLOOD_BURN_HP_COST_BY_LEVEL[resolvedLevel-1]/100)));
            if(numeric(actor.hp)<=hpCost){ return notify("目前HP不足以承受焚血訣的生命消耗。"); }
            actor.sp=numeric(actor.sp)-cost;
            actor.hp=numeric(actor.hp)-hpCost;
            addNamedBuff(actor,"bloodBurn",actorIndex,"焚血",3,{
                skillLevel:resolvedLevel,hpCost,remainingFireActions:4
            });
            announceSkill(actorIndex,skill);finishTacticalAction();return true;
        }
        return false;
    }

    let fireCastContext=null;
    function isPlayerDirectSkill(skill){
        return !!(skill&&(skill.category==="physical"||skill.category==="magic"));
    }
    function formalRound(){
        return typeof turn!=="undefined"?Math.max(1,Math.floor(numeric(turn,1))):1;
    }
    function extendResonanceOncePerRound(actor,resonance,momentum){
        if(!resonance||clampLevel(resonance.skillLevel,5)<5){ return false; }
        const round=formalRound();
        const maxExtensions=Math.max(0,numeric(skillById("fireSoulResonance")?.maxExtensionRounds,3));
        if(numeric(resonance.extensionCount)>=maxExtensions||numeric(resonance.lastExtendedRound)===round){
            return false;
        }
        resonance.extensionCount=numeric(resonance.extensionCount)+1;
        resonance.lastExtendedRound=round;
        resonance.turnsLeft=Math.max(1,numeric(resonance.turnsLeft,1))+1;
        if(momentum){
            momentum.turnsLeft=Math.max(1,numeric(momentum.turnsLeft,1))+1;
        }
        return true;
    }
    function withPlayerDirectSkillCast(actorIndex,skillId,options,invoke){
        const skill=skillById(skillId);
        if(!isPlayerDirectSkill(skill)||fireCastContext){ return invoke(); }
        const actor=actorByPartyIndex(actorIndex);
        if(!actor){ return invoke(); }
        const freeCast=!!(options&&options.freeCast);
        const resonance=activeBuff(actor,"fireSoulResonance");
        const momentum=activeBuff(actor,"fireMomentum");
        const blood=activeBuff(actor,"bloodBurn");
        const resonanceBonus=numeric(momentum&&momentum.bonusPercent);
        const bloodBonus=blood
            ?BLOOD_BURN_BY_LEVEL[clampLevel(blood.skillLevel,5)-1]
            :0;
        const bonus=resonanceBonus+bloodBonus;
        const beforeSp=numeric(actor.sp);
        const context={
            actor,actorIndex,skillId,resonance,momentum,blood,freeCast,
            critical:false,burnAdded:false,finished:false
        };
        fireCastContext=context;
        window.FourSymbolsSkillDamageContext={attacker:actor,skill,directSkillBonusPercent:bonus};
        let result;
        try{ result=invoke(); }
        finally{
            fireCastContext=null;
            window.FourSymbolsSkillDamageContext=null;
        }
        const succeeded=freeCast||context.finished||numeric(actor.sp)<beforeSp;
        if(succeeded&&!freeCast){
            if(blood){
                blood.remainingFireActions=Math.max(0,numeric(blood.remainingFireActions,4)-1);
                if(blood.remainingFireActions<=0){ removeBuff(actor,blood); }
            }
            if(resonance&&(context.critical||context.burnAdded)){
                extendResonanceOncePerRound(actor,resonance,momentum);
            }
        }
        return result;
    }

    if(typeof rollCritical==="function"){
        const previousRollCritical=rollCritical;
        rollCritical=function(){
            const result=previousRollCritical.apply(this,arguments);
            if(fireCastContext&&result&&result.isCrit){ fireCastContext.critical=true; }
            return result;
        };
    }
    if(typeof applyBurnEffect==="function"){
        const previousApplyBurnEffect=applyBurnEffect;
        applyBurnEffect=function(){
            const result=previousApplyBurnEffect.apply(this,arguments);
            if(fireCastContext&&result===true){ fireCastContext.burnAdded=true; }
            return result;
        };
    }
    if(window.FourSymbolsBattleFlow&&typeof window.FourSymbolsBattleFlow.subscribeActionFinished==="function"){
        window.FourSymbolsBattleFlow.subscribeActionFinished(()=>{
            if(fireCastContext){ fireCastContext.finished=true; }
        });
    }

    /* Persistent-effect duration is owned by js/00-main.js BattleFlow.
       This module only owns final skill data/projection and tactical effects. */

    if(typeof document!=="undefined"&&!document.getElementById("v17364-skill-progression-style")){
        const style=document.createElement("style");
        style.id="v17364-skill-progression-style";
        style.textContent=
            ".v17364-progression-hint{display:block;margin-top:4px;white-space:normal;overflow-wrap:anywhere;line-height:1.35;opacity:.86;font-size:.82em;}"+
            ".v17364-progression-detail{display:grid;gap:6px;margin-top:10px;}"+
            ".v17364-progression-detail>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}"+
            ".v17364-progression-detail strong{flex:0 0 auto;}"+
            ".v17364-progression-detail span{text-align:right;overflow-wrap:anywhere;}";
        document.head.appendChild(style);
    }

    window.FourSymbolsSkillSpec=Object.freeze({
        damageSkillIds:PLAYER_DAMAGE_SKILL_IDS.slice(),
        upgradeCosts:SKILL_UPGRADE_COST_BY_TARGET_LEVEL,
        castFireTactical:castNewFireTactical,
        withPlayerDirectSkillCast:withPlayerDirectSkillCast,
        targetLabel:targetLabel,
        effectText:effectText,
        descriptionFor:descriptionFor,
        levelBreakdownHtml:levelBreakdownHtml,
        getRequiredCharacterLevelForSkillLevel:getRequiredCharacterLevelForSkillLevel,
        getUpgradeCostForTargetLevel:getUpgradeCostForTargetLevel,
        applyFinalData:applyFinalProgressionData
    });

    window.v17364SkillUpgradeCostByTargetLevel=SKILL_UPGRADE_COST_BY_TARGET_LEVEL;
    window.v17364GetRequiredCharacterLevelForSkillLevel=getRequiredCharacterLevelForSkillLevel;
    window.v17364GetUpgradeCostForTargetLevel=getUpgradeCostForTargetLevel;
    window.v17364ApplyFinalProgressionData=applyFinalProgressionData;
    window.v17364CastNewFireTactical=castNewFireTactical;
    window.v17364DecorateSkillProgressionUi=decorateSkillProgressionUi;
    window.v17364NormalizeCrossElementEquips=normalizeAllCrossElementEquips;
    window.v17364SkillProgression={
        version:"173.64",upgradeCosts:SKILL_UPGRADE_COST_BY_TARGET_LEVEL,
        fireMomentumByLevel:FIRE_MOMENTUM_BY_LEVEL,bloodBurnByLevel:BLOOD_BURN_BY_LEVEL,
        dodgeByLevel:DODGE_BY_LEVEL,rockWallByLevel:ROCK_WALL_BY_LEVEL,earthShieldByLevel:EARTH_SHIELD_BY_LEVEL,
        getRequiredCharacterLevelForSkillLevel,getUpgradeCostForTargetLevel,applyFinalProgressionData,
        castNewFireTactical,decorateSkillProgressionUi
    };

    normalizeAllCrossElementEquips();
    if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
})();
