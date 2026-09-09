/*
 * Firebase account UI owner.
 *
 * The overlay is injected into #game-stage so it follows the official 1080×1920
 * stage transform. It does not mutate the existing game save or page layout.
 */

import {
    createAccountWithEmail,
    getSignedInUser,
    signInAsAnonymous,
    signInWithEmail,
    signInWithGoogle,
    signOutFirebase
} from "./firebase-auth.js";

const STYLE_ID = "firebase-auth-style";
const OVERLAY_ID = "firebaseAuthOverlay";
const STARTUP_ENTERED_EVENT = "v173.20:startup-entered";

let installed = false;
let startupEntered = false;
let dismissedThisDocument = false;
let busy = false;
let currentUser = null;
let cloudState = Object.freeze({ status:"idle", result:null, error:null });

function byId(id){ return document.getElementById(id); }

function ensureStyle(){
    if(document.getElementById(STYLE_ID)){ return; }
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = "css/firebase-auth.css?v=173.64";
    document.head.appendChild(link);
}

function authErrorText(error){
    const code = String(error && error.code || "");
    const messages = {
        "auth/popup-closed-by-user":"登入視窗已關閉，尚未完成登入。",
        "auth/cancelled-popup-request":"上一個登入視窗已取消，請再試一次。",
        "auth/operation-not-allowed":"Firebase Console 尚未啟用這個登入方式。",
        "auth/invalid-credential":"Email 或密碼不正確。",
        "auth/user-disabled":"這個帳號目前已停用。",
        "auth/email-already-in-use":"這個 Email 已經註冊過，請直接登入。",
        "auth/invalid-email":"Email 格式不正確。",
        "auth/weak-password":"密碼強度不足，請至少使用 6 個字元。",
        "auth/network-request-failed":"網路連線失敗，請確認網路後再試一次。",
        "auth/unauthorized-domain":"目前遊戲網域尚未加入 Firebase Authentication 的 Authorized domains。",
        "permission-denied":"Firestore 拒絕讀取目前帳號的雲端存檔。"
    };
    return messages[code] || String(error && error.message || "登入服務發生錯誤，請稍後再試。");
}

function buildMarkup(){
    const overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "firebase-auth-overlay";
    overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML = `
        <div class="firebase-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="firebaseAuthTitle">
            <div class="firebase-auth-eyebrow">FOUR SYMBOLS ACCOUNT</div>
            <h2 id="firebaseAuthTitle" class="firebase-auth-title">帳號與雲端存檔</h2>
            <p class="firebase-auth-subtitle">
                登入後會取得專屬 UID，供跨裝置雲端存檔使用。現階段只讀取雲端資料，不會讓瀏覽器直接修改正式角色資產。
            </p>

            <div id="firebaseAuthStatus" class="firebase-auth-status">正在初始化 Firebase Authentication…</div>

            <div id="firebaseSignedOutPanel">
                <div class="firebase-auth-actions">
                    <button id="firebaseGoogleButton" class="firebase-auth-button" type="button">使用 Google 登入</button>
                    <button id="firebaseGuestButton" class="firebase-auth-button secondary" type="button">訪客模式（匿名帳號）</button>
                </div>

                <div class="firebase-auth-divider">或使用 Email</div>

                <div class="firebase-auth-field">
                    <label for="firebaseEmailInput">Email</label>
                    <input id="firebaseEmailInput" type="email" autocomplete="email" inputmode="email" placeholder="name@example.com">
                </div>
                <div class="firebase-auth-field">
                    <label for="firebasePasswordInput">密碼</label>
                    <input id="firebasePasswordInput" type="password" autocomplete="current-password" minlength="6" placeholder="至少 6 個字元">
                </div>
                <div class="firebase-auth-actions">
                    <button id="firebaseEmailSignInButton" class="firebase-auth-button" type="button">Email 登入</button>
                    <button id="firebaseEmailCreateButton" class="firebase-auth-button secondary" type="button">建立新帳號</button>
                </div>
            </div>

            <div id="firebaseSignedInPanel" class="firebase-auth-account">
                <div class="firebase-auth-account-card">
                    <div id="firebaseAccountName" class="firebase-auth-account-name">已登入</div>
                    <div id="firebaseAccountMeta" class="firebase-auth-account-meta"></div>
                    <code id="firebaseAccountUid" class="firebase-auth-uid"></code>
                    <div id="firebaseCloudState" class="firebase-auth-cloud-state"></div>
                </div>
                <div class="firebase-auth-actions">
                    <button id="firebaseContinueButton" class="firebase-auth-button" type="button">進入江湖</button>
                    <button id="firebaseSignOutButton" class="firebase-auth-button danger" type="button">登出帳號</button>
                </div>
            </div>

            <p class="firebase-auth-note">
                「訪客模式」仍會建立 Firebase 匿名 UID，但不等於已綁定 Google／Email。正式雲端寫入會由可信後端驗證後處理，本階段不會用雲端資料自動覆蓋既有本機進度。
            </p>

            <div class="firebase-auth-footer">
                <button id="firebaseLocalOnlyButton" class="firebase-auth-button secondary" type="button">先使用本機存檔</button>
            </div>
        </div>
    `;
    return overlay;
}

function getHost(){
    return document.getElementById("game-stage") || document.body;
}

function setStatus(message, type){
    const node = byId("firebaseAuthStatus");
    if(!node){ return; }
    node.textContent = String(message || "");
    node.classList.toggle("is-error",type === "error");
    node.classList.toggle("is-success",type === "success");
}

function setBusy(next){
    busy = next === true;
    [
        "firebaseGoogleButton",
        "firebaseGuestButton",
        "firebaseEmailSignInButton",
        "firebaseEmailCreateButton",
        "firebaseSignOutButton"
    ].forEach((id)=>{
        const button = byId(id);
        if(button){ button.disabled = busy; }
    });
}

function cloudStateText(){
    if(!currentUser){ return ""; }
    if(cloudState.status === "loading"){
        return "雲端存檔：正在讀取 users/"+currentUser.uid+"/saves/current…";
    }
    if(cloudState.status === "ready"){
        if(cloudState.result && cloudState.result.exists){
            return "雲端存檔：已成功讀取目前帳號的 current 存檔（本階段不自動覆蓋本機進度）。";
        }
        return "雲端存檔：讀取成功，目前尚未建立 current 存檔。";
    }
    if(cloudState.status === "error"){
        return "雲端存檔：讀取失敗 — "+authErrorText(cloudState.error);
    }
    return "雲端存檔：等待登入後檢查。";
}

function render(){
    const signedOut = byId("firebaseSignedOutPanel");
    const signedIn = byId("firebaseSignedInPanel");
    if(!signedOut || !signedIn){ return; }

    const signedInNow = !!currentUser;
    signedOut.hidden = signedInNow;
    signedIn.classList.toggle("show",signedInNow);

    const localOnly = byId("firebaseLocalOnlyButton");
    if(localOnly){ localOnly.hidden = signedInNow; }

    if(!signedInNow){
        if(!busy){ setStatus("尚未登入。可使用 Google、Email 或訪客模式取得 Firebase UID。",""); }
        return;
    }

    const name = byId("firebaseAccountName");
    const meta = byId("firebaseAccountMeta");
    const uid = byId("firebaseAccountUid");
    const cloud = byId("firebaseCloudState");
    if(name){
        name.textContent = currentUser.displayName || currentUser.email || (currentUser.isAnonymous ? "訪客帳號" : "Firebase 帳號");
    }
    if(meta){
        const provider = currentUser.isAnonymous
            ? "匿名登入"
            : (currentUser.providerIds && currentUser.providerIds.length ? currentUser.providerIds.join("、") : "已驗證帳號");
        meta.textContent = "登入方式："+provider+(currentUser.email ? "　Email："+currentUser.email : "");
    }
    if(uid){ uid.textContent = "UID："+currentUser.uid; }
    if(cloud){ cloud.textContent = cloudStateText(); }

    if(cloudState.status === "error"){
        setStatus("帳號登入成功，但雲端存檔讀取尚未通過。", "error");
    }else if(cloudState.status === "ready"){
        setStatus("Firebase 登入成功，UID 與雲端讀取流程已就緒。", "success");
    }else{
        setStatus("Firebase 登入成功，正在檢查雲端存檔…", "success");
    }
}

function readCredentials(){
    const email = String(byId("firebaseEmailInput") && byId("firebaseEmailInput").value || "").trim();
    const password = String(byId("firebasePasswordInput") && byId("firebasePasswordInput").value || "");
    if(!email){
        const error = new Error("請輸入 Email。");
        error.code = "ui/email-required";
        throw error;
    }
    if(password.length < 6){
        const error = new Error("密碼至少需要 6 個字元。");
        error.code = "ui/password-too-short";
        throw error;
    }
    return { email, password };
}

async function perform(label, action){
    if(busy){ return; }
    setBusy(true);
    setStatus(label," ");
    try{
        await action();
    }catch(error){
        console.error("Firebase account action failed:",error);
        setStatus(authErrorText(error),"error");
    }finally{
        setBusy(false);
        render();
    }
}

function bindActions(){
    byId("firebaseGoogleButton")?.addEventListener("click",()=>perform("正在開啟 Google 登入…",()=>signInWithGoogle()));
    byId("firebaseGuestButton")?.addEventListener("click",()=>perform("正在建立訪客 UID…",()=>signInAsAnonymous()));
    byId("firebaseEmailSignInButton")?.addEventListener("click",()=>perform("正在登入 Email 帳號…",()=>{
        const {email,password}=readCredentials();
        return signInWithEmail(email,password);
    }));
    byId("firebaseEmailCreateButton")?.addEventListener("click",()=>perform("正在建立 Email 帳號…",()=>{
        const {email,password}=readCredentials();
        return createAccountWithEmail(email,password);
    }));
    byId("firebaseSignOutButton")?.addEventListener("click",()=>perform("正在登出…",()=>signOutFirebase()));
    byId("firebaseContinueButton")?.addEventListener("click",closeFirebaseAuthUi);
    byId("firebaseLocalOnlyButton")?.addEventListener("click",()=>{
        dismissedThisDocument = true;
        closeFirebaseAuthUi();
    });
}

function maybeOpenForSignedOut(){
    if(!installed || currentUser || dismissedThisDocument){ return; }
    const startup = document.getElementById("startupLoader");
    const startupGone = !startup || startup.hidden === true || startup.getAttribute("aria-hidden") === "true";
    if(startupEntered || startupGone){ openFirebaseAuthUi(); }
}

export function openFirebaseAuthUi(){
    const overlay = byId(OVERLAY_ID);
    if(!overlay){ return false; }
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");
    render();
    return true;
}

export function closeFirebaseAuthUi(){
    const overlay = byId(OVERLAY_ID);
    if(!overlay){ return false; }
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
    return true;
}

export function setFirebaseAuthUiState(next={}){
    if(Object.prototype.hasOwnProperty.call(next,"user")){
        currentUser = next.user || null;
    }
    if(next.cloudState){
        cloudState = Object.freeze({
            status: next.cloudState.status || "idle",
            result: next.cloudState.result || null,
            error: next.cloudState.error || null
        });
    }
    if(next.authError){
        setStatus(authErrorText(next.authError),"error");
    }
    render();
    if(!currentUser){ window.setTimeout(maybeOpenForSignedOut,0); }
}

export function installFirebaseAuthUi(){
    if(installed){ return true; }
    if(typeof document === "undefined"){ return false; }
    installed = true;
    ensureStyle();

    const host = getHost();
    if(!host){
        installed = false;
        return false;
    }

    if(!byId(OVERLAY_ID)){
        host.appendChild(buildMarkup());
    }
    bindActions();
    currentUser = getSignedInUser();
    render();

    document.addEventListener(STARTUP_ENTERED_EVENT,()=>{
        startupEntered = true;
        maybeOpenForSignedOut();
    });

    window.setTimeout(maybeOpenForSignedOut,1600);
    return true;
}
