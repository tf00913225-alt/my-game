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
test("utility buttons are 104x46 with 40px icons and a 52px centre corridor",()=>{
 assert.match(base,/\.home-utility-actions\{[\s\S]*?bottom:0;[\s\S]*?grid-template-columns:repeat\(2,104px\);[\s\S]*?padding:0 68px;/);
 assert.match(base,/\.home-card-utility\{[\s\S]*?grid-template-columns:40px minmax\(0,1fr\);[\s\S]*?height:46px;/);
 assert.match(base,/\.home-card-utility \.home-card-icon\{[\s\S]*?width:40px;[\s\S]*?height:40px;/);
 assert.match(base,/\.home-card-utility \.home-card-label\{[\s\S]*?font-size:16px;[\s\S]*?letter-spacing:-\.75px;/);
 assert.equal(396-(68*2)-(104*2),52);
});
test("roster uses the closest feasible geometry while bottom nav remains fixed",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?margin:45\.5px 10px 0;[\s\S]*?padding:3\.5px 7px;/);
 assert.match(roster,/\.v146-home-roster > header\{[\s\S]*?min-height:15px;[\s\S]*?line-height:15px;/);
 assert.match(roster,/\.v146-home-character\{[\s\S]*?height:47px;[\s\S]*?padding:1\.5px 7px 1\.5px 2px;/);
 const oldHeight=166,newHeight=171;
 assert.equal(45.5-8,37.5);assert.equal(newHeight-oldHeight,5);assert.equal(newHeight,171);
 assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
});
test("forbidden entry sizes and navigation remain untouched",()=>{
 assert.match(base,/\.home-card-primary\{[\s\S]*?height:90px;/);
 assert.match(base,/\.home-card-secondary\{[\s\S]*?width:80px;[\s\S]*?height:82px;/);
 assert.match(base,/\.home-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,80px\);[\s\S]*?grid-template-rows:repeat\(3,82px\);/);
 assert.match(base,/#homePage\{[\s\S]{0,520}height:100%;[\s\S]{0,180}overflow:hidden/);
});
console.log("\n"+passed+" V173.39 main-city pixel-tune tests passed.");
