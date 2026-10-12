"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const base=read("css/00-main.css"),index=read("index.html"),roster=read("css/19-stage-v54-main-city-moderate-native-scale.css"),runtime=read("js/16-stage-v54-main-city-runtime.js");
const utility=read("css/56-v174-critical-ui-regressions.css");
let passed=0;function test(n,f){f();passed++;console.log("✓ "+n);}
test("HUD uses the requested logical typography without growing its shell",()=>{
 assert.match(base,/\.home-city-hud\{[\s\S]*?min-height:48px;/);
 assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;/);
 assert.match(base,/\.home-hud-kicker\{[^}]*gap:8px;[^}]*font-size:20px;[^}]*line-height:1\.15;/);
 assert.match(roster,/#game-ui #homePage \.home-version-badge\{font-size:13px;line-height:17px;\}/);
 assert.match(base,/\.home-hud-resources\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(index,/homeHudCharacterList|homeHudCharacterName|homeHudCharacterLevel/);
});
test("paired collections and four tools remain compact in normal browser flow",()=>{
 assert.match(utility,/#game-ui \.team-relic-home-tools\{[^}]*position:relative;[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\);[^}]*grid-row:3;[^}]*width:100%;/);
 assert.match(utility,/\.home-card-utility\{[^}]*display:flex;[^}]*grid-column:span 2;[^}]*height:44px;/);
 assert.match(utility,/\.home-card-utility \.home-card-icon\{[^}]*height:32px;[^}]*background-size:contain/);
 assert.match(utility,/\.home-card-utility \.home-card-label\{[^}]*font-size:15px;[^}]*line-height:22px;/);
 assert.doesNotMatch(base,/\.home-utility-actions\{|^\.home-card-utility\{/m,'persistent utility owner must not compete with legacy defaults');
 assert.match(base,/#app\.no-header \.header\{[^}]*display:none;/);
});
test("roster keeps three cells while growing enough for the permanent typography floor",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?margin:5px 10px 0;/);
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
test("home cards retain readable heights and adapt to browser width",()=>{
 assert.match(base,/\.home-card-primary\{[^}]*height:68px;/);
 assert.match(base,/\.home-card-secondary\{[^}]*width:100%;[^}]*height:68px;/);
 assert.match(base,/\.home-secondary-actions\{[^}]*grid-template-columns:repeat\(2,minmax\(64px,20%\)\);[^}]*grid-auto-rows:68px;/);
 assert.match(base,/#homePage\{[\s\S]*?height:100%;[\s\S]*?overflow-y:auto;/);
});
console.log("\n"+passed+" V173.39 main-city pixel-tune tests passed.");
