"use strict";

/* HISTORICAL SPEC SNAPSHOT (V160): 只保留該版驗收紀錄；V170 最終規格以 v170-final-spec-integration.test.js 為準。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const balance=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const latest=fs.readFileSync("js/44-v152-dev-fixes.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("V160 corrections remain published under the current cache version",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.2"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.2/);
});

test("Ice Arrow Rain ends at twenty percent Freeze for two rounds",()=>{
    assert.match(latest,/patchSkill\("iceArrowRain",\{[\s\S]*?freezeChance:20,freezeDuration:2/);
    assert.match(latest,/20%基礎機率冰封2回合/);
});

test("hard-control caps end at regular eighty, elite sixty and boss forty",()=>{
    assert.match(balance,/regular:\{min:5,max:80\}/);
    assert.match(balance,/elite:\{min:5,max:60\}/);
    assert.match(balance,/boss:\{min:5,max:40\}/);
});

test("Rage tri-target detection cannot be mistaken for all targets",()=>{
    assert.match(animation,/const all=targetType==="all"\|\|targetType==="allyAll"/);
    assert.doesNotMatch(animation,/const all=\/all\/i\.test\(targetType\)/);
});

test("Element Box rotates recovery and Fire Rocket stays bounded",()=>{
    assert.match(recovery,/let pending=entries\.slice\(\)/);
    assert.match(recovery,/pending\.forEach\(entry=>/);
    assert.match(animation,/fire-rocket-cast\.png[\s\S]*?scale:\.72,minSize:180,maxSize:280/);
});

console.log("\nV160 current-request suite: "+passed+" tests passed.");
