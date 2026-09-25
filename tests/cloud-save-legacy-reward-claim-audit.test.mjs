import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {auditLegacyRewardClaims,CLAIM_DISPOSITION}=require("../functions/src/legacy-reward-claim-audit.js");

function validSave(){
    return {
        dailyQuestState:{date:"2026-09-25",progress:{checkin:1},claimed:{checkin:true}},
        commissionQuestState:{date:"2026-09-25",progress:{winBattle:3},claimed:{winBattle:true}},
        achievementState:{"first-win":true},
        gameplayProgress:{tower:{claimedFloors:{"5":true,"10":false}}},
        abyssProgress:{runs:{20:{rewardClaims:{"d20-r0-s0":{status:"claimed"}},firstClearClaims:{"d20-r0-s0":{status:"claimed"}}}}}
    };
}

test("historical claims are recorded only as duplicate blocks, never grants",()=>{
    const review=auditLegacyRewardClaims(validSave());
    assert.equal(review.status,"blocked");
    assert.equal(review.readyForAcceptance,false);
    assert.equal(review.historicalGrantable,false);
    assert.equal(review.disposition,CLAIM_DISPOSITION);
    assert.deepEqual(review.blockers,["HISTORICAL_REWARDS_UNVERIFIED"]);
    assert.deepEqual(review.sources.find(source=>source.source==="daily_quests").claimedKeys,["checkin"]);
    assert.deepEqual(review.sources.find(source=>source.source==="tower").claimedKeys,["5"]);
});

test("missing or contradictory historical reward records fail closed",()=>{
    const review=auditLegacyRewardClaims({...validSave(),
        dailyQuestState:{date:"2026-09-25",progress:{checkin:-1},claimed:{checkin:true}},
        abyssProgress:{runs:{20:{rewardClaims:{"bad":{status:"paid"}},firstClearClaims:{}}}}
    });
    assert.equal(review.historicalGrantable,false);
    assert.ok(review.blockers.includes("DAILY_QUESTS_CLAIM_RECORD_INVALID"));
    assert.ok(review.blockers.includes("ABYSS_CLAIM_RECORD_INVALID"));
});
