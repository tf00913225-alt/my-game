/* =====================================================
   V154 — current dev battle, element box and monster portrait fixes
===================================================== */
(function installV154DevFixes(){
    "use strict";

    if(typeof window==="undefined"||window.__v154DevFixesInstalled){ return; }
    window.__v154DevFixesInstalled=true;

    const MONSTER_PORTRAIT_REGISTRY_URL="config/monster-portrait-registry.json";
    const HEAVENLY_SOLDIER_ELEMENTS=new Set(["fire","water","wind","earth"]);
    let monsterPortraitRegistry=null;
    let monsterPortraitRegistryPromise=null;
    let monsterPortraitRegistryState="pending";
    let monsterPortraitRegistryFailure=null;
    const monsterPortraitAssetFailures=new Set();
    const dailyPortraitPreparation=new Map();
    let monsterPortraitByKey=new Map();
    let monsterPortraitByUniqueName=new Map();
    let monsterPortraitIdentityByKey=new Map();
    let monsterPortraitIdentityByUniqueName=new Map();

    function currentAbyssRoster(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters
            .map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.v141Abyss);
    }

    function isFinalAbyssRoster(roster){
        return roster.some(entry=>entry.monster.v174TrueRealmFinal||String(monsterPortraitByUniqueName.get(entry.monster.name)?.portraitKey||"").startsWith("abyss.final."));
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
        monsterPortraitIdentityByKey=new Map(registryTargets(registry).map(target=>[target.portraitKey,target]));
        monsterPortraitIdentityByUniqueName=new Map();
        const identityNames=new Set();
        monsterPortraitIdentityByKey.forEach(target=>{
            if(identityNames.has(target.name))monsterPortraitIdentityByUniqueName.delete(target.name);
            else{identityNames.add(target.name);monsterPortraitIdentityByUniqueName.set(target.name,target);}
        });
        const byKey=new Map();
        const byName=new Map();
        const duplicateNames=new Set();
        registryTargets(registry).forEach(target=>{
            if(target.status!=="existing"||!target.portraitKey||!target.path){ return; }
            byKey.set(target.portraitKey,target);
            if(byName.has(target.name)){ duplicateNames.add(target.name); }
            else{ byName.set(target.name,target); }
        });
        const assetPoolEntries=registry.assetPool&&Array.isArray(registry.assetPool.entries)?registry.assetPool.entries:[];
        assetPoolEntries.forEach(entry=>{
            if(entry.status!=="adopted"||!entry.assetId||!entry.runtimePath){ return; }
            const tier=String(entry.tier||"normal");
            const record={group:"assetPool",portraitKey:entry.assetId,name:entry.displayName||entry.assetId,element:entry.element||"fire",rank:tier==="elite"?"elite":(tier==="miniboss"?"boss":"regular"),sizeClass:"standard",path:entry.runtimePath,status:"existing",assetId:entry.assetId,tier:tier};
            byKey.set(entry.assetId,record);
            if(byName.has(entry.displayName)){ duplicateNames.add(entry.displayName); }
            else{ byName.set(entry.displayName,record); }
        });
        duplicateNames.forEach(name=>byName.delete(name));
        monsterPortraitRegistry=registry;
        monsterPortraitByKey=byKey;
        monsterPortraitByUniqueName=byName;
        monsterPortraitRegistryState="ready";
        monsterPortraitRegistryFailure=null;
        syncMonsterPortraits();
        return registry;
    }
    window.v154InstallMonsterPortraitRegistry=installMonsterPortraitRegistry;

    function requestMonsterPortraitRegistry(){
        if(monsterPortraitRegistryPromise){ return monsterPortraitRegistryPromise; }
        if(typeof fetch!=="function"){
            monsterPortraitRegistryState="failed";
            monsterPortraitRegistryFailure=new Error("fetch unavailable");
            monsterPortraitRegistryPromise=null;
            return Promise.resolve(null);
        }
        monsterPortraitRegistryState="pending";
        monsterPortraitRegistryPromise=fetch(MONSTER_PORTRAIT_REGISTRY_URL,{cache:"no-cache"})
            .then(response=>{
                if(!response||!response.ok){ throw new Error("HTTP "+(response&&response.status)); }
                return response.json();
            })
            .then(installMonsterPortraitRegistry)
            .catch(error=>{
                monsterPortraitRegistryState="failed";
                monsterPortraitRegistryFailure=error;
                monsterPortraitRegistryPromise=null;
                console.warn("[monster-portrait] registry load failed; retry is available on the next dungeon entry.",error);
                return null;
            });
        return monsterPortraitRegistryPromise;
    }
    window.v154RequestMonsterPortraitRegistry=requestMonsterPortraitRegistry;
    window.v154GetMonsterPortraitRegistryState=()=>monsterPortraitRegistryState;
    window.v154GetPortraitPresentation=path=>monsterPortraitRegistry&&monsterPortraitRegistry.presentation&&monsterPortraitRegistry.presentation.assets[path]||null;
    window.v154GetPortraitScaleContract=()=>monsterPortraitRegistry&&monsterPortraitRegistry.presentation&&monsterPortraitRegistry.presentation.classes||null;

    function legacyAbyssPortrait(monster,finalFloor){
        if(!monster||!monster.v141Abyss||monster.name!=="天兵天將"){ return null; }
        return monsterPortraitRegistry?.policy?.legacyUniversalSoldierFiles?.[finalFloor?1:0]||null;
    }

    function resolveMonsterPortraitRecord(monster,options){
        if(!monster){ return null; }
        const dedicatedPath=String(monster.vGameplayPortrait||"").trim();
        if(dedicatedPath){
            return {
                portraitKey:"gameplay.object."+String(monster.objectType||monster.name||"unit"),
                name:monster.name||"",
                element:monster.element||"dynamic",
                rank:monster.rank||"regular",
                sizeClass:monster.unitKind==="boss"?"boss":"regular",
                path:dedicatedPath,
                status:"existing",
                dedicated:true
            };
        }
        const canonicalKey=monsterPortraitIdentityByKey.has(monster.monsterKey)?monster.monsterKey:"";
        const explicitKey=String(monster.portraitKey||monster.monsterPortraitKey||canonicalKey||(monster.vGameplayBossId&&!monster.vGameplayTowerBoss?"boss."+monster.vGameplayBossId:"")).trim();
        if(monsterPortraitRegistryState==="pending"&&explicitKey){ return null; }
        const explicitAssetFailed=!!(explicitKey&&monsterPortraitAssetFailures.has(explicitKey));
        if(explicitKey&&monsterPortraitByKey.has(explicitKey)){
            if(!explicitAssetFailed){ return monsterPortraitByKey.get(explicitKey); }
        }
        if(monster.name==="天兵天將"&&!explicitKey){
            const element=String(monster.portraitElement||monster.element||"").toLowerCase();
            if(HEAVENLY_SOLDIER_ELEMENTS.has(element)){
                const soldier=monsterPortraitByKey.get("soldier."+element);
                if(soldier){ return soldier; }
            }
        }
        const byName=explicitKey?null:monsterPortraitByUniqueName.get(monster.name);
        if(byName){ return byName; }
        const legacy=!explicitKey?legacyAbyssPortrait(monster,!!(options&&options.finalAbyss)):null;
        if(monsterPortraitRegistryState==="pending"){ return null; }
        return legacy?{
            portraitKey:"legacy.abyss."+String(monster.name||"unknown"),
            name:monster.name,
            element:monster.element||"dynamic",
            rank:monster.rank||"regular",
            sizeClass:"boss",
            path:legacy,
            status:"existing",
            legacy:true
        }:(()=>{
            const identity=monsterPortraitIdentityByKey.get(explicitKey)||(!explicitKey&&monsterPortraitIdentityByUniqueName.get(monster.name));
            return {
                portraitKey:"fallback.generic",
                requestedPortraitKey:explicitKey||identity&&identity.portraitKey||null,
                fallbackReason:explicitAssetFailed?"decode-failed":identity?identity.status:"identity-unregistered",
                name:monster.name||"",
                element:monster.element||"dynamic",
                rank:monster.rank||"regular",
                sizeClass:identity&&identity.sizeClass||"standard",
                path:null,
                status:"fallback",
                generic:true
            };
        })();
    }
    window.v154ResolveMonsterPortraitRecord=resolveMonsterPortraitRecord;
    window.v154BindMonsterPortraitIdentity=function(monster){
        const record=monster&&monsterPortraitByKey.get(monster.portraitKey);
        if(record&&record.group==="assetPool"){
            monster.name=record.name;
            monster.displayName=record.name;
        }
        return monster;
    };

    function prepareDailyDungeonPortraits(type){
        const key=String(type||"").trim();
        if(!key){ return Promise.resolve({state:monsterPortraitRegistryState}); }
        if(dailyPortraitPreparation.has(key)){ return dailyPortraitPreparation.get(key); }
        const preparation=requestMonsterPortraitRegistry().then(()=>{
            if(monsterPortraitRegistryState!=="ready"){
                return {state:"failed",error:monsterPortraitRegistryFailure,keys:[]};
            }
            const keys=["regular","elite","boss"].map(rank=>"daily."+key+"."+rank);
            const results=keys.map(portraitKey=>{
                const record=monsterPortraitByKey.get(portraitKey);
                if(!record||!record.path){
                    monsterPortraitAssetFailures.add(portraitKey);
                    return Promise.resolve({state:"failed",portraitKey:portraitKey,error:new Error("portrait record missing")});
                }
                const assets=window.FourSymbolsFeatures&&typeof window.FourSymbolsFeatures.ensureAssets==="function"
                    ?window.FourSymbolsFeatures.ensureAssets([record.path])
                    :Promise.reject(new Error("feature asset decoder unavailable"));
                return assets.then(()=>{
                    monsterPortraitAssetFailures.delete(portraitKey);
                    return {state:"ready",portraitKey:portraitKey,path:record.path};
                }).catch(error=>{
                    monsterPortraitAssetFailures.add(portraitKey);
                    console.warn("[monster-portrait] daily portrait decode failed for "+portraitKey+"; other ranks remain eligible.",error);
                    return {state:"failed",portraitKey:portraitKey,path:record.path,error:error};
                });
            });
            return Promise.all(results).then(entries=>{
                const failed=entries.filter(entry=>entry.state!=="ready");
                return {
                    state:failed.length?"failed":"ready",
                    keys:keys,
                    paths:entries.filter(entry=>entry.state==="ready").map(entry=>entry.path),
                    failures:failed.map(entry=>entry.portraitKey),
                    entries:entries
                };
            });
        });
        const tracked=preparation.then(result=>{
            if(!result||result.state!=="ready"){ dailyPortraitPreparation.delete(key); }
            return result;
        });
        dailyPortraitPreparation.set(key,tracked);
        return tracked;
    }
    window.v154PrepareDailyDungeonPortraits=prepareDailyDungeonPortraits;
    function preparePortraitsForEncounter(roster){
        const list=(Array.isArray(roster)?roster:[roster]).filter(Boolean);
        if(!list.length){ return Promise.resolve({state:"ready",records:[],paths:[]}); }
        return requestMonsterPortraitRegistry().then(()=>{
            if(monsterPortraitRegistryState!=="ready"){
                return {state:"failed",error:monsterPortraitRegistryFailure,records:[],paths:[]};
            }
            const entries=list.map(monster=>{
                const record=resolveMonsterPortraitRecord(monster);
                if(record&&record.generic){ return Promise.resolve({state:"ready",monster:monster,record:record}); }
                if(!record||!record.path){
                    return Promise.resolve({state:"failed",monster:monster,error:new Error("portrait record missing")});
                }
                const assets=window.FourSymbolsFeatures&&typeof window.FourSymbolsFeatures.ensureAssets==="function"
                    ?window.FourSymbolsFeatures.ensureAssets([record.path])
                    :Promise.reject(new Error("feature asset decoder unavailable"));
                return assets.then(()=>{
                    // Only an explicit adopted asset establishes a Tower identity.
                    const name=record.group==="assetPool"?record.name:null;
                    if(name){ monster.name=name;monster.displayName=name; }
                    monster.portraitPath=record.path;
                    return {state:"ready",monster:monster,record:record};
                }).catch(error=>({state:"failed",monster:monster,record:record,error:error}));
            });
            return Promise.all(entries).then(results=>{
                const failed=results.filter(entry=>entry.state!=="ready");
                return {
                    state:failed.length?"failed":"ready",
                    records:results.filter(entry=>entry.state==="ready").map(entry=>entry.record),
                    paths:results.filter(entry=>entry.state==="ready"&&entry.record.path).map(entry=>entry.record.path),
                    failures:failed.map(entry=>entry.monster&&entry.monster.portraitKey||"unknown")
                };
            });
        });
    }
    window.v154PreparePortraitsForEncounter=preparePortraitsForEncounter;
    window.resolveMonsterPortrait=function(monster){
        const roster=currentAbyssRoster();
        const record=resolveMonsterPortraitRecord(monster,{finalAbyss:isFinalAbyssRoster(roster)});
        return record?record.path:null;
    };

    function installMonsterPortraitPresentationStyle(){
        /* Portrait selection belongs here; portrait geometry does not. V174 owns
           the shared no-crop presentation contract for players, monsters and bosses. */
        return;
    }

    function syncCardlessPresentation(card,record){
        if(!card){ return; }
        const presentation=typeof window!=="undefined"?window.FourSymbolsBattlePresentation:null;
        if(record&&record.path){
            const cssValue='url("'+record.path+'")';
            card.dataset.v154PortraitRecordPath=record.path;
            card.style.setProperty("--v152-abyss-portrait",cssValue);
        }else{
            delete card.dataset.v154PortraitRecordPath;
            card.style.removeProperty("--v152-abyss-portrait");
        }
        /* V154 selects the record. V174 is the only presentation owner. */
        if(presentation&&typeof presentation.applyUnit==="function"){
            presentation.applyUnit(card,"monster",record);
        }
    }

    function syncMonsterPortraits(){
        if(typeof document==="undefined"){ return; }
        if(typeof window.bumpBattleRuntimeMetric==="function"){ window.bumpBattleRuntimeMetric("syncMonsterPortraits"); }
        else if(window.FourSymbolsBattleRuntimeMetrics&&window.FourSymbolsBattleRuntimeMetrics.enabled===true){
            const counters=window.FourSymbolsBattleRuntimeMetrics.counters||{};
            counters.syncMonsterPortraits=(Number(counters.syncMonsterPortraits)||0)+1;
        }
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
            if(portrait){
                card.style.setProperty("--v152-abyss-portrait",'url("'+portrait+'")');
            }else{
                card.style.removeProperty("--v152-abyss-portrait");
            }
            syncCardlessPresentation(card,record);
            card.classList.toggle("v152-abyss-portrait",abyssPortrait);
            card.classList.toggle("v154-abyss-portrait",abyssPortrait);
            card.classList.toggle("v154-monster-portrait",!!portrait);
            if(record){
                card.dataset.monsterPortraitKey=record.portraitKey;
                card.dataset.monsterPortraitPath=portrait||"";
                if(abyssPortrait){ card.dataset.abyssPortrait=finalFloor?"floor5":"floor1-4"; }
                else{ delete card.dataset.abyssPortrait; }
            }else{
                delete card.dataset.monsterPortraitKey;
                delete card.dataset.monsterPortraitPath;
                delete card.dataset.abyssPortrait;
            }
        });
    }
    window.v154SyncMonsterPortraits=syncMonsterPortraits;
    window.v154SyncAbyssPortraits=syncMonsterPortraits;

    function v154AfterBattleRender(){
        if(typeof window.v152SyncAbyssBattleUi==="function"){
            window.v152SyncAbyssBattleUi();
        }
        syncMonsterPortraits();
    }
    window.v154AfterBattleRender=v154AfterBattleRender;
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
                !entry.character||!entry.config||!entry.stats||
                (!entry.config.enabled&&!elementBoxActive)||
                (Number(entry.character.hp)<=0&&!elementBoxActive)
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
                    if(resource==="sp"&&(Number(character.hp)||0)<=0){
                        return;
                    }
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
                    const recovered=resolvePotionRecovery(definition,currentValue,maxValue);
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
