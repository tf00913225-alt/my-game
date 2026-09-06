"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const battle=fs.readFileSync("js/54-v173.51-battle-qa.js","utf8");
const inventory=fs.readFileSync("js/55-v173.51-inventory-qa.js","utf8");
const shop=fs.readFileSync("js/56-v173.51-shop-qa.js","utf8");
const quest=fs.readFileSync("js/57-v173.51-quest-qa.js","utf8");
const css=fs.readFileSync("css/53-v173.51-qa.css","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const qol=fs.readFileSync("js/53-v173.50-inventory-qol.js","utf8");
const equipment=fs.readFileSync("js/equipment-progression.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const ui=fs.readFileSync("js/51-v169-rpg-ui.js","utf8");
const index=fs.readFileSync("index.html","utf8");

assert.match(battle,/\["addPoint","removePoint","confirmStatus","learnSkill","upgradeSkill"\]\.forEach\(guard\)/);
assert.match(battle,/戰鬥進行中無法調整能力值，也無法學習或升級技能/);
assert.match(battle,/list\.length!==5/);
assert.match(battle,/return \[row\[2\],row\[1\],row\[3\],row\[0\],row\[4\]\]/);
assert.match(battle,/previousRenderExpDistributeList/);
assert.match(battle,/window\.v173DecorateExpPoolDistributionUi\(\)/);
assert.match(battle,/\.v173-exp-row-meta/);
assert.match(battle,/window\.showRewardedAd=function/);
assert.match(battle,/let remain=3/);
assert.match(css,/v17351-management-open #v143-skill-stage\{visibility:hidden/);
assert.match(css,/v17342-element-box-use-notice[\s\S]*font-size:42px/);

assert.match(animation,/fireRocket:\{[\s\S]*?assets\/vfx\/fire\/fire-rocket-cast\.png/);
assert.doesNotMatch(animation,/config\.id==="fireRocket"[\s\S]{0,260}model\.sprite=null/);

assert.match(inventory,/目前穿戴/);
assert.match(inventory,/未穿戴任何裝備/);
assert.match(inventory,/v17351Locked/);
assert.match(inventory,/無法進行冶煉/);
assert.match(inventory,/equipment\(i\)&&!locked\(i\)/);
assert.match(inventory,/v17351BulkQualityPicker/);
assert.match(css,/#game-stage #inventoryPage #v17350BulkSellQuality\{display:none/);
assert.match(css,/v17351-quality-menu/);
assert.match(css,/v17351-inventory-fullscreen \.native-bottom-nav-layer\{display:none/);
assert.match(css,/game-content>\.content[\s\S]*height:100%/);

assert.match(shop,/BOUGHT="v17351_equipment_shop_purchases"/);
assert.match(shop,/✓ 已購買/);
assert.match(shop,/本輪已購買/);
assert.match(shop,/測試模式・無限免費刷新/);
assert.match(shop,/售價待設定/);
assert.match(shop,/v17351RetryShopImage/);

assert.match(quest,/const PAGE=5/);
assert.match(quest,/✓ 已領取/);
assert.match(quest,/v17351ClaimAllAchievements/);
assert.match(quest,/每日任務獎勵/);
assert.match(quest,/委託任務獎勵/);
assert.match(quest,/v17351PreviewQuestMilestone/);
assert.match(css,/quest-card-name\{font-size:17px/);

assert.match(qol,/css\/53-v173\.51-qa\.css\?v=173\.60/);
assert.match(qol,/js\/54-v173\.51-battle-qa\.js\?v=173\.60/);
assert.match(qol,/js\/55-v173\.51-inventory-qa\.js\?v=173\.60/);
assert.match(qol,/js\/56-v173\.51-shop-qa\.js\?v=173\.60/);
assert.match(qol,/js\/57-v173\.51-quest-qa\.js\?v=173\.60/);
assert.match(equipment,/js\/53-v173\.50-inventory-qol\.js\?v=173\.60/);
assert.match(equipment,/__v17351QaReady/);
assert.ok(loader.includes('const V_ASSET_VERSION="173.60";'));
assert.ok(ui.includes('js/equipment-progression.js?v=173.60'));
assert.ok(index.includes('<title>四象江湖傳 V173.60</title>'));
console.log("✓ V173.51 QA fixes");
