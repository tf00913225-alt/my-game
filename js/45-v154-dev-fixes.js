/* =====================================================
   V154 — current dev battle, element box and monster portrait fixes
===================================================== */
(function installV154DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v154DevFixesInstalled){ return; }
    window.__v154DevFixesInstalled=true;

    const MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json";
    const HEAVENLY_SOLDIER_ELEMENTS=new Set(["fire","water","wind","earth"]);
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
    let monsterPortraitRegistry=null;
    let monsterPortraitRegistryPromise=null;
    let monsterPortraitByKey=new Map();
    let monsterPortraitByUniqueName=new Map();

    function currentAbyssRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters
            .map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.v141Abyss);
    }

    function isFinalAbyssRoster(roster){
        return roster.some(entry=>Object.prototype.hasOwnProperty.call(
            FINAL_ABYSS_PORTRAITS,
            entry.monster.name
        )&&entry.monster.name!=="天兵天將");
    }

    function registryTargets(registry){
        if(!registry||!registry.groups||!Array.isArray(registry.tupleSchema)){ return []; }
        const fields=registry.tupleSchema;
        return Object.entries(registry.groups).flatMap(([group,rows])=>(rows||[]).map(row=>{
            const target={group:group};
            fields.forEach((field,index)=>{ target[field]=row[index]; });
            return target;
        }));
    }

    function installMonsterPortraitRegistry(registry){
        const byKey=new Map();
        const byName=new Map();
        const duplicateNames=new Set();
        registryTargets(registry).forEach(target=>{
            if(target.status!=="existing"||!target.portraitKey||!target.path){ return; }
            byKey.set(target.portraitKey,target);
            if(byName.has(target.name)){ duplicateNames.add(target.name); }
            else{ byName.set(target.name,target); }
        });
        duplicateNames.forEach(name=>byName.delete(name));
        monsterPortraitRegistry=registry;
        monsterPortraitByKey=byKey;
        monsterPortraitByUniqueName=byName;
        syncMonsterPortraits();
        return registry;
    }
    window.v154InstallMonsterPortraitRegistry=installMonsterPortraitRegistry;

    function requestMonsterPortraitRegistry(){
        if(monsterPortraitRegistryPromise||typeof fetch!=="function"){ return monsterPortraitRegistryPromise; }
        monsterPortraitRegistryPromise=fetch(MONSTER_PORTRAIT_REGISTRY_URL,{cache:"no-cache"})
            .then(response=>{
                if(!response||!response.ok){ throw new Error("HTTP "+(response&&response.status)); }
                return response.json();
            })
            .then(installMonsterPortraitRegistry)
            .catch(error=>{
                console.warn("[monster-portrait] registry load failed; existing battle art remains active.",error);
                return null;
            });
        return monsterPortraitRegistryPromise;
    }
    window.v154RequestMonsterPortraitRegistry=requestMonsterPortraitRegistry;

    function legacyAbyssPortrait(monster,finalFloor){
        if(!monster||!monster.v141Abyss){ return null; }
        const portraits=finalFloor?FINAL_ABYSS_PORTRAITS:EARLY_ABYSS_PORTRAITS;
        return portraits[monster.name]||null;
    }

    function resolveMonsterPortraitRecord(monster,options){
        if(!monster){ return null; }
        const explicitKey=String(monster.portraitKey||monster.monsterPortraitKey||"").trim();
        if(explicitKey&&monsterPortraitByKey.has(explicitKey)){
            return monsterPortraitByKey.get(explicitKey);
        }
        if(monster.name==="天兵天將"){
            const element=String(monster.portraitElement||monster.element||"").toLowerCase();
            if(HEAVENLY_SOLDIER_ELEMENTS.has(element)){
                const soldier=monsterPortraitByKey.get("soldier."+element);
                if(soldier){ return soldier; }
            }
        }
        const byName=monsterPortraitByUniqueName.get(monster.name);
        if(byName){ return byName; }
        const legacy=legacyAbyssPortrait(monster,!!(options&&options.finalAbyss));
        return legacy?{
            portraitKey:"legacy.abyss."+String(monster.name||"unknown"),
            name:monster.name,
            element:monster.element||"dynamic",
            rank:monster.rank||"regular",
            sizeClass:"boss",
            path:legacy,
            status:"existing",
            legacy:true
        }:null;
    }
    window.v154ResolveMonsterPortraitRecord=resolveMonsterPortraitRecord;
    window.resolveMonsterPortrait=function(monster){
        const roster=currentAbyssRoster();
        const record=resolveMonsterPortraitRecord(monster,{finalAbyss:isFinalAbyssRoster(roster)});
        return record?record.path:null;
    };

    function installMonsterPortraitPresentationStyle(){
        if(typeof document==="undefined"||typeof document.createElement!=="function"){ return; }
        if(document.getElementById&&document.getElementById("v154MonsterPortraitStyle")){ return; }
        const style=document.createElement("style");
        style.id="v154MonsterPortraitStyle";
        style.textContent=
            '#game-stage #battlePage .battle-monster.v174-cardless-unit.v154-monster-portrait>.v174-battle-art{'+
            'inset:-8px -5px 2px!important;background-size:contain!important;background-position:center bottom!important;'+
            'background-repeat:no-repeat!important;}';
        const host=document.head||document.body;
        if(host&&typeof host.appendChild==="function"){ host.appendChild(style); }
    }

    function syncMonsterPortraitArt(card,portrait){
        if(!card){ return; }
        const selector=".v162-abyss-battle-portrait-art";
        const art=typeof card.querySelector==="function"?card.querySelector(selector):null;
        if(!portrait){
            if(art&&typeof art.remove==="function"){ art.remove(); }
            else if(art&&art.parentNode&&typeof art.parentNode.removeChild==="function"){
                art.parentNode.removeChild(art);
            }
            return;
        }
        let portraitArt=art;
        if(!portraitArt&&typeof document.createElement==="function"){
            portraitArt=document.createElement("img");
            portraitArt.className="v162-abyss-battle-portrait-art v154-monster-portrait-art";
            portraitArt.alt="";
            portraitArt.draggable=false;
            portraitArt.decoding="async";
            portraitArt.setAttribute("aria-hidden","true");
            if(card.firstChild&&typeof card.insertBefore==="function"){
                card.insertBefore(portraitArt,card.firstChild);
            }else if(typeof card.appendChild==="function"){
                card.appendChild(portraitArt);
            }
        }
        if(portraitArt&&portraitArt.dataset.monsterPortraitSrc!==portrait){
            portraitArt.src=portrait;
            portraitArt.dataset.monsterPortraitSrc=portrait;
            portraitArt.dataset.abyssPortraitSrc=portrait;
        }
    }

    function syncCardlessPresentation(card,record){
        if(!card){ return; }
        const previousManaged=!!card.dataset.monsterPortraitKey;
        const art=typeof card.querySelector==="function"?card.querySelector(".v174-battle-art"):null;
        if(record){
            const cssValue='url("'+record.path+'")';
            if(!previousManaged&&card.dataset.v174BattleArtwork){
                card.dataset.v154BaseBattleArtwork=card.dataset.v174BattleArtwork;
            }
            card.dataset.v174BattleArtwork=cssValue;
            if(art&&art.style){ art.style.backgroundImage=cssValue; }
            return;
        }
        if(!previousManaged){ return; }
        const base=card.dataset.v154BaseBattleArtwork||"";
        if(base){ card.dataset.v174BattleArtwork=base; }
        else{ delete card.dataset.v174BattleArtwork; }
        delete card.dataset.v154BaseBattleArtwork;
        if(art&&art.style){
            if(base){ art.style.backgroundImage=base; }
            else if(typeof art.style.removeProperty==="function"){ art.style.removeProperty("background-image"); }
            else{ art.style.backgroundImage=""; }
        }
    }

    function syncMonsterPortraits(){
        if(typeof document==="undefined"){ return; }
        installMonsterPortraitPresentationStyle();
        const roster=currentAbyssRoster();
        const finalFloor=isFinalAbyssRoster(roster);
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
            const record=resolveMonsterPortraitRecord(monster,{finalAbyss:finalFloor});
            const portrait=record&&record.path;
            const abyssPortrait=!!(portrait&&monster&&monster.v141Abyss);
            syncCardlessPresentation(card,record);
            card.classList.toggle("v152-abyss-portrait",abyssPortrait);
            card.classList.toggle("v154-abyss-portrait",abyssPortrait);
            card.classList.toggle("v154-monster-portrait",!!portrait);
            if(portrait){
                card.style.setProperty("--v152-abyss-portrait",'url("'+portrait+'")');
                card.dataset.monsterPortraitKey=record.portraitKey;
                card.dataset.monsterPortraitPath=portrait;
                if(abyssPortrait){ card.dataset.abyssPortrait=finalFloor?"floor5":"floor1-4"; }
                else{ delete card.dataset.abyssPortrait; }
            }else{
                card.style.removeProperty("--v152-abyss-portrait");
                delete card.dataset.monsterPortraitKey;
                delete card.dataset.monsterPortraitPath;
                delete card.dataset.abyssPortrait;
            }
            syncMonsterPortraitArt(card,portrait);
        });
    }
    window.v154SyncMonsterPortraits=syncMonsterPortraits;
    window.v154SyncAbyssPortraits=syncMonsterPortraits;

    if(typeof renderBattle==="function"){
        const previousRenderBattle=renderBattle;
        renderBattle=function(){
            const result=previousRenderBattle.apply(this,arguments);
            syncMonsterPortraits();
            return result;
        };
    }
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            syncMonsterPortraits();
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

    function showElementBoxUseNotice(message){
        if(typeof document==="undefined"){ return; }
        const host=document.getElementById("game-stage")||document.body;
        if(!host){ return; }
        let stack=document.getElementById("v17342ElementBoxNoticeStack");
        if(!stack){
            stack=document.createElement("div");
            stack.id="v17342ElementBoxNoticeStack";
            stack.className="v17342-element-box-notice-stack";
            stack.setAttribute("aria-live","polite");
            stack.setAttribute("aria-atomic","false");
            host.appendChild(stack);
        }
        const notice=document.createElement("div");
        notice.className="v17342-element-box-use-notice";
        notice.textContent=String(message||"");
        stack.appendChild(notice);
        while(stack.children&&stack.children.length>6){
            const oldest=stack.firstElementChild;
            if(!oldest||oldest===notice){ break; }
            oldest.remove();
        }
        const setNoticeVisible=visible=>{
            if(!notice.classList){ return; }
            if(typeof notice.classList.toggle==="function"){
                notice.classList.toggle("show",!!visible);
                return;
            }
            const method=visible?"add":"remove";
            if(typeof notice.classList[method]==="function"){
                notice.classList[method]("show");
            }
        };
        const revealNotice=()=>setNoticeVisible(true);
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(revealNotice); }
        else{ revealNotice(); }
        if(typeof setTimeout==="function"){
            setTimeout(()=>{
                setNoticeVisible(false);
                setTimeout(()=>{
                    if(notice.parentNode&&typeof notice.remove==="function"){ notice.remove(); }
                    const childCount=Number.isFinite(Number(stack&&stack.childElementCount))
                        ?Number(stack.childElementCount)
                        :(stack&&Array.isArray(stack.children)?stack.children.length:1);
                    if(stack&&childCount===0&&stack.parentNode&&typeof stack.remove==="function"){ stack.remove(); }
                },180);
            },3000);
        }
    }
    window.v17342ShowElementBoxUseNotice=showElementBoxUseNotice;

    function logElementBoxRecovery(message,noticeOnly){
        const text=String(message||"");
        if(!text){ return; }
        if(noticeOnly){
            showElementBoxUseNotice(text);
            return;
        }
        if(typeof addBattleLog==="function"){ addBattleLog(text); }
        if(!(typeof battleActive!=="undefined"&&battleActive)&&typeof window!=="undefined"){
            window.v17342PendingBattleNotices=Array.isArray(window.v17342PendingBattleNotices)
                ?window.v17342PendingBattleNotices:[];
            window.v17342PendingBattleNotices.push(text);
            if(window.v17342PendingBattleNotices.length>12){ window.v17342PendingBattleNotices.shift(); }
        }
    }

    function finishAutoRecovery(){
        if(
            typeof getExistingPartyIndexes!=="function"||
            typeof getPartyCharacterByIndex!=="function"||
            typeof getPartyAutoConfig!=="function"||
            typeof getPartyBattleStats!=="function"
        ){ return 0; }
        let consumed=0;
        let shouldReturnToCity=false;
        const elementBoxActive=isElementBoxRecoveryActive();
        const entries=getExistingPartyIndexes().map(characterIndex=>{
            const entry={
                characterIndex:characterIndex,
                character:getPartyCharacterByIndex(characterIndex),
                config:getPartyAutoConfig(characterIndex),
                stats:getPartyBattleStats(characterIndex)
            };
            if(
                !entry.character||entry.character.hp<=0||!entry.config||!entry.stats||
                (!entry.config.enabled&&!elementBoxActive)
            ){ return null; }
            return entry;
        }).filter(Boolean);

        ["hp","sp"].forEach(resource=>{
            let pending=entries.slice();
            let guard=0;
            while(pending.length&&guard++<Math.max(100,entries.length*100)){
                let progressed=false;
                const next=[];
                pending.forEach(entry=>{
                    const character=entry.character;
                    const config=entry.config;
                    const stats=entry.stats;
                    const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);
                    const threshold=normalizeAutoBattleThreshold(
                        config[resource],
                        resource==="hp"?50:25
                    );
                    const currentValue=Number(character[resource])||0;
                    if(maxValue<=0||currentValue>=maxValue||currentValue/maxValue*100>threshold){ return; }
                    const potionId=getAutoPotionId(resource);
                    const definition=getPotionDefinition(potionId);
                    if(!definition||!consumePotionFromInventory(potionId,1)){
                        if(config.returnToCityWhenEmpty){ shouldReturnToCity=true; }
                        return;
                    }
                    const planned=definition.recoveryPercent>=100
                        ?maxValue-currentValue
                        :Math.max(1,Math.round(maxValue*definition.recoveryPercent/100));
                    const recovered=Math.max(0,Math.min(maxValue-currentValue,planned));
                    character[resource]=Math.min(maxValue,currentValue+recovered);
                    consumed++;
                    progressed=true;
                    logElementBoxRecovery(
                        "["+(character.id||"角色")+"使用補品 恢復"+recovered+resource.toUpperCase()+"]",
                        true
                    );
                    const updatedValue=Number(character[resource])||0;
                    if(recovered>0&&updatedValue<maxValue&&updatedValue/maxValue*100<=threshold){
                        next.push(entry);
                    }
                });
                pending=next;
                if(!progressed){ break; }
            }
        });
        if(consumed&&typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        if(shouldReturnToCity&&elementBoxActive){
            const emptyPotionMessage="元素匣偵測到補品不足，已停止巡練並返回主城。";
            logElementBoxRecovery(emptyPotionMessage);
            if(typeof window.v169StopElementBox==="function"){ window.v169StopElementBox(); }
            else if(typeof toggleAutoBattle==="function"&&typeof autoBattle!=="undefined"&&autoBattle){ toggleAutoBattle(); }
            if(typeof showPage==="function"){ showPage("home"); }
            if(typeof window.rpgAlert==="function"){
                void window.rpgAlert(
                    "自動補品已用完，元素匣已停止巡練並返回主城。\n請補充補品後，再重新啟動元素匣。",
                    {title:"補品不足",confirmText:"知道了",danger:true}
                );
            }else if(typeof alert==="function"){
                alert(emptyPotionMessage);
            }
        }
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

    function setElementBoxSettingsLayer(active){
        if(typeof document==="undefined"||!document.body||!document.body.classList){ return; }
        document.body.classList.toggle("v162-element-box-settings-open",!!active);
    }

    if(typeof openHomeFeature==="function"){
        const previousOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=previousOpenHomeFeature.apply(this,arguments);
            setElementBoxSettingsLayer(type==="autoBattleSettings");
            return result;
        };
    }
    if(typeof closeHomeFeature==="function"){
        const previousCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const result=previousCloseHomeFeature.apply(this,arguments);
            setElementBoxSettingsLayer(false);
            return result;
        };
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
            setElementBoxSettingsLayer(true);
            return result;
        };
    }
    if(typeof closeAutoBattleSettings==="function"){
        const previousCloseAutoBattleSettings=closeAutoBattleSettings;
        closeAutoBattleSettings=function(){
            const result=previousCloseAutoBattleSettings.apply(this,arguments);
            setElementBoxSettingsLayer(false);
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
    if(typeof setInterval==="function"){
        setInterval(()=>{
            if(
                isElementBoxRecoveryActive()&&
                !(typeof battleActive!=="undefined"&&battleActive)
            ){
                const consumed=finishAutoRecovery();
                if(consumed&&typeof updateUI==="function"){ updateUI(); }
                if(consumed&&typeof saveGame==="function"){ saveGame(); }
            }
        },1000);
    }
    syncElementBoxPrimaryButton();
    requestMonsterPortraitRegistry();
    syncMonsterPortraits();
})();
