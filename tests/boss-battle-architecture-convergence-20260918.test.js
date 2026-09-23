"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const read=file=>fs.readFileSync(file,"utf8");
const core=read("js/00-main.js");
const boss=read("js/gameplay-boss-tower-system.js");
const slotsSource=read("js/battlefield-slot-owner.js");
const geometry=read("js/battlefield-render-geometry-adapter.js");
const presentation=read("js/54-v173.51-battle-qa.js");
const vfx=read("js/39-v143-skill-animation.js");
const timing=read("js/37-v142-skill-animation.js");
const fixedCss=read("css/fixed-slot-battlefield-rendering-v2.css");
const bossCss=read("css/gameplay-boss-tower.css");
const home=read("js/16-stage-v54-main-city-runtime.js");
const formation=read("js/25-v131-fix-batch.js");

const retired=/MECH_[LCR]|boss-mechanism-card|boss-mechanism-slot|blockingShield|mandatoryMechanismTarget|resolveMechanismAction|mechanism:/;
[core,boss,slotsSource,geometry,presentation,vfx,fixedCss,bossCss].forEach(source=>assert.doesNotMatch(source,retired));

assert.match(boss,/BOSS_FOOTPRINT_SLOTS=Object\.freeze\(\[[\s\S]*?"ENEMY_B2","ENEMY_B3","ENEMY_B4"[\s\S]*?"ENEMY_F2","ENEMY_F3","ENEMY_F4"/);
assert.match(boss,/BOSS_REINFORCEMENT_SLOTS=Object\.freeze\(\["ENEMY_B1","ENEMY_B5"\]\)/);
assert.match(boss,/BOSS_OBJECT_SLOTS=Object\.freeze\(\["ENEMY_F1","ENEMY_F5"\]\)/);
assert.match(boss,/unitKind:"boss-object"[\s\S]*?canAct:false[\s\S]*?noRewards:true/);
assert.match(boss,/if\(targetType==="all"\|\|targetType==="enemyAll"\)\{ return alive; \}[\s\S]*?return alive\.includes\(primaryIndex\)\?\[primaryIndex\]:\[\]/);
assert.match(boss,/Math\.min\(afterReduction,[\s\S]*?shield\.current[\s\S]*?health=Math\.max\(0,health-hpDamage\)/);
assert.match(core,/monsters\[i\]\.canAct!==false/);
assert.match(core,/if\(!monster\.noRewards\)\{[\s\S]*?recordMonsterKillForBestiary/);
assert.match(core,/bossRoundOwner\.processRound\(\)/);
assert.match(core,/getOutgoingDamageMultiplier/);
assert.match(core,/getHealingMultiplier/);
assert.doesNotMatch(boss,/startTurn\s*=\s*function/);
assert.doesNotMatch(boss,/getSkillTargets\s*=\s*function/);
assert.doesNotMatch(boss,/calculateDamage\s*=\s*function/);
assert.doesNotMatch(boss,/castHealSkill\s*=\s*function/);

assert.match(geometry,/className="v-fixed-boss-footprint"/);
assert.match(geometry,/footprint\.dataset\.geometryOwner="fixed-slot"/);
assert.match(geometry,/footprint\.dataset\.slots=slots\.bossFootprintSlots\.join\(" "\)/);
assert.doesNotMatch(geometry,/MutationObserver|isOwnedFixedStructure/,
    "Boss footprint must be rebuilt by the render lifecycle, not watched by a body observer");
assert.match(bossCss,/\.v-fixed-boss-footprint\{[\s\S]*?left:calc\(20% \+ 5px\);[\s\S]*?right:calc\(20% \+ 5px\)/);
assert.match(bossCss,/\.battle-monster\.gameplay-boss-card\{[\s\S]*?pointer-events:auto/);
assert.match(bossCss,/\.gameplay-boss-card > \.v174-battle-art\{[\s\S]*?background-size:contain/);
assert.match(bossCss,/\.gameplay-boss-card > \.monster-hp > \.boss-hp-shield-overlay\{[\s\S]*?background:rgba\(255,255,255,\.92\)/);
assert.doesNotMatch(bossCss,/boss-shield-hud/);
assert.doesNotMatch(read("css/40-v143-combat-dungeon-polish.css"),/\.battle-monster\{[\s\S]*?--v143-monster-card-width/);
assert.match(read("css/40-v143-combat-dungeon-polish.css"),/\.battle-monster:not\(\.gameplay-boss-card\)\{/);
assert.match(read("css/40-v143-combat-dungeon-polish.css"),/\.battle-monster:not\(\.gameplay-boss-card\) \.monster-hp,[\s\S]*?\.battle-monster:not\(\.gameplay-boss-card\) \.monster-sp/);
assert.doesNotMatch(read("css/38-v141-system-expansion.css"),/#game-content #battlePage \.battle-monster\{/);
assert.match(read("css/38-v141-system-expansion.css"),/#game-content #battlePage \.battle-monster:not\(\.gameplay-boss-card\)\{/);
assert.doesNotMatch(read("css/09-stage-v15-native-character-shell.css"),/#game-content #battlePage \.battle-monster\{/);

assert.match(presentation,/window\.FourSymbolsBattlePresentation=Object\.freeze\([\s\S]*?applyUnit:syncUnitArtwork/);
assert.match(geometry,/applyPresentation\(card,"monster"\)/);
assert.doesNotMatch(presentation,/setInterval\(syncManagement\s*,\s*300\)/);
assert.doesNotMatch(core,/red-hit/);
assert.doesNotMatch(read("css/00-main.css"),/\.red-hit/);
assert.match(core,/const prefix=type==="heal"\?"\+":"-"/);
assert.doesNotMatch(core,/suppressEnemyHpPopup/);
assert.match(core,/settlement\.hpDamage>0\)[\s\S]*?showDamagePopup\(element,"-"\+settlement\.hpDamage\+"HP","hp",isCrit\)/);
assert.match(fixedCss,/\.battle-monster\.v174-cardless-unit\{[\s\S]*?border:0 !important;[\s\S]*?box-shadow:none !important/);
assert.doesNotMatch(fixedCss,/\.damage-popup\.hp-popup\{[\s\S]*?display:none/);
assert.doesNotMatch(presentation,/v174-hit-shake|shakeArtForPopup/);

assert.match(fixedCss,/\.v-fixed-enemy-slot \.monster-hp,[\s\S]*?\.v-fixed-ally-slot \.hp-bar\{bottom:26px !important/);
assert.match(fixedCss,/--battle-resource-bar-height:11px/);
assert.match(fixedCss,/--battle-enemy-region-track:42fr[\s\S]*?--battle-center-region-track:16fr[\s\S]*?--battle-ally-region-track:42fr/);
assert.match(fixedCss,/\.battle-center-region\{[\s\S]*?border:0/);
assert.match(fixedCss,/\.battle-info-region\{[\s\S]*?position:absolute !important;[\s\S]*?bottom:0 !important/);
assert.match(fixedCss,/\.battle-info-toggle\{[\s\S]*?left:auto;[\s\S]*?right:4px;[\s\S]*?width:96px;[\s\S]*?background:rgba\(0,0,0,\.62\);[\s\S]*?font-size:14px/);
assert.match(fixedCss,/\.battle-element-box-button\{[\s\S]*?width:66px !important;[\s\S]*?height:66px !important/);

assert.match(home,/openHomeFeature\(\\'formation\\'\)/);
assert.match(formation,/window\.vFixedRenderAllyFormationContent=renderAllyFormationContent/);
assert.match(formation,/moveAllyCharacter\(vFixedFormationSelectedCharacter,slot\)/);
assert.match(formation,/saveGame\(\{source:"ally-formation"\}\)/);

assert.match(core,/window\.FourSymbolsBattleFlow=Object\.freeze/);
assert.match(core,/interceptActionFinish\(interceptor\)/);
assert.match(core,/function getSkillTargets\(centerIndex,targetType\)[\s\S]*?FourSymbolsBossBattle[\s\S]*?FourSymbolsBattlefieldSlots/);
assert.doesNotMatch(read("js/25-v131-fix-batch.js"),/getSkillTargets\s*=/);
assert.doesNotMatch(read("js/42-v148-combat-dungeon-fixes.js"),/getSkillTargets\s*=/);
assert.match(core,/subscribeBeforeCombatant\(observer\)/);
assert.match(core,/v142GetRemainingAnimationMs/);
assert.doesNotMatch(timing,/finishPlayerAction\s*=(?!=)|processNextCombatant\s*=(?!=)/);
assert.doesNotMatch(read("js/42-v148-combat-dungeon-fixes.js"),/finishPlayerAction\s*=(?!=)|processNextCombatant\s*=(?!=)/);
assert.doesNotMatch(read("js/43-v149-skill-ui-rules.js"),/finishPlayerAction\s*=(?!=)|processNextCombatant\s*=(?!=)/);
assert.doesNotMatch(read("js/60-team-relic-system.js"),/finishPlayerAction\s*=(?!=)|processNextCombatant\s*=(?!=)/);

for(const id of [
    "flameSlash","phoenixCry","waterKnife","iceArrowRain",
    "stormFist","stormRain","stoneSlash","dustStorm"
]){
    assert.match(timing,new RegExp("\\b"+id+":\\["),id+" timing metadata missing");
    assert.match(vfx,new RegExp("\\b"+id+":\\{"),id+" VFX manifest missing");
}
assert.match(vfx,/placement==="battlefield"/);
assert.match(vfx,/placement==="group"/);
assert.match(vfx,/isBossIndexForVfx/);

const context={window:null,console,Math,Number,Object,Array,Set,Map};
context.window=context;
vm.createContext(context);
vm.runInContext(slotsSource,context);
const owner=context.FourSymbolsBattlefieldSlots;
const six=owner.hydrateAllyFormation(null,[0,1,2,3,4,5]);
assert.equal(Object.keys(six.characterIndexToSlot).length,6);
assert.deepEqual(Array.from(new Set(Object.values(six.characterIndexToSlot))).sort(),
    ["ALLY_B1","ALLY_B2","ALLY_B3","ALLY_F1","ALLY_F2","ALLY_F3"]);
const ten=owner.createEnemyFormationSnapshot([0,1,2,3,4,5,6,7,8,9]);
assert.equal(Object.keys(ten.monsterIndexToSlot).length,10);
const normalTri=owner.resolveEnemyTargets(ten,7,"tri",()=>true);
assert.equal(normalTri.length,3,"normal battle tri remains a three-target rule");

console.log("Boss architecture convergence, VFX flow, cardless UI, formation and release-critical contracts passed.");
