"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const relicCss=fs.readFileSync("css/55-team-relic-system.css","utf8");
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
  /function relicTargetGeometry\(side,index\)[\s\S]*getUnitGeometry/,
  "all target modes must resolve through canonical battlefield Unit geometry"
);
assert.match(
  relic,
  /team-relic-mask-holes[\s\S]*createElementNS\(namespace,"rect"\)/,
  "relic focus must use viewport mask apertures instead of live-DOM elevation"
);
assert.doesNotMatch(relic,/relicTargetLayer\(|team-relic-battle-target-layer/,
  "legacy target stacking carrier owner must remain retired");

const rootZ=Number((relicCss.match(/team-relic-battle-presentation\{[^}]*z-index:(\d+)/)||[])[1]);
const vfxZ=Number((vfxCss.match(/\.v143-skill-stage\{[^}]*z-index:(\d+)/)||[])[1]);
const activeRelicVfxZ=Number((relicCss.match(/team-relic-cinematic-active > \.v143-skill-stage\{z-index:(\d+)!important/ )||[])[1]);

assert.equal(rootZ,18090,"relic viewport presentation layer changed unexpectedly");
assert.equal(vfxZ,16000,"formal V143 base layer changed unexpectedly");
assert.equal(activeRelicVfxZ,18130,"formal V143 relic cast must rise above the cinematic viewport");
assert.ok(rootZ<activeRelicVfxZ,"formal relic VFX must paint above the viewport mask/identity surface");

assert.match(
  relicCss,
  /\.team-relic-battle-target-outline\{[\s\S]*transition:opacity \.42s ease/,
  "target focus outlines must reveal gradually without mutating live Unit opacity"
);

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
  /types\.some\(type=>\["heal_all_allies","restore_sp_all","shield_all","buff_all","prepare_reflect"\]\.includes\(type\)\)[\s\S]*?targetSide:"player",targetType:"allyAll"/,
  "ally-wide effects must resolve every living ally through the shared highlight path"
);
assert.match(
  relic,
  /function queueRelicPresentation\(def,onStart,visualContext\)[\s\S]*?resolvedTarget=relicVfxTarget[\s\S]*?beginRelicCinematic\(def,resolvedTarget\)[\s\S]*?playRelicVfx\([\s\S]*?resolvedTarget/,
  "every relic must use the same resolved target for highlight and formal VFX"
);

console.log("✓ relic target stacking, all 20 target modes and VFX layer ordering passed");
