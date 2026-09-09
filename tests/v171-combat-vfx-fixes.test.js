"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const animation=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const legacyRules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const finalWaterRules=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");

let passed=0;
function test(name,handler){ handler(); passed++; console.log("✓ "+name); }

test("V171 cache-busts every changed combat asset",()=>{
    assert.match(loader,/const V_ASSET_VERSION="173\.64"/);
    assert.match(index,/js\/00-main\.js\?v=173\.64/);
    assert.match(index,/js\/20-anonymous-20\.js\?v=173\.64/);
});

test("Tidal Beast is single-target Frostbite and has no legacy team Freeze path",()=>{
    assert.doesNotMatch(legacyRules,/teamFreezeChance|teamFreezeDuration/);
    assert.doesNotMatch(legacyRules,/applyTeamFreezeToMonsters|applyTeamFreezeToPlayers/);
    const finalDefinition=finalWaterRules.match(/floodBeast:\{[\s\S]*?\n\s*\},\n\s*iceArrowRain:/);
    assert.ok(finalDefinition);
    assert.match(finalDefinition[0],/targetType:"single"/);
    assert.match(finalDefinition[0],/frostbiteChance:35,frostbiteDuration:2/);
    assert.doesNotMatch(finalDefinition[0],/freezeChance|teamFreeze/);
    assert.match(
        animation,
        /floodBeast:\{[\s\S]*?deferredStatusTypes:\["frostbite"\][\s\S]*?scale:1\.85,minSize:175,maxSize:250/
    );
});

test("Water trajectories use resolved actor-target geometry before raster activation",()=>{
    const addSprite=animation.indexOf("function addSprite(current,index,target)");
    const append=animation.indexOf("node=appendSpriteNode(current);",addSprite);
    const place=animation.indexOf("placeSprite(current,node,index,target);",addSprite);
    const activate=animation.indexOf('node.classList.add("v143-vfx-sprite-active")',place);
    assert.ok(addSprite>=0&&append>addSprite&&place>append&&activate>place);
    assert.match(animation,/if\(placement==="targetTrajectory"\)\{[\s\S]*?node\.style\.left=actor\.x\+"px";[\s\S]*?node\.style\.top=actor\.y\+"px";[\s\S]*?--v143-sprite-dx",target\.x-actor\.x\+"px"[\s\S]*?--v143-sprite-dy",target\.y-actor\.y\+"px"/);
    assert.match(animation,/if\(placement==="trajectory"&&sprite\.travelToTargets&&actor\)\{[\s\S]*?--v143-sprite-dx",destination\.x-actor\.x\+"px"[\s\S]*?--v143-sprite-dy",destination\.y-actor\.y\+"px"/);
    assert.doesNotMatch(animation,/--v143-sprite-start-left|--v143-sprite-start-top|--v143-sprite-target-left|--v143-sprite-target-top/);
    assert.match(css,/\.v143-vfx-sprite\.v143-vfx-sprite-active\[data-travel="true"\][\s\S]*?v143RasterTravel/);
    assert.match(css,/@keyframes v143RasterTravel\{/);
    assert.doesNotMatch(css,/v166WaterTargetTravel/);
});

test("Ice Arrow Rain uses one centered full-field raster sheet without tiles",()=>{
    const battlefield=animation.match(/if\(placement==="battlefield"\)\{[\s\S]*?\n\s*return;\n\s*\}/);
    assert.ok(battlefield);
    assert.match(battlefield[0],/const bounds=sideAreaBounds\(current\.targetSide\)/);
    assert.match(battlefield[0],/const coverageScale=clamp\(Number\(sprite\.coverageScale\)\|\|Number\(sprite\.scale\)\|\|1,1,1\.4\)/);
    assert.match(battlefield[0],/Math\.round\(bounds\.width\*coverageScale\)/);
    assert.match(battlefield[0],/Math\.round\(bounds\.height\*coverageScale\)/);
    assert.match(battlefield[0],/node\.style\.width=width\+"px"/);
    assert.match(battlefield[0],/node\.style\.height=height\+"px"/);
    assert.match(battlefield[0],/node\.style\.left=\(bounds\.left\+bounds\.width\/2\)\+"px"/);
    assert.match(battlefield[0],/node\.style\.top=\(bounds\.top\+bounds\.height\/2\)\+"px"/);
    assert.match(battlefield[0],/node\.style\.clipPath="none"/);
    assert.doesNotMatch(battlefield[0],/buildBattlefieldSpriteTiles\(node,sprite,bounds\)/);
    assert.doesNotMatch(css,/\.v166-water-battlefield-tile\{/);
});

test("Rage cast and loop remain visible and card-anchored on both sides",()=>{
    assert.match(
        animation,
        /rage:\{[\s\S]*?rage-cast\.png\?v=165[\s\S]*?scale:1\.08,minSize:96,maxSize:148/
    );
    assert.match(
        animation,
        /type==="rage"&&current\.config\.id==="rage"[\s\S]*?v143-effects-pending/
    );
    assert.match(
        css,
        /\.v153-status-vfx-rage\{[\s\S]*?z-index:5;[\s\S]*?opacity:1;/
    );
    assert.match(
        css,
        /battle-monster\.v152-abyss-portrait\s*>\s*\.v153-status-vfx\{[\s\S]*?position:absolute\s*!important;[\s\S]*?z-index:5\s*!important;/
    );
});

console.log("\nV171 combat VFX fixes suite: "+passed+" tests passed.");
