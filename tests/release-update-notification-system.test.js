"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {URL}=require("node:url");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const runtimeSource=read("js/release-update-notification.js");
const manifestPath="release/release-update.json";

class FakeClassList{
    constructor(){ this.values=new Set(); }
    add(...names){ names.forEach(name=>this.values.add(name)); }
    remove(...names){ names.forEach(name=>this.values.delete(name)); }
    contains(name){ return this.values.has(name); }
    toggle(name,force){
        const next=force===undefined?!this.values.has(name):!!force;
        if(next){ this.values.add(name); }
        else{ this.values.delete(name); }
        return next;
    }
}

class FakeElement{
    constructor(id=""){
        this.id=id;
        this.classList=new FakeClassList();
        this.children=[];
        this.listeners={};
        this.attributes={};
        this.hidden=false;
        this.isConnected=false;
        this.textContent="";
        this._innerHTML="";
        this.style={};
        this.type="";
        this.ownerDocument=null;
    }
    set innerHTML(value){
        this._innerHTML=String(value);
        this._selectorChildren={};
        [".release-update-marquee-tag",".release-update-marquee-text",".release-update-marquee-action",".release-update-primary"].forEach(selector=>{
            this._selectorChildren[selector]=new FakeElement();
        });
    }
    get innerHTML(){ return this._innerHTML; }
    appendChild(child){
        this.children.push(child);
        child.isConnected=true;
        child.parentNode=this;
        return child;
    }
    addEventListener(type,listener){
        (this.listeners[type]||(this.listeners[type]=[])).push(listener);
    }
    dispatch(type,event={}){
        (this.listeners[type]||[]).forEach(listener=>listener({
            preventDefault(){},stopImmediatePropagation(){},currentTarget:this,...event
        }));
    }
    setAttribute(name,value){ this.attributes[name]=String(value); }
    getAttribute(name){ return this.attributes[name]||null; }
    querySelector(selector){
        if(selector===".home-feature-modal-box"){ return this.box||null; }
        return this._selectorChildren&&this._selectorChildren[selector]||null;
    }
    querySelectorAll(){ return []; }
    focus(){}
}

function releaseManifest(version,overrides={}){
    const compact=version.replace(/^V/i,"").replace(/\./g,"");
    return {
        schemaVersion:1,
        publicNotice:true,
        releaseVersion:version,
        noticeId:"release-v"+compact,
        title:version+" 更新",
        summary:"冒險體驗優化與錯誤修正",
        content:["新增玩家可感知的遊戲體驗優化。","修正玩家操作時可能遇到的問題。"],
        publishedAt:"2026-09-19T00:00:00.000Z",
        updateMode:"normal",
        minimumVersion:null,
        ...overrides
    };
}

function createHarness({
    loadedVersion="173.41",
    responses=[],
    seen=null,
    locationHref="https://example.test/my-game/"
}={}){
    const elements=new Map();
    const element=id=>{
        const node=new FakeElement(id);
        node.ownerDocument=document;
        elements.set(id,node);
        return node;
    };
    const documentListeners={};
    const windowListeners={};
    const document={
        baseURI:"https://example.test/my-game/index.html",
        hidden:false,
        visibilityState:"visible",
        addEventListener(type,listener){ (documentListeners[type]||(documentListeners[type]=[])).push(listener); },
        dispatch(type,event={}){ (documentListeners[type]||[]).forEach(listener=>listener(event)); },
        getElementById(id){ return elements.get(id)||null; },
        createElement(){ const node=new FakeElement(); node.ownerDocument=document; return node; }
    };
    const overlay=element("game-overlay-layer");
    const modal=element("homeFeatureModal");
    modal.box=new FakeElement("homeFeatureModalBox");
    const title=element("homeFeatureModalTitle");
    const body=element("homeFeatureModalBody");
    element("v132RewardModal");
    element("v169RpgDialogLayer");

    const storage=new Map();
    if(seen){
        storage.set("four_symbols_account:test:release-update-last-seen-version",seen.releaseVersion);
        storage.set("four_symbols_account:test:release-update-last-seen-notice",seen.noticeId);
    }
    const localStorage={
        getItem:key=>storage.has(key)?storage.get(key):null,
        setItem:(key,value)=>storage.set(key,String(value))
    };
    const fetchCalls=[];
    const timers=new Map();
    const intervals=new Map();
    let nextTimer=1;
    let reloads=0;
    const windowObject={
        document,
        localStorage,
        URL,
        AbortController,
        Date,
        Promise,
        Map,
        Set,
        console:{error(){ throw new Error("release runtime must not log an error for expected check failures"); },warn(){},log(){}},
        __FOUR_SYMBOLS_BUILD__:{release:loadedVersion},
        FourSymbolsAccountSave:{accountKey:suffix=>"four_symbols_account:test:"+suffix},
        FourSymbolsBattleFlow:{isPresentationActive:()=>false},
        battleActive:false,
        battlePhase:"declare",
        location:{
            href:locationHref,
            hostname:new URL(locationHref).hostname,
            reload(){ reloads++; }
        },
        addEventListener(type,listener){ (windowListeners[type]||(windowListeners[type]=[])).push(listener); },
        dispatch(type,event={}){ (windowListeners[type]||[]).forEach(listener=>listener(event)); },
        setTimeout(fn,ms){ const id=nextTimer++; timers.set(id,{fn,ms}); return id; },
        clearTimeout(id){ timers.delete(id); },
        setInterval(fn,ms){ const id=nextTimer++; intervals.set(id,{fn,ms}); return id; },
        clearInterval(id){ intervals.delete(id); },
        fetch(url,options){
            fetchCalls.push({url:String(url),options});
            const next=responses.shift();
            if(next instanceof Error){ return Promise.reject(next); }
            return Promise.resolve({ok:true,json:async()=>next});
        }
    };
    windowObject.window=windowObject;
    windowObject.closeHomeFeature=()=>{
        const api=windowObject.FourSymbolsReleaseUpdate;
        if(api&&api.shouldPreventSharedModalClose()){ return false; }
        if(api){ api.onSharedModalClosed(); }
        modal.classList.remove("show");
        return true;
    };
    const context=vm.createContext(windowObject);
    vm.runInContext(runtimeSource,context,{filename:"js/release-update-notification.js"});
    return {
        context,document,window:windowObject,modal,title,body,overlay,storage,fetchCalls,timers,intervals,
        api:windowObject.FourSymbolsReleaseUpdate,
        get reloads(){ return reloads; },
        runPendingTimers(){
            const pending=[...timers.values()];
            timers.clear();
            pending.forEach(timer=>timer.fn());
        }
    };
}

let passed=0;
async function test(name,callback){
    await callback();
    passed++;
    console.log("✓ "+name);
}

(async()=>{
    await test("formal manifest, cache route and build registration use one player source",()=>{
        const manifest=JSON.parse(read(manifestPath));
        const release=JSON.parse(read("release/release.json"));
        const build=read("scripts/build-production.mjs");
        const headers=read("_headers");
        const css=read("css/release-update-notification.css");
        assert.equal(manifest.releaseVersion,"V"+release.version);
        assert.equal(release.updateNoticeFile,manifestPath);
        assert.match(build,/js\/release-update-notification\.js/);
        assert.match(build,/css\/release-update-notification\.css/);
        assert.match(headers,/\/release\/release-update\.json\n\s+Cache-Control: no-cache, no-store, must-revalidate/);
        assert.match(runtimeSource,/cache:"no-store"/);
        assert.match(runtimeSource,/release-update-check/);
        assert.match(runtimeSource,/releaseUpdatePreview/);
        assert.match(runtimeSource,/dev\.four-symbols-dev\.pages\.dev/);
        assert.match(read("docs/RELEASE_VERIFICATION_RULES.md"),/自動比對 main\.\.\.dev/);
        assert.match(css,/left:42px;[\s\S]*top:30px;[\s\S]*width:996px;[\s\S]*min-height:132px;/);
        assert.match(css,/pointer-events:auto;/);
        assert.match(css,/release-update-modal #homeFeatureModalBody[\s\S]*overflow-y:auto;/);
        assert.doesNotMatch(css,/!important/);
    });

    await test("Case A: same loaded and server release stays quiet after the notice was read",async()=>{
        const current=releaseManifest("V173.41");
        const harness=createHarness({responses:[current],seen:current});
        await harness.api.checkForUpdate("case-a",{force:true});
        assert.equal(harness.overlay.children.length,0);
        assert.equal(harness.modal.classList.contains("show"),false);
    });

    await test("DEV-only preview: the same manifest can show the marquee and detail modal without reading or reloading",async()=>{
        const current=releaseManifest("V173.65");
        const dev=createHarness({
            loadedVersion:"173.65",
            responses:[current],
            seen:current,
            locationHref:"https://dev.four-symbols-dev.pages.dev/?releaseUpdatePreview=marquee"
        });
        const storageBefore=[...dev.storage.entries()];
        await dev.api.checkForUpdate("dev-preview",{force:true});
        assert.equal(dev.api.getState().devPreviewMode,"marquee");
        assert.equal(dev.overlay.children.length,1);
        dev.overlay.children[0].dispatch("click");
        assert.equal(dev.modal.classList.contains("show"),true);
        assert.match(dev.body.innerHTML,/V173\.65/);
        assert.match(dev.body.innerHTML,/發現新版本/);
        assert.equal(dev.api.requestReload(),false);
        assert.equal(dev.reloads,0);
        assert.deepEqual([...dev.storage.entries()],storageBefore);

        const ipv6=createHarness({
            loadedVersion:"173.65",
            responses:[current],
            seen:current,
            locationHref:"http://[::1]/?releaseUpdatePreview=modal"
        });
        await ipv6.api.checkForUpdate("ipv6-preview",{force:true});
        assert.equal(ipv6.api.getState().devPreviewMode,"modal");
        assert.equal(ipv6.modal.classList.contains("show"),true);

        const main=createHarness({
            loadedVersion:"173.65",
            responses:[current],
            seen:current,
            locationHref:"https://tf00913225-alt.github.io/my-game/?releaseUpdatePreview=marquee"
        });
        await main.api.checkForUpdate("main-preview-attempt",{force:true});
        assert.equal(main.api.getState().devPreviewMode,null);
        assert.equal(main.overlay.children.length,0);
    });

    await test("Case B/C: a newer normal release shows one cache-busted marquee and its shared detail modal",async()=>{
        const next=releaseManifest("V173.42");
        const harness=createHarness({responses:[next]});
        await harness.api.checkForUpdate("case-b",{force:true});
        assert.equal(harness.overlay.children.length,1);
        assert.equal(harness.overlay.children[0].hidden,false);
        assert.match(harness.overlay.children[0].querySelector(".release-update-marquee-text").textContent,/V173\.42/);
        assert.match(harness.fetchCalls[0].url,/release\/release-update\.json\?release-update-check=/);
        assert.equal(harness.fetchCalls[0].options.cache,"no-store");
        assert.equal(harness.api.openReleaseDetail("update"),true);
        assert.equal(harness.modal.classList.contains("show"),true);
        assert.match(harness.body.innerHTML,/V173\.42/);
        assert.match(harness.body.innerHTML,/玩家可感知的遊戲體驗優化/);
    });

    await test("Case D/E: safe immediate update reloads; battle defers until the shared safety owner says safe",async()=>{
        const next=releaseManifest("V173.42");
        const safe=createHarness({responses:[next]});
        await safe.api.checkForUpdate("case-d",{force:true});
        assert.equal(safe.api.requestReload(),true);
        assert.equal(safe.reloads,1);

        const inBattle=createHarness({responses:[next]});
        await inBattle.api.checkForUpdate("case-e",{force:true});
        inBattle.window.battleActive=true;
        assert.equal(inBattle.api.requestReload(),false);
        assert.equal(inBattle.reloads,0);
        assert.equal(inBattle.api.getState().pendingNormalReload,true);
        inBattle.window.battleActive=false;
        inBattle.api.notifySafeState();
        assert.equal(inBattle.reloads,1);
    });

    await test("Case F/G: a read notice does not repeat, but a later release is still recognized",async()=>{
        const v42=releaseManifest("V173.42");
        const v43=releaseManifest("V173.43");
        const readCurrent=createHarness({loadedVersion:"173.42",responses:[v42],seen:v42});
        await readCurrent.api.checkForUpdate("case-f",{force:true});
        assert.equal(readCurrent.modal.classList.contains("show"),false);

        const olderClient=createHarness({responses:[v42,v43],seen:v42});
        await olderClient.api.checkForUpdate("case-g-first",{force:true});
        await olderClient.api.checkForUpdate("case-g-second",{force:true});
        assert.equal(olderClient.api.getState().availableReleaseVersion,"V173.43");
        assert.match(olderClient.overlay.children[0].querySelector(".release-update-marquee-text").textContent,/V173\.43/);
    });

    await test("Case H: forced update waits for battle, then opens a non-dismissible shared modal",async()=>{
        const forced=releaseManifest("V173.42",{updateMode:"forced"});
        const harness=createHarness({responses:[forced]});
        harness.window.battleActive=true;
        await harness.api.checkForUpdate("case-h",{force:true});
        assert.equal(harness.modal.classList.contains("show"),false);
        assert.equal(harness.api.getState().pendingForcedUpdate,true);
        harness.window.battleActive=false;
        harness.api.notifySafeState();
        assert.equal(harness.modal.classList.contains("show"),true);
        assert.equal(harness.modal.classList.contains("release-update-forced"),true);
        assert.equal(harness.api.shouldPreventSharedModalClose(),true);
        assert.equal(harness.window.closeHomeFeature(),false);
        assert.equal(harness.modal.classList.contains("show"),true);
    });

    await test("Case I: a failed manifest request is silent and does not block the game",async()=>{
        const harness=createHarness({responses:[new Error("offline")]});
        const result=await harness.api.checkForUpdate("case-i",{force:true});
        assert.equal(result,null);
        assert.equal(harness.overlay.children.length,0);
        assert.equal(harness.modal.classList.contains("show"),false);
    });

    await test("Case J: startup, visible and online checks are throttled instead of request-spamming",async()=>{
        const current=releaseManifest("V173.41");
        const harness=createHarness({responses:[current],seen:current});
        harness.api.start();
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(harness.fetchCalls.length,1);
        harness.document.dispatch("visibilitychange");
        harness.window.dispatch("online");
        await Promise.resolve();
        assert.equal(harness.fetchCalls.length,1);
        assert.equal([...harness.intervals.values()][0].ms,4*60*1000);
    });

    await test("version ordering and critical operation registry are numeric and centralized",()=>{
        const harness=createHarness();
        assert.equal(harness.api.compareVersions("V173.9","V173.10"),-1);
        assert.equal(harness.api.canSafelyReloadForUpdate(),true);
        const end=harness.api.beginCriticalOperation("cloud-save-write");
        assert.equal(harness.api.canSafelyReloadForUpdate(),false);
        end();
        assert.equal(harness.api.canSafelyReloadForUpdate(),true);
    });

    console.log("✓ Release Update Notification System: "+passed+" targeted cases passed.");
})().catch(error=>{
    console.error(error.stack||error);
    process.exit(1);
});
