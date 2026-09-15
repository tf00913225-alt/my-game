"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const root=process.cwd();
const out=path.join(root,"artifacts/browser-qa/premium-functional-ui");
fs.mkdirSync(out,{recursive:true});

function findChrome(){
  for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const result=cp.spawnSync("which",[name],{encoding:"utf8"});
    if(result.status===0&&result.stdout.trim()) return result.stdout.trim();
  }
  return "";
}
const chrome=findChrome();
assert.ok(chrome,"Chrome is required for premium functional responsive QA");

const styles=[
  "css/00-main.css","css/22-stage-v78-character-inventory-core.css","css/23-stage-v77-inventory-detail-ui.css",
  "css/25-stage-v90-quest-interface-core.css","css/31-v131-fix-batch.css","css/37-v139-rested-experience.css",
  "css/38-v141-system-expansion.css","css/42-v146-system-polish.css","css/49-v169-rpg-ui.css",
  "css/53-v173.51-qa.css","css/55-team-relic-system.css"
];
const links=styles.map(file=>`<link rel="stylesheet" href="${file}">`).join("");
const cells=Array.from({length:18},(_,i)=>`<div class="inventory-item inventory-item-classic ${i<8?"has-item":"empty"}"><div class="inventory-icon">${i<8?"◇":"·"}</div></div>`).join("");
const questCards=Array.from({length:8},(_,i)=>`<article class="quest-card"><div class="quest-card-head"><b class="quest-card-name">漫長任務名稱 ${i+1}</b><span class="quest-status ${i<2?"ready":""}">${i<2?"可領取":"進行中"}</span></div><p class="quest-card-desc">完成指定目標並確認獎勵資訊不會因長中文而裁切。</p><div class="quest-progress-line"><span>進度</span><strong>${i+2} / 10</strong></div><div class="quest-progress-track"><div class="quest-progress-fill" style="width:${(i+2)*10}%"></div></div><div class="quest-card-foot"><span class="quest-reward"><b class="quest-reward-label">獎勵</b> 金幣 10,000</span><button class="quest-claim-btn qa-major" ${i<2?"":"disabled"}>領取</button></div></article>`).join("");
const achievementCards=Array.from({length:7},(_,i)=>`<article class="v17351-achievement-card ${i<2?"ready":i===6?"claimed":"locked"}"><div class="v17351-achievement-copy"><b>長成就名稱 ${i+1}</b><span>完成指定進度，保留正式領取狀態與說明。</span><small>${i+1}/10・獎勵 5,000 金幣</small></div><button class="qa-major">${i<2?"領取":i===6?"已領取":"未達成"}</button></article>`).join("");

const surfaces={
  character:`<div id="characterTabContent"><section id="homeExpPoolCard"><div class="exp-pool-hero"><div class="exp-pool-kicker">SHARED EXPERIENCE</div><div class="exp-pool-title">共用經驗池</div><div class="exp-pool-total"><b class="exp-pool-value">123,456</b></div><p class="exp-pool-caption">目前角色 EXP 8,900 / 下一級 10,000</p></div><div id="expDistributeList"><div class="v131-exp-row"><div class="v131-exp-name">極長角色名稱測試</div><div class="v131-exp-level">Lv.32 → Lv.33</div><button class="v131-exp-preview-btn qa-major">分配經驗 1,100</button></div></div><section id="statusPage"><div class="status-points-line">可用屬性點：<b id="attributePoints">12</b></div>${["攻擊","智力","體質","能量","精神","敏捷"].map(x=>`<div class="status-row"><span>${x}</span><button class="status-btn qa-major">−</button><span class="status-number">99 + 0</span><button class="status-btn qa-major">＋</button></div>`).join("")}<button id="confirmStatusButton" class="status-confirm qa-major">確認配點</button></section></div>`,
  inventory:`<div id="characterTabContent"><div id="inventoryPage" class="page inventory-page-classic"><section class="inventory-classic-shell"><section class="inventory-character-panel"><div class="inventory-character-switch"><button class="inventory-character-arrow qa-major">‹</button><div class="inventory-character-name"><span>極長角色名稱測試</span><small class="inventory-character-level">Lv.99</small></div><button class="inventory-character-arrow qa-major">›</button></div></section><section class="inventory-right-panel"><div class="inventory-stats-panel"><div class="inventory-stat-primary"><span>HP</span><b>123456 / 123456</b></div></div><div class="inventory-grid-scroll"><div id="inventoryGrid" class="inventory-grid inventory-grid-classic">${cells}</div></div><div class="v141-inventory-pager"><button class="qa-major">←</button><span>1 / 7</span><button class="qa-major">→</button></div></section></section></div></div>`,
  shop:`<div class="v17345-shop-shell"><div class="v17345-shop-tabs"><button class="active qa-major">補品</button><button class="qa-major">裝備</button></div><div class="shop-potion-interface"><div class="shop-potion-list">${Array.from({length:6},(_,i)=>`<article class="shop-potion-card"><div class="shop-potion-card-head"><b class="shop-potion-name">高級恢復藥 ${i+1}</b><span class="shop-potion-stock">持有 999</span></div><p class="shop-potion-effect">恢復大量生命並測試長說明文字。</p><div class="shop-potion-purchase-row"><label>數量</label><input class="shop-potion-quantity" value="99"><span class="v146-shop-total">999,999 金幣</span><button class="shop-potion-buy qa-commerce">購買</button></div></article>`).join("")}</div></div></div>`,
  synthesis:`<div class="v141-synthesis"><div class="v141-synthesis-wallet"><span>持有金幣</span><b>9,999,999</b></div><div class="v141-synthesis-tabs"><button class="active qa-major">裝備冶煉</button><button class="qa-major">符咒合成</button><button class="qa-major">碎片合成</button></div><div class="v141-synthesis-body"><article class="v141-synthesis-card"><h3>寒泉長刀・冶煉</h3><div class="v141-material-lines"><span>圖紙 <b>50 / 100</b></span><span class="lack">寒泉礦 <b>30 / 100</b></span><span>原裝備 <b>1 / 1</b></span><span>金幣 <b>99,999 / 20,000</b></span></div><div class="v141-reforge-current">目前詞條：攻擊 +12、敏捷 +8</div><button class="v141-synthesis-primary qa-major" disabled>材料不足</button></article></div></div>`,
  quest:`<div class="quest-interface"><div class="quest-tabs"><button class="quest-tab active qa-major">每日任務</button><button class="quest-tab qa-major">委託任務</button></div><div class="quest-tab-body"><div class="quest-list">${questCards}</div></div><div class="quest-completion-panel"><div class="quest-completion-head"><span>完成度</span><strong>60%</strong></div><div class="quest-completion-track"><div class="quest-completion-fill" style="width:60%"></div></div></div></div>`,
  achievement:`<div class="v17351-achievement-shell"><div class="v17351-achievement-toolbar"><span>已完成 2 / 30</span><button class="v17351-achievement-claim-all qa-major">全部領取</button></div><div class="v17351-achievement-list">${achievementCards}</div><div class="v17351-achievement-pager"><button class="qa-major">‹</button><b>1 / 5</b><button class="qa-major">›</button></div></div>`,
  info:`${Array.from({length:18},(_,i)=>`<div class="home-feature-row"><span>${i<3?"極長怪物名稱圖鑑項目":"怪物 "+(i+1)}<br><span style="font-size:11px;color:#b3a58c;">已發現・區域資料</span></span><span>擊殺 ${i*12}</span></div>`).join("")}`
};

const viewports=[[360,800],[390,844],[412,915]];
const evidence=[];

function runChrome(args,label){
  const result=cp.spawnSync(chrome,args,{encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr||`${label} failed`);
  return result;
}

for(const [width,height] of viewports){
  for(const [surface,markup] of Object.entries(surfaces)){
    const fixture=path.join(root,`.premium-functional-${surface}.html`);
    const wide=["shop","synthesis","quest","achievement","info"].includes(surface)?"":"wide";
    let classes="home-feature-modal show";
    if(surface==="shop") classes+=" v131-shop-open";
    if(surface==="synthesis") classes+=" v141-synthesis-modal";
    if(surface==="quest") classes+=" quest-mode";
    const surfaceLiteral=JSON.stringify(surface);
    const page=`<!doctype html><html><head><meta charset="utf-8">${links}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050403}#game-viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}#game-stage{position:relative;width:1080px;height:1920px;flex:0 0 1080px;transform-origin:center center;overflow:hidden}#game-content{position:absolute;left:0;top:0;width:420px;height:746.6667px;transform:scale(2.5714285714);transform-origin:top left}#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important}.qa-test-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style></head><body><div id="game-viewport"><div id="game-stage"><div id="app"><div id="game-content"><div id="homeFeatureModal" class="${classes}"><div class="home-feature-modal-box ${wide}"><div class="home-feature-modal-title"><span class="qa-test-title">功能型 UI・${surface}</span><button class="home-feature-close-btn qa-major">返回</button></div><div id="homeFeatureModalBody">${markup}</div></div></div></div></div></div></div><pre id="qa-result"></pre><script>(function(){const surfaceName=${surfaceLiteral};const stage=document.getElementById('game-stage');stage.style.transform='scale('+Math.min(innerWidth/1080,innerHeight/1920)+')';const box=document.querySelector('.home-feature-modal-box');const br=box.getBoundingClientRect();const majors=[...document.querySelectorAll('.qa-major')];const commerce=[...document.querySelectorAll('.qa-commerce')];const minCss=els=>els.length?Math.min(...els.map(el=>parseFloat(getComputedStyle(el).minHeight)||parseFloat(getComputedStyle(el).height)||0)):999;const overflow=[...document.querySelectorAll('#homeFeatureModalBody,#characterTabContent,.quest-tab-body,.v141-synthesis-body')].some(el=>el.scrollWidth>el.clientWidth+1);const result={viewport:[innerWidth,innerHeight],surface:surfaceName,docOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,box:{left:br.left,top:br.top,right:br.right,bottom:br.bottom},contentOverflow:overflow,majorMin:minCss(majors),commerceMin:minCss(commerce)};document.getElementById('qa-result').textContent=JSON.stringify(result);})();</script></body></html>`;
    fs.writeFileSync(fixture,page,"utf8");
    try{
      const url="file://"+fixture.replace(/\\/g,"/");
      const shot=path.join(out,`${width}x${height}-${surface}.png`);
      runChrome(["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,`--screenshot=${shot}`,url],`screenshot ${surface}`);
      const dom=runChrome(["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,"--dump-dom",url],`dump ${surface}`);
      const match=dom.stdout.match(/<pre id="qa-result">([^<]+)<\/pre>/);
      assert.ok(match,`missing QA result ${surface}`);
      const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&"));
      assert.equal(data.docOverflow,false,`${width}x${height} ${surface} document overflow`);
      assert.equal(data.contentOverflow,false,`${width}x${height} ${surface} horizontal content overflow`);
      assert.ok(data.box.left>=-1&&data.box.top>=-1&&data.box.right<=width+1&&data.box.bottom<=height+1,`${width}x${height} ${surface} panel clipped`);
      assert.ok(data.majorMin>=44,`${surface} major hit area ${data.majorMin}`);
      assert.ok(data.commerceMin>=42,`${surface} commerce hit area ${data.commerceMin}`);
      evidence.push(data);
    }finally{
      try{fs.unlinkSync(fixture);}catch(_){ }
    }
  }
}

const dialog=path.join(root,".premium-functional-dialog.html");
fs.writeFileSync(dialog,`<!doctype html><html><head>${links}</head><body><div id="v169RpgDialogLayer" class="v169-rpg-dialog-layer show"><section class="v169-rpg-dialog" data-kind="confirm" data-tone="danger"><div class="v169-rpg-dialog-crest">⚠</div><h2>刪除角色</h2><div class="v169-rpg-dialog-message">這是不可逆操作。確認長文字仍可閱讀、取消與危險按鈕不被裝飾遮住。</div><div class="v169-rpg-dialog-actions"><button class="v169-rpg-dialog-button secondary">返回</button><button class="v169-rpg-dialog-button primary danger">確認刪除</button></div></section></div></body></html>`,"utf8");
try{
  for(const [width,height] of viewports){
    const url="file://"+dialog.replace(/\\/g,"/");
    const shot=path.join(out,`${width}x${height}-danger-dialog.png`);
    runChrome(["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${width},${height}`,`--screenshot=${shot}`,url],"dialog screenshot");
  }
}finally{
  try{fs.unlinkSync(dialog);}catch(_){ }
}

fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({viewports,evidence},null,2)+"\n");
console.log(`✓ Premium functional responsive browser QA passed: ${evidence.length} surface/viewport checks`);
