"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("css/51-v173.20-startup-loader.css","utf8");
const source=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");

for(const file of ["assets/ui/startup-logo-v173.20.jpg","assets/ui/startup-main-city-v173.20.jpg"]){
  const details=execFileSync("identify",["-format","%m %w %h",file],{encoding:"utf8"});
  assert.equal(details,"JPEG 864 1536",file);
}
assert.ok(html.indexOf('id="startupLoader"')<html.indexOf('id="app"'));
assert.ok(html.indexOf("js/52-v173.20-startup-loader.js?v=173.52")<html.indexOf("js/00-main.js?v=173.52"));
assert.match(html,/css\/51-v173\.20-startup-loader\.css\?v=173\.52/);
assert.match(loader,/const V_ASSET_VERSION="173\.52"/);
assert.match(loader,/TOTAL_RUNTIME_MODULES=32/);
assert.match(loader,/__v173ReportRuntimeProgress/);
assert.doesNotMatch(loader,/id="v17347RuntimeGate"/);
assert.match(source,/DEFAULT_RUNTIME_TOTAL=32/);
assert.match(source,/v173:runtime-progress/);
assert.match(source,/v173:runtime-ready/);
assert.match(source,/v173:runtime-failed/);
assert.match(source,/moduleRatio[\s\S]*?\*90/);
assert.match(source,/elapsed\/totalDuration/);
assert.match(source,/!runtimeReady\|\|now\(\)-startedAt<totalDuration/);
assert.match(source,/runtimeFailed/);
assert.match(source,/載入核心系統/);
assert.match(source,/已載入 \"\+loaded\+\" \/ \"\+runtimeTotal\+\" 個遊戲模組/);
assert.match(html,/〔點擊空白處 進入遊戲〕/);
assert.match(css,/\.startup-enter-prompt\{[\s\S]*?animation:startupEnterBlink 1\.15s ease-in-out infinite;/);
console.log("✓ V173.52 real startup progress + 12~15s cinematic gate");
