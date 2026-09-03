"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const base=read("css/00-main.css"),index=read("index.html"),roster=read("css/42-v146-system-polish.css"),runtime=read("js/41-v146-system-polish.js");
let passed=0;function test(n,f){f();passed++;console.log("✓ "+n);}
test("HUD uses the requested logical typography without growing its shell",()=>{
 assert.match(base,/\.home-city-hud\{[\s\S]*?min-height:48px;/);
 assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;/);
 assert.match(base,/\.home-hud-kicker\{[\s\S]*?gap:8px;[\s\S]*?font-size:15px;[\s\S]*?line-height:1\.15;/);
 assert.match(index,/#game-stage #homePage \.home-version-badge\{[\s\S]*?font-size:11px;/);
 assert.match(base,/\.home-hud-resources\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(index,/homeHudCharacterList|homeHudCharacterName|homeHudCharacterLevel/);
});
test("utility buttons use image-over-text cards and preserve the centre passage",()=>{
 assert.match(base,/\.home-utility-actions\{[\s\S]*?bottom:0;[\s\S]*?grid-template-columns:repeat\(2,92px\);[\s\S]*?padding:0 74px;/);
 assert.match(base,/\.home-card-utility\{[\s\S]*?grid-template-columns:1fr;[\s\S]*?grid-template-rows:52px 24px;[\s\S]*?height:78px;/);
 assert.match(base,/\.home-card-utility \.home-card-icon\{[\s\S]*?width:100%;[\s\S]*?height:52px;[\s\S]*?border-bottom:1px solid/);
 assert.match(base,/\.home-card-utility \.home-card-label\{[\s\S]*?font-size:15\.5px;[\s\S]*?line-height:23px;/);
 assert.match(base,/#app\.no-header \.header,\s*#app:has\(#homePage\.active\) #gameHeaderBar\{[\s\S]*?display:none;/);
 assert.equal(396-(74*2)-(92*2),64);
});
test("roster uses the current three-cell horizontal geometry while bottom nav remains fixed",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?margin:45\.5px 10px 0;[\s\S]*?padding:3\.5px 7px 5px;/);
 assert.match(roster,/\.v146-home-roster > header\{[\s\S]*?grid-column:1\/-1;[\s\S]*?min-height:15px;[\s\S]*?line-height:15px;/);
 assert.match(roster,/\.v146-home-character\{[\s\S]*?grid-template-columns:32px minmax\(0,1fr\);[\s\S]*?height:59px;[\s\S]*?padding:3px 4px 3px 2px;/);
 assert.match(roster,/\.v146-home-avatar\{[\s\S]*?width:32px;[\s\S]*?height:32px;[\s\S]*?transform:none/);
 assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
});
test("forbidden entry sizes and navigation remain untouched",()=>{
 assert.match(base,/\.home-card-primary\{[\s\S]*?height:90px;/);
 assert.match(base,/\.home-card-secondary\{[\s\S]*?width:80px;[\s\S]*?height:82px;/);
 assert.match(base,/\.home-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,80px\);[\s\S]*?grid-template-rows:repeat\(4,82px\);/);
 assert.match(base,/#homePage\{[\s\S]{0,520}height:100%;[\s\S]{0,180}overflow:hidden/);
});
console.log("\n"+passed+" V173.39 main-city pixel-tune tests passed.");
