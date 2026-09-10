/* Firebase lifecycle owner: identity resolution is a separate phase from cloud-save resolution. */
import {
    createAccountWithEmail,getFirebaseAuthConfigStatus,getSignedInUser,initializeFirebaseAuth,
    observeFirebaseAuthState,signInAsAnonymous,signInWithEmail,signInWithFacebook,signInWithGoogle,signOutFirebase
} from "./firebase-auth.js";
import {
    CLOUD_FUNCTIONS_REGION,CLOUD_SAVE_WRITE_POLICY,readCurrentCloudSave,
    submitLegacyMigrationCandidate
} from "./firebase-cloud-save.js";
import {closeFirebaseAuthUi,installFirebaseAuthUi,openFirebaseAuthUi,setFirebaseAuthUiState} from "./firebase-auth-ui.js";

const AUTH_EVENT="four-symbols:firebase-auth-state";
let lifecyclePromise=null;
let firstIdentityPromise=null;
let firstIdentityResolve=null;
let firstIdentityReject=null;
let unsubscribe=null;
let generation=0;

function dispatch(name,detail){ window.dispatchEvent(new CustomEvent(name,{detail})); }
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
                setFirebaseAuthUiState({mode:"ERROR",user:null,message:String(error.message||error),error:true});
                if(firstIdentityReject){ firstIdentityReject(error); firstIdentityResolve=null; firstIdentityReject=null; }
                dispatch(AUTH_EVENT,{user:null,error,generation}); return;
            }
            setFirebaseAuthUiState({mode:user?"SAVE_LOADING":"AUTH_REQUIRED",user,message:user?"正在確認此 UID 的角色資料…":"請先登入、註冊或使用訪客開始遊戲。",error:false});
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
    submitLegacyMigrationCandidate,openAuth:openFirebaseAuthUi,closeAuth:closeFirebaseAuthUi,
    setUiState:setFirebaseAuthUiState,cloudSaveWritePolicy:CLOUD_SAVE_WRITE_POLICY,
    cloudFunctionsRegion:CLOUD_FUNCTIONS_REGION,dispose:()=>{ if(unsubscribe){ unsubscribe(); unsubscribe=null; } }
});
window.FourSymbolsFirebase=api;
window.FourSymbolsFirebaseLifecycle=api;
dispatch("four-symbols:firebase-module-ready",{cloudSaveWritePolicy:CLOUD_SAVE_WRITE_POLICY});
