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

test("V173 keeps the original twelve-frame Water Orb sprite",()=>{
    const asset=fs.readFileSync("assets/vfx/water/water-orb-vfx.png");
    assert.equal(
        crypto.createHash("sha256").update(asset).digest("hex"),
        "d3bdcafbd65965a9c54c9785baa1922849f11f1c1fc905bf6c4723024c745c2d"
    );
    assert.match(
        animation,
        /waterBall:\{[\s\S]*?hit:\.5833333333[\s\S]*?frames:12,hitFrame:7,placement:"targetTrajectory",travelToTargets:true/
    );
});

test("Water Orb owns a dedicated travel timeline and Flood Beast keeps its old one",()=>{
    assert.match(
        css,
        /data-skill="waterBall"[^\{]*v166-water-cast-sprite\{[\s\S]*?v173WaterOrbTargetTravel/
    );
    assert.match(
        css,
        /data-skill="floodBeast"[^\{]*v166-water-cast-sprite\{[\s\S]*?v166WaterTargetTravel/
    );
});

test("Frames five through seven rotate each real projectile toward its target",()=>{
    assert.match(
        css,
        /data-target-side="monster"[^\{]*\{\s*--v173-water-flight-rotation:90deg;/
    );
    assert.match(
        css,
        /data-target-side="player"[^\{]*\{\s*--v173-water-flight-rotation:-90deg;/
    );
    const travel=css.match(/@keyframes v173WaterOrbTargetTravel\{[\s\S]*?\n\}/);
    assert.ok(travel);
    for(const boundary of ["33.333%","58.332%"]){
        const escaped=boundary.replace(".","\\.");
        assert.match(
            travel[0],
            new RegExp(escaped+"\\{[\\s\\S]*?clip-path:var\\(--v166-water-flight-clip\\);[\\s\\S]*?transform-origin:50% 25%;[\\s\\S]*?rotate\\(var\\(--v173-water-flight-rotation\\)\\)")
        );
    }
});

test("Frame eight hits with the lower splash and frames nine through twelve use full explosions",()=>{
    const travel=css.match(/@keyframes v173WaterOrbTargetTravel\{[\s\S]*?\n\}/);
    assert.ok(travel);
    assert.match(
        travel[0],
        /58\.333%,66\.665%\{[\s\S]*?left:var\(--v143-sprite-target-left\);[\s\S]*?clip-path:var\(--v166-water-impact-clip\);[\s\S]*?transform-origin:50% 75%;[\s\S]*?rotate\(0deg\)/
    );
    assert.match(
        travel[0],
        /66\.666%,95%\{[\s\S]*?left:var\(--v143-sprite-target-left\);[\s\S]*?top:var\(--v143-sprite-target-top\);[\s\S]*?clip-path:var\(--v166-water-full-clip,inset\(0\)\);[\s\S]*?rotate\(0deg\)/
    );
});

test("Only actual targets receive copies and the published build label is V173.8",()=>{
    assert.match(
        animation,
        /const key=placement==="single"\|\|placement==="targetTrajectory"\?index:"main";/
    );
    assert.match(
        animation,
        /if\(!current\.validTargets\.has\(index\)\)\{ return; \}[\s\S]*?if\(!allowDefeated&&!canReceive\(current\.config,current\.targetSide,index\)\)\{ return; \}/
    );
    assert.match(
        animation,
        /node\.dataset\.formationLead=current\.spriteNodes\.size===0\?"true":"false";/
    );
    assert.match(loader,/const V_ASSET_VERSION="173\.8"/);
    assert.match(index,/aria-label="目前版本 V173\.8"[\s\S]*?>V173\.8<\/div>/);
});

console.log("\nV173 Water Orb direction VFX suite: "+passed+" tests passed.");
