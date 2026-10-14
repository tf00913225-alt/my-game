"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
// Resolve the fixed native spacing token for source-level geometry contracts.
const nativeCss=s=>s.replace(/calc\((\d+(?:\.\d+)?) \* var\(--ui-length-unit,1px\)\)/g,(_,n)=>(Number(n)*3)+'px');
const read=p=>fs.readFileSync(p,"utf8");
const base=nativeCss(read("css/00-main.css")),index=read("index.html"),roster=read("css/19-stage-v54-main-city-moderate-native-scale.css"),runtime=read("js/16-stage-v54-main-city-runtime.js");
const utility=nativeCss(read("css/56-v174-critical-ui-regressions.css"));
let passed=0;function test(n,f){f();passed++;console.log("✓ "+n);}
test("HUD uses the requested logical typography without growing its shell",()=>{
 assert.match(base,/\.home-city-hud\{[\s\S]*?min-height:144px;/);
 assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;/);
 assert.match(base,/\.home-hud-kicker\{[^}]*gap:24px;[^}]*font-size:60px;[^}]*line-height:1\.15;/);
 assert.match(roster,/#game-ui #homePage \.home-version-badge\{font-size:39px;line-height:51px;\}/);
 assert.match(base,/\.home-hud-resources\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(index,/homeHudCharacterList|homeHudCharacterName|homeHudCharacterLevel/);
});
test("paired collections and four tools remain compact in normal browser flow",()=>{
 assert.match(utility,/#game-ui \.team-relic-home-tools\{[^}]*position:relative;[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\);[^}]*grid-row:3;[^}]*width:100%;/);
 assert.match(utility,/\.home-card-utility\{[^}]*display:flex;[^}]*grid-column:span 2;[^}]*height:132px;/);
 assert.match(utility,/\.home-card-utility \.home-card-icon\{[^}]*height:96px;[^}]*background-size:contain/);
 assert.match(utility,/\.home-card-utility \.home-card-label\{[^}]*font-size:45px;[^}]*line-height:66px;/);
 assert.doesNotMatch(base,/\.home-utility-actions\{|^\.home-card-utility\{/m,'persistent utility owner must not compete with legacy defaults');
 assert.match(base,/#app\.no-header \.header\{[^}]*display:none;/);
});
test("roster keeps three cells while growing enough for the permanent typography floor",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?margin:12px 30px 0;/);
 assert.match(roster,/\.v146-home-roster > header\{[\s\S]*?grid-column:1\/-1;[\s\S]*?display:grid;[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1\.55fr\) auto;[\s\S]*?column-gap:24px;[\s\S]*?min-height:90px;[\s\S]*?font-size:45px;[\s\S]*?line-height:60px;/);
 assert.match(roster,/\.v146-home-character\{[\s\S]*?grid-template-columns:minmax\(0,1fr\);[\s\S]*?min-height:210px;[\s\S]*?padding:9px 6px;/);
 assert.match(roster,/\.v146-home-avatar\{[\s\S]*?width:96px;[\s\S]*?height:96px;[\s\S]*?transform:none/);
 assert.match(roster,/\.v146-home-character-main > div:first-child\{[\s\S]*?font-size:45px;[\s\S]*?line-height:57px/);
 assert.match(roster,/\.v146-home-character-main span\{[\s\S]*?font-size:39px;[\s\S]*?line-height:51px/);
 assert.match(roster,/\.v146-home-resource\{[\s\S]*?height:57px/);
 assert.match(roster,/\.v146-home-resource strong\{[\s\S]*?font-size:39px;[\s\S]*?line-height:51px/);
 assert.match(runtime,/function ensureHomeRosterShell\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
 assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?ensureHomeRosterShell\(\)/);
 assert.match(runtime,/team-relic-loadout-slot/);
});
test("home cards retain readable heights and adapt to browser width",()=>{
 assert.match(base,/\.home-card-primary\{[^}]*height:204px;/);
 assert.match(base,/\.home-card-secondary\{[^}]*width:100%;[^}]*height:204px;/);
 assert.match(base,/\.home-secondary-actions\{[^}]*grid-template-columns:repeat\(2,minmax\(192px,20%\)\);[^}]*grid-auto-rows:204px;/);
 assert.match(base,/#homePage\{[\s\S]*?height:calc\(100% - 216px\);[\s\S]*?overflow-y:auto;/);
});
console.log("\n"+passed+" V173.39 main-city pixel-tune tests passed.");
