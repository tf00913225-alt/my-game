"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const balance=fs.readFileSync("js/33-v140-four-element-balance.js","utf8");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const rules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const latest=fs.readFileSync("js/44-v152-dev-fixes.js","utf8");
const recovery=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const css=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("cache version 160 publishes the focused source-layer corrections",()=>{
    assert.match(loader,/const V_ASSET_VERSION="160"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=160/);
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

test("Element Box rotates recovery and the two Fire animations stay bounded",()=>{
    assert.match(recovery,/let pending=entries\.slice\(\)/);
    assert.match(recovery,/pending\.forEach\(entry=>/);
    assert.match(animation,/fire-rocket-cast\.png[\s\S]*?scale:\.72,minSize:180,maxSize:280/);
    assert.match(rules,/impact:flameSlash\?"flame-cut":"storm-domain",hit:flameSlash\?\.58:\.75/);
    assert.match(css,/@keyframes v160FlameSlashImpact/);
});

console.log("\nV160 current-request suite: "+passed+" tests passed.");
