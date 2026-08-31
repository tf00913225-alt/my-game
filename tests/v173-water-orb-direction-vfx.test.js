"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("Water Ball owns a 12-frame, 4x3 group sprite with the frame-eight hit",()=>{
    assert.match(
        animation,
        /waterBall:\{[\s\S]*?hit:\.5833333333[\s\S]*?frames:12,hitFrame:7,placement:"group"/
    );
});

test("the single group VFX is centered on actual live targets rather than the caster",()=>{
    const placement=animation.slice(animation.indexOf("function placeSprite(current,node,index,target){"));
    assert.match(
        placement,
        /const indexes=emittedSpriteTargets\(current\);[\s\S]*?const targetCards=indexes\.map\(targetIndex=>cardFor\(current\.targetSide,targetIndex\)\)/
    );
    assert.match(
        placement,
        /const destination=\{[\s\S]*?x:targetBounds\.left\+targetBounds\.width\/2,[\s\S]*?y:targetBounds\.top\+targetBounds\.height\/2/
    );
    assert.doesNotMatch(placement,/waterBall.*targetTrajectory/);
});

test("the CSS visits frames left-to-right, top-to-bottom once without a per-target travel animation",()=>{
    assert.match(css,/@keyframes v166WaterCastFrames\{[\s\S]*?33\.333333%\{background-position:0 50%\}[\s\S]*?66\.666667%\{background-position:0 100%\}/);
    assert.match(css,/data-skill="waterBall"[\s\S]*?v166WaterCastEnvelope/);
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v173WaterOrbTargetTravel/);
});

test("the published build label is V173.11",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.11"/);
    assert.match(index,/aria-label="目前版本 V173\.11"[\s\S]*?>V173\.11<\/div>/);
});

console.log("\nV173 Water Ball target-group VFX suite: "+passed+" tests passed.");
