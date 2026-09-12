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
import {
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

import {
    getFirebaseApp,
    getFirebaseAuth,
    initializeFirebaseAuth
} from "./firebase-auth.86313ff8c064.js";

export const CLOUD_SAVE_WRITE_POLICY = "trusted-backend-only";
export const CLOUD_FUNCTIONS_REGION = "us-central1";
export const CURRENT_SAVE_SUBCOLLECTION = "saves";
export const CURRENT_SAVE_DOCUMENT = "current";
export const LEGACY_LOCAL_SAVE_KEY = "battle_full_version_save_v5";

let firestore = null;
let functions = null;

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

async function ensureFunctions(){
    const app = await ensureFirebaseApp();
    if(!functions){ functions = getFunctions(app, CLOUD_FUNCTIONS_REGION); }
    return functions;
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
    requireSignedInUid();
    const callableFunctions = await ensureFunctions();
    const callable = httpsCallable(callableFunctions, name, { timeout: 30000 });
    const result = await callable(payload || {});
    return result && result.data ? result.data : null;
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

export async function submitLegacyMigrationCandidate(options={}){
    const save = readLegacyLocalSave();
    const clientVersion = String(options.clientVersion || "").trim() || null;
    return callTrustedFunction("submitLegacyMigrationCandidate", {
        save,
        clientVersion
    });
}
