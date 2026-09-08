"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");

function storage(seed){
    const values=new Map(Object.entries(seed||{}).map(([key,value])=>[key,String(value)]));
    return {
        getItem:key=>values.has(String(key))?values.get(String(key)):null,
        setItem:(key,value)=>values.set(String(key),String(value)),
        removeItem:key=>values.delete(String(key)),
        snapshot:()=>Object.fromEntries(values)
    };
}
function baseHp(level,rank){
    if(Number(level)===20){ return rank==="elite"?1373:rank==="boss"?1931:429; }
    if(Number(level)===40){ return rank==="elite"?2288:rank==="boss"?3218:715; }
    throw new Error("unexpected Abyss level "+level);
}
function baseDefense(level,rank){
    if(Number(level)===20){ return rank==="elite"?190:rank==="boss"?213:152; }
    if(Number(level)===40){ return rank==="elite"?326:rank==="boss"?365:261; }
    return 1;
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
        v132BuildDungeonMonster:(name,level,element,rank)=>({
            name,level,element,rank,maxHP:baseHp(level,rank),hp:baseHp(level,rank),maxSP:100,sp:100,
            defense:baseDefense(level,rank),attack:Number(level)===20?140:244,magicAttack:Number(level)===20?140:241,
            skillIds:[element+"Skill"],skillChance:.35,v132Dungeon:true,activeBuffs:[],statusEffects:[]
        }),
        v132LaunchDungeonBattle:()=>true,
        v143SkillAnimationManifest:{explosiveFlurry:{sprite:{src:"assets/vfx/fire/explosive-flurry-cast.png?v=165",columns:4,rows:3,frames:12,placement:"group"}}}
    };
    context.window=context;
    context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(source,context,{filename:"js/59-abyss-two-tier-runtime.js"});
    return {
        context,localStorage,playerEl,mapEl,
        flushTimers(){ while(timers.length){ const fn=timers.shift();fn(); } }
    };
}
function value(context,expression){ return JSON.parse(vm.runInContext("JSON.stringify("+expression+")",context)); }

let passed=0;
function test(name,fn){ fn();passed++;console.log("✓ "+name); }

test("fixed difficulties remain Lv20/Lv40 and skill levels stay Lv1/Lv2 before final-v155 launch patch",()=>{
    [20,40].forEach(level=>{
        const {context}=load({playerLevel:80});
        for(let region=0;region<5;region++) for(let stage=0;stage<5;stage++){
            const roster=value(context,`v174AbyssBuildRoster(${level},${region},${stage})`);
            assert.equal(roster.length,stage<4?8:10);
            assert.equal(roster.every(monster=>monster.level===level),true);
            assert.equal(roster.every(monster=>monster.v141ForceSkillLevel===(level===20?1:2)),true);
        }
    });
});

test("all pre-stages are three elite in front plus five regular in back",()=>{
    const {context}=load();
    [20,40].forEach(level=>{
        for(let region=0;region<5;region++) for(let stage=0;stage<4;stage++){
            const roster=value(context,`v174AbyssBuildRoster(${level},${region},${stage})`);
            assert.deepEqual(roster.map(monster=>monster.rank),[
                "regular","regular","regular","regular","regular","elite","elite","elite"
            ]);
            assert.deepEqual(roster.slice(0,5).map(monster=>monster.v141FormationRow),[1,1,1,1,1]);
            assert.deepEqual(roster.slice(0,5).map(monster=>monster.v141FormationPosition),[0,1,2,3,4]);
            assert.deepEqual(roster.slice(5).map(monster=>monster.v141FormationRow),[0,0,0]);
            assert.deepEqual(roster.slice(5).map(monster=>monster.v141FormationPosition),[0,1,2]);
        }
    });
});

test("non-final boss stages and Lv20 final remain nine elite plus one emperor",()=>{
    const {context}=load();
    for(let region=0;region<4;region++){
        [20,40].forEach(level=>{
            const roster=value(context,`v174AbyssBuildRoster(${level},${region},4)`);
            assert.equal(roster.length,10);
            assert.equal(roster.filter(monster=>monster.rank==="elite").length,9);
            assert.equal(roster.filter(monster=>monster.rank==="boss").length,1);
        });
    }
    const initialFinal=value(context,"v174AbyssBuildRoster(20,4,4)");
    assert.equal(initialFinal.length,10);
    assert.deepEqual(initialFinal.filter(monster=>monster.rank==="boss").map(monster=>monster.name),["極帝天尊"]);
    assert.equal(initialFinal.filter(monster=>monster.rank==="elite").length,9);
});

test("Lv40 final battle restores five Heavenly Emperors plus five elite in formal v155 order",()=>{
    const {context}=load();
    const roster=value(context,"v174AbyssBuildRoster(40,4,4)");
    assert.equal(roster.length,10);
    assert.deepEqual(roster.slice(0,5).map(monster=>monster.name),["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"]);
    assert.equal(roster.slice(0,5).every(monster=>monster.rank==="boss"&&monster.v141FormationRow===0),true);
    assert.equal(roster.slice(5).every(monster=>monster.rank==="elite"&&monster.v141FormationRow===1),true);
    assert.deepEqual(roster.slice(0,5).map(monster=>monster.v141FormationPosition),[0,1,2,3,4]);
});

test("both Abyss difficulties reduce current monster HP by 25 percent while preserving the same stage curve",()=>{
    const {context}=load();
    const expected20=[[[724,2317],[764,2446],[804,2574],[845,2703]],[2832,5793]];
    const expected40=[[[1207,3861],[1274,4076],[1341,4290],[1408,4505]],[4719,9654]];
    [[20,expected20],[40,expected40]].forEach(([level,expected])=>{
        expected[0].forEach(([regularHp,eliteHp],stage)=>{
            const roster=value(context,`v174AbyssBuildRoster(${level},0,${stage})`);
            assert.deepEqual([roster[0].maxHP,roster[5].maxHP],[regularHp,eliteHp]);
            assert.equal(roster.every(monster=>monster.v174AbyssDurabilityMultiplier===1.875),true);
        });
        const boss=value(context,`v174AbyssBuildRoster(${level},0,4)`);
        assert.deepEqual([
            boss.find(monster=>monster.rank==="elite").maxHP,
            boss.find(monster=>monster.rank==="boss").maxHP
        ],expected[1]);
    });
});

test("HP durability change does not modify attack or defense construction",()=>{
    const {context}=load();
    const lv20=value(context,"v174AbyssBuildRoster(20,0,0)");
    const lv40=value(context,"v174AbyssBuildRoster(40,0,0)");
    assert.deepEqual([lv20[0].attack,lv20[0].defense],[140,152]);
    assert.deepEqual([lv40[0].attack,lv40[0].defense],[244,261]);
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

test("V143 Fire Flurry reuses the existing Canvas crop renderer instead of adding a second VFX runtime",()=>{
    const {context}=load();
    const sprite=value(context,"v143SkillAnimationManifest.explosiveFlurry.sprite");
    assert.equal(sprite.renderer,"canvas-crop");
    assert.deepEqual([sprite.frameWidth,sprite.frameHeight,sprite.naturalGrid,sprite.alignToSlots],[384,384,true,true]);
    assert.equal(sprite.src,"assets/vfx/fire/explosive-flurry-cast.png?v=165");
    assert.doesNotMatch(source,/v142SkillAnimationDirector\s*=\s*\{/);
});

test("claimed chest survives reload and never respawns",()=>{
    const first=load();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win');v174AbyssClaimChest()",first.context);
    const second=load({storage:first.localStorage.snapshot()});
    const state=value(second.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.phase,state.chestSpawned,state.chestClaimed,state.portalUnlocked],["portal",false,true,true]);
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

console.log(`All ${passed} Abyss regression tests passed.`);