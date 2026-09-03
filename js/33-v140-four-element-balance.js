/* =====================================================
   V140 — 四元素技能平衡定案

   以 2026-08-27 玩家提供的完整四元素技能表為準：
   1. 校正四元素技能數值與說明
   2. 物理／法術技能的異常命中屬性來源
   3. 水系七招吸血只回復 HP
   4. 怒火的爆擊率與爆擊傷害分開計算
   5. 治療術只會為其他友方目標回復 SP，不補施放者本人 SP
   6. 技能「結界」只擋 5 次直接傷害、最多 5 回合，DOT 穿透
   7. 最終命中率下限 60% → 50%

   不重構其他戰鬥系統，不改玩家能力、存檔結構，
   符咒與對應技能共用同一套效果規則。
===================================================== */
(function applyV140FourElementBalance(){
    "use strict";

    const GENERAL_STATUS_BOUNDS={min:5,max:95};
    const LOCKDOWN_STATUS_BOUNDS={
        regular:{min:5,max:80},
        elite:{min:5,max:60},
        boss:{min:5,max:40}
    };
    const LEVEL_FACTOR_PER_LEVEL=0.02;
    const LEVEL_FACTOR_MIN=0.70;
    const LEVEL_FACTOR_MAX=1.30;
    const GENERAL_STATUS_COEFFICIENT=0.05;
    const LOCKDOWN_STATUS_COEFFICIENT=0.2;
    const GENERAL_STATUS_SPIRIT_COEFFICIENT=0.05;
    const LOCKDOWN_STATUS_SPIRIT_COEFFICIENT=0.3;

    const LIFESTEAL_BY_SKILL={
        waterKnife:[4,5,6,7,8],
        frostPunch:[4,5,6,7,8],
        iceSpin:[3,4,5,6,7],
        frostCrush:[4,5,6,7,8],
        waterBall:[3,4,5,6,7],
        floodBeast:[4,5,6,7,8],
        iceArrowRain:[1,2,3,4,5]
    };

    let statusSkillContext=null;

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clamp(value,min,max){
        return Math.max(min,Math.min(max,value));
    }

    function setDamageSkill(skillId,baseDamage,damagePerLevel,description){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        skill.baseDamage=baseDamage;
        skill.damagePerLevel=damagePerLevel;
        skill.description=description;
    }

    function setLifestealSkill(skillId,values,description){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        skill.lifestealPercentByLevel=values.slice();
        skill.description=description;
    }

    function setSkillFields(skillId,fields){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        Object.keys(fields).forEach(key=>{
            const value=fields[key];
            skill[key]=Array.isArray(value)?value.slice():value;
        });
    }

    setDamageSkill(
        "fireRocket",
        17,
        8,
        "對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害，最高5級，每升1級傷害+8。"
    );

    setSkillFields("flameTornado",{
        burnPercentByLevel:[3,4,5,6,8],
        description:"對任一橫排目標各造成40點基礎法術傷害；30%基礎機率燃燒2回合，每回合造成目標最大HP的3%/4%/5%/6%/8%傷害。"
    });

    setSkillFields("phoenixCry",{
        burnPercentByLevel:[5,7,9,11,13],
        description:"對敵方全體各造成53點基礎法術傷害；50%基礎機率燃燒2回合，每回合造成目標最大HP的5%/7%/9%/11%/13%傷害。"
    });

    setSkillFields("rage",{
        /* 舊引擎仍讀 critBonusByLevel，讓它代表爆擊率以保留相容。 */
        critBonusByLevel:[5,10,15,20,25],
        critChanceBonusByLevel:[5,10,15,20,25],
        critDamageBonusByLevel:[10,20,30,40,50],
        description:"提高我方最多3名存活角色的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續2回合。"
    });

    setSkillFields("stormFist",{
        agilityDownByLevel:[30,40,50,60,70],
        description:"對單體造成14點基礎傷害；50%基礎機率降低敏捷1回合，降低30%/40%/50%/60%/70%。"
    });

    setSkillFields("healSpell",{
        description:"擇一友方目標，恢復HP與SP。HP基礎40、SP基礎15，兩者每升1級基礎恢復量+5；保留既有智力與水元素EX回復加成，施放者本人不回復SP。"
    });

    setSkillFields("barrier",{
        spCost:40,
        duration:5,
        barrierBlockCount:5,
        description:"使我方單一目標獲得結界，完全抵擋接下來5次直接傷害，最多存在5回合；燃燒、毒等持續傷害不會被抵擋，也不消耗次數。"
    });

    setDamageSkill(
        "frostPunch",
        30,
        8,
        "對單體造成30點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );

    setDamageSkill(
        "stoneBreakSky",
        65,
        9,
        "對單體造成65點基礎傷害；為我方全體增加100/125/150/175/200點護盾，持續2回合。"
    );

    setLifestealSkill(
        "waterKnife",
        LIFESTEAL_BY_SKILL.waterKnife,
        "對單體造成13點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "frostPunch",
        LIFESTEAL_BY_SKILL.frostPunch,
        "對單體造成30點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "iceSpin",
        LIFESTEAL_BY_SKILL.iceSpin,
        "對同一橫排左、中、右最多3名目標各造成25點基礎傷害；吸取實際造成傷害的3%/4%/5%/6%/7%，只恢復自身HP。"
    );
    setLifestealSkill(
        "frostCrush",
        LIFESTEAL_BY_SKILL.frostCrush,
        "對單體造成100點基礎傷害；45%機率冰封1回合；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "waterBall",
        LIFESTEAL_BY_SKILL.waterBall,
        "對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害；吸取實際造成傷害的3%/4%/5%/6%/7%，只恢復自身HP。"
    );
    setLifestealSkill(
        "floodBeast",
        LIFESTEAL_BY_SKILL.floodBeast,
        "對單體造成35點基礎法術傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "iceArrowRain",
        LIFESTEAL_BY_SKILL.iceArrowRain,
        "對敵方全體各造成30點基礎法術傷害；吸取實際造成傷害的1%/2%/3%/4%/5%，只恢復自身HP；並有50%基礎機率使隨機單一目標冰封2回合。"
    );

    /*
       純計算入口同時供正式判定與回歸測試使用。
       等級差、精神、額外抗性及既有上下限完整保留；
       一般異常的物理攻擊／智力與目標精神統一使用0.05；
       硬控仍維持開根號屬性加成與原本精神係數。
    */
    function calculateV140StatusChance(
        baseChancePercent,
        casterLevel,
        targetLevel,
        offensivePower,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent,
        skillCategory
    ){
        const levelFactor=clamp(
            1+(numeric(casterLevel)-numeric(targetLevel))*LEVEL_FACTOR_PER_LEVEL,
            LEVEL_FACTOR_MIN,
            LEVEL_FACTOR_MAX
        );

        const power=Math.max(0,numeric(offensivePower));
        const attributeBonus=isLockdown
            ? Math.sqrt(power)*LOCKDOWN_STATUS_COEFFICIENT
            : power*GENERAL_STATUS_COEFFICIENT;
        const spiritCoefficient=isLockdown
            ? LOCKDOWN_STATUS_SPIRIT_COEFFICIENT
            : GENERAL_STATUS_SPIRIT_COEFFICIENT;

        const rawChance=
            numeric(baseChancePercent)*levelFactor+
            attributeBonus-
            Math.max(0,numeric(targetSpirit))*spiritCoefficient-
            numeric(targetBonusResistancePercent);

        const bounds=isLockdown
            ? (LOCKDOWN_STATUS_BOUNDS[targetRank]||LOCKDOWN_STATUS_BOUNDS.regular)
            : GENERAL_STATUS_BOUNDS;

        return clamp(rawChance,bounds.min,bounds.max);
    }

    window.v140CalculateStatusEffectChance=calculateV140StatusChance;

    const previousCalculateStatusEffectChance=calculateStatusEffectChance;
    calculateStatusEffectChance=function(
        baseChancePercent,
        casterLevel,
        targetLevel,
        casterIntelligence,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent
    ){
        const context=statusSkillContext;
        const category=context&&context.skill
            ? context.skill.category
            : "magic";
        const offensivePower=context&&context.skill
            ? (category==="physical"
                ? context.physicalAttack
                : context.intelligence)
            : casterIntelligence;

        return calculateV140StatusChance(
            baseChancePercent,
            casterLevel,
            targetLevel,
            offensivePower,
            targetSpirit,
            isLockdown,
            targetRank,
            targetBonusResistancePercent,
            category
        );
    };

    /*
       命中先依既有命中值算出基礎命中率，再讓正式閃躲率獨立擲算。
       閃躲來源本身已在角色能力端用乘算合併，最終上限85%。
    */
    function getV140HitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent
    ){
        const rawAccuracyChance=
            95+
            casterAccuracy*0.3-
            (directChanceReductionPercent||0);

        const accuracyChance=clamp(
            rawAccuracyChance,
            50,
            99
        );
        const evasionRate=clamp(targetEvasion,0,85);

        return clamp(accuracyChance*(1-evasionRate/100),1,99);
    }

    window.v140GetHitChancePercent=getV140HitChancePercent;

    rollHitChance=function(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent
    ){
        return Math.random()*100<getV140HitChancePercent(
            casterAccuracy,
            targetEvasion,
            directChanceReductionPercent
        );
    };

    /*
       怒火改為兩組獨立數值。舊函式一次只讀 bonusPercent，
       因此先以爆擊率加成讓舊函式完成擲骰，命中爆擊後
       再只補上爆傷差額；其他自然爆擊、火EX與抗暴公式不變。
    */
    const previousRollCritical=rollCritical;
    rollCritical=function(character,category,targetAntiCritPercent){
        const rageBuff=(character&&character.activeBuffs||[])
            .find(buff=>buff&&buff.type==="rage");

        if(
            !rageBuff||
            rageBuff.critChanceBonusPercent===undefined||
            rageBuff.critDamageBonusPercent===undefined
        ){
            return previousRollCritical.apply(this,arguments);
        }

        const previousBonus=rageBuff.bonusPercent;
        const chanceBonus=numeric(rageBuff.critChanceBonusPercent);
        const damageBonus=numeric(rageBuff.critDamageBonusPercent);
        let result;

        rageBuff.bonusPercent=chanceBonus;
        try{
            result=previousRollCritical.apply(this,arguments);
        }finally{
            rageBuff.bonusPercent=previousBonus;
        }

        if(result&&result.isCrit){
            return Object.assign({},result,{
                multiplier:Math.min(
                    typeof CRIT_MULTIPLIER_MAX==="number"?CRIT_MULTIPLIER_MAX:2.25,
                    result.multiplier+(damageBonus-chanceBonus)/100
                )
            });
        }
        return result;
    };

    /* 背包角色詳情也要顯示同一組實際戰鬥數值。 */
    if(typeof getInventoryCharacterCriticalStats==="function"){
        const previousGetInventoryCharacterCriticalStats=
            getInventoryCharacterCriticalStats;

        getInventoryCharacterCriticalStats=function(index){
            const character=typeof getBackpackCharacter==="function"
                ? getBackpackCharacter(index)
                : null;
            const buffs=character&&Array.isArray(character.activeBuffs)
                ? character.activeBuffs
                : null;
            const rageBuff=buffs&&buffs.find(buff=>
                buff&&
                buff.type==="rage"&&
                buff.critChanceBonusPercent!==undefined&&
                buff.critDamageBonusPercent!==undefined
            );

            if(!rageBuff){
                return previousGetInventoryCharacterCriticalStats.apply(this,arguments);
            }

            character.activeBuffs=buffs.filter(buff=>buff!==rageBuff);
            let result;
            try{
                result=previousGetInventoryCharacterCriticalStats.apply(this,arguments);
            }finally{
                character.activeBuffs=buffs;
            }

            if(!result){ return result; }
            const chanceBonus=numeric(rageBuff.critChanceBonusPercent);
            const damageBonus=numeric(rageBuff.critDamageBonusPercent)/100;
            ["physical","magic"].forEach(key=>{
                if(!result[key]){ return; }
                result[key].chance+=chanceBonus;
                result[key].multiplier+=damageBonus;
            });
            return result;
        };
    }

    function getV140RageValues(level){
        const skill=skillDatabase.rage||{};
        const index=Math.max(0,numeric(level)-1);
        return {
            chance:numeric((skill.critChanceBonusByLevel||[])[index]),
            damage:numeric((skill.critDamageBonusByLevel||[])[index])
        };
    }

    function isV140SkillBarrier(buff){
        return !!(
            buff&&
            buff.type==="barrier"&&
            buff.turnsLeft>0
        );
    }

    let directBarrierCastContext=null;

    function consumeV140DirectBarrier(character){
        if(
            directBarrierCastContext&&
            directBarrierCastContext.blockedCharacters.has(character)
        ){
            return true;
        }

        const buffs=character&&Array.isArray(character.activeBuffs)
            ? character.activeBuffs
            : [];
        const barrier=buffs.find(isV140SkillBarrier);
        if(!barrier){ return false; }

        if(!Number.isFinite(Number(barrier.remainingBlocks))){
            barrier.remainingBlocks=numeric(skillDatabase.barrier.barrierBlockCount)||5;
        }

        const remaining=Math.max(0,numeric(barrier.remainingBlocks));
        if(remaining<=0){
            character.activeBuffs=buffs.filter(buff=>buff!==barrier);
            return false;
        }

        barrier.remainingBlocks=remaining-1;
        if(directBarrierCastContext){
            directBarrierCastContext.blockedCharacters.add(character);
        }
        if(barrier.remainingBlocks<=0){
            character.activeBuffs=buffs.filter(buff=>buff!==barrier);
        }
        return true;
    }

    window.v140ConsumeDirectBarrier=consumeV140DirectBarrier;
    window.v173WithDirectBarrierCast=function(callback){
        const previousContext=directBarrierCastContext;
        directBarrierCastContext={blockedCharacters:new Set()};
        try{ return callback(); }
        finally{ directBarrierCastContext=previousContext; }
    };

    /* 讓技能施放後的 buff 帶有新規格需要的獨立欄位。 */
    const previousCastBuffSkill=castBuffSkill;
    castBuffSkill=function(skillId,targetIndex){
        const skill=skillDatabase[skillId];
        const level=skill&&typeof getSkillLevel==="function"
            ? getSkillLevel("fire",skillId)
            : 0;
        const rageValues=getV140RageValues(level);
        let didCast=false;

        const previousBadge=typeof showSkillNameBadge==="function"
            ? showSkillNameBadge
            : null;
        const previousLog=typeof addBattleLog==="function"
            ? addBattleLog
            : null;

        if(previousBadge){
            showSkillNameBadge=function(skillName){
                if(skill&&skillName===skill.name){ didCast=true; }
                return previousBadge.apply(this,arguments);
            };
        }

        if(previousLog&&(skillId==="rage"||skillId==="barrier")){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                if(skillId==="rage"&&String(message).includes("怒火生效")){
                    args[0]=
                        "怒火生效！我方最多3人爆擊率提升"+
                        rageValues.chance+"%、爆擊傷害提升"+
                        rageValues.damage+"%，持續"+skill.duration+"回合。";
                }
                else if(skillId==="barrier"&&String(message).includes("獲得結界")){
                    args[0]=String(message).replace(
                        /可抵擋所有傷害，持續\d+回合。/,
                        "可抵擋接下來5次直接傷害，最多持續5回合。"
                    );
                }
                return previousLog.apply(this,args);
            };
        }

        let result;
        try{
            result=previousCastBuffSkill.apply(this,arguments);
        }finally{
            if(previousBadge){ showSkillNameBadge=previousBadge; }
            if(previousLog&&(skillId==="rage"||skillId==="barrier")){
                addBattleLog=previousLog;
            }
        }

        if(!didCast){ return result; }

        if(skillId==="rage"&&typeof getActivePlayerCharacters==="function"){
            getActivePlayerCharacters().slice(0,3).forEach(character=>{
                const buff=(character.activeBuffs||[])
                    .find(entry=>entry.type==="rage"&&entry.turnsLeft>0);
                if(!buff){ return; }
                buff.bonusPercent=rageValues.chance;
                buff.critChanceBonusPercent=rageValues.chance;
                buff.critDamageBonusPercent=rageValues.damage;
            });
        }
        else if(skillId==="barrier"){
            const target=typeof getBattleCharacterByIndex==="function"
                ? getBattleCharacterByIndex(
                    targetIndex===null||targetIndex===undefined?0:targetIndex
                )
                : null;
            const buff=target&&(target.activeBuffs||[])
                .find(entry=>entry.type==="barrier"&&entry.turnsLeft>0);
            if(buff){
                buff.sourceSkill="barrier";
                buff.barrierRule="shared";
                buff.remainingBlocks=numeric(skill.barrierBlockCount)||5;
            }
        }

        return result;
    };

    /*
       符咒不另寫一份持續回合與結界規則：冰封符、隱身符、
       結界符分別讀對應技能。階級命中率仍是符咒自己的屬性。
    */
    function syncV140TalismanDefinitions(){
        if(typeof window.v132GetTalismanDefinition!=="function"){ return; }

        const effects={
            freeze:{
                skillId:"freeze",
                duration:numeric(skillDatabase.freeze&&skillDatabase.freeze.freezeDuration)
            },
            stealth:{
                skillId:"stealthSkill",
                duration:numeric(skillDatabase.stealthSkill&&skillDatabase.stealthSkill.duration)
            },
            barrier:{
                skillId:"barrier",
                duration:numeric(skillDatabase.barrier&&skillDatabase.barrier.duration),
                blockCount:numeric(skillDatabase.barrier&&skillDatabase.barrier.barrierBlockCount)
            }
        };
        const tiers=["Low","Mid","High","Perfect"];

        Object.entries(effects).forEach(([effectKey,effect])=>{
            tiers.forEach(tier=>{
                const definition=window.v132GetTalismanDefinition(
                    effectKey+"Talisman"+tier
                );
                if(!definition){ return; }
                definition.sharedSkillId=effect.skillId;
                if(effect.duration>0){ definition.talismanDuration=effect.duration; }
                if(effect.blockCount>0){ definition.barrierBlockCount=effect.blockCount; }
            });
        });
    }

    syncV140TalismanDefinitions();

    if(
        typeof resolveQueuedPlayerAction==="function"&&
        typeof window.v132GetTalismanDefinition==="function"
    ){
        const previousResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=typeof queuedPlayerActions!=="undefined"
                ? queuedPlayerActions[characterIndex]
                : null;
            const definition=queued&&queued.action
                ? window.v132GetTalismanDefinition(queued.action)
                : null;

            if(!definition){
                return previousResolveQueuedPlayerAction.apply(this,arguments);
            }

            let target=null;
            let previousBuffs=[];
            if(definition.talismanEffect==="barrier"){
                const caster=getBattleCharacterByIndex(characterIndex);
                target=queued&&Number.isInteger(queued.targetAlly)
                    ? getBattleCharacterByIndex(queued.targetAlly)
                    : caster;
                if(!target||target.hp<=0){ target=caster; }
                previousBuffs=target&&Array.isArray(target.activeBuffs)
                    ? target.activeBuffs.slice()
                    : [];
            }

            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog&&definition.talismanEffect==="barrier"){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    args[0]=String(message).replace(
                        /獲得結界，可抵擋所有傷害，持續\d+回合。/,
                        "獲得結界，可抵擋接下來5次直接傷害，最多持續5回合。"
                    );
                    return previousLog.apply(this,args);
                };
            }

            let result;
            try{
                result=previousResolveQueuedPlayerAction.apply(this,arguments);
            }finally{
                if(previousLog&&definition.talismanEffect==="barrier"){
                    addBattleLog=previousLog;
                }
            }

            if(target&&definition.talismanEffect==="barrier"){
                const buff=(target.activeBuffs||[]).find(entry=>
                    entry&&
                    entry.type==="barrier"&&
                    !previousBuffs.includes(entry)
                );
                if(buff){
                    buff.turnsLeft=numeric(skillDatabase.barrier.duration)||5;
                    buff.remainingBlocks=
                        numeric(skillDatabase.barrier.barrierBlockCount)||5;
                    buff.sourceTalisman=definition.id;
                    buff.barrierRule="shared";
                }
            }

            return result;
        };
    }

    function hpOnlyLifestealText(value){
        return String(value)
            .replace(/攻擊技能可吸取HP與SP/g,"攻擊技能可吸取HP")
            .replace(/HP\/SP吸取/g,"HP吸取")
            .replace(/等量回復自身HP與SP/g,"只回復自身HP")
            .replace(/等量恢復自身HP與SP/g,"只恢復自身HP")
            .replace(/（回復HP\/SP）/g,"（只回復HP）");
    }

    function hpOnlyBattleLogText(value){
        return hpOnlyLifestealText(value)
            .replace(/點HP與SP/g,"點HP")
            .replace(/回復HP與SP/g,"回復HP")
            .replace(/恢復(\d+)點HP、\d+點SP/g,"恢復$1點HP");
    }

    function correctV140SkillText(value,skill,level){
        let text=hpOnlyLifestealText(value);

        const rage=skillDatabase.rage;
        if(!rage){ return text; }

        const replaceAtLevel=(targetLevel)=>{
            const values=getV140RageValues(targetLevel);
            [
                "爆擊率／爆擊傷害 +"+values.chance+"%",
                "我方爆擊率與爆擊傷害 +"+values.chance+"%"
            ].forEach(oldText=>{
                text=text.split(oldText).join(
                    (oldText.startsWith("我方")?"我方":"")+
                    "爆擊率 +"+values.chance+"%、爆擊傷害 +"+
                    values.damage+"%"
                );
            });
        };

        if(skill&&skill.id==="rage"&&numeric(level)>0){
            replaceAtLevel(level);
        }
        else{
            for(let lv=1;lv<=(rage.maxLevel||5);lv++){
                replaceAtLevel(lv);
            }
        }
        return text;
    }

    function refreshUIAfterSpCorrection(){
        try{
            if(typeof updateUI==="function"){
                updateUI();
            }
        }catch(error){
            console.error("V140 更新SP顯示失敗：",error);
        }
    }

    function runPlayerSkillWithV140Context(skill,caster,stats,execute){
        if(!skill||!caster||!stats){
            return execute();
        }

        const previousContext=statusSkillContext;
        const context={
            skill:skill,
            physicalAttack:numeric(stats.attack),
            intelligence:numeric(stats.intelligence),
            spAfterCost:null
        };
        statusSkillContext=context;

        const isLifesteal=Array.isArray(skill.lifestealPercentByLevel);
        const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
        const previousBadge=typeof showSkillNameBadge==="function"?showSkillNameBadge:null;

        if(isLifesteal&&previousLog){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                args[0]=hpOnlyBattleLogText(message);
                return previousLog.apply(this,args);
            };
        }

        if(isLifesteal&&previousBadge){
            showSkillNameBadge=function(){
                if(context.spAfterCost===null){
                    context.spAfterCost=numeric(caster.sp);
                }
                return previousBadge.apply(this,arguments);
            };
        }

        let result;
        try{
            result=execute();
        }finally{
            if(isLifesteal&&previousBadge){
                showSkillNameBadge=previousBadge;
            }
            if(isLifesteal&&previousLog){
                addBattleLog=previousLog;
            }
            statusSkillContext=previousContext;

            if(
                isLifesteal&&
                context.spAfterCost!==null&&
                numeric(caster.sp)>context.spAfterCost
            ){
                caster.sp=context.spAfterCost;
                refreshUIAfterSpCorrection();
            }
        }
        return result;
    }

    const previousCastDamageSkill=castDamageSkill;
    castDamageSkill=function(skillId){
        const skill=skillDatabase[skillId];
        const stats=typeof getMainCharacterStats==="function"
            ? getMainCharacterStats()
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            typeof player!=="undefined"?player:null,
            stats,
            ()=>previousCastDamageSkill.apply(this,arguments)
        );
    };

    const previousCastSecondaryCharacterSkill=castSecondaryCharacterSkill;
    castSecondaryCharacterSkill=function(characterIndex,skillId){
        const skill=skillDatabase[skillId];
        const character=typeof getPartyCharacterByIndex==="function"
            ? getPartyCharacterByIndex(characterIndex)
            : null;
        const stats=typeof getPartyBattleStats==="function"
            ? getPartyBattleStats(characterIndex)
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            character,
            stats,
            ()=>previousCastSecondaryCharacterSkill.apply(this,arguments)
        );
    };

    const previousCastPlayer2Skill=castPlayer2Skill;
    castPlayer2Skill=function(skillId){
        const skill=skillDatabase[skillId];
        const stats=typeof getPlayer2BattleStats==="function"
            ? getPlayer2BattleStats()
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            typeof player2!=="undefined"?player2:null,
            stats,
            ()=>previousCastPlayer2Skill.apply(this,arguments)
        );
    };

    function getMonsterPhysicalAttack(monster){
        if(!monster){ return 0; }
        const reduction=typeof getStatDownPercentFor==="function"
            ? numeric(getStatDownPercentFor(monster,"attack"))
            : 0;
        return Math.max(0,numeric(monster.attack)*(1-reduction/100));
    }

    function getMonsterIntelligence(monster){
        if(!monster){ return 0; }
        if(typeof getMonsterEffectiveAbilityPoints==="function"){
            return numeric(getMonsterEffectiveAbilityPoints(monster,"intelligence"));
        }
        return numeric(monster.intelligencePoints);
    }

    function findSkillByName(name){
        return Object.keys(skillDatabase)
            .map(id=>skillDatabase[id])
            .find(skill=>skill&&skill.name===name)||null;
    }

    /* 技能與結界符共用規則：DOT 不抵擋、也不消耗次數。 */
    const previousTickStatusEffects=tickStatusEffects;
    tickStatusEffects=function(){
        const previousHasActiveBuff=hasActiveBuff;
        hasActiveBuff=function(character,buffType){
            if(buffType!=="barrier"){
                return previousHasActiveBuff.apply(this,arguments);
            }
            return false;
        };

        try{
            return previousTickStatusEffects.apply(this,arguments);
        }finally{
            hasActiveBuff=previousHasActiveBuff;
        }
    };

    const previousProcessSingleMonsterAttack=processSingleMonsterAttack;
    processSingleMonsterAttack=function(monsterIndex){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster){
            return previousProcessSingleMonsterAttack.apply(this,arguments);
        }

        const previousContext=statusSkillContext;
        const previousBarrierContext=directBarrierCastContext;
        directBarrierCastContext={blockedCharacters:new Set()};
        const context={
            skill:null,
            physicalAttack:getMonsterPhysicalAttack(monster),
            intelligence:getMonsterIntelligence(monster),
            spAfterCost:null
        };
        statusSkillContext=context;

        const previousBadge=typeof showMonsterSkillNameBadge==="function"
            ? showMonsterSkillNameBadge
            : null;
        const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
        const previousHasActiveBuff=hasActiveBuff;

        hasActiveBuff=function(character,buffType){
            if(buffType==="barrier"&&consumeV140DirectBarrier(character)){
                return true;
            }
            return previousHasActiveBuff.apply(this,arguments);
        };

        if(previousBadge){
            showMonsterSkillNameBadge=function(skillName){
                context.skill=findSkillByName(skillName);
                if(context.skill&&context.skill.lifestealPercentByLevel){
                    context.spAfterCost=numeric(monster.sp);
                }
                return previousBadge.apply(this,arguments);
            };
        }

        if(previousLog){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                if(context.skill&&context.skill.lifestealPercentByLevel){
                    args[0]=hpOnlyBattleLogText(message);
                }
                return previousLog.apply(this,args);
            };
        }

        let result;
        try{
            result=previousProcessSingleMonsterAttack.apply(this,arguments);
        }finally{
            if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
            if(previousLog){ addBattleLog=previousLog; }
            hasActiveBuff=previousHasActiveBuff;
            statusSkillContext=previousContext;
            directBarrierCastContext=previousBarrierContext;

            if(
                context.skill&&
                context.skill.lifestealPercentByLevel&&
                context.spAfterCost!==null&&
                numeric(monster.sp)>context.spAfterCost
            ){
                monster.sp=context.spAfterCost;
                refreshUIAfterSpCorrection();
            }
        }
        return result;
    };

    /* 修正技能學習頁與技能詳細視窗裡由舊函式動態組出的 HP/SP 字樣。 */
    function wrapTextResult(functionName){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            return correctV140SkillText(
                previous.apply(this,arguments),
                arguments[0],
                arguments[1]
            );
        };
    }

    wrapTextResult("getSkillEffectPreviewText");
    wrapTextResult("buildSkillLevelBreakdownHTML");

    function correctCreationLifestealText(){
        if(typeof document==="undefined"){ return; }
        [
            "creationElementDescription",
            "creationElementTags",
            "creationSkillDetailDescription",
            "creationSkillDetailLevels"
        ].forEach(id=>{
            const root=document.getElementById(id);
            if(!root){ return; }
            const elements=[root].concat(Array.from(root.querySelectorAll("*")));
            elements.forEach(element=>{
                Array.from(element.childNodes||[]).forEach(node=>{
                    if(node.nodeType===3){
                        node.nodeValue=correctV140SkillText(node.nodeValue,null,null);
                    }
                });
            });
        });
    }

    function wrapCreationFunction(functionName){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const result=previous.apply(this,arguments);
            correctCreationLifestealText();
            return result;
        };
    }

    wrapCreationFunction("selectElement");
    wrapCreationFunction("showCreation");
    wrapCreationFunction("showCreationSkillDetail");
    correctCreationLifestealText();

    /* 補丁在初始畫面渲染後才載入，立即重繪一次既有技能列表。 */
    try{
        if(typeof renderSkillLoadout==="function"){
            renderSkillLoadout();
        }
        if(
            typeof document!=="undefined"&&
            typeof document.querySelectorAll==="function"
        ){
            document.querySelectorAll(".creation-skill-chip[data-skill-id]")
                .forEach(chip=>{
                    const skill=skillDatabase[chip.dataset.skillId];
                    if(skill){ chip.title=skill.description||skill.name; }
                });
        }
    }catch(error){
        console.error("V140 更新技能顯示失敗：",error);
    }

    window.v140GetSkillBalanceAudit=function(){
        const ids=[
            "flameSlash","fireCritical","explosiveFlurry","dragonSlash",
            "fireRocket","blazeSpell","flameTornado","phoenixCry","rage","fireEX",
            "waterKnife","frostPunch","iceSpin","frostCrush",
            "waterBall","floodBeast","iceArrowRain","freeze","healSpell","revive","waterEX",
            "stormFist","stormFlurry","windCrossSlash","dizzyFist",
            "windSpell","stormCircle","windHowlLightning","stormRain",
            "dodgeSkill","stealthSkill","dinghaishenzhen","windEX",
            "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush",
            "stoneThrow","sandWind","flyingSandStrike","dustStorm",
            "earthShield","rockWall","barrier","earthEX"
        ];
        const fields=[
            "id","name","element","category","targetType","learnCost","maxLevel",
            "baseDamage","damagePerLevel","spCost","duration","requires",
            "burnChance","burnDuration","burnPercentByLevel",
            "critChanceBonusByLevel","critDamageBonusByLevel",
            "lifestealPercentByLevel","freezeChance","freezeDuration",
            "baseHeal","healPerLevel","baseHealSP","healSPPerLevel",
            "reviveHealPercentByLevel","agilityDownChance","agilityDownByLevel",
            "agilityDownDuration","damageDownChance","damageDownByLevel",
            "damageDownDuration","stunChance","missBonusByLevel","stunDuration",
            "evasionBonusPercent","statusResistBonus","defenseDownChance",
            "defenseDownByLevel","defenseDownDuration","allyShieldByLevel",
            "selfShieldByLevel","shieldDuration","petrifyChanceByLevel",
            "petrifyDuration","reflectPercent","defenseBonusPercent",
            "barrierBlockCount","damageBonusPercent","critChanceBonusPercent",
            "critDamageBonusPercent","healBonusPercent"
        ];
        return Object.fromEntries(ids.map(id=>{
            const skill=skillDatabase[id];
            if(!skill){ return [id,null]; }
            const entry={};
            fields.forEach(field=>{
                if(skill[field]===undefined){ return; }
                entry[field]=Array.isArray(skill[field])
                    ? skill[field].slice()
                    : skill[field];
            });
            return [id,entry];
        }));
    };

    /* 保留舊函式參照供除錯；正式流程已由上方覆蓋。 */
    window.v140PreviousCalculateStatusEffectChance=previousCalculateStatusEffectChance;
})();
