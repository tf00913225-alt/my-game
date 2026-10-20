/* Real Auth + Functions + Firestore emulator integration. Never target live data. */
import assert from "node:assert/strict";
import {readFileSync,openSync,fstatSync,readSync,closeSync} from "node:fs";
import vm from "node:vm";
import {createRequire,Module} from "node:module";
import {AsyncLocalStorage} from "node:async_hooks";
import {createHash,randomBytes} from "node:crypto";
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,Timestamp,FieldValue,FieldPath}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const {HttpsError}=require("firebase-functions/v2/https");
const {createSessionAuthority}=require("../functions/src/session-authority.js");
const {createCanonicalSourceWriter}=require("../functions/src/canonical-source-writer.js");
const {createCanonicalResourceCredit}=require("../functions/src/canonical-resource-credit.js");
const {createDailyCheckinGrant}=require("../functions/src/daily-checkin-grant.js");
const {createHeroAcquisition}=require("../functions/src/hero-acquisition.js");
const {createHeroGrowth}=require("../functions/src/hero-growth.js");
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
const {taipeiDay}=require("../functions/src/daily-checkin-policy.js");
const {createCanonicalBattleAttempt}=require("../functions/src/canonical-battle-attempt.js");
const {createCanonicalBattleEncounter}=require("../functions/src/canonical-battle-encounter.js");
const {resolvePlainPlayerNormalAttack}=require("../functions/src/canonical-battle-normal-attack.js");
const {resolveForestOpeningRound}=require("../functions/src/canonical-battle-opening-round.js");
const {createCanonicalBattleAttackProof}=require("../functions/src/canonical-battle-attack-proof.js");
const {createCanonicalRestrictedBattle}=require("../functions/src/canonical-restricted-battle.js");
const {createCanonicalExpAllocation}=require("../functions/src/canonical-exp-allocation.js");
const {createCanonicalAttributeAllocation}=
    require("../functions/src/canonical-attribute-allocation.js");
const {assembleCanonicalSnapshot,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
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
function assertRecoveryFenceCommitOrder(probe,fence){
    const valid=value=>value&&Number.isSafeInteger(value.seconds)&&
        value.seconds>=-62135596800&&value.seconds<=253402300799&&
        Number.isInteger(value.nanoseconds)&&value.nanoseconds>=0&&value.nanoseconds<1000000000;
    const describe=value=>value?{seconds:value.seconds,nanoseconds:value.nanoseconds}:null;
    const diagnostic=JSON.stringify({
        probe:{createTime:describe(probe.createTime),updateTime:describe(probe.updateTime),
            readTime:describe(probe.readTime),committedAt:describe(probe.get("committedAt"))},
        fence:{createTime:describe(fence.createTime),updateTime:describe(fence.updateTime),
            readTime:describe(fence.readTime),createdAt:describe(fence.get("createdAt"))}
    });
    const writerAt=probe.updateTime,fenceAt=fence.updateTime;
    assert(valid(writerAt)&&valid(fenceAt),"Valid document commit metadata is required: "+diagnostic);
    assert(writerAt.seconds<fenceAt.seconds||(writerAt.seconds===fenceAt.seconds&&writerAt.nanoseconds<=fenceAt.nanoseconds),
        "An ordinary writer may commit only before audit begin, never after the active fence: "+diagnostic);
}
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
    // Raw device preference is preserved, never parsed into gameplay/claims.
    sidecars["task-tracker"]={status:"present",raw:"corrupt-ui-preference"};
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
const corruptClaimBackup=sealedBackup(candidate);
corruptClaimBackup.sidecars["quest-milestones"]={status:"present",raw:"corrupt-claim"};
corruptClaimBackup.sidecarManifestSha256=digest(JSON.stringify(corruptClaimBackup.sidecars));
corruptClaimBackup.backupSha256=digest(JSON.stringify({ownerUid:x,mainRaw:corruptClaimBackup.mainRaw,
    metadataRaw:corruptClaimBackup.metadataRaw,sidecars:corruptClaimBackup.sidecars}));
await rejected("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,
    expectedRevision:2,backup:corruptClaimBackup},"INVALID_ARGUMENT");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("serverRevision"),2);
const firstCandidate=await invoke("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,expectedRevision:2,backup:sealedBackup(candidate)});
assert.equal(firstCandidate.revision,1);assert.equal(firstCandidate.unchanged,false);
const candidateRoot=`serverUsers/${x}/migrationCandidates`;
const original=(await db.doc(`${candidateRoot}/1`).get()).data();
assert.equal(original.backup.mainRaw,JSON.stringify(candidate));
assert.equal(original.backupSha256,sealedBackup(candidate).backupSha256);
assert.equal(original.trusted,false);assert.deepEqual(original.snapshot,candidate);
assert.deepEqual(original.backup.sidecars["task-tracker"],{status:"present",raw:"corrupt-ui-preference"});
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
// New-account quest storage evidence only: no period rollover or reward.
const freshQuestStates={
    dailyQuestState:{date:"",progress:{checkin:0,killMonsters:0,winBattle:0},
        claimed:{checkin:false,killMonsters:false,winBattle:false}},
    commissionQuestState:{date:"",progress:{killMonsters:0,winBattle:0},
        claimed:{killMonsters:false,winBattle:false}}
};
const freshProgressRef=db.doc(`serverUsers/${freshUid}/progress/current`);
const freshQuestProgress=await freshProgressRef.get();
const freshQuestSnapshot=(await db.doc(`serverUsers/${freshUid}/playableSnapshots/2`).get()).data();
const freshQuestArchive=(await checkRecoveryArchive(freshUid,2)).data();
for(const [key,state] of Object.entries(freshQuestStates)){
    assert.deepEqual(freshQuestProgress.get(key),state);
    assert.deepEqual(freshQuestSnapshot.snapshot.progress[key],state);
    assert.deepEqual(freshQuestArchive.sourceRecords.progress[key],state);
    await assert.rejects(invoke("createInitialCanonicalCharacter",freshUser.idToken,
        {...freshPayload,selection:{...choices,[key]:state}}),error=>
        ["invalid-argument","INVALID_ARGUMENT"].includes(error.code));
}
// Compare real callable source storage with the actual Client Owner at the
// server-pinned creation instant. No Client lifecycle or reward is executed.
const freshGameplayClient={console,setTimeout:()=>0,clearTimeout:()=>{},saveGame:()=>{},
    FourSymbolsAccountSave:{getActiveUid:()=>"fixture",saveKey:()=>"fixture",
        readForUid:()=>({status:"missing"})}};
freshGameplayClient.window=freshGameplayClient;
vm.runInNewContext(readFileSync(new URL("../js/gameplay-boss-tower-system.js",import.meta.url),"utf8"),
    freshGameplayClient);
const freshGameplayExpected=JSON.parse(JSON.stringify(freshGameplayClient.GameplaySystem.normalizeState(
    null,freshQuestProgress.get("playableState.lastSaveTimestamp"))));
assert.deepEqual(freshQuestProgress.get("gameplayProgress"),freshGameplayExpected);
assert.deepEqual(freshQuestSnapshot.snapshot.progress.gameplayProgress,freshGameplayExpected);
assert.deepEqual(freshQuestArchive.sourceRecords.progress.gameplayProgress,freshGameplayExpected);
await assert.rejects(invoke("createInitialCanonicalCharacter",freshUser.idToken,
    {...freshPayload,selection:{...choices,gameplayProgress:freshGameplayExpected}}),error=>
    ["invalid-argument","INVALID_ARGUMENT"].includes(error.code));
const freshPeriodDay=taipeiDay(freshQuestProgress.get("playableState.lastSaveTimestamp"));
const freshPeriodDate=freshPeriodDay.slice(0,4)+"-"+freshPeriodDay.slice(4,6)+"-"+freshPeriodDay.slice(6,8);
for(const [key,state] of Object.entries({
    "daily-dungeon-state":{date:freshPeriodDate,used:{exp:false,material:false,equipment:false}},
    "equipment-shop-daily":{date:freshPeriodDate,refreshCount:0,soldOfferIds:[]}
})){
    const entry={status:"present",raw:JSON.stringify(state)};
    assert.deepEqual(freshQuestProgress.get("sidecars")[key],entry);
    assert.deepEqual(freshQuestSnapshot.snapshot.progress.sidecars[key],entry);
    assert.deepEqual(freshQuestArchive.sourceRecords.progress.sidecars[key],entry);
    await assert.rejects(invoke("createInitialCanonicalCharacter",freshUser.idToken,
        {...freshPayload,selection:{...choices,[key]:state}}),error=>
        ["invalid-argument","INVALID_ARGUMENT"].includes(error.code));
}
const {assembleCanonicalPlayableProjection}=require("../functions/src/canonical-snapshot.js");
const freshComplete=assembleCanonicalPlayableProjection(freshUid,2,freshQuestArchive.sourceRecords);
assert.equal(freshComplete.readyForPublication,false);
assert.equal(freshComplete.projection.authoritativeStateReady,false);
assert.deepEqual(freshComplete.projection.sidecars,freshQuestProgress.get("sidecars"));
assert.equal(freshQuestArchive.readyForRestore,false);
assert.equal(freshQuestSnapshot.readyForPublication,false);
assert.equal(freshQuestArchive.sourceRecords.claimRecords.length,0);
assert.equal((await db.doc(`users/${freshUid}/saves/current`).get())
    .get("authoritativeStateReady"),false);
assert.equal((await invoke("createInitialCanonicalCharacter",freshUser.idToken,
    freshPayload)).unchanged,true);
const freshQuestReplay=await freshProgressRef.get();
assert.deepEqual(freshQuestReplay.data(),freshQuestProgress.data());
assert.ok(freshQuestReplay.updateTime.isEqual(freshQuestProgress.updateTime));
console.log("Initial Boss/Tower real callable: exact Client initial storage, archive, replay, rejected imports and false readiness PASS");
console.log("Initial Taipei period sources real callable: source/snapshot/archive, complete unpublished projection, rejected imports and replay PASS");
console.log("Initial quests real callable: exact zero sources, archive, replay, rejected imports and false readiness PASS");
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

// Later-day evidence only: exercise the existing owner against real protected
// Firestore transactions. All fixtures stay inside the guarded demo project.
let periodClock=freshQuestProgress.get("playableState.lastSaveTimestamp");
let abortPeriodObservation=false;
const periodWriter=createCanonicalSourceWriter({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,now:()=>periodClock,
    runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,session)=>{
        const result=await operation(tx,session);
        if(abortPeriodObservation){throw new Error("simulated period commit failure");}
        return result;
    })});
const periodRequest={auth:{uid:freshUid,token:claims(freshUser.idToken)},
    data:{uid:freshUid,session:freshSession}};
const periodArgs={operationId:"period-observation-emulator-0001",expectedRevision:2};
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,periodArgs),
    error=>error.code==="failed-precondition");
periodClock+=86400000;
const laterPeriodId="daily-period-"+taipeiDay(periodClock);
const periodRoot=db.collection("serverUsers").doc(freshUid);
const periodSourceRef=periodRoot.collection("operations").doc(laterPeriodId);
const periodReceiptRef=periodRoot.collection("operations").doc(periodArgs.operationId);
const periodPreservedRefs=[
    db.doc(`users/${freshUid}/saves/current`),
    ...["account","economy","progress","relicLoadout","claimCheckpoints"].map(name=>
        periodRoot.collection(name).doc("current")),
    periodRoot.collection("characters").doc(freshQuestArchive.sourceRecords.account.slots[0]),
    periodRoot.collection("playableSnapshots").doc("2"),
    periodRoot.collection("recoveryArchives").doc("2")];
const periodBefore=await Promise.all(periodPreservedRefs.map(ref=>ref.get()));
abortPeriodObservation=true;
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,periodArgs),
    /simulated period commit failure/);
abortPeriodObservation=false;
assert.equal((await periodSourceRef.get()).exists,false);
assert.equal((await periodReceiptRef.get()).exists,false);
await assert.rejects(periodWriter.observeDailyPeriod({...periodRequest,
    data:{uid:freshUid,session:sessionY}},periodArgs),error=>error.message==="SESSION_INVALID");
await assert.rejects(periodWriter.observeDailyPeriod({...periodRequest,auth:null},periodArgs),
    error=>error.code==="unauthenticated");
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,
    {...periodArgs,expectedRevision:1}),error=>error.code==="aborted");
for(const key of ["date","observedAt","used","soldOfferIds","gold","rewardEligible"]){
    await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,
        {...periodArgs,[key]:true}),error=>error.code==="invalid-argument");
}
const periodRace=await Promise.allSettled([
    periodWriter.observeDailyPeriod(periodRequest,periodArgs),
    periodWriter.observeDailyPeriod(periodRequest,
        {...periodArgs,operationId:"period-observation-emulator-0002"})]);
assert.equal(periodRace.filter(row=>row.status==="fulfilled").length,1);
assert.equal(periodRace.filter(row=>row.status==="rejected"&&
    row.reason.code==="already-exists").length,1);
const periodSource=await periodSourceRef.get();
const winningPeriodArgs={operationId:periodSource.get("operationId"),expectedRevision:2};
const winningPeriodReceiptRef=periodRoot.collection("operations").doc(winningPeriodArgs.operationId);
const winningPeriodReceipt=await winningPeriodReceiptRef.get();
const periodResult=periodRace.find(row=>row.status==="fulfilled").value;
assert.equal(periodSource.get("authoritativeStateReady"),false);
assert.equal(periodSource.get("rewardEligible"),false);
assert.equal(periodSource.get("snapshotSha256"),freshQuestSnapshot.sha256);
for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
    assert.equal(periodSource.get("periods")[key].rawSha256,createHash("sha256")
        .update(freshQuestProgress.get("sidecars")[key].raw,"utf8").digest("hex"));
}
periodClock+=35*86400000;
const concurrentPeriodRetry=await Promise.all([
    periodWriter.observeDailyPeriod(periodRequest,winningPeriodArgs),
    periodWriter.observeDailyPeriod(periodRequest,winningPeriodArgs)]);
for(const result of concurrentPeriodRetry){
    assert.deepEqual(result,{...periodResult,unchanged:true});
}
assert.ok((await periodSourceRef.get()).updateTime.isEqual(periodSource.updateTime));
assert.ok((await winningPeriodReceiptRef.get()).updateTime.isEqual(winningPeriodReceipt.updateTime));
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,
    {...winningPeriodArgs,expectedRevision:3}),error=>error.code==="data-loss");
for(let index=0;index<periodPreservedRefs.length;index++){
    const after=await periodPreservedRefs[index].get(),before=periodBefore[index];
    assert.deepEqual(after.data(),before.data());assert.ok(after.updateTime.isEqual(before.updateTime));
}
for(const collection of ["ledgerEntries","grantOperations","claimRecords"]){
    assert.equal((await periodRoot.collection(collection).get()).size,0);
}
assert.equal(await rulesRequest(`serverUsers/${freshUid}/operations/${laterPeriodId}`,
    freshUser.idToken),403);
assert.equal(await rulesRequest(`serverUsers/${freshUid}/operations/${laterPeriodId}`,
    freshUser.idToken,"PATCH"),403);
assert.equal(await rulesRequest(`serverUsers/${freshUid}/operations/${laterPeriodId}`,
    yUser.idToken),403);
await winningPeriodReceiptRef.delete();
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,winningPeriodArgs),
    error=>error.code==="data-loss"); // Original receipt cannot regenerate after midnight.
await winningPeriodReceiptRef.set(winningPeriodReceipt.data());
await periodSourceRef.delete();
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,winningPeriodArgs),
    error=>error.code==="data-loss");
await periodSourceRef.set(periodSource.data());
const periodOriginalArchive=await periodRoot.collection("recoveryArchives").doc("2").get();
await periodOriginalArchive.ref.delete();
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,winningPeriodArgs),
    error=>error.code==="data-loss");
await periodOriginalArchive.ref.set(periodOriginalArchive.data());
// Apply only the explicit untouched initial lineage; no consumption writer or
// public callable is introduced. Actual Firestore transactions must stay atomic.
periodClock=freshQuestProgress.get("playableState.lastSaveTimestamp")+86400000;
const applyArgs={operationId:"period-application-emulator-0001",periodId:laterPeriodId,expectedRevision:2};
const appliedMarkerRef=periodRoot.collection("operations").doc(laterPeriodId.replace("daily-period-","daily-period-applied-"));
abortPeriodObservation=true;
await assert.rejects(periodWriter.applyDailyPeriod(periodRequest,applyArgs),/simulated period commit failure/);
abortPeriodObservation=false;
assert.equal((await appliedMarkerRef.get()).exists,false);
assert.equal((await periodRoot.collection("playableSnapshots").doc("3").get()).exists,false);
assert.equal((await periodRoot.collection("account").doc("current").get()).get("serverRevision"),2);
for(const name of ["pendingGrants","grantOperations","uniqueClaims","ledgerEntries","rewardEvents"]){
    const ref=periodRoot.collection(name).doc("unreconciled-consumption-emulator");
    await ref.set({status:"pending"});
    await assert.rejects(periodWriter.applyDailyPeriod(periodRequest,applyArgs),error=>error.code==="failed-precondition");
    assert.equal((await appliedMarkerRef.get()).exists,false);await ref.delete();
}
await assert.rejects(periodWriter.applyDailyPeriod({...periodRequest,auth:null},applyArgs),error=>error.code==="unauthenticated");
await assert.rejects(periodWriter.applyDailyPeriod({...periodRequest,data:{uid:freshUid,session:sessionY}},applyArgs),
    error=>error.message==="SESSION_INVALID");
const applyRace=await Promise.allSettled([periodWriter.applyDailyPeriod(periodRequest,applyArgs),
    periodWriter.applyDailyPeriod(periodRequest,{...applyArgs,operationId:"period-application-emulator-0002"})]);
assert.equal(applyRace.filter(row=>row.status==="fulfilled").length,1);
assert.equal(applyRace.filter(row=>row.status==="rejected"&&row.reason.code==="already-exists").length,1);
const appliedMarker=await appliedMarkerRef.get();
const winningApplyArgs={...applyArgs,operationId:appliedMarker.get("operationId")};
const appliedReceiptRef=periodRoot.collection("operations").doc(winningApplyArgs.operationId);
assert.equal(appliedMarker.get("consumption.status"),"verified-empty");
assert.equal(appliedMarker.get("audit.operationCount"),3);
assert.equal(appliedMarker.get("authoritativeStateReady"),false);
assert.equal(appliedMarker.get("rewardEligible"),false);
const appliedArchive=await checkRecoveryArchive(freshUid,3),appliedRecords=appliedArchive.data().sourceRecords;
assert.equal(appliedArchive.get("readyForRestore"),false);
assert.equal(assembleCanonicalPlayableProjection(freshUid,3,appliedRecords).readyForPublication,false);
for(const key of ["daily-dungeon-state","equipment-shop-daily"]){
    assert.equal(JSON.parse(appliedRecords.progress.sidecars[key].raw).date,periodSource.get("targetDate"));
}
assert.deepEqual(appliedRecords.progress.playableState,freshQuestArchive.sourceRecords.progress.playableState);
assert.equal(appliedRecords.economy.gold,0);assert.deepEqual(appliedRecords.claimRecords,[]);
for(const ref of [periodSourceRef,winningPeriodReceiptRef,periodRoot.collection("playableSnapshots").doc("2")]){
    const old=ref.path===periodSourceRef.path?periodSource:
        ref.path===winningPeriodReceiptRef.path?winningPeriodReceipt:null;
    if(old)assert.deepEqual((await ref.get()).data(),old.data());
}
periodClock+=35*86400000;
const appliedBefore=await appliedMarkerRef.get();
assert.equal((await periodWriter.applyDailyPeriod(periodRequest,winningApplyArgs)).unchanged,true);
assert.ok((await appliedMarkerRef.get()).updateTime.isEqual(appliedBefore.updateTime));
await assert.rejects(periodWriter.applyDailyPeriod(periodRequest,{...winningApplyArgs,expectedRevision:3}),
    error=>error.code==="data-loss");
for(const ref of [appliedReceiptRef,appliedMarkerRef,periodRoot.collection("playableSnapshots").doc("3"),
    periodRoot.collection("recoveryArchives").doc("3")]){
    const old=await ref.get();await ref.delete();
    await assert.rejects(periodWriter.applyDailyPeriod(periodRequest,winningApplyArgs),error=>error.code==="data-loss");
    await ref.set(old.data());
}
assert.equal(await rulesRequest(`serverUsers/${freshUid}/operations/${appliedMarkerRef.id}`,freshUser.idToken),403);
periodClock=freshQuestProgress.get("playableState.lastSaveTimestamp")+2*86400000;
const secondPeriod=await periodWriter.observeDailyPeriod(periodRequest,
    {operationId:"period-observation-emulator-0003",expectedRevision:3});
const secondApply=await periodWriter.applyDailyPeriod(periodRequest,
    {operationId:"period-application-emulator-0003",periodId:secondPeriod.periodId,expectedRevision:3});
assert.equal(secondApply.appliedRevision,4);await checkRecoveryArchive(freshUid,4);
assert.equal((await periodWriter.applyDailyPeriod(periodRequest,winningApplyArgs)).unchanged,true);
for(const name of ["ledgerEntries","grantOperations","claimRecords","pendingGrants","uniqueClaims","rewardEvents"]){
    assert.equal((await periodRoot.collection(name).get()).size,0);
}
console.log("Protected zero-consumption daily application real Firestore PASS: atomic rollback, economic inventory rejection, concurrent once-only revision, immutable historical replay, missing-proof rejection, repeated zero lineage, private rules and closed readiness.");
await invoke("revokeGameSession",freshUser.idToken,{uid:freshUid,session:freshSession});
await assert.rejects(periodWriter.applyDailyPeriod(periodRequest,winningApplyArgs),
    error=>["SESSION_REVOKED","SESSION_INVALID"].includes(error.message));
await assert.rejects(periodWriter.observeDailyPeriod(periodRequest,winningPeriodArgs),
    error=>["SESSION_REVOKED","SESSION_INVALID"].includes(error.message));
console.log("Daily period evidence real Firestore PASS: Taipei server observation, atomic abort, concurrent single source, cross-day immutable replay, exact snapshot/archive/source retention, missing-proof rejection, private rules, UID/session protection and no progression/reward/revision changes.");

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


// Actual protected round writer: private committed versions under the same
// Session transaction, with no endpoint or terminal/reward authorization.
let roundEntropyCalls=0;
const roundDeps={db,FieldValue,HttpsError,inspectExistingEnvelope,now:()=>instanceClock,
  runProtected:writerSessions.runProtected,randomBytes:n=>{roundEntropyCalls++;return Buffer.alloc(n,255);}};
const roundOwner=createCanonicalRestrictedBattle(roundDeps);
const roundArgs={attemptId:battleStart.attemptId,operationId:'restricted-round-emulator-0001',
  expectedRevision:2,expectedRoundVersion:0,action:{type:'normal-attack',actor:'player-0',target:'enemy-0'}};
instanceClock=storedInstance.preparedAtMs+1;
const roundBefore={instance:(await instanceRef.get()).data(),marker:(await instanceMarkerRef.get()).data(),
  account:(await instanceAccountRef.get()).data(),envelope:(await instanceEnvelopeRef.get()).data()};
const roundRollback=createCanonicalRestrictedBattle({...roundDeps,
  runProtected:(req,fn)=>writerSessions.runProtected(req,async(tx,s)=>{await fn(tx,s);throw Error('round rollback injection');})});
await assert.rejects(roundRollback.advance(yRequest,roundArgs),/round rollback injection/);
assert.equal((await battleRoot.collection('restrictedBattleRounds').get()).size,0);
assert.equal((await battleRoot.collection('operations').doc(roundArgs.operationId).get()).exists,false);
assert.deepEqual((await instanceMarkerRef.get()).data(),roundBefore.marker);
roundEntropyCalls=0;
const concurrentRound=await Promise.allSettled([
  roundOwner.advance(yRequest,roundArgs),
  roundOwner.advance(yRequest,{...roundArgs,operationId:'restricted-round-emulator-0002'})]);
assert.equal(concurrentRound.filter(r=>r.status==='fulfilled').length,1);
assert.equal(concurrentRound.filter(r=>r.status==='rejected').length,1);
assert.equal(roundEntropyCalls,2); // transaction retry never requests more entropy
const firstRound=concurrentRound.find(r=>r.status==='fulfilled').value;
const winningRoundArgs={...roundArgs,operationId:firstRound.operationId};
const round1Ref=battleRoot.collection('restrictedBattleRounds').doc(battleStart.attemptId+'_1');
const round1=(await round1Ref.get()).data();
assert.equal(round1.projection.randomTape.length,4);
assert.equal(round1.priorRoundSha256,storedInstance.sha256);
assert.equal(firstRound.projection,undefined);assert.equal(firstRound.randomTape,undefined);
const repeatedSame=await Promise.all([roundOwner.advance(yRequest,winningRoundArgs),roundOwner.advance(yRequest,winningRoundArgs)]);
for(const replay of repeatedSame)assert.deepEqual(replay,{...firstRound,unchanged:true});
await assert.rejects(roundOwner.advance(yRequest,{...winningRoundArgs,expectedRoundVersion:1}),e=>e.code==='failed-precondition');
const secondArgs={...roundArgs,operationId:'restricted-round-emulator-0003',expectedRoundVersion:1};
let deadlineReads=0;
const expiredDuringCommit=createCanonicalRestrictedBattle({...roundDeps,
  now:()=>++deadlineReads<3?instanceClock:battleStart.expiresAtMs});
const beforeDeadlineMarker=(await instanceMarkerRef.get()).data();
await assert.rejects(expiredDuringCommit.advance(yRequest,secondArgs),e=>e.code==='failed-precondition');
assert.deepEqual((await instanceMarkerRef.get()).data(),beforeDeadlineMarker);
assert.equal((await battleRoot.collection('operations').doc(secondArgs.operationId).get()).exists,false);
await roundOwner.advance(yRequest,secondArgs);
const round2Ref=battleRoot.collection('restrictedBattleRounds').doc(battleStart.attemptId+'_2');
const round2=(await round2Ref.get()).data();
assert.equal(round2.priorRoundSha256,round1.sha256);
assert.deepEqual(round2.projection.priorState,round1.projection.nextState);
assert.deepEqual(await roundOwner.advance(yRequest,winningRoundArgs),{...firstRound,unchanged:true});
for(const ref of [round1Ref,round2Ref,battleRoot.collection('operations').doc(firstRound.operationId),
  battleRoot.collection('operations').doc(secondArgs.operationId),instanceRef,instancePolicyRef,instanceMarkerRef]){
  const saved=(await ref.get()).data();await ref.delete();
  await assert.rejects(roundOwner.advance(yRequest,winningRoundArgs));
  await assert.rejects(roundOwner.advance(yRequest,{...roundArgs,operationId:'restricted-round-emulator-0004',expectedRoundVersion:2}));
  await ref.set(saved);
}
const committedMarker=(await instanceMarkerRef.get()).data();
await instanceMarkerRef.set({...roundBefore.marker});
await assert.rejects(roundOwner.advance(yRequest,winningRoundArgs),e=>e.code==='data-loss');
await instanceMarkerRef.set(committedMarker);
await round1Ref.update({'projection.nextState.playerHP':round1.projection.nextState.playerHP+1});
await assert.rejects(roundOwner.advance(yRequest,winningRoundArgs),e=>e.code==='data-loss');await round1Ref.set(round1);
const roundFs=require('node:fs'),originalRead=roundFs.readFileSync;
roundFs.readFileSync=(path,...rest)=>{
  const content=originalRead(path,...rest);
  return String(path).endsWith('canonical-battle-opening-round.js')?content+'\n// changed deployment':content;
};
let changedExecutableOwner;
try{changedExecutableOwner=createCanonicalRestrictedBattle(roundDeps);}finally{roundFs.readFileSync=originalRead;}
assert.deepEqual(await changedExecutableOwner.advance(yRequest,winningRoundArgs),{...firstRound,unchanged:true});
await assert.rejects(changedExecutableOwner.advance(yRequest,{...roundArgs,operationId:'restricted-round-emulator-0004',expectedRoundVersion:2}),
  e=>e.code==='failed-precondition');
const roundCurrent=require('../functions/src/generated/forest-opening-round-policy.json');
const originalRuleHash=roundCurrent.rulesSha256;roundCurrent.rulesSha256='0'.repeat(64);
try{
  assert.deepEqual(await roundOwner.advance(yRequest,winningRoundArgs),{...firstRound,unchanged:true});
  await assert.rejects(roundOwner.advance(yRequest,{...roundArgs,operationId:'restricted-round-emulator-0004',expectedRoundVersion:2}),
    e=>e.code==='failed-precondition');
}finally{roundCurrent.rulesSha256=originalRuleHash;}
await instanceAccountRef.update({serverRevision:3});await instanceEnvelopeRef.update({serverRevision:3});
assert.deepEqual(await roundOwner.advance(yRequest,winningRoundArgs),{...firstRound,unchanged:true});
await assert.rejects(roundOwner.advance(yRequest,{...roundArgs,operationId:'restricted-round-emulator-0004',expectedRoundVersion:2}),e=>e.code==='aborted');
await instanceAccountRef.set(roundBefore.account);await instanceEnvelopeRef.set(roundBefore.envelope);
instanceClock=battleStart.expiresAtMs;
assert.deepEqual(await roundOwner.advance(yRequest,winningRoundArgs),{...firstRound,unchanged:true,expired:true});
await assert.rejects(roundOwner.advance(yRequest,{...roundArgs,operationId:'restricted-round-emulator-0004',expectedRoundVersion:2}),e=>e.code==='failed-precondition');
await assert.rejects(roundOwner.advance({...yRequest,data:{...yRequest.data,session:sessionB}},winningRoundArgs),e=>e.message==='SESSION_INVALID');
for(const ref of [round1Ref,round2Ref]){
  assert.equal(await rulesRequest(ref.path,yUser.idToken),403);
  assert.equal(await rulesRequest(ref.path,yUser.idToken,'PATCH'),403);
}
assert.equal((await battleRoot.collection('restrictedBattleRounds').get()).size,2);
assert.deepEqual((await instanceRef.get()).data(),roundBefore.instance);
assert.deepEqual((await instanceAccountRef.get()).data(),roundBefore.account);
assert.deepEqual((await instanceEnvelopeRef.get()).data(),roundBefore.envelope);
assert.deepEqual((await battleRoot.collection('economy').doc('current').get()).data(),battleBefore.economy);
assert.equal((await battleRoot.collection('pendingGrants').get()).size,0);
assert.equal((await battleRoot.collection('ledgerEntries').get()).size,0);
console.log('Protected round actual emulator: rollback, concurrent version winner, identical lost-response replay, chain integrity, corruption, expiry, policy drift, revision, private rules and zero authority PASS');

// Close only committed terminal resources; no browser verdict or reward.
instanceClock=storedInstance.preparedAtMs+3;
const terminalRoundOwner=createCanonicalRestrictedBattle({...roundDeps,randomBytes:n=>{
  const bytes=Buffer.alloc(n);for(let i=0;i<n;i+=6)bytes.writeUIntBE(Math.floor(.1*281474976710656),i,6);return bytes;
}});
await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,{attemptId:battleStart.attemptId,
  operationId:'restricted-terminal-emulator-0001',expectedRevision:2,expectedRoundVersion:2}),e=>e.code==='failed-precondition');
let terminalVersion=2,terminalRound;
do{
  await terminalRoundOwner.advance(yRequest,{...roundArgs,expectedRoundVersion:terminalVersion,
    operationId:'restricted-terminal-round-'+String(++terminalVersion).padStart(4,'0')});
  terminalRound=(await battleRoot.collection('restrictedBattleRounds').doc(battleStart.attemptId+'_'+terminalVersion).get()).data();
}while(terminalRound.projection.nextState.playerHP&&terminalRound.projection.nextState.enemyHP&&terminalVersion<128);
assert.ok(!terminalRound.projection.nextState.playerHP||!terminalRound.projection.nextState.enemyHP);
const terminalArgs={attemptId:battleStart.attemptId,operationId:'restricted-terminal-emulator-0001',
  expectedRevision:2,expectedRoundVersion:terminalVersion};
const terminalRef=battleRoot.collection('restrictedBattleTerminals').doc(battleStart.attemptId);
const terminalMarkerBefore=(await instanceMarkerRef.get()).data();
const terminalRollback=createCanonicalRestrictedBattle({...roundDeps,
  runProtected:(req,fn)=>writerSessions.runProtected(req,async(tx,s)=>{await fn(tx,s);throw Error('terminal rollback injection');})});
await assert.rejects(terminalRollback.sealTerminal(yRequest,terminalArgs),/terminal rollback injection/);
assert.equal((await terminalRef.get()).exists,false);
assert.equal((await battleRoot.collection('operations').doc(terminalArgs.operationId).get()).exists,false);
assert.deepEqual((await instanceMarkerRef.get()).data(),terminalMarkerBefore);
let terminalClockReads=0;
const terminalDeadline=createCanonicalRestrictedBattle({...roundDeps,now:()=>++terminalClockReads===1?instanceClock:battleStart.expiresAtMs});
await assert.rejects(terminalDeadline.sealTerminal(yRequest,terminalArgs),e=>e.code==='failed-precondition');
assert.equal((await terminalRef.get()).exists,false);
assert.deepEqual((await instanceMarkerRef.get()).data(),terminalMarkerBefore);
await instanceAccountRef.update({serverRevision:3});await instanceEnvelopeRef.update({serverRevision:3});
await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,terminalArgs),e=>e.code==='aborted');
await instanceAccountRef.set(roundBefore.account);await instanceEnvelopeRef.set(roundBefore.envelope);
roundCurrent.rulesSha256='0'.repeat(64);
try{await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,terminalArgs),e=>e.code==='failed-precondition');}
finally{roundCurrent.rulesSha256=originalRuleHash;}
instanceClock=battleStart.expiresAtMs;
await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,terminalArgs),e=>e.code==='failed-precondition');
instanceClock=storedInstance.preparedAtMs+3;
const concurrentTerminal=await Promise.allSettled([
  terminalRoundOwner.sealTerminal(yRequest,terminalArgs),
  terminalRoundOwner.sealTerminal(yRequest,{...terminalArgs,operationId:'restricted-terminal-emulator-0002'})]);
assert.equal(concurrentTerminal.filter(r=>r.status==='fulfilled').length,1);
assert.equal(concurrentTerminal.filter(r=>r.status==='rejected').length,1);
const terminalFirst=concurrentTerminal.find(r=>r.status==='fulfilled').value;
const winningTerminalArgs={...terminalArgs,operationId:terminalFirst.operationId};
const terminal=(await terminalRef.get()).data();
const terminalSourceArgs={attemptId:battleStart.attemptId,expectedRevision:2,terminalSha256:terminal.sha256};
const readTerminalSource=(request=yRequest,args=terminalSourceArgs)=>writerSessions.runProtected(request,
  (tx,session)=>terminalRoundOwner.readTerminal(tx,session,args,instanceClock));
const sourceProof=await readTerminalSource();
assert.deepEqual(sourceProof.result,{...terminalFirst,unchanged:true});
assert.equal(sourceProof.original.snapshot.sha256,storedInstance.snapshotSha256);
assert.equal(sourceProof.chain.rounds.length,terminalVersion);
await assert.rejects(readTerminalSource(yRequest,{...terminalSourceArgs,terminalSha256:'0'.repeat(64)}),
  e=>e.code==='failed-precondition');
assert.equal(terminal.roundSha256,terminalRound.sha256);
assert.equal(terminal.stateSha256,claimRecordsDigest(terminalRound.projection.nextState));
assert.equal((await battleRoot.collection('restrictedBattleTerminals').get()).size,1);
const identicalTerminal=await Promise.all([
  terminalRoundOwner.sealTerminal(yRequest,winningTerminalArgs),terminalRoundOwner.sealTerminal(yRequest,winningTerminalArgs)]);
for(const r of identicalTerminal)assert.deepEqual(r,{...terminalFirst,unchanged:true});
assert.deepEqual(await roundOwner.advance(yRequest,winningRoundArgs),{...firstRound,unchanged:true});
await assert.rejects(terminalRoundOwner.advance(yRequest,{...roundArgs,expectedRoundVersion:terminalVersion,
  operationId:'restricted-terminal-after-0001'}),e=>e.code==='failed-precondition');
for(const ref of [terminalRef,battleRoot.collection('operations').doc(terminalFirst.operationId),instanceMarkerRef,
  round1Ref,instanceRef,instancePolicyRef,battleRoot.collection('playableSnapshots').doc('2'),
  battleRoot.collection('recoveryArchives').doc('2')]){
  const saved=(await ref.get()).data();await ref.delete();
  await assert.rejects(readTerminalSource());
  await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,winningTerminalArgs));
  await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,{...terminalArgs,operationId:'restricted-terminal-emulator-0003'}));
  await ref.set(saved);
}
const terminalMarker=(await instanceMarkerRef.get()).data();
await instanceMarkerRef.set(terminalMarkerBefore);
await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,winningTerminalArgs),e=>e.code==='data-loss');
await instanceMarkerRef.set(terminalMarker);
await terminalRef.update({resourceStatus:'unsupported'});
await assert.rejects(readTerminalSource(),e=>e.code==='data-loss');
await assert.rejects(terminalRoundOwner.sealTerminal(yRequest,winningTerminalArgs),e=>e.code==='data-loss');
await terminalRef.set(terminal);
await instanceAccountRef.update({serverRevision:3});await instanceEnvelopeRef.update({serverRevision:3});
instanceClock=battleStart.expiresAtMs;roundCurrent.rulesSha256='0'.repeat(64);
assert.deepEqual((await readTerminalSource()).result,{...terminalFirst,unchanged:true,expired:true});
try{assert.deepEqual(await changedExecutableOwner.sealTerminal(yRequest,winningTerminalArgs),
  {...terminalFirst,unchanged:true,expired:true});}finally{roundCurrent.rulesSha256=originalRuleHash;}
await instanceAccountRef.set(roundBefore.account);await instanceEnvelopeRef.set(roundBefore.envelope);
assert.equal(await rulesRequest(terminalRef.path,yUser.idToken),403);
assert.equal(await rulesRequest(terminalRef.path,yUser.idToken,'PATCH'),403);
assert.deepEqual((await instanceRef.get()).data(),roundBefore.instance);
assert.deepEqual((await instanceAccountRef.get()).data(),roundBefore.account);
assert.deepEqual((await instanceEnvelopeRef.get()).data(),roundBefore.envelope);
assert.deepEqual((await battleRoot.collection('economy').doc('current').get()).data(),battleBefore.economy);
assert.equal((await battleRoot.collection('pendingGrants').get()).size,0);
assert.equal((await battleRoot.collection('ledgerEntries').get()).size,0);
for(const key of ['combatRulesReady','outcomeVerified','rewardEligible','creditedToCharacter'])assert.equal(terminalFirst[key],false);
console.log('Protected terminal actual emulator: rollback, precommit deadline, concurrent one-winner, identical replay, original chain/receipt/marker integrity, revision/expiry/policy refusal, private rules and zero authority PASS');

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
const lifecycleRoundArgs={attemptId:lifecycleAttempt.attemptId,operationId:'restricted-lifecycle-round-0001',
  expectedRevision:2,expectedRoundVersion:0,action:{type:'normal-attack',actor:'player-0',target:'enemy-0'}};
await lifecycleOwner.advance(lifecycleRequest,lifecycleRoundArgs);
const lifecycleTerminalOwner=createCanonicalRestrictedBattle({...lifecycleDeps,randomBytes:n=>{
  const bytes=Buffer.alloc(n);for(let i=0;i<n;i+=6)bytes.writeUIntBE(Math.floor(.1*281474976710656),i,6);return bytes;
}});
let lifecycleVersion=1,lifecycleState=(await db.doc(`serverUsers/${lifecycleUid}/restrictedBattleRounds/${lifecycleAttempt.attemptId}_1`).get()).data().projection.nextState;
while(lifecycleState.playerHP&&lifecycleState.enemyHP&&lifecycleVersion<128){
  await lifecycleTerminalOwner.advance(lifecycleRequest,{...lifecycleRoundArgs,expectedRoundVersion:lifecycleVersion,
    operationId:'restricted-lifecycle-next-'+String(++lifecycleVersion).padStart(4,'0')});
  lifecycleState=(await db.doc(`serverUsers/${lifecycleUid}/restrictedBattleRounds/${lifecycleAttempt.attemptId}_${lifecycleVersion}`).get()).data().projection.nextState;
}
const lifecycleTerminalArgs={attemptId:lifecycleAttempt.attemptId,operationId:'restricted-lifecycle-terminal-0001',
  expectedRevision:2,expectedRoundVersion:lifecycleVersion};
await lifecycleTerminalOwner.sealTerminal(lifecycleRequest,lifecycleTerminalArgs);
const lifecycleTerminal=(await db.doc(`serverUsers/${lifecycleUid}/restrictedBattleTerminals/${lifecycleAttempt.attemptId}`).get()).data();
const lifecycleReadArgs={attemptId:lifecycleAttempt.attemptId,expectedRevision:2,terminalSha256:lifecycleTerminal.sha256};
const readLifecycleTerminal=request=>writerSessions.runProtected(request,
  (tx,session)=>lifecycleTerminalOwner.readTerminal(tx,session,lifecycleReadArgs,Date.now()));
await readLifecycleTerminal(lifecycleRequest);
await rejected("createGameSession",lifecycleUser.idToken,{uid:lifecycleUid},"SESSION_REAUTH_REQUIRED");
while(Math.floor(Date.now()/1000)<=claims(lifecycleUser.idToken).auth_time){
    await new Promise(resolve=>setTimeout(resolve,100));
}
const takeoverUser=await login("accounts:signInWithPassword",{email:"restricted-lifecycle@example.test",password});
assert.equal(takeoverUser.localId,lifecycleUid);
const takeoverSession=await invoke("createGameSession",takeoverUser.idToken,{uid:lifecycleUid});
await assert.rejects(lifecycleOwner.begin(lifecycleRequest,lifecycleArgs),e=>e.message==="SESSION_REVOKED");
await assert.rejects(lifecycleOwner.advance(lifecycleRequest,lifecycleRoundArgs),e=>e.message==='SESSION_REVOKED');
await assert.rejects(lifecycleTerminalOwner.sealTerminal(lifecycleRequest,lifecycleTerminalArgs),e=>e.message==='SESSION_REVOKED');
await assert.rejects(readLifecycleTerminal(lifecycleRequest),e=>e.message==='SESSION_REVOKED');
const takeoverRequest={auth:{uid:lifecycleUid,token:claims(takeoverUser.idToken)},
    data:{uid:lifecycleUid,session:takeoverSession}};
await assert.rejects(lifecycleOwner.begin(takeoverRequest,lifecycleArgs),e=>e.code==="failed-precondition");
await assert.rejects(lifecycleOwner.advance(takeoverRequest,lifecycleRoundArgs),e=>e.code==='failed-precondition');
await assert.rejects(lifecycleTerminalOwner.sealTerminal(takeoverRequest,lifecycleTerminalArgs),e=>e.code==='failed-precondition');
await assert.rejects(readLifecycleTerminal(takeoverRequest),e=>e.code==='failed-precondition');
await writerSessions.revoke(takeoverRequest);
await assert.rejects(lifecycleOwner.begin(takeoverRequest,lifecycleArgs),e=>e.message==="SESSION_REVOKED");
await assert.rejects(lifecycleOwner.advance(takeoverRequest,lifecycleRoundArgs),e=>e.message==='SESSION_REVOKED');
await assert.rejects(lifecycleTerminalOwner.sealTerminal(takeoverRequest,lifecycleTerminalArgs),e=>e.message==='SESSION_REVOKED');
await assert.rejects(readLifecycleTerminal(takeoverRequest),e=>e.message==='SESSION_REVOKED');
assert.deepEqual((await lifecycleRef.get()).data(),lifecycleBefore);
assert.equal((await db.collection("serverUsers").doc(lifecycleUid).collection("pendingGrants").get()).size,0);
assert.equal((await db.collection("serverUsers").doc(lifecycleUid).collection("ledgerEntries").get()).size,0);
console.log("Restricted instance actual device takeover/revocation: old session blocked, new session cannot inherit, original instance unchanged PASS");



assert.deepEqual(initialArchive.get("sourceRecords.claimRecords"),[]);
const initialPlayableFields=initialArchive.get("sourceRecords.progress.playableState");
const initialTimeSidecars=initialArchive.get("sourceRecords.progress.sidecars");
const initialPeriodDay=taipeiDay(initialPlayableFields.lastSaveTimestamp);
const initialPeriodDate=initialPeriodDay.slice(0,4)+"-"+initialPeriodDay.slice(4,6)+"-"+initialPeriodDay.slice(6,8);
for(const [key,state] of Object.entries({
    "daily-dungeon-state":{date:initialPeriodDate,used:{exp:false,material:false,equipment:false}},
    "equipment-shop-daily":{date:initialPeriodDate,refreshCount:0,soldOfferIds:[]},
    "element-box-state":{remainingMs:0},
    "exp-pool-growth-state":{initialized:true,unlocked:false,
        lastAt:initialPlayableFields.lastSaveTimestamp,noticeShown:false,lastCapped:false,newcomerRewards:{}},
    "rested-exp-state":{battles:0,progressMs:0,
        lastSeenAt:initialPlayableFields.lastSaveTimestamp,blockedByElementBox:false},
    "progress":{eliteKills:0,dungeonWins:0,abyssClears:0},
    "quest-milestones":{date:new Date(initialPlayableFields.lastSaveTimestamp).toISOString().slice(0,10),
        daily:{},commission:{}},
    "abyss-state":initialArchive.get("sourceRecords.progress.abyssProgress"),
    "legacy-abyss-state":{active:false,floor:1,phase:"boss",x:50,y:84,
        message:"",clears:0,rewardVersion:1}
})){
    assert.deepEqual(initialTimeSidecars[key],{status:"present",raw:JSON.stringify(state)});
}
assert.equal(initialArchive.get("sourceRecords.progress.abyssProgress.version"),3);
assert.equal(initialArchive.get("sourceRecords.progress.abyssProgress.legacyMigrated"),true);
for(const level of [20,40]){
    const run=initialArchive.get("sourceRecords.progress.abyssProgress.runs."+level);
    assert.equal(run.active,false);
    assert.equal(run.clears,0);
    assert.deepEqual(run.firstClearClaims,{});
}
assert.deepEqual((await db.doc(`serverUsers/${y}/progress/current`).get())
    .get("sidecars"),initialTimeSidecars);
assert.deepEqual((await db.doc(`serverUsers/${y}/playableSnapshots/2`).get())
    .get("snapshot.progress.sidecars"),initialTimeSidecars);
assert.ok(Number.isSafeInteger(initialPlayableFields.lastSaveTimestamp));
assert.equal(initialPlayableFields.selectedCreationElement,choices.element);
assert.deepEqual(initialPlayableFields.bestiaryData,{});
assert.ok(Object.values(initialPlayableFields.heroAccount.heroes).every(row=>
    row.unlocked===false&&row.specificFragments===0&&row.stars===0));
assert.deepEqual((await db.doc(`serverUsers/${y}/progress/current`).get())
    .get("playableState"),initialPlayableFields);
assert.deepEqual((await db.doc(`serverUsers/${y}/playableSnapshots/2`).get())
    .get("snapshot.progress.playableState"),initialPlayableFields);
assert.equal((await db.doc(`serverUsers/${y}/playableSnapshots/2`).get())
    .get("readyForPublication"),false);
assert.equal((await db.doc(`serverUsers/${y}/characters/character-${initialOperation}`).get())
    .get("state.skillPoints"),2);
assert.equal((await initialWriter.commitInitialSources(yRequest,initialArgs)).unchanged,true);
assert.deepEqual((await db.doc(`serverUsers/${y}/progress/current`).get())
    .get("sidecars.legacy-abyss-state"),initialTimeSidecars["legacy-abyss-state"]);
assert.deepEqual((await db.doc(`serverUsers/${y}/recoveryArchives/2`).get()).data(),initialArchive.data());
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
assert.deepEqual(creditedArchive.get("sourceRecords.progress.playableState"),initialPlayableFields);
assert.deepEqual(creditedArchive.get("sourceRecords.progress.sidecars"),initialTimeSidecars);
assert.equal(creditedArchive.get("sourceRecords.progress.serverRevision"),4);
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
assert.deepEqual(leveledArchive.get("sourceRecords.progress.playableState"),initialPlayableFields);
assert.deepEqual(leveledArchive.get("sourceRecords.progress.sidecars"),initialTimeSidecars);
assert.equal(leveledArchive.get("sourceRecords.progress.serverRevision"),9);
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
const capRecords=(await db.doc(`serverUsers/${capUid}/recoveryArchives/2`).get())
    .get("sourceRecords");
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
const ownedInitialEvidence=await Promise.all([
    `serverUsers/${ownedUid}/operations/${ownedOperation}`,
    `serverUsers/${ownedUid}/playableSnapshots/2`,
    `serverUsers/${ownedUid}/recoveryArchives/2`
].map(async path=>[path,(await db.doc(path).get()).data()]));
const ownedRecords=structuredClone(ownedInitialEvidence[2][1].sourceRecords);
const ownedBase={schemaVersion:1,ownerUid:ownedUid,serverRevision:3,
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
// Emulator-only retained claim/counter fixture, not milestone reward issuance.
ownedRecords.progress.sidecars.progress.raw=' {"eliteKills":3,"dungeonWins":2,"abyssClears":1} ';
ownedRecords.progress.sidecars["quest-milestones"].raw=' {"date":"2020-02-29","daily":{"20":true},"commission":{"100":true}} ';
ownedRecords.progress.sidecars["daily-dungeon-state"]={status:"present",
    raw:' {"date":"2020-02-29","used":{"exp":true,"material":false,"equipment":true}} '};
ownedRecords.progress.sidecars["equipment-shop-daily"]={status:"present",
    raw:' {"date":"2020-02-29","refreshCount":2,"soldOfferIds":["2020-02-29:0:5","2020-02-29:2:0"]} '};
ownedRecords.progress.abyssProgress.runs[40].clears=2;
ownedRecords.progress.abyssProgress.runs[40].firstClearClaims={
    "d40-r0-s0":{status:"claimed",migrated:true}
};
ownedRecords.progress.sidecars["abyss-state"].raw=
    " "+JSON.stringify(ownedRecords.progress.abyssProgress)+" ";
// Emulator-only retained skill evidence, not a learning or ownership grant.
// Emulator-only recorded quest evidence, not a rollover or reward grant.
const ownedQuestStates={
    dailyQuestState:{date:"2020-02-29",progress:{checkin:1,killMonsters:4,winBattle:2,kill10:4},
        claimed:{checkin:true,killMonsters:false,winBattle:false,kill10:false}},
    commissionQuestState:{date:"2020-02-29",progress:{killMonsters:6,winBattle:3},
        claimed:{killMonsters:false,winBattle:true}}
};
const ownedGameplayProgress={version:1,
    personal:Object.fromEntries([20,30,40,50,60,70,80,90,100].map(level=>
        [`personal-${level}`,{firstClear:level===20,clears:level===20?5:0}])),
    world:Object.fromEntries([40,60,80,100].map(level=>
        [`world-${level}`,{completedStages:level===40?4:0,firstClear:level===40,
            clears:level===40?2:0}])),
    tower:{weekKey:"2020-02-24",element:"fire",completedFloor:50,highestThisWeek:50,
        claimedFloors:{1:true,25:true,50:true},historicalHighest:75,pendingRelicChoice:true}
};
ownedRecords.progress.gameplayProgress=ownedGameplayProgress;
Object.assign(ownedRecords.progress,ownedQuestStates);
const ownedAchievementState={firstBattle:true,reachLevel10:false};
ownedRecords.progress.achievementState=ownedAchievementState;
const ownedSkillLoadout={name:"retained skill label",
    skillLevels:{flameSlash:10,fireRocket:2},equippedSkills:["fireRocket","flameSlash"]};
ownedRecords.characters[0].skillLoadout=ownedSkillLoadout;
const ownedRoot=db.collection("serverUsers").doc(ownedUid);
const ownedItemRef=ownedRoot.collection("inventory").doc(ownedItemId);
const ownedEquipRef=ownedRoot.collection("equipment").doc(
    `${ownedCharacterId}_hand`);
const ownedRelicRef=ownedRoot.collection("relics").doc("starter-relic-0001");
// Preserve the original creation receipt and immutable revision-2 evidence.
// Enrichment is a separate emulator-only retained revision, never a product writer.
for(const rows of Object.values(ownedRecords)){
    for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=3;
}
const ownedFixtureBundle=assembleCanonicalSnapshot(ownedUid,3,ownedRecords);
const ownedFixtureBatch=db.batch();
for(const [name,collection] of Object.entries({account:"account",economy:"economy",
    relicLoadout:"relicLoadout",progress:"progress",claimCheckpoint:"claimCheckpoints"})){
    ownedFixtureBatch.set(ownedRoot.collection(collection).doc("current"),
        {...ownedRecords[name],...(name==="account"?{snapshotSha256:ownedFixtureBundle.sha256}:{})});
}
for(const [name,key] of Object.entries({characters:row=>row.characterId,
    inventory:row=>row.ownedItemId,equipment:row=>`${row.characterId}_${row.slot}`,
    relics:row=>row.relicId,claimRecords:row=>row.claimKey})){
    for(const row of ownedRecords[name])ownedFixtureBatch.set(ownedRoot.collection(name).doc(key(row)),row);
}
ownedFixtureBatch.create(ownedRoot.collection("playableSnapshots").doc("3"),ownedFixtureBundle);
ownedFixtureBatch.create(ownedRoot.collection("recoveryArchives").doc("3"),
    createRecoveryArchive(ownedUid,3,ownedRecords,ownedFixtureBundle));
ownedFixtureBatch.update(db.doc(`users/${ownedUid}/saves/current`),{serverRevision:3});
await ownedFixtureBatch.commit();
for(const [path,row] of ownedInitialEvidence)assert.deepEqual((await db.doc(path).get()).data(),row,path);
assert.equal((await initialWriter.commitInitialSources(ownedRequest,{
    operationId:ownedOperation,expectedRevision:1,selection:choices})).unchanged,true);
const ownedGrant="grant-owned-source-gold-0001";
const ownedCreditOperation="credit-owned-source-gold-0001";
await ownedRoot.collection("pendingGrants").doc(ownedGrant).set({
    schemaVersion:1,ownerUid:ownedUid,kind:"gold",source:"server-event",
    amount:30,status:"pending",claimedByOperationId:null,
    createdAt:Timestamp.now()
});
await invoke("reserveTrustedGrant",ownedUser.idToken,{
    uid:ownedUid,session:ownedSession,grantId:ownedGrant,
    operationId:ownedCreditOperation,expectedRevision:3});
await goldWriter.creditReservedGrant(ownedRequest,{
    grantId:ownedGrant,operationId:ownedCreditOperation,expectedRevision:4});
assert.equal((await ownedItemRef.get()).get("serverRevision"),5);
assert.equal((await ownedEquipRef.get()).get("serverRevision"),5);
assert.equal((await ownedRelicRef.get()).get("serverRevision"),5);
assert.equal((await ownedRoot.collection("claimCheckpoints").doc("current").get())
    .get("claimCount"),1);
const ownedCharacterRef=ownedRoot.collection("characters").doc(ownedCharacterId);
assert.deepEqual((await ownedCharacterRef.get()).get("skillLoadout"),ownedSkillLoadout);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
    .get("sourceRecords.characters")[0].skillLoadout,ownedSkillLoadout);
assert.deepEqual((await ownedRoot.collection("progress").doc("current").get())
    .get("achievementState"),ownedAchievementState);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
    .get("sourceRecords.progress.achievementState"),ownedAchievementState);
for(const [key,state] of Object.entries(ownedQuestStates)){
    assert.deepEqual((await ownedRoot.collection("progress").doc("current").get()).get(key),state);
    assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
        .get(`sourceRecords.progress.${key}`),state);
}
assert.deepEqual((await ownedRoot.collection("progress").doc("current").get())
    .get("gameplayProgress"),ownedGameplayProgress);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
    .get("sourceRecords.progress.gameplayProgress"),ownedGameplayProgress);
const ownedAllocation="allocate-owned-source-exp-0001";
// Corrupt only the emulator fixture and reseal its current snapshot so a
// matching hash cannot substitute for complete retained character evidence.
const ownedState4=(await ownedCharacterRef.get()).get("state");
const ownedSnapshotRef4=ownedRoot.collection("playableSnapshots").doc("5");
const ownedSnapshot4=(await ownedSnapshotRef4.get()).data();
const incompleteState4={...ownedState4};delete incompleteState4.agility;
const incompleteSnapshot4={...ownedSnapshot4,
    snapshot:JSON.parse(JSON.stringify(ownedSnapshot4.snapshot))};
incompleteSnapshot4.snapshot.characters[0].state=incompleteState4;
incompleteSnapshot4.sha256=claimRecordsDigest(incompleteSnapshot4.snapshot);
incompleteSnapshot4.byteLength=Buffer.byteLength(JSON.stringify(incompleteSnapshot4.snapshot),"utf8");
await Promise.all([
    ownedCharacterRef.update({state:incompleteState4}),
    ownedSnapshotRef4.set(incompleteSnapshot4),
    ownedRoot.collection("account").doc("current").update({snapshotSha256:incompleteSnapshot4.sha256})
]);
await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:5}),error=>error.code==="data-loss");
assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get()).exists,false);
assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),320);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
    .get("sourceRecords.characters")[0].state,ownedState4);
await Promise.all([
    ownedCharacterRef.update({state:ownedState4}),ownedSnapshotRef4.set(ownedSnapshot4),
    ownedRoot.collection("account").doc("current").update({snapshotSha256:ownedSnapshot4.sha256})
]);
// An explicitly stored formation must retain every created character even
// when the emulator source and snapshot are resealed to the same digest.
const ownedAccountRef4=ownedRoot.collection("account").doc("current");
const ownedFormation4=(await ownedAccountRef4.get()).get("formation");
const incompleteFormation4={version:1,characterIndexToSlot:{}};
const incompleteFormationSnapshot4={...ownedSnapshot4,
    snapshot:JSON.parse(JSON.stringify(ownedSnapshot4.snapshot))};
incompleteFormationSnapshot4.snapshot.formation=incompleteFormation4;
incompleteFormationSnapshot4.sha256=claimRecordsDigest(incompleteFormationSnapshot4.snapshot);
incompleteFormationSnapshot4.byteLength=Buffer.byteLength(JSON.stringify(incompleteFormationSnapshot4.snapshot),"utf8");
await Promise.all([
    ownedAccountRef4.update({formation:incompleteFormation4,snapshotSha256:incompleteFormationSnapshot4.sha256}),
    ownedSnapshotRef4.set(incompleteFormationSnapshot4)
]);
await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:5}),error=>error.code==="data-loss");
assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get()).exists,false);
assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),320);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
    .get("sourceRecords.account.formation"),ownedFormation4);
await Promise.all([
    ownedAccountRef4.update({formation:ownedFormation4,snapshotSha256:ownedSnapshot4.sha256}),
    ownedSnapshotRef4.set(ownedSnapshot4)
]);
// A matching source/snapshot digest cannot turn a malformed achievement
// marker into complete evidence. Corruption stays inside this emulator fixture.
const ownedProgressRef4=ownedRoot.collection("progress").doc("current");
for(const badAchievementState4 of [{firstBattle:"true"},{firstBattle:{claimed:true}}]){
    const badAchievementSnapshot4={...ownedSnapshot4,
        snapshot:JSON.parse(JSON.stringify(ownedSnapshot4.snapshot))};
    badAchievementSnapshot4.snapshot.progress.achievementState=badAchievementState4;
    badAchievementSnapshot4.sha256=claimRecordsDigest(badAchievementSnapshot4.snapshot);
    badAchievementSnapshot4.byteLength=Buffer.byteLength(JSON.stringify(badAchievementSnapshot4.snapshot),"utf8");
    await Promise.all([
        ownedProgressRef4.update({achievementState:badAchievementState4}),
        ownedSnapshotRef4.set(badAchievementSnapshot4),
        ownedAccountRef4.update({snapshotSha256:badAchievementSnapshot4.sha256})
    ]);
    await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
        operationId:ownedAllocation,expectedRevision:5}),error=>error.code==="data-loss");
    assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
    assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get()).exists,false);
    assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
    assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
    assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),320);
    assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
        .get("sourceRecords.progress.achievementState"),ownedAchievementState);
}
await Promise.all([
    ownedProgressRef4.update({achievementState:ownedAchievementState}),
    ownedSnapshotRef4.set(ownedSnapshot4),
    ownedAccountRef4.update({snapshotSha256:ownedSnapshot4.sha256})
]);
// Resealing both retained sources and snapshot cannot legitimize malformed
// quest storage. Every failure leaves revision, balances and receipts intact.
for(const [key,state] of Object.entries(ownedQuestStates)){
    for(const mutate of [s=>s.progress.killMonsters="4",
        s=>s.claimed.killMonsters={claimed:true},s=>s.date="2023-02-29"]){
        const badQuestState4=structuredClone(state);mutate(badQuestState4);
        const badQuestSnapshot4={...ownedSnapshot4,
            snapshot:JSON.parse(JSON.stringify(ownedSnapshot4.snapshot))};
        badQuestSnapshot4.snapshot.progress[key]=badQuestState4;
        badQuestSnapshot4.sha256=claimRecordsDigest(badQuestSnapshot4.snapshot);
        badQuestSnapshot4.byteLength=Buffer.byteLength(JSON.stringify(badQuestSnapshot4.snapshot),"utf8");
        await Promise.all([
            ownedProgressRef4.update({[key]:badQuestState4}),
            ownedSnapshotRef4.set(badQuestSnapshot4),
            ownedAccountRef4.update({snapshotSha256:badQuestSnapshot4.sha256})
        ]);
        await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
            operationId:ownedAllocation,expectedRevision:5}),error=>error.code==="data-loss");
        assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
        assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get()).exists,false);
        assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
        assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
        assert.equal((await ownedAccountRef4.get()).get("serverRevision"),5);
        const retainedEconomy4=(await ownedRoot.collection("economy").doc("current").get()).data();
        assert.equal(retainedEconomy4.sharedExp,320);
        assert.equal(retainedEconomy4.gold,ownedSnapshot4.snapshot.economy.gold);
        for(const [retainedKey,retainedState] of Object.entries(ownedQuestStates)){
            assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
                .get(`sourceRecords.progress.${retainedKey}`),retainedState);
        }
        await Promise.all([
            ownedProgressRef4.update({[key]:state}),
            ownedSnapshotRef4.set(ownedSnapshot4),
            ownedAccountRef4.update({snapshotSha256:ownedSnapshot4.sha256})
        ]);
    }
}
// Matched source/snapshot hashes cannot hide malformed Boss/Tower storage.
// All writes here affect only the existing emulator account fixture.
for(const mutate of [s=>s.personal["personal-20"].firstClear="true",
    s=>s.world["world-40"].completedStages=1.5,
    s=>s.tower.claimedFloors["50"]={claimed:true},s=>s.tower.weekKey="2020-02-25"]){
    const badGameplayProgress4=structuredClone(ownedGameplayProgress);mutate(badGameplayProgress4);
    const badGameplaySnapshot4={...ownedSnapshot4,
        snapshot:JSON.parse(JSON.stringify(ownedSnapshot4.snapshot))};
    badGameplaySnapshot4.snapshot.progress.gameplayProgress=badGameplayProgress4;
    badGameplaySnapshot4.sha256=claimRecordsDigest(badGameplaySnapshot4.snapshot);
    badGameplaySnapshot4.byteLength=Buffer.byteLength(JSON.stringify(badGameplaySnapshot4.snapshot),"utf8");
    await Promise.all([
        ownedProgressRef4.update({gameplayProgress:badGameplayProgress4}),
        ownedSnapshotRef4.set(badGameplaySnapshot4),
        ownedAccountRef4.update({snapshotSha256:badGameplaySnapshot4.sha256})
    ]);
    await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
        operationId:ownedAllocation,expectedRevision:5}),error=>error.code==="data-loss");
    assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
    assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get()).exists,false);
    assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
    assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
    assert.equal((await ownedAccountRef4.get()).get("serverRevision"),5);
    const retainedGameplayEconomy4=(await ownedRoot.collection("economy").doc("current").get()).data();
    assert.equal(retainedGameplayEconomy4.sharedExp,320);
    assert.equal(retainedGameplayEconomy4.gold,ownedSnapshot4.snapshot.economy.gold);
    assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("5").get())
        .get("sourceRecords.progress.gameplayProgress"),ownedGameplayProgress);
    await Promise.all([
        ownedProgressRef4.update({gameplayProgress:ownedGameplayProgress}),
        ownedSnapshotRef4.set(ownedSnapshot4),
        ownedAccountRef4.update({snapshotSha256:ownedSnapshot4.sha256})
    ]);
}
await ownedCharacterRef.update({skillLoadout:{...ownedSkillLoadout,equippedSkills:["flameSlash","flameSlash"]}});
await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:5}),error=>error.code==="data-loss");
assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
assert.equal((await ownedRoot.collection("recoveryArchives").doc("6").get()).exists,false);
assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),5);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),320);
await ownedCharacterRef.update({skillLoadout:ownedSkillLoadout});
await ownedEquipRef.update({ownedItemId:"missing-owned-item"});
await assert.rejects(expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:5}),
    error=>error.code==="data-loss");
assert.equal((await ownedRoot.collection("operations").doc(ownedAllocation).get()).exists,false);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),320);
await ownedEquipRef.update({ownedItemId});
const ownedAllocated=await expAllocator.allocateSharedExp(ownedRequest,{
    operationId:ownedAllocation,expectedRevision:5});
assert.equal(ownedAllocated.allocatedRevision,6);
assert.deepEqual((await ownedRoot.collection("progress").doc("current").get())
    .get("gameplayProgress"),ownedGameplayProgress);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("6").get())
    .get("sourceRecords.progress.gameplayProgress"),ownedGameplayProgress);

for(const [key,state] of Object.entries(ownedQuestStates)){
    assert.deepEqual((await ownedProgressRef4.get()).get(key),state);
    assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("6").get())
        .get(`sourceRecords.progress.${key}`),state);
}
assert.deepEqual((await ownedProgressRef4.get()).get("achievementState"),ownedAchievementState);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("6").get())
    .get("sourceRecords.progress.achievementState"),ownedAchievementState);
assert.deepEqual((await ownedCharacterRef.get()).get("skillLoadout"),ownedSkillLoadout);
assert.deepEqual((await ownedRoot.collection("recoveryArchives").doc("6").get())
    .get("sourceRecords.characters")[0].skillLoadout,ownedSkillLoadout);
assert.equal((await ownedItemRef.get()).get("serverRevision"),6);
assert.equal((await ownedEquipRef.get()).get("ownedItemId"),ownedItemId);
assert.equal((await ownedEquipRef.get()).get("serverRevision"),6);
assert.equal((await ownedRelicRef.get()).get("serverRevision"),6);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("sharedExp"),20);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("6").get())
    .get("readyForPublication"),false);
// Spend one server-earned ability point without accepting a browser stat value
// or refilling current HP/SP. Retain equipped ownership in the same revision.
const attributeAllocator=createCanonicalAttributeAllocation({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,runProtected:writerSessions.runProtected});
const attributeOperation="allocate-attribute-vitality-0001";
const attributeArgs={operationId:attributeOperation,expectedRevision:6,stat:"vitality"};
await assert.rejects(attributeAllocator.allocateAttributePoint(ownedRequest,
    {...attributeArgs,stat:"gold"}),error=>error.code==="invalid-argument");
await assert.rejects(attributeAllocator.allocateAttributePoint(ownedRequest,
    {...attributeArgs,expectedRevision:5}),error=>error.code==="aborted");
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
assert.equal((await ownedRoot.collection("recoveryArchives").doc("7").get()).exists,false);
assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("serverRevision"),6);
const assigned=await attributeAllocator.allocateAttributePoint(ownedRequest,attributeArgs);
assert.equal(assigned.allocatedRevision,7);
const assignedArchive=await checkRecoveryArchive(ownedUid,7);
assert.equal(assignedArchive.get("sourceRecords.inventory")[0].ownedItemId,ownedItemId);
assert.equal(assigned.statAfter,3);
assert.equal(assigned.pointsAfter,4);
const assignedState=(await ownedRoot.collection("characters")
    .doc(ownedCharacterId).get()).get("state");
assert.equal(assignedState.hp,200);
assert.equal(assignedState.sp,80);
assert.equal(assignedState.vitality,3);
assert.equal(assignedState.attributePoints,4);
assert.equal((await ownedItemRef.get()).get("serverRevision"),7);
assert.equal((await ownedEquipRef.get()).get("ownedItemId"),ownedItemId);
assert.equal((await ownedRelicRef.get()).get("serverRevision"),7);
assert.equal((await ownedRoot.collection("claimRecords").doc(ownedGrant).get())
    .get("serverRevision"),7);
assert.equal((await ownedRoot.collection("claimCheckpoints").doc("current").get())
    .get("claimCount"),1);
assert.equal((await ownedRoot.collection("ledgerEntries")
    .doc(attributeOperation).get()).get("amount"),-1);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("7").get())
    .get("readyForPublication"),false);
assert.equal((await attributeAllocator.allocateAttributePoint(ownedRequest,attributeArgs))
    .unchanged,true);
await assert.rejects(attributeAllocator.allocateAttributePoint(ownedRequest,{
    operationId:ownedCreditOperation,expectedRevision:7,stat:"vitality"}),
    error=>error.code==="failed-precondition");
// An operator-approved same-head repair advances the canonical revision while
// retaining unique claims, operation receipts and the immutable original.
const recoveryOperation="recover-current-owned-source-0001";
const recoveryArgs={operationId:recoveryOperation,expectedRevision:7};
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
    sourceRevision:7,ttlSeconds:120};
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
// Approval identity is required both when reissuing and when consuming it.
// Corrupt fixtures remain untouched and cannot advance the canonical revision.
const approvalTypeBefore=(await approvalRef.get()).data();
const approvalTypeEnvelope=(await db.doc(`users/${ownedUid}/saves/current`).get()).data();
for(const patch of [{schemaVersion:FieldValue.delete()},{schemaVersion:2},
    {kind:FieldValue.delete()},{kind:"canonical-current-recovery"}]){
    await approvalRef.update(patch);
    const corrupt=(await approvalRef.get()).data();
    await assert.rejects(approvalIssuer.issue({
        auth:{uid:"emulator-operator",token:{cloudSaveOperator:true}},data:approvalPayload
    }),error=>error.code==="data-loss");
    await assert.rejects(invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload),
        error=>["permission-denied","PERMISSION_DENIED"].includes(error.code));
    assert.deepEqual((await approvalRef.get()).data(),corrupt);
    assert.deepEqual((await db.doc(`users/${ownedUid}/saves/current`).get()).data(),approvalTypeEnvelope);
    assert.equal((await ownedRoot.collection("operations").doc(recoveryOperation).get()).exists,false);
    assert.equal((await ownedRoot.collection("recoveryAudits").doc(recoveryOperation).get()).exists,false);
    assert.equal((await ownedRoot.collection("playableSnapshots").doc("8").get()).exists,false);
    assert.equal((await ownedRoot.collection("recoveryArchives").doc("8").get()).exists,false);
    await approvalRef.set(approvalTypeBefore);
}
console.log("Recovery approval identity real Firestore PASS: missing/unsupported schema and kind refused by issuer and first restore without writes.");
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
await unexpectedClaim.set({schemaVersion:1,ownerUid:ownedUid,serverRevision:7,
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
assert.equal((await ownedRoot.collection("recoveryArchives").doc("8").get()).exists,false);
assert.equal((await ownedRoot.collection("operations").doc(recoveryOperation).get()).exists,false);
assert.equal((await approvalRef.get()).get("status"),"approved");
const recovered=await invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload);
assert.equal(recovered.restoredRevision,8);
assert.equal((await ownedItemRef.get()).get("serverRevision"),8);
assert.equal((await ownedRoot.collection("economy").doc("current").get()).get("gold"),originalGold);
assert.equal((await ownedRoot.collection("claimRecords").doc(ownedGrant).get())
    .get("serverRevision"),8);
assert.equal((await ownedRoot.collection("recoveryAudits").doc(recoveryOperation).get())
    .get("sourceRevision"),7);
assert.equal((await approvalRef.get()).get("status"),"used");
const recoveredOwnedArchive=await checkRecoveryArchive(ownedUid,8);
assert.deepEqual(recoveredOwnedArchive.get("sourceRecords.progress.playableState"),
    ownedRecords.progress.playableState);
assert.deepEqual(recoveredOwnedArchive.get("sourceRecords.progress.sidecars"),ownedRecords.progress.sidecars);
assert.deepEqual(recoveredOwnedArchive.get("sourceRecords.progress.abyssProgress"),ownedRecords.progress.abyssProgress);
assert.deepEqual((await ownedRoot.collection("progress").doc("current").get())
    .get("abyssProgress"),ownedRecords.progress.abyssProgress);
assert.equal(recoveredOwnedArchive.get("sourceRecords.progress.serverRevision"),8);
assert.deepEqual((await ownedRoot.collection("progress").doc("current").get())
    .get("playableState"),ownedRecords.progress.playableState);
assert.deepEqual((await ownedRoot.collection("progress").doc("current").get())
    .get("sidecars"),ownedRecords.progress.sidecars);
assert.equal((await recovery.restoreCurrent(ownedRequest,recoveryArgs)).unchanged,true);
assert.equal((await invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload))
    .unchanged,true);
// Retried recovery must prove the original approval, audit and restored archive,
// not merely an internally valid materialized snapshot. Emulator fixtures only.
const recoveryAuditRef=ownedRoot.collection("recoveryAudits").doc(recoveryOperation);
const recoveryReceiptRef=ownedRoot.collection("operations").doc(recoveryOperation);
const recoveryBefore=(await db.doc(`users/${ownedUid}/saves/current`).get()).data();
for(const [ref,patch] of [
    [recoveredOwnedArchive.ref,null],
    [recoveredOwnedArchive.ref,{"sourceRecords.economy.gold":999}],
    [recoveredOwnedArchive.ref,{readyForRestore:true}],
    [approvalRef,{kind:FieldValue.delete()}],
    [approvalRef,{kind:"canonical-current-recovery"}],
    [approvalRef,{ownerUid:"other-recovery-owner"}],
    [approvalRef,{sourceRevision:6}],
    [approvalRef,{sourceSha256:"a".repeat(64)}],
    [approvalRef,{snapshotSha256:"b".repeat(64)}],
    [approvalRef,{approvedBy:"other-operator"}],
    [recoveryAuditRef,{kind:"other-operation"}],
    [recoveryAuditRef,{sourceSha256:"a".repeat(64)}],
    [recoveryAuditRef,{approvedBy:"other-operator"}],
    [recoveryAuditRef,{authoritativeStateReady:true}],
    [recoveryReceiptRef,{authoritativeStateReady:true}]
]){
    const original=(await ref.get()).data();
    if(patch===null){await ref.delete();}else{await ref.update(patch);}
    await assert.rejects(invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload),
        error=>["data-loss","DATA_LOSS"].includes(error.code));
    assert.deepEqual((await db.doc(`users/${ownedUid}/saves/current`).get()).data(),recoveryBefore);
    if(patch===null){assert.equal((await ref.get()).exists,false);}
    await ref.set(original);
}
const usedApproval=(await approvalRef.get()).data();
await approvalRef.update({expiresAt:Timestamp.fromMillis(Date.now()-1000)});
assert.equal((await invoke("restoreCanonicalCurrent",ownedUser.idToken,recoveryPayload)).unchanged,true);
await approvalRef.set(usedApproval);
assert.equal((await recoveredOwnedArchive.ref.get()).get("readyForRestore"),false);
assert.equal((await db.doc(`users/${ownedUid}/saves/current`).get()).get("authoritativeStateReady"),false);
console.log("Recovery replay original evidence real Firestore PASS: missing/corrupt archive, approval/audit tampering refused; expired original replay retained without revision or authority changes.");
assert.equal((await goldWriter.creditReservedGrant(ownedRequest,{
    grantId:ownedGrant,operationId:ownedCreditOperation,expectedRevision:4}))
    .unchanged,true);
assert.equal((await attributeAllocator.allocateAttributePoint(ownedRequest,attributeArgs))
    .unchanged,true);
await assert.rejects(recovery.restoreCurrent(ownedRequest,{
    operationId:"recover-current-owned-source-0002",expectedRevision:7}),
    error=>error.code==="aborted");
// A server-priced purchase spends credited gold and creates one owned bag
// stack at the same canonical revision. Neither a browser price nor a balance
// is accepted; receipt replay cannot buy the item a second time.
const shop=createCanonicalShopPurchase({db,FieldValue,HttpsError,
    inspectExistingEnvelope,nextRevision,runProtected:writerSessions.runProtected});
const shopArgs={operationId:"shop-potion-owned-source-0001",expectedRevision:8,
    itemId:"hpPotion10",quantity:1};
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,itemId:"hpPotion50"}),
    error=>error.code==="invalid-argument");
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,quantity:1000}),
    error=>error.code==="invalid-argument");
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,quantity:2}),
    error=>error.code==="failed-precondition");
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,expectedRevision:7}),
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
assert.equal((await ownedRoot.collection("recoveryArchives").doc("9").get()).exists,false);
const purchased=await shop.purchase(ownedRequest,shopArgs);
assert.equal(purchased.purchasedRevision,9);
assert.equal(purchased.cost,20);
assert.equal((await shopEconomyRef.get()).get("gold"),originalGold-20);
assert.equal((await shopItemRef.get()).get("state.count"),1);
assert.equal((await ownedItemRef.get()).get("serverRevision"),9);
assert.equal((await ownedRoot.collection("claimRecords").doc(ownedGrant).get())
    .get("serverRevision"),9);
assert.equal((await ownedRoot.collection("ledgerEntries").doc(shopArgs.operationId).get())
    .get("amount"),-20);
assert.equal((await shop.purchase(ownedRequest,shopArgs)).unchanged,true);
assert.equal((await shopEconomyRef.get()).get("gold"),originalGold-20);
await assert.rejects(shop.purchase(ownedRequest,{...shopArgs,quantity:2}),
    error=>error.code==="data-loss");
await checkRecoveryArchive(ownedUid,9);
assert.equal((await ownedRoot.collection("playableSnapshots").doc("9").get())
    .get("readyForPublication"),false);
// Rehearse loss of every current canonical domain, not just one damaged value.
// Retained envelope, immutable snapshot/archive and operator approval survive.
// This is the existing single-character/current-revision lane, emulator only.
{
    const {source}=require("../functions/src/canonical-owned-sources.js");
    const archived=(await checkRecoveryArchive(ownedUid,9)).get("sourceRecords");
    const operationId="recover-all-current-sources-0001";
    const approval=ownedRoot.collection("recoveryApprovals").doc(operationId);
    const envelopeRef=db.doc(`users/${ownedUid}/saves/current`);
    const intent={operationId,expectedRevision:9};
    const singles={account:"account",economy:"economy",progress:"progress",
        relicLoadout:"relicLoadout",claimCheckpoint:"claimCheckpoints"};
    const sets={characters:row=>row.characterId,inventory:row=>row.ownedItemId,
        equipment:row=>`${row.characterId}_${row.slot}`,relics:row=>row.relicId,
        claimRecords:row=>row.claimKey};
    const documentMap=records=>new Map([
        ...Object.entries(singles).map(([name,collection])=>
            [`${ownedRoot.path}/${collection}/current`,records[name]]),
        ...Object.entries(sets).flatMap(([name,key])=>records[name].map(row=>
            [`${ownedRoot.path}/${name}/${key(row)}`,row]))
    ]);
    const dump=async()=>{
        const collections=await ownedRoot.listCollections();
        const queries=await Promise.all(collections.map(collection=>collection.get()));
        return new Map(queries.flatMap(query=>query.docs.map(doc=>[doc.ref.path,doc.data()]))
            .sort(([a],[b])=>a.localeCompare(b,"en")));
    };
    for(const name of Object.keys(sets))assert.ok(archived[name].length>0,name);
    const current=documentMap(archived);
    assert.equal(current.size,11);
    assert.equal(new Set([...current.keys()].map(path=>path.split("/").at(-2))).size,10);
    await approvalIssuer.issue({auth:{uid:"emulator-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:ownedUid,operationId,sourceRevision:9,ttlSeconds:900}});
    // Takeover legitimately changes private session records. Capture the loss
    // baseline afterwards so every restore assertion also protects those records.
    while(Math.floor(Date.now()/1000)<=claims(ownedUser.idToken).auth_time){
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    const device=await login("accounts:signInWithPassword",{
        email:"session-owned-sources@example.test",password});
    const session=await invoke("createGameSession",device.idToken,{uid:ownedUid});
    const request={auth:{uid:ownedUid,token:claims(device.idToken)},data:{uid:ownedUid,session}};
    const payload={uid:ownedUid,session,...intent};
    // Isolated retained reservation fixture: not credited, never synthesized by
    // recovery. Both recovery and the original reservation reader must preserve it.
    const reservedGrantId="rehearsal-reserved-grant-0001";
    const reservedOperationId="rehearsal-reserved-operation-0001";
    const reservedGrantRef=ownedRoot.collection("pendingGrants").doc(reservedGrantId);
    const reservedReceiptRef=ownedRoot.collection("grantOperations").doc(reservedOperationId);
    const reservedStamp=Timestamp.fromMillis(Date.now());
    await reservedGrantRef.set({schemaVersion:1,ownerUid:ownedUid,source:"server-event",
        kind:"exp",amount:30,status:"reserved",claimedByOperationId:reservedOperationId,createdAt:reservedStamp});
    await reservedReceiptRef.set({schemaVersion:1,ownerUid:ownedUid,grantId:reservedGrantId,
        operationId:reservedOperationId,kind:"exp",amount:30,serverRevision:8,
        creditedToCharacter:false,createdAt:reservedStamp});
    // Issue an actual pending grant through the original Owner before source
    // loss. Recovery must retain it without reserving or crediting its value.
    const pendingIssuer=createDailyCheckinGrant({db,FieldValue,HttpsError,inspectExistingEnvelope,
        runProtected:writerSessions.runProtected,now:()=>Date.parse("2026-10-18T12:00:00Z")});
    const pendingIssue=await pendingIssuer.issue(request);
    assert.equal(pendingIssue.status,"pending");
    const pendingRef=ownedRoot.collection("pendingGrants").doc(pendingIssue.grantId);
    const pendingEventRef=ownedRoot.collection("rewardEvents").doc(pendingIssue.grantId);
    const before=await dump(),envelopeBefore=(await envelopeRef.get()).data();
    for(const [path,row] of current)assert.deepEqual(source(before.get(path)),row,path);
    const erase=db.batch();for(const path of current.keys())erase.delete(db.doc(path));
    await erase.commit();
    const damaged=await dump();
    for(const path of current.keys())assert.equal(damaged.has(path),false,path);
    assert.equal(damaged.size,before.size-current.size);
    await rejected("restoreCanonicalCurrent",ownedUser.idToken,
        {uid:ownedUid,session:ownedSession,...intent},"SESSION_REVOKED");
    assert.deepEqual(await dump(),damaged);

    // Unknown claim rights cannot be hidden by restoring the retained archive.
    const unknown=ownedRoot.collection("claimRecords").doc("rehearsal-unknown-claim");
    await unknown.set({schemaVersion:1,ownerUid:ownedUid,serverRevision:9,
        provenance:"server-created",claimKey:unknown.id,status:"claimed"});
    const withUnknown=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),withUnknown);
    await unknown.delete();

    // Canonical claimRecords are gone; independent once-only rights and their
    // original credit proof still have to agree before any repair writes.
    const independentClaim=ownedRoot.collection("uniqueClaims").doc("rehearsal-later-independent-claim");
    await independentClaim.set({schemaVersion:1,ownerUid:ownedUid,
        grantId:independentClaim.id,operationId:"rehearsal-later-credit-0001",creditRevision:11});
    const withIndependent=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),withIndependent);
    await independentClaim.delete();
    const retainedClaim=archived.claimRecords.find(row=>row.grantId===ownedGrant);
    assert.ok(retainedClaim,"Rehearsal must contain an original credited grant");
    const creditProof=[
        ownedRoot.collection("uniqueClaims").doc(ownedGrant),
        ownedRoot.collection("pendingGrants").doc(ownedGrant),
        ownedRoot.collection("grantOperations").doc(retainedClaim.operationId),
        ownedRoot.collection("ledgerEntries").doc(retainedClaim.operationId)
    ];
    for(const ref of creditProof){
        const original=(await ref.get()).data();assert.ok(original);
        await ref.delete();const missingProof=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),missingProof);
        await ref.set(original);
    }
    const ledger=creditProof[3],originalLedger=(await ledger.get()).data();
    await ledger.update({balanceAfter:originalLedger.balanceAfter+1});
    const badLedger=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),badLedger);await ledger.set(originalLedger);
    assert.deepEqual(await dump(),damaged);
    console.log("Current recovery independent credit reconciliation real Firestore PASS: later unique claim, missing retained claim/grant/receipt/ledger and corrupt delta refuse without writes; original history remains exact.");

    const orphanReceipt=ownedRoot.collection("grantOperations").doc("rehearsal-orphaned-credit-0001");
    const originalCredit=(await creditProof[2].get()).data();
    await orphanReceipt.set({...originalCredit,operationId:orphanReceipt.id,
        grantId:"rehearsal-orphaned-grant-0001",serverRevision:10,creditRevision:11});
    const withOrphanReceipt=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),withOrphanReceipt);await orphanReceipt.delete();
    const reservedReceipt=(await reservedReceiptRef.get()).data();
    for(const patch of [{creditedToCharacter:"false"},{serverRevision:11},{ownerUid:"foreign-owner"}]){
        await reservedReceiptRef.update(patch);const badReservation=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),badReservation);await reservedReceiptRef.set(reservedReceipt);
    }
    assert.deepEqual(await dump(),damaged);
    console.log("Current recovery receipt inventory real Firestore PASS: unmatched credited receipt and unknown/future/foreign reservation refuse without writes; valid uncredited reservation remains retained.");

    // A surviving ledger is independent evidence even if its later receipt and
    // claim index are both gone. Existing purchase/EXP debits remain supported.
    const orphanLedger=ownedRoot.collection("ledgerEntries").doc("rehearsal-orphaned-ledger-0001");
    await orphanLedger.set({...originalLedger,operationId:orphanLedger.id,
        grantId:"rehearsal-orphaned-grant-0001",creditRevision:11});
    const withOrphanLedger=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),withOrphanLedger);await orphanLedger.delete();
    for(const id of [shopArgs.operationId,ownedAllocation,attributeOperation]){
        const debitRef=ownedRoot.collection("operations").doc(id);
        const debitLedgerRef=ownedRoot.collection("ledgerEntries").doc(id);
        const debit=(await debitRef.get()).data(),debitLedger=(await debitLedgerRef.get()).data();
        assert.ok(debit);assert.ok(debitLedger);
        // Reverse reconciliation: retaining only the original debit receipt
        // must not make the missing ledger invisible to approved source repair.
        await debitLedgerRef.delete();const missingDebitLedger=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),missingDebitLedger);await debitLedgerRef.set(debitLedger);
        await debitRef.delete();const missingDebit=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),missingDebit);await debitRef.set(debit);
        const field=debit.kind==="shop-purchase"?"purchasedRevision":"allocatedRevision";
        await debitRef.update({[field]:11});const laterDebit=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),laterDebit);await debitRef.set(debit);
        await debitLedgerRef.update({amount:debitLedger.amount-1});const corruptDebit=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),corruptDebit);await debitLedgerRef.set(debitLedger);
    }
    assert.deepEqual(await dump(),damaged);
    console.log("Current recovery ledger inventory real Firestore PASS: orphan ledger and missing/later/corrupt debit proof refuse without writes; original purchase/EXP/attribute ledger history retained for approved restore.");
    console.log("Current recovery debit-receipt inventory real Firestore PASS: original purchase/EXP/attribute receipts with lost ledgers refuse without writes; retained receipt/ledger bytes remain exact.");

    // Current-source loss cannot hide unsupported or malformed retained operations.
    const unknownOperation=ownedRoot.collection("operations").doc("rehearsal-unknown-operation-0001");
    for(const kind of ["unknown-operation","battle-source-preparation","restricted-battle-round",null]){
        const row={schemaVersion:1,ownerUid:ownedUid,operationId:unknownOperation.id,sourceRevision:9};
        if(kind!==null)row.kind=kind;
        await unknownOperation.set(row);const unsupported=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"FAILED_PRECONDITION");
        assert.deepEqual(await dump(),unsupported);
        assert.deepEqual((await envelopeRef.get()).data(),envelopeBefore);
        await unknownOperation.delete();
    }
    const initialReceiptRef=ownedRoot.collection("operations").doc(ownedOperation);
    const initialReceipt=(await initialReceiptRef.get()).data();
    for(const patch of [{schemaVersion:2},{ownerUid:"foreign-owner"},
        {operationId:"rehearsal-mismatched-operation-0001"},{sourceRevision:FieldValue.delete()}]){
        await initialReceiptRef.update(patch);const malformed=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),malformed);
        assert.deepEqual((await envelopeRef.get()).data(),envelopeBefore);
        await initialReceiptRef.set(initialReceipt);
    }
    assert.deepEqual(await dump(),damaged);
    console.log("Current recovery operation inventory real Firestore PASS: unknown/missing/frozen kinds and malformed initial receipts refuse without writes; immutable original creation proof retained.");

    const orphanGrant=ownedRoot.collection("pendingGrants").doc("rehearsal-orphaned-grant-0001");
    const originalGrant=(await creditProof[1].get()).data();
    for(const status of ["reserved","credited","unknown"]){
        await orphanGrant.set({...originalGrant,status,claimedByOperationId:"rehearsal-missing-receipt-0001"});
        const orphaned=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),orphaned);await orphanGrant.delete();
    }
    const pendingOriginal=(await pendingRef.get()).data(),eventOriginal=(await pendingEventRef.get()).data();
    for(const patch of [{amount:999},{ownerUid:"foreign-owner"},{claimedByOperationId:"unresolved-operation-0001"}]){
        await pendingRef.update(patch);const corrupt=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),corrupt);await pendingRef.set(pendingOriginal);
    }
    await pendingEventRef.delete();const missingPendingProof=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"FAILED_PRECONDITION");
    assert.deepEqual(await dump(),missingPendingProof);await pendingEventRef.set(eventOriginal);
    assert.deepEqual(await dump(),damaged);
    console.log("Current recovery pending-grant inventory real Firestore PASS: orphan consumed grants and corrupt/missing pending event evidence refuse without writes; original pending right remains unconsumed.");

    // The original event remains independent when its grant is lost. Refuse
    // instead of ignoring it or allowing the issuer to recreate missing rights.
    await pendingRef.delete();const orphanEvent=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),orphanEvent);await pendingRef.set(pendingOriginal);
    const unsupportedEvent=ownedRoot.collection("rewardEvents").doc(ownedGrant);
    await unsupportedEvent.set({...eventOriginal,eventId:ownedGrant,eventType:"unsupported-reward"});
    const unknownEvent=await dump();
    await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
    assert.deepEqual(await dump(),unknownEvent);await unsupportedEvent.delete();
    for(const patch of [{ownerUid:"foreign-owner"},{sha256:"a".repeat(64)}]){
        await pendingEventRef.update(patch);const corruptEvent=await dump();
        await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
        assert.deepEqual(await dump(),corruptEvent);await pendingEventRef.set(eventOriginal);
    }
    assert.deepEqual(await dump(),damaged);
    console.log("Current recovery reward-event inventory real Firestore PASS: orphan event, unsupported same-ID observation and foreign/corrupt source evidence refuse without writes; original event and pending right retained.");

    // A stale/damaged envelope must not authorize overwriting surviving newer
    // sources. Missing revision evidence is equally unreconciled. Emulator only.
    for(const [path,row] of current){
        for(const revision of [11,null]){
            const surviving={...row,serverRevision:revision};
            if(revision===null)delete surviving.serverRevision;
            await db.doc(path).set(surviving);
            const withSurvivor=await dump();
            await rejected("restoreCanonicalCurrent",device.idToken,payload,"DATA_LOSS");
            assert.deepEqual(await dump(),withSurvivor);
            assert.deepEqual((await envelopeRef.get()).data(),envelopeBefore);
            await db.doc(path).delete();
        }
    }
    assert.deepEqual(await dump(),damaged);
    console.log(`Current recovery surviving-revision fence real Firestore PASS: ${current.size} known documents; newer and missing revisions refuse without writes, approval consumption or history changes.`);

    const rollback=createCanonicalCurrentRecovery({db,FieldValue,HttpsError,
        inspectExistingEnvelope,nextRevision,
        runProtected:(input,operation)=>writerSessions.runProtected(input,async(tx,active)=>{
            await operation(tx,active);throw new Error("rehearsal rollback after all writes");
        })});
    await assert.rejects(rollback.restoreCurrent(request,intent),/rehearsal rollback/);
    assert.deepEqual(await dump(),damaged);
    assert.deepEqual((await envelopeRef.get()).data(),envelopeBefore);

    // Intentionally discard the first response, then resolve the same intent.
    await invoke("restoreCanonicalCurrent",device.idToken,payload);
    const committed=await dump(),committedEnvelope=(await envelopeRef.get()).data();
    assert.deepEqual(await invoke("restoreCanonicalCurrent",device.idToken,payload),
        {restoredRevision:10,unchanged:true,authoritativeStateReady:false});
    assert.deepEqual(await dump(),committed);
    assert.deepEqual((await envelopeRef.get()).data(),committedEnvelope);
    const expected=structuredClone(archived);
    for(const rows of Object.values(expected)){
        for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=10;
    }
    expected.claimCheckpoint.claimDigest=claimRecordsDigest(expected.claimRecords);
    for(const [path,row] of documentMap(expected))assert.deepEqual(source(committed.get(path)),row,path);
    for(const [path,row] of before){
        if(!current.has(path)&&path!==approval.path)assert.deepEqual(committed.get(path),row,path);
    }
    const added=["operations/","recoveryAudits/"].map(path=>`${ownedRoot.path}/${path}${operationId}`)
        .concat([`${ownedRoot.path}/playableSnapshots/10`,`${ownedRoot.path}/recoveryArchives/10`]).sort();
    assert.deepEqual([...committed.keys()].filter(path=>!before.has(path)).sort(),added);
    assert.equal(committed.size,before.size+4);
    const restoredArchive=await checkRecoveryArchive(ownedUid,10);
    assert.deepEqual(restoredArchive.get("sourceRecords"),expected);
    assert.equal(restoredArchive.get("snapshotSha256"),assembleCanonicalSnapshot(ownedUid,10,expected).sha256);
    assert.equal(committedEnvelope.serverRevision,10);
    assert.equal(committedEnvelope.authoritativeStateReady,false);
    assert.equal(committed.get(approval.path).status,"used");
    assert.equal(committed.get(approval.path).usedRevision,10);
    assert.equal((await shop.purchase(request,shopArgs)).unchanged,true);
    assert.equal((await goldWriter.creditReservedGrant(request,{
        grantId:ownedGrant,operationId:ownedCreditOperation,expectedRevision:4})).unchanged,true);
    const reservedRetry=await invoke("reserveTrustedGrant",device.idToken,{uid:ownedUid,session,
        grantId:reservedGrantId,operationId:reservedOperationId,expectedRevision:8});
    assert.equal(reservedRetry.unchanged,true);assert.equal(reservedRetry.creditedToCharacter,false);
    const pendingRetry=await pendingIssuer.issue(request);
    assert.equal(pendingRetry.unchanged,true);assert.equal(pendingRetry.status,"pending");
    assert.deepEqual((await pendingRef.get()).data(),pendingOriginal);
    assert.deepEqual((await pendingEventRef.get()).data(),eventOriginal);
    assert.deepEqual(await dump(),committed);
    assert.deepEqual((await envelopeRef.get()).data(),committedEnvelope);
    for(const [path,row] of ownedInitialEvidence)assert.deepEqual((await db.doc(path).get()).data(),row,path);
    // Original completion stays read-only even after unsupported later history.
    await unknownOperation.set({schemaVersion:1,ownerUid:ownedUid,
        operationId:unknownOperation.id,kind:"unknown-operation",sourceRevision:11});
    const laterHistory=await dump();
    assert.deepEqual(await invoke("restoreCanonicalCurrent",device.idToken,payload),
        {restoredRevision:10,unchanged:true,authoritativeStateReady:false});
    assert.deepEqual(await dump(),laterHistory);
    assert.deepEqual((await envelopeRef.get()).data(),committedEnvelope);
    await unknownOperation.delete();assert.deepEqual(await dump(),committed);
    console.log(`Current recovery full-source-loss rehearsal real Firestore PASS: ${current.size} documents / 10 domains; rollback, unknown claim and old-session refusal, new-session HTTP restore, discarded-response replay, exact source/archive parity and immutable receipt/ledger/claim history. Readiness remains false; not historical/disaster/second-phone acceptance.`);
}
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
// Actual Firestore transactions and exported acquisition Callable boundaries. A new
// disposable account avoids changing any existing canonical/source fixtures.
const heroEmail="hero-acquisition-emulator@example.test";
const heroUser=await login("accounts:signUp",{email:heroEmail,password});
const heroUid=heroUser.localId;
const heroSession=await invoke("createGameSession",heroUser.idToken,{uid:heroUid});
await invoke("bootstrapCloudSave",heroUser.idToken,{uid:heroUid,session:heroSession});
const heroSessions=createSessionAuthority({db,FieldValue,HttpsError});
let heroClock=Date.now();
const heroOwner=createHeroAcquisition({db,FieldValue,HttpsError,
    runProtected:heroSessions.runProtected,inspectExistingEnvelope,nextRevision,
    now:()=>heroClock,seed:()=>20261012});
const heroRequest=(user,session,extra={})=>({auth:{uid:heroUid,token:claims(user.idToken)},
    data:{uid:heroUid,session,...extra}});
const heroRoot=db.collection("serverUsers").doc(heroUid);
const heroEnvelope=db.doc(`users/${heroUid}/saves/current`);
assert.equal((await invoke("readHeroAcquisition",heroUser.idToken,
    {uid:heroUid,session:heroSession})).loginCount,0);
await rejected("observeHeroLogin",heroUser.idToken,
    {uid:heroUid,session:heroSession,expectedRevision:1,loginCount:7},"INVALID_ARGUMENT");
await rejected("observeHeroLogin",heroUser.idToken,
    {uid:heroUid,session:heroSession,expectedRevision:1,date:"20261018"},"INVALID_ARGUMENT");
const heroConcurrent=await Promise.all([
    heroOwner.observeLogin(heroRequest(heroUser,heroSession,{expectedRevision:1})),
    heroOwner.observeLogin(heroRequest(heroUser,heroSession,{expectedRevision:1}))]);
assert.deepEqual(heroConcurrent.map(r=>r.unchanged).sort(),[false,true]);
assert.equal((await heroEnvelope.get()).get("serverRevision"),2);
for(let day=2;day<=7;day++){
    heroClock+=3*86400000; // cumulative, never a consecutive-login streak.
    await assert.rejects(heroOwner.observeLogin(heroRequest(heroUser,heroSession,
        {expectedRevision:1})),error=>error.code==="aborted");
    const observation=await heroOwner.observeLogin(heroRequest(heroUser,heroSession,
        {expectedRevision:day}));
    assert.equal(observation.loginCount,day);
}
assert.equal((await heroRoot.collection("uniqueClaims").get()).size,1);
assert.equal((await heroRoot.collection("heroAcquisitionHistory").get()).size,7);
assert.equal((await heroRoot.collection("operations").get()).size,7);
assert.equal((await heroRoot.collection("ledgerEntries").get()).size,7);
const acquired=(await heroOwner.read(heroRequest(heroUser,heroSession))).entitlements;
assert.equal(acquired.vajraHeavenlyKing.allocationSeed,20261012);
assert.equal((await heroOwner.observeLogin(heroRequest(heroUser,heroSession,
    {expectedRevision:1}))).unchanged,true); // lost-response retry.
assert.equal((await invoke("observeHeroLogin",heroUser.idToken,
    {uid:heroUid,session:heroSession,expectedRevision:1})).unchanged,true);
while(Math.floor(Date.now()/1000)<=claims(heroUser.idToken).auth_time){
    await new Promise(resolve=>setTimeout(resolve,100));
}
const heroOtherDevice=await login("accounts:signInWithPassword",{email:heroEmail,password});
const heroOtherSession=await invoke("createGameSession",heroOtherDevice.idToken,{uid:heroUid});
await assert.rejects(heroOwner.read(heroRequest(heroUser,heroSession)),
    error=>error.message==="SESSION_REVOKED");
await rejected("readHeroAcquisition",heroUser.idToken,
    {uid:heroUid,session:heroSession},"SESSION_REVOKED");
assert.deepEqual((await heroOwner.read(heroRequest(heroOtherDevice,heroOtherSession))).entitlements,acquired);
assert.deepEqual((await invoke("readHeroAcquisition",heroOtherDevice.idToken,
    {uid:heroUid,session:heroOtherSession})).entitlements,acquired);
await assert.rejects(heroOwner.observeLogin(heroRequest(heroOtherDevice,heroOtherSession,
    {expectedRevision:8,save:{heroAccount:{}}})),error=>error.code==="invalid-argument");
assert.equal(await rulesRequest(`serverUsers/${heroUid}/heroAcquisition/current`,heroOtherDevice.idToken),403);
assert.equal(await rulesRequest(`serverUsers/${heroUid}/uniqueClaims/hero-v1-vajraHeavenlyKing`,heroOtherDevice.idToken,"PATCH"),403);
const heroClaim=heroRoot.collection("uniqueClaims").doc("hero-v1-vajraHeavenlyKing");
await heroClaim.delete(); // emulator-only corruption; production never deletes a claim.
const blockedHeroEnvelope=(await heroEnvelope.get()).get("serverRevision");
await assert.rejects(heroOwner.observeLogin(heroRequest(heroOtherDevice,heroOtherSession,
    {expectedRevision:8})),error=>error.code==="data-loss");
assert.equal((await heroEnvelope.get()).get("serverRevision"),blockedHeroEnvelope);
assert.equal((await heroClaim.get()).exists,false);
const storyEmail="hero-chapter-emulator@example.test";
const storyUser=await login("accounts:signUp",{email:storyEmail,password}),storyUid=storyUser.localId;
const storySession=await invoke("createGameSession",storyUser.idToken,{uid:storyUid});
await invoke("bootstrapCloudSave",storyUser.idToken,{uid:storyUid,session:storySession});
const storyData={uid:storyUid,session:storySession};
let storyProof=await invoke("ensureHeroChapterTicket",storyUser.idToken,{...storyData,expectedRevision:1});
const storyTicket=storyProof.chapter.ticketId;
await rejected("completeHeroChapterNode",storyUser.idToken,{...storyData,
    expectedRevision:storyProof.serverRevision,ticketId:storyTicket,nodeId:"n10_finish",choiceId:null},"FAILED_PRECONDITION");
await rejected("completeHeroChapterNode",storyUser.idToken,{...storyData,
    expectedRevision:storyProof.serverRevision,ticketId:storyTicket,nodeId:"n01_arrival",choiceId:null,won:true},"INVALID_ARGUMENT");
await rejected("completeHeroChapterNode",heroOtherDevice.idToken,{uid:heroUid,session:heroOtherSession,
    expectedRevision:8,ticketId:storyTicket,nodeId:"n01_arrival",choiceId:null},"DATA_LOSS"); // corrupt own rights; no other-UID source is read.
const firstStep={...storyData,expectedRevision:storyProof.serverRevision,
    ticketId:storyTicket,nodeId:"n01_arrival",choiceId:null};
const concurrentStep=await Promise.all([
    invoke("completeHeroChapterNode",storyUser.idToken,firstStep),
    invoke("completeHeroChapterNode",storyUser.idToken,firstStep)]);
assert.deepEqual(concurrentStep.map(r=>r.unchanged).sort(),[false,true]);
storyProof=concurrentStep.find(r=>!r.unchanged);
for(const nodeId of ["n02_roadfight","n03_fork","n04a_path","n05_commission","n06_rest",
    "n07_chest","n08_truth","n09_boss","n10_finish"]){
    storyProof=await invoke("completeHeroChapterNode",storyUser.idToken,{...storyData,
        expectedRevision:storyProof.serverRevision,ticketId:storyTicket,nodeId,
        choiceId:nodeId==="n03_fork"?"safe":null});
}
assert.equal(storyProof.chapter.phase,"completed");assert.equal(storyProof.chapter.outcomeVerified,false);
assert.equal(storyProof.authoritativeStateReady,false);
const storyRoot=db.collection("serverUsers").doc(storyUid);
assert.equal((await storyRoot.collection("uniqueClaims").get()).size,1);
assert.equal((await storyRoot.collection("heroChapterSteps").get()).size,10);
const storyClaim=await storyRoot.collection("uniqueClaims").doc("hero-v1-divineDogHongbao").get();
const storyGrant=storyProof.entitlements.divineDogHongbao;
assert.equal(storyClaim.get("allocationSeed"),storyGrant.allocationSeed);
assert.equal((await invoke("completeHeroChapterNode",storyUser.idToken,{...storyData,
    expectedRevision:1,ticketId:storyTicket,nodeId:"n10_finish",choiceId:null})).unchanged,true);
while(Math.floor(Date.now()/1000)<=claims(storyUser.idToken).auth_time){await new Promise(resolve=>setTimeout(resolve,100));}
const storyOther=await login("accounts:signInWithPassword",{email:storyEmail,password});
const storyOtherSession=await invoke("createGameSession",storyOther.idToken,{uid:storyUid});
await rejected("readHeroAcquisition",storyUser.idToken,storyData,"SESSION_REVOKED");
assert.deepEqual((await invoke("readHeroAcquisition",storyOther.idToken,
    {uid:storyUid,session:storyOtherSession})).entitlements.divineDogHongbao,storyGrant);
await rejected("completeHeroChapterNode",storyOther.idToken,{uid:storyUid,session:storyOtherSession,
    expectedRevision:1,ticketId:storyTicket,nodeId:"n10_finish",choiceId:null,save:{chapterCompleted:true}},"INVALID_ARGUMENT");
assert.equal((await storyRoot.collection("uniqueClaims").get()).size,1);
assert.equal(await rulesRequest(`serverUsers/${storyUid}/heroChapter/current`,storyOther.idToken),403);
assert.equal(await rulesRequest(`serverUsers/${storyUid}/heroChapterTickets/${storyTicket}`,storyOther.idToken,"PATCH"),403);
console.log("PASS Hero acquisition protected Firestore/HTTP: cumulative days, concurrent day/node intents, legal chapter route, permanent stable-seed rights, lost/stale retry, takeover, private rules and corruption rejection; ordinary battle outcomes remain unverified.");
console.log(`PASS (${direct?"direct exported handlers":"HTTP callable"}): A SUCCESS -> B takeover -> A SESSION_REVOKED -> B SUCCESS; logout, UID isolation, tampering, private rules, protected writers, concurrent takeover/write ordering, revoked/disabled Firebase identity.`);
// Disposable emulator-only resources. No production grant surface is added.
const growthUser=await login("accounts:signUp",{email:"hero-growth-emulator@example.test",password});
const growthUid=growthUser.localId,growthRoot=db.collection("serverUsers").doc(growthUid);
const growthSession=await invoke("createGameSession",growthUser.idToken,{uid:growthUid});
await invoke("bootstrapCloudSave",growthUser.idToken,{uid:growthUid,session:growthSession});
const growthRecords=makeInitialCharacterSources(growthUid,2,"growth-emulator-initial",{
    displayName:"成長測試",element:"fire",gender:"female",attributes:{attack:3,vitality:2,
        energy:1,intelligence:2,defensePoints:1,agility:1}},{recordedAt:Date.now()});
const growthId="divineDogHongbao";
growthRecords.progress.playableState.heroAccount.heroes[growthId].specificFragments=500;
growthRecords.inventory.push({schemaVersion:1,ownerUid:growthUid,serverRevision:2,
    provenance:"server-created",ownedItemId:"growth-emulator-marrow",location:"bag",
    state:{id:"heroMarrowPill",type:"material",count:2}});
const growthBundle=assembleCanonicalSnapshot(growthUid,2,growthRecords),growthBatch=db.batch();
for(const name of ["account","economy","progress","relicLoadout","claimCheckpoint"]){
    growthBatch.set(growthRoot.collection(name==="claimCheckpoint"?"claimCheckpoints":name).doc("current"),
        {...growthRecords[name],...(name==="account"?{snapshotSha256:growthBundle.sha256}:{})});
}
for(const name of ["characters","inventory"]){for(const row of growthRecords[name]){
    growthBatch.set(growthRoot.collection(name).doc(row.characterId||row.ownedItemId),row);
}}
growthBatch.set(growthRoot.collection("playableSnapshots").doc("2"),growthBundle);
growthBatch.set(growthRoot.collection("recoveryArchives").doc("2"),createRecoveryArchive(growthUid,2,growthRecords,growthBundle));
growthBatch.update(db.doc(`users/${growthUid}/saves/current`),{serverRevision:2});await growthBatch.commit();
const growthIdentity={uid:growthUid,session:growthSession};
assert.equal((await invoke("readHeroGrowth",growthUser.idToken,growthIdentity)).marrowPills,2);
const growthUnlock={...growthIdentity,expectedRevision:2,heroId:growthId,action:"unlock",operationId:"growth-emulator-unlock"};
const growthFirst=await invoke("mutateHeroGrowth",growthUser.idToken,growthUnlock);
assert.equal(growthFirst.heroAccount.heroes[growthId].specificFragments,400);
assert.deepEqual((await invoke("mutateHeroGrowth",growthUser.idToken,growthUnlock)).receipt,growthFirst.receipt);
const growthStar={...growthIdentity,expectedRevision:3,heroId:growthId,action:"starUp",operationId:"growth-emulator-star-1"};
const growthRace=await Promise.allSettled([
    invoke("mutateHeroGrowth",growthUser.idToken,growthStar),
    invoke("mutateHeroGrowth",growthUser.idToken,{...growthStar,operationId:"growth-emulator-star-2"})]);
assert.equal(growthRace.filter(result=>result.status==="fulfilled").length,1);
assert.equal(growthRace.filter(result=>result.status==="rejected").length,1);
const growthReroll={...growthIdentity,expectedRevision:4,heroId:growthId,action:"reroll",operationId:"growth-emulator-reroll"};
const growthRolled=await invoke("mutateHeroGrowth",growthUser.idToken,growthReroll);
assert.equal(growthRolled.marrowPills,1);assert.equal(growthRolled.heroAccount.heroes[growthId].stars,1);
assert.deepEqual((await invoke("mutateHeroGrowth",growthUser.idToken,growthReroll)).receipt,growthRolled.receipt);
await checkRecoveryArchive(growthUid,5);
await rejected("mutateHeroGrowth",growthUser.idToken,{...growthReroll,amount:10},"INVALID_ARGUMENT");
await rejected("mutateHeroGrowth",growthUser.idToken,{...growthReroll,action:"starUp"},"DATA_LOSS");
assert.equal(await rulesRequest(`serverUsers/${growthUid}/progress/current`,growthUser.idToken,"PATCH"),403);
assert.equal(await rulesRequest(`serverUsers/${growthUid}/operations/growth-emulator-reroll`,growthUser.idToken),403);
const growthLedger=growthRoot.collection("ledgerEntries").doc("growth-emulator-reroll");
const growthLedgerBytes=(await growthLedger.get()).data();await growthLedger.delete();
await rejected("mutateHeroGrowth",growthUser.idToken,growthReroll,"DATA_LOSS");
await growthLedger.set(growthLedgerBytes);
// Same real protected transport, canonical source, snapshot and archive Owners.
// This writes a bounded loadout only; no battle simulation or resource grant.
const formationIntent={...growthIdentity,expectedRevision:5,operationId:"formation-emulator-save-0001",
    formation:{version:2,characterIndexToSlot:{0:"ALLY_F2"},heroIdToSlot:{[growthId]:"ALLY_B2"}}};
const formationFirst=await invoke("saveTeamFormation",growthUser.idToken,formationIntent);
assert.deepEqual(formationFirst.formation,formationIntent.formation);
assert.deepEqual((await invoke("readTeamFormation",growthUser.idToken,growthIdentity)).formation,formationIntent.formation);
await checkRecoveryArchive(growthUid,6);
await rejected("saveTeamFormation",growthUser.idToken,{...formationIntent,operationId:"formation-emulator-invalid1",expectedRevision:6,
    formation:{...formationIntent.formation,heroIdToSlot:{[growthId]:"ALLY_F2"}}},"INVALID_ARGUMENT");
await rejected("saveTeamFormation",growthUser.idToken,{...formationIntent,operationId:"formation-emulator-unowned1",expectedRevision:6,
    formation:{...formationIntent.formation,heroIdToSlot:{vajraHeavenlyKing:"ALLY_B2"}}},"INVALID_ARGUMENT");
const swapFormation={version:2,characterIndexToSlot:{0:"ALLY_B2"},heroIdToSlot:{[growthId]:"ALLY_F2"}};
const formationRace=await Promise.allSettled([
    invoke("saveTeamFormation",growthUser.idToken,{...formationIntent,expectedRevision:6,operationId:"formation-emulator-race-0001",formation:swapFormation}),
    invoke("saveTeamFormation",growthUser.idToken,{...formationIntent,expectedRevision:6,operationId:"formation-emulator-race-0002",formation:swapFormation})]);
assert.equal(formationRace.filter(row=>row.status==="fulfilled").length,1);
assert.equal(formationRace.filter(row=>row.status==="rejected").length,1);
assert.deepEqual((await invoke("saveTeamFormation",growthUser.idToken,formationIntent)).receipt,formationFirst.receipt);
const formationLedger=growthRoot.collection("ledgerEntries").doc(formationIntent.operationId),formationLedgerBytes=(await formationLedger.get()).data();
await formationLedger.delete();await rejected("saveTeamFormation",growthUser.idToken,formationIntent,"DATA_LOSS");
await formationLedger.set(formationLedgerBytes);
assert.equal(await rulesRequest(`serverUsers/${growthUid}/account/current`,growthUser.idToken,"PATCH"),403);
assert.equal(await rulesRequest(`serverUsers/${growthUid}/operations/${formationIntent.operationId}`,growthUser.idToken),403);
while(Math.floor(Date.now()/1000)<=claims(growthUser.idToken).auth_time){await new Promise(resolve=>setTimeout(resolve,100));}
const formationOtherDevice=await login("accounts:signInWithPassword",{email:"hero-growth-emulator@example.test",password});
const formationOtherSession=await invoke("createGameSession",formationOtherDevice.idToken,{uid:growthUid});
await rejected("readTeamFormation",growthUser.idToken,growthIdentity,"SESSION_REVOKED");
assert.deepEqual((await invoke("readTeamFormation",formationOtherDevice.idToken,{uid:growthUid,session:formationOtherSession})).formation,swapFormation);
const removedFormation={...swapFormation,heroIdToSlot:{}};
await invoke("saveTeamFormation",formationOtherDevice.idToken,{uid:growthUid,session:formationOtherSession,expectedRevision:7,
    operationId:"formation-emulator-remove-01",formation:removedFormation});
await checkRecoveryArchive(growthUid,8);
await invoke("revokeGameSession",formationOtherDevice.idToken,{uid:growthUid,session:formationOtherSession});
console.log("PASS Team formation real Firestore/HTTP: stable IDs, slot exchange/removal, reload/read, latest revision/concurrency, immutable retry, archive/ledger, private rules, old-device rejection and new-device restore.");

await rejected("readHeroGrowth",growthUser.idToken,growthIdentity,"SESSION_REVOKED");
console.log("PASS Hero growth real Firestore/HTTP: original Core costs, fragment unlock/star/reroll, one concurrent spend, immutable retry, archive, malformed intents, missing ledger, private rules, revoked session. Resources are emulator-only fixtures.");
// Same source validation/active session and HTTP boundary as production; resources
// are earned from seven observed dates, never seeded into this fixture's inventory.
const loginRewardEmail="hero-login-reward-emulator@example.test";
const loginRewardUser=await login("accounts:signUp",{email:loginRewardEmail,password});
const loginRewardUid=loginRewardUser.localId;
const loginRewardSession=await invoke("createGameSession",loginRewardUser.idToken,{uid:loginRewardUid});
const loginRewardIdentity={uid:loginRewardUid,session:loginRewardSession};
await invoke("bootstrapCloudSave",loginRewardUser.idToken,loginRewardIdentity);
const loginRewardRoot=db.collection("serverUsers").doc(loginRewardUid);
const loginRewardRecords=makeInitialCharacterSources(loginRewardUid,2,"login-reward-initial",{
    displayName:"登入獎勵測試",element:"fire",gender:"female",attributes:{attack:3,vitality:2,
        energy:1,intelligence:2,defensePoints:1,agility:1}},{recordedAt:Date.now()});
const loginRewardBundle=assembleCanonicalSnapshot(loginRewardUid,2,loginRewardRecords),loginRewardBatch=db.batch();
for(const name of ["account","economy","progress","relicLoadout","claimCheckpoint"]){
    loginRewardBatch.set(loginRewardRoot.collection(name==="claimCheckpoint"?"claimCheckpoints":name).doc("current"),
        {...loginRewardRecords[name],...(name==="account"?{snapshotSha256:loginRewardBundle.sha256}:{})});
}
for(const row of loginRewardRecords.characters){loginRewardBatch.set(loginRewardRoot.collection("characters").doc(row.characterId),row);}
loginRewardBatch.set(loginRewardRoot.collection("playableSnapshots").doc("2"),loginRewardBundle);
loginRewardBatch.set(loginRewardRoot.collection("recoveryArchives").doc("2"),createRecoveryArchive(loginRewardUid,2,loginRewardRecords,loginRewardBundle));
loginRewardBatch.update(db.doc(`users/${loginRewardUid}/saves/current`),{serverRevision:2});await loginRewardBatch.commit();
const loginRewardIntent=(day,revision)=>({...loginRewardIdentity,milestoneDay:day,
    operationId:`hero-login-reward-v1-day${day}`,expectedRevision:revision});
await rejected("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(3,2),"FAILED_PRECONDITION");
let loginRewardClock=Date.now();
const loginRewardSource=createHeroAcquisition({db,FieldValue,HttpsError,runProtected:heroSessions.runProtected,
    inspectExistingEnvelope,nextRevision,now:()=>loginRewardClock,seed:()=>20261017});
for(let day=1;day<=7;day++){
    await loginRewardSource.observeLogin({auth:{uid:loginRewardUid,token:claims(loginRewardUser.idToken)},
        data:{...loginRewardIdentity,expectedRevision:day+1}});loginRewardClock+=3*86400000;
}
const loginRewardRace=await Promise.all([
    invoke("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(3,9)),
    invoke("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(3,9))]);
assert.deepEqual(loginRewardRace[0].receipt,loginRewardRace[1].receipt);
assert.equal(loginRewardRace[1].heroAccount.heroes.divineDogHongbao.specificFragments,25);
assert.equal(loginRewardRace[1].marrowPills,1);
await rejected("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(7,9),"ABORTED");
const loginRewardSecond=await invoke("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(7,10));
assert.equal(loginRewardSecond.heroAccount.heroes.vajraHeavenlyKing.specificFragments,25);
assert.equal(loginRewardSecond.heroAccount.heroes.vajraHeavenlyKing.unlocked,true);
assert.equal(loginRewardSecond.marrowPills,2);assert.equal(loginRewardSecond.authoritativeStateReady,false);
await invoke("mutateHeroGrowth",loginRewardUser.idToken,{...loginRewardIdentity,expectedRevision:11,
    operationId:"login-reward-star-0001",heroId:"vajraHeavenlyKing",action:"starUp"});
await invoke("mutateHeroGrowth",loginRewardUser.idToken,{...loginRewardIdentity,expectedRevision:12,
    operationId:"login-reward-roll-0001",heroId:"vajraHeavenlyKing",action:"reroll"});
assert.equal((await invoke("readHeroGrowth",loginRewardUser.idToken,loginRewardIdentity)).marrowPills,1);
assert.deepEqual((await invoke("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(3,9))).receipt,loginRewardRace[0].receipt);
await checkRecoveryArchive(loginRewardUid,13);
await rejected("claimHeroLoginReward",loginRewardUser.idToken,{...loginRewardIntent(3,13),amount:25},"INVALID_ARGUMENT");
assert.equal(await rulesRequest(`serverUsers/${loginRewardUid}/uniqueClaims/hero-login-reward-v1-day3`,loginRewardUser.idToken,"PATCH"),403);
while(Math.floor(Date.now()/1000)<=claims(loginRewardUser.idToken).auth_time){await new Promise(resolve=>setTimeout(resolve,100));}
const loginRewardOther=await login("accounts:signInWithPassword",{email:loginRewardEmail,password});
const loginRewardOtherSession=await invoke("createGameSession",loginRewardOther.idToken,{uid:loginRewardUid});
await rejected("claimHeroLoginReward",loginRewardUser.idToken,loginRewardIntent(3,13),"SESSION_REVOKED");
const loginRewardRestored=await invoke("claimHeroLoginReward",loginRewardOther.idToken,
    {...loginRewardIntent(3,13),session:loginRewardOtherSession});
assert.deepEqual(loginRewardRestored.receipt,loginRewardRace[0].receipt);
assert.equal(loginRewardRestored.heroAccount.heroes.vajraHeavenlyKing.stars,1);
assert.deepEqual(loginRewardRestored.loginRewards.map(row=>row.claimed),[true,true]);
const loginRewardLedger=loginRewardRoot.collection("ledgerEntries").doc("hero-login-reward-v1-day3");
const loginRewardLedgerBytes=(await loginRewardLedger.get()).data();await loginRewardLedger.delete();
await rejected("claimHeroLoginReward",loginRewardOther.idToken,{...loginRewardIntent(3,13),session:loginRewardOtherSession},"DATA_LOSS");
await loginRewardLedger.set(loginRewardLedgerBytes);
console.log("PASS Hero login rewards real Firestore/HTTP: recorded days, existing-history catch-up, concurrent exactly-once credit, growth consumption, immutable retry, original archives, session takeover and private rules; no migration/readiness.");

// Daily supply uses the same complete canonical account, protected HTTP adapter
// and immutable recovery evidence. No player account or production resource writes.
const dailyIdentity={uid:loginRewardUid,session:loginRewardOtherSession};
const dailyView=await invoke("readHeroGrowth",loginRewardOther.idToken,dailyIdentity);
const dailyDate=dailyView.dailySupply.periodDate,dailyKey='hero-daily-supply-v1-'+dailyDate;
const dailyIntent={...dailyIdentity,periodDate:dailyDate,operationId:dailyKey,expectedRevision:dailyView.serverRevision};
await rejected("claimHeroDailySupply",loginRewardOther.idToken,{...dailyIntent,amount:5},"INVALID_ARGUMENT");
const dailyRace=await Promise.all([invoke("claimHeroDailySupply",loginRewardOther.idToken,dailyIntent),
    invoke("claimHeroDailySupply",loginRewardOther.idToken,dailyIntent)]);
assert.deepEqual(dailyRace[0].receipt,dailyRace[1].receipt);
for(const id of ['divineDogHongbao','vajraHeavenlyKing']){
    assert.equal(dailyRace[1].heroAccount.heroes[id].specificFragments,dailyView.heroAccount.heroes[id].specificFragments+5);
}
assert.equal(dailyRace[1].marrowPills,dailyView.marrowPills+1);assert.equal(dailyRace[1].dailySupply.claimed,true);
assert.equal(dailyRace[1].authoritativeStateReady,false);
await checkRecoveryArchive(loginRewardUid,dailyRace[1].serverRevision);
await rejected("claimHeroDailySupply",loginRewardUser.idToken,{...dailyIntent,session:loginRewardSession},"SESSION_REVOKED");
assert.deepEqual((await invoke("claimHeroDailySupply",loginRewardOther.idToken,
    {...dailyIntent,expectedRevision:dailyRace[1].serverRevision})).receipt,dailyRace[0].receipt);
for(const name of ['operations','ledgerEntries','uniqueClaims']){
    const ref=loginRewardRoot.collection(name).doc(dailyKey),bytes=(await ref.get()).data();assert.ok(bytes);
    assert.equal(await rulesRequest(`serverUsers/${loginRewardUid}/${name}/${dailyKey}`,loginRewardOther.idToken,"PATCH"),403);
    await ref.delete();await rejected("claimHeroDailySupply",loginRewardOther.idToken,dailyIntent,"DATA_LOSS");await ref.set(bytes);
}
let supplyClock=Date.parse('2026-10-18T15:59:59Z');
const supplyWriter=createHeroGrowth({db,FieldValue,HttpsError,runProtected:heroSessions.runProtected,
    inspectExistingEnvelope,nextRevision,acquisition:loginRewardSource,now:()=>supplyClock});
const supplyRequest=(day,revision)=>({auth:{uid:loginRewardUid,token:claims(loginRewardOther.idToken)},
    data:{...dailyIdentity,periodDate:day,operationId:'hero-daily-supply-v1-'+day,expectedRevision:revision}});
// Advance into future emulator-only days, never backfill an unclaimed date.
supplyClock=Date.parse('2090-10-18T15:59:59Z');
const supplyBefore=await supplyWriter.read({auth:{uid:loginRewardUid,token:claims(loginRewardOther.idToken)},data:dailyIdentity});
const supplyFirst=await supplyWriter.claimDailySupply(supplyRequest('20901018',supplyBefore.serverRevision));
supplyClock=Date.parse('2090-10-18T16:00:00Z');
const supplyNext=await supplyWriter.claimDailySupply(supplyRequest('20901019',supplyFirst.serverRevision));
assert.equal(supplyNext.marrowPills,supplyFirst.marrowPills+1);
supplyClock=Date.parse('2090-10-21T00:00:00Z');
await assert.rejects(supplyWriter.claimDailySupply(supplyRequest('20901020',supplyNext.serverRevision)),{code:'failed-precondition'});
assert.deepEqual((await supplyWriter.claimDailySupply(supplyRequest('20901018',1))).receipt,supplyFirst.receipt);
console.log("PASS Hero daily supply real Firestore/HTTP: both fragments, one pill, concurrent exactly-once credit, immutable retry, Taipei rollover/no catch-up, archives, revoked session and private rules.");

// Isolated mode-time integration: real HTTP identity/bootstrap/creation and
// actual Firestore transactions. Internal clocks below are emulator-only;
// these intents have no production callable or Client activation.
{
    const {createCanonicalAccountModeTime}=require("../functions/src/canonical-account-mode-time.js");
    const email="account-mode-time-emulator@example.test";
    const user=await login("accounts:signUp",{email,password}),uid=user.localId;
    let token=user.idToken,session=await invoke("createGameSession",token,{uid});
    const root=db.collection("serverUsers").doc(uid),save=db.doc(`users/${uid}/saves/current`);
    const envelope=await invoke("bootstrapCloudSave",token,{uid,session});
    await invoke("createInitialCanonicalCharacter",token,{uid,session,selection:choices,
        expectedRevision:envelope.serverRevision});
    const original=await checkRecoveryArchive(uid,2);
    let modeClock=original.get("sourceRecords.progress.playableState.lastSaveTimestamp"),serial=0;
    assert.ok(Number.isSafeInteger(modeClock));
    const deps={db,FieldValue,HttpsError,inspectExistingEnvelope,nextRevision,
        runProtected:writerSessions.runProtected,now:()=>modeClock};
    const owner=createCanonicalAccountModeTime(deps);
    const request=()=>({auth:{uid,token:claims(token)},data:{uid,session}});
    const intent=async extra=>({operationId:`mode-emulator-${String(++serial).padStart(8,"0")}`,
        expectedRevision:(await save.get()).get("serverRevision"),
        expectedSequence:(await root.collection("modeTime").doc("current").get()).get("sequence")??0,...extra});
    const presence=async(action="heartbeat",elementBox="keep")=>owner.observePresence(request(),
        await intent({intent:action,elementBox}));
    const capture=async()=>{
        const rows=[[save.path,(await save.get())]];
        for(const collection of await root.listCollections()){
            for(const doc of (await collection.get()).docs)rows.push([doc.ref.path,doc]);
        }
        return rows.map(([path,doc])=>[path,{data:doc.data(),version:doc.updateTime?.toMillis()}])
            .sort(([a],[b])=>a.localeCompare(b));
    };
    const refuses=async operation=>{
        const before=await capture();await assert.rejects(operation);
        assert.deepEqual(await capture(),before,"Rejected mode intents must commit zero writes");
    };
    await presence("reopen");
    const originalOperationCount=(await root.collection("operations").get()).size;
    for(let i=0;i<2;i++){modeClock+=30000;await presence();}
    assert.equal((await root.collection("operations").get()).size,originalOperationCount);
    assert.equal((await save.get()).get("serverRevision"),2);
    await presence("rest");modeClock+=120000;
    const rested=await presence("resume");assert.equal(rested.modeState.rested.battles,1);
    await checkRecoveryArchive(uid,rested.canonicalRevision);
    const started=await owner.beginSimulatedAd(request(),await intent());
    await refuses(async()=>owner.beginSimulatedAd(request(),await intent()));
    const complete=await intent({sourceId:started.sourceId});modeClock+=2999;
    await refuses(()=>owner.completeSimulatedAd(request(),complete));modeClock++;
    // Discard the first response as a transport-loss rehearsal.
    await owner.completeSimulatedAd(request(),complete);
    const earned=await owner.completeSimulatedAd(request(),complete);
    assert.equal(earned.unchanged,true);assert.equal(earned.modeState.elementBox.remainingMs,28800000);
    await checkRecoveryArchive(uid,earned.canonicalRevision);
    const abandoned=await owner.beginSimulatedAd(request(),await intent());
    const abandonedResult=await owner.abandonSimulatedAd(request(),await intent({sourceId:abandoned.sourceId}));
    assert.equal(abandonedResult.modeState.elementBox.remainingMs,28800000);
    assert.equal((await root.collection("simulatedAdSources").doc(abandoned.sourceId).get()).get("status"),"abandoned");
    await refuses(async()=>owner.completeSimulatedAd(request(),await intent({sourceId:abandoned.sourceId})));
    await presence("heartbeat","start");modeClock+=1000;const charged=await presence();
    assert.equal(charged.modeState.elementBox.remainingMs,28799000);
    await presence("rest");modeClock+=1000;const background=await presence("resume");
    assert.equal(background.modeState.elementBox.remainingMs,28798000);
    await presence("rest");modeClock+=1000;const reopened=await presence("reopen");
    assert.equal(reopened.modeState.elementBox.remainingMs,28798000);
    assert.equal(reopened.modeState.rested.battles,1);
    modeClock+=1000;
    const concurrent=await intent({intent:"heartbeat",elementBox:"keep"});
    const race=await Promise.allSettled([
        owner.observePresence(request(),concurrent),
        owner.observePresence(request(),{...concurrent,operationId:"mode-emulator-concurrent-other"})]);
    assert.equal(race.filter(row=>row.status==="fulfilled").length,1);
    assert.equal(race.filter(row=>row.status==="rejected").length,1);
    await refuses(()=>owner.observePresence(request(),{...concurrent,operationId:"mode-emulator-stale-attempt"}));
    assert.equal((await owner.completeSimulatedAd(request(),complete)).unchanged,true);
    for(const [collection,id] of [["simulatedAdSources",started.sourceId],
        ["modeTimeEvents",complete.operationId],["ledgerEntries",complete.operationId]]){
        const proof=root.collection(collection).doc(id),saved=(await proof.get()).data();
        await proof.delete();await refuses(()=>owner.completeSimulatedAd(request(),complete));await proof.set(saved);
        await proof.update({ownerUid:"foreign-mode-owner"});
        await refuses(()=>owner.completeSimulatedAd(request(),complete));await proof.set(saved);
    }
    const currentArchive=root.collection("recoveryArchives").doc(String((await save.get()).get("serverRevision")));
    const archiveBytes=(await currentArchive.get()).data();
    await currentArchive.delete();await refuses(()=>presence());await currentArchive.set(archiveBytes);
    await currentArchive.update({sourceSha256:"0".repeat(64)});
    await refuses(()=>presence());await currentArchive.set(archiveBytes);
    const privatePaths=["modeTime/current",`modeTimeEvents/${complete.operationId}`,
        `simulatedAdSources/${started.sourceId}`];
    for(const path of privatePaths){
        for(const browserToken of [token,yUser.idToken])for(const method of ["GET","PATCH"]){
            assert.equal(await rulesRequest(`${root.path}/${path}`,browserToken,method),403);
        }
    }
    const refusedIntent=await intent({intent:"heartbeat",elementBox:"keep"});
    await refuses(()=>owner.observePresence({auth:null,data:{uid,session}},refusedIntent));
    await refuses(()=>owner.observePresence({auth:{uid,token:claims(token)},data:{uid:y,session}},refusedIntent));
    const oldRequest=request();
    // Auth emulator login epochs use whole seconds; this wait is bounded.
    const newerLoginDeadline=Date.now()+2500;
    while(Math.floor(Date.now()/1000)<=claims(token).auth_time&&Date.now()<newerLoginDeadline){
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(Math.floor(Date.now()/1000)>claims(token).auth_time);
    const other=await login("accounts:signInWithPassword",{email,password});
    token=other.idToken;session=await invoke("createGameSession",token,{uid});
    await refuses(()=>owner.observePresence(oldRequest,refusedIntent));
    await refuses(()=>presence("resume"));await presence("reopen");
    const latestRevision=(await save.get()).get("serverRevision");
    const beforeLoss=await checkRecoveryArchive(uid,latestRevision),retainedBefore=await capture();
    const recoveryId="mode-emulator-current-recovery";
    const approval=createCanonicalRecoveryApproval({db,Timestamp,HttpsError,inspectExistingEnvelope,now:()=>modeClock});
    await approval.issue({auth:{uid:"emulator-mode-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:uid,operationId:recoveryId,sourceRevision:latestRevision}});
    const recover=createCanonicalCurrentRecovery(deps),restoreIntent={operationId:recoveryId,expectedRevision:latestRevision};
    // An older value event survives independently of BOTH economic indexes;
    // later zero-value presence must not hide this original earned entitlement.
    const economicRefs=[root.collection("operations").doc(complete.operationId),
        root.collection("ledgerEntries").doc(complete.operationId)];
    const economicBytes=await Promise.all(economicRefs.map(async ref=>(await ref.get()).data()));
    for(const ref of economicRefs)await ref.delete();
    await refuses(()=>recover.restoreCurrent(request(),restoreIntent));
    for(let index=0;index<economicRefs.length;index++)await economicRefs[index].set(economicBytes[index]);
    const consumedSource=root.collection("simulatedAdSources").doc(started.sourceId);
    const consumedBytes=(await consumedSource.get()).data();
    await consumedSource.update({consumedBy:"mode-emulator-wrong-consumer"});
    await refuses(()=>recover.restoreCurrent(request(),restoreIntent));await consumedSource.set(consumedBytes);
    const remove=db.batch();
    for(const name of ["account","economy","inventory","equipment","characters","relics",
        "relicLoadout","progress","claimCheckpoints","claimRecords"]){
        for(const doc of (await root.collection(name).get()).docs)remove.delete(doc.ref);
    }
    await remove.commit();
    const restored=await recover.restoreCurrent(request(),restoreIntent);
    assert.equal(restored.restoredRevision,latestRevision+1);
    const afterRecovery=await checkRecoveryArchive(uid,restored.restoredRevision);
    assert.deepEqual(afterRecovery.get("sourceRecords.progress.sidecars"),beforeLoss.get("sourceRecords.progress.sidecars"));
    for(const [path,value] of retainedBefore.filter(([path])=>/\/(modeTime|modeTimeEvents|simulatedAdSources|ledgerEntries)\//.test(path))){
        assert.deepEqual((await db.doc(path).get()).data(),value.data,"Recovery must retain mode rights/history");
    }
    const afterRestoreBytes=await capture();
    assert.equal((await owner.completeSimulatedAd(request(),complete)).unchanged,true);
    assert.equal((await recover.restoreCurrent(request(),restoreIntent)).unchanged,true);
    assert.deepEqual(await capture(),afterRestoreBytes);
    await invoke("revokeGameSession",token,{uid,session});
    await refuses(()=>owner.completeSimulatedAd(request(),complete));
    console.log("PASS isolated account mode time actual Firestore: protected identity, private zero heartbeats, rested/ElementBox clock transitions, serial simulated grant, replay/concurrency, corrupt-proof rejection, rules and current-source-loss recovery; all readiness remains closed.");
}

let patrolProofSdkFixture; // Script-private handle to the already-earned multi-character actor.
// Isolated ordinary online Forest settlement: the real HTTP identity/session
// and first-character path feed internal Owners and actual Firestore commits.
// Deterministic entropy is an injected server test dependency, never Client
// reward data. This is bounded intent settlement, not combat verification.
{
    const {createCanonicalPatrolSettlement}=require("../functions/src/canonical-patrol-settlement.js");
    const {patrolVictoryExp}=require("../functions/src/patrol-ticket-policy.js");
    // Failure context only: preserve the SDK error (including its original
    // stack) as cause and retain its code/details. Never retry or mask it.
    let forestDiagnosticPrinted=false;
    async function forestStage(label,operation){
        try{return await operation();}
        catch(cause){
            if(!forestDiagnosticPrinted&&process.env.GCLOUD_PROJECT==="demo-four-symbols-session"&&
               process.env.FIRESTORE_EMULATOR_HOST==="127.0.0.1:18080"){
                forestDiagnosticPrinted=true;
                let handle;
                try{
                    handle=openSync("firestore-debug.log","r");
                    const size=fstatSync(handle).size,bytes=Buffer.alloc(Math.min(size,65536));
                    readSync(handle,bytes,0,bytes.length,size-bytes.length);
                    const tail=bytes.toString("utf8").trimEnd().split(/\r?\n/).slice(-100)
                        .map(line=>line.slice(0,2000)).join("\n");
                    console.error(`Forest emulator failure ${label}; bounded Firestore diagnostic tail:\n${tail}`);
                }catch(diagnosticError){
                    console.error(`Forest emulator diagnostic unavailable: ${diagnosticError.code||diagnosticError.message}`);
                }finally{if(handle!==undefined){try{closeSync(handle);}catch(_){/* Preserve the transaction error. */}}}
            }
            const error=new Error(`Forest emulator stage ${label}: ${cause.message}`,{cause});
            if(cause.code!==undefined)error.code=cause.code;
            if(cause.details!==undefined)error.details=cause.details;
            throw error;
        }
    }
    async function freshPatrol(suffix){
        const email=`forest-patrol-${suffix}-emulator@example.test`;
        const user=await login("accounts:signUp",{email,password}),uid=user.localId;
        let token=user.idToken,session=await invoke("createGameSession",token,{uid});
        const root=db.collection("serverUsers").doc(uid),save=db.doc(`users/${uid}/saves/current`);
        const envelope=await invoke("bootstrapCloudSave",token,{uid,session});
        await invoke("createInitialCanonicalCharacter",token,{uid,session,selection:choices,
            expectedRevision:envelope.serverRevision});
        const original=await checkRecoveryArchive(uid,2);
        let clock=original.get("sourceRecords.progress.playableState.lastSaveTimestamp"),serial=0;
        const deps={db,FieldValue,HttpsError,inspectExistingEnvelope,nextRevision,
            runProtected:writerSessions.runProtected,now:()=>clock,randomBytes:size=>Buffer.alloc(size)};
        const forest=createCanonicalPatrolSettlement(deps);
        const mode=forest.modeOwner;
        const request=()=>({auth:{uid,token:claims(token)},data:{uid,session}});
        const revision=async()=>(await save.get()).get("serverRevision");
        const intent=async extra=>({operationId:`forest-${suffix}-${String(++serial).padStart(8,"0")}`,
            expectedRevision:await revision(),...extra});
        const presence=async(action="heartbeat",elementBox="keep")=>mode.observePresence(request(),
            await intent({intent:action,elementBox,
                expectedSequence:(await root.collection("modeTime").doc("current").get()).get("sequence")??0}));
        const capture=async()=>{
            const rows=[[save.path,await save.get()]];
            for(const collection of await root.listCollections())for(const doc of (await collection.get()).docs)rows.push([doc.ref.path,doc]);
            return rows.map(([path,doc])=>[path,{data:doc.data(),version:doc.updateTime?.toMillis()}])
                .sort(([a],[b])=>a.localeCompare(b));
        };
        const refuses=async(operation,pattern)=>{
            const before=await capture();await assert.rejects(operation,pattern);
            assert.deepEqual(await capture(),before,"Rejected Forest intents must commit zero writes");
        };
        const issue=async()=>{
            const input=await intent({triggerEntryId:"forest:0",availableEntryIds:["forest:0"]});
            const result=await forest.issueTicket(request(),input);
            const ticketId=result.ticketId;
            const ticket=(await root.collection("patrolTickets").doc(ticketId).get()).data();
            assert.equal(ticketId,input.operationId);assert.equal(ticket.members.length,1);
            return {ticketId,ticket,input};
        };
        const member=async(ticketId,extra={})=>forest.settleMember(request(),await intent({ticketId,memberIndex:0,...extra}));
        const terminal=async(ticketId,kind="win")=>forest.settleTerminal(request(),await intent({ticketId,kind}));
        await presence("reopen");
        return {uid,email,root,save,deps,forest,mode,request,revision,intent,presence,capture,refuses,issue,member,terminal,
            advance:delta=>{clock+=delta;},get clock(){return clock;},get token(){return token;},get session(){return session;},
            setIdentity:(nextToken,nextSession)=>{token=nextToken;session=nextSession;}};
    }
    const h=await freshPatrol("repeat"),economy=()=>h.root.collection("economy").doc("current").get();
    await h.presence("rest");h.advance(120000);await h.presence("resume");
    const lost=await h.issue(),memberInput=await h.intent({ticketId:lost.ticketId,memberIndex:0});
    const goldBefore=(await economy()).get("gold");
    const memberRace=await Promise.all([h.forest.settleMember(h.request(),memberInput),h.forest.settleMember(h.request(),memberInput)]);
    assert.deepEqual(memberRace[0].reward,memberRace[1].reward);
    assert.equal((await economy()).get("gold"),goldBefore+lost.ticket.members[0].gold);
    assert.ok(memberRace[0].reward.drops.some(row=>row.accepted),"The server-sealed deterministic drop must enter the actual inventory");
    const retainedMember=(await checkRecoveryArchive(h.uid,await h.revision())).get("sourceRecords");
    // Discarded member response resolves the same immutable intent without a
    // second drop, gold credit, mode debit or private event.
    const afterMember=await h.capture();assert.equal((await h.forest.settleMember(h.request(),memberInput)).unchanged,true);
    assert.deepEqual(await h.capture(),afterMember);
    await h.terminal(lost.ticketId,"loss");
    assert.equal((await economy()).get("gold"),goldBefore+lost.ticket.members[0].gold);
    assert.equal((await economy()).get("sharedExp"),0,"Loss retains member gold/drop but grants no victory EXP");
    const afterLoss=(await checkRecoveryArchive(h.uid,await h.revision())).get("sourceRecords");
    assert.deepEqual(afterLoss.inventory.map(row=>row.state),retainedMember.inventory.map(row=>row.state));
    assert.equal(JSON.parse(afterLoss.progress.sidecars["rested-exp-state"].raw).battles,1);
    const won=await h.issue();await h.member(won.ticketId);
    const charId=(await h.root.collection("account").doc("current").get()).get("slots")[0];
    const state=(await h.root.collection("characters").doc(charId).get()).get("state");
    const expectedExp=patrolVictoryExp(won.ticket.members,[state],{rested:true,elementBox:false});
    const winInput=await h.intent({ticketId:won.ticketId,kind:"win"});
    const rollback=createCanonicalPatrolSettlement({...h.deps,
        runProtected:(request,operation)=>writerSessions.runProtected(request,async(tx,active)=>{
            await operation(tx,active);throw new Error("Forest rollback after all staged writes");
        })});
    await h.refuses(()=>rollback.settleTerminal(h.request(),winInput),/Forest rollback/);
    await h.forest.settleTerminal(h.request(),winInput);
    const winRetry=await h.forest.settleTerminal(h.request(),winInput);
    assert.equal(winRetry.unchanged,true);assert.equal(winRetry.reward.exp,expectedExp);
    assert.equal((await economy()).get("sharedExp"),expectedExp);
    assert.equal((await h.root.collection("modeTime").doc("current").get()).get("modeState.rested.battles"),0);
    const modeEvent=await h.root.collection("modeTimeEvents").doc(winInput.operationId).get();
    assert.equal(modeEvent.exists,true,"Mode consumption shares the actual winning settlement transaction");
    for(const [collection,id] of [["patrolTickets",won.ticketId],["patrolSettlements",winInput.operationId],
        ["ledgerEntries",winInput.operationId]]){
        const proof=h.root.collection(collection).doc(id),bytes=(await proof.get()).data();assert.ok(bytes);
        await proof.delete();await h.refuses(()=>h.forest.settleTerminal(h.request(),winInput));await proof.set(bytes);
        await proof.update({ownerUid:"foreign-patrol-owner"});await h.refuses(()=>h.forest.settleTerminal(h.request(),winInput));await proof.set(bytes);
    }
    const archiveRef=h.root.collection("recoveryArchives").doc(String(await h.revision()));
    const archiveBytes=(await archiveRef.get()).data();await archiveRef.delete();await h.refuses(()=>h.issue());await archiveRef.set(archiveBytes);
    await archiveRef.update({sourceSha256:"0".repeat(64)});await h.refuses(()=>h.issue());await archiveRef.set(archiveBytes);
    for(const path of [`patrolTickets/${won.ticketId}`,`patrolSettlements/${winInput.operationId}`,`patrolTicketStates/${won.ticketId}`,"patrol/current"]){
        for(const browserToken of [h.token,yUser.idToken])for(const method of ["GET","PATCH"]){
            assert.equal(await rulesRequest(`${h.root.path}/${path}`,browserToken,method),403);
        }
    }
    const stale=await h.intent({triggerEntryId:"forest:0",availableEntryIds:["forest:0"]});
    await h.refuses(()=>h.forest.issueTicket(h.request(),{...stale,expectedRevision:stale.expectedRevision-1}));
    await h.refuses(()=>h.forest.issueTicket({auth:{uid:h.uid,token:claims(h.token)},data:{uid:y,session:h.session}},stale));
    const oldRequest=h.request(),deadline=Date.now()+2500;
    while(Math.floor(Date.now()/1000)<=claims(h.token).auth_time&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
    assert.ok(Math.floor(Date.now()/1000)>claims(h.token).auth_time);
    const other=await login("accounts:signInWithPassword",{email:h.email,password});
    const otherSession=await invoke("createGameSession",other.idToken,{uid:h.uid});h.setIdentity(other.idToken,otherSession);
    console.log("Forest repeat checkpoint: takeover completed; checking revoked session and reopening mode.");
    await forestStage("repeat/takeover/old-session-refusal",()=>h.refuses(()=>h.forest.settleTerminal(oldRequest,winInput)));
    await forestStage("repeat/takeover/mode-reopen",()=>h.presence("reopen"));
    const allocator=createCanonicalExpAllocation({...h.deps,
        runProtected:(request,operation)=>{
            let attempt=0;
            return writerSessions.runProtected(request,async(tx,active)=>{
                const currentAttempt=++attempt;
                let readSequence=0;
                // Bind every SDK method to its original transaction. Only get
                // failures gain context; reads retain their original ordering.
                // A protected facade is frozen. Use a separate diagnostic
                // object rather than overriding a nonconfigurable Proxy value.
                const traced={
                    ...Object.fromEntries(["create","set","update","delete"].map(method=>[method,tx[method].bind(tx)])),
                    get:async(reference,...args)=>{
                        const sequence=++readSequence;
                        const kind=typeof reference?.collection==="function"?"document":"query";
                        const path=typeof reference?.path==="string"?reference.path:
                            `[${reference?.constructor?.name||"unknown query"}]`;
                        try{return await tx.get(reference,...args);}
                        catch(cause){
                            const error=new Error(`Forest allocator transaction attempt ${currentAttempt} read ${sequence} ${kind} ${path}: ${cause.message}`,{cause});
                            for(const field of ["code","details","detail"]){
                                if(cause[field]!==undefined)error[field]=cause[field];
                            }
                            throw error;
                        }
                    }
                };
                return operation(traced,active);
            });
        }});
    async function allocateAvailable(){
        for(let guard=0;guard<9;guard++){
            const current=(await h.root.collection("characters").doc(charId).get()).get("state");
            if(current.level>=10||(await economy()).get("sharedExp")<current.expNext-current.exp)return current.level;
            await forestStage(`repeat/allocate/level-${current.level}/guard-${guard}`,
                async()=>allocator.allocateSharedExp(h.request(),await h.intent()));
        }
        return (await h.root.collection("characters").doc(charId).get()).get("state.level");
    }
    let level=await forestStage("repeat/allocate/after-takeover",allocateAvailable),completedBattles=2;
    // Finite test guard only: this adds no production challenge/earning limit.
    for(let guard=0;level<10&&guard<48;guard++){
        const stage=`repeat/battle-${completedBattles+1}/guard-${guard}`;
        const next=await forestStage(stage+"/issue",()=>h.issue());
        await forestStage(stage+"/member",()=>h.member(next.ticketId));
        await forestStage(stage+"/terminal",()=>h.terminal(next.ticketId));
        completedBattles++;level=await forestStage(stage+"/allocate-available",allocateAvailable);
    }
    assert.equal(level,10,"Actual earned shared EXP and the existing allocator must reach Lv10");
    assert.ok(completedBattles>=2);assert.equal((await h.save.get()).get("authoritativeStateReady"),false);
    await checkRecoveryArchive(h.uid,await h.revision());
    // Public multi-character intents consume only the genuine Forest-funded
    // Lv10 authority above. Third-slot Lv50 admission stays separately scoped.
    const multiIdentity=()=>({uid:h.uid,session:h.session});
    const multiCall=(name,input)=>invoke(name,h.token,{...multiIdentity(),...input});
    const originalPrimary=(await h.root.collection("characters").doc(charId).get()).get("state");
    const additional=await h.intent({slotIndex:1,selection:{...choices,displayName:"HTTP Second",
        attributes:{attack:0,vitality:0,energy:0,intelligence:0,defensePoints:0,agility:0}}});
    const created=await multiCall("createAdditionalCanonicalCharacter",additional),secondaryId=created.characterId;
    assert.equal(typeof secondaryId,"string");assert.equal(created.authoritativeStateReady,false);
    async function checkMulti(){
        const revision=await h.revision(),archive=await checkRecoveryArchive(h.uid,revision);
        const rows=archive.get("sourceRecords.characters"),account=archive.get("sourceRecords.account");
        assert.deepEqual(account.slots,[charId,secondaryId,null]);assert.equal(rows.length,2);
        for(const row of rows){
            assert.equal(row.serverRevision,revision);
            const live=(await h.root.collection("characters").doc(row.characterId).get()).data();
            const {createdAt,updatedAt,snapshotSha256,...source}=live;
            assert.deepEqual(source,row);
        }
        assert.deepEqual(rows[0].state,originalPrimary,"Secondary intents preserve primary state");
        assert.equal((await h.save.get()).get("authoritativeStateReady"),false);
        return rows[1].state;
    }
    const secondaryBefore=await checkMulti();assert.equal(secondaryBefore.attributePoints,10);
    const attributeInput=await h.intent({characterId:secondaryId,stat:"attack"});
    await multiCall("allocateCanonicalAttributePoint",attributeInput);
    const attributed=await checkMulti();assert.equal(attributed.attack,secondaryBefore.attack+1);
    assert.equal(attributed.attributePoints,secondaryBefore.attributePoints-1);
    // One additional real battle supplies the secondary allocation; no grant
    // fixture or client amount is introduced at the callable boundary.
    const secondaryBattle=await h.issue();await h.member(secondaryBattle.ticketId);await h.terminal(secondaryBattle.ticketId);
    const secondaryPreExp=await checkMulti(),poolBefore=(await economy()).get("sharedExp");
    const expInput=await h.intent({characterId:secondaryId});
    const secondaryAllocation=await multiCall("allocateCanonicalSharedExp",expInput);
    const secondaryAfter=await checkMulti();assert.equal(secondaryAfter.level,secondaryPreExp.level+1);
    assert.equal((await economy()).get("sharedExp"),poolBefore-secondaryAllocation.cost);
    const beforeMultiRetry=await h.capture();
    for(const [name,input] of [["createAdditionalCanonicalCharacter",additional],
        ["allocateCanonicalAttributePoint",attributeInput],["allocateCanonicalSharedExp",expInput]]){
        assert.equal((await multiCall(name,input)).unchanged,true);
        assert.deepEqual(await h.capture(),beforeMultiRetry,"Original HTTP retries cannot reauthorize rights");
    }
    for(const [name,extra] of [["createAdditionalCanonicalCharacter",{slotIndex:1,selection:additional.selection}],
        ["allocateCanonicalAttributePoint",{characterId:secondaryId,stat:"attack"}],
        ["allocateCanonicalSharedExp",{characterId:secondaryId}]]){
        const input=await h.intent(extra);
        for(const field of ["amount","level","state"])
            await h.refuses(()=>multiCall(name,{...input,[field]:999}));
        await h.refuses(()=>invoke(name,h.token,{...multiIdentity(),...input,uid:y}));
        await h.refuses(()=>invoke(name,h.token,{...multiIdentity(),...input,session:null}));
        if(name!=="createAdditionalCanonicalCharacter")
            await h.refuses(()=>multiCall(name,{...input,characterId:"foreign-character"}));
    }
    await checkMulti();
    console.log("PASS actual HTTP second character: Forest-funded Lv10 admission, unspent attribute and shared EXP target, complete two-character revisions and same-operation retries, strict minting/UID/session/foreign-target refusals.");
    console.log(`Forest repeat checkpoint: Lv10 verified after ${completedBattles} test battles; starting isolated recovery.`);

    patrolProofSdkFixture=h;
    // Recovery uses a different fresh UID and a deliberately small legitimate
    // history. Large histories retain the existing 400-read refusal budget.
    const r=await freshPatrol("recovery"),ticket=await r.issue();
    const paid=await r.member(ticket.ticketId),closed=await r.terminal(ticket.ticketId,"loss");
    const laterHeartbeat=await r.presence();
    assert.equal((await r.root.collection("modeTimeEvents").doc(laterHeartbeat.operationId).get()).get("schemaVersion"),1);
    for(const id of [paid.operationId,closed.operationId]){
        const event=await r.root.collection("modeTimeEvents").doc(id).get();
        assert.equal(event.get("schemaVersion"),2);assert.equal(event.get("modeChanged"),false);
    }
    assert.equal(typeof paid.operationId,"string");
    const revision=await r.revision(),beforeLoss=(await checkRecoveryArchive(r.uid,revision)).get("sourceRecords");
    const restoreId="forest-recovery-current-0001",restoreIntent={operationId:restoreId,expectedRevision:revision};
    const approval=createCanonicalRecoveryApproval({...r.deps,Timestamp});
    await approval.issue({auth:{uid:"emulator-forest-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:r.uid,operationId:restoreId,sourceRevision:revision}});
    const recovery=createCanonicalCurrentRecovery(r.deps);
    // A retained settlement is independent proof even after both economic
    // indexes are lost. The actual restore must inventory that source.
    const refs=[r.root.collection("operations").doc(paid.operationId),r.root.collection("ledgerEntries").doc(paid.operationId)];
    const bytes=await Promise.all(refs.map(async ref=>(await ref.get()).data()));
    for(const ref of refs)await ref.delete();await r.refuses(()=>recovery.restoreCurrent(r.request(),restoreIntent));
    for(let index=0;index<refs.length;index++)await refs[index].set(bytes[index]);
    const source=r.root.collection("patrolTickets").doc(ticket.ticketId),sourceBytes=(await source.get()).data();
    await source.update({ownerUid:"foreign-patrol-owner"});await r.refuses(()=>recovery.restoreCurrent(r.request(),restoreIntent));await source.set(sourceBytes);
    // A later v1 heartbeat cannot hide v2 Forest events whose time delta was
    // zero. Remove ALL Forest indexes plus current sources; only independent
    // retained mode events/snapshots survive to expose the missing originals.
    const allBeforeDamage=await r.capture(),eraseCollections=new Set(["account","economy","inventory","equipment","characters",
        "relics","relicLoadout","progress","claimCheckpoints","claimRecords","patrolTickets","patrolTicketStates",
        "patrolSettlements","patrolClosures","patrol"]);
    const erased=allBeforeDamage.filter(([path])=>{
        if(!path.startsWith(r.root.path+"/"))return false;
        const relative=path.slice(r.root.path.length+1);
        return eraseCollections.has(relative.split("/")[0])||[paid.operationId,closed.operationId].some(id=>
            relative===`operations/${id}`||relative===`ledgerEntries/${id}`);
    });
    const erase=db.batch();for(const [path] of erased)erase.delete(db.doc(path));await erase.commit();
    await r.refuses(()=>recovery.restoreCurrent(r.request(),restoreIntent));
    const replace=db.batch();for(const [path,row] of erased)replace.set(db.doc(path),row.data);await replace.commit();
    const retained=await r.capture(),remove=db.batch();
    for(const name of ["account","economy","inventory","equipment","characters","relics","relicLoadout","progress","claimCheckpoints","claimRecords"]){
        for(const doc of (await r.root.collection(name).get()).docs)remove.delete(doc.ref);
    }
    await remove.commit();const restored=await recovery.restoreCurrent(r.request(),restoreIntent);
    assert.equal(restored.restoredRevision,revision+1);
    const after=(await checkRecoveryArchive(r.uid,restored.restoredRevision)).get("sourceRecords");
    assert.equal(after.economy.gold,beforeLoss.economy.gold);assert.equal(after.economy.sharedExp,0);
    assert.deepEqual(after.inventory.map(row=>row.state),beforeLoss.inventory.map(row=>row.state));
    for(const [path,row] of retained.filter(([path])=>/\/(patrolTickets|patrolTicketStates|patrolSettlements|patrolClosures|modeTime|modeTimeEvents|ledgerEntries)\//.test(path))){
        assert.deepEqual((await db.doc(path).get()).data(),row.data,"Recovery retains independent Forest/mode history");
    }
    const committed=await r.capture();assert.equal((await recovery.restoreCurrent(r.request(),restoreIntent)).unchanged,true);
    assert.deepEqual(await r.capture(),committed);
    console.log("PASS isolated Forest online settlement actual Firestore: repeatable member/win/loss, concurrent/lost-response once-only credit, retained loss loot, rested/mode atomic win, actual EXP allocation through Lv10, corruption/session/rules fences and fresh-small-history source-loss recovery. Intent outcomes remain unverified; no readiness or gameplay limit is published.");
}

// Minimal public-boundary smoke uses the actual callable clock and entropy.
// No internal mode/Forest factory is used for this separate fresh actor.
{
    const user=await login("accounts:signUp",{email:"forest-patrol-callable-emulator@example.test",password});
    const uid=user.localId,token=user.idToken,session=await invoke("createGameSession",token,{uid});
    const root=db.collection("serverUsers").doc(uid),save=db.doc(`users/${uid}/saves/current`),identity={uid,session};
    const envelope=await invoke("bootstrapCloudSave",token,identity);
    await invoke("createInitialCanonicalCharacter",token,{...identity,selection:choices,expectedRevision:envelope.serverRevision});
    const revision=async()=>(await save.get()).get("serverRevision");
    const capture=async()=>{
        const rows=[[save.path,(await save.get()).data()]];
        for(const collection of await root.listCollections())for(const doc of (await collection.get()).docs)rows.push([doc.ref.path,doc.data()]);
        return rows.sort(([a],[b])=>a.localeCompare(b));
    };
    const refuses=async(name,authToken,input,code)=>{
        const before=await capture();await assert.rejects(()=>invoke(name,authToken,input),error=>
            [code,code.toLowerCase().replaceAll("_","-")].includes(error.code));
        assert.deepEqual(await capture(),before,"Callable boundary rejection cannot change canonical/private records");
    };
    const reopen={...identity,operationId:"forest-http-reopen-0001",expectedRevision:await revision(),
        expectedSequence:0,intent:"reopen",elementBox:"keep"};
    await refuses("observeCanonicalAccountMode",null,reopen,"UNAUTHENTICATED");
    await refuses("observeCanonicalAccountMode",token,{...reopen,uid:y},"SESSION_INVALID");
    await refuses("observeCanonicalAccountMode",token,{...reopen,session:null},"SESSION_INVALID");
    await refuses("observeCanonicalAccountMode",token,{...reopen,rawState:{}},"INVALID_ARGUMENT");
    await invoke("observeCanonicalAccountMode",token,reopen);
    const issue={...identity,operationId:"forest-http-ticket-0001",expectedRevision:await revision(),
        triggerEntryId:"forest:0",availableEntryIds:["forest:0"]};
    await refuses("issueCanonicalPatrolTicket",token,{...issue,amount:999999},"INVALID_ARGUMENT");
    const ticket=await invoke("issueCanonicalPatrolTicket",token,issue);
    assert.equal(ticket.members.length,1);assert.equal(ticket.outcomeVerified,false);
    const member={...identity,operationId:"forest-http-member-0001",expectedRevision:await revision(),ticketId:ticket.ticketId,memberIndex:0};
    await refuses("settleCanonicalPatrolMember",token,{...member,won:true},"INVALID_ARGUMENT");
    await refuses("settleCanonicalPatrolTerminal",token,{...identity,operationId:"forest-http-forged-win-0001",
        expectedRevision:await revision(),ticketId:ticket.ticketId,kind:"win"},"FAILED_PRECONDITION");
    const credited=await invoke("settleCanonicalPatrolMember",token,member);
    assert.equal(credited.outcomeVerified,false);assert.ok(credited.reward.gold>0);
    const loss={...identity,operationId:"forest-http-loss-0001",expectedRevision:await revision(),ticketId:ticket.ticketId,kind:"loss"};
    await refuses("settleCanonicalPatrolTerminal",token,{...loss,rawState:{gold:999999}},"INVALID_ARGUMENT");
    const closed=await invoke("settleCanonicalPatrolTerminal",token,loss);
    assert.equal(closed.reward.exp,0);assert.equal((await root.collection("economy").doc("current").get()).get("sharedExp"),0);
    const beforeRetry=await capture();
    assert.equal((await invoke("settleCanonicalPatrolMember",token,member)).unchanged,true);
    assert.equal((await invoke("settleCanonicalPatrolTerminal",token,loss)).unchanged,true);
    assert.deepEqual(await capture(),beforeRetry);assert.equal((await save.get()).get("authoritativeStateReady"),false);
    console.log("PASS Forest callable HTTP boundary: real reopen/issue/member/loss/retry, no Client amount/raw-state/win proof, unauthenticated/cross-UID/invalid-session refusal; readiness remains false.");
}

// Actual SDK retries and real Auth/session state exercise the temporary audit
// fence. These internal methods are deliberately not new callable endpoints.
{
    const account=await login("accounts:signUp",{email:"recovery-audit-fence@example.test",password});
    const uid=account.localId,root=db.collection("serverUsers").doc(uid),save=db.doc(`users/${uid}/saves/current`);
    let token=account.idToken,clock=Date.now(),session=await invoke("createGameSession",token,{uid});
    await invoke("bootstrapCloudSave",token,{uid,session});
    const authority=createSessionAuthority({db,FieldValue,HttpsError,now:()=>clock});
    const request=()=>({auth:{uid,token:claims(token)},data:{uid,session}});
    const dependencies={db,FieldValue,Timestamp,HttpsError,now:()=>clock,inspectExistingEnvelope,nextRevision,
        runProtected:authority.runProtected,runRecoveryAuditMaintenance:authority.runRecoveryAuditMaintenance};
    const source=createCanonicalSourceWriter(dependencies),initial={operationId:"audit-fence-initial-00001",expectedRevision:1,
        selection:{displayName:"審核維護",element:"fire",gender:"female",
            attributes:{attack:3,vitality:2,energy:1,intelligence:2,defensePoints:1,agility:1}}};
    await source.commitInitialSources(request(),initial);
    const {createCanonicalPatrolSettlement}=require("../functions/src/canonical-patrol-settlement.js");
    const patrol=createCanonicalPatrolSettlement({...dependencies,randomBytes:n=>Buffer.alloc(n,255)});
    const reopen={operationId:"audit-fence-reopen-000001",expectedRevision:2,expectedSequence:0,intent:"reopen",elementBox:"keep"};
    await patrol.observePresence(request(),reopen);
    const approval=createCanonicalRecoveryApproval(dependencies),approvalId="audit-fence-approval-0001",auditId="audit-fence-run-00000001";
    const operator=operationId=>({auth:{uid:"audit-fence-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:uid,operationId,sourceRevision:2,ttlSeconds:60}});
    await approval.issue(operator(approvalId));
    const recovery=createCanonicalCurrentRecovery(dependencies),begin={operationId:auditId,expectedRevision:2,approvalOperationId:approvalId};
    // First attempt really reads an absent fence. An injected ABORTED releases
    // its read locks; the normal begin transaction commits before the SDK's
    // next attempt enters requireActiveSession/fence reading. This tests real
    // SDK retry handling without relying on timing or an emulator lock mode.
    let sdkAttempts=0,callbackAttempts=0,beginPromise,firstFacade;
    const retryDb={doc:path=>db.doc(path),runTransaction:callback=>db.runTransaction(async tx=>{
        if(++sdkAttempts>1)await beginPromise;
        return callback(tx);
    })};
    const retryAuthority=createSessionAuthority({db:retryDb,FieldValue,HttpsError,now:()=>clock});
    await assert.rejects(()=>retryAuthority.runProtected(request(),async tx=>{
        if(++callbackAttempts===1){
            firstFacade=tx;assert.equal(tx.firestore,undefined);assert.equal(tx.batch,undefined);
            beginPromise=recovery.beginAudit(request(),begin);
            throw Object.assign(new Error("emulator retry after absent fence read"),{code:10});
        }
        assert.notEqual(tx,firstFacade);
        tx.create(root.collection("fenceRegression").doc("must-not-commit"),{value:1});
    }),/RECOVERY_AUDIT_MAINTENANCE/);
    await beginPromise;assert.ok(sdkAttempts>=2);assert.equal(callbackAttempts,2);
    assert.equal((await root.collection("fenceRegression").doc("must-not-commit").get()).exists,false);
    assert.equal((await root.collection("recoveryAuditFence").doc("current").get()).get("status"),"active");
    assert.equal((await source.commitInitialSources(request(),initial)).unchanged,true);
    assert.equal((await patrol.observePresence(request(),reopen)).unchanged,true);
    assert.equal((await authority.protectedTest(request())).result,"SUCCESS");
    const heartbeat={operationId:"audit-fence-heartbeat-001",expectedRevision:2,expectedSequence:1,intent:"heartbeat",elementBox:"keep"};
    await assert.rejects(()=>patrol.observePresence(request(),heartbeat),/RECOVERY_AUDIT_MAINTENANCE/);
    await assert.rejects(()=>patrol.beginSimulatedAd(request(),{operationId:"audit-fence-adbegin-00001",expectedRevision:2,expectedSequence:1}),/RECOVERY_AUDIT_MAINTENANCE/);
    await assert.rejects(()=>createDailyCheckinGrant(dependencies).issue(request()),/RECOVERY_AUDIT_MAINTENANCE/);
    await assert.rejects(()=>approval.issue(operator("audit-fence-newapproval-01")),/blocks new approvals/);
    const priorApproval=await approval.issue(operator(approvalId));assert.equal(priorApproval.unchanged,true);
    await assert.rejects(()=>authority.runRecoveryAuditMaintenance(request(),auditId,tx=>
        tx.set(root.collection("economy").doc("current"),{gold:999})),/RECOVERY_AUDIT_WRITE_SCOPE/);
    const oldRequest=request();
    while(Math.floor(Date.now()/1000)<=claims(token).auth_time)await new Promise(resolve=>setTimeout(resolve,100));
    const nextLogin=await login("accounts:signInWithPassword",{email:"recovery-audit-fence@example.test",password});
    token=nextLogin.idToken;clock=Date.now();session=await invoke("createGameSession",token,{uid});
    await assert.rejects(()=>recovery.resumeAudit(request(),{auditId,expectedEpoch:1,expectedRevision:2}),/epoch or session/);
    await assert.rejects(()=>recovery.cancelAudit(oldRequest,{operationId:"audit-fence-oldcancel-001",auditId,expectedEpoch:1}),/SESSION_REVOKED/);
    await authority.revoke(request());assert.equal((await root.collection("recoveryAuditFence").doc("current").get()).get("status"),"active");
    while(Math.floor(Date.now()/1000)<=claims(token).auth_time)await new Promise(resolve=>setTimeout(resolve,100));
    const finalLogin=await login("accounts:signInWithPassword",{email:"recovery-audit-fence@example.test",password});
    token=finalLogin.idToken;clock=Date.now();session=await invoke("createGameSession",token,{uid});clock+=61000;
    assert.equal((await approval.issue(operator(approvalId))).expiresAtMs,priorApproval.expiresAtMs);
    assert.ok(priorApproval.expiresAtMs<clock);
    const accountRef=root.collection("account").doc("current"),accountBytes=(await accountRef.get()).data();
    await accountRef.delete(); // Emulator-only source damage; cancel needs no asset source.
    const cancel={operationId:"audit-fence-cancel-000001",auditId,expectedEpoch:1};
    await assert.rejects(()=>recovery.cancelAudit(request(),{...cancel,expectedEpoch:2}),/epoch differs/);
    await recovery.cancelAudit(request(),cancel);assert.equal((await recovery.cancelAudit(request(),cancel)).unchanged,true);
    await accountRef.create(accountBytes); // Undo only this test's source damage.
    await patrol.observePresence(request(),{...heartbeat,operationId:"audit-fence-aftercancel-01",intent:"reopen"});
    assert.equal((await root.collection("modeTime").doc("current").get()).get("sessionId"),session.sessionId);
    assert.equal((await save.get()).get("authoritativeStateReady"),false);
    // A second fresh UID tests real contention on an initially absent fence,
    // without injected errors, sleeps or assumptions about lock scheduling.
    const raceAccount=await login("accounts:signUp",{email:"recovery-fence-race@example.test",password});
    const raceUid=raceAccount.localId,raceRoot=db.collection("serverUsers").doc(raceUid);
    const raceSession=await invoke("createGameSession",raceAccount.idToken,{uid:raceUid});
    await invoke("bootstrapCloudSave",raceAccount.idToken,{uid:raceUid,session:raceSession});
    const raceRequest=()=>({auth:{uid:raceUid,token:claims(raceAccount.idToken)},data:{uid:raceUid,session:raceSession}});
    await createCanonicalSourceWriter(dependencies).commitInitialSources(raceRequest(),{
        ...initial,operationId:"audit-fence-race-initial-01"});
    const raceApprovalId="audit-fence-race-approval1",raceAuditId="audit-fence-race-audit-001";
    await approval.issue({auth:{uid:"audit-fence-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:raceUid,operationId:raceApprovalId,sourceRevision:2,ttlSeconds:60}});
    const raceFence=raceRoot.collection("recoveryAuditFence").doc("current"),probe=raceRoot.collection("fenceRaceProbe").doc("current");
    assert.equal((await raceFence.get()).exists,false);
    const [writerResult,beginResult]=await Promise.allSettled([
        authority.runProtected(raceRequest(),async tx=>{
            await tx.get(raceFence); // Same absent/live fence ref as begin.
            tx.create(probe,{committedAt:FieldValue.serverTimestamp()});
            return {written:true};
        }),
        recovery.beginAudit(raceRequest(),{operationId:raceAuditId,expectedRevision:2,approvalOperationId:raceApprovalId})
    ]);
    assert.equal(beginResult.status,"fulfilled",beginResult.reason?.message);
    const [committedFence,committedProbe]=await Promise.all([raceFence.get(),probe.get()]);
    assert.equal(committedFence.get("status"),"active");
    if(writerResult.status==="fulfilled"){
        assert.equal(committedProbe.exists,true);
        assertRecoveryFenceCommitOrder(committedProbe,committedFence);
    }else{
        assert.match(writerResult.reason.message,/RECOVERY_AUDIT_MAINTENANCE/);
        assert.equal(committedProbe.exists,false,"Fence-first serialization commits no ordinary write");
    }
    await assert.rejects(()=>authority.runProtected(raceRequest(),tx=>tx.set(probe,{late:true})),/RECOVERY_AUDIT_MAINTENANCE/);
    await recovery.cancelAudit(raceRequest(),{operationId:"audit-fence-race-cancel-01",auditId:raceAuditId,expectedEpoch:1});
    await authority.runProtected(raceRequest(),tx=>{tx.set(probe,{afterCancel:true});});
    assert.equal((await probe.get()).get("afterCancel"),true);
    console.log("PASS recovery audit fence: actual absent-read SDK retry blocks later writes; zero/private writers, approval and maintenance scope; reads/original retries survive; real takeover/revoke and expired-approval source-loss cancel; canonical readiness stays false.");
    console.log("PASS actual ordinary-writer versus begin race on missing fence: document updateTime commit metadata or zero-write maintenance rejection prove serialization; cancel restores normal writes.");
}

// Real SDK inventory capture remains an internal, metadata-only audit segment.
// No artifact promotion, restore permit or additional callable is exercised.
{
    const {recoveryAuditNamespaces,decodeInventoryPayload}=require("../functions/src/recovery-audit-artifact.js");
    const {createCanonicalPatrolSettlement}=require("../functions/src/canonical-patrol-settlement.js");
    const email="recovery-inventory-pages@example.test",account=await login("accounts:signUp",{email,password});
    const uid=account.localId,root=db.collection("serverUsers").doc(uid),save=db.doc(`users/${uid}/saves/current`);
    let token=account.idToken,session=await invoke("createGameSession",token,{uid});
    const empty=await invoke("bootstrapCloudSave",token,{uid,session});
    await invoke("createInitialCanonicalCharacter",token,{uid,session,selection:choices,expectedRevision:empty.serverRevision});
    let clock=(await checkRecoveryArchive(uid,2)).get("sourceRecords.progress.playableState.lastSaveTimestamp");
    const attempts=[];
    const observedDb={doc:path=>db.doc(path),runTransaction:callback=>db.runTransaction(async raw=>{
        const attempt={reads:0,queries:0,writes:0,paths:[]};attempts.push(attempt);
        const tx={get:async reference=>{
            const result=await raw.get(reference);
            const query=typeof reference.collection!=="function";
            attempt.reads+=query?Math.max(1,result.size):1;
            if(query)attempt.queries++;
            else attempt.paths.push(reference.path);
            return result;
        }};
        for(const method of ["create","set","update","delete"])tx[method]=(...args)=>{
            attempt.writes++;return raw[method](...args);
        };
        return callback(tx);
    })};
    const authority=createSessionAuthority({db:observedDb,FieldValue,HttpsError,now:()=>clock});
    const request=()=>({auth:{uid,token:claims(token)},data:{uid,session}});
    const deps={db,FieldValue,Timestamp,HttpsError,now:()=>clock,inspectExistingEnvelope,nextRevision,
        runProtected:authority.runProtected,runRecoveryAuditMaintenance:authority.runRecoveryAuditMaintenance};
    const recovery=createCanonicalCurrentRecovery(deps),patrol=createCanonicalPatrolSettlement(deps);
    // Real zero-value events provide a namespace longer than one page without
    // inserting fabricated economics, receipts or source revisions.
    for(let sequence=0;sequence<18;sequence++)await patrol.observePresence(request(),{
        operationId:`inventory-mode-event-${String(sequence).padStart(8,"0")}`,expectedRevision:2,expectedSequence:sequence,
        intent:sequence===0?"reopen":"heartbeat",elementBox:"keep"});
    const auditId="inventory-audit-operation-001",approvalOperationId="inventory-approval-operation1";
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:"inventory-audit-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:uid,operationId:approvalOperationId,sourceRevision:2,ttlSeconds:60}});
    await recovery.beginAudit(request(),{operationId:auditId,expectedRevision:2,approvalOperationId});
    const runRef=root.collection("recoveryAuditRuns").doc(auditId),fenceRef=root.collection("recoveryAuditFence").doc("current");
    const stateRef=runRef.collection("captureState").doc("current"),pageRef=id=>runRef.collection("inventoryPages").doc(id);
    const pair=value=>value?{seconds:value.seconds,nanoseconds:value.nanoseconds}:null;
    const row=snapshot=>({exists:snapshot.exists,data:snapshot.data()??null,updateTime:pair(snapshot.updateTime)});
    const controls=await Promise.all([runRef.get(),fenceRef.get()]).then(rows=>rows.map(row));
    const namespacePaths=recoveryAuditNamespaces(uid,2),expected=new Map();
    for(const path of namespacePaths){
        const snapshot=await db.collection(path).orderBy(FieldPath.documentId()).get();
        expected.set(path,snapshot.docs.map(doc=>({path:doc.ref.path,updateTime:pair(doc.updateTime)})));
    }
    const assets=async()=>{
        const paths=["account","characters","economy","inventory","equipment","relics","relicLoadout","progress","claimCheckpoints","claimRecords"];
        const result=[[save.path,row(await save.get())]];
        for(const name of paths)for(const doc of (await root.collection(name).get()).docs)result.push([doc.ref.path,row(doc)]);
        return result.sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
    };
    const assetBefore=await assets();
    const closed=result=>{
        for(const key of ["authoritativeStateReady","candidateProofValid","trustedCaptureVerified","restoreAuthorized"])
            assert.equal(result[key],false,key+" must stay closed during inventory capture");
    };
    async function measured(operation,{reads,writes,queries}={}){
        const start=attempts.length,result=await operation(),actual=attempts.slice(start);
        assert.ok(actual.length>0);
        for(const attempt of actual){
            if(reads!==undefined)assert.ok(attempt.reads<=reads,`Inventory attempt read budget ${attempt.reads}>${reads}`);
            if(writes!==undefined)assert.ok(attempt.writes<=writes);
            if(queries!==undefined)assert.equal(attempt.queries,queries);
            else assert.ok(attempt.queries<=1,"A capture attempt may execute only one bounded namespace query");
            assert.ok(attempt.paths.includes(root.collection("sessionAuthority").doc("current").path));
            assert.ok(attempt.paths.includes(fenceRef.path));
        }
        closed(result);return {result,actual};
    }
    const prepare={auditId,expectedEpoch:1,operationId:"inventory-prepare-operation1"};
    const prepareRollback=createCanonicalCurrentRecovery({...deps,
        runRecoveryAuditMaintenance:(req,id,operation)=>authority.runRecoveryAuditMaintenance(req,id,async(tx,active)=>{
            await operation(tx,active);throw Error("inventory preparation rollback after staged state");
        })});
    await assert.rejects(()=>prepareRollback.prepareInventory(request(),prepare),/inventory preparation rollback/);
    assert.equal((await stateRef.get()).exists,false);
    const prepared=await measured(()=>recovery.prepareInventory(request(),prepare),{reads:10,writes:1,queries:0});
    assert.equal(prepared.result.nextSequence,1);
    assert.equal((await stateRef.get()).exists,true);
    const prepareVersion=row(await stateRef.get());
    const preparedRetry=await measured(()=>recovery.prepareInventory(request(),prepare),{reads:10,writes:0,queries:0});
    assert.equal(preparedRetry.result.unchanged,true);assert.deepEqual(row(await stateRef.get()),prepareVersion);
    let sequence=1,operationSerial=0;
    const input=()=>({auditId,expectedEpoch:1,operationId:`inventory-page-${String(++operationSerial).padStart(8,"0")}`,expectedSequence:sequence});
    const pages=[];
    async function accept(args,result){
        assert.equal(result.sequence,sequence);assert.ok(result.entryCount<=16);
        assert.equal(result.terminalEmpty,result.entryCount===0);
        const stored=await pageRef(args.operationId).get();assert.equal(stored.exists,true);
        const data=stored.data();assert.ok(Buffer.isBuffer(data.payloadBytes));assert.ok(data.payloadBytes.length<=128*1024);
        assert.equal(createHash("sha256").update(data.payloadBytes).digest("hex"),result.pageSha256);
        const payload=decodeInventoryPayload(data.payloadBytes),path=namespacePaths[result.namespaceIndex];
        assert.equal(payload.namespacePath,path);assert.equal(payload.sequence,sequence);
        const offset=pages.filter(page=>page.result.namespaceIndex===result.namespaceIndex)
            .reduce((sum,page)=>sum+page.result.entryCount,0);
        assert.deepEqual(payload.entries.map(entry=>({path:`${path}/${entry.id}`,updateTime:entry.updateTime})),
            expected.get(path).slice(offset,offset+result.entryCount),"Exact SDK updateTime seconds and nanoseconds must survive the typed payload");
        for(const entry of payload.entries){
            assert.deepEqual(Object.keys(entry).sort(),["id","typedDataByteLength","typedDataSha256","updateTime"]);
            assert.match(entry.typedDataSha256,/^[a-f0-9]{64}$/);assert.ok(entry.typedDataByteLength>0);
        }
        pages.push({args,result,data});sequence++;
    }
    // A real staged-write rollback must retain neither the new page nor its
    // cursor advance. The same operation can subsequently commit normally.
    const first=input(),beforeRollback=row(await stateRef.get());
    const rollback=createCanonicalCurrentRecovery({...deps,
        runRecoveryAuditMaintenance:(req,id,operation)=>authority.runRecoveryAuditMaintenance(req,id,async(tx,active)=>{
            await operation(tx,active);throw Error("inventory rollback after staged page writes");
        })});
    await assert.rejects(()=>rollback.captureInventoryPage(request(),first),/inventory rollback/);
    assert.deepEqual(row(await stateRef.get()),beforeRollback);assert.equal((await pageRef(first.operationId).get()).exists,false);
    const firstResult=await measured(()=>recovery.captureInventoryPage(request(),first),{reads:27,writes:2});
    await accept(first,firstResult.result);
    assert.equal(firstResult.result.entryCount,1);assert.equal(firstResult.result.terminalEmpty,false,
        "A nonempty namespace with fewer than16 rows still needs a real empty query");
    const originalPage=row(await pageRef(first.operationId).get()),originalState=row(await stateRef.get());
    const replay=await measured(()=>recovery.captureInventoryPage(request(),first),{reads:11,writes:0,queries:0});
    assert.equal(replay.result.unchanged,true);assert.equal(replay.result.pageSha256,firstResult.result.pageSha256);
    assert.deepEqual(row(await pageRef(first.operationId).get()),originalPage);assert.deepEqual(row(await stateRef.get()),originalState);
    await assert.rejects(()=>recovery.captureInventoryPage(request(),{...first,expectedSequence:first.expectedSequence+1}));
    assert.deepEqual(row(await stateRef.get()),originalState);
    await pageRef(first.operationId).update({payloadSha256:"0".repeat(64)}); // Explicit emulator-only receipt damage.
    await assert.rejects(()=>recovery.captureInventoryPage(request(),first),/seal|inconsistent|digest/i);
    assert.deepEqual(row(await stateRef.get()),originalState);
    await pageRef(first.operationId).set(originalPage.data); // Restore only the deliberately damaged test proof.
    // Keep real same-operation concurrency. Both first attempts may query;
    // only the committed retry is required to avoid another query.
    const concurrent=input();
    const race=await measured(()=>Promise.all([recovery.captureInventoryPage(request(),concurrent),
        recovery.captureInventoryPage(request(),concurrent)]).then(results=>{
        assert.equal(results[0].pageSha256,results[1].pageSha256);
        results.forEach(closed);
        assert.ok(results.some(result=>result.unchanged));return results[0];
    }),{reads:27,writes:2});
    await accept(concurrent,race.result);
    assert.equal(race.result.entryCount,0);assert.equal(race.result.terminalEmpty,true);
    let injected=false,retryCallbacks=0;
    const retrying=createCanonicalCurrentRecovery({...deps,
        runRecoveryAuditMaintenance:(req,id,operation)=>authority.runRecoveryAuditMaintenance(req,id,async(tx,active)=>{
            retryCallbacks++;const result=await operation(tx,active);
            if(!injected){injected=true;throw Object.assign(Error("inventory SDK callback retry"),{code:10});}
            return result;
        })});
    const retried=input(),retryResult=await measured(()=>retrying.captureInventoryPage(request(),retried),{reads:27,writes:2});
    assert.ok(retryCallbacks>=2);await accept(retried,retryResult.result);
    // A finite test guard covers every fixed namespace plus its explicit empty
    // tail and the one deliberately multi-page event namespace.
    for(let guard=0;!pages.at(-1).result.inventoryExhausted&&guard<namespacePaths.length*3+4;guard++){
        const next=input(),captured=await measured(()=>recovery.captureInventoryPage(request(),next),{reads:27,writes:2});
        await accept(next,captured.result);
    }
    assert.equal(pages.at(-1).result.inventoryExhausted,true);
    for(const [index,path] of namespacePaths.entries()){
        const captured=pages.filter(page=>page.result.namespaceIndex===index),source=expected.get(path);
        assert.ok(captured.length>0,path);
        assert.equal(captured.at(-1).result.terminalEmpty,true,path+" must terminate with an actual empty query");
        assert.equal(captured.reduce((sum,page)=>sum+page.result.entryCount,0),source.length,path);
    }
    const modeIndex=namespacePaths.indexOf(root.collection("modeTimeEvents").path);
    assert.deepEqual(pages.filter(page=>page.result.namespaceIndex===modeIndex).map(page=>page.result.entryCount),[16,2,0]);
    assert.equal((await runRef.collection("inventoryPages").get()).size,pages.length);
    assert.deepEqual(await Promise.all([runRef.get(),fenceRef.get()]).then(rows=>rows.map(row)),controls);
    assert.deepEqual(await assets(),assetBefore);
    // This already exhausted inventory has no proofState: select raw schema3
    // without another actor or inventory scan. Raw cursor exhaustion is NOT a
    // certificate that every earlier chunk/chain remains intact.
    const {decodeProofPayload}=require("../functions/src/recovery-audit-artifact.js");
    const {snapshotDigest}=require("../functions/src/canonical-snapshot.js");
    const rawState=runRef.collection("proofState").doc("current"),rawPage=id=>runRef.collection("patrolProofPages").doc(id);
    assert.equal((await rawState.get()).exists,false);
    const rawOrder=namespacePaths.flatMap(path=>expected.get(path)),rawFirst={auditId,expectedEpoch:1,operationId:"inventory-raw-page-operation1",expectedSequence:1,startOrdinal:0,count:16};
    assert.ok(rawOrder.length>16&&rawOrder.length<=32,"Reuse the existing bounded two-page inventory actor");
    const rawRollback=createCanonicalCurrentRecovery({...deps,runRecoveryAuditMaintenance:(req,id,operation)=>
        authority.runRecoveryAuditMaintenance(req,id,async(tx,active)=>{await operation(tx,active);throw Error("raw SDK staged rollback");})});
    await assert.rejects(()=>rawRollback.captureRawInventory(request(),rawFirst),/raw SDK staged rollback/);
    assert.equal((await rawState.get()).exists,false);assert.equal((await rawPage(rawFirst.operationId).get()).exists,false);
    const rawReceiptRows=new Map(),rawChunkRows=new Map();
    async function checkRaw(input,result){
        closed(result);assert.equal(result.proofKernelExecuted,false);assert.equal(Object.hasOwn(result,"rawComplete"),false);
        const receipt=(await rawPage(input.operationId).get()).data(),chunks=[];
        rawReceiptRows.set(input.operationId,{id:input.operationId,row:receipt});
        for(let index=0;index<result.chunkCount;index++){
            const doc=await runRef.collection("proofPayloadChunks").doc(input.operationId+"_"+String(index).padStart(2,"0")).get();
            assert.equal(doc.exists,true);assert.ok(Buffer.isBuffer(doc.get("payloadBytes")));assert.ok(doc.get("payloadBytes").length<=256*1024);chunks.push(doc.get("payloadBytes"));
            rawChunkRows.set(doc.id,{id:doc.id,row:doc.data()});
        }
        const bytes=Buffer.concat(chunks);assert.equal(bytes.length,result.payloadByteLength);assert.equal(createHash("sha256").update(bytes).digest("hex"),result.payloadSha256);
        const payload=decodeProofPayload(bytes);assert.equal(payload.schemaVersion,3);assert.equal(payload.documents.length,input.count);
        assert.deepEqual(payload.documents.map(doc=>({path:doc.path,updateTime:doc.updateTime})),rawOrder.slice(input.startOrdinal,input.startOrdinal+input.count));
        const {createdAt,...manifest}=receipt;assert.equal(snapshotDigest(manifest),result.receiptSha256);
        assert.equal(payload.previousReceiptSha256,result.previousReceiptSha256);
    }
    const rawStart=attempts.length,rawResult=await recovery.captureRawInventory(request(),rawFirst);await checkRaw(rawFirst,rawResult);
    assert.equal(rawResult.rawCursorExhausted,false);assert.equal(rawResult.previousReceiptSha256,null);
    for(const attempt of attempts.slice(rawStart)){assert.ok(attempt.reads<=400);assert.ok(attempt.reads<=14+pages.length+16);assert.ok(attempt.writes<=10);assert.equal(attempt.queries,3);}
    const rawRetryStart=attempts.length;assert.equal((await recovery.captureRawInventory(request(),rawFirst)).unchanged,true);
    for(const attempt of attempts.slice(rawRetryStart)){assert.ok(attempt.reads<=13+pages.length+rawResult.chunkCount);assert.equal(attempt.queries,1);assert.equal(attempt.writes,0);}
    const rawNext={...rawFirst,operationId:"inventory-raw-page-operation2",expectedSequence:2,startOrdinal:16,count:rawOrder.length-16};let rawCallbacks=0;
    const rawRetry=createCanonicalCurrentRecovery({...deps,runRecoveryAuditMaintenance:(req,id,operation)=>
        authority.runRecoveryAuditMaintenance(req,id,async(tx,active)=>{rawCallbacks++;const value=await operation(tx,active);
            if(rawCallbacks===1)throw Object.assign(Error("raw SDK callback retry"),{code:10});return value;})});
    const rawRaceStart=attempts.length,rawRace=await Promise.all([rawRetry.captureRawInventory(request(),rawNext),recovery.captureRawInventory(request(),rawNext)]);
    assert.ok(rawCallbacks>=2);assert.ok(rawRace.some(result=>result.unchanged));assert.equal(rawRace[0].payloadSha256,rawRace[1].payloadSha256);
    for(const result of rawRace){await checkRaw(rawNext,result);assert.equal(result.rawCursorExhausted,true);assert.equal(result.previousReceiptSha256,rawResult.receiptSha256);}
    for(const attempt of attempts.slice(rawRaceStart)){assert.ok(attempt.reads<=400);assert.ok(attempt.reads<=13+pages.length+16);assert.ok(attempt.writes<=10);assert.equal(attempt.queries,1);}
    // Reuse the real two-page capture, including native SDK Timestamp values.
    // Only these two cursor documents require additional live point reads;
    // inventory pages, run and raw receipts/chunks were already read above.
    const inventoryState=(await stateRef.get()).data(),finalRawState=(await rawState.get()).data();
    const rawMaterial={binding:{ownerUid:uid,auditId,epoch:1,sourceRevision:2,
        inventoryStateSha256:inventoryState.stateSha256},run:controls[0].data,inventoryState,
        inventoryPages:pages.map(page=>({id:page.args.operationId,row:page.data})),rawState:finalRawState,
        rawReceipts:[...rawReceiptRows.values()],rawChunks:[...rawChunkRows.values()]};
    // Snapshot only for mutation detection: Buffer.toJSON retains bytes and
    // native Timestamp.toJSON retains exact seconds/nanoseconds. The gameplay
    // typed codec deliberately does not accept this outer transport bundle.
    const materialBefore=JSON.stringify(rawMaterial),candidateAttemptStart=attempts.length;
    const candidate=await recovery.verifyRawRecoveryAuditCandidate(rawMaterial);
    assert.equal(candidate.candidateProofValid,true);assert.equal(candidate.ownerUid,uid);assert.equal(candidate.sourceRevision,2);
    for(const flag of ["authoritativeStateReady","trustedCaptureVerified","restoreAuthorized"])assert.equal(candidate[flag],false);
    assert.equal(candidate.documentCount,rawOrder.length);
    assert.equal(candidate.dependencyCount,candidate.documentCount+candidate.absenceCount);
    assert.ok(Object.isFrozen(candidate));assert.ok(!Object.values(candidate).some(value=>Buffer.isBuffer(value)));
    for(const key of ["records","documents","artifactBytes","restorePermit"])assert.equal(Object.hasOwn(candidate,key),false);
    const usage=candidate.assemblyUsage;assert.equal(usage.reservedBytes,0);
    assert.ok(usage.bytes<=256*1024*1024);assert.ok(usage.nodes<=16000000);
    assert.ok(usage.operations<=16384);assert.ok(usage.passes>1&&usage.passes<=64);assert.ok(usage.elapsedMs<=30000);
    assert.equal(JSON.stringify(rawMaterial),materialBefore);
    // Exhausted cursor alone cannot conceal a missing historical chunk. This
    // damaged in-memory bundle never changes or repairs the committed capture.
    const missingChunk={...rawMaterial,rawChunks:rawMaterial.rawChunks.slice(1)};
    await assert.rejects(()=>recovery.verifyRawRecoveryAuditCandidate(missingChunk));
    assert.equal(JSON.stringify(rawMaterial),materialBefore);assert.equal(attempts.length,candidateAttemptStart);
    console.log("PASS raw capture candidate actual SDK: original two-page bytes and native timestamps, complete chain through sole candidate encoder/original proofs, missing historical chunk refusal; candidate validity only, no trusted capture, restore or playable authority.");
    assert.deepEqual(await assets(),assetBefore);assert.deepEqual(await Promise.all([runRef.get(),fenceRef.get()]).then(rows=>rows.map(row)),controls);
    await assert.rejects(()=>patrol.observePresence(request(),{operationId:"inventory-fenced-heartbeat1",expectedRevision:2,
        expectedSequence:18,intent:"heartbeat",elementBox:"keep"}),/RECOVERY_AUDIT_MAINTENANCE/);
    // Expire the approval between real SDK attempts of an original page retry.
    // A second attempt must re-read its live gate rather than reuse a permit.
    let expiryCallbacks=0;
    const expiry=createCanonicalCurrentRecovery({...deps,
        runRecoveryAuditMaintenance:(req,id,operation)=>authority.runRecoveryAuditMaintenance(req,id,async(tx,active)=>{
            expiryCallbacks++;const result=await operation(tx,active);
            if(expiryCallbacks===1){clock+=61000;throw Object.assign(Error("inventory approval expires before retry"),{code:10});}
            return result;
        })});
    const frozenState=row(await stateRef.get());
    await assert.rejects(()=>expiry.captureInventoryPage(request(),first),/approval/i);
    assert.ok(expiryCallbacks>=2);assert.deepEqual(row(await stateRef.get()),frozenState);
    await assert.rejects(()=>recovery.captureRawInventory(request(),rawFirst));
    const oldRequest=request();
    while(Math.floor(Date.now()/1000)<=claims(token).auth_time)await new Promise(resolve=>setTimeout(resolve,100));
    const nextLogin=await login("accounts:signInWithPassword",{email,password});
    token=nextLogin.idToken;session=await invoke("createGameSession",token,{uid});
    await assert.rejects(()=>recovery.captureInventoryPage(oldRequest,first),/SESSION_REVOKED/);
    await assert.rejects(()=>recovery.captureRawInventory(oldRequest,rawFirst),/SESSION_REVOKED/);
    await assert.rejects(()=>recovery.captureInventoryPage(request(),first));
    await recovery.cancelAudit(request(),{operationId:"inventory-cancel-operation1",auditId,expectedEpoch:1});
    await assert.rejects(()=>recovery.captureInventoryPage(request(),first));
    await assert.rejects(()=>recovery.captureRawInventory(request(),rawFirst));
    assert.deepEqual(row(await stateRef.get()),frozenState);assert.deepEqual(await assets(),assetBefore);
    assert.equal((await save.get()).get("authoritativeStateReady"),false);
    console.log("PASS recovery inventory capture actual SDK: fixed namespaces,16-document pages and true-empty tails, metadata/cursor receipts, bounded reads/writes, rollback/retry/concurrent once-only, no-query lost-response replay, live expiry/takeover/cancel refusal and unchanged assets/readiness.");
}


// Reuse the genuine repeated-Forest/Lv10/second-character actor above. This
// segment captures proof only; it cannot publish, restore or credit assets.
{
    const {recoveryAuditNamespaces,decodeProofPayload,inventoryDocumentMetadata,PATROL_PROOF_LIMITS}=require("../functions/src/recovery-audit-artifact.js");
    const {createCanonicalPatrolSettlement}=require("../functions/src/canonical-patrol-settlement.js");
    const h=patrolProofSdkFixture;assert.ok(h);
    // This audit has its own control clock. The earning actor deliberately
    // advanced two minutes for rested EXP; that is not the SDK commit clock.
    const auditReadTime=(await h.save.get()).readTime;assert.ok(auditReadTime instanceof Timestamp);
    let clock=auditReadTime.toMillis();
    let originalTickets=await h.root.collection("patrolTickets").get();
    // Earlier rested/elite earnings can reach Lv10 in fewer than20 battles.
    // Top up only the missing genuine battles, rather than replaying a fixture.
    for(let guard=0;originalTickets.size<20&&guard<20;guard++){
        const next=await h.issue();await h.member(next.ticketId);await h.terminal(next.ticketId);
        originalTickets=await h.root.collection("patrolTickets").get();
    }
    assert.ok(originalTickets.size>=20);
    const revision=await h.revision(),original=await checkRecoveryArchive(h.uid,revision);
    assert.equal(original.get("sourceRecords.characters").length,2);
    assert.equal(original.get("sourceRecords.characters")[0].state.level,10);
    const full=createCanonicalPatrolSettlement({...h.deps,randomBytes:size=>Buffer.alloc(size,255)});
    const ticketId="proof-sdk-three-member-ticket1";
    const issued=await full.issueTicket(h.request(),{operationId:ticketId,expectedRevision:revision,
        triggerEntryId:"forest:0",availableEntryIds:["forest:0","forest:1","forest:2"]});
    assert.equal(issued.members.length,3);
    for(const memberIndex of [2,0,1])await full.settleMember(h.request(),{
        operationId:"proof-sdk-member-operation-"+memberIndex,expectedRevision:await h.revision(),ticketId,memberIndex});
    await full.settleTerminal(h.request(),{operationId:"proof-sdk-terminal-operation1",expectedRevision:await h.revision(),ticketId,kind:"win"});
    const adSourceId="proof-sdk-ad-begin-operation1",adCloseId="proof-sdk-ad-abandon-op0001";
    await full.beginSimulatedAd(h.request(),{operationId:adSourceId,expectedRevision:await h.revision(),
        expectedSequence:(await h.root.collection("modeTime").doc("current").get()).get("sequence")});
    await full.abandonSimulatedAd(h.request(),{operationId:adCloseId,expectedRevision:await h.revision(),sourceId:adSourceId,
        expectedSequence:(await h.root.collection("modeTime").doc("current").get()).get("sequence")});
    const sourceRevision=await h.revision();await checkRecoveryArchive(h.uid,sourceRevision);
    const attempts=[],observedDb={doc:path=>db.doc(path),runTransaction:callback=>db.runTransaction(async raw=>{
        const attempt={reads:0,queries:0,writes:0,paths:[],queryRefs:[]};attempts.push(attempt);
        const tx={get:async reference=>{const result=await raw.get(reference),query=typeof reference.collection!=="function";
            attempt.reads+=query?Math.max(1,result.size):1;
            if(query){attempt.queries++;attempt.queryRefs.push(reference);}else attempt.paths.push(reference.path);
            return result;}};
        for(const method of ["create","set","update","delete"])tx[method]=(...args)=>{attempt.writes++;return raw[method](...args);};
        return callback(tx);
    })};
    const authority=createSessionAuthority({db:observedDb,FieldValue,HttpsError,now:()=>clock});
    const deps={...h.deps,Timestamp,now:()=>clock,runProtected:authority.runProtected,
        runRecoveryAuditMaintenance:authority.runRecoveryAuditMaintenance};
    const recovery=createCanonicalCurrentRecovery(deps),auditId="proof-sdk-audit-operation1",approvalOperationId="proof-sdk-approval-operation1";
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:"proof-sdk-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId:approvalOperationId,sourceRevision,ttlSeconds:900}});
    await recovery.beginAudit(h.request(),{operationId:auditId,expectedRevision:sourceRevision,approvalOperationId});
    const run=h.root.collection("recoveryAuditRuns").doc(auditId),fence=h.root.collection("recoveryAuditFence").doc("current");
    const state=run.collection("proofState").doc("current"),receipt=id=>run.collection("patrolProofPages").doc(id),
        chunk=(id,index)=>run.collection("proofPayloadChunks").doc(id+"_"+String(index).padStart(2,"0"));
    const row=snap=>({exists:snap.exists,data:snap.data()??null,updateTime:snap.updateTime});
    const controls=await Promise.all([run.get(),fence.get()]).then(rows=>rows.map(row));
    const auditApproval=(await h.root.collection("recoveryApprovals").doc(approvalOperationId).get()).data();
    const compareAuditTime=(a,b)=>a.seconds-b.seconds||a.nanoseconds-b.nanoseconds;
    assert.ok(compareAuditTime(auditApproval.issuedAt,controls[0].data.createdAt)<=0&&
        compareAuditTime(controls[0].data.createdAt,auditApproval.expiresAt)<0,"Original audit commit must lie within its exact approval interval");
    const assets=await h.capture();
    const closed=result=>{for(const key of ["authoritativeStateReady","candidateProofValid","trustedCaptureVerified","restoreAuthorized"])assert.equal(result[key],false);};
    await recovery.prepareInventory(h.request(),{auditId,expectedEpoch:1,operationId:"proof-sdk-inventory-prepare1"});
    let exhausted=false;
    for(let sequence=1;!exhausted&&sequence<=318;sequence++){
        const result=await recovery.captureInventoryPage(h.request(),{auditId,expectedEpoch:1,
            operationId:"proof-sdk-inventory-page-"+String(sequence).padStart(8,"0"),expectedSequence:sequence});
        closed(result);exhausted=result.inventoryExhausted;
    }
    assert.equal(exhausted,true,"Actual long-history inventory must complete before proof capture");
    assert.equal(recoveryAuditNamespaces(h.uid,2).length,31);
    assert.ok((await run.collection("captureState").doc("current").get()).get("capturedCount")<=4096);
    async function measure(operation,{retry=false,fresh=false}={}){
        const start=attempts.length,result=await operation();closed(result);
        for(const attempt of attempts.slice(start)){
            assert.ok(attempt.reads<=400,"Full SDK attempt read budget");assert.ok(attempt.writes<=10);
            const expectedQueries=[run.collection("inventoryPages").limit(318),...(fresh?
                [run.collection("patrolProofPages").limit(1),run.collection("proofPayloadChunks").limit(1)]:[])];
            assert.equal(attempt.queries,expectedQueries.length,"Only exact audit metadata admission queries are allowed");
            for(const expected of expectedQueries)assert.equal(attempt.queryRefs.filter(reference=>reference.isEqual(expected)).length,1);
            if(retry){
                assert.ok(!attempt.paths.some(path=>/\/(patrolTickets|patrolTicketStates|patrolSettlements|patrolClosures)\//.test(path)),"Receipt retry must use original chunks without live Forest kernel source reads");
                for(const name of ["playableSnapshots","recoveryArchives"])assert.deepEqual(
                    attempt.paths.filter(path=>path.includes("/"+name+"/")),[h.root.collection(name).doc(String(sourceRevision)).path],
                    "Only the required current approval live gate may reread snapshot/archive");
            }
            const kernel=attempt.paths.filter(path=>!path.startsWith(run.path+"/")&&
                ![h.save.path,h.root.collection("sessionAuthority").doc("current").path,
                  h.root.collection("recoveryAuditFence").doc("current").path].includes(path));
            assert.ok(kernel.length<=60,"Original Forest point proof stays within declared60");
        }
        return result;
    }
    const input={auditId,expectedEpoch:1,operationId:"proof-sdk-capture-operation1",expectedSequence:1,component:"forest-ticket",sourceId:ticketId};
    const rollback=createCanonicalCurrentRecovery({...deps,runRecoveryAuditMaintenance:(req,id,operation)=>
        authority.runRecoveryAuditMaintenance(req,id,async(tx,session)=>{await operation(tx,session);throw Error("proof SDK staged rollback");})});
    await assert.rejects(()=>rollback.captureProof(h.request(),input),/proof SDK staged rollback/);
    assert.equal((await state.get()).exists,false);assert.equal((await receipt(input.operationId).get()).exists,false);
    assert.equal((await run.collection("proofPayloadChunks").get()).empty,true);
    const result=await measure(()=>recovery.captureProof(h.request(),input),{fresh:true});
    assert.equal(result.component,"forest-ticket");assert.ok(result.payloadByteLength<=2*1024*1024);
    assert.ok(result.chunkCount>=1&&result.chunkCount<=8);assert.equal(PATROL_PROOF_LIMITS.chunks,8);
    const chunks=await Promise.all(Array.from({length:result.chunkCount},(_,index)=>chunk(input.operationId,index).get()));
    for(const snap of chunks){assert.equal(snap.exists,true);assert.ok(Buffer.isBuffer(snap.get("payloadBytes")));
        assert.ok(snap.get("payloadBytes").length<=256*1024);assert.ok(snap.updateTime);}
    const payload=Buffer.concat(chunks.map(snap=>snap.get("payloadBytes")));
    assert.equal(payload.length,result.payloadByteLength);assert.equal(createHash("sha256").update(payload).digest("hex"),result.payloadSha256);
    assert.ok(decodeProofPayload(payload));
    const proofState=row(await state.get()),proofReceipt=row(await receipt(input.operationId).get());
    const replay=await measure(()=>recovery.captureProof(h.request(),input),{retry:true});assert.equal(replay.unchanged,true);
    assert.deepEqual(row(await state.get()),proofState);assert.deepEqual(row(await receipt(input.operationId).get()),proofReceipt);
    for(const removeReceipt of [false,true]){
        await state.delete();if(removeReceipt)await receipt(input.operationId).delete();
        const orphan={...input,operationId:removeReceipt?"proof-sdk-missing-both-001":"proof-sdk-missing-state-01"};
        const start=attempts.length;
        await assert.rejects(()=>recovery.captureProof(h.request(),orphan));
        assert.ok(attempts.slice(start).every(attempt=>attempt.writes===0));
        assert.equal((await state.get()).exists,false);assert.equal((await receipt(orphan.operationId).get()).exists,false);
        for(const old of chunks)assert.deepEqual((await old.ref.get()).data(),old.data(),"Orphan rejection cannot repair or mutate original chunks");
        // Restore the exact intentionally removed emulator metadata, not a new seal.
        await state.set(proofState.data);if(removeReceipt)await receipt(input.operationId).set(proofReceipt.data);
    }
    for(const damage of ["missing","corrupt"]){
        const ref=chunks[0].ref,bytes=chunks[0].data();
        if(damage==="missing")await ref.delete();else await ref.update({payloadBytes:Buffer.from("damaged proof chunk")});
        const start=attempts.length;
        await assert.rejects(()=>recovery.captureProof(h.request(),input));
        assert.ok(attempts.slice(start).every(attempt=>attempt.writes===0));
        assert.deepEqual((await state.get()).data(),proofState.data);
        if(damage==="missing")assert.equal((await ref.get()).exists,false);
        await ref.set(bytes); // Restore only explicitly damaged emulator proof.
    }
    const second={...input,operationId:"proof-sdk-capture-operation2",expectedSequence:2,sourceId:originalTickets.docs[0].id};
    let callbacks=0;
    const retrying=createCanonicalCurrentRecovery({...deps,runRecoveryAuditMaintenance:(req,id,operation)=>
        authority.runRecoveryAuditMaintenance(req,id,async(tx,session)=>{callbacks++;const value=await operation(tx,session);
            if(callbacks===1)throw Object.assign(Error("proof actual SDK callback retry"),{code:10});return value;})});
    const retryStart=attempts.length;
    await measure(()=>retrying.captureProof(h.request(),second));assert.ok(callbacks>=2);
    assert.ok(attempts.slice(retryStart).every(attempt=>attempt.paths.includes(h.root.collection("patrolTickets").doc(second.sourceId).path)),
        "Every SDK attempt must record the live ticket with a fresh source cache");
    const stale={...second,operationId:"proof-sdk-stale-sequence-01"},staleStart=attempts.length;
    await assert.rejects(()=>recovery.captureProof(h.request(),stale));
    assert.ok(attempts.slice(staleStart).every(attempt=>attempt.writes===0));
    assert.equal((await receipt(stale.operationId).get()).exists,false);
    const third={...second,operationId:"proof-sdk-capture-operation3",expectedSequence:3,sourceId:originalTickets.docs[1].id};
    const start=attempts.length,race=await Promise.all([recovery.captureProof(h.request(),third),recovery.captureProof(h.request(),third)]);
    assert.ok(race.some(value=>value.unchanged));assert.equal(race[0].payloadSha256,race[1].payloadSha256);race.forEach(closed);
    assert.ok(attempts.slice(start).every(attempt=>attempt.reads<=400&&attempt.writes<=10));
    const allocation=(await h.root.collection("operations").where("kind","==","exp-allocation").limit(1).get()).docs[0];
    assert.ok(allocation,"The existing genuine Lv10 actor must retain original EXP allocation proof");
    const expInput={...input,operationId:"proof-sdk-exp-capture-0001",expectedSequence:4,component:"exp-allocation",sourceId:allocation.id};
    const expResult=await measure(()=>recovery.captureProof(h.request(),expInput));assert.equal(expResult.component,"exp-allocation");
    const expReplayStart=attempts.length,expReplay=await measure(()=>recovery.captureProof(h.request(),expInput),{retry:true});assert.equal(expReplay.unchanged,true);
    assert.ok(attempts.slice(expReplayStart).every(attempt=>!["operations","ledgerEntries","grantOperations"].some(name=>
        attempt.paths.includes(h.root.collection(name).doc(allocation.id).path))),"EXP receipt retry must not rerun its live debit kernel");
    const additional=(await h.root.collection("operations").where("kind","==","additional-character-sources").limit(1).get()).docs[0];
    assert.ok(additional,"The genuine second-character operation must remain available");
    const additionalInput={...input,operationId:"proof-sdk-additional-capture1",expectedSequence:5,component:"additional-character-sources",sourceId:additional.id};
    const additionalResult=await measure(()=>recovery.captureProof(h.request(),additionalInput));assert.equal(additionalResult.component,"additional-character-sources");
    const additionalReplayStart=attempts.length;
    assert.equal((await measure(()=>recovery.captureProof(h.request(),additionalInput),{retry:true})).unchanged,true);
    assert.ok(attempts.slice(additionalReplayStart).every(attempt=>!["operations","ledgerEntries","grantOperations"].some(name=>
        attempt.paths.includes(h.root.collection(name).doc(additional.id).path))),"Additional-character retry must use original chunks without live source reads");
    const adInput={...input,operationId:"proof-sdk-ad-capture-operation1",expectedSequence:6,component:"simulated-ad-source",sourceId:adSourceId};
    assert.equal((await measure(()=>recovery.captureProof(h.request(),adInput))).component,"simulated-ad-source");
    const adReplayStart=attempts.length;assert.equal((await measure(()=>recovery.captureProof(h.request(),adInput),{retry:true})).unchanged,true);
    assert.ok(attempts.slice(adReplayStart).every(attempt=>!attempt.paths.some(path=>path===h.root.collection("simulatedAdSources").doc(adSourceId).path||
        path===h.root.collection("modeTimeEvents").doc(adSourceId).path||path===h.root.collection("modeTimeEvents").doc(adCloseId).path)),
        "Simulated-ad retry must replay original chunks without live source/event reads");
    const originalReopen=(await h.root.collection("modeTimeEvents").where("intent.action","==","reopen").limit(1).get()).docs[0];
    assert.ok(originalReopen);assert.equal(originalReopen.get("schemaVersion"),1);assert.equal(originalReopen.get("modeChanged"),false);
    const modeInput={...input,operationId:"proof-sdk-mode-capture-operation1",expectedSequence:7,component:"mode-nonvalue-event",sourceId:originalReopen.id};
    assert.equal((await measure(()=>recovery.captureProof(h.request(),modeInput))).component,"mode-nonvalue-event");
    const modeReplayStart=attempts.length;assert.equal((await measure(()=>recovery.captureProof(h.request(),modeInput),{retry:true})).unchanged,true);
    assert.ok(attempts.slice(modeReplayStart).every(attempt=>!attempt.paths.some(path=>["modeTimeEvents","operations","ledgerEntries","grantOperations"].some(name=>
        path===h.root.collection(name).doc(originalReopen.id).path))),"Non-value mode retry must use original chunks without live source/economic reads");
    assert.deepEqual(await Promise.all([run.get(),fence.get()]).then(rows=>rows.map(row)),controls);
    // Asset/current/history versions cannot be changed by a proof-only capture.
    assert.deepEqual(await h.capture(),assets);
    // A same-value update may be a no-op. Force a real isolated metadata
    // change, then restore exact original data before testing the version seal.
    const changedTicket=originalTickets.docs[2],namespace=h.root.collection("patrolTickets").path;
    const originalData=changedTicket.data(),originalMetadata=inventoryDocumentMetadata(changedTicket,namespace);
    const stamp=value=>({seconds:value.seconds,nanoseconds:value.nanoseconds});
    assert.ok(originalData.createdAt instanceof Timestamp);
    await changedTicket.ref.update({createdAt:Timestamp.fromMillis(originalData.createdAt.toMillis()+1)});
    const intermediate=await changedTicket.ref.get(),intermediateMetadata=inventoryDocumentMetadata(intermediate,namespace);
    assert.notDeepEqual(intermediate.data(),originalData);
    assert.notEqual(intermediateMetadata.typedDataSha256,originalMetadata.typedDataSha256);
    assert.notDeepEqual(stamp(intermediate.updateTime),stamp(changedTicket.updateTime));
    await changedTicket.ref.set(originalData);
    const restoredTicket=await changedTicket.ref.get(),restoredMetadata=inventoryDocumentMetadata(restoredTicket,namespace);
    assert.deepEqual(restoredTicket.data(),originalData);
    assert.equal(restoredMetadata.typedDataSha256,originalMetadata.typedDataSha256);
    assert.equal(restoredMetadata.typedDataByteLength,originalMetadata.typedDataByteLength);
    assert.notDeepEqual(stamp(restoredTicket.updateTime),stamp(changedTicket.updateTime));
    const changedInput={...input,operationId:"proof-sdk-version-changed-01",expectedSequence:8,sourceId:changedTicket.id};
    let changedStart=attempts.length;
    await assert.rejects(()=>recovery.captureProof(h.request(),changedInput));
    assert.ok(attempts.slice(changedStart).every(attempt=>attempt.writes===0));
    assert.equal((await receipt(changedInput.operationId).get()).exists,false);
    clock+=901000;
    const finalState=row(await state.get());let before=attempts.length;
    await assert.rejects(()=>recovery.captureProof(h.request(),input));assert.ok(attempts.slice(before).every(a=>a.writes===0));
    const oldRequest=h.request();
    while(Math.floor(Date.now()/1000)<=claims(h.token).auth_time)await new Promise(resolve=>setTimeout(resolve,100));
    const next=await login("accounts:signInWithPassword",{email:h.email,password});
    h.setIdentity(next.idToken,await invoke("createGameSession",next.idToken,{uid:h.uid}));
    await assert.rejects(()=>recovery.captureProof(oldRequest,input),/SESSION_REVOKED/);
    await recovery.cancelAudit(h.request(),{operationId:"proof-sdk-cancel-operation1",auditId,expectedEpoch:1});
    await assert.rejects(()=>recovery.captureProof(h.request(),input));assert.deepEqual(row(await state.get()),finalState);
    assert.equal((await h.save.get()).get("authoritativeStateReady"),false);
    console.log("PASS Forest proof component actual SDK: genuine multi-battle/Lv10/slot2 plus three-member unit, complete inventory admission, typed bounded chunks committed by real SDK, rollback/retry/CAS concurrency, original-chunk receipt replay, missing/corrupt chunk zero repair, live gates and all readiness closed. Payload bytes are not SDK wire-size measurements.");
}

// Private publication acceptance: real Firestore/Session/query/Timestamp only;
// object storage is explicitly fake and cannot contact GCS or change IAM.
{
    const h=patrolProofSdkFixture;assert.ok(h);
    const publicationReadTime=(await h.save.get()).readTime;assert.ok(publicationReadTime instanceof Timestamp);
    let clock=publicationReadTime.toMillis(),abortOnce=false,rollbackOnce=false,loseResponse=false;
    const publicationTransactions=new AsyncLocalStorage();
    const traces=[],observedDb={doc:path=>db.doc(path),runTransaction:callback=>db.runTransaction(async raw=>{
        const trace={reads:0,queries:0,writes:0};traces.push(trace);
        const tx={get:async ref=>{const snap=await raw.get(ref),query=typeof ref.collection!=="function";
            trace.reads+=query?Math.max(1,snap.size):1;trace.queries+=query?1:0;return snap;}};
        for(const name of ["create","set","update","delete"])tx[name]=(...args)=>{trace.writes++;return raw[name](...args);};
        // Only this callback's async descendants are inside its transaction.
        // A different concurrent callback must not mark an outside publisher.
        return publicationTransactions.run(Object.freeze({transaction:true}),()=>callback(tx));
    })};
    const authority=createSessionAuthority({db:observedDb,FieldValue,HttpsError,now:()=>clock});
    const maintenance=async(req,id,operation,publicationId)=>{
        const result=await authority.runRecoveryAuditMaintenance(req,id,async(tx,session)=>{
            const value=await operation(tx,session);
            if(abortOnce){abortOnce=false;throw Object.assign(Error("publication SDK retry"),{code:10});}
            if(rollbackOnce){rollbackOnce=false;throw Error("publication staged rollback");}
            return value;
        },publicationId);
        if(loseResponse){loseResponse=false;throw Error("publication lost ACK response");}
        return result;
    };
    const deps={...h.deps,Timestamp,now:()=>clock,runProtected:authority.runProtected,runRecoveryAuditMaintenance:maintenance};
    const recovery=createCanonicalCurrentRecovery(deps),auditId="publication-sdk-audit-0001",approvalId="publication-sdk-approval-01";
    const sourceRevision=await h.revision();
    assert.ok((await h.root.collection("patrolTickets").get()).size>=20);
    const before=await checkRecoveryArchive(h.uid,sourceRevision);
    assert.equal(before.get("sourceRecords.characters").length,2);assert.equal(before.get("sourceRecords.characters")[0].state.level,10);
    await createCanonicalRecoveryApproval(deps).issue({auth:{uid:"publication-operator",token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId:approvalId,sourceRevision,ttlSeconds:900}});
    // Exercise the actual staged callable over the existing emulator HTTP
    // boundary. Publication below deliberately fails its epoch gate before IO;
    // successful provider publication remains SDK + lexical fake-Storage only.
    const callMaintenance=(action,intent,extra={})=>invoke("maintainCanonicalRecoveryAudit",h.token,
        {...h.request().data,action,intent,...extra});
    await rejected("maintainCanonicalRecoveryAudit",null,{...h.request().data,action:"resume",intent:{}},"UNAUTHENTICATED");
    const begun=await callMaintenance("begin",{operationId:auditId,expectedRevision:sourceRevision,approvalOperationId:approvalId});
    assert.equal(begun.epoch,2);
    assert.equal((await callMaintenance("resume",{auditId,expectedEpoch:2,expectedRevision:sourceRevision})).status,"active");
    await assert.rejects(()=>callMaintenance("captureProof",{}),/Unsupported/);
    await assert.rejects(()=>callMaintenance("resume",{auditId,expectedEpoch:2,expectedRevision:sourceRevision},{bytes:"forged"}),/exact/i);
    await assert.rejects(()=>callMaintenance("resume",{auditId,expectedEpoch:2,expectedRevision:sourceRevision},{uid:"foreign-owner"}));
    const assets=await h.capture();
    const args={auditId,expectedEpoch:2,operationId:"publication-sdk-manifest-01"},run=h.root.collection("recoveryAuditRuns").doc(auditId);
    const publicationApproval=(await h.root.collection("recoveryApprovals").doc(approvalId).get()).data(),publicationRun=(await run.get()).data();
    const comparePublicationTime=(a,b)=>a.seconds-b.seconds||a.nanoseconds-b.nanoseconds;
    assert.ok(comparePublicationTime(publicationApproval.issuedAt,publicationRun.createdAt)<=0&&
        comparePublicationTime(publicationRun.createdAt,publicationApproval.expiresAt)<0,"Publication audit commit must lie within its exact approval interval");
    await callMaintenance("prepareInventory",{...args,operationId:"publication-sdk-prepare-inventory"});
    let complete=false;
    for(let sequence=1;!complete&&sequence<=318;sequence++)complete=(await callMaintenance("captureInventoryPage",{
        ...args,operationId:"publication-sdk-inventory-"+String(sequence).padStart(6,"0"),expectedSequence:sequence})).inventoryExhausted;
    assert.equal(complete,true);
    const count=(await run.collection("captureState").doc("current").get()).get("capturedCount");let offset=0;
    for(let sequence=1;offset<count;sequence++)offset=(await callMaintenance("captureRawInventory",{
        ...args,operationId:"publication-sdk-raw-"+String(sequence).padStart(6,"0"),expectedSequence:sequence,startOrdinal:offset,count:Math.min(16,count-offset)})).nextOrdinal;
    await assert.rejects(()=>callMaintenance("publish",{...args,expectedEpoch:999}),/epoch|session/i);
    const objects=new Map(),ioCalls=[];let nextGeneration=9007199254740993n,lostCreate=true;
    const io={bucketName:"fake-private-candidate-bucket",
        async lookupMetadata(input){assert.equal(publicationTransactions.getStore(),undefined);ioCalls.push("lookup");return objects.get(input.objectName)?.metadata??null;},
        async createOnly(input){
            assert.equal(publicationTransactions.getStore(),undefined);ioCalls.push("create");assert.equal(input.ifGenerationMatch,"0");
            if(objects.has(input.objectName))throw Object.assign(Error("exists"),{code:"ALREADY_EXISTS"});
            const metadata={bucketName:input.bucketName,objectName:input.objectName,generation:String(nextGeneration++),size:input.bytes.length};
            objects.set(input.objectName,{metadata,bytes:Buffer.from(input.bytes)});
            if(lostCreate){lostCreate=false;throw Object.assign(Error("lost create response"),{code:"UNKNOWN_COMMIT"});}return metadata;
        },
        async readExact(input){assert.equal(publicationTransactions.getStore(),undefined);ioCalls.push("read");const value=objects.get(input.objectName);
            if(!value||value.metadata.generation!==input.generation)throw Error("missing exact fake generation");
            return {metadata:{...value.metadata},bytes:Buffer.from(value.bytes)};
        }};
    // Prove the guard still rejects every IO method from an actual callback,
    // before any fake Storage side effect. The parallel publishers below
    // independently prove that another callback cannot cause a false refusal.
    await observedDb.runTransaction(async tx=>{
        await tx.get(h.save);
        for(const method of ["lookupMetadata","createOnly","readExact"])
            await assert.rejects(()=>io[method]({}),{code:"ERR_ASSERTION"});
    });
    assert.equal(ioCalls.length,0);assert.equal(objects.size,0);
    // Lexical fake IO is confined to this test compilation, never request/env
    // injection into the deployed factory or an actual provider operation.
    const filename=require.resolve("../functions/src/canonical-current-recovery.js"),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(filename.slice(0,Math.max(filename.lastIndexOf("/"),filename.lastIndexOf("\\"))));
    const native=compiled.require.bind(compiled);compiled.require=name=>name==="test-only-publication-fake-io"?io:
        name==="./recovery-candidate-storage"?{createRecoveryCandidateStorage:()=>io}:native(name);
    const needle="return Object.freeze({restoreCurrent,verifyRecoveryAuditArtifact",source=readFileSync(filename,"utf8");
    assert.equal(source.split(needle).length,2);
    compiled._compile(source.replace("return buildRecoveryOwner(deps,null,false);","return buildRecoveryOwner(deps,require('test-only-publication-fake-io'),false);")
        .replace(needle,"return Object.freeze({pinCandidatePublication,loadPinnedRawCapture,assemblePinnedCandidate,prepareCandidatePublication,publishPreparedCandidate,ackCandidatePublication,restoreCurrent,verifyRecoveryAuditArtifact"),filename);
    const publication=compiled.exports.createCanonicalCurrentRecovery(deps);
    assert.equal(Object.hasOwn(recovery,"pinCandidatePublication"),false);
    async function gate(operation,writes){const start=traces.length,result=await operation();
        assert.ok(traces.length>start);for(const trace of traces.slice(start)){assert.equal(trace.reads,13);assert.equal(trace.queries,0);assert.ok(trace.writes<=writes);}return result;}
    const pin=await gate(()=>publication.pinCandidatePublication(h.request(),args),0),scanStart=traces.length;
    const material=await publication.loadPinnedRawCapture(pin),artifact=await publication.assemblePinnedCandidate(pin,material);
    assert.equal(traces.length,scanStart,"Outside SDK snapshot scans and memory proof do not run a protected transaction");
    const manifestRef=run.collection("candidatePublications").doc(args.operationId);
    rollbackOnce=true;await assert.rejects(()=>publication.prepareCandidatePublication(h.request(),pin,artifact),/staged rollback/);
    assert.equal((await manifestRef.get()).exists,false);
    abortOnce=true;const prepared=await gate(()=>publication.prepareCandidatePublication(h.request(),pin,artifact),1);
    await gate(()=>publication.prepareCandidatePublication(h.request(),pin,artifact),0);
    const manifest=(await manifestRef.get()).data();
    const proof=await gate(()=>publication.publishPreparedCandidate(h.request(),prepared),0);
    assert.equal(ioCalls.filter(name=>name==="create").length,1);assert.equal(objects.size,1);
    loseResponse=true;await assert.rejects(()=>publication.ackCandidatePublication(h.request(),prepared,proof),/lost ACK response/);
    assert.equal((await manifestRef.get()).get("status"),"acknowledged");
    await assert.rejects(()=>publication.ackCandidatePublication(h.request(),prepared,proof),/unconsumed/);
    const refreshed=await gate(()=>publication.publishPreparedCandidate(h.request(),prepared),0);
    const ack=await gate(()=>publication.ackCandidatePublication(h.request(),prepared,refreshed),0);
    assert.equal(ack.generation,"9007199254740993");assert.equal(ack.unchanged,true);
    const {generation,objectSize,ackAt,...ackTuple}=(await manifestRef.get()).data();
    assert.deepEqual(ackTuple,{...manifest,status:"acknowledged"});assert.equal(objectSize,manifest.artifactByteLength);assert.ok(ackAt instanceof Timestamp);
    for(const key of ["candidateProofValid","trustedCaptureVerified","restoreAuthorized","authoritativeStateReady"])assert.equal(ack[key],false);
    const freshProofs=await Promise.all([publication.publishPreparedCandidate(h.request(),prepared),publication.publishPreparedCandidate(h.request(),prepared)]);
    const raced=await Promise.all(freshProofs.map(value=>publication.ackCandidatePublication(h.request(),prepared,value)));
    assert.ok(raced.every(value=>value.unchanged));assert.equal((await run.collection("candidatePublications").get()).size,1);
    const stagedMaintenance=compiled.exports.createCanonicalRecoveryMaintenance(deps),ioBeforeReplay=ioCalls.length;
    const maintenanceAck=await stagedMaintenance.maintain({...h.request(),data:{...h.request().data,action:"publish",intent:args}});
    assert.equal(maintenanceAck.unchanged,true);assert.equal(maintenanceAck.generation,"9007199254740993");
    assert.ok(ioCalls.length>ioBeforeReplay);assert.equal(ioCalls.filter(name=>name==="create").length,1);
    for(const key of ["candidateProofValid","trustedCaptureVerified","restoreAuthorized","authoritativeStateReady"])assert.equal(maintenanceAck[key],false);
    assert.deepEqual(Object.keys(stagedMaintenance),["maintain"]);
    assert.ok(process.memoryUsage().rss<1024*1024*1024,"Representative SDK fixture RSS stays below configured 1GiB; not a worst-case capacity proof");
    const pending=await publication.publishPreparedCandidate(h.request(),prepared);clock+=901000;
    const ioBefore=ioCalls.length,attemptStart=traces.length;
    await assert.rejects(()=>publication.ackCandidatePublication(h.request(),prepared,pending),/approval/i);
    await assert.rejects(()=>publication.publishPreparedCandidate(h.request(),prepared),/approval/i);
    assert.equal(ioCalls.length,ioBefore);assert.ok(traces.slice(attemptStart).every(value=>value.writes===0));
    assert.deepEqual(await h.capture(),assets);
    const oldRequest=h.request(),oldToken=h.token;
    while(Math.floor(Date.now()/1000)<=claims(h.token).auth_time)await new Promise(resolve=>setTimeout(resolve,100));
    const next=await login("accounts:signInWithPassword",{email:h.email,password});
    h.setIdentity(next.idToken,await invoke("createGameSession",next.idToken,{uid:h.uid}));
    await assert.rejects(()=>invoke("maintainCanonicalRecoveryAudit",oldToken,{...oldRequest.data,action:"resume",intent:{auditId,expectedEpoch:2,expectedRevision:sourceRevision}}),/SESSION_REVOKED/);
    await assert.rejects(()=>publication.publishPreparedCandidate(oldRequest,prepared),/SESSION_REVOKED/);
    await assert.rejects(()=>publication.publishPreparedCandidate(h.request(),prepared),/epoch or session/);
    await callMaintenance("cancel",{auditId,expectedEpoch:2,operationId:"publication-sdk-cancel-audit"});
    await assert.rejects(()=>publication.publishPreparedCandidate(h.request(),prepared));
    assert.deepEqual((await checkRecoveryArchive(h.uid,sourceRevision)).data(),before.data());
    assert.equal((await h.save.get()).get("authoritativeStateReady"),false);
    console.log("PASS staged Recovery maintenance: actual Auth/HTTP six successful actions, unknown/excess/foreign/replaced-session rejection, publish stale epoch before provider IO; SDK + lexical fake Storage positive publish/replay keeps four flags false. Representative RSS below 1GiB, not maximum payload capacity or real GCS proof.");
    console.log("PASS private immutable candidate publication: actual Firestore Session/SDK cursors/Timestamps on existing20-battle Lv10/slot2 actor; original raw full-chain/strict proofs;13-point gates, rollback/SDK retry, exact immutable tuple, fakeStorage-only64-bit generation/fullread/lost responses/read-only ACK races, expiry/takeover/cancel refusal. No actual GCS, production adapter, trusted backup or restore authority.");
}

// Internal skill configuration only. A fresh isolated account keeps all prior
// actors, retained histories and their exact assertions unchanged.
{
    const {createCanonicalSkillLearning}=require("../functions/src/canonical-skill-learning.js");
    const account=await login("accounts:signUp",{email:"canonical-skill-learning-sdk@example.test",password});
    const uid=account.localId,token=account.idToken,session=await invoke("createGameSession",token,{uid});
    const identity={uid,session},empty=await invoke("bootstrapCloudSave",token,identity);
    await invoke("createInitialCanonicalCharacter",token,{...identity,selection:choices,expectedRevision:empty.serverRevision});
    const root=db.collection("serverUsers").doc(uid),save=db.doc(`users/${uid}/saves/current`);
    const decoded=await getAuth(testApp).verifyIdToken(token,true);
    const request={auth:{uid,token:decoded},data:identity},accountSource=await root.collection("account").doc("current").get();
    const characterId=accountSource.get("slots")[0],characterRef=root.collection("characters").doc(characterId);
    const originalCharacter=(await characterRef.get()).data(),before=await checkRecoveryArchive(uid,2);
    const traces=[];
    const protectedRun=(req,fn)=>writerSessions.runProtected(req,async(tx,active)=>{
        const trace={reads:0,writes:0};traces.push(trace);
        const observed={get:async reference=>{
            assert.equal(trace.writes,0,"skill transactions finish all reads before any write");
            const snapshot=await tx.get(reference);trace.reads+=snapshot.docs?Math.max(1,snapshot.size):1;return snapshot;
        }};
        for(const method of ["create","update","set","delete"])observed[method]=(...args)=>{trace.writes++;return tx[method](...args);};
        return fn(observed,active);
    });
    const deps={db,FieldValue,HttpsError,inspectExistingEnvelope,nextRevision,runProtected:protectedRun};
    const writer=createCanonicalSkillLearning(deps),intent={operationId:"skill-sdk-original-learn-001",expectedRevision:2,
        characterId,action:"learn",skillId:"waterKnife"};
    const lost=createCanonicalSkillLearning({...deps,runProtected:async(req,fn)=>{
        await protectedRun(req,fn);throw Error("skill SDK committed response lost");
    }});
    await assert.rejects(()=>lost.learnOrUpgrade(request,intent),/committed response lost/);
    assert.equal((await save.get()).get("serverRevision"),3);
    const learned=(await characterRef.get()).data(),archive=await checkRecoveryArchive(uid,3);
    assert.equal(learned.state.skillPoints,originalCharacter.state.skillPoints-2);
    assert.deepEqual(learned.skillLoadout.skillLevels,{waterKnife:1});
    assert.deepEqual(learned.skillLoadout.equippedSkills,originalCharacter.skillLoadout.equippedSkills);
    assert.equal(archive.get("sourceRecords.characters")[0].skillLoadout.skillLevels.waterKnife,1);
    const operation=await root.collection("operations").doc(intent.operationId).get();
    const ledger=await root.collection("ledgerEntries").doc(intent.operationId).get();
    assert.equal(operation.get("kind"),"skill-learning");assert.equal(ledger.get("amount"),-2);
    const replayStart=traces.length,replay=await writer.learnOrUpgrade(request,intent);
    assert.equal(replay.unchanged,true);assert.ok(traces.slice(replayStart).every(trace=>trace.writes===0));
    for(const flag of ["authoritativeStateReady","readyForRestore","rewardEligible","outcomeVerified"])assert.equal(replay[flag],false);
    const unchanged=async(operation,pattern)=>{
        const start=traces.length;await assert.rejects(operation,pattern);
        assert.ok(traces.slice(start).every(trace=>trace.writes===0));
        assert.equal((await save.get()).get("serverRevision"),3);
        assert.deepEqual((await characterRef.get()).data(),learned);
    };
    await unchanged(()=>writer.learnOrUpgrade(request,{...intent,operationId:"skill-sdk-stale-intent-001"}),/CLOUD_REVISION_CONFLICT/);
    await unchanged(()=>writer.learnOrUpgrade(request,{...intent,expectedRevision:3,operationId:"skill-sdk-foreign-intent-01",characterId:"foreign-character"}),/not owned/);
    await unchanged(()=>writer.learnOrUpgrade(request,{...intent,amount:1}),/bounded skill/);
    await unchanged(()=>writer.learnOrUpgrade({...request,auth:{uid:"foreign-uid",token:decoded}},intent),/UID|SESSION/);
    const originalArchiveRef=root.collection("recoveryArchives").doc("2");
    await originalArchiveRef.delete();
    await unchanged(()=>writer.learnOrUpgrade(request,intent),/sources are missing or corrupt/);
    await originalArchiveRef.set(before.data());
    assert.equal((await writer.learnOrUpgrade(request,intent)).unchanged,true);
    assert.deepEqual((await root.collection("operations").doc(intent.operationId).get()).data(),operation.data());
    assert.deepEqual((await root.collection("ledgerEntries").doc(intent.operationId).get()).data(),ledger.data());
    console.log("PASS internal skill learning: real Auth/Session and Firestore atomic initial-point debit, immutable snapshot/archive transition, committed lost response, zero-write original-policy replay and stale/foreign/missing-source refusal. No callable, equip, combat or readiness activation.");
}

await db.terminate();
if(direct){await getFirestore().terminate();}
