/* =====================================================
   V152 — current dev fixes and final requested values
===================================================== */
(function installV152DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v152DevFixesInstalled){ return; }
    window.__v152DevFixesInstalled=true;

    const VERSION="152";
    const ABYSS_PORTRAITS={
        東帝:"assets/dungeons/abyss/east-emperor.webp",
        天帝:"assets/dungeons/abyss/heaven-emperor.webp",
        北帝:"assets/dungeons/abyss/north-emperor.webp",
        南帝:"assets/dungeons/abyss/south-emperor.webp",
        天兵天將:"assets/dungeons/abyss/soldier.webp"
    };

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function levelValue(values,level,fallback){
        if(!Array.isArray(values)||!values.length){ return numeric(fallback); }
        const index=Math.max(0,Math.min(values.length-1,Math.floor(numeric(level)||1)-1));
        return numeric(values[index]);
    }

    function patchSkill(id,fields){
        if(typeof skillDatabase==="undefined"||!skillDatabase[id]){ return; }
        Object.keys(fields).forEach(key=>{
            skillDatabase[id][key]=Array.isArray(fields[key])?fields[key].slice():fields[key];
        });
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
        targetType:"allyAll",cleanseChance:20,agilityBonusPercent:50,duration:2,
        description:"對我方全體施放祝福，有20%機率解除所有負面狀態，並增加敏捷50%，持續2回合。"
    });

    function cleanAccidentalFireSkill(){
        if(typeof skillDatabase!=="undefined"){ delete skillDatabase.fireBurstStrike; }
        if(typeof characterSkillLoadouts!=="undefined"&&characterSkillLoadouts){
            Object.keys(characterSkillLoadouts).forEach(key=>{
                const loadout=characterSkillLoadouts[key];
                if(!loadout){ return; }
                if(loadout.skillLevels){ delete loadout.skillLevels.fireBurstStrike; }
                if(Array.isArray(loadout.equippedSkills)){
                    loadout.equippedSkills=loadout.equippedSkills.filter(id=>id!=="fireBurstStrike");
                }
            });
        }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyAutoConfig==="function"){
            getExistingPartyIndexes().forEach(index=>{
                const config=getPartyAutoConfig(index);
                if(config&&config.skill==="fireBurstStrike"){ config.skill="normal"; }
            });
        }
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            monsters.forEach(monster=>{
                if(!monster){ return; }
                if(Array.isArray(monster.skillIds)){
                    monster.skillIds=monster.skillIds.map(id=>id==="fireBurstStrike"?"fireCritical":id);
                }
                if(Array.isArray(monster.v141SupportSkillIds)){
                    monster.v141SupportSkillIds=monster.v141SupportSkillIds.filter(id=>id!=="fireBurstStrike");
                }
            });
        }
    }
    cleanAccidentalFireSkill();

    function syncSkillPointDisplay(){
        if(typeof document==="undefined"){ return; }
        const node=document.getElementById("skillPoints");
        if(!node){ return; }
        const owner=typeof getSkillCharacterObject==="function"&&typeof currentSkillCharacter!=="undefined"
            ?getSkillCharacterObject(currentSkillCharacter):null;
        node.textContent=String(Math.max(0,Math.floor(numeric(owner&&owner.skillPoints))));
    }

    if(typeof renderSkillLoadout==="function"){
        const previousRenderSkillLoadout=renderSkillLoadout;
        renderSkillLoadout=function(){
            const result=previousRenderSkillLoadout.apply(this,arguments);
            syncSkillPointDisplay();
            return result;
        };
    }

    function partySkillLevel(characterIndex,skillId){
        if(typeof getSkillLevel!=="function"){ return 1; }
        const key=typeof getPartyCharacterKey==="function"
            ?getPartyCharacterKey(characterIndex):(characterIndex===0?"fire":"player"+(characterIndex+1));
        return Math.max(1,Math.min(5,Math.floor(numeric(getSkillLevel(key,skillId))||1)));
    }

    function rageLevelFor(character,buff){
        if(buff&&numeric(buff.skillLevel)>0){ return numeric(buff.skillLevel); }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const index=getExistingPartyIndexes().find(item=>getPartyCharacterByIndex(item)===character);
            if(Number.isInteger(index)){ return partySkillLevel(index,"rage"); }
        }
        return Math.max(1,numeric(character&&(character.v141ForceSkillLevel||character.v141SkillLevel))||1);
    }

    function normalizeRageBuff(character){
        const buff=character&&Array.isArray(character.activeBuffs)
            ?character.activeBuffs.find(item=>item&&item.type==="rage"&&numeric(item.turnsLeft)>0):null;
        if(!buff){ return null; }
        const level=rageLevelFor(character,buff);
        const skill=typeof skillDatabase!=="undefined"?skillDatabase.rage:null;
        const chance=levelValue(skill&&(skill.critChanceBonusByLevel||skill.critBonusByLevel),level,0);
        const damage=levelValue(skill&&(skill.critDamageBonusByLevel||skill.critBonusByLevel),level,0);
        buff.bonusPercent=chance;
        buff.critChanceBonusPercent=chance;
        buff.critDamageBonusPercent=damage;
        buff.skillLevel=level;
        return buff;
    }

    if(typeof rollCritical==="function"){
        const previousRollCritical=rollCritical;
        rollCritical=function(character){
            normalizeRageBuff(character);
            return previousRollCritical.apply(this,arguments);
        };
    }

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

    function applyExtremeBlessing(monster){
        if(!monster||monster.alive===false){ return; }
        let blessing=monster.v142AgilityBlessing;
        if(!blessing){
            const original=Math.max(0,numeric(monster.agility));
            const display={type:"v141TeamBuff",v141BuffType:"agility",turnsLeft:2};
            blessing={originalAgility:original,turnsLeft:2,displayBuff:display};
            monster.v142AgilityBlessing=blessing;
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
        }
        blessing.turnsLeft=2;
        blessing.displayBuff.turnsLeft=2;
        monster.agility=Math.round(numeric(blessing.originalAgility)*1.5);
    }

    function resolveExtremeEmperorAction(monsterIndex,forcedSkillId,forcedCleanse){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster||monster.alive===false||numeric(monster.hp)<=0||monster.name!=="極帝天尊"){ return false; }
        monster.v141AbyssAi="v152-support";
        monster.v141SupportSkillIds=Array.from(new Set((monster.v141SupportSkillIds||[]).concat([
            "yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"
        ])));
        if((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||
           (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))){ return false; }

        const allies=currentAbyssEntries();
        if(!allies.length){ return false; }
        const hasNegative=allies.some(entry=>Array.isArray(entry.monster.statusEffects)&&entry.monster.statusEffects.length>0);
        const needsHeal=allies.some(entry=>monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)||
            numeric(entry.monster.sp)<numeric(entry.monster.maxSP));
        const needsShield=allies.some(entry=>!(entry.monster.v141Shield&&numeric(entry.monster.v141Shield.remaining)>0));
        const needsBlessing=allies.some(entry=>!(entry.monster.v142AgilityBlessing&&numeric(entry.monster.v142AgilityBlessing.turnsLeft)>0));
        const skillId=forcedSkillId||(hasNegative?"yuanZuBlessing":needsHeal?"yuanXiangGuangMing":
            needsShield?"yuanGuangShield":needsBlessing?"yuanZuBlessing":null);
        const skill=skillId&&typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }

        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }

        if(skillId==="yuanXiangGuangMing"){
            let hpTotal=0;
            let spTotal=0;
            allies.forEach(entry=>{
                const ally=entry.monster;
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,150):(function(){
                        const before=numeric(ally.hp);
                        ally.hp=Math.min(numeric(ally.maxHP),before+150);
                        return ally.hp-before;
                    })();
                const restored=restoreMonsterSp(ally,55);
                hpTotal+=healed;
                spTotal+=restored;
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restored>0&&typeof showDamagePopup==="function"&&typeof document!=="undefined"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restored+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元相光明：我方全體回復150 HP、55 SP（實際 "+hpTotal+" HP／"+spTotal+" SP）。");
            }
        }else if(skillId==="yuanGuangShield"){
            allies.forEach(entry=>{
                if(typeof window.v141ApplyMonsterShield==="function"){
                    window.v141ApplyMonsterShield(entry.monster,100,2);
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元光護體：我方全體獲得100護盾，持續2回合。");
            }
        }else if(skillId==="yuanZuBlessing"){
            const cleansed=forcedCleanse===undefined?Math.random()*100<20:!!forcedCleanse;
            let removed=0;
            allies.forEach(entry=>{
                const ally=entry.monster;
                if(cleansed&&Array.isArray(ally.statusEffects)){
                    removed+=ally.statusEffects.length;
                    ally.statusEffects=[];
                }
                applyExtremeBlessing(ally);
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元祖賜福：我方全體敏捷提升50%，持續2回合；"+
                    (cleansed?"並解除"+removed+"個負面狀態。":"本次未觸發負面狀態解除。"));
            }
        }else{
            return false;
        }

        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousMonsterSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss&&monster.name==="極帝天尊"){
                return resolveExtremeEmperorAction(monsterIndex);
            }
            return previousMonsterSpecial.apply(this,arguments);
        };
    }

    function hasFrostbite(character){
        return !!(character&&Array.isArray(character.statusEffects)&&character.statusEffects.some(effect=>
            effect&&effect.type==="frostbite"&&numeric(effect.turnsLeft)>0
        ));
    }

    function activeBattleCharacter(){
        const index=typeof activeBattleCharacterIndex==="number"?activeBattleCharacterIndex:0;
        return typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
    }

    function syncFrostbiteSkillControls(){
        if(typeof document==="undefined"){ return; }
        const blocked=hasFrostbite(activeBattleCharacter());
        const mainButton=document.querySelector&&document.querySelector("#mainBattleMenu > .menu-button.skill");
        if(mainButton){
            if(blocked){
                mainButton.disabled=true;
                mainButton.dataset.v152FrostbiteBlocked="1";
                mainButton.classList.add("v152-frostbite-blocked");
                mainButton.setAttribute("aria-label","凍傷中，禁止使用技能");
            }else if(mainButton.dataset.v152FrostbiteBlocked==="1"){
                mainButton.disabled=false;
                delete mainButton.dataset.v152FrostbiteBlocked;
                mainButton.classList.remove("v152-frostbite-blocked");
                mainButton.setAttribute("aria-label","技能");
            }
        }
        if(!blocked||!document.querySelectorAll){ return; }
        document.querySelectorAll("#skillQuickBarGrid .skill-quick-button").forEach(button=>{
            button.disabled=true;
            button.onclick=null;
            button.classList.add("v152-frostbite-blocked");
            const icon=button.querySelector(".sq-icon-wrap")||button;
            if(!icon.querySelector(".v152-frostbite-symbol")){
                const symbol=document.createElement("span");
                symbol.className="v152-frostbite-symbol";
                symbol.textContent="🚫";
                icon.appendChild(symbol);
            }
        });
    }

    if(typeof populateSkillQuickBar==="function"){
        const previousPopulateSkillQuickBar=populateSkillQuickBar;
        populateSkillQuickBar=function(){
            const result=previousPopulateSkillQuickBar.apply(this,arguments);
            syncFrostbiteSkillControls();
            return result;
        };
    }
    if(typeof toggleSkillQuickBar==="function"){
        const previousToggleSkillQuickBar=toggleSkillQuickBar;
        toggleSkillQuickBar=function(){
            if(hasFrostbite(activeBattleCharacter())){
                syncFrostbiteSkillControls();
                return;
            }
            return previousToggleSkillQuickBar.apply(this,arguments);
        };
    }

    if(typeof showDamagePopup==="function"){
        const previousShowDamagePopup=showDamagePopup;
        showDamagePopup=function(element){
            const result=previousShowDamagePopup.apply(this,arguments);
            if(!element||typeof document==="undefined"||!document.body||!element.querySelectorAll){ return result; }
            const popups=element.querySelectorAll(":scope > .damage-popup.hp-popup");
            const popup=popups.length?popups[popups.length-1]:null;
            if(!popup||typeof element.getBoundingClientRect!=="function"){ return result; }
            const rect=element.getBoundingClientRect();
            const visualScale=Math.max(.8,Math.min(3,rect.width/Math.max(1,numeric(element.offsetWidth)||rect.width)));
            popup.classList.add("v152-top-damage");
            popup.style.setProperty("left",(rect.left+rect.width/2)+"px","important");
            popup.style.setProperty("top",(rect.top+rect.height*.26)+"px","important");
            popup.style.setProperty("font-size",Math.round(18*visualScale)+"px","important");
            document.body.appendChild(popup);
            return result;
        };
    }

    function dismissRewardToast(toast){
        if(!toast){ return; }
        if(toast._hideTimer){ clearTimeout(toast._hideTimer); }
        toast.classList.remove("show");
    }

    function removeTaskTracker(){
        if(typeof document==="undefined"){ return; }
        const tracker=document.getElementById("v141TaskTracker");
        if(tracker){ tracker.remove(); }
    }

    if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
        document.addEventListener("click",event=>{
            const toast=event.target&&event.target.closest?event.target.closest("#v141RewardToast"):null;
            if(toast){ dismissRewardToast(toast); }
        },true);
    }

    function anyAutoRecoveryEnabled(){
        if(typeof getExistingPartyIndexes!=="function"||typeof getPartyAutoConfig!=="function"){ return false; }
        return getExistingPartyIndexes().some(index=>{
            const config=getPartyAutoConfig(index);
            return !!(config&&config.enabled);
        });
    }

    let lastAutoRecoveryAt=-Infinity;
    if(typeof applyPostBattleAutoRecovery==="function"){
        const previousAutoRecovery=applyPostBattleAutoRecovery;
        applyPostBattleAutoRecovery=function(){
            const result=previousAutoRecovery.apply(this,arguments);
            lastAutoRecoveryAt=Date.now();
            return result;
        };
    }

    function recoverOnMapEntry(){
        if(
            typeof battleActive!=="undefined"&&battleActive||
            !anyAutoRecoveryEnabled()||
            typeof applyPostBattleAutoRecovery!=="function"||
            Date.now()-lastAutoRecoveryAt<5000
        ){ return false; }
        applyPostBattleAutoRecovery();
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        return true;
    }

    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const target=typeof document!=="undefined"?document.getElementById(page+"Page"):null;
            const wasActive=!!(target&&target.classList.contains("active"));
            const result=previousShowPage.apply(this,arguments);
            const entered=target&&target.classList.contains("active")&&!wasActive;
            if(entered&&page==="map"){ recoverOnMapEntry(); }
            return result;
        };
    }

    if(typeof enterMap==="function"){
        const previousEnterMap=enterMap;
        enterMap=function(){
            const result=previousEnterMap.apply(this,arguments);
            recoverOnMapEntry();
            return result;
        };
    }

    ["v141StartAbyss","v141ResetAbyss"].forEach(functionName=>{
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const result=previous.apply(this,arguments);
            recoverOnMapEntry();
            return result;
        };
    });

    if(typeof switchDungeonTab==="function"){
        const previousSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(tabName){
            const result=previousSwitchDungeonTab.apply(this,arguments);
            if(tabName==="abyss"&&typeof document!=="undefined"&&document.getElementById("v141AbyssMap")){
                recoverOnMapEntry();
            }
            return result;
        };
    }

    function currentRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})).filter(entry=>entry.monster);
    }

    function syncAbyssBattleUi(){
        if(typeof document==="undefined"){ return; }
        const roster=currentRoster();
        const abyss=roster.some(entry=>entry.monster.v141Abyss);
        const battlePage=document.getElementById("battlePage");
        if(battlePage){ battlePage.classList.toggle("v152-abyss-battle",abyss); }
        const info=document.getElementById("battleInfo");
        if(abyss&&info){ info.hidden=false; info.removeAttribute("hidden"); }

        const earlyAbyss=abyss&&roster.length<=5&&!roster.some(entry=>entry.monster.name==="極帝天尊");
        roster.forEach(entry=>{
            const card=document.getElementById("battleMonster"+entry.index);
            if(!card){ return; }
            const portrait=earlyAbyss?ABYSS_PORTRAITS[entry.monster.name]:null;
            card.classList.toggle("v152-abyss-portrait",!!portrait);
            if(portrait){
                card.style.setProperty("--v152-abyss-portrait",'url("'+portrait+'")');
            }else{
                card.style.removeProperty("--v152-abyss-portrait");
            }
        });
    }

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const result=previousRenderBattle.apply(this,arguments);
            syncAbyssBattleUi();
            return result;
        };
    }
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncAbyssBattleUi();
            return result;
        };
    }
    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncSkillPointDisplay();
            syncFrostbiteSkillControls();
            syncAbyssBattleUi();
            return result;
        };
    }

    function boot(){
        cleanAccidentalFireSkill();
        syncSkillPointDisplay();
        syncFrostbiteSkillControls();
        syncAbyssBattleUi();
        removeTaskTracker();
    }

    if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){
        const beginObserve=()=>{
            if(!document.body){ return; }
            const observer=new MutationObserver(()=>removeTaskTracker());
            observer.observe(document.body,{childList:true,subtree:true});
        };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",beginObserve,{once:true}); }
        else{ beginObserve(); }
    }
    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v152SyncSkillPointDisplay=syncSkillPointDisplay;
    window.v152NormalizeRageBuff=normalizeRageBuff;
    window.v152ResolveExtremeEmperorAction=resolveExtremeEmperorAction;
    window.v152SyncFrostbiteSkillControls=syncFrostbiteSkillControls;
    window.v152SyncAbyssBattleUi=syncAbyssBattleUi;
    window.v152Diagnostics=function(){
        return {
            version:VERSION,independentSkillPointDisplay:true,removedFireBurstStrike:!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike),
            rageAppliedByCriticalResolver:true,damagePopupAboveVfx:true,taskTrackerRemoved:true,
            autoRecoveryOnMapEntry:true,abyssBattleInfo:true,abyssPortraits:true
        };
    };
})();
