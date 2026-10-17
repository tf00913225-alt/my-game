import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {fixture,uid,root,env,heroId:DOG}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');
const {createHeroAcquisition}=require('../functions/src/hero-acquisition');
const KING='vajraHeavenlyKing';
function harness(){
    const h=fixture({fragments:0,pills:0,owned:true});
    let instant=Date.parse('2026-10-12T15:59:59Z');
    const acquisition=createHeroAcquisition({...h.deps,now:()=>instant});
    h.deps.acquisition.readInTransaction=(tx,session)=>acquisition.readInTransaction(tx,session);
    h.observe=()=>acquisition.observeLogin(h.request({expectedRevision:h.data.get(env).serverRevision}));
    h.advance=(days=1)=>{instant+=days*86400000;};
    h.setTime=time=>{instant=Date.parse(time);};
    h.days=async count=>{for(let n=0;n<count;n++){await h.observe();h.advance(n%2?1:3);}};
    h.reward=(day,extra={})=>h.request({milestoneDay:day,operationId:`hero-login-reward-v1-day${day}`,
        expectedRevision:h.data.get(env).serverRevision,...extra});
    return h;
}
test('server Taipei cumulative milestones retain login/day-seven rights; below threshold cannot claim',async()=>{
    const h=harness();await h.observe();await h.observe();
    h.setTime('2026-10-12T16:00:00Z');await h.observe();
    assert.deepEqual((await h.writer.read(h.request())).loginRewards.map(r=>r.eligible),[false,false]);
    const before=structuredClone([...h.data]);
    await assert.rejects(h.writer.claimLoginReward(h.reward(3)),{code:'failed-precondition'});
    assert.deepEqual([...h.data],before);
    h.advance(5);await h.observe();
    const r=await h.writer.claimLoginReward(h.reward(3));
    assert.equal(r.heroAccount.heroes[DOG].specificFragments,25);assert.equal(r.marrowPills,1);
    assert.equal(r.loginRewards[0].claimed,true);assert.equal(r.heroAccount.heroes[KING].unlocked,false);
});
test('existing seven-day account backfills both once; spend and fresh reader preserve original receipts',async()=>{
    const h=harness();await h.days(7);
    const firstIntent=h.reward(3),first=await h.writer.claimLoginReward(firstIntent);
    const second=await h.writer.claimLoginReward(h.reward(7));
    assert.equal(second.heroAccount.heroes[KING].specificFragments,25);
    assert.equal(second.heroAccount.heroes[KING].unlocked,true);assert.equal(second.marrowPills,2);
    await h.writer.mutate(h.intent('starUp','reward-growth-star-0001'));
    await h.writer.mutate(h.intent('reroll','reward-growth-roll-0001'));
    const before=structuredClone([...h.data]);
    const replay=await h.writer.claimLoginReward(firstIntent);
    assert.deepEqual(replay.receipt,first.receipt);assert.deepEqual([...h.data],before);
    assert.equal(replay.heroAccount.heroes[DOG].stars,1);assert.equal(replay.marrowPills,1);
    assert.deepEqual((await h.writer.read(h.request())).loginRewards.map(r=>r.claimed),[true,true]);
    assert.equal(replay.authoritativeStateReady,false);
    // A fresh device has a new expected revision; fixed milestone identity still cannot reissue.
    await h.writer.claimLoginReward(h.reward(3));assert.deepEqual([...h.data],before);
});
test('simultaneous same milestone credits one delta; unrelated stale milestone rejects',async()=>{
    const h=harness();await h.days(7);const intent=h.reward(3);
    const results=await Promise.all([h.writer.claimLoginReward(intent),h.writer.claimLoginReward(intent)]);
    assert.deepEqual(results[0].receipt,results[1].receipt);
    assert.equal(results[1].marrowPills,1);assert.equal(results[1].heroAccount.heroes[DOG].specificFragments,25);
    await assert.rejects(h.writer.claimLoginReward(h.reward(7,{expectedRevision:intent.data.expectedRevision})),{code:'aborted'});
});
for(const name of ['operations','ledgerEntries','uniqueClaims']){
    test(`missing ${name} never reopens a claimed reward`,async()=>{
        const h=harness();await h.days(3);await h.writer.claimLoginReward(h.reward(3));
        h.data.delete(`${root}/${name}/hero-login-reward-v1-day3`);
        const before=structuredClone([...h.data]);
        await assert.rejects(h.writer.claimLoginReward(h.reward(3)),{code:'data-loss'});
        await assert.rejects(h.writer.read(h.request()),{code:'data-loss'});assert.deepEqual([...h.data],before);
    });
}
test('client amounts/dates, unsupported milestones, foreign identity and revoked session cannot issue',async()=>{
    const h=harness();await h.days(7);const before=structuredClone([...h.data]);
    for(const extra of [{amount:25},{day:'20261019'},{heroId:DOG},{milestoneDay:4},
        {operationId:'another-operation-id'},{milestoneDay:7,operationId:'hero-login-reward-v1-day3'}]){
        await assert.rejects(h.writer.claimLoginReward(h.reward(3,extra)),{code:'invalid-argument'});
    }
    await assert.rejects(h.writer.claimLoginReward(h.reward(3,{uid:'other'})),{code:'permission-denied'});
    h.revoke();await assert.rejects(h.writer.claimLoginReward(h.reward(3)),{code:'permission-denied'});
    assert.deepEqual([...h.data],before);
});
test('missing canonical data, damaged history/archive and interrupted writes leave all resources unchanged',async()=>{
    for(const damage of [h=>h.data.delete(`${root}/account/current`),
        h=>h.data.delete(`${root}/heroAcquisitionHistory/3`),h=>h.data.delete(`${root}/recoveryArchives/2`),
        h=>h.interrupt()]){
        const h=harness();await h.days(7);damage(h);const before=structuredClone([...h.data]);
        await assert.rejects(h.writer.claimLoginReward(h.reward(3)));assert.deepEqual([...h.data],before);
    }
});
test('resource grant source/archive delta remains verifiable after later login and repeated reads',async()=>{
    const h=harness();await h.days(3);const first=await h.writer.claimLoginReward(h.reward(3));
    await h.days(4);await h.writer.claimLoginReward(h.reward(7));
    const archive=`${root}/recoveryArchives/${first.serverRevision}`;
    h.data.delete(archive);const before=structuredClone([...h.data]);
    await assert.rejects(h.writer.claimLoginReward(h.reward(3)),{code:'data-loss'});
    assert.deepEqual([...h.data],before);
});
test('real client keeps fixed milestone intent after lost response, blocks other action and resets on session loss',async()=>{
    const h=harness();await h.days(7);const events={},calls=[];
    const c={navigator:{onLine:true},location:{hostname:'production.invalid'},
        FourSymbolsHeroCore:require('../functions/src/hero-core'),crypto:{randomUUID:()=>''},
        FourSymbolsAccountSave:{getActiveUid:()=>uid},FourSymbolsStartupPolicy:{getUid:()=>uid,getState:()=>'READY'},
        FourSymbolsFirebaseLifecycle:{getUser:()=>({uid}),readHeroGrowth:()=>h.writer.read(h.request())},
        addEventListener:(name,fn)=>{events[name]=fn;}};
    let lost=true;c.FourSymbolsFirebaseLifecycle.claimHeroLoginReward=async intent=>{
        calls.push(structuredClone(intent));const result=await h.writer.claimLoginReward(h.request(intent));
        if(lost){lost=false;throw Object.assign(Error('lost'),{code:'unavailable'});}return result;
    };
    c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/hero-growth-client.js','utf8'),c);
    const api=c.FourSymbolsHeroGrowth;await api.read();await api.claimLoginReward(3);
    assert.equal(api.getStatus().pending.milestoneDay,3);
    await api.claimLoginReward(7);assert.equal(calls.length,1);
    await api.retry();assert.deepEqual(calls[0],calls[1]);assert.equal(api.getStatus().pending,null);
    assert.equal(api.getStatus().loginRewards[0].claimed,true);
    events['four-symbols:game-session-state']({detail:{status:'revoked'}});
    assert.equal(api.getStatus().loginRewards.length,0);
});
