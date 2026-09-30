"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=file=>fs.readFileSync(file,"utf8");

const index=read("index.html");
const ui=read("js/35-v141-ui-battle.js");
const sell=read("js/53-v173.50-inventory-qol.js");
const qa=read("js/55-v173.51-inventory-qa.js");
const coreCss=read("css/22-stage-v78-character-inventory-core.css");
const scrollCss=read("css/24-stage-v85-inventory-inner-grid-scroll-root.css");
const legacyQaCss=read("css/53-v173.51-qa.css");

assert.equal((index.match(/id="inventoryPage"/g)||[]).length,1);
assert.equal((index.match(/id="inventoryGridScroll"/g)||[]).length,1);
assert.match(index,/id="inventoryBottomActions"/);
assert.match(index,/id="inventoryRefreshButton"[^>]*onclick="v141RefreshInventory\(\)"/);
assert.match(index,/id="inventoryPaginationSlot"/);
assert.match(index,/id="inventoryQuickSellButton"[^>]*onclick="v17350OpenQuickSellModal\(\)"/);

assert.match(ui,/const INVENTORY_PAGE_SIZE=24;/);
assert.match(ui,/const INVENTORY_PAGE_COUNT=Math\.ceil\(120\/INVENTORY_PAGE_SIZE\);/);
assert.match(ui,/for\(let index=0;index<INVENTORY_PAGE_SIZE;index\+\+\)/);
assert.match(ui,/window\.v141RefreshInventory=function/);
assert.match(ui,/inventoryQuickSellButton/);
assert.match(ui,/inventoryPaginationSlot/);

assert.match(sell,/function candidateSummary\(threshold\)/);
assert.match(sell,/window\.v17350OpenQuickSellModal=function/);
assert.match(sell,/id="v17350QuickSellQuality"/);
assert.match(sell,/id="v17350QuickSellCount"/);
assert.match(sell,/id="v17350QuickSellGold"/);
assert.match(sell,/id="v17350QuickSellConfirm"/);
assert.doesNotMatch(sell,/v17350BulkSellBar|insertBefore\(bar,gridScroll\)/);
assert.doesNotMatch(qa,/v17350BulkSellBar|v17351BulkQualityPicker/);

assert.match(coreCss,/\.inventory-bottom-actions\{/);
assert.match(coreCss,/\.inventory-quick-sell-action\{/);
assert.match(coreCss,/\.v141-inventory-pager\{/);
assert.match(scrollCss,/\.inventory-grid-scroll\{\n    flex:0 1 auto/);
assert.doesNotMatch(coreCss,/v17350-bulk-sell-bar/);
assert.doesNotMatch(legacyQaCss,/v17350BulkSellQuality|v17351-quality-menu/);
assert.doesNotMatch(coreCss,/inventory-bottom-actions\{[^}]*margin-top:-|v141-inventory-pager\{[^}]*margin-top:-|transform:translateY/);

console.log("✓ Backpack grid capacity and bottom action owner convergence");
