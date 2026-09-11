"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const candidates=[process.env.CHROME_PATH,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"].filter(Boolean);
const chrome=candidates.find(candidate=>fs.existsSync(candidate));
assert.ok(chrome,"Headless Chrome/Chromium is required for Gameplay mobile UI QA");
const css=["css/gameplay-boss-tower.css","css/56-v174-critical-ui-regressions.css"].map(file=>fs.readFileSync(file,"utf8")).join("\n");
const html="<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"+
"<style>html,body{margin:0;width:390px;min-height:844px;background:#000}#game-stage{width:390px;height:844px}"+css+"</style>"+
"<div id='game-stage'><div class='gameplay-hub-grid'><button class='gameplay-mode-card boss'><span class='gameplay-mode-copy'><h3>BOSS</h3><p>個人 BOSS・世界 BOSS</p><span class='gameplay-mode-status'>測試</span></span><span class='gameplay-mode-seal'>戰</span></button></div></div>"+
"<div id='allElementSkillPreviewModal'><div class='skill-preview-body'></div></div>"+
"<script>(function(){var card=document.querySelector('.gameplay-mode-card');var r=card.getBoundingClientRect();var hint=getComputedStyle(document.querySelector('.skill-preview-body'),'::before');var out={width:r.width,height:r.height,ratio:r.width/r.height,content:hint.content,whiteSpace:hint.whiteSpace,textAlign:hint.textAlign,fontSize:parseFloat(hint.fontSize),overflowX:document.documentElement.scrollWidth-window.innerWidth};document.body.setAttribute('data-qa',encodeURIComponent(JSON.stringify(out)));})();</scr"+"ipt>";
const temp=path.join(os.tmpdir(),"four-symbols-gameplay-ui-qa.html");
fs.writeFileSync(temp,html);
const result=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars","--window-size=390,844","--virtual-time-budget=1000","--dump-dom","file://"+temp],{encoding:"utf8",maxBuffer:16*1024*1024});
if(result.status!==0){ console.error(result.stderr); }
assert.equal(result.status,0,"headless mobile browser QA must launch successfully");
const match=result.stdout.match(/data-qa="([^"]+)"/);
assert.ok(match,"mobile QA payload must be present in dumped DOM");
const metrics=JSON.parse(decodeURIComponent(match[1].replace(/&amp;/g,"&")));
assert.ok(metrics.width>300&&metrics.height>150,"gameplay cover must have real mobile geometry");
assert.ok(Math.abs(metrics.ratio-(16/9))<0.03,"activity cover must render at 16:9, got "+metrics.ratio);
assert.match(metrics.content,/克制：/);
assert.match(metrics.content,/被克制：/);
assert.equal(metrics.whiteSpace,"pre-line");
assert.equal(metrics.textAlign,"left");
assert.ok(metrics.fontSize>=15);
assert.ok(metrics.overflowX<=1,"focused mobile fixture must not create horizontal overflow");
console.log("✓ Gameplay mobile browser QA: 16:9 covers and directional element-counter copy verified.");
