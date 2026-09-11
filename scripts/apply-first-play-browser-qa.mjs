#!/usr/bin/env node
import fs from "node:fs";

const file=".github/scripts/run-boot-architecture-browser-qa.mjs";
let source=fs.readFileSync(file,"utf8");
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
function replaceOnce(from,to){if(!source.includes(from))throw new Error("Missing QA patch anchor: "+from.slice(0,160));source=source.replace(from,to);}

const readyRecord={
  gameVersion:String(manifest.release||""),
  manifestVersion:manifest.firstPlay.manifestVersion,
  assetPackVersion:manifest.firstPlay.assetPackVersion,
  manifestHash:manifest.firstPlay.manifestHash,
  completedAt:"2026-09-11T00:00:00.000Z",
  assets:Object.fromEntries(manifest.firstPlay.resources.map(item=>[item.path,item.sha256]))
};
const staleRecord={...readyRecord,manifestHash:"qa-stale-manifest",assets:{...readyRecord.assets,"assets/ui/nav-home.png":"qa-stale-asset"}};

replaceOnce(
'const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));',
'const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));\nconst qaReadyFirstPlayRecord='+JSON.stringify(readyRecord)+';\nconst qaStaleFirstPlayRecord='+JSON.stringify(staleRecord)+';'
);

const oldPrelude=`function qaPrelude(){
    return \`<script>
window.__qaIdleCallbacks=[];
window.requestIdleCallback=function(callback){window.__qaIdleCallbacks.push(callback);return window.__qaIdleCallbacks.length;};
(function(){
  var scenario=new URL(location.href).searchParams.get("scenario")||"";
  localStorage.setItem("four_symbols_privacy_consent",JSON.stringify({privacyPolicyVersion:"2026-09-11-v2",acceptedAt:"2026-09-11T00:00:00.000Z"}));
  var legacy={player:{id:"舊版角色",element:"water",level:8}};
  if(scenario==="legacy-empty"||scenario==="legacy-cloud"){localStorage.setItem("battle_full_version_save_v5",JSON.stringify(legacy));}
  if(scenario==="corrupt"){
    localStorage.setItem("four_symbols_save:uid-corrupt","{broken-json");
    localStorage.setItem("four_symbols_save_meta:uid-corrupt",JSON.stringify({schemaVersion:1,ownerUid:"uid-corrupt"}));
  }
})();
</script>\`;
}`;
const newPrelude=`function qaPrelude(){
    const ready=JSON.stringify(qaReadyFirstPlayRecord);
    const stale=JSON.stringify(qaStaleFirstPlayRecord);
    return \`<script>
window.__qaIdleCallbacks=[];
window.requestIdleCallback=function(callback){window.__qaIdleCallbacks.push(callback);return window.__qaIdleCallbacks.length;};
(function(){
  var scenario=new URL(location.href).searchParams.get("scenario")||"";
  var noConsent=scenario==="first-play-fresh"||scenario==="privacy-update";
  var noReady=scenario==="first-play-fresh"||scenario==="resource-404"||scenario==="decode-fail";
  if(!noConsent){localStorage.setItem("four_symbols_privacy_consent",JSON.stringify({privacyPolicyVersion:"2026-09-11-v2",acceptedAt:"2026-09-11T00:00:00.000Z"}));}
  if(scenario==="privacy-update"){localStorage.setItem("four_symbols_privacy_consent",JSON.stringify({privacyPolicyVersion:"2026-09-10-v1",acceptedAt:"2026-09-10T00:00:00.000Z"}));}
  if(!noReady){localStorage.setItem("four_symbols_first_play_ready",scenario==="manifest-update"?${'${stale}'}:${'${ready}'});}
  if(scenario==="decode-fail"&&Image.prototype.decode){
    var nativeDecode=Image.prototype.decode;
    Image.prototype.decode=function(){
      if(!window.__qaDecodeFailed&&String(this.src||"").indexOf("blob:")===0){window.__qaDecodeFailed=true;return Promise.reject(new Error("QA simulated image decode failure"));}
      return nativeDecode.call(this);
    };
  }
  var legacy={player:{id:"舊版角色",element:"water",level:8}};
  if(scenario==="legacy-empty"||scenario==="legacy-cloud"){localStorage.setItem("battle_full_version_save_v5",JSON.stringify(legacy));}
  if(scenario==="corrupt"){
    localStorage.setItem("four_symbols_save:uid-corrupt","{broken-json");
    localStorage.setItem("four_symbols_save_meta:uid-corrupt",JSON.stringify({schemaVersion:1,ownerUid:"uid-corrupt"}));
  }
})();
</script>\`;
}`;
replaceOnce(oldPrelude,newPrelude);

replaceOnce(
'async function createQaServer(){\n    const server=http.createServer(async(request,response)=>{',
'async function createQaServer(){\n    let activeScenario="";\n    let injected404=false;\n    const server=http.createServer(async(request,response)=>{'
);
replaceOnce(
'            const relative=decodeURIComponent(url.pathname==="/"?"index.html":url.pathname.slice(1));\n            const file=path.resolve(ROOT,relative);',
'            const relative=decodeURIComponent(url.pathname==="/"?"index.html":url.pathname.slice(1));\n            if(relative==="index.html"){ activeScenario=url.searchParams.get("scenario")||""; injected404=false; }\n            if(activeScenario==="resource-404"&&relative==="assets/ui/nav-home.png"&&!injected404){ injected404=true; response.writeHead(404,{"cache-control":"no-store"}); response.end("qa missing first-play asset"); return; }\n            if(activeScenario==="manifest-update"&&relative==="assets/ui/nav-home.png"){ await sleep(10800); }\n            const file=path.resolve(ROOT,relative);'
);
replaceOnce(
'async function waitFor(client,expression,label,timeoutMs=15000){',
'async function waitFor(client,expression,label,timeoutMs=22000){'
);
replaceOnce(
'const evidence={schemaVersion:1,status:"RUNNING",release:manifest.release,environment:"local HTTP, mobile emulation, deterministic Firebase Auth/Firestore test doubles; production bundles unchanged",checks:{},performance:{}};',
'const evidence={schemaVersion:2,status:"RUNNING",release:manifest.release,firstPlay:{manifestHash:manifest.firstPlay.manifestHash,totalBytes:manifest.firstPlay.totalBytes,totalResources:manifest.firstPlay.totalResources,concurrency:manifest.firstPlay.concurrency},environment:"local HTTP, mobile emulation, deterministic Firebase Auth/Firestore test doubles; production bundles unchanged",checks:{},performance:{}};'
);

const initialAnchor='    await client.send("Network.setCacheDisabled",{cacheDisabled:true});await clear();await navigate("signed-out");';
const firstPlayCases=`    await client.send("Network.setCacheDisabled",{cacheDisabled:true});

    // CASE 1 + CASE 5: a truly fresh device prepares the real pack first and
    // cannot initialize Firebase while privacy has not been accepted.
    await clear();await navigate("first-play-fresh");
    await waitFor(client,"document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden&&document.getElementById('startupProgress').getAttribute('aria-valuenow')==='100'","fresh First Play privacy gate",30000);
    const freshPack=await client.eval(\`(()=>{const gate=document.getElementById("privacyConsentGate");const rec=JSON.parse(localStorage.getItem("four_symbols_first_play_ready")||"null");const portrait=document.getElementById("creationPortrait");const resources=performance.getEntriesByType("resource").map(e=>new URL(e.name).pathname);return {state:FourSymbolsStartupPolicy.getState(),percent:document.getElementById("startupProgress").getAttribute("aria-valuenow"),privacyVisible:!gate.hidden,authInstalled:!!window.FourSymbolsFirebaseLifecycle,authOverlay:!!document.getElementById("firebaseAuthOverlay"),recordHash:rec&&rec.manifestHash,recordBytes:window.FourSymbolsFirstPlay.getManifest().totalBytes,portraitReady:portrait.complete&&portrait.naturalWidth>0,hasAppShell:resources.some(p=>/\\/app-shell\\./.test(p)),hasGameplay:resources.some(p=>/\\/gameplay-core\\./.test(p)),hasPatrol:resources.some(p=>/\\/feature-patrol\\./.test(p))};})()\`);
    assert.equal(freshPack.state,"BOOT_LOADING");assert.equal(freshPack.percent,"100");assert.equal(freshPack.privacyVisible,true);assert.equal(freshPack.authInstalled,false,"Firebase initialized before privacy consent");assert.equal(freshPack.authOverlay,false);assert.equal(freshPack.recordHash,manifest.firstPlay.manifestHash);assert.equal(freshPack.recordBytes,manifest.firstPlay.totalBytes);assert.equal(freshPack.portraitReady,true,"Creation portrait was not render-ready before account flow");assert.equal(freshPack.hasAppShell,true);assert.equal(freshPack.hasGameplay,true);assert.equal(freshPack.hasPatrol,true);evidence.checks.firstPlayFresh=freshPack;
    await client.eval(\`(()=>{const gate=document.getElementById("privacyConsentGate");const consent=gate.contentWindow.document;const policy=consent.getElementById("policyFrame");const root=policy.contentDocument.scrollingElement||policy.contentDocument.documentElement;policy.contentWindow.scrollTo(0,root.scrollHeight);policy.contentWindow.dispatchEvent(new Event("scroll"));})()\`);
    await waitFor(client,"document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').disabled===false","privacy agree enabled");
    await client.eval(\`document.getElementById("privacyConsentGate").contentWindow.document.getElementById("agreeButton").click()\`);
    await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","fresh privacy acceptance opens auth");
    evidence.checks.firstPlayPrivacyAccepted=await client.eval(\`JSON.parse(localStorage.getItem("four_symbols_privacy_consent"))\`);
    assert.equal(evidence.checks.firstPlayPrivacyAccepted.privacyPolicyVersion,"2026-09-11-v2");

    // CASE 3: a stale manifest gets a differential update. The 5+5 branding
    // finishes first, but scene 2 remains visible until the deliberately slow
    // changed asset completes.
    await clear();const updateStarted=Date.now();await navigate("manifest-update");await sleep(10100);
    const updateHold=await client.eval(\`(()=>({scene:document.getElementById("startupLoader").dataset.scene,hidden:document.getElementById("startupLoader").hidden,title:document.getElementById("startupStatusTitle").textContent,percent:Number(document.getElementById("startupProgress").getAttribute("aria-valuenow")),authShown:document.getElementById("firebaseAuthOverlay")?.classList.contains("show")||false}))()\`);
    assert.equal(updateHold.scene,"city");assert.equal(updateHold.hidden,false);assert.match(updateHold.title,/更新必要資源/);assert.ok(updateHold.percent<100);assert.equal(updateHold.authShown,false);evidence.checks.manifestUpdateHold={...updateHold,elapsedMs:Date.now()-updateStarted};
    await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","manifest update completion",30000);
    const updatedRecord=await client.eval(\`JSON.parse(localStorage.getItem("four_symbols_first_play_ready"))\`);assert.equal(updatedRecord.manifestHash,manifest.firstPlay.manifestHash);evidence.checks.manifestUpdateReady={manifestHash:updatedRecord.manifestHash};

    // CASE 4a: HTTP failure blocks auth and exposes a failed-only retry.
    await clear();await navigate("resource-404");await waitFor(client,"!document.getElementById('startupRetryButton').hidden","First Play HTTP retry",30000);
    const httpFail=await client.eval(\`(()=>({state:FourSymbolsStartupPolicy.getState(),title:document.getElementById("startupStatusTitle").textContent,failed:FourSymbolsFirstPlay.getLastFailed(),authShown:document.getElementById("firebaseAuthOverlay")?.classList.contains("show")||false}))()\`);assert.equal(httpFail.state,"BOOT_LOADING");assert.match(httpFail.title,/部分必要資源載入失敗/);assert.equal(httpFail.authShown,false);assert.equal(httpFail.failed.length,1);assert.match(httpFail.failed[0].path,/nav-home\\.png$/);evidence.checks.resource404=httpFail;
    await client.eval(\`document.getElementById("startupRetryButton").click()\`);await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","HTTP failed-only retry completion",30000);

    // CASE 4b: actual Image.decode() rejection is also fatal until retried.
    await clear();await navigate("decode-fail");await waitFor(client,"!document.getElementById('startupRetryButton').hidden","First Play decode retry",30000);
    const decodeFail=await client.eval(\`(()=>({failed:FourSymbolsFirstPlay.getLastFailed(),authShown:document.getElementById("firebaseAuthOverlay")?.classList.contains("show")||false,record:localStorage.getItem("four_symbols_first_play_ready")}))()\`);assert.equal(decodeFail.authShown,false);assert.equal(decodeFail.record,null);assert.ok(decodeFail.failed.some(item=>/decode/i.test(item.message)),"Decode failure was not surfaced");evidence.checks.decodeFailure=decodeFail;
    await client.eval(\`document.getElementById("startupRetryButton").click()\`);await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","decode failed-only retry completion",30000);

    // CASE 6: an older privacy version is not accepted for this release.
    await clear();await navigate("privacy-update");await waitFor(client,"document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden","updated privacy gate",30000);
    const privacyUpdate=await client.eval(\`(()=>({state:FourSymbolsStartupPolicy.getState(),authInstalled:!!window.FourSymbolsFirebaseLifecycle,stored:JSON.parse(localStorage.getItem("four_symbols_privacy_consent"))}))()\`);assert.equal(privacyUpdate.state,"BOOT_LOADING");assert.equal(privacyUpdate.authInstalled,false);assert.equal(privacyUpdate.stored.privacyPolicyVersion,"2026-09-10-v1");evidence.checks.privacyVersionUpdate=privacyUpdate;
    await client.eval(\`(()=>{const consent=document.getElementById("privacyConsentGate").contentWindow.document;const policy=consent.getElementById("policyFrame");const root=policy.contentDocument.scrollingElement||policy.contentDocument.documentElement;policy.contentWindow.scrollTo(0,root.scrollHeight);policy.contentWindow.dispatchEvent(new Event("scroll"));})()\`);await waitFor(client,"document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').disabled===false","updated privacy agreement enabled");await client.eval(\`document.getElementById("privacyConsentGate").contentWindow.document.getElementById("agreeButton").click()\`);await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","updated privacy accepted");

    // CASE 2 / normal regression matrix starts from a current First Play record.
    await clear();await navigate("signed-out");`;
replaceOnce(initialAnchor,firstPlayCases);

replaceOnce(
'    assert.deepEqual(signedOut.featureResources,[],"Signed-out Critical Boot fetched an authenticated/gameplay feature");',
'    assert.ok(signedOut.featureResources.some(name=>/app-shell/.test(name)),"First Play did not warm app-shell");assert.ok(signedOut.featureResources.some(name=>/gameplay-core/.test(name)),"First Play did not warm gameplay-core");assert.ok(signedOut.featureResources.some(name=>/feature-patrol/.test(name)),"First Play did not warm patrol");assert.equal(signedOut.featureResources.some(name=>/feature-(?:abyss|skill|boss-relic)/.test(name)),false,"First Play eagerly fetched a deep optional feature");'
);
replaceOnce(
'    assert.equal(accountA.uid,"uid-A");assert.equal(accountA.playerId,"角色-A");assert.equal(accountA.gold,1111);assert.equal(accountA.sharedExp,111);assert.equal(accountA.item,"qa-token-A");assert.equal(accountA.equipment,"qa-blade-A");assert.equal(accountA.creation,"none");assert.notEqual(accountA.game,"none");assert.deepEqual(accountA.gameplayBeforeCity,[]);',
'    assert.equal(accountA.uid,"uid-A");assert.equal(accountA.playerId,"角色-A");assert.equal(accountA.gold,1111);assert.equal(accountA.sharedExp,111);assert.equal(accountA.item,"qa-token-A");assert.equal(accountA.equipment,"qa-blade-A");assert.equal(accountA.creation,"none");assert.notEqual(accountA.game,"none");assert.ok(accountA.gameplayBeforeCity.some(path=>/gameplay-core/.test(path)),"First Play gameplay core was not warmed before city");assert.equal(accountA.gameplayBeforeCity.some(path=>/feature-(?:abyss|skill|boss-relic)/.test(path)),false,"Deep optional feature loaded before city");'
);
replaceOnce(
'    const beforePatrol=await client.eval(`performance.getEntriesByType("resource").filter(entry=>new URL(entry.name).pathname.includes("/assets/characters/patrol/patrol-")).length`);assert.equal(beforePatrol,0,"Patrol art loaded before patrol feature");',
'    const beforePatrol=await client.eval(`performance.getEntriesByType("resource").filter(entry=>new URL(entry.name).pathname.includes("/assets/characters/patrol/patrol-")).length`);assert.ok(beforePatrol>0,"First Play did not prepare immediate patrol art");'
);
replaceOnce(
'    assert.ok(evidence.performance.warmExisting.readyMs>0&&evidence.performance.warmExisting.readyMs<=3000,"Controlled warm main-city budget exceeded");',
'    assert.ok(evidence.performance.warmExisting.readyMs>=9800&&evidence.performance.warmExisting.readyMs<=15000,"Warm returning main city did not respect the deliberate 5s + 5s brand opening");'
);
replaceOnce(
'    console.log(`✓ Boot architecture mobile browser QA passed (cold auth ${evidence.performance.coldAuth.readyMs}ms; warm city ${evidence.performance.warmExisting.readyMs}ms)`);',
'    console.log(`✓ Boot / First Play mobile browser QA passed (pack ${manifest.firstPlay.totalResources} resources / ${manifest.firstPlay.totalBytes} bytes; returning auth ${evidence.performance.coldAuth.readyMs}ms; warm city ${evidence.performance.warmExisting.readyMs}ms)`);'
);

fs.writeFileSync(file,source);
console.log("Applied explicit First Play / privacy / retry browser QA cases.");
