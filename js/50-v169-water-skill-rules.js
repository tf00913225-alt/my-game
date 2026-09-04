/* =====================================================
   V169 — final Water skill rules

   This late runtime is the single authoritative layer for every Water
   skill. It patches the existing database and narrow compatibility seams
   without creating a second combat system.
===================================================== */
(function installV169WaterSkillRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v169WaterSkillRulesInstalled){ return; }
    window.__v169WaterSkillRulesInstalled=true;

    const VERSION="169";
    const WATER_DAMAGE_SKILL_IDS=[
        "waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain"
    ];
    const WATER_SKILL_IDS=WATER_DAMAGE_SKILL_IDS.concat([
        "freeze","healSpell","revive","purifyMind","waterEX"
    ]);
    const WATER_PREVIEW_SKILL_ID_SET=new Set(WATER_DAMAGE_SKILL_IDS.concat(["freeze"]));
    const WATER_SUPPORT_PREVIEW_SKILL_ID_SET=new Set(["healSpell","revive","purifyMind","waterEX"]);
    const STATUS_FIELDS=[
        "freezeChance","freezeDuration","freezeSingleTarget",
        "teamFreezeChance","teamFreezeDuration",
        "frostbiteChance","frostbiteDuration","statusResistBonus"
    ];
    const FROSTBITE_REMAINING_RATE=.75;

    const FINAL_SKILLS={
        waterKnife:{
            id:"waterKnife",tier:1,name:"水刀斬",element:"water",category:"physical",
            targetType:"single",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:21,damagePerLevel:5,spCost:6,
            frostbiteChance:30,frostbiteDuration:1,
            lifestealPercentByLevel:[4,5,6,7,8],requires:[],
            description:"初次學習需2技能點，對單體造成21點傷害，消耗6 SP；30%基礎機率使目標【凍傷】1回合。吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+5。"
        },
        frostPunch:{
            id:"frostPunch",tier:2,name:"冰霜拳",element:"water",category:"physical",
            targetType:"single",learnCost:10,maxLevel:5,upgradeCost:1,
            baseDamage:32,damagePerLevel:7,spCost:17,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],
            description:"需先學習水刀斬。初次學習需10技能點，對單體造成32點傷害，消耗17 SP；35%基礎機率使目標【凍傷】2回合，並吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        iceSpin:{
            id:"iceSpin",tier:3,name:"冰旋一閃",element:"water",category:"physical",
            targetType:"tri",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:35,damagePerLevel:7,spCost:45,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],
            description:"需先學習冰霜拳。初次學習需20技能點，對同排中、左、右最多3名有效目標各造成35點傷害，消耗45 SP；各目標有35%基礎機率【凍傷】2回合。依各目標實際受到傷害分別計算3%/4%/5%/6%/7%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        frostCrush:{
            id:"frostCrush",tier:4,name:"冰封重擊",element:"water",category:"physical",
            targetType:"single",learnCost:30,maxLevel:5,upgradeCost:1,
            baseDamage:116,damagePerLevel:24,spCost:60,
            frostbiteChance:45,frostbiteDuration:2,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],
            description:"需先學習冰旋一閃。初次學習需30技能點，對單體造成116點傷害，消耗60 SP；45%基礎機率使目標【凍傷】2回合，並吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+24。"
        },
        waterBall:{
            id:"waterBall",tier:1,name:"水球術",element:"water",category:"magic",
            targetType:"tri",learnCost:2,maxLevel:5,upgradeCost:1,
            baseDamage:10,damagePerLevel:2,spCost:8,
            frostbiteChance:30,frostbiteDuration:1,
            lifestealPercentByLevel:[3,4,5,6,7],requires:[],
            description:"初次學習需2技能點，對同排中、左、右最多3名有效目標各造成10點傷害，消耗8 SP；各目標有30%基礎機率【凍傷】1回合。依各目標實際受到傷害分別計算3%/4%/5%/6%/7%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+2。"
        },
        floodBeast:{
            id:"floodBeast",tier:2,name:"洪水猛獸",element:"water",category:"magic",
            targetType:"single",learnCost:15,maxLevel:5,upgradeCost:1,
            baseDamage:105,damagePerLevel:21,spCost:35,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],
            description:"需先學習水球術。初次學習需15技能點，對單體造成105點傷害，消耗35 SP；35%基礎機率使目標【凍傷】2回合，並吸取本次實際傷害的4%/5%/6%/7%/8%恢復自身HP。最高5級，每升1級消耗1技能點，傷害+21。"
        },
        iceArrowRain:{
            id:"iceArrowRain",tier:3,name:"冰霜箭雨",element:"water",category:"magic",
            targetType:"all",learnCost:20,maxLevel:5,upgradeCost:1,
            baseDamage:30,damagePerLevel:6,spCost:75,
            frostbiteChance:35,frostbiteDuration:2,
            lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],
            description:"需先學習洪水猛獸。初次學習需20技能點，對敵方全體每名有效目標各造成30點傷害，消耗75 SP；各目標有35%基礎機率【凍傷】2回合。依所有目標實際受到傷害分別計算1%/2%/3%/4%/5%吸血後加總恢復自身HP。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        freeze:{
            id:"freeze",tier:4,name:"冰封",element:"water",category:"magic",
            targetType:"column",learnCost:20,maxLevel:1,spCost:32,
            freezeChance:90,freezeDuration:3,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需20技能點，對前、後共最多2名有效敵方目標各以90%基礎機率附加【冰封】3回合，使其完全無法行動；消耗32 SP，最高1級，不造成傷害，套用硬控命中規則。已有同名【冰封】時再次施加直接MISS。"
        },
        healSpell:{
            id:"healSpell",tier:5,name:"治療術",element:"water",category:"heal",
            targetType:"allyTri",learnCost:16,maxLevel:5,upgradeCost:1,
            baseHeal:550,healPerLevel:30,baseHealSP:35,healSPPerLevel:0,spCost:45,
            cleanseAll:true,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需16技能點，對我方中、左、右最多3名存活目標恢復550 HP與固定35 SP，並解除所有可解除負面狀態；施放者本人可恢復HP及解除負面狀態，但不恢復自身SP。消耗45 SP，最高5級，每升1級消耗1技能點，HP恢復量+30。"
        },
        revive:{
            id:"revive",tier:6,name:"復活術",element:"water",category:"revive",
            targetType:"deadAlly",learnCost:18,maxLevel:5,upgradeCost:1,spCost:45,
            reviveHealPercentByLevel:[20,40,60,80,100],requires:["healSpell"],
            description:"需先學習治療術。初次學習需18技能點，選擇1名死亡友方原地復活，依等級恢復20%/40%/60%/80%/100%最大HP，消耗45 SP。復活後不額外恢復SP。最高5級，每升1級消耗1技能點。"
        },
        purifyMind:{
            id:"purifyMind",tier:5,name:"淨心訣",element:"water",category:"buff",
            targetType:"ally",learnCost:1,maxLevel:1,spCost:22,
            removeAllStates:true,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需1技能點，選擇1名友方目標，解除其身上所有增益與所有異常狀態，消耗22 SP，最高1級。"
        },
        waterEX:{
            id:"waterEX",tier:7,name:"水元素EX",element:"water",category:"passive",
            targetType:"none",learnCost:25,maxLevel:1,damageBonusPercent:5,healBonusPercent:10,
            turnStartCleanseChance:30,requires:[],
            description:"初次學習需25技能點，最大1級；永久提升水元素傷害5%、回復類技能HP恢復量10%，每回合開始前有30%機率解除自身所有可解除的負面狀態。"
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
            if(!skillDatabase[id]){ skillDatabase[id]={id:id}; }
            const skill=skillDatabase[id];
            const finalData=FINAL_SKILLS[id];
            if(!skill||!finalData){ return; }

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

    /* Frostbite is a three-stat soft debuff, never a skill lock.  Historical
       V149/V152 wrappers still exist for save compatibility; hide only the
       Frostbite entry while those old narrow seams execute, then restore it. */
    function withoutLegacyFrostbiteLock(entity,callback){
        if(!entity||!Array.isArray(entity.statusEffects)||!activeFrostbite(entity)){
            return callback();
        }
        const original=entity.statusEffects;
        entity.statusEffects=original.filter(effect=>!(effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0));
        try{ return callback(); }
        finally{ entity.statusEffects=original; }
    }

    function clearLegacyFrostbiteSkillLocks(){
        if(typeof document==="undefined"){ return; }
        const mainButton=document.querySelector&&document.querySelector("#mainBattleMenu > .menu-button.skill.v152-frostbite-blocked");
        if(mainButton){
            mainButton.disabled=false;
            mainButton.classList.remove("v152-frostbite-blocked");
            if(mainButton.dataset){ delete mainButton.dataset.v152FrostbiteBlocked; }
            mainButton.setAttribute("aria-label","技能");
        }
        if(document.querySelectorAll){
            document.querySelectorAll("#skillQuickBarGrid .skill-quick-button.v152-frostbite-blocked").forEach(button=>{
                button.disabled=false;
                button.classList.remove("v152-frostbite-blocked");
            });
        }
    }

    if(typeof window.prepareAction==="function"){
        const previousPrepareAction=window.prepareAction;
        window.prepareAction=function(){
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            const that=this,args=arguments;
            const result=withoutLegacyFrostbiteLock(character,()=>previousPrepareAction.apply(that,args));
            clearLegacyFrostbiteSkillLocks();
            return result;
        };
    }

    if(typeof window.resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedPlayerAction=window.resolveQueuedPlayerAction;
        window.resolveQueuedPlayerAction=function(characterIndex){
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const that=this,args=arguments;
            const result=withoutLegacyFrostbiteLock(character,()=>previousResolveQueuedPlayerAction.apply(that,args));
            clearLegacyFrostbiteSkillLocks();
            return result;
        };
    }

    if(typeof window.autoActionForCharacter==="function"){
        const previousAutoActionForCharacter=window.autoActionForCharacter;
        window.autoActionForCharacter=function(characterIndex){
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const that=this,args=arguments;
            return withoutLegacyFrostbiteLock(character,()=>previousAutoActionForCharacter.apply(that,args));
        };
    }

    if(typeof window.processSingleMonsterAttack==="function"){
        const previousProcessSingleMonsterAttack=window.processSingleMonsterAttack;
        window.processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const that=this,args=arguments;
            return withoutLegacyFrostbiteLock(monster,()=>previousProcessSingleMonsterAttack.apply(that,args));
        };
    }

    if(typeof window.updateUI==="function"){
        const previousUpdateUI=window.updateUI;
        window.updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            clearLegacyFrostbiteSkillLocks();
            return result;
        };
    }

    /* Damage -25%.  Different named outgoing-damage reductions coexist by
       multiplication, matching the shared status stacking rules. */
    if(typeof window.getOutgoingDamageDownPercent==="function"){
        const previousOutgoingDamageDown=window.getOutgoingDamageDownPercent;
        window.getOutgoingDamageDownPercent=function(attacker){
            const existing=Math.max(0,Math.min(100,numeric(previousOutgoingDamageDown.apply(this,arguments))));
            if(!activeFrostbite(attacker)){ return existing; }
            return Math.max(0,Math.min(100,100-(100-existing)*FROSTBITE_REMAINING_RATE));
        };
    }

    /* Evasion -25% for monsters and all three player stat owners. */
    if(typeof window.getMonsterEvasion==="function"){
        const previousMonsterEvasion=window.getMonsterEvasion;
        window.getMonsterEvasion=function(monster){
            const value=numeric(previousMonsterEvasion.apply(this,arguments));
            return activeFrostbite(monster)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }

    function wrapPlayerEvasionStats(functionName,characterGetter){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const stats=previous.apply(this,arguments);
            const character=characterGetter();
            if(!stats||!activeFrostbite(character)){ return stats; }
            return Object.assign({},stats,{evasion:numeric(stats.evasion)*FROSTBITE_REMAINING_RATE});
        };
    }
    wrapPlayerEvasionStats("getMainCharacterStats",()=>typeof player!=="undefined"?player:null);
    wrapPlayerEvasionStats("getPlayer2BattleStats",()=>typeof player2!=="undefined"?player2:null);
    wrapPlayerEvasionStats("getPlayer3BattleStats",()=>typeof player3!=="undefined"?player3:null);

    /* Status resistance -25%.  Spirit-derived and explicit player bonus
       resistance are reduced at their existing authoritative inputs. */
    if(typeof window.getMonsterEffectiveSpiritPoints==="function"){
        const previousMonsterSpirit=window.getMonsterEffectiveSpiritPoints;
        window.getMonsterEffectiveSpiritPoints=function(monster){
            const value=numeric(previousMonsterSpirit.apply(this,arguments));
            return activeFrostbite(monster)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }
    if(typeof window.getFinalBattleSpiritForPlayerTarget==="function"){
        const previousPlayerSpirit=window.getFinalBattleSpiritForPlayerTarget;
        window.getFinalBattleSpiritForPlayerTarget=function(target){
            const value=numeric(previousPlayerSpirit.apply(this,arguments));
            return activeFrostbite(target)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }
    if(typeof window.getPlayerStatusResistBonus==="function"){
        const previousPlayerResistBonus=window.getPlayerStatusResistBonus;
        window.getPlayerStatusResistBonus=function(target){
            const value=numeric(previousPlayerResistBonus.apply(this,arguments));
            return activeFrostbite(target)?value*FROSTBITE_REMAINING_RATE:value;
        };
    }

    /* V149's old application log mentioned a skill prohibition.  Keep the
       application itself and rewrite only that obsolete explanatory sentence. */
    if(typeof window.addBattleLog==="function"){
        const previousAddBattleLog=window.addBattleLog;
        window.addBattleLog=function(message){
            let text=String(message==null?"":message);
            if(text.includes("陷入凍傷")&&text.includes("無法使用技能")){
                text=text.replace(/，\d+回合內無法使用技能。/,"，期間傷害、閃避、異常狀態抗性降低25%。");
            }
            return previousAddBattleLog.call(this,text);
        };
    }

    clearLegacyFrostbiteSkillLocks();

    /* V158's compatibility resolver asks for tri. Freeze's final target truth is
       a front/back column of at most two valid targets. */
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
                Math.max(1,numeric(skill.frostbiteDuration)||1)+"回合（傷害-25%、閃避-25%、異常狀態抗性-25%）"
            );
        }
        if(numeric(skill.freezeChance)>0){
            parts.push(
                numeric(skill.freezeChance)+"%基礎機率冰封"+
                Math.max(1,numeric(skill.freezeDuration)||1)+"回合（完全無法行動）"
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
                (numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(lv-1))+" HP、固定35 SP並解除所有可解除負面狀態；施放者本人可恢復HP與解除負面，但不恢復自身SP";
        }
        if(skill&&skill.id==="revive"){
            return "使1名死亡友方原地復活並恢復最大HP的"+
                levelValue(skill.reviveHealPercentByLevel,lv)+"%；不恢復SP";
        }
        if(skill&&skill.id==="purifyMind"){
            return "解除1名友方目標身上所有增益與所有異常狀態";
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
            const scope={single:"單一敵人",tri:"同排最多3名有效敵人",column:"前後排同位置最多2名敵人",all:"敵方全體"}[skill.targetType]||"技能目標";
            const type=skill.id==="freeze"?"純控制":(skill.category==="physical"?"物理傷害":"法術傷害");
            const status=numeric(skill.frostbiteChance)>0
                ?"；可能使目標凍傷：傷害、閃避、異常抗性各降低25%"
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
        isFrostbitten:activeFrostbite,
        frostbitePenaltyPercent:25
    });
})();
