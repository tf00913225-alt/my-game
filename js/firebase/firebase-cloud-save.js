/*
 * Read-only cloud-save client owner.
 *
 * Current Firestore rules allow an authenticated player to read only their own
 * /users/{uid} tree and deny all browser create/update/delete operations.
 * Keep it that way: authoritative writes will be added through a trusted backend.
 */

import {
    doc,
    getDoc,
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    getFirebaseApp,
    getFirebaseAuth,
    initializeFirebaseAuth
} from "./firebase-auth.js";

export const CLOUD_SAVE_WRITE_POLICY = "trusted-backend-only";
export const CURRENT_SAVE_SUBCOLLECTION = "saves";
export const CURRENT_SAVE_DOCUMENT = "current";

let firestore = null;

async function ensureFirestore(){
    await initializeFirebaseAuth();
    const app = getFirebaseApp();
    if(!app){
        const error = new Error("Firebase app is not initialized.");
        error.code = "firebase/app-not-initialized";
        throw error;
    }
    if(!firestore){ firestore = getFirestore(app); }
    return firestore;
}

function requireSignedInUid(){
    const auth = getFirebaseAuth();
    const uid = auth && auth.currentUser && auth.currentUser.uid;
    if(!uid){
        const error = new Error("A signed-in Firebase user is required before reading cloud save data.");
        error.code = "firebase/auth-required";
        throw error;
    }
    return uid;
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
