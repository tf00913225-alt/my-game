import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {screenLegacyCandidateSnapshot,prepareLegacyCharacterDraft}=
    require("../functions/src/legacy-candidate-screening.js");
const {ALLOWED_SAVE_KEYS,LEGACY_BACKUP_SIDECARS}=require("../functions/src/cloud-save-policy.js");

test("historical main save cannot pass screening without sidecar and reward provenance",()=>{
    const save={
        player:{id:"first",element:"fire",level:3,exp:4,skillPoints:2},
        player2:null,player3:null,
        gold:100,sharedExp:0,characterSkillLoadouts:{fire:{skillLevels:{},equippedSkills:[]}},
        playerRelics:{},teamLoadout:{relicId:null,subRelicId:null},
        inventoryItems:[{id:"potion",count:2}],characterEquipment:{fire:{}},
        dailyQuestState:{date:"2026-09-25",progress:{checkin:0},claimed:{checkin:false}},
        commissionQuestState:{date:"2026-09-25",progress:{winBattle:0},claimed:{winBattle:false}},
        achievementState:{},
        gameplayProgress:{tower:{claimedFloors:{}}},
        abyssProgress:{runs:{20:{rewardClaims:{},firstClearClaims:{}}}}
    };
    const review=screenLegacyCandidateSnapshot(save);
    assert.equal(review.status,"blocked");
    assert.equal(review.readyForAcceptance,false);
    assert.equal(review.characterCount,1);
    assert.deepEqual(review.blockers,["HISTORICAL_REWARDS_UNVERIFIED","SIDECAR_BACKUP_MISSING"]);
    assert.equal(review.blockers.includes("CHARACTER_SLOT_GAP"),false);
    const inconsistent=screenLegacyCandidateSnapshot({...save,
        player2:{...save.player,element:"other"},inventoryItems:[{id:"potion",count:0}],
        achievementState:null});
    assert.ok(inconsistent.blockers.includes("DUPLICATE_CHARACTER_ID"));
    assert.ok(inconsistent.blockers.includes("CHARACTER_ELEMENT_INVALID"));
    assert.ok(inconsistent.blockers.includes("INVENTORY_STRUCTURE_INVALID"));
    assert.ok(inconsistent.blockers.includes("CLAIM_PROGRESS_MISSING"));
    assert.equal(inconsistent.readyForAcceptance,false);
    const gap=screenLegacyCandidateSnapshot({...save,
        player3:{id:"third",element:"earth",level:50,exp:0,skillPoints:0}});
    assert.ok(gap.blockers.includes("CHARACTER_SLOT_GAP"));
    assert.ok(screenLegacyCandidateSnapshot({...save,player:null}).blockers.includes(
        "CHARACTER_SLOT_MISSING"));
    const contiguous=screenLegacyCandidateSnapshot({...save,
        player2:{id:"second",element:"water",level:10,exp:0,skillPoints:0},
        player3:{id:"third",element:"earth",level:50,exp:0,skillPoints:0}});
    assert.equal(contiguous.blockers.includes("CHARACTER_SLOT_GAP"),false);
});

test("equipped legacy gear is an owned object outside the bag, with one identity across both",()=>{
    const base={player:{id:"first",element:"fire",exp:0,skillPoints:0},
        player2:null,player3:null,inventoryItems:[{id:"potion",type:"potion",count:2}],
        characterEquipment:{fire:{hand:{id:"ironSword",type:"weapon",count:1,v141Uid:"gear-1"}}}};
    const review=screenLegacyCandidateSnapshot(base);
    assert.equal(review.blockers.includes("EQUIPMENT_STRUCTURE_INVALID"),false);
    assert.equal(review.blockers.includes("EQUIPMENT_IDENTITY_DUPLICATE"),false);

    const duplicate=screenLegacyCandidateSnapshot({...base,inventoryItems:[...base.inventoryItems,
        {id:"ironSword",type:"weapon",count:1,v141Uid:"gear-1"}]});
    assert.ok(duplicate.blockers.includes("EQUIPMENT_IDENTITY_DUPLICATE"));
    const disguised=screenLegacyCandidateSnapshot({...base,inventoryItems:[...base.inventoryItems,
        {id:"ironSword",type:"potion",count:1,v141Uid:"gear-1"}]});
    assert.ok(disguised.blockers.includes("EQUIPMENT_IDENTITY_DUPLICATE"));
    const stacked=screenLegacyCandidateSnapshot({...base,inventoryItems:[...base.inventoryItems,
        {id:"ironSword",type:"weapon",count:2}]});
    assert.ok(stacked.blockers.includes("EQUIPMENT_STRUCTURE_INVALID"));
    const wrongSlot=screenLegacyCandidateSnapshot({...base,
        characterEquipment:{fire:{ring:{id:"ironSword",type:"weapon",count:1}}}});
    assert.ok(wrongSlot.blockers.includes("EQUIPMENT_STRUCTURE_INVALID"));
    const orphan=screenLegacyCandidateSnapshot({...base,
        characterEquipment:{fire:{},player2:{hand:{id:"ironSword",type:"weapon",count:1}}}});
    assert.ok(orphan.blockers.includes("EQUIPMENT_OWNER_UNMAPPED"));
    const legacyAlias=screenLegacyCandidateSnapshot({...base,
        characterEquipment:{fire:{weapon:{id:"ironSword",type:"weapon",count:1}}}});
    assert.equal(legacyAlias.blockers.includes("EQUIPMENT_STRUCTURE_INVALID"),false);
    const ambiguous=screenLegacyCandidateSnapshot({...base,
        characterEquipment:{fire:{weapon:{id:"ironSword",type:"weapon",count:1},
            hand:{id:"woodStaff",type:"weapon",count:1}}}});
    assert.ok(ambiguous.blockers.includes("EQUIPMENT_STRUCTURE_INVALID"));
});

test("formation screening retains valid party slots and blocks conflicting or orphaned slots",()=>{
    const base={player:{id:"first",element:"fire",exp:0,skillPoints:0},
        player2:null,player3:null,inventoryItems:[],characterEquipment:{fire:{}},
        allyFormation:{version:1,characterIndexToSlot:{0:"ALLY_F2"}}};
    assert.equal(screenLegacyCandidateSnapshot(base).blockers.includes("FORMATION_STRUCTURE_INVALID"),false);
    const orphan={...base,allyFormation:{version:1,characterIndexToSlot:{1:"ALLY_F1"}}};
    assert.ok(screenLegacyCandidateSnapshot(orphan).blockers.includes("FORMATION_STRUCTURE_INVALID"));
    const repeated={...base,player2:{id:"second",element:"water",exp:0,skillPoints:0},
        allyFormation:{version:1,characterIndexToSlot:{0:"ALLY_F1",1:"ALLY_F1"}}};
    assert.ok(screenLegacyCandidateSnapshot(repeated).blockers.includes("FORMATION_STRUCTURE_INVALID"));
    const badSlot={...base,allyFormation:{version:1,characterIndexToSlot:{0:"ENEMY_B1"}}};
    assert.ok(screenLegacyCandidateSnapshot(badSlot).blockers.includes("FORMATION_STRUCTURE_INVALID"));
});

test("read-only screening blocks missing economy, skills or relic source without inventing defaults",()=>{
    const save={player:{id:"first",element:"fire",exp:0,skillPoints:0},
        player2:null,player3:null,inventoryItems:[],characterEquipment:{fire:{}},
        gold:7,sharedExp:0,characterSkillLoadouts:{fire:{}},playerRelics:{},teamLoadout:{}};
    const intact=screenLegacyCandidateSnapshot(save);
    for(const code of ["ECONOMY_SOURCE_MISSING","SKILL_SOURCE_MISSING","RELIC_SOURCE_MISSING"]){
        assert.equal(intact.blockers.includes(code),false);
    }
    const broken={...save,gold:undefined,characterSkillLoadouts:null,playerRelics:null};
    const review=screenLegacyCandidateSnapshot(broken);
    assert.ok(review.blockers.includes("ECONOMY_SOURCE_MISSING"));
    assert.ok(review.blockers.includes("SKILL_SOURCE_MISSING"));
    assert.ok(review.blockers.includes("RELIC_SOURCE_MISSING"));
    assert.equal(review.readyForAcceptance,false);
});

test("read-only draft keeps empty slots and equipped objects separate from the bag",()=>{
    const save={player:{id:"hero",element:"water",level:5,exp:10,skillPoints:2},
        player2:null,player3:null,gold:42,sharedExp:7,
        inventoryItems:[{id:"potion",count:3}],
        characterEquipment:{fire:{weapon:{id:"sword",type:"weapon",count:1}}},
        characterSkillLoadouts:{fire:{skillLevels:{},equippedSkills:[]}},
        playerRelics:{relicA:{unlocked:true,level:1}},
        teamLoadout:{relicId:"relicA",subRelicId:null},
        dailyQuestState:{date:"2026-09-26",progress:{},claimed:{}},
        commissionQuestState:{date:"2026-09-26",progress:{},claimed:{}},
        achievementState:{},gameplayProgress:{tower:{claimedFloors:{}}},
        abyssProgress:{runs:{}}};
    save.bestiaryData={wolf:3};save.autoConfig={threshold:20};
    const sidecars=Object.fromEntries(LEGACY_BACKUP_SIDECARS.map(key=>[
        key,{status:"present",raw:key==="bulk-sell-quality"?"white":
            key==="quest-milestones"?JSON.stringify({date:"2026-09-26",daily:{},commission:{}}):
            key==="abyss-state"?JSON.stringify(save.abyssProgress):"{}"}
    ]));
    const draft=prepareLegacyCharacterDraft(save,sidecars);
    assert.deepEqual(draft.slots,[save.player,null,null]);
    assert.deepEqual(draft.economy,{gold:42,sharedExp:7});
    assert.equal(draft.inventory.length,1);
    assert.deepEqual(draft.equipment[0],{slotIndex:0,slot:"hand",
        source:"characterEquipment.fire.weapon",
        item:{id:"sword",type:"weapon",count:1}});
    assert.equal(draft.historicalRewardClaims.historicalGrantable,false);
    assert.equal(draft.claimHistoryBlocked,true);
    assert.deepEqual(Object.keys(draft.retainedSidecars).sort(),LEGACY_BACKUP_SIDECARS);
    assert.deepEqual(draft.retainedMainFields.bestiaryData,{status:"present",value:{wolf:3}});
    assert.deepEqual(draft.retainedMainFields.autoConfig,{status:"present",value:{threshold:20}});
    assert.deepEqual(draft.retainedMainFields.autoConfig2,{status:"missing"});
    const mappedMainKeys=new Set(["player","player2","player3","gold","sharedExp",
        "inventoryItems","characterEquipment","characterSkillLoadouts","allyFormation",
        "playerRelics","teamLoadout","dailyQuestState","commissionQuestState",
        "achievementState","gameplayProgress","abyssProgress",
        ...Object.keys(draft.retainedMainFields)]);
    assert.deepEqual([...mappedMainKeys].sort(),[...ALLOWED_SAVE_KEYS].sort());
    draft.equipment[0].item.id="changed";
    assert.equal(save.characterEquipment.fire.weapon.id,"sword");

    const corrupt={...sidecars,"equipment-shop-purchases":{status:"present",raw:"not-json"}};
    assert.equal(prepareLegacyCharacterDraft(save,corrupt).retainedSidecars["equipment-shop-purchases"].raw,"not-json");
    assert.ok(screenLegacyCandidateSnapshot(save,corrupt).blockers.includes("SIDECAR_CLAIM_RECORD_INVALID"));
    const missing={...sidecars,"equipment-shop-purchases":{status:"missing",raw:null}};
    assert.deepEqual(prepareLegacyCharacterDraft(save,missing).retainedSidecars["equipment-shop-purchases"],
        {status:"missing",raw:null});
    assert.ok(screenLegacyCandidateSnapshot(save,missing).blockers.includes("SIDECAR_BACKUP_MISSING"));
    const incomplete={...sidecars};delete incomplete["rested-exp-state"];
    assert.equal(prepareLegacyCharacterDraft(save,incomplete),null);
    const diverged={...sidecars,"abyss-state":{status:"present",raw:JSON.stringify({runs:{
        20:{rewardClaims:{one:{status:"claimed"}},firstClearClaims:{}}
    }})}};
    assert.equal(prepareLegacyCharacterDraft(save,diverged),null);
    assert.ok(screenLegacyCandidateSnapshot(save,diverged).blockers.includes(
        "ABYSS_SIDECAR_CLAIM_MIRROR_CONFLICT"));
    assert.equal(prepareLegacyCharacterDraft({...save,characterSkillLoadouts:{fire:{}}},sidecars),null);
    assert.equal(prepareLegacyCharacterDraft({...save,teamLoadout:{relicId:"absent"}},sidecars),null);
});
