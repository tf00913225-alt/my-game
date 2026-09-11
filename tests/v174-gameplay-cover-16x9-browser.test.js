"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Gameplay 16:9 mobile browser check skipped: Chrome not available");
    process.exit(0);
}

function runViewport(width,height){
    const fixture=path.join(process.cwd(),`.v174-gameplay-cover-${width}x${height}.html`);
    const fileUrl="file://"+fixture.replace(/\\/g,"/");
    const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/gameplay-boss-tower.css">
<style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#000;}
#game-stage{width:${width}px;height:${height}px;}
.gameplay-page.active{width:100%;height:100%;}
.gameplay-large-panel{width:calc(100% - 24px);height:calc(100% - 24px);}
</style></head><body>
<div id="game-stage"><div class="gameplay-page active"><section class="gameplay-large-panel"><div class="gameplay-panel-scroll"><div class="gameplay-hub-grid">
<button class="gameplay-mode-card boss"><span class="gameplay-mode-copy"><h3>BOSS</h3><p>個人 BOSS・世界 BOSS</p><span class="gameplay-mode-status">新的個人 BOSS 可攻略</span></span><span class="gameplay-mode-seal">戰</span></button>
<button class="gameplay-mode-card tower"><span class="gameplay-mode-copy"><h3>四象塔</h3><p>本週試煉：火元素</p><span class="gameplay-mode-status">目前最高樓層：0 / 100</span></span><span class="gameplay-mode-seal">塔</span></button>
<button class="gameplay-mode-card abyss"><span class="gameplay-mode-copy"><h3>深淵</h3><p>永久高難挑戰</p><span class="gameplay-mode-status">Lv20 未通關</span></span><span class="gameplay-mode-seal">淵</span></button>
<div class="gameplay-mode-card coming-soon"><span class="gameplay-mode-copy"><h3>更多玩法</h3><p>新的特殊戰鬥將統一收錄於此</p></span><span class="gameplay-mode-seal">待</span></div>
</div></div></section></div></div>
<pre id="result"></pre>
<script>
const cards=[...document.querySelectorAll('.gameplay-mode-card')];
const rows=cards.map(card=>{const r=card.getBoundingClientRect(),s=getComputedStyle(card);return {width:r.width,height:r.height,ratio:r.width/r.height,aspectRatio:s.aspectRatio,minHeight:s.minHeight,overflowX:card.scrollWidth-card.clientWidth,overflowY:card.scrollHeight-card.clientHeight};});
document.getElementById('result').textContent=JSON.stringify(rows);
</script></body></html>`;
    fs.writeFileSync(fixture,html,"utf8");
    try{
        const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
        assert.equal(run.status,0,run.stderr||`Chrome gameplay cover fixture failed at ${width}x${height}`);
        const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match,`gameplay cover browser result missing at ${width}x${height}`);
        const rows=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
        assert.equal(rows.length,4);
        rows.forEach((row,index)=>{
            assert.ok(Math.abs(row.ratio-16/9)<0.015,`card ${index} must render at 16:9 on ${width}x${height}; got ${row.ratio}`);
            assert.equal(row.aspectRatio,"16 / 9");
            assert.equal(row.minHeight,"0px","legacy per-card min-height must not distort 16:9 cover geometry");
            assert.ok(row.overflowX<=1,`card ${index} must not overflow horizontally`);
            assert.ok(row.overflowY<=1,`card ${index} text must fit its 16:9 cover`);
        });
        return rows;
    }finally{
        try{fs.unlinkSync(fixture);}catch(_){ }
    }
}

runViewport(390,844);
runViewport(412,915);
console.log("Headless Chrome: gameplay activity covers render 16:9 at 390x844 and 412x915 without internal overflow");
