#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const baseUrl=String(process.env.DEV_BASE_URL||"https://dev.four-symbols-dev.pages.dev").replace(/\/$/,"");
const expectedSha=String(process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||"");
const qaUrl=`${baseUrl}/?boot-live-qa=${encodeURIComponent(expectedSha||Date.now())}`;
const artifactDir=path.resolve("artifacts/browser-qa");
const artifactFile=path.join(artifactDir,"boot-live-qa.json");
fs.mkdirSync(artifactDir,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function assertRevalidatedEntry(cacheControl,label){
    const value=String(cacheControl||"");
    assert.doesNotMatch(value,/immutable/i,`${label} must not be immutable`);
    const explicitlyUncached=/no-(?:cache|store)/i.test(value);
    const immediatelyStale=/max-age\s*=\s*0/i.test(value)&&/must-revalidate/i.test(value);
    assert.ok(explicitlyUncached||immediatelyStale,`${label} must be uncached or immediately revalidated; received: ${value||"<missing>"}`);
}

function chromeBinary(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){return result.stdout.trim();}
    }
    throw new Error("Headless Chrome/Chromium is required for live boot QA.");
}
async function waitForJson(url,timeoutMs=45000){const started=Date.now();while(Date.now()-started<timeoutMs){try{const response=await fetch(url);if(response.ok){return response.json();}}catch(_){}await sleep(120);}throw new Error("Chrome DevTools endpoint timed out");}
class CdpClient{
    constructor(url){this.url=url;this.socket=null;this.nextId=1;this.pending=new Map();}
    async connect(){this.socket=new WebSocket(this.url);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("CDP timeout")),10000);this.socket.onopen=()=>{clearTimeout(timer);resolve();};this.socket.onerror=()=>{clearTimeout(timer);reject(new Error("CDP connection failed"));};});this.socket.onmessage=async event=>{let raw=event.data;if(raw&&typeof raw!=="string"&&typeof raw.text==="function"){raw=await raw.text();}const message=JSON.parse(String(raw));if(!message.id){return;}const pending=this.pending.get(message.id);if(!pending){return;}this.pending.delete(message.id);if(message.error){pending.reject(new Error(pending.method+": "+message.error.message));}else{pending.resolve(message.result||{});}};}
    send(method,params={}){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,method});this.socket.send(JSON.stringify({id,method,params}));});}
    async eval(expression){const response=await this.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(response.exceptionDetails){throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text||"evaluation failed");}return response.result?.value;}
    close(){try{this.socket?.close();}catch(_){}}
}
async function waitFor(client,expression,label,timeoutMs=30000){const started=Date.now();let last="";while(Date.now()-started<timeoutMs){try{if(await client.eval(`Boolean(${expression})`)){return;}}catch(error){last=error.message;}await sleep(150);}throw new Error(`Timed out waiting for ${label}: ${last}`);}

const evidence={schemaVersion:2,status:"RUNNING",expectedSha,devUrl:baseUrl,checks:{}};
const debugPort=9800+(process.pid%150);
const profile=path.join("/tmp","four-symbols-live-boot-"+process.pid);
const child=spawn(chromeBinary(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,"--window-size=390,844","about:blank"],{stdio:["ignore","pipe","pipe"]});
let chromeStderr="";child.stderr.on("data",chunk=>{chromeStderr+=String(chunk);});let client=null;
try{
    const manifestResponse=await fetch(`${baseUrl}/asset-manifest.json?sha=${encodeURIComponent(expectedSha)}`,{cache:"no-store"});
    assert.equal(manifestResponse.ok,true,"Deployed asset manifest is unavailable");
    assertRevalidatedEntry(manifestResponse.headers.get("cache-control"),"Asset manifest");
    const manifest=await manifestResponse.json();
    assert.ok(manifest.firstPlay&&Array.isArray(manifest.firstPlay.resources),"Deployed manifest is missing First Play pack metadata");
    const indexResponse=await fetch(`${baseUrl}/index.html?sha=${encodeURIComponent(expectedSha)}`,{cache:"no-store"});
    assert.equal(indexResponse.ok,true,"Deployed index is unavailable");
    assertRevalidatedEntry(indexResponse.headers.get("cache-control"),"Index");
    evidence.firstPlay={manifestHash:manifest.firstPlay.manifestHash,totalBytes:manifest.firstPlay.totalBytes,totalResources:manifest.firstPlay.totalResources};
    evidence.checks.mutableEntryHeaders={index:indexResponse.headers.get("cache-control"),manifest:manifestResponse.headers.get("cache-control")};
    const immutableChecks={};
    for(const resource of [...manifest.critical.scripts,...manifest.critical.styles,...(manifest.critical.images||[]),manifest.critical.firebaseBootstrap]){
        const response=await fetch(`${baseUrl}/${resource}`,{cache:"no-store"});const data=Buffer.from(await response.arrayBuffer());
        const digest=crypto.createHash("sha256").update(data).digest("hex").slice(0,12);
        immutableChecks[resource]={status:response.status,cacheControl:response.headers.get("cache-control"),bytes:data.length,digest};
        assert.equal(response.ok,true,resource+" is unavailable");assert.equal(digest,manifest.assets[resource].sha256,resource+" digest mismatch");assert.match(response.headers.get("cache-control")||"",/max-age=31536000/i,resource+" is not long-cacheable");assert.match(response.headers.get("cache-control")||"",/immutable/i,resource+" is not immutable");
    }
    evidence.checks.immutableAssets=immutableChecks;
    const targets=await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);const page=targets.find(target=>target.type==="page");assert.ok(page?.webSocketDebuggerUrl);
    client=new CdpClient(page.webSocketDebuggerUrl);await client.connect();await client.send("Page.enable");await client.send("Runtime.enable");await client.send("Network.enable");await client.send("Network.setCacheDisabled",{cacheDisabled:true});await client.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});await client.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
    await client.send("Page.navigate",{url:qaUrl});await waitFor(client,"document.readyState==='complete'","live document");

    // A fresh deployed browser must finish the real First Play pack before it
    // is allowed to initialize Firebase. The privacy gate is now the expected
    // first interactive destination, not the account dialog.
    await waitFor(
        client,
        "window.FourSymbolsStartupPolicy&&(FourSymbolsStartupPolicy.getState()==='ERROR'||(document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden&&document.getElementById('startupProgress')?.getAttribute('aria-valuenow')==='100'))",
        "live First Play privacy destination",
        120000
    );
    const preConsent=await client.eval(`(()=>{const gate=document.getElementById("privacyConsentGate");const record=JSON.parse(localStorage.getItem("four_symbols_first_play_ready")||"null");const readyMark=performance.getEntriesByName("four-symbols:first-play-ready").at(-1);return {state:FourSymbolsStartupPolicy.getState(),title:document.getElementById("startupStatusTitle")?.textContent||"",detail:document.getElementById("startupStatusDetail")?.textContent||"",percent:document.getElementById("startupProgress")?.getAttribute("aria-valuenow")||null,privacyVisible:!!gate&&!gate.hidden,authInstalled:!!window.FourSymbolsFirebaseLifecycle,authVisible:document.getElementById("firebaseAuthOverlay")?.classList.contains("show")||false,creation:getComputedStyle(document.getElementById("creationPage")).display,recordHash:record&&record.manifestHash,firstPlayReadyMs:readyMark?Math.round(readyMark.startTime*10)/10:null};})()`);
    assert.equal(preConsent.state,"BOOT_LOADING","Fresh live browser did not remain in BOOT_LOADING before privacy consent");
    assert.equal(preConsent.percent,"100","First Play privacy gate appeared before verified 100%");
    assert.equal(preConsent.privacyVisible,true,"Current privacy gate is not visible after First Play readiness");
    assert.equal(preConsent.authInstalled,false,"Firebase initialized before fresh-user privacy consent");
    assert.equal(preConsent.authVisible,false,"Account UI became visible before fresh-user privacy consent");
    assert.equal(preConsent.creation,"none","Character creation became visible before account resolution");
    assert.equal(preConsent.recordHash,manifest.firstPlay.manifestHash,"First Play completion record does not match deployed manifest");
    evidence.checks.firstPlayPrivacyGate=preConsent;

    await waitFor(client,"(()=>{const gate=document.getElementById('privacyConsentGate');const policy=gate?.contentWindow?.document?.getElementById('policyFrame');return !!(policy&&policy.contentDocument&&policy.contentDocument.readyState==='complete');})()","live privacy policy document",15000);
    await client.eval(`(()=>{const gate=document.getElementById("privacyConsentGate");const consent=gate.contentWindow.document;const policy=consent.getElementById("policyFrame");const root=policy.contentDocument.scrollingElement||policy.contentDocument.documentElement;policy.contentWindow.scrollTo(0,root.scrollHeight);policy.contentWindow.dispatchEvent(new Event("scroll"));})()`);
    await waitFor(client,"document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').disabled===false","live privacy agree enabled",10000);
    const consentStarted=Date.now();
    await client.eval(`document.getElementById("privacyConsentGate").contentWindow.document.getElementById("agreeButton").click()`);
    await waitFor(client,"window.FourSymbolsStartupPolicy&&['AUTH_REQUIRED','ERROR'].includes(FourSymbolsStartupPolicy.getState())","live Firebase auth destination after privacy consent",45000);
    const authAfterConsentMs=Date.now()-consentStarted;

    const result=await client.eval(`(()=>{const resources=performance.getEntriesByType("resource").filter(entry=>{try{return new URL(entry.name).origin===location.origin;}catch(_){return false;}});const mark=performance.getEntriesByName("four-symbols:auth-ui-interactive").at(-1);const navigation=performance.getEntriesByType("navigation")[0];const consent=JSON.parse(localStorage.getItem("four_symbols_privacy_consent")||"null");return {state:FourSymbolsStartupPolicy.getState(),uid:FourSymbolsStartupPolicy.getUid(),creation:getComputedStyle(document.getElementById("creationPage")).display,authVisible:document.getElementById("firebaseAuthOverlay")?.classList.contains("show")||false,labels:[...document.querySelectorAll("#firebaseSignedOutPanel button")].map(button=>button.textContent.trim()),consentVersion:consent&&consent.privacyPolicyVersion,authUiMs:mark?Math.round(mark.startTime*10)/10:null,firstPaintMs:Math.round((performance.getEntriesByName("first-paint")[0]?.startTime||0)*10)/10,requestCount:resources.length+1,jsRequestCount:resources.filter(entry=>/\.js(?:$|\?)/.test(entry.name)).length,cssRequestCount:resources.filter(entry=>/\.css(?:$|\?)/.test(entry.name)).length,imageRequestCount:resources.filter(entry=>/\.(?:png|jpe?g|webp|svg)(?:$|\?)/.test(entry.name)).length,transferredBytes:(navigation?.transferSize||0)+resources.reduce((sum,entry)=>sum+(entry.transferSize||0),0),featureResources:resources.map(entry=>entry.name).filter(name=>/app-shell|gameplay-core|feature-/.test(name))};})()`);
    result.authAfterConsentMs=authAfterConsentMs;
    assert.equal(result.state,"AUTH_REQUIRED","Fresh live browser did not stop at account UI after privacy consent");
    assert.equal(result.uid,null);
    assert.equal(result.creation,"none");
    assert.equal(result.authVisible,true);
    assert.equal(result.consentVersion,"2026-09-11-v2","Live privacy acceptance did not store the current policy version");
    assert.ok(result.featureResources.some(name=>/app-shell/.test(name)),"First Play did not warm app-shell on live deploy");
    assert.ok(result.featureResources.some(name=>/gameplay-core/.test(name)),"First Play did not warm gameplay-core on live deploy");
    assert.ok(result.featureResources.some(name=>/feature-patrol/.test(name)),"First Play did not warm patrol on live deploy");
    assert.equal(result.featureResources.some(name=>/feature-(?:abyss|skill|boss-relic)/.test(name)),false,"First Play eagerly fetched a deep optional live feature");
    for(const label of ["Google 登入","訪客開始遊戲","Email 登入","建立帳號"]){assert.ok(result.labels.includes(label),"Missing live auth option: "+label);}
    evidence.checks.coldAuth=result;
    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});if(screenshot.data){fs.writeFileSync(path.join(artifactDir,"boot-live-auth-mobile.png"),Buffer.from(screenshot.data,"base64"));}
    evidence.status="PASS";evidence.finishedAt=new Date().toISOString();fs.writeFileSync(artifactFile,JSON.stringify(evidence,null,2)+"\n");console.log(`Live account-first boot QA: PASS (First Play ready ${preConsent.firstPlayReadyMs}ms; auth ${authAfterConsentMs}ms after privacy consent)`);
}catch(error){evidence.status="FAIL";evidence.error=error?.stack||String(error);evidence.chromeStderr=chromeStderr.slice(-6000);evidence.finishedAt=new Date().toISOString();fs.writeFileSync(artifactFile,JSON.stringify(evidence,null,2)+"\n");console.error(error);process.exitCode=1;}
finally{client?.close();child.kill("SIGTERM");try{fs.rmSync(profile,{recursive:true,force:true});}catch(_){}}
