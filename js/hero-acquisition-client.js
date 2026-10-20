/* Hero acquisition transport/projection adapter. Never trusts saved claims,
   local dates, completion counters or a restored chapter flag as entitlement. */
(function installHeroAcquisitionClient(global){
    "use strict";
    let proof=null,error=null,busy=false,generation=0,pipeline=Promise.resolve(),draining=null;
    const pendingNodes=[];
    // Retained tickets observe new, explicit story actions. A restored local
    // completion map never creates or fills missing online positions.
    const retainedStoryPositions={n01_arrival:'c1_01',n02_roadfight:'c1_02',n03_fork:'c1_06',
        n04a_path:'c1_07',n04b_gate:'c1_07',n05_commission:'c1_08',n06_rest:'c1_09',
        n07_chest:'c1_10',n08_truth:'c1_11',n09_boss:'c1_20',n10_finish:'c1_20'};
    const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
    function activeUid(){
        const uid=global.FourSymbolsAccountSave?.getActiveUid?.();
        return uid&&global.FourSymbolsFirebaseLifecycle?.getUser?.()?.uid===uid&&
            global.FourSymbolsStartupPolicy?.getUid?.()===uid?uid:null;
    }
    function onlineReady(){return global.FourSymbolsStartupPolicy?.getState?.()==="READY"&&global.navigator?.onLine!==false;}
    function errorText(problem){
        const code=String(problem.code||"");
        if(/data-loss|HERO_PROOF_INVALID/.test(code)){return "英雄取得紀錄不完整，已停止領取；請聯絡客服確認。";}
        if(/SESSION_|permission-denied|unauthenticated/.test(code)){return "請重新驗證原帳號後同步英雄紀錄。";}
        if(/aborted/.test(code)){return "帳號紀錄已更新，請再次同步。";}
        if(/unavailable|network|deadline/.test(code)){return "目前無法連線同步；永久英雄權益仍保留在線上。";}
        if(/failed-precondition/.test(code)){return "章節線上資格尚未完成，請重新開啟章節確認紀錄。";}
        return /^[\u3400-\u9fff]/u.test(String(problem.message||""))?problem.message:"英雄取得紀錄暫時無法同步，請稍後再試。";
    }
    function inspect(value,uid){
        const core=global.FourSymbolsHeroCore;
        if(!value||value.schemaVersion!==1||value.ownerUid!==uid||value.authoritativeStateReady!==false||
           !Number.isSafeInteger(value.serverRevision)||value.serverRevision<1||
           !Number.isSafeInteger(value.loginCount)||value.loginCount<0||value.loginCount>7||
           !value.entitlements||typeof value.entitlements!=="object"||Array.isArray(value.entitlements)||
           !value.chapter||value.chapter.outcomeVerified!==false||
           !["not-started","active","completed"].includes(value.chapter.phase)||
           !Array.isArray(value.chapter.completedIntents)){
            throw Object.assign(new Error("英雄取得紀錄無法驗證。"),{code:"HERO_PROOF_INVALID"});
        }
        for(const [id,grant] of Object.entries(value.entitlements)){
            if(!core.listHeroDefinitions().some(row=>row.heroId===id)||grant.heroId!==id||
               grant.claimKey!=="hero-v1-"+id||typeof grant.sourceId!=="string"||grant.sourceId.length>128||
               !Number.isSafeInteger(grant.grantedRevision)||grant.grantedRevision<1||grant.grantedRevision>value.serverRevision||
               !Number.isSafeInteger(grant.allocationSeed)||grant.allocationSeed<1||grant.allocationSeed>0xffffffff){
                throw Object.assign(new Error("英雄永久權益資料不完整。"),{code:"HERO_PROOF_INVALID"});
            }
        }
        return copy(value);
    }
    function notify(){
        if(typeof global.refreshHeroPage==="function"){global.refreshHeroPage(true);}
        document.dispatchEvent(new CustomEvent("four-symbols:hero-acquisition-state"));
    }
    function reconcile(){
        // Existing Core + UID save Owner only. The receipt stays on the server;
        // this caches the existing unlocked/seed fields, not a second rights key.
        const core=global.FourSymbolsHeroCore,adapter=global.FourSymbolsHeroSystem;
        if(!adapter||!proof||proof.ownerUid!==activeUid()){return;}
        if(adapter.cacheConfirmedEntitlements()===false){
            error="永久英雄已保留在線上，但本機快取儲存失敗；重新連線仍可取回。";
        }
    }
    function publish(value,uid,token){
        if(uid!==activeUid()||token!==generation){throw Object.assign(new Error("帳號已變更。"),{code:"ACCOUNT_CHANGED"});}
        proof=inspect(value,uid);error=null;reconcile();notify();return copy(proof);
    }
    async function read(api,uid,token){
        let value;
        try{value=await api.readHeroAcquisition();}
        catch(problem){
            if(!String(problem.code||"").endsWith("failed-precondition")){throw problem;}
            // Creates/upgrades only the existing empty envelope, never adopts
            // local character/history. A corrupt source is not bootstrapped.
            await api.bootstrapCloudSave();value=await api.readHeroAcquisition();
        }
        return publish(value,uid,token);
    }
    async function mutation(api,uid,token,invoke){
        try{return publish(await invoke(proof.serverRevision),uid,token);}
        catch(problem){
            if(!String(problem.code||"").endsWith("aborted")){throw problem;}
            await read(api,uid,token);return publish(await invoke(proof.serverRevision),uid,token);
        }
    }
    function run(work){
        const uid=activeUid(),token=generation;
        const result=pipeline.then(async()=>{
            if(!uid||uid!==activeUid()||token!==generation||!onlineReady()){
                throw Object.assign(new Error("需連線並確認原帳號，才能取得永久英雄。"),{code:"HERO_ONLINE_REQUIRED"});
            }
            const api=global.FourSymbolsFirebaseLifecycle;
            busy=true;notify();
            try{await read(api,uid,token);return await work(api,uid,token);}
            finally{busy=false;notify();}
        });
        pipeline=result.catch(problem=>{
            if(uid===activeUid()&&token===generation){
                error=errorText(problem);
                if(/data-loss|HERO_PROOF_INVALID|SESSION_|ACCOUNT_CHANGED|permission-denied|unauthenticated/.test(String(problem.code||""))){proof=null;}
                notify();
            }
        });
        return result;
    }
    async function drain(api,uid,token){
        if(!pendingNodes.length){return copy(proof);}
        await mutation(api,uid,token,revision=>api.ensureHeroChapterTicket(revision));
        while(pendingNodes.length){
            const intent=pendingNodes[0];
            if(intent.uid!==uid||intent.chapterId!==proof.chapter.chapterId){pendingNodes.shift();continue;}
            const retained=retainedStoryPositions[proof.chapter.nextNodeId];
            const nodeId=retained&&retained===intent.nodeId?proof.chapter.nextNodeId:intent.nodeId;
            const choiceId=nodeId==='n03_fork'?'safe':intent.choiceId;
            const prior=proof.chapter.completedIntents.find(row=>row.nodeId===nodeId);
            if(prior){
                if(prior.choiceId!==choiceId){throw new Error("章節岔路與線上紀錄不同，無法補發英雄。");}
                pendingNodes.shift();continue;
            }
            if(proof.chapter.nextNodeId!==nodeId){
                pendingNodes.shift();
                throw new Error("章節尚缺線上紀錄，請從章節地圖的『補看故事紀錄』重看指定段落。");
            }
            const ticketId=proof.chapter.ticketId;
            await mutation(api,uid,token,revision=>api.completeHeroChapterNode({
                ticketId,nodeId,choiceId,expectedRevision:revision}));
            pendingNodes.shift();
        }
        return copy(proof);
    }
    function sync(){return run(async(api,uid,token)=>{
        await mutation(api,uid,token,revision=>api.observeHeroLogin(revision));
        return drain(api,uid,token);
    });}
    function beginChapter(chapterId){return run(async(api,uid,token)=>{
        if(chapterId!==proof.chapter.chapterId){return copy(proof);}
        return mutation(api,uid,token,revision=>api.ensureHeroChapterTicket(revision));
    }).catch(()=>null);}
    function observeChapterNode(chapterId,nodeId,choiceId=null){
        const uid=activeUid();if(!uid){return Promise.resolve(null);}
        if(pendingNodes.length>=32){error="章節同步佇列已滿，請先連線同步。";notify();return Promise.resolve(null);}
        pendingNodes.push({uid,chapterId,nodeId,choiceId});
        if(!draining){
            const task=run(drain).catch(()=>null);
            const final=task.finally(()=>{if(draining===final){draining=null;}});
            draining=final;
        }
        return draining;
    }
    function claimChapterHero(){return run(async(api,uid,token)=>{
        await drain(api,uid,token);
        if(proof.chapter.phase==="completed"){return copy(proof);}
        const id=proof.chapter.nextNodeId;
        if(!id||(global.FourSymbolsAdventureContent?.chapters[proof.chapter.chapterId]?.endNodeId!==id&&id!=="n10_finish")){
            throw new Error("請先完成線上章節資格流程。");
        }
        return mutation(api,uid,token,revision=>api.completeHeroChapterNode({
            ticketId:proof.chapter.ticketId,nodeId:id,choiceId:null,expectedRevision:revision}));
    }).catch(()=>null);}
    function reset(){generation++;proof=null;error=null;pendingNodes.length=0;draining=null;notify();}
    global.FourSymbolsHeroAcquisition=Object.freeze({
        getEntitlement:id=>proof?.ownerUid===activeUid()?copy(proof.entitlements[id]||null):null,
        getStatus:()=>({ready:!!proof&&proof.ownerUid===activeUid(),busy,error,
            loginCount:proof?.ownerUid===activeUid()?proof.loginCount:null,
            chapter:proof?.ownerUid===activeUid()?copy(proof.chapter):null}),
        getRequiredStoryNode:()=>proof?.ownerUid===activeUid()?(retainedStoryPositions[proof.chapter.nextNodeId]||proof.chapter.nextNodeId):null,
        sync,refresh:()=>sync().catch(()=>null),beginChapter,observeChapterNode,claimChapterHero
    });
    document.addEventListener("four-symbols:startup-ready",()=>{
        if(onlineReady()){void sync().catch(()=>null);}
    });
    global.addEventListener("online",()=>{if(onlineReady()){void sync().catch(()=>null);}});
    document.addEventListener("visibilitychange",()=>{
        if(!document.hidden&&onlineReady()){void sync().catch(()=>null);}
    });
    global.addEventListener("four-symbols:firebase-auth-state",event=>{
        if(event.detail?.user?.uid!==proof?.ownerUid){reset();}
    });
    global.addEventListener("four-symbols:game-session-state",event=>{
        if(["revoked","signed-out"].includes(event.detail?.status)||event.detail?.code){reset();}
    });
})(typeof window!=="undefined"?window:globalThis);
