/* HISTORICAL SPEC SNAPSHOT (V143): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const rules=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const dungeon=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const system=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

test("V143 assets stay ordered before later patches under the current cache version",()=>{
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.32/);
    assert.match(loader,/const V_ASSET_VERSION="173\.32"/);
    assert.match(loader,/css\/40-v143-combat-dungeon-polish\.css/);
    const order=[
        "js/37-v142-skill-animation.js",
        "js/38-v143-system-fixes.js",
        "js/39-v143-skill-animation.js",
        "js/40-v144-rules-and-abyss.js",
        "js/41-v146-system-polish.js"
    ].map(path=>loader.indexOf(path));
    assert.ok(order.every(value=>value>=0));
    assert.deepEqual(order.slice().sort((a,b)=>a-b),order);
});

test("enemy identity starts at 16px, never drops below 12px and bars use 12px bold text",()=>{
    assert.match(system,/monster\.name\+" Lv"\+monster\.level/);
    assert.match(system,/let size=16/);
    assert.match(system,/while\(size>12/);
    assert.match(css,/\.battle-monster-name\.v143-monster-identity[\s\S]*font-size:16px !important/);
    assert.match(css,/\.monster-bar-text[\s\S]*font-size:12px !important;[\s\S]*font-weight:900/);
    assert.match(css,/width:76px !important;[\s\S]*height:100px !important/);
});

test("every known battle skill has its own animation choreography",()=>{
    const context={
        window:null,navigator:{deviceMemory:4,hardwareConcurrency:4},
        document:{querySelectorAll:()=>[],body:{},getElementById:()=>null},
        setTimeout,clearTimeout,Promise,console
    };
    context.window=context;
    context.v142SkillAnimationDirector={
        play(){ return {done:false,promise:new Promise(()=>{}),complete(){ this.done=true; }}; },
        dispose(){},getActive(){ return null; }
    };
    vm.createContext(context);
    vm.runInContext(animation,context);
    const expected=[
        "normal","flameSlash","fireCritical","explosiveFlurry","dragonSlash","fireRocket","blazeSpell","flameTornado","phoenixCry","rage","fireEX",
        "waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain","freeze","healSpell","revive","waterEX",
        "stormFist","stormFlurry","windCrossSlash","dizzyFist","windSpell","stormCircle","windHowlLightning","stormRain","dodgeSkill","stealthSkill","dinghaishenzhen","windEX",
        "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush","stoneThrow","sandWind","flyingSandStrike","dustStorm","earthShield","rockWall","barrier","earthEX",
        "stormSpell","yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing","windArrow"
    ];
    expected.forEach(id=>assert.ok(context.v143SkillAnimationManifest[id],id+" needs a manifest entry"));
    const choreographies=expected.map(id=>JSON.stringify(context.v143SkillAnimationManifest[id]));
    assert.equal(new Set(choreographies).size,expected.length,"known skills may not share an identical choreography");
});

test("skill names are brief caster labels and hit numbers wait for the target frame",()=>{
    assert.match(css,/#v142-skill-stage\{display:none !important;\}/);
    assert.match(animation,/font-size","15px","important/);
    assert.match(css,/animation:v143CasterLabel var\(--skill-name-display-duration,347ms\)/);
    assert.doesNotMatch(animation,/badge\.remove\(\); \} \},650/);
    assert.match(animation,/state\.metrics\.delayedNumbers\+\+/);
    assert.match(animation,/targetHitTime\(current,index\)-Date\.now\(\)/);
    assert.match(animation,/gate\.complete\(reason\|\|"v143-animation-complete"\)/);
    assert.doesNotMatch(animation,/font-size","72px/);
});

test("the three revised skills and hard-control caps match the requested values",()=>{
    assert.match(system,/storm\.spCost=75/);
    assert.match(system,/rain\.spCost=75/);
    assert.match(system,/rain\.freezeChance=50/);
    assert.match(system,/rain\.freezeDuration=2/);
    assert.match(system,/rain\.freezeSingleTarget=false/);
    assert.match(system,/freeze\.freezeChance=80/);
    assert.match(system,/freeze\.freezeDuration=4/);
    assert.match(rules,/regular:\{min:5,max:80\}/);
    assert.match(rules,/elite:\{min:5,max:60\}/);
    assert.match(rules,/boss:\{min:5,max:40\}/);
});

test("V143 rule patch applies the requested skill metadata at runtime",()=>{
    const context={
        window:null,console,Math,Date,Event:function(){},
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},
        document:{
            readyState:"complete",body:{},getElementById:()=>null,
            querySelector:()=>null,querySelectorAll:()=>[]
        },
        skillDatabase:{
            stormRain:{},iceArrowRain:{},freeze:{},barrier:{barrierBlockCount:5}
        }
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(system,context);
    const snapshot=context.v143CombatRuleSnapshot();
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot.lockdownCaps)),{regular:80,elite:60,boss:40});
    assert.equal(snapshot.stormRain.spCost,75);
    assert.equal(snapshot.iceArrowRain.spCost,75);
    assert.equal(snapshot.iceArrowRain.freezeChance,50);
    assert.equal(snapshot.iceArrowRain.freezeSingleTarget,false);
    assert.equal(snapshot.freeze.freezeChance,80);
});

test("Ice Arrow Rain rolls Freeze independently for every living target after damage",()=>{
    let originalFreezeChance=null;
    let frozen=0;
    const caster={level:30,sp:200,hp:500};
    const context={
        window:null,console,Math,Date,Event:function(){},selectedMonster:0,
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},
        document:{readyState:"complete",body:{},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},
        skillDatabase:{stormRain:{},iceArrowRain:{freezeChance:50,freezeDuration:2},freeze:{},barrier:{barrierBlockCount:5}},
        monsters:[
            {name:"甲",alive:true,hp:100,level:20,spiritPoints:0},
            {name:"乙",alive:true,hp:100,level:20,spiritPoints:0},
            {name:"丙",alive:true,hp:100,level:20,spiritPoints:0}
        ],
        getSkillTargets:()=>[0,1,2],findAliveTargetIndex:index=>index,
        getPartyCharacterByIndex:()=>caster,getPartyBattleStats:()=>({intelligence:80}),
        getMonsterEffectiveSpiritPoints:()=>0,getMonsterRank:()=>"regular",
        rollStatusEffectHit:()=>true,applyFreezeEffect(){ frozen++; },addBattleLog(){},updateMonsterUI(){},
        castDamageSkill(){ originalFreezeChance=this.skillDatabase.iceArrowRain.freezeChance; caster.sp-=75; }
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(system,context);
    context.castDamageSkill("iceArrowRain");
    assert.equal(originalFreezeChance,0,"the legacy per-target Freeze loop must be disabled");
    assert.equal(frozen,3,"every successfully rolled target receives Freeze");
    assert.equal(context.skillDatabase.iceArrowRain.freezeChance,50,"metadata must be restored after the cast");
});

test("dungeon escape restores its owner and Abyss portrait opens dialogue directly",()=>{
    const escapeBlock=system.slice(system.indexOf("if(typeof resolveEscapeAttempt"),system.indexOf("/* ----- 4 / 5."));
    assert.match(escapeBlock,/monsters=run\.previousMonsters/);
    assert.match(escapeBlock,/currentZone=run\.previousZone/);
    assert.match(escapeBlock,/run\.onComplete\(\{result:"escape"\}\)/);
    assert.doesNotMatch(escapeBlock,/showPage\("map"\)/);
    assert.match(dungeon,/Math\.max\(4,Math\.min\(96/);
    assert.match(dungeon,/Math\.max\(8,Math\.min\(94/);
    assert.match(css,/\.v141-abyss-map\{height:auto !important;min-height:0 !important;flex:1 1 auto !important;\}/);
    assert.match(dungeon,/function openAbyssBossDialogue\(\)[\s\S]*?點擊對話繼續/);
    assert.match(dungeon,/window\.v141ChallengeAbyssBoss=function\(\)[\s\S]*?return openAbyssBossDialogue\(\);/);
    assert.doesNotMatch(system,/v141ChallengeAbyssBoss=function/);
});

test("dungeon nav is in the scaled shell with exactly the five requested destinations",()=>{
    const navBlock=system.slice(system.indexOf("function fixDungeonNavigation"),system.indexOf("const ABYSS_DIALOGUE"));
    ["角色","背包","商店","元素匣","返回"].forEach(label=>assert.match(navBlock,new RegExp('aria-label="'+label+'"')));
    assert.match(navBlock,/content\.appendChild\(nav\)/);
    assert.match(navBlock,/oldReturn\.remove\(\)/);
    assert.doesNotMatch(navBlock,/aria-label="任務"/);
    assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});

test("synthesis is icon-first and creates ordinary random gear without a set ID",()=>{
    assert.match(system,/className="v143-item-picker"/);
    assert.match(system,/iconForPickerValue/);
    assert.match(system,/v143NormalCraft:true/);
    assert.match(system,/delete item\.setId/);
    assert.match(system,/系統隨機生成的普通裝備，不屬於四大套裝/);
    assert.match(css,/\.v143-item-picker i,[\s\S]*width:48px;height:48px/);
});

test("earth shield, ally targeting and both-side Barrier use their distinct rules",()=>{
    assert.match(system,/effect\.innerHTML="<i><\/i><i><\/i><i><\/i><i><\/i><b>象<\/b>"/);
    assert.match(css,/border-color:#ff4e48/);
    assert.match(css,/border-color:#ffe15b/);
    assert.match(css,/border-color:#65ed7e/);
    assert.match(css,/border-color:#5ba8ff/);
    assert.match(css,/\.battle-player\.ally-targetable::after/);
    assert.match(system,/targetAlly:index/);
    assert.match(system,/monster\.v141Shield\.remainingBlocks=5/);
    assert.match(system,/DOT bypasses Barrier without consuming a block/);
});

test("monster Barrier dynamically blocks a direct hit and consumes exactly one charge",()=>{
    let visualHits=0;
    const context={
        window:null,console,Math,Date,Event:function(){},
        setTimeout:callback=>{ callback(); return 1; },clearTimeout(){},
        document:{
            readyState:"complete",body:{},getElementById:()=>null,
            querySelector:()=>null,querySelectorAll:()=>[]
        },
        skillDatabase:{barrier:{barrierBlockCount:5}},
        currentBattleMonsters:[0],monsters:[],
        addBattleLog(){},showMonsterHit(){ visualHits++; },
        v141ApplyMonsterShield(monster,amount,turns){
            const shield={type:"shield",amount,remaining:amount,turnsLeft:turns,baseMaxHP:monster.maxHP,baseHp:monster.hp};
            monster.maxHP+=amount; monster.hp+=amount; monster.v141Shield=shield; monster.activeBuffs=[shield];
        }
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(system,context);
    const monster={name:"東帝",alive:true,maxHP:100,hp:100,activeBuffs:[]};
    context.monsters[0]=monster;
    context.v141ApplyMonsterShield(monster,999999,4);
    assert.equal(monster.v141Shield.amount,1,"Barrier must not fake a million-point HP shield");
    assert.equal(monster.v141Shield.turnsLeft,5);
    assert.equal(monster.v141Shield.remainingBlocks,5);
    monster.hp=0;
    context.v143SkillAnimationState={current:{side:"player",done:false}};
    context.showMonsterHit(0,150,"hp");
    assert.equal(monster.hp,101);
    assert.equal(monster.v141Shield.remainingBlocks,4);
    assert.equal(visualHits,0,"blocked direct damage must not show a red damage hit");
});

console.log("\nV143 combat/dungeon polish suite: "+passed+" tests passed.");
