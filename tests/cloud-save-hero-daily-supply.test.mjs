import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {fixture,uid,root,env}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');
const {createHeroGrowth}=require('../functions/src/hero-growth');
const DOG='divineDogHongbao',KING='vajraHeavenlyKing';
function harness(options={}){
    const h=fixture({fragments:0,pills:0,owned:true,...options});
    let instant=Date.parse('2026-10-18T15:59:59Z');
    h.deps.now=()=>instant;h.writer=createHeroGrowth(h.deps);
    h.setTime=value=>{instant=Date.parse(value);};
    h.claim=(day='20261018',extra={})=>h.request({periodDate:day,operationId:'hero-daily-supply-v1-'+day,
        expectedRevision:h.data.get(env).serverRevision,...extra});
    return h;
}
test('daily supply credits both fragments and exactly one pill; concurrent/replayed claims never reissue',async()=>{
    const h=harness(),intent=h.claim();
    const results=await Promise.all([h.writer.claimDailySupply(intent),h.writer.claimDailySupply(intent)]);
    assert.deepEqual(results[0].receipt,results[1].receipt);
    const r=results[1];assert.equal(r.heroAccount.heroes[DOG].specificFragments,5);
    assert.equal(r.heroAccount.heroes[KING].specificFragments,5);assert.equal(r.marrowPills,1);
    assert.equal(r.heroAccount.heroes[KING].unlocked,false);assert.equal(r.dailySupply.claimed,true);
    assert.equal(r.authoritativeStateReady,false);
    for(const name of ['operations','ledgerEntries','uniqueClaims']){
        assert.equal([...h.data.keys()].filter(p=>p===`${root}/${name}/hero-daily-supply-v1-20261018`).length,1);
    }
    const before=structuredClone([...h.data]);
    assert.deepEqual((await h.writer.claimDailySupply(h.claim())).receipt,r.receipt);
    assert.deepEqual([...h.data],before);
});
test('server Taipei midnight permits a new day only; skipped dates cannot be caught up; old receipt may be read',async()=>{
    const h=harness(),oldIntent=h.claim(),old=await h.writer.claimDailySupply(oldIntent);
    h.setTime('2026-10-18T16:00:00Z');
    assert.equal((await h.writer.read(h.request())).dailySupply.periodDate,'20261019');
    assert.equal((await h.writer.read(h.request())).dailySupply.claimed,false);
    const next=await h.writer.claimDailySupply(h.claim('20261019'));
    assert.equal(next.marrowPills,2);assert.equal(next.heroAccount.heroes[KING].specificFragments,10);
    assert.deepEqual((await h.writer.claimDailySupply(oldIntent)).receipt,old.receipt);
    h.setTime('2026-10-21T00:00:00Z');const before=structuredClone([...h.data]);
    await assert.rejects(h.writer.claimDailySupply(h.claim('20261020')),{code:'failed-precondition'});
    await assert.rejects(h.writer.claimDailySupply(h.claim('20261022')),{code:'failed-precondition'});
    assert.deepEqual([...h.data],before);
});
test('midnight during transaction or a retry cannot grant yesterday',async()=>{
    const h=harness();let n=0;
    h.deps.now=()=>Date.parse(++n===1?'2026-10-18T15:59:59Z':'2026-10-18T16:00:00Z');
    const writer=createHeroGrowth(h.deps),before=structuredClone([...h.data]);
    await assert.rejects(writer.claimDailySupply(h.claim()),{code:'failed-precondition'});
    assert.deepEqual([...h.data],before);
});
test('only fixed date intent accepted; stale revisions, foreign UID and revoked session cannot credit',async()=>{
    const h=harness(),before=structuredClone([...h.data]);
    for(const extra of [{amount:5},{items:[]},{date:'20261018'},{periodDate:'20260230'},
        {operationId:'another-operation'},{periodDate:'20261019'}]){
        await assert.rejects(h.writer.claimDailySupply(h.claim('20261018',extra)),{code:'invalid-argument'});
    }
    await assert.rejects(h.writer.claimDailySupply(h.claim('20261018',{expectedRevision:1})),{code:'aborted'});
    await assert.rejects(h.writer.claimDailySupply(h.claim('20261018',{uid:'other'})),{code:'permission-denied'});
    h.revoke();await assert.rejects(h.writer.claimDailySupply(h.claim()),{code:'permission-denied'});
    assert.deepEqual([...h.data],before);
});
for(const name of ['operations','ledgerEntries','uniqueClaims']){
    test(`daily ${name} missing or corrupt blocks read/retry without reissuing`,async()=>{
        for(const corrupt of [false,true]){
            const h=harness();await h.writer.claimDailySupply(h.claim());
            const key=`${root}/${name}/hero-daily-supply-v1-20261018`;
            if(corrupt)h.data.set(key,{...h.data.get(key),fragmentDeltas:{[DOG]:5,[KING]:999}});else h.data.delete(key);
            const before=structuredClone([...h.data]);
            await assert.rejects(h.writer.read(h.request()),{code:'data-loss'});
            await assert.rejects(h.writer.claimDailySupply(h.claim()),{code:'data-loss'});
            assert.deepEqual([...h.data],before);
        }
    });
}
test('missing canonical/archive evidence, capacity and interrupted writes leave every document unchanged',async()=>{
    for(const damage of [h=>h.data.delete(`${root}/account/current`),
        h=>h.data.delete(`${root}/recoveryArchives/2`),h=>h.interrupt()]){
        const h=harness();damage(h);const before=structuredClone([...h.data]);
        await assert.rejects(h.writer.claimDailySupply(h.claim()));assert.deepEqual([...h.data],before);
    }
    const h=harness({fragments:Number.MAX_SAFE_INTEGER}),before=structuredClone([...h.data]);
    await assert.rejects(h.writer.claimDailySupply(h.claim()),{code:'failed-precondition'});assert.deepEqual([...h.data],before);
});
test('spending resources and a fresh reader retain original daily evidence; damaged old archive blocks replay',async()=>{
    const h=harness({fragments:20}),intent=h.claim(),r=await h.writer.claimDailySupply(intent);
    await h.writer.mutate(h.intent('starUp'));await h.writer.mutate(h.intent('reroll'));
    const fresh=createHeroGrowth(h.deps);assert.equal((await fresh.read(h.request())).dailySupply.claimed,true);
    const before=structuredClone([...h.data]);assert.deepEqual((await fresh.claimDailySupply(h.claim())).receipt,r.receipt);
    assert.deepEqual([...h.data],before);
    h.setTime('2026-10-19T00:00:00Z');h.data.delete(`${root}/recoveryArchives/${r.serverRevision}`);
    await assert.rejects(fresh.claimDailySupply(intent),{code:'data-loss'});
});
test('client lost-response retry across midnight preserves old intent; session/UID invalidates proof',async()=>{
    const h=harness(),calls=[],events={};let activeUid=uid,lost=true;
    const c={navigator:{onLine:true},location:{hostname:'production.invalid'},FourSymbolsHeroCore:require('../functions/src/hero-core'),
        FourSymbolsAccountSave:{getActiveUid:()=>activeUid},FourSymbolsStartupPolicy:{getUid:()=>activeUid,getState:()=>'READY'},
        FourSymbolsFirebaseLifecycle:{getUser:()=>({uid:activeUid}),readHeroGrowth:()=>h.writer.read(h.request()),
            claimHeroDailySupply:async intent=>{calls.push(structuredClone(intent));const r=await h.writer.claimDailySupply(h.request(intent));
                if(lost){lost=false;throw Object.assign(Error('lost'),{code:'unavailable'});}return r;}},
        addEventListener:(name,fn)=>{events[name]=fn;}};
    c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/hero-growth-client.js','utf8'),c);
    const api=c.FourSymbolsHeroGrowth;await api.read();await api.claimDailySupply();
    assert.equal(api.getStatus().pending.periodDate,'20261018');await api.claimLoginReward(3);assert.equal(calls.length,1);
    h.setTime('2026-10-18T16:00:00Z');await api.read();await api.retry();
    assert.deepEqual(calls[0],calls[1]);assert.equal(api.getStatus().dailySupply.periodDate,'20261019');
    assert.equal(api.getStatus().dailySupply.claimed,false);assert.equal(api.getStatus().pending,null);
    activeUid='other';events['four-symbols:firebase-auth-state']({detail:{user:{uid:'other'}}});
    assert.equal(api.getStatus().dailySupply,null);
    events['four-symbols:game-session-state']({detail:{status:'revoked'}});assert.equal(api.getStatus().pending,null);
});
