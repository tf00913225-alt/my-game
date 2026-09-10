"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/startup/feature-loader.js","utf8");
const operations=[];
function node(tag){
    const listeners={};
    return {
        tagName:tag,attributes:{},dataset:{},async:true,src:"",
        setAttribute(key,value){ this.attributes[key]=String(value); },
        addEventListener(type,handler){ listeners[type]=handler; },
        fire(type){ if(listeners[type]){ listeners[type](); } }
    };
}
const manifest={
    bundles:{
        "app-shell":{scripts:["app.js"],styles:["app.css"],dependencies:[]},
        "gameplay-core":{scripts:["game-a.js","game-b.js"],styles:["game.css"],dependencies:["app-shell"]}
    },
    features:{inventory:"gameplay-core",home:"app-shell"},idlePreload:[]
};
const context=vm.createContext({
    console,Promise,Map,Set,Object,Array,Error,CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options&&options.detail;}},
    fetch:async()=>({ok:true,json:async()=>manifest}),
    document:{
        createElement:node,
        head:{appendChild(value){ operations.push("download:"+(value.attributes.href||"")); queueMicrotask(()=>value.fire("load")); }},
        body:{appendChild(value){ operations.push("execute:"+value.src); queueMicrotask(()=>value.fire("load")); }}
    },
    dispatchEvent(event){ operations.push("event:"+event.type); },
    setTimeout,requestIdleCallback:null,window:null
});
context.window=context;
vm.runInContext(source,context);

(async()=>{
    await context.FourSymbolsFeatures.ensure("inventory","test");
    const firstExecution=operations.findIndex(value=>value.startsWith("execute:"));
    assert.ok(firstExecution>0);
    assert.deepEqual(operations.slice(0,firstExecution).sort(),[
        "download:app.css","download:app.js","download:game-a.js","download:game-b.js","download:game.css"
    ].sort(),"all dependency downloads start before execution");
    assert.deepEqual(operations.filter(value=>value.startsWith("execute:")),[
        "execute:app.js","execute:game-a.js","execute:game-b.js"
    ],"execution remains deterministic inside dependency order");
    assert.equal(context.FourSymbolsFeatures.isReady("inventory"),true);
    assert.equal(context.FourSymbolsFeatures.isReady("gameplay-core"),true);
    const before=operations.filter(value=>value.startsWith("execute:")).length;
    await context.FourSymbolsFeatures.ensure("inventory","repeat");
    assert.equal(operations.filter(value=>value.startsWith("execute:")).length,before,"repeat navigation must not re-execute a bundle");
    assert.equal(await context.FourSymbolsFeatures.prefetch("unknown"),false);
    console.log("✓ feature downloads overlap while dependency execution stays deterministic");
})().catch(error=>{ console.error(error); process.exitCode=1; });
