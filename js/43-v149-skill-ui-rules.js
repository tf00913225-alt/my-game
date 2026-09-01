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

    const SKILL_CLEANUP_FIELDS={
        flameSlash:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        fireCritical:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        explosiveFlurry:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        dragonSlash:["repeatChance","repeatChanceByLevel","repeatMaxCasts"],
        petrifyFist:["allyShieldByLevel"],
        stoneBreakSky:["allyShieldByLevel"],
        earthquakeCrush:["selfShieldByLevel"],
        flyingSandStrike:["petrifyChanceByLevel","petrifyDuration"],
        dustStorm:["defenseDownChance","defenseDownByLevel","defenseDownDuration"]
    };

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        (SKILL_CLEANUP_FIELDS[id]||[]).forEach(key=>{ delete skillDatabase[id][key]; });
        Object.keys(fields).forEach(key=>{ skillDatabase[id][key]=copyValue(fields[key]); });
    }

    const SKILLS={
        flameSlash:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:30,damagePerLevel:6,spCost:10,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:1,
            description:"初次學習需2技能點。對單體造成30點傷害，消耗10 SP；目標死亡或爆擊時免費再施放1次。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        fireCritical:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:45,damagePerLevel:9,spCost:28,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:1,requires:["flameSlash"],
            description:"需先學習火焰斬。初次學習需10技能點，對單體造成45點傷害，消耗28 SP；目標死亡或爆擊時免費再施放1次。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        explosiveFlurry:{
            learnCost:20,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:50,damagePerLevel:10,spCost:47,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:1,requires:["fireCritical"],
            description:"需先學習會心一擊。初次學習需20技能點，對同排中、左、右最多3名目標各造成50點傷害，消耗47 SP；任一目標死亡或爆擊時免費再施放1次。最高5級，每升1級消耗1技能點，傷害+10。"
        },
        dragonSlash:{
            learnCost:45,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:165,damagePerLevel:33,spCost:65,
            followUpOnCriticalOrDefeat:true,followUpMaxCasts:2,requires:["explosiveFlurry"],
            description:"需先學習火爆亂擊。初次學習需45技能點，對單體造成165點傷害，消耗65 SP；目標死亡或爆擊時免費再施放，最多追擊2次。最高5級，每升1級消耗1技能點，傷害+33。"
        },
        fireRocket:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:13,damagePerLevel:4,spCost:10,
            burnChance:25,burnDuration:2,burnPercentByLevel:[1,1,2,2,3],
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成13點傷害，消耗10 SP；25%基礎機率燃燒2回合，每回合造成目標最大HP的1%/1%/2%/2%/3%。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        blazeSpell:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:45,damagePerLevel:9,spCost:28,
            burnChance:30,burnDuration:2,burnPercentByLevel:[1,2,3,4,5],requires:["fireRocket"],
            description:"需先學習火箭。初次學習需10技能點，對單體造成45點傷害，消耗28 SP；30%基礎機率燃燒2回合，每回合造成目標最大HP的1%/2%/3%/4%/5%。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        flameTornado:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:150,damagePerLevel:30,spCost:47,
            burnChance:100,guaranteedBurn:true,burnDuration:1,burnPercentByLevel:[3,4,5,6,7],requires:["blazeSpell"],
            description:"需先學習烈火術。初次學習需30技能點，對單一目標造成150點傷害，消耗47 SP；必定燃燒1回合，每回合造成目標最大HP的3%/4%/5%/6%/7%。最高5級，每升1級消耗1技能點，傷害+30。"
        },
        phoenixCry:{
            learnCost:45,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:42,damagePerLevel:9,spCost:60,
            burnChance:40,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],
            burnBonusThreshold:3,nextRoundDamageBonusPercent:30,nextRoundDamageBonusDuration:1,requires:["flameTornado"],
            description:"需先學習烈焰龍捲。初次學習需45技能點，對敵方全體各造成42點傷害，消耗60 SP；40%基礎機率燃燒2回合。每次施放後燃燒目標少於3人時，下一回合火鳳天鳴傷害+30%。每回合燃燒傷害為目標最大HP的5%/7%/9%/11%/13%。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        rage:{
            learnCost:25,maxLevel:5,upgradeCost:1,targetType:"allyTri",spCost:50,duration:3,
            critBonusByLevel:[5,10,15,20,25],critChanceBonusByLevel:[5,10,15,20,25],
            critDamageBonusByLevel:[10,20,30,40,50],requires:["explosiveFlurry","flameTornado"],
            description:"需先學習火爆亂擊或烈焰龍捲其一。初次學習需25技能點，提高我方中、左、右3人的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續3回合，消耗50 SP。最高5級，每升1級消耗1技能點。"
        },
        fireEX:{
            learnCost:25,maxLevel:1,targetType:"none",damageBonusPercent:10,critChanceBonusPercent:5,critDamageBonusPercent:5,
            statusTargetDamageBonusPercent:5,
            description:"永久提升火元素傷害10%、爆擊率5%、爆擊傷害5%；對有異常狀態的目標傷害再提升5%。"
        },

        stormFist:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:26,damagePerLevel:6,spCost:7,
            agilityDownChance:50,agilityDownByLevel:[30,40,50,60,70],agilityDownDuration:1,
            description:"初次學習需2技能點。對單體造成26點傷害，消耗7 SP；50%基礎機率降低目標敏捷30%/40%/50%/60%/70%，持續1回合。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        stormFlurry:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:13,damagePerLevel:3,spCost:20,
            damageDownChance:50,damageDownByLevel:[10,20,30,40,50],damageDownDuration:2,requires:["stormFist"],
            description:"需先學習暴風拳。初次學習需10技能點，對同排中、左、右最多3名目標各造成13點傷害，消耗20 SP；50%基礎機率降低目標造成的傷害10%/20%/30%/40%/50%，持續2回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        windCrossSlash:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:128,damagePerLevel:26,spCost:39,
            damageDownChance:65,damageDownByLevel:[20,30,35,40,50],damageDownDuration:1,requires:["stormFlurry"],
            description:"需先學習暴風亂擊。初次學習需15技能點，對單體造成128點傷害，消耗39 SP；65%基礎機率降低目標造成的傷害20%/30%/35%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+26。"
        },
        dizzyFist:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:141,damagePerLevel:29,spCost:55,
            stunChance:65,missBonusByLevel:[30,45,50,55,65],stunDuration:5,requires:["stormFlurry"],
            description:"需先學習暴風亂擊。初次學習需30技能點，對單體造成141點傷害，消耗55 SP；65%基礎機率使目標暈眩5回合，MISS率提高30%/45%/50%/55%/65%。最高5級，每升1級消耗1技能點，傷害+29。"
        },
        windSpell:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:12,damagePerLevel:3,spCost:9,
            agilityDownChance:50,agilityDownByLevel:[10,20,30,40,50],agilityDownDuration:1,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成12點傷害，消耗9 SP；50%基礎機率降低目標敏捷10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        stormCircle:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:14,damagePerLevel:4,spCost:18,
            damageDownChance:55,damageDownByLevel:[15,18,21,25,30],damageDownDuration:1,requires:["windSpell"],
            description:"需先學習狂風術。初次學習需10技能點，對同排中、左、右最多3名目標各造成14點傷害，消耗18 SP；55%基礎機率降低目標造成的傷害15%/18%/21%/25%/30%，持續1回合。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        windHowlLightning:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:128,damagePerLevel:26,spCost:55,
            damageDownChance:65,damageDownByLevel:[15,20,25,30,35],damageDownDuration:1,requires:["stormCircle"],
            description:"需先學習風焰術。初次學習需15技能點，對單體造成128點傷害，消耗55 SP；65%基礎機率降低目標造成的傷害15%/20%/25%/30%/35%，持續1回合。最高5級，每升1級消耗1技能點，傷害+26。"
        },
        stormRain:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:36,damagePerLevel:7,spCost:75,
            stunChance:35,missBonusByLevel:[30,45,50,55,65],stunDuration:1,requires:["windHowlLightning"],
            description:"需先學習風哮電擊。初次學習需30技能點，對敵方全體各造成36點傷害，消耗75 SP；35%基礎機率暈眩1回合，使目標MISS率提高30%/45%/50%/55%/65%。最高5級，每升1級消耗1技能點，傷害+7。"
        },
        dodgeSkill:{
            learnCost:10,maxLevel:1,targetType:"allyTri",spCost:20,duration:3,evasionBonusPercent:75,
            requires:["windCrossSlash","windHowlLightning"],description:"需先學習風旋十字斬或風哮電擊其一。初次學習需10技能點，使我方中、左、右3人閃躲率提升75%，持續3回合，消耗20 SP。最高1級。"
        },
        stealthSkill:{
            learnCost:15,maxLevel:1,targetType:"ally",spCost:45,duration:3,requires:["dodgeSkill"],
            description:"需先學習閃躲術。初次學習需15技能點，使我方1人隱身3回合；期間無法被單體技能選中，但仍會受到範圍技能波及，消耗45 SP。最高1級。"
        },
        dinghaishenzhen:{
            learnCost:20,maxLevel:1,targetType:"allyAll",spCost:77,duration:3,statusResistBonus:65,accuracyBonusPercent:50,
            requires:["stealthSkill"],description:"需先學習隱身術。初次學習需20技能點，使我方全體異常狀態抗性提升65%、命中提升50%，持續3回合，消耗77 SP。最高1級。"
        },
        windEX:{
            learnCost:25,maxLevel:1,targetType:"none",evasionBonusPercent:35,description:"初次學習需25技能點，最大1級；永久提升風元素角色的閃躲率35%。"
        },

        stoneSlash:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:26,damagePerLevel:6,spCost:7,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,
            description:"初次學習需2技能點。對單體造成26點傷害，消耗7 SP；65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        petrifyFist:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:13,damagePerLevel:3,spCost:26,
            selfShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["stoneSlash"],
            description:"需先學習土石斬。初次學習需10技能點，對同排中、左、右最多3名目標各造成13點傷害，消耗26 SP；並使自身獲得100/125/150/175/200點護盾2回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        stoneBreakSky:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:128,damagePerLevel:26,spCost:42,
            selfShieldByLevel:[100,125,150,175,200],shieldDuration:2,requires:["petrifyFist"],
            description:"需先學習石盾拳。初次學習需15技能點，對單體造成128點傷害，消耗42 SP；並使自身獲得100/125/150/175/200點護盾2回合。最高5級，每升1級消耗1技能點，傷害+26。"
        },
        earthquakeCrush:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:47,damagePerLevel:9,spCost:55,
            petrifyChanceByLevel:[30,35,40,45,50],petrifyDuration:2,requires:["stoneBreakSky"],
            description:"需先學習石破天驚。初次學習需30技能點，對同排中、左、右最多3名目標各造成47點傷害，消耗55 SP；依等級有30%/35%/40%/45%/50%基礎機率石化目標2回合。最高5級，每升1級消耗1技能點，傷害+9。"
        },
        stoneThrow:{
            learnCost:2,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:12,damagePerLevel:3,spCost:7,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,
            description:"初次學習需2技能點。對同排中、左、右最多3名目標各造成12點傷害，消耗7 SP；65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+3。"
        },
        sandWind:{
            learnCost:10,maxLevel:5,upgradeCost:1,targetType:"tri",baseDamage:14,damagePerLevel:4,spCost:19,
            defenseDownChance:65,defenseDownByLevel:[10,20,30,40,50],defenseDownDuration:1,requires:["stoneThrow"],
            description:"需先學習落石術。初次學習需10技能點，對同排中、左、右最多3名目標各造成14點傷害，消耗19 SP；65%基礎機率降低目標防禦10%/20%/30%/40%/50%，持續1回合。最高5級，每升1級消耗1技能點，傷害+4。"
        },
        flyingSandStrike:{
            learnCost:15,maxLevel:5,upgradeCost:1,targetType:"all",baseDamage:32,damagePerLevel:6,spCost:55,
            defenseDownChance:60,defenseDownByLevel:[10,15,20,25,35],defenseDownDuration:2,requires:["sandWind"],
            description:"需先學習滾石術。初次學習需15技能點，對敵方全體各造成32點傷害，消耗55 SP；60%基礎機率降低目標防禦10%/15%/20%/25%/35%，持續2回合。最高5級，每升1級消耗1技能點，傷害+6。"
        },
        dustStorm:{
            learnCost:30,maxLevel:5,upgradeCost:1,targetType:"single",baseDamage:140,damagePerLevel:28,spCost:65,
            petrifyChanceByLevel:[20,25,30,35,45],petrifyDuration:2,requires:["flyingSandStrike"],
            description:"需先學習飛沙瞬擊。初次學習需30技能點，對單體造成140點傷害，消耗65 SP；依等級有20%/25%/30%/35%/45%基礎機率石化目標2回合。最高5級，每升1級消耗1技能點，傷害+28。"
        },
        earthShield:{
            learnCost:10,maxLevel:1,targetType:"allyTri",spCost:66,duration:3,reflectPercent:50,
            requires:["stoneBreakSky","flyingSandStrike"],description:"需先學習石破天驚或飛沙瞬擊其一。初次學習需10技能點，使我方中、左、右3人獲得50%反傷土盾，持續3回合，消耗66 SP。最高1級。"
        },
        rockWall:{
            learnCost:15,maxLevel:1,targetType:"allyTri",spCost:45,duration:4,defenseBonusPercent:35,requires:["barrier"],
            description:"需先學習結界。初次學習需15技能點，使我方中、左、右3人防禦力提升35%，持續4回合，消耗45 SP。最高1級。"
        },
        barrier:{
            learnCost:20,maxLevel:1,targetType:"ally",spCost:40,duration:5,barrierBlockCount:5,requires:["earthShield"],
            description:"需先學習萬象土盾。使我方1人獲得結界，完全抵擋接下來5次直接傷害，最多存在5回合；燃燒、毒等持續傷害不抵擋且不消耗次數，消耗40 SP。"
        },
        earthEX:{
            learnCost:25,maxLevel:1,targetType:"none",defenseBonusPercent:35,description:"初次學習需25技能點，最大1級；永久提升土元素角色的防禦力35%。"
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

    function learnedPartySkill(index,skillId){
        if(typeof getSkillLevel!=="function"){ return false; }
        const key=typeof getPartyCharacterKey==="function"
            ?getPartyCharacterKey(index):(index===0?"fire":"player"+(index+1));
        return numeric(getSkillLevel(key,skillId))>0;
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
            const waterEX=typeof skillDatabase!=="undefined"?skillDatabase.waterEX:null;
            const cleanseChance=Math.max(0,numeric(waterEX&&waterEX.turnStartCleanseChance));
            if(cleanseChance>0){
                partyIndexes().forEach(index=>{
                    const character=getPartyCharacterByIndex(index);
                    if(
                        !character||numeric(character.hp)<=0||character.element!=="water"||
                        !Array.isArray(character.statusEffects)||!character.statusEffects.length||
                        !learnedPartySkill(index,"waterEX")||Math.random()*100>=cleanseChance
                    ){ return; }
                    const removed=character.statusEffects.length;
                    character.statusEffects=[];
                    if(typeof addBattleLog==="function"){
                        addBattleLog((character.id||"角色")+"的水元素EX在回合開始前解除"+removed+"個負面狀態。");
                    }
                });
            }
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

    /* ----- Player Fire EX, guaranteed Burn and conditional follow-ups. ----- */
    let playerSkillContext=null;

    function withPlayerSkillContext(context,callback){
        const previousContext=playerSkillContext;
        playerSkillContext=context;
        try{ return callback(); }
        finally{ playerSkillContext=previousContext; }
    }

    function withGuaranteedBurn(skill,callback){
        const previousStatusRoll=typeof rollStatusEffectHit==="function"?rollStatusEffectHit:null;
        if(!skill||!skill.guaranteedBurn||!previousStatusRoll){ return callback(); }
        rollStatusEffectHit=function(baseChance){
            if(numeric(baseChance)===numeric(skill.burnChance)){ return true; }
            return previousStatusRoll.apply(this,arguments);
        };
        try{ return callback(); }
        finally{ rollStatusEffectHit=previousStatusRoll; }
    }

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

    /* Every qualifying Fire physical skill reuses this one owner. */
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

    function livingMonsterSnapshot(){
        return livingMonsterIndexes().map(index=>({
            index:index,monster:monsters[index],wasAlive:true
        }));
    }

    function snapshotHasDefeat(snapshot){
        return (snapshot||[]).some(entry=>
            entry.wasAlive&&(!entry.monster||entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        );
    }

    function invokeTrackedPlayerSkill(options,freeCast){
        const snapshot=livingMonsterSnapshot();
        const originalCost=options.skill.spCost;
        const hadFreeFlag=Object.prototype.hasOwnProperty.call(options.skill,"v149FreeFollowUp");
        const originalFreeFlag=options.skill.v149FreeFollowUp;
        const originalRoll=typeof rollCritical==="function"?rollCritical:null;
        let finishRequested=false;
        let critical=false;
        let result;

        if(freeCast){
            options.skill.spCost=0;
            options.skill.v149FreeFollowUp=true;
        }
        if(options.realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
        if(originalRoll){
            rollCritical=function(){
                const roll=originalRoll.apply(this,arguments);
                if(roll&&roll.isCrit){ critical=true; }
                return roll;
            };
        }
        try{
            result=withPlayerSkillContext(options.context,()=>
                withGuaranteedBurn(options.skill,()=>options.previous.apply(options.that,options.args))
            );
        }finally{
            if(originalRoll){ rollCritical=originalRoll; }
            if(options.realFinish){ finishPlayerAction=options.realFinish; }
            options.skill.spCost=originalCost;
            if(hadFreeFlag){ options.skill.v149FreeFollowUp=originalFreeFlag; }
            else{ delete options.skill.v149FreeFollowUp; }
        }
        return {
            result:result,finishRequested:finishRequested,critical:critical,
            defeated:snapshotHasDefeat(snapshot)
        };
    }

    function runPlayerFollowUp(options,castNumber){
        scheduleAfterAnimation(()=>{
            const nextTarget=preferredLivingMonsterIndex(options.originalTarget);
            if(nextTarget===null||typeof battleActive!=="undefined"&&!battleActive){
                if(options.realFinish){ options.realFinish(); }
                return;
            }

            const repeatArgs=options.args.slice();
            if(Number.isInteger(options.centerArgIndex)){ repeatArgs[options.centerArgIndex]=nextTarget; }
            if(typeof selectedMonster!=="undefined"){ selectedMonster=nextTarget; }
            let outcome;
            try{
                outcome=invokeTrackedPlayerSkill(Object.assign({},options,{args:repeatArgs}),true);
            }catch(error){
                console.error(options.skill.name+"追擊施放失敗：",error);
                if(options.realFinish){ options.realFinish(); }
                return;
            }
            if(
                outcome.finishRequested&&castNumber<numeric(options.skill.followUpMaxCasts)&&
                (outcome.critical||outcome.defeated)&&
                preferredLivingMonsterIndex(options.originalTarget)!==null
            ){
                if(typeof addBattleLog==="function"){
                    addBattleLog(options.skill.name+"追擊出現爆擊或擊敗目標，再追擊一次！");
                }
                runPlayerFollowUp(options,castNumber+1);
                return;
            }
            if(outcome.finishRequested&&options.realFinish){ options.realFinish(); }
        });
    }

    function wrapPlayerSkillCast(name,skillArgIndex,centerArgIndex,characterIndexFromArgs){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[args[skillArgIndex]]:null;
            const characterIndex=characterIndexFromArgs(args);
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null;
            const context={skill:skill,character:character,characterIndex:characterIndex};
            if(!skill||!skill.followUpOnCriticalOrDefeat){
                const that=this;
                return withPlayerSkillContext(context,()=>withGuaranteedBurn(skill,()=>previous.apply(that,args)));
            }
            const originalTarget=Number.isInteger(centerArgIndex)&&Number.isInteger(args[centerArgIndex])
                ?args[centerArgIndex]
                :(typeof selectedMonster!=="undefined"&&Number.isInteger(selectedMonster)?selectedMonster:null);
            const beforeSp=numeric(character&&character.sp);
            const realFinish=typeof finishPlayerAction==="function"?finishPlayerAction:null;
            const options={
                previous:previous,that:this,args:args,skill:skill,context:context,
                centerArgIndex:centerArgIndex,originalTarget:originalTarget,realFinish:realFinish
            };
            const outcome=invokeTrackedPlayerSkill(options,false);
            const spent=beforeSp-numeric(character&&character.sp)>=numeric(skill.spCost);
            const target=preferredLivingMonsterIndex(originalTarget);
            const follow=outcome.finishRequested&&spent&&target!==null&&(outcome.critical||outcome.defeated);
            if(!follow){
                if(outcome.finishRequested&&realFinish){ realFinish(); }
                return outcome.result;
            }
            if(typeof addBattleLog==="function"){ addBattleLog(skill.name+"觸發追擊！"); }
            runPlayerFollowUp(options,1);
            return outcome.result;
        };
    }

    wrapPlayerSkillCast("castDamageSkill",0,null,()=>0);
    wrapPlayerSkillCast("castSecondaryCharacterSkill",1,2,args=>Number(args[0])||0);
    wrapPlayerSkillCast("castPlayer2Skill",0,1,()=>1);

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

    /* ----- Reflect damage label and monster Frostbite/Fire follow-ups. ----- */
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

    function runMonsterFollowUp(options,castNumber){
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
            const originalStatusRoll=typeof rollStatusEffectHit==="function"?rollStatusEffectHit:null;
            const previousRepeatAttacker=currentReflectAttacker;
            const livingBefore=livingPartyIndexes().map(index=>({
                character:getPartyCharacterByIndex(index),
                alive:numeric(getPartyCharacterByIndex(index)&&getPartyCharacterByIndex(index).hp)>0
            }));
            let finishRequested=false;
            let repeatedCritical=false;
            let failed=false;

            options.skill.spCost=0;
            monster.skillIds=[options.skill.id];
            monster.v141SupportSkillIds=[];
            monster.skillChance=1;
            currentReflectAttacker=options.monsterIndex;
            if(options.realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
            if(originalHit){
                showPlayerHit=function(){
                    if(arguments[4]===true){ repeatedCritical=true; }
                    return originalHit.apply(this,arguments);
                };
            }
            if(originalLog){
                addBattleLog=function(message){
                    if(String(message||"").includes(options.skill.name)&&String(message||"").includes("（爆擊！）")){
                        repeatedCritical=true;
                    }
                    return originalLog.apply(this,arguments);
                };
            }
            if(originalStatusRoll&&options.skill.guaranteedBurn){
                rollStatusEffectHit=function(baseChance){
                    if(numeric(baseChance)===numeric(options.skill.burnChance)){ return true; }
                    return originalStatusRoll.apply(this,arguments);
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
                console.error("敵方"+options.skill.name+"追擊施放失敗：",error);
            }
            finally{
                if(options.realFinish){ finishPlayerAction=options.realFinish; }
                if(originalHit){ showPlayerHit=originalHit; }
                if(originalLog){ addBattleLog=originalLog; }
                if(originalStatusRoll){ rollStatusEffectHit=originalStatusRoll; }
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
                finishRequested&&castNumber<numeric(options.skill.followUpMaxCasts)&&
                (repeatedCritical||defeatedTarget)&&
                monster.alive!==false&&numeric(monster.hp)>0&&livingPartyIndexes().length
            ){
                if(typeof addBattleLog==="function"){
                    addBattleLog(monster.name+"的"+options.skill.name+"追擊出現爆擊或擊敗目標，再追擊一次！");
                }
                runMonsterFollowUp(options,castNumber+1);
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
            const previousHit=typeof showPlayerHit==="function"?showPlayerHit:null;
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            const previousStatusRoll=typeof rollStatusEffectHit==="function"?rollStatusEffectHit:null;
            const livingBefore=livingPartyIndexes().map(index=>({
                character:getPartyCharacterByIndex(index),alive:true
            }));
            let finishRequested=false;
            let castSkillId=null;
            let critical=false;
            if(realFinish){ finishPlayerAction=function(){ finishRequested=true; }; }
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(typeof skillDatabase!=="undefined"){
                        castSkillId=Object.keys(skillDatabase).find(id=>skillDatabase[id]&&skillDatabase[id].name===name)||null;
                    }
                    return previousBadge.apply(this,arguments);
                };
            }
            if(previousHit){
                showPlayerHit=function(){
                    if(arguments[4]===true){ critical=true; }
                    return previousHit.apply(this,arguments);
                };
            }
            if(previousLog){
                addBattleLog=function(message){
                    const text=String(message||"");
                    const skill=castSkillId&&typeof skillDatabase!=="undefined"?skillDatabase[castSkillId]:null;
                    if(skill&&text.includes(skill.name)&&text.includes("（爆擊！）")){ critical=true; }
                    return previousLog.apply(this,arguments);
                };
            }
            if(previousStatusRoll){
                rollStatusEffectHit=function(baseChance){
                    const skill=castSkillId&&typeof skillDatabase!=="undefined"?skillDatabase[castSkillId]:null;
                    if(skill&&skill.guaranteedBurn&&numeric(baseChance)===numeric(skill.burnChance)){ return true; }
                    return previousStatusRoll.apply(this,arguments);
                };
            }
            const previousAttacker=currentReflectAttacker;
            currentReflectAttacker=monsterIndex;
            let result;
            try{ result=previousMonsterAttack.apply(this,arguments); }
            finally{
                currentReflectAttacker=previousAttacker;
                if(realFinish){ finishPlayerAction=realFinish; }
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(previousHit){ showPlayerHit=previousHit; }
                if(previousLog){ addBattleLog=previousLog; }
                if(previousStatusRoll){ rollStatusEffectHit=previousStatusRoll; }
                if(frostbitten&&monster){
                    monster.skillIds=saved.skillIds;
                    monster.v141SupportSkillIds=saved.supports;
                    monster.skillChance=saved.skillChance;
                }
            }
            const repeatSkill=castSkillId&&skillDatabase[castSkillId];
            const livingTargets=livingPartyIndexes();
            const defeatedTarget=livingBefore.some(entry=>
                entry.alive&&(!entry.character||numeric(entry.character.hp)<=0)
            );
            const repeat=finishRequested&&repeatSkill&&repeatSkill.followUpOnCriticalOrDefeat&&monster&&
                monster.alive!==false&&numeric(monster.hp)>0&&livingTargets.length&&
                (critical||defeatedTarget);
            if(!repeat){
                if(finishRequested&&realFinish){ realFinish(); }
                return result;
            }
            if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"的"+repeatSkill.name+"觸發追擊！"); }
            runMonsterFollowUp({
                previous:previousMonsterAttack,that:this,attackArgs:attackArgs,
                monster:monster,monsterIndex:monsterIndex,skill:repeatSkill,realFinish:realFinish
            },1);
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
            manifest[syntheticId]={
                glyph:characters[0]||"技",sequence:characters.join(""),motion:"tempest",
                impact:"storm-domain",hit:.75,pulses:Math.max(4,characters.length+2),
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
