import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const match=html.match(/<script id="screen-wake-lock-runtime">([\s\S]*?)<\/script>/);
assert.ok(match,"screen wake lock runtime must exist in index.html");
const runtimeSource=match[1];

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

function createHarness({supported=true,rejectRequest=false}={}){
    const documentEvents=createEmitter();
    const windowEvents=createEmitter();
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

    const navigator=supported ? {
        wakeLock:{
            async request(type){
                assert.equal(type,"screen");
                requestCount++;
                if(rejectRequest){ throw new Error("wake lock denied"); }
                currentSentinel=makeSentinel();
                return currentSentinel;
            }
        }
    } : {};

    const document={
        visibilityState:"visible",
        addEventListener:documentEvents.addEventListener
    };
    const window={
        navigator,
        addEventListener:windowEvents.addEventListener
    };
    window.window=window;

    vm.runInNewContext(runtimeSource,{window,document,navigator,Promise},{filename:"screen-wake-lock-runtime.js"});

    return {
        window,
        document,
        async flush(){ await Promise.resolve(); await Promise.resolve(); },
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
    assert.equal(harness.requestCount,1,"held lock must be reused instead of duplicated");
});

test("released wake lock is reacquired when the page returns to the foreground",async()=>{
    const harness=createHarness();
    await harness.flush();

    harness.document.visibilityState="hidden";
    harness.currentSentinel.systemRelease();
    harness.emitDocument("visibilitychange");
    await harness.flush();
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
    assert.equal(harness.requestCount,1,"hidden page must not request a replacement wake lock");

    harness.document.visibilityState="visible";
    harness.emitDocument("visibilitychange");
    await harness.flush();
    assert.equal(harness.requestCount,2);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),true);
});

test("pageshow reacquires after a browser-released lock and pagehide releases the active lock",async()=>{
    const harness=createHarness();
    await harness.flush();

    harness.currentSentinel.systemRelease();
    harness.emitWindow("pageshow");
    await harness.flush();
    assert.equal(harness.requestCount,2);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),true);

    harness.emitWindow("pagehide");
    await harness.flush();
    assert.equal(harness.releaseCount,1);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
});

test("unsupported Screen Wake Lock API degrades safely",async()=>{
    const harness=createHarness({supported:false});
    await harness.flush();

    assert.equal(harness.window.FourSymbolsScreenWakeLock.isSupported(),false);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
    assert.equal(await harness.window.FourSymbolsScreenWakeLock.acquire(),false);
    assert.equal(harness.requestCount,0);
});

test("wake lock permission or browser rejection is non-fatal",async()=>{
    const harness=createHarness({rejectRequest:true});
    await harness.flush();

    assert.equal(harness.requestCount,1);
    assert.equal(harness.window.FourSymbolsScreenWakeLock.isHeld(),false);
    assert.equal(await harness.window.FourSymbolsScreenWakeLock.acquire(),false);
    assert.equal(harness.requestCount,2);
});
