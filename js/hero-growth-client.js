(function installHeroGrowth(global){
    "use strict";
    let proof=null,busy=false,error=null,pending=null,generation=0,dev=null,devUid=null;
    const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
    const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?
        Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
    const uid=()=>{
        const value=global.FourSymbolsAccountSave?.getActiveUid?.();
        return value&&global.FourSymbolsFirebaseLifecycle?.getUser?.()?.uid===value&&
            global.FourSymbolsStartupPolicy?.getUid?.()===value?value:null;
    };
    const devEnabled=()=>global.location?.hostname==="dev.four-symbols-dev.pages.dev";
    const ready=()=>global.FourSymbolsStartupPolicy?.getState?.()==="READY"&&global.navigator?.onLine!==false;
    function notify(){global.refreshHeroPage?.(true);}
    function reset(){proof=null;pending=null;dev=null;devUid=null;error=null;busy=false;generation++;notify();}
    function publish(value,owner,token){
        if(owner!==uid()||token!==generation){throw Error("帳號已變更。");}
        const core=global.FourSymbolsHeroCore;
        if(value?.ownerUid!==owner||value.schemaVersion!==1||value.authoritativeStateReady!==false||
           !Number.isSafeInteger(value.serverRevision)||value.serverRevision<1||
           !Number.isSafeInteger(value.marrowPills)||value.marrowPills<0||
           JSON.stringify(stable(core.normalizeAccountState(value.heroAccount)))!==JSON.stringify(stable(value.heroAccount))){
            proof=null;throw Error("英雄成長紀錄無法驗證，已停止操作。");
        }
        proof=copy(value);error=null;notify();return copy(proof);
    }
    async function read(){
        if(busy)return;const owner=uid(),token=generation;
        busy=true;notify();
        try{
            if(!owner||!ready()){throw Error("請連線並確認原帳號後同步成長紀錄。");}
            return publish(await global.FourSymbolsFirebaseLifecycle.readHeroGrowth(),owner,token);
        }catch(problem){if(token===generation){proof=null;error="正式成長紀錄尚未就緒；本機資源不能作為扣除依據。";}}
        finally{if(token===generation){busy=false;notify();}}
    }
    function testResources(){
        if(!devEnabled()||!uid()||global.isHeroGrowthBattleActive?.())return;
        if(dev&&devUid===uid())return; // Reopening never refills consumed resources.
        let account=global.FourSymbolsHeroCore.normalizeAccountState();
        for(const row of global.FourSymbolsHeroCore.listHeroDefinitions()){
            account.heroes[row.heroId].specificFragments=500;
        }
        dev={account,pills:5,revision:1};devUid=uid();pending=null;error=null;notify();
    }
    function projected(){return devEnabled()&&dev&&devUid===uid()?copy(dev.account):
        proof?.ownerUid===uid()?copy(proof.heroAccount):null;}
    async function mutate(heroId,action){
        if(busy||global.isHeroGrowthBattleActive?.())return;
        const owner=uid(),token=generation;
        if(!owner){error="請先確認原帳號。";notify();return;}
        if(pending&&(pending.heroId!==heroId||pending.action!==action)){
            error="前次操作尚未確認，請重試原操作。";notify();return;
        }
        busy=true;notify();
        try{
            if(devEnabled()&&dev&&devUid===owner){
                const core=global.FourSymbolsHeroCore,d=core.createDomain(dev.account,()=>[],()=>null,()=>null);
                const old=dev.account.heroes[heroId].allocationSeed;
                const samples=new Uint32Array(1);global.crypto.getRandomValues(samples);
                let seed=samples[0]||1;if(seed===old)seed=old===0xffffffff?1:old+1;
                const next=action==="unlock"?d.unlockHero(heroId,seed):action==="starUp"?d.starUpHero(heroId):
                    d.rerollHeroAllocation(heroId,seed,dev.pills);
                dev={account:next,pills:dev.pills-(action==="reroll"?1:0),revision:dev.revision+1};error=null;
            }else{
                if(!ready())throw Error("需連線才能確認扣除結果。");
                if(!pending){
                    if(!proof||proof.ownerUid!==owner)throw Error("請先同步成長紀錄。");
                    pending={operationId:global.crypto.randomUUID().replaceAll("-",""),
                        expectedRevision:proof.serverRevision,heroId,action};
                }
                const value=await global.FourSymbolsFirebaseLifecycle.mutateHeroGrowth(pending);
                publish(value,owner,token);pending=null;
            }
        }catch(problem){
            if(token===generation){
                const code=String(problem.code||"");
                if(/data-loss|permission-denied|unauthenticated|SESSION_/.test(code)){proof=null;}
                if(/aborted|failed-precondition|invalid-argument/.test(code)){pending=null;proof=null;}
                error=pending?"操作結果尚未確認；請重試同一操作，系統不會重複扣除。":
                    "資源不足或紀錄尚未就緒，請同步後再試。";
            }
        }finally{if(token===generation){busy=false;notify();}}
    }
    global.FourSymbolsHeroGrowth=Object.freeze({read,mutate,testResources,getAccount:projected,
        getStatus:()=>({ready:!!projected(),busy,error,pending:copy(pending),
            testMode:devEnabled()&&!!dev&&devUid===uid(),devAvailable:devEnabled(),
            marrowPills:devEnabled()&&dev&&devUid===uid()?dev.pills:proof?.ownerUid===uid()?proof.marrowPills:0})});
    global.document?.addEventListener("four-symbols:startup-ready",()=>{void read();});
    global.document?.addEventListener("four-symbols:hero-acquisition-state",()=>{if(ready()&&!pending)void read();});
    global.addEventListener("four-symbols:firebase-auth-state",e=>{if(e.detail?.user?.uid!==uid()||proof&&proof.ownerUid!==uid()||devUid&&devUid!==uid())reset();});
    global.addEventListener("four-symbols:game-session-state",e=>{if(["revoked","signed-out"].includes(e.detail?.status)||e.detail?.code){reset();busy=false;}});
})(typeof window!=="undefined"?window:globalThis);
