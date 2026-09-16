"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const waterRules=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");

const manifest=animation.match(/waterBall:\{hit:DEFAULT_HIT,sprite:castSheet\("assets\/vfx\/water\/water-orb-vfx\.png\?v=173\.19","group",\{[\s\S]*?alignToSlots:true[\s\S]*?\}\)\}/);
assert.ok(manifest,"Water Ball remains one formal group raster Sprite");
assert.match(waterRules,/waterBall:\{[\s\S]*?targetType:"tri"/,"Water Ball remains a formal tri-target skill");

const geometryBounds=animation.match(/function geometryBounds\(current,indexes,placement\)\{[\s\S]*?\n\s*return rect;\n\s*\}/);
assert.ok(geometryBounds,"formal Fixed Slot geometry resolver exists");
assert.match(geometryBounds[0],/const owner=geometryOwner\(\)/);
assert.match(geometryBounds[0],/const seed=geometrySeedIndexes\(current,indexes\)/);
assert.match(geometryBounds[0],/let primarySlot=geometryPrimarySlot\(current,indexes\)/);
assert.match(geometryBounds[0],/const normalizedTri=\/tri\/i\.test\(targetType\)/);
assert.match(geometryBounds[0],/owner\.getGeometryRectFromShape\(current\.targetSide,primarySlot,shape\)/);

const placeSprite=animation.match(/function placeSprite\(current,node,index,target\)\{[\s\S]*?\n\s*\}\n\n\s*function addSprite/);
assert.ok(placeSprite,"formal Sprite placement function exists");
assert.match(placeSprite[0],/const indexes=emittedSpriteTargets\(current\)/);
assert.match(placeSprite[0],/const bounds=geometryBounds\(current,indexes,placement\)/);
assert.match(placeSprite[0],/const destination=\{x:bounds\.centerX,y:bounds\.centerY\}/);
assert.match(placeSprite[0],/const actor=placement==="trajectory"\?slotAnchor\(current\.side,current\.actorIndex,current\.actorCard\):null/);
assert.match(placeSprite[0],/else\{[\s\S]*?node\.style\.left=bounds\.centerX\+"px";[\s\S]*?node\.style\.top=bounds\.centerY\+"px"/);
assert.doesNotMatch(placeSprite[0],/targetCards=indexes\.map\([^\n]*cardFor/,"retired card-rect group geometry must not return");
assert.doesNotMatch(manifest[0],/targetTrajectory/,"Water Ball must remain a group Sprite, not caster-to-target travel");

console.log("V173 Water Ball Fixed Slot contract diagnosis passed.");
