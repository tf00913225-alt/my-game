const assert=require("assert");
const fs=require("fs");
const read=path=>fs.readFileSync(path,"utf8");

const battle=read("js/42-v148-combat-dungeon-fixes.js");
const water=read("js/60-v173.64-skill-progression-rebalance.js");
const elementBox=read("js/45-v154-dev-fixes.js");
const elementCss=read("css/46-v154-dev-fixes.css");
const content=read("js/36-v141-content-systems.js");
const shop=read("js/51-v169-rpg-ui.js");
const shopCss=read("css/49-v169-rpg-ui.css");
const touch=read("js/01-stage-v8-touch-lock.js");

// 1. Purify Mind targets either side and clears removable states via the formal owner.
assert.match(water,/purifyMind:\{[^}]*targetType:"ally",enemyTargetAllowed:true/);
assert.match(water,/purifyMind:\{[^}]*removeAllStates:true/);
assert.match(battle,/removed\+=clearRemovableEntityStates\(entity,targetSide\)/);
assert.match(battle,/function markPurifyMindDualTargets\(\)[\s\S]*?classList\.toggle\("targetable"[\s\S]*?classList\.add\("ally-targetable"\)/);
assert.match(battle,/function clearRemovableEntityStates\(entity,side\)[\s\S]*?entity\.activeBuffs=entity\.activeBuffs\.filter[\s\S]*?entity\.v141Shield=null/);
assert.match(battle,/targetSide==="monster"[\s\S]*?clearRemovableEntityStates\(entity,targetSide\)/);

// 2. Gold dungeon has a concrete settlement value instead of an undefined call.
assert.ok(battle.includes("function goldDungeonReward(level)"));
assert.ok(battle.includes("showDailyGoldReward(goldDungeonReward(active.level))"));
assert.ok(battle.includes("window.v132ClaimMaterialDungeonReward"));
assert.ok(battle.includes("window.v139GetExpDungeonRewardExp"));

// 3. Element Box notice is a six-line, frame-free feed around the top quarter.
assert.ok(elementBox.includes("stack.children.length>6"));
assert.ok(elementBox.includes("使用補品 恢復"));
assert.ok(elementBox.includes("recovered+resource.toUpperCase()"));
assert.match(elementCss,/\.v17342-element-box-notice-stack\{[\s\S]*?top:25%/);
assert.match(elementCss,/\.v17342-element-box-use-notice\{[\s\S]*?border:0;[\s\S]*?background:none;[\s\S]*?box-shadow:none/);

// 4. Equipment crafting is no longer a user-facing synthesis tab.
assert.ok(!content.includes('["craft","裝備合成"]'));
assert.ok(content.includes('const synthesisState={\n        tab:"talisman"'));
assert.ok(content.includes('["talisman","符咒合成"],["fragment","碎片合成"]'));

// 5. Shop exposes potion/equipment pages and six equipment cards with 5 free / 10 max refreshes.
assert.ok(shop.includes("const SHOP_FREE_REFRESHES=5;"));
assert.ok(shop.includes("const SHOP_MAX_REFRESHES=10;"));
assert.ok(shop.includes("Array.from({length:6}"));
assert.ok(shop.includes("v169SwitchShopPage"));
assert.ok(shop.includes(">補品</button>"));
assert.ok(shop.includes(">裝備</button>"));
assert.ok(shop.includes("金幣刷新・價格待設定"));
assert.match(shopCss,/\.v17345-equipment-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);

// 6. Wave handoff remains inside battle so out-of-battle auto recovery cannot fire.
const waveMatch=battle.match(/function advanceDailyDungeonWave\(\)\{[\s\S]*?return true;\n    \}/);
assert.ok(waveMatch,"advanceDailyDungeonWave must exist");
assert.ok(waveMatch[0].includes("battleActive=true;"));
assert.ok(!waveMatch[0].includes("battleActive=false;"));

// 7. Daily and commission rewards get independent tab dots while the main task icon stays aggregated.
assert.ok(battle.includes("function questRewardNoticeState()"));
assert.ok(battle.includes("return {daily:daily,commission:commission,any:daily||commission};"));
assert.ok(battle.includes('marker.includes("commission")||marker.includes("委託")'));
assert.ok(battle.includes('setQuestNoticeDot(tab,notices.commission,"委託任務獎勵可領取")'));
assert.ok(battle.includes('setQuestNoticeDot(tab,notices.daily,"每日任務獎勵可領取")'));

// 8. Abyss log is a real touch-scroll owner and the emperor/chest platform is the requested upper arena.
assert.ok(content.includes("function bossPosition(){ return [61,21]; }"));
assert.ok(content.includes('class="v17342-abyss-battle-log"'));
// The gesture owner infers legacy scrolling from real overflow, not a whitelist.
const vm=require("node:vm");
const documentElement={};
const gesture={window:null,document:{documentElement,addEventListener(){},getElementById(){return null;}},
    getComputedStyle:()=>({overflowY:"auto",overflowX:"hidden"}),addEventListener(){}};
gesture.window=gesture;
vm.createContext(gesture);
vm.runInContext(touch,gesture);
const log={nodeType:1,scrollHeight:900,clientHeight:200,scrollWidth:300,clientWidth:300,parentElement:documentElement};
assert.equal(gesture.FourSymbolsGestureArbiter.findScrollOwner(log).node,log);
assert.equal(gesture.FourSymbolsGestureArbiter.findScrollOwner(log).axes,"y");
log.scrollHeight=200;
assert.equal(gesture.FourSymbolsGestureArbiter.findScrollOwner(log),null,"a fitting log must not claim scrolling");
assert.match(elementCss,/\.v17342-abyss-battle-log\{[\s\S]*?overflow-y:auto;[\s\S]*?touch-action:pan-y/);

console.log("V173.50 current request regression checks passed");
