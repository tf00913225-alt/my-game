"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");

const authUi=read("js/firebase/firebase-auth-ui.js");
const authCss=read("css/firebase-auth.css");
const support=read("js/startup/support-contact.js");
const systemCss=read("css/37-v139-rested-experience.css");
const systemNav=read("tests/v174-system-navigation-ux.test.js");

assert.match(authUi,/Email 帳號/);
assert.match(authUi,/firebaseEmailSignInButton[\s\S]{0,140}Email 登入/);
assert.match(authUi,/firebaseEmailCreateButton[\s\S]{0,140}建立帳號/);
assert.match(authUi,/firebaseGoogleButton[\s\S]{0,120}Google 登入/);
assert.match(authUi,/firebaseGuestButton[\s\S]{0,140}訪客開始遊戲/);
assert.match(authUi,/firebaseMigrationConfirmButton/);
assert.match(authUi,/firebaseRetryButton/);
assert.match(authUi,/firebaseSignOutButton/);
assert.match(authUi,/FourSymbolsSupport\.show\(\)/);

assert.match(authCss,/\.firebase-auth-overlay\{[\s\S]*?overflow-y:auto/);
assert.match(authCss,/\.firebase-auth-dialog\{[\s\S]*?overflow-y:auto/);
assert.match(authCss,/\.firebase-auth-button\{[\s\S]*?min-height:44px/);
assert.match(authCss,/\.firebase-auth-field input\{[\s\S]*?min-height:44px/);

assert.match(support,/const EMAIL="tf00913225@gmail\.com"/);
assert.match(support,/if\(event\.target===overlay\)\{ close\(\); \}/);
assert.match(support,/event\.key==="Escape"/);

assert.match(systemCss,/system-panel-row\{[\s\S]*?min-height:72px/);
assert.match(systemCss,/system-panel-row::before\{[\s\S]*?pointer-events:none/);
assert.match(systemCss,/system-panel button,[\s\S]*?min-height:44px/);
assert.match(systemCss,/system-panel-row:not\(\.danger\)[\s\S]*?home-feature-buy-btn/);
assert.match(systemCss,/system-panel-row\.danger[\s\S]*?#a84d3f/);
assert.match(systemNav,/save\/delete flows keep explicit return navigation/);

console.log("✓ premium functional UI batch 1 preserves auth, support, system navigation, scroll and touch contracts");
