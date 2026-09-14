"use strict";

const {createHash,randomBytes}=require("node:crypto");
const {initializeApp}=require("firebase-admin/app");
const {getAuth:getAdminAuth}=require("firebase-admin/auth");
const {FieldValue,Timestamp,getFirestore}=require("firebase-admin/firestore");
const {setGlobalOptions}=require("firebase-functions/v2");
const {HttpsError,onCall}=require("firebase-functions/v2/https");

const {
    CLOUD_SAVE_SCHEMA_VERSION,
    CloudSavePolicyError,
    normalizeClientVersion,
    validateLegacySaveCandidate
}=require("./src/cloud-save-policy");

initializeApp();

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
    if(error instanceof CloudSavePolicyError){
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

function nativeAuthCodeHash(code){
    return createHash("sha256").update(code,"utf8").digest("hex");
}

function nativeAuthHandoffRef(db,code){
    return db.collection(NATIVE_AUTH_HANDOFF_COLLECTION).doc(nativeAuthCodeHash(code));
}

exports.createNativeAuthHandoff=onCall(CALLABLE_OPTIONS,async(request)=>{
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
        await reference.set({
            uid,
            provider,
            createdAt:Timestamp.fromMillis(now),
            expiresAt:Timestamp.fromMillis(now+NATIVE_AUTH_HANDOFF_TTL_MS),
            used:false
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
        const uid=await db.runTransaction(async(transaction)=>{
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
            transaction.delete(reference);
            return ownerUid;
        });

        const customToken=await getAdminAuth().createCustomToken(uid,{
            authBridge:"android-facebook"
        });
        return {ok:true,uid,customToken};
    }catch(error){
        throw asHttpsError(error);
    }
});

exports.bootstrapCloudSave=onCall(CALLABLE_OPTIONS,async(request)=>{
    const uid=requireUid(request);
    const db=getFirestore();
    const userRef=db.collection("users").doc(uid);
    const saveRef=publicSaveRef(db,uid);
    const privateRef=serverUserRef(db,uid);
    const provider=authProvider(request);

    try{
        const result=await db.runTransaction(async(transaction)=>{
            const [userSnapshot,saveSnapshot,privateSnapshot]=await Promise.all([
                transaction.get(userRef),
                transaction.get(saveRef),
                transaction.get(privateRef)
            ]);

            if(saveSnapshot.exists){
                const existingOwner=saveSnapshot.get("ownerUid");
                if(existingOwner && existingOwner!==uid){
                    throw new HttpsError("failed-precondition","Cloud-save owner mismatch.");
                }
            }

            const now=FieldValue.serverTimestamp();

            transaction.set(userRef,{
                schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
                ownerUid:uid,
                createdAt:userSnapshot.exists ? (userSnapshot.get("createdAt")||now) : now,
                updatedAt:now
            },{merge:true});

            if(!saveSnapshot.exists){
                transaction.set(saveRef,{
                    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
                    ownerUid:uid,
                    status:"awaiting_authoritative_migration",
                    authoritativeStateReady:false,
                    authoritativeStateVersion:0,
                    serverRevision:0,
                    migrationCandidateStatus:"none",
                    createdAt:now,
                    updatedAt:now
                });
            }else{
                transaction.set(saveRef,{
                    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
                    ownerUid:uid,
                    updatedAt:now
                },{merge:true});
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
                    : "none"
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

        const result=await db.runTransaction(async(transaction)=>{
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

            const existingOwner=saveSnapshot.get("ownerUid");
            if(existingOwner && existingOwner!==uid){
                throw new HttpsError("failed-precondition","Cloud-save owner mismatch.");
            }

            if(saveSnapshot.get("authoritativeStateReady")===true){
                throw new HttpsError(
                    "failed-precondition",
                    "Authoritative cloud state already exists; legacy migration is closed."
                );
            }

            if(candidateSnapshot.exists){
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
            const now=FieldValue.serverTimestamp();

            transaction.set(candidateRef,{
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
            });

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
                updatedAt:now
            },{merge:true});

            return {revision};
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
            revision:result.revision
        };
    }catch(error){
        throw asHttpsError(error);
    }
});
