"use strict";
const Policy=require("./team-formation-policy");
const {advanceOwnedRecords}=require("./canonical-owned-sources");
const {assembleCanonicalSnapshot,snapshotDigest:digest,claimRecordsDigest}=require("./canonical-snapshot");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");

// The existing Hero growth verified canonical context is reused; no new account
// store, resource writer, combat lifecycle or full Cloud publication is created.
function createTeamFormation({db,FieldValue,HttpsError,runProtected,nextRevision,readContext}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const keys=value=>Object.keys(value||{}).sort().join("|");
    const strip=value=>{const {createdAt,updatedAt,...row}=value;return row;};
    const view=c=>({schemaVersion:1,ownerUid:c.uid,serverRevision:c.envelope.serverRevision,
        formation:c.records.account.formation?.version===2?c.records.account.formation:null,
        playerIndexes:c.records.account.slots.flatMap((id,index)=>id===null?[]:[index]),
        heroAccount:c.account,authoritativeStateReady:false});
    async function read(request){
        if(keys(request.data)!=="session|uid")fail("invalid-argument","Only identity/session accepted.");
        return runProtected(request,async(tx,session)=>view(await readContext(tx,session)));
    }
    async function save(request){
        const {operationId,expectedRevision,formation}=request.data||{};
        if(keys(request.data)!=="expectedRevision|formation|operationId|session|uid"||
            !/^[A-Za-z0-9_-]{16,64}$/.test(operationId||"")||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
            fail("invalid-argument","Only formation intent, operation and revision accepted.");
        return runProtected(request,async(tx,session)=>{
            const c=await readContext(tx,session),intent={operationId,expectedRevision,formation};
            const opRef=c.root.collection("operations").doc(operationId),ledgerRef=c.root.collection("ledgerEntries").doc(operationId);
            const [op,ledger]=await Promise.all([tx.get(opRef),tx.get(ledgerRef)]);
            if(op.exists){
                const receipt=strip(op.data());
                if(receipt.kind!=="team-formation"||receipt.ownerUid!==c.uid||digest(receipt.intent)!==digest(intent)||
                    !ledger.exists||!op.data().createdAt||!ledger.data().createdAt||digest(strip(ledger.data()))!==digest(receipt))
                    fail("data-loss","Formation receipt/ledger mismatch.");
                const [snapshot,archive,prior,priorArchive]=await Promise.all([
                    tx.get(c.root.collection("playableSnapshots").doc(String(receipt.serverRevision))),
                    tx.get(c.root.collection("recoveryArchives").doc(String(receipt.serverRevision))),
                    tx.get(c.root.collection("playableSnapshots").doc(String(receipt.sourceRevision))),
                    tx.get(c.root.collection("recoveryArchives").doc(String(receipt.sourceRevision)))]);
                try{
                    if(!snapshot.exists||!archive.exists||!prior.exists||!priorArchive.exists||
                        snapshot.data().sha256!==receipt.snapshotSha256||prior.data().sha256!==receipt.sourceSnapshotSha256||
                        receipt.serverRevision!==expectedRevision+1||receipt.serverRevision>c.envelope.serverRevision||
                        receipt.sourceRevision>expectedRevision||receipt.sourceRevision<1)throw Error("missing");
                    const stored=inspectRecoveryArchive(archive.data(),c.uid,receipt.serverRevision,snapshot.data());
                    inspectRecoveryArchive(priorArchive.data(),c.uid,receipt.sourceRevision,prior.data());
                    if(digest(stored.account.formation)!==digest(formation))throw Error("formation");
                }catch(_){fail("data-loss","Original formation recovery evidence missing.");}
                return {...view(c),receipt};
            }
            if(ledger.exists)fail("data-loss","Orphan formation ledger.");
            if(c.envelope.serverRevision!==expectedRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
            let next;
            try{next=Policy.validate(formation,view(c).playerIndexes,
                Object.keys(c.account.heroes).filter(id=>c.account.heroes[id].unlocked));}
            catch(_){fail("invalid-argument","Illegal/unowned formation.");}
            const revision=nextRevision(c.envelope),owned=advanceOwnedRecords(c.records,revision);
            const records={...c.records,...owned,
                account:{...c.records.account,formation:next,serverRevision:revision},
                characters:c.records.characters.map(row=>({...row,serverRevision:revision})),
                economy:{...c.records.economy,serverRevision:revision},
                relicLoadout:{...c.records.relicLoadout,serverRevision:revision},
                progress:{...c.records.progress,serverRevision:revision,playableState:{...c.records.progress.playableState,heroAccount:c.account}},
                claimCheckpoint:{...c.records.claimCheckpoint,serverRevision:revision,claimDigest:claimRecordsDigest(owned.claimRecords)}};
            let snapshot,archive;
            try{snapshot=assembleCanonicalSnapshot(c.uid,revision,records);archive=createRecoveryArchive(c.uid,revision,records,snapshot);}
            catch(_){fail("data-loss","Formation cannot form canonical recovery evidence.");}
            const receipt={schemaVersion:1,ownerUid:c.uid,kind:"team-formation",intent,serverRevision:revision,
                sourceRevision:c.records.account.serverRevision,sourceSnapshotSha256:c.sourceSnapshotSha256,snapshotSha256:snapshot.sha256};
            const stamp=FieldValue.serverTimestamp();
            for(const [key,ref] of Object.entries(c.refs)){
                const row=key==="claimCheckpoints"?records.claimCheckpoint:records[key];
                tx.update(ref,{...row,...(key==="account"?{snapshotSha256:snapshot.sha256}:{}),updatedAt:stamp});
            }
            c.characterRefs.forEach((ref,i)=>tx.update(ref,{...records.characters[i],updatedAt:stamp}));
            c.owned.refs.forEach(ref=>tx.update(ref,{serverRevision:revision,updatedAt:stamp}));
            tx.create(c.root.collection("playableSnapshots").doc(String(revision)),{...snapshot,createdAt:stamp});
            tx.create(c.root.collection("recoveryArchives").doc(String(revision)),{...archive,createdAt:stamp});
            tx.create(opRef,{...receipt,createdAt:stamp});tx.create(ledgerRef,{...receipt,createdAt:stamp});
            tx.update(db.collection("users").doc(c.uid).collection("saves").doc("current"),{serverRevision:revision,updatedAt:stamp});
            return {...view({...c,records,envelope:{...c.envelope,serverRevision:revision}}),receipt};
        });
    }
    return Object.freeze({read,save});
}
module.exports={createTeamFormation};
