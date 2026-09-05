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
if(!chrome){ console.log("equipment progression browser test skipped: Chrome unavailable"); process.exit(0); }

const fixture=path.join(process.cwd(),".equipment-progression-browser.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:420px;height:747px;background:#000;overflow:hidden}#game-stage{width:420px;height:747px;position:relative}
.item-modal,.v132-reward-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.item-modal-box{width:360px;height:540px;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;background:#20170e;border:2px solid #956b32}
#itemModalIcon{height:70px;flex:0 0 auto}#itemModalName{height:35px;flex:0 0 auto}#itemModalStats{flex:1 1 auto;background:#090807;padding:10px;box-sizing:border-box}.item-modal-buttons{height:48px;flex:0 0 auto;margin-top:auto;display:flex;gap:8px}.item-modal-buttons button{flex:1}
.v132-reward-modal{z-index:20;background:rgba(0,0,0,.65)}.v132-reward-modal-inner{width:360px;max-height:540px;padding:16px;box-sizing:border-box;background:#21180f;border:2px solid #e6a93d;overflow-y:auto}.v132-reward-modal-inner h3{position:sticky;top:0}.v132-preview-list-scroll{max-height:280px;overflow-y:auto}.v132-reward-actions{position:sticky;bottom:0}.v132-reward-actions button{height:48px;width:100%}
</style></head><body><div id="game-stage"><div id="itemModal" class="item-modal"><div class="item-modal-box"><div id="itemModalIcon">◇</div><div id="itemModalName"></div><div id="itemModalStats"></div><div class="item-modal-buttons"><button id="v17342InventoryPotionUse">使用</button><button id="itemEquipButton" disabled>不可裝備</button><button>售出</button></div><button class="close-item-button">返回</button></div></div></div><div id="rewardLayer"></div><pre id="result"></pre>
<script>
window.inventorySlots=[{id:'sp10',type:'potion',name:'回復10%SP藥水',stats:{},reforgeSlots:0}];window.inventoryItems=[];window.characterEquipment={};
window.openItemModal=function(index){const item=inventorySlots[index];document.getElementById('itemModalName').textContent=item.name;document.getElementById('itemModalStats').innerHTML='<div>效果：<b>回復最大SP的10%</b></div><div>售價：25 金幣</div>';};
window.closeItemModal=function(){};
window.v132ShowRewardModal=function(markup){document.getElementById('rewardLayer').innerHTML='<div class="v132-reward-modal">'+markup+'</div>';};
window.v132CloseRewardModal=function(){};
</script><script src="js/equipment-progression.js"></script><script>
openItemModal(0);
const box=document.querySelector('#itemModal .item-modal-box'),stats=document.getElementById('itemModalStats'),buttons=document.querySelector('#itemModal .item-modal-buttons');
const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
const potion={box:rect(box),stats:rect(stats),buttons:rect(buttons),gap:rect(buttons).top-rect(stats).bottom,boxHeight:getComputedStyle(box).height,buttonMargin:getComputedStyle(buttons).marginTop};
v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>材料寶箱 開啟預覽</h3><div class="v132-preview-list-scroll">'+Array.from({length:8},(_,i)=>'<div style="height:70px">獎勵 '+i+'</div>').join('')+'</div><div class="v132-reward-actions"><button>關閉</button></div></div>');
const preview=document.querySelector('.v17346-preview-modal'),title=preview.querySelector('h3'),list=preview.querySelector('.v132-preview-list-scroll'),actions=preview.querySelector('.v132-reward-actions');
const previewShot={box:rect(preview),title:rect(title),list:rect(list),actions:rect(actions),overflow:getComputedStyle(preview).overflow,listOverflow:getComputedStyle(list).overflowY};
document.getElementById('result').textContent=JSON.stringify({potion,previewShot});
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);assert.ok(match,"result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.ok(data.potion.box.height<360,"potion detail must not retain the 540px equipment inspector height");
    assert.ok(data.potion.gap<24,"potion details must not leave a large blank spacer above actions");
    assert.equal(data.potion.buttonMargin,"0px");
    assert.equal(data.previewShot.overflow,"hidden","preview outer frame must clip its own content");
    assert.equal(data.previewShot.listOverflow,"auto","preview list must be the scroll owner");
    assert.ok(data.previewShot.title.bottom<=data.previewShot.list.top+1,"preview title must not overlap reward rows");
    assert.ok(data.previewShot.list.bottom<=data.previewShot.actions.top+1,"preview rows must not paint through the close action");
    assert.ok(data.previewShot.actions.bottom<=data.previewShot.box.bottom+1,"preview close action must remain inside the modal");
    console.log("Headless Chrome: potion detail collapses and chest preview no longer punches through");
}finally{try{fs.unlinkSync(fixture);}catch(_){}}
