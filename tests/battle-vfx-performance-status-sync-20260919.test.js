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

test("status refreshes are coalesced and can be scoped to one combatant",()=>{
    assert.match(vfx,/function syncStatusSpritesForUnit\(side,index\)/);
    assert.match(vfx,/const statusUnitSyncQueue=new Map\(\)/);
    assert.match(vfx,/function queueStatusSpriteEffects\(side,index\)/);
    assert.match(vfx,/statusUnitSyncQueue\.set\(side\+"\:"\+index/);
    assert.match(vfx,/if\(statusSyncTimer\)\{ return; \}/);
    assert.match(vfx,/statusSyncTimer=setTimeout\(flushStatusSpriteSyncQueue,0\)/);
});

test("global updateUI queues one battlefield status pass instead of doing an immediate pass plus a zero-delay duplicate",()=>{
    const block=vfx.match(/if\(typeof updateUI==="function"\)\{[\s\S]*?\n    \}/);
    assert.ok(block,"updateUI wrapper missing");
    assert.match(block[0],/queueStatusSpriteEffects\(\)/);
    assert.doesNotMatch(block[0],/syncStatusSpriteEffects\(\)/);
    assert.doesNotMatch(block[0],/setTimer\(syncStatusSpriteEffects,0\)/);
});

test("monster and player status badge updates only queue their affected unit",()=>{
    assert.match(vfx,/updateMonsterUI=function\(index\)[\s\S]*queueStatusSpriteEffects\("monster",Number\(index\)\)/);
    assert.match(vfx,/updateSingleCharacterStatusBadge=function\(index\)[\s\S]*queueStatusSpriteEffects\("player",Number\(index\)\)/);
});

test("dispose cancels queued status work after current animation cleanup",()=>{
    const block=vfx.match(/director\.dispose=function\(\)\{[\s\S]*?return originalDispose\(\);\n    \};/);
    assert.ok(block,"dispose wrapper missing");
    const text=block[0];
    assert.ok(text.indexOf("cleanupCurrent(state.current")<text.indexOf("clearTimeout(statusSyncTimer)"));
    assert.match(text,/statusUnitSyncQueue\.clear\(\)/);
    assert.match(text,/removeStatusSpriteEffects\(\)/);
});

console.log("battle VFX performance status sync: "+passed+" checks passed");
