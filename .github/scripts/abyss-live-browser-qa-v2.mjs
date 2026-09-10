import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const baseUrl=String(process.env.DEV_BASE_URL||"https://dev.four-symbols-dev.pages.dev").replace(/\/$/,"");
const expectedSha=String(process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||"");
const qaUrl=`${baseUrl}/?abyss-live-qa-v2=${encodeURIComponent(expectedSha||Date.now())}`;
const artifactDir=path.resolve("artifacts/browser-qa");
fs.mkdirSync(artifactDir,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const abyssStyleReady="document.querySelector('link[data-feature-style=\"feature-abyss\"]')?.sheet";

function chromeBinary(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is not installed on the deployment runner.");
}

async function waitForJson(url,timeoutMs=15000){
    const started=Date.now();
    let lastError=null;
    while(Date.now()-started<timeoutMs){
        try{
            const response=await fetch(url);
            if(response.ok){ return await response.json(); }
        }catch(error){ lastError=error; }
        await sleep(150);
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError?.message||"no response"}`);
}

class CdpClient{
    constructor(url){ this.url=url; this.nextId=1; this.pending=new Map(); this.socket=null; }
    async connect(){
        this.socket=new WebSocket(this.url);
        await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(new Error("CDP WebSocket connection timed out")),10000);
            this.socket.onopen=()=>{ clearTimeout(timeout); resolve(); };
            this.socket.onerror=event=>{ clearTimeout(timeout); reject(new Error(`CDP WebSocket error: ${event?.message||"unknown"}`)); };
        });
        this.socket.onmessage=async event=>{
            let raw=event.data;
            if(raw&&typeof raw!=="string"&&typeof raw.text==="function"){ raw=await raw.text(); }
            const message=JSON.parse(String(raw));
            if(!message.id){ return; }
            const request=this.pending.get(message.id);
            if(!request){ return; }
            this.pending.delete(message.id);
            if(message.error){ request.reject(new Error(`${request.method}: ${message.error.message}`)); }
            else{ request.resolve(message.result||{}); }
        };
        this.socket.onclose=()=>{
            for(const request of this.pending.values()) request.reject(new Error(`CDP socket closed while waiting for ${request.method}`));
            this.pending.clear();
        };
    }
    send(method,params={}){
        const id=this.nextId++;
        return new Promise((resolve,reject)=>{
            this.pending.set(id,{resolve,reject,method});
            this.socket.send(JSON.stringify({id,method,params}));
        });
    }
    async eval(expression,awaitPromise=true){
        const response=await this.send("Runtime.evaluate",{expression,awaitPromise,returnByValue:true,userGesture:true});
        if(response.exceptionDetails){
            const text=response.exceptionDetails.exception?.description||response.exceptionDetails.text||"Runtime evaluation failed";
            throw new Error(text);
        }
        return response.result?.value;
    }
    close(){ try{ this.socket?.close(); }catch{} }
}

async function waitFor(client,expression,label,timeoutMs=30000){
    const started=Date.now();
    let last=null;
    while(Date.now()-started<timeoutMs){
        try{
            last=await client.eval(`Boolean(${expression})`);
            if(last){ return; }
        }catch(error){ last=error.message; }
        await sleep(200);
    }
    throw new Error(`Timed out waiting for ${label}. Last result: ${String(last)}`);
}

async function prepareAccountFirstRuntime(client,features){
    await waitFor(client,"window.FourSymbolsStartupPolicy&&['AUTH_REQUIRED','NEED_CHARACTER','READY','OFFLINE_READY','ERROR'].includes(FourSymbolsStartupPolicy.getState())","account-first startup destination",30000);
    let state=await client.eval("FourSymbolsStartupPolicy.getState()");
    if(state==="ERROR"){ throw new Error("Live Firebase startup failed before feature QA"); }
    if(state==="AUTH_REQUIRED"){
        await client.eval("document.getElementById('firebaseGuestButton').click();true");
        await waitFor(client,"['NEED_CHARACTER','READY','OFFLINE_READY','ERROR'].includes(FourSymbolsStartupPolicy.getState())","anonymous UID save resolution",60000);
        state=await client.eval("FourSymbolsStartupPolicy.getState()");
        if(state==="ERROR"){ throw new Error("Live anonymous UID/save resolution failed"); }
    }
    await client.eval(`Promise.all(${JSON.stringify(features)}.map(feature=>FourSymbolsFeatures.ensure(feature,"live-browser-qa")))`);
    return state;
}

function approx(actual,expected,tolerance,label){
    assert.ok(Number.isFinite(Number(actual)),`${label}: value is not finite (${actual})`);
    assert.ok(Math.abs(Number(actual)-Number(expected))<=tolerance,`${label}: expected about ${expected}, received ${actual}`);
}

const seedPlayerExpression=level=>`(()=>{
    try{
        if(typeof player!=="undefined"&&player){
            player.id=player.id||"abyss-live-qa";
            player.name=player.name||"QA俠客";
            player.level=${Number(level)};
            if(!Number.isFinite(Number(player.hp))||Number(player.hp)<=0){ player.hp=9999; }
            if(!Number.isFinite(Number(player.sp))||Number(player.sp)<0){ player.sp=9999; }
        }
    }catch(_){ }
    window.v133GetHighestCreatedCharacterLevel=()=>${Number(level)};
    return true;
})()`;

const evidence={status:"RUNNING",expectedSha,devUrl:baseUrl,checks:{}};
const chrome=chromeBinary();
const profile=path.join("/tmp",`four-symbols-abyss-qa-v2-${process.pid}`);
const child=spawn(chrome,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
    "--remote-debugging-port=9222",`--user-data-dir=${profile}`,"--window-size=412,915","about:blank"
],{stdio:["ignore","pipe","pipe"]});
let chromeStderr="";
child.stderr.on("data",chunk=>{ chromeStderr+=String(chunk); });
let client=null;

try{
    const targets=await waitForJson("http://127.0.0.1:9222/json/list");
    const page=targets.find(target=>target.type==="page");
    assert.ok(page?.webSocketDebuggerUrl,"Chrome DevTools page target was not available");
    client=new CdpClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:412,height:915,deviceScaleFactor:3,mobile:true,screenWidth:412,screenHeight:915});
    await client.send("Page.navigate",{url:qaUrl});
    await waitFor(client,"document.readyState==='complete'","page load");
    await prepareAccountFirstRuntime(client,["abyss"]);
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime");
    await waitFor(client,abyssStyleReady,"hashed feature Abyss CSS");

    await client.eval(`localStorage.removeItem('v174_abyss_state_v2');localStorage.removeItem('v141_abyss_state');true`);
    await client.eval(seedPlayerExpression(20));
    await client.eval(`(async()=>{
        if(typeof v174AbyssReloadState==='function'){v174AbyssReloadState();}
        if(typeof showPage==='function'){showPage('dungeon');}
        if(typeof switchDungeonTab==='function'){switchDungeonTab('abyss');}
        if(typeof v174AbyssBackToSelection==='function'){v174AbyssBackToSelection();}
        if(typeof v174RefreshAbyss==='function'){v174RefreshAbyss();}
        await new Promise(resolve=>setTimeout(resolve,150));
        return true;
    })()`);
    await waitFor(client,"document.getElementById('dungeonPage')?.classList.contains('active')","visible dungeon page");
    await waitFor(client,"document.querySelector('.v174-abyss-selection')&&getComputedStyle(document.querySelector('.v174-abyss-selection')).display!=='none'","visible Abyss selection");

    const selection=await client.eval(`(()=>{
        const page=document.getElementById('dungeonPage');
        const selection=document.querySelector('.v174-abyss-selection');
        const d20=document.querySelector('.v174-abyss-card[data-difficulty="20"]');
        const d40=document.querySelector('.v174-abyss-card[data-difficulty="40"]');
        const r20=d20?.getBoundingClientRect();
        const r40=d40?.getBoundingClientRect();
        const sr=selection?.getBoundingClientRect();
        const stage=document.getElementById('game-stage')?.getBoundingClientRect();
        return {
            pageActive:!!page?.classList.contains('active'),pageDisplay:page?getComputedStyle(page).display:null,
            selectionDisplay:selection?getComputedStyle(selection).display:null,
            w20:r20?.width||0,h20:r20?.height||0,w40:r40?.width||0,h40:r40?.height||0,
            selectionWidth:sr?.width||0,selectionHeight:sr?.height||0,
            selectionOverflow:selection?(selection.scrollHeight-selection.clientHeight):999,
            stage:stage?{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom,width:stage.width,height:stage.height}:null,
            viewport:{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight},
            lv40Locked:!!d40?.classList.contains('locked'),
            covers:Array.from(document.querySelectorAll('.v174-abyss-card-cover')).map(img=>({src:img.getAttribute('src'),complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}))
        };
    })()`);
    evidence.checks.selection=selection;
    assert.equal(selection.pageActive,true,"Dungeon page is not active after real page navigation");
    assert.notEqual(selection.pageDisplay,"none","Dungeon page is hidden");
    assert.equal(selection.lv40Locked,true,"Lv40 card must remain visible and locked for a Lv20 player");
    assert.ok(selection.w20>0&&selection.h20>0&&selection.w40>0&&selection.h40>0,"Abyss cards must have a real visible footprint");
    approx(selection.w20,selection.w40,1,"Abyss cover widths");
    approx(selection.h20,selection.h40,1,"Abyss cover heights");
    approx(selection.w20/selection.h20,16/9,0.06,"Abyss cover aspect ratio");
    assert.ok(selection.selectionOverflow<=2,`Abyss selection overflows its mobile container by ${selection.selectionOverflow}px`);
    assert.equal(selection.covers.length,2,"Two Abyss cover images are required");
    for(const cover of selection.covers){
        assert.equal(cover.complete,true,`${cover.src} did not finish loading`);
        assert.ok(cover.naturalWidth>0&&cover.naturalHeight>0,`${cover.src} is broken`);
    }

    const preLaunch=await client.eval(`(async()=>{
        window.__abyssQaLaunch=null;
        window.__abyssQaOriginalLauncher=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=(roster,settled)=>{window.__abyssQaLaunch={roster,settled};return true;};
        v174AbyssSelectDifficulty(20);
        v174AbyssStartEncounter();
        await new Promise(resolve=>setTimeout(resolve,1800));
        const launch=window.__abyssQaLaunch;
        return launch?{count:launch.roster.length,ranks:launch.roster.map(m=>m.rank),levels:launch.roster.map(m=>m.level),hps:launch.roster.map(m=>m.maxHP),skills:launch.roster.map(m=>m.v141ForceSkillLevel)}:null;
    })()`);
    evidence.checks.lv20PreLaunch=preLaunch;
    assert.ok(preLaunch,"Lv20 pre-stage did not reach shared v132LaunchDungeonBattle");
    assert.equal(preLaunch.count,8);
    assert.deepEqual(preLaunch.ranks,["regular","regular","regular","regular","regular","elite","elite","elite"]);
    assert.equal(preLaunch.levels.every(v=>v===20),true);
    assert.equal(preLaunch.skills.every(v=>v===1),true);
    assert.deepEqual([preLaunch.hps[0],preLaunch.hps[5]],[386,1236]);

    const afterWin=await client.eval(`(()=>{
        window.__abyssQaLaunch.settled({result:'win'});
        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal'),pending:!!document.querySelector('.v174-abyss-node.current.pending')};
    })()`);
    evidence.checks.afterPreWin=afterWin;
    assert.deepEqual([afterWin.run.phase,afterWin.run.chestSpawned,afterWin.run.portalUnlocked],["chest",true,false]);
    assert.equal(afterWin.chest,true,"Victory must spawn a chest");
    assert.equal(afterWin.portal,false,"Portal must not render before chest claim");
    assert.equal(afterWin.pending,true,"HUD must show pending chest state");

    await client.eval(`document.querySelector('.v174-abyss-chest')?.click();true`);
    await sleep(1900);
    const afterClaim=await client.eval(`(()=>{const run=v174AbyssGetRunState(20);return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};})()`);
    evidence.checks.afterPreClaim=afterClaim;
    assert.deepEqual([afterClaim.run.phase,afterClaim.run.chestClaimed,afterClaim.run.portalUnlocked],["portal",true,true]);
    assert.equal(afterClaim.chest,false);
    assert.equal(afterClaim.portal,true);

    await client.eval(`document.querySelector('.v174-abyss-portal')?.click();true`);
    await sleep(1900);
    let run=await client.eval(`v174AbyssGetRunState(20)`);
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[0,1,"ready"]);

    await client.eval(`v174AbyssResolveBattleResult('win');true`);
    await client.send("Page.reload",{ignoreCache:true});
    await waitFor(client,"document.readyState==='complete'","reload after pending chest");
    await prepareAccountFirstRuntime(client,["abyss"]);
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true","Abyss after pending reload");
    await client.eval(seedPlayerExpression(20));
    const pendingReload=await client.eval(`(async()=>{
        showPage('dungeon');switchDungeonTab('abyss');v174AbyssSelectDifficulty(20);
        await new Promise(resolve=>setTimeout(resolve,120));
        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};
    })()`);
    evidence.checks.pendingReload=pendingReload;
    assert.deepEqual([pendingReload.run.regionIndex,pendingReload.run.encounterIndex,pendingReload.run.phase],[0,1,"chest"]);
    assert.equal(pendingReload.chest,true,"Unclaimed chest must survive reload");
    assert.equal(pendingReload.portal,false);

    await client.eval(`document.querySelector('.v174-abyss-chest')?.click();true`);
    await sleep(1900);
    await client.send("Page.reload",{ignoreCache:true});
    await waitFor(client,"document.readyState==='complete'","reload after claimed chest");
    await prepareAccountFirstRuntime(client,["abyss"]);
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true","Abyss after claimed reload");
    await client.eval(seedPlayerExpression(20));
    const claimedReload=await client.eval(`(async()=>{
        showPage('dungeon');switchDungeonTab('abyss');v174AbyssSelectDifficulty(20);
        await new Promise(resolve=>setTimeout(resolve,120));
        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};
    })()`);
    evidence.checks.claimedReload=claimedReload;
    assert.equal(claimedReload.run.phase,"portal");
    assert.equal(claimedReload.chest,false,"Claimed chest must not respawn");
    assert.equal(claimedReload.portal,true);

    await client.eval(`document.querySelector('.v174-abyss-portal')?.click();true`);
    await sleep(1900);
    for(let expectedStage=2;expectedStage<=4;expectedStage++){
        await client.eval(`v174AbyssResolveBattleResult('win');true`);
        await client.eval(`document.querySelector('.v174-abyss-chest')?.click();true`);
        await sleep(1900);
        const gate=await client.eval(`(()=>{const r=v174AbyssGetRunState(20);return {stage:r.encounterIndex,bossGate:!!document.querySelector('.v174-abyss-portal.boss-gate')};})()`);
        if(expectedStage===4){ assert.equal(gate.bossGate,true,"Fourth pre-stage must unlock distinct boss gate"); }
        await client.eval(`document.querySelector('.v174-abyss-portal')?.click();true`);
        await sleep(1900);
    }
    run=await client.eval(`v174AbyssGetRunState(20)`);
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[0,4,"ready"]);
    assert.equal(await client.eval(`!!document.querySelector('.v174-abyss-encounter.boss')`),true,"East Emperor boss marker is missing");

    const bossLaunch=await client.eval(`(async()=>{
        window.__abyssQaLaunch=null;
        window.v132LaunchDungeonBattle=(roster,settled)=>{window.__abyssQaLaunch={roster,settled};return true;};
        window.rpgConfirm=()=>Promise.resolve(true);
        v174AbyssStartEncounter();
        await new Promise(resolve=>setTimeout(resolve,1900));
        const launch=window.__abyssQaLaunch;
        return launch?{count:launch.roster.length,bosses:launch.roster.filter(m=>m.rank==='boss').map(m=>({name:m.name,hp:m.maxHP,level:m.level,skill:m.v141ForceSkillLevel})),eliteCount:launch.roster.filter(m=>m.rank==='elite').length}:null;
    })()`);
    evidence.checks.lv20BossLaunch=bossLaunch;
    assert.ok(bossLaunch,"Boss gate did not reach shared dungeon launcher");
    assert.equal(bossLaunch.count,10);
    assert.equal(bossLaunch.eliteCount,9);
    assert.deepEqual(bossLaunch.bosses,[{name:"東帝",hp:3090,level:20,skill:1}]);

    await client.eval(`window.__abyssQaLaunch.settled({result:'win'});true`);
    let bossState=await client.eval(`v174AbyssGetRunState(20)`);
    assert.equal(bossState.phase,"chest");
    assert.equal(await client.eval(`document.querySelector('.v174-abyss-chest span')?.textContent.includes('帝王寶箱')`),true);
    await client.eval(`document.querySelector('.v174-abyss-chest')?.click();true`);
    await sleep(1900);
    await client.eval(`document.querySelector('.v174-abyss-portal')?.click();true`);
    await sleep(1900);
    bossState=await client.eval(`v174AbyssGetRunState(20)`);
    evidence.checks.afterEastBoss=bossState;
    assert.deepEqual([bossState.regionIndex,bossState.encounterIndex,bossState.phase],[1,0,"ready"]);

    await client.eval(seedPlayerExpression(40));
    await client.eval(`v174AbyssBackToSelection();v174AbyssSelectDifficulty(40);true`);
    const lv40=await client.eval(`(()=>{
        const pre=v174AbyssBuildRoster(40,0,0);
        const boss=v174AbyssBuildRoster(40,0,4);
        const final=v174AbyssBuildRoster(40,4,4);
        return {
            pre:{count:pre.length,levels:pre.map(m=>m.level),skills:pre.map(m=>m.v141ForceSkillLevel),regularHp:pre[0].maxHP,eliteHp:pre[5].maxHP},
            boss:{count:boss.length,eliteHp:boss.find(m=>m.rank==='elite').maxHP,bosses:boss.filter(m=>m.rank==='boss').map(m=>({name:m.name,hp:m.maxHP,level:m.level,skill:m.v141ForceSkillLevel}))},
            final:{count:final.length,eliteCount:final.filter(m=>m.rank==='elite').length,bosses:final.filter(m=>m.rank==='boss').map(m=>({name:m.name,hp:m.maxHP,level:m.level,skill:m.v141ForceSkillLevel}))}
        };
    })()`);
    evidence.checks.lv40=lv40;
    assert.equal(lv40.pre.count,8);
    assert.equal(lv40.pre.levels.every(v=>v===40),true);
    assert.equal(lv40.pre.skills.every(v=>v===2),true);
    assert.deepEqual([lv40.pre.regularHp,lv40.pre.eliteHp],[644,2059]);
    assert.deepEqual([lv40.boss.eliteHp,lv40.boss.bosses[0].hp],[2517,5149]);
    assert.deepEqual(lv40.final.bosses,[{name:"極帝天尊",hp:5149,level:40,skill:2}]);
    assert.equal(lv40.final.eliteCount,9);

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(screenshot.data){ fs.writeFileSync(path.join(artifactDir,"abyss-live-mobile.png"),Buffer.from(screenshot.data,"base64")); }
    evidence.status="PASS";
    evidence.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(artifactDir,"abyss-live-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.log("Abyss live mobile browser QA: PASS");
} catch(error){
    evidence.status="FAIL";
    evidence.error=error?.stack||String(error);
    evidence.chromeStderr=chromeStderr.slice(-5000);
    evidence.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(artifactDir,"abyss-live-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.error("Abyss live mobile browser QA: FAIL");
    console.error(error);
    process.exitCode=1;
} finally{
    client?.close();
    child.kill("SIGTERM");
}
