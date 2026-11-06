"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync("js/startup/account-save-repository.js","utf8")+
    fs.readFileSync("js/00-main.js","utf8").split("/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */")[1].split("/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */")[0];
const code=value=>error=>error?.code===value;
function fixture(seed){
    const values=new Map(seed||[]),events=[];let hook=()=>{};
    const storage={getItem(key){hook("get",key,null);return values.has(key)?values.get(key):null;},
        setItem(key,value){hook("before-set",key,String(value));values.set(key,String(value));events.push(["set",key]);hook("after-set",key,String(value));},
        removeItem(key){hook("before-remove",key,null);values.delete(key);events.push(["remove",key]);hook("after-remove",key,null);}};
    const context=vm.createContext({console,localStorage:storage});context.window=context;
    vm.runInContext(source,context);
    return {repo:context.FourSymbolsAccountSave,values,events,hook:fn=>{hook=fn;}};
}
function existing(){
    const f=fixture();f.repo.activate("pending-uid");
    f.repo.writeForUid("pending-uid",{player:{id:"before"}});
    f.events.length=0;
    return {...f,uid:"pending-uid",main:f.repo.saveKey("pending-uid"),meta:f.repo.metadataKey("pending-uid"),
        shop:f.repo.accountKey("equipment-shop-daily","pending-uid")};
}
const next={player:{id:"after"}};
const opts={equipmentShopState:{refreshCount:1}};

test("ordinary success saves main and shop before final metadata",()=>{
    const f=existing();f.repo.writeForUid(f.uid,next,opts);
    assert.deepEqual(f.events,[["set",f.meta],["set",f.main],["set",f.shop],["set",f.meta]]);
    assert.equal(f.repo.readForUid(f.uid).save.player.id,"after");
    assert.equal(JSON.parse(f.values.get(f.shop)).refreshCount,1);
});

test("fresh readers block every pre-commit snapshot and accept final snapshot",()=>{
    const f=existing(),snapshots=[];
    f.hook((operation,key)=>{if(operation==="after-set"&&[f.main,f.meta,f.shop].includes(key))snapshots.push([...f.values]);});
    f.repo.writeForUid(f.uid,next,opts);
    assert.equal(snapshots.length,4);
    for(const snapshot of snapshots.slice(0,3)){
        const restarted=fixture(snapshot);
        assert.throws(()=>restarted.repo.readForUid(f.uid),code("account-local-write-incomplete"));
    }
    assert.equal(fixture(snapshots[3]).repo.readForUid(f.uid).save.player.id,"after");
});

test("marker write or readback failure cannot write main or shop",()=>{
    for(const phase of ["write","readback"]){
        const f=existing(),beforeMain=f.values.get(f.main),beforeShop=f.values.get(f.shop);let marked=false;
        f.hook((op,key,value)=>{
            if(phase==="write"&&op==="before-set"&&key===f.meta)throw Error("marker write");
            if(op==="after-set"&&key===f.meta&&value.includes('localWritePending'))marked=true;
            if(phase==="readback"&&marked&&op==="get"&&key===f.meta)throw Error("marker read");
        });
        assert.throws(()=>f.repo.writeForUid(f.uid,next,opts),code(phase==="write"?"account-save-write-failed":"account-local-write-incomplete"));
        assert.equal(f.values.get(f.main),beforeMain);assert.equal(f.values.get(f.shop),beforeShop);
        f.hook(()=>{});
        if(phase==="readback")assert.throws(()=>fixture([...f.values]).repo.readForUid(f.uid),code("account-local-write-incomplete"));
        else assert.equal(f.repo.readForUid(f.uid).save.player.id,"before");
    }
});

test("main, shop, readback and final metadata failures restore all before bytes",()=>{
    for(const failure of ["main","main-read","shop","shop-read","final-meta"]){
        const f=existing(),before=[...f.values];let marker=false,main=false,shop=false,failed=false;
        f.hook((op,key,value)=>{
            if(op==="after-set"&&key===f.meta&&value.includes('localWritePending'))marker=true;
            if(op==="after-set"&&key===f.main&&marker)main=true;
            if(op==="after-set"&&key===f.shop&&marker)shop=true;
            if(failed)return;
            if(failure==="main"&&marker&&op==="before-set"&&key===f.main||
               failure==="main-read"&&main&&op==="get"&&key===f.main||
               failure==="shop"&&marker&&op==="before-set"&&key===f.shop||
               failure==="shop-read"&&shop&&op==="get"&&key===f.shop||
               failure==="final-meta"&&shop&&op==="before-set"&&key===f.meta){failed=true;throw Error(failure);}
        });
        assert.throws(()=>f.repo.writeForUid(f.uid,next,opts),code("account-save-write-failed"));
        f.hook(()=>{});assert.deepEqual([...f.values],before,failure);
        assert.equal(fixture([...f.values]).repo.readForUid(f.uid).save.player.id,"before");
    }
});

test("rollback failure on main, shop or metadata leaves marker and restart blocked",()=>{
    for(const target of ["main","shop","meta"]){
        const f=existing();let marker=false,commitFailed=false;
        f.hook((op,key,value)=>{
            if(op==="after-set"&&key===f.meta&&value.includes('localWritePending'))marker=true;
            if(marker&&!commitFailed&&op==="before-set"&&key===f.meta&&!value.includes('localWritePending')){commitFailed=true;throw Error("final metadata");}
            if(commitFailed&&((target==="main"&&key===f.main)||(target==="shop"&&key===f.shop)||(target==="meta"&&key===f.meta))&&
               (op==="before-set"||op==="before-remove"))throw Error("rollback "+target);
        });
        assert.throws(()=>f.repo.writeForUid(f.uid,next,opts),code("account-local-rollback-failed"));
        f.hook(()=>{});assert.throws(()=>fixture([...f.values]).repo.readForUid(f.uid),code("account-local-write-incomplete"));
    }
});

test("orphan, malformed and valid marker metadata block all writer entrances",()=>{
    for(const marker of [{version:1},false,null,{}, {version:2}, {version:1,extra:true}]){
        const f=existing(),error=marker?.version===1&&Object.keys(marker).length===1?"account-local-write-incomplete":"account-metadata-corrupt";
        f.values.delete(f.main);f.values.set(f.meta,JSON.stringify({ownerUid:f.uid,localWritePending:marker}));
        const before=[...f.values];
        assert.throws(()=>f.repo.readForUid(f.uid),code(error));
        assert.throws(()=>f.repo.writeForUid(f.uid,next),code(error));
        assert.throws(()=>f.repo.writeForUid(f.uid,next,{cloudBundle:{}}),code(error));
        assert.throws(()=>f.repo.migrateLegacyToUid(f.uid,{confirmed:true,cloudHasCharacter:false}),()=>true);
        assert.deepEqual([...f.values],before);
    }
});

test("independent migration marker blocks empty, reads, writers, delete and recovery",()=>{
    const uid="pending-migration",key="four_symbols_migration_pending:"+uid;
    for(const [raw,expected] of [
        [JSON.stringify({version:1,kind:"legacy",ownerUid:uid,transactionId:"a".repeat(32)}),"account-migration-incomplete"],
        ["null","account-migration-marker-corrupt"],["false","account-migration-marker-corrupt"],
        [JSON.stringify({version:1,kind:"legacy",ownerUid:"other",transactionId:"a".repeat(32)}),"account-migration-marker-corrupt"],
        [JSON.stringify({version:1,kind:"legacy",ownerUid:uid,transactionId:"a".repeat(32),extra:"x".repeat(512)}),"account-migration-marker-corrupt"]]){
        const f=fixture([[key,raw],["battle_full_version_save_v5",JSON.stringify({player:{id:"legacy"}})]]);
        f.repo.activate(uid);const before=[...f.values],eventCount=f.events.length;
        assert.throws(()=>f.repo.readForUid(uid),code(expected));
        assert.throws(()=>f.repo.writeForUid(uid,next),code(expected));
        assert.throws(()=>f.repo.writeForUid(uid,next,{cloudBundle:{}}),code(expected));
        assert.throws(()=>f.repo.migrateLegacyToUid(uid,{confirmed:true,cloudHasCharacter:false}),code(expected));
        assert.throws(()=>f.repo.removeActive(),code(expected));
        assert.throws(()=>f.repo.recoverArchivedMigrationSidecars(uid),code(expected));
        assert.deepEqual([...f.values],before);
        assert.equal(f.events.length,eventCount,"guarded calls must not write or remove keys");
        assert.throws(()=>fixture([...f.values]).repo.readForUid(uid),code(expected));
    }
});

test("pending key read failure is not interpreted as an empty account",()=>{
    const f=fixture();f.repo.activate("pending-read");
    f.hook((op,key)=>{if(op==="get"&&key==="four_symbols_migration_pending:pending-read")throw Error("storage unavailable");});
    assert.throws(()=>f.repo.readForUid("pending-read"),/storage unavailable/);
    assert.throws(()=>f.repo.writeForUid("pending-read",next),/storage unavailable/);
    assert.equal(f.values.has(f.repo.saveKey("pending-read")),false);
});

test("legacy without marker and empty accounts retain original behavior",()=>{
    const f=fixture();f.repo.activate("legacy-uid");
    assert.equal(f.repo.readForUid("legacy-uid").status,"empty");
    f.values.set(f.repo.saveKey("legacy-uid"),JSON.stringify({player:{id:"legacy"}}));
    f.values.set(f.repo.metadataKey("legacy-uid"),JSON.stringify({ownerUid:"legacy-uid"}));
    assert.equal(f.repo.readForUid("legacy-uid").save.player.id,"legacy");
    f.repo.writeForUid("legacy-uid",next);assert.equal(f.repo.readForUid("legacy-uid").save.player.id,"after");
});

test("UID switch or same-UID reentry during marker staging cannot commit another save",()=>{
    for(const action of ["switch","reentry"]){
        const f=existing(),beforeMain=f.values.get(f.main);let once=false,reentryCode;
        f.hook((op,key,value)=>{
            if(once||op!=="after-set"||key!==f.meta||!value.includes('localWritePending'))return;
            once=true;
            if(action==="switch")f.repo.activate("other-uid");
            else try{f.repo.writeForUid(f.uid,{player:{id:"intruder"}});}catch(error){reentryCode=error.code;}
        });
        if(action==="switch")assert.throws(()=>f.repo.writeForUid(f.uid,next),code("account-save-write-failed"));
        else {f.repo.writeForUid(f.uid,next);assert.equal(reentryCode,"account-save-reentrant");}
        if(action==="switch")assert.equal(f.values.get(f.main),beforeMain);
        assert.equal(f.values.has(f.repo.saveKey("other-uid")),false);
    }
});

test("serialization reentry is rejected before a second write can start",()=>{
    const f=existing();let reentryCode;
    const outer={player:{id:"after"},toJSON(){
        try{f.repo.writeForUid(f.uid,{player:{id:"intruder"}});}catch(error){reentryCode=error.code;}
        return {player:this.player};
    }};
    f.repo.writeForUid(f.uid,outer);
    assert.equal(reentryCode,"account-save-reentrant");
    assert.equal(f.repo.readForUid(f.uid).save.player.id,"after");
});

test("final metadata read failure returns unknown without rolling back validated after bytes",()=>{
    const f=existing();let finalWritten=false,failed=false;
    f.hook((op,key,value)=>{
        if(op==="after-set"&&key===f.meta&&!value.includes('localWritePending'))finalWritten=true;
        if(finalWritten&&!failed&&op==="get"&&key===f.meta){failed=true;throw Error("final read");}
    });
    assert.throws(()=>f.repo.writeForUid(f.uid,next,opts),code("account-local-commit-unknown"));
    f.hook(()=>{});
    assert.equal(f.repo.readForUid(f.uid).save.player.id,"after");
    assert.equal(JSON.parse(f.values.get(f.shop)).refreshCount,1);
    assert.deepEqual(f.events,[["set",f.meta],["set",f.main],["set",f.shop],["set",f.meta]]);
});

test("rollback metadata read failure does not report successful restoration",()=>{
    const f=existing();let marker=false,failedCommit=false,restoredMeta=false;
    f.hook((op,key,value)=>{
        if(op==="after-set"&&key===f.meta&&value.includes('localWritePending'))marker=true;
        if(marker&&!failedCommit&&op==="before-set"&&key===f.main){failedCommit=true;throw Error("main write");}
        if(failedCommit&&op==="after-set"&&key===f.meta&&!value.includes('localWritePending'))restoredMeta=true;
        if(restoredMeta&&op==="get"&&key===f.meta)throw Error("metadata rollback read");
    });
    assert.throws(()=>f.repo.writeForUid(f.uid,next),code("account-local-rollback-failed"));
    f.hook(()=>{});assert.equal(f.repo.readForUid(f.uid).save.player.id,"before");
});

test("characterization: uncooperative old client can still interleave and defeat the marker",()=>{
    const f=existing(),oldMeta=f.values.get(f.meta);let injected=false;
    f.hook((op,key)=>{
        if(!injected&&op==="before-set"&&key===f.shop){
            injected=true;
            // Another old context bypasses the new writer/marker contract.
            f.values.set(f.main,JSON.stringify({player:{id:"other-tab"}}));
            f.values.set(f.meta,oldMeta);
        }
    });
    f.repo.writeForUid(f.uid,next,opts);
    assert.equal(f.repo.readForUid(f.uid).save.player.id,"other-tab",
        "known limitation, not a cross-context safety PASS");
});

test("legacy migration preserves committed bytes after unknown final metadata read",()=>{
    const legacy=JSON.stringify({player:{id:"legacy-original"}}),uid="migration-unknown";
    const f=fixture([["battle_full_version_save_v5",legacy],["v131_element_box_state",'{"old":true}']]);
    const meta=f.repo.metadataKey(uid),main=f.repo.saveKey(uid);let committed=false,readFailed=false;
    f.hook((op,key,value)=>{
        if(op==="after-set"&&key===meta&&!value.includes('localWritePending'))committed=true;
        if(committed&&!readFailed&&op==="get"&&key===meta){readFailed=true;throw Error("final metadata read");}
    });
    assert.throws(()=>f.repo.migrateLegacyToUid(uid,{confirmed:true,cloudHasCharacter:false}),
        code("account-local-commit-unknown"));
    f.hook(()=>{});
    assert.equal(f.values.get(main),legacy,"possibly committed main is preserved");
    assert.equal(f.values.has(meta),true,"possibly committed metadata is preserved");
    assert.equal(f.values.get("battle_full_version_save_v5"),legacy);
    assert.ok([...f.values.keys()].some(key=>key.startsWith("four_symbols_legacy_backup:"+uid+":")));
    assert.equal(f.events.some(([op])=>op==="remove"),false,"unknown result must not trigger cleanup");
    assert.equal(f.values.has(f.repo.accountKey("element-box-state",uid)),false,"sidecar loop did not run");
    assert.equal(fixture([...f.values]).repo.readForUid(uid).status,"ready",
        "known remaining gap: partial migration may look ready after reload");
});

test("legacy migration preserves marker on unreadable staging or failed rollback",()=>{
    for(const failure of ["marker-read","rollback"]){
        const uid="migration-"+failure,legacy=JSON.stringify({player:{id:"legacy"}});
        const f=fixture([["battle_full_version_save_v5",legacy]]),meta=f.repo.metadataKey(uid),main=f.repo.saveKey(uid);
        let marker=false,mainWritten=false,failed=false,metaCommitFailed=false;
        f.hook((op,key,value)=>{
            if(op==="after-set"&&key===meta&&value.includes('localWritePending'))marker=true;
            if(failure==="marker-read"&&marker&&!failed&&op==="get"&&key===meta){failed=true;throw Error("marker read");}
            if(op==="after-set"&&key===main)mainWritten=true;
            if(failure==="rollback"&&mainWritten&&!metaCommitFailed&&op==="before-set"&&key===meta){metaCommitFailed=true;throw Error("final metadata");}
            if(failure==="rollback"&&metaCommitFailed&&op==="before-remove"&&key===main)throw Error("main rollback");
        });
        assert.throws(()=>f.repo.migrateLegacyToUid(uid,{confirmed:true,cloudHasCharacter:false}),
            code(failure==="marker-read"?"account-local-write-incomplete":"account-local-rollback-failed"));
        f.hook(()=>{});
        assert.ok(JSON.parse(f.values.get(meta)).localWritePending);
        assert.equal(f.values.get("battle_full_version_save_v5"),legacy);
        assert.ok([...f.values.keys()].some(key=>key.startsWith("four_symbols_legacy_backup:"+uid+":")));
        assert.throws(()=>fixture([...f.values]).repo.readForUid(uid),code("account-local-write-incomplete"));
    }
});

test("known marker-write failure does not become an unknown result",()=>{
    const uid="migration-known",legacy=JSON.stringify({player:{id:"legacy"}}),f=fixture([["battle_full_version_save_v5",legacy]]);
    const meta=f.repo.metadataKey(uid);let failed=false;
    f.hook((op,key)=>{if(!failed&&op==="before-set"&&key===meta){failed=true;throw Error("marker write");}});
    assert.throws(()=>f.repo.migrateLegacyToUid(uid,{confirmed:true,cloudHasCharacter:false}),code("account-save-write-failed"));
    f.hook(()=>{});assert.equal(f.repo.readForUid(uid).status,"empty");
    assert.equal(f.values.get("battle_full_version_save_v5"),legacy);
});

test("unknown result after UID switch leaves both accounts untouched by cleanup",()=>{
    const uid="migration-switch",other="other-uid",legacy=JSON.stringify({player:{id:"legacy"}});
    const f=fixture([["battle_full_version_save_v5",legacy]]),meta=f.repo.metadataKey(uid),main=f.repo.saveKey(uid);
    f.repo.activate(other);f.repo.writeForUid(other,{player:{id:"other"}});
    const otherMain=f.values.get(f.repo.saveKey(other)),otherMeta=f.values.get(f.repo.metadataKey(other));
    let committed=false,failed=false;
    f.hook((op,key,value)=>{
        if(op==="after-set"&&key===meta&&!value.includes('localWritePending'))committed=true;
        if(committed&&!failed&&op==="get"&&key===meta){failed=true;f.repo.activate(other);throw Error("final read");}
    });
    assert.throws(()=>f.repo.migrateLegacyToUid(uid,{confirmed:true,cloudHasCharacter:false}),code("account-local-commit-unknown"));
    f.hook(()=>{});
    assert.equal(f.values.get(main),legacy);assert.ok(f.values.has(meta));
    assert.equal(f.values.get(f.repo.saveKey(other)),otherMain);
    assert.equal(f.values.get(f.repo.metadataKey(other)),otherMeta);
});
