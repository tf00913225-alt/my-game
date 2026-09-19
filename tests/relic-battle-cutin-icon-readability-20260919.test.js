"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const css=fs.readFileSync("css/55-team-relic-system.css","utf8");
const core=fs.readFileSync("js/00-main.js","utf8");
const v143=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const root="assets/relics/battle-icons";

const ids=[
  "relic_qiankun_flask","relic_sun_orb","relic_xuanwu_seal","relic_soul_bell",
  "relic_tiangang_banner","relic_nine_dragon_fire","relic_cold_spring_jade","relic_qinglan_feather",
  "relic_rock_mountain_seal","relic_returning_wheel","relic_origin_talisman","relic_broken_army_scroll",
  "relic_red_sky_war_mark","relic_ice_mirror_heart","relic_wind_chasing_talisman","relic_mountain_river_cauldron",
  "relic_burning_star_mark","relic_spirit_spring_bottle","relic_demon_suppressing_seal","relic_all_returning_array"
];

assert.match(relic,/RELIC_CUTIN_DURATION_MS=720/,"cut-in stays inside the requested 600-800ms band");
assert.match(relic,/RELIC_MIN_VISUAL_PROTECTION_MS=1200/,"relic identity protection uses the requested 1.1-1.3s window");
assert.match(relic,/function showRelicCutin\(def\)[\s\S]*team-relic-battle-dim[\s\S]*秘寶發動[\s\S]*esc\(def\.name\)/,
  "cut-in must dim the battlefield and show the relic identity");
assert.match(relic,/showRelicCutin\(def\)\.then[\s\S]*showBanner\(def\);[\s\S]*playRelicVfx\(/,
  "cut-in must finish before the formal relic VFX begins");
assert.match(relic,/function cleanupRelicCutin\(\)[\s\S]*node\.remove\(\)/,
  "cut-in DOM must be removed rather than left on the battlefield");
assert.match(relic,/resetRelicPresentationQueue\(\)[\s\S]*cleanupRelicCutin\(\);[\s\S]*clearRelicFinishProtection\(\)/,
  "battle cleanup must remove both cut-in and its protection state");
assert.match(relic,/interceptActionFinish\(\(\)=>[\s\S]*relicPresentationHandoffsPending[\s\S]*relicFinishHeld=true/,
  "relic presentation must use the existing battle-flow interceptor instead of a second combat runtime");
assert.match(relic,/releaseRelicPresentationHandoff\(withProtection\)[\s\S]*RELIC_MIN_VISUAL_PROTECTION_MS/,
  "the first 1.2s of active relic VFX must be protected before action handoff is released");
assert.match(relic,/function shouldHoldMonsterActionFinishForRelic\(hardControlled\)[\s\S]*enemy_action_count[\s\S]*ally_hit_count/,
  "post-finish monster counters must pre-arm the existing action-finish interceptor when the next hit/action can trigger a relic");
assert.match(relic,/const finishProbe=shouldHoldMonsterActionFinishForRelic\(hardControlled\);[\s\S]*relicPresentationHandoffsPending\+\+[\s\S]*previous\.apply\(this,arguments\)[\s\S]*releaseRelicPresentationHandoff\(false\)/,
  "monster-action finish must be held before the legacy owner schedules the next combatant and released after trigger dispatch");

assert.ok(
  relic.includes(`team-relic-battle-icon"><img src="'+esc(def.battleIconPath||def.iconPath||"")`),
  "the auxiliary banner must use the battle icon instead of the legacy glyph"
);
assert.match(relic,/def\.battleIconPath\|\|def\.iconPath\|\|""/,
  "the auxiliary banner must source the dedicated battle icon with only the catalog icon as fallback");
assert.doesNotMatch(relic,/team-relic-battle-icon">寶</,"the legacy circular 寶 glyph cannot remain the relic identity");

assert.match(css,/\.team-relic-battle-dim\{[^}]*background:rgba\(0,0,0,\.38\)/,
  "battlefield dimming must stay light enough to preserve battlefield context");
assert.match(css,/teamRelicCutinEnter[\s\S]*scale\(\.85\)[\s\S]*scale\(1\.05\)[\s\S]*scale\(1\)/,
  "cut-in must use the requested 85% -> 105% -> 100% premium entry motion");
assert.match(css,/\.team-relic-battle-cutin-icon img\{[^}]*object-fit:contain/,
  "battle icon must remain uncropped");

assert.equal(ids.length,20);
for(const id of ids){
  const expected="assets/relics/battle-icons/"+id+".webp";
  assert.ok(relic.includes(id+':"'+expected+'"'),id+" must have a dedicated battle icon mapping");
  const file=path.join(root,id+".webp");
  assert.ok(fs.existsSync(file),file+" must exist");
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF",id+" battle icon must be WebP");
  assert.equal(bytes.subarray(8,12).toString("ascii"),"WEBP",id+" battle icon must be WebP");
}

assert.match(relic,/RELIC_DEV_HOST="dev\.four-symbols-dev\.pages\.dev"/,
  "all-relic testing must be pinned to the DEV deployment host");
assert.match(relic,/function statusOf\(id\)[\s\S]*isRelicDevTestingEnvironment\(\)\?Object\.assign\(\{\},state,\{unlocked:true,seen:true\}\)/,
  "DEV view must expose all relics as unlocked and seen without mutating production save state");
assert.match(relic,/devPreviewRelicId=id;[\s\S]*syncHomeRelicUi\(\); renderRelicPage\(\); return true;/,
  "unreleased relic presentation selection must stay in transient DEV state");
assert.match(relic,/!def\.runtimeReady&&isRelicDevTestingEnvironment\(\)[\s\S]*queueRelicPresentation/,
  "unreleased relics must be battle-previewable in DEV without enabling their mechanics");
assert.match(relic,/v174RelicDevUnlockAllForTesting/);
assert.match(relic,/v174RelicDevPreviewPresentation/);

assert.match(core,/const POST_ACTION_DELAY_MS=1150;/,
  "global 1.15s battle pacing owner must remain unchanged");
assert.match(v143,/function relicSheet\(src,hitFrame,options\)[\s\S]*authoredHitFrame:frame/,
  "reviewed V143 authored hit-frame ownership must remain unchanged");

console.log("✓ relic battle cut-in, icon, protection and DEV testing contracts passed");
