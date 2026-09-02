/* =====================================================
   V158 — final skill, hit, damage and monster evasion tuning
===================================================== */
(function installV158CombatTuning(){
    "use strict";

    if(typeof window==="undefined"||window.__v158CombatTuningInstalled){ return; }
    window.__v158CombatTuningInstalled=true;

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clamp(value,min,max){
        return Math.max(min,Math.min(max,value));
    }

    function hitChancePercent(casterAccuracy,targetEvasion,directChanceReductionPercent){
        const directReduction=Math.max(0,numeric(directChanceReductionPercent));
        const rawAccuracyChance=
            95+
            numeric(casterAccuracy)*0.3-
            directReduction;
        const accuracyChance=clamp(rawAccuracyChance,50,99);
        const evasionRate=clamp(numeric(targetEvasion),0,85);
        return clamp(accuracyChance*(1-evasionRate/100),1,99);
    }

    window.v158GetHitChancePercent=hitChancePercent;

    if(typeof rollHitChance==="function"){
        rollHitChance=function(casterAccuracy,targetEvasion,directChanceReductionPercent){
            return Math.random()*100<hitChancePercent(
                casterAccuracy,
                targetEvasion,
                directChanceReductionPercent
            );
        };
    }

    function normalizeMonsterDefaultEvasion(monster){
        if(!monster){ return monster; }
        const level=Math.max(1,numeric(monster.level)||1);
        if(monster.evasion===undefined){
            monster.evasion=Math.min(30,level*0.3);
        }
        return monster;
    }

    window.v158NormalizeMonsterDefaultEvasion=normalizeMonsterDefaultEvasion;

    if(typeof makeZoneMonster==="function"){
        const previousMakeZoneMonster=makeZoneMonster;
        makeZoneMonster=function(){
            return normalizeMonsterDefaultEvasion(
                previousMakeZoneMonster.apply(this,arguments)
            );
        };
    }

    if(typeof zoneConfig!=="undefined"){
        Object.keys(zoneConfig).forEach(key=>{
            const config=zoneConfig[key];
            const entries=config&&typeof config.monsters==="function"
                ?config.monsters()
                :[];
            (entries||[]).forEach(normalizeMonsterDefaultEvasion);
        });
    }

    if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
        monsters.forEach(normalizeMonsterDefaultEvasion);
    }

    if(typeof getMonsterEvasion==="function"){
        const previousGetMonsterEvasion=getMonsterEvasion;
        getMonsterEvasion=function(monster){
            return previousGetMonsterEvasion.call(
                this,
                normalizeMonsterDefaultEvasion(monster)
            );
        };
    }

    if(typeof calculateDamage==="function"){
        calculateDamage=function(
            attack,
            defense,
            casterLevel,
            targetLevel,
            casterElement,
            targetElement
        ){
            const levelDiff=(numeric(casterLevel)||1)-(numeric(targetLevel)||1);
            const levelFactor=clamp(1+levelDiff*0.02,0.70,1.30);
            const elementFactor=typeof getElementalDamageMultiplier==="function"
                ?getElementalDamageMultiplier(casterElement,targetElement)
                :1;
            const adjustedAttack=numeric(attack)*levelFactor*numeric(elementFactor||1);
            const formulaConstant=350;
            const rawDamage=
                adjustedAttack*formulaConstant/
                (formulaConstant+Math.max(0,numeric(defense)));
            const randomFactor=0.95+Math.random()*0.10;
            let result=Math.max(1,Math.round(rawDamage*randomFactor));
            if(
                typeof window.v155GetCurrentDamageActor==="function"&&
                typeof window.v155GetPhoenixMightMultiplier==="function"
            ){
                result=Math.max(1,Math.floor(
                    result*window.v155GetPhoenixMightMultiplier(
                        window.v155GetCurrentDamageActor()
                    )
                ));
            }
            return result;
        };
    }

    function castTriFreeze(characterIndex,skillId,centerIndex,legacyPlayer2){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        const character=legacyPlayer2
            ?(typeof player2!=="undefined"?player2:null)
            :(typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(characterIndex):null);
        const characterKey=legacyPlayer2
            ?"player2"
            :(typeof getPartyCharacterKey==="function"?getPartyCharacterKey(characterIndex):null);
        const stats=legacyPlayer2
            ?(typeof getPlayer2BattleStats==="function"?getPlayer2BattleStats():null)
            :(typeof getPartyBattleStats==="function"?getPartyBattleStats(characterIndex):null);
        const level=skill&&characterKey&&typeof getSkillLevel==="function"
            ?getSkillLevel(characterKey,skillId)
            :0;
        const spCost=skill&&skill.spCost!==undefined?numeric(skill.spCost):numeric(skill&&skill.cost);

        if(!skill||!character||!stats||level<=0||numeric(character.sp)<spCost){ return false; }

        const resolvedIndex=typeof findAliveTargetIndex==="function"
            ?findAliveTargetIndex(centerIndex)
            :centerIndex;
        if(resolvedIndex===null||resolvedIndex===undefined){
            if(!legacyPlayer2&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
            return true;
        }

        character.sp=Math.max(0,numeric(character.sp)-spCost);
        if(typeof selectedMonster!=="undefined"){ selectedMonster=resolvedIndex; }
        if(typeof lungePlayerCard==="function"){ lungePlayerCard(characterIndex); }
        if(typeof showSkillNameBadge==="function"){
            showSkillNameBadge(skill.name,skill.element,characterIndex);
        }
        if(typeof setTimeout==="function"&&typeof showPlayerSpPopup==="function"){
            setTimeout(()=>showPlayerSpPopup(spCost,characterIndex),500);
        }

        const targets=typeof getSkillTargets==="function"
            ?getSkillTargets(resolvedIndex,"tri")
            :[resolvedIndex];

        targets.forEach(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            if(!monster||monster.alive===false||numeric(monster.hp)<=0){ return; }
            const rollArguments=[
                skill.freezeChance,
                character.level,
                monster.level,
                stats.intelligence,
                typeof getMonsterEffectiveSpiritPoints==="function"
                    ?getMonsterEffectiveSpiritPoints(monster)
                    :numeric(monster.spiritPoints),
                true,
                typeof getMonsterRank==="function"?getMonsterRank(monster):monster.rank
            ];
            const statusResult=typeof window.v173RollNamedPersistentStatusEffect==="function"
                ?window.v173RollNamedPersistentStatusEffect(
                    monster,"freeze",rollArguments,"monster",index,skill.name
                )
                :{
                    duplicate:false,
                    hit:typeof rollStatusEffectHit==="function"&&
                        rollStatusEffectHit.apply(null,rollArguments)
                };

            if(statusResult.hit){
                if(typeof applyFreezeEffect==="function"){
                    applyFreezeEffect(monster,skill.freezeDuration);
                }
                if(typeof addBattleLog==="function"){
                    addBattleLog(monster.name+"被冰封了！");
                }
            }else if(!statusResult.duplicate){
                if(typeof showMissEffect==="function"){ showMissEffect(false,index,"抵抗"); }
                if(typeof addBattleLog==="function"){
                    addBattleLog(skill.name+"對"+monster.name+"沒有生效（抵抗）。");
                }
            }
        });

        if(typeof updateUI==="function"){ updateUI(); }
        if(!legacyPlayer2&&typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    window.v158CastTriFreeze=castTriFreeze;

    if(typeof castSecondaryCharacterSkill==="function"){
        const previousCastSecondaryCharacterSkill=castSecondaryCharacterSkill;
        castSecondaryCharacterSkill=function(characterIndex,skillId,centerIndex){
            if(skillId==="freeze"&&castTriFreeze(characterIndex,skillId,centerIndex,false)){ return; }
            return previousCastSecondaryCharacterSkill.apply(this,arguments);
        };
    }

    if(typeof castPlayer2Skill==="function"){
        const previousCastPlayer2Skill=castPlayer2Skill;
        castPlayer2Skill=function(skillId,centerIndex){
            if(skillId==="freeze"&&castTriFreeze(1,skillId,centerIndex,true)){ return; }
            return previousCastPlayer2Skill.apply(this,arguments);
        };
    }

    if(typeof openInventoryCharacterDetail==="function"){
        const previousOpenInventoryCharacterDetail=openInventoryCharacterDetail;
        openInventoryCharacterDetail=function(){
            const result=previousOpenInventoryCharacterDetail.apply(this,arguments);
            if(typeof document!=="undefined"){
                const note=document.querySelector("#inventoryCharacterDetailStats .inventory-character-detail-note");
                if(note){
                    note.innerHTML=
                        "命中先依95%＋命中×0.3計算（50%～99%），再乘上(1－目標最終閃躲率)。<br>"+
                        "所有閃躲來源採乘算，最終閃躲率最高85%；一般異常每1精神降低0.05個百分點命中率，硬控維持原公式。";
                }
            }
            return result;
        };
    }
})();
