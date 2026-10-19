import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import {storeHarness,selection,copy} from '../scripts/test-helpers/canonical-store-harness.mjs';
const require=createRequire(import.meta.url);
const {createCanonicalPatrolSettlement}=require('../functions/src/canonical-patrol-settlement');
const {createCanonicalExpAllocation}=require('../functions/src/canonical-exp-allocation');
const {createCanonicalSourceWriter}=require('../functions/src/canonical-source-writer');
const {makeInitialCharacterSources}=require('../functions/src/initial-character-sources');
const {assembleCanonicalSnapshot,claimRecordsDigest}=require('../functions/src/canonical-snapshot');
const {createRecoveryArchive}=require('../functions/src/canonical-recovery-archive');
let serial=0,baseline;
const id=kind=>`additional-${kind}-${String(++serial).padStart(8,'0')}`;
const choices=points=>({...selection,displayName:'Second',attributes:{attack:points,vitality:0,energy:0,intelligence:0,defensePoints:0,agility:0}});
const current=h=>h.data.get(h.root+'/recoveryArchives/'+h.data.get(h.root+'/account/current').serverRevision).sourceRecords;
async function unlocked(){
    if(!baseline)baseline=(async()=>{
        const h=storeHarness();
        await h.initial.commitInitialSources(h.request(),{operationId:id('initial'),expectedRevision:1,selection:{...selection,displayName:'ＡＬＰＨＡ'}});
        const patrol=createCanonicalPatrolSettlement({...h.dependencies,randomBytes:n=>Buffer.alloc(n,255)});
        await patrol.observePresence(h.request(),{operationId:id('reopen'),expectedRevision:h.revision,expectedSequence:0,intent:'reopen',elementBox:'keep'});
        for(let battle=0;battle<20;battle++){
            const ticketId=id('ticket');
            await patrol.issueTicket(h.request(),{operationId:ticketId,expectedRevision:h.revision,triggerEntryId:'forest:0',availableEntryIds:['forest:0']});
            await patrol.settleMember(h.request(),{operationId:id('member'),expectedRevision:h.revision,ticketId,memberIndex:0});
            await patrol.settleTerminal(h.request(),{operationId:id('win'),expectedRevision:h.revision,ticketId,kind:'win'});
        }
        const allocation=createCanonicalExpAllocation(h.dependencies);
        for(let level=1;level<10;level++)await allocation.allocateSharedExp(h.request(),{operationId:id('allocate'),expectedRevision:h.revision});
        assert.equal(current(h).characters[0].state.level,10);
        return copy([...h.data]);
    })();
    const data=await baseline,h=storeHarness();h.data.clear();for(const pair of copy(data))h.data.set(...pair);
    h.writer=createCanonicalSourceWriter(h.dependencies);return h;
}
const intent=(h,points=3)=>({operationId:id('create'),expectedRevision:h.revision,slotIndex:1,selection:choices(points)});
async function refuses(h,operation,code){
    const before=copy([...h.data]),writes=h.writes;
    await assert.rejects(operation,code?{code}:undefined);assert.deepEqual([...h.data],before);assert.equal(h.writes,writes);
}
// A later trusted-source fixture records only an explicit formation choice.
// It retains every previous snapshot/archive; it does not forge the Lv10 gate.
function formationFixture(h,formation,heroAccount,structuralLevels){
    const before=current(h),revision=h.revision+1;
    const records=copy(before);
    for(const name of ['account','economy','progress','relicLoadout','claimCheckpoint'])records[name].serverRevision=revision;
    for(const name of ['characters','inventory','equipment','relics','claimRecords'])for(const row of records[name])row.serverRevision=revision;
    records.account.formation=formation;
    if(heroAccount)records.progress.playableState.heroAccount=heroAccount;
    // Explicit server-structural qualification fixture, not earning evidence.
    // Only the earlier Lv10 baseline was earned through actual Forest writes.
    if(structuralLevels)records.characters.forEach((row,index)=>{
        row.state.level=structuralLevels[index];row.state.exp=0;
        row.state.expNext=require('../functions/src/canonical-newcomer-exp').newcomerExpNext(structuralLevels[index]);
    });
    records.claimCheckpoint.claimDigest=claimRecordsDigest(records.claimRecords);
    const snapshot=assembleCanonicalSnapshot(h.uid,revision,records),archive=createRecoveryArchive(h.uid,revision,records,snapshot);
    for(const [name,collection] of Object.entries({account:'account',economy:'economy',progress:'progress',relicLoadout:'relicLoadout',claimCheckpoint:'claimCheckpoints'}))
        h.data.set(h.root+'/'+collection+'/current',{...records[name],...(name==='account'?{snapshotSha256:snapshot.sha256}:{})});
    for(const row of records.characters)h.data.set(h.root+'/characters/'+row.characterId,copy(row));
    h.data.set(h.root+'/playableSnapshots/'+revision,snapshot);h.data.set(h.root+'/recoveryArchives/'+revision,archive);
    h.data.get(h.save).serverRevision=revision;
}

test('additional character uses actual Forest-funded Lv10, preserves all existing state and advances complete sources atomically',async()=>{
    const h=await unlocked(),before=copy(current(h)),input=intent(h),result=await h.writer.commitAdditionalCharacter(h.request(),input);
    assert.equal(result.resultRevision,input.expectedRevision+1);assert.equal(result.authoritativeStateReady,false);
    const after=current(h),character=after.characters[1];
    assert.equal(character.slotIndex,1);assert.equal(character.characterId,'character-'+input.operationId);
    assert.equal(character.state.level,1);assert.equal(character.state.exp,0);assert.equal(character.state.expNext,300);
    assert.equal(character.state.attack,3);assert.equal(character.state.attributePoints,7);assert.equal(character.state.skillPoints,2);
    assert.equal(character.state.hp,100);assert.equal(character.state.sp,50);
    assert.deepEqual(character.skillLoadout,{name:'Second',skillLevels:{},equippedSkills:[]});
    assert.deepEqual(after.account.slots,[before.account.slots[0],character.characterId,null]);assert.equal(after.account.formation,null);
    assert.deepEqual({...after.characters[0],serverRevision:before.characters[0].serverRevision},before.characters[0]);
    for(const name of ['economy','progress','relicLoadout','claimCheckpoint'])
        assert.deepEqual({...after[name],serverRevision:before[name].serverRevision},before[name]);
    for(const name of ['inventory','equipment','relics','claimRecords'])assert.deepEqual(after[name].map(row=>({...row,serverRevision:before.account.serverRevision})),before[name]);
    assert.equal(h.data.has(h.root+'/ledgerEntries/'+input.operationId),false);
});

test('unspent opt-in cannot relax first-character admission and additional state matches actual Client builder',async()=>{
    assert.throws(()=>makeInitialCharacterSources('uid',2,id('strict'),choices(0)));
    assert.throws(()=>makeInitialCharacterSources('uid',2,id('strict'),{...choices(0),allowUnspent:true}));
    const source=fs.readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
    const start=source.indexOf('function buildAdditionalCharacter('),end=source.indexOf('\nfunction registerAdditionalCharacter',start);
    for(const points of [0,3,10]){
        const h=await unlocked(),input=intent(h,points);
        await h.writer.commitAdditionalCharacter(h.request(),input);
        const context=vm.createContext({creationStats:input.selection.attributes,creationPoints:10-points,INITIAL_CHARACTER_SKILL_POINTS:2});
        vm.runInContext(source.slice(start,end),context);
        const expected=JSON.parse(JSON.stringify(context.buildAdditionalCharacter('Second',input.selection.element,input.selection.gender)));
        // The final v133 createAdditionalCharacter adapter recalibrates expNext.
        expected.expNext=300;
        assert.deepEqual(current(h).characters[1].state,expected);
    }
});

test('NFKC duplicate names, invalid slots/points/authority, occupied slots and stale revisions refuse without writes',async()=>{
    const h=await unlocked();
    for(const change of [{slotIndex:2},{slotIndex:0},{selection:{...choices(3),displayName:'alpha'}},
        {selection:choices(11)},{selection:{...choices(3),level:10}},{allowUnspent:true},{expectedRevision:h.revision-1}]){
        await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),{...intent(h),...change}));
    }
    const low=storeHarness();await low.initial.commitInitialSources(low.request(),{operationId:id('low'),expectedRevision:1,selection});
    await refuses(low,()=>low.initial.commitAdditionalCharacter(low.request(),intent(low)),'failed-precondition');
    await h.writer.commitAdditionalCharacter(h.request(),intent(h));
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),intent(h)),'failed-precondition');
});

test('lost response retries original proof after later writes; rollback, session takeover and altered intent preserve once-only creation',async()=>{
    const h=await unlocked(),input=intent(h);h.abortNext();
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),input));
    const created=await h.writer.commitAdditionalCharacter(h.request(),input);
    const old=h.request();h.setSession('b'.repeat(32));
    await refuses(h,()=>h.writer.commitAdditionalCharacter(old,input),'permission-denied');
    formationFixture(h,null);
    const before=copy([...h.data]),result=await h.writer.commitAdditionalCharacter(h.request(),input);
    assert.equal(result.unchanged,true);assert.equal(result.resultRevision,created.resultRevision);assert.deepEqual([...h.data],before);
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),{...input,selection:choices(2)}),'data-loss');
});

test('v1 formation extends using actual Client normalization and preserves the original player position',async()=>{
    const browser=vm.createContext({window:{}});
    vm.runInContext(fs.readFileSync(new URL('../js/battlefield-slot-owner.js',import.meta.url),'utf8'),browser);
    for(const slot of ['ALLY_F1','ALLY_F3','ALLY_B2']){
        const h=await unlocked(),formation={version:1,characterIndexToSlot:{0:slot}};
        const expected=JSON.parse(JSON.stringify(browser.window.FourSymbolsBattlefieldSlots.normalizeAllyFormation(formation,[0,1])));
        formationFixture(h,formation);await h.writer.commitAdditionalCharacter(h.request(),intent(h));
        assert.deepEqual(current(h).account.formation,{version:1,characterIndexToSlot:expected.characterIndexToSlot});
    }
});

test('v2 addition preserves original Hero/player positions and uses shared slot order when preferred position is occupied',async()=>{
    const Core=require('../functions/src/hero-core'),Policy=require('../functions/src/team-formation-policy');
    for(const heroPosition of ['ALLY_B2','ALLY_F3']){
        const h=await unlocked(),heroId=Core.listHeroDefinitions()[0].heroId;
        const heroAccount=Core.createDomain(current(h).progress.playableState.heroAccount,()=>[],()=>null,()=>null).unlockHeroDirect(heroId,123);
        const formation={version:2,characterIndexToSlot:{0:'ALLY_F2'},heroIdToSlot:{[heroId]:heroPosition}};
        formationFixture(h,formation,heroAccount);
        await h.writer.commitAdditionalCharacter(h.request(),intent(h));
        const result=current(h).account.formation;
        assert.equal(result.characterIndexToSlot[0],'ALLY_F2');assert.deepEqual(result.heroIdToSlot,formation.heroIdToSlot);
        assert.equal(result.characterIndexToSlot[1],heroPosition==='ALLY_F3'?'ALLY_F1':'ALLY_F3');
        assert.deepEqual(Policy.validate(result,[0,1],[heroId]),result);
        assert.deepEqual(current(h).progress.playableState.heroAccount,heroAccount);
    }
});

test('missing/corrupt original archives, receipt bindings and collision proof block creation or replay',async()=>{
    for(const damage of ['before-snapshot','before-archive','after-snapshot','after-archive','receipt','ledger','grant']){
        const h=await unlocked(),input=intent(h),created=await h.writer.commitAdditionalCharacter(h.request(),input);
        if(damage==='before-snapshot')h.data.delete(h.root+'/playableSnapshots/'+created.sourceRevision);
        if(damage==='before-archive')h.data.delete(h.root+'/recoveryArchives/'+created.sourceRevision);
        if(damage==='after-snapshot')h.data.delete(h.root+'/playableSnapshots/'+created.resultRevision);
        if(damage==='after-archive')h.data.delete(h.root+'/recoveryArchives/'+created.resultRevision);
        if(damage==='receipt')h.data.get(h.root+'/operations/'+input.operationId).sourceSnapshotSha256='0'.repeat(64);
        if(damage==='ledger')h.data.set(h.root+'/ledgerEntries/'+input.operationId,{kind:'unknown'});
        if(damage==='grant')h.data.set(h.root+'/grantOperations/'+input.operationId,{kind:'unknown'});
        await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),input),'data-loss');
    }
    const h=await unlocked();h.data.delete(h.root+'/recoveryArchives/'+h.revision);
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),intent(h)),'data-loss');
});

test('additional retained proof reuses the original Owner within its six-read bound',async()=>{
    const h=await unlocked(),input=intent(h);await h.writer.commitAdditionalCharacter(h.request(),input);
    let reads=0;
    await h.dependencies.db.runTransaction(async tx=>{
        const root=h.dependencies.db.doc(h.root),row=await tx.get(root.collection('operations').doc(input.operationId));
        await h.writer.verifyRetainedOperation({get:ref=>{reads++;return tx.get(ref);}},root,h.uid,current(h).account,row);
    });
    assert.equal(reads,6);assert.equal(h.writer.retainedOperationReadBudget('additional-character-sources'),6);
});

async function structuralTwo(levels=[50,50],formation=null,heroAccount){
    const h=await unlocked(),second=intent(h);
    await h.writer.commitAdditionalCharacter(h.request(),second);
    formationFixture(h,formation,heroAccount,levels);
    h.secondIntent=second;return h;
}
const thirdIntent=(h,points=3)=>({...intent(h,points),slotIndex:2,selection:{...choices(points),displayName:'Third'}});

test('third slot requires both canonical primary and secondary50, with structural49/50 boundaries and no client eligibility override',async()=>{
    for(const levels of [[49,50],[50,49],[49,49]]){
        const h=await structuralTwo(levels);
        await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),thirdIntent(h)),'failed-precondition');
    }
    const missing=await unlocked();
    await refuses(missing,()=>missing.writer.commitAdditionalCharacter(missing.request(),thirdIntent(missing)),'failed-precondition');
    for(const points of [0,10]){
        const h=await structuralTwo(),before=copy(current(h)),input=thirdIntent(h,points);
        await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),{...input,primaryLevel:50}),'invalid-argument');
        const created=await h.writer.commitAdditionalCharacter(h.request(),input),after=current(h);
        assert.equal(created.slotIndex,2);assert.equal(after.characters.length,3);
        assert.equal(after.account.slots[2],created.characterId);assert.equal(after.account.formation,null);
        assert.equal(after.characters[2].state.level,1);assert.equal(after.characters[2].state.attributePoints,10-points);
        for(const index of [0,1])assert.deepEqual({...after.characters[index],serverRevision:before.account.serverRevision},before.characters[index]);
        assert.deepEqual({...after.economy,serverRevision:before.account.serverRevision},before.economy);
        assert.deepEqual({...after.progress,serverRevision:before.account.serverRevision},before.progress);
        assert.equal(after.characters.every(row=>row.serverRevision===created.resultRevision),true);
    }
});

test('third creation is once-only across occupied slots, mixed-target intents, lost responses and later revisions',async()=>{
    const h=await structuralTwo(),input=thirdIntent(h);h.abortNext();
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),input));
    const created=await h.writer.commitAdditionalCharacter(h.request(),input);
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),thirdIntent(h)),'failed-precondition');
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),{...input,slotIndex:1}),'data-loss');
    await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),{...input,selection:{...input.selection,attributes:choices(11).attributes}}),'invalid-argument');
    formationFixture(h,null);
    const before=copy([...h.data]),retry=await h.writer.commitAdditionalCharacter(h.request(),input);
    assert.equal(retry.unchanged,true);assert.equal(retry.resultRevision,created.resultRevision);assert.equal(retry.slotIndex,2);
    assert.equal((await h.writer.commitAdditionalCharacter(h.request(),h.secondIntent)).unchanged,true);
    assert.deepEqual([...h.data],before);
    let reads=0;
    await h.dependencies.db.runTransaction(async tx=>{
        const root=h.dependencies.db.doc(h.root),row=await tx.get(root.collection('operations').doc(input.operationId));
        await h.writer.verifyRetainedOperation({get:ref=>{reads++;return tx.get(ref);}},root,h.uid,current(h).account,row);
    });assert.equal(reads,6);
});

test('third-player formation follows actual three-player normalization without moving previous units or Heroes',async()=>{
    const browser=vm.createContext({window:{}});
    vm.runInContext(fs.readFileSync(new URL('../js/battlefield-slot-owner.js',import.meta.url),'utf8'),browser);
    for(const map of [{0:'ALLY_F2',1:'ALLY_F3'},{0:'ALLY_F1',1:'ALLY_B2'}]){
        const formation={version:1,characterIndexToSlot:map},h=await structuralTwo([50,50],formation);
        const expected=JSON.parse(JSON.stringify(browser.window.FourSymbolsBattlefieldSlots.normalizeAllyFormation(formation,[0,1,2])));
        await h.writer.commitAdditionalCharacter(h.request(),thirdIntent(h));
        assert.deepEqual(current(h).account.formation,{version:1,characterIndexToSlot:expected.characterIndexToSlot});
    }
    const Core=require('../functions/src/hero-core'),heroId=Core.listHeroDefinitions()[0].heroId;
    const base=await unlocked(),heroes=Core.createDomain(current(base).progress.playableState.heroAccount,()=>[],()=>null,()=>null).unlockHeroDirect(heroId,123);
    const formation={version:2,characterIndexToSlot:{0:'ALLY_F1',1:'ALLY_F2'},heroIdToSlot:{[heroId]:'ALLY_F3'}};
    const h=await structuralTwo([50,50],formation,heroes);
    await h.writer.commitAdditionalCharacter(h.request(),thirdIntent(h));
    const result=current(h).account.formation;
    assert.deepEqual(result,{version:2,characterIndexToSlot:{0:'ALLY_F1',1:'ALLY_F2',2:'ALLY_B1'},heroIdToSlot:formation.heroIdToSlot});
    assert.deepEqual(current(h).progress.playableState.heroAccount,heroes);
});

test('third source, receipt target, original archives and canonical pointers reject corruption with no writes',async()=>{
    for(const damage of ['current-archive','target','before-archive','after-archive']){
        const h=await structuralTwo(),input=thirdIntent(h);
        if(damage==='current-archive'){
            h.data.delete(h.root+'/recoveryArchives/'+h.revision);
            await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),input),'data-loss');continue;
        }
        const result=await h.writer.commitAdditionalCharacter(h.request(),input);
        if(damage==='target')h.data.get(h.root+'/operations/'+input.operationId).slotIndex=1;
        if(damage==='before-archive')h.data.delete(h.root+'/recoveryArchives/'+result.sourceRevision);
        if(damage==='after-archive')h.data.delete(h.root+'/recoveryArchives/'+result.resultRevision);
        await refuses(h,()=>h.writer.commitAdditionalCharacter(h.request(),input),'data-loss');
    }
});
