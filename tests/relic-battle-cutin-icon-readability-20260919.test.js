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

assert.match(relic,/RELIC_DIM_IN_MS=360/);
assert.match(relic,/RELIC_IDENTITY_REVEAL_MS=360/);
assert.match(relic,/RELIC_TARGET_REVEAL_MS=420/);
assert.match(relic,/RELIC_DIM_OUT_MS=420/);
assert.match(relic,/RELIC_MIN_VISUAL_PROTECTION_MS=1200/,
  "relic-only visual protection must preserve the existing 1.2s minimum handoff window");

assert.match(relic,/function beginRelicCinematic\(def,target\)[\s\S]*classList\.add\("dim-visible"\)[\s\S]*waitMs\(RELIC_DIM_IN_MS\)[\s\S]*classList\.add\("identity-visible"\)[\s\S]*waitMs\(RELIC_IDENTITY_REVEAL_MS\)[\s\S]*revealRelicTargets\(target\)/,
  "cinematic prelude must dim first, reveal identity second, then reveal the real resolved targets");
assert.match(relic,/function relicTargetCard\(side,index\)[\s\S]*battleMonster[\s\S]*battlePlayerCard/,
  "target lookup must resolve the actual battle unit roots");
assert.match(relic,/function revealRelicTargets\(target\)[\s\S]*relicTargetCard\(target\.targetSide,index\)[\s\S]*team-relic-battle-target-focus-visible/,
  "target reveal must focus those real unit roots so artwork, name and resource HUD brighten together");
assert.match(relic,/function queueRelicPresentation\(def,onStart,visualContext\)[\s\S]*beginRelicCinematic\(def,resolvedTarget\)[\s\S]*enterRelicVfxPhase\(node\)[\s\S]*playRelicVfx\([\s\S]*resolvedTarget[\s\S]*relicGate&&relicGate\.promise[\s\S]*endRelicCinematic\(node\)/,
  "formal relic VFX must start only after target reveal, and battlefield restore must wait for the V143 gate to finish");
assert.match(relic,/function endRelicCinematic\(node\)[\s\S]*classList\.add\("releasing"\)[\s\S]*waitMs\(RELIC_DIM_OUT_MS\)/,
  "battlefield must fade back in after the relic VFX lifecycle ends");
const liveQueueSource=relic.slice(
  relic.indexOf("const generation=relicPresentationGeneration",relic.indexOf("function queueRelicPresentation")),
  relic.indexOf("function normalizeOwned")
);
assert.doesNotMatch(
  liveQueueSource,
  /showBanner\(def\)/,
  "the old small banner may remain only as a no-battle-host fallback, never in the live cinematic path"
);
assert.match(relic,/function cleanupRelicCutin\(\)[\s\S]*clearRelicTargetFocus\(\)[\s\S]*node\.remove\(\)/,
  "cleanup must remove target focus and cinematic DOM on battle end/reset");

assert.match(css,/\.team-relic-battle-presentation\.dim-visible \.team-relic-battle-dim\{opacity:\.75;\}/,
  "battlefield must dim to roughly 75 percent");
assert.match(css,/\.team-relic-battle-dim\{[^}]*transition:opacity \.36s ease/,
  "battlefield dimming must be gradual");
assert.match(css,/\.team-relic-battle-cutin\{[^}]*flex-direction:column[^}]*border:0[^}]*background:none[^}]*box-shadow:none/,
  "center identity must be icon-over-name with no frame or panel");
assert.match(css,/\.team-relic-battle-cutin-icon\{[^}]*border:0[^}]*background:none[^}]*box-shadow:none/,
  "battle icon itself must have no box");
assert.match(css,/\.team-relic-battle-cutin-copy\{[^}]*border:0[^}]*background:none[^}]*box-shadow:none[^}]*text-align:center/,
  "relic name must be centered under the icon with no box");
assert.match(css,/\.battle-player\.team-relic-battle-target-focus,[\s\S]*\.battle-monster\.team-relic-battle-target-focus\{[^}]*z-index:6105!important[^}]*opacity:\.30!important[^}]*filter:brightness\(\.24\)/,
  "real target roots must rise above the dim layer from a dark starting state");
assert.match(css,/team-relic-battle-target-focus-visible\{[^}]*opacity:1!important[^}]*brightness\(1\.08\)/,
  "target roots must gradually brighten to full readable artwork/HUD");
assert.match(css,/\.team-relic-battle-presentation\.releasing \.team-relic-battle-dim\{opacity:0;transition-duration:\.42s;\}/,
  "the battlefield must fade back up instead of snapping bright");

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

assert.match(relic,/RELIC_DEV_HOST="dev\.four-symbols-dev\.pages\.dev"/);
assert.match(relic,/function statusOf\(id\)[\s\S]*unlocked:true,seen:true/,
  "DEV must expose all relics without requiring fragments");
assert.match(relic,/team-relic-card-dev[\s\S]*team-relic-dev-equip[\s\S]*測試配裝/,
  "DEV relic cards must expose a directly clickable testing equip control");
assert.match(relic,/DEV 測試配裝/,
  "relic detail view must also expose an explicit testing equip button");
assert.match(css,/\.team-relic-card-dev \.team-relic-dev-equip\{[^}]*min-height:34px/,
  "DEV testing equip control must be visibly actionable");
assert.match(relic,/function equipRelic\(id\)[\s\S]*if\(devTesting\)\{[\s\S]*devPreviewRelicId=id;[\s\S]*return true;[\s\S]*teamLoadout\.relicId=id;/,
  "DEV equipment must remain transient before the production save path");
const equipSource=relic.slice(relic.indexOf("function equipRelic(id)"),relic.indexOf("function unequipRelic()"));
const transientBranch=(equipSource.match(/if\(devTesting\)\{([\s\S]*?)\n        \}/)||[])[1]||"";
assert.doesNotMatch(transientBranch,/saveRelics\(|teamLoadout\.relicId/,
  "DEV testing equipment must not write formal ownership/loadout data");

assert.match(core,/const POST_ACTION_DELAY_MS=1150;/,
  "global battle pacing must remain untouched");
assert.match(v143,/function relicSheet\(src,hitFrame,options\)[\s\S]*authoredHitFrame:frame/,
  "reviewed relic authored hit frames must remain untouched");

console.log("✓ relic cinematic target reveal, dedicated icon and DEV equip contracts passed");
