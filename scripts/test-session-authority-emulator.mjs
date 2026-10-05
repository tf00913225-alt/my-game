/* Real Auth + Functions + Firestore emulator integration. Never target live data. */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHash,randomBytes} from "node:crypto";
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,Timestamp,FieldValue}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const {HttpsError}=require("firebase-functions/v2/https");
const {createSessionAuthority}=require("../functions/src/session-authority.js");
const {createCanonicalSourceWriter}=require("../functions/src/canonical-source-writer.js");
const {createCanonicalResourceCredit}=require("../functions/src/canonical-resource-credit.js");
const {createDailyCheckinGrant}=require("../functions/src/daily-checkin-grant.js");
const {createCanonicalBattleAttempt}=require("../functions/src/canonical-battle-attempt.js");
const {createCanonicalBattleEncounter}=require("../functions/src/canonical-battle-encounter.js");
const {resolvePlainPlayerNormalAttack}=require("../functions/src/canonical-battle-normal-attack.js");
const {resolveForestOpeningRound}=require("../functions/src/canonical-battle-opening-round.js");
const {createCanonicalBattleAttackProof}=require("../functions/src/canonical-battle-attack-proof.js");
const {createCanonicalRestrictedBattle}=require("../functions/src/canonical-restricted-battle.js");
const {createCanonicalExpAllocation}=require("../functions/src/canonical-exp-allocation.js");
const {createCanonicalAttributeAllocation}=
    require("../functions/src/canonical-attribute-allocation.js");
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
const {assembleCanonicalSnapshot}=require("../functions/src/canonical-snapshot.js");
const {inspectRecoveryArchive,createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
const {createCanonicalCurrentRecovery}=
    require("../functions/src/canonical-current-recovery.js");
const {createCanonicalRecoveryApproval}=
    require("../functions/src/canonical-recovery-approval.js");
const {createCanonicalShopPurchase}=
    require("../functions/src/canonical-shop-purchase.js");
const {inspectExistingEnvelope,nextRevision}=require("../functions/src/cloud-save-envelope.js");
const project="demo-four-symbols-session";
if(process.env.GCLOUD_PROJECT!==project||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||
   process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099"){
    throw new Error("Run only via the dedicated demo session emulators config.");
}
const testApp=initializeApp({projectId:project},"session-authority-test");
const db=getFirestore(testApp);
async function checkRecoveryArchive(uid,revision){
    const root=db.collection("serverUsers").doc(uid);
    const [archive,bundle]=await Promise.all([
        root.collection("recoveryArchives").doc(String(revision)).get(),
        root.collection("playableSnapshots").doc(String(revision)).get()
    ]);
    assert.equal(archive.exists,true);
    assert.equal(archive.get("readyForRestore"),false);
    inspectRecoveryArchive(archive.data(),uid,revision,bundle.data());
    return archive;
}
const direct=process.env.SESSION_TEST_DIRECT_CALLABLE==="1"?require("../functions/index.js"):null;
const authUrl="http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/";
const functionUrl=`http://127.0.0.1:15001/${project}/us-central1/`;
const claims=token=>JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString());
async function login(endpoint,body){
    const response=await fetch(`${authUrl}${endpoint}?key=demo-key`,{method:"POST",signal:AbortSignal.timeout(20000),headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,returnSecureToken:true})});
    const data=await response.json(); assert.equal(response.status,200,JSON.stringify(data.error)); return data;
}
async function invoke(name,token,data){
    const headers={"Content-Type":"application/json"}; if(token){headers.Authorization=`Bearer ${token}`;}
    if(direct){
        // TCP-only local fallback: real exported handler + Admin token validation
        // and real Firestore transactions. CI also tests the HTTP callable layer.
        let decoded=null;try{decoded=claims(token);}catch(_){}
        try{return await direct[name].run({data,auth:decoded?{uid:decoded.user_id,token:decoded}:null,rawRequest:{headers:{authorization:headers.Authorization}}});}
        catch(error){throw Object.assign(new Error(error.message),{code:error.details?.code||(error.code==="unauthenticated"?"UNAUTHENTICATED":error.code)});}
    }
    const response=await fetch(functionUrl+name,{method:"POST",signal:AbortSignal.timeout(20000),headers,body:JSON.stringify({data})});
    const result=await response.json();
    if(result.error){throw Object.assign(new Error(result.error.message),{code:result.error.details?.code||result.error.status});}
    return result.result;
}
const rejected=(name,token,data,code)=>assert.rejects(invoke(name,token,data),error=>error.code===code);
const password="emulator-only-password-2026";
const a=await login("accounts:signUp",{email:"session-x@example.test",password});
const x=a.localId;
const sessionA=await invoke("createGameSession",a.idToken,{uid:x});
assert.equal((await invoke("protectedTest",a.idToken,{uid:x,session:sessionA})).result,"SUCCESS");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).exists,false);
const recordA=(await db.doc(`serverUsers/${x}/sessions/${sessionA.sessionId}`).get()).data();
assert.ok(recordA.createdAt.toMillis()>0); assert.equal(recordA.revokedAt,null);
assert.match(recordA.credentialHash,/^[a-f0-9]{64}$/); assert.equal(recordA.credential,undefined);
await rejected("createGameSession",a.idToken,{uid:"another-uid"},"SESSION_INVALID");
await rejected("protectedTest",null,{uid:x,session:sessionA},"UNAUTHENTICATED");
await rejected("protectedTest","invalid-token",{uid:x,session:sessionA},"UNAUTHENTICATED");
await rejected("protectedTest",a.idToken,{uid:x},"SESSION_INVALID");
await rejected("createGameSession",a.idToken,{uid:x},"SESSION_REAUTH_REQUIRED");
/* auth_time has one-second resolution. Await a NEW explicit login, not refresh. */
while(Math.floor(Date.now()/1000)<=claims(a.idToken).auth_time){await new Promise(resolve=>setTimeout(resolve,100));}
const b=await login("accounts:signInWithPassword",{email:"session-x@example.test",password});
assert.equal(b.localId,x);
const sessionB=await invoke("createGameSession",b.idToken,{uid:x});
async function seedHandoff(authTime){
    // Emulator-only fixture for a previously issued Facebook handoff, without
    // contacting Meta or faking a production Firebase identity provider.
    const code=randomBytes(32).toString("base64url");
    await db.doc(`nativeAuthHandoffs/${createHash("sha256").update(code).digest("hex")}`).set({
        uid:x,provider:"facebook.com",authTime,used:false,
        createdAt:Timestamp.now(),expiresAt:Timestamp.fromMillis(Date.now()+120000)
    });
    return code;
}
await rejected("redeemNativeAuthHandoff",null,{code:await seedHandoff(claims(a.idToken).auth_time)},"SESSION_REAUTH_REQUIRED");
const bridge=await invoke("redeemNativeAuthHandoff",null,{code:await seedHandoff(claims(b.idToken).auth_time)});
const nativeLogin=await login("accounts:signInWithCustomToken",{token:bridge.customToken});
assert.equal(claims(nativeLogin.idToken).user_id,x);
assert.equal(claims(nativeLogin.idToken).sessionSourceAuthTime,claims(b.idToken).auth_time);
await rejected("protectedTest",a.idToken,{uid:x,session:sessionA},"SESSION_REVOKED");
assert.equal((await invoke("protectedTest",b.idToken,{uid:x,session:sessionB})).result,"SUCCESS");
await rejected("revokeGameSession",a.idToken,{uid:x,session:sessionA},"SESSION_REVOKED");
await rejected("createGameSession",a.idToken,{uid:x},"SESSION_REAUTH_REQUIRED");
const replaced=(await db.doc(`serverUsers/${x}/sessions/${sessionA.sessionId}`).get()).data();
assert.equal(replaced.status,"revoked"); assert.ok(replaced.revokedAt.toMillis()>=recordA.createdAt.toMillis());
const candidate={version:6,player:{id:"session-emulator-test",level:1},gold:0,sharedExp:0};
const sidecarNames=["element-box-state","daily-dungeon-state","exp-pool-growth-state",
    "rested-exp-state","progress","announcement-read","quest-milestones",
    "task-tracker","legacy-abyss-state","equipment-shop-daily","bulk-sell-quality",
    "equipment-shop-purchases","abyss-state","patrol-character-index"];
const digest=value=>createHash("sha256").update(value,"utf8").digest("hex");
function sealedBackup(save){
    const sidecars=Object.fromEntries(sidecarNames.map(name=>[name,{status:"missing",raw:null}]));
    const mainRaw=JSON.stringify(save),metadataRaw=JSON.stringify({ownerUid:x});
    const mainFingerprint="v1:1:"+"a".repeat(32),sidecarManifestFingerprint="v1:1:"+"b".repeat(32);
    return {schemaVersion:2,ownerUid:x,
        backupId:`four_symbols_migration_backup:${x}:${mainFingerprint}:${sidecarManifestFingerprint}`,
        mainFingerprint,sidecarManifestFingerprint,mainRaw,metadataRaw,sidecars,
        sidecarManifestSha256:digest(JSON.stringify(sidecars)),
        backupSha256:digest(JSON.stringify({ownerUid:x,mainRaw,metadataRaw,sidecars}))};
}

await rejected("bootstrapCloudSave",a.idToken,{uid:x,session:sessionA},"SESSION_REVOKED");
await rejected("submitLegacyMigrationCandidate",a.idToken,{uid:x,session:sessionA,expectedRevision:1,backup:sealedBackup(candidate)},"SESSION_REVOKED");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).exists,false);
const bootstrap=await invoke("bootstrapCloudSave",b.idToken,{uid:x,session:sessionB});
assert.equal(bootstrap.envelopeSchemaVersion,2); assert.equal(bootstrap.serverRevision,1);
const bootstrappedSave=await db.doc(`users/${x}/saves/current`).get();
assert.equal(bootstrappedSave.get("schemaVersion"),2); assert.equal(bootstrappedSave.get("serverRevision"),1);
const firstEnvelopeUpdate=bootstrappedSave.get("updatedAt").toMillis();
const repeatedBootstrap=await invoke("bootstrapCloudSave",b.idToken,{uid:x,session:sessionB});
assert.equal(repeatedBootstrap.created,false); assert.equal(repeatedBootstrap.serverRevision,1);
const repeatedSave=await db.doc(`users/${x}/saves/current`).get();
assert.equal(repeatedSave.get("serverRevision"),1);
assert.equal(repeatedSave.get("updatedAt").toMillis(),firstEnvelopeUpdate);
const config={enabled:false,skill:"normal",hp:50,sp:25,returnToCityWhenEmpty:false};
const preferences={characterIds:["session-emulator-test",null,null],autoConfig:config,autoConfig2:config,autoConfig3:config};
await rejected("saveCloudPreferences",a.idToken,{uid:x,session:sessionA,expectedRevision:1,preferences},"SESSION_REVOKED");
await rejected("saveCloudPreferences",b.idToken,{uid:x,session:sessionB,expectedRevision:1,preferences:{...preferences,gold:999}},"INVALID_ARGUMENT");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),1);
const prefWrite=await invoke("saveCloudPreferences",b.idToken,{uid:x,session:sessionB,expectedRevision:1,preferences});
assert.equal(prefWrite.serverRevision,2);assert.equal(prefWrite.unchanged,false);
const prefSnapshot=await db.doc(`users/${x}/saves/current`).get();
assert.deepEqual(prefSnapshot.get("preferences"),preferences);
assert.equal(prefSnapshot.get("authoritativeStateReady"),false);
assert.equal(prefSnapshot.get("gameSave"),undefined);
assert.equal((await invoke("saveCloudPreferences",b.idToken,{uid:x,session:sessionB,expectedRevision:2,preferences})).unchanged,true);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),2);
await rejected("saveCloudPreferences",b.idToken,{uid:x,session:sessionB,expectedRevision:1,preferences},"CLOUD_REVISION_CONFLICT");
await rejected("saveCloudPreferences",b.idToken,{uid:x,session:sessionB,expectedRevision:2,preferences:{...preferences,autoConfig:{...config,skill:"x",gold:10}}},"INVALID_ARGUMENT");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),2);
await rejected("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,save:candidate,expectedRevision:2},"INVALID_ARGUMENT");
const firstCandidate=await invoke("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,expectedRevision:2,backup:sealedBackup(candidate)});
assert.equal(firstCandidate.revision,1);assert.equal(firstCandidate.unchanged,false);
const candidateRoot=`serverUsers/${x}/migrationCandidates`;
const original=(await db.doc(`${candidateRoot}/1`).get()).data();
assert.equal(original.backup.mainRaw,JSON.stringify(candidate));
assert.equal(original.backupSha256,sealedBackup(candidate).backupSha256);
assert.equal(original.trusted,false);assert.deepEqual(original.snapshot,candidate);
assert.equal((await db.doc(`${candidateRoot}/latest`).get()).get("fingerprint"),original.fingerprint);
const retry=await invoke("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,expectedRevision:2,backup:sealedBackup(candidate)});
assert.equal(retry.unchanged,true);assert.equal(retry.revision,1);assert.equal(retry.serverRevision,firstCandidate.serverRevision);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),firstCandidate.serverRevision);
await rejected("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,expectedRevision:firstCandidate.serverRevision,backup:sealedBackup({...candidate,gold:1})},"RESOURCE_EXHAUSTED");
assert.equal((await db.doc(`${candidateRoot}/2`).get()).exists,false);
// Emulator-only time shift avoids waiting through the production rate limit.
await db.doc(`${candidateRoot}/latest`).update({submittedAt:Timestamp.fromMillis(1)});
await rejected("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,expectedRevision:1,backup:sealedBackup({...candidate,gold:1})},"CLOUD_REVISION_CONFLICT");
const secondCandidate=await invoke("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,expectedRevision:firstCandidate.serverRevision,backup:sealedBackup({...candidate,gold:1})});
assert.equal(secondCandidate.revision,2);assert.equal(secondCandidate.unchanged,false);
assert.deepEqual((await db.doc(`${candidateRoot}/1`).get()).data().snapshot,candidate);
assert.equal((await db.doc(`${candidateRoot}/2`).get()).get("snapshot.gold"),1);
assert.equal((await db.doc(`${candidateRoot}/2`).get()).get("trusted"),false);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("authoritativeStateReady"),false);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),4);
const screenIntent={uid:x,session:sessionB,candidateRevision:2,expectedRevision:4};
await rejected("screenLegacyMigrationCandidate",a.idToken,{...screenIntent,session:sessionA},"SESSION_REVOKED");
await rejected("screenLegacyMigrationCandidate",b.idToken,{...screenIntent,gold:10},"INVALID_ARGUMENT");
await rejected("screenLegacyMigrationCandidate",b.idToken,{...screenIntent,expectedRevision:3},"CLOUD_REVISION_CONFLICT");
await rejected("screenLegacyMigrationCandidate",b.idToken,{...screenIntent,candidateRevision:1},"FAILED_PRECONDITION");
const screened=await invoke("screenLegacyMigrationCandidate",b.idToken,screenIntent);
assert.equal(screened.readyForAcceptance,false);
assert.equal(screened.status,"blocked");
assert.equal(screened.characterCount,1);
assert.ok(screened.blockers.includes("SIDECAR_BACKUP_MISSING"));
assert.ok(screened.blockers.includes("HISTORICAL_REWARDS_UNVERIFIED"));
assert.equal(screened.serverRevision,4);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("gameSave"),undefined);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),4);
assert.equal((await db.doc(`${candidateRoot}/2`).get()).get("reviewStatus"),"pending_server_validation");
await db.doc(`${candidateRoot}/2`).update({fingerprint:"0".repeat(64)});
await rejected("screenLegacyMigrationCandidate",b.idToken,screenIntent,"DATA_LOSS");
await db.doc(`${candidateRoot}/2`).update({fingerprint:secondCandidate.fingerprint});
const grantId="server_grant_emulator_001",operationId="reserve_operation_001";
const grantRef=db.doc(`serverUsers/${x}/pendingGrants/${grantId}`);
const intent={uid:x,session:sessionB,grantId,operationId,expectedRevision:4};
await rejected("reserveTrustedGrant",a.idToken,{...intent,session:sessionA},"SESSION_REVOKED");
await rejected("reserveTrustedGrant",b.idToken,{...intent,amount:999999},"INVALID_ARGUMENT");
await rejected("reserveTrustedGrant",b.idToken,intent,"FAILED_PRECONDITION");
await grantRef.set({schemaVersion:1,ownerUid:x,kind:"gold",source:"server-event",amount:25,
    status:"pending",claimedByOperationId:null,createdAt:Timestamp.now()});
await rejected("reserveTrustedGrant",b.idToken,{...intent,expectedRevision:3},"CLOUD_REVISION_CONFLICT");
const reserved=await invoke("reserveTrustedGrant",b.idToken,intent);
assert.equal(reserved.serverRevision,5);assert.equal(reserved.creditedToCharacter,false);
assert.equal((await grantRef.get()).get("claimedByOperationId"),operationId);
const grantReceiptRef=db.doc(`serverUsers/${x}/grantOperations/${operationId}`);
assert.equal((await grantReceiptRef.get()).get("amount"),25);
const reservedRetry=await invoke("reserveTrustedGrant",b.idToken,intent);
assert.equal(reservedRetry.unchanged,true);assert.equal(reservedRetry.serverRevision,5);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),5);
await grantReceiptRef.update({amount:250});
await rejected("reserveTrustedGrant",b.idToken,intent,"DATA_LOSS");
await grantReceiptRef.update({amount:25,creditedToCharacter:true});
await rejected("reserveTrustedGrant",b.idToken,intent,"DATA_LOSS");
await grantReceiptRef.update({creditedToCharacter:false});
await grantRef.update({status:"pending"});
await rejected("reserveTrustedGrant",b.idToken,intent,"DATA_LOSS");
await grantRef.update({status:"reserved"});
assert.equal((await invoke("reserveTrustedGrant",b.idToken,intent)).unchanged,true);
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),5);
await rejected("reserveTrustedGrant",b.idToken,{...intent,operationId:"reserve_operation_002",expectedRevision:5},"ALREADY_EXISTS");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("gameSave"),undefined);
await rejected("protectedTest",b.idToken,{uid:x,session:{...sessionB,credential:"z".repeat(43)}},"SESSION_INVALID");
const yUser=await login("accounts:signUp",{email:"session-y@example.test",password});
const y=yUser.localId,sessionY=await invoke("createGameSession",yUser.idToken,{uid:y});
await db.doc(`users/${y}/saves/current`).set({
    schemaVersion:1,ownerUid:y,status:"awaiting_authoritative_migration",
    authoritativeStateReady:false,authoritativeStateVersion:0,serverRevision:0,
    migrationCandidateStatus:"none",createdAt:Timestamp.now(),updatedAt:Timestamp.now()
});
const upgraded=await invoke("bootstrapCloudSave",yUser.idToken,{uid:y,session:sessionY});
assert.equal(upgraded.created,false); assert.equal(upgraded.envelopeSchemaVersion,2); assert.equal(upgraded.serverRevision,1);
const upgradedSave=await db.doc(`users/${y}/saves/current`).get();
assert.equal(upgradedSave.get("schemaVersion"),2); assert.equal(upgradedSave.get("serverRevision"),1);
// Exercise the internal writer in real Firestore transactions and session checks.
const writerSessions=createSessionAuthority({db,FieldValue,HttpsError});
let abortInitialCommit=false;
const initialWriter=createCanonicalSourceWriter({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortInitialCommit){throw new Error("simulated failure before commit");}
        return result;
    })});
const choices={displayName:"英雄",element:"water",gender:"male",
    attributes:{attack:2,vitality:2,energy:2,intelligence:2,defensePoints:1,agility:1}};
// The real callable permits only a newly minted Auth UID and creation choices.
// The browser cannot supply a starting balance, item or operation identity.
const freshUser=await login("accounts:signUp",{
    email:"session-fresh-character@example.test",password});
const freshUid=freshUser.localId;
const freshSession=await invoke("createGameSession",freshUser.idToken,{uid:freshUid});
const freshEnvelope=await invoke("bootstrapCloudSave",freshUser.idToken,
    {uid:freshUid,session:freshSession});
const freshPayload={uid:freshUid,session:freshSession,
    selection:choices,expectedRevision:freshEnvelope.serverRevision};
await assert.rejects(invoke("createInitialCanonicalCharacter",freshUser.idToken,
    {...freshPayload,gold:999}),error=>
    ["invalid-argument","INVALID_ARGUMENT"].includes(error.code));
const freshCreated=await invoke("createInitialCanonicalCharacter",
    freshUser.idToken,freshPayload);
assert.equal(freshCreated.sourceRevision,2);
assert.equal(freshCreated.authoritativeStateReady,false);
assert.equal((await db.doc(`serverUsers/${freshUid}/economy/current`).get())
    .get("gold"),0);
assert.equal((await db.doc(`serverUsers/${freshUid}/playableSnapshots/2`).get())
    .get("readyForPublication"),false);
assert.equal((await invoke("createInitialCanonicalCharacter",freshUser.idToken,
    freshPayload)).unchanged,true);
await assert.rejects(invoke("createInitialCanonicalCharacter",freshUser.idToken,
    {...freshPayload,selection:{...choices,displayName:"另一人"}}),error=>
    ["data-loss","DATA_LOSS"].includes(error.code));
const initialOperation="initial-character-emulator-0001";
const yRequest={auth:{uid:y,token:claims(yUser.idToken)},
    data:{uid:y,session:sessionY}};
const initialArgs={operationId:initialOperation,expectedRevision:1,selection:choices};
await assert.rejects(initialWriter.commitInitialSources(yRequest,
    {...initialArgs,expectedRevision:9}),error=>error.code==="aborted");
assert.equal((await db.doc(`serverUsers/${y}/account/current`).get()).exists,false);
abortInitialCommit=true;
await assert.rejects(initialWriter.commitInitialSources(yRequest,initialArgs),
    /simulated failure before commit/);
abortInitialCommit=false;
assert.equal((await db.doc(`serverUsers/${y}/account/current`).get()).exists,false);
assert.equal((await db.doc(`serverUsers/${y}/operations/${initialOperation}`).get()).exists,false);
assert.equal((await db.doc(`serverUsers/${y}/recoveryArchives/2`).get()).exists,false);
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("serverRevision"),1);
const initialized=await initialWriter.commitInitialSources(yRequest,initialArgs);
assert.equal(initialized.sourceRevision,2);
const initialArchive=await checkRecoveryArchive(y,2);

// Foundation D preparation: internal owner, real session and Firestore transaction.
// No callable, game hook, enemy/result acceptance or reward entitlement.
let battleClock=Date.now(),abortBattle=false;
const battleOwner=createCanonicalBattleAttempt({db,FieldValue,HttpsError,
    inspectExistingEnvelope,now:()=>battleClock,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortBattle)throw new Error("interrupted battle preparation");
        return result;
    })});
const battleArgs={operationId:"battle-preparation-emulator-0001",expectedRevision:2};
const battleRoot=db.collection("serverUsers").doc(y);
const battleBefore={account:(await battleRoot.collection("account").doc("current").get()).data(),
    economy:(await battleRoot.collection("economy").doc("current").get()).data(),
    envelope:(await db.doc(`users/${y}/saves/current`).get()).data()};
for(const path of ["playableSnapshots/2","recoveryArchives/2"]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();
    await assert.rejects(battleOwner.begin(yRequest,battleArgs),e=>e.code==="data-loss");
    assert.equal((await battleRoot.collection("battleAttempts").get()).size,0);
    await ref.set(saved);
}
abortBattle=true;
await assert.rejects(battleOwner.begin(yRequest,battleArgs),/interrupted battle/);
abortBattle=false;
assert.equal((await battleRoot.collection("battleAttempts").get()).size,0);
assert.equal((await battleRoot.collection("battleAttemptSources").get()).size,0);
assert.equal((await battleRoot.collection("operations").doc(battleArgs.operationId).get()).exists,false);
const battleContenders=await Promise.allSettled([
    battleOwner.begin(yRequest,battleArgs),
    battleOwner.begin(yRequest,{...battleArgs,operationId:"battle-preparation-emulator-0002"})
]);
assert.equal(battleContenders.filter(r=>r.status==="fulfilled").length,1);
assert.equal(battleContenders.filter(r=>r.status==="rejected"&&r.reason.code==="already-exists").length,1);
const battleStart=battleContenders.find(r=>r.status==="fulfilled").value;
const winningBattleArgs={...battleArgs,operationId:battleStart.attemptId};
assert.equal(battleStart.rewardEligible,false);assert.equal(battleStart.outcomeVerified,false);
assert.equal(battleStart.creditedToCharacter,false);
assert.equal((await battleOwner.begin(yRequest,winningBattleArgs)).unchanged,true);
battleClock=battleStart.expiresAtMs;
const expiredBattle=await battleOwner.begin(yRequest,winningBattleArgs);
assert.equal(expiredBattle.expired,true);assert.equal(expiredBattle.expiresAtMs,battleStart.expiresAtMs);
for(const path of [`battleAttempts/${battleStart.attemptId}`,
    `operations/${battleStart.attemptId}`,"battleAttemptSources/2",
    "playableSnapshots/2","recoveryArchives/2"]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();await assert.rejects(battleOwner.begin(yRequest,winningBattleArgs));
    await ref.set(saved);
}
const battleRecordRef=battleRoot.collection("battleAttempts").doc(battleStart.attemptId);
const battleSaved=(await battleRecordRef.get()).data();
await battleRecordRef.update({rewardEligible:true});
await assert.rejects(battleOwner.begin(yRequest,winningBattleArgs),e=>e.code==="data-loss");
await battleRecordRef.set(battleSaved);
await assert.rejects(battleOwner.begin({...yRequest,data:{...yRequest.data,won:true}},winningBattleArgs),
    e=>e.code==="invalid-argument");
await assert.rejects(battleOwner.begin({auth:{uid:x,token:claims(a.idToken)},
    data:{uid:x,session:sessionA}},battleArgs),e=>e.message==="SESSION_REVOKED");
await assert.rejects(battleOwner.begin({...yRequest,data:{uid:y,session:sessionB}},winningBattleArgs),
    e=>e.message==="SESSION_INVALID");
assert.equal((await battleRoot.collection("battleAttempts").get()).size,1);
assert.equal((await battleRoot.collection("battleAttemptSources").get()).size,1);
assert.equal((await battleRoot.collection("pendingGrants").get()).size,0);
assert.equal((await battleRoot.collection("ledgerEntries").get()).size,0);
assert.deepEqual((await battleRoot.collection("account").doc("current").get()).data(),battleBefore.account);
assert.deepEqual((await battleRoot.collection("economy").doc("current").get()).data(),battleBefore.economy);
assert.deepEqual((await db.doc(`users/${y}/saves/current`).get()).data(),battleBefore.envelope);
console.log("Battle preparation real transaction: concurrency, rollback, replay, expiry, corruption, session and zero reward PASS");

// Internal Forest enemy stat binding: still no playable encounter/results/grants.
let encounterClock=battleStart.issuedAtMs+1,abortEncounter=false;
const encounterOwner=createCanonicalBattleEncounter({db,FieldValue,HttpsError,
    inspectExistingEnvelope,now:()=>encounterClock,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortEncounter)throw new Error("interrupted encounter seal");
        return result;
    })});
const encounterArgs={attemptId:battleStart.attemptId,operationId:"encounter-seal-emulator-0001",
    expectedRevision:2,encounterKey:"wild.zone-01.fire-01"};
for(const path of ["playableSnapshots/2","recoveryArchives/2",`battleAttempts/${battleStart.attemptId}`]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();await assert.rejects(encounterOwner.seal(yRequest,encounterArgs),e=>e.code==="data-loss");
    assert.equal((await battleRoot.collection("battleEncounters").get()).size,0);
    await ref.set(saved);
}
encounterClock=battleStart.expiresAtMs;
await assert.rejects(encounterOwner.seal(yRequest,encounterArgs),e=>e.code==="failed-precondition");
encounterClock=battleStart.issuedAtMs+1;
abortEncounter=true;
await assert.rejects(encounterOwner.seal(yRequest,encounterArgs),/interrupted encounter seal/);
abortEncounter=false;
for(const path of ["battleEncounters","battleEncounterAttempts","battleEncounterPolicies"]){
    assert.equal((await battleRoot.collection(path).get()).size,0);
}
assert.equal((await battleRoot.collection("operations").doc(encounterArgs.operationId).get()).exists,false);
const encounterContenders=await Promise.allSettled([
    encounterOwner.seal(yRequest,encounterArgs),
    encounterOwner.seal(yRequest,{...encounterArgs,operationId:"encounter-seal-emulator-0002"})
]);
assert.equal(encounterContenders.filter(r=>r.status==="fulfilled").length,1);
assert.equal(encounterContenders.filter(r=>r.status==="rejected"&&r.reason.code==="already-exists").length,1);
const encounterStart=encounterContenders.find(r=>r.status==="fulfilled").value;
const winningEncounterArgs={...encounterArgs,operationId:encounterStart.operationId};
assert.equal(encounterStart.combatRulesReady,false);assert.equal(encounterStart.outcomeVerified,false);
assert.equal(encounterStart.rewardEligible,false);assert.equal(encounterStart.creditedToCharacter,false);
assert.equal(encounterStart.expiresAtMs,battleStart.expiresAtMs);
assert.deepEqual(await encounterOwner.seal(yRequest,winningEncounterArgs),{...encounterStart,unchanged:true});
for(const path of [`battleEncounters/${battleStart.attemptId}`,`operations/${encounterStart.operationId}`,
    `battleEncounterAttempts/${battleStart.attemptId}`,`battleEncounterPolicies/${encounterStart.policySha256}`,
    "playableSnapshots/2","recoveryArchives/2"]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();await assert.rejects(encounterOwner.seal(yRequest,winningEncounterArgs));
    assert.equal((await ref.get()).exists,false);await ref.set(saved);
}
for(const name of ["battleEncounters","battleEncounterAttempts"]){
    const ref=battleRoot.collection(name).doc(battleStart.attemptId),saved=(await ref.get()).data();
    await ref.delete();
    await assert.rejects(encounterOwner.seal(yRequest,{...winningEncounterArgs,operationId:"encounter-seal-emulator-0003"}),e=>e.code==="already-exists");
    assert.equal((await ref.get()).exists,false);await ref.set(saved);
}
const sealedEncounterRef=battleRoot.collection("battleEncounters").doc(battleStart.attemptId);
const savedEncounter=(await sealedEncounterRef.get()).data();
for(const patch of [{rewardEligible:true},{outcomeVerified:true},{expiresAtMs:battleStart.expiresAtMs+1},
    {definitionSha256:"0".repeat(64)},{ownerUid:x}]){
    await sealedEncounterRef.update(patch);
    await assert.rejects(encounterOwner.seal(yRequest,winningEncounterArgs),e=>e.code==="data-loss");
    await sealedEncounterRef.set(savedEncounter);
}
const encounterPolicyRef=battleRoot.collection("battleEncounterPolicies").doc(encounterStart.policySha256);
const savedEncounterPolicy=(await encounterPolicyRef.get()).data();
const tamperedEncounterPolicy=JSON.parse(JSON.stringify(savedEncounterPolicy.policy));
tamperedEncounterPolicy.entries[encounterArgs.encounterKey].stats.attack=999;
await encounterPolicyRef.update({policy:tamperedEncounterPolicy});
await assert.rejects(encounterOwner.seal(yRequest,winningEncounterArgs),e=>e.code==="data-loss");
await encounterPolicyRef.set(savedEncounterPolicy);
await assert.rejects(encounterOwner.seal(yRequest,{...winningEncounterArgs,encounterKey:"wild.zone-01.water-01"}),e=>e.code==="data-loss");
await assert.rejects(encounterOwner.seal({...yRequest,data:{...yRequest.data,won:true}},winningEncounterArgs),e=>e.code==="invalid-argument");
await assert.rejects(encounterOwner.seal({...yRequest,data:{uid:y,session:sessionB}},winningEncounterArgs),e=>e.message==="SESSION_INVALID");
await assert.rejects(encounterOwner.seal({auth:{uid:x,token:claims(a.idToken)},data:{uid:x,session:sessionA}},winningEncounterArgs),e=>e.message==="SESSION_REVOKED");
encounterClock=battleStart.expiresAtMs;
assert.deepEqual(await encounterOwner.seal(yRequest,winningEncounterArgs),{...encounterStart,unchanged:true,expired:true});
for(const path of [`battleEncounters/${battleStart.attemptId}`,`battleEncounterPolicies/${encounterStart.policySha256}`]){
    assert.equal(await rulesRequest(`serverUsers/${y}/${path}`,yUser.idToken),403);
    assert.equal(await rulesRequest(`serverUsers/${y}/${path}`,yUser.idToken,"PATCH"),403);
}
assert.equal((await battleRoot.collection("battleEncounters").get()).size,1);
assert.equal((await battleRoot.collection("battleEncounterAttempts").get()).size,1);
assert.equal((await battleRoot.collection("battleEncounterPolicies").get()).size,1);
assert.equal((await battleRoot.collection("pendingGrants").get()).size,0);
assert.equal((await battleRoot.collection("ledgerEntries").get()).size,0);
assert.deepEqual((await battleRoot.collection("account").doc("current").get()).data(),battleBefore.account);
assert.deepEqual((await battleRoot.collection("economy").doc("current").get()).data(),battleBefore.economy);
assert.deepEqual((await db.doc(`users/${y}/saves/current`).get()).data(),battleBefore.envelope);
console.log("Encounter stat seal real transaction: concurrent one-winner, rollback, replay, expiry, original evidence, private rules, tampering, session and zero reward PASS");

// Pure normal-attack arithmetic on actual private, archived sources. This is
// not an accepted action/turn/result and must not mint a victory entitlement.
const readNormalAttackInputs=(request,tape)=>writerSessions.runProtected(request,async(tx,session)=>{
    const [snapshot,archive,policy]=await Promise.all([
        tx.get(battleRoot.collection("playableSnapshots").doc("2")),
        tx.get(battleRoot.collection("recoveryArchives").doc("2")),tx.get(encounterPolicyRef)]);
    return resolvePlainPlayerNormalAttack({uid:session.uid,revision:2,snapshot:snapshot.data(),
        archive:archive.data(),encounterPolicy:policy.data().policy,
        encounterKey:encounterArgs.encounterKey,randomTape:tape});
});
const normalAttackRuleResult=await readNormalAttackInputs(yRequest,[0.5,0.5,0.5]);
assert.deepEqual(await readNormalAttackInputs(yRequest,[0.5,0.5,0.5]),normalAttackRuleResult);
assert.equal(normalAttackRuleResult.hit,true);assert.ok(normalAttackRuleResult.damage>0);
assert.equal(normalAttackRuleResult.combatRulesReady,false);
assert.equal(normalAttackRuleResult.outcomeVerified,false);
assert.equal(normalAttackRuleResult.rewardEligible,false);
assert.equal(normalAttackRuleResult.creditedToCharacter,false);
const missedNormalAttackRule=await readNormalAttackInputs(yRequest,[0.95]);
assert.equal(missedNormalAttackRule.damage,0);
assert.equal(missedNormalAttackRule.hpBefore,missedNormalAttackRule.hpAfter);
await assert.rejects(readNormalAttackInputs({...yRequest,data:{uid:y,session:sessionB}},[0.5,0.5,0.5]),
    e=>e.message==="SESSION_INVALID");
await assert.rejects(readNormalAttackInputs({auth:{uid:x,token:claims(a.idToken)},
    data:{uid:x,session:sessionA}},[0.5,0.5,0.5]),e=>e.message==="SESSION_REVOKED");
assert.deepEqual((await battleRoot.collection("account").doc("current").get()).data(),battleBefore.account);
assert.deepEqual((await battleRoot.collection("economy").doc("current").get()).data(),battleBefore.economy);
assert.deepEqual((await db.doc(`users/${y}/saves/current`).get()).data(),battleBefore.envelope);
assert.equal((await battleRoot.collection("pendingGrants").get()).size,0);
assert.equal((await battleRoot.collection("ledgerEntries").get()).size,0);
console.log("Normal attack rule arithmetic on private Firestore sources: deterministic hit/MISS, session refusal and zero authoritative mutation PASS");

// Opening-round arithmetic uses real original private sources in the existing
// protected transaction. Explicit server transcript only, no persisted action.
const readOpeningRoundInputs=(request,tape)=>writerSessions.runProtected(request,async(tx,session)=>{
    const [snapshot,archive,policy]=await Promise.all([
        tx.get(battleRoot.collection("playableSnapshots").doc("2")),
        tx.get(battleRoot.collection("recoveryArchives").doc("2")),tx.get(encounterPolicyRef)]);
    return resolveForestOpeningRound({uid:session.uid,revision:2,snapshot:snapshot.data(),
        archive:archive.data(),encounterPolicy:policy.data().policy,
        encounterKey:encounterArgs.encounterKey,randomTape:tape});
});
const openingMissTape=[0.5,0.5,0.95,0.95];
const openingMiss=await readOpeningRoundInputs(yRequest,openingMissTape);
assert.deepEqual(await readOpeningRoundInputs(yRequest,openingMissTape),openingMiss);
assert.equal(openingMiss.actions.length,2);
assert.equal(openingMiss.actions.every(action=>action.hit===false&&action.damage===0),true);
const openingHit=await readOpeningRoundInputs(yRequest,[0.5,0.5,0.95,0.5,0.5]);
assert.equal(openingHit.actions[1].actor,"monster");
assert.equal(openingHit.actions[1].damage,7);assert.equal(openingHit.actions[1].isCrit,false);
assert.equal(openingHit.playerHPAfter,openingHit.playerHPBefore-7);
for(const key of ["combatRulesReady","outcomeVerified","rewardEligible","creditedToCharacter"]){
    assert.equal(openingHit[key],false);
}
await assert.rejects(readOpeningRoundInputs(yRequest,[...openingMissTape,0]),/unused server transcript/);
await assert.rejects(readOpeningRoundInputs({...yRequest,data:{uid:y,session:sessionB}},openingMissTape),
    e=>e.message==="SESSION_INVALID");
assert.deepEqual((await battleRoot.collection("account").doc("current").get()).data(),battleBefore.account);
assert.deepEqual((await battleRoot.collection("economy").doc("current").get()).data(),battleBefore.economy);
assert.deepEqual((await db.doc(`users/${y}/saves/current`).get()).data(),battleBefore.envelope);
assert.equal((await battleRoot.collection("pendingGrants").get()).size,0);
assert.equal((await battleRoot.collection("ledgerEntries").get()).size,0);
console.log("Opening round on private Firestore sources: initiative, final tutorial damage, bounded deterministic transcript, session refusal and zero authority mutation PASS");


// Protected arithmetic proof lifecycle, real Firestore atomicity and unique
// preparation consumption. No accepted action order, terminal verdict or reward.
let attackProofClock=battleStart.issuedAtMs+2,abortAttackProof=false;
const attackProofOwner=createCanonicalBattleAttackProof({db,FieldValue,HttpsError,
    inspectExistingEnvelope,now:()=>attackProofClock,randomBytes:size=>Buffer.alloc(size,128),
    runProtected:(request,fn)=>writerSessions.runProtected(request,async(tx,session)=>{
        const value=await fn(tx,session);
        if(abortAttackProof)throw Error("interrupted attack proof transaction");
        return value;
    })});
const attackProofArgs={attemptId:battleStart.attemptId,operationId:"attack-proof-emulator-0001",expectedRevision:2};
attackProofClock=battleStart.expiresAtMs;
await assert.rejects(attackProofOwner.seal(yRequest,attackProofArgs),e=>e.code==="failed-precondition");
attackProofClock=battleStart.issuedAtMs+2;
abortAttackProof=true;
await assert.rejects(attackProofOwner.seal(yRequest,attackProofArgs),/interrupted attack proof/);
abortAttackProof=false;
for(const name of ["battleAttackProofs","battleAttackAttempts","battleAttackPolicies"]){
    assert.equal((await battleRoot.collection(name).get()).size,0);
}
assert.equal((await battleRoot.collection("operations").doc(attackProofArgs.operationId).get()).exists,false);
const attackProofContenders=await Promise.allSettled([
    attackProofOwner.seal(yRequest,attackProofArgs),
    attackProofOwner.seal(yRequest,{...attackProofArgs,operationId:"attack-proof-emulator-0002"})
]);
assert.equal(attackProofContenders.filter(r=>r.status==="fulfilled").length,1);
assert.equal(attackProofContenders.filter(r=>r.status==="rejected"&&r.reason.code==="already-exists").length,1);
const attackProofStart=attackProofContenders.find(r=>r.status==="fulfilled").value;
const winningAttackArgs={...attackProofArgs,operationId:attackProofStart.operationId};
const attackProofRef=battleRoot.collection("battleAttackProofs").doc(battleStart.attemptId);
const storedAttackProof=(await attackProofRef.get()).data();
assert.deepEqual(storedAttackProof.projection,normalAttackRuleResult.ownerUid===y
    ?await readNormalAttackInputs(yRequest,storedAttackProof.projection.randomTape):null);
assert.equal(storedAttackProof.projection.randomSamplesConsumed,3);
assert.equal(attackProofStart.projection,undefined);assert.equal(attackProofStart.randomTape,undefined);
for(const key of ["combatRulesReady","outcomeVerified","rewardEligible","creditedToCharacter"]){
    assert.equal(attackProofStart[key],false);
}
assert.deepEqual(await attackProofOwner.seal(yRequest,winningAttackArgs),{...attackProofStart,unchanged:true});
const attackPolicyRef=battleRoot.collection("battleAttackPolicies").doc(attackProofStart.rulesPolicySha256);
for(const ref of [attackProofRef,attackPolicyRef,
    battleRoot.collection("operations").doc(winningAttackArgs.operationId),
    battleRoot.collection("battleAttackAttempts").doc(battleStart.attemptId),
    battleRoot.collection("battleEncounters").doc(battleStart.attemptId),
    battleRoot.collection("recoveryArchives").doc("2")]){
    const saved=(await ref.get()).data();await ref.delete();
    await assert.rejects(attackProofOwner.seal(yRequest,winningAttackArgs));
    if([attackProofRef.path,battleRoot.collection("battleAttackAttempts").doc(battleStart.attemptId).path].includes(ref.path)){
        await assert.rejects(attackProofOwner.seal(yRequest,{...winningAttackArgs,operationId:"attack-proof-emulator-0003"}),
            e=>e.code==="already-exists");
    }
    await ref.set(saved);
}
await attackProofRef.update({"projection.damage":storedAttackProof.projection.damage+1});
await assert.rejects(attackProofOwner.seal(yRequest,winningAttackArgs),e=>e.code==="data-loss");
await attackProofRef.set(storedAttackProof);
await assert.rejects(attackProofOwner.seal({...yRequest,data:{...yRequest.data,randomTape:[0,0,0]}},winningAttackArgs),
    e=>e.code==="invalid-argument");
await assert.rejects(attackProofOwner.seal({...yRequest,data:{uid:y,session:sessionB}},winningAttackArgs),
    e=>e.message==="SESSION_INVALID");
attackProofClock=battleStart.expiresAtMs;
assert.deepEqual(await attackProofOwner.seal(yRequest,winningAttackArgs),{...attackProofStart,unchanged:true,expired:true});
for(const ref of [attackProofRef,attackPolicyRef,
    battleRoot.collection("battleAttackAttempts").doc(battleStart.attemptId)]){
    const path=ref.path;
    assert.equal(await rulesRequest(path,yUser.idToken),403);
    assert.equal(await rulesRequest(path,yUser.idToken,"PATCH"),403);
}
for(const name of ["battleAttackProofs","battleAttackAttempts","battleAttackPolicies"]){
    assert.equal((await battleRoot.collection(name).get()).size,1);
}
assert.deepEqual((await battleRoot.collection("account").doc("current").get()).data(),battleBefore.account);
assert.deepEqual((await battleRoot.collection("economy").doc("current").get()).data(),battleBefore.economy);
assert.deepEqual((await db.doc(`users/${y}/saves/current`).get()).data(),battleBefore.envelope);
assert.equal((await battleRoot.collection("pendingGrants").get()).size,0);
assert.equal((await battleRoot.collection("ledgerEntries").get()).size,0);
console.log("Attack proof real transaction: pinned rules/entropy/projection, atomic rollback, concurrent one-winner, replay, expiry, private evidence, session and zero authority mutation PASS");

// Protected restricted instance establishment. No round submission or RNG is
// implemented in this slice; PREPARED is not combat outcome/reward evidence.
let instanceClock=battleStart.issuedAtMs+3,abortInstance=false;
const instanceOwner=createCanonicalRestrictedBattle({db,FieldValue,HttpsError,inspectExistingEnvelope,
    now:()=>instanceClock,
    runProtected:(request,fn)=>writerSessions.runProtected(request,async(tx,session)=>{
        const value=await fn(tx,session);if(abortInstance)throw Error("interrupted instance transaction");
        return value;
    })});
const instanceArgs={attemptId:battleStart.attemptId,operationId:"restricted-instance-emulator-0001",expectedRevision:2};
instanceClock=battleStart.expiresAtMs;
await assert.rejects(instanceOwner.begin(yRequest,instanceArgs),e=>e.code==="failed-precondition");
instanceClock=battleStart.issuedAtMs+3;
const instanceAccountRef=battleRoot.collection("account").doc("current");
const instanceEnvelopeRef=db.doc(`users/${y}/saves/current`);
await instanceAccountRef.update({serverRevision:3});await instanceEnvelopeRef.update({serverRevision:3});
await assert.rejects(instanceOwner.begin(yRequest,instanceArgs),e=>e.code==="aborted");
await instanceAccountRef.set(battleBefore.account);await instanceEnvelopeRef.set(battleBefore.envelope);
abortInstance=true;
await assert.rejects(instanceOwner.begin(yRequest,instanceArgs),/interrupted instance transaction/);
abortInstance=false;
for(const name of ["restrictedBattles","restrictedBattleAttempts","restrictedBattlePolicies"]){
    assert.equal((await battleRoot.collection(name).get()).size,0);
}
assert.equal((await battleRoot.collection("operations").doc(instanceArgs.operationId).get()).exists,false);
const instanceContenders=await Promise.allSettled([
    instanceOwner.begin(yRequest,instanceArgs),
    instanceOwner.begin(yRequest,{...instanceArgs,operationId:"restricted-instance-emulator-0002"})
]);
assert.equal(instanceContenders.filter(r=>r.status==="fulfilled").length,1);
assert.equal(instanceContenders.filter(r=>r.status==="rejected"&&r.reason.code==="already-exists").length,1);
const instanceStart=instanceContenders.find(r=>r.status==="fulfilled").value;
const winningInstanceArgs={...instanceArgs,operationId:instanceStart.operationId};
const instanceRef=battleRoot.collection("restrictedBattles").doc(battleStart.attemptId);
const instancePolicyRef=battleRoot.collection("restrictedBattlePolicies").doc(instanceStart.policySha256);
const instanceMarkerRef=battleRoot.collection("restrictedBattleAttempts").doc(battleStart.attemptId);
const instanceReceiptRef=battleRoot.collection("operations").doc(instanceStart.operationId);
const storedInstance=(await instanceRef.get()).data();
const instanceSource=(await battleRoot.collection("recoveryArchives").doc("2").get()).get("sourceRecords.characters")[0];
const instanceBundle=(await instancePolicyRef.get()).get("bundle");
assert.equal(storedInstance.initialState.player.hp,instanceSource.state.hp);
assert.equal(storedInstance.initialState.player.sp,instanceSource.state.sp);
assert.equal(storedInstance.initialState.enemy.hp,instanceBundle.encounter.entries[encounterArgs.encounterKey].stats.maxHP);
assert.equal(storedInstance.initialState.enemy.sp,instanceBundle.encounter.entries[encounterArgs.encounterKey].stats.maxSP);
assert.equal(storedInstance.initialState.status,"PREPARED");
assert.equal(storedInstance.initialState.round,0);assert.equal(storedInstance.initialState.roundVersion,0);
assert.equal(instanceBundle.restricted.lifecycle.acceptsRoundSubmission,false);
assert.equal(instanceStart.initialState,undefined);assert.equal(instanceStart.randomTape,undefined);
assert.deepEqual(await instanceOwner.begin(yRequest,winningInstanceArgs),{...instanceStart,unchanged:true});
for(const ref of [instanceRef,instancePolicyRef,instanceMarkerRef,instanceReceiptRef,
    battleRoot.collection("battleEncounters").doc(battleStart.attemptId),
    battleRoot.collection("recoveryArchives").doc("2")]){
    const saved=(await ref.get()).data();await ref.delete();
    await assert.rejects(instanceOwner.begin(yRequest,winningInstanceArgs));
    await assert.rejects(instanceOwner.begin(yRequest,{...winningInstanceArgs,operationId:"restricted-instance-emulator-0003"}));
    await ref.set(saved);
}
await instanceRef.update({"initialState.player.hp":storedInstance.initialState.player.hp+1});
await assert.rejects(instanceOwner.begin(yRequest,winningInstanceArgs),e=>e.code==="data-loss");
await instanceRef.set(storedInstance);
await assert.rejects(instanceOwner.begin(yRequest,{...winningInstanceArgs,action:{type:"normal-attack"}}),
    e=>e.code==="invalid-argument");
await assert.rejects(instanceOwner.begin({...yRequest,data:{...yRequest.data,randomTape:[0]}},winningInstanceArgs),
    e=>e.code==="invalid-argument");
await assert.rejects(instanceOwner.begin({...yRequest,data:{uid:y,session:sessionB}},winningInstanceArgs),
    e=>e.message==="SESSION_INVALID");
await assert.rejects(instanceOwner.begin({auth:{uid:x,token:claims(a.idToken)},
    data:{uid:x,session:sessionA}},winningInstanceArgs),e=>e.message==="SESSION_REVOKED");
instanceClock=battleStart.expiresAtMs;
assert.deepEqual(await instanceOwner.begin(yRequest,winningInstanceArgs),{...instanceStart,unchanged:true,expired:true});
for(const ref of [instanceRef,instancePolicyRef,instanceMarkerRef,instanceReceiptRef]){
    assert.equal(await rulesRequest(ref.path,yUser.idToken),403);
    assert.equal(await rulesRequest(ref.path,yUser.idToken,"PATCH"),403);
}
for(const name of ["restrictedBattles","restrictedBattleAttempts","restrictedBattlePolicies"]){
    assert.equal((await battleRoot.collection(name).get()).size,1);
}
assert.deepEqual((await instanceAccountRef.get()).data(),battleBefore.account);
assert.deepEqual((await battleRoot.collection("economy").doc("current").get()).data(),battleBefore.economy);
assert.deepEqual((await instanceEnvelopeRef.get()).data(),battleBefore.envelope);
assert.deepEqual((await attackProofRef.get()).data(),storedAttackProof);
assert.equal((await battleRoot.collection("pendingGrants").get()).size,0);
assert.equal((await battleRoot.collection("ledgerEntries").get()).size,0);
console.log("Restricted instance real transaction: original sources/policy/resources, concurrent one-winner, rollback, replay, corruption, expiry, session refusal, private rules and zero authority mutation PASS");

// Isolated account proves actual device/session takeover and revocation; do
// not invalidate any existing integration fixture used by later assertions.
const lifecycleUser=await login("accounts:signUp",{email:"restricted-lifecycle@example.test",password});
const lifecycleUid=lifecycleUser.localId;
const lifecycleSession=await invoke("createGameSession",lifecycleUser.idToken,{uid:lifecycleUid});
await invoke("bootstrapCloudSave",lifecycleUser.idToken,{uid:lifecycleUid,session:lifecycleSession});
const lifecycleRequest={auth:{uid:lifecycleUid,token:claims(lifecycleUser.idToken)},
    data:{uid:lifecycleUid,session:lifecycleSession}};
await initialWriter.commitInitialSources(lifecycleRequest,{operationId:"restricted-lifecycle-character-0001",
    expectedRevision:1,selection:choices});
const lifecycleDeps={db,FieldValue,HttpsError,inspectExistingEnvelope,runProtected:writerSessions.runProtected};
const lifecycleAttempt=await createCanonicalBattleAttempt(lifecycleDeps).begin(lifecycleRequest,
    {operationId:"restricted-lifecycle-attempt-0001",expectedRevision:2});
await createCanonicalBattleEncounter(lifecycleDeps).seal(lifecycleRequest,
    {attemptId:lifecycleAttempt.attemptId,operationId:"restricted-lifecycle-encounter-0001",
        expectedRevision:2,encounterKey:encounterArgs.encounterKey});
const lifecycleOwner=createCanonicalRestrictedBattle(lifecycleDeps);
const lifecycleArgs={attemptId:lifecycleAttempt.attemptId,operationId:"restricted-lifecycle-instance-0001",expectedRevision:2};
await lifecycleOwner.begin(lifecycleRequest,lifecycleArgs);
const lifecycleRef=db.doc(`serverUsers/${lifecycleUid}/restrictedBattles/${lifecycleAttempt.attemptId}`);
const lifecycleBefore=(await lifecycleRef.get()).data();
await rejected("createGameSession",lifecycleUser.idToken,{uid:lifecycleUid},"SESSION_REAUTH_REQUIRED");
while(Math.floor(Date.now()/1000)<=claims(lifecycleUser.idToken).auth_time){
    await new Promise(resolve=>setTimeout(resolve,100));
}
const takeoverUser=await login("accounts:signInWithPassword",{email:"restricted-lifecycle@example.test",password});
assert.equal(takeoverUser.localId,lifecycleUid);
const takeoverSession=await invoke("createGameSession",takeoverUser.idToken,{uid:lifecycleUid});
await assert.rejects(lifecycleOwner.begin(lifecycleRequest,lifecycleArgs),e=>e.message==="SESSION_REVOKED");
const takeoverRequest={auth:{uid:lifecycleUid,token:claims(takeoverUser.idToken)},
    data:{uid:lifecycleUid,session:takeoverSession}};
await assert.rejects(lifecycleOwner.begin(takeoverRequest,lifecycleArgs),e=>e.code==="failed-precondition");
await writerSessions.revoke(takeoverRequest);
await assert.rejects(lifecycleOwner.begin(takeoverRequest,lifecycleArgs),e=>e.message==="SESSION_REVOKED");
assert.deepEqual((await lifecycleRef.get()).data(),lifecycleBefore);
assert.equal((await db.collection("serverUsers").doc(lifecycleUid).collection("pendingGrants").get()).size,0);
assert.equal((await db.collection("serverUsers").doc(lifecycleUid).collection("ledgerEntries").get()).size,0);
console.log("Restricted instance actual device takeover/revocation: old session blocked, new session cannot inherit, original instance unchanged PASS");



assert.deepEqual(initialArchive.get("sourceRecords.claimRecords"),[]);
assert.equal((await db.doc(`serverUsers/${y}/playableSnapshots/2`).get())
    .get("readyForPublication"),false);
assert.equal((await db.doc(`serverUsers/${y}/characters/character-${initialOperation}`).get())
    .get("state.skillPoints"),2);
assert.equal((await initialWriter.commitInitialSources(yRequest,initialArgs)).unchanged,true);
await assert.rejects(initialWriter.commitInitialSources(yRequest,
    {...initialArgs,selection:{...choices,element:"fire"}}),error=>error.code==="data-loss");
await assert.rejects(initialWriter.commitInitialSources(yRequest,
    {...initialArgs,operationId:"initial-character-emulator-0002",expectedRevision:2}),
    error=>error.code==="failed-precondition");
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("authoritativeStateReady"),false);
// The public endpoint settles a server-clock check-in in ONE Firestore
// transaction: no unclaimed reservation survives a failed commit.
const atomicUser=await login("accounts:signUp",{
    email:"session-atomic-checkin@example.test",password});
const atomicUid=atomicUser.localId;
const atomicSession=await invoke("createGameSession",atomicUser.idToken,{uid:atomicUid});
await invoke("bootstrapCloudSave",atomicUser.idToken,
    {uid:atomicUid,session:atomicSession});
const atomicRequest={auth:{uid:atomicUid,token:claims(atomicUser.idToken)},
    data:{uid:atomicUid,session:atomicSession,expectedRevision:2}};
await initialWriter.commitInitialSources({auth:atomicRequest.auth,
    data:{uid:atomicUid,session:atomicSession}},
    {operationId:"initial-character-atomic-checkin",expectedRevision:1,selection:choices});
let abortAtomic=true;
const rollbackCheckin=createCanonicalResourceCredit({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortAtomic){throw new Error("simulated atomic check-in rollback");}
        return result;
    })});
await assert.rejects(rollbackCheckin.claimDailyCheckin(atomicRequest),
    /simulated atomic check-in rollback/);
assert.equal((await db.collection(`serverUsers/${atomicUid}/pendingGrants`).get()).empty,true);
assert.equal((await db.collection(`serverUsers/${atomicUid}/ledgerEntries`).get()).empty,true);
assert.equal((await db.collection(`serverUsers/${atomicUid}/rewardEvents`).get()).empty,true);
assert.equal((await db.doc(`serverUsers/${atomicUid}/economy/current`).get()).get("gold"),0);
// The first issuance must prove eligibility at the sealed character revision;
// a consistent current account alone cannot substitute for missing sources.
for(const [path,patch] of [
    ["playableSnapshots/2",null],["recoveryArchives/2",null],
    ["playableSnapshots/2",{sha256:"0".repeat(64)}],
    ["recoveryArchives/2",{"sourceRecords.economy.gold":999}]
]){
    const ref=db.doc(`serverUsers/${atomicUid}/${path}`),saved=(await ref.get()).data();
    if(patch===null)await ref.delete();else await ref.update(patch);
    await rejected("claimDailyCheckin",atomicUser.idToken,atomicRequest.data,"DATA_LOSS");
    assert.equal((await db.collection(`serverUsers/${atomicUid}/rewardEvents`).get()).empty,true);
    assert.equal((await db.collection(`serverUsers/${atomicUid}/pendingGrants`).get()).empty,true);
    assert.equal((await db.collection(`serverUsers/${atomicUid}/ledgerEntries`).get()).empty,true);
    assert.equal((await db.doc(`serverUsers/${atomicUid}/economy/current`).get()).get("gold"),0);
    assert.equal((await db.doc(`users/${atomicUid}/saves/current`).get()).get("serverRevision"),2);
    await ref.set(saved);
}
await rejected("claimDailyCheckin",atomicUser.idToken,
    {...atomicRequest.data,expectedRevision:1},"ABORTED");
await rejected("claimDailyCheckin",atomicUser.idToken,
    {...atomicRequest.data,amount:5000},"INVALID_ARGUMENT");
const atomicClaim=await invoke("claimDailyCheckin",atomicUser.idToken,atomicRequest.data);
assert.equal(atomicClaim.creditRevision,3);
assert.equal(atomicClaim.unchanged,false);
assert.equal((await db.doc(`serverUsers/${atomicUid}/economy/current`).get()).get("gold"),50);
assert.equal((await db.doc(`serverUsers/${atomicUid}/claimRecords/${atomicClaim.grantId}`).get())
    .get("status"),"claimed");
assert.equal((await db.doc(`serverUsers/${atomicUid}/playableSnapshots/3`).get())
    .get("readyForPublication"),false);
assert.equal((await db.doc(`users/${atomicUid}/saves/current`).get())
    .get("authoritativeStateReady"),false);
assert.equal((await invoke("claimDailyCheckin",atomicUser.idToken,atomicRequest.data))
    .unchanged,true);
assert.equal((await db.doc(`serverUsers/${atomicUid}/economy/current`).get()).get("gold"),50);
const atomicGrantRef=db.doc(`serverUsers/${atomicUid}/pendingGrants/${atomicClaim.grantId}`);
await atomicGrantRef.update({amount:5000});
await rejected("claimDailyCheckin",atomicUser.idToken,atomicRequest.data,"DATA_LOSS");
await atomicGrantRef.update({amount:50});
assert.equal((await invoke("claimDailyCheckin",atomicUser.idToken,atomicRequest.data))
    .unchanged,true);
// Both public retry paths must inspect immutable credit proof in the real
// transaction. Admin mutations below exist only in this disposable emulator.
const atomicRoot=db.doc(`serverUsers/${atomicUid}`);
const atomicRef=path=>db.doc(`${atomicRoot.path}/${path}`);
const atomicOperation=`${atomicClaim.grantId}-credit`;
const atomicLedger=atomicRoot.collection("ledgerEntries").doc(atomicOperation);
assert.equal((await atomicLedger.get()).get("balanceBefore"),0);
assert.equal((await atomicLedger.get()).get("balanceAfter"),50);
assert.equal((await atomicLedger.get()).get("sourceRevision"),2);
const replayAtomic=()=>invoke("claimDailyCheckin",atomicUser.idToken,atomicRequest.data);
const reserveAtomic=()=>invoke("reserveTrustedGrant",atomicUser.idToken,{
    uid:atomicUid,session:atomicSession,grantId:atomicClaim.grantId,
    operationId:atomicOperation,expectedRevision:2});
for(const [path,patch] of [
    [`rewardEvents/${atomicClaim.grantId}`,{amount:5000}],
    [`rewardEvents/${atomicClaim.grantId}`,{ownerUid:"other-uid"}],
    [`rewardEvents/${atomicClaim.grantId}`,{periodDate:"19000101"}],
    [`pendingGrants/${atomicClaim.grantId}`,{sourceEventSha256:"0".repeat(64)}],
    [`pendingGrants/${atomicClaim.grantId}`,{eventType:"unsupported"}],
    [`grantOperations/${atomicOperation}`,{sourceEventSha256:"0".repeat(64)}],
    [`ledgerEntries/${atomicOperation}`,{sourceEventSha256:"0".repeat(64)}],
    ["playableSnapshots/3",null],["recoveryArchives/3",null],
    ["recoveryArchives/2",null],["playableSnapshots/2",null],
    ["playableSnapshots/2",{sha256:"0".repeat(64)}],
    ["recoveryArchives/2",{"sourceRecords.economy.gold":999}],
    ["playableSnapshots/3",{sha256:"0".repeat(64)}],
    ["recoveryArchives/3",{"sourceRecords.economy.gold":999}],
    [`ledgerEntries/${atomicOperation}`,{balanceAfter:51}],
    [`ledgerEntries/${atomicOperation}`,{balanceBefore:1}],
    [`claimRecords/${atomicClaim.grantId}`,{operationId:"corrupt-operation-0001"}],
    [`operations/${atomicOperation}`,{schemaVersion:1,kind:"collision"}]
]){
    const ref=atomicRef(path),saved=await ref.get();
    if(patch===null)await ref.delete();
    else if(saved.exists)await ref.update(patch);else await ref.set(patch);
    // Compare all authoritative writes relevant to this operation, including
    // the tampered proof; a rejection must not try to repair/reissue it.
    const refs=[db.doc(`users/${atomicUid}/saves/current`),
        atomicRef("economy/current"),atomicLedger,
        atomicRef(`grantOperations/${atomicOperation}`),ref];
    const before=await Promise.all(refs.map(async item=>(await item.get()).data()));
    for(const retry of [replayAtomic,reserveAtomic]){
        await assert.rejects(retry(),error=>error.code==="DATA_LOSS");
    }
    assert.deepEqual(await Promise.all(refs.map(async item=>(await item.get()).data())),before);
    if(saved.exists)await ref.set(saved.data());else await ref.delete();
}
assert.equal((await replayAtomic()).unchanged,true);
assert.equal((await reserveAtomic()).creditedToCharacter,true);
assert.equal((await atomicRoot.collection("ledgerEntries").get()).size,1);
assert.equal((await atomicRoot.collection("uniqueClaims").get()).size,1);
const atomicEvent=atomicRoot.collection("rewardEvents").doc(atomicClaim.grantId);
assert.equal((await atomicEvent.get()).get("sha256"),(await atomicLedger.get()).get("sourceEventSha256"));
console.log("Credited grant evidence: callable corruption/missing-proof/collision retries rejected without writes.");
// The server day and the 50 gold award are owned by the issuer, not the request.
let checkinTime=Date.parse("2026-09-27T15:59:59Z");
let abortCheckin=false;
const checkinIssuer=createDailyCheckinGrant({db,FieldValue,HttpsError,
    inspectExistingEnvelope,now:()=>checkinTime,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortCheckin){throw new Error("simulated check-in rollback");}
        return result;
    })});
const checkinRef=db.doc(`serverUsers/${y}/pendingGrants/daily-checkin-20260927`);
await assert.rejects(checkinIssuer.issue({auth:{uid:x,token:claims(b.idToken)},
    data:{uid:x,session:sessionB}}),error=>error.code==="failed-precondition");
abortCheckin=true;
await assert.rejects(checkinIssuer.issue(yRequest),/simulated check-in rollback/);
abortCheckin=false;
assert.equal((await checkinRef.get()).exists,false);
const checkinEventRef=db.doc(`serverUsers/${y}/rewardEvents/daily-checkin-20260927`);
assert.equal((await checkinEventRef.get()).exists,false);
// Exercise both new and existing issuance against the original source gate.
for(const path of ["playableSnapshots/2","recoveryArchives/2"]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();
    await assert.rejects(checkinIssuer.issue(yRequest),e=>e.code==="data-loss");
    assert.equal((await checkinRef.get()).exists,false);
    assert.equal((await checkinEventRef.get()).exists,false);
    await ref.set(saved);
}
assert.equal((await checkinIssuer.issue(yRequest)).grantId,"daily-checkin-20260927");
assert.equal((await checkinIssuer.issue(yRequest)).unchanged,true);
assert.equal((await checkinRef.get()).get("amount"),50);
assert.equal((await checkinEventRef.get()).get("sha256"),
    (await checkinRef.get()).get("sourceEventSha256"));
const savedCheckinEvent=(await checkinEventRef.get()).data();
await checkinEventRef.delete();
await assert.rejects(checkinIssuer.issue(yRequest),e=>e.code==="failed-precondition");
assert.equal((await checkinEventRef.get()).exists,false);
await checkinEventRef.set(savedCheckinEvent);
for(const path of ["playableSnapshots/2","recoveryArchives/2"]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();
    await assert.rejects(checkinIssuer.issue(yRequest),e=>e.code==="data-loss");
    assert.equal((await checkinRef.get()).get("status"),"pending");
    assert.deepEqual((await checkinEventRef.get()).data(),savedCheckinEvent);
    await ref.set(saved);
}
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("serverRevision"),2);
checkinTime=Date.parse("2026-09-27T16:00:00Z");
assert.equal((await checkinIssuer.issue(yRequest)).grantId,"daily-checkin-20260928");
await checkinRef.update({amount:5000});
checkinTime=Date.parse("2026-09-27T15:59:59Z");
await assert.rejects(checkinIssuer.issue(yRequest),error=>error.code==="data-loss");
await checkinRef.update({amount:50});
const candidateUser=await login("accounts:signUp",{email:"session-candidate@example.test",password});
const candidateUid=candidateUser.localId;
const candidateSession=await invoke("createGameSession",candidateUser.idToken,{uid:candidateUid});
await invoke("bootstrapCloudSave",candidateUser.idToken,
    {uid:candidateUid,session:candidateSession});
await db.doc(`serverUsers/${candidateUid}/migrationCandidates/latest`).set({trusted:false});
await assert.rejects(initialWriter.commitInitialSources({
    auth:{uid:candidateUid,token:claims(candidateUser.idToken)},
    data:{uid:candidateUid,session:candidateSession}},
    {...initialArgs,expectedRevision:1}),error=>error.code==="failed-precondition");
assert.equal((await db.doc(`serverUsers/${candidateUid}/account/current`).get()).exists,false);
const grantIdForCharacter="grant-initial-character-0001";
const goldOperation="credit-initial-character-0001";
await db.doc(`serverUsers/${y}/pendingGrants/${grantIdForCharacter}`).set({
    schemaVersion:1,ownerUid:y,kind:"gold",source:"server-event",amount:25,
    status:"pending",claimedByOperationId:null,createdAt:Timestamp.now()
});
const reservedForCharacter=await invoke("reserveTrustedGrant",yUser.idToken,{
    uid:y,session:sessionY,grantId:grantIdForCharacter,
    operationId:goldOperation,expectedRevision:2});
assert.equal(reservedForCharacter.serverRevision,3);
let abortGoldCommit=false;
const goldWriter=createCanonicalResourceCredit({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortGoldCommit){throw new Error("simulated gold credit rollback");}
        return result;
    })});
const creditArgs={grantId:grantIdForCharacter,operationId:goldOperation,
    expectedRevision:3};
await assert.rejects(goldWriter.creditReservedGrant(yRequest,
    {...creditArgs,expectedRevision:2}),error=>error.code==="aborted");
abortGoldCommit=true;
await assert.rejects(goldWriter.creditReservedGrant(yRequest,creditArgs),
    /simulated gold credit rollback/);
abortGoldCommit=false;
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("gold"),0);
assert.equal((await db.doc(`serverUsers/${y}/ledgerEntries/${goldOperation}`).get()).exists,false);
assert.equal((await db.doc(`serverUsers/${y}/uniqueClaims/${grantIdForCharacter}`).get()).exists,false);
assert.equal((await db.doc(`serverUsers/${y}/claimRecords/${grantIdForCharacter}`).get()).exists,false);
assert.equal((await db.doc(`serverUsers/${y}/recoveryArchives/4`).get()).exists,false);
// Missing source recovery proof blocks the first credit atomically.
const creditSourceArchiveRef=db.doc(`serverUsers/${y}/recoveryArchives/2`);
const creditSourceArchive=(await creditSourceArchiveRef.get()).data();
await creditSourceArchiveRef.delete();
await assert.rejects(goldWriter.creditReservedGrant(yRequest,creditArgs),error=>error.code==="data-loss");
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("gold"),0);
assert.equal((await db.doc(`serverUsers/${y}/ledgerEntries/${goldOperation}`).get()).exists,false);
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("serverRevision"),3);
await creditSourceArchiveRef.set(creditSourceArchive);
const credited=await goldWriter.creditReservedGrant(yRequest,creditArgs);
assert.equal(credited.creditRevision,4);
const creditedArchive=await checkRecoveryArchive(y,4);
assert.equal(creditedArchive.get("sourceRecords.claimRecords")[0].claimKey,
    grantIdForCharacter);
const changedArchive=structuredClone(creditedArchive.data());
changedArchive.sourceRecords.economy.gold=999;
const creditedBundle=(await db.doc(`serverUsers/${y}/playableSnapshots/4`).get()).data();
assert.throws(()=>inspectRecoveryArchive(changedArchive,y,4,creditedBundle));
assert.throws(()=>inspectRecoveryArchive(creditedArchive.data(),y,4,
    {...creditedBundle,sha256:"0".repeat(64)}));
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("gold"),25);
assert.equal((await db.doc(`serverUsers/${y}/claimCheckpoints/current`).get()).get("claimCount"),1);
assert.equal((await db.doc(`serverUsers/${y}/claimRecords/${grantIdForCharacter}`).get())
    .get("status"),"claimed");
assert.equal((await db.doc(`serverUsers/${y}/playableSnapshots/4`).get())
    .get("readyForPublication"),false);
assert.equal((await db.doc(`serverUsers/${y}/ledgerEntries/${goldOperation}`).get())
    .get("balanceAfter"),25);
assert.equal((await goldWriter.creditReservedGrant(yRequest,creditArgs)).unchanged,true);
// A lost creation response remains idempotent after later canonical writes.
const creationReplay=await initialWriter.commitInitialSources(yRequest,initialArgs);
assert.equal(creationReplay.unchanged,true);
assert.equal(creationReplay.sourceRevision,2);
assert.equal((await db.doc(`serverUsers/${y}/account/current`).get()).get("serverRevision"),4);
const originalSnapshotRef=db.doc(`serverUsers/${y}/playableSnapshots/2`);
const originalDigest=(await originalSnapshotRef.get()).get("sha256");
await originalSnapshotRef.update({sha256:"0".repeat(64)});
await assert.rejects(initialWriter.commitInitialSources(yRequest,initialArgs),
    error=>error.code==="data-loss");
await originalSnapshotRef.update({sha256:originalDigest});
assert.equal((await initialWriter.commitInitialSources(yRequest,initialArgs)).unchanged,true);
const reserveReplay=await invoke("reserveTrustedGrant",yUser.idToken,{
    uid:y,session:sessionY,grantId:grantIdForCharacter,
    operationId:goldOperation,expectedRevision:2});
assert.equal(reserveReplay.unchanged,true);
assert.equal(reserveReplay.creditedToCharacter,true);
assert.equal(reserveReplay.creditRevision,4);
// A separately server-issued EXP grant credits the shared pool, not levels.
const expGrantId="grant-initial-exp-pool-0001";
const expOperation="credit-initial-exp-pool-0001";
await db.doc(`serverUsers/${y}/pendingGrants/${expGrantId}`).set({
    schemaVersion:1,ownerUid:y,kind:"exp",source:"server-event",amount:40,
    status:"pending",claimedByOperationId:null,createdAt:Timestamp.now()
});
await assert.rejects(invoke("reserveTrustedGrant",yUser.idToken,{
    uid:y,session:sessionY,grantId:expGrantId,operationId:expOperation,
    expectedRevision:4,amount:400000}),error=>["INVALID_ARGUMENT","invalid-argument"].includes(error.code));
const expReserved=await invoke("reserveTrustedGrant",yUser.idToken,{
    uid:y,session:sessionY,grantId:expGrantId,operationId:expOperation,
    expectedRevision:4});
assert.equal(expReserved.serverRevision,5);
assert.equal((await db.doc(`serverUsers/${y}/grantOperations/${expOperation}`).get())
    .get("kind"),"exp");
const expArgs={grantId:expGrantId,operationId:expOperation,expectedRevision:5};
await assert.rejects(goldWriter.creditReservedGrant(yRequest,
    {...expArgs,expectedRevision:4}),error=>error.code==="aborted");
const expCredit=await goldWriter.creditReservedGrant(yRequest,expArgs);
assert.equal(expCredit.creditRevision,6);
await checkRecoveryArchive(y,6);
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("sharedExp"),40);
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("gold"),25);
assert.equal((await db.doc(`serverUsers/${y}/characters/character-${initialOperation}`).get())
    .get("state.level"),1);
assert.equal((await db.doc(`serverUsers/${y}/ledgerEntries/${expOperation}`).get())
    .get("kind"),"exp");
assert.equal((await db.doc(`serverUsers/${y}/playableSnapshots/6`).get())
    .get("readyForPublication"),false);
assert.equal((await db.doc(`serverUsers/${y}/claimCheckpoints/current`).get()).get("claimCount"),2);
assert.equal((await goldWriter.creditReservedGrant(yRequest,expArgs)).unchanged,true);
assert.equal((await invoke("reserveTrustedGrant",yUser.idToken,{
    uid:y,session:sessionY,grantId:expGrantId,operationId:expOperation,
    expectedRevision:4})).creditRevision,6);
// Allocate exactly one level from the server-owned pool in a real transaction.
const expAllocator=createCanonicalExpAllocation({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,runProtected:writerSessions.runProtected});
const allocationOperation="allocate-exp-initial-character-0001";
const allocationArgs={operationId:allocationOperation,expectedRevision:6};
await assert.rejects(expAllocator.allocateSharedExp(yRequest,allocationArgs),
    error=>error.code==="failed-precondition");
assert.equal((await db.doc(`serverUsers/${y}/operations/${allocationOperation}`).get())
    .exists,false);
assert.equal((await db.doc(`serverUsers/${y}/characters/character-${initialOperation}`)
    .get()).get("state.expNext"),300);
const moreExpGrant="grant-more-initial-exp-0001";
const moreExpOperation="credit-more-initial-exp-0001";
await db.doc(`serverUsers/${y}/pendingGrants/${moreExpGrant}`).set({
    schemaVersion:1,ownerUid:y,kind:"exp",source:"server-event",amount:280,
    status:"pending",claimedByOperationId:null,createdAt:Timestamp.now()
});
await invoke("reserveTrustedGrant",yUser.idToken,{uid:y,session:sessionY,
    grantId:moreExpGrant,operationId:moreExpOperation,expectedRevision:6});
const firstClaimRef=db.doc(`serverUsers/${y}/claimRecords/${grantIdForCharacter}`);
await firstClaimRef.update({status:"blocked"});
await assert.rejects(goldWriter.creditReservedGrant(yRequest,{grantId:moreExpGrant,
    operationId:moreExpOperation,expectedRevision:7}),error=>error.code==="data-loss");
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("sharedExp"),40);
await firstClaimRef.update({status:"claimed"});
await goldWriter.creditReservedGrant(yRequest,{grantId:moreExpGrant,
    operationId:moreExpOperation,expectedRevision:7});
assert.equal((await db.doc(`serverUsers/${y}/claimCheckpoints/current`).get()).get("claimCount"),3);
await assert.rejects(expAllocator.allocateSharedExp(yRequest,allocationArgs),
    error=>error.code==="aborted");
let abortAllocation=false;
const rollbackAllocator=createCanonicalExpAllocation({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortAllocation){throw new Error("simulated allocation rollback");}
        return result;
    })});
const allocArgs={operationId:allocationOperation,expectedRevision:8};
abortAllocation=true;
await assert.rejects(rollbackAllocator.allocateSharedExp(yRequest,allocArgs),
    /simulated allocation rollback/);
abortAllocation=false;
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("sharedExp"),320);
assert.equal((await db.doc(`serverUsers/${y}/operations/${allocationOperation}`).get())
    .exists,false);
assert.equal((await db.doc(`serverUsers/${y}/recoveryArchives/9`).get()).exists,false);
const callableAllocation={...yRequest.data,...allocArgs};
await rejected("allocateCanonicalSharedExp",yUser.idToken,
    {...callableAllocation,cost:0},"INVALID_ARGUMENT");
await rejected("allocateCanonicalSharedExp",yUser.idToken,
    {...callableAllocation,expectedRevision:7},"ABORTED");
await rejected("allocateCanonicalSharedExp",yUser.idToken,
    {...callableAllocation,session:{...sessionY,credential:"z".repeat(43)}},"SESSION_INVALID");
const allocated=await invoke("allocateCanonicalSharedExp",yUser.idToken,callableAllocation);
assert.equal(allocated.allocatedRevision,9);
const leveledArchive=await checkRecoveryArchive(y,9);
assert.equal(leveledArchive.get("sourceRecords.claimRecords").length,3);
assert.equal(allocated.cost,300);
assert.equal(allocated.levelAfter,2);
const leveled=(await db.doc(`serverUsers/${y}/characters/character-${initialOperation}`)
    .get()).get("state");
assert.equal(leveled.exp,0);assert.equal(leveled.expNext,375);
assert.equal(leveled.attributePoints,5);assert.equal(leveled.skillPoints,4);
assert.equal(leveled.bonusHP,30);assert.equal(leveled.bonusSP,10);
assert.equal(leveled.hp,200);assert.equal(leveled.sp,80);
assert.equal((await db.doc(`serverUsers/${y}/economy/current`).get()).get("sharedExp"),20);
assert.equal((await db.doc(`serverUsers/${y}/ledgerEntries/${allocationOperation}`).get())
    .get("amount"),-300);
assert.equal((await db.doc(`serverUsers/${y}/playableSnapshots/9`).get())
    .get("readyForPublication"),false);
assert.equal((await db.doc(`serverUsers/${y}/claimCheckpoints/current`).get()).get("claimCount"),3);
assert.equal((await firstClaimRef.get()).get("serverRevision"),9);
assert.equal((await invoke("allocateCanonicalSharedExp",yUser.idToken,callableAllocation))
    .unchanged,true);

await assert.rejects(expAllocator.allocateSharedExp(yRequest,{
    operationId:goldOperation,expectedRevision:9}),
    error=>error.code==="failed-precondition");
// A reservation cannot strand a server-issued grant by reusing an EXP
// allocation operation ID; the grant remains pending and the version unchanged.
const collisionGrant="grant-collision-after-allocation-0001";
const collisionRef=db.doc(`serverUsers/${y}/pendingGrants/${collisionGrant}`);
await collisionRef.set({schemaVersion:1,ownerUid:y,kind:"gold",
    source:"server-event",amount:10,status:"pending",claimedByOperationId:null,
    createdAt:Timestamp.now()});
await rejected("reserveTrustedGrant",yUser.idToken,{uid:y,session:sessionY,
    grantId:collisionGrant,operationId:allocationOperation,expectedRevision:9},
    "FAILED_PRECONDITION");
assert.equal((await collisionRef.get()).get("status"),"pending");
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("serverRevision"),9);
// A valid max-level canonical source cannot spend EXP into level 101.
const capUser=await login("accounts:signUp",{
    email:"session-exp-cap@example.test",password});
const capUid=capUser.localId;
const capSession=await invoke("createGameSession",capUser.idToken,{uid:capUid});
await invoke("bootstrapCloudSave",capUser.idToken,{uid:capUid,session:capSession});
const capOperation="initial-exp-cap-character-0001";
const capRequest={auth:{uid:capUid,token:claims(capUser.idToken)},
    data:{uid:capUid,session:capSession}};
await initialWriter.commitInitialSources(capRequest,{
    operationId:capOperation,expectedRevision:1,selection:choices});
const capRecords=makeInitialCharacterSources(capUid,2,capOperation,choices);
capRecords.characters[0].state.level=100;
capRecords.characters[0].state.exp=0;
capRecords.characters[0].state.expNext=120;
capRecords.economy.sharedExp=120;
const capBundle=assembleCanonicalSnapshot(capUid,2,capRecords);
const capRoot=db.collection("serverUsers").doc(capUid);
await Promise.all([
    capRoot.collection("characters").doc(capRecords.characters[0].characterId)
        .update({state:capRecords.characters[0].state}),
    capRoot.collection("economy").doc("current").update({sharedExp:120}),
    capRoot.collection("account").doc("current").update({snapshotSha256:capBundle.sha256}),
    capRoot.collection("playableSnapshots").doc("2").set(capBundle)
]);
const capAttempt="allocate-exp-at-level-cap-0001";
await assert.rejects(expAllocator.allocateSharedExp(capRequest,{
    operationId:capAttempt,expectedRevision:2}),
    error=>error.code==="failed-precondition");
assert.equal((await capRoot.collection("operations").doc(capAttempt).get()).exists,false);
assert.equal((await capRoot.collection("economy").doc("current").get()).get("sharedExp"),120);
assert.equal((await db.doc(`users/${capUid}/saves/current`).get()).get("serverRevision"),2);
// The static curve stops before the roster-dependent Lv.20 threshold.
capRecords.characters[0].state.level=19;
capRecords.characters[0].state.expNext=6900;
const boundaryBundle=assembleCanonicalSnapshot(capUid,2,capRecords);
await Promise.all([
    capRoot.collection("characters").doc(capRecords.characters[0].characterId)
        .update({state:capRecords.characters[0].state}),
    capRoot.collection("account").doc("current")
        .update({snapshotSha256:boundaryBundle.sha256}),
    capRoot.collection("playableSnapshots").doc("2").set(boundaryBundle)
]);
await assert.rejects(expAllocator.allocateSharedExp(capRequest,{
    operationId:"allocate-exp-at-curve-boundary-0001",expectedRevision:2}),
    error=>error.code==="failed-precondition");
assert.equal((await capRoot.collection("operations")
    .doc("allocate-exp-at-curve-boundary-0001").get()).exists,false);
assert.equal((await capRoot.collection("economy").doc("current").get()).get("sharedExp"),120);

// A server-owned item, equipment reference and relic survive both resource
// credit and EXP allocation. This is an emulator-only source fixture, not a
// browser item grant or player-facing inventory writer.
const ownedUser=await login("accounts:signUp",{
    email:"session-owned-sources@example.test",password});
const ownedUid=ownedUser.localId;
const ownedSession=await invoke("createGameSession",ownedUser.idToken,{uid:ownedUid});
await invoke("bootstrapCloudSave",ownedUser.idToken,{
    uid:ownedUid,session:ownedSession});
const ownedOperation="initial-owned-sources-0001";
const ownedRequest={auth:{uid:ownedUid,token:claims(ownedUser.idToken)},
    data:{uid:ownedUid,session:ownedSession}};
await initialWriter.commitInitialSources(ownedRequest,{
    operationId:ownedOperation,expectedRevision:1,selection:choices});
const ownedRecords=makeInitialCharacterSources(ownedUid,2,ownedOperation,choices);
const ownedBase={schemaVersion:1,ownerUid:ownedUid,serverRevision:2,
    provenance:"server-created"};
const ownedItemId="server-owned-starter-blade-0001";
const ownedCharacterId=ownedRecords.account.slots[0];
ownedRecords.inventory=[{...ownedBase,ownedItemId,location:"equipped",
    state:{id:"starter-blade",type:"weapon",count:1}}];
ownedRecords.equipment=[{...ownedBase,characterId:ownedCharacterId,
    slot:"hand",ownedItemId}];
ownedRecords.relics=[{...ownedBase,relicId:"starter-relic-0001",
    unlocked:true,level:1,exp:0}];
ownedRecords.economy.sharedExp=320;
const ownedBundle=assembleCanonicalSnapshot(ownedUid,2,ownedRecords);
const ownedRoot=db.collection("serverUsers").doc(ownedUid);
const ownedItemRef=ownedRoot.collection("inventory").doc(ownedItemId);
const ownedEquipRef=ownedRoot.collection("equipment").doc(
    `${ownedCharacterId}_hand`);
const ownedRelicRef=ownedRoot.collection("relics").doc("starter-relic-0001");
await Promise.all([
    ownedItemRef.set(ownedRecords.inventory[0]),
    ownedEquipRef.set(ownedRecords.equipment[0]),
    ownedRelicRef.set(ownedRecords.relics[0]),
    ownedRoot.collection("economy").doc("current").update({sharedExp:320}),
    ownedRoot.collection("account").doc("current")
        .update({snapshotSha256:ownedBundle.sha256}),
    ownedRoot.collection("playableSnapshots").doc("2").set(ownedBundle),
    ownedRoot.collection("recoveryArchives").doc("2")
        .set(createRecoveryArchive(ownedUid,2,ownedRecords,ownedBundle))
]);
const ownedGrant="grant-owned-source-gold-0001";
const ownedCreditOperation="credit-owned-source-gold-0001";
await ownedRoot.collection("pendingGrants").doc(ownedGrant).set({
    schemaVersion:1,ownerUid:ownedUid,kind:"gold",source:"server-event",
    amount:30,status:"pending",claimedByOperationId:null,
    createdAt:Timestamp.now()
});
await invoke("reserveTrustedGrant",ownedUser.idToken,{
    uid:ownedUid,session:ownedSession,grantId:ownedGrant,
    operationId:ownedCreditOperation,expectedRevision:2});
await goldWriter.creditReservedGrant(ownedRequest,{
    grantId:ownedGrant,operationId:ownedCreditOperation,expectedRevision:3});
assert.equal((await ownedItemRef.get()).get("serverRevision"),4);
assert.equal((await ownedEquipRef.get()).get("serverRevision"),4);
assert.equal((await ownedRelicRef.get()).get("serverRevision"),4);
assert.equal((await ownedRoot.collection("claimCheckpoints").doc("current").get())
    .get("claimCount"),1);
const ownedAllocation="allocate-owned-source-exp-0001";
await ownedEquipRef.update({ownedItemId:"missing-owned-item"});
await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:4}),
    error=>error.code==="data-loss");
assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),320);
await ownedEquipRef.update({ownedItemId});
const ownedAllocated=await expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:4});
assert.equal(ownedAllocated.allocatedRevision,5);
assert.equal((await ownedItemRef.get()).get("serverRevision"),5);
assert.equal((await ownedEquipRef.get()).get("ownedItemId"),ownedItemId);
assert.equal((await ownedEquipRef.get()).get("serverRevision"),5);
assert.equal((await ownedRelicRef.get()).get("serverRevision"),5);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),20);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("5").get())
    .get("readyForPublication"),false);
// Spend one server-earned ability point without accepting a browser stat value
// or refilling current HP/SP. Retain equipped ownership in the same revision.
const attributeAllocator=createCanonicalAttributeAllocation({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,runProtected:writerSessions.runProtected});
const attributeOperation="allocate-attribute-vitality-0001";
const attributeArgs={operationId:attributeOperation,expectedRevision:5,stat:"vitality"};
await assert.rejects(attributeAllocator.allocateAttributePoint(ownedRequest,
    {...attributeArgs,stat:"gold"}),error=>error.code==="invalid-argument");
await assert.rejects(attributeAllocator.allocateAttributePoint(ownedRequest,
    {...attributeArgs,expectedRevision:4}),error=>error.code==="aborted");
let abortAttribute=true;
const rollbackAttribute=createCanonicalAttributeAllocation({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortAttribute){throw new Error("simulated attribute rollback");}
        return result;
    })});
await assert.rejects(rollbackAttribute.allocateAttributePoint(ownedRequest,attributeArgs),
    /simulated attribute rollback/);
abortAttribute=false;
assert.equal((await ownedRoot.collection("operations").doc(attributeOperation).get()).exists,false);
assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
const assigned=await attributeAllocator.allocateAttributePoint(ownedRequest,attributeArgs);
assert.equal(assigned.allocatedRevision,6);
const assignedArchive=await checkRecoveryArchive(ownedUid,6);
assert.equal(assignedArchive.get("sourceRecords.inventory")[0].ownedItemId,ownedItemId);
assert.equal(assigned.statAfter,3);
assert.equal(assigned.pointsAfter,4);
const assignedState=(await ownedRoot.collection("characters")
    .doc(ownedCharacterId).get()).get("state");
assert.equal(assignedState.hp,200);
assert.equal(assignedState.sp,80);
assert.equal(assignedState.vitality,3);
assert.equal(assignedState.attributePoints,4);
assert.equal((await ownedItemRef.get()).get("serverRevision"),6);
assert.equal((await ownedEquipRef.get()).get("ownedItemId"),ownedItemId);
assert.equal((await ownedRelicRef.get()).get("serverRevision"),6);
assert.equal((await ownedRoot.collection("claimRecords").doc(ownedGrant).get())
    .get("serverRevision"),6);
assert.equal((await ownedRoot.collection("claimCheckpoints").doc("current").get())
    .get("claimCount"),1);
assert.equal((await ownedRoot.collection("ledgerEntries")
    .doc(attributeOperation).get()).get("amount"),-1);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get())
    .get("readyForPublication"),false);
assert.equal((await attributeAllocator.allocateAttributePoint(ownedRequest,attributeArgs))
    .unchanged,true);
await assert.rejects(attributeAllocator.allocateAttributePoint(ownedRequest,{
    operationId:ownedCreditOperation,expectedRevision:6,stat:"vitality"}),
    error=>error.code==="failed-precondition");
// An operator-approved same-head repair advances the canonical revision while
// retaining unique claims, operation receipts and the immutable original.
const recoveryOperation="recover-current-owned-source-0001";
const recoveryArgs={operationId:recoveryOperation,expectedRevision:6};
const recovery=createCanonicalCurrentRecovery({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,runProtected:writerSessions.runProtected});
await assert.rejects(recovery.restoreCurrent(ownedRequest,recoveryArgs),
    error=>error.code==="permission-denied");
const recoveryPayload={uid:ownedUid,session:ownedSession,...recoveryArgs};
await rejected("restoreCanonicalCurrent",null,recoveryPayload,"UNAUTHENTICATED");
await assert.rejects(invoke("restoreCanonicalCurrent",ownedUser.idToken,
    {...recoveryPayload,gold:999}),error=>
    ["invalid-argument","INVALID_ARGUMENT"].includes(error.code));
await assert.rejects(invoke("restoreCanonicalCurrent",ownedUser.idToken,
    recoveryPayload),error=>
    ["permission-denied","PERMISSION_DENIED"].includes(error.code));
const approvalIssuer=createCanonicalRecoveryApproval({
    db,Timestamp,HttpsError,inspectExistingEnvelope
});
const approvalRef=ownedRoot.collection("recoveryApprovals").doc(recoveryOperation);
const approvalPayload={ownerUid:ownedUid,operationId:recoveryOperation,
    sourceRevision:6,ttlSeconds:120};
await assert.rejects(approvalIssuer.issue({
    auth:{uid:"emulator-non-operator",token:{cloudSaveOperator:false}},
    data:approvalPayload
}),error=>error.code==="permission-denied");
const issuedApproval=await approvalIssuer.issue({
    auth:{uid:"emulator-operator",token:{cloudSaveOperator:true}},
    data:approvalPayload
});
assert.equal(issuedApproval.approved,true);
assert.equal(issuedApproval.unchanged,false);
assert.equal(issuedApproval.approvedBy,"emulator-operator");
assert.equal((await approvalRef.get()).get("status"),"approved");
const replayedApproval=await approvalIssuer.issue({
    auth:{uid:"emulator-operator",token:{cloudSaveOperator:true}},
    data:approvalPayload
});
assert.equal(replayedApproval.unchanged,true);
await approvalRef.update({expiresAt:Timestamp.fromMillis(Date.now()-1000)});
await assert.rejects(recovery.restoreCurrent(ownedRequest,recoveryArgs),
    error=>error.code==="permission-denied");
await assert.rejects(invoke("restoreCanonicalCurrent",ownedUser.idToken,
    recoveryPayload),error=>
    ["permission-denied","PERMISSION_DENIED"].includes(error.code));
await approvalRef.update({expiresAt:Timestamp.fromMillis(Date.now()+120000)});
const oldArchive=assignedArchive.data();
await assignedArchive.ref.update({"sourceRecords.economy.gold":999});
await assert.rejects(recovery.restoreCurrent(ownedRequest,recoveryArgs),
    error=>error.code==="data-loss");
await assignedArchive.ref.set(oldArchive);
const unexpectedClaim=ownedRoot.collection("claimRecords").doc("unexpected-recovery-claim");
await unexpectedClaim.set({schemaVersion:1,ownerUid:ownedUid,serverRevision:6,
    provenance:"server-created",claimKey:"unexpected-recovery-claim",status:"claimed"});
await assert.rejects(recovery.restoreCurrent(ownedRequest,recoveryArgs),
    error=>error.code==="data-loss");
await unexpectedClaim.delete();
const originalGold=(await ownedRoot.collection("economy").doc("current").get()).get("gold");
await ownedRoot.collection("economy").doc("current").update({gold:999});
await ownedItemRef.delete();
let abortRecovery=true;
const rollbackRecovery=createCanonicalCurrentRecovery({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortRecovery){throw new Error("simulated recovery rollback");}
        return result;
    })});
await assert.rejects(rollbackRecovery.restoreCurrent(ownedRequest,recoveryArgs),
    /simulated recovery rollback/);
abortRecovery=false;
assert.equal((await ownedRoot.collection("recoveryArchives").doc("7").get()).exists,false);
assert.equal((await ownedRoot.collection("operations").doc(recoveryOperation).get()).exists,false);
assert.equal((await approvalRef.get()).get("status"),"approved");
const recovered=await invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload);
assert.equal(recovered.restoredRevision,7);
assert.equal((await ownedItemRef.get()).get("serverRevision"),7);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("gold"),originalGold);
assert.equal((await ownedRoot.collection("claimRecords").doc(ownedGrant).get())
    .get("serverRevision"),7);
assert.equal((await ownedRoot.collection("recoveryAudits").doc(recoveryOperation).get())
    .get("sourceRevision"),6);
assert.equal((await approvalRef.get()).get("status"),"used");
await checkRecoveryArchive(ownedUid,7);
assert.equal((await recovery.restoreCurrent(ownedRequest,recoveryArgs)).unchanged,true);
assert.equal((await invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload))
    .unchanged,true);
assert.equal((await goldWriter.creditReservedGrant(ownedRequest,{
    grantId:ownedGrant,operationId:ownedCreditOperation,expectedRevision:3}))
    .unchanged,true);
assert.equal((await attributeAllocator.allocateAttributePoint(ownedRequest,attributeArgs))
    .unchanged,true);
await assert.rejects(recovery.restoreCurrent(ownedRequest,{
    operationId:"recover-current-owned-source-0002",expectedRevision:6}),
    error=>error.code==="aborted");
// A server-priced purchase spends credited gold and creates one owned bag
// stack at the same canonical revision. Neither a browser price nor a balance
// is accepted; receipt replay cannot buy the item a second time.
const shop=createCanonicalShopPurchase({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,runProtected:writerSessions.runProtected});
const shopArgs={operationId:"shop-potion-owned-source-0001",expectedRevision:7,
    itemId:"hpPotion10",quantity:1};
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,itemId:"hpPotion50"}),
    error=>error.code==="invalid-argument");
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,quantity:1000}),
    error=>error.code==="invalid-argument");
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,quantity:2}),
    error=>error.code==="failed-precondition");
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,expectedRevision:6}),
    error=>error.code==="aborted");
const shopEconomyRef=ownedRoot.collection("economy").doc("current");
await shopEconomyRef.update({gold:999});
await assert.rejects(shop.purchase(ownedRequest,shopArgs),
    error=>error.code==="data-loss");
await shopEconomyRef.update({gold:originalGold});
let abortShop=true;
const rollbackShop=createCanonicalShopPurchase({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortShop){throw new Error("simulated shop rollback");}
        return result;
    })});
await assert.rejects(rollbackShop.purchase(ownedRequest,shopArgs),
    /simulated shop rollback/);
abortShop=false;
const shopItemRef=ownedRoot.collection("inventory").doc(`shop-${shopArgs.operationId}`);
assert.equal((await shopItemRef.get()).exists,false);
assert.equal((await ownedRoot.collection("operations").doc(shopArgs.operationId).get()).exists,false);
assert.equal((await ownedRoot.collection("recoveryArchives").doc("8").get()).exists,false);
const purchased=await shop.purchase(ownedRequest,shopArgs);
assert.equal(purchased.purchasedRevision,8);
assert.equal(purchased.cost,20);
assert.equal((await shopEconomyRef.get()).get("gold"),originalGold-20);
assert.equal((await shopItemRef.get()).get("state.count"),1);
assert.equal((await ownedItemRef.get()).get("serverRevision"),8);
assert.equal((await ownedRoot.collection("claimRecords").doc(ownedGrant).get())
    .get("serverRevision"),8);
assert.equal((await ownedRoot.collection("ledgerEntries").doc(shopArgs.operationId).get())
    .get("amount"),-20);
assert.equal((await shop.purchase(ownedRequest,shopArgs)).unchanged,true);
assert.equal((await shopEconomyRef.get()).get("gold"),originalGold-20);
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,quantity:2}),
    error=>error.code==="data-loss");
await checkRecoveryArchive(ownedUid,8);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("8").get())
    .get("readyForPublication"),false);
// The opposite order is fenced too: a reserved grant cannot become a new
// character's operation receipt under the same UID.
const collisionUser=await login("accounts:signUp",{
    email:"session-operation-collision@example.test",password});
const collisionUid=collisionUser.localId;
const collisionSession=await invoke("createGameSession",collisionUser.idToken,
    {uid:collisionUid});
await invoke("bootstrapCloudSave",collisionUser.idToken,
    {uid:collisionUid,session:collisionSession});
const collisionOperation="initial-collision-emulator-0001";
await db.doc(`serverUsers/${collisionUid}/pendingGrants/collision-seed-0001`).set({
    schemaVersion:1,ownerUid:collisionUid,kind:"exp",source:"server-event",
    amount:10,status:"pending",claimedByOperationId:null,createdAt:Timestamp.now()
});
await invoke("reserveTrustedGrant",collisionUser.idToken,{
    uid:collisionUid,session:collisionSession,grantId:"collision-seed-0001",
    operationId:collisionOperation,expectedRevision:1});
await assert.rejects(initialWriter.commitInitialSources({
    auth:{uid:collisionUid,token:claims(collisionUser.idToken)},
    data:{uid:collisionUid,session:collisionSession}},
    {operationId:collisionOperation,expectedRevision:2,selection:choices}),
    error=>error.code==="failed-precondition");
assert.equal((await db.doc(`serverUsers/${collisionUid}/account/current`).get())
    .exists,false);
assert.equal((await db.doc(`serverUsers/${collisionUid}/operations/${collisionOperation}`).get())
    .exists,false);
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("authoritativeStateReady"),false);
await rejected("protectedTest",yUser.idToken,{uid:x,session:sessionB},"SESSION_INVALID");
await rejected("protectedTest",yUser.idToken,{uid:y,session:{...sessionB,uid:y}},"SESSION_INVALID");
assert.equal((await invoke("protectedTest",yUser.idToken,{uid:y,session:sessionY})).uid,y);
const beforeCheckin=(await db.doc(`users/${y}/saves/current`).get()).get("serverRevision");
const checkinOperation="daily-checkin-credit-emulator-0001";
const uncreditedGrant=(await checkinRef.get()).data();
await checkinEventRef.update({amount:5000});
await rejected("reserveTrustedGrant",yUser.idToken,{uid:y,session:sessionY,
    grantId:"daily-checkin-20260927",operationId:checkinOperation,
    expectedRevision:beforeCheckin},"DATA_LOSS");
assert.deepEqual((await checkinRef.get()).data(),uncreditedGrant);
await checkinEventRef.set(savedCheckinEvent);
// Pending reservations also require the original source, even after current
// canonical revisions have moved on. Refusal cannot reserve or change revision.
for(const path of ["playableSnapshots/2","recoveryArchives/2"]){
    const ref=db.doc(`serverUsers/${y}/${path}`),saved=(await ref.get()).data();
    await ref.delete();
    await rejected("reserveTrustedGrant",yUser.idToken,{
        uid:y,session:sessionY,grantId:"daily-checkin-20260927",
        operationId:checkinOperation,expectedRevision:beforeCheckin},"DATA_LOSS");
    assert.deepEqual((await checkinRef.get()).data(),uncreditedGrant);
    assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("serverRevision"),beforeCheckin);
    await ref.set(saved);
}
const reservedCheckin=await invoke("reserveTrustedGrant",yUser.idToken,{
    uid:y,session:sessionY,grantId:"daily-checkin-20260927",
    operationId:checkinOperation,expectedRevision:beforeCheckin});
assert.equal(reservedCheckin.serverRevision,beforeCheckin+1);
assert.equal((await checkinIssuer.issue(yRequest)).status,"reserved");
const settledCheckin=await goldWriter.creditReservedGrant(yRequest,{
    grantId:"daily-checkin-20260927",operationId:checkinOperation,
    expectedRevision:beforeCheckin+1});
assert.equal(settledCheckin.creditRevision,beforeCheckin+2);
assert.equal((await checkinIssuer.issue(yRequest)).status,"credited");
const creditedEconomy=(await db.doc(`serverUsers/${y}/economy/current`).get()).data();
await checkinEventRef.delete();
for(const retry of [
    ()=>goldWriter.creditReservedGrant(yRequest,{grantId:"daily-checkin-20260927",
        operationId:checkinOperation,expectedRevision:beforeCheckin+1}),
    ()=>invoke("reserveTrustedGrant",yUser.idToken,{uid:y,session:sessionY,
        grantId:"daily-checkin-20260927",operationId:checkinOperation,
        expectedRevision:beforeCheckin+1})]){
    await assert.rejects(retry(),e=>["failed-precondition","FAILED_PRECONDITION"].includes(e.code));
}
assert.deepEqual((await db.doc(`serverUsers/${y}/economy/current`).get()).data(),creditedEconomy);
assert.equal((await checkinEventRef.get()).exists,false);
await checkinEventRef.set(savedCheckinEvent);
assert.equal((await goldWriter.creditReservedGrant(yRequest,{grantId:"daily-checkin-20260927",
    operationId:checkinOperation,expectedRevision:beforeCheckin+1})).unchanged,true);
assert.equal((await db.doc(`serverUsers/${y}/claimRecords/daily-checkin-20260927`).get())
    .get("status"),"claimed");
assert.equal((await db.doc(`serverUsers/${y}/playableSnapshots/${beforeCheckin+2}`).get())
    .get("readyForPublication"),false);
await rejected("screenLegacyMigrationCandidate",yUser.idToken,{...screenIntent,uid:y,session:sessionY},"FAILED_PRECONDITION");
async function rulesRequest(path,token,method="GET"){
    const response=await fetch(`http://127.0.0.1:18080/v1/projects/${project}/databases/(default)/documents/${path}`,{
        method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        ...(method==="PATCH"?{body:JSON.stringify({fields:{status:{stringValue:"active"}}})}:{})
    });return response.status;
}
assert.equal(await rulesRequest(`users/${x}/saves/current`,b.idToken),200);
assert.equal(await rulesRequest(`users/${x}/saves/current`,yUser.idToken),403);
assert.equal(await rulesRequest(`users/${x}/saves/current`,b.idToken,"PATCH"),403);
await rejected("saveCloudPreferences",yUser.idToken,{uid:x,session:sessionB,expectedRevision:3,preferences},"SESSION_INVALID");
for(const path of [`serverUsers/${x}/sessionAuthority/current`,`serverUsers/${x}/sessions/${sessionB.sessionId}`]){
    assert.equal(await rulesRequest(path,b.idToken),403);
    assert.equal(await rulesRequest(path,b.idToken,"PATCH"),403);
}
await invoke("revokeGameSession",b.idToken,{uid:x,session:sessionB});
await rejected("protectedTest",b.idToken,{uid:x,session:sessionB},"SESSION_REVOKED");
await rejected("createGameSession",b.idToken,{uid:x},"SESSION_REAUTH_REQUIRED");
assert.equal((await invoke("protectedTest",yUser.idToken,{uid:y,session:sessionY})).result,"SUCCESS");
async function laterLogin(previous){
    while(Math.floor(Date.now()/1000)<=claims(previous.idToken).auth_time){await new Promise(resolve=>setTimeout(resolve,100));}
    return login("accounts:signInWithPassword",{email:"session-x@example.test",password});
}
const c=await laterLogin(b),d=await laterLogin(c);
const contenders=await Promise.allSettled([
    invoke("createGameSession",c.idToken,{uid:x}),invoke("createGameSession",d.idToken,{uid:x})
]);
assert.equal(contenders[1].status,"fulfilled");
if(contenders[0].status==="rejected"){assert.equal(contenders[0].reason.code,"SESSION_REAUTH_REQUIRED");}
const sessionD=contenders[1].value;
const active=(await db.collection(`serverUsers/${x}/sessions`).get()).docs.filter(doc=>doc.get("status")==="active");
assert.equal(active.length,1); assert.equal(active[0].id,sessionD.sessionId);
const e=await laterLogin(d);
const overlap=await Promise.allSettled([
    invoke("bootstrapCloudSave",d.idToken,{uid:x,session:sessionD}),invoke("createGameSession",e.idToken,{uid:x})
]);
assert.equal(overlap[1].status,"fulfilled");
if(overlap[0].status==="rejected"){assert.equal(overlap[0].reason.code,"SESSION_REVOKED");}
const sessionE=overlap[1].value;
const saveAfterOverlap=await db.doc(`users/${x}/saves/current`).get();
const sessionAfterOverlap=await db.doc(`serverUsers/${x}/sessions/${sessionE.sessionId}`).get();
assert.ok(saveAfterOverlap.updateTime.toMillis()<=sessionAfterOverlap.updateTime.toMillis(),
    "D must never commit a protected write after E takeover: "+JSON.stringify({
        outcomes:overlap.map(x=>x.status),saveCommit:saveAfterOverlap.updateTime.toMillis(),
        sessionCommit:sessionAfterOverlap.updateTime.toMillis(),saveTimestamp:saveAfterOverlap.get("updatedAt").toMillis(),
        sessionTimestamp:sessionAfterOverlap.get("createdAt").toMillis()
    }));
await rejected("protectedTest",d.idToken,{uid:x,session:sessionD},"SESSION_REVOKED");
assert.equal((await invoke("protectedTest",e.idToken,{uid:x,session:sessionE})).result,"SUCCESS");
const replayedBridge=await login("accounts:signInWithCustomToken",{token:bridge.customToken});
await rejected("createGameSession",replayedBridge.idToken,{uid:x},"SESSION_REAUTH_REQUIRED");
await getAuth(testApp).revokeRefreshTokens(y);
await rejected("protectedTest",yUser.idToken,{uid:y,session:sessionY},"AUTH_REQUIRED");
await rejected("createNativeAuthHandoff",yUser.idToken,{},"AUTH_REQUIRED");
await getAuth(testApp).updateUser(x,{disabled:true});
await rejected("protectedTest",e.idToken,{uid:x,session:sessionE},"AUTH_REQUIRED");
// Exercise the deployed Callable boundary, not only the internal shop module.
const callableShop={uid:atomicUid,session:atomicSession,
    operationId:"shop-callable-checkin-0001",expectedRevision:3,
    itemId:"hpPotion10",quantity:1};
await rejected("purchaseCanonicalPotion",atomicUser.idToken,
    {...callableShop,price:0},"INVALID_ARGUMENT");
await rejected("purchaseCanonicalPotion",atomicUser.idToken,
    {...callableShop,expectedRevision:2},"ABORTED");
await rejected("purchaseCanonicalPotion",atomicUser.idToken,
    {...callableShop,session:sessionY},"SESSION_INVALID");
const callableBought=await invoke("purchaseCanonicalPotion",atomicUser.idToken,callableShop);
assert.equal(callableBought.purchasedRevision,4);
assert.equal(callableBought.cost,20);
assert.equal((await db.doc(`serverUsers/${atomicUid}/economy/current`).get()).get("gold"),30);
assert.equal((await db.doc(`serverUsers/${atomicUid}/inventory/${callableBought.ownedItemId}`).get())
    .get("state.count"),1);
assert.equal((await invoke("purchaseCanonicalPotion",atomicUser.idToken,callableShop))
    .unchanged,true);
assert.equal((await db.doc(`serverUsers/${atomicUid}/economy/current`).get()).get("gold"),30);
await rejected("purchaseCanonicalPotion",atomicUser.idToken,
    {...callableShop,quantity:2},"DATA_LOSS");
assert.equal((await db.doc(`users/${atomicUid}/saves/current`).get())
    .get("authoritativeStateReady"),false);
assert.equal((await db.doc(`serverUsers/${atomicUid}/playableSnapshots/4`).get())
    .get("readyForPublication"),false);
await checkRecoveryArchive(atomicUid,4);
console.log(`PASS (${direct?"direct exported handlers":"HTTP callable"}): A SUCCESS -> B takeover -> A SESSION_REVOKED -> B SUCCESS; logout, UID isolation, tampering, private rules, protected writers, concurrent takeover/write ordering, revoked/disabled Firebase identity.`);
await db.terminate();
if(direct){await getFirestore().terminate();}
