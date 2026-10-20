"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");

const asset=fs.readFileSync("assets/vfx/fire/flame-slash-cast-v2.webp");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("Fire Slash preserves the reviewed generated candidate exactly",()=>{
 const candidate=fs.readFileSync("tools/vfx-commercial-sample/assets/full/flame-slash-v3.webp");
 assert.equal(crypto.createHash("sha256").update(asset).digest("hex"),crypto.createHash("sha256").update(candidate).digest("hex"));
 const info=losslessWebpInfo(asset);assert.deepEqual([info.width,info.height,info.alpha],[1448,1086,1]);assert.equal(info.width/4,info.height/3);
});

test("Fire Slash keeps the requested target, timing, and frame-eight hit under the raster owner",()=>{
    assert.match(animation,/function castSheet\(src,placement,options\)\{[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,[\s\S]*?placement:placement\|\|"single",renderer:"dom-sprite"/);
    assert.match(animation,/flameSlash:\{hit:DEFAULT_HIT,sprite:castSheet\("assets\/vfx\/fire\/flame-slash-cast-v2\.webp","single",\{scale:1\.85,maxSize:220\}\)\}/);
    assert.match(timing,/flameSlash:\[760,"basic","slash"\]/);
});

test("the current cache version publishes the replacement asset",()=>{
    const assetVersionMatch=loader.match(/const V_ASSET_VERSION="([^"]+)"/);
    assert.equal(assetVersionMatch?.[1],releaseMeta.cacheVersion);
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
});

console.log("\nV163 Fire Slash source suite: "+passed+" tests passed.");


function losslessWebpInfo(file){
 const b=Buffer.isBuffer(file)?file:fs.readFileSync(file);
 assert.equal(b.toString("ascii",0,4),"RIFF");assert.equal(b.toString("ascii",8,12),"WEBP");
 for(let o=12;o+8<=b.length;){const type=b.toString("ascii",o,o+4),size=b.readUInt32LE(o+4),p=o+8;assert.ok(p+size<=b.length,"complete WebP chunk");if(type==="VP8L"){assert.equal(b[p],0x2f);const bits=b.readUInt32LE(p+1);return {width:1+(bits&16383),height:1+((bits>>>14)&16383),alpha:(bits>>>28)&1};}o=p+size+(size%2);}
 throw new Error("Expected lossless VP8L image");
}
