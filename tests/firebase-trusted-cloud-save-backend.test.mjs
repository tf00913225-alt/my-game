import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import test from "node:test";

const require=createRequire(import.meta.url);
const policy=require("../functions/src/cloud-save-policy.js");
const envelope=require("../functions/src/cloud-save-envelope.js");
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

const functionsIndex=read("functions/index.js");
const functionsPackage=JSON.parse(read("functions/package.json"));
const rules=read("firestore.rules");
const client=read("js/firebase/firebase-cloud-save.js");
const deployWorkflow=read(".github/workflows/deploy-dev-cloudflare.yml");

function validSave(){
    return {
        version:6,
        player:{id:"tester",level:20},
        player2:null,
        player3:null,
        sharedExp:1234,
        gold:5678,
        dailyQuestState:{},
        commissionQuestState:{},
        bestiaryData:{},
        achievementState:{},
        lastSaveTimestamp:1788969000000,
        selectedCreationElement:"fire",
        characterEquipment:{},
        characterSkillLoadouts:{},
        allyFormation:{version:1,characterIndexToSlot:{0:"ALLY_F2"}},
        autoConfig:{},
        autoConfig2:{},
        autoConfig3:{},
        playerRelics:{},
        teamLoadout:{},
        gameplayProgress:{},
        abyssProgress:{},
        inventoryItems:[]
    };
}

test("trusted Functions source parses and uses Firebase v2 callable owners",()=>{
    const syntax=spawnSync(process.execPath,["--check","functions/index.js"],{encoding:"utf8"});
    assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
    assert.match(functionsIndex,/firebase-functions\/v2\/https/);
    assert.match(functionsIndex,/exports\.bootstrapCloudSave\s*=\s*onCall/);
    assert.match(functionsIndex,/exports\.submitLegacyMigrationCandidate\s*=\s*onCall/);
    assert.match(functionsIndex,/requireUid\(request\)/);
    assert.match(functionsIndex,/serverUsers/);
    assert.match(functionsIndex,/inspectExistingEnvelope/);
    assert.match(functionsIndex,/const serverRevision=nextRevision\(envelope\)/);
    assert.match(functionsIndex,/serverRevision,/);
});

test("Phase 2 cloud-save envelope has a distinct server-owned schema",()=>{
    assert.equal(envelope.CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,2);
    assert.equal(envelope.createEmptyEnvelope("uid-test",{serverTimestamp:true}).serverRevision,1);
    assert.match(functionsIndex,/transaction\.create\(saveRef,createEmptyEnvelope\(uid,now\)\)/);
    assert.doesNotMatch(functionsIndex,/serverRevision:\s*0/);
});

test("Functions runtime is pinned to the intended supported Node line",()=>{
    assert.equal(functionsPackage.engines.node,"22");
    assert.ok(functionsPackage.dependencies["firebase-admin"]);
    assert.ok(functionsPackage.dependencies["firebase-functions"]);
});

test("legacy migration candidate is validated and fingerprinted without becoming trusted state",()=>{
    const result=policy.validateLegacySaveCandidate(validSave());
    assert.equal(result.gameSaveVersion,6);
    assert.equal(result.snapshot.player.level,20);
    assert.match(result.fingerprint,/^[0-9a-f]{64}$/);
    assert.ok(result.byteLength>0);
    assert.match(functionsIndex,/trustLevel:\s*"client-migration-candidate"/);
    assert.match(functionsIndex,/trusted:\s*false/);
    assert.match(functionsIndex,/reviewStatus:\s*"pending_server_validation"/);
});

test("migration policy rejects unsupported fields and impossible character levels",()=>{
    const extra=validSave();
    extra.freePremiumCurrency=999999;
    assert.throws(()=>policy.validateLegacySaveCandidate(extra),/unsupported top-level field/);

    const badLevel=validSave();
    badLevel.player.level=101;
    assert.throws(()=>policy.validateLegacySaveCandidate(badLevel),/integer from 1 to 100/);
});

test("the live save owner's ally formation survives candidate validation without changing its bytes",()=>{
    const save=validSave();
    const result=policy.validateLegacySaveCandidate(save);
    assert.deepEqual(result.snapshot.allyFormation,save.allyFormation);
    assert.equal(result.byteLength,Buffer.byteLength(JSON.stringify(save),"utf8"));
    const unknown={...save,serverGrantedGold:999};
    assert.throws(()=>policy.validateLegacySaveCandidate(unknown),/unsupported top-level field/);
});

test("migration candidate requires a string character identity without rejecting an unfinished party",()=>{
    assert.equal(policy.validateLegacySaveCandidate(validSave()).snapshot.player2,null);
    const numberId=validSave();
    numberId.player.id=123;
    assert.throws(()=>policy.validateLegacySaveCandidate(numberId),/save\.player\.id is invalid/);
    const blankId=validSave();
    blankId.player.id="   ";
    assert.throws(()=>policy.validateLegacySaveCandidate(blankId),/save\.player\.id is invalid/);
    const gap=validSave();
    gap.player3={id:"third",level:50};
    assert.throws(()=>policy.validateLegacySaveCandidate(gap),/save\.player3 cannot exist/);
});

test("browser Firestore remains read-only and server-private paths stay closed",()=>{
    assert.match(rules,/match \/users\/\{uid\}/);
    assert.match(rules,/allow create, update, delete: if false/);
    assert.match(rules,/allow read, write: if false/);
    assert.doesNotMatch(client,/\bsetDoc\b|\baddDoc\b|\bupdateDoc\b|\bdeleteDoc\b|\bwriteBatch\b|\brunTransaction\b/);
    assert.match(client,/callProtectedFunction/);
    assert.match(read("js/firebase/firebase-session.js"),/httpsCallable/);
    assert.match(client,/CLOUD_SAVE_WRITE_POLICY\s*=\s*"trusted-backend-only"/);
});

test("trusted backend does not wrap the existing local save owner",()=>{
    const combined=[functionsIndex,client].join("\n");
    assert.doesNotMatch(combined,/saveGame\s*=/);
    assert.doesNotMatch(combined,/loadGame\s*=/);
    assert.doesNotMatch(functionsIndex,/localStorage/);
});

test("Phase 4 preferences remain session protected, revision checked, and separate from gameplay",()=>{
    assert.match(functionsIndex,/exports\.saveCloudPreferences\s*=\s*onCall/);
    assert.match(functionsIndex,/sessions\.runProtected\(request,async transaction=>/);
    assert.match(functionsIndex,/envelope\.serverRevision!==expectedRevision/);
    assert.match(functionsIndex,/transaction\.update\(saveRef,\{\s*preferencesVersion:/);
    assert.doesNotMatch(read("js/firebase/firebase-cloud-save.js"),/\bsetDoc\b|\bupdateDoc\b/);
    assert.match(read("js/firebase/firebase-auth-ui.js"),/id="firebaseCloudPreferencesTestButton"/);
    assert.match(read("js/firebase/firebase-auth-ui.js"),/id="firebaseCloudPreferencesRestoreButton"/);
    assert.match(read("js/00-main.js"),/restoreAutoBattlePreferences:\(uid,preferences\)/);
});

test("Cloudflare deploy is isolated from Firebase backend sources",()=>{
    assert.match(deployWorkflow,/--exclude='functions\/'/);
    assert.match(deployWorkflow,/--exclude='\.firebaserc'/);
    assert.match(deployWorkflow,/--exclude='firebase\.json'/);
    assert.match(deployWorkflow,/--exclude='firestore\.rules'/);
    assert.match(deployWorkflow,/working-directory:\s*_deploy/);
    assert.match(deployWorkflow,/pages deploy \. \\/);
    assert.doesNotMatch(deployWorkflow,/pages deploy _deploy/);
});
