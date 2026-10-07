import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import test from "node:test";
const require=createRequire(import.meta.url);
const {assembleCanonicalSnapshot,assembleCanonicalPlayableProjection,claimRecordsDigest}=require("../functions/src/canonical-snapshot.js");
const {LEGACY_BACKUP_SIDECARS,ALLOWED_SAVE_KEYS}=require("../functions/src/cloud-save-policy.js");
const {normalizeAccountState}=require("../functions/src/hero-core.js");

function sources(count=1){
    const base={schemaVersion:1,ownerUid:"uid-a",serverRevision:7,provenance:"grandfathered-unverified-history"};
    const slots=["char-a",count>1?"char-b":null,count>2?"char-c":null];
    const characters=slots.flatMap((id,slotIndex)=>id?[{...base,characterId:id,slotIndex,
        displayName:`hero-${slotIndex}`,element:"water",state:{id:`hero-${slotIndex}`,element:"water",
            gender:"female",level:3,exp:10,expNext:100,skillPoints:1,attributePoints:2,
            attack:1,intelligence:2,vitality:3,energy:4,defensePoints:5,agility:6,
            bonusHP:0,bonusSP:0,hp:250,sp:80,activeBuffs:[],statusEffects:[],isDefending:false},
        skillLoadout:{skillLevels:{waterSlash:2},equippedSkills:["waterSlash"]}}]:[]);
    const claimRecords=[{...base,claimKey:"historical:all",status:"blocked"}];
    const auto={enabled:false,skill:"waterSlash",hp:30,sp:20,returnToCityWhenEmpty:true};
    return {account:{...base,slots,formation:{version:1,characterIndexToSlot:{0:"ALLY_F2"}}},characters,
        economy:{...base,gold:42,sharedExp:7},inventory:[
            {...base,ownedItemId:"bag-a",location:"bag",state:{id:"potion",count:2}},
            {...base,ownedItemId:"equip-a",location:"equipped",state:{id:"sword",type:"weapon",count:1}}],
        equipment:[{...base,characterId:"char-a",slot:"hand",ownedItemId:"equip-a"}],
        relics:[{...base,relicId:"relic-a",unlocked:true,level:2,exp:3,seen:true}],
        relicLoadout:{...base,relicId:"relic-a",subRelicId:null},
        progress:{...base,dailyQuestState:{claimed:true},commissionQuestState:{},achievementState:{},
            gameplayProgress:{},abyssProgress:{},sidecars:Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>
                [key,{status:"present",raw:JSON.stringify({marker:key})}]))},
        claimRecords,claimCheckpoint:{...base,claimCount:1,claimDigest:claimRecordsDigest(claimRecords),historicalClaimsBlocked:true},
        playableState:{...base,heroAccount:normalizeAccountState(null),bestiaryData:{slime:9},
            autoConfig:{...auto},autoConfig2:{...auto},autoConfig3:{...auto},
            selectedCreationElement:"water",lastSaveTimestamp:1700000000000}};
}
const assemble=records=>assembleCanonicalPlayableProjection("uid-a",7,records);

test("complete projection covers current save fields, slots, owned equipment and sidecar bytes without mutation",()=>{
    for(const count of [1,2,3]){
        const records=sources(count),before=structuredClone(records),bundle=assemble(records);
        const restored=JSON.parse(JSON.stringify(bundle.projection));
        assert.deepEqual(Object.keys(restored.gameSave).sort(),[...ALLOWED_SAVE_KEYS].sort());
        for(let index=0;index<3;index++){
            assert.deepEqual(restored.gameSave[["player","player2","player3"][index]],records.characters[index]?.state??null);
        }
        assert.deepEqual(restored.gameSave.heroAccount,records.playableState.heroAccount);
        assert.deepEqual(restored.gameSave.bestiaryData,{slime:9});
        assert.deepEqual(restored.sidecars,records.progress.sidecars);
        assert.deepEqual(restored.claimCheckpoint,records.claimCheckpoint);
        assert.equal(restored.gameSave.characterEquipment.fire.hand.v141Uid,"equip-a");
        assert.equal(restored.gameSave.inventoryItems.length,1);
        assert.equal(restored.gameSave.inventoryItems[0].v141Uid,"bag-a");
        assert.equal(restored.gameSave.characterEquipment.water,undefined);
        assert.deepEqual(restored.gameSave.playerRelics["relic-a"],{unlocked:true,level:2,exp:3,seen:true});
        assert.equal(restored.authoritativeStateReady,false);
        assert.equal(bundle.readyForPublication,false);
        assert.equal(bundle.byteLength,Buffer.byteLength(JSON.stringify(restored)));
        assert.deepEqual(records,before);
        records.playableState.bestiaryData.slime=99;
        assert.equal(restored.gameSave.bestiaryData.slime,9);
    }
});
test("new digest binds previously omitted fields while v1 receipt hash stays stable",()=>{
    const records=sources(),old=assembleCanonicalSnapshot("uid-a",7,records).sha256,initial=assemble(records).sha256;
    for(const change of [r=>r.playableState.heroAccount.heroes.divineDogHongbao.specificFragments++,
        r=>r.playableState.bestiaryData.slime++,r=>r.playableState.autoConfig.hp++,
        r=>r.playableState.lastSaveTimestamp++]){
        const changed=structuredClone(records);change(changed);
        assert.equal(assembleCanonicalSnapshot("uid-a",7,changed).sha256,old);
        assert.notEqual(assemble(changed).sha256,initial);
    }
    const reordered=structuredClone(records);
    reordered.playableState=Object.fromEntries(Object.entries(reordered.playableState).reverse());
    assert.equal(assemble(reordered).sha256,initial);
});
test("incomplete, foreign and corrupt sources block without filling defaults",()=>{
    const changes=[r=>delete r.playableState,r=>r.playableState.ownerUid="other",
        r=>r.playableState.serverRevision++,r=>r.playableState.provenance="server-created",
        r=>r.playableState.heroAccount=null,r=>delete r.playableState.heroAccount.heroes.divineDogHongbao,
        r=>r.playableState.heroAccount.extra=true,r=>r.characters[0].state.attack=NaN,
        r=>delete r.characters[0].state.hp,r=>delete r.relics[0].seen,
        r=>r.playableState.autoConfig.hp=101,r=>r.playableState.bestiaryData.bad=Infinity,
        r=>r.playableState.selectedCreationElement="unknown",r=>r.playableState.lastSaveTimestamp=0,
        r=>r.playableState.extra=true,r=>r.inventory[0].ownerUid="other"];
    for(const change of changes){const r=sources();change(r);assert.throws(()=>assemble(r));}
    for(const field of ["attack","intelligence","vitality","energy","defensePoints","agility",
        "expNext","skillPoints","attributePoints","bonusHP","bonusSP","gender","sp","activeBuffs","statusEffects","isDefending"]){
        const r=sources();delete r.characters[0].state[field];assert.throws(()=>assemble(r),field);
    }
});
test("registry gameplay sidecars are mandatory, device preferences retain explicit missing state",()=>{
    const registry=JSON.parse(readFileSync(new URL("../config/persisted-state-registry.json",import.meta.url))).states;
    for(const key of LEGACY_BACKUP_SIDECARS){
        const entry=registry.find(row=>row.key===`four_symbols_account:<UID>:${key}`);
        assert.ok(entry,key);
        const r=sources();r.progress.sidecars[key]={status:"missing",raw:null};
        if(entry.gameplayCritical){assert.throws(()=>assemble(r),key);}
        else{assert.deepEqual(assemble(r).projection.sidecars[key],{status:"missing",raw:null});}
    }
    const r=sources();r.progress.sidecars["element-box-state"].raw="null";assert.throws(()=>assemble(r));
});
test("projection rejects oversized and non-JSON payloads before serialization can discard them",()=>{
    const r=sources();r.playableState.bestiaryData.bad=undefined;assert.throws(()=>assemble(r));
    const large=sources();large.playableState.bestiaryData=Object.fromEntries(
        Array.from({length:20},(_,i)=>[i,"x".repeat(60000)]));assert.throws(()=>assemble(large));
});
