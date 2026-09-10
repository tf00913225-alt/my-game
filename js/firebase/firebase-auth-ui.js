/* Account UI owner. Signed-out production flow cannot be dismissed without Firebase identity. */
import {
    createAccountWithEmail,getSignedInUser,signInAsAnonymous,signInWithEmail,
    signInWithGoogle,signOutFirebase
} from "./firebase-auth.js";

const OVERLAY_ID="firebaseAuthOverlay";
let installed=false;
let busy=false;
let state={mode:"AUTH_RESOLVING",user:null,message:"正在初始化 Firebase Authentication…",error:false,migration:null};

const byId=id=>document.getElementById(id);
function errorText(error){
    const code=String(error&&error.code||"");
    const messages={
        "auth/popup-closed-by-user":"登入視窗已關閉，尚未完成登入。",
        "auth/operation-not-allowed":"Firebase Console 尚未啟用這個登入方式。",
        "auth/invalid-credential":"Email 或密碼不正確。",
        "auth/email-already-in-use":"這個 Email 已註冊，請直接登入。",
        "auth/invalid-email":"Email 格式不正確。",
        "auth/weak-password":"密碼至少需要 6 個字元。",
        "auth/network-request-failed":"網路連線失敗；身份未確認，不會建立新角色。",
        "permission-denied":"雲端存檔讀取被拒絕；不會覆寫任何角色。"
    };
    return messages[code]||String(error&&error.message||"帳號服務發生錯誤，請稍後再試。");
}
function markup(){
    const node=document.createElement("section");
    node.id=OVERLAY_ID; node.className="firebase-auth-overlay"; node.setAttribute("aria-hidden","true");
    node.innerHTML=`
      <div class="firebase-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="firebaseAuthTitle">
        <div class="firebase-auth-eyebrow">FOUR SYMBOLS ACCOUNT</div>
        <h2 id="firebaseAuthTitle" class="firebase-auth-title">帳號與角色</h2>
        <p class="firebase-auth-subtitle">先確認 Firebase UID，再讀取此帳號的角色資料。</p>
        <div id="firebaseAuthStatus" class="firebase-auth-status"></div>
        <div id="firebaseSignedOutPanel">
          <div class="firebase-auth-actions">
            <button id="firebaseGoogleButton" class="firebase-auth-button" type="button">Google 登入</button>
            <button id="firebaseGuestButton" class="firebase-auth-button secondary" type="button">訪客開始遊戲</button>
          </div>
          <div class="firebase-auth-divider">或使用 Email</div>
          <div class="firebase-auth-field"><label for="firebaseEmailInput">Email</label><input id="firebaseEmailInput" type="email" autocomplete="email" inputmode="email"></div>
          <div class="firebase-auth-field"><label for="firebasePasswordInput">密碼</label><input id="firebasePasswordInput" type="password" autocomplete="current-password" minlength="6"></div>
          <div class="firebase-auth-actions">
            <button id="firebaseEmailSignInButton" class="firebase-auth-button" type="button">Email 登入</button>
            <button id="firebaseEmailCreateButton" class="firebase-auth-button secondary" type="button">建立 Email 帳號</button>
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
    ["firebaseGoogleButton","firebaseGuestButton","firebaseEmailSignInButton","firebaseEmailCreateButton","firebaseMigrationConfirmButton","firebaseRetryButton","firebaseSignOutButton"].forEach(id=>{ const button=byId(id); if(button){ button.disabled=busy; } });
}
function render(){
    if(!installed){ return; }
    const status=byId("firebaseAuthStatus");
    status.textContent=state.message||""; status.classList.toggle("is-error",state.error===true);
    const signedOut=byId("firebaseSignedOutPanel"); const signedIn=byId("firebaseSignedInPanel");
    signedOut.hidden=!!state.user; signedIn.classList.toggle("show",!!state.user);
    if(state.user){
        byId("firebaseAccountName").textContent=state.user.displayName||state.user.email||(state.user.isAnonymous?"訪客帳號":"Firebase 帳號");
        byId("firebaseAccountMeta").textContent=state.user.isAnonymous?"Firebase 匿名登入":"已驗證帳號";
        byId("firebaseAccountUid").textContent="UID："+state.user.uid;
        byId("firebaseCloudState").textContent=state.mode==="SAVE_LOADING"?"正在讀取 UID 對應的雲端與本機資料…":"角色資料以此 UID 為 owner。";
    }
    const migration=byId("firebaseMigrationPanel");
    migration.hidden=state.mode!=="MIGRATION_REQUIRED";
    if(!migration.hidden){
        byId("firebaseMigrationMessage").textContent=state.migration&&state.migration.message||"偵測到此裝置存在舊版角色資料。只有確認後才會建立備份並綁定目前帳號。";
        byId("firebaseMigrationConfirmButton").disabled=busy||!!(state.migration&&state.migration.blocked);
    }
    byId("firebaseRetryButton").hidden=!state.error;
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
function dispatchAction(action){ window.dispatchEvent(new CustomEvent("four-symbols:account-ui-action",{detail:{action}})); }
function bind(){
    byId("firebaseGoogleButton").addEventListener("click",()=>perform("正在開啟 Google 登入…",signInWithGoogle));
    byId("firebaseGuestButton").addEventListener("click",()=>perform("正在建立 Firebase 訪客 UID…",signInAsAnonymous));
    byId("firebaseEmailSignInButton").addEventListener("click",()=>perform("正在登入 Email 帳號…",()=>{ const value=credentials(); return signInWithEmail(value.email,value.password); }));
    byId("firebaseEmailCreateButton").addEventListener("click",()=>perform("正在建立 Email 帳號…",()=>{ const value=credentials(); return createAccountWithEmail(value.email,value.password); }));
    byId("firebaseSignOutButton").addEventListener("click",()=>perform("正在登出…",signOutFirebase));
    byId("firebaseMigrationConfirmButton").addEventListener("click",()=>dispatchAction("confirm-migration"));
    byId("firebaseMigrationCancelButton").addEventListener("click",()=>dispatchAction("cancel-migration"));
    byId("firebaseRetryButton").addEventListener("click",()=>dispatchAction("retry"));
    byId("firebaseSupportButton").addEventListener("click",()=>window.FourSymbolsSupport.show());
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
export function openFirebaseAuthUi(){ const node=byId(OVERLAY_ID); if(!node){ return false; } node.classList.add("show"); node.setAttribute("aria-hidden","false"); return true; }
export function closeFirebaseAuthUi(){ const node=byId(OVERLAY_ID); if(!node){ return false; } node.classList.remove("show"); node.setAttribute("aria-hidden","true"); return true; }
export function setFirebaseAuthUiState(next={}){ state={...state,...next}; render(); }
