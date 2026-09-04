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

    const V17342_HALF_MONSTER_FIELDS=[
        "maxHP","hp","maxSP","sp","attack","magicAttack","defense",
        "attackPoints","vitalityPoints","energyPoints","intelligencePoints","spiritPoints","agilityPoints",
        "vitality","energy","intelligence","spirit","agility","accuracy","evasion"
    ];

    function halveMonsterCoreStats(monster,marker){
        if(!monster||monster[marker]){ return monster; }
        V17342_HALF_MONSTER_FIELDS.forEach(key=>{
            if(!Number.isFinite(Number(monster[key]))){ return; }
            const minimum=["maxHP","hp","maxSP","sp"].includes(key)?1:0;
            monster[key]=Math.max(minimum,Math.round(Number(monster[key])*0.5));
        });
        if(Number.isFinite(Number(monster.maxHP))){
            monster.hp=Math.max(1,Math.min(Number(monster.maxHP),Number(monster.hp)||Number(monster.maxHP)));
        }
        if(Number.isFinite(Number(monster.maxSP))){
            monster.sp=Math.max(0,Math.min(Number(monster.maxSP),Number(monster.sp)||Number(monster.maxSP)));
        }
        monster[marker]=true;
        return monster;
    }

    function normalizeBeginnerForestMonster(monster){
        if(!monster){ return monster; }
        monster.v173BeginnerForest=true;
        normalizeMonsterDefaultEvasion(monster);
        halveMonsterCoreStats(monster,"v17342BeginnerStatsHalved");
        monster.agilityPoints=0;
        monster.agility=0;
        return monster;
    }

    const DAILY_DUNGEON_SCALE_FIELDS=[
        "maxHP","hp","maxSP","sp","attack","magicAttack","defense",
        "attackPoints","vitalityPoints","energyPoints","intelligencePoints","spiritPoints","agilityPoints",
        "vitality","energy","intelligence","spirit","agility","accuracy","evasion"
    ];

    function getDailyDungeonScaleContext(){
        const run=window.v132ActiveDungeonRun||null;
        let partySize=Math.floor(numeric(run&&run.partySize));
        if(!(partySize>=1&&partySize<=3)&&typeof getExistingPartyIndexes==="function"){
            partySize=getExistingPartyIndexes().slice(0,3).filter(index=>{
                const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
                return !!character;
            }).length;
        }
        partySize=Math.max(1,Math.min(3,partySize||1));
        const partyMultiplier=partySize===1?.40:partySize===2?.72:1;

        let highestLevel=Math.floor(numeric(run&&run.highestPartyLevel));
        if(!(highestLevel>0)&&typeof getExistingPartyIndexes==="function"){
            highestLevel=getExistingPartyIndexes().slice(0,3).reduce((highest,index)=>{
                const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
                return character?Math.max(highest,Math.floor(numeric(character.level)||1)):highest;
            },1);
        }
        highestLevel=Math.max(1,highestLevel||1);
        const levelMultiplier=highestLevel<=15?.80:highestLevel<=20?.90:highestLevel<=50?1:1.05;
        return {
            partySize:partySize,
            highestLevel:highestLevel,
            partyMultiplier:partyMultiplier,
            levelMultiplier:levelMultiplier,
            factor:partyMultiplier*levelMultiplier
        };
    }

    const FORMAL_DAILY_DUNGEON_TYPES=new Set(["exp","material","gold"]);

    function isFormalDailyDungeonMonster(monster){
        return !!(monster&&FORMAL_DAILY_DUNGEON_TYPES.has(String(monster.v173DailyDungeonType||"")));
    }

    function normalizeDailyDungeonMonster(monster){
        if(!isFormalDailyDungeonMonster(monster)||monster.v141Abyss===true){ return monster; }
        normalizeMonsterDefaultEvasion(monster);
        if(!monster.v173DailyDungeonBaseStats){
            const base={};
            DAILY_DUNGEON_SCALE_FIELDS.forEach(key=>{
                if(Number.isFinite(Number(monster[key]))){ base[key]=Number(monster[key]); }
            });
            monster.v173DailyDungeonBaseStats=base;
        }
        const context=getDailyDungeonScaleContext();
        if(!Object.prototype.hasOwnProperty.call(monster,"v173DailyDungeonBaseSkillChance")){
            monster.v173DailyDungeonBaseSkillChance=Number.isFinite(Number(monster.skillChance))?Number(monster.skillChance):0;
        }
        const base=monster.v173DailyDungeonBaseStats;
        DAILY_DUNGEON_SCALE_FIELDS.forEach(key=>{
            if(!Object.prototype.hasOwnProperty.call(base,key)){ return; }
            const minimum=key==="maxHP"||key==="hp"?1:0;
            monster[key]=Math.max(minimum,Math.round(base[key]*context.factor));
        });
        if(Number.isFinite(Number(monster.maxHP))){ monster.hp=Math.max(1,Number(monster.maxHP)); }
        if(Number.isFinite(Number(monster.maxSP))){ monster.sp=Math.max(0,Number(monster.maxSP)); }
        monster.v173DailyDungeonScaleFactor=context.factor;
        monster.v173DailyDungeonPartySize=context.partySize;
        monster.v173DailyDungeonHighestLevel=context.highestLevel;
        monster.v173DailySoloProtected=context.partySize===1&&context.highestLevel<=20;
        monster.v173DailyNoAccuracyCritBoost=monster.v173DailySoloProtected;
        const baseSkillChance=Math.max(0,Math.min(1,Number(monster.v173DailyDungeonBaseSkillChance)||0));
        if(monster.v173DailySoloProtected){
            monster.skillChance=Number(monster.v141DungeonStage)===1?0:Math.min(.45,baseSkillChance*.60);
        }else{
            monster.skillChance=baseSkillChance;
            monster.v173DailyBossUsedSkillLastAction=false;
        }
        return monster;
    }

    window.v158NormalizeMonsterDefaultEvasion=normalizeMonsterDefaultEvasion;
    window.v17342NormalizeBeginnerForestMonster=normalizeBeginnerForestMonster;
    window.v17342NormalizeDailyDungeonMonster=normalizeDailyDungeonMonster;
    window.v173GetDailyDungeonScaleContext=getDailyDungeonScaleContext;
    window.v17344IsFormalDailyDungeonMonster=isFormalDailyDungeonMonster;

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
            (entries||[]).forEach(monster=>{
                normalizeMonsterDefaultEvasion(monster);
                if(key==="forest"){ normalizeBeginnerForestMonster(monster); }
            });
        });
    }

    if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
        monsters.forEach(monster=>{
            normalizeMonsterDefaultEvasion(monster);
            if(monster&&monster.v173BeginnerForest===true){ normalizeBeginnerForestMonster(monster); }
        });
    }

    if(typeof rollBeginnerForestNormalAttackDamage==="function"){
        rollBeginnerForestNormalAttackDamage=function(){
            return 5+Math.floor(Math.random()*4);
        };
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const isDungeonBattle=
                typeof currentZone!=="undefined"&&currentZone==="dungeon"&&
                !!window.v132ActiveDungeonRun&&
                typeof currentBattleMonsters!=="undefined"&&
                Array.isArray(currentBattleMonsters)&&
                typeof monsters!=="undefined"&&Array.isArray(monsters);
            if(isDungeonBattle){
                const roster=currentBattleMonsters.map(index=>monsters[index]).filter(Boolean);
                const isAbyss=roster.some(monster=>monster&&monster.v141Abyss===true);
                if(!isAbyss){ roster.forEach(normalizeDailyDungeonMonster); }
            }
            return previousRenderBattle.apply(this,arguments);
        };
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

    /* Solo Lv1-20 formal daily protection: wave 1 is normal-attack only.
       From wave 2 onward skills are allowed at a reduced rate; a BOSS that just
       used a skill must perform one non-skill action before another skill. */
    if(typeof processSingleMonsterAttack==="function"){
        const previousDailyProtectedMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(!monster||monster.v173DailySoloProtected!==true||monster.v141Abyss===true){
                return previousDailyProtectedMonsterAttack.apply(this,arguments);
            }
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster.rank||"regular");
            const forceNormal=Number(monster.v141DungeonStage)===1||
                (rank==="boss"&&monster.v173DailyBossUsedSkillLastAction===true);
            const savedSkillIds=monster.skillIds;
            const savedSupports=monster.v141SupportSkillIds;
            const savedChance=monster.skillChance;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            let usedSkill=false;
            if(forceNormal){
                monster.skillIds=[];
                monster.v141SupportSkillIds=[];
                monster.skillChance=0;
            }
            if(previousBadge){
                showMonsterSkillNameBadge=function(name){
                    if(String(name||"")!=="普通攻擊"){ usedSkill=true; }
                    return previousBadge.apply(this,arguments);
                };
            }
            try{
                return previousDailyProtectedMonsterAttack.apply(this,arguments);
            }finally{
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(forceNormal){
                    monster.skillIds=savedSkillIds;
                    monster.v141SupportSkillIds=savedSupports;
                    monster.skillChance=savedChance;
                }
                if(rank==="boss"){ monster.v173DailyBossUsedSkillLastAction=usedSkill; }
            }
        };
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
