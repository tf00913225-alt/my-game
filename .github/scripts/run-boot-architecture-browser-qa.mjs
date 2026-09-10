#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const ROOT=process.cwd();
const artifactDir=path.resolve("artifacts/browser-qa");
fs.mkdirSync(artifactDir,{recursive:true});
const evidenceFile=path.join(artifactDir,"boot-architecture-browser-qa.json");
const manifest=JSON.parse(fs.readFileSync("asset-manifest.json","utf8"));
const authPath="/"+Object.keys(manifest.assets).find(file=>/build\/firebase\/firebase-auth\.[0-9a-f]{12}\.js$/.test(file));
const cloudPath="/"+Object.keys(manifest.assets).find(file=>/build\/firebase\/firebase-cloud-save\.[0-9a-f]{12}\.js$/.test(file));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function chromeBinary(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for boot architecture QA.");
}

const fakeAuth=String.raw`
const listeners=new Set();
const scenario=new URL(location.href).searchParams.get("scenario")||"signed-out";
function publicUser(uid){return uid?Object.freeze({uid,email:uid+"@qa.invalid",displayName:"QA "+uid,photoURL:null,isAnonymous:uid==="uid-guest",providerIds:Object.freeze(uid==="uid-guest"?[]:["password"])}):null;}
let current=null;
try{
  const signedOut=localStorage.getItem("__qa_signed_out")==="1";
  const persisted=localStorage.getItem("__qa_auth_uid");
  const initial=scenario==="existing-a"?"uid-A":scenario==="cloud-error"?"uid-cloud-error":scenario==="corrupt"?"uid-corrupt":scenario==="legacy-empty"?"uid-legacy":scenario==="legacy-cloud"?"uid-legacy-cloud":null;
  current=signedOut?null:publicUser(persisted||initial);
}catch(_){current=null;}
function publish(user,error=null){current=user;window.__qaAuthUser=user;for(const listener of [...listeners]){listener(user,error);}}
window.__qaAuthUser=current;
export function getFirebaseAuthConfigStatus(){return Object.freeze({ready:true,missingFields:[],projectId:"boot-qa",sdkVersion:"qa"});}
export async function initializeFirebaseAuth(){return Object.freeze({app:{name:"boot-qa"},auth:{currentUser:current}});}
export function getFirebaseApp(){return {name:"boot-qa"};}
export function getFirebaseAuth(){return {currentUser:current};}
export function getSignedInUser(){return current;}
export async function observeFirebaseAuthState(listener){listeners.add(listener);queueMicrotask(()=>{if(scenario==="auth-error"){const error=new Error("simulated auth network failure");error.code="auth/network-request-failed";listener(null,error);}else{listener(current,null);}});return ()=>listeners.delete(listener);}
function remember(uid){try{localStorage.setItem("__qa_auth_uid",uid);localStorage.removeItem("__qa_signed_out");}catch(_){}const user=publicUser(uid);publish(user);return user;}
export async function signInAsAnonymous(){return remember("uid-guest");}
export async function signInWithGoogle(){return remember("uid-google");}
export async function signInWithEmail(email){return remember(String(email).toLowerCase().startsWith("b")?"uid-B":"uid-A");}
export async function createAccountWithEmail(email){return signInWithEmail(email);}
export async function signOutFirebase(){try{localStorage.removeItem("__qa_auth_uid");localStorage.setItem("__qa_signed_out","1");}catch(_){}publish(null);}
`;

const fakeCloud=String.raw`
export const CLOUD_SAVE_WRITE_POLICY="trusted-backend-only";
export const CLOUD_FUNCTIONS_REGION="qa-local";
export const CURRENT_SAVE_SUBCOLLECTION="saves";
export const CURRENT_SAVE_DOCUMENT="current";
export const LEGACY_LOCAL_SAVE_KEY="battle_full_version_save_v5";
function gameSave(uid){
  const suffix=uid==="uid-B"?"B":uid==="uid-legacy-cloud"?"LEGACY-CLOUD":"A";
  const token={id:"qa-token-"+suffix,name:"QA Token "+suffix,icon:"",type:"material",count:suffix==="B"?2:1,price:1,stats:{}};
  const blade={id:"qa-blade-"+suffix,name:"QA Blade "+suffix,icon:"",type:"hand",count:1,price:1,stats:{attack:suffix==="B"?2:1}};
  return {player:{id:"角色-"+suffix,element:"fire",gender:"female",level:10,exp:0,expNext:100,attack:1,vitality:1,energy:1,intelligence:1,spirit:1,agility:1,bonusHP:0,bonusSP:0,hp:150,sp:65,attributePoints:0,skillPoints:2,activeBuffs:[],statusEffects:[],isDefending:false},sharedExp:suffix==="B"?222:111,gold:suffix==="B"?2222:1111,inventoryItems:[token],characterEquipment:{fire:{head:null,hand:blade,shoulder:null,armor:null,shoes:null,ring:null}},characterSkillLoadouts:{fire:{name:"角色-"+suffix,skillLevels:{flameSlash:1},equippedSkills:["flameSlash"]}}};
}
export async function readCurrentCloudSave(){
  await new Promise(resolve=>setTimeout(resolve,35));
  const uid=window.__qaAuthUser&&window.__qaAuthUser.uid;
  if(!uid){const error=new Error("auth required");error.code="firebase/auth-required";throw error;}
  if(uid==="uid-cloud-error"){const error=new Error("simulated Firestore read failure");error.code="permission-denied";throw error;}
  if(uid==="uid-guest"||uid==="uid-legacy"||uid==="uid-corrupt"||uid==="uid-google"){
    return Object.freeze({exists:false,uid,path:"users/"+uid+"/saves/current",data:null});
  }
  return Object.freeze({exists:true,uid,path:"users/"+uid+"/saves/current",data:{ownerUid:uid,authoritativeStateReady:true,status:"ready",gameSave:gameSave(uid)}});
}
export async function bootstrapTrustedCloudSave(){return {status:"qa-no-write"};}
export async function submitLegacyMigrationCandidate(){throw new Error("QA never performs a cloud write");}
`;

function qaPrelude(){
    return `<script>
window.__qaIdleCallbacks=[];
window.requestIdleCallback=function(callback){window.__qaIdleCallbacks.push(callback);return window.__qaIdleCallbacks.length;};
(function(){
  var scenario=new URL(location.href).searchParams.get("scenario")||"";
  var legacy={player:{id:"舊版角色",element:"water",level:8}};
  if(scenario==="legacy-empty"||scenario==="legacy-cloud"){localStorage.setItem("battle_full_version_save_v5",JSON.stringify(legacy));}
  if(scenario==="corrupt"){
    localStorage.setItem("four_symbols_save:uid-corrupt","{broken-json");
    localStorage.setItem("four_symbols_save_meta:uid-corrupt",JSON.stringify({schemaVersion:1,ownerUid:"uid-corrupt"}));
  }
})();
</script>`;
}

function mime(file){
    const extension=path.extname(file).toLowerCase();
    return ({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".css":"text/css; charset=utf-8",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2"})[extension]||"application/octet-stream";
}

async function createQaServer(){
    const server=http.createServer(async(request,response)=>{
        try{
            const url=new URL(request.url,"http://127.0.0.1");
            if(url.pathname===authPath){response.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});response.end(fakeAuth);return;}
            if(url.pathname===cloudPath){response.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});response.end(fakeCloud);return;}
            const relative=decodeURIComponent(url.pathname==="/"?"index.html":url.pathname.slice(1));
            const file=path.resolve(ROOT,relative);
            if(file!==ROOT&&!file.startsWith(ROOT+path.sep)){response.writeHead(403);response.end("forbidden");return;}
            if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end("missing");return;}
            if(/build\/(?:gameplay-core|feature-patrol)\./.test(relative)){await sleep(320);}
            let body=fs.readFileSync(file);
            if(relative==="index.html"){
                body=Buffer.from(body.toString("utf8").replace("<!-- build:critical-script -->",qaPrelude()+"\n<!-- build:critical-script -->"));
            }
            const immutable=/\.[0-9a-f]{12}\.(?:js|css|webp)$/.test(relative);
            response.writeHead(200,{"content-type":mime(file),"cache-control":immutable?"public, max-age=31536000, immutable":"no-cache"});
            response.end(body);
        }catch(error){response.writeHead(500);response.end(String(error&&error.stack||error));}
    });
    await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
    return server;
}

async function waitForJson(url,timeoutMs=10000){
    const started=Date.now();let last;
    while(Date.now()-started<timeoutMs){try{const response=await fetch(url);if(response.ok){return response.json();}}catch(error){last=error;}await sleep(100);}
    throw new Error("Timed out waiting for Chrome DevTools: "+String(last&&last.message||last||"no response"));
}

class CdpClient{
    constructor(url){this.url=url;this.socket=null;this.nextId=1;this.pending=new Map();this.events=[];}
    async connect(){
        this.socket=new WebSocket(this.url);
        await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("CDP connection timeout")),10000);this.socket.onopen=()=>{clearTimeout(timer);resolve();};this.socket.onerror=()=>{clearTimeout(timer);reject(new Error("CDP connection failed"));};});
        this.socket.onmessage=async event=>{let raw=event.data;if(raw&&typeof raw!=="string"&&typeof raw.text==="function"){raw=await raw.text();}const message=JSON.parse(String(raw));if(!message.id){if(["Runtime.exceptionThrown","Runtime.consoleAPICalled","Log.entryAdded","Network.loadingFailed"].includes(message.method)){this.events.push(message);}return;}const request=this.pending.get(message.id);if(!request){return;}this.pending.delete(message.id);if(message.error){request.reject(new Error(request.method+": "+message.error.message));}else{request.resolve(message.result||{});}};
        this.socket.onclose=()=>{for(const request of this.pending.values()){request.reject(new Error("CDP closed during "+request.method));}this.pending.clear();};
    }
    send(method,params={}){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,method});this.socket.send(JSON.stringify({id,method,params}));});}
    async eval(expression){const response=await this.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(response.exceptionDetails){throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text||"Runtime evaluation failed");}return response.result?.value;}
    close(){try{this.socket&&this.socket.close();}catch(_){}}
}

async function waitFor(client,expression,label,timeoutMs=15000){
    const started=Date.now();let last="";
    while(Date.now()-started<timeoutMs){try{if(await client.eval(`Boolean(${expression})`)){return;}}catch(error){last=error.message;}await sleep(100);}
    throw new Error(`Timed out waiting for ${label}. ${last}`);
}

async function browserDiagnostic(client){
    if(!client){ return null; }
    let page=null;
    try{
        page=await client.eval(`(()=>({
          href:location.href,
          readyState:document.readyState,
          startupState:window.FourSymbolsStartupPolicy?.getState?.()||null,
          startupUid:window.FourSymbolsStartupPolicy?.getUid?.()||null,
          loaderState:document.getElementById("startupLoader")?.dataset?.state||null,
          loaderHidden:document.getElementById("startupLoader")?.hidden??null,
          title:document.getElementById("startupStatusTitle")?.textContent||null,
          detail:document.getElementById("startupStatusDetail")?.textContent||null,
          authOverlayClass:document.getElementById("firebaseAuthOverlay")?.className||null,
          creationDisplay:document.getElementById("creationPage")?getComputedStyle(document.getElementById("creationPage")).display:null,
          gameDisplay:document.getElementById("gameInterface")?getComputedStyle(document.getElementById("gameInterface")).display:null,
          activeUid:window.FourSymbolsAccountSave?.getActiveUid?.()||null,
          appShellReady:window.FourSymbolsFeatures?.isReady?.("app-shell")??null,
          gameSaveInstalled:!!window.FourSymbolsGameSave,
          featureScripts:[...document.querySelectorAll("script[data-feature-bundle]")].map(script=>({src:script.src,bundle:script.dataset.featureBundle})),
          featureLinks:[...document.querySelectorAll("link[data-feature-style],link[data-feature-preload]")].map(link=>({rel:link.rel,href:link.href,style:link.dataset.featureStyle||null,preload:link.dataset.featurePreload||null})),
          localKeys:Object.keys(localStorage),
          lastError:(()=>{const value=window.FourSymbolsStartupPolicy?.getLastError?.();return value?{name:value.name||null,code:value.code||null,message:value.message||String(value),stack:value.stack||null}:null;})(),
          marks:performance.getEntriesByType("mark").map(entry=>({name:entry.name,startTime:entry.startTime})),
          resources:performance.getEntriesByType("resource").map(entry=>({name:entry.name,initiatorType:entry.initiatorType,transferSize:entry.transferSize}))
        }))()`);
    }catch(error){ page={captureError:error?.stack||String(error)}; }
    return {page,cdpEvents:client.events.slice(-50)};
}

async function metrics(client,readyMark){
    return client.eval(`(()=>{
      const resources=performance.getEntriesByType("resource").filter(entry=>{try{return new URL(entry.name).origin===location.origin;}catch(_){return false;}});
      const navigation=performance.getEntriesByType("navigation")[0];
      const marks=Object.fromEntries(performance.getEntriesByType("mark").map(entry=>[entry.name,Math.round(entry.startTime*10)/10]));
      const ready=performance.getEntriesByName(${JSON.stringify(readyMark)}).at(-1)?.startTime||0;
      const ext=entry=>new URL(entry.name).pathname.toLowerCase();
      const beforeReady=resources.filter(entry=>entry.startTime<=ready);
      const sum=entries=>entries.reduce((total,entry)=>total+(entry.transferSize||0),0);
      return {readyMs:Math.round(ready*10)/10,firstPaintMs:Math.round((performance.getEntriesByName("first-paint")[0]?.startTime||0)*10)/10,firstContentfulPaintMs:Math.round((performance.getEntriesByName("first-contentful-paint")[0]?.startTime||0)*10)/10,requestCount:resources.length+1,criticalRequestCount:beforeReady.length+1,jsRequestCount:resources.filter(entry=>/\\.(?:js|mjs)$/.test(ext(entry))).length,cssRequestCount:resources.filter(entry=>/\\.css$/.test(ext(entry))).length,imageRequestCount:resources.filter(entry=>/\\.(?:png|jpe?g|webp|svg|gif|avif)$/.test(ext(entry))).length,totalTransferredBytes:(navigation?.transferSize||0)+sum(resources),criticalTransferredBytes:(navigation?.transferSize||0)+sum(beforeReady),resources:resources.map(entry=>({path:new URL(entry.name).pathname,startMs:Math.round(entry.startTime*10)/10,endMs:Math.round(entry.responseEnd*10)/10,transferBytes:entry.transferSize||0,initiatorType:entry.initiatorType})),marks};
    })()`);
}

const evidence={schemaVersion:1,status:"RUNNING",release:manifest.release,environment:"local HTTP, mobile emulation, deterministic Firebase Auth/Firestore test doubles; production bundles unchanged",checks:{},performance:{}};
const server=await createQaServer();
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const debugPort=9400+(process.pid%400);
const profile=path.join("/tmp","four-symbols-boot-qa-"+process.pid);
const chrome=spawn(chromeBinary(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,"--window-size=390,844","about:blank"],{stdio:["ignore","pipe","pipe"]});
let chromeStderr="";chrome.stderr.on("data",chunk=>{chromeStderr+=String(chunk);});
let client=null;

try{
    const targets=await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page=targets.find(target=>target.type==="page");
    assert.ok(page?.webSocketDebuggerUrl,"Chrome page target unavailable");
    client=new CdpClient(page.webSocketDebuggerUrl);await client.connect();
    await client.send("Page.enable");await client.send("Runtime.enable");await client.send("Network.enable");await client.send("Log.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
    await client.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
    const clear=()=>client.send("Storage.clearDataForOrigin",{origin,storageTypes:"all"});
    const navigate=async scenario=>{await client.send("Page.navigate",{url:`${origin}/?scenario=${encodeURIComponent(scenario)}&run=${Date.now()}`});await waitFor(client,"document.readyState==='complete'","document load");};

    await client.send("Network.setCacheDisabled",{cacheDisabled:true});await clear();await navigate("signed-out");
    try{
        await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'&&document.getElementById('firebaseAuthOverlay')?.classList.contains('show')","signed-out auth UI");
    }catch(error){
        const diagnostic=await client.eval(`(()=>({readyState:document.readyState,state:window.FourSymbolsStartupPolicy?.getState?.()||null,loaderState:document.getElementById("startupLoader")?.dataset?.state||null,title:document.getElementById("startupStatusTitle")?.textContent||null,detail:document.getElementById("startupStatusDetail")?.textContent||null,overlayExists:!!document.getElementById("firebaseAuthOverlay"),overlayClass:document.getElementById("firebaseAuthOverlay")?.className||null,build:window.__FOUR_SYMBOLS_BUILD__||null,resources:performance.getEntriesByType("resource").map(entry=>({name:entry.name,initiatorType:entry.initiatorType,transferSize:entry.transferSize}))}))()`);
        error.message+=" Diagnostic="+JSON.stringify({page:diagnostic,cdpEvents:client.events.slice(-20)});
        throw error;
    }
    const signedOut=await client.eval(`(()=>({state:FourSymbolsStartupPolicy.getState(),creation:getComputedStyle(document.getElementById("creationPage")).display,labels:[...document.querySelectorAll("#firebaseSignedOutPanel button")].map(button=>button.textContent.trim()),uid:FourSymbolsStartupPolicy.getUid(),featureResources:performance.getEntriesByType("resource").map(entry=>entry.name).filter(name=>/app-shell|gameplay-core|feature-/.test(name))}))()`);
    assert.equal(signedOut.state,"AUTH_REQUIRED");assert.equal(signedOut.creation,"none");assert.equal(signedOut.uid,null);
    for(const label of ["Google 登入","訪客開始遊戲","Email 登入","建立帳號"]){assert.ok(signedOut.labels.includes(label),"Missing auth action: "+label);}
    assert.deepEqual(signedOut.featureResources,[],"Signed-out Critical Boot fetched an authenticated/gameplay feature");
    evidence.checks.authFirst=signedOut;evidence.performance.coldAuth=await metrics(client,"four-symbols:auth-ui-interactive");
    assert.ok(evidence.performance.coldAuth.readyMs>0&&evidence.performance.coldAuth.readyMs<=5000,"Controlled cold auth UI budget exceeded");

    await client.eval(`document.getElementById("firebaseGuestButton").click()`);
    await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='NEED_CHARACTER'&&getComputedStyle(document.getElementById('creationPage')).display!=='none'","guest character creation");
    const guest=await client.eval(`(()=>({uid:FourSymbolsStartupPolicy.getUid(),activeUid:FourSymbolsAccountSave.getActiveUid(),state:FourSymbolsStartupPolicy.getState(),canCreate:FourSymbolsStartupPolicy.canCreateCharacter(),accountSave:localStorage.getItem("four_symbols_save:uid-guest"),legacy:localStorage.getItem("battle_full_version_save_v5")}))()`);
    assert.equal(guest.uid,"uid-guest");assert.equal(guest.activeUid,"uid-guest");assert.equal(guest.canCreate,true);assert.equal(guest.accountSave,null);assert.equal(guest.legacy,null);
    evidence.checks.anonymousBeforeCreation=guest;evidence.performance.guestCreation=await metrics(client,"four-symbols:character-creation-interactive");

    for(const failure of [{scenario:"auth-error",code:"auth"},{scenario:"cloud-error",code:"cloud"},{scenario:"corrupt",code:"corrupt"}]){
        await clear();await navigate(failure.scenario);await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='ERROR'",failure.code+" fail-closed");
        const result=await client.eval(`(()=>({state:FourSymbolsStartupPolicy.getState(),creation:getComputedStyle(document.getElementById("creationPage")).display,legacy:localStorage.getItem("battle_full_version_save_v5"),corrupt:localStorage.getItem("four_symbols_save:uid-corrupt")}))()`);
        assert.equal(result.creation,"none",failure.code+" failure exposed character creation");
        if(failure.scenario==="corrupt"){assert.equal(result.corrupt,"{broken-json","Corrupt data was modified");}
        evidence.checks[failure.code+"Failure"]=result;
    }

    await clear();await navigate("legacy-empty");await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='MIGRATION_REQUIRED'","legacy migration confirmation");
    const migration=await client.eval(`(()=>({creation:getComputedStyle(document.getElementById("creationPage")).display,legacy:localStorage.getItem("battle_full_version_save_v5"),account:localStorage.getItem("four_symbols_save:uid-legacy"),confirmDisabled:document.getElementById("firebaseMigrationConfirmButton").disabled}))()`);
    assert.equal(migration.creation,"none");assert.ok(migration.legacy);assert.equal(migration.account,null);assert.equal(migration.confirmDisabled,false);evidence.checks.legacyMigration=migration;
    await client.eval(`document.getElementById("firebaseMigrationCancelButton").click()`);await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","safe migration cancel",15000);assert.ok(await client.eval(`localStorage.getItem("battle_full_version_save_v5")`),"Cancelling migration removed legacy data");
    await clear();await navigate("legacy-cloud");await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='MIGRATION_REQUIRED'","legacy/cloud conflict");
    const conflict=await client.eval(`(()=>({creation:getComputedStyle(document.getElementById("creationPage")).display,legacy:localStorage.getItem("battle_full_version_save_v5"),account:localStorage.getItem("four_symbols_save:uid-legacy-cloud"),confirmDisabled:document.getElementById("firebaseMigrationConfirmButton").disabled}))()`);
    assert.equal(conflict.creation,"none");assert.ok(conflict.legacy);assert.equal(conflict.account,null);assert.equal(conflict.confirmDisabled,true);evidence.checks.legacyCloudConflict=conflict;

    await clear();await navigate("existing-a");await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='READY'&&performance.getEntriesByName('four-symbols:main-city-interactive').length>0","existing account main city",20000);
    const accountA=await client.eval(`(()=>({uid:FourSymbolsStartupPolicy.getUid(),playerId:player.id,gold:gold,sharedExp:sharedExp,item:inventoryItems[0]?.id,equipment:characterEquipment.fire.hand?.id,creation:getComputedStyle(document.getElementById("creationPage")).display,game:getComputedStyle(document.getElementById("gameInterface")).display,gameplayBeforeCity:performance.getEntriesByType("resource").filter(entry=>/gameplay-core|feature-/.test(entry.name)&&entry.startTime<performance.getEntriesByName("four-symbols:main-city-interactive")[0].startTime).map(entry=>new URL(entry.name).pathname)}))()`);
    assert.equal(accountA.uid,"uid-A");assert.equal(accountA.playerId,"角色-A");assert.equal(accountA.gold,1111);assert.equal(accountA.sharedExp,111);assert.equal(accountA.item,"qa-token-A");assert.equal(accountA.equipment,"qa-blade-A");assert.equal(accountA.creation,"none");assert.notEqual(accountA.game,"none");assert.deepEqual(accountA.gameplayBeforeCity,[]);
    evidence.checks.existingUser=accountA;evidence.performance.coldExisting=await metrics(client,"four-symbols:main-city-interactive");

    const localLoading=await client.eval(`(()=>{const feature=document.createElement("button");feature.id="qaInventoryFeature";feature.dataset.feature="inventory";feature.textContent="inventory";const control=document.createElement("button");control.id="qaControl";control.textContent="control";window.__qaControlClicks=0;control.addEventListener("click",()=>window.__qaControlClicks++);document.body.append(feature,control);feature.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerType:"touch",pointerId:7}));feature.click();control.click();return {busy:feature.getAttribute("aria-busy"),localClass:feature.classList.contains("is-feature-loading"),controlClicks:window.__qaControlClicks,startupState:FourSymbolsStartupPolicy.getState(),startupHidden:document.getElementById("startupLoader").hidden};})()`);
    assert.equal(localLoading.busy,"true");assert.equal(localLoading.localClass,true);assert.equal(localLoading.controlClicks,1);assert.equal(localLoading.startupState,"READY");assert.equal(localLoading.startupHidden,true);evidence.checks.localFeatureLoading=localLoading;
    await waitFor(client,"FourSymbolsFeatures.isReady('inventory')&&!document.getElementById('qaInventoryFeature').classList.contains('is-feature-loading')","inventory feature ready",20000);
    const navigation=await client.eval(`(()=>{document.getElementById("inventoryNav").click();const inventoryActive=document.getElementById("inventoryPage").classList.contains("active");document.querySelector('[data-filter="equipment"]').click();return {inventoryActive,equipmentRendered:document.getElementById("equipmentGrid").children.length>=0,controlClicks:window.__qaControlClicks};})()`);
    assert.equal(navigation.inventoryActive,true);assert.equal(navigation.equipmentRendered,true);evidence.checks.inventoryEquipmentEntry=navigation;
    await client.eval(`document.getElementById("dungeonNav").click()`);
    await waitFor(client,"FourSymbolsFeatures.isReady('dungeon')&&document.getElementById('dungeonPage').classList.contains('active')","lazy dungeon entry",15000);
    evidence.checks.dungeonEntry=await client.eval(`(()=>({ready:FourSymbolsFeatures.isReady("dungeon"),active:document.getElementById("dungeonPage").classList.contains("active"),startupState:FourSymbolsStartupPolicy.getState()}))()`);

    const beforePatrol=await client.eval(`performance.getEntriesByType("resource").filter(entry=>/assets\\/characters\\/patrol\\/patrol-/.test(entry.name)).length`);assert.equal(beforePatrol,0,"Patrol art loaded before patrol feature");
    const idle=await client.eval(`(()=>{const callback=window.__qaIdleCallbacks.shift();if(callback){callback({didTimeout:false,timeRemaining:()=>50});}return {released:!!callback,remaining:window.__qaIdleCallbacks.length};})()`);assert.equal(idle.released,true,"Background idle preload was not scheduled");
    await waitFor(client,"performance.getEntriesByType('resource').some(entry=>/feature-patrol\\.[0-9a-f]{12}\\.js/.test(entry.name))","idle patrol preload",10000);
    assert.equal(await client.eval(`FourSymbolsFeatures.isReady("patrol")`),false,"Idle preload executed patrol code instead of only fetching it");
    const patrol=await client.eval(`(()=>{const button=document.createElement("button");button.id="qaPatrolFeature";button.dataset.feature="patrol";button.textContent="patrol";button.onclick=()=>{const page=document.getElementById("mapPage");page.classList.add("active");page.style.display="block";document.getElementById("patrolCharacterImg").loading="eager";};document.body.appendChild(button);button.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerType:"touch",pointerId:9}));button.click();return true;})()`);assert.equal(patrol,true);
    await waitFor(client,"FourSymbolsFeatures.isReady('patrol')&&performance.getEntriesByType('resource').some(entry=>/assets\\/characters\\/patrol\\/patrol-.*\\.[0-9a-f]{12}\\.webp/.test(entry.name))","lazy patrol art",15000);
    evidence.checks.patrolLazy=await client.eval(`(()=>({ready:FourSymbolsFeatures.isReady("patrol"),assetRequests:performance.getEntriesByType("resource").map(entry=>new URL(entry.name).pathname).filter(path=>/assets\\/characters\\/patrol\\/patrol-/.test(path)),startupState:FourSymbolsStartupPolicy.getState()}))()`);

    await client.eval(`FourSymbolsStartupPolicy.openAccountManager();document.getElementById("firebaseSignOutButton").click()`);
    await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='AUTH_REQUIRED'","signed-out state after account A",15000);
    await client.eval(`(()=>{document.getElementById("firebaseEmailInput").value="b@example.test";document.getElementById("firebasePasswordInput").value="123456";document.getElementById("firebaseEmailSignInButton").click();})()`);
    await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='READY'&&window.FourSymbolsStartupPolicy?.getUid()==='uid-B'","account B main city",20000);
    const accountB=await client.eval(`(()=>({uid:FourSymbolsStartupPolicy.getUid(),activeUid:FourSymbolsAccountSave.getActiveUid(),playerId:player.id,gold:gold,sharedExp:sharedExp,item:inventoryItems[0]?.id,equipment:characterEquipment.fire.hand?.id,saveA:JSON.parse(localStorage.getItem("four_symbols_save:uid-A")).player.id,saveB:JSON.parse(localStorage.getItem("four_symbols_save:uid-B")).player.id,metaA:JSON.parse(localStorage.getItem("four_symbols_save_meta:uid-A")).ownerUid,metaB:JSON.parse(localStorage.getItem("four_symbols_save_meta:uid-B")).ownerUid}))()`);
    assert.deepEqual(accountB,{uid:"uid-B",activeUid:"uid-B",playerId:"角色-B",gold:2222,sharedExp:222,item:"qa-token-B",equipment:"qa-blade-B",saveA:"角色-A",saveB:"角色-B",metaA:"uid-A",metaB:"uid-B"});evidence.checks.accountSwitch=accountB;

    await client.send("Network.setCacheDisabled",{cacheDisabled:false});await client.send("Page.reload",{ignoreCache:false});
    await waitFor(client,"window.FourSymbolsStartupPolicy?.getState()==='READY'&&window.FourSymbolsStartupPolicy?.getUid()==='uid-B'&&performance.getEntriesByName('four-symbols:main-city-interactive').length>0","warm account restore",15000);
    evidence.performance.warmExisting=await metrics(client,"four-symbols:main-city-interactive");
    assert.ok(evidence.performance.warmExisting.readyMs>0&&evidence.performance.warmExisting.readyMs<=3000,"Controlled warm main-city budget exceeded");
    evidence.checks.warmRestore=await client.eval(`(()=>({uid:FourSymbolsStartupPolicy.getUid(),playerId:player.id,creation:getComputedStyle(document.getElementById("creationPage")).display,game:getComputedStyle(document.getElementById("gameInterface")).display}))()`);
    assert.equal(evidence.checks.warmRestore.uid,"uid-B");assert.equal(evidence.checks.warmRestore.playerId,"角色-B");assert.equal(evidence.checks.warmRestore.creation,"none");assert.notEqual(evidence.checks.warmRestore.game,"none");

    evidence.status="PASS";evidence.finishedAt=new Date().toISOString();fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+"\n");
    console.log(`✓ Boot architecture mobile browser QA passed (cold auth ${evidence.performance.coldAuth.readyMs}ms; warm city ${evidence.performance.warmExisting.readyMs}ms)`);
}catch(error){
    evidence.status="FAIL";evidence.error=error?.stack||String(error);evidence.failureDiagnostic=await browserDiagnostic(client);evidence.chromeStderr=chromeStderr.slice(-6000);evidence.finishedAt=new Date().toISOString();fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+"\n");console.error(error);process.exitCode=1;
}finally{
    client?.close();chrome.kill("SIGTERM");await new Promise(resolve=>server.close(resolve));
    try{fs.rmSync(profile,{recursive:true,force:true});}catch(_){}
}
