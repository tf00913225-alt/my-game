import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import test from "node:test";
const require=createRequire(import.meta.url);
const {validateMigrationBackup,LEGACY_BACKUP_SIDECARS}=require("../functions/src/cloud-save-policy.js");
const sha=value=>createHash("sha256").update(value,"utf8").digest("hex");
function seal(sidecars){
    const ownerUid="uid-a",mainRaw=JSON.stringify({version:6,player:{id:"hero",level:3},gold:7}),
        metadataRaw=JSON.stringify({ownerUid}),mainFingerprint="v1:1:"+"a".repeat(32),
        sidecarManifestFingerprint="v1:1:"+"b".repeat(32);
    return {schemaVersion:2,ownerUid,mainRaw,metadataRaw,sidecars,mainFingerprint,sidecarManifestFingerprint,
        backupId:`four_symbols_migration_backup:${ownerUid}:${mainFingerprint}:${sidecarManifestFingerprint}`,
        sidecarManifestSha256:sha(JSON.stringify(sidecars)),
        backupSha256:sha(JSON.stringify({ownerUid,mainRaw,metadataRaw,sidecars}))};
}
const entries=()=>Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>[key,{status:"missing",raw:null}]));
test("sealed task preference bytes survive migration intake without normalization or claim authority",()=>{
    for(const entry of [{status:"missing",raw:null},{status:"present",raw:' {"top":123.5,"collapsed":true} '},
        {status:"present",raw:"corrupt-ui-preference"},{status:"present",raw:'{"constructor":{"claim":true}}'}]){
        const sidecars=entries();sidecars["task-tracker"]=entry;
        const bundle=seal(sidecars),before=structuredClone(bundle),result=validateMigrationBackup(bundle,"uid-a");
        assert.deepEqual(result.backup,bundle);assert.deepEqual(bundle,before);
        assert.equal(result.backupSha256,bundle.backupSha256);
        assert.equal(result.sidecarManifestSha256,bundle.sidecarManifestSha256);
        assert.equal(result.snapshot.gold,7);
        assert.equal(Object.hasOwn(result,"authoritativeStateReady"),false);
        assert.equal(Object.hasOwn(result,"trusted"),false);
        const tampered=structuredClone(bundle);tampered.sidecars["task-tracker"]={status:"present",raw:'{"top":0}'};
        assert.throws(()=>validateMigrationBackup(tampered,"uid-a"),/digest/);
        assert.notEqual(seal(tampered.sidecars).backupSha256,bundle.backupSha256);
    }
});
test("task preference exemption cannot skip UID, manifest, entry-shape or backup size gates",()=>{
    const sidecars=entries();sidecars["task-tracker"]={status:"present",raw:"corrupt-ui-preference"};
    assert.throws(()=>validateMigrationBackup(seal(sidecars),"uid-b"),/UID-owned/);
    const incomplete=structuredClone(sidecars);delete incomplete["task-tracker"];
    assert.throws(()=>validateMigrationBackup(seal(incomplete),"uid-a"),/inventory/);
    for(const entry of [{status:"present",raw:null},{status:"missing",raw:"bytes"},
        {status:"not-applicable",raw:null},{status:"present",raw:4}]){
        assert.throws(()=>validateMigrationBackup(seal({...sidecars,"task-tracker":entry}),"uid-a"),/sidecar is invalid/);
    }
    assert.throws(()=>validateMigrationBackup(seal({...sidecars,"task-tracker":{
        status:"present",raw:"x".repeat(700*1024)}}),"uid-a"),/Backup bytes/);
});
test("every non-device source still requires JSON and rejects forbidden claim keys",()=>{
    for(const key of LEGACY_BACKUP_SIDECARS.filter(k=>!["announcement-read","bulk-sell-quality",
        "patrol-character-index","task-tracker"].includes(k))){
        for(const raw of ["corrupt-claim",'{"constructor":{}}']){
            const sidecars=entries();sidecars["task-tracker"]={status:"present",raw:"corrupt-ui-preference"};
            sidecars[key]={status:"present",raw};
            assert.throws(()=>validateMigrationBackup(seal(sidecars),"uid-a"),/sidecar JSON/,key);
        }
    }
});
