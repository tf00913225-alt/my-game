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
    assert.match(loader,/const V_ASSET_VERSION="173\.5"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.5/);
});

test("Abyss map portraits use the reduced mobile size and keep a full button hit area",()=>{
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*width:120px !important;[\s\S]*height:168px !important;/);
    assert.match(css,/\.v141-abyss-boss\{[\s\S]*touch-action:manipulation !important;/);
    assert.match(abyss,/<button class="v141-abyss-boss"[\s\S]*onclick="event\.stopPropagation\(\);v141ChallengeAbyssBoss\(\)"/);
});

test("the old proximity wrapper no longer swallows portrait taps",()=>{
    assert.doesNotMatch(polish,/previousAbyssChallenge/);
    assert.doesNotMatch(polish,/distance>20/);
    assert.doesNotMatch(polish,/距離太遠，請先走到守關者旁邊/);
});

console.log("\nV157 Abyss map tap fix suite: "+passed+" tests passed.");
