/*
 * Cloud-save client owner.
 *
 * Firestore remains read-only from the browser. Trusted mutations are callable
 * Cloud Functions which require Firebase Authentication and write with Admin SDK.
 * No function in this module wraps saveGame()/loadGame() or directly mutates
 * official Firestore progression.
 */

import {
    doc,
    getDoc,
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {CLOUD_FUNCTIONS_REGION,callProtectedFunction} from "./firebase-session.js";

import {
    getFirebaseApp,
    getFirebaseAuth,
    initializeFirebaseAuth
} from "./firebase-auth.js";

export const CLOUD_SAVE_WRITE_POLICY = "trusted-backend-only";
export {CLOUD_FUNCTIONS_REGION};
export const CURRENT_SAVE_SUBCOLLECTION = "saves";
export const CURRENT_SAVE_DOCUMENT = "current";
export const LEGACY_LOCAL_SAVE_KEY = "battle_full_version_save_v5";

let firestore = null;

async function ensureFirebaseApp(){
    await initializeFirebaseAuth();
    const app = getFirebaseApp();
    if(!app){
        const error = new Error("Firebase app is not initialized.");
        error.code = "firebase/app-not-initialized";
        throw error;
    }
    return app;
}

async function ensureFirestore(){
    const app = await ensureFirebaseApp();
    if(!firestore){ firestore = getFirestore(app); }
    return firestore;
}

function requireSignedInUid(){
    const auth = getFirebaseAuth();
    const uid = auth && auth.currentUser && auth.currentUser.uid;
    if(!uid){
        const error = new Error("A signed-in Firebase user is required for cloud-save access.");
        error.code = "firebase/auth-required";
        throw error;
    }
    return uid;
}

function readLegacyLocalSave(){
    let raw;
    try{
        raw = window.localStorage.getItem(LEGACY_LOCAL_SAVE_KEY);
    }catch(error){
        error.code = error.code || "firebase/local-save-unavailable";
        throw error;
    }

    if(!raw){
        const error = new Error("No current local save exists to submit for migration review.");
        error.code = "firebase/local-save-missing";
        throw error;
    }

    try{
        const parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)){
            throw new Error("Local save is not an object.");
        }
        return parsed;
    }catch(cause){
        const error = new Error("Current local save is not valid JSON.");
        error.code = "firebase/local-save-invalid";
        error.cause = cause;
        throw error;
    }
}

async function callTrustedFunction(name, payload){
    const expectedUid=requireSignedInUid();
    return callProtectedFunction(name,payload||{},expectedUid);
}

export async function readCurrentCloudSave(){
    const db = await ensureFirestore();
    const uid = requireSignedInUid();
    const reference = doc(db, "users", uid, CURRENT_SAVE_SUBCOLLECTION, CURRENT_SAVE_DOCUMENT);
    const snapshot = await getDoc(reference);

    if(!snapshot.exists()){
        return Object.freeze({ exists: false, uid, path: reference.path, data: null });
    }

    return Object.freeze({
        exists: true,
        uid,
        path: reference.path,
        data: snapshot.data()
    });
}

export async function bootstrapTrustedCloudSave(){
    return callTrustedFunction("bootstrapCloudSave", {});
}

/* Explicit, same-UID preference upload. Never sends the character save,
 * and never runs as part of saveGame, login or offline replay. */
export async function saveLocalAutoBattlePreferences(expectedRevision){
    const uid=requireSignedInUid();
    const repository=window.FourSymbolsAccountSave;
    if(!repository||repository.getActiveUid()!==uid){
        const error=new Error("The active local save belongs to another account.");
        error.code="ACCOUNT_CHANGED";
        throw error;
    }
    const local=repository.readForUid(uid);
    if(local.status!=="ready"){
        const error=new Error("No verified local character save is available.");
        error.code="LOCAL_SAVE_REQUIRED";
        throw error;
    }
    const {player,player2,player3,autoConfig,autoConfig2,autoConfig3}=local.save;
    const characterIds=[player,player2,player3].map(character=>character?.id||null);
    const preferences=JSON.parse(JSON.stringify({characterIds,autoConfig,autoConfig2,autoConfig3}));
    return callTrustedFunction("saveCloudPreferences",{preferences,expectedRevision});
}

export async function submitLegacyMigrationCandidate(options={}){
    const save = readLegacyLocalSave();
    const clientVersion = String(options.clientVersion || "").trim() || null;
    return callTrustedFunction("submitLegacyMigrationCandidate", {
        save,
        clientVersion
    });
}
