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

    window.v152SyncSkillPointDisplay=syncSkillPointDisplay;

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

    /* Final Abyss Emperor loadouts and Skill-ID dispatch are owned by
       js/59-abyss-two-tier-runtime.js + js/46-v155-dev-fixes.js.
       V152 no longer mutates monster skill loadouts or dispatches by name. */

    /* Battle Floating Feedback Owner now owns popup DOM, viewport anchoring and font sizing.
       V152's HP-only relocation wrapper was retired to avoid a second geometry owner. */

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

    window.v152SyncAbyssBattleUi=syncAbyssBattleUi;

    function boot(){
        cleanAccidentalFireSkill();
        syncSkillPointDisplay();
        syncAbyssBattleUi();
        removeTaskTracker();
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }

    window.v152SyncSkillPointDisplay=syncSkillPointDisplay;
    window.v152NormalizeRageBuff=normalizeRageBuff;
    window.v152SyncAbyssBattleUi=syncAbyssBattleUi;
    window.v152Diagnostics=function(){
        return {
            version:VERSION,independentSkillPointDisplay:true,removedFireBurstStrike:!(typeof skillDatabase!=="undefined"&&skillDatabase.fireBurstStrike),
            rageAppliedByCriticalResolver:true,damagePopupAboveVfx:true,taskTrackerRemoved:true,
            autoRecoveryOnMapEntry:true,abyssBattleInfo:true,abyssPortraits:true
        };
    };
})();
