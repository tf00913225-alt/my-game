"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const growthSource=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");
const flowSource=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const battleExpSource=fs.readFileSync("js/25-v131-fix-batch.js","utf8");
const offlineSource=fs.readFileSync("js/34-v141-core-systems.js","utf8");
const dungeonSource=fs.readFileSync("js/47-v158-combat-tuning.js","utf8");
const elementBoxSource=fs.readFileSync("js/49-v169-element-box-settings.js","utf8");
const elementBoxCss=fs.readFileSync("css/48-v169-element-box-settings.css","utf8");
const polishCss=fs.readFileSync("css/42-v146-system-polish.css","utf8");

const GROWTH_KEY="v173_exp_pool_growth_state";
const DAY=24*60*60*1000;

function makeHarness(options={}){
    let now=Number(options.now)||1_000_000_000;
    const storage=new Map();
    if(options.state){ storage.set(GROWTH_KEY,JSON.stringify(options.state)); }
    const levels=options.levels||[1];
    const players=levels.map((level,index)=>({
        id:"角色"+(index+1),element:index===0?"fire":index===1?"water":"wind",
        level,exp:0,expNext:100,attributePoints:0,skillPoints:0,bonusHP:0,bonusSP:0
    }));
    const placeholder={id:"",level:1,exp:0,expNext:100,attributePoints:0,skillPoints:0,bonusHP:0,bonusSP:0};
    const alerts=[];
    let saves=0;
    class FakeDate extends Date{ static now(){ return now; } }
    const context=vm.createContext({
        console,Math,Number,String,Object,Array,JSON,Infinity,WeakMap,Map,Set,
        Date:FakeDate,
        localStorage:{
            getItem:key=>storage.has(key)?storage.get(key):null,
            setItem:(key,value)=>storage.set(key,String(value)),
            removeItem:key=>storage.delete(key)
        },
        player:players[0]||placeholder,
        player2:players[1]||null,
        player3:players[2]||null,
        sharedExp:Number(options.sharedExp)||0,
        zoneConfig:{},
        getMonsterRank:monster=>monster&&monster.rank||"regular",
        getExistingPartyIndexes:()=>players.map((_,index)=>index),
        getPartyCharacterByIndex:index=>players[index]||null,
        saveGame(){ saves++; },
        updateUI(){},
        alert(message){ alerts.push(String(message)); },
        setTimeout:()=>1,
        setInterval:()=>1
    });
    context.window=context;
    context.window.addEventListener=()=>{};
    vm.runInContext(growthSource,context);
    return {
        context,players,storage,alerts,
        setNow:value=>{ now=Number(value); },
        getNow:()=>now,
        saves:()=>saves,
        growthState:()=>JSON.parse(storage.get(GROWTH_KEY)||"{}")
    };
}

let passed=0;
function test(name,fn){ fn(); passed++; console.log("✓ "+name); }

/* 1–4: 新手期 */
test("1. Lv1–19 does not enable natural charge",()=>{
    const h=makeHarness({levels:[19]});
    h.setNow(h.getNow()+DAY);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,0);
    assert.equal(h.context.v173GetExpPoolChargeState().unlocked,false);
});

test("2. Lv20 unlocks charge and the unlock notice is one-time",()=>{
    const h=makeHarness({levels:[20]});
    assert.equal(h.context.v173GetExpPoolChargeState().unlocked,true);
    h.context.v173EnsureExpPoolChargeUnlocked(h.getNow(),true);
    h.context.v173EnsureExpPoolChargeUnlocked(h.getNow(),true);
    assert.equal(h.alerts.length,1);
    assert.match(h.alerts[0],/經驗池持續充能已解鎖/);
});

test("3. Lv1→20 total requirement is 37,950 EXP",()=>{
    const h=makeHarness({levels:[1]});
    assert.equal(h.context.v173GetBeginnerGrowthAudit().totalExpTo20,37950);
});

test("4. beginner flow is sized for about 20–30 minutes without long repeated grinding",()=>{
    const h=makeHarness({levels:[1]});
    const audit=h.context.v173GetBeginnerGrowthAudit();
    assert.equal(audit.newcomerOneTimeExp,6000);
    const forestBattles=Math.ceil(5850/617);
    const desertBattles=Math.ceil((audit.totalExpTo20-audit.newcomerOneTimeExp-5850)/3255);
    const battles=forestBattles+desertBattles;
    const estimatedMinutes=battles*1.0+6;
    assert.ok(battles>=14&&battles<=20,"expected normal battle count");
    assert.ok(estimatedMinutes>=20&&estimatedMinutes<=30,"estimated normal mobile play time");
});

/* 5–15: time-difference authority / 72h / old saves */
test("5. online elapsed time creates charge by timestamp difference",()=>{
    const h=makeHarness({levels:[20]});
    h.setNow(h.getNow()+12*60*60*1000);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,5200);
});

test("6. reopening after offline time settles the same timestamp-based charge",()=>{
    const base=2_000_000_000;
    const h=makeHarness({levels:[20],now:base+DAY,state:{initialized:true,unlocked:true,lastAt:base,noticeShown:true,lastCapped:false,newcomerRewards:{}}});
    assert.equal(h.context.sharedExp,10400);
});

test("7. charge accrues without opening the EXP pool page",()=>{
    const h=makeHarness({levels:[30]});
    h.setNow(h.getNow()+DAY);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,Math.floor(60000*h.context.v173GetNaturalChargeLevelsPerDay(30)));
});

test("8. the 4-second UI timer never directly mutates sharedExp",()=>{
    const interval=growthSource.match(/setInterval\(\(\)=>\{[\s\S]*?\},4000\)/);
    assert.ok(interval);
    assert.doesNotMatch(interval[0],/sharedExp\s*[+\-]?=/);
});

test("9. closing/reopening settles from persisted lastAt rather than an animation counter",()=>{
    assert.match(growthSource,/lastAt/);
    assert.match(growthSource,/timestamp-growthState\.lastAt/);
    assert.doesNotMatch(growthSource,/setInterval\([^)]*sharedExp/);
});

test("10. natural charge is capped at exactly 72 hours",()=>{
    const h=makeHarness({levels:[20]});
    h.setNow(h.getNow()+5*DAY);
    const preview=h.context.v173PreviewExpPoolCharge();
    assert.equal(preview.elapsedMs,72*60*60*1000);
    assert.equal(preview.gain,31200);
    assert.equal(preview.capped,true);
});

test("11. the 72-hour cap limits only natural time, not sharedExp itself",()=>{
    const h=makeHarness({levels:[20],sharedExp:9_999_999});
    h.setNow(h.getNow()+5*DAY);
    assert.equal(h.context.v173GetAvailableExpPool(),9_999_999+31200);
});

test("12. device clock rollback produces zero charge",()=>{
    const h=makeHarness({levels:[20]});
    const base=h.getNow();
    h.setNow(base-60*60*1000);
    assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),0);
});

test("13. rollback does not move the authoritative baseline backward or create extra EXP",()=>{
    const h=makeHarness({levels:[20]});
    const base=h.getNow();
    h.setNow(base-60*60*1000);
    h.context.v173SettleExpPoolCharge(h.getNow());
    assert.equal(h.growthState().lastAt,base);
    h.setNow(base+60*60*1000);
    assert.equal(h.context.v173SettleExpPoolCharge(h.getNow()),Math.floor(10400/24));
});

test("14. an old save with no growth fields initializes safely at current time",()=>{
    const h=makeHarness({levels:[20],sharedExp:777});
    assert.equal(h.context.sharedExp,777);
    assert.equal(h.growthState().lastAt,h.getNow());
});

test("15. first initialization never retroactively grants huge natural charge",()=>{
    const h=makeHarness({levels:[80],sharedExp:123});
    assert.equal(h.context.sharedExp,123);
    assert.equal(h.context.v173PreviewExpPoolCharge().gain,0);
});

/* 16–18: representative curve */
test("16. representative Lv20/30/40/49/50/60/70/80/90/95/99 charge rates are defined and descending smoothly",()=>{
    const h=makeHarness({levels:[99]});
    const levels=[20,30,40,49,50,60,70,80,90,95,99];
    const rates=levels.map(level=>h.context.v173GetNaturalChargeLevelsPerDay(level));
    assert.deepEqual(rates.map(value=>Number(value.toFixed(3))),[1.3,1.274,1.227,1.02,1,0.895,0.787,0.653,0.498,0.408,0.32]);
    for(let i=1;i<rates.length;i++){ assert.ok(rates[i]<=rates[i-1]); }
});

test("17. Lv49→50 has no cliff",()=>{
    const h=makeHarness({levels:[50]});
    const a=h.context.v133GetExpNextForLevel(49),b=h.context.v133GetExpNextForLevel(50);
    assert.ok(b/a<1.10);
    assert.ok(h.context.v173GetNaturalChargeLevelsPerDay(50)/h.context.v173GetNaturalChargeLevelsPerDay(49)>.95);
});

test("18. Lv50+ growth slows progressively instead of halving",()=>{
    const h=makeHarness({levels:[99]});
    const rates=[50,60,70,80,90,99].map(level=>h.context.v173GetNaturalChargeLevelsPerDay(level));
    for(let i=1;i<rates.length;i++){
        assert.ok(rates[i]<rates[i-1]);
        assert.ok(rates[i]/rates[i-1]>.65);
    }
});

/* 19–20: daily quest + final chest */
test("19. Lv20+ daily-task growth reward is shared-pool EXP and represents 70% of the added daily quest package",()=>{
    const h=makeHarness({levels:[50]});
    const b=h.context.v173GetDailyGrowthRewardBreakdown(50);
    assert.equal(b.totalExp,148350);
    assert.equal(b.taskExp,103845);
    assert.equal(Number((b.taskExp/b.totalExp).toFixed(2)),.70);
    assert.match(growthSource,/reward\.exp=lateState\.rewardBases\.get\(reward\)\+extra/);
});

test("20. the final daily 100% chest receives the remaining 30% shared-pool EXP",()=>{
    const h=makeHarness({levels:[50]});
    const b=h.context.v173GetDailyGrowthRewardBreakdown(50);
    assert.equal(b.chestExp,44505);
    assert.equal(b.taskExp+b.chestExp,b.totalExp);
    assert.match(growthSource,/type==="daily"&&Number\(threshold\)===100/);
});

/* 21–27: distribution / catch-up / cap */
test("21. EXP pool remains freely allocatable across up to three characters",()=>{
    assert.match(growthSource,/getExistingPartyIndexes\(\)\.slice\(0,3\)/);
    assert.doesNotMatch(growthSource,/sharedExp\s*\/\s*3/);
});

test("22. different-level characters use their own current requirement when pool cost is calculated",()=>{
    assert.match(growthSource,/expNext-exp/);
    assert.match(growthSource,/expNext=getExpNextForLevel\(level\)/);
});

test("23. catch-up gap 10–19 is ×1.15",()=>{
    const h=makeHarness({levels:[50,40]});
    assert.equal(h.context.v173GetExpPoolCatchUpMultiplierForLevel(40),1.15);
});

test("24. catch-up gap 20–29 is ×1.30",()=>{
    const h=makeHarness({levels:[50,30]});
    assert.equal(h.context.v173GetExpPoolCatchUpMultiplierForLevel(30),1.30);
});

test("25. catch-up gap 30+ is ×1.50",()=>{
    const h=makeHarness({levels:[50,20]});
    assert.equal(h.context.v173GetExpPoolCatchUpMultiplierForLevel(20),1.50);
});

test("26. catch-up multiplier is isolated from monster/offline/dungeon EXP",()=>{
    assert.doesNotMatch(battleExpSource,/v173GetExpPoolCatchUpMultiplier/);
    assert.doesNotMatch(offlineSource,/v173GetExpPoolCatchUpMultiplier/);
    assert.doesNotMatch(dungeonSource,/v173GetExpPoolCatchUpMultiplier/);
});

test("27. Lv100 characters are explicitly blocked from pool allocation",()=>{
    assert.match(growthSource,/character&&\(Number\(character\.level\)\|\|1\)>=MAX_CHARACTER_LEVEL/);
    assert.match(growthSource,/已達 Lv\."\+MAX_CHARACTER_LEVEL\+" 滿等/);
});

/* 28–34: notification coexistence / offline separation / UI-only animation */
test("28. level-up red dots use current EXP, catch-up cost and pending natural charge",()=>{
    assert.match(flowSource,/numeric\(character\.expNext\)-Math\.max\(0,numeric\(character\.exp\)\)/);
    assert.match(flowSource,/v173GetExpPoolCatchUpMultiplierForLevel/);
    assert.match(flowSource,/v173GetAvailableExpPool/);
});

test("29. merely entering the character/EXP page never marks level-up guidance as read",()=>{
    assert.doesNotMatch(flowSource,/canLevel\s*=\s*false/);
    assert.doesNotMatch(flowSource,/exp.*read/i);
});

test("30. level-up guidance recalculates away naturally when available pool is insufficient",()=>{
    assert.match(flowSource,/return available>=poolCost/);
});

test("31. attribute-point and skill learn/upgrade/equip reminders coexist with EXP guidance",()=>{
    assert.match(flowSource,/hasAttributePoints/);
    assert.match(flowSource,/canSpend/);
    assert.match(flowSource,/canEquip/);
    assert.match(flowSource,/已學習但尚未裝備/);
});

test("32. existing offline EXP remains a separate subsystem",()=>{
    assert.match(offlineSource,/calculateOfflineExpSince/);
    assert.match(offlineSource,/pendingOfflineExp/);
    assert.doesNotMatch(growthSource,/pendingOfflineExp\s*[+\-]?=/);
});

test("33. the same natural interval cannot be settled twice",()=>{
    const h=makeHarness({levels:[20]});
    h.setNow(h.getNow()+DAY);
    const first=h.context.v173SettleExpPoolCharge(h.getNow());
    const second=h.context.v173SettleExpPoolCharge(h.getNow());
    assert.equal(first,10400);
    assert.equal(second,0);
});

test("34. +EXP floating text is visual only and does not award EXP again",()=>{
    const ui=growthSource.match(/function syncChargeUi\(animate\)\{[\s\S]*?window\.v173SyncExpPoolChargeUi=syncChargeUi/);
    assert.ok(ui);
    assert.match(ui[0],/v173-exp-charge-float/);
    assert.doesNotMatch(ui[0],/sharedExp\s*\+=/);
});

/* Current bugfix regressions from the same request. */
test("Element Box opening is silent; warning is tied to attempted setting interaction",()=>{
    assert.doesNotMatch(elementBoxSource,/afterOpen[\s\S]*setTimeout\(notifyLocked/);
    assert.match(elementBoxSource,/bindLockedInteractionGuard/);
    assert.match(elementBoxSource,/notifyLocked\(\)/);
});

test("Element Box is a no-scroll single-screen sheet",()=>{
    assert.match(elementBoxCss,/body\.v162-element-box-settings-open #homeFeatureModal\{[\s\S]*overflow:hidden !important/);
    assert.match(elementBoxCss,/#homeFeatureModalBody\{[\s\S]*overflow:hidden !important/);
});

test("growth red dots are forced fully bright even on inactive/disabled targets",()=>{
    assert.match(polishCss,/\.v146-growth-attention-target\{[\s\S]*opacity:1 !important;[\s\S]*filter:none !important/);
    assert.match(polishCss,/\.v146-growth-guidance-dot\{[\s\S]*opacity:1 !important/);
});

test("main-city three-character HUD is slightly enlarged without changing the three-column structure",()=>{
    assert.match(polishCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(polishCss,/grid-template-columns:36px minmax\(0,1fr\)/);
    assert.match(polishCss,/height:64px/);
    assert.match(polishCss,/width:36px;height:36px/);
});

test("ordinary daily dungeons remain at 25% of the pre-tuning core stats while Abyss is excluded",()=>{
    assert.match(dungeonSource,/v17342DailyDungeonStatsHalvedAgain/);
    assert.match(dungeonSource,/monster\.v141Abyss===true/);
});

console.log("\n"+passed+" V173.43 formal growth/charge checks passed.");
