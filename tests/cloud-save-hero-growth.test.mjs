import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import vm from "node:vm";
const require=createRequire(import.meta.url);
const {createHeroGrowth}=require("../functions/src/hero-growth");
const {makeInitialCharacterSources}=require("../functions/src/initial-character-sources");
const {assembleCanonicalSnapshot}=require("../functions/src/canonical-snapshot");
const {createRecoveryArchive}=require("../functions/src/canonical-recovery-archive");
const Core=require("../functions/src/hero-core"),heroId="divineDogHongbao",uid="growth-fixture";
const root=`serverUsers/${uid}`,env=`users/${uid}/saves/current`;
const {fixture}=require('../.github/scripts/fixtures/hero-canonical-context.cjs');

test("canonical fragment unlock, star costs and pill consumption commit original Core with snapshots/archive",async()=>{
    const h=fixture();let r=await h.writer.mutate(h.intent("unlock"));
    assert.equal(r.heroAccount.heroes[heroId].specificFragments,400);
    assert.equal(r.heroAccount.heroes[heroId].unlocked,true);
    assert.ok(h.data.has(`${root}/uniqueClaims/hero-fragment-v1-${heroId}`));
    for(let star=0;star<5;star++){
        r=await h.writer.mutate(h.intent("starUp",`growth-star-step-0000${star}`));
        assert.equal(r.heroAccount.heroes[heroId].stars,star+1);
    }
    assert.equal(r.heroAccount.heroes[heroId].specificFragments,0);
    await assert.rejects(h.writer.mutate(h.intent("starUp","growth-star-max-00001")),{code:"failed-precondition"});
    r=await h.writer.mutate(h.intent("reroll"));assert.equal(r.marrowPills,1);
    assert.notEqual(r.heroAccount.heroes[heroId].allocationSeed,123);
    r=await h.writer.mutate(h.intent("reroll","growth-reroll-000002"));assert.equal(r.marrowPills,0);
    assert.equal(h.data.has(`${root}/inventory/fixture-marrow-0001`),false);
    await assert.rejects(h.writer.mutate(h.intent("reroll","growth-reroll-000003")),{code:"failed-precondition"});
    assert.equal(r.authoritativeStateReady,false);
});
test("identical retry returns immutable evidence after later growth; conflicting intent cannot reuse ID",async()=>{
    const h=fixture({owned:true}),intent=h.intent("starUp");
    const first=await h.writer.mutate(intent);await h.writer.mutate(h.intent("reroll"));
    const before=structuredClone([...h.data]),retry=await h.writer.mutate(intent);
    assert.deepEqual(retry.receipt,first.receipt);assert.deepEqual([...h.data],before);
    await assert.rejects(h.writer.mutate({...intent,data:{...intent.data,action:"reroll"}}),{code:"data-loss"});
});
test("concurrent same revision yields one spend; missing audit and interrupted transactions fail closed",async()=>{
    const h=fixture({owned:true}),a=h.intent("starUp","growth-concurrent-0001"),b=h.intent("starUp","growth-concurrent-0002");
    const results=await Promise.allSettled([h.writer.mutate(a),h.writer.mutate(b)]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(results.find(r=>r.status==="rejected").reason.code,"aborted");
    h.data.delete(`${root}/ledgerEntries/growth-concurrent-0001`);
    const before=structuredClone([...h.data]);await assert.rejects(h.writer.mutate(a),{code:"data-loss"});
    assert.deepEqual([...h.data],before);
    const f=fixture({owned:true}),original=structuredClone([...f.data]);f.interrupt();
    await assert.rejects(f.writer.mutate(f.intent("starUp")),/interrupted/);assert.deepEqual([...f.data],original);
});
test("zero official resources, extra client balances, UID/session and damaged recovery cannot spend",async()=>{
    const h=fixture({fragments:0,pills:0,owned:true});
    await assert.rejects(h.writer.mutate(h.intent("starUp")),{code:"failed-precondition"});
    const intent=h.intent("reroll");await assert.rejects(h.writer.mutate({data:{...intent.data,marrowPills:100}}),{code:"invalid-argument"});
    await assert.rejects(h.writer.mutate({data:{...intent.data,uid:"another"}}),{code:"permission-denied"});
    h.data.delete(`${root}/recoveryArchives/2`);await assert.rejects(h.writer.read(h.request()),{code:"data-loss"});
    h.revoke();await assert.rejects(h.writer.read(h.request()),{code:"permission-denied"});
});
function client(hostname){
    const handlers={},c={location:{hostname},FourSymbolsHeroCore:Core,navigator:{onLine:true},
        crypto:{getRandomValues:a=>{a[0]=999;},randomUUID:()=>"12345678-1234-1234-1234-123456789abc"},
        FourSymbolsAccountSave:{getActiveUid:()=>uid},FourSymbolsFirebaseLifecycle:{getUser:()=>({uid})},
        FourSymbolsStartupPolicy:{getUid:()=>uid,getState:()=>"READY"},addEventListener:(type,fn)=>{handlers[type]=fn;}};
    c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/hero-growth-client.js","utf8"),c);
    return {c,handlers};
}
test("DEV fixture is exact-host-only, session-only, single activation and shares unchanged Core",async()=>{
    const {c}=client("dev.four-symbols-dev.pages.dev"),api=c.FourSymbolsHeroGrowth;
    api.testResources();assert.equal(api.getAccount().heroes[heroId].specificFragments,500);
    await api.mutate(heroId,"unlock");await api.mutate(heroId,"starUp");await api.mutate(heroId,"reroll");
    assert.equal(api.getAccount().heroes[heroId].specificFragments,375);assert.equal(api.getStatus().marrowPills,4);
    api.testResources();assert.equal(api.getStatus().marrowPills,4);
    assert.equal(client("dev.four-symbols-dev.pages.dev").c.FourSymbolsHeroGrowth.getAccount(),null);
    const other=client("four-symbols-dev.pages.dev").c.FourSymbolsHeroGrowth;other.testResources();assert.equal(other.getAccount(),null);
    c.isHeroGrowthBattleActive=()=>true;await api.mutate(heroId,"starUp");assert.equal(api.getAccount().heroes[heroId].stars,1);
});
test("real growth client preserves identical intent after lost response and does not trust old local resources",async()=>{
    const h=fixture({owned:true}),{c}=client("production.invalid"),calls=[];
    c.FourSymbolsFirebaseLifecycle.readHeroGrowth=()=>h.writer.read(h.request());
    let lost=true;
    c.FourSymbolsFirebaseLifecycle.mutateHeroGrowth=async intent=>{
        calls.push(structuredClone(intent));const result=await h.writer.mutate(h.request(intent));
        if(lost){lost=false;throw Object.assign(Error("lost response"),{code:"unavailable"});}
        return result;
    };
    const api=c.FourSymbolsHeroGrowth;await api.read();await api.mutate(heroId,"starUp");
    assert.ok(api.getStatus().pending);assert.equal(h.data.get(env).serverRevision,3);
    await api.mutate(heroId,"reroll");assert.equal(calls.length,1,"unknown outcome blocks other intent");
    await api.read(); // Current eligibility may change; explicit retry remains available.
    await api.retry();assert.deepEqual(calls[0],calls[1]);
    assert.equal(h.data.get(env).serverRevision,3);assert.equal(api.getStatus().pending,null);
    assert.equal(api.getAccount().heroes[heroId].stars,1);
    c.player={id:"fixture-player",level:20};c.player2=null;c.player3=null;
    c.calculateCharacterBaseStats=()=>({});c.skillDatabase={};
    const main=fs.readFileSync("js/00-main.js","utf8"),start=main.indexOf("let heroAccountState=");
    vm.runInContext(main.slice(start,main.indexOf("\n});",start)+4),c);
    const old=Core.normalizeAccountState();old.heroes[heroId].specificFragments=999999;
    c.FourSymbolsHeroSystem.replaceAccountState(old);
    const state=c.FourSymbolsHeroSystem.getDomain().getHeroAccountState(heroId);
    assert.equal(state.stars,1);assert.equal(state.specificFragments,475);
});
test("UID/session invalidation rejects in-flight response and clears busy/proof/test resources",async()=>{
    const {c,handlers}=client("dev.four-symbols-dev.pages.dev"),api=c.FourSymbolsHeroGrowth;
    api.testResources();let resolve;
    c.FourSymbolsFirebaseLifecycle.readHeroGrowth=()=>new Promise(done=>{resolve=done;});
    const reading=api.read();assert.equal(api.getStatus().busy,true);
    handlers["four-symbols:game-session-state"]({detail:{status:"revoked"}});
    assert.equal(api.getStatus().busy,false);assert.equal(api.getAccount(),null);
    resolve({schemaVersion:1,ownerUid:uid,serverRevision:2,heroAccount:Core.normalizeAccountState(),
        marrowPills:99,authoritativeStateReady:false});await reading;
    assert.equal(api.getAccount(),null);assert.equal(api.getStatus().marrowPills,0);
});
