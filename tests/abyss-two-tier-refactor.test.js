"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const loaderSource=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");
const cssSource=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");

function createStorage(seed){
    const values=new Map(Object.entries(seed||{}).map(([key,value])=>[key,String(value)]));
    return {
        getItem:key=>values.has(String(key))?values.get(String(key)):null,
        setItem:(key,value)=>values.set(String(key),String(value)),
        removeItem:key=>values.delete(String(key)),
        clear:()=>values.clear(),
        snapshot:()=>Object.fromEntries(values)
    };
}

function baseHp(level,rank){
    if(Number(level)===20){ return rank==="elite"?1373:rank==="boss"?1931:429; }
    if(Number(level)===40){ return rank==="elite"?2288:rank==="boss"?3218:715; }
    throw new Error("unexpected fixed Abyss level "+level);
}

function baseDefense(level,rank){
    if(Number(level)===20){ return rank==="elite"?190:rank==="boss"?213:152; }
    if(Number(level)===40){ return rank==="elite"?326:rank==="boss"?365:261; }
    return 1;
}

function makeContext(options){
    const opts=options||{};
    const storage=createStorage(opts.storage);
    const noop=()=>{};
    const document={
        readyState:"complete",
        getElementById:()=>null,
        querySelector:()=>null,
        addEventListener:noop
    };
    const context={
        console,JSON,Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        parseInt,parseFloat,isNaN,
        localStorage:storage,document,
        requestAnimationFrame:callback=>{ if(typeof callback==="function"){ callback(); } return 1; },
        setTimeout:callback=>{ if(typeof callback==="function"){ callback(); } return 1; },
        clearTimeout:noop,
        alert:noop,confirm:()=>true,
        player:{id:"tester",level:opts.playerLevel||50},player2:null,player3:null,
        gold:0,sharedExp:0,
        renderDungeonTabContent:()=>"legacy-dungeon",
        currentDungeonTab:"daily",
        saveGame:noop,rebuildInventorySlots:noop,updateGoldDisplay:noop,
        showPage:noop,switchDungeonTab:noop,
        v133GetHighestCreatedCharacterLevel:()=>opts.playerLevel||50,
        v132CanAddItemToInventory:()=>true,
        v132AddItemToInventory:()=>true,
        v132GetContentDefinitions:()=>({tickets:[
            {id:"ticketSetEarth",name:"岩岳裝備券"},
            {id:"ticketSetFire",name:"赤炎裝備券"},
            {id:"ticketSetWind",name:"青嵐裝備券"},
            {id:"ticketSetWater",name:"寒泉裝備券"}
        ]}),
        v132BuildDungeonMonster:(name,level,element,rank)=>({
            name,level,element,rank,maxHP:baseHp(level,rank),hp:baseHp(level,rank),
            maxSP:100,sp:100,defense:baseDefense(level,rank),attack:Number(level)===20?140:244,
            magicAttack:Number(level)===20?140:241,skillIds:[element+"Skill"],skillChance:.35,
            v132Dungeon:true,activeBuffs:[],statusEffects:[]
        }),
        v132LaunchDungeonBattle:()=>true
    };
    context.window=context;
    context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(source,context,{filename:"js/59-abyss-two-tier-runtime.js"});
    return {context,storage};
}

function json(context,expression){
    return JSON.parse(vm.runInContext("JSON.stringify("+expression+")",context));
}

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

test("formal loader chains the new Abyss owner after late runtime owners",()=>{
    assert.match(loaderSource,/v17363-functional-fixes-runtime/);
    assert.match(loaderSource,/v174-abyss-two-tier-runtime/);
    assert.match(loaderSource,/js\/59-abyss-two-tier-runtime\.js/);
});

test("Abyss reuses v132 dungeon monster construction and does not create a second combat engine",()=>{
    assert.match(source,/window\.v132BuildDungeonMonster\(name,config\.monsterLevel,region\.element,rank\)/);
    assert.match(source,/window\.v132LaunchDungeonBattle\(roster/);
    assert.doesNotMatch(source,/function\s+calculateDamage\s*\(/);
    assert.match(v132Source,/function buildDungeonMonster\(name,level,element,rank\)/);
    assert.match(v132Source,/const DUNGEON_ELITE_MULTIPLIERS=\{maxHP:3\.20,maxSP:2\.00,defense:1\.25\}/);
    assert.match(v132Source,/const DUNGEON_BOSS_MULTIPLIERS=\{maxHP:4\.50,maxSP:2\.00,defense:1\.40\}/);
});

test("Lv20 stays fixed at monster level 20 even for Lv30/Lv50 players",()=>{
    [30,50].forEach(playerLevel=>{
        const {context}=makeContext({playerLevel});
        for(let region=0;region<5;region++){
            for(let stage=0;stage<5;stage++){
                const roster=json(context,`v174AbyssBuildRoster(20,${region},${stage})`);
                assert.equal(roster.length,10);
                assert.equal(roster.every(monster=>monster.level===20),true);
                assert.equal(roster.every(monster=>monster.v141ForceSkillLevel===1),true);
            }
        }
    });
});

test("Lv40 stays fixed at monster level 40 and skill level 2",()=>{
    const {context}=makeContext({playerLevel:80});
    for(let region=0;region<5;region++){
        for(let stage=0;stage<5;stage++){
            const roster=json(context,`v174AbyssBuildRoster(40,${region},${stage})`);
            assert.equal(roster.every(monster=>monster.level===40),true);
            assert.equal(roster.every(monster=>monster.v141ForceSkillLevel===2),true);
            assert.equal(roster.some(monster=>monster.v141ForceSkillLevel===5),false);
        }
    }
});

test("all four pre-stages are ten enemies with five regular then five elite",()=>{
    const {context}=makeContext();
    [20,40].forEach(level=>{
        for(let region=0;region<5;region++){
            for(let stage=0;stage<4;stage++){
                const roster=json(context,`v174AbyssBuildRoster(${level},${region},${stage})`);
                assert.deepEqual(roster.map(monster=>monster.rank),[
                    "regular","regular","regular","regular","regular",
                    "elite","elite","elite","elite","elite"
                ]);
                assert.deepEqual(roster.map(monster=>monster.v141FormationRow),[0,0,0,0,0,1,1,1,1,1]);
            }
        }
    });
});

test("boss stages are one emperor plus nine elite and final is only Extreme Emperor plus nine elite",()=>{
    const {context}=makeContext();
    [20,40].forEach(level=>{
        for(let region=0;region<5;region++){
            const roster=json(context,`v174AbyssBuildRoster(${level},${region},4)`);
            assert.equal(roster.length,10);
            assert.equal(roster.filter(monster=>monster.rank==="boss").length,1);
            assert.equal(roster.filter(monster=>monster.rank==="elite").length,9);
        }
        const final=json(context,`v174AbyssBuildRoster(${level},4,4)`);
        assert.deepEqual(final.filter(monster=>monster.rank==="boss").map(monster=>monster.name),["極帝天尊"]);
        assert.equal(final.some(monster=>["東帝","南帝","天帝","北帝"].includes(monster.name)),false);
    });
});

test("Lv20 HP targets are exact after pre-stage and boss-only multipliers",()=>{
    const {context}=makeContext();
    const expected=[[386,1236],[408,1304],[429,1373],[450,1442]];
    expected.forEach(([regularHp,eliteHp],stage)=>{
        const roster=json(context,`v174AbyssBuildRoster(20,0,${stage})`);
        assert.equal(roster[0].maxHP,regularHp);
        assert.equal(roster[5].maxHP,eliteHp);
    });
    const boss=json(context,"v174AbyssBuildRoster(20,0,4)");
    assert.equal(boss.find(monster=>monster.rank==="elite").maxHP,1510);
    assert.equal(boss.find(monster=>monster.rank==="boss").maxHP,3090);
});

test("Lv40 HP targets are exact after pre-stage and boss-only multipliers",()=>{
    const {context}=makeContext();
    const expected=[[644,2059],[679,2174],[715,2288],[751,2402]];
    expected.forEach(([regularHp,eliteHp],stage)=>{
        const roster=json(context,`v174AbyssBuildRoster(40,0,${stage})`);
        assert.equal(roster[0].maxHP,regularHp);
        assert.equal(roster[5].maxHP,eliteHp);
    });
    const boss=json(context,"v174AbyssBuildRoster(40,0,4)");
    assert.equal(boss.find(monster=>monster.rank==="elite").maxHP,2517);
    assert.equal(boss.find(monster=>monster.rank==="boss").maxHP,5149);
});

test("legacy fixed extraHP is absent and ordinary followers retain normal skill chance",()=>{
    const {context}=makeContext();
    const pre=json(context,"v174AbyssBuildRoster(20,0,3)");
    const boss=json(context,"v174AbyssBuildRoster(40,4,4)");
    pre.concat(boss).forEach(monster=>assert.equal(Object.prototype.hasOwnProperty.call(monster,"v141ExtraHP"),false));
    assert.equal(pre.every(monster=>monster.skillChance===.35),true);
    assert.equal(boss.filter(monster=>monster.rank==="elite").every(monster=>monster.skillChance===.35),true);
    assert.equal(boss.find(monster=>monster.rank==="boss").skillChance,.78);
});

test("victory spawns only a chest; claim unlocks portal and duplicate claims do not pay twice",()=>{
    const {context}=makeContext();
    vm.runInContext("v174AbyssSelectDifficulty(20)",context);
    vm.runInContext("v174AbyssResolveBattleResult('win')",context);
    let state=json(context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.battleCompleted,state.chestSpawned,state.chestClaimed,state.portalUnlocked,state.phase],[true,true,false,false,"chest"]);
    const before=Number(context.gold);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",context),true);
    state=json(context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.chestSpawned,state.chestClaimed,state.portalUnlocked,state.phase],[false,true,true,"portal"]);
    assert.equal(Number(context.gold),before+120);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",context),false);
    assert.equal(Number(context.gold),before+120);
});

test("reload restores an unclaimed chest and never regenerates a claimed chest",()=>{
    const first=makeContext();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win')",first.context);
    const pendingSnapshot=first.storage.snapshot();
    const pending=makeContext({storage:pendingSnapshot});
    let state=json(pending.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.phase,state.chestSpawned,state.chestClaimed,state.portalUnlocked],["chest",true,false,false]);
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssClaimChest()",pending.context);
    const claimedSnapshot=pending.storage.snapshot();
    const claimed=makeContext({storage:claimedSnapshot});
    state=json(claimed.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([state.phase,state.chestSpawned,state.chestClaimed,state.portalUnlocked],["portal",false,true,true]);
    assert.equal(vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssClaimChest()",claimed.context),false);
});

test("Lv20 and Lv40 progress are completely separate",()=>{
    const {context}=makeContext();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win');v174AbyssClaimChest();v174AbyssUsePortal()",context);
    const lv20=json(context,"v174AbyssGetRunState(20)");
    vm.runInContext("v174AbyssBackToSelection();v174AbyssSelectDifficulty(40);v174AbyssResolveBattleResult('win')",context);
    const lv40=json(context,"v174AbyssGetRunState(40)");
    assert.equal(lv20.encounterIndex,1);
    assert.equal(lv20.phase,"ready");
    assert.equal(lv40.encounterIndex,0);
    assert.equal(lv40.phase,"chest");
    assert.notDeepEqual(lv20.rewardClaims,lv40.rewardClaims);
});

test("a complete difficulty requires exactly 25 battle wins and final chest produces no sixth portal",()=>{
    const {context}=makeContext();
    vm.runInContext("v174AbyssSelectDifficulty(20)",context);
    let wins=0;
    while(true){
        let state=json(context,"v174AbyssGetRunState(20)");
        if(state.completed){ break; }
        assert.equal(state.phase,"ready");
        vm.runInContext("v174AbyssResolveBattleResult('win')",context); wins++;
        state=json(context,"v174AbyssGetRunState(20)");
        assert.equal(state.phase,"chest");
        assert.equal(state.portalUnlocked,false);
        vm.runInContext("v174AbyssClaimChest()",context);
        state=json(context,"v174AbyssGetRunState(20)");
        if(state.completed){
            assert.equal(state.portalUnlocked,false);
            break;
        }
        assert.equal(state.phase,"portal");
        assert.equal(state.portalUnlocked,true);
        vm.runInContext("v174AbyssUsePortal()",context);
    }
    const final=json(context,"v174AbyssGetRunState(20)");
    assert.equal(wins,25);
    assert.equal(final.completed,true);
    assert.deepEqual(final.completedRegions,[true,true,true,true,true]);
    assert.equal(Object.keys(final.completedStages).length,25);
});

test("legacy five-floor save migrates into Lv40 without overwriting fresh Lv20 state",()=>{
    const legacy={active:true,floor:2,phase:"chest",clears:1,x:42,y:61};
    const {context}=makeContext({storage:{v141_abyss_state:JSON.stringify(legacy)}});
    const root=json(context,"v174AbyssGetRootState()");
    assert.equal(root.legacyMigrated,true);
    assert.equal(root.runs[20].regionIndex,0);
    assert.equal(root.runs[20].encounterIndex,0);
    assert.equal(root.runs[20].active,false);
    assert.equal(root.runs[40].regionIndex,1);
    assert.equal(root.runs[40].encounterIndex,4);
    assert.equal(root.runs[40].phase,"chest");
    assert.equal(root.runs[40].chestSpawned,true);
});

test("selection and in-map UI expose both covers, lock state, five nodes and chest-pending state",()=>{
    const locked=makeContext({playerLevel:20});
    const selection=vm.runInContext("v174RenderAbyss()",locked.context);
    assert.match(selection,/data-difficulty="20"/);
    assert.match(selection,/data-difficulty="40"/);
    assert.match(selection,/Lv40 解鎖/);
    assert.match(selection,/assets\/dungeons\/abyss\/abyss-cover\.webp/);
    assert.match(selection,/assets\/dungeons\/abyss\/abyss-cover-v17343\.png/);
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win')",locked.context);
    const pending=vm.runInContext("v174RenderAbyss()",locked.context);
    assert.equal((pending.match(/v174-abyss-node /g)||[]).length,5);
    assert.match(pending,/current pending/);
    assert.match(pending,/寶箱待領/);
    assert.doesNotMatch(pending,/v174-abyss-portal/);
    assert.match(cssSource,/aspect-ratio:16\/9/);
    assert.match(cssSource,/\.v174-abyss-node\.boss/);
    assert.match(cssSource,/\.v174-abyss-portal\.boss-gate/);
});

test("daily dungeon dynamic level owner remains unchanged and separate from fixed Abyss levels",()=>{
    assert.match(v132Source,/function getDungeonMonsterLevel\(\)[\s\S]*?Math\.round\(maxLevel\*0\.70\+avgLevel\*0\.30\)/);
    assert.doesNotMatch(source,/v132GetDungeonMonsterLevel\s*\(/);
    assert.match(source,/monsterLevel:20/);
    assert.match(source,/monsterLevel:40/);
});

test("deprecated five-boss final roster and legacy extraHP are not present in the new public owner",()=>{
    assert.doesNotMatch(source,/\+\s*5000/);
    assert.doesNotMatch(source,/\+\s*2500/);
    assert.doesNotMatch(source,/\+\s*10000/);
    assert.doesNotMatch(source,/\+\s*3500/);
    assert.doesNotMatch(source,/\["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"\]/);
    const {context}=makeContext();
    const publicFinal=json(context,"v141BuildAbyssRoster(5)");
    assert.equal(publicFinal.filter(monster=>monster.rank==="boss").length,1);
    assert.deepEqual(publicFinal.filter(monster=>monster.rank==="boss").map(monster=>monster.name),["極帝天尊"]);
});

console.log(`All ${passed} two-tier Abyss refactor tests passed.`);
