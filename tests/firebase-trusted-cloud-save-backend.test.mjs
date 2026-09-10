import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import test from "node:test";

const require=createRequire(import.meta.url);
const policy=require("../functions/src/cloud-save-policy.js");
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

test("browser Firestore remains read-only and server-private paths stay closed",()=>{
    assert.match(rules,/match \/users\/\{uid\}/);
    assert.match(rules,/allow create, update, delete: if false/);
    assert.match(rules,/allow read, write: if false/);
    assert.doesNotMatch(client,/\bsetDoc\b|\baddDoc\b|\bupdateDoc\b|\bdeleteDoc\b|\bwriteBatch\b|\brunTransaction\b/);
    assert.match(client,/httpsCallable/);
    assert.match(client,/CLOUD_SAVE_WRITE_POLICY\s*=\s*"trusted-backend-only"/);
});

test("trusted backend does not wrap the existing local save owner",()=>{
    const combined=[functionsIndex,client].join("\n");
    assert.doesNotMatch(combined,/saveGame\s*=/);
    assert.doesNotMatch(combined,/loadGame\s*=/);
    assert.doesNotMatch(functionsIndex,/localStorage/);
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
