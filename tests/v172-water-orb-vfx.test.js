"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8")+fs.readFileSync("scripts/build-production.mjs","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("Water Ball uses the supplied 1536×1152 raster sheet",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(asset.toString("ascii",12,16),"IHDR");
    assert.deepEqual([asset.readUInt32BE(16),asset.readUInt32BE(20)],[1536,1152]);
    assert.match(
        animation,
        /function castSheet\(src,placement,options\)\{[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,[\s\S]*?renderer:"dom-sprite"/
    );
    assert.match(
        animation,
        /waterBall:\{hit:DEFAULT_HIT,sprite:castSheet\("assets\/vfx\/water\/water-orb-vfx\.png\?v=173\.19","group",\{[\s\S]*?alignToSlots:true[\s\S]*?\}\)\}/
    );
});

test("Water Ball remains one centered live-target group without a Canvas path",()=>{
    assert.match(
        animation,
        /const key=placement==="single"\|\|placement==="targetTrajectory"\?String\(index\):"main";/
    );
    assert.match(
        animation,
        /function emittedSpriteTargets\(current\)\{[\s\S]*?canReceive\(current\.config,current\.targetSide,index\)/
    );
    assert.doesNotMatch(
        animation,
        /current\.config\.id==="waterBall"&&placement==="targetTrajectory"/
    );
    assert.match(animation,/node\.dataset\.renderer="dom-sprite";/);
    assert.doesNotMatch(animation,/createElement\(["']canvas["']\)|getContext\(|drawImage\(|canvas-crop/);
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v166-water-cast-sprite/);
});

test("Water Ball lasts 1.4 seconds and the 4×3 Sprite Sheet advances through CSS frames",()=>{
    assert.match(timing,/waterBall:\[1400,"basic","projectile"\]/);
    assert.match(css,/@keyframes v143RasterCastFrames/);
    assert.match(css,/25%\{background-position:100% 0\}/);
    assert.match(css,/66\.666667%\{background-position:0 100%\}/);
    assert.match(css,/91\.666667%,100%\{background-position:100% 100%\}/);
});

test("the current cache version publishes the grouped Water Ball choreography",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.64"/);
    assert.match(index,/build\/boot-core\.[0-9a-f]{12}\.js/);
    assert.match(index,/id="homeVersionBadge"[\s\S]*?aria-label="目前版本 V173\.64"[\s\S]*?>V173\.64<\/div>/);
});

console.log("\nV172 Water Ball VFX suite: "+passed+" tests passed.");
