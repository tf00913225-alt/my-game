"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("Water Ball owns a 12-frame, 4x3 group raster sprite with the frame-eight hit",()=>{
    assert.match(animation,/function castSheet\(src,placement,options\)[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,[\s\S]*?renderer:"dom-sprite"/);
    assert.match(
        animation,
        /waterBall:\{hit:DEFAULT_HIT,sprite:castSheet\("assets\/vfx\/water\/water-orb-vfx\.png\?v=173\.19","group",\{[\s\S]*?alignToSlots:true[\s\S]*?\}\)\}/
    );
    assert.match(animation,/const DEFAULT_HIT=\.5833333333;/);
});

test("the single group VFX is centered on actual live targets rather than the caster",()=>{
    const placement=animation.slice(animation.indexOf("function placeSprite(current,node,index,target){"));
    assert.match(
        placement,
        /const indexes=emittedSpriteTargets\(current\);[\s\S]*?const targetCards=indexes\.map\(i=>cardFor\(current\.targetSide,i\)\)\.filter\(Boolean\)/
    );
    assert.match(
        placement,
        /const destination=\{[\s\S]*?x:targetBounds\.left\+targetBounds\.width\/2,[\s\S]*?y:targetBounds\.top\+targetBounds\.height\/2/
    );
    assert.doesNotMatch(placement,/waterBall.*targetTrajectory/);
});

test("CSS advances the formal 4x3 sheet once without Canvas or per-target travel",()=>{
    assert.match(css,/@keyframes v143RasterCastFrames/);
    assert.match(css,/0%\{background-position:0 0\}/);
    assert.match(css,/25%\{background-position:100% 0\}/);
    assert.match(css,/33\.333333%\{background-position:0 50%\}/);
    assert.match(css,/66\.666667%\{background-position:0 100%\}/);
    assert.match(css,/91\.666667%,100%\{background-position:100% 100%\}/);
    assert.doesNotMatch(animation,/createElement\(["']canvas["']\)|getContext\(|drawImage\(|scheduleCanvasCropSprite|canvas-crop/);
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v166-water-cast-sprite/);
});

test("the published build label is V173.65",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.65"/);
    assert.match(index,/aria-label="目前版本 V173\.65"[\s\S]*?>V173\.65<\/div>/);
});

console.log("\nV173 Water Ball target-group raster VFX suite: "+passed+" tests passed.");
