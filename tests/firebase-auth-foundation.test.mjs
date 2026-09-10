import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path)=>fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const config = read("js/firebase/firebase-config.js");
const auth = read("js/firebase/firebase-auth.js");
const cloud = read("js/firebase/firebase-cloud-save.js");
const ui = read("js/firebase/firebase-auth-ui.js");
const bootstrap = read("js/firebase/firebase-bootstrap.js");
const startup = read("js/52-v173.20-startup-loader.js");
const support = read("js/startup/support-contact.js");
const productionBuild = read("scripts/build-production.mjs");
const touch = read("js/01-stage-v8-touch-lock.js");
const css = read("css/firebase-auth.css");
const docs = read("docs/FIREBASE_AUTH_CLOUD_SAVE.md");
const batch = read("release/requirement-batches/2026-09-09-firebase-auth-foundation.json");

test("Firebase project identity, complete Web config and pinned SDK owner are explicit", ()=>{
    assert.match(config, /apiKey:\s*"AIzaSyBx3fyM5Xb38shAVLBMFjV-nMyPWIH5jaA"/);
    assert.match(config, /authDomain:\s*"four-symbols-jianghu\.firebaseapp\.com"/);
    assert.match(config, /projectId:\s*"four-symbols-jianghu"/);
    assert.match(config, /storageBucket:\s*"four-symbols-jianghu\.firebasestorage\.app"/);
    assert.match(config, /messagingSenderId:\s*"86885650222"/);
    assert.match(config, /appId:\s*"1:86885650222:web:8ffcbb5c07dc2a691b34bf"/);
    assert.match(config, /measurementId:\s*"G-4PZCMLJC8L"/);
    assert.match(config, /FIREBASE_SDK_VERSION\s*=\s*"12\.18\.0"/);
    assert.match(auth, /firebasejs\/12\.18\.0\/firebase-auth\.js/);
    assert.match(cloud, /firebasejs\/12\.18\.0\/firebase-firestore\.js/);
});

test("cloud-save browser module remains read-only", ()=>{
    for(const forbidden of ["setDoc", "addDoc", "updateDoc", "deleteDoc", "writeBatch", "runTransaction"]){
        assert.equal(cloud.includes(forbidden), false, `unexpected Firestore write API: ${forbidden}`);
    }
    assert.match(cloud, /CLOUD_SAVE_WRITE_POLICY\s*=\s*"trusted-backend-only"/);
    assert.match(cloud, /doc\(db,\s*"users",\s*uid,\s*CURRENT_SAVE_SUBCOLLECTION,\s*CURRENT_SAVE_DOCUMENT\)/);
});

test("Firebase layer does not wrap or mutate the existing local save owner", ()=>{
    const combined = [config, auth, cloud, ui, bootstrap].join("\n");
    const nonMigrationModules = [config, auth, ui, bootstrap].join("\n");
    assert.equal(combined.includes("saveGame="), false);
    assert.equal(combined.includes("saveGame ="), false);
    assert.equal(combined.includes("loadGame="), false);
    assert.equal(combined.includes("localStorage.setItem"), false);
    assert.equal(nonMigrationModules.includes("battle_full_version_save_v5"), false);
    assert.match(cloud, /LEGACY_LOCAL_SAVE_KEY\s*=\s*"battle_full_version_save_v5"/);
    assert.match(cloud, /localStorage\.getItem\(LEGACY_LOCAL_SAVE_KEY\)/);
});

test("bootstrap exposes the narrow Firebase bridge and cloud-read events", ()=>{
    assert.match(bootstrap, /window\.FourSymbolsFirebase\s*=\s*api/);
    assert.match(bootstrap, /four-symbols:firebase-auth-state/);
    assert.match(bootstrap, /four-symbols:firebase-cloud-save-read/);
    assert.match(bootstrap, /openAuth:\s*openFirebaseAuthUi/);
    assert.match(bootstrap, /cloudSaveWritePolicy:\s*CLOUD_SAVE_WRITE_POLICY/);
});

test("authentication UI supports Google, email and Firebase anonymous identity without production bypass", ()=>{
    assert.match(ui, /signInWithGoogle/);
    assert.match(ui, /signInWithEmail/);
    assert.match(ui, /createAccountWithEmail/);
    assert.match(ui, /signInAsAnonymous/);
    assert.match(ui, /signOutFirebase/);
    assert.doesNotMatch(ui, /先使用本機存檔/);
    assert.match(ui, /沒有 UID 時不能建立角色/);
    assert.match(ui, /UID：/);
    assert.match(ui, /id="firebaseSupportButton"/);
    assert.match(ui, /const host=document\.body/);
    assert.doesNotMatch(ui, /const host=document\.getElementById\("game-stage"\)/);
    assert.match(css, /\.firebase-auth-overlay/);
    assert.match(css, /\.firebase-auth-overlay\{[\s\S]*position:fixed;[\s\S]*height:100dvh;[\s\S]*overflow-y:auto/);
    assert.match(css, /z-index:2147483500/);
    assert.match(css, /\.firebase-auth-dialog\{[\s\S]*width:min\(100%,560px\);[\s\S]*max-height:100%;[\s\S]*overflow-y:auto/);
    assert.match(touch, /\.firebase-auth-dialog/);
});

test("one Critical Boot support owner serves login and in-game contact surfaces", ()=>{
    assert.match(support, /const EMAIL="tf00913225@gmail\.com"/);
    assert.match(support, /global\.FourSymbolsSupport=Object\.freeze/);
    assert.match(support, /id="supportContactTitle">聯絡客服/);
    assert.match(support, /href="mailto:/);
    assert.match(css, /\.support-contact-overlay\{[\s\S]*position:fixed/);
    const bootScripts=productionBuild.slice(productionBuild.indexOf("const bootScripts="),productionBuild.indexOf("const appScripts="));
    assert.match(bootScripts,/js\/startup\/support-contact\.js/);
});

test("startup owner makes Firebase identity mandatory without a full-runtime gate", ()=>{
    assert.match(startup, /installStartupStateMachine/);
    assert.match(startup, /AUTH_RESOLVING/);
    assert.match(startup, /SAVE_LOADING/);
    assert.match(startup, /NEED_CHARACTER/);
    assert.doesNotMatch(startup, /DEFAULT_RUNTIME_TOTAL|TOTAL_RUNTIME_MODULES|__v17347RuntimeGate/);
});

test("documentation and Requirement Batch preserve the live-verification boundary", ()=>{
    assert.match(docs, /Authorized domains/);
    assert.match(docs, /does \*\*not\*\* automatically hydrate/);
    assert.match(batch, /"id": "FIREBASE-05"/);
    assert.match(batch, /"visualVerification": "PENDING_DEV_AUTH_AND_CLOUD_READ_VERIFICATION"/);
});
