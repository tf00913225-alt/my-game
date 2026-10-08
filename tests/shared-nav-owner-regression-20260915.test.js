"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=path=>fs.readFileSync(path,"utf8");
const early=read("js/35-v141-ui-battle.js");
const polish=read("js/41-v146-system-polish.js");
const nav=read("js/42-v148-combat-dungeon-fixes.js");
const layout=read("css/00-main.css");
const navCss=read("css/38-v141-system-expansion.css");
const devCss=read("css/45-v152-dev-fixes.css");

test("one native shell receives context items without another navigation DOM",()=>{
    const shell=read("js/04-stage-v11-native-bottom-nav-runtime.js");
    const css=read("css/06-stage-v11-native-bottom-nav.css");
    assert.match(shell,/nav\.replaceChildren\(\.\.\.mainButtons\)/);
    assert.match(shell,/nav\.replaceChildren\(\.\.\.buttons\.map/);
    assert.match(shell,/function syncContext\(\)/);
    assert.match(shell,/renderGameplayContext\(returnAction,context\)/);
    assert.match(nav,/FourSymbolsBottomNav\?\.syncContext\(\)/);
    assert.doesNotMatch(nav,/CONTEXT_NAV_ITEMS|renderContextNav|dungeonReturnAction/);
    assert.doesNotMatch(nav,/createElement\("div"\)[\s\S]*?v141DungeonNav/);
    assert.doesNotMatch(layout,/v141DungeonNav|mapPageNav/);
    assert.doesNotMatch(navCss,/v141DungeonNav|mapPageNav/);
    assert.doesNotMatch(devCss,/v141DungeonNav|mapPageNav/);
    assert.match(css,/height:216px/);
    assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});

test("cold training entry projects context in app-shell before gameplay is loaded",()=>{
    const shell=read("js/04-stage-v11-native-bottom-nav-runtime.js");
    const core=read("js/00-main.js");
    assert.match(shell,/trainingActive[\s\S]*?"training"/);
    assert.match(shell,/\["角色"[\s\S]*?\["背包"[\s\S]*?\["秘寶"[\s\S]*?\["元素匣"/);
    assert.match(core,/v148SyncContextNavigation[\s\S]*?FourSymbolsBottomNav\?\.syncContext\(\)/);
    assert.doesNotMatch(core,/else\{ window\.FourSymbolsBottomNav\?\.renderMain\(page\); \}/);
});

test("notification dots distinguish native and legacy coordinate planes",()=>{
    const nativeCss=read("css/06-stage-v11-native-bottom-nav.css");
    const legacyCss=read("css/38-v141-system-expansion.css");
    const lateCss=read("css/42-v146-system-polish.css");
    assert.match(nativeCss,/#bottomNav > \.nav-button > \.v141-notice-dot\{[\s\S]*?width:22px;[\s\S]*?height:22px;/);
    assert.match(legacyCss,/\.v141-notice-dot\{[\s\S]*?width:9px;[\s\S]*?height:9px;/);
    assert.match(legacyCss,/@keyframes v141NoticePulse\{50%\{transform:scale\(\.9\)/);
    assert.doesNotMatch(lateCss,/\.v141-notice-dot[\s\S]*?width:7px !important/);
});

test("gameplay presentation removes seal ownership and full-art dark overlays",()=>{
    const gameplay=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
    const source=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
    const sealClass=["gameplay","mode","seal"].join("-");
    assert.doesNotMatch(gameplay,new RegExp(sealClass));
    assert.doesNotMatch(source,new RegExp(sealClass));
    assert.doesNotMatch(gameplay,/grid-template-columns:minmax\(0,1fr\) 78px/);
    assert.doesNotMatch(gameplay,/gameplay-mode-card\{[\s\S]*?linear-gradient\(90deg,rgba\([^)]*\.92/);
    assert.doesNotMatch(gameplay,/tower-element-hero\{[\s\S]*?linear-gradient\(180deg,rgba\([^)]*\.20/);
});

test("coming-soon preserves disabled semantics without dimming its artwork",()=>{
    const gameplay=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
    const source=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
    assert.match(gameplay,/\.gameplay-mode-card\.coming-soon\{[\s\S]*?cursor:default;/);
    assert.doesNotMatch(gameplay,/\.gameplay-mode-card\.coming-soon\{[^}]*?(?:opacity|filter):/);
    assert.match(source,/class="gameplay-mode-card coming-soon"[\s\S]*?aria-disabled="true"/);
    assert.match(source,/class="gameplay-mode-card coming-soon"[\s\S]*?尚未開放/);
});

test("gameplay panel keeps only the top ornament owner",()=>{
    const gameplay=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
    assert.match(gameplay,/#game-stage \.gameplay-large-panel::before\{/);
    assert.doesNotMatch(gameplay,/gameplay-large-panel::after/);
    assert.doesNotMatch(gameplay,/bottom:8px/);
});

 test("navigation frames and state styling have only the canonical CSS owner",()=>{
    const css=read("css/06-stage-v11-native-bottom-nav.css");
    assert.match(css,/\.nav-icon-frame\{[\s\S]*?width:180px;[\s\S]*?height:180px;/);
    assert.doesNotMatch(read("css/00-main.css"),/\.nav-art-button\{|\.nav-button\{/);
    assert.doesNotMatch(read("js/00-main.js"),/enforceVirtualStageLayout|nav\.style\.width/);
    assert.match(read("js/04-stage-v11-native-bottom-nav-runtime.js"),/frame\.className="nav-icon-frame"/);
 });

 test("home backdrop cannot force the full legacy surface into the home scroll area",()=>{
    const css=read("css/00-main.css");
    assert.match(css,/\.home-bg-fixed-layer\{\s*position:absolute;\s*inset:0;/);
    assert.doesNotMatch(css,/#game-stage > #app > #game-content \.home-bg-fixed-layer/);
    assert.doesNotMatch(read("css/00-main.css"),/#game-stage > #app > #game-content \.home-bg-fixed-layer/);
 });
