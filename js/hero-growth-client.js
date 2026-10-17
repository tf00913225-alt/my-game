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
        if(value.loginRewards!==undefined&&(!Array.isArray(value.loginRewards)||value.loginRewards.length!==2||
           value.loginRewards.some((row,i)=>row.day!==[3,7][i]||row.heroId!==["divineDogHongbao","vajraHeavenlyKing"][i]||
               row.fragments!==25||row.marrowPills!==1||typeof row.eligible!=="boolean"||typeof row.claimed!=="boolean"))){
            proof=null;throw Error("登入獎勵紀錄無法驗證。");
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
        const owner=uid(),token=generation,reward=action==="loginReward";
        if(reward&&![3,7].includes(heroId))return;
        if(reward&&dev){error="請重新載入以離開 DEV 隔離測試，再領取正式獎勵。";notify();return;}
        if(!owner){error="請先確認原帳號。";notify();return;}
        if(pending&&(reward?pending.milestoneDay!==heroId:pending.heroId!==heroId||pending.action!==action)){
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
                if(!ready())throw Error(reward?"需連線才能確認領取結果。":"需連線才能確認扣除結果。");
                if(!pending){
                    if(!proof||proof.ownerUid!==owner)throw Error("請先同步成長紀錄。");
                    pending=reward?{operationId:"hero-login-reward-v1-day"+heroId,
                        expectedRevision:proof.serverRevision,milestoneDay:heroId}:
                        {operationId:global.crypto.randomUUID().replaceAll("-",""),
                        expectedRevision:proof.serverRevision,heroId,action};
                }
                const value=reward?await global.FourSymbolsFirebaseLifecycle.claimHeroLoginReward(pending):
                    await global.FourSymbolsFirebaseLifecycle.mutateHeroGrowth(pending);
                publish(value,owner,token);pending=null;
            }
        }catch(problem){
            if(token===generation){
                const code=String(problem.code||"");
                if(/data-loss|permission-denied|unauthenticated|SESSION_/.test(code)){proof=null;}
                if(/aborted|failed-precondition|invalid-argument/.test(code)){pending=null;proof=null;}
                error=pending?(reward?"領取結果尚未確認；請重試同一獎勵，系統不會重複發放。":
                    "操作結果尚未確認；請重試同一操作，系統不會重複扣除。"):
                    reward?"獎勵資格或伺服器角色資料尚未就緒，請同步後再試。":"資源不足或紀錄尚未就緒，請同步後再試。";
            }
        }finally{if(token===generation){busy=false;notify();}}
    }
    global.FourSymbolsHeroGrowth=Object.freeze({read,mutate,testResources,
        claimLoginReward:day=>mutate(day,"loginReward"),
        retry:()=>pending?mutate(pending.milestoneDay??pending.heroId,pending.milestoneDay?"loginReward":pending.action):Promise.resolve(),getAccount:projected,
        getStatus:()=>({ready:!!projected(),busy,error,pending:copy(pending),
            loginRewards:proof?.ownerUid===uid()?copy(proof.loginRewards||[]):[],
            testMode:devEnabled()&&!!dev&&devUid===uid(),devAvailable:devEnabled(),
            marrowPills:devEnabled()&&dev&&devUid===uid()?dev.pills:proof?.ownerUid===uid()?proof.marrowPills:0})});
    global.document?.addEventListener("four-symbols:startup-ready",()=>{void read();});
    global.document?.addEventListener("four-symbols:hero-acquisition-state",()=>{
        // A reset/error notification invalidates proof; it is never a read trigger.
        const acquisition=global.FourSymbolsHeroAcquisition?.getStatus?.();
        if(acquisition?.ready===true&&!acquisition.busy&&ready()&&!pending)void read();
    });
    global.addEventListener("four-symbols:firebase-auth-state",e=>{if(e.detail?.user?.uid!==uid()||proof&&proof.ownerUid!==uid()||devUid&&devUid!==uid())reset();});
    global.addEventListener("four-symbols:game-session-state",e=>{if(["revoked","signed-out"].includes(e.detail?.status)||e.detail?.code){reset();busy=false;}});
})(typeof window!=="undefined"?window:globalThis);
