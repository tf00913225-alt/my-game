import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

export const ROOT=process.cwd();
const ASSET_MANIFEST=JSON.parse(fs.readFileSync(path.join(ROOT,"build","asset-manifest.json"),"utf8"));
const QA_AUTH_PATH="/"+Object.keys(ASSET_MANIFEST.assets).find(file=>/build\/firebase\/firebase-auth\.[0-9a-f]{12}\.js$/.test(file));
const QA_CLOUD_PATH="/"+Object.keys(ASSET_MANIFEST.assets).find(file=>/build\/firebase\/firebase-cloud-save\.[0-9a-f]{12}\.js$/.test(file));
const QA_SESSION_PATH="/"+Object.keys(ASSET_MANIFEST.assets).find(file=>/build\/firebase\/firebase-session\.[0-9a-f]{12}\.js$/.test(file));
const QA_FIRST_PLAY={gameVersion:String(ASSET_MANIFEST.release||""),manifestVersion:ASSET_MANIFEST.firstPlay.manifestVersion,assetPackVersion:ASSET_MANIFEST.firstPlay.assetPackVersion,manifestHash:ASSET_MANIFEST.firstPlay.manifestHash,completedAt:"2026-09-30T00:00:00.000Z",assets:Object.fromEntries(ASSET_MANIFEST.firstPlay.resources.map(item=>[item.path,item.sha256]))};
/* Production index, feature loader and runtime remain real.  Only external
   Firebase transport is replaced by a read-only local account so Startup can
   formally reach READY without a player account or cloud write. */
const QA_AUTH_MODULE=String.raw`const user=Object.freeze({uid:"skill-runtime-browser-qa",email:"skill-runtime-browser-qa@qa.invalid",displayName:"Skill Runtime QA",photoURL:null,isAnonymous:true,providerIds:Object.freeze([])});export function getFirebaseAuthConfigStatus(){return Object.freeze({ready:true,missingFields:[],projectId:"skill-runtime-qa",sdkVersion:"qa"});}export async function initializeFirebaseAuth(){return Object.freeze({app:{name:"skill-runtime-qa"},auth:{currentUser:user}});}export function getFirebaseApp(){return {name:"skill-runtime-qa"};}export function getFirebaseAuth(){return {currentUser:user};}export function getSignedInUser(){return user;}export function installFirebaseSessionHooks(){}export async function observeFirebaseAuthState(listener){queueMicrotask(()=>listener(user,null));return ()=>{};}export async function signInAsAnonymous(){return user;}export async function signInWithGoogle(){return user;}export async function reauthenticateWithGoogle(){return user;}export async function signInWithFacebook(){return user;}export async function signInWithEmail(){return user;}export async function createAccountWithEmail(){return user;}export async function signOutFirebase(){}`;
const QA_CLOUD_MODULE=String.raw`export const CLOUD_SAVE_WRITE_POLICY="trusted-backend-only";export const CLOUD_FUNCTIONS_REGION="qa-local";export const CURRENT_SAVE_SUBCOLLECTION="saves";export const CURRENT_SAVE_DOCUMENT="current";export const LEGACY_LOCAL_SAVE_KEY="battle_full_version_save_v5";const uid="skill-runtime-browser-qa";const save={player:{id:"Skill Runtime QA",element:"fire",gender:"male",level:70,exp:0,expNext:100,attack:10,vitality:10,energy:10,intelligence:10,spirit:10,agility:10,bonusHP:0,bonusSP:0,hp:300,sp:120,attributePoints:0,skillPoints:999,activeBuffs:[],statusEffects:[],isDefending:false},sharedExp:0,gold:0,inventoryItems:[],characterEquipment:{fire:{head:null,hand:null,shoulder:null,armor:null,shoes:null,ring:null}},characterSkillLoadouts:{fire:{name:"Skill Runtime QA",skillLevels:{fireRocket:1},equippedSkills:[]}}};export async function readCurrentCloudSave(){return Object.freeze({exists:true,uid,path:"users/"+uid+"/saves/current",data:{ownerUid:uid,authoritativeStateReady:true,status:"ready",gameSave:save}});}export async function bootstrapTrustedCloudSave(){throw new Error("QA cloud writes are forbidden");}export async function observeCanonicalAccountMode(){throw new Error("QA canonical earning intents are isolated");}export async function beginCanonicalElementBoxAd(){throw new Error("QA canonical earning intents are isolated");}export async function completeCanonicalElementBoxAd(){throw new Error("QA canonical earning intents are isolated");}export async function abandonCanonicalElementBoxAd(){throw new Error("QA canonical earning intents are isolated");}export async function issueCanonicalPatrolTicket(){throw new Error("QA canonical earning intents are isolated");}export async function settleCanonicalPatrolMember(){throw new Error("QA canonical earning intents are isolated");}export async function settleCanonicalPatrolTerminal(){throw new Error("QA canonical earning intents are isolated");}export async function abandonCanonicalPatrolTicket(){throw new Error("QA canonical earning intents are isolated");}export async function createAdditionalCanonicalCharacter(){throw new Error("QA canonical intents are isolated");}export async function allocateCanonicalSharedExp(){throw new Error("QA canonical intents are isolated");}export async function mutateCanonicalSkillLoadout(){throw new Error("QA canonical intents are isolated");}export async function readCanonicalSkillLoadout(){throw new Error("QA canonical configuration reads are isolated");}export async function allocateCanonicalAttributePoint(){throw new Error("QA canonical intents are isolated");}export async function createInitialCanonicalCharacter(){throw new Error("QA cloud writes are forbidden");}export async function saveLocalAutoBattlePreferences(){throw new Error("QA cloud writes are forbidden");}export async function submitLegacyMigrationCandidate(){throw new Error("QA cloud writes are forbidden");}export async function screenLegacyMigrationCandidate(){throw new Error("QA cloud writes are forbidden");}export async function readTeamFormation(){throw new Error("QA cloud reads are isolated");}export async function saveTeamFormation(){throw new Error("QA cloud writes are forbidden");}export async function readHeroGrowth(){throw new Error("QA cloud writes are forbidden");}export async function claimHeroLoginReward(){throw new Error("QA cloud writes are forbidden");}export async function claimHeroDailySupply(){throw new Error("QA cloud writes are forbidden");}export async function mutateHeroGrowth(){throw new Error("QA cloud writes are forbidden");}export async function readHeroAcquisition(){return __qaHeroRights();}export async function observeHeroLogin(){return __qaHeroRights();}export async function ensureHeroChapterTicket(){throw new Error("QA cloud writes are forbidden");}export async function completeHeroChapterNode(){throw new Error("QA cloud writes are forbidden");}function __qaHeroRights(){const ids=Array.isArray(window.__heroQaOwned)?window.__heroQaOwned:[];const entitlements=Object.fromEntries(ids.filter(id=>["divineDogHongbao","vajraHeavenlyKing"].includes(id)).map(id=>[id,{heroId:id,claimKey:"hero-v1-"+id,allocationSeed:20261012,sourceId:"qa-hero-source-"+id,grantedRevision:1}]));return {schemaVersion:1,ownerUid:uid,serverRevision:1,loginCount:ids.includes("vajraHeavenlyKing")?7:0,entitlements,unchanged:true,authoritativeStateReady:false,chapter:{chapterId:"chapter_v1",ticketId:null,nextNodeId:ids.includes("divineDogHongbao")?null:"n01_arrival",phase:ids.includes("divineDogHongbao")?"completed":"not-started",expiresAtMs:null,outcomeVerified:false,completedIntents:[]}};}export function createLocalMigrationBackup(){throw new Error("QA cloud writes are forbidden");}`;
const QA_SESSION_MODULE=String.raw`export const CLOUD_FUNCTIONS_REGION="qa-local";export async function synchronizeGameSession(user){window.dispatchEvent(new CustomEvent("four-symbols:game-session-state",{detail:{uid:user?.uid||null,status:user?"ready":"signed-out",code:null}}));return {status:"ready"};}export async function callProtectedFunction(){throw new Error("QA cloud writes are forbidden");}export async function revokeGameSession(){}export const protectedTest=()=>callProtectedFunction("protectedTest");export function getGameSessionState(){return {status:"ready"};}`;
function qaPrelude(){return `<script>localStorage.setItem("four_symbols_active_uid","skill-runtime-browser-qa");localStorage.setItem("four_symbols_privacy_consent",JSON.stringify({privacyPolicyVersion:"2026-09-11-v2",acceptedAt:"2026-09-30T00:00:00.000Z"}));localStorage.setItem("four_symbols_first_play_ready",${JSON.stringify(JSON.stringify(QA_FIRST_PLAY))});</script>`;}

function findChrome(){
    const configured=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
    if(configured&&fs.existsSync(configured)){ return configured; }
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for real production Runtime browser QA.");
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

async function startServer({baseUrl,cloudModule=QA_CLOUD_MODULE,handleRequest}={}){
    const failures=[];
    function recordFailure(path,status,message){
        if(failures.length===40){ failures.shift(); }
        failures.push({path,status,message});
    }
    const server=http.createServer(async(req,res)=>{
        if(handleRequest&&await handleRequest(req,res)){return;}
        const pathname=decodeURIComponent(String(req.url||"/").split("?")[0]);
        const fetchDestination=String(req.headers["sec-fetch-dest"]||"");
        if(fetchDestination==="script"&&pathname===QA_AUTH_PATH){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(QA_AUTH_MODULE);return;}
        if(fetchDestination==="script"&&pathname===QA_CLOUD_PATH){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(cloudModule);return;}
        if(fetchDestination==="script"&&pathname===QA_SESSION_PATH){res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(QA_SESSION_MODULE);return;}
        const relative=pathname==="/"?"index.html":pathname.replace(/^\/+/,"");
        if(baseUrl){
            // Exact deployed assets remain authoritative; only the established
            // read-only account transport above is isolated from player data.
            try{
                const upstream=await fetch(new URL(relative,baseUrl.replace(/\/$/,"")+"/"));
                if(!upstream.ok){ recordFailure(pathname,upstream.status,"upstream HTTP failure"); }
                res.writeHead(upstream.status,{"content-type":upstream.headers.get("content-type")||mime(relative),"cache-control":"no-store"});
                if(relative==="index.html"){res.end((await upstream.text()).replace("<!-- build:critical-script -->",qaPrelude()+"\n<!-- build:critical-script -->"));}
                else{res.end(Buffer.from(await upstream.arrayBuffer()));}
            }catch(error){recordFailure(pathname,502,String(error.cause?.code||error.code||error.message));res.writeHead(502);res.end(String(error));}
            return;
        }
        const file=path.resolve(ROOT,relative);
        if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
            res.writeHead(404);res.end("not found");return;
        }
        res.writeHead(200,{"content-type":mime(file),"cache-control":"no-store"});
        if(relative==="index.html"){res.end(fs.readFileSync(file,"utf8").replace("<!-- build:critical-script -->",qaPrelude()+"\n<!-- build:critical-script -->"));return;}
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    return {server,url:`http://127.0.0.1:${server.address().port}/index.html`,failures};
}

// Failure-only evidence: read the formal startup Owner; never change its state,
// account, saved data, timeout or acceptance condition.
async function collectStartupFailure(cdp,context){
    const evidence={...context};
    let timer;
    try{
        evidence.startup=await Promise.race([
            cdp.eval(`(()=>{const error=window.FourSymbolsStartupPolicy?.getLastError?.();return {state:window.FourSymbolsStartupPolicy?.getState?.()||null,error:error?{message:String(error.message||error),code:error.code||null}:null,loaderHidden:document.getElementById('startupLoader')?.hidden??null,authVisible:document.getElementById('firebaseAuthOverlay')?.classList.contains('show')??null,failedResources:window.FourSymbolsFirstPlay?.getLastFailed?.()||[],marks:performance.getEntriesByType('mark').filter(item=>item.name.startsWith('four-symbols:')).map(item=>({name:item.name,startTime:item.startTime}))};})()`),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Startup evidence capture timeout')),3000);})
        ]);
    }catch(error){ evidence.captureError=String(error.message); }
    finally{ clearTimeout(timer); }
    const pathname=url=>{try{return new URL(url).pathname;}catch(_){return null;}};
    const events=cdp?.events||[];
    const requests=new Map(events.filter(event=>event.method==='Network.requestWillBeSent').map(event=>[event.params.requestId,pathname(event.params.request.url)]));
    evidence.network=events.filter(event=>
        event.method==='Network.loadingFailed'||event.method==='Network.responseReceived'&&event.params.response.status>=400
    ).slice(-40).map(event=>event.method==='Network.loadingFailed'
        ?{method:event.method,path:requests.get(event.params.requestId)||null,error:event.params.errorText,canceled:!!event.params.canceled}
        :{method:event.method,path:pathname(event.params.response.url),status:event.params.response.status});
    for(const event of events){if(event.method==='Network.loadingFinished'||event.method==='Network.loadingFailed'){requests.delete(event.params.requestId);}}
    evidence.pendingResources=[...requests.values()].slice(-40);
    return evidence;
}

async function collectDevToolsFailure(url){
    const endpoint=new URL(url);
    const result={endpoint:endpoint.origin+endpoint.pathname,platform:process.platform,node:process.version};
    if(!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||endpoint.username||endpoint.password){return result;}
    result.directHttp=await new Promise(resolve=>{
        let settled=false;
        const finish=value=>{if(settled)return;settled=true;clearTimeout(deadline);resolve(value);};
        const deadline=setTimeout(()=>{
            finish({error:'direct HTTP diagnostic timeout'});
            request.destroy();
        },1000);
        const request=http.get(endpoint,response=>{
            let body='';response.setEncoding('utf8');
            response.on('data',chunk=>{body=(body+chunk).slice(0,8192);});
            response.on('end',()=>{let data;try{data=JSON.parse(body);}catch{}
                finish({status:response.statusCode,pageTargets:Array.isArray(data)?data.filter(p=>p.type==='page').length:null});});
            response.once('aborted',()=>finish({error:'direct HTTP diagnostic response aborted'}));
            response.once('error',error=>finish({error:error.code||error.message}));
        });
        request.on('error',error=>finish({error:error.code||error.message}));
    });
    result.proxyEnvironment=Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NODE_USE_ENV_PROXY'].map(key=>[key,!!process.env[key]]));
    if(process.platform==='linux'){
        const ps=spawnSync('ps',['-eo','pid,ppid,stat,etime,comm'],{encoding:'utf8',timeout:2000});
        const processes=(ps.stdout||'').split('\n').filter(line=>/chrome|chromium|crashpad/i.test(line));
        result.processCount=processes.length;
        result.processes=processes.slice(0,40);
        result.chrome=result.processes.map(line=>{
            const pid=line.trim().split(/\s+/)[0],entry={pid};
            if(!/^\d+$/.test(pid))return entry;
            try{entry.executable=fs.readlinkSync('/proc/'+pid+'/exe');}catch{}
            try{entry.waitChannel=fs.readFileSync('/proc/'+pid+'/wchan','utf8').trim();}catch{}
            try{entry.launch=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0').filter(arg=>/^--(remote-debugging|user-data-dir|headless)/.test(arg));}catch{}
            return entry;
        });
        const sockets=spawnSync('ss',['-ltnp'],{encoding:'utf8',timeout:2000});
        result.listeners=(sockets.stdout||'').split('\n').filter(line=>line.includes(':'+endpoint.port+' ')||/chrome|chromium/i.test(line)).slice(0,20);
        try{result.memory=fs.readFileSync('/proc/meminfo','utf8').split('\n').filter(line=>/^(MemAvailable|SwapFree):/.test(line));}catch{}
        result.cgroup={};
        for(const key of ['pids.current','pids.max','memory.current','memory.max']){try{result.cgroup[key]=fs.readFileSync('/sys/fs/cgroup/'+key,'utf8').trim();}catch{}}
    }
    return result;
}

async function waitJson(url,{timeoutMs=15000}={}){
    const started=Date.now(),controller=new AbortController();
    const timeout=Object.assign(new Error('DevTools startup probe exceeded its '+timeoutMs+'ms deadline'),{code:'ETIMEDOUT'});
    const deadline=setTimeout(()=>controller.abort(timeout),timeoutMs);
    let attempts=0,lastError;
    try{
        while(!controller.signal.aborted){
            attempts++;
            try{
                // The same deadline covers response headers AND JSON body.
                const response=await fetch(url,{signal:controller.signal});
                const data=await response.json();
                if(controller.signal.aborted){throw timeout;}
                if(attempts>1){const endpoint=new URL(url);console.log('DevTools ready: '+JSON.stringify({endpoint:endpoint.origin+endpoint.pathname,elapsedMs:Date.now()-started,attempts}));}
                return data;
            }catch(error){
                if(controller.signal.aborted){
                    if(lastError&&lastError!==timeout){timeout.cause=lastError;}
                    else if(error!==timeout){timeout.cause=error;}
                    lastError=timeout;
                }else{lastError=error;}
            }
            if(!controller.signal.aborted){await new Promise(resolve=>setTimeout(resolve,Math.min(80,Math.max(0,timeoutMs-(Date.now()-started)))));}
        }
    }finally{clearTimeout(deadline);}
    const error=lastError||timeout;
    try{
        error.devToolsDiagnostics=await collectDevToolsFailure(url);
        console.error('DevTools connection failure diagnostics: '+JSON.stringify(error.devToolsDiagnostics));
    }catch{}
    throw error;
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
        return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});
    }
    async eval(expression){
        const result=await this.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
        if(result.exceptionDetails){ throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||"browser evaluation failed"); }
        return result.result?.value;
    }
    close(){ try{this.ws.close();}catch(_){} }
}


export {ASSET_MANIFEST,QA_AUTH_PATH,QA_CLOUD_PATH,QA_SESSION_PATH,QA_AUTH_MODULE,QA_CLOUD_MODULE,QA_SESSION_MODULE,qaPrelude,findChrome,startServer,waitJson,Cdp,collectStartupFailure};
