import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sources=['hero-acquisition-client','hero-growth-client','team-formation-client'];
function harness(){
    const document=new EventTarget(),window=new EventTarget();
    const counts={growth:0,formation:0};
    const uid='test-owner';
    let reject=true,networkEvents=0;
    const proof={schemaVersion:1,ownerUid:uid,authoritativeStateReady:false,serverRevision:1,
        loginCount:0,entitlements:{},chapter:{outcomeVerified:false,phase:'not-started',completedIntents:[]}};
    const call=async kind=>{
        counts[kind]++;
        await Promise.resolve();
        if(reject){
            // Bound the broken baseline without suppressing its first actual cycles.
            if(networkEvents++<12)window.dispatchEvent(new CustomEvent('four-symbols:game-session-state',
                {detail:{status:'unavailable',code:'SESSION_UNAVAILABLE'}}));
            throw Object.assign(new Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});
        }
        return kind==='growth'?{schemaVersion:1,ownerUid:uid,authoritativeStateReady:false,
            serverRevision:1,marrowPills:0,heroAccount:{heroes:{}}}:
            {schemaVersion:1,ownerUid:uid,authoritativeStateReady:false,serverRevision:1,
                heroAccount:{heroes:{}},playerIndexes:[0],formation:null};
    };
    Object.assign(window,{window,document,navigator:{onLine:true},location:{hostname:'localhost'},
        FourSymbolsAccountSave:{getActiveUid:()=>uid},
        FourSymbolsStartupPolicy:{getUid:()=>uid,getState:()=> 'READY'},
        FourSymbolsHeroCore:{listHeroDefinitions:()=>[],normalizeAccountState:value=>value||{heroes:{}}},
        FourSymbolsHeroSystem:{cacheConfirmedEntitlements:()=>true},
        FourSymbolsTeamFormationPolicy:{},
        FourSymbolsFirebaseLifecycle:{getUser:()=>({uid}),readHeroGrowth:()=>call('growth'),
            readTeamFormation:()=>call('formation'),readHeroAcquisition:async()=>structuredClone(proof),
            observeHeroLogin:async()=>structuredClone(proof)}});
    const context=vm.createContext({window,document,CustomEvent,console,Promise});
    for(const name of sources)vm.runInContext(fs.readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8'),context);
    const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
    return {window,document,counts,flush,recover:()=>{reject=false;},
        emit:detail=>window.dispatchEvent(new CustomEvent('four-symbols:game-session-state',{detail}))};
}

test('real acquisition reset notifications cannot recursively retry failed growth and formation reads',async()=>{
    const h=harness();
    await h.window.FourSymbolsHeroGrowth.read();
    await h.window.FourSymbolsTeamFormation.read();
    await h.flush();
    assert.deepEqual(h.counts,{growth:1,formation:1});
    assert.equal(h.window.FourSymbolsHeroAcquisition.getStatus().ready,false);
    assert.equal(h.window.FourSymbolsHeroGrowth.getStatus().ready,false);
    assert.equal(h.window.FourSymbolsTeamFormation.getStatus().ready,false);
});

test('signed-out, revoked and blocked notifications invalidate proofs without starting cloud reads',async()=>{
    const h=harness();h.recover();
    await h.window.FourSymbolsHeroAcquisition.sync();await h.flush();
    assert.equal(h.window.FourSymbolsHeroGrowth.getStatus().ready,true);
    assert.equal(h.window.FourSymbolsTeamFormation.getStatus().ready,true);
    for(const detail of [{status:'signed-out'},{status:'revoked'},{status:'blocked',code:'SESSION_REAUTH_REQUIRED'}]){
        h.emit(detail);await h.flush();
    }
    assert.deepEqual(h.counts,{growth:1,formation:1});
    assert.equal(h.window.FourSymbolsHeroAcquisition.getStatus().ready,false);
    assert.equal(h.window.FourSymbolsHeroGrowth.getStatus().ready,false);
    assert.equal(h.window.FourSymbolsTeamFormation.getStatus().ready,false);
});

test('confirmed acquisition publication still synchronizes both readers after busy work finishes',async()=>{
    const h=harness();h.recover();
    await h.window.FourSymbolsHeroAcquisition.sync();await h.flush();
    assert.deepEqual(h.counts,{growth:1,formation:1});
    assert.equal(h.window.FourSymbolsHeroGrowth.getStatus().ready,true);
    assert.equal(h.window.FourSymbolsTeamFormation.getStatus().ready,true);
});

test('a failure remains recoverable by an explicit read after the backend returns',async()=>{
    const h=harness();await h.window.FourSymbolsTeamFormation.read();await h.flush();
    h.recover();await h.window.FourSymbolsTeamFormation.read();await h.flush();
    assert.equal(h.counts.formation,2);
    assert.equal(h.window.FourSymbolsTeamFormation.getStatus().ready,true);
});
