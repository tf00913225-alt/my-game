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
import {CLOUD_FUNCTIONS_REGION,callProtectedFunction} from "./firebase-session.fe006c0f84a7.js";

import {
    getFirebaseApp,
    getFirebaseAuth,
    initializeFirebaseAuth
} from "./firebase-auth.f756f769b4e4.js";

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

async function sha256(raw){
    const bytes=new TextEncoder().encode(raw);
    const digest=await window.crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
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
    const {player,player2,player3}=local.save;
    const characterIds=[player,player2,player3].map(character=>character?.id||null);
    /* Old UID saves may contain only some of these fields. Project the five
     * approved settings with gameplay defaults; never forward other save data. */
    const projectConfig=(value)=>{
        if(value!==undefined&&value!==null&&(typeof value!=="object"||Array.isArray(value))){
            const error=new Error("Local auto-battle settings are invalid.");
            error.code="LOCAL_PREFERENCES_INVALID";
            throw error;
        }
        const config=value||{};
        return {
            enabled:config.enabled??false,
            skill:config.skill??"normal",
            hp:config.hp??50,
            sp:config.sp??25,
            returnToCityWhenEmpty:config.returnToCityWhenEmpty??false
        };
    };
    const preferences={
        characterIds,
        autoConfig:projectConfig(local.save.autoConfig),
        autoConfig2:projectConfig(local.save.autoConfig2),
        autoConfig3:projectConfig(local.save.autoConfig3)
    };
    return callTrustedFunction("saveCloudPreferences",{preferences,expectedRevision});
}

export async function submitLegacyMigrationCandidate(options={}){
    const uid=requireSignedInUid();
    const repository=window.FourSymbolsAccountSave;
    if(!repository||repository.getActiveUid()!==uid){
        throw Object.assign(new Error("Active UID changed."),{code:"ACCOUNT_CHANGED"});
    }
    // The caller selects a previously sealed backup. No live gameplay or legacy
    // key is read between owner confirmation and the protected callable.
    const backup=repository.verifyMigrationBackup(uid,options.backupKey);
    const sidecarManifest=JSON.stringify(backup.sidecars);
    const [backupDigest,manifestDigest]=await Promise.all([
        sha256(JSON.stringify({ownerUid:uid,mainRaw:backup.mainRaw,
            metadataRaw:backup.metadataRaw,sidecars:backup.sidecars})),
        sha256(sidecarManifest)
    ]);
    if(requireSignedInUid()!==uid||repository.getActiveUid()!==uid){
        throw Object.assign(new Error("Account changed during backup verification."),{code:"ACCOUNT_CHANGED"});
    }
    const clientVersion = String(options.clientVersion || "").trim() || null;
    if(!Number.isSafeInteger(options.expectedRevision)||options.expectedRevision<1){
        throw Object.assign(new Error("A current cloud revision is required."),{code:"CLOUD_REVISION_REQUIRED"});
    }
    return callTrustedFunction("submitLegacyMigrationCandidate", {
        expectedRevision:options.expectedRevision,
        backup:{schemaVersion:backup.schemaVersion,backupId:backup.backupKey,
            ownerUid:uid,mainFingerprint:backup.mainFingerprint,
            sidecarManifestFingerprint:backup.sidecarManifestFingerprint,
            mainRaw:backup.mainRaw,metadataRaw:backup.metadataRaw,
            sidecars:backup.sidecars,sidecarManifestSha256:manifestDigest,
            backupSha256:backupDigest},
        clientVersion
    });
}

/* Creates an explicit immutable UID backup before any future migration
 * consent. It does not upload, promote or restore gameplay state. */
export function createLocalMigrationBackup(){
    const uid=requireSignedInUid();
    const repository=window.FourSymbolsAccountSave;
    if(!repository||repository.getActiveUid()!==uid){
        const error=new Error("The active local save belongs to another account.");
        error.code="ACCOUNT_CHANGED";
        throw error;
    }
    return repository.createMigrationBackup(uid);
}
