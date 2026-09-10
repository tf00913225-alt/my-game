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

assert.equal((startup.match(/creation\.style\.display="block"/g)||[]).length,1,"startup owner has one creation reveal point");
assert.match(startup,/safeCloudEmpty\(cloud,user\.uid\)[\s\S]*?enterCreation\(\)/);
assert.match(startup,/result&&result\.exists===false&&result\.uid===uid/,
    "a successful same-UID missing-document read is a proven empty account");
assert.doesNotMatch(firebaseBootstrap,/bootstrapTrustedCloudSave/,
    "first-use read resolution must not depend on an optional trusted write deployment");
assert.match(startup,/catch\(error\)\{[\s\S]*?禁止創角/);
assert.match(startup,/action==="cancel-migration"[\s\S]*?firebase\.signOut\(\)/);
assert.match(authUi,/訪客開始遊戲/);
assert.match(authUi,/signInAsAnonymous/);
assert.match(auth,/signInAnonymously/);
assert.match(browserQa,/export async function signInAsAnonymous\(\)/,
    "browser QA auth double must implement the production bridge name");
assert.doesNotMatch(browserQa,/export async function signInAnonymously\(\)/);
assert.doesNotMatch(authUi+startup,/先使用本機存檔|DEV_AUTH_BYPASS|local-only bypass/i);

console.log("✓ auth and save resolution are runtime prerequisites for character creation");
