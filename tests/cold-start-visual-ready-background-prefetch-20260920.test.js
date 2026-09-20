"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const city=fs.readFileSync("js/16-stage-v54-main-city-runtime.js","utf8");
const features=fs.readFileSync("js/startup/feature-loader.js","utf8");
const relic=fs.readFileSync("js/60-team-relic-system.js","utf8");
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const firstPlay=JSON.parse(fs.readFileSync("config/first-play-manifest.json","utf8"));

const readyBlock=startup.slice(startup.indexOf("async function enterReady"),startup.indexOf("async function enterCreation"));
const dataIndex=readyBlock.indexOf("main-city-data-ready");
const visualIndex=readyBlock.indexOf("prepareFirstScreenVisuals");
const hideIndex=readyBlock.indexOf("hideLoader");
assert.ok(dataIndex>=0&&visualIndex>dataIndex&&hideIndex>visualIndex);
assert.match(city,/backgroundImage/);
assert.match(city,/document\.fonts.*ready|document\.fonts&&document\.fonts\.ready/);
assert.match(city,/main-city-visual-ready/);
assert.doesNotMatch(startup,/setTimeout\([^\n]*(?:1000|2000|3000)/);
assert.match(features,/BACKGROUND_CONCURRENCY=1/);
assert.match(features,/requestIdleCallback/);
assert.match(features,/cancelQueuedBackground/);
assert.match(features,/fetchpriority/);
assert.equal(manifest.relicIcons.length,20);
assert.equal(new Set(manifest.relicIcons).size,20);
assert.equal((relic.match(/iconPath:"/g)||[]).length,20);
assert.match(relic,/正在載入秘寶/);
assert.match(relic,/relic-visual-ready/);
for(const path of ["assets/ui/home-relic-v174.eed14e806044.webp","assets/ui/home-element-box-v174.webp","assets/ui/nav-training.png","assets/ui/nav-gameplay.png","assets/ui/nav-relic-v175.webp"]){
    assert.ok(firstPlay.assets.some(item=>item.path===path),`Missing First Screen asset: ${path}`);
}
console.log("✓ cold-start visual-ready, low-priority UI prefetch and relic first-open contracts passed");
