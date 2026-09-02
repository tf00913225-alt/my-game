/* =====================================================
   V155 — hard-control pacing, final Abyss skills and fire ultimates
===================================================== */
(function installV155DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v155DevFixesInstalled){ return; }
    window.__v155DevFixesInstalled=true;

    const VERSION="155";
    const HARD_CONTROL_SKIP_MS=300;
    const FINAL_BOSS_ORDER=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const FINAL_BOSS_RULES={
        東帝天尊:{element:"earth",skills:["dustStorm","stoneBreakSky"],supports:["earthShield"]},
        天帝天尊:{element:"wind",skills:["windHowlLightning","stormRain"],supports:["dinghaishenzhen"]},
        極帝天尊:{element:"light",skills:[],supports:["yuanZuBlessing"]},
        北帝天尊:{element:"water",skills:["iceArrowRain"],supports:["revive","healSpell"]},
        南帝天尊:{element:"fire",skills:["dragonSlash","flameTornado"],supports:["rage"]}
    };
    const FINAL_ELITE_RULES=[
        {element:"water",skills:[],supports:["healSpell"]},
        {element:"earth",skills:["stoneBreakSky"],supports:[]},
        {element:"fire",skills:["flameTornado"],supports:[]},
        {element:"wind",skills:[],supports:["dodgeSkill"]},
        {element:"water",skills:[],supports:["healSpell"]}
    ];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        return numeric(values[Math.min(values.length-1,Math.max(0,Math.floor(numeric(level)||1)-1))]);
    }

    function copyValue(value){ return Array.isArray(value)?value.slice():value; }

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        Object.keys(fields).forEach(key=>{ skillDatabase[id][key]=copyValue(fields[key]); });
    }

    patchSkill("yuanXiangGuangMing",{
        targetType:"allyAll",baseHeal:150,baseHealSP:55,
        description:"我方全體回復150 HP、55 SP。"
    });
    patchSkill("yuanGuangShield",{
        targetType:"allyAll",shieldAmount:100,shieldDuration:2,
        description:"我方全體獲得100護盾，持續2回合。"
    });
    patchSkill("yuanZuBlessing",{
        targetType:"allyAll",baseHeal:100,baseHealSP:100,
        cleanseChance:35,evasionBonusPercent:35,
        duration:2,
        description:"對我方全體施放祝福，每個目標獨立有35%機率解除身上負面狀態，恢復100 HP、100 SP，並增加閃避35%，持續2回合。"
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
            monster.v141ForceSkillLevel=5;
            monster.v141SkillLevel=5;
            monster.v144SkillLevel=5;
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
            [
                ["baseDamage","damagePerLevel"],
                ["powerMultiplier","powerPerLevel"],
                ["flatDamage","flatDamagePerLevel"],
                ["baseHeal","healPerLevel"],
                ["baseHealSP","healSPPerLevel"]
            ]
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

    function restoreMonsterHp(monster,amount){
        if(!monster||monster.alive===false){ return 0; }
        if(typeof window.v141HealMonsterPreservingShield==="function"){
            return window.v141HealMonsterPreservingShield(monster,amount);
        }
        const shield=monster.v141Shield;
        const shieldAmount=shield?Math.max(0,numeric(shield.remaining)):0;
        const before=Math.max(0,numeric(monster.hp)-shieldAmount);
        const max=Math.max(before,monsterBaseMaxHp(monster));
        const after=Math.min(max,before+Math.max(0,numeric(amount)));
        monster.hp=after+shieldAmount;
        return after-before;
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

    function combineEvasion(sources){
        if(typeof window.v173CombineEvasionRates==="function"){
            return window.v173CombineEvasionRates(sources);
        }
        const remaining=(sources||[]).reduce((chance,source)=>
            chance*(1-Math.max(0,Math.min(100,numeric(source)))/100),1
        );
        return Math.min(85,(1-remaining)*100);
    }

    function ensureV155EvasionBase(monster){
        if(!Object.prototype.hasOwnProperty.call(monster,"v155EvasionBase")){
            monster.v155EvasionBase=numeric(monster.evasion);
        }
        return numeric(monster.v155EvasionBase);
    }

    function recomputeV155Evasion(monster){
        if(!monster){ return; }
        const sources=[];
        if(monster.v155EvasionBlessing){ sources.push(numeric(monster.v155EvasionBlessing.bonusPercent)); }
        if(monster.v155WindDodge){ sources.push(numeric(monster.v155WindDodge.bonusPercent)); }
        if(!sources.length){
            if(Object.prototype.hasOwnProperty.call(monster,"v155EvasionBase")){
                monster.evasion=numeric(monster.v155EvasionBase);
                delete monster.v155EvasionBase;
            }
            return;
        }
        monster.evasion=combineEvasion([ensureV155EvasionBase(monster)].concat(sources));
    }

    function applyEvasionBlessing(monster,bonusPercent,duration){
        if(!monster||monster.alive===false){ return false; }
        const bonus=Math.max(0,numeric(bonusPercent));
        const turns=Math.max(1,Math.floor(numeric(duration)||1));
        const existing=monster.v155EvasionBlessing;
        if(
            existing&&existing.battleToken===currentBattleToken()&&
            currentRound()<numeric(existing.expiresTurn)
        ){
            if(typeof window.v173CanApplyNamedPersistentState==="function"){
                window.v173CanApplyNamedPersistentState(
                    monster,"元祖賜福","monster",
                    typeof monsters!=="undefined"?monsters.indexOf(monster):undefined,
                    "元祖賜福"
                );
            }
            return false;
        }
        clearOldAgilityBlessing(monster);
        const display={
            type:"v141TeamBuff",v141BuffType:"dodge",statusName:"元祖賜福",turnsLeft:turns
        };
        const blessing={
            type:"v141TeamBuff",statusName:"元祖賜福",turnsLeft:turns,
            originalEvasion:ensureV155EvasionBase(monster),bonusPercent:bonus,displayBuff:display,
            battleToken:currentBattleToken(),expiresTurn:currentRound()+turns
        };
        monster.v155EvasionBlessing=blessing;
        monster.activeBuffs=monster.activeBuffs||[];
        monster.activeBuffs.push(display);
        recomputeV155Evasion(monster);
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(blessing,"元祖賜福");
            window.v173MarkPersistentStateName(display,"元祖賜福");
        }
        return true;
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
        const needsBlessing=allies.some(entry=>!(entry.monster.v155EvasionBlessing&&
            entry.monster.v155EvasionBlessing.battleToken===currentBattleToken()&&
            currentRound()<numeric(entry.monster.v155EvasionBlessing.expiresTurn)));
        const skillId=forcedSkillId||((hasNegative||needsHeal||needsBlessing)?"yuanZuBlessing":null);
        const skill=skillId&&typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(skillId!=="yuanZuBlessing"||!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }

        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }
        if(skillId==="yuanZuBlessing"){
            let removed=0;
            let cleansedTargets=0;
            let blessedTargets=0;
            let healedTotal=0;
            let restoredSpTotal=0;
            allies.forEach((entry,index)=>{
                const ally=entry.monster;
                if(applyEvasionBlessing(ally,skill.evasionBonusPercent,skill.duration)){ blessedTargets++; }
                const healed=restoreMonsterHp(ally,skill.baseHeal);
                const restored=restoreMonsterSp(ally,skill.baseHealSP);
                healedTotal+=healed;
                restoredSpTotal+=restored;
                const cleansed=forcedCleanse===undefined
                    ?Math.random()*100<numeric(skill.cleanseChance)
                    :Array.isArray(forcedCleanse)
                    ?!!forcedCleanse[index]
                    :!!forcedCleanse;
                if(cleansed&&Array.isArray(ally.statusEffects)){
                    cleansedTargets++;
                    removed+=ally.statusEffects.length;
                    ally.statusEffects=[];
                }
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog("極帝天尊施放元祖賜福：全體各恢復100 HP、100 SP（實際 "+healedTotal+" HP／"+
                    restoredSpTotal+" SP）；"+blessedTargets+"名友方獲得閃避提升35%，持續2回合；"+
                    cleansedTargets+"名目標觸發35%獨立淨化，共解除"+removed+"個負面狀態。");
            }
        }else{ return false; }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveExtremeEmperorAction=resolveExtremeEmperorAction;

    function supportCastAllowed(monster,forceCast){
        const chance=monster&&monster.skillChance!==undefined?numeric(monster.skillChance):.55;
        return forceCast===true||Math.random()<=chance;
    }

    function currentAbyssEntriesIncludingDefeated(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>!!entry.monster);
    }

    function allyTriTargets(monsterIndex){
        const living=currentAbyssEntries();
        return typeof window.v141GetMonsterAllyTriTargets==="function"
            ?window.v141GetMonsterAllyTriTargets(monsterIndex,living)
            :living.slice(0,3);
    }

    function hasNamedState(monster,stateName){
        if(typeof window.v173HasNamedPersistentState==="function"){
            return window.v173HasNamedPersistentState(monster,stateName);
        }
        return (monster&&((monster.activeBuffs||[]).concat(monster.v141TeamBuffs||[]))).some(buff=>
            buff&&numeric(buff.turnsLeft)>0&&(
                buff.statusName===stateName||buff.type===stateName||buff.v141BuffType===stateName
            )
        );
    }

    function markNamedState(entry,stateName){
        if(typeof window.v173MarkPersistentStateName==="function"){
            window.v173MarkPersistentStateName(entry,stateName);
        }else if(entry){
            entry.statusName={earthShield:"萬象土盾",dinghaishenzhen:"氣定神閒",dodgeSkill:"風行"}[stateName]||stateName;
        }
    }

    function canApplyNamedState(monster,stateName,index,sourceName){
        return typeof window.v173CanApplyNamedPersistentState==="function"
            ?window.v173CanApplyNamedPersistentState(monster,stateName,"monster",index,sourceName)
            :!hasNamedState(monster,stateName);
    }

    function registerMonsterTeamBuff(monster,buff,display){
        buff.displayBuff=display;
        monster.v141TeamBuffs=monster.v141TeamBuffs||[];
        monster.v141TeamBuffs.push(buff);
        monster.activeBuffs=monster.activeBuffs||[];
        monster.activeBuffs.push(display);
    }

    function finalSkillLevel(monster,skill){
        const max=Math.max(1,Math.floor(numeric(skill&&skill.maxLevel)||1));
        const requested=Math.max(1,Math.floor(
            numeric(monster&&monster.v141ForceSkillLevel)||numeric(monster&&monster.v141SkillLevel)||max
        ));
        return Math.min(max,requested);
    }

    function resolveNorthHeal(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.healSpell:null;
        if(!monster||monster.name!=="北帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const allies=allyTriTargets(monsterIndex);
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        if(!needsHeal||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex);
        }
        const level=finalSkillLevel(monster,skill);
        const hpAmount=numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(level-1);
        const spAmount=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(level-1);
        let cleansed=0;
        allies.forEach(entry=>{
            const ally=entry.monster;
            const healed=restoreMonsterHp(ally,hpAmount);
            const restored=restoreMonsterSp(ally,spAmount);
            if(skill.cleanseAll&&Array.isArray(ally.statusEffects)){
                cleansed+=ally.statusEffects.length;
                ally.statusEffects=[];
            }
            if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
            if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                const card=document.getElementById("battleMonster"+entry.index);
                if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
            }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("北帝天尊施放最高等級治療術：同排最多"+allies.length+"名友方各回復"+
                hpAmount+" HP、"+spAmount+" SP"+(skill.cleanseAll?"，並解除"+cleansed+"個負面狀態":"")+"。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveNorthHeal=resolveNorthHeal;

    function resolveNorthRevive(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.revive:null;
        if(!monster||monster.name!=="北帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const defeated=currentAbyssEntriesIncludingDefeated().filter(entry=>
            entry.index!==monsterIndex&&(entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        ).sort((left,right)=>(right.monster.rank==="boss")-(left.monster.rank==="boss")||left.index-right.index);
        const target=defeated[0];
        if(!target||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex);
        }
        const level=finalSkillLevel(monster,skill);
        const percent=levelValue(skill.reviveHealPercentByLevel,level,100);
        const maxHp=Math.max(1,numeric(target.monster.maxHP)||monsterBaseMaxHp(target.monster));
        const restored=Math.max(1,Math.floor(maxHp*percent/100));
        target.monster.hp=Math.min(maxHp,restored);
        target.monster.alive=true;
        if(typeof showMonsterHit==="function"){ showMonsterHit(target.index,target.monster.hp,"heal"); }
        if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",target.index,"revive"); }
        if(typeof addBattleLog==="function"){
            addBattleLog("北帝天尊施放最高等級復活術，使"+target.monster.name+"以"+percent+"% HP復活。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveNorthRevive=resolveNorthRevive;

    function resolveNorthSupport(monsterIndex,forceCast){
        const hasDefeated=currentAbyssEntriesIncludingDefeated().some(entry=>
            entry.index!==monsterIndex&&(entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        );
        return hasDefeated
            ?resolveNorthRevive(monsterIndex,forceCast)
            :resolveNorthHeal(monsterIndex,forceCast);
    }
    window.v155ResolveNorthSupport=resolveNorthSupport;

    function resolveEastEarthShield(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.earthShield:null;
        if(!monster||monster.name!=="東帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targets=allyTriTargets(monsterIndex).filter(entry=>!hasNamedState(entry.monster,"萬象土盾"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"earth",monsterIndex);
        }
        const duration=Math.max(1,Math.floor(numeric(skill.duration)||3));
        const percent=Math.max(0,numeric(skill.reflectPercent)||50);
        let applied=0;
        targets.forEach(entry=>{
            if(!canApplyNamedState(entry.monster,"earthShield",entry.index,skill.name)){ return; }
            const display={type:"earthShield",v141BuffType:"earthShield",turnsLeft:duration,percent:percent};
            const buff={type:"earthShield",turnsLeft:duration,percent:percent};
            markNamedState(display,"earthShield");
            markNamedState(buff,"earthShield");
            registerMonsterTeamBuff(entry.monster,buff,display);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("東帝天尊施放萬象土盾，同排"+applied+"名友方獲得"+percent+"%反傷，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveEastEarthShield=resolveEastEarthShield;

    function resolveHeavenCalm(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.dinghaishenzhen:null;
        if(!monster||monster.name!=="天帝天尊"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targets=currentAbyssEntries().filter(entry=>!hasNamedState(entry.monster,"氣定神閒"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex);
        }
        const duration=Math.max(1,Math.floor(numeric(skill.duration)||3));
        const resistance=Math.max(0,numeric(skill.statusResistBonus)||65);
        const accuracy=Math.max(0,numeric(skill.accuracyBonusPercent)||50);
        let applied=0;
        targets.forEach(entry=>{
            if(!canApplyNamedState(entry.monster,"dinghaishenzhen",entry.index,skill.name)){ return; }
            const display={type:"v141TeamBuff",v141BuffType:"resistance",turnsLeft:duration,accuracyBonusPercent:accuracy};
            const buff={type:"resistance",turnsLeft:duration,amount:resistance,accuracyBonusPercent:accuracy};
            markNamedState(display,"dinghaishenzhen");
            markNamedState(buff,"dinghaishenzhen");
            entry.monster.resistance=numeric(entry.monster.resistance)+resistance;
            registerMonsterTeamBuff(entry.monster,buff,display);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("天帝天尊施放氣定神閒，"+applied+"名友方異常抗性提升"+resistance+"%、命中提升"+
                accuracy+"%，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveHeavenCalm=resolveHeavenCalm;

    function resolveWindEliteDodge(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.dodgeSkill:null;
        if(!monster||monster.name!=="天兵天將"||monster.element!=="wind"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){
            return false;
        }
        const targets=allyTriTargets(monsterIndex).filter(entry=>!hasNamedState(entry.monster,"風行"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex);
        }
        const duration=Math.max(1,Math.floor(numeric(skill.duration)||3));
        const percent=Math.max(0,numeric(skill.evasionBonusPercent)||75);
        let applied=0;
        targets.forEach(entry=>{
            const ally=entry.monster;
            if(!canApplyNamedState(ally,"dodgeSkill",entry.index,skill.name)){ return; }
            ensureV155EvasionBase(ally);
            const display={type:"dodgeSkill",v141BuffType:"dodge",turnsLeft:duration};
            const state={
                type:"dodgeSkill",turnsLeft:duration,bonusPercent:percent,displayBuff:display,
                battleToken:currentBattleToken(),expiresTurn:currentRound()+duration
            };
            markNamedState(display,"dodgeSkill");
            markNamedState(state,"dodgeSkill");
            ally.v155WindDodge=state;
            ally.activeBuffs=ally.activeBuffs||[];
            ally.activeBuffs.push(display);
            recomputeV155Evasion(ally);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("風屬性天兵天將施放閃躲術，同排"+applied+"名友方獲得【風行】，閃躲率提升"+
                percent+"%，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveWindEliteDodge=resolveWindEliteDodge;

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss&&hardControlled(monster)){ return false; }
            if(monster&&monster.v155FinalAbyss){
                if(monster.name==="東帝天尊"){ return resolveEastEarthShield(monsterIndex); }
                if(monster.name==="天帝天尊"){ return resolveHeavenCalm(monsterIndex); }
                if(monster.name==="極帝天尊"){ return resolveExtremeEmperorAction(monsterIndex); }
                if(monster.name==="北帝天尊"){ return resolveNorthSupport(monsterIndex); }
                if(monster.name==="天兵天將"&&monster.element==="wind"){
                    return resolveWindEliteDodge(monsterIndex);
                }
            }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    function removeEvasionBlessing(monster){
        const blessing=monster&&monster.v155EvasionBlessing;
        if(!blessing){ return; }
        removeDisplayBuff(monster,blessing.displayBuff);
        delete monster.v155EvasionBlessing;
        recomputeV155Evasion(monster);
    }

    function removeWindDodge(monster){
        const state=monster&&monster.v155WindDodge;
        if(!state){ return; }
        removeDisplayBuff(monster,state.displayBuff);
        delete monster.v155WindDodge;
        recomputeV155Evasion(monster);
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
                const dodge=monster&&monster.v155WindDodge;
                if(dodge){
                    if(dodge.battleToken!==token||round>=numeric(dodge.expiresTurn)){ removeWindDodge(monster); }
                    else{
                        dodge.turnsLeft=Math.max(1,numeric(dodge.expiresTurn)-round);
                        dodge.displayBuff.turnsLeft=dodge.turnsLeft;
                    }
                }
                if(monster&&Array.isArray(monster.activeBuffs)){
                    monster.activeBuffs=monster.activeBuffs.filter(buff=>{
                        if(!buff||buff.type!=="phoenixMight"){ return true; }
                        const active=buff.battleToken===token&&round<numeric(buff.expiresTurn);
                        if(active){ buff.turnsLeft=Math.max(1,numeric(buff.expiresTurn)-round); }
                        else if(typeof addBattleLog==="function"){
                            addBattleLog("⏳鳳威效果已結束。");
                        }
                        return active;
                    });
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
    let damageActorContext=null;
    let monsterReflectContext=null;

    function phoenixBuffReady(actor){
        const buff=actor&&Array.isArray(actor.activeBuffs)
            ?actor.activeBuffs.find(entry=>
                entry&&entry.type==="phoenixMight"&&numeric(entry.turnsLeft)>0
            )
            :null;
        return buff&&buff.battleToken===currentBattleToken()&&
            currentRound()>=numeric(buff.readyTurn)&&currentRound()<numeric(buff.expiresTurn)
            ?buff
            :null;
    }

    function finalizePhoenixCast(context){
        if(!context||!context.castStarted||!context.actor){ return; }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.phoenixCry:null;
        const threshold=Math.max(1,Math.floor(numeric(skill&&skill.burnBonusThreshold)||3));
        const bonusPercent=Math.max(0,numeric(skill&&skill.nextRoundDamageBonusPercent)||30);
        const duration=Math.max(1,Math.floor(numeric(skill&&skill.nextRoundDamageBonusDuration)||1));
        if(context.burnTargets.size<threshold){
            const targetSide=context.side==="player"?"player":"monster";
            const canApply=typeof window.v173CanApplyNamedPersistentState!=="function"||
                window.v173CanApplyNamedPersistentState(
                    context.actor,"phoenixMight",targetSide,context.actorIndex,"火鳳天鳴"
                );
            if(!canApply){ return; }
            const buff={
                type:"phoenixMight",statusName:"鳳威",turnsLeft:duration,
                battleToken:currentBattleToken(),readyTurn:currentRound()+1,
                expiresTurn:currentRound()+1+duration,bonusPercent:bonusPercent
            };
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,"phoenixMight");
            }
            context.actor.activeBuffs=context.actor.activeBuffs||[];
            context.actor.activeBuffs.push(buff);
            if(typeof addBattleLog==="function"){
                addBattleLog("火鳳天鳴本次成功新增燃燒少於"+threshold+"人，施法者獲得【鳳威】，下一回合造成的所有傷害提升"+bonusPercent+"%。");
            }
        }
    }

    function withDamageActor(actor,callback){
        const previousActor=damageActorContext;
        const previousReflectContext=monsterReflectContext;
        const actorIndex=actor&&typeof player!=="undefined"&&actor===player?0:
            actor&&typeof player2!=="undefined"&&actor===player2?1:
            actor&&typeof player3!=="undefined"&&actor===player3?2:null;
        if(!monsterReflectContext&&actorIndex!==null&&typeof currentBattleMonsters!=="undefined"&&typeof monsters!=="undefined"){
            monsterReflectContext={
                actor:actor,actorIndex:actorIndex,
                hpByMonster:new Map(currentBattleMonsters.map(index=>[monsters[index],monsterBaseHp(monsters[index])]))
            };
        }
        damageActorContext=actor||null;
        try{ return callback(); }
        finally{
            damageActorContext=previousActor;
            monsterReflectContext=previousReflectContext;
        }
    }

    function currentDamageActor(){
        return damageActorContext||window.v149CurrentDamageActor||null;
    }

    window.v155GetCurrentDamageActor=currentDamageActor;
    window.v155GetPhoenixMightMultiplier=function(actor){
        const buff=phoenixBuffReady(actor);
        return buff?1+numeric(buff.bonusPercent)/100:1;
    };

    function activeMonsterEarthShieldPercent(monster){
        return ((monster&&monster.activeBuffs||[]).concat(monster&&monster.v141TeamBuffs||[])).reduce((highest,buff)=>
            buff&&numeric(buff.turnsLeft)>0&&(
                buff.type==="earthShield"||buff.v141BuffType==="earthShield"||buff.statusName==="萬象土盾"
            )?Math.max(highest,numeric(buff.percent)):highest,0
        );
    }

    if(typeof showMonsterHit==="function"){
        const previousShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index,amount,type){
            const target=typeof monsters!=="undefined"?monsters[index]:null;
            const context=monsterReflectContext;
            const before=context&&target&&context.hpByMonster.has(target)
                ?numeric(context.hpByMonster.get(target)):null;
            const result=previousShowMonsterHit.apply(this,arguments);
            if(context&&target&&before!==null){
                const after=monsterBaseHp(target);
                context.hpByMonster.set(target,after);
                const actualLoss=Math.max(0,before-after);
                const percent=activeMonsterEarthShieldPercent(target);
                if(type==="hp"&&actualLoss>0&&percent>0&&numeric(context.actor.hp)>0){
                    const reflected=Math.max(1,Math.floor(actualLoss*percent/100));
                    context.actor.hp=Math.max(0,numeric(context.actor.hp)-reflected);
                    if(typeof showPlayerHit==="function"){
                        showPlayerHit(reflected,"hp",context.actorIndex,false);
                    }
                    if(typeof addBattleLog==="function"){
                        addBattleLog(target.name+"的萬象土盾反彈"+reflected+"點傷害。");
                    }
                }
            }
            return result;
        };
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
            if(result===true&&phoenixCastContext&&phoenixCastContext.castStarted&&target){
                phoenixCastContext.burnTargets.add(target);
            }
            return result;
        };
    }

    function wrapPlayerDamageActor(name,actorFromArguments){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const args=Array.prototype.slice.call(arguments);
            const actor=actorFromArguments(args);
            const that=this;
            return withDamageActor(actor,()=>previous.apply(that,args));
        };
    }

    wrapPlayerDamageActor("normalAttack",()=>typeof player!=="undefined"?player:null);
    wrapPlayerDamageActor("castDamageSkill",()=>typeof player!=="undefined"?player:null);
    wrapPlayerDamageActor("secondaryCharacterNormalAttack",args=>
        typeof getPartyCharacterByIndex==="function"
            ?getPartyCharacterByIndex(Math.max(0,Math.floor(numeric(args[0]))))
            :null
    );
    wrapPlayerDamageActor("castSecondaryCharacterSkill",args=>
        typeof getPartyCharacterByIndex==="function"
            ?getPartyCharacterByIndex(Math.max(0,Math.floor(numeric(args[0]))))
            :null
    );
    wrapPlayerDamageActor("player2NormalAttack",()=>typeof player2!=="undefined"?player2:null);
    wrapPlayerDamageActor("castPlayer2Skill",()=>typeof player2!=="undefined"?player2:null);

    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const that=this,args=arguments;
            const invoke=()=>withDamageActor(monster,()=>
                withPhoenixCast("monster",monster,monsterIndex,()=>previousMonsterAttack.apply(that,args))
            );
            const invokeAtForcedLevel=()=>withForcedFinalAbyssSkillLevel(monster,invoke);
            return hardControlled(monster)?withHardControlDelay(invokeAtForcedLevel):invokeAtForcedLevel();
        };
    }

    patchCurrentFinalAbyssRoster();

    window.v155RuleDiagnostics=function(){
        return {
            version:VERSION,hardControlSkipMs:HARD_CONTROL_SKIP_MS,
            elementalSkillDataOwnedByFinalLayers:true,
            monsterOnlyFireBurst:!!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike)
        };
    };
})();
