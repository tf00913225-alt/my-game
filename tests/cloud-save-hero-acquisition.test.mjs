import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {createHeroAcquisition}=require("../functions/src/hero-acquisition.js");
const UID="hero-account-a",BASE=`serverUsers/${UID}`,ENV=`users/${UID}/saves/current`;
const KING="vajraHeavenlyKing",CLAIM=`${BASE}/uniqueClaims/hero-v1-${KING}`;

function harness(){
    const data=new Map([[ENV,{ownerUid:UID,serverRevision:1,authoritativeStateReady:false}]]);
    let instant=Date.parse("2026-10-12T03:00:00Z"),active=true,failWrites=false,writes=0;
    const ref=path=>({path,collection:name=>collection(`${path}/${name}`)});
    const collection=(path,filter=null,max=Infinity)=>({path,filter,max,isQuery:true,
        doc:id=>ref(`${path}/${id}`),where:(key,op,value)=>{assert.equal(op,"==");return collection(path,{key,value},max);},
        limit:count=>collection(path,filter,count)});
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const snapshot=(path,value)=>({id:path.split("/").at(-1),exists:value!==undefined,data:()=>value});
    const writer=createHeroAcquisition({db:{collection},HttpsError,
        FieldValue:{serverTimestamp:()=>({seconds:1})},now:()=>instant,seed:()=>987654321,
        inspectExistingEnvelope:value=>({kind:"current",data:value,serverRevision:value.serverRevision}),
        nextRevision:envelope=>envelope.serverRevision+1,
        runProtected:async(request,operation)=>{
            if(!active||request.data.uid!==UID||request.data.session!=="active"){
                throw new HttpsError("permission-denied","SESSION_INVALID");
            }
            const staged=new Map(structuredClone([...data]));let count=0,writing=false;
            const transaction={get:async reference=>{
                assert.equal(writing,false,"Firestore reads must precede all writes");
                if(reference.isQuery){
                    const docs=[...staged].filter(([path,value])=>path.startsWith(reference.path+"/")&&
                        path.split("/").length===reference.path.split("/").length+1&&
                        (!reference.filter||value[reference.filter.key]===reference.filter.value))
                        .slice(0,reference.max).map(([path,value])=>snapshot(path,value));
                    return {docs,size:docs.length};
                }
                return snapshot(reference.path,staged.get(reference.path));
            },create:(reference,value)=>{
                writing=true;assert.equal(staged.has(reference.path),false,"immutable document cannot be replaced");
                if(failWrites)throw Error("simulated transaction failure");
                staged.set(reference.path,value);count++;
            },set:(reference,value)=>{writing=true;staged.set(reference.path,value);count++;},
            update:(reference,value)=>{
                writing=true;assert.equal(staged.has(reference.path),true);
                staged.set(reference.path,{...staged.get(reference.path),...value});count++;
            }};
            const result=await operation(transaction,{uid:UID});
            data.clear();for(const entry of staged)data.set(...entry);writes+=count;return result;
        }});
    const request=extra=>({data:{uid:UID,session:"active",...extra}});
    return {data,writer,request,read:()=>writer.read(request()),
        observe:revision=>writer.observeLogin(request({expectedRevision:revision??data.get(ENV).serverRevision})),
        advance:(days=1)=>{instant+=days*86400000;},setTime:value=>{instant=Date.parse(value);},
        revoke:()=>{active=false;},failWrites:()=>{failWrites=true;},get writes(){return writes;}};
}

test("server Taipei dates count distinct nonconsecutive days; seventh grants once with stable seed",async()=>{
    const h=harness();assert.equal((await h.read()).loginCount,0);assert.equal(h.writes,0);
    for(let count=1;count<=7;count++){
        const result=await h.observe();assert.equal(result.loginCount,count);
        assert.equal(result.authoritativeStateReady,false);
        assert.equal(!!result.entitlements[KING],count===7);
        const writes=h.writes;
        assert.equal((await h.observe(1)).unchanged,true,"lost response/stale identical retry");
        assert.equal(h.writes,writes);h.advance(count%2?3:1);
    }
    const grant=(await h.read()).entitlements[KING];assert.equal(grant.allocationSeed,987654321);
    const writes=h.writes;h.advance(30);assert.equal((await h.observe()).unchanged,true);
    assert.equal(h.writes,writes);assert.equal(h.data.get(CLAIM).allocationSeed,grant.allocationSeed);
    assert.equal([...h.data.keys()].filter(path=>path.startsWith(BASE+"/uniqueClaims/")).length,1);
});

test("Taipei midnight, not device/UTC date, changes the observed day",async()=>{
    const h=harness();h.setTime("2026-10-12T15:59:59Z");await h.observe();
    h.setTime("2026-10-12T16:00:00Z");assert.equal((await h.observe()).loginCount,2);
    assert.deepEqual(h.data.get(BASE+"/heroAcquisition/current").loginDays,["20261012","20261013"]);
});

test("new stale revisions, client counters/rewards/dates and cross-UID intents change no records",async()=>{
    const h=harness();await h.observe();h.advance();const before=structuredClone([...h.data]);
    await assert.rejects(h.observe(1),error=>error.code==="aborted");
    for(const extra of [{loginCount:7},{heroId:KING},{date:"20261018"},{save:{chapterCompleted:true}}]){
        await assert.rejects(h.writer.observeLogin(h.request({expectedRevision:2,...extra})),error=>error.code==="invalid-argument");
    }
    await assert.rejects(h.writer.read({data:{uid:"other",session:"active"}}));
    assert.deepEqual([...h.data],before);
});

test("storage transaction failure cannot leave rights, receipt, history or revision partially committed",async()=>{
    const h=harness();const before=structuredClone([...h.data]);h.failWrites();
    await assert.rejects(h.observe(),/simulated transaction failure/);assert.deepEqual([...h.data],before);
});

test("another device and a reverted local save re-read the same durable entitlement without re-award",async()=>{
    const h=harness();for(let day=0;day<7;day++){await h.observe();h.advance();}
    const before=structuredClone([...h.data]),writes=h.writes;
    // A restored browser save is not accepted as input to either backend operation.
    const oldLocalSave={heroAccount:{heroes:{[KING]:{unlocked:false}}}};
    assert.equal(oldLocalSave.heroAccount.heroes[KING].unlocked,false);
    assert.equal((await h.writer.read(h.request())).entitlements[KING].heroId,KING);
    await h.observe(1);assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
    h.revoke();await assert.rejects(h.read(),error=>error.code==="permission-denied");
});

for(const target of ["heroAcquisition/current","heroAcquisitionHistory/2",
    "operations/hero-login-20261012","ledgerEntries/hero-login-20261012"]){
    test(`missing ${target} fails closed without regeneration`,async()=>{
        const h=harness();await h.observe();h.data.delete(BASE+"/"+target);
        const before=structuredClone([...h.data]);await assert.rejects(h.read(),error=>error.code==="data-loss");
        await assert.rejects(h.observe(),error=>error.code==="data-loss");assert.deepEqual([...h.data],before);
    });
}

test("missing seventh-day claim, contradictory seed and unsupported source cannot re-open rights",async()=>{
    for(const corrupt of [h=>h.data.delete(CLAIM),h=>{h.data.get(CLAIM).allocationSeed=99;},
        h=>{h.data.get(BASE+"/heroAcquisition/current").schemaVersion=2;}]){
        const h=harness();for(let day=0;day<7;day++){await h.observe();h.advance();}
        corrupt(h);const before=structuredClone([...h.data]);
        await assert.rejects(h.observe(),error=>error.code==="data-loss");assert.deepEqual([...h.data],before);
    }
});
