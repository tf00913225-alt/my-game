"use strict";

const {randomBytes}=require("node:crypto");
const {assembleCanonicalSnapshot,verifyCanonicalSnapshotAgainstSources,snapshotDigest,
    claimRecordsDigest}=require("./canonical-snapshot");
const {inspectRecoveryArchive,createRecoveryArchive}=require("./canonical-recovery-archive");
const {source,readOwnedSources,readCharacterSources,advanceOwnedRecords,advanceOwnedSources}=require("./canonical-owned-sources");
const {createCanonicalSourceWriter}=require("./canonical-source-writer");
const {createCanonicalAccountModeTime}=require("./canonical-account-mode-time");
const {preparePatrolMembers,patrolVictoryExp}=require("./patrol-ticket-policy");
const {applyPatrolProgress}=require("./patrol-progress");
const stackPolicy=require("./inventory-stack-policy");
const catalog=require("./generated/patrol-source-catalog.json");
const items=require("./generated/patrol-item-catalog.json");
const progressPolicy=require("./generated/patrol-progress-policy.json");
const ID=/^[A-Za-z0-9_-]{16,64}$/;
const KIND="forest-patrol-settlement";
const SINGLE={account:"account",economy:"economy",progress:"progress",
    relicLoadout:"relicLoadout",claimCheckpoint:"claimCheckpoints"};
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>snapshotDigest(a)===snapshotDigest(b);
const strip=value=>{const {createdAt,updatedAt,sha256,...payload}=value;return payload;};
const clean=value=>{const {createdAt,updatedAt,...payload}=value;return payload;};
const seal=value=>({...value,sha256:snapshotDigest(value)});
// Durable behavior identity, never a hash of JavaScript formatting. A behavior
// change requires a new policy version and retention of this v1 proof path;
// historical tickets must not be reinterpreted with replacement formulas.
const patrolPolicyCertificate=Object.freeze({schemaVersion:1,policyId:"forest-online-patrol-v1",
    sourceCatalogSha256:catalog.sha256,itemCatalogSha256:items.sha256,
    progressCatalogSha256:progressPolicy.sha256,
    selectionRule:"forest-client-selection-v1",rewardRule:"patrol-reward-v1",
    dropRule:"wild-subtractive-drop-v1",progressRule:"patrol-progress-v1",
    modeRule:"account-mode-time-v2",stackRule:"inventory-stack-v1",
    rewardConstants:Object.freeze({...require("./patrol-reward-policy").constants}),
    normalDrops:require("./patrol-drop-policy").normalRows,
    eliteDrops:require("./patrol-drop-policy").eliteRows,
    stackConstants:stackPolicy.constants,
    modeConstants:require("./account-mode-time-policy").constants});
const policySha256=snapshotDigest(patrolPolicyCertificate);
// Public issuance is identity only. Private future draws cannot be exposed to
// an issue/abandon loop before a member's reward is committed.
const publicMembers=members=>members.map(member=>Object.fromEntries(
    ["entryId","name","level","element","monsterKey","context","rank","memberIndex"]
        .map(key=>[key,member[key]])));

// Internal ordinary online intent settlement, not a combat outcome verifier.
// Every economic mutation is bound to one server-issued member/terminal source.
function createCanonicalPatrolSettlement({db,FieldValue,HttpsError,runProtected,
    inspectExistingEnvelope,nextRevision,now=Date.now,randomBytes:entropy=randomBytes}){
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    const ref=(root,name,id)=>root.collection(name).doc(id);
    const sourceOwner=createCanonicalSourceWriter({db,FieldValue,HttpsError,runProtected,inspectExistingEnvelope,nextRevision,now});
    const modeOwner=createCanonicalAccountModeTime({db,FieldValue,HttpsError,runProtected:runEvidenceAttempt,inspectExistingEnvelope,nextRevision,now,
        verifyPatrolSettlementEvidence,patrolSettlementEvidenceReadBudget:60});
    const caches=new WeakMap();
    // The SDK can reuse one Transaction object for multiple optimistic attempts.
    // Its identity is not a snapshot identity. Reset once at callback entry,
    // retaining shared immutable proof reads only within that one attempt.
    function beginEvidenceAttempt(tx){
        const previous=caches.get(tx);
        if(previous)caches.delete(previous.proxy);
        caches.delete(tx);
    }
    function runEvidenceAttempt(request,operation){
        return runProtected(request,(tx,session)=>{
            beginEvidenceAttempt(tx);
            return operation(tx,session);
        });
    }
    function cache(tx){
        let value=caches.get(tx);
        if(!value){
            value={docs:new Map(),cores:new Map(),settlements:new Map(),active:new Set()};
            value.proxy={get:reference=>read(tx,reference)};caches.set(tx,value);caches.set(value.proxy,value);
        }
        return value;
    }
    function read(tx,reference){
        const value=cache(tx);
        if(typeof reference.path!=="string"||typeof reference.collection!=="function")return tx.get(reference);
        if(!value.docs.has(reference.path))value.docs.set(reference.path,tx.get(reference));
        return value.docs.get(reference.path);
    }
    function boundedTime(){const time=now();if(!Number.isSafeInteger(time)||time<1)fail("internal","Server Patrol clock is unavailable.");return time;}
    function intent(kind,input){
        const extra=kind==="issue"?["triggerEntryId",...(input?.availableEntryIds===undefined?[]:["availableEntryIds"])]:
            kind==="member"?["ticketId","memberIndex"]:kind==="terminal"?["ticketId","kind"]:["ticketId"];
        if(!input||Object.keys(input).sort().join("|")!==["operationId","expectedRevision",...extra].sort().join("|")||
           !ID.test(input.operationId||"")||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<2||
           (kind!=="issue"&&!ID.test(input.ticketId||""))||
           (kind==="member"&&(!Number.isSafeInteger(input.memberIndex)||input.memberIndex<0||input.memberIndex>2))||
           (kind==="terminal"&&!["win","loss","escape"].includes(input.kind))){
            fail("invalid-argument","Only an enumerated online Patrol intent is accepted.");
        }
        if(kind==="issue")return {action:"issue",...clone(input),availableEntryIds:input.availableEntryIds??catalog.zones.forest.mapEntries.map(row=>row.entryId)};
        return {action:kind,...clone(input)};
    }
    async function collisions(tx,root,id){
        const names=["operations","ledgerEntries","grantOperations","modeTimeEvents","simulatedAdSources",
            "patrolTickets","patrolTicketStates","patrolSettlements","patrolClosures"];
        const rows=await Promise.all(names.map(name=>read(tx,ref(root,name,id))));
        if(rows.some(row=>row.exists))fail("failed-precondition","Patrol operation ID is already used.");
    }
    async function archived(tx,root,uid,revision,hash){
        const [snapshot,archive]=await Promise.all([
            read(tx,ref(root,"playableSnapshots",String(revision))),read(tx,ref(root,"recoveryArchives",String(revision)))]);
        try{
            if(!snapshot.exists||!archive.exists||snapshot.get("sha256")!==hash)throw Error("Missing original snapshot");
            return inspectRecoveryArchive(archive.data(),uid,revision,snapshot.data());
        }catch(_){fail("data-loss","Original Patrol snapshot or recovery archive is inconsistent.");}
    }
    async function current(tx,root,uid,expectedRevision=null){
        const envelopeRef=db.collection("users").doc(uid).collection("saves").doc("current");
        const [envelopeSnap,...singleSnaps]=await Promise.all([read(tx,envelopeRef),
            ...Object.values(SINGLE).map(name=>read(tx,ref(root,name,"current")))]);
        if(!envelopeSnap.exists||singleSnaps.some(row=>!row.exists))fail("failed-precondition","Complete canonical Patrol sources are required.");
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=singleSnaps[0].data();
        if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||account.ownerUid!==uid||
           account.provenance!=="server-created"||account.slots?.length!==3||typeof account.slots[0]!=="string"||
           !Number.isSafeInteger(account.serverRevision)||
           account.serverRevision<2||account.serverRevision>envelope.serverRevision){
            fail("failed-precondition","Unpublished canonical Patrol sources are required.");
        }
        if(expectedRevision!==null&&expectedRevision!==envelope.serverRevision)fail("aborted","CLOUD_REVISION_CONFLICT");
        // A sibling may reject while readOwnedSources still has sequential
        // transaction reads to issue. Drain all three before allowing the SDK
        // to roll back; keep Promise.all's first rejection object unchanged.
        let readFailed=false,firstReadError;
        const completed=await Promise.allSettled([
            readCharacterSources(cache(tx).proxy,root,account,fail),readOwnedSources(tx,root,fail),
            archived(tx,root,uid,account.serverRevision,account.snapshotSha256)].map(promise=>
                promise.catch(error=>{
                    if(!readFailed){readFailed=true;firstReadError=error;}
                    throw error;
                })));
        if(readFailed)throw firstReadError;
        const [characters,owned,original]=completed.map(result=>result.value);
        const records={...owned.records,characters:characters.records,
            ...Object.fromEntries(Object.keys(SINGLE).map((key,index)=>[key,source(singleSnaps[index].data())]))};
        const snapshot=await read(tx,ref(root,"playableSnapshots",String(account.serverRevision)));
        try{verifyCanonicalSnapshotAgainstSources(snapshot.data(),uid,account.serverRevision,records);}
        catch(_){fail("data-loss","Canonical Patrol source differs from its snapshot.");}
        if(!same(records,original))fail("data-loss","Canonical Patrol sources differ from their recovery archive.");
        validateBag(records.inventory);
        return {envelope,envelopeRef,account,records,owned,sourceSnapshotSha256:account.snapshotSha256};
    }
    async function replayAccount(tx,root,uid){
        const [envelopeSnap,accountSnap]=await Promise.all([
            read(tx,db.collection("users").doc(uid).collection("saves").doc("current")),
            read(tx,ref(root,"account","current"))]);
        if(!envelopeSnap.exists||!accountSnap.exists)fail("data-loss","Patrol replay account is missing.");
        const envelope=inspectExistingEnvelope(envelopeSnap.data(),uid),account=accountSnap.data();
        if(envelope.kind!=="current"||envelope.data.authoritativeStateReady!==false||
           account.ownerUid!==uid||account.provenance!=="server-created")fail("data-loss","Patrol replay identity differs.");
        return {account,maxEnvelopeRevision:envelope.serverRevision};
    }
    function validateBag(inventory){
        if(!Array.isArray(inventory)||inventory.filter(row=>row.location==="bag").length>stackPolicy.constants.maxEntries||
           inventory.some(row=>!Number.isSafeInteger(row.state?.count)||row.state.count<1||
               row.state.count>stackPolicy.constants.maxStack))fail("data-loss","Canonical Patrol inventory count or capacity is invalid.");
    }
    async function initialLineage(tx,root,uid,records){
        if(records.progress.dailyQuestState.date!==""&&records.progress.commissionQuestState.date!=="")return false;
        const id=records.account.slots[0].slice("character-".length);
        if(records.account.slots[0]!==`character-${id}`||!ID.test(id))fail("data-loss","Initial Patrol quest lineage is absent.");
        const receipt=await read(tx,ref(root,"operations",id));
        if(!receipt.exists)fail("data-loss","Original character receipt is missing.");
        await sourceOwner.verifyRetainedOperation(cache(tx).proxy,root,uid,records.account,{id,data:()=>receipt.data()});
        const originalArchive=await read(tx,ref(root,"recoveryArchives",String(receipt.get("sourceRevision"))));
        const original=originalArchive.get("sourceRecords");
        for(const key of ["dailyQuestState","commissionQuestState"]){
            if(records.progress[key].date===""&&!same(records.progress[key],original.progress[key])){
                fail("data-loss","Initial Patrol quest counters differ from their creation evidence.");
            }
        }
        return true;
    }
    function baseState(core){return seal({schemaVersion:1,kind:"forest-patrol-ticket-state",ownerUid:core.ownerUid,
        ticketId:core.ticketId,ticketSha256:core.sha256,sessionId:core.sessionId,status:"pending",sequence:0,
        nextExpectedRevision:core.envelopeRevision,settledMembers:[],memberOperations:[],terminalOperationId:null,
        terminalKind:null,lastOperationId:core.ticketId});}
    function stateAfter(before,request,resultRevision){
        const value=strip(before);value.sequence++;
        value.lastOperationId=request.operationId;
        if(request.action==="member"){
            value.settledMembers=[...before.settledMembers,request.memberIndex];
            value.memberOperations=[...before.memberOperations,request.operationId];
            value.nextExpectedRevision=resultRevision;
        }else{
            value.status=request.action==="abandon"?"abandoned":"closed";
            value.terminalOperationId=request.operationId;value.terminalKind=request.action==="abandon"?"abandoned":request.kind;
            if(request.action!=="abandon")value.nextExpectedRevision=resultRevision;
        }
        return seal(value);
    }
    function validateState(state,core){
        if(!state||state.schemaVersion!==1||state.kind!=="forest-patrol-ticket-state"||state.ownerUid!==core.ownerUid||
           state.ticketId!==core.ticketId||state.ticketSha256!==core.sha256||state.sessionId!==core.sessionId||
           !["pending","closed","abandoned"].includes(state.status)||!Number.isSafeInteger(state.sequence)||
           state.sequence<0||state.sequence>core.members.length+1||!Number.isSafeInteger(state.nextExpectedRevision)||
           state.nextExpectedRevision<core.envelopeRevision||!Array.isArray(state.settledMembers)||
           !Array.isArray(state.memberOperations)||state.memberOperations.length!==state.settledMembers.length||
           state.settledMembers.length>core.members.length||new Set(state.settledMembers).size!==state.settledMembers.length||
           new Set(state.memberOperations).size!==state.memberOperations.length||
           state.settledMembers.some(index=>!Number.isSafeInteger(index)||index<0||index>=core.members.length)||
           state.memberOperations.some(id=>!ID.test(id))||state.sha256!==snapshotDigest(strip(state))){
            fail("data-loss","Patrol ticket checkpoint is inconsistent.");
        }
    }
    async function coreProof(tx,root,uid,ticketId,account,maxEnvelopeRevision){
        const store=cache(tx),key=`${ticketId}:${account.serverRevision}:${maxEnvelopeRevision}`;
        if(store.cores.has(key))return store.cores.get(key);
        const snap=await read(tx,ref(root,"patrolTickets",ticketId));
        const core=snap.data();
        if(!snap.exists||!core||core.schemaVersion!==1||core.kind!=="forest-patrol-ticket"||core.ownerUid!==uid||
           core.ticketId!==ticketId||!ID.test(ticketId)||core.issueIntent?.operationId!==ticketId||
           core.issueIntent.action!=="issue"||core.issueIntent.expectedRevision!==core.envelopeRevision||
           !Number.isSafeInteger(core.sourceRevision)||core.sourceRevision<2||
           !Number.isSafeInteger(core.envelopeRevision)||core.envelopeRevision<core.sourceRevision||
           core.envelopeRevision>maxEnvelopeRevision||core.sourceRevision>account.serverRevision||
           !Number.isSafeInteger(core.issuedAtMs)||core.issuedAtMs<1||
           !/^[A-Za-z0-9_-]{32}$/.test(core.sessionId||"")||
           core.expiryPolicy!=="active-session-and-expected-revision-only"||
           core.policyId!==patrolPolicyCertificate.policyId||core.policySha256!==policySha256||
           core.outcomeVerified!==false||core.rewardEligible!==false||
           core.sha256!==snapshotDigest(strip(core))||!Array.isArray(core.samples)||core.samples.length>25){
            fail("data-loss","Original Patrol ticket core is inconsistent.");
        }
        let cursor=0,expected;
        try{expected=preparePatrolMembers(core.issueIntent,()=>core.samples[cursor++]);}
        catch(_){fail("data-loss","Original Patrol source selection is invalid.");}
        if(cursor!==core.samples.length||!same(expected,core.members))fail("data-loss","Original Patrol reward plans differ.");
        const original=await archived(tx,root,uid,core.sourceRevision,core.sourceSnapshotSha256);
        if(original.account.slots[0]!==core.characterId||account.slots[0]!==core.characterId||
           original.characters[0].state.level<catalog.zones.forest.requiredLevel){
            fail("data-loss","Original Patrol character or access evidence differs.");
        }
        store.cores.set(key,core);return core;
    }
    function project(before,core,request,observedAtMs,modeState,mode,initialLineageVerified,resultRevision){
        validateBag(before.inventory);
        const owned=advanceOwnedRecords(clone(before),resultRevision),inventory=owned.inventory;
        const reward={gold:0,exp:0,drops:[]};
        if(request.action==="member"){
            const member=core.members[request.memberIndex];reward.gold=member.gold;
            for(let ordinal=0;ordinal<member.drops.length;ordinal++){
                const drop=member.drops[ordinal],definition=items.items[drop.itemId];
                if(!definition||drop.quantity!==1)fail("data-loss","Unsupported canonical Patrol drop definition.");
                const bag=inventory.map((row,index)=>({row,index})).filter(({row})=>row.location==="bag");
                const plan=stackPolicy.plan(bag.map(({row})=>row.state),drop.itemId,drop.quantity);
                reward.drops.push({itemId:drop.itemId,quantity:drop.quantity,accepted:plan.success});
                if(!plan.success)continue;
                for(const update of plan.updates){
                    const state=inventory[bag[update.index].index].state;
                    state.count=update.count;
                    if(definition.type==="ticket")for(const key of ["name","icon","type","setId","price"])state[key]=definition[key];
                }
                for(let index=0;index<plan.appendCounts.length;index++){
                    const ownedItemId="patrol-"+snapshotDigest({uid:core.ownerUid,ticketId:core.ticketId,
                        memberIndex:request.memberIndex,ordinal,index});
                    if(inventory.some(row=>row.ownedItemId===ownedItemId))fail("data-loss","Patrol owned-item identity is already used.");
                    inventory.push({schemaVersion:1,ownerUid:core.ownerUid,serverRevision:resultRevision,
                        provenance:"server-created",ownedItemId,location:"bag",state:{...clone(definition),count:plan.appendCounts[index]}});
                }
            }
        }else if(request.kind==="win"){
            try{reward.exp=patrolVictoryExp(core.members,before.characters.map(row=>row.state),mode);}
            catch(_){fail("data-loss","Canonical Patrol EXP inputs are unsupported.");}
        }
        if(!Number.isSafeInteger(reward.gold)||reward.gold<0||!Number.isSafeInteger(reward.exp)||reward.exp<0||
           before.economy.gold>Number.MAX_SAFE_INTEGER-reward.gold||before.economy.sharedExp>Number.MAX_SAFE_INTEGER-reward.exp){
            fail("failed-precondition","Patrol balance exceeds its safe range.");
        }
        const member=request.action==="member"?core.members[request.memberIndex]:null;
        const identity=member?Object.fromEntries(["entryId","name","level","element","monsterKey","context","rank"]
            .map(key=>[key,member[key]])):undefined;
        let progressed;
        try{progressed=applyPatrolProgress(before,{kind:request.action==="member"?"member":request.kind,
            ...(member?{member:identity}:{}),serverNow:observedAtMs,initialLineageVerified});}
        catch(_){fail("data-loss","Canonical Patrol progress cannot be reconciled.");}
        const progress={...progressed.progress,serverRevision:resultRevision,sidecars:{...progressed.progress.sidecars}};
        for(const [key,name] of [["elementBox","element-box-state"],["rested","rested-exp-state"]]){
            if(!same(JSON.parse(progress.sidecars[name].raw),modeState[key]))progress.sidecars[name]={status:"present",raw:JSON.stringify(modeState[key])};
        }
        const records={...before,...owned,inventory,
            account:{...before.account,serverRevision:resultRevision},
            characters:before.characters.map(row=>({...row,serverRevision:resultRevision})),
            economy:{...before.economy,serverRevision:resultRevision,gold:before.economy.gold+reward.gold,
                sharedExp:before.economy.sharedExp+reward.exp},
            progress,relicLoadout:{...before.relicLoadout,serverRevision:resultRevision},
            claimCheckpoint:{...before.claimCheckpoint,serverRevision:resultRevision,
                claimDigest:claimRecordsDigest(owned.claimRecords)}};
        return {records,reward,progressEvidence:progressed.transitionEvidence};
    }
    function coreSettlement(record){
        return {schemaVersion:1,ownerUid:record.ownerUid,operationId:record.operationId,intent:record.intent,
            ticketSha256:record.ticketSha256,sourceRevision:record.sourceRevision,envelopeRevision:record.envelopeRevision,
            resultRevision:record.resultRevision,resultEnvelopeRevision:record.resultEnvelopeRevision,
            sourceSnapshotSha256:record.sourceSnapshotSha256,resultSnapshotSha256:record.resultSnapshotSha256,
            observedAtMs:record.observedAtMs,reward:record.reward,progressEvidence:record.progressEvidence,
            ticketBeforeSha256:record.ticketBefore.sha256,ticketAfterSha256:record.ticketAfter.sha256,
            mode:record.mode,modeDelta:record.modeDelta};
    }
    function receiptFor(record){
        return {schemaVersion:1,kind:KIND,ownerUid:record.ownerUid,operationId:record.operationId,
            ticketId:record.ticketId,intentSha256:snapshotDigest(record.intent),eventSha256:record.sha256,
            sourceRevision:record.sourceRevision,envelopeRevision:record.envelopeRevision,
            resultRevision:record.resultRevision,resultEnvelopeRevision:record.resultEnvelopeRevision,
            snapshotSha256:record.resultSnapshotSha256,sourceSnapshotSha256:record.sourceSnapshotSha256,
            modeEventSha256:record.modeEventSha256,modeHeadSha256:record.modeHeadSha256,
            settlementCoreSha256:record.settlementCoreSha256,outcomeVerified:false,authoritativeStateReady:false};
    }
    function ledgerFor(record,before,after){
        return {...receiptFor(record),modeDelta:record.modeDelta,reward:record.reward,
            goldBefore:before.economy.gold,goldAfter:after.economy.gold,
            expBefore:before.economy.sharedExp,expAfter:after.economy.sharedExp,
            inventoryBeforeSha256:snapshotDigest(before.inventory),inventoryAfterSha256:snapshotDigest(after.inventory),
            progressBeforeSha256:snapshotDigest(before.progress),progressAfterSha256:snapshotDigest(after.progress)};
    }
    async function checkpointBefore(tx,root,uid,core,state,account,maxEnvelopeRevision){
        validateState(state,core);
        if(state.status!=="pending"||state.sequence!==state.settledMembers.length||state.terminalOperationId!==null||
           state.terminalKind!==null)fail("data-loss","A Patrol settlement requires its original pending checkpoint.");
        if(state.sequence===0){
            if(!same(state,baseState(core)))fail("data-loss","Original Patrol issue checkpoint differs.");
        }else{
            if(state.lastOperationId!==state.memberOperations.at(-1))fail("data-loss","Patrol predecessor identity differs.");
            const previous=await settlementProof(tx,root,uid,state.lastOperationId,account,maxEnvelopeRevision);
            if(previous.record.intent.action!=="member"||!same(previous.record.ticketAfter,state)){
                fail("data-loss","Patrol checkpoint lost its original member settlement.");
            }
        }
    }
    async function settlementProof(tx,root,uid,operationId,account,maxEnvelopeRevision){
        const store=cache(tx),key=`${operationId}:${account.serverRevision}:${maxEnvelopeRevision}`;
        if(store.settlements.has(key))return store.settlements.get(key);
        if(store.active.has(operationId))fail("data-loss","Patrol settlement history is cyclic.");
        store.active.add(operationId);
        try{
            const [recordSnap,operationSnap,ledgerSnap,modeSnap,grantSnap]=await Promise.all([
                read(tx,ref(root,"patrolSettlements",operationId)),read(tx,ref(root,"operations",operationId)),
                read(tx,ref(root,"ledgerEntries",operationId)),read(tx,ref(root,"modeTimeEvents",operationId)),
                read(tx,ref(root,"grantOperations",operationId))]);
            const record=recordSnap.data();
            if(!recordSnap.exists||!operationSnap.exists||!ledgerSnap.exists||!modeSnap.exists||grantSnap.exists||
               record?.schemaVersion!==1||record.kind!=="forest-patrol-settlement-evidence"||record.ownerUid!==uid||
               record.operationId!==operationId||!ID.test(operationId)||!ID.test(record.ticketId||"")||
               !["member","terminal"].includes(record.intent?.action)||record.intent.ownerUid!==uid||
               record.intent.ticketId!==record.ticketId||record.intent.operationId!==operationId||
               record.intent.expectedRevision!==record.envelopeRevision||
               !Number.isSafeInteger(record.sourceRevision)||record.sourceRevision<2||
               !Number.isSafeInteger(record.envelopeRevision)||record.envelopeRevision<record.sourceRevision||
               record.resultRevision!==record.envelopeRevision+1||record.resultEnvelopeRevision!==record.resultRevision||
               record.resultRevision>account.serverRevision||record.resultEnvelopeRevision>maxEnvelopeRevision||
               !Number.isSafeInteger(record.observedAtMs)||record.observedAtMs<1||
               record.outcomeVerified!==false||record.authoritativeStateReady!==false||
               record.sha256!==snapshotDigest(strip(record))||
               record.settlementCoreSha256!==snapshotDigest(coreSettlement(record))){
                fail("data-loss","Retained Patrol settlement evidence is incomplete or corrupt.");
            }
            // Validate the stored intent with the same strict admission shape.
            const {action,ownerUid,...raw}=record.intent;
            if(!same({...intent(action,raw),ownerUid:uid},record.intent))fail("data-loss","Retained Patrol intent differs.");
            const core=await coreProof(tx,root,uid,record.ticketId,account,maxEnvelopeRevision);
            if(record.ticketSha256!==core.sha256||record.sessionId!==core.sessionId||
               record.observedAtMs<core.issuedAtMs||record.ticketBefore.nextExpectedRevision!==record.envelopeRevision){
                fail("data-loss","Retained Patrol source binding differs.");
            }
            await checkpointBefore(tx,root,uid,core,record.ticketBefore,account,maxEnvelopeRevision);
            admitSettlement(core,record.ticketBefore,record.intent);
            const [before,after]=await Promise.all([
                archived(tx,root,uid,record.sourceRevision,record.sourceSnapshotSha256),
                archived(tx,root,uid,record.resultRevision,record.resultSnapshotSha256)]);
            const modeEvent=modeSnap.data();
            if(modeEvent.sha256!==record.modeEventSha256||modeEvent.headSha256!==record.modeHeadSha256||
               modeEvent.intent.sourceId!==record.ticketId||modeEvent.intent.settlementKind!==
                   (record.intent.action==="member"?"member":record.intent.kind)||
               modeEvent.intent.memberIndex!==(record.intent.action==="member"?record.intent.memberIndex:null)||
               modeEvent.observedAtMs!==record.observedAtMs||modeEvent.settlementCoreSha256!==record.settlementCoreSha256||
               modeEvent.sessionId!==record.sessionId){fail("data-loss","Retained Patrol mode source differs.");}
            const component=await modeOwner.verifyPatrolModeComponent(store.proxy,root,uid,account,modeEvent,
                operationSnap.data(),ledgerSnap.data(),maxEnvelopeRevision);
            if(!same(component.mode,record.mode)||!same(component.delta,record.modeDelta))fail("data-loss","Retained Patrol mode delta differs.");
            const lineage=await initialLineage(tx,root,uid,before);
            const rebuilt=project(before,core,record.intent,record.observedAtMs,component.modeState,component.mode,lineage,record.resultRevision);
            if(!same(rebuilt.records,after)||!same(rebuilt.reward,record.reward)||
               !same(rebuilt.progressEvidence,record.progressEvidence)||
               !same(stateAfter(record.ticketBefore,record.intent,record.resultRevision),record.ticketAfter)||
               !same(strip(operationSnap.data()),receiptFor(record))||
               !same(strip(ledgerSnap.data()),ledgerFor(record,before,after))){
                fail("data-loss","Retained Patrol balance, inventory, progress or checkpoint delta differs.");
            }
            const result={record,core,before,after,modeEvent,
                verifiedOperationIds:[...record.ticketBefore.memberOperations,operationId]};
            store.settlements.set(key,result);return result;
        }finally{store.active.delete(operationId);}
    }
    async function verifyPatrolSettlementEvidence({tx,root,uid,account,event,receipt,ledger,
        maxEnvelopeRevision=account.serverRevision}){
        const result=await settlementProof(tx,root,uid,event?.operationId,account,maxEnvelopeRevision);
        if(!same(result.modeEvent,event)||!same(strip(receipt),receiptFor(result.record))||
           !same(strip(ledger),ledgerFor(result.record,result.before,result.after))){
            fail("data-loss","Patrol source-specific dispatch proof differs.");
        }
        return result;
    }
    function admitSettlement(core,state,request){
        if(state.status!=="pending")fail("failed-precondition","Patrol ticket is already closed.");
        if(request.action==="member"){
            if(request.memberIndex>=core.members.length||state.settledMembers.includes(request.memberIndex)){
                fail("failed-precondition","Patrol member is unknown or already settled.");
            }
        }else if(request.kind==="win"&&state.settledMembers.length!==core.members.length){
            fail("failed-precondition","A Patrol win requires every issued member settlement.");
        }
    }
    async function closureProof(tx,root,uid,operationId,account,maxEnvelopeRevision){
        const recordSnap=await read(tx,ref(root,"patrolClosures",operationId)),record=recordSnap.data();
        if(!recordSnap.exists||record?.schemaVersion!==1||record.kind!=="forest-patrol-abandon"||record.ownerUid!==uid||
           record.operationId!==operationId||record.intent?.operationId!==operationId||record.intent.action!=="abandon"||
           record.intent.ownerUid!==uid||record.intent.ticketId!==record.ticketId||
           !Number.isSafeInteger(record.intent.expectedRevision)||record.intent.expectedRevision>maxEnvelopeRevision||
           !Number.isSafeInteger(record.observedAtMs)||record.observedAtMs<1||
           record.sha256!==snapshotDigest(strip(record))){fail("data-loss","Retained Patrol abandonment is inconsistent.");}
        const core=await coreProof(tx,root,uid,record.ticketId,account,maxEnvelopeRevision);
        await checkpointBefore(tx,root,uid,core,record.ticketBefore,account,maxEnvelopeRevision);
        if(record.observedAtMs<core.issuedAtMs||!same(record.ticketAfter,stateAfter(record.ticketBefore,record.intent,null))){
            fail("data-loss","Patrol abandonment checkpoint differs.");
        }
        const [economic,ledger,mode]=await Promise.all([read(tx,ref(root,"operations",operationId)),
            read(tx,ref(root,"ledgerEntries",operationId)),read(tx,ref(root,"modeTimeEvents",operationId))]);
        if(economic.exists||ledger.exists||mode.exists)fail("data-loss","Patrol abandonment overlaps an economic operation.");
        return {record,core,verifiedOperationIds:[...record.ticketBefore.memberOperations]};
    }
    async function verifyRetainedTicket(tx,root,uid,account,row,maxEnvelopeRevision=account.serverRevision){
        const ticketId=row.id,core=await coreProof(tx,root,uid,ticketId,account,maxEnvelopeRevision);
        if(!same(row.data(),(await read(tx,ref(root,"patrolTickets",ticketId))).data()))fail("data-loss","Retained Patrol ticket row differs.");
        const stateSnap=await read(tx,ref(root,"patrolTicketStates",ticketId));
        if(!stateSnap.exists)fail("data-loss","Retained Patrol ticket lost its checkpoint.");
        const state=clean(stateSnap.data());
        validateState(state,core);
        let verifiedOperationIds=[];
        if(state.status==="pending"){
            await checkpointBefore(tx,root,uid,core,state,account,maxEnvelopeRevision);
            const marker=(await read(tx,ref(root,"patrol","current"))).data();
            if(!marker||marker.ticketId!==ticketId||marker.ticketStateSha256!==state.sha256||marker.status!=="pending"){
                fail("data-loss","Pending Patrol ticket lost its unique active marker.");
            }
            verifiedOperationIds=[...state.memberOperations];
        }else{
            if(!ID.test(state.terminalOperationId||""))fail("data-loss","Patrol closure identity is missing.");
            const proof=state.status==="abandoned"?await closureProof(tx,root,uid,state.terminalOperationId,account,maxEnvelopeRevision):
                await settlementProof(tx,root,uid,state.terminalOperationId,account,maxEnvelopeRevision);
            if(!same(proof.record.ticketAfter,state))fail("data-loss","Patrol final checkpoint differs from its retained closure.");
            verifiedOperationIds=proof.verifiedOperationIds;
        }
        return {ticketId,core,state,verifiedOperationIds};
    }
    async function activeTicket(tx,root,uid,account,maxEnvelopeRevision){
        const markerSnap=await read(tx,ref(root,"patrol","current"));
        if(!markerSnap.exists){
            const histories=await Promise.all(["patrolTickets","patrolTicketStates","patrolSettlements","patrolClosures"]
                .map(name=>tx.get(root.collection(name).limit(1))));
            if(histories.some(rows=>rows.docs.length))fail("data-loss","Patrol sources lost their active-account marker.");
            return null;
        }
        const marker=markerSnap.data();
        if(marker.schemaVersion!==1||marker.ownerUid!==uid||!ID.test(marker.ticketId||"")){
            fail("data-loss","Patrol account marker is inconsistent.");
        }
        const coreSnap=await read(tx,ref(root,"patrolTickets",marker.ticketId));
        const proof=await verifyRetainedTicket(tx,root,uid,account,{id:marker.ticketId,data:()=>coreSnap.data()},maxEnvelopeRevision);
        if(marker.ticketStateSha256!==proof.state.sha256||marker.status!==proof.state.status){
            fail("data-loss","Patrol account marker differs from its source checkpoint.");
        }
        return proof;
    }
    function marker(uid,state){return {schemaVersion:1,ownerUid:uid,ticketId:state.ticketId,
        ticketStateSha256:state.sha256,status:state.status};}
    function result(record,unchanged){return {operationId:record.operationId,ticketId:record.ticketId,
        resultRevision:record.resultEnvelopeRevision,canonicalRevision:record.resultRevision,
        kind:record.intent.action==="member"?"member":record.intent.kind,
        memberIndex:record.intent.action==="member"?record.intent.memberIndex:null,
        reward:clone(record.reward),unchanged,outcomeVerified:false,authoritativeStateReady:false};}
    async function issueTicket(request,input){
        const parsed=intent("issue",input),time=boundedTime();
        let members,samples=[];
        // Pin the entire entropy pool before runProtected retries. No browser
        // entropy/seed, in-transaction draw, reroll or gameplay daily cap exists.
        const bytes=entropy(150);let cursor=0;
        if(!Buffer.isBuffer(bytes)||bytes.length!==150)fail("internal","Server Patrol entropy is unavailable.");
        try{members=preparePatrolMembers(parsed,()=>{const value=bytes.readUIntBE(cursor++*6,6)/281474976710656;samples.push(value);return value;});}
        catch(_){fail("invalid-argument","Unsupported Forest source selection.");}
        return runEvidenceAttempt(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid),ticketId=parsed.operationId;
            const issued=await read(tx,ref(root,"patrolTickets",ticketId));
            const issueIntent={...parsed,ownerUid:uid};
            if(issued.exists){
                if(!same(issued.get("issueIntent"),issueIntent))fail("data-loss","Patrol issue ID overlaps another intent.");
                const identity=await replayAccount(tx,root,uid);
                const proof=await verifyRetainedTicket(tx,root,uid,identity.account,
                    {id:ticketId,data:()=>issued.data()},identity.maxEnvelopeRevision);
                return {ticketId,members:publicMembers(proof.core.members),resultRevision:proof.core.envelopeRevision,
                    unchanged:true,outcomeVerified:false,rewardEligible:false,authoritativeStateReady:false};
            }
            await collisions(tx,root,ticketId);
            const context=await current(tx,root,uid,parsed.expectedRevision);
            const active=await activeTicket(tx,root,uid,context.account,context.envelope.serverRevision);
            if(active?.state.status==="pending")fail("failed-precondition","Abandon the pending Patrol source before issuing another.");
            await modeOwner.readSettlementMode(tx,root,uid,session,context.account,context.records,context.envelope.serverRevision);
            if(context.records.characters[0].state.level<catalog.zones.forest.requiredLevel){
                fail("failed-precondition","The canonical character cannot access Forest.");
            }
            const core=seal({schemaVersion:1,kind:"forest-patrol-ticket",ownerUid:uid,ticketId,
                issueIntent,sessionId:session.sessionId,characterId:context.account.slots[0],issuedAtMs:time,
                sourceRevision:context.account.serverRevision,envelopeRevision:parsed.expectedRevision,
                sourceSnapshotSha256:context.sourceSnapshotSha256,policyId:patrolPolicyCertificate.policyId,policySha256,samples,members,
                expiryPolicy:"active-session-and-expected-revision-only",outcomeVerified:false,rewardEligible:false});
            const state=baseState(core),stamp=FieldValue.serverTimestamp();
            tx.create(ref(root,"patrolTickets",ticketId),{...core,createdAt:stamp});
            tx.create(ref(root,"patrolTicketStates",ticketId),{...state,updatedAt:stamp});
            tx.set(ref(root,"patrol","current"),{...marker(uid,state),updatedAt:stamp});
            return {ticketId,members:publicMembers(core.members),resultRevision:parsed.expectedRevision,
                unchanged:false,outcomeVerified:false,rewardEligible:false,authoritativeStateReady:false};
        });
    }
    async function settle(request,action,input){
        const parsed=intent(action,input),time=boundedTime();
        return runEvidenceAttempt(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid),requestIntent={...parsed,ownerUid:uid};
            const original=await read(tx,ref(root,"patrolSettlements",parsed.operationId));
            if(original.exists){
                if(!same(original.get("intent"),requestIntent))fail("data-loss","Patrol settlement ID overlaps another intent.");
                const identity=await replayAccount(tx,root,uid);
                const proof=await settlementProof(tx,root,uid,parsed.operationId,identity.account,identity.maxEnvelopeRevision);
                return result(proof.record,true);
            }
            await collisions(tx,root,parsed.operationId);
            const context=await current(tx,root,uid,parsed.expectedRevision);
            const active=await activeTicket(tx,root,uid,context.account,context.envelope.serverRevision);
            if(!active||active.core.ticketId!==parsed.ticketId||active.state.status!=="pending"){
                fail("failed-precondition","The issued Patrol source is not pending.");
            }
            const {core,state}=active;
            if(core.sessionId!==session.sessionId)fail("permission-denied","Patrol source belongs to its creation session.");
            if(state.nextExpectedRevision!==parsed.expectedRevision)fail("aborted","PATROL_SOURCE_REVISION_CONFLICT");
            if(time<core.issuedAtMs)fail("failed-precondition","Server time precedes the issued Patrol source.");
            admitSettlement(core,state,requestIntent);
            const resultRevision=nextRevision(context.envelope);
            if(!Number.isSafeInteger(resultRevision)||resultRevision!==parsed.expectedRevision+1){
                fail("failed-precondition","Patrol revision exceeds its safe range.");
            }
            const modeHead=await read(tx,ref(root,"modeTime","current"));
            if(!modeHead.exists)fail("failed-precondition","A canonical Patrol mode is required.");
            const plan=await modeOwner.preparePatrolSettlement(tx,{root,uid,session,operationId:parsed.operationId,
                expectedRevision:parsed.expectedRevision,expectedSequence:modeHead.get("sequence"),
                sourceRecords:context.records,sourceSnapshotSha256:context.sourceSnapshotSha256,serverNow:time,
                resultRevision,settlementKind:action==="member"?"member":parsed.kind,
                memberIndex:action==="member"?parsed.memberIndex:null,sourceId:parsed.ticketId});
            const lineage=await initialLineage(tx,root,uid,context.records);
            const next=project(context.records,core,requestIntent,time,plan.modeState,plan.mode,lineage,resultRevision);
            const newItems=next.records.inventory.filter(row=>!context.records.inventory.some(old=>old.ownedItemId===row.ownedItemId));
            if(context.owned.refs.length+newItems.length>400){
                fail("failed-precondition","Patrol owned source set exceeds the transaction budget.");
            }
            let bundle,archive;
            try{bundle=assembleCanonicalSnapshot(uid,resultRevision,next.records);
                archive=createRecoveryArchive(uid,resultRevision,next.records,bundle);}
            catch(_){fail("data-loss","The Patrol delta cannot form a complete canonical snapshot.");}
            const afterState=stateAfter(state,requestIntent,resultRevision);
            const payload={schemaVersion:1,kind:"forest-patrol-settlement-evidence",ownerUid:uid,
                operationId:parsed.operationId,ticketId:parsed.ticketId,ticketSha256:core.sha256,
                intent:requestIntent,sessionId:session.sessionId,sourceRevision:context.account.serverRevision,
                envelopeRevision:parsed.expectedRevision,resultRevision,resultEnvelopeRevision:resultRevision,
                sourceSnapshotSha256:context.sourceSnapshotSha256,resultSnapshotSha256:bundle.sha256,
                observedAtMs:time,reward:next.reward,progressEvidence:next.progressEvidence,
                ticketBefore:state,ticketAfter:afterState,mode:plan.mode,modeDelta:plan.delta,
                outcomeVerified:false,authoritativeStateReady:false};
            const settlementCoreSha256=snapshotDigest(coreSettlement(payload));
            const stamp=FieldValue.serverTimestamp();
            // Every admission/proof read has finished. Mode and the entire
            // earning delta now share this one protected Firestore transaction.
            const modeProof=modeOwner.writePatrolModeEvidence(tx,plan,{resultRecords:next.records,
                resultSnapshotSha256:bundle.sha256,settlementCoreSha256});
            const record=seal({...payload,settlementCoreSha256,modeEventSha256:modeProof.event.sha256,
                modeHeadSha256:modeProof.event.headSha256});
            for(const [name,collection] of Object.entries(SINGLE)){
                tx.update(ref(root,collection,"current"),{...next.records[name],updatedAt:stamp,
                    ...(name==="account"?{snapshotSha256:bundle.sha256}:{})});
            }
            for(const character of next.records.characters){
                tx.update(ref(root,"characters",character.characterId),{serverRevision:resultRevision,updatedAt:stamp});
            }
            advanceOwnedSources(tx,context.owned.refs,resultRevision,stamp);
            for(const item of next.records.inventory){
                if(newItems.some(row=>row.ownedItemId===item.ownedItemId)){
                    tx.create(ref(root,"inventory",item.ownedItemId),{...item,createdAt:stamp,updatedAt:stamp});
                }else if(!same(context.records.inventory.find(row=>row.ownedItemId===item.ownedItemId).state,item.state)){
                    tx.update(ref(root,"inventory",item.ownedItemId),{state:item.state,updatedAt:stamp});
                }
            }
            tx.create(ref(root,"playableSnapshots",String(resultRevision)),{...bundle,createdAt:stamp});
            tx.create(ref(root,"recoveryArchives",String(resultRevision)),{...archive,createdAt:stamp});
            tx.update(context.envelopeRef,{serverRevision:resultRevision,updatedAt:stamp});
            tx.create(ref(root,"operations",parsed.operationId),{...receiptFor(record),createdAt:stamp});
            tx.create(ref(root,"ledgerEntries",parsed.operationId),{...ledgerFor(record,context.records,next.records),createdAt:stamp});
            tx.create(ref(root,"patrolSettlements",parsed.operationId),{...record,createdAt:stamp});
            tx.update(ref(root,"patrolTicketStates",parsed.ticketId),{...afterState,updatedAt:stamp});
            tx.set(ref(root,"patrol","current"),{...marker(uid,afterState),updatedAt:stamp});
            return result(record,false);
        });
    }
    async function abandonTicket(request,input){
        const parsed=intent("abandon",input),time=boundedTime();
        return runEvidenceAttempt(request,async(tx,session)=>{
            const uid=session.uid,root=db.collection("serverUsers").doc(uid),requestIntent={...parsed,ownerUid:uid};
            const original=await read(tx,ref(root,"patrolClosures",parsed.operationId));
            if(original.exists){
                if(!same(original.get("intent"),requestIntent))fail("data-loss","Patrol abandonment ID overlaps another intent.");
                const identity=await replayAccount(tx,root,uid);
                const proof=await closureProof(tx,root,uid,parsed.operationId,identity.account,identity.maxEnvelopeRevision);
                return {ticketId:parsed.ticketId,operationId:parsed.operationId,resultRevision:proof.record.intent.expectedRevision,
                    unchanged:true,outcomeVerified:false,authoritativeStateReady:false};
            }
            await collisions(tx,root,parsed.operationId);
            const context=await current(tx,root,uid,parsed.expectedRevision);
            const active=await activeTicket(tx,root,uid,context.account,context.envelope.serverRevision);
            if(!active||active.core.ticketId!==parsed.ticketId||active.state.status!=="pending"){
                fail("failed-precondition","Only the pending Patrol source can be abandoned.");
            }
            if(time<active.core.issuedAtMs)fail("failed-precondition","Server time precedes the retained Patrol source.");
            const after=stateAfter(active.state,requestIntent,null);
            const record=seal({schemaVersion:1,kind:"forest-patrol-abandon",ownerUid:uid,
                operationId:parsed.operationId,ticketId:parsed.ticketId,intent:requestIntent,sessionId:session.sessionId,
                observedAtMs:time,ticketBefore:active.state,ticketAfter:after,outcomeVerified:false,authoritativeStateReady:false});
            const stamp=FieldValue.serverTimestamp();
            tx.create(ref(root,"patrolClosures",parsed.operationId),{...record,createdAt:stamp});
            tx.update(ref(root,"patrolTicketStates",parsed.ticketId),{...after,updatedAt:stamp});
            tx.set(ref(root,"patrol","current"),{...marker(uid,after),updatedAt:stamp});
            return {ticketId:parsed.ticketId,operationId:parsed.operationId,resultRevision:parsed.expectedRevision,
                unchanged:false,outcomeVerified:false,authoritativeStateReady:false};
        });
    }
    async function verifyRetainedSettlement(tx,root,uid,account,row,maxEnvelopeRevision=account.serverRevision){
        const proof=await settlementProof(tx,root,uid,row.id,account,maxEnvelopeRevision);
        if(!same(clean(row.data()),clean(proof.record)))fail("data-loss","Retained Patrol settlement row differs.");
        return proof;
    }
    async function verifyRetainedClosure(tx,root,uid,account,row,maxEnvelopeRevision=account.serverRevision){
        const proof=await closureProof(tx,root,uid,row.id,account,maxEnvelopeRevision);
        if(!same(clean(row.data()),clean(proof.record)))fail("data-loss","Retained Patrol closure row differs.");
        return proof;
    }
    async function verifyCurrentEvidence(tx,root,uid,account,maxEnvelopeRevision=account.serverRevision){
        return activeTicket(tx,root,uid,account,maxEnvelopeRevision);
    }
    // Includes the entire maximum three-member + terminal chain. All retained
    // readers share the same transaction-local immutable point-read/proof cache.
    const retainedTicketReadBudget=()=>60,retainedSettlementReadBudget=()=>60,
        retainedClosureReadBudget=()=>60,currentEvidenceReadBudget=()=>64;
    return Object.freeze({issueTicket,settleMember:(request,input)=>settle(request,"member",input),
        settleTerminal:(request,input)=>settle(request,"terminal",input),abandonTicket,
        verifyPatrolSettlementEvidence,verifyRetainedTicket,verifyRetainedSettlement,verifyRetainedClosure,
        verifyCurrentEvidence,retainedTicketReadBudget,retainedSettlementReadBudget,retainedClosureReadBudget,
        currentEvidenceReadBudget,patrolSettlementEvidenceReadBudget:60,beginEvidenceAttempt,modeOwner,
        observePresence:modeOwner.observePresence,beginSimulatedAd:modeOwner.beginSimulatedAd,
        completeSimulatedAd:modeOwner.completeSimulatedAd,abandonSimulatedAd:modeOwner.abandonSimulatedAd});
}

module.exports={createCanonicalPatrolSettlement,patrolPolicyCertificate};
