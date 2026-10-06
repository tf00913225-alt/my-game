const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

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
    assert.equal((source.match(/new MutationObserver/g)||[]).length,0);
    assert.match(source,/window\.v17351AfterBattleRender=syncBattlePresentation/);
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
    const portrait=fs.readFileSync(path.join(__dirname,'..','js','45-v154-dev-fixes.js'),'utf8');
    // V154 selects the registry record and delegates to V174; no legacy image
    // is produced, so an opacity patch must not be restored to hide it.
    assert.match(portrait,/presentation\.applyUnit\(card,"monster",record\)/);
    assert.doesNotMatch(portrait,/v162-abyss-battle-portrait-art/);
    assert.doesNotMatch(source,/v162-abyss-battle-portrait-art/);
    assert.doesNotMatch(css,/v162-abyss-battle-portrait-art/);
    assert.match(source,/card\.querySelector\(":scope > \.v174-battle-art"\)/);
    assert.match(source,/if\(!art\)\{art=document\.createElement\("div"\)/);
    assert.match(source,/art\.style\.backgroundImage=source\|\|"none"/);
    assert.match(css,/\.v174-battle-art\{[^}]*background-size:var\(--portrait-background-size, contain\) !important/);
    assert.doesNotMatch(source,/removeChild\([^)]*v162-abyss-battle-portrait-art/);
});

test('canonical artwork updates reuse one child and preserve the selected portrait',()=>{
    const children=[];
    const makeStyle=()=>({setProperty(name,value){this[name]=value;}});
    const context=vm.createContext({
        document:{body:{classList:{remove(){}}},getElementById(){return null;},querySelectorAll(){return [];},createElement(){return {style:makeStyle(),classList:{toggle(){}},querySelector(){return null;}};}},
        getComputedStyle:()=>({getPropertyValue:()=> 'url("abyss-selected.webp")',backgroundImage:"none"}),console
    });
    context.window=context;
    vm.runInContext(source,context);
    const card={dataset:{},style:makeStyle(),classList:{add(){}},
        querySelector(){return children.find(node=>node.className==="v174-battle-art")||null;},
        insertBefore(node){children.unshift(node);},get firstChild(){return children[0]||null;}
    };
    const record={portraitKey:'abyss.selected',path:'abyss-selected.webp'};
    context.FourSymbolsBattlePresentation.applyUnit(card,"monster",record);
    context.FourSymbolsBattlePresentation.applyUnit(card,"monster",record);
    assert.equal(children.length,1,"repeated updates cannot duplicate portrait DOM");
    assert.equal(children[0].style.backgroundImage,'url("abyss-selected.webp")');
    assert.equal(card.style["background-image"],"none","the card background cannot draw a second portrait");
});
