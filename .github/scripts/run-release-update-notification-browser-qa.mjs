#!/usr/bin/env node
/*
   Focused mobile visual QA for the Release Update Notification System.
   It uses the production source/CSS in an isolated browser fixture so the
   manifest request, native marquee, shared modal geometry and hit testing are
   exercised at the three project mobile viewports without changing game data.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

const ROOT=process.cwd();
const ARTIFACT_DIR=path.join(ROOT,"artifacts","browser-qa");
const VIEWPORTS=[[360,800],[390,844],[412,915]];
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

function findChrome(){
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const result=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(result.status===0&&result.stdout.trim()){ return result.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is required for Release Update Notification mobile QA.");
}

function inlineScript(source){ return source.replace(/<\/script/gi,"<\\/script"); }
function inlineStyle(source){ return source.replace(/<\/style/gi,"<\\/style"); }

function createFixture(){
    const styles=[
        "css/00-main.css",
        "css/02-stage-v3-layout-fix.css",
        "css/03-stage-v4-viewport-lock.css",
        "css/release-update-notification.css"
    ].map(read).map(inlineStyle).join("\n");
    const longContent=Array.from({length:10},(_,index)=>
        "第"+(index+1)+"項正式更新內容：調整玩家可直接感受到的操作流程與穩定性。"
    );
    const manifest={
        schemaVersion:1,
        publicNotice:true,
        releaseVersion:"V173.42",
        noticeId:"release-v17342",
        title:"V173.42 更新",
        summary:"雲端帳號、秘寶與戰鬥體驗優化",
        content:longContent,
        publishedAt:"2026-09-19T00:00:00.000Z",
        updateMode:"normal",
        minimumVersion:null
    };
    const prelude=`
        window.__FOUR_SYMBOLS_BUILD__=Object.freeze({release:"173.41"});
        window.FourSymbolsAccountSave={accountKey:function(suffix){return "four_symbols_account:browser-qa:"+suffix;}};
        window.FourSymbolsBattleFlow={isPresentationActive:function(){return false;}};
        window.battleActive=false;
        window.battlePhase="declare";
        window.fetch=function(){return Promise.resolve({ok:true,json:async function(){return ${JSON.stringify(manifest)};}});};
        window.closeHomeFeature=function(){
            var api=window.FourSymbolsReleaseUpdate;
            if(api&&api.shouldPreventSharedModalClose()){return false;}
            if(api){api.onSharedModalClosed();}
            document.getElementById("homeFeatureModal").classList.remove("show");
            return true;
        };
        function fitStage(){
            var stage=document.getElementById("game-stage");
            var scale=Math.min(window.innerWidth/1080,window.innerHeight/1920);
            stage.style.transform="scale("+scale+")";
            window.gameStageScale=scale;
        }
        window.addEventListener("resize",fitStage);
        fitStage();
    `;
    return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style>
<style>
#qaBattleAction{position:absolute;left:20px;top:630px;width:150px;height:48px;z-index:1;}
#homeFeatureModalBody{min-height:0;}
</style></head><body>
<div id="game-viewport"><div id="game-stage">
  <div id="game-overlay-layer" aria-hidden="true"></div>
  <div id="app"><div id="game-content">
    <button id="qaBattleAction" type="button">戰鬥技能</button>
    <div id="homeFeatureModal" class="home-feature-modal"><div class="home-feature-modal-box">
      <div class="home-feature-modal-title"><span id="homeFeatureModalTitle">標題</span><div><button class="home-feature-close-btn" type="button" onclick="closeHomeFeature()">返回</button></div></div>
      <div id="homeFeatureModalBody"></div>
    </div></div>
  </div></div>
</div></div>
<script>${inlineScript(prelude)}</script>
<script>${inlineScript(read("js/release-update-notification.js"))}</script>
<script>document.dispatchEvent(new Event("four-symbols:startup-ready"));</script>
</body></html>`;
}

async function waitForJson(url,timeoutMs=15000){
    const started=Date.now();
    let lastError=null;
    while(Date.now()-started<timeoutMs){
        try{
            const response=await fetch(url);
            if(response.ok){ return response.json(); }
        }catch(error){ lastError=error; }
        await sleep(80);
    }
    throw new Error("Timed out waiting for Chrome DevTools: "+String(lastError&&lastError.message||lastError||"no response"));
}

class CdpClient{
    constructor(url){
        this.url=url;
        this.socket=null;
        this.nextId=1;
        this.pending=new Map();
        this.events=[];
    }
    async connect(){
        this.socket=new WebSocket(this.url);
        await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error("CDP connection timeout")),10000);
            this.socket.onopen=()=>{clearTimeout(timer);resolve();};
            this.socket.onerror=()=>{clearTimeout(timer);reject(new Error("CDP connection failed"));};
        });
        this.socket.onmessage=async event=>{
            let raw=event.data;
            if(raw&&typeof raw!=="string"&&typeof raw.text==="function"){ raw=await raw.text(); }
            const message=JSON.parse(String(raw));
            if(!message.id){
                if(["Runtime.exceptionThrown","Runtime.consoleAPICalled","Log.entryAdded"].includes(message.method)){
                    this.events.push(message);
                }
                return;
            }
            const request=this.pending.get(message.id);
            if(!request){ return; }
            this.pending.delete(message.id);
            if(message.error){ request.reject(new Error(request.method+": "+message.error.message)); }
            else{ request.resolve(message.result||{}); }
        };
        this.socket.onclose=()=>{
            for(const request of this.pending.values()){
                request.reject(new Error("CDP closed during "+request.method));
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
    async evaluate(expression){
        const response=await this.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});
        if(response.exceptionDetails){
            throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text||"Runtime evaluation failed");
        }
        return response.result?.value;
    }
    close(){ try{ this.socket&&this.socket.close(); }catch(_){ } }
}

async function waitFor(client,expression,label,timeoutMs=12000){
    const started=Date.now();
    let last="";
    while(Date.now()-started<timeoutMs){
        try{
            if(await client.evaluate("Boolean("+expression+")")){ return; }
        }catch(error){ last=error.message; }
        await sleep(80);
    }
    throw new Error("Timed out waiting for "+label+". "+last);
}

async function runViewport(chrome,fixtureUrl,width,height){
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),"release-update-browser-qa-"));
    const port=9300+Math.floor(Math.random()*400);
    const process=spawn(chrome,[
        "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
        "--remote-debugging-address=127.0.0.1","--remote-debugging-port="+port,
        "--user-data-dir="+profile,"about:blank"
    ],{stdio:["ignore","ignore","pipe"]});
    let stderr="";
    process.stderr.on("data",chunk=>{stderr+=String(chunk);});
    let client=null;
    try{
        const targets=await waitForJson("http://127.0.0.1:"+port+"/json/list");
        const page=targets.find(target=>target.type==="page");
        assert.ok(page&&page.webSocketDebuggerUrl,"Chrome page target unavailable: "+stderr.slice(-1000));
        client=new CdpClient(page.webSocketDebuggerUrl);
        await client.connect();
        await client.send("Page.enable");
        await client.send("Runtime.enable");
        await client.send("Log.enable");
        await client.send("Emulation.setDeviceMetricsOverride",{
            width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,
            screenOrientation:{type:"portraitPrimary",angle:0}
        });
        await client.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
        await client.send("Page.navigate",{url:fixtureUrl});
        await waitFor(client,"document.getElementById('releaseUpdateMarquee')&&!document.getElementById('releaseUpdateMarquee').hidden","release marquee");
        const marquee=await client.evaluate(`(()=>{
            const el=document.getElementById("releaseUpdateMarquee");
            const action=document.getElementById("qaBattleAction");
            const rect=el.getBoundingClientRect();
            const actionRect=action.getBoundingClientRect();
            return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom},
                actionHit:document.elementFromPoint(actionRect.x+actionRect.width/2,actionRect.y+actionRect.height/2)?.id||null,
                actionRect:{width:actionRect.width,height:actionRect.height}};
        })()`);
        assert.ok(marquee.rect.width>width*.85&&marquee.rect.width<=width+1,"marquee must stay inside the mobile stage width");
        assert.ok(marquee.rect.height>=44,"marquee touch surface fell below 44 CSS pixels");
        assert.ok(marquee.rect.y>=0&&marquee.rect.bottom<=height+1,"marquee escapes the visible mobile viewport");
        assert.equal(marquee.actionHit,"qaBattleAction","the notification layer must not eat the battle action hitbox");
        assert.ok(marquee.actionRect.height>=40,"battle action fixture unexpectedly collapsed");

        await client.evaluate("document.getElementById('releaseUpdateMarquee').click()");
        await waitFor(client,"document.getElementById('homeFeatureModal').classList.contains('show')","shared update detail modal");
        const modal=await client.evaluate(`(()=>{
            const modal=document.getElementById("homeFeatureModal");
            const box=modal.querySelector(".home-feature-modal-box");
            const body=document.getElementById("homeFeatureModalBody");
            const buttons=[...body.querySelectorAll("[data-release-update-action]")].map(button=>{
                const rect=button.getBoundingClientRect();
                return {text:button.textContent,width:rect.width,height:rect.height};
            });
            const rect=box.getBoundingClientRect();
            return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom},
                bodyOverflow:getComputedStyle(body).overflowY,boxOverflow:getComputedStyle(box).overflowY,
                bodyScrollHeight:body.scrollHeight,bodyClientHeight:body.clientHeight,buttons,
                scrollWidth:document.documentElement.scrollWidth,viewportWidth:window.innerWidth,
                title:document.getElementById("homeFeatureModalTitle").textContent,content:body.textContent};
        })()`);
        assert.equal(modal.title,"V173.42 更新");
        assert.match(modal.content,/第10項正式更新內容/);
        assert.ok(modal.rect.x>=-1&&modal.rect.bottom<=height+1,"update modal must remain within the portrait viewport");
        assert.ok(["auto","scroll"].includes(modal.bodyOverflow),"only the modal body may own release-note scrolling");
        assert.equal(modal.boxOverflow,"hidden","modal frame must not become a second competing scroll container");
        assert.ok(modal.bodyScrollHeight>modal.bodyClientHeight,"long release notes must scroll inside the modal body");
        assert.deepEqual(modal.buttons.map(button=>button.text),["稍後更新","立即更新"]);
        modal.buttons.forEach(button=>assert.ok(button.height>=44,"update action hit target fell below 44 CSS pixels"));
        assert.ok(modal.scrollWidth<=modal.viewportWidth+1,"release UI introduced horizontal document overflow");

        const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
        if(screenshot.data){
            fs.writeFileSync(path.join(ARTIFACT_DIR,"release-update-notification-"+width+"x"+height+".png"),Buffer.from(screenshot.data,"base64"));
        }
        const errors=client.events.filter(event=>
            event.method==="Runtime.exceptionThrown"||
            (event.method==="Runtime.consoleAPICalled"&&event.params.type==="error")||
            (event.method==="Log.entryAdded"&&event.params.entry.level==="error")
        );
        assert.equal(errors.length,0,"release notification mobile fixture emitted a console/runtime error");
        return {viewport:[width,height],marquee,modal};
    }finally{
        client&&client.close();
        process.kill("SIGTERM");
        fs.rmSync(profile,{recursive:true,force:true});
    }
}

const fixture=path.join(ROOT,".release-update-notification-browser-qa-"+process.pid+".html");
fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
fs.writeFileSync(fixture,createFixture(),"utf8");
const evidence={schemaVersion:1,status:"RUNNING",viewports:[],source:{runtime:"js/release-update-notification.js",style:"css/release-update-notification.css"}};

try{
    const chrome=findChrome();
    const fixtureUrl=pathToFileURL(fixture).href;
    for(const [width,height] of VIEWPORTS){
        evidence.viewports.push(await runViewport(chrome,fixtureUrl,width,height));
    }
    evidence.status="PASS";
    fs.writeFileSync(path.join(ARTIFACT_DIR,"release-update-notification-browser-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.log("✓ Release Update Notification mobile browser QA passed: "+VIEWPORTS.map(viewport=>viewport.join("x")).join(", "));
}catch(error){
    evidence.status="FAIL";
    evidence.error=error&&error.stack||String(error);
    fs.writeFileSync(path.join(ARTIFACT_DIR,"release-update-notification-browser-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.error(error);
    process.exitCode=1;
}finally{
    fs.rmSync(fixture,{force:true});
}
