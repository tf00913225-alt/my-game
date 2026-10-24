import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {syncHeroChapterQualification,HERO_CHAPTER_PATH} from "../scripts/lib/hero-chapter-qualification.mjs";
const require=createRequire(import.meta.url);
const {createHeroAcquisition}=require("../functions/src/hero-acquisition.js");
const UID="hero-account-a",BASE=`serverUsers/${UID}`,ENV=`users/${UID}/saves/current`;
const KING="vajraHeavenlyKing",CLAIM=`${BASE}/uniqueClaims/hero-v1-${KING}`;

test("real Hero qualification sync seals identical canonical LF bytes and strictly rejects changed source",()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'hero-chapter-newlines-'));
    try{
        const sourcePath='js/adventure/adventure-content-v1-20260915.js',file=path.join(root,sourcePath),target=path.join(root,HERO_CHAPTER_PATH);
        const canonical=fs.readFileSync(new URL('../'+sourcePath,import.meta.url),'utf8').replace(/\r\n/g,'\n');
        fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,canonical);
        syncHeroChapterQualification(root,false);const expected=fs.readFileSync(target);
        const policy=JSON.parse(expected);assert.equal(policy.sourceSha256,createHash('sha256').update(canonical).digest('hex'));assert.equal(policy.outcomeVerified,false);
        for(const source of [canonical.replaceAll('\n','\r\n'),canonical.replace('\n','\r\n')]){
            fs.writeFileSync(file,source);syncHeroChapterQualification(root,true);syncHeroChapterQualification(root,false);
            assert.deepEqual(fs.readFileSync(target),expected,'real sync produces byte-identical graph, source digest and outcome flags');
        }
        fs.writeFileSync(file,canonical+'\n// genuine authored source change\n');
        assert.throws(()=>syncHeroChapterQualification(root,true),/Hero chapter qualification projection is stale/);
        assert.deepEqual(fs.readFileSync(target),expected,'strict check never rewrites the accepted projection');
        syncHeroChapterQualification(root,false);const changed=JSON.parse(fs.readFileSync(target,'utf8'));
        assert.notEqual(changed.sourceSha256,policy.sourceSha256);assert.deepEqual(changed.nodes,policy.nodes);assert.equal(changed.outcomeVerified,false);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
});

function harness(factory=acquisitionWithPolicy(retainedChapterPolicy)){
    const data=new Map([[ENV,{ownerUid:UID,serverRevision:1,authoritativeStateReady:false}]]);
    let instant=Date.parse("2026-10-12T03:00:00Z"),active=true,failWrites=false,writes=0;
    const ref=path=>({path,collection:name=>collection(`${path}/${name}`)});
    const collection=(path,filter=null,max=Infinity,sort=null)=>({path,filter,max,sort,isQuery:true,
        doc:id=>ref(`${path}/${id}`),where:(key,op,value)=>{assert.equal(op,"==");return collection(path,{key,value},max,sort);},
        orderBy:(key,direction)=>collection(path,filter,max,{key,direction}),
        limit:count=>collection(path,filter,count,sort)});
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const snapshot=(path,value)=>({id:path.split("/").at(-1),exists:value!==undefined,data:()=>value});
    const dependencies={db:{collection},HttpsError,
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
                    const entries=[...staged].filter(([path,value])=>path.startsWith(reference.path+"/")&&
                        path.split("/").length===reference.path.split("/").length+1&&
                        (!reference.filter||value[reference.filter.key]===reference.filter.value));
                    if(reference.sort){const {key,direction}=reference.sort;entries.sort((a,b)=>(a[1][key]-b[1][key])*(direction==="desc"?-1:1));}
                    const docs=entries.slice(0,reference.max).map(([path,value])=>snapshot(path,value));
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
            const result=await operation(transaction,{uid:UID,sessionId:"A".repeat(32)});
            data.clear();for(const entry of staged)data.set(...entry);writes+=count;return result;
        }};
    let writer=factory(dependencies);
    const request=extra=>({data:{uid:UID,session:"active",...extra}});
    return {data,get writer(){return writer;},replaceFactory:next=>{writer=next(dependencies);},request,read:()=>writer.read(request()),
        observe:revision=>writer.observeLogin(request({expectedRevision:revision??data.get(ENV).serverRevision})),
        ensure:()=>writer.ensureChapterTicket(request({expectedRevision:data.get(ENV).serverRevision})),
        step:async(nodeId,choiceId=null,args={})=>{
            const state=await writer.read(request());
            return writer.completeChapterNode(request({expectedRevision:state.serverRevision,
                ticketId:state.chapter.ticketId,nodeId,choiceId,...args}));
        },
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

test("invalid calendar/source-session evidence and orphan audit records block source reinitialization",async()=>{
    for(const corrupt of [h=>{h.data.get(BASE+"/heroAcquisition/current").loginDays[0]="20261301";},
        h=>{h.data.get(BASE+"/heroAcquisitionHistory/2").sessionId="unknown";},
        h=>{h.data.get(BASE+"/heroAcquisitionHistory/2").sourceRevision=2;},
        h=>{h.data.delete(BASE+"/heroAcquisition/current");h.data.delete(BASE+"/heroAcquisitionHistory/2");}]){
        const h=harness();await h.observe();corrupt(h);const before=structuredClone([...h.data]);
        await assert.rejects(h.observe(),error=>error.code==="data-loss");assert.deepEqual([...h.data],before);
    }
});

const DOG="divineDogHongbao";
const retainedChapterPolicy=JSON.parse(fs.readFileSync(new URL("../functions/src/generated/hero-chapter-qualification-v1.json",import.meta.url),"utf8"));
const replacementChapterPolicy={...structuredClone(retainedChapterPolicy),startNodeId:"story_opening",endNodeId:"story_finish",
    nodes:[{id:"story_opening",type:"event",next:"story_finish"},{id:"story_finish",type:"finish",next:null}]};
function acquisitionWithPolicy(current){
    function load(relative,overrides){
        const url=new URL(relative,import.meta.url),localRequire=createRequire(url),module={exports:{}};
        const injectedRequire=id=>Object.hasOwn(overrides,id)?overrides[id]:localRequire(id);
        const execute=vm.runInThisContext("(function(module,exports,require){\n"+fs.readFileSync(url,"utf8")+"\n})",{filename:url.pathname});
        execute(module,module.exports,injectedRequire);
        return module.exports;
    }
    const chapterSource=load("../functions/src/hero-chapter-source.js",{
        "./generated/hero-chapter-qualification.json":current,
        "./generated/hero-chapter-qualification-v1.json":retainedChapterPolicy});
    return load("../functions/src/hero-acquisition.js",{"./hero-chapter-source":chapterSource}).createHeroAcquisition;
}

test("retained v1 ticket survives policy replacement, renews its prefix and grants exactly once",async()=>{
    for(const branch of ["safe","bold"]){
        const h=harness(acquisitionWithPolicy(retainedChapterPolicy));
        const issued=await h.ensure();await h.step("n01_arrival");
        h.replaceFactory(acquisitionWithPolicy(replacementChapterPolicy));
        assert.equal((await h.read()).chapter.nextNodeId,"n02_roadfight");
        await h.step("n02_roadfight");await h.step("n03_fork",branch);
        const prefix=structuredClone(h.data.get(BASE+"/heroChapter/current").steps);
        h.advance(8);const expired=structuredClone([...h.data]),writes=h.writes;
        await assert.rejects(h.step(branch==="safe"?"n04a_path":"n04b_gate"),e=>e.code==="failed-precondition");
        assert.equal(h.writes,writes);assert.deepEqual([...h.data],expired);
        const renewed=await h.ensure();assert.notEqual(renewed.chapter.ticketId,issued.chapter.ticketId);
        const ticket=h.data.get(BASE+"/heroChapterTickets/"+renewed.chapter.ticketId);
        assert.equal(ticket.startingStepCount,prefix.length);
        assert.equal(ticket.startingStepSha256,h.data.get(BASE+"/heroChapterSteps/"+prefix.at(-1)).sha256);
        assert.deepEqual(JSON.parse(JSON.stringify(ticket.policy)),retainedChapterPolicy);
        assert.deepEqual(h.data.get(BASE+"/heroChapter/current").steps,prefix);
        for(const id of [branch==="safe"?"n04a_path":"n04b_gate","n05_commission","n06_rest","n07_chest","n08_truth","n09_boss","n10_finish"])await h.step(id);
        const proof=await h.read(),before=structuredClone([...h.data]),commits=h.writes;
        assert.equal(proof.chapter.phase,"completed");assert.equal(proof.entitlements[DOG].allocationSeed,987654321);
        await h.step("n10_finish",null,{expectedRevision:1});h.advance(30);await h.ensure();
        assert.equal(h.writes,commits);assert.deepEqual([...h.data],before);
        assert.equal([...h.data.keys()].filter(p=>p===BASE+"/uniqueClaims/hero-v1-"+DOG).length,1);
    }
});

for(const retainedFile of ['hero-chapter-qualification-v2-20261020.json','hero-chapter-qualification-v2-20261023.json'])test(`exact retained twenty-node ${retainedFile} tickets advance and renew across edits while same-graph unknown policies cannot write`,async()=>{
    const retained=require('../functions/src/generated/'+retainedFile);
    if(retainedFile.endsWith('20261023.json'))assert.equal(retained.sourceSha256,'f812f2d9ad9bfeaac0db4af128ccafe3a2e36ca21586bd25032a5a6defc62269');
    assert.equal(retained.nodes.length,20);assert.equal(retained.outcomeVerified,false);
    const h=harness(acquisitionWithPolicy(retained)),issued=await h.ensure();await h.step('c1_01');
    h.replaceFactory(acquisitionWithPolicy(replacementChapterPolicy));await h.step('c1_02');
    const prefix=structuredClone(h.data.get(BASE+'/heroChapter/current').steps);h.advance(8);
    const beforeExpiry=structuredClone([...h.data]),beforeWrites=h.writes;
    await assert.rejects(h.step('c1_03'),e=>e.code==='failed-precondition');assert.equal(h.writes,beforeWrites);assert.deepEqual([...h.data],beforeExpiry);
    const renewed=await h.ensure(),ticket=h.data.get(BASE+'/heroChapterTickets/'+renewed.chapter.ticketId);
    assert.notEqual(renewed.chapter.ticketId,issued.chapter.ticketId);assert.deepEqual(JSON.parse(JSON.stringify(ticket.policy)),retained);
    assert.equal(ticket.startingStepCount,prefix.length);assert.equal(ticket.startingStepSha256,h.data.get(BASE+'/heroChapterSteps/'+prefix.at(-1)).sha256);assert.deepEqual(h.data.get(BASE+'/heroChapter/current').steps,prefix);
    for(let stage=3;stage<=20;stage++)await h.step('c1_'+String(stage).padStart(2,'0'));
    const completed=await h.read();assert.equal(completed.chapter.phase,'completed');assert.equal(completed.chapter.outcomeVerified,false);assert.equal(completed.entitlements[DOG].allocationSeed,987654321);
    const snapshot=structuredClone([...h.data]),writes=h.writes;await h.step('c1_20',null,{expectedRevision:1});h.advance(30);await h.ensure();assert.equal(h.writes,writes);assert.deepEqual([...h.data],snapshot);
    assert.equal([...h.data.keys()].filter(p=>p===BASE+'/uniqueClaims/hero-v1-'+DOG).length,1);
    const unknown={...structuredClone(retained),sourceSha256:'f'.repeat(64)},bad=harness(acquisitionWithPolicy(unknown)),badIssued=await bad.ensure();
    bad.replaceFactory(acquisitionWithPolicy(replacementChapterPolicy));const unchanged=structuredClone([...bad.data]),zero=bad.writes;
    assert.equal((await bad.read()).chapter.nextNodeId,'c1_01','sealed unknown historical evidence remains readable');
    await assert.rejects(bad.step('c1_01'),e=>e.code==='failed-precondition');bad.advance(8);await assert.rejects(bad.ensure(),e=>e.code==='failed-precondition');
    assert.equal(bad.writes,zero);assert.deepEqual([...bad.data],unchanged);assert.ok(badIssued.chapter.ticketId);
});

test("new tickets use current policy while unknown sealed policies cannot advance or renew",async()=>{
    const fresh=harness(acquisitionWithPolicy(replacementChapterPolicy));await fresh.ensure();
    assert.equal((await fresh.read()).chapter.nextNodeId,"story_opening");
    await fresh.step("story_opening");await fresh.step("story_finish");
    assert.equal((await fresh.read()).entitlements[DOG].allocationSeed,987654321);
    const h=harness(acquisitionWithPolicy(retainedChapterPolicy));const issued=await h.ensure();
    const ticket=h.data.get(BASE+"/heroChapterTickets/"+issued.chapter.ticketId);
    const {snapshotDigest:digest}=require("../functions/src/canonical-snapshot");
    ticket.policy={...structuredClone(ticket.policy),startNodeId:"forged",endNodeId:"forged",
        nodes:[{id:"forged",type:"finish",next:null}]};ticket.policySha256=digest(ticket.policy);
    const {createdAt,sha256,...proof}=ticket;ticket.sha256=digest(proof);
    for(const collection of ["operations","ledgerEntries"])h.data.get(BASE+"/"+collection+"/"+ticket.operationId).sourceSha256=ticket.sha256;
    Object.assign(h.data.get(BASE+"/heroChapter/current"),{policySha256:ticket.policySha256,nextNodeId:"forged"});
    h.replaceFactory(acquisitionWithPolicy(replacementChapterPolicy));
    const before=structuredClone([...h.data]),writes=h.writes;
    assert.equal((await h.read()).chapter.nextNodeId,"forged","sealed historical evidence remains readable");
    await assert.rejects(h.writer.completeChapterNode(h.request({expectedRevision:h.data.get(ENV).serverRevision,
        ticketId:issued.chapter.ticketId,nodeId:"forged",choiceId:null})),e=>e.code==="failed-precondition");
    h.advance(8);await assert.rejects(h.ensure(),e=>e.code==="failed-precondition");
    assert.equal(h.writes,writes);assert.deepEqual([...h.data],before);
});

async function chapter(h,branch="safe"){
    await h.ensure();
    for(const node of ["n01_arrival","n02_roadfight","n03_fork",
        branch==="safe"?"n04a_path":"n04b_gate","n05_commission","n06_rest",
        "n07_chest","n08_truth","n09_boss","n10_finish"]){
        await h.step(node,node==="n03_fork"?branch:null);
    }
}
test("issued chapter routes (both branches) grant Hongbao once; ordinary combat remains unverified",async()=>{
    for(const branch of ["safe","bold"]){
        const h=harness();await chapter(h,branch);const proof=await h.read();
        assert.equal(proof.chapter.phase,"completed");assert.equal(proof.chapter.nextNodeId,null);
        assert.equal(proof.chapter.outcomeVerified,false);assert.equal(proof.authoritativeStateReady,false);
        assert.equal(proof.entitlements[DOG].allocationSeed,987654321);
        assert.equal(h.data.get(BASE+"/uniqueClaims/hero-v1-"+DOG).heroId,DOG);
        const before=structuredClone([...h.data]),ticketId=proof.chapter.ticketId;
        assert.equal((await h.step("n10_finish",null,{ticketId,expectedRevision:1})).unchanged,true);
        h.advance(30);assert.equal((await h.ensure()).unchanged,true);
        assert.deepEqual((await h.read()).entitlements,proof.entitlements);assert.deepEqual([...h.data],before);
    }
});
test("local clear flags, missing tickets, skipped/reserved nodes, wrong branches and stale revisions cannot grant",async()=>{
    const h=harness();
    await assert.rejects(h.step("n10_finish"),error=>error.code==="invalid-argument");
    const ticket=await h.ensure();const before=structuredClone([...h.data]);
    for(const node of ["n10_finish","n20_reserved","n04a_path"]){
        await assert.rejects(h.step(node),error=>error.code==="failed-precondition");
    }
    await assert.rejects(h.step("n01_arrival",null,{expectedRevision:1}),error=>error.code==="aborted");
    await assert.rejects(h.writer.completeChapterNode(h.request({expectedRevision:ticket.serverRevision,
        ticketId:ticket.chapter.ticketId,nodeId:"n10_finish",choiceId:null,won:true})),error=>error.code==="invalid-argument");
    assert.deepEqual([...h.data],before);assert.equal(h.data.has(BASE+"/uniqueClaims/hero-v1-"+DOG),false);
    await h.step("n01_arrival");await h.step("n02_roadfight");
    await assert.rejects(h.step("n03_fork","illegal"),error=>error.code==="invalid-argument");
    await h.step("n03_fork","safe");
    await assert.rejects(h.step("n04b_gate"),error=>error.code==="failed-precondition");
    await assert.rejects(h.step("n03_fork","bold"),error=>error.code==="failed-precondition");
});
test("expired tickets cannot settle; renewal preserves the server route without reopening past positions",async()=>{
    const h=harness(),initial=await h.ensure();await h.step("n01_arrival");h.advance(8);
    const before=structuredClone([...h.data]);
    await assert.rejects(h.step("n02_roadfight"),error=>error.code==="failed-precondition");
    assert.deepEqual([...h.data],before);
    const renewed=await h.ensure();assert.notEqual(renewed.chapter.ticketId,initial.chapter.ticketId);
    assert.equal(renewed.chapter.nextNodeId,"n02_roadfight");
    await assert.rejects(h.step("n02_roadfight",null,{ticketId:initial.chapter.ticketId}),
        error=>error.code==="failed-precondition");
    await h.step("n02_roadfight");assert.equal((await h.read()).chapter.nextNodeId,"n03_fork");
});
test("missing chapter claim/source/step/receipt never regenerates or re-awards a Hero",async()=>{
    for(const target of ["claim","marker","ticket","step","receipt"]){
        const h=harness();await chapter(h);const state=await h.read();
        const marker=h.data.get(BASE+"/heroChapter/current"),operationId=marker.steps.at(-1);
        const path=target==="claim"?BASE+"/uniqueClaims/hero-v1-"+DOG:
            target==="marker"?BASE+"/heroChapter/current":
            target==="ticket"?BASE+"/heroChapterTickets/"+state.chapter.ticketId:
            target==="step"?BASE+"/heroChapterSteps/"+operationId:BASE+"/operations/"+operationId;
        h.data.delete(path);const before=structuredClone([...h.data]);
        await assert.rejects(h.ensure(),error=>error.code==="data-loss");
        await assert.rejects(h.step("n10_finish"),error=>error.code==="data-loss");assert.deepEqual([...h.data],before);
    }
});
test("login and chapter rights share the acquisition Owner while retaining independent source histories",async()=>{
    const h=harness();await chapter(h);
    for(let day=0;day<7;day++){await h.observe();h.advance();}
    assert.deepEqual(Object.keys((await h.read()).entitlements).sort(),[DOG,KING].sort());
    assert.equal([...h.data.keys()].filter(path=>path.startsWith(BASE+"/uniqueClaims/")).length,2);
    const source=h.data.get(BASE+"/heroAcquisition/current");
    assert.equal(source.loginDays.length,7);assert.equal(source.entitlements[DOG],undefined);
    // Logical digest must survive Firestore map-key reordering.
    for(const [path,value] of h.data){
        if(path.startsWith(BASE+"/"))h.data.set(path,Object.fromEntries(Object.entries(value).reverse()));
    }
    assert.equal(Object.keys((await h.read()).entitlements).length,2);
});

function client(h){
    let uid=UID,online=true,storageFails=false,saves=0;
    const events=new Map(),listeners=new Map();
    const main=fs.readFileSync("js/00-main.js","utf8");
    const start=main.indexOf("let heroAccountState=");
    const adapter=main.slice(start,main.indexOf("\n});",start)+4);
    const core=require("../functions/src/hero-core");
    const ctx={console,Promise,JSON,Math,Error,Number,String,Object,Array,Set,Map,
        location:{hostname:"production.invalid"},navigator:{get onLine(){return online;}},
        player:{id:"player",level:25},player2:null,player3:null,
        calculateCharacterBaseStats:()=>({maxHP:100,maxSP:100,magicAttack:50}),
        skillDatabase:{phoenixCry:{},windHowlLightning:{}},FourSymbolsHeroCore:core,
        FourSymbolsAccountSave:{getActiveUid:()=>uid},
        FourSymbolsStartupPolicy:{getUid:()=>uid,getState:()=>online?"READY":"OFFLINE_READY"},
        FourSymbolsFirebaseLifecycle:{getUser:()=>({uid}),
            readHeroAcquisition:()=>h.read(),observeHeroLogin:revision=>h.observe(revision),
            ensureHeroChapterTicket:revision=>h.writer.ensureChapterTicket(h.request({expectedRevision:revision})),
            completeHeroChapterNode:args=>h.writer.completeChapterNode(h.request(args)),bootstrapCloudSave:()=>{throw Error("unexpected bootstrap");}},
        document:{hidden:false,dispatchEvent:()=>{},addEventListener:(name,fn)=>events.set(name,fn)},
        CustomEvent:function(name){this.type=name;},addEventListener:(name,fn)=>listeners.set(name,fn),
        saveGame:()=>{if(storageFails){return false;}saves++;return true;}};
    ctx.window=ctx;vm.createContext(ctx);vm.runInContext(adapter,ctx);
    vm.runInContext(fs.readFileSync("js/hero-acquisition-client.js","utf8"),ctx);
    return {ctx,api:ctx.FourSymbolsHeroAcquisition,events,listeners,
        switchUid:value=>{uid=value;},offline:()=>{online=false;},online:()=>{online=true;},
        failStorage:()=>{storageFails=true;},get saves(){return saves;},
        restoreLocal:()=>ctx.FourSymbolsHeroSystem.replaceAccountState(core.normalizeAccountState()),
        raw:()=>JSON.parse(vm.runInContext("JSON.stringify(heroAccountState)",ctx))};
}
test("real frontend adapter queues formal chapter intents and reprojects permanent rights after old-cache restore",async()=>{
    const h=harness(),c=client(h);await c.api.sync();assert.equal(c.api.getStatus().loginCount,1);
    await c.api.beginChapter("chapter_v1");
    const tasks=[];
    for(const nodeId of ["n01_arrival","n02_roadfight","n03_fork","n04a_path","n05_commission",
        "n06_rest","n07_chest","n08_truth","n09_boss","n10_finish"]){
        tasks.push(c.api.observeChapterNode("chapter_v1",nodeId,nodeId==="n03_fork"?"safe":null));
    }
    await Promise.all(tasks);assert.equal(c.api.getStatus().error,null);
    assert.equal(c.ctx.FourSymbolsHeroSystem.getDomain().isHeroUnlocked(DOG),true);
    assert.equal(c.raw().heroes[DOG].unlocked,true);
    const grant=c.api.getEntitlement(DOG);grant.allocationSeed=1;
    assert.equal(c.api.getEntitlement(DOG).allocationSeed,987654321,"caller cannot mutate confirmed proof");
    const before=structuredClone([...h.data]);c.restoreLocal();
    assert.equal(c.raw().heroes[DOG].unlocked,false);
    await c.api.sync();assert.equal(c.raw().heroes[DOG].unlocked,true);
    assert.equal(c.ctx.FourSymbolsHeroSystem.getDomain().getHeroAccountState(DOG).allocationSeed,987654321);
    assert.deepEqual([...h.data],before,"restored cache never re-awards or advances a claimed source");
    assert.ok(c.saves>=2);assert.equal(c.raw().heroes[DOG].rage,undefined);
});
test("frontend local-save failure retains server rights; offline/login snapshots cannot fake permanent ownership",async()=>{
    const h=harness();await chapter(h);const c=client(h);c.failStorage();await c.api.sync();
    assert.equal(c.raw().heroes[DOG].unlocked,false,"failed local cache rolls back");
    assert.equal(c.ctx.FourSymbolsHeroSystem.getDomain().isHeroUnlocked(DOG),true);
    assert.match(c.api.getStatus().error,/本機快取儲存失敗/);
    c.switchUid("other-uid");assert.equal(c.api.getEntitlement(DOG),null);
    assert.equal(c.ctx.FourSymbolsHeroSystem.getDomain().isHeroUnlocked(DOG),false);
    c.switchUid(UID);h.revoke();await assert.rejects(c.api.sync());
    assert.equal(c.api.getEntitlement(DOG),null,"revoked session invalidates confirmed projection");
    const fresh=harness(),offline=client(fresh);offline.offline();
    const core=require("../functions/src/hero-core"),fake=core.createDomain(core.normalizeAccountState(),
        ()=>[offline.ctx.player],offline.ctx.calculateCharacterBaseStats,()=>null).unlockHeroDirect(DOG,123);
    offline.ctx.FourSymbolsHeroSystem.replaceAccountState(fake);
    await assert.rejects(offline.api.sync(),error=>error.code==="HERO_ONLINE_REQUIRED");
    assert.equal(offline.ctx.FourSymbolsHeroSystem.getDomain().isHeroUnlocked(DOG),false);
    assert.equal(fresh.writes,0);
});
test("failed network observation remains a bounded live intent and drains in order on reconnect",async()=>{
    const h=harness(),c=client(h);await c.api.sync();await c.api.beginChapter("chapter_v1");
    c.offline();await c.api.observeChapterNode("chapter_v1","n01_arrival");
    assert.equal((await h.read()).chapter.nextNodeId,"n01_arrival");
    c.online();await c.api.sync();assert.equal((await h.read()).chapter.nextNodeId,"n02_roadfight");
    assert.equal(c.api.getStatus().error,null);
});

test("current twenty-node adapter discards a mismatched head then recovers only through explicit story observations",async()=>{
    const current=JSON.parse(fs.readFileSync("functions/src/generated/hero-chapter-qualification.json","utf8"));
    const h=harness(acquisitionWithPolicy(current)),c=client(h);await c.api.sync();await c.api.beginChapter("chapter_v1");
    await c.api.observeChapterNode("chapter_v1","c1_20");assert.match(c.api.getStatus().error,/補看故事紀錄/);
    assert.equal(c.api.getRequiredStoryNode(),"c1_01");assert.equal((await h.read()).chapter.completedIntents.length,0);
    // No local completion map is supplied: every server position must receive
    // a fresh explicit observation, including after a prior queued mismatch.
    for(const row of current.nodes){await c.api.observeChapterNode("chapter_v1",row.id);assert.equal(c.api.getStatus().error,null);}
    assert.equal((await h.read()).chapter.phase,"completed");assert.ok(c.api.getEntitlement(DOG));
    const before=structuredClone([...h.data]);await c.api.observeChapterNode("chapter_v1","c1_20");assert.deepEqual([...h.data],before);
});

test("new story actions can resume a retained ticket without filling unobserved server positions from cache",async()=>{
    const h=harness();await h.ensure();await h.step("n01_arrival");
    const c=client(h);await c.api.sync();assert.equal(c.api.getRequiredStoryNode(),"c1_02");
    await c.api.observeChapterNode("chapter_v1","c1_20");assert.match(c.api.getStatus().error,/補看故事紀錄/);
    assert.equal((await h.read()).chapter.nextNodeId,"n02_roadfight");
    for(const id of ["c1_02","c1_06","c1_07","c1_08","c1_09","c1_10","c1_11","c1_20","c1_20"]){
        assert.equal(c.api.getRequiredStoryNode(),id);await c.api.observeChapterNode("chapter_v1",id);assert.equal(c.api.getStatus().error,null);
    }
    assert.equal((await h.read()).chapter.phase,"completed");assert.ok(c.api.getEntitlement(DOG));
});
