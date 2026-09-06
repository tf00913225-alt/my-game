"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");

const asset=fs.readFileSync("assets/vfx/fire/flame-slash-cast.png");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("the verified inbox PNG is preserved in the normalized Fire Slash asset",()=>{
    assert.equal(
        crypto.createHash("sha256").update(asset).digest("hex"),
        "07a4dc7695e7ef56fafb9771038a6ff57c4dfcbeecdd128909cc1510c799dafc"
    );
    assert.equal(asset.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.deepEqual([asset.readUInt32BE(16),asset.readUInt32BE(20)],[1536,1152]);
    assert.equal(asset[25],6);
});

test("Fire Slash keeps the requested target, timing, and frame-eight hit",()=>{
    assert.match(animation,/flameSlash:\{[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,placement:"single"/);
    assert.match(timing,/flameSlash:\[760,"basic","slash"\]/);
});

test("the current cache version publishes the replacement asset",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.55"/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.55/);
});

console.log("\nV163 Fire Slash source suite: "+passed+" tests passed.");
