import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createCanonicalRecoveryApproval}=require('../functions/src/canonical-recovery-approval');
const {createCanonicalCurrentRecovery}=require('../functions/src/canonical-current-recovery');
const initialId='patrol-recovery-creation-0001',ticketId='patrol-recovery-ticket-0001';
const memberId='patrol-recovery-member-0001',lossId='patrol-recovery-loss-0001';
const recoveryId='patrol-recovery-restore-0001';

async function setup(){
    const h=storeHarness();
    await h.initial.commitInitialSources(h.request(),{operationId:initialId,expectedRevision:1,selection});
    h.forest=createCanonicalPatrolSettlement({...h.dependencies,randomBytes:size=>Buffer.alloc(size,255)});
    await h.forest.observePresence(h.request(),{operationId:'patrol-recovery-reopen-0001',expectedRevision:h.revision,
        expectedSequence:0,intent:'reopen',elementBox:'keep'});
    await h.forest.issueTicket(h.request(),{operationId:ticketId,expectedRevision:h.revision,
        triggerEntryId:'forest:0',availableEntryIds:['forest:0']});
    h.memberIntent={operationId:memberId,expectedRevision:h.revision,ticketId,memberIndex:0};
    await h.forest.settleMember(h.request(),h.memberIntent);
    await h.forest.settleTerminal(h.request(),{operationId:lossId,expectedRevision:h.revision,ticketId,kind:'loss'});
    await h.forest.observePresence(h.request(),{operationId:'patrol-recovery-heartbeat-0001',expectedRevision:h.revision,
        expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent:'heartbeat',elementBox:'keep'});
    await h.forest.observePresence(h.request(),{operationId:'patrol-recovery-heartbeat-0002',expectedRevision:h.revision,
        expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent:'heartbeat',elementBox:'keep'});
    h.sourceRevision=h.revision;
    await createCanonicalRecoveryApproval(h.dependencies).issue({auth:{uid:'operator-patrol',token:{cloudSaveOperator:true}},
        data:{ownerUid:h.uid,operationId:recoveryId,sourceRevision:h.sourceRevision,ttlSeconds:300}});
    return h;
}
function loseCurrent(h){
    const collections=['account','characters','economy','inventory','equipment','relics','relicLoadout',
        'progress','claimRecords','claimCheckpoints'];
    for(const key of [...h.data.keys()])if(collections.some(name=>key.startsWith(h.root+'/'+name+'/')))h.data.delete(key);
}
const restore=h=>createCanonicalCurrentRecovery(h.dependencies).restoreCurrent(h.request(),
    {operationId:recoveryId,expectedRevision:h.sourceRevision});
async function refuses(h){
    const before=copy([...h.data]),writes=h.writes;
    await assert.rejects(()=>restore(h),error=>['data-loss','failed-precondition'].includes(error.code));
    assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
}

test('original Forest sources restore complete current-source loss without awarding or spending again',async()=>{
    const h=await setup(),history=copy([...h.data].filter(([path])=>
        /\/(patrolTickets|patrolTicketStates|patrolSettlements|modeTime|modeTimeEvents|operations|ledgerEntries|playableSnapshots|recoveryArchives)\//.test(path)));
    const original=copy(h.data.get(h.root+'/recoveryArchives/'+h.sourceRevision).sourceRecords);
    loseCurrent(h);
    let reads=0;
    const dependencies={...h.dependencies,runProtected:(request,operation)=>h.dependencies.runProtected(request,(tx,session)=>
        operation({...tx,get:async reference=>{const row=await tx.get(reference);
            reads+=row.docs?Math.max(1,row.docs.length):1;return row;}},session))};
    const recovered=await createCanonicalCurrentRecovery(dependencies).restoreCurrent(h.request(),
        {operationId:recoveryId,expectedRevision:h.sourceRevision});
    assert.equal(recovered.restoredRevision,h.sourceRevision+1);assert.equal(recovered.authoritativeStateReady,false);
    assert(reads<=400,`actual recovery reads exceed retained budget: ${reads}`);
    assert.equal(h.data.get(h.root+'/economy/current').gold,original.economy.gold);
    assert.equal(h.data.get(h.root+'/economy/current').sharedExp,0);
    for(const [path,row] of history)assert.deepEqual(h.data.get(path),row);
    const before=copy([...h.data]);
    assert.equal((await h.forest.settleMember(h.request(),h.memberIntent)).unchanged,true);
    assert.equal((await restore(h)).unchanged,true);assert.deepEqual([...h.data],before);
});
test('independent retained Forest settlement detects loss of its operation and ledger',async()=>{
    const h=await setup();loseCurrent(h);
    h.data.delete(h.root+'/operations/'+memberId);h.data.delete(h.root+'/ledgerEntries/'+memberId);
    await refuses(h);
});
test('zero-mode-value Forest evidence cannot disappear behind missing tickets and economic indexes',async()=>{
    const h=await setup();
    for(const operationId of [memberId,lossId])assert.equal(h.data.get(h.root+'/modeTimeEvents/'+operationId).modeChanged,false);
    assert.equal(h.data.get(h.root+'/modeTimeEvents/patrol-recovery-heartbeat-0001').schemaVersion,1);
    loseCurrent(h);
    for(const key of [...h.data.keys()])if(/\/(patrolTickets|patrolTicketStates|patrolSettlements|patrolClosures|patrol)\//.test(key)||
        [memberId,lossId].some(id=>key===h.root+'/operations/'+id||key===h.root+'/ledgerEntries/'+id))h.data.delete(key);
    await refuses(h);
});
test('foreign, missing, orphaned and over-budget retained Forest inventories refuse atomically',async()=>{
    for(const damage of ['foreign-ticket','missing-state','orphan-state','orphan-settlement','orphan-closure','over-budget']){
        const h=await setup();loseCurrent(h);
        if(damage==='foreign-ticket')h.data.get(h.root+'/patrolTickets/'+ticketId).ownerUid='another-uid';
        if(damage==='missing-state')h.data.delete(h.root+'/patrolTicketStates/'+ticketId);
        if(damage==='orphan-state')h.data.set(h.root+'/patrolTicketStates/orphan-patrol-state-0001',
            copy(h.data.get(h.root+'/patrolTicketStates/'+ticketId)));
        if(damage==='orphan-settlement')h.data.set(h.root+'/patrolSettlements/orphan-patrol-settlement-0001',
            copy(h.data.get(h.root+'/patrolSettlements/'+memberId)));
        if(damage==='orphan-closure')h.data.set(h.root+'/patrolClosures/orphan-patrol-closure-0001',{ticketId});
        if(damage==='over-budget')for(let i=0;i<401;i++)h.data.set(h.root+'/patrolTickets/overflow-'+i,
            copy(h.data.get(h.root+'/patrolTickets/'+ticketId)));
        await refuses(h);
    }
});

test('unsupported older Forest mode versions remain independently visible after later ordinary heartbeats',async()=>{
    const h=await setup();loseCurrent(h);
    for(const key of [...h.data.keys()])if(/\/(patrolTickets|patrolTicketStates|patrolSettlements|patrolClosures|patrol)\//.test(key)||
        [memberId,lossId].some(id=>key===h.root+'/operations/'+id||key===h.root+'/ledgerEntries/'+id))h.data.delete(key);
    for(const operationId of [memberId,lossId]){
        const row=h.data.get(h.root+'/modeTimeEvents/'+operationId);
        assert.equal(row.modeChanged,false);assert.equal(row.resultOwner,'forest-patrol-settlement');
        row.schemaVersion=3;
    }
    await refuses(h);
});
