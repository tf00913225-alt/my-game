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
// Execute the actual lifecycle owner, with only its data dependencies stubbed.
const mainSource=fs.readFileSync("js/00-main.js","utf8");
const ownerStart=mainSource.indexOf("const ITEM_MODAL_PRESENTATION_MODES = new Set([");
const ownerEnd=mainSource.indexOf("function openEquippedItem(",ownerStart);
assert.ok(ownerStart>=0&&ownerEnd>ownerStart,"formal item lifecycle owner boundaries missing");
const itemOwner=mainSource.slice(ownerStart,ownerEnd).replace(/<\/script/gi,"<\\/script");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css"><link rel="stylesheet" href="css/49-v169-rpg-ui.css"><style>
html,body{margin:0;width:420px;height:747px;background:#000;overflow:hidden}#game-ui{width:420px!important;height:747px!important;position:relative!important;left:0!important;top:0!important;transform:none!important}
.item-modal,.v132-reward-modal{position:absolute!important;inset:0!important;display:flex;align-items:center;justify-content:center}
.v132-reward-modal{z-index:20;background:rgba(0,0,0,.65)}.v132-reward-modal-inner{width:360px;max-height:540px;padding:16px;box-sizing:border-box;background:#21180f;border:2px solid #e6a93d;overflow-y:auto}.v132-reward-modal-inner h3{position:sticky;top:0}.v132-preview-list-scroll{max-height:280px;overflow-y:auto}.v132-reward-actions{position:sticky;bottom:0}.v132-reward-actions button{height:48px;width:100%}
</style></head><body><div id="game-ui"><div id="itemModal" class="item-modal"><div class="item-modal-box"><div id="itemModalIcon">◇</div><div id="itemModalName"></div><div id="itemModalStats"></div><div class="item-modal-buttons"><button id="v17342InventoryPotionUse">使用</button><button id="itemEquipButton" disabled>不可裝備</button><button>售出</button></div><button class="close-item-button">返回</button></div></div></div><div id="rewardLayer"></div><pre id="result"></pre>
<script>
window.inventorySlots=[{id:'sp10',type:'potion',name:'回復10%SP藥水',icon:'◇',stats:{},reforgeSlots:0},{id:'qa-equipment',type:'armor',name:'裝備長內容測試',icon:'◇',stats:{attack:10},reforgeSlots:0}];window.inventoryItems=[];window.characterEquipment={};
window.__accountKeys=[];window.FourSymbolsAccountSave={accountKey:function(suffix){window.__accountKeys.push(suffix);return 'four_symbols_account:fixture-uid:'+suffix;}};
function $(id){return document.getElementById(id);}
function getPotionEffectDescription(){return '回復最大SP的10%';}
function getStatText(){return Array.from({length:28},(_,i)=>'<div>長屬性 '+i+'：+100</div>').join('');}
var selectedInventorySlot=null;
${itemOwner}
window.closeItemModal=function(){};
window.v132ShowRewardModal=function(markup){document.getElementById('rewardLayer').innerHTML='<div class="v132-reward-modal">'+markup+'</div>';};
window.v132CloseRewardModal=function(){};
</script><script src="js/equipment-progression.js"></script><script>
openItemModal(0);
const box=document.querySelector('#itemModal .item-modal-box'),stats=document.getElementById('itemModalStats'),buttons=document.querySelector('#itemModal .item-modal-buttons');
const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
const potion={box:rect(box),stats:rect(stats),buttons:rect(buttons),gap:rect(buttons).top-rect(stats).bottom,mode:document.getElementById('itemModal').dataset.presentationMode,statsOverflow:getComputedStyle(stats).overflowY,boxHeight:getComputedStyle(box).height,buttonMargin:getComputedStyle(buttons).marginTop};
openItemModal(1);
const equipment={box:rect(box),mode:document.getElementById('itemModal').dataset.presentationMode,statsOverflow:getComputedStyle(stats).overflowY,scrollHeight:stats.scrollHeight,clientHeight:stats.clientHeight};
v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>材料寶箱 開啟預覽</h3><div class="v132-preview-list-scroll">'+Array.from({length:8},(_,i)=>'<div style="height:70px">獎勵 '+i+'</div>').join('')+'</div><div class="v132-reward-actions"><button>關閉</button></div></div>');
const preview=document.querySelector('.v17346-preview-modal'),title=preview.querySelector('h3'),list=preview.querySelector('.v132-preview-list-scroll'),actions=preview.querySelector('.v132-reward-actions');
const previewShot={box:rect(preview),title:rect(title),list:rect(list),actions:rect(actions),overflow:getComputedStyle(preview).overflow,listOverflow:getComputedStyle(list).overflowY};
document.getElementById('result').textContent=JSON.stringify({potion,equipment,previewShot,accountKeys:window.__accountKeys});
</script></body></html>`;
fs.writeFileSync(fixture,html,"utf8");
try{
    const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=420,747","--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
    assert.equal(run.status,0,run.stderr||"Chrome failed");
    const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);assert.ok(match,"result missing");
    const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
    assert.equal(data.potion.mode,"compact","formal item lifecycle must select compact potion mode");
    assert.equal(data.potion.statsOverflow,"auto","formal item stats must own vertical scrolling");
    // Formal responsive QA checks natural contraction relative to long equipment
    // content, rather than the retired fixed 360px potion budget.
    assert.equal(data.equipment.mode,"equipment");
    assert.equal(data.equipment.statsOverflow,"auto");
    assert.ok(data.equipment.scrollHeight>data.equipment.clientHeight,"long equipment stats must actually overflow internally");
    assert.ok(data.equipment.box.height>data.potion.box.height+20,"short potion content must contract naturally against long equipment");
    assert.ok(data.potion.box.height<540,"short potion must stay below the Medium Modal ceiling");
    assert.ok(data.potion.box.left>=0&&data.potion.box.right<=420&&data.potion.box.top>=0&&data.potion.box.bottom<=747,"potion frame must stay inside the logical viewport");
    assert.deepEqual(data.accountKeys,["equipment-shop-daily"],"equipment browser fixture must honor the account-scoped storage dependency");
    assert.ok(data.potion.gap<24,"potion details must not leave a large blank spacer above actions");
    assert.equal(data.potion.buttonMargin,"0px");
    assert.equal(data.previewShot.overflow,"hidden","preview outer frame must clip its own content");
    assert.equal(data.previewShot.listOverflow,"auto","preview list must be the scroll owner");
    assert.ok(data.previewShot.title.bottom<=data.previewShot.list.top+1,"preview title must not overlap reward rows");
    assert.ok(data.previewShot.list.bottom<=data.previewShot.actions.top+1,"preview rows must not paint through the close action");
    assert.ok(data.previewShot.actions.bottom<=data.previewShot.box.bottom+1,"preview close action must remain inside the modal");
    console.log("Headless Chrome: potion detail collapses and chest preview no longer punches through");
}finally{try{fs.unlinkSync(fixture);}catch(_){}}
