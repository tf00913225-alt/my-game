"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const base=read("css/00-main.css"),index=read("index.html"),roster=read("css/19-stage-v54-main-city-moderate-native-scale.css"),runtime=read("js/16-stage-v54-main-city-runtime.js");
let passed=0;function test(n,f){f();passed++;console.log("✓ "+n);}
test("HUD uses the requested logical typography without growing its shell",()=>{
 assert.match(base,/\.home-city-hud\{[\s\S]*?min-height:48px;/);
 assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;/);
 assert.match(base,/\.home-hud-kicker\{[\s\S]*?gap:8px;[\s\S]*?font-size:15px;[\s\S]*?line-height:1\.15;/);
 assert.match(roster,/#game-stage #homePage \.home-version-badge\{font-size:13px;line-height:17px;\}/);
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
test("roster keeps three cells while growing enough for the permanent typography floor",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?gap:4px;[\s\S]*?margin:18px 10px calc\(var\(--bottom-nav-height,70px\) \+ var\(--safe-bottom,0px\) \+ 12px\);padding:5px 7px 7px;/);
 assert.match(roster,/\.v146-home-roster > header\{[\s\S]*?grid-column:1\/-1;[\s\S]*?display:grid;[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1\.55fr\) auto;[\s\S]*?column-gap:8px;[\s\S]*?min-height:30px;[\s\S]*?font-size:15px;[\s\S]*?line-height:20px;/);
 assert.match(roster,/\.v146-home-character\{[\s\S]*?grid-template-columns:40px minmax\(0,1fr\);[\s\S]*?min-height:84px;[\s\S]*?padding:5px 4px 5px 3px;/);
 assert.match(roster,/\.v146-home-avatar\{[\s\S]*?width:40px;[\s\S]*?height:40px;[\s\S]*?transform:none/);
 assert.match(roster,/\.v146-home-character-main > div:first-child\{[\s\S]*?font-size:15px;[\s\S]*?line-height:19px/);
 assert.match(roster,/\.v146-home-character-main span\{[\s\S]*?font-size:13px;[\s\S]*?line-height:17px/);
 assert.match(roster,/\.v146-home-resource\{[\s\S]*?height:17px/);
 assert.match(roster,/\.v146-home-resource strong\{[\s\S]*?font-size:13px;[\s\S]*?line-height:15px/);
 assert.match(runtime,/function ensureHomeRosterShell\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
 assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?ensureHomeRosterShell\(\)/);
 assert.match(runtime,/team-relic-loadout-slot/);
});
test("forbidden entry sizes and navigation remain untouched",()=>{
 assert.match(base,/\.home-card-primary\{[\s\S]*?height:90px;/);
 assert.match(base,/\.home-card-secondary\{[\s\S]*?width:80px;[\s\S]*?height:82px;/);
 assert.match(base,/\.home-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,80px\);[\s\S]*?grid-template-rows:repeat\(4,82px\);/);
 assert.match(base,/#homePage\{[\s\S]{0,520}height:100%;[\s\S]{0,220}overflow-y:auto;[\s\S]{0,120}overflow-x:hidden/);
});
console.log("\n"+passed+" V173.39 main-city pixel-tune tests passed.");