/* =====================================================
   V155 — hard-control pacing, final Abyss skills and fire ultimates
===================================================== */
(function installV155DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v155DevFixesInstalled){ return; }
    window.__v155DevFixesInstalled=true;

    const VERSION="155";

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
        cleanseChance:35,evasionBonusPercent:15,
        duration:2,
        description:"對我方全體施放祝福，每個目標獨立有35%機率解除身上負面狀態，恢復100 HP、100 SP，並使最終閃躲+15%，持續2回合。"
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
}
    installMonsterOnlyFireBurst();

    function hardControlled(character){
        return !!(character&&(
            (typeof isMonsterFrozen==="function"&&isMonsterFrozen(character))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(character))
        ));
    }

    function withForcedFinalAbyssSkillLevel(monster,callback){
        const forced=Math.max(1,Math.floor(numeric(monster&&monster.v141ForceSkillLevel)||1));
        if(!monster||!monster.v174TrueRealmFinal||typeof skillDatabase==="undefined"){
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
        return Math.min(85,(sources||[]).reduce(
            (sum,source)=>sum+numeric(source),
            0
        ));
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
            numeric(existing.displayBuff&&existing.displayBuff.turnsLeft)>0
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
        if(!monster||!(monster.v141SupportSkillIds||[]).includes("yuanZuBlessing")||monster.alive===false||numeric(monster.hp)<=0||hardControlled(monster)){
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
            numeric(entry.monster.v155EvasionBlessing.displayBuff&&entry.monster.v155EvasionBlessing.displayBuff.turnsLeft)>0));
        const skillId=forcedSkillId||((hasNegative||needsHeal||needsBlessing)?"yuanZuBlessing":null);
        const skill=skillId&&typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(skillId!=="yuanZuBlessing"||!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }

        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex,null,allies.map(entry=>entry.index),"monster",skill.targetType);
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
                    restoredSpTotal+" SP）；"+blessedTargets+"名友方獲得閃避提升"+numeric(skill.evasionBonusPercent)+"%，持續"+
                    numeric(skill.duration)+"回合；"+cleansedTargets+"名目標觸發35%獨立淨化，共解除"+removed+"個負面狀態。");
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

    function allyTriTargeting(monsterIndex){
        const living=currentAbyssEntries();
        if(typeof window.v141GetMonsterAllyTriTargeting==="function"){
            return window.v141GetMonsterAllyTriTargeting(monsterIndex,living);
        }
        const entries=typeof window.v141GetMonsterAllyTriTargets==="function"
            ?window.v141GetMonsterAllyTriTargets(monsterIndex,living)
            :living.slice(0,3);
        return {entries:entries,primaryIndex:entries[0]?entries[0].index:null};
    }
    function allyTriTargets(monsterIndex){
        return allyTriTargeting(monsterIndex).entries;
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
            entry.statusName={earthShield:"萬象土盾",rockWall:"岩石壁壘",dinghaishenzhen:"氣定神閒",stealthSkill:"隱身",dodgeSkill:"風行"}[stateName]||stateName;
        }
    }

    function canApplyNamedState(monster,stateName,index,sourceName){
        return typeof window.v173CanApplyNamedPersistentState==="function"
            ?window.v173CanApplyNamedPersistentState(monster,stateName,"monster",index,sourceName)
            :!hasNamedState(monster,stateName);
    }

    function registerMonsterTeamBuff(monster,buff,display){
        buff.displayBuff=display;
        ["bonusPercent","percent","evasionBonusPercent","resistBonus","accuracyBonusPercent","defenseBonusPercent","reflectPercent","amount","value","skillLevel"].forEach(key=>{
            if(display&&display[key]===undefined&&buff&&buff[key]!==undefined){ display[key]=buff[key]; }
        });
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
        if(!monster||(monster.v141SupportSkillIds||[]).indexOf("healSpell")<0||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targeting=allyTriTargeting(monsterIndex);
        const allies=targeting.entries;
        const needsHeal=currentAbyssEntries().some(entry=>
            monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)*.70
        );
        if(!needsHeal||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex,targeting.primaryIndex,allies.map(entry=>entry.index),"monster",skill.targetType);
        }
        const level=finalSkillLevel(monster,skill);
        const hpAmount=levelValue(
            skill.healHpByLevel,
            level,
            numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(level-1)
        );
        const spPercent=levelValue(skill.spRestorePercentByLevel,level,0);
        let restoredSpTotal=0;
        allies.forEach(entry=>{
            const ally=entry.monster;
            const healed=restoreMonsterHp(ally,hpAmount);
            const spAmount=entry.index===monsterIndex
                ?0
                :Math.floor(Math.max(0,numeric(ally.maxSP))*spPercent/100);
            const restored=spAmount>0?restoreMonsterSp(ally,spAmount):0;
            restoredSpTotal+=restored;
            if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
            if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                const card=document.getElementById("battleMonster"+entry.index);
                if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
            }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog("北帝天尊施放治療術：同排最多"+allies.length+"名友方各回復"+
                hpAmount+" HP，其他目標依最大SP恢復"+spPercent+"%（合計"+restoredSpTotal+" SP），施放者本人不恢復SP。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveNorthHeal=resolveNorthHeal;

    function resolveNorthRevive(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.revive:null;
        if(!monster||(monster.v141SupportSkillIds||[]).indexOf("revive")<0||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const defeated=currentAbyssEntriesIncludingDefeated().filter(entry=>
            entry.index!==monsterIndex&&(entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        ).sort((left,right)=>(right.monster.rank==="boss")-(left.monster.rank==="boss")||left.index-right.index);
        const target=defeated[0];
        if(!target||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"water",monsterIndex,target.index,[target.index],"monster",skill.targetType);
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
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const supports=monster&&monster.v141SupportSkillIds||[];
        const hasDefeated=currentAbyssEntriesIncludingDefeated().some(entry=>
            entry.index!==monsterIndex&&(entry.monster.alive===false||numeric(entry.monster.hp)<=0)
        );
        if(hasDefeated&&supports.includes("revive")){ return resolveNorthRevive(monsterIndex,forceCast); }
        if(supports.includes("healSpell")){ return resolveNorthHeal(monsterIndex,forceCast); }
        return false;
    }
    window.v155ResolveNorthSupport=resolveNorthSupport;

    function resolveRockWall(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.rockWall:null;
        if(!monster||(monster.v141SupportSkillIds||[]).indexOf("rockWall")<0||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targeting=allyTriTargeting(monsterIndex);
        const requestedTargets=targeting.entries;
        const targets=requestedTargets.filter(entry=>!hasNamedState(entry.monster,"rockWall"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"earth",monsterIndex,targeting.primaryIndex,requestedTargets.map(entry=>entry.index),"monster",skill.targetType);
        }
        const level=finalSkillLevel(monster,skill);
        const duration=Math.max(1,Math.floor(levelValue(skill.durationByLevel,level,skill.duration||4)));
        const percent=Math.max(0,levelValue(skill.defenseBonusPercentByLevel,level,skill.defenseBonusPercent||35));
        let applied=0;
        targets.forEach(entry=>{
            if(!canApplyNamedState(entry.monster,"rockWall",entry.index,skill.name)){ return; }
            const display={type:"rockWall",v141BuffType:"rockWall",turnsLeft:duration,percent:percent};
            const buff={type:"rockWall",turnsLeft:duration,percent:percent};
            markNamedState(display,"rockWall");
            markNamedState(buff,"rockWall");
            entry.monster.v155RockWall={
                originalDefense:numeric(entry.monster.defense),
                displayBuff:display,
                battleToken:currentBattleToken(),
                expiresTurn:currentRound()+duration
            };
            entry.monster.defense=Math.max(0,numeric(entry.monster.defense)*(1+percent/100));
            registerMonsterTeamBuff(entry.monster,buff,display);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog(monster.name+"施放"+skill.name+"，同排最多"+applied+"名友方防禦提升"+percent+"%，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveRockWall=resolveRockWall;

    function resolveStealthSkill(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.stealthSkill:null;
        if(!monster||(monster.v141SupportSkillIds||[]).indexOf("stealthSkill")<0||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){ return false; }
        const targets=currentAbyssEntries().filter(entry=>!hasNamedState(entry.monster,"stealthSkill")).slice(0,1);
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex,targets[0].index,[targets[0].index],"monster",skill.targetType);
        }
        const level=finalSkillLevel(monster,skill);
        const duration=Math.max(1,Math.floor(levelValue(skill.durationByLevel,level,skill.duration||2)));
        let applied=0;
        targets.forEach(entry=>{
            if(!canApplyNamedState(entry.monster,"stealthSkill",entry.index,skill.name)){ return; }
            const display={type:"stealthSkill",v141BuffType:"stealthSkill",turnsLeft:duration};
            const buff={type:"stealthSkill",turnsLeft:duration};
            markNamedState(display,"stealthSkill");
            markNamedState(buff,"stealthSkill");
            registerMonsterTeamBuff(entry.monster,buff,display);
            applied++;
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog(monster.name+"施放"+skill.name+"，"+applied+"名友方進入隱身，持續"+duration+"回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }
    window.v155ResolveStealthSkill=resolveStealthSkill;

    function resolveWindEliteDodge(monsterIndex,forceCast){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.dodgeSkill:null;
        if(!monster||!(monster.v141SupportSkillIds||[]).includes("dodgeSkill")||monster.element!=="wind"||monster.alive===false||numeric(monster.hp)<=0||!skill||hardControlled(monster)){
            return false;
        }
        const targeting=allyTriTargeting(monsterIndex);
        const requestedTargets=targeting.entries;
        const targets=requestedTargets.filter(entry=>!hasNamedState(entry.monster,"風行"));
        if(!targets.length||!supportCastAllowed(monster,forceCast)||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"wind",monsterIndex,targeting.primaryIndex,requestedTargets.map(entry=>entry.index),"monster",skill.targetType);
        }
        const level=finalSkillLevel(monster,skill);
        const duration=Math.max(1,Math.floor(levelValue(skill.durationByLevel,level,skill.duration||3)));
        const percent=Math.max(0,levelValue(skill.evasionBonusPercentByLevel,level,skill.evasionBonusPercent||70));
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

    function chooseFinalAbyssAction(monster){
        const living=currentAbyssEntries();
        const attacks=(monster&&monster.skillIds||[]).filter(id=>{
            const skill=skillDatabase[id];
            const legal=typeof window.v144IsMonsterSkillElementLegal==="function"
                ?window.v144IsMonsterSkillElementLegal(monster,id)
                :!!(skill&&skill.element&&skill.element===monster.element);
            return !!(legal&&skill&&numeric(monster.sp)>=numeric(skill.spCost));
        });
        const supports=(monster&&monster.v141SupportSkillIds||[]).filter(id=>{
            const skill=skillDatabase[id];
            const legal=typeof window.v144IsMonsterSkillElementLegal==="function"
                ?window.v144IsMonsterSkillElementLegal(monster,id)
                :!!(skill&&skill.element&&skill.element===monster.element);
            return !!(legal&&skill&&numeric(monster.sp)>=numeric(skill.spCost));
        });
        const healNeeded=living.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)*.70);
        if(healNeeded&&supports.includes("healSpell")){ return {kind:"heal",skillId:"healSpell"}; }
        const buffs=supports.filter(id=>id!=="healSpell");
        const category=window.FourSymbolsEnemySkillAI
            ?window.FourSymbolsEnemySkillAI.chooseCategory(attacks,buffs,Math.random())
            :(Math.random()<.70?"attack":"buff");
        const pool=category==="attack"?attacks:category==="buff"?buffs:[];
        return {kind:category,skillId:pool.length?pool[Math.floor(Math.random()*pool.length)]:null};
    }
    window.v155ChooseFinalAbyssAction=chooseFinalAbyssAction;

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss&&hardControlled(monster)){ return false; }
            if(monster&&monster.v174TrueRealmFinal){
                const plan=chooseFinalAbyssAction(monster);
                if(plan.kind==="heal"){ return resolveNorthHeal(monsterIndex,true); }
                if(plan.kind==="attack"&&plan.skillId){
                    monster.v175ForcedAttackSkillId=plan.skillId;
                    return false;
                }
                if(plan.kind==="buff"&&plan.skillId==="rockWall"){ return resolveRockWall(monsterIndex,true); }
                if(plan.kind==="buff"&&plan.skillId==="stealthSkill"){ return resolveStealthSkill(monsterIndex,true); }
                if(plan.kind==="buff"&&plan.skillId==="yuanZuBlessing"){ return resolveExtremeEmperorAction(monsterIndex,"yuanZuBlessing"); }
                if(plan.kind==="buff"&&["rage","dodgeSkill"].includes(plan.skillId)){
                    monster.v175ForcedSupportSkillId=plan.skillId;
                    return previousMonsterSpecial.apply(this,arguments);
                }
                if(plan.kind==="heal"){ return resolveNorthHeal(monsterIndex,true); }
                if(plan.kind==="support"){ return resolveNorthSupport(monsterIndex,true); }
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

    function removeRockWall(monster){
        const state=monster&&monster.v155RockWall;
        if(!state){ return; }
        monster.defense=numeric(state.originalDefense);
        removeDisplayBuff(monster,state.displayBuff);
        delete monster.v155RockWall;
    }

    function clearRemovableCombatStates(monster){
        if(!monster){ return 0; }
        let removed=0;
        if(monster.v155EvasionBlessing){ removeEvasionBlessing(monster); removed++; }
        if(monster.v155WindDodge){ removeWindDodge(monster); removed++; }
        if(monster.v155RockWall){ removeRockWall(monster); removed++; }
        return removed;
    }
    window.v155ClearRemovableCombatStates=clearRemovableCombatStates;

    if(
        window.FourSymbolsDurationLifecycle&&
        typeof window.FourSymbolsDurationLifecycle.registerBuffExpiryHandler==="function"
    ){
        window.FourSymbolsDurationLifecycle.registerBuffExpiryHandler(({entity,buff})=>{
            if(!entity||!buff){ return false; }
            if(entity.v155EvasionBlessing&&entity.v155EvasionBlessing.displayBuff===buff){
                removeEvasionBlessing(entity);
                return true;
            }
            if(entity.v155WindDodge&&entity.v155WindDodge.displayBuff===buff){
                removeWindDodge(entity);
                return true;
            }
            if(entity.v155RockWall&&entity.v155RockWall.displayBuff===buff){
                removeRockWall(entity);
                return true;
            }
            return false;
        });
    }

    function tickV155RoundStates(){
        const token=currentBattleToken();
        const round=currentRound();
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach(monster=>{
                if(monster&&Array.isArray(monster.activeBuffs)){
                    monster.activeBuffs=monster.activeBuffs.filter(buff=>{
                        if(!buff||buff.type!=="phoenixMight"){ return true; }
                        const active=buff.battleToken===token&&round<numeric(buff.expiresTurn);
                        if(active){ buff.turnsLeft=Math.max(1,numeric(buff.expiresTurn)-round); }
                        else if(typeof addBattleLog==="function"){ addBattleLog("⏳鳳威效果已結束。"); }
                        return active;
                    });
                }
            });
        }
    }

    if(
        window.FourSymbolsBattleFlow&&
        typeof window.FourSymbolsBattleFlow.subscribeRoundStart==="function"
    ){
        window.FourSymbolsBattleFlow.subscribeRoundStart(tickV155RoundStates);
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
            /* The core battle queue owns every resolve delay, including a
               frozen or petrified enemy's skipped action. */
            return invokeAtForcedLevel();
        };
    }

    window.v155RuleDiagnostics=function(){
        return {
            version:VERSION,hardControlUsesQueueTiming:true,
            elementalSkillDataOwnedByFinalLayers:true,
            monsterOnlyFireBurst:!!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike)
        };
    };
})();
