import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const appGradle = read("android/facebook-login-poc/app/build.gradle.kts");
const wrapperProperties = read("android/facebook-login-poc/gradle/wrapper/gradle-wrapper.properties");
const manifest = read("android/facebook-login-poc/app/src/main/AndroidManifest.xml");
const activity = read("android/facebook-login-poc/app/src/main/java/com/foursymbols/jianghu/authpoc/MainActivity.kt");
const strings = read("android/facebook-login-poc/app/src/main/res/values/strings.xml");
const readme = read("android/facebook-login-poc/README.md");
const gitignore = read(".gitignore");
const batch = read("release/requirement-batches/2026-09-12-android-native-facebook-login-poc.json");

test("Android Facebook PoC is a separately scoped native project", () => {
    assert.match(appGradle, /namespace\s*=\s*"com\.foursymbols\.jianghu\.authpoc"/);
    assert.match(appGradle, /applicationId\s*=\s*"com\.foursymbols\.jianghu\.authpoc"/);
    assert.match(appGradle, /com\.facebook\.android:facebook-login:18\.0\.3/);
    assert.match(appGradle, /com\.google\.firebase:firebase-auth/);
    assert.match(appGradle, /com\.google\.gms\.google-services/);
    assert.match(appGradle, /hasGoogleServicesJson/);
    assert.match(wrapperProperties, /gradle-8\.9-bin\.zip/);
    assert.match(wrapperProperties, /distributionSha256Sum=d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab/);
    assert.equal(fs.existsSync(new URL("../android/facebook-login-poc/gradlew", import.meta.url)), true);
    assert.equal(fs.existsSync(new URL("../android/facebook-login-poc/gradle/wrapper/gradle-wrapper.jar", import.meta.url)), true);
    assert.match(manifest, /android:name="\.MainActivity"/);
    assert.match(manifest, /com\.facebook\.FacebookActivity/);
    assert.match(manifest, /com\.facebook\.CustomTabActivity/);
    assert.match(strings, /<string name="facebook_app_id">1712957419809925<\/string>/);
    assert.match(strings, /<string name="fb_login_protocol_scheme">fb1712957419809925<\/string>/);
});

test("native Facebook access token is exchanged only through Firebase Android Auth", () => {
    assert.match(activity, /CallbackManager\.Factory\.create\(\)/);
    assert.match(activity, /LoginManager\.getInstance\(\)\.registerCallback/);
    assert.match(activity, /logInWithReadPermissions\(this, listOf\("public_profile"\)\)/);
    assert.match(activity, /FacebookAuthProvider\.getCredential\(accessToken\.token\)/);
    assert.match(activity, /auth\.signInWithCredential\(credential\)/);
    assert.match(activity, /callbackManager\.onActivityResult/);
    assert.match(activity, /renderSignedInUser\(user\)/);
    assert.match(activity, /uidText\.text = user\.uid/);
});

test("PoC cannot fall back to Web OAuth or mutate game data", () => {
    for (const forbidden of [
        "signInWithPopup",
        "signInWithRedirect",
        "location.assign",
        "FirebaseFirestore",
        "saveGame",
        "loadGame",
        "localStorage"
    ]) {
        assert.equal(activity.includes(forbidden), false, `unexpected PoC behavior: ${forbidden}`);
    }
    assert.doesNotMatch(activity, /import android\.webkit\.WebView|WebView\s*\(/);
    assert.doesNotMatch(activity, /Log\.(?:d|i|w|e)/);
    assert.doesNotMatch(activity, /App Secret|facebook_client_token/i);
});

test("local Firebase configuration and signing material stay outside Git", () => {
    assert.match(gitignore, /android\/facebook-login-poc\/app\/google-services\.json/);
    assert.match(gitignore, /android\/facebook-login-poc\/\*\*\/\*\.jks/);
    assert.match(gitignore, /android\/facebook-login-poc\/\*\*\/\*\.keystore/);
    assert.equal(fs.existsSync(new URL("../android/facebook-login-poc/app/google-services.json", import.meta.url)), false);
});

test("documentation fixes console fields, UID comparison, and the no-auto-session bridge boundary", () => {
    assert.match(readme, /com\.foursymbols\.jianghu\.authpoc/);
    assert.match(readme, /com\.foursymbols\.jianghu\.authpoc\.MainActivity/);
    assert.match(readme, /https:\/\/four-symbols-jianghu\.firebaseapp\.com\/__\/auth\/handler/);
    assert.match(readme, /開啟支援的連結」\*\*開啟\*\*/);
    assert.match(readme, /兩端 UID 必須完全相同/);
    assert.match(readme, /不會自動/);
    assert.match(readme, /Trusted backend one-time handoff/);
    assert.match(readme, /不實作/);
});

test("requirement batch preserves the manual Meta/Firebase and S23 verification boundary", () => {
    assert.match(batch, /"batchId": "2026-09-12-android-native-facebook-login-poc"/);
    assert.match(batch, /"NATIVE-FB-01"/);
    assert.match(batch, /"NATIVE-FB-05"/);
    assert.match(batch, /PENDING_META_FIREBASE_CONSOLE_AND_S23_ULTRA_VERIFICATION/);
    assert.match(batch, /"overallStatus": "IMPLEMENTED"/);
});
