
/* bundled source: js/battlefield-slot-owner.js */
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
    const BOSS_FOOTPRINT=Object.freeze([
        "ENEMY_B2","ENEMY_B3","ENEMY_B4",
        "ENEMY_F2","ENEMY_F3","ENEMY_F4"
    ]);
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

    function removeMonsterFromSlot(snapshot,monsterIndex){
        if(!snapshot||!Number.isInteger(monsterIndex)){ return false; }
        const current=slotForMonster(snapshot,monsterIndex);
        if(!current){ return false; }
        snapshot.slotToMonsterIndex[current]=null;
        delete snapshot.monsterIndexToSlot[monsterIndex];
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

    function fixedTriGeometrySlots(side,primarySlot){
        const allowed=slotsForSide(side);
        const meta=SLOT_META[primarySlot];
        if(!meta||!allowed.includes(primarySlot)){ return []; }
        const row=allowed.filter(slot=>SLOT_META[slot].row===meta.row)
            .sort((a,b)=>SLOT_META[a].column-SLOT_META[b].column);
        if(row.length<=3){ return row; }
        const primaryPosition=row.indexOf(primarySlot);
        const start=Math.max(0,Math.min(row.length-3,primaryPosition-1));
        return row.slice(start,start+3);
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
        return value;
    }

    function geometrySlotsForSide(side){
        const normalized=normalizeGeometrySide(side);
        if(normalized==="enemy"){ return ENEMY_SLOTS; }
        if(normalized==="ally"){ return ALLY_SLOTS; }
        return [];
    }

    function slotSelector(slot){
        const meta=SLOT_META[slot];
        if(!meta){ return null; }
        if(meta.side==="enemy"){ return '.v-fixed-enemy-slot[data-slot="'+slot+'"]'; }
        if(meta.side==="ally"){ return '.v-fixed-ally-slot[data-slot="'+slot+'"]'; }
        return null;
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
        return fixedTriGeometrySlots(normalized,primarySlot);
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
        bossFootprintSlots:BOSS_FOOTPRINT,
        slotMeta:SLOT_META,
        getEnemyFormationSlotRows:enemyRowsForType,
        getPrioritySlotsForFormation:prioritySlotsForType,
        createEnemyFormationSnapshot:createEnemyFormationSnapshot,
        getEnemySlotForMonster:slotForMonster,
        getAssignedMonsterAtEnemySlot:assignedMonsterAt,
        getActiveMonsterAtEnemySlot:activeMonsterAt,
        assignMonsterToEnemySlot:assignMonsterToSlot,
        removeMonsterFromEnemySlot:removeMonsterFromSlot,
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


/* bundled source: js/battle-statistics-system.js */
/* =====================================================
   Battle Statistics / Battle Insight UI
   - One per-battle statistics owner keyed by combatant id.
   - UI reads the same live/final snapshot; no duplicate result calculation.
   - Drawers are non-blocking observers; combat continues while they are open.
===================================================== */
(function installBattleStatisticsSystem(){
    "use strict";

    if(typeof window==="undefined"||window.__battleStatisticsSystemInstalled){ return; }
    window.__battleStatisticsSystemInstalled=true;

    const VALID_KINDS=new Set(["playerCharacter","heroNpc","reinforcement"]);
    let session=null;
    let finalSnapshot=null;
    let bossMechanisms=[];
    let openDrawer=null;
    let resultCloseCallback=null;

    function number(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }
    function amount(value){ return Math.max(0,number(value)); }
    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function copy(value){ return JSON.parse(JSON.stringify(value)); }
    function normalizeCombatant(input){
        if(!input||!input.id){ return null; }
        const kind=VALID_KINDS.has(input.kind)?input.kind:"playerCharacter";
        const battleIndex=Number.isInteger(Number(input.battleIndex))?Number(input.battleIndex):null;
        return {
            id:String(input.id),
            kind:kind,
            side:input.side==="enemy"?"enemy":"ally",
            battleIndex:battleIndex,
            name:String(input.name||"未命名單位"),
            portrait:String(input.portrait||""),
            damageDealt:Math.max(0,number(input.damageDealt)),
            healingDone:Math.max(0,number(input.healingDone)),
            damageTaken:Math.max(0,number(input.damageTaken)),
            criticalHits:Math.max(0,Math.floor(number(input.criticalHits)))
        };
    }
    function snapshotFrom(source){
        if(!source){ return null; }
        return {
            battleToken:source.battleToken,
            active:!!source.active,
            result:source.result||null,
            combatants:Array.from(source.combatants.values())
                .filter(item=>item.side==="ally")
                .map(item=>copy(item))
        };
    }
    function currentSnapshot(){
        return session&&session.active?snapshotFrom(session):finalSnapshot&&copy(finalSnapshot);
    }
    function findCombatant(id){
        if(!session||!session.active||!id){ return null; }
        return session.combatants.get(String(id))||null;
    }
    function formatValue(value){
        return Math.max(0,Math.floor(number(value))).toLocaleString("zh-TW");
    }

    function battleRoot(){
        return document.getElementById("battlePage");
    }
    function appRoot(){
        return document.getElementById("game-content")||document.getElementById("app")||document.body;
    }
    function clampEdgeTop(edge,root,value){
        const height=Math.max(1,Number(root&&root.clientHeight)||0);
        const edgeHeight=Math.max(1,Number(edge&&edge.offsetHeight)||0);
        const minTop=8;
        const maxTop=Math.max(minTop,height-edgeHeight-8);
        return Math.max(minTop,Math.min(maxTop,Number(value)||minTop));
    }
    function installStatsEdgeDrag(edge,root){
        if(!edge||!root||edge.__battleStatsEdgeDragInstalled){ return; }
        edge.__battleStatsEdgeDragInstalled=true;
        let drag=null;

        function finishDrag(event){
            if(!drag){ return; }
            if(event&&event.pointerId!==undefined&&drag.pointerId!==undefined&&event.pointerId!==drag.pointerId){ return; }
            const moved=drag.moved;
            drag=null;
            edge.classList.remove("is-dragging");
            if(moved){
                edge.__suppressNextClick=true;
                setTimeout(()=>{ edge.__suppressNextClick=false; },0);
            }
        }

        edge.addEventListener("pointerdown",event=>{
            if(event.button!==undefined&&event.button!==0){ return; }
            const rect=root.getBoundingClientRect();
            const rootHeight=Math.max(1,Number(root.clientHeight)||rect.height||1);
            drag={
                pointerId:event.pointerId,
                startClientY:Number(event.clientY)||0,
                startTop:clampEdgeTop(edge,root,edge.offsetTop),
                scaleY:rect.height>0?rootHeight/rect.height:1,
                moved:false
            };
            edge.classList.add("is-dragging");
            if(typeof edge.setPointerCapture==="function"&&event.pointerId!==undefined){
                try{ edge.setPointerCapture(event.pointerId); }catch(_){ }
            }
            event.preventDefault();
        });
        edge.addEventListener("pointermove",event=>{
            if(!drag||event.pointerId!==drag.pointerId){ return; }
            const delta=((Number(event.clientY)||0)-drag.startClientY)*drag.scaleY;
            if(!drag.moved&&Math.abs(delta)>=3){ drag.moved=true; }
            if(!drag.moved){ return; }
            edge.style.top=clampEdgeTop(edge,root,drag.startTop+delta)+"px";
            event.preventDefault();
        });
        edge.addEventListener("pointerup",finishDrag);
        edge.addEventListener("pointercancel",finishDrag);
    }
    function ensureBattleUi(){
        if(typeof document==="undefined"){ return null; }
        const root=battleRoot();
        if(!root){ return null; }

        let edge=document.getElementById("battleStatsEdgeButton");
        if(!edge){
            edge=document.createElement("button");
            edge.type="button";
            edge.id="battleStatsEdgeButton";
            edge.className="battle-stats-edge-button";
            edge.setAttribute("aria-label","戰鬥數據");
            edge.innerHTML="<span>戰</span><span>鬥</span><span>數</span><span>據</span>";
            edge.addEventListener("click",event=>{
                if(edge.__suppressNextClick){
                    edge.__suppressNextClick=false;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
                openBattleDrawer("stats");
            });
            root.appendChild(edge);
        }

        let alertButton=document.getElementById("battleMechanismAlert");
        if(!alertButton){
            alertButton=document.createElement("button");
            alertButton.type="button";
            alertButton.id="battleMechanismAlert";
            alertButton.className="battle-mechanism-alert";
            alertButton.setAttribute("aria-label","查看 Boss 功能卡");
            alertButton.textContent="!";
            alertButton.addEventListener("click",()=>openBattleDrawer("boss"));
            root.appendChild(alertButton);
        }

        const staleScrim=document.getElementById("battleInsightScrim");
        if(staleScrim&&typeof staleScrim.remove==="function"){ staleScrim.remove(); }

        let statsDrawer=document.getElementById("battleStatsDrawer");
        if(!statsDrawer){
            statsDrawer=document.createElement("aside");
            statsDrawer.id="battleStatsDrawer";
            statsDrawer.className="battle-insight-drawer battle-stats-drawer";
            statsDrawer.setAttribute("aria-label","戰鬥數據");
            statsDrawer.innerHTML='<header><b>戰鬥數據</b><button type="button" data-close>×</button></header><div class="battle-insight-drawer-body"></div>';
            statsDrawer.querySelector("[data-close]").addEventListener("click",closeBattleDrawer);
            root.appendChild(statsDrawer);
        }

        let bossDrawer=document.getElementById("battleBossMechanismDrawer");
        if(!bossDrawer){
            bossDrawer=document.createElement("aside");
            bossDrawer.id="battleBossMechanismDrawer";
            bossDrawer.className="battle-insight-drawer battle-boss-mechanism-drawer";
            bossDrawer.setAttribute("aria-label","Boss 功能卡");
            bossDrawer.innerHTML='<header><b>Boss 功能卡</b><button type="button" data-close>×</button></header><div class="battle-insight-drawer-body"></div>';
            bossDrawer.querySelector("[data-close]").addEventListener("click",closeBattleDrawer);
            root.appendChild(bossDrawer);
        }
        installStatsEdgeDrag(edge,root);
        return {edge,alertButton,statsDrawer,bossDrawer};
    }
    function syncBattleEntryVisibility(){
        const ui=ensureBattleUi();
        if(!ui){ return; }
        const active=!!(session&&session.active);
        ui.edge.hidden=!active;
        ui.alertButton.hidden=!active||bossMechanisms.length===0;
        if(!active){ closeBattleDrawer(); }
    }
    function statRow(label,value){
        return '<div><span>'+escapeHtml(label)+'</span><b>'+formatValue(value)+'</b></div>';
    }
    function renderStatsDrawer(){
        const drawer=document.getElementById("battleStatsDrawer");
        const body=drawer&&drawer.querySelector(".battle-insight-drawer-body");
        if(!body){ return; }
        const snapshot=currentSnapshot();
        const combatants=snapshot&&Array.isArray(snapshot.combatants)?snapshot.combatants:[];
        body.innerHTML=combatants.length?combatants.map(item=>
            '<article class="battle-stat-card">'+
                '<div class="battle-stat-identity">'+
                    (item.portrait?'<img src="'+escapeHtml(item.portrait)+'" alt="">':'<span class="battle-stat-avatar-fallback" aria-hidden="true">◆</span>')+
                    '<div><b>'+escapeHtml(item.name)+'</b><small>'+escapeHtml(item.kind==="heroNpc"?"英雄 NPC":item.kind==="reinforcement"?"援軍":"玩家角色")+'</small></div>'+
                '</div>'+
                '<div class="battle-stat-grid">'+
                    statRow("總傷害",item.damageDealt)+
                    statRow("造成治療量",item.healingDone)+
                    statRow("承受傷害",item.damageTaken)+
                    statRow("暴擊次數",item.criticalHits)+
                '</div>'+
            '</article>'
        ).join(""):'<p class="battle-insight-empty">目前沒有可統計的我方戰鬥單位。</p>';
    }
    function mechanismMarkup(item){
        const remaining=item.remaining===null||item.remaining===undefined||item.remaining===""
            ?""
            :'<div><span>剩餘</span><b>'+escapeHtml(item.remaining)+'</b></div>';
        return '<article class="battle-mechanism-card">'+
            '<div class="battle-mechanism-title">'+
                (item.icon?'<img src="'+escapeHtml(item.icon)+'" alt="">':'<span aria-hidden="true">!</span>')+
                '<b>'+escapeHtml(item.name||"Boss 機制")+'</b>'+
            '</div>'+
            '<p>'+escapeHtml(item.effect||"")+'</p>'+
            '<div><span>觸發條件</span><b>'+escapeHtml(item.trigger||"戰鬥機制觸發")+'</b></div>'+
            '<div><span>目前狀態</span><b>'+escapeHtml(item.status||"生效中")+'</b></div>'+
            remaining+
        '</article>';
    }
    function renderBossDrawer(){
        const drawer=document.getElementById("battleBossMechanismDrawer");
        const body=drawer&&drawer.querySelector(".battle-insight-drawer-body");
        if(!body){ return; }
        body.innerHTML=bossMechanisms.length
            ?bossMechanisms.map(mechanismMarkup).join("")
            :'<p class="battle-insight-empty">目前場上沒有生效中的 Boss 功能卡。</p>';
    }
    function openBattleDrawer(kind){
        if(!session||!session.active){ return false; }
        const next=kind==="boss"?"boss":"stats";
        if(next==="boss"&&bossMechanisms.length===0){ return false; }
        const ui=ensureBattleUi();
        if(!ui){ return false; }

        if(openDrawer===next){ return true; }
        closeBattleDrawer();
        openDrawer=next;

        const drawer=next==="boss"?ui.bossDrawer:ui.statsDrawer;
        drawer.classList.add("open");
        if(next==="boss"){ renderBossDrawer(); }else{ renderStatsDrawer(); }
        if(typeof window.syncBattleUiPriorityLayer==="function"){ window.syncBattleUiPriorityLayer(); }
        return true;
    }
    function closeBattleDrawer(){
        if(typeof document!=="undefined"){
            const stats=document.getElementById("battleStatsDrawer");
            const boss=document.getElementById("battleBossMechanismDrawer");
            if(stats){ stats.classList.remove("open"); }
            if(boss){ boss.classList.remove("open"); }
        }
        openDrawer=null;
        if(typeof window.syncBattleUiPriorityLayer==="function"){ window.syncBattleUiPriorityLayer(); }
    }
    function syncOpenDrawer(){
        if(openDrawer==="stats"){ renderStatsDrawer(); }
        else if(openDrawer==="boss"){ renderBossDrawer(); }
    }

    function ensureResultModal(){
        if(typeof document==="undefined"){ return null; }
        let modal=document.getElementById("battleStatisticsResultModal");
        if(modal){ return modal; }
        modal=document.createElement("section");
        modal.id="battleStatisticsResultModal";
        modal.className="battle-statistics-result-modal";
        modal.hidden=true;
        modal.innerHTML='<div class="battle-statistics-result-panel"><header><div><small>Battle Result Details（戰鬥詳細結算）</small><h2 data-title>戰鬥詳細結算</h2><p data-subtitle></p></div></header><div class="battle-statistics-result-body"></div><footer><button type="button" data-close>關閉</button></footer></div>';
        modal.querySelector("[data-close]").addEventListener("click",()=>hideResultDetails(true));
        appRoot().appendChild(modal);
        return modal;
    }
    function showResultDetails(options){
        if(!finalSnapshot||!Array.isArray(finalSnapshot.combatants)){ return false; }
        const modal=ensureResultModal();
        if(!modal){ return false; }
        const config=options&&typeof options==="object"?options:{};
        resultCloseCallback=typeof config.onClose==="function"?config.onClose:null;
        modal.querySelector("[data-title]").textContent=String(config.title||"戰鬥詳細結算");
        modal.querySelector("[data-subtitle]").textContent=String(config.subtitle||"");
        const body=modal.querySelector(".battle-statistics-result-body");
        body.innerHTML=finalSnapshot.combatants.map(item=>
            '<article class="battle-result-stat-card">'+
                '<div class="battle-stat-identity">'+
                    (item.portrait?'<img src="'+escapeHtml(item.portrait)+'" alt="">':'<span class="battle-stat-avatar-fallback" aria-hidden="true">◆</span>')+
                    '<div><b>'+escapeHtml(item.name)+'</b><small>'+escapeHtml(item.kind==="heroNpc"?"英雄 NPC":item.kind==="reinforcement"?"援軍":"玩家角色")+'</small></div>'+
                '</div>'+
                '<div class="battle-stat-grid">'+
                    statRow("總傷害",item.damageDealt)+
                    statRow("造成治療量",item.healingDone)+
                    statRow("承受傷害",item.damageTaken)+
                    statRow("暴擊次數",item.criticalHits)+
                '</div>'+
            '</article>'
        ).join("");
        modal.hidden=false;
        return true;
    }
    function hideResultDetails(invokeCallback){
        const modal=typeof document!=="undefined"?document.getElementById("battleStatisticsResultModal"):null;
        if(modal){ modal.hidden=true; }
        const callback=resultCloseCallback;
        resultCloseCallback=null;
        if(invokeCallback!==false&&typeof callback==="function"){
            try{ callback(); }catch(error){ console.error("戰鬥詳細結算關閉回呼失敗：",error); }
        }
    }

    function begin(config){
        closeBattleDrawer();
        hideResultDetails(false);
        bossMechanisms=[];
        const input=config&&typeof config==="object"?config:{};
        session={
            battleToken:input.battleToken==null?null:input.battleToken,
            active:true,
            result:null,
            combatants:new Map()
        };
        (Array.isArray(input.combatants)?input.combatants:[]).forEach(registerCombatant);
        finalSnapshot=null;
        syncBattleEntryVisibility();
        syncOpenDrawer();
        return currentSnapshot();
    }
    function registerCombatant(input){
        if(!session||!session.active){ return false; }
        const next=normalizeCombatant(input);
        if(!next){ return false; }
        const current=session.combatants.get(next.id);
        if(current){
            next.damageDealt=current.damageDealt;
            next.healingDone=current.healingDone;
            next.damageTaken=current.damageTaken;
            next.criticalHits=current.criticalHits;
        }
        session.combatants.set(next.id,next);
        syncOpenDrawer();
        return true;
    }
    function recordDamage(input){
        if(!session||!session.active){ return false; }
        const event=input&&typeof input==="object"?input:{};
        const value=amount(event.amount);
        const source=findCombatant(event.sourceId);
        const target=findCombatant(event.targetId);
        if(source&&value>0){ source.damageDealt+=value; }
        if(target&&value>0){ target.damageTaken+=value; }
        syncOpenDrawer();
        return !!(source||target);
    }
    function recordHealing(input){
        if(!session||!session.active){ return false; }
        const event=input&&typeof input==="object"?input:{};
        const value=amount(event.amount);
        const source=findCombatant(event.sourceId);
        if(source&&value>0){ source.healingDone+=value;syncOpenDrawer();return true; }
        return false;
    }
    function recordCritical(input){
        if(!session||!session.active){ return false; }
        const event=input&&typeof input==="object"?input:{id:input};
        const source=findCombatant(event&&event.id);
        if(!source){ return false; }
        source.criticalHits+=1;
        syncOpenDrawer();
        return true;
    }
    function finish(input){
        if(!session){ return finalSnapshot&&copy(finalSnapshot); }
        if(session.active){
            session.active=false;
            session.result=input&&input.result?String(input.result):null;
            finalSnapshot=snapshotFrom(session);
        }
        bossMechanisms=[];
        closeBattleDrawer();
        syncBattleEntryVisibility();
        return finalSnapshot&&copy(finalSnapshot);
    }
    function getCombatantIdByBattleIndex(index){
        const source=session&&session.active?session:null;
        if(!source){ return null; }
        for(const item of source.combatants.values()){
            if(item.side==="ally"&&item.battleIndex===Number(index)){ return item.id; }
        }
        return null;
    }
    function setBossMechanisms(cards){
        bossMechanisms=(Array.isArray(cards)?cards:[]).map((item,index)=>({
            id:String(item&&item.id||("mechanism-"+index)),
            name:String(item&&item.name||"Boss 機制"),
            icon:String(item&&item.icon||""),
            effect:String(item&&item.effect||""),
            trigger:String(item&&item.trigger||"戰鬥機制觸發"),
            status:String(item&&item.status||"生效中"),
            remaining:item&&item.remaining!==undefined?item.remaining:null
        }));
        if(openDrawer==="boss"&&bossMechanisms.length===0){ closeBattleDrawer(); }
        syncBattleEntryVisibility();
        syncOpenDrawer();
        return copy(bossMechanisms);
    }
    function clearBossMechanisms(){ return setBossMechanisms([]); }

    window.FourSymbolsBattleStatistics=Object.freeze({
        version:"battle-statistics-v1",
        begin:begin,
        registerCombatant:registerCombatant,
        recordDamage:recordDamage,
        recordHealing:recordHealing,
        recordCritical:recordCritical,
        finish:finish,
        getSnapshot:function(){ const value=currentSnapshot();return value&&copy(value); },
        getFinalSnapshot:function(){ return finalSnapshot&&copy(finalSnapshot); },
        getCombatantIdByBattleIndex:getCombatantIdByBattleIndex,
        setBossMechanisms:setBossMechanisms,
        clearBossMechanisms:clearBossMechanisms,
        openStatistics:function(){ return openBattleDrawer("stats"); },
        openBossMechanisms:function(){ return openBattleDrawer("boss"); },
        closeDrawer:closeBattleDrawer,
        showResultDetails:showResultDetails,
        hideResultDetails:hideResultDetails
    });
})();


/* bundled source: js/25-v131-fix-batch.js */
/* V131 — targeted gameplay/UI fixes for request batch 17. */
(function installV131FixBatch(){
    "use strict";

    /*
       ★ V138：節奏拆成兩個明確規則。
       - 每一位有效角色／怪物出手後，等 1.6 秒才輪下一位。
       - 一整輪最後一位出手到下一輪第一位出手，總共固定 2 秒。

       舊版共用一個 1.25 秒常數，而且已死亡的佇列成員仍會逐個
       呼叫 finishPlayerAction()、每個再多等一次，尾端剛好有
       2～3 個死亡成員時就會累積成玩家感受到的 3～5 秒。
       V138 會在排程前一次略過所有已死亡空位。2 秒總轉場由
       0.4 秒的回合交接＋1.6 秒的首位出手等待組成，不會錯疊成
       2+1.6＝3.6 秒，也不會再隨死亡數量越拖越久。
    */
    /* Historical diagnostic metadata only. The live timing owner is 00-main. */
    const V138_ACTION_DELAY_MS=1250;
    const V138_ROUND_TRANSITION_MS=1250;
    const V138_ROUND_HANDOFF_DELAY_MS=800;
    const V138_ROUND_ANNOUNCEMENT_DELAY_MS=450;
    const V173_32_WILD_ZONE_STRENGTHS=Object.freeze([
        0.75,0.90,0.95,1.00,1.05,1.10,1.15,1.20,1.25,1.30
    ]);
    const ELEMENT_BOX_REWARD_MS=8*60*60*1000;
    const ELEMENT_BOX_KEY=window.FourSymbolsAccountSave.accountKey("element-box-state");

    /*
       ★ 新增（依照使用者要求，經濟／養成重新設計第一輪）：
       1. 精英/BOSS的戰鬥EXP要比普通怪高（精英×1.5、BOSS×3），
          正式怪物 EXP 直接以怪物資料公式產生，再套 rank 倍率；不再
          透過全域歷史倍率補正。
       2. 元素匣（自動掛機）戰鬥的EXP只給70%，金幣/掉落/材料
          完全不受影響（那些是另外獨立的函式，這裡完全沒有動）。
          目的是讓「掛機」明顯比「手動玩」慢，避免無腦掛機
          就能在短時間衝到滿等。
    */
    const ELEMENT_BOX_EXP_RATIO=0.70;
    const V17342_GLOBAL_EXP_REWARD_MULTIPLIER=3;
    const V17342_GLOBAL_GOLD_REWARD_MULTIPLIER=5;
    const V173_BEGINNER_FOREST_TARGET_BATTLES=20;
    const V173_BEGINNER_FOREST_FALLBACK_EXP=690;

    function getBeginnerForestBattleExp(){
        if(typeof window.v133GetExpNextForLevel!=="function"){
            return V173_BEGINNER_FOREST_FALLBACK_EXP;
        }
        let totalRequired=0;
        for(let level=1;level<=9;level++){
            totalRequired+=Math.max(1,Math.round(Number(window.v133GetExpNextForLevel(level))||0));
        }
        return Math.max(1,Math.ceil(totalRequired/V173_BEGINNER_FOREST_TARGET_BATTLES));
    }

    window.v173GetBeginnerForestBattleExp=getBeginnerForestBattleExp;

    function getBeginnerForestMonsterExpUnit(){
        /* V173.40 targeted ~20 battles using one flat battle reward.
           V173.42 keeps that old 3-monster reference value, but pays per
           defeated monster so 1 / 2 / 3 monsters are no longer identical. */
        return Math.max(1,Math.ceil(getBeginnerForestBattleExp()/3));
    }
    window.v17342GetBeginnerForestMonsterExpUnit=getBeginnerForestMonsterExpUnit;

    function getMonsterExpRankMultiplier(monster){
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    /* Formal base EXP: a normal monster's own reward before rank/mode rules.
       35 is the established Lv×10 × historical 3.5 result, now encoded at
       this data owner so every player-facing reward remains unchanged. */
    function getFormalMonsterBaseExp(monster){
        return Math.max(0,Math.floor((Number(monster&&monster.level)||0)*35));
    }

    function getPatrolProgressionExpMultiplier(level){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        return safeLevel<20 ? V17342_GLOBAL_EXP_REWARD_MULTIPLIER : 1;
    }

    function getPatrolProgressionReferenceLevel(){
        if(typeof window.v133GetHighestCreatedCharacterLevel==="function"){
            return Math.max(1,Math.floor(Number(window.v133GetHighestCreatedCharacterLevel())||1));
        }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const indexes=getExistingPartyIndexes();
            if(indexes&&indexes.length){
                return indexes.reduce((highest,index)=>{
                    const character=getPartyCharacterByIndex(index);
                    return character?Math.max(highest,Math.floor(Number(character.level)||1)):highest;
                },1);
            }
        }
        return typeof player!=="undefined"&&player ? Math.max(1,Math.floor(Number(player.level)||1)) : 1;
    }

    function calculateStandardPatrolExp(monsterList,progressionLevel){
        const rankAdjustedExp=(Array.isArray(monsterList)?monsterList:[]).reduce((total,monster)=>{
            if(!monster){ return total; }
            return total+getFormalMonsterBaseExp(monster)*getMonsterExpRankMultiplier(monster);
        },0);
        return Math.max(0,Math.floor(
            rankAdjustedExp*getPatrolProgressionExpMultiplier(progressionLevel)
        ));
    }

    function applyPatrolExpMode(standardExp,options){
        const safeExp=Math.max(0,Math.floor(Number(standardExp)||0));
        const mode=options&&typeof options==="object"?options:{};
        if(mode.elementBox){ return Math.round(safeExp*ELEMENT_BOX_EXP_RATIO); }
        if(mode.rested){ return Math.round(safeExp*2); }
        return safeExp;
    }

    window.v173GetPatrolProgressionExpMultiplier=getPatrolProgressionExpMultiplier;
    window.v173GetFormalMonsterBaseExp=getFormalMonsterBaseExp;
    window.v173GetPatrolProgressionReferenceLevel=getPatrolProgressionReferenceLevel;
    window.v173CalculateStandardPatrolExp=calculateStandardPatrolExp;
    window.v173ApplyPatrolExpMode=applyPatrolExpMode;

    function getFormationRankWeight(monsterIndex){
        const monster=monsters[monsterIndex];
        const rank=getMonsterRank(monster);
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 2; }
        return 1;
    }

    function fixedBattlefieldSlots(){
        return window.FourSymbolsBattlefieldSlots||null;
    }

    function ensureEnemyFormationSnapshot(indexes){
        const owner=fixedBattlefieldSlots();
        if(!owner){ return null; }
        const requested=(Array.isArray(indexes)?indexes:currentBattleMonsters||[])
            .filter(index=>Number.isInteger(index)).slice(0,10);
        if(!requested.length){ return null; }
        const existing=owner.getActiveEnemySnapshot();
        const activeMatches=existing&&requested.every(index=>!!owner.getEnemySlotForMonster(existing,index));
        if(activeMatches){ return existing; }
        if(!requested.length){ return null; }
        const snapshot=owner.createEnemyFormationSnapshot(requested,{
            originalFormationType:requested.length,
            rankWeight:getFormationRankWeight
        });
        owner.setActiveEnemySnapshot(snapshot);
        return snapshot;
    }

    function getFormationRows(indexes){
        const owner=fixedBattlefieldSlots();
        const requested=(indexes||[]).filter(index=>Number.isInteger(index)).slice(0,10);
        if(!owner){ return requested.length?[requested,[]]:[[],[]]; }
        let snapshot=owner.getActiveEnemySnapshot();
        const activeMatches=snapshot&&requested.every(index=>!!owner.getEnemySlotForMonster(snapshot,index));
        if(!activeMatches){
            snapshot=owner.createEnemyFormationSnapshot(requested,{
                originalFormationType:Math.max(1,requested.length),
                rankWeight:getFormationRankWeight
            });
        }
        const rows=owner.getAssignedEnemyRows(snapshot);
        while(rows.length<2){ rows.push([]); }
        return rows;
    }

    function currentFormationRows(){
        const snapshot=ensureEnemyFormationSnapshot(currentBattleMonsters);
        const owner=fixedBattlefieldSlots();
        if(snapshot&&owner){
            const rows=owner.getAssignedEnemyRows(snapshot);
            while(rows.length<2){ rows.push([]); }
            return rows;
        }
        return getFormationRows(currentBattleMonsters);
    }

    window.v138EnsureEnemyFormationSnapshot=ensureEnemyFormationSnapshot;

    function formatDuration(ms){
        const safe=Math.max(0,Math.floor(Number(ms)||0));
        const totalMinutes=Math.floor(safe/60000);
        const hours=Math.floor(totalMinutes/60);
        const minutes=totalMinutes%60;
        return hours+"小時 "+minutes+"分鐘";
    }

    /* Queue advancement belongs exclusively to 00-main.js. Earlier pacing
       wrappers duplicated finishPlayerAction/processNextCombatant and could
       strand an initiative entry when a visual Promise completed out of order. */


    function applyBattleFormation(){
        const area=document.getElementById("battleMonsterArea");
        const owner=fixedBattlefieldSlots();
        if(!area||!owner){ return; }
        const indexes=currentBattleMonsters.slice(0,10);
        const snapshot=ensureEnemyFormationSnapshot(indexes);
        if(!snapshot){ return; }
        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battleMonster"+index);
            if(card){
                const monster=monsters[index];
                const rank=getMonsterRank(monster);
                card.dataset.element=(monster&&monster.element)||"unknown";
                card.dataset.rank=rank==="boss"?"boss":(rank==="elite"?"elite":"regular");
                cards.set(index,card);
            }
        });
        area.innerHTML="";
        area.classList.add("v131-formation","v-fixed-enemy-zone");
        area.dataset.monsterCount=String(indexes.length);
        area.dataset.formationType=String(snapshot.originalFormationType);
        [owner.enemyBackSlots,owner.enemyFrontSlots].forEach((rowSlots,rowIndex)=>{
            const rowEl=document.createElement("div");
            rowEl.className="v131-monster-row v131-monster-row-"+(rowIndex+1)+" v-fixed-enemy-row";
            rowSlots.forEach(slot=>{
                const slotEl=document.createElement("div");
                slotEl.className="v-fixed-battle-slot v-fixed-enemy-slot";
                slotEl.dataset.slot=slot;
                const index=owner.getAssignedMonsterAtEnemySlot(snapshot,slot);
                const card=Number.isInteger(index)?cards.get(index):null;
                if(card){
                    card.dataset.slot=slot;
                    slotEl.appendChild(card);
                }
                rowEl.appendChild(slotEl);
            });
            area.appendChild(rowEl);
        });
    }

    function ensureAllyFormationState(){
        const owner=fixedBattlefieldSlots();
        if(!owner||typeof owner.ensureAllyFormation!=="function"){ return null; }
        return owner.ensureAllyFormation(getExistingPartyIndexes());
    }

    function applyAllyBattleFormation(){
        const area=document.getElementById("battlePlayerRow");
        const formation=ensureAllyFormationState();
        if(!area||!formation){ return; }
        const cards=new Map();
        getExistingPartyIndexes().forEach(index=>{
            const card=document.getElementById("battlePlayerCard"+index);
            if(card){ cards.set(index,card); }
        });
        area.innerHTML="";
        area.classList.add("v-fixed-ally-formation");
        const owner=fixedBattlefieldSlots();
        [owner.allyFrontSlots,owner.allyBackSlots].forEach((slots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-ally-row v-fixed-ally-row-"+(rowIndex===0?"front":"back");
            slots.forEach(slot=>{
                const wrapper=document.createElement("div");
                wrapper.className="v-fixed-unit-slot v-fixed-ally-slot";
                wrapper.dataset.slot=slot;
                const characterIndex=owner.getCharacterAtAllySlot(slot);
                const card=Number.isInteger(characterIndex)?cards.get(characterIndex):null;
                if(card){ wrapper.appendChild(card); }
                row.appendChild(wrapper);
            });
            area.appendChild(row);
        });
    }

    let vFixedFormationSelectedCharacter=null;
    function formationSlotLabel(slot){
        const labels={ALLY_F1:"前左",ALLY_F2:"前中",ALLY_F3:"前右",ALLY_B1:"後左",ALLY_B2:"後中",ALLY_B3:"後右"};
        return labels[slot]||slot;
    }
    function renderAllyFormationContent(){
        const formation=ensureAllyFormationState();
        if(!formation){ return '<div class="v-fixed-formation-empty">目前無法讀取佈陣資料。</div>'; }
        const renderRow=(label,slots)=>'<section class="v-fixed-formation-row"><header>'+label+'</header><div class="v-fixed-formation-slots">'+slots.map(slot=>{
            const index=fixedBattlefieldSlots().getCharacterAtAllySlot(slot);
            const character=Number.isInteger(index)?getPartyCharacterByIndex(index):null;
            const selected=Number.isInteger(index)&&index===vFixedFormationSelectedCharacter;
            return '<button type="button" class="v-fixed-formation-slot'+(selected?' selected':'')+'" data-slot="'+slot+'" onclick="vFixedSelectFormationSlot(\''+slot+'\')">'+
                '<small>'+formationSlotLabel(slot)+'</small><strong>'+(character?(character.id||('角色'+(index+1))):'空位')+'</strong></button>';
        }).join('')+'</div></section>';
        return '<div class="v-fixed-formation-panel"><p>先點角色，再點目標格位；若目標已有角色會直接交換。</p>'+renderRow('前排',fixedBattlefieldSlots().allyFrontSlots)+renderRow('後排',fixedBattlefieldSlots().allyBackSlots)+'</div>';
    }
    window.vFixedRenderAllyFormationContent=renderAllyFormationContent;
    window.vFixedSelectFormationSlot=function(slot){
        const formation=ensureAllyFormationState();
        if(!formation||!fixedBattlefieldSlots().allySlots.includes(slot)){ return; }
        const occupant=fixedBattlefieldSlots().getCharacterAtAllySlot(slot);
        if(!Number.isInteger(vFixedFormationSelectedCharacter)){
            if(!Number.isInteger(occupant)){ return; }
            vFixedFormationSelectedCharacter=occupant;
        }else{
            fixedBattlefieldSlots().moveAllyCharacter(vFixedFormationSelectedCharacter,slot);
            vFixedFormationSelectedCharacter=null;
            if(typeof saveGame==="function"){ saveGame({source:"ally-formation"}); }
            if(typeof window.v54RenderHomeRoster==="function"){ window.v54RenderHomeRoster(); }
        }
        const body=document.getElementById("homeFeatureModalBody");
        if(body){ body.innerHTML=renderAllyFormationContent(); }
    };

    function applyPlayerElementFrames(){
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const card=document.getElementById("battlePlayerCard"+characterIndex);
            if(card){
                card.dataset.element=(character && character.element)||"unknown";
            }
        });
    }

    let elementBoxBattleStartExp=null;

    function v131AfterBattleRender(){
        applyBattleFormation();
        applyAllyBattleFormation();
        applyPlayerElementFrames();
        elementBoxBattleStartExp=Math.max(0,Number(sharedExp)||0);
    }
    window.v131AfterBattleRender=v131AfterBattleRender;

    window.v138GetFormationRows=getFormationRows;
    window.v138BattlePacing={
        actionDelayMs:V138_ACTION_DELAY_MS,
        roundDelayMs:V138_ROUND_TRANSITION_MS,
        roundHandoffDelayMs:V138_ROUND_HANDOFF_DELAY_MS,
        roundAnnouncementDelayMs:V138_ROUND_ANNOUNCEMENT_DELAY_MS
    };

    function strengthenMonster(monster,multiplier){
        if(!monster || monster._v131StrengthApplied){ return; }
        const strengthMultiplier=Number.isFinite(Number(multiplier))
            ? Number(multiplier)
            : V173_32_WILD_ZONE_STRENGTHS[V173_32_WILD_ZONE_STRENGTHS.length-1];
        monster._v131StrengthApplied=true;
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*strengthMultiplier));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
    }

    function strengthenAllZoneMonsters(){
        const zones=[
            [typeof forestMonsters!=="undefined" ? forestMonsters : null,V173_32_WILD_ZONE_STRENGTHS[0]],
            [typeof desertMonsters!=="undefined" ? desertMonsters : null,V173_32_WILD_ZONE_STRENGTHS[1]],
            [typeof iceMountainMonsters!=="undefined" ? iceMountainMonsters : null,V173_32_WILD_ZONE_STRENGTHS[2]],
            [typeof zone4Monsters!=="undefined" ? zone4Monsters : null,V173_32_WILD_ZONE_STRENGTHS[3]],
            [typeof zone5Monsters!=="undefined" ? zone5Monsters : null,V173_32_WILD_ZONE_STRENGTHS[4]],
            [typeof zone6Monsters!=="undefined" ? zone6Monsters : null,V173_32_WILD_ZONE_STRENGTHS[5]],
            [typeof zone7Monsters!=="undefined" ? zone7Monsters : null,V173_32_WILD_ZONE_STRENGTHS[6]],
            [typeof zone8Monsters!=="undefined" ? zone8Monsters : null,V173_32_WILD_ZONE_STRENGTHS[7]],
            [typeof zone9Monsters!=="undefined" ? zone9Monsters : null,V173_32_WILD_ZONE_STRENGTHS[8]],
            [typeof zone10Monsters!=="undefined" ? zone10Monsters : null,V173_32_WILD_ZONE_STRENGTHS[9]]
        ].filter(entry=>Array.isArray(entry[0]));
        const seen=new Set();
        zones.forEach(([zone,multiplier])=>zone.forEach(monster=>{
            if(!seen.has(monster)){
                seen.add(monster);
                strengthenMonster(monster,multiplier);
            }
        }));
    }
    window.v173WildZoneStrengthMultipliers=V173_32_WILD_ZONE_STRENGTHS;
    strengthenAllZoneMonsters();

    function syncInventoryPortrait(){
        const frame=document.getElementById("inventoryPortraitFrame");
        if(!frame || typeof getPartyCharacterByIndex!=="function"){ return; }
        const character=getPartyCharacterByIndex(inventoryCharacterIndex);
        if(!character){ return; }
        const placeholder=frame.querySelector(".inventory-portrait-placeholder");
        if(placeholder){ placeholder.style.display="none"; }
        let img=frame.querySelector(".v131-inventory-portrait");
        if(!img){
            img=document.createElement("img");
            img.className="v131-inventory-portrait";
            img.alt="角色立繪";
            img.draggable=false;
            frame.insertBefore(img,frame.firstChild);
        }
        img.src=getCharacterArtworkPath(character);
        img.alt=(character.id||"角色")+"立繪";
    }

    window.v131SyncInventoryPortrait=syncInventoryPortrait;

    function syncCharacterCreationAvailability(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const title=document.getElementById("homeFeatureModalTitle");
        if(title && String(title.textContent||"").trim()!=="角色"){ return; }
        const legacyRow=body.firstElementChild;
        const cardsBySlot=new Map();
        Array.from(body.querySelectorAll('[onclick*="openCharacterCreation"]')).forEach(card=>{
            const match=String(card.getAttribute("onclick")||"").match(/openCharacterCreation\(\s*(2|3)\s*\)/);
            if(match){ cardsBySlot.set(Number(match[1]),card); }
        });

        [1,2].forEach(slotIndex=>{
            const slotNumber=slotIndex+1;
            const card=cardsBySlot.get(slotNumber) || (legacyRow&&legacyRow.children?legacyRow.children[slotIndex]:null);
            if(!card){ return; }
            const character=slotIndex===1 ? player2 : player3;
            if(character){
                card.classList.remove("v131-unlock-ready");
                const oldDot=card.querySelector(".v131-unlock-dot");
                if(oldDot){ oldDot.remove(); }
                return;
            }
            const eligible=slotIndex===1
                ? player.level>=10
                : isThirdCharacterUnlocked();
            if(!eligible){ return; }
            card.style.opacity="1";
            card.style.position="relative";
            card.style.cursor="pointer";
            card.classList.add("v131-unlock-ready");
            card.onclick=function(){
                closeHomeFeature();
                openCharacterCreation(slotNumber);
            };
            const labels=card.querySelectorAll("div");
            if(labels.length>=3){
                labels[1].textContent="可創建";
                labels[2].textContent="點擊創建";
            }
            if(!card.querySelector(".v131-unlock-dot")){
                const dot=document.createElement("span");
                dot.className="v131-unlock-dot";
                dot.setAttribute("aria-label","有新角色可創建");
                card.appendChild(dot);
            }
        });
    }

    if(typeof refreshCharacterAvatarLevels==="function"){
        const originalRefreshAvatarLevels=refreshCharacterAvatarLevels;
        refreshCharacterAvatarLevels=function(){
            originalRefreshAvatarLevels.apply(this,arguments);
            syncCharacterCreationAvailability();
        };
    }

    function promoteSkillPreview(){
        const modal=document.getElementById("allElementSkillPreviewModal");
        const overlay=document.getElementById("game-overlay-layer") || document.getElementById("game-stage");
        if(modal && overlay && modal.parentNode!==overlay){
            overlay.appendChild(modal);
        }
    }
    promoteSkillPreview();

    const expPreviewCounts={0:0,1:0,2:0};
    const originalDistributeExpToCharacter=
        typeof distributeExpToCharacter==="function" ? distributeExpToCharacter : null;

    function previewCostForCharacter(character,count){
        if(!character || count<=0){ return 0; }
        const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
        const startLevel=Math.max(1,Math.floor(Number(character.level)||1));
        if(startLevel+count>maxLevel){ return Infinity; }

        let exp=Math.max(0,Number(character.exp)||0);
        let expNext=Math.max(1,Number(character.expNext)||100);
        let previewLevel=startLevel;
        let total=0;
        for(let i=0;i<count;i++){
            const need=Math.max(1,expNext-exp);
            total+=need;
            exp=0;
            previewLevel++;
            expNext=typeof window.v133GetExpNextForLevel==="function"
                ? window.v133GetExpNextForLevel(previewLevel)
                : Math.max(expNext+1,Math.floor(expNext*1.2));
        }
        return total;
    }
    window.v131PreviewCostForCharacter=previewCostForCharacter;

    function totalPreviewCost(){
        return [0,1,2].reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            return sum+previewCostForCharacter(character,expPreviewCounts[index]||0);
        },0);
    }

    function hasExpPreview(){
        return [0,1,2].some(index=>(expPreviewCounts[index]||0)>0);
    }

    function previewExpLevel(index){
        const character=getPartyCharacterByIndex(index);
        if(!character){ return; }
        const current=expPreviewCounts[index]||0;
        const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
        if(character.level+current>=maxLevel){
            alert("這名角色已達 Lv."+maxLevel+" 滿等。");
            return;
        }
        const beforeCost=previewCostForCharacter(character,current);
        const afterCost=previewCostForCharacter(character,current+1);
        const extra=afterCost-beforeCost;
        if(totalPreviewCost()+extra>sharedExp){
            alert("經驗池不足，無法再預覽這一級。還需要 "+Math.max(0,totalPreviewCost()+extra-sharedExp)+" EXP。");
            return;
        }
        expPreviewCounts[index]=current+1;
        renderExpDistributeList();
        syncCharacterPreviewLevels();
    }

    function syncCharacterPreviewLevels(){
        [0,1,2].forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            const el=document.getElementById("characterAvatarLevel"+index);
            if(character && el){
                el.textContent="Lv."+(character.level+(expPreviewCounts[index]||0));
                el.classList.toggle("v131-preview-level",(expPreviewCounts[index]||0)>0);
            }
        });
    }

    function cancelExpPreview(){
        [0,1,2].forEach(index=>{ expPreviewCounts[index]=0; });
        renderExpDistributeList();
        if(typeof refreshCharacterAvatarLevels==="function"){
            refreshCharacterAvatarLevels();
        }
    }

    function confirmExpPreview(){
        if(!hasExpPreview() || !originalDistributeExpToCharacter){ return; }
        const plan=[0,1,2].map(index=>({
            index,
            character:getPartyCharacterByIndex(index),
            count:Math.min(
                expPreviewCounts[index]||0,
                Math.max(
                    0,
                    (Number(window.v133MaxLevel)||Infinity)-
                    ((getPartyCharacterByIndex(index)||{}).level||1)
                )
            )
        })).filter(entry=>entry.character && entry.count>0);
        [0,1,2].forEach(index=>{ expPreviewCounts[index]=0; });
        plan.forEach(entry=>{
            for(let n=0;n<entry.count;n++){
                originalDistributeExpToCharacter(entry.character);
            }
        });
        renderExpDistributeList();
        syncCharacterCreationAvailability();
    }

    window.v131PreviewExpLevel=previewExpLevel;
    window.v131ConfirmExpPreview=confirmExpPreview;
    window.v131CancelExpPreview=cancelExpPreview;

    if(typeof renderExpDistributeList==="function"){
        renderExpDistributeList=function(){
            const container=document.getElementById("expDistributeList");
            if(!container){ return; }
            const rows=getExistingPartyIndexes().map(index=>{
                const character=getPartyCharacterByIndex(index);
                const count=expPreviewCounts[index]||0;
                const previewLevel=character.level+count;
                const cost=previewCostForCharacter(character,count);
                const nextExtra=previewCostForCharacter(character,count+1)-cost;
                const maxLevel=Math.max(1,Number(window.v133MaxLevel)||Infinity);
                const isMaxLevel=previewLevel>=maxLevel;
                const canPreview=!isMaxLevel && totalPreviewCost()+nextExtra<=sharedExp;
                return (
                    '<div class="v131-exp-row">'+
                        '<div class="v131-exp-name">'+(character.id||("角色"+(index+1)))+'</div>'+
                        '<div class="v131-exp-level'+(count>0?' preview':'')+'">Lv.'+character.level+
                            (count>0 ? ' → Lv.'+previewLevel : '')+
                        '</div>'+
                        '<button type="button" class="v131-exp-preview-btn" '+
                            (canPreview?'':'disabled ')+
                            'onclick="v131PreviewExpLevel('+index+')">'+
                            (isMaxLevel ? '已達滿等' : '點擊預覽升級')+'</button>'+
                    '</div>'
                );
            }).join("");
            const planned=hasExpPreview();
            const reserved=totalPreviewCost();
            container.innerHTML=
                rows+
                '<div class="v131-exp-preview-summary">預覽消耗：'+reserved.toLocaleString("zh-TW")+' EXP</div>'+
                '<div class="v131-exp-actions">'+
                    '<button type="button" class="v131-exp-confirm" '+(planned?'':'disabled ')+
                        'onclick="v131ConfirmExpPreview()">確定</button>'+
                    '<button type="button" class="v131-exp-back" '+(planned?'':'disabled ')+
                        'onclick="v131CancelExpPreview()">返回</button>'+
                '</div>';
            syncCharacterPreviewLevels();
        };
    }

    function loadElementBoxState(){
        try{
            const parsed=JSON.parse(localStorage.getItem(ELEMENT_BOX_KEY)||"{}");
            return {
                remainingMs:Math.min(
                    32*60*60*1000,
                    Math.max(0,Number(parsed.remainingMs)||0)
                )
            };
        }catch(_){
            return {remainingMs:0};
        }
    }

    const elementBoxState=loadElementBoxState();

    function hasAnyAutoBattleEnabled(){
        return !!(
            autoBattle ||
            autoConfig.enabled ||
            (player2 && autoConfig2.enabled) ||
            (player3 && autoConfig3.enabled)
        );
    }

    /*
       V137：V136會保存自動戰鬥開關，但元素匣舊版每次重新載入都把
       active寫死成false。結果同一份已啟用的自動設定在reload後仍會
       自動出手，卻不扣元素匣時數、EXP也恢復100%。只要還有時數且
       任一角色的自動設定為開，就恢復同一個元素匣啟用狀態。
    */
    let elementBoxActive=
        elementBoxState.remainingMs>0 &&
        hasAnyAutoBattleEnabled();
    let elementBoxLastTick=Date.now();
    let elementBoxLastPersist=0;
    const elementBoxSession={activeMs:0,battles:0,exp:0,gold:0};

    function persistElementBoxState(){
        try{
            localStorage.setItem(ELEMENT_BOX_KEY,JSON.stringify({
                remainingMs:Math.max(0,Math.floor(elementBoxState.remainingMs))
            }));
        }catch(_){ }
    }

    function stopElementBoxWhenTimeEnds(message){
        elementBoxActive=false;
        autoConfig.enabled=false;
        if(player2){ autoConfig2.enabled=false; }
        if(player3){ autoConfig3.enabled=false; }
        autoBattle=false;
        if(typeof updateAutoButton==="function"){ updateAutoButton(); }
        if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
        addBattleLog(message||"元素匣時數已用完，自動戰鬥已停止。");
        if(typeof saveGame==="function"){ saveGame(); }
    }

    function syncElementBoxForBattle(options){
        const silent=!!(options && options.silent);
        if(hasAnyAutoBattleEnabled() && elementBoxState.remainingMs<=0){
            stopElementBoxWhenTimeEnds(
                silent
                    ? "元素匣沒有可用時數，自動戰鬥已停止。"
                    : "元素匣沒有可用時數，自動戰鬥已停止；請先取得時數。"
            );
            return false;
        }

        elementBoxActive=
            elementBoxState.remainingMs>0 &&
            hasAnyAutoBattleEnabled();
        elementBoxLastTick=Date.now();
        persistElementBoxState();
        return elementBoxActive;
    }
    window.v131SyncElementBoxForBattle=syncElementBoxForBattle;
    window.v131GetElementBoxState=function(){
        return {
            active:elementBoxActive,
            remainingMs:Math.max(0,Math.floor(elementBoxState.remainingMs))
        };
    };
    window.v131GrantElementBoxHours=function(hours,maxHours){
        const safeHours=Math.max(0,Number(hours)||0);
        const capMs=Math.max(0,Number(maxHours)||32)*60*60*1000;
        elementBoxState.remainingMs=Math.min(
            capMs,
            Math.max(0,elementBoxState.remainingMs)+safeHours*60*60*1000
        );
        persistElementBoxState();
        updateElementBoxStatsUI();
        return Math.max(0,Math.floor(elementBoxState.remainingMs));
    };

    function tickElementBoxClock(){
        const now=Date.now();
        const delta=Math.max(0,now-elementBoxLastTick);
        elementBoxLastTick=now;
        if(elementBoxActive && elementBoxState.remainingMs>0){
            const used=Math.min(delta,elementBoxState.remainingMs);
            elementBoxState.remainingMs-=used;
            elementBoxSession.activeMs+=used;
            if(elementBoxState.remainingMs<=0){
                elementBoxState.remainingMs=0;
                stopElementBoxWhenTimeEnds();
            }
        }
        if(now-elementBoxLastPersist>=5000){
            elementBoxLastPersist=now;
            persistElementBoxState();
        }
        updateElementBoxStatsUI();
    }

    function ensureElementBoxStatsUI(){
        const panel=document.getElementById("autoBattleSettingsPanel");
        if(!panel){ return; }
        panel.classList.add("v131-element-box-panel");
        const saveBtn=panel.querySelector(".auto-save-btn");
        if(saveBtn){ saveBtn.textContent="套用並啟動"; }
        const cancelBtn=panel.querySelector(".auto-cancel-btn");
        if(cancelBtn){ cancelBtn.style.display="none"; }
        let stats=document.getElementById("v131ElementBoxStats");
        if(!stats){
            stats=document.createElement("section");
            stats.id="v131ElementBoxStats";
            stats.className="v131-element-box-stats";
            stats.innerHTML=
                '<div class="v131-element-box-title">本次上線元素匣紀錄</div>'+
                '<div><span>啟動總時數</span><strong id="v131EbActiveTime">0小時 0分鐘</strong></div>'+
                '<div><span>戰鬥次數</span><strong id="v131EbBattles">0</strong></div>'+
                '<div><span>獲得經驗</span><strong id="v131EbExp">0</strong></div>'+
                '<div><span>獲得金幣</span><strong id="v131EbGold">0</strong></div>'+
                '<div class="remaining"><span>元素匣剩餘使用時間</span><strong id="v131EbRemaining">0小時 0分鐘</strong></div>';
            const actions=panel.querySelector(".auto-settings-actions") || (saveBtn && saveBtn.parentElement);
            if(actions){ panel.insertBefore(stats,actions); }
            else{ panel.appendChild(stats); }
        }
        updateElementBoxStatsUI();
    }

    function updateElementBoxStatsUI(){
        const pairs={
            v131EbActiveTime:formatDuration(elementBoxSession.activeMs),
            v131EbBattles:String(elementBoxSession.battles),
            v131EbExp:Math.floor(elementBoxSession.exp).toLocaleString("zh-TW"),
            v131EbGold:Math.floor(elementBoxSession.gold).toLocaleString("zh-TW"),
            v131EbRemaining:formatDuration(elementBoxState.remainingMs)
        };
        Object.keys(pairs).forEach(id=>{
            const el=document.getElementById(id);
            if(el){ el.textContent=pairs[id]; }
        });
    }

    /*
       元素匣的「本次上線獲得金幣」只記錄一般巡怪中實際入帳的怪物掉落。
       副本會設置 v132ActiveDungeonRun；V141 的野外精英掉落隔離旗標不是副本，
       仍維持和既有巡怪戰鬥統計相同的涵蓋範圍。
    */
    function isElementBoxNormalPatrolGoldTrackingActive(){
        const dungeonRun=window.v132ActiveDungeonRun;
        return !!(
            elementBoxActive &&
            (!dungeonRun || dungeonRun.v141EliteDropIsolation===true)
        );
    }

    function recordElementBoxMonsterGold(amount){
        const safeAmount=Math.max(0,Math.floor(Number(amount)||0));
        if(safeAmount<=0 || !isElementBoxNormalPatrolGoldTrackingActive()){
            return;
        }
        elementBoxSession.gold+=safeAmount;
        updateElementBoxStatsUI();
    }

    if(typeof awardMonsterGoldDrop==="function"){
        const originalAwardMonsterGoldDrop=awardMonsterGoldDrop;
        awardMonsterGoldDrop=function(){
            const baseAmount=Math.max(0,Number(originalAwardMonsterGoldDrop.apply(this,arguments))||0);
            const bonusAmount=Math.max(0,Math.floor(baseAmount*(V17342_GLOBAL_GOLD_REWARD_MULTIPLIER-1)));
            if(bonusAmount>0){
                gold+=bonusAmount;
                if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
            }
            const amount=baseAmount+bonusAmount;
            recordElementBoxMonsterGold(amount);
            return amount;
        };
    }

    const originalConfirmAutoBattleSettings=
        typeof confirmAutoBattleSettings==="function" ? confirmAutoBattleSettings : null;

    if(originalConfirmAutoBattleSettings){
        confirmAutoBattleSettings=async function(){
            /*
               ★ 修正（依照使用者回報，「戰鬥中開啟元素匣，
               套用啟動才是沒反應」）：
               這顆按鈕的文字被ensureElementBoxStatsUI()改成
               「套用並啟動」，但這裡原本只呼叫
               originalConfirmAutoBattleSettings()儲存表單設定，
               從頭到尾沒有真的把autoBattle打開——玩家看到的
               就是「按了套用並啟動，畫面卻什麼都沒變、戰鬥
               還是要自己手動操作」，跟按鈕文字承諾的行為對
               不起來。這裡補上：套用設定之後，如果目前還沒
               開自動戰鬥，直接呼叫既有的toggleAutoBattle()
               （跟按面板最上面「啟動」按鈕完全同一套邏輯，
               autoConfig/autoConfig2/autoConfig3、UI、戰鬤
               紀錄都會一起正確同步），讓「套用並啟動」名符
               其實。如果玩家點的當下自動戰鬥其實已經是開著的
               （只是想改設定），就不要再呼叫一次toggle，
               避免反而把它關掉。
            */
            const activate=()=>{
                originalConfirmAutoBattleSettings.apply(this,arguments);
                if(!autoBattle && typeof toggleAutoBattle==="function"){
                    toggleAutoBattle();
                }
                elementBoxActive=true;
                elementBoxLastTick=Date.now();
                persistElementBoxState();
                addBattleLog("元素匣已啟動，剩餘 "+formatDuration(elementBoxState.remainingMs)+"。");
            };
            if(elementBoxState.remainingMs<=0){
                const watch=
                    typeof window.rpgConfirm==="function" &&
                    await window.rpgConfirm(
                        "元素匣目前沒有可用時數。\n觀看廣告可獲得 8 小時元素匣啟動時數。\n\n要觀看廣告嗎？",
                        {
                            title:"補充元素匣時數",
                            confirmText:"觀看廣告",
                            cancelText:"稍後再說"
                        }
                    );
                if(!watch){ return; }
                showRewardedAd(
                    ()=>{
                        window.v131GrantElementBoxHours(8,32);
                        ensureElementBoxStatsUI();
                        activate();
                    },
                    ()=>{
                        alert("廣告未完成，未獲得元素匣時數。");
                    }
                );
                return;
            }
            activate();
        };
    }

    /*
       所有能開啟自動戰鬥的入口都必須經過元素匣檢查。舊版只攔
       「套用並啟動」，戰鬥HUD上的直接切換鍵可以完全繞過廣告與
       時數。沒有時數時保留手動狀態並打開設定面板；有時數時才讓
       原本切換邏輯執行。
    */
    if(typeof toggleAutoBattle==="function"){
        const originalToggleAutoBattle=toggleAutoBattle;
        toggleAutoBattle=function(){
            const isTurningOn=!autoBattle;
            if(isTurningOn && elementBoxState.remainingMs<=0){
                alert("元素匣目前沒有可用時數，請先觀看廣告取得8小時時數。");
                if(typeof openHomeFeature==="function"){
                    openHomeFeature("autoBattleSettings");
                }
                return false;
            }

            const result=originalToggleAutoBattle.apply(this,arguments);
            syncElementBoxForBattle({silent:true});
            return result;
        };
    }

    /* startBattle()會從存檔的autoConfig重新打開自動狀態；每一場開始
       後再同步一次，避免reload或舊存檔直接繞過元素匣。 */
    if(typeof startBattle==="function"){
        const originalStartBattle=startBattle;
        startBattle=function(){
            const slotOwner=fixedBattlefieldSlots();
            if(slotOwner){ slotOwner.clearActiveEnemySnapshot(); }
            if(hasAnyAutoBattleEnabled() && elementBoxState.remainingMs<=0){
                stopElementBoxWhenTimeEnds("元素匣沒有可用時數，自動戰鬥已停止。");
            }
            const result=originalStartBattle.apply(this,arguments);
            if(battleActive){
                ensureEnemyFormationSnapshot(currentBattleMonsters);
                syncElementBoxForBattle({silent:true});
            }
            return result;
        };
    }

    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=originalOpenHomeFeature.apply(this,arguments);
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.toggle("v131-shop-open",type==="shop"); }
            if(type==="character"){ syncCharacterCreationAvailability(); }
            if(type==="autoBattleSettings"){ ensureElementBoxStatsUI(); }
            return result;
        };
    }

    if(typeof closeHomeFeature==="function"){
        const originalCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.remove("v131-shop-open"); }
            return originalCloseHomeFeature.apply(this,arguments);
        };
    }

    let v131PendingExpToast=0;
    if(typeof showExpToast==="function"){
        const originalShowExpToast=showExpToast;
        showExpToast=function(amount){
            const displayAmount=v131PendingExpToast>0 ? v131PendingExpToast : amount;
            v131PendingExpToast=0;
            return originalShowExpToast.call(this,displayAmount);
        };
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            if(!battleActive){ return originalWinBattle.apply(this,arguments); }

            /*
               flatExpGain：跟原本winBattle()內部自己會算、
               直接加進sharedExp的數字完全一樣算法（等級×10，
               不含rank倍率、不含正式怪物 EXP 差額）——用來推算「原本
               函式這次會自己加多少」，才能正確算出還要「補多少
               差額」，不會跟原本的計算重複疊加。
            */
            const flatExpGain=currentBattleMonsters.reduce(
                (total,index)=>total+(monsters[index] ? (Number(monsters[index].level)||0)*10 : 0),
                0
            );

            /* 正式巡怪 EXP 只走 calculateStandardPatrolExp()：
               正式怪物 EXP × rank；V173.42 ×3 僅保留 Lv1～19 快速期。
               Lv20 起不再有第二個全域 ×3。 */
            const progressionLevel=getPatrolProgressionReferenceLevel();
            let finalExp=calculateStandardPatrolExp(
                currentBattleMonsters.map(index=>monsters[index]).filter(Boolean),
                progressionLevel
            );

            const isBeginnerForestBattle=
                currentZone==="forest" &&
                typeof player!=="undefined" &&
                player &&
                Math.max(1,Number(player.level)||1)<10;

            if(isBeginnerForestBattle){
                const beginnerMonsterUnits=currentBattleMonsters.reduce((total,index)=>{
                    const monster=monsters[index];
                    return monster ? total+getMonsterExpRankMultiplier(monster) : total;
                },0);
                finalExp=Math.max(1,Math.round(
                    getBeginnerForestMonsterExpUnit()*
                    Math.max(1,beginnerMonsterUnits)*
                    V17342_GLOBAL_EXP_REWARD_MULTIPLIER
                ));
            }

            /* 元素匣（自動掛機）只給70%EXP，金幣/掉落/材料不受影響
               （那些各自獨立的函式完全沒有被這裡動到）。 */
            const isElementBoxBattle=elementBoxActive;
            let restedExpResult=null;
            if(isElementBoxBattle){
                /* ★ 用Math.round不用Math.floor：700*0.7在浮點數運算下
                   會是489.999999...，Math.floor會誤差扣掉1點EXP，
                   Math.round才會正確算出490。 */
                finalExp=applyPatrolExpMode(finalExp,{elementBox:true});
            }else if(typeof window.v139TryConsumeRestedBattle==="function"){
                /* V139休息經驗只允許一般練功戰鬥使用。副本勝利由
                   js/27先攔截，不會走進這個一般winBattle wrapper；
                   元素匣則在上面的分支明確排除，不會消耗場數。 */
                restedExpResult=window.v139TryConsumeRestedBattle();
                if(restedExpResult && restedExpResult.applied){
                    finalExp=applyPatrolExpMode(finalExp,{rested:true});
                }
            }

            const bonusExp=finalExp-flatExpGain;
            const result=originalWinBattle.apply(this,arguments);
            if(bonusExp!==0){
                sharedExp=Math.max(0,sharedExp+bonusExp);
                addBattleLog(
                    (isElementBoxBattle
                        ? "戰鬥經驗（元素匣收益70%）："
                        : restedExpResult && restedExpResult.applied
                        ? "戰鬥經驗（含休息經驗加成）："
                        : "戰鬥經驗：")+
                    "本場共 "+finalExp+" EXP。"
                );
                if(restedExpResult && restedExpResult.applied){
                    addBattleLog(
                        "休息經驗已生效，剩餘 "+
                        restedExpResult.remainingBattles+
                        " 場。"
                    );
                }
                saveGame();
            }
            v131PendingExpToast=finalExp;
            if(elementBoxActive){
                elementBoxSession.battles++;
                elementBoxSession.exp+=finalExp;
                updateElementBoxStatsUI();
            }
            elementBoxBattleStartExp=null;
            return result;
        };
    }

    function initialSync(){
        syncElementBoxForBattle({silent:true});
        applyBattleFormation();
        syncInventoryPortrait();
        promoteSkillPreview();
        syncCharacterCreationAvailability();
        renderExpDistributeList();
        ensureElementBoxStatsUI();
    }

    setInterval(tickElementBoxClock,1000);
    window.addEventListener("beforeunload",persistElementBoxState);
    document.addEventListener("visibilitychange",()=>{ tickElementBoxClock(); });
    setTimeout(initialSync,0);
})();


/* bundled source: js/27-v132-content-expansion.js */
/*
   V132 — 新增道具（符咒）、材料（礦石／裝備設計圖）、
   裝備套裝（赤炎／寒泉／岩岳／青嵐）、抽獎券、
   三個日常副本（經驗／材料／裝備）。

   ★ 整體設計原則：
   1. 儘量重用既有函式（makeZoneMonster()產生怪物、
      processNextCombatant()等回合引擎、renderBattle()/
      showPage()等既有UI渲染、showRewardedAd()廣告雙倍
      領取），不重新發明一套戰鬥/渲染邏輯，降低風險。
   2. 副本怪物借用「monsters這個全域陣列本來就是可以整包
      替換」的既有慣例（切換練功區域時就是直接整包换成
      對應區域的陣列，見js/00-main.js「目前所在區域的怪物
      資料」那段註解）——進副本前先記住原本的monsters/
      currentZone，副本結束後完整還原，不會弄壞巡怪系統。
   3. 素材/裝備視覺先用純CSS+inline SVG做出有辨識度的
      色塊圖示（依照使用者指示「先暫時用CSS/JavaScript
      動畫+Canvas/SVG/WebGL/Shader做出來，後期再用美術
      更改」），不做過度複雜的即時運算圖形，先求正確、
      好維護。
*/
(function installV132ContentExpansion(){
    "use strict";

    /* =====================================================
       0. 共用小工具
    ===================================================== */

    function todayString(){
        const now=new Date();
        const year=now.getFullYear();
        const month=String(now.getMonth()+1).padStart(2,"0");
        const day=String(now.getDate()).padStart(2,"0");
        return year+"-"+month+"-"+day;
    }

    function escapeHtml(text){
        return String(text==null ? "" : text)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    /*
       ★ 修正（根源問題）：物品清單格（inventory-icon）跟
       裝備欄（inventory-equipment-icon）都是用innerHTML
       塞item.icon，SVG字串能正常渲染；但物品詳細彈窗
       （openItemModal()/openEquippedItem()）是用
       textContent塞item.icon，SVG字串會被當成純文字
       原樣印出來，變成一整串看不懂的<svg>標籤文字。
       這裡在DOM渲染完之後，把圖示元素從textContent
       改回innerHTML，兩個函式都補這個收尾，不用整個
       複寫這兩個函式本體。
    */
    function fixItemModalIconRendering(){
        const iconEl=document.getElementById("itemModalIcon");
        if(!iconEl){ return; }
        const raw=iconEl.textContent;
        if(raw && raw.indexOf("<")!==-1){
            iconEl.innerHTML=raw;
        }
    }

    /*
       ★ 新增（依照使用者要求，「套裝效果顯示再點擊裝備的時候
       就應該顯示」）：不管是點背包裡還沒穿的套裝物品，還是點
       已經穿在身上的套裝物品，都在物品詳細彈窗補上「目前這件
       所屬套裝，這個角色身上已經穿了幾件／5件」跟兩條套裝加成
       說明，未達成的門檻用「未啟動」+較暗的樣式呈現，已達成的
       用「已啟動」+較亮的樣式呈現，一眼就能看出離下一階效果
       還差幾件。這裡刻意只「附加」在既有stats區塊後面，不去
       動getStatText()本身的輸出，一般裝備/非套裝物品完全不受
       影響（item.setId不存在時直接跳過）。
    */
    function appendEquipmentSetInfo(item){
        if(!item || !item.setId){ return; }
        const equipmentKey=getBackpackEquipmentKey(inventoryCharacterIndex);
        if(!equipmentKey){ return; }
        const counts=getEquipmentSetCounts(equipmentKey);
        const count=counts[item.setId]||0;
        const label=getSetLabel(item.setId);
        const elementKey=getSetElement(item.setId);
        const elementName=(elementKey && elementDatabase[elementKey]) ? elementDatabase[elementKey].name : "";
        const threeActive=count>=3;
        const fiveActive=count>=5;
        const html=
            '<div class="v132-set-info">'+
            '<div class="v132-set-title">['+escapeHtml(label)+']'+count+'/5</div>'+
            '<div class="v132-set-bonus'+(threeActive ? " active" : " inactive")+'">'+
            '裝備三件　全能力+1　'+(threeActive ? "[已啟動]" : "[未啟動]")+
            '</div>'+
            '<div class="v132-set-bonus'+(fiveActive ? " active" : " inactive")+'">'+
            '裝備五件　'+escapeHtml(elementName)+'元素技能傷害+2%　'+(fiveActive ? "[已啟動]" : "[未啟動]")+
            '</div>'+
            '</div>';
        const statsEl=document.getElementById("itemModalStats");
        if(statsEl){ statsEl.insertAdjacentHTML("beforeend",html); }
    }

    if(typeof openItemModal==="function"){
        const originalOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=originalOpenItemModal.apply(this,arguments);
            fixItemModalIconRendering();
            appendEquipmentSetInfo(inventorySlots[slotIndex]);
            return result;
        };
    }

    if(typeof o