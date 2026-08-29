/* =====================================================
   V155 — hard-control pacing, final Abyss skills and fire ultimates
===================================================== */
(function installV155DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v155DevFixesInstalled){ return; }
    window.__v155DevFixesInstalled=true;

    const VERSION="155";
    const HARD_CONTROL_SKIP_MS=300;
    const DRAGON_REPEAT_BY_LEVEL=[5,10,20,30,40];
    const PHOENIX_BURN_BY_LEVEL=[5,7,9,11,13];
    const FINAL_BOSS_ORDER=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const FINAL_BOSS_RULES={
        東帝天尊:{element:"earth",skills:["dustStorm","stoneBreakSky"],supports:["barrier"]},
        天帝天尊:{element:"wind",skills:["windHowlLightning","stormRain","stormSpell"],supports:[]},
        極帝天尊:{element:"light",skills:[],supports:["yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"]},
        北帝天尊:{element:"water",skills:["iceArrowRain","freeze"],supports:["healSpell"]},
        南帝天尊:{element:"fire",skills:["phoenixCry","dragonSlash"],supports:["rage"]}
    };
    const FINAL_ELITE_RULES=[
        {element:"water",skills:["frostCrush"],supports:[]},
        {element:"earth",skills:["stoneThrow"],supports:[]},
        {element:"fire",skills:["fireBurstStrike"],supports:[]},
        {element:"wind",skills:[],supports:["stealthSkill"]},
        {element:"water",skills:["frostCrush"],supports:[]}
    ];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function copyValue(value){ return Array.isArray(value)?value.slice():value; }

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        Object.keys(fields).forEach(key=>{ skillDatabase[id][key]=copyValue(fields[key]); });
    }

    patchSkill("dragonSlash",{
        learnCost:45,maxLevel:5,upgradeCost:1,targetType:"single",
        baseDamage:165,damagePerLevel:25,spCost:65,requires:["explosiveFlurry"],
        repeatChanceByLevel:DRAGON_REPEAT_BY_LEVEL,repeatChance:DRAGON_REPEAT_BY_LEVEL[0],
        repeatMaxCasts:2,
        description:"需先學習火爆亂擊。初次學習需45技能點，對單體造成165點傷害，消耗65 SP；再施放率依等級為5%/10%/20%/30%/40%，首次追加若爆擊或擊敗目標可再追加一次，最多追加2次。最高5級，每升1級消耗1技能點，傷害+25。"
    });
    patchSkill("phoenixCry",{
        learnCost:45,maxLevel:5,upgradeCost:1,targetType:"all",
        baseDamage:60,damagePerLevel:18,spCost:68,requires:["flameTornado"],
        burnChance:70,burnDuration:2,burnPercentByLevel:PHOENIX_BURN_BY_LEVEL,
        burnBonusOnNoTargetsPercent:50,burnBonusDuration:1,
        description:"需先學習烈焰龍捲。初次學習需45技能點，對敵方全體各造成60點傷害，消耗68 SP；最高5級，每升1級消耗1技能點，傷害+18。70%基礎機率燃燒2回合，每回合造成目標最大HP的5%/7%/9%/11%/13%；本次未使任何目標燃燒時，下一回合火鳳天鳴傷害+50%。"
    });
    patchSkill("yuanXiangGuangMing",{
        targetType:"allyAll",baseHeal:150,baseHealSP:55,
        description:"我方全體回復150 HP、55 SP。"
    });
    patchSkill("yuanGuangShield",{
        targetType:"allyAll",shieldAmount:100,shieldDuration:2,
        description:"我方全體獲得100護盾，持續2回合。"
    });
    patchSkill("yuanZuBlessing",{
        targetType:"allyAll",cleanseChance:20,evasionBonusPercent:30,
        duration:2,
        description:"對我方全體施放祝福，有20%機率解除所有負面狀態，並增加閃避30%，持續2回合。"
    });
    if(typeof skillDatabase!=="undefined"&&skillDatabase.yuanZuBlessing){
        delete skillDatabase.yuanZuBlessing.agilityBonusPercent;
    }

    function installMonsterOnlyFireBurst(){
        if(typeof skillDatabase==="undefined"||!skillDatabase.fireCritical){ return; }
        const skill=Object.assign({},skillDatabase.fireCritical,{
            id:"fireBurstStrike",name:"火爆一擊",monsterOnly:true
        });
        try{
            Object.defineProperty(skillDatabase,"fireBurstStrike",{
                value:skill,writable:true,configurable:true,enumerable:false
            });
        }catch(_){ skillDatabase.fireBurstStrike=skill; }
        const manifest=window.v143SkillAnimationManifest;
        if(manifest){
            manifest.fireBurstStrike=Object.assign({},manifest.fireCritical||{}, {
                glyph:"爆",motion:"dash",impact:"burst-knuckle",hit:.65,pulses:3,spread:46
            });
        }
    }
    installMonsterOnlyFireBurst();

    function rosterMonsters(roster){
        if(!Array.isArray(roster)){ return []; }
        return roster.map(item=>{
            if(item&&typeof item==="object"){ return item; }
            return typeof monsters!=="undefined"?monsters[item]:null;
        }).filter(Boolean);
    }

    function isFinalAbyssRoster(roster){
        const entries=rosterMonsters(roster);
        return FINAL_BOSS_ORDER.every(name=>entries.some(monster=>monster.v141Abyss&&monster.name===name))&&
            entries.filter(monster=>monster.v141Abyss&&monster.name==="天兵天將").length>=5;
    }

    function patchFinalAbyssRoster(roster){
        if(!isFinalAbyssRoster(roster)){ return roster; }
        const entries=rosterMonsters(roster);
        const bosses=FINAL_BOSS_ORDER.map(name=>entries.find(monster=>monster.v141Abyss&&monster.name===name));
        const elites=entries.filter(monster=>monster.v141Abyss&&monster.name==="天兵天將").slice(0,5);

        bosses.forEach((monster,position)=>{
            const rule=FINAL_BOSS_RULES[monster.name];
            monster.element=rule.element;
            monster.skillIds=rule.skills.slice();
            monster.v141SupportSkillIds=rule.supports.slice();
            monster.v141ForceSkillLevel=5;
            monster.v141SkillLevel=5;
            monster.v144SkillLevel=5;
            monster.v141FormationRow=0;
            monster.v141FormationPosition=position;
            monster.skillChance=monster.name==="極帝天尊"?1:.78;
            monster.v141AbyssAi=monster.name==="極帝天尊"?"v155-support":"v155-combat";
            monster.v155FinalAbyss=true;
        });
        elites.forEach((monster,position)=>{
            const rule=FINAL_ELITE_RULES[position];
            monster.name="天兵天將";
            monster.element=rule.element;
            monster.skillIds=rule.skills.slice();
            monster.v141SupportSkillIds=rule.supports.slice();
            monster.v141ForceSkillLevel=1;
            monster.v141SkillLevel=1;
            monster.v144SkillLevel=1;
            monster.v141FormationRow=1;
            monster.v141FormationPosition=position;
            monster.skillChance=.78;
            monster.v141AbyssAi="v155-combat";
            monster.v155FinalAbyss=true;
        });
        if(roster.every(item=>item&&typeof item==="object")&&roster.length===10){
            roster.splice(0,roster.length,...bosses,...elites);
        }
        roster.v155FinalAbyss=true;
        return roster;
    }
    window.v155PatchFinalAbyssRoster=patchFinalAbyssRoster;

    if(typeof window.v144PatchFinalAbyssRoster==="function"){
        const previousPatchFinalAbyssRoster=window.v144PatchFinalAbyssRoster;
        window.v144PatchFinalAbyssRoster=function(roster){
            const result=previousPatchFinalAbyssRoster.apply(this,arguments);
            return patchFinalAbyssRoster(result||roster);
        };
    }

    if(typeof window.v132LaunchDungeonBattle==="function"){
        const previousLaunchDungeonBattle=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=function(roster){
            patchFinalAbyssRoster(roster);
            const result=previousLaunchDungeonBattle.apply(this,arguments);
            patchFinalAbyssRoster(roster);
            return result;
        };
    }

    function patchCurrentFinalAbyssRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return; }
        patchFinalAbyssRoster(currentBattleMonsters.map(index=>monsters[index]));
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            patchCurrentFinalAbyssRoster();
            const result=previousRenderBattle.apply(this,arguments);
            patchCurrentFinalAbyssRoster();
            return result;
        };
    }

    function hardControlled(character){
        return !!(character&&(
            (typeof isMonsterFrozen==="function"&&isMonsterFrozen(character))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(character))
        ));
    }

    function withForcedFinalAbyssSkillLevel(monster,callback){
        const forced=Math.max(1,Math.floor(numeric(monster&&monster.v141ForceSkillLevel)||1));
        if(!monster||!monster.v155FinalAbyss||typeof skillDatabase==="undefined"){
            return callback();
        }
        const ids=Array.from(new Set((monster.skillIds||[]).concat(monster.v141SupportSkillIds||[])));
        const backups=[];
        ids.forEach(id=>{
            const skill=skillDatabase[id];
            if(!skill){ return; }
            const level=Math.min(forced,Math.max(1,Math.floor(numeric(skill.maxLevel)||1)));
            const backup={skill:skill,fields:{}};
            function save(key){
                if(Object.prototype.hasOwnProperty.call(skill,key)&&!Object.prototype.hasOwnProperty.call(backup.fields,key)){
                    backup.fields[key]=skill[key];
                }
            }
            save("maxLevel");
            skill.maxLevel=1;
            [["baseDamage","damagePerLevel"],["baseHeal","healPerLevel"],["baseHealSP","healSPPerLevel"]]
                .forEach(keys=>{
                    const baseKey=keys[0],perKey=keys[1];
                    if(!Object.prototype.hasOwnProperty.call(skill,baseKey)){ return; }
                    save(baseKey); save(perKey);
                    skill[baseKey]=numeric(skill[baseKey])+numeric(skill[perKey])*(level-1);
                    if(Object.prototype.hasOwnProperty.call(skill,perKey)){ skill[perKey]=0; }
                });
            Object.keys(skill).forEach(key=>{
                if(!/ByLevel$/.test(key)||!Array.isArray(skill[key])||!skill[key].length){ return; }
                save(key);
                const value=skill[key][Math.min(skill[key].length-1,level-1)];
                skill[key]=[value];
            });
            backups.push(backup);
        });
        try{ return callback(); }
        finally{
            backups.forEach(backup=>{
                Object.keys(backup.fields).forEach(key=>{ backup.skill[key]=backup.fields[key]; });
            });
        }
    }
    window.v155WithForcedFinalAbyssSkillLevel=withForcedFinalAbyssSkillLevel;

    function withHardControlDelay(callback){
        const hadOverride=Object.prototype.hasOwnProperty.call(window,"__battleAdvanceDelayOverrideMs");
        const previousOverride=window.__battleAdvanceDelayOverrideMs;
        window.__battleAdvanceDelayOverrideMs=HARD_CONTROL_SKIP_MS;
        try{ return callback(); }
        finally{
            if(hadOverride){ window.__battleAdvanceDelayOverrideMs=previousOverride; }
            else{ delete window.__battleAdvanceDelayOverrideMs; }
        }
    }

    if(typeof beginCharacterTurn==="function"){
        const previousBeginCharacterTurn=beginCharacterTurn;
        beginCharacterTurn=function(){
            const character=typeof activeBattleCharacterIndex!=="undefined"&&typeof getPartyCharacterByIndex==="function"
                ?getPartyCharacterByIndex(activeBattleCharacterIndex):null;
            if(typeof battlePhase!=="undefined"&&battlePhase==="declare"&&hardControlled(character)){
                const that=this,args=arguments;
                return withHardControlDelay(()=>previousBeginCharacterTurn.apply(that,args));
            }
            return previousBeginCharacterTurn.apply(this,arguments);
        };
    }

    function currentRound(){ return typeof turn!=="undefined"?Math.max(0,numeric(turn)):0; }
    function currentBattleToken(){ return typeof battleToken!=="undefined"?battleToken:null; }

    function currentAbyssEntries(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>
            entry.monster&&entry.monster.alive!==false&&numeric(entry.monster.hp)>0
        );
    }

    function monsterBaseHp(monster){
        const shield=monster&&monster.v141Shield;
        return Math.max(0,numeric(monster&&monster.hp)-(shield?numeric(shield.remaining):0));
    }

    function monsterBaseMaxHp(monster){
        return Math.max(0,numeric(monster&&monster.v141Shield&&monster.v141Shield.baseMaxHP)||numeric(monster&&monster.maxHP));
    }

    function restoreMonsterSp(monster,amount){
        const before=Math.max(0,numeric(monster&&monster.sp));
        const max=Math.max(before,numeric(monster&&monster.maxSP));
        monster.sp=Math.min(max,before+Math.max(0,numeric(amount)));
        return monster.sp-before;
    }

    function removeDisplayBuff(monster,display){
        if(!monster||!display){ return; }
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==display);
    }

    function clearOldAgilityBlessing(monster){
        const blessing=monster&&monster.v142AgilityBlessing;
        if(!blessing){ return; }
        monster.agility=numeric(blessing.originalAgility);
        removeDisplayBuff(monster,blessing.displayBuff);
        delete monster.v142AgilityBlessing;
    }

    function applyEvasionBlessing(monster){
        if(!monster||monster.alive===false){ return; }
        clearOldAgilityBlessing(monster);
        let blessing=monster.v155EvasionBlessing;
        if(!blessing||blessing.battleToken!==currentBattleToken()){
            const display={type:"v141TeamBuff",v141BuffType:"dodge",turnsLeft:2};
            blessing={
                originalEvasion:numeric(monster.evasion),displayBuff:display,
                battleToken:currentBattleToken(),expiresTurn:currentRound()+2
            };
            monster.v155EvasionBlessing=blessing;
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
        }else{
            blessing.expiresTurn=currentRound()+2;
            blessing.displayBuff.turnsLeft=2;
        }
        monster.evasion=Math.round(blessing.originalEvasion*1.3);
    }

    function resolveExtremeEmperorAction(monsterIndex,forcedSkillId,forcedCleanse){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster||monster.name!=="極帝天尊"||monster.alive===false||numeric(monster.hp)<=0||hardControlled(monster)){
            return false;
        }
        monster.v141AbyssAi="v155-support";
        const allies=currentAbyssEntries();
        if(!allies.length){ return false; }
        const hasNegative=allies.some(entry=>Array.isArray(entry.monster.statusEffects)&&entry.monster.statusEffects.length>0);
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        const needsShield=allies.some(entry=>!(entry.monster.v141Shield&&numeric(entry.monster.v141Shield.remaining)>0));
        const needsBlessing=allies.some(entry=>!(entry.monster.v155EvasionBlessing&&
            entry.monster.v155EvasionBlessing.battleToken===currentBattleToken()&&
            currentRound()<numeric(entry.monster.v155EvasionBlessing.expiresTurn)));
        const skillId=forcedSkillId||(hasNegative?"yuanZuBlessing":needsHeal?"yuanXiangGuangMing":
            needsShield?"yuanGuangShield":needsBlessing?"yuanZuBlessing":null);
        const skill=skillId&&typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }

        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }
        if(skillId==="yuanXiangGuangMing"){
            allies.forEach(entry=>{
                const ally=entry.monster;
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,150):(function(){
                        const before=numeric(ally.hp);
                        ally.hp=Math.min(numeric(ally.maxHP),before+150);
                        return ally.hp-before;
                    })();
                const restored=restoreMonsterSp(ally,55);
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            if(typeof addBattleLog==="function"){ addBattleLog("極帝天尊施放元相光明：我方全體回復150 HP、55 SP。"); }
        }else if(skillId==="yuanGuangShield"){
            allies.forEach(entry=>{
                if(typeof window.v141ApplyMonsterShield==="function"){
                    window.v141ApplyMonsterShield(entry.monster,100,2);
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
            });
            if(typeof addBattleLog==="function"){ addBattleLog("極帝天尊施放元光護體：我方全體獲得100護盾，持續2回合。"); }
        }else if(skillId==="yuanZuBlessing"){
            const cleansed=forcedCleanse===undefined?Math.random()*100<20:!!forcedCleanse;
            let removed=0;
            allies.forEach(entry=>{
                const ally=entry.monster;
                if(cleansed&&Array.isArray(ally.statusEffects)){
                    removed+=ally.statusEffects.length;
                    ally.statusEffects=[];
                }
                applyEvasionBlessing(ally);
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog("極帝天尊施放元祖賜福：我方全體閃避提升30%，持續2回合；"+
                    (cleansed?"並解除"+removed+"個負面狀態。":"本次未觸發負面狀態解除。"));
            }
        }else{ return false; }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveExtremeEmperorAction=resolveExtremeEmperorAction;

    function resolveNorthHeal(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.healSpell:null;
        if(!monster||monster.name!=="北帝天尊"||!skill||hardControlled(monster)){ return false; }
        const allies=currentAbyssEntries();
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        if(!needsHeal||(forceCast!==true&&Math.random()>.55)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex);
        }
        const level=Math.max(1,numeric(skill.maxLevel)||1);
        const hpAmount=numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(level-1);
        const spAmount=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(level-1);
        allies.forEach(entry=>{
            const ally=entry.monster;
            const healed=typeof window.v141HealMonsterPreservingShield==="function"
                ?window.v141HealMonsterPreservingShield(ally,hpAmount):0;
            const restored=restoreMonsterSp(ally,spAmount);
            if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
            if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                const card=document.getElementById("battleMonster"+entry.index);
                if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
            }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("北帝天尊施放最高等級治療術：我方全體回復"+hpAmount+" HP、"+spAmount+" SP。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveNorthHeal=resolveNorthHeal;

    function activeMonsterStealth(monster){
        const state=monster&&monster.v155MonsterStealth;
        return !!(state&&state.battleToken===currentBattleToken()&&currentRound()<numeric(state.expiresTurn));
    }

    function resolveWindEliteStealth(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.stealthSkill:null;
        if(!monster||monster.name!=="天兵天將"||monster.element!=="wind"||!skill||hardControlled(monster)||activeMonsterStealth(monster)){
            return false;
        }
        const chance=monster.skillChance===undefined?.78:numeric(monster.skillChance);
        if((forceCast!==true&&Math.random()>chance)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex);
        }
        const display={type:"stealthSkill",v141BuffType:"stealth",turnsLeft:2};
        monster.v155MonsterStealth={
            battleToken:currentBattleToken(),expiresTurn:currentRound()+2,displayBuff:display
        };
        monster.activeBuffs=monster.activeBuffs||[];
        monster.activeBuffs.push(display);
        if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",monsterIndex,"buff"); }
        if(typeof addBattleLog==="function"){ addBattleLog("天兵天將施放隱身術，2回合內無法被單體技能選中。"); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveWindEliteStealth=resolveWindEliteStealth;

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss&&hardControlled(monster)){ return false; }
            if(monster&&monster.v155FinalAbyss){
                if(monster.name==="極帝天尊"){ return resolveExtremeEmperorAction(monsterIndex); }
                if(monster.name==="北帝天尊"){ return resolveNorthHeal(monsterIndex); }
                if(monster.name==="天帝天尊"){ return false; }
                if(monster.name==="天兵天將"&&monster.element==="wind"){
                    return resolveWindEliteStealth(monsterIndex);
                }
            }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    function actionIsSingle(actionType){
        if(actionType==="normal"){ return true; }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[actionType]:null;
        return !!(skill&&skill.targetType==="single");
    }

    if(typeof setBattleTargetSelectionMode==="function"){
        const previousSetTargetMode=setBattleTargetSelectionMode;
        setBattleTargetSelectionMode=function(actionType){
            const result=previousSetTargetMode.apply(this,arguments);
            if(actionIsSingle(actionType)&&typeof currentBattleMonsters!=="undefined"&&typeof document!=="undefined"){
                currentBattleMonsters.forEach(index=>{
                    if(!activeMonsterStealth(monsters[index])){ return; }
                    const card=document.getElementById("battleMonster"+index);
                    if(card){ card.classList.remove("targetable","target"); }
                });
            }
            return result;
        };
    }

    if(typeof selectBattleTarget==="function"){
        const previousSelectBattleTarget=selectBattleTarget;
        selectBattleTarget=function(index){
            const action=typeof pendingAction!=="undefined"?pendingAction:null;
            if(activeMonsterStealth(typeof monsters!=="undefined"?monsters[index]:null)&&(!action||actionIsSingle(action))){
                return;
            }
            return previousSelectBattleTarget.apply(this,arguments);
        };
    }

    if(typeof getSkillTargets==="function"){
        const previousGetSkillTargets=getSkillTargets;
        getSkillTargets=function(centerIndex,targetType){
            if(targetType==="single"&&activeMonsterStealth(typeof monsters!=="undefined"?monsters[centerIndex]:null)){
                return [];
            }
            return previousGetSkillTargets.apply(this,arguments);
        };
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            if(queued&&actionIsSingle(queued.action)&&activeMonsterStealth(typeof monsters!=="undefined"?monsters[queued.target]:null)){
                const fallback=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters.find(index=>
                    monsters[index]&&monsters[index].alive&&!activeMonsterStealth(monsters[index])
                ):undefined;
                if(fallback===undefined){ queued.action="defend"; queued.target=null; }
                else{ queued.target=fallback; }
            }
            return previousResolveQueuedAction.apply(this,arguments);
        };
    }

    function removeEvasionBlessing(monster){
        const blessing=monster&&monster.v155EvasionBlessing;
        if(!blessing){ return; }
        monster.evasion=numeric(blessing.originalEvasion);
        removeDisplayBuff(monster,blessing.displayBuff);
        delete monster.v155EvasionBlessing;
    }

    function removeMonsterStealth(monster){
        const state=monster&&monster.v155MonsterStealth;
        if(!state){ return; }
        removeDisplayBuff(monster,state.displayBuff);
        delete monster.v155MonsterStealth;
    }

    function tickV155TimedStates(){
        const token=currentBattleToken();
        const round=currentRound();
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach(monster=>{
                const blessing=monster&&monster.v155EvasionBlessing;
                if(blessing){
                    if(blessing.battleToken!==token||round>=numeric(blessing.expiresTurn)){ removeEvasionBlessing(monster); }
                    else{ blessing.displayBuff.turnsLeft=Math.max(1,numeric(blessing.expiresTurn)-round); }
                }
                const stealth=monster&&monster.v155MonsterStealth;
                if(stealth){
                    if(stealth.battleToken!==token||round>=numeric(stealth.expiresTurn)){ removeMonsterStealth(monster); }
                    else{ stealth.displayBuff.turnsLeft=Math.max(1,numeric(stealth.expiresTurn)-round); }
                }
                const phoenix=monster&&monster.v155PhoenixDamageBuff;
                if(phoenix&&(phoenix.battleToken!==token||round>=numeric(phoenix.expiresTurn))){
                    delete monster.v155PhoenixDamageBuff;
                }
            });
        }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            getExistingPartyIndexes().forEach(index=>{
                const character=getPartyCharacterByIndex(index);
                const phoenix=character&&character.v155PhoenixDamageBuff;
                if(phoenix&&(phoenix.battleToken!==token||round>=numeric(phoenix.expiresTurn))){
                    delete character.v155PhoenixDamageBuff;
                }
            });
        }
    }

    if(typeof startTurn==="function"){
        const previousStartTurn=startTurn;
        startTurn=function(){
            tickV155TimedStates();
            return previousStartTurn.apply(this,arguments);
        };
    }

    let phoenixCastContext=null;

    function phoenixBuffReady(actor){
        const buff=actor&&actor.v155PhoenixDamageBuff;
        return !!(buff&&buff.battleToken===currentBattleToken()&&buff.readyTurn===currentRound()&&
            currentRound()<numeric(buff.expiresTurn));
    }

    function finalizePhoenixCast(context){
        if(!context||!context.castStarted||!context.actor){ return; }
        if(phoenixBuffReady(context.actor)){ delete context.actor.v155PhoenixDamageBuff; }
        if(context.burnTargets.size<1){
            context.actor.v155PhoenixDamageBuff={
                battleToken:currentBattleToken(),readyTurn:currentRound()+1,expiresTurn:currentRound()+2
            };
            if(typeof addBattleLog==="function"){
                addBattleLog("火鳳天鳴本次未使任何目標燃燒，下一回合火鳳天鳴傷害提升50%。");
            }
        }
    }

    function withPhoenixCast(side,actor,actorIndex,callback){
        const previousContext=phoenixCastContext;
        const context={side:side,actor:actor,actorIndex:actorIndex,castStarted:false,burnTargets:new Set()};
        phoenixCastContext=context;
        try{ return callback(); }
        finally{
            finalizePhoenixCast(context);
            phoenixCastContext=previousContext;
        }
    }

    function wrapPlayerPhoenixCast(name,skillArgumentIndex,casterFromArguments,indexFromArguments){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            if(args[skillArgumentIndex]!=="phoenixCry"){ return previous.apply(this,args); }
            const that=this;
            return withPhoenixCast("player",casterFromArguments(args),indexFromArguments(args),()=>previous.apply(that,args));
        };
    }

    wrapPlayerPhoenixCast("castDamageSkill",0,()=>typeof player!=="undefined"?player:null,()=>0);
    wrapPlayerPhoenixCast("castSecondaryCharacterSkill",1,args=>typeof getPartyCharacterByIndex==="function"
        ?getPartyCharacterByIndex(Math.max(0,Math.floor(numeric(args[0])))):null,args=>Math.max(0,Math.floor(numeric(args[0]))));
    wrapPlayerPhoenixCast("castPlayer2Skill",0,()=>typeof player2!=="undefined"?player2:null,()=>1);

    if(typeof showSkillNameBadge==="function"){
        const previousShowSkillBadge=showSkillNameBadge;
        showSkillNameBadge=function(name,element,actorIndex){
            if(phoenixCastContext&&phoenixCastContext.side==="player"&&name==="火鳳天鳴"&&
                (actorIndex===undefined||numeric(actorIndex)===numeric(phoenixCastContext.actorIndex))){
                phoenixCastContext.castStarted=true;
            }
            return previousShowSkillBadge.apply(this,arguments);
        };
    }

    if(typeof showMonsterSkillNameBadge==="function"){
        const previousShowMonsterBadge=showMonsterSkillNameBadge;
        showMonsterSkillNameBadge=function(name,element,monsterIndex){
            if(phoenixCastContext&&phoenixCastContext.side==="monster"&&name==="火鳳天鳴"&&
                numeric(monsterIndex)===numeric(phoenixCastContext.actorIndex)){
                phoenixCastContext.castStarted=true;
            }
            return previousShowMonsterBadge.apply(this,arguments);
        };
    }

    if(typeof applyBurnEffect==="function"){
        const previousApplyBurn=applyBurnEffect;
        applyBurnEffect=function(target){
            const result=previousApplyBurn.apply(this,arguments);
            if(phoenixCastContext&&phoenixCastContext.castStarted&&target){ phoenixCastContext.burnTargets.add(target); }
            return result;
        };
    }

    if(typeof calculateSkillDamage==="function"){
        const previousCalculateSkillDamage=calculateSkillDamage;
        calculateSkillDamage=function(){
            const result=previousCalculateSkillDamage.apply(this,arguments);
            return phoenixCastContext&&phoenixCastContext.side==="player"&&phoenixCastContext.castStarted&&
                phoenixBuffReady(phoenixCastContext.actor)?Math.floor(numeric(result)*1.5):result;
        };
    }

    if(typeof calculateDamage==="function"){
        const previousCalculateDamage=calculateDamage;
        calculateDamage=function(){
            const result=previousCalculateDamage.apply(this,arguments);
            return phoenixCastContext&&phoenixCastContext.side==="monster"&&phoenixCastContext.castStarted&&
                phoenixBuffReady(phoenixCastContext.actor)?Math.floor(numeric(result)*1.5):result;
        };
    }

    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const that=this,args=arguments;
            const invoke=()=>withPhoenixCast("monster",monster,monsterIndex,()=>previousMonsterAttack.apply(that,args));
            const invokeAtForcedLevel=()=>withForcedFinalAbyssSkillLevel(monster,invoke);
            return hardControlled(monster)?withHardControlDelay(invokeAtForcedLevel):invokeAtForcedLevel();
        };
    }

    patchCurrentFinalAbyssRoster();

    window.v155RuleDiagnostics=function(){
        return {
            version:VERSION,hardControlSkipMs:HARD_CONTROL_SKIP_MS,
            dragonRepeatChanceByLevel:DRAGON_REPEAT_BY_LEVEL.slice(),
            phoenixBurnByLevel:PHOENIX_BURN_BY_LEVEL.slice(),
            monsterOnlyFireBurst:!!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike)
        };
    };
})();
