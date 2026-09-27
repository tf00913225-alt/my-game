"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");

const activityAssets=[
    "assets/gameplay/covers/boss.webp",
    "assets/gameplay/covers/tower.webp",
    "assets/gameplay/covers/abyss.webp",
    "assets/gameplay/covers/coming-soon.webp"
];
const towerAssets=[
    "assets/gameplay/tower/tower-fire-hero.webp",
    "assets/gameplay/tower/tower-earth-hero.webp",
    "assets/gameplay/tower/tower-water-hero.webp",
    "assets/gameplay/tower/tower-wind-hero.webp"
];
const allAssets=[...activityAssets,...towerAssets];

for(const file of allAssets){
    assert.equal(file.endsWith(".webp"),true,`${file} must be a formal WebP runtime asset`);
    assert.equal(fs.existsSync(file),true,`missing runtime art: ${file}`);
}

const css=fs.readFileSync("css/gameplay-boss-tower.css","utf8");
for(const file of allAssets){
    assert.ok(css.includes(`url("../${file}")`),`CSS owner must reference ${file}`);
}
assert.equal(css.includes("assets/inbox/美術圖"),false,"runtime CSS must not reference inbox masters");

const js=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
assert.ok(js.includes('data-tower-element="'+escapeHtml(tower.element)+'"'),"tower hero must expose canonical current element to the CSS owner");

const featureManifest=JSON.parse(fs.readFileSync("config/feature-manifest.json","utf8"));
const bundleAssets=featureManifest.bundles["feature-boss-relic"].assets||[];
assert.deepEqual(bundleAssets,allAssets,"boss/tower feature bundle must preload exactly the integrated activity artwork");

console.log("Gameplay activity artwork integration contract: PASS");
