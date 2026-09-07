import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const baseUrl=String(process.env.DEV_BASE_URL||"https://dev.four-symbols-dev.pages.dev").replace(/\/$/,"");
const expectedSha=String(process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||"");
const qaUrl=`${baseUrl}/?battle-layer-audio-live-qa=${encodeURIComponent(expectedSha||Date.now())}`;
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
        await sleep(180);
    }
    throw new Error(`Timed out waiting for ${label}. Last result: ${String(last)}`);
}

const evidence={status:"RUNNING",expectedSha,devUrl:baseUrl,checks:{}};
const chrome=chromeBinary();
const debugPort=9223;
const profile=path.join("/tmp",`four-symbols-battle-layer-qa-${process.pid}`);
const child=spawn(chrome,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,"--window-size=412,915","about:blank"
],{stdio:["ignore","pipe","pipe"]});
let chromeStderr="";
child.stderr.on("data",chunk=>{ chromeStderr+=String(chunk); });
let client=null;

try{
    const targets=await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
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
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime");
    await waitFor(client,"typeof window.v132LaunchDungeonBattle==='function'&&window.v141Audio&&typeof window.v141Audio.playSkill==='function'","battle/audio runtime");

    const bootstrap=await client.eval(`(()=>{
        try{sessionStorage.setItem('sixiang_startup_session_ready_v1','1');}catch(_){}
        if(typeof player!=='undefined'&&player){
            player.id=player.id||'battle-layer-live-qa';
            player.name=player.name||'QA俠客';
            player.level=40;
            player.hp=Math.max(9999,Number(player.hp)||0);
            player.sp=Math.max(9999,Number(player.sp)||0);
            player.element='fire';
        }
        window.v133GetHighestCreatedCharacterLevel=()=>40;
        if(typeof showPage==='function'){showPage('dungeon');}
        const roster=v174AbyssBuildRoster(40,0,0);
        const started=window.v132LaunchDungeonBattle(roster,()=>{});
        return {started:!!started,rosterCount:roster.length,skillVolumeScale:window.v141Audio?.skillVolumeScale||null};
    })()`);
    evidence.checks.bootstrap=bootstrap;
    assert.equal(bootstrap.started,true,"Shared dungeon launcher did not start a real battle");
    assert.equal(bootstrap.rosterCount,10,"Abyss QA roster must contain 10 enemies");
    assert.equal(bootstrap.skillVolumeScale,2,"Deployed skill SFX multiplier must be exactly 2.0 (+100%)");

    await waitFor(client,"document.getElementById('battlePage')?.classList.contains('active')&&document.getElementById('battlePlayerCard0')&&document.querySelector('#battlePlayerCard0 .hp-bar')&&document.querySelector('#battleMonster0 .monster-hp')","real battle resource bars",15000);

    const resourceLayers=await client.eval(`(()=>{
        const playerCard=document.getElementById('battlePlayerCard0');
        const monsterCard=document.getElementById('battleMonster0');
        const playerHp=playerCard?.querySelector('.hp-bar');
        const playerSp=playerCard?.querySelector('.sp-bar');
        const monsterHp=monsterCard?.querySelector('.monster-hp');
        const monsterSp=monsterCard?.querySelector('.monster-sp');
        const playerStatus=document.createElement('div');
        playerStatus.className='v153-status-vfx v153-status-vfx-rage';
        const monsterStatus=document.createElement('div');
        monsterStatus.className='v153-status-vfx v153-status-vfx-rage';
        playerCard.appendChild(playerStatus);
        monsterCard.appendChild(monsterStatus);
        const result={
            playerHpZ:Number(getComputedStyle(playerHp).zIndex||0),
            playerSpZ:Number(getComputedStyle(playerSp).zIndex||0),
            playerStatusZ:Number(getComputedStyle(playerStatus).zIndex||0),
            monsterHpZ:Number(getComputedStyle(monsterHp).zIndex||0),
            monsterSpZ:Number(getComputedStyle(monsterSp).zIndex||0),
            monsterStatusZ:Number(getComputedStyle(monsterStatus).zIndex||0),
            playerHpVisible:getComputedStyle(playerHp).visibility,
            monsterHpVisible:getComputedStyle(monsterHp).visibility
        };
        playerStatus.remove();
        monsterStatus.remove();
        return result;
    })()`);
    evidence.checks.resourceLayers=resourceLayers;
    assert.ok(resourceLayers.playerHpZ>resourceLayers.playerStatusZ,"Player HP bar must render above status VFX");
    assert.ok(resourceLayers.playerSpZ>resourceLayers.playerStatusZ,"Player SP bar must render above status VFX");
    assert.ok(resourceLayers.monsterHpZ>resourceLayers.monsterStatusZ,"Enemy HP bar must render above status VFX");
    assert.ok(resourceLayers.monsterSpZ>resourceLayers.monsterStatusZ,"Enemy SP bar must render above status VFX");
    assert.equal(resourceLayers.playerHpVisible,"visible","Player HP bar must remain visible");
    assert.equal(resourceLayers.monsterHpVisible,"visible","Enemy HP bar must remain visible");

    const castTriggered=await client.eval(`(()=>{
        if(typeof castDamageSkill!=='function'||typeof skillDatabase==='undefined'||!skillDatabase.explosiveFlurry){return false;}
        if(typeof queuedPlayerActions!=='undefined'){queuedPlayerActions[0]={action:'explosiveFlurry',target:2,targetAlly:null};}
        if(typeof selectedMonster!=='undefined'){selectedMonster=2;}
        if(typeof activeBattleCharacterIndex!=='undefined'){activeBattleCharacterIndex=0;}
        if(typeof player!=='undefined'&&player){player.sp=Math.max(9999,Number(player.sp)||0);player.element='fire';}
        if(typeof getSkillLevel==='function'&&!window.__battleLayerQaGetSkillLevelOriginal){
            window.__battleLayerQaGetSkillLevelOriginal=getSkillLevel;
            const original=getSkillLevel;
            getSkillLevel=function(key,id){return id==='explosiveFlurry'?1:original.apply(this,arguments);};
        }
        castDamageSkill('explosiveFlurry');
        return true;
    })()`);
    assert.equal(castTriggered,true,"Production Fire Explosive Flurry action could not be invoked");
    await waitFor(client,"document.getElementById('v143-skill-stage')&&getComputedStyle(document.getElementById('v143-skill-stage')).visibility==='visible'","visible V143 skill layer",3000);

    const beforeElementBox=await client.eval(`(()=>{
        const stage=document.getElementById('v143-skill-stage');
        return {skill:stage?.dataset.skill||null,visibility:stage?getComputedStyle(stage).visibility:null,opacity:stage?getComputedStyle(stage).opacity:null};
    })()`);
    evidence.checks.skillLayerBeforeElementBox=beforeElementBox;
    assert.equal(beforeElementBox.skill,"explosiveFlurry","Expected real Fire Flurry V143 layer before Element Box opens");
    assert.equal(beforeElementBox.visibility,"visible","Skill layer must be visible during normal battle presentation");

    const opened=await client.eval(`(()=>{
        if(typeof openAutoBattleSettings==='function'){openAutoBattleSettings();return 'openAutoBattleSettings';}
        if(typeof openHomeFeature==='function'){openHomeFeature('autoBattleSettings');return 'openHomeFeature';}
        return null;
    })()`);
    assert.ok(opened,"No Element Box settings opener is available");
    await waitFor(client,"document.body.classList.contains('v162-element-box-settings-open')","Element Box focus class",3000);

    const elementBoxLayers=await client.eval(`(()=>{
        const stage=document.getElementById('v143-skill-stage');
        const modal=document.getElementById('homeFeatureModal');
        const panel=document.getElementById('autoBattleSettingsPanel');
        const stageStyle=stage?getComputedStyle(stage):null;
        const modalStyle=modal?getComputedStyle(modal):null;
        const panelStyle=panel?getComputedStyle(panel):null;
        const modalRect=modal?.getBoundingClientRect();
        const panelRect=panel?.getBoundingClientRect();
        return {
            bodyFocus:document.body.classList.contains('v162-element-box-settings-open'),
            stageStillExists:!!stage,
            stageVisibility:stageStyle?.visibility||null,
            stageOpacity:stageStyle?.opacity||null,
            modalDisplay:modalStyle?.display||null,
            panelDisplay:panelStyle?.display||null,
            modalWidth:modalRect?.width||0,modalHeight:modalRect?.height||0,
            panelWidth:panelRect?.width||0,panelHeight:panelRect?.height||0,
            skillVolumeScale:window.v141Audio?.skillVolumeScale||null
        };
    })()`);
    evidence.checks.elementBoxLayers=elementBoxLayers;
    assert.equal(elementBoxLayers.bodyFocus,true,"Element Box focus class must be active");
    assert.equal(elementBoxLayers.stageStillExists,true,"V143 lifecycle stage must remain mounted while its presentation is suppressed");
    assert.equal(elementBoxLayers.stageVisibility,"hidden","Skill presentation must be hidden behind Element Box settings");
    assert.equal(Number(elementBoxLayers.stageOpacity),0,"Skill presentation opacity must be zero while Element Box settings owns focus");
    assert.notEqual(elementBoxLayers.panelDisplay,"none","Element Box settings panel must remain visible");
    assert.ok(elementBoxLayers.panelWidth>0&&elementBoxLayers.panelHeight>0,"Element Box settings panel must have visible geometry");
    assert.equal(elementBoxLayers.skillVolumeScale,2,"Live audio engine must expose the 2.0 skill SFX scale");

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(screenshot.data){ fs.writeFileSync(path.join(artifactDir,"battle-layer-element-box-mobile.png"),Buffer.from(screenshot.data,"base64")); }

    evidence.status="PASS";
    evidence.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(artifactDir,"battle-layer-audio-live-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.log("Battle layer/audio live mobile QA: PASS");
} catch(error){
    evidence.status="FAIL";
    evidence.error=error?.stack||String(error);
    evidence.chromeStderr=chromeStderr.slice(-5000);
    evidence.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(artifactDir,"battle-layer-audio-live-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.error("Battle layer/audio live mobile QA: FAIL");
    console.error(error);
    process.exitCode=1;
} finally{
    client?.close();
    child.kill("SIGTERM");
}
