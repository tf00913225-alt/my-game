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
  "css/00-main.css","css/02-stage-v3-layout-fix.css","css/03-stage-v4-viewport-lock.css","css/22-stage-v78-character-inventory-core.css","css/23-stage-v77-inventory-detail-ui.css",
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

const os=require("node:os");
const net=require("node:net");

function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
async function reservePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once("error",reject);
    server.listen(0,"127.0.0.1",()=>{
      const address=server.address();
      const port=typeof address==="object"&&address?address.port:null;
      server.close(error=>error?reject(error):resolve(port));
    });
  });
}
function openCdp(webSocketDebuggerUrl){
  const socket=new WebSocket(webSocketDebuggerUrl);
  const pending=new Map();
  let nextId=1;
  const ready=new Promise((resolve,reject)=>{
    socket.addEventListener("open",resolve,{once:true});
    socket.addEventListener("error",reject,{once:true});
  });
  socket.addEventListener("message",event=>{
    const message=JSON.parse(String(event.data));
    if(!message.id||!pending.has(message.id)) return;
    const request=pending.get(message.id);
    pending.delete(message.id);
    if(message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    ready,
    send:async(method,params={})=>{
      await ready;
      const id=nextId++;
      return new Promise((resolve,reject)=>{
        pending.set(id,{resolve,reject});
        socket.send(JSON.stringify({id,method,params}));
      });
    },
    close:()=>socket.close()
  };
}
async function waitFor(client,expression,label,timeout=8000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    const response=await client.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(response.result&&response.result.value) return response.result.value;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function launchBrowser(){
  const port=await reservePort();
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),"premium-functional-ui-qa-"));
  const child=cp.spawn(chrome,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
    "--allow-file-access-from-files","--force-device-scale-factor=1","--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"
  ],{stdio:["ignore","ignore","pipe"]});
  let stderr="";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data",chunk=>{ stderr+=chunk; });
  let target=null;
  for(let i=0;i<300&&!target;i++){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`);
      if(response.ok){
        const list=await response.json();
        target=list.find(item=>item.type==="page"&&item.webSocketDebuggerUrl)||null;
      }
    }catch(_){ }
    if(child.exitCode!==null) break; if(!target) await sleep(100);
  }
  if(!target){ if(child.exitCode===null) child.kill("SIGKILL"); throw new Error(`Chrome DevTools page target unavailable (exit=${child.exitCode}): ${stderr}`); }
  const client=openCdp(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  return {
    client,
    close:()=>{
      try{client.close();}catch(_){ }
      try{child.kill("SIGKILL");}catch(_){ }
      try{fs.rmSync(profile,{recursive:true,force:true});}catch(_){ }
    }
  };
}
function fixtureUrl(file){ return "file://"+file.replace(/\\/g,"/"); }
async function configureViewport(client,width,height){
  await client.send("Emulation.setDeviceMetricsOverride",{
    width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,
    screenOrientation:{type:"portraitPrimary",angle:0}
  });
  await client.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
}
async function navigate(client,url){
  await client.send("Page.navigate",{url});
  await waitFor(client,"document.readyState==='complete'","fixture load");
  await sleep(120);
}
async function evaluate(client,expression){
  const response=await client.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails) throw new Error(response.exceptionDetails.text||"Runtime evaluation failed");
  return response.result?response.result.value:undefined;
}
async function capture(client,file){
  const result=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
  fs.writeFileSync(file,Buffer.from(result.data,"base64"));
}
async function hitClick(client,selector){
  const hit=await evaluate(client,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)return null;const r=el.getBoundingClientRect();const x=r.left+r.width/2;const y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return {x,y,hit:!!top&&(top===el||el.contains(top)),w:r.width,h:r.height};})()`);
  assert.ok(hit,`missing interactive target ${selector}`);
  assert.equal(hit.hit,true,`${selector} is covered at its hit point`);
  await client.send("Input.dispatchMouseEvent",{type:"mousePressed",x:hit.x,y:hit.y,button:"left",clickCount:1});
  await client.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:hit.x,y:hit.y,button:"left",clickCount:1});
  await sleep(40);
  const clicked=await evaluate(client,`document.querySelector(${JSON.stringify(selector)}).dataset.qaClicked==='1'`);
  assert.equal(clicked,true,`${selector} did not receive click interaction`);
  return hit;
}

async function verifySurface(client,width,height,surface,markup){
  const fixture=path.join(root,`.premium-functional-${width}x${height}-${surface}.html`);
  const wide=!["shop","synthesis","quest","achievement","info"].includes(surface);
  let classes="home-feature-modal show";
  if(surface==="shop") classes+=" v131-shop-open";
  if(surface==="synthesis") classes+=" v141-synthesis-modal";
  if(surface==="quest") classes+=" quest-mode";
  let surfaceMarkup=markup;
  if(surface==="character"){
    surfaceMarkup+=`<section id="skillPage"><button class="skill-action-card qa-major qa-skill-action">技能升級測試</button></section>`;
  }
  const runtime='<script src="js/00-main.js"></script>'+(wide?'<script src="js/19-stage-v78-character-inventory-runtime.js"></script>':'');
  const page=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${links}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050403}#game-viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}#game-stage{position:relative;width:1080px;height:1920px;flex:0 0 1080px;transform-origin:center center;overflow:hidden}#game-content{position:absolute;left:0;top:0;width:420px;height:746.6667px;transform:scale(2.5714285714);transform-origin:top left}#homeFeatureModal{display:flex!important;position:absolute!important;inset:0!important;width:420px!important;height:746.6667px!important}.qa-test-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style></head><body><div id="game-viewport"><div id="game-stage"><div id="app"><div id="game-content"><div id="homeFeatureModal" class="${classes}"><div class="home-feature-modal-box ${wide?"wide":""}"><div class="home-feature-modal-title"><span class="qa-test-title">功能型 UI・${surface}</span><button class="home-feature-close-btn qa-major">返回</button></div><div id="homeFeatureModalBody">${surfaceMarkup}</div></div></div></div></div></div></div>${runtime}<script>document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{button.dataset.qaClicked='1';}));</script></body></html>`;
  fs.writeFileSync(fixture,page,"utf8");
  try{
    await configureViewport(client,width,height);
    await navigate(client,fixtureUrl(fixture));
    if(wide){
      await evaluate(client,"window.v78ApplyCharacterInventoryLayout&&window.v78ApplyCharacterInventoryLayout()");
      await evaluate(client,"new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    }
    const data=await evaluate(client,`(()=>{const rect=o=>o?(()=>{const r=o.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})():null;const box=document.querySelector('.home-feature-modal-box');const root=document.getElementById('characterTabContent');const parent=box&&box.parentElement;const majors=[...document.querySelectorAll('.qa-major')];const commerce=[...document.querySelectorAll('.qa-commerce')];const minCss=els=>els.length?Math.min(...els.map(el=>parseFloat(getComputedStyle(el).minHeight)||parseFloat(getComputedStyle(el).height)||0)):999;const overflow=[...document.querySelectorAll('#homeFeatureModalBody,#characterTabContent,.quest-tab-body,.v141-synthesis-body')].some(el=>el.scrollWidth>el.clientWidth+1);const c=box?getComputedStyle(box):null;const rc=root?getComputedStyle(root):null;return {viewport:[innerWidth,innerHeight],surface:${JSON.stringify(surface)},docOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,box:rect(box),parent:rect(parent),root:rect(root),rootScroll:root?{scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,overflowY:rc.overflowY,overflowX:rc.overflowX}:null,contentOverflow:overflow,majorMin:minCss(majors),commerceMin:minCss(commerce),inline:box?{width:box.style.getPropertyValue('width'),height:box.style.getPropertyValue('height'),maxWidth:box.style.getPropertyValue('max-width'),maxHeight:box.style.getPropertyValue('max-height'),overflow:box.style.getPropertyValue('overflow')}:null,computed:c?{width:c.width,height:c.height,maxWidth:c.maxWidth,maxHeight:c.maxHeight,overflow:c.overflow}:null};})()`);
    assert.deepEqual(data.viewport,[width,height],`${surface} viewport metrics mismatch`);
    assert.equal(data.docOverflow,false,`${width}x${height} ${surface} document overflow`);
    assert.equal(data.contentOverflow,false,`${width}x${height} ${surface} horizontal content overflow`);
    assert.ok(data.box&&data.box.left>=-1&&data.box.top>=-1&&data.box.right<=width+1&&data.box.bottom<=height+1,`${width}x${height} ${surface} panel clipped: ${JSON.stringify(data.box)}`);
    assert.ok(data.majorMin>=38,`${surface} major logical hit area ${data.majorMin}`);
    assert.ok(data.commerceMin>=42,`${surface} commerce hit area ${data.commerceMin}`);
    const interactions={};
    interactions.back=await hitClick(client,".home-feature-close-btn");
    if(surface==="character"){
      assert.ok(data.rootScroll&&["scroll","auto"].includes(data.rootScroll.overflowY),`character scroll owner invalid: ${JSON.stringify(data.rootScroll)}`);
      assert.equal(data.inline.width,"calc(100% - 8px)","formal character runtime did not own width inline");
      assert.equal(data.inline.height,"calc(100% - 8px)","formal character runtime did not own height inline");
      interactions.exp=await hitClick(client,".v131-exp-preview-btn");
      interactions.status=await hitClick(client,".status-btn");
      interactions.confirm=await hitClick(client,"#confirmStatusButton");
      interactions.skill=await hitClick(client,".qa-skill-action");
    }
    const shot=path.join(out,`${width}x${height}-${surface}.png`);
    await capture(client,shot);
    evidence.push({...data,interactions});
  }finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
  }
}

async function verifyDialog(client,width,height){
  const dialog=path.join(root,`.premium-functional-${width}x${height}-dialog.html`);
  fs.writeFileSync(dialog,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${links}</head><body><div id="v169RpgDialogLayer" class="v169-rpg-dialog-layer show"><section class="v169-rpg-dialog" data-kind="confirm" data-tone="danger"><div class="v169-rpg-dialog-crest">⚠</div><h2>刪除角色</h2><div class="v169-rpg-dialog-message">這是不可逆操作。確認長文字仍可閱讀、取消與危險按鈕不被裝飾遮住。</div><div class="v169-rpg-dialog-actions"><button class="v169-rpg-dialog-button secondary">返回</button><button class="v169-rpg-dialog-button primary danger">確認刪除</button></div></section></div><script>document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{button.dataset.qaClicked='1';}));</script></body></html>`,"utf8");
  try{
    await configureViewport(client,width,height);
    await navigate(client,fixtureUrl(dialog));
    const geometry=await evaluate(client,"(()=>{const el=document.querySelector('.v169-rpg-dialog');const r=el.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})()");
    assert.deepEqual(geometry.viewport,[width,height],"dialog viewport mismatch");
    assert.ok(geometry.left>=-1&&geometry.top>=-1&&geometry.right<=width+1&&geometry.bottom<=height+1,`dialog clipped ${JSON.stringify(geometry)}`);
    await hitClick(client,".v169-rpg-dialog-button.secondary");
    await hitClick(client,".v169-rpg-dialog-button.danger");
    await capture(client,path.join(out,`${width}x${height}-danger-dialog.png`));
  }finally{
    try{fs.unlinkSync(dialog);}catch(_){ }
  }
}

(async()=>{
  const browser=await launchBrowser();
  try{
    for(const [width,height] of viewports){
      for(const [surface,markup] of Object.entries(surfaces)) await verifySurface(browser.client,width,height,surface,markup);
      await verifyDialog(browser.client,width,height);
    }
    fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({viewports,evidence},null,2)+"\n");
    console.log(`✓ Premium functional responsive browser QA passed: ${evidence.length} surface/viewport checks`);
  }finally{
    browser.close();
  }
})().catch(error=>{ console.error(error&&error.stack||error); process.exit(1); });
