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

test("Water Ball keeps the current image until the supplied inbox PNG is available",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(
        crypto.createHash("sha256").update(asset).digest("hex"),
        "d3bdcafbd65965a9c54c9785baa1922849f11f1c1fc905bf6c4723024c745c2d"
    );
    assert.match(
        animation,
        /waterBall:\{[\s\S]*?columns:4,rows:3,frames:12,hitFrame:7,placement:"group",[\s\S]*?scale:1\.22,minSize:150,maxSize:500/
    );
});

test("Water Ball renders one centered, square-preserving sprite for the live target group",()=>{
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
    assert.match(
        css,
        /data-skill="waterBall"[\s\S]*?v166WaterCastFrames[\s\S]*?v166WaterCastEnvelope/
    );
    assert.doesNotMatch(css,/data-skill="waterBall"[\s\S]*?v173WaterOrbTargetTravel/);
});

test("Water Ball lasts 1.4 seconds and retains exact one-frame-at-a-time 4x3 CSS crops",()=>{
    assert.match(timing,/waterBall:\[1400,"basic","projectile"\]/);
    const expected=[
        "0 0","33.333333% 0","66.666667% 0","100% 0",
        "0 50%","33.333333% 50%","66.666667% 50%","100% 50%",
        "0 100%","33.333333% 100%","66.666667% 100%","100% 100%"
    ];
    expected.forEach(position=>assert.ok(css.includes("background-position:"+position),position));
    assert.match(css,/v166WaterCastFrames var\(--v143-sprite-duration,1400ms\) steps\(1,end\)[\s\S]*? 1 both/);
});

test("the current cache version publishes the grouped Water Ball choreography",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.12"/);
    assert.match(index,/js\/00-main\.js\?v=173\.12/);
    assert.match(index,/id="homeVersionBadge"[\s\S]*?aria-label="目前版本 V173\.12"[\s\S]*?>V173\.12<\/div>/);
});

console.log("\nV172 Water Ball VFX suite: "+passed+" tests passed.");
