"use strict";

const {assembleCanonicalSnapshot,inspectCanonicalSnapshot,
    assembleCanonicalPlayableProjection,verifyCanonicalSnapshotAgainstSources,
    snapshotDigest}=require("./canonical-snapshot");
const {makeInitialCharacterSources,makeInitialSidecars}=require("./initial-character-sources");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources}=require("./canonical-owned-sources");
const {taipeiDay}=require("./daily-checkin-policy");
const {createHash}=require("node:crypto");

const OPERATION_ID=/^[A-Za-z0-9_-]{16,64}$/;

// Internal transaction owner; its guarded callable accepts choices only.
// Source records and progression are never accepted from the browser.
function createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now}){
    const fail=(code,message)=>{ throw new HttpsError(code,message); };

    async function commitInitialSources(request,{operationId,expectedRevision,selection},
        {requireCurrentReplay=false}={}){
        if(!OPERATION_ID.test(operationId||"")||
           !Number.isSafeInteger(expectedRevision)||expectedRevision<1){
            fail("invalid-argument","An internal source operation needs an ID and revision.");
        }
        // Pin the server observation outside Firestore transaction retries.
        const recordedAt=now();
        return runProtected(request,async(transaction,session)=>{
            const uid=session.uid;
            let choices;
            try{ choices=makeInitialCharacterSources(uid,expectedRevision+1,
                operationId,selection); }
            catch(_){ fail("invalid-argument","Invalid initial character choices."); }
            const selectionSha256=createHash("sha256").update(JSON.stringify(
                choices.characters[0].state)).digest("hex");
            const root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const accountRef=root.collection("account").doc("current");
            const operationRef=root.collection("operations").doc(operationId);
            const grantOperationRef=root.collection("grantOperations").doc(operationId);
            const ledgerRef=root.collection("ledgerEntries").doc(operationId);
            const candidateRef=root.collection("migrationCandidates").doc("latest");
            const [envelopeSnap,accountSnap,operationSnap,grantOperationSnap,
                ledgerSnap,candidateSnap]=await Promise.all([
                transaction.get(envelopeRef),transaction.get(accountRef),
                transaction.get(operationRef),transaction.get(grantOperationRef),
                transaction.get(ledgerRef),transaction.get(candidateRef)
            ]);
            if(!envelopeSnap.exists){ fail("failed-precondition","Bootstrap the cloud account first."); }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false){
                fail("failed-precondition","A canonical account cannot be initialized here.");
            }
            if(operationSnap.exists){
                if(grantOperationSnap.exists||ledgerSnap.exists){
                    fail("data-loss","Initial character operation ID overlaps another operation.");
                }
                const receipt=operationSnap.data();
                if(!accountSnap.exists||receipt.ownerUid!==uid||
                   receipt.operationId!==operationId||receipt.kind!=="initial-character-sources"||
                   receipt.selectionSha256!==selectionSha256||
                   !Number.isSafeInteger(receipt.sourceRevision)||
                   receipt.sourceRevision<1||receipt.sourceRevision>envelope.serverRevision||
                   accountSnap.get("ownerUid")!==uid||
                   accountSnap.get("provenance")!=="server-created"||
                   accountSnap.get("slots")?.[0]!==`character-${operationId}`||
                   !Number.isSafeInteger(accountSnap.get("serverRevision"))||
                   accountSnap.get("serverRevision")<receipt.sourceRevision||
                   !/^[a-f0-9]{64}$/.test(receipt.snapshotSha256||"")){
                    fail("data-loss","Initial character receipt is inconsistent.");
                }
                // Later protected mutations advance the account digest. A lost
                // creation response resolves against its original version.
                const original=await transaction.get(root.collection("playableSnapshots")
                    .doc(String(receipt.sourceRevision)));
                let snapshot;
                try{
                    if(!original.exists||original.get("sha256")!==receipt.snapshotSha256){
                        throw new Error("Original source snapshot missing.");
                    }
                    snapshot=inspectCanonicalSnapshot(original.data(),uid,receipt.sourceRevision);
                }catch(_){ fail("data-loss","Initial character snapshot is inconsistent."); }
                if(snapshot.provenance!=="server-created"||
                   snapshot.slots?.[0]!==`character-${operationId}`||
                   snapshot.characters?.length!==1||
                   Object.keys(snapshot.characters[0].state||{}).sort().join("|")!==
                       Object.keys(choices.characters[0].state).sort().join("|")||
                   Object.keys(choices.characters[0].state).some(key=>
                       JSON.stringify(snapshot.characters[0].state[key])!==
                       JSON.stringify(choices.characters[0].state[key]))){
                    fail("data-loss","Initial character choices differ from the receipt.");
                }
                if(requireCurrentReplay&&
                   (envelope.serverRevision!==receipt.sourceRevision||
                    receipt.creationSessionId!==session.sessionId)){
                    fail("failed-precondition",
                        "An earlier session or advanced character cannot start a local save.");
                }
                return {sourceRevision:receipt.sourceRevision,
                    snapshotSha256:receipt.snapshotSha256,unchanged:true,
                    authoritativeStateReady:false};
            }
            if(grantOperationSnap.exists||ledgerSnap.exists){
                fail("failed-precondition","Operation ID is already used.");
            }
            if(accountSnap.exists||candidateSnap.exists||
               envelope.data.migrationCandidateStatus!=="none"){
                fail("failed-precondition","An existing character or migration candidate needs review.");
            }
            if(envelope.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const revision=nextRevision(envelope);
            const records=makeInitialCharacterSources(uid,revision,operationId,selection,{recordedAt});
            if(records?.account?.provenance!=="server-created"||
               records.claimRecords?.length!==0||records.characters?.length!==1||
               records.account.slots?.[1]!==null||records.account.slots?.[2]!==null||
               records.characters[0].state?.level!==1||
               records.characters[0].state?.exp!==0||
               records.economy?.gold!==0||records.economy?.sharedExp!==0||
               records.inventory?.length!==0||records.equipment?.length!==0||
               records.relics?.length!==0||
               JSON.stringify(records.progress?.sidecars)!==
                   JSON.stringify(makeInitialSidecars(recordedAt))){
                fail("failed-precondition","Initial source cannot import historical claims.");
            }
            let bundle;
            try{ bundle=assembleCanonicalSnapshot(uid,revision,records); }
            catch(_){ fail("failed-precondition","Initial character sources are incomplete."); }
            const stamp=FieldValue.serverTimestamp();
            const withStamp=record=>({...record,createdAt:stamp,updatedAt:stamp});
            transaction.create(accountRef,withStamp({...records.account,
                snapshotSha256:bundle.sha256}));
            for(const character of records.characters){
                transaction.create(root.collection("characters").doc(character.characterId),
                    withStamp(character));
            }
            transaction.create(root.collection("economy").doc("current"),withStamp(records.economy));
            for(const item of records.inventory){
                transaction.create(root.collection("inventory").doc(item.ownedItemId),withStamp(item));
            }
            for(const equipment of records.equipment){
                transaction.create(root.collection("equipment").doc(
                    `${equipment.characterId}_${equipment.slot}`),withStamp(equipment));
            }
            for(const relic of records.relics){
                transaction.create(root.collection("relics").doc(relic.relicId),withStamp(relic));
            }
            transaction.create(root.collection("relicLoadout").doc("current"),
                withStamp(records.relicLoadout));
            transaction.create(root.collection("progress").doc("current"),
                withStamp(records.progress));
            transaction.create(root.collection("claimCheckpoints").doc("current"),
                withStamp(records.claimCheckpoint));
            transaction.create(root.collection("playableSnapshots").doc(String(revision)),{
                ...bundle,createdAt:stamp
            });
            transaction.create(root.collection("recoveryArchives").doc(String(revision)),{
                ...createRecoveryArchive(uid,revision,records,bundle),createdAt:stamp
            });
            transaction.create(operationRef,{
                schemaVersion:1,ownerUid:uid,kind:"initial-character-sources",
                operationId,sourceRevision:revision,snapshotSha256:bundle.sha256,
                selectionSha256,
                ...(session.sessionId?{creationSessionId:session.sessionId}:{}),
                authoritativeStateReady:false,createdAt:stamp
            });
            // The version-2 public envelope has no playable pointer. Keep the
            // existing Phase-2 invariant until durable recovery is proven.
            transaction.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {sourceRevision:revision,snapshotSha256:bundle.sha256,
                unchanged:false,authoritativeStateReady:false};
        });
    }
    // Private observation only. No callable, gameplay reset, reward, ledger,
    // canonical revision advance or publication is authorized by this evidence.
    async function observeDailyPeriod(request,input){
        if(!input||Object.keys(input).sort().join("|")!=="expectedRevision|operationId"||
           typeof input.operationId!=="string"||!OPERATION_ID.test(input.operationId)||
           input.operationId.startsWith("daily-period-")||
           !Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1){
            fail("invalid-argument","A daily observation accepts only an ID and revision.");
        }
        const {operationId,expectedRevision}=input;
        const observedAt=now();
        if(!Number.isSafeInteger(observedAt)||observedAt<0){
            fail("failed-precondition","Server observation is unavailable.");
        }
        const day=taipeiDay(observedAt);
        const targetDate=day.slice(0,4)+"-"+day.slice(4,6)+"-"+day.slice(6,8);
        const periodId="daily-period-"+day;
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const op=id=>root.collection("operations").doc(id);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const [envelopeSnap,accountSnap,receiptSnap,grantSnap,ledgerSnap]=
                await Promise.all([envelopeRef,root.collection("account").doc("current"),
                    op(operationId),root.collection("grantOperations").doc(operationId),
                    root.collection("ledgerEntries").doc(operationId)].map(ref=>tx.get(ref)));
            if(!envelopeSnap.exists||!accountSnap.exists){
                fail("failed-precondition","Complete canonical sources required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid);
            const account=accountSnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               !Array.isArray(account.slots)||account.slots.length!==3||
               typeof account.slots[0]!=="string"||
               account.slots[1]!==null||account.slots[2]!==null||
               !Number.isSafeInteger(account.serverRevision)||account.serverRevision<2||
               account.serverRevision>envelope.serverRevision||
               !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
                fail("failed-precondition","First-character source is not eligible.");
            }
            if(grantSnap.exists||ledgerSnap.exists){
                fail("data-loss","Daily observation ID overlaps another operation.");
            }
            const periods=(records,date=targetDate)=>{
                // The complete projection rejects absent, historical-only or
                // malformed active sidecars. Preserve raw bytes, including usage.
                assembleCanonicalPlayableProjection(uid,records.account.serverRevision,records);
                return Object.fromEntries(["daily-dungeon-state","equipment-shop-daily"].map(key=>{
                    const raw=records.progress.sidecars[key].raw,state=JSON.parse(raw);
                    if(state.date>date){throw new Error("Future source date.");}
                    return [key,{date:state.date,
                        rawSha256:createHash("sha256").update(raw,"utf8").digest("hex")}];
                }));
            };
            const proof=async(evidence,receipt)=>{
                try{
                    const {createdAt,sha256,...record}=evidence;
                    const {createdAt:receiptStamp,...intent}=receipt;
                    if(Object.keys(record).sort().join("|")!==
                       "authoritativeStateReady|characterId|kind|observedAt|operationId|ownerUid|periodId|periods|rewardEligible|schemaVersion|snapshotSha256|sourceRevision|targetDate"||
                       Object.keys(intent).sort().join("|")!==
                       "authoritativeStateReady|expectedRevision|kind|operationId|ownerUid|periodId|rewardEligible|schemaVersion|sourceSha256"||
                       record.schemaVersion!==1||record.kind!=="daily-period-source"||
                       record.ownerUid!==uid||record.periodId!=="daily-period-"+record.targetDate?.replaceAll("-","")||
                       !/^\d{4}-\d{2}-\d{2}$/.test(record.targetDate||"")||
                       !OPERATION_ID.test(record.operationId||"")||
                       record.operationId.startsWith("daily-period-")||
                       !Number.isSafeInteger(record.observedAt)||record.observedAt<0||
                       taipeiDay(record.observedAt)!==record.targetDate.replaceAll("-","")||
                       record.sourceRevision!==receipt.expectedRevision||
                       !Number.isSafeInteger(record.sourceRevision)||record.sourceRevision<2||
                       record.sourceRevision>account.serverRevision||
                       record.characterId!==account.slots[0]||
                       record.authoritativeStateReady!==false||record.rewardEligible!==false||
                       sha256!==snapshotDigest(record)||
                       receipt.schemaVersion!==1||receipt.ownerUid!==uid||
                       receipt.kind!=="daily-period-observation"||
                       receipt.operationId!==record.operationId||receipt.periodId!==record.periodId||
                       receipt.sourceSha256!==sha256||receipt.authoritativeStateReady!==false||
                       receipt.rewardEligible!==false){
                        throw new Error("Observation metadata differs.");
                    }
                    const [snapshot,archive]=await Promise.all([
                        tx.get(root.collection("playableSnapshots").doc(String(record.sourceRevision))),
                        tx.get(root.collection("recoveryArchives").doc(String(record.sourceRevision)))]);
                    if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==record.snapshotSha256){
                        throw new Error("Original observation proof is missing.");
                    }
                    const records=inspectRecoveryArchive(archive.data(),uid,record.sourceRevision,snapshot.data());
                    if(records.account.provenance!=="server-created"||
                       records.account.slots[0]!==record.characterId||
                       snapshotDigest(periods(records,record.targetDate))!==snapshotDigest(record.periods)||
                       !Object.values(record.periods).some(value=>value.date<record.targetDate)||
                       Object.values(record.periods).some(value=>value.date>record.targetDate)){
                        throw new Error("Original periods differ.");
                    }
                    return {periodId:record.periodId,targetDate:record.targetDate,
                        sourceRevision:record.sourceRevision,sourceSha256:sha256,
                        authoritativeStateReady:false,rewardEligible:false};
                }catch(error){
                    if(error instanceof HttpsError){throw error;}
                    fail("data-loss","Daily observation proof is inconsistent.");
                }
            };
            if(receiptSnap.exists){
                const receipt=receiptSnap.data();
                if(receipt.operationId!==operationId||receipt.expectedRevision!==expectedRevision||
                   !/^daily-period-\d{8}$/.test(receipt.periodId||"")){
                    fail("data-loss","Daily observation intent is inconsistent.");
                }
                const [original,grant,ledger]=await Promise.all([op(receipt.periodId),
                    root.collection("grantOperations").doc(receipt.periodId),
                    root.collection("ledgerEntries").doc(receipt.periodId)].map(ref=>tx.get(ref)));
                if(!original.exists||grant.exists||ledger.exists){
                    fail("data-loss","Daily observation source is missing or overlaps.");
                }
                return {...await proof(original.data(),receipt),unchanged:true};
            }
            // A lost receipt cannot let the same intent produce a new day's
            // source. The existing single-field index also finds an orphaned
            // observation after midnight; no new collection/index is needed.
            const existing=await tx.get(root.collection("operations")
                .where("operationId","==",operationId).limit(2));
            if(existing.docs.length){
                fail("data-loss","An original observation is missing its receipt.");
            }
            if(envelope.serverRevision!==expectedRevision||account.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            const [marker,markerGrant,markerLedger]=await Promise.all([op(periodId),
                root.collection("grantOperations").doc(periodId),
                root.collection("ledgerEntries").doc(periodId)].map(ref=>tx.get(ref)));
            if(markerGrant.exists||markerLedger.exists){
                fail("data-loss","Daily period ID overlaps another operation.");
            }
            if(marker.exists){
                const priorId=marker.get("operationId");
                if(!OPERATION_ID.test(priorId||"")||priorId.startsWith("daily-period-")){
                    fail("data-loss","Daily period receipt is inconsistent.");
                }
                const [prior,priorGrant,priorLedger]=await Promise.all([op(priorId),
                    root.collection("grantOperations").doc(priorId),
                    root.collection("ledgerEntries").doc(priorId)].map(ref=>tx.get(ref)));
                if(!prior.exists||priorGrant.exists||priorLedger.exists){
                    fail("data-loss","Daily period receipt is missing or overlaps.");
                }
                const verified=await proof(marker.data(),prior.data());
                if(verified.periodId!==periodId){fail("data-loss","Daily period ID differs.");}
                fail("already-exists","This daily period was already observed.");
            }
            const names=["economy","relicLoadout","progress","claimCheckpoints"];
            const [character,snapshot,archive,...singles]=await Promise.all([
                root.collection("characters").doc(account.slots[0]),
                root.collection("playableSnapshots").doc(String(expectedRevision)),
                root.collection("recoveryArchives").doc(String(expectedRevision)),
                ...names.map(name=>root.collection(name).doc("current"))].map(ref=>tx.get(ref)));
            if([character,snapshot,archive,...singles].some(snap=>!snap.exists)){
                fail("data-loss","Canonical period proof is incomplete.");
            }
            const owned=await readOwnedSources(tx,root,fail);
            const records={account:source(account),characters:[source(character.data())],
                economy:source(singles[0].data()),...owned.records,
                relicLoadout:source(singles[1].data()),progress:source(singles[2].data()),
                claimCheckpoint:source(singles[3].data())};
            let recorded;
            try{
                if(snapshot.get("sha256")!==account.snapshotSha256){throw new Error("Pointer differs.");}
                verifyCanonicalSnapshotAgainstSources(snapshot.data(),uid,expectedRevision,records);
                inspectRecoveryArchive(archive.data(),uid,expectedRevision,snapshot.data());
                recorded=periods(records);
            }catch(_){fail("data-loss","Canonical period sources are inconsistent.");}
            if(!Object.values(recorded).some(value=>value.date<targetDate)){
                fail("failed-precondition","A later daily period has not started.");
            }
            const record={schemaVersion:1,ownerUid:uid,kind:"daily-period-source",
                periodId,operationId,observedAt,targetDate,sourceRevision:expectedRevision,
                snapshotSha256:account.snapshotSha256,characterId:account.slots[0],periods:recorded,
                authoritativeStateReady:false,rewardEligible:false};
            const sha256=snapshotDigest(record);
            const receipt={schemaVersion:1,ownerUid:uid,kind:"daily-period-observation",
                operationId,expectedRevision,periodId,sourceSha256:sha256,
                authoritativeStateReady:false,rewardEligible:false};
            const stamp=FieldValue.serverTimestamp();
            tx.create(op(periodId),{...record,sha256,createdAt:stamp});
            tx.create(op(operationId),{...receipt,createdAt:stamp});
            return {periodId,targetDate,sourceRevision:expectedRevision,sourceSha256:sha256,
                unchanged:false,authoritativeStateReady:false,rewardEligible:false};
        });
    }
    return Object.freeze({commitInitialSources,observeDailyPeriod});
}

module.exports={createCanonicalSourceWriter};
