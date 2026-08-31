"use strict";

/* HISTORICAL SPEC SNAPSHOT (V158): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const css=fs.readFileSync("css/47-v158-combat-tuning.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function skills(){
    return {
        rage:{
            id:"rage",requires:["explosiveFlurry","flameTornado"],targetType:"allyTri",
            spCost:50,duration:2,critChanceBonusByLevel:[5,10,15,20,25],
            critDamageBonusByLevel:[10,20,30,40,50]
        },
        freeze:{
            id:"freeze",name:"冰封",element:"water",requires:["iceArrowRain"],
            targetType:"single",spCost:22,freezeChance:80,freezeDuration:4
        },
        healSpell:{
            id:"healSpell",requires:["iceArrowRain","iceSpin"],targetType:"allyAll",
            baseHeal:350,healPerLevel:30,baseHealSP:35,healSPPerLevel:30,spCost:40
        }
    };
}

function load(overrides={}){
    const math=Object.create(Math);
    const context=Object.assign({
        window:null,console,Math:math,Number,Object,Array,Set,Map,Promise,
        skillDatabase:skills(),monsters:[],zoneConfig:{},
        document:{querySelector:()=>null},
        setTimeout:callback=>{ callback(); return 1; },
        rollHitChance(){ return false; },
        calculateDamage(){ return 0; },
        getElementalDamageMultiplier:()=>1,
        getMonsterEvasion:monster=>monster.evasion,
        makeZoneMonster:(name,level)=>({name,level,agilityPoints:level,evasion:level*2})
    },overrides);
    context.window=context;
    vm.createContext(context);
    vm.runInContext(source,context);
    return context;
}

test("V158 and V159 remain ordered before the final V169 runtimes",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.8"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.8/);
    assert.match(loader,/css\/47-v158-combat-tuning\.css/);
    const v155=loader.indexOf("js/46-v155-dev-fixes.js");
    const v158=loader.indexOf("js/47-v158-combat-tuning.js");
    const v159=loader.indexOf("js/48-v159-abyss-battle-portraits.js");
    const v169ElementBox=loader.indexOf("js/49-v169-element-box-settings.js");
    const v169Water=loader.indexOf("js/50-v169-water-skill-rules.js");
    const v169Ui=loader.indexOf("js/51-v169-rpg-ui.js");
    assert.ok(
        v155>=0&&v158>v155&&v159>v158&&
        v169ElementBox>v159&&v169Water>v169ElementBox&&v169Ui>v169Water
    );
});

test("Rage, Freeze and Heal expose the requested final values",()=>{
    const result=load().skillDatabase;
    assert.deepEqual(
        [result.rage.targetType,result.rage.spCost,result.rage.duration],
        ["allyTri",65,4]
    );
    assert.deepEqual(Array.from(result.rage.requires),["explosiveFlurry","flameTornado"]);
    assert.deepEqual(
        [result.freeze.targetType,result.freeze.spCost,result.freeze.freezeChance,result.freeze.freezeDuration],
        ["tri",66,80,4]
    );
    assert.deepEqual(Array.from(result.freeze.requires),["iceArrowRain"]);
    assert.deepEqual(
        [result.healSpell.targetType,result.healSpell.baseHeal,result.healSpell.healPerLevel,
            result.healSpell.baseHealSP,result.healSpell.healSPPerLevel,result.healSpell.spCost],
        ["allyAll",550,30,65,30,45]
    );
    assert.deepEqual(Array.from(result.healSpell.requires),["iceArrowRain","iceSpin"]);
});

test("normal hit chance is 80 to 99 while direct hit debuffs can reach 60",()=>{
    const context=load();
    assert.equal(context.v158GetHitChancePercent(0,0,0),95);
    assert.equal(context.v158GetHitChancePercent(10,0,0),98);
    assert.equal(context.v158GetHitChancePercent(0,10,0),92);
    assert.equal(context.v158GetHitChancePercent(0,1000,0),80);
    assert.equal(context.v158GetHitChancePercent(0,1000,50),60);
    assert.equal(context.v158GetHitChancePercent(1000,0,0),99);
});

test("default monster evasion becomes level times 0.5 without replacing custom evasion",()=>{
    const existing={level:20,agilityPoints:12,evasion:24};
    const custom={level:20,agilityPoints:12,evasion:37};
    const context=load({
        monsters:[existing,custom],
        zoneConfig:{forest:{monsters:()=>[existing,custom]}}
    });
    assert.equal(existing.evasion,10);
    assert.equal(custom.evasion,37);
    assert.equal(context.getMonsterEvasion({level:30}),15);
    assert.equal(context.makeZoneMonster("測試怪",40).evasion,20);
});

test("damage variance is 95 to 105 percent and uses rounding",()=>{
    const context=load();
    context.Math.random=()=>0;
    assert.equal(context.calculateDamage(100,0,10,10,"fire","fire"),95);
    context.Math.random=()=>0.5;
    assert.equal(context.calculateDamage(100,0,10,10,"fire","fire"),100);
    context.Math.random=()=>0.999999;
    assert.equal(context.calculateDamage(100,0,10,10,"fire","fire"),105);
    context.Math.random=()=>0.5;
    assert.equal(context.calculateDamage(100,350,10,10,"fire","fire"),50);
});

test("secondary Freeze resolves all three selected formation targets",()=>{
    const partyMember={id:"水系角色",level:50,sp:100};
    const targets=[0,1,2].map(index=>({name:"目標"+index,level:50,hp:100,alive:true,rank:"regular"}));
    let finishes=0;
    const context=load({
        monsters:targets,selectedMonster:1,
        getPartyCharacterByIndex:()=>partyMember,
        getPartyCharacterKey:()=>"player2",
        getPartyBattleStats:()=>({intelligence:80}),
        getSkillLevel:()=>1,
        findAliveTargetIndex:index=>index,
        getSkillTargets:()=>[0,1,2],
        getMonsterEffectiveSpiritPoints:()=>0,
        getMonsterRank:monster=>monster.rank,
        rollStatusEffectHit:()=>true,
        applyFreezeEffect:(monster,duration)=>{ monster.frozenFor=duration; },
        lungePlayerCard(){},showSkillNameBadge(){},showPlayerSpPopup(){},
        addBattleLog(){},showMissEffect(){},updateUI(){},
        finishPlayerAction(){ finishes++; },
        castSecondaryCharacterSkill(){ throw new Error("old single-target path must not run"); }
    });
    context.castSecondaryCharacterSkill(1,"freeze",1);
    assert.deepEqual(targets.map(target=>target.frozenFor),[4,4,4]);
    assert.equal(partyMember.sp,34);
    assert.equal(finishes,1);
});

test("Abyss map portraits have no frame or black card background",()=>{
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*border:0 !important;[\s\S]*background:transparent !important;[\s\S]*box-shadow:none !important;/);
    assert.match(css,/\.v141-abyss-boss::before\{[\s\S]*mix-blend-mode:screen !important;/);
    assert.match(css,/\.v141-abyss-boss b\{[\s\S]*background:transparent !important;/);
});

console.log("\nV158 combat tuning suite: "+passed+" tests passed.");
