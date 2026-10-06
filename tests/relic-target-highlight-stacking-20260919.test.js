"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
const mainCss=fs.readFileSync("css/00-main.css","utf8");
const legacyBattleCss=fs.readFileSync("css/12-stage-v45-battle-black-overlay-skill-text.css","utf8");
const vfxCss=fs.readFileSync("css/40-v143-combat-dungeon-polish.css","utf8");

assert.match(
  legacyBattleCss,
  /#battlePage > \.battle-wrap\{[\s\S]*?z-index:1 !important;/,
  "historical battle-wrap stacking context must remain documented by this regression"
);

assert.match(
  relic,
  /document\.body\.appendChild\(node\)/,
  "relic cinematic must live on a document-level viewport surface"
);
assert.match(
  relic,
  /function revealRelicTargets\(target\)[\s\S]*getUnitGeometry[\s\S]*appendRelicProjection/,
  "all target modes must resolve through canonical battlefield projection geometry"
);
assert.match(
  relic,
  /function appendRelicProjection\(layer,geometry,overlayRect\)[\s\S]*artworkProjection[\s\S]*hpProjection[\s\S]*spProjection/,
  "relic focus must project transparent artwork and resource bars instead of elevating live DOM"
);
assert.doesNotMatch(relic,/relicTargetLayer\(|team-relic-battle-target-layer/,
  "legacy target stacking carrier owner must remain retired");

assert.match(relicCss,/body > \.team-relic-battle-presentation\{[\s\S]*?position:fixed/,
  "relic cinematic remains a document-level surface");
assert.match(vfxCss,/\.v143-skill-stage\{[\s\S]*?position:fixed/,
  "formal VFX remains a document-level surface");
assert.match(mainCss,/body\.v174-battle-reading-open > \.v143-skill-stage,[\s\S]*?body\.v174-battle-reading-open > \.team-relic-battle-presentation,[\s\S]*?visibility:hidden !important;[\s\S]*?opacity:0 !important;/,
  "semantic reading state, not cross-context z-index arithmetic, must suppress both relic and VFX paint");

assert.doesNotMatch(relic,/team-relic-battle-target-outline/,"Relic must not create a full Unit outline");
assert.doesNotMatch(relicCss,/team-relic-battle-target-outline/,"Relic CSS must not retain the retired outline owner");
assert.match(relic,/artworkProjection|hpProjection/,"Relic target geometry must expose artwork/HP projection data");

const presentationStart=relic.indexOf("const RELIC_VFX_PRESENTATION=Object.freeze({");
const presentationEnd=relic.indexOf("const RELIC_BATTLE_ICON_PATHS=Object.freeze({");
assert.ok(presentationStart>=0&&presentationEnd>presentationStart,"relic presentation registry must exist");
const presentationBlock=relic.slice(presentationStart,presentationEnd);
const entries=Array.from(presentationBlock.matchAll(/\b(relic_[a-z0-9_]+):relicVfx\([^\n]*?"(allyAll|enemyAll|singleAlly|singleEnemy)"\)/g));
assert.equal(entries.length,20,"all 20 relic battle presentations must be audited");
assert.deepEqual(
  Array.from(new Set(entries.map(match=>match[2]))).sort(),
  ["allyAll","enemyAll","singleAlly","singleEnemy"].sort(),
  "the complete relic target-mode family must remain covered"
);

assert.match(
  relic,
  /types\.some\(type=>\["damage_all_enemies","debuff_all_enemies","apply_status_all_enemies"\]\.includes\(type\)\)[\s\S]*?targetSide:"monster",targetType:"all"/,
  "enemy-wide effects must resolve every eligible enemy through the shared highlight path"
);
assert.match(
  relic,
  /types\.some\(type=>\["heal_all_allies","restore_sp_all","shield_all","buff_all"\]\.includes\(type\)\)[\s\S]*?targetSide:"player",targetType:"allyAll"/,
  "ally-wide effects must resolve every living ally through the shared highlight path"
);
assert.match(
  relic,
  /function queueRelicPresentation\(def,onStart,visualContext\)[\s\S]*?resolvedTarget=relicVfxTarget[\s\S]*?beginRelicCinematic\(def,resolvedTarget\)[\s\S]*?playRelicVfx\([\s\S]*?resolvedTarget/,
  "every relic must use the same resolved target for highlight and formal VFX"
);

console.log("✓ relic target projection, all 20 target modes and reading-layer contract passed");
