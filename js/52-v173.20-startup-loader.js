/* Sole StartupStateMachine owner: identity -> UID save -> destination. */
(function installStartupStateMachine(global){
    "use strict";
    const contract=global.FourSymbolsStartupContract;
    if(!contract){ throw new Error("Startup contract must load before its state-machine owner."); }
    const STATES=contract.STATES;
    const root=document.getElementById("startupLoader");
    const logoScene=document.getElementById("startupLogoScene");
    const cityScene=document.getElementById("startupCityScene");
    const title=document.getElementById("startupStatusTitle");
    const detail=document.getElementById("startupStatusDetail");
    const percent=document.getElementById("startupPercent");
    const progress=document.getElementById("startupProgress");
    const fill=document.getElementById("startupProgressFill");
    const creation=document.getElementById("creationPage");
    const game=document.getElementById("gameInterface");
    const build=global.__FOUR_SYMBOLS_BUILD__||{};
    const introLogoTargetMs=Math.max(350,Math.min(1800,Number(root&&root.dataset.logoTargetMs)||900));
    let state=STATES.BOOT_LOADING;
    let activeUser=null;
    let resolvedUid=null;
    let saveResolved=false;
    let cloudResult=null;
    let transitionToken=0;
    let firebase=null;
    let lastError=null;
    let introTimer=0;
    let citySceneShown=false;

    function mark(name){
        try{ if(global.performance&&typeof global.performance.mark==="function"){ global.performance.mark(name); } }catch(_){ }
    }

    if(creation){ creation.style.display="none"; creation.setAttribute("aria-hidden","true"); }
    if(game){ game.style.display="none"; }
    if(root){ root.hidden=false; root.dataset.owner="StartupStateMachine"; root.dataset.state=state; }
    mark("four-symbols:boot-core-ready");
    scheduleCityScene();

    // Signed-out players need only the account surface. Start the application
    // shell after Firebase has produced a UID, then overlap it with save I/O.
    let appShellPromise=null;
    function startAppShell(){
        if(!appShellPromise){
            appShellPromise=global.FourSymbolsFeatures.ensure("app-shell","authenticated-boot")
                .then(value=>({value,error:null}),error=>({value:null,error}));
        }
        return appShellPromise;
    }
    async function requireAppShell(){
        const result=await startAppShell();
        if(result.error){ throw result.error; }
        return result.value;
    }
    function emit(name,payload={}){ document.dispatchEvent(new CustomEvent(name,{detail:{state,...payload}})); }
    function render(value,nextTitle,nextDetail){
        const safe=Math.max(0,Math.min(100,Math.round(value)));
        if(fill){ fill.style.width=safe+"%"; }
        if(percent){ percent.textContent=safe+"%"; }
        if(progress){ progress.setAttribute("aria-valuenow",String(safe)); }
        if(title){ title.textContent=nextTitle; }
        if(detail){ detail.textContent=nextDetail; }
    }
    function transition(next,payload={}){
        if(!contract.canTransition(state,next)){ throw new Error("Invalid startup transition "+state+" -> "+next); }
        state=next; if(root){ root.dataset.state=state; }
        emit("four-symbols:startup-state",payload); return state;
    }
    function showCityScene(reason="boot-progress"){
        if(citySceneShown){ return; }
        citySceneShown=true;
        if(introTimer){ global.clearTimeout(introTimer); introTimer=0; }
        if(logoScene){ logoScene.classList.remove("is-active"); logoScene.setAttribute("aria-hidden","true"); }
        if(cityScene){ cityScene.classList.add("is-active"); cityScene.setAttribute("aria-hidden","false"); }
        if(root){ root.dataset.scene="city"; root.dataset.sceneReason=reason; }
        mark("four-symbols:intro-city-visible");
    }
    function scheduleCityScene(){
        if(!root||citySceneShown||introTimer){ return; }
        introTimer=global.setTimeout(()=>showCityScene("logo-target"),introLogoTargetMs);
    }
    function showLoader(){ if(root){ root.hidden=false; root.classList.remove("is-leaving"); root.setAttribute("aria-hidden","false"); } }
    function hideLoader(){
        if(!root){ return Promise.resolve(); }
        showCityScene("destination-ready");
        root.classList.add("is-leaving");
        return new Promise(resolve=>global.setTimeout(()=>{ root.hidden=true; root.setAttribute("aria-hidden","true"); resolve(); },360));
    }
    function accountUi(mode,message,error=false,migration=null){
        firebase.setUiState({mode,user:activeUser,message,error,migration}); firebase.openAuth();
    }
    function safeCloudEmpty(result,uid){
        // A successful authenticated read of this UID's missing document is an
        // authoritative empty result. Read errors never reach this function.
        if(result&&result.exists===false&&result.uid===uid){ return true; }
        const data=result&&result.data;
        return !!(result&&result.exists&&data&&data.ownerUid===uid&&data.authoritativeStateReady===false&&
            data.status==="awaiting_authoritative_migration"&&(data.migrationCandidateStatus||"none")==="none");
    }
    function cloudPayload(result){
        const data=result&&result.data;
        if(!data||data.authoritativeStateReady!==true){ return null; }
        const payload=data.gameSave||data.save||data.authoritativeSave||null;
        if(!payload||typeof payload!=="object"||Array.isArray(payload)||!payload.player||!payload.player.id){
            const error=new Error("Authoritative cloud metadata has no valid game-save payload."); error.code="cloud-authoritative-payload-invalid"; throw error;
        }
        return payload;
    }
    function domReady(){
        if(document.readyState!=="loading"){ return Promise.resolve(); }
        return new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
    }
    function activateGameplaySaveOwner(){
        if(!resolvedUid||!global.FourSymbolsGameSave||typeof global.FourSymbolsGameSave.activate!=="function"){
            throw new Error("Gameplay save owner is unavailable after app-shell installation.");
        }
        global.FourSymbolsGameSave.activate(resolvedUid);
        if(global.FourSymbolsAccountSave.getActiveUid()!==resolvedUid){
            throw new Error("Gameplay save owner refused the resolved Firebase UID.");
        }
    }
    function showCharacterCreationSurface(){
        const saveOwner=global.FourSymbolsGameSave;
        if(!saveOwner||typeof saveOwner.showCreation!=="function"){
            throw new Error("Character creation surface is unavailable after app-shell installation.");
        }
        saveOwner.showCreation();
        if(!creation||global.getComputedStyle(creation).display==="none"){
            throw new Error("Character creation surface did not become visible.");
        }
        creation.setAttribute("aria-hidden","false");
    }
    async function enterReady(save,offline=false,token=transitionToken){
        showLoader(); render(92,"載入角色資料",offline?"使用已驗證 UID 的本機存檔離線繼續":"準備第一個可操作畫面");
        await Promise.all([requireAppShell(),domReady()]);
        if(token!==transitionToken){ return; }
        activateGameplaySaveOwner();
        const loaded=global.FourSymbolsGameSave&&typeof global.FourSymbolsGameSave.hydrate==="function"&&global.FourSymbolsGameSave.hydrate(save);
        if(!loaded){ throw new Error("Resolved account save could not hydrate gameplay state."); }
        transition(offline?STATES.OFFLINE_READY:STATES.READY,{uid:resolvedUid});
        firebase.closeAuth(); render(100,"載入完成","主城已可操作");
        mark("four-symbols:critical-ready");
        await hideLoader();
        mark("four-symbols:main-city-interactive");
        emit("four-symbols:startup-ready",{uid:resolvedUid,offline});
        document.dispatchEvent(new CustomEvent("v173.20:startup-entered"));
    }
    async function enterCreation(token=transitionToken){
        await Promise.all([requireAppShell(),domReady()]);
        if(token!==transitionToken){ return; }
        activateGameplaySaveOwner();
        transition(STATES.NEED_CHARACTER,{uid:resolvedUid});
        firebase.closeAuth(); render(100,"帳號資料已確認","此 UID 尚無角色，可以建立角色");
        showCharacterCreationSurface();
        if(game){ game.style.display="none"; }
        mark("four-symbols:critical-ready");
        await hideLoader();
        if(state!==STATES.NEED_CHARACTER){ return; }
        mark("four-symbols:character-creation-interactive");
        emit("four-symbols:character-creation-allowed",{uid:resolvedUid});
    }
    function migration(message,blocked=false){
        transition(STATES.MIGRATION_REQUIRED,{uid:resolvedUid,blocked});
        render(100,"需要確認舊存檔","未確認前不會綁定、覆寫或建立角色");
        accountUi("MIGRATION_REQUIRED",message,false,{message,blocked});
        void hideLoader();
        mark("four-symbols:critical-ready"); mark("four-symbols:migration-ui-interactive");
    }
    async function resolveSaveFor(user){
        showCityScene("identity-resolved");
        const token=++transitionToken;
        activeUser=user; resolvedUid=user.uid; saveResolved=false; cloudResult=null; lastError=null;
        startAppShell();
        transition(STATES.SAVE_LOADING,{uid:user.uid}); showLoader();
        render(70,"讀取帳號角色","正在解析 UID 雲端與本機存檔"); accountUi("SAVE_LOADING","正在讀取此 UID 的角色資料…");
        const repo=global.FourSymbolsAccountSave;
        repo.activate(user.uid);
        if(global.FourSymbolsGameSave){ global.FourSymbolsGameSave.activate(user.uid); }
        let local;
        try{ local=repo.readForUid(user.uid); }
        catch(error){ return fail(error,"本機帳號存檔無法安全讀取。",token); }
        let cloud;
        try{ cloud=await firebase.resolveCloudSave(user); }
        catch(error){
            if(token!==transitionToken){ return; }
            if(local.status==="ready"){
                saveResolved=true; cloudResult={error}; mark("four-symbols:save-resolved");
                try{ await enterReady(local.save,true,token); }catch(readyError){ fail(readyError,"離線存檔載入失敗。",token); }
                return;
            }
            return fail(error,"雲端存檔尚未確認；為避免誤判新玩家，禁止創角。",token);
        }
        if(token!==transitionToken){ return; }
        cloudResult=cloud;
        let authoritative=null;
        try{ authoritative=cloudPayload(cloud); }
        catch(error){ return fail(error,"雲端角色資料不完整；未修改任何本機資料。",token); }
        const legacy=repo.inspectLegacy();
        if(legacy.status==="corrupt"||legacy.status==="error"){
            return fail(legacy.error,"偵測到損壞或不可讀的舊版存檔；禁止覆寫。",token);
        }
        if(authoritative&&legacy.status==="available"){
            return migration("雲端已有角色，同時偵測到未綁定舊版角色。系統禁止自動覆寫；請保留資料並由後續衝突處理流程處理。",true);
        }
        let selectedSave=authoritative;
        if(authoritative&&local.status==="ready"){
            try{
                const cloudFingerprint=repo.fingerprint(authoritative);
                const localFingerprint=repo.fingerprint(local.save);
                const localBase=local.metadata&&local.metadata.cloudBaseFingerprint||null;
                if(localFingerprint===cloudFingerprint){
                    if(localBase!==cloudFingerprint||local.metadata.localDirty!==false){
                        repo.writeForUid(user.uid,local.save,{source:"authoritative-cloud-read",cloudBaseFingerprint:cloudFingerprint,localDirty:false});
                    }
                    selectedSave=local.save;
                }else if(localBase===cloudFingerprint){
                    // The cloud snapshot is unchanged and this UID's local save is
                    // a verified descendant (normalization or later local play).
                    selectedSave=local.save;
                }else{
                    return migration("雲端角色與此 UID 的本機角色沒有共同的已驗證基底。系統禁止靜默選邊或覆寫。",true);
                }
            }catch(error){ return fail(error,"無法驗證雲端與本機存檔的來源關係；未覆寫任何資料。",token); }
        }
        if(authoritative){
            if(local.status==="empty"){
                const cloudFingerprint=repo.fingerprint(authoritative);
                repo.writeForUid(user.uid,authoritative,{source:"authoritative-cloud-read",cloudBaseFingerprint:cloudFingerprint,localDirty:false});
            }
            saveResolved=true; mark("four-symbols:save-resolved"); return enterReady(selectedSave,false,token).catch(error=>fail(error,"角色載入失敗。",token));
        }
        if(local.status==="ready"){
            saveResolved=true; mark("four-symbols:save-resolved"); return enterReady(local.save,false,token).catch(error=>fail(error,"角色載入失敗。",token));
        }
        if(legacy.status==="available"){
            return migration("偵測到此裝置存在舊版角色資料。請確認是否備份並作為目前 UID 的本機角色；原始 legacy key 會保留。",false);
        }
        if(!safeCloudEmpty(cloud,user.uid)){
            return migration("雲端狀態仍在遷移或無法證明為空；禁止把它當成新帳號。",true);
        }
        saveResolved=true; mark("four-symbols:save-resolved"); render(90,"帳號資料已確認","此 UID 沒有角色");
        return enterCreation(token).catch(error=>fail(error,"創角介面載入失敗。",token));
    }
    function requireAuth(){
        showCityScene("auth-required");
        activeUser=null; resolvedUid=null; saveResolved=false; cloudResult=null;
        if(global.FourSymbolsGameSave){ global.FourSymbolsGameSave.deactivate(); }else{ global.FourSymbolsAccountSave.deactivate(); }
        transition(STATES.AUTH_REQUIRED); render(100,"帳號服務已就緒","請登入、註冊或以 Firebase 訪客 UID 開始");
        accountUi("AUTH_REQUIRED","請先登入、註冊或使用訪客開始遊戲。沒有 UID 時不能建立角色。");
        void hideLoader();
        mark("four-symbols:critical-ready"); mark("four-symbols:auth-ui-interactive");
    }
    function fail(error,message,token=transitionToken){
        if(token!==transitionToken){ return; }
        showCityScene("startup-error");
        lastError=error; saveResolved=false;
        if(state!==STATES.ERROR){ transition(STATES.ERROR,{error}); }
        showLoader(); render(Math.min(99,Number(progress&&progress.getAttribute("aria-valuenow"))||0),"啟動失敗",message);
        if(firebase){ accountUi("ERROR",message+" "+String(error&&error.message||""),true); }
        emit("four-symbols:startup-error",{error,message});
    }
    function onAuth(detail){
        const user=detail&&detail.user; const error=detail&&detail.error;
        if(error){ fail(error,"Firebase 身份解析失敗；不會顯示創角。"); return; }
        if(!user){
            if(activeUser){
                global.FourSymbolsAccountSave.deactivate();
                // A full reload clears player/inventory/equipment globals before another UID can hydrate.
                global.location.reload(); return;
            }
            if(state===STATES.AUTH_RESOLVING){ requireAuth(); }
            return;
        }
        if(activeUser&&activeUser.uid!==user.uid){ global.FourSymbolsAccountSave.deactivate(); global.location.reload(); return; }
        if(state===STATES.AUTH_RESOLVING||state===STATES.AUTH_REQUIRED){ void resolveSaveFor(user); }
    }
    async function boot(){
        try{
            render(15,"建立啟動環境","載入最小 Boot Core"); transition(STATES.AUTH_RESOLVING); render(30,"初始化帳號服務","恢復 Firebase Authentication session");
            const url=new URL(build.firebaseBootstrap,document.baseURI).href;
            await import(url);
            firebase=global.FourSymbolsFirebaseLifecycle;
            if(!firebase){ throw new Error("Firebase lifecycle owner did not install."); }
            global.addEventListener("four-symbols:firebase-auth-state",event=>onAuth(event.detail));
            global.addEventListener("four-symbols:account-ui-action",event=>{
                const action=event.detail&&event.detail.action;
                if(action==="retry"&&activeUser){ void resolveSaveFor(activeUser); }
                if(action==="confirm-migration"&&state===STATES.MIGRATION_REQUIRED&&activeUser){
                    try{
                        const data=cloudResult&&cloudResult.data;
                        const cloudHas=!!(data&&data.authoritativeStateReady===true);
                        global.FourSymbolsAccountSave.migrateLegacyToUid(activeUser.uid,{confirmed:true,cloudHasCharacter:cloudHas});
                        const migrated=global.FourSymbolsAccountSave.readForUid(activeUser.uid);
                        const token=transitionToken;
                        saveResolved=true; void enterReady(migrated.save,false,token)
                            .catch(error=>fail(error,"migration 後角色載入失敗；原始 legacy 與備份均已保留。",token));
                    }catch(error){ fail(error,"舊版存檔 migration 失敗；原檔與備份均未刪除。"); }
                }
                if(action==="cancel-migration"&&state===STATES.MIGRATION_REQUIRED&&activeUser){
                    firebase.signOut().catch(error=>fail(error,"無法安全退出 migration 流程；資料未被修改。"));
                }
            });
            await firebase.initialize(); mark("four-symbols:auth-initialized"); render(50,"確認登入狀態","等待 Firebase 回復身份");
            const user=await firebase.resolveIdentity(); mark("four-symbols:auth-resolved"); render(65,"身份確認完成",user?"已取得 UID":"需要玩家選擇登入方式");
            onAuth({user,error:null});
        }catch(error){ fail(error,"Firebase Authentication 無法初始化；禁止 fail-open 創角。"); }
    }
    global.FourSymbolsStartupPolicy=Object.freeze({
        states:STATES,getState:()=>state,getUid:()=>resolvedUid,
        canShowCharacterCreation:()=>contract.canCreateCharacter({state,userUid:activeUser&&activeUser.uid,resolvedUid,saveResolved,activeSaveUid:global.FourSymbolsAccountSave.getActiveUid()}),
        canCreateCharacter:()=>contract.canCreateCharacter({state,userUid:activeUser&&activeUser.uid,resolvedUid,saveResolved,activeSaveUid:global.FourSymbolsAccountSave.getActiveUid()}),
        openAccountManager:()=>{
            if(!firebase||!activeUser){ return false; }
            accountUi(state,"目前角色資料綁定此 Firebase UID。");
            return true;
        },
        notifyCharacterCreated:()=>{
            if(!global.FourSymbolsStartupPolicy.canCreateCharacter()){ throw new Error("Character creation completion is not authorized."); }
            transition(STATES.READY,{uid:resolvedUid,newCharacter:true});
            emit("four-symbols:startup-ready",{uid:resolvedUid,newCharacter:true});
            document.dispatchEvent(new CustomEvent("v173.20:startup-entered"));
            global.FourSymbolsFeatures.idle();
        },
        retry:()=>activeUser?resolveSaveFor(activeUser):boot(),getLastError:()=>lastError
    });
    void boot();
})(typeof window!=="undefined"?window:globalThis);