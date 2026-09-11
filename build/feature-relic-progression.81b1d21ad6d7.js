/* =====================================================
   Relic Progression / Drop System
   Owner: relic acquisition, fragments, universal fragments, essence,
   breakthrough stones, Boss-directed drops, Tower guarantee rewards,
   crafting and progression UI integration.

   Integration rules:
   - Reuses the existing inventory stack/transaction APIs.
   - Reuses the existing UID-aware account repository and saveGame owner.
   - Does not wrap winBattle / loseBattle / v132LaunchDungeonBattle / saveGame.
   - Boss/Tower completion is observed from their exported progression state.
   - A pending receipt lives inside player.relicProgression in the existing UID save.
===================================================== */
(function installRelicProgressionDropSystem(){
    "use strict";

    if(typeof window==="undefined"||window.__relicProgressionDropSystemInstalled){ return; }

    const relicRuntime=window.v174RelicSystem;
    const gameplayRuntime=window.GameplaySystem;
    const accountRepository=window.FourSymbolsAccountSave;
    if(!relicRuntime||!gameplayRuntime||!accountRepository){
        console.error("秘寶養成系統缺少必要 runtime owner，已安全停用。",{
            relic:!!relicRuntime,gameplay:!!gameplayRuntime,account:!!accountRepository
        });
        return;
    }
    window.__relicProgressionDropSystemInstalled=true;

    const catalog=relicRuntime.catalog||{};
    const RARITY_ORDER=Object.freeze({white:0,blue:1,purple:2,orange:3,pink:4,"four-symbol":5});
    const RARITY_LABELS=Object.freeze({white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"});
    const RARITY_WEIGHTS=Object.freeze({white:40,blue:30,purple:18,orange:8,pink:3,"four-symbol":1});
    const RARITY_FRAGMENT_DROP_CHANCE=Object.freeze({white:1,blue:.90,purple:.72,orange:.50,pink:.28,"four-symbol":.12});

    const MATERIAL_CONFIG=Object.freeze({
        composeSpecificFragments:100,
        universalExchangeCost:2,
        maxUniversalReplacement:50,
        essenceItemId:"relicEssence",
        universalItemId:"relicUniversalFragment",
        breakthroughItemId:"relicBreakthroughStone",
        upgrade:Object.freeze({
            essenceBase:20,
            essencePerCurrentLevel:6,
            breakthroughLevels:Object.freeze([10]),
            breakthroughStoneCost:1
        }),
        choiceBoxes:Object.freeze({
            relicChoiceBoxBlue:Object.freeze({name:"藍階以下秘寶碎片自選箱",maxRarity:"blue",fragmentAmount:15,tierKey:"blue"}),
            relicChoiceBoxPurple:Object.freeze({name:"紫階以下秘寶碎片自選箱",maxRarity:"purple",fragmentAmount:20,tierKey:"purple"}),
            relicChoiceBoxOrange:Object.freeze({name:"橙階以下秘寶碎片自選箱",maxRarity:"orange",fragmentAmount:20,tierKey:"orange"}),
            relicChoiceBoxPink:Object.freeze({name:"桃紅階以下秘寶碎片自選箱",maxRarity:"pink",fragmentAmount:25,tierKey:"pink"})
        })
    });

    const BOSS_DIFFICULTY_CONFIG=Object.freeze({
        normal:Object.freeze({fragment:Object.freeze([2,4]),essence:Object.freeze([10,16]),universal:Object.freeze({chance:.04,count:Object.freeze([1,1])}),breakthrough:Object.freeze({chance:0,count:Object.freeze([0,0])}),clearMinutes:2.0}),
        hard:Object.freeze({fragment:Object.freeze([3,5]),essence:Object.freeze([18,28]),universal:Object.freeze({chance:.06,count:Object.freeze([1,2])}),breakthrough:Object.freeze({chance:0,count:Object.freeze([0,0])}),clearMinutes:2.5}),
        hell:Object.freeze({fragment:Object.freeze([4,7]),essence:Object.freeze([30,44]),universal:Object.freeze({chance:.08,count:Object.freeze([1,2])}),breakthrough:Object.freeze({chance:.10,count:Object.freeze([1,1])}),clearMinutes:3.0}),
        special:Object.freeze({fragment:Object.freeze([5,8]),essence:Object.freeze([42,60]),universal:Object.freeze({chance:.12,count:Object.freeze([1,3])}),breakthrough:Object.freeze({chance:.18,count:Object.freeze([1,2])}),clearMinutes:3.5})
    });

    /*
       Every Boss has a small directed pool. Rarity controls relative selection
       weight while difficulty controls fragment quantity. Planned relics may
       accumulate fragments, but crafting remains locked until their combat
       runtime is formally opened.
    */
    const RELIC_BOSS_DROP_TABLE=Object.freeze({
        "personal-20":Object.freeze(["relic_qinglan_feather","relic_sun_orb"]),
        "personal-30":Object.freeze(["relic_sun_orb","relic_nine_dragon_fire"]),
        "personal-40":Object.freeze(["relic_qiankun_flask","relic_cold_spring_jade"]),
        "personal-50":Object.freeze(["relic_xuanwu_seal","relic_cold_spring_jade"]),
        "personal-60":Object.freeze(["relic_xuanwu_seal","relic_soul_bell","relic_rock_mountain_seal"]),
        "personal-70":Object.freeze(["relic_soul_bell","relic_tiangang_banner"]),
        "personal-80":Object.freeze(["relic_cold_spring_jade","relic_tiangang_banner","relic_returning_wheel"]),
        "personal-90":Object.freeze(["relic_rock_mountain_seal","relic_tiangang_banner","relic_returning_wheel"]),
        "personal-100":Object.freeze(["relic_soul_bell","relic_tiangang_banner","relic_returning_wheel"]),
        "world-40":Object.freeze(["relic_sun_orb","relic_nine_dragon_fire"]),
        "world-60":Object.freeze(["relic_qiankun_flask","relic_cold_spring_jade","relic_xuanwu_seal"]),
        "world-80":Object.freeze(["relic_nine_dragon_fire","relic_tiangang_banner","relic_returning_wheel"]),
        "world-100":Object.freeze(["relic_tiangang_banner","relic_returning_wheel","relic_all_returning_array"])
    });

    const RELIC_TOWER_REWARD_CONFIG=Object.freeze({
        floorCount:Number(gameplayRuntime.towerConfig&&gameplayRuntime.towerConfig.floorCount)||100,
        essence:Object.freeze({base:10,perTenFloorBand:2,eliteBonus:8,bossBonus:20,majorMilestoneBonus:24}),
        universal:Object.freeze({
            fiveFloor:function(floor){ return floor>=80?5:(floor>=40?4:3); },
            tenFloor:function(floor){ return floor>=80?10:(floor>=40?9:8); }
        }),
        breakthrough:Object.freeze({everyTen:1}),
        majorMilestones:Object.freeze({
            25:Object.freeze({boxId:"relicChoiceBoxBlue"}),
            50:Object.freeze({boxId:"relicChoiceBoxPurple"}),
            75:Object.freeze({boxId:"relicChoiceBoxOrange"}),
            100:Object.freeze({boxId:"relicChoiceBoxPink"})
        })
    });

    const ACTIVE_UID=accountRepository.getActiveUid();
    const STATE_VERSION=1;
    const RECEIPT_STALE_MS=6*60*60*1000;
    const LV20_STARTER_BLUE_MINIMUM=2;
    const LV20_STARTER_RELIC_IDS=Object.freeze(["relic_qiankun_flask","relic_xuanwu_seal","relic_qinglan_feather"]);

    function numeric(value,fallback=0){
        const number=Number(value);
        return Number.isFinite(number)?number:fallback;
    }
    function integer(value,fallback=0){ return Math.max(0,Math.floor(numeric(value,fallback))); }
    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
    function esc(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function clone(value){ return value==null?value:JSON.parse(JSON.stringify(value)); }
    function rarityIndex(key){ return Object.prototype.hasOwnProperty.call(RARITY_ORDER,key)?RARITY_ORDER[key]:0; }
    function rangeInt(range,rng=Math.random){
        const min=Math.max(0,Math.floor(numeric(range&&range[0],0)));
        const max=Math.max(min,Math.floor(numeric(range&&range[1],min)));
        const roll=clamp(numeric(rng(),0),0,.999999999);
        return min+Math.floor(roll*(max-min+1));
    }
    function avgRange(range){ return (numeric(range&&range[0])+numeric(range&&range[1]))/2; }

    const TIER_COLORS=Object.freeze({
        white:Object.freeze({main:"#D8D8D8",light:"#F4F4F4",dark:"#7C7C7C"}),
        blue:Object.freeze({main:"#42A5FF",light:"#7CC7FF",dark:"#1E6FBF"}),
        purple:Object.freeze({main:"#B05CFF",light:"#D49BFF",dark:"#7133AA"}),
        orange:Object.freeze({main:"#FF9F38",light:"#FFC46B",dark:"#B75F14"}),
        pink:Object.freeze({main:"#FF4FA7",light:"#FF8CC7",dark:"#A51F64"}),
        "four-symbol":Object.freeze({main:"#E5C06B",light:"#FFFFFF",dark:"#8A6730"})
    });

    function materialSvg(kind,tierKey){
        const tier=TIER_COLORS[tierKey]||TIER_COLORS.white;
        if(tierKey==="four-symbol"){
            return '<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
                '<path d="M32 5 55 20 49 52 32 60 15 52 9 20Z" fill="#11100e" stroke="#e7d5a4" stroke-width="2"/>'+
                '<path d="M32 8 52 21 32 31Z" fill="#FF5A36"/><path d="M52 21 46 49 32 31Z" fill="#42A5FF"/>'+
                '<path d="M46 49 32 56 32 31Z" fill="#47D6A3"/><path d="M32 56 18 49 32 31Z" fill="#C89B45"/>'+
                '<circle cx="32" cy="31" r="9" fill="#17130f" stroke="#f5e4b9" stroke-width="2"/><path d="M26 31h12M32 25v12" stroke="#f5e4b9" stroke-width="2" stroke-linecap="round"/>'+
                '</svg>';
        }
        const symbol=kind==="fragment"?"M20 14h24l7 10-8 25H21L13 24Z":kind==="essence"?"M32 7c9 11 17 18 17 29a17 17 0 1 1-34 0c0-11 8-18 17-29Z":kind==="stone"?"M32 6 52 21 45 56H19L12 21Z":"M12 18h40v35H12Z";
        return '<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
            '<path d="'+symbol+'" fill="'+tier.main+'" stroke="'+tier.light+'" stroke-width="2.4"/>'+
            '<path d="M22 24 32 16 42 24 37 40 32 46 27 40Z" fill="'+tier.dark+'" opacity=".42"/>'+
            '<circle cx="32" cy="31" r="5" fill="#f7e8bc" opacity=".86"/>'+
            '</svg>';
    }

    function fragmentIdFor(relicId){ return "relicFragment_"+String(relicId||"").replace(/^relic_/,""); }

    const itemDefinitions={};
    Object.values(catalog).forEach(def=>{
        if(!def||!def.id){ return; }
        const id=fragmentIdFor(def.id);
        itemDefinitions[id]=Object.freeze({
            id:id,name:def.name+"碎片",icon:materialSvg("fragment",def.rarity),type:"material",price:0,
            tierKey:def.rarity||"white",stats:{},relicId:def.id,relicFragment:true
        });
    });
    itemDefinitions[MATERIAL_CONFIG.universalItemId]=Object.freeze({
        id:MATERIAL_CONFIG.universalItemId,name:"秘寶通用碎片",icon:materialSvg("fragment","purple"),type:"material",price:0,tierKey:"purple",stats:{},relicUniversalFragment:true
    });
    itemDefinitions[MATERIAL_CONFIG.essenceItemId]=Object.freeze({
        id:MATERIAL_CONFIG.essenceItemId,name:"秘寶精華",icon:materialSvg("essence","blue"),type:"material",price:0,tierKey:"blue",stats:{},relicEssence:true
    });
    itemDefinitions[MATERIAL_CONFIG.breakthroughItemId]=Object.freeze({
        id:MATERIAL_CONFIG.breakthroughItemId,name:"秘寶突破石",icon:materialSvg("stone","orange"),type:"material",price:0,tierKey:"orange",stats:{},relicBreakthroughStone:true
    });
    Object.entries(MATERIAL_CONFIG.choiceBoxes).forEach(([id,box])=>{
        itemDefinitions[id]=Object.freeze({
            id:id,name:box.name,icon:materialSvg("box",box.tierKey),type:"material",price:0,tierKey:box.tierKey,stats:{},
            relicChoiceBox:true,maxRarity:box.maxRarity,fragmentAmount:box.fragmentAmount
        });
    });
    Object.freeze(itemDefinitions);

    function inventoryList(){
        return typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)?inventoryItems:[];
    }
    function itemCount(itemId){
        return inventoryList().reduce((sum,item)=>item&&item.id===itemId?sum+integer(item.count,1):sum,0);
    }
    function hydrateOwnedItemPresentation(){
        inventoryList().forEach(item=>{
            const def=item&&itemDefinitions[item.id];
            if(!def){ return; }
            ["name","icon","type","price","tierKey","relicId","relicFragment","relicUniversalFragment","relicEssence","relicBreakthroughStone","relicChoiceBox","maxRarity","fragmentAmount"].forEach(key=>{
                if(Object.prototype.hasOwnProperty.call(def,key)){ item[key]=def[key]; }
            });
            if(!item.stats||typeof item.stats!=="object"){ item.stats={}; }
        });
    }
    function canAddItem(itemId,count){
        const def=itemDefinitions[itemId];
        if(!def){ return false; }
        if(typeof window.v132CanAddItemToInventory==="function"){
            return !!window.v132CanAddItemToInventory(def,Math.max(1,integer(count,1)));
        }
        return true;
    }
    function addItem(itemId,count){
        const def=itemDefinitions[itemId];
        const quantity=integer(count);
        if(!def||quantity<=0){ return quantity<=0; }
        if(typeof window.v132AddItemToInventory!=="function"){ return false; }
        return !!window.v132AddItemToInventory(def,quantity);
    }
    function consumeItem(itemId,count){
        const quantity=integer(count);
        if(quantity<=0){ return true; }
        return typeof window.v132ConsumeStackItem==="function"&&!!window.v132ConsumeStackItem(itemId,quantity);
    }
    function transaction(operation){
        if(typeof window.v132RunInventoryTransaction==="function"){
            return !!window.v132RunInventoryTransaction(operation);
        }
        try{ return !!operation(); }catch(error){ console.error("秘寶背包交易失敗：",error); return false; }
    }
    function restoreItemCount(itemId,targetCount){
        const target=integer(targetCount);
        const current=itemCount(itemId);
        if(current===target){ return true; }
        return current>target?consumeItem(itemId,current-target):addItem(itemId,target-current);
    }
    function restoreItemCounts(snapshot){
        const entries=Object.entries(snapshot||{});
        return transaction(()=>entries.every(([itemId,count])=>restoreItemCount(itemId,count)));
    }
    function persistCore(){
        try{
            if(typeof saveGame!=="function"){ return false; }
            return saveGame({source:"relic-progression"})!==false;
        }catch(error){
            console.error("秘寶養成主存檔寫入失敗：",error);
            return false;
        }
    }
    function refreshInventoryUi(){
        if(typeof rebuildInventorySlots==="function"){ try{ rebuildInventorySlots(); }catch(_){ } }
        if(typeof renderInventoryItems==="function"){ try{ renderInventoryItems(); }catch(_){ } }
    }
    function notify(message){
        if(typeof alert==="function"){ alert(message); }
        else{ console.warn(message); }
    }

    function defaultProgressionState(){
        return {
            version:STATE_VERSION,
            initialized:false,
            ownershipMigration:null,
            starterLv20Granted:false,
            legacyTowerChoiceHandled:null,
            majorMilestoneClaims:{},
            pending:null
        };
    }
    function normalizeProgressionState(raw){
        const state=defaultProgressionState();
        if(raw&&typeof raw==="object"){
            state.initialized=raw.initialized===true;
            state.ownershipMigration=typeof raw.ownershipMigration==="string"?raw.ownershipMigration:null;
            state.starterLv20Granted=raw.starterLv20Granted===true;
            state.legacyTowerChoiceHandled=typeof raw.legacyTowerChoiceHandled==="boolean"?raw.legacyTowerChoiceHandled:null;
            state.majorMilestoneClaims=raw.majorMilestoneClaims&&typeof raw.majorMilestoneClaims==="object"
                ?Object.assign({},raw.majorMilestoneClaims)
                :{};
            state.pending=raw.pending&&typeof raw.pending==="object"?clone(raw.pending):null;
        }
        return state;
    }
    function progressionHost(){
        return typeof player!=="undefined"&&player&&typeof player==="object"?player:null;
    }
    function readProgressionState(){
        const host=progressionHost();
        return normalizeProgressionState(host&&host.relicProgression);
    }
    let progressionState=readProgressionState();
    function writeProgressionState(){
        const host=progressionHost();
        if(!host){ return false; }
        const hadPrevious=Object.prototype.hasOwnProperty.call(host,"relicProgression");
        const previous=hadPrevious?clone(host.relicProgression):undefined;
        const previousState=normalizeProgressionState(previous);
        progressionState.version=STATE_VERSION;
        host.relicProgression=clone(progressionState);
        if(persistCore()){ return true; }
        if(hadPrevious){ host.relicProgression=previous; }
        else{ delete host.relicProgression; }
        progressionState=previousState;
        return false;
    }
    function readMainSave(){
        if(!ACTIVE_UID){ return null; }
        try{
            const result=accountRepository.readForUid(ACTIVE_UID);
            return result.status==="ready"?result.save:null;
        }catch(_){ return null; }
    }

    function initializeOwnershipPolicy(){
        if(progressionState.initialized){ return; }
        const saved=readMainSave();
        const savedRelics=saved&&saved.playerRelics&&typeof saved.playerRelics==="object"?saved.playerRelics:null;
        const hadExplicitRelicState=!!(savedRelics&&Object.keys(savedRelics).some(id=>catalog[id]));
        let coreChanged=false;
        const owned=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        if(!hadExplicitRelicState){
            if(owned&&typeof owned==="object"){
                Object.values(catalog).forEach(def=>{
                    if(!def||!def.runtimeReady||!owned[def.id]){ return; }
                    owned[def.id].unlocked=false;
                    owned[def.id].level=Math.max(1,integer(owned[def.id].level,1));
                    owned[def.id].seen=false;
                    coreChanged=true;
                });
            }
            const loadout=relicRuntime.getTeamLoadout&&relicRuntime.getTeamLoadout();
            if(loadout&&loadout.relicId&&owned&&owned[loadout.relicId]&&!owned[loadout.relicId].unlocked){
                loadout.relicId=null;loadout.subRelicId=null;coreChanged=true;
            }
        }
        if(coreChanged&&!persistCore()){
            progressionState.ownershipMigration="retry-required";
            writeProgressionState();
            return;
        }
        progressionState.initialized=true;
        progressionState.ownershipMigration=hadExplicitRelicState?"preserved-existing":"new-account-fragment-progression";
        const tower=gameplayRuntime.getSerializableState&&gameplayRuntime.getSerializableState().tower;
        progressionState.legacyTowerChoiceHandled=!(tower&&tower.pendingRelicChoice===true);
        const historicalHighest=integer(tower&&tower.historicalHighest);
        Object.keys(RELIC_TOWER_REWARD_CONFIG.majorMilestones).forEach(floor=>{
            if(historicalHighest>=integer(floor)){ progressionState.majorMilestoneClaims[String(floor)]=true; }
        });
        writeProgressionState();
    }

    function ensureLv20StarterRelics(){
        const host=progressionHost();
        if(!host||integer(host.level,1)<20){ return false; }
        const owned=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        if(!owned||typeof owned!=="object"){ return false; }
        const blueUnlocked=()=>Object.values(catalog).filter(def=>def&&def.runtimeReady===true&&def.rarity==="blue"&&owned[def.id]&&owned[def.id].unlocked===true).length;
        if(blueUnlocked()>=LV20_STARTER_BLUE_MINIMUM){
            if(!progressionState.starterLv20Granted){ progressionState.starterLv20Granted=true;writeProgressionState(); }
            return true;
        }
        const snapshots={};
        LV20_STARTER_RELIC_IDS.forEach(id=>{ if(owned[id]){ snapshots[id]=clone(owned[id]); } });
        for(const id of LV20_STARTER_RELIC_IDS){
            if(blueUnlocked()>=LV20_STARTER_BLUE_MINIMUM){ break; }
            const def=catalog[id],entry=owned[id];
            if(!def||def.runtimeReady!==true||def.rarity!=="blue"||!entry||entry.unlocked===true){ continue; }
            entry.unlocked=true;entry.level=Math.max(1,integer(entry.level,1));entry.seen=false;
        }
        if(blueUnlocked()<LV20_STARTER_BLUE_MINIMUM){
            Object.entries(snapshots).forEach(([id,snapshot])=>{ Object.assign(owned[id],snapshot); });
            return false;
        }
        progressionState.starterLv20Granted=true;
        if(writeProgressionState()){ return true; }
        Object.entries(snapshots).forEach(([id,snapshot])=>{ Object.assign(owned[id],snapshot); });
        return false;
    }

    function difficultyForBoss(type,definition,stage){
        if(type==="world"){
            const resolved=Math.max(1,Math.min(4,integer(stage,1)));
            if(resolved>=4){ return "special"; }
            if(resolved>=3){ return "hell"; }
            return "hard";
        }
        const level=integer(definition&&definition.level,1);
        if(level>=100){ return "special"; }
        if(level>=80){ return "hell"; }
        if(level>=50){ return "hard"; }
        return "normal";
    }
    function bossDefinition(type,id){
        const list=type==="world"?(gameplayRuntime.worldBosses||[]):(gameplayRuntime.personalBosses||[]);
        return list.find(def=>def&&def.id===id)||null;
    }
    function activePoolEntries(bossId){
        const configured=RELIC_BOSS_DROP_TABLE[bossId]||[];
        return configured.map(relicId=>{
            const def=catalog[relicId];
            const fragmentId=fragmentIdFor(relicId);
            if(!def||!itemDefinitions[fragmentId]){ return null; }
            return {relicId:relicId,fragmentId:fragmentId,rarity:def.rarity,weight:Math.max(0,numeric(RARITY_WEIGHTS[def.rarity],0)),name:def.name};
        }).filter(Boolean);
    }
    function poolProbabilities(bossId){
        const entries=activePoolEntries(bossId);
        const total=entries.reduce((sum,entry)=>sum+entry.weight,0);
        if(!(total>0)){ return []; }
        return entries.map(entry=>{
            const selectionChance=entry.weight/total;
            const rarityDropChance=clamp(numeric(RARITY_FRAGMENT_DROP_CHANCE[entry.rarity],0),0,1);
            return Object.assign({},entry,{
                selectionChance:selectionChance,rarityDropChance:rarityDropChance,
                chance:selectionChance*rarityDropChance
            });
        });
    }
    function weightedFragmentRoll(bossId,rng){
        const entries=activePoolEntries(bossId);
        const total=entries.reduce((sum,entry)=>sum+entry.weight,0);
        if(!(total>0)){ return null; }
        let cursor=clamp(numeric(rng(),0),0,.999999999)*total;
        for(const entry of entries){
            cursor-=entry.weight;
            if(cursor<0){ return entry; }
        }
        return entries[entries.length-1]||null;
    }
    function mergeRewards(rewards){
        const merged=new Map();
        (rewards||[]).forEach(reward=>{
            if(!reward||!reward.itemId||integer(reward.count)<=0){ return; }
            const current=merged.get(reward.itemId)||{itemId:reward.itemId,count:0};
            current.count+=integer(reward.count);merged.set(reward.itemId,current);
        });
        return Array.from(merged.values());
    }
    function rollBossReward(type,bossId,stage=1,options={}){
        const definition=bossDefinition(type,bossId);
        const difficulty=difficultyForBoss(type,definition,stage);
        const config=BOSS_DIFFICULTY_CONFIG[difficulty]||BOSS_DIFFICULTY_CONFIG.normal;
        const rng=typeof options.rng==="function"?options.rng:Math.random;
        const rewards=[];
        const fragment=weightedFragmentRoll(bossId,rng);
        if(fragment){
            const rarityChance=clamp(numeric(RARITY_FRAGMENT_DROP_CHANCE[fragment.rarity],0),0,1);
            if(numeric(rng(),1)<rarityChance){ rewards.push({itemId:fragment.fragmentId,count:rangeInt(config.fragment,rng)}); }
        }else if((RELIC_BOSS_DROP_TABLE[bossId]||[]).length){
            console.warn("BOSS 秘寶掉落池目前沒有可用秘寶：",bossId);
        }
        rewards.push({itemId:MATERIAL_CONFIG.essenceItemId,count:rangeInt(config.essence,rng)});
        if(numeric(rng(),1)<numeric(config.universal&&config.universal.chance,0)){
            rewards.push({itemId:MATERIAL_CONFIG.universalItemId,count:rangeInt(config.universal.count,rng)});
        }
        if(numeric(rng(),1)<numeric(config.breakthrough&&config.breakthrough.chance,0)){
            rewards.push({itemId:MATERIAL_CONFIG.breakthroughItemId,count:rangeInt(config.breakthrough.count,rng)});
        }
        const firstClearBonus=options.firstClear===true&&(
            (type==="personal"&&integer(definition&&definition.level)>=70)||
            (type==="world"&&integer(stage)===4)
        );
        if(firstClearBonus){ rewards.push({itemId:MATERIAL_CONFIG.breakthroughItemId,count:1}); }
        return {type:type,bossId:bossId,stage:integer(stage,1),difficulty:difficulty,rewards:mergeRewards(rewards)};
    }

    function towerEssenceForFloor(floor){
        floor=integer(floor);
        if(floor<1||floor>RELIC_TOWER_REWARD_CONFIG.floorCount){ return 0; }
        const cfg=RELIC_TOWER_REWARD_CONFIG.essence;
        const band=Math.max(1,Math.ceil(floor/10));
        let amount=cfg.base+band*cfg.perTenFloorBand;
        if(floor%5===0){ amount+=cfg.eliteBonus; }
        if(floor%10===0){ amount+=cfg.bossBonus; }
        if(RELIC_TOWER_REWARD_CONFIG.majorMilestones[floor]){ amount+=cfg.majorMilestoneBonus; }
        return integer(amount);
    }
    function towerRewardPlan(floor,options={}){
        floor=integer(floor);
        if(floor<1||floor>RELIC_TOWER_REWARD_CONFIG.floorCount){ return {floor:floor,rewards:[]}; }
        const rewards=[{itemId:MATERIAL_CONFIG.essenceItemId,count:towerEssenceForFloor(floor)}];
        if(floor%10===0){
            rewards.push({itemId:MATERIAL_CONFIG.universalItemId,count:RELIC_TOWER_REWARD_CONFIG.universal.tenFloor(floor)});
            rewards.push({itemId:MATERIAL_CONFIG.breakthroughItemId,count:RELIC_TOWER_REWARD_CONFIG.breakthrough.everyTen});
        }else if(floor%5===0){
            rewards.push({itemId:MATERIAL_CONFIG.universalItemId,count:RELIC_TOWER_REWARD_CONFIG.universal.fiveFloor(floor)});
        }
        const milestone=RELIC_TOWER_REWARD_CONFIG.majorMilestones[floor];
        if(milestone&&options.firstEver===true&&itemDefinitions[milestone.boxId]){
            rewards.push({itemId:milestone.boxId,count:1});
        }
        return {floor:floor,rewards:mergeRewards(rewards)};
    }

    function rewardCounts(rewards){
        const counts={};
        (rewards||[]).forEach(reward=>{
            if(!reward||!itemDefinitions[reward.itemId]){
                if(reward&&reward.itemId){ console.error("忽略未知秘寶獎勵 item：",reward.itemId); }
                return;
            }
            const count=integer(reward.count);
            if(count<=0){ return; }
            counts[reward.itemId]=(counts[reward.itemId]||0)+count;
        });
        return counts;
    }
    function beforeCountsForRewards(rewards){
        const counts={};
        Object.keys(rewardCounts(rewards)).forEach(id=>{ counts[id]=itemCount(id); });
        return counts;
    }
    function receiptAlreadyDelivered(pending){
        const targets=rewardCounts(pending&&pending.rewards);
        const before=pending&&pending.beforeCounts||{};
        return Object.entries(targets).every(([id,count])=>itemCount(id)>=integer(before[id])+integer(count));
    }
    function grantReceiptToTargets(pending){
        const targets=rewardCounts(pending&&pending.rewards);
        const before=pending&&pending.beforeCounts||{};
        const missing=[];
        Object.entries(targets).forEach(([id,count])=>{
            const target=integer(before[id])+integer(count);
            const delta=Math.max(0,target-itemCount(id));
            if(delta>0){ missing.push({itemId:id,count:delta}); }
        });
        if(!missing.length){ return true; }
        for(const reward of missing){
            if(!itemDefinitions[reward.itemId]){
                console.error("秘寶獎勵定義不存在，跳過該筆而不阻斷其他獎勵：",reward.itemId);
                return false;
            }
            if(!canAddItem(reward.itemId,reward.count)){ return false; }
        }
        return transaction(()=>missing.every(reward=>addItem(reward.itemId,reward.count)));
    }
    function clearPending(){
        progressionState.pending=null;
        return writeProgressionState();
    }
    function showRewardItems(rewards,goldAmount=0){
        const items=(rewards||[]).map(reward=>{
            const def=itemDefinitions[reward.itemId];
            return def?{id:def.id,name:def.name,count:integer(reward.count)}:null;
        }).filter(Boolean);
        const goldValue=integer(goldAmount);
        if((items.length||goldValue>0)&&typeof window.v141ShowBlackGoldReward==="function"){
            try{ window.v141ShowBlackGoldReward({gold:goldValue,exp:0,items:items}); }catch(_){ }
        }
    }

    function buildBossPending(type,id){
        const state=gameplayRuntime.getSerializableState();
        const definition=bossDefinition(type,id);
        if(!state||!definition){ return null; }
        const progress=type==="world"?state.world&&state.world[id]:state.personal&&state.personal[id];
        if(!progress){ return null; }
        const stage=type==="world"?(progress.firstClear?4:Math.min(4,integer(progress.completedStages)+1)):1;
        const firstClear=type==="personal"?!progress.firstClear:(!progress.firstClear&&stage===4);
        const rolled=rollBossReward(type,id,stage,{firstClear:firstClear});
        return {
            kind:"boss",type:type,id:id,stage:stage,startedAt:Date.now(),beforeGold:typeof gold!=="undefined"?integer(gold):0,
            weekKey:state.tower&&state.tower.weekKey||null,
            baseline:{firstClear:!!progress.firstClear,clears:integer(progress.clears),completedStages:integer(progress.completedStages)},
            rewards:rolled.rewards,beforeCounts:beforeCountsForRewards(rolled.rewards)
        };
    }
    function buildTowerPending(floor){
        const state=gameplayRuntime.getSerializableState();
        const tower=state&&state.tower;
        floor=integer(floor);
        if(!tower||floor<1||floor>RELIC_TOWER_REWARD_CONFIG.floorCount||tower.claimedFloors&&tower.claimedFloors[String(floor)]){ return null; }
        const majorMilestone=!!RELIC_TOWER_REWARD_CONFIG.majorMilestones[floor];
        const firstEver=majorMilestone&&!progressionState.majorMilestoneClaims[String(floor)];
        const plan=towerRewardPlan(floor,{firstEver:firstEver});
        return {
            kind:"tower",floor:floor,startedAt:Date.now(),beforeGold:typeof gold!=="undefined"?integer(gold):0,weekKey:tower.weekKey||null,
            baseline:{claimed:!!(tower.claimedFloors&&tower.claimedFloors[String(floor)]),historicalHighest:integer(tower.historicalHighest)},
            rewards:plan.rewards,beforeCounts:beforeCountsForRewards(plan.rewards)
        };
    }
    function setPending(pending){
        progressionState.pending=pending?clone(pending):null;
        if(!writeProgressionState()){
            progressionState.pending=null;
            return false;
        }
        if(pending){ ensureReceiptMonitor(); }
        return true;
    }

    let neutralizingLegacyTowerChoice=false;
    const originalRelicDevUnlock=typeof window.v174RelicDevUnlock==="function"?window.v174RelicDevUnlock:null;
    if(originalRelicDevUnlock){
        window.v174RelicDevUnlock=function(id){
            if(neutralizingLegacyTowerChoice){ return true; }
            if(progressionState.pending&&progressionState.pending.kind==="boss"){
                /* Old Boss definitions used to grant complete relics directly.
                   New acquisition owns Boss relic rewards as fragments, so suppress
                   only that legacy path while a tracked Boss attempt is resolving. */
                return true;
            }
            return originalRelicDevUnlock.apply(this,arguments);
        };
    }

    const originalChooseTowerRelic=typeof window.vGameplayChooseTowerRelic==="function"?window.vGameplayChooseTowerRelic:null;
    function neutralizeCurrentTowerLegacyChoice(){
        if(!originalChooseTowerRelic||progressionState.legacyTowerChoiceHandled!==true){ return false; }
        const state=gameplayRuntime.getSerializableState();
        if(!state||!state.tower||!state.tower.pendingRelicChoice){ return false; }
        const choices=gameplayRuntime.towerConfig&&gameplayRuntime.towerConfig.relicChoices||[];
        const fallback=choices[0]&&choices[0].id;
        if(!fallback){ return false; }
        const goldBefore=typeof gold!=="undefined"?numeric(gold):null;
        neutralizingLegacyTowerChoice=true;
        let result=false;
        try{ result=!!originalChooseTowerRelic.call(window,fallback); }
        finally{ neutralizingLegacyTowerChoice=false; }
        if(result&&goldBefore!==null&&typeof gold!=="undefined"&&numeric(gold)!==goldBefore){ gold=goldBefore;persistCore(); }
        return result;
    }
    if(originalChooseTowerRelic){
        window.vGameplayChooseTowerRelic=function(id){
            const state=gameplayRuntime.getSerializableState();
            if(!state||!state.tower||!state.tower.pendingRelicChoice){ return originalChooseTowerRelic.apply(this,arguments); }
            if(progressionState.legacyTowerChoiceHandled===true){
                return neutralizeCurrentTowerLegacyChoice();
            }
            const choices=gameplayRuntime.towerConfig&&gameplayRuntime.towerConfig.relicChoices||[];
            if(!choices.some(choice=>choice&&choice.id===id)||!catalog[id]||catalog[id].runtimeReady!==true){ return false; }
            const fragmentId=fragmentIdFor(id);
            if(!canAddItem(fragmentId,50)){
                notify("背包空間不足，請先整理背包再領取舊版第 50 層秘寶碎片補償。");
                return false;
            }
            const goldBefore=typeof gold!=="undefined"?numeric(gold):null;
            neutralizingLegacyTowerChoice=true;
            let cleared=false;
            try{ cleared=!!originalChooseTowerRelic.apply(this,arguments); }
            finally{ neutralizingLegacyTowerChoice=false; }
            if(!cleared){ return false; }
            if(goldBefore!==null&&typeof gold!=="undefined"){ gold=goldBefore; }
            const granted=transaction(()=>addItem(fragmentId,50));
            if(!granted||!persistCore()){
                notify("舊版第 50 層秘寶獎勵寫入失敗；請重新開啟遊戲確認存檔狀態。");
                return false;
            }
            progressionState.legacyTowerChoiceHandled=true;
            writeProgressionState();
            refreshInventoryUi();
            showRewardItems([{itemId:fragmentId,count:50}]);
            decorateTowerSurface();
            return true;
        };
    }

    function pendingVictory(pending,state){
        if(!pending||!state){ return false; }
        if(pending.kind==="boss"){
            const progress=pending.type==="world"?state.world&&state.world[pending.id]:state.personal&&state.personal[pending.id];
            if(!progress){ return false; }
            if(pending.type==="personal"){ return integer(progress.clears)>integer(pending.baseline&&pending.baseline.clears); }
            if(pending.baseline&&pending.baseline.firstClear){ return integer(progress.clears)>integer(pending.baseline.clears); }
            return integer(progress.completedStages)>integer(pending.baseline&&pending.baseline.completedStages)||(
                pending.stage===4&&progress.firstClear===true&&pending.baseline&&pending.baseline.firstClear!==true
            );
        }
        if(pending.kind==="tower"){
            const tower=state.tower;
            if(!tower||pending.weekKey&&tower.weekKey!==pending.weekKey){ return false; }
            return !!(tower.claimedFloors&&tower.claimedFloors[String(pending.floor)]);
        }
        return false;
    }
    function battleStillActive(){
        try{
            if(gameplayRuntime.getActiveBattleState&&gameplayRuntime.getActiveBattleState()){ return true; }
        }catch(_){ }
        return typeof battleActive!=="undefined"&&!!battleActive;
    }
    function reconcilePending(){
        const pending=progressionState.pending;
        if(!pending){ return "none"; }
        if(battleStillActive()){ return "waiting"; }
        const state=gameplayRuntime.getSerializableState&&gameplayRuntime.getSerializableState();
        if(!state){ return "waiting"; }
        if(pendingVictory(pending,state)){
            const already=receiptAlreadyDelivered(pending);
            if(!already&&!grantReceiptToTargets(pending)){
                notify("秘寶獎勵尚未寫入：背包空間不足或資料暫時不可用。獎勵已保留，整理背包後重新開啟秘寶／玩法頁即可重試。");
                return "blocked";
            }
            if(pending.kind==="tower"&&RELIC_TOWER_REWARD_CONFIG.majorMilestones[pending.floor]){
                progressionState.majorMilestoneClaims[String(pending.floor)]=true;
            }
            if(!already&&!writeProgressionState()){
                notify("秘寶獎勵存檔失敗，獎勵收據已保留，重新載入後會安全補發且不重複累加。");
                return "save-failed";
            }
            if(!already){
                refreshInventoryUi();
                const goldDelta=typeof gold!=="undefined"?Math.max(0,integer(gold)-integer(pending.beforeGold)):0;
                showRewardItems(pending.rewards,goldDelta);
            }
            progressionState.pending=null;
            writeProgressionState();
            if(pending.kind==="tower"&&pending.floor===50&&progressionState.legacyTowerChoiceHandled===true){
                neutralizeCurrentTowerLegacyChoice();
            }
            decorateAllSurfaces();
            return already?"already-delivered":"delivered";
        }
        const age=Date.now()-integer(pending.startedAt);
        if(age>250||age>RECEIPT_STALE_MS){
            progressionState.pending=null;writeProgressionState();
            return "not-victory";
        }
        return "waiting";
    }

    let receiptMonitor=null;
    function ensureReceiptMonitor(){
        if(receiptMonitor||!progressionState.pending||typeof setInterval!=="function"){ return; }
        receiptMonitor=setInterval(()=>{
            const result=reconcilePending();
            if(!progressionState.pending&&receiptMonitor){ clearInterval(receiptMonitor);receiptMonitor=null; }
            if(result==="blocked"){ /* keep receipt and retry when inventory changes / UI opens */ }
        },300);
        if(receiptMonitor&&typeof receiptMonitor.unref==="function"){ receiptMonitor.unref(); }
    }

    const originalStartBoss=typeof window.vGameplayStartBoss==="function"?window.vGameplayStartBoss:null;
    if(originalStartBoss){
        window.vGameplayStartBoss=function(type,id){
            reconcilePending();
            if(progressionState.pending){ return false; }
            const pending=buildBossPending(type,id);
            if(pending&&!setPending(pending)){
                notify("無法建立安全的秘寶獎勵收據，為避免掉落遺失，本次 BOSS 挑戰未開始。");
                return false;
            }
            const started=originalStartBoss.apply(this,arguments);
            if(!started&&pending){ progressionState.pending=null;writeProgressionState(); }
            else if(started){ ensureReceiptMonitor(); }
            return started;
        };
    }

    function wrapTowerStarter(original,targetResolver){
        if(typeof original!=="function"){ return null; }
        return function(){
            reconcilePending();
            if(progressionState.pending){ return false; }
            const target=targetResolver.apply(this,arguments);
            const pending=buildTowerPending(target);
            if(pending&&!setPending(pending)){
                notify("無法建立安全的秘寶獎勵收據，為避免里程碑遺失，本次爬塔挑戰未開始。");
                return false;
            }
            const started=original.apply(this,arguments);
            if(!started&&pending){ progressionState.pending=null;writeProgressionState(); }
            else if(started){ ensureReceiptMonitor(); }
            return started;
        };
    }
    if(typeof window.vGameplayContinueTower==="function"){
        const original=window.vGameplayContinueTower;
        window.vGameplayContinueTower=wrapTowerStarter(original,function(){
            const tower=gameplayRuntime.getSerializableState().tower;
            return tower.completedFloor>=RELIC_TOWER_REWARD_CONFIG.floorCount?RELIC_TOWER_REWARD_CONFIG.floorCount:tower.completedFloor+1;
        });
    }
    if(typeof window.vGameplaySelectTowerBand==="function"){
        const original=window.vGameplaySelectTowerBand;
        window.vGameplaySelectTowerBand=wrapTowerStarter(original,function(floor){ return floor; });
    }

    function craftStatus(relicId){
        const def=catalog[relicId];
        const owned=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        const state=owned&&owned[relicId];
        const specific=itemCount(fragmentIdFor(relicId));
        const universal=itemCount(MATERIAL_CONFIG.universalItemId);
        const missing=Math.max(0,MATERIAL_CONFIG.composeSpecificFragments-specific);
        const replacement=Math.min(missing,MATERIAL_CONFIG.maxUniversalReplacement);
        const universalCost=replacement*MATERIAL_CONFIG.universalExchangeCost;
        const enoughSpecificBase=specific>=MATERIAL_CONFIG.composeSpecificFragments||specific>=MATERIAL_CONFIG.composeSpecificFragments-MATERIAL_CONFIG.maxUniversalReplacement;
        const canCraft=!!(def&&def.runtimeReady&&state&&!state.unlocked&&enoughSpecificBase&&(
            specific>=MATERIAL_CONFIG.composeSpecificFragments||universal>=universalCost
        ));
        let reason="";
        if(!def){ reason="秘寶資料不存在"; }
        else if(def.runtimeReady!==true){ reason="此秘寶尚未開放"; }
        else if(state&&state.unlocked){ reason="已持有；多餘碎片會保留供未來強化"; }
        else if(specific<50){ reason="至少需要 50 個專屬碎片，通用碎片不可取代超過 50 個"; }
        else if(specific<100&&universal<universalCost){ reason="秘寶通用碎片不足"; }
        return {relicId:relicId,specific:specific,universal:universal,missing:missing,replacement:replacement,universalCost:universalCost,canCraft:canCraft,reason:reason};
    }
    function craftRelic(relicId){
        const def=catalog[relicId],ownedMap=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        const owned=ownedMap&&ownedMap[relicId],status=craftStatus(relicId);
        if(!def||!owned||!status.canCraft){ notify(status.reason||"目前無法合成此秘寶。");return false; }
        const fragmentId=fragmentIdFor(relicId);
        const specificUse=Math.min(MATERIAL_CONFIG.composeSpecificFragments,status.specific);
        const universalUse=status.specific>=MATERIAL_CONFIG.composeSpecificFragments?0:status.universalCost;
        const oldUnlocked=!!owned.unlocked;
        const materialSnapshot={[fragmentId]:itemCount(fragmentId),[MATERIAL_CONFIG.universalItemId]:itemCount(MATERIAL_CONFIG.universalItemId)};
        const success=transaction(()=>consumeItem(fragmentId,specificUse)&&consumeItem(MATERIAL_CONFIG.universalItemId,universalUse));
        if(!success){ notify("秘寶碎片扣除失敗，背包已自動還原。");return false; }
        owned.unlocked=true;owned.level=Math.max(1,integer(owned.level,1));owned.seen=false;
        if(!persistCore()){
            owned.unlocked=oldUnlocked;
            if(!restoreItemCounts(materialSnapshot)){ console.error("秘寶合成失敗後素材還原不完整。",materialSnapshot); }
            persistCore();
            notify("秘寶合成存檔失敗，素材已還原。");
            return false;
        }
        refreshInventoryUi();
        if(typeof window.v174OpenRelicDetail==="function"){ window.v174OpenRelicDetail(relicId); }
        return true;
    }

    function upgradeCost(relicId){
        const def=catalog[relicId],ownedMap=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        const owned=ownedMap&&ownedMap[relicId];
        const current=Math.max(1,integer(owned&&owned.level,1));
        const max=Math.max(1,integer(def&&def.maxLevel,20));
        const essence=current>=max?0:MATERIAL_CONFIG.upgrade.essenceBase+current*MATERIAL_CONFIG.upgrade.essencePerCurrentLevel;
        const breakthrough=current<max&&MATERIAL_CONFIG.upgrade.breakthroughLevels.includes(current)?MATERIAL_CONFIG.upgrade.breakthroughStoneCost:0;
        return {current:current,next:Math.min(max,current+1),max:max,essence:integer(essence),breakthrough:integer(breakthrough)};
    }
    function upgradeRelic(relicId){
        const def=catalog[relicId],ownedMap=relicRuntime.getOwnedState&&relicRuntime.getOwnedState();
        const owned=ownedMap&&ownedMap[relicId],cost=upgradeCost(relicId);
        if(!def||!owned||def.runtimeReady!==true||!owned.unlocked||cost.current>=cost.max){ return false; }
        if(itemCount(MATERIAL_CONFIG.essenceItemId)<cost.essence){ notify("秘寶精華不足。");return false; }
        if(cost.breakthrough>0&&itemCount(MATERIAL_CONFIG.breakthroughItemId)<cost.breakthrough){ notify("需要秘寶突破石 ×"+cost.breakthrough+" 才能突破 Lv."+cost.current+"。");return false; }
        const oldLevel=owned.level;
        const materialSnapshot={[MATERIAL_CONFIG.essenceItemId]:itemCount(MATERIAL_CONFIG.essenceItemId),[MATERIAL_CONFIG.breakthroughItemId]:itemCount(MATERIAL_CONFIG.breakthroughItemId)};
        const success=transaction(()=>consumeItem(MATERIAL_CONFIG.essenceItemId,cost.essence)&&consumeItem(MATERIAL_CONFIG.breakthroughItemId,cost.breakthrough));
        if(!success){ return false; }
        owned.level=cost.next;
        if(!persistCore()){
            owned.level=oldLevel;
            if(!restoreItemCounts(materialSnapshot)){ console.error("秘寶強化失敗後素材還原不完整。",materialSnapshot); }
            persistCore();
            notify("秘寶強化存檔失敗，素材已還原。");
            return false;
        }
        refreshInventoryUi();
        if(typeof window.v174OpenRelicDetail==="function"){ window.v174OpenRelicDetail(relicId); }
        return true;
    }

    function relicSources(relicId){
        const def=catalog[relicId];
        if(!def){ return []; }
        const sources=[];
        Object.entries(RELIC_BOSS_DROP_TABLE).forEach(([bossId,pool])=>{
            if(!pool.includes(relicId)){ return; }
            const definition=[...(gameplayRuntime.personalBosses||[]),...(gameplayRuntime.worldBosses||[])].find(item=>item&&item.id===bossId);
            if(definition){ sources.push(definition.name+"（BOSS）"); }
        });
        Object.entries(RELIC_TOWER_REWARD_CONFIG.majorMilestones).forEach(([floor,reward])=>{
            const box=MATERIAL_CONFIG.choiceBoxes[reward.boxId];
            if(box&&rarityIndex(def.rarity)<=rarityIndex(box.maxRarity)){
                sources.push("四象塔 "+floor+" 層首達自選箱");
            }
        });
        return sources;
    }

    function eligibleChoiceRelics(boxId){
        const box=MATERIAL_CONFIG.choiceBoxes[boxId];
        if(!box){ return []; }
        return Object.values(catalog).filter(def=>def&&def.runtimeReady===true&&rarityIndex(def.rarity)<=rarityIndex(box.maxRarity))
            .sort((a,b)=>rarityIndex(b.rarity)-rarityIndex(a.rarity)||String(a.name).localeCompare(String(b.name),"zh-Hant"));
    }
    function chooseChoiceBox(boxId,relicId){
        const box=MATERIAL_CONFIG.choiceBoxes[boxId],def=catalog[relicId];
        if(!box||!def||!eligibleChoiceRelics(boxId).some(item=>item.id===relicId)){ return false; }
        if(itemCount(boxId)<1){ notify(box.name+"數量不足。");return false; }
        const fragmentId=fragmentIdFor(relicId);
        if(!canAddItem(fragmentId,box.fragmentAmount)){ notify("背包空間不足，無法開啟自選箱。");return false; }
        const materialSnapshot={[boxId]:itemCount(boxId),[fragmentId]:itemCount(fragmentId)};
        const success=transaction(()=>consumeItem(boxId,1)&&addItem(fragmentId,box.fragmentAmount));
        if(!success||!persistCore()){
            if(success){
                if(!restoreItemCounts(materialSnapshot)){ console.error("秘寶自選箱失敗後素材還原不完整。",materialSnapshot); }
                persistCore();
            }
            notify("秘寶碎片自選箱開啟失敗，素材已保留。");
            return false;
        }
        refreshInventoryUi();showRewardItems([{itemId:fragmentId,count:box.fragmentAmount}]);
        if(typeof window.v174OpenRelicPage==="function"){ window.v174OpenRelicPage(); }
        return true;
    }

    function currentWorldStage(id){
        const state=gameplayRuntime.getSerializableState();
        const progress=state&&state.world&&state.world[id];
        return progress?(progress.firstClear?4:Math.min(4,integer(progress.completedStages)+1)):1;
    }
    function bossPreview(type,id){
        const definition=bossDefinition(type,id);
        const stage=type==="world"?currentWorldStage(id):1;
        const difficulty=difficultyForBoss(type,definition,stage);
        const cfg=BOSS_DIFFICULTY_CONFIG[difficulty];
        const pool=poolProbabilities(id);
        return {
            id:id,type:type,stage:stage,difficulty:difficulty,
            fragmentRange:cfg.fragment.slice(),essenceRange:cfg.essence.slice(),
            universalChance:cfg.universal.chance,universalCount:cfg.universal.count.slice(),
            breakthroughChance:cfg.breakthrough.chance,breakthroughCount:cfg.breakthrough.count.slice(),
            pool:pool
        };
    }

    function bossTargetEstimate(type,bossId,relicId,stage){
        const definition=bossDefinition(type,bossId);
        const difficulty=difficultyForBoss(type,definition,stage||1);
        const cfg=BOSS_DIFFICULTY_CONFIG[difficulty];
        const entry=poolProbabilities(bossId).find(item=>item.relicId===relicId);
        if(!entry){ return null; }
        const fragmentsPerClear=entry.chance*avgRange(cfg.fragment);
        return {
            difficulty:difficulty,chance:entry.chance,averageFragmentDrop:avgRange(cfg.fragment),fragmentsPerClear:fragmentsPerClear,
            clearMinutes:cfg.clearMinutes,
            minutesTo50:fragmentsPerClear>0?50/fragmentsPerClear*cfg.clearMinutes:Infinity,
            minutesTo100:fragmentsPerClear>0?100/fragmentsPerClear*cfg.clearMinutes:Infinity,
            expected30:fragmentsPerClear*(30/cfg.clearMinutes),
            expected60:fragmentsPerClear*(60/cfg.clearMinutes),
            expected120:fragmentsPerClear*(120/cfg.clearMinutes)
        };
    }

    function openChoiceBox(boxId){
        const box=MATERIAL_CONFIG.choiceBoxes[boxId];
        if(!box||itemCount(boxId)<1){ return false; }
        const modal=document&&document.getElementById?document.getElementById("homeFeatureModal"):null;
        const body=document&&document.getElementById?document.getElementById("homeFeatureModalBody"):null;
        if(!modal||!body){ return false; }
        const title=document.getElementById("homeFeatureModalTitle");if(title){title.textContent="秘寶碎片自選";}
        const choices=eligibleChoiceRelics(boxId);
        body.innerHTML='<div class="relic-choice-page"><button type="button" class="relic-choice-back" onclick="v174OpenRelicPage()">‹ 返回秘寶列表</button>'+
            '<header><small>'+esc(box.name)+'</small><h3>選擇 '+box.fragmentAmount+' 個專屬碎片</h3><p>只能選擇 '+esc(RARITY_LABELS[box.maxRarity])+'以下、且目前已開放的秘寶；已持有秘寶也可選，碎片會保留。</p></header>'+
            '<div class="relic-choice-grid">'+choices.map(def=>'<button type="button" class="rarity-'+esc(def.rarity)+'" onclick="vRelicProgressionChooseBox(\''+esc(boxId)+'\',\''+esc(def.id)+'\')"><b>'+esc(def.name)+'</b><span>'+esc(RARITY_LABELS[def.rarity])+'・碎片 ×'+box.fragmentAmount+'</span></button>').join("")+'</div></div>';
        return true;
    }

    let currentRelicDetailId=null;
    let currentBossDetail=null;
    const originalOpenRelicPage=typeof window.v174OpenRelicPage==="function"?window.v174OpenRelicPage:null;
    const originalOpenRelicDetail=typeof window.v174OpenRelicDetail==="function"?window.v174OpenRelicDetail:null;
    if(originalOpenRelicPage){
        window.v174OpenRelicPage=function(){ ensureLv20StarterRelics();currentRelicDetailId=null;const result=originalOpenRelicPage.apply(this,arguments);decorateRelicSurface();return result; };
    }
    if(originalOpenRelicDetail){
        window.v174OpenRelicDetail=function(id){ currentRelicDetailId=id;const result=originalOpenRelicDetail.apply(this,arguments);decorateRelicSurface();return result; };
    }
    if(typeof window.openHomeFeature==="function"){
        const original=window.openHomeFeature;
        window.openHomeFeature=function(type){
            if(type==="relic"){ ensureLv20StarterRelics(); }
            const result=original.apply(this,arguments);
            if(type==="relic"){ currentRelicDetailId=null;decorateRelicSurface(); }
            return result;
        };
    }
    if(typeof window.vGameplayOpenBossDetail==="function"){
        const original=window.vGameplayOpenBossDetail;
        window.vGameplayOpenBossDetail=function(type,id){ currentBossDetail={type:type==="world"?"world":"personal",id:id};const result=original.apply(this,arguments);decorateBossSurface();return result; };
    }
    if(typeof window.vGameplayCloseBossDetail==="function"){
        const original=window.vGameplayCloseBossDetail;
        window.vGameplayCloseBossDetail=function(){ currentBossDetail=null;return original.apply(this,arguments); };
    }
    ["v174SetRelicFilter","v174EquipRelic","v174UnequipRelic"].forEach(name=>{
        const original=window[name];
        if(typeof original!=="function"){ return; }
        window[name]=function(){
            const result=original.apply(this,arguments);
            decorateRelicSurface();
            return result;
        };
    });
    if(typeof window.vGameplaySwitchBossTab==="function"){
        const original=window.vGameplaySwitchBossTab;
        window.vGameplaySwitchBossTab=function(){ currentBossDetail=null;return original.apply(this,arguments); };
    }
    ["vGameplayOpenTower","vGameplayToggleTowerOverview","vGameplayRenderTower"].forEach(name=>{
        const original=window[name];
        if(typeof original!=="function"){ return; }
        window[name]=function(){
            const result=original.apply(this,arguments);
            decorateTowerSurface();
            return result;
        };
    });

    function inferredRelicIdFromDetail(){
        if(currentRelicDetailId&&catalog[currentRelicDetailId]){ return currentRelicDetailId; }
        const heading=document&&document.querySelector?document.querySelector("#homeFeatureModalBody .team-relic-detail h2"):null;
        const name=heading&&heading.textContent&&heading.textContent.trim();
        const found=name?Object.values(catalog).find(def=>def&&def.name===name):null;
        return found&&found.id||null;
    }
    function ownedChoiceBoxesMarkup(){
        const owned=Object.entries(MATERIAL_CONFIG.choiceBoxes).filter(([id])=>itemCount(id)>0);
        if(!owned.length){ return ""; }
        return '<div class="relic-progression-box-strip"><span>碎片自選箱</span>'+owned.map(([id,box])=>'<button type="button" onclick="vRelicProgressionOpenBox(\''+esc(id)+'\')">'+esc(box.name)+' ×'+itemCount(id)+'</button>').join("")+'</div>';
    }
    function decorateRelicSurface(){
        if(typeof document==="undefined"){ return; }
        reconcilePending();
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const resource=body.querySelector(".team-relic-resource-line");
        if(resource){
            resource.innerHTML='<span>100 專屬碎片合成・通用碎片 2:1（每件最多替代 50）</span><b>通用 '+itemCount(MATERIAL_CONFIG.universalItemId)+'・精華 '+itemCount(MATERIAL_CONFIG.essenceItemId)+'・突破石 '+itemCount(MATERIAL_CONFIG.breakthroughItemId)+'</b>';
            let boxes=body.querySelector(".relic-progression-box-strip");
            const markup=ownedChoiceBoxesMarkup();
            if(markup){
                if(boxes){ boxes.outerHTML=markup; }
                else{ resource.insertAdjacentHTML("afterend",markup); }
            }else if(boxes){ boxes.remove(); }
        }
        body.querySelectorAll(".team-relic-card").forEach(card=>{
            const name=card.querySelector(".team-relic-card-name")&&card.querySelector(".team-relic-card-name").textContent.trim();
            const def=Object.values(catalog).find(item=>item&&item.name===name);
            if(!def){ return; }
            const owned=relicRuntime.getOwnedState()[def.id];
            const meta=card.querySelector(".team-relic-card-meta");
            if(meta&&!owned.unlocked){ meta.textContent="碎片 "+itemCount(fragmentIdFor(def.id))+" / 100・"+(RARITY_LABELS[def.rarity]||def.rarity); }
        });
        const detail=body.querySelector(".team-relic-detail");
        if(!detail){ return; }
        const relicId=inferredRelicIdFromDetail(),def=catalog[relicId];
        if(!def){ return; }
        const owned=relicRuntime.getOwnedState()[relicId];
        const status=craftStatus(relicId),cost=upgradeCost(relicId);
        let panel=detail.querySelector(".relic-progression-detail-panel");
        const sourceText=relicSources(relicId).length?relicSources(relicId).join("、"):"目前尚無正式取得來源";
        const replacementText=owned.unlocked?"已持有；多餘專屬碎片會保留。":status.specific>=100?"已達 100 專屬碎片，可直接合成。":status.specific>=50?"缺少 "+status.missing+"；需要秘寶通用碎片 ×"+status.universalCost+"。":"至少要先取得 50 個專屬碎片，才能使用通用碎片補足。";
        const panelHtml='<div class="relic-progression-detail-panel"><div><span>專屬碎片</span><b>'+status.specific+' / 100</b></div><div><span>秘寶通用碎片</span><b>'+status.universal+'</b></div><p>'+esc(replacementText)+'</p><small>取得來源：'+esc(sourceText)+'</small><em>每件秘寶最多只能使用通用碎片替代 50 個專屬碎片。</em></div>';
        if(panel){ panel.outerHTML=panelHtml; }
        else{
            const hero=detail.querySelector(".team-relic-detail-hero");
            if(hero){ hero.insertAdjacentHTML("afterend",panelHtml); }
        }
        const upgrade=detail.querySelector(".team-relic-upgrade");
        if(upgrade){
            if(!owned.unlocked){
                upgrade.innerHTML='<h3>合成</h3><p>固定需要 100 個等效專屬碎片；通用碎片 2 個可替代 1 個，但最多替代 50 個。</p><b>'+esc(status.reason||replacementText)+'</b>';
            }else if(cost.current>=cost.max){
                upgrade.innerHTML='<h3>強化</h3><p>目前 Lv.'+cost.current+' / '+cost.max+'</p><b>已達目前秘寶等級上限。</b>';
            }else{
                upgrade.innerHTML='<h3>強化</h3><p>Lv.'+cost.current+' → Lv.'+cost.next+'：秘寶精華 ×'+cost.essence+(cost.breakthrough?' ＋ 秘寶突破石 ×'+cost.breakthrough:'')+'</p><b>持有：精華 '+itemCount(MATERIAL_CONFIG.essenceItemId)+(cost.breakthrough?'・突破石 '+itemCount(MATERIAL_CONFIG.breakthroughItemId):'')+'</b>'+(cost.breakthrough?'<small>Lv.'+cost.current+' 為目前正式突破門檻；現行上限 Lv.'+cost.max+'。</small>':'');
            }
        }
        const actions=detail.querySelector(".team-relic-detail-actions");
        if(actions){
            if(def.runtimeReady!==true){
                actions.innerHTML='<button type="button" disabled>尚未開放</button>';
            }else if(!owned.unlocked){
                actions.innerHTML='<button type="button" '+(status.canCraft?'onclick="vRelicProgressionCraft(\''+esc(relicId)+'\')"':'disabled')+'>'+(status.canCraft?'合成秘寶':'碎片不足')+'</button>';
            }else{
                const equipped=relicRuntime.getTeamLoadout().relicId===relicId;
                actions.innerHTML=(cost.current<cost.max?'<button type="button" onclick="vRelicProgressionUpgrade(\''+esc(relicId)+'\')">強化</button>':'')+
                    '<button type="button" onclick="v174EquipRelic(\''+esc(relicId)+'\')">'+(equipped?'已裝備':'裝備')+'</button>';
            }
        }
    }

    function sanitizedFirstReward(definition){
        let text=String(definition&&definition.firstReward||"");
        if(definition&&definition.relic){
            const relic=catalog[definition.relic];
            if(relic){ text=text.replace(new RegExp("(?:特殊首通：)?"+relic.name+"[・]?","g"),""); }
            text=text.replace(/^・+|・+$/g,"").trim();
            if(!text){ text="原有首通基礎獎勵"; }
            text+="・秘寶本體改由專屬碎片合成";
        }
        return text;
    }
    function decorateBossSurface(){
        if(typeof document==="undefined"){ return; }
        reconcilePending();
        const detail=document.querySelector("#bossTabContent .boss-detail");
        if(!detail){ return; }
        let context=currentBossDetail;
        if(!context&&progressionState.pending&&progressionState.pending.kind==="boss"){
            context={type:progressionState.pending.type,id:progressionState.pending.id};
        }
        if(!context){ return; }
        const definition=bossDefinition(context.type,context.id);if(!definition){return;}
        const preview=bossPreview(context.type,context.id);
        const grid=detail.querySelector(".boss-detail-grid");if(!grid){return;}
        grid.querySelectorAll("section").forEach(section=>{
            const h=section.querySelector("h4");
            if(h&&h.textContent.trim()==="首次擊敗獎勵"&&definition.relic){
                const p=section.querySelector("p");if(p){p.textContent=sanitizedFirstReward(definition)+(section.textContent.includes("已領取")?"・已領取":"");}
            }
        });
        let section=grid.querySelector(".relic-progression-boss-preview");
        if(!section){ section=document.createElement("section");section.className="relic-progression-boss-preview";grid.appendChild(section); }
        const fragments=preview.pool.length?preview.pool.map(entry=>entry.name+"碎片（單場約 "+Math.max(1,Math.round(entry.chance*100))+"%）").join("、"):"目前沒有可用的專屬碎片池";
        const u=Math.round(preview.universalChance*100),b=Math.round(preview.breakthroughChance*100);
        section.innerHTML='<h4>秘寶可能獲得</h4><p>'+esc(fragments)+'</p><small>抽中專屬碎片時：×'+preview.fragmentRange[0]+'～'+preview.fragmentRange[1]+'；秘寶精華：×'+preview.essenceRange[0]+'～'+preview.essenceRange[1]+'（必得）。'+
            (u>0?'秘寶通用碎片：'+u+'% 額外機率。':'')+(b>0?'秘寶突破石：'+b+'% 高難額外機率。':'')+'</small>';
    }

    function decorateTowerSurface(){
        if(typeof document==="undefined"){ return; }
        reconcilePending();
        const home=document.querySelector("#towerPageContent .tower-home");if(!home){return;}
        let guide=home.querySelector(".tower-relic-reward-guide");
        const html='<section class="tower-relic-reward-guide"><h3>秘寶養成獎勵</h3><p>普通層：秘寶精華・每 5 層：通用碎片・每 10 層：通用碎片＋突破石＋較多精華。</p><small>首次達到 25 / 50 / 75 / 100 層，分別獲得藍 / 紫 / 橙 / 桃紅階以下「秘寶碎片自選箱」。四象階不進低塔自選箱。</small></section>';
        if(guide){ guide.outerHTML=html; }
        else{
            const summary=home.querySelector(".tower-summary-grid");
            if(summary){ summary.insertAdjacentHTML("afterend",html); }
            else{ home.insertAdjacentHTML("afterbegin",html); }
        }
        const legacy=home.querySelector(".tower-milestone-choice");
        if(legacy&&progressionState.legacyTowerChoiceHandled===false){
            const h=legacy.querySelector("h3"),p=legacy.querySelector("p");
            if(h){h.textContent="舊版第 50 層秘寶獎勵轉換";}
            if(p){p.textContent="請選擇一件元素秘寶；舊版完整本體獎勵會轉為該秘寶專屬碎片 ×50，不會直接送完整秘寶。";}
        }else if(legacy&&progressionState.legacyTowerChoiceHandled===true){
            setTimeout(neutralizeCurrentTowerLegacyChoice,0);
        }
    }

    function decorateAllSurfaces(){ decorateRelicSurface();decorateBossSurface();decorateTowerSurface(); }

    /* The previous Team Relic owner exposed a gold-only public upgrade action.
       Keep its battle/runtime owner intact, but replace the public progression
       entry so there is only one reachable upgrade economy: essence + stones. */
    window.v174UpgradeRelic=upgradeRelic;
    window.vRelicProgressionCraft=craftRelic;
    window.vRelicProgressionUpgrade=upgradeRelic;
    window.vRelicProgressionOpenBox=openChoiceBox;
    window.vRelicProgressionChooseBox=chooseChoiceBox;

    window.RelicProgressionSystem=Object.freeze({
        stateVersion:STATE_VERSION,
        materialConfig:MATERIAL_CONFIG,
        bossDifficultyConfig:BOSS_DIFFICULTY_CONFIG,
        bossDropTable:RELIC_BOSS_DROP_TABLE,
        towerRewardConfig:RELIC_TOWER_REWARD_CONFIG,
        rarityWeights:RARITY_WEIGHTS,
        rarityFragmentDropChance:RARITY_FRAGMENT_DROP_CHANCE,
        itemDefinitions:itemDefinitions,
        fragmentIdFor:fragmentIdFor,
        getItemCount:itemCount,
        getCraftStatus:craftStatus,
        craftRelic:craftRelic,
        getUpgradeCost:upgradeCost,
        upgradeRelic:upgradeRelic,
        getRelicSources:relicSources,
        getBossPreview:bossPreview,
        getBossPoolProbabilities:poolProbabilities,
        rollBossReward:rollBossReward,
        getTowerRewardPlan:towerRewardPlan,
        getEligibleChoiceRelics:eligibleChoiceRelics,
        chooseChoiceBox:chooseChoiceBox,
        estimateBossTarget:bossTargetEstimate,
        reconcilePending:reconcilePending,
        ensureLv20StarterRelics:ensureLv20StarterRelics,
        getProgressionState:()=>clone(progressionState)
    });

    hydrateOwnedItemPresentation();
    initializeOwnershipPolicy();
    ensureLv20StarterRelics();
    reconcilePending();
    if(progressionState.pending){ ensureReceiptMonitor(); }

    if(typeof document!=="undefined"){
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>setTimeout(decorateAllSurfaces,0),{once:true}); }
        else{ setTimeout(decorateAllSurfaces,0); }
    }
})();
