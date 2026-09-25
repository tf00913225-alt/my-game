"use strict";

const {createHash,randomBytes}=require("node:crypto");
const {initializeApp}=require("firebase-admin/app");
const {getAuth:getAdminAuth}=require("firebase-admin/auth");
const {FieldValue,Timestamp,getFirestore}=require("firebase-admin/firestore");
const {setGlobalOptions}=require("firebase-functions/v2");
const {HttpsError,onCall}=require("firebase-functions/v2/https");
const {createSessionAuthority}=require("./src/session-authority");
const {createTrustedGrantLedger}=require("./src/trusted-grant-ledger");
const {CloudPreferencesError,PREFERENCES_SCHEMA_VERSION,normalizePreferences}=require("./src/cloud-preferences");
const {
    CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,
    CloudSaveEnvelopeError,
    createEmptyEnvelope,
    inspectExistingEnvelope,
    nextRevision,
    upgradeLegacyEnvelopePatch
}=require("./src/cloud-save-envelope");

const {
    CLOUD_SAVE_SCHEMA_VERSION,
    CloudSavePolicyError,
    normalizeClientVersion,
    validateLegacySaveCandidate
}=require("./src/cloud-save-policy");

initializeApp();
const sessions=createSessionAuthority({db:getFirestore(),FieldValue,HttpsError});
const trustedGrantLedger=createTrustedGrantLedger({
    db:getFirestore(),FieldValue,HttpsError,runProtected:sessions.runProtected,
    inspectExistingEnvelope,nextRevision
});

const REGION="us-central1";
const PUBLIC_SAVE_PATH_SEGMENTS=["saves","current"];
const MIGRATION_RATE_LIMIT_MS=60*1000;
const NATIVE_AUTH_HANDOFF_COLLECTION="nativeAuthHandoffs";
const NATIVE_AUTH_HANDOFF_TTL_MS=2*60*1000;
const NATIVE_AUTH_CODE_PATTERN=/^[A-Za-z0-9_-]{43}$/;

setGlobalOptions({
    region:REGION,
    memory:"256MiB",
    timeoutSeconds:30,
    maxInstances:10
});

const CALLABLE_OPTIONS={
    cors:[
        "https://dev.four-symbols-dev.pages.dev",
        "https://tf00913225-alt.github.io",
        /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/
    ]
};

function requireUid(request){
    const uid=request && request.auth && request.auth.uid;
    if(!uid){
        throw new HttpsError("unauthenticated","Firebase Authentication is required.");
    }
    return uid;
}

function authProvider(request){
    const firebase=request && request.auth && request.auth.token && request.auth.token.firebase;
    return firebase && typeof firebase.sign_in_provider==="string"
        ? firebase.sign_in_provider
        : "unknown";
}

function asHttpsError(error){
    if(error instanceof HttpsError){ return error; }
    if(error instanceof CloudSavePolicyError||error instanceof CloudSaveEnvelopeError||error instanceof CloudPreferencesError){
        return new HttpsError(error.code||"invalid-argument",error.message);
    }
    console.error("Trusted Firebase backend failed:",error);
    return new HttpsError("internal","Trusted Firebase backend failed.");
}

function publicSaveRef(db,uid){
    return db.collection("users").doc(uid)
        .collection(PUBLIC_SAVE_PATH_SEGMENTS[0])
        .doc(PUBLIC_SAVE_PATH_SEGMENTS[1]);
}

function serverUserRef(db,uid){
    return db.collection("serverUsers").doc(uid);
}

/* Callable verifies the signature; additionally reject disabled users and
 * revoked Firebase refresh sessions at every game-authority entry point. */
async function verifyGameIdentity(request){
    const uid=requireUid(request);
    const bearer=request.rawRequest?.headers?.authorization;
    if(typeof bearer!=="string"||!bearer.startsWith("Bearer ")){
        throw new HttpsError("unauthenticated","AUTH_REQUIRED",{code:"AUTH_REQUIRED"});
    }
    try{
        const decoded=await getAdminAuth().verifyIdToken(bearer.slice(7),true);
        if(decoded.uid!==uid){ throw new Error("UID mismatch"); }
        if(decoded.authBridge==="android-facebook"){
            const user=await getAdminAuth().getUser(uid);
            const source=decoded.sessionSourceAuthTime;
            if(!Number.isSafeInteger(source)||source<=0||source>decoded.auth_time||
               source*1000<Date.parse(user.tokensValidAfterTime)){
                throw new Error("Native source login is invalid or revoked");
            }
        }
        return {...request,auth:{uid,token:decoded}};
    }catch(_){
        throw new HttpsError("unauthenticated","AUTH_REQUIRED",{code:"AUTH_REQUIRED"});
    }
}

exports.createGameSession=onCall(CALLABLE_OPTIONS,async request=>{
    try{ return await sessions.create(await verifyGameIdentity(request)); }
    catch(error){ throw asHttpsError(error); }
});
exports.revokeGameSession=onCall(CALLABLE_OPTIONS,async request=>{
    try{ return await sessions.revoke(await verifyGameIdentity(request)); }
    catch(error){ throw asHttpsError(error); }
});
exports.protectedTest=onCall(CALLABLE_OPTIONS,async request=>{
    try{ return await sessions.protectedTest(await verifyGameIdentity(request)); }
    catch(error){ throw asHttpsError(error); }
});
// No browser grant issuer exists. This reserves a server-issued entitlement
// for a future authoritative character transaction without changing gameplay.
exports.reserveTrustedGrant=onCall(CALLABLE_OPTIONS,async request=>{
    try{ return await trustedGrantLedger.reserve(await verifyGameIdentity(request)); }
    catch(error){ throw asHttpsError(error); }
});

function nativeAuthCodeHash(code){
    return createHash("sha256").update(code,"utf8").digest("hex");
}

function nativeAuthHandoffRef(db,code){
    return db.collection(NATIVE_AUTH_HANDOFF_COLLECTION).doc(nativeAuthCodeHash(code));
}

exports.createNativeAuthHandoff=onCall(CALLABLE_OPTIONS,async(request)=>{
    request=await verifyGameIdentity(request);
    const uid=requireUid(request);
    const provider=authProvider(request);
    if(provider!=="facebook.com"){
        throw new HttpsError(
            "permission-denied",
            "Native auth handoff requires a Firebase Facebook-authenticated session."
        );
    }

    try{
        const code=randomBytes(32).toString("base64url");
        const db=getFirestore();
        const now=Date.now();
        const reference=nativeAuthHandoffRef(db,code);
        await db.runTransaction(async transaction=>{
            await sessions.requireCurrentLoginEpoch(transaction,uid,request.auth.token.auth_time);
            transaction.create(reference,{
                uid,provider,authTime:request.auth.token.auth_time,
                createdAt:Timestamp.fromMillis(now),
                expiresAt:Timestamp.fromMillis(now+NATIVE_AUTH_HANDOFF_TTL_MS),
                used:false
            });
        });
        return {
            ok:true,
            code,
            expiresInSeconds:Math.floor(NATIVE_AUTH_HANDOFF_TTL_MS/1000)
        };
    }catch(error){
        throw asHttpsError(error);
    }
});

exports.redeemNativeAuthHandoff=onCall(CALLABLE_OPTIONS,async(request)=>{
    const data=request && request.data && typeof request.data==="object"
        ? request.data
        : {};
    const code=String(data.code||"").trim();
    if(!NATIVE_AUTH_CODE_PATTERN.test(code)){
        throw new HttpsError("invalid-argument","Native auth handoff code is invalid.");
    }

    try{
        const db=getFirestore();
        const reference=nativeAuthHandoffRef(db,code);
        const handoff=await db.runTransaction(async(transaction)=>{
            const snapshot=await transaction.get(reference);
            if(!snapshot.exists){
                throw new HttpsError("not-found","Native auth handoff is missing or already used.");
            }
            const expiresAt=snapshot.get("expiresAt");
            const expiresMillis=expiresAt && typeof expiresAt.toMillis==="function"
                ? expiresAt.toMillis()
                : 0;
            if(!expiresMillis || expiresMillis<Date.now()){
                transaction.delete(reference);
                throw new HttpsError("deadline-exceeded","Native auth handoff has expired.");
            }
            if(snapshot.get("used")===true){
                transaction.delete(reference);
                throw new HttpsError("already-exists","Native auth handoff was already used.");
            }
            const ownerUid=String(snapshot.get("uid")||"");
            if(!ownerUid){
                transaction.delete(reference);
                throw new HttpsError("data-loss","Native auth handoff has no Firebase UID.");
            }
            const authTime=snapshot.get("authTime");
            await sessions.requireCurrentLoginEpoch(transaction,ownerUid,authTime);
            transaction.delete(reference);
            return {uid:ownerUid,authTime};
        });

        const customToken=await getAdminAuth().createCustomToken(handoff.uid,{
            authBridge:"android-facebook",sessionSourceAuthTime:handoff.authTime
        });
        return {ok:true,uid:handoff.uid,customToken};
    }catch(error){
        throw asHttpsError(error);
    }
});

exports.bootstrapCloudSave=onCall(CALLABLE_OPTIONS,async(request)=>{
    request=await verifyGameIdentity(request);
    const uid=requireUid(request);
    const db=getFirestore();
    const userRef=db.collection("users").doc(uid);
    const saveRef=publicSaveRef(db,uid);
    const privateRef=serverUserRef(db,uid);
    const provider=authProvider(request);

    try{
        const result=await sessions.runProtected(request,async(transaction)=>{
            const [userSnapshot,saveSnapshot,privateSnapshot]=await Promise.all([
                transaction.get(userRef),
                transaction.get(saveRef),
                transaction.get(privateRef)
            ]);

            const now=FieldValue.serverTimestamp();
            const existingEnvelope=saveSnapshot.exists
                ? inspectExistingEnvelope(saveSnapshot.data(),uid)
                : null;

            transaction.set(userRef,{
                schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
                ownerUid:uid,
                createdAt:userSnapshot.exists ? (userSnapshot.get("createdAt")||now) : now,
                updatedAt:now
            },{merge:true});

            if(!saveSnapshot.exists){
                transaction.create(saveRef,createEmptyEnvelope(uid,now));
            }else if(existingEnvelope.kind==="legacy-phase1"){
                transaction.update(saveRef,{...upgradeLegacyEnvelopePatch(),updatedAt:now});
            }

            transaction.set(privateRef,{
                schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
                ownerUid:uid,
                accountStatus:"active",
                signInProvider:provider,
                authoritativeStateVersion:privateSnapshot.exists
                    ? (privateSnapshot.get("authoritativeStateVersion")||0)
                    : 0,
                migrationStatus:privateSnapshot.exists
                    ? (privateSnapshot.get("migrationStatus")||"awaiting_candidate")
                    : "awaiting_candidate",
                createdAt:privateSnapshot.exists ? (privateSnapshot.get("createdAt")||now) : now,
                updatedAt:now,
                lastSeenAt:now
            },{merge:true});

            return {
                created:!saveSnapshot.exists,
                status:saveSnapshot.exists
                    ? (saveSnapshot.get("status")||"awaiting_authoritative_migration")
                    : "awaiting_authoritative_migration",
                authoritativeStateReady:saveSnapshot.exists
                    ? saveSnapshot.get("authoritativeStateReady")===true
                    : false,
                migrationCandidateStatus:saveSnapshot.exists
                    ? (saveSnapshot.get("migrationCandidateStatus")||"none")
                    : "none",
                envelopeSchemaVersion:CLOUD_SAVE_ENVELOPE_SCHEMA_VERSION,
                serverRevision:existingEnvelope?.kind==="current"
                    ? existingEnvelope.serverRevision
                    : 1
            };
        });

        return {
            ok:true,
            uid,
            schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
            ...result
        };
    }catch(error){
        throw asHttpsError(error);
    }
});

exports.submitLegacyMigrationCandidate=onCall(CALLABLE_OPTIONS,async(request)=>{
    request=await verifyGameIdentity(request);
    const uid=requireUid(request);

    try{
        const data=request && request.data && typeof request.data==="object"
            ? request.data
            : {};
        const candidate=validateLegacySaveCandidate(data.save);
        const clientVersion=normalizeClientVersion(data.clientVersion);
        const db=getFirestore();
        const saveRef=publicSaveRef(db,uid);
        const privateRef=serverUserRef(db,uid);
        const candidateRef=privateRef.collection("migrationCandidates").doc("latest");

        const result=await sessions.runProtected(request,async(transaction)=>{
            const [saveSnapshot,privateSnapshot,candidateSnapshot]=await Promise.all([
                transaction.get(saveRef),
                transaction.get(privateRef),
                transaction.get(candidateRef)
            ]);

            if(!saveSnapshot.exists || !privateSnapshot.exists){
                throw new HttpsError(
                    "failed-precondition",
                    "Cloud-save account must be bootstrapped before migration submission."
                );
            }

            const envelope=inspectExistingEnvelope(saveSnapshot.data(),uid);
            if(!candidateSnapshot.exists && envelope.data.migrationCandidateStatus==="received"){
                throw new HttpsError("data-loss","Migration candidate record is missing.");
            }

            if(candidateSnapshot.exists){
                const previousRevision=candidateSnapshot.get("revision");
                if(candidateSnapshot.get("ownerUid")!==uid ||
                   candidateSnapshot.get("trusted")!==false ||
                   !Number.isSafeInteger(previousRevision) || previousRevision<1 ||
                   envelope.data.migrationCandidateRevision!==previousRevision ||
                   envelope.data.migrationCandidateFingerprint!==candidateSnapshot.get("fingerprint")){
                    throw new HttpsError("data-loss","Migration candidate metadata is inconsistent.");
                }
                // An ambiguous response can be retried without replacing a
                // candidate or consuming another server revision.
                if(candidateSnapshot.get("fingerprint")===candidate.fingerprint){
                    return {revision:previousRevision,serverRevision:envelope.serverRevision,unchanged:true};
                }
                const submittedAt=candidateSnapshot.get("submittedAt");
                const submittedMillis=submittedAt && typeof submittedAt.toMillis==="function"
                    ? submittedAt.toMillis()
                    : 0;
                if(submittedMillis && Date.now()-submittedMillis<MIGRATION_RATE_LIMIT_MS){
                    throw new HttpsError(
                        "resource-exhausted",
                        "Please wait before submitting another migration candidate."
                    );
                }
            }

            const previousRevision=candidateSnapshot.exists
                ? Number(candidateSnapshot.get("revision")||0)
                : 0;
            const revision=Math.max(0,Math.floor(previousRevision))+1;
            if(!Number.isSafeInteger(revision)){
                throw new HttpsError("failed-precondition","Migration candidate revision is exhausted.");
            }
            const serverRevision=nextRevision(envelope);
            const now=FieldValue.serverTimestamp();

            const candidateRecord={
                schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
                ownerUid:uid,
                trustLevel:"client-migration-candidate",
                trusted:false,
                reviewStatus:"pending_server_validation",
                revision,
                gameSaveVersion:candidate.gameSaveVersion,
                clientVersion,
                byteLength:candidate.byteLength,
                fingerprint:candidate.fingerprint,
                snapshot:candidate.snapshot,
                submittedAt:now,
                updatedAt:now
            };
            // Preserve each untrusted original separately. `latest` remains
            // compatible with existing readers; it is only a moving pointer.
            transaction.create(privateRef.collection("migrationCandidates").doc(String(revision)),candidateRecord);
            transaction.set(candidateRef,candidateRecord);

            transaction.set(privateRef,{
                migrationStatus:"candidate_received",
                latestMigrationCandidateRevision:revision,
                latestMigrationCandidateFingerprint:candidate.fingerprint,
                updatedAt:now
            },{merge:true});

            transaction.set(saveRef,{
                status:"migration_candidate_received",
                migrationCandidateStatus:"received",
                migrationCandidateRevision:revision,
                migrationCandidateFingerprint:candidate.fingerprint,
                migrationCandidateGameSaveVersion:candidate.gameSaveVersion,
                migrationCandidateByteLength:candidate.byteLength,
                serverRevision,
                updatedAt:now
            },{merge:true});

            return {revision,serverRevision,unchanged:false};
        });

        return {
            ok:true,
            uid,
            acceptedAs:"untrusted-migration-candidate",
            authoritativeStateReady:false,
            fingerprint:candidate.fingerprint,
            byteLength:candidate.byteLength,
            gameSaveVersion:candidate.gameSaveVersion,
            clientVersion,
            revision:result.revision,
            serverRevision:result.serverRevision,
            unchanged:result.unchanged
        };
    }catch(error){
        throw asHttpsError(error);
    }
});

/* Preferences are not authoritative gameplay. They never create a playable
 * character, award resources, or alter the full-save migration status. */
exports.saveCloudPreferences=onCall(CALLABLE_OPTIONS,async request=>{
    request=await verifyGameIdentity(request);
    const uid=requireUid(request);
    try{
        const preferences=normalizePreferences(request.data?.preferences);
        const expectedRevision=request.data?.expectedRevision;
        if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            throw new CloudPreferencesError("An expected server revision is required.");
        }
        const saveRef=publicSaveRef(getFirestore(),uid);
        const result=await sessions.runProtected(request,async transaction=>{
            const snapshot=await transaction.get(saveRef);
            if(!snapshot.exists){
                throw new HttpsError("failed-precondition","Bootstrap the account before saving preferences.");
            }
            const envelope=inspectExistingEnvelope(snapshot.data(),uid);
            if(envelope.kind!=="current"){
                throw new HttpsError("failed-precondition","Upgrade the cloud-save envelope first.");
            }
            if(envelope.serverRevision!==expectedRevision){
                throw new HttpsError("aborted","CLOUD_REVISION_CONFLICT",{code:"CLOUD_REVISION_CONFLICT"});
            }
            const unchanged=envelope.data.preferencesVersion===PREFERENCES_SCHEMA_VERSION&&
                JSON.stringify(normalizePreferences(envelope.data.preferences))===JSON.stringify(preferences);
            if(unchanged){ return {serverRevision:envelope.serverRevision,unchanged:true}; }
            const serverRevision=nextRevision(envelope);
            transaction.update(saveRef,{
                preferencesVersion:PREFERENCES_SCHEMA_VERSION,preferences,serverRevision,
                updatedAt:FieldValue.serverTimestamp()
            });
            return {serverRevision,unchanged:false};
        });
        return {ok:true,uid,preferencesVersion:PREFERENCES_SCHEMA_VERSION,...result};
    }catch(error){ throw asHttpsError(error); }
});
