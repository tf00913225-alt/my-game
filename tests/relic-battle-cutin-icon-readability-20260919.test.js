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
assert.match(relic,/RELIC_IDENTITY_HOLD_MS=1150/);
assert.match(relic,/RELIC_IDENTITY_EXIT_MS=420/);
assert.match(relic,/RELIC_TARGET_REVEAL_MS=420/);
assert.match(relic,/RELIC_DIM_OUT_MS=420/);
assert.match(relic,/RELIC_MIN_VISUAL_PROTECTION_MS=1200/,
  "relic-only visual protection must preserve the existing 1.2s minimum handoff window");

assert.match(relic,/function beginRelicCinematic\(def,target\)[\s\S]*classList\.add\("dim-visible"\)[\s\S]*waitMs\(RELIC_DIM_IN_MS\)[\s\S]*classList\.add\("identity-visible"\)[\s\S]*waitMs\(RELIC_IDENTITY_REVEAL_MS\)[\s\S]*waitMs\(RELIC_IDENTITY_HOLD_MS\)[\s\S]*classList\.add\("identity-exiting"\)[\s\S]*Promise\.all\(\[[\s\S]*waitMs\(RELIC_IDENTITY_EXIT_MS\)[\s\S]*revealRelicTargets\(target\)/,
  "cinematic prelude must serialize dim -> identity reveal -> 1.15s hold -> identity exit plus target reveal");
assert.match(relic,/function relicTargetGeometry\(side,index\)[\s\S]*getUnitGeometry/,
  "target lookup must resolve canonical battlefield geometry");
assert.match(relic,/function revealRelicTargets\(target\)[\s\S]*team-relic-mask-holes[\s\S]*team-relic-battle-target-outline/,
  "target reveal must cut apertures and outlines from canonical Unit geometry");
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
assert.match(css,/body > \.team-relic-battle-presentation\{[^}]*position:fixed;inset:0;z-index:18090/,
  "relic dim presentation must cover the browser viewport outside battlePage stacking contexts");
assert.match(css,/\.team-relic-battle-cutin\{[^}]*width:min\(72vw,280px\)/,
  "relic identity group must be visibly larger");
assert.match(css,/\.team-relic-battle-cutin-icon\{[^}]*width:clamp\(140px,44vw,210px\)[^}]*height:clamp\(140px,44vw,210px\)/,
  "relic battle icon must be larger than the previous 112-170px contract");
assert.match(css,/\.team-relic-battle-cutin-copy strong\{[^}]*clamp\(28px,8vw,36px\)/,
  "relic name must scale up with the larger icon");
assert.match(css,/\.team-relic-battle-presentation\.identity-exiting \.team-relic-battle-cutin,[\s\S]*transition-duration:\.42s/,
  "identity fade-out must be gradual and share the target reveal window");
assert.match(css,/\.team-relic-battle-dim\{[^}]*transition:opacity \.36s ease/,
  "battlefield dimming must be gradual");
assert.match(css,/\.team-relic-battle-cutin\{[^}]*flex-direction:column[^}]*border:0[^}]*background:none[^}]*box-shadow:none/,
  "center identity must be icon-over-name with no frame or panel");
assert.match(css,/\.team-relic-battle-cutin-icon\{[^}]*border:0[^}]*background:none[^}]*box-shadow:none/,
  "battle icon itself must have no box");
assert.match(css,/\.team-relic-battle-cutin-copy\{[^}]*border:0[^}]*background:none[^}]*box-shadow:none[^}]*text-align:center/,
  "relic name must be centered under the icon with no box");
assert.match(css,/\.team-relic-battle-target-focus-layer\{[\s\S]*position:absolute;inset:0;z-index:20/,
  "target focus must live inside the viewport cinematic layer");
assert.match(css,/\.team-relic-battle-target-outline\{[\s\S]*opacity:0[\s\S]*transition:opacity \.42s ease/,
  "target outlines must reveal gradually without altering live Unit opacity");
assert.doesNotMatch(css,/team-relic-battle-target-layer|team-relic-battle-target-focus-visible/,
  "legacy live-DOM target stacking must remain retired");
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
const relicCardSource=relic.slice(
  relic.indexOf("function cardMarkup(def)"),
  relic.indexOf("function renderRelicList()")
);
assert.match(relicCardSource,/class="team-relic-equip"/,
  "DEV test ownership must use the same formal player-facing equip control");
assert.match(relicCardSource,/equipped\?'已裝備':'裝備'/,
  "formal equip control must expose 裝備／已裝備 without DEV labels");
assert.doesNotMatch(relic,/team-relic-card-dev|team-relic-dev-equip|DEV 正式功能配裝|DEV 僅演出配裝|Runtime Ready（正式功能已完成）|Presentation Only（僅演出預覽/,
  "player-facing relic markup must not expose DEV or capability classification");
assert.match(relic,/v174RelicDevPreviewPresentation=function\(id\)/,
  "internal manual presentation diagnostic may remain available without a player-facing button");
assert.match(css,/\.team-relic-card \.team-relic-equip\{[^}]*min-height:34px/,
  "formal equip control must be visibly actionable");
assert.doesNotMatch(css,/team-relic-card-dev|team-relic-dev-equip/,
  "relic CSS must not keep a second DEV-only card contract");
assert.match(relic,/function equipRelic\(id\)[\s\S]*teamLoadout\.relicId=id;[\s\S]*saveRelics\(\);[\s\S]*syncHomeRelicUi\(\)/,
  "DEV and production testing must converge on the canonical teamLoadout save path");
assert.doesNotMatch(relic,/devPreviewRelicId/,
  "parallel DEV loadout state must not return");

assert.match(core,/const POST_ACTION_DELAY_MS=1150;/,
  "global battle pacing must remain untouched");
assert.match(v143,/function relicSheet\(src,hitFrame,options\)[\s\S]*authoredHitFrame:frame/,
  "reviewed relic authored hit frames must remain untouched");

console.log("✓ relic cinematic target reveal, dedicated icon and formal equip contracts passed");
