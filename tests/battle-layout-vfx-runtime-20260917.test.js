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
const relicRuntime=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const legacyBattleCss=fs.readFileSync("css/12-stage-v45-battle-black-overlay-skill-text.css","utf8");
const v143Css=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");

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

assert.match(index,/<section class="battle-enemy-region"[\s\S]*id="battleMonsterArea"[\s\S]*<section class="battle-center-region"[\s\S]*id="battleActionRegion"[\s\S]*id="turnTargetRow"[\s\S]*<section class="battle-ally-region"[\s\S]*id="battlePlayerRow"[\s\S]*<section class="battle-info-region"[\s\S]*id="battleInfo"/);
const centerMarkup=index.slice(index.indexOf('<section class="battle-center-region"'),index.indexOf('<section class="battle-ally-region"'));
assert.doesNotMatch(centerMarkup,/id="battleInfo"/,"the bottom battle log must not be owned by the middle controls");
assert.doesNotMatch(index,/<div class="battle-monster-gap-filler"><\/div>/,"legacy space-filler must not own battle layout");
assert.match(layoutCss,/--battle-enemy-region-track:42fr/);
assert.match(layoutCss,/--battle-center-region-track:16fr/);
assert.match(layoutCss,/--battle-ally-region-track:42fr/);
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

/* Relic cinematic target stacking shares the canonical battle/VFX geometry. */
assert.match(legacyBattleCss,/#battlePage > \.battle-wrap\{[\s\S]*z-index:1 !important;/,
    "the historical battle-wrap stacking context is the regression root");
assert.match(relicRuntime,/battlePage\.querySelector\("\.battle-wrap"\)[\s\S]*host\.appendChild\(node\)/,
    "relic cinematic must render inside the existing battle-wrap stacking context");
assert.match(relicCss,/\.team-relic-battle-presentation\{[^}]*position:fixed[^}]*inset:0/,
    "relic dim layer must cover the complete transformed battle surface, not only battle-wrap content box");
assert.match(relicRuntime,/RELIC_IDENTITY_HOLD_MS=1150/);
assert.match(relicRuntime,/RELIC_IDENTITY_EXIT_MS=420/);
assert.match(relicRuntime,/waitMs\(RELIC_IDENTITY_REVEAL_MS\)[\s\S]*waitMs\(RELIC_IDENTITY_HOLD_MS\)[\s\S]*classList\.add\("identity-exiting"\)[\s\S]*Promise\.all\(\[[\s\S]*waitMs\(RELIC_IDENTITY_EXIT_MS\)[\s\S]*revealRelicTargets\(target\)/,
    "relic sequence must hold identity for 1.15s, then fade identity out while targets brighten, before VFX");
assert.match(relicRuntime,/function relicTargetLayer\(card\)[\s\S]*\.v-fixed-enemy-slot,\.v-fixed-ally-slot,\.v-fixed-boss-footprint/,
    "enemy, ally and Boss target entities must elevate their real Fixed Slot carrier");
assert.match(relicRuntime,/relicFocusedTargetLayers=Array\.from\(new Set\(relicFocusedTargetCards\.map\(relicTargetLayer\)\.filter\(Boolean\)\)\)/);
assert.match(relicCss,/\.v-fixed-enemy-slot\.team-relic-battle-target-layer,[\s\S]*\.v-fixed-ally-slot\.team-relic-battle-target-layer,[\s\S]*\.v-fixed-boss-footprint\.team-relic-battle-target-layer\{z-index:6105!important;\}/);
const relicDimZ=Number((relicCss.match(/team-relic-battle-dim\{[^}]*z-index:(\d+)/)||[])[1]);
const relicTargetZ=Number((relicCss.match(/team-relic-battle-target-layer\{z-index:(\d+)!important/ )||[])[1]);
const relicIdentityZ=Number((relicCss.match(/team-relic-battle-cutin\{[^}]*z-index:(\d+)/)||[])[1]);
const formalVfxZ=Number((v143Css.match(/\.v143-skill-stage\{[^}]*z-index:(\d+)/)||[])[1]);
assert.equal(relicDimZ,6090);
assert.equal(relicTargetZ,6105);
assert.equal(relicIdentityZ,6120);
assert.equal(formalVfxZ,16000);
assert.ok(relicDimZ<relicTargetZ&&relicTargetZ<relicIdentityZ&&relicTargetZ<formalVfxZ,
    "target units must paint above dim but below relic identity and formal V143 VFX");

const relicPresentation=relicRuntime.slice(
    relicRuntime.indexOf("const RELIC_VFX_PRESENTATION=Object.freeze({"),
    relicRuntime.indexOf("const RELIC_BATTLE_ICON_PATHS=Object.freeze({")
);
const relicTargetModes=Array.from(relicPresentation.matchAll(/\b(relic_[a-z0-9_]+):relicVfx\([^\n]*?"(allyAll|enemyAll|singleAlly|singleEnemy)"\)/g));
assert.equal(relicTargetModes.length,20,"all 20 relic battle presentations share the audited target pipeline");
assert.deepEqual(
    Array.from(new Set(relicTargetModes.map(match=>match[2]))).sort(),
    ["allyAll","enemyAll","singleAlly","singleEnemy"].sort()
);
assert.match(relicRuntime,/resolvedTarget=relicVfxTarget[\s\S]*beginRelicCinematic\(def,resolvedTarget\)[\s\S]*playRelicVfx\([\s\S]*resolvedTarget/,
    "the same resolved target set must drive both highlighting and formal relic VFX");

console.log("Battle drawer layout, four-element VFX range and relic target stacking contracts passed.");
