import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import {spawn,spawnSync} from "node:child_process";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=8899,debugPort=9223;
const baseUrl=`http://127.0.0.1:${port}`;
const qaUrl=`${baseUrl}/?skill-progression-browser-qa=${Date.now()}`;

function chromeBinary(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for skill progression browser QA.");
}
function httpText(url){
    return new Promise((resolve,reject)=>{
        const request=http.get(url,{headers:{"cache-control":"no-cache"}},response=>{
            let body="";
            response.setEncoding("utf8");
            response.on("data",chunk=>{ body+=chunk; });
            response.on("end",()=>response.statusCode>=200&&response.statusCode<300
                ?resolve(body):reject(new Error(`HTTP ${response.statusCode}`)));
        });
        request.setTimeout(3000,()=>request.destroy(new Error("HTTP request timeout")));
        request.on("error",reject);
    });
}
async function waitHttp(url,json=false,timeoutMs=15000){
    const started=Date.now();let lastError=null;
    while(Date.now()-started<timeoutMs){
        try{ const text=await httpText(url);return json?JSON.parse(text):text; }
        catch(error){ lastError=error;await sleep(120); }
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError?.message||"no response"}`);
}

class Cdp{
    constructor(url){this.url=url;this.nextId=1;this.pending=new Map();this.errors=[];}
    async connect(){
        this.socket=new WebSocket(this.url);
        await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(new Error("CDP connection timeout")),10000);
            this.socket.onopen=()=>{clearTimeout(timeout);resolve();};
            this.socket.onerror=()=>{clearTimeout(timeout);reject(new Error("CDP WebSocket error"));};
        });
        this.socket.onmessage=async event=>{
            let raw=event.data;if(raw&&typeof raw!=="string"&&typeof raw.text==="function"){raw=await raw.text();}
            const message=JSON.parse(String(raw));
            if(message.method==="Runtime.exceptionThrown"){
                this.errors.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||"Runtime exception");return;
            }
            if(message.method==="Runtime.consoleAPICalled"&&message.params?.type==="error"){
                this.errors.push((message.params.args||[]).map(arg=>arg.value??arg.description??"").join(" "));return;
            }
            if(!message.id){return;}
            const request=this.pending.get(message.id);if(!request){return;}this.pending.delete(message.id);
            if(message.error){request.reject(new Error(`${request.method}: ${message.error.message}`));}
            else{request.resolve(message.result||{});}
        };
    }
    send(method,params={}){
        const id=this.nextId++;
        return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,method});this.socket.send(JSON.stringify({id,method,params}));});
    }
    async eval(expression){
        const response=await this.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});
        if(response.exceptionDetails){throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text||"Runtime evaluation failed");}
        return response.result?.value;
    }
    close(){try{this.socket?.close();}catch{}}
}
async function waitFor(client,expression,label,timeoutMs=30000){
    const started=Date.now();let last="";
    while(Date.now()-started<timeoutMs){
        try{if(await client.eval(`Boolean(${expression})`)){return;}}catch(error){last=error.message;}
        await sleep(160);
    }
    throw new Error(`Timed out waiting for ${label}. ${last}`);
}

const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1"],{cwd:process.cwd(),stdio:["ignore","ignore","pipe"]});
let serverError="";server.stderr.on("data",chunk=>{serverError+=String(chunk);});
let chrome=null,client=null;

try{
    await waitHttp(baseUrl+"/index.html");
    chrome=spawn(chromeBinary(),[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
        `--remote-debugging-port=${debugPort}`,`--user-data-dir=${path.join("/tmp",`four-symbols-skill-qa-${process.pid}`)}`,
        "--window-size=390,844","about:blank"
    ],{stdio:["ignore","ignore","pipe"]});
    const targets=await waitHttp(`http://127.0.0.1:${debugPort}/json/list`,true);
    const page=targets.find(target=>target.type==="page");assert.ok(page?.webSocketDebuggerUrl,"Chrome DevTools page target unavailable");
    client=new Cdp(page.webSocketDebuggerUrl);await client.connect();
    await client.send("Page.enable");await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
    await client.send("Page.navigate",{url:qaUrl});
    await waitFor(client,"document.readyState==='complete'","page load");
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&window.__v17364SkillProgressionInstalled===true","58→59→60 late runtime chain");

    await client.eval(`(()=>{
        Object.assign(player,{id:'寒泉一號',element:'water',level:19,skillPoints:999,hp:1000,sp:1000,activeBuffs:[],statusEffects:[]});
        player2={id:'寒泉二號',element:'water',level:10,skillPoints:999,hp:1000,sp:1000,activeBuffs:[],statusEffects:[],isDefending:false};
        if(!characters.some(character=>character.id==='player2')){characters.push({id:'player2',name:player2.id});}
        characterSkillLoadouts.water={name:player.id,skillLevels:{healSpell:1},equippedSkills:[]};
        characterSkillLoadouts.player2={name:player2.id,skillLevels:{healSpell:1},equippedSkills:[]};
        currentSkillCharacter='water';
        if(typeof openHomeFeature==='function'){openHomeFeature('character');}
        if(typeof switchCharacterTab==='function'){switchCharacterTab('skill');}
        renderSkillLoadout();return true;
    })()`);
    await sleep(120);

    const rowState=()=>client.eval(`(()=>{
        const row=Array.from(document.querySelectorAll('#allSkillsList .skill-row')).find(item=>item.querySelector('#skillIcon_revive'));
        if(!row){return null;}
        const cards=Array.from(row.querySelectorAll('.skill-action-card'));
        const card=cards.find(item=>/learnSkill|upgradeSkill/.test(String(item.getAttribute('onclick')||''))||/學習|升級|Lv20|技能點/.test(String(item.textContent||'')))||cards[0]||null;
        const label=card?.querySelector('.skill-action-card-label');const rr=row.getBoundingClientRect();const cr=card?.getBoundingClientRect();
        return {label:label?.textContent.replace(/\\s+/g,' ').trim()||'',disabled:!!card?.classList.contains('disabled'),onclick:card?.getAttribute('onclick')||'',horizontalOverflow:row.scrollWidth>row.clientWidth+1,actionOutside:!!(cr&&(cr.left<rr.left-1||cr.right>rr.right+1))};
    })()`);

    let state=await rowState();assert.ok(state,"Revive skill row is missing");assert.equal(state.disabled,true);assert.match(state.label,/Lv20/);assert.equal(state.horizontalOverflow,false);assert.equal(state.actionOutside,false);
    await client.eval(`player.level=20;currentSkillCharacter='water';renderSkillLoadout();true`);
    state=await rowState();assert.equal(state.disabled,false);assert.match(state.onclick,/learnSkill\('revive'\)/);
    await client.eval(`currentSkillCharacter='player2';renderSkillLoadout();true`);
    state=await rowState();assert.equal(state.disabled,true,"Second character must use its own Lv10 gate");assert.match(state.label,/Lv20/);

    const ui=await client.eval(`(()=>{
        currentSkillCharacter='water';player.level=20;renderSkillLoadout();showSkillDetail('revive');
        const root=document.getElementById('characterTabContent'),page=document.getElementById('skillPage'),details=document.getElementById('skillDetailStats');
        const pageText=page?.textContent||'';const rows=Array.from(document.querySelectorAll('#allSkillsList .skill-row'));
        const probe=document.createElement('div');probe.dataset.skillScrollProbe='1';probe.style.height='1200px';probe.style.width='1px';probe.style.pointerEvents='none';page?.appendChild(probe);
        const before=root?.scrollTop||0;if(root){root.scrollTop=Math.max(0,root.scrollHeight-root.clientHeight);}const after=root?.scrollTop||0;
        const measurements={details:details?.textContent.replace(/\\s+/g,' ').trim()||'',forbidden:['learnLevel','requires','tier','upgradeCost'].filter(word=>pageText.includes(word)),visibleRows:rows.length,horizontalOverflow:rows.some(row=>row.scrollWidth>row.clientWidth+1),overflowY:root?getComputedStyle(root).overflowY:'',probeScrollHeight:root?.scrollHeight||0,probeClientHeight:root?.clientHeight||0,before,after,listExists:!!document.getElementById('allSkillsList')};
        probe.remove();return measurements;
    })()`);
    for(const label of ["最低學習等級","目前技能等級","下一級角色需求","學習成本","升級成本","前置技能"]){assert.match(ui.details,new RegExp(label));}
    assert.deepEqual(ui.forbidden,[]);assert.equal(ui.horizontalOverflow,false);assert.ok(ui.visibleRows>=8,"Water skill list is unexpectedly short");assert.equal(ui.listExists,true);
    assert.match(ui.overflowY,/auto|scroll/);assert.ok(ui.probeScrollHeight>ui.probeClientHeight,"Skill scroll owner did not accept overflow content");assert.ok(ui.after>ui.before,"Skill scroll owner did not move when overflow existed");
    assert.deepEqual(client.errors,[]);
    console.log("✓ Skill progression mobile browser QA passed");
}finally{
    client?.close();if(chrome){chrome.kill("SIGTERM");}server.kill("SIGTERM");
}
if(serverError&&process.exitCode){console.error(serverError);}
