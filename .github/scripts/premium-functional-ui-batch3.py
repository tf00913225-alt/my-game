from pathlib import Path
import re


def replace_rule(path, selector, body):
    p=Path(path)
    text=p.read_text()
    pattern=re.compile(r'(?ms)^'+re.escape(selector)+r'\{.*?\}')
    replacement=selector+'{\n'+body.rstrip()+'\n}'
    new,count=pattern.subn(replacement,text,count=1)
    if count!=1:
        raise SystemExit(f'expected exactly one rule for {selector} in {path}, got {count}')
    p.write_text(new)


replace_rule('css/22-stage-v78-character-inventory-core.css','#game-stage #inventoryPage .inventory-right-panel','''    position:relative !important;
    width:100% !important;
    max-width:none !important;
    margin:0 !important;
    padding:10px !important;
    border:1px solid rgba(200,154,72,.18) !important;
    border-radius:12px !important;
    background:linear-gradient(155deg,rgba(28,21,13,.58),rgba(8,7,5,.74)) !important;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.025) !important;
    box-sizing:border-box !important;''')
replace_rule('css/22-stage-v78-character-inventory-core.css','#game-stage #inventoryPage .inventory-item-classic','''    width:100% !important;
    aspect-ratio:1 / 1 !important;
    height:auto !important;
    min-width:0 !important;
    min-height:0 !important;
    padding:3px !important;
    border-width:1px !important;
    border-radius:8px !important;
    background:radial-gradient(circle at 50% 30%,rgba(200,154,72,.08),transparent 48%),linear-gradient(160deg,#17120d,#090806) !important;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.025),0 2px 6px rgba(0,0,0,.28) !important;
    box-sizing:border-box !important;''')

replace_rule('css/23-stage-v77-inventory-detail-ui.css','#game-stage #inventoryPage .inventory-stats-panel','''    margin:6px 0 8px !important;
    padding:8px 10px !important;
    min-height:0 !important;
    border-width:1px 0 !important;
    border-style:solid !important;
    border-color:rgba(200,154,72,.16) !important;
    border-radius:0 !important;
    background:linear-gradient(90deg,transparent,rgba(200,154,72,.035),transparent) !important;
    box-shadow:none !important;''')
replace_rule('css/23-stage-v77-inventory-detail-ui.css','#game-stage #inventoryPage .inventory-stat-primary','''    display:flex !important;
    justify-content:space-between !important;
    align-items:center !important;
    min-height:38px !important;
    padding:6px 4px !important;
    font-size:15px !important;
    border:0 !important;
    border-bottom:1px solid rgba(200,154,72,.12) !important;
    border-radius:0 !important;
    background:transparent !important;''')
replace_rule('css/23-stage-v77-inventory-detail-ui.css','.inventory-character-detail-row','''    display:flex !important;
    align-items:center !important;
    justify-content:space-between !important;
    gap:8px !important;
    min-height:44px !important;
    padding:8px 4px !important;
    border:0 !important;
    border-bottom:1px solid rgba(200,154,72,.14) !important;
    border-radius:0 !important;
    background:transparent !important;
    font-size:14px !important;''')

replace_rule('css/38-v141-system-expansion.css','.item-modal .item-modal-box','''    width:min(92vw,470px) !important;
    max-width:470px !important;
    max-height:calc(100% - 24px) !important;
    overflow:hidden !important;
    padding:15px !important;
    box-sizing:border-box;
    border:1px solid rgba(200,154,72,.72) !important;
    background:linear-gradient(165deg,rgba(35,26,16,.98),rgba(8,7,5,.99) 72%) !important;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.04),0 12px 28px rgba(0,0,0,.48) !important;''')

replace_rule('css/55-team-relic-system.css','#game-stage .team-relic-current-card','''    display:grid;
    grid-template-columns:76px minmax(0,1fr);
    grid-template-rows:auto auto;
    gap:6px 9px;
    align-items:start;
    padding:10px;
    margin-bottom:9px;
    border:1px solid rgba(200,154,72,.24);
    border-radius:10px;
    background:linear-gradient(145deg,rgba(31,23,14,.72),rgba(8,7,5,.90));
    box-shadow:inset 0 1px 0 rgba(255,238,196,.025),0 5px 14px rgba(0,0,0,.28);''')
replace_rule('css/55-team-relic-system.css','#game-stage .team-relic-current-actions button,#game-stage .team-relic-select-first','''    min-width:68px;
    min-height:44px;
    padding:7px 10px;
    border:1px solid rgba(200,154,72,.40);
    border-radius:7px;
    background:linear-gradient(180deg,#2b2419,#14110d);
    color:#ead9b4;
    font-size:15px;
    font-weight:900;''')
replace_rule('css/55-team-relic-system.css','#game-stage .team-relic-tabs button','''    flex:0 0 auto;
    min-width:52px;
    min-height:44px;
    padding:8px 11px;
    border:1px solid rgba(123,95,53,.62);
    border-radius:22px;
    background:#15110d;
    color:#bcb09b;
    font-size:15px;
    font-weight:800;''')
replace_rule('css/55-team-relic-system.css','#game-stage .team-relic-card','''    position:relative;
    min-width:0;
    min-height:146px;
    padding:8px;
    border:1px solid rgba(200,154,72,.20);
    border-radius:9px;
    background:linear-gradient(155deg,rgba(27,21,14,.76),rgba(8,7,5,.92));
    color:#ded3c0;
    display:grid;
    grid-template-columns:68px minmax(0,1fr);
    grid-template-rows:min-content min-content;
    gap:3px 8px;
    align-content:center;
    align-items:center;
    text-align:left;
    box-shadow:inset 0 1px 0 rgba(255,238,196,.02),0 4px 10px rgba(0,0,0,.28);
    -webkit-tap-highlight-color:transparent;''')

Path('tests/premium-functional-ui-batch3.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const inventoryJs=read("js/35-v141-ui-battle.js");
const inventoryQol=read("js/53-v173.50-inventory-qol.js");
const scrollOwner=read("js/19-stage-v78-character-inventory-runtime.js");
const relicJs=read("js/60-team-relic-system.js");
const inventoryCss=read("css/22-stage-v78-character-inventory-core.css");
const detailCss=read("css/23-stage-v77-inventory-detail-ui.css");
const systemCss=read("css/38-v141-system-expansion.css");
const relicCss=read("css/55-team-relic-system.css");
assert.match(inventoryJs,/const INVENTORY_PAGE_SIZE=18;/);
assert.match(inventoryJs,/const INVENTORY_PAGE_COUNT=7;/);
assert.match(inventoryJs,/slice\(\s*inventoryPageIndex\*INVENTORY_PAGE_SIZE/);
assert.match(inventoryQol,/QUALITY_ORDER=\["white","blue","purple","orange","pink","four-symbol"\]/);
assert.match(scrollOwner,/inventoryOwnsScroll/);
assert.match(scrollOwner,/inventoryOwnsScroll\s*\?\s*"hidden"\s*:\s*"scroll"/);
assert.match(relicJs,/function prepareRelicModal\(\)/);
assert.match(inventoryCss,/inventory-grid-classic\{[\s\S]*?repeat\(6,minmax\(0,1fr\)\)/);
assert.match(inventoryCss,/inventory-item-classic\{[\s\S]*?border-width:1px !important;[\s\S]*?box-sizing:border-box/);
assert.match(detailCss,/inventory-stat-primary\{[\s\S]*?border-bottom:1px solid rgba\(200,154,72,.12\)/);
assert.match(detailCss,/inventory-character-detail-row\{[\s\S]*?min-height:44px/);
assert.match(systemCss,/\.item-modal \.item-modal-box\{[\s\S]*?border:1px solid rgba\(200,154,72,.72\)/);
assert.match(relicCss,/team-relic-current-actions button,#game-stage \.team-relic-select-first\{[\s\S]*?min-height:44px/);
assert.match(relicCss,/team-relic-tabs button\{[\s\S]*?min-height:44px/);
assert.match(relicCss,/\.rarity-white\{border-color:#d8d8d8!important;/);
assert.match(relicCss,/\.rarity-blue\{border-color:#42a5ff!important;/);
assert.match(relicCss,/\.rarity-purple\{border-color:#B05CFF!important;/);
assert.match(relicCss,/\.rarity-orange\{border-color:#FF9F38!important;/);
assert.match(relicCss,/\.rarity-pink\{border-color:#FF4FA7!important;/);
assert.match(relicCss,/rarity-four-symbol/);
console.log("✓ premium functional UI batch 3 preserves 18x7 inventory, item and relic runtimes");
''')
