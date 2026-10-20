const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','js','54-v173.51-battle-qa.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','css','fixed-slot-battlefield-rendering-v2.css'),'utf8');

test('cardless presentation keeps Slot geometry and migrates one real HUD surface',()=>{
    assert.match(source,/window\.FourSymbolsBattlePresentation=Object\.freeze\(/);
    assert.match(css,/\.v174-battle-hud-layer\{[^}]*z-index:16015/);
    assert.doesNotMatch(css,/\.v174-battle-art ~ \*\{[^}]*position:/);
    assert.doesNotMatch(source,/battleMonsterArea\.style/);
    assert.doesNotMatch(source,/battlePlayerRow\.style/);
    assert.doesNotMatch(source,/battleInput\.style/);
    assert.doesNotMatch(source,/turn-target-row[^\n]*style/);
    const abyssCss=fs.readFileSync(path.join(__dirname,'..','css','45-v152-dev-fixes.css'),'utf8');
    assert.match(abyssCss,/\.v152-abyss-portrait > :not\(\.v174-unit-hud\):not\(\.v174-battle-art\)\{/,
        'legacy Abyss child stacking cannot take geometry ownership from the real HUD surface');
});

test('HP and SP labels are normalized to current values only without observer churn',()=>{
    assert.match(source,/function setTextIfChanged\(node,value\)\{if\(node&&node\.textContent!==value\)node\.textContent=value;\}/);
    assert.match(source,/setTextIfChanged\(hp,String\(numericValue\(character\.hp\)\)\)/);
    assert.match(source,/const resource=getBattleSecondaryResource\(character\)/);
    assert.match(source,/setTextIfChanged\(sp,resource\.kind==="rage"\?"怒氣 "\+numericValue\(resource\.current\)\+"\/12":String\(numericValue\(resource\.current\)\)\)/);
    assert.match(source,/if\(Number\.isInteger\(index\)\)syncEnemyResourceHud\(index\)/);
    assert.doesNotMatch(source,/numericValue\(monster\.(?:hp|sp)\)/);
    const presentationBlock=source.match(/function syncResourceNumbers\(\)\{([\s\S]*?)\n\}/);
    assert.ok(presentationBlock);
    assert.doesNotMatch(presentationBlock[1],/maxHP|maxSP|"\/"|'\/'/);
    assert.equal((source.match(/new MutationObserver/g)||[]).length,0);
    assert.match(source,/window\.v17351AfterBattleRender=syncBattlePresentation/);
});

test('final resource presentation preserves player SP and displays Hero Rage without repeated writes',()=>{
    const main=fs.readFileSync(path.join(__dirname,'..','js','00-main.js'),'utf8');
    const projection=main.match(/function getBattleSecondaryResource\(character,stats\)\{[\s\S]*?\n\}/)[0];
    const numeric=source.match(/function numericValue\([^\n]+/)[0];
    const setter=source.match(/function setTextIfChanged\([^\n]+/)[0];
    const sync=source.match(/function syncResourceNumbers\(\)\{[\s\S]*?\n\}/)[0];
    const characters=[{hp:87,sp:35},{combatantKind:'heroNpc',hp:56,sp:99,rage:7}];
    let writes=0;
    const labels=characters.map(()=>['',''].map(()=>({value:'',get textContent(){return this.value;},set textContent(value){this.value=value;writes++;}})));
    const cards=characters.map((_,index)=>({id:'battlePlayerCard'+index,querySelector:selector=>labels[index][selector==='.hp-bar-text'?0:1]}));
    const context=vm.createContext({document:{querySelectorAll:selector=>selector.includes('battle-player')?cards:[]},getPartyCharacterByIndex:index=>characters[index]});
    context.unitHud=card=>card.v174UnitHud||card;
    vm.runInContext([projection,numeric,setter,sync].join('\n'),context);
    vm.runInContext('syncResourceNumbers();syncResourceNumbers();',context);
    assert.deepEqual(labels.map(pair=>pair.map(node=>node.textContent)),[['87','35'],['56','怒氣 7/12']]);
    assert.equal(writes,4,'unchanged labels must not trigger observer churn');
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
    assert.match(css,/\.v174-battle-art\{[^}]*background-size:0 0 !important/);
    assert.match(css,/\.v174-portrait-paint\{[^}]*background-size:contain/);
    assert.doesNotMatch(source,/removeChild\([^)]*v162-abyss-battle-portrait-art/);
});

test('canonical artwork updates reuse one child and preserve the selected portrait',()=>{
    const children=[];
    const makeStyle=()=>({setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}});
    const context=vm.createContext({
        document:{body:{classList:{remove(){}}},getElementById(){return null;},querySelectorAll(){return [];},createElement(){return {style:makeStyle(),dataset:{},classList:{toggle(){}},querySelector(){return null;},appendChild(){},addEventListener(){}};}},
        addEventListener(){},getComputedStyle:()=>({getPropertyValue:()=> 'url("abyss-selected.webp")',backgroundImage:"none"}),console
    });
    context.window=context;
    vm.runInContext(source,context);
    const card={id:"battleMonster0",dataset:{},style:makeStyle(),classList:{add(){},contains(){return false;}},closest(){return null;},querySelectorAll(){return [];},appendChild(node){children.push(node);},
        querySelector(){return children.find(node=>node.className==="v174-battle-art")||null;},
        insertBefore(node){children.unshift(node);},get firstChild(){return children[0]||null;}
    };
    const record={portraitKey:'abyss.selected',path:'abyss-selected.webp'};
    context.FourSymbolsBattlePresentation.applyUnit(card,"monster",record);
    context.FourSymbolsBattlePresentation.applyUnit(card,"monster",record);
    assert.equal(children.filter(node=>node.className==="v174-battle-art").length,1,"repeated updates cannot duplicate portrait DOM");
    assert.equal(children.filter(node=>node.className==="v174-unit-hud").length,1,"one real HUD");
    assert.equal(children[0].style.backgroundImage,'url("abyss-selected.webp")');
    assert.equal(card.style["background-image"],"none","the card background cannot draw a second portrait");
});
