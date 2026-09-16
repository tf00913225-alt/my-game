/* =====================================================
   Fixed Battlefield Slot Owner — canonical battlefield geometry model
   Unit identity and battlefield position are deliberately separate.
===================================================== */
(function installFixedBattlefieldSlotOwner(){
    "use strict";

    if(typeof window==="undefined"||window.__fixedBattlefieldSlotOwnerInstalled){ return; }
    window.__fixedBattlefieldSlotOwnerInstalled=true;

    const ENEMY_BACK=Object.freeze(["ENEMY_B1","ENEMY_B2","ENEMY_B3","ENEMY_B4","ENEMY_B5"]);
    const ENEMY_FRONT=Object.freeze(["ENEMY_F1","ENEMY_F2","ENEMY_F3","ENEMY_F4","ENEMY_F5"]);
    const ALLY_FRONT=Object.freeze(["ALLY_F1","ALLY_F2","ALLY_F3"]);
    const ALLY_BACK=Object.freeze(["ALLY_B1","ALLY_B2","ALLY_B3"]);
    const MECHANISM=Object.freeze(["MECH_L","MECH_C","MECH_R"]);
    const ENEMY_SLOTS=Object.freeze(ENEMY_BACK.concat(ENEMY_FRONT));
    const ALLY_SLOTS=Object.freeze(ALLY_FRONT.concat(ALLY_BACK));

    const ENEMY_LAYOUTS=Object.freeze({
        1:Object.freeze([Object.freeze(["ENEMY_F3"])]),
        2:Object.freeze([Object.freeze(["ENEMY_F2","ENEMY_F4"])]),
        3:Object.freeze([Object.freeze(["ENEMY_F2","ENEMY_F3","ENEMY_F4"])]),
        4:Object.freeze([Object.freeze(["ENEMY_F1","ENEMY_F2","ENEMY_F4","ENEMY_F5"])]),
        5:Object.freeze([Object.freeze(ENEMY_FRONT.slice())]),
        6:Object.freeze([
            Object.freeze(["ENEMY_B2","ENEMY_B3","ENEMY_B4"]),
            Object.freeze(["ENEMY_F2","ENEMY_F3","ENEMY_F4"])
        ]),
        7:Object.freeze([
            Object.freeze(ENEMY_BACK.slice()),
            Object.freeze(["ENEMY_F2","ENEMY_F4"])
        ]),
        8:Object.freeze([
            Object.freeze(["ENEMY_B2","ENEMY_B3","ENEMY_B4"]),
            Object.freeze(ENEMY_FRONT.slice())
        ]),
        9:Object.freeze([
            Object.freeze(ENEMY_BACK.slice()),
            Object.freeze(["ENEMY_F1","ENEMY_F2","ENEMY_F4","ENEMY_F5"])
        ]),
        10:Object.freeze([
            Object.freeze(ENEMY_BACK.slice()),
            Object.freeze(ENEMY_FRONT.slice())
        ])
    });

    const FORMAL_PRIORITY=Object.freeze({
        3:Object.freeze(["ENEMY_F3","ENEMY_F4","ENEMY_F2"]),
        5:Object.freeze(["ENEMY_F4","ENEMY_F2","ENEMY_F5","ENEMY_F3","ENEMY_F1"]),
        6:Object.freeze(["ENEMY_B3","ENEMY_F3","ENEMY_B4","ENEMY_B2","ENEMY_F4","ENEMY_F2"]),
        8:Object.freeze(["ENEMY_B3","ENEMY_F4","ENEMY_F2","ENEMY_B4","ENEMY_B2","ENEMY_F5","ENEMY_F3","ENEMY_F1"]),
        10:Object.freeze(["ENEMY_B4","ENEMY_B2","ENEMY_F4","ENEMY_F2","ENEMY_B5","ENEMY_B3","ENEMY_B1","ENEMY_F5","ENEMY_F3","ENEMY_F1"])
    });

    const SLOT_META={};
    ENEMY_BACK.forEach((slot,index)=>{ SLOT_META[slot]=Object.freeze({side:"enemy",row:"back",column:index+1}); });
    ENEMY_FRONT.forEach((slot,index)=>{ SLOT_META[slot]=Object.freeze({side:"enemy",row:"front",column:index+1}); });
    ALLY_FRONT.forEach((slot,index)=>{ SLOT_META[slot]=Object.freeze({side:"ally",row:"front",column:index+1}); });
    ALLY_BACK.forEach((slot,index)=>{ SLOT_META[slot]=Object.freeze({side:"ally",row:"back",column:index+1}); });
    MECHANISM.forEach((slot,index)=>{ SLOT_META[slot]=Object.freeze({side:"mechanism",row:"mechanism",column:index+1}); });
    Object.freeze(SLOT_META);

    function validEnemyFormationType(value){
        const number=Math.max(1,Math.min(10,Math.floor(Number(value)||1)));
        return ENEMY_LAYOUTS[number]?number:1;
    }

    function cloneRows(rows){
        return (rows||[]).map(row=>row.slice());
    }

    function enemyRowsForType(type){
        return cloneRows(ENEMY_LAYOUTS[validEnemyFormationType(type)]);
    }

    function slotColumn(slot){
        const meta=SLOT_META[slot];
        return meta?meta.column:0;
    }

    function centerFirstSlots(slots){
        const values=(slots||[]).slice();
        if(values.length<=1){ return values; }
        const center=3;
        return values.sort((a,b)=>{
            const aDistance=Math.abs(slotColumn(a)-center);
            const bDistance=Math.abs(slotColumn(b)-center);
            return aDistance-bDistance||slotColumn(a)-slotColumn(b);
        });
    }

    function legacyPrioritySlots(type){
        return enemyRowsForType(type).flatMap(centerFirstSlots);
    }

    function prioritySlotsForType(type){
        const normalized=validEnemyFormationType(type);
        return (FORMAL_PRIORITY[normalized]||legacyPrioritySlots(normalized)).slice();
    }

    function emptySlotMap(slots){
        return Object.fromEntries(slots.map(slot=>[slot,null]));
    }

    function rankOrdered(indexes,rankWeight){
        const stable=new Map(indexes.map((index,position)=>[index,position]));
        return indexes.slice().sort((a,b)=>{
            const difference=Number(rankWeight(b)||0)-Number(rankWeight(a)||0);
            return difference||(stable.get(a)-stable.get(b));
        });
    }

    function createEnemyFormationSnapshot(monsterIndexes,options){
        const config=options&&typeof options==="object"?options:{};
        const indexes=(Array.isArray(monsterIndexes)?monsterIndexes:[])
            .filter(index=>Number.isInteger(index)).slice(0,10);
        const originalFormationType=validEnemyFormationType(
            config.originalFormationType===undefined?Math.max(1,indexes.length):config.originalFormationType
        );
        const rows=enemyRowsForType(originalFormationType);
        const slotToMonsterIndex=emptySlotMap(ENEMY_SLOTS);
        const monsterIndexToSlot={};
        const useRankPlacement=typeof config.rankWeight==="function";
        const ordered=useRankPlacement?rankOrdered(indexes,config.rankWeight):indexes.slice();
        let cursor=0;

        rows.forEach(rowSlots=>{
            const remaining=ordered.length-cursor;
            if(remaining<=0){ return; }
            const count=Math.min(rowSlots.length,remaining);
            const rowUnits=ordered.slice(cursor,cursor+count);
            cursor+=count;
            let targetSlots=rowSlots.slice();
            if(useRankPlacement){ targetSlots=centerFirstSlots(targetSlots).slice(0,count); }
            else if(indexes.length===1&&originalFormationType>1){ targetSlots=centerFirstSlots(targetSlots).slice(0,1); }
            else{ targetSlots=targetSlots.slice(0,count); }
            rowUnits.forEach((monsterIndex,position)=>{
                const slot=targetSlots[position];
                if(!slot){ return; }
                slotToMonsterIndex[slot]=monsterIndex;
                monsterIndexToSlot[monsterIndex]=slot;
            });
        });

        return {
            kind:"enemy-formation-snapshot",
            originalFormationType:originalFormationType,
            monsterIndexToSlot:monsterIndexToSlot,
            slotToMonsterIndex:slotToMonsterIndex,
            rowSlots:rows,
            createdFromMonsterIndexes:indexes.slice()
        };
    }

    function slotForMonster(snapshot,monsterIndex){
        if(!snapshot||!snapshot.monsterIndexToSlot){ return null; }
        return snapshot.monsterIndexToSlot[monsterIndex]||null;
    }

    function assignedMonsterAt(snapshot,slot){
        if(!snapshot||!snapshot.slotToMonsterIndex||!Object.prototype.hasOwnProperty.call(snapshot.slotToMonsterIndex,slot)){ return null; }
        const value=snapshot.slotToMonsterIndex[slot];
        return Number.isInteger(value)?value:null;
    }

    function activeMonsterAt(snapshot,slot,isAlive){
        const index=assignedMonsterAt(snapshot,slot);
        if(index===null){ return null; }
        return typeof isAlive==="function"&&!isAlive(index)?null:index;
    }

    function assignMonsterToSlot(snapshot,monsterIndex,slot){
        if(!snapshot||!Number.isInteger(monsterIndex)||!ENEMY_SLOTS.includes(slot)){ return false; }
        if(assignedMonsterAt(snapshot,slot)!==null){ return false; }
        const current=slotForMonster(snapshot,monsterIndex);
        if(current){ snapshot.slotToMonsterIndex[current]=null; }
        snapshot.slotToMonsterIndex[slot]=monsterIndex;
        snapshot.monsterIndexToSlot[monsterIndex]=slot;
        return true;
    }

    function assignMonsterToPreferredSlot(snapshot,monsterIndex,preferredSlots){
        const slots=(Array.isArray(preferredSlots)?preferredSlots:[]).filter(slot=>ENEMY_SLOTS.includes(slot));
        const target=slots.find(slot=>assignedMonsterAt(snapshot,slot)===null);
        return target&&assignMonsterToSlot(snapshot,monsterIndex,target)?target:null;
    }

    function priorityMonsterIndexes(snapshot,isAlive){
        if(!snapshot){ return []; }
        return prioritySlotsForType(snapshot.originalFormationType)
            .map(slot=>activeMonsterAt(snapshot,slot,isAlive))
            .filter(index=>Number.isInteger(index));
    }

    function snapshotRows(snapshot,options){
        if(!snapshot){ return []; }
        const config=options&&typeof options==="object"?options:{};
        const activeOnly=!!config.activeOnly;
        const isAlive=typeof config.isAlive==="function"?config.isAlive:null;
        return cloneRows(snapshot.rowSlots).map(row=>row.map(slot=>{
            const index=activeOnly?activeMonsterAt(snapshot,slot,isAlive):assignedMonsterAt(snapshot,slot);
            return {slot:slot,monsterIndex:index};
        }));
    }

    let activeEnemySnapshot=null;
    function setActiveEnemySnapshot(snapshot){
        activeEnemySnapshot=snapshot&&snapshot.kind==="enemy-formation-snapshot"?snapshot:null;
        return activeEnemySnapshot;
    }
    function getActiveEnemySnapshot(){ return activeEnemySnapshot; }
    function clearActiveEnemySnapshot(){ activeEnemySnapshot=null; }

    const api={
        version:"fixed-slot-v1",
        enemySlots:ENEMY_SLOTS,
        enemyBackSlots:ENEMY_BACK,
        enemyFrontSlots:ENEMY_FRONT,
        allySlots:ALLY_SLOTS,
        allyFrontSlots:ALLY_FRONT,
        allyBackSlots:ALLY_BACK,
        mechanismSlots:MECHANISM,
        slotMeta:SLOT_META,
        getEnemyFormationSlotRows:enemyRowsForType,
        getPrioritySlotsForFormation:prioritySlotsForType,
        createEnemyFormationSnapshot:createEnemyFormationSnapshot,
        getEnemySlotForMonster:slotForMonster,
        getAssignedMonsterAtEnemySlot:assignedMonsterAt,
        getActiveMonsterAtEnemySlot:activeMonsterAt,
        assignMonsterToEnemySlot:assignMonsterToSlot,
        assignMonsterToPreferredEnemySlot:assignMonsterToPreferredSlot,
        getPriorityMonsterIndexes:priorityMonsterIndexes,
        getEnemySnapshotRows:snapshotRows,
        setActiveEnemySnapshot:setActiveEnemySnapshot,
        getActiveEnemySnapshot:getActiveEnemySnapshot,
        clearActiveEnemySnapshot:clearActiveEnemySnapshot
    };

    window.FourSymbolsBattlefieldSlots=Object.freeze(api);
})();
