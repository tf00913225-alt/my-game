import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {storeHarness,selection,copy} from './helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement.js');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation.js');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition.js');
const {assembleCanonicalSnapshot,claimRecordsDigest,snapshotDigest}=require('../functions/src/canonical-snapshot.js');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive.js');
let sequence=0;
const id=label=>`patrol-${label}-${String(++sequence).padStart(8,'0')}`;
async function seeded({sample=255}={}){
    const h=storeHarness();
    await h.initial.commitInitialSources(h.request(),{operationId:'patrol-initial-creation-0001',expectedRevision:1,selection});
    let entropyCalls=0;
    h.forest=createCanonicalPatrolSettlement({...h.dependencies,randomBytes:size=>{entropyCalls++;return Buffer.alloc(size,sample);}});
    h.entropyCalls=()=>entropyCalls;
    await h.forest.observePresence(h.request(),{operationId:id('mode-reopen'),expectedRevision:h.revision,
        expectedSequence:0,intent:'reopen',elementBox:'keep'});
    return h;
}
const economy=h=>h.data.get(h.root+'/economy/current');
const records=h=>h.data.get(h.root+'/recoveryArchives/'+h.data.get(h.root+'/account/current').serverRevision).sourceRecords;
const state=(h,ticketId)=>h.data.get(h.root+'/patrolTicketStates/'+ticketId);
async function issue(h,availableEntryIds=['forest:0']){
    const input={operationId:id('ticket'),expectedRevision:h.revision,triggerEntryId:availableEntryIds[0],availableEntryIds};
    const result=await h.forest.issueTicket(h.request(),input);return {...result,input};
}
async function member(h,ticketId,memberIndex=0,extra={}){
    const input={operationId:id('member'),expectedRevision:h.revision,ticketId,memberIndex,...extra};
    return {result:await h.forest.settleMember(h.request(),input),input};
}
async function terminal(h,ticketId,kind='win',extra={}){
    const input={operationId:id(kind),expectedRevision:h.revision,ticketId,kind,...extra};
    return {result:await h.forest.settleTerminal(h.request(),input),input};
}
async function refused(h,operation,pattern){
    const before=copy([...h.data]),writes=h.writes;
    await assert.rejects(operation,pattern);assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
}

test('twenty repeatable online Forest battles fund actual canonical EXP allocation through level10',async()=>{
    const h=await seeded();
    for(let battle=0;battle<20;battle++){
        const issued=await issue(h);assert.equal(issued.members.length,1);
        const killed=await member(h,issued.ticketId);assert.equal(killed.result.reward.gold,50);
        assert.equal(killed.result.reward.exp,0);
        const won=await terminal(h,issued.ticketId);assert.equal(won.result.reward.exp,294);
        assert.equal(won.result.outcomeVerified,false);
    }
    assert.equal(economy(h).sharedExp,5880);assert.equal(economy(h).gold,1000);
    const allocator=createCanonicalExpAllocation(h.dependencies);
    for(let level=1;level<10;level++){
        const allocated=await allocator.allocateSharedExp(h.request(),{operationId:id('allocate'),expectedRevision:h.revision});
        assert.equal(allocated.levelAfter,level+1);
    }
    assert.equal(records(h).characters[0].state.level,10);assert.equal(economy(h).sharedExp,30);
    assert.equal(h.data.get(h.save).authoritativeStateReady,false);
    assert.equal([...h.data.keys()].filter(key=>key.startsWith(h.root+'/patrolTickets/')).length,20);
});

test('server plans preserve member identity/order while each source can settle only once and win waits for all',async()=>{
    const h=await seeded(),issued=await issue(h,['forest:0','forest:1','forest:2']);
    assert.equal(issued.members.length,3);
    await refused(h,()=>terminal(h,issued.ticketId),error=>error.code==='failed-precondition');
    const two=await member(h,issued.ticketId,2);
    const before=copy([...h.data]),writes=h.writes;
    assert.equal((await h.forest.settleMember(h.request(),two.input)).unchanged,true);
    assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
    await refused(h,()=>member(h,issued.ticketId,2),error=>error.code==='failed-precondition');
    await member(h,issued.ticketId,0);await member(h,issued.ticketId,1);
    assert.deepEqual(state(h,issued.ticketId).settledMembers,[2,0,1]);
    const won=await terminal(h,issued.ticketId);
    assert.equal(won.result.reward.exp,882);
    await refused(h,()=>terminal(h,issued.ticketId,'loss'));
    assert.equal((await h.forest.settleTerminal(h.request(),won.input)).unchanged,true);
    assert.equal((await h.forest.issueTicket(h.request(),issued.input)).unchanged,true);
});

test('member rollback, stale race and lost response retain exactly one original economic delta',async()=>{
    const h=await seeded(),issued=await issue(h);
    const input={operationId:id('rollback'),expectedRevision:h.revision,ticketId:issued.ticketId,memberIndex:0};
    h.abortNext();await refused(h,()=>h.forest.settleMember(h.request(),input),/simulated rollback/);
    const stale={...input,operationId:id('raced')};
    const first=await h.forest.settleMember(h.request(),input);assert.equal(first.reward.gold,50);
    await refused(h,()=>h.forest.settleMember(h.request(),stale),error=>error.code==='aborted');
    await terminal(h,issued.ticketId,'loss');
    const before=copy([...h.data]);assert.equal((await h.forest.settleMember(h.request(),input)).unchanged,true);
    assert.deepEqual([...h.data],before);assert.equal(economy(h).gold,50);assert.equal(economy(h).sharedExp,0);
});

test('pending sources are serial; unrelated canonical revision or session requires explicit abandonment without clawback',async()=>{
    const h=await seeded(),issued=await issue(h);await member(h,issued.ticketId);
    await refused(h,()=>issue(h),error=>error.code==='failed-precondition');
    const hero=createHeroAcquisition({...h.dependencies,seed:()=>1});
    const request=h.request();request.data.expectedRevision=h.revision;await hero.observeLogin(request);
    await refused(h,()=>terminal(h,issued.ticketId,'escape'),error=>error.code==='aborted');
    h.setSession('b'.repeat(32));
    const close={operationId:id('abandon'),expectedRevision:h.revision,ticketId:issued.ticketId};
    await h.forest.abandonTicket(h.request(),close);assert.equal(economy(h).gold,50);assert.equal(economy(h).sharedExp,0);
    assert.equal((await h.forest.abandonTicket(h.request(),close)).unchanged,true);
    await h.forest.observePresence(h.request(),{operationId:id('new-session'),expectedRevision:h.revision,
        expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent:'reopen',elementBox:'keep'});
    await issue(h);
});

function reseal(h,mutate){
    const current=copy(records(h));mutate(current);
    const revision=current.account.serverRevision,bundle=assembleCanonicalSnapshot(h.uid,revision,current);
    for(const [name,collection] of Object.entries({account:'account',economy:'economy',progress:'progress',
        relicLoadout:'relicLoadout',claimCheckpoint:'claimCheckpoints'})){
        h.data.set(h.root+'/'+collection+'/current',{...current[name],...(name==='account'?{snapshotSha256:bundle.sha256}:{})});
    }
    for(const name of ['inventory','equipment','relics','claimRecords']){
        for(const key of [...h.data.keys()].filter(key=>key.startsWith(h.root+'/'+name+'/')))h.data.delete(key);
        for(const row of current[name]){
            const key=name==='inventory'?row.ownedItemId:name==='equipment'?row.characterId+'_'+row.slot:name==='relics'?row.relicId:row.claimKey;
            h.data.set(h.root+'/'+name+'/'+key,row);
        }
    }
    h.data.set(h.root+'/playableSnapshots/'+revision,bundle);
    h.data.set(h.root+'/recoveryArchives/'+revision,createRecoveryArchive(h.uid,revision,current,bundle));
}

test('full bag drops fail individually, existing999 stacks stay bounded, and original UTC claimed history survives',async()=>{
    const h=await seeded({sample:0});
    // Keep actual creation evidence immutable. A separate already-canonical
    // fixture revision supplies retained bag and claimed-source evidence.
    const before=copy(records(h)),revision=h.revision+1;
    for(const rows of Object.values(before))for(const row of Array.isArray(rows)?rows:[rows])row.serverRevision=revision;
    before.progress.dailyQuestState={date:'2026-10-19',progress:{checkin:1,killMonsters:4,winBattle:1},
        claimed:{checkin:true,killMonsters:true,winBattle:true}};
    before.progress.commissionQuestState={date:'2026-10-19',progress:{killMonsters:14,winBattle:2},claimed:{killMonsters:true,winBattle:true}};
    before.inventory=Array.from({length:120},(_,index)=>({schemaVersion:1,ownerUid:h.uid,serverRevision:revision,
        provenance:'server-created',ownedItemId:'occupied-'+index,location:'bag',state:{id:'occupied-'+index,type:'material',count:999}}));
    before.inventory[0].state={id:'ticketSetFire',type:'ticket',count:998};
    const bundle=assembleCanonicalSnapshot(h.uid,revision,before);
    h.data.set(h.save,{...h.data.get(h.save),serverRevision:revision});
    h.data.set(h.root+'/characters/'+before.characters[0].characterId,before.characters[0]);
    h.data.set(h.root+'/recoveryArchives/'+revision,createRecoveryArchive(h.uid,revision,before,bundle));
    h.data.set(h.root+'/playableSnapshots/'+revision,bundle);
    // Populate the exact canonical records, not a Client candidate or default.
    for(const [name,collection] of Object.entries({account:'account',economy:'economy',progress:'progress',relicLoadout:'relicLoadout',claimCheckpoint:'claimCheckpoints'})){
        h.data.set(h.root+'/'+collection+'/current',{...before[name],...(name==='account'?{snapshotSha256:bundle.sha256}:{})});
    }
    for(const row of before.inventory)h.data.set(h.root+'/inventory/'+row.ownedItemId,row);
    const issued=await issue(h),killed=await member(h,issued.ticketId);
    assert.equal(killed.result.reward.drops[0].itemId,'ticketSetFire');assert.equal(killed.result.reward.drops[0].accepted,true);
    assert.equal(records(h).inventory[0].state.count,999);assert.equal(records(h).inventory.length,120);
    assert.equal(records(h).progress.dailyQuestState.claimed.killMonsters,true);
    assert.equal(records(h).progress.commissionQuestState.claimed.killMonsters,true);
    assert.equal(records(h).progress.dailyQuestState.progress.killMonsters,5);
    await terminal(h,issued.ticketId,'loss');
    const next=await issue(h),blocked=await member(h,next.ticketId);
    assert.equal(blocked.result.reward.drops[0].accepted,false);assert.equal(records(h).inventory[0].state.count,999);
});

test('rested and ElementBox are consumed with the same Forest win transaction; losses do not consume rested',async()=>{
    const h=await seeded();
    const mode=()=>h.data.get(h.root+'/modeTime/current');
    const presence=async intent=>h.forest.observePresence(h.request(),{operationId:id('presence'),expectedRevision:h.revision,
        expectedSequence:mode().sequence,intent,elementBox:'keep'});
    await presence('rest');h.advance(240000);await presence('resume');
    const first=await issue(h);await member(h,first.ticketId);await terminal(h,first.ticketId,'loss');
    assert.equal(JSON.parse(records(h).progress.sidecars['rested-exp-state'].raw).battles,2);
    const second=await issue(h);await member(h,second.ticketId);
    const input={operationId:id('atomic-win'),expectedRevision:h.revision,ticketId:second.ticketId,kind:'win'};
    h.abortNext();await refused(h,()=>h.forest.settleTerminal(h.request(),input),/simulated rollback/);
    const won=await h.forest.settleTerminal(h.request(),input);assert.equal(won.reward.exp,588);
    assert.equal(JSON.parse(records(h).progress.sidecars['rested-exp-state'].raw).battles,1);
    const ad=await h.forest.beginSimulatedAd(h.request(),{operationId:id('ad'),expectedRevision:h.revision,expectedSequence:mode().sequence});
    h.advance(3000);await h.forest.completeSimulatedAd(h.request(),{operationId:id('complete-ad'),sourceId:ad.sourceId,
        expectedRevision:h.revision,expectedSequence:mode().sequence});
    await h.forest.observePresence(h.request(),{operationId:id('activate'),expectedRevision:h.revision,
        expectedSequence:mode().sequence,intent:'heartbeat',elementBox:'start'});
    const third=await issue(h);h.advance(1000);await member(h,third.ticketId);h.advance(1000);
    const eb=await terminal(h,third.ticketId);assert.equal(eb.result.reward.exp,206);
    assert.equal(JSON.parse(records(h).progress.sidecars['rested-exp-state'].raw).battles,1);
    assert.equal(JSON.parse(records(h).progress.sidecars['element-box-state'].raw).remainingMs,28798000);
});

test('independently retained source, receipt, ledger, mode and original archives must all remain exact',async()=>{
    for(const damage of ['ticket','operation','ledger','mode','beforeArchive','afterArchive','amount','modeDelta']){
        const h=await seeded(),issued=await issue(h),killed=await member(h,issued.ticketId);
        const event=h.data.get(h.root+'/patrolSettlements/'+killed.input.operationId);
        if(damage==='ticket')h.data.delete(h.root+'/patrolTickets/'+issued.ticketId);
        if(damage==='operation')h.data.delete(h.root+'/operations/'+killed.input.operationId);
        if(damage==='ledger')h.data.delete(h.root+'/ledgerEntries/'+killed.input.operationId);
        if(damage==='mode')h.data.delete(h.root+'/modeTimeEvents/'+killed.input.operationId);
        if(damage==='beforeArchive')h.data.delete(h.root+'/recoveryArchives/'+event.sourceRevision);
        if(damage==='afterArchive')h.data.delete(h.root+'/recoveryArchives/'+event.resultRevision);
        if(damage==='amount')h.data.get(h.root+'/ledgerEntries/'+killed.input.operationId).goldAfter++;
        if(damage==='modeDelta')h.data.get(h.root+'/ledgerEntries/'+killed.input.operationId).modeDelta.restedBattles=1;
        await refused(h,()=>h.forest.settleMember(h.request(),killed.input));
    }
});

test('versioned policy certificate survives source representation changes and later Owner activity',async()=>{
    const h=await seeded(),issued=await issue(h),killed=await member(h,issued.ticketId);
    await terminal(h,issued.ticketId,'loss');
    const hero=createHeroAcquisition(h.dependencies);
    const observation=h.request();observation.data.expectedRevision=h.revision;
    await hero.observeLogin(observation);
    const modulePath=require.resolve('../functions/src/canonical-patrol-settlement.js');
    const originalModule=require.cache[modulePath];
    const policy=require('../functions/src/patrol-ticket-policy.js');
    const originalDescriptor=Object.getOwnPropertyDescriptor(policy.preparePatrolMembers,'toString');
    const originalCertificate=originalModule.exports.patrolPolicyCertificate;
    // Simulate a representation-only deployment change without changing behavior.
    Object.defineProperty(policy.preparePatrolMembers,'toString',{configurable:true,value:()=>{
        throw Error('Function source text is not a durable policy identity');
    }});
    try{
        delete require.cache[modulePath];
        const loaded=require(modulePath);
        assert.deepEqual(loaded.patrolPolicyCertificate,originalCertificate);
        assert.equal(loaded.patrolPolicyCertificate.policyId,'forest-online-patrol-v1');
        assert.equal(Object.isFrozen(loaded.patrolPolicyCertificate),true);
        const reloaded=loaded.createCanonicalPatrolSettlement(h.dependencies),before=h.writes;
        const retry=await reloaded.settleMember(h.request(),killed.input);
        assert.equal(retry.unchanged,true);assert.deepEqual(retry.reward,killed.result.reward);
        assert.equal(h.writes,before);
        const core=h.data.get(h.root+'/patrolTickets/'+issued.ticketId);
        core.policyId='forest-online-patrol-v2';
        const {createdAt,sha256,...body}=core;core.sha256=snapshotDigest(body);
        await refused(h,()=>reloaded.settleMember(h.request(),killed.input));
    }finally{
        if(originalDescriptor)Object.defineProperty(policy.preparePatrolMembers,'toString',originalDescriptor);
        else delete policy.preparePatrolMembers.toString;
        require.cache[modulePath]=originalModule;
    }
});

test('retained maximum member chain and current evidence stay within published proof read budgets',async()=>{
    const h=await seeded(),issued=await issue(h,['forest:0','forest:1','forest:2']);
    for(const index of [2,0,1])await member(h,issued.ticketId,index);
    const won=await terminal(h,issued.ticketId);
    const root=h.dependencies.db.doc(h.root),account=h.data.get(h.root+'/account/current');
    for(const [method,path,idValue,budget] of [
        ['verifyRetainedTicket','patrolTickets',issued.ticketId,h.forest.retainedTicketReadBudget()],
        ['verifyRetainedSettlement','patrolSettlements',won.input.operationId,h.forest.retainedSettlementReadBudget()],
        ['verifyCurrentEvidence',null,null,h.forest.currentEvidenceReadBudget()]
    ]){
        let reads=0;
        await h.dependencies.db.runTransaction(async tx=>{
            const counted={get:reference=>{reads++;return tx.get(reference);}};
            if(path){
                const row=await tx.get(root.collection(path).doc(idValue));
                await h.forest[method](counted,root,h.uid,account,row,h.revision);
            }else await h.forest[method](counted,root,h.uid,account,h.revision);
        });
        assert.ok(reads<=budget,`${method} ${reads} reads exceeds declared ${budget}`);
        assert.ok(reads>0);
    }
});

test('four independent normal drops create stable complete owned stacks and merge across later canonical writes',async()=>{
    const h=await seeded();
    h.forest=createCanonicalPatrolSettlement({...h.dependencies,randomBytes:size=>{
        const bytes=Buffer.alloc(size,255);bytes.fill(0,18,42);return bytes;
    }});
    const definitions=require('../functions/src/generated/patrol-item-catalog.json').items;
    const dropIds=['freezeTalismanLow','stealthTalismanLow','barrierTalismanLow','oreLow'];
    let ownedIds;
    for(let battle=0;battle<2;battle++){
        const ticket=await issue(h),killed=await member(h,ticket.ticketId);
        assert.deepEqual(killed.result.reward.drops,dropIds.map(itemId=>({itemId,quantity:1,accepted:true})));
        await terminal(h,ticket.ticketId);
        const inventory=records(h).inventory;
        assert.equal(inventory.length,4);
        assert.deepEqual(inventory.map(row=>row.state),dropIds.map(itemId=>({...definitions[itemId],count:battle+1})));
        if(!ownedIds)ownedIds=inventory.map(row=>row.ownedItemId);
        else assert.deepEqual(inventory.map(row=>row.ownedItemId),ownedIds);
        let head=h.data.get(h.root+'/modeTime/current');
        await h.forest.observePresence(h.request(),{operationId:id('drop-rest'),expectedRevision:h.revision,
            expectedSequence:head.sequence,intent:'rest',elementBox:'keep'});
        h.advance(120000);head=h.data.get(h.root+'/modeTime/current');
        await h.forest.observePresence(h.request(),{operationId:id('drop-resume'),expectedRevision:h.revision,
            expectedSequence:head.sequence,intent:'resume',elementBox:'keep'});
    }
});

test('initial and replayed public issuance expose member identity without future reward amounts or rolls',async()=>{
    const h=await seeded({sample:0}),issued=await issue(h);
    const privateCore=h.data.get(h.root+'/patrolTickets/'+issued.ticketId);
    assert.ok(privateCore.samples.length>0);assert.ok(privateCore.members[0].drops.length>0);
    const keys=['entryId','name','level','element','monsterKey','context','rank','memberIndex'].sort();
    for(const member of issued.members)assert.deepEqual(Object.keys(member).sort(),keys);
    const replay=await h.forest.issueTicket(h.request(),issued.input);
    assert.equal(replay.unchanged,true);assert.deepEqual(replay.members,issued.members);
    for(const member of replay.members)assert.deepEqual(Object.keys(member).sort(),keys);
    const settled=await member(h,issued.ticketId);
    assert.ok(settled.result.reward.gold>0);assert.ok(settled.result.reward.drops.length>0);
    assert.deepEqual(h.data.get(h.root+'/patrolTickets/'+issued.ticketId),privateCore);
});

test('a retried callback reusing one SDK transaction object refreshes proof reads after another member commit',async()=>{
    const h=await seeded({sample:0}),ticket=await issue(h);
    const expectedGold=h.data.get(h.root+'/patrolTickets/'+ticket.ticketId).members[0].gold;
    const input={operationId:id('retry-object-member'),expectedRevision:h.revision,ticketId:ticket.ticketId,memberIndex:0};
    const base=h.dependencies.runProtected,rollback=Error('discard first SDK attempt');
    let currentTransaction,attempts=0;
    const reusedTransaction=Object.fromEntries(['get','create','update','set','delete'].map(method=>
        [method,(...args)=>currentTransaction[method](...args)]));
    const retryProtected=async(request,operation)=>{
        try{
            await base(request,async(tx,session)=>{
                attempts++;currentTransaction=tx;await operation(reusedTransaction,session);throw rollback;
            });
        }catch(error){if(error!==rollback)throw error;}
        // Another legitimate transaction wins the optimistic conflict while the
        // SDK retains its public Transaction object's identity for the retry.
        await h.forest.settleMember(h.request(),input);
        return base(request,(tx,session)=>{
            attempts++;currentTransaction=tx;return operation(reusedTransaction,session);
        });
    };
    const retrying=createCanonicalPatrolSettlement({...h.dependencies,runProtected:retryProtected});
    const before=h.revision,result=await retrying.settleMember(h.request(),input);
    assert.equal(attempts,2);assert.equal(result.unchanged,true);assert.equal(h.revision,before+1);
    assert.equal(economy(h).gold,expectedGold);assert.equal(state(h,ticket.ticketId).settledMembers.length,1);
    assert.equal([...h.data.keys()].filter(key=>key===h.root+'/patrolSettlements/'+input.operationId).length,1);
});

test('Forest-configured presence retries refresh callback proofs while retaining sharing within each attempt',async()=>{
    const h=await seeded(),ticket=await issue(h);await member(h,ticket.ticketId);
    const base=h.dependencies.runProtected,rollback=Error('discard mode SDK attempt');
    let currentTransaction,attempt=0;
    const ticketReads=[0,0],reusedTransaction=Object.fromEntries(['get','create','update','set','delete'].map(method=>
        [method,(...args)=>{
            if(method==='get'&&args[0].path===h.root+'/patrolTickets/'+ticket.ticketId)ticketReads[attempt]++;
            return currentTransaction[method](...args);
        }]));
    const retryProtected=async(request,operation)=>{
        try{await base(request,async(tx,session)=>{
            currentTransaction=tx;await operation(reusedTransaction,session);throw rollback;
        });}catch(error){if(error!==rollback)throw error;}
        attempt=1;
        return base(request,(tx,session)=>{currentTransaction=tx;return operation(reusedTransaction,session);});
    };
    const forest=createCanonicalPatrolSettlement({...h.dependencies,runProtected:retryProtected});
    await forest.modeOwner.observePresence(h.request(),{operationId:id('retry-mode-cache'),expectedRevision:h.revision,
        expectedSequence:h.data.get(h.root+'/modeTime/current').sequence,intent:'heartbeat',elementBox:'keep'});
    assert.deepEqual(ticketReads,[1,1]);
});
