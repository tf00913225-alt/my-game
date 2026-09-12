import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const auth = read("js/firebase/firebase-auth.js");
const functions = read("functions/index.js");
const activity = read("android/facebook-login-poc/app/src/main/java/com/foursymbols/jianghu/authpoc/MainActivity.kt");
const manifest = JSON.parse(read("asset-manifest.json"));

test("web Android Facebook path uses trusted native handoff instead of Web OAuth", () => {
    assert.match(auth, /isAndroidBrowser\(\)/);
    assert.match(auth, /foursymbols/);
    assert.match(auth, /getFunctions\(firebaseApp,"us-central1"\)/);
    assert.match(auth, /httpsCallable\(functions,"redeemNativeAuthHandoff"/);
    assert.match(auth, /signInWithCustomToken\(auth,customToken\)/);
    assert.match(auth, /window\.history\.replaceState/);
    assert.match(auth, /signInWithPopup\(auth, provider\)/);
});

test("native helper creates a short-lived one-time handoff only from Firebase Facebook Auth", () => {
    assert.match(functions, /exports\.createNativeAuthHandoff=onCall/);
    assert.match(functions, /provider!=="facebook\.com"/);
    assert.match(functions, /randomBytes\(32\)\.toString\("base64url"\)/);
    assert.match(functions, /NATIVE_AUTH_HANDOFF_TTL_MS=2\*60\*1000/);
    assert.match(functions, /exports\.redeemNativeAuthHandoff=onCall/);
    assert.match(functions, /transaction\.delete\(reference\)/);
    assert.match(functions, /getAdminAuth\(\)\.createCustomToken\(uid/);
});

test("native helper validates the return origin and never returns the Facebook token to the browser", () => {
    assert.match(activity, /isAllowedReturnUri/);
    assert.match(activity, /ALLOWED_RETURN_HOSTS/);
    assert.match(activity, /fragment\("nativeAuthCode=\$code"\)/);
    assert.doesNotMatch(activity, /fragment\([^)]*accessToken/);
    assert.match(activity, /FacebookAuthProvider\.getCredential\(accessToken\.token\)/);
});

test("production manifest points at the rebuilt native-auth Firebase bundles", () => {
    const bootstrap = manifest?.critical?.firebaseBootstrap;
    assert.match(String(bootstrap || ""), /^build\/firebase\/firebase-bootstrap\.[0-9a-f]{12}\.js$/);
    assert.equal(fs.existsSync(new URL(`../${bootstrap}`, import.meta.url)), true);
    const authAsset = Object.keys(manifest.assets || {}).find(path => /^build\/firebase\/firebase-auth\.[0-9a-f]{12}\.js$/.test(path));
    assert.ok(authAsset, "rebuilt firebase-auth bundle is missing from manifest");
    assert.equal(fs.existsSync(new URL(`../${authAsset}`, import.meta.url)), true);
});
