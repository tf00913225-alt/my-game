"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
const accountRepositorySource=(fs.readFileSync("js/startup/account-save-repository.js","utf8")+fs.readFileSync("js/00-main.js","utf8").split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */')[1].split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */')[0]);
const TEST_UID="abyss-test-uid";

function storage(seed){
    const values=new Map(Object.entries(seed||{}).map(([key,value])=>[key,String(value)]));
    return {
        getItem:key=>values.has(String(key))?values.get(String(key)):null,
        setItem:(key,value)=>values.set(String(key),String(value)),
        removeItem:key=>values.delete(String(key)),
        snapshot:()=>Object.fromEntries(values)
    };
}
function classList(){
    const values=new Set();
    return {add:name=>values.add(name),remove:name=>values.delete(name),contains:name=>values.has(name)};
}
function load(options={}){
    const localStorage=storage(options.storage);
    const noop=()=>{};
    const timers=[];
    const playerEl=options.deferMovement?{style:{},classList:classList()}:null;
    const mapEl=options.deferMovement?{
        getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),
        style:{},classList:classList()
    }:null;
    const document={
        readyState:"complete",
        getElementById(id){
            if(id==="v141AbyssPlayer"){ return playerEl; }
            if(id==="v141AbyssMap"){ return mapEl; }
            return null;
        },
        querySelector:()=>null,
        addEventListener:noop
    };
    const context={
        console,JSON,Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        parseInt,parseFloat,isNaN,localStorage,document,
        requestAnimationFrame:fn=>{ if(fn){ fn(); } return 1; },
        setTimeout(fn){ if(options.deferMovement){ timers.push(fn); }else if(fn){ fn(); } return timers.length||1; },clearTimeout:noop,
        alert:noop,confirm:()=>true,player:{id:"qa",level:options.playerLevel||50},player2:null,player3:null,gold:0,sharedExp:0,
        renderDungeonTabContent:()=>"legacy",currentDungeonTab:"daily",saveGame:noop,rebuildInventorySlots:noop,updateGoldDisplay:noop,
        showPage:noop,switchDungeonTab:noop,v133GetHighestCreatedCharacterLevel:()=>options.playerLevel||50,
        v132CanAddItemToInventory:()=>true,v132AddItemToInventory:()=>true,
        v132GetContentDefinitions:()=>({tickets:[
            {id:"ticketSetEarth",name:"岩岳裝備券"},{id:"ticketSetFire",name:"赤炎裝備券"},
            {id:"ticketSetWind",name:"青嵐裝備券"},{id:"ticketSetWater",name:"寒泉裝備券"}
        ]}),
        v132BuildDungeonMonster:()=>{throw Error('Retired Abyss numerical caller');},
        v132LaunchDungeonBattle:()=>true,
        v143SkillAnimationManifest:{explosiveFlurry:{sprite:{src:"assets/vfx/fire/explosive-flurry-cast.png?v=165",columns:4,rows:3,frames:12,placement:"group"}}}
    };
    context.window=context;
    context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(accountRepositorySource,context,{filename:"js/startup/account-save-repository.js"});
    context.FourSymbolsAccountSave.activate(TEST_UID);
    const oldMain=localStorage.getItem("battle_full_version_save_v5");
    if(oldMain){
        context.FourSymbolsAccountSave.writeForUid(TEST_UID,JSON.parse(oldMain),{source:"test-fixture"});
        localStorage.removeItem("battle_full_version_save_v5");
    }
    vm.runInContext(fs.readFileSync("js/00-main.js","utf8").split("/* END GENERATED MONSTER BALANCE OWNER */")[0]+"/* END GENERATED MONSTER BALANCE OWNER */",context);
    context.getMonsterSkillPoolForLevel=(element,level)=>[element+"Skill"];
    context.getMonsterSkillTierAndChance=()=>({chance:.35});
    // Use the real core hook dispatcher; this isolated progression fixture has no skill hooks.
    const coreSource=fs.readFileSync("js/00-main.js","utf8");
    vm.runInContext(coreSource.slice(coreSource.indexOf("function configureBuiltMonster("),coreSource.indexOf("const zone4Monsters")),context);
    vm.runInContext(source,context,{filename:"js/59-abyss-two-tier-runtime.js"});
    return {
        context,localStorage,playerEl,mapEl,
        flushTimers(){ while(timers.length){ const fn=timers.shift();fn(); } }
    };
}
function value(context,expression){ return JSON.parse(vm.runInContext("JSON.stringify("+expression+")",context)); }

let passed=0;
function test(name,fn){ fn();passed++;console.log("✓ "+name); }

test("all two-wave profiles retain fixed levels and skills",()=>{
    const {context}=load({playerLevel:80});
    for(const level of [20,40])for(let region=0;region<5;region++)for(let stage=0;stage<5;stage++){
        const waves=value(context,`v174AbyssBuildWaves(${level},${region},${stage})`);
        assert.equal(waves.length,2);assert.equal(waves[0].length,6);
        const final=level===40&&region===4&&stage===4;
        assert.equal(waves[1].length,final?5:6);
        assert.ok(waves.flat().every(m=>m.level===level));
        assert.ok(waves.flat().every(m=>m.v141ForceSkillLevel===(final?5:level===20?1:2)));
        if(stage<4){
            assert.deepEqual(waves[0].map(m=>m.rank),Array(6).fill("regular"));
            assert.deepEqual(waves[1].map(m=>m.rank),["elite","elite","elite","regular","regular","regular"]);
        }else{
            assert.deepEqual(waves[0].map(m=>m.rank),Array(6).fill("elite"));
            if(!final)assert.deepEqual(waves[1].map(m=>m.rank),["smallBoss","elite","elite","elite","elite","elite"]);
        }
    }
});
test("Lv40 final five retain canonical names and exact fixed loadouts",()=>{
    const {context}=load();const waves=value(context,"v174AbyssBuildWaves(40,4,4)");
    assert.deepEqual(waves[1].map(m=>m.name),["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"]);
    assert.deepEqual(waves[1].map(m=>m.skillIds),[["dustStorm","flyingSandStrike"],["windHowlLightning","stormRain"],["flyingSandStrike","phoenixCry"],["iceArrowRain","iceSpin"],["dragonSlash","phoenixCry"]]);
    assert.deepEqual(waves[1].map(m=>m.v141SupportSkillIds),[["rockWall"],["stealthSkill"],["yuanZuBlessing"],["healSpell"],["rage"]]);
    assert.ok(waves[1].every(m=>m.rank==="smallBoss"));
});

test("Abyss HP/SP/attack/defense now match the unique owner without late durability writes",()=>{
    const {context}=load();
    [20,40].forEach(level=>{for(let region=0;region<5;region++)for(let stage=0;stage<5;stage++){
        const roster=value(context,`v174AbyssBuildRoster(${level},${region},${stage})`);
        for(const m of roster){
            const p=context.MonsterBalance.preview(m.balanceProjection.identity);
            assert.equal(m.maxHP,p.final.maxHP);assert.equal(m.maxSP,p.final.maxSP);
            assert.equal(m.attack,p.final.physicalAttack);assert.equal(m.magicAttack,p.final.magicAttack);
            assert.equal(m.defense,p.final.defense);assert.equal(m.agility,p.final.speed);
            assert.equal(m.balanceOwner,"MonsterBalance");
            assert.equal(Object.hasOwn(m,"v174AbyssDurabilityMultiplier"),false);
        }
    }});
});

test("rapid chest taps acquire one interaction lock and grant exactly one reward",()=>{
    const run=load({deferMovement:true});
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win')",run.context);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",run.context),true);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",run.context),false);
    assert.equal(Number(run.context.gold),0,"reward must wait until the first movement completes");
    assert.deepEqual(value(run.context,"v174AbyssGetInteractionDiagnostics()"),{moving:true,interaction:{kind:"chest",key:"d20-r0-s0"}});
    run.flushTimers();
    const state=value(run.context,"v174AbyssGetRunState(20)");
    assert.equal(Number(run.context.gold),120);
    assert.deepEqual([state.phase,state.chestClaimed,state.portalUnlocked],["portal",true,true]);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",run.context),false);
    assert.equal(Number(run.context.gold),120);
});

test("rapid portal taps can advance only one stage",()=>{
    const run=load({deferMovement:true});
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win')",run.context);
    vm.runInContext("v174AbyssClaimChest()",run.context);run.flushTimers();
    assert.equal(vm.runInContext("v174AbyssUsePortal()",run.context),true);
    assert.equal(vm.runInContext("v174AbyssUsePortal()",run.context),false);
    let state=value(run.context,"v174AbyssGetRunState(20)");
    assert.equal(state.encounterIndex,0,"stage must not commit before movement finishes");
    run.flushTimers();
    state=value(run.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.regionIndex,state.encounterIndex,state.phase],[0,1,"ready"]);
});

test("rapid map double tap does not rewrite committed coordinates or create instant movement",()=>{
    const run=load({deferMovement:true});
    vm.runInContext("v174AbyssSelectDifficulty(20)",run.context);
    run.context.__tapA={clientX:800,clientY:500,target:{closest:()=>null}};
    run.context.__tapB={clientX:200,clientY:200,target:{closest:()=>null}};
    assert.equal(vm.runInContext("v174AbyssMoveByEvent(__tapA)",run.context),true);
    assert.equal(vm.runInContext("v174AbyssMoveByEvent(__tapB)",run.context),false);
    let state=value(run.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.x,state.y],[50,84],"persisted coordinates must remain at the movement origin while walking");
    assert.deepEqual([run.playerEl.style.left,run.playerEl.style.top],["80%","50%"]);
    run.flushTimers();
    state=value(run.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.x,state.y],[80,50],"only the first tap may commit after its smooth movement completes");
});

test("Abyss runtime never mutates the shared V143 VFX manifest",()=>{
    assert.doesNotMatch(source,/patchExistingV143ExplosiveFlurryRenderer/);
    assert.doesNotMatch(source,/v143SkillAnimationManifest/);
    assert.doesNotMatch(source,/canvas-crop/);
});

test("claimed chest survives reload and never respawns",()=>{
    const first=load();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win');v174AbyssClaimChest()",first.context);
    const second=load({storage:first.localStorage.snapshot()});
    const state=value(second.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.phase,state.chestSpawned,state.chestClaimed,state.portalUnlocked],["portal",false,true,true]);
});

test("replay preserves permanent first-clear ledger and skips every claimed chest reward",()=>{
    const run=load();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win');v174AbyssClaimChest()",run.context);
    assert.equal(Number(run.context.gold),120);
    vm.runInContext("v174AbyssReset(20);v174AbyssResolveBattleResult('win')",run.context);
    const replay=value(run.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([replay.phase,replay.chestSpawned,replay.chestClaimed,replay.portalUnlocked],["portal",false,true,true]);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",run.context),false);
    assert.equal(Number(run.context.gold),120,"replay must never duplicate the first-clear chest");
    assert.equal(replay.firstClearClaims["d20-r0-s0"].status,"claimed");
});

test("Abyss progress hydrates from the canonical main save when the compatibility sidecar is absent",()=>{
    const mainSeed={"battle_full_version_save_v5":JSON.stringify({player:{id:"qa",level:50}})};
    const first=load({storage:mainSeed});
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win');v174AbyssClaimChest()",first.context);
    const snapshot=first.localStorage.snapshot();delete snapshot[first.context.FourSymbolsAccountSave.accountKey("abyss-state")];
    const second=load({storage:snapshot});
    const state=value(second.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.phase,state.chestClaimed,state.portalUnlocked],["portal",true,true]);
    assert.equal(state.firstClearClaims["d20-r0-s0"].status,"claimed");
});

test("all player-facing Abyss exits are routed to the Gameplay Center owner",()=>{
    assert.match(source,/v174AbyssLeaveToGameplay\(\)/);
    assert.match(source,/window\.v141LeaveAbyssMap=leaveToGameplay/);
    assert.doesNotMatch(source,/v174-abyss-complete[\s\S]{0,800}showPage\(["']dungeon["']\)/);
});

test("Lv20/Lv40 state remains separate and full run completes after exactly 25 claimed stages",()=>{
    const {context}=load();
    vm.runInContext("v174AbyssSelectDifficulty(20)",context);
    let wins=0;
    while(true){
        const before=value(context,"v174AbyssGetRunState(20)");
        if(before.completed){ break; }
        assert.equal(before.phase,"ready");
        vm.runInContext("v174AbyssResolveBattleResult('win');v174AbyssClaimChest()",context);wins++;
        const claimed=value(context,"v174AbyssGetRunState(20)");
        if(claimed.completed){ break; }
        vm.runInContext("v174AbyssUsePortal()",context);
    }
    const lv20=value(context,"v174AbyssGetRunState(20)");
    assert.equal(wins,25);
    assert.equal(lv20.completed,true);
    assert.equal(Object.keys(lv20.completedStages).length,25);
    vm.runInContext("v174AbyssBackToSelection();v174AbyssSelectDifficulty(40);v174AbyssResolveBattleResult('win')",context);
    const lv40=value(context,"v174AbyssGetRunState(40)");
    assert.deepEqual([lv40.regionIndex,lv40.encounterIndex,lv40.phase],[0,0,"chest"]);
    assert.equal(lv20.completed,true);
});

test("formal encounter completion returns and resolves progress without result-modal dismissal",()=>{
    for(const result of ["win","lose","escape"]){
        const {context}=load();const pages=[],tabs=[];let complete;
        context.showPage=page=>pages.push(page);context.switchDungeonTab=tab=>tabs.push(tab);
        context.FourSymbolsBattleStatistics={showResultDetails:()=>{throw Error("retired UI called");}};
        context.v132LaunchDungeonBattle=(_roster,callback)=>{complete=callback;return true;};
        context.v174AbyssSelectDifficulty(20);
        assert.equal(context.v174AbyssStartEncounter(),true);
        complete({result});
        assert.equal(pages.at(-1),"dungeon");assert.equal(tabs.at(-1),"abyss");
        const run=value(context,"v174AbyssGetRunState(20)");
        assert.equal(run.phase,result==="win"?"chest":"ready");
        assert.equal(run.battleCompleted,result==="win");
        assert.equal(context.gold,0,"battle completion does not bypass the chest reward owner");
    }
});
console.log(`All ${passed} Abyss regression tests passed.`);
