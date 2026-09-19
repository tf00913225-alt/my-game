/* Real Auth + Functions + Firestore emulator integration. Never target live data. */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(new URL("../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
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
        catch(error){throw Object.assign(new Error(error.message),{code:error.code==="unauthenticated"?"UNAUTHENTICATED":error.details?.code||error.code});}
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
await rejected("protectedTest",a.idToken,{uid:x,session:sessionA},"SESSION_REVOKED");
assert.equal((await invoke("protectedTest",b.idToken,{uid:x,session:sessionB})).result,"SUCCESS");
await rejected("revokeGameSession",a.idToken,{uid:x,session:sessionA},"SESSION_REVOKED");
await rejected("createGameSession",a.idToken,{uid:x},"SESSION_REAUTH_REQUIRED");
const replaced=(await db.doc(`serverUsers/${x}/sessions/${sessionA.sessionId}`).get()).data();
assert.equal(replaced.status,"revoked"); assert.ok(replaced.revokedAt.toMillis()>=recordA.createdAt.toMillis());
const candidate={version:6,player:{id:"session-emulator-test",level:1},gold:0,sharedExp:0};
await rejected("bootstrapCloudSave",a.idToken,{uid:x,session:sessionA},"SESSION_REVOKED");
await rejected("submitLegacyMigrationCandidate",a.idToken,{uid:x,session:sessionA,save:candidate},"SESSION_REVOKED");
assert.equal((await db.doc(`users/${x}/saves/current`).get()).exists,false);
await invoke("bootstrapCloudSave",b.idToken,{uid:x,session:sessionB});
await invoke("submitLegacyMigrationCandidate",b.idToken,{uid:x,session:sessionB,save:candidate});
assert.equal((await db.doc(`users/${x}/saves/current`).get()).get("authoritativeStateReady"),false);
await rejected("protectedTest",b.idToken,{uid:x,session:{...sessionB,credential:"z".repeat(43)}},"SESSION_INVALID");
const yUser=await login("accounts:signUp",{email:"session-y@example.test",password});
const y=yUser.localId,sessionY=await invoke("createGameSession",yUser.idToken,{uid:y});
await rejected("protectedTest",yUser.idToken,{uid:x,session:sessionB},"SESSION_INVALID");
await rejected("protectedTest",yUser.idToken,{uid:y,session:{...sessionB,uid:y}},"SESSION_INVALID");
assert.equal((await invoke("protectedTest",yUser.idToken,{uid:y,session:sessionY})).uid,y);
async function rulesRequest(path,token,method="GET"){
    const response=await fetch(`http://127.0.0.1:18080/v1/projects/${project}/databases/(default)/documents/${path}`,{
        method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        ...(method==="PATCH"?{body:JSON.stringify({fields:{status:{stringValue:"active"}}})}:{})
    });return response.status;
}
assert.equal(await rulesRequest(`users/${x}/saves/current`,b.idToken),200);
assert.equal(await rulesRequest(`users/${x}/saves/current`,yUser.idToken),403);
assert.equal(await rulesRequest(`users/${x}/saves/current`,b.idToken,"PATCH"),403);
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
await getAuth(testApp).revokeRefreshTokens(y);
await rejected("protectedTest",yUser.idToken,{uid:y,session:sessionY},"UNAUTHENTICATED");
await getAuth(testApp).updateUser(x,{disabled:true});
await rejected("protectedTest",e.idToken,{uid:x,session:sessionE},"UNAUTHENTICATED");
console.log(`PASS (${direct?"direct exported handlers":"HTTP callable"}): A SUCCESS -> B takeover -> A SESSION_REVOKED -> B SUCCESS; logout, UID isolation, tampering, private rules, protected writers, concurrent takeover/write ordering, revoked/disabled Firebase identity.`);
await db.terminate();
if(direct){await getFirestore().terminate();}
