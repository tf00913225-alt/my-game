"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const vm=require("node:vm");

const main=fs.readFileSync("js/00-main.js","utf8");
const abyss=fs.readFileSync("js/38-v143-system-fixes.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
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

test("Abyss portrait opens dialogue directly without a walk-up gate",()=>{
    const challenge=sourceFunction(abyss,"window.v141ChallengeAbyssBoss=function(){");
    assert.match(challenge,/openBossBubble\(\);/);
    assert.doesNotMatch(challenge,/v141ApproachAbyssBoss/);
});

test("dismissed reward toast cannot keep a patrol-blocking hit area",()=>{
    assert.match(rewardCss,/\.v141-reward-toast\{\s*pointer-events:none !important;/);
    assert.match(rewardCss,/\.v141-reward-toast\.show\{[\s\S]*?pointer-events:auto !important;/);
});

test("new Water Orb sheet is the approved transparent four-by-three asset",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(crypto.createHash("sha256").update(asset).digest("hex"),"d3bdcafbd65965a9c54c9785baa1922849f11f1c1fc905bf6c4723024c745c2d");
    assert.equal(asset.toString("ascii",12,16),"IHDR");
    assert.deepEqual([asset.readUInt32BE(16),asset.readUInt32BE(20)],[1448,1086]);
    assert.match(animation,/water-orb-vfx\.png\?v=173\.5[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,placement:"targetTrajectory",travelToTargets:true/);
});

test("Phoenix Cry and Ice Arrow Rain use one centered battlefield sheet",()=>{
    assert.match(animation,/phoenixCry:\{[\s\S]*?placement:"battlefield",scale:1\.12,minSize:280/);
    assert.match(animation,/iceArrowRain:\{[\s\S]*?placement:"battlefield",scale:1/);
    const placement=sourceFunction(animation,"function placeSprite(current,node,index,target){");
    assert.match(placement,/if\(placement==="battlefield"\)[\s\S]*?node\.style\.width=size\+"px";[\s\S]*?node\.style\.height=size\+"px";/);
    assert.doesNotMatch(placement,/buildBattlefieldSpriteTiles\(/);
});

test("Frostbite expires from monsters and players at the normal status tick",()=>{
    const tick=sourceFunction(main,"function tickStatusEffects(){");
    assert.match(tick,/frostbite:"凍傷"/);
    const monster={name:"測試怪",alive:true,hp:100,maxHP:100,statusEffects:[{type:"frostbite",turnsLeft:1}]};
    const player={id:"測試角",hp:100,statusEffects:[{type:"frostbite",turnsLeft:1}]};
    let updates=0;
    const context={
        battleActive:true,currentBattleMonsters:[0],monsters:[monster],
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>player,
        addBattleLog(){},showMonsterHit(){},showPlayerHit(){},killMonster(){},
        getPartyBattleStats:()=>({maxHP:100}),hasActiveBuff:()=>false,
        showShieldAbsorb(){},updateUI(){ updates++; }
    };
    vm.createContext(context);
    vm.runInContext(tick,context);
    context.tickStatusEffects();
    assert.deepEqual(monster.statusEffects,[]);
    assert.deepEqual(player.statusEffects,[]);
    assert.equal(updates,1);
});

console.log("\nV173.5 bug-fix suite: "+passed+" tests passed.");
