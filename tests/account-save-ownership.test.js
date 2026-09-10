"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync("js/startup/account-save-repository.js","utf8");

function storage(seed=[]){
    const values=new Map(seed.map(([key,value])=>[String(key),String(value)]));
    let failKey=null;
    return {
        values,
        failOn(key){ failKey=key; },
        getItem(key){ return values.has(String(key))?values.get(String(key)):null; },
        setItem(key,value){ if(String(key)===failKey){ throw new Error("quota fixture"); } values.set(String(key),String(value)); },
        removeItem(key){ values.delete(String(key)); }
    };
}
function repository(store=storage()){
    const context=vm.createContext({console,JSON,Date,Error,Object,Array,String,localStorage:store,window:null});
    context.window=context;
    vm.runInContext(source,context);
    return {repo:context.FourSymbolsAccountSave,store};
}
function code(expected){ return error=>error&&error.code===expected; }

{
    const {repo}=repository();
    repo.activate("uid-A");
    repo.writeForUid("uid-A",{player:{id:"角色A"},inventoryItems:["A"]},{source:"test"});
    assert.equal(repo.readActive().save.player.id,"角色A");
    assert.equal(repo.accountKey("progress"),"four_symbols_account:uid-A:progress");

    repo.activate("uid-B");
    assert.equal(repo.readActive().status,"empty","UID B must not inherit UID A's active save");
    assert.throws(()=>repo.writeForUid("uid-A",{player:{id:"污染"}}),code("account-not-active"));
    repo.writeForUid("uid-B",{player:{id:"角色B"},inventoryItems:["B"]},{source:"test"});
    assert.equal(repo.readActive().save.player.id,"角色B");
    repo.activate("uid-A");
    assert.equal(repo.readActive().save.player.id,"角色A");
}

{
    const {repo,store}=repository();
    store.setItem(repo.saveKey("uid-corrupt"),"{broken");
    store.setItem(repo.metadataKey("uid-corrupt"),JSON.stringify({ownerUid:"uid-corrupt"}));
    assert.throws(()=>repo.readForUid("uid-corrupt"),code("account-save-corrupt"));
    store.removeItem(repo.metadataKey("uid-corrupt"));
    assert.throws(()=>repo.readForUid("uid-corrupt"),code("account-save-incomplete"));
}

{
    const legacy={player:{id:"舊角色"},inventoryItems:["legacy"]};
    const oldSidecar=JSON.stringify({remainingMs:1000});
    const {repo,store}=repository(storage([
        ["battle_full_version_save_v5",JSON.stringify(legacy)],
        ["v131_element_box_state",oldSidecar]
    ]));
    assert.throws(()=>repo.migrateLegacyToUid("uid-migrate",{}),code("migration-confirmation-required"));
    assert.throws(()=>repo.migrateLegacyToUid("uid-migrate",{confirmed:true,cloudHasCharacter:true}),code("migration-conflict"));
    assert.equal(repo.readForUid("uid-migrate").status,"empty");
    const result=repo.migrateLegacyToUid("uid-migrate",{confirmed:true,cloudHasCharacter:false});
    assert.equal(repo.readForUid("uid-migrate").save.player.id,"舊角色");
    assert.equal(store.getItem("battle_full_version_save_v5"),JSON.stringify(legacy),"canonical legacy key must remain untouched");
    assert.equal(store.getItem(repo.accountKey("element-box-state","uid-migrate")),oldSidecar);
    assert.ok(result.backupKeys.every(key=>store.getItem(key)!==null),"every migrated payload has a backup");
}

{
    const legacy=JSON.stringify({player:{id:"不可破壞"}});
    const {repo,store}=repository(storage([
        ["battle_full_version_save_v5",legacy],
        ["v131_element_box_state",JSON.stringify({active:true})],
        ["four_symbols_account:uid-rollback:element-box-state",JSON.stringify({owner:"existing"})]
    ]));
    assert.throws(()=>repo.migrateLegacyToUid("uid-rollback",{confirmed:true,cloudHasCharacter:false}),code("migration-sidecar-conflict"));
    assert.equal(store.getItem("battle_full_version_save_v5"),legacy);
    assert.equal(repo.readForUid("uid-rollback").status,"empty","failed migration must roll account save back");
    assert.equal(JSON.parse(store.getItem("four_symbols_account:uid-rollback:element-box-state")).owner,"existing");
    assert.ok([...store.values.keys()].some(key=>key.startsWith("four_symbols_legacy_backup:uid-rollback:")),"failure keeps a recovery backup");
}

{
    const {repo,store}=repository();
    repo.activate("uid-atomic");
    store.failOn(repo.metadataKey("uid-atomic"));
    assert.throws(()=>repo.writeForUid("uid-atomic",{player:{id:"partial"}}),code("account-save-write-failed"));
    assert.equal(store.getItem(repo.saveKey("uid-atomic")),null,"failed two-key commit rolls back its data key");
}

console.log("✓ account-aware local ownership, switching, corruption and migration safety");
