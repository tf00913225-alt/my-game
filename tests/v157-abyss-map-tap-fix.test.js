"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const abyss=fs.readFileSync("js/36-v141-content-systems.js","utf8");
const polish=fs.readFileSync("js/41-v146-system-polish.js","utf8");
const css=fs.readFileSync("css/46-v154-dev-fixes.css","utf8");

let passed=0;
function test(name,handler){
    handler();
    passed++;
    console.log("✓ "+name);
}

test("the current cache key delivers the Abyss tap correction",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.31"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.31/);
});

test("Abyss map portraits use the reduced mobile size and keep a full button hit area",()=>{
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*width:120px !important;[\s\S]*height:168px !important;/);
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*touch-action:manipulation !important;/);
    assert.match(abyss,/<button type="button" class="v141-abyss-boss"[\s\S]*data-abyss-boss-control="true"[\s\S]*onclick="v141HandleAbyssBossInteraction\(event\)"/);
});

test("capture-phase BOSS bridge wins over every portrait or player layer",()=>{
    assert.match(
        abyss,
        /function installAbyssBossInputBridge\(\)[\s\S]*?\["pointerup","click"\]\.forEach\(type=>map\.addEventListener\(type,event=>[\s\S]*?isAbyssMapControlHit\(event,boss\)[\s\S]*?v141HandleAbyssBossInteraction\(event\)/
    );
    assert.match(
        abyss,
        /window\.v141HandleAbyssBossInteraction=function\(event\)[\s\S]*?event\.preventDefault[\s\S]*?event\.stopPropagation[\s\S]*?window\.v141ChallengeAbyssBoss\(\)/
    );
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*?pointer-events:auto !important;[\s\S]*?z-index:20 !important;/);
});

test("map-level portrait bounds route a mobile pseudo-element tap to dialogue",()=>{
    assert.match(
        abyss,
        /function isAbyssMapControlHit\(event,control\)[\s\S]*target\.closest\("button"\)===control[\s\S]*rect=control\.getBoundingClientRect\(\)[\s\S]*x>=rect\.left&&x<=rect\.right&&y>=rect\.top&&y<=rect\.bottom/
    );
    assert.match(
        abyss,
        /const boss=abyssState\.phase==="boss"\?map\.querySelector\("\.v141-abyss-boss"\):null;[\s\S]*if\(isAbyssMapControlHit\(event,boss\)\)\{[\s\S]*window\.v141HandleAbyssBossInteraction\(event\);[\s\S]*return;/
    );
});

test("the final walking owner passes a BOSS tap through with its original coordinates",()=>{
    const wrapper=polish.slice(polish.indexOf("const previousAbyssMove=window.v141AbyssMoveByEvent;"));
    assert.match(wrapper,/const boss=map\.querySelector\("\.v141-abyss-boss"\);[\s\S]*?const bossHit=!!\(boss&&[\s\S]*?if\(bossHit\)\{ return previousAbyssMove\.apply\(this,arguments\); \}/);
    assert.ok(
        wrapper.indexOf("if(bossHit){ return previousAbyssMove.apply(this,arguments); }")<
        wrapper.indexOf("const synthetic={"),
        "BOSS input must be delegated before a one-step coordinate is created"
    );
});

test("the old proximity wrapper no longer swallows portrait taps",()=>{
    assert.doesNotMatch(polish,/previousAbyssChallenge/);
    assert.doesNotMatch(polish,/distance>20/);
    assert.doesNotMatch(polish,/距離太遠，請先走到守關者旁邊/);
});

console.log("\nV157 Abyss map tap fix suite: "+passed+" tests passed.");
