"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=file=>{
    let target=path.join(ROOT,file);
    if(!fs.existsSync(target)&&file==="config/feature-manifest.json"){ target=path.join(ROOT,"feature-manifest.json"); }
    if(!fs.existsSync(target)&&file==="scripts/build-production.mjs"){ target=path.join(ROOT,"build-production.mjs"); }
    return fs.readFileSync(target,"utf8");
};

function makeDocument(){
    return {
        hidden:false,readyState:"complete",
        addEventListener(){},dispatchEvent(){},
        getElementById(){return null;},createEvent(){return {initCustomEvent(){}};}
    };
}
function runScript(context,file){
    vm.createContext(context);
    vm.runInContext(read(file),context,{filename:file});
    return context;
}
function baseRuntime(){
    let intervalId=0;
    const intervals=new Map();
    let battleCallback=null;
    const player={id:"測試俠",level:20,hp:80,sp:70,adventureProgress:null};
    const context={
        window:null,globalThis:null,console,Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,JSON,
        document:makeDocument(),CustomEvent:function(_n,o){this.detail=o&&o.detail;},
        player,player2:null,player3:null,gold:0,sharedExp:0,battleActive:false,
        setTimeout(fn){return 1;},clearTimeout(){},
        setInterval(fn){const id=++intervalId;intervals.set(id,fn);return id;},clearInterval(id){intervals.delete(id);},
        addEventListener(){},alert(){},
        saveGame(){},updateUI(){},updateGoldDisplay(){},rebuildInventorySlots(){},showPage(){},
        getExistingPartyIndexes(){return [0];},getPartyCharacterByIndex(){return player;},getPartyBattleStats(){return {maxHP:100,maxSP:100};},
        makeZoneMonster(name,level,element,rank){return {name,level,element,rank,maxHP:100,maxSP:50,hp:100,sp:50,alive:true};},
        v133GetHighestCreatedCharacterLevel(){return player.level;},
        v132LaunchDungeonBattle(_roster,callback){battleCallback=callback;context.battleActive=true;return true;},
        get battleCallback(){return battleCallback;},
        tickBattleMonitor(){for(const fn of intervals.values()){fn();}}
    };
    context.window=context;context.globalThis=context;
    return context;
}

(function testAdventureFailureSnapshot(){
    const c=baseRuntime();
    runScript(c,"js/adventure/adventure-content-v1-20260915.js");
    runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
    const state=c.player.adventureProgress.chapters.chapter_v1;
    state.currentNodeId="n02_roadfight";
    c.player.hp=62;c.player.sp=41;
    assert.equal(c.FourSymbolsAdventure.beginBattle("n02_roadfight"),true);
    c.player.hp=23;c.player.sp=17;
    c.tickBattleMonitor();
    c.battleActive=false;
    c.player.hp=100;c.player.sp=100;
    c.battleCallback({result:"lose"});
    assert.equal(c.player.hp,23,"Adventure loss must restore the final live-combat HP snapshot");
    assert.equal(c.player.sp,17,"Adventure loss must restore the final live-combat SP snapshot");
    assert.equal(state.currentNodeId,"n02_roadfight","Adventure loss stays on the same node");
})();

(function testDropPity(){
    const c=baseRuntime();
    runScript(c,"js/adventure/adventure-content-v1-20260915.js");
    runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
    const objective={current:0,target:5,dropRate:.40,pityMisses:3,missesSinceDrop:0};
    c.FourSymbolsAdventure.__test.processDropAttempts(objective,4,()=>.99);
    assert.equal(objective.current,1,"three misses must force the fourth drop");
    assert.equal(objective.missesSinceDrop,0);
    const lucky={current:0,target:5,dropRate:.40,pityMisses:3,missesSinceDrop:0};
    c.FourSymbolsAdventure.__test.processDropAttempts(lucky,1,()=>.10);
    assert.equal(lucky.current,1,"base drop rate stays 40%");
})();

(function testRestAndBranchRules(){
    const c=baseRuntime();
    runScript(c,"js/adventure/adventure-content-v1-20260915.js");
    runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
    const state=c.player.adventureProgress.chapters.chapter_v1;
    c.player.hp=50;c.player.sp=60;state.currentNodeId="n06_rest";
    assert.equal(c.FourSymbolsAdventure.restAtNode("n06_rest"),true);
    assert.equal(c.player.hp,80,"rest restores 30% max HP");
    assert.equal(c.player.sp,90,"rest restores 30% max SP");
    const branchState=c.player.adventureProgress.chapters.chapter_v1;
    branchState.currentNodeId="n03_fork";
    branchState.completedNodes={};branchState.branchSelections={};branchState.chapterCompleted=false;
    assert.equal(c.FourSymbolsAdventure.selectBranch("n03_fork","safe"),true);
    assert.equal(c.FourSymbolsAdventure.getNodeStatus("n04b_gate"),"locked","unchosen branch stays locked before chapter clear");
    c.player.adventureProgress.chapters.chapter_v1.chapterCompleted=true;
    assert.equal(c.FourSymbolsAdventure.getNodeStatus("n04b_gate"),"available","unchosen branch becomes backtrackable after chapter clear");
})();

(function testObjectiveUsesUnlockedZonesOnly(){
    const c=baseRuntime();
    c.player.level=20;
    c.zoneConfig={
        foothill:{name:"山腳",monsters:[{name:"山狼",level:5,rank:"regular"}]},
        ridge:{name:"山脊",monsters:[{name:"山賊",level:18,rank:"regular"},{name:"巡山精英",level:20,rank:"elite"}]},
        summit:{name:"山巔",monsters:[{name:"未開放強敵",level:30,rank:"regular"}]}
    };
    runScript(c,"js/adventure/adventure-content-v1-20260915.js");
    runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
    const target=c.FourSymbolsAdventure.__test.chooseObjectiveTarget(c.FourSymbolsAdventureContent.objectives.obj_patrol_token,()=>0);
    assert.equal(target.zoneKey,"ridge","objective must prefer the highest currently unlocked patrol zone");
    assert.notEqual(target.monsterName,"未開放強敵","objective must never target a locked patrol zone");
})();

(function testMerchantRollAndPurchase(){
    function runtimeWithRoll(value){
        const c=baseRuntime();
        c.Math.random=()=>value;
        let added=0;
        c.gold=5000;
        c.FourSymbolsAdventureItems={
            definitions:{nineTurnRestorationPill:{id:"nineTurnRestorationPill"},taichingQiPill:{id:"taichingQiPill"}},
            count(){return added;},
            canAdd(){return true;},
            add(id,count){ if(id==="nineTurnRestorationPill"){ added+=count; } return true; }
        };
        runScript(c,"js/adventure/adventure-content-v1-20260915.js");
        runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
        return {c,get added(){return added;}};
    }
    const appear=runtimeWithRoll(.10);
    let state=appear.c.player.adventureProgress.chapters.chapter_v1;
    assert.equal(state.hidden.merchantAppears,true,"25% merchant roll must allow appearance");
    state.hidden.merchantRevealed=true;
    assert.equal(appear.c.FourSymbolsAdventure.buyMerchantItem("nineTurnRestorationPill"),true);
    assert.equal(appear.added,1);
    state=appear.c.player.adventureProgress.chapters.chapter_v1;
    assert.equal(state.merchant.purchases.nineTurnRestorationPill.quantity,1);
    assert.equal(appear.c.FourSymbolsAdventure.buyMerchantItem("nineTurnRestorationPill"),false,"same chapter merchant item is one-time purchase");
    const absent=runtimeWithRoll(.90);
    state=absent.c.player.adventureProgress.chapters.chapter_v1;
    assert.equal(state.hidden.merchantAppears,false,"merchant must also support the not-appearing outcome");
})();

(function testReturnFromPatrolBattleGuard(){
    const c=baseRuntime();
    runScript(c,"js/adventure/adventure-content-v1-20260915.js");
    runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
    c.battleActive=true;
    assert.equal(c.FourSymbolsAdventure.returnFromPatrol(),false,"active battle must block hard return to Adventure");
})();

(function testReturnFromPatrolUsesFormalExitAndKeepsObjective(){
    const c=baseRuntime();
    runScript(c,"js/adventure/adventure-content-v1-20260915.js");
    runScript(c,"js/adventure/adventure-runtime-v1-20260915.js");
    const state=c.player.adventureProgress.chapters.chapter_v1;
    state.objective={
        active:true,turnedIn:false,sourceNodeId:"n05_objective",zoneKey:"ridge",
        monsterName:"山賊",current:2,target:5
    };
    const before=JSON.stringify(state.objective);
    let exits=0,reason="";
    c.FourSymbolsPatrolLifecycle={
        exit(value){ exits++; reason=value; return true; }
    };
    assert.equal(c.FourSymbolsAdventure.returnFromPatrol(),true);
    assert.equal(exits,1,"Adventure must reuse the formal Patrol exit owner exactly once");
    assert.equal(reason,"adventure-return");
    assert.equal(JSON.stringify(state.objective),before,"returning from Patrol must not clear objective progress");
})();

(function testRarePillsManualOnly(){
    const counts={hpPotion10:2,spPotion10:2,nineTurnRestorationPill:1,taichingQiPill:1};
    const context={
        window:null,globalThis:null,console,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        potionDefinitions:[
            {id:"hpPotion10",resource:"hp",recoveryPercent:10},
            {id:"spPotion10",resource:"sp",recoveryPercent:10}
        ],
        inventoryItems:[],setTimeout(){return 1;},
        getPotionCount(id){return counts[id]||0;},
        getPotionDefinition(id){return context.potionDefinitions.find(item=>item.id===id)||null;},
        getAutoPotionId(resource){
            return context.potionDefinitions.filter(d=>d.resource===resource).sort((a,b)=>a.recoveryPercent-b.recoveryPercent)
                .map(d=>d.id).find(id=>(counts[id]||0)>0)||null;
        }
    };
    context.window=context;context.globalThis=context;
    runScript(context,"js/adventure/adventure-items-v1-20260915.js");
    const nine=context.potionDefinitions.find(d=>d.id==="nineTurnRestorationPill");
    const qi=context.potionDefinitions.find(d=>d.id==="taichingQiPill");
    assert.equal(nine.manualOnly,true);assert.equal(nine.recoveryPercent,100);assert.equal(nine.resource,"hp");
    assert.equal(qi.manualOnly,true);assert.equal(qi.recoveryPercent,100);assert.equal(qi.resource,"sp");
    assert.equal(context.getAutoPotionId("hp"),"hpPotion10");
    counts.hpPotion10=0;
    assert.equal(context.getAutoPotionId("hp"),null,"auto recovery must not consume 九轉回元丹");
    counts.spPotion10=0;
    assert.equal(context.getAutoPotionId("sp"),null,"auto recovery must not consume 太清聚氣丹");
})();

(function testStaticOwnersAndCss(){
    const manifest=JSON.parse(read("config/feature-manifest.json"));
    assert.equal(manifest.features.adventure,"feature-adventure");
    assert.deepEqual(manifest.bundles["feature-adventure"].dependencies,["gameplay-core"]);
    const build=read("scripts/build-production.mjs");
    assert.match(build,/js\/adventure\/adventure-entry-v1-20260915\.js/);
    assert.match(build,/js\/adventure\/adventure-items-v1-20260915\.js/);
    assert.match(build,/feature-adventure/);
    const runtime=read("js/adventure/adventure-runtime-v1-20260915.js");
    assert.doesNotMatch(runtime,/loseBattle\s*=/,"Adventure must not wrap loseBattle");
    assert.doesNotMatch(runtime,/winBattle\s*=/,"Adventure must not wrap winBattle");
    assert.match(runtime,/v132LaunchDungeonBattle/);
    assert.match(runtime,/normalizeFailureResources:false/,"Adventure must explicitly opt out of V132 failure refill");
    const dungeonOwner=read("js/27-v132-content-expansion.js");
    assert.match(dungeonOwner,/function launchDungeonBattle\(monsterList,onComplete,options\)/);
    assert.match(dungeonOwner,/normalizeFailureResources:opts\.normalizeFailureResources!==false/);
    assert.match(dungeonOwner,/if\(run\.normalizeFailureResources!==false\)/);
    const ui=read("js/adventure/adventure-ui-v1-20260915.js");
    assert.match(ui,/getElementById\("game-content"\)\|\|document\.getElementById\("game-stage"\)/,"Adventure page must mount inside the existing game-content owner before falling back to game-stage");
    const entryCss=read("css/adventure-entry-v1-20260915.css");
    const css=read("css/adventure-v1-20260915.css");
    const touchLock=read("js/01-stage-v8-touch-lock.js");
    assert.doesNotMatch(entryCss+css,/transform\s*:\s*scale\s*\(/i,"Adventure CSS must not own whole-surface scaling");
    assert.match(entryCss,/pointer-events:none/);assert.match(css,/pointer-events:none/);
    assert.match(entryCss,/prefers-reduced-motion/);assert.match(css,/prefers-reduced-motion/);
    assert.match(css,/overflow-x:hidden/);assert.match(css,/safe-area-inset-top/);assert.match(css,/safe-area-inset-bottom/);
    assert.match(css,/#adventurePage\.adventure-page\{[\s\S]*?display:flex;[\s\S]*?flex-direction:column;/,"Adventure page must size its view from the actual header height");
    assert.match(css,/\.adventure-view\{[^}]*flex:1 1 auto;[^}]*min-height:0;[^}]*overflow-y:auto;/,"Adventure map must keep one flexible vertical scroll owner");
    assert.doesNotMatch(css,/\.adventure-view\{[^}]*height:calc\(/,"Adventure view must not reserve a guessed header height");
    assert.match(touchLock,/\.adventure-view/,"Adventure's existing view scroll owner must pass the stage touch-lock whitelist");
    assert.equal((entryCss.match(/pointer-events:none/g)||[]).length>=1,true);
    assert.equal((css.match(/pointer-events:none/g)||[]).length>=1,true);
})();

console.log("✓ adventure node system V1 targeted regressions");
