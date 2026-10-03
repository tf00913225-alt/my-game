"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");

const startup=fs.readFileSync("js/52-v173.20-startup-loader.js","utf8");
const repository=fs.readFileSync("js/startup/account-save-repository.js","utf8");

const transition=startup.slice(
    startup.indexOf("function reloadForAccountTransition"),
    startup.indexOf("function onAuth")
);
assert.match(transition,/if\(accountTransitionReloading\)\{ return; \}/,
    "account transition reload must be idempotent");
assert.match(transition,/\+\+transitionToken;/,
    "account transition must invalidate pending save resolution");
assert.ok(
    transition.indexOf("FourSymbolsGameSave.deactivate()")<transition.indexOf("global.location.reload()"),
    "the previous UID owner must be deactivated before page teardown"
);
assert.match(transition,/sessionStorage\.removeItem\("sixiang_startup_session_ready_v1"\)/,
    "account switching must not reuse the previous account's presentation resume marker");
assert.match(transition,/creation\.style\.display="none"/,
    "character creation must be hidden during identity transition");
assert.match(transition,/game\.style\.display="none"/,
    "gameplay must be hidden during identity transition");

const authHandler=startup.slice(
    startup.indexOf("function onAuth"),
    startup.indexOf("let firebaseBootPromise")
);
assert.match(authHandler,/if\(!user\)[\s\S]*?if\(activeUser\)[\s\S]*?reloadForAccountTransition\("signed-out"\)/,
    "sign-out must rebuild the runtime instead of retaining account globals");
assert.match(authHandler,/activeUser&&activeUser\.uid!==user\.uid[\s\S]*?reloadForAccountTransition\("uid-changed"\)/,
    "direct UID replacement must rebuild the runtime");
const uidChangeBranch=authHandler.slice(
    authHandler.indexOf("if(activeUser&&activeUser.uid!==user.uid)"),
    authHandler.indexOf("if(state===STATES.AUTH_RESOLVING")
);
assert.doesNotMatch(uidChangeBranch,/resolveSaveFor\(user\)/,
    "a new UID must not hydrate inside the previous UID's runtime");

assert.match(repository,/if\(!metadata \|\| metadata\.ownerUid!==uid\)/,
    "local fallback must verify metadata ownership");
assert.match(repository,/if\(active!==uid\)\{ throw coded\("account-not-active"/,
    "writes must remain limited to the active UID");
assert.match(startup,/catch\(error\)\{[\s\S]*?if\(local\.status==="ready"\)[\s\S]*?enterReady\(local\.save,true,token\)/,
    "offline readiness must use only the local save read for the authenticated UID");
assert.equal((startup.match(/migrateLegacyToUid\(/g)||[]).length,1,
    "guest or legacy progress must only move through the explicit migration action");

console.log("✓ Phase 3 UID transition reload, local ownership and offline fallback isolation");
