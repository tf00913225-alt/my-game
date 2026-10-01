"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const read=file=>fs.readFileSync(file,"utf8");
const index=read("index.html");
const build=read("scripts/build-production.mjs");
const main=read("js/00-main.js");
const comparison=read("js/55-v173.51-inventory-qa.js");
const equipment=read("js/equipment-progression.js");
const inventoryCss=read("css/22-stage-v78-character-inventory-core.css")+read("css/24-stage-v85-inventory-inner-grid-scroll-root.css");
const legacyDetailCss=read("css/23-stage-v77-inventory-detail-ui.css");
const legacyRewardCss=read("css/33-v132-content-expansion.css");
const frameCss=read("css/49-v169-rpg-ui.css");
const compareCss=read("css/53-v173.51-qa.css");

// Formal entry and production bundle must ship every canonical owner.
assert.match(index,/id="inventoryGridScroll" data-scroll-owner="y"/);
assert.match(index,/id="itemModalStats"[\s\S]*?data-scroll-owner="y"/);
for(const owner of [
    "css/22-stage-v78-character-inventory-core.css",
    "css/24-stage-v85-inventory-inner-grid-scroll-root.css",
    "css/49-v169-rpg-ui.css",
    "css/53-v173.51-qa.css",
    "js/equipment-progression.js",
    "js/55-v173.51-inventory-qa.js"
]){
    assert.ok(build.includes('"'+owner+'"'),owner+" must be included by the production builder");
}

// One explicit lifecycle state owns the item frame; incidental DOM must not infer it.
assert.match(main,/const ITEM_MODAL_PRESENTATION_MODES = new Set/);
assert.match(main,/modal\.dataset\.presentationMode=normalized/);
assert.match(main,/setItemModalPresentationMode\(isEquipment\?"equipment":"compact"\)/);
assert.match(main,/classList[\s\S]*?remove\("show"\);[\s\S]*?setItemModalPresentationMode\("closed"\)/);
assert.match(comparison,/setItemModalPresentationMode\("comparison"\)/);
assert.match(comparison,/closeItemModal=function\(\)\{clearEquipmentComparison\(\)/);
assert.doesNotMatch(legacyDetailCss,/:has\(#v17342InventoryPotionUse\)|:has\(#itemEquipButton:disabled\)/);

// Replaced geometry is deleted rather than hidden behind another late override.
assert.doesNotMatch(legacyRewardCss,/v17346-shop-preview-modal|height:400px|min-height:400px|max-height:400px/);
assert.doesNotMatch(equipment,/v17346-potion-detail|v17346-shop-preview-modal\{[^}]*width:|v17346-shop-preview-art\{[^}]*width:/);
assert.doesNotMatch(compareCss,/v17351-equipment-comparison \.item-modal-box|v17351-locked-equipment \.item-modal-box/);
assert.match(frameCss,/#itemModal \.item-modal-box\{[^}]*height:auto !important;[^}]*max-height:min\(/);
assert.match(frameCss,/#itemModal #itemModalIcon\{[^}]*aspect-ratio:1 !important/);
assert.match(frameCss,/#itemModal #itemModalIcon img,[\s\S]*?object-fit:contain !important/);
assert.match(compareCss,/\.v17351-compare-art\{[^}]*aspect-ratio:1!important;[^}]*flex:0 1 auto!important/);
assert.match(compareCss,/@media \(max-width:374px\)\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
assert.match(inventoryCss,/\.inventory-grid-scroll\{[^}]*flex:1 1 auto[^}]*overflow-y:auto/);
assert.doesNotMatch(inventoryCss,/\.inventory-grid-scroll\{[^}]*touch-action:none/);

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=cp.spawnSync("which",[name],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    return "";
}

const chrome=findChrome();
if(!chrome){
    console.log("Responsive window owner checks passed; browser geometry is BLOCKED locally because Chrome is unavailable");
    process.exit(0);
}

const fixture=path.join(process.cwd(),".responsive-window-item-owner-convergence.html");
const fileUrl="file://"+fixture.replace(/\\/g,"/");
const longStats=Array.from({length:32},(_,index)=>'<div>超長裝備屬性名稱 '+index+'：<b>+'+(index+1)+'</b></div>').join("");
const inventoryItems=Array.from({length:102},(_,index)=>'<button class="inventory-item-classic"><span class="inventory-icon">◆</span><span class="inventory-quantity">'+(index+1000)+'</span></button>').join("");
const compareStats=Array.from({length:15},(_,index)=>'<div class="v17351-compare-stat"><span>超長比較屬性 '+index+'</span><b>+'+(index+1)+'</b></div>').join("");
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="css/00-main.css"><link rel="stylesheet" href="css/22-stage-v78-character-inventory-core.css"><link rel="stylesheet" href="css/23-stage-v77-inventory-detail-ui.css"><link rel="stylesheet" href="css/24-stage-v85-inventory-inner-grid-scroll-root.css"><link rel="stylesheet" href="css/33-v132-content-expansion.css"><link rel="stylesheet" href="css/38-v141-system-expansion.css"><link rel="stylesheet" href="css/49-v169-rpg-ui.css"><link rel="stylesheet" href="css/52-v173.50-inventory-qol.css"><link rel="stylesheet" href="css/53-v173.51-qa.css">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}#game-stage{position:absolute!important;left:0;top:0;width:420px!important;height:746.6667px!important;transform-origin:top left!important;overflow:hidden!important}#game-stage .content{height:100%!important}#itemModal{position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important;align-items:center!important;justify-content:center!important}.inventory-character-panel{height:180px}.inventory-bottom-actions{min-height:44px}.v132-reward-modal{display:flex!important}</style></head><body>
<div id="game-stage"><div id="app" class="on-inventory-page"><main class="content"><section id="inventoryPage"><div class="inventory-classic-shell"><header class="inventory-header"><div class="inventory-title-plate">背包</div></header><section class="inventory-character-panel"><div class="inventory-character-stage"></div></section><section class="inventory-right-panel"><div class="inventory-wallet-bar">999999 金幣</div><div class="inventory-category-tabs"><button>裝備</button><button>物品</button><button>材料</button><button>功能</button></div><div id="inventoryGridScroll" class="inventory-grid-scroll" data-scroll-owner="y"><div class="inventory-grid-classic">${inventoryItems}</div></div><div class="inventory-bottom-actions"><button>返回</button><button>整理</button></div></section></div></section></main></div>
<div id="itemModal" class="item-modal show item-modal-mode-compact" data-presentation-mode="compact"><div class="item-modal-box"><div id="itemModalIcon" class="item-modal-icon"><span class="v169-item-art v169-equipment-art"><img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='500'%3E%3Crect width='900' height='500' fill='gold'/%3E%3C/svg%3E"></span></div><div id="itemModalName" class="item-modal-name">極長名稱的千年玄鐵恢復藥水材料</div><div id="itemModalStats" class="item-stat-list" data-scroll-owner="y"><div>恢復最大生命值的 10%</div><div>數量：999999</div></div><div class="item-modal-buttons"><button id="v17342InventoryPotionUse">批量使用</button><button>出售</button></div><button class="close-item-button">返回</button></div></div></div>
<div id="v132RewardModal" class="v132-reward-modal show"><div class="v132-reward-modal-inner v17346-shop-preview-modal item-presentation-frame" data-presentation-mode="shop-preview"><h3>極長名稱的傳說古銅戰甲商品預覽</h3><div class="item-presentation-scroll" data-scroll-owner="y"><div class="v17346-shop-preview-art"><span class="v169-item-art v169-equipment-art"><img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='500'%3E%3Crect width='900' height='500' fill='purple'/%3E%3C/svg%3E"></span></div><div class="v17346-shop-preview-info"><span>衣服</span><strong>體質 +8888，防禦 +9999</strong></div><div class="v17346-shop-preview-price">999,999 金幣</div></div><div class="v132-reward-actions"><button>返回</button></div></div></div>
<pre id="result"></pre><script>(function(){
const scale=Math.min(innerWidth/420,innerHeight/746.6667),stage=document.getElementById('game-stage');stage.style.transform='scale('+scale+')';stage.style.left=Math.max(0,(innerWidth-420*scale)/2)+'px';
const q=s=>document.querySelector(s),r=e=>{const x=e.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}},style=e=>getComputedStyle(e),inside=(child,parent)=>child.left>=parent.left-1&&child.right<=parent.right+1&&child.top>=parent.top-1&&child.bottom<=parent.bottom+1;
const inventory=q('#inventoryPage'),grid=q('#inventoryGridScroll'),modal=q('#itemModal'),box=q('.item-modal-box'),stats=q('#itemModalStats'),actions=q('#itemModal .item-modal-buttons'),icon=q('#itemModalIcon'),img=q('#itemModalIcon img');
const inventoryShot={page:r(inventory),grid:r(grid),scrollHeight:grid.scrollHeight,clientHeight:grid.clientHeight,overflowY:style(grid).overflowY,pageOverflow:style(inventory).overflow};
const compact={box:r(box),stats:r(stats),actions:r(actions),icon:r(icon),img:r(img),font:parseFloat(style(q('#itemModalName')).fontSize),overflow:box.scrollWidth-box.clientWidth,actionsInside:inside(r(actions),r(box)),objectFit:style(img).objectFit};
modal.className='item-modal show item-modal-mode-equipment';modal.dataset.presentationMode='equipment';stats.innerHTML=${JSON.stringify(longStats)};actions.innerHTML='<button>穿戴</button><button>批量開啟</button><button>出售</button>';void box.offsetHeight;
const equipment={box:r(box),stats:r(stats),actions:r(actions),scrollHeight:stats.scrollHeight,clientHeight:stats.clientHeight,actionsInside:inside(r(actions),r(box)),overflow:box.scrollWidth-box.clientWidth};
modal.className='item-modal show item-modal-mode-comparison';modal.dataset.presentationMode='comparison';box.insertAdjacentHTML('afterbegin','<section class="v17351-equipment-compare"><header class="v17351-compare-header"><div><small>EQUIPMENT COMPARE</small><b>裝備比較</b><span>長屬性與大數量</span></div><button class="v17351-compare-back">返回</button></header><div class="v17351-compare-grid" data-scroll-owner="y"><article class="v17351-compare-pane selected"><em>背包装備</em><div class="v17351-compare-art"><img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'900\' height=\'500\'%3E%3C/svg%3E"></div><strong>極長名稱的背包装備</strong><div class="v17351-compare-stats">${compareStats}</div></article><article class="v17351-compare-pane current"><em>目前裝備</em><div class="v17351-compare-art"></div><strong>極長名稱的目前裝備</strong><div class="v17351-compare-stats">${compareStats}</div></article></div></section>');void box.offsetHeight;
const compareGrid=q('.v17351-compare-grid'),compareArt=q('.v17351-compare-art');const comparison={box:r(box),grid:r(compareGrid),art:r(compareArt),columns:style(compareGrid).gridTemplateColumns,scrollHeight:compareGrid.scrollHeight,clientHeight:compareGrid.clientHeight,actions:r(actions),actionsInside:inside(r(actions),r(box)),overflow:box.scrollWidth-box.clientWidth};
const shop=q('.v17346-shop-preview-modal'),shopScroll=q('.item-presentation-scroll'),shopArt=q('.v17346-shop-preview-art'),shopActions=q('.v132-reward-actions'),shopImg=q('.v17346-shop-preview-art img');const shopShot={modal:r(shop),scroll:r(shopScroll),art:r(shopArt),actions:r(shopActions),scrollHeight:shopScroll.scrollHeight,clientHeight:shopScroll.clientHeight,overflow:shop.scrollWidth-shop.clientWidth,actionsInside:inside(r(shopActions),r(shop)),objectFit:style(shopImg).objectFit};
q('#result').textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight},inventory:inventoryShot,compact,equipment,comparison,shop:shopShot});
})();</script></body></html>`;

fs.writeFileSync(fixture,html,"utf8");
try{
    const viewports=[[360,800],[360,640],[393,873],[393,660],[412,915],[412,680]];
    for(const [width,height] of viewports){
        const run=cp.spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size="+width+","+height,"--dump-dom",fileUrl],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
        assert.equal(run.status,0,run.stderr||"responsive window fixture failed");
        const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match,"browser geometry result missing for "+width+"x"+height);
        const data=JSON.parse(match[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"'));
        assert.equal(data.inventory.overflowY,"auto");
        assert.equal(data.inventory.pageOverflow,"hidden");
        assert.ok(data.inventory.scrollHeight>data.inventory.clientHeight,"inventory grid must really scroll");
        assert.ok(data.compact.box.height<data.equipment.box.height,"compact details must close around short content");
        assert.ok(data.compact.font>=13,"item names must keep readable text");
        assert.ok(Math.abs(data.compact.icon.width-data.compact.icon.height)<1,"item art frame must remain square");
        assert.equal(data.compact.objectFit,"contain");
        assert.ok(data.equipment.scrollHeight>data.equipment.clientHeight,"long equipment details must really scroll");
        assert.ok(data.compact.actionsInside&&data.equipment.actionsInside&&data.comparison.actionsInside,"item actions must stay inside the visible frame");
        assert.ok(Math.abs(data.comparison.art.width-data.comparison.art.height)<1,"comparison art must remain square");
        if(width<=374){ assert.ok(!data.comparison.columns.includes(" "),"360px comparison must stack into one column"); }
        assert.equal(data.shop.objectFit,"contain");
        assert.ok(Math.abs(data.shop.art.width-data.shop.art.height)<1,"shop art must remain square");
        assert.ok(data.shop.actionsInside,"shop return action must stay inside the visible frame");
        for(const overflow of [data.compact.overflow,data.equipment.overflow,data.comparison.overflow,data.shop.overflow]){
            assert.ok(overflow<=1,"item presentations must not overflow horizontally at "+width+"x"+height);
        }
    }
    console.log("Responsive window browser geometry passed at 360/393/412 normal and short heights");
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}
