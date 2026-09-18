"use strict";

const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const vfx=fs.readFileSync("js/39-v143-skill-animation.js","utf8");
const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const root="assets/vfx/relic";

const expected=[
    ["relic_qiankun_flask","relic_qiankun_flask.webp",3400,7,"allyAll"],
    ["relic_sun_orb","relic_sun_orb.webp",3200,7,"enemyAll"],
    ["relic_xuanwu_seal","relic_xuanwu_seal.webp",3600,8,"allyAll"],
    ["relic_soul_bell","relic_soul_bell.webp",3500,8,"enemyAll"],
    ["relic_tiangang_banner","relic_tiangang_banner.webp",3800,9,"enemyAll"],
    ["relic_nine_dragon_fire","relic_nine_dragon_fire.webp",3600,8,"enemyAll"],
    ["relic_cold_spring_jade","relic_cold_spring_jade.webp",3200,7,"singleAlly"],
    ["relic_qinglan_feather","relic_qinglan_feather.webp",3000,6,"allyAll"],
    ["relic_rock_mountain_seal","relic_rock_mountain_seal.webp",3500,7,"allyAll"],
    ["relic_returning_wheel","relic_returning_wheel.webp",3800,7,"singleAlly"],
    ["relic_origin_talisman","relic_origin_talisman.webp",3500,7,"allyAll"],
    ["relic_broken_army_scroll","relic_broken_army_scroll.webp",3200,8,"singleEnemy"],
    ["relic_red_sky_war_mark","relic_red_sky_war_mark.webp",3300,7,"allyAll"],
    ["relic_ice_mirror_heart","relic_ice_mirror_heart.webp",3300,6,"enemyAll"],
    ["relic_wind_chasing_talisman","relic_wind_chasing_talisman.webp",3000,6,"allyAll"],
    ["relic_mountain_river_cauldron","relic_mountain_river_cauldron.webp",3600,7,"allyAll"],
    ["relic_burning_star_mark","relic_burning_star_mark.webp",3300,7,"enemyAll"],
    ["relic_spirit_spring_bottle","relic_spirit_spring_bottle.webp",3200,6,"allyAll"],
    ["relic_demon_suppressing_seal","relic_demon_suppressing_seal.webp",3500,6,"allyAll"],
    ["relic_all_returning_array","relic_all_returning_array.webp",3800,8,"allyAll"]
];

const runtimeFiles=fs.readdirSync(root).filter(name=>name.endsWith(".webp")).sort();
assert.equal(runtimeFiles.length,20,"runtime must contain exactly 20 relic WebP VFX sheets");
assert.deepEqual(runtimeFiles,expected.map(row=>row[1]).sort(),"runtime relic VFX set must match the 20 catalog relics");

for(const [id,file,duration,hitFrame,target] of expected){
    const bytes=fs.readFileSync(path.join(root,file));
    assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF",file+" must be a WebP RIFF container");
    assert.equal(bytes.subarray(8,12).toString("ascii"),"WEBP",file+" must be WebP");
    assert.ok(
        vfx.includes(id+':relicSheet("assets/vfx/relic/'+file+'",'+hitFrame+')'),
        id+" must map to its reviewed 4x3 VFX sheet and hit frame"
    );
    assert.ok(
        relic.includes(id+":relicVfx("+duration+","),
        id+" must preserve its reviewed duration"
    );
    assert.ok(
        relic.includes('"'+target+'")'),
        "target policy "+target+" must exist in the relic VFX presentation map"
    );
}

assert.match(vfx,/function relicSheet\(src,hitFrame,options\)[\s\S]*const frameIndex=frame-1;[\s\S]*hit:frameIndex\/12/,"relic hit timing must use the one-based authored frame without an off-by-one delay");
assert.match(vfx,/lazyAsset:true/,"relic VFX must remain lazy instead of preloading all 20 sheets");
assert.match(vfx,/window\.v143PreloadBattleVfxAsset=function/,"equipped relic VFX must preload through the V143 owner");
assert.match(relic,/RELIC_VFX_MIN_DURATION_MS=3000/,"every relic VFX must enforce the premium 3-second minimum");
assert.match(relic,/presentationLeadGapMs:120/,"relic VFX must keep the existing handoff gap without shortening the authored animation");
assert.ok(expected.every(row=>row[2]>=3000),"every configured relic VFX must be at least 3 seconds");
assert.match(relic,/function playRelicVfx\([\s\S]*director\.play\(/,"relic presentation must reuse the V142/V143 formal animation pipeline");
assert.doesNotMatch(relic,/createElement\(["'](?:canvas|svg|i)["']\)/,"team relic runtime must not create a second raster/VFX renderer");
assert.match(relic,/function queueRelicPresentation\(def,onStart,visualContext\)[\s\S]*playRelicVfx\([\s\S]*if\(typeof onStart==="function"\)\{ onStart\(\); \}/,"relic VFX starts before effect float callbacks so hit numbers can synchronize to V143");
assert.match(relic,/before_lethal_damage[\s\S]*resolveEffects\(triggerDef,def,payload\|\|\{\}\)[\s\S]*performRelicPresentation/,"lethal-prevention gameplay must remain synchronous before its visual presentation");
assert.doesNotMatch(vfx,/assets\/inbox\/秘寶icon\/秘寶技能VFX/,"runtime VFX owner must never reference staging PNGs");
assert.doesNotMatch(relic,/assets\/inbox\/秘寶icon\/秘寶技能VFX/,"relic runtime must never reference staging PNGs");

console.log("✓ relic VFX asset, timing, targeting and single-owner contracts passed");
