/* First Play Ready Pack owner: real download/verify/decode progress and cache fingerprinting. */
(function installFirstPlayResourceLoader(global){
    "use strict";
    const STORAGE_KEY="four_symbols_first_play_ready";
    const MANIFEST_URL="asset-manifest.json";
    const PRIORITY_ORDER={P0:0,P1:1,P2:2,P3:3};
    let activePromise=null;
    let lastManifest=null;
    let lastFailed=[];
    let sessionCompleted=new Map();

    function readRecord(){
        try{
            const raw=global.localStorage&&global.localStorage.getItem(STORAGE_KEY);
            if(!raw){ return null; }
            const value=JSON.parse(raw);
            return value&&typeof value==="object"&&!Array.isArray(value)?value:null;
        }catch(_){ return null; }
    }
    function writeRecord(value){
        try{ global.localStorage&&global.localStorage.setItem(STORAGE_KEY,JSON.stringify(value)); }
        catch(error){ console.warn("[FirstPlay] completion record could not be stored",error); }
    }
    function hasCompletedRecord(){ return !!readRecord(); }
    function mimeFor(path,responseType){
        if(responseType){ return responseType.split(";")[0].trim(); }
        const lower=String(path||"").toLowerCase();
        if(lower.endsWith(".png")){ return "image/png"; }
        if(lower.endsWith(".webp")){ return "image/webp"; }
        if(lower.endsWith(".jpg")||lower.endsWith(".jpeg")){ return "image/jpeg"; }
        if(lower.endsWith(".svg")){ return "image/svg+xml"; }
        if(lower.endsWith(".css")){ return "text/css"; }
        if(lower.endsWith(".js")||lower.endsWith(".mjs")){ return "text/javascript"; }
        if(lower.endsWith(".json")){ return "application/json"; }
        return "application/octet-stream";
    }
    function hex(buffer){
        return Array.from(new Uint8Array(buffer),value=>value.toString(16).padStart(2,"0")).join("");
    }
    async function digest(bytes){
        if(!global.crypto||!global.crypto.subtle){ throw new Error("SubtleCrypto is unavailable; asset verification cannot continue."); }
        return hex(await global.crypto.subtle.digest("SHA-256",bytes));
    }
    async function decodeImage(bytes,type,path){
        const blob=new Blob([bytes],{type:mimeFor(path,type)});
        const url=URL.createObjectURL(blob);
        try{
            const image=new Image();
            image.decoding="async";
            image.src=url;
            if(typeof image.decode==="function"){
                await image.decode();
            }else{
                await new Promise((resolve,reject)=>{
                    image.onload=resolve;
                    image.onerror=()=>reject(new Error("Image decode failed: "+path));
                });
            }
            if(!image.naturalWidth||!image.naturalHeight){ throw new Error("Decoded image has no renderable dimensions: "+path); }
        }finally{ URL.revokeObjectURL(url); }
    }
    function warmResource(resource){
        const lower=resource.path.toLowerCase();
        let as="";
        if(lower.endsWith(".css")){ as="style"; }
        else if(lower.endsWith(".js")||lower.endsWith(".mjs")){ as="script"; }
        else if(/\.(?:png|jpe?g|webp|svg|avif)$/.test(lower)){ as="image"; }
        if(!as){ return; }
        const selector=`link[data-first-play-preload="${CSS.escape(resource.path)}"]`;
        if(document.querySelector(selector)){ return; }
        const link=document.createElement("link");
        link.rel="preload";
        link.as=as;
        link.href=resource.path;
        link.dataset.firstPlayPreload=resource.path;
        document.head.appendChild(link);
    }
    async function fetchManifest(){
        const response=await fetch(MANIFEST_URL,{cache:"no-store",credentials:"same-origin"});
        if(!response.ok){ throw new Error(`First Play manifest request failed (${response.status}).`); }
        const manifest=await response.json();
        if(!manifest||!manifest.firstPlay||!Array.isArray(manifest.firstPlay.resources)){
            throw new Error("asset-manifest.json does not contain a valid firstPlay pack.");
        }
        const pack=manifest.firstPlay;
        if(!pack.manifestHash||!pack.assetPackVersion||!pack.manifestVersion){ throw new Error("First Play manifest metadata is incomplete."); }
        return {manifest,pack};
    }
    function describe(resource){
        if(resource.priority==="P0"){ return "正在載入核心介面"; }
        if(/characters\/(?:female|male)_/.test(resource.path)){ return "正在準備角色資料"; }
        if(/home-|nav-|map-return/.test(resource.path)){ return "正在下載主城素材"; }
        if(resource.decode){ return "正在驗證圖片"; }
        if(/gameplay-core/.test(resource.path)){ return "正在準備戰鬥資源"; }
        return "正在建立遊戲快取";
    }
    async function readResponse(response,resource,onChunk){
        const expected=Number(resource.bytes)||0;
        if(!response.body||typeof response.body.getReader!=="function"){
            const buffer=await response.arrayBuffer();
            onChunk(buffer.byteLength,expected);
            return buffer;
        }
        const reader=response.body.getReader();
        const chunks=[];
        let total=0;
        while(true){
            const {done,value}=await reader.read();
            if(done){ break; }
            chunks.push(value);
            total+=value.byteLength;
            onChunk(value.byteLength,expected);
        }
        const bytes=new Uint8Array(total);
        let offset=0;
        for(const chunk of chunks){ bytes.set(chunk,offset); offset+=chunk.byteLength; }
        return bytes.buffer;
    }
    async function processResource(resource,state,record,onProgress,forceNetwork){
        const previousDigest=record&&record.assets&&record.assets[resource.path];
        const unchanged=previousDigest===resource.sha256;
        const response=await fetch(resource.path,{
            cache:forceNetwork||!unchanged?"reload":"force-cache",
            credentials:"same-origin"
        });
        if(!response.ok){
            const error=new Error(`${resource.path} HTTP ${response.status}`);
            error.code="first-play-http-failed";
            throw error;
        }
        let accounted=0;
        const buffer=await readResponse(response,resource,(delta)=>{
            const limit=Number(resource.bytes)||Number.POSITIVE_INFINITY;
            const available=Math.max(0,limit-accounted);
            const applied=Math.min(delta,available);
            accounted+=applied;
            state.loadedBytes+=applied;
            onProgress(resource,state,false);
        });
        if(resource.bytes&&buffer.byteLength!==resource.bytes){
            throw new Error(`${resource.path} size mismatch (${buffer.byteLength}/${resource.bytes}).`);
        }
        const actual=await digest(buffer);
        if(!actual.startsWith(String(resource.sha256||""))){ throw new Error(`${resource.path} SHA-256 verification failed.`); }
        if(resource.decode){ await decodeImage(buffer,response.headers.get("content-type"),resource.path); }
        warmResource(resource);
        if(resource.bytes&&accounted<resource.bytes){
            state.loadedBytes+=resource.bytes-accounted;
            accounted=resource.bytes;
        }
        state.completedTasks+=1;
        sessionCompleted.set(resource.path,resource.sha256);
        onProgress(resource,state,true);
        return {path:resource.path,sha256:resource.sha256,unchanged};
    }
    function normalizedProgress(state){
        if(state.totalBytes>0){ return Math.min(99,(state.loadedBytes/state.totalBytes)*100); }
        return Math.min(99,(state.completedTasks/Math.max(1,state.totalTasks))*100);
    }
    async function run(options={}){
        const {manifest,pack}=await fetchManifest();
        lastManifest=pack;
        const record=readRecord();
        const returning=!!record;
        const current=!!(record&&record.manifestHash===pack.manifestHash&&record.assetPackVersion===pack.assetPackVersion);
        const resources=pack.resources.slice().sort((a,b)=>(PRIORITY_ORDER[a.priority]??9)-(PRIORITY_ORDER[b.priority]??9)||a.path.localeCompare(b.path));
        const retryOnly=!!options.retryFailedOnly&&lastFailed.length>0;
        const retrySet=new Set(lastFailed.map(item=>item.path));
        const queue=retryOnly?resources.filter(item=>retrySet.has(item.path)):resources;
        const baseCompleted=retryOnly?resources.filter(item=>!retrySet.has(item.path)&&sessionCompleted.get(item.path)===item.sha256):[];
        const state={
            totalBytes:resources.reduce((sum,item)=>sum+(Number(item.bytes)||0),0),
            loadedBytes:baseCompleted.reduce((sum,item)=>sum+(Number(item.bytes)||0),0),
            totalTasks:resources.length,
            completedTasks:baseCompleted.length
        };
        const emit=(resource,progressState,complete)=>{
            const percent=complete&&progressState.completedTasks===progressState.totalTasks?100:normalizedProgress(progressState);
            if(typeof options.onProgress==="function"){
                options.onProgress(Object.freeze({
                    percent,loadedBytes:progressState.loadedBytes,totalBytes:progressState.totalBytes,
                    completed:progressState.completedTasks,total:progressState.totalTasks,
                    path:resource&&resource.path||null,priority:resource&&resource.priority||null,
                    title:returning&&!current?"正在更新必要資源":"正在準備遊戲資源",
                    detail:resource?describe(resource):"正在驗證 First Play Ready Pack"
                }));
            }
        };
        emit(null,state,false);
        const failures=[];
        let cursor=0;
        const workers=Array.from({length:Math.max(1,Math.min(6,Number(pack.concurrency)||5))},async()=>{
            while(cursor<queue.length){
                const index=cursor++;
                const resource=queue[index];
                try{ await processResource(resource,state,record,emit,!current&&(!record||record.assets?.[resource.path]!==resource.sha256)); }
                catch(error){ failures.push({path:resource.path,error}); }
            }
        });
        await Promise.all(workers);
        if(failures.length){
            lastFailed=failures;
            const error=new Error("部分必要資源載入失敗");
            error.code="first-play-resource-failed";
            error.failures=failures;
            error.retryable=true;
            throw error;
        }
        lastFailed=[];
        const assets=Object.fromEntries(resources.map(item=>[item.path,item.sha256]));
        const completion={
            gameVersion:String(manifest.release||""),
            manifestVersion:pack.manifestVersion,
            assetPackVersion:pack.assetPackVersion,
            manifestHash:pack.manifestHash,
            completedAt:new Date().toISOString(),
            assets
        };
        writeRecord(completion);
        state.loadedBytes=state.totalBytes;
        state.completedTasks=state.totalTasks;
        emit(resources.at(-1)||null,state,true);
        return Object.freeze({
            returning,currentBeforePrepare:current,manifestChanged:returning&&!current,
            totalBytes:state.totalBytes,totalTasks:state.totalTasks,completion,pack
        });
    }
    function prepare(options={}){
        if(activePromise&&!options.retryFailedOnly){ return activePromise; }
        const promise=run(options).finally(()=>{ if(activePromise===promise){ activePromise=null; } });
        if(!options.retryFailedOnly){ activePromise=promise; }
        return promise;
    }

    global.FourSymbolsFirstPlay=Object.freeze({
        storageKey:STORAGE_KEY,
        prepare,
        retryFailed:(options={})=>prepare({...options,retryFailedOnly:true}),
        hasCompletedRecord,
        getStoredRecord:readRecord,
        getLastFailed:()=>lastFailed.map(item=>({path:item.path,message:String(item.error&&item.error.message||item.error)})),
        getManifest:()=>lastManifest
    });
})(typeof window!=="undefined"?window:globalThis);
