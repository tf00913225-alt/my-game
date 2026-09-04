const assert=require("assert");
const fs=require("fs");
const read=path=>fs.readFileSync(path,"utf8");

const battle=read("js/42-v148-combat-dungeon-fixes.js");
const water=read("js/50-v169-water-skill-rules.js");
const elementBox=read("js/45-v154-dev-fixes.js");
const elementCss=read("css/46-v154-dev-fixes.css");
const content=read("js/36-v141-content-systems.js");
const shop=read("js/51-v169-rpg-ui.js");
const shopCss=read("css/49-v169-rpg-ui.css");
const touch=read("js/01-stage-v8-touch-lock.js");

// 1. Purify Mind can be aimed at either side; enemies lose positive states only.
assert.match(water,/purifyMind:\{[\s\S]*?targetType:"ally",enemyTargetAllowed:true/);
assert.match(water,/對敵方解除所有增益狀態（包含結界、護盾等）/);
assert.match(battle,/function markPurifyMindDualTargets\(\)[\s\S]*?classList\.toggle\("targetable"[\s\S]*?classList\.add\("ally-targetable"\)/);
assert.match(battle,/function clearEnemyPositiveStates\(enemy\)[\s\S]*?enemy\.activeBuffs=\[\][\s\S]*?enemy\.v141Shield=null/);
assert.match(battle,/負面狀態保留/);

// 2. Gold dungeon has a concrete settlement value instead of an undefined call.
assert.match(battle,/function goldDungeonReward\(level\)/);
assert.match(battle,/showDailyGoldReward\(goldDungeonReward\(active\.level\)\)/);
assert.match(battle,/window\.v132ClaimMaterialDungeonReward/);
assert.match(battle,/window\.v139GetExpDungeonRewardExp/);

// 3. Element Box notice is a six-line, frame-free feed around the top quarter.
assert.match(elementBox,/while\(stack\.children&&stack\.children\.length>6\)/);
assert.match(elementBox,/"\["\+\(character\.id\|\|"角色"\)\+"使用補品 恢復"\+recovered\+resource\.toUpperCase\(\)\+"\]"/);
assert.match(elementBox,/logElementBoxRecovery\([\s\S]*?true\s*\)/);
assert.match(elementCss,/\.v17342-element-box-notice-stack\{[\s\S]*?top:25%/);
assert.match(elementCss,/\.v17342-element-box-use-notice\{[\s\S]*?border:0;[\s\S]*?background:none;[\s\S]*?box-shadow:none/);

// 4. Equipment crafting is no longer a user-facing synthesis tab.
assert.doesNotMatch(content,/\["craft","裝備合成"\]/);
assert.match(content,/const synthesisState=\{\s*tab:"reforge"/);
assert.match(content,/\["reforge","裝備冶煉"\],\["talisman","符咒合成"\],\["fragment","碎片合成"\]/);

// 5. Shop exposes potion/equipment pages and six equipment cards with 5 free / 10 max refreshes.
assert.match(shop,/const SHOP_FREE_REFRESHES=5;/);
assert.match(shop,/const SHOP_MAX_REFRESHES=10;/);
assert.match(shop,/Array\.from\(\{length:6\}/);
assert.match(shop,/v169SwitchShopPage\('potion'\)/);
assert.match(shop,/v169SwitchShopPage\('equipment'\)/);
assert.match(shop,/金幣刷新・價格待設定/);
assert.match(shopCss,/\.v17345-equipment-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);

// 6. Wave handoff remains inside battle so out-of-battle auto recovery cannot fire.
const wave=assert.match(battle,/function advanceDailyDungeonWave\(\)\{[\s\S]*?return true;\n    \}/)[0];
assert.match(wave,/battleActive=true;/);
assert.doesNotMatch(wave,/battleActive=false;/);

// 7. Daily and commission rewards get independent tab dots while the main task icon stays aggregated.
assert.match(battle,/function questRewardNoticeState\(\)/);
assert.match(battle,/return \{daily:daily,commission:commission,any:daily\|\|commission\};/);
assert.match(battle,/marker\.includes\("commission"\)\|\|marker\.includes\("委託"\)/);
assert.match(battle,/setQuestNoticeDot\(tab,notices\.commission,"委託任務獎勵可領取"\)/);
assert.match(battle,/setQuestNoticeDot\(tab,notices\.daily,"每日任務獎勵可領取"\)/);

// 8. Abyss log is a real touch-scroll owner and the emperor/chest platform is the requested upper arena.
assert.match(content,/function bossPosition\(\)\{ return \[61,21\]; \}/);
assert.match(content,/class="v17342-abyss-battle-log"/);
assert.match(touch,/\.v17342-abyss-battle-log/);
assert.match(elementCss,/\.v17342-abyss-battle-log\{[\s\S]*?overflow-y:auto;[\s\S]*?touch-action:pan-y/);

console.log("V173.45 current request regression checks passed");