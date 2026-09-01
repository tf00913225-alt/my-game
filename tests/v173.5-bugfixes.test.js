"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const vm=require("node:vm");

const main=fs.readFileSync("js/00-main.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const legacyAbyssPatch=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const skillRules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const rewardCss=fs.readFileSync("css/45-v152-dev-fixes.css","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function sourceFunction(source,signature){
    const start=source.indexOf(signature);
    assert.notEqual(start,-1,signature+" source");
    let depth=0;
    for(let index=source.indexOf("{",start);index<source.length;index++){
        if(source[index]==="{"){ depth++; }
        if(source[index]==="}"&&--depth===0){ return source.slice(start,index+1); }
    }
    throw new Error(signature+" closing brace");
}

test("Abyss portrait opens dialogue directly from its source owner without a wrapper",()=>{
    const challenge=sourceFunction(abyss,"window.v141ChallengeAbyssBoss=function(){");
    assert.match(challenge,/return openAbyssBossDialogue\(\);/);
    assert.match(abyss,/function openAbyssBossDialogue\(\)[\s\S]*?launchAbyssBossBattle\(\)/);
    assert.doesNotMatch(challenge,/v141ApproachAbyssBoss/);
    assert.doesNotMatch(legacyAbyssPatch,/v141ChallengeAbyssBoss=function/);
});

test("dismissed reward toast cannot keep a patrol-blocking hit area",()=>{
    assert.match(rewardCss,/\.v141-reward-toast\{\s*pointer-events:none !important;/);
    assert.match(rewardCss,/\.v141-reward-toast\.show\{[\s\S]*?pointer-events:auto !important;/);
});

test("new Water Orb sheet is the supplied 1536×1152 four-by-three asset",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(asset.toString("ascii",12,16),"IHDR");
    assert.deepEqual([asset.readUInt32BE(16),asset.readUInt32BE(20)],[1536,1152]);
    assert.match(animation,/water-orb-vfx\.png\?v=173\.19[\s\S]*?columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,[\s\S]*?renderer:"canvas-crop"/);
});

test("Phoenix Cry and Ice Arrow Rain use one centered battlefield sheet",()=>{
    assert.match(animation,/phoenixCry:\{[\s\S]*?placement:"battlefield",scale:1\.12,minSize:280/);
    assert.match(animation,/iceArrowRain:\{[\s\S]*?placement:"battlefield",renderer:"canvas-crop",targetBounds:true,coverageScale:1\.22,[\s\S]*?minWidth:140,minHeight:140/);
    const placement=sourceFunction(animation,"function placeSprite(current,node,index,target){");
    assert.match(placement,/if\(placement==="battlefield"\)[\s\S]*?node\.style\.width=size\+"px";[\s\S]*?node\.style\.height=size\+"px";/);
    assert.doesNotMatch(placement,/buildBattlefieldSpriteTiles\(/);
});

test("Frostbite expires once from its final monster and player status owner",()=>{
    const tick=sourceFunction(main,"function tickStatusEffects(){");
    assert.doesNotMatch(tick,/frostbite:"凍傷"/);
    assert.match(skillRules,/livingMonsterIndexes\(\)\.forEach\(index=>tickFrostbite/);
    assert.match(skillRules,/partyIndexes\(\)\.forEach\(index=>\{[\s\S]*?tickFrostbite\(character/);
    const frostbiteTick=sourceFunction(skillRules,"function tickFrostbite(entity,label){");
    const monster={name:"測試怪",alive:true,hp:100,maxHP:100,statusEffects:[{type:"frostbite",turnsLeft:1}]};
    const player={id:"測試角",hp:100,statusEffects:[{type:"frostbite",turnsLeft:1}]};
    const context={
        numeric:value=>Number.isFinite(Number(value))?Number(value):0,
        addBattleLog(){}
    };
    vm.createContext(context);
    vm.runInContext(frostbiteTick,context);
    context.tickFrostbite(monster,monster.name);
    context.tickFrostbite(player,player.id);
    assert.deepEqual(monster.statusEffects,[]);
    assert.deepEqual(player.statusEffects,[]);
});

console.log("\nV173.21 bug-fix suite: "+passed+" tests passed.");
