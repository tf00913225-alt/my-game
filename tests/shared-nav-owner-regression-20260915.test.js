"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=path=>fs.readFileSync(path,"utf8");
const early=read("js/35-v141-ui-battle.js");
const polish=read("js/41-v146-system-polish.js");
const nav=read("js/42-v148-combat-dungeon-fixes.js");
const layout=read("css/02-stage-v3-layout-fix.css");
const navCss=read("css/38-v141-system-expansion.css");
const devCss=read("css/45-v152-dev-fixes.css");

test("one native shell receives context items without another navigation DOM",()=>{
    const shell=read("js/04-stage-v11-native-bottom-nav-runtime.js");
    const css=read("css/06-stage-v11-native-bottom-nav.css");
    assert.match(shell,/nav\.replaceChildren\(\.\.\.mainButtons\)/);
    assert.match(shell,/nav\.replaceChildren\(\.\.\.buttons\.map/);
    assert.match(nav,/FourSymbolsBottomNav\?\.renderContext\(buttons,mode\)/);
    assert.doesNotMatch(nav,/createElement\("div"\)[\s\S]*?v141DungeonNav/);
    assert.doesNotMatch(layout,/v141DungeonNav|mapPageNav/);
    assert.doesNotMatch(navCss,/v141DungeonNav|mapPageNav/);
    assert.doesNotMatch(devCss,/v141DungeonNav|mapPageNav/);
    assert.match(css,/height:216px/);
    assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
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
    assert.doesNotMatch(read("css/00-main.css"),/\.nav-art-button\{/);
    assert.match(read("js/04-stage-v11-native-bottom-nav-runtime.js"),/frame\.className="nav-icon-frame"/);
 });
