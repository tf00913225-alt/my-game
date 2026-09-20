const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','js','54-v173.51-battle-qa.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','css','fixed-slot-battlefield-rendering-v2.css'),'utf8');

test('cardless battle presentation keeps slot geometry and HUD owners untouched',()=>{
    assert.match(source,/window\.FourSymbolsBattlePresentation=Object\.freeze\(/);
    assert.match(css,/\.v174-cardless-unit > \.v174-battle-art ~ \*\{z-index:6;\}/);
    assert.doesNotMatch(css,/\.v174-battle-art ~ \*\{[^}]*position:/);
    assert.doesNotMatch(source,/battleMonsterArea\.style/);
    assert.doesNotMatch(source,/battlePlayerRow\.style/);
    assert.doesNotMatch(source,/battleInput\.style/);
    assert.doesNotMatch(source,/turn-target-row[^\n]*style/);
});

test('HP and SP labels are normalized to current values only without observer churn',()=>{
    assert.match(source,/function setTextIfChanged\(node,value\)\{if\(node&&node\.textContent!==value\)node\.textContent=value;\}/);
    assert.match(source,/setTextIfChanged\(hp,String\(numericValue\(character\.hp\)\)\)/);
    assert.match(source,/setTextIfChanged\(sp,String\(numericValue\(character\.sp\)\)\)/);
    assert.match(source,/setTextIfChanged\(hp,String\(numericValue\(monster\.hp\)\)\)/);
    assert.match(source,/setTextIfChanged\(sp,String\(numericValue\(monster\.sp\)\)\)/);
    const presentationBlock=source.match(/function syncResourceNumbers\(\)\{([\s\S]*?)\n\}/);
    assert.ok(presentationBlock);
    assert.doesNotMatch(presentationBlock[1],/maxHP|maxSP|"\/"|'\/'/);
    assert.equal((source.match(/new MutationObserver/g)||[]).length,1);
});

test('portrait motion keeps lunge while enemy hit feedback has no shake lifecycle',()=>{
    assert.match(css,/attacker-lunge-up > \.v174-battle-art/);
    assert.match(css,/attacker-lunge-down > \.v174-battle-art/);
    assert.match(css,/@keyframes v174BattleIdle/);
    assert.match(css,/@keyframes v174BattleLungeUp/);
    assert.match(css,/@keyframes v174BattleLungeDown/);
    assert.doesNotMatch(css,/@keyframes v174BattleHitShake|v174-hit-shake/);
    assert.match(css,/\.v174-battle-art::after/);
});

test('Abyss keeps its existing portrait owner but avoids double-rendering artwork',()=>{
    assert.match(source,/--v152-abyss-portrait/);
    assert.match(css,/img\.v162-abyss-battle-portrait-art\{[\s\S]*?opacity:0 !important;[\s\S]*?pointer-events:none !important;/);
    assert.doesNotMatch(source,/removeChild\([^)]*v162-abyss-battle-portrait-art/);
});

test('retired full-card status overlays are removed from cardless units',()=>{
    assert.match(source,/card-status-overlay[\s\S]*?overlay\.remove\(\)/);
});
