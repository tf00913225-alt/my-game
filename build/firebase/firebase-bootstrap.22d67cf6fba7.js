/* Firebase lifecycle owner: identity resolution is a separate phase from cloud-save resolution. */
import {
    createAccountWithEmail,getFirebaseAuthConfigStatus,getSignedInUser,initializeFirebaseAuth,
    observeFirebaseAuthState,signInAsAnonymous,signInWithEmail,signInWithFacebook,signInWithGoogle,signOutFirebase,
    installFirebaseSessionHooks
} from "./firebase-auth.6a269762828f.js";
import {
    bootstrapTrustedCloudSave,CLOUD_FUNCTIONS_REGION,CLOUD_SAVE_WRITE_POLICY,readCurrentCloudSave,saveLocalAutoBattlePreferences,
    submitLegacyMigrationCandidate
} from "./firebase-cloud-save.1c6416c3c7a2.js";
import {closeFirebaseAuthUi,installFirebaseAuthUi,openFirebaseAuthUi,setFirebaseAuthUiState} from "./firebase-auth-ui.8e0c70132175.js";
import {synchronizeGameSession,revokeGameSession,protectedTest,getGameSessionState} from "./firebase-session.cb0907b5ca79.js";

const AUTH_EVENT="four-symbols:firebase-auth-state";
let lifecyclePromise=null;
let firstIdentityPromise=null;
let firstIdentityResolve=null;
let firstIdentityReject=null;
let unsubscribe=null;
let generation=0;

function dispatch(name,detail){ window.dispatchEvent(new CustomEvent(name,{detail})); }
function synchronizeSession(user){
    /* Identity/read-only boot remains available during backend outages. Every
     * protected callable independently requires an active backend credential. */
    void synchronizeGameSession(user).catch(error=>{
        if(error.code!=="ACCOUNT_CHANGED"){
            dispatch("four-symbols:game-session-error",{code:error.code||"SESSION_UNAVAILABLE"});
        }
    });
}
installFirebaseSessionHooks({signedIn:synchronizeSession,beforeSignOut:revokeGameSession});
window.addEventListener("four-symbols:game-session-state",event=>{
    const code=event.detail?.code;
    const message=code?`${code}：雲端操作已停用。請重新登入原帳號；訪客請先聯絡客服保留原 UID。`:null;
    setFirebaseAuthUiState({sessionError:message});
});
function identityPromise(){
    if(!firstIdentityPromise){
        firstIdentityPromise=new Promise((resolve,reject)=>{ firstIdentityResolve=resolve; firstIdentityReject=reject; });
    }
    return firstIdentityPromise;
}
async function initializeLifecycle(){
    if(lifecyclePromise){ return lifecyclePromise; }
    lifecyclePromise=(async()=>{
        const status=getFirebaseAuthConfigStatus();
        if(!status.ready){ const error=new Error("Firebase Web config is incomplete."); error.code="firebase/config-missing"; throw error; }
        installFirebaseAuthUi();
        identityPromise();
        await initializeFirebaseAuth();
        unsubscribe=await observeFirebaseAuthState((user,error)=>{
            generation++;
            if(error){
                synchronizeSession(null);
                setFirebaseAuthUiState({mode:"ERROR",user:null,message:String(error.message||error),error:true});
                if(firstIdentityReject){ firstIdentityReject(error); firstIdentityResolve=null; firstIdentityReject=null; }
                dispatch(AUTH_EVENT,{user:null,error,generation}); return;
            }
            setFirebaseAuthUiState({mode:user?"SAVE_LOADING":"AUTH_REQUIRED",user,message:user?"正在確認此 UID 的角色資料…":"請先登入、註冊或使用訪客開始遊戲。",error:false});
            synchronizeSession(user);
            if(firstIdentityResolve){ firstIdentityResolve(user); firstIdentityResolve=null; firstIdentityReject=null; }
            dispatch(AUTH_EVENT,{user,error:null,generation});
        });
        return {status};
    })();
    try{ return await lifecyclePromise; }
    catch(error){ lifecyclePromise=null; throw error; }
}
async function resolveIdentity(){ await initializeLifecycle(); return identityPromise(); }
async function resolveCloudSave(user){
    const expectedUid=String(user&&user.uid||"");
    if(!expectedUid){ const error=new Error("Firebase identity is required before save resolution."); error.code="firebase/auth-required"; throw error; }
    const token=generation;
    const result=await readCurrentCloudSave();
    const latest=getSignedInUser();
    if(!latest||latest.uid!==expectedUid||token!==generation){
        const error=new Error("Firebase account changed during cloud-save resolution."); error.code="firebase/account-changed"; throw error;
    }
    dispatch("four-symbols:firebase-cloud-save-read",{user:latest,result,error:null});
    return result;
}
const api=Object.freeze({
    initialize:initializeLifecycle,resolveIdentity,resolveCloudSave,getUser:getSignedInUser,
    signInWithGoogle,signInWithFacebook,signInWithEmail,createAccountWithEmail,signInAsAnonymous,signOut:signOutFirebase,
    bootstrapCloudSave:bootstrapTrustedCloudSave,submitLegacyMigrationCandidate,saveLocalAutoBattlePreferences,protectedTest,getGameSessionState,
    openAuth:openFirebaseAuthUi,closeAuth:closeFirebaseAuthUi,
    setUiState:setFirebaseAuthUiState,cloudSaveWritePolicy:CLOUD_SAVE_WRITE_POLICY,
    cloudFunctionsRegion:CLOUD_FUNCTIONS_REGION,dispose:()=>{ if(unsubscribe){ unsubscribe(); unsubscribe=null; } }
});
window.FourSymbolsFirebase=api;
window.FourSymbolsFirebaseLifecycle=api;
dispatch("four-symbols:firebase-module-ready",{cloudSaveWritePolicy:CLOUD_SAVE_WRITE_POLICY});
