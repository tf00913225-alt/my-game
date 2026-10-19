"use strict";

const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,
    claimRecordsDigest,snapshotDigest}=require("./canonical-snapshot");
const {inspectRecoveryArchive,createRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources,advanceOwnedRecords,advanceOwnedSources}=require("./canonical-owned-sources");
const {createCanonicalSourceWriter}=require("./canonical-source-writer");
const timePolicy=require("./account-mode-time-policy");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const KIND="account-mode-time";
const SINGLE={account:"account",economy:"economy",relicLoadout:"relicLoadout",
    progress:"progress",claimCheckpoint:"claimCheckpoints"};
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>snapshotDigest(a)===snapshotDigest(b);

// Internal Account/Save Owner. Presence intents delimit server-observed
// intervals; they do not prove physical browser visibility or an ad impression.
// No callable, Client hook, combat lifecycle or playable publication is enabled.
function createCanonicalAccountModeTime({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now,verifyPatrolSettlementEvidence,
    patrolSettlementEvidenceReadBudget=0}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const sourceOwner=createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,
        inspectExistingEnvelope,nextRevision,now});
    const ref=(root,name,id)=>root.collection(name).doc(id);
    const digestHead=(state,eventSha256)=>snapshotDigest({...state,eventSha256});
    const patrolPlans=new WeakMap(),verifyingPatrol=new WeakMap();
    const forestReadBudget=Number.isSafeInteger(patrolSettlementEvidenceReadBudget)&&
        patrolSettlementEvidenceReadBudget>0?patrolSettlementEvidenceReadBudget:0;
    function modes(records){
        try{
            const sidecars=records.progress.sidecars;
            for(const name of ["element-box-state","rested-exp-state"]){
                if(sidecars[name]?.status!=="present")throw Error("Missing time sidecar");
            }
            return {elementBox:JSON.parse(sidecars["element-box-state"].raw),
                rested:JSON.parse(sidecars["rested-exp-state"].raw)};
        }catch(_){fail("data-loss","Complete canonical mode sidecars are required.");}
    }
    function headState(head){
        const {sha256,eventSha256,updatedAt,...state}=head;
        return state;
    }
    function validateHead(head,uid,characterId,maxRevision){
        if(!head||head.schemaVersion!==1||head.kind!==KIND||head.ownerUid!==uid||
           head.characterId!==characterId||!Number.isSafeInteger(head.sequence)||head.sequence<1||
           !Number.isSafeInteger(head.observedAtMs)||head.observedAtMs<1||
           !Number.isSafeInteger(head.canonicalRevision)||head.canonicalRevision<2||
           head.canonicalRevision>maxRevision||typeof head.sessionId!=="string"||!head.sessionId||
           !ID.test(head.epochId||"")||!ID.test(head.lastOperationId||"")||
           !["foreground","rest"].includes(head.presence)||typeof head.elementBoxActive!=="boolean"||
           !(head.pendingAdSourceId===null||ID.test(head.pendingAdSourceId||""))||
           !/^[a-f0-9]{64}$/.test(head.canonicalSnapshotSha256||"")||
           !/^[a-f0-9]{64}$/.test(head.eventSha256||"")||
           head.sha256!==digestHead(headState(head),head.eventSha256)){
            fail("data-loss","Account mode head is inconsistent.");
        }
    }
    function nextRecords(records,revision,before,after){
        const owned=advanceOwnedRecords(records,revision);
        const sidecars={...records.progress.sidecars};
        for(const [key,name] of [["elementBox","element-box-state"],["rested","rested-exp-state"]]){
            if(!same(before[key],after[key]))sidecars[name]={status:"present",raw:JSON.stringify(after[key])};
        }
        return {...records,...owned,
            account:{...records.account,serverRevision:revision},
            characters:records.characters.map(row=>({...row,serverRevision:revision})),
            economy:{...records.economy,serverRevision:revision},
            relicLoadout:{...records.relicLoadout,serverRevision:revision},
            progress:{...records.progress,serverRevision:revision,sidecars},
            claimCheckpoint:{...records.claimCheckpoint,serverRevision:revision,
                claimDigest:claimRecordsDigest(owned.claimRecords)}};
    }
    function delta(before,after){
        return {elementBoxMs:after.elementBox.remainingMs-before.elementBox.remainingMs,
            restedBattles:after.rested.battles-before.rested.battles,
            restedProgressMs:after.rested.progressMs-before.rested.progressMs};
    }
    function sourcePayload(ad){
        const {sha256,status,consumedBy,closedAtMs,createdAt,updatedAt,...payload}=ad;
        return payload;
    }
    function validateAd(ad,uid,sourceId){
        if(!ad||ad.schemaVersion!==1||ad.kind!=="simulated-element-box-ad"||ad.ownerUid!==uid||
           ad.sourceId!==sourceId||!ID.test(sourceId||"")||ad.beginOperationId!==sourceId||
           typeof ad.sessionId!=="string"||!ad.sessionId||
           !Number.isSafeInteger(ad.startedAtMs)||ad.startedAtMs<1||
           ad.notBeforeMs!==ad.startedAtMs+3000||!Number.isSafeInteger(ad.notBeforeMs)||
           ad.verifiedProvider!==false||ad.rewardMs!==timePolicy.constants.elementBoxRewardMs||
           ad.maximumMs!==timePolicy.constants.elementBoxMaxMs||
           !["pending","consumed","abandoned"].includes(ad.status)||
           (ad.status==="pending"?(ad.consumedBy!==null||ad.closedAtMs!==null):
               (!ID.test(ad.consumedBy||"")||!Number.isSafeInteger(ad.closedAtMs)||ad.closedAtMs<ad.startedAtMs))||
           ad.sha256!==snapshotDigest(sourcePayload(ad))){
            fail("data-loss","Simulated ad source is inconsistent.");
        }
    }
    // Deterministic transition over already validated canonical state. Reopen
    // starts a new acknowledged epoch: the closed/reload gap is never charged
    // to ElementBox. The prior/current block rule retains existing rested UX.
    function transition(beforeHead,before,intent,time,sessionId,ad){
        const after=clone(before),action=intent.action;
        const previousAt=beforeHead?.observedAtMs??before.rested.lastSeenAt;
        if(!Number.isSafeInteger(time)||time<previousAt){fail("failed-precondition","Server time precedes the retained mode anchor.");}
        const elapsed=time-previousAt;
        let active=beforeHead?.elementBoxActive??false;
        let presence=beforeHead?.presence??"rest";
        let epochId=beforeHead?.epochId??intent.operationId;
        let pending=beforeHead?.pendingAdSourceId??null;
        if(!beforeHead&&action!=="reopen")fail("failed-precondition","An initial presence reopen is required.");
        if(beforeHead&&beforeHead.sessionId!==sessionId&&action!=="reopen"){
            fail("failed-precondition","The current session must reopen mode time first.");
        }
        if(action==="reopen"||action==="resume"){
            if(action==="resume"){
                if(presence!=="rest")fail("failed-precondition","Only a resting epoch can resume.");
                // Explicit background and closed/reloaded process are different
                // acknowledged intents. A known background interval keeps the
                // existing ElementBox countdown; reopen never charges that gap.
                if(active){
                    const used=timePolicy.debitElementBox(after.elementBox.remainingMs,elapsed,true);
                    after.elementBox.remainingMs=timePolicy.elementBoxStoredMs(used.remainingMs);
                    if(used.exhausted)active=false;
                }
            }
            const requested=intent.elementBox==="start"?true:intent.elementBox==="stop"?false:active;
            if(requested&&after.elementBox.remainingMs<=0)fail("failed-precondition","ElementBox has no remaining time.");
            if(!(beforeHead?.elementBoxActive??before.rested.blockedByElementBox)&&!requested){
                const accrued=timePolicy.accrueRested(after.rested.battles,after.rested.progressMs,elapsed);
                after.rested.battles=accrued.battles;after.rested.progressMs=accrued.progressMs;
            }
            presence="foreground";active=requested;
            if(action==="reopen")epochId=intent.operationId;
        }else{
            // Only same-epoch acknowledged foreground requests charge a running
            // ElementBox. A rest epoch cannot produce online earning activity.
            if(presence==="foreground"&&active){
                const used=timePolicy.debitElementBox(after.elementBox.remainingMs,elapsed,true);
                after.elementBox.remainingMs=timePolicy.elementBoxStoredMs(used.remainingMs);
                if(used.exhausted)active=false;
            }
            if(action==="heartbeat"||action==="rest"){
                if(presence!=="foreground")fail("failed-precondition","Resting mode time requires resume.");
                const requested=intent.elementBox==="start"?true:intent.elementBox==="stop"?false:active;
                if(requested&&after.elementBox.remainingMs<=0)fail("failed-precondition","ElementBox has no remaining time.");
                active=requested;
                if(action==="rest")presence="rest";
            }else{
                if(presence!=="foreground")fail("failed-precondition","Simulated ad intents require acknowledged foreground mode.");
                if(action==="begin-ad"){
                    if(pending!==null)fail("failed-precondition","A simulated ad source is already pending.");
                    if(after.elementBox.remainingMs>=timePolicy.constants.elementBoxMaxMs){
                        fail("failed-precondition","ElementBox has reached its existing time cap.");
                    }
                    pending=intent.operationId;
                }else if(action==="complete-ad"||action==="abandon-ad"){
                    validateAd(ad,intent.ownerUid,intent.sourceId);
                    if(ad.status!=="pending"||pending!==intent.sourceId){
                        fail("failed-precondition","The simulated ad source is not pending.");
                    }
                    // Abandonment can close an old-session source after takeover;
                    // its reward cannot cross creation-session authority.
                    if(action==="complete-ad"){
                        if(ad.sessionId!==sessionId)fail("permission-denied","A simulated ad source belongs to its original session.");
                        if(time<ad.notBeforeMs)fail("failed-precondition","The simulated ad interval is incomplete.");
                        after.elementBox.remainingMs=timePolicy.elementBoxStoredMs(
                            timePolicy.grantElementBox(after.elementBox.remainingMs,8,32));
                    }
                    pending=null;
                }else fail("invalid-argument","Unsupported account mode intent.");
            }
        }
        // Canonical lastSeenAt is a materialization marker, not the heartbeat
        // anchor. Zero-value presence updates stay in the private event Owner.
        if(!same(before,after)){
            after.rested.lastSeenAt=time;
            after.rested.blockedByElementBox=active;
        }
        return {after,presence,elementBoxActive:active,epochId,pendingAdSourceId:pending};
    }
    async function originalRecords(tx,root,uid,revision,sha256){
        const [snapshot,archive]=await Promise.all([
            tx.get(ref(root,"playableSnapshots",String(revision))),
            tx.get(ref(root,"recoveryArchives",String(revision)))]);
        try{
            if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==sha256)throw Error("Missing original mode evidence");
            return inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data());
        }catch(_){fail("data-loss","Original mode snapshot or archive is inconsistent.");}
    }
    async function verifyInitialModes(tx,root,uid,account,currentModes){
        const initialId=account.slots[0].slice("character-".length);
        if(account.slots[0]!==`character-${initialId}`||!ID.test(initialId)){
            fail("failed-precondition","Explicit server creation evidence is required for mode time.");
        }
        const original=await tx.get(ref(root,"operations",initialId));
        if(!original.exists)fail("data-loss","Original mode creation receipt is missing.");
        await sourceOwner.verifyRetainedOperation(tx,root,uid,account,
            {id:initialId,data:()=>original.data()});
        const archive=await tx.get(ref(root,"recoveryArchives",String(original.get("sourceRevision"))));
        if(!same(modes(archive.get("sourceRecords")),currentModes)){
            fail("data-loss","Mode time has no original canonical baseline.");
        }
    }
    function eventPayload(event){const {sha256,createdAt,...payload}=event;return payload;}
    function verifyPair(event,receipt,ledger){
        const changed=event.modeChanged;
        if(changed){
            if(!receipt||!ledger||receipt.schemaVersion!==1||receipt.kind!==KIND||
               receipt.ownerUid!==event.ownerUid||receipt.operationId!==event.operationId||
               receipt.intentSha256!==event.intentSha256||receipt.eventSha256!==event.sha256||
               receipt.sourceRevision!==event.sourceRevision||receipt.resultRevision!==event.resultRevision||
               receipt.envelopeRevision!==event.envelopeRevision||receipt.resultEnvelopeRevision!==event.resultEnvelopeRevision||
               receipt.snapshotSha256!==event.resultSnapshotSha256||receipt.headSha256!==event.headSha256||
               receipt.authoritativeStateReady!==false||ledger.schemaVersion!==1||ledger.kind!==KIND||
               ledger.ownerUid!==event.ownerUid||ledger.operationId!==event.operationId||
               ledger.eventSha256!==event.sha256||ledger.sourceRevision!==event.sourceRevision||
               ledger.envelopeRevision!==event.envelopeRevision||ledger.resultEnvelopeRevision!==event.resultEnvelopeRevision||
               ledger.resultRevision!==event.resultRevision||ledger.snapshotSha256!==event.resultSnapshotSha256||
               !same(ledger.delta,event.delta))fail("data-loss","Mode receipt or signed ledger is inconsistent.");
        }else if(receipt||ledger)fail("data-loss","Presence-only mode event overlaps an economic operation.");
    }
    async function verifyEvent(tx,root,uid,account,event,receipt,ledger,maxEnvelopeRevision=account.serverRevision){
        if(event?.schemaVersion===2){
            if(event.resultOwner!=="forest-patrol-settlement"||
               typeof verifyPatrolSettlementEvidence!=="function"||forestReadBudget===0){
                fail("failed-precondition","The Forest settlement proof Owner is unavailable.");
            }
            let active=verifyingPatrol.get(tx);
            if(!active){active=new Set();verifyingPatrol.set(tx,active);}
            if(active.has(event.operationId))fail("data-loss","Recursive Forest settlement verification is invalid.");
            active.add(event.operationId);
            try{
                await verifyPatrolSettlementEvidence({tx,root,uid,account,event,receipt,ledger,
                    maxEnvelopeRevision,verifyPatrolModeComponent});
            }finally{active.delete(event.operationId);}
            return event;
        }
        if(!event||event.schemaVersion!==1||event.kind!==KIND||event.ownerUid!==uid||
           !ID.test(event.operationId||"")||!Number.isSafeInteger(event.sequence)||event.sequence<1||
           !Number.isSafeInteger(event.sourceRevision)||event.sourceRevision<2||
           !Number.isSafeInteger(event.envelopeRevision)||event.envelopeRevision<event.sourceRevision||
           !Number.isSafeInteger(maxEnvelopeRevision)||maxEnvelopeRevision<account.serverRevision||
           event.envelopeRevision>maxEnvelopeRevision||
           !Number.isSafeInteger(event.resultEnvelopeRevision)||event.resultEnvelopeRevision>maxEnvelopeRevision||
           !Number.isSafeInteger(event.resultRevision)||event.resultRevision>account.serverRevision||
           typeof event.modeChanged!=="boolean"||
           event.resultRevision!==(event.modeChanged?event.envelopeRevision+1:event.sourceRevision)||
           event.resultEnvelopeRevision!==event.envelopeRevision+(event.modeChanged?1:0)||
           event.intent?.ownerUid!==uid||event.intent.operationId!==event.operationId||
           event.intent.expectedRevision!==event.envelopeRevision||
           event.intent.expectedSequence!==event.sequence-1||event.intentSha256!==snapshotDigest(event.intent)||
           event.sha256!==snapshotDigest(eventPayload(event)))fail("data-loss","Retained mode event is inconsistent.");
        const before=await originalRecords(tx,root,uid,event.sourceRevision,event.sourceSnapshotSha256),sourceModes=modes(before);
        if(before.account.slots[0]!==account.slots[0]||!same(sourceModes,event.beforeModes)){
            fail("data-loss","Retained mode event differs from its original source.");
        }
        if(event.beforeHead){
            validateHead(event.beforeHead,uid,account.slots[0],event.sourceRevision);
            if(event.beforeHead.sequence!==event.sequence-1||!same(event.beforeHead.modeState,event.beforeModes)){
                fail("data-loss","Retained mode predecessor is inconsistent.");
            }
            const predecessor=await tx.get(ref(root,"modeTimeEvents",event.beforeHead.lastOperationId));
            if(!predecessor.exists||predecessor.get("sha256")!==event.beforeHead.eventSha256||
               predecessor.get("headSha256")!==snapshotDigest(headState(event.beforeHead))||
               !same(predecessor.get("afterState"),headState(event.beforeHead))){
                fail("data-loss","Retained mode predecessor is missing.");
            }
        }else{
            if(event.sequence!==1)fail("data-loss","Mode baseline sequence is inconsistent.");
            await verifyInitialModes(tx,root,uid,before.account,event.beforeModes);
        }
        let ad=null;
        if(["complete-ad","abandon-ad"].includes(event.intent.action)){
            const sourceSnap=await tx.get(ref(root,"simulatedAdSources",event.intent.sourceId));
            ad=sourceSnap.data();validateAd(ad,uid,event.intent.sourceId);
            if(ad.status!==(event.intent.action==="complete-ad"?"consumed":"abandoned")||
               ad.consumedBy!==event.operationId||ad.closedAtMs!==event.observedAtMs){
                fail("data-loss","Retained simulated ad consumption is inconsistent.");
            }
            const begun=await tx.get(ref(root,"modeTimeEvents",ad.beginOperationId));
            if(!begun.exists||begun.get("intent.action")!=="begin-ad"||
               begun.get("sha256")!==ad.beginEventSha256||begun.get("observedAtMs")!==ad.startedAtMs){
                fail("data-loss","Original simulated ad event is missing.");
            }
            ad={...ad,status:"pending",consumedBy:null,closedAtMs:null};
        }
        const derived=transition(event.beforeHead,sourceModes,event.intent,event.observedAtMs,event.sessionId,ad);
        if(!same(derived.after,event.afterModes)||!same(event.delta,delta(event.beforeModes,event.afterModes))||
           event.modeChanged===same(event.beforeModes,event.afterModes)){
            fail("data-loss","Retained mode delta differs from its original intent.");
        }
        const expectedState={schemaVersion:1,kind:KIND,ownerUid:uid,characterId:account.slots[0],
            sequence:event.sequence,sessionId:event.sessionId,epochId:derived.epochId,
            presence:derived.presence,elementBoxActive:derived.elementBoxActive,
            pendingAdSourceId:derived.pendingAdSourceId,observedAtMs:event.observedAtMs,
            modeState:derived.after,canonicalRevision:event.resultRevision,
            canonicalSnapshotSha256:event.resultSnapshotSha256,lastOperationId:event.operationId};
        // The event binds the state digest; the mutable head additionally binds
        // the completed event digest. This has no circular hash dependency.
        if(!same(event.afterState,expectedState)||event.headSha256!==snapshotDigest(expectedState)){
            fail("data-loss","Retained mode head result is inconsistent.");
        }
        if(event.modeChanged){
            const after=await originalRecords(tx,root,uid,event.resultRevision,event.resultSnapshotSha256);
            const expected=nextRecords(before,event.resultRevision,sourceModes,derived.after);
            if(!same(after,expected))fail("data-loss","Retained mode result archive differs from its original delta.");
        }else if(event.sourceSnapshotSha256!==event.resultSnapshotSha256){
            fail("data-loss","Presence-only mode event changed its canonical snapshot.");
        }
        verifyPair(event,receipt,ledger);
        if(event.intent.action==="begin-ad"){
            const sourceSnap=await tx.get(ref(root,"simulatedAdSources",event.operationId));
            const issued=sourceSnap.data();validateAd(issued,uid,event.operationId);
            if(issued.beginEventSha256!==event.sha256||issued.sessionId!==event.sessionId||
               issued.startedAtMs!==event.observedAtMs)fail("data-loss","Retained simulated ad issuance differs.");
        }
        return event;
    }
    async function verifyRetainedOperation(tx,root,uid,account,row,maxEnvelopeRevision=account.serverRevision){
        const receipt=row.data();
        if(receipt?.kind!==KIND||receipt.operationId!==row.id)fail("data-loss","Retained mode operation identity differs.");
        const [eventSnap,ledgerSnap,grantSnap]=await Promise.all([
            tx.get(ref(root,"modeTimeEvents",row.id)),tx.get(ref(root,"ledgerEntries",row.id)),
            tx.get(ref(root,"grantOperations",row.id))]);
        if(!eventSnap.exists||grantSnap.exists)fail("data-loss","Retained mode evidence is missing or overlaps.");
        await verifyEvent(tx,root,uid,account,eventSnap.data(),receipt,ledgerSnap.data(),maxEnvelopeRevision);
    }
    async function verifyRetainedEvent(tx,root,uid,account,row,maxEnvelopeRevision=account.serverRevision){
        const event=row.data();
        if(event?.modeChanged!==true||event.operationId!==row.id||event.kind!==KIND){
            fail("data-loss","Retained value mode event identity differs.");
        }
        const [operation,ledger,grant]=await Promise.all([
            tx.get(ref(root,"operations",row.id)),tx.get(ref(root,"ledgerEntries",row.id)),
            tx.get(ref(root,"grantOperations",row.id))]);
        if(!operation.exists||!ledger.exists||grant.exists){
            fail("data-loss","Retained value mode event lost its original receipt or ledger.");
        }
        await verifyEvent(tx,root,uid,account,event,operation.data(),ledger.data(),maxEnvelopeRevision);
    }
    function retainedEventReadBudget(event){return 20+(event?.schemaVersion===1?0:forestReadBudget);}
    function retainedOperationReadBudget(kind){return kind===KIND?20:0;}
    function retainedSourceReadBudget(){return 32;}
    function currentEvidenceReadBudget(event){return 40+(event?.schemaVersion===1?0:forestReadBudget);}
    async function verifyRetainedSource(tx,root,uid,account,row,maxEnvelopeRevision=account.serverRevision){
        const ad=row.data();validateAd(ad,uid,row.id);
        const readEvent=async operationId=>{
            const [event,operation,ledger,grant]=await Promise.all([
                tx.get(ref(root,"modeTimeEvents",operationId)),tx.get(ref(root,"operations",operationId)),
                tx.get(ref(root,"ledgerEntries",operationId)),tx.get(ref(root,"grantOperations",operationId))]);
            if(!event.exists||event.get("operationId")!==operationId||grant.exists){
                fail("data-loss","Retained simulated source lost an original event.");
            }
            await verifyEvent(tx,root,uid,account,event.data(),operation.data(),ledger.data(),maxEnvelopeRevision);
            return event.data();
        };
        const began=await readEvent(ad.beginOperationId);
        if(began.intent.action!=="begin-ad"||began.sha256!==ad.beginEventSha256||
           began.observedAtMs!==ad.startedAtMs||began.sessionId!==ad.sessionId){
            fail("data-loss","Retained simulated source issuance differs.");
        }
        if(ad.status==="pending"){
            const head=(await tx.get(ref(root,"modeTime","current"))).data();
            validateHead(head,uid,account.slots[0],account.serverRevision);
            if(head.pendingAdSourceId!==ad.sourceId){
                fail("data-loss","Retained pending simulated source has no current marker.");
            }
        }else{
            const closed=await readEvent(ad.consumedBy);
            if(closed.intent.action!==(ad.status==="consumed"?"complete-ad":"abandon-ad")||
               closed.intent.sourceId!==ad.sourceId||closed.observedAtMs!==ad.closedAtMs||
               closed.sequence<=began.sequence){
                fail("data-loss","Retained simulated source closure differs.");
            }
        }
    }
    async function verifyCurrentEvidence(tx,root,uid,account,records,maxEnvelopeRevision=account.serverRevision){
        const [headSnap,latest]=await Promise.all([
            tx.get(ref(root,"modeTime","current")),
            tx.get(root.collection("modeTimeEvents").orderBy("sequence","desc").limit(2))]);
        if(!headSnap.exists){
            if(latest.docs.length)fail("data-loss","Mode event history has lost its current head.");
            const retained=await Promise.all([
                tx.get(root.collection("simulatedAdSources").limit(1)),
                tx.get(root.collection("operations").where("kind","==",KIND).limit(1)),
                tx.get(root.collection("ledgerEntries").where("kind","==",KIND).limit(1))]);
            if(retained.some(rows=>rows.docs.length))fail("data-loss","Mode evidence has lost its original head.");
            return null;
        }
        const head=headSnap.data();validateHead(head,uid,account.slots[0],account.serverRevision);
        if(latest.docs.length===0||latest.docs[0].id!==head.lastOperationId||
           latest.docs[0].get("sequence")!==head.sequence||
           latest.docs[1]?.get("sequence")>=head.sequence||
           !same(head.modeState,modes(records))){
            fail("data-loss","Canonical mode state or latest private event differs.");
        }
        const event=latest.docs[0].data();
        if(event.sha256!==head.eventSha256||event.headSha256!==snapshotDigest(headState(head))){
            fail("data-loss","Mode head does not bind its latest event.");
        }
        const [operation,ledger,grant]=await Promise.all([
            tx.get(ref(root,"operations",event.operationId)),tx.get(ref(root,"ledgerEntries",event.operationId)),
            tx.get(ref(root,"grantOperations",event.operationId))]);
        if(grant.exists)fail("data-loss","Mode event overlaps a grant operation.");
        await verifyEvent(tx,root,uid,account,event,operation.data(),ledger.data(),maxEnvelopeRevision);
        if(head.pendingAdSourceId!==null){
            const pendingSnap=await tx.get(ref(root,"simulatedAdSources",head.pendingAdSourceId));
            if(pendingSnap.get("status")!=="pending")fail("data-loss","Pending simulated ad marker differs.");
            await verifyRetainedSource(tx,root,uid,account,
                {id:head.pendingAdSourceId,data:()=>pendingSnap.data()},maxEnvelopeRevision);
        }
        return head;
    }
    async function context(tx,root,uid,expectedRevision){
        const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
        const [envelopeSnap,...singles]=await Promise.all([envelopeRef,
            ...Object.values(SINGLE).map(name=>ref(root,name,"current"))].map(row=>tx.get(row)));
        if(!envelopeSnap.exists||singles.some(row=>!row.exists))fail("failed-precondition","Complete canonical mode sources are required.");
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=singles[0].data();
        if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
           account.ownerUid!==uid||account.provenance!=="server-created"||
           account.slots?.length!==3||typeof account.slots[0]!=="string"||
           account.slots[1]!==null||account.slots[2]!==null||
           !Number.isSafeInteger(account.serverRevision)||account.serverRevision>envelope.serverRevision){
            fail("failed-precondition","Unpublished first-character mode sources are required.");
        }
        if(expectedRevision!==null&&envelope.serverRevision!==expectedRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
        const [characterSnap,snapshot,currentArchive,owned]=await Promise.all([
            tx.get(ref(root,"characters",account.slots[0])),
            tx.get(ref(root,"playableSnapshots",String(account.serverRevision))),
            tx.get(ref(root,"recoveryArchives",String(account.serverRevision))),readOwnedSources(tx,root,fail)]);
        if(!characterSnap.exists||!snapshot.exists||!currentArchive.exists||snapshot.get("sha256")!==account.snapshotSha256){
            fail("data-loss","Canonical mode snapshot is missing.");
        }
        const records={...owned.records,characters:[source(characterSnap.data())],
            ...Object.fromEntries(Object.keys(SINGLE).map((key,i)=>[key,source(singles[i].data())]))};
        try{
            verifyCanonicalSnapshotAgainstSources(snapshot.data(),uid,account.serverRevision,records);
            const archived=inspectRecoveryArchive(currentArchive.data(),uid,account.serverRevision,snapshot.data());
            if(!same(archived,records))throw Error("Current mode archive differs from current sources");
        }
        catch(_){fail("data-loss","Canonical mode sources differ from their snapshot.");}
        modes(records);
        return {envelope,envelopeRef,account,records,owned,snapshot};
    }
    function input(action,input){
        const keys=["operationId","expectedRevision","expectedSequence",
            ...(action==="presence"?["intent","elementBox"]:[]),
            ...(["complete-ad","abandon-ad"].includes(action)?["sourceId"]:[])];
        if(!input||Object.keys(input).sort().join("|")!==keys.sort().join("|")||
           !ID.test(input.operationId||"")||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<2||
           !Number.isSafeInteger(input.expectedSequence)||input.expectedSequence<0||
           (action==="presence"&&(!["reopen","resume","rest","heartbeat"].includes(input.intent)||
               !["start","stop","keep"].includes(input.elementBox)))||
           (["complete-ad","abandon-ad"].includes(action)&&!ID.test(input.sourceId||""))){
            fail("invalid-argument","Only a bounded account mode intent is accepted.");
        }
        return {...input,action:action==="presence"?input.intent:action};
    }
    function response(event,unchanged){
        return {operationId:event.operationId,sequence:event.sequence,resultRevision:event.resultEnvelopeRevision,
            canonicalRevision:event.resultRevision,
            sourceId:event.intent.action==="begin-ad"?event.operationId:event.intent.sourceId??null,
            modeState:clone(event.afterModes),presence:event.afterState.presence,
            elementBoxActive:event.afterState.elementBoxActive,unchanged,authoritativeStateReady:false};
    }
    async function perform(request,action,args){
        const parsed=input(action,args),time=now();
        if(!Number.isSafeInteger(time)||time<1||
           (parsed.action==="begin-ad"&&!Number.isSafeInteger(time+3000))){
            fail("internal","Server mode clock is unavailable.");
        }
        return runProtected(request,async(tx,session)=>{
            if(typeof session.sessionId!=="string"||!session.sessionId)fail("permission-denied","An active game session is required.");
            const uid=session.uid,root=db.collection("serverUsers").doc(uid),operationId=parsed.operationId;
            const intent={...parsed,ownerUid:uid};
            const [eventSnap,operationSnap,ledgerSnap,grantSnap]=await Promise.all([
                tx.get(ref(root,"modeTimeEvents",operationId)),tx.get(ref(root,"operations",operationId)),
                tx.get(ref(root,"ledgerEntries",operationId)),tx.get(ref(root,"grantOperations",operationId))]);
            if(eventSnap.exists){
                if(!same(eventSnap.get("intent"),intent)||grantSnap.exists)fail("data-loss","Mode operation ID overlaps another intent.");
                // A historical retry uses its immutable original sources, not
                // today's mutable mode head or later character projection.
                const [envelopeSnap,accountSnap]=await Promise.all([
                    tx.get(db.collection("users").doc(uid).collection("saves").doc("current")),
                    tx.get(ref(root,"account","current"))]);
                if(!envelopeSnap.exists||!accountSnap.exists)fail("data-loss","Mode replay account evidence is missing.");
                const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=accountSnap.data();
                if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
                   account.ownerUid!==uid||account.provenance!=="server-created"||
                   account.slots?.[0]!==eventSnap.get("afterState.characterId")){
                    fail("data-loss","Mode replay account identity is inconsistent.");
                }
                await verifyEvent(tx,root,uid,account,
                    eventSnap.data(),operationSnap.data(),ledgerSnap.data(),envelope.serverRevision);
                return response(eventSnap.data(),true);
            }
            if(operationSnap.exists||ledgerSnap.exists||grantSnap.exists)fail("failed-precondition","Mode operation ID is already used.");
            const current=await context(tx,root,uid,parsed.expectedRevision);
            const head=await verifyCurrentEvidence(tx,root,uid,current.account,current.records,current.envelope.serverRevision);
            if((head?.sequence??0)!==parsed.expectedSequence)fail("aborted","MODE_SEQUENCE_CONFLICT");
            const before=modes(current.records);
            if(!head){
                const retained=await Promise.all([
                    tx.get(root.collection("simulatedAdSources").limit(1)),
                    tx.get(root.collection("operations").where("kind","==",KIND).limit(1)),
                    tx.get(root.collection("ledgerEntries").where("kind","==",KIND).limit(1))]);
                if(retained.some(rows=>rows.docs.length))fail("data-loss","Mode evidence has lost its original head.");
                await verifyInitialModes(tx,root,uid,current.account,before);
            }
            let ad=null;
            if(["complete-ad","abandon-ad"].includes(parsed.action)){
                ad=(await tx.get(ref(root,"simulatedAdSources",parsed.sourceId))).data();
                validateAd(ad,uid,parsed.sourceId);
            }else if(parsed.action==="begin-ad"){
                if((await tx.get(ref(root,"simulatedAdSources",operationId))).exists){
                    fail("data-loss","A simulated source lost its original event.");
                }
            }
            const next=transition(head,before,intent,time,session.sessionId,ad);
            const changed=!same(before,next.after),revision=changed?nextRevision(current.envelope):current.account.serverRevision;
            const resultEnvelopeRevision=parsed.expectedRevision+(changed?1:0);
            if(!Number.isSafeInteger(revision)||revision!==(changed?resultEnvelopeRevision:current.account.serverRevision)||
               !Number.isSafeInteger(parsed.expectedSequence+1))fail("failed-precondition","Mode revision or sequence exceeds its safe range.");
            const records=changed?nextRecords(current.records,revision,before,next.after):current.records;
            let bundle,archive;
            try{bundle=assembleCanonicalSnapshot(uid,revision,records);archive=createRecoveryArchive(uid,revision,records,bundle);}
            catch(_){fail("data-loss","Next account mode snapshot is invalid.");}
            const afterState={schemaVersion:1,kind:KIND,ownerUid:uid,characterId:current.account.slots[0],
                sequence:parsed.expectedSequence+1,sessionId:session.sessionId,epochId:next.epochId,
                presence:next.presence,elementBoxActive:next.elementBoxActive,pendingAdSourceId:next.pendingAdSourceId,
                observedAtMs:time,modeState:next.after,canonicalRevision:revision,
                canonicalSnapshotSha256:bundle.sha256,lastOperationId:operationId};
            const payload={schemaVersion:1,kind:KIND,ownerUid:uid,operationId,intent,intentSha256:snapshotDigest(intent),
                sessionId:session.sessionId,sequence:afterState.sequence,observedAtMs:time,
                beforeHead:head?{...headState(head),eventSha256:head.eventSha256,sha256:head.sha256}:null,
                beforeModes:before,afterModes:next.after,modeChanged:changed,delta:delta(before,next.after),
                sourceRevision:current.account.serverRevision,envelopeRevision:parsed.expectedRevision,
                sourceSnapshotSha256:current.snapshot.get("sha256"),
                resultRevision:revision,resultEnvelopeRevision,resultSnapshotSha256:bundle.sha256,afterState,
                headSha256:snapshotDigest(afterState)};
            const event={...payload,sha256:snapshotDigest(payload)},stamp=FieldValue.serverTimestamp();
            const resultHead={...afterState,eventSha256:event.sha256,
                sha256:digestHead(afterState,event.sha256),updatedAt:stamp};
            // No further reads below: event, canonical delta and retained source
            // consumption are committed together or not at all.
            if(changed){
                for(const [name,collection] of Object.entries(SINGLE)){
                    tx.update(ref(root,collection,"current"),{...records[name],updatedAt:stamp,
                        ...(name==="account"?{snapshotSha256:bundle.sha256}:{})});
                }
                tx.update(ref(root,"characters",current.account.slots[0]),
                    {serverRevision:revision,updatedAt:stamp});
                advanceOwnedSources(tx,current.owned.refs,revision,stamp);
                tx.create(ref(root,"playableSnapshots",String(revision)),{...bundle,createdAt:stamp});
                tx.create(ref(root,"recoveryArchives",String(revision)),{...archive,createdAt:stamp});
                tx.update(current.envelopeRef,{serverRevision:revision,updatedAt:stamp});
                tx.create(ref(root,"operations",operationId),{schemaVersion:1,kind:KIND,ownerUid:uid,operationId,
                    intentSha256:event.intentSha256,eventSha256:event.sha256,headSha256:event.headSha256,
                    sourceRevision:current.account.serverRevision,envelopeRevision:parsed.expectedRevision,
                    resultRevision:revision,resultEnvelopeRevision,snapshotSha256:bundle.sha256,
                    authoritativeStateReady:false,createdAt:stamp});
                tx.create(ref(root,"ledgerEntries",operationId),{schemaVersion:1,kind:KIND,ownerUid:uid,operationId,
                    eventSha256:event.sha256,sourceRevision:current.account.serverRevision,envelopeRevision:parsed.expectedRevision,
                    resultRevision:revision,resultEnvelopeRevision,
                    snapshotSha256:bundle.sha256,delta:event.delta,createdAt:stamp});
            }
            if(parsed.action==="begin-ad"){
                const adPayload={schemaVersion:1,kind:"simulated-element-box-ad",ownerUid:uid,
                    sourceId:operationId,beginOperationId:operationId,beginEventSha256:event.sha256,
                    sessionId:session.sessionId,startedAtMs:time,notBeforeMs:time+3000,
                    rewardMs:timePolicy.constants.elementBoxRewardMs,maximumMs:timePolicy.constants.elementBoxMaxMs,
                    verifiedProvider:false};
                tx.create(ref(root,"simulatedAdSources",operationId),{...adPayload,sha256:snapshotDigest(adPayload),
                    status:"pending",consumedBy:null,closedAtMs:null,createdAt:stamp});
            }else if(["complete-ad","abandon-ad"].includes(parsed.action)){
                tx.update(ref(root,"simulatedAdSources",parsed.sourceId),{
                    status:parsed.action==="complete-ad"?"consumed":"abandoned",consumedBy:operationId,
                    closedAtMs:time,updatedAt:stamp});
            }
            tx.create(ref(root,"modeTimeEvents",operationId),{...event,createdAt:stamp});
            tx.set(ref(root,"modeTime","current"),resultHead);
            return response(event,false);
        });
    }
    function patrolTransition(head,before,intent,time,sessionId){
        if(!head||head.presence!=="foreground"||head.sessionId!==sessionId){
            fail("failed-precondition","Forest settlement requires the acknowledged foreground session.");
        }
        const derived=transition(head,before,{...intent,action:"heartbeat",elementBox:"keep"},time,sessionId,null);
        let rested=false;
        if(intent.settlementKind==="win"&&!derived.elementBoxActive){
            const consumed=timePolicy.consumeRestedBattle(derived.after.rested.battles);
            rested=consumed.applied;
            if(rested){
                derived.after.rested.battles=consumed.remainingBattles;
                derived.after.rested.lastSeenAt=time;
                derived.after.rested.blockedByElementBox=derived.elementBoxActive;
            }
        }
        return {...derived,mode:{elementBox:derived.elementBoxActive,rested}};
    }
    function validPatrolIntent(intent){
        return intent?.action==="forest-settlement"&&ID.test(intent.operationId||"")&&
            ID.test(intent.sourceId||"")&&["member","win","loss","escape"].includes(intent.settlementKind)&&
            (intent.settlementKind==="member"?Number.isSafeInteger(intent.memberIndex)&&
                intent.memberIndex>=0&&intent.memberIndex<=2:intent.memberIndex===null)&&
            Number.isSafeInteger(intent.expectedRevision)&&intent.expectedRevision>=2&&
            Number.isSafeInteger(intent.expectedSequence)&&intent.expectedSequence>=1;
    }
    // This is a component reader, never an entry to mode-current or Forest
    // dispatch. The Forest evidence Owner separately verifies the full earning
    // delta; this reader proves only the embedded time/consumption component.
    async function verifyPatrolModeComponent(tx,root,uid,account,event,receipt,ledger,
        maxEnvelopeRevision=account.serverRevision){
        if(!event||event.schemaVersion!==2||event.kind!==KIND||event.resultOwner!=="forest-patrol-settlement"||
           event.ownerUid!==uid||!validPatrolIntent(event.intent)||event.intent.ownerUid!==uid||
           event.operationId!==event.intent.operationId||event.sequence!==event.intent.expectedSequence+1||
           !Number.isSafeInteger(event.sourceRevision)||event.sourceRevision<2||
           !Number.isSafeInteger(event.envelopeRevision)||event.envelopeRevision<event.sourceRevision||
           event.intent.expectedRevision!==event.envelopeRevision||
           !Number.isSafeInteger(maxEnvelopeRevision)||maxEnvelopeRevision<account.serverRevision||
           event.envelopeRevision>maxEnvelopeRevision||event.resultEnvelopeRevision>maxEnvelopeRevision||
           !Number.isSafeInteger(event.resultRevision)||event.resultRevision!==event.envelopeRevision+1||
           event.resultRevision>account.serverRevision||event.resultEnvelopeRevision!==event.resultRevision||
           typeof event.modeChanged!=="boolean"||
           !/^[a-f0-9]{64}$/.test(event.settlementCoreSha256||"")||
           event.intentSha256!==snapshotDigest(event.intent)||event.sha256!==snapshotDigest(eventPayload(event))){
            fail("data-loss","Embedded Forest mode event is inconsistent.");
        }
        const [before,after]=await Promise.all([
            originalRecords(tx,root,uid,event.sourceRevision,event.sourceSnapshotSha256),
            originalRecords(tx,root,uid,event.resultRevision,event.resultSnapshotSha256)]);
        const sourceModes=modes(before);
        if(before.account.slots[0]!==account.slots[0]||after.account.slots[0]!==account.slots[0]||
           !same(event.beforeModes,sourceModes)||!same(event.afterModes,modes(after))){
            fail("data-loss","Embedded Forest mode state differs from its original snapshots.");
        }
        validateHead(event.beforeHead,uid,account.slots[0],event.sourceRevision);
        if(event.beforeHead.sequence!==event.intent.expectedSequence||
           !same(event.beforeHead.modeState,event.beforeModes)){
            fail("data-loss","Embedded Forest mode predecessor differs.");
        }
        const predecessor=await tx.get(ref(root,"modeTimeEvents",event.beforeHead.lastOperationId));
        if(!predecessor.exists||predecessor.get("sha256")!==event.beforeHead.eventSha256||
           predecessor.get("headSha256")!==snapshotDigest(headState(event.beforeHead))||
           !same(predecessor.get("afterState"),headState(event.beforeHead))){
            fail("data-loss","Embedded Forest mode predecessor is missing.");
        }
        const derived=patrolTransition(event.beforeHead,sourceModes,event.intent,event.observedAtMs,event.sessionId);
        const expectedState={schemaVersion:1,kind:KIND,ownerUid:uid,characterId:account.slots[0],
            sequence:event.sequence,sessionId:event.sessionId,epochId:derived.epochId,
            presence:derived.presence,elementBoxActive:derived.elementBoxActive,
            pendingAdSourceId:derived.pendingAdSourceId,observedAtMs:event.observedAtMs,
            modeState:derived.after,canonicalRevision:event.resultRevision,
            canonicalSnapshotSha256:event.resultSnapshotSha256,lastOperationId:event.operationId};
        if(!same(event.afterModes,derived.after)||!same(event.mode,derived.mode)||
           !same(event.delta,delta(event.beforeModes,derived.after))||
           event.modeChanged===same(event.beforeModes,derived.after)||
           !same(event.afterState,expectedState)||event.headSha256!==snapshotDigest(expectedState)){
            fail("data-loss","Embedded Forest mode consumption differs from its original intent.");
        }
        if(!receipt||!ledger||[receipt,ledger].some(row=>row.schemaVersion!==1||
               row.kind!=="forest-patrol-settlement"||row.ownerUid!==uid||row.operationId!==event.operationId||
               row.sourceRevision!==event.sourceRevision||row.envelopeRevision!==event.envelopeRevision||
               row.resultRevision!==event.resultRevision||row.resultEnvelopeRevision!==event.resultEnvelopeRevision||
               row.snapshotSha256!==event.resultSnapshotSha256||row.modeEventSha256!==event.sha256||
               row.modeHeadSha256!==event.headSha256||row.settlementCoreSha256!==event.settlementCoreSha256)||
           !same(ledger.modeDelta,event.delta)){
            fail("data-loss","Embedded Forest mode receipt or ledger binding differs.");
        }
        return {mode:clone(derived.mode),modeState:clone(derived.after),delta:clone(event.delta),
            sequence:event.sequence,headSha256:event.headSha256};
    }
    async function preparePatrolSettlement(tx,{root,uid,session,operationId,expectedRevision,expectedSequence,
        sourceRecords,sourceSnapshotSha256,serverNow,resultRevision,settlementKind,memberIndex,sourceId}){
        const intent={action:"forest-settlement",operationId,ownerUid:uid,expectedRevision,expectedSequence,
            settlementKind,memberIndex,sourceId};
        if(!tx||!root||session?.uid!==uid||typeof session.sessionId!=="string"||!session.sessionId||
           !validPatrolIntent(intent)||!Number.isSafeInteger(serverNow)||serverNow<1||
           !Number.isSafeInteger(resultRevision)||resultRevision!==expectedRevision+1||
           !/^[a-f0-9]{64}$/.test(sourceSnapshotSha256||"")){
            fail("invalid-argument","Only a bound Forest settlement mode intent is accepted.");
        }
        const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
        const [envelopeSnap,accountSnap,collision]=await Promise.all([
            tx.get(envelopeRef),tx.get(ref(root,"account","current")),
            tx.get(ref(root,"modeTimeEvents",operationId))]);
        if(collision.exists)fail("failed-precondition","Forest settlement mode operation is already used.");
        if(!envelopeSnap.exists)fail("data-loss","Forest mode envelope is missing.");
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=sourceRecords?.account;
        if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
           envelope.serverRevision!==expectedRevision){fail("aborted","CLOUD_REVISION_CONFLICT");}
        if(account?.ownerUid!==uid||account.provenance!=="server-created"||
           !Number.isSafeInteger(account.serverRevision)||account.serverRevision>expectedRevision||
           typeof account.slots?.[0]!=="string"||account.slots[1]!==null||account.slots[2]!==null){
            fail("failed-precondition","Canonical Forest mode source is not eligible.");
        }
        if(!accountSnap.exists||accountSnap.get("snapshotSha256")!==sourceSnapshotSha256||
           !same(source(accountSnap.data()),account)){
            fail("data-loss","Forest mode plan does not bind the current canonical account.");
        }
        let bundle;
        try{bundle=assembleCanonicalSnapshot(uid,account.serverRevision,sourceRecords);}
        catch(_){fail("data-loss","Canonical Forest mode source is invalid.");}
        if(bundle.sha256!==sourceSnapshotSha256)fail("data-loss","Canonical Forest mode source hash differs.");
        const original=await originalRecords(tx,root,uid,account.serverRevision,sourceSnapshotSha256);
        if(!same(original,sourceRecords))fail("data-loss","Canonical Forest mode source differs from its archive.");
        const head=await verifyCurrentEvidence(tx,root,uid,account,sourceRecords,expectedRevision);
        if(!head||head.sequence!==expectedSequence)fail("aborted","MODE_SEQUENCE_CONFLICT");
        const before=modes(sourceRecords),derived=patrolTransition(head,before,intent,serverNow,session.sessionId);
        const handle=Object.freeze({modeState:clone(derived.after),mode:clone(derived.mode),
            delta:delta(before,derived.after),sequence:expectedSequence+1,observedAtMs:serverNow});
        patrolPlans.set(handle,{tx,root,uid,sessionId:session.sessionId,intent,sourceRecords:clone(sourceRecords),
            sourceSnapshotSha256,resultRevision,serverNow,before,head:clone(headState(head)),
            beforeHead:{...headState(head),eventSha256:head.eventSha256,sha256:head.sha256},derived:clone(derived)});
        return handle;
    }
    function writePatrolModeEvidence(tx,handle,{resultRecords,resultSnapshotSha256,settlementCoreSha256}){
        const plan=patrolPlans.get(handle);
        if(!plan||plan.tx!==tx)fail("failed-precondition","A Forest mode plan belongs to its original transaction.");
        if(typeof verifyPatrolSettlementEvidence!=="function"||forestReadBudget===0){
            fail("failed-precondition","The Forest settlement proof Owner is unavailable.");
        }
        const {uid,root,intent,derived,before}=plan;
        let bundle;
        try{bundle=assembleCanonicalSnapshot(uid,plan.resultRevision,resultRecords);}
        catch(_){fail("data-loss","Forest mode result source is invalid.");}
        if(!/^[a-f0-9]{64}$/.test(settlementCoreSha256||"")||bundle.sha256!==resultSnapshotSha256||
           resultRecords.account.slots[0]!==plan.sourceRecords.account.slots[0]||
           !same(modes(resultRecords),derived.after)){
            fail("data-loss","Forest mode result does not match its prepared transaction.");
        }
        const afterState={schemaVersion:1,kind:KIND,ownerUid:uid,
            characterId:plan.sourceRecords.account.slots[0],sequence:intent.expectedSequence+1,
            sessionId:plan.sessionId,epochId:derived.epochId,presence:derived.presence,
            elementBoxActive:derived.elementBoxActive,pendingAdSourceId:derived.pendingAdSourceId,
            observedAtMs:plan.serverNow,modeState:derived.after,canonicalRevision:plan.resultRevision,
            canonicalSnapshotSha256:resultSnapshotSha256,lastOperationId:intent.operationId};
        const payload={schemaVersion:2,kind:KIND,resultOwner:"forest-patrol-settlement",ownerUid:uid,
            operationId:intent.operationId,intent,intentSha256:snapshotDigest(intent),sessionId:plan.sessionId,
            sequence:afterState.sequence,observedAtMs:plan.serverNow,beforeHead:plan.beforeHead,
            beforeModes:before,afterModes:derived.after,mode:derived.mode,modeChanged:!same(before,derived.after),
            delta:delta(before,derived.after),sourceRevision:plan.sourceRecords.account.serverRevision,
            envelopeRevision:intent.expectedRevision,sourceSnapshotSha256:plan.sourceSnapshotSha256,
            resultRevision:plan.resultRevision,resultEnvelopeRevision:plan.resultRevision,
            resultSnapshotSha256,settlementCoreSha256,afterState,headSha256:snapshotDigest(afterState)};
        const event={...payload,sha256:snapshotDigest(payload)},stamp=FieldValue.serverTimestamp();
        const head={...afterState,eventSha256:event.sha256,sha256:digestHead(afterState,event.sha256),updatedAt:stamp};
        // Consume this internal handle before writing. A plan cannot be forged,
        // replayed in another transaction, or reused for a second private event.
        patrolPlans.delete(handle);
        tx.create(ref(root,"modeTimeEvents",intent.operationId),{...event,createdAt:stamp});
        tx.set(ref(root,"modeTime","current"),head);
        return {event,head};
    }
    async function readSettlementMode(tx,root,uid,session,account,records,maxEnvelopeRevision=account.serverRevision){
        // Admission/read evidence only. A future earning writer must atomically
        // advance the acknowledged time interval and consume its rested right
        // before payout; this cached head does not settle elapsed active time.
        const head=await verifyCurrentEvidence(tx,root,uid,account,records,maxEnvelopeRevision);
        if(!head||head.sessionId!==session.sessionId||head.presence!=="foreground"){
            fail("failed-precondition","Online earning requires an acknowledged foreground mode.");
        }
        return {sequence:head.sequence,elementBox:head.elementBoxActive,
            rested:!head.elementBoxActive&&head.modeState.rested.battles>0,
            observedAtMs:head.observedAtMs,headSha256:head.sha256};
    }
    return Object.freeze({observePresence:(request,args)=>perform(request,"presence",args),
        beginSimulatedAd:(request,args)=>perform(request,"begin-ad",args),
        completeSimulatedAd:(request,args)=>perform(request,"complete-ad",args),
        abandonSimulatedAd:(request,args)=>perform(request,"abandon-ad",args),
        readSettlementMode,verifyRetainedOperation,retainedOperationReadBudget,verifyCurrentEvidence,
        currentEvidenceReadBudget,verifyRetainedSource,retainedSourceReadBudget,
        verifyRetainedEvent,retainedEventReadBudget,preparePatrolSettlement,
        writePatrolModeEvidence,verifyPatrolModeComponent});
}

module.exports={createCanonicalAccountModeTime};
