/* =====================================================
   V169 — final Water skill rules

   This late runtime is the single authoritative layer for every Water
   skill.  It intentionally
   patches data and narrow compatibility seams instead of reopening the
   legacy combat engine.
===================================================== */
(function installV169WaterSkillRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v169WaterSkillRulesInstalled){ return; }
    window.__v169WaterSkillRulesInstalled=true;

    const VERSION="169";
    const WATER_SKILL_IDS=[
        "waterKnife","frostPunch","iceSpin","frostCrush","waterBall",
        "floodBeast","iceArrowRain","freeze","healSpell","revive","waterEX"
    ];
    const WATER_DAMAGE_SKILL_IDS=WATER_SKILL_IDS.slice(0,7);
    const WATER_PREVIEW_SKILL_ID_SET=new Set(WATER_SKILL_IDS.slice(0,8));
    const WATER_SUPPORT_PREVIEW_SKILL_ID_SET=new Set(["healSpell","revive","waterEX"]);
    const STATUS_FIELDS=[
        "freezeChance","freezeDuration","freezeSingleTarget",
        "teamFreezeChance","teamFreezeDuration",
        "frostbiteChance","frostbiteDuration","statusResistBonus"
    ];
    const FROSTBITE_ACTION_TEXT="仍可使用補品、符咒、普通攻擊、防禦與逃脫";

    const FINAL_SKILLS={
        waterKnife:{
            id:"waterKnife",tier:1,name:"水刀斬",element:"water",category:"physical",
            targetType:"single",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:21,damagePerLevel:5,spCost:6,
            frostbiteChance:10,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:[],
            description:"初次學習需2技能點，對單體造成21點傷害，消耗6 SP；10%基礎機率使目標凍傷1回合，凍傷期間無法使用技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+5。"
        },
        frostPunch:{
            id:"frostPunch",tier:2,name:"冰霜拳",element:"water",category:"physical",
            targetType:"single",learnCost:10,maxLevel:5,upgradeCost:1,
            baseDamage:32,damagePerLevel:7,spCost:17,
            frostbiteChance:15,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],
            description:"需先學習水刀斬。初次學習需10技能點，對單體造成32點傷害，消耗17 SP；15%基礎機率使目標凍傷1回合，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        iceSpin:{
            id:"iceSpin",tier:3,name:"冰旋一閃",element:"water",category:"physical",
            targetType:"tri",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:35,damagePerLevel:7,spCost:45,
            frostbiteChance:20,frostbiteDuration:1,
            lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],
            description:"需先學習冰霜拳。初次學習需20技能點，對同排中、左、右最多3名目標各造成35點傷害，消耗45 SP；20%基礎機率使目標凍傷1回合，並吸取實際傷害的3%/4%/5%/6%/7%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        frostCrush:{
            id:"frostCrush",tier:4,name:"冰封重擊",element:"water",category:"physical",
            targetType:"single",learnCost:30,maxLevel:5,upgradeCost:1,
            baseDamage:116,damagePerLevel:24,spCost:60,
            frostbiteChance:25,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],
            description:"需先學習冰旋一閃。初次學習需30技能點，對單體造成116點傷害，消耗60 SP；25%基礎機率使目標凍傷1回合，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+24。"
        },
        waterBall:{
            id:"waterBall",tier:1,name:"水球術",element:"water",category:"magic",
            targetType:"tri",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:10,damagePerLevel:2,spCost:8,
            frostbiteChance:10,frostbiteDuration:1,
            lifestealPercentByLevel:[3,4,5,6,7],requires:[],
            description:"初次學習需2技能點，對同排中、左、右最多3名目標各造成10點傷害，消耗8 SP；10%基礎機率使目標凍傷1回合，並吸取實際傷害的3%/4%/5%/6%/7%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+2。"
        },
        floodBeast:{
            id:"floodBeast",tier:2,name:"洪水猛獸",element:"water",category:"magic",
            targetType:"single",learnCost:15,maxLevel:5,upgradeCost:1,
            baseDamage:105,damagePerLevel:21,spCost:35,
            frostbiteChance:15,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],
            description:"需先學習水球術。初次學習需15技能點，對單體造成105點傷害，消耗35 SP；15%基礎機率使目標凍傷1回合，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+21。"
        },
        iceArrowRain:{
            id:"iceArrowRain",tier:3,name:"冰霜箭雨",element:"water",category:"magic",
            targetType:"all",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:20,damagePerLevel:4,spCost:75,
            frostbiteChance:20,frostbiteDuration:1,
            lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],
            description:"需先學習洪水猛獸。初次學習需20技能點，對敵方全體各造成20點傷害，消耗75 SP；每名目標獨立有20%基礎機率獲得【凍傷】1回合，並依各目標實際傷害計算1%/2%/3%/4%/5%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        freeze:{
            id:"freeze",tier:4,name:"冰封",element:"water",category:"magic",
            targetType:"column",learnCost:25,maxLevel:1,spCost:32,
            freezeChance:90,freezeDuration:3,requires:["iceArrowRain"],
            description:"需先學習冰霜箭雨。初次學習需25技能點，對前、後排同位置最多2名有效目標各以90%基礎機率附加【冰封】3回合，使其完全無法行動；消耗32 SP，最高1級，不造成傷害。已有【冰封】時新的冰封直接MISS且不擲命中。"
        },
        healSpell:{
            id:"healSpell",tier:5,name:"治療術",element:"water",category:"heal",
            targetType:"allyTri",learnCost:20,maxLevel:5,upgradeCost:1,
            baseHeal:550,healPerLevel:30,baseHealSP:35,healSPPerLevel:0,spCost:45,
            cleanseAll:true,requires:["iceArrowRain","iceSpin"],
            description:"需先學習冰霜箭雨或冰旋一閃其一。初次學習需20技能點，對我方中、左、右最多3名存活角色恢復550 HP與固定35 SP，並解除所有可解除負面狀態；施放者本人可恢復HP但不恢復SP。消耗45 SP，最高5級，每升1級消耗1技能點，HP恢復量+30，SP恢復量不變。"
        },
        revive:{
            id:"revive",tier:6,name:"復活術",element:"water",category:"revive",
            targetType:"deadAlly",learnCost:20,maxLevel:5,upgradeCost:1,spCost:45,
            reviveHealPercentByLevel:[20,40,60,80,100],requires:["healSpell"],
            description:"需先學習治療術。初次學習需20技能點，選擇1名死亡友方原地復活，依等級恢復20%/40%/60%/80%/100%最大HP，消耗45 SP。最高5級，每升1級消耗1技能點。"
        },
        waterEX:{
            id:"waterEX",tier:7,name:"水元素EX",element:"water",category:"passive",
            targetType:"none",learnCost:25,maxLevel:1,damageBonusPercent:5,healBonusPercent:10,
            turnStartCleanseChance:30,requires:[],
            description:"初次學習需25技能點，最大1級；永久提升水元素傷害5%、回復系技能回復量10%，每回合開始前有30%機率解除自身所有負面狀態。"
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
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){
        window.v173ApplyFormalDamageRoleProfiles(WATER_DAMAGE_SKILL_IDS);
    }

    /* Final Water/utility values load after the historical talisman sync. */
    if(typeof window.v132GetTalismanDefinition==="function"){
        ["Low","Mid","High","Perfect"].forEach(tier=>{
            const freezeTalisman=window.v132GetTalismanDefinition("freezeTalisman"+tier);
            if(freezeTalisman){
                freezeTalisman.sharedSkillId="freeze";
                freezeTalisman.talismanDuration=numeric(skillDatabase.freeze.freezeDuration);
            }
            const stealthTalisman=window.v132GetTalismanDefinition("stealthTalisman"+tier);
            if(stealthTalisman){
                stealthTalisman.sharedSkillId="stealthSkill";
                stealthTalisman.talismanDuration=numeric(skillDatabase.stealthSkill.duration);
            }
            const barrierTalisman=window.v132GetTalismanDefinition("barrierTalisman"+tier);
            if(barrierTalisman){
                barrierTalisman.sharedSkillId="barrier";
                barrierTalisman.talismanDuration=numeric(skillDatabase.barrier.duration);
                barrierTalisman.barrierBlockCount=numeric(skillDatabase.barrier.barrierBlockCount);
            }
        });
    }

    function activeFrostbite(entity){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
        ));
    }

    /* V158's compatibility resolver predates the final front/back column rule
       and asks getSkillTargets(..., "tri") explicitly.  Keep the mature
       SP/status settlement, but redirect only a Freeze invocation to the
       authoritative column resolver. */
    function withFinalFreezeTargets(callback){
        const previousTargets=window.getSkillTargets;
        if(typeof previousTargets!=="function"){ return callback(); }

        window.getSkillTargets=function(centerIndex,targetType){
            if(targetType==="tri"){ return previousTargets(centerIndex,"column"); }
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
                return withFinalFreezeTargets(()=>previous.apply(this,args));
            }
            return previous.apply(this,args);
        };
    }

    wrapSecondaryFreeze("castSecondaryCharacterSkill",1);
    wrapSecondaryFreeze("castPlayer2Skill",0);

    if(typeof window.castDamageSkill==="function"&&typeof window.v158CastTriFreeze==="function"){
        const previousCastDamageSkill=window.castDamageSkill;
        window.castDamageSkill=function(skillId,centerIndex){
            if(
                skillId==="freeze"&&
                withFinalFreezeTargets(()=>
                    window.v158CastTriFreeze(0,skillId,centerIndex,false)
                )
            ){
                return;
            }
            return previousCastDamageSkill.apply(this,arguments);
        };
    }

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

    function waterSupportEffectText(skill,level){
        const lv=Math.max(1,Math.min(numeric(skill&&skill.maxLevel)||1,Math.floor(numeric(level)||1)));
        if(skill&&skill.id==="healSpell"){
            return "我方中、左、右最多3名存活角色恢復 "+
                (numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(lv-1))+" HP、固定35 SP並解除所有可解除負面狀態；施放者本人不恢復SP";
        }
        if(skill&&skill.id==="revive"){
            return "使1名死亡友方原地復活並恢復最大HP的"+
                levelValue(skill.reviveHealPercentByLevel,lv)+"%；不恢復SP";
        }
        if(skill&&skill.id==="waterEX"){
            return "永久提升水元素傷害5%、回復類技能HP恢復量10%；每回合開始前有30%機率解除自身所有可解除負面狀態";
        }
        return "";
    }

    function buildWaterSupportLevelBreakdown(skill){
        const maxLevel=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel)||1));
        return Array.from({length:maxLevel},(_,index)=>
            '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);">'+
            '<span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.'+(index+1)+'</span>'+
            '<span style="flex:1;">'+escapeHtml(waterSupportEffectText(skill,index+1))+'</span></div>'
        ).join("");
    }

    if(typeof window.getSkillPreviewSummary==="function"){
        const previousPreviewSummary=window.getSkillPreviewSummary;
        window.getSkillPreviewSummary=function(skill){
            if(skill&&WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return waterSupportEffectText(skill,1)+"。";
            }
            if(!skill||!WATER_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return previousPreviewSummary.apply(this,arguments);
            }
            const scope={single:"單一敵人",tri:"同排最多3名敵人",column:"前後排同位置最多2名敵人",all:"敵方全體"}[skill.targetType]||"技能目標";
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
            if(skill&&WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return waterSupportEffectText(skill,level);
            }
            if(skill&&WATER_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return waterSkillEffectParts(skill,level).join("｜");
            }
            return previousEffectPreview.apply(this,arguments);
        };
    }

    if(typeof window.buildSkillLevelBreakdownHTML==="function"){
        const previousLevelBreakdown=window.buildSkillLevelBreakdownHTML;
        window.buildSkillLevelBreakdownHTML=function(skill){
            if(skill&&WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)){
                return buildWaterSupportLevelBreakdown(skill);
            }
            if(skill&&WATER_PREVIEW_SKILL_ID_SET.has(skill.id)){
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
            if(
                skill&&(
                    WATER_PREVIEW_SKILL_ID_SET.has(skill.id)||
                    WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)
                )&&typeof document!=="undefined"
            ){
                const description=document.getElementById("creationSkillDetailDescription");
                const levels=document.getElementById("creationSkillDetailLevels");
                if(description){ description.textContent=skill.description; }
                if(levels){
                    levels.innerHTML=WATER_SUPPORT_PREVIEW_SKILL_ID_SET.has(skill.id)
                        ?buildWaterSupportLevelBreakdown(skill)
                        :buildWaterSkillLevelBreakdown(skill);
                }
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
