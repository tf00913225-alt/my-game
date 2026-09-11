const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','js','54-v173.51-battle-qa.js'),'utf8');

test('cardless battle presentation keeps slot geometry and HUD owners untouched',()=>{
    assert.match(source,/\.battle-player\.v174-cardless-unit,[\s\S]*?\.battle-monster\.v174-cardless-unit\{[\s\S]*?border:0!important;[\s\S]*?box-shadow:none!important;/);
    assert.match(source,/background-image:none!important/);
    assert.doesNotMatch(source,/battleMonsterArea\.style/);
    assert.doesNotMatch(source,/battlePlayerRow\.style/);
    assert.doesNotMatch(source,/battleInput\.style/);
    assert.doesNotMatch(source,/turn-target-row[^\n]*style/);
});

test('HP and SP labels are normalized to current values only',()=>{
    assert.match(source,/if\(hp\)hp\.textContent=String\(numericValue\(character\.hp\)\)/);
    assert.match(source,/if\(sp\)sp\.textContent=String\(numericValue\(character\.sp\)\)/);
    assert.match(source,/if\(hp\)hp\.textContent=String\(numericValue\(monster\.hp\)\)/);
    assert.match(source,/if\(sp\)sp\.textContent=String\(numericValue\(monster\.sp\)\)/);
    const presentationBlock=source.match(/function syncResourceNumbers\(\)\{([\s\S]*?)\n\}/);
    assert.ok(presentationBlock);
    assert.doesNotMatch(presentationBlock[1],/maxHP|maxSP|"\/"|'\/'/);
});

test('portrait motion uses existing lunge state and damage-popup lifecycle',()=>{
    assert.match(source,/attacker-lunge-up>\.v174-battle-art/);
    assert.match(source,/attacker-lunge-down>\.v174-battle-art/);
    assert.match(source,/@keyframes v174BattleIdle/);
    assert.match(source,/@keyframes v174BattleLungeUp/);
    assert.match(source,/@keyframes v174BattleLungeDown/);
    assert.match(source,/@keyframes v174BattleHitShake/);
    assert.match(source,/\.damage-popup\.hp-popup/);
    assert.match(source,/\.v174-battle-art::after/);
});
