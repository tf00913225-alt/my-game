"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const manifest=JSON.parse(fs.readFileSync("build/asset-manifest.json","utf8"));
const assetText=path=>fs.readFileSync(path,"utf8");
const bundlePath=kind=>manifest.featureManifest.bundles[kind];
const readBundleScripts=kind=>bundlePath(kind).scripts.map(assetText).join("\n");
const readBundleStyles=kind=>bundlePath(kind).styles.map(assetText).join("\n");
const abyssBundle=readBundleScripts("feature-abyss");
const gameplayJs=readBundleScripts("gameplay-core");
const gameplayCss=readBundleStyles("gameplay-core");
const appCss=readBundleStyles("app-shell");

const registry=JSON.parse(fs.readFileSync('config/monster-portrait-registry.json','utf8'));
const finalPortraits=registry.groups['abyss-boss'].filter(row=>row[0].startsWith('abyss.final.'));
assert.equal(finalPortraits.length,5);
assert.equal(new Set(finalPortraits.map(row=>row[5])).size,5);
finalPortraits.forEach(row=>{assert.equal(row[6],'existing');assert.ok(fs.existsSync(row[5]),row[0]);});
assert.match(gameplayJs,/config\/monster-portrait-registry\.json/,'production resolver must load the canonical Registry');
assert.match(gameplayJs,/v154ResolveMonsterPortraitRecord/);
assert.doesNotMatch(gameplayJs,/EARLY_ABYSS_PORTRAITS|FINAL_ABYSS_PORTRAITS/,'retired duplicate path maps cannot return');
for(const skill of [
    "dustStorm","flyingSandStrike","rockWall","windHowlLightning","stormRain",
    "stealthSkill","phoenixCry","yuanZuBlessing","iceArrowRain","iceSpin",
    "healSpell","dragonSlash","rage"
]){
    assert.match(abyssBundle,new RegExp(JSON.stringify(skill)),`Abyss bundle is missing ${skill}`);
}
assert.doesNotMatch(abyssBundle,/FINAL_BOSS_RULES|v144PatchFinalAbyssRoster|v155PatchFinalAbyssRoster/);
assert.doesNotMatch(gameplayJs,/56-v173\.51-shop-qa|v17351ShopQa/);
assert.match(gameplayCss,/grid-template-rows:96px minmax\(0,1fr\) 174px !important/);
assert.doesNotMatch(gameplayCss,/grid-template-rows:minmax\(0,1fr\) (?:64|192)px!important/);
assert.match(appCss,/#game-ui #homePage \.v146-home-roster>header\{/);
assert.match(appCss,/#game-ui #homePage \.v146-home-roster\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
console.log("Production bundle owner/cascade checks passed");
