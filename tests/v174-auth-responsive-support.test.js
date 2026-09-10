"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const authUi=read("js/firebase/firebase-auth-ui.js");
const support=read("js/startup/support-contact.js");
const main=read("js/00-main.js");
const service=read("js/16-stage-v54-main-city-runtime.js");
const build=read("scripts/build-production.mjs");

assert.match(authUi,/id="firebaseSupportButton"[^>]*>聯絡客服</);
assert.match(authUi,/firebaseSupportButton[\s\S]*FourSymbolsSupport\.show\(\)/);
assert.match(authUi,/const host=document\.body/,
    "auth UI must mount outside the not-yet-scaled game stage");
assert.match(main,/id="systemSupportEmailButton"[\s\S]*FourSymbolsSupport\.show\(\)[\s\S]*>查看信箱</);
assert.match(main,/<strong>客服信箱<\/strong>/);
assert.match(service,/formalSupportEmail=String\(window\.FourSymbolsSupport/);
assert.match(service,/config\.supportEmail=formalSupportEmail/);
assert.match(service,/supportEmail\.textContent=configuredEmail/);
assert.doesNotMatch(service,/客服 Email：[\s\S]{0,180}尚未設定/);
assert.match(support,/const EMAIL="tf00913225@gmail\.com"/);

const bootScripts=build.slice(build.indexOf("const bootScripts="),build.indexOf("const appScripts="));
assert.ok(bootScripts.indexOf("js/startup/support-contact.js")>=0);
assert.ok(bootScripts.indexOf("js/startup/support-contact.js")<bootScripts.indexOf("js/52-v173.20-startup-loader.js"),
    "support owner must exist before Firebase account UI starts");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    return "";
}

function decode(value){
    return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

function within(rect,width,height){
    return rect.left>=-1&&rect.top>=-1&&rect.right<=width+1&&rect.bottom<=height+1;
}

const fixture=path.join(ROOT,".auth-responsive-support-browser.html");
const cssHref="file://"+path.join(ROOT,"css/firebase-auth.css").replace(/\\/g,"/");
const supportSrc="file://"+path.join(ROOT,"js/startup/support-contact.js").replace(/\\/g,"/");
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="${cssHref}">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#game-stage{position:fixed;left:50%;top:50%;width:1080px;height:1920px;background:#321;}</style>
</head><body><div id="game-stage"></div>
<section id="firebaseAuthOverlay" class="firebase-auth-overlay show" aria-hidden="false">
 <div class="firebase-auth-dialog" role="dialog" aria-modal="true">
  <div class="firebase-auth-eyebrow">FOUR SYMBOLS ACCOUNT</div>
  <h2 class="firebase-auth-title">帳號與角色</h2>
  <p class="firebase-auth-subtitle">先確認 Firebase UID，再讀取此帳號的角色資料。</p>
  <div class="firebase-auth-status">請先登入、註冊或使用訪客開始遊戲。沒有 UID 時不能建立角色。</div>
  <div class="firebase-auth-actions"><button class="firebase-auth-button">Google 登入</button><button class="firebase-auth-button secondary">訪客開始遊戲</button></div>
  <div class="firebase-auth-divider">或使用 Email</div>
  <div class="firebase-auth-field"><label>Email</label><input type="email"></div>
  <div class="firebase-auth-field"><label>密碼</label><input type="password"></div>
  <div class="firebase-auth-actions"><button class="firebase-auth-button">Email 登入</button><button class="firebase-auth-button secondary">建立 Email 帳號</button></div>
  <p class="firebase-auth-note">訪客仍會透過 Firebase Anonymous Auth 取得專屬 UID。</p>
  <button id="firebaseSupportButton" class="firebase-auth-button firebase-auth-support-button">聯絡客服</button>
 </div>
</section><pre id="result"></pre>
<script src="${supportSrc}"></script><script>
setTimeout(function(){
 const overlay=document.getElementById('firebaseAuthOverlay');
 const dialog=overlay.querySelector('.firebase-auth-dialog');
 const rect=function(el){const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const auth={parent:overlay.parentElement.tagName,position:getComputedStyle(overlay).position,rect:rect(overlay),dialog:rect(dialog),dialogOverflow:getComputedStyle(dialog).overflowY,scrollWidth:overlay.scrollWidth,clientWidth:overlay.clientWidth};
 document.getElementById('firebaseSupportButton').addEventListener('click',function(){window.FourSymbolsSupport.show();});
 document.getElementById('firebaseSupportButton').click();
 setTimeout(function(){
  const supportOverlay=document.getElementById('fourSymbolsSupportOverlay');
  document.getElementById('result').textContent=JSON.stringify({viewport:{width:innerWidth,height:innerHeight},auth:auth,support:{position:getComputedStyle(supportOverlay).position,rect:rect(supportOverlay),dialog:rect(supportOverlay.querySelector('.support-contact-dialog')),email:supportOverlay.querySelector('.support-contact-email').textContent}});
 },40);
},40);
</script></body></html>`;

const chrome=findChrome();
if(!chrome){
    if(process.env.CI){ throw new Error("CI must provide Chrome for responsive auth QA"); }
    console.log("Responsive auth/support browser QA skipped: Chrome not available");
    process.exit(0);
}

fs.writeFileSync(fixture,html,"utf8");
try{
    for(const viewport of [{width:390,height:844},{width:360,height:640},{width:844,height:390}]){
        const url="file://"+fixture.replace(/\\/g,"/");
        const run=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1",`--window-size=${viewport.width},${viewport.height}`,"--virtual-time-budget=1200","--dump-dom",url],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});
        assert.equal(run.status,0,run.stderr||"responsive auth fixture failed");
        const match=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
        assert.ok(match&&match[1].trim(),`missing browser result at ${viewport.width}x${viewport.height}`);
        const data=JSON.parse(decode(match[1]));
        assert.equal(data.auth.parent,"BODY");
        assert.equal(data.auth.position,"fixed");
        assert.ok(Math.abs(data.auth.rect.left)<=1&&Math.abs(data.auth.rect.top)<=1);
        assert.ok(Math.abs(data.auth.rect.width-data.viewport.width)<=1);
        assert.ok(Math.abs(data.auth.rect.height-data.viewport.height)<=1);
        assert.ok(within(data.auth.dialog,data.viewport.width,data.viewport.height),
            `auth dialog escaped ${data.viewport.width}x${data.viewport.height}`);
        assert.match(data.auth.dialogOverflow,/auto|scroll/);
        assert.ok(data.auth.scrollWidth<=data.auth.clientWidth+1,"auth overlay created horizontal overflow");
        assert.equal(data.support.position,"fixed");
        assert.ok(within(data.support.dialog,data.viewport.width,data.viewport.height),
            `support dialog escaped ${data.viewport.width}x${data.viewport.height}`);
        assert.equal(data.support.email,"tf00913225@gmail.com");
    }
}finally{
    try{fs.unlinkSync(fixture);}catch(_){ }
}

console.log("✓ responsive viewport auth and shared support contact browser QA passed");
