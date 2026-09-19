import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../js/firebase/session-client.js",import.meta.url),"utf8");
const {createGameSessionClient}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const record=uid=>({uid,sessionId:"a".repeat(32),credential:"b".repeat(43),schemaVersion:1,status:"active"});
const reject=code=>Object.assign(new Error(code),{details:{code}});
const code=value=>error=>error.code===value;
function harness(){
    const values=new Map(),calls=[],states=[];
    let identity={uid:"uid-a",authTime:100},handler=async name=>name==="createGameSession"?record(identity.uid):{result:"SUCCESS"};
    const options={getIdentity:async()=>identity,call:async(name,payload)=>{calls.push({name,payload});return handler(name,payload);},
        storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
        onState:state=>states.push(state)};
    return {client:createGameSessionClient(options),options,calls,states,values,
        identity:value=>{identity=value;},handler:value=>{handler=value;}};
}
test("concurrent login observation creates once; reload resumes same credential",async()=>{
    const h=harness();
    await Promise.all([h.client.ensure(),h.client.ensure()]);
    assert.equal(h.calls.filter(x=>x.name==="createGameSession").length,1);
    const resumed=createGameSessionClient(h.options);
    await resumed.ensure();
    assert.equal(h.calls.filter(x=>x.name==="createGameSession").length,1);
    assert.equal(h.calls.at(-1).name,"protectedTest");
    assert.equal(JSON.stringify(h.states).includes("credential"),false);
});
test("revoked session remains blocked across retries and reload without takeover",async()=>{
    const h=harness(); await h.client.ensure();
    h.handler(async()=>{throw reject("SESSION_REVOKED");});
    await assert.rejects(h.client.invoke("protectedTest"),code("SESSION_REVOKED"));
    const count=h.calls.length;
    await assert.rejects(h.client.ensure(),code("SESSION_REVOKED"));
    await assert.rejects(createGameSessionClient(h.options).ensure(),code("SESSION_REVOKED"));
    assert.equal(h.calls.length,count);
    assert.equal(h.client.getState().status,"blocked");
    assert.equal([...h.values.values()].join("").includes("b".repeat(43)),false);
});
test("fresh sign-in can reacquire; refresh of the same login cannot",async()=>{
    const h=harness(); await h.client.ensure();
    h.handler(async()=>{throw reject("SESSION_REVOKED");});
    await assert.rejects(h.client.ensure(),code("SESSION_REVOKED"));
    h.identity({uid:"uid-a",authTime:100});
    await assert.rejects(h.client.ensure(),code("SESSION_REVOKED"));
    h.identity({uid:"uid-a",authTime:101}); h.handler(async()=>record("uid-a"));
    await h.client.ensure(); assert.equal(h.client.getState().status,"active");
});
test("delayed UID A create response never becomes UID B credential",async()=>{
    const h=harness(); let release,started;
    const waiting=new Promise(resolve=>{started=resolve;});
    h.handler((name,payload)=>payload.uid==="uid-a"?new Promise(resolve=>{release=resolve;started();}):Promise.resolve(record("uid-b")));
    const first=h.client.ensure(); await waiting;
    h.identity({uid:"uid-b",authTime:102}); await h.client.ensure();
    release(record("uid-a")); await assert.rejects(first,code("ACCOUNT_CHANGED"));
    assert.equal(h.client.getState().uid,"uid-b");
    assert.equal([...h.values.values()].join("").includes("uid-a"),false);
});
test("UID changes cannot relabel an already captured protected payload",async()=>{
    const h=harness(); await h.client.ensure();
    h.identity({uid:"uid-b",authTime:102});
    await assert.rejects(h.client.invoke("submitLegacyMigrationCandidate",{save:{owner:"a"}},"uid-a"),code("ACCOUNT_CHANGED"));
    assert.equal(h.calls.some(x=>x.name==="submitLegacyMigrationCandidate"),false);
});
test("logout revokes before forgetting, even while acquisition is pending",async()=>{
    const h=harness(); let release,started;
    const waiting=new Promise(resolve=>{started=resolve;});
    h.handler(name=>name==="createGameSession"?new Promise(resolve=>{release=resolve;started();}):Promise.resolve({status:"revoked"}));
    const first=h.client.ensure(); await waiting;
    const logout=h.client.revoke(); release(record("uid-a")); await first; await logout;
    assert.equal(h.calls.at(-1).name,"revokeGameSession");
    assert.equal(h.values.size,0); assert.equal(h.client.getState().status,"signed-out");
});
test("lost create response does not retry creation or a protected mutation",async()=>{
    const h=harness();h.handler(async()=>{throw new Error("network unavailable");});
    await assert.rejects(h.client.ensure(),code("SESSION_UNAVAILABLE"));
    await assert.rejects(h.client.invoke("bootstrapCloudSave"),code("SESSION_REAUTH_REQUIRED"));
    await assert.rejects(createGameSessionClient(h.options).ensure(),code("SESSION_REAUTH_REQUIRED"));
    assert.equal(h.calls.length,1);
});
test("transient error of an existing session retries validation, never the mutation",async()=>{
    const h=harness(); await h.client.ensure();
    h.handler(async name=>{if(name==="bootstrapCloudSave"){throw new Error("offline");}return {result:"SUCCESS"};});
    await assert.rejects(h.client.invoke("bootstrapCloudSave"),code("SESSION_UNAVAILABLE"));
    assert.equal(h.calls.filter(x=>x.name==="bootstrapCloudSave").length,1);
    await h.client.ensure();
    assert.equal(h.calls.filter(x=>x.name==="createGameSession").length,1);
});
