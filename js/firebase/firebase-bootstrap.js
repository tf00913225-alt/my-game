/*
 * Thin browser bridge for Firebase services.
 * Keep UI, game-save mutation and Firebase implementation details outside this file.
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

const EVENT_READY = "four-symbols:firebase-ready";
const EVENT_AUTH_STATE = "four-symbols:firebase-auth-state";
const EVENT_CONFIG_MISSING = "four-symbols:firebase-config-missing";

function dispatch(name, detail){
    if(typeof window === "undefined" || typeof window.dispatchEvent !== "function"){ return; }
    window.dispatchEvent(new CustomEvent(name, { detail }));
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
    cloudSaveWritePolicy: CLOUD_SAVE_WRITE_POLICY
});

if(typeof window !== "undefined"){
    window.FourSymbolsFirebase = api;
}

const configStatus = getFirebaseAuthConfigStatus();
if(!configStatus.ready){
    dispatch(EVENT_CONFIG_MISSING, configStatus);
    console.info(
        "Firebase Auth foundation is installed but inactive until Firebase Web config is completed:",
        configStatus.missingFields.join(", ")
    );
}else{
    initializeFirebaseAuth()
        .then(()=>observeFirebaseAuthState((user, error)=>{
            dispatch(EVENT_AUTH_STATE, { user, error: error || null });
        }))
        .then(()=>dispatch(EVENT_READY, { projectId: configStatus.projectId }))
        .catch((error)=>{
            console.error("Firebase Auth initialization failed:", error);
            dispatch(EVENT_AUTH_STATE, { user: null, error });
        });
}
