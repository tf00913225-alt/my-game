"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const asset=fs.readFileSync("assets/vfx/fire/flame-slash-cast.png");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const wordRules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const css=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("the supplied Fire Slash asset is a real RGBA PNG with twelve 384px cells",()=>{
    assert.equal(asset.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.deepEqual([asset.readUInt32BE(16),asset.readUInt32BE(20)],[1536,1152]);
    assert.equal(asset[24],8);
    assert.equal(asset[25],6);
    assert.deepEqual([1536/4,1152/3],[384,384]);
});

test("flameSlash uses the exact one-shot 4 by 3 Sprite metadata",()=>{
    assert.match(animation,/flameSlash:\{[\s\S]*?flame-slash-cast\.png[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,placement:"single"/);
});

test("Fire Slash lasts 0.76 seconds and starts its hit on frame eight",()=>{
    assert.match(timing,/flameSlash:\[760,"basic","slash"\]/);
    assert.match(animation,/flameSlash:\{[\s\S]*?hit:\.5833333333/);
});

test("the official Sprite bypasses the old word-circle fallback",()=>{
    assert.match(wordRules,/if\(existing&&existing\.sprite\)\{[\s\S]*?return previousPlay\(config,meta\)/);
    assert.doesNotMatch(css,/v149-word-flameSlash|v160FlameSlashImpact/);
});

test("the current cache version publishes the corrected source asset and metadata",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.16"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.16/);
});

console.log("\nV161 Fire Slash VFX suite: "+passed+" tests passed.");
