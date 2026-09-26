import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {screenLegacyCandidateSnapshot}=require("../functions/src/legacy-candidate-screening.js");

test("historical main save cannot pass screening without sidecar and reward provenance",()=>{
    const save={
        player:{id:"first",element:"fire",level:3,exp:4,skillPoints:2},
        player2:null,player3:null,
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
