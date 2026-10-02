"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,claimRecordsDigest}=
    require("./canonical-snapshot");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {verifyCreditedGrant}=require("./credited-grant-evidence");
const {source,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=
    require("./canonical-owned-sources");
const {taipeiDay,REWARD_GOLD}=require("./daily-checkin-policy");
const {readDailyCheckinEvidence}=require("./daily-checkin-event-evidence");
const ID=/^[A-Za-z0-9_-]{16,64}$/;

// Internal gold/EXP pool settlement for the first server-created character.
// There is no callable or browser amount input. Later source-set mutations
// need their own complete transaction before publication is possible.
function createCanonicalResourceCredit({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    async function settle(request,{grantId,operationId,expectedRevision,dailyDay=null}){
        if(!ID.test(grantId||"")||!ID.test(operationId||"")||
           (dailyDay===null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1))){
            fail("invalid-argument","A grant, operation and revision are required.");
        }
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const economyRef=root.collection("economy").doc("current");
            const loadoutRef=root.collection("relicLoadout").doc("current");
            const progressRef=root.collection("progress").doc("current");
            const checkpointRef=root.collection("claimCheckpoints").doc("current");
            const grantRef=root.collection("pendingGrants").doc(grantId);
            const receiptRef=root.collection("grantOperations").doc(operationId);
            const claimRef=root.collection("uniqueClaims").doc(grantId);
            const claimRecordRef=root.collection("claimRecords").doc(grantId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const otherOperationRef=root.collection("operations").doc(operationId);
            const refs=[envelopeRef,accountRef,economyRef,loadoutRef,progressRef,
                checkpointRef,grantRef,receiptRef,claimRef,claimRecordRef,ledgerRef,otherOperationRef];
            const [envelopeSnap,accountSnap,economySnap,loadoutSnap,progressSnap,
                checkpointSnap,grantSnap,receiptSnap,claimSnap,claimRecordSnap,ledgerSnap,
                otherOperationSnap]=
                await Promise.all(refs.map(ref=>tx.get(ref)));
            if(!envelopeSnap.exists||!accountSnap.exists||!economySnap.exists||
               !loadoutSnap.exists||!progressSnap.exists||!checkpointSnap.exists||
               (dailyDay===null&&(!grantSnap.exists||!receiptSnap.exists))){
                fail("failed-precondition","Complete canonical sources and reserved grant required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            const account=accountSnap.data(),economy=economySnap.data();
            if(dailyDay!==null&&grantSnap.exists){
                const existing=grantSnap.data();
                if(existing.eventType!=="daily-checkin"||existing.periodDate!==dailyDay||
                   existing.amount!==REWARD_GOLD){
                    fail("data-loss","Daily grant provenance is inconsistent.");
                }
            }
            if(dailyDay!==null&&!grantSnap.exists&&receiptSnap.exists){
                fail("data-loss","Daily receipt has no grant source.");
            }
            if(dailyDay!==null&&grantSnap.exists&&
               (grantSnap.get("status")==="pending")===receiptSnap.exists){
                fail("data-loss","Daily reservation and receipt disagree.");
            }
            const grant=grantSnap.exists?grantSnap.data():{
                schemaVersion:1,ownerUid:uid,kind:"gold",source:"server-event",
                amount:REWARD_GOLD,status:"reserved",claimedByOperationId:operationId,
                eventType:"daily-checkin",periodDate:dailyDay};
            const receipt=receiptSnap.exists?receiptSnap.data():{
                schemaVersion:1,ownerUid:uid,operationId,grantId,kind:"gold",
                amount:REWARD_GOLD,creditedToCharacter:false};
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               economy.ownerUid!==uid||grant.ownerUid!==uid||receipt.ownerUid!==uid||
               grant.schemaVersion!==1||receipt.schemaVersion!==1||
               !["gold","exp"].includes(grant.kind)||grant.source!=="server-event"||
               (dailyDay!==null&&grant.status==="pending"&&
                   grant.claimedByOperationId===null?false:
                   grant.claimedByOperationId!==operationId)||
               receipt.operationId!==operationId||
               receipt.grantId!==grantId||receipt.kind!==grant.kind||
               !Number.isSafeInteger(grant.amount)||grant.amount<1||grant.amount>100000||
               receipt.amount!==grant.amount||
               !Number.isSafeInteger(economy.gold)||economy.gold<0||
               !Number.isSafeInteger(economy.sharedExp)||economy.sharedExp<0){
                fail("data-loss","Grant or canonical source identity is inconsistent.");
            }
            const eventProof=await readDailyCheckinEvidence({tx,root,uid,grantId,grant,fail,
                allowCreate:dailyDay!==null&&!grantSnap.exists,day:dailyDay,
                characterId:account.slots?.[0],sourceRevision:account.serverRevision,
                sourceSnapshotSha256:account.snapshotSha256});
            if(eventProof&&(eventProof.event.characterId!==account.slots?.[0]||
                eventProof.event.sourceRevision>account.serverRevision)){
                fail("data-loss","Grant event eligibility is inconsistent.");
            }
            if(eventProof&&receiptSnap.exists&&receipt.sourceEventSha256!==eventProof.sha256){
                fail("data-loss","Grant receipt event binding is inconsistent.");
            }
            if(receipt.creditedToCharacter===true){
                await verifyCreditedGrant({tx,root,uid,grantId,operationId,
                    currentRevision:envelope.serverRevision,grant,receipt,
                    ledger:ledgerSnap.exists?ledgerSnap.data():null,
                    claim:claimSnap.exists?claimSnap.data():null,
                    claimRecord:claimRecordSnap.exists?claimRecordSnap.data():null,
                    otherOperationExists:otherOperationSnap.exists,fail});
                return {creditRevision:receipt.creditRevision,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(!(grant.status==="reserved"||dailyDay!==null&&grant.status==="pending"&&
                 grant.claimedByOperationId===null&&!receiptSnap.exists)||
               receipt.creditedToCharacter!==false||
               claimSnap.exists||claimRecordSnap.exists||ledgerSnap.exists||
               otherOperationSnap.exists){
                fail("failed-precondition","Grant is not available for first credit.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const previous=account.serverRevision;
            if(!Number.isSafeInteger(previous)||previous<1||previous>expectedRevision||
               !Array.isArray(account.slots)||account.slots.length!==3||
               typeof account.slots[0]!=="string"||
               account.slots[1]!==null||account.slots[2]!==null||
               !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
                fail("failed-precondition","First-character source is not eligible.");
            }
            const characterRef=root.collection("characters").doc(account.slots[0]);
            const previousSnapshotRef=root.collection("playableSnapshots").doc(String(previous));
            const [characterSnap,previousSnapshotSnap,previousArchiveSnap]=await Promise.all([
                tx.get(characterRef),tx.get(previousSnapshotRef),
                tx.get(root.collection("recoveryArchives").doc(String(previous)))]);
            if(!characterSnap.exists||!previousSnapshotSnap.exists||
               previousSnapshotSnap.get("sha256")!==account.snapshotSha256){
                fail("data-loss","Previous canonical source snapshot is missing.");
            }
            const owned=await readOwnedSources(tx,root,fail);
            const records={account:source(account),characters:[source(characterSnap.data())],
                economy:source(economy),...owned.records,
                relicLoadout:source(loadoutSnap.data()),progress:source(progressSnap.data()),
                claimCheckpoint:source(checkpointSnap.data())};
            try{verifyCanonicalSnapshotAgainstSources(previousSnapshotSnap.data(),
                uid,previous,records);
                inspectRecoveryArchive(previousArchiveSnap.data(),uid,previous,
                    previousSnapshotSnap.data());
            }catch(_){
                fail("data-loss","Previous canonical sources differ from snapshot.");
            }
            const balanceKey=grant.kind==="gold"?"gold":"sharedExp";
            if(economy[balanceKey]>Number.MAX_SAFE_INTEGER-grant.amount){
                fail("failed-precondition","Resource balance exceeds safe range.");
            }
            const revision=nextRevision(envelope);
            const nextClaim={schemaVersion:1,ownerUid:uid,serverRevision:revision,
                provenance:"server-created",claimKey:grantId,status:"claimed",
                operationId,grantId};
            const nextClaims=[...records.claimRecords.map(record=>
                ({...record,serverRevision:revision})),nextClaim]
                .sort((a,b)=>a.claimKey.localeCompare(b.claimKey,"en"));
            const nextRecords={...records,...advanceOwnedRecords(records,revision),
                account:{...records.account,serverRevision:revision},
                characters:records.characters.map(c=>({...c,serverRevision:revision})),
                economy:{...records.economy,serverRevision:revision,
                    [balanceKey]:economy[balanceKey]+grant.amount},
                relicLoadout:{...records.relicLoadout,serverRevision:revision},
                progress:{...records.progress,serverRevision:revision},
                claimRecords:nextClaims,
                claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,
                    claimCount:nextClaims.length,
                    claimDigest:claimRecordsDigest(nextClaims)}};
            const bundle=assembleCanonicalSnapshot(uid,revision,nextRecords);
            const stamp=FieldValue.serverTimestamp();
            if(eventProof?.create){
                tx.create(eventProof.ref,{...eventProof.event,sha256:eventProof.sha256,createdAt:stamp});
            }
            tx.update(accountRef,{serverRevision:revision,snapshotSha256:bundle.sha256,updatedAt:stamp});
            tx.update(characterRef,{serverRevision:revision,updatedAt:stamp});
            tx.update(economyRef,{serverRevision:revision,
                [balanceKey]:nextRecords.economy[balanceKey],updatedAt:stamp});
            for(const ref of [loadoutRef,progressRef]){
                tx.update(ref,{serverRevision:revision,updatedAt:stamp});
            }
            tx.update(checkpointRef,{serverRevision:revision,
                claimCount:nextClaims.length,
                claimDigest:nextRecords.claimCheckpoint.claimDigest,updatedAt:stamp});
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(root.collection("playableSnapshots").doc(String(revision)),
                {...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),
                {...createRecoveryArchive(uid,revision,nextRecords,bundle),createdAt:stamp});
            tx.create(claimRecordRef,{...nextClaim,createdAt:stamp,updatedAt:stamp});
            tx.create(claimRef,{schemaVersion:1,ownerUid:uid,grantId,operationId,
                creditRevision:revision,createdAt:stamp});
            tx.create(ledgerRef,{schemaVersion:1,ownerUid:uid,grantId,operationId,
                kind:grant.kind,amount:grant.amount,
                ...(eventProof?{sourceEventSha256:eventProof.sha256}:{}),
                creditEvidenceVersion:1,sourceRevision:previous,
                sourceSnapshotSha256:previousSnapshotSnap.get("sha256"),
                balanceBefore:economy[balanceKey],
                balanceAfter:nextRecords.economy[balanceKey],
                creditRevision:revision,snapshotSha256:bundle.sha256,createdAt:stamp});
            if(dailyDay!==null){
                if(receiptSnap.exists){
                    tx.update(receiptRef,{creditedToCharacter:true,creditRevision:revision,
                        snapshotSha256:bundle.sha256,creditedAt:stamp});
                }else{
                    tx.create(receiptRef,{schemaVersion:1,ownerUid:uid,operationId,grantId,
                        kind:"gold",amount:REWARD_GOLD,serverRevision:revision,
                        sourceEventSha256:eventProof.sha256,
                        creditedToCharacter:true,creditRevision:revision,
                        snapshotSha256:bundle.sha256,createdAt:stamp,creditedAt:stamp});
                }
                if(grantSnap.exists){
                    tx.update(grantRef,{status:"credited",claimedByOperationId:operationId,
                        creditedAt:stamp});
                }else{
                    tx.create(grantRef,{schemaVersion:1,ownerUid:uid,kind:"gold",
                        source:"server-event",eventType:"daily-checkin",periodDate:dailyDay,
                        sourceEventSha256:eventProof.sha256,
                        amount:REWARD_GOLD,status:"credited",claimedByOperationId:operationId,
                        createdAt:stamp,creditedAt:stamp});
                }
            }else{
                tx.update(receiptRef,{creditedToCharacter:true,creditRevision:revision,
                    snapshotSha256:bundle.sha256,creditedAt:stamp});
                tx.update(grantRef,{status:"credited",creditedAt:stamp});
            }
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {creditRevision:revision,unchanged:false,
                authoritativeStateReady:false};
        });
    }
    async function creditReservedGrant(request,args){
        return settle(request,{...args,dailyDay:null});
    }
    async function claimDailyCheckin(request){
        if(Object.keys(request.data||{}).sort().join(",")!=="expectedRevision,session,uid"||
           !Number.isSafeInteger(request.data.expectedRevision)||
           request.data.expectedRevision<1){
            fail("invalid-argument","Account, session and expected revision are required.");
        }
        // One server clock reading for the entire transaction, including retries.
        const dailyDay=taipeiDay(Date.now());
        const grantId=`daily-checkin-${dailyDay}`;
        const result=await settle(request,{grantId,operationId:`${grantId}-credit`,
            expectedRevision:request.data.expectedRevision,dailyDay});
        return {...result,grantId,periodDate:dailyDay};
    }
    return Object.freeze({creditReservedGrant,claimDailyCheckin});
}

module.exports={createCanonicalResourceCredit};
