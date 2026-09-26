import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url);
const {buildCanonicalCharacterReviewPlan}=require("../functions/src/canonical-character-review-plan.js");

function draft(count=1){
    return {
        source:"untrusted-legacy-review-only",claimHistoryBlocked:true,
        slots:[
            {id:"hero",element:"water",level:3,exp:9,skillPoints:1},
            count>=2?{id:"second",element:"earth",level:1,exp:0,skillPoints:0}:null,
            count>=3?{id:"third",element:"wind",level:1,exp:0,skillPoints:0}:null
        ],
        inventory:[{source:"inventoryItems[0]",item:{id:"potion",count:2}}],
        equipment:[{slotIndex:0,slot:"hand",source:"characterEquipment.fire.weapon",
            item:{id:"sword",type:"weapon",count:1,v141Uid:"old-gear"}}],
        skills:{fire:{skillLevels:{},equippedSkills:[]},
            player2:{skillLevels:{},equippedSkills:[]},
            player3:{skillLevels:{},equippedSkills:[]}},
        economy:{gold:12,sharedExp:4},relics:{},relicLoadout:{relicId:null},
        formation:{version:1,characterIndexToSlot:{0:"ALLY_F1"}},
        progress:{abyssProgress:{runs:{}}},retainedMainFields:{version:{status:"missing"}},
        retainedSidecars:{"equipment-shop-purchases":{status:"missing",raw:null}},
        historicalRewardClaims:{historicalGrantable:false}
    };
}

test("review projection allocates distinct provisional character and item IDs without dropping empty slots or equipped gear",()=>{
    for(const count of [1,2,3]){
        let next=0;
        const source=draft(count);
        const plan=buildCanonicalCharacterReviewPlan("uid-a",source,()=>`new-${++next}`);
        assert.deepEqual(plan.account.slots,
            ["new-1",count>=2?"new-2":null,count>=3?"new-3":null]);
        assert.equal(plan.characters.length,count);
        assert.equal(plan.characters[0].displayName,"hero");
        assert.equal(plan.characters[0].element,"water");
        assert.deepEqual(plan.characters[0].skillLoadout,source.skills.fire);
        assert.deepEqual(plan.ownedItems.map(item=>item.ownedItemId),
            [`new-${count+1}`,`new-${count+2}`]);
        assert.equal(plan.equipmentRefs[0].characterId,"new-1");
        assert.equal(plan.equipmentRefs[0].ownedItemId,`new-${count+2}`);
        assert.equal(plan.ownedItems[1].location,"equipped");
        assert.deepEqual(plan.formation,source.formation);
        assert.equal(plan.retainedSidecars["equipment-shop-purchases"].status,"missing");
        assert.equal(plan.claimHistoryBlocked,true);
        assert.equal(plan.readyForAcceptance,false);
        assert.equal(plan.authoritativeStateReady,false);
        source.equipment[0].item.id="mutated";
        assert.equal(plan.ownedItems[1].legacyItem.id,"sword");
    }
});

test("review projection rejects slot gaps, orphaned equipment and repeated allocation",()=>{
    const gap=draft();gap.slots[2]={id:"third"};
    assert.throws(()=>buildCanonicalCharacterReviewPlan("uid-a",gap),/complete untrusted/);
    const orphan=draft();orphan.equipment[0].slotIndex=1;
    assert.throws(()=>buildCanonicalCharacterReviewPlan("uid-a",orphan),/no created character/);
    assert.throws(()=>buildCanonicalCharacterReviewPlan("uid-a",draft(),()=>"same"),/allocation failed/);
    assert.throws(()=>buildCanonicalCharacterReviewPlan("uid-b",{...draft(),claimHistoryBlocked:false}),
        /complete untrusted/);
});
