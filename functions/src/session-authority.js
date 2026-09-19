"use strict";

const {createHash,randomBytes,timingSafeEqual}=require("node:crypto");
const SCHEMA_VERSION=1;
const ID_PATTERN=/^[A-Za-z0-9_-]{32}$/;
const SECRET_PATTERN=/^[A-Za-z0-9_-]{43}$/;
const RECENT_LOGIN_SECONDS=300;

/* Sole game-session authority. All protected reads and writes belong to the
 * SAME transaction as requireActiveSession; never check then write outside it.
 * Dependencies are injected so the exact policy can also run in emulator tests. */
function createSessionAuthority({db,FieldValue,HttpsError,now=Date.now}){
    const authorityRef=uid=>db.doc(`serverUsers/${uid}/sessionAuthority/current`);
    const sessionRef=(uid,id)=>db.doc(`serverUsers/${uid}/sessions/${id}`);
    const hash=secret=>createHash("sha256").update(secret,"utf8").digest();
    const fail=(code,http="permission-denied")=>{ throw new HttpsError(http,code,{code}); };

    function identity(request){
        const uid=request?.auth?.uid;
        if(typeof uid!=="string"||!uid||uid.length>128||uid.includes("/")){
            fail("AUTH_REQUIRED","unauthenticated");
        }
        if(request?.data?.uid!==uid){ fail("SESSION_INVALID"); }
        const authTime=request.auth.token?.auth_time;
        if(!Number.isSafeInteger(authTime)||authTime<=0||authTime>Math.floor(now()/1000)+60){
            fail("SESSION_INVALID");
        }
        const sourceAuthTime=request.auth.token.authBridge==="android-facebook"
            ?request.auth.token.sessionSourceAuthTime:null;
        if(request.auth.token.authBridge==="android-facebook"&&
           (!Number.isSafeInteger(sourceAuthTime)||sourceAuthTime<=0||sourceAuthTime>authTime)){
            fail("SESSION_REAUTH_REQUIRED","failed-precondition");
        }
        return {uid,authTime,sourceAuthTime};
    }

    async function create(request){
        const {uid,authTime,sourceAuthTime}=identity(request);
        const sessionId=randomBytes(24).toString("base64url");
        const credential=randomBytes(32).toString("base64url");
        return db.runTransaction(async transaction=>{
            const reference=authorityRef(uid);
            const snapshot=await transaction.get(reference);
            const previous=snapshot.exists?snapshot.data():null;
            if(previous&&(previous.schemaVersion!==SCHEMA_VERSION||previous.uid!==uid||
               !Number.isSafeInteger(previous.authTime)||previous.authTime<=0||
               !Number.isSafeInteger(previous.revision)||previous.revision<1||previous.revision>=Number.MAX_SAFE_INTEGER||
               !["active","revoked"].includes(previous.status)||
               (previous.status==="active"?!ID_PATTERN.test(previous.activeSessionId):previous.activeSessionId!==null))){
                fail("SESSION_INVALID");
            }
            /* auth_time is signed by Firebase and does not advance on token
             * refresh. Old logins cannot steal authority back by clearing local
             * storage. Equal-second logins require an explicit later sign-in. */
            if(previous&&(authTime<=previous.authTime||Math.floor(now()/1000)-authTime>RECENT_LOGIN_SECONDS)){
                fail("SESSION_REAUTH_REQUIRED","failed-precondition");
            }
            if(previous&&sourceAuthTime!==null&&(sourceAuthTime<previous.authTime||
               (sourceAuthTime===previous.authTime&&previous.status!=="active"))){
                fail("SESSION_REAUTH_REQUIRED","failed-precondition");
            }
            const timestamp=FieldValue.serverTimestamp();
            const revision=(previous?.revision||0)+1;
            if(previous?.activeSessionId){
                if(!ID_PATTERN.test(previous.activeSessionId)){ fail("SESSION_INVALID"); }
                transaction.set(sessionRef(uid,previous.activeSessionId),{
                    status:"revoked",revokedAt:timestamp
                },{merge:true});
            }
            transaction.create(sessionRef(uid,sessionId),{
                schemaVersion:SCHEMA_VERSION,uid,sessionId,authTime,revision,
                credentialHash:hash(credential).toString("hex"),
                status:"active",createdAt:timestamp,revokedAt:null
            });
            transaction.set(reference,{
                schemaVersion:SCHEMA_VERSION,uid,activeSessionId:sessionId,
                status:"active",authTime,revision,
                createdAt:previous?.createdAt||timestamp,updatedAt:timestamp
            });
            return {uid,sessionId,credential,schemaVersion:SCHEMA_VERSION,revision,status:"active"};
        });
    }

    async function requireActiveSession(transaction,request){
        const {uid,authTime}=identity(request);
        const supplied=request.data.session;
        if(!supplied||supplied.schemaVersion!==SCHEMA_VERSION||supplied.uid!==uid||
           !ID_PATTERN.test(supplied.sessionId)||!SECRET_PATTERN.test(supplied.credential)){
            fail("SESSION_INVALID");
        }
        const reference=authorityRef(uid);
        const recordRef=sessionRef(uid,supplied.sessionId);
        const [activeSnapshot,recordSnapshot]=await Promise.all([
            transaction.get(reference),transaction.get(recordRef)
        ]);
        if(!activeSnapshot.exists||!recordSnapshot.exists){ fail("SESSION_INVALID"); }
        const active=activeSnapshot.data();
        const record=recordSnapshot.data();
        if(active.uid!==uid||record.uid!==uid||record.sessionId!==supplied.sessionId||
           active.schemaVersion!==SCHEMA_VERSION||record.schemaVersion!==SCHEMA_VERSION||
           record.authTime!==authTime||!/^[a-f0-9]{64}$/.test(record.credentialHash)){
            fail("SESSION_INVALID");
        }
        if(!timingSafeEqual(hash(supplied.credential),Buffer.from(record.credentialHash,"hex"))){ fail("SESSION_INVALID"); }
        if(active.status!=="active"||active.activeSessionId!==supplied.sessionId||
           record.status!=="active"||record.revokedAt!==null){ fail("SESSION_REVOKED"); }
        if(active.authTime!==authTime||active.revision!==record.revision){ fail("SESSION_INVALID"); }
        return {uid,sessionId:supplied.sessionId,revision:record.revision,reference,recordRef};
    }

    /* Native handoffs mint fresh Firebase auth_time values. Fence issue and
     * redemption, and carry their signed source epoch through the custom token
     * so a token redeemed before a takeover cannot be replayed afterward. */
    async function requireCurrentLoginEpoch(transaction,uid,authTime){
        if(!Number.isSafeInteger(authTime)||authTime<=0){ fail("SESSION_REAUTH_REQUIRED","failed-precondition"); }
        const snapshot=await transaction.get(authorityRef(uid));
        if(!snapshot.exists){ return; }
        const active=snapshot.data();
        if(active.uid!==uid||active.schemaVersion!==SCHEMA_VERSION||!Number.isSafeInteger(active.authTime)){
            fail("SESSION_INVALID");
        }
        if(authTime<active.authTime||(authTime===active.authTime&&active.status!=="active")){
            fail("SESSION_REAUTH_REQUIRED","failed-precondition");
        }
    }

    async function runProtected(request,operation){
        return db.runTransaction(async transaction=>{
            const session=await requireActiveSession(transaction,request);
            return operation(transaction,session);
        });
    }

    async function revoke(request){
        return runProtected(request,async(transaction,session)=>{
            const timestamp=FieldValue.serverTimestamp();
            transaction.update(session.recordRef,{status:"revoked",revokedAt:timestamp});
            /* Keep the auth_time tombstone: a refresh/reload is not a new login. */
            transaction.update(session.reference,{status:"revoked",activeSessionId:null,updatedAt:timestamp});
            return {uid:session.uid,status:"revoked"};
        });
    }

    async function protectedTest(request){
        return runProtected(request,async(_transaction,session)=>({
            result:"SUCCESS",uid:session.uid,sessionId:session.sessionId,revision:session.revision
        }));
    }
    return Object.freeze({create,revoke,protectedTest,runProtected,requireActiveSession,requireCurrentLoginEpoch});
}

module.exports={createSessionAuthority};
