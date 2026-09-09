/*
 * Firebase Web client configuration owner for Four Symbols Jianghu.
 *
 * Firebase Web config values are public client identifiers, not Admin SDK secrets.
 * Keep privileged credentials and service-account keys out of this repository.
 */

export const FIREBASE_SDK_VERSION = "12.18.0";
export const FIREBASE_APP_NAME = "four-symbols-jianghu-client";

export const FIREBASE_CONFIG = Object.freeze({
    apiKey: "AIzaSyBx3fyM5Xb38shAVLBMFjV-nMyPWIH5jaA",
    authDomain: "four-symbols-jianghu.firebaseapp.com",
    projectId: "four-symbols-jianghu",
    storageBucket: "four-symbols-jianghu.firebasestorage.app",
    messagingSenderId: "86885650222",
    appId: "1:86885650222:web:8ffcbb5c07dc2a691b34bf",
    measurementId: "G-4PZCMLJC8L"
});

const REQUIRED_AUTH_FIELDS = Object.freeze([
    "apiKey",
    "authDomain",
    "projectId",
    "appId"
]);

export function getFirebaseConfigStatus(){
    const missingFields = REQUIRED_AUTH_FIELDS.filter((key)=>{
        const value = FIREBASE_CONFIG[key];
        return typeof value !== "string" || value.trim() === "";
    });

    return Object.freeze({
        ready: missingFields.length === 0,
        missingFields: Object.freeze(missingFields.slice()),
        projectId: FIREBASE_CONFIG.projectId,
        sdkVersion: FIREBASE_SDK_VERSION
    });
}

export function assertFirebaseConfigReady(){
    const status = getFirebaseConfigStatus();
    if(status.ready){ return status; }

    const error = new Error(
        `Firebase Web config is incomplete: ${status.missingFields.join(", ")}`
    );
    error.code = "firebase/config-incomplete";
    error.missingFields = status.missingFields.slice();
    throw error;
}
