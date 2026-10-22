"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

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
    assert.match(vfx,/function syncStatusVisualsForUnit\(side,index,advanceRotation,presentationSnapshot\)/);
    assert.match(vfx,/window\.v143ScheduleMonsterUiUpdate=function\(index,callback,projection\)/);
    assert.match(vfx,/window\.v143StatusAfterMonsterUiUpdate=function\(index\)[\s\S]*syncStatusVisualsForUnit\("monster",Number\(index\)\)/);
    assert.match(vfx,/window\.v143SchedulePlayerStatusUiUpdate=function\(index,callback,projection\)/);
    assert.match(vfx,/window\.v143StatusAfterPlayerUiUpdate=function\(index\)[\s\S]*syncStatusVisualsForUnit\("player",Number\(index\)\)/);
    assert.doesNotMatch(vfx,/\bupdateMonsterUI\s*=\s*function|\bupdateSingleCharacterStatusBadge\s*=\s*function/);
    assert.match(vfx,/function officialCardEffect\(side,index\)[\s\S]*syncStatusVisualsForUnit\(side,unitIndex\)/);
});

test("full status pass captures every unit before mutation and passes snapshots without rereading",()=>{
    const start=vfx.indexOf("    function syncStatusVisualEffects(advanceRotation)");
    const end=vfx.indexOf("    function removeStatusVisualEffects()",start);
    assert.ok(start>=0&&end>start);
    const events=[],snapshots=new Map();
    const context={currentBattleMonsters:[2,5],readStatusPresentation(side,index){
        events.push("read:"+side+":"+index);
        const snapshot={side,index};snapshots.set(side+":"+index,snapshot);return snapshot;
    },purgeLegacyCardVfx(){ events.push("purge"); },syncStatusVisualsForUnit(side,index,advance,snapshot){
        assert.equal(snapshot,snapshots.get(side+":"+index));
        assert.equal(advance,true);
        events.push("write:"+side+":"+index);
    }};
    vm.createContext(context);
    vm.runInContext(vfx.slice(start,end)+";syncStatusVisualEffects(true);",context);
    assert.equal(events.length,17);
    assert.ok(events.slice(0,8).every(event=>event.startsWith("read:")));
    assert.equal(events[8],"purge");
    assert.ok(events.slice(9).every(event=>event.startsWith("write:")));
    // Single-unit refresh still measures once before its first mutation.
    const unit=vfx.slice(vfx.indexOf("    function syncStatusVisualsForUnit("),start);
    assert.ok(unit.indexOf("presentationSnapshot||readStatusPresentation(side,index)")<unit.indexOf("classList.toggle"));
    assert.doesNotMatch(unit,/getBoundingClientRect/);
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
