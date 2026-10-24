"use strict";
const castBodySource=require("../.github/scripts/fixtures/cast-body-source.cjs");


const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const asset=fs.readFileSync("assets/vfx/fire/flame-slash-cast-v2.webp");
const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const wordRules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const css=fs.readFileSync("css/44-v149-skill-ui-rules.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");
const releaseMeta=JSON.parse(fs.readFileSync("release/release.json","utf8"));

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

function loadManifest(){
    const context={
        window:null,console,Promise,Date,Math,Number,Object,Array,Set,Map,Proxy,
        navigator:{deviceMemory:4,hardwareConcurrency:4},
        setTimeout,clearTimeout,
        document:{body:{},getElementById:()=>null,querySelectorAll:()=>[]},
        v142SkillAnimationDirector:{
            play(){ return {done:false,promise:new Promise(()=>{}),complete(){ this.done=true; }}; },
            dispose(){},getActive(){ return null; }
        }
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(animation,context);
    return context.v143SkillAnimationManifest;
}

test("Fire Slash is lossless alpha WebP with twelve square cells",()=>{
 const info=losslessWebpInfo(asset);assert.deepEqual([info.width,info.height,info.alpha],[1448,1086,1]);assert.equal(info.width/4,info.height/3);assert.equal(info.width%4,0);assert.equal(info.height%3,0);
});

test("flameSlash uses the exact one-shot 4 by 3 raster Sprite metadata",()=>{
    const model=loadManifest().flameSlash;
    assert.ok(model&&model.sprite);
    assert.equal(model.sprite.src,"assets/vfx/fire/flame-slash-cast-v2.webp");
    assert.equal(model.sprite.renderer,"dom-sprite");
    assert.deepEqual(
        Array.from([model.sprite.columns,model.sprite.rows,model.sprite.frames,model.sprite.hitFrame]),
        [4,3,12,7]
    );
    assert.equal(model.sprite.placement,"single");
});

test("Fire Slash lasts 0.76 seconds and starts its hit on frame eight",()=>{
    assert.match(timing,/flameSlash:\[760,"basic","slash"\]/);
    const model=loadManifest().flameSlash;
    assert.equal(model.hit,.5833333333);
});

test("the official Sprite has no word-circle or procedural fallback",()=>{
    assert.doesNotMatch(wordRules,/installWordCircleDirector|v149-word-|previousPlay\(config,meta\)/);
    assert.doesNotMatch(css,/v149-word-flameSlash|v149-word-circle-stage|v160FlameSlashImpact/);
    assert.doesNotMatch(castBodySource(animation),/createElement\(["']canvas["']\)|getContext\(|drawImage\(|<svg\b/i);
});

test("the current cache version publishes the corrected source asset and metadata",()=>{
    const assetVersionMatch=loader.match(/const V_ASSET_VERSION="([^"]+)"/);
    assert.equal(assetVersionMatch?.[1],releaseMeta.cacheVersion);
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
});

console.log("\nV161 Fire Slash VFX suite: "+passed+" tests passed.");


function losslessWebpInfo(file){
 const b=Buffer.isBuffer(file)?file:fs.readFileSync(file);
 assert.equal(b.toString("ascii",0,4),"RIFF");assert.equal(b.toString("ascii",8,12),"WEBP");
 for(let o=12;o+8<=b.length;){const type=b.toString("ascii",o,o+4),size=b.readUInt32LE(o+4),p=o+8;assert.ok(p+size<=b.length,"complete WebP chunk");if(type==="VP8L"){assert.equal(b[p],0x2f);const bits=b.readUInt32LE(p+1);return {width:1+(bits&16383),height:1+((bits>>>14)&16383),alpha:(bits>>>28)&1};}o=p+size+(size%2);}
 throw new Error("Expected lossless VP8L image");
}
