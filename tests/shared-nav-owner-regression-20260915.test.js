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

test("shared context navigation has one runtime owner",()=>{
    assert.doesNotMatch(early,/function installDungeonNavigation\(\)[\s\S]*?nav\.innerHTML=/);
    assert.doesNotMatch(polish,/function dungeonNavMarkup\(/);
    assert.match(nav,/function contextNavMarkup\(returnAction\)/);
    assert.match(nav,/\["角色","assets\/ui\/nav-character\.png"/);
    assert.match(nav,/\["背包","assets\/ui\/nav-backpack\.png"/);
    assert.match(nav,/\["秘寶","assets\/ui\/nav-relic-v175\.webp"/);
    assert.match(nav,/\["元素匣","assets\/ui\/nav-element-box\.png"/);
    assert.match(nav,/buttons\.push\(\["返回","assets\/ui\/map-return\.png",returnAction\]\)/);
    assert.match(nav,/\["gameplayPage","bossPage","towerPage"\]/);
    assert.match(nav,/classList\.add\("v148-context-nav"\)/);
    assert.match(nav,/v148-context-nav-active/);
    assert.match(nav,/nav\.className="map-page-nav v141-dungeon-nav v148-context-nav"/);
    assert.doesNotMatch(nav,/nav\.className="bottom-nav map-page-nav/);
});

test("shared context navigation has one sizing and visibility owner",()=>{
    assert.match(layout,/\.bottom-nav,/);
    assert.match(layout,/#game-stage > #app > #game-content #v141DungeonNav/);
    assert.match(navCss,/v148-context-nav-active #v141DungeonNav\{display:grid !important;\}/);
    assert.match(navCss,/v148-context-nav-active #bottomNav\{display:none !important;\}/);
    assert.match(devCss,/#game-stage #v141DungeonNav\.v148-context-nav/);
    assert.doesNotMatch(devCss,/#game-stage #app\.v141-dungeon-active #v141DungeonNav,/);
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
