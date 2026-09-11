const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=file=>fs.readFileSync(file,"utf8");
const index=read("index.html");
const consent=read("privacy-consent.html");
const declined=read("privacy-declined.html");

assert.match(index,/id="privacyConsentGate"[\s\S]*src="privacy-consent\.html"/,
    "index must mount the privacy consent gate above the game");
assert.match(consent,/id="policyFrame"[\s\S]*src="privacy\.html"/,
    "consent surface must render the canonical privacy policy instead of duplicating it");
assert.match(consent,/four_symbols_privacy_consent_version/,
    "consent must be versioned and remembered on the same origin");
assert.match(consent,/let remaining=5;/,
    "the unlock countdown must start from five seconds");
assert.match(consent,/win\.scrollY\+win\.innerHeight>=root\.scrollHeight-8/,
    "countdown must not begin until the policy reaches the bottom");
assert.match(consent,/agree\.disabled=false/,
    "agree must only be enabled by the countdown completion path");
assert.match(consent,/window\.top\.close\(\)/,
    "decline must attempt to close the game window");
assert.match(consent,/privacy-declined\.html/,
    "decline must have a browser-safe stopped-game fallback");
assert.match(consent,/firebasePrivacyPolicyButton/,
    "signed-out account UI must expose a privacy policy entry");
assert.match(consent,/systemPrivacyPolicyButton/,
    "in-game system UI must expose a privacy policy entry");
assert.match(declined,/遊戲已停止/,
    "decline fallback must not expose the game UI");

console.log("privacy consent gate contracts: OK");
