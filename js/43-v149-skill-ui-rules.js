/* =====================================================
   V149 — final four-element rules, shop alignment and combat feedback
===================================================== */
(function installV149SkillUiRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v149SkillUiRulesInstalled){ return; }
    window.__v149SkillUiRulesInstalled=true;

    const VERSION="149";
    const BUFF_CONFLICTS={
        barrier:["earthShield","stealthSkill","dodgeSkill"],
        earthShield:["barrier"],
        stealthSkill:["barrier"],
        dodgeSkill:["barrier"]
    };

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function copyValue(value){ return Array.isArray(value)?value.slice():value; }

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        Object.keys(fields).forEach(key=>{ skillDatabase[id][key]=copyValue(fields[key]); });
    }

    const SKILLS={
        flameSlash:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:17,damagePerLevel:10,spCost:8,
            description:"初次學習需2技能點。對單體造成17點傷害，消耗8 SP；最高5級，每升1級傷害+10。"
        },
        fireCritical:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:39,damagePerLevel:13,spCost:15,
            requires:["flameSlash"],description:"需先學習火焰斬。對單體造成39點傷害，消耗15 SP；最高5級，每升1級傷害+13。"
        },
        explosiveFlurry:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:35,damagePerLevel:15,spCost:22,
            requires:["fireCritical"],description:"需先學習會心一擊。對同排中、左、右最多3名目標各造成35點傷害，消耗22 SP；最高5級，每升1級傷害+15。"
        },
        dragonSlash:{
            learnCost:45,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:145,damagePerLevel:25,spCost:65,
            repeatChance:33,repeatMaxCasts:1,requires:["explosiveFlurry"],
            description:"需先學習火爆亂擊。對單體造成145點傷害，消耗65 SP，並有33%機率免費再施放1次；最高5級，每升1級傷害+25。"
        },
        fireRocket:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:17,damagePerLevel:8,spCost:8,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成17點傷害，消耗8 SP；最高5級，每升1級傷害+8。"
        },
        blazeSpell:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:42,damagePerLevel:15,spCost:15,
            requires:["fireRocket"],description:"需先學習火箭。對單體造成42點傷害，消耗15 SP；最高5級，每升1級傷害+15。"
        },
        flameTornado:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:135,damagePerLevel:13,spCost:55,
            burnChance:30,burnDuration:2,burnPercentByLevel:[3,4,5,6,8],requires:["blazeSpell"],
            description:"需先學習烈火術。對單一目標造成135點傷害，消耗55 SP；最高5級，每升1級傷害+13。30%基礎機率燃燒2回合，每回合造成目標最大HP的3%/4%/5%/6%/8%傷害。"
        },
        phoenixCry:{
            learnCost:45,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:58,damagePerLevel:18,spCost:68,
            burnChance:70,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],requires:["flameTornado"],
            description:"需先學習烈焰龍捲。對敵方全體各造成58點傷害，消耗68 SP；最高5級，每升1級傷害+18。70%基礎機率燃燒2回合，每回合造成目標最大HP的5%/7%/9%/11%/13%傷害。"
        },
        rage:{
            learnCost:25,maxLevel:5,upgradeCost:1,targetType:"allyTri",spCost:50,duration:2,
            critBonusByLevel:[5,10,15,20,25],critChanceBonusByLevel:[5,10,15,20,25],
            critDamageBonusByLevel:[10,20,30,40,50],requires:["explosiveFlurry","flameTornado"],
            description:"需先學習火爆亂擊或烈焰龍捲其一。提高我方同排中、左、右最多3人的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續2回合，消耗50 SP。"
        },
        fireEX:{
            learnCost:25,maxLevel:1,targetType:"none",damageBonusPercent:10,critChanceBonusPercent:5,critDamageBonusPercent:5,
            statusTargetDamageBonusPercent:5,
            description:"永久提升火元素傷害10%、爆擊率5%、爆擊傷害5%；對有異常狀態的目標傷害再提升5%。"
        },

        waterKnife:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:13,damagePerLevel:3,spCost:6,
            lifestealPercentByLevel:[4,5,6,7,8],description:"初次學習需2技能點。對單體造成13點傷害，消耗6 SP；最高5級，每升1級傷害+3，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。"
        },
        frostPunch:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:30,damagePerLevel:8,spCost:17,
            lifestealPercentByLevel:[4,5,6,7,8],requires:["waterKnife"],description:"需先學習水刀斬。對單體造成30點傷害，消耗17 SP；最高5級，每升1級傷害+8，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。"
        },
        iceSpin:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:25,damagePerLevel:7,spCost:20,
            freezeChance:0,frostbiteChance:60,frostbiteDuration:2,lifestealPercentByLevel:[3,4,5,6,7],requires:["frostPunch"],
            description:"需先學習冰霜拳。對同排中、左、右最多3名目標各造成25點傷害，消耗20 SP；最高5級，每升1級傷害+7，並吸取實際傷害的3%/4%/5%/6%/7%恢復自身HP。每個命中目標有60%基礎機率凍傷2回合；凍傷只禁止技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。"
        },
        frostCrush:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:100,damagePerLevel:15,spCost:50,
            freezeChance:0,frostbiteChance:50,frostbiteDuration:2,lifestealPercentByLevel:[4,5,6,7,8],requires:["iceSpin"],
            description:"需先學習冰旋一閃。對單體造成100點傷害，消耗50 SP；最高5級，每升1級傷害+15，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。50%基礎機率凍傷2回合；凍傷只禁止技能，仍可使用補品、符咒、普通攻擊、防禦與逃脫。"
        },
        waterBall:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:17,damagePerLevel:3,spCost:8,
            lifestealPercentByLevel:[3,4,5,6,7],description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成17點傷害，消耗8 SP；最高5級，每升1級傷害+3，並吸取實際傷害的3%/4%/5%/6%/7%恢復自身HP。"
        },
        floodBeast:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:85,damagePerLevel:8,spCost:15,
            freezeChance:0,teamFreezeChance:55,teamFreezeDuration:2,lifestealPercentByLevel:[4,5,6,7,8],requires:["waterBall"],
            description:"需先學習水球術。對單體造成85點傷害，消耗15 SP；最高5級，每升1級傷害+8，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。技能命中後，敵方每個存活目標各有55%基礎機率冰封2回合。"
        },
        iceArrowRain:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:30,damagePerLevel:12,spCost:75,
            freezeChance:40,freezeDuration:2,freezeSingleTarget:false,lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],
            description:"需先學習洪水猛獸。對敵方全體各造成30點傷害，消耗75 SP；最高5級，每升1級傷害+12，並吸取實際傷害的1%/2%/3%/4%/5%恢復自身HP。每個命中目標各有40%基礎機率冰封2回合。"
        },
        freeze:{
            learnCost:25,maxLevel:1,targetType:"single",spCost:22,freezeChance:80,freezeDuration:4,requires:["iceArrowRain"],
            description:"需先學習冰霜箭雨。80%基礎機率冰封單一目標，使其無法行動4回合，消耗22 SP；不造成傷害。"
        },
        healSpell:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"allyAll",baseHeal:350,healPerLevel:30,
            baseHealSP:35,healSPPerLevel:30,spCost:40,requires:["iceArrowRain","iceSpin"],
            description:"需先學習冰霜箭雨或冰旋一閃其一。對我方全體恢復350 HP與35 SP，消耗40 SP；最高5級，每升1級HP與SP恢復量各+30。施放者本人不恢復SP。"
        },
        revive:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"deadAlly",spCost:45,reviveHealPercentByLevel:[20,40,60,80,100],requires:["healSpell"],
            description:"需先學習治療術。選擇1名友方死亡目標原地復活，依等級恢復20%/40%/60%/80%/100%最大HP，消耗45 SP。"
        },
        waterEX:{
            learnCost:25,maxLevel:1,targetType:"none",damageBonusPercent:5,healBonusPercent:10,statusResistBonus:10,
            description:"永久提升水元素傷害5%、回復系技能回復量10%、異常狀態抗性10%。"
        },

        stormFist:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:14,damagePerLevel:2,spCost:7,
            agilityDownChance:50,agilityDownByLevel:[30,40,50,60,70],agilityDownDuration:1,
            description:"初次學習需2技能點。對單體造成14點傷害，消耗7 SP；最高5級，每升1級傷害+2。50%基礎機率降低目標敏捷30%/40%/50%/60%/70%，持續1回合。"
        },
        stormFlurry:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:28,damagePerLevel:7,spCost:20,
            damageDownChance:50,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1,requires:["stormFist"],
            description:"需先學習暴風拳。對同排中、左、右最多3名目標各造成28點傷害，消耗20 SP；最高5級，每升1級傷害+7。50%基礎機率降低目標造成的傷害15%/18%/21%/25%/30%，持續1回合。"
        },
        windCrossSlash:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:90,damagePerLevel:12,spCost:39,
            damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1,requires:["stormFlurry"],
            description:"需先學習暴風亂擊。對單體造成90點傷害，消耗39 SP；最高5級，每升1級傷害+12。65%基礎機率降低目標造成的傷害15%/20%/25%/30%/35%，持續1回合。"
        },
        dizzyFist:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:120,damagePerLevel:15,spCost:55,
            stunChance:65,missBonusByLevel:[10,20,30,40,50],stunDuration:2,requires:["stormFlurry"],
            description:"需先學習暴風亂擊。對單體造成120點傷害，消耗55 SP；最高5級，每升1級傷害+15。65%基礎機率暈眩2回合，使目標命中率降低10%/20%/30%/40%/50%。"
        },
        windSpell:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:18,damagePerLevel:2,spCost:9,
            agilityDownChance:50,agilityDownByLevel:[10,20,30,40,50],agilityDownDuration:1,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成18點傷害，消耗9 SP；最高5級，每升1級傷害+2。50%基礎機率降低目標敏捷10%/20%/30%/40%/50%，持續1回合。"
        },
        stormCircle:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"row",baseDamage:38,damagePerLevel:9,spCost:18,
            damageDownChance:55,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1,requires:["windSpell"],
            description:"需先學習狂風術。對敵方任一橫排各造成38點傷害，消耗18 SP；最高5級，每升1級傷害+9。55%基礎機率降低目標造成的傷害15%/18%/21%/25%/30%，持續1回合。"
        },
        windHowlLightning:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:98,damagePerLevel:15,spCost:55,
            damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1,requires:["stormCircle"],
            description:"需先學習風焰術。對單體造成98點傷害，消耗55 SP；最高5級，每升1級傷害+15。65%基礎機率降低目標造成的傷害15%/20%/25%/30%/35%，持續1回合。"
        },
        stormRain:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:48,damagePerLevel:14,spCost:75,
            stunChance:35,missBonusByLevel:[30,45,50,55,65],stunDuration:1,requires:["windHowlLightning"],
            description:"需先學習風哮電擊。對敵方全體各造成48點傷害，消耗75 SP；最高5級，每升1級傷害+14。35%基礎機率暈眩1回合，使目標MISS率提高30%/45%/50%/55%/65%。"
        },
        dodgeSkill:{
            learnCost:10,maxLevel:1,targetType:"allyAll",spCost:20,duration:2,evasionBonusPercent:60,
            requires:["windCrossSlash","windHowlLightning"],description:"需先學習風旋十字斬或風哮電擊其一。使我方全體閃躲率提升60%，持續2回合，消耗20 SP。"
        },
        stealthSkill:{
            learnCost:15,maxLevel:1,targetType:"ally",spCost:45,duration:2,requires:["dodgeSkill"],
            description:"需先學習閃躲術。使單一友方隱身2回合，期間無法被單體技能選中，但仍會受到範圍技能波及，消耗45 SP。"
        },
        dinghaishenzhen:{
            learnCost:20,maxLevel:1,targetType:"allyAll",spCost:77,duration:3,statusResistBonus:45,accuracyBonusPercent:50,
            requires:["stealthSkill"],description:"需先學習隱身術。使我方全體異常狀態抗性提升45%、命中提升50%，持續3回合，消耗77 SP。"
        },
        windEX:{
            learnCost:25,maxLevel:1,targetType:"none",evasionBonusPercent:25,description:"永久提升風元素角色的閃躲率25%。"
        },

        stoneSlash:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:14,damagePerLevel:2,spCost:7,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,
            description:"初次學習需2技能點。對單體造成14點傷害，消耗7 SP；最高5級，每升1級傷害+2。65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。"
        },
        petrifyFist:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:28,damagePerLevel:7,spCost:26,
            allyShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["stoneSlash"],
            description:"需先學習土石斬。對同排中、左、右最多3名目標各造成28點傷害，消耗26 SP；最高5級，每升1級傷害+7，並使我方全體獲得100/125/150/175/200點護盾2回合。"
        },
        stoneBreakSky:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:65,damagePerLevel:9,spCost:42,
            allyShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["petrifyFist"],
            description:"需先學習石盾拳。對單體造成65點傷害，消耗42 SP；最高5級，每升1級傷害+9，並使我方全體獲得100/125/150/175/200點護盾2回合。"
        },
        earthquakeCrush:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:48,damagePerLevel:14,spCost:55,
            selfShieldByLevel:[100,150,200,250,300],shieldDuration:2,requires:["stoneBreakSky"],
            description:"需先學習石破天驚。對同排中、左、右最多3名目標各造成48點傷害，消耗55 SP；最高5級，每升1級傷害+14，並使自身獲得100/150/200/250/300點護盾2回合。"
        },
        stoneThrow:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:14,damagePerLevel:2,spCost:7,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成14點傷害，消耗7 SP；最高5級，每升1級傷害+2。65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。"
        },
        sandWind:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"row",baseDamage:17,damagePerLevel:5,spCost:19,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,requires:["stoneThrow"],
            description:"需先學習落石術。對敵方任一橫排各造成17點傷害，消耗19 SP；最高5級，每升1級傷害+5。65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。"
        },
        flyingSandStrike:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:35,damagePerLevel:8,spCost:26,
            petrifyChanceByLevel:[25,35,45,55,65],petrifyDuration:2,requires:["sandWind"],
            description:"需先學習滾石術。對敵方全體各造成35點傷害，消耗26 SP；最高5級，每升1級傷害+8。依等級25%/35%/45%/55%/65%基礎機率石化目標2回合，使其無法行動。"
        },
        dustStorm:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:98,damagePerLevel:15,spCost:55,
            defenseDownChance:60,defenseDownByLevel:[10,15,20,25,35],defenseDownDuration:1,requires:["flyingSandStrike"],
            description:"需先學習飛沙瞬擊。對單體造成98點傷害，消耗55 SP；最高5級，每升1級傷害+15。60%基礎機率降低目標防禦10%/15%/20%/25%/35%，持續1回合。"
        },
        earthShield:{
            learnCost:10,maxLevel:1,targetType:"allyAll",spCost:66,duration:3,reflectPercent:50,
            requires:["stoneBreakSky","flyingSandStrike"],description:"需先學習石破天驚或飛沙瞬擊其一。使我方全體獲得50%反傷土盾，受到傷害時將實際傷害的50%反彈給攻擊者，持續3回合，消耗66 SP。"
        },
        rockWall:{
            learnCost:15,maxLevel:1,targetType:"allyAll",spCost:45,duration:4,defenseBonusPercent:30,requires:["barrier"],
            description:"需先學習結界。使我方全體防禦力提升30%，持續4回合，消耗45 SP。"
        },
        barrier:{
            learnCost:20,maxLevel:1,targetType:"ally",spCost:40,duration:5,barrierBlockCount:5,requires:["earthShield"],
            description:"需先學習萬象土盾。使我方1人獲得結界，完全抵擋接下來5次直接傷害，最多存在5回合；燃燒、毒等持續傷害不抵擋且不消耗次數，消耗40 SP。"
        },
        earthEX:{
            learnCost:25,maxLevel:1,targetType:"none",defenseBonusPercent:25,description:"永久提升土元素角色的防禦力25%。"
        }
    };

    Object.keys(SKILLS).forEach(id=>patchSkill(id,SKILLS[id]));

    /* ----- Status rules: Frostbite blocks skills only. ----- */
    function activeStatus(entity,type){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type===type&&numeric(effect.turnsLeft)>0
        ));
    }

    function activeBuff(entity,type){
        return !!(entity&&Array.isArray(entity.activeBuffs)&&entity.activeBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function partyIndexes(){
        if(typeof getExistingPartyIndexes==="function"){
            return getExistingPartyIndexes().filter(index=>Number.isInteger(index));
        }
        return [0,1,2].filter(index=>typeof getPartyCharacterByIndex==="function"&&getPartyCharacterByIndex(index));
    }

    function livingPartyIndexes(){
        return partyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return character&&numeric(character.hp)>0;
        });
    }

    function livingMonsterIndexes(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.filter(index=>{
            const monster=monsters[index];
            return monster&&monster.alive!==false&&numeric(monster.hp)>0;
        });
    }

    function applyFrostbite(entity,duration){
        if(!entity){ return; }
        if(typeof applyMonsterDebuff==="function"){
            applyMonsterDebuff(entity,"frostbite",Math.max(1,numeric(duration)||2),0);
            return;
        }
        entity.statusEffects=entity.statusEffects||[];
        const existing=entity.statusEffects.find(effect=>effect&&effect.type==="frostbite");
        if(existing){ existing.turnsLeft=Math.max(existing.turnsLeft||0,duration||2); }
        else{ entity.statusEffects.push({type:"frostbite",turnsLeft:duration||2,value:0}); }
    }

    function playFrostbiteEffect(side,index){
        if(typeof window.v141PlayCardEffect==="function"){
            window.v141PlayCardEffect(side,index,"freeze");
        }
    }

    if(typeof applySkillDebuffEffects==="function"){
        const previousApplySkillDebuffs=applySkillDebuffEffects;
        applySkillDebuffEffects=function(skill,level,monster,index,casterLevel,casterIntelligence){
            const result=previousApplySkillDebuffs.apply(this,arguments);
            if(!skill||!numeric(skill.frostbiteChance)||!monster||!monster.alive){ return result; }
            const hit=typeof rollStatusEffectHit==="function"&&rollStatusEffectHit(
                skill.frostbiteChance,casterLevel,monster.level,casterIntelligence,
                typeof getMonsterEffectiveSpiritPoints==="function"?getMonsterEffectiveSpiritPoints(monster):numeric(monster.spiritPoints),
                false,typeof getMonsterRank==="function"?getMonsterRank(monster):"regular"
            );
            if(hit){
                const duration=skill.frostbiteDuration||2;
                applyFrostbite(monster,duration);
                playFrostbiteEffect("monster",index);
                if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"陷入凍傷，"+duration+"回合內無法使用技能。"); }
            }else if(typeof addBattleLog==="function"){
                addBattleLog("（凍傷效果被"+monster.name+"抵抗了）");
            }
            return result;
        };
    }

    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previousApplySkillDebuffsToPlayer=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index,casterLevel,casterIntelligence){
            const result=previousApplySkillDebuffsToPlayer.apply(this,arguments);
            if(!skill||!numeric(skill.frostbiteChance)||!target||numeric(target.hp)<=0){ return result; }
            const spirit=typeof getFinalBattleSpiritForPlayerTarget==="function"
                ?getFinalBattleSpiritForPlayerTarget(target,index):numeric(target.spirit);
            const resist=typeof getPlayerStatusResistBonus==="function"?getPlayerStatusResistBonus(target):0;
            const hit=typeof rollStatusEffectHit==="function"&&rollStatusEffectHit(
                skill.frostbiteChance,casterLevel,target.level,casterIntelligence,spirit,false,"regular",resist
            );
            if(hit){
                const duration=skill.frostbiteDuration||2;
                applyFrostbite(target,duration);
                playFrostbiteEffect("player",index);
                if(typeof addBattleLog==="function"){ addBattleLog((target.id||"角色")+"陷入凍傷，"+duration+"回合內無法使用技能。"); }
            }else if(typeof addBattleLog==="function"){
                addBattleLog("（凍傷效果被"+(target.id||"角色")+"抵抗了）");
            }
            return result;
        };
    }

    function tickFrostbite(entity,label){
        if(!entity||!Array.isArray(entity.statusEffects)){ return; }
        entity.statusEffects=entity.statusEffects.filter(effect=>{
            if(!effect||effect.type!=="frostbite"){ return true; }
            effect.turnsLeft=numeric(effect.turnsLeft)-1;
            if(effect.turnsLeft<=0&&typeof addBattleLog==="function"){
                addBattleLog(label+"的凍傷效果已解除。");
            }
            return effect.turnsLeft>0;
        });
    }

    if(typeof tickStatusEffects==="function"){
        const previousTickStatusEffects=tickStatusEffects;
        tickStatusEffects=function(){
            const result=previousTickStatusEffects.apply(this,arguments);
            livingMonsterIndexes().forEach(index=>tickFrostbite(monsters[index],monsters[index].name));
            partyIndexes().forEach(index=>{
                const character=getPartyCharacterByIndex(index);
                if(character&&numeric(character.hp)>0){ tickFrostbite(character,character.id||"角色"); }
            });
            return result;
        };
    }

    function rejectFrostbittenSkill(character,index,skill,consumeTurn){
        if(!skill||!activeStatus(character,"frostbite")){ return false; }
        if(typeof showMissEffect==="function"){ showMissEffect(true,index,"MISS"); }
        if(typeof addBattleLog==="function"){
            addBattleLog((character.id||"角色")+"處於凍傷狀態，無法使用"+skill.name+"。可改用普通攻擊、補品、符咒、防禦或逃脫。");
        }
        if(consumeTurn&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof prepareAction==="function"){
        const previousPrepareAction=prepareAction;
        prepareAction=function(type){
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[type]:null;
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            if(skill&&rejectFrostbittenSkill(character,index,skill,false)){ return; }
            return previousPrepareAction.apply(this,arguments);
        };
    }

    /* ----- Buff incompatibility: reject before SP is spent. ----- */
    function conflictingBuffTypes(skillId){ return BUFF_CONFLICTS[skillId]||[]; }

    function requestedBuffIndexes(skill,targetIndex,casterIndex){
        if(!skill){ return []; }
        if(skill.targetType==="allyAll"||skill.targetType==="allyTri"){ return livingPartyIndexes(); }
        const selected=Number.isInteger(targetIndex)?targetIndex:casterIndex;
        const target=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(selected):null;
        return target&&numeric(target.hp)>0?[selected]:[];
    }

    function buffConflictTargets(skill,targetIndex,casterIndex){
        const types=skill?conflictingBuffTypes(skill.id):[];
        if(!types.length){ return []; }
        return requestedBuffIndexes(skill,targetIndex,casterIndex).filter(index=>{
            const target=getPartyCharacterByIndex(index);
            return types.some(type=>activeBuff(target,type));
        });
    }

    function rejectBuffConflict(skill,targetIndex,casterIndex,consumeTurn){
        const conflicts=buffConflictTargets(skill,targetIndex,casterIndex);
        if(!conflicts.length){ return false; }
        conflicts.forEach(index=>{
            if(typeof showMissEffect==="function"){ showMissEffect(true,index,"MISS"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog(skill.name+"與目標現有的結界／萬象土盾／隱身／閃躲效果不能並存，MISS。");
        }
        if(consumeTurn&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            const skill=queued&&typeof skillDatabase!=="undefined"?skillDatabase[queued.action]:null;
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            if(skill&&rejectFrostbittenSkill(character,characterIndex,skill,true)){ return; }
            if(skill&&skill.category==="buff"&&rejectBuffConflict(skill,queued.targetAlly,characterIndex,true)){ return; }
            return previousResolveQueuedAction.apply(this,arguments);
        };
    }

    if(typeof castBuffSkill==="function"){
        const previousCastBuffSkill=castBuffSkill;
        castBuffSkill=function(skillId,targetIndex){
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            const casterIndex=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            if(skill&&rejectBuffConflict(skill,targetIndex,casterIndex,true)){ return; }
            return previousCastBuffSkill.apply(this,arguments);
        };
    }

    if(typeof autoActionForCharacter==="function"){
        const previousAutoAction=autoActionForCharacter;
        autoActionForCharacter=function(characterIndex){
            const result=previousAutoAction.apply(this,arguments);
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            if(character&&activeStatus(character,"frostbite")&&queued&&skillDatabase[queued.action]){
                queued.action="normal";
                if(typeof addBattleLog==="function"){
                    addBattleLog((character.id||"角色")+"處於凍傷狀態，自動戰鬥已改用普通攻擊。");
                }
            }
            return result;
        };
    }

    /* ----- Player skill context: Fire EX and Flood Beast team Freeze. ----- */
    let playerSkillContext=null;

    function wrapPlayerSkillContext(name,skillArgIndex,characterIndexFromArgs){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=arguments;
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[args[skillArgIndex]]:null;
            const characterIndex=characterIndexFromArgs(args);
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const previousContext=playerSkillContext;
            playerSkillContext={skill:skill,character:character,characterIndex:characterIndex,teamFreezeApplied:false};
            try{ return previous.apply(this,args); }
            finally{ playerSkillContext=previousContext; }
        };
    }

    wrapPlayerSkillContext("castDamageSkill",0,()=>0);
    wrapPlayerSkillContext("castSecondaryCharacterSkill",1,args=>Number(args[0])||0);
    wrapPlayerSkillContext("castPlayer2Skill",0,()=>1);

    function learnedFireEX(context){
        if(!context||!context.character||context.character.element!=="fire"){ return false; }
        if(typeof getSkillLevel!=="function"){ return false; }
        const key=typeof getPartyCharacterKey==="function"
            ?getPartyCharacterKey(context.characterIndex)
            :(context.characterIndex===0?"fire":"player"+(context.characterIndex+1));
        return numeric(getSkillLevel(key,"fireEX"))>0;
    }

    if(typeof calculateSkillDamage==="function"){
        const previousCalculateSkillDamage=calculateSkillDamage;
        calculateSkillDamage=function(baseDamage,statBonus,target){
            let result=previousCalculateSkillDamage.apply(this,arguments);
            const bonus=skillDatabase.fireEX&&numeric(skillDatabase.fireEX.statusTargetDamageBonusPercent);
            if(result>0&&bonus>0&&learnedFireEX(playerSkillContext)&&target&&Array.isArray(target.statusEffects)&&
                target.statusEffects.some(effect=>effect&&numeric(effect.turnsLeft)>0)){
                result=Math.floor(result*(1+bonus/100));
            }
            return result;
        };
    }

    function applyTeamFreezeToMonsters(skill,casterLevel,casterIntelligence){
        livingMonsterIndexes().forEach(index=>{
            const monster=monsters[index];
            const hit=typeof rollStatusEffectHit==="function"&&rollStatusEffectHit(
                skill.teamFreezeChance,casterLevel,monster.level,casterIntelligence,
                typeof getMonsterEffectiveSpiritPoints==="function"?getMonsterEffectiveSpiritPoints(monster):numeric(monster.spiritPoints),
                true,typeof getMonsterRank==="function"?getMonsterRank(monster):"regular"
            );
            if(hit){
                if(typeof applyFreezeEffect==="function"){ applyFreezeEffect(monster,skill.teamFreezeDuration||2); }
                if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"被冰封了！"); }
            }else{
                if(typeof showMissEffect==="function"){ showMissEffect(false,index,"抵抗"); }
                if(typeof addBattleLog==="function"){ addBattleLog("（冰封效果被"+monster.name+"抵抗了）"); }
            }
        });
    }

    function applyTeamFreezeToPlayers(skill,casterLevel,casterIntelligence){
        livingPartyIndexes().forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            const spirit=typeof getFinalBattleSpiritForPlayerTarget==="function"
                ?getFinalBattleSpiritForPlayerTarget(target,index):numeric(target.spirit);
            const resist=typeof getPlayerStatusResistBonus==="function"?getPlayerStatusResistBonus(target):0;
            const hit=typeof rollStatusEffectHit==="function"&&rollStatusEffectHit(
                skill.teamFreezeChance,casterLevel,target.level,casterIntelligence,spirit,true,"regular",resist
            );
            if(hit){
                if(typeof applyFreezeEffect==="function"){ applyFreezeEffect(target,skill.teamFreezeDuration||2); }
                if(typeof addBattleLog==="function"){ addBattleLog((target.id||"角色")+"被冰封了！"); }
            }else{
                if(typeof showMissEffect==="function"){ showMissEffect(true,index,"抵抗"); }
                if(typeof addBattleLog==="function"){ addBattleLog("（冰封效果被"+(target.id||"角色")+"抵抗了）"); }
            }
        });
    }

    if(typeof applySkillDebuffEffects==="function"){
        const previousForTeamFreeze=applySkillDebuffEffects;
        applySkillDebuffEffects=function(skill,level,monster,index,casterLevel,casterIntelligence){
            const result=previousForTeamFreeze.apply(this,arguments);
            if(skill&&numeric(skill.teamFreezeChance)&&playerSkillContext&&!playerSkillContext.teamFreezeApplied){
                playerSkillContext.teamFreezeApplied=true;
                applyTeamFreezeToMonsters(skill,casterLevel,casterIntelligence);
            }
            return result;
        };
    }

    let monsterTeamFreezeApplied=false;
    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previousForMonsterTeamFreeze=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index,casterLevel,casterIntelligence){
            const result=previousForMonsterTeamFreeze.apply(this,arguments);
            if(skill&&numeric(skill.teamFreezeChance)&&!monsterTeamFreezeApplied){
                monsterTeamFreezeApplied=true;
                applyTeamFreezeToPlayers(skill,casterLevel,casterIntelligence);
            }
            return result;
        };
    }

    /* ----- Dragon Slash can add one cast, then one conditional final cast. ----- */
    function firstLivingMonsterIndex(){
        const indexes=livingMonsterIndexes();
        return indexes.length?indexes[0]:null;
    }

    function preferredLivingMonsterIndex(preferred){
        return Number.isInteger(preferred)&&livingMonsterIndexes().includes(preferred)
            ?preferred:firstLivingMonsterIndex();
    }

    function scheduleAfterAnimation(callback){
        const gate=window.v142SkillAnimationDirector&&window.v142SkillAnimationDirector.getActive
            ?window.v142SkillAnimationDirector.getActive():null;
        if(gate&&gate.promise&&!gate.done){ gate.promise.then(callback); }
        else{ setTimeout(callback,0); }
    }

    function runPlayerDragonRepeat(options,allowConditionalRepeat){
        scheduleAfterAnimation(()=>{
            const nextTarget=preferredLivingMonsterIndex(options.originalTarget);
            if(nextTarget===null||typeof battleActive!=="undefined"&&!battleActive){
                if(options.realFinish){ options.realFinish(); }
                return;
            }

            const repeatArgs=options.args.slice();
            if(Number.isInteger(options.centerArgIndex)){ repeatArgs[options.centerArgIndex]=nextTarget; }
            if(typeof selectedMonster!=="undefined"){ selectedMonster=nextTarget; }
            const target=typeof monsters!=="undefined"?monsters[nextTarget]:null;
            const targetWasAlive=!!(target&&target.alive!==false&&numeric(target.hp)>0);
            const originalCost=options.skill.spCost;
            const originalPopup=typeof showPlayerSpPopup==="function"?showPlayerSpPopup:null;
            const originalRoll=typeof rollCritical==="function"?rollCritical:null;
            let finishRequested=false;
            let repeatedCritical=false;
            let failed=false;

            options.skill.spCost=0;
            if(options.realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
            if(originalPopup){ showPlayerSpPopup=function(){}; }
            if(originalRoll){
                rollCritical=function(){
                    const result=originalRoll.apply(this,arguments);
                    if(result&&result.isCrit){ repeatedCritical=true; }
                    return result;
                };
            }
            try{ options.previous.apply(options.that,repeatArgs); }
            catch(error){
                failed=true;
                console.error("霸龍裂天斬再施放失敗：",error);
            }
            finally{
                options.skill.spCost=originalCost;
                if(options.realFinish){ finishPlayerAction=options.realFinish; }
                if(originalPopup){ showPlayerSpPopup=originalPopup; }
                if(originalRoll){ rollCritical=originalRoll; }
            }

            if(failed){
                if(options.realFinish){ options.realFinish(); }
                return;
            }
            const defeatedTarget=targetWasAlive&&(!target||target.alive===false||numeric(target.hp)<=0);
            if(
                finishRequested&&allowConditionalRepeat&&(repeatedCritical||defeatedTarget)&&
                preferredLivingMonsterIndex(options.originalTarget)!==null
            ){
                if(typeof addBattleLog==="function"){
                    addBattleLog("霸龍裂天斬追加攻擊出現爆擊或擊敗目標，再追加一次！");
                }
                runPlayerDragonRepeat(options,false);
                return;
            }
            if(finishRequested&&options.realFinish){ options.realFinish(); }
        });
    }

    function wrapDragonRepeat(name,skillArgIndex,centerArgIndex,casterFromArgs){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[args[skillArgIndex]]:null;
            if(!skill||skill.id!=="dragonSlash"){ return previous.apply(this,args); }
            const originalTarget=Number.isInteger(centerArgIndex)&&Number.isInteger(args[centerArgIndex])
                ?args[centerArgIndex]
                :(typeof selectedMonster!=="undefined"&&Number.isInteger(selectedMonster)?selectedMonster:null);
            const caster=casterFromArgs(args);
            const beforeSp=numeric(caster&&caster.sp);
            const realFinish=typeof finishPlayerAction==="function"?finishPlayerAction:null;
            let finishRequested=false;
            if(realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
            let result;
            try{ result=previous.apply(this,args); }
            finally{ if(realFinish){ finishPlayerAction=realFinish; } }
            const spent=beforeSp-numeric(caster&&caster.sp)>=numeric(skill.spCost);
            const target=preferredLivingMonsterIndex(originalTarget);
            const repeat=finishRequested&&spent&&target!==null&&Math.random()*100<numeric(skill.repeatChance);
            if(!repeat){
                if(finishRequested&&realFinish){ realFinish(); }
                return result;
            }
            if(typeof addBattleLog==="function"){ addBattleLog("霸龍裂天斬觸發再施放！"); }
            runPlayerDragonRepeat({
                previous:previous,that:this,args:args,skill:skill,
                centerArgIndex:centerArgIndex,originalTarget:originalTarget,realFinish:realFinish
            },true);
            return result;
        };
    }

    wrapDragonRepeat("castDamageSkill",0,null,()=>typeof player!=="undefined"?player:null);
    wrapDragonRepeat("castSecondaryCharacterSkill",1,2,args=>typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(Number(args[0])||0):null);
    wrapDragonRepeat("castPlayer2Skill",0,1,()=>typeof player2!=="undefined"?player2:null);

    /* ----- Barrier corners, revived brightness and rank colours. ----- */
    function barrierState(entity){
        const buff=entity&&Array.isArray(entity.activeBuffs)?entity.activeBuffs.find(item=>
            item&&item.type==="barrier"&&numeric(item.turnsLeft)>0&&numeric(item.remainingBlocks)>0
        ):null;
        if(buff){ return buff; }
        const shield=entity&&entity.v141Shield;
        return shield&&shield.isBarrier&&numeric(shield.turnsLeft)>0&&numeric(shield.remainingBlocks)>0?shield:null;
    }

    function syncBarrierCard(card,entity){
        if(!card){ return; }
        const barrier=barrierState(entity);
        card.classList.toggle("v149-has-barrier",!!barrier);
        let layer=card.querySelector(":scope > .v141-card-effects");
        if(!layer&&barrier){
            layer=document.createElement("div");
            layer.className="v141-card-effects";
            layer.setAttribute("aria-hidden","true");
            card.appendChild(layer);
        }
        if(!layer){ return; }
        layer.querySelectorAll(":scope > .v141-effect-barrier").forEach(node=>node.remove());
        let effect=layer.querySelector(":scope > .v149-barrier-corners");
        if(!barrier){ if(effect){ effect.remove(); } return; }
        const count=Math.max(0,Math.floor(numeric(barrier.remainingBlocks)));
        if(!effect){
            effect=document.createElement("span");
            effect.className="v149-barrier-corners";
            effect.innerHTML="<i></i><i></i><i></i><i></i>";
            layer.appendChild(effect);
        }
        Array.from(effect.children).forEach(corner=>{ corner.textContent=String(count); });
    }

    function rankFor(monster){
        const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster&&monster.v141BattleRank);
        return rank==="boss"?"boss":rank==="elite"?"elite":"regular";
    }

    function syncMonsterCard(index){
        if(typeof document==="undefined"||typeof monsters==="undefined"){ return; }
        const monster=monsters[index];
        const card=document.getElementById("battleMonster"+index);
        if(!card||!monster){ return; }
        card.dataset.rank=rankFor(monster);
        const alive=monster.alive!==false&&numeric(monster.hp)>0;
        card.classList.toggle("v149-living-monster",alive);
        if(alive){
            card.classList.remove("dead","dying","v146-defeated");
            card.style.removeProperty("opacity");
            card.style.removeProperty("filter");
            card.style.removeProperty("pointer-events");
        }
        syncBarrierCard(card,monster);
    }

    function syncPlayerCards(){
        if(typeof document==="undefined"){ return; }
        partyIndexes().forEach(index=>syncBarrierCard(
            document.getElementById("battlePlayerCard"+index),getPartyCharacterByIndex(index)
        ));
    }

    function syncAllCombatCards(){
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach((monster,index)=>{ if(monster){ syncMonsterCard(index); } });
        }
        syncPlayerCards();
    }

    if(typeof window.v143SyncEarthShieldEffects==="function"){
        const previousEarthShieldSync=window.v143SyncEarthShieldEffects;
        window.v143SyncEarthShieldEffects=function(){
            const result=previousEarthShieldSync.apply(this,arguments);
            syncAllCombatCards();
            return result;
        };
    }

    if(typeof window.v141PlayCardEffect==="function"){
        const previousPlayCardEffect=window.v141PlayCardEffect;
        window.v141PlayCardEffect=function(side,index,type){
            if(side==="monster"&&type==="revive"){ syncMonsterCard(index); }
            const result=previousPlayCardEffect.apply(this,arguments);
            setTimeout(syncAllCombatCards,0);
            if(side==="monster"&&type==="revive"){ setTimeout(()=>syncMonsterCard(index),1900); }
            return result;
        };
    }

    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncMonsterCard(index);
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncAllCombatCards();
            return result;
        };
    }

    /* ----- Reflect damage label and monster Frostbite/Dragon repeat. ----- */
    let currentReflectAttacker=null;

    function showReflectDamage(index,amount){
        if(typeof document==="undefined"||amount<=0){ return; }
        const card=document.getElementById("battleMonster"+index);
        if(!card){ return; }
        const popup=document.createElement("strong");
        popup.className="v149-reflect-popup";
        popup.textContent="反傷HP-"+Math.floor(amount);
        card.appendChild(popup);
        setTimeout(()=>popup.remove(),1350);
    }
    window.v149ShowReflectDamage=showReflectDamage;

    if(typeof addBattleLog==="function"){
        const previousAddBattleLog=addBattleLog;
        addBattleLog=function(message){
            const text=String(message||"");
            const match=text.match(/(?:反傷造成.*?|萬象土盾反彈)(\d+)點傷害/);
            if(match&&Number.isInteger(currentReflectAttacker)){
                showReflectDamage(currentReflectAttacker,numeric(match[1]));
            }
            return previousAddBattleLog.apply(this,arguments);
        };
    }

    function runMonsterDragonRepeat(options,allowConditionalRepeat){
        scheduleAfterAnimation(()=>{
            const monster=options.monster;
            if(!monster||monster.alive===false||numeric(monster.hp)<=0||!livingPartyIndexes().length){
                if(options.realFinish){ options.realFinish(); }
                return;
            }

            const originalCost=options.skill.spCost;
            const originalIds=monster.skillIds;
            const originalSupports=monster.v141SupportSkillIds;
            const originalChance=monster.skillChance;
            const originalHit=typeof showPlayerHit==="function"?showPlayerHit:null;
            const originalLog=typeof addBattleLog==="function"?addBattleLog:null;
            const previousRepeatAttacker=currentReflectAttacker;
            const livingBefore=livingPartyIndexes().map(index=>({
                character:getPartyCharacterByIndex(index),
                alive:numeric(getPartyCharacterByIndex(index)&&getPartyCharacterByIndex(index).hp)>0
            }));
            let finishRequested=false;
            let repeatedCritical=false;
            let failed=false;

            options.skill.spCost=0;
            monster.skillIds=["dragonSlash"];
            monster.v141SupportSkillIds=[];
            monster.skillChance=1;
            currentReflectAttacker=options.monsterIndex;
            monsterTeamFreezeApplied=false;
            if(options.realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
            if(originalHit){
                showPlayerHit=function(){
                    if(arguments[4]===true){ repeatedCritical=true; }
                    return originalHit.apply(this,arguments);
                };
            }
            if(originalLog){
                addBattleLog=function(message){
                    if(String(message||"").includes("霸龍裂天斬")&&String(message||"").includes("（爆擊！）")){
                        repeatedCritical=true;
                    }
                    return originalLog.apply(this,arguments);
                };
            }
            try{
                if(typeof window.v155WithForcedFinalAbyssSkillLevel==="function"){
                    window.v155WithForcedFinalAbyssSkillLevel(monster,()=>
                        options.previous.apply(options.that,options.attackArgs)
                    );
                }else{
                    options.previous.apply(options.that,options.attackArgs);
                }
            }
            catch(error){
                failed=true;
                console.error("敵方霸龍裂天斬再施放失敗：",error);
            }
            finally{
                if(options.realFinish){ finishPlayerAction=options.realFinish; }
                if(originalHit){ showPlayerHit=originalHit; }
                if(originalLog){ addBattleLog=originalLog; }
                currentReflectAttacker=previousRepeatAttacker;
                options.skill.spCost=originalCost;
                monster.skillIds=originalIds;
                monster.v141SupportSkillIds=originalSupports;
                monster.skillChance=originalChance;
            }

            if(failed){
                if(options.realFinish){ options.realFinish(); }
                return;
            }
            const defeatedTarget=livingBefore.some(entry=>
                entry.alive&&(!entry.character||numeric(entry.character.hp)<=0)
            );
            if(
                finishRequested&&allowConditionalRepeat&&(repeatedCritical||defeatedTarget)&&
                monster.alive!==false&&numeric(monster.hp)>0&&livingPartyIndexes().length
            ){
                if(typeof addBattleLog==="function"){
                    addBattleLog(monster.name+"的霸龍裂天斬追加攻擊出現爆擊或擊敗目標，再追加一次！");
                }
                runMonsterDragonRepeat(options,false);
                return;
            }
            if(finishRequested&&options.realFinish){ options.realFinish(); }
        });
    }

    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const attackArgs=Array.prototype.slice.call(arguments);
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const frostbitten=activeStatus(monster,"frostbite");
            const saved=monster?{
                skillIds:monster.skillIds,supports:monster.v141SupportSkillIds,skillChance:monster.skillChance
            }:null;
            if(frostbitten&&monster){
                monster.skillIds=[];
                monster.v141SupportSkillIds=[];
                monster.skillChance=0;
            }
            const realFinish=typeof finishPlayerAction==="function"?finishPlayerAction:null;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            let finishRequested=false;
            let castSkillId=null;
            if(realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(typeof skillDatabase!=="undefined"){
                        castSkillId=Object.keys(skillDatabase).find(id=>skillDatabase[id]&&skillDatabase[id].name===name)||null;
                    }
                    return previousBadge.apply(this,arguments);
                };
            }
            const previousAttacker=currentReflectAttacker;
            currentReflectAttacker=monsterIndex;
            monsterTeamFreezeApplied=false;
            let result;
            try{ result=previousMonsterAttack.apply(this,arguments); }
            finally{
                currentReflectAttacker=previousAttacker;
                if(realFinish){ finishPlayerAction=realFinish; }
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(frostbitten&&monster){
                    monster.skillIds=saved.skillIds;
                    monster.v141SupportSkillIds=saved.supports;
                    monster.skillChance=saved.skillChance;
                }
            }
            const repeatSkill=castSkillId&&skillDatabase[castSkillId];
            const livingTargets=livingPartyIndexes();
            const repeat=finishRequested&&repeatSkill&&repeatSkill.id==="dragonSlash"&&monster&&
                monster.alive!==false&&numeric(monster.hp)>0&&livingTargets.length&&
                Math.random()*100<numeric(repeatSkill.repeatChance);
            if(!repeat){
                if(finishRequested&&realFinish){ realFinish(); }
                return result;
            }
            if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"的霸龍裂天斬觸發再施放！"); }
            runMonsterDragonRepeat({
                previous:previousMonsterAttack,that:this,attackArgs:attackArgs,
                monster:monster,monsterIndex:monsterIndex,skill:repeatSkill,realFinish:realFinish
            },true);
            return result;
        };
    }

    /* ----- Every skill uses one circle per displayed character. ----- */
    function installWordCircleDirector(){
        const director=window.v142SkillAnimationDirector;
        const manifest=window.v143SkillAnimationManifest;
        if(!director||typeof director.play!=="function"||!manifest){ return; }
        const previousPlay=director.play.bind(director);
        director.play=function(config,meta){
            if(!config||config.id==="normal"||config.name==="普通攻擊"){
                return previousPlay(config,meta);
            }
            const existing=manifest[config.id];
            if(existing&&existing.sprite){
                return previousPlay(config,meta);
            }
            const characters=Array.from(String(config.name||"技能").replace(/\s+/g,""));
            const syntheticId="v149-word-"+String(config.id||"skill");
            const flameSlash=config.id==="flameSlash";
            manifest[syntheticId]={
                glyph:characters[0]||"技",sequence:characters.join(""),motion:"tempest",
                impact:flameSlash?"flame-cut":"storm-domain",hit:flameSlash?.58:.75,
                pulses:Math.max(4,characters.length+2),
                spread:110,flightCount:characters.length
            };
            const wordConfig=Object.assign({},config,{id:syntheticId,v149OriginalSkillId:config.id});
            const gate=previousPlay(wordConfig,meta);
            if(typeof document!=="undefined"){
                const stage=document.querySelector('.v143-skill-stage[data-skill="'+syntheticId+'"]');
                if(stage){
                    stage.classList.add("v149-word-circle-stage");
                    stage.querySelectorAll(".v143-skill-flight").forEach(flight=>{
                        const order=Math.max(0,numeric(flight.dataset.order));
                        const current=parseFloat(flight.style.getPropertyValue("--v143-flight-delay"))||0;
                        flight.style.setProperty("--v143-flight-delay",Math.round(current+order*20)+"ms");
                    });
                }
            }
            return gate;
        };
    }
    installWordCircleDirector();

    function refreshSkillText(){
        try{
            if(typeof renderSkillLoadout==="function"){ renderSkillLoadout(); }
            if(typeof document!=="undefined"){
                document.querySelectorAll(".creation-skill-chip[data-skill-id]").forEach(chip=>{
                    const skill=skillDatabase[chip.dataset.skillId];
                    if(skill){ chip.title=skill.description||skill.name; }
                });
            }
        }catch(error){ console.error("V149 更新技能顯示失敗：",error); }
    }

    function boot(){
        syncAllCombatCards();
        refreshSkillText();
        if(typeof document!=="undefined"){
            const homeShop=document.getElementById("homeIconShop");
            if(homeShop){ homeShop.style.backgroundImage="url(assets/ui/home-shop.png)"; }
        }
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        let queued=false;
        const observer=new MutationObserver(()=>{
            if(queued){ return; }
            queued=true;
            requestAnimationFrame(()=>{ queued=false; syncAllCombatCards(); });
        });
        const observe=()=>observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",observe,{once:true}); }
        else{ observe(); }
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v149SyncCombatCards=syncAllCombatCards;
    window.v149GetBuffConflictTargets=buffConflictTargets;
    window.v149Diagnostics=function(){
        return {
            version:VERSION,skillCount:Object.keys(SKILLS).length,frostbiteBlocksSkillsOnly:true,
            barrierConflicts:true,barrierCornerCount:true,wordCirclePerCharacter:true,
            mainShopIcon:"assets/ui/home-shop.png",navShopIcon:"assets/ui/home-shop-v147.png"
        };
    };
})();
