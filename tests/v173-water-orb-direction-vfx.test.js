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
        /waterBall:\{[\s\S]*?hit:\.5833333333[\s\S]*?frames:12,frameWidth:384,frameHeight:384,hitFrame:7,\s*placement:"group",renderer:"canvas-crop"/
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

test("Canvas visits frames left-to-right, top-to-bottom once without per-target travel",()=>{
    assert.match(animation,/const column=frameIndex%4;[\s\S]*?const row=Math\.floor\(frameIndex\/4\);/);
    assert.match(animation,/const sourceX=column\*384;[\s\S]*?const sourceY=row\*384;/);
    assert.match(animation,/if\(progress<1\)\{ scheduleCanvasCropSprite\(runtime\); \}/);
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v166-water-cast-sprite/);
});

test("the published build label is V173.39",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.58"/);
    assert.match(index,/aria-label="目前版本 V173\.58"[\s\S]*?>V173\.58<\/div>/);
});

console.log("\nV173 Water Ball target-group VFX suite: "+passed+" tests passed.");
