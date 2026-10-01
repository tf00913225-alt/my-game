import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts","browser-qa");
const VIEWPORTS=[[360,640],[393,873],[412,915]];
const ASSET_MANIFEST=JSON.parse(fs.readFileSync(path.join(ROOT,"build","asset-manifest.json"),"utf8"));
const QA_AUTH_PATH="/"+Object.keys(ASSET_MANIFEST.assets).find(file=>/build\/firebase\/firebase-auth\.[0-9a-f]{12}\.js$/.test(file));
const QA_CLOUD_PATH="/"+Object.keys(ASSET_MANIFEST.assets).find(file=>/build\/firebase\/firebase-cloud-save\.[0-9a-f]{12}\.js$/.test(file));
const QA_SESSION_PATH="/"+Object.keys(ASSET_MANIFEST.assets).find(file=>/build\/firebase\/firebase-session\.[0-9a-f]{12}\.js$/.test(file));
const QA_FIRST_PLAY={gameVersion:String(ASSET_MANIFEST.release||""),manifestVersion:ASSET_MANIFEST.firstPlay.manifestVersion,assetPackVersion:ASSET_MANIFEST.firstPlay.assetPackVersion,manifestHash:ASSET_MANIFEST.firstPlay.manifestHash,completedAt:"2026-09-30T00:00:00.000Z",assets:Object.fromEntries(ASSET_MANIFEST.firstPlay.resources.map(item=>[item.path,item.sha256]))};
/* Production index, feature loader and runtime remain real.  Only external
   Firebase transport is replaced by a read-only local account so Startup can
   formally reach READY without a player account or cloud write. */
const QA_AUTH_MODULE=String.raw`const user=Object.freeze({uid:"skill-runtime-browser-qa",email:"skill-runtime-browser-qa@qa.invalid",displayName:"Skill Runtime QA",photoURL:null,isAnonymous:true,providerIds:Object.freeze([])});export function getFirebaseAuthConfigStatus(){return Object.freeze({ready:true,missingFields:[],projectId:"skill-runtime-qa",sdkVersion:"qa"});}export async function initializeFirebaseAuth(){return Object.freeze({app:{name:"skill-runtime-qa"},auth:{currentUser:user}});}export function getFirebaseApp(){return {name:"skill-runtime-qa"};}export function getFirebaseAuth(){return {currentUser:user};}export function getSignedInUser(){return user;}export function installFirebaseSessionHooks(){}export async function observeFirebaseAuthState(listener){queueMicrotask(()=>listener(user,null));return ()=>{};}export async function signInAsAnonymous(){return user;}export async function signInWithGoogle(){return user;}export async function signInWithFacebook(){return user;}export async function signInWithEmail(){return user;}export async function createAccountWithEmail(){return user;}export async function signOutFirebase(){}`;
const QA_CLOUD_MODULE=String.raw`export const CLOUD_SAVE_WRITE_POLICY="trusted-backend-only";export const CLOUD_FUNCTIONS_REGION="qa-local";export const CURRENT_SAVE_SUBCOLLECTION="saves";export const CURRENT_SAVE_DOCUMENT="current";export const LEGACY_LOCAL_SAVE_KEY="battle_full_version_save_v5";const uid="skill-runtime-browser-qa";const save={player:{id:"Skill Runtime QA",element:"fire",gender:"male",level:70,exp:0,expNext:100,attack:10,vitality:10,energy:10,intelligence:10,defensePoints:10,agility:10,bonusHP:0,bonusSP:0,hp:300,sp:120,attributePoints:0,skillPoints:999,activeBuffs:[],statusEffects:[],isDefending:false},sharedExp:0,gold:0,inventoryItems:[],characterEquipment:{fire:{head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null}},characterSkillLoadouts:{fire:{name:"Skill Runtime QA",skillLevels:{fireRocket:1},equippedSkills:[]}}};export async function readCurrentCloudSave(){return Object.freeze({exists:true,uid,path:"users/"+uid+"/saves/current",data:{ownerUid:uid,authoritativeStateReady:true,status:"ready",gameSave:save}});}export async function bootstrapTrustedCloudSave(){throw new Error("QA cloud writes are forbidden");}export async function createInitialCanonicalCharacter(){throw new Error("QA cloud writes are forbidden");}export async function saveLocalAutoBattlePreferences(){throw new Error("QA cloud writes are forbidden");}export async function submitLegacyMigrationCandidate(){throw new Error("QA cloud writes are forbidden");}export async function screenLegacyMigrationCandidate(){throw new Error("QA cloud writes are forbidden");}export function createLocalMigrationBackup(){throw new Error("QA cloud writes are forbidden");}`;
const QA_SESSION_MODULE=String.raw`export const CLOUD_FUNCTIONS_REGION="qa-local";export async function synchronizeGameSession(user){window.dispatchEvent(new CustomEvent("four-symbols:game-session-state",{detail:{uid:user?.uid||null,status:user?"ready":"signed-out",code:null}}));return {status:"ready"};}export async function callProtectedFunction(){throw new Error("QA cloud writes are forbidden");}export async function revokeGameSession(){}export const protectedTest=()=>callProtectedFunction("protectedTest");export function getGameSessionState(){return {status:"ready"};}`;
function qaPrelude(){return `<script>localStorage.setItem("four_symbols_active_uid","skill-runtime-browser-qa");localStorage.setItem("four_symbols_privacy_consent",JSON.stringify({privacyPolicyVersion:"2026-09-11-v2",acceptedAt:"2026-09-30T00:00:00.000Z"}));localStorage.setItem("four_symbols_first_play_ready",${JSON.stringify(JSON.stringify(QA_FIRST_PLAY))});</script>`;}

function findChrome(){
    const configured=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
    if(configured&&fs.existsSync(configured)){ return configured; }
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for real Skill Runtime browser QA.");
}

function mime(file){
    if(file.endsWith(".js")){ return "text/javascript"; }
    if(file.endsWith(".css")){ return "text/css"; }
    if(file.endsWith(".json")){ return "application/json"; }
    if(file.endsWith(".html")){ return "text/html"; }
    if(file.endsWith(".svg")){ return "image/svg+xml"; }
    if(file.endsWith(".webp")){ return "image/webp"; }
    if(file.endsWith(".png")){ return "image/png"; }
    if(file.endsWith(".jpg")||file.endsWith(".jpeg")){ return "image/jpeg"; }
    return "application/octet-stream";
}

async function startServer(){
    const server=http.createServer((req,res)=>{
        const pathname=decodeURIComponent(String(req.url||"/").split("?")[0]);
        const fetchDestination=String(req.headers["sec-fetch-dest"]||"");
        if(fetchDestination==="script"&&pathname===QA_AUTH_PATH){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(QA_AUTH_MODULE);return;}
        if(fetchDestination==="script"&&pathname===QA_CLOUD_PATH){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(QA_CLOUD_MODULE);return;}
        if(fetchDestination==="script"&&pathname===QA_SESSION_PATH){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(QA_SESSION_MODULE);return;}
        const relative=pathname==="/"?"index.html":pathname.replace(/^\/+/,"");
        const file=path.resolve(ROOT,relative);
        if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
            res.writeHead(404);res.end("not found");return;
        }
        res.writeHead(200,{"content-type":mime(file),"cache-control":"no-store"});
        if(relative==="index.html"){res.end(fs.readFileSync(file,"utf8").replace("<!-- build:critical-script -->",qaPrelude()+"\n<!-- build:critical-script -->"));return;}
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    return {server,url:`http://127.0.0.1:${server.address().port}/index.html`};
}

function waitJson(url){
    return new Promise((resolve,reject)=>{
        const started=Date.now();
        const poll=()=>fetch(url).then(r=>r.json()).then(resolve).catch(error=>{
            if(Date.now()-started>15000){ reject(error); }
            else{ setTimeout(poll,80); }
        });
        poll();
    });
}

class Cdp{
    constructor(url){
        this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.events=[];
        this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});
        this.ws.onmessage=event=>{
            const message=JSON.parse(String(event.data));
            if(!message.id){ this.events.push(message);return; }
            const pending=this.pending.get(message.id);
            if(!pending){ return; }
            this.pending.delete(message.id);
            message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result||{});
        };
    }
    async send(method,params={}){
        await this.ready;
        const id=++this.id;
        return new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error("CDP timed out: "+method));},20000);
            this.pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
            this.ws.send(JSON.stringify({id,method,params}));
        });
    }
    async eval(expression){
        const result=await this.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
        if(result.exceptionDetails){ throw new Error(JSON.stringify(result.exceptionDetails)); }
        return result.result?.value;
    }
    close(){ try{this.ws.close();}catch(_){} }
}

const PREPARE=`(async()=>{
 const wait=async f=>{for(let i=0;i<600;i++){if(f())return;await new Promise(r=>setTimeout(r,50));}throw Error('Runtime not READY: '+window.FourSymbolsStartupPolicy?.getState?.());};
 await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden);
 for(const feature of ['gameplay-core','patrol','boss-tower','abyss'])await window.FourSymbolsFeatures.ensure(feature,'navigation-qa');
 showPage('home');
 await new Promise(r=>setTimeout(r,150));
 window.__navQaShell=document.querySelector('.native-bottom-nav-layer');
 return {state:window.FourSymbolsStartupPolicy.getState(),ready:!!window.FourSymbolsBottomNav};
})()`;
const MEASURE=`(()=>{
 const rect=n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top,bottom:r.bottom};};
 const shell=document.querySelector('.native-bottom-nav-layer'),nav=document.getElementById('bottomNav');
 return {context:nav.dataset.navContext,owner:nav.parentElement.className,sameShell:shell===window.__navQaShell,shellCount:document.querySelectorAll('.native-bottom-nav-layer').length,legacyCount:document.querySelectorAll('#mapPageNav,#v141DungeonNav').length,visible:!shell.hidden&&getComputedStyle(shell).display!=='none',shell:rect(shell),nav:rect(nav),columns:[...nav.children].map(rect),frames:[...nav.querySelectorAll('.nav-icon-frame')].map(rect),activePage:document.querySelector('#game-content .page.active')?.id};
})()`;
const SCENARIOS=[['home',"showPage('home')"],['training',"showPage('training')"],['patrol',"enterMap()"],['dungeon',"leaveMap();vGameplayOpenDailyDungeons()"],['gameplay',"showPage('gameplay')"],['boss',"vGameplayOpenBoss()"],['tower',"vGameplayOpenTower()"],['abyss',"vGameplayOpenAbyss()"]];
async function settle(client){await client.eval('new Promise(r=>setTimeout(r,150))');}
async function swipe(client,x,y){
 console.log('Touch QA start',x,y);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=8;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*12}]});await new Promise(r=>setTimeout(r,20));}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(client);
}
async function runViewport(chrome,url,width,height){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nav-runtime-qa-')),port=9600+Math.floor(Math.random()*300);
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let client;const evidence={viewport:{width,height},rows:[]};
 try{
  const page=(await waitJson(`http://127.0.0.1:${port}/json/list`)).find(x=>x.type==='page');client=new Cdp(page.webSocketDebuggerUrl);
  await client.send('Page.enable');await client.send('Runtime.enable');
  await client.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await client.send('Page.navigate',{url});await new Promise(r=>setTimeout(r,300));evidence.startup=await client.eval(PREPARE);
  assert.equal(evidence.startup.state,'READY');assert.equal(evidence.startup.ready,true);
  for(let pass=0;pass<2;pass++){
   for(const [mode,action] of SCENARIOS){
    console.log("Navigation QA",width,height,pass,mode);
    await client.eval(action);await settle(client);
    const row={mode,pass,...await client.eval(MEASURE)};evidence.rows.push(row);
    assert.equal(row.sameShell,true,mode+' shell identity');assert.equal(row.shellCount,1);assert.equal(row.legacyCount,0);assert.equal(row.visible,true,mode+' visible');
    assert.ok(Math.abs(row.nav.width-row.shell.width)<=1,mode+' native width');
    const base=evidence.rows[0];for(const key of ['width','height','left','bottom'])assert.ok(Math.abs(row.nav[key]-base.nav[key])<=1,mode+' '+key);
    assert.equal(row.columns.length,5);assert.equal(row.frames.length,5);
    for(const col of row.columns)assert.ok(Math.abs(col.width-row.columns[0].width)<=1,mode+' equal columns');
    for(const frame of row.frames){assert.ok(Math.abs(frame.height-base.frames[0].height)<=1,mode+' frame height');assert.ok(Math.abs(frame.width-base.frames[0].width)<=1,mode+' frame width');}
   }
  }
  evidence.lifecycle=[];
  for(const [name,action] of [['patrol-backpack',"showPage('training');enterMap();v148OpenContextInventory()"],['patrol-backpack-close',"closeMapInventoryOverlay()"],['dungeon-tab',"vGameplayOpenDailyDungeons();switchDungeonTab('daily')"],['battle-exit',"showPage('battle');showPage('dungeon')"],['return-home',"showPage('home')"]]){
    console.log("Lifecycle QA",name);evidence.phase=name;await client.eval(action);await settle(client);const row={name,...await client.eval(MEASURE)};evidence.lifecycle.push(row);assert.equal(row.sameShell,true);assert.equal(row.shellCount,1);assert.equal(row.legacyCount,0);
  }
  evidence.phase='foreground';console.log('Lifecycle QA background/foreground');await client.send('Page.setWebLifecycleState',{state:'frozen'});await client.send('Page.setWebLifecycleState',{state:'active'});await client.send('Page.bringToFront');await settle(client);
  evidence.foreground=await client.eval(MEASURE);assert.equal(evidence.foreground.sameShell,true);assert.equal(evidence.foreground.visible,true);
  await client.eval("showPage('home')");await settle(client);
  evidence.phase='home';console.log('Home scroll QA');evidence.home=await client.eval(`(()=>{const n=document.getElementById('homePage'),r=n.getBoundingClientRect();return {clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,scrollTop:n.scrollTop,overflow:getComputedStyle(n).overflowY,rect:{left:r.left,top:r.top,width:r.width,height:r.height},documentScroll:document.scrollingElement.scrollTop};})()`);
  assert.ok(evidence.home.scrollHeight<=evidence.home.clientHeight+1,JSON.stringify(evidence.home));assert.notEqual(evidence.home.overflow,'auto');
  const hr=evidence.home.rect;await swipe(client,hr.left+hr.width/2,Math.min(height-100,hr.top+hr.height*.7));
  evidence.homeAfterSwipe=await client.eval("({scrollTop:homePage.scrollTop,documentScroll:document.scrollingElement.scrollTop})");assert.equal(evidence.homeAfterSwipe.scrollTop,0);assert.equal(evidence.homeAfterSwipe.documentScroll,0);
  // Use the real inventory grid and its real scroll owner. QA-only inventory
  // data supplies enough rows; no production state or CSS is replaced.
  evidence.phase='inventory';console.log('Inventory scroll QA');await client.eval(`inventoryItems.splice(0,inventoryItems.length,...Array.from({length:80},(_,i)=>({id:'qa-scroll-'+i,name:'測試材料'+i,type:'material',rarityKey:'white',count:1})));showPage('inventory');setInventoryFilter('material');renderInventory();`);await settle(client);
  evidence.inventory=await client.eval(`(()=>{const n=document.getElementById('inventoryGridScroll'),r=n.getBoundingClientRect();n.scrollTop=0;return {clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,overflow:getComputedStyle(n).overflowY,slots:document.querySelectorAll('#inventoryGrid .inventory-item-classic').length,rect:{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);
  const ir=evidence.inventory.rect;
  assert.equal(evidence.inventory.overflow,'auto','inventory scroll contract remains enabled');
  assert.equal(evidence.inventory.slots,24,'formal inventory uses 24-slot pagination');
  if(evidence.inventory.scrollHeight>evidence.inventory.clientHeight+1){
   await swipe(client,ir.left+ir.width/2,ir.top+Math.min(ir.height-20,ir.height*.8));
   evidence.inventoryAfterSwipe=await client.eval("document.getElementById('inventoryGridScroll').scrollTop");assert.ok(evidence.inventoryAfterSwipe>0,'legal inventory swipe did not scroll');
  }else{evidence.inventoryScrollNeeded=false;}
  // The paginated inventory can fit without scrolling. Exercise an actually
  // overflowing formal skill panel, without injecting geometry or content.
  await client.eval("(async()=>{closeMapInventoryOverlay();showPage('home');await FourSymbolsFeatures.ensure('skill','navigation-scroll-qa');openHomeFeature('character');switchCharacterTab('skill');renderSkillLoadout();})()");await settle(client);
  evidence.phase='legal-panel';evidence.legalPanel=await client.eval(`(()=>{
   const n=[...document.querySelectorAll('#homeFeatureModal *')].reverse().find(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);const x=r.left+r.width/2,y=r.top+r.height*.8;return r.width>100&&r.height>100&&r.top>=0&&r.bottom<=innerHeight&&s.visibility!=='hidden'&&(s.overflowY==='auto'||s.overflowY==='scroll')&&n.scrollHeight>n.clientHeight+1&&FourSymbolsGestureArbiter.findScrollOwner(document.elementFromPoint(x,y))?.node===n;});
   if(!n)return null;window.__navQaScrollOwner=n;n.scrollTop=0;const r=n.getBoundingClientRect();return {id:n.id,className:n.className,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,rect:{left:r.left,top:r.top,width:r.width,height:r.height}};
  })()`);assert.ok(evidence.legalPanel,'formal skill page has no overflowing legal owner');
  const lr=evidence.legalPanel.rect;await swipe(client,lr.left+lr.width/2,lr.top+lr.height*.8);
  evidence.legalPanelAfterSwipe=await client.eval('window.__navQaScrollOwner.scrollTop');assert.ok(evidence.legalPanelAfterSwipe>0,'legal panel single-finger swipe did not scroll');
  await client.eval("closeHomeFeature();closeMapInventoryOverlay();showPage('home')");await settle(client);
  evidence.returnHome=await client.eval(MEASURE);assert.equal(evidence.returnHome.sameShell,true);
  await client.send('Page.reload',{ignoreCache:true});await new Promise(r=>setTimeout(r,300));await client.eval(PREPARE);evidence.reload=await client.eval(MEASURE);assert.equal(evidence.reload.shellCount,1);assert.equal(evidence.reload.legacyCount,0);
  const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ARTIFACT_DIR,`navigation-home-${width}x${height}.png`),Buffer.from(shot.data,'base64'));
  return evidence;
 }catch(error){error.navEvidence=evidence;throw error;}finally{client?.close();proc.kill('SIGTERM');try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}}
}
fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
const server=await startServer();const results=[];
try{
 const chrome=findChrome();for(const [width,height] of VIEWPORTS)results.push(await runViewport(chrome,server.url,width,height));
 const data={suite:'bottom-nav-home-runtime',passed:true,commitSha:process.env.GITHUB_SHA||'local',results};fs.writeFileSync(path.join(ARTIFACT_DIR,'bottom-nav-home-scroll-qa.json'),JSON.stringify(data,null,2)+'\n');console.log('Real Runtime navigation/home mobile QA PASS',JSON.stringify(data));
}catch(error){fs.writeFileSync(path.join(ARTIFACT_DIR,'bottom-nav-home-scroll-qa.json'),JSON.stringify({passed:false,results,error:String(error.stack||error),evidence:error.navEvidence},null,2)+'\n');throw error;}finally{await new Promise(r=>server.server.close(r));}
