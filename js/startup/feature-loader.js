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
    function prepareBundle(name,bundle){
        if(preparation.has(name)){ return preparation.get(name); }
        const promise=Promise.all([
            ...(bundle.styles||[]).map(url=>addLink({rel:"stylesheet",href:url,"data-feature-style":name})),
            ...(bundle.scripts||[]).map(url=>addLink({rel:"preload",as:"script",href:url,"data-feature-preload":name}))
        ]);
        preparation.set(name,promise);
        return promise;
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
        const order=topology(target,data.bundles||{});
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
    function idle(){
        const run=()=>manifest().then(data=>Promise.all((data.idlePreload||[]).map(item=>prefetch(item,"idle"))));
        if(typeof global.requestIdleCallback==="function"){
            global.requestIdleCallback(run,{timeout:2500});
        }else{ global.setTimeout(run,800); }
    }

    global.FourSymbolsFeatures=Object.freeze({
        ensure,prefetch,idle,
        isReady:name=>ready.has(name)||readyFeatures.has(name),
        manifest
    });
})(typeof window!=="undefined"?window:globalThis);
