"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

function findChrome(){
  for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const result=cp.spawnSync("which",[name],{encoding:"utf8"});
    if(result.status===0&&result.stdout.trim()) return result.stdout.trim();
  }
  return "";
}

const chrome=findChrome();
if(!chrome){
  console.log("V173.50 EXP viewport browser check skipped: Chrome not available");
  process.exit(0);
}

const fixture=path.join(process.cwd(),".v17349-exp-stability-smoke.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const growth=fs.readFileSync("js/28-v133-economy-rebalance.js","utf8");

const helperStart=growth.indexOf("    function v173CaptureExpPoolViewport()");
const helperEnd=growth.indexOf("    function wrapExpPreviewForCatchUp()",helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,"V173.50 viewport helpers missing");
const helpers=growth.slice(helperStart,helperEnd);

const html=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:420px;height:740px;overflow:hidden}
#characterTabContent{height:360px;overflow-y:auto}
#spacer{height:220px}
#homeExpPoolCard{height:600px}
#expDistributeList{height:320px}
</style></head><body>
<div id="characterTabContent"><div id="spacer"></div><div id="homeExpPoolCard"><button class="v131-exp-preview-btn">預覽</button><div id="expDistributeList"></div></div></div>
<pre id="result"></pre>
<script>
${helpers}
function decorateExpPoolDistributionUi(){
  const list=document.getElementById('expDistributeList');
  list.innerHTML='<div style="height:80px">重新排版</div><div style="height:240px">內容</div>';
}
const scroller=document.getElementById('characterTabContent');
scroller.scrollTop=180;
const snapshot=v173CaptureExpPoolViewport();
scroller.scrollTop=224;
v173ScheduleExpPoolDecoration(snapshot);
setTimeout(()=>{document.getElementById('result').textContent=JSON.stringify({top:scroller.scrollTop});},80);
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
  const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=420,740","--virtual-time-budget=500","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:4*1024*1024});
  assert.equal(run.status,0,run.stderr||"Chrome EXP viewport fixture failed");
  const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
  assert.ok(match,"EXP viewport browser result missing");
  const result=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
  assert.equal(result.top,180,"EXP preview re-render changed the saved viewport position");
  console.log("Headless Chrome: EXP allocation viewport stayed fixed across re-render");
} finally {
  try{fs.unlinkSync(fixture);}catch(_){ }
}
