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
const {inspectExistingEnvelope,nextRevision}=require("../functions/src/cloud-save-envelope.js");
const project="demo-four-symbols-session";
if(process.env.GCLOUD_PROJECT!==project||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||
   process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099"){
    throw new Error("Run only via the dedicated demo session emulators config.");
}
const testApp=initializeApp({projectId:project},"session-authority-test");
const db=getFirestore(testApp);
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
    attributes:{attack:2,vitality:2,energy:2,intelligence:2,spirit:1,agility:1}};
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
assert.equal((await db.doc(`users/${y}/saves/current`).get()).get("serverRevision"),1);
const initialized=await initialWriter.commitInitialSources(yRequest,initialArgs);
assert.equal(initialized.sourceRevision,2);
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
await rejected("protectedTest",yUser.idToken,{uid:x,session:sessionB},"SESSION_INVALID");
await rejected("protectedTest",yUser.idToken,{uid:y,session:{...sessionB,uid:y}},"SESSION_INVALID");
assert.equal((await invoke("protectedTest",yUser.idToken,{uid:y,session:sessionY})).uid,y);
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
console.log(`PASS (${direct?"direct exported handlers":"HTTP callable"}): A SUCCESS -> B takeover -> A SESSION_REVOKED -> B SUCCESS; logout, UID isolation, tampering, private rules, protected writers, concurrent takeover/write ordering, revoked/disabled Firebase identity.`);
await db.terminate();
if(direct){await getFirestore().terminate();}
