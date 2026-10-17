import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
const require=createRequire(import.meta.url);
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
const {assembleCanonicalSnapshot,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
const {createCanonicalCurrentRecovery}=require("../functions/src/canonical-current-recovery.js");
const uid="surviving-revision-owner",root=`serverUsers/${uid}`,env=`users/${uid}/saves/current`;
const intent={operationId:"recover-surviving-revision-0001",expectedRevision:6};
const grantId="retained-claim",creditId="retained-credit-proof-0001";
function fixture(){
    const records=makeInitialCharacterSources(uid,6,"create-surviving-revision-0001",{
        displayName:"英雄",element:"fire",gender:"female",
        attributes:{attack:3,vitality:2,energy:1,intelligence:2,defensePoints:1,agility:1}
    },{recordedAt:Date.parse("2026-10-16T16:00:00Z")});
    const base={schemaVersion:1,ownerUid:uid,serverRevision:6,provenance:"server-created"};
    const characterId=records.account.slots[0];
    records.inventory=[{...base,ownedItemId:"retained-sword",location:"equipped",
        state:{id:"sword",type:"weapon",count:1}}];
    records.equipment=[{...base,characterId,slot:"hand",ownedItemId:"retained-sword"}];
    records.relics=[{...base,relicId:"retained-relic",unlocked:true,level:1,exp:0}];
    records.relicLoadout={...records.relicLoadout,relicId:"retained-relic"};
    const prior=structuredClone(records);
    for(const rows of Object.values(prior)){
        for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=5;
    }
    const priorSnapshot=assembleCanonicalSnapshot(uid,5,prior);
    records.economy.gold=25;
    records.claimRecords=[{...base,claimKey:grantId,status:"claimed",grantId,operationId:creditId}];
    records.claimCheckpoint={...records.claimCheckpoint,claimCount:1,
        claimDigest:claimRecordsDigest(records.claimRecords)};
    const snapshot=assembleCanonicalSnapshot(uid,6,records);
    const archive=createRecoveryArchive(uid,6,records,snapshot);
    const current=new Map();
    for(const name of ["account","economy","progress","relicLoadout","claimCheckpoint"]){
        current.set(`${root}/${name==="claimCheckpoint"?"claimCheckpoints":name}/current`,records[name]);
    }
    for(const [name,key] of Object.entries({characters:r=>r.characterId,inventory:r=>r.ownedItemId,
        equipment:r=>`${r.characterId}_${r.slot}`,relics:r=>r.relicId,claimRecords:r=>r.claimKey})){
        for(const row of records[name])current.set(`${root}/${name}/${key(row)}`,row);
    }
    const data=new Map([...current,[env,{serverRevision:6,authoritativeStateReady:false}],
        [`${root}/playableSnapshots/6`,snapshot],[`${root}/recoveryArchives/6`,archive],
        [`${root}/recoveryApprovals/${intent.operationId}`,{
            schemaVersion:1,kind:"canonical-current-recovery-approval",ownerUid:uid,
            operationId:intent.operationId,sourceRevision:6,sourceSha256:archive.sourceSha256,
            snapshotSha256:snapshot.sha256,approvedBy:"operator",status:"approved",
            expiresAt:{toMillis:()=>Date.parse("2026-12-01T00:00:00Z")}}]]);
    // Original credit evidence belongs to the existing grant Owner. Recovery
    // must verify it, not synthesize rights from an archived claim marker.
    const common={schemaVersion:1,ownerUid:uid,grantId,operationId:creditId};
    data.set(`${root}/playableSnapshots/5`,priorSnapshot);
    data.set(`${root}/recoveryArchives/5`,createRecoveryArchive(uid,5,prior,priorSnapshot));
    data.set(`${root}/pendingGrants/${grantId}`,{schemaVersion:1,ownerUid:uid,
        source:"server-event",kind:"gold",amount:25,status:"credited",claimedByOperationId:creditId});
    data.set(`${root}/grantOperations/${creditId}`,{...common,kind:"gold",amount:25,
        serverRevision:5,creditRevision:6,snapshotSha256:snapshot.sha256,creditedToCharacter:true});
    data.set(`${root}/ledgerEntries/${creditId}`,{...common,kind:"gold",amount:25,
        creditRevision:6,snapshotSha256:snapshot.sha256,creditEvidenceVersion:1,
        sourceRevision:5,sourceSnapshotSha256:priorSnapshot.sha256,balanceBefore:0,balanceAfter:25});
    data.set(`${root}/uniqueClaims/${grantId}`,{...common,creditRevision:6});
    const ref=path=>({path,id:path.split("/").at(-1),collection:name=>collection(`${path}/${name}`)});
    const collection=path=>({path,query:true,doc:id=>ref(`${path}/${id}`),limit:()=>collection(path)});
    const snap=(path,value)=>({id:path.split("/").at(-1),exists:value!==undefined,
        data:()=>value,get:key=>key.split(".").reduce((row,part)=>row?.[part],value)});
    let writes=0;
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const recovery=createCanonicalCurrentRecovery({db:{collection},HttpsError,
        FieldValue:{serverTimestamp:()=>"server-stamp"},
        inspectExistingEnvelope:value=>({kind:"current",serverRevision:value.serverRevision,data:value}),
        nextRevision:envelope=>envelope.serverRevision+1,now:()=>Date.parse("2026-10-17T00:00:00Z"),
        runProtected:async(_request,operation)=>{
            const staged=new Map(data);let writing=false;
            const tx={get:async r=>{assert.equal(writing,false);if(!r.query)return snap(r.path,staged.get(r.path));
                const docs=[...staged].filter(([path])=>path.startsWith(r.path+"/")&&
                    path.split("/").length===r.path.split("/").length+1).map(([p,v])=>snap(p,v));
                return {docs,size:docs.length};},
                set:(r,v)=>{writing=true;writes++;staged.set(r.path,v);},
                create:(r,v)=>{assert.equal(staged.has(r.path),false);tx.set(r,v);},
                update:(r,v)=>{assert.ok(staged.has(r.path));tx.set(r,{...staged.get(r.path),...v});}};
            const result=await operation(tx,{uid});data.clear();for(const entry of staged)data.set(...entry);return result;
        }});
    return {data,current,recovery,writes:()=>writes};
}
async function refused(h){
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="data-loss");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
}
test("a surviving newer source in each of ten domains blocks old-envelope recovery before writes",async()=>{
    const probe=fixture();assert.equal(probe.current.size,10);
    for(const path of probe.current.keys()){
        const h=fixture();h.data.set(path,{...h.data.get(path),serverRevision:8});await refused(h);
    }
});
test("full source loss cannot hide a later or unknown independently retained unique claim",async()=>{
    for(const extra of [false,true]){
        const h=fixture();for(const path of h.current.keys())h.data.delete(path);
        const id=extra?"later-independent-claim":grantId;
        h.data.set(`${root}/uniqueClaims/${id}`,{schemaVersion:1,ownerUid:uid,
            grantId:id,operationId:creditId,creditRevision:8});
        await refused(h);
    }
});
test("archived claims require original grant, receipt, ledger and historical source evidence",async()=>{
    for(const path of [`pendingGrants/${grantId}`,`grantOperations/${creditId}`,
        `ledgerEntries/${creditId}`,`uniqueClaims/${grantId}`,"playableSnapshots/5","recoveryArchives/5"]){
        const h=fixture();for(const current of h.current.keys())h.data.delete(current);
        h.data.delete(`${root}/${path}`);await refused(h);
    }
});
test("inconsistent independent credit proof cannot be accepted merely because archive hashes agree",async()=>{
    for(const [path,field,value] of [
        [`grantOperations/${creditId}`,"amount",26],
        [`ledgerEntries/${creditId}`,"balanceAfter",26],
        [`uniqueClaims/${grantId}`,"ownerUid","other-owner"],
        [`uniqueClaims/${grantId}`,"grantId","other-grant"],
        [`uniqueClaims/${grantId}`,"operationId","other-credit-proof-0001"]]){
        const h=fixture();h.data.set(`${root}/${path}`,{...h.data.get(`${root}/${path}`),[field]:value});
        await refused(h);
    }
});
test("unbounded independent claim evidence is refused before reads can grow without limit",async()=>{
    const h=fixture();for(let i=0;i<34;i++)h.data.set(`${root}/uniqueClaims/extra-${i}`,{});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("old credit receipts without delta evidence remain blocked without backfill",async()=>{
    const h=fixture();delete h.data.get(`${root}/ledgerEntries/${creditId}`).creditEvidenceVersion;
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition"&&
        e.message==="CREDIT_EVIDENCE_REQUIRED");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("unknown surviving revision cannot be silently treated as old or missing",async()=>{
    for(const path of fixture().current.keys()){
        for(const revision of [undefined,null,"7",0,-1,6.5,Number.MAX_SAFE_INTEGER+1]){
            const h=fixture();h.data.set(path,{...h.data.get(path),serverRevision:revision});await refused(h);
        }
    }
});
test("known older/current sources and entirely missing sources still restore without changing history",async()=>{
    for(const mode of ["current","older","missing"]){
        const h=fixture();for(const [path,row] of h.current){
            if(mode==="missing")h.data.delete(path);
            else h.data.set(path,{...row,serverRevision:mode==="older"?5:6});
        }
        const oldSnapshot=h.data.get(`${root}/playableSnapshots/6`),oldArchive=h.data.get(`${root}/recoveryArchives/6`);
        assert.deepEqual(await h.recovery.restoreCurrent({},intent),{
            restoredRevision:7,unchanged:false,authoritativeStateReady:false});
        for(const path of h.current.keys())assert.equal(h.data.get(path).serverRevision,7);
        assert.deepEqual(h.data.get(`${root}/playableSnapshots/6`),oldSnapshot);
        assert.deepEqual(h.data.get(`${root}/recoveryArchives/6`),oldArchive);
        assert.equal(h.data.get(env).authoritativeStateReady,false);
        // A completed original intent remains read-only even after newer live sources.
        h.data.get(env).serverRevision=9;
        for(const path of h.current.keys())h.data.set(path,{...h.data.get(path),serverRevision:9});
        h.data.set(`${root}/uniqueClaims/later-read-only-claim`,{schemaVersion:1,ownerUid:uid,
            grantId:"later-read-only-claim",operationId:"later-read-only-credit",creditRevision:9});
        const before=JSON.stringify([...h.data]),count=h.writes();
        assert.deepEqual(await h.recovery.restoreCurrent({},intent),{
            restoredRevision:7,unchanged:true,authoritativeStateReady:false});
        assert.equal(h.writes(),count);assert.equal(JSON.stringify([...h.data]),before);
    }
});
