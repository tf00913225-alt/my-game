"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/59-abyss-two-tier-runtime.js","utf8");
const v132Source=fs.readFileSync("js/27-v132-content-expansion.js","utf8");
const loaderSource=fs.readFileSync("js/19-stage-v78-character-inventory-runtime.js","utf8");
const cssSource=fs.readFileSync("css/50-v169-abyss-flow.css","utf8");

function storage(seed){
    const values=new Map(Object.entries(seed||{}).map(([k,v])=>[k,String(v)]));
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
function load(options){
    const opts=options||{};
    const localStorage=storage(opts.storage);
    const noop=()=>{};
    const document={readyState:"complete",getElementById:()=>null,querySelector:()=>null,addEventListener:noop};
    const context={
        console,JSON,Math:Object.create(Math),Date,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,Error,TypeError,
        parseInt,parseFloat,isNaN,localStorage,document,
        requestAnimationFrame:fn=>{ if(fn){ fn(); } return 1; },setTimeout:fn=>{ if(fn){ fn(); } return 1; },clearTimeout:noop,
        alert:noop,confirm:()=>true,player:{id:"qa",level:opts.playerLevel||50},player2:null,player3:null,gold:0,sharedExp:0,
        renderDungeonTabContent:()=>"legacy",currentDungeonTab:"daily",saveGame:noop,rebuildInventorySlots:noop,updateGoldDisplay:noop,
        showPage:noop,switchDungeonTab:noop,v133GetHighestCreatedCharacterLevel:()=>opts.playerLevel||50,
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
        v132LaunchDungeonBattle:()=>true
    };
    context.window=context;
    context.globalThis=context;
    vm.createContext(context);
    vm.runInContext(source,context,{filename:"js/59-abyss-two-tier-runtime.js"});
    return {context,localStorage};
}
function value(context,expression){ return JSON.parse(vm.runInContext("JSON.stringify("+expression+")",context)); }

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

test("late loader gives the two-tier Abyss the final public ownership",()=>{
    assert.match(loaderSource,/v17363-functional-fixes-runtime/);
    assert.match(loaderSource,/v174-abyss-two-tier-runtime/);
    assert.match(loaderSource,/js\/59-abyss-two-tier-runtime\.js/);
});

test("Abyss reuses the existing dungeon monster builder and battle launcher",()=>{
    assert.match(source,/window\.v132BuildDungeonMonster\(name,config\.monsterLevel,region\.element,rank\)/);
    assert.match(source,/window\.v132LaunchDungeonBattle\(roster/);
    assert.doesNotMatch(source,/function\s+calculateDamage\s*\(/);
    assert.match(v132Source,/function buildDungeonMonster\(name,level,element,rank\)/);
    assert.match(v132Source,/const DUNGEON_ELITE_MULTIPLIERS=\{maxHP:3\.20,maxSP:2\.00,defense:1\.25\}/);
    assert.match(v132Source,/const DUNGEON_BOSS_MULTIPLIERS=\{maxHP:4\.50,maxSP:2\.00,defense:1\.40\}/);
});

test("Lv20 remains monster level 20 for higher-level players and skills stay Lv1",()=>{
    [20,30,50].forEach(playerLevel=>{
        const {context}=load({playerLevel});
        for(let region=0;region<5;region++) for(let stage=0;stage<5;stage++){
            const roster=value(context,`v174AbyssBuildRoster(20,${region},${stage})`);
            assert.equal(roster.length,10);
            assert.equal(roster.every(monster=>monster.level===20),true);
            assert.equal(roster.every(monster=>monster.v141ForceSkillLevel===1),true);
        }
    });
});

test("Lv40 remains monster level 40 and every carried skill is forced to Lv2, never Lv5",()=>{
    const {context}=load({playerLevel:80});
    for(let region=0;region<5;region++) for(let stage=0;stage<5;stage++){
        const roster=value(context,`v174AbyssBuildRoster(40,${region},${stage})`);
        assert.equal(roster.every(monster=>monster.level===40),true);
        assert.equal(roster.every(monster=>monster.v141ForceSkillLevel===2),true);
        assert.equal(roster.some(monster=>monster.v141ForceSkillLevel===5),false);
    }
});

test("all four pre-stages are ten enemies: front five regular, back five elite",()=>{
    const {context}=load();
    [20,40].forEach(level=>{
        for(let region=0;region<5;region++) for(let stage=0;stage<4;stage++){
            const roster=value(context,`v174AbyssBuildRoster(${level},${region},${stage})`);
            assert.deepEqual(roster.map(monster=>monster.rank),[
                "regular","regular","regular","regular","regular","elite","elite","elite","elite","elite"
            ]);
            assert.deepEqual(roster.map(monster=>monster.v141FormationRow),[0,0,0,0,0,1,1,1,1,1]);
        }
    });
});

test("every boss stage is nine elite plus exactly one emperor in the visual core",()=>{
    const {context}=load();
    [20,40].forEach(level=>{
        for(let region=0;region<5;region++){
            const roster=value(context,`v174AbyssBuildRoster(${level},${region},4)`);
            assert.equal(roster.filter(monster=>monster.rank==="elite").length,9);
            assert.equal(roster.filter(monster=>monster.rank==="boss").length,1);
            const boss=roster.find(monster=>monster.rank==="boss");
            assert.equal(boss.v141FormationRow,0);
            assert.equal(boss.v141FormationPosition,2);
        }
    });
});

test("fifth region is Extreme Emperor plus nine elite, not five emperors",()=>{
    const {context}=load();
    [20,40].forEach(level=>{
        const roster=value(context,`v174AbyssBuildRoster(${level},4,4)`);
        assert.deepEqual(roster.filter(monster=>monster.rank==="boss").map(monster=>monster.name),["極帝天尊"]);
        assert.equal(roster.some(monster=>["東帝","南帝","天帝","北帝"].includes(monster.name)),false);
    });
});

test("Lv20 pre-stage and boss HP targets match the new fixed durability config",()=>{
    const {context}=load();
    [[386,1236],[408,1304],[429,1373],[450,1442]].forEach(([regularHp,eliteHp],stage)=>{
        const roster=value(context,`v174AbyssBuildRoster(20,0,${stage})`);
        assert.equal(roster[0].maxHP,regularHp);
        assert.equal(roster[5].maxHP,eliteHp);
    });
    const boss=value(context,"v174AbyssBuildRoster(20,0,4)");
    assert.equal(boss.find(monster=>monster.rank==="elite").maxHP,1510);
    assert.equal(boss.find(monster=>monster.rank==="boss").maxHP,3090);
});

test("Lv40 pre-stage and boss HP targets match the new fixed durability config",()=>{
    const {context}=load();
    [[644,2059],[679,2174],[715,2288],[751,2402]].forEach(([regularHp,eliteHp],stage)=>{
        const roster=value(context,`v174AbyssBuildRoster(40,0,${stage})`);
        assert.equal(roster[0].maxHP,regularHp);
        assert.equal(roster[5].maxHP,eliteHp);
    });
    const boss=value(context,"v174AbyssBuildRoster(40,0,4)");
    assert.equal(boss.find(monster=>monster.rank==="elite").maxHP,2517);
    assert.equal(boss.find(monster=>monster.rank==="boss").maxHP,5149);
});

test("new Abyss never carries legacy +2500/+5000/+3500/+10000 HP and followers keep normal skill chance",()=>{
    const {context}=load();
    const monsters=value(context,"v174AbyssBuildRoster(20,0,3).concat(v174AbyssBuildRoster(40,4,4))");
    monsters.forEach(monster=>assert.equal(Object.prototype.hasOwnProperty.call(monster,"v141ExtraHP"),false));
    assert.equal(monsters.filter(monster=>monster.rank!=="boss").every(monster=>monster.skillChance===.35),true);
    assert.doesNotMatch(source,/\+\s*(?:2500|5000|3500|10000)/);
});

test("victory creates a chest only; claiming it is the sole portal unlock and is idempotent",()=>{
    const {context}=load();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win')",context);
    let run=value(context,"v174AbyssGetRunState(20)");
    assert.deepEqual([run.phase,run.battleCompleted,run.chestSpawned,run.chestClaimed,run.portalUnlocked],["chest",true,true,false,false]);
    const goldBefore=Number(context.gold);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",context),true);
    run=value(context,"v174AbyssGetRunState(20)");
    assert.deepEqual([run.phase,run.chestSpawned,run.chestClaimed,run.portalUnlocked],["portal",false,true,true]);
    assert.equal(Number(context.gold),goldBefore+120);
    assert.equal(vm.runInContext("v174AbyssClaimChest()",context),false);
    assert.equal(Number(context.gold),goldBefore+120);
});

test("reload restores a pending chest and never recreates a claimed one",()=>{
    const first=load();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win')",first.context);
    const pending=load({storage:first.localStorage.snapshot()});
    let run=value(pending.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([run.phase,run.chestSpawned,run.portalUnlocked],["chest",true,false]);
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssClaimChest()",pending.context);
    const claimed=load({storage:pending.localStorage.snapshot()});
    run=value(claimed.context,"v174AbyssGetRunState(20)");
    assert.deepEqual([run.phase,run.chestSpawned,run.chestClaimed,run.portalUnlocked],["portal",false,true,true]);
    assert.equal(vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssClaimChest()",claimed.context),false);
});

test("Lv20 and Lv40 keep completely separate persisted run states",()=>{
    const {context}=load();
    vm.runInContext("v174AbyssSelectDifficulty(20);v174AbyssResolveBattleResult('win');v174AbyssClaimChest();v174AbyssUsePortal()",context);
    const lv20=value(context,"v174AbyssGetRunState(20)");
    vm.runInContext("v174AbyssBackToSelection();v174AbyssSelectDifficulty(40);v174AbyssResolveBattleResult('win')",context);
    const lv40=value(context,"v174AbyssGetRunState(40)");
    assert.deepEqual([lv20.regionIndex,lv20.encounterIndex,lv20.phase],[0,1,"ready"]);
    assert.deepEqual([lv40.regionIndex,lv40.encounterIndex,lv40.phase],[0,0,"chest"]);
    assert.notDeepEqual(lv20.rewardClaims,lv40.rewardClaims);
});

test("one difficulty completes only after all 25 battle/chest stages and final chest creates no sixth portal",()=>{
    const {context}=load();
    vm.runInContext("v174AbyssSelectDifficulty(20)",context);
    let wins=0;
    while(true){
        let run=value(context,"v174AbyssGetRunState(20)");
        if(run.completed){ break; }
        assert.equal(run.phase,"ready");
        vm.runInContext("v174AbyssResolveBattleResult('win')",context); wins++;
        run=value(context,"v174AbyssGetRunState(20)");
        assert.equal(run.portalUnlocked,false);
        vm.runInContext("v174AbyssClaimChest()",context);
        run=value(context,"v174AbyssGetRunState(20)");
        if(run.completed){ assert.equal(run.portalUnlocked,false); break; }
        assert.equal(run.portalUnlocked,true);
        vm.runInContext("v174AbyssUsePortal()",context);
    }
    const final=value(context,"v174AbyssGetRunState(20)");
    assert.equal(wins,25);
    assert.equal(final.completed,true);
    assert.equal(Object.keys(final.completedStages).length,25);
    assert.deepEqual(final.completedRegions,[true,true,true,true,true]);
});

test("legacy five-floor save migrates safely into Lv40 only",()=>{
    const legacy={active:true,floor:2,phase:"chest",clears:1,x:42,y:61};
    const {context}=load({storage:{v141_abyss_state:JSON.stringify(legacy)}});
    const root=value(context,"v174AbyssGetRootState()");
    assert.equal(root.legacyMigrated,true);
    assert.deepEqual([root.runs[20].active,root.runs[20].regionIndex,root.runs[20].encounterIndex],[false,0,0]);
    assert.deepEqual([root.runs[40].regionIndex,root.runs[40].encounterIndex,root.runs[40].phase,root.runs[40].chestSpawned],[1,4,"chest",true]);
});

test("selection UI renders both equal-ratio covers, locked Lv40, progress HUD and five nodes",()=>{
    const locked=load({playerLevel:20});
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
    assert.match(pending,/寶箱(?:・)?待領|寶箱位置領取/);
    assert.match(pending,/1 \/ 5/);
    assert.doesNotMatch(pending,/class="v141-abyss-portal v174-abyss-portal/);
    assert.match(cssSource,/aspect-ratio:16\/9/);
    assert.match(cssSource,/\.v174-abyss-node\.boss/);
    assert.match(cssSource,/\.v174-abyss-portal\.boss-gate/);
});

test("daily dungeon dynamic-level calculation remains owned by v132 and untouched by Abyss",()=>{
    assert.match(v132Source,/function getDungeonMonsterLevel\(\)[\s\S]*?Math\.round\(maxLevel\*0\.70\+avgLevel\*0\.30\)/);
    assert.doesNotMatch(source,/v132GetDungeonMonsterLevel\s*\(/);
    assert.match(source,/monsterLevel:20/);
    assert.match(source,/monsterLevel:40/);
});

test("legacy public Abyss entry points now resolve to the one-boss current roster",()=>{
    const {context}=load();
    const final=value(context,"v141BuildAbyssRoster(5)");
    assert.equal(final.filter(monster=>monster.rank==="boss").length,1);
    assert.deepEqual(final.filter(monster=>monster.rank==="boss").map(monster=>monster.name),["極帝天尊"]);
    assert.doesNotMatch(source,/\["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"\]/);
});

console.log(`All ${passed} two-tier Abyss refactor tests passed.`);
