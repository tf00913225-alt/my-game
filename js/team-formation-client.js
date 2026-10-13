(function installTeamFormationClient(global){
    "use strict";
    const Policy=global.FourSymbolsTeamFormationPolicy;
    let proof=null,busy=false,pending=null,error=null,generation=0,deferred=null;
    const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
    const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?
        Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
    const uid=()=>{const id=global.FourSymbolsAccountSave?.getActiveUid?.();return id&&
        global.FourSymbolsFirebaseLifecycle?.getUser?.()?.uid===id&&global.FourSymbolsStartupPolicy?.getUid?.()===id?id:null;};
    const ready=()=>global.FourSymbolsStartupPolicy?.getState?.()==="READY"&&global.navigator?.onLine!==false;
    const inBattle=()=>!!global.isHeroGrowthBattleActive?.();
    const notify=()=>{global.refreshHeroPage?.(true);global.refreshFormationPage?.();};
    function project(){
        const value=proof?.ownerUid===uid()?proof:null;
        if(!inBattle()&&value?.formation&&global.FourSymbolsBattlefieldSlots){
            const map={...value.formation.characterIndexToSlot};
            Policy.roster(value.formation).forEach((id,index)=>{map[index+3]=value.formation.heroIdToSlot[id];});
            global.FourSymbolsBattlefieldSlots.hydrateAllyFormation({version:1,characterIndexToSlot:map},Object.keys(map).map(Number));
        }
    }
    function publish(value,owner,token){
        if(owner!==uid()||token!==generation)throw Error("帳號已變更。");
        const account=global.FourSymbolsHeroCore.normalizeAccountState(value?.heroAccount);
        if(value?.schemaVersion!==1||value.ownerUid!==owner||value.authoritativeStateReady!==false||
            !Number.isSafeInteger(value.serverRevision)||value.serverRevision<1||!Array.isArray(value.playerIndexes)||
            value.playerIndexes.some((i,n)=>!Number.isInteger(i)||i<0||i>2||n&&i<=value.playerIndexes[n-1])||
            JSON.stringify(stable(account))!==JSON.stringify(stable(value.heroAccount)))throw Error("佈陣紀錄無法驗證。");
        if(value.formation!==null)Policy.validate(value.formation,value.playerIndexes,Object.keys(account.heroes).filter(id=>account.heroes[id].unlocked));
        if(inBattle()){deferred={value:copy(value),owner,token};return;}
        proof=copy(value);error=null;project();notify();
    }
    function reset(){proof=null;pending=null;deferred=null;busy=false;error=null;generation++;notify();}
    async function read(){
        if(busy)return;const owner=uid(),token=generation;busy=true;notify();
        try{
            if(!owner||!ready())throw Error("需要連線與有效登入才能同步佈陣。");
            publish(await global.FourSymbolsFirebaseLifecycle.readTeamFormation(),owner,token);
        }catch(problem){if(token===generation){error="佈陣同步失敗，請重新確認帳號與連線。";}}
        finally{if(token===generation){busy=false;notify();}}
    }
    async function save(formation){
        if(busy||inBattle()||pending)return false;
        const owner=uid(),token=generation;
        if(!owner||!ready()||!proof||proof.ownerUid!==owner){error="請先連線同步佈陣紀錄。";notify();return false;}
        try{Policy.validate(formation,proof.playerIndexes,Object.keys(proof.heroAccount.heroes).filter(id=>proof.heroAccount.heroes[id].unlocked));}
        catch(_){error="格位、英雄所有權或上陣人數不合法。";notify();return false;}
        pending={operationId:global.crypto.randomUUID().replaceAll("-",""),expectedRevision:proof.serverRevision,formation:copy(formation)};
        return retry();
    }
    async function retry(){
        if(!pending||busy||inBattle())return false;
        const owner=uid(),token=generation;busy=true;notify();
        try{
            if(!owner||!ready())throw Error("需要連線。");
            const intent=copy(pending),result=await global.FourSymbolsFirebaseLifecycle.saveTeamFormation(intent);
            // A changed device/session can never acknowledge or apply an old request.
            if(token!==generation||owner!==uid())return false;
            publish(result,owner,token);pending=null;error=null;
            return true;
        }catch(problem){
            if(token===generation){
                const code=String(problem.code||"");
                if(/aborted|failed-precondition|invalid-argument/.test(code))pending=null;
                if(/data-loss|permission-denied|unauthenticated|SESSION_/.test(code)){proof=null;pending=null;}
                error=pending?"保存結果尚未確認；請重試同一操作。":"佈陣未保存，請同步紀錄後再試。";
            }
            return false;
        }finally{if(token===generation){busy=false;notify();}}
    }
    global.FourSymbolsTeamFormation=Object.freeze({read,save,retry,
        getConfirmed:()=>copy(proof?.ownerUid===uid()?proof.formation:null),
        getAccount:()=>copy(proof?.ownerUid===uid()?proof.heroAccount:null),
        getStatus:()=>({ready:!!proof&&proof.ownerUid===uid(),busy,pending:copy(pending),error,
            playerIndexes:copy(proof?.ownerUid===uid()?proof.playerIndexes:[])}),
        projectToBattle:()=>{
            if(deferred&&!inBattle()){const item=deferred;deferred=null;publish(item.value,item.owner,item.token);}
            project();
        }});
    global.document?.addEventListener("four-symbols:startup-ready",()=>{void read();});
    global.document?.addEventListener("four-symbols:hero-acquisition-state",()=>{if(ready()&&!pending)void read();});
    global.addEventListener("four-symbols:firebase-auth-state",()=>{if(proof?.ownerUid!==uid())reset();});
    global.addEventListener("four-symbols:game-session-state",event=>{
        if(["revoked","signed-out"].includes(event.detail?.status)||event.detail?.code)reset();
        else if(event.detail?.status==="ready"&&ready())void read();
    });
})(typeof window!=="undefined"?window:globalThis);
