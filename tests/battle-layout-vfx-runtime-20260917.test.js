"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const index=fs.readFileSync("index.html","utf8");
const layoutCss=fs.readFileSync("css/fixed-slot-battlefield-rendering-v2.css","utf8");
const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const timing=fs.readFileSync("js/37-v142-skill-animation.js","utf8");
const fireWindEarthRules=fs.readFileSync("js/43-v149-skill-ui-rules.js","utf8");
const waterRules=fs.readFileSync("js/50-v169-water-skill-rules.js","utf8");
const bossSystem=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");

function sourceTargetType(source,id){
    const start=source.indexOf(id+":{");
    assert.ok(start>=0,"missing final rule for "+id);
    const block=source.slice(start,start+700);
    const match=block.match(/targetType:"([^"]+)"/);
    assert.ok(match,"missing targetType for "+id);
    return match[1];
}

function authoredPlacement(id){
    const start=vfx.indexOf(id+":{");
    assert.ok(start>=0,"missing VFX manifest entry for "+id);
    const block=vfx.slice(start,start+520);
    const match=block.match(/castSheet\([^,]+,"([^"]+)"/);
    assert.ok(match,"missing cast placement for "+id);
    return match[1];
}

const placementContext={};
vm.createContext(placementContext);
vm.runInContext(
    vfx.slice(vfx.indexOf("    function placementFor("),vfx.indexOf("    function hasTimedEffect(")),
    placementContext
);

const ELEMENT_DAMAGE_SKILLS={
    fire:{
        single:["flameSlash","fireCritical","dragonSlash","blazeSpell","flameTornado"],
        tri:["explosiveFlurry","fireRocket"],all:["phoenixCry"]
    },
    water:{
        single:["waterKnife","frostPunch","frostCrush","floodBeast"],
        tri:["iceSpin","waterBall"],all:["iceArrowRain"]
    },
    wind:{
        single:["stormFist","windCrossSlash","dizzyFist","windHowlLightning"],
        tri:["stormFlurry","windSpell","stormCircle"],all:["stormRain"]
    },
    earth:{
        single:["stoneSlash","stoneBreakSky","dustStorm"],
        tri:["petrifyFist","earthquakeCrush","stoneThrow","sandWind"],all:["flyingSandStrike"]
    }
};

for(const [element,groups] of Object.entries(ELEMENT_DAMAGE_SKILLS)){
    const rules=element==="water"?waterRules:fireWindEarthRules;
    for(const id of groups.single){
        const targetType=sourceTargetType(rules,id);
        assert.equal(targetType,"single",id+" final target type");
        assert.ok(["single","targetTrajectory"].includes(
            placementContext.placementFor({targetType},{placement:authoredPlacement(id)})
        ),id+" must keep a single-target footprint");
    }
    for(const id of groups.tri){
        const targetType=sourceTargetType(rules,id);
        assert.equal(targetType,"tri",id+" final target type");
        assert.ok(["group","trajectory"].includes(
            placementContext.placementFor({targetType},{placement:authoredPlacement(id)})
        ),id+" must use one fixed three-slot footprint");
    }
    for(const id of groups.all){
        const targetType=sourceTargetType(rules,id);
        assert.equal(targetType,"all",id+" final target type");
        assert.equal(
            placementContext.placementFor({targetType},{placement:authoredPlacement(id)}),
            "battlefield",id+" must use the complete fixed-side footprint"
        );
    }
}

assert.match(index,/<section class="battle-enemy-region"[\s\S]*id="battleMonsterArea"[\s\S]*<section class="battle-center-region"[\s\S]*id="turnTargetRow"[\s\S]*id="battleActionRegion"[\s\S]*<section class="battle-ally-region"[\s\S]*id="battlePlayerRow"[\s\S]*<section class="battle-info-region"[\s\S]*id="battleInfo"/);
const centerMarkup=index.slice(index.indexOf('<section class="battle-center-region"'),index.indexOf('<section class="battle-ally-region"'));
assert.doesNotMatch(centerMarkup,/id="battleInfo"/,"the bottom battle log must not be owned by the middle controls");
assert.doesNotMatch(index,/<div class="battle-monster-gap-filler"><\/div>/,"legacy space-filler must not own battle layout");
assert.match(layoutCss,/--battle-enemy-region-track:42fr/);
assert.match(layoutCss,/--battle-center-region-track:14fr/);
assert.match(layoutCss,/--battle-ally-region-track:44fr/);
assert.match(layoutCss,/grid-template-rows:[\s\S]*var\(--battle-enemy-region-track\)[\s\S]*var\(--battle-center-region-track\)[\s\S]*var\(--battle-ally-region-track\)/);
assert.doesNotMatch(layoutCss,/--battle-info-region-track/,"battle info must not consume a structural grid track");
assert.match(layoutCss,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,"enemy slots remain equal width");
assert.match(layoutCss,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,"ally slots remain equal width");
assert.match(layoutCss,/--battle-ally-row-height:calc\(/,"front/back ally containers share one size token");
assert.match(layoutCss,/\.battle-info-region\{[\s\S]*position:absolute !important;[\s\S]*transform:translateY\(calc\(100% - var\(--battle-info-handle-height\)\)\)/,"battle log is a collapsed bottom drawer");
assert.match(layoutCss,/\.battle-info-region\.is-expanded\{[\s\S]*transform:translateY\(0\)/,"battle log drawer can expand without reflowing Slots");
assert.match(layoutCss,/\.battle-center-region\{[\s\S]*background:none !important/,"middle controls must not own a black translucent plate");
assert.match(index,/id="battleInfoToggle"[\s\S]*aria-expanded="false"[\s\S]*onclick="toggleBattleInfoPanel\(\)"/);
assert.match(layoutCss,/\.battle-element-box-button\{[\s\S]*width:66px !important;[\s\S]*height:66px !important/,"the mobile element-box touch target keeps its original large size");
assert.match(layoutCss,/\.v-fixed-ally-slot\{[\s\S]*overflow:visible !important/,"unit artwork must not be clipped by its slot");
assert.match(layoutCss,/\.v143-skill-stage\[data-geometry-owner="fixed-slot"\]\{[\s\S]*overflow:visible !important/,"VFX stage must not clip at a card or region boundary");

assert.match(vfx,/function placementFor\(config,sprite\)/);
assert.match(vfx,/applySpriteBox\(node,width,height,sprite,"cover"\)/,"range VFX must preserve source-frame aspect while covering its semantic geometry");
assert.doesNotMatch(vfx,/applySpriteBox\(node,width,height,sprite,"stretch"\)/,"range VFX must never flatten source frames");
assert.doesNotMatch(vfx,/mechanism:|MECH_L|MECH_C|MECH_R/,"VFX must use normal numeric target entities only");
assert.match(vfx,/isBossIndexForVfx\(current\.targetId\)/,"Boss visual anchoring is independent from target settlement count");
assert.match(vfx,/const key=placement==="single"\|\|placement==="targetTrajectory"\?String\(index\):"main"/,"range casts must own exactly one shared raster node");
assert.match(vfx,/purgeStaleRasterStages\(\)/,"stale stages cannot make Wind Flame look like two simultaneous videos");
assert.match(vfx,/gate\.complete\("v143-render-error"\)/,"synchronous renderer errors must release combat");
assert.match(timing,/v142-render-safety-deadline/,"render-owned actions retain an independent timing deadline");
assert.match(bossSystem,/resolveEnemyDamageTargets\(primaryIndex,targetType\)/,"Boss mode owns an isolated damage-target resolver");
assert.match(bossSystem,/if\(targetType==="all"\|\|targetType==="enemyAll"\)\{ return alive; \}/,"only all-target skills fan out in Boss mode");
assert.match(bossSystem,/return alive\.includes\(primaryIndex\)\?\[primaryIndex\]:\[\]/,"non-all Boss skills hit only the selected entity");
assert.doesNotMatch(bossSystem,/blockingShield|mandatoryMechanismTarget|resolveMechanismAction/);

console.log("Battle drawer layout and four-element VFX range contract passed.");
