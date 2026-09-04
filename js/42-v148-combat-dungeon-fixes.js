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

    if(typeof window.v135GetSkillTargetScopeLabel==="function"){
        const previousScopeLabel=window.v135GetSkillTargetScopeLabel;
        window.v135GetSkillTargetScopeLabel=function(skill){
            if(skill&&skill.targetType==="allyTri"){ return "我方三人・同排左中右"; }
            return previousScopeLabel.apply(this,arguments);
        };
    }

    /*
       Rendered DOM rows may lose dead cards, so they are only presentation
       truth. Skill adjacency and auto-target order must use the full formation
       that existed when the battle began; otherwise two surviving far-edge
       monsters become false neighbours after the middle cards disappear.
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

    function stableFormationRows(indexes){
        const ordered=(indexes||[]).filter(index=>Number.isInteger(index));
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
        return visualFormationRows(ordered);
    }

    function centerFirstOrder(row){
        const values=(row||[]).slice();
        if(values.length<=1){ return values; }
        const order=[];
        const leftCenter=Math.floor((values.length-1)/2);
        const rightCenter=Math.ceil((values.length-1)/2);
        order.push(leftCenter);
        if(rightCenter!==leftCenter){ order.push(rightCenter); }
        for(let distance=1;order.length<values.length;distance++){
            const left=leftCenter-distance;
            const right=rightCenter+distance;
            if(left>=0){ order.push(left); }
            if(right<values.length){ order.push(right); }
        }
        return order.map(position=>values[position]).filter(index=>Number.isInteger(index));
    }

    const REFERENCE_TARGET_ORDER_6=[4,1,3,6,2,5];
    const REFERENCE_TARGET_ORDER_10=[7,2,6,1,5,10,4,9,3,8];

    function referenceTargetPriority(rows){
        const flat=(rows||[]).flat().filter(index=>Number.isInteger(index));
        const order=flat.length===6?REFERENCE_TARGET_ORDER_6:flat.length===10?REFERENCE_TARGET_ORDER_10:null;
        if(!order){ return null; }
        return flat.map((index,position)=>({index:index,order:order[position]}))
            .sort((a,b)=>a.order-b.order).map(entry=>entry.index);
    }

    function autoTargetPriority(indexes){
        const ordered=(indexes||[]).filter(index=>Number.isInteger(index));
        if(typeof monsters!=="undefined"&&ordered.length){
            const explicit=ordered.map(index=>({
                index:index,
                order:monsters[index]&&Number(monsters[index].v148TargetOrder)
            }));
            if(explicit.every(entry=>Number.isFinite(entry.order))){
                return explicit.sort((a,b)=>a.order-b.order).map(entry=>entry.index);
            }
        }
        const reference=referenceTargetPriority(stableFormationRows(ordered));
        if(reference){ return reference; }
        return stableFormationRows(ordered).flatMap(centerFirstOrder);
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
                const row=stableFormationRows(indexes).find(candidate=>candidate.includes(centerIndex));
                if(!row){ return []; }
                const position=row.indexOf(centerIndex);
                const selected=targetType==="row"
                    ?row
                    :row.slice(Math.max(0,position-1),Math.min(row.length,position+2));
                return selected.filter(index=>alive.includes(index));
            }
            if(targetType==="column"){
                const rows=stableFormationRows(indexes);
                const selectedRow=rows.find(candidate=>candidate.includes(centerIndex));
                if(!selectedRow){ return []; }
                const selectedMonster=typeof monsters!=="undefined"?monsters[centerIndex]:null;
                const explicitPosition=selectedMonster&&Number.isInteger(selectedMonster.v141FormationPosition)
                    ?selectedMonster.v141FormationPosition:null;
                const fallbackPosition=Math.max(0,selectedRow.indexOf(centerIndex));
                return rows.map(row=>{
                    if(explicitPosition!==null&&typeof monsters!=="undefined"){
                        const exact=row.find(index=>
                            monsters[index]&&monsters[index].v141FormationPosition===explicitPosition
                        );
                        if(Number.isInteger(exact)){ return exact; }
                    }
                    return row[fallbackPosition];
                }).filter(index=>Number.isInteger(index)&&alive.includes(index)).slice(0,2);
            }
            const legacy=previousGetSkillTargets.apply(this,arguments);
            return Array.isArray(legacy)?legacy.filter(index=>alive.includes(index)):[];
        };
    }

    window.v148GetFormationRows=stableFormationRows;
    window.v148GetAutoTargetPriority=autoTargetPriority;

    /* A defeated card remains inert except while Revive is explicitly aiming. */
    if(typeof isValidAllyTargetForSkill==="function"){
        const previousIsValidAllyTarget=isValidAllyTargetForSkill;
        isValidAllyTargetForSkill=function(skill,character,index){
            if(!skill||!character){ return false; }
            if(skill.targetType==="deadAlly"){ return numeric(character.hp)<=0; }
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

    /* Different formal names may coexist.  Only a repeated name is rejected
       by the shared persistent-state owner in 00-main.js. */
    function normalizeAllHardControls(){ return HARD_CONTROL_TYPES.length; }

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
        if(!requested.length){ return finishSupport(skill.name+"目前沒有有效目標。"); }
        const eligible=requested.filter(index=>{
            const target=getPartyCharacterByIndex(index);
            if(!target||numeric(target.hp)<=0){ return false; }
            if(typeof window.v173CanApplyNamedPersistentState==="function"){
                return window.v173CanApplyNamedPersistentState(target,skill.id,"player",index,skill.name);
            }
            return !activeBuff(target,skill.id);
        });

        animateSupportCast(state,characterIndex,skill);
        const extra=buffFields(skill,state.level);
        eligible.forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            target.activeBuffs=(target.activeBuffs||[]).filter(buff=>
                !(
                    buff&&buff.type===skill.id&&(
                        numeric(buff.turnsLeft)<=0||
                        skill.id==="barrier"&&numeric(buff.remainingBlocks)<=0
                    )
                )
            );
            const buff=Object.assign({
                type:skill.id,turnsLeft:Math.max(1,numeric(skill.duration)||2)
            },extra);
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,skill.id);
            }
            target.activeBuffs.push(buff);
            if(typeof window.v141PlayCardEffect==="function"){
                const effect=skill.id==="barrier"?"barrier":skill.id==="earthShield"?"shield":"buff";
                window.v141PlayCardEffect("player",index,effect);
            }
        });
        const skipped=requested.length-eligible.length;
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，效果成功套用於"+eligible.length+"名存活友方"+
            (skipped>0?"；"+skipped+"名同名狀態MISS。":"。")
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
            ?Math.floor(spBase)
            :Math.floor(calculateSPHealingAmount(spBase,state.stats.intelligence));
        return {hp:Math.max(0,hp),sp:Math.max(0,sp),maxHP:numeric(targetStats.maxHP),maxSP:numeric(targetStats.maxSP)};
    }

    function resolvePartyHeal(characterIndex,queued,skill,state){
        const targets=requestedBuffTargets(characterIndex,queued,skill);
        if(!targets.length){ return finishSupport(skill.name+"目前沒有可治療的存活目標。"); }
        animateSupportCast(state,characterIndex,skill);
        let hpTotal=0;
        let spTotal=0;
        let cleansedTotal=0;
        targets.forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            const targetStats=getPartyBattleStats(index);
            if(!target||!targetStats||numeric(target.hp)<=0){ return; }
            const planned=healAmounts(skill,state,targetStats,skill.id==="healSpell");
            const hp=Math.max(0,Math.min(planned.hp,planned.maxHP-numeric(target.hp)));
            const sp=index===characterIndex?0:Math.max(0,Math.min(planned.sp,planned.maxSP-numeric(target.sp)));
            target.hp=Math.min(planned.maxHP,numeric(target.hp)+planned.hp);
            if(index!==characterIndex){ target.sp=Math.min(planned.maxSP,numeric(target.sp)+planned.sp); }
            if(skill.cleanseAll&&Array.isArray(target.statusEffects)){
                cleansedTotal+=target.statusEffects.length;
                target.statusEffects=[];
            }
            hpTotal+=hp;
            spTotal+=sp;
            if(hp>0&&typeof showPlayerHit==="function"){ showPlayerHit(hp,"heal",index,true); }
            if(sp>0&&typeof showPlayerHit==="function"){ showPlayerHit(sp,"sp",index,true); }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("player",index,"heal"); }
        });
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，我方存活角色共恢復"+
            hpTotal+" HP、"+spTotal+" SP"+
            (skill.cleanseAll?"，並解除"+cleansedTotal+"個負面狀態":"")+"；施放者本人不恢復SP。"
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
        const restoredHP=Math.max(1,Math.min(
            numeric(targetStats.maxHP),
            Math.floor(numeric(targetStats.maxHP)*percent/100*multiplier)
        ));
        const reviveMessage=(target.id||"隊友")+"被"+skill.name+"復活，恢復"+restoredHP+" HP。";
        const reviveAtImpact=()=>{
            if(numeric(target.hp)>0){ return; }
            target.hp=restoredHP;
            if(typeof addBattleLog==="function"){ addBattleLog(reviveMessage); }
            if(typeof updateUI==="function"){ updateUI(); }
            if(typeof showPlayerHit==="function"){ showPlayerHit(restoredHP,"heal",targetIndex,true); }
            if(typeof window.v141PlayCardEffect==="function"){
                window.v141PlayCardEffect("player",targetIndex,"revive");
            }
        };
        if(typeof window.v143RunAtTargetHit==="function"){
            window.v143RunAtTargetHit("player",targetIndex,reviveAtImpact,true);
        }else{
            const duration=Math.max(520,numeric(skill.animationDuration)||1800);
            setTimeout(reviveAtImpact,Math.round(duration*7/12));
        }
        return finishSupport();
    }

    function resolvePartyStateClear(characterIndex,queued,skill,state){
        const targetIndex=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getPartyCharacterByIndex(targetIndex);
        if(!target||numeric(target.hp)<=0){ return finishSupport(skill.name+"目前沒有有效目標。"); }
        animateSupportCast(state,characterIndex,skill);
        const negativeCount=Array.isArray(target.statusEffects)?target.statusEffects.length:0;
        const buffCount=Array.isArray(target.activeBuffs)?target.activeBuffs.length:0;
        target.statusEffects=[];
        target.activeBuffs=[];
        if(target.v141Shield){ target.v141Shield=null; }
        if(typeof window.v141PlayCardEffect==="function"){
            window.v141PlayCardEffect("player",targetIndex,"buff");
        }
        return finishSupport(
            (state.character.id||"角色")+"施放"+skill.name+"，解除"+
            (target.id||("角色"+(targetIndex+1)))+"身上"+(negativeCount+buffCount)+"個增益／異常狀態。"
        );
    }

    function resolveSupportAction(characterIndex,queued,skill){
        if(typeof activeBattleCharacterIndex!=="undefined"){ activeBattleCharacterIndex=characterIndex; }
        const state=validateSupportCaster(characterIndex,skill);
        if(state.error){ return finishSupport(state.error); }
        if(skill.removeAllStates){ return resolvePartyStateClear(characterIndex,queued,skill,state); }
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
        if(typeof window.v173HasNamedPersistentState==="function"){
            return window.v173HasNamedPersistentState(monster,type);
        }
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
        stableFormationRows(indexes).forEach(row=>{
            row.forEach((center,index)=>{
                if(!alive.includes(center)){ return; }
                const trio=row.slice(Math.max(0,index-1),Math.min(row.length,index+2))
                    .filter(target=>alive.includes(target));
                const eligible=trio.filter(target=>!activeMonsterTeamBuff(monsters[target],"rage"));
                const score=eligible.length*100+(center===casterIndex?20:(trio.includes(casterIndex)?10:0));
                if(score>bestScore){ best=trio; bestScore=score; }
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
        let appliedCount=0;
        targets.forEach(index=>{
            const monster=monsters[index];
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    monster,"rage","monster",index,skill.name
                )
            ){ return; }
            const level=Math.max(1,Math.min(
                numeric(skill.maxLevel)||5,
                Math.floor(numeric(caster.v141ForceSkillLevel)||1)
            ));
            const critChance=levelValue(
                skill.critChanceBonusByLevel||skill.critBonusByLevel,level,0
            );
            const critDamage=levelValue(
                skill.critDamageBonusByLevel||skill.critBonusByLevel,level,0
            );
            const buff={
                type:"rage",turnsLeft:Math.max(1,numeric(skill.duration)||3),amount:0,
                bonusPercent:critChance,
                critChanceBonusPercent:critChance,
                critDamageBonusPercent:critDamage,
                originalAttack:numeric(monster.attack),originalMagicAttack:numeric(monster.magicAttack)
            };
            const display={
                type:"rage",v141BuffType:"rage",turnsLeft:buff.turnsLeft,
                bonusPercent:critChance,
                critChanceBonusPercent:critChance,
                critDamageBonusPercent:critDamage
            };
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,"rage");
                window.v173MarkPersistentStateName(display,"rage");
            }
            buff.displayBuff=display;
            monster.v141TeamBuffs=monster.v141TeamBuffs||[];
            monster.v141TeamBuffs.push(buff);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
            appliedCount++;
            if(typeof window.v141PlayCardEffect==="function"){
                window.v141PlayCardEffect("monster",index,"buff");
            }
        });
        if(typeof addBattleLog==="function"){
            addBattleLog(caster.name+"施放怒火，敵方同排中、左、右有"+appliedCount+"名成功獲得效果，持續3回合。");
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

    /* ----- Formal daily dungeons: one shared 3-wave × 6-enemy battle flow. ----- */
    const DAILY_ELEMENTS=["fire","water","earth","wind"];
    const DAILY_DUNGEON_META={
        exp:{title:"經驗副本",requirement:"任一角色達到10級",reward:"共用經驗池 EXP",legacyType:"exp"},
        material:{title:"材料副本",requirement:"任一角色達到10級",reward:"材料寶箱 ×1～3",legacyType:"material"},
        gold:{title:"金幣副本",requirement:"任一角色達到10級",reward:"大量金幣",legacyType:"equipment"}
    };
    let dailyDungeonSequence=null;
    let pendingDailyExpReward=null;
    let pendingDailyGoldReward=0;

    function getDailyDungeonLevel(){
        return typeof window.v132GetDungeonMonsterLevel==="function"
            ?Math.max(1,Math.floor(numeric(window.v132GetDungeonMonsterLevel())||1))
            :Math.max(1,...partyIndexes().map(index=>numeric(getPartyCharacterByIndex(index)?.level)||1));
    }

    function dailyPartyContext(){
        const indexes=partyIndexes().slice(0,3);
        const partySize=Math.max(1,indexes.length||1);
        const highestLevel=Math.max(1,...indexes.map(index=>numeric(getPartyCharacterByIndex(index)?.level)||1));
        return {partySize:partySize,highestLevel:highestLevel,soloProtected:partySize===1&&highestLevel<=20};
    }

    function dailyRankForSlot(wave,slot,soloProtected){
        if(wave===1){ return null; }
        if(soloProtected){
            if(wave===2){ return slot===4?"elite":null; }
            if(slot===4){ return "boss"; }
            return slot===3?"elite":null;
        }
        if(wave===2){ return slot>=4?"elite":null; }
        if(slot===4){ return "boss"; }
        if(slot===3||slot===5){ return "elite"; }
        return null;
    }

    function dailyMonsterName(type,rank){
        const names={
            exp:{regular:"修行弟子",elite:"修行精英",boss:"修行教頭"},
            material:{regular:"礦脈守衛",elite:"礦脈精英",boss:"礦脈統領"},
            gold:{regular:"金庫守衛",elite:"金庫精英",boss:"金庫總管"}
        };
        return names[type][rank||"regular"];
    }

    function buildDailyWave(type,wave,level,context){
        const roster=[];
        for(let slot=0;slot<6;slot++){
            const rank=dailyRankForSlot(wave,slot,!!(context&&context.soloProtected));
            const element=DAILY_ELEMENTS[(wave*2+slot)%DAILY_ELEMENTS.length];
            const monster=typeof window.v132BuildDungeonMonster==="function"
                ?window.v132BuildDungeonMonster(dailyMonsterName(type,rank),level,element,rank||undefined)
                :makeZoneMonster(dailyMonsterName(type,rank),level,element,rank||undefined);
            monster.v132Dungeon=true;
            monster.v173DailyDungeonType=type;
            monster.v141DungeonStage=wave;
            monster.v141FormationRow=slot<3?0:1;
            monster.v141FormationPosition=slot%3;
            monster.v148TargetOrder=REFERENCE_TARGET_ORDER_6[slot];
            monster.v173DailySoloProtected=!!(context&&context.soloProtected);
            roster.push(monster);
        }
        return roster;
    }

    function buildDailyDungeonWaves(type){
        const level=getDailyDungeonLevel();
        const context=dailyPartyContext();
        return {
            level:level,
            partySize:context.partySize,
            highestLevel:context.highestLevel,
            soloProtected:context.soloProtected,
            waves:[1,2,3].map(wave=>buildDailyWave(type,wave,level,context))
        };
    }
    window.v148BuildDailyDungeonWaves=buildDailyDungeonWaves;

    function dailyDungeonAvailable(meta){
        return !window.v132IsDungeonAvailable||window.v132IsDungeonAvailable(meta.legacyType);
    }

    function hasLevel10Character(){
        return partyIndexes().some(index=>numeric(getPartyCharacterByIndex(index)?.level)>=10);
    }

    function confirmFormalDailyDungeon(meta){
        if(typeof window.rpgConfirm!=="function"){ return Promise.resolve(true); }
        const protectedSolo=dailyPartyContext().soloProtected;
        const layout=protectedSolo
            ?"第1輪：6普通；第2輪：5普通＋1精英；第3輪：4普通＋1精英＋1BOSS。"
            :"第1輪：6普通；第2輪：4普通＋2精英；第3輪：3普通＋2精英＋1BOSS。";
        return window.rpgConfirm(
            "確定要進入「"+meta.title+"」嗎？\n\n共3輪，每輪固定前排3隻＋後排3隻，共18隻敵人。\n"+layout,
            {title:"副本確認",confirmText:"進入副本",cancelText:"返回"}
        );
    }

    function resetBattleAdvanceTimers(){
        if(typeof timerId!=="undefined"&&timerId){ clearInterval(timerId); timerId=null; }
        if(typeof battleAdvanceTimeoutId!=="undefined"&&battleAdvanceTimeoutId){
            clearTimeout(battleAdvanceTimeoutId);
            battleAdvanceTimeoutId=null;
        }
        if(typeof battleAdvanceScheduled!=="undefined"){ battleAdvanceScheduled=false; }
    }

    function activateDailyDungeonWave(sequence,nextIndex){
        if(!sequence||dailyDungeonSequence!==sequence||!window.v132ActiveDungeonRun){ return; }
        const wave=sequence.waves[nextIndex];
        sequence.waveIndex=nextIndex;
        if(window.v132ActiveDungeonRun){
            window.v132ActiveDungeonRun.partySize=sequence.partySize;
            window.v132ActiveDungeonRun.highestPartyLevel=sequence.highestPartyLevel;
            window.v132ActiveDungeonRun.dailyDungeonType=sequence.type;
        }
        monsters=wave;
        currentZone="dungeon";
        currentBattleMonsters=wave.map((monster,index)=>index);
        currentBattleMonsters.forEach(index=>{
            const monster=monsters[index];
            monster.alive=true;
            monster.hp=monster.maxHP;
            monster.sp=monster.maxSP;
            monster.statusEffects=[];
        });
        battleActive=true;
        battleToken++;
        turn=1;
        actionReady=false;
        pendingAction=null;
        resetBattleAdvanceTimers();
        if(typeof closeMenus==="function"){ closeMenus(); }
        if(typeof clearBattleTargetSelectionMode==="function"){ clearBattleTargetSelectionMode(); }
        renderBattle();
        const priority=autoTargetPriority(currentBattleMonsters);
        selectedMonster=priority.length?priority[0]:0;
        if(typeof autoConfig!=="undefined"&&autoConfig){ autoBattle=!!autoConfig.enabled; }
        if(typeof window.v131SyncElementBoxForBattle==="function"){
            window.v131SyncElementBoxForBattle({silent:true});
        }
        if(typeof syncBattleAutoSettings==="function"){ syncBattleAutoSettings(); }
        if(typeof updateAutoButton==="function"){ updateAutoButton(); }
        if(typeof addBattleLog==="function"){
            addBattleLog("第"+(nextIndex+1)+"輪開始：前排3隻、後排3隻敵人進場。");
        }
        startTurn(battleToken);
    }

    function advanceDailyDungeonWave(){
        const sequence=dailyDungeonSequence;
        if(!sequence||sequence.waveIndex>=2){ return false; }
        sequence.totalTurns+=Math.max(1,Math.floor(numeric(typeof turn!=="undefined"?turn:1)));
        battleActive=false;
        actionReady=false;
        pendingAction=null;
        resetBattleAdvanceTimers();
        battleToken++;
        if(typeof closeMenus==="function"){ closeMenus(); }
        if(typeof addBattleLog==="function"){
            addBattleLog("第"+(sequence.waveIndex+1)+"輪突破，下一輪敵人無縫接戰！");
        }
        const nextIndex=sequence.waveIndex+1;
        setTimeout(()=>activateDailyDungeonWave(sequence,nextIndex),360);
        return true;
    }

    function finishDailyExpReward(amount){
        const granted=Math.max(0,Math.floor(numeric(amount)));
        if(granted<=0){ return; }
        sharedExp=Math.max(0,numeric(sharedExp)+granted);
        if(typeof addBattleLog==="function"){
            addBattleLog("經驗副本：共用經驗池獲得"+granted+" EXP。");
        }
        pendingDailyExpReward=null;
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
        showPage("dungeon");
        if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
    }

    function showDailyExpReward(baseExp){
        pendingDailyExpReward={baseExp:Math.max(0,Math.floor(numeric(baseExp)))};
        const html='<div class="v132-reward-modal-inner"><h3>經驗副本挑戰成功！</h3>'+
            '<p>共用經驗池可獲得：<b>'+pendingDailyExpReward.baseExp.toLocaleString("zh-TW")+' EXP</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v148ClaimDailyExpReward(false)">直接領取</button>'+
            '<button type="button" onclick="v148ClaimDailyExpReward(true)">看廣告雙倍領取</button>'+
            '<span class="v132-reward-note">獎勵直接加入共用經驗池，不再指定角色。</span></div></div>';
        if(typeof window.v132ShowRewardModal==="function"){ window.v132ShowRewardModal(html); }
    }

    window.v148ClaimDailyExpReward=function(doubled){
        const pending=pendingDailyExpReward;
        if(!pending){ return; }
        const grant=multiplier=>finishDailyExpReward(Math.floor(pending.baseExp*multiplier));
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        }else{
            grant(1);
        }
    };

    function showDailyGoldReward(amount){
        pendingDailyGoldReward=Math.max(0,Math.floor(numeric(amount)));
        const html='<div class="v132-reward-modal-inner"><h3>金幣副本挑戰成功！</h3>'+
            '<p>可獲得金幣：<b>'+pendingDailyGoldReward.toLocaleString("zh-TW")+'</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v148ClaimDailyGoldReward(false)">直接領取</button>'+
            '<button type="button" onclick="v148ClaimDailyGoldReward(true)">看廣告雙倍領取</button></div></div>';
        if(typeof window.v132ShowRewardModal==="function"){ window.v132ShowRewardModal(html); }
    }

    window.v148ClaimDailyGoldReward=function(doubled){
        const grant=multiplier=>{
            const amount=Math.floor(pendingDailyGoldReward*multiplier);
            if(amount<=0){ return; }
            gold=Math.max(0,numeric(gold)+amount);
            pendingDailyGoldReward=0;
            if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
            if(typeof saveGame==="function"){ saveGame(); }
            if(typeof addBattleLog==="function"){ addBattleLog("金幣副本結算，獲得"+amount+"金幣。"); }
            if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
            showPage("dungeon");
            if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
        };
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        }else{ grant(1); }
    };

    async function beginFormalDailyDungeon(type){
        const meta=DAILY_DUNGEON_META[type];
        if(!meta||dailyDungeonSequence||typeof window.v132LaunchDungeonBattle!=="function"){ return; }
        if(!dailyDungeonAvailable(meta)){
            alert(meta.title+"今天已經挑戰過了。");
            return;
        }
        if(!hasLevel10Character()){
            alert(meta.title+"需要任一角色達到10級才能開啟。");
            return;
        }
        if(!await confirmFormalDailyDungeon(meta)){ return; }
        const built=buildDailyDungeonWaves(type);
        const baseExp=type==="exp"&&typeof window.v139GetExpDungeonRewardExp==="function"
            ?Math.max(0,Math.floor(numeric(window.v139GetExpDungeonRewardExp()))):0;
        const sequence={
            type:type,meta:meta,level:built.level,partySize:built.partySize,highestPartyLevel:built.highestLevel,soloProtected:built.soloProtected,waves:built.waves,waveIndex:0,totalTurns:0,baseExp:baseExp
        };
        dailyDungeonSequence=sequence;
        const started=window.v132LaunchDungeonBattle(sequence.waves[0],function(outcome){
            const active=dailyDungeonSequence||sequence;
            if(outcome.result!=="win"){
                dailyDungeonSequence=null;
                showPage("dungeon");
                if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
                return;
            }
            active.totalTurns+=Math.max(1,Math.floor(numeric(outcome.turnsUsed)||1));
            dailyDungeonSequence=null;
            if(type==="exp"){
                showDailyExpReward(active.baseExp);
            }else if(type==="material"){
                const count=active.totalTurns<15?3:active.totalTurns<30?2:1;
                if(typeof window.v132ClaimMaterialDungeonReward==="function"&&typeof window.v132ShowRewardModal==="function"){
                    const html='<div class="v132-reward-modal-inner"><h3>材料副本挑戰成功！</h3><p>獲得材料寶箱 ×'+count+'</p>'+
                        '<div class="v132-reward-actions"><button type="button" onclick="v132ClaimMaterialDungeonReward('+count+',false)">直接領取</button>'+
                        '<button type="button" onclick="v132ClaimMaterialDungeonReward('+count+',true)">看廣告雙倍領取</button></div></div>';
                    window.v132ShowRewardModal(html);
                }
            }else{
                showDailyGoldReward(goldDungeonReward(active.level));
            }
        });
        if(started===false){ dailyDungeonSequence=null; }
        else if(window.v132ActiveDungeonRun){
            window.v132ActiveDungeonRun.partySize=sequence.partySize;
            window.v132ActiveDungeonRun.highestPartyLevel=sequence.highestPartyLevel;
            window.v132ActiveDungeonRun.dailyDungeonType=type;
        }
    }

    window.v132BeginExpDungeon=function(){ return beginFormalDailyDungeon("exp"); };
    window.v132BeginMaterialDungeon=function(){ return beginFormalDailyDungeon("material"); };
    /* Compatibility name retained so existing buttons/saves do not need a migration. */
    window.v132BeginEquipmentDungeon=function(){ return beginFormalDailyDungeon("gold"); };
    window.v148BeginGoldDungeon=window.v132BeginEquipmentDungeon;

    if(typeof winBattle==="function"){
        const previousWinBattle=winBattle;
        winBattle=function(){
            if(dailyDungeonSequence&&window.v132ActiveDungeonRun&&dailyDungeonSequence.waveIndex<2){
                if(advanceDailyDungeonWave()){ return; }
            }
            return previousWinBattle.apply(this,arguments);
        };
    }

    function renderFormalDailyDungeonList(){
        const cards=[
            ["exp",DAILY_DUNGEON_META.exp,"v132BeginExpDungeon"],
            ["material",DAILY_DUNGEON_META.material,"v132BeginMaterialDungeon"],
            ["gold",DAILY_DUNGEON_META.gold,"v132BeginEquipmentDungeon"]
        ];
        return '<div class="v141-dungeon-cover-list">'+cards.map(([type,meta,action])=>{
            const available=dailyDungeonAvailable(meta);
            return '<article class="v141-dungeon-cover-card" data-dungeon-cover="'+type+'">'+
                '<div class="v141-dungeon-cover-art"><span>'+meta.title+'</span><small>3輪 × 每輪6隻</small></div>'+
                '<div class="v141-dungeon-cover-info"><b>'+meta.title+'</b><span>開放：'+meta.requirement+'</span></div>'+
                '<div class="v141-dungeon-cover-actions"><button type="button" onclick="v148ShowDailyDungeonPreview(\''+type+'\')">獎勵預覽</button>'+
                '<button type="button" '+(available?'onclick="'+action+'()"':'disabled')+'>挑戰</button></div>'+
                '<div class="v141-dungeon-remaining">'+(available?'可挑戰':'今日已完成')+'</div></article>';
        }).join("")+'</div>';
    }

    window.v148ShowDailyDungeonPreview=function(type){
        const meta=DAILY_DUNGEON_META[type];
        if(!meta||typeof window.v132ShowRewardModal!=="function"){ return; }
        const layout=dailyPartyContext().soloProtected
            ?"6普通 → 5普通+1精英 → 4普通+1精英+1BOSS"
            :"6普通 → 4普通+2精英 → 3普通+2精英+1BOSS";
        const html='<div class="v132-reward-modal-inner"><h3>'+meta.title+'獎勵預覽</h3><p>'+meta.reward+'</p>'+
            '<p>固定3輪×6隻：'+layout+'。</p>'+
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };

    if(typeof renderDungeonTabContent==="function"){
        const previousRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){ return renderFormalDailyDungeonList(); }
            return previousRenderDungeonTabContent.apply(this,arguments);
        };
    }

    /* ----- Quest notification: only a reward-ready quest gets the icon dot. ----- */
    function questRewardReady(){
        if(typeof ensureDailyQuestsCurrent==="function"){ ensureDailyQuestsCurrent(); }
        const groups=[];
        if(typeof dailyQuestDefinitions!=="undefined"&&typeof dailyQuestState!=="undefined"){
            groups.push([dailyQuestDefinitions,dailyQuestState]);
        }
        if(typeof commissionQuestDefinitions!=="undefined"&&typeof commissionQuestState!=="undefined"){
            groups.push([commissionQuestDefinitions,commissionQuestState]);
        }
        return groups.some(([definitions,state])=>(definitions||[]).some(quest=>
            quest&&state&&state.claimed&&!state.claimed[quest.id]&&
            numeric(state.progress&&state.progress[quest.id])>=Math.max(1,numeric(quest.goal)||1)
        ));
    }

    function setQuestNoticeDot(target,show){
        if(!target||!target.querySelector){ return; }
        let dot=target.querySelector(":scope > .v141-notice-dot");
        if(show&&!dot&&typeof document!=="undefined"){
            dot=document.createElement("span");
            dot.className="v141-notice-dot";
            dot.setAttribute("aria-label","任務獎勵可領取");
            target.appendChild(dot);
        }else if(!show&&dot){ dot.remove(); }
    }

    function syncQuestNoticeDots(){
        if(typeof document==="undefined"){ return; }
        const show=questRewardReady();
        const home=document.getElementById("homeIconQuest");
        setQuestNoticeDot(home&&home.parentElement?home.parentElement:home,show);
        document.querySelectorAll("#mapPageNav button[aria-label='任務'],#v141DungeonNav button[aria-label='任務']")
            .forEach(button=>setQuestNoticeDot(button,show));
    }
    window.v148SyncQuestNoticeDots=syncQuestNoticeDots;

    if(typeof window.v141UpdateNotificationDots==="function"){
        const previousNotificationDots=window.v141UpdateNotificationDots;
        window.v141UpdateNotificationDots=function(){
            const result=previousNotificationDots.apply(this,arguments);
            syncQuestNoticeDots();
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncQuestNoticeDots();
            return result;
        };
    }

    if(typeof openHomeFeature==="function"){
        const previousOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(){
            const result=previousOpenHomeFeature.apply(this,arguments);
            syncQuestNoticeDots();
            return result;
        };
    }

    /* ----- Dungeon navigation and movement. ----- */
    function dungeonNavMarkup(isAbyss){
        const buttons=[
            ["角色","assets/ui/nav-character.png","openHomeFeature('character')"],
            ["背包","assets/ui/nav-backpack.png","openMapInventoryOverlay()"],
            ["商店","assets/ui/home-shop-v147.png","openHomeFeature('shop')"],
            ["元素匣","assets/ui/nav-element-box.png","openHomeFeature('autoBattleSettings')"],
            ["主城","assets/ui/nav-home.png","showPage('home')"]
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
        let topReturn=document.getElementById("v146AbyssReturn");
        if(isAbyss&&!topReturn){
            topReturn=document.createElement("button");
            topReturn.id="v146AbyssReturn";
            topReturn.type="button";
            topReturn.className="v146-abyss-return";
            topReturn.setAttribute("aria-label","返回上一層");
            topReturn.innerHTML='<img src="assets/ui/map-return.png" alt="">';
            topReturn.onclick=window.v146ExitAbyssMap;
            page.appendChild(topReturn);
        }else if(!isAbyss&&topReturn){
            topReturn.remove();
        }
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
            syncQuestNoticeDots();
            return result;
        };
    }
    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const result=previousShowPage.apply(this,arguments);
            if(page==="dungeon"){ scheduleDungeonSync(); }
            syncQuestNoticeDots();
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
        syncQuestNoticeDots();
        normalizeAllHardControls();
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        let queued=false;
        const observer=new MutationObserver(()=>{
            if(queued){ return; }
            queued=true;
            requestAnimationFrame(()=>{ queued=false; syncDungeonShell(); syncQuestNoticeDots(); });
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
            duplicateBuffRefresh:false,hardControlsExclusive:false,healCasterSp:false,
            reviveDeadTarget:true,dungeonTouchScroll:true,abyssRedirectable:true,
            patrolManualMovement:false,shopIcon:"assets/ui/home-shop-v147.png",
            dailyDungeonWaves:3,dailyDungeonEnemiesPerWave:6,goldDungeon:true
        };
    };
})();
