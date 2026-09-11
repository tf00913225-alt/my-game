const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','js','54-v173.51-battle-qa.js'),'utf8');

test('cardless battle presentation keeps slot geometry and HUD owners untouched',()=>{
    assert.match(source,/\.battle-player\.v174-cardless-unit,[\s\S]*?\.battle-monster\.v174-cardless-unit\{[\s\S]*?border:0!important;[\s\S]*?box-shadow:none!important;/);
    assert.match(source,/background-image:none!important/);
    assert.match(source,/\.v174-battle-art~\*\{z-index:6;\}/);
    assert.doesNotMatch(source,/\.v174-battle-art~\*\{[^}]*position:/);
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

test('portrait motion reuses existing lunge and damage-popup lifecycle',()=>{
    assert.match(source,/attacker-lunge-up>\.v174-battle-art/);
    assert.match(source,/attacker-lunge-down>\.v174-battle-art/);
    assert.match(source,/@keyframes v174BattleIdle/);
    assert.match(source,/@keyframes v174BattleLungeUp/);
    assert.match(source,/@keyframes v174BattleLungeDown/);
    assert.match(source,/@keyframes v174BattleHitShake/);
    assert.match(source,/\.damage-popup\.hp-popup/);
    assert.match(source,/\.v174-battle-art::after/);
});

test('Abyss keeps its existing portrait owner but avoids double-rendering artwork',()=>{
    assert.match(source,/--v152-abyss-portrait/);
    assert.match(source,/img\.v162-abyss-battle-portrait-art\{[\s\S]*?opacity:0!important;[\s\S]*?pointer-events:none!important;/);
    assert.doesNotMatch(source,/removeChild\([^)]*v162-abyss-battle-portrait-art/);
});
