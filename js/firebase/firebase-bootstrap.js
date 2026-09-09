/*
 * Thin browser bridge for Firebase services.
 * Keep game-save mutation and Firebase implementation details outside this file.
 */

import {
    createAccountWithEmail,
    getFirebaseAuthConfigStatus,
    getSignedInUser,
    initializeFirebaseAuth,
    observeFirebaseAuthState,
    signInAsAnonymous,
    signInWithEmail,
    signInWithGoogle,
    signOutFirebase
} from "./firebase-auth.js";
import {
    CLOUD_SAVE_WRITE_POLICY,
    readCurrentCloudSave
} from "./firebase-cloud-save.js";
import {
    closeFirebaseAuthUi,
    installFirebaseAuthUi,
    openFirebaseAuthUi,
    setFirebaseAuthUiState
} from "./firebase-auth-ui.js";

const EVENT_READY = "four-symbols:firebase-ready";
const EVENT_AUTH_STATE = "four-symbols:firebase-auth-state";
const EVENT_CLOUD_SAVE = "four-symbols:firebase-cloud-save-read";
const EVENT_CONFIG_MISSING = "four-symbols:firebase-config-missing";

function dispatch(name, detail){
    if(typeof window === "undefined" || typeof window.dispatchEvent !== "function"){ return; }
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function readCloudSaveForUser(user){
    if(!user || !user.uid){
        setFirebaseAuthUiState({
            user:null,
            cloudState:{ status:"idle",result:null,error:null }
        });
        return null;
    }

    const expectedUid = user.uid;
    setFirebaseAuthUiState({
        user,
        cloudState:{ status:"loading",result:null,error:null }
    });

    try{
        const result = await readCurrentCloudSave();
        const latest = getSignedInUser();
        if(!latest || latest.uid !== expectedUid){ return null; }

        setFirebaseAuthUiState({
            user:latest,
            cloudState:{ status:"ready",result,error:null }
        });
        dispatch(EVENT_CLOUD_SAVE,{ user:latest,result,error:null });
        return result;
    }catch(error){
        const latest = getSignedInUser();
        if(latest && latest.uid === expectedUid){
            setFirebaseAuthUiState({
                user:latest,
                cloudState:{ status:"error",result:null,error }
            });
            dispatch(EVENT_CLOUD_SAVE,{ user:latest,result:null,error });
        }
        return null;
    }
}

const api = Object.freeze({
    getConfigStatus: getFirebaseAuthConfigStatus,
    getUser: getSignedInUser,
    initialize: initializeFirebaseAuth,
    observeAuthState: observeFirebaseAuthState,
    signInWithGoogle,
    signInWithEmail,
    createAccountWithEmail,
    signInAsAnonymous,
    signOut: signOutFirebase,
    readCurrentCloudSave,
    openAuth: openFirebaseAuthUi,
    closeAuth: closeFirebaseAuthUi,
    cloudSaveWritePolicy: CLOUD_SAVE_WRITE_POLICY
});

if(typeof window !== "undefined"){
    window.FourSymbolsFirebase = api;
}

const configStatus = getFirebaseAuthConfigStatus();
if(!configStatus.ready){
    dispatch(EVENT_CONFIG_MISSING, configStatus);
    console.error(
        "Firebase Auth foundation is inactive because Firebase Web config is incomplete:",
        configStatus.missingFields.join(", ")
    );
}else{
    installFirebaseAuthUi();

    initializeFirebaseAuth()
        .then(()=>observeFirebaseAuthState((user, error)=>{
            if(error){
                setFirebaseAuthUiState({ user:null,authError:error });
                dispatch(EVENT_AUTH_STATE,{ user:null,error });
                return;
            }

            setFirebaseAuthUiState({
                user,
                cloudState:{ status:user?"loading":"idle",result:null,error:null }
            });
            dispatch(EVENT_AUTH_STATE,{ user,error:null });

            if(user){
                void readCloudSaveForUser(user);
            }
        }))
        .then(()=>dispatch(EVENT_READY,{
            projectId: configStatus.projectId,
            sdkVersion: configStatus.sdkVersion,
            cloudSaveWritePolicy: CLOUD_SAVE_WRITE_POLICY
        }))
        .catch((error)=>{
            console.error("Firebase Auth initialization failed:", error);
            setFirebaseAuthUiState({ user:null,authError:error });
            dispatch(EVENT_AUTH_STATE,{ user:null,error });
        });
}
