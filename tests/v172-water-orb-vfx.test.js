"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("Water Ball uses the supplied 1536×1152 inbox sheet with an explicit fixed crop",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(asset.toString("ascii",12,16),"IHDR");
    assert.deepEqual([asset.readUInt32BE(16),asset.readUInt32BE(20)],[1536,1152]);
    assert.match(
        animation,
        /waterBall:\{[\s\S]*?water-orb-vfx\.png\?v=173\.19[\s\S]*?columns:4,rows:3,frames:12,frameWidth:384,frameHeight:384,hitFrame:7,[\s\S]*?placement:"group",renderer:"canvas-crop"/
    );
});

test("Water Ball remains one centered live-target group and no longer uses the CSS sheet path",()=>{
    assert.match(
        animation,
        /const key=placement==="single"\|\|placement==="targetTrajectory"\?index:"main";/
    );
    assert.match(
        animation,
        /function emittedSpriteTargets\(current\)\{[\s\S]*?canReceive\(current\.config,current\.targetSide,index\)/
    );
    assert.doesNotMatch(
        animation,
        /current\.config\.id==="waterBall"&&placement==="targetTrajectory"/
    );
    assert.match(animation,/node\.dataset\.renderer="canvas-crop";[\s\S]*?node\.style\.backgroundImage="none";/);
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v166-water-cast-sprite/);
});

test("Water Ball lasts 1.4 seconds and renders exactly one Canvas crop per frame",()=>{
    assert.match(timing,/waterBall:\[1400,"basic","projectile"\]/);
    assert.match(animation,/const frameIndex=Math\.min\(11,Math\.floor\(progress\*12\)\);/);
    assert.match(animation,/sourceX,[\s\S]*?sourceY,[\s\S]*?384,[\s\S]*?384,[\s\S]*?0,[\s\S]*?0,[\s\S]*?node\.width,[\s\S]*?node\.height/);
});

test("the current cache version publishes the grouped Water Ball choreography",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.19"/);
    assert.match(index,/js\/00-main\.js\?v=173\.19/);
    assert.match(index,/id="homeVersionBadge"[\s\S]*?aria-label="目前版本 V173\.19"[\s\S]*?>V173\.19<\/div>/);
});

console.log("\nV172 Water Ball VFX suite: "+passed+" tests passed.");
