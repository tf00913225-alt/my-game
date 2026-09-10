import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const baseUrl=String(process.env.DEV_BASE_URL||"https://dev.four-symbols-dev.pages.dev").replace(/\/$/,"");
const expectedSha=String(process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||"");
const qaUrl=`${baseUrl}/?abyss-live-qa=${encodeURIComponent(expectedSha||Date.now())}`;
const artifactDir=path.resolve("artifacts/browser-qa");
fs.mkdirSync(artifactDir,{recursive:true});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

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
    constructor(url){
        this.url=url;
        this.nextId=1;
        this.pending=new Map();
        this.socket=null;
    }
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
            for(const request of this.pending.values()){
                request.reject(new Error(`CDP socket closed while waiting for ${request.method}`));
            }
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
        const result=await this.send("Runtime.evaluate",{
            expression,
            awaitPromise,
            returnByValue:true,
            userGesture:true
        });
        if(result.exceptionDetails){
            const description=result.exceptionDetails.exception?.description||result.exceptionDetails.text||"Runtime evaluation failed";
            throw new Error(description);
        }
        return result.result?.value;
    }
    close(){ try{ this.socket?.close(); }catch{} }
}

async function waitFor(client,expression,label,timeoutMs=20000){
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

function assertApprox(actual,expected,tolerance,label){
    assert.ok(Math.abs(Number(actual)-Number(expected))<=tolerance,`${label}: expected about ${expected}, received ${actual}`);
}

const chrome=chromeBinary();
const profile=path.join("/tmp",`four-symbols-abyss-qa-${process.pid}`);
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
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true && typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime",30000);

    const bootstrap=await client.eval(`(async()=>{
        localStorage.removeItem('v174_abyss_state_v2');
        localStorage.removeItem('v141_abyss_state');
        window.v133GetHighestCreatedCharacterLevel=()=>20;
        if(typeof window.v174AbyssReloadState==='function'){ window.v174AbyssReloadState(); }
        if(typeof window.showPage==='function'){ window.showPage('dungeon'); }
        if(typeof window.switchDungeonTab==='function'){ window.switchDungeonTab('abyss'); }
        if(typeof window.v174AbyssBackToSelection==='function'){ window.v174AbyssBackToSelection(); }
        if(typeof window.v174RefreshAbyss==='function'){ window.v174RefreshAbyss(); }
        await new Promise(resolve=>setTimeout(resolve,80));
        const d20=document.querySelector('.v174-abyss-card[data-difficulty="20"]');
        const d40=document.querySelector('.v174-abyss-card[data-difficulty="40"]');
        const selection=document.querySelector('.v174-abyss-selection');
        const r20=d20?.getBoundingClientRect();
        const r40=d40?.getBoundingClientRect();
        return {
            has20:!!d20,has40:!!d40,lv40Locked:!!d40?.classList.contains('locked'),
            w20:r20?.width||0,h20:r20?.height||0,w40:r40?.width||0,h40:r40?.height||0,
            selectionOverflow:selection?selection.scrollHeight-selection.clientHeight:999,
            stageRect:(()=>{const el=document.getElementById('game-stage');const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;})(),
            viewport:{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight},
            covers:Array.from(document.querySelectorAll('.v174-abyss-card-cover')).map(img=>({src:img.getAttribute('src'),complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}))
        };
    })()`);

    assert.equal(bootstrap.has20,true,"Lv20 Abyss cover card is missing");
    assert.equal(bootstrap.has40,true,"Lv40 Abyss cover card is missing");
    assert.equal(bootstrap.lv40Locked,true,"Lv40 card must remain visible and locked for a Lv20 player");
    assertApprox(bootstrap.w20,bootstrap.w40,1,"Abyss cover widths must match");
    assertApprox(bootstrap.h20,bootstrap.h40,1,"Abyss cover heights must match");
    assertApprox(bootstrap.w20/bootstrap.h20,16/9,0.06,"Abyss cover aspect ratio");
    assert.ok(bootstrap.selectionOverflow<=2,`Abyss selection overflows its mobile container by ${bootstrap.selectionOverflow}px`);
    assert.equal(bootstrap.covers.length,2,"Two Abyss cover images are required");
    bootstrap.covers.forEach(cover=>{
        assert.equal(cover.complete,true,`${cover.src} did not finish loading`);
        assert.ok(cover.naturalWidth>0&&cover.naturalHeight>0,`${cover.src} is broken`);
    });

    const preLaunch=await client.eval(`(async()=>{
        window.__abyssQaOriginalLauncher=window.v132LaunchDungeonBattle;
        window.__abyssQaLaunch=null;
        window.v132LaunchDungeonBattle=(roster,settled)=>{ window.__abyssQaLaunch={roster,settled}; return true; };
        window.v174AbyssSelectDifficulty(20);
        window.v174AbyssStartEncounter();
        await new Promise(resolve=>setTimeout(resolve,1700));
        const launch=window.__abyssQaLaunch;
        return launch?{
            count:launch.roster.length,
            ranks:launch.roster.map(monster=>monster.rank),
            levels:launch.roster.map(monster=>monster.level),
            hps:launch.roster.map(monster=>monster.maxHP)
        }:null;
    })()`);
    assert.ok(preLaunch,"Lv20 pre-stage did not reach the shared dungeon battle launcher");
    assert.equal(preLaunch.count,10);
    assert.deepEqual(preLaunch.ranks,["regular","regular","regular","regular","regular","elite","elite","elite","elite","elite"]);
    assert.equal(preLaunch.levels.every(level=>level===20),true);
    assert.equal(preLaunch.hps[0],386);
    assert.equal(preLaunch.hps[5],1236);

    const afterWin=await client.eval(`(()=>{
        window.__abyssQaLaunch.settled({result:'win'});
        const run=window.v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal'),pending:!!document.querySelector('.v174-abyss-node.current.pending')};
    })()`);
    assert.equal(afterWin.run.phase,"chest");
    assert.equal(afterWin.run.chestSpawned,true);
    assert.equal(afterWin.run.portalUnlocked,false);
    assert.equal(afterWin.chest,true,"Victory must spawn a chest on the map");
    assert.equal(afterWin.portal,false,"Portal must not exist before the chest is claimed");
    assert.equal(afterWin.pending,true,"The five-node HUD must show chest-pending state before completion");

    await client.eval(`document.querySelector('.v174-abyss-chest')?.click(); true`);
    await sleep(1800);
    const afterClaim=await client.eval(`(()=>{const run=v174AbyssGetRunState(20);return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};})()`);
    assert.equal(afterClaim.run.chestClaimed,true);
    assert.equal(afterClaim.run.portalUnlocked,true);
    assert.equal(afterClaim.chest,false);
    assert.equal(afterClaim.portal,true,"Claiming the chest must unlock and render the portal");

    await client.eval(`document.querySelector('.v174-abyss-portal')?.click(); true`);
    await sleep(1800);
    let run=await client.eval(`v174AbyssGetRunState(20)`);
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[0,1,"ready"]);

    await client.eval(`v174AbyssResolveBattleResult('win'); true`);
    run=await client.eval(`v174AbyssGetRunState(20)`);
    assert.equal(run.phase,"chest");
    await client.send("Page.reload",{ignoreCache:true});
    await waitFor(client,"document.readyState==='complete'","reload after pending chest");
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true","Abyss runtime after reload",30000);
    const pendingReload=await client.eval(`(async()=>{
        window.v133GetHighestCreatedCharacterLevel=()=>20;
        if(typeof showPage==='function'){showPage('dungeon');}
        if(typeof switchDungeonTab==='function'){switchDungeonTab('abyss');}
        v174AbyssSelectDifficulty(20);
        await new Promise(resolve=>setTimeout(resolve,80));
        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};
    })()`);
    assert.deepEqual([pendingReload.run.regionIndex,pendingReload.run.encounterIndex,pendingReload.run.phase],[0,1,"chest"]);
    assert.equal(pendingReload.chest,true,"Pending chest must survive reload");
    assert.equal(pendingReload.portal,false);

    await client.eval(`document.querySelector('.v174-abyss-chest')?.click(); true`);
    await sleep(1800);
    await client.send("Page.reload",{ignoreCache:true});
    await waitFor(client,"document.readyState==='complete'","reload after claimed chest");
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true","Abyss runtime after claimed reload",30000);
    const claimedReload=await client.eval(`(async()=>{
        window.v133GetHighestCreatedCharacterLevel=()=>20;
        if(typeof showPage==='function'){showPage('dungeon');}
        if(typeof switchDungeonTab==='function'){switchDungeonTab('abyss');}
        v174AbyssSelectDifficulty(20);
        await new Promise(resolve=>setTimeout(resolve,80));
        const run=v174AbyssGetRunState(20);
        return {run,chest:!!document.querySelector('.v174-abyss-chest'),portal:!!document.querySelector('.v174-abyss-portal')};
    })()`);
    assert.equal(claimedReload.run.phase,"portal");
    assert.equal(claimedReload.chest,false,"Claimed chest must never respawn after reload");
    assert.equal(claimedReload.portal,true);

    await client.eval(`document.querySelector('.v174-abyss-portal')?.click(); true`);
    await sleep(1800);
    for(const encounter of [2,3]){
        await client.eval(`v174AbyssResolveBattleResult('win'); true`);
        await client.eval(`document.querySelector('.v174-abyss-chest')?.click(); true`);
        await sleep(1800);
        const beforePortal=await client.eval(`(()=>{const run=v174AbyssGetRunState(20);return {index:run.encounterIndex,bossGate:!!document.querySelector('.v174-abyss-portal.boss-gate')};})()`);
        if(encounter===3){ assert.equal(beforePortal.bossGate,true,"Fourth pre-stage must unlock a visually distinct boss gate"); }
        await client.eval(`document.querySelector('.v174-abyss-portal')?.click(); true`);
        await sleep(1800);
    }
    run=await client.eval(`v174AbyssGetRunState(20)`);
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[0,4,"ready"]);
    assert.equal(await client.eval(`!!document.querySelector('.v174-abyss-encounter.boss')`),true,"Boss encounter marker is missing");

    const bossLaunch=await client.eval(`(async()=>{
        window.__abyssQaLaunch=null;
        window.v132LaunchDungeonBattle=(roster,settled)=>{ window.__abyssQaLaunch={roster,settled}; return true; };
        window.rpgConfirm=()=>Promise.resolve(true);
        v174AbyssStartEncounter();
        await new Promise(resolve=>setTimeout(resolve,1800));
        const launch=window.__abyssQaLaunch;
        return launch?{
            count:launch.roster.length,
            bosses:launch.roster.filter(monster=>monster.rank==='boss').map(monster=>({name:monster.name,hp:monster.maxHP,skill:monster.v141ForceSkillLevel})),
            eliteCount:launch.roster.filter(monster=>monster.rank==='elite').length,
            eliteHp:launch.roster.find(monster=>monster.rank==='elite')?.maxHP
        }:null;
    })()`);
    assert.ok(bossLaunch,"Lv20 boss did not reach the shared dungeon battle launcher");
    assert.equal(bossLaunch.count,10);
    assert.equal(bossLaunch.eliteCount,9);
    assert.deepEqual(bossLaunch.bosses,[{name:"東帝",hp:3090,skill:1}]);
    assert.equal(bossLaunch.eliteHp,1510);

    await client.eval(`window.__abyssQaLaunch.settled({result:'win'}); true`);
    assert.equal(await client.eval(`!!document.querySelector('.v174-abyss-chest')`),true,"Boss victory must spawn an emperor chest");
    await client.eval(`document.querySelector('.v174-abyss-chest')?.click(); true`);
    await sleep(1800);
    const bossClaim=await client.eval(`(()=>{const run=v174AbyssGetRunState(20);return {run,portal:!!document.querySelector('.v174-abyss-portal')};})()`);
    assert.equal(bossClaim.run.regionCompleted,true);
    assert.equal(bossClaim.run.portalUnlocked,true);
    assert.equal(bossClaim.portal,true,"Boss chest must unlock the next-region portal");
    await client.eval(`document.querySelector('.v174-abyss-portal')?.click(); true`);
    await sleep(1800);
    run=await client.eval(`v174AbyssGetRunState(20)`);
    assert.deepEqual([run.regionIndex,run.encounterIndex,run.phase],[1,0,"ready"]);

    const lv40=await client.eval(`(()=>{
        const pre=v174AbyssBuildRoster(40,0,0);
        const boss=v174AbyssBuildRoster(40,4,4);
        return {
            preLevels:pre.map(monster=>monster.level),preSkills:pre.map(monster=>monster.v141ForceSkillLevel),regularHp:pre[0].maxHP,eliteHp:pre[5].maxHP,
            bossCount:boss.filter(monster=>monster.rank==='boss').length,eliteCount:boss.filter(monster=>monster.rank==='elite').length,
            bossName:boss.find(monster=>monster.rank==='boss')?.name,bossHp:boss.find(monster=>monster.rank==='boss')?.maxHP,
            bossSkill:boss.find(monster=>monster.rank==='boss')?.v141ForceSkillLevel,bossEliteHp:boss.find(monster=>monster.rank==='elite')?.maxHP
        };
    })()`);
    assert.equal(lv40.preLevels.every(level=>level===40),true);
    assert.equal(lv40.preSkills.every(level=>level===2),true);
    assert.deepEqual([lv40.regularHp,lv40.eliteHp],[644,2059]);
    assert.deepEqual([lv40.bossCount,lv40.eliteCount,lv40.bossName,lv40.bossHp,lv40.bossSkill,lv40.bossEliteHp],[1,9,"極帝天尊",5149,2,2517]);

    const assetResults=await client.eval(`Promise.all([
        'assets/dungeons/abyss/abyss-cover.webp','assets/dungeons/abyss/abyss-cover-v17343.png',
        ...[1,2,3,4,5].map(n=>'assets/dungeons/abyss/maps/floor-'+n+'.png'),
        'assets/dungeons/abyss/portal.png','assets/dungeons/abyss/chest-closed.png','assets/dungeons/abyss/chest-open.png',
        'assets/dungeons/abyss/east-emperor.webp','assets/dungeons/abyss/south-emperor.webp','assets/dungeons/abyss/heaven-emperor.webp','assets/dungeons/abyss/north-emperor.webp','assets/dungeons/abyss/floor5-extreme-emperor.webp'
    ].map(async asset=>{const response=await fetch(asset,{cache:'no-store'});return {asset,ok:response.ok,status:response.status};}))`);
    assetResults.forEach(item=>assert.equal(item.ok,true,`${item.asset} returned HTTP ${item.status}`));

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
    fs.writeFileSync(path.join(artifactDir,"abyss-mobile.png"),Buffer.from(screenshot.data,"base64"));

    const report={
        status:"PASS",
        expectedSha,
        devUrl:baseUrl,
        viewport:{width:412,height:915,deviceScaleFactor:3},
        coverCards:bootstrap,
        lv20PreStage:{count:preLaunch.count,ranks:preLaunch.ranks,regularHp:preLaunch.hps[0],eliteHp:preLaunch.hps[5]},
        chestFlow:{victoryPhase:afterWin.run.phase,portalBeforeClaim:afterWin.portal,portalAfterClaim:afterClaim.portal,pendingChestReload:true,claimedChestReloadBlocked:true},
        bossFlow:{boss:bossLaunch.bosses[0],eliteCount:bossLaunch.eliteCount,eliteHp:bossLaunch.eliteHp,nextRegion:run.regionIndex},
        lv40,
        assetsChecked:assetResults.length,
        screenshot:"artifacts/browser-qa/abyss-mobile.png"
    };
    fs.writeFileSync(path.join(artifactDir,"abyss-live-qa.json"),JSON.stringify(report,null,2)+"\n");
    console.log("Abyss live mobile browser QA: PASS");
    console.log(JSON.stringify(report,null,2));
} catch(error){
    const failure={status:"FAIL",expectedSha,devUrl:baseUrl,error:error?.stack||String(error),chromeStderr:chromeStderr.slice(-4000)};
    fs.writeFileSync(path.join(artifactDir,"abyss-live-qa.json"),JSON.stringify(failure,null,2)+"\n");
    console.error("Abyss live mobile browser QA: FAIL");
    console.error(error?.stack||error);
    process.exitCode=1;
} finally{
    client?.close();
    try{ child.kill("SIGTERM"); }catch{}
    await sleep(100);
    try{ fs.rmSync(profile,{recursive:true,force:true}); }catch{}
}
