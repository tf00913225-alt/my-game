"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const nav=read("js/42-v148-combat-dungeon-fixes.js");
const relic=read("js/60-team-relic-system.js");

test("Gameplay shared nav owns context-safe backpack and relic actions",()=>{
    assert.match(nav,/\["背包","assets\/ui\/nav-backpack\.png","v148OpenContextInventory\(\)"\]/);
    assert.match(nav,/\["秘寶","assets\/ui\/nav-relic-v175\.webp","v148OpenContextRelic\(\)"\]/);
    assert.match(nav,/window\.v148OpenContextInventory=function\(\)[\s\S]*?activeGameplayPageId\(\)[\s\S]*?mapPage\.classList\.add\("active"\)[\s\S]*?openMapInventoryOverlay\(\)[\s\S]*?finally[\s\S]*?mapPage\.classList\.remove\("active"\)/);
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
