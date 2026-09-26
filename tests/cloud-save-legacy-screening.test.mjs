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
