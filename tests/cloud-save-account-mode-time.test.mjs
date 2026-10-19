import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,Timestamp,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';

const require=createRequire(import.meta.url);
const {createCanonicalAccountModeTime}=require('../functions/src/canonical-account-mode-time.js');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition.js');
const {assembleCanonicalSnapshot,claimRecordsDigest,snapshotDigest}=require('../functions/src/canonical-snapshot.js');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive.js');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval.js');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery.js');
async function seeded(){
    const h=storeHarness();
    await h.initial.commitInitialSources(h.request(),{operationId:'mode-time-initial-0001',expectedRevision:1,selection});
    assert.equal(h.revision,2);
    h.owner=createCanonicalAccountModeTime(h.dependencies);
    return h;
}
function snapshot(h){return copy([...h.data]);}
async function refuses(h,operation,pattern){
    const before=snapshot(h),writes=h.writes,commits=h.commits;
    await assert.rejects(operation,pattern);
    assert.deepEqual(snapshot(h),before);assert.equal(h.writes,writes);assert.equal(h.commits,commits);
}
let serial=0;
function args(h,extra={}){
    return {operationId:`mode-time-test-${String(++serial).padStart(6,'0')}`,expectedRevision:h.revision,
        expectedSequence:h.data.get(h.root+'/modeTime/current')?.sequence??0,...extra};
}
function presence(h,intent='reopen',elementBox='keep',extra={}){
    return h.owner.observePresence(h.request(),args(h,{intent,elementBox,...extra}));
}
function count(h,name){return [...h.data.keys()].filter(key=>key.startsWith(h.root+'/'+name+'/')).length;}
async function grant(h){
    const begun=await h.owner.beginSimulatedAd(h.request(),args(h));h.advance(3000);
    const intent=args(h,{sourceId:begun.sourceId});
    const result=await h.owner.completeSimulatedAd(h.request(),intent);
    return {begun,intent,result};
}

test('repeatable presence records stay private until actual offline rested accrual, preserving every canonical proof',async()=>{
    const h=await seeded(),initial=snapshot(h);
    const resumed=await presence(h);assert.equal(resumed.resultRevision,2);assert.equal(resumed.presence,'foreground');
    for(let i=0;i<4;i++){h.advance(30000);await presence(h,'heartbeat');}
    assert.equal(count(h,'operations'),1);assert.equal(count(h,'ledgerEntries'),0);
    assert.equal(count(h,'playableSnapshots'),1);assert.equal(h.revision,2);
    await presence(h,'rest');h.advance(120001);
    const accrued=await presence(h,'resume');
    assert.equal(accrued.modeState.rested.battles,1);assert.equal(accrued.resultRevision,3);
    await presence(h,'rest');h.advance(120000);const next=await presence(h,'resume');
    assert.equal(next.modeState.rested.battles,2);assert.equal(next.resultRevision,4);
    assert.equal(count(h,'ledgerEntries'),2);
    for(const [path,row] of initial){
        if(/\/(operations|playableSnapshots|recoveryArchives)\//.test(path))assert.deepEqual(h.data.get(path),row);
    }
    const archive=h.data.get(h.root+'/recoveryArchives/4');
    assert.equal(archive.readyForRestore,false);assert.equal(h.data.get(h.save).authoritativeStateReady,false);
    assert.equal(h.data.get(h.root+'/playableSnapshots/4').readyForPublication,false);
    assert.equal(JSON.parse(archive.sourceRecords.progress.sidecars['rested-exp-state'].raw).battles,2);
    assert.equal(archive.sourceRecords.economy.gold,0);assert.equal(archive.sourceRecords.economy.sharedExp,0);
    assert.deepEqual(archive.sourceRecords.inventory,[]);assert.deepEqual(archive.sourceRecords.claimRecords,[]);
});

test('serial simulated sources grant eight hours up to32, require three seconds, and can be abandoned',async()=>{
    const h=await seeded();await presence(h);
    const begin=await h.owner.beginSimulatedAd(h.request(),args(h));
    await refuses(h,()=>h.owner.beginSimulatedAd(h.request(),args(h)),/pending/);
    h.advance(2999);
    await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),args(h,{sourceId:begin.sourceId})),/incomplete/);
    h.advance(1);
    const completion=args(h,{sourceId:begin.sourceId});
    h.abortNext();await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),completion),/simulated rollback/);
    assert.equal(h.data.get(h.root+'/simulatedAdSources/'+begin.sourceId).status,'pending');
    const completed=await h.owner.completeSimulatedAd(h.request(),completion);
    assert.equal(completed.modeState.elementBox.remainingMs,28800000);
    const pending=await h.owner.beginSimulatedAd(h.request(),args(h));
    const before=h.data.get(h.root+'/modeTime/current').modeState.elementBox.remainingMs;
    await h.owner.abandonSimulatedAd(h.request(),args(h,{sourceId:pending.sourceId}));
    assert.equal(h.data.get(h.root+'/simulatedAdSources/'+pending.sourceId).status,'abandoned');
    assert.equal(h.data.get(h.root+'/modeTime/current').modeState.elementBox.remainingMs,before);
    await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),args(h,{sourceId:pending.sourceId})),/not pending/);
    for(let i=0;i<3;i++)await grant(h);
    assert.equal(h.data.get(h.root+'/modeTime/current').modeState.elementBox.remainingMs,115200000);
    assert.equal(count(h,'ledgerEntries'),4);
    await refuses(h,()=>h.owner.beginSimulatedAd(h.request(),args(h)),/cap|maximum|full|32/i);
    for(const [path,row] of h.data){
        if(path.startsWith(h.root+'/simulatedAdSources/'))assert.equal(row.verifiedProvider,false);
    }
});

test('ElementBox charges acknowledged foreground/background intervals, excludes reload gaps, and commits atomically',async()=>{
    const h=await seeded();await presence(h);await grant(h);
    await presence(h,'heartbeat','start');h.advance(1000);
    const argsBefore=args(h,{intent:'heartbeat',elementBox:'keep'}),before=snapshot(h);
    h.abortNext();await refuses(h,()=>h.owner.observePresence(h.request(),argsBefore),/simulated rollback/);
    assert.deepEqual(snapshot(h),before);
    const charged=await h.owner.observePresence(h.request(),argsBefore);
    assert.equal(charged.modeState.elementBox.remainingMs,28799000);
    await presence(h,'rest');h.advance(600000);
    const resumed=await presence(h);
    assert.equal(resumed.modeState.elementBox.remainingMs,28799000,'rest/reload gap does not charge online ElementBox');
    assert.equal(resumed.modeState.rested.battles,0,'blocked interval cannot produce rested credit');
    await presence(h,'rest');h.advance(600000);
    const background=await presence(h,'resume');
    assert.equal(background.modeState.elementBox.remainingMs,28199000,'known background interval still consumes active ElementBox');
    assert.equal(background.modeState.rested.battles,0);
});

test('lost completion response resolves original evidence exactly once even after later mode revisions',async()=>{
    const h=await seeded();await presence(h);const {intent,result,begun}=await grant(h);
    const first=snapshot(h),writes=h.writes;
    assert.deepEqual(await h.owner.completeSimulatedAd(h.request(),intent),{...result,unchanged:true});
    assert.deepEqual(snapshot(h),first);assert.equal(h.writes,writes);
    await presence(h,'rest');h.advance(120000);await presence(h,'resume');
    const later=snapshot(h),laterWrites=h.writes;
    assert.equal((await h.owner.completeSimulatedAd(h.request(),intent)).unchanged,true);
    assert.deepEqual(snapshot(h),later);assert.equal(h.writes,laterWrites);
    await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),args(h,{sourceId:begun.sourceId})),/not pending/);
    await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),{...intent,expectedRevision:h.revision}),/overlaps another intent/);
});

test('session, UID, stale revision or sequence and conflicting operation IDs cannot write',async()=>{
    const h=await seeded();const original=args(h,{intent:'reopen',elementBox:'keep'});
    for(const request of [{auth:{uid:'foreign'},data:{uid:h.uid,session:{sessionId:'session-one'}}},
        {auth:{uid:h.uid},data:{uid:'foreign',session:{sessionId:'session-one'}}},
        {auth:{uid:h.uid},data:{uid:h.uid,session:{sessionId:'replaced'}}}]){
        await refuses(h,()=>h.owner.observePresence(request,original),/SESSION/);
    }
    await h.owner.observePresence(h.request(),original);
    await refuses(h,()=>presence(h,'heartbeat','keep',{expectedRevision:1}));
    await refuses(h,()=>presence(h,'heartbeat','keep',{expectedSequence:0}),/SEQUENCE_CONFLICT/);
    await refuses(h,()=>h.owner.observePresence(h.request(),{...original,intent:'rest'}),/overlaps another intent/);
    h.data.set(h.root+'/grantOperations/mode-time-conflict-0001',{kind:'reserved'});
    await refuses(h,()=>presence(h,'heartbeat','keep',{operationId:'mode-time-conflict-0001'}),/already used/);
    const oldRequest=h.request();h.setSession('session-two');
    await refuses(h,()=>h.owner.observePresence(oldRequest,args(h,{intent:'reopen',elementBox:'keep'})),/SESSION/);
    await refuses(h,()=>presence(h,'heartbeat'),/reopen mode time first/);await presence(h);
});

test('takeover cannot complete an old session source; explicit abandonment enables a new serial source',async()=>{
    const h=await seeded();await presence(h);
    const pending=await h.owner.beginSimulatedAd(h.request(),args(h));h.advance(3000);
    h.setSession('takeover-session');await presence(h);
    await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),args(h,{sourceId:pending.sourceId})),/original session/);
    await h.owner.abandonSimulatedAd(h.request(),args(h,{sourceId:pending.sourceId}));
    assert.equal(h.data.get(h.root+'/simulatedAdSources/'+pending.sourceId).status,'abandoned');
    assert.equal(h.data.get(h.root+'/modeTime/current').modeState.elementBox.remainingMs,0);
    assert.equal((await grant(h)).result.modeState.elementBox.remainingMs,28800000);
});

test('missing or corrupt source, event, ledger and snapshot proof refuses with zero committed writes',async()=>{
    const prepare=async()=>{const h=await seeded();await presence(h);const completed=await grant(h);return {h,...completed};};
    for(const name of ['event','ledger','source','snapshot','archive','head']){
        const {h,intent}=await prepare();
        const paths={event:h.root+'/modeTimeEvents/'+intent.operationId,
            ledger:h.root+'/ledgerEntries/'+intent.operationId,source:h.root+'/simulatedAdSources/'+intent.sourceId,
            snapshot:h.root+'/playableSnapshots/'+h.revision,archive:h.root+'/recoveryArchives/'+h.revision,
            head:h.root+'/modeTime/current'};
        h.data.delete(paths[name]);
        await refuses(h,()=>presence(h,'heartbeat'));
    }
    for(const [name,field] of [['modeTimeEvents','sha256'],['ledgerEntries','eventSha256'],
        ['simulatedAdSources','rewardMs'],['operations','eventSha256']]){
        const {h,intent}=await prepare(),id=name==='simulatedAdSources'?intent.sourceId:intent.operationId;
        h.data.get(h.root+'/'+name+'/'+id)[field]='corrupt';
        await refuses(h,()=>h.owner.completeSimulatedAd(h.request(),intent));
    }
    const {h}=await prepare();
    h.data.get(h.root+'/progress/current').sidecars['element-box-state'].raw='{"remainingMs":1}';
    await refuses(h,()=>presence(h,'heartbeat'),/sources differ/);
});

// A bounded fixture for a different trusted canonical writer: retain every
// source byte except its revision, and build real snapshot/archive evidence.
// No mode event is fabricated and the original mode proof remains revision 2.
function advanceUnrelatedCanonicalRevision(h){
    const previous=h.data.get(h.root+'/account/current').serverRevision,next=h.revision+1;
    const records=copy(h.data.get(h.root+'/recoveryArchives/'+previous).sourceRecords);
    for(const rows of Object.values(records))for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=next;
    records.claimCheckpoint.claimDigest=claimRecordsDigest(records.claimRecords);
    const bundle=assembleCanonicalSnapshot(h.uid,next,records);
    for(const [name,collection] of Object.entries({account:'account',economy:'economy',
        relicLoadout:'relicLoadout',progress:'progress',claimCheckpoint:'claimCheckpoints'})){
        h.data.set(h.root+'/'+collection+'/current',{...copy(records[name]),
            ...(name==='account'?{snapshotSha256:bundle.sha256}:{})});
    }
    for(const [collection,key] of Object.entries({characters:row=>row.characterId,
        inventory:row=>row.ownedItemId,equipment:row=>`${row.characterId}_${row.slot}`,
        relics:row=>row.relicId,claimRecords:row=>row.claimKey})){
        for(const row of records[collection])h.data.set(h.root+'/'+collection+'/'+key(row),copy(row));
    }
    h.data.set(h.root+'/playableSnapshots/'+next,bundle);
    h.data.set(h.root+'/recoveryArchives/'+next,createRecoveryArchive(h.uid,next,records,bundle));
    h.data.set(h.save,{...h.data.get(h.save),serverRevision:next});
    return next;
}

test('new mode operations require the current archive after an unrelated canonical advance, beyond old event proof',async()=>{
    for(const damage of ['missing','corrupt']){
        const h=await seeded(),opened=await presence(h);
        const eventPath=h.root+'/modeTimeEvents/'+opened.operationId;
        const originalEvent=copy(h.data.get(eventPath));
        assert.equal(originalEvent.sourceRevision,2);assert.equal(originalEvent.resultRevision,2);
        const current=advanceUnrelatedCanonicalRevision(h);assert.equal(current,3);
        assert.ok(h.data.has(h.root+'/playableSnapshots/2'));assert.ok(h.data.has(h.root+'/recoveryArchives/2'));
        const currentArchive=h.root+'/recoveryArchives/'+current;
        if(damage==='missing')h.data.delete(currentArchive);
        else h.data.get(currentArchive).sourceSha256='0'.repeat(64);
        await refuses(h,()=>presence(h,'heartbeat'));
        await refuses(h,()=>h.owner.beginSimulatedAd(h.request(),args(h)));
        assert.deepEqual(h.data.get(eventPath),originalEvent);
    }
});

async function observeActualHeroLogin(h){
    const hero=createHeroAcquisition({...h.dependencies,seed:()=>1});
    const request=h.request();request.data.expectedRevision=h.revision;
    await hero.observeLogin(request);
    assert.equal(h.revision,3);assert.equal(h.data.get(h.root+'/account/current').serverRevision,2);
    assert.equal(h.data.has(h.root+'/playableSnapshots/3'),false);
    assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false);
}

test('actual Hero login envelope advance interoperates before initial reopen and after an existing mode head',async()=>{
    for(const modeHeadFirst of [false,true]){
        const h=await seeded();
        if(modeHeadFirst)await presence(h);
        await observeActualHeroLogin(h);
        const result=await presence(h,modeHeadFirst?'heartbeat':'reopen');
        assert.equal(result.resultRevision,3);assert.equal(result.canonicalRevision,2);
        const zeroEvent=h.data.get(h.root+'/modeTimeEvents/'+result.operationId);
        assert.equal(zeroEvent.sourceRevision,2);assert.equal(zeroEvent.envelopeRevision,3);
        assert.equal(zeroEvent.resultRevision,2);assert.equal(zeroEvent.resultEnvelopeRevision,3);
        assert.equal(zeroEvent.modeChanged,false);
        assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false,'Hero observation does not fabricate a canonical archive');
        const heroEvidence=copy([...h.data].filter(([key])=>/\/(heroAcquisition|heroAcquisitionHistory)\//.test(key)||
            key.includes('/operations/hero-login-')||key.includes('/ledgerEntries/hero-login-')));
        await presence(h,'rest');h.advance(120000);
        const accrued=await presence(h,'resume');
        assert.equal(accrued.resultRevision,4);assert.equal(accrued.canonicalRevision,4);
        assert.equal(accrued.modeState.rested.battles,1);
        assert.equal(h.data.get(h.root+'/account/current').serverRevision,4);
        assert.ok(h.data.has(h.root+'/playableSnapshots/4'));assert.ok(h.data.has(h.root+'/recoveryArchives/4'));
        assert.equal(h.data.has(h.root+'/recoveryArchives/3'),false);
        for(const [key,row] of heroEvidence)assert.deepEqual(h.data.get(key),row);
    }
});

test('self-consistent future envelope evidence refuses fresh operations, replay, current and recovery readers',async()=>{
    const h=await seeded();await presence(h);
    const beganArgs=args(h),began=await h.owner.beginSimulatedAd(h.request(),beganArgs);
    const event=h.data.get(h.root+'/modeTimeEvents/'+began.operationId);
    assert.equal(event.modeChanged,false);assert.equal(event.sourceRevision,2);assert.equal(event.resultRevision,2);
    event.envelopeRevision=3;event.resultEnvelopeRevision=3;event.intent.expectedRevision=3;
    event.intentSha256=snapshotDigest(event.intent);
    event.headSha256=snapshotDigest(event.afterState);
    const {sha256:oldSha,createdAt:eventStamp,...eventPayload}=event;
    event.sha256=snapshotDigest(eventPayload);
    const head=h.data.get(h.root+'/modeTime/current');head.eventSha256=event.sha256;
    const {sha256:oldHeadSha,eventSha256:headEventSha,updatedAt:headStamp,...headState}=head;
    head.sha256=snapshotDigest({...headState,eventSha256:headEventSha});
    const ad=h.data.get(h.root+'/simulatedAdSources/'+began.sourceId);ad.beginEventSha256=event.sha256;
    const {sha256:oldAdSha,status,consumedBy,closedAtMs,createdAt:adStamp,updatedAt:adUpdated,...adPayload}=ad;
    ad.sha256=snapshotDigest(adPayload);
    assert.notEqual(event.sha256,oldSha);assert.notEqual(head.sha256,oldHeadSha);assert.notEqual(ad.sha256,oldAdSha);
    assert.equal(h.revision,2);
    const root=h.dependencies.db.collection('serverUsers').doc(h.uid);
    const account=h.data.get(h.root+'/account/current');
    const records=h.data.get(h.root+'/recoveryArchives/2').sourceRecords;
    const current=bound=>h.dependencies.runProtected(h.request(),tx=>
        h.owner.verifyCurrentEvidence(tx,root,h.uid,account,records,bound));
    const recovery=bound=>h.dependencies.runProtected(h.request(),tx=>
        h.owner.verifyRetainedSource(tx,root,h.uid,account,{id:began.sourceId,data:()=>copy(ad)},bound));
    // All original proofs and recomputed seals are valid under the claimed
    // bound. The live/approved bound, rather than a missing hash, rejects them.
    const before=snapshot(h);await current(3);await recovery(3);assert.deepEqual(snapshot(h),before);
    await refuses(h,()=>presence(h,'heartbeat'));
    await refuses(h,()=>h.owner.beginSimulatedAd(h.request(),{...beganArgs,expectedRevision:3}));
    await refuses(h,()=>current(2));await refuses(h,()=>recovery(2));
    await refuses(h,()=>h.dependencies.runProtected(h.request(),(tx,session)=>
        h.owner.readSettlementMode(tx,root,h.uid,session,account,records,2)));
});

test('retained rested-value event independently requires both receipt and ledger after a later zero heartbeat',async()=>{
    for(const damage of ['none','operation','ledger','both','foreign-operation','foreign-event']){
        const h=await seeded();await presence(h);await presence(h,'rest');h.advance(120000);
        const accrued=await presence(h,'resume');
        assert.equal(accrued.modeState.rested.battles,1);
        assert.equal(count(h,'simulatedAdSources'),0,'rested evidence has no ad source to inventory');
        const heartbeat=await presence(h,'heartbeat');
        assert.equal(heartbeat.resultRevision,accrued.resultRevision);
        const eventPath=h.root+'/modeTimeEvents/'+accrued.operationId;
        const event=h.data.get(eventPath);assert.equal(event.modeChanged,true);
        assert.equal(h.data.get(h.root+'/modeTimeEvents/'+heartbeat.operationId).modeChanged,false);
        const originalProof=copy([...h.data].filter(([key])=>/\/(playableSnapshots|recoveryArchives)\//.test(key)));
        const receiptPath=h.root+'/operations/'+accrued.operationId;
        const ledgerPath=h.root+'/ledgerEntries/'+accrued.operationId;
        if(damage==='operation'||damage==='both')h.data.delete(receiptPath);
        if(damage==='ledger'||damage==='both')h.data.delete(ledgerPath);
        if(damage==='foreign-operation')h.data.get(receiptPath).ownerUid='foreign-owner';
        if(damage==='foreign-event')event.ownerUid='foreign-owner';
        const verify=()=>h.dependencies.runProtected(h.request(),tx=>
            h.owner.verifyRetainedEvent(tx,h.dependencies.db.collection('serverUsers').doc(h.uid),h.uid,
                h.data.get(h.root+'/account/current'),{id:accrued.operationId,data:()=>copy(event)},h.revision));
        if(damage==='none'){
            const before=snapshot(h),writes=h.writes;await verify();
            assert.deepEqual(snapshot(h),before);assert.equal(h.writes,writes);
        }else await refuses(h,verify,error=>error.code==='data-loss');
        for(const [key,row] of originalProof)assert.deepEqual(h.data.get(key),row);
        assert.equal(h.data.has(eventPath),true,'value event remains independently retained');
    }
});

test('actual operator approval and current recovery retain mode value evidence through source repair',async()=>{
    const h=await seeded();await presence(h);await presence(h,'rest');h.advance(120000);
    const accrued=await presence(h,'resume');await presence(h,'heartbeat');
    const operationId='mode-time-recovery-0001',sourceRevision=h.revision;
    const approval=createCanonicalRecoveryApproval(h.dependencies);
    await approval.issue({auth:{uid:'operator-mode-time',token:{cloudSaveOperator:true}},data:{
        ownerUid:h.uid,operationId,sourceRevision,ttlSeconds:300}});
    const history=copy([...h.data].filter(([key])=>/\/(modeTime|modeTimeEvents|operations|ledgerEntries|playableSnapshots|recoveryArchives)\//.test(key)));
    h.data.delete(h.root+'/progress/current');
    const recovery=createCanonicalCurrentRecovery(h.dependencies),intent={operationId,expectedRevision:sourceRevision};
    h.abortNext();await refuses(h,()=>recovery.restoreCurrent(h.request(),intent),/simulated rollback/);
    const restored=await recovery.restoreCurrent(h.request(),intent);
    assert.equal(restored.restoredRevision,sourceRevision+1);assert.equal(restored.authoritativeStateReady,false);
    const records=h.data.get(h.root+'/recoveryArchives/'+restored.restoredRevision).sourceRecords;
    assert.equal(JSON.parse(records.progress.sidecars['rested-exp-state'].raw).battles,1);
    assert.equal(h.data.get(h.root+'/modeTimeEvents/'+accrued.operationId).modeChanged,true);
    for(const [key,row] of history)assert.deepEqual(h.data.get(key),row);
    const before=snapshot(h),writes=h.writes;
    assert.equal((await recovery.restoreCurrent(h.request(),intent)).unchanged,true);
    assert.deepEqual(snapshot(h),before);assert.equal(h.writes,writes);
});

// A deliberately small stand-in for the independent Forest evidence Owner.
// It checks its own test reward and invokes only the mode component reader;
// it never re-enters mode-current or its source-specific dispatch.
function withPatrolEvidence(h){
    let fullProofCalls=0;
    h.owner=createCanonicalAccountModeTime({...h.dependencies,patrolSettlementEvidenceReadBudget:12,
        verifyPatrolSettlementEvidence:async context=>{
            fullProofCalls++;
            const {tx,root,uid,account,event,receipt,ledger,maxEnvelopeRevision,verifyPatrolModeComponent}=context;
            await verifyPatrolModeComponent(tx,root,uid,account,event,receipt,ledger,maxEnvelopeRevision);
            const read=revision=>tx.get(root.collection('recoveryArchives').doc(String(revision)));
            const [before,after]=await Promise.all([read(event.sourceRevision),read(event.resultRevision)]);
            assert.equal(after.get('sourceRecords.economy.gold'),before.get('sourceRecords.economy.gold')+11);
        }});
    return ()=>fullProofCalls;
}
async function settlePatrolModeFixture(h,settlementKind,{memberIndex=settlementKind==='member'?0:null,
    rollback=false}={}){
    const operationId=`forest-mode-fixture-${String(++serial).padStart(6,'0')}`;
    const expectedRevision=h.revision,resultRevision=expectedRevision+1;
    const before=copy(h.data.get(h.root+'/recoveryArchives/'+h.data.get(h.root+'/account/current').serverRevision).sourceRecords);
    const sourceRevision=before.account.serverRevision;
    const sourceSnapshotSha256=h.data.get(h.root+'/playableSnapshots/'+sourceRevision).sha256;
    if(rollback)h.abortNext();
    return h.dependencies.runProtected(h.request(),async(tx,session)=>{
        const root=h.dependencies.db.doc(h.root);
        const plan=await h.owner.preparePatrolSettlement(tx,{root,uid:h.uid,session,operationId,
            expectedRevision,expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,
            sourceRecords:before,sourceSnapshotSha256,serverNow:h.clock,resultRevision,
            settlementKind,memberIndex,sourceId:`forest-source-fixture-${serial}`});
        const after=copy(before);
        for(const rows of Object.values(after))for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=resultRevision;
        after.economy.gold+=11;
        if(settlementKind==='win')after.economy.sharedExp+=plan.mode.rested?588:plan.mode.elementBox?206:294;
        after.progress.sidecars['element-box-state'].raw=JSON.stringify(plan.modeState.elementBox);
        after.progress.sidecars['rested-exp-state'].raw=JSON.stringify(plan.modeState.rested);
        after.claimCheckpoint.claimDigest=claimRecordsDigest(after.claimRecords);
        const bundle=assembleCanonicalSnapshot(h.uid,resultRevision,after);
        const settlementCoreSha256=snapshotDigest({operationId,sourceSnapshotSha256,resultSnapshotSha256:bundle.sha256});
        const {event}=h.owner.writePatrolModeEvidence(tx,plan,{resultRecords:after,
            resultSnapshotSha256:bundle.sha256,settlementCoreSha256});
        const pair={schemaVersion:1,kind:'forest-patrol-settlement',ownerUid:h.uid,operationId,
            sourceRevision,envelopeRevision:expectedRevision,resultRevision,resultEnvelopeRevision:resultRevision,
            snapshotSha256:bundle.sha256,modeEventSha256:event.sha256,modeHeadSha256:event.headSha256,
            settlementCoreSha256,createdAt:Timestamp.fromMillis(h.clock)};
        tx.create(root.collection('operations').doc(operationId),pair);
        tx.create(root.collection('ledgerEntries').doc(operationId),{...pair,modeDelta:event.delta});
        for(const [key,collection] of Object.entries({account:'account',economy:'economy',progress:'progress',
            relicLoadout:'relicLoadout',claimCheckpoint:'claimCheckpoints'})){
            tx.update(root.collection(collection).doc('current'),{...after[key],
                ...(key==='account'?{snapshotSha256:bundle.sha256}:{})});
        }
        for(const row of after.characters)tx.update(root.collection('characters').doc(row.characterId),{serverRevision:resultRevision});
        tx.create(root.collection('playableSnapshots').doc(String(resultRevision)),bundle);
        tx.create(root.collection('recoveryArchives').doc(String(resultRevision)),createRecoveryArchive(h.uid,resultRevision,after,bundle));
        tx.update(h.dependencies.db.doc(h.save),{serverRevision:resultRevision});
        return {event,mode:copy(plan.mode),after};
    });
}

test('Forest member/win/loss/escape share one canonical transaction and consume rested only on wins',async()=>{
    const h=await seeded();await presence(h);await presence(h,'rest');h.advance(240000);await presence(h,'resume');
    const fullProofCalls=withPatrolEvidence(h);
    const member=await settlePatrolModeFixture(h,'member');
    assert.equal(member.after.economy.gold,11);assert.equal(member.after.economy.sharedExp,0);
    assert.equal(member.after.progress.sidecars['rested-exp-state'].raw.includes('"battles":2'),true);
    assert.equal(member.mode.rested,false);assert.equal(member.event.schemaVersion,2);assert.equal(member.event.modeChanged,false);
    const win1=await settlePatrolModeFixture(h,'win');
    assert.equal(win1.mode.rested,true);assert.equal(JSON.parse(win1.after.progress.sidecars['rested-exp-state'].raw).battles,1);
    const loss=await settlePatrolModeFixture(h,'loss');
    assert.equal(loss.mode.rested,false);assert.equal(JSON.parse(loss.after.progress.sidecars['rested-exp-state'].raw).battles,1);
    const escaped=await settlePatrolModeFixture(h,'escape');
    assert.equal(escaped.mode.rested,false);assert.equal(JSON.parse(escaped.after.progress.sidecars['rested-exp-state'].raw).battles,1);
    const win2=await settlePatrolModeFixture(h,'win');
    assert.equal(win2.mode.rested,true);assert.equal(JSON.parse(win2.after.progress.sidecars['rested-exp-state'].raw).battles,0);
    assert.equal(win2.after.economy.sharedExp,1176);assert.equal(win2.after.economy.gold,55);
    await presence(h,'heartbeat');
    assert.ok(fullProofCalls()>=5,'v2 dispatch invokes the independent proof Owner without recursive mode-current');
});

test('Forest member time debit and winning ElementBox mode exclude rested consumption and roll back atomically',async()=>{
    const h=await seeded();await presence(h);await presence(h,'rest');h.advance(120000);await presence(h,'resume');
    await grant(h);await presence(h,'heartbeat','start');withPatrolEvidence(h);h.advance(1000);
    await refuses(h,()=>settlePatrolModeFixture(h,'member',{rollback:true}),/simulated rollback/);
    const member=await settlePatrolModeFixture(h,'member');
    assert.equal(member.mode.elementBox,true);assert.equal(member.event.delta.elementBoxMs,-1000);
    assert.equal(JSON.parse(member.after.progress.sidecars['rested-exp-state'].raw).battles,1);
    h.advance(1000);const won=await settlePatrolModeFixture(h,'win');
    assert.equal(won.mode.elementBox,true);assert.equal(won.mode.rested,false);
    assert.equal(won.after.economy.sharedExp,206);
    assert.equal(JSON.parse(won.after.progress.sidecars['rested-exp-state'].raw).battles,1);
});

test('prepared Forest mode plans cannot be forged, moved across transactions or created while resting',async()=>{
    const h=await seeded();await presence(h);withPatrolEvidence(h);
    const before=copy(h.data.get(h.root+'/recoveryArchives/'+h.revision).sourceRecords);
    const setup=(tx,session)=>h.owner.preparePatrolSettlement(tx,{root:h.dependencies.db.doc(h.root),uid:h.uid,session,
        operationId:'forest-plan-binding-0001',expectedRevision:h.revision,expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,
        sourceRecords:before,sourceSnapshotSha256:h.data.get(h.root+'/playableSnapshots/'+h.revision).sha256,
        serverNow:h.clock,resultRevision:h.revision+1,settlementKind:'win',memberIndex:null,sourceId:'forest-bound-source-0001'});
    const plan=await h.dependencies.runProtected(h.request(),setup);
    for(const candidate of [{...plan},plan]){
        await refuses(h,()=>h.dependencies.runProtected(h.request(),async tx=>{
            h.owner.writePatrolModeEvidence(tx,candidate,{resultRecords:before,
                resultSnapshotSha256:'a'.repeat(64),settlementCoreSha256:'b'.repeat(64)});
        }),error=>error.code==='failed-precondition');
    }
    await presence(h,'rest');
    await refuses(h,()=>settlePatrolModeFixture(h,'win'),error=>error.code==='failed-precondition');
});

test('v2 current evidence fails closed without its specific Forest verifier and binds original outcome/sequence',async()=>{
    const h=await seeded();await presence(h);withPatrolEvidence(h);
    const result=await settlePatrolModeFixture(h,'member');
    const path=h.root+'/modeTimeEvents/'+result.event.operationId;
    const valid=copy(h.data.get(path));
    h.owner=createCanonicalAccountModeTime(h.dependencies);
    await refuses(h,()=>presence(h,'heartbeat'),error=>error.code==='failed-precondition');
    withPatrolEvidence(h);
    for(const field of ['settlementKind','memberIndex','expectedSequence']){
        const damaged=copy(valid);damaged.intent[field]=field==='settlementKind'?'win':field==='memberIndex'?3:999;
        h.data.set(path,damaged);
        await refuses(h,()=>presence(h,'heartbeat'),error=>error.code==='data-loss');
        h.data.set(path,copy(valid));
    }
    await presence(h,'heartbeat');
});

test('Forest plans bind the live canonical pointer and reject mutation of their public mode projection',async()=>{
    const h=await seeded();await presence(h);withPatrolEvidence(h);
    const stale=copy(h.data.get(h.root+'/recoveryArchives/2').sourceRecords);
    const staleSha=h.data.get(h.root+'/playableSnapshots/2').sha256;
    advanceUnrelatedCanonicalRevision(h);
    const prepare=(tx,session,records,hash)=>h.owner.preparePatrolSettlement(tx,{
        root:h.dependencies.db.doc(h.root),uid:h.uid,session,operationId:'forest-plan-live-source-0001',
        expectedRevision:h.revision,expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,
        sourceRecords:records,sourceSnapshotSha256:hash,serverNow:h.clock,resultRevision:h.revision+1,
        settlementKind:'win',memberIndex:null,sourceId:'forest-live-source-0001'});
    await refuses(h,()=>h.dependencies.runProtected(h.request(),(tx,session)=>prepare(tx,session,stale,staleSha)),
        error=>error.code==='data-loss');
    await refuses(h,()=>h.dependencies.runProtected(h.request(),async(tx,session)=>{
        const before=copy(h.data.get(h.root+'/recoveryArchives/'+h.revision).sourceRecords);
        const hash=h.data.get(h.root+'/playableSnapshots/'+h.revision).sha256;
        const plan=await prepare(tx,session,before,hash);
        plan.modeState.rested.battles=99;
        const after=copy(before),next=h.revision+1;
        for(const rows of Object.values(after))for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=next;
        after.progress.sidecars['rested-exp-state'].raw=JSON.stringify(plan.modeState.rested);
        after.claimCheckpoint.claimDigest=claimRecordsDigest(after.claimRecords);
        const bundle=assembleCanonicalSnapshot(h.uid,next,after);
        h.owner.writePatrolModeEvidence(tx,plan,{resultRecords:after,resultSnapshotSha256:bundle.sha256,
            settlementCoreSha256:'a'.repeat(64)});
    }),error=>error.code==='data-loss');
});
