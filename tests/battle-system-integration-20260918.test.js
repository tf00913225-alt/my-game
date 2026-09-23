"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");
const main=read("js/00-main.js");
const timing=read("js/37-v142-skill-animation.js");
const vfx=read("js/39-v143-skill-animation.js");
const support=read("js/42-v148-combat-dungeon-fixes.js");
const fireWindEarth=read("js/43-v149-skill-ui-rules.js");
const water=read("js/50-v169-water-skill-rules.js");
const adapter=read("js/battlefield-render-geometry-adapter.js");
const css=read("css/fixed-slot-battlefield-rendering-v2.css");
const index=read("index.html");
const home=read("js/16-stage-v54-main-city-runtime.js");
const formation=read("js/25-v131-fix-batch.js");

const ACTIVE_SKILLS={
    fire:["flameSlash","fireCritical","explosiveFlurry","dragonSlash","fireRocket","blazeSpell","flameTornado","phoenixCry","rage"],
    water:["waterKnife","frostPunch","iceSpin","frostCrush","waterBall","floodBeast","iceArrowRain","freeze","healSpell","revive","purifyMind"],
    wind:["stormFist","stormFlurry","windCrossSlash","dizzyFist","windSpell","stormCircle","windHowlLightning","stormRain","dodgeSkill","stealthSkill","dinghaishenzhen"],
    earth:["stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush","stoneThrow","sandWind","flyingSandStrike","dustStorm","earthShield","rockWall","barrier"]
};
const PASSIVES=["fireEX","waterEX","windEX","earthEX"];

function manifestBlock(id){
    const start=vfx.indexOf("        "+id+":{");
    assert.ok(start>=0,`missing formal VFX manifest entry for ${id}`);
    return vfx.slice(start,start+500);
}

for(const [element,ids] of Object.entries(ACTIVE_SKILLS)){
    const rules=element==="water"?water:fireWindEarth;
    ids.forEach(id=>{
        assert.match(rules,new RegExp("\\b"+id+":\\{"),`${id} must remain in the final ${element} rules`);
        const block=manifestBlock(id);
        assert.match(block,/sprite:castSheet\("([^"]+)"/,`${id} must use a formal raster asset`);
        const asset=block.match(/sprite:castSheet\("([^"?]+)/)[1];
        assert.ok(fs.existsSync(path.join(ROOT,asset)),`${id} asset does not exist: ${asset}`);
    });
}
PASSIVES.forEach(id=>assert.match(manifestBlock(id),/noVisual:true,passive:true/));

// Combat selects targets; V142 carries the immutable contract; V143 only draws it.
assert.match(main,/version:"battle-target-contract-v1"/);
assert.match(main,/targetSide:targetSide/);
assert.match(main,/Object\.freeze\(ids\.slice\(\)\)/);
assert.match(timing,/meta\.targetContract=contract/);
assert.match(timing,/meta\.targetSide=contract\.targetSide/);
assert.doesNotMatch(vfx,/queuedPlayerActions|selectedMonster|getSkillTargets/,
    "the VFX runtime must never infer combat targets");
assert.match(vfx,/meta\.targetContract\.targetSide/);
assert.match(support,/showSkillNameBadge\(skill\.name,skill\.element,characterIndex,targetId,targetIds,targetSide\)/);
assert.match(support,/const selectedPrimary=targetSide==="monster"[\s\S]*?\?enemyIndex[\s\S]*?const primaryTarget=targets\.includes\(selectedPrimary\)\?selectedPrimary:targets\[0\][\s\S]*?animateSupportCast\(state,characterIndex,skill,primaryTarget,targets,targetSide\)/,
    "Purify Mind must preserve an explicitly selected target as the primary VFX anchor");

// Fixed geometry is occupancy-independent: tri uses a fixed shape, all uses a side rect.
assert.match(vfx,/getGeometryRectFromShape\(current\.targetSide,primarySlot,shape\)/);
assert.match(vfx,/getSideRect\(current\.targetSide\)/);
assert.match(vfx,/trajectory:1/);
assert.doesNotMatch(vfx,/Math\.min\(bounds\.right,window\.innerWidth\)|Math\.min\(bounds\.bottom,window\.innerHeight\)/);
assert.match(vfx,/const actor=placement==="trajectory"\?slotAnchor/);
assert.match(vfx,/--v143-sprite-dx",destination\.x-actor\.x\+"px"/);
assert.match(vfx,/gate\.complete\("v143-render-error"\)/);
assert.match(vfx,/purgeStaleRasterStages\(\)/);

// One canonical three-track layout keeps controls centered and the log in an overlay drawer.
const enemy=index.indexOf('<section class="battle-enemy-region"');
const center=index.indexOf('<section class="battle-center-region"');
const ally=index.indexOf('<section class="battle-ally-region"');
const info=index.indexOf('<section class="battle-info-region"');
assert.ok(enemy<center&&center<ally&&ally<info,"battle DOM must be enemy → controls → allies → bottom info");
assert.doesNotMatch(index.slice(center,ally),/id="battleInfo"/);
assert.doesNotMatch(css,/--battle-info-region-track/);
assert.match(css,/grid-template-rows:\s*minmax\(0,var\(--battle-enemy-region-track\)\)[\s\S]*var\(--battle-ally-region-track\)/);
assert.match(css,/\.battle-info-region\{[\s\S]*position:absolute !important;[\s\S]*bottom:0 !important/);
assert.match(main,/function toggleBattleInfoPanel\(\)/);
assert.match(css,/--battle-ally-row-gap:8px/);
assert.match(css,/data-slot-row="back"\]\{bottom:0 !important;\}/);
assert.match(css,/\.battle-monster-name\{[\s\S]*bottom:0 !important/);
assert.match(css,/\.battle-player-id\{[\s\S]*bottom:0 !important/);
assert.match(css,/\.battle-element-box-button\{[\s\S]*width:66px !important;[\s\S]*height:66px !important/);
assert.match(adapter,/slice\(0,6\)/);

// The existing formation owner is lazy-loaded on the first click instead of opening an empty shell.
assert.match(home,/class="v-fixed-formation-entry" data-feature="gameplay-core"/);
assert.match(home,/openHomeFeature\(\\'formation\\'\)/);
assert.match(formation,/vFixedRenderAllyFormationContent/);
assert.match(formation,/vFixedSelectFormationSlot/);

// The initiative owner has a bounded final safety net for VFX, MISS and DOM exceptions.
assert.match(main,/const BATTLE_ACTION_WATCHDOG_MS=7000/);
assert.match(main,/gate\.complete\("combat-action-watchdog"\)/);
assert.match(main,/try\{[\s\S]*resolveQueuedPlayerAction\([\s\S]*catch\(error\)[\s\S]*finishPlayerAction\(\)/);
assert.match(main,/try\{[\s\S]*processSingleMonsterAttack\([\s\S]*catch\(error\)[\s\S]*finishPlayerAction\(\)/);
assert.match(main,/function clearBattleActionWatchdog\(\)/);

console.log("Battle system integration contract passed for all four elements, layout, formation and flow recovery.");
