const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=file=>fs.readFileSync(file,"utf8");

const build=read("scripts/build-production.mjs");
const core=read("js/00-main.js");
const v143=read("js/39-v143-skill-animation.js");
const v143System=read("js/38-v143-system-fixes.js");
const v146=read("js/41-v146-system-polish.js");
const v152=read("js/44-v152-dev-fixes.js");
const v155=read("js/46-v155-dev-fixes.js");
const presentation=read("js/54-v173.51-battle-qa.js");
const feedback=read("js/battle-floating-feedback-owner.js");
const feedbackCss=read("css/battle-floating-feedback-owner.css");
const geometry=read("js/battlefield-render-geometry-adapter.js");
const relic=read("js/60-team-relic-system.js");
const progression=read("js/60-v173.64-skill-progression-rebalance.js");
const contracts=read("SYSTEM_CONTRACTS.md");

assert.ok(
  build.indexOf('"js/battlefield-render-geometry-adapter.js"')<
  build.indexOf('"js/battle-floating-feedback-owner.js"'),
  "geometry owner must load before floating feedback owner"
);
assert.ok(
  build.indexOf('"js/battle-floating-feedback-owner.js"')<
  build.indexOf('"js/60-team-relic-system.js"'),
  "floating feedback owner must be installed before relic runtime uses it"
);

const corePopup=core.slice(core.indexOf("function showDamagePopup("),core.indexOf("function playFireRocketAnimation",core.indexOf("function showDamagePopup(")));
assert.match(corePopup,/FourSymbolsBattleFloatingFeedback/);
assert.match(corePopup,/feedback\.emit\(/);
assert.doesNotMatch(corePopup,/createElement\(/,"core popup entry must not create a second DOM implementation");
assert.doesNotMatch(corePopup,/appendChild\(/,"core popup entry must not append popup DOM");

assert.match(v143,/window\.v143ResolveBattleFeedbackTiming=function/);
assert.doesNotMatch(v143,/showMonsterHit=function\(/,"V143 must not wrap floating feedback creation");
assert.doesNotMatch(v143,/showPlayerHit=function\(/,"V143 must not wrap floating feedback creation");
assert.doesNotMatch(v143,/showMissEffect=function\(/,"V143 must not wrap floating feedback creation");

assert.doesNotMatch(v152,/showDamagePopup=function\(/,"V152 HP relocation wrapper is retired");
assert.doesNotMatch(v152,/v152-top-damage/,"V152 must not retain a popup relocation class owner");

assert.match(v146,/FourSymbolsBattleFloatingFeedback/);
assert.match(v146,/feedback\.emitAtImpact/);
assert.doesNotMatch(v146,/rect\.top\+rect\.height\*\.86/,"V146 legacy status geometry is retired");
assert.doesNotMatch(v146,/className="v146-status-popup/,"V146 must not create its own status popup DOM");

assert.match(geometry,/getUnitGeometry:unitGeometry/);
assert.match(geometry,/getBattlefieldOverlayGeometry:battlefieldOverlayGeometry/);
assert.doesNotMatch(geometry,/wrapDamagePopup/);
assert.doesNotMatch(geometry,/wrapMissPopup/);

assert.match(feedback,/const MAX_LANES=4/);
assert.match(feedback,/context\.queue\.push\(request\)/);
assert.match(feedback,/if\(lane<0\)\{ break; \}/);
assert.match(feedback,/geometry\.feedbackSafeRect/);
assert.match(feedback,/node\.dataset\.feedbackSource=request\.source/);
assert.match(feedbackCss,/color:#e32626/);
assert.match(feedbackCss,/-webkit-text-stroke:\.85px #fff/);
assert.match(feedbackCss,/text-shadow:1px 1px 0 #000/);
assert.doesNotMatch(feedbackCss,/0 0 (?:7|8|10|14|16)px/,"canonical feedback typography must not use neon glow");

assert.doesNotMatch(v143System,/resolveEscapeAttempt=function\(/,"Dungeon-specific escape wrapper must stay retired");
assert.match(core,/FourSymbolsBattlePresentation/);
assert.match(core,/presentationOwner\.playEscape/);
assert.match(core,/v141PlayEscapeBattleExit/);
assert.match(core,/v132AbortDungeonBattle\("escape"\)/);
assert.match(core,/emitEscapeFailure/);
assert.match(presentation,/version:"cardless-presentation-v3"/);
assert.match(presentation,/playEscape:playEscapePresentation/);
assert.match(presentation,/cleanupEscape:cleanupEscapePresentation/);
assert.match(presentation,/fill:succeeded\?"forwards":"none"/);

assert.match(relic,/function relicOverlayGeometry\(\)[\s\S]*?getBattlefieldOverlayGeometry/);
assert.match(relic,/function relicTargetGeometry\(side,index\)[\s\S]*?getUnitGeometry/);
assert.doesNotMatch(
  relic.slice(relic.indexOf("function relicTargetGeometry"),relic.indexOf("function relativeRelicRect")),
  /getBoundingClientRect/,
  "Relic target geometry must not guess from local DOM"
);
const begin=relic.slice(relic.indexOf("function beginRelicCinematic"),relic.indexOf("function enterRelicVfxPhase"));
assert.ok(begin.indexOf('classList.add("identity-visible")')<begin.indexOf('classList.add("dim-visible")'),"Relic identity must appear before battlefield dimming");
assert.ok(begin.indexOf('classList.add("dim-visible")')<begin.indexOf("revealRelicTargets(target)"),"Relic dimming must precede target reveal");
assert.match(relic,/document\.body\.appendChild\(node\)/);

assert.match(progression,/const DODGE_BY_LEVEL=Object\.freeze\(\[5,10,15,20,25\]\)/);
assert.match(v155,/v141ForceSkillLevel/);
assert.match(v155,/const display=\{type:"dodgeSkill",v141BuffType:"dodge",turnsLeft:duration\}/);
assert.match(v155,/const state=\{[\s\S]*?bonusPercent:percent/);
assert.match(v143,/function authoritativeStatusBuffs\(entity\)[\s\S]*?"v155WindDodge"/);
assert.ok(
  v143.indexOf("collect(authoritativeStatusBuffs(entity)")<
  v143.indexOf("collect(entity&&entity.activeBuffs"),
  "status summary must project gameplay sidecars before display-only activeBuffs"
);
assert.match(v143,/statusPercent\(entry,"bonusPercent","percent"\)/);
assert.doesNotMatch(
  v143.slice(v143.indexOf('if(type==="dodgeSkill")'),v143.indexOf('if(type==="stealthSkill")')),
  /skillDatabase/,
  "Wind Walk display must not guess its value from skill data"
);

for(const [name,source] of [
  ["V143 status text",v143],
  ["V155 support text",v155],
  ["Relic player text",relic]
]){
  assert.doesNotMatch(source,/個百分點/,name+" must use % in player-visible runtime text");
}
assert.match(contracts,/玩家可見 Buff／Debuff 一律顯示「最終…±N%」/);
assert.match(contracts,/Frostbite（凍傷）是 Soft Debuff：造成傷害 -30%/);

console.log("Battle presentation owner convergence contracts passed.");
