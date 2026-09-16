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
        const rankValues=typeof config.rankWeight==="function"
            ?indexes.map(index=>Number(config.rankWeight(index)||0)):[];
        const useRankPlacement=rankValues.length>1&&new Set(rankValues).size>1;
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

    function slotsForSide(side){
        return side==="enemy"?ENEMY_SLOTS:(side==="ally"?ALLY_SLOTS:[]);
    }

    function normalizeShape(shape){
        const value=String(shape||"single");
        if(value==="tri"||value==="horizontal-3"||value==="allyTri"){ return "tri"; }
        if(value==="allyAll"){ return "all"; }
        if(value==="ally"){ return "single"; }
        return value;
    }

    function resolveSlotsFromShape(side,primarySlot,shape){
        const allowed=slotsForSide(side);
        if(!allowed.includes(primarySlot)){ return []; }
        const meta=SLOT_META[primarySlot];
        const normalized=normalizeShape(shape);
        if(normalized==="single"){ return [primarySlot]; }
        if(normalized==="all"){ return allowed.slice(); }
        if(normalized==="row"){
            return allowed.filter(slot=>SLOT_META[slot].row===meta.row)
                .sort((a,b)=>SLOT_META[a].column-SLOT_META[b].column);
        }
        if(normalized==="column"){
            return allowed.filter(slot=>SLOT_META[slot].column===meta.column)
                .sort((a,b)=>{
                    const order=side==="enemy"?{back:0,front:1}:{front:0,back:1};
                    return (order[SLOT_META[a].row]??9)-(order[SLOT_META[b].row]??9);
                });
        }
        if(normalized==="tri"){
            return allowed.filter(slot=>
                SLOT_META[slot].row===meta.row&&
                Math.abs(SLOT_META[slot].column-meta.column)<=1
            ).sort((a,b)=>SLOT_META[a].column-SLOT_META[b].column);
        }
        return [primarySlot];
    }

    /* Geometry is a separate contract from damage-target resolution. Damage may
       omit defeated units; geometry never collapses because a unit is defeated. */
    function normalizeGeometrySide(side){
        const value=String(side||"").toLowerCase();
        if(value==="monster"||value==="enemy"){ return "enemy"; }
        if(value==="player"||value==="ally"){ return "ally"; }
        if(value==="mechanism"||value==="mech"){ return "mechanism"; }
        return value;
    }

    function geometrySlotsForSide(side){
        const normalized=normalizeGeometrySide(side);
        if(normalized==="enemy"){ return ENEMY_SLOTS; }
        if(normalized==="ally"){ return ALLY_SLOTS; }
        if(normalized==="mechanism"){ return MECHANISM; }
        return [];
    }

    function slotSelector(slot){
        const meta=SLOT_META[slot];
        if(!meta){ return null; }
        if(meta.side==="enemy"){ return '.v-fixed-enemy-slot[data-slot="'+slot+'"]'; }
        if(meta.side==="ally"){ return '.v-fixed-ally-slot[data-slot="'+slot+'"]'; }
        return '.boss-mechanism-position[data-slot="'+slot+'"]';
    }

    function slotElement(slot){
        if(typeof document==="undefined"||typeof document.querySelector!=="function"){ return null; }
        const selector=slotSelector(slot);
        if(!selector){ return null; }
        const battlePage=typeof document.getElementById==="function"?document.getElementById("battlePage"):null;
        return battlePage&&typeof battlePage.querySelector==="function"
            ?battlePage.querySelector(selector)
            :document.querySelector(selector);
    }

    function plainRect(rect,slot){
        if(!rect){ return null; }
        const left=Number(rect.left)||0;
        const top=Number(rect.top)||0;
        const width=Math.max(0,Number(rect.width)||0);
        const height=Math.max(0,Number(rect.height)||0);
        if(width<=0||height<=0){ return null; }
        const right=Number.isFinite(Number(rect.right))?Number(rect.right):left+width;
        const bottom=Number.isFinite(Number(rect.bottom))?Number(rect.bottom):top+height;
        return {
            slot:slot||null,left:left,top:top,right:right,bottom:bottom,
            width:width,height:height,centerX:left+width/2,centerY:top+height/2
        };
    }

    function geometryRectForSlot(slot){
        const element=slotElement(slot);
        const rect=element&&typeof element.getBoundingClientRect==="function"?element.getBoundingClientRect():null;
        return plainRect(rect,slot);
    }

    function geometryCenterForSlot(slot){
        const rect=geometryRectForSlot(slot);
        return rect?{slot:slot,x:rect.centerX,y:rect.centerY,rect:rect}:null;
    }

    function geometryRectForSlots(slots){
        const requested=Array.from(new Set((Array.isArray(slots)?slots:[]).filter(slot=>!!SLOT_META[slot])));
        if(!requested.length){ return null; }
        const rects=requested.map(geometryRectForSlot);
        /* Never silently shrink to the subset that happens to be rendered. */
        if(rects.some(rect=>!rect)){ return null; }
        const left=Math.min.apply(null,rects.map(rect=>rect.left));
        const top=Math.min.apply(null,rects.map(rect=>rect.top));
        const right=Math.max.apply(null,rects.map(rect=>rect.right));
        const bottom=Math.max.apply(null,rects.map(rect=>rect.bottom));
        return {
            slots:requested.slice(),left:left,top:top,right:right,bottom:bottom,
            width:right-left,height:bottom-top,centerX:(left+right)/2,centerY:(top+bottom)/2
        };
    }

    function geometryRowSlots(side,row){
        const normalized=normalizeGeometrySide(side);
        const requestedRow=String(row||"").toLowerCase();
        return geometrySlotsForSide(normalized).filter(slot=>SLOT_META[slot].row===requestedRow)
            .sort((a,b)=>SLOT_META[a].column-SLOT_META[b].column);
    }

    function geometryTriSlots(side,primarySlot){
        const normalized=normalizeGeometrySide(side);
        const allowed=geometrySlotsForSide(normalized);
        const meta=SLOT_META[primarySlot];
        if(!meta||meta.side!==normalized||!allowed.includes(primarySlot)){ return []; }
        const row=geometryRowSlots(normalized,meta.row);
        if(row.length<=3){ return row; }
        const start=Math.max(1,Math.min(row.length-2,meta.column-1));
        return row.filter(slot=>SLOT_META[slot].column>=start&&SLOT_META[slot].column<start+3);
    }

    function geometrySlotsFromShape(side,primarySlot,shape){
        const normalizedSide=normalizeGeometrySide(side);
        const allowed=geometrySlotsForSide(normalizedSide);
        if(!allowed.length){ return []; }
        const normalizedShape=normalizeShape(shape);
        if(normalizedShape==="all"){ return allowed.slice(); }
        if(!primarySlot||!allowed.includes(primarySlot)){
            return normalizedShape==="all"?allowed.slice():[];
        }
        const meta=SLOT_META[primarySlot];
        if(normalizedShape==="single"){ return [primarySlot]; }
        if(normalizedShape==="row"){ return geometryRowSlots(normalizedSide,meta.row); }
        if(normalizedShape==="column"){
            return allowed.filter(slot=>SLOT_META[slot].column===meta.column)
                .sort((a,b)=>SLOT_META[a].row.localeCompare(SLOT_META[b].row));
        }
        if(normalizedShape==="tri"){ return geometryTriSlots(normalizedSide,primarySlot); }
        return [primarySlot];
    }

    function geometryRectForShape(side,primarySlot,shape){
        return geometryRectForSlots(geometrySlotsFromShape(side,primarySlot,shape));
    }

    function geometryRowRect(side,row){
        return geometryRectForSlots(geometryRowSlots(side,row));
    }

    function geometrySideRect(side){
        return geometryRectForSlots(geometrySlotsForSide(side));
    }

    function slotFromElement(element){
        let current=element||null;
        while(current){
            const slot=current.dataset&&current.dataset.slot;
            if(slot&&SLOT_META[slot]){ return slot; }
            current=current.parentElement||current.parentNode||null;
        }
        return null;
    }

    function slotForCombatant(side,index){
        const normalized=normalizeGeometrySide(side);
        if(normalized==="enemy"){
            return activeEnemySnapshot?slotForMonster(activeEnemySnapshot,index):null;
        }
        if(normalized==="ally"){
            return allySlotForCharacter(index);
        }
        return null;
    }

    function resolveEnemyTargets(snapshot,primaryMonsterIndex,shape,isAlive){
        if(!snapshot){ return []; }
        const primarySlot=slotForMonster(snapshot,primaryMonsterIndex);
        if(!primarySlot){ return []; }
        return resolveSlotsFromShape("enemy",primarySlot,shape)
            .map(slot=>activeMonsterAt(snapshot,slot,isAlive))
            .filter(index=>Number.isInteger(index));
    }

    function nextEnemyPrimaryTarget(snapshot,isAlive){
        const priority=priorityMonsterIndexes(snapshot,isAlive);
        return priority.length?priority[0]:null;
    }

    function assignedEnemyRows(snapshot){
        if(!snapshot){ return []; }
        return cloneRows(snapshot.rowSlots).map(row=>row
            .map(slot=>assignedMonsterAt(snapshot,slot))
            .filter(index=>Number.isInteger(index))
        );
    }

    function defaultAllySlots(characterIndexes){
        const indexes=(characterIndexes||[]).filter(Number.isInteger).slice(0,6);
        if(indexes.length===1){ return ["ALLY_F2"]; }
        if(indexes.length===2){ return ["ALLY_F1","ALLY_F3"]; }
        return ["ALLY_F1","ALLY_F2","ALLY_F3","ALLY_B1","ALLY_B2","ALLY_B3"].slice(0,indexes.length);
    }

    function normalizeAllyFormation(saved,characterIndexes){
        const indexes=(characterIndexes||[]).filter(Number.isInteger).slice(0,6);
        const allowedIndexes=new Set(indexes);
        const characterIndexToSlot={};
        const slotToCharacterIndex={};
        const savedMap=saved&&typeof saved==="object"&&saved.characterIndexToSlot&&typeof saved.characterIndexToSlot==="object"
            ?saved.characterIndexToSlot:{};

        indexes.forEach(index=>{
            const slot=savedMap[index]||savedMap[String(index)];
            if(ALLY_SLOTS.includes(slot)&&slotToCharacterIndex[slot]===undefined){
                characterIndexToSlot[index]=slot;
                slotToCharacterIndex[slot]=index;
            }
        });

        const defaults=defaultAllySlots(indexes);
        indexes.forEach((index,position)=>{
            if(characterIndexToSlot[index]){ return; }
            const preferred=defaults[position];
            const openPreferred=preferred&&slotToCharacterIndex[preferred]===undefined?preferred:null;
            const slot=openPreferred||ALLY_SLOTS.find(candidate=>slotToCharacterIndex[candidate]===undefined);
            if(!slot){ return; }
            characterIndexToSlot[index]=slot;
            slotToCharacterIndex[slot]=index;
        });

        Object.keys(characterIndexToSlot).forEach(key=>{
            if(!allowedIndexes.has(Number(key))){ delete characterIndexToSlot[key]; }
        });
        return {version:1,kind:"ally-formation",characterIndexToSlot,slotToCharacterIndex};
    }

    let allyFormationState=null;

    function hydrateAllyFormation(saved,characterIndexes){
        allyFormationState=normalizeAllyFormation(saved,characterIndexes);
        return allyFormationState;
    }

    function ensureAllyFormation(characterIndexes){
        allyFormationState=normalizeAllyFormation(allyFormationState,characterIndexes);
        return allyFormationState;
    }

    function getSerializableAllyFormation(){
        if(!allyFormationState){ return null; }
        return {
            version:1,
            characterIndexToSlot:Object.assign({},allyFormationState.characterIndexToSlot)
        };
    }

    function allySlotForCharacter(index){
        return allyFormationState&&allyFormationState.characterIndexToSlot
            ?allyFormationState.characterIndexToSlot[index]||null:null;
    }

    function characterAtAllySlot(slot){
        const value=allyFormationState&&allyFormationState.slotToCharacterIndex
            ?allyFormationState.slotToCharacterIndex[slot]:undefined;
        return Number.isInteger(value)?value:null;
    }

    function moveAllyCharacter(characterIndex,targetSlot){
        if(!allyFormationState||!Number.isInteger(characterIndex)||!ALLY_SLOTS.includes(targetSlot)){ return false; }
        const from=allySlotForCharacter(characterIndex);
        if(!from){ return false; }
        const occupant=characterAtAllySlot(targetSlot);
        if(from===targetSlot){ return true; }
        allyFormationState.characterIndexToSlot[characterIndex]=targetSlot;
        allyFormationState.slotToCharacterIndex[targetSlot]=characterIndex;
        if(Number.isInteger(occupant)){
            allyFormationState.characterIndexToSlot[occupant]=from;
            allyFormationState.slotToCharacterIndex[from]=occupant;
        }else{
            delete allyFormationState.slotToCharacterIndex[from];
        }
        return true;
    }

    function resolveAllyTargets(formation,primaryCharacterIndex,shape,isAlive){
        const state=formation&&formation.kind==="ally-formation"?formation:allyFormationState;
        if(!state){ return []; }
        const normalized=normalizeShape(shape);
        let slots;
        if(normalized==="all"){
            slots=ALLY_SLOTS.slice();
        }else{
            const primarySlot=state.characterIndexToSlot&&state.characterIndexToSlot[primaryCharacterIndex];
            if(!primarySlot){ return []; }
            slots=resolveSlotsFromShape("ally",primarySlot,normalized);
        }
        return slots.map(slot=>{
            const index=state.slotToCharacterIndex&&state.slotToCharacterIndex[slot];
            return Number.isInteger(index)&&(!isAlive||isAlive(index))?index:null;
        }).filter(Number.isInteger);
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
        geometryVersion:"slot-geometry-v1",
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
        getAssignedEnemyRows:assignedEnemyRows,
        resolveSlotsFromShape:resolveSlotsFromShape,
        resolveEnemyTargets:resolveEnemyTargets,
        getNextEnemyPrimaryTarget:nextEnemyPrimaryTarget,
        normalizeAllyFormation:normalizeAllyFormation,
        hydrateAllyFormation:hydrateAllyFormation,
        ensureAllyFormation:ensureAllyFormation,
        getSerializableAllyFormation:getSerializableAllyFormation,
        getAllySlotForCharacter:allySlotForCharacter,
        getCharacterAtAllySlot:characterAtAllySlot,
        moveAllyCharacter:moveAllyCharacter,
        resolveAllyTargets:resolveAllyTargets,
        setActiveEnemySnapshot:setActiveEnemySnapshot,
        getActiveEnemySnapshot:getActiveEnemySnapshot,
        clearActiveEnemySnapshot:clearActiveEnemySnapshot,
        getSlotElement:slotElement,
        getSlotRect:geometryRectForSlot,
        getSlotCenter:geometryCenterForSlot,
        getRectForSlots:geometryRectForSlots,
        getRowSlots:geometryRowSlots,
        getRowRect:geometryRowRect,
        getSideSlots:geometrySlotsForSide,
        getSideRect:geometrySideRect,
        getGeometrySlotsFromShape:geometrySlotsFromShape,
        getGeometryRectFromShape:geometryRectForShape,
        getSlotFromElement:slotFromElement,
        getSlotForCombatant:slotForCombatant
    };

    window.FourSymbolsBattlefieldSlots=Object.freeze(api);
    if(Object.prototype.hasOwnProperty.call(window,"__fourSymbolsPendingAllyFormation")){
        const indexes=typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes():[];
        hydrateAllyFormation(window.__fourSymbolsPendingAllyFormation,indexes);
        delete window.__fourSymbolsPendingAllyFormation;
    }
})();