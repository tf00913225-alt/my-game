"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const css=fs.readFileSync("css/33-v132-content-expansion.css","utf8");
const content=fs.readFileSync("js/27-v132-content-expansion.js","utf8");

assert.match(content,/modal\.id="v132RewardModal"[\s\S]*?document\.body\.appendChild\(modal\)/);
assert.match(css,/\.v132-reward-modal \.v132-reward-modal-inner\.v17346-shop-preview-modal\{[\s\S]*?height:400px !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/\.v132-reward-modal \.v17346-shop-preview-modal \.v17346-shop-preview-art\{[\s\S]*?width:min\(138px,100%\) !important;[\s\S]*?max-width:100% !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/\.v132-reward-modal \.v17346-shop-preview-modal \.v17346-shop-preview-art > \.v169-item-art\{[\s\S]*?display:block !important;[\s\S]*?max-width:100% !important;[\s\S]*?overflow:hidden !important;/);
assert.match(css,/\.v132-reward-modal \.v17346-shop-preview-modal \.v17346-shop-preview-art > \.v169-item-art > img,[\s\S]*?object-fit:contain !important;/);
assert.match(css,/\.v132-reward-modal \.v17346-shop-preview-modal \.v132-reward-actions\{[\s\S]*?position:static !important;/);
assert.doesNotMatch(css,/#game-stage \.v132-reward-modal \.v132-reward-modal-inner\.v17346-shop-preview-modal/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("V173.46 shop preview selector checks passed; browser overflow check skipped: Chrome not available");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".v17346-shop-preview-overflow.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/33-v132-content-expansion.css">
<link rel="stylesheet" href="css/49-v169-rpg-ui.css">
<link rel="stylesheet" href="css/50-v169-abyss-flow.css">
<style>html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#000}</style>
</head><body><div id="v132RewardModal" class="v132-reward-modal show"><div class="v132-reward-modal-inner v17346-shop-preview-modal"><h3>紫霞法袍</h3><div class="v17346-shop-preview-art"><span class="v169-item-art v169-equipment-art v17346-rarity-purple"><img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='500'%3E%3Crect width='900' height='500' fill='purple'/%3E%3C/svg%3E"></span></div><div class="v17346-shop-preview-info"><span>衣服</span><strong>體質 +8</strong></div><div class="v17346-shop-preview-price">4,000 金幣</div><div class="v132-reward-actions"><button>返回</button></div></div></div><pre id="result"></pre><script>
const q=s=>document.querySelector(s),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}};
const modal=q('.v17346-shop-preview-modal'),art=q('.v17346-shop-preview-art'),item=q('.v169-item-art'),img=q('.v169-item-art img');
document.querySelector('#result').textContent=JSON.stringify({modal:rect(modal),art:rect(art),item:rect(item),img:rect(img),overflow:modal.scrollWidth-modal.clientWidth});
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=390,844","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Shop preview browser fixture failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(match,"shop preview browser result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.ok(data.modal.width<=340,"shop preview modal must keep the shared width ceiling");
    assert.ok(data.art.width<=138&&data.art.height<=138,"shop preview art must stay inside its fixed square");
    assert.ok(data.item.right<=data.art.right+1&&data.item.left>=data.art.left-1,"rarity frame must stay inside preview art");
    assert.ok(data.img.right<=data.item.right+1&&data.img.left>=data.item.left-1,"equipment image must stay inside rarity frame");
    assert.ok(data.overflow<=1,"shop preview must not create horizontal overflow");
    console.log(`Headless Chrome: shop preview art ${data.art.width}x${data.art.height}; horizontal overflow ${data.overflow}px`);
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}

console.log("V173.46 shop preview body-modal selector and overflow regression checks passed");
