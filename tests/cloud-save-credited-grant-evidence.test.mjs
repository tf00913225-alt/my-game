import assert from "node:assert/strict";
import test from "node:test";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources");
const {assembleCanonicalSnapshot,claimRecordsDigest}=require("../functions/src/canonical-snapshot");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive");
const {createCanonicalResourceCredit}=require("../functions/src/canonical-resource-credit");
const {createTrustedGrantLedger}=require("../functions/src/trusted-grant-ledger");
const uid="evidence-user",grantId="grant-evidence-0001",operationId="credit-evidence-0001";
const prefix=`serverUsers/${uid}/`,stamp={toMillis:()=>1};
function fixture(kind="gold"){
    const before=makeInitialCharacterSources(uid,2,"initial-evidence-0001",{
        displayName:"驗證角色",element:"fire",gender:"male",
        attributes:{attack:10,intelligence:0,vitality:0,energy:0,defensePoints:0,agility:0}});
    const after=structuredClone(before);
    for(const value of Object.values(after)){
        for(const record of Array.isArray(value)?value:[value]) record.serverRevision=4;
    }
    const record={schemaVersion:1,ownerUid:uid,serverRevision:4,provenance:"server-created",
        claimKey:grantId,status:"claimed",operationId,grantId};
    after.claimRecords=[record];after.claimCheckpoint.claimCount=1;
    after.claimCheckpoint.claimDigest=claimRecordsDigest(after.claimRecords);
    after.economy[kind==="gold"?"gold":"sharedExp"]=25;
    const oldBundle=assembleCanonicalSnapshot(uid,2,before),bundle=assembleCanonicalSnapshot(uid,4,after);
    const common={schemaVersion:1,ownerUid:uid,grantId,operationId};
    const data=new Map(Object.entries({
        "account/current":after.account,"economy/current":structuredClone(after.economy),
        "relicLoadout/current":after.relicLoadout,"progress/current":after.progress,
        "claimCheckpoints/current":after.claimCheckpoint,
        [`pendingGrants/${grantId}`]:{schemaVersion:1,ownerUid:uid,source:"server-event",kind,
            amount:25,status:"credited",claimedByOperationId:operationId},
        [`grantOperations/${operationId}`]:{...common,kind,amount:25,serverRevision:3,
            creditRevision:4,snapshotSha256:bundle.sha256,creditedToCharacter:true,createdAt:stamp},
        [`ledgerEntries/${operationId}`]:{...common,kind,amount:25,creditRevision:4,
            snapshotSha256:bundle.sha256,balanceBefore:0,balanceAfter:25,creditEvidenceVersion:1,
            sourceRevision:2,sourceSnapshotSha256:oldBundle.sha256},
        [`uniqueClaims/${grantId}`]:{...common,creditRevision:4},
        [`claimRecords/${grantId}`]:{...record,serverRevision:10},
        "playableSnapshots/2":structuredClone(oldBundle),"playableSnapshots/4":structuredClone(bundle),
        "recoveryArchives/2":createRecoveryArchive(uid,2,before,oldBundle),
        "recoveryArchives/4":createRecoveryArchive(uid,4,after,bundle)
    }).map(([key,value])=>[prefix+key,value]));
    // Current economy may have advanced/spent the award. Replay uses immutable
    // historical proof, never rewinds or requires today's balance to equal 25.
    data.get(prefix+"economy/current").gold=999;
    data.set(`users/${uid}/saves/current`,{serverRevision:10,authoritativeStateReady:false});
    const collection=path=>({doc:id=>({path:`${path}/${id}`,collection:name=>collection(`${path}/${id}/${name}`)})});
    const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path),
        get:key=>data.get(ref.path)?.[key]}),create:()=>assert.fail("replay wrote"),update:()=>assert.fail("replay wrote")};
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const deps={db:{collection},HttpsError,runProtected:(_req,fn)=>fn(tx,{uid}),
        inspectExistingEnvelope:data=>({kind:"current",data,serverRevision:data.serverRevision})};
    const args={grantId,operationId,expectedRevision:3};
    return {data,credit:()=>createCanonicalResourceCredit(deps).creditReservedGrant({},args),
        reserve:()=>createTrustedGrantLedger(deps).reserve({data:args})};
}
for(const kind of ["gold","exp"]){
    test(`${kind}: both entry points replay original result after later balance/revision changes`,async()=>{
        const h=fixture(kind);assert.equal((await h.credit()).unchanged,true);
        assert.equal((await h.reserve()).creditedToCharacter,true);
    });
}
const mutations={
    "operation collision":h=>h.data.set(prefix+`operations/${operationId}`,{kind:"purchase"}),
    "missing original snapshot":h=>h.data.delete(prefix+"playableSnapshots/4"),
    "missing original archive":h=>h.data.delete(prefix+"recoveryArchives/4"),
    "missing prior archive":h=>h.data.delete(prefix+"recoveryArchives/2"),
    "snapshot corruption":h=>h.data.get(prefix+"playableSnapshots/4").sha256="0".repeat(64),
    "archive corruption":h=>h.data.get(prefix+"recoveryArchives/4").sourceRecords.economy.gold=5000,
    "ledger balance corruption":h=>h.data.get(prefix+`ledgerEntries/${operationId}`).balanceAfter=26,
    "ledger prior balance corruption":h=>h.data.get(prefix+`ledgerEntries/${operationId}`).balanceBefore=1,
    "cross UID":h=>h.data.get(prefix+"recoveryArchives/4").ownerUid="another-user",
    "claim mismatch":h=>h.data.get(prefix+`claimRecords/${grantId}`).operationId="wrong-operation-0001",
    "invalid credit revision":h=>h.data.get(prefix+`grantOperations/${operationId}`).creditRevision=0,
    "wrong source revision":h=>h.data.get(prefix+`ledgerEntries/${operationId}`).sourceRevision=4,
    "missing claim":h=>h.data.delete(prefix+`claimRecords/${grantId}`)
};
for(const [name,change] of Object.entries(mutations)){
    test(`both entry points reject ${name} without writes`,async()=>{
        const h=fixture();change(h);
        for(const run of [h.credit,h.reserve])await assert.rejects(run(),e=>e.code==="data-loss");
    });
}
test("old receipts lack delta evidence: retain and block without invented backfill",async()=>{
    const h=fixture();delete h.data.get(prefix+`ledgerEntries/${operationId}`).creditEvidenceVersion;
    for(const run of [h.credit,h.reserve])await assert.rejects(run(),e=>e.code==="failed-precondition"&&e.message==="CREDIT_EVIDENCE_REQUIRED");
});
