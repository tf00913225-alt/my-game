"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const runtimeSource=fs.readFileSync("js/startup/screen-wake-lock-runtime.js","utf8");

function createEmitter(){
    const listeners=new Map();
    return {
        addEventListener(name,handler,options={}){
            if(!listeners.has(name)){ listeners.set(name,[]); }
            listeners.get(name).push({handler,once:!!options.once});
        },
        emit(name){
            const entries=[...(listeners.get(name)||[])];
            for(const entry of entries){
                entry.handler({type:name});
                if(entry.once){
                    const current=listeners.get(name)||[];
                    const index=current.indexOf(entry);
                    if(index>=0){ current.splice(index,1); }
                }
            }
        }
    };
}

function createHarness({supported=true,rejectRequest=false,deferRequest=false}={}){
    const documentEvents=createEmitter();
    const windowEvents=createEmitter();
    const deferred=[];
    let requestCount=0;
    let releaseCount=0;
    let currentSentinel=null;

    function makeSentinel(){
        const releaseEvents=createEmitter();
        let released=false;
        return {
            get released(){ return released; },
            addEventListener:releaseEvents.addEventListener,
            async release(){
                if(released){ return; }
                released=true;
                releaseCount++;
                releaseEvents.emit("release");
            },
            systemRelease(){
                if(released){ return; }
                released=true;
                releaseEvents.emit("release");
            }
        };
    }

    const navigator=supported?{
        wakeLock:{
            async request(type){
                assert.equal(type,"screen");
                requestCount++;
                if(rejectRequest){ throw new Error("wake lock denied"); }
                const next=makeSentinel();
                currentSentinel=next;
                if(deferRequest){ await new Promise(resolve=>deferred.push(resolve)); }
                return next;
            }
        }
    }:{};

    const document={visibilityState:"visible",addEventListener:documentEvents.addEventListener};
    const window={navigator,document,addEventListener:windowEvents.addEventListener};
    window.window=window;
    const context={window,document,navigator,Promise,globalThis:window};

    function install(){ vm.runInNewContext(runtimeSource,context,{filename:"screen-wake-lock-runtime.js"}); }
    install();

    return {
        window,
        document,
        install,
        async flush(){ for(let index=0;index<8;index++){ await Promise.resolve(); } },
        resolveNextRequest(){ const resolve=deferred.shift(); assert.ok(resolve,"expected a deferred request"); resolve(); },
        emitDocument:event=>documentEvents.emit(event),
        emitWindow:event=>windowEvents.emit(event),
        get requestCount(){ return requestCount; },
        get releaseCount(){ return releaseCount; },
        get currentSentinel(){ return currentSentinel; }
    };
}

test("visible game page acquires one screen wake lock and avoids duplicate requests",async()=>{
    const harness=createHarness();
    await harness.flush();
    assert.equal(harness.requestCount,1);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isSupported(),true);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),true);
    assert.equal(await harness.window.FourSymbolsScreenWakeLock.acquire(),true);
    assert.equal(harness.requestCount,1);
});

test("visibility lifecycle actively releases while hidden and reacquires in foreground",async()=>{
    const harness=createHarness();
    await harness.flush();
    harness.document.visibilityState="hidden";
    harness.emitDocument("visibilitychange");
    await harness.flush();
    assert.equal(harness.releaseCount,1);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
    harness.document.visibilityState="visible";
    harness.emitDocument("visibilitychange");
    await harness.flush();
    assert.equal(harness.requestCount,2);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),true);
});

test("pageshow reacquires after a browser release and pagehide releases the active lock",async()=>{
    const harness=createHarness();
    await harness.flush();
    harness.currentSentinel.systemRelease();
    harness.emitWindow("pageshow");
    await harness.flush();
    assert.equal(harness.requestCount,2);
    harness.emitWindow("pagehide");
    await harness.flush();
    assert.equal(harness.releaseCount,1);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
});

test("release invalidates and frees a wake lock request that resolves late",async()=>{
    const harness=createHarness({deferRequest:true});
    await harness.flush();
    assert.equal(harness.requestCount,1);
    await harness.window.FourSymbolsScreenWakeLock.release();
    harness.resolveNextRequest();
    await harness.flush();
    assert.equal(harness.releaseCount,1,"the stale sentinel must be released immediately");
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
});

test("pageshow queues a fresh request when pagehide invalidated an in-flight request",async()=>{
    const harness=createHarness({deferRequest:true});
    await harness.flush();
    harness.document.visibilityState="hidden";
    harness.emitWindow("pagehide");
    harness.document.visibilityState="visible";
    harness.emitWindow("pageshow");
    harness.resolveNextRequest();
    await harness.flush();
    assert.equal(harness.requestCount,2);
    harness.resolveNextRequest();
    await harness.flush();
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),true);
});

test("unsupported Screen Wake Lock API and rejected requests degrade safely",async()=>{
    const unsupported=createHarness({supported:false});
    await unsupported.flush();
    assert.equal(unsupported.window.FourSymbolsScreenWakeLock.isSupported(),false);
    assert.equal(await unsupported.window.FourSymbolsScreenWakeLock.acquire(),false);
    assert.equal(unsupported.requestCount,0);

    const rejected=createHarness({rejectRequest:true});
    await rejected.flush();
    assert.equal(rejected.requestCount,1);
    assert.equal(rejected.window.FourSymbolsScreenWakeLock.isHeld(),false);
    assert.equal(await rejected.window.FourSymbolsScreenWakeLock.acquire(),false);
    assert.equal(rejected.requestCount,2);
});

test("install guard prevents duplicate runtime and listener installation",async()=>{
    const harness=createHarness();
    await harness.flush();
    const owner=harness.window.FourSymbolsScreenWakeLock;
    harness.install();
    harness.emitWindow("pageshow");
    await harness.flush();
    assert.equal(harness.window.FourSymbolsScreenWakeLock,owner);
    assert.equal(harness.requestCount,1);
});

console.log("✓ Screen Wake Lock owner and lifecycle regression checks passed");
