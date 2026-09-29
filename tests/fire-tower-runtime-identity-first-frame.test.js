"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const towerSource=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const portraitSource=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const registry=JSON.parse(fs.readFileSync("config/monster-portrait-registry.json","utf8"));
const fireEntries=registry.assetPool.entries.filter(entry=>entry.element==="fire");
const fireById=new Map(fireEntries.map(entry=>[entry.assetId,entry]));
const WEEK_KEY="2026-09-28";

function loadTower({gate}={}){
    const calls=[];
    const context={
        window:null,console,Math,Number,Object,Array,Set,Map,Promise,Date,
        FourSymbolsAccountSave:{
            getActiveUid:()=>"test-user",
            saveKey:uid=>"save:"+uid,
            readForUid:()=>({status:"missing"})
        },
        v132DungeonRankMultipliers:{
            elite:{maxHP:1,defense:1},boss:{maxHP:1.5,defense:1.2}
        },
        v132BuildDungeonMonster:(name,level,element,rank)=>({
            name,level,element,rank,alive:true,hp:100,maxHP:100,attack:10,magicAttack:10,
            skillChance:.4,defense:10
        }),
        v132LaunchDungeonBattle:(roster)=>{
            calls.push({type:"launch",roster});
            return true;
        },
        v133GetHighestCreatedCharacterLevel:()=>100,
        v132GetContentDefinitions:()=>({ores:[]}),
        saveGame:()=>{},showPage:()=>{},renderBattle:()=>{},updateUI:()=>{},
        getExistingPartyIndexes:()=>[],getPartyCharacterByIndex:()=>null,
        rebuildInventorySlots:()=>{},updateGoldDisplay:()=>{},
        v154PreparePortraitsForEncounter:null,
        FourSymbolsFeatures:{ensureAssets:()=>Promise.resolve(true)},
        fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve(registry)})
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(portraitSource,context);
    context.v154InstallMonsterPortraitRegistry(registry);
    if(gate){ context.v154PreparePortraitsForEncounter=gate; }
    vm.runInContext(towerSource,context);
    context.GameplaySystem.debugReloadState({tower:{weekKey:WEEK_KEY,element:"fire"}},Date.UTC(2026,8,28));
    return {context,calls,fireById};
}

async function testDisplayIdentity(){
    const runtime=loadTower();
    for(const floor of [1,5,10,50,100]){
        const roster=runtime.context.GameplaySystem.buildTowerRoster(floor);
        assert.ok(roster.length>0,"floor "+floor+" must build a roster");
        const prepared=await runtime.context.v154PreparePortraitsForEncounter(roster);
        assert.equal(prepared.state,"ready","floor "+floor+" portrait identity must resolve before launch");
        roster.forEach(monster=>{
            const record=runtime.fireById.get(monster.portraitKey);
            assert.ok(record,"fire tower portrait must resolve in the registry");
            assert.equal(monster.displayName,record.displayName,
                "floor "+floor+" display identity must follow its portrait registry record");
            assert.notEqual(monster.displayName,"天兵天將");
            assert.notEqual(monster.displayName,"赤焰使");
            assert.notEqual(monster.displayName,"炎天尊");
        });
    }
}

async function testFirstFrameGate(){
    let registryPending=true;
    let prepareCalls=0;
    let runtime;
    runtime=loadTower({gate:async monsters=>{
        prepareCalls++;
        assert.equal(registryPending,true,"the regression starts with a cold pending registry");
        assert.ok(monsters.every(monster=>monster.portraitKey),"the encounter must expose all portrait keys before launch");
        const prepared=await runtime.context.v154PreparePortraitsForEncounter(monsters);
        assert.equal(prepared.state,"ready","the installed portrait owner must prepare the encounter");
        assert.ok(monsters.every(monster=>monster.displayName),"registry identities must resolve before launch");
        registryPending=false;
        return prepared;
    }});
    const result=await runtime.context.vGameplaySelectTowerBand(1);
    assert.equal(result,true,"tower battle should launch after visual preparation");
    assert.equal(prepareCalls,1,"tower entry must use the shared encounter portrait gate");
    assert.equal(registryPending,false);
    const launch=runtime.calls.find(call=>call.type==="launch");
    assert.ok(launch,"battle launcher must be called");
    assert.ok(launch.roster.every(monster=>monster.displayName&&monster.portraitKey),
        "the first visible battle roster must already have identity and portrait binding");
}

function testCrossElementIsolation(){
    for(const element of ["fire","water","wind","earth"]){
        const runtime=loadTower();
        const id=runtime.context.GameplaySystem.getTowerPortraitAssetId(element,10,"boss",0);
        if(element==="fire") assert.match(id,/^MON_FIRE_/,"fire tower must use the fire portrait plan");
        else assert.equal(id,null,element+" tower must not inherit the fire tower plan");
    }
}

(async()=>{
    const selected=process.env.FIRE_TOWER_TEST;
    if(!selected||selected==="A"){ await testDisplayIdentity(); }
    if(!selected||selected==="B"){ await testFirstFrameGate(); }
    if(!selected||selected==="C"){ testCrossElementIsolation(); }
    console.log("Fire tower runtime identity / first-frame tests passed.");
})().catch(error=>{
    console.error(error);
    process.exitCode=1;
});
