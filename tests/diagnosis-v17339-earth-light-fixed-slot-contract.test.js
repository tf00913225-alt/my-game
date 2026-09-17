"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");

const earthTri=["petrifyFist","earthquakeCrush","stoneThrow","sandWind","earthShield","rockWall"];
earthTri.forEach(id=>{
    const pattern=new RegExp(id+":\\{[\\s\\S]*?sprite:castSheet\\([^\\n]*?,\"group\",\\{[\\s\\S]*?alignToSlots:true");
    assert.match(animation,pattern,id+" must remain a formal Fixed Slot aligned group cast");
});

assert.match(animation,/flyingSandStrike:\{[\s\S]*?sprite:castSheet\([^\n]*?,"battlefield",/);
assert.match(animation,/yuanZuBlessing:\{[\s\S]*?sprite:castSheet\([^\n]*?,"battlefield",/);

assert.match(animation,/function geometryBounds\(current,indexes,placement\)\{[\s\S]*?const owner=geometryOwner\(\);/);
assert.match(animation,/if\(placement==="battlefield"\|\|targetType==="all"\|\|targetType==="allyAll"\)\{[\s\S]*?owner\.getSideRect\(current\.targetSide\)/);
assert.match(animation,/let shape=targetType;[\s\S]*?owner\.getGeometryRectFromShape\(current\.targetSide,primarySlot,shape\)/);
assert.match(animation,/const indexes=emittedSpriteTargets\(current\);[\s\S]*?const bounds=geometryBounds\(current,indexes,placement\);[\s\S]*?if\(!bounds\)\{ return; \}/);
assert.match(animation,/node\.style\.left=bounds\.centerX\+"px";[\s\S]*?node\.style\.top=bounds\.centerY\+"px";/);

assert.doesNotMatch(animation,/function fixedTriLayoutBounds\(current,indexes\)/);
assert.doesNotMatch(animation,/const coverage=sprite\.alignToSlots\?targetBounds:/);
assert.doesNotMatch(animation,/canvas-crop|getContext\(|drawImage\(|createElement\(["']canvas["']\)/);

console.log("V173.39 Earth/Light Fixed Slot source contract diagnosis passed.");
