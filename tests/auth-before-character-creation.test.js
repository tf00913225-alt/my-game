"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const contractSource=fs.readFileSync("js/startup/startup-contract.js","utf8");
const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const authUi=fs.readFileSync("js/firebase/firebase-auth-ui.js","utf8");
const auth=fs.readFileSync("js/firebase/firebase-auth.js","utf8");
const firebaseBootstrap=fs.readFileSync("js/firebase/firebase-bootstrap.js","utf8");
const browserQa=fs.readFileSync(".github/scripts/run-boot-architecture-browser-qa.mjs","utf8");
const context=vm.createContext({window:null,Object,String});
context.window=context;
vm.runInContext(contractSource,context);
const contract=context.FourSymbolsStartupContract;
const S=contract.STATES;

for(const state of [S.BOOT_LOADING,S.AUTH_RESOLVING,S.AUTH_REQUIRED,S.SAVE_LOADING,S.MIGRATION_REQUIRED,S.ERROR]){
    assert.equal(contract.canCreateCharacter({state,userUid:"uid",resolvedUid:"uid",activeSaveUid:"uid",saveResolved:true}),false,state);
}
assert.equal(contract.canTransition(S.AUTH_REQUIRED,S.NEED_CHARACTER),false,"auth UI cannot jump directly to creation");
assert.equal(contract.canTransition(S.AUTH_REQUIRED,S.SAVE_LOADING),true);
assert.equal(contract.canTransition(S.SAVE_LOADING,S.NEED_CHARACTER),true);
assert.equal(contract.canCreateCharacter({state:S.NEED_CHARACTER,userUid:"uid-A",resolvedUid:"uid-A",activeSaveUid:"uid-A",saveResolved:true}),true);
assert.equal(contract.canCreateCharacter({state:S.NEED_CHARACTER,userUid:"uid-A",resolvedUid:"uid-B",activeSaveUid:"uid-A",saveResolved:true}),false);
assert.equal(contract.canCreateCharacter({state:S.NEED_CHARACTER,userUid:"uid-A",resolvedUid:"uid-A",activeSaveUid:"uid-A",saveResolved:false}),false);

assert.equal((startup.match(/creation\.style\.display="block"/g)||[]).length,0,"startup must not directly reveal character creation");
assert.match(startup,/function showCharacterCreationSurface\(\)[\s\S]*?saveOwner\.showCreation\(\)/,
    "startup must enter creation through the canonical app-shell lifecycle");
assert.match(startup,/safeCloudEmpty\(cloud,user\.uid\)[\s\S]*?enterCreation\(token\)/);
assert.match(startup,/result&&result\.exists===false&&result\.uid===uid/,
    "a successful same-UID missing-document read is a proven empty account");
assert.doesNotMatch(firebaseBootstrap,/bootstrapTrustedCloudSave/,
    "first-use read resolution must not depend on an optional trusted write deployment");
assert.match(startup,/catch\(error\)\{[\s\S]*?禁止創角/);
assert.doesNotMatch(startup,/async function enterReady[\s\S]{0,160}\+\+transitionToken/,
    "destination hydration must retain the active save-resolution token");
assert.match(startup,/enterReady\(selectedSave,false,token\)\.catch\(error=>fail\(error,"角色載入失敗。",token\)\)/,
    "hydration failure must reach the fail-closed state for the same resolution token");
assert.match(startup,/Promise\.all\(\[requireAppShell\(\),domReady\(\)\]\)/,
    "automatic session restore must not hydrate before the DOM is ready");
assert.match(startup,/await Promise\.all\(\[requireAppShell\(\),domReady\(\)\]\);[\s\S]{0,100}activateGameplaySaveOwner\(\);[\s\S]{0,100}FourSymbolsGameSave\.load\(\)/,
    "the resolved Firebase UID must activate the gameplay save owner after app-shell installation and before hydration");
assert.match(startup,/async function enterCreation\(token=transitionToken\)[\s\S]{0,220}activateGameplaySaveOwner\(\);[\s\S]{0,100}transition\(STATES\.NEED_CHARACTER/,
    "new-character persistence must bind the gameplay save owner before creation is exposed");
assert.match(startup,/async function enterCreation\(token=transitionToken\)[\s\S]{0,420}showCharacterCreationSurface\(\)/,
    "the first visible creation frame must pass through native creation activation");
assert.match(startup,/localBase===cloudFingerprint[\s\S]{0,220}selectedSave=local\.save/,
    "same-UID local progress may resume only while its verified cloud base is unchanged");
assert.doesNotMatch(startup,/JSON\.stringify\(authoritative\)!==JSON\.stringify\(local\.save\)/,
    "normalized same-origin saves must not be treated as conflicts by raw JSON comparison");
assert.match(startup,/action==="cancel-migration"[\s\S]*?firebase\.signOut\(\)/);
assert.match(authUi,/訪客開始遊戲/);
assert.match(authUi,/signInAsAnonymous/);
assert.match(auth,/signInAnonymously/);
assert.match(browserQa,/export async function signInAsAnonymous\(\)/,
    "browser QA auth double must implement the production bridge name");
assert.doesNotMatch(browserQa,/export async function signInAnonymously\(\)/);
assert.doesNotMatch(authUi+startup,/先使用本機存檔|DEV_AUTH_BYPASS|local-only bypass/i);

console.log("✓ auth and save resolution are runtime prerequisites for character creation");
