"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

test("timed status snapshot only scans status types relevant to the current cast",()=>{
    assert.match(vfx,/function snapshotTimedEffects\(model\)/);
    assert.match(vfx,/deferredStatusTypes/);
    assert.match(vfx,/deferredActorStatusTypes/);
    assert.match(vfx,/if\(!relevantTypes\.length\)\{ return snapshot; \}/);
    assert.match(vfx,/statusAtStart:snapshotTimedEffects\(model\)/);
    assert.doesNotMatch(vfx,/function snapshotTimedEffects\(\)\{[\s\S]*Object\.keys\(RAW_STATUS_VISUALS\)/);
});

test("known combatant refreshes use a single-unit status path",()=>{
    assert.match(vfx,/function syncStatusVisualsForUnit\(side,index,advanceRotation\)/);
    assert.match(vfx,/updateMonsterUI=function\(index\)[\s\S]*syncStatusVisualsForUnit\("monster",Number\(index\)\)/);
    assert.match(vfx,/updateSingleCharacterStatusBadge=function\(index\)[\s\S]*syncStatusVisualsForUnit\("player",Number\(index\)\)/);
    assert.match(vfx,/function officialCardEffect\(side,index\)[\s\S]*syncStatusVisualsForUnit\(side,unitIndex\)/);
});

test("global updateUI no longer installs a redundant full battlefield status scan",()=>{
    assert.doesNotMatch(
        vfx,
        /if\(typeof updateUI==="function"\)\{[\s\S]*?syncStatusVisualEffects\(\)/,
        "V143 must rely on the base per-unit UI refresh path instead of wrapping updateUI"
    );
});

test("zero-delay full battlefield status scans stay removed",()=>{
    assert.doesNotMatch(vfx,/setTimer\(syncStatusVisualEffects,0\)/);
});

test("dispose contains no queued-sync state and still clears every persistent status visual",()=>{
    const block=vfx.match(/director\.dispose=function\(\)\{[\s\S]*?return originalDispose\(\);\n    \};/);
    assert.ok(block,"dispose wrapper missing");
    assert.doesNotMatch(block[0],/statusSyncTimer|statusFullSyncQueued|statusUnitSyncQueue/);
    assert.match(block[0],/removeStatusVisualEffects\(\)/);
});

console.log("battle VFX performance status sync: "+passed+" checks passed");
