import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
const require=createRequire(import.meta.url);
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources.js");
const {assembleCanonicalSnapshot,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive.js");
const {createCanonicalCurrentRecovery}=require("../functions/src/canonical-current-recovery.js");
const {eventDigest}=require("../functions/src/daily-checkin-event-evidence.js");
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
const pendingId="daily-checkin-20261018";
function addPending(h,revision=5){
    const stamp={toMillis:()=>1},records=structuredClone(h.data.get(`${root}/recoveryArchives/5`).sourceRecords);
    if(revision!==5){
        for(const rows of Object.values(records)){
            for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=revision;
        }
        const snapshot=assembleCanonicalSnapshot(uid,revision,records);
        h.data.set(`${root}/playableSnapshots/${revision}`,snapshot);
        h.data.set(`${root}/recoveryArchives/${revision}`,createRecoveryArchive(uid,revision,records,snapshot));
    }
    const event={schemaVersion:1,ownerUid:uid,eventId:pendingId,eventType:"daily-checkin",
        periodDate:"20261018",kind:"gold",amount:50,characterId:records.account.slots[0],sourceRevision:revision};
    const digest=eventDigest(event);
    h.data.set(`${root}/rewardEvents/${pendingId}`,{...event,sha256:digest,createdAt:stamp});
    h.data.set(`${root}/pendingGrants/${pendingId}`,{schemaVersion:1,ownerUid:uid,
        source:"server-event",eventType:"daily-checkin",periodDate:"20261018",kind:"gold",amount:50,
        status:"pending",claimedByOperationId:null,sourceEventSha256:digest,createdAt:stamp});
}
test("retained original reward event cannot disappear behind a missing grant",async()=>{
    const h=fixture();addPending(h);h.data.delete(`${root}/pendingGrants/${pendingId}`);
    for(const path of h.current.keys())h.data.delete(path);
    await refused(h);
});
test("unknown event kinds cannot be ignored even when a same-ID grant remains",async()=>{
    const h=fixture();
    h.data.set(`${root}/rewardEvents/${grantId}`,{schemaVersion:1,ownerUid:uid,eventId:grantId,
        eventType:"unsupported-reward",kind:"gold",amount:25,sourceRevision:5,createdAt:{toMillis:()=>1}});
    await refused(h);
});
test("reward-event inventory is bounded before per-event source verification",async()=>{
    const h=fixture();for(let i=0;i<401;i++)h.data.set(`${root}/rewardEvents/orphan-${i}`,{});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("orphaned consumed grants cannot hide missing receipt and claim history",async()=>{
    for(const status of ["reserved","credited","unknown"]){
        const h=fixture();for(const path of h.current.keys())h.data.delete(path);
        h.data.set(`${root}/pendingGrants/orphaned-consumed-grant-0001`,{
            ...h.data.get(`${root}/pendingGrants/${grantId}`),status,
            claimedByOperationId:"orphaned-consumed-operation-0001"});
        await refused(h);
    }
});
test("pending daily grants require original event, identity and nonfuture source evidence",async()=>{
    for(const change of [
        h=>h.data.delete(`${root}/rewardEvents/${pendingId}`),
        h=>h.data.get(`${root}/pendingGrants/${pendingId}`).ownerUid="foreign-owner",
        h=>h.data.get(`${root}/pendingGrants/${pendingId}`).amount=999,
        h=>h.data.get(`${root}/pendingGrants/${pendingId}`).claimedByOperationId="unresolved-operation-0001",
        h=>h.data.get(`${root}/pendingGrants/${pendingId}`).createdAt=null,
        h=>addPending(h,8)
    ]){
        const h=fixture();addPending(h);change(h);const before=JSON.stringify([...h.data]);
        await assert.rejects(h.recovery.restoreCurrent({},intent),e=>["data-loss","failed-precondition"].includes(e.code));
        assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
    }
});
test("valid pending event-bound grant survives complete source loss without being reserved or credited",async()=>{
    const h=fixture();addPending(h);
    const grant=h.data.get(`${root}/pendingGrants/${pendingId}`),event=h.data.get(`${root}/rewardEvents/${pendingId}`);
    for(const path of h.current.keys())h.data.delete(path);
    assert.equal((await h.recovery.restoreCurrent({},intent)).restoredRevision,7);
    assert.deepEqual(h.data.get(`${root}/pendingGrants/${pendingId}`),grant);
    assert.deepEqual(h.data.get(`${root}/rewardEvents/${pendingId}`),event);
    assert.equal(h.data.get(`${root}/economy/current`).gold,25);
    assert.equal([...h.data.values()].filter(row=>row.grantId===pendingId).length,0);
});
test("unversioned pending grants stay retained but block recovery instead of inferring eligibility",async()=>{
    const h=fixture();h.data.set(`${root}/pendingGrants/unversioned-pending-grant-0001`,{
        schemaVersion:1,ownerUid:uid,source:"server-event",kind:"gold",amount:5,
        status:"pending",claimedByOperationId:null,createdAt:{toMillis:()=>1}});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("pending-grant inventory is bounded before per-grant evidence reads",async()=>{
    const h=fixture();for(let i=0;i<401;i++)h.data.set(`${root}/pendingGrants/orphan-${i}`,{});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("retained ledger inventory cannot hide a later credit after its receipt and claim index are lost",async()=>{
    for(const grant of [grantId,"later-orphaned-grant-0001"]){
        const h=fixture();for(const path of h.current.keys())h.data.delete(path);
        h.data.set(`${root}/ledgerEntries/later-orphaned-ledger-0001`,{
            ...h.data.get(`${root}/ledgerEntries/${creditId}`),grantId:grant,
            operationId:"later-orphaned-ledger-0001",creditRevision:8});
        await refused(h);
    }
});
test("unsupported ledger identity cannot be ignored even at an old revision",async()=>{
    for(const patch of [{operationId:creditId},{ownerUid:"foreign-owner"},
        {grantId:"unknown-retained-grant"},{kind:"hero-growth"}]){
        const h=fixture(),originalLedger=h.data.get(`${root}/ledgerEntries/${creditId}`);
        h.data.delete(`${root}/ledgerEntries/${creditId}`);
        h.data.set(`${root}/ledgerEntries/orphaned-ledger-proof-0001`,{
            ...originalLedger,
            operationId:"orphaned-ledger-proof-0001",...patch});
        await refused(h);
    }
});
const debitId="retained-debit-operation-0001";
function addDebit(h,kind){
    const records=structuredClone(h.data.get(`${root}/recoveryArchives/5`).sourceRecords);
    for(const rows of Object.values(records)){
        for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=4;
    }
    const characterId=records.account.slots[0],ownedItemId=`shop-${debitId}`;
    records.characters[0].state.level=2;
    records.inventory.push({schemaVersion:1,ownerUid:uid,serverRevision:4,provenance:"server-created",
        ownedItemId,location:"bag",state:{id:"hpPotion10",type:"potion",count:1}});
    const snapshot=assembleCanonicalSnapshot(uid,4,records);
    h.data.set(`${root}/playableSnapshots/4`,snapshot);
    h.data.set(`${root}/recoveryArchives/4`,createRecoveryArchive(uid,4,records,snapshot));
    const receipt={schemaVersion:1,ownerUid:uid,operationId:debitId,kind,snapshotSha256:snapshot.sha256,
        ...(kind==="shop-purchase"?{itemId:"hpPotion10",quantity:1,cost:20,ownedItemId,purchasedRevision:4}:
            kind==="exp-allocation"?{characterId,cost:10,levelAfter:2,allocatedRevision:4}:
            {characterId,stat:"vitality",statAfter:records.characters[0].state.vitality,
                pointsAfter:records.characters[0].state.attributePoints,allocatedRevision:4})};
    h.data.set(`${root}/operations/${debitId}`,receipt);
    h.data.set(`${root}/ledgerEntries/${debitId}`,{...receipt,amount:kind==="attribute-allocation"?-1:-receipt.cost});
}
test("retained debit receipts cannot disappear behind missing ledgers",async()=>{
    for(const kind of ["shop-purchase","exp-allocation","attribute-allocation"]){
        for(const missingSources of [false,true]){
            const h=fixture();addDebit(h,kind);
            h.data.delete(`${root}/ledgerEntries/${debitId}`);
            if(missingSources)for(const path of h.current.keys())h.data.delete(path);
            await refused(h);
        }
    }
});
test("operation receipt inventory is bounded before reverse debit reconciliation",async()=>{
    const h=fixture();for(let i=0;i<401;i++)h.data.set(`${root}/operations/retained-${i}`,{});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});

test("unknown, malformed and frozen operation history blocks fresh recovery without writes",async()=>{
    const operationId="unreconciled-operation-0001";
    for(const patch of [
        {kind:"unknown-operation"},{kind:null},{kind:"battle-source-preparation"},
        {kind:"restricted-battle-round"},{kind:"restricted-battle-terminal"},
        {kind:"canonical-current-recovery"},{kind:"daily-period-apply"},
        {kind:"shop-purchase",schemaVersion:2},
        {kind:"shop-purchase",ownerUid:"foreign-owner"},
        {kind:"shop-purchase",operationId:"different-operation-0001"}
    ]){
        for(const missingSources of [false,true]){
            const h=fixture();
            h.data.set(`${root}/operations/${operationId}`,{
                schemaVersion:1,ownerUid:uid,operationId,...patch});
            if(missingSources)for(const path of h.current.keys())h.data.delete(path);
            const before=JSON.stringify([...h.data]);
            const unsupported=["unknown-operation",null,"battle-source-preparation",
                "restricted-battle-round","restricted-battle-terminal"].includes(patch.kind);
            await assert.rejects(h.recovery.restoreCurrent({},intent),
                e=>e.code===(unsupported?"failed-precondition":"data-loss"));
            assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
        }
    }
});
test("supported purchase, EXP and attribute debit history survives full source loss without replaying costs",async()=>{
    for(const kind of ["shop-purchase","exp-allocation","attribute-allocation"]){
        const h=fixture();addDebit(h,kind);
        const receipt=h.data.get(`${root}/operations/${debitId}`),ledger=h.data.get(`${root}/ledgerEntries/${debitId}`);
        for(const path of h.current.keys())h.data.delete(path);
        assert.equal((await h.recovery.restoreCurrent({},intent)).restoredRevision,7);
        assert.deepEqual(h.data.get(`${root}/operations/${debitId}`),receipt);
        assert.deepEqual(h.data.get(`${root}/ledgerEntries/${debitId}`),ledger);
        assert.equal(h.data.get(`${root}/economy/current`).gold,25);
        assert.equal(h.data.get(`${root}/economy/current`).sharedExp,0);
    }
});

test("retained recovery history reuses original read-only proof before a later fresh repair",async()=>{
    for(const corrupt of [null,"recoveryAudits","recoveryApprovals","playableSnapshots","recoveryArchives"]){
        const h=fixture();await h.recovery.restoreCurrent({},intent);
        const nextIntent={operationId:"recover-next-current-revision-0001",expectedRevision:7};
        const archive=h.data.get(`${root}/recoveryArchives/7`),snapshot=h.data.get(`${root}/playableSnapshots/7`);
        h.data.set(`${root}/recoveryApprovals/${nextIntent.operationId}`,{
            schemaVersion:1,kind:"canonical-current-recovery-approval",ownerUid:uid,
            operationId:nextIntent.operationId,sourceRevision:7,sourceSha256:archive.sourceSha256,
            snapshotSha256:snapshot.sha256,approvedBy:"operator",status:"approved",
            expiresAt:{toMillis:()=>Date.parse("2026-12-01T00:00:00Z")}});
        if(corrupt){
            h.data.delete(`${root}/${corrupt}/${["recoveryAudits","recoveryApprovals"].includes(corrupt)?intent.operationId:"6"}`);
        }
        for(const path of h.current.keys())h.data.delete(path);
        const before=JSON.stringify([...h.data]),count=h.writes();
        if(corrupt){
            await assert.rejects(h.recovery.restoreCurrent({},nextIntent),e=>e.code==="data-loss");
            assert.equal(h.writes(),count);assert.equal(JSON.stringify([...h.data]),before);
        }else{
            const oldReceipt=h.data.get(`${root}/operations/${intent.operationId}`);
            assert.equal((await h.recovery.restoreCurrent({},nextIntent)).restoredRevision,8);
            assert.deepEqual(h.data.get(`${root}/operations/${intent.operationId}`),oldReceipt);
            assert.equal(h.data.get(`${root}/economy/current`).gold,25);
        }
    }
});

test("operation source proof budget is reserved before reading daily history",async()=>{
    const h=fixture();
    for(let i=0;i<12;i++)h.data.set(`${root}/operations/retained-daily-history-${i}`,{
        schemaVersion:1,ownerUid:uid,kind:"daily-period-apply"});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition"&&
        /transaction budget/.test(e.message));
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
test("debit ledgers require their original receipt, revision and intact snapshot/archive",async()=>{
    for(const kind of ["shop-purchase","exp-allocation","attribute-allocation"]){
        for(const change of [
            h=>h.data.delete(`${root}/operations/${debitId}`),
            h=>h.data.get(`${root}/operations/${debitId}`).ownerUid="foreign-owner",
            h=>h.data.get(`${root}/operations/${debitId}`)[kind==="shop-purchase"?"purchasedRevision":"allocatedRevision"]=8,
            h=>h.data.get(`${root}/ledgerEntries/${debitId}`).amount=-999,
            h=>h.data.delete(`${root}/playableSnapshots/4`),
            h=>h.data.delete(`${root}/recoveryArchives/4`),
            h=>h.data.get(`${root}/recoveryArchives/4`).sourceSha256="a".repeat(64),
            h=>h.data.set(`${root}/grantOperations/${debitId}`,{creditedToCharacter:false})
        ]){
            const h=fixture();addDebit(h,kind);change(h);await refused(h);
        }
    }
});
test("ledger inventory over budget refuses without writes",async()=>{
    const h=fixture();for(let i=0;i<401;i++)h.data.set(`${root}/ledgerEntries/orphan-${i}`,{});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
const reservedId="retained-reservation-0001",reservedGrant="retained-reserved-grant-0001";
function addReservation(h){
    const stamp={toMillis:()=>1};
    h.data.set(`${root}/pendingGrants/${reservedGrant}`,{schemaVersion:1,ownerUid:uid,
        source:"server-event",kind:"exp",amount:30,status:"reserved",
        claimedByOperationId:reservedId,createdAt:stamp});
    h.data.set(`${root}/grantOperations/${reservedId}`,{schemaVersion:1,ownerUid:uid,
        grantId:reservedGrant,operationId:reservedId,kind:"exp",amount:30,
        serverRevision:5,creditedToCharacter:false,createdAt:stamp});
}
test("receipt inventory detects an extra credited operation even when its unique claim is lost",async()=>{
    for(const grant of [grantId,"later-orphaned-grant-0001"]){
        const h=fixture();for(const path of h.current.keys())h.data.delete(path);
        h.data.set(`${root}/grantOperations/later-orphaned-credit-0001`,{
            ...h.data.get(`${root}/grantOperations/${creditId}`),grantId:grant,
            operationId:"later-orphaned-credit-0001",serverRevision:7,creditRevision:8});
        await refused(h);
    }
});
test("unknown receipt credit state cannot disappear from recovery reconciliation",async()=>{
    for(const flag of [undefined,null,"false",0]){
        const h=fixture();addReservation(h);
        h.data.get(`${root}/grantOperations/${reservedId}`).creditedToCharacter=flag;
        await refused(h);
    }
});
test("a valid uncredited reservation survives source loss and does not grant or spend",async()=>{
    const h=fixture();addReservation(h);
    const reservation=h.data.get(`${root}/grantOperations/${reservedId}`);
    const grant=h.data.get(`${root}/pendingGrants/${reservedGrant}`);
    for(const path of h.current.keys())h.data.delete(path);
    assert.equal((await h.recovery.restoreCurrent({},intent)).restoredRevision,7);
    assert.deepEqual(h.data.get(`${root}/grantOperations/${reservedId}`),reservation);
    assert.deepEqual(h.data.get(`${root}/pendingGrants/${reservedGrant}`),grant);
    assert.equal(h.data.get(`${root}/economy/current`).gold,25);
    assert.equal(h.data.get(`${root}/economy/current`).sharedExp,0);
    assert.equal(h.data.has(`${root}/uniqueClaims/${reservedGrant}`),false);
    assert.equal(h.data.has(`${root}/ledgerEntries/${reservedId}`),false);
});
test("reserved receipts need their original grant, revision, identity and empty ledger",async()=>{
    const changes=[
        h=>h.data.delete(`${root}/pendingGrants/${reservedGrant}`),
        h=>h.data.get(`${root}/grantOperations/${reservedId}`).serverRevision=8,
        h=>h.data.get(`${root}/grantOperations/${reservedId}`).ownerUid="foreign-owner",
        h=>h.data.get(`${root}/grantOperations/${reservedId}`).createdAt=null,
        h=>h.data.get(`${root}/pendingGrants/${reservedGrant}`).status="credited",
        h=>h.data.set(`${root}/ledgerEntries/${reservedId}`,{amount:30}),
        h=>h.data.set(`${root}/operations/${reservedId}`,{kind:"shop-purchase"})
    ];
    for(const change of changes){const h=fixture();addReservation(h);change(h);await refused(h);}
});
test("receipt inventory over budget is rejected before per-receipt proof reads",async()=>{
    const h=fixture();for(let i=0;i<401;i++)h.data.set(`${root}/grantOperations/extra-${i}`,{});
    const before=JSON.stringify([...h.data]);
    await assert.rejects(h.recovery.restoreCurrent({},intent),e=>e.code==="failed-precondition");
    assert.equal(h.writes(),0);assert.equal(JSON.stringify([...h.data]),before);
});
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
        h.data.set(`${root}/ledgerEntries/later-read-only-credit`,{schemaVersion:1,ownerUid:uid,
            operationId:"later-read-only-credit",creditRevision:9});
        h.data.set(`${root}/pendingGrants/later-read-only-grant`,{status:"unknown-later-history"});
        h.data.set(`${root}/rewardEvents/later-read-only-event`,{eventType:"unknown-later-history"});
        h.data.set(`${root}/operations/later-read-only-debit`,{kind:"shop-purchase",purchasedRevision:9});
        const before=JSON.stringify([...h.data]),count=h.writes();
        assert.deepEqual(await h.recovery.restoreCurrent({},intent),{
            restoredRevision:7,unchanged:true,authoritativeStateReady:false});
        assert.equal(h.writes(),count);assert.equal(JSON.stringify([...h.data]),before);
    }
});
