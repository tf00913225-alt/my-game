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
    assert.doesNotMatch(vfx,/function snapshotTimedEffects\(\)\{[\s\S]*Object\.keys\(RAW_STATUS_SPRITES\)/);
});

test("known combatant refreshes use a single-unit status path",()=>{
    assert.match(vfx,/function syncStatusSpritesForUnit\(side,index\)/);
    assert.match(vfx,/updateMonsterUI=function\(index\)[\s\S]*syncStatusSpritesForUnit\("monster",Number\(index\)\)/);
    assert.match(vfx,/updateSingleCharacterStatusBadge=function\(index\)[\s\S]*syncStatusSpritesForUnit\("player",Number\(index\)\)/);
    assert.match(vfx,/function officialCardEffect\(side,index\)[\s\S]*syncStatusSpritesForUnit\(side,unitIndex\)/);
});

test("global updateUI keeps synchronous lifecycle semantics but performs only one full battlefield status pass",()=>{
    const block=vfx.match(/if\(typeof updateUI==="function"\)\{[\s\S]*?\n    \}/);
    assert.ok(block,"updateUI wrapper missing");
    assert.match(block[0],/syncStatusSpriteEffects\(\)/);
    assert.doesNotMatch(block[0],/setTimer\(syncStatusSpriteEffects,0\)/);
    const calls=(block[0].match(/syncStatusSpriteEffects\(\)/g)||[]).length;
    assert.equal(calls,1,"updateUI must do exactly one full status pass");
});

test("the old duplicate zero-delay full battlefield scan stays removed",()=>{
    assert.doesNotMatch(vfx,/setTimer\(syncStatusSpriteEffects,0\)/);
});

test("dispose contains no queued-sync state and still clears every status loop",()=>{
    const block=vfx.match(/director\.dispose=function\(\)\{[\s\S]*?return originalDispose\(\);\n    \};/);
    assert.ok(block,"dispose wrapper missing");
    assert.doesNotMatch(block[0],/statusSyncTimer|statusFullSyncQueued|statusUnitSyncQueue/);
    assert.match(block[0],/removeStatusSpriteEffects\(\)/);
});

console.log("battle VFX performance status sync: "+passed+" checks passed");
