/*
 * Firebase Authentication owner.
 *
 * Scope: initialize Firebase Auth, keep durable browser auth state, and expose
 * Google / Facebook / email-password / anonymous sign-in plus sign-out and state observation.
 * This module intentionally does not touch game saves or Firestore writes.
 */

import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    FacebookAuthProvider,
    GoogleAuthProvider,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    getRedirectResult,
    onAuthStateChanged,
    setPersistence,
    signInAnonymously,
    signInWithCustomToken,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

import {
    FIREBASE_APP_NAME,
    FIREBASE_CONFIG,
    assertFirebaseConfigReady,
    getFirebaseConfigStatus
} from "./firebase-config.js";

const NATIVE_AUTH_SCHEME="foursymbols";
const NATIVE_AUTH_HOST="auth";
const NATIVE_AUTH_PATH="/facebook";
const NATIVE_AUTH_CODE_PARAM="nativeAuthCode";
const NATIVE_AUTH_ERROR_PARAM="nativeAuthError";
const FUNCTIONS_REGION="us-central1";
const NATIVE_HELPER_TIMEOUT_MS=2200;

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

function isAndroidBrowser(){
    return typeof navigator!=="undefined" && /Android/i.test(String(navigator.userAgent||""));
}

function clearNativeAuthFragment(){
    if(typeof window==="undefined" || !window.location || !window.history){ return; }
    const next=window.location.pathname+window.location.search;
    window.history.replaceState(window.history.state,"",next);
}

async function consumeNativeAuthHandoff(auth){
    if(typeof window==="undefined" || !window.location){ return null; }
    const raw=String(window.location.hash||"").replace(/^#/,"");
    if(!raw){ return null; }
    const params=new URLSearchParams(raw);
    const code=String(params.get(NATIVE_AUTH_CODE_PARAM)||"").trim();
    const nativeError=String(params.get(NATIVE_AUTH_ERROR_PARAM)||"").trim();
    if(!code && !nativeError){ return null; }

    clearNativeAuthFragment();

    if(nativeError){
        const error=new Error("Android 原生 Facebook 登入未完成。");
        error.code=nativeError==="cancelled"
            ? "auth/native-facebook-cancelled"
            : "auth/native-handoff-failed";
        throw error;
    }
    if(!/^[A-Za-z0-9_-]{43}$/.test(code)){
        const error=new Error("Android 原生登入回傳碼格式無效。");
        error.code="auth/native-handoff-failed";
        throw error;
    }

    const functions=getFunctions(firebaseApp,FUNCTIONS_REGION);
    const redeem=httpsCallable(functions,"redeemNativeAuthHandoff",{timeout:30000});
    const result=await redeem({code});
    const customToken=String(result&&result.data&&result.data.customToken||"").trim();
    if(!customToken){
        const error=new Error("Android 原生登入回傳缺少 Firebase custom token。");
        error.code="auth/native-handoff-failed";
        throw error;
    }
    const credential=await signInWithCustomToken(auth,customToken);
    return credential.user;
}

function nativeFacebookReturnUrl(){
    const url=new URL(window.location.href);
    url.hash="";
    url.searchParams.delete(NATIVE_AUTH_CODE_PARAM);
    url.searchParams.delete(NATIVE_AUTH_ERROR_PARAM);
    return url.toString();
}

function startNativeFacebookHandoff(){
    return new Promise((resolve,reject)=>{
        let hidden=false;
        const visibilityListener=()=>{
            if(document.visibilityState==="hidden"){ hidden=true; }
        };
        document.addEventListener("visibilitychange",visibilityListener);

        const returnUrl=nativeFacebookReturnUrl();
        const helperUrl=`${NATIVE_AUTH_SCHEME}://${NATIVE_AUTH_HOST}${NATIVE_AUTH_PATH}?return=${encodeURIComponent(returnUrl)}`;
        window.location.assign(helperUrl);

        window.setTimeout(()=>{
            document.removeEventListener("visibilitychange",visibilityListener);
            if(hidden || document.visibilityState==="hidden"){ return; }
            const error=new Error("找不到四象江湖傳 Android 原生登入元件，請先安裝最新版 APK。");
            error.code="auth/native-helper-unavailable";
            reject(error);
        },NATIVE_HELPER_TIMEOUT_MS);
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
        await consumeNativeAuthHandoff(firebaseAuth);
        /* Keep redirect-result consumption only for compatibility with sessions that
           may have started before the Facebook flow was converged back to popup. */
        await getRedirectResult(firebaseAuth);
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

export async function signInWithFacebook(){
    await initializeFirebaseAuth();
    if(isAndroidBrowser()){
        return startNativeFacebookHandoff();
    }

    const auth=firebaseAuth;
    const provider = new FacebookAuthProvider();
    provider.setCustomParameters({ display:"popup" });
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
