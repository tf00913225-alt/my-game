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
});

test("shared context navigation has one sizing and visibility owner",()=>{
    assert.match(layout,/\.bottom-nav:not\(\.v148-context-nav\)/);
    assert.match(navCss,/v148-context-nav-active #v141DungeonNav\{display:grid !important;\}/);
    assert.match(navCss,/v148-context-nav-active #bottomNav\{display:none !important;\}/);
    assert.match(devCss,/#game-stage #v141DungeonNav\.v148-context-nav/);
    assert.doesNotMatch(devCss,/#game-stage #app\.v141-dungeon-active #v141DungeonNav,/);
});
