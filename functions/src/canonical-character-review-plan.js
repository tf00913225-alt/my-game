"use strict";

const {randomUUID}=require("node:crypto");

// Internal projection for a future one-time admission transaction. Every ID
// allocated here is provisional: this object is never persisted or returned
// as a playable snapshot. Legacy names and v141Uid are not ownership IDs.
function buildCanonicalCharacterReviewPlan(uid,draft,allocateId=randomUUID){
    if(typeof uid!=="string"||!uid||uid.includes("/")||
       !draft||draft.source!=="untrusted-legacy-review-only"||
       draft.claimHistoryBlocked!==true||!Array.isArray(draft.slots)||
       draft.slots.length!==3||!draft.slots[0]||
       (draft.slots[2]&&!draft.slots[1])||
       !Array.isArray(draft.inventory)||!Array.isArray(draft.equipment)||
       !draft.skills||!draft.economy||!draft.relics||!draft.relicLoadout||
       !draft.progress||!draft.retainedMainFields||!draft.retainedSidecars||
       typeof allocateId!=="function"){
        throw new Error("A complete untrusted character review draft is required.");
    }
    const copy=value=>JSON.parse(JSON.stringify(value));
    const allocated=new Set();
    const nextId=()=>{
        const id=allocateId();
        if(typeof id!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(id)||allocated.has(id)){
            throw new Error("Server character/item ID allocation failed.");
        }
        allocated.add(id);
        return id;
    };
    const slots=draft.slots.map((character,index)=>character?nextId():null);
    const characters=draft.slots.flatMap((character,index)=>character?[{
        characterId:slots[index],slotIndex:index,displayName:character.id,
        element:character.element,legacyState:copy(character),
        skillLoadout:copy(draft.skills[index===0?"fire":`player${index+1}`])
    }]:[]);
    const ownedItems=[];
    const equipmentRefs=[];
    for(const entry of draft.inventory){
        ownedItems.push({ownedItemId:nextId(),location:"bag",source:entry.source,
            legacyItem:copy(entry.item)});
    }
    for(const entry of draft.equipment){
        if(!slots[entry.slotIndex]){
            throw new Error("Equipped item has no created character owner.");
        }
        const ownedItemId=nextId();
        ownedItems.push({ownedItemId,location:"equipped",source:entry.source,
            legacyItem:copy(entry.item)});
        equipmentRefs.push({characterId:slots[entry.slotIndex],slot:entry.slot,ownedItemId});
    }
    const relicRecords=Object.entries(draft.relics).map(([relicId,state])=>({
        relicId,source:`playerRelics.${relicId}`,
        ownershipClaimed:state.unlocked===true,legacyState:copy(state)
    }));
    const selectedRelicId=draft.relicLoadout.relicId;
    if(draft.relicLoadout.subRelicId!=null||
       selectedRelicId!=null&&(!relicRecords.some(record=>
           record.relicId===selectedRelicId&&record.ownershipClaimed))){
        throw new Error("Legacy relic loadout cannot be mapped to an owned relic.");
    }
    return {
        ownerUid:uid,provenance:"untrusted-legacy-review-only",
        readyForAcceptance:false,authoritativeStateReady:false,claimHistoryBlocked:true,
        account:{slots},characters,ownedItems,equipmentRefs,relicRecords,
        activeRelicRef:selectedRelicId==null?null:{relicId:selectedRelicId},
        economy:copy(draft.economy),relics:copy(draft.relics),
        relicLoadout:copy(draft.relicLoadout),formation:copy(draft.formation),
        progress:copy(draft.progress),
        retainedMainFields:copy(draft.retainedMainFields),
        retainedSidecars:copy(draft.retainedSidecars),
        historicalRewardClaims:copy(draft.historicalRewardClaims)
    };
}

module.exports={buildCanonicalCharacterReviewPlan};
