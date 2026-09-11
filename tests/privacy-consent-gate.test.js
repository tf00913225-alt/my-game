const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=file=>fs.readFileSync(file,"utf8");
const index=read("index.html");
const consent=read("privacy-consent.html");
const declined=read("privacy-declined.html");
const startup=read("js/52-v173.20-startup-loader.js");

assert.match(index,/id="privacyConsentGate"[\s\S]*src="privacy-consent\.html"[\s\S]*aria-hidden="true"[\s\S]*hidden/,
    "privacy consent must be mounted but remain hidden until First Play readiness requires it");
assert.match(consent,/id="policyFrame"[\s\S]*src="privacy\.html"/,
    "consent surface must render the canonical privacy policy instead of duplicating it");
assert.match(consent,/CONSENT_KEY='four_symbols_privacy_consent'/,
    "consent must use a structured versioned same-origin record");
assert.match(consent,/CONSENT_VERSION='2026-09-11-v2'/,
    "privacy policy version must be explicit");
assert.match(consent,/privacyPolicyVersion:CONSENT_VERSION,acceptedAt:new Date\(\)\.toISOString\(\)/,
    "consent record must store policy version and acceptance timestamp");
assert.match(consent,/value\.privacyPolicyVersion===CONSENT_VERSION&&value\.acceptedAt/,
    "a stale privacy policy version must not count as accepted");
assert.doesNotMatch(consent,/let remaining=5|setInterval\(/,
    "privacy acceptance must not use a fake countdown");
assert.match(consent,/win\.scrollY\+win\.innerHeight>=root\.scrollHeight-threshold/,
    "agree must remain locked until the reader reaches near the policy bottom");
assert.match(consent,/if\(!required\|\|!agree\.disabled\)return[\s\S]*agree\.disabled=false/,
    "scroll completion must be the gate that enables agreement");
assert.match(consent,/error\.code='privacy-declined'/,
    "decline must reject the Account-first continuation");
assert.match(consent,/privacy-declined\.html/,
    "decline must have a browser-safe stopped-game fallback");
assert.match(startup,/if\(!privacy\.hasConsent\(\)\)[\s\S]*await privacy\.requireConsent\(\)[\s\S]*startFirebaseLifecycle\(\)/,
    "Firebase Account flow must not start until the current privacy version is accepted");
assert.match(consent,/firebasePrivacyPolicyButton/,
    "signed-out account UI must expose a privacy policy entry");
assert.match(consent,/systemPrivacyPolicyButton/,
    "in-game system UI must expose a privacy policy entry");
assert.match(declined,/遊戲已停止/,
    "decline fallback must not expose the game UI");

console.log("privacy consent gate contracts: OK");
