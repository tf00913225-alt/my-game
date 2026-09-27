"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const loaderSource=fs.readFileSync("js/startup/feature-loader.js","utf8");
const portraitSource=fs.readFileSync("js/45-v154-dev-fixes.js","utf8");
const dailySource=fs.readFileSync("js/42-v148-combat-dungeon-fixes.js","utf8");
const manifest=JSON.parse(fs.readFileSync("config/feature-manifest.json","utf8"));
const dailyRegistry={
    tupleSchema:["portraitKey","name","element","rank","sizeClass","path","status"],
    groups:{daily:[
        ["daily.exp.regular","修行弟子","fire","regular","standard","assets/monsters/daily/exp/regular.webp","existing"],
        ["daily.exp.elite","修行精英","water","elite","standard","assets/monsters/daily/exp/elite.webp","existing"],
        ["daily.exp.boss","修行教頭","earth","boss","standard","assets/monsters/daily/exp/boss.webp","existing"]
    ]}
};

function portraitContext(fetchImpl,ensureAssets){
    let releaseFetch;
    const fetchPromise=new Promise(resolve=>{ releaseFetch=resolve; });
    const context={
        window:null,document:{getElementById(){return null;},createElement(){return {className:"",dataset:{},style:{setProperty(){},removeProperty(){}},classList:{toggle(){}}};}},
        console,Math,Number,Object,Array,Set,Map,Promise,
        currentBattleMonsters:[],monsters:[],fetch:fetchImpl||(()=>fetchPromise),
        FourSymbolsFeatures:{ensureAssets:ensureAssets||(()=>Promise.resolve())}
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext(portraitSource,context);
    return {context,releaseFetch};
}

async function featureLoaderGateTest(){
    const feature=manifest.bundles["feature-boss-relic"];
    const covers=feature.criticalAssets;
    const operations=[];
    const pendingImages=[];
    function image(){
        let source="";
        const item={decoding:"",fetchPriority:"",decode:()=>Promise.resolve()};
        Object.defineProperty(item,"src",{get(){return source;},set(value){source=String(value);pendingImages.push(item);operations.push("image:"+source);}});
        return item;
    }
    function node(tag){
        const listeners={};
        return {tagName:tag,attributes:{},dataset:{},src:"",setAttribute(key,value){this.attributes[key]=String(value);},addEventListener(type,handler){listeners[type]=handler;},fire(type){if(listeners[type]){listeners[type]();}}};
    }
    const data={bundles:{"feature-boss-relic":{scripts:["gameplay.js"],styles:["gameplay.css"],dependencies:[],criticalAssets:covers,assets:[...covers,"tower-fire.webp"]}},features:{"boss-tower":"feature-boss-relic"}};
    const context=vm.createContext({
        console,Promise,Map,Set,Object,Array,Error,CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}},
        fetch:async()=>({ok:true,json:async()=>data}),Image:image,
        document:{createElement:node,head:{appendChild(value){operations.push("load:"+(value.attributes.href||""));queueMicrotask(()=>value.fire("load"));}},body:{appendChild(value){operations.push("execute:"+value.src);queueMicrotask(()=>value.fire("load"));}}},
        dispatchEvent(event){operations.push("event:"+event.type);},setTimeout,requestIdleCallback:null,window:null
    });
    context.window=context;
    vm.runInContext(loaderSource,context);
    const ready=context.FourSymbolsFeatures.ensure("boss-tower","navigation");
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(operations.includes("event:four-symbols:feature-request-complete"),false,"navigation must wait for artwork decode");
    assert.deepEqual(operations.filter(value=>value.startsWith("image:")).map(value=>value.slice(6)),covers);
    pendingImages.splice(0).forEach(item=>item.onload&&item.onload());
    await ready;
    assert.equal(operations.includes("event:four-symbols:feature-request-complete"),true);
    const imageCount=operations.filter(value=>value.startsWith("image:")).length;
    await context.FourSymbolsFeatures.prefetch("boss-tower","pointerdown");
    assert.equal(operations.filter(value=>value.startsWith("image:")).length,imageCount,"prefetch and ensure must reuse the decode cache");
}

async function dailyRegistryGateTest(){
    let decodeCalls=0;
    const pending=portraitContext(null,paths=>{decodeCalls+=paths.length;return Promise.resolve();});
    const monster={name:"修行精英",portraitKey:"daily.exp.elite",rank:"elite"};
    assert.equal(pending.context.v154ResolveMonsterPortraitRecord(monster),null,"pending registry is not missing");
    const preparation=pending.context.v154PrepareDailyDungeonPortraits("exp");
    pending.releaseFetch({ok:true,json:async()=>dailyRegistry});
    const result=await preparation;
    assert.equal(result.state,"ready");
    assert.equal(decodeCalls,3,"daily entry prepares regular, elite and boss exactly once");
    assert.equal(pending.context.v154ResolveMonsterPortraitRecord(monster).path,"assets/monsters/daily/exp/elite.webp");
    assert.equal(pending.context.v154PrepareDailyDungeonPortraits("exp"),preparation,"waves reuse one session preparation promise");

    const failed=portraitContext(()=>Promise.reject(new Error("registry unavailable")),()=>Promise.resolve());
    const failedResult=await failed.context.v154PrepareDailyDungeonPortraits("exp");
    assert.equal(failedResult.state,"failed");
    assert.equal(failed.context.v154ResolveMonsterPortraitRecord(monster).status,"fallback","fallback is allowed after explicit registry failure");
}

(async()=>{
    assert.deepEqual(manifest.bundles["feature-boss-relic"].criticalAssets,[
        "assets/gameplay/covers/boss.webp","assets/gameplay/covers/tower.webp",
        "assets/gameplay/covers/abyss.webp","assets/gameplay/covers/coming-soon.webp"
    ]);
    assert.match(dailySource,/await window\.v154PrepareDailyDungeonPortraits\(type\)/);
    assert.match(portraitSource,/monsterPortraitRegistryState="pending"/);
    assert.match(portraitSource,/monsterPortraitRegistryState="ready"/);
    assert.match(portraitSource,/monsterPortraitRegistryState="failed"/);
    assert.match(fs.readFileSync("css/gameplay-boss-tower.css","utf8"),/\.gameplay-mode-card\{[\s\S]*?background-color:#0d0906;/);
    assert.doesNotMatch(fs.readFileSync("css/gameplay-boss-tower.css","utf8"),/gameplay-large-panel::after/);
    await dailyRegistryGateTest();
    await featureLoaderGateTest();
    console.log("Visual-ready registry, three-portrait decode gate and feature artwork gate: PASS");
})().catch(error=>{console.error(error);process.exitCode=1;});
