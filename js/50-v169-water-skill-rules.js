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
            targetType:"ally",enemyTargetAllowed:true,learnCost:1,maxLevel:1,spCost:22,
            removeAllStates:true,requires:["frostPunch","floodBeast"],
            description:"需先學習冰霜拳或洪水猛獸其一。初次學習需1技能點，可選擇1名我方或敵方目標；對我方解除所有增益與所有異常狀態，對敵方解除所有增益狀態（包含結界、護盾等），不會移除敵方負面狀態。消耗22 SP，最高1級。"
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
    if(typeof renderSkillLoadout==="function"){
        renderSkillLoadout();
    }
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){
        window.v173ApplyFormalDamageRoleProfiles(WATER_DAMAGE_SKILL_IDS);
    }

    /* Final Water/utility values load after the historical talisman sync. */
    if(typeof window.v132GetTalismanDefinition==="function"){
        ["Low","Mid","High","Perfect"].forEach(tier=>{
            const freezeTalisman=window.v132GetTalismanDefinition("freezeTalisman"+tier);
            if(freezeTalisman){
                freezeTalisman.sharedSkillId="freeze";
                freezeTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.freeze.maxLevel)||1);
                freezeTalisman.talismanDuration=numeric(skillDatabase.freeze.freezeDuration);
            }
            const stealthTalisman=window.v132GetTalismanDefinition("stealthTalisman"+tier);
            if(stealthTalisman){
                stealthTalisman.sharedSkillId="stealthSkill";
                stealthTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.stealthSkill.maxLevel)||1);
                stealthTalisman.talismanDuration=numeric(skillDatabase.stealthSkill.duration);
            }
            const barrierTalisman=window.v132GetTalismanDefinition("barrierTalisman"+tier);
            if(barrierTalisman){
                barrierTalisman.sharedSkillId="barrier";
                barrierTalisman.talismanSkillLevel=Math.max(1,numeric(skillDatabase.barrier.maxLevel)||1);
                barrierTalisman.talismanDuration=numeric(skillDatabase.barrier.duration);
                barrierTalisman.barrierBlockCount=numeric(skillDatabase.barrier.barrierBlockCount);
            }
        });
    }

    function hasStoredFrostbite(entity){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
        ));
    }

    function activeFrostbite(entity){ return hasStoredFrostbite(entity); }

    /* Damage -25%. Different named outgoing-damage reductions coexist by
       multiplication, matching the shared status stacking rules. */
    if(typeof window.getOutgoingDamageDownPercent==="function"){
        const previousOutgoingDamageDown=window.getOutgoingDamageDownPercent;
        window.getOutgoingDamageDownPercent=function(attacker){
            const existing=Math.max(0,Math.min(100,numeric(previousOutgoingDamageDown.apply(this,arguments))));
            if(!activeFrostbite(attacker)){ return existing; }
            return Math.max(0,Math.min(100,100-(100-existing)*FROSTBITE_REMAINING_RATE));
        };
    }

    /*
       Frostbite 的傷害降低仍由 Water Runtime 負責。
       閃躲與異常抗性已改成「最終百分點 -25」並收斂到
       js/00-main.js 的正式 Evasion / Status Resistance Owner，
       本層不再 wrapper getMonsterEvasion、玩家 stats、Spirit 或 Log。
    */

    window.v169WaterSkillRules=Object.freeze({
        version:VERSION,
        skillIds:WATER_SKILL_IDS.slice(),
        isFrostbitten:activeFrostbite,
        frostbitePenaltyPercent:25
    });
})();
