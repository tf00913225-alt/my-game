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
    const BLOOD_BURN_HP_COST_BY_LEVEL=Object.freeze([5,10,15,20,25]);
    const BLOOD_BURN_BY_LEVEL=Object.freeze([5,10,15,20,35]);
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
    const EARTH_SHIELD_BY_LEVEL=Object.freeze([20,30,35,40,50]);
    const EARTH_SHIELD_DURATION_BY_LEVEL=Object.freeze([3,3,3,4,5]);
    const BARRIER_BLOCKS_BY_LEVEL=Object.freeze([3,3,3,4,5]);
    const BARRIER_DURATION_BY_LEVEL=Object.freeze([3,3,3,4,5]);
    const GROUP_ORDER=Object.freeze({physical:0,magic:1,tactical:2,ex:3});

    function numeric(value,fallback){
        const number=Number(value);
        return Number.isFinite(number)?number:(fallback===undefined?0:fallback);
    }
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
        rage:{learnLevel:18,learnCost:10,maxLevel:5,progressionGroup:"tactical"},
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
            directDamageBonusByLevel:BLOOD_BURN_BY_LEVEL.slice(),fireActionCharges:3,icon:"血",
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
        revive:{learnLevel:20,learnCost:10,maxLevel:5,upgradeCost:1,requires:["healSpell"],progressionGroup:"tactical"},
        freeze:{
            learnLevel:25,learnCost:14,maxLevel:5,upgradeCost:1,requires:["iceSpin","iceArrowRain"],progressionGroup:"tactical",
            targetType:"column",targetTypeAtMaxLevel:"tri",spCost:32,
            freezeChanceByLevel:FREEZE_CHANCE_BY_LEVEL.slice(),freezeDurationByLevel:FREEZE_DURATION_BY_LEVEL.slice()
        },
        purifyMind:{
            learnLevel:35,learnCost:18,maxLevel:3,upgradeCost:1,requires:["healSpell"],progressionGroup:"tactical",
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
            evasionBonusPercent:10
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
            targetType:"allyTri",spCost:66,reflectPercentByLevel:EARTH_SHIELD_BY_LEVEL.slice(),
            durationByLevel:EARTH_SHIELD_DURATION_BY_LEVEL.slice()
        },
        barrier:{
            learnLevel:35,learnCost:18,maxLevel:5,upgradeCost:1,requires:["earthShield"],progressionGroup:"tactical",
            targetType:"ally",spCost:40,barrierBlockCountByLevel:BARRIER_BLOCKS_BY_LEVEL.slice(),
            durationByLevel:BARRIER_DURATION_BY_LEVEL.slice()
        },
        earthEX:{learnLevel:50,learnCost:20,maxLevel:1,progressionGroup:"ex"}
    };

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
                "回合；期間傷害-25%、最終閃躲-25%、最終異常狀態抗性-25%");
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
            return "炎勢使火系直接攻擊傷害+"+levelValue(skill.momentumBonusByLevel,lv,0)+
                "%，基礎3回合"+(lv>=5?"；爆擊或成功新增燃燒時每回合最多延長1回合、整次最多+3回合":"");
        }
        if(skill.id==="bloodBurnArt"){
            return "消耗最大HP "+levelValue(skill.hpCostPercentByLevel,lv,0)+
                "%；接下來3次成功施放的火系直接攻擊傷害+"+
                levelValue(skill.directDamageBonusByLevel,lv,0)+
                "%；不強化DoT與免費追擊，免費追擊也不消耗3次有效施放次數";
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
            return "反傷"+levelValue(skill.reflectPercentByLevel,lv,0)+"%，持續"+
                levelValue(skill.durationByLevel,lv,3)+"回合；同名不可疊加或刷新";
        }
        if(skill.id==="barrier"){
            return "抵擋"+levelValue(skill.barrierBlockCountByLevel,lv,3)+"次直接傷害，最長"+
                levelValue(skill.durationByLevel,lv,3)+"回合；DoT不抵擋且不消耗次數";
        }
        if(skill.id==="fireEX"){
            return "永久提升火元素傷害"+numeric(skill.damageBonusPercent)+
                "%、爆擊率"+numeric(skill.critChanceBonusPercent)+
                "%、爆擊傷害"+numeric(skill.critDamageBonusPercent)+
                "%；對有異常狀態的目標傷害再+"+numeric(skill.statusTargetDamageBonusPercent)+"%";
        }
        if(skill.id==="waterEX"){
            return "永久提升水元素傷害"+numeric(skill.damageBonusPercent)+
                "%、回復類技能HP恢復量"+numeric(skill.healBonusPercent)+
                "%；每回合開始前有"+numeric(skill.turnStartCleanseChance)+
                "%機率解除自身所有可解除負面狀態";
        }
        if(skill.id==="windEX"){
            return "永久提升最終閃躲"+numeric(skill.evasionBonusPercent)+"%";
        }
        if(skill.id==="earthEX"){
            return "永久提升防禦力"+numeric(skill.defenseBonusPercent)+"%";
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
            shield.targetType="allyTri"; shield.spCost=66; shield.requires=["rockWall"];
            delete shield.reflectPercent;
            shield.description="我方中、左、右最多3名存活角色獲得萬象土盾，反傷20%/30%/35%/40%/50%，持續3/3/3/4/5回合；同名不可疊加或刷新。SP 66。";
        }
        const barrier=skillDatabase.barrier;
        if(barrier){
            barrier.barrierBlockCountByLevel=BARRIER_BLOCKS_BY_LEVEL.slice();
            barrier.durationByLevel=BARRIER_DURATION_BY_LEVEL.slice();
            barrier.targetType="ally"; barrier.spCost=40; barrier.requires=["earthShield"];
            delete barrier.barrierBlockCount; delete barrier.duration;
            barrier.description="我方1人獲得結界，抵擋3/3/3/4/5次直接傷害，最長持續3/3/3/4/5回合；燃燒、毒等DoT不抵擋且不消耗次數。SP 40。";
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
            const prereqOk=prerequisiteMet(levels,skill);
            if(characterLevel<requiredLevel){
                return notify(prereqOk
                    ?("角色 Lv"+requiredLevel+" 才能學習「"+skill.name+"」。")
                    :("需要 Lv"+requiredLevel+"・前置："+prerequisiteLabel(skill)));
            }
            if(!prereqOk){ return notify("需要前置："+prerequisiteLabel(skill)); }
            const learnCost=Math.max(0,Math.floor(numeric(skill.learnCost)));
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
            if(current<=0){
                const prereqOk=prerequisiteMet(levels,skill);
                const levelOk=level>=skill.learnLevel;
                const costOk=points>=numeric(skill.learnCost);
                if(levelOk&&prereqOk&&costOk){
                    setActionCard(card,true,"學習・"+skill.learnCost+"點","learnSkill('"+skillId+"')");
                }else{
                    const reasons=[];
                    if(!levelOk){ reasons.push("Lv"+skill.learnLevel+" 解鎖"); }
                    if(!prereqOk){ reasons.push("前置："+prerequisiteLabel(skill)); }
                    if(levelOk&&prereqOk&&!costOk){ reasons.push("需要 "+skill.learnCost+" 技能點"); }
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
            ["學習成本",skill.learnCost+" 技能點"],
            ["升級成本",upgradeText],
            ["前置技能",prerequisiteLabel(skill)]
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
        if(typeof showSkillNameBadge==="function"){ showSkillNameBadge(skill.name,"fire",actorIndex); }
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
                skillLevel:resolvedLevel,hpCost,remainingFireActions:3
            });
            announceSkill(actorIndex,skill);finishTacticalAction();return true;
        }
        return false;
    }

    let fireCastContext=null;
    function isPlayerFireDirectSkill(skill){
        return !!(skill&&skill.element==="fire"&&(skill.category==="physical"||skill.category==="magic"));
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
        if(!isPlayerFireDirectSkill(skill)||fireCastContext){ return invoke(); }
        const actor=actorByPartyIndex(actorIndex);
        if(!actor){ return invoke(); }
        const freeCast=!!(options&&options.freeCast);
        const resonance=activeBuff(actor,"fireSoulResonance");
        const momentum=activeBuff(actor,"fireMomentum");
        const blood=activeBuff(actor,"bloodBurn");
        const resonanceBonus=numeric(momentum&&momentum.bonusPercent);
        const bloodBonus=!freeCast&&blood
            ?BLOOD_BURN_BY_LEVEL[clampLevel(blood.skillLevel,5)-1]
            :0;
        const bonus=resonanceBonus+bloodBonus;
        const hadDamageBonus=Object.prototype.hasOwnProperty.call(skill,"damageBonusPercent");
        const previousDamageBonus=skill.damageBonusPercent;
        if(bonus){ skill.damageBonusPercent=numeric(previousDamageBonus)+bonus; }
        const beforeSp=numeric(actor.sp);
        const context={
            actor,actorIndex,skillId,resonance,momentum,blood,freeCast,
            critical:false,burnAdded:false,finished:false
        };
        fireCastContext=context;
        let result;
        try{ result=invoke(); }
        finally{
            fireCastContext=null;
            if(bonus){
                if(hadDamageBonus){ skill.damageBonusPercent=previousDamageBonus; }
                else{ delete skill.damageBonusPercent; }
            }
        }
        const succeeded=freeCast||context.finished||numeric(actor.sp)<beforeSp;
        if(succeeded&&!freeCast){
            if(blood){
                blood.remainingFireActions=Math.max(0,numeric(blood.remainingFireActions,3)-1);
                blood.turnsLeft=blood.remainingFireActions;
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

    /*
     * Persistent Effect Duration Lifecycle
     *
     * `turnsLeft` is deliberately consumed from a real initiative action,
     * rather than from the global round-start sweep.  A state created during
     * the current action is absent from this snapshot, so casting a Buff does
     * not silently consume one of its own effective actions.  Freeze/Petrify
     * remain present while their action is skipped, then consume exactly one
     * blocked action at the normal action-finished boundary.  Burn is a DoT
     * and therefore remains owned by the formal round-start tick path.
     */
    const ACTION_DURATION_STATUS_TYPES=new Set([
        "freeze","petrify","frostbite","agilityDown","statDown","damageDown","defenseDown","stun"
    ]);
    const ACTION_DURATION_EXCLUDED_BUFFS=new Set(["phoenixMight","bloodBurn"]);
    let durationAction=null;
    window.v175DurationLifecycleActive=true;

    function partyAndMonsterEntities(){
        const result=[];
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            getExistingPartyIndexes().forEach(index=>{
                const entity=getPartyCharacterByIndex(index);
                if(entity){ result.push(entity); }
            });
        }
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach(entity=>{ if(entity){ result.push(entity); } });
        }
        return result;
    }
    function captureActionDurationEntries(kind){
        const entries=[];
        partyAndMonsterEntities().forEach(entity=>{
            const list=kind==="buff"?entity.activeBuffs:entity.statusEffects;
            if(!Array.isArray(list)){ return; }
            list.forEach(entry=>{
                const eligible=kind==="buff"
                    ?entry&&numeric(entry.turnsLeft)>0&&!entry.oneShot&&!ACTION_DURATION_EXCLUDED_BUFFS.has(entry.type)
                    :entry&&numeric(entry.turnsLeft)>0&&ACTION_DURATION_STATUS_TYPES.has(entry.type);
                if(eligible){ entries.push({entity,entry,turnsLeft:entry.turnsLeft,deferFirstTick:entry.deferFirstTick}); }
            });
        });
        return entries;
    }
    function restoreActionDurationEntries(kind,entries){
        entries.forEach(record=>{
            const key=kind==="buff"?"activeBuffs":"statusEffects";
            const list=Array.isArray(record.entity[key])?record.entity[key]:[];
            record.entry.turnsLeft=record.turnsLeft;
            if(record.deferFirstTick!==undefined){ record.entry.deferFirstTick=record.deferFirstTick; }
            if(!list.includes(record.entry)){ list.push(record.entry); }
            record.entity[key]=list;
        });
    }
    if(typeof tickStatusEffects==="function"){
        const previousTickStatusEffects=tickStatusEffects;
        tickStatusEffects=function(){
            const snapshot=captureActionDurationEntries("status");
            const result=previousTickStatusEffects.apply(this,arguments);
            restoreActionDurationEntries("status",snapshot);
            return result;
        };
    }
    if(typeof tickPlayerBuffs==="function"){
        const previousTickPlayerBuffs=tickPlayerBuffs;
        tickPlayerBuffs=function(){
            const snapshot=captureActionDurationEntries("buff");
            const result=previousTickPlayerBuffs.apply(this,arguments);
            restoreActionDurationEntries("buff",snapshot);
            return result;
        };
    }
    function captureMonsterSupportDurations(){
        const records=[];
        if(typeof monsters==="undefined"||!Array.isArray(monsters)){ return records; }
        monsters.forEach(entity=>{
            if(!entity){ return; }
            const stats={attack:entity.attack,magicAttack:entity.magicAttack,resistance:entity.resistance,evasion:entity.evasion,accuracy:entity.accuracy};
            (entity.v141TeamBuffs||[]).forEach(state=>{
                if(state&&numeric(state.turnsLeft)>0){
                    records.push({entity,state,display:state.displayBuff,turnsLeft:state.turnsLeft,displayTurns:state.displayBuff&&state.displayBuff.turnsLeft,stats});
                }
            });
            ["v144CalmBuff","v144DodgeBuff","v155EvasionBlessing","v155WindDodge"].forEach(key=>{
                const state=entity[key];
                const display=state&&(state.display||state.displayBuff);
                if(state&&numeric(state.turnsLeft)>0){
                    records.push({entity,key,state,display,turnsLeft:state.turnsLeft,displayTurns:display&&display.turnsLeft,stats});
                }
            });
        });
        return records;
    }
    function restoreMonsterSupportDurations(records){
        records.forEach(record=>{
            const {entity,state,display,stats}=record;
            state.turnsLeft=record.turnsLeft;
            if(display){ display.turnsLeft=record.displayTurns; }
            if(record.key){ entity[record.key]=state; }
            else{
                entity.v141TeamBuffs=Array.isArray(entity.v141TeamBuffs)?entity.v141TeamBuffs:[];
                if(!entity.v141TeamBuffs.includes(state)){ entity.v141TeamBuffs.push(state); }
            }
            if(display){
                entity.activeBuffs=Array.isArray(entity.activeBuffs)?entity.activeBuffs:[];
                if(!entity.activeBuffs.includes(display)){ entity.activeBuffs.push(display); }
            }
            Object.assign(entity,stats);
        });
    }
    if(typeof startTurn==="function"){
        const previousStartTurnForDuration=startTurn;
        startTurn=function(){
            const snapshot=captureMonsterSupportDurations();
            const result=previousStartTurnForDuration.apply(this,arguments);
            restoreMonsterSupportDurations(snapshot);
            return result;
        };
    }

    function entityForActionEntry(entry){
        if(!entry){ return null; }
        if(entry.type==="player"&&typeof getPartyCharacterByIndex==="function"){
            return getPartyCharacterByIndex(entry.characterIndex);
        }
        if(entry.type==="monster"&&typeof monsters!=="undefined"&&Array.isArray(monsters)){
            return monsters[entry.monsterIndex]||null;
        }
        return null;
    }
    function snapshotTimedEntries(entity){
        return {
            buffs:new Set((entity&&Array.isArray(entity.activeBuffs)?entity.activeBuffs:[]).filter(buff=>
                buff&&numeric(buff.turnsLeft)>0&&!buff.oneShot&&!ACTION_DURATION_EXCLUDED_BUFFS.has(buff.type)
            )),
            statuses:new Set((entity&&Array.isArray(entity.statusEffects)?entity.statusEffects:[]).filter(effect=>
                effect&&numeric(effect.turnsLeft)>0&&ACTION_DURATION_STATUS_TYPES.has(effect.type)
            ))
        };
    }
    function expireActionBuff(entity,buff){
        if(!entity||!buff||!Array.isArray(entity.activeBuffs)){ return; }
        buff.turnsLeft=Math.max(0,numeric(buff.turnsLeft)-1);
        const mirrored=Array.isArray(entity.v141TeamBuffs)
            ?entity.v141TeamBuffs.find(item=>item&&item.displayBuff===buff):null;
        if(mirrored){ mirrored.turnsLeft=buff.turnsLeft; }
        if(buff.turnsLeft>0){ return; }
        entity.activeBuffs=entity.activeBuffs.filter(item=>item!==buff);
        if(mirrored){
            entity.v141TeamBuffs=entity.v141TeamBuffs.filter(item=>item!==mirrored);
            if(mirrored.type==="rage"){
                entity.attack=mirrored.originalAttack;
                entity.magicAttack=mirrored.originalMagicAttack;
            }else if(mirrored.type==="resistance"){
                entity.resistance=Math.max(0,numeric(entity.resistance)-numeric(mirrored.amount));
            }else if(mirrored.type==="dodge"){
                entity.evasion=mirrored.originalEvasion;
            }
        }
        ["v144CalmBuff","v144DodgeBuff","v155EvasionBlessing","v155WindDodge"].forEach(key=>{
            const state=entity[key];
            const display=state&&(state.display||state.displayBuff);
            if(display!==buff){ return; }
            if(key==="v144CalmBuff"){
                entity.accuracy=state.originalAccuracy;
                entity.resistance=state.originalResistance;
            }else if(key==="v144DodgeBuff"){
                entity.evasion=state.originalEvasion;
            }
            delete entity[key];
            if((key==="v155EvasionBlessing"||key==="v155WindDodge")&&
                !entity.v155EvasionBlessing&&!entity.v155WindDodge&&Object.prototype.hasOwnProperty.call(entity,"v155EvasionBase")){
                entity.evasion=numeric(entity.v155EvasionBase);
                delete entity.v155EvasionBase;
            }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("⏳"+(buff.statusName||buff.type)+"效果已結束。");
        }
    }
    function expireActionStatus(entity,effect){
        if(!entity||!effect||!Array.isArray(entity.statusEffects)){ return; }
        effect.turnsLeft=Math.max(0,numeric(effect.turnsLeft)-1);
        if(effect.turnsLeft>0){ return; }
        entity.statusEffects=entity.statusEffects.filter(item=>item!==effect);
        if(typeof addBattleLog==="function"){
            const name=effect.type==="freeze"?"冰封":effect.type==="petrify"?"石化":effect.type==="frostbite"?"凍傷":effect.type;
            addBattleLog((entity.id||entity.name||"目標")+"的"+name+"效果已解除。");
        }
    }
    function beginDurationAction(event){
        const entry=event&&event.queue&&event.queue[event.index];
        const entity=entityForActionEntry(entry);
        if(!entity||numeric(entity.hp)<=0){ durationAction=null; return; }
        const snapshot=snapshotTimedEntries(entity);
        durationAction={token:event.token,index:event.index,entry,entity,buffs:snapshot.buffs,statuses:snapshot.statuses};
    }
    function finishDurationAction(){
        const action=durationAction;
        durationAction=null;
        if(!action){ return; }
        action.buffs.forEach(buff=>{
            if(Array.isArray(action.entity.activeBuffs)&&action.entity.activeBuffs.includes(buff)){
                expireActionBuff(action.entity,buff);
            }
        });
        action.statuses.forEach(effect=>{
            if(Array.isArray(action.entity.statusEffects)&&action.entity.statusEffects.includes(effect)){
                expireActionStatus(action.entity,effect);
            }
        });
        if(typeof window.v143SyncStatusVisualEffects==="function"){
            window.v143SyncStatusVisualEffects(false);
        }
    }
    if(window.FourSymbolsBattleFlow&&typeof window.FourSymbolsBattleFlow.subscribeBeforeCombatant==="function"){
        window.FourSymbolsBattleFlow.subscribeBeforeCombatant(beginDurationAction);
        window.FourSymbolsBattleFlow.subscribeActionFinished(finishDurationAction);
    }
    window.FourSymbolsDurationLifecycle=Object.freeze({
        beginAction:beginDurationAction,finishAction:finishDurationAction,
        snapshotFor:entity=>snapshotTimedEntries(entity)
    });

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
    window.v17364SkillProgression={
        version:"173.64",upgradeCosts:SKILL_UPGRADE_COST_BY_TARGET_LEVEL,
        fireMomentumByLevel:FIRE_MOMENTUM_BY_LEVEL,bloodBurnByLevel:BLOOD_BURN_BY_LEVEL,
        dodgeByLevel:DODGE_BY_LEVEL,rockWallByLevel:ROCK_WALL_BY_LEVEL,earthShieldByLevel:EARTH_SHIELD_BY_LEVEL,
        getRequiredCharacterLevelForSkillLevel,getUpgradeCostForTargetLevel,applyFinalProgressionData,
        castNewFireTactical,decorateSkillProgressionUi
    };

    if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
})();
