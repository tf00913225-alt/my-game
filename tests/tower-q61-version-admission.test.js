"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const main=fs.readFileSync("js/00-main.js","utf8");
const operations=main.split("/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */")[1].split("/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */")[0];
const repository=fs.readFileSync("js/startup/account-save-repository.js","utf8");
const tower=fs.readFileSync("js/gameplay-boss-tower-system.js","utf8");
const save=version=>({player:{id:"q61-player"},gameplayProgress:{version,tower:{claimedFloors:{10:true}}}});
function fixture(initial){
    const values=new Map(),store={getItem:key=>values.get(key)??null,
        setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
    const context=vm.createContext({console,localStorage:store});context.window=context;
    vm.runInContext(repository+operations,context);
    const repo=context.FourSymbolsAccountSave;repo.activate("q61-uid");
    if(initial){
        store.setItem(repo.saveKey("q61-uid"),JSON.stringify(initial));
        store.setItem(repo.metadataKey("q61-uid"),JSON.stringify({ownerUid:"q61-uid",schemaVersion:2}));
    }
    store.setItem(repo.accountKey("progress"),JSON.stringify({preserve:true}));
    return {repo,values};
}
const code=expected=>error=>error.code===expected;

test("v1 writer refuses unsupported incoming and stored versions without any storage mutation",()=>{
    for(const version of [2,3,"1",null]){
        for(const initial of [null,save(1),save(version)]){
            const {repo,values}=fixture(initial),before=JSON.stringify([...values]);
            assert.throws(()=>repo.writeForUid("q61-uid",initial?.gameplayProgress.version===version?save(1):save(version)),
                code("account-gameplay-version-unsupported"));
            assert.equal(JSON.stringify([...values]),before);
        }
    }
});

test("v1 claim history cannot be dropped by omission, null or an unversioned replacement",()=>{
    for(const progress of [undefined,null,{}, {tower:{claimedFloors:{}}}]){
        const {repo,values}=fixture(save(1)),before=JSON.stringify([...values]);
        assert.throws(()=>repo.writeForUid("q61-uid",{player:{id:"q61-player"},gameplayProgress:progress}),
            code("account-gameplay-version-downgrade"));
        assert.equal(JSON.stringify([...values]),before);
    }
});

test("ordinary v1 writes and unversioned legacy saves remain supported",()=>{
    for(const initial of [null,{player:{id:"legacy"}},save(1)]){
        const {repo}=fixture(initial);
        repo.writeForUid("q61-uid",save(1));
        assert.equal(repo.readActive().save.gameplayProgress.version,1);
    }
    const {repo}=fixture(null);
    repo.writeForUid("q61-uid",{player:{id:"legacy"}});
    assert.equal(repo.readActive().save.player.id,"legacy");
});

test("unsupported cloud bundles fail screening before adoption or backups",()=>{
    const {repo,values}=fixture(null),before=JSON.stringify([...values]);
    const sidecars=Object.fromEntries(repo.BACKUP_SIDECARS.map(key=>[key,{status:"present",raw:"{}"}]));
    const bundle={bundleVersion:1,ownerUid:"q61-uid",serverRevision:1,canonicalRevision:1,
        sourceSnapshotSha256:"a".repeat(64),gameSave:save(2),sidecars};
    assert.throws(()=>repo.inspectCloudBundle("q61-uid",bundle),code("account-gameplay-version-unsupported"));
    assert.equal(JSON.stringify([...values]),before);
});

test("Tower bootstrap does not hydrate, persist or install writable callbacks for future schemas",()=>{
    for(const version of [2,3,"1"]){
        const stored=save(version),before=JSON.stringify(stored);let writes=0;
        const context=vm.createContext({console,FourSymbolsAccountSave:{
            getActiveUid:()=>"q61-uid",saveKey:()=>"q61-key",
            readForUid:()=>({status:"ready",save:stored}),writeForUid:()=>{writes++;}},
            saveGame:()=>{writes++;}});
        context.window=context;
        vm.runInContext(tower,context);
        assert.equal(writes,0);
        assert.equal(context.GameplaySystem,undefined);
        assert.equal(context.vGameplaySelectTowerBand,undefined);
        assert.equal(JSON.stringify(stored),before);
    }
});
