
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
        return document.getElementById("app")||document.getElementById("game-content")||document.body;
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
        const existing=owner.getActiveEnemySnapshot();
        if(existing){ return existing; }
        const requested=(Array.isArray(indexes)?indexes:currentBattleMonsters||[])
            .filter(index=>Number.isInteger(index)).slice(0,10);
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

    if(typeof renderInventory==="function"){
        const originalRenderInventory=renderInventory;
        renderInventory=function(){
            const result=originalRenderInventory.apply(this,arguments);
            syncInventoryPortrait();
            return result;
        };
    }

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

    if(typeof learnSkill==="function"){
        const originalLearnSkill=learnSkill;
        learnSkill=async function(skillId){
            const skill=skillDatabase[skillId];
            const loadout=characterSkillLoadouts[currentSkillCharacter];
            if(!skill || !loadout){
                return originalLearnSkill.apply(this,arguments);
            }
            const before=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            const actionText=before>0 ? "升級" : "學習";
            if(
                typeof window.rpgConfirm!=="function" ||
                !await window.rpgConfirm(
                    "確定要"+actionText+"「"+skill.name+"」嗎？",
                    {
                        title:actionText+"技能",
                        confirmText:"確定"+actionText,
                        cancelText:"返回"
                    }
                )
            ){
                return;
            }
            const result=originalLearnSkill.apply(this,arguments);
            const after=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(after>before){
                window.alert(
                    before>0
                    ? "「"+skill.name+"」升級成功！目前 Lv."+after+"。"
                    : "「"+skill.name+"」學習成功！"
                );
            }
            return result;
        };
    }

    /*
       ★ 修正（依照使用者要求，「技能升級時沒有跳出防呆訊息，
       只有學習時有跳出來」）：
       已學過但還沒滿級的技能，畫面上按的其實是upgradeSkill()，
       不是learnSkill()——上面那段只包了learnSkill，
       upgradeSkill完全沒被攔到，所以升級的時候
       不會有確認/成功提示。這裡用同一套邏輯
       （確認→執行→比對等級有沒有真的變化→跳成功提示）
       再包一次upgradeSkill。
    */
    if(typeof upgradeSkill==="function"){
        const originalUpgradeSkill=upgradeSkill;
        upgradeSkill=async function(skillId){
            const skill=skillDatabase[skillId];
            const loadout=characterSkillLoadouts[currentSkillCharacter];
            if(!skill || !loadout){
                return originalUpgradeSkill.apply(this,arguments);
            }
            const before=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(
                typeof window.rpgConfirm!=="function" ||
                !await window.rpgConfirm(
                    "確定要升級「"+skill.name+"」嗎？",
                    {
                        title:"升級技能",
                        confirmText:"確定升級",
                        cancelText:"返回"
                    }
                )
            ){
                return;
            }
            const result=originalUpgradeSkill.apply(this,arguments);
            const after=Math.max(0,Number(loadout.skillLevels[skillId])||0);
            if(after>before){
                window.alert("「"+skill.name+"」升級成功！目前 Lv."+after+"。");
            }
            return result;
        };
    }

    /*
       ★ 修正：
       原本用 onclick="learnSkill(...)" 這種字串正則去猜
       這一列是哪個技能，但實際的技能列（.skill-row）
       用的是 upgradeSkill(...)（已學但未滿級時）而不只
       learnSkill(...)，正則沒涵蓋到，導致大部分列都抓不到
       skillId。改成直接讀icon那個<div id="skillIcon_xxx">
       的id，這個id本來就是渲染時直接塞技能id進去的，
       比猜onclick字串可靠。
    */
    function extractSkillIdFromRow(row){
        const iconEl=row.querySelector('[id^="skillIcon_"]');
        if(iconEl){
            return iconEl.id.slice("skillIcon_".length);
        }
        const controls=row.querySelectorAll("[onclick]");
        for(const control of controls){
            const code=control.getAttribute("onclick")||"";
            const match=code.match(/(?:learnSkill|upgradeSkill|equipSkill|unequipSkill)\(['\"]([^'\"]+)['\"]\)/);
            if(match){ return match[1]; }
        }
        return null;
    }

    /*
       ★ 修正：
       真正的技能列容器是 #allSkillsList 底下的
       .skill-row（不是原本猜的.learned-skill／
       .learnable-skill，那組class在目前版本的技能頁
       裡根本不存在，導致這個函式之前完全沒有作用）。
       技能名稱也是 .skill-row-text 裡的 <b>，不是
       <strong>。
    */
    function decorateSkillRows(){
        const list=document.getElementById("allSkillsList");
        if(!list){ return; }
        list.querySelectorAll(".skill-row").forEach(row=>{
            const skillId=extractSkillIdFromRow(row);
            const skill=skillId && skillDatabase[skillId];
            if(!skill){ return; }

            if(
                ["physical","magic"].includes(skill.category) &&
                !row.querySelector(".v131-skill-kind")
            ){
                const badge=document.createElement("span");
                badge.className="v131-skill-kind "+skill.category;
                badge.textContent=skill.category==="physical" ? "物理" : "法術";
                const nameHost=row.querySelector(".skill-row-text b,strong,.skill-name,.skill-row-name") || row;
                if(nameHost===row){ row.insertBefore(badge,row.firstChild); }
                else{ nameHost.insertAdjacentElement("afterend",badge); }
            }

            const loadout=characterSkillLoadouts[currentSkillCharacter];
            const learnedLevel=
                loadout && loadout.skillLevels
                ? Math.max(0,Number(loadout.skillLevels[skillId])||0)
                : 0;
            const textHost=row.querySelector(".skill-row-text");
            if(
                learnedLevel===0 &&
                textHost &&
                !textHost.querySelector(".v138-skill-learn-cost")
            ){
                const cost=document.createElement("span");
                cost.className="v138-skill-learn-cost";
                cost.textContent="學習需要 "+Math.max(0,Number(skill.learnCost)||0)+" 技能點";
                const detailLink=textHost.querySelector(".skill-row-detail-link");
                textHost.insertBefore(cost,detailLink||null);
            }
        });
    }

    if(typeof renderSkillLoadout==="function"){
        const originalRenderSkillLoadout=renderSkillLoadout;
        renderSkillLoadout=function(){
            const result=originalRenderSkillLoadout.apply(this,arguments);
            decorateSkillRows();
            return result;
        };
    }

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
        decorateSkillRows();
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

    if(typeof openEquippedItem==="function"){
        const originalOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item,slot){
            const result=originalOpenEquippedItem.apply(this,arguments);
            fixItemModalIconRendering();
            appendEquipmentSetInfo(item);
            return result;
        };
    }


    /* =====================================================
       1. 圖示產生器（純CSS/SVG色塊，先求有辨識度）
    ===================================================== */

    const TIER_COLORS={
        white:{main:"#D8D8D8",glow:"#F2F2F2"},
        blue:{main:"#42A5FF",glow:"#7CC7FF"},
        purple:{main:"#B05CFF",glow:"#D49BFF"},
        orange:{main:"#FF9F38",glow:"#FFC46B"},
        pink:{main:"#FF4FA7",glow:"#FF8CC7"},
        "four-symbol":{main:"#E5C06B",glow:"#FFFFFF"}
    };

    function svgWrap(inner,glow){
        return (
            '<svg viewBox="0 0 64 64" width="100%" height="100%" '+
            'xmlns="http://www.w3.org/2000/svg" style="display:block;">'+
            '<defs><filter id="v132glow" x="-50%" y="-50%" width="200%" height="200%">'+
            '<feGaussianBlur stdDeviation="2.2" result="b"/>'+
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'+
            '</filter></defs>'+
            '<g filter="url(#v132glow)">'+inner+'</g>'+
            '</svg>'
        );
    }

    const TALISMAN_ART={
        freeze:"assets/items/talismans/freeze-icon.png",
        barrier:"assets/items/talismans/barrier-icon.png",
        stealth:"assets/items/talismans/stealth-icon.png"
    };
    const BLUEPRINT_ART={
        head:"assets/items/blueprints/head.png",
        shoulder:"assets/items/blueprints/shoulder.png",
        shoes:"assets/items/blueprints/shoes.png",
        hand:"assets/items/blueprints/hand.png",
        armor:"assets/items/blueprints/armor.png"
    };

    function rasterItemIcon(path,tier,kind){
        const rarity=tier?" v169-rarity-"+tier:"";
        return '<span class="v169-item-art v169-'+kind+'-art'+rarity+'">'+
            '<img src="'+path+'" alt="" aria-hidden="true" draggable="false" decoding="async" onerror="this.hidden=true"></span>';
    }

    function talismanIcon(effect,tier){
        return rasterItemIcon(TALISMAN_ART[effect]||TALISMAN_ART.freeze,tier,"talisman");
    }

    function oreIcon(tier){
        if(tier==="four-symbol"){
            return svgWrap(
                '<polygon points="32,6 52,22 44,56 20,56 12,22" fill="#181716" stroke="#f2dfb1" stroke-width="2.5"/>'+
                '<path d="M32 6L52 22L32 32Z" fill="#FF5A36" opacity=".9"/>'+
                '<path d="M52 22L44 56L32 32Z" fill="#42A5FF" opacity=".9"/>'+
                '<path d="M44 56H20L32 32Z" fill="#47D6A3" opacity=".9"/>'+
                '<path d="M20 56L12 22L32 32Z" fill="#C89B45" opacity=".9"/>',
                "#FFFFFF"
            );
        }
        const c=TIER_COLORS[tier]||TIER_COLORS.white;
        return svgWrap(
            '<polygon points="32,6 52,22 44,56 20,56 12,22" '+
            'fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2.5"/>'+
            '<polygon points="32,6 44,56 20,56" fill="'+c.glow+'" opacity="0.28"/>',
            c.glow
        );
    }

    function blueprintIcon(slot,tier){
        return rasterItemIcon(BLUEPRINT_ART[slot]||BLUEPRINT_ART.hand,tier,"blueprint");
    }

    function chestIcon(){
        return rasterItemIcon("assets/items/chests/dungeon-chest.png","blue","chest");
    }
    // All general-dungeon backpack chests share this visual; item name stays semantic.
    window.v17361GeneralDungeonChestIcon=chestIcon;

    function ticketIcon(elementKey){
        return rasterItemIcon("assets/items/tickets/"+elementKey+"-icon.png",null,"ticket");
    }

    const SET_PALETTE={
        setFire:{main:"#d94a2a",glow:"#ffb37a",label:"赤炎"},
        setWater:{main:"#2a7ed9",glow:"#9ed4ff",label:"寒泉"},
        setEarth:{main:"#b3792a",glow:"#f0c987",label:"岩岳"},
        setWind:{main:"#2fa870",glow:"#a8f0cf",label:"青嵐"}
    };

    const EQUIPMENT_SET_ATTACK_ART={
        setFire:{
            blade:"assets/equipment/sets/fire-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/fire-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/fire-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/fire-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/fire-wristguard-attack-v173.22.webp"
        },
        setWater:{
            blade:"assets/equipment/sets/water-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/water-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/water-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/water-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/water-wristguard-attack-v173.22.webp"
        },
        setEarth:{
            blade:"assets/equipment/sets/earth-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/earth-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/earth-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/earth-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/earth-wristguard-attack-v173.22.webp"
        },
        setWind:{
            blade:"assets/equipment/sets/wind-blade-attack-v173.22.webp",
            heavyArmor:"assets/equipment/sets/wind-heavy-armor-attack-v173.22.webp",
            boots:"assets/equipment/sets/wind-boots-attack-v173.22.webp",
            helm:"assets/equipment/sets/wind-helm-attack-v173.22.webp",
            wristguard:"assets/equipment/sets/wind-wristguard-attack-v173.22.webp"
        }
    };

    const EQUIPMENT_SET_MAGIC_ART={
        setFire:{
            fan:"assets/equipment/sets/fire-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/fire-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/fire-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/fire-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/fire-focus-magic-v173.24.webp"
        },
        setWater:{
            fan:"assets/equipment/sets/water-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/water-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/water-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/water-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/water-focus-magic-v173.24.webp"
        },
        setEarth:{
            fan:"assets/equipment/sets/earth-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/earth-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/earth-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/earth-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/earth-focus-magic-v173.24.webp"
        },
        setWind:{
            fan:"assets/equipment/sets/wind-fan-magic-v173.24.webp",
            robe:"assets/equipment/sets/wind-robe-magic-v173.24.webp",
            shoes:"assets/equipment/sets/wind-shoes-magic-v173.24.webp",
            crown:"assets/equipment/sets/wind-crown-magic-v173.24.webp",
            focus:"assets/equipment/sets/wind-focus-magic-v173.24.webp"
        }
    };

    function equipmentSetIcon(setId,pieceKey){
        const attackArt=EQUIPMENT_SET_ATTACK_ART[setId];
        if(attackArt&&attackArt[pieceKey]){
            return rasterItemIcon(attackArt[pieceKey],null,"equipment");
        }
        const magicArt=EQUIPMENT_SET_MAGIC_ART[setId];
        if(magicArt&&magicArt[pieceKey]){
            return rasterItemIcon(magicArt[pieceKey],null,"equipment");
        }
        const c=SET_PALETTE[setId]||SET_PALETTE.setFire;
        const shapes={
            blade:'<path d="M32 6 L38 40 L32 58 L26 40 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            fan:'<path d="M32 58 L14 20 A22 22 0 0 1 50 20 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            heavyArmor:'<path d="M16 14 L32 6 L48 14 L46 40 L32 58 L18 40 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            robe:'<path d="M22 8 H42 L48 56 H16 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            boots:'<path d="M22 6 H38 V34 L50 46 V58 H20 V40 H22 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            shoes:'<path d="M18 10 H36 V30 L52 40 V54 H16 V20 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            helm:'<path d="M32 6 A20 20 0 0 1 52 26 V38 H12 V26 A20 20 0 0 1 32 6 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            crown:'<path d="M12 42 L16 18 L26 30 L32 12 L38 30 L48 18 L52 42 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            wristguard:'<rect x="16" y="22" width="32" height="20" rx="6" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            focus:'<circle cx="32" cy="32" r="20" fill="none" stroke="'+c.main+'" stroke-width="4"/><circle cx="32" cy="32" r="8" fill="'+c.glow+'"/>'
        };
        return svgWrap(shapes[pieceKey]||shapes.blade,c.glow);
    }


    /* =====================================================
       2. 正式階級與符咒（符咒固定只到橙階）
       - 舊 Low/Mid/High/Perfect 僅保留在穩定 id，兼容舊存檔。
       - 正式 tierKey 一律使用 white/blue/purple/orange/pink/four-symbol。
    ===================================================== */

    const FORMAL_ITEM_TIERS=[
        {key:"white",label:"白階",legacyKey:"low",idSuffix:"Low",available:true},
        {key:"blue",label:"藍階",legacyKey:"mid",idSuffix:"Mid",available:true},
        {key:"purple",label:"紫階",legacyKey:"high",idSuffix:"High",available:true},
        {key:"orange",label:"橙階",legacyKey:"perfect",idSuffix:"Perfect",available:true},
        {key:"pink",label:"桃紅階",legacyKey:null,idSuffix:"Pink",available:false,planned:true},
        {key:"four-symbol",label:"四象階",legacyKey:null,idSuffix:"FourSymbol",available:false,planned:true}
    ];
    const TALISMAN_ACTIVATION_CHANCES=[35,55,75,100];
    const TALISMAN_TIERS=FORMAL_ITEM_TIERS.slice(0,4).map((tier,index)=>
        Object.assign({},tier,{chance:TALISMAN_ACTIVATION_CHANCES[index]})
    );
    const RESOURCE_TIERS=FORMAL_ITEM_TIERS.slice();

    window.v17360FormalItemTiers=FORMAL_ITEM_TIERS.map(tier=>Object.assign({},tier));

    const TALISMAN_EFFECTS=[
        {key:"freeze",label:"冰封符",duration:4},
        {key:"stealth",label:"隱身符",duration:2},
        {key:"barrier",label:"結界符",duration:4}
    ];

    const talismanDefinitions=[];
    TALISMAN_EFFECTS.forEach(effect=>{
        TALISMAN_TIERS.forEach(tier=>{
            talismanDefinitions.push({
                // Stable legacy id is intentional: old saves and old drop pools keep resolving.
                id:effect.key+"Talisman"+tier.idSuffix,
                name:tier.label+effect.label,
                icon:talismanIcon(effect.key,tier.key),
                type:"talisman",
                talismanEffect:effect.key,
                talismanDuration:effect.duration,
                tierChance:tier.chance,
                tierKey:tier.key,
                legacyTierKey:tier.legacyKey,
                price:0,
                stats:{}
            });
        });
    });

    function getTalismanDefinition(id){
        return talismanDefinitions.find(def=>def.id===id)||null;
    }
    window.v132GetTalismanDefinition=getTalismanDefinition;


    /* =====================================================
       3. 礦石材料（正式六階；桃紅／四象先規劃、不進目前掉落）
    ===================================================== */

    const oreDefinitions=RESOURCE_TIERS.map(tier=>({
        id:"ore"+tier.idSuffix,
        name:tier.label+"礦石",
        icon:rasterItemIcon("assets/items/materials/ore.png",tier.key,"material"),
        type:"material",
        tierKey:tier.key,
        legacyTierKey:tier.legacyKey,
        available:tier.available!==false,
        planned:tier.planned===true,
        price:0,
        stats:{}
    }));

    function getOreDefinition(id){
        return oreDefinitions.find(def=>def.id===id)||null;
    }
    function getOreDefinitionByTier(tierKey){
        return oreDefinitions.find(def=>def.tierKey===tierKey)||null;
    }
    window.v132GetOreDefinitionByTier=getOreDefinitionByTier;


    /* =====================================================
       4. 裝備設計圖紙（5部位 × 正式六階 × 4系列）
       桃紅／四象先建立資料結構；目前材料寶箱不會抽到。
    ===================================================== */

    const BLUEPRINT_SLOTS=[
        {key:"head",label:"頭部"},
        {key:"shoulder",label:"護腕"},
        {key:"shoes",label:"鞋子"},
        {key:"hand",label:"武器"},
        {key:"armor",label:"衣服"}
    ];

    const BLUEPRINT_SERIES=[
        {id:"setFire",label:"赤炎"},
        {id:"setWater",label:"寒泉"},
        {id:"setEarth",label:"岩岳"},
        {id:"setWind",label:"青嵐"}
    ];

    const blueprintDefinitions=[];
    BLUEPRINT_SLOTS.forEach(slot=>{
        RESOURCE_TIERS.forEach(tier=>{
            BLUEPRINT_SERIES.forEach(series=>{
                blueprintDefinitions.push({
                    id:"blueprint"+series.id.replace("set","")+slot.key.charAt(0).toUpperCase()+slot.key.slice(1)+tier.idSuffix,
                    name:series.label+tier.label+slot.label+"設計圖",
                    icon:blueprintIcon(slot.key,tier.key),
                    type:"material",
                    blueprintSlot:slot.key,
                    tierKey:tier.key,
                    legacyTierKey:tier.legacyKey,
                    available:tier.available!==false,
                    planned:tier.planned===true,
                    setId:series.id,
                    price:0,
                    stats:{}
                });
            });
        });
    });

    function getBlueprintDefinitionsByTier(tierKey){
        return blueprintDefinitions.filter(def=>def.tierKey===tierKey);
    }


    /* =====================================================
       5. 裝備套裝抽獎券（赤炎／寒泉／岩岳／青嵐）
    ===================================================== */

    const ticketDefinitions=[
        {id:"ticketSetFire",name:"赤炎裝備抽獎券",setId:"setFire",icon:ticketIcon("fire")},
        {id:"ticketSetWater",name:"寒泉裝備抽獎券",setId:"setWater",icon:ticketIcon("water")},
        {id:"ticketSetEarth",name:"岩岳裝備抽獎券",setId:"setEarth",icon:ticketIcon("earth")},
        {id:"ticketSetWind",name:"青嵐裝備抽獎券",setId:"setWind",icon:ticketIcon("wind")}
    ].map(base=>Object.assign({
        type:"ticket",
        price:0,
        stats:{}
    },base));

    function getTicketDefinition(id){
        return ticketDefinitions.find(def=>def.id===id)||null;
    }

    /*
       V169：抽獎券圖改為 inbox 提供的 PNG 後，舊存檔仍會保留
       當時寫入物件裡的 inline SVG（或空 icon）。依穩定 id 只同步
       四張抽獎券的展示資料，不碰數量、掉落與套裝裝備本體。
    */
    function syncTicketPresentation(item,definition){
        if(!item || !definition || item.id!==definition.id){ return item; }
        item.name=definition.name;
        item.icon=definition.icon;
        item.type=definition.type;
        item.setId=definition.setId;
        item.price=definition.price;
        return item;
    }

    function hydrateOwnedTicketPresentation(){
        inventoryItems.forEach(item=>{
            const definition=item&&getTicketDefinition(item.id);
            if(definition){ syncTicketPresentation(item,definition); }
        });
    }

    function syncStaticContentPresentation(item,definition){
        if(!item || !definition || item.id!==definition.id){ return item; }
        [
            "name","icon","type","price","setId","tierKey","legacyTierKey","available","planned","blueprintSlot",
            "talismanEffect","talismanDuration","tierChance","sharedSkillId","talismanSkillLevel"
        ].forEach(key=>{
            if(Object.prototype.hasOwnProperty.call(definition,key)){
                item[key]=definition[key];
            }
        });
        if(!item.stats || typeof item.stats!=="object"){ item.stats={}; }
        return item;
    }

    function hydrateOwnedStaticContentPresentation(){
        const definitions=[].concat(talismanDefinitions,oreDefinitions,blueprintDefinitions);
        const definitionById=new Map(definitions.map(definition=>[definition.id,definition]));
        inventoryItems.forEach(item=>{
            const definition=item&&definitionById.get(item.id);
            if(definition){ syncStaticContentPresentation(item,definition); }
        });
    }


    /* =====================================================
       6. 裝備套裝本體（4元素 × 10件，共40件）
    ===================================================== */

    /*
       每個元素套裝10件＝5個部位、每個部位各2種變體
       （物理向／法術向），對應到既有的6個裝備欄位中的
       5個（head/hand/shoulder/armor/shoes），跟裝備
       設計圖紙涵蓋的部位完全對齊，戒指(ring)這次沒有
       套裝款式，維持原有可裝備物品即可。
    */

    const EQUIPMENT_SET_PIECES=[
        {key:"blade",slot:"weapon",name:"刀",stats:{attack:10,vitality:-2}},
        {key:"fan",slot:"weapon",name:"扇",stats:{intelligence:10,vitality:-2}},
        {key:"heavyArmor",slot:"armor",name:"鎧甲",stats:{attack:5,spirit:5}},
        {key:"robe",slot:"armor",name:"袍",stats:{intelligence:5,spirit:5}},
        {key:"boots",slot:"shoes",name:"靴",stats:{agility:10}},
        {key:"shoes",slot:"shoes",name:"履",stats:{agility:10}},
        {key:"helm",slot:"head",name:"盔",stats:{attack:12}},
        {key:"crown",slot:"head",name:"冠",stats:{intelligence:12}},
        {key:"wristguard",slot:"shoulder",name:"護腕",stats:{attack:12}},
        {key:"focus",slot:"shoulder",name:"法環",stats:{intelligence:12}}
    ];

    const EQUIPMENT_SETS=[
        {id:"setFire",label:"赤炎",element:"fire"},
        {id:"setWater",label:"寒泉",element:"water"},
        {id:"setEarth",label:"岩岳",element:"earth"},
        {id:"setWind",label:"青嵐",element:"wind"}
    ];

    const equipmentSetItemDefinitions=[];
    EQUIPMENT_SETS.forEach(set=>{
        EQUIPMENT_SET_PIECES.forEach(piece=>{
            equipmentSetItemDefinitions.push({
                id:set.id+"_"+piece.key,
                name:set.label+piece.name,
                icon:equipmentSetIcon(set.id,piece.key),
                type:piece.slot,
                setId:set.id,
                levelRequirement:20,
                price:0,
                stats:Object.assign({},piece.stats)
            });
        });
    });

    function getEquipmentSetItemDefinitions(setId){
        return equipmentSetItemDefinitions.filter(def=>def.setId===setId);
    }

    function getSetLabel(setId){
        const set=EQUIPMENT_SETS.find(s=>s.id===setId);
        return set ? set.label : setId;
    }

    function getSetElement(setId){
        const set=EQUIPMENT_SETS.find(s=>s.id===setId);
        return set ? set.element : null;
    }

    /*
       V141 合成／精英掉落共用資料橋接。
       回傳淺拷貝陣列，避免外部補丁誤改原始定義清單；單筆定義仍是
       同一個唯讀資料物件，背包加入時既有函式本來就會複製它。
    */
    window.v132GetOreDefinition=getOreDefinition;
    window.v132GetTicketDefinition=getTicketDefinition;
    window.v132GetBlueprintDefinition=function(id){
        return blueprintDefinitions.find(def=>def.id===id)||null;
    };
    window.v132GetEquipmentSetItemDefinitions=getEquipmentSetItemDefinitions;
    window.v132GetContentDefinitions=function(){
        return {
            talismans:talismanDefinitions.slice(),
            ores:oreDefinitions.slice(),
            blueprints:blueprintDefinitions.slice(),
            tickets:ticketDefinitions.slice(),
            equipmentSets:EQUIPMENT_SETS.slice(),
            equipmentSetItems:equipmentSetItemDefinitions.slice()
        };
    };


    /* =====================================================
       7. 通用「加入背包」函式（不限藥水，材料/符咒/設計圖/
          抽獎券/裝備都能用同一套堆疊規則）
    ===================================================== */

    function getItemInventoryCapacity(definition){
        if(!definition){ return 0; }
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;
        const matchingStacks=inventoryItems.filter(
            item=>item && item.id===definition.id
        );
        const stackFreeSpace=maxStack<=1
            ? 0
            : matchingStacks.reduce(
                (sum,item)=>sum+Math.max(0,maxStack-(Number(item.count)||0)),
                0
            );
        const freeSlots=Math.max(0,120-inventoryItems.length);
        return stackFreeSpace+freeSlots*maxStack;
    }

    function canAddItemToInventory(definition,amount){
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        return quantity<=getItemInventoryCapacity(definition);
    }
    window.v132CanAddItemToInventory=canAddItemToInventory;

    function addItemToInventory(definition,amount){
        if(!definition){ return false; }
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;

        /*
           V137：舊版是一邊塞、一邊才檢查102格上限，數量較大時可能
           已經放入一部分才回傳false，呼叫端卻把整筆視為失敗。
           先算完整容量，確定整批都放得下才開始改背包，讓加入操作
           具備all-or-nothing語意。
        */
        if(!canAddItemToInventory(definition,quantity)){ return false; }

        if(maxStack<=1){
            let remaining=quantity;
            while(remaining>0){
                if(inventoryItems.length>=120){
                    return false;
                }
                inventoryItems.push(cloneInventoryStackItem(definition,1));
                remaining--;
            }
            return true;
        }

        let remaining=quantity;
        const stacks=inventoryItems.filter(item=>item && item.id===definition.id);
        const ticketDefinition=getTicketDefinition(definition.id);
        stacks.forEach(stack=>{
            if(remaining<=0){ return; }
            if(ticketDefinition){ syncTicketPresentation(stack,ticketDefinition); }
            const current=Math.max(0,Math.floor(Number(stack.count)||0));
            const space=Math.max(0,maxStack-current);
            const add=Math.min(space,remaining);
            stack.count=current+add;
            remaining-=add;
        });

        while(remaining>0){
            if(inventoryItems.length>=120){
                return false;
            }
            const stackCount=Math.min(maxStack,remaining);
            inventoryItems.push(cloneInventoryStackItem(definition,stackCount));
            remaining-=stackCount;
        }

        return true;
    }

    window.v132AddItemToInventory=addItemToInventory;

    function cloneInventorySnapshot(){
        return inventoryItems.map(item=>{
            if(!item || typeof item!=="object"){ return item; }
            const copy={...item};
            copy.stats=item.stats && typeof item.stats==="object"
                ? {...item.stats}
                : {};
            return copy;
        });
    }

    function restoreInventorySnapshot(snapshot){
        inventoryItems.splice(
            0,
            inventoryItems.length,
            ...snapshot.map(item=>{
                if(!item || typeof item!=="object"){ return item; }
                const copy={...item};
                copy.stats=item.stats && typeof item.stats==="object"
                    ? {...item.stats}
                    : {};
                return copy;
            })
        );
    }

    function runInventoryTransaction(operation){
        const snapshot=cloneInventorySnapshot();
        let endReleaseInventoryOperation=null;
        try{
            if(
                window.FourSymbolsReleaseUpdate&&
                typeof window.FourSymbolsReleaseUpdate.beginCriticalOperation==="function"
            ){
                endReleaseInventoryOperation=
                    window.FourSymbolsReleaseUpdate.beginCriticalOperation("inventory-transaction");
            }
        }catch(_){ }
        try{
            if(operation()){ return true; }
        }catch(error){
            console.error("背包交易失敗，已還原：",error);
        }finally{
            if(typeof endReleaseInventoryOperation==="function"){
                endReleaseInventoryOperation();
            }
        }
        restoreInventorySnapshot(snapshot);
        return false;
    }

    /*
       通用「從背包扣掉N個某ID物品」——寶箱/抽獎券開啟都要用到
       同一種「消耗庫存」邏輯，寫成共用版本，不用每個新物品類型
       各自複製一份扣庫存的迴圈。找不到足夠庫存時完全不動背包，
       回傳false。
    */
    function consumeStackItem(itemId,amount){
        const needed=Math.max(1,Math.floor(Number(amount)||1));
        const owned=inventoryItems.reduce((sum,item)=>{
            if(!item || item.id!==itemId){ return sum; }
            return sum+Math.max(0,Math.floor(Number(item.count)||0));
        },0);
        if(owned<needed){ return false; }

        let remaining=needed;
        for(let index=inventoryItems.length-1;index>=0 && remaining>0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==itemId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            const take=Math.min(current,remaining);
            if(current-take<=0){
                inventoryItems.splice(index,1);
            }else{
                item.count=current-take;
            }
            remaining-=take;
        }
        return true;
    }

    /* V141 bridge：合成系統沿用同一套原子背包交易與扣除邏輯。 */
    window.v132ConsumeStackItem=consumeStackItem;
    window.v132RunInventoryTransaction=runInventoryTransaction;


    /* =====================================================
       8. 一般練功掉落：4種低階道具各5%（每隻怪物擊殺各自
          獨立判定）
    ===================================================== */

    const NORMAL_DROP_POOL=[
        ()=>getTalismanDefinition("freezeTalismanLow"),
        ()=>getTalismanDefinition("stealthTalismanLow"),
        ()=>getTalismanDefinition("barrierTalismanLow"),
        ()=>getOreDefinition("oreLow")
    ];

    function awardMonsterMaterialDrop(monster){
        /*
           ★ 副本戰鬥不套用這組一般練功掉落——副本本身
           有自己獨立的寶箱獎勵流程（見下方第11節），
           兩邊各自負責各自的獎勵，不會疊加。
        */
        if(window.v132ActiveDungeonRun){ return; }

        const gained=[];
        NORMAL_DROP_POOL.forEach(getDef=>{
            if(Math.random()*100>=5){ return; }
            const definition=getDef();
            if(!definition){ return; }
            if(addItemToInventory(definition,1)){
                gained.push(definition.name);
            }
        });

        if(gained.length>0){
            addBattleLog(
                (monster && monster.name ? monster.name : "怪物")+
                "掉落了"+gained.join("、")+"。"
            );
            rebuildInventorySlots();
        }
    }

    if(typeof killMonster==="function"){
        const originalKillMonster=killMonster;
        killMonster=function(index){
            const monster=monsters[index];
            const result=originalKillMonster.apply(this,arguments);
            if(monster){
                awardMonsterMaterialDrop(monster);
            }
            return result;
        };
    }


    /* =====================================================
       9. 符咒使用：兩段判定
       1) 階級只決定「畫符／生效啟動」機率：35/55/75/100%。
       2) 畫符成功後，再以施放角色素質走對應滿級技能的命中規則。
       橙階 100% 代表一定畫符成功，不代表控制／符術一定命中。
    ===================================================== */

    function getTalismanActivationChance(definition){
        return Math.max(0,Math.min(100,Number(definition&&definition.tierChance)||0));
    }

    function getTalismanSharedSkill(definition){
        if(!definition||typeof skillDatabase==="undefined"){ return null; }
        const fallback={freeze:"freeze",stealth:"stealthSkill",barrier:"barrier"};
        const skillId=definition.sharedSkillId||fallback[definition.talismanEffect];
        return skillId?skillDatabase[skillId]||null:null;
    }

    function getTalismanCasterStats(characterIndex,character){
        if(typeof getPartyBattleStats==="function"){
            const stats=getPartyBattleStats(characterIndex);
            if(stats){ return stats; }
        }
        if(characterIndex===0&&typeof getMainCharacterStats==="function"){
            const stats=getMainCharacterStats();
            if(stats){ return stats; }
        }
        return character||{};
    }

    function rollTalismanSkillHit(definition,characterIndex,targetMonster){
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character){ return false; }
        const stats=getTalismanCasterStats(characterIndex,character);
        const skill=getTalismanSharedSkill(definition);
        if(skill){
            definition.talismanSkillLevel=Math.max(1,Math.floor(Number(skill.maxLevel)||1));
        }

        if(definition.talismanEffect==="freeze"&&targetMonster){
            const baseChance=Math.max(0,Number(skill&&skill.freezeChance)||0);
            const intelligence=Number(stats.intelligence!==undefined?stats.intelligence:character.intelligence)||0;
            const targetSpirit=typeof getMonsterEffectiveSpiritPoints==="function"
                ?Number(getMonsterEffectiveSpiritPoints(targetMonster))||0
                :Number(targetMonster.spiritPoints||targetMonster.spirit)||0;
            const rank=typeof getMonsterRank==="function"?getMonsterRank(targetMonster):"regular";
            if(typeof rollStatusEffectHit==="function"){
                return rollStatusEffectHit(
                    baseChance,Number(character.level)||1,Number(targetMonster.level)||1,
                    intelligence,targetSpirit,true,rank,0
                );
            }
        }

        // 隱身／結界是友方符術，不拿友軍閃避懲罰施放者；使用角色自身命中值。
        const accuracy=Number(stats.accuracy);
        if(Number.isFinite(accuracy)&&typeof rollHitChance==="function"){
            return rollHitChance(accuracy,0,0);
        }
        const intelligence=Number(stats.intelligence!==undefined?stats.intelligence:character.intelligence)||0;
        if(typeof rollStatusEffectHit==="function"){
            return rollStatusEffectHit(100,Number(character.level)||1,Number(character.level)||1,intelligence,0,false,"regular",0);
        }
        return true;
    }

    window.v17360GetTalismanActivationChance=getTalismanActivationChance;
    window.v17360RollTalismanSkillHit=rollTalismanSkillHit;

    function getTalismanInventoryItems(){
        const byId=new Map();
        inventoryItems.forEach(item=>{
            if(!item || item.type!=="talisman" || !item.id){ return; }
            const count=Math.max(0,Math.floor(Number(item.count)||0));
            if(count<=0){ return; }
            if(!byId.has(item.id)){
                byId.set(item.id,{...item,count:0});
            }
            byId.get(item.id).count+=count;
        });
        return Array.from(byId.values());
    }

    function consumeTalismanFromInventory(talismanId){
        for(let index=inventoryItems.length-1;index>=0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==talismanId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            if(current<=1){
                inventoryItems.splice(index,1);
            }else{
                item.count=current-1;
            }
            return true;
        }
        return false;
    }

    /*
       ★ 新增（依照使用者要求，「點選符咒沒有問選擇目標」）：
       符咒現在完全比照技能的選目標流程——冰封符要玩家自己點要冰封
       哪一隻怪，隱身符/結界符要玩家自己點要給我方哪一位角色。

       作法上刻意「不」自己造一套選目標UI，而是直接沿用遊戲既有的
       那一整套（setBattleTargetSelectionMode/selectBattleTarget、
       setBattleAllyTargetSelectionMode/selectBattleAllyTarget），
       只把符咒id當成pendingAction傳進去。好處是提示文字、卡片高亮、
       「返回」取消、結算階段讀queued.target/queued.targetAlly……
       全部原本就是對的，不用重寫也不會跟技能的行為不一致。

       ★ 已確認的相容性重點（讀過00-main.js確認）：
       - selectBattleTarget()（11119）完全不查skillDatabase，只把
         pendingAction原封不動存進queuedPlayerActions，所以「選怪物」
         這條路徑不用改任何東西就能直接用符咒id。
       - 「選我方」那條路徑不行：setBattleAllyTargetSelectionMode()
         （10713）跟selectBattleAllyTarget()（10744）都會做
         skillDatabase[actionType] 並要求 targetType 是 ally/deadAlly，
         符咒id查不到就會整個當成無效。所以下面補了這兩個的覆寫，
         遇到符咒id時改用一個「長得像技能」的合成物件走同一套判斷。
       - getBattleActionDisplayName()（10609）查不到會直接回傳原始id，
         提示會變成「選擇 [freezeTalismanLow]」這種醜東西，也一起覆寫。
    */
    function getTalismanTargetKind(definition){
        if(!definition){ return null; }
        return definition.talismanEffect==="freeze" ? "monster" : "ally";
    }

    /* 給既有的我方選目標流程用的「合成技能物件」——只需要
       targetType 跟 name 這兩個欄位就能讓那套邏輯正常運作。 */
    function makeTalismanPseudoSkill(definition){
        return {
            id:definition.id,
            name:definition.name,
            targetType:"ally",
            category:"buff"
        };
    }

    if(typeof getBattleActionDisplayName==="function"){
        const originalGetBattleActionDisplayName=getBattleActionDisplayName;
        getBattleActionDisplayName=function(actionType){
            const definition=getTalismanDefinition(actionType);
            if(definition){ return definition.name; }
            return originalGetBattleActionDisplayName.apply(this,arguments);
        };
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const originalSetBattleAllyTargetSelectionMode=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const definition=getTalismanDefinition(actionType);
            if(!definition){
                return originalSetBattleAllyTargetSelectionMode.apply(this,arguments);
            }

            const pseudoSkill=makeTalismanPseudoSkill(definition);
            const region=document.getElementById("battleActionRegion");
            const promptAction=document.getElementById("battleTargetPromptAction");

            if(region){ region.classList.add("target-selecting"); }
            if(promptAction){
                promptAction.textContent="選擇 ["+definition.name+"] 的我方目標";
            }

            currentBattleMonsters.forEach(index=>{
                const card=document.getElementById("battleMonster"+index);
                if(card){ card.classList.remove("targetable","target"); }
            });

            [0,1,2].forEach(index=>{
                const character=getBattleCharacterByIndex(index);
                const card=document.getElementById("battlePlayerCard"+index);
                if(card){
                    card.classList.toggle(
                        "ally-targetable",
                        isValidAllyTargetForSkill(pseudoSkill,character,index)
                    );
                }
            });

            const targetText=document.getElementById("battleTarget");
            if(targetText){ targetText.textContent="目標：請選擇我方角色"; }
        };
    }

    if(typeof selectBattleAllyTarget==="function"){
        const originalSelectBattleAllyTarget=selectBattleAllyTarget;
        selectBattleAllyTarget=function(index){
            const definition=getTalismanDefinition(pendingAction);
            if(!definition){
                return originalSelectBattleAllyTarget.apply(this,arguments);
            }

            if(!battleActive || battlePhase!=="declare" || !actionReady || !pendingAction){
                return;
            }

            const pseudoSkill=makeTalismanPseudoSkill(definition);
            const character=getBattleCharacterByIndex(index);
            if(!isValidAllyTargetForSkill(pseudoSkill,character,index)){ return; }

            const action=pendingAction;
            actionReady=false;
            pendingAction=null;
            clearBattleTargetSelectionMode();

            queuedPlayerActions[activeBattleCharacterIndex]={
                action:action,
                target:null,
                targetAlly:index
            };

            finishPlayerAction();
        };
    }

    function useTalisman(talismanId){
        const definition=getTalismanDefinition(talismanId);
        if(!definition){ return; }

        const autoOn=
            activeBattleCharacterIndex===0
            ? autoBattle
            : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

        if(!battleActive || autoOn || actionReady){ return; }

        const activeCharacter=getPartyCharacterByIndex(activeBattleCharacterIndex);
        if(!activeCharacter || activeCharacter.hp<=0){ return; }

        /*
           ★ 修正（依照使用者回報「三個人都使用符咒，結果都是一個人
           在使用」的第二個成因）：宣告階段要把「已經被其他角色預定
           走的符咒」也算進去。原本只看背包剩幾張，三個角色可以同時
           宣告同一張最後一張符咒，結算時先手用掉、後面兩位撞到
           「已經沒有庫存了」白白浪費一整個回合。
        */
        const ownedCount=inventoryItems.reduce((sum,item)=>{
            if(!item || item.id!==talismanId){ return sum; }
            return sum+Math.max(0,Math.floor(Number(item.count)||0));
        },0);

        const reservedCount=Object.keys(queuedPlayerActions).reduce((sum,key)=>{
            const queued=queuedPlayerActions[key];
            if(!queued || Number(key)===activeBattleCharacterIndex){ return sum; }
            return sum+(queued.action===talismanId ? 1 : 0);
        },0);

        if(ownedCount-reservedCount<=0){
            addBattleLog(
                definition.name+
                (reservedCount>0
                    ? "剩下的數量已經被這回合其他角色預定了。"
                    : "目前沒有庫存。")
            );
            renderBattleItemMenu();
            return;
        }

        /*
           ★ 進入選目標階段（而不是直接宣告完畢）：符咒id直接當成
           pendingAction，之後由既有的selectBattleTarget()／
           selectBattleAllyTarget()負責寫進queuedPlayerActions。
        */
        actionReady=true;
        pendingAction=talismanId;
        closeMenus();

        if(getTalismanTargetKind(definition)==="monster"){
            setBattleTargetSelectionMode(talismanId);
        }else{
            setBattleAllyTargetSelectionMode(talismanId);
        }

        updateUI();
    }
    window.useTalisman=useTalisman;

    function applyTalismanEffect(talismanId,characterIndex,queued){
        const definition=getTalismanDefinition(talismanId);
        const character=getPartyCharacterByIndex(characterIndex);

        if(!definition || !character){
            finishPlayerAction();
            return;
        }

        if(!consumeTalismanFromInventory(talismanId)){
            addBattleLog(definition.name+"已經沒有庫存了。");
            finishPlayerAction();
            return;
        }
        rebuildInventorySlots();

        /*
           ★ 修正（這就是使用者說「三個人都使用符咒，結果都是一個人
           在使用」的真正原因）：lungePlayerCard()跟showSkillNameBadge()
           的最後一個參數都是characterIndex，內部是
           $("battlePlayerCard"+(characterIndex||0))——原本這兩個呼叫
           都沒有傳，所以不管是誰施放，前傾動畫跟技能名稱都永遠演在
           0號角色的卡片上。二三號角色其實有正常結算（戰鬥紀錄有印、
           buff也有上），但畫面看起來就像「只有第一個人在用」。
           （同一個函式下面的showMissEffect()本來就有正確傳，所以
           「畫符失敗」反而一直是演在對的卡片上，剛好可以對照。）
        */
        lungePlayerCard(characterIndex);
        showSkillNameBadge(
            definition.name,
            definition.talismanEffect==="freeze" ? "water" : "wind",
            characterIndex
        );

        let targetIndex=null;
        let targetMonster=null;
        let allyIndex=null;
        let allyCharacter=null;
        let buffType=null;

        if(definition.talismanEffect==="freeze"){
            targetIndex=queued&&Number.isInteger(queued.target)?queued.target:null;
            if(targetIndex===null||!monsters[targetIndex]||!monsters[targetIndex].alive){
                const aliveTargets=currentBattleMonsters.filter(
                    index=>monsters[index]&&monsters[index].alive
                );
                if(aliveTargets.length===0){
                    addBattleLog(definition.name+"沒有可以生效的目標。");
                    finishPlayerAction();
                    return;
                }
                targetIndex=aliveTargets[Math.floor(Math.random()*aliveTargets.length)];
            }
            targetMonster=monsters[targetIndex];
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    targetMonster,"freeze","monster",targetIndex,definition.name
                )
            ){
                finishPlayerAction();
                return;
            }
        }else{
            allyIndex=queued&&Number.isInteger(queued.targetAlly)
                ?queued.targetAlly
                :characterIndex;
            allyCharacter=getBattleCharacterByIndex(allyIndex);
            if(!allyCharacter||allyCharacter.hp<=0){
                allyIndex=characterIndex;
                allyCharacter=character;
            }
            buffType=definition.talismanEffect==="stealth"?"stealthSkill":"barrier";
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    allyCharacter,buffType,"player",allyIndex,definition.name
                )
            ){
                finishPlayerAction();
                return;
            }
        }

        const activationChance=getTalismanActivationChance(definition);
        if(Math.random()*100>=activationChance){
            addBattleLog((character.id||"你")+"使用"+definition.name+"，畫符失敗！");
            showMissEffect(true,characterIndex,"畫符失敗");
            finishPlayerAction();
            return;
        }

        if(!rollTalismanSkillHit(definition,characterIndex,targetMonster)){
            if(definition.talismanEffect==="freeze"&&targetMonster){
                addBattleLog(targetMonster.name+"抵抗了"+definition.name+"的冰封效果。");
            }else{
                addBattleLog((character.id||"你")+"的"+definition.name+"畫符成功，但符術未命中。");
            }
            showMissEffect(true,characterIndex,"MISS");
            finishPlayerAction();
            return;
        }

        if(definition.talismanEffect==="freeze"){
            applyFreezeEffect(targetMonster,definition.talismanDuration);
            addBattleLog(
                (character.id||"你")+"使用"+definition.name+"，"+
                targetMonster.name+"被冰封了！"
            );
        }
        else{
            /*
               ★ 隱身符/結界符改成作用在玩家選的我方角色
               （queued.targetAlly），沒有選或那位已經倒下時才退回
               施法者自己。
            */
            allyCharacter.activeBuffs=allyCharacter.activeBuffs||[];
            const buff={type:buffType,turnsLeft:definition.talismanDuration};
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,buffType);
            }
            allyCharacter.activeBuffs.push(buff);

            const allyName=allyIndex===characterIndex
                ? (character.id||"你")
                : (allyCharacter.id||("角色"+(allyIndex+1)));

            addBattleLog(
                definition.talismanEffect==="stealth"
                    ? (character.id||"你")+"使用"+definition.name+"，"+allyName+
                      "進入隱身，無法被單體攻擊選中，持續"+definition.talismanDuration+"回合。"
                    : (character.id||"你")+"使用"+definition.name+"，"+allyName+
                      "獲得結界，可抵擋所有傷害，持續"+definition.talismanDuration+"回合。"
            );
        }

        updateUI();
        finishPlayerAction();
    }
    window.applyTalismanEffect=applyTalismanEffect;

    /*
       ★ 接進既有的「宣告後結算」dispatch點——跟potion
       同一個位置，找不到就代表這個版本的00-main.js結構
       跟預期不同，主動印出警告方便之後排查，不要默默失效。
    */
    if(typeof resolveQueuedPlayerAction==="function"){
        const originalResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=queuedPlayerActions[characterIndex];

            /*
               ★ 改成用「queued.action本身是不是一個符咒id」來判斷。
               以前是寫死 action==="talisman" 再另外存 talismanId，
               但現在符咒要走既有的選目標流程，而那套流程
               （selectBattleTarget/selectBattleAllyTarget）是把
               pendingAction原封不動寫進queued.action的，沒辦法順便
               多塞一個talismanId欄位——所以直接讓action帶符咒id，
               這裡用getTalismanDefinition()反查即可。
               同時把整個queued傳下去，讓結算端讀得到玩家選的
               target／targetAlly。
            */
            const talismanId=queued && queued.action ? queued.action : null;
            if(talismanId && getTalismanDefinition(talismanId)){
                activeBattleCharacterIndex=characterIndex;
                applyTalismanEffect(talismanId,characterIndex,queued);
                return;
            }

            return originalResolveQueuedPlayerAction.apply(this,arguments);
        };
    }
    else{
        console.warn("V132：找不到resolveQueuedPlayerAction()，符咒可能無法在戰鬥中結算，需要人工檢查00-main.js的函式名稱。");
    }

    /* 啟用戰鬥符咒清單按鈕（原本disabled，只列清單）。 */
    if(typeof renderBattleItemMenu==="function"){
        const originalRenderBattleItemMenu=renderBattleItemMenu;
        renderBattleItemMenu=function(){
            const result=originalRenderBattleItemMenu.apply(this,arguments);

            if(battleItemCategory!=="talisman"){ return result; }

            const list=document.getElementById("battlePotionList");
            if(!list){ return result; }

            const talismans=getTalismanInventoryItems();
            if(talismans.length===0){ return result; }

            list.innerHTML=talismans.map(item=>{
                const definition=getTalismanDefinition(item.id);
                const chanceLabel=definition ? definition.tierChance+"%" : "";
                return (
                    '<button type="button" class="battle-item-card talisman" '+
                    'onclick="useTalisman(\''+item.id+'\')" title="'+escapeHtml(item.name)+'">'+
                    '<span class="battle-item-badge">符</span>'+
                    '<span class="battle-item-name">'+escapeHtml(item.name)+'</span>'+
                    '<span class="battle-item-effect">生效機率 '+chanceLabel+'</span>'+
                    '<span class="battle-item-count">×'+item.count+'</span>'+
                    '</button>'
                );
            }).join("");

            return result;
        };
    }


    /* =====================================================
       10. 裝備套裝加成（3件：六圍全部+1／5件：對應元素
           技能傷害+2%），接進既有兩個唯一結算入口
    ===================================================== */

    function getEquipmentSetCounts(characterId){
        const equipment=characterEquipment[characterId];
        const counts={};
        if(!equipment){ return counts; }
        Object.values(equipment).forEach(item=>{
            if(item && item.setId){
                counts[item.setId]=(counts[item.setId]||0)+1;
            }
        });
        return counts;
    }
    window.v132GetEquipmentSetCounts=getEquipmentSetCounts;

    if(typeof getEquipmentBonus==="function"){
        const originalGetEquipmentBonus=getEquipmentBonus;
        getEquipmentBonus=function(characterId){
            const bonus=originalGetEquipmentBonus.apply(this,arguments);
            const counts=getEquipmentSetCounts(characterId);

            Object.keys(counts).forEach(setId=>{
                if(counts[setId]>=3){
                    ["attack","vitality","energy","intelligence","spirit","agility"].forEach(stat=>{
                        bonus[stat]=(bonus[stat]||0)+1;
                    });
                }
            });

            return bonus;
        };
    }

    if(typeof getElementDamagePassiveMultiplier==="function"){
        const originalGetElementDamagePassiveMultiplier=getElementDamagePassiveMultiplier;
        getElementDamagePassiveMultiplier=function(character){
            let multiplier=originalGetElementDamagePassiveMultiplier.apply(this,arguments);

            if(!character || !character.element){ return multiplier; }

            const key=typeof getCharacterSkillKey==="function" ? getCharacterSkillKey(character) : null;
            const equipmentKey=key==="fire" ? "fire" : key;
            if(!equipmentKey){ return multiplier; }

            const counts=getEquipmentSetCounts(equipmentKey);
            Object.keys(counts).forEach(setId=>{
                if(counts[setId]>=5 && getSetElement(setId)===character.element){
                    multiplier+=0.02;
                }
            });

            return multiplier;
        };
    }


    /* =====================================================
       11. 裝備等級限制（20LV才能穿戴套裝裝備）
    ===================================================== */

    if(typeof equipSelectedItem==="function"){
        const originalEquipSelectedItem=equipSelectedItem;
        equipSelectedItem=function(){
            const item=inventorySlots[selectedInventorySlot];
            const character=getBackpackCharacter(inventoryCharacterIndex);

            if(
                item &&
                item.levelRequirement &&
                character &&
                (character.level||1)<item.levelRequirement
            ){
                alert(
                    item.name+"需要角色等級達到"+
                    item.levelRequirement+"級才能穿戴，"+
                    "目前等級："+(character.level||1)+"。"
                );
                return;
            }

            return originalEquipSelectedItem.apply(this,arguments);
        };
    }


    /* =====================================================
       12. 抽獎券使用（開啟後隨機獲得該系列裝備其中一件）
    ===================================================== */

    function useEquipmentTicket(ticketId){
        const definition=getTicketDefinition(ticketId);
        if(!definition){ return; }

        const owned=inventoryItems.some(item=>item && item.id===ticketId && Number(item.count)>0);
        if(!owned){
            alert(definition.name+"目前沒有庫存。");
            return;
        }

        const pieces=getEquipmentSetItemDefinitions(definition.setId);
        if(pieces.length===0){ return; }

        const won=pieces[Math.floor(Math.random()*pieces.length)];

        const added=runInventoryTransaction(()=>{
            return consumeStackItem(ticketId,1) && addItemToInventory(won,1);
        });
        rebuildInventorySlots();
        renderInventoryItems();

        if(!added){
            alert("背包空間不足，"+won.name+"無法放入背包；抽獎券未消耗。");
            return;
        }

        saveGame();
        alert("使用"+definition.name+"，獲得【"+won.name+"】！");
    }
    window.useEquipmentTicket=useEquipmentTicket;

    /*
       開啟寶箱/抽獎券之前，先讓玩家看看「這個東西開了可能拿到
       什麼」——重用既有的v132ShowRewardModal彈窗，不用另外做
       一整套新UI。
    */
    function formatPreviewProbability(value){
        const rounded=Math.round(Number(value)*10)/10;
        return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1))+"%";
    }

    function previewRow(icon,name,amount,probability){
        return (
            '<div class="v132-preview-row">'+
            '<span class="v132-preview-row-main">'+
            (icon ? '<span class="v132-preview-icon">'+icon+'</span>' : '')+
            '<span>'+escapeHtml(name)+(amount ? ' ×'+amount : '')+'</span>'+
            '</span>'+
            '<b>'+formatPreviewProbability(probability)+'</b>'+
            '</div>'
        );
    }

    function showItemPreview(item){
        if(!item){ return; }
        let html;

        if(item.type==="chest"){
            const oreRows=CHEST_TIER_WEIGHTS.map(tier=>{
                const oreDef=getOreDefinitionByTier(tier.key);
                const amount=tier.key==="orange" ? 5 : 10;
                return oreDef ? previewRow(oreDef.icon,oreDef.name,amount,tier.weight) : "";
            }).join("");
            const blueprintRows=CHEST_TIER_WEIGHTS.map(tier=>{
                const pool=getBlueprintDefinitionsByTier(tier.key);
                const eachChance=pool.length ? tier.weight/pool.length : 0;
                const amount=tier.key==="orange" ? 5 : 10;
                return pool.map(definition=>
                    previewRow(definition.icon,definition.name,amount,eachChance)
                ).join("");
            }).join("");
            html=
                '<div class="v132-reward-modal-inner">'+
                '<h3>'+escapeHtml(item.name)+' 開啟預覽</h3>'+
                '<p>每次開啟會各獲得1組礦石與1種裝備設計圖；兩類獎勵分開抽取。</p>'+
                '<div class="v132-preview-section-title">可能獲得的礦石</div>'+
                '<div class="v132-preview-list">'+oreRows+'</div>'+
                '<div class="v132-preview-section-title">可能獲得的裝備設計圖</div>'+
                '<div class="v132-preview-list v132-preview-list-scroll">'+blueprintRows+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">關閉</button>'+
                '</div></div>';
        }
        else if(item.type==="ticket"){
            const ticketDef=getTicketDefinition(item.id);
            const pieces=ticketDef ? getEquipmentSetItemDefinitions(ticketDef.setId) : [];
            const chance=pieces.length ? 100/pieces.length : 0;
            const grid=pieces.map(p=>
                '<button type="button" class="v132-preview-item" data-item-id="'+escapeHtml(p.id)+'" '+
                'aria-label="查看'+escapeHtml(p.name)+'詳細資料" '+
                'onclick="v132OpenPreviewEquipmentDetail(this.dataset.itemId)">'+
                '<span class="v132-preview-icon">'+p.icon+'</span>'+
                '<span class="v132-preview-item-name">'+escapeHtml(p.name)+'</span>'+
                '<b>'+formatPreviewProbability(chance)+'</b>'+
                '</button>'
            ).join("");
            html=
                '<div class="v132-reward-modal-inner v132-ticket-preview-modal">'+
                '<h3>'+escapeHtml(item.name)+' 開啟預覽</h3>'+
                '<p>開啟後，從以下10件['+(ticketDef ? getSetLabel(ticketDef.setId) : "")+']套裝部位中'+
                '隨機獲得1件：</p>'+
                '<div class="v132-preview-grid">'+grid+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">關閉</button>'+
                '</div></div>';
        }
        else{
            return;
        }

        v132ShowRewardModal(html);
    }
    window.v132ShowItemPreview=showItemPreview;

    function openPreviewEquipmentDetail(itemId){
        const item=equipmentSetItemDefinitions.find(definition=>definition.id===String(itemId||""));
        if(!item||typeof openEquippedItem!=="function"){ return; }

        const rewardModal=document.getElementById("v132RewardModal");
        if(rewardModal){ rewardModal.classList.add("v132-detail-paused"); }

        openEquippedItem(item,"");

        const modal=document.getElementById("itemModal");
        if(!modal){
            if(rewardModal){ rewardModal.classList.remove("v132-detail-paused"); }
            return;
        }

        modal.classList.add("v132-ticket-preview-detail");

        const title=document.getElementById("itemModalName");
        if(title){ title.textContent=item.name; }

        [
            document.getElementById("itemEquipButton"),
            modal.querySelector(".sell-button"),
            document.getElementById("v132ItemUseButton"),
            document.getElementById("v132ItemPreviewButton"),
            document.getElementById("v141DecomposeButton")
        ].forEach(button=>{ if(button){ button.style.display="none"; } });
    }
    window.v132OpenPreviewEquipmentDetail=openPreviewEquipmentDetail;

    /*
       ★ 物品詳細彈窗補上符咒/抽獎券/寶箱的「開啟」跟「預覽」
       按鈕——這幾種東西不是藥水（不走usePotion()那條路）、
       也不是裝備（不能穿戴），原本的itemEquipButton在這幾種
       類型上只會被判成「不可裝備」整個鎖死但還是顯示著，這裡
       依照 V138 最新規格，寶箱/抽獎券點開只顯示「開啟／預覽」
       兩個物品動作；穿戴與售出都隱藏，避免零售價物品被誤售。
    */
    if(typeof openItemModal==="function"){
        const afterOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v132-ticket-preview-detail"); }
            const result=afterOpenItemModal.apply(this,arguments);

            const item=inventorySlots[slotIndex];
            const equipButton=document.getElementById("itemEquipButton");
            const sellButton=document.querySelector("#itemModal .sell-button");
            let useButton=document.getElementById("v132ItemUseButton");
            let previewButton=document.getElementById("v132ItemPreviewButton");

            if(!useButton && equipButton && equipButton.parentElement){
                useButton=document.createElement("button");
                useButton.id="v132ItemUseButton";
                useButton.type="button";
                useButton.className=equipButton.className;
                equipButton.parentElement.insertBefore(useButton,equipButton.nextSibling);
            }

            if(!previewButton && useButton && useButton.parentElement){
                previewButton=document.createElement("button");
                previewButton.id="v132ItemPreviewButton";
                previewButton.type="button";
                previewButton.className=useButton.className;
                useButton.parentElement.insertBefore(previewButton,useButton.nextSibling);
            }

            const isChestOrTicket=item && (item.type==="chest" || item.type==="ticket");

            /*
               ★ 修正（依照使用者回報）：符咒不是裝備，但原本的
               openItemModal()只針對 type==="potion" 把「穿戴」鍵鎖住
               （js/00-main.js:30447），符咒會落到else分支變成一顆
               可以按的「穿戴」鍵——按下去因為
               getInventoryEquipmentSlot("talisman")查不到對應欄位，
               equipSelectedItem()只是靜默return，等於是一顆騙人的
               死按鈕。依使用者決定「符咒不能在戰鬥外使用」，這裡
               只把這顆錯誤的按鈕藏掉，不另外補「使用」鍵。
            */
            const isBattleOnlyItem=item && item.type==="talisman";

            if(equipButton){
                equipButton.style.display=
                    (isChestOrTicket || isBattleOnlyItem) ? "none" : "";
            }

            if(sellButton){
                sellButton.style.display=isChestOrTicket ? "none" : "";
            }

            if(isChestOrTicket){
                const statsEl=document.getElementById("itemModalStats");
                if(statsEl){
                    Array.from(statsEl.children).forEach(child=>{
                        if((child.textContent||"").includes("售價：")){
                            child.remove();
                        }
                    });
                }
            }

            if(useButton){
                if(item && item.type==="ticket"){
                    useButton.style.display="";
                    useButton.textContent="開啟";
                    useButton.onclick=function(){
                        useEquipmentTicket(item.id);
                        closeItemModal();
                    };
                }
                else if(item && item.type==="chest"){
                    useButton.style.display="";
                    useButton.textContent="開啟";
                    useButton.onclick=function(){
                        const opened=openSingleMaterialChestFromInventory();
                        closeItemModal();
                        if(opened){
                            alert("開啟"+item.name+"，獲得：\n"+opened.join("\n"));
                        }
                    };
                }
                else{
                    useButton.style.display="none";
                    useButton.onclick=null;
                }
            }

            if(previewButton){
                if(isChestOrTicket){
                    previewButton.style.display="";
                    previewButton.textContent="預覽";
                    previewButton.onclick=function(){
                        showItemPreview(item);
                    };
                }
                else{
                    previewButton.style.display="none";
                    previewButton.onclick=null;
                }
            }

            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const afterOpenEquippedItemActions=openEquippedItem;
        openEquippedItem=function(){
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v132-ticket-preview-detail"); }
            const result=afterOpenEquippedItemActions.apply(this,arguments);
            const sellButton=document.querySelector("#itemModal .sell-button");
            const useButton=document.getElementById("v132ItemUseButton");
            const previewButton=document.getElementById("v132ItemPreviewButton");
            if(sellButton){ sellButton.style.display=""; }
            if(useButton){ useButton.style.display="none"; useButton.onclick=null; }
            if(previewButton){ previewButton.style.display="none"; previewButton.onclick=null; }
            return result;
        };
    }

    if(typeof closeItemModal==="function"){
        const afterCloseItemModal=closeItemModal;
        closeItemModal=function(){
            const modal=document.getElementById("itemModal");
            const returningToTicketPreview=!!(
                modal&&modal.classList.contains("v132-ticket-preview-detail")
            );
            const result=afterCloseItemModal.apply(this,arguments);
            if(modal){ modal.classList.remove("v132-ticket-preview-detail"); }
            if(returningToTicketPreview){
                const rewardModal=document.getElementById("v132RewardModal");
                if(rewardModal){ rewardModal.classList.remove("v132-detail-paused"); }
            }
            return result;
        };
    }


    /* =====================================================
       13. 日常副本：每日次數狀態（獨立存檔，格式跟
           元素匣state同一套慣例，date跟今天不同就重置）
    ===================================================== */

    const DUNGEON_STATE_KEY=window.FourSymbolsAccountSave.accountKey("daily-dungeon-state");
    const DUNGEON_TYPES=["exp","material","equipment"];

    function loadDungeonState(){
        try{
            const parsed=JSON.parse(localStorage.getItem(DUNGEON_STATE_KEY)||"{}");
            const state={date:parsed.date||todayString(),used:{}};
            DUNGEON_TYPES.forEach(type=>{
                state.used[type]=!!(parsed.used && parsed.used[type]);
            });
            return state;
        }catch(_){
            return {date:todayString(),used:{exp:false,material:false,equipment:false}};
        }
    }

    let dungeonState=loadDungeonState();

    function persistDungeonState(){
        try{
            localStorage.setItem(DUNGEON_STATE_KEY,JSON.stringify(dungeonState));
        }catch(_){ }
    }

    function ensureDungeonStateCurrent(){
        const today=todayString();
        if(dungeonState.date!==today){
            dungeonState={date:today,used:{exp:false,material:false,equipment:false}};
            persistDungeonState();
        }
    }

    /*
       ★ 修正（依照使用者要求，「副本先取消挑戰次數，方便我頻繁
       測試」）：先關掉每日次數限制，只要把這個常數改回true，
       markDungeonUsed()就會恢復正常記錄「今天挑戰過了」，
       isDungeonAvailable()/dungeonEntryCard()的UI也會自動恢復
       擋下重複挑戰，不用再改別的地方。
    */
    const DUNGEON_DAILY_LIMIT_ENABLED=false;

    function markDungeonUsed(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return; }
        ensureDungeonStateCurrent();
        dungeonState.used[type]=true;
        persistDungeonState();
    }

    /*
       ★ 修正（依照使用者回報「刪除角色了，為何副本次數沒有重置」）：
       上一版只在「寫入」端（markDungeonUsed）擋了旗標，「讀取」端
       （這裡跟dungeonEntryCard）卻照樣直接讀dungeonState.used——
       結果是旗標關掉之前就已經存進localStorage的used:true，會繼續
       讓按鈕永久disabled到隔天為止，看起來就像「次數根本沒解除」。
       讀取端也要一起看旗標，關閉時一律視為可挑戰。
    */
    function isDungeonUsedToday(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return false; }
        ensureDungeonStateCurrent();
        return !!dungeonState.used[type];
    }

    function isDungeonAvailable(type){
        return !isDungeonUsedToday(type);
    }
    window.v132IsDungeonAvailable=isDungeonAvailable;
    window.v132IsDungeonUsedToday=isDungeonUsedToday;

    function hasLevel10CharacterForDailyDungeon(){
        return getExistingPartyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return character && (Number(character.level)||1)>=10;
        }).length>=1;
    }
    window.v132HasLevel10CharacterForDailyDungeon=hasLevel10CharacterForDailyDungeon;
    window.v132HasTwoCharactersAtLevel20=hasLevel10CharacterForDailyDungeon;

    /*
       ★ 修正（同一個回報的另一半）：副本次數是存在
       v132_daily_dungeon_state這個「獨立的localStorage key」裡，
       而刪角色用的resetGame()（js/00-main.js）只清SAVE_KEY跟兩個
       舊版存檔key，從來沒有碰過這個key——所以刪完角色重新創角，
       副本次數還是上一個角色用掉的狀態。

       這裡不去包resetGame()（它是先取得玩家確認再location.reload()，
       包在外面會變成「使用者按了取消，資料卻已經被清掉」），改成
       在腳本載入時判斷「目前根本沒有任何角色」——resetGame()會
       reload，reload後loadGame()找不到存檔，player.id會是空字串，
       這個時機點就是最乾淨的「全新開始」信號，順手把這兩個側邊
       key一起清乾淨。
    */
    (function resetSideCarStateWhenNoCharacter(){
        const hasAnyCharacter=
            (typeof player!=="undefined" && player && player.id) ||
            (typeof player2!=="undefined" && player2 && player2.id) ||
            (typeof player3!=="undefined" && player3 && player3.id);

        if(hasAnyCharacter){ return; }

        try{
            localStorage.removeItem(DUNGEON_STATE_KEY);
            localStorage.removeItem(window.FourSymbolsAccountSave.accountKey("element-box-state"));
        }catch(_){ }

        dungeonState={date:todayString(),used:{exp:false,material:false,equipment:false}};
    })();


    /* =====================================================
       14. 副本怪物等級公式：玩家總角色等級加總 ÷ 角色數量
    ===================================================== */

    /*
       ★ 修正（依照使用者明確指正）：
       原本「所有已建立角色等級總和÷角色數量」的算法，
       在高等主力帶低等角色時會把副本等級平均得很低
       （例如Lv.50+Lv.20+Lv.10只會算出約Lv.27），造成
       副本明顯偏簡單。改成「隊伍最高角色等級×0.70＋
       隊伍平均角色等級×0.30」，讓副本等級主要跟著隊伍
       裡最強的角色走，平均值只用來做小幅度的微調，
       不會再被低等角色拖累太多。只有一名角色時，
       最高等級跟平均等級相同，算出來還是原本的角色
       等級，行為不變。
    */
    function getDungeonMonsterLevel(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 1; }
        const levels=indexes.map(index=>{
            const character=getPartyCharacterByIndex(index);
            return (character && character.level)||1;
        });
        const maxLevel=Math.max(...levels);
        const avgLevel=levels.reduce((sum,l)=>sum+l,0)/levels.length;
        return Math.max(1,Math.round(maxLevel*0.70+avgLevel*0.30));
    }
    window.v132GetDungeonMonsterLevel=getDungeonMonsterLevel;

    const DUNGEON_ELEMENTS=["fire","water","earth","wind"];

    function randomElement(){
        return DUNGEON_ELEMENTS[Math.floor(Math.random()*DUNGEON_ELEMENTS.length)];
    }

    /* 副本普通怪的 HP／SP／防禦沿用既有耐久基準；攻擊與魔攻
       不在建怪階段放大，怪物對玩家的輸出統一交由敵方壓力倍率。 */
    const DUNGEON_MONSTER_STRENGTH=1.30;

    function applyDungeonMonsterStrength(monster){
        if(!monster){ return monster; }
        ["maxHP","maxSP","defense"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*DUNGEON_MONSTER_STRENGTH));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       ★ 新增（依照使用者要求，「副本怪物整體仍然偏弱」的
       第二輪調整）：
       上面的DUNGEON_MONSTER_STRENGTH（×1.30）只讓副本怪
       打平一般野怪，這裡疊加「副本普通怪」自己的額外強化
       （×1.10，含SP），讓同等級的副本普通怪本來就應該比
       野外普通怪再強一截（1.30×1.10≈1.43倍）。精英/BOSS
       都是先墊到這一層「副本普通怪」的完整數值，才各自再
       疊加精英/BOSS專屬倍率（見下面applyDungeonRankStrength），
       不是另外從裸數值重算，也不會讓×1.30被套用第二次
       ——這五個函式（makeZoneMonster→
       applyDungeonMonsterStrength→applyDungeonNormalBonus→
       applyDungeonRankStrength，全部包在buildDungeonMonster()
       裡）就是唯一負責副本怪數值的地方，一般野怪完全不會
       經過這裡，不受影響。
    */
    const DUNGEON_NORMAL_BONUS=1.10;

    function applyDungeonNormalBonus(monster){
        if(!monster){ return monster; }
        ["maxHP","maxSP","defense"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*DUNGEON_NORMAL_BONUS));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       精英/BOSS專屬倍率，都是從「副本普通怪」的完整數值
       （已經套過×1.30跟×1.10）再往上疊加，不重新從裸數值
       算起。V138 依最新規格在原有強度上再加：精英最終HP
       再+100%、SP+100%；BOSS最終HP再+50%、SP+100%。
       V173.38 起 rank 只放大生存資源；攻擊／魔攻不再於建怪階段
       乘算，敵方輸出壓力統一交由正式 enemyPressure 加算桶控制。
       HP倍率分別為3.20、4.50，SP兩者皆×2.00，防禦倍率保留。
       只認monster.rank（makeZoneMonster()第4個參數決定），
       一般怪（rank是undefined）這裡什麼都不做，直接跳過。
    */
    const DUNGEON_ELITE_MULTIPLIERS={maxHP:3.20,maxSP:2.00,defense:1.25};
    const DUNGEON_BOSS_MULTIPLIERS={maxHP:4.50,maxSP:2.00,defense:1.40};
    const EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS={maxHP:1.80,defense:1.10};
    const EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS={maxHP:2.80,defense:1.20};

    function applyDungeonRankStrength(monster){
        if(!monster){ return monster; }
        const multipliers=
            monster.rank==="elite" ? DUNGEON_ELITE_MULTIPLIERS :
            monster.rank==="boss" ? DUNGEON_BOSS_MULTIPLIERS :
            null;
        if(!multipliers){ return monster; }
        Object.keys(multipliers).forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*multipliers[key]));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /* 共用副本／深淵入口：完整普通基準後套共用 rank 倍率。
       裝備副本使用下方專用入口，避免與共用 rank 倍率疊乘。 */
    function buildDungeonMonster(name,level,element,rank){
        const monster=makeZoneMonster(name,level,element,rank);
        applyDungeonMonsterStrength(monster);
        applyDungeonNormalBonus(monster);
        applyDungeonRankStrength(monster);
        monster.v132Dungeon=true;
        return monster;
    }
    window.v132BuildDungeonMonster=buildDungeonMonster;
    window.v132DungeonRankMultipliers=Object.freeze({
        elite:Object.freeze(Object.assign({},DUNGEON_ELITE_MULTIPLIERS)),
        boss:Object.freeze(Object.assign({},DUNGEON_BOSS_MULTIPLIERS))
    });

    function applyEquipmentDungeonRankStrength(monster){
        if(!monster){ return monster; }
        const multipliers=
            monster.rank==="elite" ? EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS :
            monster.rank==="boss" ? EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS :
            null;
        if(!multipliers){ return monster; }
        Object.keys(multipliers).forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*multipliers[key]));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    function buildEquipmentDungeonMonster(name,level,element,rank){
        const monster=makeZoneMonster(name,level,element,rank);
        applyDungeonMonsterStrength(monster);
        applyDungeonNormalBonus(monster);
        applyEquipmentDungeonRankStrength(monster);
        monster.v132Dungeon=true;
        monster.v132EquipmentDungeon=true;
        return monster;
    }
    window.v132BuildEquipmentDungeonMonster=buildEquipmentDungeonMonster;
    window.v173EquipmentDungeonRankMultipliers=Object.freeze({
        elite:Object.freeze(Object.assign({},EQUIPMENT_DUNGEON_ELITE_MULTIPLIERS)),
        boss:Object.freeze(Object.assign({},EQUIPMENT_DUNGEON_BOSS_MULTIPLIERS))
    });

    function setMonsterSkillTier(monster,tier,chance){
        const pool=Object.keys(skillDatabase).filter(skillId=>{
            const skill=skillDatabase[skillId];
            return (
                skill.element===monster.element &&
                (skill.category==="physical" || skill.category==="magic") &&
                skill.tier===tier
            );
        });
        monster.skillIds=pool;
        monster.skillChance=chance;
    }

    function setMonsterMaxTierSkills(monster,chance){
        const pool=Object.keys(skillDatabase).filter(skillId=>{
            const skill=skillDatabase[skillId];
            return (
                skill.element===monster.element &&
                (skill.category==="physical" || skill.category==="magic") &&
                skill.tier===4
            );
        });
        monster.skillIds=pool;
        monster.skillChance=chance;
    }

    function lockDungeonSkillConfiguration(monster,skillLevel){
        const level=Math.max(1,Math.floor(Number(skillLevel)||1));
        monster.v132FixedSkillLoadout=true;
        monster.v141ForceSkillLevel=level;
        monster.v141SkillLevel=level;
        monster.v144SkillLevel=level;
        return monster;
    }


    /* =====================================================
       15. 副本戰鬥啟動器（借用monsters整包替換的既有慣例，
           結束後完整還原，不影響巡怪系統）
    ===================================================== */

    window.v132ActiveDungeonRun=null;

    function launchDungeonBattle(monsterList,onComplete,options){
        const opts=options&&typeof options==="object"?options:{};
        if(battleActive){
            alert("目前正在戰鬥中，無法開始副本。");
            return false;
        }

        window.v132ActiveDungeonRun={
            previousMonsters:monsters,
            previousZone:currentZone,
            onComplete:onComplete,
            normalizeFailureResources:opts.normalizeFailureResources!==false,
            startedAt:Date.now()
        };

        monsters=monsterList;
        currentZone="dungeon";

        battleActive=true;
        battleToken++;
        battleRoundBoundaryKeys=new Set();
        battlePresentationLocks.clear();
        battleInputResumeToken=null;
        battleResolutionResumeToken=null;
        battleAutoActionResume=null;
        clearBattleRoundPrompt();
        stopMonsterMovement();
        clearInterval(timerId);
        if(battleAdvanceTimeoutId){
            clearTimeout(battleAdvanceTimeoutId);
            battleAdvanceTimeoutId=null;
        }
        battleAdvanceScheduled=false;
        closeMenus();

        selectedMonster=0;
        turn=1;
        actionReady=false;
        pendingAction=null;

        /*
           V137：副本舊版每次launch（經驗副本三個stage也各算一次）
           都把第二、第三角色補滿，主角卻保留殘血，造成免費補血與
           車輪戰難度失真。比照一般戰鬥，三名角色一律只夾在目前
           上限內，不平白回復HP/SP。
        */
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const stats=getPartyBattleStats(characterIndex);
            if(!character || !stats){ return; }
            character.hp=Number.isFinite(Number(character.hp))
                ? Math.max(0,Math.min(stats.maxHP,Number(character.hp)))
                : stats.maxHP;
            character.sp=Number.isFinite(Number(character.sp))
                ? Math.max(0,Math.min(stats.maxSP,Number(character.sp)))
                : stats.maxSP;
            character.activeBuffs=[];
            character.statusEffects=[];
            character.isDefending=false;
        });

        currentBattleMonsters=monsterList.map((m,i)=>i);
        currentBattleMonsters.forEach(i=>{
            monsters[i].alive=true;
            monsters[i].hp=monsters[i].maxHP;
            monsters[i].sp=monsters[i].maxSP;
            monsters[i].statusEffects=[];
        });

        renderBattle();
        showPage("battle");

        autoBattle=autoConfig.enabled;
        if(typeof window.v131SyncElementBoxForBattle==="function"){
            window.v131SyncElementBoxForBattle({silent:true});
        }
        syncBattleAutoSettings();
        updateAutoButton();
        beginBattleStatisticsSession();

        selectBattleTarget(0);
        clearBattleLog();
        addBattleLog("副本戰鬥開始！");
        addBattleLog("敵人共有"+currentBattleMonsters.length+"隻。");

        startTurn(battleToken);
        return true;
    }
    window.v132LaunchDungeonBattle=launchDungeonBattle;

    /*
       ★ winBattle()/loseBattle()是既有巡怪系統勝負結算
       的唯一入口，副本借用同一套回合引擎，勝負當然也會
       經過這裡——用window.v132ActiveDungeonRun這個旗標
       判斷「這場是不是副本戰鬥」，是的話整段導去副本
       專屬的結算流程，並且完整還原monsters/currentZone，
       不執行巡怪那一套（重生怪物、回地圖……）。
    */
    function restoreDungeonMonsters(){
        const run=window.v132ActiveDungeonRun;
        if(!run){ return; }
        monsters=run.previousMonsters;
        currentZone=run.previousZone;
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            const run=window.v132ActiveDungeonRun;
            if(!run){
                return originalWinBattle.apply(this,arguments);
            }

            battleActive=false;
            clearBattleRoundPrompt();
            finishBattleStatisticsSession("win");
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            clearInterval(timerId);
            timerId=null;
            if(battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId);
                battleAdvanceTimeoutId=null;
            }
            battleAdvanceScheduled=false;
            battleToken++;
            closeMenus();

            addBattleLog("副本這一場戰鬥勝利！");

            const turnsUsed=turn;
            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            applyPostBattleAutoRecovery();
            saveGame();

            if(run.onComplete){
                run.onComplete({result:"win",turnsUsed:turnsUsed});
            }
        };
    }

    if(typeof loseBattle==="function"){
        const originalLoseBattle=loseBattle;
        loseBattle=function(){
            const run=window.v132ActiveDungeonRun;
            if(!run){
                return originalLoseBattle.apply(this,arguments);
            }

            /*
               不呼叫一般loseBattle()：它會排一個2.2秒後返回巡怪地圖的
               timeout。舊版雖然先顯示副本頁，仍會被那個延遲回呼踢回
               地圖。副本失敗在這裡完整收尾並補滿隊伍，再交給副本
               callback回到日常副本頁。
            */
            battleActive=false;
            clearBattleRoundPrompt();
            finishBattleStatisticsSession("lose");
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            clearInterval(timerId);
            timerId=null;
            if(battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId);
                battleAdvanceTimeoutId=null;
            }
            battleAdvanceScheduled=false;
            battleToken++;
            closeMenus();
            addBattleLog("副本挑戰失敗……");
            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            if(run.normalizeFailureResources!==false){
                getExistingPartyIndexes().forEach(characterIndex=>{
                    const character=getPartyCharacterByIndex(characterIndex);
                    const stats=getPartyBattleStats(characterIndex);
                    if(!character || !stats){ return; }
                    character.hp=stats.maxHP;
                    character.sp=stats.maxSP;
                });
            }
            updateUI();
            saveGame();

            if(run.onComplete){
                run.onComplete({result:"lose"});
            }
        };
    }


    /* =====================================================
       16. 經驗副本：單一角色10級開放，連續3場車輪戰
    ===================================================== */

    function startExpDungeonBattle(stage,rewardExp){
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<10;i++){
            const monster=buildDungeonMonster(
                "經驗軍團兵",
                level,
                randomElement(),
                stage===3 ? "elite" : "regular"
            );
            monster.v141DungeonStage=stage;
            roster.push(monster);
        }
        roster.forEach(monster=>{ setMonsterSkillTier(monster,2,0.5); });

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }

            if(stage<3){
                setTimeout(()=>{
                    startExpDungeonBattle(stage+1,rewardExp);
                },600);
                return;
            }

            showExpDungeonRewardModal(rewardExp);
        });
    }

    /*
       V139經驗副本基礎獎勵固定為「目前全隊升級需求平均值的11%」，
       正式維持「隊伍當級 expNext 平均 ×33%」；看廣告雙倍沿用既有
       流程，因此一般領取約33%、雙倍領取約66%。
    */
    const EXP_DUNGEON_REWARD_RATIO=0.33;

    function getExpDungeonRewardExp(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 0; }
        const total=indexes.reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            if(!character){ return sum; }
            return sum+Math.max(0,Number(character.expNext)||0);
        },0);
        return Math.floor((total/indexes.length)*EXP_DUNGEON_REWARD_RATIO);
    }
    window.v138GetExpDungeonRewardExp=getExpDungeonRewardExp;
    window.v139GetExpDungeonRewardExp=getExpDungeonRewardExp;

    function showExpDungeonRewardModal(rewardExp){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>經驗副本挑戰成功！</h3>'+
            '<p>可獲得經驗值：<b>'+Math.floor(rewardExp).toLocaleString("zh-TW")+'</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(false)">直接領取</button>'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(true)">看廣告雙倍領取</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    function confirmDungeonEntry(title,details){
        if(typeof window.rpgConfirm!=="function"){
            return Promise.resolve(false);
        }
        return window.rpgConfirm(
            "確定要進入「"+title+"」嗎？\n\n"+
            details+"\n\n"+
            "進入後才會開始戰鬥；挑戰失敗不會扣除今日次數。",
            {
                title:"副本確認",
                confirmText:"進入副本",
                cancelText:"返回"
            }
        );
    }

    window.v132ClaimExpDungeonReward=function(doubled){
        function grant(){
            const rewardMultiplier=doubled ? 2 : 1;
            const rewardExp=Math.floor(getExpDungeonRewardExp()*rewardMultiplier);
            sharedExp+=rewardExp;
            markDungeonUsed("exp");
            addBattleLog("經驗副本結算，獲得"+rewardExp+"EXP，已存入經驗池。");
            saveGame();
            v132CloseRewardModal();
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("廣告未完成，未獲得雙倍獎勵。");
            });
        }else{
            grant();
        }
    };

    async function beginExpDungeon(){
        if(!isDungeonAvailable("exp")){
            alert("經驗副本今天已經挑戰過了。");
            return;
        }
        const mainCharacter=getPartyCharacterByIndex(0);
        if(!mainCharacter || (mainCharacter.level||1)<10){
            alert("經驗副本需要主角色等級達到10級才能開啟。");
            return;
        }
        if(!await confirmDungeonEntry(
            "經驗副本",
            "將連續進行3場戰鬥，基礎獎勵為目前全隊升級需求平均值的11%。"
        )){
            return;
        }
        const rewardExp=getExpDungeonRewardExp();
        startExpDungeonBattle(1,rewardExp);
    }
    window.v132BeginExpDungeon=beginExpDungeon;


    /* =====================================================
       17. 材料副本：雙角色20級開放，5精英+5普通，寶箱獎勵
    ===================================================== */

    async function beginMaterialDungeon(){
        if(!isDungeonAvailable("material")){
            alert("材料副本今天已經挑戰過了。");
            return;
        }
        if(!hasLevel10CharacterForDailyDungeon()){
            alert("材料副本需要任一角色達到10級才能開啟。");
            return;
        }
        if(!canAddItemToInventory(materialChestDefinition,3)){
            alert("請先預留可放入3個材料寶箱的背包空間，再挑戰材料副本。");
            return;
        }
        if(!await confirmDungeonEntry(
            "材料副本",
            "本場共有10隻怪物；通關後材料寶箱只會放進背包，不會自動開啟。"
        )){
            return;
        }

        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("礦脈守衛精英",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("礦脈守衛",level,randomElement());
            setMonsterSkillTier(monster,2,0.7);
            roster.push(monster);
        }

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            const chestCount=outcome.turnsUsed<5 ? 3 : (outcome.turnsUsed<10 ? 2 : 1);
            showMaterialDungeonRewardModal(chestCount);
        });
    }
    window.v132BeginMaterialDungeon=beginMaterialDungeon;

    /*
       ★ 修正（依照使用者要求，「副本寶箱領取時，不應該直接
       開啟，而是放進包包給玩家自主開起」）：
       原本「材料副本挑戰成功」按「直接領取」就會馬上把寶箱
       全部拆開、材料直接進背包，玩家完全沒有機會自己選時機
       開。改成：領取只把「材料寶箱」這個新物品（可堆疊）
       放進背包，真正的開箱（骰礦石/設計圖階級）延後到玩家
       在背包裡點開這個物品、按下「開啟」的那一刻才進行。
    */
    const CHEST_TIER_WEIGHTS=[
        {key:"white",label:"白階",weight:40},
        {key:"blue",label:"藍階",weight:30},
        {key:"purple",label:"紫階",weight:20},
        {key:"orange",label:"橙階",weight:10}
    ];

    const materialChestDefinition={
        id:"materialChest",
        name:"材料寶箱",
        icon:chestIcon(),
        type:"chest",
        price:0,
        stats:{}
    };

    function syncV17361ItemArt(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return; }
        inventoryItems.forEach(item=>{
            if(!item||!item.id){ return; }
            const ore=oreDefinitions.find(def=>def.id===item.id);
            if(ore){ item.icon=ore.icon; return; }
            if(item.id===materialChestDefinition.id){ item.icon=materialChestDefinition.icon; }
        });
    }
    window.v17361SyncItemArt=syncV17361ItemArt;
    syncV17361ItemArt();

    function hydrateOwnedContentPresentation(){
        hydrateOwnedTicketPresentation();
        hydrateOwnedStaticContentPresentation();
        inventoryItems.forEach(item=>{
            if(item&&item.id===materialChestDefinition.id){
                syncStaticContentPresentation(item,materialChestDefinition);
            }
        });
    }
    window.v132HydrateOwnedContentPresentation=hydrateOwnedContentPresentation;
    hydrateOwnedContentPresentation();

    function pickWeightedTier(){
        const roll=Math.random()*100;
        let acc=0;
        for(const tier of CHEST_TIER_WEIGHTS){
            acc+=tier.weight;
            if(roll<acc){ return tier.key; }
        }
        return CHEST_TIER_WEIGHTS[CHEST_TIER_WEIGHTS.length-1].key;
    }

    /* 骰「開1個材料寶箱」會拿到的內容，純計算、不碰背包。 */
    function rollMaterialChestRewards(){
        const oreTier=pickWeightedTier();
        const oreDef=getOreDefinitionByTier(oreTier);
        const oreAmount=oreTier==="orange" ? 5 : 10;

        const blueprintTier=pickWeightedTier();
        const blueprintPool=getBlueprintDefinitionsByTier(blueprintTier);
        const blueprintDef=blueprintPool[Math.floor(Math.random()*blueprintPool.length)];
        const blueprintAmount=blueprintTier==="orange" ? 5 : 10;

        return [
            {def:oreDef,amount:oreAmount},
            {def:blueprintDef,amount:blueprintAmount}
        ];
    }

    /*
       從背包實際開啟1個材料寶箱：先確認庫存夠、扣掉1個寶箱，
       再骰內容、加進背包。回傳結果字串陣列給呼叫端顯示，
       扣寶箱失敗（沒庫存）回傳null。
    */
    function openSingleMaterialChestFromInventory(){
        const rewards=rollMaterialChestRewards();
        const opened=runInventoryTransaction(()=>{
            if(!consumeStackItem("materialChest",1)){ return false; }
            return rewards.every(r=>addItemToInventory(r.def,r.amount));
        });
        rebuildInventorySlots();
        if(!opened){
            alert("背包空間不足，材料寶箱未消耗。請先整理背包。");
            return null;
        }
        saveGame();
        return rewards.map(r=>r.def.name+"×"+r.amount);
    }
    window.v132OpenMaterialChest=openSingleMaterialChestFromInventory;

    function showMaterialDungeonRewardModal(chestCount){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>材料副本挑戰成功！</h3>'+
            '<p>獲得材料寶箱 ×'+chestCount+'</p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',false)">直接領取</button>'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',true)">看廣告雙倍領取</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132ClaimMaterialDungeonReward=function(chestCount,doubled){
        function grant(){
            const finalCount=doubled ? chestCount*2 : chestCount;
            const added=addItemToInventory(materialChestDefinition,finalCount);
            rebuildInventorySlots();
            if(!added){
                alert("背包空間不足，材料寶箱尚未領取；請先整理背包後再試。");
                return;
            }
            markDungeonUsed("material");
            saveGame();
            v132CloseRewardModal();
            alert("獲得材料寶箱×"+finalCount+"，請到背包自行開啟。");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("廣告未完成，未獲得雙倍獎勵。");
            });
        }else{
            grant();
        }
    };


    /* =====================================================
       18. 裝備副本：雙角色20級開放，1BOSS+4精英，高極裝備寶箱
    ===================================================== */

    function getEquipmentDungeonComposition(){
        const playerCount=Math.max(1,getExistingPartyIndexes().length);
        return {
            playerCount:playerCount,
            bossCount:1,
            eliteCount:4,
            total:5
        };
    }
    window.v138GetEquipmentDungeonComposition=getEquipmentDungeonComposition;

    function buildEquipmentDungeonRoster(){
        const composition=getEquipmentDungeonComposition();
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<composition.bossCount;i++){
            const boss=buildEquipmentDungeonMonster(
                "裝備殿守護者",level,randomElement(),"boss"
            );
            setMonsterMaxTierSkills(boss,0.7);
            lockDungeonSkillConfiguration(boss,3);
            roster.push(boss);
        }
        for(let i=0;i<composition.eliteCount;i++){
            const monster=buildEquipmentDungeonMonster("殿前護衛精英",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            lockDungeonSkillConfiguration(monster,2);
            roster.push(monster);
        }
        return roster;
    }
    window.v132BuildEquipmentDungeonRoster=buildEquipmentDungeonRoster;

    async function beginEquipmentDungeon(){
        if(!isDungeonAvailable("equipment")){
            alert("裝備副本今天已經挑戰過了。");
            return;
        }
        if(!hasLevel10CharacterForDailyDungeon()){
            alert("裝備副本需要任一角色達到10級才能開啟。");
            return;
        }
        if(!ticketDefinitions.some(definition=>canAddItemToInventory(definition,1))){
            alert("請先預留至少1張裝備抽獎券的背包空間，再挑戰裝備副本。");
            return;
        }

        const composition=getEquipmentDungeonComposition();
        if(!await confirmDungeonEntry(
            "裝備副本",
            "固定編成：1隻BOSS與4隻精英怪，共5名敵人。"
        )){
            return;
        }

        const roster=buildEquipmentDungeonRoster();

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            showEquipmentDungeonRewardModal();
        });
    }
    window.v132BeginEquipmentDungeon=beginEquipmentDungeon;

    function showEquipmentDungeonRewardModal(){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>裝備副本挑戰成功！</h3>'+
            '<p>獲得高極裝備寶箱 ×1，請選擇1張抽獎券：</p>'+
            '<div class="v132-ticket-choices">'+
            ticketDefinitions.map(def=>
                '<button type="button" class="v132-ticket-choice" onclick="v132ClaimEquipmentDungeonReward(\''+def.id+'\',false)">'+
                '<span class="v132-ticket-icon">'+def.icon+'</span>'+
                '<span class="v132-ticket-name">'+def.name+'</span>'+
                '</button>'
            ).join("")+
            '</div>'+
            '<div class="v132-reward-actions">'+
            '<span class="v132-reward-note">選好之後可再選擇是否看廣告雙倍領取（雙倍＝同款抽獎券×2）</span>'+
            '<button type="button" class="v132-reward-back" onclick="v132LeaveEquipmentReward()">返回</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132LeaveEquipmentReward=function(){
        v132CloseRewardModal();
        showPage("dungeon");
        switchDungeonTab("daily");
    };

    window.v132ClaimEquipmentDungeonReward=async function(ticketId,doubled){
        function grant(amount){
            const definition=getTicketDefinition(ticketId);
            if(!definition){ return; }
            if(!addItemToInventory(definition,amount)){
                rebuildInventorySlots();
                alert("背包空間不足，抽獎券尚未領取；請先整理背包後再試。");
                return;
            }
            rebuildInventorySlots();
            markDungeonUsed("equipment");
            saveGame();
            v132CloseRewardModal();
            alert("獲得"+definition.name+"×"+amount+"！");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            grant(2);
            return;
        }

        if(!doubled){
            const askDouble=
                typeof window.rpgConfirm==="function" &&
                await window.rpgConfirm(
                    "要看廣告雙倍領取這張抽獎券嗎？",
                    {
                        title:"裝備副本獎勵",
                        confirmText:"觀看廣告雙倍",
                        cancelText:"直接領取"
                    }
                );
            if(askDouble){
                showRewardedAd(function(){ grant(2); },function(){
                    alert("廣告未完成，改為直接領取。");
                    grant(1);
                });
                return;
            }
        }
        grant(1);
    };


    /* =====================================================
       19. 通用獎勵彈窗（簡單覆蓋層，跟遊戲既有深色系一致）
    ===================================================== */

    function ensureRewardModalElement(){
        let modal=document.getElementById("v132RewardModal");
        if(modal){ return modal; }
        modal=document.createElement("div");
        modal.id="v132RewardModal";
        modal.className="v132-reward-modal";
        document.body.appendChild(modal);
        return modal;
    }

    window.v132ShowRewardModal=function(innerHtml){
        const modal=ensureRewardModalElement();
        modal.innerHTML=innerHtml;
        modal.classList.add("show");
    };

    window.v132CloseRewardModal=function(){
        const modal=document.getElementById("v132RewardModal");
        if(modal){ modal.classList.remove("show"); }
    };


    /* =====================================================
       20. 日常副本頁面內容（接進既有renderDungeonTabContent
           的「日常副本尚未設計完成」空殼）
    ===================================================== */

    function dungeonEntryCard(type,title,requirement,rewardPreview,onClick){
        /* ★ 改用isDungeonUsedToday()，這樣每日次數旗標關閉時，
           畫面也一定跟著顯示「可挑戰」，不會出現「按鈕是灰的、
           但其實邏輯允許挑戰」這種自相矛盾的狀態。 */
        const used=isDungeonUsedToday(type);
        return (
            '<div class="v132-dungeon-card">'+
            '<div class="v132-dungeon-card-title">'+title+
            (used ? '<span class="v132-dungeon-done">今日已完成</span>' : '')+
            '</div>'+
            '<div class="v132-dungeon-card-req">開放條件：'+requirement+'</div>'+
            '<div class="v132-dungeon-card-reward">獎勵：'+rewardPreview+'</div>'+
            '<button type="button" class="v132-dungeon-enter-btn" '+
            (used ? "disabled" : 'onclick="'+onClick+'()"')+
            '>'+(used ? "今日已挑戰" : "挑戰")+'</button>'+
            '</div>'
        );
    }

    function renderDailyDungeonList(){
        return (
            '<div class="v132-dungeon-list">'+
            dungeonEntryCard(
                "exp","經驗副本","單一角色達到10級",
                "全隊升下一級所需總經驗平均值的11%（廣告可雙倍）","v132BeginExpDungeon"
            )+
            dungeonEntryCard(
                "material","材料副本","任一角色達到10級",
                "材料寶箱×1～3（依通關回合數）","v132BeginMaterialDungeon"
            )+
            dungeonEntryCard(
                "equipment","裝備副本","任一角色達到10級",
                "高極裝備寶箱×1（自選抽獎券）","v132BeginEquipmentDungeon"
            )+
            '<div style="font-size:11px;color:#7a6f5c;margin-top:6px;">'+
            (DUNGEON_DAILY_LIMIT_ENABLED
                ? '每個副本每日只能挑戰1次，挑戰失敗不會扣除次數，'+
                  '領取獎勵之後才會計入今日已完成。'
                : '⚙️ 測試模式：每日挑戰次數限制目前為關閉狀態，'+
                  '所有副本都可以無限次重複挑戰。')+
            '</div>'+
            '</div>'
        );
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){
                return renderDailyDungeonList();
            }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }

})();


/* bundled source: js/28-v133-economy-rebalance.js */
/*
   V133 — 經濟／養成重新設計 owner
   EXP仍只進既有 sharedExp／角色 exp；自然充能只保存時間戳與解鎖狀態。
*/
(function installV133EconomyRebalance(){
    "use strict";

    const MAX_CHARACTER_LEVEL=100;
    const DAY_MS=24*60*60*1000;
    const CHARGE_MAX_MS=72*60*60*1000;
    const GROWTH_STATE_KEY=window.FourSymbolsAccountSave.accountKey("exp-pool-growth-state");

    const TRAINING_ZONE_EXP_PROFILES=[
        {minLevel:1,maxLevel:10,key:"forest",averageGroupSize:2,fallbackAverageExp:175},
        {minLevel:11,maxLevel:20,key:"desert",averageGroupSize:2,fallbackAverageExp:1085},
        {minLevel:21,maxLevel:30,key:"ice",averageGroupSize:4.5,fallbackAverageExp:4528},
        {minLevel:31,maxLevel:40,key:"zone4",averageGroupSize:4.5,fallbackAverageExp:6484},
        {minLevel:41,maxLevel:50,key:"zone5",averageGroupSize:4.5,fallbackAverageExp:8321},
        {minLevel:51,maxLevel:60,key:"zone6",averageGroupSize:4.5,fallbackAverageExp:10159},
        {minLevel:61,maxLevel:70,key:"zone7",averageGroupSize:4.5,fallbackAverageExp:11996},
        {minLevel:71,maxLevel:80,key:"zone8",averageGroupSize:4.5,fallbackAverageExp:11760},
        {minLevel:81,maxLevel:90,key:"zone9",averageGroupSize:4.5,fallbackAverageExp:13335},
        {minLevel:91,maxLevel:99,key:"zone10",averageGroupSize:4.5,fallbackAverageExp:14910}
    ];
    const TARGET_BATTLE_ANCHORS=[
        {level:1,battles:3},{level:10,battles:15},{level:20,battles:45},
        {level:30,battles:100},{level:40,battles:250},{level:50,battles:400},
        {level:60,battles:650},{level:70,battles:900},{level:80,battles:1200},
        {level:90,battles:1700},{level:95,battles:2600},{level:98,battles:3500},
        {level:99,battles:4000}
    ];

    /* Lv1→20 快速期維持既有靜態需求；從 Lv20→21 起，expNext 唯一依據
       為「該級練功區正式平均戰鬥 EXP × TARGET_BATTLE_ANCHORS」。 */
    const NEWCOMER_EXP_REQUIREMENT_ANCHORS=[
        {level:1,value:300},{level:5,value:600},{level:10,value:1200},
        {level:15,value:2500},{level:20,value:8000}
    ];
    const NATURAL_CHARGE_LEVELS_PER_DAY=[
        {level:20,value:1.30},{level:39,value:1.25},{level:49,value:1.02},
        {level:50,value:1.00},{level:69,value:.80},{level:84,value:.60},
        {level:94,value:.43},{level:99,value:.32}
    ];
    const DAILY_QUEST_LEVELS_PER_DAY=[
        {level:20,value:.85},{level:39,value:.82},{level:49,value:.70},
        {level:50,value:.69},{level:69,value:.52},{level:84,value:.40},
        {level:94,value:.30},{level:99,value:.24}
    ];
    const DAILY_TOTAL_TARGETS=[
        {level:20,value:3.00},{level:39,value:3.00},{level:49,value:2.40},
        {level:50,value:2.36},{level:60,value:2.15},{level:69,value:2.00},
        {level:70,value:1.97},{level:80,value:1.72},{level:84,value:1.60},
        {level:85,value:1.57},{level:90,value:1.40},{level:94,value:1.30},
        {level:95,value:1.27},{level:99,value:1.00}
    ];
    /* 這三筆只在帳號第一次、且尚未Lv20時各領一次，讓新手內容而非
       重複農怪承擔約6,000 EXP；其餘仍由正常戰鬥／原任務獎勵補足。 */
    const NEWCOMER_DAILY_BONUSES={win3:2000,skills5:1500,kill10:2500};

    window.v133MaxLevel=MAX_CHARACTER_LEVEL;

    function interpolateAnchors(level,anchors){
        const safe=Math.max(anchors[0].level,Math.min(anchors[anchors.length-1].level,Number(level)||anchors[0].level));
        if(safe<=anchors[0].level){ return anchors[0].value; }
        for(let i=1;i<anchors.length;i++){
            const right=anchors[i];
            if(safe>right.level){ continue; }
            const left=anchors[i-1];
            const t=(safe-left.level)/(right.level-left.level);
            return left.value+(right.value-left.value)*t;
        }
        return anchors[anchors.length-1].value;
    }

    function getCurveMonsterRankMultiplier(monster){
        if(monster&&Number.isFinite(Number(monster.v141CurveEliteRate))){
            const rate=Math.max(0,Math.min(1,Number(monster.v141CurveEliteRate)));
            return 1+rate*.5;
        }
        let rank="regular";
        if(typeof getMonsterRank==="function"){ rank=getMonsterRank(monster); }
        else if(monster&&monster.rank){ rank=monster.rank; }
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    function getTrainingExpProfile(level){
        const safeLevel=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        return TRAINING_ZONE_EXP_PROFILES.find(profile=>safeLevel>=profile.minLevel&&safeLevel<=profile.maxLevel)||TRAINING_ZONE_EXP_PROFILES[9];
    }
    function getTrainingZoneRoster(profile){
        try{
            if(typeof zoneConfig==="undefined"||!zoneConfig[profile.key]){ return null; }
            const source=zoneConfig[profile.key].monsters;
            const roster=typeof source==="function"?source():source;
            return Array.isArray(roster)&&roster.length?roster:null;
        }catch(_){ return null; }
    }
    function getTrainingZoneAverageExpForLevel(level){
        const profile=getTrainingExpProfile(level);
        const roster=getTrainingZoneRoster(profile);
        if(!roster){ return profile.fallbackAverageExp; }
        const average=roster.reduce((sum,monster)=>{
            if(!monster){ return sum; }
            const formalBase=typeof window.v173GetFormalMonsterBaseExp==="function"
                ?window.v173GetFormalMonsterBaseExp(monster)
                :Math.max(1,Math.floor((Number(monster.level)||1)*35));
            return sum+formalBase*getCurveMonsterRankMultiplier(monster);
        },0)/roster.length;
        return Math.max(1,Math.round(average*profile.averageGroupSize));
    }
    function getTargetBattlesForLevel(level){
        const safe=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        if(safe<=TARGET_BATTLE_ANCHORS[0].level){ return TARGET_BATTLE_ANCHORS[0].battles; }
        for(let i=1;i<TARGET_BATTLE_ANCHORS.length;i++){
            const right=TARGET_BATTLE_ANCHORS[i];
            if(safe>right.level){ continue; }
            const left=TARGET_BATTLE_ANCHORS[i-1];
            const t=(safe-left.level)/(right.level-left.level);
            return Math.max(1,Math.round(left.battles+(right.battles-left.battles)*t));
        }
        return TARGET_BATTLE_ANCHORS[TARGET_BATTLE_ANCHORS.length-1].battles;
    }
    function getExpNextForLevel(level){
        const safe=Math.min(99,Math.max(1,Math.floor(Number(level)||1)));
        if(safe<20){
            return Math.max(1,Math.round(interpolateAnchors(safe,NEWCOMER_EXP_REQUIREMENT_ANCHORS)));
        }
        const averageBattleExp=getTrainingZoneAverageExpForLevel(safe);
        const targetBattles=getTargetBattlesForLevel(safe);
        return Math.max(1,Math.round(averageBattleExp*targetBattles));
    }
    window.v133GetExpNextForLevel=getExpNextForLevel;
    window.v139GetTrainingZoneAverageExpForLevel=getTrainingZoneAverageExpForLevel;
    window.v139GetTargetBattlesForLevel=getTargetBattlesForLevel;

    function getHighestCreatedCharacterLevel(){
        if(typeof getExistingPartyIndexes!=="function"){ return 1; }
        return getExistingPartyIndexes().reduce((max,index)=>{
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            return character?Math.max(max,Number(character.level)||1):max;
        },1);
    }
    window.v133GetHighestCreatedCharacterLevel=getHighestCreatedCharacterLevel;

    function hasNonMaxCharacter(){
        return typeof getExistingPartyIndexes==="function"&&getExistingPartyIndexes().some(index=>{
            const character=getPartyCharacterByIndex(index);
            return !!(character&&(Number(character.level)||1)<MAX_CHARACTER_LEVEL);
        });
    }
    function getNaturalChargeLevelsPerDay(level){
        return (Number(level)||1)<20?0:Math.max(0,interpolateAnchors(level,NATURAL_CHARGE_LEVELS_PER_DAY));
    }
    function getDailyQuestLevelsPerDay(level){
        return (Number(level)||1)<20?0:Math.max(0,interpolateAnchors(level,DAILY_QUEST_LEVELS_PER_DAY));
    }
    function getDailyTotalTarget(level){
        return (Number(level)||1)<20?0:Math.max(0,interpolateAnchors(level,DAILY_TOTAL_TARGETS));
    }
    window.v173GetNaturalChargeLevelsPerDay=getNaturalChargeLevelsPerDay;
    window.v173GetDailyQuestLevelsPerDay=getDailyQuestLevelsPerDay;
    window.v173GetDailyTotalTarget=getDailyTotalTarget;

    function getExpPoolCatchUpMultiplierForLevel(level){
        const gap=Math.max(0,getHighestCreatedCharacterLevel()-Math.max(1,Number(level)||1));
        if(gap>=30){ return 1.50; }
        if(gap>=20){ return 1.30; }
        if(gap>=10){ return 1.15; }
        return 1.00;
    }
    function getCharacterPartyIndex(character){
        if(!character){ return -1; }
        if(typeof getExistingPartyIndexes==="function"&&typeof getPartyCharacterByIndex==="function"){
            const index=getExistingPartyIndexes().slice(0,3).find(value=>getPartyCharacterByIndex(value)===character);
            if(Number.isInteger(index)){ return index; }
        }
        if(typeof player2!=="undefined"&&character===player2){ return 1; }
        if(typeof player3!=="undefined"&&character===player3){ return 2; }
        if(typeof player!=="undefined"&&character===player){ return 0; }
        return -1;
    }
    function getAdditionalCharacterPoolMultiplier(character,level){
        const safeLevel=Math.max(1,Number(level)||Number(character&&character.level)||1);
        if(safeLevel>=20){ return 1; }
        const index=getCharacterPartyIndex(character);
        if(index===2){ return 2.00; }
        if(index===1){ return 1.50; }
        return 1;
    }
    function getExpPoolCatchUpMultiplierAtLevel(character,level){
        const slotMultiplier=getAdditionalCharacterPoolMultiplier(character,level);
        if(slotMultiplier>1){ return slotMultiplier; }
        return getExpPoolCatchUpMultiplierForLevel(level);
    }
    function getExpPoolCatchUpMultiplier(character){
        return getExpPoolCatchUpMultiplierAtLevel(character,character&&character.level);
    }
    function getDirectCatchUpExpMultiplier(character){
        if(!character||(Number(character.level)||1)>=20){ return 1; }
        const index=getCharacterPartyIndex(character);
        if(index===2){ return 3; }
        if(index===1){ return 2; }
        return 1;
    }
    window.v173GetExpPoolCatchUpMultiplierForLevel=getExpPoolCatchUpMultiplierForLevel;
    window.v173GetExpPoolCatchUpMultiplier=getExpPoolCatchUpMultiplier;
    window.v173GetDirectCatchUpExpMultiplier=getDirectCatchUpExpMultiplier;

    function loadGrowthState(){
        try{
            const raw=JSON.parse(localStorage.getItem(GROWTH_STATE_KEY)||"{}");
            return {
                initialized:raw.initialized===true,
                unlocked:raw.unlocked===true,
                lastAt:Number.isFinite(Number(raw.lastAt))?Math.max(0,Number(raw.lastAt)):0,
                noticeShown:raw.noticeShown===true,
                lastCapped:raw.lastCapped===true,
                newcomerRewards:raw.newcomerRewards&&typeof raw.newcomerRewards==="object"?Object.assign({},raw.newcomerRewards):{}
            };
        }catch(_){
            return {initialized:false,unlocked:false,lastAt:0,noticeShown:false,lastCapped:false,newcomerRewards:{}};
        }
    }
    const growthState=loadGrowthState();
    function persistGrowthState(){
        try{ localStorage.setItem(GROWTH_STATE_KEY,JSON.stringify(growthState)); }catch(_){ }
    }
    function resetGrowthStateForNoCharacter(){
        growthState.initialized=false;
        growthState.unlocked=false;
        growthState.lastAt=0;
        growthState.noticeShown=false;
        growthState.lastCapped=false;
        growthState.newcomerRewards={};
        persistGrowthState();
    }
    function showChargeUnlockNotice(){
        if(growthState.noticeShown){ return; }
        growthState.noticeShown=true;
        persistGrowthState();
        alert("經驗池持續充能已解鎖\n即使不掛機，經驗池也會持續累積修為。");
    }
    function ensureExpPoolChargeUnlocked(now,showNotice){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const hasCharacter=typeof getExistingPartyIndexes==="function"&&getExistingPartyIndexes().length>0;
        if(!hasCharacter){
            if(growthState.initialized||growthState.unlocked||growthState.lastAt>0){ resetGrowthStateForNoCharacter(); }
            return false;
        }
        const highest=getHighestCreatedCharacterLevel();
        if(!growthState.initialized){
            growthState.initialized=true;
            growthState.lastAt=timestamp;
            growthState.unlocked=highest>=20;
            growthState.lastCapped=false;
            persistGrowthState();
            if(growthState.unlocked&&showNotice){ showChargeUnlockNotice(); }
            return growthState.unlocked;
        }
        if(!growthState.unlocked&&highest<20){
            growthState.lastAt=timestamp;
            persistGrowthState();
            return false;
        }
        if(!growthState.unlocked&&highest>=20){
            growthState.unlocked=true;
            growthState.lastAt=timestamp;
            growthState.lastCapped=false;
            persistGrowthState();
            if(showNotice){ showChargeUnlockNotice(); }
            return true;
        }
        if(!(growthState.lastAt>0)){
            growthState.lastAt=timestamp;
            persistGrowthState();
        }
        if(showNotice&&!growthState.noticeShown){ showChargeUnlockNotice(); }
        return growthState.unlocked;
    }
    window.v173EnsureExpPoolChargeUnlocked=ensureExpPoolChargeUnlocked;

    function getChargePreview(now){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const highest=getHighestCreatedCharacterLevel();
        if(!growthState.initialized||!growthState.unlocked||highest<20||!hasNonMaxCharacter()){
            return {gain:0,elapsedMs:0,capped:false,levelsPerDay:0,referenceLevel:highest};
        }
        const rawElapsed=timestamp>=growthState.lastAt?timestamp-growthState.lastAt:0;
        const elapsed=Math.min(CHARGE_MAX_MS,Math.max(0,rawElapsed));
        const referenceLevel=Math.min(99,Math.max(20,highest));
        const levelsPerDay=getNaturalChargeLevelsPerDay(referenceLevel);
        const gain=Math.max(0,Math.floor(getExpNextForLevel(referenceLevel)*levelsPerDay*(elapsed/DAY_MS)));
        return {gain:gain,elapsedMs:elapsed,capped:rawElapsed>=CHARGE_MAX_MS,levelsPerDay:levelsPerDay,referenceLevel:referenceLevel};
    }
    window.v173PreviewExpPoolCharge=getChargePreview;

    function getAvailableExpPool(now){
        return Math.max(0,Number(typeof sharedExp!=="undefined"?sharedExp:0)||0)+getChargePreview(now).gain;
    }
    window.v173GetAvailableExpPool=getAvailableExpPool;

    function settleExpPoolCharge(now){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const wasInitialized=growthState.initialized;
        if(!ensureExpPoolChargeUnlocked(timestamp,false)){ return 0; }
        if(!wasInitialized){ return 0; }
        /* 裝置時間倒退時只拒絕這段時間，不把權威基準往回移；否則先
           倒退再調回正確時間會再次產生同一段自然充能。 */
        if(timestamp<growthState.lastAt){
            growthState.lastCapped=false;
            persistGrowthState();
            return 0;
        }
        if(!hasNonMaxCharacter()){
            growthState.lastAt=timestamp;
            growthState.lastCapped=false;
            persistGrowthState();
            return 0;
        }
        const preview=getChargePreview(timestamp);
        growthState.lastAt=timestamp;
        growthState.lastCapped=preview.capped;
        persistGrowthState();
        if(preview.gain>0){
            sharedExp=Math.max(0,(Number(sharedExp)||0)+preview.gain);
            if(typeof saveGame==="function"){ saveGame(); }
        }
        return preview.gain;
    }
    window.v173SettleExpPoolCharge=settleExpPoolCharge;
    window.v173GetExpPoolChargeState=function(){
        return {
            initialized:growthState.initialized,unlocked:growthState.unlocked,lastAt:growthState.lastAt,
            noticeShown:growthState.noticeShown,lastCapped:growthState.lastCapped,maxHours:72
        };
    };

    function getDailyGrowthRewardBreakdown(level){
        const raw=Number(level)||getHighestCreatedCharacterLevel();
        if(raw<20){ return {totalExp:0,taskExp:0,chestExp:0,levelsPerDay:0}; }
        const referenceLevel=Math.min(99,Math.max(20,Math.floor(raw)));
        const levelsPerDay=getDailyQuestLevelsPerDay(referenceLevel);
        const totalExp=Math.max(0,Math.round(getExpNextForLevel(referenceLevel)*levelsPerDay));
        const taskExp=Math.round(totalExp*.70);
        return {totalExp:totalExp,taskExp:taskExp,chestExp:Math.max(0,totalExp-taskExp),levelsPerDay:levelsPerDay};
    }
    window.v173GetDailyGrowthRewardBreakdown=getDailyGrowthRewardBreakdown;

    function grantNewcomerDailyBonus(questId){
        const bonus=Math.max(0,Number(NEWCOMER_DAILY_BONUSES[questId])||0);
        if(!bonus||getHighestCreatedCharacterLevel()>=20||growthState.newcomerRewards[questId]){ return 0; }
        growthState.newcomerRewards[questId]=true;
        persistGrowthState();
        sharedExp=Math.max(0,(Number(sharedExp)||0)+bonus);
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof window.v141ShowBlackGoldReward==="function"){
            window.v141ShowBlackGoldReward({exp:bonus,gold:0,items:[]});
        }
        return bonus;
    }
    if(typeof claimDailyQuest==="function"){
        const originalClaimDailyQuest=claimDailyQuest;
        claimDailyQuest=function(questId){
            const wasClaimed=!!(typeof dailyQuestState!=="undefined"&&dailyQuestState.claimed&&dailyQuestState.claimed[questId]);
            const result=originalClaimDailyQuest.apply(this,arguments);
            const isClaimed=!!(typeof dailyQuestState!=="undefined"&&dailyQuestState.claimed&&dailyQuestState.claimed[questId]);
            if(!wasClaimed&&isClaimed){ grantNewcomerDailyBonus(questId); }
            return result;
        };
    }

    /* Late UI/reward bridge: V131 preview and V141 quest UI are loaded after this
       economy owner. It installs once when those existing owners become ready. */
    const lateState={
        installed:false,previewWrapped:false,chestWrapped:false,
        rewardBases:new WeakMap(),visualGain:null,attempts:0
    };

    function discountedPreviewCost(character,count){
        if(!character||count<=0){ return 0; }
        let level=Math.max(1,Math.floor(Number(character.level)||1));
        let exp=Math.max(0,Number(character.exp)||0);
        let expNext=Math.max(1,Number(character.expNext)||getExpNextForLevel(level));
        let total=0;
        for(let i=0;i<count&&level<MAX_CHARACTER_LEVEL;i++){
            const need=Math.max(1,expNext-exp);
            total+=Math.ceil(need/getExpPoolCatchUpMultiplierAtLevel(character,level));
            level++;
            exp=0;
            expNext=getExpNextForLevel(level);
        }
        return total;
    }
    window.v173GetDiscountedPreviewCost=discountedPreviewCost;

    function readPreviewCounts(){
        const counts={0:0,1:0,2:0};
        const container=typeof document!=="undefined"?document.getElementById("expDistributeList"):null;
        if(!container||typeof getExistingPartyIndexes!=="function"){ return counts; }
        const rows=Array.from(container.querySelectorAll(".v131-exp-row"));
        getExistingPartyIndexes().slice(0,3).forEach((index,position)=>{
            const character=getPartyCharacterByIndex(index);
            const text=rows[position]&&rows[position].querySelector(".v131-exp-level")?.textContent||"";
            const match=text.match(/→\s*Lv\.(\d+)/);
            const target=match?Number(match[1]):Number(character&&character.level)||1;
            counts[index]=Math.max(0,target-(Number(character&&character.level)||1));
        });
        return counts;
    }
    function totalDiscountedPreviewCost(counts){
        if(typeof getExistingPartyIndexes!=="function"){ return 0; }
        return getExistingPartyIndexes().slice(0,3).reduce((sum,index)=>
            sum+discountedPreviewCost(getPartyCharacterByIndex(index),Math.max(0,Number(counts[index])||0)),0
        );
    }

    function decorateExpPoolDistributionUi(){
        if(typeof document==="undefined"||typeof getExistingPartyIndexes!=="function"){ return; }
        const container=document.getElementById("expDistributeList");
        if(!container){ return; }
        const indexes=getExistingPartyIndexes().slice(0,3);
        const rows=Array.from(container.querySelectorAll(".v131-exp-row"));
        const counts=readPreviewCounts();
        indexes.forEach((index,position)=>{
            const row=rows[position];
            const character=getPartyCharacterByIndex(index);
            if(!row||!character){ return; }
            let meta=row.querySelector(".v173-exp-row-meta");
            if(!meta){
                meta=document.createElement("div");
                meta.className="v173-exp-row-meta";
                const levelNode=row.querySelector(".v131-exp-level");
                (levelNode||row.firstChild)?.insertAdjacentElement?.("afterend",meta);
                if(!meta.parentNode){ row.appendChild(meta); }
            }
            const multiplier=getExpPoolCatchUpMultiplier(character);
            const currentExp=Math.max(0,Math.floor(Number(character.exp)||0));
            const next=Math.max(1,Math.floor(Number(character.expNext)||getExpNextForLevel(character.level)));
            meta.innerHTML="目前 "+currentExp.toLocaleString("zh-TW")+" / "+next.toLocaleString("zh-TW")+" EXP"+
                (multiplier>1?'<b>追趕加成 ×'+multiplier.toFixed(2)+"</b>":"");

            const previewButton=row.querySelector(".v131-exp-preview-btn");
            if(previewButton){
                const candidate=Object.assign({},counts);
                candidate[index]=(candidate[index]||0)+1;
                const can=(Number(character.level)||1)+(counts[index]||0)<MAX_CHARACTER_LEVEL&&
                    totalDiscountedPreviewCost(candidate)<=getAvailableExpPool(Date.now());
                previewButton.disabled=!can;
            }
        });
        const summary=container.querySelector(".v131-exp-preview-summary");
        if(summary){
            const cost=totalDiscountedPreviewCost(counts);
            summary.textContent="本次分配："+cost.toLocaleString("zh-TW")+" EXP";
        }
        if(typeof window.v146SyncCharacterAttentionDots==="function"){
            window.v146SyncCharacterAttentionDots();
        }
    }
    window.v173DecorateExpPoolDistributionUi=decorateExpPoolDistributionUi;

    function v173CaptureExpPoolViewport(){
        if(typeof document==="undefined"){ return null; }
        const scroller=document.getElementById("characterTabContent");
        if(!scroller){ return null; }
        return {
            scroller,
            top:Math.max(0,Number(scroller.scrollTop)||0),
            left:Math.max(0,Number(scroller.scrollLeft)||0)
        };
    }
    function v173RestoreExpPoolViewport(snapshot){
        if(!snapshot||!snapshot.scroller){ return; }
        const restore=function(){
            const scroller=snapshot.scroller;
            if(!scroller||scroller.isConnected===false){ return; }
            scroller.scrollTop=snapshot.top;
            scroller.scrollLeft=snapshot.left;
        };
        restore();
        if(typeof requestAnimationFrame==="function"){
            requestAnimationFrame(function(){
                restore();
                requestAnimationFrame(restore);
            });
        }else if(typeof setTimeout==="function"){
            setTimeout(restore,0);
        }
    }
    function v173BlurExpPoolAction(){
        if(typeof document==="undefined"){ return; }
        const active=document.activeElement;
        if(active&&typeof active.blur==="function"&&active.matches&&
            active.matches("#homeExpPoolCard .v131-exp-preview-btn, #homeExpPoolCard .v131-exp-confirm, #homeExpPoolCard .v131-exp-back")){
            active.blur();
        }
    }
    function v173ScheduleExpPoolDecoration(snapshot){
        v173RestoreExpPoolViewport(snapshot);
        const finish=function(){
            decorateExpPoolDistributionUi();
            v173RestoreExpPoolViewport(snapshot);
        };
        if(typeof setTimeout==="function"){ setTimeout(finish,0); }
        else{ finish(); }
    }

    function wrapExpPreviewForCatchUp(){
        if(lateState.previewWrapped||typeof window.v131PreviewExpLevel!=="function"||typeof window.v131ConfirmExpPreview!=="function"){ return; }
        lateState.previewWrapped=true;
        const previousPreview=window.v131PreviewExpLevel;
        const previousConfirm=window.v131ConfirmExpPreview;
        const previousCancel=window.v131CancelExpPreview;
        window.v131PreviewExpLevel=function(index){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
            const counts=readPreviewCounts();
            const candidate=Object.assign({},counts);
            candidate[index]=(candidate[index]||0)+1;
            const discounted=totalDiscountedPreviewCost(candidate);
            const actual=Math.max(0,Number(sharedExp)||0);
            if(discounted>actual){
                alert("經驗池不足，還需要 "+(discounted-actual).toLocaleString("zh-TW")+" EXP。");
                return false;
            }
            sharedExp=Number.MAX_SAFE_INTEGER/32;
            try{ return previousPreview.apply(this,arguments); }
            finally{
                sharedExp=actual;
                v173ScheduleExpPoolDecoration(viewport);
            }
        };
        window.v131ConfirmExpPreview=async function(){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
            const counts=readPreviewCounts();
            const discounted=totalDiscountedPreviewCost(counts);
            const actual=Math.max(0,Number(sharedExp)||0);
            if(discounted<=0||discounted>actual){
                if(discounted>actual){ alert("經驗池不足，無法完成本次分配。"); }
                return false;
            }
            const levelCount=Object.values(counts).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
            const confirmMessage="確定要消耗 "+discounted.toLocaleString("zh-TW")+" EXP，完成 "+levelCount+" 次升級嗎？";
            if(typeof window.rpgConfirm!=="function"){
                v173ScheduleExpPoolDecoration(viewport);
                return false;
            }
            const approved=await window.rpgConfirm(confirmMessage,{
                title:"確認經驗池升級",
                confirmText:"確定升級",
                cancelText:"返回"
            });
            if(!approved){
                v173ScheduleExpPoolDecoration(viewport);
                return false;
            }
            let completed=false;
            sharedExp=Number.MAX_SAFE_INTEGER/32;
            try{
                const result=previousConfirm.apply(this,arguments);
                completed=true;
                return result;
            }finally{
                sharedExp=completed?Math.max(0,actual-discounted):actual;
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                v173ScheduleExpPoolDecoration(viewport);
            }
        };
        if(typeof previousCancel==="function"){
            window.v131CancelExpPreview=function(){
                const viewport=v173CaptureExpPoolViewport();
                v173BlurExpPoolAction();
                try{ return previousCancel.apply(this,arguments); }
                finally{ v173ScheduleExpPoolDecoration(viewport); }
            };
        }
    }

    function syncDailyQuestGrowthRewards(){
        if(typeof dailyQuestDefinitions==="undefined"||!Array.isArray(dailyQuestDefinitions)||!window.v141UpdateNotificationDots){ return; }
        const breakdown=getDailyGrowthRewardBreakdown(getHighestCreatedCharacterLevel());
        const quests=dailyQuestDefinitions.filter(quest=>quest&&quest.reward&&typeof quest.reward==="object");
        if(!quests.length){ return; }
        const each=Math.floor(breakdown.taskExp/quests.length);
        let remainder=breakdown.taskExp-each*quests.length;
        quests.forEach(quest=>{
            const reward=quest.reward;
            if(!lateState.rewardBases.has(reward)){
                lateState.rewardBases.set(reward,Math.max(0,Number(reward.exp)||0));
            }
            const extra=each+(remainder>0?1:0);
            if(remainder>0){ remainder--; }
            reward.exp=lateState.rewardBases.get(reward)+extra;
        });
    }
    window.v173SyncDailyQuestGrowthRewards=syncDailyQuestGrowthRewards;

    function wrapDailyFinalChestBonus(){
        if(lateState.chestWrapped||typeof window.v141ClaimQuestMilestone!=="function"){ return; }
        lateState.chestWrapped=true;
        const previous=window.v141ClaimQuestMilestone;
        window.v141ClaimQuestMilestone=function(type,threshold){
            const before=Math.max(0,Number(sharedExp)||0);
            const result=previous.apply(this,arguments);
            if(type==="daily"&&Number(threshold)===100&&Math.max(0,Number(sharedExp)||0)>before&&getHighestCreatedCharacterLevel()>=20){
                const bonus=getDailyGrowthRewardBreakdown(getHighestCreatedCharacterLevel()).chestExp;
                if(bonus>0){
                    sharedExp+=bonus;
                    if(typeof updateUI==="function"){ updateUI(); }
                    if(typeof saveGame==="function"){ saveGame(); }
                    if(typeof window.v141ShowBlackGoldReward==="function"){
                        window.v141ShowBlackGoldReward({exp:bonus,gold:0,items:[]});
                    }
                }
            }
            return result;
        };
    }

    function ensureChargeUi(){
        if(typeof document==="undefined"){ return null; }
        const card=document.getElementById("homeExpPoolCard");
        if(!card){ return null; }
        let panel=document.getElementById("v173ExpPoolChargeStatus");
        if(!panel){
            panel=document.createElement("section");
            panel.id="v173ExpPoolChargeStatus";
            panel.className="v173-exp-charge-status";
            panel.innerHTML='<div><b id="v173ExpChargeTitle"></b><span id="v173ExpChargeRate"></span></div>'+
                '<small id="v173ExpChargeText"></small><div class="v173-exp-charge-floats" aria-hidden="true"></div>';
            const hero=card.querySelector(".exp-pool-hero");
            if(hero){ hero.insertAdjacentElement("afterend",panel); }
            else{ card.insertBefore(panel,card.firstChild||null); }
        }
        return panel;
    }

    function syncChargeUi(animate){
        const panel=ensureChargeUi();
        const card=typeof document!=="undefined"?document.getElementById("homeExpPoolCard"):null;
        if(!panel||!card||card.style.display==="none"){ lateState.visualGain=null; return; }
        const state=window.v173GetExpPoolChargeState();
        const title=document.getElementById("v173ExpChargeTitle");
        const rate=document.getElementById("v173ExpChargeRate");
        const text=document.getElementById("v173ExpChargeText");
        const highest=getHighestCreatedCharacterLevel();
        if(highest<20||!state.unlocked){
            if(title){ title.textContent="Lv20 解鎖持續充能"; }
            if(rate){ rate.textContent="未啟動"; }
            if(text){ text.textContent="達到 Lv20 後，即使離線也會持續累積經驗池。"; }
            lateState.visualGain=null;
            return;
        }
        const preview=getChargePreview(Date.now());
        if(title){ title.textContent=preview.capped?"充能已滿":"持續充能中"; }
        if(rate){ rate.textContent="約 "+Math.round(preview.levelsPerDay*100)+"% 等級進度／日"; }
        if(text){ text.textContent="自然充能最多累積 72 小時；在線、離線都會計算。"; }
        const value=document.getElementById("sharedExpValue");
        if(value){ value.textContent=Math.floor((Number(sharedExp)||0)+preview.gain).toLocaleString("zh-TW"); }
        if(animate&&lateState.visualGain!==null&&preview.gain>lateState.visualGain){
            const delta=preview.gain-lateState.visualGain;
            const layer=panel.querySelector(".v173-exp-charge-floats");
            if(layer&&delta>0){
                const float=document.createElement("span");
                float.className="v173-exp-charge-float";
                float.textContent="+"+delta.toLocaleString("zh-TW")+" EXP";
                layer.appendChild(float);
                if(typeof setTimeout==="function"){ setTimeout(()=>float.remove(),1500); }
            }
        }
        lateState.visualGain=preview.gain;
    }
    window.v173SyncExpPoolChargeUi=syncChargeUi;

    function decorateDailyFinalChest(){
        if(typeof document==="undefined"){ return; }
        const daily=document.getElementById("questTabBtnDaily");
        if(!daily||daily.getAttribute("aria-selected")!=="true"){ return; }
        const bonus=getDailyGrowthRewardBreakdown(getHighestCreatedCharacterLevel()).chestExp;
        document.querySelectorAll("#homeFeatureModal .quest-milestone").forEach(node=>{
            if(node.querySelector(".quest-milestone-percent")?.textContent?.trim()!=="100%"){ return; }
            const small=node.querySelector("small");
            if(!small){ return; }
            if(!small.dataset.v173BaseLabel){ small.dataset.v173BaseLabel=small.textContent||""; }
            small.textContent=small.dataset.v173BaseLabel+(bonus>0?"＋"+bonus.toLocaleString("zh-TW")+"EXP":" ");
        });
    }

    function installLateGrowthEnhancements(){
        if(lateState.installed){ return; }
        const ready=typeof window.v131PreviewExpLevel==="function"&&
            typeof window.v141ClaimQuestMilestone==="function"&&
            typeof window.v141UpdateNotificationDots==="function";
        if(!ready){
            lateState.attempts++;
            if(lateState.attempts<200&&typeof setTimeout==="function"){ setTimeout(installLateGrowthEnhancements,50); }
            return;
        }
        lateState.installed=true;
        wrapExpPreviewForCatchUp();
        wrapDailyFinalChestBonus();
        syncDailyQuestGrowthRewards();
        decorateExpPoolDistributionUi();
        syncChargeUi(false);
        decorateDailyFinalChest();
        /* 4秒 timer 只重繪／計算畫面，從不直接增加 sharedExp。 */
        if(typeof setInterval==="function"){
            setInterval(()=>{
                syncDailyQuestGrowthRewards();
                decorateExpPoolDistributionUi();
                syncChargeUi(true);
                decorateDailyFinalChest();
            },4000);
        }
    }

    window.v139GetExpCurveAudit=function(){
        const checkpoints=[10,20,30,40,49,50,60,70,80,90,95,98,99].map(level=>{
            const averageBattleExp=getTrainingZoneAverageExpForLevel(level);
            const targetBattles=getTargetBattlesForLevel(level);
            const expNext=getExpNextForLevel(level);
            const theoreticalBattles=averageBattleExp>0?expNext/averageBattleExp:0;
            const differencePercent=targetBattles>0?((theoreticalBattles-targetBattles)/targetBattles)*100:0;
            return {
                level:level,averageBattleExp:averageBattleExp,targetBattles:targetBattles,expNext:expNext,
                theoreticalBattles:theoreticalBattles,differencePercent:differencePercent,
                naturalLevelsPerDay:getNaturalChargeLevelsPerDay(level),dailyQuestLevelsPerDay:getDailyQuestLevelsPerDay(level),
                dailyTotalTarget:getDailyTotalTarget(level)
            };
        });
        let totalEffectiveBattles=0;
        for(let level=1;level<MAX_CHARACTER_LEVEL;level++){ totalEffectiveBattles+=getTargetBattlesForLevel(level); }
        let beginnerTotalExp=0;
        for(let level=1;level<20;level++){ beginnerTotalExp+=getExpNextForLevel(level); }
        return {totalEffectiveBattles:totalEffectiveBattles,beginnerTotalExp:beginnerTotalExp,checkpoints:checkpoints};
    };
    window.v173GetBeginnerGrowthAudit=function(){
        let total=0;
        const requirements=[];
        for(let level=1;level<20;level++){
            const exp=getExpNextForLevel(level);
            total+=exp;
            requirements.push({level:level,expNext:exp});
        }
        return {totalExpTo20:total,requirements:requirements,newcomerOneTimeExp:6000};
    };

    function recalibrateCharacterExpNext(character){
        if(!character){ return; }
        character.level=Math.min(MAX_CHARACTER_LEVEL,Math.max(1,Math.floor(Number(character.level)||1)));
        if(character.level>=MAX_CHARACTER_LEVEL){ character.exp=0; }
        character.expNext=getExpNextForLevel(character.level);
    }


    function grantDirectCatchUpExp(character,baseExp){
        if(!character||(Number(character.level)||1)>=MAX_CHARACTER_LEVEL){ return {baseExp:0,multiplier:1,grantedExp:0}; }
        const raw=Math.max(0,Math.floor(Number(baseExp)||0));
        const multiplier=getDirectCatchUpExpMultiplier(character);
        const granted=Math.max(0,Math.floor(raw*multiplier));
        if(granted<=0){ return {baseExp:raw,multiplier:multiplier,grantedExp:0}; }
        character.exp=Math.max(0,Number(character.exp)||0)+granted;
        let guard=0;
        while((Number(character.level)||1)<MAX_CHARACTER_LEVEL&&character.exp>=Math.max(1,Number(character.expNext)||getExpNextForLevel(character.level))&&guard<100){
            const before=Number(character.level)||1;
            if(typeof checkLevelUp==="function"){ checkLevelUp(character); }
            else{
                character.exp-=Math.max(1,Number(character.expNext)||getExpNextForLevel(character.level));
                character.level++;
                recalibrateCharacterExpNext(character);
            }
            if((Number(character.level)||1)===before){ break; }
            guard++;
        }
        if(typeof refreshCharacterAvatarLevels==="function"){ refreshCharacterAvatarLevels(); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        return {baseExp:raw,multiplier:multiplier,grantedExp:granted};
    }
    window.v173GrantCharacterCatchUpExp=grantDirectCatchUpExp;

    recalibrateCharacterExpNext(player);
    if(typeof player2!=="undefined"&&player2){ recalibrateCharacterExpNext(player2); }
    if(typeof player3!=="undefined"&&player3){ recalibrateCharacterExpNext(player3); }

    const growthWasInitialized=growthState.initialized;
    ensureExpPoolChargeUnlocked(Date.now(),false);
    if(growthWasInitialized){ settleExpPoolCharge(Date.now()); }

    if(typeof checkLevelUp==="function"){
        const originalCheckLevelUp=checkLevelUp;
        checkLevelUp=function(targetCharacter){
            settleExpPoolCharge(Date.now());
            const character=targetCharacter||player;
            const levelBefore=character.level;
            if(levelBefore>=MAX_CHARACTER_LEVEL){
                recalibrateCharacterExpNext(character);
                if(typeof refreshCharacterAvatarLevels==="function"){ refreshCharacterAvatarLevels(); }
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                return false;
            }
            const result=originalCheckLevelUp.apply(this,arguments);
            if(character.level>MAX_CHARACTER_LEVEL){
                const excessLevels=character.level-MAX_CHARACTER_LEVEL;
                character.level=MAX_CHARACTER_LEVEL;
                character.attributePoints=Math.max(0,(Number(character.attributePoints)||0)-excessLevels*5);
                character.skillPoints=Math.max(0,(Number(character.skillPoints)||0)-excessLevels*2);
                character.bonusHP=Math.max(0,(Number(character.bonusHP)||0)-excessLevels*30);
                character.bonusSP=Math.max(0,(Number(character.bonusSP)||0)-excessLevels*10);
                character.exp=0;
            }
            if(character.level!==levelBefore){
                recalibrateCharacterExpNext(character);
                ensureExpPoolChargeUnlocked(Date.now(),true);
                if(typeof saveGame==="function"){ saveGame(); }
            }
            return result;
        };
    }

    if(typeof distributeExpToCharacter==="function"){
        const originalDistributeExpToCharacterV133=distributeExpToCharacter;
        distributeExpToCharacter=function(character){
            settleExpPoolCharge(Date.now());
            if(character&&(Number(character.level)||1)>=MAX_CHARACTER_LEVEL){
                alert((character.id||"角色")+"已達 Lv."+MAX_CHARACTER_LEVEL+" 滿等。");
                return false;
            }
            return originalDistributeExpToCharacterV133.apply(this,arguments);
        };
    }

    if(typeof createCharacter==="function"){
        const originalCreateCharacter=createCharacter;
        createCharacter=function(){
            const result=originalCreateCharacter.apply(this,arguments);
            recalibrateCharacterExpNext(player);
            ensureExpPoolChargeUnlocked(Date.now(),false);
            return result;
        };
    }
    if(typeof createAdditionalCharacter==="function"){
        const originalCreateAdditionalCharacter=createAdditionalCharacter;
        createAdditionalCharacter=function(slotNumber){
            const result=originalCreateAdditionalCharacter.apply(this,arguments);
            const character=slotNumber===3?player3:player2;
            recalibrateCharacterExpNext(character);
            ensureExpPoolChargeUnlocked(Date.now(),false);
            if(typeof updateUI==="function"){ updateUI(); }
            if(typeof saveGame==="function"){ saveGame(); }
            return result;
        };
    }
    if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
        document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ settleExpPoolCharge(Date.now()); } });
    }
    if(typeof window!=="undefined"&&typeof window.addEventListener==="function"){
        window.addEventListener("pageshow",()=>settleExpPoolCharge(Date.now()));
    }
    if(typeof renderExpDistributeList==="function"){ renderExpDistributeList(); }
    if(typeof setTimeout==="function"){ setTimeout(installLateGrowthEnhancements,0); }

    /* 2. 怪物金幣掉落rank倍率 */
    if(typeof getMonsterGoldDrop==="function"){
        getMonsterGoldDrop=function(monster){
            if(!monster){ return 0; }
            const level=Math.max(1,Math.floor(Number(monster.level)||1));
            const rank=getMonsterRank(monster);
            const rankMultiplier=rank==="boss"?5:rank==="elite"?2:1;
            const base=level*2+3;
            const variance=0.85+Math.random()*0.30;
            return Math.max(1,Math.floor(base*rankMultiplier*variance));
        };
    }

    /* 3. 商店價格 */
    const SHOP_PRICE_TIERS=[
        {maxLevel:30,multiplier:1,label:"Lv.1～30"},{maxLevel:40,multiplier:1.5,label:"Lv.31～40"},
        {maxLevel:50,multiplier:2,label:"Lv.41～50"},{maxLevel:60,multiplier:2.5,label:"Lv.51～60"},
        {maxLevel:70,multiplier:3,label:"Lv.61～70"},{maxLevel:80,multiplier:3.5,label:"Lv.71～80"},
        {maxLevel:90,multiplier:4,label:"Lv.81～90"},{maxLevel:100,multiplier:4.5,label:"Lv.91～100"}
    ];
    function getShopPriceTier(){
        const highestLevel=getHighestCreatedCharacterLevel();
        for(const tier of SHOP_PRICE_TIERS){ if(highestLevel<=tier.maxLevel){ return tier; } }
        return SHOP_PRICE_TIERS[SHOP_PRICE_TIERS.length-1];
    }
    function getShopItemPrice(shopItem){
        if(!shopItem||!Number.isFinite(shopItem.price)){ return shopItem?shopItem.price:null; }
        return Math.round(shopItem.price*getShopPriceTier().multiplier);
    }
    window.v133GetShopItemPrice=getShopItemPrice;

    /* 4. 藥水補品 */
    const SHOP_POTION_BASE_PRICES={hpPotion10:20,hpPotion30:50,hpPotion50:80,spPotion10:25,spPotion30:65,spPotion50:100};
    const SHOP_POTION_IDS=Object.keys(SHOP_POTION_BASE_PRICES);
    const SHOP_PURCHASE_MAX_QUANTITY=999;
    function normalizeShopPurchaseQuantity(value){
        return Math.max(1,Math.min(SHOP_PURCHASE_MAX_QUANTITY,Math.floor(Number(value)||1)));
    }
    window.normalizeShopPurchaseQuantity=normalizeShopPurchaseQuantity;
    window.v133NormalizeShopQuantityInput=function(input,options){
        if(!input){ return 1; }
        const commit=!!(options&&options.commit);
        const raw=String(input.value==null?"":input.value).trim();
        if(raw===""&&!commit){ return null; }
        const quantity=normalizeShopPurchaseQuantity(raw);
        input.value=String(quantity);
        return quantity;
    };
    if(typeof potionDefinitions!=="undefined"&&Array.isArray(potionDefinitions)){
        let hpPotion30=potionDefinitions.find(p=>p&&p.id==="hpPotion30");
        if(!hpPotion30){
            hpPotion30={id:"hpPotion30",name:"回復30%HP藥水",shortName:"HP 30%",icon:"",type:"potion",resource:"hp",recoveryPercent:30,price:50,stats:{}};
            potionDefinitions.push(hpPotion30);
        }
        hpPotion30.price=50;
        let spPotion30=potionDefinitions.find(p=>p&&p.id==="spPotion30");
        if(!spPotion30){
            spPotion30={id:"spPotion30",name:"回復30%SP藥水",shortName:"SP 30%",icon:"",type:"potion",resource:"sp",recoveryPercent:30,price:65,stats:{}};
            potionDefinitions.push(spPotion30);
        }
        spPotion30.price=65;
        potionDefinitions.forEach(item=>{
            if(item&&Object.prototype.hasOwnProperty.call(SHOP_POTION_BASE_PRICES,item.id)){
                item.price=SHOP_POTION_BASE_PRICES[item.id];
            }
        });
    }
    function getShoppablePotions(){
        if(typeof potionDefinitions==="undefined"||!Array.isArray(potionDefinitions)){ return []; }
        return SHOP_POTION_IDS.map(id=>potionDefinitions.find(item=>item&&item.id===id)).filter(Boolean);
    }
    if(typeof renderShopContent==="function"){
        renderShopContent=function(){
            const tier=getShopPriceTier();
            const cards=getShoppablePotions().map(shopItem=>{
                const count=typeof getPotionCount==="function"?getPotionCount(shopItem.id):0;
                const resourceLabel=shopItem.resource==="hp"?"HP":"SP";
                const effectText=`回復最大${resourceLabel}的 ${shopItem.recoveryPercent}%`;
                const displayPrice=getShopItemPrice(shopItem);
                const hasPrice=Number.isFinite(displayPrice);
                const disabled=!hasPrice||gold<displayPrice;
                const buttonText=!hasPrice?"價格待定":`${displayPrice} 金幣`;
                return `<div class="shop-potion-card ${shopItem.resource}">
                    <div class="shop-potion-card-head"><span class="shop-potion-type">${resourceLabel}</span><span class="shop-potion-stock">持有 ${count}</span></div>
                    <div class="shop-potion-name">${shopItem.name}</div><div class="shop-potion-effect">${effectText}</div>
                    <div class="shop-potion-purchase-row"><label for="shopQuantity-${shopItem.id}">數量</label>
                    <input id="shopQuantity-${shopItem.id}" class="shop-potion-quantity" type="number" inputmode="numeric" min="1" max="999" step="1" value="1" oninput="v133NormalizeShopQuantityInput(this)" onblur="v133NormalizeShopQuantityInput(this,{commit:true})">
                    <button class="home-feature-buy-btn shop-potion-buy" ${disabled?"disabled":""} onclick="buyShopItem('${shopItem.id}',document.getElementById('shopQuantity-${shopItem.id}').value)">${buttonText}</button></div></div>`;
            }).join("");
            return `<div class="shop-potion-interface"><div class="shop-potion-note">只販售 HP／SP 回復藥水</div>
                <div class="v133-shop-tier-note">目前商店階級：${tier.label}（價格×${tier.multiplier}）</div><div class="shop-potion-list">${cards}</div></div>`;
        };
    }
    if(typeof buyShopItem==="function"){
        buyShopItem=function(itemId,requestedQuantity){
            const shopItem=typeof getPotionDefinition==="function"?getPotionDefinition(itemId):null;
            if(!shopItem||!SHOP_POTION_IDS.includes(itemId)){ return; }
            const unitPrice=getShopItemPrice(shopItem);
            if(!Number.isFinite(unitPrice)){ alert("這個藥水的價格尚未設定。"); return; }
            const quantity=normalizeShopPurchaseQuantity(requestedQuantity);
            const totalPrice=unitPrice*quantity;
            if(gold<totalPrice){ alert("金幣不夠，本次需要 "+totalPrice.toLocaleString("zh-TW")+" 金幣。"); return; }
            if(!addPotionToInventory(itemId,quantity)){ alert("背包已滿，或該藥水已沒有可用的堆疊空間。"); return; }
            gold-=totalPrice;
            rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            const bodyEl=$("homeFeatureModalBody");
            if(bodyEl){ bodyEl.innerHTML=renderShopContent(); }
        };
    }

    /* 5. 共用金幣消耗工具 */
    function spendGoldForFutureSystem(amount){
        const cost=Math.max(0,Math.floor(Number(amount)||0));
        if(cost<=0){ return true; }
        if(gold<cost){ return false; }
        gold-=cost;
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        saveGame();
        return true;
    }
    window.v133SpendGoldForFutureSystem=spendGoldForFutureSystem;
})();


/* bundled source: js/29-v134-fixes.js */
/*
   V134 — 三個回報問題的修正：
   1. 戰鬥「空拍很久」：輪到手動角色時指令列沒顯示，玩家看不到按鈕、
      只能乾等 20 秒倒數跑完
   2. 自動戰鬥「設定出招了還一直普通攻擊」：退回普攻時完全靜默，
      玩家不知道為什麼；外加自動技能選單跟引擎的分類條件不一致
   3. 背包從下方導覽列進去時沒有返回鍵

   ★ 原則：全部用「包一層既有函式」的方式接進去，不改
   js/00-main.js 本體，也不動戰鬥公式、傷害、怪物強度、掉率。
*/
(function installV134Fixes(){
    "use strict";

    /* =====================================================
       1. 戰鬥空拍：輪到手動角色時要把指令列叫回來
       ===================================================== */

    /*
       ★ 根因（讀 js/00-main.js 確認）：
       updateActionHudVisibility()（31898）是依「當下的
       activeBattleCharacterIndex 是不是自動」來決定指令列要不要
       隱藏，但全專案只有三個地方呼叫它：
         - startTurn()（10042）——此時 index 恆為 0
         - startResolutionPhase()（11934）
         - toggleAutoBattle()（19112）
       宣告階段真正在「換人」的 beginCharacterTurn()（10078）
       從來沒有呼叫過它。

       所以只要 0 號是自動、1／2 號是手動，指令列在 startTurn 那次
       就被判定成「隱藏」，然後整個宣告階段都不會再更新——輪到手動
       角色時玩家看不到任何按鈕、什麼都不能做，只能眼睜睜等
       beginCharacterTurn() 裡那個 20 秒 setInterval（10241）跑完，
       直到 timeoutTurn() 印出「⏰ 時間到，本回合沒有行動。」
       一個手動角色就是 20 秒空拍，兩個就是 40 秒——這正是使用者
       說的「為何有空拍很久的時候」。

       這個狀態很容易進入：saveAutoSettingsFormToCharacter()（19884）
       只寫 skill/hp/sp/returnToCityWhenEmpty，從來不寫 enabled，
       所以 autoConfig.enabled 跟 autoConfig2/3.enabled 很容易不同步。

       修法：包一層 beginCharacterTurn()，等原函式把
       activeBattleCharacterIndex 推到正確的人之後，補呼叫一次
       updateActionHudVisibility()。原函式如果已經跑到底去呼叫
       startResolutionPhase()，這裡再叫一次也是安全的——那時
       battlePhase 已經是 "resolve"，同一個函式會正確地算出「該隱藏」。
    */
    if(typeof beginCharacterTurn==="function"){
        const originalBeginCharacterTurn=beginCharacterTurn;
        beginCharacterTurn=function(token){
            const result=originalBeginCharacterTurn.apply(this,arguments);
            if(typeof updateActionHudVisibility==="function"){
                updateActionHudVisibility();
            }
            return result;
        };
    }

    /* =====================================================
       2. 自動戰鬥：退回普攻時要說明原因
       ===================================================== */

    /*
       ★ 這一段原本在這裡（V134），已經在 V135 被更好的做法取代，
       所以整段移除，避免兩份邏輯同時印出重複的訊息。

       V134 的做法是「在原函式跑之前，自己複製一份引擎的四個判斷
       條件去預測會不會退回普攻」。缺點是：只要引擎因為某個沒被
       複製到的理由退回，預判就會全部通過、什麼都不印，玩家還是
       看到莫名其妙的普攻。使用者接著就回報了「我很確定有SP，
       自動戰鬥還是使用普通攻擊」——正是這種預判對不上的情況。

       V135 改成「以實際結果為準」：讓原函式跑完，再去看
       queuedPlayerActions 裡實際排進去的是什麼，只要
       「設定的是技能、實際卻是普通攻擊」就一定會印說明。
       詳見 js/30-v135-fixes.js 第 1 節。
    */


    /*
       ★ 調查記錄（給下一個接手的人，避免重複走冤枉路）：
       原本以為還要修「UI 選單跟引擎的分類條件不一致」——
       populateAutoSkillOptions()（00-main.js:31426）只濾掉
       buff/passive，但引擎（20245）連 heal/revive 也拒絕。

       實際查證後發現這是**死程式碼**：它操作的
       #autoSkillHome / #autoSkillBattle / #autoEnabled 這幾個元素
       在現在的 index.html 裡**根本不存在**（grep 結果都是 0），
       是舊版主城自動面板的殘留，這也正是 console 一直在印
       「找不到元素： autoSkillHome / autoEnabled …」的原因。

       玩家現在真正在用的是元素匣面板的 #autoSettingsActionSelect，
       由 switchAutoSettingsCharacter()（00-main.js:20052-20074）
       負責填充，而它**本來就有**正確濾掉 buff/passive/heal/revive。
       所以這裡不需要、也不應該再加一層修正。

       萬一 autoConfig.skill 因為舊存檔之類的原因還是留著一個
       heal/revive 技能，上面新增的回饋訊息會直接告訴玩家
       「屬於治療類技能，自動戰鬥目前不支援」，不會再靜默普攻，
       這樣就夠了。
    */


    /* =====================================================
       3. 背包返回鍵
       ===================================================== */

    /*
       ★ 根因（讀 index.html + css/00-main.css 確認）：
       #inventoryPage 唯一的關閉鍵 #mapInventoryOverlayClose
       （index.html:2158）被 CSS 綁死只在覆蓋層模式顯示：
         css/00-main.css:5604  .map-inventory-overlay-close{ display:none; }
         css/00-main.css:5607  #inventoryPage.map-inventory-overlay-open
                               .map-inventory-overlay-close{ display:flex !important; }
       而 .map-inventory-overlay-open 只有 openMapInventoryOverlay()
       （00-main.js:6980）會加。背包有三種進入方式，只有「從地圖頁」
       那一種會加這個 class；使用者截圖是從「下方導覽列」進去的
       （index.html:2329 的 showPage('inventory')），那條路徑
       #inventoryPage 從頭到尾沒有任何返回控制項。

       修法分兩半：
       - CSS（css/35-v134-fixes.css）：讓這顆按鈕在 #inventoryPage
         一律顯示，不再只綁覆蓋層 class
       - JS（這裡）：依使用者決定「返回上一個頁面」，包一層
         showPage() 記錄前一頁，再把按鈕的行為換成
         「覆蓋層開著 → 照舊關覆蓋層；否則 → 回上一頁」
    */
    let v134PreviousPage=null;
    let v134CurrentPage=null;

    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            /* 只在「真的會切過去」時才記錄——原函式在戰鬥中會直接
               return 擋掉切頁（00-main.js:7032），那種情況不能算數，
               否則返回鍵會指到一個從來沒去過的頁面。 */
            const willActuallySwitch=!(battleActive && page!=="battle");

            if(willActuallySwitch && page!==v134CurrentPage){
                if(v134CurrentPage!==null){
                    v134PreviousPage=v134CurrentPage;
                }
                v134CurrentPage=page;
            }

            return originalShowPage.apply(this,arguments);
        };
    }

    window.v134BackFromInventory=function(){
        /* 從地圖頁開的覆蓋層版本：維持原本的關閉行為，
           不要弄壞這條本來就正常的路徑。 */
        if(typeof mapInventoryOverlayOpen!=="undefined" && mapInventoryOverlayOpen){
            if(typeof closeMapInventoryOverlay==="function"){
                closeMapInventoryOverlay();
            }
            return;
        }

        /*
           借進角色彈窗的情況（switchCharacterTab("inventory") 會把
           整個 #inventoryPage 搬進 #homeFeatureModalBody）：這時候
           這顆按鈕應該關掉那個彈窗，而不是切頁。

           ★ 判斷條件刻意用「#inventoryPage 是不是真的被搬進彈窗裡」
           而不是「彈窗是不是可見」——後者太寬鬆：只要畫面上剛好有
           任何一個 home-feature 彈窗開著（即使背包是獨立整頁顯示、
           跟那個彈窗一點關係都沒有），就會誤判成借用情境，結果按了
           返回只是關掉那個不相干的彈窗、背包頁還留在原地。
           實測就踩到過這個情況。用 contains() 檢查父子關係才精準。
        */
        const modalBody=document.getElementById("homeFeatureModalBody");
        const inventoryPage=document.getElementById("inventoryPage");
        if(modalBody && inventoryPage && modalBody.contains(inventoryPage)){
            if(typeof closeHomeFeature==="function"){
                closeHomeFeature();
            }
            return;
        }

        const target=
            (v134PreviousPage && v134PreviousPage!=="inventory")
            ? v134PreviousPage
            : "home";

        showPage(target);
    };

    /* 把按鈕的 onclick 從寫死的 closeMapInventoryOverlay() 換成
       上面那個依情境判斷的版本。用 DOM 直接改，不動 index.html。 */
    function rebindInventoryBackButton(){
        const button=document.getElementById("mapInventoryOverlayClose");
        if(!button || button.dataset.v134Bound==="1"){ return; }
        button.dataset.v134Bound="1";
        button.setAttribute("onclick","v134BackFromInventory()");
        button.textContent="返回";
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",rebindInventoryBackButton,{once:true});
    }else{
        rebindInventoryBackButton();
    }

})();


/* bundled source: js/30-v135-fixes.js */
/*
   V135 — 這一輪的 4 項回報：
   1. 自動戰鬥「明明有SP還是普通攻擊」——改成「看實際結果」的回饋，
      不再只是複製一份引擎的判斷條件去猜
   2. 技能要顯示作用對象與數量（自動戰鬥設定、手動技能格、選目標提示）
   3. 護盾在滿血時看不到——血條與護盾改成共用同一個比例基準
   4. 所有出手／回合間隔統一調成 1.25 秒
*/
(function installV135Fixes(){
    "use strict";

    /* =====================================================
       1. 自動戰鬥回饋：改成「以實際結果為準」
       ===================================================== */

    /*
       ★ 為什麼要重做（V134 的做法不夠好）：
       V134 是在原函式跑之前，自己「複製一份」引擎的四個判斷條件
       （技能不存在／沒學會／SP不足／類型不支援）去預測會不會退回
       普攻。問題是——如果引擎因為某個我沒複製到的理由退回普攻，
       我的預判會全部通過、於是什麼都不印，玩家看到的還是「莫名其妙
       就是普攻、而且毫無說明」。使用者這次回報「我很確定有SP，
       自動戰鬥還是使用普通攻擊」正是這種情況：SP 明明夠，所以
       V134 的 SP 判斷不會觸發，但實際結果還是普攻。

       這一版改成完全不猜：先記下玩家設定的技能，讓原函式照常跑，
       跑完之後直接看 queuedPlayerActions 裡「實際被排進去的行動」
       是什麼。只要「設定的是技能、實際排進去的卻是普通攻擊」，
       就一定會印出說明——能對上原因就印具體原因，對不上就明講
       「原因不明」並把關鍵數值一起印出來。這樣不管引擎為什麼退回，
       玩家（跟之後除錯的人）都一定看得到線索，不會再有靜默失敗。
    */
    const v135LastReason={};

    function explainAutoFallback(characterIndex,configuredSkillId){
        const character=getPartyCharacterByIndex(characterIndex);
        const skill=skillDatabase[configuredSkillId];
        const name=(character && character.id)||("角色"+(characterIndex+1));

        if(!skill){
            return "找不到「"+configuredSkillId+"」這個技能資料，改用普通攻擊。";
        }

        const skillKey=getPartyCharacterKey(characterIndex);
        const level=getSkillLevel(skillKey,configuredSkillId);
        if(level<=0){
            return name+"還沒學會「"+skill.name+"」，改用普通攻擊。";
        }

        const spCost=skill.spCost!==undefined ? skill.spCost : (skill.cost||0);
        if(character && character.sp<spCost){
            return name+"SP不足（"+Math.floor(character.sp)+"/"+spCost+
                "），無法使用「"+skill.name+"」，改用普通攻擊。";
        }

        if(["buff","passive","heal","revive"].includes(skill.category)){
            const label=
                skill.category==="heal" ? "治療" :
                skill.category==="revive" ? "復活" :
                skill.category==="buff" ? "增益" : "被動";
            return "「"+skill.name+"」屬於"+label+"類技能，自動戰鬥目前不支援，改用普通攻擊。";
        }

        /* 四個已知原因都對不上——明講原因不明，並附上判斷用的數值，
           讓玩家可以直接回報這一行，不用再猜。 */
        return "「"+skill.name+"」被改成普通攻擊，原因不明"+
            "（等級"+level+"、SP "+(character ? Math.floor(character.sp) : "?")+"/"+spCost+
            "、類型"+skill.category+"）。請把這行回報給開發者。";
    }

    if(typeof autoActionForCharacter==="function"){
        const originalAutoActionForCharacter=autoActionForCharacter;
        autoActionForCharacter=function(characterIndex,token){
            const config=getPartyAutoConfig(characterIndex);
            const configuredSkillId=config ? config.skill : null;

            const result=originalAutoActionForCharacter.apply(this,arguments);

            try{
                /* V136 已接管設定持久化、fallback 說明與實際 queued action
                   校正；在這裡即時判斷旗標，避免兩層同時印重複訊息。
                   不管 V135/V136 兩支動態 script 誰先下載完成都安全。 */
                if(window.v136AutoBattleFixInstalled){
                    return result;
                }

                /* 只有「玩家真的設了一個技能」才需要檢查；normal/defend
                   本來就不是技能，沒有「被退回」這回事。 */
                if(
                    configuredSkillId &&
                    configuredSkillId!=="normal" &&
                    configuredSkillId!=="defend"
                ){
                    const queued=queuedPlayerActions[characterIndex];
                    const actualAction=queued ? queued.action : null;

                    if(actualAction==="normal"){
                        const reason=explainAutoFallback(characterIndex,configuredSkillId);
                        if(v135LastReason[characterIndex]!==reason){
                            v135LastReason[characterIndex]=reason;
                            addBattleLog("⚠️ "+reason);
                        }
                    }
                    else if(actualAction===configuredSkillId){
                        /* 這次成功放出技能了，清掉去重紀錄，
                           下次真的又退回時才會重新印一次。 */
                        v135LastReason[characterIndex]=null;
                    }
                }
            }catch(error){
                console.error("V135 自動戰鬥回饋判斷失敗：",error);
            }

            return result;
        };
    }


    /* =====================================================
       2. 技能作用對象／數量標示
       ===================================================== */

    /*
       ★ 依照使用者要求，把每個技能「打誰、打幾個」直接寫在畫面上，
       三個地方都要有：自動戰鬥設定的技能下拉、手動戰鬥的技能格、
       以及選好技能之後的選目標提示。

       對照 js/25-v131-fix-batch.js 的 getSkillTargets() 實際行為
       （那才是真正決定打到誰的地方）：
         single  → 只打中心那一個
         tri     → 取中心所在那一排的「左中右」最多3個
         row     → 中心所在那一整排
         all     → 場上全部存活怪物
         ally    → 我方單一目標
         allyAll → 我方全體（castBuffSkill 會取前3人）
         deadAlly→ 我方陣亡的單一目標
         none    → 不用選目標（對自己/全場生效）
    */
    const SKILL_TARGET_SCOPE_LABELS={
        single:"敵方一人",
        /* 不用括號寫「（同排左中右）」——這些標籤在自動戰鬥下拉裡
           本來就會被包進一層括號，再有內層括號會變成
           「冰旋一閃（敵方三人（同排左中右）））」很難讀，改用中點。 */
        tri:"敵方三人・同排左中右",
        row:"敵方整排",
        column:"敵方前後2人・同位置",
        all:"敵方全體",
        ally:"我方一人",
        allyAll:"我方全體",
        deadAlly:"我方陣亡一人",
        none:"自身"
    };

    function getSkillTargetScopeLabel(skill){
        if(!skill){ return ""; }
        return SKILL_TARGET_SCOPE_LABELS[skill.targetType]||"";
    }
    window.v135GetSkillTargetScopeLabel=getSkillTargetScopeLabel;

    /* --- 2a. 手動戰鬥的技能格：在技能名稱下面補一行作用對象 --- */
    if(typeof populateSkillQuickBar==="function"){
        const originalPopulateSkillQuickBar=populateSkillQuickBar;
        populateSkillQuickBar=function(){
            const result=originalPopulateSkillQuickBar.apply(this,arguments);

            try{
                const bar=document.getElementById("skillQuickBarGrid");
                if(!bar){ return result; }

                const characterId=getPartyCharacterKey(activeBattleCharacterIndex);
                const loadout=characterSkillLoadouts[characterId];
                if(!loadout){ return result; }

                Array.from(bar.children).forEach((button,i)=>{
                    const skillId=loadout.equippedSkills[i];
                    const skill=skillId ? skillDatabase[skillId] : null;
                    const label=getSkillTargetScopeLabel(skill);
                    if(!label){ return; }
                    if(button.querySelector(".v135-sq-scope")){ return; }

                    const costEl=button.querySelector(".sq-cost");
                    const scope=document.createElement("span");
                    scope.className="v135-sq-scope";
                    scope.textContent=label;
                    if(costEl && costEl.parentElement){
                        costEl.parentElement.insertBefore(scope,costEl);
                    }else{
                        button.appendChild(scope);
                    }
                });
            }catch(error){
                console.error("V135 技能格作用對象標示失敗：",error);
            }

            return result;
        };
    }

    /* --- 2b. 自動戰鬥設定的技能下拉：選項文字後面補作用對象 --- */
    function decorateAutoSettingsSkillOptions(){
        const select=document.getElementById("autoSettingsActionSelect");
        if(!select || !select.options){ return; }

        let changed=false;
        Array.from(select.options).forEach(option=>{
            const skill=skillDatabase[option.value];
            const label=getSkillTargetScopeLabel(skill);
            if(!label){ return; }
            if(option.textContent.indexOf("（"+label+"）")!==-1){ return; }
            option.textContent=option.textContent+"（"+label+"）";
            changed=true;
        });

        /*
           ★ 這裡一定要重新指派一次 .value：這幾個 <select> 在開場時
           被 initCustomDropdown()/makeSelectValueReactive() 換成了自訂的
           假下拉（見 js/00-main.js:4326 起），畫面上真正看得到的是那份
           另外渲染的清單，而它只有在 .value 被設定時才會重新渲染。
           只改 <option> 的文字不會反映到畫面上，必須靠這一行觸發重繪。
        */
        if(changed){
            select.value=select.value;
        }
    }

    if(typeof switchAutoSettingsCharacter==="function"){
        const originalSwitchAutoSettingsCharacter=switchAutoSettingsCharacter;
        switchAutoSettingsCharacter=function(){
            const result=originalSwitchAutoSettingsCharacter.apply(this,arguments);
            decorateAutoSettingsSkillOptions();
            return result;
        };
    }

    if(typeof openAutoBattleSettings==="function"){
        const originalOpenAutoBattleSettings=openAutoBattleSettings;
        openAutoBattleSettings=function(){
            const result=originalOpenAutoBattleSettings.apply(this,arguments);
            decorateAutoSettingsSkillOptions();
            return result;
        };
    }

    /*
       ★ 注意：saveAutoSettingsFormToCharacter() 存的是 <option> 的
       value（技能id），不是顯示文字，所以上面在文字後面加註記
       完全不會影響存檔內容，也不會讓 stillValid 判斷失效。
    */

    /* --- 2c. 選目標階段：提示列補上「這招打誰、打幾個」 --- */
    /*
       符咒也要有作用對象提示——它們不在 skillDatabase 裡（是 js/27
       自己的 talismanDefinitions），所以要另外查一次。冰封符打敵方
       單體、隱身符/結界符給我方單體，跟 js/27 的
       getTalismanTargetKind() 分流一致。
    */
    function getTalismanScopeLabel(actionType){
        if(typeof window.v132GetTalismanDefinition!=="function"){ return ""; }
        const definition=window.v132GetTalismanDefinition(actionType);
        if(!definition){ return ""; }
        return definition.talismanEffect==="freeze" ? "敵方一人" : "我方一人";
    }

    function appendScopeToTargetPrompt(actionType){
        const promptAction=document.getElementById("battleTargetPromptAction");
        if(!promptAction){ return; }

        const label=
            getSkillTargetScopeLabel(skillDatabase[actionType]) ||
            getTalismanScopeLabel(actionType);
        if(!label){ return; }

        if(promptAction.textContent.indexOf(label)!==-1){ return; }
        promptAction.textContent=promptAction.textContent+"　→　"+label;
    }

    if(typeof setBattleTargetSelectionMode==="function"){
        const originalSetBattleTargetSelectionMode=setBattleTargetSelectionMode;
        setBattleTargetSelectionMode=function(actionType){
            const result=originalSetBattleTargetSelectionMode.apply(this,arguments);
            appendScopeToTargetPrompt(actionType);
            return result;
        };
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const originalSetBattleAllyTargetSelectionMode=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const result=originalSetBattleAllyTargetSelectionMode.apply(this,arguments);
            appendScopeToTargetPrompt(actionType);
            return result;
        };
    }


    /* =====================================================
       3. 護盾在滿血時看不見
       ===================================================== */

    /*
       ★ 根因：updateSingleCharacterBars()（js/00-main.js:22793）把
       血條寬度算成 hp/maxHP，護盾則是
         left  = hpPercent
         width = shieldRemaining/maxHP
       兩者共用同一個 maxHP 基準、而且護盾是「接在血條右邊」畫的。
       滿血時 hpPercent 正好是 100，護盾的起點就被推到血條最右緣之外，
       又因為 .hp-bar 是 overflow:hidden，整段白色護盾直接被裁掉——
       這就是使用者說的「滿血有護盾時完全看不出來」。

       依使用者指定的做法修：把血條和護盾放進同一個「總長度」裡按
       比例分配（總長 = maxHP + 護盾量），滿血時血條會往左縮一點，
       空出來的位置正好塞得下等值的護盾，兩段加起來剛好填滿整條。
       沒有護盾時分母就是 maxHP，行為跟原本完全一樣，不影響一般情況。
    */
    function getShieldRemaining(character){
        const buff=(character&&character.activeBuffs||[]).find(
            b=>b.type==="shield" && b.turnsLeft>0 && b.remaining>0
        );
        return buff ? Math.max(0,buff.remaining) : 0;
    }

    if(typeof updateSingleCharacterBars==="function"){
        const originalUpdateSingleCharacterBars=updateSingleCharacterBars;
        updateSingleCharacterBars=function(index,character,stats){
            const result=originalUpdateSingleCharacterBars.apply(this,arguments);

            try{
                const hpBar=document.getElementById("battlePlayerHPBar"+index);
                const shieldBar=document.getElementById("battlePlayerShieldBar"+index);
                if(!hpBar || !shieldBar || !character || !stats){ return result; }

                const maxHP=Math.max(1,Number(stats.maxHP)||1);
                const hp=Math.max(0,Math.min(maxHP,Number(character.hp)||0));
                const shield=getShieldRemaining(character);

                /* 沒有護盾就維持原本的算法，完全不動。 */
                if(shield<=0){
                    hpBar.style.width=(hp/maxHP*100)+"%";
                    shieldBar.style.left=(hp/maxHP*100)+"%";
                    shieldBar.style.width="0%";
                    return result;
                }

                const total=maxHP+shield;
                const hpPercent=hp/total*100;
                const shieldPercent=shield/total*100;

                hpBar.style.width=hpPercent+"%";
                shieldBar.style.left=hpPercent+"%";
                shieldBar.style.width=shieldPercent+"%";
            }catch(error){
                console.error("V135 護盾血條顯示失敗：",error);
            }

            return result;
        };
    }

})();


/* bundled source: js/31-v136-auto-battle-fix.js */
/*
   V136 — 自動戰鬥技能設定持久化與強制校正

   這一版處理兩個會讓玩家看到「明明有 SP 卻一直普通攻擊」的來源：
   1. 自動技能只在按下套用時才寫入；中途切換、廣告流程取消或舊版同步
      都可能讓實際設定仍停在 normal。
   2. 舊版同步函式會在判定選項無效時直接把設定洗成 normal，沒有留下
      玩家最後一次明確選過哪個技能，也沒有任何提示。

   V136 會在玩家選擇自動行動的當下立刻存檔，記住「普通攻擊／防禦／
   技能」的明確意圖；如果舊版同步誤把一個仍然有效的技能洗成普通攻擊，
   會自動恢復。戰鬥宣告時再以真正排入 queuedPlayerActions 的結果校正，
   所有退回普通攻擊的情況都會留下可讀原因。
*/
(function installV136AutoBattleFix(){
    "use strict";

    if(window.v136AutoBattleFixInstalled){ return; }
    window.v136AutoBattleFixInstalled=true;

    const lastNoticeByCharacter={};

    function normalizeAction(action){
        return typeof action==="string" && action
            ? action
            : "normal";
    }

    function getSkillCost(skill){
        if(!skill){ return 0; }
        const raw=skill.spCost!==undefined ? skill.spCost : (skill.cost||0);
        const numeric=Number(raw);
        return Number.isFinite(numeric) && numeric>0 ? numeric : 0;
    }

    function isUnsupportedAutoCategory(skill){
        return !!(
            skill &&
            ["buff","passive","heal","revive"].includes(skill.category)
        );
    }

    function isEquippedAndLearnedAutoSkill(characterIndex,skillId){
        const skill=skillDatabase[skillId];
        const skillKey=getPartyCharacterKey(characterIndex);
        const loadout=characterSkillLoadouts[skillKey];

        return !!(
            skill &&
            !isUnsupportedAutoCategory(skill) &&
            loadout &&
            Array.isArray(loadout.equippedSkills) &&
            loadout.equippedSkills.includes(skillId) &&
            getSkillLevel(skillKey,skillId)>0
        );
    }

    function rememberExplicitAction(characterIndex,action){
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character){ return; }

        const config=getPartyAutoConfig(characterIndex);
        const selected=normalizeAction(action);

        config.skill=selected;

        if(selected==="normal"){
            config.v136ActionIntent="normal";
        }
        else if(selected==="defend"){
            config.v136ActionIntent="defend";
        }
        else{
            config.v136ActionIntent="skill";
            config.v136LastSkill=selected;
        }
    }

    function migrateCurrentIntent(characterIndex){
        const character=getPartyCharacterByIndex(characterIndex);
        if(!character){ return; }

        const config=getPartyAutoConfig(characterIndex);
        const selected=normalizeAction(config.skill);

        if(config.v136ActionIntent){ return; }

        if(selected==="normal"){
            config.v136ActionIntent="normal";
        }
        else if(selected==="defend"){
            config.v136ActionIntent="defend";
        }
        else{
            config.v136ActionIntent="skill";
            config.v136LastSkill=selected;
        }
    }

    function restoreSkillAfterLegacySync(characterIndex){
        const config=getPartyAutoConfig(characterIndex);

        if(
            config.v136ActionIntent==="skill" &&
            config.skill==="normal" &&
            isEquippedAndLearnedAutoSkill(characterIndex,config.v136LastSkill)
        ){
            config.skill=config.v136LastSkill;
            return true;
        }

        return false;
    }

    function saveCurrentActionFromPanel(){
        const characterSelect=document.getElementById("autoSettingsCharacterSelect");
        const actionSelect=document.getElementById("autoSettingsActionSelect");
        if(!characterSelect || !actionSelect){ return; }

        const characterIndex=Number(characterSelect.value);
        if(!getPartyCharacterByIndex(characterIndex)){ return; }

        rememberExplicitAction(characterIndex,actionSelect.value);

        if(typeof saveGame==="function"){
            saveGame();
        }
    }

    /* 舊存檔若本來就選了技能，先補上意圖欄位，之後不會再被同步洗掉。 */
    [0,1,2].forEach(migrateCurrentIntent);

    /*
       共用儲存入口也記錄意圖。即使之後 UI 又增加新的確認按鈕，只要仍
       經過 saveAutoSettingsFormToCharacter()，就不會漏掉這層保護。
    */
    if(typeof saveAutoSettingsFormToCharacter==="function"){
        const originalSaveAutoSettingsFormToCharacter=
            saveAutoSettingsFormToCharacter;

        saveAutoSettingsFormToCharacter=function(characterIndex){
            const result=originalSaveAutoSettingsFormToCharacter.apply(this,arguments);
            const config=getPartyAutoConfig(Number(characterIndex));
            rememberExplicitAction(Number(characterIndex),config.skill);
            return result;
        };
    }

    /*
       自訂下拉選單會手動 dispatch change；因此玩家點到技能的當下就立刻
       寫入設定與 localStorage，不必等最後一顆按鈕才第一次保存。
    */
    const actionSelect=document.getElementById("autoSettingsActionSelect");
    if(actionSelect && actionSelect.dataset.v136ImmediateSave!=="1"){
        actionSelect.dataset.v136ImmediateSave="1";
        actionSelect.addEventListener("change",saveCurrentActionFromPanel);
    }

    /*
       capture 階段先存一次，避免元素匣時數／廣告流程在外層 wrapper 提前
       return 時，畫面上已選好的技能完全沒有落盤。
    */
    document.addEventListener("click",event=>{
        const target=event.target;
        const button=target && target.closest
            ? target.closest("#autoBattleSettingsPanel .auto-save-btn")
            : null;
        if(button){
            saveCurrentActionFromPanel();
        }
    },true);

    /*
       保護兩個舊版選單同步函式：只有在玩家最後明確選的是技能、而且該
       技能現在仍已裝備且已學會時才恢復。玩家明確選「普通攻擊」或
       「防禦」時絕不會被擅自改掉。
    */
    if(typeof populateAutoSkillOptions==="function"){
        const originalPopulateAutoSkillOptions=populateAutoSkillOptions;
        populateAutoSkillOptions=function(){
            const result=originalPopulateAutoSkillOptions.apply(this,arguments);
            if(restoreSkillAfterLegacySync(0) && typeof saveGame==="function"){
                saveGame();
            }
            return result;
        };
    }

    if(typeof populateAutoSkillOptions2==="function"){
        const originalPopulateAutoSkillOptions2=populateAutoSkillOptions2;
        populateAutoSkillOptions2=function(){
            const result=originalPopulateAutoSkillOptions2.apply(this,arguments);
            if(restoreSkillAfterLegacySync(1) && typeof saveGame==="function"){
                saveGame();
            }
            return result;
        };
    }

    function getAutoDecision(characterIndex){
        const character=getPartyCharacterByIndex(characterIndex);
        const config=getPartyAutoConfig(characterIndex);
        const action=normalizeAction(config && config.skill);
        const name=(character && character.id)||("角色"+(characterIndex+1));

        if(action==="normal"){
            return {
                kind:"normal",
                action,
                message:name+"目前的自動行動設定是「普通攻擊」；SP充足不會自動改放技能，請在元素匣選擇要施放的技能。"
            };
        }

        if(action==="defend"){
            return {kind:"defend",action};
        }

        const skill=skillDatabase[action];
        if(!skill){
            return {
                kind:"fallback",
                action,
                message:"找不到「"+action+"」的技能資料，已改用普通攻擊。"
            };
        }

        const skillKey=getPartyCharacterKey(characterIndex);
        const loadout=characterSkillLoadouts[skillKey];
        if(
            !loadout ||
            !Array.isArray(loadout.equippedSkills) ||
            !loadout.equippedSkills.includes(action)
        ){
            return {
                kind:"fallback",
                action,
                message:name+"沒有裝備「"+skill.name+"」，已改用普通攻擊。"
            };
        }

        const level=getSkillLevel(skillKey,action);
        if(level<=0){
            return {
                kind:"fallback",
                action,
                message:name+"尚未學會「"+skill.name+"」，已改用普通攻擊。"
            };
        }

        if(isUnsupportedAutoCategory(skill)){
            return {
                kind:"fallback",
                action,
                message:"「"+skill.name+"」不是自動戰鬥可施放的攻擊技能，已改用普通攻擊。"
            };
        }

        const spCost=getSkillCost(skill);
        const currentSP=character ? Number(character.sp)||0 : 0;
        if(currentSP<spCost){
            return {
                kind:"fallback",
                action,
                message:name+"的SP不足（"+Math.floor(currentSP)+"/"+spCost+
                    "），無法施放「"+skill.name+"」，已改用普通攻擊。"
            };
        }

        return {kind:"skill",action,skill,spCost};
    }

    function addNoticeOnce(characterIndex,key,message){
        if(lastNoticeByCharacter[characterIndex]===key){ return; }
        lastNoticeByCharacter[characterIndex]=key;
        addBattleLog("⚠️ "+message);
    }

    function getPriorityAutoTarget(){
        const indexes=typeof currentBattleMonsters!=="undefined"&&Array.isArray(currentBattleMonsters)
            ?currentBattleMonsters:[];
        const priority=typeof window.v148GetAutoTargetPriority==="function"
            ?window.v148GetAutoTargetPriority(indexes):indexes.slice();
        return priority.find(index=>{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            return !!(monster&&monster.alive!==false&&(Number(monster.hp)||0)>0);
        });
    }

    function queuedActionTargetsEnemy(queued){
        if(!queued){ return false; }
        if(queued.action==="normal"){ return true; }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[queued.action]:null;
        return !!(skill&&(skill.category==="physical"||skill.category==="magic")&&skill.targetType!=="none");
    }

    function enforceAutoTargetPriority(queued){
        if(!queuedActionTargetsEnemy(queued)){ return; }
        queued.vFixedAutoEnemyPrimary=true;
        const previewTarget=getPriorityAutoTarget();
        if(Number.isInteger(previewTarget)){ queued.target=previewTarget; }
    }

    /*
       最後一道保護：原引擎跑完後直接檢查實際 queued action。如果所有
       合法條件都通過、卻仍被排成 normal，就把該筆佇列校正回玩家選的
       技能。這一層只處理「已裝備、已學會、類型正確、SP足夠」的技能，
       不會繞過任何合法限制。
    */
    if(typeof autoActionForCharacter==="function"){
        const originalAutoActionForCharacter=autoActionForCharacter;

        autoActionForCharacter=function(characterIndex,token){
            if(
                restoreSkillAfterLegacySync(characterIndex) &&
                typeof saveGame==="function"
            ){
                saveGame();
            }
            const decision=getAutoDecision(characterIndex);
            const result=originalAutoActionForCharacter.apply(this,arguments);

            try{
                const character=getPartyCharacterByIndex(characterIndex);
                const config=getPartyAutoConfig(characterIndex);
                const autoOn=characterIndex===0 ? autoBattle : config.enabled;

                if(
                    !battleActive ||
                    !character ||
                    character.hp<=0 ||
                    !autoOn ||
                    token!==battleToken
                ){
                    return result;
                }

                const queued=queuedPlayerActions[characterIndex];

                if(decision.kind==="skill"){
                    if(queued && queued.action==="normal"){
                        queued.action=decision.action;
                        addNoticeOnce(
                            characterIndex,
                            "corrected:"+decision.action,
                            "偵測到「"+decision.skill.name+"」被錯誤排成普通攻擊，已自動校正並施放技能。"
                        );
                    }
                    else if(queued && queued.action===decision.action){
                        lastNoticeByCharacter[characterIndex]=null;
                    }
                }
                else if(decision.kind==="fallback" && queued){
                    /* 舊引擎沒有檢查「技能仍在裝備欄」；設定殘留時甚至可能
                       反過來施放未裝備技能。V136 在同一個決策點一起收口。 */
                    queued.action="normal";
                    addNoticeOnce(
                        characterIndex,
                        "fallback:"+decision.action+":"+decision.message,
                        decision.message
                    );
                }
                else if(decision.kind==="normal" && queued && queued.action==="normal"){
                    addNoticeOnce(
                        characterIndex,
                        "explicit-normal",
                        decision.message
                    );
                }

                /* Offensive auto actions share one stable position priority.
                   They keep attacking target #1 while it lives, then advance
                   #2 → #3 → #4 → #5 only after the earlier position dies. */
                enforceAutoTargetPriority(queued);
            }
            catch(error){
                console.error("V136 自動戰鬥校正失敗：",error);
            }

            return result;
        };
    }

    /* 提供給瀏覽器測試／之後除錯，直接讀到引擎同一份判斷結果。 */
    window.v136GetAutoBattleDecision=getAutoDecision;
    window.v136GetPriorityAutoTarget=getPriorityAutoTarget;
})();


/* bundled source: js/32-v139-rested-experience.js */
/*
   V139 — 休息經驗

   - 離線／切到背景每2分鐘累積1場，最多300場。
   - 一般練功勝利消耗1場，該場EXP變成2倍。
   - 元素匣啟用期間不累積；元素匣與副本也不使用、不消耗。
   - 狀態存於獨立localStorage key，不改既有主存檔結構。
*/
(function installV139RestedExperience(){
    "use strict";

    const RESTED_EXP_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("rested-exp-state");
    const RESTED_EXP_MAX_BATTLES=300;
    const RESTED_EXP_MINUTES_PER_BATTLE=2;
    const RESTED_EXP_MS_PER_BATTLE=RESTED_EXP_MINUTES_PER_BATTLE*60*1000;
    const RESTED_EXP_HEARTBEAT_MS=30*1000;

    function emptyRestedState(now){
        return {
            battles:0,
            progressMs:0,
            lastSeenAt:now,
            blockedByElementBox:false
        };
    }

    function hasCreatedCharacter(){
        return typeof player!=="undefined" && !!(player && player.id);
    }

    function sanitizeRestedState(raw,now){
        const source=raw && typeof raw==="object" ? raw : {};
        return {
            battles:Math.min(
                RESTED_EXP_MAX_BATTLES,
                Math.max(0,Math.floor(Number(source.battles)||0))
            ),
            progressMs:Math.max(
                0,
                Math.min(
                    RESTED_EXP_MS_PER_BATTLE-1,
                    Math.floor(Number(source.progressMs)||0)
                )
            ),
            lastSeenAt:Number.isFinite(Number(source.lastSeenAt))
                ? Math.min(now,Number(source.lastSeenAt))
                : now,
            blockedByElementBox:source.blockedByElementBox===true
        };
    }

    function readRestedState(now){
        if(!hasCreatedCharacter()){
            try{ localStorage.removeItem(RESTED_EXP_STORAGE_KEY); }catch(_){ }
            return emptyRestedState(now);
        }
        try{
            const raw=JSON.parse(localStorage.getItem(RESTED_EXP_STORAGE_KEY)||"null");
            return sanitizeRestedState(raw,now);
        }catch(_){
            return emptyRestedState(now);
        }
    }

    let restedState=readRestedState(Date.now());

    function persistRestedState(){
        if(!hasCreatedCharacter()){
            try{ localStorage.removeItem(RESTED_EXP_STORAGE_KEY); }catch(_){ }
            return;
        }
        try{
            localStorage.setItem(
                RESTED_EXP_STORAGE_KEY,
                JSON.stringify({
                    battles:restedState.battles,
                    progressMs:restedState.progressMs,
                    lastSeenAt:restedState.lastSeenAt,
                    blockedByElementBox:restedState.blockedByElementBox
                })
            );
        }catch(_){ }
    }

    function accrueRestedMilliseconds(elapsedMs){
        const safeElapsed=Math.max(0,Math.floor(Number(elapsedMs)||0));
        if(safeElapsed<=0 || restedState.battles>=RESTED_EXP_MAX_BATTLES){
            if(restedState.battles>=RESTED_EXP_MAX_BATTLES){
                restedState.progressMs=0;
            }
            return 0;
        }

        /* 超過累積上限所需的時間沒有差別，先封頂避免異常時鐘
           產生不必要的大數字。 */
        const cappedElapsed=Math.min(
            safeElapsed,
            RESTED_EXP_MAX_BATTLES*RESTED_EXP_MS_PER_BATTLE
        );
        const totalMs=restedState.progressMs+cappedElapsed;
        const earned=Math.floor(totalMs/RESTED_EXP_MS_PER_BATTLE);
        const accepted=Math.min(
            earned,
            RESTED_EXP_MAX_BATTLES-restedState.battles
        );

        restedState.battles+=accepted;
        restedState.progressMs=restedState.battles>=RESTED_EXP_MAX_BATTLES
            ? 0
            : totalMs-earned*RESTED_EXP_MS_PER_BATTLE;
        return accepted;
    }

    function getNextRestedBattleText(){
        if(restedState.battles>=RESTED_EXP_MAX_BATTLES){
            return "已達累積上限";
        }
        const remainingMs=Math.max(
            1,
            RESTED_EXP_MS_PER_BATTLE-restedState.progressMs
        );
        return "距離下一場約 "+Math.ceil(remainingMs/60000)+" 分鐘";
    }

    function updateRestedExperienceDisplay(){
        const count=document.getElementById("v139RestedExpCount");
        const next=document.getElementById("v139RestedExpNext");
        if(count){ count.textContent=String(restedState.battles); }
        if(next){ next.textContent=getNextRestedBattleText(); }
    }

    function renderRestedExperiencePanel(){
        return (
            '<section class="v139-rested-exp-panel" aria-label="休息經驗">'+
                '<div class="v139-rested-exp-heading">休息經驗</div>'+
                '<div class="v139-rested-exp-count">'+
                    '<strong id="v139RestedExpCount">'+restedState.battles+'</strong>'+
                    '<span>／'+RESTED_EXP_MAX_BATTLES+' 場</span>'+
                '</div>'+
                '<p>一般練功勝利 EXP ×2；元素匣啟用期間不累積，元素匣與副本也不會使用或消耗。</p>'+
                '<div class="v139-rested-exp-meta">'+
                    '每離線 '+RESTED_EXP_MINUTES_PER_BATTLE+' 分鐘累積 1 場・'+
                    '<span id="v139RestedExpNext">'+getNextRestedBattleText()+'</span>'+
                '</div>'+
            '</section>'
        );
    }

    if(typeof renderOfflineExpContent==="function"){
        const originalRenderOfflineExpContent=renderOfflineExpContent;
        renderOfflineExpContent=function(){
            return originalRenderOfflineExpContent.apply(this,arguments)+
                renderRestedExperiencePanel();
        };
    }

    function isElementBoxActive(){
        if(typeof window.v131GetElementBoxState!=="function"){ return false; }
        try{
            const state=window.v131GetElementBoxState();
            return !!(state && state.active);
        }catch(_){
            return false;
        }
    }

    function syncAccrualToNow(){
        const now=Date.now();
        if(!restedState.blockedByElementBox && !isElementBoxActive()){
            accrueRestedMilliseconds(now-restedState.lastSeenAt);
        }
        restedState.lastSeenAt=now;
        restedState.blockedByElementBox=isElementBoxActive();
        persistRestedState();
        updateRestedExperienceDisplay();
    }

    /* 第一次載入時，把上次心跳到現在的時間視為離線時間。
       新系統第一次出現時沒有舊狀態，不會倒推發送不存在的場數。 */
    if(hasCreatedCharacter()){
        syncAccrualToNow();
    }

    window.v139RestedExpConfig=Object.freeze({
        maxBattles:RESTED_EXP_MAX_BATTLES,
        minutesPerBattle:RESTED_EXP_MINUTES_PER_BATTLE,
        multiplier:2
    });

    window.v139GetRestedExpState=function(){
        return {
            battles:restedState.battles,
            progressMs:restedState.progressMs,
            maxBattles:RESTED_EXP_MAX_BATTLES,
            minutesPerBattle:RESTED_EXP_MINUTES_PER_BATTLE,
            blockedByElementBox:restedState.blockedByElementBox
        };
    };

    window.v139AccrueRestedMinutes=function(minutes){
        const earned=accrueRestedMilliseconds(
            Math.max(0,Number(minutes)||0)*60*1000
        );
        restedState.lastSeenAt=Date.now();
        persistRestedState();
        updateRestedExperienceDisplay();
        return earned;
    };

    window.v139TryConsumeRestedBattle=function(){
        if(restedState.battles<=0){
            return {applied:false,remainingBattles:0};
        }
        restedState.battles--;
        restedState.lastSeenAt=Date.now();
        persistRestedState();
        updateRestedExperienceDisplay();
        return {
            applied:true,
            remainingBattles:restedState.battles
        };
    };

    document.addEventListener("visibilitychange",function(){
        if(document.hidden){
            restedState.lastSeenAt=Date.now();
            restedState.blockedByElementBox=isElementBoxActive();
            persistRestedState();
            return;
        }
        syncAccrualToNow();
    });

    function markVisibleHeartbeat(){
        if(document.hidden){ return; }
        restedState.lastSeenAt=Date.now();
        restedState.blockedByElementBox=isElementBoxActive();
        persistRestedState();
    }

    window.addEventListener("pagehide",function(){
        if(!document.hidden){ markVisibleHeartbeat(); }
    });
    window.addEventListener("beforeunload",markVisibleHeartbeat);
    setInterval(markVisibleHeartbeat,RESTED_EXP_HEARTBEAT_MS);

})();


/* bundled source: js/33-v140-four-element-balance.js */
/* =====================================================
   V140 — 四元素技能平衡定案

   以 2026-08-27 玩家提供的完整四元素技能表為準：
   1. 校正四元素技能數值與說明
   2. 物理／法術技能的異常命中屬性來源
   3. 水系七招吸血只回復 HP
   4. 怒火的爆擊率與爆擊傷害分開計算
   5. 治療術只會為其他友方目標回復 SP，不補施放者本人 SP
   6. 技能「結界」只擋 5 次直接傷害、最多 5 回合，DOT 穿透
   7. 最終命中率下限 60% → 50%

   不重構其他戰鬥系統，不改玩家能力、存檔結構，
   符咒與對應技能共用同一套效果規則。
===================================================== */
(function applyV140FourElementBalance(){
    "use strict";

    const GENERAL_STATUS_BOUNDS={min:5,max:95};
    const LOCKDOWN_STATUS_BOUNDS={
        regular:{min:5,max:80},
        elite:{min:5,max:60},
        boss:{min:5,max:40}
    };
    const LEVEL_FACTOR_PER_LEVEL=0.02;
    const LEVEL_FACTOR_MIN=0.70;
    const LEVEL_FACTOR_MAX=1.30;
    const GENERAL_STATUS_COEFFICIENT=0.05;
    const LOCKDOWN_STATUS_COEFFICIENT=0.2;
    const GENERAL_STATUS_SPIRIT_COEFFICIENT=0.05;
    const LOCKDOWN_STATUS_SPIRIT_COEFFICIENT=0.3;

    const LIFESTEAL_BY_SKILL={
        waterKnife:[4,5,6,7,8],
        frostPunch:[4,5,6,7,8],
        iceSpin:[3,4,5,6,7],
        frostCrush:[4,5,6,7,8],
        waterBall:[3,4,5,6,7],
        floodBeast:[4,5,6,7,8],
        iceArrowRain:[1,2,3,4,5]
    };

    let statusSkillContext=null;

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clamp(value,min,max){
        return Math.max(min,Math.min(max,value));
    }

    function setDamageSkill(skillId,baseDamage,damagePerLevel,description){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        skill.baseDamage=baseDamage;
        skill.damagePerLevel=damagePerLevel;
        skill.description=description;
    }

    function setLifestealSkill(skillId,values,description){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        skill.lifestealPercentByLevel=values.slice();
        skill.description=description;
    }

    function setSkillFields(skillId,fields){
        const skill=skillDatabase[skillId];
        if(!skill){ return; }
        Object.keys(fields).forEach(key=>{
            const value=fields[key];
            skill[key]=Array.isArray(value)?value.slice():value;
        });
    }

    setDamageSkill(
        "fireRocket",
        17,
        8,
        "對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害，最高5級，每升1級傷害+8。"
    );

    setSkillFields("flameTornado",{
        burnPercentByLevel:[3,4,5,6,8],
        description:"對任一橫排目標各造成40點基礎法術傷害；30%基礎機率燃燒2回合，每回合造成目標最大HP的3%/4%/5%/6%/8%傷害。"
    });

    setSkillFields("phoenixCry",{
        burnPercentByLevel:[5,7,9,11,13],
        description:"對敵方全體各造成53點基礎法術傷害；50%基礎機率燃燒2回合，每回合造成目標最大HP的5%/7%/9%/11%/13%傷害。"
    });

    setSkillFields("rage",{
        /* 舊引擎仍讀 critBonusByLevel，讓它代表爆擊率以保留相容。 */
        critBonusByLevel:[5,10,15,20,25],
        critChanceBonusByLevel:[5,10,15,20,25],
        critDamageBonusByLevel:[10,20,30,40,50],
        description:"提高我方最多3名存活角色的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續2回合。"
    });

    setSkillFields("stormFist",{
        agilityDownByLevel:[30,40,50,60,70],
        description:"對單體造成14點基礎傷害；50%基礎機率降低敏捷1回合，降低30%/40%/50%/60%/70%。"
    });

    setSkillFields("healSpell",{
        description:"擇一友方目標，恢復HP與SP。HP基礎40、SP基礎15，兩者每升1級基礎恢復量+5；保留既有智力與水元素EX回復加成，施放者本人不回復SP。"
    });

    setSkillFields("barrier",{
        spCost:40,
        duration:5,
        barrierBlockCount:5,
        description:"使我方單一目標獲得結界，完全抵擋接下來5次直接傷害，最多存在5回合；燃燒、毒等持續傷害不會被抵擋，也不消耗次數。"
    });

    setDamageSkill(
        "frostPunch",
        30,
        8,
        "對單體造成30點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );

    setDamageSkill(
        "stoneBreakSky",
        65,
        9,
        "對單體造成65點基礎傷害；為我方全體增加100/125/150/175/200點護盾，持續2回合。"
    );

    setLifestealSkill(
        "waterKnife",
        LIFESTEAL_BY_SKILL.waterKnife,
        "對單體造成13點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "frostPunch",
        LIFESTEAL_BY_SKILL.frostPunch,
        "對單體造成30點基礎傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "iceSpin",
        LIFESTEAL_BY_SKILL.iceSpin,
        "對同一橫排左、中、右最多3名目標各造成25點基礎傷害；吸取實際造成傷害的3%/4%/5%/6%/7%，只恢復自身HP。"
    );
    setLifestealSkill(
        "frostCrush",
        LIFESTEAL_BY_SKILL.frostCrush,
        "對單體造成100點基礎傷害；45%機率冰封1回合；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "waterBall",
        LIFESTEAL_BY_SKILL.waterBall,
        "對同一橫排左、中、右最多3名目標各造成17點基礎法術傷害；吸取實際造成傷害的3%/4%/5%/6%/7%，只恢復自身HP。"
    );
    setLifestealSkill(
        "floodBeast",
        LIFESTEAL_BY_SKILL.floodBeast,
        "對單體造成35點基礎法術傷害；吸取實際造成傷害的4%/5%/6%/7%/8%，只恢復自身HP。"
    );
    setLifestealSkill(
        "iceArrowRain",
        LIFESTEAL_BY_SKILL.iceArrowRain,
        "對敵方全體各造成30點基礎法術傷害；吸取實際造成傷害的1%/2%/3%/4%/5%，只恢復自身HP；並有50%基礎機率使隨機單一目標冰封2回合。"
    );

    /*
       純計算入口同時供正式判定與回歸測試使用。
       等級差、精神、額外抗性及既有上下限完整保留；
       一般異常的物理攻擊／智力與目標精神統一使用0.05；
       硬控仍維持開根號屬性加成與原本精神係數。
    */
    function calculateV140StatusChance(
        baseChancePercent,
        casterLevel,
        targetLevel,
        offensivePower,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent,
        skillCategory
    ){
        const levelFactor=clamp(
            1+(numeric(casterLevel)-numeric(targetLevel))*LEVEL_FACTOR_PER_LEVEL,
            LEVEL_FACTOR_MIN,
            LEVEL_FACTOR_MAX
        );

        const power=Math.max(0,numeric(offensivePower));
        const attributeBonus=isLockdown
            ? Math.sqrt(power)*LOCKDOWN_STATUS_COEFFICIENT
            : power*GENERAL_STATUS_COEFFICIENT;
        const spiritCoefficient=isLockdown
            ? LOCKDOWN_STATUS_SPIRIT_COEFFICIENT
            : GENERAL_STATUS_SPIRIT_COEFFICIENT;

        const rawChance=
            numeric(baseChancePercent)*levelFactor+
            attributeBonus-
            Math.max(0,numeric(targetSpirit))*spiritCoefficient-
            numeric(targetBonusResistancePercent);

        const bounds=isLockdown
            ? (LOCKDOWN_STATUS_BOUNDS[targetRank]||LOCKDOWN_STATUS_BOUNDS.regular)
            : GENERAL_STATUS_BOUNDS;

        return clamp(rawChance,bounds.min,bounds.max);
    }

    window.v140CalculateStatusEffectChance=calculateV140StatusChance;

    const previousCalculateStatusEffectChance=calculateStatusEffectChance;
    calculateStatusEffectChance=function(
        baseChancePercent,
        casterLevel,
        targetLevel,
        casterIntelligence,
        targetSpirit,
        isLockdown,
        targetRank,
        targetBonusResistancePercent
    ){
        const context=statusSkillContext;
        const category=context&&context.skill
            ? context.skill.category
            : "magic";
        const offensivePower=context&&context.skill
            ? (category==="physical"
                ? context.physicalAttack
                : context.intelligence)
            : casterIntelligence;

        return calculateV140StatusChance(
            baseChancePercent,
            casterLevel,
            targetLevel,
            offensivePower,
            targetSpirit,
            isLockdown,
            targetRank,
            targetBonusResistancePercent,
            category
        );
    };

    /*
       命中先依既有命中值算出基礎命中率，再套用正式閃躲率。
       暈眩等「最終命中率降低」效果最後才直接扣除百分點；
       閃躲來源本身已在角色能力端用乘算合併，最終上限85%。
    */
    function getV140HitChancePercent(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent
    ){
        const rawAccuracyChance=
            95+
            casterAccuracy*0.3;

        const accuracyChance=clamp(
            rawAccuracyChance,
            50,
            99
        );
        const evasionRate=clamp(targetEvasion,0,85);
        const evasionAdjustedChance=
            accuracyChance*(1-evasionRate/100);

        return clamp(
            evasionAdjustedChance-
            Math.max(0,numeric(directChanceReductionPercent)),
            1,
            99
        );
    }

    window.v140GetHitChancePercent=getV140HitChancePercent;

    rollHitChance=function(
        casterAccuracy,
        targetEvasion,
        directChanceReductionPercent
    ){
        return Math.random()*100<getV140HitChancePercent(
            casterAccuracy,
            targetEvasion,
            directChanceReductionPercent
        );
    };

    /*
       怒火改為兩組獨立數值。舊函式一次只讀 bonusPercent，
       因此先以爆擊率加成讓舊函式完成擲骰，命中爆擊後
       再只補上爆傷差額；其他自然爆擊、火EX與抗暴公式不變。
    */
    const previousRollCritical=rollCritical;
    rollCritical=function(character,category,targetAntiCritPercent){
        const rageBuff=(character&&character.activeBuffs||[])
            .find(buff=>buff&&buff.type==="rage");

        if(
            !rageBuff||
            rageBuff.critChanceBonusPercent===undefined||
            rageBuff.critDamageBonusPercent===undefined
        ){
            return previousRollCritical.apply(this,arguments);
        }

        const previousBonus=rageBuff.bonusPercent;
        const chanceBonus=numeric(rageBuff.critChanceBonusPercent);
        const damageBonus=numeric(rageBuff.critDamageBonusPercent);
        let result;

        rageBuff.bonusPercent=chanceBonus;
        try{
            result=previousRollCritical.apply(this,arguments);
        }finally{
            rageBuff.bonusPercent=previousBonus;
        }

        if(result&&result.isCrit){
            return Object.assign({},result,{
                multiplier:Math.min(
                    typeof CRIT_MULTIPLIER_MAX==="number"?CRIT_MULTIPLIER_MAX:2.25,
                    result.multiplier+(damageBonus-chanceBonus)/100
                )
            });
        }
        return result;
    };

    /* 背包角色詳情也要顯示同一組實際戰鬥數值。 */
    if(typeof getInventoryCharacterCriticalStats==="function"){
        const previousGetInventoryCharacterCriticalStats=
            getInventoryCharacterCriticalStats;

        getInventoryCharacterCriticalStats=function(index){
            const character=typeof getBackpackCharacter==="function"
                ? getBackpackCharacter(index)
                : null;
            const buffs=character&&Array.isArray(character.activeBuffs)
                ? character.activeBuffs
                : null;
            const rageBuff=buffs&&buffs.find(buff=>
                buff&&
                buff.type==="rage"&&
                buff.critChanceBonusPercent!==undefined&&
                buff.critDamageBonusPercent!==undefined
            );

            if(!rageBuff){
                return previousGetInventoryCharacterCriticalStats.apply(this,arguments);
            }

            character.activeBuffs=buffs.filter(buff=>buff!==rageBuff);
            let result;
            try{
                result=previousGetInventoryCharacterCriticalStats.apply(this,arguments);
            }finally{
                character.activeBuffs=buffs;
            }

            if(!result){ return result; }
            const chanceBonus=numeric(rageBuff.critChanceBonusPercent);
            const damageBonus=numeric(rageBuff.critDamageBonusPercent)/100;
            ["physical","magic"].forEach(key=>{
                if(!result[key]){ return; }
                result[key].chance+=chanceBonus;
                result[key].multiplier+=damageBonus;
            });
            return result;
        };
    }

    function getV140RageValues(level){
        const skill=skillDatabase.rage||{};
        const index=Math.max(0,numeric(level)-1);
        return {
            chance:numeric((skill.critChanceBonusByLevel||[])[index]),
            damage:numeric((skill.critDamageBonusByLevel||[])[index])
        };
    }

    function isV140SkillBarrier(buff){
        return !!(
            buff&&
            buff.type==="barrier"&&
            buff.turnsLeft>0
        );
    }

    let directBarrierCastContext=null;

    function consumeV140DirectBarrier(character){
        if(
            directBarrierCastContext&&
            directBarrierCastContext.blockedCharacters.has(character)
        ){
            return true;
        }

        const buffs=character&&Array.isArray(character.activeBuffs)
            ? character.activeBuffs
            : [];
        const barrier=buffs.find(isV140SkillBarrier);
        if(!barrier){ return false; }

        if(!Number.isFinite(Number(barrier.remainingBlocks))){
            barrier.remainingBlocks=numeric(skillDatabase.barrier.barrierBlockCount)||5;
        }

        const remaining=Math.max(0,numeric(barrier.remainingBlocks));
        if(remaining<=0){
            character.activeBuffs=buffs.filter(buff=>buff!==barrier);
            return false;
        }

        barrier.remainingBlocks=remaining-1;
        if(directBarrierCastContext){
            directBarrierCastContext.blockedCharacters.add(character);
        }
        if(barrier.remainingBlocks<=0){
            character.activeBuffs=buffs.filter(buff=>buff!==barrier);
        }
        return true;
    }

    window.v140ConsumeDirectBarrier=consumeV140DirectBarrier;
    window.v173WithDirectBarrierCast=function(callback){
        const previousContext=directBarrierCastContext;
        directBarrierCastContext={blockedCharacters:new Set()};
        try{ return callback(); }
        finally{ directBarrierCastContext=previousContext; }
    };

    /* 讓技能施放後的 buff 帶有新規格需要的獨立欄位。 */
    const previousCastBuffSkill=castBuffSkill;
    castBuffSkill=function(skillId,targetIndex){
        const skill=skillDatabase[skillId];
        const level=skill&&typeof getSkillLevel==="function"
            ? getSkillLevel("fire",skillId)
            : 0;
        const rageValues=getV140RageValues(level);
        let didCast=false;

        const previousBadge=typeof showSkillNameBadge==="function"
            ? showSkillNameBadge
            : null;
        const previousLog=typeof addBattleLog==="function"
            ? addBattleLog
            : null;

        if(previousBadge){
            showSkillNameBadge=function(skillName){
                if(skill&&skillName===skill.name){ didCast=true; }
                return previousBadge.apply(this,arguments);
            };
        }

        if(previousLog&&(skillId==="rage"||skillId==="barrier")){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                if(skillId==="rage"&&String(message).includes("怒火生效")){
                    args[0]=
                        "怒火生效！我方最多3人爆擊率提升"+
                        rageValues.chance+"%、爆擊傷害提升"+
                        rageValues.damage+"%，持續"+skill.duration+"回合。";
                }
                else if(skillId==="barrier"&&String(message).includes("獲得結界")){
                    args[0]=String(message).replace(
                        /可抵擋所有傷害，持續\d+回合。/,
                        "可抵擋接下來5次直接傷害，最多持續5回合。"
                    );
                }
                return previousLog.apply(this,args);
            };
        }

        let result;
        try{
            result=previousCastBuffSkill.apply(this,arguments);
        }finally{
            if(previousBadge){ showSkillNameBadge=previousBadge; }
            if(previousLog&&(skillId==="rage"||skillId==="barrier")){
                addBattleLog=previousLog;
            }
        }

        if(!didCast){ return result; }

        if(skillId==="rage"&&typeof getActivePlayerCharacters==="function"){
            getActivePlayerCharacters().slice(0,3).forEach(character=>{
                const buff=(character.activeBuffs||[])
                    .find(entry=>entry.type==="rage"&&entry.turnsLeft>0);
                if(!buff){ return; }
                buff.bonusPercent=rageValues.chance;
                buff.critChanceBonusPercent=rageValues.chance;
                buff.critDamageBonusPercent=rageValues.damage;
            });
        }
        else if(skillId==="barrier"){
            const target=typeof getBattleCharacterByIndex==="function"
                ? getBattleCharacterByIndex(
                    targetIndex===null||targetIndex===undefined?0:targetIndex
                )
                : null;
            const buff=target&&(target.activeBuffs||[])
                .find(entry=>entry.type==="barrier"&&entry.turnsLeft>0);
            if(buff){
                buff.sourceSkill="barrier";
                buff.barrierRule="shared";
                buff.remainingBlocks=numeric(skill.barrierBlockCount)||5;
            }
        }

        return result;
    };

    /*
       符咒不另寫一份持續回合與結界規則：冰封符、隱身符、
       結界符分別讀對應技能。階級機率只負責畫符啟動；畫符成功後再依角色素質套用對應技能命中規則。
    */
    function syncV140TalismanDefinitions(){
        if(typeof window.v132GetTalismanDefinition!=="function"){ return; }

        const effects={
            freeze:{
                skillId:"freeze",
                duration:numeric(skillDatabase.freeze&&skillDatabase.freeze.freezeDuration)
            },
            stealth:{
                skillId:"stealthSkill",
                duration:numeric(skillDatabase.stealthSkill&&skillDatabase.stealthSkill.duration)
            },
            barrier:{
                skillId:"barrier",
                duration:numeric(skillDatabase.barrier&&skillDatabase.barrier.duration),
                blockCount:numeric(skillDatabase.barrier&&skillDatabase.barrier.barrierBlockCount)
            }
        };
        const tiers=["Low","Mid","High","Perfect"];

        Object.entries(effects).forEach(([effectKey,effect])=>{
            tiers.forEach(tier=>{
                const definition=window.v132GetTalismanDefinition(
                    effectKey+"Talisman"+tier
                );
                if(!definition){ return; }
                definition.sharedSkillId=effect.skillId;
                definition.talismanSkillLevel=Math.max(1,numeric(skillDatabase[effect.skillId]&&skillDatabase[effect.skillId].maxLevel)||1);
                if(effect.duration>0){ definition.talismanDuration=effect.duration; }
                if(effect.blockCount>0){ definition.barrierBlockCount=effect.blockCount; }
            });
        });
    }

    syncV140TalismanDefinitions();

    if(
        typeof resolveQueuedPlayerAction==="function"&&
        typeof window.v132GetTalismanDefinition==="function"
    ){
        const previousResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=typeof queuedPlayerActions!=="undefined"
                ? queuedPlayerActions[characterIndex]
                : null;
            const definition=queued&&queued.action
                ? window.v132GetTalismanDefinition(queued.action)
                : null;

            if(!definition){
                return previousResolveQueuedPlayerAction.apply(this,arguments);
            }

            let target=null;
            let previousBuffs=[];
            if(definition.talismanEffect==="barrier"){
                const caster=getBattleCharacterByIndex(characterIndex);
                target=queued&&Number.isInteger(queued.targetAlly)
                    ? getBattleCharacterByIndex(queued.targetAlly)
                    : caster;
                if(!target||target.hp<=0){ target=caster; }
                previousBuffs=target&&Array.isArray(target.activeBuffs)
                    ? target.activeBuffs.slice()
                    : [];
            }

            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog&&definition.talismanEffect==="barrier"){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    args[0]=String(message).replace(
                        /獲得結界，可抵擋所有傷害，持續\d+回合。/,
                        "獲得結界，可抵擋接下來5次直接傷害，最多持續5回合。"
                    );
                    return previousLog.apply(this,args);
                };
            }

            let result;
            try{
                result=previousResolveQueuedPlayerAction.apply(this,arguments);
            }finally{
                if(previousLog&&definition.talismanEffect==="barrier"){
                    addBattleLog=previousLog;
                }
            }

            if(target&&definition.talismanEffect==="barrier"){
                const buff=(target.activeBuffs||[]).find(entry=>
                    entry&&
                    entry.type==="barrier"&&
                    !previousBuffs.includes(entry)
                );
                if(buff){
                    buff.turnsLeft=numeric(skillDatabase.barrier.duration)||5;
                    buff.remainingBlocks=
                        numeric(skillDatabase.barrier.barrierBlockCount)||5;
                    buff.sourceTalisman=definition.id;
                    buff.barrierRule="shared";
                }
            }

            return result;
        };
    }

    function hpOnlyLifestealText(value){
        return String(value)
            .replace(/攻擊技能可吸取HP與SP/g,"攻擊技能可吸取HP")
            .replace(/HP\/SP吸取/g,"HP吸取")
            .replace(/等量回復自身HP與SP/g,"只回復自身HP")
            .replace(/等量恢復自身HP與SP/g,"只恢復自身HP")
            .replace(/（回復HP\/SP）/g,"（只回復HP）");
    }

    function hpOnlyBattleLogText(value){
        return hpOnlyLifestealText(value)
            .replace(/點HP與SP/g,"點HP")
            .replace(/回復HP與SP/g,"回復HP")
            .replace(/恢復(\d+)點HP、\d+點SP/g,"恢復$1點HP");
    }

    function correctV140SkillText(value,skill,level){
        let text=hpOnlyLifestealText(value);

        const rage=skillDatabase.rage;
        if(!rage){ return text; }

        const replaceAtLevel=(targetLevel)=>{
            const values=getV140RageValues(targetLevel);
            [
                "爆擊率／爆擊傷害 +"+values.chance+"%",
                "我方爆擊率與爆擊傷害 +"+values.chance+"%"
            ].forEach(oldText=>{
                text=text.split(oldText).join(
                    (oldText.startsWith("我方")?"我方":"")+
                    "爆擊率 +"+values.chance+"%、爆擊傷害 +"+
                    values.damage+"%"
                );
            });
        };

        if(skill&&skill.id==="rage"&&numeric(level)>0){
            replaceAtLevel(level);
        }
        else{
            for(let lv=1;lv<=(rage.maxLevel||5);lv++){
                replaceAtLevel(lv);
            }
        }
        return text;
    }

    function refreshUIAfterSpCorrection(){
        try{
            if(typeof updateUI==="function"){
                updateUI();
            }
        }catch(error){
            console.error("V140 更新SP顯示失敗：",error);
        }
    }

    function runPlayerSkillWithV140Context(skill,caster,stats,execute){
        if(!skill||!caster||!stats){
            return execute();
        }

        const previousContext=statusSkillContext;
        const context={
            skill:skill,
            physicalAttack:numeric(stats.attack),
            intelligence:numeric(stats.intelligence),
            spAfterCost:null
        };
        statusSkillContext=context;

        const isLifesteal=Array.isArray(skill.lifestealPercentByLevel);
        const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
        const previousBadge=typeof showSkillNameBadge==="function"?showSkillNameBadge:null;

        if(isLifesteal&&previousLog){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                args[0]=hpOnlyBattleLogText(message);
                return previousLog.apply(this,args);
            };
        }

        if(isLifesteal&&previousBadge){
            showSkillNameBadge=function(){
                if(context.spAfterCost===null){
                    context.spAfterCost=numeric(caster.sp);
                }
                return previousBadge.apply(this,arguments);
            };
        }

        let result;
        try{
            result=execute();
        }finally{
            if(isLifesteal&&previousBadge){
                showSkillNameBadge=previousBadge;
            }
            if(isLifesteal&&previousLog){
                addBattleLog=previousLog;
            }
            statusSkillContext=previousContext;

            if(
                isLifesteal&&
                context.spAfterCost!==null&&
                numeric(caster.sp)>context.spAfterCost
            ){
                caster.sp=context.spAfterCost;
                refreshUIAfterSpCorrection();
            }
        }
        return result;
    }

    const previousCastDamageSkill=castDamageSkill;
    castDamageSkill=function(skillId){
        const skill=skillDatabase[skillId];
        const stats=typeof getMainCharacterStats==="function"
            ? getMainCharacterStats()
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            typeof player!=="undefined"?player:null,
            stats,
            ()=>previousCastDamageSkill.apply(this,arguments)
        );
    };

    const previousCastSecondaryCharacterSkill=castSecondaryCharacterSkill;
    castSecondaryCharacterSkill=function(characterIndex,skillId){
        const skill=skillDatabase[skillId];
        const character=typeof getPartyCharacterByIndex==="function"
            ? getPartyCharacterByIndex(characterIndex)
            : null;
        const stats=typeof getPartyBattleStats==="function"
            ? getPartyBattleStats(characterIndex)
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            character,
            stats,
            ()=>previousCastSecondaryCharacterSkill.apply(this,arguments)
        );
    };

    const previousCastPlayer2Skill=castPlayer2Skill;
    castPlayer2Skill=function(skillId){
        const skill=skillDatabase[skillId];
        const stats=typeof getPlayer2BattleStats==="function"
            ? getPlayer2BattleStats()
            : null;
        return runPlayerSkillWithV140Context(
            skill,
            typeof player2!=="undefined"?player2:null,
            stats,
            ()=>previousCastPlayer2Skill.apply(this,arguments)
        );
    };

    function getMonsterPhysicalAttack(monster){
        if(!monster){ return 0; }
        const reduction=typeof getStatDownPercentFor==="function"
            ? numeric(getStatDownPercentFor(monster,"attack"))
            : 0;
        return Math.max(0,numeric(monster.attack)*(1-reduction/100));
    }

    function getMonsterIntelligence(monster){
        if(!monster){ return 0; }
        if(typeof getMonsterEffectiveAbilityPoints==="function"){
            return numeric(getMonsterEffectiveAbilityPoints(monster,"intelligence"));
        }
        return numeric(monster.intelligencePoints);
    }

    function findSkillByName(name){
        return Object.keys(skillDatabase)
            .map(id=>skillDatabase[id])
            .find(skill=>skill&&skill.name===name)||null;
    }

    /* 技能與結界符共用規則：DOT 不抵擋、也不消耗次數。 */
    const previousTickStatusEffects=tickStatusEffects;
    tickStatusEffects=function(){
        const previousHasActiveBuff=hasActiveBuff;
        hasActiveBuff=function(character,buffType){
            if(buffType!=="barrier"){
                return previousHasActiveBuff.apply(this,arguments);
            }
            return false;
        };

        try{
            return previousTickStatusEffects.apply(this,arguments);
        }finally{
            hasActiveBuff=previousHasActiveBuff;
        }
    };

    const previousProcessSingleMonsterAttack=processSingleMonsterAttack;
    processSingleMonsterAttack=function(monsterIndex){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster){
            return previousProcessSingleMonsterAttack.apply(this,arguments);
        }

        const previousContext=statusSkillContext;
        const previousBarrierContext=directBarrierCastContext;
        directBarrierCastContext={blockedCharacters:new Set()};
        const context={
            skill:null,
            physicalAttack:getMonsterPhysicalAttack(monster),
            intelligence:getMonsterIntelligence(monster),
            spAfterCost:null
        };
        statusSkillContext=context;

        const previousBadge=typeof showMonsterSkillNameBadge==="function"
            ? showMonsterSkillNameBadge
            : null;
        const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
        const previousHasActiveBuff=hasActiveBuff;

        hasActiveBuff=function(character,buffType){
            if(buffType==="barrier"&&consumeV140DirectBarrier(character)){
                return true;
            }
            return previousHasActiveBuff.apply(this,arguments);
        };

        if(previousBadge){
            showMonsterSkillNameBadge=function(skillName){
                context.skill=findSkillByName(skillName);
                if(context.skill&&context.skill.lifestealPercentByLevel){
                    context.spAfterCost=numeric(monster.sp);
                }
                return previousBadge.apply(this,arguments);
            };
        }

        if(previousLog){
            addBattleLog=function(message){
                const args=Array.prototype.slice.call(arguments);
                if(context.skill&&context.skill.lifestealPercentByLevel){
                    args[0]=hpOnlyBattleLogText(message);
                }
                return previousLog.apply(this,args);
            };
        }

        let result;
        try{
            result=previousProcessSingleMonsterAttack.apply(this,arguments);
        }finally{
            if(previousBadge){ showMonsterSkillNameBadge=previousBadge; }
            if(previousLog){ addBattleLog=previousLog; }
            hasActiveBuff=previousHasActiveBuff;
            statusSkillContext=previousContext;
            directBarrierCastContext=previousBarrierContext;

            if(
                context.skill&&
                context.skill.lifestealPercentByLevel&&
                context.spAfterCost!==null&&
                numeric(monster.sp)>context.spAfterCost
            ){
                monster.sp=context.spAfterCost;
                refreshUIAfterSpCorrection();
            }
        }
        return result;
    };

    /* 修正技能學習頁與技能詳細視窗裡由舊函式動態組出的 HP/SP 字樣。 */
    function wrapTextResult(functionName){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            return correctV140SkillText(
                previous.apply(this,arguments),
                arguments[0],
                arguments[1]
            );
        };
    }

    wrapTextResult("getSkillEffectPreviewText");
    wrapTextResult("buildSkillLevelBreakdownHTML");

    function correctCreationLifestealText(){
        if(typeof document==="undefined"){ return; }
        [
            "creationElementDescription",
            "creationElementTags",
            "creationSkillDetailDescription",
            "creationSkillDetailLevels"
        ].forEach(id=>{
            const root=document.getElementById(id);
            if(!root){ return; }
            const elements=[root].concat(Array.from(root.querySelectorAll("*")));
            elements.forEach(element=>{
                Array.from(element.childNodes||[]).forEach(node=>{
                    if(node.nodeType===3){
                        node.nodeValue=correctV140SkillText(node.nodeValue,null,null);
                    }
                });
            });
        });
    }

    function wrapCreationFunction(functionName){
        const previous=window[functionName];
        if(typeof previous!=="function"){ return; }
        window[functionName]=function(){
            const result=previous.apply(this,arguments);
            correctCreationLifestealText();
            return result;
        };
    }

    wrapCreationFunction("selectElement");
    wrapCreationFunction("showCreation");
    wrapCreationFunction("showCreationSkillDetail");
    correctCreationLifestealText();

    /* 補丁在初始畫面渲染後才載入，立即重繪一次既有技能列表。 */
    try{
        if(typeof renderSkillLoadout==="function"){
            renderSkillLoadout();
        }
        if(
            typeof document!=="undefined"&&
            typeof document.querySelectorAll==="function"
        ){
            document.querySelectorAll(".creation-skill-chip[data-skill-id]")
                .forEach(chip=>{
                    const skill=skillDatabase[chip.dataset.skillId];
                    if(skill){ chip.title=skill.description||skill.name; }
                });
        }
    }catch(error){
        console.error("V140 更新技能顯示失敗：",error);
    }

    window.v140GetSkillBalanceAudit=function(){
        const ids=[
            "flameSlash","fireCritical","explosiveFlurry","dragonSlash",
            "fireRocket","blazeSpell","flameTornado","phoenixCry","rage","fireEX",
            "waterKnife","frostPunch","iceSpin","frostCrush",
            "waterBall","floodBeast","iceArrowRain","freeze","healSpell","revive","waterEX",
            "stormFist","stormFlurry","windCrossSlash","dizzyFist",
            "windSpell","stormCircle","windHowlLightning","stormRain",
            "dodgeSkill","stealthSkill","dinghaishenzhen","windEX",
            "stoneSlash","petrifyFist","stoneBreakSky","earthquakeCrush",
            "stoneThrow","sandWind","flyingSandStrike","dustStorm",
            "earthShield","rockWall","barrier","earthEX"
        ];
        const fields=[
            "id","name","element","category","targetType","learnCost","maxLevel",
            "baseDamage","damagePerLevel","spCost","duration","requires",
            "burnChance","burnDuration","burnPercentByLevel",
            "critChanceBonusByLevel","critDamageBonusByLevel",
            "lifestealPercentByLevel","freezeChance","freezeDuration",
            "baseHeal","healPerLevel","baseHealSP","healSPPerLevel",
            "reviveHealPercentByLevel","agilityDownChance","agilityDownByLevel",
            "agilityDownDuration","damageDownChance","damageDownByLevel",
            "damageDownDuration","stunChance","missBonusByLevel","stunDuration",
            "evasionBonusPercent","statusResistBonus","defenseDownChance",
            "defenseDownByLevel","defenseDownDuration","allyShieldByLevel",
            "selfShieldByLevel","shieldDuration","petrifyChanceByLevel",
            "petrifyDuration","reflectPercent","defenseBonusPercent",
            "barrierBlockCount","damageBonusPercent","critChanceBonusPercent",
            "critDamageBonusPercent","healBonusPercent"
        ];
        return Object.fromEntries(ids.map(id=>{
            const skill=skillDatabase[id];
            if(!skill){ return [id,null]; }
            const entry={};
            fields.forEach(field=>{
                if(skill[field]===undefined){ return; }
                entry[field]=Array.isArray(skill[field])
                    ? skill[field].slice()
                    : skill[field];
            });
            return [id,entry];
        }));
    };

    /* 保留舊函式參照供除錯；正式流程已由上方覆蓋。 */
    window.v140PreviousCalculateStatusEffectChance=previousCalculateStatusEffectChance;
})();


/* bundled source: js/34-v141-core-systems.js */
/*
   V141 — core systems
   - explicit monster rank + 10% wild elite preparation hooks
   - monster carried-skill count/level rules
   - elite-only single-roll drop table
   - functional monster shields and support AI hook
   - highest-character offline EXP multiplier
   - expanded quests/achievements and procedural battle audio
*/
(function installV141CoreSystems(){
    "use strict";

    const INVENTORY_CAPACITY=120;
    const VALID_RANKS=new Set(["regular","elite","boss"]);
    const WILD_ELITE_RATE=0.10;
    const WILD_ZONE_STRENGTHS=window.v173WildZoneStrengthMultipliers;
    const V141_PROGRESS_KEY=window.FourSymbolsAccountSave.accountKey("progress");

    window.V141_INVENTORY_CAPACITY=INVENTORY_CAPACITY;
    window.v141SystemConfig=Object.freeze({
        inventoryCapacity:INVENTORY_CAPACITY,
        inventoryPageSize:24,
        inventoryPages:5,
        wildEliteRate:WILD_ELITE_RATE,
        eliteSpecialDropRate:0.19
    });

    function getHighestCharacterLevel(){
        if(typeof getExistingPartyIndexes!=="function"){ return 1; }
        return Math.max(1,...getExistingPartyIndexes().map(index=>{
            const character=getPartyCharacterByIndex(index);
            return Math.max(1,Math.floor(Number(character&&character.level)||1));
        }));
    }
    window.v141GetHighestCharacterLevel=getHighestCharacterLevel;

    function loadAccountProgress(){
        try{
            const raw=JSON.parse(localStorage.getItem(V141_PROGRESS_KEY)||"{}");
            return {
                eliteKills:Math.max(0,Math.floor(Number(raw.eliteKills)||0)),
                dungeonWins:Math.max(0,Math.floor(Number(raw.dungeonWins)||0)),
                abyssClears:Math.max(0,Math.floor(Number(raw.abyssClears)||0))
            };
        }catch(_){
            return {eliteKills:0,dungeonWins:0,abyssClears:0};
        }
    }

    const accountProgress=loadAccountProgress();

    function persistAccountProgress(){
        try{ localStorage.setItem(V141_PROGRESS_KEY,JSON.stringify(accountProgress)); }
        catch(_){ }
    }
    window.v141GetAccountProgress=function(){ return Object.assign({},accountProgress); };
    window.v141RecordAbyssClear=function(){
        accountProgress.abyssClears++;
        persistAccountProgress();
    };

    /* =====================================================
       Wild roster expansion and explicit rank
    ===================================================== */
    function getWildZoneSpecs(){
        return [
            [typeof forestMonsters!=="undefined"?forestMonsters:null,3,"林間風靈","苔岩獸",WILD_ZONE_STRENGTHS[0]],
            [typeof desertMonsters!=="undefined"?desertMonsters:null,17,"風沙隼","岩甲蠍",WILD_ZONE_STRENGTHS[1]],
            [typeof iceMountainMonsters!=="undefined"?iceMountainMonsters:null,25,"霜風妖","凍岩獸",WILD_ZONE_STRENGTHS[2]],
            [typeof zone4Monsters!=="undefined"?zone4Monsters:null,35,"焰風鬼","熔岩石怪",WILD_ZONE_STRENGTHS[3]],
            [typeof zone5Monsters!=="undefined"?zone5Monsters:null,45,"蒼風巨獸","山岳巨獸",WILD_ZONE_STRENGTHS[4]],
            [typeof zone6Monsters!=="undefined"?zone6Monsters:null,55,"風刃修羅","岩鎧修羅",WILD_ZONE_STRENGTHS[5]],
            [typeof zone7Monsters!=="undefined"?zone7Monsters:null,65,"嵐影魔君","岳魂魔君",WILD_ZONE_STRENGTHS[6]],
            [typeof zone8Monsters!=="undefined"?zone8Monsters:null,75,"青嵐龍衛","岩岳龍衛",WILD_ZONE_STRENGTHS[7]],
            [typeof zone9Monsters!=="undefined"?zone9Monsters:null,85,"虛空風靈","虛空岩靈",WILD_ZONE_STRENGTHS[8]],
            [typeof zone10Monsters!=="undefined"?zone10Monsters:null,95,"終焉風神","終焉地神",WILD_ZONE_STRENGTHS[9]]
        ].filter(entry=>Array.isArray(entry[0]));
    }

    function strengthenNewWildMonster(monster,multiplier){
        if(!monster || monster._v131StrengthApplied){ return monster; }
        const strengthMultiplier=Number.isFinite(Number(multiplier))
            ? Number(multiplier)
            : WILD_ZONE_STRENGTHS[WILD_ZONE_STRENGTHS.length-1];
        monster._v131StrengthApplied=true;
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*strengthMultiplier));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    function addWindAndEarthWildMonsters(){
        getWildZoneSpecs().forEach(([zone,level,windName,earthName,strengthMultiplier])=>{
            zone.forEach(monster=>{
                if(monster){
                    monster.rank="regular";
                    monster.v141CurveEliteRate=WILD_ELITE_RATE;
                }
            });
            if(!zone.some(monster=>monster&&monster.name===windName)){
                const monster=strengthenNewWildMonster(
                    makeZoneMonster(windName,level,"wind","regular"),
                    strengthMultiplier
                );
                monster.v141CurveEliteRate=WILD_ELITE_RATE;
                zone.push(monster);
            }
            if(!zone.some(monster=>monster&&monster.name===earthName)){
                const monster=strengthenNewWildMonster(
                    makeZoneMonster(earthName,level,"earth","regular"),
                    strengthMultiplier
                );
                monster.v141CurveEliteRate=WILD_ELITE_RATE;
                zone.push(monster);
            }
        });
    }

    if(typeof getMonsterRank==="function"){
        getMonsterRank=function(monster){
            if(!monster){ return "regular"; }
            if(VALID_RANKS.has(monster.v141BattleRank)){ return monster.v141BattleRank; }
            if(VALID_RANKS.has(monster.rank)){ return monster.rank; }
            return "regular";
        };
    }

    /* =====================================================
       Monster carried skills
    ===================================================== */
    function getMonsterSkillCarryLimit(level){
        const lv=Math.max(1,Math.floor(Number(level)||1));
        if(lv<=20){ return 1; }
        if(lv<=40){ return 2; }
        return 3;
    }

    function getMonsterFixedSkillLevel(level){
        const lv=Math.max(1,Math.floor(Number(level)||1));
        if(lv<=20){ return 1; }
        if(lv<=40){ return 2; }
        if(lv<=60){ return 3; }
        if(lv<=80){ return 4; }
        return 5;
    }

    function shuffledCopy(values){
        const list=(values||[]).slice();
        for(let i=list.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [list[i],list[j]]=[list[j],list[i]];
        }
        return list;
    }

    function configureMonsterSkills(monster,options){
        if(!monster || monster.v141Abyss){ return monster; }
        const settings=options||{};
        const source=Array.isArray(settings.pool)
            ? settings.pool
            : Array.isArray(monster.skillIds)
            ? monster.skillIds
            : [];
        const eligible=[...new Set(source)].filter(id=>{
            const skill=typeof skillDatabase!=="undefined" ? skillDatabase[id] : null;
            return !!(
                skill &&
                (skill.category==="physical" || skill.category==="magic")
            );
        });
        const limit=getMonsterSkillCarryLimit(monster.level);
        monster.skillIds=(settings.keepOrder ? eligible : shuffledCopy(eligible)).slice(0,limit);
        monster.v141SkillLevel=getMonsterFixedSkillLevel(monster.level);
        return monster;
    }

    window.v141GetMonsterSkillCarryLimit=getMonsterSkillCarryLimit;
    window.v141GetMonsterFixedSkillLevel=getMonsterFixedSkillLevel;
    window.v141ConfigureMonsterSkills=configureMonsterSkills;

    if(typeof makeZoneMonster==="function"){
        const originalMakeZoneMonster=makeZoneMonster;
        makeZoneMonster=function(){
            const monster=originalMakeZoneMonster.apply(this,arguments);
            if(monster && !monster.rank){ monster.rank="regular"; }
            return configureMonsterSkills(monster);
        };
    }

    addWindAndEarthWildMonsters();
    getWildZoneSpecs().forEach(([zone])=>zone.forEach(configureMonsterSkills));

    /* V133早於本層載入；加入風／土怪與10%精英期望值後，立即用最終
       地圖資料重算目前等級需求。既有等級、已累積EXP與其他存檔不動。 */
    if(typeof window.v133GetExpNextForLevel==="function"){
        getExistingPartyIndexes().forEach(index=>{
            const character=getPartyCharacterByIndex(index);
            if(character&&character.level<100){
                character.expNext=window.v133GetExpNextForLevel(character.level);
            }
        });
    }

    window.v141RollWildMonsterRanks=function(indexes){
        (indexes||[]).forEach(index=>{
            const monster=typeof monsters!=="undefined" ? monsters[index] : null;
            if(!monster){ return; }
            monster.rank="regular";
            monster.v141BattleRank=Math.random()<WILD_ELITE_RATE ? "elite" : "regular";
            configureMonsterSkills(monster);
        });
    };

    /* =====================================================
       Functional monster shield
    ===================================================== */
    function getMonsterShieldRemaining(monster){
        const shield=monster&&monster.v141Shield;
        return shield ? Math.max(0,Math.floor(Number(shield.remaining)||0)) : 0;
    }

    function removeMonsterShield(monster){
        const shield=monster&&monster.v141Shield;
        if(!shield){ return; }
        const remaining=getMonsterShieldRemaining(monster);
        const baseHp=Math.max(0,(Number(monster.hp)||0)-remaining);
        monster.maxHP=Math.max(1,Number(shield.baseMaxHP)||1);
        monster.hp=Math.min(monster.maxHP,baseHp);
        monster.v141Shield=null;
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==shield&&buff.type!=="shield");
    }

    function syncMonsterShield(monster){
        const shield=monster&&monster.v141Shield;
        if(!shield){ return 0; }
        shield.remaining=Math.max(
            0,
            Math.min(
                Number(shield.amount)||0,
                (Number(monster.hp)||0)-(Number(shield.baseHp)||0)
            )
        );
        if(shield.remaining<=0){
            const currentHp=Math.max(0,Number(monster.hp)||0);
            monster.maxHP=Math.max(1,Number(shield.baseMaxHP)||1);
            monster.hp=Math.min(monster.maxHP,currentHp);
            monster.v141Shield=null;
            monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==shield&&buff.type!=="shield");
            return 0;
        }
        return shield.remaining;
    }

    function applyMonsterShield(monster,amount,turns){
        if(!monster || !monster.alive){ return 0; }
        if(monster.v141Shield){ removeMonsterShield(monster); }
        const safeAmount=Math.max(1,Math.floor(Number(amount)||1));
        const shield={
            type:"shield",
            amount:safeAmount,
            remaining:safeAmount,
            turnsLeft:Math.max(1,Math.floor(Number(turns)||2)),
            baseMaxHP:Math.max(1,Number(monster.maxHP)||1),
            baseHp:Math.max(0,Number(monster.hp)||0),
            v141MonsterShield:true
        };
        monster.maxHP=shield.baseMaxHP+safeAmount;
        monster.hp=shield.baseHp+safeAmount;
        monster.v141Shield=shield;
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff.type!=="shield");
        monster.activeBuffs.push(shield);
        return safeAmount;
    }

    function healMonsterPreservingShield(monster,amount){
        if(!monster || !monster.alive){ return 0; }
        const shieldRemaining=syncMonsterShield(monster);
        const shield=monster.v141Shield;
        const baseMax=shield ? shield.baseMaxHP : monster.maxHP;
        const baseHp=shield
            ? Math.max(0,monster.hp-shieldRemaining)
            : Math.max(0,monster.hp);
        const healed=Math.max(0,Math.min(Math.floor(Number(amount)||0),baseMax-baseHp));
        monster.hp=baseHp+healed+shieldRemaining;
        if(shield){ shield.baseHp=baseHp+healed; }
        return healed;
    }

    window.v141GetMonsterShieldRemaining=getMonsterShieldRemaining;
    window.v141SyncMonsterShield=syncMonsterShield;
    window.v141ApplyMonsterShield=applyMonsterShield;
    window.v141HealMonsterPreservingShield=healMonsterPreservingShield;

    if(typeof skillDatabase!=="undefined"){
        if(!skillDatabase.yuanXiangGuangMing){
            skillDatabase.yuanXiangGuangMing={
                id:"yuanXiangGuangMing",name:"元相光明",element:"light",
                category:"heal",targetType:"allyAll",maxLevel:5,spCost:35,baseHeal:350,
                description:"我方全體回復350 HP。"
            };
        }
        if(!skillDatabase.yuanGuangShield){
            skillDatabase.yuanGuangShield={
                id:"yuanGuangShield",name:"元光護體",element:"light",
                category:"buff",targetType:"allyAll",maxLevel:5,spCost:40,
                shieldAmount:200,shieldDuration:2,
                description:"我方全體獲得200護盾，持續2回合。"
            };
        }
    }

    let lastMonsterSkillByIndex=new Map();
    const COMBAT_FEEDBACK_VOLUME_SCALE=2;

    /* =====================================================
       Procedural audio
    ===================================================== */
    const audioEngine=(function(){
        let context=null;
        let master=null;
        const SKILL_VOLUME_SCALE=2;
        const COMBAT_FEEDBACK_VOLUME_SCALE=2;
        let playbackGainScale=1;

        function ensure(){
            if(context){
                if(context.state==="suspended"){ context.resume().catch(()=>{}); }
                return context;
            }
            const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
            if(!AudioContextCtor){ return null; }
            context=new AudioContextCtor();
            master=context.createGain();
            master.gain.value=0.30;
            master.connect(context.destination);
            return context;
        }

        function tone(frequency,duration,options){
            const ctx=ensure();
            if(!ctx || !master){ return; }
            const opts=options||{};
            const now=ctx.currentTime+(Number(opts.delay)||0);
            const osc=ctx.createOscillator();
            const gain=ctx.createGain();
            osc.type=opts.wave||"sine";
            osc.frequency.setValueAtTime(Math.max(20,frequency),now);
            if(opts.to){ osc.frequency.exponentialRampToValueAtTime(Math.max(20,opts.to),now+duration); }
            gain.gain.setValueAtTime(0.0001,now);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.001,(Number(opts.volume)||0.16)*playbackGainScale),now+0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
            osc.connect(gain); gain.connect(master);
            osc.start(now); osc.stop(now+duration+0.02);
        }

        function noise(duration,options){
            const ctx=ensure();
            if(!ctx || !master){ return; }
            const opts=options||{};
            const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
            const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
            const data=buffer.getChannelData(0);
            for(let i=0;i<length;i++){
                const envelope=1-i/length;
                data[i]=(Math.random()*2-1)*envelope;
            }
            const source=ctx.createBufferSource();
            const filter=ctx.createBiquadFilter();
            const gain=ctx.createGain();
            filter.type=opts.filter||"bandpass";
            filter.frequency.value=Number(opts.frequency)||900;
            filter.Q.value=Number(opts.q)||0.8;
            gain.gain.value=(Number(opts.volume)||0.14)*playbackGainScale;
            source.buffer=buffer;
            source.connect(filter); filter.connect(gain); gain.connect(master);
            source.start(ctx.currentTime+(Number(opts.delay)||0));
        }

        function play(kind,volumeScale){
            const previousScale=playbackGainScale;
            const requestedScale=Number(volumeScale);
            playbackGainScale=Number.isFinite(requestedScale)&&requestedScale>0?requestedScale:1;
            try{
                switch(kind){
                    case "swing": noise(.14,{frequency:1200,volume:.15}); tone(520,.13,{to:180,wave:"sawtooth",volume:.07}); break;
                    case "hit": noise(.12,{frequency:260,volume:.22}); tone(110,.14,{to:55,wave:"triangle",volume:.18}); break;
                    case "damage": noise(.15,{frequency:340,volume:.2}); tone(145,.18,{to:62,wave:"triangle",volume:.14}); break;
                    case "heavy": noise(.28,{frequency:170,volume:.25}); tone(85,.32,{to:38,wave:"sine",volume:.25}); break;
                    case "crit": tone(780,.12,{to:1560,wave:"square",volume:.12}); noise(.22,{frequency:1800,volume:.22,delay:.05}); break;
                    case "block": tone(920,.11,{to:390,wave:"square",volume:.1}); noise(.13,{frequency:1900,volume:.13}); break;
                    case "dodge": noise(.2,{filter:"highpass",frequency:2200,volume:.1}); tone(1050,.15,{to:520,wave:"sine",volume:.05}); break;
                    case "magic": tone(240,.34,{to:920,wave:"sine",volume:.12}); tone(480,.28,{to:1280,wave:"triangle",volume:.08,delay:.04}); break;
                    case "charge": tone(95,.55,{to:620,wave:"sawtooth",volume:.08}); break;
                    case "explosion": noise(.38,{filter:"lowpass",frequency:480,volume:.26}); tone(92,.34,{to:35,wave:"square",volume:.18}); break;
                    case "fire": noise(.42,{frequency:620,volume:.18}); tone(120,.36,{to:45,wave:"sawtooth",volume:.12,delay:.06}); break;
                    case "ice": tone(1480,.25,{to:420,wave:"triangle",volume:.12}); noise(.25,{frequency:2300,volume:.16,delay:.06}); break;
                    case "water": noise(.48,{filter:"lowpass",frequency:1100,volume:.13}); tone(330,.42,{to:190,wave:"sine",volume:.09}); break;
                    case "wind": noise(.38,{filter:"highpass",frequency:1500,volume:.14}); tone(900,.25,{to:260,wave:"sine",volume:.06}); break;
                    case "earth": tone(72,.36,{to:38,wave:"triangle",volume:.23}); noise(.3,{frequency:210,volume:.22}); break;
                    case "buff": tone(390,.34,{to:760,wave:"sine",volume:.11}); tone(590,.32,{to:980,wave:"sine",volume:.08,delay:.08}); break;
                    case "debuff": tone(340,.38,{to:95,wave:"sawtooth",volume:.11}); break;
                    case "shield": tone(220,.38,{to:660,wave:"sine",volume:.12}); tone(880,.24,{to:440,wave:"triangle",volume:.08,delay:.08}); break;
                    case "heal": tone(440,.46,{to:880,wave:"sine",volume:.12}); tone(660,.38,{to:1100,wave:"sine",volume:.08,delay:.1}); break;
                    case "revive": tone(220,.65,{to:880,wave:"sine",volume:.14}); tone(440,.62,{to:1320,wave:"triangle",volume:.09,delay:.08}); break;
                    case "boss": tone(58,.38,{to:34,wave:"sawtooth",volume:.18}); break;
                    case "monster": tone(125,.19,{to:72,wave:"triangle",volume:.1}); break;
                    case "death": tone(160,.5,{to:42,wave:"sawtooth",volume:.18}); noise(.32,{frequency:190,volume:.16}); break;
                }
            }finally{
                playbackGainScale=previousScale;
            }
        }

        function playSkill(skill,name){
            const label=String(name||skill&&skill.name||"");
            if(label==="普通攻擊"){ play("swing",SKILL_VOLUME_SCALE); setTimeout(()=>play("hit",SKILL_VOLUME_SCALE),55); return; }
            if(!skill){ play("hit",SKILL_VOLUME_SCALE); return; }
            if(skill.category==="heal"){ play("heal",SKILL_VOLUME_SCALE); return; }
            if(skill.category==="revive"){ play("revive",SKILL_VOLUME_SCALE); return; }
            if(skill.category==="buff"){
                play(/盾|護體|結界/.test(label)?"shield":"buff",SKILL_VOLUME_SCALE);
                return;
            }
            play(skill.category==="physical"?"swing":"magic",SKILL_VOLUME_SCALE);
            setTimeout(()=>{
                const elementKind={fire:"fire",water:"water",wind:"wind",earth:"earth",light:"buff"}[skill.element];
                if(elementKind){ play(elementKind,SKILL_VOLUME_SCALE); }
                if(/爆|炸|鳳|龍/.test(label)){ setTimeout(()=>play("explosion",SKILL_VOLUME_SCALE),45); }
                else{ play(/重|裂|猛|破/.test(label)?"heavy":"hit",SKILL_VOLUME_SCALE); }
            },65);
        }

        return {ensure,play,playSkill,skillVolumeScale:SKILL_VOLUME_SCALE,combatFeedbackVolumeScale:COMBAT_FEEDBACK_VOLUME_SCALE};
    })();
    window.v141Audio=audioEngine;
    document.addEventListener("pointerdown",()=>audioEngine.ensure(),{once:true,passive:true});

    if(typeof showSkillNameBadge==="function"){
        const originalShowSkillNameBadge=showSkillNameBadge;
        let lastQuestSkillKey="";
        showSkillNameBadge=function(skillName,elementType,characterIndex){
            const result=originalShowSkillNameBadge.apply(this,arguments);
            const skill=Object.values(skillDatabase).find(data=>data&&data.name===skillName)||null;
            audioEngine.playSkill(skill,skillName);
            if(battleActive && skillName!=="普通攻擊"){
                const key=[battleToken,turn,typeof initiativeIndex!=="undefined"?initiativeIndex:0,characterIndex,skillName].join(":");
                if(key!==lastQuestSkillKey){
                    lastQuestSkillKey=key;
                    recordQuestProgress("skills5",1,"daily");
                    recordQuestProgress("skills15",1,"commission");
                }
            }
            return result;
        };
    }

    if(typeof showMonsterSkillNameBadge==="function"){
        const originalShowMonsterSkillNameBadge=showMonsterSkillNameBadge;
        showMonsterSkillNameBadge=function(skillName,elementType,monsterIndex){
            const skillId=Object.keys(skillDatabase).find(id=>skillDatabase[id]&&skillDatabase[id].name===skillName)||null;
            if(skillId){ lastMonsterSkillByIndex.set(monsterIndex,skillId); }
            audioEngine.playSkill(skillId?skillDatabase[skillId]:null,skillName);
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&typeof getMonsterRank==="function"&&getMonsterRank(monster)==="boss"){
                setTimeout(()=>audioEngine.play("boss",COMBAT_FEEDBACK_VOLUME_SCALE),28);
            }
            return originalShowMonsterSkillNameBadge.apply(this,arguments);
        };
    }

    if(typeof showMissEffect==="function"){
        const originalShowMissEffect=showMissEffect;
        showMissEffect=function(){
            audioEngine.play("dodge",COMBAT_FEEDBACK_VOLUME_SCALE);
            return originalShowMissEffect.apply(this,arguments);
        };
    }

    if(typeof showShieldAbsorb==="function"){
        const originalShowShieldAbsorb=showShieldAbsorb;
        showShieldAbsorb=function(){
            audioEngine.play("block",COMBAT_FEEDBACK_VOLUME_SCALE);
            return originalShowShieldAbsorb.apply(this,arguments);
        };
    }

    if(typeof showMonsterHit==="function"){
        const originalShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index,amount,type,isCrit){
            if(type==="hp"&&Number(amount)>0){ audioEngine.play(isCrit?"crit":"damage",COMBAT_FEEDBACK_VOLUME_SCALE); }
            return originalShowMonsterHit.apply(this,arguments);
        };
    }

    if(typeof showPlayerHit==="function"){
        const originalShowPlayerHit=showPlayerHit;
        showPlayerHit=function(amount,type,index,isPositive,isCrit){
            if(type==="hp"&&Number(amount)>0){ audioEngine.play(isCrit?"crit":"damage",COMBAT_FEEDBACK_VOLUME_SCALE); }
            return originalShowPlayerHit.apply(this,arguments);
        };
    }

    function applyMonsterSkillShield(monsterIndex,skillId,level){
        const skill=skillDatabase[skillId];
        const caster=monsters[monsterIndex];
        if(!skill || !caster || !caster.alive){ return; }
        const safeLevel=Math.max(1,Math.min(skill.maxLevel||1,Math.floor(Number(level)||1)));
        if(skill.selfShieldByLevel){
            const amount=skill.selfShieldByLevel[safeLevel-1];
            applyMonsterShield(caster,amount,skill.shieldDuration||2);
            addBattleLog(caster.name+"獲得"+amount+"點護盾。");
        }
        if(skill.allyShieldByLevel){
            const amount=skill.allyShieldByLevel[safeLevel-1];
            currentBattleMonsters.forEach(index=>{
                const ally=monsters[index];
                if(ally&&ally.alive){ applyMonsterShield(ally,amount,skill.shieldDuration||2); }
            });
            addBattleLog("敵方全體獲得"+amount+"點護盾，持續"+(skill.shieldDuration||2)+"回合。");
        }
    }

    function supportMonsterAction(monsterIndex){
        const monster=monsters[monsterIndex];
        if(!monster || !monster.alive){ finishPlayerAction(); return; }
        if((typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster)) ||
           (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))){
            return null;
        }
        const allies=currentBattleMonsters.map(index=>monsters[index]).filter(ally=>ally&&ally.alive);
        const injured=allies.filter(ally=>{
            const shield=getMonsterShieldRemaining(ally);
            const max=ally.v141Shield?ally.v141Shield.baseMaxHP:ally.maxHP;
            return Math.max(0,ally.hp-shield)<max;
        });
        const healSkill=skillDatabase.yuanXiangGuangMing;
        const shieldSkill=skillDatabase.yuanGuangShield;

        if(injured.length>0 && monster.sp>=healSkill.spCost){
            monster.sp-=healSkill.spCost;
            showMonsterSkillNameBadge(healSkill.name,"light",monsterIndex);
            let total=0;
            allies.forEach(ally=>{ total+=healMonsterPreservingShield(ally,350); });
            addBattleLog(monster.name+"施放元相光明，敵方全體共回復"+total+" HP。");
            updateUI();
            finishPlayerAction();
            return true;
        }

        if(allies.some(ally=>getMonsterShieldRemaining(ally)<=0) && monster.sp>=shieldSkill.spCost){
            monster.sp-=shieldSkill.spCost;
            showMonsterSkillNameBadge(shieldSkill.name,"light",monsterIndex);
            allies.forEach(ally=>applyMonsterShield(ally,200,2));
            addBattleLog(monster.name+"施放元光護體，敵方全體獲得200護盾，持續2回合。");
            updateUI();
            finishPlayerAction();
            return true;
        }
        return false;
    }

    if(typeof processSingleMonsterAttack==="function"){
        const originalProcessSingleMonsterAttack=processSingleMonsterAttack;
        processSingleMonsterAttack=function(monsterIndex,token){
            const monster=monsters[monsterIndex];
            if(
                monster&&monster.v141Abyss&&
                typeof window.v141TryMonsterSpecialAction==="function"
            ){
                const handled=window.v141TryMonsterSpecialAction(monsterIndex,token);
                if(handled===true){ return; }
            }
            if(monster&&monster.v141AbyssAi==="support"){
                const supportResult=supportMonsterAction(monsterIndex);
                if(supportResult!==false && supportResult!==null){ return supportResult; }
                if(supportResult===null){ return originalProcessSingleMonsterAttack.apply(this,arguments); }
            }

            if(!monster){ return originalProcessSingleMonsterAttack.apply(this,arguments); }
            lastMonsterSkillByIndex.delete(monsterIndex);
            const forcedLevel=monster.v141ForceSkillLevel||monster.v141SkillLevel||getMonsterFixedSkillLevel(monster.level);
            const backups=[];
            (monster.skillIds||[]).forEach(id=>{
                const skill=skillDatabase[id];
                if(!skill){ return; }
                backups.push([skill,skill.maxLevel]);
                skill.maxLevel=Math.min(Math.max(1,forcedLevel),Math.max(1,skill.maxLevel||1));
            });

            let result;
            try{ result=originalProcessSingleMonsterAttack.apply(this,arguments); }
            finally{ backups.forEach(([skill,maxLevel])=>{ skill.maxLevel=maxLevel; }); }

            const castSkillId=lastMonsterSkillByIndex.get(monsterIndex);
            if(castSkillId){
                applyMonsterSkillShield(monsterIndex,castSkillId,forcedLevel);
                if(typeof updateUI==="function"){ updateUI(); }
            }
            return result;
        };
    }

    let lastShieldTickKey="";
    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            const key=String(token)+":"+String(turn);
            if(key!==lastShieldTickKey){
                lastShieldTickKey=key;
                currentBattleMonsters.forEach(index=>{
                    const monster=monsters[index];
                    const shield=monster&&monster.v141Shield;
                    if(!shield){ return; }
                    if(turn>1){ shield.turnsLeft--; }
                    if(shield.turnsLeft<=0){ removeMonsterShield(monster); }
                    else{ syncMonsterShield(monster); }
                });
            }
            return originalStartTurn.apply(this,arguments);
        };
    }

    /* =====================================================
       Elite single-roll drops + quest progress
    ===================================================== */
    function addEliteSpecialDrop(monster){
        if(typeof window.v132AddItemToInventory!=="function"){ return null; }
        const roll=Math.random()*100;
        let definition=null;
        if(roll<1){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetFire"); }
        else if(roll<2){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetWater"); }
        else if(roll<3){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetEarth"); }
        else if(roll<4){ definition=window.v132GetTicketDefinition&&window.v132GetTicketDefinition("ticketSetWind"); }
        else if(roll<9){ definition=window.v132GetTalismanDefinition&&window.v132GetTalismanDefinition("freezeTalismanMid"); }
        else if(roll<14){ definition=window.v132GetTalismanDefinition&&window.v132GetTalismanDefinition("stealthTalismanMid"); }
        else if(roll<19){ definition=window.v132GetTalismanDefinition&&window.v132GetTalismanDefinition("barrierTalismanMid"); }
        if(!definition){ return null; }
        if(!window.v132AddItemToInventory(definition,1)){
            addBattleLog(monster.name+"出現特殊掉落，但背包已滿，未能放入。");
            return null;
        }
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        addBattleLog(monster.name+"掉落了"+definition.name+"×1。");
        return definition;
    }

    function recordQuestProgress(id,amount,type){
        if(typeof ensureDailyQuestsCurrent!=="function"){ return; }
        ensureDailyQuestsCurrent();
        const state=type==="commission"?commissionQuestState:dailyQuestState;
        const definitions=type==="commission"?commissionQuestDefinitions:dailyQuestDefinitions;
        const quest=definitions.find(item=>item.id===id);
        if(!quest){ return; }
        const before=Number(state.progress[id])||0;
        const after=Math.min(quest.goal,before+Math.max(0,Number(amount)||0));
        if(after===before){ return; }
        state.progress[id]=after;
        if(typeof window.v17361RefreshOpenQuestPage==="function"){ window.v17361RefreshOpenQuestPage(); }
        if(typeof window.v148SyncQuestNoticeDots==="function"){ window.v148SyncQuestNoticeDots(); }
    }
    window.v141RecordQuestProgress=recordQuestProgress;

    if(typeof killMonster==="function"){
        const originalKillMonster=killMonster;
        killMonster=function(index){
            const monster=monsters[index];
            const wasAlive=!!(monster&&monster.alive);
            const isWildElite=!!(
                wasAlive &&
                !window.v132ActiveDungeonRun &&
                currentZone!=="dungeon" &&
                getMonsterRank(monster)==="elite"
            );
            const previousDungeonRun=window.v132ActiveDungeonRun;
            if(isWildElite){ window.v132ActiveDungeonRun={v141EliteDropIsolation:true}; }
            let result;
            try{ result=originalKillMonster.apply(this,arguments); }
            finally{ window.v132ActiveDungeonRun=previousDungeonRun; }

            if(wasAlive){
                recordQuestProgress("kill10",1,"daily");
                recordQuestProgress("kill30",1,"commission");
                if(getMonsterRank(monster)==="elite"){
                    recordQuestProgress("elite2",1,"commission");
                    accountProgress.eliteKills++;
                    persistAccountProgress();
                }
                if(isWildElite){ addEliteSpecialDrop(monster); }
                audioEngine.play("death",COMBAT_FEEDBACK_VOLUME_SCALE);
            }
            return result;
        };
    }

    /* =====================================================
       Expanded quests and achievements
    ===================================================== */
    const extraDailyQuests=[
        {id:"kill10",name:"清掃周邊",desc:"今天累計擊敗10隻怪物",goal:10,reward:{gold:130,exp:60}},
        {id:"win3",name:"連戰三場",desc:"今天打贏3場戰鬥",goal:3,reward:{gold:120,exp:80}},
        {id:"skills5",name:"熟練招式",desc:"今天在戰鬥中施放5次技能",goal:5,reward:{gold:90}}
    ];
    const extraCommissionQuests=[
        {id:"kill30",name:"委託：討伐30隻怪物",desc:"今天累計擊敗30隻怪物",goal:30,reward:{gold:350,exp:180}},
        {id:"win5",name:"委託：五戰告捷",desc:"今天打贏5場戰鬥",goal:5,reward:{gold:300,exp:220}},
        {id:"elite2",name:"委託：精英獵手",desc:"今天擊敗2隻精英怪",goal:2,reward:{gold:260,exp:120}},
        {id:"skills15",name:"委託：招式演練",desc:"今天在戰鬥中施放15次技能",goal:15,reward:{gold:220,exp:150}}
    ];
    extraDailyQuests.forEach(quest=>{
        if(!dailyQuestDefinitions.some(item=>item.id===quest.id)){ dailyQuestDefinitions.push(quest); }
    });
    extraCommissionQuests.forEach(quest=>{
        if(!commissionQuestDefinitions.some(item=>item.id===quest.id)){ commissionQuestDefinitions.push(quest); }
    });

    if(typeof ensureDailyQuestsCurrent==="function"){
        const originalEnsureDailyQuestsCurrent=ensureDailyQuestsCurrent;
        ensureDailyQuestsCurrent=function(){
            const result=originalEnsureDailyQuestsCurrent.apply(this,arguments);
            dailyQuestDefinitions.forEach(quest=>{
                if(!Object.prototype.hasOwnProperty.call(dailyQuestState.progress,quest.id)){ dailyQuestState.progress[quest.id]=0; }
                if(!Object.prototype.hasOwnProperty.call(dailyQuestState.claimed,quest.id)){ dailyQuestState.claimed[quest.id]=false; }
            });
            commissionQuestDefinitions.forEach(quest=>{
                if(!Object.prototype.hasOwnProperty.call(commissionQuestState.progress,quest.id)){ commissionQuestState.progress[quest.id]=0; }
                if(!Object.prototype.hasOwnProperty.call(commissionQuestState.claimed,quest.id)){ commissionQuestState.claimed[quest.id]=false; }
            });
            return result;
        };
        ensureDailyQuestsCurrent();
    }

    function highestLevelAtLeast(level){ return getHighestCharacterLevel()>=level; }
    const extraAchievements=[
        {id:"kill500",name:"百戰不殆",desc:"累計擊敗500隻怪物",reward:{gold:500},check:()=>getTotalMonsterKills()>=500},
        {id:"kill1000",name:"千軍辟易",desc:"累計擊敗1000隻怪物",reward:{gold:900},check:()=>getTotalMonsterKills()>=1000},
        {id:"elite10",name:"精英剋星",desc:"累計擊敗10隻精英怪",reward:{gold:300},check:()=>accountProgress.eliteKills>=10},
        {id:"elite50",name:"精英終結者",desc:"累計擊敗50隻精英怪",reward:{gold:800},check:()=>accountProgress.eliteKills>=50},
        {id:"level30",name:"行走江湖",desc:"任一角色達到30級",reward:{gold:250},check:()=>highestLevelAtLeast(30)},
        {id:"level60",name:"一代宗師",desc:"任一角色達到60級",reward:{gold:650},check:()=>highestLevelAtLeast(60)},
        {id:"level80",name:"登峰造極",desc:"任一角色達到80級",reward:{gold:1000},check:()=>highestLevelAtLeast(80)},
        {id:"level100",name:"百級傳說",desc:"任一角色達到100級",reward:{gold:1800},check:()=>highestLevelAtLeast(100)},
        {id:"gold5000",name:"積少成多",desc:"持有金幣達到5,000",reward:{gold:250},check:()=>gold>=5000},
        {id:"gold20000",name:"富甲一方",desc:"持有金幣達到20,000",reward:{gold:700},check:()=>gold>=20000}
    ];
    extraAchievements.forEach(achievement=>{
        if(!achievementDefinitions.some(item=>item.id===achievement.id)){ achievementDefinitions.push(achievement); }
    });

    let lastVictoryToken=null;
    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            if(battleActive && lastVictoryToken!==battleToken){
                lastVictoryToken=battleToken;
                recordQuestProgress("win3",1,"daily");
                recordQuestProgress("win5",1,"commission");
                if(window.v132ActiveDungeonRun){
                    accountProgress.dungeonWins++;
                    persistAccountProgress();
                }
            }
            return originalWinBattle.apply(this,arguments);
        };
    }

    /* =====================================================
       Offline EXP: highest-level character multiplier
    ===================================================== */
    function getOfflineLevelMultiplier(){
        const level=getHighestCharacterLevel();
        if(level<=10){ return 1; }
        if(level<=20){ return 1.2; }
        if(level<=30){ return 1.4; }
        if(level<=40){ return 1.6; }
        if(level<=50){ return 1.8; }
        return 2;
    }
    window.v141GetOfflineLevelMultiplier=getOfflineLevelMultiplier;

    if(typeof calculateOfflineExpSince==="function"){
        const originalCalculateOfflineExpSince=calculateOfflineExpSince;
        calculateOfflineExpSince=function(){
            const before=Math.max(0,Number(pendingOfflineExp)||0);
            const result=originalCalculateOfflineExpSince.apply(this,arguments);
            const baseGain=Math.max(0,(Number(pendingOfflineExp)||0)-before);
            if(baseGain>0){
                pendingOfflineExp=before+Math.round(baseGain*getOfflineLevelMultiplier()*3);
            }
            return result;
        };
    }

    /* Refined affixes are separate from original item stats but contribute in combat. */
    if(typeof getEquipmentBonus==="function"){
        const originalGetEquipmentBonus=getEquipmentBonus;
        getEquipmentBonus=function(characterId){
            const bonus=originalGetEquipmentBonus.apply(this,arguments);
            const equipment=characterEquipment&&characterEquipment[characterId];
            if(!equipment){ return bonus; }
            Object.values(equipment).forEach(item=>{
                const stats=item&&item.reforgeStats;
                if(!stats){ return; }
                Object.keys(stats).forEach(stat=>{
                    if(Object.prototype.hasOwnProperty.call(bonus,stat)){
                        bonus[stat]+=Number(stats[stat])||0;
                    }
                });
            });
            return bonus;
        };
    }

})();


/* bundled source: js/35-v141-ui-battle.js */
/*
   V141 — mobile UI and battle presentation
   - 18-slot / 7-page backpack, compact dialogs and shop confirmation
   - battle card status effects, monster shield bar, entrance/exit transitions
   - black-gold post-battle reward summary
   - click-to-move patrol character + draggable quest tracker
   - daily dungeon cover structure, dungeon navigation and notification dots
*/
(function installV141UiAndBattle(){
    "use strict";

    const V141_RASTER_TICKET_IDS=new Set([
        "ticketSetFire",
        "ticketSetWater",
        "ticketSetEarth",
        "ticketSetWind"
    ]);
    const INVENTORY_PAGE_SIZE=18;
    const INVENTORY_PAGE_COUNT=7;
    const ANNOUNCEMENT_READ_KEY=window.FourSymbolsAccountSave.accountKey("announcement-read");
    const QUEST_MILESTONE_KEY=window.FourSymbolsAccountSave.accountKey("quest-milestones");
    const TASK_TRACKER_KEY=window.FourSymbolsAccountSave.accountKey("task-tracker");
    let inventoryPageIndex=0;
    let battleSnapshot=null;
    let lastWildRankToken=null;
    let transitionRunning=false;
    let suppressLegacyExpToastUntil=0;

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function getCanonicalTicketIcon(item){
        if(!item || !V141_RASTER_TICKET_IDS.has(item.id)){ return ""; }
        const definition=typeof window.v132GetTicketDefinition==="function"
            ?window.v132GetTicketDefinition(item.id)
            :null;
        const icon=definition&&definition.id===item.id ? definition.icon : "";
        return (
            typeof icon==="string" &&
            icon.includes("v169-ticket-art")
        ) ? icon : "";
    }

    function getItemCounts(){
        const counts=new Map();
        inventoryItems.forEach(item=>{
            if(!item||!item.id){ return; }
            const current=counts.get(item.id)||{
                id:item.id,
                count:0,
                name:item.name||item.id
            };
            current.count+=Math.max(1,Number(item.count)||1);
            counts.set(item.id,current);
        });
        return counts;
    }

    /* =====================================================
       Backpack: 18 slots × 7 pages (the final page keeps the 120-slot cap)
    ===================================================== */
    function ensureInventoryPager(){
        const scroller=document.getElementById("inventoryGridScroll");
        if(!scroller||document.getElementById("v141InventoryPager")){ return; }
        const pager=document.createElement("div");
        pager.id="v141InventoryPager";
        pager.className="v141-inventory-pager";
        pager.innerHTML=
            '<button type="button" aria-label="上一頁" onclick="v141ChangeInventoryPage(-1)">←</button>'+
            '<span id="v141InventoryPageLabel">1 / 7</span>'+
            '<button type="button" aria-label="下一頁" onclick="v141ChangeInventoryPage(1)">→</button>';
        scroller.insertAdjacentElement("afterend",pager);
    }

    window.v141ChangeInventoryPage=function(direction){
        inventoryPageIndex=(inventoryPageIndex+Number(direction)+INVENTORY_PAGE_COUNT)%INVENTORY_PAGE_COUNT;
        renderInventoryItems();
    };

    if(typeof renderInventoryItems==="function"){
        renderInventoryItems=function(){
            rebuildInventorySlots();
            const grid=document.getElementById("inventoryGrid");
            if(!grid){ return; }
            ensureInventoryPager();
            grid.innerHTML="";

            const filtered=getFilteredInventoryItems();
            inventoryPageIndex=Math.max(0,Math.min(INVENTORY_PAGE_COUNT-1,inventoryPageIndex));
            const pageItems=filtered.slice(
                inventoryPageIndex*INVENTORY_PAGE_SIZE,
                (inventoryPageIndex+1)*INVENTORY_PAGE_SIZE
            );

            for(let index=0;index<INVENTORY_PAGE_SIZE;index++){
                const item=pageItems[index]||null;
                const box=document.createElement("div");
                box.className="inventory-item inventory-item-classic "+(item?"has-item":"empty");
                box.draggable=false;
                box.addEventListener("dragstart",event=>event.preventDefault());
                if(item){
                    box.innerHTML=
                        '<div class="inventory-icon">'+(item.icon||"◆")+'</div>'+
                        '<div class="inventory-count">'+((Number(item.count)||0)>1?"×"+item.count:"")+'</div>';
                    const realIndex=inventoryItems.indexOf(item);
                    box.onclick=()=>openItemModal(realIndex);
                    box.setAttribute("aria-label",item.name||"背包物品");
                }else{
                    box.innerHTML='<div class="inventory-empty-dot">·</div>';
                    box.setAttribute("aria-hidden","true");
                }
                grid.appendChild(box);
            }

            const label=document.getElementById("v141InventoryPageLabel");
            if(label){ label.textContent=(inventoryPageIndex+1)+" / "+INVENTORY_PAGE_COUNT; }
            document.querySelectorAll("#inventoryCategoryTabs [data-filter]").forEach(tab=>{
                const active=tab.dataset.filter===inventoryFilter;
                tab.classList.toggle("active",active);
                tab.setAttribute("aria-selected",active?"true":"false");
            });
        };
    }

    if(typeof setInventoryFilter==="function"){
        const originalSetInventoryFilter=setInventoryFilter;
        setInventoryFilter=function(){
            inventoryPageIndex=0;
            return originalSetInventoryFilter.apply(this,arguments);
        };
    }

    function getCreatedBackpackIndexes(){
        return [0,1,2].filter(index=>!!getBackpackCharacter(index));
    }

    if(typeof changeInventoryCharacter==="function"){
        changeInventoryCharacter=function(direction){
            const indexes=getCreatedBackpackIndexes();
            if(indexes.length===0){ return; }
            let position=indexes.indexOf(inventoryCharacterIndex);
            if(position<0){ position=0; }
            position=(position+(Number(direction)>=0?1:-1)+indexes.length)%indexes.length;
            inventoryCharacterIndex=indexes[position];
            renderInventory();
            if(typeof syncCharacterTabsFromInventory==="function"){
                syncCharacterTabsFromInventory(inventoryCharacterIndex);
            }
        };
    }

    if(typeof renderInventoryCharacterTabs==="function"){
        renderInventoryCharacterTabs=function(){
            const wrap=document.getElementById("inventoryCharacterTabs");
            if(!wrap){ return; }
            const indexes=getCreatedBackpackIndexes();
            if(indexes.length&& !indexes.includes(inventoryCharacterIndex)){ inventoryCharacterIndex=indexes[0]; }
            const character=getBackpackCharacter(inventoryCharacterIndex);
            wrap.innerHTML=
                '<button type="button" class="inventory-character-arrow" aria-label="上一個角色" onclick="changeInventoryCharacter(-1)">‹</button>'+
                '<div class="inventory-character-name"><span>'+escapeHtml(character&&character.id||"角色")+'</span>'+
                '<small class="inventory-character-level">'+(character?"Lv."+(character.level||1):"尚未建立")+'</small></div>'+
                '<button type="button" class="inventory-character-arrow" aria-label="下一個角色" onclick="changeInventoryCharacter(1)">›</button>';
        };
    }

    function getSelectedInventoryItem(){
        if(selectedInventorySlot===null||selectedInventorySlot===undefined){ return null; }
        return inventorySlots[selectedInventorySlot]||null;
    }

    function appendReforgeStatsToModal(item){
        const stats=document.getElementById("itemModalStats");
        if(!stats||!item){ return; }
        if(item.reforgeStats&&Object.keys(item.reforgeStats).length){
            stats.insertAdjacentHTML(
                "beforeend",
                '<section class="v141-item-reforge"><b>【冶煉】</b>'+getStatText(item.reforgeStats)+'</section>'
            );
        }
    }

    function syncDecomposeButton(item,slotIndex){
        const buttons=document.querySelector("#itemModal .item-modal-buttons");
        if(!buttons){ return; }
        let button=document.getElementById("v141DecomposeButton");
        const canDecompose=!!(item&&item.setId&&isEquipmentInventoryType(item.type)&&Number.isInteger(slotIndex));
        if(!canDecompose){
            if(button){ button.remove(); }
            return;
        }
        if(!button){
            button=document.createElement("button");
            button.id="v141DecomposeButton";
            button.type="button";
            button.className="item-modal-button v141-decompose-button";
            buttons.appendChild(button);
        }
        button.textContent="分解成10碎片";
        button.onclick=()=>{
            if(typeof window.v141DecomposeSeriesItem==="function"){
                window.v141DecomposeSeriesItem(slotIndex);
            }
        };
    }


    /* V173.42 — backpack potion use follows the currently selected backpack character. */
    function syncInventoryPotionUseButton(item,slotIndex){
        const buttons=document.querySelector("#itemModal .item-modal-buttons");
        if(!buttons){ return; }
        let button=document.getElementById("v17342InventoryPotionUse");
        const definition=item&&typeof getPotionDefinition==="function"?getPotionDefinition(item.id):null;
        if(!definition){
            if(button){ button.remove(); }
            return;
        }
        if(!button){
            button=document.createElement("button");
            button.id="v17342InventoryPotionUse";
            button.type="button";
            button.className="item-modal-button v17342-inventory-potion-use";
            buttons.insertBefore(button,buttons.firstChild||null);
        }
        button.textContent="使用";
        button.onclick=()=>window.v17342UseInventoryPotion(slotIndex);
    }

    window.v17342UseInventoryPotion=function(slotIndex){
        const item=typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null;
        const definition=item&&typeof getPotionDefinition==="function"?getPotionDefinition(item.id):null;
        const character=typeof getBackpackCharacter==="function"?getBackpackCharacter(inventoryCharacterIndex):null;
        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(inventoryCharacterIndex):null;
        if(!definition||!character||!stats){ return false; }
        const resource=definition.resource;
        const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);
        const currentValue=Number(character[resource])||0;
        if(!(maxValue>0)||currentValue>=maxValue){
            alert((character.id||"角色")+(resource==="hp"?" HP":" SP")+"目前不需要補充。");
            return false;
        }
        if(typeof consumePotionFromInventory!=="function"||!consumePotionFromInventory(definition.id,1)){
            alert(definition.name+"數量不足。");
            return false;
        }
        const planned=definition.recoveryPercent>=100
            ?maxValue-currentValue
            :Math.max(1,Math.round(maxValue*Number(definition.recoveryPercent||0)/100));
        const recovered=Math.max(0,Math.min(maxValue-currentValue,planned));
        character[resource]=Math.min(maxValue,currentValue+recovered);
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        if(typeof renderInventory==="function"){ renderInventory(); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof closeItemModal==="function"){ closeItemModal(); }
        alert((character.id||"角色")+"使用"+definition.name+"，恢復"+recovered+" "+resource.toUpperCase()+"。");
        return true;
    };

    if(typeof openItemModal==="function"){
        const originalOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=originalOpenItemModal.apply(this,arguments);
            const item=inventorySlots[slotIndex];
            const icon=document.getElementById("itemModalIcon");
            if(icon&&item){ icon.innerHTML=item.icon||"◆"; }
            appendReforgeStatsToModal(item);
            syncDecomposeButton(item,slotIndex);
            syncInventoryPotionUseButton(item,slotIndex);
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const originalOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item){
            const result=originalOpenEquippedItem.apply(this,arguments);
            const icon=document.getElementById("itemModalIcon");
            if(icon&&item){ icon.innerHTML=item.icon||"◆"; }
            appendReforgeStatsToModal(item);
            syncDecomposeButton(null,null);
            syncInventoryPotionUseButton(null,null);
            return result;
        };
    }

    document.addEventListener("dragstart",event=>{
        if(event.target&&event.target.closest&&event.target.closest("#inventoryPage,#itemModal")){
            event.preventDefault();
        }
    });

    /* =====================================================
       Additional characters can manually cast support skills
    ===================================================== */
    if(typeof prepareAction==="function"){
        const originalPrepareAction=prepareAction;
        prepareAction=function(type){
            const skill=skillDatabase[type];
            if(
                activeBattleCharacterIndex<=0 ||
                !skill ||
                !["buff","heal","revive"].includes(skill.category)
            ){
                return originalPrepareAction.apply(this,arguments);
            }
            const character=getPartyCharacterByIndex(activeBattleCharacterIndex);
            const autoOn=getPartyAutoConfig(activeBattleCharacterIndex).enabled;
            if(!battleActive||!character||character.hp<=0||autoOn||actionReady){ return; }
            const spCost=skill.spCost!==undefined?skill.spCost:skill.cost;
            if(character.sp<spCost){
                addBattleLog("SP不足，無法使用"+skill.name);
                return;
            }

            if(skill.targetType==="ally"||skill.targetType==="allyTri"||skill.targetType==="deadAlly"){
                const hasTarget=[0,1,2].some(index=>isValidAllyTargetForSkill(
                    skill,getBattleCharacterByIndex(index),index
                ));
                if(!hasTarget){
                    addBattleLog(skill.targetType==="deadAlly"?"目前沒有陣亡的隊友可供復活。":"目前沒有可選擇的友方目標。");
                    return;
                }
                actionReady=true;
                pendingAction=type;
                closeMenus();
                setBattleAllyTargetSelectionMode(type);
                return;
            }

            actionReady=true;
            queuedPlayerActions[activeBattleCharacterIndex]={action:type,target:null,targetAlly:null};
            closeMenus();
            updateUI();
            finishPlayerAction();
        };
    }

    /* =====================================================
       Card effects (legacy visual renderer retired; data/status only)
    ===================================================== */
    function cardFor(side,index){
        return document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
    }

    /* Persistent visual rendering is owned by V143. Keep only this stable
       compatibility call surface because older support actions still invoke it
       after their gameplay result is committed. */
    window.v141PlayCardEffect=function(){ return false; };


    function executeAdditionalSupportAction(characterIndex,queued,skill){
        const character=getPartyCharacterByIndex(characterIndex);
        const characterKey=getPartyCharacterKey(characterIndex);
        const casterStats=getPartyBattleStats(characterIndex);
        const level=Math.max(0,Number(getSkillLevel(characterKey,skill.id))||0);
        const cost=Number(skill.spCost!==undefined?skill.spCost:skill.cost)||0;
        const targetIndex=Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
        const target=getBattleCharacterByIndex(targetIndex);

        function stop(message){
            if(message){ addBattleLog(message); }
            updateUI();
            finishPlayerAction();
            return true;
        }

        if(!character||!casterStats){ return stop("角色狀態無法讀取，本次行動已略過。"); }
        if(level<=0){ return stop((character.id||"角色")+"尚未學習"+skill.name+"。"); }
        if(character.sp<cost){ return stop((character.id||"角色")+"SP不足，無法使用"+skill.name+"。"); }
        if(skill.category==="heal"&&(!target||target.hp<=0)){ return stop(skill.name+"的目標無法接受治療。"); }
        if(skill.category==="revive"&&(!target||target.hp>0)){ return stop("目前選擇的目標不需要復活。"); }
        if(skill.category==="buff"&&skill.targetType==="ally"&&(!target||target.hp<=0)){
            return stop(skill.name+"的目標無法接受效果。");
        }

        character.sp-=cost;
        lungePlayerCard(characterIndex);
        showSkillNameBadge(skill.name,skill.element,characterIndex);
        setTimeout(()=>showPlayerSpPopup(cost,characterIndex),500);

        if(skill.category==="buff"){
            const targets=skill.targetType==="allyAll"
                ? getExistingPartyIndexes().map(getPartyCharacterByIndex).filter(item=>item&&item.hp>0)
                : [target||character];
            let extra={};
            if(skill.id==="rage"){
                const chance=(skill.critChanceBonusByLevel||skill.critBonusByLevel||[])[level-1]||0;
                const damage=(skill.critDamageBonusByLevel||skill.critBonusByLevel||[])[level-1]||0;
                extra={
                    bonusPercent:chance,
                    critChanceBonusPercent:chance,
                    critDamageBonusPercent:damage
                };
            }
            else if(skill.id==="dodgeSkill"){ extra={percent:skill.evasionBonusPercent}; }
            else if(skill.id==="rockWall"){ extra={percent:skill.defenseBonusPercent}; }
            else if(skill.id==="earthShield"){ extra={percent:skill.reflectPercent}; }
            else if(skill.id==="dinghaishenzhen"){ extra={resistBonus:skill.statusResistBonus}; }
            else if(skill.id==="barrier"){
                extra={
                    sourceSkill:"barrier",
                    barrierRule:"shared",
                    remainingBlocks:Number(skill.barrierBlockCount)||5
                };
            }
            targets.forEach(ally=>{
                ally.activeBuffs=(ally.activeBuffs||[]).filter(buff=>buff.type!==skill.id);
                ally.activeBuffs.push(Object.assign({type:skill.id,turnsLeft:skill.duration||2},extra));
                const actualIndex=getPartyCharacterIndex(ally);
                if(actualIndex>=0){ window.v141PlayCardEffect("player",actualIndex,/shield|barrier|護盾|結界/i.test(skill.id+skill.name)?"shield":"buff"); }
            });
            addBattleLog((character.id||"角色")+"施放"+skill.name+"，增益效果已套用。 ");
        }else if(skill.category==="heal"){
            const targetStats=getPartyBattleStats(targetIndex);
            const exId=skill.element+"EX";
            const exSkill=skillDatabase[exId];
            const exLevel=getSkillLevel(characterKey,exId);
            const multiplier=exSkill&&exLevel>0&&exSkill.healBonusPercent?1+exSkill.healBonusPercent/100:1;
            const baseHp=(Number(skill.baseHeal)||0)+(Number(skill.healPerLevel)||0)*(level-1);
            const plannedHp=Math.floor(calculateHealingAmount(baseHp,casterStats.intelligence)*multiplier);
            const actualHp=Math.max(0,Math.min(plannedHp,targetStats.maxHP-target.hp));
            const baseSp=(Number(skill.baseHealSP)||0)+(Number(skill.healSPPerLevel)||0)*(level-1);
            const plannedSp=target===character?0:Math.floor(calculateSPHealingAmount(baseSp,casterStats.intelligence)*multiplier);
            const actualSp=Math.max(0,Math.min(plannedSp,targetStats.maxSP-target.sp));
            target.hp=Math.min(targetStats.maxHP,target.hp+plannedHp);
            if(target!==character){ target.sp=Math.min(targetStats.maxSP,target.sp+plannedSp); }
            if(actualHp>0){ showPlayerHit(actualHp,"heal",targetIndex,true); }
            window.v141PlayCardEffect("player",targetIndex,"heal");
            addBattleLog(skill.name+"使"+(target.id||"隊友")+"恢復"+actualHp+" HP"+(target===character?"；施放者本人不回復SP。":"、"+actualSp+" SP。"));
        }else if(skill.category==="revive"){
            const targetStats=getPartyBattleStats(targetIndex);
            const exId=skill.element+"EX";
            const exSkill=skillDatabase[exId];
            const exLevel=getSkillLevel(characterKey,exId);
            const multiplier=exSkill&&exLevel>0&&exSkill.healBonusPercent?1+exSkill.healBonusPercent/100:1;
            const percent=(skill.reviveHealPercentByLevel||[20])[Math.min(level-1,(skill.reviveHealPercentByLevel||[20]).length-1)];
            target.hp=Math.max(1,Math.min(targetStats.maxHP,Math.floor(targetStats.maxHP*percent/100*multiplier)));
            setTimeout(()=>showPlayerHit(target.hp,"heal",targetIndex,true),300);
            window.v141PlayCardEffect("player",targetIndex,"revive");
            addBattleLog((target.id||"隊友")+"被"+skill.name+"復活，恢復"+target.hp+" HP。");
        }

        updateUI();
        finishPlayerAction();
        return true;
    }

    if(typeof updateMonsterUI==="function"){
        const originalUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            if(typeof window.v141SyncMonsterShield==="function"){
                window.v141SyncMonsterShield(monsters[index]);
            }
            const result=originalUpdateMonsterUI.apply(this,arguments);
            const monster=monsters[index];
            if(monster){
                const normalBar=document.getElementById("battleMonsterBar"+index);
                const shieldBar=document.getElementById("battleMonsterShieldBar"+index);
                const hpText=document.getElementById("battleMonsterHPText"+index);
                const shield=monster.v141Shield;
                const remaining=shield?Math.max(0,Number(shield.remaining)||0):0;
                if(shield&&remaining>0){
                    const baseMax=shield.baseMaxHP;
                    const baseHp=Math.max(0,monster.hp-remaining);
                    const visibleShield=shield.isBarrier?baseMax:remaining;
                    const total=Math.max(1,baseMax+visibleShield);
                    if(normalBar){ normalBar.style.width=(baseHp/total*100)+"%"; }
                    if(shieldBar){
                        shieldBar.style.left=(baseHp/total*100)+"%";
                        shieldBar.style.width=(visibleShield/total*100)+"%";
                    }
                    if(hpText){
                        hpText.textContent=shield.isBarrier
                            ?Math.floor(baseHp)+"/"+baseMax+"　結界"
                            :Math.floor(baseHp)+"/"+baseMax+" +"+Math.floor(remaining);
                    }
                }else if(shieldBar){
                    shieldBar.style.left="0";
                    shieldBar.style.width="0";
                }
            }
            return result;
        };
    }


    if(typeof resolveQueuedPlayerAction==="function"){
        const originalResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=queuedPlayerActions[characterIndex]
                ? Object.assign({},queuedPlayerActions[characterIndex])
                : null;
            const skill=queued&&skillDatabase[queued.action];
            const talisman=queued&&window.v132GetTalismanDefinition
                ? window.v132GetTalismanDefinition(queued.action)
                : null;
            if(
                characterIndex>0&&queued&&skill&&
                ["buff","heal","revive"].includes(skill.category)
            ){
                return executeAdditionalSupportAction(characterIndex,queued,skill);
            }
            const result=originalResolveQueuedPlayerAction.apply(this,arguments);
            setTimeout(()=>{
                if(!queued){ return; }
                if(queued.action==="potion"){
                    window.v141PlayCardEffect("player",characterIndex,"potion");
                }else if(talisman){
                    const side=talisman.talismanEffect==="freeze"?"monster":"player";
                    const target=side==="monster"?queued.target:queued.targetAlly;
                    if(Number.isInteger(target)){ window.v141PlayCardEffect(side,target,"talisman"); }
                }else if(skill){
                    if(skill.category==="heal"&&Number.isInteger(queued.targetAlly)){
                        window.v141PlayCardEffect("player",queued.targetAlly,"heal");
                    }else if(skill.category==="revive"&&Number.isInteger(queued.targetAlly)){
                        window.v141PlayCardEffect("player",queued.targetAlly,"revive");
                    }else if(skill.category==="buff"){
                        const type=/shield|barrier|護盾|結界/i.test(skill.id+skill.name)?"shield":"buff";
                        if(skill.targetType==="allyAll"){
                            getExistingPartyIndexes().forEach(index=>window.v141PlayCardEffect("player",index,type));
                        }else if(Number.isInteger(queued.targetAlly)){
                            window.v141PlayCardEffect("player",queued.targetAlly,type);
                        }
                    }
                }
            },0);
            return result;
        };
    }

    /* =====================================================
       Dungeon element balancing and battle rendering
    ===================================================== */
    function rebalanceDungeonElements(){
        if(!window.v132ActiveDungeonRun){ return; }
        const roster=currentBattleMonsters.map(index=>monsters[index]).filter(Boolean);
        if(roster.some(monster=>monster.v141Abyss)){ return; }
        const elements=["fire","water","earth","wind"];
        for(let i=elements.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [elements[i],elements[j]]=[elements[j],elements[i]];
        }
        const bosses=roster.filter(monster=>getMonsterRank(monster)==="boss");
        bosses.forEach((monster,index)=>{ monster.element=elements[index%elements.length]; });
        let cursor=bosses.length;
        roster.filter(monster=>getMonsterRank(monster)!=="boss").forEach(monster=>{
            monster.element=elements[cursor++%elements.length];
        });
        roster.forEach(monster=>{
            const oldSkills=(monster.skillIds||[]).map(id=>skillDatabase[id]).filter(Boolean);
            const tier=Math.max(0,...oldSkills.map(skill=>Number(skill.tier)||0));
            const pool=Object.keys(skillDatabase).filter(id=>{
                const skill=skillDatabase[id];
                return skill&&skill.element===monster.element&&
                    (skill.category==="physical"||skill.category==="magic")&&
                    (!tier||skill.tier===tier);
            });
            if(typeof window.v141ConfigureMonsterSkills==="function"){
                window.v141ConfigureMonsterSkills(monster,{pool:pool});
            }
        });
    }

    function applyFixedAbyssFormation(){
        const area=document.getElementById("battleMonsterArea");
        if(!area){ return; }
        const fixed=currentBattleMonsters
            .map(index=>({index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&Number.isInteger(entry.monster.v141FormationRow));
        if(!fixed.length){ return; }
        const cards=new Map(fixed.map(entry=>[entry.index,document.getElementById("battleMonster"+entry.index)]));
        area.innerHTML="";
        area.classList.add("v131-formation","v141-fixed-formation");
        [0,1].forEach(rowNumber=>{
            const row=document.createElement("div");
            row.className="v131-monster-row v131-monster-row-"+(rowNumber+1);
            fixed.filter(entry=>entry.monster.v141FormationRow===rowNumber)
                .sort((a,b)=>(a.monster.v141FormationPosition||0)-(b.monster.v141FormationPosition||0))
                .forEach(entry=>{
                    const card=cards.get(entry.index);
                    if(card){ row.appendChild(card); }
                });
            area.appendChild(row);
        });
    }
    window.v141ApplyFixedAbyssFormation=applyFixedAbyssFormation;

    function ensureMonsterShieldBars(){
        currentBattleMonsters.forEach(index=>{
            const hp=document.querySelector("#battleMonster"+index+" .monster-hp");
            if(!hp||document.getElementById("battleMonsterShieldBar"+index)){ return; }
            const bar=document.createElement("div");
            bar.id="battleMonsterShieldBar"+index;
            bar.className="v141-monster-shield-bar";
            const text=document.getElementById("battleMonsterHPText"+index);
            hp.insertBefore(bar,text||null);
        });
    }

    function decorateBattleCards(){
        ensureMonsterShieldBars();
        currentBattleMonsters.forEach(index=>{
            const card=cardFor("monster",index);
            const monster=monsters[index];
            if(card&&monster){
                card.dataset.element=monster.element||"unknown";
                card.dataset.rank=getMonsterRank(monster);
                updateMonsterUI(index);
            }
        });
        applyFixedAbyssFormation();
    }

    const startedEntryTokens=new Set();

    function v141PrepareBattleRender(){
        const isDungeon=!!window.v132ActiveDungeonRun;
        if(!isDungeon && lastWildRankToken!==battleToken){
            lastWildRankToken=battleToken;
            if(typeof window.v141RollWildMonsterRanks==="function"){
                window.v141RollWildMonsterRanks(currentBattleMonsters);
            }
        }
        if(isDungeon){ rebalanceDungeonElements(); }

        battleSnapshot={
            token:battleToken,
            gold:Math.max(0,Number(gold)||0),
            exp:Math.max(0,Number(sharedExp)||0),
            items:getItemCounts(),
            dungeon:isDungeon
        };
    }

    function v141AfterBattleRender(){
        decorateBattleCards();
        const page=document.getElementById("battlePage");
        /* Reinforcements redraw the existing battle. Its entry has already
           started, so startTurn will not run the entry cleanup again. */
        if(page&&!startedEntryTokens.has(battleToken)){
            page.classList.remove("v141-entry-moving","v141-exit-player","v141-exit-monster");
            page.classList.add("v141-preparing-entry");
        }
    }

    window.v141PrepareBattleRender=v141PrepareBattleRender;
    window.v141AfterBattleRender=v141AfterBattleRender;

    /* =====================================================
       Battle transitions and post-battle reward timing
    ===================================================== */
    function ensureBattleTransitionOverlay(){
        const page=document.getElementById("battlePage");
        if(!page){ return null; }
        let overlay=document.getElementById("v141BattleTransition");
        if(!overlay){
            overlay=document.createElement("div");
            overlay.id="v141BattleTransition";
            overlay.className="v141-battle-transition";
            overlay.innerHTML='<span></span><b>戰</b><span></span>';
            page.appendChild(overlay);
        }
        return overlay;
    }

    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            if(!battleActive||startedEntryTokens.has(token)){
                return originalStartTurn.apply(this,arguments);
            }
            startedEntryTokens.add(token);
            const overlay=ensureBattleTransitionOverlay();
            const page=document.getElementById("battlePage");
            transitionRunning=true;
            if(overlay){ overlay.classList.add("show"); }
            setTimeout(()=>{
                if(overlay){ overlay.classList.remove("show"); }
                if(page){
                    page.classList.remove("v141-preparing-entry");
                    page.classList.add("v141-entry-moving");
                }
                setTimeout(()=>{
                    if(page){ page.classList.remove("v141-entry-moving"); }
                    transitionRunning=false;
                    if(battleActive&&token===battleToken){ originalStartTurn.call(this,token); }
                },720);
            },1000);
        };
    }

    function collectRewardSummary(){
        const snapshot=battleSnapshot;
        if(!snapshot){ return {exp:0,gold:0,items:[]}; }
        const nowItems=getItemCounts();
        const items=[];
        nowItems.forEach((entry,id)=>{
            const before=snapshot.items.get(id);
            const delta=entry.count-(before?before.count:0);
            if(delta>0){
                items.push({
                    id,
                    name:entry.name,
                    count:delta
                });
            }
        });
        return {
            exp:Math.max(0,Math.floor((Number(sharedExp)||0)-snapshot.exp)),
            gold:Math.max(0,Math.floor((Number(gold)||0)-snapshot.gold)),
            items:items
        };
    }

    function showBlackGoldReward(summary){
        let toast=document.getElementById("v141RewardToast");
        if(!toast){
            toast=document.createElement("div");
            toast.id="v141RewardToast";
            toast.className="v141-reward-toast";
            document.body.appendChild(toast);
        }
        const parts=[];
        if(summary.exp>0){ parts.push('<span><b>EXP</b> +'+summary.exp.toLocaleString("zh-TW")+'</span>'); }
        if(summary.gold>0){ parts.push('<span><b>金幣</b> +'+summary.gold.toLocaleString("zh-TW")+'</span>'); }
        summary.items.forEach(item=>{
            const canonicalIcon=getCanonicalTicketIcon(item);
            const icon=canonicalIcon
                ? '<i class="v141-reward-item-icon" aria-hidden="true">'+canonicalIcon+'</i>'
                : "";
            parts.push(
                '<span class="v141-reward-item">'+icon+
                '<span><b>物品</b> '+escapeHtml(item.name)+' ×'+item.count+'</span></span>'
            );
        });
        if(!parts.length){ return; }
        toast.innerHTML='<strong>戰鬥獎勵</strong><div>'+parts.join("")+'</div>';
        toast.classList.remove("show");
        void toast.offsetWidth;
        toast.classList.add("show");
        clearTimeout(toast._hideTimer);
        toast._hideTimer=setTimeout(()=>toast.classList.remove("show"),4200);
    }
    window.v141ShowBlackGoldReward=showBlackGoldReward;

    if(typeof showExpToast==="function"){
        showExpToast=function(amount){
            if(Date.now()<suppressLegacyExpToastUntil){ return; }
            showBlackGoldReward({exp:Math.max(0,Math.floor(Number(amount)||0)),gold:0,items:[]});
        };
    }

    function finishBattleExit(kind,original,args,context){
        if(transitionRunning){ return; }
        transitionRunning=true;
        const wasDungeon=!!window.v132ActiveDungeonRun;
        const page=document.getElementById("battlePage");
        const overlay=ensureBattleTransitionOverlay();
        /* Keep the final hit / death pose readable before cards leave and the
           opaque result seal arrives.  This is deliberately longer than the
           card-hit animation and is still owned by the battle exit lifecycle. */
        setTimeout(()=>{
            if(page){ page.classList.add(kind==="win"?"v141-exit-player":"v141-exit-monster"); }
        },720);
        setTimeout(()=>{
            if(overlay){
                const label=overlay.querySelector("b");
                if(label){ label.textContent=kind==="win"?"勝利":"戰鬥失敗"; }
                overlay.dataset.v144Kind=kind==="win"?"win":"lose";
                overlay.classList.add("show");
            }
        },1450);
        setTimeout(()=>{
            /* 舊 winBattle 會再延遲呼叫一次 showExpToast；必須在進入舊
               結算前先抑制，否則會先跳單獨 EXP，再跳本層整合獎勵。 */
            if(kind==="win"){ suppressLegacyExpToastUntil=Date.now()+5000; }
            const result=original.apply(context,args);
            const summary=collectRewardSummary();
            if(page){ page.classList.remove("v141-exit-player","v141-exit-monster","v141-preparing-entry","v141-entry-moving"); }
            if(overlay){ overlay.classList.remove("show"); }
            transitionRunning=false;

            if(!wasDungeon){
                showPage("map");
                if(typeof startMonsterMovement==="function"){ startMonsterMovement(); }
                if(typeof scheduleAutoPatrolCheck==="function"){ scheduleAutoPatrolCheck(5000); }
                if(typeof updateUI==="function"){ updateUI(); }
                if(kind==="win"){ setTimeout(()=>showBlackGoldReward(summary),120); }
            }
            return result;
        },2700);
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        let exitingWin=false;
        winBattle=function(){
            if(!battleActive||exitingWin){ return; }
            exitingWin=true;
            const args=arguments;
            const context=this;
            finishBattleExit("win",function(){
                try{ return originalWinBattle.apply(context,args); }
                finally{ exitingWin=false; }
            },[],this);
        };
    }

    if(typeof loseBattle==="function"){
        const originalLoseBattle=loseBattle;
        let exitingLoss=false;
        loseBattle=function(){
            if(!battleActive||exitingLoss){ return; }
            exitingLoss=true;
            const args=arguments;
            const context=this;
            finishBattleExit("lose",function(){
                try{ return originalLoseBattle.apply(context,args); }
                finally{ exitingLoss=false; }
            },[],this);
        };
    }

    if(typeof window.v132ShowRewardModal==="function"){
        const originalShowRewardModal=window.v132ShowRewardModal;
        window.v132ShowRewardModal=function(innerHtml){
            const battlePage=document.getElementById("battlePage");
            const leavingBattle=battlePage&&battlePage.classList.contains("active");
            if(leavingBattle){
                showPage("dungeon");
                switchDungeonTab("daily");
                setTimeout(()=>originalShowRewardModal.call(this,innerHtml),180);
                return;
            }
            return originalShowRewardModal.apply(this,arguments);
        };
    }

    /* =====================================================
       Patrol click movement and task tracker
    ===================================================== */
    function installPatrolClickMovement(){
        const page=document.getElementById("mapPage");
        if(!page||page.dataset.v141MoveReady==="1"){ return; }
        page.dataset.v141MoveReady="1";
        page.addEventListener("click",function(event){
            if(battleActive||patrolInFightAnimation||event.defaultPrevented){ return; }
            if(event.target.closest("button,#v141TaskTracker,[id^='mapMonster'],#v131PatrolAppearanceSwitchWrap,#mapBattleOverlay")){ return; }
            const wrap=document.getElementById("patrolCharacterWrap");
            if(!wrap){ return; }
            const rect=page.getBoundingClientRect();
            if(!rect.width||!rect.height){ return; }
            const x=Math.max(.12,Math.min(.88,(event.clientX-rect.left)/rect.width));
            const overlay=document.getElementById("mapBattleOverlay");
            const overlayRect=overlay&&overlay.style.display!=="none"?overlay.getBoundingClientRect():null;
            const bottomClient=overlayRect&&overlayRect.top>rect.top?overlayRect.top-12:rect.top+rect.height*.62;
            const y=Math.max(.16,Math.min((bottomClient-rect.top)/rect.height,(event.clientY-rect.top)/rect.height));
            const oldX=parseFloat(wrap.style.left)||50;
            const oldY=parseFloat(wrap.style.top)||37;
            const newX=x*100;
            const newY=y*100;
            const distance=Math.hypot((newX-oldX)*rect.width/100,(newY-oldY)*rect.height/100);
            const duration=Math.max(.45,Math.min(2.6,distance/125));

            if(patrolWalkIntervalId){ clearInterval(patrolWalkIntervalId); patrolWalkIntervalId=null; }
            wrap.style.transition="left "+duration+"s cubic-bezier(.22,.61,.36,1),top "+duration+"s cubic-bezier(.22,.61,.36,1)";
            wrap.style.left=newX+"%";
            wrap.style.top=newY+"%";
            patrolCurrentTop=newY;
            const img=document.getElementById("patrolCharacterImg");
            if(img){ img.classList.add("v141-manual-walking"); }
            if(typeof window.v131ApplyPatrolArt==="function"){
                window.v131ApplyPatrolArt(newY<oldY);
            }
            setTimeout(()=>{
                if(img){ img.classList.remove("v141-manual-walking"); }
                if(typeof window.v131ApplyPatrolArt==="function"){ window.v131ApplyPatrolArt(false); }
                if(autoPatrolEnabled&&!battleActive){ startPatrolCharacterWalking(); }
            },duration*1000+40);
        });
    }

    function loadTaskTrackerState(){
        try{
            const value=JSON.parse(localStorage.getItem(TASK_TRACKER_KEY)||"{}");
            return {top:Number(value.top)||18,collapsed:!!value.collapsed};
        }catch(_){ return {top:18,collapsed:false}; }
    }
    const taskTrackerState=loadTaskTrackerState();
    function persistTaskTracker(){
        try{ localStorage.setItem(TASK_TRACKER_KEY,JSON.stringify(taskTrackerState)); }catch(_){ }
    }

    function getTrackerQuest(definitions,state){
        return definitions.find(quest=>!state.claimed[quest.id]&&(Number(state.progress[quest.id])||0)<quest.goal)||
            definitions.find(quest=>!state.claimed[quest.id])||null;
    }

    function renderTaskTracker(){
        const tracker=document.getElementById("v141TaskTracker");
        if(!tracker){ return; }
        ensureDailyQuestsCurrent();
        tracker.classList.toggle("collapsed",taskTrackerState.collapsed);
        const body=tracker.querySelector(".v141-task-tracker-body");
        if(!body){ return; }
        const daily=getTrackerQuest(dailyQuestDefinitions,dailyQuestState);
        const commission=getTrackerQuest(commissionQuestDefinitions,commissionQuestState);
        const rows=[["每日",daily,dailyQuestState],["委託",commission,commissionQuestState]]
            .filter(entry=>entry[1])
            .map(([label,quest,state])=>{
                const progress=Math.min(quest.goal,Number(state.progress[quest.id])||0);
                return '<div><b>'+label+'</b><span>'+escapeHtml(quest.name)+'</span><em>'+progress+'/'+quest.goal+'</em></div>';
            }).join("");
        if(body.dataset.rows!==rows){ body.dataset.rows=rows; body.innerHTML=rows||'<div><span>今日任務已完成</span></div>'; }
    }

    function clampTaskTracker(){
        const page=document.getElementById("mapPage");
        const tracker=document.getElementById("v141TaskTracker");
        if(!page||!tracker){ return; }
        const maxTop=Math.max(72,page.clientHeight-70-(document.getElementById("mapBattleOverlay")?.offsetHeight||102)-tracker.offsetHeight-8);
        taskTrackerState.top=Math.max(72,Math.min(maxTop,taskTrackerState.top));
        tracker.style.top=taskTrackerState.top+"px";
    }

    function installTaskTracker(){
        const page=document.getElementById("mapPage");
        if(!page||document.getElementById("v141TaskTracker")){ return; }
        const tracker=document.createElement("aside");
        tracker.id="v141TaskTracker";
        tracker.className="v141-task-tracker";
        tracker.innerHTML=
            '<button type="button" class="v141-task-collapse" aria-label="隱藏或展開任務">‹</button>'+
            '<div class="v141-task-tracker-title">任務追蹤</div>'+
            '<div class="v141-task-tracker-body"></div>';
        page.appendChild(tracker);
        const collapse=tracker.querySelector(".v141-task-collapse");
        collapse.addEventListener("click",event=>{
            event.stopPropagation();
            taskTrackerState.collapsed=!taskTrackerState.collapsed;
            persistTaskTracker();
            renderTaskTracker();
        });

        let drag=null;
        tracker.addEventListener("pointerdown",event=>{
            if(event.target===collapse){ return; }
            drag={id:event.pointerId,startY:event.clientY,startTop:taskTrackerState.top};
            try{ tracker.setPointerCapture(event.pointerId); }catch(_){ }
            event.preventDefault();
        });
        tracker.addEventListener("pointermove",event=>{
            if(!drag||drag.id!==event.pointerId){ return; }
            const pageRect=page.getBoundingClientRect();
            const scale=pageRect.height?page.clientHeight/pageRect.height:1;
            taskTrackerState.top=drag.startTop+(event.clientY-drag.startY)*scale;
            clampTaskTracker();
            event.preventDefault();
        });
        function finish(event){
            if(!drag||drag.id!==event.pointerId){ return; }
            drag=null;
            persistTaskTracker();
            event.preventDefault();
        }
        tracker.addEventListener("pointerup",finish);
        tracker.addEventListener("pointercancel",finish);
        renderTaskTracker();
        requestAnimationFrame(clampTaskTracker);
    }

    /* =====================================================
       Quest milestone chests
    ===================================================== */
    function today(){ return new Date().toISOString().slice(0,10); }
    function loadMilestones(){
        try{
            const state=JSON.parse(localStorage.getItem(QUEST_MILESTONE_KEY)||"{}");
            if(state.date===today()){
                return {date:state.date,daily:state.daily||{},commission:state.commission||{}};
            }
        }catch(_){ }
        return {date:today(),daily:{},commission:{}};
    }
    let milestoneState=loadMilestones();
    const milestoneChestImages={
        closed:"assets/ui/quest-chest-closed-v173.21.webp",
        open:"assets/ui/quest-chest-open-v173.21.webp"
    };
    const milestoneRewards={
        daily:{20:{gold:20},40:{gold:30,exp:20},60:{gold:40},80:{gold:50,exp:30},100:{gold:80,exp:50}},
        commission:{20:{gold:50},40:{gold:75,exp:30},60:{gold:100},80:{gold:150,exp:70},100:{gold:250,exp:120}}
    };
    const v17342ScaledProgressRewards=new WeakSet();
    function v17342ScaleReward(reward){
        if(!reward||typeof reward!=="object"||v17342ScaledProgressRewards.has(reward)){ return reward; }
        if(Number.isFinite(Number(reward.exp))){ reward.exp=Math.round(Number(reward.exp)*3); }
        if(Number.isFinite(Number(reward.gold))){ reward.gold=Math.round(Number(reward.gold)*5); }
        v17342ScaledProgressRewards.add(reward);
        return reward;
    }
    function v17342ScaleProgressRewards(){
        [
            typeof dailyQuestDefinitions!=="undefined"?dailyQuestDefinitions:[],
            typeof commissionQuestDefinitions!=="undefined"?commissionQuestDefinitions:[],
            typeof achievementDefinitions!=="undefined"?achievementDefinitions:[]
        ].forEach(list=>(list||[]).forEach(item=>v17342ScaleReward(item&&item.reward)));
        Object.values(milestoneRewards).forEach(table=>Object.values(table).forEach(v17342ScaleReward));
    }
    v17342ScaleProgressRewards();
    function persistMilestones(){
        try{ localStorage.setItem(QUEST_MILESTONE_KEY,JSON.stringify(milestoneState)); }catch(_){ }
    }
    function rewardLabel(reward){
        return [reward.gold?reward.gold+"金":null,reward.exp?reward.exp+"EXP":null].filter(Boolean).join("＋");
    }

    if(typeof renderQuestCompletionPanelContent==="function"){
        renderQuestCompletionPanelContent=function(definitions,state){
            if(milestoneState.date!==today()){ milestoneState={date:today(),daily:{},commission:{}}; persistMilestones(); }
            const type=definitions===commissionQuestDefinitions?"commission":"daily";
            const percent=getQuestCompletionPercent(definitions,state);
            const display=Math.floor(percent);
            const milestones=QUEST_COMPLETION_MILESTONES.map(threshold=>{
                const reached=percent>=threshold;
                const claimed=!!milestoneState[type][threshold];
                const reward=milestoneRewards[type][threshold];
                return '<div class="quest-milestone '+(reached?"reached ":"")+(claimed?"claimed":"")+'">'+
                    '<div class="quest-milestone-percent">'+threshold+'%</div>'+
                    '<button type="button" class="quest-milestone-slot" '+(!reached||claimed?"disabled":"")+
                    ' onclick="v141ClaimQuestMilestone(\''+type+'\','+threshold+')">'+
                    '<img class="quest-milestone-chest" src="'+(claimed?milestoneChestImages.open:milestoneChestImages.closed)+'" alt="" aria-hidden="true" draggable="false">'+
                    '<span>'+(claimed?"已領":reached?"領取":"寶箱")+'</span><small>'+rewardLabel(reward)+'</small></button></div>';
            }).join("");
            return '<div class="quest-completion-head"><span>完成度寶箱</span><strong>'+display+'%</strong></div>'+
                '<div class="quest-completion-track" aria-hidden="true"><div class="quest-completion-fill" style="width:'+percent+'%;"></div></div>'+
                '<div class="quest-completion-milestones">'+milestones+'</div>';
        };
    }

    window.v141ClaimQuestMilestone=function(type,threshold){
        const definitions=type==="commission"?commissionQuestDefinitions:dailyQuestDefinitions;
        const state=type==="commission"?commissionQuestState:dailyQuestState;
        if(!milestoneRewards[type]||!milestoneRewards[type][threshold]){ return; }
        if(getQuestCompletionPercent(definitions,state)<threshold||milestoneState[type][threshold]){ return; }
        const reward=milestoneRewards[type][threshold];
        gold+=reward.gold||0;
        sharedExp+=reward.exp||0;
        milestoneState[type][threshold]=true;
        persistMilestones();
        updateGoldDisplay();
        updateUI();
        saveGame();
        switchQuestTab(type==="commission"?"commission":"daily");
    };

    /* =====================================================
       Compact offline EXP, shop, element box and skill preview
    ===================================================== */
    if(typeof renderOfflineExpContent==="function"){
        renderOfflineExpContent=function(){
            const multiplier=typeof window.v141GetOfflineLevelMultiplier==="function"
                ? window.v141GetOfflineLevelMultiplier():1;
            const rested=typeof window.v139GetRestedExpState==="function"
                ? window.v139GetRestedExpState():{battles:0,maxBattles:300};
            return '<div class="v141-offline-panel">'+
                '<section><small>依帳號最高角色 Lv.'+(window.v141GetHighestCharacterLevel?window.v141GetHighestCharacterLevel():1)+'</small>'+
                '<strong>'+Math.floor(pendingOfflineExp).toLocaleString("zh-TW")+' EXP</strong>'+
                '<span>離線倍率 ×'+multiplier.toFixed(1)+'・上限 '+OFFLINE_EXP_MAX_MINUTES+' 分鐘</span></section>'+
                '<div class="v141-offline-actions">'+
                '<button type="button" '+(pendingOfflineExp<=0?"disabled":"")+' onclick="claimOfflineExp(false)">直接領取</button>'+
                '<button type="button" '+(pendingOfflineExp<=0?"disabled":"")+' onclick="claimOfflineExpWithAd()">廣告雙倍</button></div>'+
                '<section class="rested"><small>休息經驗</small><strong>'+rested.battles+' / '+rested.maxBattles+' 場</strong>'+
                '<span>一般練功 EXP ×2；元素匣與副本不消耗</span></section></div>';
        };
    }

    /* Shop render/purchase ownership is finalized by V144; legacy V141 wrappers removed. */

    function compactElementBoxPanel(){
        const panel=document.getElementById("autoBattleSettingsPanel");
        const stats=document.getElementById("v131ElementBoxStats");
        if(!panel||!stats){ return; }
        const state=window.v131GetElementBoxState?window.v131GetElementBoxState():{remainingMs:0};
        const totalMinutes=Math.floor(state.remainingMs/60000);
        const text=Math.floor(totalMinutes/60)+"小時 "+(totalMinutes%60)+"分鐘";
        stats.innerHTML=
            '<div class="v141-element-box-remaining"><span>元素匣剩餘時間</span><strong id="v131EbRemaining">'+text+'</strong></div>'+
            '<button type="button" class="v141-element-box-ad" onclick="v141WatchElementBoxAd()">觀看廣告 ＋8小時</button>'+
            '<small>最多可累積32小時，可隨時增加。</small>';
        panel.classList.add("v141-compact-element-box");
    }

    window.v141WatchElementBoxAd=function(){
        const state=window.v131GetElementBoxState?window.v131GetElementBoxState():{remainingMs:0};
        if(state.remainingMs>=32*60*60*1000){ alert("元素匣已達32小時上限。"); return; }
        showRewardedAd(()=>{
            if(window.v131GrantElementBoxHours){ window.v131GrantElementBoxHours(8,32); }
            compactElementBoxPanel();
            addBattleLog("元素匣增加8小時，最多累積32小時。");
        },()=>alert("廣告未完成，未增加元素匣時數。"));
    };

    if(typeof openAllElementSkillPreview==="function"){
        const originalOpenAllElementSkillPreview=openAllElementSkillPreview;
        openAllElementSkillPreview=function(){
            const modal=document.getElementById("allElementSkillPreviewModal");
            if(modal&&modal.parentElement!==document.body){ document.body.appendChild(modal); }
            if(modal){ modal.classList.add("v141-body-preview"); }
            return originalOpenAllElementSkillPreview.apply(this,arguments);
        };
    }

    /* =====================================================
       Daily dungeon covers and dungeon navigation
    ===================================================== */
    const dungeonCoverData={
        exp:{title:"經驗副本",requirement:"任一角色達到10級",reward:"共用經驗池 EXP",action:"v132BeginExpDungeon"},
        material:{title:"材料副本",requirement:"任一角色達到10級",reward:"材料寶箱 ×1～3",action:"v132BeginMaterialDungeon"},
        equipment:{title:"裝備副本",requirement:"任一角色達到10級",reward:"自選系列裝備抽獎券",action:"v132BeginEquipmentDungeon"}
    };

    function renderDungeonCoverCard(type){
        const data=dungeonCoverData[type];
        const available=!window.v132IsDungeonAvailable||window.v132IsDungeonAvailable(type);
        return '<article class="v141-dungeon-cover-card" data-dungeon-cover="'+type+'">'+
            '<div class="v141-dungeon-cover-art"><span>'+data.title+'</span><small>封面圖預留區</small></div>'+
            '<div class="v141-dungeon-cover-info"><b>'+data.title+'</b><span>開放：'+data.requirement+'</span></div>'+
            '<div class="v141-dungeon-cover-actions">'+
            '<button type="button" onclick="v141ShowDungeonRewardPreview(\''+type+'\')">獎勵預覽</button>'+
            '<button type="button" '+(available?'onclick="'+data.action+'()"':'disabled')+'>挑戰</button></div>'+
            '<div class="v141-dungeon-remaining">剩餘次數：'+(available?'1':'0')+' / 1</div></article>';
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){
                return '<div class="v141-dungeon-cover-list">'+Object.keys(dungeonCoverData).map(renderDungeonCoverCard).join("")+'</div>';
            }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }

    window.v141ShowDungeonRewardPreview=function(type){
        const data=dungeonCoverData[type];
        if(!data){ return; }
        const html='<div class="v132-reward-modal-inner"><h3>'+data.title+'獎勵預覽</h3><p>'+data.reward+'</p>'+
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        if(window.v132ShowRewardModal){ window.v132ShowRewardModal(html); }
    };

    function installDungeonNavigation(){
        /* The legacy v141-dungeon-return/nav markup owner is retired.
 The final V148 context-nav owner creates and renders the shell. */
        if(typeof window.v148SyncContextNavigation==="function"){
  window.v148SyncContextNavigation();
        }else if(typeof window.v148SyncDungeonShell==="function"){
  window.v148SyncDungeonShell();
        }
    }

    /* =====================================================
       Notification dots
    ===================================================== */
    function setNotificationDot(target,show,label){
        if(!target){ return; }
        let dot=target.querySelector(":scope > .v141-notice-dot");
        if(show&&!dot){
            dot=document.createElement("span");
            dot.className="v141-notice-dot";
            dot.setAttribute("aria-label",label||"有新內容");
            target.appendChild(dot);
        }else if(!show&&dot){ dot.remove(); }
    }

    function updateNotificationDots(){
        if(typeof ensureDailyQuestsCurrent==="function"){ ensureDailyQuestsCurrent(); }
        const hasQuestNotice=[
            ...dailyQuestDefinitions.map(quest=>[quest,dailyQuestState]),
            ...commissionQuestDefinitions.map(quest=>[quest,commissionQuestState])
        ].some(([quest,state])=>!state.claimed[quest.id]);
        const hasAchievement=achievementDefinitions.some(item=>item.check()&&!achievementState[item.id]);
        const hasExpLevelUp=typeof getExistingPartyIndexes==="function"&&getExistingPartyIndexes().some(index=>{
            const character=getPartyCharacterByIndex(index);
            const maxLevel=Math.max(1,Number(window.v133MaxLevel)||100);
            return !!(character&&Number(character.level)<maxLevel&&Number(sharedExp)>=Math.max(1,Number(character.expNext)||1));
        });
        const releaseAnnouncementUnread=
            !!(
                window.FourSymbolsReleaseUpdate&&
                typeof window.FourSymbolsReleaseUpdate.hasUnreadReleaseNotice==="function"&&
                window.FourSymbolsReleaseUpdate.hasUnreadReleaseNotice()
            );
        const announcementUnread=
            localStorage.getItem(ANNOUNCEMENT_READ_KEY)!=="1"||
            releaseAnnouncementUnread;
        setNotificationDot(document.getElementById("homeIconQuest")?.parentElement,hasQuestNotice,"任務有新進度");
        setNotificationDot(document.getElementById("homeIconAchievement")?.parentElement,hasAchievement,"成就可領取");
        setNotificationDot(document.getElementById("homeIconCharacter")?.parentElement,hasExpLevelUp,"經驗池可讓角色升級");
        setNotificationDot(document.getElementById("homeHudExpValue")?.parentElement,hasExpLevelUp,"經驗池可讓角色升級");
        setNotificationDot(document.getElementById("homeIconOfflineExp")?.parentElement,pendingOfflineExp>0,"有離線經驗可領取");
        setNotificationDot(document.getElementById("homeIconAnnouncement")?.parentElement,announcementUnread,"公告未讀");
        const dungeonPending=["exp","material","equipment"].some(type=>
            !window.v132IsDungeonUsedToday||!window.v132IsDungeonUsedToday(type)
        );
        setNotificationDot(document.getElementById("dungeonNav"),dungeonPending,"副本尚未完成");
        document.querySelectorAll("#mapPageNav button[aria-label='任務'],#v141DungeonNav button[aria-label='任務']")
            .forEach(button=>setNotificationDot(button,hasQuestNotice,"任務有新進度"));
    }
    window.v141UpdateNotificationDots=updateNotificationDots;

    /* =====================================================
       Shared open/show/update wrappers
    ===================================================== */
    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            const result=originalOpenHomeFeature.apply(this,arguments);
            if(type==="announcement"){
                try{ localStorage.setItem(ANNOUNCEMENT_READ_KEY,"1"); }catch(_){ }
            }
            if(type==="autoBattleSettings"){ setTimeout(compactElementBoxPanel,0); }
            updateNotificationDots();
            return result;
        };
    }

    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            const result=originalShowPage.apply(this,arguments);
            const app=document.getElementById("app");
            if(app){ app.classList.toggle("v141-dungeon-active",page==="dungeon"); }
            if(page==="dungeon"){
                installDungeonNavigation();
                const content=document.getElementById("dungeonTabContent");
                if(content&&!content.innerHTML.trim()){ switchDungeonTab("daily"); }
            }
            if(page==="map"){
                installPatrolClickMovement();
                installTaskTracker();
                renderTaskTracker();
                requestAnimationFrame(clampTaskTracker);
            }
            updateNotificationDots();
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const originalUpdateUI=updateUI;
        updateUI=function(){
            const result=originalUpdateUI.apply(this,arguments);
            renderTaskTracker();
            updateNotificationDots();
            return result;
        };
    }

    /* =====================================================
       Global tap feedback
    ===================================================== */
    let globalTapRippleNode=null;
    let globalTapRippleRemovalTimer=0;
    document.addEventListener("pointerdown",function(event){
        if(event.pointerType==="mouse"&&event.button!==0){ return; }
        if(event.target&&typeof event.target.closest==="function"&&event.target.closest("#battlePage")){ return; }
        let ripple=globalTapRippleNode;
        if(!ripple||!ripple.isConnected){
            ripple=document.createElement("span");
            ripple.className="v141-tap-ripple";
            globalTapRippleNode=ripple;
            document.body.appendChild(ripple);
        }
        ripple.style.left=event.clientX+"px";
        ripple.style.top=event.clientY+"px";
        ripple.classList.remove("is-active");
        void ripple.offsetWidth;
        ripple.classList.add("is-active");
        if(globalTapRippleRemovalTimer){ clearTimeout(globalTapRippleRemovalTimer); }
        globalTapRippleRemovalTimer=setTimeout(()=>{
            globalTapRippleRemovalTimer=0;
            if(ripple===globalTapRippleNode){
                ripple.remove();
                globalTapRippleNode=null;
            }
        },520);
    },{passive:true});

    function boot(){
        installDungeonNavigation();
        installPatrolClickMovement();
        installTaskTracker();
        ensureInventoryPager();
        updateNotificationDots();
        const preview=document.getElementById("allElementSkillPreviewModal");
        if(preview&&preview.parentElement!==document.body){ document.body.appendChild(preview); preview.classList.add("v141-body-preview"); }
    }
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{ boot(); }
})();


/* bundled source: js/36-v141-content-systems.js */
/*
   V141 — synthesis and five-floor Abyss dungeon.
   This layer reuses V132 inventory/dungeon bridges and keeps the legacy combat
   engine intact.
*/
(function installV141ContentSystems(){
    "use strict";

    const ABYSS_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("legacy-abyss-state");
    const TIER_ALIASES={low:"white",mid:"blue",high:"purple",perfect:"orange"};
    const TIER_ORDER=["white","blue","purple","orange","pink","four-symbol"];
    const TALISMAN_TIER_ORDER=["white","blue","purple","orange"];
    const TIER_META={
        white:{label:"白階",available:true,craftGold:500,reforgeGold:1000,main:[1,5],reforgeMain:[1,3]},
        blue:{label:"藍階",available:true,craftGold:1500,reforgeGold:3000,main:[3,8],reforgeMain:[2,5]},
        purple:{label:"紫階",available:true,craftGold:4000,reforgeGold:8000,main:[5,11],sub:[1,3],reforgeMain:[4,7],reforgeSub:[1,2]},
        orange:{label:"橙階",available:true,craftGold:10000,reforgeGold:20000,main:[7,14],sub:[2,5],reforgeMain:[6,10],reforgeSub:[2,4]},
        pink:{label:"桃紅階",available:false,planned:true},
        "four-symbol":{label:"四象階",available:false,planned:true}
    };
    function normalizeTierKey(value){
        const key=String(value||"").toLowerCase();
        return TIER_ALIASES[key]||key;
    }
    const SLOT_META={
        head:{label:"頭部",type:"head",glyph:"冠"},
        shoulder:{label:"護腕",type:"shoulder",glyph:"腕"},
        shoes:{label:"鞋子",type:"shoes",glyph:"履"},
        hand:{label:"武器",type:"weapon",glyph:"刃"},
        armor:{label:"衣服",type:"armor",glyph:"甲"}
    };
    const SERIES=[
        {setId:"setFire",label:"赤炎",element:"fire",color:"#e24b32"},
        {setId:"setWater",label:"寒泉",element:"water",color:"#4bb9e8"},
        {setId:"setEarth",label:"岩岳",element:"earth",color:"#c59a54"},
        {setId:"setWind",label:"青嵐",element:"wind",color:"#55cda3"}
    ];
    const STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",energy:"能量",agility:"敏捷",spirit:"精神"};
    const MAIN_STATS=["attack","intelligence"];
    const SUB_STATS=["vitality","energy","agility","spirit"];
    const TALISMAN_GOLD={white:300,blue:1000,purple:3000};
    const synthesisState={
        tab:"reforge",blueprintId:null,seriesId:"setFire",reforgeUid:null,
        reforgeMaterialTier:"white",lockedReforgeKeys:[],
        talismanId:null,talismanQty:1,fragmentQty:{setFire:1,setWater:1,setEarth:1,setWind:1},
        pendingReforge:null
    };

    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function definitions(){
        return window.v132GetContentDefinitions?window.v132GetContentDefinitions():{
            talismans:[],ores:[],blueprints:[],tickets:[],equipmentSets:[],equipmentSetItems:[]
        };
    }

    function svgIcon(glyph,color){
        return '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="v141g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2b2116"/><stop offset="1" stop-color="#080706"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="12" fill="url(#v141g)" stroke="'+color+'" stroke-width="3"/><circle cx="32" cy="32" r="19" fill="none" stroke="'+color+'" stroke-opacity=".45" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="'+color+'">'+glyph+'</text></svg>';
    }

    const fragmentDefinitions=SERIES.map(series=>({
        id:"fragment"+series.setId.charAt(0).toUpperCase()+series.setId.slice(1),
        name:series.label+"碎片",type:"material",setId:series.setId,tierKey:"fragment",
        icon:svgIcon("碎",series.color),price:0,stats:{}
    }));
    function getFragmentDefinition(setId){ return fragmentDefinitions.find(item=>item.setId===setId)||null; }

    function countItem(itemId){
        return inventoryItems.reduce((sum,item)=>sum+(item&&item.id===itemId?Math.max(0,Number(item.count)||0):0),0);
    }
    function countMatching(predicate){
        return inventoryItems.reduce((sum,item)=>sum+(item&&predicate(item)?Math.max(1,Number(item.count)||1):0),0);
    }
    function consumeMatching(predicate,amount){
        let remaining=Math.max(0,Math.floor(Number(amount)||0));
        if(countMatching(predicate)<remaining){ return false; }
        for(let index=inventoryItems.length-1;index>=0&&remaining>0;index--){
            const item=inventoryItems[index];
            if(!item||!predicate(item)){ continue; }
            const count=Math.max(1,Math.floor(Number(item.count)||1));
            const take=Math.min(count,remaining);
            if(count===take){ inventoryItems.splice(index,1); }
            else{ item.count=count-take; }
            remaining-=take;
        }
        return remaining===0;
    }

    function runInventoryTransaction(operation){
        return window.v132RunInventoryTransaction?window.v132RunInventoryTransaction(operation):!!operation();
    }
    function addItem(definition,amount){
        return !!(window.v132AddItemToInventory&&window.v132AddItemToInventory(definition,amount));
    }

    function makeUid(prefix){
        return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,9);
    }
    function ensureEquipmentUids(){
        let changed=false;
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)&&!item.v141Uid){ item.v141Uid=makeUid("bag"); changed=true; }
        });
        Object.values(characterEquipment||{}).forEach(equipment=>{
            Object.values(equipment||{}).forEach(item=>{
                if(item&&!item.v141Uid){ item.v141Uid=makeUid("equip"); changed=true; }
            });
        });
        if(changed&&typeof saveGame==="function"){ saveGame(); }
    }

    function reforgeSlotCount(item){
        if(!item){ return 0; }
        const explicit=Math.max(0,Math.floor(Number(item.reforgeSlots)||0));
        const existing=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;
        const slots=Math.max(explicit,existing);
        if(slots>explicit){ item.reforgeSlots=slots; }
        if(item.reforgeUsed){ item.reforgeUsed=0; }
        return slots;
    }
    function canActuallyReforge(item){
        return !!(item&&item.v17351Locked!==true&&reforgeSlotCount(item)>0);
    }
    function reforgeMaterialInfo(tierKey){
        const normalized=normalizeTierKey(tierKey);
        const tier=TIER_META[normalized]?normalized:"white";
        const meta=TIER_META[tier];
        const ore=definitions().ores.find(item=>normalizeTierKey(item.tierKey)===tier)||null;
        const blueprintCount=countMatching(item=>item&&item.blueprintSlot&&normalizeTierKey(item.tierKey)===tier);
        const oreCount=ore?countItem(ore.id):0;
        return {tier,meta,ore,blueprintCount,oreCount};
    }
    function reforgeMaterialCost(lockCount){
        const locks=Math.max(0,Math.min(2,Math.floor(Number(lockCount)||0)));
        return locks===0?50:(locks===1?100:150);
    }
    function normalizeReforgeLocks(item){
        const current=item&&item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats):[];
        const maxLocks=Math.min(2,Math.max(0,reforgeSlotCount(item)-1));
        synthesisState.lockedReforgeKeys=(synthesisState.lockedReforgeKeys||[])
            .filter(key=>current.includes(key)).slice(0,maxLocks);
        return synthesisState.lockedReforgeKeys;
    }
    function allRefinableEquipment(){
        ensureEquipmentUids();
        const results=[];
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)&&canActuallyReforge(item)){ results.push({item,source:"背包"}); }
        });
        Object.keys(characterEquipment||{}).forEach(characterKey=>{
            Object.values(characterEquipment[characterKey]||{}).forEach(item=>{
                if(item&&canActuallyReforge(item)){ results.push({item,source:"已裝備"}); }
            });
        });
        return results;
    }
    function findEquipmentByUid(uid){
        const entry=allRefinableEquipment().find(candidate=>candidate.item.v141Uid===uid);
        return entry?entry.item:null;
    }

    function inferTier(item){
        const declared=normalizeTierKey(item&&item.tierKey);
        if(TIER_META[declared]){ return declared; }
        if(item&&item.setId){ return "orange"; }
        const total=Object.values(item&&item.stats||{}).reduce((sum,value)=>sum+Math.abs(Number(value)||0),0);
        if(total>=18){ return "orange"; }
        if(total>=10){ return "purple"; }
        if(total>=5){ return "blue"; }
        return "white";
    }

    function rollUniform(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
    function rollSinglePeak(range){
        return Math.random()<.10?range[1]:rollUniform(range[0],Math.max(range[0],range[1]-1));
    }
    function rollAffixes(tierKey,isReforge){
        const tier=normalizeTierKey(tierKey);
        const meta=TIER_META[tier];
        if(!meta||meta.available===false||!Array.isArray(meta.main)){ throw new Error("此階級尚未開放數值設定："+tier); }
        const mainRange=isReforge?meta.reforgeMain:meta.main;
        const subRange=isReforge?meta.reforgeSub:meta.sub;
        const stats={};
        const main=MAIN_STATS[Math.floor(Math.random()*MAIN_STATS.length)];
        if(!subRange){ stats[main]=rollSinglePeak(mainRange); return stats; }
        const sub=SUB_STATS[Math.floor(Math.random()*SUB_STATS.length)];
        if(Math.random()<.05){
            stats[main]=mainRange[1];
            stats[sub]=subRange[1];
            return stats;
        }
        let mainValue=rollUniform(mainRange[0],mainRange[1]);
        let subValue=rollUniform(subRange[0],subRange[1]);
        if(mainValue===mainRange[1]&&subValue===subRange[1]){
            if(Math.random()<.5){ mainValue=rollUniform(mainRange[0],Math.max(mainRange[0],mainRange[1]-1)); }
            else{ subValue=rollUniform(subRange[0],Math.max(subRange[0],subRange[1]-1)); }
        }
        stats[main]=mainValue;
        stats[sub]=subValue;
        return stats;
    }
    window.v141RollCraftAffixes=rollAffixes;

    function reforgeRangeForSlot(tierKey,slotIndex){
        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;
        if(meta.available===false||!Array.isArray(meta.reforgeMain)){ return null; }
        if(slotIndex<=0){ return meta.reforgeMain; }
        return meta.reforgeSub||meta.reforgeMain;
    }
    function reforgeRangeText(tierKey,slotCount){
        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;
        if(meta.available===false||!Array.isArray(meta.reforgeMain)){ return "尚未開放・數值待定"; }
        const main=meta.reforgeMain;
        const sub=meta.reforgeSub||meta.reforgeMain;
        return slotCount<=1
            ?"詞條 "+main[0]+"～"+main[1]
            :"主槽 "+main[0]+"～"+main[1]+"・其餘槽 "+sub[0]+"～"+sub[1];
    }
    function rollReforgeAffixes(item,tierKey,lockedKeys){
        const slots=reforgeSlotCount(item);
        const current=item&&item.reforgeStats&&typeof item.reforgeStats==="object"?item.reforgeStats:{};
        const result={};
        const used=new Set();
        const locks=(lockedKeys||[]).filter(key=>Object.prototype.hasOwnProperty.call(current,key)).slice(0,Math.min(2,Math.max(0,slots-1)));
        locks.forEach(key=>{ result[key]=current[key]; used.add(key); });
        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;
        if(meta.available===false){ throw new Error("此階級冶煉尚未開放"); }
        const unlockedCount=Math.max(0,slots-locks.length);
        const forceDualPeak=locks.length===0&&slots>=2&&!!meta.reforgeSub&&Math.random()<.05;
        let generated=0;
        while(Object.keys(result).length<slots){
            const needMain=!Array.from(used).some(key=>MAIN_STATS.includes(key));
            const slotIndex=needMain?0:Math.max(1,Object.keys(result).length);
            let pool=needMain?MAIN_STATS:SUB_STATS;
            let available=pool.filter(key=>!used.has(key));
            if(!available.length){ available=MAIN_STATS.concat(SUB_STATS).filter(key=>!used.has(key)); }
            if(!available.length){ break; }
            const key=available[Math.floor(Math.random()*available.length)%available.length];
            const range=reforgeRangeForSlot(tierKey,slotIndex);
            let value;
            if(forceDualPeak&&generated<2){ value=range[1]; }
            else if(!meta.reforgeSub||slots===1){ value=rollSinglePeak(range); }
            else{ value=rollUniform(range[0],range[1]); }
            result[key]=value;
            used.add(key);
            generated++;
        }
        if(!forceDualPeak&&locks.length===0&&slots>=2&&meta.reforgeSub){
            const mainKey=Object.keys(result).find(key=>MAIN_STATS.includes(key));
            const subKey=Object.keys(result).find(key=>SUB_STATS.includes(key));
            if(mainKey&&subKey&&result[mainKey]===meta.reforgeMain[1]&&result[subKey]===meta.reforgeSub[1]){
                if(Math.random()<.5){ result[mainKey]=rollUniform(meta.reforgeMain[0],Math.max(meta.reforgeMain[0],meta.reforgeMain[1]-1)); }
                else{ result[subKey]=rollUniform(meta.reforgeSub[0],Math.max(meta.reforgeSub[0],meta.reforgeSub[1]-1)); }
            }
        }
        return result;
    }
    window.v17358RollReforgeAffixes=rollReforgeAffixes;

    function statsHtml(stats){
        const entries=Object.entries(stats||{});
        if(!entries.length){ return '<span class="muted">尚無冶煉詞條</span>'; }
        return entries.map(([key,value])=>'<span>'+escapeHtml(STAT_LABEL[key]||key)+' <b>+'+value+'</b></span>').join("");
    }
    function rangeText(tierKey,isReforge){
        const meta=TIER_META[normalizeTierKey(tierKey)];
        if(!meta||meta.available===false){ return "尚未開放・數值待定"; }
        const main=isReforge?meta.reforgeMain:meta.main;
        const sub=isReforge?meta.reforgeSub:meta.sub;
        return '主詞條 '+main[0]+'～'+main[1]+(sub?'・副詞條 '+sub[0]+'～'+sub[1]:'');
    }

    function showSynthesisResult(title,body){
        const modal=document.getElementById("homeFeatureModal");
        if(modal){
            modal.classList.add("v141-crafting-flash");
            setTimeout(()=>modal.classList.remove("v141-crafting-flash"),650);
        }
        setTimeout(()=>{
            if(window.v132ShowRewardModal){
                window.v132ShowRewardModal(
                    '<div class="v132-reward-modal-inner"><h3>'+escapeHtml(title)+'</h3>'+body+
                    '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">確定</button></div></div>'
                );
            }
        },480);
    }

    function renderSynthesisTabs(){
        const tabs=[
            ["reforge","裝備冶煉"],["talisman","符咒合成"],["fragment","碎片合成"]
        ];
        return '<div class="v141-synthesis-tabs">'+tabs.map(([id,label])=>
            '<button type="button" class="'+(synthesisState.tab===id?'active':'')+'" onclick="v141SwitchSynthesisTab(\''+id+'\')">'+label+'</button>'
        ).join("")+'</div>';
    }

    function heldBlueprints(){
        const byId=new Map();
        inventoryItems.forEach(item=>{
            if(!item||!item.blueprintSlot){ return; }
            const tier=normalizeTierKey(item.tierKey);
            if(!TIER_META[tier]||TIER_META[tier].available===false){ return; }
            item.tierKey=tier;
            if(!byId.has(item.id)){ byId.set(item.id,item); }
        });
        return [...byId.values()];
    }

    function renderCraftTab(){
        const blueprints=heldBlueprints();
        if(!blueprints.length){
            return '<div class="v141-synthesis-empty">背包內沒有裝備設計圖紙。<small>材料寶箱可取得圖紙與礦石。</small></div>';
        }
        if(!blueprints.some(item=>item.id===synthesisState.blueprintId)){ synthesisState.blueprintId=blueprints[0].id; }
        const blueprint=blueprints.find(item=>item.id===synthesisState.blueprintId);
        const tier=normalizeTierKey(blueprint.tierKey);
        const meta=TIER_META[tier];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const blueprintSeries=SERIES.find(item=>item.setId===blueprint.setId)||null;
        const series=blueprintSeries||SERIES.find(item=>item.setId===synthesisState.seriesId)||SERIES[0];
        const ore=definitions().ores.find(item=>normalizeTierKey(item.tierKey)===tier);
        const blueprintCount=countItem(blueprint.id);
        const oreCount=ore?countItem(ore.id):0;
        const canCraft=blueprintCount>=50&&oreCount>=50&&gold>=meta.craftGold&&inventoryItems.length<120;
        return '<div class="v141-synthesis-card">'+
            '<label>1　選擇設計圖紙<select onchange="v141SelectCraftBlueprint(this.value)">'+blueprints.map(item=>
                '<option value="'+escapeHtml(item.id)+'" '+(item.id===blueprint.id?'selected':'')+'>'+escapeHtml(item.name)+'（'+countItem(item.id)+'）</option>'
            ).join("")+'</select></label>'+
            (blueprintSeries
                ?'<div class="v141-blueprint-series"><span>2　裝備系列</span><b>'+series.label+'（由圖紙決定）</b></div>'
                :'<label>2　舊圖紙系列<select onchange="v141SelectCraftSeries(this.value)">'+SERIES.map(item=>
                    '<option value="'+item.setId+'" '+(item.setId===series.setId?'selected':'')+'>'+item.label+'</option>'
                ).join("")+'</select><small>僅舊存檔既有圖紙沒有系列欄位；新取得圖紙會自動指定系列。</small></label>')+
            '<section class="v141-craft-preview"><div class="v141-craft-icon">'+svgIcon(slot.glyph,series.color)+'</div><div><b>'+series.label+meta.label+slot.label+'</b><span>'+rangeText(tier,false)+'</span></div></section>'+
            '<div class="v141-material-lines"><span>圖紙 <b class="'+(blueprintCount>=50?'ok':'lack')+'">'+blueprintCount+' / 50</b></span>'+
            '<span>'+escapeHtml(ore&&ore.name||meta.label+'礦石')+' <b class="'+(oreCount>=50?'ok':'lack')+'">'+oreCount+' / 50</b></span>'+
            '<span>金幣 <b class="'+(gold>=meta.craftGold?'ok':'lack')+'">'+meta.craftGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<button type="button" class="v141-synthesis-primary" '+(canCraft?'':'disabled')+' onclick="v141CraftEquipment()">開始合成</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">ⓘ 詞條機率</button></div>';
    }

    function renderReforgeTab(){
        const entries=allRefinableEquipment();
        if(!entries.length){ return '<div class="v141-synthesis-empty">沒有可冶煉的裝備。<small>只有具備至少 1 個冶煉槽、且未鎖定的裝備會出現在這裡。</small></div>'; }
        if(!entries.some(entry=>entry.item.v141Uid===synthesisState.reforgeUid)){
            synthesisState.reforgeUid=entries[0].item.v141Uid;
            synthesisState.lockedReforgeKeys=[];
        }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        const slotCount=reforgeSlotCount(item);
        const locks=normalizeReforgeLocks(item);
        const lockSet=new Set(locks);
        const maxLocks=Math.min(2,Math.max(0,slotCount-1));
        const requestedTier=normalizeTierKey(synthesisState.reforgeMaterialTier);
        const tier=TIER_META[requestedTier]&&TIER_META[requestedTier].available!==false?requestedTier:"white";
        synthesisState.reforgeMaterialTier=tier;
        const material=reforgeMaterialInfo(tier);
        const materialCost=reforgeMaterialCost(locks.length);
        const currentEntries=Object.entries(item.reforgeStats||{});
        const can=material.meta.available!==false&&!!material.ore&&material.blueprintCount>=materialCost&&material.oreCount>=materialCost&&gold>=material.meta.reforgeGold&&slotCount>locks.length;
        let compare="";
        if(synthesisState.pendingReforge&&synthesisState.pendingReforge.uid===item.v141Uid){
            const pending=synthesisState.pendingReforge;
            const pendingLabel=(TIER_META[pending.materialTier]||material.meta).label;
            compare='<div class="v141-reforge-compare"><section><small>目前冶煉效果</small>'+statsHtml(item.reforgeStats)+'</section><b>VS</b><section><small>本次新效果・'+pendingLabel+'材料</small>'+statsHtml(pending.stats)+'</section>'+
                '<div><button onclick="v141ResolveReforge(false)">保留原效果</button><button onclick="v141ResolveReforge(true)">套用新效果</button></div></div>';
        }
        const tierButtons=TIER_ORDER.map(key=>{
            const info=reforgeMaterialInfo(key);
            const unavailable=info.meta.available===false;
            return '<button type="button" class="v17358-reforge-tier '+(key===tier?'active ':'')+(unavailable?'planned':'')+'" '+
                (unavailable?'disabled aria-disabled="true"':'onclick="v141SelectReforgeMaterialTier(\''+key+'\')"')+'>'+
                '<b>'+info.meta.label+'材料</b><span>'+(unavailable?'尚未開放':'圖紙 '+info.blueprintCount+'・礦石 '+info.oreCount)+'</span><small>'+reforgeRangeText(key,slotCount)+'</small></button>';
        }).join("");
        const lockHtml=currentEntries.length
            ?currentEntries.map(([key,value])=>{
                const selected=lockSet.has(key);
                return '<button type="button" class="v17358-affix-lock '+(selected?'locked':'')+'" '+(synthesisState.pendingReforge?'disabled':'')+' onclick="v141ToggleReforgeLock(\''+escapeHtml(key)+'\')">'+
                    '<span>'+(selected?'🔒':'◇')+'</span><b>'+escapeHtml(STAT_LABEL[key]||key)+' +'+value+'</b><small>'+(selected?'已鎖定':'點擊鎖定')+'</small></button>';
            }).join("")
            :'<div class="v17358-no-affix-lock">首次冶煉尚無詞條可鎖定。</div>';
        return '<div class="v141-synthesis-card v17358-reforge-card">'+
            '<label>選擇裝備<select onchange="v141SelectReforgeItem(this.value)">'+entries.map(entry=>
                '<option value="'+entry.item.v141Uid+'" '+(entry.item.v141Uid===item.v141Uid?'selected':'')+'>'+escapeHtml(entry.item.name)+'［'+entry.source+'］</option>'
            ).join("")+'</select></label>'+
            '<section class="v141-reforge-current"><b>'+escapeHtml(item.name)+'</b><small>冶煉槽 '+slotCount+' 格・可不限次數重洗</small><div><em>原始詞條</em>'+statsHtml(item.stats)+'</div><div><em>目前冶煉</em>'+statsHtml(item.reforgeStats)+'</div></section>'+
            '<section class="v17358-reforge-material"><div class="v17358-section-title"><b>選擇冶煉材料階級</b><span>裝備品質不限制材料；材料階級只決定本次數值範圍。</span></div><div class="v17358-reforge-tiers">'+tierButtons+'</div></section>'+
            '<section class="v17358-reforge-lock-panel"><div class="v17358-section-title"><b>鎖定詞條</b><span>最多鎖 2 條，且至少保留 1 個槽位重新冶煉。</span></div><div class="v17358-reforge-lock-list">'+lockHtml+'</div><small>目前鎖定 '+locks.length+' / '+maxLocks+' 條</small></section>'+
            '<div class="v141-material-lines v17358-reforge-cost"><span>設計圖 <b class="'+(material.blueprintCount>=materialCost?'ok':'lack')+'">'+material.blueprintCount+' / '+materialCost+'</b></span>'+
            '<span>'+escapeHtml(material.ore&&material.ore.name||material.meta.label+'礦石')+' <b class="'+(material.oreCount>=materialCost?'ok':'lack')+'">'+material.oreCount+' / '+materialCost+'</b></span>'+
            '<span>金幣 <b class="'+(gold>=material.meta.reforgeGold?'ok':'lack')+'">'+material.meta.reforgeGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<div class="v17358-reforge-cost-note">未鎖定：50 圖紙＋50 礦石・鎖 1 條：100＋100・鎖 2 條：150＋150</div>'+
            '<button type="button" class="v141-synthesis-primary" '+(can&&!synthesisState.pendingReforge?'':'disabled')+' onclick="v141StartReforge()">開始冶煉</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">ⓘ 冶煉規則</button>'+compare+'</div>';
    }

    function availableTalismans(){
        return definitions().talismans.filter(item=>TALISMAN_TIER_ORDER.slice(0,3).includes(normalizeTierKey(item.tierKey))&&countItem(item.id)>0);
    }
    function nextTalisman(source){
        if(!source){ return null; }
        const sourceTier=normalizeTierKey(source.tierKey);
        const nextTier=TALISMAN_TIER_ORDER[TALISMAN_TIER_ORDER.indexOf(sourceTier)+1];
        return definitions().talismans.find(item=>item.talismanEffect===source.talismanEffect&&normalizeTierKey(item.tierKey)===nextTier)||null;
    }
    function renderTalismanTab(){
        const list=availableTalismans();
        if(!list.length){ return '<div class="v141-synthesis-empty">沒有可升階的白／藍／紫階符咒。</div>'; }
        if(!list.some(item=>item.id===synthesisState.talismanId)){ synthesisState.talismanId=list[0].id; synthesisState.talismanQty=1; }
        const source=list.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        const owned=countItem(source.id);
        const max=Math.min(Math.floor(owned/3),Math.floor(gold/TALISMAN_GOLD[normalizeTierKey(source.tierKey)]));
        synthesisState.talismanQty=Math.max(1,Math.min(Math.max(1,max),synthesisState.talismanQty));
        const qty=synthesisState.talismanQty;
        const can=max>=qty&&target;
        return '<div class="v141-synthesis-card v141-talisman-craft">'+
            '<label>選擇符咒<select onchange="v141SelectTalisman(this.value)">'+list.map(item=>
                '<option value="'+item.id+'" '+(item.id===source.id?'selected':'')+'>'+escapeHtml(item.name)+'（'+countItem(item.id)+'）</option>'
            ).join("")+'</select></label>'+
            '<div class="v141-upgrade-flow"><section class="v141-talisman-source" aria-label="合成材料">'+source.icon+'<b>'+escapeHtml(source.name)+' ×'+(qty*3)+'</b></section><i aria-hidden="true">→</i><section class="v141-talisman-target" aria-label="合成目標">'+target.icon+'<b>'+escapeHtml(target.name)+' ×'+qty+'</b></section></div>'+
            '<div class="v141-quantity"><button onclick="v141AdjustTalismanQty(-1)">－</button><strong>'+qty+'</strong><button onclick="v141AdjustTalismanQty(1)">＋</button><button onclick="v141AdjustTalismanQty(\'max\')">MAX</button></div>'+
            '<div class="v141-material-lines"><span>持有 '+owned+'</span><span>消耗 '+(qty*3)+'</span><span>金幣 '+(TALISMAN_GOLD[normalizeTierKey(source.tierKey)]*qty).toLocaleString('zh-TW')+'</span></div>'+
            '<button class="v141-synthesis-primary" '+(can?'':'disabled')+' onclick="v141CraftTalismans()">開始合成</button></div>';
    }

    function renderFragmentTab(){
        const data=definitions();
        return '<div class="v141-fragment-list">'+SERIES.map(series=>{
            const fragment=getFragmentDefinition(series.setId);
            const count=countItem(fragment.id);
            const max=Math.min(Math.floor(count/100),Math.floor(gold/500));
            const qty=Math.max(1,Math.min(Math.max(1,max),synthesisState.fragmentQty[series.setId]||1));
            synthesisState.fragmentQty[series.setId]=qty;
            return '<section class="v141-fragment-row"><div class="v141-fragment-icon">'+fragment.icon+'</div><div class="v141-fragment-main"><b>'+series.label+'碎片</b><span>'+count+' / 100</span><div class="v141-fragment-progress"><i style="width:'+Math.min(100,count)+'%"></i></div></div>'+
                '<div class="v141-fragment-controls"><div><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',-1)">－</button><strong>'+qty+'</strong><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',1)">＋</button><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',\'max\')">MAX</button></div>'+
                '<button '+(max>=qty?'':'disabled')+' onclick="v141CraftFragmentTicket(\''+series.setId+'\')">合成抽獎券<br><small>500金幣／張</small></button></div></section>';
        }).join('')+'</div>';
    }

    function renderSynthesis(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const renderers={reforge:renderReforgeTab,talisman:renderTalismanTab,fragment:renderFragmentTab};
        if(!renderers[synthesisState.tab]){ synthesisState.tab="reforge"; }
        const content=renderers[synthesisState.tab]();
        body.innerHTML='<div class="v141-synthesis"><div class="v141-synthesis-wallet"><span>合成</span><b>金幣 '+Math.floor(gold).toLocaleString('zh-TW')+'</b></div>'+renderSynthesisTabs()+'<div class="v141-synthesis-body">'+content+'</div></div>';
    }
    window.v141RenderSynthesis=renderSynthesis;
    window.v141SwitchSynthesisTab=function(tab){
        synthesisState.tab=["reforge","talisman","fragment"].includes(tab)?tab:"reforge";
        synthesisState.pendingReforge=null;
        renderSynthesis();
    };
    window.v141SelectCraftBlueprint=function(id){ synthesisState.blueprintId=id; renderSynthesis(); };
    window.v141SelectCraftSeries=function(id){ synthesisState.seriesId=id; renderSynthesis(); };
    window.v141SelectReforgeItem=function(uid){
        synthesisState.reforgeUid=uid;
        synthesisState.pendingReforge=null;
        synthesisState.lockedReforgeKeys=[];
        renderSynthesis();
    };
    window.v141SelectReforgeMaterialTier=function(tier){
        const normalized=normalizeTierKey(tier);
        if(!TIER_META[normalized]||TIER_META[normalized].available===false||synthesisState.pendingReforge){ return; }
        synthesisState.reforgeMaterialTier=normalized;
        renderSynthesis();
    };
    window.v141ToggleReforgeLock=function(key){
        if(synthesisState.pendingReforge){ return; }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||!Object.prototype.hasOwnProperty.call(item.reforgeStats||{},key)){ return; }
        const locks=normalizeReforgeLocks(item).slice();
        const at=locks.indexOf(key);
        if(at>=0){ locks.splice(at,1); }
        else{
            const maxLocks=Math.min(2,Math.max(0,reforgeSlotCount(item)-1));
            if(locks.length>=maxLocks){
                alert(maxLocks<=0?"這件裝備只有 1 個冶煉槽，不能把唯一詞條鎖住。":"至少要保留 1 個未鎖定槽位才能重新冶煉。");
                return;
            }
            locks.push(key);
        }
        synthesisState.lockedReforgeKeys=locks;
        renderSynthesis();
    };
    window.v141SelectTalisman=function(id){ synthesisState.talismanId=id; synthesisState.talismanQty=1; renderSynthesis(); };

    window.v141AdjustTalismanQty=function(change){
        const source=definitions().talismans.find(item=>item.id===synthesisState.talismanId);
        if(!source){ return; }
        const max=Math.min(Math.floor(countItem(source.id)/3),Math.floor(gold/TALISMAN_GOLD[normalizeTierKey(source.tierKey)]));
        synthesisState.talismanQty=change==="max"?Math.max(1,max):Math.max(1,Math.min(Math.max(1,max),synthesisState.talismanQty+Number(change)));
        renderSynthesis();
    };
    window.v141AdjustFragmentQty=function(setId,change){
        const count=countItem(getFragmentDefinition(setId).id);
        const max=Math.min(Math.floor(count/100),Math.floor(gold/500));
        const current=synthesisState.fragmentQty[setId]||1;
        synthesisState.fragmentQty[setId]=change==="max"?Math.max(1,max):Math.max(1,Math.min(Math.max(1,max),current+Number(change)));
        renderSynthesis();
    };

    window.v141ShowAffixInfo=function(){
        const lines=TIER_ORDER.map(tier=>{
            const meta=TIER_META[tier];
            const cost=meta.available===false?'尚未開放・數值待定':'金幣 '+meta.reforgeGold.toLocaleString('zh-TW');
            return '<div><b>'+meta.label+'材料</b>　'+reforgeRangeText(tier,2)+'　／　'+cost+'</div>';
        }).join('');
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>冶煉規則</h3><p>裝備品質不限制材料階級。選用哪一階材料，本次重洗就使用哪一階的數值範圍。</p>'+lines+'<p>桃紅階、四象階已預留正式階級，但目前不開放數值與取得來源。</p><p>每次會重洗所有未鎖定的冶煉槽；已鎖定詞條保持原數值。冶煉次數不限。</p><p>消耗：未鎖定 50 張設計圖＋50 礦石；鎖 1 條各 100；鎖 2 條各 150。最多鎖 2 條，且至少保留 1 個槽位重洗。</p><p>單槽最高值固定10%；具副詞條範圍的材料，雙詞條同時最高固定5%。</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">返回</button></div></div>');
    };

    window.v141CraftEquipment=function(){
        const blueprint=heldBlueprints().find(item=>item.id===synthesisState.blueprintId);
        if(!blueprint){ return; }
        const series=SERIES.find(item=>item.setId===(blueprint.setId||synthesisState.seriesId))||SERIES[0];
        const tier=normalizeTierKey(blueprint.tierKey);
        const meta=TIER_META[tier];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const ore=definitions().ores.find(item=>normalizeTierKey(item.tierKey)===tier);
        if(!ore||countItem(blueprint.id)<50||countItem(ore.id)<50||gold<meta.craftGold){ alert("素材或金幣不足。"); return; }
        const stats=rollAffixes(tier,false);
        const item={
            id:makeUid("crafted"),v141Uid:makeUid("gear"),name:series.label+meta.label+slot.label,
            icon:svgIcon(slot.glyph,series.color),type:slot.type,setId:series.setId,tierKey:tier,
            levelRequirement:1,price:0,count:1,stats:stats,reforgeStats:null,v141Crafted:true
        };
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return; }
        const success=runInventoryTransaction(()=>{
            return window.v132ConsumeStackItem(blueprint.id,50)&&window.v132ConsumeStackItem(ore.id,50)&&addItem(item,1);
        });
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=meta.craftGold;
        rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("合成成功",'<div class="v141-result-item">'+item.icon+'<b>'+escapeHtml(item.name)+'</b>'+statsHtml(stats)+'</div>');
    };

    window.v141StartReforge=function(){
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||synthesisState.pendingReforge){ return; }
        const slotCount=reforgeSlotCount(item);
        if(slotCount<=0){ alert("這件裝備沒有冶煉槽。"); return; }
        const locks=normalizeReforgeLocks(item).slice();
        if(locks.length>=slotCount){ alert("至少要保留 1 個未鎖定槽位才能重新冶煉。"); return; }
        const tier=normalizeTierKey(synthesisState.reforgeMaterialTier);
        const info=reforgeMaterialInfo(tier);
        if(!info.meta||info.meta.available===false){ alert("此材料階級尚未開放。"); return; }
        const cost=reforgeMaterialCost(locks.length);
        if(!info.ore||info.blueprintCount<cost||info.oreCount<cost||gold<info.meta.reforgeGold){
            alert(info.meta.label+"冶煉材料或金幣不足。");
            return;
        }
        const success=runInventoryTransaction(()=>
            consumeMatching(candidate=>candidate&&candidate.blueprintSlot&&normalizeTierKey(candidate.tierKey)===tier,cost)&&
            window.v132ConsumeStackItem(info.ore.id,cost)
        );
        if(!success){ alert("冶煉素材扣除失敗，已自動還原。"); return; }
        gold-=info.meta.reforgeGold;
        synthesisState.pendingReforge={
            uid:item.v141Uid,
            stats:rollReforgeAffixes(item,tier,locks),
            materialTier:tier,
            lockedKeys:locks.slice(),
            materialCost:cost
        };
        rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
    };

    window.v141ResolveReforge=function(applyNew){
        const pending=synthesisState.pendingReforge;
        if(!pending){ return; }
        const item=findEquipmentByUid(pending.uid);
        if(applyNew&&item){
            // Replace the unlocked result as one full roll; locked keys were already
            // copied into pending.stats by rollReforgeAffixes(). No additive stacking.
            item.reforgeStats=Object.assign({},pending.stats);
            item.reforgeUsed=0;
        }
        synthesisState.pendingReforge=null;
        if(item){ normalizeReforgeLocks(item); }
        saveGame(); updateUI(); renderSynthesis();
        showSynthesisResult(applyNew?"已套用新冶煉效果":"已保留原冶煉效果",applyNew&&item?'<div class="v141-result-item"><b>'+escapeHtml(item.name)+'</b>'+statsHtml(item.reforgeStats)+'</div>':'<p>本次材料與金幣已消耗，原有效果維持不變。</p>');
    };

    window.v141CraftTalismans=function(){
        const source=definitions().talismans.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        if(!source||!target){ return; }
        const qty=Math.max(1,synthesisState.talismanQty);
        const cost=TALISMAN_GOLD[normalizeTierKey(source.tierKey)]*qty;
        if(countItem(source.id)<qty*3||gold<cost){ alert("符咒或金幣不足。"); return; }
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(target,qty)){ alert("背包空間不足。"); return; }
        const success=runInventoryTransaction(()=>window.v132ConsumeStackItem(source.id,qty*3)&&addItem(target,qty));
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=cost; rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("符咒合成成功",'<div class="v141-result-item">'+target.icon+'<b>'+escapeHtml(target.name)+' ×'+qty+'</b></div>');
    };

    window.v141CraftFragmentTicket=function(setId){
        const fragment=getFragmentDefinition(setId);
        const ticket=definitions().tickets.find(item=>item.setId===setId);
        const qty=Math.max(1,synthesisState.fragmentQty[setId]||1);
        if(!fragment||!ticket||countItem(fragment.id)<qty*100||gold<qty*500){ alert("碎片或金幣不足。"); return; }
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(ticket,qty)){ alert("背包空間不足。"); return; }
        const success=runInventoryTransaction(()=>window.v132ConsumeStackItem(fragment.id,qty*100)&&addItem(ticket,qty));
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=qty*500; rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("碎片合成成功",'<div class="v141-result-item">'+ticket.icon+'<b>'+escapeHtml(ticket.name)+' ×'+qty+'</b></div>');
    };

    window.v141DecomposeSeriesItem=async function(slotIndex){
        const item=inventorySlots[slotIndex];
        const fragment=item&&getFragmentDefinition(item.setId);
        if(!item||!fragment||!isEquipmentInventoryType(item.type)){ return; }
        if(
            typeof window.rpgConfirm!=="function" ||
            !await window.rpgConfirm(
                "確定分解「"+item.name+"」？\n將固定獲得"+fragment.name+"×10，裝備無法復原。",
                {
                    title:"分解裝備",
                    confirmText:"確定分解",
                    cancelText:"返回",
                    danger:true
                }
            )
        ){
            return;
        }
        if(inventorySlots[slotIndex]!==item){ return; }
        const realIndex=inventoryItems.indexOf(item);
        if(realIndex<0){ return; }
        const success=runInventoryTransaction(()=>{
            inventoryItems.splice(realIndex,1);
            return addItem(fragment,10);
        });
        if(!success){ alert("背包空間不足，分解已取消。"); return; }
        closeItemModal(); rebuildInventorySlots(); saveGame(); renderInventory();
        alert("分解完成，獲得"+fragment.name+"×10。");
    };

    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            if(type!=="synthesis"){ return originalOpenHomeFeature.apply(this,arguments); }
            closeHomeFeature();
            const modal=document.getElementById("homeFeatureModal");
            const title=document.getElementById("homeFeatureModalTitle");
            if(title){ title.textContent="合成"; }
            if(modal){ modal.classList.add("show","v141-synthesis-modal"); }
            ensureEquipmentUids();
            // Route the very first open through the current public renderer.
            // Calling the closure directly bypasses later presentation owners
            // and is why equipment/talisman art only appears after a click.
            if(typeof window.v141RenderSynthesis==="function"){ window.v141RenderSynthesis(); }
            else{ renderSynthesis(); }
        };
    }
    if(typeof closeHomeFeature==="function"){
        const originalCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.remove("v141-synthesis-modal"); }
            return originalCloseHomeFeature.apply(this,arguments);
        };
    }

    /* =====================================================
       Abyss dungeon
    ===================================================== */
    if(!skillDatabase.stormSpell){
        skillDatabase.stormSpell=Object.assign({},skillDatabase.windHowlLightning,{id:"stormSpell",name:"暴風術",tier:4,targetType:"all"});
    }
    function defaultAbyssState(){ return {active:false,floor:1,phase:"boss",x:50,y:84,message:"",clears:0,rewardVersion:1}; }
    function loadAbyssState(){
        try{
            const raw=JSON.parse(localStorage.getItem(ABYSS_STORAGE_KEY)||"{}");
            const state=Object.assign(defaultAbyssState(),raw,{floor:Math.max(1,Math.min(5,Number(raw.floor)||1))});
            /* Before floor chests existed, phase=portal meant that no reward had
               been claimed. Migrate that one legacy phase back to its chest. */
            if(raw.phase==="portal"&&Number(raw.rewardVersion||0)<1){
                state.phase="chest";
                state.message="守關寶箱已補上。請先領取獎勵，再使用傳送點。";
            }
            return state;
        }catch(_){ return defaultAbyssState(); }
    }
    let abyssState=loadAbyssState();
    /* Whether this page visit has entered the persisted run. Never persist it: a
       reload or a later visit must return to the progress gate first. */
    let abyssMapEntered=false;
    let abyssBattleStarting=false;
    let activeAbyssDialogueAdvance=null;
    function persistAbyss(){ try{ localStorage.setItem(ABYSS_STORAGE_KEY,JSON.stringify(abyssState)); }catch(_){ } }

    const abyssFloors={
        1:{boss:"東帝",element:"earth",skills:["flyingSandStrike","dustStorm","stoneSlash"],eliteSkill:"petrifyFist",taunts:["凡人也敢踏入帝境？","黃沙會埋葬你的名字。","先過天兵這一關再說！"]},
        2:{boss:"南帝",element:"fire",skills:["explosiveFlurry","dragonSlash","fireRocket"],eliteSkill:"fireCritical",taunts:["烈火會把你的勇氣燒光。","再向前一步，便是灰燼。","你撐不過南天之焰！"]},
        3:{boss:"天帝",element:"wind",skills:["windHowlLightning","stormFlurry","windCrossSlash"],eliteSkill:"stormFist",taunts:["風起之時，無人能立。","你的招式太慢了。","天威不是凡人能挑戰的！"]},
        4:{boss:"北帝",element:"water",skills:["floodBeast","frostPunch","waterKnife"],eliteSkill:"waterBall",taunts:["寒泉已封住你的退路。","讓冰霜替你長眠。","北境之前，止步吧！"]}
    };
    const elementLabel={fire:"火",water:"水",earth:"土",wind:"風",light:"光"};

    function makeAbyssMonster(name,level,element,rank,extraHp,skills,forceLevel){
        const monster=window.v132BuildDungeonMonster(name,level,element,rank);
        monster.maxHP+=extraHp;
        monster.hp=monster.maxHP;
        monster.v141Abyss=true;
        monster.v141ExtraHP=extraHp;
        monster.v141ForceSkillLevel=forceLevel;
        monster.v141SkillLevel=forceLevel;
        monster.v144SkillLevel=forceLevel;
        monster.skillIds=(skills||[]).slice();
        monster.skillChance=.78;
        monster.activeBuffs=[];
        return monster;
    }

    function buildAbyssRoster(floor){
        const level=window.v132GetDungeonMonsterLevel?window.v132GetDungeonMonsterLevel():Math.max(1,window.v141GetHighestCharacterLevel());
        if(floor<5){
            const data=abyssFloors[floor];
            const skillLevel=typeof window.v141GetMonsterFixedSkillLevel==="function"
                ?window.v141GetMonsterFixedSkillLevel(level)
                :(level<=20?1:level<=40?2:level<=60?3:level<=80?4:5);
            const boss=makeAbyssMonster(data.boss,level,data.element,"boss",5000,data.skills,skillLevel);
            const roster=[boss];
            for(let i=0;i<4;i++){
                roster.push(makeAbyssMonster("天兵天將",level,data.element,"elite",2500,[data.eliteSkill],skillLevel));
            }
            return roster;
        }

        const roster=[];
        const bossSpecs=[
            ["東帝天尊","earth",["dustStorm","stoneBreakSky"],["barrier"]],
            ["天帝天尊","wind",["windHowlLightning","stormRain","stormSpell"],[]],
            ["極帝天尊","light",[],["yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"]],
            ["北帝天尊","water",["iceArrowRain","freeze"],["healSpell"]],
            ["南帝天尊","fire",["phoenixCry","dragonSlash"],["rage"]]
        ];
        bossSpecs.forEach((spec,position)=>{
            const monster=makeAbyssMonster(spec[0],level,spec[1],"boss",10000,spec[2],5);
            monster.v141SupportSkillIds=spec[3];
            if(spec[0]==="極帝天尊"){ monster.v141AbyssAi="support"; monster.skillChance=1; }
            monster.v141FormationRow=0;
            monster.v141FormationPosition=position;
            roster.push(monster);
        });
        const elites=[
            ["water",null,"healSpell"],["earth","stoneBreakSky",null],["fire","phoenixCry",null],
            ["wind",null,"dodgeSkill"],["water",null,"healSpell"]
        ];
        elites.forEach((spec,position)=>{
            const monster=makeAbyssMonster("天兵天將",level,spec[0],"elite",3500,spec[1]?[spec[1]]:[],5);
            monster.v141SupportSkillIds=spec[2]?[spec[2]]:[];
            monster.v141ForceSkillLevel=5;
            monster.v141FormationRow=1;
            monster.v141FormationPosition=position;
            roster.push(monster);
        });
        return roster;
    }
    window.v141BuildAbyssRoster=buildAbyssRoster;

    function monsterBaseHp(monster){
        const shield=monster&&monster.v141Shield;
        return shield?Math.max(0,monster.hp-(shield.remaining||0)):monster.hp;
    }

    function monsterBaseMaxHp(monster){
        const shield=monster&&monster.v141Shield;
        return Math.max(1,Number(shield&&shield.baseMaxHP)||Number(monster&&monster.maxHP)||1);
    }

    function getMonsterAllyTriTargets(casterIndex,entries){
        const living=(entries||currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})))
            .filter(entry=>entry&&entry.monster&&entry.monster.alive!==false&&Number(entry.monster.hp)>0);
        const livingByIndex=new Map(living.map(entry=>[entry.index,entry]));
        const owner=window.FourSymbolsBattlefieldSlots||null;
        const snapshot=owner&&typeof owner.getActiveEnemySnapshot==="function"?owner.getActiveEnemySnapshot():null;
        let best=[];
        let bestScore=-1;
        living.forEach(centerEntry=>{
            const center=centerEntry.index;
            const indexes=owner&&snapshot&&typeof owner.resolveEnemyTargets==="function"
                ?owner.resolveEnemyTargets(snapshot,center,"tri",index=>livingByIndex.has(index))
                :[center];
            const trio=indexes.map(index=>livingByIndex.get(index)).filter(Boolean);
            const score=trio.reduce((sum,entry)=>{
                const ally=entry.monster;
                const hpNeed=(monsterBaseMaxHp(ally)-monsterBaseHp(ally))/monsterBaseMaxHp(ally);
                const maxSP=Math.max(1,Number(ally.maxSP)||1);
                const spNeed=(maxSP-Math.max(0,Number(ally.sp)||0))/maxSP;
                return sum+Math.max(0,hpNeed)+Math.max(0,spNeed);
            },0)+(trio.some(entry=>entry.index===casterIndex)?0.0001:0);
            if(score>bestScore){ best=trio; bestScore=score; }
        });
        return best.slice(0,3);
    }
    window.v141GetMonsterAllyTriTargets=getMonsterAllyTriTargets;

    function applyTimedMonsterBuff(monstersToBuff,type,turns,amount){
        monstersToBuff.forEach(monster=>{
            if(!monster||!monster.alive){ return; }
            const monsterIndex=typeof monsters!=="undefined"?monsters.indexOf(monster):-1;
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    monster,type,"monster",monsterIndex>=0?monsterIndex:undefined,
                    type==="rage"?"怒火":type==="resistance"?"氣定神閒":"閃躲術"
                )
            ){ return; }
            if(monster.v141TeamBuffs?.some(buff=>buff.type===type&&buff.turnsLeft>0)){ return; }
            monster.v141TeamBuffs=monster.v141TeamBuffs||[];
            const buff={type,turnsLeft:turns,amount};
            if(type==="rage"){
                buff.originalAttack=monster.attack; buff.originalMagicAttack=monster.magicAttack;
                buff.bonusPercent=25;
                buff.critChanceBonusPercent=25;
                buff.critDamageBonusPercent=50;
            }else if(type==="resistance"){
                buff.accuracyBonusPercent=50;
                monster.resistance=(Number(monster.resistance)||0)+amount;
            }else if(type==="dodge"){
                buff.originalEvasion=monster.evasion;
                monster.evasion=typeof window.v173CombineEvasionRates==="function"
                    ?window.v173CombineEvasionRates([buff.originalEvasion,amount])
                    :Math.min(85,Number(monster.evasion)||0);
            }
            const displayBuff={
                type:type==="rage"?"rage":"v141TeamBuff",
                v141BuffType:type,
                turnsLeft:turns
            };
            if(type==="resistance"){
                displayBuff.accuracyBonusPercent=buff.accuracyBonusPercent;
            }
            if(type==="rage"){
                displayBuff.bonusPercent=buff.bonusPercent;
                displayBuff.critChanceBonusPercent=buff.critChanceBonusPercent;
                displayBuff.critDamageBonusPercent=buff.critDamageBonusPercent;
            }
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,type);
                window.v173MarkPersistentStateName(displayBuff,type);
            }
            buff.displayBuff=displayBuff;
            monster.v141TeamBuffs.push(buff);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(displayBuff);
        });
    }

    window.v141TryMonsterSpecialAction=function(monsterIndex){
        const monster=monsters[monsterIndex];
        const supportIds=monster&&monster.v141SupportSkillIds||[];
        if(!monster||!monster.alive||!supportIds.length){ return false; }
        const allyEntries=currentBattleMonsters.map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.alive);
        const allies=allyEntries.map(entry=>entry.monster);
        const forcedSupportSkillId=monster&&monster.v175ForcedSupportSkillId;
        if(monster){ delete monster.v175ForcedSupportSkillId; }
        let skillId=forcedSupportSkillId&&supportIds.includes(forcedSupportSkillId)
            &&skillDatabase[forcedSupportSkillId]?forcedSupportSkillId:null;
        let target=null;
        let healTargets=[];
        const allAlliesNeedHealing=allyEntries.some(entry=>
            monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)*.70
        );
        const healSkill=skillDatabase.healSpell;
        if(!skillId&&supportIds.includes("healSpell")&&allAlliesNeedHealing&&healSkill&&monster.sp>=(healSkill.spCost||0)){
            healTargets=getMonsterAllyTriTargets(monsterIndex,allyEntries);
            if(healTargets.length){ skillId="healSpell"; }
        }
        const affordableAttacks=(monster.skillIds||[]).filter(id=>{
            const skill=skillDatabase[id];
            return !!(skill&&monster.sp>=(skill.spCost||0));
        });
        const affordableBuffs=supportIds.filter(id=>{
            const skill=skillDatabase[id];
            return id!=="healSpell"&&!!(skill&&monster.sp>=(skill.spCost||0));
        });
        if(!skillId){
            const category=window.FourSymbolsEnemySkillAI
                ?window.FourSymbolsEnemySkillAI.chooseCategory(affordableAttacks,affordableBuffs,Math.random())
                :(Math.random()<.70?"attack":"buff");
            if(category==="attack"&&affordableAttacks.length){
                monster.v175ForcedAttackSkillId=affordableAttacks[Math.floor(Math.random()*affordableAttacks.length)];
                return false;
            }
            if(category!=="buff"&&affordableBuffs.length){
                /* An unaffordable/missing attack pool falls back once to buffs. */
            }else if(category==="normal"){ return false; }
        }
        if(!skillId&&supportIds.includes("barrier")){
            target=allies.find(item=>!(item.v141Shield&&item.v141Shield.isBarrier));
            if(target){ skillId="barrier"; }
        }
        if(!skillId&&supportIds.includes("rage")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="rage"&&buff.turnsLeft>0))){ skillId="rage"; }
        if(!skillId&&supportIds.includes("dinghaishenzhen")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="resistance"&&buff.turnsLeft>0))){ skillId="dinghaishenzhen"; }
        if(!skillId&&supportIds.includes("dodgeSkill")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="dodge"&&buff.turnsLeft>0))){ skillId="dodgeSkill"; }
        if(!skillId){
            if(affordableAttacks.length){
                monster.v175ForcedAttackSkillId=affordableAttacks[Math.floor(Math.random()*affordableAttacks.length)];
            }
            return false;
        }
        const skill=skillDatabase[skillId];
        if(monster.sp<(skill.spCost||0)){ return false; }
        monster.sp-=skill.spCost||0;
        showMonsterSkillNameBadge(skill.name,skill.element||monster.element,monsterIndex);
        if(skillId==="healSpell"){
            const level=Math.max(1,Math.min(Number(skill.maxLevel)||1,Number(monster.v141ForceSkillLevel||monster.v141SkillLevel)||1));
            const hpAmount=(Number(skill.baseHeal)||0)+(Number(skill.healPerLevel)||0)*(level-1);
            const spAmount=(Number(skill.baseHealSP)||0)+(Number(skill.healSPPerLevel)||0)*(level-1);
            let hpTotal=0;
            let spTotal=0;
            let cleansedTotal=0;
            healTargets.forEach(entry=>{
                const ally=entry.monster;
                const healed=window.v141HealMonsterPreservingShield(ally,hpAmount);
                const beforeSP=Math.max(0,Number(ally.sp)||0);
                ally.sp=Math.min(Math.max(beforeSP,Number(ally.maxSP)||0),beforeSP+spAmount);
                const restoredSP=ally.sp-beforeSP;
                if(skill.cleanseAll&&Array.isArray(ally.statusEffects)){
                    cleansedTotal+=ally.statusEffects.length;
                    ally.statusEffects=[];
                }
                hpTotal+=healed;
                spTotal+=restoredSP;
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            addBattleLog(monster.name+"施放治療術，為同排最多"+healTargets.length+"名友方共回復"+
                hpTotal+" HP、"+spTotal+" SP"+(skill.cleanseAll?"，並解除"+cleansedTotal+"個負面狀態":"")+"。");
        }else if(skillId==="barrier"){
            window.v141ApplyMonsterShield(target,999999,4);
            target.v141Shield.isBarrier=true;
            addBattleLog(monster.name+"為"+target.name+"施放結界，完全防護4回合。");
        }else if(skillId==="rage"){
            applyTimedMonsterBuff(allies,"rage",3,0);
            addBattleLog(monster.name+"施放怒火，敵方全體爆擊率與爆擊傷害提升3回合。");
        }else if(skillId==="dinghaishenzhen"){
            applyTimedMonsterBuff(allies,"resistance",3,65);
            addBattleLog(monster.name+"施放氣定神閒，敵方全體抗性提升3回合。");
        }else if(skillId==="dodgeSkill"){
            applyTimedMonsterBuff(allies,"dodge",3,75);
            addBattleLog(monster.name+"施放閃躲術，敵方全體閃躲提升3回合。");
        }
        updateUI(); finishPlayerAction();
        return true;
    };

    let lastAbyssBuffTick="";
    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            const key=token+":"+turn;
            if(key!==lastAbyssBuffTick){
                lastAbyssBuffTick=key;
                currentBattleMonsters.forEach(index=>{
                    const monster=monsters[index];
                    if(!monster||!monster.v141Abyss||!monster.v141TeamBuffs){ return; }
                    monster.v141TeamBuffs.forEach(buff=>{
                        if(turn>1){ buff.turnsLeft--; }
                        if(buff.displayBuff){ buff.displayBuff.turnsLeft=buff.turnsLeft; }
                        if(buff.turnsLeft>0){ return; }
                        if(buff.type==="rage"){
                            monster.attack=buff.originalAttack; monster.magicAttack=buff.originalMagicAttack;
                        }else if(buff.type==="resistance"){
                            monster.resistance=Math.max(0,(Number(monster.resistance)||0)-buff.amount);
                        }else if(buff.type==="dodge"){
                            monster.evasion=buff.originalEvasion;
                        }
                    });
                    monster.v141TeamBuffs=monster.v141TeamBuffs.filter(buff=>buff.turnsLeft>0);
                    monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>{
                        if(!buff||buff.turnsLeft<=0){ return false; }
                        if(buff.type==="v141TeamBuff"){
                            return monster.v141TeamBuffs.some(team=>team.displayBuff===buff);
                        }
                        if(buff.type==="rage"){
                            return monster.v141TeamBuffs.some(team=>team.displayBuff===buff);
                        }
                        return true;
                    });
                });
            }
            return originalStartTurn.apply(this,arguments);
        };
    }

    function bossPosition(){ return [61,21]; }
    const ABYSS_DIALOGUE={
        1:["凡人也敢踏入帝境？","黃沙會埋葬你的名字。","先過天兵這一關再說！"],
        2:["烈火會把你的勇氣燒光。","再向前一步，便是灰燼。","你撐不過南天之焰！"],
        3:["風起之時，無人能立。","你的招式太慢了。","天威不是凡人能挑戰的！"],
        4:["寒泉已封住你的退路。","讓冰霜替你長眠。","北境之前，止步吧！"],
        5:["五帝同臨，你已無路可退。","極光會照見你的敗亡。","此處便是深淵盡頭！"]
    };
    function abyssProgressLabel(){
        const phaseLabels={boss:"等待挑戰",chest:"寶箱待開啟",portal:"寶箱已領取・傳送點已開啟"};
        return "目前進度：第 "+abyssState.floor+" / 5 層・"+(phaseLabels[abyssState.phase]||"挑戰進行中");
    }
    function abyssBattleInfoMarkup(){
        const source=document.getElementById("battleInfo");
        const html=source&&String(source.innerHTML||"").trim();
        return html||'<div class="v17342-abyss-battle-empty">尚無戰鬥資訊</div>';
    }

    function renderAbyss(){
        if(abyssState.phase==="complete"){
            return '<div class="v141-abyss-intro complete"><div class="v141-abyss-seal">破</div><h3>本輪深淵已通關</h3><p>深淵寶箱已開啟。可重新開始下一輪挑戰。</p><button onclick="v141ResetAbyss()">重新挑戰</button></div>';
        }
        if(!abyssState.active||!abyssMapEntered){
            const resume=abyssState.active;
            return '<div class="v141-abyss-intro'+(resume?' v169-abyss-resume':'')+'"><div class="v141-abyss-seal">深淵</div><h3>五帝深淵</h3><p>共5張地圖、5場戰鬥。擊敗守關者、領取寶箱，再由傳送點前往下一層。</p>'+
                (resume?'<strong class="v169-abyss-progress">'+escapeHtml(abyssProgressLabel())+'</strong>':'')+
                '<button onclick="v141StartAbyss()">'+(resume?'繼續挑戰':'進入深淵')+'</button></div>';
        }
        const floor=abyssState.floor;
        const info=floor<5?abyssFloors[floor]:{boss:"五帝聯軍",element:"light"};
        const pos=bossPosition(floor);
        const boss=abyssState.phase==="boss"&&floor<5?'<button type="button" class="v141-abyss-boss" data-abyss-boss-control="true" style="left:'+pos[0]+'%;top:'+pos[1]+'%" onclick="v141HandleAbyssBossInteraction(event)"><b>'+escapeHtml(info.boss)+'</b><span>'+elementLabel[info.element]+'元素・點擊挑戰</span></button>':'';
        const hasFloorReward=floor<5&&(abyssState.phase==="chest"||abyssState.phase==="portal");
        const portal=hasFloorReward?'<button class="v141-abyss-portal'+(abyssState.phase==="chest"?' locked':'')+'" style="left:50%;top:10%" aria-disabled="'+(abyssState.phase==="chest"?'true':'false')+'" onclick="event.stopPropagation();v141UseAbyssPortal()"><i></i><span>'+(abyssState.phase==="chest"?'先開啟寶箱':'前往下一層')+'</span></button>':'';
        const showChest=abyssState.phase==="chest"||abyssState.phase==="portal";
        const chest=showChest?'<button class="v141-abyss-chest'+(abyssState.phase==="portal"?' open':'')+'" style="left:'+pos[0]+'%;top:'+pos[1]+'%" '+(abyssState.phase==="portal"?'aria-disabled="true"':'onclick="event.stopPropagation();v141OpenAbyssChest()"')+'><i></i><span>'+(abyssState.phase==="portal"?'寶箱已開啟':'深淵寶箱')+'</span></button>':'';
        return '<div class="v141-abyss-shell"><header><b>深淵 第'+floor+'/5層</b><span>'+escapeHtml(abyssState.message||'點擊地面移動角色')+'</span></header>'+
            '<div id="v141AbyssMap" class="v141-abyss-map floor-'+floor+'" onclick="v141AbyssMoveByEvent(event)">'+
            '<div id="v141AbyssSpeech" class="v141-abyss-speech"></div>'+boss+portal+chest+
            '<div id="v141AbyssPlayer" class="v141-abyss-player" style="left:'+abyssState.x+'%;top:'+abyssState.y+'%"><span></span><small>玩家</small></div></div>'+
            '<section class="v17342-abyss-battle-info" aria-label="戰鬥資訊"><b>戰鬥資訊</b><div class="v17342-abyss-battle-log">'+abyssBattleInfoMarkup()+'</div></section></div>';
    }

    function syncAbyssPlayerArt(){
        const target=document.querySelector("#v141AbyssPlayer > span");
        const source=document.getElementById("patrolCharacterImg");
        if(target&&source){
            const src=source.currentSrc||source.src||"";
            target.style.backgroundImage=src?'url("'+src.replace(/"/g,"%22")+'")':"none";
            target.style.backgroundSize="contain";
            target.style.backgroundPosition="center";
            target.style.backgroundRepeat="no-repeat";
        }
        installAbyssBossInputBridge();
    }

    function refreshAbyssPage(){
        const content=document.getElementById("dungeonTabContent");
        if(content){ content.innerHTML=renderAbyss(); requestAnimationFrame(syncAbyssPlayerArt); }
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="abyss"){ return renderAbyss(); }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }
    if(typeof switchDungeonTab==="function"){
        const originalSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(tabName){
            if(tabName!=="abyss"){ abyssMapEntered=false; }
            const result=originalSwitchDungeonTab.apply(this,arguments);
            if(tabName==="abyss"){ requestAnimationFrame(syncAbyssPlayerArt); }
            return result;
        };
    }
    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            /* Entering battle is part of the same map visit. Every other page
               exit must pause the run at its progress gate. */
            if(page!=="dungeon"&&page!=="battle"){ abyssMapEntered=false; }
            return originalShowPage.apply(this,arguments);
        };
    }

    window.v141StartAbyss=function(){
        if(!abyssState.active){ abyssState=Object.assign(defaultAbyssState(),{active:true,clears:abyssState.clears||0}); }
        abyssMapEntered=true;
        abyssState.x=50; abyssState.y=84;
        persistAbyss(); refreshAbyssPage();
    };
    window.v141ResetAbyss=function(){
        abyssState=Object.assign(defaultAbyssState(),{active:true,clears:abyssState.clears||0});
        abyssMapEntered=true;
        persistAbyss(); refreshAbyssPage();
    };
    window.v141GetAbyssState=function(){ return Object.assign({mapEntered:abyssMapEntered},abyssState); };
    window.v141LeaveAbyssMap=function(){ abyssMapEntered=false; };

    function moveAbyssPlayer(x,y,callback){
        const playerEl=document.getElementById("v141AbyssPlayer");
        if(!playerEl){ if(callback){ callback(); } return; }
        const distance=Math.hypot(x-abyssState.x,y-abyssState.y);
        const duration=Math.max(.45,Math.min(2.4,distance/28));
        abyssState.x=x; abyssState.y=y; persistAbyss();
        playerEl.style.transition="left "+duration+"s cubic-bezier(.22,.61,.36,1),top "+duration+"s cubic-bezier(.22,.61,.36,1)";
        playerEl.style.left=x+"%"; playerEl.style.top=y+"%";
        playerEl.classList.add("walking");
        setTimeout(()=>{
            playerEl.classList.remove("walking");
            if(callback){ callback(); }
            else{ maybeTriggerFinalAbyssEncounter(); }
        },duration*1000+30);
    }
    window.v141ApproachAbyssBoss=function(callback){
        if(abyssState.phase!=="boss"){ return false; }
        const pos=bossPosition(abyssState.floor);
        const approachY=Math.min(84,pos[1]+27);
        if(Math.hypot(abyssState.x-pos[0],abyssState.y-approachY)<=8){
            if(callback){ callback(); }
        }else{
            moveAbyssPlayer(pos[0],approachY,callback);
        }
        return true;
    };
    function finalAbyssApproachPoint(){
        const pos=bossPosition(5);
        return [pos[0],Math.min(84,pos[1]+27)];
    }

    function maybeTriggerFinalAbyssEncounter(){
        if(
            abyssState.floor!==5||abyssState.phase!=="boss"||abyssBattleStarting||
            activeAbyssDialogueAdvance
        ){ return false; }
        const approach=finalAbyssApproachPoint();
        if(Math.hypot(abyssState.x-approach[0],abyssState.y-approach[1])>10){ return false; }
        return openAbyssBossDialogue();
    }

    function isAbyssMapControlHit(event,control){
        if(!event||!control){ return false; }
        const target=event.target;
        if(target&&typeof target.closest==="function"&&target.closest("button")===control){
            return true;
        }
        const x=Number(event.clientX);
        const y=Number(event.clientY);
        if(!Number.isFinite(x)||!Number.isFinite(y)){ return false; }
        const rect=control.getBoundingClientRect();
        return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
    }

    /*
       All BOSS input enters here.  It is used both by the visible button and
       by a capture-phase pointer bridge on the map, so a portrait/pseudo-layer
       cannot turn a BOSS tap into a ground-movement request.
    */
    window.v141HandleAbyssBossInteraction=function(event){
        if(event){
            if(event.preventDefault){ event.preventDefault(); }
            if(event.stopPropagation){ event.stopPropagation(); }
        }
        if(abyssState.phase!=="boss"||abyssState.floor===5){ return false; }
        window.v141ChallengeAbyssBoss();
        return true;
    };

    function installAbyssBossInputBridge(){
        const map=document.getElementById("v141AbyssMap");
        if(!map||map.dataset.v173BossInputBridge==="1"){ return; }
        map.dataset.v173BossInputBridge="1";
        ["pointerup","click"].forEach(type=>map.addEventListener(type,event=>{
            /*
               The dialogue itself occupies the map.  Capture handlers run before
               its own click handler, so never route a dialogue click back into
               the guardian trigger.
            */
            if(event.target&&typeof event.target.closest==="function"&&event.target.closest(".v143-abyss-dialogue")){ return; }
            const boss=abyssState.phase==="boss"?map.querySelector(".v141-abyss-boss"):null;
            if(!isAbyssMapControlHit(event,boss)){ return; }
            window.v141HandleAbyssBossInteraction(event);
        },true));
    }

    window.v141AbyssMoveByEvent=function(event){
        const map=document.getElementById("v141AbyssMap");
        if(!map||map.dataset.v169DialogueApproaching==="1"){ return; }
        if(activeAbyssDialogueAdvance){
            if(event&&event.preventDefault){ event.preventDefault(); }
            if(event&&event.stopPropagation){ event.stopPropagation(); }
            activeAbyssDialogueAdvance();
            return;
        }
        const boss=abyssState.phase==="boss"?map.querySelector(".v141-abyss-boss"):null;
        /*
           Mobile browsers may report the portrait pseudo-element as the map
           target.  Route the touch by the guardian button's rendered bounds
           before treating it as a ground-movement request.
        */
        if(isAbyssMapControlHit(event,boss)){
            if(event.preventDefault){ event.preventDefault(); }
            if(event.stopPropagation){ event.stopPropagation(); }
            window.v141HandleAbyssBossInteraction(event);
            return;
        }
        if(event.target&&typeof event.target.closest==="function"&&event.target.closest("button")){ return; }
        const rect=map.getBoundingClientRect();
        /* V143：地圖放大後同步放寬可走區，保留角色半身安全邊界即可。 */
        const x=Math.max(4,Math.min(96,(event.clientX-rect.left)/rect.width*100));
        const y=Math.max(8,Math.min(94,(event.clientY-rect.top)/rect.height*100));
        if(abyssState.floor===5&&abyssState.phase==="boss"){
            const emperorPos=bossPosition(5);
            const nearFiveEmperors=Math.hypot(x-emperorPos[0],y-emperorPos[1])<=36||y<=62;
            if(nearFiveEmperors){
                const approach=finalAbyssApproachPoint();
                moveAbyssPlayer(approach[0],approach[1],maybeTriggerFinalAbyssEncounter);
                return;
            }
        }
        moveAbyssPlayer(x,y);
    };

    function launchAbyssBossBattle(){
        if(abyssBattleStarting||abyssState.phase!=="boss"){ return false; }
        abyssBattleStarting=true;
        const floor=abyssState.floor;
        setTimeout(()=>{
            const roster=buildAbyssRoster(floor);
            const started=window.v132LaunchDungeonBattle(roster,function(outcome){
                abyssBattleStarting=false;
                showPage("dungeon");
                /* Returning from combat must preserve the entered-map state.
                   showPage/switchDungeonTab may restore the daily tab first,
                   which otherwise clears this flag and reopens the cover. */
                abyssMapEntered=true;
                if(outcome.result!=="win"){
                    abyssState.message="挑戰失敗，守關者仍在等待。";
                    persistAbyss(); switchDungeonTab("abyss"); return;
                }
                abyssState.phase="chest";
                abyssState.message=floor<5
                    ?abyssFloors[floor].boss+"已退場。請開啟寶箱，再使用上方傳送點。"
                    :"五帝聯軍消失，深淵寶箱已出現。";
                persistAbyss(); switchDungeonTab("abyss");
            });
            if(!started){ abyssBattleStarting=false; }
        },180);
        return true;
    }

    function positionAbyssBossDialogue(map,overlay,bossButton){
        if(
            !map||!overlay||typeof map.getBoundingClientRect!=="function"||
            !overlay.style
        ){ return false; }
        const mapRect=map.getBoundingClientRect();
        const renderedWidth=Number(mapRect&&mapRect.width);
        const renderedHeight=Number(mapRect&&mapRect.height);
        if(!(renderedWidth>0)||!(renderedHeight>0)){ return false; }

        /* The map is rendered inside the scaled 1080x1920 stage. Convert the
           guardian's viewport rectangle back into map-local logical pixels. */
        const logicalWidth=Number(map.offsetWidth)>0?Number(map.offsetWidth):renderedWidth;
        const logicalHeight=Number(map.offsetHeight)>0?Number(map.offsetHeight):renderedHeight;
        const scaleX=logicalWidth/renderedWidth;
        const scaleY=logicalHeight/renderedHeight;
        const dialogueWidth=Math.max(0,Math.min(logicalWidth,Number(overlay.offsetWidth)||0));
        const dialogueHeight=Math.max(0,Math.min(logicalHeight,Number(overlay.offsetHeight)||0));
        const inset=12;
        const minLeft=Math.min(logicalWidth/2,dialogueWidth/2+inset);
        const maxLeft=Math.max(minLeft,logicalWidth-dialogueWidth/2-inset);
        const minTop=Math.min(logicalHeight,dialogueHeight+inset);
        const maxTop=Math.max(minTop,logicalHeight-inset);
        let desiredLeft=logicalWidth/2;
        let desiredTop=minTop;

        if(bossButton&&typeof bossButton.getBoundingClientRect==="function"){
            const bossRect=bossButton.getBoundingClientRect();
            const bossWidth=Number(bossRect&&bossRect.width);
            const bossLeft=Number(bossRect&&bossRect.left);
            const bossTop=Number(bossRect&&bossRect.top);
            if(Number.isFinite(bossLeft)&&Number.isFinite(bossTop)&&Number.isFinite(bossWidth)){
                desiredLeft=(bossLeft+bossWidth/2-mapRect.left)*scaleX;
                desiredTop=(bossTop-mapRect.top-8)*scaleY;
            }
        }

        const left=Math.max(minLeft,Math.min(maxLeft,desiredLeft))+"px";
        const top=Math.max(minTop,Math.min(maxTop,desiredTop))+"px";
        overlay.style.left=left;
        overlay.style.top=top;
        if(typeof overlay.style.setProperty==="function"){
            /* Final Abyss CSS must override the legacy full-map inset:0 rule.
               Custom properties carry these measured coordinates through that
               important rule without introducing another runtime wrapper. */
            overlay.style.setProperty("--v141-abyss-dialogue-left",left);
            overlay.style.setProperty("--v141-abyss-dialogue-top",top);
        }
        return true;
    }

    function openAbyssBossDialogue(){
        if(abyssBattleStarting||abyssState.phase!=="boss"){ return false; }
        const map=document.getElementById("v141AbyssMap");
        if(!map||map.dataset.v141AbyssDialogueOpening==="1"){ return false; }
        const bossButton=map.querySelector(".v141-abyss-boss");
        const existingDialogue=map.querySelector(".v143-abyss-dialogue");
        if(existingDialogue){
            return positionAbyssBossDialogue(map,existingDialogue,bossButton);
        }
        map.dataset.v141AbyssDialogueOpening="1";
        const floor=Math.max(1,Math.min(5,Number(abyssState.floor)||1));
        const boss=bossButton&&bossButton.querySelector("b");
        const speaker=boss&&boss.textContent||(floor===5?"五帝聯軍":"守關者");
        const lines=(ABYSS_DIALOGUE[floor]||ABYSS_DIALOGUE[1]).slice();
        let index=0;
        const overlay=document.createElement("button");
        overlay.type="button";
        overlay.className="v143-abyss-dialogue";
        overlay.setAttribute("aria-label","守關者對話，點擊繼續");
        overlay.innerHTML='<small>'+escapeHtml(speaker)+'</small><b></b><span>點擊空白處繼續　'+(index+1)+' / '+lines.length+'</span>';
        const text=overlay.querySelector("b");
        const hint=overlay.querySelector("span");
        text.textContent=lines[index];
        const advanceDialogue=()=>{
            index++;
            if(index<lines.length){
                text.textContent=lines[index];
                hint.textContent="點擊空白處繼續　"+(index+1)+" / "+lines.length;
                return;
            }
            text.textContent="進入戰鬥……";
            hint.textContent="";
            overlay.disabled=true;
            activeAbyssDialogueAdvance=null;
            delete map.dataset.v141DialogueOpen;
            setTimeout(()=>{
                overlay.remove();
                launchAbyssBossBattle();
            },180);
        };
        activeAbyssDialogueAdvance=advanceDialogue;
        map.dataset.v141DialogueOpen="1";
        overlay.onclick=event=>{
            event.preventDefault(); event.stopPropagation();
            advanceDialogue();
        };
        map.appendChild(overlay);
        positionAbyssBossDialogue(map,overlay,bossButton);
        delete map.dataset.v141AbyssDialogueOpening;
        return true;
    }

    window.v141ChallengeAbyssBoss=function(){
        return openAbyssBossDialogue();
    };

    window.v141UseAbyssPortal=function(){
        if(abyssState.floor>=5){ return; }
        if(abyssState.phase==="chest"){
            abyssState.message="請先點擊守關者位置的寶箱領取獎勵。";
            persistAbyss(); refreshAbyssPage();
            return;
        }
        if(abyssState.phase!=="portal"){ return; }
        moveAbyssPlayer(50,18,()=>{
            abyssState.floor=Math.min(5,abyssState.floor+1);
            abyssState.phase="boss"; abyssState.x=50; abyssState.y=84; abyssState.message="";
            persistAbyss(); refreshAbyssPage();
        });
    };

    window.v141OpenAbyssChest=function(){
        if(abyssState.phase!=="chest"){ return; }
        const pos=bossPosition(abyssState.floor);
        moveAbyssPlayer(pos[0],Math.min(84,pos[1]+27),()=>{
            const data=definitions();
            const floorTickets={1:"ticketSetEarth",2:"ticketSetFire",3:"ticketSetWind",4:"ticketSetWater"};
            const ticket=abyssState.floor<5
                ?data.tickets.find(item=>item.id===floorTickets[abyssState.floor])
                :data.tickets[Math.floor(Math.random()*data.tickets.length)];
            if(ticket&&window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(ticket,1)){ alert("背包空間不足，請整理後再開啟深淵寶箱。"); return; }
            if(abyssState.floor<5){
                if(ticket&&!addItem(ticket,1)){ alert("背包空間不足，寶箱尚未開啟。"); return; }
                abyssState.phase="portal";
                abyssState.message="寶箱已開啟。請點擊上方傳送點前往下一層。";
                persistAbyss(); rebuildInventorySlots(); saveGame(); refreshAbyssPage();
                if(ticket&&window.v141ShowBlackGoldReward){
                    window.v141ShowBlackGoldReward({
                        exp:0,
                        gold:0,
                        items:[{
                            id:ticket.id,
                            name:ticket.name,
                            count:1,
                            icon:ticket.icon
                        }]
                    });
                }
                return;
            }
            const indexes=getExistingPartyIndexes();
            const avgNeed=indexes.length?indexes.reduce((sum,index)=>sum+(Number(getPartyCharacterByIndex(index).expNext)||0),0)/indexes.length:0;
            const exp=Math.max(300,Math.floor(avgNeed*.45));
            const rewardGold=(2000+window.v141GetHighestCharacterLevel()*50)*5;
            if(ticket&&!addItem(ticket,1)){ alert("背包空間不足，寶箱尚未開啟。"); return; }
            sharedExp+=exp; gold+=rewardGold; abyssState.phase="complete"; abyssState.clears=(abyssState.clears||0)+1;
            persistAbyss(); rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            if(window.v141RecordAbyssClear){ window.v141RecordAbyssClear(); }
            refreshAbyssPage();
            window.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>深淵寶箱</h3><p>獲得 EXP '+exp.toLocaleString('zh-TW')+'<br>金幣 '+rewardGold.toLocaleString('zh-TW')+(ticket?'<br>'+escapeHtml(ticket.name)+' ×1':'')+'</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">收下</button></div></div>');
        });
    };
})();


/* bundled source: js/37-v142-skill-animation.js */
/* =====================================================
   V142 — combat action timing gate only
   Visual rendering was retired in V174. V143 owns all battle VFX.
===================================================== */
(function installV142SkillAnimationSystem(){
    "use strict";

    if(typeof window==="undefined"){ return; }
    if(window.__v142SkillAnimationInstalled && window.v142SkillAnimationDirector &&
        typeof window.v142PlaySkillAnimationFromBadge==="function"){ return; }
    window.__v142SkillAnimationInstalled=true;

    const VERSION="142-gate-only";
    const NORMAL_ANIMATION_MS=520;

    const SPECS={
        flameSlash:[760,"basic","slash"],fireCritical:[1050,"medium","impact"],
        explosiveFlurry:[1450,"medium","barrage"],dragonSlash:[2800,"ultimate","dragon"],
        fireRocket:[900,"basic","projectile"],blazeSpell:[1150,"medium","burst"],
        flameTornado:[2100,"high","tornado"],phoenixCry:[3200,"ultimate","phoenix"],
        rage:[1500,"medium","aura"],fireEX:[3000,"ultimate","aura"],

        waterKnife:[800,"basic","slash"],frostPunch:[900,"basic","ice-impact"],
        iceSpin:[1000,"medium","ice-barrage"],frostCrush:[1150,"high","ice-impact"],
        waterBall:[1400,"basic","projectile"],floodBeast:[1350,"medium","wave"],
        iceArrowRain:[1600,"high","ice-rain"],freeze:[950,"high","freeze"],
        healSpell:[1250,"medium","heal"],revive:[1800,"high","revive"],
        waterEX:[3000,"ultimate","aura"],

        stormFist:[1200,"basic","impact"],stormFlurry:[1500,"medium","barrage"],
        windCrossSlash:[1700,"high","cross-slash"],dizzyFist:[1800,"high","lightning"],
        windSpell:[1400,"basic","projectile"],stormCircle:[1600,"medium","tornado"],
        windHowlLightning:[1900,"high","lightning"],stormRain:[2600,"ultimate","tempest"],
        dodgeSkill:[1600,"medium","aura"],stealthSkill:[1700,"medium","veil"],
        dinghaishenzhen:[2200,"high","aura"],windEX:[3000,"ultimate","aura"],

        stoneSlash:[1100,"basic","slash"],petrifyFist:[1400,"medium","stone-impact"],
        stoneBreakSky:[1700,"high","stone-impact"],earthquakeCrush:[1800,"ultimate","earthquake"],
        stoneThrow:[1300,"basic","projectile"],sandWind:[1500,"medium","sandstorm"],
        flyingSandStrike:[2000,"high","petrify"],dustStorm:[2000,"ultimate","earthquake"],
        earthShield:[1800,"medium","shield"],rockWall:[1700,"high","shield"],
        barrier:[1900,"high","barrier"],earthEX:[3000,"ultimate","aura"],

        stormSpell:[2450,"high","tempest"],
        yuanXiangGuangMing:[2200,"high","holy-heal"],
        yuanGuangShield:[1950,"high","holy-shield"],
        yuanZuBlessing:[2000,"high","holy-blessing"]
    };

    function patchExtremeEmperorSkills(){
        if(typeof skillDatabase==="undefined"){ return; }
        const heal=skillDatabase.yuanXiangGuangMing;
        if(heal){
            heal.baseHeal=350;
            heal.baseHealSP=95;
            heal.targetType="allyAll";
            heal.description="我方全體回復350 HP、95 SP。";
        }
        const shield=skillDatabase.yuanGuangShield;
        if(shield){
            shield.shieldAmount=200;
            shield.shieldDuration=2;
            shield.targetType="allyAll";
            shield.description="我方全體獲得200護盾，持續2回合。";
        }
        if(!skillDatabase.yuanZuBlessing){
            skillDatabase.yuanZuBlessing={
                id:"yuanZuBlessing",name:"元祖賜福",element:"light",category:"buff",
                targetType:"allyAll",maxLevel:1,spCost:45,agilityBonusPercent:75,duration:2,
                description:"我方全體解除所有負面狀態，並增加敏捷75%，持續2回合。"
            };
        }
    }

    function fallbackSpec(skill){
        if(!skill){ return [NORMAL_ANIMATION_MS,"normal","impact"]; }
        const tier=Math.max(0,Number(skill.tier)||0);
        const category=String(skill.category||"");
        const target=String(skill.targetType||"");
        if(/heal|revive|buff/.test(category)){
            return [tier>=3?2200:1400,tier>=3?"high":"medium",category==="revive"?"revive":category==="heal"?"heal":"aura"];
        }
        if(target==="all"||target==="enemyAll"||target==="allyAll"){
            return [tier>=3?2700:1900,tier>=3?"ultimate":"high","barrage"];
        }
        if(target==="row"||target==="tri"){
            return [tier>=3?2100:1350,tier>=3?"high":"medium","barrage"];
        }
        if(tier>=4){ return [2800,"ultimate","burst"]; }
        if(tier>=3){ return [1900,"high","burst"]; }
        if(tier>=2){ return [1200,"medium","impact"]; }
        return [760,"basic","impact"];
    }

    function findSkill(skillId,name,element){
        if(typeof skillDatabase==="undefined"){ return {id:skillId,skill:null}; }
        if(skillId&&skillDatabase[skillId]){ return {id:skillId,skill:skillDatabase[skillId]}; }
        let foundId=null;
        Object.getOwnPropertyNames(skillDatabase).some(id=>{
            const candidate=skillDatabase[id];
            if(candidate&&candidate.name===name&&(!element||!candidate.element||candidate.element===element)){
                foundId=id;
                return true;
            }
            return false;
        });
        return {id:foundId,skill:foundId?skillDatabase[foundId]:null};
    }

    function animationConfig(skillId,name,element){
        if(name==="普通攻擊"||skillId==="normal"){
            return {
                id:"normal",name:"普通攻擊",element:element||"normal",
                duration:NORMAL_ANIMATION_MS,resolveDuration:NORMAL_ANIMATION_MS,
                tier:"normal",style:"impact",targetType:"single"
            };
        }
        const found=findSkill(skillId,name,element);
        const spec=SPECS[found.id]||fallbackSpec(found.skill);
        return {
            id:found.id||"unknown",
            name:name||(found.skill&&found.skill.name)||"技能",
            element:(found.skill&&found.skill.element)||element||"normal",
            duration:Math.max(NORMAL_ANIMATION_MS,Number(found.skill&&found.skill.animationDuration)||spec[0]),
            resolveDuration:Math.max(NORMAL_ANIMATION_MS,Number(found.skill&&found.skill.resolveDuration)||spec[0]),
            tier:(found.skill&&found.skill.animationTier)||spec[1],
            style:(found.skill&&found.skill.animationStyle)||spec[2],
            category:(found.skill&&found.skill.category)||"",
            targetType:(found.skill&&found.skill.targetType)||"single"
        };
    }

    function applyMetadata(){
        if(typeof skillDatabase==="undefined"){ return; }
        Object.keys(skillDatabase).forEach(id=>{
            const skill=skillDatabase[id];
            if(!skill){ return; }
            const spec=SPECS[id]||fallbackSpec(skill);
            skill.animationDuration=Math.max(NORMAL_ANIMATION_MS,Number(skill.animationDuration)||spec[0]);
            skill.resolveDuration=Math.max(NORMAL_ANIMATION_MS,Number(skill.resolveDuration)||spec[0]);
            skill.animationTier=skill.animationTier||spec[1];
            skill.animationStyle=skill.animationStyle||spec[2];
        });
    }

    patchExtremeEmperorSkills();
    applyMetadata();

    const state={
        sequence:0,active:null,latest:null,fallbackTimer:0,visibilityHandler:null,
        metrics:{
            version:VERSION,started:0,completed:0,superseded:0,
            last:null
        }
    };

    function removeVisibilityHandler(){
        if(state.visibilityHandler&&typeof document!=="undefined"&&document.removeEventListener){
            document.removeEventListener("visibilitychange",state.visibilityHandler);
        }
        state.visibilityHandler=null;
    }

    function cleanup(){
        removeVisibilityHandler();
        if(state.fallbackTimer){ clearTimeout(state.fallbackTimer); state.fallbackTimer=0; }
    }

    function armGateDeadline(gate,duration,reason){
        if(!gate||gate.done){ return false; }
        if(state.fallbackTimer){ clearTimeout(state.fallbackTimer); state.fallbackTimer=0; }
        const visualDuration=Math.max(0,Number(duration)||0);
        gate.visualStartedAt=Date.now();
        gate.deadline=gate.visualStartedAt+visualDuration;
        state.fallbackTimer=setTimeout(
            ()=>gate.complete(reason||"v142-timing-only"),
            visualDuration
        );
        return true;
    }

    function identity(side,name,actorIndex){
        return [
            typeof battleToken!=="undefined"?battleToken:"none",
            typeof turn!=="undefined"?turn:"none",
            typeof battlePhase!=="undefined"?battlePhase:"none",
            typeof initiativeIndex!=="undefined"?initiativeIndex:"none",
            typeof activeBattleCharacterIndex!=="undefined"?activeBattleCharacterIndex:"none",
            side,actorIndex,name
        ].join("|");
    }

    function createGate(config,key,onComplete){
        let resolvePromise=null;
        const gate={
            id:++state.sequence,key:key,
            battleToken:typeof battleToken!=="undefined"?battleToken:null,
            config:config,startedAt:Date.now(),visualStartedAt:0,deadline:0,done:false,reason:null,
            completionCount:0,promise:null,complete:null
        };
        gate.deadline=gate.startedAt+Math.max(0,Number(config.resolveDuration)||Number(config.duration)||0);
        gate.restartVisualTimeline=function(duration){
            return armGateDeadline(gate,duration,"v142-v143-visual-complete");
        };
        gate.promise=new Promise(resolve=>{ resolvePromise=resolve; });
        gate.complete=function(reason){
            if(gate.done){ return false; }
            gate.done=true;
            gate.reason=reason||"completed";
            gate.completionCount++;
            if(state.active===gate){ state.active=null; }
            state.metrics.completed++;
            cleanup();
            resolvePromise(gate);
            return true;
        };
        if(typeof onComplete==="function"){ gate.promise.then(()=>onComplete(gate)); }
        return gate;
    }

    function play(config,meta){
        meta=meta||{};
        const key=meta.key||identity(meta.side||"player",config.name,meta.actorIndex);
        if(state.active&&!state.active.done){
            if(state.active.key===key){ return state.active; }
            state.metrics.superseded++;
            state.active.complete("superseded");
        }
        const gate=createGate(config,key,meta.onComplete);
        state.active=gate;
        state.latest=gate;
        state.metrics.started++;
        state.metrics.last={
            id:config.id,name:config.name,duration:config.duration,
            resolveDuration:config.resolveDuration,tier:config.tier,
            style:config.style,element:config.element,side:meta.side||"player"
        };

        /* The gate measures visual lifetime only. Queue progression never waits
           on this Promise; 00-main.js reads the remaining time and schedules its
           own deterministic handoff even if the raster renderer fails. */
        armGateDeadline(
            gate,
            Math.max(0,Number(config.resolveDuration)||Number(config.duration)||0),
            meta.render===false?"v142-render-safety-deadline":"v142-timing-only"
        );
        if(typeof document!=="undefined"&&document.addEventListener){
            state.visibilityHandler=function(){
                if(!document.hidden&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
            };
            document.addEventListener("visibilitychange",state.visibilityHandler);
        }
        return gate;
    }

    const director={
        play:play,
        getActive:function(){ return state.active; },
        getLatest:function(){ return state.latest; },
        getMetrics:function(){ return Object.assign({},state.metrics,{active:!!state.active}); },
        dispose:function(){
            if(state.active&&!state.active.done){ state.active.complete("dispose"); }
            else{ cleanup(); }
        },
        notifyVisibilityReturn:function(){
            const gate=state.active;
            if(gate&&!gate.done&&Date.now()>=gate.deadline){ gate.complete("visibility-resume"); }
        }
    };

    window.v142SkillAnimationDirector=director;
    window.v142GetSkillAnimationConfig=function(skillId){
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        return animationConfig(skillId,skill&&skill.name,skill&&skill.element);
    };
    window.v142GetSkillNameDisplayDuration=function(name,element){
        const config=animationConfig(null,name,element);
        return Math.max(1,Math.round(config.duration*2/3));
    };
    window.v142GetAnimationDiagnostics=function(){ return director.getMetrics(); };
    window.v142CreateAnimationGateForTest=function(duration,onComplete){
        return createGate({
            id:"test",name:"test",element:"normal",duration:duration,
            resolveDuration:duration,tier:"normal",style:"impact"
        },"test-"+state.sequence,onComplete);
    };

    function startFromBadge(side,name,element,actorIndex,targetId,targetIds,targetContract){
        if(typeof battleActive!=="undefined"&&!battleActive){ return null; }
        const config=animationConfig(null,name,element);
        if(config.category==="passive"||config.targetType==="none"){ return null; }
        const meta={
            side:side,actorIndex:Number.isInteger(actorIndex)?actorIndex:0,
            key:identity(side,name,actorIndex)
        };
        const contract=targetContract&&targetContract.version==="battle-target-contract-v1"
            ?targetContract
            :Object.freeze({
                version:"battle-target-contract-v1",
                side:side,
                actorIndex:meta.actorIndex,
                targetId:targetId!==undefined?targetId:null,
                targetIds:Object.freeze(Array.isArray(targetIds)?targetIds.slice():[])
            });
        meta.targetContract=contract;
        meta.targetSide=contract.targetSide;
        meta.targetId=contract.targetId!==undefined?contract.targetId:null;
        meta.targetIds=Array.isArray(contract.targetIds)?contract.targetIds.slice():[];
        return director.play(config,meta);
    }
    window.v142PlaySkillAnimationFromBadge=function(side,name,element,actorIndex,targetId,targetIds,targetContract){
        return startFromBadge(side,name,element,actorIndex,targetId,targetIds,targetContract);
    };

    function currentGate(){
        const gate=state.latest;
        if(!gate){ return null; }
        if(typeof battleToken!=="undefined"&&gate.battleToken!==null&&gate.battleToken!==battleToken){ return null; }
        return gate;
    }

    /* The visual gate owns only visual lifetime. Queue progression has one
       owner in 00-main.js and can never wait on a renderer Promise. */
    window.v142GetActiveAnimationGate=currentGate;
    window.v142GetRemainingAnimationMs=function(){
        const gate=currentGate();
        return gate&&!gate.done?Math.max(0,gate.deadline-Date.now()):0;
    };


    function emperorAllies(){
        if(typeof currentBattleMonsters==="undefined"||typeof monsters==="undefined"){ return []; }
        return currentBattleMonsters.map(index=>monsters[index]).filter(monster=>monster&&monster.alive);
    }
    function baseMaxHp(monster){
        return monster&&monster.v141Shield
            ?Number(monster.v141Shield.baseMaxHP)||Number(monster.maxHP)||0
            :Number(monster&&monster.maxHP)||0;
    }
    function baseHp(monster){
        const shield=monster&&monster.v141Shield?Math.max(0,Number(monster.v141Shield.remaining)||0):0;
        return Math.max(0,(Number(monster&&monster.hp)||0)-shield);
    }
    function restoreSp(monster,amount){
        const max=Math.max(0,Number(monster&&monster.maxSP)||Number(monster&&monster.sp)||0);
        const before=Math.max(0,Number(monster&&monster.sp)||0);
        monster.sp=Math.min(max,before+amount);
        return monster.sp-before;
    }
    function clearNegativeStates(monster){
        const removed=Array.isArray(monster&&monster.statusEffects)?monster.statusEffects.length:0;
        if(monster){ monster.statusEffects=[]; }
        return removed;
    }
    function applyBlessing(monster){
        if(!monster||!monster.alive){ return; }
        let blessing=monster.v142AgilityBlessing;
        if(!blessing){
            const original=Math.max(0,Number(monster.agility)||0);
            const display={type:"v141TeamBuff",v141BuffType:"agility",turnsLeft:2,statusName:"元祖賜福"};
            blessing={originalAgility:original,turnsLeft:2,displayBuff:display};
            monster.v142AgilityBlessing=blessing;
            monster.agility=Math.round(original*1.75);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
        }else{
            blessing.turnsLeft=2;
            blessing.displayBuff.turnsLeft=2;
        }
    }

    function castExtremeEmperorSkill(monsterIndex,forcedSkillId){
        const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
        if(!monster||!monster.alive||monster.name!=="極帝天尊"){ return false; }
        if(
            (typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster))
        ){ return false; }
        const allies=emperorAllies();
        if(!allies.length){ return false; }

        const anyNegative=allies.some(ally=>Array.isArray(ally.statusEffects)&&ally.statusEffects.length);
        const anyInjured=allies.some(ally=>baseHp(ally)<baseMaxHp(ally));
        const anySpGap=allies.some(ally=>Math.max(0,(Number(ally.maxSP)||0)-(Number(ally.sp)||0))>=95);
        const anyShieldless=allies.some(ally=>!(ally.v141Shield&&Number(ally.v141Shield.remaining)>0));
        const allBlessed=allies.every(ally=>ally.v142AgilityBlessing&&ally.v142AgilityBlessing.turnsLeft>0);

        let skillId=forcedSkillId||null;
        if(!skillId){
            if(anyNegative){ skillId="yuanZuBlessing"; }
            else if(anyInjured||anySpGap){ skillId="yuanXiangGuangMing"; }
            else if(anyShieldless){ skillId="yuanGuangShield"; }
            else if(!allBlessed){ skillId="yuanZuBlessing"; }
            else{ return false; }
        }
        const skill=typeof skillDatabase!=="undefined"?skillDatabase[skillId]:null;
        if(!skill){ return false; }
        const cost=Math.max(0,Number(skill.spCost)||0);
        if((Number(monster.sp)||0)<cost){ return false; }
        monster.sp=Math.max(0,(Number(monster.sp)||0)-cost);
        if(typeof showMonsterSkillNameBadge==="function"){
            showMonsterSkillNameBadge(skill.name,skill.element||"light",monsterIndex);
        }

        if(skillId==="yuanXiangGuangMing"){
            let hpTotal=0,spTotal=0;
            allies.forEach(ally=>{
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,350)
                    :(function(){
                        const before=Number(ally.hp)||0;
                        ally.hp=Math.min(Number(ally.maxHP)||before,before+350);
                        return ally.hp-before;
                    })();
                hpTotal+=healed;
                spTotal+=restoreSp(ally,95);
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元相光明，我方全體回復350 HP、95 SP（實際 "+hpTotal+" HP／"+spTotal+" SP）。");
            }
        }else if(skillId==="yuanGuangShield"){
            allies.forEach(ally=>{
                if(typeof window.v141ApplyMonsterShield==="function"){ window.v141ApplyMonsterShield(ally,200,2); }
                else{
                    ally.v141Shield={remaining:200,turnsLeft:2,baseMaxHP:ally.maxHP,baseHp:ally.hp};
                    ally.hp=(Number(ally.hp)||0)+200;
                }
            });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元光護體，我方全體獲得200護盾，持續2回合。");
            }
        }else if(skillId==="yuanZuBlessing"){
            let removed=0;
            allies.forEach(ally=>{ removed+=clearNegativeStates(ally); applyBlessing(ally); });
            if(typeof addBattleLog==="function"){
                addBattleLog(monster.name+"施放元祖賜福，我方全體解除"+removed+"個負面狀態並提升75%敏捷，持續2回合。");
            }
        }else{
            return false;
        }

        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof finishPlayerAction==="function"){ finishPlayerAction(); }
        return true;
    }

    window.v142ResolveExtremeEmperorAction=castExtremeEmperorSkill;

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previous=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.name==="極帝天尊"){
                monster.v141SupportSkillIds=Array.from(new Set((monster.v141SupportSkillIds||[]).concat([
                    "yuanXiangGuangMing","yuanGuangShield","yuanZuBlessing"
                ])));
                if(castExtremeEmperorSkill(monsterIndex)){ return true; }
            }
            return previous.apply(this,arguments);
        };
    }

    let lastBlessingTick="";
    if(typeof startTurn==="function"){
        const previous=startTurn;
        startTurn=function(token){
            const key=String(token)+":"+String(typeof turn!=="undefined"?turn:"");
            if(key!==lastBlessingTick){
                lastBlessingTick=key;
                emperorAllies().forEach(monster=>{
                    const blessing=monster.v142AgilityBlessing;
                    if(!blessing){ return; }
                    if(typeof turn!=="undefined"&&turn>1){ blessing.turnsLeft--; }
                    blessing.displayBuff.turnsLeft=blessing.turnsLeft;
                    if(blessing.turnsLeft>0){ return; }
                    monster.agility=blessing.originalAgility;
                    monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==blessing.displayBuff);
                    delete monster.v142AgilityBlessing;
                });
            }
            return previous.apply(this,arguments);
        };
    }

    if(typeof checkBattleEnd==="function"){
        const previous=checkBattleEnd;
        checkBattleEnd=function(){
            const result=previous.apply(this,arguments);
            if(result){ setTimeout(()=>director.dispose(),0); }
            return result;
        };
    }
    if(typeof window.addEventListener==="function"){
        window.addEventListener("pagehide",()=>director.dispose());
    }
})();


/* bundled source: js/38-v143-system-fixes.js */
/* =====================================================
   V143 — mobile combat readability, dungeon flow and rules
   This patch intentionally stays above the legacy engine: it fixes the
   current public behavior without reopening js/00-main.js.
===================================================== */
(function installV143SystemFixes(){
    "use strict";

    if(typeof window==="undefined" || window.__v143SystemFixesInstalled){ return; }
    window.__v143SystemFixesInstalled=true;

    const VERSION="143";
    const POTION_TARGET_ACTION="__v143PotionTarget";
    const TIER_ALIASES={low:"white",mid:"blue",high:"purple",perfect:"orange"};
    const TIER_META={
        white:{label:"白階",available:true,craftGold:500,main:[1,5],color:"#D8D8D8"},
        blue:{label:"藍階",available:true,craftGold:1500,main:[3,8],color:"#42A5FF"},
        purple:{label:"紫階",available:true,craftGold:4000,main:[5,11],sub:[1,3],color:"#B05CFF"},
        orange:{label:"橙階",available:true,craftGold:10000,main:[7,14],sub:[2,5],color:"#FF9F38"},
        pink:{label:"桃紅階",available:false,planned:true,color:"#FF4FA7"},
        "four-symbol":{label:"四象階",available:false,planned:true,color:"#E5C06B"}
    };
    function normalizeTierKey(value){
        const key=String(value||"").toLowerCase();
        return TIER_ALIASES[key]||key;
    }
    const SLOT_META={
        head:{label:"頭部",type:"head",glyph:"冠"},
        shoulder:{label:"護腕",type:"shoulder",glyph:"腕"},
        shoes:{label:"鞋子",type:"shoes",glyph:"履"},
        hand:{label:"武器",type:"weapon",glyph:"刃"},
        armor:{label:"衣服",type:"armor",glyph:"甲"}
    };
    const STAT_KEYS=["attack","intelligence"];
    const SUBSTAT_KEYS=["vitality","energy","agility","spirit"];
    const NORMAL_GEAR_PREFIXES=["古銅","精鍛","雲紋","玄鐵","旅者","守備","靈巧","秘銀"];

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function svgIcon(glyph,color){
        const safeGlyph=escapeHtml(glyph);
        const safeColor=escapeHtml(color||"#d4aa61");
        return '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="v143gear" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#332718"/><stop offset="1" stop-color="#090807"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="12" fill="url(#v143gear)" stroke="'+safeColor+'" stroke-width="3"/><path d="M12 46L20 18L32 11L44 18L52 46L32 55Z" fill="none" stroke="'+safeColor+'" stroke-opacity=".42" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="'+safeColor+'">'+safeGlyph+'</text></svg>';
    }

    /* ----- 11 / 12. Skill data and hard-control caps are one ruleset. ----- */
    function applySkillRuleChanges(){
        if(typeof skillDatabase==="undefined"){ return; }
        const storm=skillDatabase.stormRain;
        if(storm){
            storm.learnCost=30;
            storm.maxLevel=5;
            storm.baseDamage=48;
            storm.damagePerLevel=14;
            storm.spCost=75;
            storm.stunChance=35;
            storm.stunDuration=1;
            storm.missBonusByLevel=[15,20,25,30,35];
            storm.requires=["windHowlLightning"];
            storm.description="對敵方全體各造成48點基礎法術傷害；35%基礎機率暈眩1回合，使目標最終命中率降低15%/20%/25%/30%/35%。";
        }
        const rain=skillDatabase.iceArrowRain;
        if(rain){
            rain.learnCost=20;
            rain.maxLevel=5;
            rain.baseDamage=30;
            rain.damagePerLevel=12;
            rain.spCost=75;
            /* Ice Arrow Rain is Frostbite, not the hard-control Freeze state. */
            delete rain.freezeChance;
            delete rain.freezeDuration;
            delete rain.freezeSingleTarget;
            rain.frostbiteChance=50;
            rain.frostbiteDuration=2;
            rain.lifestealPercentByLevel=[1,2,3,4,5];
            rain.requires=["floodBeast"];
            rain.description="對敵方全體各造成30點基礎法術傷害；吸取實際傷害的1%/2%/3%/4%/5%恢復自身HP；每個命中目標各有50%基礎機率凍傷2回合。";
        }
        const freeze=skillDatabase.freeze;
        if(freeze){
            freeze.learnCost=25;
            freeze.maxLevel=1;
            freeze.spCost=22;
            freeze.freezeChance=80;
            freeze.freezeDuration=4;
            freeze.requires=["iceArrowRain"];
            freeze.description="80%基礎機率冰封單一目標，使其無法行動4回合；純控場技能，不造成傷害。";
        }
    }
    applySkillRuleChanges();

    window.v143CombatRuleSnapshot=function(){
        return {
            version:VERSION,
            lockdownCaps:{regular:90,elite:80,boss:70,player:60},
            stormRain:skillDatabase&&skillDatabase.stormRain,
            iceArrowRain:skillDatabase&&skillDatabase.iceArrowRain,
            freeze:skillDatabase&&skillDatabase.freeze
        };
    };

    /* Ice Arrow Rain is finalized by the shared Frostbite owner in V149.
       Do not install a second per-target Freeze path here. */

    /* ----- 1. Enemy card text: start large, only fit when it truly overflows. ----- */
    function fitEnemyIdentity(card,node){
        if(!card||!node){ return; }
        node.style.removeProperty("transform");
        node.style.removeProperty("width");
        node.style.setProperty("font-size","16px","important");
        const available=Math.max(1,node.clientWidth||card.clientWidth-6||68);
        let size=16;
        while(size>12 && node.scrollWidth>available){
            size--;
            node.style.setProperty("font-size",size+"px","important");
        }
        if(node.scrollWidth>available){
            const scale=Math.max(.72,available/node.scrollWidth);
            node.style.setProperty("transform","scaleX("+scale+")");
        }
        node.dataset.v143FontSize=String(size);
    }

    function decorateEnemyCard(index){
        const card=document.getElementById("battleMonster"+index);
        const monster=typeof monsters!=="undefined"?monsters[index]:null;
        if(!card||!monster){ return; }
        const name=card.querySelector(".battle-monster-name");
        const level=card.querySelector(".battle-monster-level");
        if(!name){ return; }
        const identity=monster.name+" Lv"+monster.level;
        if(name.textContent.trim()!==identity){ name.textContent=identity; }
        name.classList.add("v143-monster-identity");
        if(level){ level.hidden=true; level.setAttribute("aria-hidden","true"); }
        fitEnemyIdentity(card,name);
        fitEnemyBars(card);
    }

    function fitEnemyBars(card){
        card.querySelectorAll(".monster-bar-text").forEach(node=>{
            node.style.removeProperty("transform");
            node.style.setProperty("font-size","13px","important");
            const available=Math.max(1,node.clientWidth||68);
            let size=13;
            while(size>11&&node.scrollWidth>available){
                size--;
                node.style.setProperty("font-size",size+"px","important");
            }
            if(node.scrollWidth>available){
                node.style.setProperty("transform","scaleX("+Math.max(.82,available/node.scrollWidth)+")");
            }
            node.dataset.v143FontSize=String(size);
        });
    }

    function decorateEnemyCards(){
        if(typeof currentBattleMonsters==="undefined"){ return; }
        currentBattleMonsters.forEach(decorateEnemyCard);
    }

    function v143AfterBattleRender(){
        decorateEnemyCards();
        if(typeof requestAnimationFrame==="function"){ requestAnimationFrame(decorateEnemyCards); }
        if(typeof window.v144ConfigureDungeonBattleSkillsAfterRender==="function"){
            window.v144ConfigureDungeonBattleSkillsAfterRender();
        }
    }
    window.v143AfterBattleRender=v143AfterBattleRender;
    if(typeof updateMonsterUI==="function"){
        const previousUpdateMonsterUI=updateMonsterUI;
        updateMonsterUI=function(index){
            const result=previousUpdateMonsterUI.apply(this,arguments);
            decorateEnemyCard(index);
            syncEarthShieldEffects();
            syncMonsterBarrierText(index);
            const card=document.getElementById("battleMonster"+index);
            if(card){ fitEnemyBars(card); }
            return result;
        };
    }

    /* ----- 7. Wanxiang Earth Shield owns a four-corner elemental frame. ----- */
    function hasActiveBuffType(entity,type){
        return !!(entity&&Array.isArray(entity.activeBuffs)&&entity.activeBuffs.some(buff=>
            buff&&buff.type===type&&numeric(buff.turnsLeft)>0
        ));
    }

    function syncEarthShieldCard(){ return; }

                            function syncEarthShieldEffects(){
        if(typeof document==="undefined"){ return; }
        for(let index=0;index<3;index++){
            const entity=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            syncEarthShieldCard(document.getElementById("battlePlayerCard"+index),entity);
        }
        if(typeof currentBattleMonsters!=="undefined"){
            currentBattleMonsters.forEach(index=>syncEarthShieldCard(
                document.getElementById("battleMonster"+index),monsters[index]
            ));
        }
    }
    window.v143SyncEarthShieldEffects=syncEarthShieldEffects;

    /* ----- 10. Both sides use five direct blocks / five rounds for Barrier. ----- */
    function isMonsterBarrier(monster){
        return !!(monster&&monster.v141Shield&&monster.v141Shield.isBarrier);
    }

    function removeMonsterBarrier(monster){
        const shield=monster&&monster.v141Shield;
        if(!shield){ return; }
        monster.maxHP=Math.max(1,numeric(shield.baseMaxHP)||numeric(monster.maxHP));
        monster.hp=Math.max(0,Math.min(monster.maxHP,numeric(shield.baseHp)));
        monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>buff!==shield&&buff.type!=="shield");
        monster.v141Shield=null;
    }

    if(typeof window.v141ApplyMonsterShield==="function"){
        const previousApplyMonsterShield=window.v141ApplyMonsterShield;
        window.v141ApplyMonsterShield=function(monster,amount,turns){
            const barrier=numeric(amount)>=999999;
            const stateType=barrier?"barrier":"shield";
            const monsterIndex=typeof monsters!=="undefined"?monsters.indexOf(monster):-1;
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    monster,stateType,"monster",monsterIndex>=0?monsterIndex:undefined,
                    barrier?"結界":"岩盾"
                )
            ){
                return 0;
            }
            const result=previousApplyMonsterShield.call(this,monster,barrier?1:amount,barrier?5:turns);
            if(monster&&monster.v141Shield){
                if(barrier){
                    monster.v141Shield.isBarrier=true;
                    monster.v141Shield.turnsLeft=5;
                    monster.v141Shield.remainingBlocks=5;
                    monster.v141Shield.barrierRule="shared";
                }
                if(typeof window.v173MarkPersistentStateName==="function"){
                    window.v173MarkPersistentStateName(monster.v141Shield,stateType);
                }
            }
            return result;
        };
    }

    let directPlayerActionDepth=0;
    let directPlayerBarrierContext=null;
    function wrapDirectPlayerAction(name){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const outermost=directPlayerActionDepth===0;
            const previousContext=directPlayerBarrierContext;
            if(outermost){ directPlayerBarrierContext={blocked:new Map()}; }
            directPlayerActionDepth++;
            try{ return previous.apply(this,arguments); }
            finally{
                directPlayerActionDepth=Math.max(0,directPlayerActionDepth-1);
                if(outermost){ directPlayerBarrierContext=previousContext; }
            }
        };
    }
    [
        "normalAttack","secondaryCharacterNormalAttack","player2NormalAttack","windArrowAttack",
        "castDamageSkill","castSecondaryCharacterSkill","castPlayer2Skill"
    ].forEach(wrapDirectPlayerAction);

    function currentAnimationIsPlayerAttack(){
        const current=window.v143SkillAnimationState&&window.v143SkillAnimationState.current;
        return !!(current&&!current.done&&current.side==="player");
    }

    if(typeof addBattleLog==="function"){
        const previousBattleLog=addBattleLog;
        addBattleLog=function(message){
            let text=String(message);
            if((directPlayerActionDepth>0||currentAnimationIsPlayerAttack())&&/造成\d+傷害/.test(text)&&typeof currentBattleMonsters!=="undefined"){
                const blocked=currentBattleMonsters.map(index=>monsters[index]).find(monster=>
                    isMonsterBarrier(monster)&&text.indexOf(monster.name)>=0
                );
                if(blocked){ text=text.replace(/造成\d+傷害/,"造成0傷害（結界格擋）"); }
            }
            const args=Array.prototype.slice.call(arguments);
            args[0]=text;
            return previousBattleLog.apply(this,args);
        };
    }

    if(typeof showMonsterHit==="function"){
        const previousShowMonsterHit=showMonsterHit;
        showMonsterHit=function(index,amount,type){
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            const blockedShield=monster&&directPlayerBarrierContext
                ?directPlayerBarrierContext.blocked.get(monster)
                :null;
            if(!monster||type!=="hp"||(!isMonsterBarrier(monster)&&!blockedShield)){
                return previousShowMonsterHit.apply(this,arguments);
            }
            const shield=blockedShield||monster.v141Shield;
            const damage=Math.max(0,numeric(amount));
            const direct=directPlayerActionDepth>0||currentAnimationIsPlayerAttack();
            if(direct){
                monster.hp=Math.max(0,numeric(shield.baseHp))+
                    (monster.v141Shield===shield?Math.max(0,numeric(shield.remaining)):0);
                if(blockedShield){
                    const card=document.getElementById("battleMonster"+index);
                    if(card&&typeof showDamagePopup==="function"){
                        showDamagePopup(card,"格擋 "+Math.max(0,numeric(shield.remainingBlocks)),"shield");
                    }
                    return;
                }
                if(directPlayerBarrierContext){
                    directPlayerBarrierContext.blocked.set(monster,shield);
                }
                shield.remainingBlocks=Math.max(0,(numeric(shield.remainingBlocks)||5)-1);
                const card=document.getElementById("battleMonster"+index);
                if(card&&typeof showDamagePopup==="function"){ showDamagePopup(card,"格擋 "+shield.remainingBlocks,"shield"); }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",index,"barrier"); }
                addBattleLog(monster.name+"的結界抵擋直接傷害（剩餘"+shield.remainingBlocks+"次）。");
                if(shield.remainingBlocks<=0){ removeMonsterBarrier(monster); }
                syncMonsterBarrierText(index);
                return;
            }
            /* DOT bypasses Barrier without consuming a block. */
            shield.baseHp=Math.max(0,numeric(shield.baseHp)-damage);
            monster.hp=shield.baseHp+Math.max(0,numeric(shield.remaining));
            if(shield.baseHp<=0){ removeMonsterBarrier(monster); monster.hp=0; }
            return previousShowMonsterHit.apply(this,arguments);
        };
    }

    function syncMonsterBarrierText(index){
        const monster=typeof monsters!=="undefined"?monsters[index]:null;
        if(!isMonsterBarrier(monster)){ return; }
        const shield=monster.v141Shield;
        if(!Number.isFinite(Number(shield.remainingBlocks))){ shield.remainingBlocks=5; }
        const text=document.getElementById("battleMonsterHPText"+index);
        if(text){ text.textContent=Math.floor(numeric(shield.baseHp))+"/"+Math.floor(numeric(shield.baseMaxHP))+" 結界"+shield.remainingBlocks; }
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousSpecial=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(){
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    args[0]=String(message).replace("完全防護4回合","抵擋5次直接傷害，最多5回合");
                    return previousLog.apply(this,args);
                };
            }
            try{ return previousSpecial.apply(this,arguments); }
            finally{ if(previousLog){ addBattleLog=previousLog; } }
        };
    }

    /* ----- 8 / 9. A potion may target any valid ally; cards use the same reticle. ----- */
    function queuedPotionReservations(potionId){
        if(typeof queuedPlayerActions==="undefined"){ return 0; }
        return Object.keys(queuedPlayerActions||{}).reduce((sum,key)=>{
            const action=queuedPlayerActions[key];
            return sum+(action&&action.action==="potion"&&action.potionId===potionId?1:0);
        },0);
    }

    function validPotionTarget(potionId,index){
        const definition=typeof getPotionDefinition==="function"?getPotionDefinition(potionId):null;
        const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(index):null;
        if(!definition||!character||!stats||character.hp<=0){ return false; }
        return definition.resource==="hp"?character.hp<stats.maxHP:character.sp<stats.maxSP;
    }

    if(typeof getBattleActionDisplayName==="function"){
        const previousDisplayName=getBattleActionDisplayName;
        getBattleActionDisplayName=function(actionType){
            if(actionType===POTION_TARGET_ACTION){
                const pending=window.v143PendingPotionTarget;
                const definition=pending&&getPotionDefinition(pending.potionId);
                return definition?definition.name:"使用物品";
            }
            return previousDisplayName.apply(this,arguments);
        };
    }

    if(typeof usePotion==="function"){
        usePotion=function(potionId){
            const definition=getPotionDefinition(potionId);
            const autoOn=activeBattleCharacterIndex===0?autoBattle:getPartyAutoConfig(activeBattleCharacterIndex).enabled;
            const caster=getPartyCharacterByIndex(activeBattleCharacterIndex);
            if(!definition||!battleActive||autoOn||actionReady||!caster||caster.hp<=0){ return; }
            const available=getPotionCount(potionId)-queuedPotionReservations(potionId);
            if(available<=0){ addBattleLog(definition.name+"已被其他角色預定或沒有庫存。"); return; }
            const valid=(typeof getExistingPartyIndexes==="function"?getExistingPartyIndexes():[0,1,2])
                .filter(index=>validPotionTarget(potionId,index));
            if(!valid.length){ addBattleLog((definition.resource==="hp"?"所有存活角色HP":"所有存活角色SP")+"都已經是滿的。"); return; }
            actionReady=true;
            pendingAction=POTION_TARGET_ACTION;
            window.v143PendingPotionTarget={potionId:potionId,casterIndex:activeBattleCharacterIndex};
            closeMenus();
            const region=document.getElementById("battleActionRegion");
            if(region){ region.classList.add("target-selecting"); }
            const prompt=document.getElementById("battleTargetPromptAction");
            if(prompt){ prompt.textContent="選擇要使用［"+definition.name+"］的角色"; }
            currentBattleMonsters.forEach(index=>{
                const card=document.getElementById("battleMonster"+index);
                if(card){ card.classList.remove("targetable","target"); }
            });
            [0,1,2].forEach(index=>{
                const card=document.getElementById("battlePlayerCard"+index);
                if(card){ card.classList.toggle("ally-targetable",valid.indexOf(index)>=0); }
            });
            const targetText=document.getElementById("battleTarget");
            if(targetText){ targetText.textContent="目標：請選擇我方角色"; }
        };
    }

    if(typeof selectBattleAllyTarget==="function"){
        const previousSelectAlly=selectBattleAllyTarget;
        selectBattleAllyTarget=function(index){
            const pending=window.v143PendingPotionTarget;
            if(pendingAction!==POTION_TARGET_ACTION||!pending){ return previousSelectAlly.apply(this,arguments); }
            if(!battleActive||battlePhase!=="declare"||!actionReady||!validPotionTarget(pending.potionId,index)){ return; }
            actionReady=false;
            pendingAction=null;
            clearBattleTargetSelectionMode();
            queuedPlayerActions[pending.casterIndex]={
                action:"potion",potionId:pending.potionId,target:null,targetAlly:index
            };
            window.v143PendingPotionTarget=null;
            finishPlayerAction();
        };
    }

    if(typeof returnFromBattleTargetSelection==="function"){
        const previousReturnFromTarget=returnFromBattleTargetSelection;
        returnFromBattleTargetSelection=function(){
            const wasPotion=pendingAction===POTION_TARGET_ACTION;
            const result=previousReturnFromTarget.apply(this,arguments);
            if(wasPotion){ window.v143PendingPotionTarget=null; }
            return result;
        };
    }

    if(typeof applyPotionEffect==="function"){
        const previousApplyPotion=applyPotionEffect;
        applyPotionEffect=function(potionId,characterIndex){
            const queued=typeof queuedPlayerActions!=="undefined"&&queuedPlayerActions[characterIndex];
            const target=queued&&Number.isInteger(queued.targetAlly)?queued.targetAlly:characterIndex;
            window.v143LastPotionEffectTarget={index:target,at:Date.now()};
            const caster=getPartyCharacterByIndex(characterIndex);
            const receiver=getPartyCharacterByIndex(target);
            const definition=getPotionDefinition(potionId);
            const previousLog=typeof addBattleLog==="function"?addBattleLog:null;
            if(previousLog&&caster&&receiver&&characterIndex!==target){
                addBattleLog=function(message){
                    const args=Array.prototype.slice.call(arguments);
                    const expected=(receiver.id||"你")+"使用"+(definition&&definition.name||"");
                    if(String(args[0]).indexOf(expected)>=0){
                        args[0]=String(args[0]).replace(expected,(caster.id||"角色")+"對"+(receiver.id||"隊友")+"使用"+(definition&&definition.name||"物品"));
                    }
                    return previousLog.apply(this,args);
                };
            }
            try{ return previousApplyPotion.call(this,potionId,target); }
            finally{ if(previousLog&&caster&&receiver&&characterIndex!==target){ addBattleLog=previousLog; } }
        };
    }

    /* ----- 3. Escaping a dungeon restores the dungeon owner before routing. ----- */
    if(typeof resolveEscapeAttempt==="function"){
        const previousEscape=resolveEscapeAttempt;
        resolveEscapeAttempt=function(characterIndex){
            const run=window.v132ActiveDungeonRun;
            if(!run){ return previousEscape.apply(this,arguments); }
            clearInterval(timerId);
            timerId=null;
            const alive=currentBattleMonsters.map(index=>monsters[index]).filter(monster=>monster&&monster.alive);
            if(!alive.length){ checkBattleEnd(); return; }
            const highest=Math.max.apply(null,alive.map(monster=>monster.level));
            const character=getPartyCharacterByIndex(characterIndex)||player;
            const chance=Math.max(10,Math.min(95,50+(numeric(character.level)-highest)*5));
            if(Math.random()*100>=chance){ addBattleLog("逃脫失敗！"); finishPlayerAction(); return; }

            battleActive=false;
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            battleToken++;
            if(typeof battleAdvanceTimeoutId!=="undefined"&&battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId); battleAdvanceTimeoutId=null;
            }
            if(typeof battleAdvanceScheduled!=="undefined"){ battleAdvanceScheduled=false; }
            closeMenus();
            if(window.v142SkillAnimationDirector){ window.v142SkillAnimationDirector.dispose(); }
            document.querySelectorAll("#v141BattleTransition,.v141-battle-transition").forEach(node=>node.classList.remove("show"));
            const battlePage=document.getElementById("battlePage");
            if(battlePage){ battlePage.classList.remove("preparing","v141-exiting"); }
            monsters=run.previousMonsters;
            currentZone=run.previousZone;
            window.v132ActiveDungeonRun=null;
            addBattleLog("成功從副本脫逃！");
            if(typeof saveGame==="function"){ saveGame(); }
            setTimeout(()=>{
                if(typeof run.onComplete==="function"){ run.onComplete({result:"escape"}); }
                else{
                    showPage("dungeon");
                    if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
                }
            },260);
        };
    }

    /* ----- 4 / 5. Larger Abyss, tap-to-advance dialogue and correct nav shell. ----- */
    function fixDungeonNavigation(){
    const nav=document.getElementById("v141DungeonNav");
    const content=document.getElementById("game-content");
    if(!nav||!content){ return; }
    if(nav.parentElement!==content){ content.appendChild(nav); }
    nav.dataset.v143Fixed="1";
    const oldReturn=document.getElementById("v141DungeonReturn");
    if(oldReturn){ oldReturn.remove(); }
    if(typeof window.v148SyncDungeonShell==="function"){ window.v148SyncDungeonShell(); }
}


/* ----- 6. Synthesis uses icon pickers and creates ordinary random gear. ----- */
    function definitions(){
        return window.v132GetContentDefinitions?window.v132GetContentDefinitions():{ores:[],talismans:[]};
    }
    function countItem(itemId){
        return (typeof inventoryItems!=="undefined"?inventoryItems:[]).reduce((sum,item)=>
            sum+(item&&item.id===itemId?Math.max(0,numeric(item.count)):0),0
        );
    }
    function rollUniform(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
    function rollNormalAffixes(tier){
        if(typeof window.v141RollCraftAffixes==="function"){ return window.v141RollCraftAffixes(tier,false); }
        const meta=TIER_META[normalizeTierKey(tier)];
        const stats={};
        stats[STAT_KEYS[Math.floor(Math.random()*STAT_KEYS.length)]]=rollUniform(meta.main[0],meta.main[1]);
        if(meta.sub){ stats[SUBSTAT_KEYS[Math.floor(Math.random()*SUBSTAT_KEYS.length)]]=rollUniform(meta.sub[0],meta.sub[1]); }
        return stats;
    }
    function synthesisResult(item){
        if(!window.v132ShowRewardModal){ return; }
        const labels={attack:"攻擊",intelligence:"智力",vitality:"體質",energy:"能量",agility:"敏捷",spirit:"精神"};
        const stats=Object.keys(item.stats||{}).map(key=>'<span>'+labels[key]+' <b>+'+item.stats[key]+'</b></span>').join("");
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>合成成功</h3><div class="v141-result-item">'+item.icon+'<b>'+escapeHtml(item.name)+'</b>'+stats+'</div><p>此為系統隨機生成的普通裝備，不屬於四大套裝。</p><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">確定</button></div></div>');
    }

    window.v141CraftEquipment=function(){
        const select=document.querySelector(".v141-synthesis-body select");
        const blueprint=select&&(inventoryItems||[]).find(item=>item&&item.id===select.value&&item.blueprintSlot);
        if(!blueprint){ return; }
        const tier=normalizeTierKey(blueprint.tierKey);
        const meta=TIER_META[normalizeTierKey(tier)];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const ore=definitions().ores.find(item=>item.tierKey===tier);
        if(!meta||meta.available===false||!ore||countItem(blueprint.id)<50||countItem(ore.id)<50||numeric(gold)<meta.craftGold){ alert("素材或金幣不足。"); return; }
        const item={
            id:"normal_crafted_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
            v141Uid:"gear_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
            name:NORMAL_GEAR_PREFIXES[Math.floor(Math.random()*NORMAL_GEAR_PREFIXES.length)]+meta.label+slot.label,
            icon:svgIcon(slot.glyph,meta.color),type:slot.type,tierKey:tier,levelRequirement:1,
            price:0,count:1,stats:rollNormalAffixes(tier),reforgeStats:null,
            v141Crafted:true,v143NormalCraft:true
        };
        delete item.setId;
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return; }
        const transaction=window.v132RunInventoryTransaction||function(operation){ return !!operation(); };
        const success=transaction(()=>
            window.v132ConsumeStackItem(blueprint.id,50)&&
            window.v132ConsumeStackItem(ore.id,50)&&
            window.v132AddItemToInventory(item,1)
        );
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=meta.craftGold;
        rebuildInventorySlots(); updateGoldDisplay(); saveGame();
        window.v141RenderSynthesis();
        synthesisResult(item);
    };

    function allEquipment(){
        const result=[];
        (inventoryItems||[]).forEach(item=>{ if(item&&item.v141Uid){ result.push(item); } });
        Object.values(typeof characterEquipment!=="undefined"&&characterEquipment||{}).forEach(slots=>
            Object.values(slots||{}).forEach(item=>{ if(item&&item.v141Uid){ result.push(item); } })
        );
        return result;
    }
    function iconForPickerValue(value){
        const content=definitions();
        const item=(inventoryItems||[]).find(candidate=>candidate&&(candidate.id===value||candidate.v141Uid===value))||
            allEquipment().find(candidate=>candidate.v141Uid===value)||
            (content.talismans||[]).find(candidate=>candidate.id===value);
        if(item&&item.assetPath){
            const rarity=escapeHtml(normalizeTierKey(item.rarityKey||item.quality||item.tierKey||"white"));
            return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+'"><img src="'+escapeHtml(item.assetPath)+'" alt="" draggable="false" decoding="async"></span>';
        }
        return item&&item.icon?item.icon:svgIcon("物","#caa461");
    }

    function decorateSynthesis(){
        const root=document.querySelector(".v141-synthesis");
        if(!root){ return; }
        root.classList.add("v143-synthesis");
        root.querySelectorAll("label").forEach(label=>{
            const select=label.querySelector("select");
            if(!select||label.querySelector(".v143-item-picker")){ return; }
            if(/系列/.test(label.textContent)&&!/選擇裝備/.test(label.textContent)){ label.hidden=true; return; }
            const picker=document.createElement("div");
            picker.className="v143-item-picker";
            Array.from(select.options).forEach(option=>{
                const button=document.createElement("button");
                button.type="button";
                button.className=option.value===select.value?"selected":"";
                button.setAttribute("aria-label",option.textContent);
                button.innerHTML='<i>'+iconForPickerValue(option.value)+'</i><span>'+escapeHtml(option.textContent)+'</span>';
                button.onclick=()=>{
                    select.value=option.value;
                    select.dispatchEvent(new Event("change",{bubbles:true}));
                };
                picker.appendChild(button);
            });
            select.hidden=true;
            select.insertAdjacentElement("afterend",picker);
        });
        const series=root.querySelector(".v141-blueprint-series");
        if(series){ series.innerHTML="<span>2　合成結果</span><b>系統隨機普通裝備</b>"; }
        const preview=root.querySelector(".v141-craft-preview");
        if(preview){
            const icon=preview.querySelector(".v141-craft-icon");
            const text=preview.querySelector("div:last-child");
            if(icon){ icon.innerHTML=svgIcon("鍛","#d1ad69"); }
            if(text){ text.innerHTML="<b>隨機普通裝備</b><span>依圖紙部位與階級生成；不會產出赤炎、寒泉、岩岳、青嵐套裝。</span>"; }
        }
    }

    if(typeof MutationObserver!=="undefined"){
        const observer=new MutationObserver(()=>{
            if(document.querySelector(".v141-synthesis")&&!document.querySelector(".v141-synthesis.v143-synthesis")){
                requestAnimationFrame(decorateSynthesis);
            }
        });
        const startObserver=()=>observer.observe(document.body,{childList:true,subtree:true});
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",startObserver,{once:true}); }
        else{ startObserver(); }
    }

    if(typeof window.v141RenderSynthesis==="function"){
        const previousRenderSynthesis=window.v141RenderSynthesis;
        window.v141RenderSynthesis=function(){
            const result=previousRenderSynthesis.apply(this,arguments);
            decorateSynthesis();
            return result;
        };
    }

    /* Shared lifecycle keeps the patched DOM healthy after page switches. */
    if(typeof showPage==="function"){
        const previousShowPage=showPage;
        showPage=function(page){
            const result=previousShowPage.apply(this,arguments);
            if(page==="dungeon"){ setTimeout(fixDungeonNavigation,0); }
            if(page==="battle"){ setTimeout(()=>{ decorateEnemyCards(); syncEarthShieldEffects(); },0); }
            return result;
        };
    }
    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            decorateEnemyCards(); syncEarthShieldEffects();
            return result;
        };
    }

    function boot(){
        fixDungeonNavigation();
        decorateEnemyCards();
        syncEarthShieldEffects();
        decorateSynthesis();
    }
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",boot,{once:true}); }
    else{ setTimeout(boot,0); }

    window.v143SystemDiagnostics=function(){
        return {
            version:VERSION,
            enemyCards:document.querySelectorAll(".v143-monster-identity").length,
            dungeonNavFixed:document.getElementById("v141DungeonNav")?.dataset.v143Fixed==="1",
            pendingPotion:!!window.v143PendingPotionTarget
        };
    };
})();


/* bundled source: js/39-v143-skill-animation.js */
/* =====================================================
   V143 — single-owner raster battle VFX runtime
   V174 cleanup: official PNG Sprite Sheets/status loops only.
   Fixed Slot geometry is the only battle position/coverage source.
   No Canvas, SVG, WebGL, shader, particle, glyph or procedural fallback.
===================================================== */
(function installV143SkillAnimationRuntime(){
    "use strict";

    if(typeof window==="undefined"||window.__v143SkillAnimationInstalled){ return; }
    if(!window.v142SkillAnimationDirector){ return; }
    window.__v143SkillAnimationInstalled=true;

    const VERSION="174-slot-geometry-owner";
    const DEFAULT_HIT=.5833333333;
    let blockedManifestWrites=0;
    let blockedDirectorOverrides=0;
    let blockedCardEffectOverrides=0;
    const failedAssets=new Set();
    const SPRITE_SCALE_MULTIPLIER=1;
    /* Size the raster box before centering/travel. CSS independent scale also
       scales translate(-50%) and the travel vector, moving the visible hit. */
    const PLACEMENT_SIZE_SCALE=Object.freeze({single:.88,targetTrajectory:.80,trajectory:1,group:1,battlefield:1});
    const spriteFrameAspectCache=new Map();
    const spriteFrameAspectLoading=new Set();

    function castSheet(src,placement,options){
        return Object.assign({
            src:src,columns:4,rows:3,frames:12,hitFrame:7,
            placement:placement||"single",renderer:"dom-sprite"
        },options||{});
    }

    function statusVisual(src,mode,collection,options){
        return Object.assign({
            src:src||"",
            mode:mode||"static",
            collection:collection||"statusEffects",
            cropColumns:1,
            cropRows:1,
            renderer:"dom-status-visual"
        },options||{});
    }

    function relicSheet(src,hitFrame,options){
        const frame=Math.max(1,Math.min(12,Math.floor(Number(hitFrame)||7)));
        const frameIndex=frame-1;
        return {
            hit:frameIndex/12,
            authoredHitFrame:frame,
            lazyAsset:true,
            sprite:castSheet(src,"single",Object.assign({
                hitFrame:frameIndex,scale:2.05,maxSize:280
            },options||{}))
        };
    }

    const RAW_MANIFEST={
        normal:{hit:.57,noVisual:true},

        flameSlash:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/flame-slash-cast.png","single",{scale:1.85,maxSize:220})},
        fireCritical:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-critical-cast.png?v=165","single",{scale:2.15,maxSize:260})},
        fireBurstStrike:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-critical-cast.png?v=165","single",{scale:2.15,maxSize:260,reusedFrom:"fireCritical"})},
        explosiveFlurry:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/explosive-flurry-cast.png?v=165","group",{scale:1.08,minSize:190,alignToSlots:true})},
        dragonSlash:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/dragon-slash-cast.png?v=165","single",{scale:2.35,maxSize:300})},
        fireRocket:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/fire-rocket-cast.png?v=165","trajectory",{travelToTargets:true,scale:.72,minSize:180,maxSize:280})},
        blazeSpell:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/blaze-spell-cast.png?v=165","single",{scale:2.15,maxSize:260})},
        flameTornado:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/flame-tornado-cast.png?v=165","single",{scale:2.35,maxSize:300})},
        phoenixCry:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/phoenix-cry-cast.png?v=165","battlefield",{scale:1.12,minSize:280})},
        rage:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/fire/rage-cast.png?v=165","single",{scale:1.08,minSize:96,maxSize:148})},
        fireSoulResonance:{hit:DEFAULT_HIT,deferredActorStatusTypes:["fireSoulResonance"],sprite:castSheet("assets/vfx/fire/fire-soul-resonance-cast.webp","single",{scale:1.7,maxSize:225})},
        bloodBurnArt:{hit:DEFAULT_HIT,deferredActorStatusTypes:["bloodBurn"],sprite:castSheet("assets/vfx/fire/blood-burn-art-cast.webp","single",{scale:1.7,maxSize:225})},
        fireEX:{hit:.74,noVisual:true,passive:true},

        waterKnife:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-blade-slash-vfx.png?v=166","single",{scale:2.05,maxSize:250})},
        frostPunch:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/frost-fist-vfx.png?v=166","single",{scale:2.15,maxSize:260})},
        iceSpin:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/frost-spinning-slash-vfx.png?v=166","single",{scale:1.95,maxSize:235})},
        frostCrush:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/freeze-heavy-strike-vfx.png?v=166","single",{scale:2.35,maxSize:290})},
        waterBall:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-orb-vfx.png?v=173.19","group",{scale:1.22,minSize:150,maxSize:500,alignToSlots:true})},
        floodBeast:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/tidal-beast-vfx.png?v=166","targetTrajectory",{travelToTargets:true,scale:1.85,minSize:175,maxSize:250})},
        iceArrowRain:{hit:DEFAULT_HIT,deferredStatusTypes:["frostbite"],sprite:castSheet("assets/vfx/water/frost-arrow-rain-vfx.png?v=173.19","battlefield",{fixedFormation:true,coverageScale:1.22,minWidth:140,minHeight:140})},
        freeze:{hit:DEFAULT_HIT,deferredStatusTypes:["freeze"],sprite:castSheet("assets/vfx/water/freeze-cast-vfx.png?v=166","single",{scale:2.2,maxSize:270})},
        healSpell:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-heal-vfx.png?v=166","single",{scale:2.05,maxSize:250})},
        revive:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/water-revive-vfx.png?v=166","single",{scale:2.3,maxSize:285})},
        purifyMind:{hit:DEFAULT_HIT,sprite:castSheet("assets/vfx/water/purify-mind-cast.webp","single",{scale:2.05,maxSize:250})},
        waterEX:{hit:.74,noVisual:true,passive:true},

        stormFist:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/vfx/wind/storm-fist-cast.png?v=173.24","single",{scale:2.15,maxSize:260})},
        stormFlurry:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/storm-flurry-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        windCrossSlash:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/wind-cross-slash-cast.png?v=173.24","single",{scale:2.25,maxSize:280})},
        dizzyFist:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/vfx/wind/dizzy-fist-cast.png?v=173.24","single",{scale:2.35,maxSize:290})},
        windSpell:{hit:.5,deferredStatusTypes:["agilityDown"],sprite:castSheet("assets/vfx/wind/wind-spell-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stormCircle:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/storm-circle-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        windHowlLightning:{hit:.5,deferredStatusTypes:["damageDown"],sprite:castSheet("assets/vfx/wind/wind-howl-lightning-cast.png?v=173.24","single",{scale:2.35,maxSize:290})},
        stormRain:{hit:.5,deferredStatusTypes:["stun"],sprite:castSheet("assets/vfx/wind/storm-rain-cast.png?v=173.24","battlefield",{scale:1.08,minSize:280})},
        dodgeSkill:{hit:.5,deferredStatusTypes:["dodgeSkill"],sprite:castSheet("assets/vfx/wind/dodge-skill-cast.png?v=173.24","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stealthSkill:{hit:.5,deferredStatusTypes:["stealthSkill"],sprite:castSheet("assets/vfx/wind/stealth-skill-cast.png?v=173.24","single",{scale:2.15,maxSize:260})},
        dinghaishenzhen:{hit:.5,deferredStatusTypes:["dinghaishenzhen"],sprite:castSheet("assets/vfx/wind/dinghaishenzhen-cast.png?v=173.24","battlefield",{scale:1.08,minSize:280})},
        windEX:{hit:.74,noVisual:true,passive:true},
        /* Monster-only legacy derivative: use an existing formal Wind sheet,
           never a generated text/particle fallback. */
        stormSpell:{hit:.5,sprite:castSheet("assets/vfx/wind/storm-rain-cast.png?v=173.24","battlefield",{scale:1.08,minSize:280,reusedFrom:"stormRain"})},
        windArrow:{hit:.5,sprite:castSheet("assets/vfx/wind/wind-spell-cast.png?v=173.24","targetTrajectory",{travelToTargets:true,scale:1.8,minSize:150,maxSize:230,reusedFrom:"windSpell"})},

        stoneSlash:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/stone-slash-cast.png?v=173.39","single",{scale:2.2,maxSize:270})},
        petrifyFist:{hit:.5,deferredActorStatusTypes:["shield"],sprite:castSheet("assets/vfx/earth/petrify-fist-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stoneBreakSky:{hit:.5,deferredActorStatusTypes:["shield"],sprite:castSheet("assets/vfx/earth/stone-break-sky-cast.png?v=173.39","single",{scale:2.35,maxSize:290})},
        earthquakeCrush:{hit:.5,deferredStatusTypes:["petrify"],sprite:castSheet("assets/vfx/earth/earthquake-crush-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        stoneThrow:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/stone-throw-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        sandWind:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/sand-wind-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true,preserveSourceAspect:true})},
        flyingSandStrike:{hit:.5,deferredStatusTypes:["defenseDown"],sprite:castSheet("assets/vfx/earth/flying-sand-strike-cast.png?v=173.39","battlefield",{scale:1.08,minSize:280})},
        dustStorm:{hit:.5,deferredStatusTypes:["petrify"],sprite:castSheet("assets/vfx/earth/dust-storm-cast.png?v=173.39","single",{scale:2.4,maxSize:300})},
        earthShield:{hit:.5,deferredStatusTypes:["earthShield"],sprite:castSheet("assets/vfx/earth/earth-shield-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        rockWall:{hit:.5,deferredStatusTypes:["rockWall"],sprite:castSheet("assets/vfx/earth/rock-wall-cast.png?v=173.39","group",{scale:1.08,minSize:190,alignToSlots:true})},
        barrier:{hit:.5,deferredStatusTypes:["barrier"],sprite:castSheet("assets/vfx/earth/barrier-cast.png?v=173.39","single",{scale:2.25,maxSize:280})},
        earthEX:{hit:.74,noVisual:true,passive:true},

        /* Team Relic VFX — 4x3 / 12-frame lossless WebP sheets.
           These are lazy because only the equipped relic should be prefetched. */
        relic_qiankun_flask:relicSheet("assets/vfx/relic/relic_qiankun_flask.webp",7),
        relic_sun_orb:relicSheet("assets/vfx/relic/relic_sun_orb.webp",7),
        relic_xuanwu_seal:relicSheet("assets/vfx/relic/relic_xuanwu_seal.webp",8),
        relic_soul_bell:relicSheet("assets/vfx/relic/relic_soul_bell.webp",8),
        relic_tiangang_banner:relicSheet("assets/vfx/relic/relic_tiangang_banner.webp",9),
        relic_nine_dragon_fire:relicSheet("assets/vfx/relic/relic_nine_dragon_fire.webp",8),
        relic_cold_spring_jade:relicSheet("assets/vfx/relic/relic_cold_spring_jade.webp",7),
        relic_qinglan_feather:relicSheet("assets/vfx/relic/relic_qinglan_feather.webp",6),
        relic_rock_mountain_seal:relicSheet("assets/vfx/relic/relic_rock_mountain_seal.webp",7),
        relic_returning_wheel:relicSheet("assets/vfx/relic/relic_returning_wheel.webp",7),
        relic_origin_talisman:relicSheet("assets/vfx/relic/relic_origin_talisman.webp",7),
        relic_broken_army_scroll:relicSheet("assets/vfx/relic/relic_broken_army_scroll.webp",8),
        relic_red_sky_war_mark:relicSheet("assets/vfx/relic/relic_red_sky_war_mark.webp",7),
        relic_ice_mirror_heart:relicSheet("assets/vfx/relic/relic_ice_mirror_heart.webp",6),
        relic_wind_chasing_talisman:relicSheet("assets/vfx/relic/relic_wind_chasing_talisman.webp",6),
        relic_mountain_river_cauldron:relicSheet("assets/vfx/relic/relic_mountain_river_cauldron.webp",7),
        relic_burning_star_mark:relicSheet("assets/vfx/relic/relic_burning_star_mark.webp",7),
        relic_spirit_spring_bottle:relicSheet("assets/vfx/relic/relic_spirit_spring_bottle.webp",6),
        relic_demon_suppressing_seal:relicSheet("assets/vfx/relic/relic_demon_suppressing_seal.webp",6),
        relic_all_returning_array:relicSheet("assets/vfx/relic/relic_all_returning_array.webp",8),

        /* These Light support skills currently have no dedicated finished cast
           sheet. Their battle timing remains valid, but there is deliberately
           no procedural substitute. */
        yuanXiangGuangMing:{hit:.5,noVisual:true,missingDedicatedAsset:true},
        yuanGuangShield:{hit:.5,noVisual:true,missingDedicatedAsset:true},
        yuanZuBlessing:{hit:.5,deferredStatusTypes:["yuanZuBlessing"],sprite:castSheet("assets/vfx/light/yuan-zu-blessing-cast.png?v=173.39","battlefield",{scale:1.08,minSize:280})}
    };

    const RAW_STATUS_VISUALS={
        burn:statusVisual("assets/vfx/status/burn.webp","pulse","statusEffects",{label:"燃燒",statusName:"燃燒",iconSrc:"assets/vfx/status/burn.webp"}),
        rage:statusVisual("assets/vfx/status/rage.webp","pulse","activeBuffs",{label:"怒火",statusName:"怒火",iconSrc:"assets/vfx/status/rage-icon.webp"}),
        frostbite:statusVisual("","icon","statusEffects",{label:"凍傷",statusName:"凍傷",iconSrc:"assets/vfx/status/frostbite-icon.webp"}),
        freeze:statusVisual("assets/vfx/status/freeze.webp","static","statusEffects",{label:"冰封",statusName:"冰封",iconSrc:"assets/vfx/status/freeze.webp"}),
        agilityDown:statusVisual("","icon","statusEffects",{label:"重力",statusName:"重力",iconSrc:"assets/vfx/status/gravity-icon.webp"}),
        damageDown:statusVisual("","icon","statusEffects",{label:"殤風",statusName:"殤風",iconSrc:"assets/vfx/status/damage-down-icon.webp"}),
        stun:statusVisual("assets/vfx/status/stun.webp","pulse","statusEffects",{label:"暈眩",statusName:"暈眩",iconSrc:"assets/vfx/status/stun-icon.webp"}),
        dodgeSkill:statusVisual("assets/vfx/status/windwalk.webp","pulse","activeBuffs",{label:"風行",statusName:"風行",iconSrc:"assets/vfx/status/windwalk.webp"}),
        stealthSkill:statusVisual("assets/vfx/status/stealth.webp","static","activeBuffs",{label:"隱身",statusName:"隱身",iconSrc:"assets/vfx/status/stealth.webp"}),
        dinghaishenzhen:statusVisual("assets/vfx/status/calm-mind.webp","pulse","activeBuffs",{label:"氣定神閒",statusName:"氣定神閒",iconSrc:"assets/vfx/status/calm-mind.webp"}),
        defenseDown:statusVisual("","icon","statusEffects",{label:"破防",statusName:"破防",iconSrc:"assets/vfx/status/defense-down-icon.webp"}),
        shield:statusVisual("assets/vfx/status/shield.webp","static","activeBuffs",{label:"護盾",statusName:"岩盾",iconSrc:"assets/vfx/status/shield.webp"}),
        petrify:statusVisual("assets/vfx/status/petrify.webp","static","statusEffects",{label:"石化",statusName:"石化",iconSrc:"assets/vfx/status/petrify.webp"}),
        earthShield:statusVisual("assets/vfx/status/earth-shield.webp","static","activeBuffs",{label:"萬象土盾",statusName:"萬象土盾",iconSrc:"assets/vfx/status/earth-shield.webp"}),
        rockWall:statusVisual("assets/vfx/status/rock-wall.webp","static","activeBuffs",{label:"岩石壁壘",statusName:"岩石壁壘",iconSrc:"assets/vfx/status/rock-wall.webp"}),
        barrier:statusVisual("assets/vfx/status/barrier.webp","static","activeBuffs",{label:"結界",statusName:"結界",iconSrc:"assets/vfx/status/barrier.webp"}),
        yuanZuBlessing:statusVisual("assets/vfx/status/yuan-zu-blessing.webp","pulse","activeBuffs",{label:"元祖賜福",statusName:"元祖賜福",iconSrc:"assets/vfx/status/yuan-zu-blessing.webp"}),
        fireMomentum:statusVisual("","icon","activeBuffs",{label:"炎勢",statusName:"炎勢",iconSrc:"assets/vfx/status/fire-momentum-icon.webp"}),
        phoenixMight:statusVisual("","icon","activeBuffs",{label:"鳳威",statusName:"鳳威",iconSrc:"assets/vfx/status/phoenix-might-icon.webp"}),
        fireSoulResonance:statusVisual("assets/vfx/status/fire-soul-resonance.webp","pulse","activeBuffs",{label:"炎魂共鳴",statusName:"炎魂共鳴",iconSrc:"assets/vfx/status/fire-soul-resonance.webp"}),
        bloodBurn:statusVisual("assets/vfx/status/blood-burn.webp","pulse","activeBuffs",{label:"焚血",statusName:"焚血",iconSrc:"assets/vfx/status/blood-burn.webp"})
    };

    function protectObject(value,label){
        if(!value||typeof value!=="object"||typeof Proxy!=="function"){ return value; }
        return new Proxy(value,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        });
    }

    Object.keys(RAW_MANIFEST).forEach(id=>{
        const model=RAW_MANIFEST[id];
        if(model.sprite){ model.sprite=protectObject(model.sprite,"sprite:"+id); }
        RAW_MANIFEST[id]=protectObject(model,"model:"+id);
    });
    Object.keys(RAW_STATUS_VISUALS).forEach(type=>{
        RAW_STATUS_VISUALS[type]=protectObject(RAW_STATUS_VISUALS[type],"status:"+type);
    });

    const MANIFEST=typeof Proxy==="function"
        ?new Proxy(RAW_MANIFEST,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        })
        :RAW_MANIFEST;
    const STATUS_VISUALS=typeof Proxy==="function"
        ?new Proxy(RAW_STATUS_VISUALS,{
            set:function(){ blockedManifestWrites++; return true; },
            deleteProperty:function(){ blockedManifestWrites++; return true; },
            defineProperty:function(){ blockedManifestWrites++; return true; }
        })
        :RAW_STATUS_VISUALS;

    window.v143SkillAnimationManifest=MANIFEST;
    window.v143StatusVisualManifest=STATUS_VISUALS;
    window.v143GetSkillAnimationModel=function(skillId){
        return MANIFEST[skillId]||{hit:DEFAULT_HIT,noVisual:true,missingAsset:true,signature:"missing-"+String(skillId||"unknown")};
    };

    function preflightAsset(source){
        if(!source||typeof Image!=="function"){ return; }
        const image=new Image();
        image.decoding="async";
        image.onerror=function(){ failedAssets.add(String(source)); };
        image.src=source;
    }
    Object.keys(RAW_MANIFEST).forEach(id=>{
        const model=RAW_MANIFEST[id];
        const sprite=model&&model.sprite;
        if(sprite&&sprite.src&&!model.lazyAsset){ preflightAsset(sprite.src); }
    });
    Object.keys(RAW_STATUS_VISUALS).forEach(type=>{
        const source=RAW_STATUS_VISUALS[type]&&RAW_STATUS_VISUALS[type].src;
        if(source){ preflightAsset(source); }
    });
    window.v143PreloadBattleVfxAsset=function(effectId){
        const model=MANIFEST[effectId];
        const sprite=model&&model.sprite;
        if(!sprite||!sprite.src){ return false; }
        preflightAsset(sprite.src);
        return true;
    };

    const director=window.v142SkillAnimationDirector;
    const originalPlay=director.play.bind(director);
    const originalDispose=director.dispose.bind(director);
    const state={
        version:VERSION,current:null,stage:null,timers:new Set(),pendingUpdates:new Map(),
        metrics:{started:0,completed:0,missingVisuals:0,legacyNodesPurged:0,delayedNumbers:0,delayedDeaths:0}
    };
    window.v143SkillAnimationState=state;

    function setTimer(callback,delay){
        const id=setTimeout(()=>{ state.timers.delete(id); callback(); },Math.max(0,Number(delay)||0));
        state.timers.add(id);
        return id;
    }

    function clearTimers(){
        state.timers.forEach(id=>clearTimeout(id));
        state.timers.clear();
        state.pendingUpdates.clear();
    }

    function purgeLegacyCardVfx(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        let removed=0;
        document.querySelectorAll(".v141-card-effects,#v142-skill-stage").forEach(node=>{
            if(node&&typeof node.remove==="function"){ node.remove(); removed++; }
        });
        state.metrics.legacyNodesPurged+=removed;
    }

    function purgeStaleRasterStages(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        document.querySelectorAll("#v143-skill-stage").forEach(node=>{
            if(node!==state.stage&&node&&typeof node.remove==="function"){ node.remove(); }
        });
    }

    function cardFor(side,index){
        if(typeof document==="undefined"){ return null; }
        return document.getElementById(side==="monster"?"battleMonster"+index:"battlePlayerCard"+index);
    }

    function entityFor(side,index){
        if(side==="monster"){
            return typeof monsters!=="undefined"&&monsters?monsters[index]:null;
        }
        return typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
    }

    function canReceive(config,side,index){
        const entity=entityFor(side,index);
        if(!entity){ return false; }
        if(String(config&&config.category||"")==="revive"){
            return Number(entity.hp)<=0||entity.alive===false;
        }
        return Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false);
    }

    function geometryOwner(){
        const owner=window.FourSymbolsBattlefieldSlots;
        return owner&&typeof owner.getSlotRect==="function"?owner:null;
    }

    function slotForTarget(side,index,card){
        const owner=geometryOwner();
        if(!owner){ return null; }
        let slot=typeof owner.getSlotForCombatant==="function"?owner.getSlotForCombatant(side,index):null;
        if(!slot&&typeof owner.getSlotFromElement==="function"){
            slot=owner.getSlotFromElement(card||cardFor(side,index));
        }
        return slot||null;
    }

    function slotAnchor(side,index,card){
        const boss=window.FourSymbolsBossBattle;
        if(side==="monster"&&boss&&typeof boss.getTargetGeometry==="function"){
            const targetRect=boss.getTargetGeometry(index);
            if(targetRect){
                return {slot:isBossIndexForVfx(index)?"BOSS_FOOTPRINT":slotForTarget(side,index,card),x:targetRect.centerX,y:targetRect.centerY,rect:targetRect};
            }
        }
        const owner=geometryOwner();
        const slot=slotForTarget(side,index,card);
        if(!owner||!slot){ return null; }
        const center=typeof owner.getSlotCenter==="function"?owner.getSlotCenter(slot):null;
        const rect=center&&center.rect?center.rect:owner.getSlotRect(slot);
        if(!center||!rect){ return null; }
        return {slot:slot,x:center.x,y:center.y,rect:rect};
    }

    function isBossIndexForVfx(index){
        const boss=window.FourSymbolsBossBattle;
        return !!(boss&&typeof boss.isBossIndex==="function"&&boss.isBossIndex(index));
    }

    function activeCards(side,config){
        const cards=[];
        const indexes=side==="monster"&&typeof currentBattleMonsters!=="undefined"
            ?currentBattleMonsters.filter(Number.isInteger)
            :[0,1,2,3,4,5];
        indexes.forEach(index=>{
            const card=cardFor(side,index);
            if(card&&card.offsetParent!==null&&canReceive(config,side,index)){ cards.push({index:index,card:card}); }
        });
        return cards;
    }

    function targetSideFor(config,side){
        const ally=/ally/i.test(String(config.targetType||""))||/heal|revive|buff/.test(String(config.category||""));
        return ally?side:(side==="player"?"monster":"player");
    }

    function initialTargetIndexes(config,meta,targetSide){
        const explicit=Array.isArray(meta.targetIds)
            ?meta.targetIds
            :(meta.targetId!==undefined&&meta.targetId!==null?[meta.targetId]:[]);
        return Array.from(new Set(explicit.filter(index=>
            Number.isInteger(index)&&canReceive(config,targetSide,index)
        )));
    }

    function geometrySeedIndexes(current,indexes){
        if(Array.isArray(current&&current.targetIds)&&current.targetIds.length){ return current.targetIds.slice(); }
        if(current&&current.targetId!==undefined&&current.targetId!==null){ return [current.targetId]; }
        return Array.isArray(indexes)?indexes.slice():[];
    }

    function geometryPrimarySlot(current,indexes){
        const owner=geometryOwner();
        if(!owner||!current){ return null; }
        const seed=geometrySeedIndexes(current,indexes);
        const candidates=[];
        if(current.targetId!==undefined&&current.targetId!==null){ candidates.push(current.targetId); }
        seed.forEach(value=>candidates.push(value));
        for(const value of candidates){
            const slot=slotForTarget(current.targetSide,value,cardFor(current.targetSide,value));
            if(slot){ return slot; }
        }
        return null;
    }

    function geometryPrimaryAnchor(current,indexes){
        const seed=geometrySeedIndexes(current,indexes);
        const primary=current&&current.targetId!==undefined&&current.targetId!==null
            ?current.targetId:(seed.length?seed[0]:null);
        if(current&&current.targetSide==="monster"&&Number.isInteger(primary)){
            const boss=window.FourSymbolsBossBattle;
            const targetRect=boss&&typeof boss.getTargetGeometry==="function"?boss.getTargetGeometry(primary):null;
            if(targetRect){
                return {slot:isBossIndexForVfx(primary)?"BOSS_FOOTPRINT":slotForTarget("monster",primary,cardFor("monster",primary)),x:targetRect.centerX,y:targetRect.centerY,rect:targetRect};
            }
        }
        const owner=geometryOwner();
        const slot=geometryPrimarySlot(current,indexes);
        if(!owner||!slot){ return null; }
        const center=typeof owner.getSlotCenter==="function"?owner.getSlotCenter(slot):null;
        const rect=center&&center.rect?center.rect:owner.getSlotRect(slot);
        if(!rect){ return null; }
        return {
            slot:slot,
            x:center?center.x:rect.centerX,
            y:center?center.y:rect.centerY,
            rect:rect
        };
    }

    function geometryBounds(current,indexes,placement){
        const owner=geometryOwner();
        if(!owner||!current){ return null; }
        const seed=geometrySeedIndexes(current,indexes);
        const targetType=String(current.config&&current.config.targetType||"single");
        if(placement==="battlefield"||targetType==="all"||targetType==="allyAll"){
            const rect=typeof owner.getSideRect==="function"?owner.getSideRect(current.targetSide):null;
            if(rect){ rect.id=current.targetSide==="monster"?"fixed-enemy-zone":"fixed-ally-zone"; }
            return rect;
        }
        const primarySlot=geometryPrimarySlot(current,indexes);
        if(!primarySlot){ return null; }

        let shape=targetType;
        if(!/^(single|all|allyAll|row|column|tri|horizontal-3|allyTri)$/i.test(shape)){
            shape=placement==="group"||placement==="trajectory"?(current.targetSide==="player"?"all":"row"):"single";
        }
        const rect=typeof owner.getGeometryRectFromShape==="function"
            ?owner.getGeometryRectFromShape(current.targetSide,primarySlot,shape)
            :owner.getSlotRect(primarySlot);
        if(rect){
            const anchor=geometryPrimaryAnchor(current,indexes);
            if(anchor&&isBossIndexForVfx(current.targetId)&&!/^all$/i.test(shape)){
                rect.left=anchor.x-rect.width/2;
                rect.right=anchor.x+rect.width/2;
                rect.top=anchor.y-rect.height/2;
                rect.bottom=anchor.y+rect.height/2;
                rect.centerX=anchor.x;
                rect.centerY=anchor.y;
            }
            rect.id="fixed-slot-"+String(shape).toLowerCase();
        }
        return rect;
    }

    function placementFor(config,sprite){
        const authored=String(sprite&&sprite.placement||"single");
        const targetType=String(config&&config.targetType||"single");
        if(/^(all|enemyAll|allyAll)$/i.test(targetType)){ return "battlefield"; }
        if(/^(tri|allyTri|row|column|horizontal-3)$/i.test(targetType)){
            return authored==="trajectory"?"trajectory":"group";
        }
        return authored;
    }

    function hasTimedEffect(entity,type){
        if(!entity){ return false; }
        const spec=STATUS_VISUALS[type];
        const collection=spec&&spec.collection==="statusEffects"?entity.statusEffects:entity.activeBuffs;
        if(Array.isArray(collection)&&collection.some(effect=>
            effect&&Number(effect.turnsLeft)>0&&(
                effect.type===type||(spec&&spec.statusName&&effect.statusName===spec.statusName)
            )
        )){ return true; }
        return type==="rage"&&Array.isArray(entity.v141TeamBuffs)&&entity.v141TeamBuffs.some(effect=>
            effect&&effect.type==="rage"&&Number(effect.turnsLeft)>0
        );
    }

    function snapshotTimedEffects(model){
        const snapshot=new Set();
        const relevantTypes=Array.from(new Set(
            []
                .concat(Array.isArray(model&&model.deferredStatusTypes)?model.deferredStatusTypes:[])
                .concat(Array.isArray(model&&model.deferredActorStatusTypes)?model.deferredActorStatusTypes:[])
        )).filter(type=>!!STATUS_VISUALS[type]);
        if(!relevantTypes.length){ return snapshot; }
        const groups=[
            ["monster",typeof currentBattleMonsters!=="undefined"?currentBattleMonsters.filter(Number.isInteger):[]],
            ["player",[0,1,2,3,4,5]]
        ];
        groups.forEach(entry=>{
            entry[1].forEach(index=>{
                const entity=entityFor(entry[0],index);
                relevantTypes.forEach(type=>{
                    if(hasTimedEffect(entity,type)){ snapshot.add(entry[0]+":"+index+":"+type); }
                });
            });
        });
        return snapshot;
    }

    function deferredStatusDuringCast(side,index,type){
        const current=state.current;
        if(!current||current.done){ return false; }
        const actorTypes=Array.isArray(current.model.deferredActorStatusTypes)?current.model.deferredActorStatusTypes:[];
        if(
            actorTypes.indexOf(type)>=0&&current.side===side&&current.actorIndex===index&&
            !(current.statusAtStart&&current.statusAtStart.has(side+":"+index+":"+type))&&
            hasTimedEffect(entityFor(side,index),type)
        ){ return true; }
        if(current.targetSide!==side){ return false; }
        if(type==="rage"&&current.config.id==="rage"){
            const card=cardFor(side,index);
            if(card&&card.classList&&card.classList.contains("v143-effects-pending")){ return true; }
        }
        const types=Array.isArray(current.model.deferredStatusTypes)?current.model.deferredStatusTypes:[];
        if(types.indexOf(type)<0){ return false; }
        const tracked=current.deferredStatusTargets&&current.deferredStatusTargets.get(type);
        if(tracked&&tracked.has(index)){ return true; }
        const key=side+":"+index+":"+type;
        if(current.statusAtStart&&current.statusAtStart.has(key)){ return false; }
        if(hasTimedEffect(entityFor(side,index),type)){
            let targets=current.deferredStatusTargets.get(type);
            if(!targets){ targets=new Set(); current.deferredStatusTargets.set(type,targets); }
            targets.add(index);
            return true;
        }
        return false;
    }

    function statusVisualNode(card,type){
        if(!card){ return null; }
        const className="v143-status-visual-"+type;
        if(typeof card.querySelector==="function"){ return card.querySelector("."+className); }
        return Array.from(card.children||[]).find(node=>
            String(node.className||"").split(/\s+/).includes(className)
        )||null;
    }

    function statusIconHost(side,index,card){
        if(typeof document!=="undefined"&&typeof document.getElementById==="function"){
            const id=side==="monster"?"battleMonsterStatus"+index:"battlePlayerStatus"+index;
            const exact=document.getElementById(id);
            if(exact){ return exact; }
        }
        const nested=card&&typeof card.querySelector==="function"
            ?card.querySelector(".monster-status-badges")
            :null;
        return nested||card||null;
    }

    function statusIconNode(host,type){
        if(!host){ return null; }
        const className="v143-status-icon-"+type;
        if(typeof host.querySelector==="function"){ return host.querySelector("."+className); }
        return Array.from(host.children||[]).find(node=>
            String(node.className||"").split(/\s+/).includes(className)
        )||null;
    }

    function removeStatusVisual(card,side,index,type){
        const visual=statusVisualNode(card,type);
        if(visual&&typeof visual.remove==="function"){ visual.remove(); }
        else if(visual&&visual.parentNode){ visual.parentNode.removeChild(visual); }
        const host=statusIconHost(side,index,card);
        const icon=statusIconNode(host,type);
        if(icon&&typeof icon.remove==="function"){ icon.remove(); }
        else if(icon&&icon.parentNode){ icon.parentNode.removeChild(icon); }
    }

    function createBodyStatusVisual(type,spec){
        const node=document.createElement("i");
        node.className="v143-status-visual v143-status-visual-"+type+" v143-status-visual--"+spec.mode;
        node.dataset.statusType=type;
        node.dataset.statusMode=spec.mode;
        node.dataset.renderer="dom-status-visual";
        if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
        node.style.backgroundImage='url("'+String(spec.src).replace(/"/g,"%22")+'")';
        node.style.backgroundSize="contain";
        node.style.backgroundPosition="center";
        return node;
    }

    function createStatusIcon(type,spec){
        const node=document.createElement("i");
        node.className="v143-status-icon v143-status-icon-"+type;
        node.dataset.statusType=type;
        node.dataset.statusMode="icon";
        node.dataset.renderer="dom-status-icon";
        const source=String(spec.iconSrc||spec.src||"");
        if(source){
            node.style.backgroundImage='url("'+source.replace(/"/g,"%22")+'")';
            node.style.backgroundSize="contain";
            node.style.backgroundPosition="center";
            node.style.backgroundRepeat="no-repeat";
        }
        node.title=spec.label||type;
        if(typeof node.setAttribute==="function"){ node.setAttribute("aria-label",spec.label||type); }
        return node;
    }

    const STATUS_ROTATION_MS=2000;
    let statusRotationTimer=null;
    const statusRotationByUnit=new Map();

    function syncStatusVisual(side,index,type,showBody){
        const spec=STATUS_VISUALS[type];
        const card=cardFor(side,index);
        const entity=entityFor(side,index);
        const alive=!!(spec&&card&&entity&&Number(entity.hp)>0&&(side!=="monster"||entity.alive!==false));
        const active=alive&&hasTimedEffect(entity,type);
        if(!active||deferredStatusDuringCast(side,index,type)){
            removeStatusVisual(card,side,index,type);
            return;
        }

        const host=statusIconHost(side,index,card);
        const existingIcon=statusIconNode(host,type);
        if(spec.mode==="icon"){
            if(host&&!existingIcon){ host.appendChild(createStatusIcon(type,spec)); }
        }else if(existingIcon){
            if(typeof existingIcon.remove==="function"){ existingIcon.remove(); }
            else if(existingIcon.parentNode){ existingIcon.parentNode.removeChild(existingIcon); }
        }

        if(spec.mode==="icon"||showBody===false){
            const body=statusVisualNode(card,type);
            if(body&&typeof body.remove==="function"){ body.remove(); }
            return;
        }

        let node=statusVisualNode(card,type);
        if(!node){
            node=createBodyStatusVisual(type,spec);
            card.appendChild(node);
        }

        const anchor=slotAnchor(side,index,card);
        if(!anchor){ return; }
        const cardRect=typeof card.getBoundingClientRect==="function"?card.getBoundingClientRect():anchor.rect;
        const regularEnemy=side==="monster"&&!isBossIndexForVfx(index);
        const width=regularEnemy
            ?Math.max(60,Math.min(anchor.rect.width*1.20,cardRect.width*1.20))
            :Math.max(44,Math.min(anchor.rect.width*1.16,cardRect.width*1.16));
        const height=regularEnemy
            ?Math.max(58,Math.min(anchor.rect.height*1.16,cardRect.height*1.16))
            :Math.max(52,Math.min(anchor.rect.height*1.14,cardRect.height*1.14));
        node.dataset.slot=anchor.slot;
        node.style.width=Math.round(width)+"px";
        node.style.height=Math.round(height)+"px";
    }

    function syncStatusVisualsForUnit(side,index,advanceRotation){
        const entity=entityFor(side,index);
        const bodyTypes=entity?Object.keys(RAW_STATUS_VISUALS).filter(type=>{
            const spec=RAW_STATUS_VISUALS[type];
            return !!(
                spec&&spec.mode!=="icon"&&spec.src&&
                hasTimedEffect(entity,type)&&
                !deferredStatusDuringCast(side,index,type)
            );
        }):[];
        const rotationKey=side+":"+index;
        const signature=bodyTypes.join("|");
        let rotation=statusRotationByUnit.get(rotationKey);
        if(!bodyTypes.length){
            statusRotationByUnit.delete(rotationKey);
            rotation=null;
        }else if(!rotation||rotation.signature!==signature){
            rotation={signature:signature,index:0};
            statusRotationByUnit.set(rotationKey,rotation);
        }else if(advanceRotation===true&&bodyTypes.length>1){
            rotation.index=(rotation.index+1)%bodyTypes.length;
        }
        const activeBodyType=rotation&&bodyTypes.length
            ?bodyTypes[rotation.index%bodyTypes.length]
            :null;
        Object.keys(RAW_STATUS_VISUALS).forEach(type=>
            syncStatusVisual(side,index,type,type===activeBodyType)
        );
    }

    function syncStatusVisualEffects(advanceRotation){
        purgeLegacyCardVfx();
        const enemyIndexes=typeof currentBattleMonsters!=="undefined"?currentBattleMonsters.filter(Number.isInteger):[];
        enemyIndexes.forEach(index=>syncStatusVisualsForUnit("monster",index,advanceRotation===true));
        for(let index=0;index<6;index++){ syncStatusVisualsForUnit("player",index,advanceRotation===true); }
    }

    function removeStatusVisualEffects(){
        if(typeof document==="undefined"||typeof document.querySelectorAll!=="function"){ return; }
        [".v143-status-visual",".v143-status-icon"].forEach(selector=>
            document.querySelectorAll(selector).forEach(node=>node.remove())
        );
        statusRotationByUnit.clear();
    }
    window.v143SyncStatusVisualEffects=syncStatusVisualEffects;

    function ensureStatusRotationTimer(){
        if(statusRotationTimer||typeof window==="undefined"||typeof window.setInterval!=="function"){ return; }
        statusRotationTimer=window.setInterval(()=>{
            if(typeof battleActive!=="undefined"&&!battleActive){ return; }
            syncStatusVisualEffects(true);
        },STATUS_ROTATION_MS);
    }
    ensureStatusRotationTimer();

    function statusVisualTypeForEntry(entry){
        if(!entry){ return null; }
        const direct=String(entry.type||"");
        if(RAW_STATUS_VISUALS[direct]){ return direct; }
        const named=String(entry.statusName||"");
        const buffType=String(entry.v141BuffType||"");
        if(buffType==="dodge"&&named==="元祖賜福"){ return "yuanZuBlessing"; }
        if(buffType==="dodge"){ return "dodgeSkill"; }
        if(buffType==="resistance"){ return "dinghaishenzhen"; }
        for(const type of Object.keys(RAW_STATUS_VISUALS)){
            const spec=RAW_STATUS_VISUALS[type];
            if(named&&(named===spec.statusName||named===spec.label)){ return type; }
        }
        return null;
    }

    function statusPercent(entry,key,fallback){
        const value=Number(entry&&entry[key]);
        if(Number.isFinite(value)&&value!==0){ return value; }
        const other=Number(entry&&entry[fallback]);
        return Number.isFinite(other)?other:0;
    }

    function statusEffectText(type,entry){
        const value=Number(entry&&entry.value)||0;
        if(type==="burn"){ return "每回合受到最大 HP "+(Number(entry.percent)||0)+"% 傷害"; }
        if(type==="rage"){
            const chance=statusPercent(entry,"critChanceBonusPercent","bonusPercent");
            const damage=statusPercent(entry,"critDamageBonusPercent","bonusPercent");
            return "爆擊率 +"+chance+"%，爆擊傷害 +"+damage+"%";
        }
        if(type==="frostbite"){ return "無法使用技能"; }
        if(type==="freeze"){ return "無法行動"; }
        if(type==="agilityDown"){ return "敏捷降低 "+value+"%"; }
        if(type==="damageDown"){ return "造成傷害降低 "+value+"%"; }
        if(type==="stun"){ return "最終命中率降低 "+value+"%"; }
        if(type==="dodgeSkill"){
            const percent=statusPercent(entry,"percent","bonusPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.dodgeSkill&&skillDatabase.dodgeSkill.evasionBonusPercent)||0;
            return "閃躲率提升 "+percent+"%";
        }
        if(type==="stealthSkill"){ return "無法被單體技能選中，仍會受到範圍技能"; }
        if(type==="dinghaishenzhen"){
            const resist=statusPercent(entry,"resistBonus","amount")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.dinghaishenzhen&&skillDatabase.dinghaishenzhen.statusResistBonus)||0;
            const accuracy=Number(entry&&entry.accuracyBonusPercent)||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.dinghaishenzhen&&skillDatabase.dinghaishenzhen.accuracyBonusPercent)||0;
            const parts=[];
            if(resist){ parts.push("異常狀態抗性 +"+resist+"%"); }
            if(accuracy){ parts.push("命中率 +"+accuracy+"%"); }
            return parts.join("、")||"異常狀態抗性提升";
        }
        if(type==="defenseDown"){ return "防禦降低 "+value+"%"; }
        if(type==="shield"){
            const remaining=Math.max(0,Number(entry&&entry.remaining)||0);
            return remaining?"吸收傷害，剩餘護盾 "+Math.round(remaining):"吸收傷害";
        }
        if(type==="petrify"){ return "無法行動"; }
        if(type==="earthShield"){
            const percent=statusPercent(entry,"percent","reflectPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.earthShield&&skillDatabase.earthShield.reflectPercent)||0;
            return "反彈受到傷害的 "+percent+"%";
        }
        if(type==="rockWall"){
            const percent=statusPercent(entry,"percent","defenseBonusPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.rockWall&&skillDatabase.rockWall.defenseBonusPercent)||0;
            return "防禦提升 "+percent+"%";
        }
        if(type==="barrier"){
            const blocks=Math.max(0,Number(entry&&entry.remainingBlocks)||0);
            return blocks?"完全抵擋傷害，剩餘 "+blocks+" 次":"完全抵擋傷害";
        }
        if(type==="yuanZuBlessing"){
            const percent=statusPercent(entry,"bonusPercent","evasionBonusPercent")||
                Number(typeof skillDatabase!=="undefined"&&skillDatabase.yuanZuBlessing&&skillDatabase.yuanZuBlessing.evasionBonusPercent)||0;
            return "閃躲率提升 "+percent+"%";
        }
        if(type==="fireMomentum"){
            const percent=Number(entry&&entry.bonusPercent)||0;
            return "下一次主動火系直接傷害提升 "+percent+"%";
        }
        if(type==="phoenixMight"){
            const percent=Number(entry&&entry.bonusPercent)||0;
            return "下一回合造成的所有傷害提升 "+percent+"%";
        }
        if(type==="fireSoulResonance"){
            const level=Math.max(1,Math.min(5,Number(entry&&entry.skillLevel)||1));
            const values=typeof skillDatabase!=="undefined"&&skillDatabase.fireSoulResonance&&skillDatabase.fireSoulResonance.momentumBonusByLevel;
            const percent=Array.isArray(values)?Number(values[level-1])||0:0;
            return "火系技能爆擊或新增燃燒時獲得炎勢"+(percent?"（傷害 +"+percent+"%）":"");
        }
        if(type==="bloodBurn"){
            const level=Math.max(1,Math.min(5,Number(entry&&entry.skillLevel)||1));
            const values=typeof skillDatabase!=="undefined"&&skillDatabase.bloodBurnArt&&skillDatabase.bloodBurnArt.directDamageBonusByLevel;
            const percent=Array.isArray(values)?Number(values[level-1])||0:0;
            return "火系攻擊傷害提升 "+percent+"%";
        }
        return "效果生效中";
    }

    function normalizedStatusEntry(entry,kind){
        const type=statusVisualTypeForEntry(entry);
        if(!type){ return null; }
        const spec=RAW_STATUS_VISUALS[type];
        const turns=Math.max(0,Number(entry&&entry.turnsLeft)||0);
        const oneShot=!!(entry&&entry.oneShot)||turns>9999;
        return Object.freeze({
            type:type,
            name:spec.label||spec.statusName||type,
            iconSrc:spec.iconSrc||spec.src||"",
            effect:statusEffectText(type,entry),
            turnsLeft:oneShot?null:Math.ceil(turns),
            remainingText:oneShot?"觸發後消失":Math.ceil(turns)+" 回合",
            kind:kind
        });
    }

    window.v143GetBattleStatusSummary=function(entity){
        const buffs=[],debuffs=[],seen=new Set();
        function collect(list,kind){
            if(!Array.isArray(list)){ return; }
            list.forEach(entry=>{
                if(!entry||Number(entry.turnsLeft)<=0){ return; }
                const item=normalizedStatusEntry(entry,kind);
                if(!item){ return; }
                const key=kind+":"+item.type+":"+item.name;
                if(seen.has(key)){ return; }
                seen.add(key);
                (kind==="buff"?buffs:debuffs).push(item);
            });
        }
        collect(entity&&entity.activeBuffs,"buff");
        collect(entity&&entity.statusEffects,"debuff");
        if(entity&&entity.v141Shield&&Number(entity.v141Shield.turnsLeft)>0){
            const type=entity.v141Shield.isBarrier?"barrier":"shield";
            const item=normalizedStatusEntry(Object.assign({type:type},entity.v141Shield),"buff");
            if(item&&!seen.has("buff:"+item.type+":"+item.name)){ buffs.push(item); }
        }
        return Object.freeze({buffs:Object.freeze(buffs),debuffs:Object.freeze(debuffs)});
    };

    function syncAppliedStatusVisual(entity,type){
        if(!entity){ return; }
        let side=null,index=-1;
        if(typeof monsters!=="undefined"&&Array.isArray(monsters)){
            index=monsters.indexOf(entity);
            if(index>=0){ side="monster"; }
        }
        if(!side&&typeof getPartyCharacterByIndex==="function"){
            for(let partyIndex=0;partyIndex<6;partyIndex++){
                if(getPartyCharacterByIndex(partyIndex)===entity){ side="player"; index=partyIndex; break; }
            }
        }
        if(!side||index<0){ return; }
        const current=state.current;
        if(current&&!current.done&&current.targetSide===side){
            const types=Array.isArray(current.model.deferredStatusTypes)?current.model.deferredStatusTypes:[];
            if(types.indexOf(type)>=0){
                registerTarget(side,index,false);
                confirmTargetVisual(current,index);
                let tracked=current.deferredStatusTargets.get(type);
                if(!tracked){ tracked=new Set(); current.deferredStatusTargets.set(type,tracked); }
                tracked.add(index);
                syncStatusVisualsForUnit(side,index,false);
                return;
            }
        }
        const wait=existingTargetDelay(side,index);
        const invoke=()=>syncStatusVisualsForUnit(side,index,false);
        if(wait>8){ setTimer(invoke,wait); } else{ invoke(); }
    }

    if(typeof applyBurnEffect==="function"){
        const previous=applyBurnEffect;
        applyBurnEffect=function(entity){
            const result=previous.apply(this,arguments);
            if(result!==false){ syncAppliedStatusVisual(entity,"burn"); }
            return result;
        };
    }
    if(typeof applyFreezeEffect==="function"){
        const previous=applyFreezeEffect;
        applyFreezeEffect=function(entity){
            const result=previous.apply(this,arguments);
            if(result!==false){ syncAppliedStatusVisual(entity,"freeze"); }
            return result;
        };
    }
    if(typeof applyMonsterDebuff==="function"){
        const previous=applyMonsterDebuff;
        applyMonsterDebuff=function(entity,type){
            const result=previous.apply(this,arguments);
            if(result!==false&&STATUS_VISUALS[type]){ syncAppliedStatusVisual(entity,type); }
            return result;
        };
    }

    function appendSpriteNode(current){
        const node=document.createElement("i");
        node.className="v143-vfx-sprite";
        node.dataset.skill=current.config.id||"unknown";
        node.dataset.targetSide=current.targetSide;
        node.dataset.renderer="dom-sprite";
        node.dataset.confirmedHit="false";
        node.dataset.geometryOwner="fixed-slot";
        node.style.visibility="hidden";
        state.stage.appendChild(node);
        return node;
    }

    function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }

    function frameAspectFor(sprite){
        const key=String(sprite&&sprite.src||"");
        const cached=key?spriteFrameAspectCache.get(key):null;
        return Math.max(.1,Number(cached)||Number(sprite&&sprite.cellAspect)||1);
    }

    function applySpriteBox(node,width,height,sprite,fit){
        const placementScale=PLACEMENT_SIZE_SCALE[node.dataset.placement]||1;
        const boxWidth=Math.max(1,Number(width)||1)*SPRITE_SCALE_MULTIPLIER*placementScale;
        const boxHeight=Math.max(1,Number(height)||1)*SPRITE_SCALE_MULTIPLIER*placementScale;
        const aspect=frameAspectFor(sprite);
        let renderWidth=boxWidth,renderHeight=boxHeight;
        if(fit==="cover"){
            if(renderWidth/renderHeight>aspect){ renderHeight=renderWidth/aspect; }
            else{ renderWidth=renderHeight*aspect; }
        }else if(renderWidth/renderHeight>aspect){ renderWidth=renderHeight*aspect; }
        else{ renderHeight=renderWidth/aspect; }
        node.style.width=Math.round(renderWidth)+"px";
        node.style.height=Math.round(renderHeight)+"px";
        node.dataset.frameAspect=String(Number(aspect.toFixed(4)));
        node.dataset.frameFit=fit==="stretch"?"stretch":fit==="cover"?"cover":"contain";
    }

    function requestSpriteAspect(sprite,current,node,index,target){
        const key=String(sprite&&sprite.src||"");
        if(!key||spriteFrameAspectCache.has(key)||spriteFrameAspectLoading.has(key)){ return; }
        const ImageCtor=typeof window!=="undefined"&&typeof window.Image==="function"?window.Image:(typeof Image==="function"?Image:null);
        if(!ImageCtor){ return; }
        spriteFrameAspectLoading.add(key);
        const image=new ImageCtor();
        image.onload=function(){
            spriteFrameAspectLoading.delete(key);
            const columns=Math.max(1,Number(sprite.columns)||1);
            const rows=Math.max(1,Number(sprite.rows)||1);
            const cellWidth=Number(image.naturalWidth||image.width||0)/columns;
            const cellHeight=Number(image.naturalHeight||image.height||0)/rows;
            if(cellWidth>0&&cellHeight>0){ spriteFrameAspectCache.set(key,cellWidth/cellHeight); }
            if(state.current===current&&!current.done){ placeSprite(current,node,index,target); }
        };
        image.onerror=function(){ spriteFrameAspectLoading.delete(key); };
        image.src=key;
    }

    function emittedSpriteTargets(current){
        return current.targetIndexes.filter(index=>
            current.emitted.has(index)&&current.validTargets.has(index)&&
            canReceive(current.config,current.targetSide,index)&&!!cardFor(current.targetSide,index)
        );
    }

    function authoredSquareSize(sprite,geometry,defaults){
        const base=Math.max(1,Math.max(Number(geometry&&geometry.width)||0,Number(geometry&&geometry.height)||0));
        const scale=Number(sprite.scale)||defaults.scale;
        const configuredMin=Number(sprite.minSize)||defaults.min;
        const configuredMax=Number(sprite.maxSize)||defaults.max;
        const minSize=Math.min(configuredMin,base*defaults.minRatio);
        const maxSize=Math.max(minSize,Math.min(configuredMax,base*defaults.maxRatio));
        return clamp(base*scale,minSize,maxSize);
    }

    function placeSprite(current,node,index,target){
        const sprite=current.model.sprite;
        const placement=placementFor(current.config,sprite);
        node.dataset.placement=placement;

        if(placement==="single"){
            const size=authoredSquareSize(sprite,target.rect,{scale:1.8,min:96,max:184,minRatio:1.18,maxRatio:1.68});
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.geometrySlot=target.slot;
            node.style.left=target.x+"px";
            node.style.top=target.y+"px";
            applySpriteBox(node,size,size,sprite);
            return;
        }

        if(placement==="targetTrajectory"){
            const actor=slotAnchor(current.side,current.actorIndex,current.actorCard);
            if(!actor){ return; }
            const size=authoredSquareSize(sprite,target.rect,{scale:1.7,min:140,max:240,minRatio:1.12,maxRatio:1.56});
            node.dataset.targetIndex=String(index);
            node.dataset.targetIndexes=String(index);
            node.dataset.geometrySlot=target.slot;
            node.dataset.travel="true";
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            applySpriteBox(node,size,size,sprite);
            node.style.setProperty("--v143-sprite-dx",target.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",target.y-actor.y+"px");
            node.style.setProperty("--v143-sprite-angle",Math.atan2(target.y-actor.y,target.x-actor.x)*180/Math.PI+"deg");
            return;
        }

        const indexes=emittedSpriteTargets(current);
        const bounds=geometryBounds(current,indexes,placement);
        if(!bounds){ return; }
        const primaryAnchor=geometryPrimaryAnchor(current,indexes);
        node.dataset.geometrySlots=Array.isArray(bounds.slots)?bounds.slots.join(","):"";

        if(placement==="battlefield"){
            /* coverageScale is an authored multiplier over the complete fixed
               battlefield zone. It never measures currently surviving targets. */
            const coverageScale=clamp(Number(sprite.coverageScale)||Number(sprite.scale)||1,1,1.4);
            const width=Math.max(1,Math.round(bounds.width));
            const height=Math.max(1,Math.round(bounds.height));
            node.dataset.areaId=bounds.id||"fixed-battlefield";
            node.dataset.targetIndexes=indexes.join(",");
            if(sprite.fixedFormation){ node.dataset.fixedFormation="true"; }
            node.dataset.coverageScale=String(coverageScale);
            node.style.clipPath="none";
            node.style.left=bounds.centerX+"px";
            node.style.top=bounds.centerY+"px";
            /* Range effects fill the complete fixed-side rectangle but never
               extend into the independent operation track. The whole source
               frame remains visible; no card or Zone is a paint clip owner. */
            applySpriteBox(node,width,height,sprite,"cover");
            return;
        }

        /* Group/row/tri/trajectory size is derived from the fixed geometry shape,
           never from the number or outer bounds of surviving target cards. */
        const width=Math.max(1,Math.round(bounds.width));
        const height=Math.max(1,Math.round(bounds.height));
        node.dataset.targetIndexes=indexes.join(",");
        applySpriteBox(node,width,height,sprite,"cover");
        /* A group/row/tri Sprite keeps the fixed-shape bounds for sizing, but
           its visual center belongs to the explicitly selected primary card.
           Only full-battlefield effects remain centered on the whole side. */
        const destination=bounds.centerOnBounds&&placement!=="trajectory"
            ?{x:bounds.centerX,y:bounds.centerY}
            :primaryAnchor
            ?{x:primaryAnchor.x,y:primaryAnchor.y}
            :{x:bounds.centerX,y:bounds.centerY};
        if(primaryAnchor){ node.dataset.geometrySlot=primaryAnchor.slot; }
        const actor=placement==="trajectory"?slotAnchor(current.side,current.actorIndex,current.actorCard):null;
        if(placement==="trajectory"&&sprite.travelToTargets&&actor){
            node.dataset.travel="true";
            node.dataset.travelToTargets="true";
            node.style.left=actor.x+"px";
            node.style.top=actor.y+"px";
            node.style.setProperty("--v143-sprite-dx",destination.x-actor.x+"px");
            node.style.setProperty("--v143-sprite-dy",destination.y-actor.y+"px");
            node.style.setProperty("--v143-sprite-angle",Math.atan2(destination.y-actor.y,destination.x-actor.x)*180/Math.PI+"deg");
        }else{
            node.style.left=destination.x+"px";
            node.style.top=destination.y+"px";
        }
    }

    function addSprite(current,index,target){
        const sprite=current.model.sprite;
        if(!sprite||!target||!state.stage){ return; }
        const placement=placementFor(current.config,sprite);
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        let node=current.spriteNodes.get(key);
        if(!node){
            const initialSprite=!current.firstVisibleFrameAt;
            if(initialSprite){ beginVisualTimeline(current); }
            node=appendSpriteNode(current);
            node.dataset.columns=String(sprite.columns);
            node.dataset.rows=String(sprite.rows);
            node.dataset.frames=String(sprite.frames);
            node.style.backgroundImage='url("'+String(sprite.src).replace(/"/g,"%22")+'")';
            node.style.backgroundSize=(sprite.columns*100)+"% "+(sprite.rows*100)+"%";
            node.style.setProperty("--v143-sprite-duration",current.duration+"ms");
            /* The first normal cast always begins at Frame 1. A later sprite
               for a separately delayed target may catch up to the visual
               timeline, but it must never rewrite the initial cast. */
            node.dataset.emission=initialSprite?"initial":"late";
            node.style.setProperty("--v143-sprite-delay",initialSprite
                ?"0ms"
                :-Math.min(current.duration,Math.max(0,Date.now()-(current.visualStartedAt||current.startedAt)))+"ms"
            );
            if(typeof node.setAttribute==="function"){ node.setAttribute("aria-hidden","true"); }
            current.spriteNodes.set(key,node);
        }
        placeSprite(current,node,index,target);
        requestSpriteAspect(sprite,current,node,index,target);
        /* A formal cast Sprite represents the attempted skill, not only a landed hit.
           Reveal it as soon as the official owner has a real fixed-slot position.
           Outcome confirmation still marks the node and controls hit feedback, but
           MISS/status/custom Boss paths must not make the cast animation disappear. */
        if(node.style.left&&node.style.top){
            node.style.visibility="visible";
            node.dataset.emittedVisual="true";
        }
        if(!node.classList.contains("v143-vfx-sprite-active")){ node.classList.add("v143-vfx-sprite-active"); }
    }

    function confirmTargetVisual(current,index){
        if(!current||current.done||!current.model||!current.model.sprite){ return; }
        current.confirmedTargets.add(index);
        const placement=placementFor(current.config,current.model.sprite);
        const key=placement==="single"||placement==="targetTrajectory"?String(index):"main";
        const node=current.spriteNodes.get(key);
        if(node){ node.dataset.confirmedHit="true"; node.style.visibility="visible"; }
    }

    function targetHitTime(current,index){
        const visualStartedAt=current.visualStartedAt||current.startedAt;
        return Math.min(
            visualStartedAt+current.duration-120,
            visualStartedAt+current.duration*(Number(current.model.hit)||DEFAULT_HIT)
        );
    }

    function beginVisualTimeline(current){
        if(!current||current.firstVisibleFrameAt){ return false; }
        current.firstVisibleFrameAt=Date.now();
        current.visualStartedAt=current.firstVisibleFrameAt;
        if(current.gate&&typeof current.gate.restartVisualTimeline==="function"){
            current.gate.restartVisualTimeline(current.duration);
        }
        current.cleanupTimer=setTimer(
            ()=>cleanupCurrent(current,"v143-raster-complete"),
            current.duration
        );
        return true;
    }

    function settleTargetVisual(current,index){
        if(state.current!==current||current.done){ return; }
        const card=cardFor(current.targetSide,index);
        if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
        current.hitReached=true;
        syncStatusVisualsForUnit(current.targetSide,index);
    }

    function emitSprite(current,index,allowDefeated){
        if(!state.stage||current.emitted.has(index)||!current.validTargets.has(index)){ return; }
        if(!allowDefeated&&!canReceive(current.config,current.targetSide,index)){ return; }
        const targetCard=cardFor(current.targetSide,index);
        const target=slotAnchor(current.targetSide,index,targetCard);
        if(!target){ return; }
        current.emitted.add(index);
        if(current.targetIndexes.indexOf(index)<0){ current.targetIndexes.push(index); }
        if(targetCard&&targetCard.classList){ targetCard.classList.add("v143-effects-pending"); }
        if(current.model.sprite){ addSprite(current,index,target); }
        setTimer(()=>settleTargetVisual(current,index),Math.max(0,targetHitTime(current,index)-Date.now()));
    }

    function registerTarget(targetSide,index,allowDefeated){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide){ return null; }
        const single=String(current.config.targetType||"")==="single";
        if(single&&current.targetIndexes.length&&current.targetIndexes.indexOf(index)<0){ return null; }
        if(!current.validTargets.has(index)){ current.validTargets.add(index); }
        emitSprite(current,index,allowDefeated===true);
        return current.emitted.has(index)?current:null;
    }

    function cleanupCurrent(current,reason){
        if(!current||current.done){ return; }
        current.done=true;
        current.targetIndexes.forEach(index=>{
            const card=cardFor(current.targetSide,index);
            if(card&&card.classList){ card.classList.remove("v143-effects-pending"); }
        });
        if(state.stage&&state.stage.dataset.sequence===String(current.sequence)&&typeof state.stage.remove==="function"){
            state.stage.remove();
        }
        if(state.current===current){ state.current=null; state.stage=null; }
        syncStatusVisualEffects();
        state.metrics.completed++;
        if(current.gate&&!current.gate.done){ current.gate.complete(reason||"v143-raster-complete"); }
    }

    let sequence=0;
    function modelFor(config){
        const model=MANIFEST[config.id];
        if(model){ return model; }
        state.metrics.missingVisuals++;
        return {hit:DEFAULT_HIT,noVisual:true,missingAsset:true,signature:"missing-"+String(config.id||"unknown")};
    }

    function render(config,meta,gate){
        if(typeof document==="undefined"||!document.body){
            setTimer(()=>gate.complete("v143-headless"),config.resolveDuration||config.duration);
            return null;
        }
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"superseded"); }
        purgeLegacyCardVfx();
        purgeStaleRasterStages();

        const model=modelFor(config);
        const contractedSide=meta&&meta.targetContract&&meta.targetContract.version==="battle-target-contract-v1"
            ?meta.targetContract.targetSide:meta&&meta.targetSide;
        const targetSide=contractedSide==="player"||contractedSide==="monster"
            ?contractedSide:targetSideFor(config,meta.side||"player");
        const duration=Math.max(520,Number(config.duration)||520);
        const validTargets=new Set(activeCards(targetSide,config).map(entry=>entry.index));
        const explicitTargets=Array.isArray(meta.targetIds)
            ?meta.targetIds
            :(meta.targetId!==undefined&&meta.targetId!==null?[meta.targetId]:[]);
        explicitTargets.forEach(index=>{
            if(Number.isInteger(index)&&cardFor(targetSide,index)){
                validTargets.add(index);
            }
        });

        const current={
            sequence:++sequence,config:config,model:model,gate:gate,
            side:meta.side||"player",actorIndex:Number.isInteger(meta.actorIndex)?meta.actorIndex:0,
            targetId:meta.targetId!==undefined?meta.targetId:null,
            targetIds:Array.isArray(meta.targetIds)?meta.targetIds.slice():null,
            targetSide:targetSide,targetIndexes:[],emitted:new Set(),validTargets:validTargets,
            spriteNodes:new Map(),confirmedTargets:new Set(),deferredStatusTargets:new Map(),statusAtStart:snapshotTimedEffects(model),
            actorCard:cardFor(meta.side||"player",Number.isInteger(meta.actorIndex)?meta.actorIndex:0),
            startedAt:Date.now(),visualStartedAt:0,firstVisibleFrameAt:0,
            duration:duration,hitReached:false,done:false,cleanupTimer:0
        };
        current.targetIndexes=initialTargetIndexes(config,current,targetSide);

        const stage=document.createElement("div");
        stage.id="v143-skill-stage";
        stage.className="v143-skill-stage";
        stage.style.visibility="visible";
        stage.dataset.sequence=String(current.sequence);
        stage.dataset.skill=String(config.id||"unknown");
        stage.dataset.element=String(config.element||"normal");
        stage.dataset.renderer="raster-only";
        stage.dataset.geometryOwner="fixed-slot";
        if(model.missingAsset||model.missingDedicatedAsset){ stage.dataset.missingVisual="true"; }
        document.body.appendChild(stage);

        state.stage=stage;
        state.current=current;
        state.metrics.started++;

        if(
            (Array.isArray(model.deferredStatusTypes)&&model.deferredStatusTypes.length)||
            (Array.isArray(model.deferredActorStatusTypes)&&model.deferredActorStatusTypes.length)
        ){ syncStatusVisualEffects(); }

        if(model.noVisual||!model.sprite){
            if(!model.passive){ state.metrics.missingVisuals++; }
        }else{
            current.targetIndexes.slice().forEach(index=>emitSprite(current,index));
        }

        if(model.noVisual||!model.sprite){
            current.cleanupTimer=setTimer(()=>cleanupCurrent(current,"v143-raster-complete"),duration);
        }
        gate.promise.then(()=>{
            if(state.current===current&&!current.done){ cleanupCurrent(current,gate.reason||"gate-complete"); }
        });
        return current;
    }

    function officialPlay(config,meta){
        const safeMeta=Object.assign({},meta||{},{render:false});
        const gate=originalPlay(config,safeMeta);
        if(state.current&&state.current.gate===gate){ return gate; }
        try{
            render(config,Object.assign({side:"player",actorIndex:0},meta||{}),gate);
        }catch(error){
            state.metrics.renderErrors=(state.metrics.renderErrors||0)+1;
            if(typeof console!=="undefined"&&typeof console.error==="function"){
                console.error("V143 raster render failed; combat timing recovered.",error);
            }
            if(!gate.done){ gate.complete("v143-render-error"); }
        }
        return gate;
    }

    /* V143 is the only battle-VFX owner. Later rule/dungeon modules may read
       the director, but cannot replace its renderer or create a fallback. */
    try{
        Object.defineProperty(director,"play",{
            configurable:false,enumerable:true,
            get:function(){ return officialPlay; },
            set:function(){ blockedDirectorOverrides++; }
        });
    }catch(_){
        director.play=officialPlay;
    }

    /* Formal sheets already include projectile/travel art. Legacy projectile
       helpers are intentionally no-op once this owner is installed. */
    if(typeof playFireRocketAnimation==="function"){ playFireRocketAnimation=function(){ return; }; }
    if(typeof playIceSpinProjectile==="function"){ playIceSpinProjectile=function(){ return; }; }

    director.dispose=function(){
        clearTimers();
        if(state.current&&!state.current.done){ cleanupCurrent(state.current,"dispose"); }
        if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
            document.querySelectorAll("#v143-skill-stage").forEach(node=>node.remove());
        }
        removeStatusVisualEffects();
        purgeLegacyCardVfx();
        return originalDispose();
    };

    function delayFor(targetSide,index,allowDefeated){
        const current=registerTarget(targetSide,index,allowDefeated);
        if(!current){ return 0; }
        confirmTargetVisual(current,index);
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    function existingTargetDelay(targetSide,index){
        const current=state.current;
        if(!current||current.done||current.targetSide!==targetSide||!current.emitted.has(index)){ return 0; }
        return Math.max(0,targetHitTime(current,index)-Date.now());
    }

    window.v143RunAtTargetHit=function(targetSide,index,callback,allowDefeated){
        if(typeof callback!=="function"){ return 0; }
        const wait=delayFor(targetSide,index,allowDefeated===true);
        if(wait>8){ setTimer(callback,wait); }else{ callback(); }
        return wait;
    };

    if(typeof showMonsterHit==="function"){
        const previous=showMonsterHit;
        showMonsterHit=function(index){
            const args=Array.prototype.slice.call(arguments);
            const wait=delayFor("monster",index,true);
            const current=state.current;
            if(current&&!current.done&&current.config.id==="fireCritical"&&current.targetSide==="monster"){ args[3]=true; }
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previous.apply(this,args),wait);
                return;
            }
            return previous.apply(this,args);
        };
    }

    if(typeof showPlayerHit==="function"){
        const previous=showPlayerHit;
        showPlayerHit=function(amount,type,index){
            const args=Array.prototype.slice.call(arguments);
            const wait=delayFor("player",Number(index)||0,true);
            const current=state.current;
            if(current&&!current.done&&current.config.id==="fireCritical"&&current.targetSide==="player"&&!args[3]){ args[4]=true; }
            if(wait>8){
                state.metrics.delayedNumbers++;
                setTimer(()=>previous.apply(this,args),wait);
                return;
            }
            return previous.apply(this,args);
        };
    }

    if(typeof applySkillDebuffEffectsToPlayer==="function"){
        const previous=applySkillDebuffEffectsToPlayer;
        applySkillDebuffEffectsToPlayer=function(skill,level,target,index){
            registerTarget("player",Number(index)||0,true);
            return previous.apply(this,arguments);
        };
    }

    if(typeof showMissEffect==="function"){
        const previous=showMissEffect;
        showMissEffect=function(isPlayerTarget,index,label){
            const args=Array.prototype.slice.call(arguments);
            const targetSide=isPlayerTarget?"player":"monster";
            /* MISS is still an attempted cast. Register the resolved target through
               the same formal V143 path so late-known monster/Boss targets get
               their real Sprite Sheet while the MISS popup keeps hit timing. */
            const wait=delayFor(targetSide,index,true);
            const invoke=()=>{
                const result=previous.apply(this,args);
                const card=cardFor(targetSide,index);
                if(card&&typeof card.querySelectorAll==="function"&&typeof document!=="undefined"&&document.body){
                    const popups=card.querySelectorAll(":scope > .damage-popup.miss-popup");
                    const popup=popups.length?popups[popups.length-1]:null;
                    const rect=popup&&card.getBoundingClientRect?card.getBoundingClientRect():null;
                    if(popup&&rect){
                        popup.classList.add("v152-top-damage");
                        popup.style.setProperty("left",(rect.left+rect.width/2)+"px","important");
                        popup.style.setProperty("top",(rect.top+rect.height*.26)+"px","important");
                        document.body.appendChild(popup);
                    }
                }
                return result;
            };
            if(wait>8){ setTimer(invoke,wait); return; }
            return invoke();
        };
    }

    function officialCardEffect(side,index){
        const args=Array.prototype.slice.call(arguments);
        const potionTarget=window.v143LastPotionEffectTarget;
        if(args[2]==="potion"&&potionTarget&&Date.now()-potionTarget.at<2000){
            side="player";
            index=potionTarget.index;
            window.v143LastPotionEffectTarget=null;
        }
        const wait=delayFor(side,index,false);
        const invoke=function(){
            const unitIndex=Number(index);
            if((side==="player"||side==="monster")&&Number.isInteger(unitIndex)){
                syncStatusVisualsForUnit(side,unitIndex);
            }else{
                syncStatusVisualEffects();
            }
        };
        if(wait>8){ setTimer(invoke,wait); }else{ invoke(); }
    }

    if(typeof window.v141PlayCardEffect==="function"){
        try{
            Object.defineProperty(window,"v141PlayCardEffect",{
                configurable:true,enumerable:true,
                get:function(){ return officialCardEffect; },
                set:function(){ blockedCardEffectOverrides++; }
            });
        }catch(_){
            window.v141PlayCardEffect=officialCardEffect;
        }
    }

    if(typeof killMonster==="function"){
        const previous=killMonster;
        killMonster=function(index){
            const args=arguments;
            const wait=existingTargetDelay("monster",index);
            if(wait>8){
                state.metrics.delayedDeaths++;
                setTimer(()=>{
                    const monster=typeof monsters!=="undefined"?monsters[index]:null;
                    if(monster&&monster.hp>0){ return; }
                    previous.apply(this,args);
                },wait);
                return;
            }
            return previous.apply(this,args);
        };
    }

    if(typeof updateMonsterUI==="function"){
        const previous=updateMonsterUI;
        updateMonsterUI=function(index){
            const wait=existingTargetDelay("monster",index);
            if(wait>8){
                const key="monster:"+index;
                if(!state.pendingUpdates.has(key)){
                    const args=arguments;
                    state.pendingUpdates.set(key,true);
                    setTimer(()=>{
                        state.pendingUpdates.delete(key);
                        previous.apply(this,args);
                        syncStatusVisualsForUnit("monster",Number(index));
                    },wait);
                }
                return;
            }
            const result=previous.apply(this,arguments);
            syncStatusVisualsForUnit("monster",Number(index));
            return result;
        };
    }

    if(typeof updateSingleCharacterStatusBadge==="function"){
        const previous=updateSingleCharacterStatusBadge;
        updateSingleCharacterStatusBadge=function(index){
            const wait=existingTargetDelay("player",index);
            if(wait>8){
                const key="player-status:"+index;
                if(!state.pendingUpdates.has(key)){
                    const args=arguments;
                    state.pendingUpdates.set(key,true);
                    setTimer(()=>{
                        state.pendingUpdates.delete(key);
                        previous.apply(this,args);
                        syncStatusVisualsForUnit("player",Number(index));
                    },wait);
                }
                return;
            }
            const result=previous.apply(this,arguments);
            syncStatusVisualsForUnit("player",Number(index));
            return result;
        };
    }

    function wrapBadge(name){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const result=previous.apply(this,arguments);
            if(typeof document!=="undefined"&&typeof document.querySelectorAll==="function"){
                document.querySelectorAll(".skill-name-badge").forEach(badge=>badge.classList.add("v143-caster-skill-label"));
            }
            return result;
        };
    }
    wrapBadge("showSkillNameBadge");
    wrapBadge("showMonsterSkillNameBadge");

    if(typeof document!=="undefined"){
        const boot=function(){ purgeLegacyCardVfx(); syncStatusVisualEffects(); };
        if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",boot,{once:true}); }
        else{ boot(); }
    }

    window.v143GetAnimationDiagnostics=function(){
        return Object.assign({},state.metrics,{
            version:VERSION,active:!!state.current,
            activeSkill:state.current&&state.current.config.id,
            activeSide:state.current&&state.current.side,
            targetSide:state.current&&state.current.targetSide,
            blockedManifestWrites:blockedManifestWrites,
            blockedDirectorOverrides:blockedDirectorOverrides,
            blockedCardEffectOverrides:blockedCardEffectOverrides,
            failedAssets:Array.from(failedAssets),
            renderer:"dom-sprite-only",
            statusRenderer:"dom-status-visual",
            geometryOwner:"fixed-slot",
            stageNodes:state.stage?state.stage.querySelectorAll("*").length:0
        });
    };
})();
