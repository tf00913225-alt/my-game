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
    signInWithCredential,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    FIREBASE_APP_NAME,
    FIREBASE_CONFIG,
    assertFirebaseConfigReady,
    getFirebaseConfigStatus
} from "./firebase-config.4314d6321ba1.js";

let firebaseApp = null;
let firebaseAuth = null;
let initializePromise = null;
let facebookDiagnosticSdkPromise = null;

/* DEV-only diagnostic owner. Meta App ID is a public client identifier, not a secret.
   This path bypasses Firebase's hosted Facebook OAuth page so we can prove whether
   Meta accepts a bare public_profile login without the downstream email scope. */
const FACEBOOK_DIAGNOSTIC_APP_ID = "1712957419809925";
const FACEBOOK_DIAGNOSTIC_API_VERSION = "v26.0";
const FACEBOOK_DIAGNOSTIC_SDK_ID = "fourSymbolsFacebookDiagnosticSdk";

function findExistingApp(){
    return getApps().find((app)=>app && app.name === FIREBASE_APP_NAME) || null;
}

function isMobileBrowser(){
    try{
        if(typeof navigator === "undefined"){ return false; }
        if(navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean"){
            return navigator.userAgentData.mobile;
        }
        const userAgent=String(navigator.userAgent || "");
        if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)){
            return true;
        }
        return /Macintosh/i.test(userAgent) && Number(navigator.maxTouchPoints || 0) > 1;
    }catch(_){
        return false;
    }
}

function isFacebookDiagnosticHost(){
    try{
        if(typeof location === "undefined"){ return false; }
        const host=String(location.hostname || "").toLowerCase();
        return host === "four-symbols-dev.pages.dev" || host.endsWith(".four-symbols-dev.pages.dev");
    }catch(_){
        return false;
    }
}

function facebookDiagnosticError(code,message,customData={}){
    const error=new Error(message);
    error.code=code;
    error.customData=customData;
    return error;
}

function initFacebookDiagnosticSdk(){
    if(typeof window === "undefined" || typeof document === "undefined"){
        return Promise.reject(facebookDiagnosticError(
            "auth/facebook-diagnostic-sdk-unavailable",
            "Facebook DEV 診斷只能在瀏覽器執行。"
        ));
    }
    const initialize=()=>{
        if(!window.FB || typeof window.FB.init !== "function" || typeof window.FB.login !== "function"){
            throw facebookDiagnosticError(
                "auth/facebook-diagnostic-sdk-unavailable",
                "Meta JavaScript SDK 尚未就緒。"
            );
        }
        window.FB.init({
            appId: FACEBOOK_DIAGNOSTIC_APP_ID,
            cookie: false,
            xfbml: false,
            version: FACEBOOK_DIAGNOSTIC_API_VERSION
        });
        return window.FB;
    };
    if(window.FB && typeof window.FB.login === "function"){
        try{ return Promise.resolve(initialize()); }
        catch(error){ return Promise.reject(error); }
    }
    if(facebookDiagnosticSdkPromise){ return facebookDiagnosticSdkPromise; }

    facebookDiagnosticSdkPromise=new Promise((resolve,reject)=>{
        let settled=false;
        const settle=(fn,value)=>{
            if(settled){ return; }
            settled=true;
            clearTimeout(timeoutId);
            fn(value);
        };
        const ready=()=>{
            try{ settle(resolve,initialize()); }
            catch(error){ settle(reject,error); }
        };
        const previousAsyncInit=window.fbAsyncInit;
        window.fbAsyncInit=()=>{
            if(typeof previousAsyncInit === "function"){
                try{ previousAsyncInit(); }catch(error){ console.warn("Previous fbAsyncInit failed:",error); }
            }
            ready();
        };
        const timeoutId=setTimeout(()=>{
            settle(reject,facebookDiagnosticError(
                "auth/facebook-diagnostic-sdk-timeout",
                "Meta JavaScript SDK 載入逾時。"
            ));
        },15000);

        let script=document.getElementById(FACEBOOK_DIAGNOSTIC_SDK_ID);
        if(!script){
            script=document.createElement("script");
            script.id=FACEBOOK_DIAGNOSTIC_SDK_ID;
            script.async=true;
            script.defer=true;
            script.crossOrigin="anonymous";
            script.src="https://connect.facebook.net/zh_TW/sdk.js";
            script.onerror=()=>settle(reject,facebookDiagnosticError(
                "auth/facebook-diagnostic-sdk-load-failed",
                "Meta JavaScript SDK 載入失敗。"
            ));
            (document.head || document.documentElement).appendChild(script);
        }else{
            script.addEventListener("load",ready,{once:true});
            script.addEventListener("error",()=>settle(reject,facebookDiagnosticError(
                "auth/facebook-diagnostic-sdk-load-failed",
                "Meta JavaScript SDK 載入失敗。"
            )),{once:true});
        }
    }).catch(error=>{
        facebookDiagnosticSdkPromise=null;
        throw error;
    });

    return facebookDiagnosticSdkPromise;
}

async function signInWithFacebookPublicProfileDiagnostic(auth){
    const sdk=await initFacebookDiagnosticSdk();
    console.info("[Facebook DEV diagnostic] manual Meta SDK login; requested scope: public_profile only.");
    const response=await new Promise((resolve,reject)=>{
        let settled=false;
        const finish=(fn,value)=>{
            if(settled){ return; }
            settled=true;
            clearTimeout(timeoutId);
            fn(value);
        };
        const timeoutId=setTimeout(()=>finish(reject,facebookDiagnosticError(
            "auth/facebook-diagnostic-login-timeout",
            "Facebook DEV 診斷登入逾時；Meta 沒有回傳登入結果。"
        )),60000);
        try{
            sdk.login(result=>{
                const accessToken=result && result.authResponse && result.authResponse.accessToken;
                if(accessToken){
                    finish(resolve,result);
                    return;
                }
                finish(reject,facebookDiagnosticError(
                    "auth/facebook-diagnostic-no-token",
                    "Facebook DEV 診斷未取得 access token。",
                    { status: result && result.status || "unknown" }
                ));
            },{
                scope:"public_profile",
                return_scopes:true
            });
        }catch(error){
            finish(reject,facebookDiagnosticError(
                "auth/facebook-diagnostic-login-failed",
                String(error && error.message || "Facebook DEV 診斷登入啟動失敗。")
            ));
        }
    });
    const accessToken=response.authResponse.accessToken;
    const credential=FacebookAuthProvider.credential(accessToken);
    const result=await signInWithCredential(auth,credential);
    return publicUser(result.user);
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
        /* Complete any mobile OAuth redirect before startup observes the identity.
           On ordinary boots this resolves to null and does not change the session. */
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
    const { auth } = await initializeFirebaseAuth();
    if(isFacebookDiagnosticHost()){
        return signInWithFacebookPublicProfileDiagnostic(auth);
    }
    const provider = new FacebookAuthProvider();
    if(isMobileBrowser()){
        await signInWithRedirect(auth, provider);
        return null;
    }
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
