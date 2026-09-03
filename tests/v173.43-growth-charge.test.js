"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const growth=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const flow=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const battleExp=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const offline=fs.readFileSync("js/34-v141-core-systems.js","utf8");
const dungeon=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const elementBox=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const elementBoxCss=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");
const polishCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");

const KEY="v173_exp_pool_growth_state";
const DAY=86400000;

function harness(options={}){
    let now=Number(options.now)||1_000_000_000;
    const store=new Map();
    if(options.state){ store.set(KEY,JSON.stringify(options.state)); }
    const levels=options.levels||[1];
    const players=levels.map((level,index)=>({
        id:"角色"+(index+1),element:index===0?"fire":index===1?"water":"wind",
        level,exp:0,expNext:100,attributePoints:0,skillPoints:0,bonusHP:0,bonusSP:0
    }));
    const blank={id:"",level:1,exp:0,expNext:100,attributePoints:0,skillPoints:0,bonusHP:0,bonusSP:0};
    const alerts=[];
    class FakeDate extends Date{ static now(){ return now; } }
    const context=vm.createContext({
        console,Math,Number,String,Object,Array,JSON,Infinity,WeakMap,Map,Set,Date:FakeDate,
        localStorage:{
            getItem:key=>store.has(key)?store.get(key):null,
            setItem:(key,value)=>store.set(key,String(value)),
            removeItem:key=>store.delete(key)
        },
        player:players[0]||blank,player2:players[1]||null,player3:players[2]||null,
        sharedExp:Number(options.sharedExp)||0,zoneConfig:{},
        getMonsterRank:monster=>monster&&monster.rank||"regular",
        getExistingPartyIndexes:()=>players.map((_,index)=>index),
        getPartyCharacterByIndex:index=>players[index]||null,
        saveGame(){},updateUI(){},alert(message){alerts.push(String(message));},
        setTimeout:()=>1,setInterval:()=>1
    });
    context.window=context;
    context.window.addEventListener=()=>{};
    vm.runInContext(growth,context);
    return {
        context,alerts,
        setNow:value=>{now=Number(value);},getNow:()=>now,
        state:()=>JSON.parse(store.get(KEY)||"{}")
    };
}

let passed=0;
function test(name,fn){fn();passed++;console.log("✓ "+name);}

/* User-requested minimum growth/charge checks 1–34. */
test("1. Lv1–19 has no natural charge",()=>{
    const h=harness({levels:[19]});h.setNow(h.getNow()+DAY);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,0);
    assert.equal(h.context.v173GetExpPoolChargeState().unlocked,false);
});

test("2. Lv20 unlocks and shows the unlock notice only once",()=>{
    const h=harness({levels:[20]});
    assert.equal(h.context.v173GetExpPoolChargeState().unlocked,true);
    h.context.v173EnsureExpPoolChargeUnlocked(h.getNow(),true);
    h.context.v173EnsureExpPoolChargeUnlocked(h.getNow(),true);
    assert.equal(h.alerts.length,1);assert.match(h.alerts[0],/持續充能已解鎖/);
});

test("3. Lv1→20 total requirement is 37,950 EXP",()=>{
    assert.equal(harness().context.v173GetBeginnerGrowthAudit().totalExpTo20,37950);
});

test("4. newcomer estimate sits in the 20–30 minute target",()=>{
    const audit=harness().context.v173GetBeginnerGrowthAudit();
    assert.equal(audit.newcomerOneTimeExp,6000);
    const battles=Math.ceil(5850/617)+Math.ceil((audit.totalExpTo20-6000-5850)/3255);
    const minutes=battles+6;
    assert.ok(battles>=14&&battles<=20);assert.ok(minutes>=20&&minutes<=30);
});

test("5. online elapsed time accrues by timestamp difference",()=>{
    const h=harness({levels:[20]});h.setNow(h.getNow()+DAY/2);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,5200);
});

test("6. offline reopen settles timestamp-based charge",()=>{
    const base=2_000_000_000;
    const h=harness({levels:[20],now:base+DAY,state:{initialized:true,unlocked:true,lastAt:base,noticeShown:true,lastCapped:false,newcomerRewards:{}}});
    assert.equal(h.context.sharedExp,10400);
});

test("7. charge accrues without entering the EXP page",()=>{
    const h=harness({levels:[30]});h.setNow(h.getNow()+DAY);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,Math.floor(60000*h.context.v173GetNaturalChargeLevelsPerDay(30)));
});

test("8. the four-second UI timer never mutates authoritative sharedExp",()=>{
    const timer=growth.match(/setInterval\(\(\)=>\{[\s\S]*?\},4000\)/);assert.ok(timer);
    assert.doesNotMatch(timer[0],/sharedExp\s*[+\-]?=/);
});

test("9. reopen authority is persisted lastAt",()=>{
    assert.match(growth,/timestamp-growthState\.lastAt/);assert.match(growth,/persistGrowthState/);
});

test("10. natural charge caps at 72 hours",()=>{
    const h=harness({levels:[20]});h.setNow(h.getNow()+5*DAY);
    const p=h.context.v173PreviewExpPoolCharge();
    assert.equal(p.elapsedMs,72*3600000);assert.equal(p.gain,31200);assert.equal(p.capped,true);
});

test("11. 72h cap does not cap the shared pool itself",()=>{
    const h=harness({levels:[20],sharedExp:9_999_999});h.setNow(h.getNow()+5*DAY);
    assert.equal(h.context.v173GetAvailableExpPool(),9_999_999+31200);
});

test("12. clock rollback produces zero gain",()=>{
    const h=harness({levels:[20]});const base=h.getNow();h.setNow(base-3600000);
    assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),0);
});

test("13. clock rollback does not move the baseline backward",()=>{
    const h=harness({levels:[20]});const base=h.getNow();h.setNow(base-3600000);
    h.context.v173SettleExpPoolCharge(h.getNow());assert.equal(h.state().lastAt,base);
    h.setNow(base+3600000);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),Math.floor(10400/24));
});

test("14. old save initializes at current time safely",()=>{
    const h=harness({levels:[20],sharedExp:777});assert.equal(h.context.sharedExp,777);assert.equal(h.state().lastAt,h.getNow());
});

test("15. first initialization grants no retroactive windfall",()=>{
    const h=harness({levels:[80],sharedExp:123});assert.equal(h.context.sharedExp,123);assert.equal(h.context.v173PreviewExpPoolCharge().gain,0);
});

test("16. representative charge rates are smooth and monotonic",()=>{
    const h=harness({levels:[99]});
    const rates=[20,30,40,49,50,60,70,80,90,95,99].map(l=>h.context.v173GetNaturalChargeLevelsPerDay(l));
    assert.deepEqual(rates.map(v=>Number(v.toFixed(3))),[1.3,1.274,1.227,1.02,1,0.895,0.787,0.653,0.498,0.408,0.32]);
    for(let i=1;i<rates.length;i++){assert.ok(rates[i]<=rates[i-1]);}
});

test("17. Lv49→50 has no cliff",()=>{
    const h=harness({levels:[50]});
    assert.ok(h.context.v133GetExpNextForLevel(50)/h.context.v133GetExpNextForLevel(49)<1.10);
    assert.ok(h.context.v173GetNaturalChargeLevelsPerDay(50)/h.context.v173GetNaturalChargeLevelsPerDay(49)>.95);
});

test("18. Lv50+ slows progressively rather than halving",()=>{
    const h=harness({levels:[99]});
    const rates=[50,60,70,80,90,99].map(l=>h.context.v173GetNaturalChargeLevelsPerDay(l));
    for(let i=1;i<rates.length;i++){assert.ok(rates[i]<rates[i-1]);assert.ok(rates[i]/rates[i-1]>.60);}
});

test("19. daily task package is 70% of added shared-pool growth EXP",()=>{
    const b=harness({levels:[50]}).context.v173GetDailyGrowthRewardBreakdown(50);
    assert.equal(b.totalExp,148350);assert.equal(b.taskExp,103845);assert.equal(Number((b.taskExp/b.totalExp).toFixed(2)),.70);
    assert.match(growth,/reward\.exp=lateState\.rewardBases\.get\(reward\)\+extra/);
});

test("20. final daily chest owns the remaining 30%",()=>{
    const b=harness({levels:[50]}).context.v173GetDailyGrowthRewardBreakdown(50);
    assert.equal(b.chestExp,44505);assert.equal(b.taskExp+b.chestExp,b.totalExp);
    assert.match(growth,/type==="daily"&&Number\(threshold\)===100/);
});

test("21. shared EXP remains freely allocatable, not auto-split",()=>{
    assert.match(growth,/getExistingPartyIndexes\(\)\.slice\(0,3\)/);assert.doesNotMatch(growth,/sharedExp\s*\/\s*3/);
});

test("22. allocation cost uses each character's current requirement",()=>{
    assert.match(growth,/expNext-exp/);assert.match(growth,/expNext=getExpNextForLevel\(level\)/);
});

test("23. catch-up gap 10–19 = ×1.15",()=>{assert.equal(harness({levels:[50,40]}).context.v173GetExpPoolCatchUpMultiplierForLevel(40),1.15);});
test("24. catch-up gap 20–29 = ×1.30",()=>{assert.equal(harness({levels:[50,30]}).context.v173GetExpPoolCatchUpMultiplierForLevel(30),1.30);});
test("25. catch-up gap 30+ = ×1.50",()=>{assert.equal(harness({levels:[50,20]}).context.v173GetExpPoolCatchUpMultiplierForLevel(20),1.50);});

test("26. catch-up is isolated from monster/offline/dungeon EXP",()=>{
    assert.doesNotMatch(battleExp,/v173GetExpPoolCatchUpMultiplier/);assert.doesNotMatch(offline,/v173GetExpPoolCatchUpMultiplier/);assert.doesNotMatch(dungeon,/v173GetExpPoolCatchUpMultiplier/);
});

test("27. Lv100 cannot consume pool EXP",()=>{
    assert.match(growth,/character&&\(Number\(character\.level\)\|\|1\)>=MAX_CHARACTER_LEVEL/);assert.match(growth,/已達 Lv\."\+MAX_CHARACTER_LEVEL\+" 滿等/);
});

test("28. level-up red dot accounts for partial EXP, catch-up and pending natural charge",()=>{
    assert.match(flow,/numeric\(character\.expNext\)-Math\.max\(0,numeric\(character\.exp\)\)/);assert.match(flow,/v173GetExpPoolCatchUpMultiplierForLevel/);assert.match(flow,/v173GetAvailableExpPool/);
});

test("29. entering the page never clears EXP guidance",()=>{assert.doesNotMatch(flow,/canLevel\s*=\s*false/);assert.doesNotMatch(flow,/exp.*read/i);});
test("30. EXP guidance disappears only when pool cost is no longer met",()=>{assert.match(flow,/return available>=poolCost/);});

test("31. attribute, skill upgrade/learn and unequipped-skill reminders coexist",()=>{
    assert.match(flow,/hasAttributePoints/);assert.match(flow,/canSpend/);assert.match(flow,/canEquip/);assert.match(flow,/已學習但尚未裝備/);
});

test("32. existing offline EXP remains separate",()=>{
    assert.match(offline,/calculateOfflineExpSince/);assert.match(offline,/pendingOfflineExp/);assert.doesNotMatch(growth,/pendingOfflineExp\s*[+\-]?=/);
});

test("33. the same natural interval cannot settle twice",()=>{
    const h=harness({levels:[20]});h.setNow(h.getNow()+DAY);
    assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),10400);assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),0);
});

test("34. +EXP float is visual only",()=>{
    const block=growth.match(/function syncChargeUi\(animate\)\{[\s\S]*?window\.v173SyncExpPoolChargeUi=syncChargeUi/);assert.ok(block);
    assert.match(block[0],/v173-exp-charge-float/);assert.doesNotMatch(block[0],/sharedExp\s*\+=/);
});

/* Same-request UI/difficulty regressions. */
test("Element Box open is silent; attempted setting interaction owns the warning",()=>{
    assert.doesNotMatch(elementBox,/afterOpen[\s\S]*setTimeout\(notifyLocked/);assert.match(elementBox,/bindLockedInteractionGuard/);assert.match(elementBox,/notifyLocked\(\)/);
});
test("Element Box has no scroll owner",()=>{
    assert.match(elementBoxCss,/body\.v162-element-box-settings-open #homeFeatureModal\{[\s\S]*overflow:hidden !important/);assert.match(elementBoxCss,/#homeFeatureModalBody\{[\s\S]*overflow:hidden !important/);
});
test("red dots stay fully bright",()=>{
    assert.match(polishCss,/\.v146-growth-attention-target\{[\s\S]*opacity:1 !important;[\s\S]*filter:none !important/);assert.match(polishCss,/\.v146-growth-guidance-dot\{[\s\S]*opacity:1 !important/);
});
test("three-character home HUD is enlarged but remains three columns",()=>{
    assert.match(polishCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(polishCss,/grid-template-columns:36px minmax\(0,1fr\)/);assert.match(polishCss,/height:64px/);assert.match(polishCss,/width:36px;height:36px/);
});
test("ordinary daily dungeons are 25% core stats and Abyss stays excluded",()=>{
    assert.match(dungeon,/v17342DailyDungeonStatsHalvedAgain/);assert.match(dungeon,/monster\.v141Abyss===true/);
});

console.log("\n"+passed+" V173.43 formal growth/charge checks passed.");
