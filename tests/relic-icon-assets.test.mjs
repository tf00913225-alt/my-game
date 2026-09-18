import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const confirmed=["relic_qiankun_flask","relic_sun_orb","relic_xuanwu_seal","relic_soul_bell","relic_tiangang_banner","relic_nine_dragon_fire","relic_cold_spring_jade","relic_qinglan_feather","relic_rock_mountain_seal","relic_returning_wheel","relic_origin_talisman","relic_broken_army_scroll","relic_red_sky_war_mark","relic_ice_mirror_heart","relic_wind_chasing_talisman","relic_mountain_river_cauldron","relic_burning_star_mark","relic_spirit_spring_bottle","relic_demon_suppressing_seal","relic_all_returning_array"];
const iconPaths=confirmed.map(id=>`assets/relics/icons/${id}.webp`);
const fragmentPaths=[
  ...confirmed.map(id=>`assets/relics/fragments/${id}.webp`),
  "assets/relics/fragments/relic_universal_fragment.webp"
];

function assertWebP(path){
  assert.equal(fs.existsSync(path),true,`missing ${path}`);
  const bytes=fs.readFileSync(path);
  assert.ok(bytes.length>20,`empty/short ${path}`);
  assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF",`not RIFF ${path}`);
  assert.equal(bytes.subarray(8,12).toString("ascii"),"WEBP",`not WEBP ${path}`);
}

test("confirmed relic art is WebP and all formal refs exist",()=>{
  [...iconPaths,...fragmentPaths].forEach(assertWebP);
});

test("team relic catalog uses confirmed WebP art for all 20 relics",()=>{
  const source=fs.readFileSync("js/60-team-relic-system.js","utf8");
  for(const path of iconPaths){ assert.ok(source.includes(`iconPath:"${path}"`),path); }
  for(const id of confirmed){ assert.ok(!source.includes(`assets/relics/icons/${id}.png`)); }
});

test("inventory fragment definitions use img markup for confirmed WebP art",()=>{
  const source=fs.readFileSync("js/relic-progression-drop-system.js","utf8");
  for(const path of confirmed.map(id=>`assets/relics/fragments/${id}.webp`)){ assert.ok(source.includes(path),path); }
  assert.ok(source.includes("assets/relics/fragments/relic_universal_fragment.webp"));
  assert.match(source,/function fragmentIconMarkup\(path\)/);
  assert.match(source,/fragmentIconMarkup\(path\)\{[\s\S]*?class="v169-item-art v174-relic-fragment-art"[\s\S]*?<img src=/);
  assert.match(source,/decoding="async" onerror="this\.hidden=true"/);
  assert.ok(!source.includes(".png"));
});
