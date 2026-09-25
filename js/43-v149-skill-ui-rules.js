/* =====================================================
   V149 — battle/presentation compatibility.
   V173.64 owns the player Skill Spec and all player skill values.
===================================================== */
(function installV149SkillUiRules(){
    "use strict";

    if(typeof window==="undefined"||window.__v149SkillUiRulesInstalled){ return; }
    window.__v149SkillUiRulesInstalled=true;

    const VERSION="149";
    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }


    const FINAL_FIRE_WIND_EARTH_DAMAGE_SKILL_IDS=[
        "flameSlash","fireCritical","explosiveFlurry","dragonSlash",
        "fireRocket","blazeSpell","flameTornado","phoenixCry",
        "stormFist","stormFlurry","windCrossSlash","dizzyFist",
        "windSpell","stormCircle","windHowlLightning","stormRain","stormSpell",
        "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush",
        "stoneThrow","sandWind","flyingSandStrike","dustStorm"
    ];
    if(typeof window.v173ApplyFormalDamageRoleProfiles==="function"){
        window.v173ApplyFormalDamageRoleProfiles(FINAL_FIRE_WIND_EARTH_DAMAGE_SKILL_IDS);
    }

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
        if(!entity){ return false; }
        if(typeof window.v173HasNamedPersistentState==="function"&&window.v173HasNamedPersistentState(entity,"frostbite")){
            return false;
        }
        if(typeof applyMonsterDebuff==="function"){
            return applyMonsterDebuff(entity,"frostbite",Math.max(1,numeric(duration)||2),0)!==false;
        }
        entity.statusEffects=entity.statusEffects||[];
        const entry={type:"frostbite",turnsLeft:duration||2,value:0};
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(entry,"frostbite");
        }
        entity.statusEffects.push(entry);
        return true;
    }

    function playFrostbiteEffect(side,index){
        if(typeof window.v141PlayCardEffect==="function"){
            window.v141PlayCardEffect(side,index,"freeze");
        }
    }

    if(typeof applySkillDebuffEffects==="function"){
        const previousApplySkillDebuffs=applySkillDebuffEffects;
        applySkillDebuffEffects=function(skill,level,monster,index,casterLevel,casterOffensiveAttribute){
            const result=previousApplySkillDebuffs.apply(this,arguments);
            if(!skill||!numeric(skill.frostbiteChance)||!monster||!monster.alive){ return result; }
            const args=[
                skill.frostbiteChance,casterLevel,monster.level,casterOffensiveAttribute,
                typeof getMonsterEffectiveSpiritPoints==="function"?getMonsterEffectiveSpiritPoints(monster):numeric(monster.spiritPoints),
                false,typeof getMonsterRank==="function"?getMonsterRank(monster):"regular"
            ];
            const roll=typeof window.v173RollNamedPersistentStatusEffect==="function"
                ?window.v173RollNamedPersistentStatusEffect(monster,"frostbite",args,"monster",index,skill.name)
                :{duplicate:false,hit:typeof rollStatusEffectHit==="function"&&rollStatusEffectHit.apply(null,args)};
            if(roll.hit){
                const duration=skill.frostbiteDuration||2;
                applyFrostbite(monster,duration);
                playFrostbiteEffect("monster",index);
                if(typeof addBattleLog==="function"){ addBattleLog(monster.name+"陷入凍傷，"+duration+"回合內傷害降低30%、閃躲與異常狀態抗性降低25%。"); }
            }else if(!roll.duplicate&&typeof addBattleLog==="function"){
                addBattleLog("（凍傷效果被"+monster.name+"抵抗了）");
            }
            return result;
        };
    }

    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previousApplySkillDebuffsToPlayer=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index,casterLevel,casterOffensiveAttribute){
            const result=previousApplySkillDebuffsToPlayer.apply(this,arguments);
            if(!skill||!numeric(skill.frostbiteChance)||!target||numeric(target.hp)<=0){ return result; }
            const spirit=typeof getFinalBattleSpiritForPlayerTarget==="function"
                ?getFinalBattleSpiritForPlayerTarget(target,index):numeric(target.spirit);
            const resist=typeof getPlayerStatusResistBonus==="function"?getPlayerStatusResistBonus(target):0;
            const args=[skill.frostbiteChance,casterLevel,target.level,casterOffensiveAttribute,spirit,false,"regular",resist];
            const roll=typeof window.v173RollNamedPersistentStatusEffect==="function"
                ?window.v173RollNamedPersistentStatusEffect(target,"frostbite",args,"player",index,skill.name)
                :{duplicate:false,hit:typeof rollStatusEffectHit==="function"&&rollStatusEffectHit.apply(null,args)};
            if(roll.hit){
                const duration=skill.frostbiteDuration||2;
                applyFrostbite(target,duration);
                playFrostbiteEffect("player",index);
                if(typeof addBattleLog==="function"){ addBattleLog((target.id||"角色")+"陷入凍傷，"+duration+"回合內傷害降低30%、閃躲與異常狀態抗性降低25%。"); }
            }else if(!roll.duplicate&&typeof addBattleLog==="function"){
                addBattleLog("（凍傷效果被"+(target.id||"角色")+"抵抗了）");
            }
            return result;
        };
    }

    function tickFrostbite(entity,label){
        if(!entity||!Array.isArray(entity.statusEffects)){ return; }
        entity.statusEffects=entity.statusEffects.filter(effect=>{
            if(!effect||effect.type!=="frostbite"){ return true; }
            if(effect.deferFirstTick){
                effect.deferFirstTick=false;
                return true;
            }
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
            if(!(typeof window!=="undefined"&&window.v175DurationLifecycleActive)){
                livingMonsterIndexes().forEach(index=>tickFrostbite(monsters[index],monsters[index].name));
                partyIndexes().forEach(index=>{
                    const character=getPartyCharacterByIndex(index);
                    if(character&&numeric(character.hp)>0){ tickFrostbite(character,character.id||"角色"); }
                });
            }
            return result;
        };
    }

    /* ----- Player Fire EX, guaranteed Burn and conditional follow-ups. ----- */
    let playerSkillContext=null;

    function withPlayerSkillContext(context,callback){
        const previousContext=playerSkillContext;
        const previousDamageActor=window.v149CurrentDamageActor;
        playerSkillContext=context;
        window.v149CurrentDamageActor=context&&context.character||null;
        try{ return callback(); }
        finally{
            playerSkillContext=previousContext;
            window.v149CurrentDamageActor=previousDamageActor;
        }
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

    function captureBattleFinish(onFinish){
        const flow=window.FourSymbolsBattleFlow;
        if(!flow||typeof flow.interceptActionFinish!=="function"){ return function(){}; }
        return flow.interceptActionFinish(()=>{
            if(typeof onFinish==="function"){ onFinish(); }
            return true;
        });
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
        const releaseFinishCapture=options.realFinish
            ?captureBattleFinish(()=>{ finishRequested=true; }):function(){};
        if(originalRoll){
            rollCritical=function(){
                const roll=originalRoll.apply(this,arguments);
                if(roll&&roll.isCrit){ critical=true; }
                return roll;
            };
        }
        try{
            result=withPlayerSkillContext(options.context,()=>{
                const invoke=()=>options.previous.apply(options.that,options.args);
                const formal=window.FourSymbolsSkillSpec;
                return formal&&typeof formal.withPlayerDirectSkillCast==="function"
                    ?formal.withPlayerDirectSkillCast(
                        options.context.characterIndex,
                        options.skill.id,
                        {freeCast:freeCast===true},
                        invoke
                    )
                    :invoke();
            });
        }finally{
            if(originalRoll){ rollCritical=originalRoll; }
            releaseFinishCapture();
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
                return withPlayerSkillContext(context,()=>{
                    const invoke=()=>previous.apply(that,args);
                    const formal=window.FourSymbolsSkillSpec;
                    return formal&&typeof formal.withPlayerDirectSkillCast==="function"&&skill
                        ?formal.withPlayerDirectSkillCast(characterIndex,skill.id,{freeCast:false},invoke)
                        :invoke();
                });
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
        card.classList.toggle("v149-has-barrier",!!barrierState(entity));
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

    function syncCombatCard(side,index){
        if(side==="monster"){
            syncMonsterCard(index);
            return;
        }
        if(side==="player"){
            syncBarrierCard(
                document.getElementById("battlePlayerCard"+index),
                getPartyCharacterByIndex(index)
            );
        }
    }

    if(typeof window.v141PlayCardEffect==="function"){
        const previousPlayCardEffect=window.v141PlayCardEffect;
        window.v141PlayCardEffect=function(side,index,type){
            if(side==="monster"&&type==="revive"){ syncMonsterCard(index); }
            const result=previousPlayCardEffect.apply(this,arguments);
            setTimeout(()=>syncCombatCard(side,index),0);
            if(side==="monster"&&type==="revive"){ setTimeout(()=>syncMonsterCard(index),1900); }
            return result;
        };
    }

    window.v149AfterMonsterUiUpdate=function(index){
        syncMonsterCard(index);
    };

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
            const releaseFinishCapture=options.realFinish
                ?captureBattleFinish(()=>{ finishRequested=true; }):function(){};
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
            const previousDamageActor=window.v149CurrentDamageActor;
            window.v149CurrentDamageActor=monster;
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
                releaseFinishCapture();
                if(originalHit){ showPlayerHit=originalHit; }
                if(originalLog){ addBattleLog=originalLog; }
                currentReflectAttacker=previousRepeatAttacker;
                window.v149CurrentDamageActor=previousDamageActor;
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
            const realFinish=typeof finishPlayerAction==="function"?finishPlayerAction:null;
            const previousBadge=typeof showMonsterSkillNameBadge==="function"?showMonsterSkillNameBadge:null;
            const previousHit=typeof showPlayerHit==="function"?showPlayerHit:null;
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            const livingBefore=livingPartyIndexes().map(index=>({
                character:getPartyCharacterByIndex(index),alive:true
            }));
            let finishRequested=false;
            let castSkillId=null;
            let critical=false;
            const releaseFinishCapture=realFinish
                ?captureBattleFinish(()=>{ finishRequested=true; }):function(){};
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
            const previousAttacker=currentReflectAttacker;
            const previousDamageActor=window.v149CurrentDamageActor;
            currentReflectAttacker=monsterIndex;
            window.v149CurrentDamageActor=monster;
            let result;
            try{ result=previousMonsterAttack.apply(this,arguments); }
            finally{
                currentReflectAttacker=previousAttacker;
                window.v149CurrentDamageActor=previousDamageActor;
                releaseFinishCapture();
                if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
                if(previousHit){ showPlayerHit=previousHit; }
                if(previousLog){ addBattleLog=previousLog; }
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

    /* ----- Procedural word-circle fallback retired; V143 raster owner is authoritative. ----- */

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

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v149SyncCombatCards=syncAllCombatCards;
    window.v149Diagnostics=function(){
        return {
            version:VERSION,skillCount:Object.keys(SKILLS).length,frostbiteBlocksSkillsOnly:false,
            sameNameStateMiss:true,barrierCornerCount:false,proceduralSkillFallback:false,
            mainShopIcon:"assets/ui/home-shop.png",navShopIcon:"assets/ui/home-shop-v147.png"
        };
    };
})();
