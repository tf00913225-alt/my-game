/* =====================================================
   V148 — combat target truth, support rules and dungeon usability
===================================================== */
(function installV148CombatDungeonFixes(){
    "use strict";

    if(typeof window==="undefined" || window.__v148CombatDungeonFixesInstalled){ return; }
    window.__v148CombatDungeonFixesInstalled=true;

    const VERSION="148";
    const HARD_CONTROL_TYPES=["freeze","petrify"];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function partyIndexes(){
        if(typeof getExistingPartyIndexes==="function"){
            return getExistingPartyIndexes().filter(index=>Number.isInteger(index));
        }
        return [0,1,2].filter(index=>
            typeof getPartyCharacterByIndex==="function"&&!!getPartyCharacterByIndex(index)
        );
    }

    function livingPartyIndexes(){
        return partyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return !!(character&&numeric(character.hp)>0);
        });
    }

    function activeBuff(entity,type){
        return !!(entity&&Array.isArray(entity.activeBuffs)&&entity.activeBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function activeStatus(entity,type){
        return !!(entity&&Array.isArray(entity.statusEffects)&&entity.statusEffects.some(effect=>
            effect&&effect.type===type&&numeric(effect.turnsLeft)>0
        ));
    }

    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level))-1));
        return numeric(values[index]);
    }

    /* Rage is a formation skill, not an alias for every ally. */
    if(typeof skillDatabase!=="undefined"){
        const rage=skillDatabase.rage;
        if(rage){
            rage.targetType="allyTri";
            rage.description="需先學習火爆亂擊或烈焰龍捲其一。提高我方同排中、左、右最多3名存活角色的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續2回合；效果存在時不可刷新。";
        }
        const heal=skillDatabase.healSpell;
        if(heal){
            heal.description="需先學習冰霜箭雨或冰旋一閃其一。對我方全體恢復350 HP與35 SP；每升1級各提升30點。施放者本人只恢復HP，不恢復SP。";
        }
    }

    if(typeof window.v135GetSkillTargetScopeLabel==="function"){
        const previousScopeLabel=window.v135GetSkillTargetScopeLabel;
        window.v135GetSkillTargetScopeLabel=function(skill){
            if(skill&&skill.targetType==="allyTri"){ return "我方三人・同排左中右"; }
            return previousScopeLabel.apply(this,arguments);
        };
    }

    /*
       The DOM row is the final formation truth. Fixed Abyss metadata is the
       non-DOM fallback; the V138 rank arrangement remains the normal fallback.
       This keeps B/C/D as B/C/D even when an Abyss row was rendered by a later
       layer than V138.
    */
    function cardIndex(card){
        const match=card&&String(card.id||"").match(/^battleMonster(\d+)$/);
        return match?Number(match[1]):null;
    }

    function visualFormationRows(indexes){
        const ordered=(indexes||[]).filter(index=>Number.isInteger(index));
        const allowed=new Set(ordered);

        if(typeof document!=="undefined"){
            const area=document.getElementById("battleMonsterArea");
            const rowNodes=area&&area.querySelectorAll
                ?Array.from(area.querySelectorAll(":scope > .v131-monster-row")):[];
            const domRows=rowNodes.map(row=>Array.from(row.children||[])
                .map(cardIndex).filter(index=>index!==null&&allowed.has(index))
            ).filter(row=>row.length);
            if(domRows.length&&domRows.flat().some(index=>allowed.has(index))){ return domRows; }
        }

        if(typeof monsters!=="undefined"){
            const fixed=ordered.map(index=>({index:index,monster:monsters[index]}))
                .filter(entry=>entry.monster&&Number.isInteger(entry.monster.v141FormationRow));
            if(fixed.length){
                const rowNumbers=Array.from(new Set(fixed.map(entry=>entry.monster.v141FormationRow)))
                    .sort((a,b)=>a-b);
                return rowNumbers.map(rowNumber=>fixed
                    .filter(entry=>entry.monster.v141FormationRow===rowNumber)
                    .sort((a,b)=>numeric(a.monster.v141FormationPosition)-numeric(b.monster.v141FormationPosition))
                    .map(entry=>entry.index)
                );
            }
        }

        if(typeof window.v138GetFormationRows==="function"){
            const rows=window.v138GetFormationRows(ordered);
            if(Array.isArray(rows)&&rows.some(row=>Array.isArray(row)&&row.length)){
                return rows.filter(row=>Array.isArray(row)&&row.length).map(row=>row.slice());
            }
        }
        return ordered.length?[ordered]:[];
    }

    if(typeof getSkillTargets==="function"){
        const previousGetSkillTargets=getSkillTargets;
        getSkillTargets=function(centerIndex,targetType){
            const indexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[];
            const alive=indexes.filter(index=>{
                const monster=typeof monsters!=="undefined"?monsters[index]:null;
                return !!(monster&&monster.alive!==false&&numeric(monster.hp)>0);
            });
            if(targetType==="all"){ return alive; }
            if(targetType==="single"){ return alive.includes(centerIndex)?[centerIndex]:[]; }
            if(targetType==="tri"||targetType==="row"){
                const row=visualFormationRows(indexes).find(candidate=>candidate.includes(centerIndex));
                if(!row){ return []; }
                const selected=targetType==="row"
                    ?row
                    :row.slice(Math.max(0,row.indexOf(centerIndex)-1),Math.min(row.length,row.indexOf(centerIndex)+2));
                return selected.filter(index=>alive.includes(index));
            }
            const legacy=previousGetSkillTargets.apply(this,arguments);
            return Array.isArray(legacy)?legacy.filter(index=>alive.includes(index)):[];
        };
    }

    window.v148GetFormationRows=visualFormationRows;

    /* A defeated card remains inert except while Revive is explicitly aiming. */
    if(typeof isValidAllyTargetForSkill==="function"){
        const previousIsValidAllyTarget=isValidAllyTargetForSkill;
        isValidAllyTargetForSkill=function(skill,character,index){
            if(!skill||!character){ return false; }
            if(skill.targetType==="deadAlly"){ return numeric(character.hp)<=0; }
            if(skill.category==="buff"&&activeBuff(character,skill.id)){ return false; }
            return previousIsValidAllyTarget.apply(this,arguments);
        };
    }

    function markReviveTargets(actionType){
        if(typeof document==="undefined"){ return; }
        document.querySelectorAll(".battle-player.v148-revive-target").forEach(card=>
            card.classList.remove("v148-revive-target")
        );
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[actionType]:null;
        if(!skill||skill.targetType!=="deadAlly"){ return; }
        partyIndexes().forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            const card=document.getElementById("battlePlayerCard"+index);
            if(card&&character&&numeric(character.hp)<=0){
                card.classList.add("ally-targetable","v148-revive-target");
            }
        });
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const previousSetAllyTargets=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const result=previousSetAllyTargets.apply(this,arguments);
            markReviveTargets(actionType);
            return result;
        };
    }

    if(typeof clearBattleTargetSelectionMode==="function"){
        const previousClearTargetMode=clearBattleTargetSelectionMode;
        clearBattleTargetSelectionMode=function(){
            const result=previousClearTargetMode.apply(this,arguments);
            if(typeof document!=="undefined"){
                document.querySelectorAll(".battle-player.v148-revive-target").forEach(card=>
                    card.classList.remove("v148-revive-target")
                );
            }
            return result;
        };
    }

    if(typeof window.v141PlayCardEffect==="function"){
        const previousPlayCardEffect=window.v141PlayCardEffect;
        window.v141PlayCardEffect=function(side,index,type){
            const entity=side==="monster"
                ?(typeof monsters!=="undefined"?monsters[index]:null)
                :(typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null);
            const defeated=!entity||numeric(entity.hp)<=0||(side==="monster"&&entity.alive===false);
            if(defeated&&type!=="revive"){ return; }
            return previousPlayCardEffect.apply(this,arguments);
        };
    }

    /* Freeze and Petrify replace one another; they can never coexist. */
    function removeHardControlsExcept(entity,preferredType){
        if(!entity||!Array.isArray(entity.statusEffects)){ return; }
        entity.statusEffects=entity.statusEffects.filter(effect=>
            !effect||!HARD_CONTROL_TYPES.includes(effect.type)||effect.type===preferredType||numeric(effect.turnsLeft)<=0
        );
    }

    if(typeof applyFreezeEffect==="function"){
        const previousApplyFreeze=applyFreezeEffect;
        applyFreezeEffect=function(entity){
            removeHardControlsExcept(entity,"freeze");
            return previousApplyFreeze.apply(this,arguments);
        };
    }

    if(typeof applyMonsterDebuff==="function"){
        const previousApplyMonsterDebuff=applyMonsterDebuff;
        applyMonsterDebuff=function(entity,type){
            if(type==="petrify"){ removeHardControlsExcept(entity,"petrify"); }
            return previousApplyMonsterDebuff.apply(this,arguments);
        };
    }

    function normalizeHardControls(entity){
        if(!entity||!Array.isArray(entity.statusEffects)){ return; }
        const active=entity.statusEffects.filter(effect=>
            effect&&HARD_CONTROL_TYPES.includes(effect.type)&&numeric(effect.turnsLeft)>0
        );
        if(active.length<=1){ return; }
        const keep=active[0];
        entity.statusEffects=entity.statusEffects.filter(effect=>
            !effect||!HARD_CONTROL_TYPES.includes(effect.type)||numeric(effect.turnsLeft)<=0||effect===keep
        );
    }

    function normalizeAllHardControls(){
        partyIndexes().forEach(index=>normalizeHardControls(getPartyCharacterByIndex(index)));
        if(typeof currentBattleMonsters!=="undefined"&&typeof monsters!=="undefined"){
            currentBattleMonsters.forEach(index=>normalizeHardControls(monsters[index]));
        }
    }

    /* ----- One support resolver for every party slot. ----- */
    function finishSupport(message){
        if(message&&typeof addBattleLog==="function"){ addBattleLog(message); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    function validateSupportCaster(characterIndex,skill){
        const character=getPartyCharacterByIndex(characterIndex);
        const key=getPartyCharacterKey(characterIndex);
        const level=Math.max(0,Math.floor(numeric(getSkillLevel(key,skill.id))));
        const cost=Math.max(0,numeric(skill.spCost!==undefined?skill.spCost:skill.cost));
        const stats=character?getPartyBattleStats(characterIndex):null;
        if(!character||numeric(character.hp)<=0){ return {error:"施放者已無法行動。"}; }
        if(!stats){ return {error:"施放者的戰鬥資料無法讀取。"}; }
        if(level<=0){ return {error:(character.id||"角色")+"尚未學習"+skill.name+"。"}; }
        if(numeric(character.sp)<cost){ return {error:(character.id||"角色")+"SP不足，無法使用"+skill.name+"。"}; }
        return {character:character,key:key,level:level,cost:cost,stats:stats};
    }

    function animateSupportCast(state,characterIndex,skill){
        state.character.sp=Math.max(0,numeric(state.character.sp)-state.cost);
        if(typeof lungePlayerCard==="function"){ lungePlayerCard(characterIndex); }
        if(typeof showSkillNameBadge==="function"){ showSkillNameBadge(skill.name,skill.element,characterIndex); }
        if(typeof showPlayerSpPopup==="function"){
            setTimeout(()=>showPlayerSpPopup(state.cost,characterIndex),500);
        }
    }

    function requestedBuffTargets(characterIndex,queued,skill){
        if(skill.targetType==="allyAll"){ return livingPartyIndexes(); }
        if(skill.targetType==="allyTri"){
            const living=livingPartyIndexes();
            if(living.length<=3){ return living; }
            const all=partyIndexes();
            const preferred=Number.isInteger(queued.targetAlly)?queued.targetAlly:all[Math.floor(all.length/2)];
            const position=Math.max(0,all.indexOf(preferred));
            return all.slice(Math.max(0,position-1),Math.min(all.length,position+2))
                .filter(index=>living.includes(index));
        }
        const selected=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getPartyCharacterByIndex(selected);
        return target&&numeric(target.hp)>0?[selected]:[];
    }

    function buffFields(skill,level){
        if(skill.id==="rage"){
            const chance=levelValue(skill.critChanceBonusByLevel||skill.critBonusByLevel,level,0);
            const damage=levelValue(skill.critDamageBonusByLevel||skill.critBonusByLevel,level,0);
            return {bonusPercent:chance,critChanceBonusPercent:chance,critDamageBonusPercent:damage};
        }
        if(skill.id==="dodgeSkill"){ return {percent:numeric(skill.evasionBonusPercent)}; }
        if(skill.id==="rockWall"){ return {percent:numeric(skill.defenseBonusPercent)}; }
        if(skill.id==="earthShield"){ return {percent:numeric(skill.reflectPercent)}; }
        if(skill.id==="dinghaishenzhen"){
            return {resistBonus:numeric(skill.statusResistBonus),accuracyBonusPercent:numeric(skill.accuracyBonusPercent)};
        }
        if(skill.id==="barrier"){
            return {
                sourceSkill:"barrier",barrierRule:"shared",
                remainingBlocks:Math.max(1,numeric(skill.barrierBlockCount)||5)
            };
        }
        return {};
    }

    function resolvePartyBuff(characterIndex,queued,skill,state){
        const requested=requestedBuffTargets(characterIndex,queued,skill);
        const eligible=requested.filter(index=>{
            const target=getPartyCharacterByIndex(index);
            return target&&numeric(target.hp)>0&&!activeBuff(target,skill.id);
        });
        if(!requested.length){ return finishSupport(skill.name+"目前沒有有效目標。"); }
        if(!eligible.length){ return finishSupport(skill.name+"效果仍存在，無法重複施放或延長回合。"); }

        animateSupportCast(state,characterIndex,skill);
        const extra=buffFields(skill,state.level);
        eligible.forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            target.activeBuffs=(target.activeBuffs||[]).filter(buff=>
                !(buff&&buff.type===skill.id&&numeric(buff.turnsLeft)<=0)
            );
            target.activeBuffs.push(Object.assign({
                type:skill.id,turnsLeft:Math.max(1,numeric(skill.duration)||2)
            },extra));
            if(typeof window.v141PlayCardEffect==="function"){
                const effect=skill.id==="barrier"?"barrier":skill.id==="earthShield"?"shield":"buff";
                window.v141PlayCardEffect("player",index,effect);
            }
        });
        const skipped=requested.length-eligible.length;
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，效果套用於"+eligible.length+"名存活友方"+
            (skipped>0?"；"+skipped+"名既有效果未刷新。":"。")
        );
    }

    function healAmounts(skill,state,targetStats,isFlatPartyHeal){
        const exSkill=typeof skillDatabase!=="undefined"?skillDatabase[skill.element+"EX"]:null;
        const exLevel=Math.max(0,Math.floor(numeric(getSkillLevel(state.key,skill.element+"EX"))));
        const multiplier=exSkill&&exLevel>0&&numeric(exSkill.healBonusPercent)>0
            ?1+numeric(exSkill.healBonusPercent)/100:1;
        const hpBase=numeric(skill.baseHeal)+numeric(skill.healPerLevel)*(state.level-1);
        const spBase=numeric(skill.baseHealSP)+numeric(skill.healSPPerLevel)*(state.level-1);
        const hp=isFlatPartyHeal
            ?Math.floor(hpBase*multiplier)
            :Math.floor(calculateHealingAmount(hpBase,state.stats.intelligence)*multiplier);
        const sp=isFlatPartyHeal
            ?Math.floor(spBase*multiplier)
            :Math.floor(calculateSPHealingAmount(spBase,state.stats.intelligence)*multiplier);
        return {hp:Math.max(0,hp),sp:Math.max(0,sp),maxHP:numeric(targetStats.maxHP),maxSP:numeric(targetStats.maxSP)};
    }

    function resolvePartyHeal(characterIndex,queued,skill,state){
        const targets=skill.targetType==="allyAll"
            ?livingPartyIndexes()
            :[Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex].filter(index=>{
                const target=getPartyCharacterByIndex(index);
                return target&&numeric(target.hp)>0;
            });
        if(!targets.length){ return finishSupport(skill.name+"目前沒有可治療的存活目標。"); }
        animateSupportCast(state,characterIndex,skill);
        let hpTotal=0;
        let spTotal=0;
        targets.forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            const targetStats=getPartyBattleStats(index);
            if(!target||!targetStats||numeric(target.hp)<=0){ return; }
            const planned=healAmounts(skill,state,targetStats,skill.id==="healSpell"&&skill.targetType==="allyAll");
            const hp=Math.max(0,Math.min(planned.hp,planned.maxHP-numeric(target.hp)));
            const sp=index===characterIndex?0:Math.max(0,Math.min(planned.sp,planned.maxSP-numeric(target.sp)));
            target.hp=Math.min(planned.maxHP,numeric(target.hp)+planned.hp);
            if(index!==characterIndex){ target.sp=Math.min(planned.maxSP,numeric(target.sp)+planned.sp); }
            hpTotal+=hp;
            spTotal+=sp;
            if(hp>0&&typeof showPlayerHit==="function"){ showPlayerHit(hp,"heal",index,true); }
            if(sp>0&&typeof showPlayerHit==="function"){ showPlayerHit(sp,"sp",index,true); }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("player",index,"heal"); }
        });
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，我方存活角色共恢復"+
            hpTotal+" HP、"+spTotal+" SP；施放者本人不恢復SP。"
        );
    }

    function resolvePartyRevive(characterIndex,queued,skill,state){
        let targetIndex=Number.isInteger(queued.targetAlly)?queued.targetAlly:null;
        if(targetIndex===null){
            targetIndex=partyIndexes().find(index=>{
                const target=getPartyCharacterByIndex(index);
                return target&&numeric(target.hp)<=0;
            });
        }
        const target=Number.isInteger(targetIndex)?getPartyCharacterByIndex(targetIndex):null;
        if(!target||numeric(target.hp)>0){ return finishSupport("目前選擇的目標不需要復活。"); }
        const targetStats=getPartyBattleStats(targetIndex);
        if(!targetStats){ return finishSupport("復活目標資料無法讀取。"); }

        animateSupportCast(state,characterIndex,skill);
        const exSkill=typeof skillDatabase!=="undefined"?skillDatabase[skill.element+"EX"]:null;
        const exLevel=Math.max(0,Math.floor(numeric(getSkillLevel(state.key,skill.element+"EX"))));
        const multiplier=exSkill&&exLevel>0&&numeric(exSkill.healBonusPercent)>0
            ?1+numeric(exSkill.healBonusPercent)/100:1;
        const percent=levelValue(skill.reviveHealPercentByLevel,state.level,20);
        target.hp=Math.max(1,Math.min(numeric(targetStats.maxHP),Math.floor(numeric(targetStats.maxHP)*percent/100*multiplier)));
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof showPlayerHit==="function"){
            setTimeout(()=>showPlayerHit(target.hp,"heal",targetIndex,true),300);
        }
        if(typeof window.v141PlayCardEffect==="function"){
            window.v141PlayCardEffect("player",targetIndex,"revive");
        }
        return finishSupport((target.id||"隊友")+"被"+skill.name+"復活，恢復"+target.hp+" HP。");
    }

    function resolveSupportAction(characterIndex,queued,skill){
        if(typeof activeBattleCharacterIndex!=="undefined"){ activeBattleCharacterIndex=characterIndex; }
        const state=validateSupportCaster(characterIndex,skill);
        if(state.error){ return finishSupport(state.error); }
        if(skill.category==="buff"){ return resolvePartyBuff(characterIndex,queued,skill,state); }
        if(skill.category==="heal"){ return resolvePartyHeal(characterIndex,queued,skill,state); }
        if(skill.category==="revive"){ return resolvePartyRevive(characterIndex,queued,skill,state); }
        return false;
    }

    window.v148ResolveSupportAction=resolveSupportAction;

    if(typeof castBuffSkill==="function"){
        castBuffSkill=function(skillId,targetIndex){
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(!skill){ return; }
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            return resolveSupportAction(index,{action:skillId,targetAlly:targetIndex},skill);
        };
    }
    if(typeof castHealSkill==="function"){
        castHealSkill=function(skillId,targetIndex){
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(!skill){ return; }
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            return resolveSupportAction(index,{action:skillId,targetAlly:targetIndex},skill);
        };
    }
    if(typeof castReviveSkill==="function"){
        castReviveSkill=function(skillId,targetIndex){
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
            if(!skill){ return; }
            const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
            return resolveSupportAction(index,{action:skillId,targetAlly:targetIndex},skill);
        };
    }

    /* Embedded shield bonuses from damage skills also cannot refresh a live buff. */
    function snapshotActivePartyBuffs(){
        return partyIndexes().map(index=>{
            const character=getPartyCharacterByIndex(index);
            const buffs=(character&&character.activeBuffs||[]).filter(buff=>buff&&numeric(buff.turnsLeft)>0);
            return {
                character:character,
                records:buffs.map(buff=>({reference:buff,values:Object.assign({},buff)}))
            };
        }).filter(entry=>entry.character&&entry.records.length);
    }

    function restoreActivePartyBuffs(snapshot){
        snapshot.forEach(entry=>{
            const protectedTypes=new Set(entry.records.map(record=>record.reference.type));
            const current=(entry.character.activeBuffs||[]).filter(buff=>
                !buff||!protectedTypes.has(buff.type)
            );
            entry.records.forEach(record=>{
                Object.assign(record.reference,record.values);
                current.push(record.reference);
            });
            entry.character.activeBuffs=current;
        });
    }

    ["castDamageSkill","castSecondaryCharacterSkill","castPlayer2Skill"].forEach(functionName=>{
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const snapshot=snapshotActivePartyBuffs();
            try{ return previous.apply(this,arguments); }
            finally{ restoreActivePartyBuffs(snapshot); }
        };
    });

    /* Enemy Rage uses one visual trio and never the complete ten-card roster. */
    function activeMonsterTeamBuff(monster,type){
        return !!(monster&&Array.isArray(monster.v141TeamBuffs)&&monster.v141TeamBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function bestMonsterRageTargets(casterIndex){
        const indexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[];
        const alive=indexes.filter(index=>{
            const monster=monsters[index];
            return monster&&monster.alive!==false&&numeric(monster.hp)>0;
        });
        let best=[];
        let bestScore=-1;
        visualFormationRows(indexes).forEach(row=>{
            row.forEach((center,index)=>{
                if(!alive.includes(center)){ return; }
                const trio=row.slice(Math.max(0,index-1),Math.min(row.length,index+2))
                    .filter(target=>alive.includes(target));
                const eligible=trio.filter(target=>!activeMonsterTeamBuff(monsters[target],"rage"));
                const score=eligible.length*100+(center===casterIndex?20:(trio.includes(casterIndex)?10:0));
                if(score>bestScore){ best=eligible; bestScore=score; }
            });
        });
        return best.slice(0,3);
    }

    function tryMonsterRage(monsterIndex){
        const caster=monsters[monsterIndex];
        const skill=skillDatabase.rage;
        if(!caster||!caster.alive||numeric(caster.hp)<=0||!skill){ return false; }
        const controlled=(typeof isMonsterFrozen==="function"&&isMonsterFrozen(caster))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(caster));
        if(controlled||Math.random()>.55){ return false; }
        const targets=bestMonsterRageTargets(monsterIndex);
        const cost=Math.max(0,numeric(skill.spCost));
        if(!targets.length||numeric(caster.sp)<cost){ return false; }
        caster.sp=Math.max(0,numeric(caster.sp)-cost);
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||caster.element,monsterIndex);
        }
        targets.forEach(index=>{
            const monster=monsters[index];
            const amount=50;
            const buff={
                type:"rage",turnsLeft:Math.max(1,numeric(skill.duration)||2),amount:amount,
                originalAttack:numeric(monster.attack),originalMagicAttack:numeric(monster.magicAttack)
            };
            monster.attack=Math.round(buff.originalAttack*(1+amount/100));
            monster.magicAttack=Math.round(buff.originalMagicAttack*(1+amount/100));
            const display={type:"rage",v141BuffType:"rage",turnsLeft:buff.turnsLeft};
            buff.displayBuff=display;
            monster.v141TeamBuffs=monster.v141TeamBuffs||[];
            monster.v141TeamBuffs.push(buff);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
            if(typeof window.v141PlayCardEffect==="function"){
                window.v141PlayCardEffect("monster",index,"buff");
            }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog(caster.name+"施放怒火，只強化敵方同排中、左、右最多3名，持續2回合。");
        }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const supports=monster&&monster.v141SupportSkillIds||[];
            if(supports.includes("rage")){ return tryMonsterRage(monsterIndex); }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    /* Reflect is already part of the core formula; make it visible and repair
       any alternate attack path that skipped the formula. */
    if(typeof processSingleMonsterAttack==="function"){
        const previousMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex){
            const attacker=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            const before=livingPartyIndexes().map(index=>{
                const character=getPartyCharacterByIndex(index);
                const percent=typeof getActiveBuffPercent==="function"
                    ?numeric(getActiveBuffPercent(character,"earthShield"))
                    :numeric((character.activeBuffs||[]).find(buff=>buff.type==="earthShield"&&numeric(buff.turnsLeft)>0)?.percent);
                return {index:index,hp:numeric(character.hp),percent:percent};
            });
            let reflected=0;
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog){
                addBattleLog=function(message){
                    const match=String(message||"").match(/反傷造成.*?(\d+)點傷害/);
                    if(match){
                        const amount=numeric(match[1]);
                        reflected+=amount;
                        if(amount>0&&typeof showMonsterHit==="function"){
                            showMonsterHit(monsterIndex,amount,"hp");
                        }
                    }
                    return previousLog.apply(this,arguments);
                };
            }
            let result;
            try{ result=previousMonsterAttack.apply(this,arguments); }
            finally{ if(previousLog){ addBattleLog=previousLog; } }

            if(attacker&&reflected===0){
                const expected=before.reduce((sum,entry)=>{
                    const character=getPartyCharacterByIndex(entry.index);
                    const lost=Math.max(0,entry.hp-numeric(character&&character.hp));
                    return sum+(entry.percent>0&&lost>0?Math.max(1,Math.floor(lost*entry.percent/100)):0);
                },0);
                if(expected>0){
                    attacker.hp=Math.max(0,numeric(attacker.hp)-expected);
                    if(typeof showMonsterHit==="function"){ showMonsterHit(monsterIndex,expected,"hp"); }
                    if(typeof addBattleLog==="function"){ addBattleLog("萬象土盾反彈"+expected+"點傷害給"+attacker.name+"。"); }
                    if(numeric(attacker.hp)<=0&&typeof killMonster==="function"){ killMonster(monsterIndex); }
                }
            }
            return result;
        };
    }

    /* A dead enemy team ends resolution before a queued second player acts. */
    function enemiesHaveNoHp(){
        if(typeof currentBattleMonsters==="undefined"||!currentBattleMonsters.length){ return false; }
        return currentBattleMonsters.every(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            return !monster||monster.alive===false||numeric(monster.hp)<=0;
        });
    }

    function settleDefeatedEnemies(){
        if(typeof battleActive!=="undefined"&&!battleActive){ return true; }
        if(!enemiesHaveNoHp()){ return false; }
        if(typeof currentBattleMonsters!=="undefined"&&typeof killMonster==="function"){
            currentBattleMonsters.forEach(index=>{
                const monster=monsters[index];
                if(monster&&monster.alive!==false&&numeric(monster.hp)<=0){ killMonster(index); }
            });
        }
        if(typeof checkBattleEnd==="function"&&checkBattleEnd()){ return true; }
        return typeof battleActive!=="undefined"&&!battleActive;
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            if(settleDefeatedEnemies()){ return; }
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            const skill=queued&&typeof skillDatabase!=="undefined"?skillDatabase[queued.action]:null;
            if(queued&&skill&&["buff","heal","revive"].includes(skill.category)){
                return resolveSupportAction(characterIndex,Object.assign({},queued),skill);
            }
            return previousResolveQueuedAction.apply(this,arguments);
        };
    }

    if(typeof processNextCombatant==="function"){
        const previousProcessNext=processNextCombatant;
        processNextCombatant=function(){
            if(settleDefeatedEnemies()){ return; }
            return previousProcessNext.apply(this,arguments);
        };
    }

    if(typeof finishPlayerAction==="function"){
        const previousFinishAction=finishPlayerAction;
        let terminalPending=false;
        finishPlayerAction=function(){
            if(enemiesHaveNoHp()){
                const gate=window.v142SkillAnimationDirector&&window.v142SkillAnimationDirector.getActive
                    ?window.v142SkillAnimationDirector.getActive():null;
                if(gate&&gate.promise&&!gate.done){
                    if(terminalPending){ return; }
                    terminalPending=true;
                    const that=this;
                    const args=arguments;
                    gate.promise.then(()=>{
                        terminalPending=false;
                        if(!settleDefeatedEnemies()){ previousFinishAction.apply(that,args); }
                    });
                    return;
                }
                if(settleDefeatedEnemies()){ return; }
            }
            return previousFinishAction.apply(this,arguments);
        };
    }

    /* ----- Dungeon navigation and movement. ----- */
    function dungeonNavMarkup(isAbyss){
        const buttons=[
            ["角色","assets/ui/nav-character.png","openHomeFeature('character')"],
            ["背包","assets/ui/nav-backpack.png","openMapInventoryOverlay()"],
            ["商店","assets/ui/home-shop-v147.png","openHomeFeature('shop')"],
            ["元素匣","assets/ui/nav-element-box.png","openHomeFeature('autoBattleSettings')"],
            ["返回","assets/ui/map-return.png",isAbyss?"v146ExitAbyssMap()":"showPage('home')"]
        ];
        return buttons.map(button=>
            '<button class="nav-button nav-art-button-wrap" onclick="'+button[2]+'" aria-label="'+button[0]+'">'+
            '<img class="nav-art-button" src="'+button[1]+'" alt=""><span class="nav-sr-only">'+button[0]+'</span></button>'
        ).join("");
    }

    function syncDungeonShell(){
        if(typeof document==="undefined"){ return; }
        const page=document.getElementById("dungeonPage");
        const nav=document.getElementById("v141DungeonNav");
        if(!page){ return; }
        const isAbyss=!!page.querySelector(".v141-abyss-shell,.v141-abyss-intro");
        const topReturn=document.getElementById("v146AbyssReturn");
        if(topReturn){ topReturn.remove(); }
        if(nav){
            const mode=isAbyss?"abyss":"daily";
            if(nav.dataset.v148Mode!==mode||nav.children.length!==5){
                nav.innerHTML=dungeonNavMarkup(isAbyss);
                nav.dataset.v148Mode=mode;
            }
            nav.dataset.v146Columns="5";
        }
    }

    function scheduleDungeonSync(){ setTimeout(syncDungeonShell,0); }
    if(typeof switchDungeonTab==="function"){
        const previousSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(){
            const result=previousSwitchDungeonTab.apply(this,arguments);
            scheduleDungeonSync();
            return result;
        };
    }
    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const result=previousShowPage.apply(this,arguments);
            if(page==="dungeon"){ scheduleDungeonSync(); }
            return result;
        };
    }
    ["v141StartAbyss","v141ResetAbyss"].forEach(functionName=>{
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const result=previous.apply(this,arguments);
            scheduleDungeonSync();
            return result;
        };
    });

    if(typeof window.v141AbyssMoveByEvent==="function"){
        const previousAbyssMove=window.v141AbyssMoveByEvent;
        window.v141AbyssMoveByEvent=function(event){
            const map=document.getElementById("v141AbyssMap");
            const playerElement=document.getElementById("v141AbyssPlayer");
            if(map&&playerElement&&map.dataset.v146Moving==="1"){
                const mapRect=map.getBoundingClientRect();
                const playerRect=playerElement.getBoundingClientRect();
                if(mapRect.width&&mapRect.height&&playerRect.width&&playerRect.height){
                    const x=Math.max(4,Math.min(96,(playerRect.left+playerRect.width/2-mapRect.left)/mapRect.width*100));
                    const y=Math.max(8,Math.min(94,(playerRect.top+playerRect.height/2-mapRect.top)/mapRect.height*100));
                    playerElement.style.transition="none";
                    playerElement.style.left=x+"%";
                    playerElement.style.top=y+"%";
                    void playerElement.offsetWidth;
                }
                map.dataset.v146Moving="0";
                map.classList.remove("v146-moving");
            }
            return previousAbyssMove.apply(this,arguments);
        };
    }

    /* Manual patrol click movement is retired; automatic roaming keeps the
       original 1.8-second natural route and cannot inherit a manual duration. */
    function installPatrolClickBlocker(){
        if(typeof document==="undefined"){ return; }
        const page=document.getElementById("mapPage");
        if(!page||page.dataset.v148ManualMoveBlocked==="1"){ return; }
        page.dataset.v148ManualMoveBlocked="1";
        page.addEventListener("click",event=>{
            if(event.target&&event.target.closest&&event.target.closest(
                "button,#v141TaskTracker,[id^='mapMonster'],#v131PatrolAppearanceSwitchWrap,#mapBattleOverlay"
            )){ return; }
            event.stopImmediatePropagation();
        },true);
    }

    function decoratePatrolRanks(){
        if(typeof document==="undefined"||typeof monsters==="undefined"){ return; }
        monsters.forEach((monster,index)=>{
            const card=document.getElementById("mapMonster"+index);
            if(!card||!monster){ return; }
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):monster.v141BattleRank;
            card.dataset.rank=rank==="boss"?"boss":rank==="elite"?"elite":"regular";
        });
    }

    if(typeof updateMapMonsterIcons==="function"){
        const previousUpdateMapMonsterIcons=updateMapMonsterIcons;
        updateMapMonsterIcons=function(){
            const result=previousUpdateMapMonsterIcons.apply(this,arguments);
            decoratePatrolRanks();
            return result;
        };
    }

    if(typeof startPatrolCharacterWalking==="function"){
        const previousStartPatrol=startPatrolCharacterWalking;
        startPatrolCharacterWalking=function(){
            const wrap=document.getElementById("patrolCharacterWrap");
            const image=document.getElementById("patrolCharacterImg");
            if(wrap){
                wrap.classList.add("v148-auto-route");
                wrap.style.transition="left 1.8s ease-in-out, top 1.8s ease-in-out";
            }
            if(image){ image.classList.remove("v141-manual-walking"); }
            return previousStartPatrol.apply(this,arguments);
        };
    }
    if(typeof stopPatrolCharacterWalking==="function"){
        const previousStopPatrol=stopPatrolCharacterWalking;
        stopPatrolCharacterWalking=function(){
            const wrap=document.getElementById("patrolCharacterWrap");
            if(wrap){ wrap.classList.remove("v148-auto-route"); }
            return previousStopPatrol.apply(this,arguments);
        };
    }

    function boot(){
        installPatrolClickBlocker();
        decoratePatrolRanks();
        syncDungeonShell();
        normalizeAllHardControls();
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        let queued=false;
        const observer=new MutationObserver(()=>{
            if(queued){ return; }
            queued=true;
            requestAnimationFrame(()=>{ queued=false; syncDungeonShell(); });
        });
        const observe=()=>observer.observe(document.body,{childList:true,subtree:true});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",observe,{once:true}); }
        else{ observe(); }
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v148SyncDungeonShell=syncDungeonShell;
    window.v148SettleDefeatedEnemies=settleDefeatedEnemies;
    window.v148Diagnostics=function(){
        const database=typeof skillDatabase!=="undefined"?skillDatabase:null;
        return {
            version:VERSION,rageTargetType:database&&database.rage&&database.rage.targetType,
            duplicateBuffRefresh:false,hardControlsExclusive:true,healCasterSp:false,
            reviveDeadTarget:true,dungeonTouchScroll:true,abyssRedirectable:true,
            patrolManualMovement:false,shopIcon:"assets/ui/home-shop-v147.png"
        };
    };
})();
