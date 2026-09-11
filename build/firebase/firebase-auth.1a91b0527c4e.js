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

/* DEV-only diagnostic owner. Meta App ID is a public client identifier, not a secret.
   This path bypasses Firebase's hosted Facebook OAuth page and requests only
   public_profile so we can isolate the observed downstream Invalid Scopes: email. */
const FACEBOOK_DIAGNOSTIC_APP_ID = "1712957419809925";
const FACEBOOK_DIAGNOSTIC_API_VERSION = "v26.0";
const FACEBOOK_DIAGNOSTIC_REDIRECT_URI = "https://dev.four-symbols-dev.pages.dev/";
const FACEBOOK_DIAGNOSTIC_STATE_KEY = "four_symbols_facebook_diagnostic_state";

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
        return typeof location !== "undefined" && String(location.hostname || "").toLowerCase() === "dev.four-symbols-dev.pages.dev";
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

function diagnosticSessionStorage(){
    try{
        if(typeof sessionStorage === "undefined"){ return null; }
        const probe="__four_symbols_fb_diag_probe__";
        sessionStorage.setItem(probe,"1");
        sessionStorage.removeItem(probe);
        return sessionStorage;
    }catch(_){
        return null;
    }
}

function createFacebookDiagnosticState(){
    try{
        if(typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"){
            const bytes=new Uint8Array(24);
            crypto.getRandomValues(bytes);
            return Array.from(bytes,value=>value.toString(16).padStart(2,"0")).join("");
        }
    }catch(_){ }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function clearFacebookDiagnosticHash(){
    try{
        if(typeof history !== "undefined" && typeof history.replaceState === "function" && typeof location !== "undefined"){
            history.replaceState(null,"",`${location.pathname}${location.search}`);
        }
    }catch(_){ }
}

async function consumeFacebookDiagnosticCallback(auth){
    if(!isFacebookDiagnosticHost() || typeof location === "undefined"){ return null; }
    const rawHash=String(location.hash || "").replace(/^#/,"");
    if(!rawHash){ return null; }
    const params=new URLSearchParams(rawHash);
    const accessToken=params.get("access_token");
    const oauthError=params.get("error");
    if(!accessToken && !oauthError){ return null; }

    const storage=diagnosticSessionStorage();
    const expectedState=storage && storage.getItem(FACEBOOK_DIAGNOSTIC_STATE_KEY);
    const returnedState=params.get("state");
    if(storage){ storage.removeItem(FACEBOOK_DIAGNOSTIC_STATE_KEY); }
    clearFacebookDiagnosticHash();

    if(!expectedState || !returnedState || expectedState !== returnedState){
        throw facebookDiagnosticError(
            "auth/facebook-diagnostic-state-mismatch",
            "Facebook DEV 診斷的 OAuth state 驗證失敗，已拒絕這次登入。"
        );
    }
    if(oauthError){
        throw facebookDiagnosticError(
            "auth/facebook-diagnostic-oauth-error",
            params.get("error_description") || `Facebook OAuth error: ${oauthError}`,
            { error:oauthError, reason:params.get("error_reason") || null }
        );
    }
    if(!accessToken){
        throw facebookDiagnosticError(
            "auth/facebook-diagnostic-no-token",
            "Facebook DEV 診斷沒有收到 access token。"
        );
    }

    const credential=FacebookAuthProvider.credential(accessToken);
    const result=await signInWithCredential(auth,credential);
    return publicUser(result.user);
}

function startFacebookPublicProfileDiagnostic(){
    if(typeof location === "undefined"){
        throw facebookDiagnosticError("auth/facebook-diagnostic-unavailable","Facebook DEV 診斷只能在瀏覽器執行。");
    }
    const storage=diagnosticSessionStorage();
    if(!storage){
        throw facebookDiagnosticError(
            "auth/facebook-diagnostic-storage-unavailable",
            "瀏覽器目前無法使用 sessionStorage，不能安全啟動 Facebook DEV 診斷。"
        );
    }
    const state=createFacebookDiagnosticState();
    storage.setItem(FACEBOOK_DIAGNOSTIC_STATE_KEY,state);
    const query=new URLSearchParams({
        client_id:FACEBOOK_DIAGNOSTIC_APP_ID,
        redirect_uri:FACEBOOK_DIAGNOSTIC_REDIRECT_URI,
        response_type:"token",
        scope:"public_profile",
        state
    });
    const oauthUrl=`https://www.facebook.com/${FACEBOOK_DIAGNOSTIC_API_VERSION}/dialog/oauth?${query.toString()}`;
    console.info("[Facebook DEV diagnostic] direct Meta OAuth; requested scope: public_profile only.");
    location.assign(oauthUrl);
    return null;
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
        await consumeFacebookDiagnosticCallback(firebaseAuth);
        /* Complete any normal mobile Firebase OAuth redirect before startup observes the identity.
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
        return startFacebookPublicProfileDiagnostic();
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
