from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"expected source block not found in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "js/42-v148-combat-dungeon-fixes.js",
    '''        Object.freeze(["背包","assets/ui/nav-backpack.png","openMapInventoryOverlay()"]),
        Object.freeze(["秘寶","assets/ui/nav-relic-v175.webp","openHomeFeature('relic')"]),''',
    '''        Object.freeze(["背包","assets/ui/nav-backpack.png","v148OpenContextInventory()"]),
        Object.freeze(["秘寶","assets/ui/nav-relic-v175.webp","v148OpenContextRelic()"]),'''
)

replace_once(
    "js/42-v148-combat-dungeon-fixes.js",
    '''    function syncContextNavigation(){''',
    '''    window.v148OpenContextInventory=function(){
        if(typeof document==="undefined"||typeof openMapInventoryOverlay!=="function"){ return false; }
        const dungeonPage=document.getElementById("dungeonPage");
        const dungeonActive=!!(dungeonPage&&dungeonPage.classList&&dungeonPage.classList.contains("active"));
        const gameplayPageId=activeGameplayPageId();
        if(dungeonActive||!gameplayPageId){ return openMapInventoryOverlay(); }
        if(typeof battleActive!=="undefined"&&battleActive){ return false; }

        const mapPage=document.getElementById("mapPage");
        const mapWasActive=!!(mapPage&&mapPage.classList&&mapPage.classList.contains("active"));
        if(mapPage&&!mapWasActive){ mapPage.classList.add("active"); }
        try{
            return openMapInventoryOverlay();
        }finally{
            if(mapPage&&!mapWasActive){ mapPage.classList.remove("active"); }
        }
    };

    window.v148OpenContextRelic=function(){
        if(typeof window.v174OpenRelicPage==="function"){ return window.v174OpenRelicPage(); }
        if(typeof openHomeFeature==="function"){ return openHomeFeature("relic"); }
        return false;
    };

    function syncContextNavigation(){'''
)

replace_once(
    "js/60-team-relic-system.js",
    '''        if(typeof closeHomeFeature==="function"&&!nodes.modal.classList.contains("team-relic-modal")){ try{closeHomeFeature();}catch(_){ } }
        nodes.modal.classList.add("show","team-relic-modal");''',
    '''        /* Opening the relic surface must not close and immediately reopen the shared modal.
           That hide/show cycle caused visible multi-flash when invoked from Gameplay context navigation. */
        if(!nodes.modal.classList.contains("team-relic-modal")){
            nodes.modal.classList.remove("v131-shop-open");
        }
        nodes.modal.classList.add("show","team-relic-modal");'''
)

Path("tests/gameplay-context-nav-actions-20260915.test.js").write_text(r'''"use strict";
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
''', encoding="utf-8")
