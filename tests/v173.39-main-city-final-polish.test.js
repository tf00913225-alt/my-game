"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const base=read("css/00-main.css"),index=read("index.html"),roster=read("css/42-v146-system-polish.css"),runtime=read("js/41-v146-system-polish.js");
let passed=0;function test(n,f){f();passed++;console.log("✓ "+n);}
test("HUD identity only grows",()=>{
 assert.match(base,/\.home-hud-identity\{[\s\S]*?align-items:center;[\s\S]*?align-self:stretch;[\s\S]*?inset-inline-start:7px;/);
 assert.match(base,/\.home-hud-kicker\{[\s\S]*?gap:7px;[\s\S]*?font-size:10px;[\s\S]*?line-height:1\.15;/);
 assert.match(index,/#game-stage #homePage \.home-version-badge\{[\s\S]*?padding:3px 6px 2px;[\s\S]*?font-size:9px;/);
 assert.match(base,/\.home-hud-resources\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(base,/\.home-test-button\{[\s\S]*?height:16px;[\s\S]*?opacity:\.78/);
 assert.doesNotMatch(index,/homeHudCharacterList|homeHudCharacterName|homeHudCharacterLevel/);
});
test("utility growth and gate corridor",()=>{
 assert.match(base,/\.home-utility-actions\{[\s\S]*?grid-template-columns:repeat\(2,100px\);[\s\S]*?justify-content:space-between;[\s\S]*?padding:0 68px;/);
 assert.match(base,/\.home-card-utility\{[\s\S]*?grid-template-columns:42px minmax\(0,1fr\);[\s\S]*?height:47px;/);
 assert.match(base,/\.home-card-utility \.home-card-icon\{[\s\S]*?width:41px;[\s\S]*?height:45px;/);
 assert.match(base,/\.home-card-utility \.home-card-label\{[\s\S]*?font-size:12px;[\s\S]*?line-height:45px;/);
 assert.ok((100-86)/86>=.15&&(100-86)/86<=.20);assert.ok((47-40)/40>=.15&&(47-40)/40<=.20);assert.equal(396-(68*2)-(100*2),60);
});
test("roster fills lower area without data-layout changes",()=>{
 assert.match(roster,/\.v146-home-roster\{[\s\S]*?gap:2px;[\s\S]*?margin:8px 10px 0;[\s\S]*?padding:3px 7px;/);
 assert.match(roster,/\.v146-home-character\{[\s\S]*?grid-template-columns:43px minmax\(0,1fr\);[\s\S]*?height:46px;/);
 assert.match(roster,/\.v146-home-avatar\{[\s\S]*?width:45px;[\s\S]*?height:45px;[\s\S]*?transform:translateX\(-4px\)/);
 assert.match(roster,/\.v146-home-resource\{[\s\S]*?height:9px;[\s\S]*?margin-inline:2px/);
 const previous=(2*2)+2+14+(3*2)+(3*44),current=(3*2)+2+14+(3*2)+(3*46);assert.ok((current-previous)/previous>=.05&&(current-previous)/previous<=.08);
 assert.match(runtime,/function renderHomeRoster\(\)[\s\S]*?grid\.insertAdjacentElement\("afterend",roster\)/);
});
test("forbidden entry sizes remain unchanged",()=>{
 assert.match(base,/\.home-card-primary\{[\s\S]*?height:90px;/);assert.match(base,/\.home-card-secondary\{[\s\S]*?width:80px;[\s\S]*?height:82px;/);
 assert.match(base,/\.home-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,80px\);[\s\S]*?grid-template-rows:repeat\(3,82px\);/);
 assert.doesNotMatch(base,/\.home-card-grid\{[\s\S]{0,220}grid-template-columns:repeat\(4,1fr\)/);
});
test("fixed home still fits above unchanged navigation",()=>{const safe=746.6666667-10-78-(14*2),total=(5+48)+(1+90+1+256)+(8+(3*2)+2+14+(3*2)+(3*46));assert.equal(total,575);assert.ok(total<=safe);assert.match(base,/#homePage\{[\s\S]{0,420}height:100%;[\s\S]{0,120}overflow:hidden/);});
console.log("\n"+passed+" V173.39 main-city final-polish tests passed.");
