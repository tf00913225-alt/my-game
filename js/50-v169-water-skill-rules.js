/* =====================================================
   V169 — final Water skill rules

   This late runtime is the single authoritative layer for the seven
   offensive/control Water skills requested in V169.  It intentionally
   patches data and narrow compatibility seams instead of reopening the
   legacy combat engine.
===================================================== */
(function installV169WaterSkillRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v169WaterSkillRulesInstalled){ return; }
    window.__v169WaterSkillRulesInstalled=true;

    const VERSION="169";
    const WATER_SKILL_IDS=[
        "frostPunch","iceSpin","frostCrush","waterBall",
        "floodBeast","iceArrowRain","freeze"
    ];
    const WATER_SKILL_ID_SET=new Set(WATER_SKILL_IDS);
    const STATUS_FIELDS=[
        "freezeChance","freezeDuration","freezeSingleTarget",
        "teamFreezeChance","teamFreezeDuration",
        "frostbiteChance","frostbiteDuration"
    ];
    const FROSTBITE_ACTION_TEXT="仍可使用補品、符咒、普通攻擊、防禦與逃脫";

    const FINAL_SKILLS={
        frostPunch:{
            id:"frostPunch",tier:2,name:"冰霜拳",element:"water",category:"physical",
            targetType:"single",learnCost:10,maxLevel:5,upgradeCost:1,
            baseDamage:30,damagePerLevel:8,spCost:17,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],
            description:"需先學習水刀斬。初次學習需10技能點，對單體造成30點傷害，消耗17 SP；最高5級，每升1級消耗1技能點，傷害+8，並吸取實際造成傷害的4%/5%/6%/7%/8%恢復自身HP。"
        },
        iceSpin:{
            id:"iceSpin",tier:3,name:"冰旋一閃",element:"water",category:"physical",
            targetType:"tri",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:25,damagePerLevel:7,spCost:45,
            frostbiteChance:30,frostbiteDuration:1,
            lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],
            description:"需先學習冰霜拳。初次學習需20技能點，對同排中、左、右最多3名目標各造成25點傷害，消耗45 SP；最高5級，每升1級消耗1技能點，傷害+7，並吸取實際造成傷害的3%/4%/5%/6%/7%恢復自身HP。每個命中目標有30%基礎機率凍傷1回合；凍傷期間無法使用技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。"
        },
        frostCrush:{
            id:"frostCrush",tier:4,name:"冰封重擊",element:"water",category:"physical",
            targetType:"single",learnCost:30,maxLevel:5,upgradeCost:1,
            baseDamage:100,damagePerLevel:15,spCost:60,
            frostbiteChance:40,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],
            description:"需先學習冰旋一閃。初次學習需30技能點，對單體造成100點傷害，消耗60 SP；最高5級，每升1級消耗1技能點，傷害+15，並吸取實際造成傷害的4%/5%/6%/7%/8%恢復自身HP。命中目標有40%基礎機率凍傷1回合；凍傷期間無法使用技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。"
        },
        waterBall:{
            id:"waterBall",tier:1,name:"水球術",element:"water",category:"magic",
            targetType:"tri",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:17,damagePerLevel:3,spCost:8,
            lifestealPercentByLevel:[3,4,5,6,7],requires:[],
            description:"初次學習需2技能點，對同排中、左、右最多3名目標各造成17點傷害，消耗8 SP；最高5級，每升1級消耗1技能點，傷害+3，並吸取實際造成傷害的3%/4%/5%/6%/7%恢復自身HP。"
        },
        floodBeast:{
            id:"floodBeast",tier:2,name:"洪水猛獸",element:"water",category:"magic",
            targetType:"single",learnCost:15,maxLevel:5,upgradeCost:1,
            baseDamage:85,damagePerLevel:8,spCost:35,
            frostbiteChance:40,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],
            description:"需先學習水球術。初次學習需15技能點，對單體造成85點傷害，消耗35 SP；最高5級，每升1級消耗1技能點，傷害+8，並吸取實際造成傷害的4%/5%/6%/7%/8%恢復自身HP。命中目標有40%基礎機率凍傷1回合；凍傷期間無法使用技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。"
        },
        iceArrowRain:{
            id:"iceArrowRain",tier:3,name:"冰霜箭雨",element:"water",category:"magic",
            targetType:"all",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:30,damagePerLevel:12,spCost:75,
            frostbiteChance:20,frostbiteDuration:1,
            lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],
            description:"需先學習洪水猛獸。初次學習需20技能點，對敵方全體各造成30點傷害，消耗75 SP；最高5級，每升1級消耗1技能點，傷害+12，並吸取實際造成傷害的1%/2%/3%/4%/5%恢復自身HP。每個命中目標各有20%基礎機率凍傷1回合；凍傷期間無法使用技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。"
        },
        freeze:{
            id:"freeze",tier:4,name:"冰封",element:"water",category:"magic",
            targetType:"single",learnCost:25,maxLevel:1,spCost:32,
            freezeChance:90,freezeDuration:5,requires:["iceArrowRain"],
            description:"需先學習冰霜箭雨。初次學習需25技能點，90%基礎機率冰封單一目標，使其無法行動5回合，消耗32 SP；純控制技能，不造成傷害。"
        }
    };

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function copyValue(value){
        return Array.isArray(value)?value.slice():value;
    }

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function applyFinalSkillData(){
        if(typeof skillDatabase==="undefined"){ return; }

        WATER_SKILL_IDS.forEach(id=>{
            const skill=skillDatabase[id];
            const finalData=FINAL_SKILLS[id];
            if(!skill||!finalData){ return; }

            /* Remove every legacy control field before assigning one status
               family.  In particular, freezeChance:0 still rendered as a
               visible "0% Freeze" row in the character-creation modal. */
            STATUS_FIELDS.forEach(field=>{ delete skill[field]; });

            if(id==="freeze"){
                delete skill.baseDamage;
                delete skill.damagePerLevel;
                delete skill.lifestealPercentByLevel;
                delete skill.upgradeCost;
            }

            Object.keys(finalData).forEach(key=>{
                skill[key]=copyValue(finalData[key]);
            });
        });
    }

    applyFinalSkillData();

    function activeFrostbite(entity){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
        ));
    }

    /* V158's compatibility resolver predates the final single-target rule and
       asks getSkillTargets(..., "tri") explicitly.  Keep the mature SP/status
       settlement, but narrow only a Freeze invocation to its resolved card. */
    function withSingleFreezeTarget(callback){
        const previousTargets=window.getSkillTargets;
        if(typeof previousTargets!=="function"){ return callback(); }

        window.getSkillTargets=function(centerIndex,targetType){
            if(targetType==="tri"){ return [centerIndex]; }
            return previousTargets.apply(this,arguments);
        };

        try{ return callback(); }
        finally{ window.getSkillTargets=previousTargets; }
    }

    function wrapSecondaryFreeze(functionName,skillArgumentIndex){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const args=arguments;
            if(args[skillArgumentIndex]==="freeze"){
                return withSingleFreezeTarget(()=>previous.apply(this,args));
            }
            return previous.apply(this,args);
        };
    }

    wrapSecondaryFreeze("castSecondaryCharacterSkill",1);
    wrapSecondaryFreeze("castPlayer2Skill",0);

    /* Frostbite blocks skills, not the whole action.  Returning false here
       lets the existing Frostbite-aware normal-attack fallback continue, but
       prevents named Abyss support resolvers from bypassing that fallback. */
    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(activeFrostbite(monster)){ return false; }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    function partyCharacters(){
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            return getExistingPartyIndexes().map(index=>getPartyCharacterByIndex(index)).filter(Boolean);
        }
        return [
            typeof player!=="undefined"?player:null,
            typeof player2!=="undefined"?player2:null,
            typeof player3!=="undefined"?player3:null
        ].filter(Boolean);
    }

    /* The legacy monster damage path treats every selected skill as an attack.
       Freeze is the one pure-control exception: it still spends SP, rolls its
       status and respects single-target selection, but produces no HP hit. */
    if(typeof window.processSingleMonsterAttack==="function"){
        const previousMonsterAttack=window.processSingleMonsterAttack;
        window.processSingleMonsterAttack=function(){
            let freezeCast=false;
            let defenseSuppressed=false;
            const characters=partyCharacters();
            const defenseState=characters.map(character=>({
                character:character,
                had:Object.prototype.hasOwnProperty.call(character,"isDefending"),
                value:character.isDefending
            }));
            const barrierState=characters.map(character=>({
                character:character,
                entries:(character.activeBuffs||[]).map((buff,index)=>({
                    buff:buff,index:index,
                    isBarrier:!!(buff&&buff.type==="barrier"),
                    remainingBlocks:buff&&buff.remainingBlocks,
                    turnsLeft:buff&&buff.turnsLeft
                })).filter(entry=>entry.isBarrier)
            }));
            const previousBadge=window.showMonsterSkillNameBadge;
            const previousDamage=window.calculateDamage;
            const previousLog=window.addBattleLog;

            function suppressDefense(){
                if(defenseSuppressed){ return; }
                defenseSuppressed=true;
                defenseState.forEach(entry=>{ entry.character.isDefending=false; });
            }

            if(typeof previousBadge==="function"){
                window.showMonsterSkillNameBadge=function(skillName){
                    const freezeSkill=typeof skillDatabase!=="undefined"?skillDatabase.freeze:null;
                    if(freezeSkill&&skillName===freezeSkill.name){ freezeCast=true; }
                    return previousBadge.apply(this,arguments);
                };
            }

            if(typeof previousDamage==="function"){
                window.calculateDamage=function(){
                    if(freezeCast){
                        suppressDefense();
                        return 0;
                    }
                    return previousDamage.apply(this,arguments);
                };
            }

            if(typeof previousLog==="function"){
                window.addBattleLog=function(message){
                    const text=String(message==null?"":message);
                    if(
                        freezeCast&&(
                            text.includes("結界完全格擋了這次攻擊")||
                            (text.includes("施放冰封")&&/造成0點?傷害/.test(text))
                        )
                    ){
                        return;
                    }
                    return previousLog.apply(this,arguments);
                };
            }

            try{ return previousMonsterAttack.apply(this,arguments); }
            finally{
                if(typeof previousBadge==="function"){ window.showMonsterSkillNameBadge=previousBadge; }
                if(typeof previousDamage==="function"){ window.calculateDamage=previousDamage; }
                if(typeof previousLog==="function"){ window.addBattleLog=previousLog; }

                defenseState.forEach(entry=>{
                    if(entry.had){ entry.character.isDefending=entry.value; }
                    else{ delete entry.character.isDefending; }
                });

                if(freezeCast){
                    barrierState.forEach(state=>{
                        state.character.activeBuffs=state.character.activeBuffs||[];
                        state.entries.forEach(entry=>{
                            entry.buff.remainingBlocks=entry.remainingBlocks;
                            entry.buff.turnsLeft=entry.turnsLeft;
                            if(!state.character.activeBuffs.includes(entry.buff)){
                                state.character.activeBuffs.splice(
                                    Math.min(entry.index,state.character.activeBuffs.length),0,entry.buff
                                );
                            }
                        });
                    });
                }
            }
        };
    }

    function levelValue(values,level){
        if(!Array.isArray(values)||!values.length){ return 0; }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level)||1)-1));
        return numeric(values[index]);
    }

    function damageAtLevel(skill,level){
        if(!skill||skill.baseDamage===undefined){ return null; }
        return numeric(skill.baseDamage)+numeric(skill.damagePerLevel)*(Math.max(1,numeric(level))-1);
    }

    function waterSkillEffectParts(skill,level){
        const parts=[];
        const damage=damageAtLevel(skill,level);
        if(damage!==null){
            parts.push("傷害"+Math.floor(damage)+(numeric(skill.damagePerLevel)>0?"（每級+"+numeric(skill.damagePerLevel)+"）":""));
        }
        if(numeric(skill.frostbiteChance)>0){
            parts.push(
                numeric(skill.frostbiteChance)+"%基礎機率凍傷"+
                Math.max(1,numeric(skill.frostbiteDuration)||1)+"回合（只禁止技能；"+
                FROSTBITE_ACTION_TEXT+"）"
            );
        }
        if(numeric(skill.freezeChance)>0){
            parts.push(
                numeric(skill.freezeChance)+"%基礎機率冰封"+
                Math.max(1,numeric(skill.freezeDuration)||1)+"回合（無法行動）"
            );
        }
        if(Array.isArray(skill.lifestealPercentByLevel)){
            parts.push("吸取實際傷害"+levelValue(skill.lifestealPercentByLevel,level)+"%（只恢復自身HP）");
        }
        if(skill.id==="freeze"){ parts.push("不造成傷害"); }
        return parts;
    }

    function buildWaterSkillLevelBreakdown(skill){
        const lines=[];
        const maxLevel=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel)||1));
        for(let level=1;level<=maxLevel;level++){
            const parts=waterSkillEffectParts(skill,level);
            lines.push(
                '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);">'+
                '<span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.'+level+'</span>'+
                '<span style="flex:1;">'+escapeHtml(parts.join("｜"))+'</span></div>'
            );
        }
        return lines.join("");
    }

    if(typeof window.getSkillPreviewSummary==="function"){
        const previousPreviewSummary=window.getSkillPreviewSummary;
        window.getSkillPreviewSummary=function(skill){
            if(!skill||!WATER_SKILL_ID_SET.has(skill.id)){
                return previousPreviewSummary.apply(this,arguments);
            }
            const scope={single:"單一敵人",tri:"同排最多3名敵人",all:"敵方全體"}[skill.targetType]||"技能目標";
            const type=skill.id==="freeze"?"純控制":(skill.category==="physical"?"物理傷害":"法術傷害");
            const status=numeric(skill.frostbiteChance)>0
                ?"；可能使目標凍傷，只禁止技能"
                :numeric(skill.freezeChance)>0?"；可能使目標冰封並完全無法行動":"";
            const steal=Array.isArray(skill.lifestealPercentByLevel)?"；吸取實際傷害恢復自身HP":"";
            return scope+"；"+type+status+steal+"。";
        };
    }

    if(typeof window.getSkillEffectPreviewText==="function"){
        const previousEffectPreview=window.getSkillEffectPreviewText;
        window.getSkillEffectPreviewText=function(skill,level){
            if(skill&&WATER_SKILL_ID_SET.has(skill.id)){
                return waterSkillEffectParts(skill,level).join("｜");
            }
            return previousEffectPreview.apply(this,arguments);
        };
    }

    if(typeof window.buildSkillLevelBreakdownHTML==="function"){
        const previousLevelBreakdown=window.buildSkillLevelBreakdownHTML;
        window.buildSkillLevelBreakdownHTML=function(skill){
            if(skill&&WATER_SKILL_ID_SET.has(skill.id)){
                return buildWaterSkillLevelBreakdown(skill);
            }
            return previousLevelBreakdown.apply(this,arguments);
        };
    }

    if(typeof window.showCreationSkillDetail==="function"){
        const previousCreationSkillDetail=window.showCreationSkillDetail;
        window.showCreationSkillDetail=function(skillId){
            const result=previousCreationSkillDetail.apply(this,arguments);
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(skill&&WATER_SKILL_ID_SET.has(skill.id)&&typeof document!=="undefined"){
                const description=document.getElementById("creationSkillDetailDescription");
                const levels=document.getElementById("creationSkillDetailLevels");
                if(description){ description.textContent=skill.description; }
                if(levels){ levels.innerHTML=buildWaterSkillLevelBreakdown(skill); }
            }
            return result;
        };
    }

    window.v169WaterSkillRules=Object.freeze({
        version:VERSION,
        skillIds:WATER_SKILL_IDS.slice(),
        effectParts:function(skillId,level){
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            return skill?waterSkillEffectParts(skill,level).slice():[];
        },
        isFrostbitten:activeFrostbite
    });
})();
