"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const {spawn}=require("node:child_process");
const os=require("node:os");
const crypto=require("node:crypto");
const {pathToFileURL}=require("node:url");
function findChrome(){
    if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH&&fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH))return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const p=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});if(p.status===0&&p.stdout.trim())return p.stdout.trim();}return "";}
function decode(v){return v.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
// Isolated presentation states: invoke only the real feedback renderer, never
// createCharacter, Firebase, auth, saves or a fabricated server response.
async function verifyCreationStates(){
 const {Cdp,waitJson}=await import('../.github/scripts/runtime-browser-qa-support.mjs');
 const source=fs.readFileSync('js/00-main.js','utf8');
 const feedback=source.match(/^function updateInitialCharacterCreationFeedback\([\s\S]*?^\}/m)?.[0];
 assert.ok(feedback,'formal creation feedback renderer missing');
 const index=fs.readFileSync('index.html','utf8');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'creation-state-qa-'));
 const stateFile=path.join(process.cwd(),'.creation-state-browser.html');
 const out=path.join(process.cwd(),'artifacts/browser-qa/creation-states');fs.mkdirSync(out,{recursive:true});
 const result={suite:'creation-presentation-states',passed:false,head:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),sourceDigests:Object.fromEntries(['index.html','js/00-main.js','css/29-v125-character-creation-native.css','css/31-v131-fix-batch.css','css/56-v174-critical-ui-regressions.css'].filter(p=>fs.existsSync(p)).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),browser:'Chromium emulation; not Safari/device certification',results:[]};
 const chrome=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let c;
 try{
  const portFile=path.join(profile,'DevToolsActivePort'),end=Date.now()+15000;
  let port;
  while(Date.now()<end){
   assert.ok(chrome.exitCode===null&&chrome.signalCode===null,'Chrome exited before remote debugging was ready');
   try{
    const match=fs.readFileSync(portFile,'utf8').match(/^([1-9][0-9]{0,4})\r?\n/);
    if(match&&Number(match[1])<=65535){port=match[1];break;}
   }catch(error){if(error.code!=='ENOENT')throw error;}
   await new Promise(r=>setTimeout(r,Math.min(50,Math.max(0,end-Date.now()))));
  }
  assert.ok(port&&Date.now()<end,'Chrome remote debugging did not start');
  const pages=await waitJson('http://127.0.0.1:'+port+'/json/list',{chromeProcess:chrome,timeoutMs:end-Date.now(),accept:rows=>Array.isArray(rows)&&rows.some(p=>p.type==='page'&&p.webSocketDebuggerUrl)});c=new Cdp(pages.find(p=>p.type==='page'&&p.webSocketDebuggerUrl).webSocketDebuggerUrl);
  await c.send('Page.enable');
  for(const viewport of [[360,640],[1280,800]]){
   await c.send('Emulation.setDeviceMetricsOverride',{width:viewport[0],height:viewport[1],deviceScaleFactor:1,mobile:false});
   for(const state of ['empty-name','long-name','processing','retry']){
    const page=html.replace('</head>','<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="css/31-v131-fix-batch.css"><style>html,body{width:100%!important;height:100%!important}#result{display:none}</style></head>');
    const pageUrl=pathToFileURL(stateFile).href+'?state='+state+'&viewport='+viewport.join('x');
    fs.writeFileSync(stateFile,page,'utf8');await c.send('Page.navigate',{url:pageUrl});
    // DOM existence can precede external CSS. Measure this navigation only,
    // after its real styles/fonts/layout settle, within the original 2s budget.
    const readyBy=Date.now()+2000;let ready=false,lastReady=null;
    while(Date.now()<readyBy){
     const loaded=await c.eval(`({current:location.href===${JSON.stringify(pageUrl)},complete:document.readyState==='complete',input:!!document.querySelector('.creation-input'),styles:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>({href:link.href,ready:!!link.sheet&&link.sheet.cssRules.length>0}))})`);
     lastReady=loaded;
     if(loaded.current&&loaded.complete){
      assert.ok(loaded.styles.length>=3&&loaded.styles.every(link=>link.ready),'creation stylesheet failed to load: '+JSON.stringify(loaded.styles));
      if(loaded.input){ready=true;break;}
     }
     await new Promise(r=>setTimeout(r,20));
    }
    assert.ok(ready,'creation document/styles did not load within the readiness budget: '+JSON.stringify(lastReady));
    await c.eval(`Promise.race([document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))),new Promise((_,reject)=>setTimeout(()=>reject(new Error('creation fonts/layout readiness timed out')),${Math.max(1,readyBy-Date.now())}))])`);
    const measured=await c.eval(`(()=>{
     const root=document.getElementById('creationPage');const fit=Math.min(innerWidth/1080,innerHeight/1920);root.style.setProperty('transform-origin','top left','important');root.style.setProperty('transform','translate('+((innerWidth-1080*fit)/2)+'px,'+((innerHeight-1920*fit)/2)+'px) scale('+fit+')','important');
     const state=${JSON.stringify(state)};const step=document.querySelector('.creation-step');
     if(state==='processing'||state==='retry'){
      const authored=new DOMParser().parseFromString(${JSON.stringify(index)},'text/html').querySelector('#creationStepTwo');authored.hidden=false;authored.classList.add('is-active');step.replaceWith(authored);
      document.querySelectorAll('[onclick]').forEach(n=>n.removeAttribute('onclick'));
      const $=id=>document.getElementById(id);let initialCharacterCreationPending=state==='processing',creationTargetSlot=1;${feedback}
      updateInitialCharacterCreationFeedback(state==='processing'?'正在確認帳號…':'創角未完成，請重試');
     }else{const input=document.querySelector('.creation-input');input.id='creationId';input.placeholder='請輸入角色名稱';input.value=state==='empty-name'?'':'長名稱角色測試'.repeat(8);input.scrollLeft=input.scrollWidth;}
     const control=document.querySelector(state==='processing'||state==='retry'?'#creationSubmitButton':'.creation-input'),r=control.getBoundingClientRect(),label=control.querySelector('span');let textRect=null;
     if(label){const range=document.createRange();range.selectNodeContents(label);const t=range.getBoundingClientRect();textRect={left:t.left,right:t.right,top:t.top,bottom:t.bottom};}
     return {viewport:[innerWidth,innerHeight],state,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},textRect,text:label?.textContent||control.value,placeholder:control.placeholder,disabled:control.disabled,busy:control.getAttribute('aria-busy'),scrollLeft:control.scrollLeft,scrollWidth:control.scrollWidth,clientWidth:control.clientWidth,font:parseFloat(getComputedStyle(label||control).fontSize)*fit};
    })()`);
    assert.deepEqual(measured.viewport,viewport);const r=measured.rect;assert.ok(r.width>0&&r.left>=-1&&r.right<=viewport[0]+1&&r.top>=-1&&r.bottom<=viewport[1]+1,state+' control outside viewport '+JSON.stringify(measured));
    assert.ok(measured.font>=12.9,state+' unreadable control '+JSON.stringify(measured));
    if(measured.textRect){const t=measured.textRect;assert.ok(t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1,state+' feedback clipped');assert.equal(measured.disabled,state==='processing');assert.equal(measured.busy,String(state==='processing'));}
    else if(state==='empty-name'){assert.equal(measured.text,'');assert.ok(measured.placeholder);}
    else{assert.ok(measured.scrollWidth>measured.clientWidth&&measured.scrollLeft>0,'long name cannot reveal its end');}
    const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,state+'-'+viewport.join('x')+'.png'),Buffer.from(shot.data,'base64'));result.results.push(measured);
   }
  }
  result.passed=true;console.log('✓ creation empty/long name and real processing/retry feedback: 8 viewport states passed');
 }finally{fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(result,null,2)+'\n');c?.close();chrome.kill();try{fs.unlinkSync(stateFile);}catch{}try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
}
const file=path.join(process.cwd(),".creation-critical-browser.html");
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/29-v125-character-creation-native.css"><link rel="stylesheet" href="css/56-v174-critical-ui-regressions.css"><style>html,body{margin:0;width:1080px;height:1920px;background:#000;overflow:hidden}#creationPage{display:block!important}</style></head><body>
<div id="creationPage" class="creation-page-scroll native-creation-page" data-element="water"><div class="creation-premium-shell"><header class="creation-premium-header"><div class="creation-header-ornament">◆</div><h1 class="creation-title">創建角色</h1><p class="creation-subtitle">選擇你的元素之道</p><div class="creation-step-progress"><span>01 選擇角色</span><i></i><span>02 能力配點</span></div></header><div class="creation-step is-active"><section class="creation-showcase"><div class="creation-portrait-panel"><div class="creation-portrait-aura"></div><img class="creation-portrait-image" src="assets/characters/female_water.jpg"><div class="creation-portrait-caption"><b>水元素</b><span>女俠</span></div></div><div class="creation-choice-panel"><div class="creation-section-kicker">性別</div><div class="creation-gender-grid"><button class="creation-gender-option selected">女</button><button class="creation-gender-option">男</button></div><div class="creation-section-kicker creation-element-kicker">元素</div><div class="creation-element-grid"><button class="element-option selected"><span class="creation-element-glyph">水</span><span class="element-name">寒水</span></button><button class="element-option"><span class="creation-element-glyph">火</span><span class="element-name">烈焰</span></button><button class="element-option"><span class="creation-element-glyph">風</span><span class="element-name">疾風</span></button><button class="element-option"><span class="creation-element-glyph">土</span><span class="element-name">厚土</span></button></div><div class="creation-role-card"><div class="creation-role-title-row"><div class="creation-element-badge">水</div><div><div class="creation-role-title">寒水之道</div><div class="creation-role-subtitle">吸取回復 · 冰封 · 治療復活</div></div></div><div class="creation-role-description">兼具續航、控場與隊伍回復；攻擊技能可吸取HP與SP，並擁有冰封、治療與復活能力。</div><div class="creation-role-tags"><span class="creation-role-tag">HP/SP吸取</span><span class="creation-role-tag">冰封控場</span><span class="creation-role-tag">治療復活</span></div></div></div></section><section class="creation-card creation-identity-card"><div class="creation-card-heading"><div class="creation-card-index">01</div><div><div class="creation-label">玩家 ID</div><div class="creation-card-caption">這會成為你的角色名稱</div></div></div><input class="creation-input" value="測試角色"></section><button class="creation-next"><span>下一步：能力配點</span></button></div></div></div>
<pre id="result"></pre><script>(function(){function r(s){var x=document.querySelector(s).getBoundingClientRect();return {top:x.top,bottom:x.bottom,left:x.left,right:x.right,width:x.width,height:x.height};}var showcase=r('.creation-showcase'),portrait=r('.creation-portrait-panel'),image=r('.creation-portrait-image'),role=r('.creation-role-card'),identity=r('.creation-identity-card'),next=r('.creation-next'),roleEl=document.querySelector('.creation-role-card');document.getElementById('result').textContent=JSON.stringify({showcase:showcase,portrait:portrait,image:image,role:role,identity:identity,next:next,hint:getComputedStyle(roleEl,'::after').content,objectFit:getComputedStyle(document.querySelector('.creation-portrait-image')).objectFit,overflowY:getComputedStyle(document.querySelector('.creation-role-card')).overflowY});})();</script></body></html>`;
fs.writeFileSync(file,html,"utf8");
try{const chrome=findChrome();if(!chrome){if(process.env.CI)throw new Error("CI must provide Chrome for creation browser QA");console.log("creation browser QA skipped");try{fs.unlinkSync(file);}catch(_){}process.exit(0);}const run=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--force-device-scale-factor=1","--window-size=1080,1920","--dump-dom","file://"+file.replace(/\\/g,"/")],{encoding:"utf8",timeout:30000,maxBuffer:12*1024*1024});assert.equal(run.status,0,run.stderr);const m=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);assert.ok(m);const d=JSON.parse(decode(m[1]));assert.equal(d.objectFit,"contain");assert.ok(d.image.top>=d.portrait.top-1&&d.image.bottom<=d.portrait.bottom+1,"portrait art is clipped outside its panel");assert.ok(d.role.top>=d.showcase.top&&d.role.bottom<=d.showcase.bottom+1,"element description escapes showcase: "+JSON.stringify(d));assert.ok(d.identity.top>=d.showcase.bottom-1,"identity card overlaps showcase");assert.ok(d.next.bottom<=1920+1,"creation next button escapes 1920 canvas");assert.match(d.hint,/土剋水/);console.log("✓ creation portrait/copy browser geometry passed");}finally{try{fs.unlinkSync(file);}catch(_){}}
verifyCreationStates().catch(error=>{console.error(error);process.exitCode=1;});
