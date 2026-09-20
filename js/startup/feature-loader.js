/* The sole dynamic runtime loader. Downloads may overlap; dependency execution is deterministic. */
(function installFeatureLoader(global){
    "use strict";
    if(!global || global.FourSymbolsFeatures){ return; }

    let manifestPromise=null;
    const preparation=new Map();
    const execution=new Map();
    const ready=new Set();
    const readyFeatures=new Set();
    const bundleFeatures=new Map();
    const backgroundQueue=[];
    const backgroundJobs=new Map();
    const assetPreparation=new Map();
    const BACKGROUND_CONCURRENCY=1;
    let backgroundActive=0;

    function emit(name,detail){
        try{ global.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ }
    }
    function manifest(){
        if(!manifestPromise){
            manifestPromise=fetch("asset-manifest.json",{cache:"no-cache"}).then(response=>{
                if(!response.ok){ throw new Error("Feature manifest unavailable ("+response.status+")."); }
                return response.json();
            }).then(data=>data.featureManifest||data);
        }
        return manifestPromise;
    }
    function addLink(attributes){
        return new Promise((resolve,reject)=>{
            const link=document.createElement("link");
            Object.entries(attributes).forEach(([key,value])=>link.setAttribute(key,value));
            link.addEventListener("load",()=>resolve(link),{once:true});
            link.addEventListener("error",()=>reject(new Error("Failed to load "+(attributes.href||"resource"))),{once:true});
            document.head.appendChild(link);
        });
    }
    function prepareBundle(name,bundle,options={}){
        if(preparation.has(name)){ return preparation.get(name); }
        const background=options.background===true;
        const promise=Promise.all([
            ...(bundle.styles||[]).map(url=>addLink({rel:"stylesheet",href:url,"data-feature-style":name,...(background?{fetchpriority:"low"}:{})})),
            ...(bundle.scripts||[]).map(url=>addLink({rel:"preload",as:"script",href:url,"data-feature-preload":name,...(background?{fetchpriority:"low"}:{})}))
        ]);
        preparation.set(name,promise);
        return promise;
    }
    function promoteBundle(name){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        document.querySelectorAll('[data-feature-style="'+name+'"],[data-feature-preload="'+name+'"]').forEach(link=>link.setAttribute("fetchpriority","high"));
    }
    function topology(target,bundles){
        const ordered=[]; const visiting=new Set(); const visited=new Set();
        function visit(name){
            if(visited.has(name)){ return; }
            if(visiting.has(name)){ throw new Error("Feature dependency cycle at "+name); }
            const bundle=bundles[name];
            if(!bundle){ throw new Error("Unknown feature bundle: "+name); }
            visiting.add(name);
            (bundle.dependencies||[]).forEach(visit);
            visiting.delete(name); visited.add(name); ordered.push(name);
        }
        visit(target); return ordered;
    }
    function executeBundle(name,bundle){
        if(ready.has(name)){ return Promise.resolve(name); }
        if(execution.has(name)){ return execution.get(name); }
        const promise=prepareBundle(name,bundle).then(()=>{
            let chain=Promise.resolve();
            (bundle.scripts||[]).forEach(url=>{
                chain=chain.then(()=>new Promise((resolve,reject)=>{
                    const script=document.createElement("script");
                    script.src=url; script.async=false; script.dataset.featureBundle=name;
                    script.addEventListener("load",resolve,{once:true});
                    script.addEventListener("error",()=>reject(new Error("Failed to execute "+url)),{once:true});
                    document.body.appendChild(script);
                }));
            });
            return chain;
        }).then(()=>{
            ready.add(name);
            (bundleFeatures.get(name)||[]).forEach(feature=>readyFeatures.add(feature));
            emit("four-symbols:feature-ready",{bundle:name,features:[...(bundleFeatures.get(name)||[])]});
            return name;
        }).catch(error=>{
            execution.delete(name);
            emit("four-symbols:feature-error",{bundle:name,error});
            throw error;
        });
        execution.set(name,promise); return promise;
    }
    async function ensure(feature,reason="navigation"){
        const data=await manifest();
        Object.entries(data.features||{}).forEach(([key,value])=>{
            if(!bundleFeatures.has(value)){ bundleFeatures.set(value,new Set()); }
            bundleFeatures.get(value).add(key);
        });
        const target=(data.features&&data.features[feature]) || (data.bundles&&data.bundles[feature]?feature:null);
        if(!target){ throw new Error("Unknown feature: "+feature); }
        cancelQueuedBackground("feature:"+target);
        const order=topology(target,data.bundles||{});
        order.forEach(promoteBundle);
        // Start every network fetch before executing the first dependency.
        await Promise.all(order.map(name=>prepareBundle(name,data.bundles[name])));
        for(const name of order){ await executeBundle(name,data.bundles[name]); }
        emit("four-symbols:feature-request-complete",{feature,bundle:target,reason});
        return target;
    }
    function prefetch(feature,reason="intent"){
        return manifest().then(data=>{
            const target=(data.features&&data.features[feature]) || (data.bundles&&data.bundles[feature]?feature:null);
            if(!target){ return false; }
            const order=topology(target,data.bundles||{});
            return Promise.all(order.map(name=>prepareBundle(name,data.bundles[name]))).then(()=>true);
        }).catch(()=>false);
    }
    function cancelQueuedBackground(key){
        const job=backgroundJobs.get(key);
        if(!job||job.started){ return; }
        job.cancelled=true; backgroundJobs.delete(key); job.resolve(false);
    }
    function drainBackground(){
        while(backgroundActive<BACKGROUND_CONCURRENCY&&backgroundQueue.length){
            const job=backgroundQueue.shift();
            if(job.cancelled){ continue; }
            job.started=true; backgroundActive+=1;
            Promise.resolve().then(job.run).then(job.resolve,error=>{ emit("four-symbols:background-prefetch-error",{key:job.key,error}); job.resolve(false); }).finally(()=>{ backgroundActive-=1; backgroundJobs.delete(job.key); drainBackground(); });
        }
    }
    function queueBackground(key,run){
        const existing=backgroundJobs.get(key); if(existing){ return existing.promise; }
        let resolve; const promise=new Promise(done=>{resolve=done;});
        const job={key,run,resolve,promise,started:false,cancelled:false}; backgroundJobs.set(key,job); backgroundQueue.push(job); drainBackground(); return promise;
    }
    function backgroundPrefetch(feature,reason="idle"){
        return manifest().then(data=>{
            const target=(data.features&&data.features[feature])||(data.bundles&&data.bundles[feature]?feature:null);
            if(!target){ return false; }
            return queueBackground("feature:"+target,async()=>{ const order=topology(target,data.bundles||{}); for(const name of order){ await prepareBundle(name,data.bundles[name],{background:true}); } emit("four-symbols:background-prefetch-complete",{feature,bundle:target,reason}); return true; });
        }).catch(()=>false);
    }
    function decodeAsset(url,priority="high"){
        const existing=assetPreparation.get(url);
        if(existing){ if(priority==="high"){ existing.image.fetchPriority="high"; } return existing.promise; }
        let image;
        const promise=new Promise((resolve,reject)=>{
            image=new Image(); image.decoding="async"; image.fetchPriority=priority;
            image.onload=()=>typeof image.decode==="function"?image.decode().then(resolve,reject):resolve();
            image.onerror=()=>reject(new Error("Failed to prefetch asset "+url)); image.src=url;
        }).catch(error=>{assetPreparation.delete(url);throw error;});
        assetPreparation.set(url,{image,promise}); return promise;
    }
    function prefetchAssets(paths,reason="idle"){
        const unique=[...new Set((paths||[]).filter(path=>typeof path==="string"&&path))];
        return Promise.all(unique.map(path=>queueBackground("asset:"+path,async()=>{ await decodeAsset(path,"low"); emit("four-symbols:background-asset-ready",{path,reason}); return true; }))).then(results=>results.every(Boolean));
    }
    function prefetchManifestAssets(key,reason="idle"){
        return manifest().then(data=>prefetchAssets(data[key]||[],reason)).catch(()=>false);
    }
    function ensureAssets(paths){
        return Promise.all([...new Set((paths||[]).filter(path=>typeof path==="string"&&path))].map(path=>{ cancelQueuedBackground("asset:"+path); return decodeAsset(path,"high"); }));
    }
    function idle(features,assetManifestKeys=[]){
        let resolve; const completion=new Promise(done=>{resolve=done;});
        const run=()=>manifest().then(data=>Promise.all([...(features||data.idlePreload||[]).map(item=>backgroundPrefetch(item,"idle")),...assetManifestKeys.map(key=>prefetchAssets(data[key]||[],"idle"))])).then(resolve,()=>resolve(false));
        if(typeof global.requestIdleCallback==="function"){
            global.requestIdleCallback(run,{timeout:2500});
        }else{ global.setTimeout(run,800); }
        return completion;
    }

    global.FourSymbolsFeatures=Object.freeze({
        ensure,prefetch,backgroundPrefetch,prefetchAssets,prefetchManifestAssets,ensureAssets,idle,
        isReady:name=>ready.has(name)||readyFeatures.has(name),
        manifest,
        getBackgroundPrefetchState:()=>Object.freeze({concurrency:BACKGROUND_CONCURRENCY,active:backgroundActive,queued:backgroundQueue.filter(job=>!job.cancelled).map(job=>job.key)})
    });
})(typeof window!=="undefined"?window:globalThis);
