"use strict";
const {randomBytes}=require("node:crypto");
const Core=require("./hero-core");
const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,snapshotDigest:digest,
    claimRecordsDigest}=require("./canonical-snapshot");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources,advanceOwnedRecords}=require("./canonical-owned-sources");

// Existing progress/current playableState.heroAccount and inventory remain the
// only growth/resource sources. No resource minting or legacy adoption endpoint.
function createHeroGrowth({db,FieldValue,HttpsError,runProtected,inspectExistingEnvelope,
    nextRevision,acquisition,seed=()=>randomBytes(4).readUInt32BE()||1}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const domain=account=>Core.createDomain(account,()=>[],()=>null,()=>null);
    const keys=value=>Object.keys(value||{}).sort().join("|");
    const audit=value=>{const {createdAt,updatedAt,...row}=value;return row;};
    const pillCount=records=>records.inventory.filter(item=>item.location==="bag"&&
        item.state.id===Core.contract.rerollItem.id).reduce((sum,item)=>{
            const count=sum+item.state.count;
            if(!Number.isSafeInteger(count)){fail("data-loss","Invalid resource total.");}
            return count;
        },0);
    async function context(tx,session){
        const uid=session.uid,root=db.collection("serverUsers").doc(uid);
        const rights=await acquisition.readInTransaction(tx,session);
        const refs=Object.fromEntries(["account","economy","progress","relicLoadout","claimCheckpoints"]
            .map(name=>[name,root.collection(name).doc("current")]));
        const snaps=await Promise.all(Object.values(refs).map(ref=>tx.get(ref)));
        if(snaps.some(s=>!s.exists)){fail("failed-precondition","Canonical character sources required; local resources cannot be admitted.");}
        const rows=Object.fromEntries(Object.keys(refs).map((key,i)=>[key,source(snaps[i].data())]));
        const characterRefs=rows.account.slots.filter(Boolean).map(id=>root.collection("characters").doc(id));
        const characterSnaps=await Promise.all(characterRefs.map(ref=>tx.get(ref)));
        if(characterSnaps.some(s=>!s.exists)){fail("data-loss","Character source missing.");}
        const owned=await readOwnedSources(tx,root,fail);
        const records={account:rows.account,economy:rows.economy,progress:rows.progress,
            relicLoadout:rows.relicLoadout,claimCheckpoint:rows.claimCheckpoints,
            characters:characterSnaps.map(s=>source(s.data())),...owned.records};
        const revision=records.account.serverRevision;
        const [snapshot,archive,envelopeSnap]=await Promise.all([
            tx.get(root.collection("playableSnapshots").doc(String(revision))),
            tx.get(root.collection("recoveryArchives").doc(String(revision))),
            tx.get(db.collection("users").doc(uid).collection("saves").doc("current"))]);
        try{
            if(!snapshot.exists||!archive.exists||!envelopeSnap.exists){throw Error("missing");}
            verifyCanonicalSnapshotAgainstSources(snapshot.data(),uid,revision,records);
            inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data());
            if(snaps[0].data().snapshotSha256!==snapshot.data().sha256){throw Error("pointer");}
        }catch(_){fail("data-loss","Canonical source/snapshot/archive is incomplete.");}
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
        if(envelope.kind!=="current"||revision>envelope.serverRevision||
           envelope.data.authoritativeStateReady!==false){fail("failed-precondition","Unsupported account publication state.");}
        let account;
        try{
            const raw=records.progress.playableState.heroAccount;
            account=Core.normalizeAccountState(raw);
            if(digest(account)!==digest(raw)){throw Error("noncanonical");}
        }catch(_){fail("data-loss","Canonical Hero growth source missing or invalid.");}
        for(const [id,grant] of Object.entries(rights.entitlements)){
            if(!account.heroes[id].unlocked){account=domain(account).unlockHeroDirect(id,grant.allocationSeed);}
        }
        return {uid,root,refs,owned,records,characterRefs,envelope,account,
            sourceSnapshotSha256:snapshot.data().sha256};
    }
    function view(c,unchanged=true){return {schemaVersion:1,ownerUid:c.uid,
        serverRevision:c.envelope.serverRevision,heroAccount:c.account,
        marrowPills:pillCount(c.records),unchanged,authoritativeStateReady:false};}
    async function read(request){
        if(keys(request.data)!=="session|uid"){fail("invalid-argument","Only active identity/session accepted.");}
        return runProtected(request,async(tx,session)=>view(await context(tx,session)));
    }
    async function mutate(request){
        const data=request.data||{}, {operationId,expectedRevision,action,heroId}=data;
        if(keys(data)!=="action|expectedRevision|heroId|operationId|session|uid"||
            !/^[A-Za-z0-9_-]{16,64}$/.test(operationId||"")||
            !Number.isSafeInteger(expectedRevision)||expectedRevision<1||
            !["unlock","starUp","reroll"].includes(action)||
            !Core.listHeroDefinitions().some(hero=>hero.heroId===heroId)){
            fail("invalid-argument","Only growth intent, operation and revision accepted.");
        }
        const randomSeed=seed(); // Pinned once across transaction retries.
        if(!Number.isSafeInteger(randomSeed)||randomSeed<1||randomSeed>0xffffffff){fail("internal","Invalid allocation seed.");}
        return runProtected(request,async(tx,session)=>{
            const c=await context(tx,session);
            const opRef=c.root.collection("operations").doc(operationId);
            const ledgerRef=c.root.collection("ledgerEntries").doc(operationId);
            const claimRef=c.root.collection("uniqueClaims").doc("hero-fragment-v1-"+heroId);
            const [op,ledger,claim]=await Promise.all([tx.get(opRef),tx.get(ledgerRef),tx.get(claimRef)]);
            const intent={operationId,expectedRevision,action,heroId};
            if(op.exists){
                const receipt=audit(op.data());
                if(receipt.kind!=="hero-growth"||receipt.ownerUid!==c.uid||
                   digest(receipt.intent)!==digest(intent)||!ledger.exists||
                   digest(audit(ledger.data()))!==digest(receipt)||!op.data().createdAt||!ledger.data().createdAt){
                    fail("data-loss","Growth receipt/ledger mismatch.");
                }
                const [original,archive,prior,priorArchive]=await Promise.all([
                    tx.get(c.root.collection("playableSnapshots").doc(String(receipt.serverRevision))),
                    tx.get(c.root.collection("recoveryArchives").doc(String(receipt.serverRevision))),
                    tx.get(c.root.collection("playableSnapshots").doc(String(receipt.sourceRevision))),
                    tx.get(c.root.collection("recoveryArchives").doc(String(receipt.sourceRevision)))]);
                try{
                    if(!original.exists||!archive.exists||original.data().sha256!==receipt.snapshotSha256||
                       receipt.serverRevision>c.envelope.serverRevision){throw Error("missing");}
                    const stored=inspectRecoveryArchive(archive.data(),c.uid,receipt.serverRevision,original.data());
                    if(digest(stored.progress.playableState.heroAccount)!==receipt.heroAccountSha256){throw Error("hero");}
                    if(!prior.exists||!priorArchive.exists||prior.data().sha256!==receipt.sourceSnapshotSha256||
                       !Number.isSafeInteger(receipt.sourceRevision)||receipt.sourceRevision<1||
                       receipt.sourceRevision>expectedRevision||receipt.serverRevision!==expectedRevision+1){throw Error("source");}
                    const old=inspectRecoveryArchive(priorArchive.data(),c.uid,receipt.sourceRevision,prior.data());
                    const balances=records=>({specificFragments:records.progress.playableState.heroAccount.heroes[heroId].specificFragments,
                        marrowPills:pillCount(records)});
                    if(digest(balances(old))!==digest(receipt.beforeResources)||
                       digest(balances(stored))!==digest(receipt.afterResources)||
                       receipt.fragmentDelta!==receipt.afterResources.specificFragments-receipt.beforeResources.specificFragments||
                       receipt.marrowPillDelta!==receipt.afterResources.marrowPills-receipt.beforeResources.marrowPills){throw Error("delta");}
                    if(action==="unlock"&&(!claim.exists||digest(audit(claim.data()))!==digest(receipt))){throw Error("claim");}
                }catch(_){fail("data-loss","Original growth evidence missing or inconsistent.");}
                return {...view(c),receipt};
            }
            if(ledger.exists||action==="unlock"&&claim.exists){fail("data-loss","Orphan growth evidence cannot be recreated.");}
            if(c.envelope.serverRevision!==expectedRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
            const before=c.account.heroes[heroId],pills=pillCount(c.records);
            const allocationSeed=randomSeed===before.allocationSeed?(randomSeed===0xffffffff?1:randomSeed+1):randomSeed;
            let nextAccount;
            try{
                const d=domain(c.account);
                nextAccount=action==="unlock"?d.unlockHero(heroId,allocationSeed):
                    action==="starUp"?d.starUpHero(heroId):d.rerollHeroAllocation(heroId,allocationSeed,pills);
            }catch(_){fail("failed-precondition","Hero/resource eligibility failed.");}
            const revision=nextRevision(c.envelope),owned=advanceOwnedRecords(c.records,revision);
            const removed=new Set();
            if(action==="reroll"){
                const item=owned.inventory.filter(i=>i.location==="bag"&&i.state.id===Core.contract.rerollItem.id)
                    .sort((a,b)=>a.ownedItemId.localeCompare(b.ownedItemId,"en"))[0];
                if(item.state.count===1){removed.add(item.ownedItemId);owned.inventory=owned.inventory.filter(i=>i!==item);}
                else{item.state={...item.state,count:item.state.count-1};}
            }
            const records={...c.records,...owned,
                account:{...c.records.account,serverRevision:revision},
                characters:c.records.characters.map(row=>({...row,serverRevision:revision})),
                economy:{...c.records.economy,serverRevision:revision},
                relicLoadout:{...c.records.relicLoadout,serverRevision:revision},
                progress:{...c.records.progress,serverRevision:revision,
                    playableState:{...c.records.progress.playableState,heroAccount:nextAccount}},
                claimCheckpoint:{...c.records.claimCheckpoint,serverRevision:revision,claimDigest:claimRecordsDigest(owned.claimRecords)}};
            let bundle,archive;
            try{bundle=assembleCanonicalSnapshot(c.uid,revision,records);archive=createRecoveryArchive(c.uid,revision,records,bundle);}
            catch(_){fail("data-loss","Growth cannot form canonical recovery evidence.");}
            const receipt={schemaVersion:1,ownerUid:c.uid,kind:"hero-growth",intent,serverRevision:revision,
                sourceRevision:c.records.account.serverRevision,sourceSnapshotSha256:c.sourceSnapshotSha256,
                snapshotSha256:bundle.sha256,heroAccountSha256:digest(nextAccount),
                beforeResources:{specificFragments:before.specificFragments,marrowPills:pills},
                afterResources:{specificFragments:nextAccount.heroes[heroId].specificFragments,marrowPills:pillCount(records)},
                fragmentDelta:nextAccount.heroes[heroId].specificFragments-before.specificFragments,
                marrowPillDelta:action==="reroll"?-1:0};
            const stamp=FieldValue.serverTimestamp();
            for(const [key,ref] of Object.entries(c.refs)){
                const row=key==="claimCheckpoints"?records.claimCheckpoint:records[key];
                tx.update(ref,{...row,...(key==="account"?{snapshotSha256:bundle.sha256}:{}),updatedAt:stamp});
            }
            c.characterRefs.forEach((ref,i)=>tx.update(ref,{...records.characters[i],updatedAt:stamp}));
            const ownedMap=new Map(records.inventory.map(row=>[row.ownedItemId,row]));
            for(const ref of c.owned.refs){
                if(removed.has(ref.id)){tx.delete(ref);continue;}
                const original=c.owned.records.inventory.find(i=>i.ownedItemId===ref.id);
                tx.update(ref,original?{...ownedMap.get(ref.id),updatedAt:stamp}:{serverRevision:revision,updatedAt:stamp});
            }
            tx.create(c.root.collection("playableSnapshots").doc(String(revision)),{...bundle,createdAt:stamp});
            tx.create(c.root.collection("recoveryArchives").doc(String(revision)),{...archive,createdAt:stamp});
            tx.create(opRef,{...receipt,createdAt:stamp});tx.create(ledgerRef,{...receipt,createdAt:stamp});
            if(action==="unlock"){tx.create(claimRef,{...receipt,createdAt:stamp});}
            tx.update(db.collection("users").doc(c.uid).collection("saves").doc("current"),{serverRevision:revision,updatedAt:stamp});
            return {...view({...c,records,account:nextAccount,envelope:{...c.envelope,serverRevision:revision}},false),receipt};
        });
    }
    return Object.freeze({read,mutate});
}
module.exports={createHeroGrowth};
