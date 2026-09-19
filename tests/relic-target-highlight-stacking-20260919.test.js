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
  /const battlePage=document\.getElementById\("battlePage"\);[\s\S]*?battlePage\.querySelector\("\.battle-wrap"\)[\s\S]*?host\.appendChild\(node\)/,
  "relic cinematic must live inside the existing battle-wrap stacking context"
);
assert.match(
  relic,
  /function relicTargetLayer\(card\)[\s\S]*?card\.closest\("\.v-fixed-enemy-slot,\.v-fixed-ally-slot,\.v-fixed-boss-footprint"\)\|\|card/,
  "normal enemies, allies and Boss footprints must expose their real stacking carrier"
);
assert.match(
  relic,
  /relicFocusedTargetLayers=Array\.from\(new Set\(relicFocusedTargetCards\.map\(relicTargetLayer\)\.filter\(Boolean\)\)\)[\s\S]*?team-relic-battle-target-layer/,
  "resolved target carriers must be lifted as one shared cinematic layer"
);
assert.match(
  relic,
  /function clearRelicTargetFocus\(\)[\s\S]*?team-relic-battle-target-layer/,
  "target carrier elevation must be removed during cinematic cleanup"
);

const dimZ=Number((relicCss.match(/team-relic-battle-dim\{[^}]*z-index:(\d+)/)||[])[1]);
const targetZ=Number((relicCss.match(/team-relic-battle-target-layer\{z-index:(\d+)!important/ )||[])[1]);
const cutinZ=Number((relicCss.match(/team-relic-battle-cutin\{[^}]*z-index:(\d+)/)||[])[1]);
const vfxZ=Number((vfxCss.match(/\.v143-skill-stage\{[^}]*z-index:(\d+)/)||[])[1]);

assert.equal(dimZ,6090,"relic dim layer contract changed unexpectedly");
assert.equal(targetZ,6105,"target carrier must sit immediately above the relic dim layer");
assert.equal(cutinZ,6120,"relic identity must remain above highlighted targets");
assert.equal(vfxZ,16000,"formal V143 VFX owner layer changed unexpectedly");
assert.ok(dimZ<targetZ,"resolved targets must paint above the dim layer");
assert.ok(targetZ<cutinZ,"resolved targets must not cover the relic identity reveal");
assert.ok(targetZ<vfxZ,"resolved targets must never rise above formal relic VFX");

assert.match(
  relicCss,
  /\.v-fixed-enemy-slot\.team-relic-battle-target-layer,[\s\S]*?\.v-fixed-ally-slot\.team-relic-battle-target-layer,[\s\S]*?\.v-fixed-boss-footprint\.team-relic-battle-target-layer\{z-index:6105!important;\}/,
  "all fixed-slot target carrier families must share the same safe elevation"
);
assert.match(
  relicCss,
  /team-relic-battle-target-focus-visible\{[^}]*opacity:1!important[^}]*brightness\(1\.08\)/,
  "the actual unit root still owns the gradual brightening presentation"
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
