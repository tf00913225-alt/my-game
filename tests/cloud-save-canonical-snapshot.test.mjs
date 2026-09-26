import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {assembleCanonicalSnapshot,inspectCanonicalSnapshot,
    verifyCanonicalSnapshotAgainstSources}=require(
    "../functions/src/canonical-snapshot.js");
const {LEGACY_BACKUP_SIDECARS}=require("../functions/src/cloud-save-policy.js");
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

function sources(count=1){
    const base={schemaVersion:1,ownerUid:"uid-a",serverRevision:7,
        provenance:"grandfathered-unverified-history"};
    const ids=["char-a",count>=2?"char-b":null,count>=3?"char-c":null];
    const chars=ids.flatMap((id,slotIndex)=>id?[{
        ...base,characterId:id,slotIndex,displayName:`hero-${slotIndex}`,
        element:["water","earth","wind"][slotIndex],
        state:{id:`hero-${slotIndex}`,element:["water","earth","wind"][slotIndex],
            level:3,exp:10,skillPoints:1},
        skillLoadout:{skillLevels:{},equippedSkills:[]}
    }]:[]);
    const sidecars=Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>[
        key,{status:"present",raw:"{}"}
    ]));
    const claimRecords=[{...base,claimKey:"historical:all",status:"blocked"}];
    return {
        account:{...base,slots:ids,
            formation:{version:1,characterIndexToSlot:{0:"ALLY_F2"}}},
        characters:chars,economy:{...base,gold:42,sharedExp:7},
        inventory:[
            {...base,ownedItemId:"item-a",location:"bag",state:{id:"potion",count:2}},
            {...base,ownedItemId:"item-b",location:"equipped",
                state:{id:"sword",type:"weapon",count:1}}
        ],
        equipment:[{...base,characterId:"char-a",slot:"hand",ownedItemId:"item-b"}],
        relics:[{...base,relicId:"relic-a",unlocked:true,level:2,exp:3}],
        relicLoadout:{...base,relicId:"relic-a",subRelicId:null},
        progress:{...base,dailyQuestState:{},commissionQuestState:{},
            achievementState:{},gameplayProgress:{},abyssProgress:{},sidecars},
        claimRecords,
        claimCheckpoint:{...base,claimCount:1,claimDigest:digest(claimRecords),
            historicalClaimsBlocked:true}
    };
}

test("complete server-owned sources assemble all created slots and preserve owned equipped objects",()=>{
    for(const count of [1,2,3]){
        const records=sources(count);
        const result=assembleCanonicalSnapshot("uid-a",7,records);
        assert.equal(result.readyForPublication,false);
        assert.deepEqual(result.snapshot.slots,records.account.slots);
        assert.equal(result.snapshot.characters.length,count);
        assert.equal(result.snapshot.inventory.length,2);
        assert.equal(result.snapshot.equipment[0].ownedItemId,"item-b");
        assert.equal(result.snapshot.relicLoadout.relicId,"relic-a");
        assert.deepEqual(inspectCanonicalSnapshot(result,"uid-a",7),result.snapshot);
        assert.deepEqual(verifyCanonicalSnapshotAgainstSources(result,"uid-a",7,records),
            result.snapshot);
        records.inventory[1].state.id="changed";
        assert.equal(result.snapshot.inventory[1].state.id,"sword");
    }
});

test("snapshot digest survives Firestore map key reordering",()=>{
    const first=sources();
    const second=structuredClone(first);
    second.account=Object.fromEntries(Object.entries(second.account).reverse());
    second.characters[0].state=Object.fromEntries(
        Object.entries(second.characters[0].state).reverse());
    const original=assembleCanonicalSnapshot("uid-a",7,first);
    const reordered=assembleCanonicalSnapshot("uid-a",7,second);
    assert.equal(reordered.sha256,original.sha256);
    assert.equal(reordered.byteLength,original.byteLength);
    assert.deepEqual(verifyCanonicalSnapshotAgainstSources(original,"uid-a",7,second),
        original.snapshot);
});

test("stale, cross-UID and untrusted sources fail before any playable publication",()=>{
    const stale=sources();stale.characters[0].serverRevision=6;
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,stale),/revision/);
    const other=sources();other.inventory[0].ownerUid="uid-b";
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,other),/owner/);
    const untrusted=sources();untrusted.account.provenance="untrusted-legacy-review-only";
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,untrusted),/provenance/);
});

test("orphan, duplicate or mismatched equipment and relic references fail closed",()=>{
    const gap=sources(3);gap.account.slots[1]=null;
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,gap),/slots/);
    const repeated=sources(2);repeated.characters[1]=repeated.characters[0];
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,repeated),/character/);
    const missing=sources();missing.inventory.pop();
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,missing),/equipment/);
    const wrongSlot=sources();wrongSlot.equipment[0].slot="head";
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,wrongSlot),/equipment/);
    const orphanRelic=sources();orphanRelic.relicLoadout.relicId="relic-unknown";
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,orphanRelic),/relic loadout/);
});

test("missing claim source, claim conflict, oversized or tampered snapshot cannot be accepted",()=>{
    const absent=sources();absent.progress.sidecars["equipment-shop-purchases"]={status:"missing",raw:null};
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,absent),/sidecar/);
    const corrupt=sources();corrupt.progress.sidecars["abyss-state"].raw="{oops";
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,corrupt),/sidecar JSON/);
    const unblocked=sources();unblocked.claimRecords[0].status="claimed";
    unblocked.claimCheckpoint.claimDigest=digest(unblocked.claimRecords);
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,unblocked),/blocking record/);
    const tooLarge=sources();tooLarge.progress.dailyQuestState={raw:"x".repeat(800*1024)};
    assert.throws(()=>assembleCanonicalSnapshot("uid-a",7,tooLarge),/size budget/);
    const sealed=assembleCanonicalSnapshot("uid-a",7,sources());
    const changedSources=sources();changedSources.economy.gold=43;
    assert.throws(()=>verifyCanonicalSnapshotAgainstSources(sealed,"uid-a",7,changedSources),
        /differs from canonical source/);
    sealed.snapshot.economy.gold++;
    assert.throws(()=>inspectCanonicalSnapshot(sealed,"uid-a",7),/digest/);
});
