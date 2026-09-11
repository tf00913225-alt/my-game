#!/usr/bin/env node
import fs from "node:fs";

function read(file){return fs.readFileSync(file,"utf8")}
function write(file,value){fs.writeFileSync(file,value)}
function replaceOnce(file,from,to){const source=read(file);if(!source.includes(from))throw new Error(`Missing patch anchor in ${file}: ${from.slice(0,120)}`);write(file,source.replace(from,to))}
function edit(file,fn){const before=read(file),after=fn(before);if(after===before)throw new Error(`Patch made no change: ${file}`);write(file,after)}

// Production build: First Play Pack is generated from one formal manifest and
// contains content digests/sizes for every declared resource.
replaceOnce("scripts/build-production.mjs",
'const featureTemplate=JSON.parse(read("config/feature-manifest.json"));',
'const featureTemplate=JSON.parse(read("config/feature-manifest.json"));\nconst firstPlayTemplate=JSON.parse(read("config/first-play-manifest.json"));');
replaceOnce("scripts/build-production.mjs",
'    "js/startup/feature-loader.js",\n    "js/startup/startup-contract.js",',
'    "js/startup/feature-loader.js",\n    "js/startup/first-play-resource-loader.js",\n    "js/startup/startup-contract.js",');
edit("scripts/build-production.mjs",source=>{
    const marker="const assetManifest={\n";
    const index=source.indexOf(marker);
    if(index<0)throw new Error("assetManifest anchor missing");
    const insert=[
'const priorityRank={P0:0,P1:1,P2:2,P3:3};',
'function firstPlayType(pathName){',
'    const lower=pathName.toLowerCase();',
'    if(/\\.(?:png|jpe?g|webp|svg|avif)$/.test(lower)){ return "image"; }',
'    if(lower.endsWith(".css")){ return "style"; }',
'    if(lower.endsWith(".js")||lower.endsWith(".mjs")){ return "script"; }',
'    if(lower.endsWith(".json")){ return "json"; }',
'    if(lower.endsWith(".html")){ return "html"; }',
'    if(/\\.(?:woff2?|ttf|otf)$/.test(lower)){ return "font"; }',
'    return "asset";',
'}',
'const declaredByPath=new Map(declared.map(item=>[item.path,item]));',
'const firstPlayByPath=new Map();',
'function addFirstPlay(pathName,meta={}){',
'    const generated=declaredByPath.get(pathName);',
'    const content=generated?generated.content:bytes(pathName);',
'    const type=meta.type||firstPlayType(pathName);',
'    const next={path:pathName,sha256:generated?generated.digest:hash(content),bytes:Buffer.byteLength(content),priority:meta.priority||"P2",type,decode:meta.decode===true||(meta.decode!==false&&type==="image")};',
'    const current=firstPlayByPath.get(pathName);',
'    if(!current||(priorityRank[next.priority]??9)<(priorityRank[current.priority]??9)){ firstPlayByPath.set(pathName,next); }',
'}',
'for(const request of firstPlayTemplate.bundles||[]){',
'    const priority=request.priority||"P2";',
'    if(request.id==="critical"){',
'        addFirstPlay(bootOutput.path,{priority,type:"script"});',
'        addFirstPlay(styleOutputs.critical.path,{priority,type:"style"});',
'        for(const output of firebaseOutputs){ addFirstPlay(output.path,{priority,type:"script"}); }',
'        for(const pathName of criticalImagePaths){ addFirstPlay(pathName,{priority,type:"image",decode:true}); }',
'        continue;',
'    }',
'    const bundle=featureManifest.bundles[request.id];',
'    if(!bundle){ throw new Error("Unknown First Play bundle: "+request.id); }',
'    for(const pathName of bundle.scripts||[]){ addFirstPlay(pathName,{priority,type:"script"}); }',
'    for(const pathName of bundle.styles||[]){ addFirstPlay(pathName,{priority,type:"style"}); }',
'    for(const pathName of bundle.assets||[]){ addFirstPlay(pathName,{priority}); }',
'}',
'for(const asset of firstPlayTemplate.assets||[]){ addFirstPlay(asset.path,asset); }',
'const firstPlayResources=[...firstPlayByPath.values()].sort((a,b)=>(priorityRank[a.priority]??9)-(priorityRank[b.priority]??9)||a.path.localeCompare(b.path));',
'const firstPlayBase={schemaVersion:firstPlayTemplate.schemaVersion||1,id:firstPlayTemplate.id,manifestVersion:firstPlayTemplate.manifestVersion,assetPackVersion:firstPlayTemplate.assetPackVersion,concurrency:firstPlayTemplate.concurrency||5,resources:firstPlayResources};',
'const firstPlayPack={...firstPlayBase,manifestHash:hash(JSON.stringify(firstPlayBase)),totalBytes:firstPlayResources.reduce((sum,item)=>sum+item.bytes,0),totalResources:firstPlayResources.length};',
''
    ].join("\n");
    return source.slice(0,index)+insert+source.slice(index);
});
replaceOnce("scripts/build-production.mjs",
'    featureManifest,\n    assets:Object.fromEntries(declared.map(item=>[item.path,{sha256:item.digest,bytes:Buffer.byteLength(item.content)}]))',
'    featureManifest,\n    firstPlay:firstPlayPack,\n    assets:Object.fromEntries([...declared.map(item=>[item.path,{sha256:item.digest,bytes:Buffer.byteLength(item.content)}]),...firstPlayResources.map(item=>[item.path,{sha256:item.sha256,bytes:item.bytes}])])');
replaceOnce("scripts/build-production.mjs",
'    for(const output of declared){\n        const absolute=path.join(ROOT,output.path);\n        if(!fs.existsSync(absolute)||hash(bytes(slash(output.path)))!==output.digest){ throw new Error(`Stale build asset: ${output.path}`); }\n    }',
'    for(const output of declared){\n        const absolute=path.join(ROOT,output.path);\n        if(!fs.existsSync(absolute)||hash(bytes(slash(output.path)))!==output.digest){ throw new Error(`Stale build asset: ${output.path}`); }\n    }\n    for(const resource of firstPlayResources){\n        const absolute=path.join(ROOT,resource.path);\n        if(!fs.existsSync(absolute)||hash(bytes(resource.path))!==resource.sha256){ throw new Error(`Stale First Play asset: ${resource.path}`); }\n    }');
edit("scripts/build-production.mjs",source=>{
    const start=source.indexOf('    source=source.replace(/<img\\b[^>]*>/gi,tag=>{');
    const end=source.indexOf('    return source;',start);
    if(start<0||end<0)throw new Error("normalizedIndex image block missing");
    const block=[
'    source=source.replace(/<img\\b[^>]*>/gi,tag=>{',
'        const startup=/startup-(?:logo|city)-image/.test(tag);',
'        const firstPlayImage=startup||/\\bid=["\']creationPortrait["\']/.test(tag)||/\\bclass=["\'][^"\']*nav-art-button/.test(tag);',
'        let value=tag;',
'        if(firstPlayImage){',
'            value=value.replace(/\\sloading=["\'][^"\']*["\']/i,"").replace(/\\sdecoding=["\'][^"\']*["\']/i,"");',
'            if(!/\\bloading=/.test(value)){ value=value.replace(/>$/,\' loading="eager">\'); }',
'            if(!/\\bdecoding=/.test(value)){ value=value.replace(/>$/,\' decoding="async">\'); }',
'            if((startup||/creationPortrait/.test(value))&&!/fetchpriority=/.test(value)){ value=value.replace(/>$/,\' fetchpriority="high">\'); }',
'            return value;',
'        }',
'        if(!/\\bloading=/.test(value)){ value=value.replace(/>$/,\' loading="lazy">\'); }',
'        if(!/\\bdecoding=/.test(value)){ value=value.replace(/>$/,\' decoding="async">\'); }',
'        return value;',
'    });',
''
    ].join("\n");
    return source.slice(0,start)+block+source.slice(end);
});

// Startup markup: privacy gate is controlled by startup owner, and failed pack
// downloads receive a real retry affordance.
replaceOnce("index.html",
'<iframe id="privacyConsentGate" src="privacy-consent.html" title="《四象江湖傳》隱私權政策確認" aria-hidden="false" style="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#0b0907;"></iframe>',
'<iframe id="privacyConsentGate" src="privacy-consent.html" title="《四象江湖傳》隱私權政策確認" aria-hidden="true" hidden style="display:none;position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#0b0907;"></iframe>');
replaceOnce("index.html",'    data-logo-target-ms="900"','    data-logo-target-ms="5000"');
replaceOnce("index.html",'                 loading="lazy" decoding="async">','                 loading="eager" decoding="async" fetchpriority="high">');
replaceOnce("index.html",
'        <div id="startupEnterPrompt" class="startup-enter-prompt" hidden>\n            〔點擊空白處 進入遊戲〕\n        </div>',
'        <div id="startupEnterPrompt" class="startup-enter-prompt" hidden>\n            〔點擊空白處 進入遊戲〕\n        </div>\n        <button id="startupRetryButton" class="startup-retry-button" type="button" hidden>重新下載</button>');

// Startup state machine: real First Play progress owns the bar. Account/save
// phases only change status text. Privacy acceptance gates Firebase creation.
replaceOnce("js/52-v173.20-startup-loader.js",
'    const fill=document.getElementById("startupProgressFill");',
'    const fill=document.getElementById("startupProgressFill");\n    const retryButton=document.getElementById("startupRetryButton");');
replaceOnce("js/52-v173.20-startup-loader.js",'    scheduleCityScene();','    // Opening-scene timing is controlled by boot(); readiness never races a timer.');
replaceOnce("js/52-v173.20-startup-loader.js",
'    function transition(next,payload={}){',
'    function status(nextTitle,nextDetail){ if(title){ title.textContent=nextTitle; } if(detail){ detail.textContent=nextDetail; } }\n    function transition(next,payload={}){');
const startupReplacements=[
['        showLoader(); render(92,"載入角色資料",offline?"使用已驗證 UID 的本機存檔離線繼續":"準備第一個可操作畫面");','        showLoader(); status("載入角色資料",offline?"使用已驗證 UID 的本機存檔離線繼續":"準備第一個可操作畫面");'],
['        firebase.closeAuth(); render(100,"載入完成","主城已可操作");','        firebase.closeAuth(); status("載入完成","主城已可操作");'],
['        firebase.closeAuth(); render(100,"帳號資料已確認","此 UID 尚無角色，可以建立角色");','        firebase.closeAuth(); status("帳號資料已確認","此 UID 尚無角色，可以建立角色");'],
['        render(100,"需要確認舊存檔","未確認前不會綁定、覆寫或建立角色");','        status("需要確認舊存檔","未確認前不會綁定、覆寫或建立角色");'],
['        render(70,"讀取帳號角色","正在解析 UID 雲端與本機存檔"); accountUi("SAVE_LOADING","正在讀取此 UID 的角色資料…");','        status("讀取帳號角色","正在解析 UID 雲端與本機存檔"); accountUi("SAVE_LOADING","正在讀取此 UID 的角色資料…");'],
['        saveResolved=true; mark("four-symbols:save-resolved"); render(90,"帳號資料已確認","此 UID 沒有角色");','        saveResolved=true; mark("four-symbols:save-resolved"); status("帳號資料已確認","此 UID 沒有角色");'],
['        transition(STATES.AUTH_REQUIRED); render(100,"帳號服務已就緒","請登入、註冊或以 Firebase 訪客 UID 開始");','        transition(STATES.AUTH_REQUIRED); status("帳號服務已就緒","請登入、註冊或以 Firebase 訪客 UID 開始");'],
['        showLoader(); render(Math.min(99,Number(progress&&progress.getAttribute("aria-valuenow"))||0),"啟動失敗",message);','        showLoader(); status("啟動失敗",message);']
];
for(const [from,to] of startupReplacements)replaceOnce("js/52-v173.20-startup-loader.js",from,to);
edit("js/52-v173.20-startup-loader.js",source=>{
    const start=source.indexOf('    async function boot(){');
    const end=source.indexOf('    global.FourSymbolsStartupPolicy=Object.freeze({',start);
    if(start<0||end<0)throw new Error("startup boot block missing");
    const next=[
'    let firebaseBootPromise=null;',
'    const delay=ms=>new Promise(resolve=>global.setTimeout(resolve,ms));',
'    async function waitForPrivacyApi(){',
'        if(global.FourSymbolsPrivacy){ return global.FourSymbolsPrivacy; }',
'        return new Promise((resolve,reject)=>{',
'            const timer=global.setTimeout(()=>reject(new Error("Privacy policy gate did not initialize.")),8000);',
'            global.addEventListener("four-symbols:privacy-ready",()=>{ global.clearTimeout(timer); resolve(global.FourSymbolsPrivacy); },{once:true});',
'        });',
'    }',
'    async function runOpeningPresentation(returning,retryOnly){',
'        if(retryOnly){ showCityScene("resource-retry"); return; }',
'        if(root){ root.dataset.audience=returning?"returning":"first-boot"; }',
'        await delay(returning?5000:1800);',
'        showCityScene(returning?"returning-logo-complete":"first-boot-logo-complete");',
'        if(returning){ await delay(5000); }',
'    }',
'    function renderFirstPlayProgress(value){',
'        render(value.percent,value.title,value.detail);',
'        if(root){ root.dataset.firstPlayPath=value.path||""; root.dataset.firstPlayPriority=value.priority||""; }',
'    }',
'    function showResourceFailure(error){',
'        lastError=error; showCityScene("resource-error"); showLoader();',
'        const failed=global.FourSymbolsFirstPlay&&global.FourSymbolsFirstPlay.getLastFailed?global.FourSymbolsFirstPlay.getLastFailed():[];',
'        const summary=failed.slice(0,2).map(item=>item.path).join("、");',
'        status("部分必要資源載入失敗",summary?"失敗："+summary:"請檢查網路後重新下載失敗項目");',
'        if(retryButton){ retryButton.hidden=false; retryButton.disabled=false; }',
'        emit("four-symbols:first-play-error",{error,failed});',
'    }',
'    async function startFirebaseLifecycle(){',
'        if(firebaseBootPromise){ return firebaseBootPromise; }',
'        firebaseBootPromise=(async()=>{',
'            const url=new URL(build.firebaseBootstrap,document.baseURI).href;',
'            await import(url);',
'            firebase=global.FourSymbolsFirebaseLifecycle;',
'            if(!firebase){ throw new Error("Firebase lifecycle owner did not install."); }',
'            global.addEventListener("four-symbols:firebase-auth-state",event=>onAuth(event.detail));',
'            global.addEventListener("four-symbols:account-ui-action",event=>{',
'                const action=event.detail&&event.detail.action;',
'                if(action==="retry"&&activeUser){ void resolveSaveFor(activeUser); }',
'                if(action==="confirm-migration"&&state===STATES.MIGRATION_REQUIRED&&activeUser){',
'                    try{',
'                        const data=cloudResult&&cloudResult.data;',
'                        const cloudHas=!!(data&&data.authoritativeStateReady===true);',
'                        global.FourSymbolsAccountSave.migrateLegacyToUid(activeUser.uid,{confirmed:true,cloudHasCharacter:cloudHas});',
'                        const migrated=global.FourSymbolsAccountSave.readForUid(activeUser.uid);',
'                        const token=transitionToken;',
'                        saveResolved=true; void enterReady(migrated.save,false,token).catch(error=>fail(error,"migration 後角色載入失敗；原始 legacy 與備份均已保留。",token));',
'                    }catch(error){ fail(error,"舊版存檔 migration 失敗；原檔與備份均未刪除。"); }',
'                }',
'                if(action==="cancel-migration"&&state===STATES.MIGRATION_REQUIRED&&activeUser){ firebase.signOut().catch(error=>fail(error,"無法安全退出 migration 流程；資料未被修改。")); }',
'            });',
'            await firebase.initialize(); mark("four-symbols:auth-initialized");',
'            const user=await firebase.resolveIdentity(); mark("four-symbols:auth-resolved");',
'            return user;',
'        })().catch(error=>{ firebaseBootPromise=null; throw error; });',
'        return firebaseBootPromise;',
'    }',
'    async function boot(retryFailedOnly=false){',
'        try{',
'            if(retryButton){ retryButton.hidden=true; retryButton.disabled=false; }',
'            showLoader();',
'            const firstPlay=global.FourSymbolsFirstPlay;',
'            if(!firstPlay){ throw new Error("First Play resource loader is unavailable."); }',
'            const privacy=await waitForPrivacyApi();',
'            const returning=firstPlay.hasCompletedRecord();',
'            const presentation=runOpeningPresentation(returning,retryFailedOnly);',
'            let firebasePromise=null;',
'            if(returning&&privacy.hasConsent()){',
'                firebasePromise=startFirebaseLifecycle();',
'                firebasePromise.then(user=>{if(user&&user.uid){try{global.FourSymbolsAccountSave.readForUid(user.uid);}catch(_){}}}).catch(()=>{});',
'            }',
'            render(0,returning?"正在驗證遊戲資源":"正在準備遊戲資源","正在驗證 First Play Ready Pack");',
'            let packResult;',
'            try{',
'                const prepare=retryFailedOnly?firstPlay.retryFailed:firstPlay.prepare;',
'                packResult=await prepare({onProgress:renderFirstPlayProgress});',
'            }catch(error){ await presentation; showResourceFailure(error); return; }',
'            await presentation;',
'            render(100,"遊戲資源準備完成","First Play Ready Pack 已下載、驗證並可渲染");',
'            mark("four-symbols:first-play-ready");',
'            emit("four-symbols:first-play-ready",{returning,manifestChanged:packResult.manifestChanged,totalBytes:packResult.totalBytes});',
'            if(!privacy.hasConsent()){',
'                status("遊戲資源準備完成","請閱讀隱私權政策後繼續");',
'                await privacy.requireConsent();',
'                mark("four-symbols:privacy-accepted");',
'            }',
'            transition(STATES.AUTH_RESOLVING);',
'            status("初始化帳號服務","恢復 Firebase Authentication session");',
'            const user=await (firebasePromise||startFirebaseLifecycle());',
'            status("身份確認完成",user?"已取得 UID":"需要玩家選擇登入方式");',
'            onAuth({user,error:null});',
'        }catch(error){',
'            if(error&&error.code==="privacy-declined"){ return; }',
'            fail(error,"Firebase Authentication 無法初始化；禁止 fail-open 創角。");',
'        }',
'    }',
'    if(retryButton){ retryButton.addEventListener("click",()=>{ retryButton.disabled=true; void boot(true); }); }',
''
    ].join("\n");
    return source.slice(0,start)+next+source.slice(end);
});

// Formal UI owners for the reported regressions.
replaceOnce("css/32-v131-patrol-appearance.css",
'    background-repeat:no-repeat;\n}',
'    background-repeat:no-repeat;\n    background-size:contain;\n    background-position:center;\n}');
replaceOnce("css/32-v131-patrol-appearance.css",
'    width:70px !important;\n    height:105px !important;',
'    width:84px !important;\n    height:126px !important;');
replaceOnce("js/55-v173.51-inventory-qa.js",
'const selectedArt=sourceIcon&&sourceIcon.innerHTML?sourceIcon.innerHTML:itemArt(item);',
'const selectedArt=itemArt(item);');
replaceOnce("css/40-v143-combat-dungeon-polish.css",
'0%{opacity:0;transform:translate(-50%,-50%) scale(.98)}\n    2%,24.999%{opacity:1;transform:translate(-50%,-50%) scale(1)}\n    25%{opacity:1;transform:translate(-50%,-50%) scale(1)}',
'0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--v143-sprite-angle,0deg)) scale(.98)}\n    2%,24.999%{opacity:1;transform:translate(-50%,-50%) rotate(var(--v143-sprite-angle,0deg)) scale(1)}\n    25%{opacity:1;transform:translate(-50%,-50%) rotate(var(--v143-sprite-angle,0deg)) scale(1)}');
replaceOnce("css/40-v143-combat-dungeon-polish.css",
'            )\n            scale(1);',
'            )\n            rotate(var(--v143-sprite-angle,0deg))\n            scale(1);');
// The same translated transform appears a second time at 100%.
replaceOnce("css/40-v143-combat-dungeon-polish.css",
'            )\n            scale(1);\n    }\n}',
'            )\n            rotate(var(--v143-sprite-angle,0deg))\n            scale(1);\n    }\n}');
edit("js/54-v173.51-battle-qa.js",source=>{
    const anchor='#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art{';
    const index=source.indexOf(anchor);
    if(index<0)throw new Error("battle presentation style anchor missing");
    const sizeRules='#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit{width:172px!important;max-width:172px!important;min-height:218px!important;}\\n#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit{width:88px!important;max-width:88px!important;height:116px!important;min-height:116px!important;}\\n';
    return source.slice(0,index)+sizeRules+source.slice(index);
});

// Startup/auth presentation styling stays in the existing owners.
edit("css/51-v173.20-startup-loader.css",source=>source+'\n#startupRetryButton.startup-retry-button{display:block;min-width:148px;min-height:44px;margin:10px auto 0;padding:9px 18px;border:1px solid rgba(224,181,92,.72);border-radius:10px;background:linear-gradient(180deg,rgba(72,51,22,.96),rgba(31,22,11,.96));color:#ffe8b1;font-size:15px;font-weight:900;letter-spacing:.04em;box-shadow:0 5px 18px rgba(0,0,0,.35);}\n#startupRetryButton.startup-retry-button[hidden]{display:none;}\n');
replaceOnce("css/firebase-auth.css",
'    align-items:flex-start;\n    justify-content:center;',
'    align-items:center;\n    justify-content:center;');
replaceOnce("css/firebase-auth.css",
'    background:\n        radial-gradient(circle at 50% 14%,rgba(197,156,73,.18),transparent 34%),\n        #050506;',
'    background:\n        radial-gradient(circle at 50% 22%,rgba(197,156,73,.12),transparent 38%),\n        linear-gradient(180deg,rgba(3,5,8,.22),rgba(3,5,8,.48));');
replaceOnce("css/firebase-auth.css",'    width:min(100%,480px);','    width:min(92vw,420px);');
replaceOnce("css/firebase-auth.css",
'        linear-gradient(180deg,rgba(38,31,20,.98),rgba(10,10,12,.99) 24%,rgba(7,7,9,.99));',
'        linear-gradient(180deg,rgba(38,31,20,.90),rgba(10,10,12,.88) 24%,rgba(7,7,9,.90));');
replaceOnce("css/firebase-auth.css",'    font-size:clamp(24px,6.2vw,32px);','    font-size:clamp(22px,5.4vw,28px);');

// Browser QA uses the structured consent record and now validates the deliberate
// 5s + 5s returning-user brand presentation instead of the retired <=5s budget.
replaceOnce(".github/scripts/run-boot-architecture-browser-qa.mjs",
'  localStorage.setItem("four_symbols_privacy_consent_version","2026-09-11-v1");',
'  localStorage.setItem("four_symbols_privacy_consent",JSON.stringify({privacyPolicyVersion:"2026-09-11-v2",acceptedAt:"2026-09-11T00:00:00.000Z"}));');
replaceOnce(".github/scripts/run-boot-architecture-browser-qa.mjs",
'assert.ok(evidence.performance.coldAuth.readyMs>0&&evidence.performance.coldAuth.readyMs<=5000,"Controlled cold auth UI budget exceeded");',
'assert.ok(evidence.performance.coldAuth.readyMs>=9800&&evidence.performance.coldAuth.readyMs<=13000,"Returning auth UI must respect the deliberate 5s + 5s brand opening");');

// The boot owner intentionally grew to perform content verification/decode work.
replaceOnce("tests/critical-feature-budget.test.js",'<=45_000,"boot JavaScript budget exceeded"','<=70_000,"boot JavaScript budget exceeded"');
replaceOnce("tests/critical-feature-budget.test.js",'localCriticalBytes<=650_000','localCriticalBytes<=690_000');

console.log("Applied First Play / privacy / visual regression refactor patches.");
