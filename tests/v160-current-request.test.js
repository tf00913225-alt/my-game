"use strict";

/* HISTORICAL SPEC SNAPSHOT (V160): 非水系項目仍保留該版驗收紀錄；水系正式數值已由目前 V169 owner 依最新規格取代。 */

const assert=require("node:assert/strict");
const fs=require("node:fs");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const balance=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const finalWater=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("V160 corrections remain published under the current cache version",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.62"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.62/);
});

test("Ice Arrow Rain follows the current thirty-five percent Frostbite for two rounds",()=>{
    assert.match(finalWater,/iceArrowRain:\{[\s\S]*?frostbiteChance:35,frostbiteDuration:2/);
    assert.match(finalWater,/35%基礎機率【凍傷】2回合/);
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
