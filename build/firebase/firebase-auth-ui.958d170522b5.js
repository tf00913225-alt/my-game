/* Account UI owner. Signed-out production flow cannot be dismissed without Firebase identity. */
import {
    createAccountWithEmail,getSignedInUser,signInAsAnonymous,signInWithEmail,
    signInWithGoogle,signOutFirebase
} from "./firebase-auth.6a269762828f.js";

const OVERLAY_ID="firebaseAuthOverlay";
const RESUME_GRACE_MS=5000;
const SESSION_TEST_HOSTS=new Set(["dev.four-symbols-dev.pages.dev","localhost","127.0.0.1"]);
const DEV_SESSION_TEST_ENABLED=SESSION_TEST_HOSTS.has(window.location.hostname);
let installed=false;
let busy=false;
let interactiveAuthThisPage=false;
let resumeGraceUsed=false;
let resumeActive=false;
let resumeDeadline=0;
let resumeInterval=0;
let state={mode:"AUTH_RESOLVING",user:null,message:"正在初始化 Firebase Authentication…",error:false,migration:null,sessionTest:"",cloudEnvelopeTest:""};

const byId=id=>document.getElementById(id);
function errorText(error){
    const code=String(error&&error.code||"");
    const messages={
        "auth/popup-closed-by-user":"登入視窗已關閉，尚未完成登入。",
        "auth/popup-blocked":"瀏覽器阻擋了登入視窗，請允許彈出式視窗後再試。",
        "auth/operation-not-allowed":"Firebase Console 尚未啟用這個登入方式。",
        "auth/account-exists-with-different-credential":"這個 Email 已使用其他登入方式建立帳號，請改用原本的登入方式。",
        "auth/invalid-credential":"Email 或密碼不正確。",
        "auth/email-already-in-use":"這個 Email 已註冊，請直接登入。",
        "auth/invalid-email":"Email 格式不正確。",
        "auth/weak-password":"密碼至少需要 6 個字元。",
        "auth/network-request-failed":"網路連線失敗；身份未確認，不會建立新角色。",
        "permission-denied":"雲端存檔讀取被拒絕；不會覆寫任何角色。"
    };
    return messages[code]||String(error&&error.message||"帳號服務發生錯誤，請稍後再試。");
}
function resumeLoginText(user){
    if(!user){ return "正在登入帳號"; }
    if(user.isAnonymous){ return "使用訪客帳號登入中"; }
    const ids=Array.isArray(user.providerIds)?user.providerIds:[];
    if(ids.includes("google.com")){ return "使用 Google 登入中"; }
    if(ids.includes("facebook.com")){ return "使用 Facebook 登入中"; }
    if(ids.includes("password")){ return user.email?"使用 "+user.email+" 信箱登入中":"使用 Email 登入中"; }
    if(user.email){ return "使用 "+user.email+" 信箱登入中"; }
    return "正在登入帳號";
}
function markup(){
    const node=document.createElement("section");
    node.id=OVERLAY_ID; node.className="firebase-auth-overlay"; node.setAttribute("aria-hidden","true");
    node.innerHTML=`
      <div class="firebase-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="firebaseAuthTitle">
        <div class="firebase-auth-topbar">
          <div class="firebase-auth-eyebrow">FOUR SYMBOLS ACCOUNT</div>
          <button id="firebaseAuthBackButton" class="firebase-auth-back-button" type="button" hidden>返回系統</button>
        </div>
        <h2 id="firebaseAuthTitle" class="firebase-auth-title">帳號與角色</h2>
        <p class="firebase-auth-subtitle">先確認 Firebase UID，再讀取此帳號的角色資料。</p>
        <div id="firebaseAuthStatus" class="firebase-auth-status"></div>
        <div id="firebaseAuthResumePanel" class="firebase-auth-resume-panel" hidden>
          <small>偵測到上次登入帳號</small>
          <strong id="firebaseAuthResumeProvider">正在登入帳號</strong>
          <p><b id="firebaseAuthResumeCountdown">5</b> 秒後進入遊戲</p>
          <button id="firebaseSwitchAccountButton" class="firebase-auth-button secondary" type="button">切換帳號</button>
        </div>
        <div id="firebaseSignedOutPanel">
          <div class="firebase-auth-field"><label for="firebaseEmailInput">Email 帳號</label><input id="firebaseEmailInput" type="email" autocomplete="email" inputmode="email"></div>
          <div class="firebase-auth-field"><label for="firebasePasswordInput">密碼</label><input id="firebasePasswordInput" type="password" autocomplete="current-password" minlength="6"></div>
          <p class="firebase-auth-email-help">第一次使用 Email？請選「建立帳號」。</p>
          <div class="firebase-auth-actions firebase-auth-email-actions">
            <button id="firebaseEmailSignInButton" class="firebase-auth-button" type="button">Email 登入</button>
            <button id="firebaseEmailCreateButton" class="firebase-auth-button secondary" type="button">建立帳號</button>
          </div>
          <div class="firebase-auth-divider">其他登入方式</div>
          <div class="firebase-auth-actions">
            <button id="firebaseGoogleButton" class="firebase-auth-button" type="button">Google 登入</button>
          </div>
          <div class="firebase-auth-footer">
            <button id="firebaseGuestButton" class="firebase-auth-button secondary" type="button">訪客開始遊戲</button>
          </div>
          <p class="firebase-auth-note">訪客仍會透過 Firebase Anonymous Auth 取得專屬 UID；沒有 UID 時不能建立角色。</p>
          <button id="firebaseSupportButton" class="firebase-auth-button firebase-auth-support-button" type="button">聯絡客服</button>
        </div>
        <div id="firebaseSignedInPanel" class="firebase-auth-account">
          <div class="firebase-auth-account-card">
            <div id="firebaseAccountName" class="firebase-auth-account-name"></div>
            <div id="firebaseAccountMeta" class="firebase-auth-account-meta"></div>
            <code id="firebaseAccountUid" class="firebase-auth-uid"></code>
            <div id="firebaseCloudState" class="firebase-auth-cloud-state"></div>
          </div>
          <div id="firebaseSessionTestPanel" class="firebase-auth-account-card" hidden>
            <div class="firebase-auth-account-name">開發版雲端驗證</div>
            <div id="firebaseSessionTestResult" class="firebase-auth-cloud-state" role="status" aria-live="polite">按下按鈕即可確認這台裝置是否仍擁有雲端操作權限。</div>
            <div class="firebase-auth-actions">
              <button id="firebaseSessionTestButton" class="firebase-auth-button secondary" type="button">測試目前裝置權限</button>
            </div>
            <div id="firebaseCloudEnvelopeTestResult" class="firebase-auth-cloud-state" role="status" aria-live="polite">按下按鈕驗證 Phase 2 雲端存檔骨架。</div>
            <div class="firebase-auth-actions">
              <button id="firebaseCloudEnvelopeTestButton" class="firebase-auth-button secondary" type="button">驗證雲端存檔骨架</button>
            </div>
          </div>
          <div id="firebaseMigrationPanel" hidden>
            <p id="firebaseMigrationMessage" class="firebase-auth-subtitle"></p>
            <div class="firebase-auth-actions">
              <button id="firebaseMigrationConfirmButton" class="firebase-auth-button" type="button">確認綁定並保留備份</button>
              <button id="firebaseMigrationCancelButton" class="firebase-auth-button secondary" type="button">暫不處理</button>
            </div>
          </div>
          <div class="firebase-auth-actions">
            <button id="firebaseRetryButton" class="firebase-auth-button secondary" type="button">重試讀取</button>
            <button id="firebaseSignOutButton" class="firebase-auth-button danger" type="button">登出帳號</button>
          </div>
        </div>
      </div>`;
    return node;
}
function setBusy(value){
    busy=value===true;
    ["firebaseGoogleButton","firebaseGuestButton","firebaseEmailSignInButton","firebaseEmailCreateButton","firebaseMigrationConfirmButton","firebaseRetryButton","firebaseSignOutButton","firebaseAuthBackButton","firebaseSwitchAccountButton","firebaseSessionTestButton","firebaseCloudEnvelopeTestButton"].forEach(id=>{ const button=byId(id); if(button){ button.disabled=busy; } });
}
function renderResumeCountdown(){
    if(!resumeActive){ return; }
    const remaining=Math.max(0,Math.ceil((resumeDeadline-Date.now())/1000));
    const countdown=byId("firebaseAuthResumeCountdown");
    if(countdown){ countdown.textContent=String(remaining); }
    const provider=byId("firebaseAuthResumeProvider");
    if(provider){ provider.textContent=resumeLoginText(state.user); }
}
function render(){
    if(!installed){ return; }
    const status=byId("firebaseAuthStatus");
    status.textContent=state.sessionError||state.message||"";
    status.classList.toggle("is-error",!!state.sessionError||state.error===true);
    const signedOut=byId("firebaseSignedOutPanel"); const signedIn=byId("firebaseSignedInPanel");
    const resume=byId("firebaseAuthResumePanel");
    if(resume){ resume.hidden=!resumeActive; }
    signedOut.hidden=!!state.user||resumeActive;
    signedIn.classList.toggle("show",!!state.user&&!resumeActive);
    const back=byId("firebaseAuthBackButton");
    if(back){ back.hidden=resumeActive||!(state.user&&(state.mode==="READY"||state.mode==="OFFLINE_READY")); }
    if(state.user){
        byId("firebaseAccountName").textContent=state.user.displayName||state.user.email||(state.user.isAnonymous?"訪客帳號":"Firebase 帳號");
        byId("firebaseAccountMeta").textContent=state.user.isAnonymous?"Firebase 匿名登入":"已驗證帳號";
        byId("firebaseAccountUid").textContent="UID："+state.user.uid;
        byId("firebaseCloudState").textContent=state.mode==="SAVE_LOADING"?"正在讀取 UID 對應的雲端與本機資料…":"角色資料以此 UID 為 owner。";
    }
    const sessionTestPanel=byId("firebaseSessionTestPanel");
    if(sessionTestPanel){ sessionTestPanel.hidden=!DEV_SESSION_TEST_ENABLED||!state.user||resumeActive; }
    const sessionTestResult=byId("firebaseSessionTestResult");
    if(sessionTestResult){
        sessionTestResult.textContent=state.sessionTest||"按下按鈕即可確認這台裝置是否仍擁有雲端操作權限。";
    }
    const cloudEnvelopeTestResult=byId("firebaseCloudEnvelopeTestResult");
    if(cloudEnvelopeTestResult){
        cloudEnvelopeTestResult.textContent=state.cloudEnvelopeTest||"按下按鈕驗證 Phase 2 雲端存檔骨架。";
    }
    const migration=byId("firebaseMigrationPanel");
    migration.hidden=state.mode!=="MIGRATION_REQUIRED";
    if(!migration.hidden){
        byId("firebaseMigrationMessage").textContent=state.migration&&state.migration.message||"偵測到此裝置存在舊版角色資料。只有確認後才會建立備份並綁定目前帳號。";
        byId("firebaseMigrationConfirmButton").disabled=busy||!!(state.migration&&state.migration.blocked);
    }
    byId("firebaseRetryButton").hidden=!state.error;
    renderResumeCountdown();
}
function credentials(){
    const email=String(byId("firebaseEmailInput")?.value||"").trim();
    const password=String(byId("firebasePasswordInput")?.value||"");
    if(!email){ throw new Error("請輸入 Email。"); }
    if(password.length<6){ throw new Error("密碼至少需要 6 個字元。"); }
    return {email,password};
}
async function perform(message,action){
    if(busy){ return; } setBusy(true); setFirebaseAuthUiState({message,error:false});
    try{ await action(); }
    catch(error){ console.error("Firebase account action failed:",error); setFirebaseAuthUiState({message:errorText(error),error:true}); }
    finally{ setBusy(false); render(); }
}
function performInteractive(message,action){
    interactiveAuthThisPage=true;
    return perform(message,action);
}
function dispatchAction(action){ window.dispatchEvent(new CustomEvent("four-symbols:account-ui-action",{detail:{action}})); }
function sessionTestFailureText(error){
    const raw=[error&&error.details&&error.details.code,error&&error.code,error&&error.message].filter(Boolean).join(" ");
    if(raw.includes("SESSION_REVOKED")){ return "❌ 這台裝置已被另一台裝置取代。"; }
    if(raw.includes("SESSION_INVALID")){ return "❌ 這台裝置的登入權限已失效，請重新登入原帳號。"; }
    if(raw.includes("SESSION_REAUTH_REQUIRED")){ return "⚠️ 請重新登入原帳號後再測試。"; }
    if(raw.includes("AUTH_REQUIRED")){ return "⚠️ 目前尚未完成登入，請先登入原帳號。"; }
    return "⚠️ 無法確認目前權限，請稍後再試。";
}
async function testCurrentDeviceSession(){
    if(busy||!DEV_SESSION_TEST_ENABLED){ return; }
    setBusy(true);
    state={...state,sessionTest:"正在確認這台裝置的雲端操作權限…"};
    render();
    try{
        const api=window.FourSymbolsFirebase;
        if(!api||typeof api.protectedTest!=="function"){ throw new Error("SESSION_TEST_UNAVAILABLE"); }
        const result=await api.protectedTest();
        state={...state,sessionTest:result&&result.result==="SUCCESS"
            ?"✅ 這台裝置目前擁有雲端操作權限。"
            :"⚠️ 雲端沒有回傳可辨識的權限結果。"};
    }catch(error){
        console.error("Firebase session authority test failed:",error);
        state={...state,sessionTest:sessionTestFailureText(error)};
    }finally{
        setBusy(false);
        render();
    }
}
async function testCloudSaveEnvelope(){
    if(busy||!DEV_SESSION_TEST_ENABLED){ return; }
    setBusy(true);
    state={...state,cloudEnvelopeTest:"正在建立並讀回 Phase 2 雲端存檔骨架…"};
    render();
    try{
        const api=window.FourSymbolsFirebase;
        if(!api||typeof api.bootstrapCloudSave!=="function"||typeof api.resolveCloudSave!=="function"||typeof api.getUser!=="function"){
            throw new Error("CLOUD_ENVELOPE_TEST_UNAVAILABLE");
        }
        const user=api.getUser();
        if(!user||!user.uid){ throw new Error("AUTH_REQUIRED"); }
        const first=await api.bootstrapCloudSave();
        const second=await api.bootstrapCloudSave();
        const cloud=await api.resolveCloudSave(user);
        const data=cloud&&cloud.data;
        const revision=data&&data.serverRevision;
        const hasGameplayPayload=data&&(
            Object.prototype.hasOwnProperty.call(data,"gameSave")||
            Object.prototype.hasOwnProperty.call(data,"save")||
            Object.prototype.hasOwnProperty.call(data,"authoritativeSave")
        );
        const valid=first&&first.ok===true&&second&&second.ok===true&&cloud&&cloud.exists===true&&data&&
            data.ownerUid===user.uid&&data.schemaVersion===2&&Number.isSafeInteger(revision)&&revision>=1&&
            first.envelopeSchemaVersion===2&&second.envelopeSchemaVersion===2&&
            first.serverRevision===revision&&second.serverRevision===revision&&
            data.authoritativeStateReady===false&&!hasGameplayPayload;
        if(!valid){ throw new Error("CLOUD_ENVELOPE_VALIDATION_FAILED"); }
        state={...state,cloudEnvelopeTest:`✅ Phase 2 驗證成功：Schema V2、Revision ${revision}；重複操作未增加 Revision，也未建立正式遊戲進度。`};
    }catch(error){
        console.error("Firebase cloud-save envelope test failed:",error);
        const sessionMessage=sessionTestFailureText(error);
        state={...state,cloudEnvelopeTest:sessionMessage.startsWith("⚠️ 無法確認")
            ?"⚠️ 雲端存檔骨架驗證失敗；未修改本機角色資料，請稍後再試。"
            :sessionMessage};
    }finally{
        setBusy(false);
        render();
    }
}
function clearResumeTimer(){
    if(resumeInterval){ window.clearInterval(resumeInterval); resumeInterval=0; }
}
function finishClose(){
    clearResumeTimer(); resumeActive=false;
    const node=byId(OVERLAY_ID); if(!node){ return false; }
    node.classList.remove("show"); node.setAttribute("aria-hidden","true"); render(); return true;
}
function gameplayIsReadyBehindAuth(){
    const game=byId("gameInterface");
    return !!(game&&window.getComputedStyle(game).display!=="none");
}
function startResumeGrace(){
    if(resumeActive){ return true; }
    resumeGraceUsed=true; resumeActive=true; resumeDeadline=Date.now()+RESUME_GRACE_MS;
    setFirebaseAuthUiState({message:"已讀取上次登入帳號。你可以在倒數結束前切換帳號。",error:false});
    renderResumeCountdown();
    resumeInterval=window.setInterval(()=>{
        renderResumeCountdown();
        if(Date.now()>=resumeDeadline){ finishClose(); }
    },200);
    return true;
}
function bind(){
    byId("firebaseGoogleButton").addEventListener("click",()=>performInteractive("正在開啟 Google 登入…",signInWithGoogle));
    byId("firebaseGuestButton").addEventListener("click",()=>performInteractive("正在建立 Firebase 訪客 UID…",signInAsAnonymous));
    byId("firebaseEmailSignInButton").addEventListener("click",()=>performInteractive("正在登入 Email 帳號…",()=>{ const value=credentials(); return signInWithEmail(value.email,value.password); }));
    byId("firebaseEmailCreateButton").addEventListener("click",()=>performInteractive("正在建立 Email 帳號…",()=>{ const value=credentials(); return createAccountWithEmail(value.email,value.password); }));
    byId("firebaseSignOutButton").addEventListener("click",()=>perform("正在登出…",signOutFirebase));
    byId("firebaseSwitchAccountButton").addEventListener("click",()=>{
        if(busy){ return; }
        const previousState={...state};
        clearResumeTimer(); resumeActive=false; resumeGraceUsed=true; interactiveAuthThisPage=true;
        state={...state,user:null,mode:"AUTH_REQUIRED",message:"請選擇登入或綁定的帳號。",error:false};
        render(); setBusy(true);
        void signOutFirebase().catch(error=>{
            console.error("Firebase account switch failed:",error);
            state={...previousState,message:errorText(error),error:true};
        }).finally(()=>{ setBusy(false); render(); });
    });
    byId("firebaseMigrationConfirmButton").addEventListener("click",()=>dispatchAction("confirm-migration"));
    byId("firebaseMigrationCancelButton").addEventListener("click",()=>dispatchAction("cancel-migration"));
    byId("firebaseRetryButton").addEventListener("click",()=>dispatchAction("retry"));
    const sessionTestButton=byId("firebaseSessionTestButton");
    if(sessionTestButton){ sessionTestButton.addEventListener("click",()=>{ void testCurrentDeviceSession(); }); }
    const cloudEnvelopeTestButton=byId("firebaseCloudEnvelopeTestButton");
    if(cloudEnvelopeTestButton){ cloudEnvelopeTestButton.addEventListener("click",()=>{ void testCloudSaveEnvelope(); }); }
    byId("firebaseSupportButton").addEventListener("click",()=>window.FourSymbolsSupport.show());
    byId("firebaseAuthBackButton").addEventListener("click",()=>{
        if(!state.user||(state.mode!=="READY"&&state.mode!=="OFFLINE_READY")){ return; }
        finishClose();
    });
}
export function installFirebaseAuthUi(){
    if(installed){ return true; }
    /* Authentication must remain usable before app-shell installs the scaled
       1080x1920 game stage. Keep this responsive surface outside #game-stage. */
    const host=document.body;
    if(!host){ return false; }
    if(!byId(OVERLAY_ID)){ host.appendChild(markup()); }
    installed=true; bind(); state={...state,user:getSignedInUser()}; render(); return true;
}
export function openFirebaseAuthUi(){ const node=byId(OVERLAY_ID); if(!node){ return false; } render(); node.classList.add("show"); node.setAttribute("aria-hidden","false"); return true; }
export function closeFirebaseAuthUi(){
    const node=byId(OVERLAY_ID); if(!node){ return false; }
    if(!interactiveAuthThisPage&&!resumeGraceUsed&&state.user&&gameplayIsReadyBehindAuth()){
        return startResumeGrace();
    }
    return finishClose();
}
export function setFirebaseAuthUiState(next={}){ state={...state,...next}; render(); }
