import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const adapter=fs.readFileSync(new URL("../js/firebase/firebase-session.js",import.meta.url),"utf8");
const clientSource=fs.readFileSync(new URL("../js/firebase/session-client.js",import.meta.url),"utf8");
const {createGameSessionClient}=await import("data:text/javascript;base64,"+Buffer.from(clientSource).toString("base64"));
function storage(map){ return {
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>map.set(key,value),
    removeItem:key=>map.delete(key)
}; }
function browserStorage(local,tab){
    const declaration=adapter.slice(adapter.indexOf("const storage={"),adapter.indexOf("const client=createGameSessionClient"));
    return vm.runInNewContext(declaration+"\nstorage;",{window:{localStorage:local,sessionStorage:tab}});
}
const credential=uid=>({uid,sessionId:"a".repeat(32),credential:"b".repeat(43),schemaVersion:1,status:"active"});

test("Google identity resumes the same backend session after a new tab",async()=>{
    const shared=storage(new Map()),firstTab=storage(new Map()),secondTab=storage(new Map());
    const calls=[],identity={uid:"google-user",authTime:12345};
    const options={getIdentity:async()=>identity,call:async(name)=>{
        calls.push(name);
        if(name==="createGameSession"&&calls.filter(x=>x===name).length>1){ throw new Error("duplicate takeover"); }
        return name==="createGameSession"?credential(identity.uid):{result:"SUCCESS"};
    },storage:browserStorage(shared,firstTab)};
    await createGameSessionClient(options).ensure();
    await createGameSessionClient({...options,storage:browserStorage(shared,secondTab)}).ensure();
    assert.deepEqual(calls,["createGameSession","protectedTest"]);
    assert.equal(firstTab.getItem("four_symbols_game_session_v1:google-user"),null);
});

test("old tab credential is migrated, and logout clears persistent credential",async()=>{
    const local=storage(new Map()),oldTab=storage(new Map());
    const key="four_symbols_game_session_v1:google-user";
    oldTab.setItem(key,JSON.stringify({uid:"google-user",authTime:12345,credential:credential("google-user")}));
    const calls=[];
    const client=createGameSessionClient({getIdentity:async()=>({uid:"google-user",authTime:12345}),
        call:async name=>{calls.push(name);return {result:"SUCCESS"};},storage:browserStorage(local,oldTab)});
    await client.ensure();
    assert.deepEqual(calls,["protectedTest"]);
    assert.ok(local.getItem(key));
    assert.equal(oldTab.getItem(key),null);
    await client.revoke();
    assert.equal(local.getItem(key),null);
    assert.equal(calls.at(-1),"revokeGameSession");
});

test("a revoked credential on a reopened tab cannot create a new session",async()=>{
    const local=storage(new Map()),tab=storage(new Map());
    const calls=[];
    const options={getIdentity:async()=>({uid:"google-user",authTime:12345}),
        call:async name=>{
            calls.push(name);
            if(name==="protectedTest"){ throw Object.assign(new Error("revoked"),{details:{code:"SESSION_REVOKED"}}); }
            return credential("google-user");
        },storage:browserStorage(local,tab)};
    await createGameSessionClient(options).ensure();
    await assert.rejects(createGameSessionClient(options).ensure(),error=>error.code==="SESSION_REVOKED");
    await assert.rejects(createGameSessionClient(options).ensure(),error=>error.code==="SESSION_REVOKED");
    assert.deepEqual(calls,["createGameSession","protectedTest"]);
    assert.equal(local.getItem("four_symbols_game_session_v1:google-user").includes("SESSION_REVOKED"),true);
});

test("Google reauthentication verifies the same UID before reacquiring a game session",async()=>{
    const source=fs.readFileSync(new URL("../js/firebase/firebase-auth.js",import.meta.url),"utf8");
    const start=source.indexOf("export async function reauthenticateWithGoogle(){");
    const end=source.indexOf("export async function signInWithEmail(",start);
    const user={uid:"google-user",providerData:[{providerId:"google.com"}]};
    const auth={currentUser:user};
    let hookCalls=0;
    const context={initializeFirebaseAuth:async()=>({auth}),GoogleAuthProvider:class {},
        reauthenticateWithPopup:async()=>({user}),completedSignIn:()=>{hookCalls++;}};
    vm.runInNewContext(source.slice(start,end).replace("export async function","async function"),context);
    await context.reauthenticateWithGoogle();
    assert.equal(hookCalls,1);
    context.reauthenticateWithPopup=async()=>{ auth.currentUser={uid:"another-user"};return {user}; };
    await assert.rejects(context.reauthenticateWithGoogle(),error=>error.code==="ACCOUNT_CHANGED");
    assert.equal(hookCalls,1);
});

test("browser QA account stubs export the runtime reauthentication entry",()=>{
    for(const path of ["run-boot-architecture-browser-qa.mjs","runtime-browser-qa-support.mjs","run-bottom-nav-runtime-browser-qa.mjs"]){
        const source=fs.readFileSync(new URL("../.github/scripts/"+path,import.meta.url),"utf8");
        assert.match(source,/export async function reauthenticateWithGoogle\(\)/,path);
    }
});
