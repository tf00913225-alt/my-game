"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const main=fs.readFileSync("js/00-main.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");

const keyIndex=main.indexOf('const STARTUP_SESSION_READY_KEY="sixiang_startup_session_ready_v1";');
const start=main.lastIndexOf("/* =====================================================",keyIndex);
const end=main.indexOf("let deleteAllCharactersInProgress",keyIndex);
assert.ok(keyIndex>=0 && start>=0 && end>keyIndex,"V173.50 lifecycle block must live in js/00-main.js");
const block=main.slice(start,end);

function harness(initialReady){
    const documentListeners={};
    const windowListeners={};
    const store=new Map(initialReady?[["sixiang_startup_session_ready_v1","1"]]:[]);
    const root={hidden:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=String(v);}};
    let saves=0;
    const context={
        document:{
            hidden:false,
            getElementById(id){return id==="startupLoader"?root:null;},
            addEventListener(type,fn){documentListeners[type]=fn;}
        },
        sessionStorage:{
            getItem(k){return store.has(k)?store.get(k):null;},
            setItem(k,v){store.set(k,String(v));}
        },
        saveGame(){saves++;}
    };
    context.window=context;
    context.window.addEventListener=(type,fn)=>{windowListeners[type]=fn;};
    vm.createContext(context);
    vm.runInContext(block,context);
    return {context,root,store,documentListeners,windowListeners,get saves(){return saves;}};
}

{
    const h=harness(false);
    assert.equal(h.root.hidden,false,"first entry must still show the long startup loader");
    h.documentListeners["v173.20:startup-entered"]();
    assert.equal(h.store.get("sixiang_startup_session_ready_v1"),"1");
}

{
    const h=harness(true);
    assert.equal(h.root.hidden,true,"same-tab reload must skip the long loader");
    assert.equal(h.root.dataset.sessionResume,"1");
    assert.equal(h.root.attributes["aria-hidden"],"true");
    h.context.document.hidden=true;
    h.documentListeners.visibilitychange();
    assert.equal(h.saves,1,"backgrounding must immediately save");
    h.windowListeners.pagehide();
    assert.equal(h.saves,2,"pagehide must also persist before renderer eviction");
}

assert.match(loader,/const V_ASSET_VERSION="173\.60"/);
assert.match(index,/<title>四象江湖傳 V173\.60<\/title>/);
assert.match(index,/js\/00-main\.js\?v=173\.60/);
assert.match(index,/js\/20-anonymous-20\.js\?v=173\.60/);
console.log("✓ V173.50 same-session resume and background save regression passed");
