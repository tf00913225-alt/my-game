"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const nav=read("js/42-v148-combat-dungeon-fixes.js");
const shell=read("js/04-stage-v11-native-bottom-nav-runtime.js");
const relic=read("js/60-team-relic-system.js");

test("Navigation selection and lifecycle cannot return to late owners",()=>{
    const core=read("js/00-main.js");
    const gameplay=read("js/gameplay-boss-tower-system.js");
    assert.doesNotMatch(core,/const navMap\s*=/);
    assert.doesNotMatch(gameplay,/function markGameplayNav/);
    assert.doesNotMatch(nav,/scheduleDungeonSync|queued=false; syncContextNavigation/);
    assert.match(core,/window\.v148SyncContextNavigation\(\)/);
    assert.match(read("js/59-abyss-two-tier-runtime.js"),/content\.innerHTML=renderAbyss\(\);window\.v148SyncContextNavigation\?\.\(\)/);
});

test("Gameplay shared nav owns context-safe backpack and relic actions",()=>{
    assert.match(shell,/\["背包","assets\/ui\/nav-backpack\.png","v148OpenContextInventory\(\)"\]/);
    assert.match(shell,/\["秘寶","assets\/ui\/nav-relic-v175\.webp","v148OpenContextRelic\(\)"\]/);
    const core=read("js/00-main.js");
    assert.match(nav,/window\.v148OpenContextInventory=function\(\)[\s\S]*?openInventoryContext\(\{[\s\S]*?sourcePage,[\s\S]*?returnAction:sourcePage==="map"\?"leaveMap\(\)":"v148ReturnFromGameplay\(\)",[\s\S]*?closeBehavior:"restore-source"[\s\S]*?\}\)/);
    assert.match(core,/function openInventoryContext\(context\)[\s\S]*?inventoryContextSnapshot\(context\)[\s\S]*?showPage\("inventory"\)[\s\S]*?inventoryOpenContext=normalized/);
    assert.match(core,/function closeMapInventoryOverlay\(\)[\s\S]*?if\(context\.sourcePage==="map"&&typeof leaveMap==="function"\)[\s\S]*?else if\(\["dungeon","gameplay","gameplayPage","boss","bossPage","tower","towerPage","training","trainingPage"\]\.includes\(context\.sourcePage\)\)/);
    assert.match(nav,/window\.v148OpenContextRelic=function\(\)[\s\S]*?window\.v174OpenRelicPage\(\)/);
});

test("Relic modal opens in place without a close/reopen flash cycle",()=>{
    const start=relic.indexOf("function prepareRelicModal(){");
    const end=relic.indexOf("function openRelicPage(){",start);
    assert.ok(start>=0&&end>start,"prepareRelicModal owner must exist");
    const owner=relic.slice(start,end);
    assert.doesNotMatch(owner,/closeHomeFeature\s*\(/);
    assert.match(owner,/classList\.add\("show","team-relic-modal"\)/);
});
