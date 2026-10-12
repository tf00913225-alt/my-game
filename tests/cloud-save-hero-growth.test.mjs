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
function fixture({fragments=500,pills=2,owned=false}={}){
    const records=makeInitialCharacterSources(uid,2,"fixture-initial-0001",{
        displayName:"測試角色",element:"fire",gender:"female",attributes:{attack:3,vitality:2,
        energy:1,intelligence:2,defensePoints:1,agility:1}},{recordedAt:1700000000000});
    const account=records.progress.playableState.heroAccount;
    account.heroes[heroId].specificFragments=fragments;account.heroes[heroId].unlocked=owned;
    if(pills)records.inventory.push({schemaVersion:1,ownerUid:uid,serverRevision:2,
        provenance:"server-created",ownedItemId:"fixture-marrow-0001",location:"bag",
        state:{id:"heroMarrowPill",type:"material",count:pills}});
    const bundle=assembleCanonicalSnapshot(uid,2,records);
    const data=new Map([[env,{ownerUid:uid,serverRevision:2,authoritativeStateReady:false}]]);
    for(const key of ["account","economy","progress","relicLoadout","claimCheckpoint"]){
        data.set(`${root}/${key==="claimCheckpoint"?"claimCheckpoints":key}/current`,
            {...records[key],...(key==="account"?{snapshotSha256:bundle.sha256}:{})});
    }
    for(const key of ["characters","inventory"]){for(const row of records[key]){
        data.set(`${root}/${key}/${row.characterId||row.ownedItemId}`,row);
    }}
    data.set(`${root}/playableSnapshots/2`,bundle);
    data.set(`${root}/recoveryArchives/2`,createRecoveryArchive(uid,2,records,bundle));
    const ref=path=>({path,id:path.split("/").at(-1),collection:name=>collection(`${path}/${name}`)});
    const collection=path=>({path,query:true,doc:id=>ref(`${path}/${id}`)});
    let active=true,failWrites=false,tail=Promise.resolve();
    class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
    const deps={db:{collection},FieldValue:{serverTimestamp:()=>({seconds:1})},HttpsError,
        seed:()=>123,inspectExistingEnvelope:value=>({kind:"current",data:value,serverRevision:value.serverRevision}),
        nextRevision:envelope=>envelope.serverRevision+1,
        acquisition:{readInTransaction:async()=>({entitlements:{}})},
        runProtected:(request,operation)=>{
            const run=tail.then(async()=>{
                if(!active||request.data.uid!==uid||request.data.session!=="active"){throw new HttpsError("permission-denied","SESSION_INVALID");}
                const staged=new Map(structuredClone([...data]));let writing=false;
                const snap=(path,value)=>({id:path.split("/").at(-1),ref:ref(path),exists:value!==undefined,data:()=>value});
                const check=()=>{writing=true;if(failWrites)throw Error("transaction interrupted");};
                const tx={get:async r=>{assert.equal(writing,false);return r.query?{
                    docs:[...staged].filter(([p])=>p.startsWith(r.path+"/")&&p.split("/").length===r.path.split("/").length+1)
                        .map(([p,v])=>snap(p,v))}:snap(r.path,staged.get(r.path));},
                    update:(r,v)=>{check();assert.ok(staged.has(r.path));staged.set(r.path,{...staged.get(r.path),...v});},
                    create:(r,v)=>{check();assert.equal(staged.has(r.path),false);staged.set(r.path,v);},
                    delete:r=>{check();staged.delete(r.path);}};
                const value=await operation(tx,{uid,sessionId:"A".repeat(32)});
                data.clear();for(const entry of staged)data.set(...entry);return value;
            });tail=run.catch(()=>null);return run;
        }};
    const writer=createHeroGrowth(deps);
    const request=extra=>({data:{uid,session:"active",...extra}});
    const intent=(action,operationId=`growth-${action}-000001`,expectedRevision=data.get(env).serverRevision)=>
        request({action,operationId,heroId,expectedRevision});
    return {data,writer,request,intent,deps,revoke:()=>{active=false;},interrupt:()=>{failWrites=true;}};
}
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
