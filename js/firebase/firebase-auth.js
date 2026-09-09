/*
 * Firebase Authentication owner.
 *
 * Scope: initialize Firebase Auth, keep durable browser auth state, and expose
 * Google / email-password / anonymous sign-in plus sign-out and state observation.
 * This module intentionally does not touch game saves or Firestore writes.
 */

import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    GoogleAuthProvider,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    FIREBASE_APP_NAME,
    FIREBASE_CONFIG,
    assertFirebaseConfigReady,
    getFirebaseConfigStatus
} from "./firebase-config.js";

let firebaseApp = null;
let firebaseAuth = null;
let initializePromise = null;

function findExistingApp(){
    return getApps().find((app)=>app && app.name === FIREBASE_APP_NAME) || null;
}

function publicUser(user){
    if(!user){ return null; }
    return Object.freeze({
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        isAnonymous: user.isAnonymous === true,
        providerIds: Object.freeze(
            Array.isArray(user.providerData)
                ? user.providerData.map((entry)=>entry && entry.providerId).filter(Boolean)
                : []
        )
    });
}

export async function initializeFirebaseAuth(){
    if(firebaseApp && firebaseAuth){
        return Object.freeze({ app: firebaseApp, auth: firebaseAuth });
    }
    if(initializePromise){ return initializePromise; }

    initializePromise = (async()=>{
        assertFirebaseConfigReady();
        firebaseApp = findExistingApp() || initializeApp(FIREBASE_CONFIG, FIREBASE_APP_NAME);
        firebaseAuth = getAuth(firebaseApp);
        await setPersistence(firebaseAuth, browserLocalPersistence);
        return Object.freeze({ app: firebaseApp, auth: firebaseAuth });
    })();

    try{
        return await initializePromise;
    }catch(error){
        initializePromise = null;
        throw error;
    }
}

export function getFirebaseAuthConfigStatus(){
    return getFirebaseConfigStatus();
}

export function getFirebaseApp(){
    return firebaseApp;
}

export function getFirebaseAuth(){
    return firebaseAuth;
}

export function getSignedInUser(){
    return publicUser(firebaseAuth && firebaseAuth.currentUser);
}

export async function signInWithGoogle(){
    const { auth } = await initializeFirebaseAuth();
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    return publicUser(credential.user);
}

export async function signInWithEmail(email, password){
    const { auth } = await initializeFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
    return publicUser(credential.user);
}

export async function createAccountWithEmail(email, password){
    const { auth } = await initializeFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
    return publicUser(credential.user);
}

export async function signInAsAnonymous(){
    const { auth } = await initializeFirebaseAuth();
    const credential = await signInAnonymously(auth);
    return publicUser(credential.user);
}

export async function signOutFirebase(){
    const { auth } = await initializeFirebaseAuth();
    await signOut(auth);
}

export async function observeFirebaseAuthState(listener){
    if(typeof listener !== "function"){
        throw new TypeError("observeFirebaseAuthState requires a listener function.");
    }
    const { auth } = await initializeFirebaseAuth();
    return onAuthStateChanged(
        auth,
        (user)=>listener(publicUser(user), null),
        (error)=>listener(null, error)
    );
}
