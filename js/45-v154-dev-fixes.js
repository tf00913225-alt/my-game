/* =====================================================
   V154 — current dev battle, element box and Abyss fixes
===================================================== */
(function installV154DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v154DevFixesInstalled){ return; }
    window.__v154DevFixesInstalled=true;

    const EARLY_ABYSS_PORTRAITS={
        東帝:"assets/dungeons/abyss/east-emperor.webp",
        天帝:"assets/dungeons/abyss/heaven-emperor.webp",
        北帝:"assets/dungeons/abyss/north-emperor.webp",
        南帝:"assets/dungeons/abyss/south-emperor.webp",
        天兵天將:"assets/dungeons/abyss/soldier.webp"
    };
    const FINAL_ABYSS_PORTRAITS={
        東帝天尊:"assets/dungeons/abyss/floor5-east-emperor.webp",
        天帝天尊:"assets/dungeons/abyss/floor5-heaven-emperor.webp",
        北帝天尊:"assets/dungeons/abyss/floor5-north-emperor.webp",
        南帝天尊:"assets/dungeons/abyss/floor5-south-emperor.webp",
        極帝天尊:"assets/dungeons/abyss/floor5-extreme-emperor.webp",
        天兵天將:"assets/dungeons/abyss/floor5-soldier.webp"
    };

    function currentAbyssRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters
            .map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.v141Abyss);
    }

    function syncAbyssPortraits(){
        if(typeof document==="undefined"){ return; }
        const roster=currentAbyssRoster();
        const finalFloor=roster.some(entry=>Object.prototype.hasOwnProperty.call(
            FINAL_ABYSS_PORTRAITS,
            entry.monster.name
        )&&entry.monster.name!=="天兵天將");
        const portraits=finalFloor?FINAL_ABYSS_PORTRAITS:EARLY_ABYSS_PORTRAITS;
        const battlePage=document.getElementById("battlePage");
        if(battlePage){
            battlePage.classList.toggle("v154-abyss-battle",roster.length>0);
            battlePage.classList.toggle("v154-abyss-final",finalFloor);
        }

        if(typeof currentBattleMonsters==="undefined"){ return; }
        currentBattleMonsters.forEach(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            const card=document.getElementById("battleMonster"+index);
            if(!card){ return; }
            const portrait=monster&&monster.v141Abyss?portraits[monster.name]:null;
            card.classList.toggle("v152-abyss-portrait",!!portrait);
            card.classList.toggle("v154-abyss-portrait",!!portrait);
            if(portrait){
                card.style.setProperty("--v152-abyss-portrait",'url("'+portrait+'")');
                card.dataset.abyssPortrait=finalFloor?"floor5":"floor1-4";
            }else{
                card.style.removeProperty("--v152-abyss-portrait");
                delete card.dataset.abyssPortrait;
            }
        });
    }
    window.v154SyncAbyssPortraits=syncAbyssPortraits;

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const result=previousRenderBattle.apply(this,arguments);
            syncAbyssPortraits();
            return result;
        };
    }
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncAbyssPortraits();
            return result;
        };
    }

    function isElementBoxRecoveryActive(){
        if(typeof window.v131GetElementBoxState==="function"){
            try{
                const state=window.v131GetElementBoxState();
                return !!(state&&state.active);
            }catch(_){ }
        }
        return typeof autoBattle!=="undefined"&&!!autoBattle;
    }

    function finishAutoRecovery(){
        if(
            typeof getExistingPartyIndexes!=="function"||
            typeof getPartyCharacterByIndex!=="function"||
            typeof getPartyAutoConfig!=="function"||
            typeof getPartyBattleStats!=="function"
        ){ return 0; }
        let consumed=0;
        const elementBoxActive=isElementBoxRecoveryActive();
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const config=getPartyAutoConfig(characterIndex);
            const stats=getPartyBattleStats(characterIndex);
            if(
                !character||character.hp<=0||!config||!stats||
                (!config.enabled&&!elementBoxActive)
            ){ return; }

            ["hp","sp"].forEach(resource=>{
                const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);
                const threshold=normalizeAutoBattleThreshold(
                    config[resource],
                    resource==="hp"?50:25
                );
                let guard=0;
                while(guard++<100){
                    const currentValue=Number(character[resource])||0;
                    if(maxValue<=0||currentValue>=maxValue||currentValue/maxValue*100>threshold){ break; }
                    const potionId=getAutoPotionId(resource);
                    const definition=getPotionDefinition(potionId);
                    if(!definition||!consumePotionFromInventory(potionId,1)){ break; }
                    const planned=definition.recoveryPercent>=100
                        ?maxValue-currentValue
                        :Math.max(1,Math.round(maxValue*definition.recoveryPercent/100));
                    const recovered=Math.max(0,Math.min(maxValue-currentValue,planned));
                    character[resource]=Math.min(maxValue,currentValue+recovered);
                    consumed++;
                    if(typeof addBattleLog==="function"){
                        addBattleLog(
                            "元素匣為"+(character.id||"角色")+"自動使用"+
                            definition.name+"，恢復"+recovered+" "+resource.toUpperCase()+"。"
                        );
                    }
                    if(recovered<=0){ break; }
                }
            });
        });
        if(consumed&&typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        return consumed;
    }
    window.v154FinishAutoRecovery=finishAutoRecovery;
    window.v154IsElementBoxRecoveryActive=isElementBoxRecoveryActive;

    if(typeof applyPostBattleAutoRecovery==="function"){
        const previousAutoRecovery=applyPostBattleAutoRecovery;
        applyPostBattleAutoRecovery=function(){
            const result=previousAutoRecovery.apply(this,arguments);
            finishAutoRecovery();
            return result;
        };
    }

    function syncElementBoxPrimaryButton(){
        if(typeof document==="undefined"){ return; }
        const button=document.getElementById("autoBattleButton");
        if(!button){ return; }
        button.setAttribute("onclick","v154UseElementBoxPrimaryAction()");
        const active=typeof autoBattle!=="undefined"&&autoBattle;
        button.textContent=active?"⏹ 停止":"套用並啟動";
        button.classList.toggle("active",active);
    }
    window.v154UseElementBoxPrimaryAction=function(){
        if(typeof autoBattle!=="undefined"&&autoBattle){
            return typeof toggleAutoBattle==="function"?toggleAutoBattle():undefined;
        }
        return typeof confirmAutoBattleSettings==="function"?confirmAutoBattleSettings():undefined;
    };

    if(typeof updateAutoButton==="function"){
        const previousUpdateAutoButton=updateAutoButton;
        updateAutoButton=function(){
            const result=previousUpdateAutoButton.apply(this,arguments);
            syncElementBoxPrimaryButton();
            return result;
        };
    }
    if(typeof openAutoBattleSettings==="function"){
        const previousOpenAutoBattleSettings=openAutoBattleSettings;
        openAutoBattleSettings=function(){
            const result=previousOpenAutoBattleSettings.apply(this,arguments);
            syncElementBoxPrimaryButton();
            return result;
        };
    }
    if(typeof setTimeout==="function"){
        setTimeout(()=>{
            if(
                isElementBoxRecoveryActive()&&
                !(typeof battleActive!=="undefined"&&battleActive)
            ){
                const consumed=finishAutoRecovery();
                if(consumed&&typeof updateUI==="function"){ updateUI(); }
                if(consumed&&typeof saveGame==="function"){ saveGame(); }
            }
        },0);
    }
    syncElementBoxPrimaryButton();
    syncAbyssPortraits();
})();
