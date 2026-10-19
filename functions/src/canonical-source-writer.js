"use strict";

const {assembleCanonicalSnapshot,inspectCanonicalSnapshot,
    assembleCanonicalPlayableProjection,verifyCanonicalSnapshotAgainstSources,
    snapshotDigest,claimRecordsDigest}=require("./canonical-snapshot");
const {makeInitialCharacterSources,makeInitialSidecars}=require("./initial-character-sources");
const {createRecoveryArchive,inspectRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readCharacterSources,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=require("./canonical-owned-sources");
const FormationPolicy=require("./team-formation-policy");
const {taipeiDay}=require("./daily-checkin-policy");
const {createHash}=require("node:crypto");

const OPERATION_ID=/^[A-Za-z0-9_-]{16,64}$/;

// Internal transaction owner; its guarded callable accepts choices only.
// Source records and progression are never accepted from the browser.
function createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now}){
    const fail=(code,message)=>{ throw new HttpsError(code,message); };
    const equal=(a,b)=>snapshotDigest(a)===snapshotDigest(b);
    const additionalKind="additional-character-sources";
    const singleCollections={account:"account",economy:"economy",progress:"progress",
        relicLoadout:"relicLoadout",claimCheckpoint:"claimCheckpoints"};
    function additionalIntent(input){
        if(!input||Object.keys(input).sort().join("|")!=="expectedRevision|operationId|selection|slotIndex"||
           !OPERATION_ID.test(input.operationId||"")||![1,2].includes(input.slotIndex)||
           !Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<2){
            fail("invalid-argument","Only additional-character choices and an expected revision are accepted.");
        }
        try{makeInitialCharacterSources("validation",input.expectedRevision+1,input.operationId,input.selection,{allowUnspent:true});}
        catch(_){fail("invalid-argument","Invalid additional character choices.");}
        return JSON.parse(JSON.stringify(input));
    }
    function additionalFormation(formation,slotIndex){
        if(formation===null)return null;
        const next=JSON.parse(JSON.stringify(formation));
        const occupied=new Set([...Object.values(next.characterIndexToSlot),...Object.values(next.heroIdToSlot||{})]);
        // Client normalization prefers F3 for the second and third player;
        // canonical Policy owns the complete front/back fallback order.
        const position=!occupied.has("ALLY_F3")?"ALLY_F3":FormationPolicy.slots.find(slot=>!occupied.has(slot));
        if(!position)fail("failed-precondition","No additional-character formation position is available.");
        next.characterIndexToSlot[slotIndex]=position;
        return next;
    }
    function additionalRecords(uid,before,intent,revision){
        const slotIndex=intent.slotIndex;
        if(before.account.provenance!=="server-created"||before.account.slots[slotIndex]!==null||
           before.characters.length!==slotIndex||
           (slotIndex===1&&(before.account.slots[2]!==null||before.characters[0].state.level<10))||
           (slotIndex===2&&(before.account.slots[1]===null||before.characters.some(row=>row.state.level<50)))){
            fail("failed-precondition",slotIndex===1?"An empty second slot and primary level10 are required.":
                "An empty third slot and primary/secondary level50 are required.");
        }
        const normalized=name=>name.trim().normalize("NFKC").toLocaleLowerCase();
        if(before.characters.some(row=>normalized(row.displayName)===normalized(intent.selection.displayName))){
            fail("already-exists","Character display names must be distinct.");
        }
        const generated=makeInitialCharacterSources(uid,revision,intent.operationId,intent.selection,{allowUnspent:true});
        const character={...generated.characters[0],slotIndex};
        const slots=[...before.account.slots];slots[slotIndex]=character.characterId;
        const owned=advanceOwnedRecords(before,revision);
        return {...before,...owned,
            account:{...before.account,serverRevision:revision,
                slots,formation:additionalFormation(before.account.formation,slotIndex)},
            characters:[...before.characters.map(row=>({...row,serverRevision:revision})),character],
            economy:{...before.economy,serverRevision:revision},progress:{...before.progress,serverRevision:revision},
            relicLoadout:{...before.relicLoadout,serverRevision:revision},
            claimCheckpoint:{...before.claimCheckpoint,serverRevision:revision,claimDigest:claimRecordsDigest(owned.claimRecords)}};
    }
    async function additionalProof(tx,root,uid,account,receipt){
        try{
            const intent=additionalIntent(receipt.intent),revision=receipt.resultRevision;
            if(receipt.schemaVersion!==1||receipt.kind!==additionalKind||receipt.ownerUid!==uid||
               receipt.operationId!==intent.operationId||receipt.authoritativeStateReady!==false||
               !Number.isSafeInteger(receipt.sourceRevision)||receipt.sourceRevision<2||
               receipt.sourceRevision>intent.expectedRevision||revision!==intent.expectedRevision+1||
               revision>account.serverRevision||account.slots[intent.slotIndex]!==`character-${intent.operationId}`||
               receipt.characterId!==account.slots[intent.slotIndex]||receipt.slotIndex!==intent.slotIndex){throw Error("Receipt identity");}
            const [beforeSnapshot,beforeArchive,afterSnapshot,afterArchive,grant,ledger]=await Promise.all([
                tx.get(root.collection("playableSnapshots").doc(String(receipt.sourceRevision))),
                tx.get(root.collection("recoveryArchives").doc(String(receipt.sourceRevision))),
                tx.get(root.collection("playableSnapshots").doc(String(revision))),
                tx.get(root.collection("recoveryArchives").doc(String(revision))),
                tx.get(root.collection("grantOperations").doc(intent.operationId)),
                tx.get(root.collection("ledgerEntries").doc(intent.operationId))]);
            if(grant.exists||ledger.exists||!beforeSnapshot.exists||!beforeArchive.exists||!afterSnapshot.exists||!afterArchive.exists||
               beforeSnapshot.get("sha256")!==receipt.sourceSnapshotSha256||afterSnapshot.get("sha256")!==receipt.snapshotSha256){
                throw Error("Missing original evidence");
            }
            const before=inspectRecoveryArchive(beforeArchive.data(),uid,receipt.sourceRevision,beforeSnapshot.data());
            const after=inspectRecoveryArchive(afterArchive.data(),uid,revision,afterSnapshot.data());
            if(!equal(additionalRecords(uid,before,intent,revision),after))throw Error("Original transition differs");
            return {sourceRevision:receipt.sourceRevision,resultRevision:revision,characterId:receipt.characterId,
                slotIndex:intent.slotIndex,snapshotSha256:receipt.snapshotSha256,authoritativeStateReady:false};
        }catch(error){
            fail("data-loss","Original additional-character evidence is inconsistent.");
        }
    }
    async function commitAdditionalCharacter(request,input){
        const intent=additionalIntent(input);
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const [envelopeSnapshot,operation,...singles]=await Promise.all([
                tx.get(envelopeRef),tx.get(root.collection("operations").doc(intent.operationId)),
                ...Object.values(singleCollections).map(name=>tx.get(root.collection(name).doc("current")))]);
            if(!envelopeSnapshot.exists||singles.some(row=>!row.exists))fail("failed-precondition","Complete canonical character sources are required.");
            const envelope=inspectExistingEnvelope(envelopeSnapshot.data(),uid),account=singles[0].data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||account.ownerUid!==uid||
               account.provenance!=="server-created"||!Number.isSafeInteger(account.serverRevision)||
               account.serverRevision<2||account.serverRevision>envelope.serverRevision){
                fail("failed-precondition","An unpublished canonical account is required.");
            }
            if(operation.exists){
                const receipt=operation.data();
                if(!receipt.intent||!equal(receipt.intent,intent)||receipt.operationId!==intent.operationId){
                    fail("data-loss","Additional-character operation overlaps a different intent.");
                }
                return {...await additionalProof(tx,root,uid,account,receipt),unchanged:true};
            }
            if(envelope.serverRevision!==intent.expectedRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
            const [characters,owned,snapshot,archive,...collisions]=await Promise.all([
                readCharacterSources(tx,root,account,fail),readOwnedSources(tx,root,fail),
                tx.get(root.collection("playableSnapshots").doc(String(account.serverRevision))),
                tx.get(root.collection("recoveryArchives").doc(String(account.serverRevision))),
                ...["grantOperations","ledgerEntries","modeTimeEvents","simulatedAdSources","patrolTickets",
                    "patrolTicketStates","patrolSettlements","patrolClosures","recoveryAudits","recoveryApprovals"]
                    .map(name=>tx.get(root.collection(name).doc(intent.operationId))),
                tx.get(root.collection("characters").doc(`character-${intent.operationId}`))]);
            if(collisions.some(row=>row.exists))fail("failed-precondition","Additional-character operation ID is already used.");
            const records={...owned.records,characters:characters.records,...Object.fromEntries(
                Object.keys(singleCollections).map((key,index)=>[key,source(singles[index].data())]))};
            try{
                if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==account.snapshotSha256)throw Error("Missing current archive");
                inspectRecoveryArchive(archive.data(),uid,account.serverRevision,snapshot.data());
                verifyCanonicalSnapshotAgainstSources(snapshot.data(),uid,account.serverRevision,records);
            }catch(_){fail("data-loss","Current character sources differ from their snapshot/archive.");}
            const revision=nextRevision(envelope),next=additionalRecords(uid,records,intent,revision);
            let bundle,backup;
            try{bundle=assembleCanonicalSnapshot(uid,revision,next);backup=createRecoveryArchive(uid,revision,next,bundle);}
            catch(_){fail("data-loss","Additional character cannot form a complete canonical revision.");}
            const receipt={schemaVersion:1,kind:additionalKind,ownerUid:uid,operationId:intent.operationId,intent,
                sourceRevision:account.serverRevision,resultRevision:revision,sourceSnapshotSha256:snapshot.get("sha256"),
                snapshotSha256:bundle.sha256,characterId:`character-${intent.operationId}`,slotIndex:intent.slotIndex,authoritativeStateReady:false};
            const stamp=FieldValue.serverTimestamp();
            for(const [index,key] of Object.keys(singleCollections).entries())tx.update(singles[index].ref,
                {...next[key],...(key==="account"?{snapshotSha256:bundle.sha256}:{}),updatedAt:stamp});
            characters.refs.forEach((ref,index)=>tx.update(ref,{...next.characters[index],updatedAt:stamp}));
            tx.create(root.collection("characters").doc(receipt.characterId),{...next.characters[intent.slotIndex],createdAt:stamp,updatedAt:stamp});
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(root.collection("playableSnapshots").doc(String(revision)),{...bundle,createdAt:stamp});
            tx.create(root.collection("recoveryArchives").doc(String(revision)),{...backup,createdAt:stamp});
            tx.create(root.collection("operations").doc(intent.operationId),{...receipt,createdAt:stamp});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {sourceRevision:receipt.sourceRevision,resultRevision:revision,characterId:receipt.characterId,
                slotIndex:intent.slotIndex,snapshotSha256:bundle.sha256,unchanged:false,authoritativeStateReady:false};
        });
    }

    function dailyPeriods(records,uid,date){
        // The complete projection rejects absent, historical-only or
        // malformed active sidecars. Preserve raw bytes, including usage.
        assembleCanonicalPlayableProjection(uid,records.account.serverRevision,records);
        return Object.fromEntries(["daily-dungeon-state","equipment-shop-daily"].map(key=>{
            const raw=records.progress.sidecars[key].raw,state=JSON.parse(raw);
            if(state.date>date){throw new Error("Future source date.");}
            return [key,{date:state.date,
                rawSha256:createHash("sha256").update(raw,"utf8").digest("hex")}];
        }));
    }
    async function readDailyPeriodProof(tx,root,uid,account,evidence,receipt){
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
               snapshotDigest(dailyPeriods(records,uid,record.targetDate))!==snapshotDigest(record.periods)||
               !Object.values(record.periods).some(value=>value.date<record.targetDate)||
               Object.values(record.periods).some(value=>value.date>record.targetDate)){
                throw new Error("Original periods differ.");
            }
            return {records,result:{periodId:record.periodId,targetDate:record.targetDate,
                sourceRevision:record.sourceRevision,sourceSha256:sha256,
                authoritativeStateReady:false,rewardEligible:false}};
        }catch(error){
            if(error instanceof HttpsError){throw error;}
            fail("data-loss","Daily observation proof is inconsistent.");
        }
    }

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
                return {...(await readDailyPeriodProof(tx,root,uid,account,original.data(),receipt)).result,unchanged:true};
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
                const verified=(await readDailyPeriodProof(tx,root,uid,account,marker.data(),prior.data())).result;
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
                recorded=dailyPeriods(records,uid,targetDate);
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
    async function loadDailySource(tx,root,uid,account,periodId){
        const sourceSnap=await tx.get(root.collection("operations").doc(periodId));
        const id=sourceSnap.get("operationId");
        if(!sourceSnap.exists||typeof id!=="string"||!OPERATION_ID.test(id)||
           id.startsWith("daily-period-")){
            fail("data-loss","Daily period source is missing or invalid.");
        }
        const [receipt,...overlap]=await Promise.all([
            root.collection("operations").doc(id),
            ...[periodId,id].flatMap(key=>["grantOperations","ledgerEntries"]
                .map(name=>root.collection(name).doc(key)))].map(ref=>tx.get(ref)));
        if(!receipt.exists||overlap.some(snap=>snap.exists)){
            fail("data-loss","Daily period receipt is missing or overlaps.");
        }
        const proof=await readDailyPeriodProof(tx,root,uid,account,sourceSnap.data(),receipt.data());
        if(proof.result.periodId!==periodId){fail("data-loss","Daily source ID differs.");}
        return {...proof,operationId:id};
    }

    // Compare the complete canonical state with its explicit creation evidence.
    // In particular, a disabled Client dungeon limit can leave used:false after
    // play. Neither that boolean nor an absent receipt alone proves no usage.
    function zeroPeriodRecords(records,revision,targetDate){
        const dungeon=JSON.parse(records.progress.sidecars["daily-dungeon-state"].raw);
        const shop=JSON.parse(records.progress.sidecars["equipment-shop-daily"].raw);
        const reserved=records.progress.sidecars["equipment-shop-purchases"];
        if(dungeon.date!==shop.date||dungeon.date>=targetDate||
           Object.values(dungeon.used).some(value=>value!==false)||
           shop.refreshCount!==0||shop.soldOfferIds.length!==0||
           reserved.status!=="not-applicable"||reserved.raw!==null||
           records.claimRecords.length!==0){
            fail("failed-precondition","Unreconciled daily consumption blocks rollover.");
        }
        const owned=advanceOwnedRecords(records,revision);
        return {...records,...owned,
            account:{...records.account,serverRevision:revision},
            characters:records.characters.map(row=>({...row,serverRevision:revision})),
            economy:{...records.economy,serverRevision:revision},
            relicLoadout:{...records.relicLoadout,serverRevision:revision},
            progress:{...records.progress,serverRevision:revision,sidecars:{
                ...records.progress.sidecars,
                "daily-dungeon-state":{status:"present",raw:JSON.stringify({
                    date:targetDate,used:{exp:false,material:false,equipment:false}})},
                "equipment-shop-daily":{status:"present",raw:JSON.stringify({
                    date:targetDate,refreshCount:0,soldOfferIds:[]})}}},
            claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,
                claimDigest:claimRecordsDigest(owned.claimRecords)}};
    }
    function zeroBaseline(records){
        const normalized={...records,...advanceOwnedRecords(records,0),
            account:{...records.account,serverRevision:0},
            characters:records.characters.map(row=>({...row,serverRevision:0})),
            economy:{...records.economy,serverRevision:0},
            relicLoadout:{...records.relicLoadout,serverRevision:0},
            progress:{...records.progress,serverRevision:0,sidecars:{
                ...records.progress.sidecars,"daily-dungeon-state":null,"equipment-shop-daily":null}},
            claimCheckpoint:{...records.claimCheckpoint,serverRevision:0}};
        return snapshotDigest(normalized);
    }
    function inspectAppliedPair(uid,account,evidence,receipt){
        try{
            const {createdAt,sha256,...record}=evidence;
            const {createdAt:receiptStamp,...intent}=receipt;
            if(Object.keys(record).sort().join("|")!==
               "appliedAt|appliedRevision|audit|authoritativeStateReady|consumption|inputRevision|kind|markerId|operationId|ownerUid|periodId|rewardEligible|schemaVersion|snapshotSha256|sourceSha256|targetDate"||
               Object.keys(intent).sort().join("|")!==
               "appliedRevision|authoritativeStateReady|expectedRevision|kind|markerId|markerSha256|operationId|ownerUid|periodId|rewardEligible|schemaVersion|snapshotSha256"||
               record.schemaVersion!==1||record.ownerUid!==uid||
               record.kind!=="daily-period-application"||
               typeof record.operationId!=="string"||!OPERATION_ID.test(record.operationId)||
               record.operationId.startsWith("daily-period-")||
               !/^daily-period-\d{8}$/.test(record.periodId||"")||
               record.markerId!==record.periodId.replace("daily-period-","daily-period-applied-")||
               !Number.isSafeInteger(record.appliedAt)||record.appliedAt<1||
               record.targetDate?.replaceAll("-","")!==taipeiDay(record.appliedAt)||
               record.periodId!=="daily-period-"+taipeiDay(record.appliedAt)||
               !Number.isSafeInteger(record.inputRevision)||record.inputRevision<2||
               record.appliedRevision!==record.inputRevision+1||
               record.appliedRevision>account.serverRevision||
               !/^[a-f0-9]{64}$/.test(record.snapshotSha256||"")||
               !/^[a-f0-9]{64}$/.test(record.sourceSha256||"")||
               record.authoritativeStateReady!==false||record.rewardEligible!==false||
               !record.audit||Object.keys(record.audit).sort().join("|")!=="operationCount|status"||
               record.audit.status!=="verified-empty"||
               !Number.isSafeInteger(record.audit.operationCount)||record.audit.operationCount<3||
               record.audit.operationCount>400||sha256!==snapshotDigest(record)||
               intent.schemaVersion!==1||intent.ownerUid!==uid||
               intent.kind!=="daily-period-apply"||intent.operationId!==record.operationId||
               intent.markerId!==record.markerId||intent.markerSha256!==sha256||
               intent.periodId!==record.periodId||intent.expectedRevision!==record.inputRevision||
               intent.appliedRevision!==record.appliedRevision||
               intent.snapshotSha256!==record.snapshotSha256||
               intent.authoritativeStateReady!==false||intent.rewardEligible!==false){
                throw Error("Application pair differs.");
            }
            return record;
        }catch(_){fail("data-loss","Daily application pair is inconsistent.");}
    }
    async function loadAppliedPair(tx,root,uid,account,markerId){
        const marker=await tx.get(root.collection("operations").doc(markerId));
        const id=marker.get("operationId");
        if(!marker.exists||typeof id!=="string"||!OPERATION_ID.test(id)||
           id.startsWith("daily-period-")){
            fail("data-loss","Daily application marker is missing.");
        }
        const [receipt,...overlap]=await Promise.all([
            root.collection("operations").doc(id),
            ...[markerId,id].flatMap(key=>["grantOperations","ledgerEntries"]
                .map(name=>root.collection(name).doc(key)))].map(ref=>tx.get(ref)));
        if(!receipt.exists||overlap.some(snap=>snap.exists)){
            fail("data-loss","Daily application receipt is missing or overlaps.");
        }
        const record=inspectAppliedPair(uid,account,marker.data(),receipt.data());
        if(record.markerId!==markerId){fail("data-loss","Daily application marker ID differs.");}
        return record;
    }
    function inspectInitialOrigin(uid,revision,initialId,receipt,snapshot,archive){
        if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==receipt.snapshotSha256){
            throw Error("Initial proof differs.");
        }
        const origin=inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data());
        const character=origin.characters[0],state=character?.state;
        if(origin.account.provenance!=="server-created"||
           origin.account.slots[0]!==`character-${initialId}`||
           origin.account.slots[1]!==null||origin.account.slots[2]!==null||
           origin.characters.length!==1){throw Error("Initial character differs.");}
        const selection={displayName:character.displayName,element:character.element,
            gender:state.gender,attributes:Object.fromEntries([
                "attack","vitality","energy","intelligence","defensePoints","agility"]
                .map(key=>[key,state[key]]))};
        const generated=makeInitialCharacterSources(uid,revision,initialId,selection,
            {recordedAt:origin.progress.playableState.lastSaveTimestamp});
        if(snapshotDigest(origin)!==snapshotDigest(generated)||
           receipt.selectionSha256!==createHash("sha256")
               .update(JSON.stringify(generated.characters[0].state)).digest("hex")){
            throw Error("Not the explicit initial state.");
        }
        return origin;
    }
    async function verifyZeroBasis(tx,root,uid,account,proof){
        const {records,result}=proof;
        const initialId=account.slots[0].slice("character-".length);
        if(!account.slots[0].startsWith("character-")||!OPERATION_ID.test(initialId)){
            fail("failed-precondition","An explicit initial source is required.");
        }
        const initial=await tx.get(root.collection("operations").doc(initialId));
        const revision=initial.get("sourceRevision"),hash=initial.get("snapshotSha256");
        if(!initial.exists||initial.get("schemaVersion")!==1||
           initial.get("kind")!=="initial-character-sources"||
           initial.get("ownerUid")!==uid||initial.get("operationId")!==initialId||
           initial.get("authoritativeStateReady")!==false||
           !Number.isSafeInteger(revision)||revision<2||revision>result.sourceRevision||
           !/^[a-f0-9]{64}$/.test(hash||"")){
            fail("data-loss","Original zero-consumption source is missing.");
        }
        const [snapshot,archive,...overlap]=await Promise.all([
            root.collection("playableSnapshots").doc(String(revision)),
            root.collection("recoveryArchives").doc(String(revision)),
            root.collection("grantOperations").doc(initialId),
            root.collection("ledgerEntries").doc(initialId)].map(ref=>tx.get(ref)));
        let origin;
        try{
            if(overlap.some(snap=>snap.exists)){throw Error("Initial proof differs.");}
            origin=inspectInitialOrigin(uid,revision,initialId,initial.data(),snapshot,archive);
            assembleCanonicalPlayableProjection(uid,revision,origin);
            if(zeroBaseline(records)!==zeroBaseline(origin)){
                throw Error("Not the explicit untouched initial state.");
            }
        }catch(_){fail("failed-precondition","Canonical consumption cannot be reconciled to its initial source.");}
        const consumption={status:"verified-empty",initialOperationId:initialId,
            initialRevision:revision,initialSnapshotSha256:hash,
            baselineSha256:zeroBaseline(origin),claimDigest:records.claimCheckpoint.claimDigest,
            periods:dailyPeriods(records,uid,result.targetDate)};
        zeroPeriodRecords(records,result.sourceRevision+1,result.targetDate);
        if(result.sourceRevision===revision){
            if(snapshotDigest(records)!==snapshotDigest(origin)){
                fail("data-loss","Initial period bytes differ from original evidence.");
            }
        }else{
            // Only the existing protected application may advance this zero
            // baseline. Intervening canonical mutations remain unsupported.
            const date=JSON.parse(records.progress.sidecars["daily-dungeon-state"].raw).date;
            const parent=await loadAppliedPair(tx,root,uid,account,
                "daily-period-applied-"+date.replaceAll("-",""));
            if(parent.appliedRevision!==result.sourceRevision||
               parent.snapshotSha256!==assembleCanonicalSnapshot(uid,result.sourceRevision,records).sha256||
               parent.consumption?.initialOperationId!==initialId||
               parent.consumption?.initialRevision!==revision||
               parent.consumption?.initialSnapshotSha256!==hash||
               parent.consumption?.baselineSha256!==consumption.baselineSha256){
                fail("failed-precondition","A current protected zero-period lineage is required.");
            }
            const prior=await loadDailySource(tx,root,uid,account,parent.periodId);
            const priorConsumption={...consumption,
                claimDigest:prior.records.claimCheckpoint.claimDigest,
                periods:dailyPeriods(prior.records,uid,parent.targetDate)};
            const rebuilt=assembleCanonicalSnapshot(uid,parent.appliedRevision,
                zeroPeriodRecords(prior.records,parent.appliedRevision,parent.targetDate));
            if(prior.result.sourceRevision!==parent.inputRevision||
               prior.result.sourceSha256!==parent.sourceSha256||
               prior.result.targetDate!==parent.targetDate||
               snapshotDigest(priorConsumption)!==snapshotDigest(parent.consumption)||
               zeroBaseline(prior.records)!==consumption.baselineSha256||
               rebuilt.sha256!==parent.snapshotSha256){
                fail("data-loss","Previous daily application proof differs.");
            }
        }
        return consumption;
    }
    async function verifyAppliedResult(tx,root,uid,account,record){
        const proof=await loadDailySource(tx,root,uid,account,record.periodId);
        if(proof.result.sourceRevision!==record.inputRevision||
           proof.result.sourceSha256!==record.sourceSha256||
           proof.result.targetDate!==record.targetDate){
            fail("data-loss","Applied daily source differs.");
        }
        const consumption=await verifyZeroBasis(tx,root,uid,account,proof);
        if(snapshotDigest(consumption)!==snapshotDigest(record.consumption)){
            fail("data-loss","Daily consumption audit differs.");
        }
        const [snapshot,archive]=await Promise.all([
            root.collection("playableSnapshots").doc(String(record.appliedRevision)),
            root.collection("recoveryArchives").doc(String(record.appliedRevision))].map(ref=>tx.get(ref)));
        try{
            if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==record.snapshotSha256){
                throw Error("Applied snapshot missing.");
            }
            const after=inspectRecoveryArchive(archive.data(),uid,record.appliedRevision,snapshot.data());
            assembleCanonicalPlayableProjection(uid,record.appliedRevision,after);
            const expected=zeroPeriodRecords(proof.records,record.appliedRevision,record.targetDate);
            if(snapshotDigest(after)!==snapshotDigest(expected)){throw Error("Applied sources differ.");}
        }catch(_){fail("data-loss","Applied daily snapshot or archive is inconsistent.");}
        return {periodId:record.periodId,targetDate:record.targetDate,
            appliedRevision:record.appliedRevision,snapshotSha256:record.snapshotSha256,
            authoritativeStateReady:false,rewardEligible:false};
    }

    async function verifyEmptyInventory(tx,root,uid,account,consumption){
        // The unpublished zero-only lane rejects economic history and pending
        // entitlements, including records outside the requested operation IDs.
        for(const name of ["pendingGrants","grantOperations","uniqueClaims","ledgerEntries","rewardEvents"]){
            const rows=await tx.get(root.collection(name).limit(1));
            if(rows.docs.length){fail("failed-precondition","Economic history or pending grants block zero-consumption application.");}
        }
        const inventory=await tx.get(root.collection("operations").limit(401));
        if(inventory.docs.length>400){fail("failed-precondition","Daily evidence inventory exceeds the controlled limit.");}
        const applications=new Set();
        for(const row of inventory.docs){
            const value=row.data();
            if(value.schemaVersion!==1||value.ownerUid!==uid){fail("data-loss","Operation inventory is inconsistent.");}
            switch(value.kind){
            case "initial-character-sources":
                if(row.id!==consumption.initialOperationId||value.operationId!==row.id){
                    fail("data-loss","Unexpected initial operation.");
                }
                break;
            case "daily-period-source":
            case "daily-period-observation": {
                const id=value.periodId;
                await loadDailySource(tx,root,uid,account,id);
                const source=await tx.get(root.collection("operations").doc(id));
                if((value.kind==="daily-period-source"&&row.id!==id)||
                   (value.kind==="daily-period-observation"&&row.id!==source.get("operationId"))){
                    fail("data-loss","Daily observation inventory differs.");
                }
                break;
            }
            case "daily-period-application":
            case "daily-period-apply": {
                const id=value.markerId;
                const record=await loadAppliedPair(tx,root,uid,account,id);
                if((value.kind==="daily-period-application"&&row.id!==id)||
                   (value.kind==="daily-period-apply"&&row.id!==record.operationId)){
                    fail("data-loss","Daily application inventory differs.");
                }
                if(!applications.has(id)){
                    await verifyAppliedResult(tx,root,uid,account,record);applications.add(id);
                }
                break;
            }
            default:fail("failed-precondition","Unreconciled operation blocks zero-consumption application.");
            }
        }
        return {status:"verified-empty",operationCount:inventory.docs.length};
    }

    async function applyDailyPeriod(request,input){
        if(!input||Object.keys(input).sort().join("|")!=="expectedRevision|operationId|periodId"||
           typeof input.operationId!=="string"||!OPERATION_ID.test(input.operationId)||
           input.operationId.startsWith("daily-period-")||
           typeof input.periodId!=="string"||!/^daily-period-\d{8}$/.test(input.periodId)||
           !Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<2||
           input.expectedRevision>=Number.MAX_SAFE_INTEGER){
            fail("invalid-argument","Daily application accepts only operation/source IDs and revision.");
        }
        const {operationId,periodId,expectedRevision}=input,appliedAt=now();
        const markerId=periodId.replace("daily-period-","daily-period-applied-");
        return runProtected(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid);
            const ref=(name,id="current")=>root.collection(name).doc(id);
            const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
            const [envelopeSnap,accountSnap,receipt,...overlap]=await Promise.all([
                envelopeRef,ref("account"),ref("operations",operationId),
                ...[operationId,markerId].flatMap(id=>["grantOperations","ledgerEntries"]
                    .map(name=>ref(name,id)))].map(reference=>tx.get(reference)));
            if(!envelopeSnap.exists||!accountSnap.exists){
                fail("failed-precondition","Complete canonical sources required.");
            }
            const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=accountSnap.data();
            if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
               account.ownerUid!==uid||account.provenance!=="server-created"||
               !Array.isArray(account.slots)||account.slots.length!==3||
               typeof account.slots[0]!=="string"||account.slots[1]!==null||account.slots[2]!==null||
               !Number.isSafeInteger(account.serverRevision)||account.serverRevision<2||
               account.serverRevision>envelope.serverRevision||
               !/^[a-f0-9]{64}$/.test(account.snapshotSha256||"")){
                fail("failed-precondition","An unpublished first character is required.");
            }
            if(overlap.some(snap=>snap.exists)){fail("data-loss","Daily application IDs overlap another operation.");}
            if(receipt.exists){
                if(receipt.get("operationId")!==operationId||receipt.get("periodId")!==periodId||
                   receipt.get("expectedRevision")!==expectedRevision){
                    fail("data-loss","Daily application intent differs.");
                }
                const record=await loadAppliedPair(tx,root,uid,account,markerId);
                if(record.operationId!==operationId){fail("data-loss","Daily application receipt differs.");}
                return {...await verifyAppliedResult(tx,root,uid,account,record),unchanged:true};
            }
            const orphan=await tx.get(root.collection("operations")
                .where("operationId","==",operationId).limit(2));
            if(orphan.docs.length){fail("data-loss","Daily application receipt is missing.");}
            const marker=await tx.get(ref("operations",markerId));
            if(marker.exists){
                const record=await loadAppliedPair(tx,root,uid,account,markerId);
                await verifyAppliedResult(tx,root,uid,account,record);
                fail("already-exists","This daily period was already applied.");
            }
            if(envelope.serverRevision!==expectedRevision||account.serverRevision!==expectedRevision){
                fail("aborted","CLOUD_REVISION_CONFLICT");
            }
            if(envelope.data.migrationCandidateStatus!=="none"){
                fail("failed-precondition","Unresolved migration cannot apply a daily period.");
            }
            const proof=await loadDailySource(tx,root,uid,account,periodId);
            if(!Number.isSafeInteger(appliedAt)||appliedAt<1||
               periodId!=="daily-period-"+taipeiDay(appliedAt)||
               proof.result.sourceRevision!==expectedRevision||
               account.snapshotSha256!==assembleCanonicalSnapshot(uid,expectedRevision,proof.records).sha256){
                fail("failed-precondition","Daily observation is not the current server period/source.");
            }
            const names=["economy","relicLoadout","progress","claimCheckpoints"];
            const characterRef=ref("characters",account.slots[0]);
            const revision=nextRevision(envelope);
            const [character,...snaps]=await Promise.all([characterRef,
                ...names.map(name=>ref(name)),ref("playableSnapshots",String(revision)),
                ref("recoveryArchives",String(revision))].map(reference=>tx.get(reference)));
            if(!character.exists||snaps.slice(0,4).some(snap=>!snap.exists)){
                fail("data-loss","Current daily sources are incomplete.");
            }
            if(snaps.slice(4).some(snap=>snap.exists)){fail("data-loss","Next revision already has evidence.");}
            const owned=await readOwnedSources(tx,root,fail);
            const records={account:source(account),characters:[source(character.data())],
                economy:source(snaps[0].data()),...owned.records,
                relicLoadout:source(snaps[1].data()),progress:source(snaps[2].data()),
                claimCheckpoint:source(snaps[3].data())};
            if(snapshotDigest(records)!==snapshotDigest(proof.records)){
                fail("data-loss","Current sources differ from the daily observation.");
            }
            const consumption=await verifyZeroBasis(tx,root,uid,account,proof);
            const audit=await verifyEmptyInventory(tx,root,uid,account,consumption);
            const next=zeroPeriodRecords(records,revision,proof.result.targetDate);
            const bundle=assembleCanonicalSnapshot(uid,revision,next);
            assembleCanonicalPlayableProjection(uid,revision,next);
            const archive=createRecoveryArchive(uid,revision,next,bundle);
            if(periodId!=="daily-period-"+taipeiDay(now())){
                fail("failed-precondition","Server period changed before commit.");
            }
            const record={schemaVersion:1,ownerUid:uid,kind:"daily-period-application",
                markerId,operationId,periodId,sourceSha256:proof.result.sourceSha256,
                inputRevision:expectedRevision,appliedRevision:revision,
                snapshotSha256:bundle.sha256,targetDate:proof.result.targetDate,appliedAt,consumption,audit,
                authoritativeStateReady:false,rewardEligible:false};
            const sha256=snapshotDigest(record),stamp=FieldValue.serverTimestamp();
            tx.update(ref("account"),{serverRevision:revision,snapshotSha256:bundle.sha256,updatedAt:stamp});
            tx.update(characterRef,{serverRevision:revision,updatedAt:stamp});
            for(const name of ["economy","relicLoadout","claimCheckpoints"]){
                tx.update(ref(name),{serverRevision:revision,updatedAt:stamp});
            }
            tx.update(ref("progress"),{serverRevision:revision,sidecars:next.progress.sidecars,updatedAt:stamp});
            advanceOwnedSources(tx,owned.refs,revision,stamp);
            tx.create(ref("playableSnapshots",String(revision)),{...bundle,createdAt:stamp});
            tx.create(ref("recoveryArchives",String(revision)),{...archive,createdAt:stamp});
            tx.create(ref("operations",markerId),{...record,sha256,createdAt:stamp});
            tx.create(ref("operations",operationId),{schemaVersion:1,ownerUid:uid,
                kind:"daily-period-apply",operationId,markerId,markerSha256:sha256,periodId,
                expectedRevision,appliedRevision:revision,snapshotSha256:bundle.sha256,
                authoritativeStateReady:false,rewardEligible:false,createdAt:stamp});
            tx.update(envelopeRef,{serverRevision:revision,updatedAt:stamp});
            return {periodId,targetDate:record.targetDate,appliedRevision:revision,
                snapshotSha256:bundle.sha256,unchanged:false,
                authoritativeStateReady:false,rewardEligible:false};
        });
    }
    // Read-only proof entry point for approved recovery. The caller inventories
    // all operations and economic collisions before writing. Additional reads:
    // initial <=2, observation <=8, application <=35. Application proof has one
    // parent lookup, never an unbounded recursive traversal.
    async function verifyRetainedOperation(tx,root,uid,account,row){
        const value=row.data();
        if(value?.schemaVersion!==1||value.ownerUid!==uid||
           account.provenance!=="server-created"||!Number.isSafeInteger(account.serverRevision)||
           account.serverRevision<2){fail("data-loss","Retained operation identity is inconsistent.");}
        switch(value.kind){
        case "additional-character-sources":
            if(value.operationId!==row.id)fail("data-loss","Additional character receipt identity differs.");
            await additionalProof(tx,root,uid,account,value);
            return;
        case "initial-character-sources": {
            const revision=value.sourceRevision;
            if(!OPERATION_ID.test(row.id||"")||value.operationId!==row.id||
               account.slots?.[0]!==`character-${row.id}`||value.authoritativeStateReady!==false||
               !Number.isSafeInteger(revision)||revision<2||revision>account.serverRevision||
               !/^[a-f0-9]{64}$/.test(value.snapshotSha256||"")||
               !/^[a-f0-9]{64}$/.test(value.selectionSha256||"")){
                fail("data-loss","Retained initial operation is inconsistent.");
            }
            const [snapshot,archive]=await Promise.all([
                tx.get(root.collection("playableSnapshots").doc(String(revision))),
                tx.get(root.collection("recoveryArchives").doc(String(revision)))]);
            try{inspectInitialOrigin(uid,revision,row.id,value,snapshot,archive);}
            catch(_){fail("data-loss","Retained initial proof is inconsistent.");}
            return;
        }
        case "daily-period-source":
        case "daily-period-observation": {
            if(!/^daily-period-\d{8}$/.test(value.periodId||"")){
                fail("data-loss","Retained daily period identity is inconsistent.");
            }
            const proof=await loadDailySource(tx,root,uid,account,value.periodId);
            if((value.kind==="daily-period-source"&&row.id!==value.periodId)||
               (value.kind==="daily-period-observation"&&row.id!==proof.operationId)){
                fail("data-loss","Retained daily period inventory differs.");
            }
            return;
        }
        case "daily-period-application":
        case "daily-period-apply": {
            if(!/^daily-period-applied-\d{8}$/.test(value.markerId||"")){
                fail("data-loss","Retained daily application identity is inconsistent.");
            }
            const record=await loadAppliedPair(tx,root,uid,account,value.markerId);
            if((value.kind==="daily-period-application"&&row.id!==value.markerId)||
               (value.kind==="daily-period-apply"&&row.id!==record.operationId)){
                fail("data-loss","Retained daily application inventory differs.");
            }
            await verifyAppliedResult(tx,root,uid,account,record);
            return;
        }
        default:fail("failed-precondition","Unsupported retained operation blocks recovery.");
        }
    }
    function retainedOperationReadBudget(kind){
        if(kind==="additional-character-sources")return 6;
        if(kind==="initial-character-sources")return 2;
        if(["daily-period-source","daily-period-observation"].includes(kind))return 8;
        if(["daily-period-application","daily-period-apply"].includes(kind))return 35;
        return 0; // Unsupported kinds are rejected without reads.
    }
    return Object.freeze({commitInitialSources,commitAdditionalCharacter,observeDailyPeriod,applyDailyPeriod,
        verifyRetainedOperation,retainedOperationReadBudget});
}

module.exports={createCanonicalSourceWriter};
