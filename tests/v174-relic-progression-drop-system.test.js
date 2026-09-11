"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync(process.env.RELIC_SOURCE||"js/relic-progression-drop-system.js","utf8");
const cssPath=process.env.RELIC_CSS||"css/relic-progression-drop-system.css";
const buildPath=process.env.RELIC_BUILD||"scripts/build-production.mjs";
const featureManifestPath=process.env.RELIC_FEATURE_MANIFEST||"config/feature-manifest.json";
const ciPath=process.env.RELIC_CI||".github/workflows/ci.yml";
const css=fs.readFileSync(cssPath,"utf8");
const buildSource=fs.readFileSync(buildPath,"utf8");
const featureManifest=fs.readFileSync(featureManifestPath,"utf8");
const ciSource=fs.readFileSync(ciPath,"utf8");

assert.doesNotMatch(source,/\bwinBattle\s*=|\bloseBattle\s*=|v132LaunchDungeonBattle\s*=|\bsaveGame\s*=/,"relic progression must not add another core battle/save wrapper");
assert.doesNotMatch(source,/MutationObserver/,"relic progression UI must not create a self-triggering DOM observer loop");
assert.match(source,/RELIC_BOSS_DROP_TABLE/);
assert.match(source,/RELIC_TOWER_REWARD_CONFIG/);
assert.match(source,/maxUniversalReplacement:50/);
assert.match(source,/universalExchangeCost:2/);
assert.match(source,/window\.v174UpgradeRelic=upgradeRelic/,"gold-only public relic upgrade route must be replaced by the material progression owner");
assert.doesNotMatch(source,/accountKey\(["']relic-progression|SIDECAR_KEY|sidecar/i,"relic progression state must stay in the existing UID main save, not a new localStorage sidecar");
assert.match(source,/player.*relicProgression|relicProgression.*player/s,"progression claims/receipts must persist through the existing player save object");
assert.doesNotMatch(css,/transform\s*:\s*scale\s*\(/i,"progression UI must not add transform scale layout hacks");
assert.doesNotMatch(css,/!important/i,"progression UI must not rely on !important overrides");
assert.match(buildSource,/js\/relic-progression-drop-system\.js/);
assert.match(buildSource,/css\/relic-progression-drop-system\.css/);
assert.match(featureManifest,/__BUILD_RELIC_PROGRESSION__/);
assert.match(ciSource,/run-relic-progression-browser-qa\.mjs/);

const dependencyGuardIndex=source.indexOf("if(!relicRuntime||!gameplayRuntime||!accountRepository)");
const installedFlagIndex=source.indexOf("window.__relicProgressionDropSystemInstalled=true;");
assert.ok(dependencyGuardIndex>=0&&installedFlagIndex>dependencyGuardIndex,
    "the singleton flag must only be claimed after all runtime owners are available");
{
    const retryContext={window:{},console:{error(){}}};
    vm.runInNewContext(source,retryContext);
    assert.equal(retryContext.window.__relicProgressionDropSystemInstalled,undefined,
        "a dependency-order miss must stay retryable instead of permanently claiming the owner");
}

function makeContext({explicitRelics=false,uid="uid-a",withStarters=false,savedPlayer=null,inventoryItems=null,gameplayOverride=null}={}){
    const store=new Map();
    const saveDoc={player:JSON.parse(JSON.stringify(savedPlayer||{id:"QA"})),inventoryItems:JSON.parse(JSON.stringify(inventoryItems||[]))};
    const localStorage={
        getItem:key=>store.has(key)?store.get(key):null,
        setItem:(key,value)=>store.set(key,String(value)),
        removeItem:key=>store.delete(key)
    };
    const catalog={
        relic_qiankun_flask:{id:"relic_qiankun_flask",name:"乾坤玉壺",rarity:"blue",runtimeReady:true,maxLevel:20},
        relic_sun_orb:{id:"relic_sun_orb",name:"烈陽神珠",rarity:"purple",runtimeReady:true,maxLevel:20},
        relic_xuanwu_seal:{id:"relic_xuanwu_seal",name:"玄武靈印",rarity:"blue",runtimeReady:true,maxLevel:20},
        relic_soul_bell:{id:"relic_soul_bell",name:"鎮魂古鐘",rarity:"purple",runtimeReady:true,maxLevel:20},
        relic_tiangang_banner:{id:"relic_tiangang_banner",name:"天罡戰旗",rarity:"orange",runtimeReady:true,maxLevel:20},
        relic_nine_dragon_fire:{id:"relic_nine_dragon_fire",name:"九龍神火罩",rarity:"purple",runtimeReady:true,maxLevel:20},
        relic_cold_spring_jade:{id:"relic_cold_spring_jade",name:"寒泉玉珮",rarity:"purple",runtimeReady:true,maxLevel:20},
        relic_qinglan_feather:{id:"relic_qinglan_feather",name:"青嵐羽符",rarity:"blue",runtimeReady:true,maxLevel:20},
        relic_rock_mountain_seal:{id:"relic_rock_mountain_seal",name:"岩岳鎮印",rarity:"purple",runtimeReady:true,maxLevel:20},
        relic_returning_wheel:{id:"relic_returning_wheel",name:"回天寶輪",rarity:"pink",runtimeReady:true,maxLevel:20},
        relic_all_returning_array:{id:"relic_all_returning_array",name:"萬象歸元盤",rarity:"four-symbol",runtimeReady:false,maxLevel:20}
    };
    const owned=Object.fromEntries(Object.keys(catalog).map(id=>[id,{unlocked:catalog[id].runtimeReady,level:1,exp:0,seen:false}]));
    const loadout={relicId:"relic_qiankun_flask",subRelicId:null};
    if(explicitRelics){
        saveDoc.playerRelics=JSON.parse(JSON.stringify(owned));
        saveDoc.teamLoadout=JSON.parse(JSON.stringify(loadout));
    }
    const gameplayState=gameplayOverride?JSON.parse(JSON.stringify(gameplayOverride)):{
        personal:Object.fromEntries([20,30,40,50,60,70,80,90,100].map(level=>["personal-"+level,{firstClear:false,clears:0}])),
        world:Object.fromEntries([40,60,80,100].map(level=>["world-"+level,{firstClear:false,completedStages:0,clears:0}])),
        tower:{weekKey:"2026-09-07",completedFloor:0,highestThisWeek:0,historicalHighest:0,claimedFloors:{},pendingRelicChoice:false}
    };
    const personal=[20,30,40,50,60,70,80,90,100].map(level=>({id:"personal-"+level,name:"P"+level,level,relic:level===80?"relic_returning_wheel":null}));
    const world=[40,60,80,100].map(level=>({id:"world-"+level,name:"W"+level,level,relic:level===40?"relic_returning_wheel":null}));
    let activeBattle=null;
    const context={
        console,JSON,Date,Math,Number,Object,Array,Map,Set,Promise,
        setTimeout,clearTimeout,setInterval,clearInterval,
        window:null,localStorage,gold:1000,
        player:saveDoc.player,
        inventoryItems:saveDoc.inventoryItems,
        saveGame(){
            saveDoc.player=JSON.parse(JSON.stringify(context.player));
            saveDoc.inventoryItems=context.inventoryItems.map(item=>({...item,stats:{...(item.stats||{})}}));
            saveDoc.playerRelics=JSON.parse(JSON.stringify(owned));
            saveDoc.teamLoadout=JSON.parse(JSON.stringify(loadout));
            return true;
        },
        rebuildInventorySlots(){},renderInventoryItems(){},
        v132CanAddItemToInventory(){ return true; },
        v132AddItemToInventory(definition,count){
            let stack=context.inventoryItems.find(item=>item.id===definition.id);
            if(!stack){ stack={...definition,stats:{...(definition.stats||{})},count:0};context.inventoryItems.push(stack); }
            stack.count=(Number(stack.count)||0)+count;return true;
        },
        v132ConsumeStackItem(id,count){
            const total=context.inventoryItems.filter(item=>item.id===id).reduce((sum,item)=>sum+(Number(item.count)||0),0);
            if(total<count){ return false; }
            let remaining=count;
            for(let index=context.inventoryItems.length-1;index>=0&&remaining>0;index--){
                const item=context.inventoryItems[index];if(item.id!==id){continue;}
                const take=Math.min(remaining,Number(item.count)||0);item.count-=take;remaining-=take;
                if(item.count<=0){context.inventoryItems.splice(index,1);}
            }
            return true;
        },
        v132RunInventoryTransaction(operation){
            const snapshot=context.inventoryItems.map(item=>({...item,stats:{...(item.stats||{})}}));
            try{ if(operation()){ return true; } }catch(_){ }
            context.inventoryItems.splice(0,context.inventoryItems.length,...snapshot);return false;
        },
        FourSymbolsAccountSave:{
            getActiveUid:()=>uid,
            readForUid:()=>({status:"ready",save:saveDoc})
        },
        v174RelicSystem:{catalog,getOwnedState:()=>owned,getTeamLoadout:()=>loadout},
        GameplaySystem:{
            towerConfig:{floorCount:100,relicChoices:[{id:"relic_nine_dragon_fire"},{id:"relic_cold_spring_jade"},{id:"relic_qinglan_feather"},{id:"relic_rock_mountain_seal"}]},
            personalBosses:personal,worldBosses:world,
            getSerializableState:()=>JSON.parse(JSON.stringify(gameplayState)),
            getActiveBattleState:()=>activeBattle
        }
    };
    if(withStarters){
        context.vGameplayStartBoss=(type,id)=>{activeBattle={mode:type,definitionId:id};return true;};
        context.vGameplayContinueTower=()=>{activeBattle={mode:"tower"};return true;};
        context.vGameplaySelectTowerBand=floor=>{activeBattle={mode:"tower",floor};return true;};
    }
    context.__setActiveBattle=value=>{activeBattle=value;};
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return {context,catalog,owned,loadout,gameplayState,saveDoc,store};
}

function add(context,id,count){
    const definition=context.RelicProgressionSystem.itemDefinitions[id];
    assert.ok(definition,"missing item definition "+id);
    assert.equal(context.v132AddItemToInventory(definition,count),true);
}

/* Old-save fallback and new-account ownership migration. */
{
    const {context,owned,loadout,saveDoc,store}=makeContext();
    assert.equal(owned.relic_qiankun_flask.unlocked,false,"a new save must enter fragment acquisition instead of inheriting free relics");
    assert.equal(loadout.relicId,null);
    assert.equal(context.RelicProgressionSystem.getItemCount("relicUniversalFragment"),0);
    assert.equal(context.RelicProgressionSystem.getItemCount("relicEssence"),0);
    assert.equal(context.RelicProgressionSystem.getItemCount("relicBreakthroughStone"),0);
    assert.equal(saveDoc.player.relicProgression.initialized,true,"progression state must live in the existing player/main save document");
    assert.equal(store.size,0,"no new relic-only localStorage sidecar may be created");
}
{
    const {owned}=makeContext({explicitRelics:true});
    assert.equal(owned.relic_qiankun_flask.unlocked,true,"existing explicit relic ownership must never be revoked");
}
{
    const {context,owned,saveDoc}=makeContext({savedPlayer:{id:"QA",level:20}});
    assert.equal(context.RelicProgressionSystem.starterRelicLevel,20);
    assert.deepEqual(Array.from(context.RelicProgressionSystem.starterRelicIds),["relic_qiankun_flask","relic_xuanwu_seal"]);
    assert.equal(owned.relic_qiankun_flask.unlocked,true,"Lv20 must guarantee the first blue starter relic");
    assert.equal(owned.relic_xuanwu_seal.unlocked,true,"Lv20 must guarantee the second blue starter relic");
    assert.equal(owned.relic_qinglan_feather.unlocked,false,"the Lv20 guarantee must not silently unlock every blue relic");
    assert.equal(context.v174RelicSystem.catalog.relic_qiankun_flask.rarity,"blue");
    assert.equal(context.v174RelicSystem.catalog.relic_xuanwu_seal.rarity,"blue");
    assert.equal(saveDoc.playerRelics.relic_qiankun_flask.unlocked,true,"starter relic ownership must persist through the existing main save");
    assert.equal(saveDoc.playerRelics.relic_xuanwu_seal.unlocked,true);
}

/* 100 specific; 99 specific; 50 specific + 100 universal; 49 cannot bypass. */
{
    const {context,owned}=makeContext();
    const fragment=context.RelicProgressionSystem.fragmentIdFor("relic_nine_dragon_fire");
    add(context,fragment,100);
    assert.equal(context.RelicProgressionSystem.craftRelic("relic_nine_dragon_fire"),true);
    assert.equal(owned.relic_nine_dragon_fire.unlocked,true);
    assert.equal(context.RelicProgressionSystem.getItemCount(fragment),0);
}
{
    const {context}=makeContext();
    const fragment=context.RelicProgressionSystem.fragmentIdFor("relic_nine_dragon_fire");
    add(context,fragment,99);
    assert.equal(context.RelicProgressionSystem.getCraftStatus("relic_nine_dragon_fire").canCraft,false);
}
{
    const {context,owned}=makeContext();
    const fragment=context.RelicProgressionSystem.fragmentIdFor("relic_nine_dragon_fire");
    add(context,fragment,50);add(context,"relicUniversalFragment",100);
    const status=context.RelicProgressionSystem.getCraftStatus("relic_nine_dragon_fire");
    assert.equal(status.replacement,50);assert.equal(status.universalCost,100);assert.equal(status.canCraft,true);
    assert.equal(context.RelicProgressionSystem.craftRelic("relic_nine_dragon_fire"),true);
    assert.equal(owned.relic_nine_dragon_fire.unlocked,true);
    assert.equal(context.RelicProgressionSystem.getItemCount(fragment),0);
    assert.equal(context.RelicProgressionSystem.getItemCount("relicUniversalFragment"),0);
}
{
    const {context}=makeContext();
    const fragment=context.RelicProgressionSystem.fragmentIdFor("relic_nine_dragon_fire");
    add(context,fragment,49);add(context,"relicUniversalFragment",1000);
    const status=context.RelicProgressionSystem.getCraftStatus("relic_nine_dragon_fire");
    assert.equal(status.canCraft,false);assert.match(status.reason,/至少需要 50/);
}

/* Essence-only levels and the real Lv20 runtime's Lv10 breakthrough gate. */
{
    const {context,owned}=makeContext({explicitRelics:true});
    owned.relic_nine_dragon_fire.level=1;
    const levelOne=context.RelicProgressionSystem.getUpgradeCost("relic_nine_dragon_fire");
    assert.equal(levelOne.essence,26);assert.equal(levelOne.breakthrough,0);
    add(context,"relicEssence",levelOne.essence);
    assert.equal(context.RelicProgressionSystem.upgradeRelic("relic_nine_dragon_fire"),true);
    assert.equal(owned.relic_nine_dragon_fire.level,2);
    owned.relic_nine_dragon_fire.level=10;
    const gate=context.RelicProgressionSystem.getUpgradeCost("relic_nine_dragon_fire");
    assert.equal(gate.breakthrough,1);
    add(context,"relicEssence",gate.essence);
    assert.equal(context.RelicProgressionSystem.upgradeRelic("relic_nine_dragon_fire"),false);
    add(context,"relicBreakthroughStone",1);
    assert.equal(context.RelicProgressionSystem.upgradeRelic("relic_nine_dragon_fire"),true);
    assert.equal(owned.relic_nine_dragon_fire.level,11);
}

/* Boss directed pools, difficulty quantities, universal and breakthrough extras. */
{
    const {context}=makeContext();
    const p20Entries=context.RelicProgressionSystem.getBossPoolProbabilities("personal-20");
    const p20=p20Entries.map(entry=>entry.relicId).sort();
    const p40=context.RelicProgressionSystem.getBossPoolProbabilities("personal-40").map(entry=>entry.relicId).sort();
    assert.notDeepEqual(p20,p40);
    const blueEntry=p20Entries.find(entry=>entry.relicId==="relic_qinglan_feather");
    const purpleEntry=p20Entries.find(entry=>entry.relicId==="relic_sun_orb");
    assert.ok(blueEntry.chance>purpleEntry.chance,"rarity gate must make the higher-rarity target slower inside the same Boss pool");
    assert.equal(context.RelicProgressionSystem.rarityFragmentDropChance["four-symbol"],.12);
    const missSequence=[0,0.99,0,0.99,0.99];let missCursor=0;
    const miss=context.RelicProgressionSystem.rollBossReward("personal","personal-20",1,{rng:()=>missSequence[missCursor++]??.99});
    assert.equal(miss.rewards.some(reward=>reward.itemId.startsWith("relicFragment_")),false,"a rarity-gate miss still resolves the Boss reward safely");
    assert.ok(miss.rewards.some(reward=>reward.itemId==="relicEssence"),"essence must remain stable progression when a fragment roll misses");
    const sequence=[0,0,0,0,0,1];let cursor=0;
    const normal=context.RelicProgressionSystem.rollBossReward("personal","personal-20",1,{rng:()=>sequence[cursor++]??1});
    const normalFragment=normal.rewards.find(reward=>reward.itemId.startsWith("relicFragment_"));
    assert.ok(normalFragment&&normalFragment.count>=2&&normalFragment.count<=4);
    assert.ok(normal.rewards.some(reward=>reward.itemId==="relicEssence"));
    assert.ok(normal.rewards.some(reward=>reward.itemId==="relicUniversalFragment"),"normal Boss can low-roll an extra universal fragment");

    const hell=context.RelicProgressionSystem.getBossPreview("personal","personal-80");
    assert.deepEqual(Array.from(hell.fragmentRange),[4,7]);assert.equal(hell.breakthroughChance,.10);
    const special=context.RelicProgressionSystem.getBossPreview("personal","personal-100");
    assert.deepEqual(Array.from(special.fragmentRange),[5,8]);assert.equal(special.breakthroughChance,.18);
}

/* Tower ordinary / 5-floor / 10-floor / permanent major milestone behavior. */
{
    const {context}=makeContext();
    const ids=(floor,firstEver)=>context.RelicProgressionSystem.getTowerRewardPlan(floor,{firstEver}).rewards.map(reward=>reward.itemId);
    assert.deepEqual(ids(1,true),["relicEssence"]);
    assert.ok(ids(5,true).includes("relicUniversalFragment"));
    assert.ok(!ids(5,true).includes("relicBreakthroughStone"));
    assert.ok(ids(10,true).includes("relicBreakthroughStone"));
    assert.ok(ids(25,true).includes("relicChoiceBoxBlue"));
    assert.ok(!ids(25,false).includes("relicChoiceBoxBlue"));
    assert.ok(ids(50,true).includes("relicChoiceBoxPurple"));
    assert.ok(ids(75,true).includes("relicChoiceBoxOrange"));
    assert.ok(ids(100,true).includes("relicChoiceBoxPink"));
}

/* Choice boxes enforce max rarity and do not expose the unopened four-symbol relic. */
{
    const {context}=makeContext();
    const purple=context.RelicProgressionSystem.getEligibleChoiceRelics("relicChoiceBoxPurple");
    assert.ok(!purple.some(def=>def.id==="relic_tiangang_banner"));
    const pink=context.RelicProgressionSystem.getEligibleChoiceRelics("relicChoiceBoxPink");
    assert.ok(pink.some(def=>def.id==="relic_returning_wheel"));
    assert.ok(!pink.some(def=>def.id==="relic_all_returning_array"));
}

/* Pending receipt is exact-once for Bosses and survives an already-delivered reload state. */
{
    const {context,gameplayState}=makeContext({withStarters:true});
    assert.equal(context.vGameplayStartBoss("personal","personal-20"),true);
    const pending=context.RelicProgressionSystem.getProgressionState().pending;
    assert.ok(pending&&pending.kind==="boss");
    for(const reward of pending.rewards){ add(context,reward.itemId,reward.count); }
    const before=Object.fromEntries(pending.rewards.map(reward=>[reward.itemId,context.RelicProgressionSystem.getItemCount(reward.itemId)]));
    gameplayState.personal["personal-20"].firstClear=true;
    gameplayState.personal["personal-20"].clears=1;
    context.__setActiveBattle(null);
    assert.equal(context.RelicProgressionSystem.reconcilePending(),"already-delivered");
    assert.equal(context.RelicProgressionSystem.getProgressionState().pending,null);
    for(const [id,count] of Object.entries(before)){ assert.equal(context.RelicProgressionSystem.getItemCount(id),count,"receipt must not duplicate "+id); }
}

/* Tower weekly claim state prevents repeated relic materials from the same claimed floor. */
{
    const {context,gameplayState}=makeContext({withStarters:true});
    assert.equal(context.vGameplaySelectTowerBand(5),true);
    const pending=context.RelicProgressionSystem.getProgressionState().pending;
    assert.ok(pending&&pending.floor===5);
    gameplayState.tower.claimedFloors["5"]=true;gameplayState.tower.completedFloor=5;gameplayState.tower.historicalHighest=5;
    context.__setActiveBattle(null);
    assert.equal(context.RelicProgressionSystem.reconcilePending(),"delivered");
    const universal=context.RelicProgressionSystem.getItemCount("relicUniversalFragment");
    assert.ok(universal>0);
    assert.equal(context.vGameplaySelectTowerBand(5),true,"existing Tower replay remains playable");
    assert.equal(context.RelicProgressionSystem.getProgressionState().pending,null,"already-claimed weekly floor creates no second relic receipt");
    assert.equal(context.RelicProgressionSystem.getItemCount("relicUniversalFragment"),universal);
}

/* Major milestone claims persist inside the UID main save and do not re-award their choice box on a later weekly climb. */
{
    const first=makeContext({withStarters:true});
    first.gameplayState.tower.completedFloor=24;first.gameplayState.tower.highestThisWeek=24;first.gameplayState.tower.historicalHighest=24;
    assert.equal(first.context.vGameplaySelectTowerBand(25),true);
    const pending=first.context.RelicProgressionSystem.getProgressionState().pending;
    assert.ok(pending.rewards.some(reward=>reward.itemId==="relicChoiceBoxBlue"));
    first.gameplayState.tower.claimedFloors["25"]=true;first.gameplayState.tower.completedFloor=25;first.gameplayState.tower.highestThisWeek=25;first.gameplayState.tower.historicalHighest=25;
    first.context.__setActiveBattle(null);
    assert.equal(first.context.RelicProgressionSystem.reconcilePending(),"delivered");
    assert.equal(first.saveDoc.player.relicProgression.majorMilestoneClaims["25"],true);

    const nextWeek={
        personal:Object.fromEntries([20,30,40,50,60,70,80,90,100].map(level=>["personal-"+level,{firstClear:false,clears:0}])),
        world:Object.fromEntries([40,60,80,100].map(level=>["world-"+level,{firstClear:false,completedStages:0,clears:0}])),
        tower:{weekKey:"2026-09-14",completedFloor:24,highestThisWeek:24,historicalHighest:25,claimedFloors:{},pendingRelicChoice:false}
    };
    const reload=makeContext({explicitRelics:true,withStarters:true,savedPlayer:first.saveDoc.player,inventoryItems:first.saveDoc.inventoryItems,gameplayOverride:nextWeek});
    assert.equal(reload.context.vGameplaySelectTowerBand(25),true);
    const secondPending=reload.context.RelicProgressionSystem.getProgressionState().pending;
    assert.ok(secondPending.rewards.some(reward=>reward.itemId==="relicEssence"));
    assert.ok(!secondPending.rewards.some(reward=>reward.itemId==="relicChoiceBoxBlue"),"permanent milestone choice box must not be claimable twice");
}

/* UID isolation: separate account contexts do not share progression receipts or material inventory. */
{
    const a=makeContext({uid:"uid-a"});
    add(a.context,"relicUniversalFragment",10);a.context.saveGame();
    const b=makeContext({uid:"uid-b"});
    assert.equal(b.context.RelicProgressionSystem.getItemCount("relicUniversalFragment"),0);
    assert.equal(b.context.RelicProgressionSystem.getProgressionState().pending,null);
}

/* The current catalog has no usable white relic. Four-symbol fragments have a long-term high-end source, but the unfinished relic cannot be crafted/equipped yet. */
{
    const {context}=makeContext();
    const estimate=context.RelicProgressionSystem.estimateBossTarget("personal","personal-40","relic_qiankun_flask",1);
    assert.ok(estimate&&estimate.expected30>0&&estimate.expected60>estimate.expected30&&estimate.expected120>estimate.expected60);
    assert.ok(estimate.minutesTo100>estimate.minutesTo50);
    const four=context.RelicProgressionSystem.getBossPoolProbabilities("world-100").find(entry=>entry.relicId==="relic_all_returning_array");
    assert.ok(four&&four.chance>0&&four.chance<.02,"four-symbol fragment path should be rare but non-zero");
    assert.equal(context.RelicProgressionSystem.getCraftStatus("relic_all_returning_array").canCraft,false,"unfinished four-symbol relic must not become equip-ready through the drop system");
}

console.log("✓ Relic progression/drop system targeted tests passed.");
