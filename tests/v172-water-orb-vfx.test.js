"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("Water Orb keeps the original transparent sprite and uses a smaller card-scale effect",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(
        crypto.createHash("sha256").update(asset).digest("hex"),
        "72e9d411e11ec77d030361a2995f71aba7dfa936e7942ca2bdfe2aa22cb2d6fe"
    );
    assert.match(
        animation,
        /waterBall:\{[\s\S]*?placement:"targetTrajectory",travelToTargets:true,[\s\S]*?scale:1\.25,minSize:110,maxSize:165/
    );
});

test("Only one target sprite renders the shared first-four-frame formation",()=>{
    const addSprite=animation.match(/function addSprite\(current,index,target\)\{[\s\S]*?\n    \}/);
    assert.ok(addSprite);
    assert.match(
        addSprite[0],
        /current\.config\.id==="waterBall"&&placement==="targetTrajectory"[\s\S]*?node\.dataset\.formationLead=current\.spriteNodes\.size===0\?"true":"false";[\s\S]*?current\.spriteNodes\.set\(key,node\)/
    );
    assert.match(
        css,
        /data-skill="waterBall"[^\{]*data-formation-lead="false"[^\{]*\{\s*--v166-water-formation-opacity:0;/
    );
    assert.match(
        css,
        /3%,33\.332%\{[\s\S]*?opacity:var\(--v166-water-formation-opacity,1\)/
    );
});

test("Flight frames expose only the projectile and impact frames expose only the target splash",()=>{
    assert.match(
        css,
        /data-skill="waterBall"[^\{]*v166-water-cast-sprite\{\s*--v166-water-full-clip:inset\(0\);\s*--v166-water-flight-clip:inset\(0 0 50% 0\);\s*--v166-water-impact-clip:inset\(50% 0 0 0\);/
    );
    assert.match(
        animation,
        /current\.config\.id==="waterBall"[\s\S]*?--v166-water-orb-half-offset",size\/4\+"px"/
    );
    const travel=css.match(/@keyframes v166WaterTargetTravel\{[\s\S]*?\n\}/);
    assert.ok(travel);
    assert.match(
        travel[0],
        /33\.333%\{[\s\S]*?top:calc\(var\(--v143-sprite-start-top\) \+ var\(--v166-water-orb-half-offset,0px\)\);[\s\S]*?clip-path:var\(--v166-water-flight-clip,none\)/
    );
    assert.match(
        travel[0],
        /58\.332%\{[\s\S]*?top:calc\(var\(--v143-sprite-target-top\) \+ var\(--v166-water-orb-half-offset,0px\)\);[\s\S]*?clip-path:var\(--v166-water-flight-clip,none\)/
    );
    assert.match(
        travel[0],
        /58\.333%,95%\{[\s\S]*?top:calc\(var\(--v143-sprite-target-top\) - var\(--v166-water-orb-half-offset,0px\)\);[\s\S]*?clip-path:var\(--v166-water-impact-clip,none\)/
    );
});

test("Flood Beast keeps the full-frame default while V172 cache-busts the fix",()=>{
    assert.match(css,/clip-path:var\(--v166-water-full-clip,none\)/);
    assert.match(css,/clip-path:var\(--v166-water-flight-clip,none\)/);
    assert.match(css,/clip-path:var\(--v166-water-impact-clip,none\)/);
    assert.match(loader,/const V_ASSET_VERSION="172"/);
    assert.match(index,/js\/00-main\.js\?v=172/);
    assert.match(index,/js\/19-stage-v78-character-inventory-runtime\.js\?v=172/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=172/);
});

console.log("\nV172 Water Orb VFX suite: "+passed+" tests passed.");
