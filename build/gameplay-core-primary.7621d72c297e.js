
/* bundled source: js/battlefield-slot-owner.js */
/* =====================================================
   Fixed Battlefield Slot Owner â€” canonical battlefield geometry model
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
         µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥âFVÆWFRÆÇ”f÷&ÖF–öå7FFRç6Æ÷EFô6†&7FW$–æFW…¶g&öÕÓ°¢Ğ¢&WGW&âG'VS°¢Ğ ¢gVæ7F–öâ&W6öÇfTÆÇ•F&vWG2†f÷&ÖF–öâÇ&–Ö'”6†&7FW$–æFW‚Ç6†RÆ—4Æ—fR—°¢6öç7B7FFSÖf÷&ÖF–öâbff÷&ÖF–öâæ¶–æCÓÓÒ&ÆÇ’Öf÷&ÖF–öâ#öf÷&ÖF–öã¦ÆÇ”f÷&ÖF–öå7FFS°¢–b‚7FFR—²&WGW&âµÓ²Ğ¢6öç7Bæ÷&ÖÆ—¦VCÖæ÷&ÖÆ—¦U6†R‡6†R“°¢ÆWB6Æ÷G3°¢–b†æ÷&ÖÆ—¦VCÓÓÒ&ÆÂ"—°¢6Æ÷G3ÔÄÅ•õ4ÄõE2ç6Æ–6R‚“°¢ÖVÇ6W°¢6öç7B&–Ö'•6Æ÷C×7FFRæ6†&7FW$–æFW…Fõ6Æ÷Bbg7FFRæ6†&7FW$–æFW…Fõ6Æ÷E·&–Ö'”6†&7FW$–æFW…Ó°¢–b‚&–Ö'•6Æ÷B—²&WGW&âµÓ²Ğ¢6Æ÷G3×&W6öÇfU6Æ÷G4g&öÕ6†R‚&ÆÇ’"Ç&–Ö'•6Æ÷BÆæ÷&ÖÆ—¦VB“°¢Ğ¢&WGW&â6Æ÷G2æÖ‡6Æ÷CÓç°¢6öç7B–æFWƒ×7FFRç6Æ÷EFô6†&7FW$–æFW‚bg7FFRç6Æ÷EFô6†&7FW$–æFW…·6Æ÷EÓ°¢&WGW&âçVÖ&W"æ—4–çFVvW"†–æFW‚’bb‚—4Æ—fWÇÆ—4Æ—fR†–æFW‚’“ö–æFWƒ¦çVÆÃ°¢Ò’æf–ÇFW"„çVÖ&W"æ—4–çFVvW"“°¢Ğ ¢ÆWB7F—fTVæV×•6æ6†÷CÖçVÆÃ°¢gVæ7F–öâ6WD7F—fTVæV×•6æ6†÷B‡6æ6†÷B—°¢7F—fTVæV×•6æ6†÷C×6æ6†÷Bbg6æ6†÷Bæ¶–æCÓÓÒ&VæV×’Öf÷&ÖF–öâ×6æ6†÷B#÷6æ6†÷C¦çVÆÃ°¢&WGW&â7F—fTVæV×•6æ6†÷C°¢Ğ¢gVæ7F–öâvWD7F—fTVæV×•6æ6†÷B‚—²&WGW&â7F—fTVæV×•6æ6†÷C²Ğ¢gVæ7F–öâ6ÆV$7F—fTVæV×•6æ6†÷B‚—²7F—fTVæV×•6æ6†÷CÖçVÆÃ²Ğ ¢6öç7B“×°¢fW'6–öã¢&f—†VB×6Æ÷B×c"À¢vVöÖWG'•fW'6–öã¢'6Æ÷BÖvVöÖWG'’×c"À¢VæV×•6Æ÷G3¤TäTÕ•õ4ÄõE2À¢VæV×”&6µ6Æ÷G3¤TäTÕ•ô$4²À¢VæV×”g&öçE6Æ÷G3¤TäTÕ•ôe$ôåBÀ¢ÆÇ•6Æ÷G3¤ÄÅ•õ4ÄõE2À¢ÆÇ”g&öçE6Æ÷G3¤ÄÅ•ôe$ôåBÀ¢ÆÇ”&6µ6Æ÷G3¤ÄÅ•ô$4²À¢&÷74fö÷G&–çE6Æ÷G3¤$õ55ôdôõE$”åBÀ¢6Æ÷DÖWF¥4ÄõEôÔUDÀ¢vWDVæV×”f÷&ÖF–öå6Æ÷E&÷w3¦VæV×•&÷w4f÷%G—RÀ¢vWE&–÷&—G•6Æ÷G4f÷$f÷&ÖF–öã§&–÷&—G•6Æ÷G4f÷%G—RÀ¢7&VFTVæV×”f÷&ÖF–öå6æ6†÷C¦7&VFTVæV×”f÷&ÖF–öå6æ6†÷BÀ¢vWDVæV×•6Æ÷Df÷$Ööç7FW#§6Æ÷Df÷$Ööç7FW"À¢vWD76–væVDÖöç7FW$DVæV×•6Æ÷C¦76–væVDÖöç7FW$BÀ¢vWD7F—fTÖöç7FW$DVæV×•6Æ÷C¦7F—fTÖöç7FW$BÀ¢76–väÖöç7FW%FôVæV×•6Æ÷C¦76–väÖöç7FW%Fõ6Æ÷BÀ¢&VÖ÷fTÖöç7FW$g&öÔVæV×•6Æ÷C§&VÖ÷fTÖöç7FW$g&öÕ6Æ÷BÀ¢76–väÖöç7FW%Fõ&VfW'&VDVæV×•6Æ÷C¦76–väÖöç7FW%Fõ&VfW'&VE6Æ÷BÀ¢vWE&–÷&—G”Ööç7FW$–æFW†W3§&–÷&—G”Ööç7FW$–æFW†W2À¢vWDVæV×•6æ6†÷E&÷w3§6æ6†÷E&÷w2À¢vWD76–væVDVæV×•&÷w3¦76–væVDVæV×•&÷w2À¢&W6öÇfU6Æ÷G4g&öÕ6†S§&W6öÇfU6Æ÷G4g&öÕ6†RÀ¢&W6öÇfTVæV×•F&vWG3§&W6öÇfTVæV×•F&vWG2À¢vWDæW‡DVæV×•&–Ö'•F&vWC¦æW‡DVæV×•&–Ö'•F&vWBÀ¢æ÷&ÖÆ—¦TÆÇ”f÷&ÖF–öã¦æ÷&ÖÆ—¦TÆÇ”f÷&ÖF–öâÀ¢‡–G&FTÆÇ”f÷&ÖF–öã¦‡–G&FTÆÇ”f÷&ÖF–öâÀ¢Vç7W&TÆÇ”f÷&ÖF–öã¦Vç7W&TÆÇ”f÷&ÖF–öâÀ¢vWE6W&–Æ—¦&ÆTÆÇ”f÷&ÖF–öã¦vWE6W&–Æ—¦&ÆTÆÇ”f÷&ÖF–öâÀ¢vWDÆÇ•6Æ÷Df÷$6†&7FW#¦ÆÇ•6Æ÷Df÷$6†&7FW"À¢vWD6†&7FW$DÆÇ•6Æ÷C¦6†&7FW$DÆÇ•6Æ÷BÀ¢Ö÷fTÆÇ”6†&7FW#¦Ö÷fTÆÇ”6†&7FW"À¢&W6öÇfTÆÇ•F&vWG3§&W6öÇfTÆÇ•F&vWG2À¢6WD7F—fTVæV×•6æ6†÷C§6WD7F—fTVæV×•6æ6†÷BÀ¢vWD7F—fTVæV×•6æ6†÷C¦vWD7F—fTVæV×•6æ6†÷BÀ¢6ÆV$7F—fTVæV×•6æ6†÷C¦6ÆV$7F—fTVæV×•6æ6†÷BÀ¢vWE6Æ÷DVÆVÖVçC§6Æ÷DVÆVÖVçBÀ¢vWE6Æ÷E&V7C¦vVöÖWG'•&V7Df÷%6Æ÷BÀ¢vWE6Æ÷D6VçFW#¦vVöÖWG'”6VçFW$f÷%6Æ÷BÀ¢vWE&V7Df÷%6Æ÷G3¦vVöÖWG'•&V7Df÷%6Æ÷G2À¢vWE&÷u6Æ÷G3¦vVöÖWG'•&÷u6Æ÷G2À¢vWE&÷u&V7C¦vVöÖWG'•&÷u&V7BÀ¢vWE6–FU6Æ÷G3¦vVöÖWG'•6Æ÷G4f÷%6–FRÀ¢vWE6–FU&V7C¦vVöÖWG'•6–FU&V7BÀ¢vWDvVöÖWG'•6Æ÷G4g&öÕ6†S¦vVöÖWG'•6Æ÷G4g&öÕ6†RÀ¢vWDvVöÖWG'•&V7Dg&öÕ6†S¦vVöÖWG'•&V7Df÷%6†RÀ¢vWE6Æ÷Dg&öÔVÆVÖVçC§6Æ÷Dg&öÔVÆVÖVçBÀ¢vWE6Æ÷Df÷$6öÖ&FçC§6Æ÷Df÷$6öÖ&Fç@¢Ó° ¢v–æF÷räf÷W%7–Ö&öÇ4&GFÆVf–VÆE6Æ÷G3Ôö&¦V7Bæg&VW¦R†’“°¢–b„ö&¦V7Bç&÷F÷G—Ræ†4÷vå&÷W'G’æ6ÆÂ‡v–æF÷rÂ%õöf÷W%7–Ö&öÇ5VæF–ætÆÇ”f÷&ÖF–öâ"’—°¢6öç7B–æFW†W3×G—VöbvWDW†—7F–æu'G”–æFW†W3ÓÓÒ&gVæ7F–öâ#övWDW†—7F–æu'G”–æFW†W2‚“¥µÓ°¢‡–G&FTÆÇ”f÷&ÖF–öâ‡v–æF÷råõöf÷W%7–Ö&öÇ5VæF–ætÆÇ”f÷&ÖF–öâÆ–æFW†W2“°¢FVÆWFRv–æF÷råõöf÷W%7–Ö&öÇ5VæF–ætÆÇ”f÷&ÖF–öã°¢Ğ§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ö&GFÆR×7FF—7F–72×7—7FVÒæ§2¢ğ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢&GFÆR7FF—7F–72ò&GFÆR–ç6–v‡BT¢ÒöæRW"Ö&GFÆR7FF—7F–72÷væW"¶W–VB'’6öÖ&FçB–Bà¢ÒT’&VG2F†R6ÖRÆ—fRöf–æÂ6æ6†÷C²æòGWÆ–6FR&W7VÇB6Æ7VÆF–öâà¢ÒG&vW'2&RæöâÖ&Æö6¶–ærö'6W'fW'3²6öÖ&B6öçF–çVW2v†–ÆRF†W’&R÷Vâà£ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢†gVæ7F–öâ–ç7FÆÄ&GFÆU7FF—7F–757—7FVÒ‚—°¢'W6R7G&–7B#° ¢–b‡G—Vöbv–æF÷sÓÓÒ'VæFVf–æVB'ÇÇv–æF÷råõö&GFÆU7FF—7F–757—7FVÔ–ç7FÆÆVB—²&WGW&ã²Ğ¢v–æF÷råõö&GFÆU7FF—7F–757—7FVÔ–ç7FÆÆVC×G'VS° ¢6öç7BdÄ”Eô´”äE3ÖæWr6WB…²'Æ–W$6†&7FW""Â&†W&ôç2"Â'&V–æf÷&6VÖVçB%Ò“°¢ÆWB6W76–öãÖçVÆÃ°¢ÆWBf–æÅ6æ6†÷CÖçVÆÃ°¢ÆWB&÷74ÖV6†æ—6×3ÕµÓ°¢ÆWB÷VäG&vW#ÖçVÆÃ°¢ÆWB&W7VÇD6Æ÷6T6ÆÆ&6³ÖçVÆÃ° ¢gVæ7F–öâçVÖ&W"‡fÇVR—°¢6öç7B&W7VÇCÔçVÖ&W"‡fÇVR“°¢&WGW&âçVÖ&W"æ—4f–æ—FR‡&W7VÇB“÷&W7VÇC£°¢Ğ¢gVæ7F–öâÖ÷VçB‡fÇVR—²&WGW&âÖF‚æÖ‚ƒÆçVÖ&W"‡fÇVR’“²Ğ¢gVæ7F–öâW66T‡FÖÂ‡fÇVR—°¢&WGW&â7G&–ær‡fÇVSÓÖçVÆÃò"#§fÇVR¢ç&WÆ6R‚òbörÂ"f×²"’ç&WÆ6R‚óÂörÂ"fÇC²"’ç&WÆ6R‚óâörÂ"fwC²"¢ç&WÆ6R‚ò"örÂ"gV÷C²"’ç&WÆ6R‚òrörÂ"b33“²"“°¢Ğ¢gVæ7F–öâ6÷’‡fÇVR—²&WGW&â¥4ôâç'6R„¥4ôâç7G&–æv–g’‡fÇVR’“²Ğ¢gVæ7F–öâæ÷&ÖÆ—¦T6öÖ&FçB†–çWB—°¢–b‚–çWGÇÂ–çWBæ–B—²&WGW&âçVÆÃ²Ğ¢6öç7B¶–æCÕdÄ”Eô´”äE2æ†2†–çWBæ¶–æB“ö–çWBæ¶–æC¢'Æ–W$6†&7FW"#°¢6öç7B&GFÆT–æFWƒÔçVÖ&W"æ—4–çFVvW"„çVÖ&W"†–çWBæ&GFÆT–æFW‚’“ôçVÖ&W"†–çWBæ&GFÆT–æFW‚“¦çVÆÃ°¢&WGW&â°¢–C¥7G&–ær†–çWBæ–B’À¢¶–æC¦¶–æBÀ¢6–FS¦–çWBç6–FSÓÓÒ&VæV×’#ò&VæV×’#¢&ÆÇ’"À¢&GFÆT–æFWƒ¦&GFÆT–æFW‚À¢æÖS¥7G&–ær†–çWBææÖWÇÂ.iÊ®YŞYŞYjîKØÒ"’À¢÷'G&—C¥7G&–ær†–çWBç÷'G&—GÇÂ""’À¢FÖvTFVÇC¤ÖF‚æÖ‚ƒÆçVÖ&W"†–çWBæFÖvTFVÇB’’À¢†VÆ–ætFöæS¤ÖF‚æÖ‚ƒÆçVÖ&W"†–çWBæ†VÆ–ætFöæR’’À¢FÖvUF¶Vã¤ÖF‚æÖ‚ƒÆçVÖ&W"†–çWBæFÖvUF¶Vâ’’À¢7&—F–6Ä†—G3¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†çVÖ&W"†–çWBæ7&—F–6Ä†—G2’’¢Ó°¢Ğ¢gVæ7F–öâ6æ6†÷Dg&öÒ‡6÷W&6R—°¢–b‚6÷W&6R—²&WGW&âçVÆÃ²Ğ¢&WGW&â°¢&GFÆUFö¶Vã§6÷W&6Ræ&GFÆUFö¶VâÀ¢7F—fS¢6÷W&6Ræ7F—fRÀ¢&W7VÇC§6÷W&6Rç&W7VÇGÇÆçVÆÂÀ¢6öÖ&FçG3¤'&’æg&öÒ‡6÷W&6Ræ6öÖ&FçG2çfÇVW2‚’¢æf–ÇFW"†—FVÓÓæ—FVÒç6–FSÓÓÒ&ÆÇ’"¢æÖ†—FVÓÓæ6÷’†—FVÒ’¢Ó°¢Ğ¢gVæ7F–öâ7W'&VçE6æ6†÷B‚—°¢&WGW&â6W76–öâbg6W76–öâæ7F—fS÷6æ6†÷Dg&öÒ‡6W76–öâ“¦f–æÅ6æ6†÷Bbf6÷’†f–æÅ6æ6†÷B“°¢Ğ¢gVæ7F–öâf–æD6öÖ&FçB†–B—°¢–b‚6W76–öçÇÂ6W76–öâæ7F—fWÇÂ–B—²&WGW&âçVÆÃ²Ğ¢&WGW&â6W76–öâæ6öÖ&FçG2ævWB…7G&–ær†–B’—ÇÆçVÆÃ°¢Ğ¢gVæ7F–öâf÷&ÖEfÇVR‡fÇVR—°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†çVÖ&W"‡fÇVR’’’çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"“°¢Ğ ¢gVæ7F–öâ&GFÆU&ö÷B‚—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢Ğ¢gVæ7F–öâ&ö÷B‚—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ6öçFVçB"—ÇÆFö7VÖVçBævWDVÆVÖVçD'”–B‚&"—ÇÆFö7VÖVçBæ&öG“°¢Ğ¢gVæ7F–öâ6Æ×VFvUF÷†VFvRÇ&ö÷BÇfÇVR—°¢6öç7B†V–v‡CÔÖF‚æÖ‚ƒÄçVÖ&W"‡&ö÷Bbg&ö÷Bæ6Æ–VçD†V–v‡B—ÇÃ“°¢6öç7BVFvT†V–v‡CÔÖF‚æÖ‚ƒÄçVÖ&W"†VFvRbfVFvRæöfg6WD†V–v‡B—ÇÃ“°¢6öç7BÖ–åF÷Óƒ°¢6öç7BÖ…F÷ÔÖF‚æÖ‚†Ö–åF÷Æ†V–v‡BÖVFvT†V–v‡BÓ‚“°¢&WGW&âÖF‚æÖ‚†Ö–åF÷ÄÖF‚æÖ–â†Ö…F÷ÄçVÖ&W"‡fÇVR—ÇÆÖ–åF÷’“°¢Ğ¢gVæ7F–öâ–ç7FÆÅ7FG4VFvTG&r†VFvRÇ&ö÷B—°¢–b‚VFvWÇÂ&ö÷GÇÆVFvRåõö&GFÆU7FG4VFvTG&t–ç7FÆÆVB—²&WGW&ã²Ğ¢VFvRåõö&GFÆU7FG4VFvTG&t–ç7FÆÆVC×G'VS°¢ÆWBG&sÖçVÆÃ° ¢gVæ7F–öâf–æ—6„G&r†WfVçB—°¢–b‚G&r—²&WGW&ã²Ğ¢–b†WfVçBbfWfVçBçö–çFW$–BÓ×VæFVf–æVBbfG&rçö–çFW$–BÓ×VæFVf–æVBbfWfVçBçö–çFW$–BÓÖG&rçö–çFW$–B—²&WGW&ã²Ğ¢6öç7BÖ÷fVCÖG&ræÖ÷fVC°¢G&sÖçVÆÃ°¢VFvRæ6Æ74Æ—7Bç&VÖ÷fR‚&—2ÖG&vv–ær"“°¢–b†Ö÷fVB—°¢VFvRåõ÷7W&W74æW‡D6Æ–6³×G'VS°¢6WEF–ÖV÷WB‚‚“Óç²VFvRåõ÷7W&W74æW‡D6Æ–6³ÖfÇ6S²ÒÃ“°¢Ğ¢Ğ ¢VFvRæFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"ÆWfVçCÓç°¢–b†WfVçBæ'WGFöâÓ×VæFVf–æVBbfWfVçBæ'WGFöâÓÓ—²&WGW&ã²Ğ¢6öç7B&V7C×&ö÷BævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢6öç7B&ö÷D†V–v‡CÔÖF‚æÖ‚ƒÄçVÖ&W"‡&ö÷Bæ6Æ–VçD†V–v‡B—ÇÇ&V7Bæ†V–v‡GÇÃ“°¢G&s×°¢ö–çFW$–C¦WfVçBçö–çFW$–BÀ¢7F'D6Æ–VçE“¤çVÖ&W"†WfVçBæ6Æ–VçE’—ÇÃÀ¢7F'EF÷¦6Æ×VFvUF÷†VFvRÇ&ö÷BÆVFvRæöfg6WEF÷’À¢66ÆU“§&V7Bæ†V–v‡Cã÷&ö÷D†V–v‡B÷&V7Bæ†V–v‡C£À¢Ö÷fVC¦fÇ6P¢Ó°¢VFvRæ6Æ74Æ—7BæFB‚&—2ÖG&vv–ær"“°¢–b‡G—VöbVFvRç6WEö–çFW$6GW&SÓÓÒ&gVæ7F–öâ"bfWfVçBçö–çFW$–BÓ×VæFVf–æVB—°¢G'—²VFvRç6WEö–çFW$6GW&R†WfVçBçö–çFW$–B“²Ö6F6‚…ò—²Ğ¢Ğ¢WfVçBç&WfVçDFVfVÇB‚“°¢Ò“°¢VFvRæFDWfVçDÆ—7FVæW"‚'ö–çFW&Ö÷fR"ÆWfVçCÓç°¢–b‚G&wÇÆWfVçBçö–çFW$–BÓÖG&rçö–çFW$–B—²&WGW&ã²Ğ¢6öç7BFVÇFÒ‚„çVÖ&W"†WfVçBæ6Æ–VçE’—ÇÃ’ÖG&rç7F'D6Æ–VçE’’¦G&rç66ÆU“°¢–b‚G&ræÖ÷fVBbdÖF‚æ'2†FVÇF“ãÓ2—²G&ræÖ÷fVC×G'VS²Ğ¢–b‚G&ræÖ÷fVB—²&WGW&ã²Ğ¢VFvRç7G–ÆRçF÷Ö6Æ×VFvUF÷†VFvRÇ&ö÷BÆG&rç7F'EF÷¶FVÇF’²'‚#°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ò“°¢VFvRæFDWfVçDÆ—7FVæW"‚'ö–çFW'W"Æf–æ—6„G&r“°¢VFvRæFDWfVçDÆ—7FVæW"‚'ö–çFW&6æ6VÂ"Æf–æ—6„G&r“°¢Ğ¢gVæ7F–öâVç7W&T&GFÆUV’‚—°¢–b‡G—VöbFö7VÖVçCÓÓÒ'VæFVf–æVB"—²&WGW&âçVÆÃ²Ğ¢6öç7B&ö÷CÖ&GFÆU&ö÷B‚“°¢–b‚&ö÷B—²&WGW&âçVÆÃ²Ğ ¢ÆWBVFvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆU7FG4VFvT'WGFöâ"“°¢–b‚VFvR—°¢VFvSÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&'WGFöâ"“°¢VFvRçG—SÒ&'WGFöâ#°¢VFvRæ–CÒ&&GFÆU7FG4VFvT'WGFöâ#°¢VFvRæ6Æ74æÖSÒ&&GFÆR×7FG2ÖVFvRÖ'WGFöâ#°¢VFvRç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.h‹šÊ^i[i9¢"“°¢VFvRæ–ææW$…DÔÃÒ#Ç7ãîh‹Â÷7ããÇ7ãîšÊSÂ÷7ããÇ7ãîi[ƒÂ÷7ããÇ7ãîi9£Â÷7ãâ#°¢VFvRæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÆWfVçCÓç°¢–b†VFvRåõ÷7W&W74æW‡D6Æ–6²—°¢VFvRåõ÷7W&W74æW‡D6Æ–6³ÖfÇ6S°¢WfVçBç&WfVçDFVfVÇB‚“°¢WfVçBç7F÷–ÖÖVF–FU&÷vF–öâ‚“°¢&WGW&ã°¢Ğ¢÷Vä&GFÆTG&vW"‚'7FG2"“°¢Ò“°¢&ö÷BæVæD6†–ÆB†VFvR“°¢Ğ ¢ÆWBÆW'D'WGFöãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖV6†æ—6ÔÆW'B"“°¢–b‚ÆW'D'WGFöâ—°¢ÆW'D'WGFöãÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&'WGFöâ"“°¢ÆW'D'WGFöâçG—SÒ&'WGFöâ#°¢ÆW'D'WGFöâæ–CÒ&&GFÆTÖV6†æ—6ÔÆW'B#°¢ÆW'D'WGFöâæ6Æ74æÖSÒ&&GFÆRÖÖV6†æ—6ÒÖÆW'B#°¢ÆW'D'WGFöâç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.iú^yÈ²&÷72X©şˆ;ŞXÚ"“°¢ÆW'D'WGFöâçFW‡D6öçFVçCÒ"#°¢ÆW'D'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚“Óæ÷Vä&GFÆTG&vW"‚&&÷72"’“°¢&ö÷BæVæD6†–ÆB†ÆW'D'WGFöâ“°¢Ğ ¢6öç7B7FÆU67&–ÓÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆT–ç6–v‡E67&–Ò"“°¢–b‡7FÆU67&–ÒbgG—Vöb7FÆU67&–Òç&VÖ÷fSÓÓÒ&gVæ7F–öâ"—²7FÆU67&–Òç&VÖ÷fR‚“²Ğ ¢ÆWB7FG4G&vW#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆU7FG4G&vW""“°¢–b‚7FG4G&vW"—°¢7FG4G&vW#ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&6–FR"“°¢7FG4G&vW"æ–CÒ&&GFÆU7FG4G&vW"#°¢7FG4G&vW"æ6Æ74æÖSÒ&&GFÆRÖ–ç6–v‡BÖG&vW"&GFÆR×7FG2ÖG&vW"#°¢7FG4G&vW"ç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.h‹šÊ^i[i9¢"“°¢7FG4G&vW"æ–ææW$…DÔÃÒsÆ†VFW#ãÆ#îh‹šÊ^i[i9£Âö#ãÆ'WGFöâG—SÒ&'WGFöâ"FFÖ6Æ÷6Sì9sÂö'WGFöããÂö†VFW#ãÆF—b6Æ73Ò&&GFÆRÖ–ç6–v‡BÖG&vW"Ö&öG’#ãÂöF—câs°¢7FG4G&vW"çVW'•6VÆV7F÷"‚%¶FFÖ6Æ÷6UÒ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Æ6Æ÷6T&GFÆTG&vW"“°¢&ö÷BæVæD6†–ÆB‡7FG4G&vW"“°¢Ğ ¢ÆWB&÷74G&vW#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆT&÷74ÖV6†æ—6ÔG&vW""“°¢–b‚&÷74G&vW"—°¢&÷74G&vW#ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&6–FR"“°¢&÷74G&vW"æ–CÒ&&GFÆT&÷74ÖV6†æ—6ÔG&vW"#°¢&÷74G&vW"æ6Æ74æÖSÒ&&GFÆRÖ–ç6–v‡BÖG&vW"&GFÆRÖ&÷72ÖÖV6†æ—6ÒÖG&vW"#°¢&÷74G&vW"ç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â$&÷72X©şˆ;ŞXÚ"“°¢&÷74G&vW"æ–ææW$…DÔÃÒsÆ†VFW#ãÆ#ä&÷72X©şˆ;ŞXÚÂö#ãÆ'WGFöâG—SÒ&'WGFöâ"FFÖ6Æ÷6Sì9sÂö'WGFöããÂö†VFW#ãÆF—b6Æ73Ò&&GFÆRÖ–ç6–v‡BÖG&vW"Ö&öG’#ãÂöF—câs°¢&÷74G&vW"çVW'•6VÆV7F÷"‚%¶FFÖ6Æ÷6UÒ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Æ6Æ÷6T&GFÆTG&vW"“°¢&ö÷BæVæD6†–ÆB†&÷74G&vW"“°¢Ğ¢–ç7FÆÅ7FG4VFvTG&r†VFvRÇ&ö÷B“°¢&WGW&â¶VFvRÆÆW'D'WGFöâÇ7FG4G&vW"Æ&÷74G&vW'Ó°¢Ğ¢gVæ7F–öâ7–æ4&GFÆTVçG'•f—6–&–Æ—G’‚—°¢6öç7BV“ÖVç7W&T&GFÆUV’‚“°¢–b‚V’—²&WGW&ã²Ğ¢6öç7B7F—fSÒ‡6W76–öâbg6W76–öâæ7F—fR“°¢V’æVFvRæ†–FFVãÒ7F—fS°¢V’æÆW'D'WGFöâæ†–FFVãÒ7F—fWÇÆ&÷74ÖV6†æ—6×2æÆVæwFƒÓÓÓ°¢–b‚7F—fR—²6Æ÷6T&GFÆTG&vW"‚“²Ğ¢Ğ¢gVæ7F–öâ7FE&÷r†Æ&VÂÇfÇVR—°¢&WGW&âsÆF—cãÇ7ãâr¶W66T‡FÖÂ†Æ&VÂ’²sÂ÷7ããÆ#âr¶f÷&ÖEfÇVR‡fÇVR’²sÂö#ãÂöF—câs°¢Ğ¢gVæ7F–öâ&VæFW%7FG4G&vW"‚—°¢6öç7BG&vW#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆU7FG4G&vW""“°¢6öç7B&öG“ÖG&vW"bfG&vW"çVW'•6VÆV7F÷"‚"æ&GFÆRÖ–ç6–v‡BÖG&vW"Ö&öG’"“°¢–b‚&öG’—²&WGW&ã²Ğ¢6öç7B6æ6†÷CÖ7W'&VçE6æ6†÷B‚“°¢6öç7B6öÖ&FçG3×6æ6†÷Bbd'&’æ—4'&’‡6æ6†÷Bæ6öÖ&FçG2“÷6æ6†÷Bæ6öÖ&FçG3¥µÓ°¢&öG’æ–ææW$…DÔÃÖ6öÖ&FçG2æÆVæwFƒö6öÖ&FçG2æÖ†—FVÓÓà¢sÆ'F–6ÆR6Æ73Ò&&GFÆR×7FBÖ6&B#âr°¢sÆF—b6Æ73Ò&&GFÆR×7FBÖ–FVçF—G’#âr°¢†—FVÒç÷'G&—CòsÆ–Ör7&3Ò"r¶W66T‡FÖÂ†—FVÒç÷'G&—B’²r"ÇCÒ"#âs¢sÇ7â6Æ73Ò&&GFÆR×7FBÖfF"ÖfÆÆ&6²"&–Ö†–FFVãÒ'G'VR#î)xcÂ÷7ãâr’°¢sÆF—cãÆ#âr¶W66T‡FÖÂ†—FVÒææÖR’²sÂö#ãÇ6ÖÆÃâr¶W66T‡FÖÂ†—FVÒæ¶–æCÓÓÒ&†W&ôç2#ò.ˆ»™¸Bå2#¦—FVÒæ¶–æCÓÓÒ'&V–æf÷&6VÖVçB#ò.hûN‹¸Ò#¢.xêZënŠy.ˆ›""’²sÂ÷6ÖÆÃãÂöF—câr°¢sÂöF—câr°¢sÆF—b6Æ73Ò&&GFÆR×7FBÖw&–B#âr°¢7FE&÷r‚.{‹ŞX+~Zë2"Æ—FVÒæFÖvTFVÇB’°¢7FE&÷r‚.˜
h‰k+¾y˜.˜xò"Æ—FVÒæ†VÆ–ætFöæR’°¢7FE&÷r‚.h›şXù~X+~Zë2"Æ—FVÒæFÖvUF¶Vâ’°¢7FE&÷r‚.i«Ni8®jÊi[‚"Æ—FVÒæ7&—F–6Ä†—G2’°¢sÂöF—câr°¢sÂö'F–6ÆSâp¢’æ¦ö–â‚""“¢sÇ6Æ73Ò&&GFÆRÖ–ç6–v‡BÖV×G’#îyºîX˜Şk).iÈXúş{[Šˆy¨Nh‰ikh‹šÊ^YjîKØŞ8#Â÷âs°¢Ğ¢gVæ7F–öâÖV6†æ—6ÔÖ&·W†—FVÒ—°¢6öç7B&VÖ–æ–æsÖ—FVÒç&VÖ–æ–æsÓÓÖçVÆÇÇÆ—FVÒç&VÖ–æ–æsÓÓ×VæFVf–æVGÇÆ—FVÒç&VÖ–æ–æsÓÓÒ" ¢ò" ¢¢sÆF—cãÇ7ãîXššIƒÂ÷7ããÆ#âr¶W66T‡FÖÂ†—FVÒç&VÖ–æ–ær’²sÂö#ãÂöF—câs°¢&WGW&âsÆ'F–6ÆR6Æ73Ò&&GFÆRÖÖV6†æ—6ÒÖ6&B#âr°¢sÆF—b6Æ73Ò&&GFÆRÖÖV6†æ—6Ò×F—FÆR#âr°¢†—FVÒæ–6öãòsÆ–Ör7&3Ò"r¶W66T‡FÖÂ†—FVÒæ–6öâ’²r"ÇCÒ"#âs¢sÇ7â&–Ö†–FFVãÒ'G'VR#âÂ÷7ãâr’°¢sÆ#âr¶W66T‡FÖÂ†—FVÒææÖWÇÂ$&÷72j™şX‹b"’²sÂö#âr°¢sÂöF—câr°¢sÇâr¶W66T‡FÖÂ†—FVÒæVffV7GÇÂ""’²sÂ÷âr°¢sÆF—cãÇ7ãîŠ{y›Îj)ŞK»cÂ÷7ããÆ#âr¶W66T‡FÖÂ†—FVÒçG&–vvW'ÇÂ.h‹šÊ^j™şX‹nŠ{y›Â"’²sÂö#ãÂöF—câr°¢sÆF—cãÇ7ãîyºîX˜Şx¸hX³Â÷7ããÆ#âr¶W66T‡FÖÂ†—FVÒç7FGW7ÇÂ.yIşiXKŠÒ"’²sÂö#ãÂöF—câr°¢&VÖ–æ–ær°¢sÂö'F–6ÆSâs°¢Ğ¢gVæ7F–öâ&VæFW$&÷74G&vW"‚—°¢6öç7BG&vW#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆT&÷74ÖV6†æ—6ÔG&vW""“°¢6öç7B&öG“ÖG&vW"bfG&vW"çVW'•6VÆV7F÷"‚"æ&GFÆRÖ–ç6–v‡BÖG&vW"Ö&öG’"“°¢–b‚&öG’—²&WGW&ã²Ğ¢&öG’æ–ææW$…DÔÃÖ&÷74ÖV6†æ—6×2æÆVæwF€¢ö&÷74ÖV6†æ—6×2æÖ†ÖV6†æ—6ÔÖ&·W’æ¦ö–â‚""¢¢sÇ6Æ73Ò&&GFÆRÖ–ç6–v‡BÖV×G’#îyºîX˜ŞZNKˆ®k).iÈyIşiXKŠŞy¨B&÷72X©şˆ;ŞXÚ8#Â÷âs°¢Ğ¢gVæ7F–öâ÷Vä&GFÆTG&vW"†¶–æB—°¢–b‚6W76–öçÇÂ6W76–öâæ7F—fR—²&WGW&âfÇ6S²Ğ¢6öç7BæW‡CÖ¶–æCÓÓÒ&&÷72#ò&&÷72#¢'7FG2#°¢–b†æW‡CÓÓÒ&&÷72"bf&÷74ÖV6†æ—6×2æÆVæwFƒÓÓÓ—²&WGW&âfÇ6S²Ğ¢6öç7BV“ÖVç7W&T&GFÆUV’‚“°¢–b‚V’—²&WGW&âfÇ6S²Ğ ¢–b†÷VäG&vW#ÓÓÖæW‡B—²&WGW&âG'VS²Ğ¢6Æ÷6T&GFÆTG&vW"‚“°¢÷VäG&vW#ÖæW‡C° ¢6öç7BG&vW#ÖæW‡CÓÓÒ&&÷72#÷V’æ&÷74G&vW#§V’ç7FG4G&vW#°¢G&vW"æ6Æ74Æ—7BæFB‚&÷Vâ"“°¢–b†æW‡CÓÓÒ&&÷72"—²&VæFW$&÷74G&vW"‚“²ÖVÇ6W²&VæFW%7FG4G&vW"‚“²Ğ¢–b‡G—Vöbv–æF÷rç7–æ4&GFÆUV•&–÷&—G”Æ–W#ÓÓÒ&gVæ7F–öâ"—²v–æF÷rç7–æ4&GFÆUV•&–÷&—G”Æ–W"‚“²Ğ¢&WGW&âG'VS°¢Ğ¢gVæ7F–öâ6Æ÷6T&GFÆTG&vW"‚—°¢–b‡G—VöbFö7VÖVçBÓÒ'VæFVf–æVB"—°¢6öç7B7FG3ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆU7FG4G&vW""“°¢6öç7B&÷73ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆT&÷74ÖV6†æ—6ÔG&vW""“°¢–b‡7FG2—²7FG2æ6Æ74Æ—7Bç&VÖ÷fR‚&÷Vâ"“²Ğ¢–b†&÷72—²&÷72æ6Æ74Æ—7Bç&VÖ÷fR‚&÷Vâ"“²Ğ¢Ğ¢÷VäG&vW#ÖçVÆÃ°¢–b‡G—Vöbv–æF÷rç7–æ4&GFÆUV•&–÷&—G”Æ–W#ÓÓÒ&gVæ7F–öâ"—²v–æF÷rç7–æ4&GFÆUV•&–÷&—G”Æ–W"‚“²Ğ¢Ğ¢gVæ7F–öâ7–æ4÷VäG&vW"‚—°¢–b†÷VäG&vW#ÓÓÒ'7FG2"—²&VæFW%7FG4G&vW"‚“²Ğ¢VÇ6R–b†÷VäG&vW#ÓÓÒ&&÷72"—²&VæFW$&÷74G&vW"‚“²Ğ¢Ğ ¢gVæ7F–öâVç7W&U&W7VÇDÖöFÂ‚—°¢–b‡G—VöbFö7VÖVçCÓÓÒ'VæFVf–æVB"—²&WGW&âçVÆÃ²Ğ¢ÆWBÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆU7FF—7F–75&W7VÇDÖöFÂ"“°¢–b†ÖöFÂ—²&WGW&âÖöFÃ²Ğ¢ÖöFÃÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'6V7F–öâ"“°¢ÖöFÂæ–CÒ&&GFÆU7FF—7F–75&W7VÇDÖöFÂ#°¢ÖöFÂæ6Æ74æÖSÒ&&GFÆR×7FF—7F–72×&W7VÇBÖÖöFÂ#°¢ÖöFÂæ†–FFVã×G'VS°¢ÖöFÂæ–ææW$…DÔÃÒsÆF—b6Æ73Ò&&GFÆR×7FF—7F–72×&W7VÇB×æVÂ#ãÆ†VFW#ãÆF—cãÇ6ÖÆÃä&GFÆR&W7VÇBFWF–Ç>ûÈh‹šÊ^Š›>{K{Yzé~ûÈ“Â÷6ÖÆÃãÆƒ"FF×F—FÆSîh‹šÊ^Š›>{K{YzésÂöƒ#ãÇFF×7V'F—FÆSãÂ÷ãÂöF—cãÂö†VFW#ãÆF—b6Æ73Ò&&GFÆR×7FF—7F–72×&W7VÇBÖ&öG’#ãÂöF—cãÆfö÷FW#ãÆ'WGFöâG—SÒ&'WGFöâ"FFÖ6Æ÷6Sî™yÎ™h“Âö'WGFöããÂöfö÷FW#ãÂöF—câs°¢ÖöFÂçVW'•6VÆV7F÷"‚%¶FFÖ6Æ÷6UÒ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚“Óæ†–FU&W7VÇDFWF–Ç2‡G'VR’“°¢&ö÷B‚’æVæD6†–ÆB†ÖöFÂ“°¢&WGW&âÖöFÃ°¢Ğ¢gVæ7F–öâ6†÷u&W7VÇDFWF–Ç2†÷F–öç2—°¢–b‚f–æÅ6æ6†÷GÇÂ'&’æ—4'&’†f–æÅ6æ6†÷Bæ6öÖ&FçG2’—²&WGW&âfÇ6S²Ğ¢6öç7BÖöFÃÖVç7W&U&W7VÇDÖöFÂ‚“°¢–b‚ÖöFÂ—²&WGW&âfÇ6S²Ğ¢6öç7B6öæf–sÖ÷F–öç2bgG—Vöb÷F–öç3ÓÓÒ&ö&¦V7B#ö÷F–öç3§·Ó°¢&W7VÇD6Æ÷6T6ÆÆ&6³×G—Vöb6öæf–ræöä6Æ÷6SÓÓÒ&gVæ7F–öâ#ö6öæf–ræöä6Æ÷6S¦çVÆÃ°¢ÖöFÂçVW'•6VÆV7F÷"‚%¶FF×F—FÆUÒ"’çFW‡D6öçFVçCÕ7G&–ær†6öæf–rçF—FÆWÇÂ.h‹šÊ^Š›>{K{Yzér"“°¢ÖöFÂçVW'•6VÆV7F÷"‚%¶FF×7V'F—FÆUÒ"’çFW‡D6öçFVçCÕ7G&–ær†6öæf–rç7V'F—FÆWÇÂ""“°¢6öç7B&öG“ÖÖöFÂçVW'•6VÆV7F÷"‚"æ&GFÆR×7FF—7F–72×&W7VÇBÖ&öG’"“°¢&öG’æ–ææW$…DÔÃÖf–æÅ6æ6†÷Bæ6öÖ&FçG2æÖ†—FVÓÓà¢sÆ'F–6ÆR6Æ73Ò&&GFÆR×&W7VÇB×7FBÖ6&B#âr°¢sÆF—b6Æ73Ò&&GFÆR×7FBÖ–FVçF—G’#âr°¢†—FVÒç÷'G&—CòsÆ–Ör7&3Ò"r¶W66T‡FÖÂ†—FVÒç÷'G&—B’²r"ÇCÒ"#âs¢sÇ7â6Æ73Ò&&GFÆR×7FBÖfF"ÖfÆÆ&6²"&–Ö†–FFVãÒ'G'VR#î)xcÂ÷7ãâr’°¢sÆF—cãÆ#âr¶W66T‡FÖÂ†—FVÒææÖR’²sÂö#ãÇ6ÖÆÃâr¶W66T‡FÖÂ†—FVÒæ¶–æCÓÓÒ&†W&ôç2#ò.ˆ»™¸Bå2#¦—FVÒæ¶–æCÓÓÒ'&V–æf÷&6VÖVçB#ò.hûN‹¸Ò#¢.xêZënŠy.ˆ›""’²sÂ÷6ÖÆÃãÂöF—câr°¢sÂöF—câr°¢sÆF—b6Æ73Ò&&GFÆR×7FBÖw&–B#âr°¢7FE&÷r‚.{‹ŞX+~Zë2"Æ—FVÒæFÖvTFVÇB’°¢7FE&÷r‚.˜
h‰k+¾y˜.˜xò"Æ—FVÒæ†VÆ–ætFöæR’°¢7FE&÷r‚.h›şXù~X+~Zë2"Æ—FVÒæFÖvUF¶Vâ’°¢7FE&÷r‚.i«Ni8®jÊi[‚"Æ—FVÒæ7&—F–6Ä†—G2’°¢sÂöF—câr°¢sÂö'F–6ÆSâp¢’æ¦ö–â‚""“°¢ÖöFÂæ†–FFVãÖfÇ6S°¢&WGW&âG'VS°¢Ğ¢gVæ7F–öâ†–FU&W7VÇDFWF–Ç2†–çfö¶T6ÆÆ&6²—°¢6öç7BÖöFÃ×G—VöbFö7VÖVçBÓÒ'VæFVf–æVB#öFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆU7FF—7F–75&W7VÇDÖöFÂ"“¦çVÆÃ°¢–b†ÖöFÂ—²ÖöFÂæ†–FFVã×G'VS²Ğ¢6öç7B6ÆÆ&6³×&W7VÇD6Æ÷6T6ÆÆ&6³°¢&W7VÇD6Æ÷6T6ÆÆ&6³ÖçVÆÃ°¢–b†–çfö¶T6ÆÆ&6²ÓÖfÇ6RbgG—Vöb6ÆÆ&6³ÓÓÒ&gVæ7F–öâ"—°¢G'—²6ÆÆ&6²‚“²Ö6F6‚†W'&÷"—²6öç6öÆRæW'&÷"‚.h‹šÊ^Š›>{K{Yzé~™yÎ™hY¹îYÎZKiY~ûÉ¢"ÆW'&÷"“²Ğ¢Ğ¢Ğ ¢gVæ7F–öâ&Vv–â†6öæf–r—°¢6Æ÷6T&GFÆTG&vW"‚“°¢†–FU&W7VÇDFWF–Ç2†fÇ6R“°¢&÷74ÖV6†æ—6×3ÕµÓ°¢6öç7B–çWCÖ6öæf–rbgG—Vöb6öæf–sÓÓÒ&ö&¦V7B#ö6öæf–s§·Ó°¢6W76–öã×°¢&GFÆUFö¶Vã¦–çWBæ&GFÆUFö¶VãÓÖçVÆÃöçVÆÃ¦–çWBæ&GFÆUFö¶VâÀ¢7F—fS§G'VRÀ¢&W7VÇC¦çVÆÂÀ¢6öÖ&FçG3¦æWrÖ‚¢Ó°¢„'&’æ—4'&’†–çWBæ6öÖ&FçG2“ö–çWBæ6öÖ&FçG3¥µÒ’æf÷$V6‚‡&Vv—7FW$6öÖ&FçB“°¢f–æÅ6æ6†÷CÖçVÆÃ°¢7–æ4&GFÆTVçG'•f—6–&–Æ—G’‚“°¢7–æ4÷VäG&vW"‚“°¢&WGW&â7W'&VçE6æ6†÷B‚“°¢Ğ¢gVæ7F–öâ&Vv—7FW$6öÖ&FçB†–çWB—°¢–b‚6W76–öçÇÂ6W76–öâæ7F—fR—²&WGW&âfÇ6S²Ğ¢6öç7BæW‡CÖæ÷&ÖÆ—¦T6öÖ&FçB†–çWB“°¢–b‚æW‡B—²&WGW&âfÇ6S²Ğ¢6öç7B7W'&VçC×6W76–öâæ6öÖ&FçG2ævWB†æW‡Bæ–B“°¢–b†7W'&VçB—°¢æW‡BæFÖvTFVÇCÖ7W'&VçBæFÖvTFVÇC°¢æW‡Bæ†VÆ–ætFöæSÖ7W'&VçBæ†VÆ–ætFöæS°¢æW‡BæFÖvUF¶VãÖ7W'&VçBæFÖvUF¶Vã°¢æW‡Bæ7&—F–6Ä†—G3Ö7W'&VçBæ7&—F–6Ä†—G3°¢Ğ¢6W76–öâæ6öÖ&FçG2ç6WB†æW‡Bæ–BÆæW‡B“°¢7–æ4÷VäG&vW"‚“°¢&WGW&âG'VS°¢Ğ¢gVæ7F–öâ&V6÷&DFÖvR†–çWB—°¢–b‚6W76–öçÇÂ6W76–öâæ7F—fR—²&WGW&âfÇ6S²Ğ¢6öç7BWfVçCÖ–çWBbgG—Vöb–çWCÓÓÒ&ö&¦V7B#ö–çWC§·Ó°¢6öç7BfÇVSÖÖ÷VçB†WfVçBæÖ÷VçB“°¢6öç7B6÷W&6SÖf–æD6öÖ&FçB†WfVçBç6÷W&6T–B“°¢6öç7BF&vWCÖf–æD6öÖ&FçB†WfVçBçF&vWD–B“°¢–b‡6÷W&6RbgfÇVSã—²6÷W&6RæFÖvTFVÇB³×fÇVS²Ğ¢–b‡F&vWBbgfÇVSã—²F&vWBæFÖvUF¶Vâ³×fÇVS²Ğ¢7–æ4÷VäG&vW"‚“°¢&WGW&â‡6÷W&6WÇÇF&vWB“°¢Ğ¢gVæ7F–öâ&V6÷&D†VÆ–ær†–çWB—°¢–b‚6W76–öçÇÂ6W76–öâæ7F—fR—²&WGW&âfÇ6S²Ğ¢6öç7BWfVçCÖ–çWBbgG—Vöb–çWCÓÓÒ&ö&¦V7B#ö–çWC§·Ó°¢6öç7BfÇVSÖÖ÷VçB†WfVçBæÖ÷VçB“°¢6öç7B6÷W&6SÖf–æD6öÖ&FçB†WfVçBç6÷W&6T–B“°¢–b‡6÷W&6RbgfÇVSã—²6÷W&6Ræ†VÆ–ætFöæR³×fÇVS·7–æ4÷VäG&vW"‚“·&WGW&âG'VS²Ğ¢&WGW&âfÇ6S°¢Ğ¢gVæ7F–öâ&V6÷&D7&—F–6Â†–çWB—°¢–b‚6W76–öçÇÂ6W76–öâæ7F—fR—²&WGW&âfÇ6S²Ğ¢6öç7BWfVçCÖ–çWBbgG—Vöb–çWCÓÓÒ&ö&¦V7B#ö–çWC§¶–C¦–çWGÓ°¢6öç7B6÷W&6SÖf–æD6öÖ&FçB†WfVçBbfWfVçBæ–B“°¢–b‚6÷W&6R—²&WGW&âfÇ6S²Ğ¢6÷W&6Ræ7&—F–6Ä†—G2³Ó°¢7–æ4÷VäG&vW"‚“°¢&WGW&âG'VS°¢Ğ¢gVæ7F–öâf–æ—6‚†–çWB—°¢–b‚6W76–öâ—²&WGW&âf–æÅ6æ6†÷Bbf6÷’†f–æÅ6æ6†÷B“²Ğ¢–b‡6W76–öâæ7F—fR—°¢6W76–öâæ7F—fSÖfÇ6S°¢6W;ZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^sion.result=input&&input.result?String(input.result):null;
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
            name:String(item&&item.name||"Boss æ©Ÿåˆ¶"),
            icon:String(item&&item.icon||""),
            effect:String(item&&item.effect||""),
            trigger:String(item&&item.trigger||"æˆ°é¬¥æ©Ÿåˆ¶è§¸ç™¼"),
            status:String(item&&item.status||"ç”Ÿæ•ˆä¸­"),
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
/* V131 â€” targeted gameplay/UI fixes for request batch 17. */
(function installV131FixBatch(){
    "use strict";

    /*
       â˜… V138ï¼šç¯€å¥æ‹†æˆå…©å€‹æ˜ç¢ºè¦å‰‡ã€‚
       - æ¯ä¸€ä½æœ‰æ•ˆè§’è‰²ï¼æ€ªç‰©å‡ºæ‰‹å¾Œï¼Œç­‰ 1.6 ç§’æ‰è¼ªä¸‹ä¸€ä½ã€‚
       - ä¸€æ•´è¼ªæœ€å¾Œä¸€ä½å‡ºæ‰‹åˆ°ä¸‹ä¸€è¼ªç¬¬ä¸€ä½å‡ºæ‰‹ï¼Œç¸½å…±å›ºå®š 2 ç§’ã€‚

       èˆŠç‰ˆå…±ç”¨ä¸€å€‹ 1.25 ç§’å¸¸æ•¸ï¼Œè€Œä¸”å·²æ­»äº¡çš„ä½‡åˆ—æˆå“¡ä»æœƒé€å€‹
       å‘¼å« finishPlayerAction()ã€æ¯å€‹å†å¤šç­‰ä¸€æ¬¡ï¼Œå°¾ç«¯å‰›å¥½æœ‰
       2ï½3 å€‹æ­»äº¡æˆå“¡æ™‚å°±æœƒç´¯ç©æˆç©å®¶æ„Ÿå—åˆ°çš„ 3ï½5 ç§’ã€‚
       V138 æœƒåœ¨æ’ç¨‹å‰ä¸€æ¬¡ç•¥éæ‰€æœ‰å·²æ­»äº¡ç©ºä½ã€‚2 ç§’ç¸½è½‰å ´ç”±
       0.4 ç§’çš„å›åˆäº¤æ¥ï¼‹1.6 ç§’çš„é¦–ä½å‡ºæ‰‹ç­‰å¾…çµ„æˆï¼Œä¸æœƒéŒ¯ç–Šæˆ
       2+1.6ï¼3.6 ç§’ï¼Œä¹Ÿä¸æœƒå†éš¨æ­»äº¡æ•¸é‡è¶Šæ‹–è¶Šä¹…ã€‚
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œç¶“æ¿Ÿï¼é¤Šæˆé‡æ–°è¨­è¨ˆç¬¬ä¸€è¼ªï¼‰ï¼š
       1. ç²¾è‹±/BOSSçš„æˆ°é¬¥EXPè¦æ¯”æ™®é€šæ€ªé«˜ï¼ˆç²¾è‹±Ã—1.5ã€BOSSÃ—3ï¼‰ï¼Œ
          æ­£å¼æ€ªç‰© EXP ç›´æ¥ä»¥æ€ªç‰©è³‡æ–™å…¬å¼ç”¢ç”Ÿï¼Œå†å¥— rank å€ç‡ï¼›ä¸å†
          é€éå…¨åŸŸæ­·å²å€ç‡è£œæ­£ã€‚
       2. å…ƒç´ åŒ£ï¼ˆè‡ªå‹•æ›æ©Ÿï¼‰æˆ°é¬¥çš„EXPåªçµ¦70%ï¼Œé‡‘å¹£/æ‰è½/ææ–™
          å®Œå…¨ä¸å—å½±éŸ¿ï¼ˆé‚£äº›æ˜¯å¦å¤–ç¨ç«‹çš„å‡½å¼ï¼Œé€™è£¡å®Œå…¨æ²’æœ‰å‹•ï¼‰ã€‚
          ç›®çš„æ˜¯è®“ã€Œæ›æ©Ÿã€æ˜é¡¯æ¯”ã€Œæ‰‹å‹•ç©ã€æ…¢ï¼Œé¿å…ç„¡è…¦æ›æ©Ÿ
          å°±èƒ½åœ¨çŸ­æ™‚é–“è¡åˆ°æ»¿ç­‰ã€‚
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
       35 is the established LvÃ—10 Ã— historical 3.5 result, now encoded at
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
        return hours+"å°æ™‚ "+minutes+"åˆ†é˜";
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
        const labels={ALLY_F1:"å‰å·¦",ALLY_F2:"å‰ä¸­",ALLY_F3:"å‰å³",ALLY_B1:"å¾Œå·¦",ALLY_B2:"å¾Œä¸­",ALLY_B3:"å¾Œå³"};
        return labels[slot]||slot;
    }
    function renderAllyFormationContent(){
        const formation=ensureAllyFormationState();
        if(!formation){ return '<div class="v-fixed-formation-empty">ç›®å‰ç„¡æ³•è®€å–ä½ˆé™£è³‡æ–™ã€‚</div>'; }
        const renderRow=(label,slots)=>'<section class="v-fixed-formation-row"><header>'+label+'</header><div class="v-fixed-formation-slots">'+slots.map(slot=>{
            const index=fixedBattlefieldSlots().getCharacterAtAllySlot(slot);
            const character=Number.isInteger(index)?getPartyCharacterByIndex(index):null;
            const selected=Number.isInteger(index)&&index===vFixedFormationSelectedCharacter;
            return '<button type="button" class="v-fixed-formation-slot'+(selected?' selected':'')+'" data-slot="'+slot+'" onclick="vFixedSelectFormationSlot(\''+slot+'\')">'+
                '<small>'+formationSlotLabel(slot)+'</small><strong>'+(character?(character.id||('è§’è‰²'+(index+1))):'ç©ºä½')+'</strong></button>';
        }).join('')+'</div></section>';
        return '<div class="v-fixed-formation-panel"><p>å…ˆé»è§’è‰²ï¼Œå†é»ç›®æ¨™æ ¼ä½ï¼›è‹¥ç›®æ¨™å·²æœ‰è§’è‰²æœƒç›´æ¥äº¤æ›ã€‚</p>'+renderRow('å‰æ’',fixedBattlefieldSlots().allyFrontSlots)+renderRow('å¾Œæ’',fixedBattlefieldSlots().allyBackSlots)+'</div>';
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
            img.alt="è§’è‰²ç«‹ç¹ª";
            img.draggable=false;
            frame.insertBefore(img,frame.firstChild);
        }
        img.src=getCharacterArtworkPath(character);
        img.alt=(character.id||"è§’è‰²")+"ç«‹ç¹ª";
    }

    window.v131SyncInventoryPortrait=syncInventoryPortrait;

    function syncCharacterCreationAvailability(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const title=document.getElementById("homeFeatureModalTitle");
        if(title && String(title.textContent||"").trim()!=="è§’è‰²"){ return; }
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
                if(oldDot){ oldDot.removµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥æR‚“²Ğ¢&WGW&ã°¢Ğ¢6öç7BVÆ–v–&ÆS×6Æ÷D–æFWƒÓÓÓ¢òÆ–W"æÆWfVÃãÓ ¢¢—5F†—&D6†&7FW%VæÆö6¶VB‚“°¢–b‚VÆ–v–&ÆR—²&WGW&ã²Ğ¢6&Bç7G–ÆRæ÷6—G“Ò##°¢6&Bç7G–ÆRç÷6—F–öãÒ'&VÆF—fR#°¢6&Bç7G–ÆRæ7W'6÷#Ò'ö–çFW"#°¢6&Bæ6Æ74Æ—7BæFB‚'c3×VæÆö6²×&VG’"“°¢6&Bæöæ6Æ–6³ÖgVæ7F–öâ‚—°¢6Æ÷6T†öÖTfVGW&R‚“°¢÷Vä6†&7FW$7&VF–öâ‡6Æ÷DçVÖ&W"“°¢Ó°¢6öç7BÆ&VÇ3Ö6&BçVW'•6VÆV7F÷$ÆÂ‚&F—b"“°¢–b†Æ&VÇ2æÆVæwFƒãÓ2—°¢Æ&VÇ5³ÒçFW‡D6öçFVçCÒ.XúşX›^[»¢#°¢Æ&VÇ5³%ÒçFW‡D6öçFVçCÒ.›¹îi8®X›^[»¢#°¢Ğ¢–b‚6&BçVW'•6VÆV7F÷"‚"çc3×VæÆö6²ÖF÷B"’—°¢6öç7BF÷CÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'7â"“°¢F÷Bæ6Æ74æÖSÒ'c3×VæÆö6²ÖF÷B#°¢F÷Bç6WDGG&–'WFR‚&&–ÖÆ&VÂ"Â.iÈikŠy.ˆ›.XúşX›^[»¢"“°¢6&BæVæD6†–ÆB†F÷B“°¢Ğ¢Ò“°¢Ğ ¢–b‡G—Vöb&Vg&W6„6†&7FW$fF$ÆWfVÇ3ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ&Vg&W6„fF$ÆWfVÇ3×&Vg&W6„6†&7FW$fF$ÆWfVÇ3°¢&Vg&W6„6†&7FW$fF$ÆWfVÇ3ÖgVæ7F–öâ‚—°¢÷&–v–æÅ&Vg&W6„fF$ÆWfVÇ2æÇ’‡F†—2Æ&wVÖVçG2“°¢7–æ46†&7FW$7&VF–öäf–Æ&–Æ—G’‚“°¢Ó°¢Ğ ¢gVæ7F–öâ&öÖ÷FU6¶–ÆÅ&Wf–Wr‚—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆÄVÆVÖVçE6¶–ÆÅ&Wf–WtÖöFÂ"“°¢6öç7B÷fW&Æ“ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖRÖ÷fW&Æ’ÖÆ–W""’ÇÂFö7VÖVçBævWDVÆVÖVçD'”–B‚&vÖR×7FvR"“°¢–b†ÖöFÂbb÷fW&Æ’bbÖöFÂç&VçDæöFRÓÖ÷fW&Æ’—°¢÷fW&Æ’æVæD6†–ÆB†ÖöFÂ“°¢Ğ¢Ğ¢&öÖ÷FU6¶–ÆÅ&Wf–Wr‚“° ¢6öç7BW‡&Wf–Wt6÷VçG3×³£Ã£Ã#£Ó°¢6öç7B÷&–v–æÄF—7G&–'WFTW‡Fô6†&7FW#Ğ¢G—VöbF—7G&–'WFTW‡Fô6†&7FW#ÓÓÒ&gVæ7F–öâ"òF—7G&–'WFTW‡Fô6†&7FW"¢çVÆÃ° ¢gVæ7F–öâ&Wf–Wt6÷7Df÷$6†&7FW"†6†&7FW"Æ6÷VçB—°¢–b‚6†&7FW"ÇÂ6÷VçCÃÓ—²&WGW&â²Ğ¢6öç7BÖ„ÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"‡v–æF÷rçc34Ö„ÆWfVÂ—ÇÄ–æf–æ—G’“°¢6öç7B7F'DÆWfVÃÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ’“°¢–b‡7F'DÆWfVÂ¶6÷VçCæÖ„ÆWfVÂ—²&WGW&â–æf–æ—G“²Ğ ¢ÆWBW‡ÔÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æW‡—ÇÃ“°¢ÆWBW‡æW‡CÔÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æW‡æW‡B—ÇÃ“°¢ÆWB&Wf–WtÆWfVÃ×7F'DÆWfVÃ°¢ÆWBF÷FÃÓ°¢f÷"†ÆWB“Ó¶“Æ6÷VçC¶’²²—°¢6öç7BæVVCÔÖF‚æÖ‚ƒÆW‡æW‡BÖW‡“°¢F÷FÂ³ÖæVVC°¢W‡Ó°¢&Wf–WtÆWfVÂ²³°¢W‡æW‡C×G—Vöbv–æF÷rçc34vWDW‡æW‡Df÷$ÆWfVÃÓÓÒ&gVæ7F–öâ ¢òv–æF÷rçc34vWDW‡æW‡Df÷$ÆWfVÂ‡&Wf–WtÆWfVÂ¢¢ÖF‚æÖ‚†W‡æW‡B³ÄÖF‚æfÆö÷"†W‡æW‡B£ã"’“°¢Ğ¢&WGW&âF÷FÃ°¢Ğ¢v–æF÷rçc3&Wf–Wt6÷7Df÷$6†&7FW#×&Wf–Wt6÷7Df÷$6†&7FW#° ¢gVæ7F–öâF÷FÅ&Wf–Wt6÷7B‚—°¢&WGW&â³ÃÃ%Òç&VGV6R‚‡7VÒÆ–æFW‚“Óç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢&WGW&â7VÒ·&Wf–Wt6÷7Df÷$6†&7FW"†6†&7FW"ÆW‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃ“°¢ÒÃ“°¢Ğ ¢gVæ7F–öâ†4W‡&Wf–Wr‚—°¢&WGW&â³ÃÃ%Òç6öÖR†–æFWƒÓâ†W‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃ“ã“°¢Ğ ¢gVæ7F–öâ&Wf–WtW‡ÆWfVÂ†–æFW‚—°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢–b‚6†&7FW"—²&WGW&ã²Ğ¢6öç7B7W'&VçCÖW‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃ°¢6öç7BÖ„ÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"‡v–æF÷rçc34Ö„ÆWfVÂ—ÇÄ–æf–æ—G’“°¢–b†6†&7FW"æÆWfVÂ¶7W'&VçCãÖÖ„ÆWfVÂ—°¢ÆW'B‚.˜	YŞŠy.ˆ›.[{.˜BÇbâ"¶Ö„ÆWfVÂ²"k»şzØ8""“°¢&WGW&ã°¢Ğ¢6öç7B&Vf÷&T6÷7C×&Wf–Wt6÷7Df÷$6†&7FW"†6†&7FW"Æ7W'&VçB“°¢6öç7BgFW$6÷7C×&Wf–Wt6÷7Df÷$6†&7FW"†6†&7FW"Æ7W'&VçB³“°¢6öç7BW‡G&ÖgFW$6÷7BÖ&Vf÷&T6÷7C°¢–b‡F÷FÅ&Wf–Wt6÷7B‚’¶W‡G&ç6†&VDW‡—°¢ÆW'B‚.{i>š™~kKˆŞ‹k>ûÈÎxJk9^XhŞš	ŠkŞ˜	Kˆ{I®8.˜(N™ÈŠh"´ÖF‚æÖ‚ƒÇF÷FÅ&Wf–Wt6÷7B‚’¶W‡G&×6†&VDW‡’²"U…8""“°¢&WGW&ã°¢Ğ¢W‡&Wf–Wt6÷VçG5¶–æFW…ÓÖ7W'&VçB³°¢&VæFW$W‡F—7G&–'WFTÆ—7B‚“°¢7–æ46†&7FW%&Wf–WtÆWfVÇ2‚“°¢Ğ ¢gVæ7F–öâ7–æ46†&7FW%&Wf–WtÆWfVÇ2‚—°¢³ÃÃ%Òæf÷$V6‚†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢6öç7BVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&6†&7FW$fF$ÆWfVÂ"¶–æFW‚“°¢–b†6†&7FW"bbVÂ—°¢VÂçFW‡D6öçFVçCÒ$Çbâ"²†6†&7FW"æÆWfVÂ²†W‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃ’“°¢VÂæ6Æ74Æ—7BçFövvÆR‚'c3×&Wf–WrÖÆWfVÂ"Â†W‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃ“ã“°¢Ğ¢Ò“°¢Ğ ¢gVæ7F–öâ6æ6VÄW‡&Wf–Wr‚—°¢³ÃÃ%Òæf÷$V6‚†–æFWƒÓç²W‡&Wf–Wt6÷VçG5¶–æFW…ÓÓ²Ò“°¢&VæFW$W‡F—7G&–'WFTÆ—7B‚“°¢–b‡G—Vöb&Vg&W6„6†&7FW$fF$ÆWfVÇ3ÓÓÒ&gVæ7F–öâ"—°¢&Vg&W6„6†&7FW$fF$ÆWfVÇ2‚“°¢Ğ¢Ğ ¢gVæ7F–öâ6öæf—&ÔW‡&Wf–Wr‚—°¢–b‚†4W‡&Wf–Wr‚’ÇÂ÷&–v–æÄF—7G&–'WFTW‡Fô6†&7FW"—²&WGW&ã²Ğ¢6öç7BÆãÕ³ÃÃ%ÒæÖ†–æFWƒÓâ‡°¢–æFW‚À¢6†&7FW#¦vWE'G”6†&7FW$'”–æFW‚†–æFW‚’À¢6÷VçC¤ÖF‚æÖ–â€¢W‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃÀ¢ÖF‚æÖ‚€¢À¢„çVÖ&W"‡v–æF÷rçc34Ö„ÆWfVÂ—ÇÄ–æf–æ—G’’Ğ¢‚†vWE'G”6†&7FW$'”–æFW‚†–æFW‚—ÇÇ·Ò’æÆWfVÇÇÃ¢¢¢Ò’’æf–ÇFW"†VçG'“ÓæVçG'’æ6†&7FW"bbVçG'’æ6÷VçCã“°¢³ÃÃ%Òæf÷$V6‚†–æFWƒÓç²W‡&Wf–Wt6÷VçG5¶–æFW…ÓÓ²Ò“°¢Æâæf÷$V6‚†VçG'“Óç°¢f÷"†ÆWBãÓ¶ãÆVçG'’æ6÷VçC¶â²²—°¢÷&–v–æÄF—7G&–'WFTW‡Fô6†&7FW"†VçG'’æ6†&7FW"“°¢Ğ¢Ò“°¢&VæFW$W‡F—7G&–'WFTÆ—7B‚“°¢7–æ46†&7FW$7&VF–öäf–Æ&–Æ—G’‚“°¢Ğ ¢v–æF÷rçc3&Wf–WtW‡ÆWfVÃ×&Wf–WtW‡ÆWfVÃ°¢v–æF÷rçc36öæf—&ÔW‡&Wf–WsÖ6öæf—&ÔW‡&Wf–Ws°¢v–æF÷rçc36æ6VÄW‡&Wf–WsÖ6æ6VÄW‡&Wf–Ws° ¢–b‡G—Vöb&VæFW$W‡F—7G&–'WFTÆ—7CÓÓÒ&gVæ7F–öâ"—°¢&VæFW$W‡F—7G&–'WFTÆ—7CÖgVæ7F–öâ‚—°¢6öç7B6öçF–æW#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&W‡F—7G&–'WFTÆ—7B"“°¢–b‚6öçF–æW"—²&WGW&ã²Ğ¢6öç7B&÷w3ÖvWDW†—7F–æu'G”–æFW†W2‚’æÖ†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢6öç7B6÷VçCÖW‡&Wf–Wt6÷VçG5¶–æFW…×ÇÃ°¢6öç7B&Wf–WtÆWfVÃÖ6†&7FW"æÆWfVÂ¶6÷VçC°¢6öç7B6÷7C×&Wf–Wt6÷7Df÷$6†&7FW"†6†&7FW"Æ6÷VçB“°¢6öç7BæW‡DW‡G&×&Wf–Wt6÷7Df÷$6†&7FW"†6†&7FW"Æ6÷VçB³’Ö6÷7C°¢6öç7BÖ„ÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"‡v–æF÷rçc34Ö„ÆWfVÂ—ÇÄ–æf–æ—G’“°¢6öç7B—4Ö„ÆWfVÃ×&Wf–WtÆWfVÃãÖÖ„ÆWfVÃ°¢6öç7B6å&Wf–WsÒ—4Ö„ÆWfVÂbbF÷FÅ&Wf–Wt6÷7B‚’¶æW‡DW‡G&Ã×6†&VDW‡°¢&WGW&â€¢sÆF—b6Æ73Ò'c3ÖW‡×&÷r#âr°¢sÆF—b6Æ73Ò'c3ÖW‡ÖæÖR#âr²†6†&7FW"æ–GÇÂ‚.Šy.ˆ›""²†–æFW‚³’’’²sÂöF—câr°¢sÆF—b6Æ73Ò'c3ÖW‡ÖÆWfVÂr²†6÷VçCãòr&Wf–Wrs¢rr’²r#äÇbâr¶6†&7FW"æÆWfVÂ°¢†6÷VçCãòr(i"Çbâr·&Wf–WtÆWfVÂ¢rr’°¢sÂöF—câr°¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'c3ÖW‡×&Wf–WrÖ'Fâ"r°¢†6å&Wf–Wsòrs¢vF—6&ÆVBr’°¢vöæ6Æ–6³Ò'c3&Wf–WtW‡ÆWfVÂ‚r¶–æFW‚²r’#âr°¢†—4Ö„ÆWfVÂò~[{.˜Nk»şzØ’r¢~›¹îi8®š	ŠkŞXØ~{I¢r’²sÂö'WGFöãâr°¢sÂöF—câp¢“°¢Ò’æ¦ö–â‚""“°¢6öç7BÆææVCÖ†4W‡&Wf–Wr‚“°¢6öç7B&W6W'fVC×F÷FÅ&Wf–Wt6÷7B‚“°¢6öçF–æW"æ–ææW$…DÔÃĞ¢&÷w2°¢sÆF—b6Æ73Ò'c3ÖW‡×&Wf–Wr×7VÖÖ'’#îš	ŠkŞkhˆ	~ûÉ¢r·&W6W'fVBçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’²rU…ÂöF—câr°¢sÆF—b6Æ73Ò'c3ÖW‡Ö7F–öç2#âr°¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'c3ÖW‡Ö6öæf—&Ò"r²‡ÆææVCòrs¢vF—6&ÆVBr’°¢vöæ6Æ–6³Ò'c36öæf—&ÔW‡&Wf–Wr‚’#îz+®Zé£Âö'WGFöãâr°¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'c3ÖW‡Ö&6²"r²‡ÆææVCòrs¢vF—6&ÆVBr’°¢vöæ6Æ–6³Ò'c36æ6VÄW‡&Wf–Wr‚’#î‹ùNY¹ãÂö'WGFöãâr°¢sÂöF—câs°¢7–æ46†&7FW%&Wf–WtÆWfVÇ2‚“°¢Ó°¢Ğ ¢gVæ7F–öâÆöDVÆVÖVçD&÷…7FFR‚—°¢G'—°¢6öç7B'6VCÔ¥4ôâç'6R†Æö6Å7F÷&vRævWD—FVÒ„TÄTÔTåEô$õ…ô´U’—ÇÂ'·Ò"“°¢&WGW&â°¢&VÖ–æ–æt×3¤ÖF‚æÖ–â€¢3"£c£c£À¢ÖF‚æÖ‚ƒÄçVÖ&W"‡'6VBç&VÖ–æ–æt×2—ÇÃ¢¢Ó°¢Ö6F6‚…ò—°¢&WGW&â·&VÖ–æ–æt×3£Ó°¢Ğ¢Ğ ¢6öç7BVÆVÖVçD&÷…7FFSÖÆöDVÆVÖVçD&÷…7FFR‚“° ¢gVæ7F–öâ†4ç”WFô&GFÆTVæ&ÆVB‚—°¢&WGW&â€¢WFô&GFÆRÇÀ¢WFô6öæf–ræVæ&ÆVBÇÀ¢‡Æ–W#"bbWFô6öæf–s"æVæ&ÆVB’ÇÀ¢‡Æ–W#2bbWFô6öæf–s2æVæ&ÆVB¢“°¢Ğ ¢ò ¢c3~ûÉ¥c3niÈ>KùŞZÙˆz®X¹^h‹šÊ^™h¾™yÎûÈÎKØnXX>{JXÊ>ˆˆ®x˜jøşjÊ˜xŞik‹ÈXZ^˜;Şh¨ ¢7F—f^Zú¾jÛ¾h‰fÇ6^8.{YiéÎYÎKˆK»Ş[{.YYşyJy¨Nˆz®X¹^ŠŠŞZé®YÊ‡&VÆöN[èÎK¸ŞiÈ0¢ˆz®X¹^X{®h˜¾ûÈÎXÛ¾KˆŞhš>XX>{JXÊ>i˜.i[8U…K™şh.[ê“^8.Xú®Šh˜(NiÈi˜.i[K‰@¢K»¾KˆŠy.ˆ›.y¨Nˆz®X¹^ŠŠŞZé®x+®™h¾ûÈÎ[h.[êYÎKˆX¾XX>{JXÊ>YYşyJx¸hX¾8 ¢¢ğ¢ÆWBVÆVÖVçD&÷„7F—fSĞ¢VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ãb`¢†4ç”WFô&GFÆTVæ&ÆVB‚“°¢ÆWBVÆVÖVçD&÷„Æ7EF–6³ÔFFRææ÷r‚“°¢ÆWBVÆVÖVçD&÷„Æ7EW'6—7CÓ°¢6öç7BVÆVÖVçD&÷…6W76–öã×¶7F—fT×3£Æ&GFÆW3£ÆW‡£ÆvöÆC£Ó° ¢gVæ7F–öâW'6—7DVÆVÖVçD&÷…7FFR‚—°¢G'—°¢Æö6Å7F÷&vRç6WD—FVÒ„TÄTÔTåEô$õ…ô´U’Ä¥4ôâç7G&–æv–g’‡°¢&VÖ–æ–æt×3¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2’¢Ò’“°¢Ö6F6‚…ò—²Ğ¢Ğ ¢gVæ7F–öâ7F÷VÆVÖVçD&÷…v†VåF–ÖTVæG2†ÖW76vR—°¢VÆVÖVçD&÷„7F—fSÖfÇ6S°¢WFô6öæf–ræVæ&ÆVCÖfÇ6S°¢–b‡Æ–W#"—²WFô6öæf–s"æVæ&ÆVCÖfÇ6S²Ğ¢–b‡Æ–W#2—²WFô6öæf–s2æVæ&ÆVCÖfÇ6S²Ğ¢WFô&GFÆSÖfÇ6S°¢–b‡G—VöbWFFTWFô'WGFöãÓÓÒ&gVæ7F–öâ"—²WFFTWFô'WGFöâ‚“²Ğ¢–b‡G—VöbWFFT7F–öä‡VEf—6–&–Æ—G“ÓÓÒ&gVæ7F–öâ"—²WFFT7F–öä‡VEf—6–&–Æ—G’‚“²Ğ¢FD&GFÆTÆör†ÖW76vWÇÂ.XX>{JXÊ>i˜.i[[{.yJZèÎûÈÎˆz®X¹^h‹šÊ^[{.XÎjÚ.8""“°¢–b‡G—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢Ğ ¢gVæ7F–öâ7–æ4VÆVÖVçD&÷„f÷$&GFÆR†÷F–öç2—°¢6öç7B6–ÆVçCÒ†÷F–öç2bb÷F–öç2ç6–ÆVçB“°¢–b††4ç”WFô&GFÆTVæ&ÆVB‚’bbVÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ÃÓ—°¢7F÷VÆVÖVçD&÷…v†VåF–ÖTVæG2€¢6–ÆVç@¢ò.XX>{JXÊ>k).iÈXúşyJi˜.i[ûÈÎˆz®X¹^h‹šÊ^[{.XÎjÚ.8" ¢¢.XX>{JXÊ>k).iÈXúşyJi˜.i[ûÈÎˆz®X¹^h‹šÊ^[{.XÎjÚ.ûÉ¾Š¸¾XXXùn[é~i˜.i[8" ¢“°¢&WGW&âfÇ6S°¢Ğ ¢VÆVÖVçD&÷„7F—fSĞ¢VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ãb`¢†4ç”WFô&GFÆTVæ&ÆVB‚“°¢VÆVÖVçD&÷„Æ7EF–6³ÔFFRææ÷r‚“°¢W'6—7DVÆVÖVçD&÷…7FFR‚“°¢&WGW&âVÆVÖVçD&÷„7F—fS°¢Ğ¢v–æF÷rçc37–æ4VÆVÖVçD&÷„f÷$&GFÆS×7–æ4VÆVÖVçD&÷„f÷$&GFÆS°¢v–æF÷rçc3vWDVÆVÖVçD&÷…7FFSÖgVæ7F–öâ‚—°¢&WGW&â°¢7F—fS¦VÆVÖVçD&÷„7F—fRÀ¢&VÖ–æ–æt×3¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2’¢Ó°¢Ó°¢v–æF÷rçc3w&çDVÆVÖVçD&÷„†÷W'3ÖgVæ7F–öâ††÷W'2ÆÖ„†÷W'2—°¢6öç7B6fT†÷W'3ÔÖF‚æÖ‚ƒÄçVÖ&W"††÷W'2—ÇÃ“°¢6öç7B6×3ÔÖF‚æÖ‚ƒÄçVÖ&W"†Ö„†÷W'2—ÇÃ3"’£c£c£°¢VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ÔÖF‚æÖ–â€¢6×2À¢ÖF‚æÖ‚ƒÆVÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2’·6fT†÷W'2£c£c£ ¢“°¢W'6—7DVÆVÖVçD&÷…7FFR‚“°¢WFFTVÆVÖVçD&÷…7FG5T’‚“°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2’“°¢Ó° ¢gVæ7F–öâF–6´VÆVÖVçD&÷„6Æö6²‚—°¢6öç7Bæ÷sÔFFRææ÷r‚“°¢6öç7BFVÇFÔÖF‚æÖ‚ƒÆæ÷rÖVÆVÖVçD&÷„Æ7EF–6²“°¢VÆVÖVçD&÷„Æ7EF–6³Öæ÷s°¢–b†VÆVÖVçD&÷„7F—fRbbVÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ã—°¢6öç7BW6VCÔÖF‚æÖ–â†FVÇFÆVÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2“°¢VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2Ó×W6VC°¢VÆVÖVçD&÷…6W76–öâæ7F—fT×2³×W6VC°¢–b†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ÃÓ—°¢VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3Ó°¢7F÷VÆVÖVçD&÷…v†VåF–ÖTVæG2‚“°¢Ğ¢Ğ¢–b†æ÷rÖVÆVÖVçD&÷„Æ7EW'6—7CãÓS—°¢VÆVÖVçD&÷„Æ7EW'6—7CÖæ÷s°¢W'6—7DVÆVÖVçD&÷…7FFR‚“°¢Ğ¢WFFTVÆVÖVçD&÷…7FG5T’‚“°¢Ğ ¢gVæ7F–öâVç7W&TVÆVÖVçD&÷…7FG5T’‚—°¢6öç7BæVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&WFô&GFÆU6WGF–æw5æVÂ"“°¢–b‚æVÂ—²&WGW&ã²Ğ¢æVÂæ6Æ74Æ—7BæFB‚'c3ÖVÆVÖVçBÖ&÷‚×æVÂ"“°¢6öç7B6fT'Fã×æVÂçVW'•6VÆV7F÷"‚"æWFò×6fRÖ'Fâ"“°¢–b‡6fT'Fâ—²6fT'FâçFW‡D6öçFVçCÒ.ZY~yJKŠnYYşX¹R#²Ğ¢6öç7B6æ6VÄ'Fã×æVÂçVW'•6VÆV7F÷"‚"æWFòÖ6æ6VÂÖ'Fâ"“°¢–b†6æ6VÄ'Fâ—²6æ6VÄ'Fâç7G–ÆRæF—7Æ“Ò&æöæR#²Ğ¢ÆWB7FG3ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'c3VÆVÖVçD&÷…7FG2"“°¢–b‚7FG2—°¢7FG3ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'6V7F–öâ"“°¢7FG2æ–CÒ'c3VÆVÖVçD&÷…7FG2#°¢7FG2æ6Æ74æÖSÒ'c3ÖVÆVÖVçBÖ&÷‚×7FG2#°¢7FG2æ–ææW$…DÔÃĞ¢sÆF—b6Æ73Ò'c3ÖVÆVÖVçBÖ&÷‚×F—FÆR#îiÊÎjÊKˆ®{y®XX>{JXÊ>{H˜ÈCÂöF—câr°¢sÆF—cãÇ7ãîYYşX¹^{‹Şi˜.i[ƒÂ÷7ããÇ7G&öær–CÒ'c3V$7F—fUF–ÖR#ã[şi˜"Xˆn™	ƒÂ÷7G&öæsãÂöF—câr°¢sÆF—cãÇ7ãîh‹šÊ^jÊi[ƒÂ÷7ããÇ7G&öær–CÒ'c3V$&GFÆW2#ãÂ÷7G&öæsãÂöF—câr°¢sÆF—cãÇ7ãîxÛ.[é~{i>š™sÂ÷7ããÇ7G&öær–CÒ'c3V$W‡#ãÂ÷7G&öæsãÂöF—câr°¢sÆF—cãÇ7ãîxÛ.[é~˜y[š3Â÷7ããÇ7G&öær–CÒ'c3V$vöÆB#ãÂ÷7G&öæsãÂöF—câr°¢sÆF—b6Æ73Ò'&VÖ–æ–ær#ãÇ7ãîXX>{JXÊ>XššIKÛşyJi˜.™i3Â÷7ããÇ7G&öær–CÒ'c3V%&VÖ–æ–ær#ã[şi˜"Xˆn™	ƒÂ÷7G&öæsãÂöF—câs°¢6öç7B7F–öç3×æVÂçVW'•6VÆV7F÷"‚"æWFò×6WGF–æw2Ö7F–öç2"’ÇÂ‡6fT'Fâbb6fT'Fâç&VçDVÆVÖVçB“°¢–b†7F–öç2—²æVÂæ–ç6W'D&Vf÷&R‡7FG2Æ7F–öç2“²Ğ¢VÇ6W²æVÂæVæD6†–ÆB‡7FG2“²Ğ¢Ğ¢WFFTVÆVÖVçD&÷…7FG5T’‚“°¢Ğ ¢gVæ7F–öâWFFTVÆVÖVçD&÷…7FG5T’‚—°¢6öç7B—'3×°¢c3V$7F—fUF–ÖS¦f÷&ÖDGW&F–öâ†VÆVÖVçD&÷…6W76–öâæ7F—fT×2’À¢c3V$&GFÆW3¥7G&–ær†VÆVÖVçD&÷…6W76–öâæ&GFÆW2’À¢c3V$W‡¤ÖF‚æfÆö÷"†VÆVÖVçD&÷…6W76–öâæW‡’çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’À¢c3V$vöÆC¤ÖF‚æfÆö÷"†VÆVÖVçD&÷…6W76–öâævöÆB’çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’À¢c3V%&VÖ–æ–æs¦f÷&ÖDGW&F–öâ†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2¢Ó°¢ö&¦V7Bæ¶W—2‡—'2’æf÷$V6‚†–CÓç°¢6öç7BVÃÖFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°¢–b†VÂ—²VÂçFW‡D6öçFVçC×—'5¶–EÓ²Ğ¢Ò“°¢Ğ ¢ò ¢XX>{JXÊ>y¨N8ÎiÊÎjÊKˆ®{y®xÛ.[é~˜y[š>8ŞXú®Š‰˜ÈNKˆˆŠÎ[zh
®KŠŞZún™©¾XZ^[‹>y¨Nh
®xšhè‰Ş8 ¢XšşiÊÎiÈ>ŠŠŞ{Úâc3$7F—fTGVævVöå'VîûÉµcCy¨N˜xîZIn{+îˆ»hè‰Ş™©N™º.iy~j‰KˆŞiŠşXšşiÊÎûÈÀ¢K¸Ş{jŞhÈY(Îiz.iÈ[zh
®h‹šÊ^{[Šˆy»YÎy¨Nkk^‰8¾zøNYÈŞ8 ¢¢ğ¢gVæ7F–öâ—4VÆVÖVçD&÷„æ÷&ÖÅG&öÄvöÆEG&6¶–æt7F—fR‚—°¢6öç7BGVævVöå'Vã×v–æF÷rçc3$7F—fTGVævVöå'Vã°¢&WGW&â€¢VÆVÖVçD&÷„7F—fRb`¢‚GVævVöå'VâÇÂGVævVöå'VâçcCVÆ—FTG&÷—6öÆF–öãÓÓ×G'VR¢“°¢Ğ ¢gVæ7F–öâ&V6÷&DVÆVÖVçD&÷„Ööç7FW$vöÆB†Ö÷VçB—°¢6öç7B6fTÖ÷VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢–b‡6fTÖ÷VçCÃÓÇÂ—4VÆVÖVçD&÷„æ÷&ÖÅG&öÄvöÆEG&6¶–æt7F—fR‚’—°¢&WGW&ã°¢Ğ¢VÆVÖVçD&÷…6W76–öâævöÆB³×6fTÖ÷VçC°¢WFFTVÆVÖVçD&÷…7FG5T’‚“°¢Ğ ¢–b‡G—Vöbv&DÖöç7FW$vöÆDG&÷ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄv&DÖöç7FW$vöÆDG&÷Öv&DÖöç7FW$vöÆDG&÷°¢v&DÖöç7FW$vöÆDG&÷ÖgVæ7F–öâ‚—°¢6öç7B&6TÖ÷VçCÔÖF‚æÖ‚ƒÄçVÖ&W"†÷&–v–æÄv&DÖöç7FW$vöÆDG&÷æÇ’‡F†—2Æ&wVÖVçG2’—ÇÃ“°¢6öç7B&öçW4Ö÷VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†&6TÖ÷VçB¢…cs3C%ôtÄô$ÅôtôÄEõ$Ut$EôÕTÅD•Ä”U"Ó’’“°¢–b†&öçW4Ö÷VçCã—°¢vöÆB³Ö&öçW4Ö÷VçC°¢–b‡G—VöbWFFTvöÆDF—7Æ“ÓÓÒ&gVæ7F–öâ"—²WFFTvöÆDF—7Æ’‚“²Ğ¢Ğ¢6öç7BÖ÷VçCÖ&6TÖ÷VçB¶&öçW4Ö÷VçC°¢&V6÷&DVÆVÖVçD&÷„Ööç7FW$vöÆB†Ö÷VçB“°¢&WGW&âÖ÷VçC°¢Ó°¢Ğ ¢6öç7B÷&–v–æÄ6öæf—&ÔWFô&GFÆU6WGF–æw3Ğ¢G—Vöb6öæf—&ÔWFô&GFÆU6WGF–æw3ÓÓÒ&gVæ7F–öâ"ò6öæf—&ÔWFô&GFÆU6WGF–æw2¢çVÆÃ° ¢–b†÷&–v–æÄ6öæf—&ÔWFô&GFÆU6WGF–æw2—°¢6öæf—&ÔWFô&GFÆU6WGF–æw3Ö7–æ2gVæ7F–öâ‚—°¢ò ¢)ˆRKúîjÚ>ûÈKéŞxZ~KÛşyJˆ^Y¹îZûÈÎ8Îh‹šÊ^KŠŞ™h¾YYşXX>{JXÊ>ûÈÀ¢ZY~yJYYşX¹^h˜ŞiŠşk).XøŞhx8ŞûÈûÉ ¢˜	šnhÈ˜‰^y¨Nih~ZÙ~Š*¶Vç7W&TVÆVÖVçD&÷…7FG5T’‚iKh‰ ¢8ÎZY~yJKŠnYYşX¹^8ŞûÈÎKØn˜	Š:XéşiÊÎXú®YÎXú°¢÷&–v–æÄ6öæf—&ÔWFô&GFÆU6WGF–æw2‚XK.ZÙŠYjîŠŠŞZé®ûÈÀ¢[éîš
ŞX‹[îk).iÈyÉşy¨Nh¨¦WFô&GFÆ^h™>™h¾(	N(	NxêZënyÈ¾X‹y¨@¢[iŠş8ÎhÈK¨nZY~yJKŠnYYşX¹^ûÈÎyZ¾™Ú.XÛ¾K¸›«Î˜;Şk).Šè®8h‹šÊP¢˜(NiŠşŠhˆz®[{h˜¾X¹^i8ŞKÙÎ8ŞûÈÎ‹yşhÈ˜‰^ih~ZÙ~h›şŠ»îy¨NŠÎx+®[Ğ¢KˆŞ‹[~Kèn8.˜	Š:Š9ÎKˆ®ûÉ®ZY~yJŠŠŞZé®K˜¾[èÎûÈÎZh.iéÎyºîX˜Ş˜(Nk) ¢™h¾ˆz®X¹^h‹šÊ^ûÈÎy»Nhê^YÎXú¾iz.iÈy¨GFövvÆTWFô&GFÆR‚¢ûÈ‹yşhÈ™Ú.iÛşiÈKˆ®™Ú.8ÎYYşX¹^8ŞhÈ˜‰^ZèÎXZYÎKˆZY~˜(ş‹ÊşûÈÀ¢WFô6öæf–röWFô6öæf–s"öWFô6öæf–s>8T8h‹šÊ@¢{H˜ÈN˜;ŞiÈ>Kˆ‹[~jÚ>z+®YÎjÚ^ûÈûÈÎŠé>8ÎZY~yJKŠnYYşX¹^8ŞYŞzÊ`¢X[nZún8.Zh.iéÎxêZën›¹îy¨Ny[nKˆ¾ˆz®X¹^h‹šÊ^X[nZún[{.{i>iŠş™h¾‰~y¨@¢ûÈXú®iŠşh;>iKŠŠŞZé®ûÈûÈÎ[KˆŞŠhXhŞYÎXú¾KˆjÊFövvÆ^ûÈÀ¢˜şXXŞXøŞˆÎh¨®Zè>™yÎhè8 ¢¢ğ¢6öç7B7F—fFSÒ‚“Óç°¢÷&–v–æÄ6öæf—&ÔWFô&GFÆU6WGF–æw2æÇ’‡F†—2Æ&wVÖVçG2“°¢–b‚WFô&GFÆRbbG—VöbFövvÆTWFô&GFÆSÓÓÒ&gVæ7F–öâ"—°¢FövvÆTWFô&GFÆR‚“°¢Ğ¢VÆVÖVçD&÷„7F—fS×G'VS°¢VÆVÖVçD&÷„Æ7EF–6³ÔFFRææ÷r‚“°¢W'6—7DVÆVÖVçD&÷…7FFR‚“°¢FD&GFÆTÆör‚.XX>{JXÊ>[{.YYşX¹^ûÈÎXššI‚"¶f÷&ÖDGW&F–öâ†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×2’².8""“°¢Ó°¢–b†VÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ÃÓ—°¢6öç7BvF6ƒĞ¢G—Vöbv–æF÷rç't6öæf—&ÓÓÓÒ&gVæ7F–öâ"b`¢v—Bv–æF÷rç't6öæf—&Ò€¢.XX>{JXÊ>yºîX˜Şk).iÈXúşyJi˜.i[8%ÆîŠxyÈ¾[º>Y®XúşxÛ.[ér‚[şi˜.XX>{JXÊ>YYşX¹^i˜.i[8%ÆåÆîŠhŠxyÈ¾[º>Y®YxîûÉò"À¢°¢F—FÆS¢.Š9ÎXX^XX>{JXÊ>i˜.i[‚"À¢6öæf—&ÕFW‡C¢.ŠxyÈ¾[º>Y¢"À¢6æ6VÅFW‡C¢.zˆŞ[èÎXhŞŠª¢ ¢Ğ¢“°¢–b‚vF6‚—²&WGW&ã²Ğ¢6†÷u&Wv&FVDB€¢‚“Óç°¢v–æF÷rçc3w&çDVÆVÖVçD&÷„†÷W'2ƒ‚Ã3"“°¢Vç7W&TVÆVÖVçD&÷…7FG5T’‚“°¢7F—fFR‚“°¢ÒÀ¢‚“Óç°¢ÆW'B‚.[º>Y®iÊ®ZèÎh‰ûÈÎiÊ®xÛ.[é~XX>{JXÊ>i˜.i[8""“°¢Ğ¢“°¢&WGW&ã°¢Ğ¢7F—fFR‚“°¢Ó°¢Ğ ¢ò ¢h˜iÈˆ;Ş™h¾YYşˆz®X¹^h‹šÊ^y¨NXZ^Xú>˜;Ş[ø^š{i>˜îXX>{JXÊ>jª.iú^8.ˆˆ®x˜Xú®iI@¢8ÎZY~yJKŠnYYşX¹^8ŞûÈÎh‹šÊT…TNKˆ®y¨Ny»Nhê^Xˆ~hù¾˜Û^XúşKº^ZèÎXZ{™î˜î[º>Y®ˆˆp¢i˜.i[8.k).iÈi˜.i[i˜.KùŞyYh˜¾X¹^x¸hX¾KŠnh™>™h¾ŠŠŞZé®™Ú.iÛşûÉ¾iÈi˜.i[i˜.h˜ŞŠé0¢XéşiÊÎXˆ~hù¾˜(ş‹ÊşYû~ŠÎ8 ¢¢ğ¢–b‡G—VöbFövvÆTWFô&GFÆSÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅFövvÆTWFô&GFÆS×FövvÆTWFô&GFÆS°¢FövvÆTWFô&GFÆSÖgVæ7F–öâ‚—°¢6öç7B—5GW&æ–ætöãÒWFô&GFÆS°¢–b†—5GW&æ–ætöâbbVÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ÃÓ—°¢ÆW'B‚.XX>{JXÊ>yºîX˜Şk).iÈXúşyJi˜.i[ûÈÎŠ¸¾XXŠxyÈ¾[º>Y®Xùn[és[şi˜.i˜.i[8""“°¢–b‡G—Vöb÷Vä†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢÷Vä†öÖTfVGW&R‚&WFô&GFÆU6WGF–æw2"“°¢Ğ¢&WGW&âfÇ6S°¢Ğ ¢6öç7B&W7VÇCÖ÷&–v–æÅFövvÆTWFô&GFÆRæÇ’‡F†—2Æ&wVÖVçG2“°¢7–æ4VÆVÖVçD&÷„f÷$&GFÆR‡·6–ÆVçC§G'VWÒ“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢ò¢7F'D&GFÆR‚iÈ>[éîZÙj©Ny¨FWFô6öæf–~˜xŞikh™>™h¾ˆz®X¹^x¸hX¾ûÉ¾jøşKˆZN™h¾Zx°¢[èÎXhŞYÎjÚ^KˆjÊûÈÎ˜şXX×&VÆöNh‰nˆˆ®ZÙj©Ny»Nhê^{™î˜îXX>{JXÊ>8"¢ğ¢–b‡G—Vöb7F'D&GFÆSÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ7F'D&GFÆS×7F'D&GFÆS°¢7F'D&GFÆSÖgVæ7F–öâ‚—°¢6öç7B6Æ÷D÷væW#Öf—†VD&GFÆVf–VÆE6Æ÷G2‚“°¢–b‡6Æ÷D÷væW"—²6Æ÷D÷væW"æ6ÆV$7F—fTVæV×•6æ6†÷B‚“²Ğ¢–b††4ç”WFô&GFÆTVæ&ÆVB‚’bbVÆVÖVçD&÷…7FFRç&VÖ–æ–æt×3ÃÓ—°¢7F÷VÆVÖVçD&÷…v†VåF–ÖTVæG2‚.XX>{JXÊ>k).iÈXúşyJi˜.i[ûÈÎˆz®X¹^h‹šÊ^[{.XÎjÚ.8""“°¢Ğ¢6öç7B&W7VÇCÖ÷&–v–æÅ7F'D&GFÆRæÇ’‡F†—2Æ&wVÖVçG2“°¢–b†&GFÆT7F—fR—°¢Vç7W&TVæV×”f÷&ÖF–öå6æ6†÷B†7W'&VçD&GFÆTÖöç7FW'2“°¢7–æ4VÆVÖVçD&÷„f÷$&GFÆR‡·6–ÆVçC§G'VWÒ“°¢Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b‡G—Vöb÷Vä†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ÷Vä†öÖTfVGW&SÖ÷Vä†öÖTfVGW&S°¢÷Vä†öÖTfVGW&SÖgVæ7F–öâ‡G—R—°¢6öç7B&W7VÇCÖ÷&–v–æÄ÷Vä†öÖTfVGW&RæÇ’‡F†—2Æ&wVÖVçG2“°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b†ÖöFÂ—²ÖöFÂæ6Æ74Æ—7BçFövvÆR‚'c3×6†÷Ö÷Vâ"ÇG—SÓÓÒ'6†÷"“²Ğ¢–b‡G—SÓÓÒ&6†&7FW""—²7–æ46†&7FW$7&VF–öäf–Æ&–Æ—G’‚“²Ğ¢–b‡G—SÓÓÒ&WFô&GFÆU6WGF–æw2"—²Vç7W&TVÆVÖVçD&÷…7FG5T’‚“²Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b‡G—Vöb6Æ÷6T†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ6Æ÷6T†öÖTfVGW&SÖ6Æ÷6T†öÖTfVGW&S°¢6Æ÷6T†öÖTfVGW&SÖgVæ7F–öâ‚—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b†ÖöFÂ—²ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'c3×6†÷Ö÷Vâ"“²Ğ¢&WGW&â÷&–v–æÄ6Æ÷6T†öÖTfVGW&RæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢ÆWBc3VæF–ætW‡Fö7CÓ°¢–b‡G—Vöb6†÷tW‡Fö7CÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷tW‡Fö7C×6†÷tW‡Fö7C°¢6†÷tW‡Fö7CÖgVæ7F–öâ†Ö÷VçB—°¢6öç7BF—7Æ”Ö÷VçC×c3VæF–ætW‡Fö7Cãòc3VæF–ætW‡Fö7B¢Ö÷VçC°¢c3VæF–ætW‡Fö7CÓ°¢&WGW&â÷&–v–æÅ6†÷tW‡Fö7Bæ6ÆÂ‡F†—2ÆF—7Æ”Ö÷VçB“°¢Ó°¢Ğ ¢–b‡G—Vöbv–ä&GFÆSÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅv–ä&GFÆS×v–ä&GFÆS°¢v–ä&GFÆSÖgVæ7F–öâ‚—°¢–b‚&GFÆT7F—fR—²&WGW&â÷&–v–æÅv–ä&GFÆRæÇ’‡F†—2Æ&wVÖVçG2“²Ğ ¢ò ¢fÆKZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^ExpGainï¼šè·ŸåŸæœ¬winBattle()å…§éƒ¨è‡ªå·±æœƒç®—ã€
               ç›´æ¥åŠ é€²sharedExpçš„æ•¸å­—å®Œå…¨ä¸€æ¨£ç®—æ³•ï¼ˆç­‰ç´šÃ—10ï¼Œ
               ä¸å«rankå€ç‡ã€ä¸å«æ­£å¼æ€ªç‰© EXP å·®é¡ï¼‰â€”â€”ç”¨ä¾†æ¨ç®—ã€ŒåŸæœ¬
               å‡½å¼é€™æ¬¡æœƒè‡ªå·±åŠ å¤šå°‘ã€ï¼Œæ‰èƒ½æ­£ç¢ºç®—å‡ºé‚„è¦ã€Œè£œå¤šå°‘
               å·®é¡ã€ï¼Œä¸æœƒè·ŸåŸæœ¬çš„è¨ˆç®—é‡è¤‡ç–ŠåŠ ã€‚
            */
            const flatExpGain=currentBattleMonsters.reduce(
                (total,index)=>total+(monsters[index] ? (Number(monsters[index].level)||0)*10 : 0),
                0
            );

            /* æ­£å¼å·¡æ€ª EXP åªèµ° calculateStandardPatrolExp()ï¼š
               æ­£å¼æ€ªç‰© EXP Ã— rankï¼›V173.42 Ã—3 åƒ…ä¿ç•™ Lv1ï½19 å¿«é€ŸæœŸã€‚
               Lv20 èµ·ä¸å†æœ‰ç¬¬äºŒå€‹å…¨åŸŸ Ã—3ã€‚ */
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

            /* å…ƒç´ åŒ£ï¼ˆè‡ªå‹•æ›æ©Ÿï¼‰åªçµ¦70%EXPï¼Œé‡‘å¹£/æ‰è½/ææ–™ä¸å—å½±éŸ¿
               ï¼ˆé‚£äº›å„è‡ªç¨ç«‹çš„å‡½å¼å®Œå…¨æ²’æœ‰è¢«é€™è£¡å‹•åˆ°ï¼‰ã€‚ */
            const isElementBoxBattle=elementBoxActive;
            let restedExpResult=null;
            if(isElementBoxBattle){
                /* â˜… ç”¨Math.roundä¸ç”¨Math.floorï¼š700*0.7åœ¨æµ®é»æ•¸é‹ç®—ä¸‹
                   æœƒæ˜¯489.999999...ï¼ŒMath.flooræœƒèª¤å·®æ‰£æ‰1é»EXPï¼Œ
                   Math.roundæ‰æœƒæ­£ç¢ºç®—å‡º490ã€‚ */
                finalExp=applyPatrolExpMode(finalExp,{elementBox:true});
            }else if(typeof window.v139TryConsumeRestedBattle==="function"){
                /* V139ä¼‘æ¯ç¶“é©—åªå…è¨±ä¸€èˆ¬ç·´åŠŸæˆ°é¬¥ä½¿ç”¨ã€‚å‰¯æœ¬å‹åˆ©ç”±
                   js/27å…ˆæ””æˆªï¼Œä¸æœƒèµ°é€²é€™å€‹ä¸€èˆ¬winBattle wrapperï¼›
                   å…ƒç´ åŒ£å‰‡åœ¨ä¸Šé¢çš„åˆ†æ”¯æ˜ç¢ºæ’é™¤ï¼Œä¸æœƒæ¶ˆè€—å ´æ•¸ã€‚ */
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
                        ? "æˆ°é¬¥ç¶“é©—ï¼ˆå…ƒç´ åŒ£æ”¶ç›Š70%ï¼‰ï¼š"
                        : restedExpResult && restedExpResult.applied
                        ? "æˆ°é¬¥ç¶“é©—ï¼ˆå«ä¼‘æ¯ç¶“é©—åŠ æˆï¼‰ï¼š"
                        : "æˆ°é¬¥ç¶“é©—ï¼š")+
                    "æœ¬å ´å…± "+finalExp+" EXPã€‚"
                );
                if(restedExpResult && restedExpResult.applied){
                    addBattleLog(
                        "ä¼‘æ¯ç¶“é©—å·²ç”Ÿæ•ˆï¼Œå‰©é¤˜ "+
                        restedExpResult.remainingBattles+
                        " å ´ã€‚"
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
   V132 â€” æ–°å¢é“å…·ï¼ˆç¬¦å’’ï¼‰ã€ææ–™ï¼ˆç¤¦çŸ³ï¼è£å‚™è¨­è¨ˆåœ–ï¼‰ã€
   è£å‚™å¥—è£ï¼ˆèµ¤ç‚ï¼å¯’æ³‰ï¼å²©å²³ï¼é’åµï¼‰ã€æŠ½çåˆ¸ã€
   ä¸‰å€‹æ—¥å¸¸å‰¯æœ¬ï¼ˆç¶“é©—ï¼ææ–™ï¼è£å‚™ï¼‰ã€‚

   â˜… æ•´é«”è¨­è¨ˆåŸå‰‡ï¼š
   1. å„˜é‡é‡ç”¨æ—¢æœ‰å‡½å¼ï¼ˆmakeZoneMonster()ç”¢ç”Ÿæ€ªç‰©ã€
      processNextCombatant()ç­‰å›åˆå¼•æ“ã€renderBattle()/
      showPage()ç­‰æ—¢æœ‰UIæ¸²æŸ“ã€showRewardedAd()å»£å‘Šé›™å€
      é ˜å–ï¼‰ï¼Œä¸é‡æ–°ç™¼æ˜ä¸€å¥—æˆ°é¬¥/æ¸²æŸ“é‚è¼¯ï¼Œé™ä½é¢¨éšªã€‚
   2. å‰¯æœ¬æ€ªç‰©å€Ÿç”¨ã€Œmonstersé€™å€‹å…¨åŸŸé™£åˆ—æœ¬ä¾†å°±æ˜¯å¯ä»¥æ•´åŒ…
      æ›¿æ›ã€çš„æ—¢æœ‰æ…£ä¾‹ï¼ˆåˆ‡æ›ç·´åŠŸå€åŸŸæ™‚å°±æ˜¯ç›´æ¥æ•´åŒ…æ¢æˆ
      å°æ‡‰å€åŸŸçš„é™£åˆ—ï¼Œè¦‹js/00-main.jsã€Œç›®å‰æ‰€åœ¨å€åŸŸçš„æ€ªç‰©
      è³‡æ–™ã€é‚£æ®µè¨»è§£ï¼‰â€”â€”é€²å‰¯æœ¬å‰å…ˆè¨˜ä½åŸæœ¬çš„monsters/
      currentZoneï¼Œå‰¯æœ¬çµæŸå¾Œå®Œæ•´é‚„åŸï¼Œä¸æœƒå¼„å£å·¡æ€ªç³»çµ±ã€‚
   3. ç´ æ/è£å‚™è¦–è¦ºå…ˆç”¨ç´”CSS+inline SVGåšå‡ºæœ‰è¾¨è­˜åº¦çš„
      è‰²å¡Šåœ–ç¤ºï¼ˆä¾ç…§ä½¿ç”¨è€…æŒ‡ç¤ºã€Œå…ˆæš«æ™‚ç”¨CSS/JavaScript
      å‹•ç•«+Canvas/SVG/WebGL/Shaderåšå‡ºä¾†ï¼Œå¾ŒæœŸå†ç”¨ç¾è¡“
      æ›´æ”¹ã€ï¼‰ï¼Œä¸åšéåº¦è¤‡é›œçš„å³æ™‚é‹ç®—åœ–å½¢ï¼Œå…ˆæ±‚æ­£ç¢ºã€
      å¥½ç¶­è­·ã€‚
*/
(function installV132ContentExpansion(){
    "use strict";

    /* =====================================================
       0. å…±ç”¨å°å·¥å…·
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
       â˜… ä¿®æ­£ï¼ˆæ ¹æºå•é¡Œï¼‰ï¼šç‰©å“æ¸…å–®æ ¼ï¼ˆinventory-iconï¼‰è·Ÿ
       è£å‚™æ¬„ï¼ˆinventory-equipment-iconï¼‰éƒ½æ˜¯ç”¨innerHTML
       å¡item.iconï¼ŒSVGå­—ä¸²èƒ½æ­£å¸¸æ¸²æŸ“ï¼›ä½†ç‰©å“è©³ç´°å½ˆçª—
       ï¼ˆopenItemModal()/openEquippedItem()ï¼‰æ˜¯ç”¨
       textContentå¡item.iconï¼ŒSVGå­—ä¸²æœƒè¢«ç•¶æˆç´”æ–‡å­—
       åŸæ¨£å°å‡ºä¾†ï¼Œè®Šæˆä¸€æ•´ä¸²çœ‹ä¸æ‡‚çš„<svg>æ¨™ç±¤æ–‡å­—ã€‚
       é€™è£¡åœ¨DOMæ¸²æŸ“å®Œä¹‹å¾Œï¼ŒæŠŠåœ–ç¤ºå…ƒç´ å¾textContent
       æ”¹å›innerHTMLï¼Œå…©å€‹å‡½å¼éƒ½è£œé€™å€‹æ”¶å°¾ï¼Œä¸ç”¨æ•´å€‹
       è¤‡å¯«é€™å…©å€‹å‡½å¼æœ¬é«”ã€‚
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå¥—è£æ•ˆæœé¡¯ç¤ºå†é»æ“Šè£å‚™çš„æ™‚å€™
       å°±æ‡‰è©²é¡¯ç¤ºã€ï¼‰ï¼šä¸ç®¡æ˜¯é»èƒŒåŒ…è£¡é‚„æ²’ç©¿çš„å¥—è£ç‰©å“ï¼Œé‚„æ˜¯é»
       å·²ç¶“ç©¿åœ¨èº«ä¸Šçš„å¥—è£ç‰©å“ï¼Œéƒ½åœ¨ç‰©å“è©³ç´°å½ˆçª—è£œä¸Šã€Œç›®å‰é€™ä»¶
       æ‰€å±¬å¥—è£ï¼Œé€™å€‹è§’è‰²èº«ä¸Šå·²ç¶“ç©¿äº†å¹¾ä»¶ï¼5ä»¶ã€è·Ÿå…©æ¢å¥—è£åŠ æˆ
       èªªæ˜ï¼Œæœªé”æˆçš„é–€æª»ç”¨ã€Œæœªå•Ÿå‹•ã€+è¼ƒæš—çš„æ¨£å¼å‘ˆç¾ï¼Œå·²é”æˆçš„
       ç”¨ã€Œå·²å•Ÿå‹•ã€+è¼ƒäº®çš„æ¨£å¼å‘ˆç¾ï¼Œä¸€çœ¼å°±èƒ½çœ‹å‡ºé›¢ä¸‹ä¸€éšæ•ˆæœ
       é‚„å·®å¹¾ä»¶ã€‚é€™è£¡åˆ»æ„åªã€Œé™„åŠ ã€åœ¨æ—¢æœ‰statså€å¡Šå¾Œé¢ï¼Œä¸å»
       å‹•getStatText()æœ¬èº«çš„è¼¸å‡ºï¼Œä¸€èˆ¬è£å‚™/éå¥—è£ç‰©å“å®Œå…¨ä¸å—
       å½±éŸ¿ï¼ˆitem.setIdä¸å­˜åœ¨æ™‚ç›´æ¥è·³éï¼‰ã€‚
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
            'è£å‚™ä¸‰ä»¶ã€€å…¨èƒ½åŠ›+1ã€€'+(threeActive ? "[å·²å•Ÿå‹•]" : "[æœªå•Ÿå‹•]")+
            '</div>'+
            '<div class="v132-set-bonus'+(fiveActive ? " active" : " inactive")+'">'+
            'è£å‚™äº”ä»¶ã€€'+escapeHtml(elementName)+'å…ƒç´ æŠ€èƒ½å‚·å®³+2%ã€€'+(fiveActive ? "[å·²å•Ÿå‹•]" : "[æœªå•Ÿå‹•]")+
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
       1. åœ–ç¤ºç”¢ç”Ÿå™¨ï¼ˆç´”CSS/SVGè‰²å¡Šï¼Œå…ˆæ±‚æœ‰è¾¨è­˜åº¦ï¼‰
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
        setFire:{main:"#d94a2a",glow:"#ffb37a",label:"èµ¤ç‚"},
        setWater:{main:"#2a7ed9",glow:"#9ed4ff",label:"å¯’æ³‰"},
        setEarth:{main:"#b3792a",glow:"#f0c987",label:"å²©å²³"},
        setWind:{main:"#2fa870",glow:"#a8f0cf",label:"é’åµ"}
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
       2. æ­£å¼éšç´šèˆ‡ç¬¦å’’ï¼ˆç¬¦å’’å›ºå®šåªåˆ°æ©™éšï¼‰
       - èˆŠ Low/Mid/High/Perfect åƒ…ä¿ç•™åœ¨ç©©å®š idï¼Œå…¼å®¹èˆŠå­˜æª”ã€‚
       - æ­£å¼ tierKey ä¸€å¾‹ä½¿ç”¨ white/blue/purple/orange/pink/four-symbolã€‚
    ===================================================== */

    const FORMAL_ITEM_TIERS=[
        {key:"white",label:"ç™½éš",legacyKey:"low",idSuffix:"Low",available:true},
        {key:"blue",label:"è—éš",legacyKey:"mid",idSuffix:"Mid",available:true},
        {key:"purple",label:"ç´«éš",legacyKey:"high",idSuffix:"High",available:true},
        {key:"orange",label:"æ©™éš",legacyKey:"perfect",idSuffix:"Perfect",available:true},
        {key:"pink",label:"æ¡ƒç´…éš",legacyKey:null,idSuffix:"Pink",available:false,planned:true},
        {key:"four-symbol",label:"å››è±¡éš",legacyKey:null,idSuffix:"FourSymbol",available:false,planned:true}
    ];
    const TALISMAN_ACTIVATION_CHANCES=[35,55,75,100];
    const TALISMAN_TIERS=FORMAL_ITEM_TIERS.slice(0,4).map((tier,index)=>
        Object.assign({},tier,{chance:TALISMAN_ACTIVATION_CHANCES[index]})
    );
    const RESOURCE_TIERS=FORMAL_ITEM_TIERS.slice();

    window.v17360FormalItemTiers=FORMAL_ITEM_TIERS.map(tier=>Object.assign({},tier));

    const TALISMAN_EFFECTS=[
        {key:"freeze",label:"å†°å°ç¬¦",duration:4},
        {key:"stealth",label:"éš±èº«ç¬¦",duration:2},
        {key:"barrier",label:"çµç•Œç¬¦",duration:4}
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
       3. ç¤¦çŸ³ææ–™ï¼ˆæ­£å¼å…­éšï¼›æ¡ƒç´…ï¼å››è±¡å…ˆè¦åŠƒã€ä¸é€²ç›®å‰æ‰è½ï¼‰
    ===================================================== */

    const oreDefinitions=RESOURCE_TIERS.map(tier=>({
        id:"ore"+tier.idSuffix,
        name:tier.label+"ç¤¦çŸ³",
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
        return oreDefinitions.find(def=>def.tiµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥æW$¶W“ÓÓ×F–W$¶W’—ÇÆçVÆÃ°¢Ğ¢v–æF÷rçc3$vWD÷&TFVf–æ—F–öä'•F–W#ÖvWD÷&TFVf–æ—F–öä'•F–W#°  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢BâŠ9ŞX)ŠŠŞŠˆYÉn{IûÈƒ^˜:KØÒ9rjÚ>[ÈşXZŞ™¨â9rN{;¾X‰~ûÈ¢j>{H^ûÈşY¹¾‹XX[»®z¸¾‹8~ii{Yjx¾ûÉ¾yºîX˜ŞiÙiiZûnzëKˆŞiÈ>h«ŞX‹8 ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢6öç7B$ÅTU$”åEõ4ÄõE3Õ°¢¶¶W“¢&†VB"ÆÆ&VÃ¢.š
Ş˜:‚'ÒÀ¢¶¶W“¢'6†÷VÆFW""ÆÆ&VÃ¢.ŠÛ~ˆYR'ÒÀ¢¶¶W“¢'6†öW2"ÆÆ&VÃ¢.™è¾ZÙ'ÒÀ¢¶¶W“¢&†æB"ÆÆ&VÃ¢.jÚnYš‚'ÒÀ¢¶¶W“¢&&Ö÷""ÆÆ&VÃ¢.Š>iÈÒ'Ğ¢Ó° ¢6öç7B$ÅTU$”åEõ4U$”U3Õ°¢¶–C¢'6WDf—&R"ÆÆ&VÃ¢.‹ZNx(â'ÒÀ¢¶–C¢'6WEvFW""ÆÆ&VÃ¢.Zù.k8’'ÒÀ¢¶–C¢'6WDV'F‚"ÆÆ&VÃ¢.[*[+2'ÒÀ¢¶–C¢'6WEv–æB"ÆÆ&VÃ¢.™Ù.[Y'Ğ¢Ó° ¢6öç7B&ÇVW&–çDFVf–æ—F–öç3ÕµÓ°¢$ÅTU$”åEõ4ÄõE2æf÷$V6‚‡6Æ÷CÓç°¢$U4õU$4UõD”U%2æf÷$V6‚‡F–W#Óç°¢$ÅTU$”åEõ4U$”U2æf÷$V6‚‡6W&–W3Óç°¢&ÇVW&–çDFVf–æ—F–öç2çW6‚‡°¢–C¢&&ÇVW&–çB"·6W&–W2æ–Bç&WÆ6R‚'6WB"Â""’·6Æ÷Bæ¶W’æ6†$Bƒ’çFõWW$66R‚’·6Æ÷Bæ¶W’ç6Æ–6Rƒ’·F–W"æ–E7Vff—‚À¢æÖS§6W&–W2æÆ&VÂ·F–W"æÆ&VÂ·6Æ÷BæÆ&VÂ².ŠŠŞŠˆYÉb"À¢–6öã¦&ÇVW&–çD–6öâ‡6Æ÷Bæ¶W’ÇF–W"æ¶W’’À¢G—S¢&ÖFW&–Â"À¢&ÇVW&–çE6Æ÷C§6Æ÷Bæ¶W’À¢F–W$¶W“§F–W"æ¶W’À¢ÆVv7•F–W$¶W“§F–W"æÆVv7”¶W’À¢f–Æ&ÆS§F–W"æf–Æ&ÆRÓÖfÇ6RÀ¢ÆææVC§F–W"çÆææVCÓÓ×G'VRÀ¢6WD–C§6W&–W2æ–BÀ¢&–6S£À¢7FG3§·Ğ¢Ò“°¢Ò“°¢Ò“°¢Ò“° ¢gVæ7F–öâvWD&ÇVW&–çDFVf–æ—F–öç4'•F–W"‡F–W$¶W’—°¢&WGW&â&ÇVW&–çDFVf–æ—F–öç2æf–ÇFW"†FVcÓæFVbçF–W$¶W“ÓÓ×F–W$¶W’“°¢Ğ  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢RâŠ9ŞX)ZY~Š9Şh«ŞxØîX‹ûÈ‹ZNx(îûÈşZù.k8ûÈş[*[+>ûÈş™Ù.[YûÈ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢6öç7BF–6¶WDFVf–æ—F–öç3Õ°¢¶–C¢'F–6¶WE6WDf—&R"ÆæÖS¢.‹ZNx(îŠ9ŞX)h«ŞxØîX‹‚"Ç6WD–C¢'6WDf—&R"Æ–6öã§F–6¶WD–6öâ‚&f—&R"—ÒÀ¢¶–C¢'F–6¶WE6WEvFW""ÆæÖS¢.Zù.k8Š9ŞX)h«ŞxØîX‹‚"Ç6WD–C¢'6WEvFW""Æ–6öã§F–6¶WD–6öâ‚'vFW""—ÒÀ¢¶–C¢'F–6¶WE6WDV'F‚"ÆæÖS¢.[*[+>Š9ŞX)h«ŞxØîX‹‚"Ç6WD–C¢'6WDV'F‚"Æ–6öã§F–6¶WD–6öâ‚&V'F‚"—ÒÀ¢¶–C¢'F–6¶WE6WEv–æB"ÆæÖS¢.™Ù.[YŠ9ŞX)h«ŞxØîX‹‚"Ç6WD–C¢'6WEv–æB"Æ–6öã§F–6¶WD–6öâ‚'v–æB"—Ğ¢ÒæÖ†&6SÓäö&¦V7Bæ76–vâ‡°¢G—S¢'F–6¶WB"À¢&–6S£À¢7FG3§·Ğ¢ÒÆ&6R’“° ¢gVæ7F–öâvWEF–6¶WDFVf–æ—F–öâ†–B—°¢&WGW&âF–6¶WDFVf–æ—F–öç2æf–æB†FVcÓæFVbæ–CÓÓÖ–B—ÇÆçVÆÃ°¢Ğ ¢ò ¢ccûÉ®h«ŞxØîX‹YÉniKx+¢–æ&÷‚hùKé¾y¨Bär[èÎûÈÎˆˆ®ZÙj©NK¸ŞiÈ>KùŞyY¢y[ni˜.Zú¾XZ^xšK»nŠ:y¨B–æÆ–æR5d~ûÈh‰nz›¢–6öîûÈ8.KéŞzšZé¢–BXú®YÎjÚP¢Y¹¾[Ë^h«ŞxØîX‹y¨N[^zK®‹8~iiûÈÎKˆŞz+i[˜xş8hè‰Şˆˆ~ZY~Š9ŞŠ9ŞX)iÊÎš¹N8 ¢¢ğ¢gVæ7F–öâ7–æ5F–6¶WE&W6VçFF–öâ†—FVÒÆFVf–æ—F–öâ—°¢–b‚—FVÒÇÂFVf–æ—F–öâÇÂ—FVÒæ–BÓÖFVf–æ—F–öâæ–B—²&WGW&â—FVÓ²Ğ¢—FVÒææÖSÖFVf–æ—F–öâææÖS°¢—FVÒæ–6öãÖFVf–æ—F–öâæ–6öã°¢—FVÒçG—SÖFVf–æ—F–öâçG—S°¢—FVÒç6WD–CÖFVf–æ—F–öâç6WD–C°¢—FVÒç&–6SÖFVf–æ—F–öâç&–6S°¢&WGW&â—FVÓ°¢Ğ ¢gVæ7F–öâ‡–G&FT÷væVEF–6¶WE&W6VçFF–öâ‚—°¢–çfVçF÷'”—FV×2æf÷$V6‚†—FVÓÓç°¢6öç7BFVf–æ—F–öãÖ—FVÒbfvWEF–6¶WDFVf–æ—F–öâ†—FVÒæ–B“°¢–b†FVf–æ—F–öâ—²7–æ5F–6¶WE&W6VçFF–öâ†—FVÒÆFVf–æ—F–öâ“²Ğ¢Ò“°¢Ğ ¢gVæ7F–öâ7–æ57FF–46öçFVçE&W6VçFF–öâ†—FVÒÆFVf–æ—F–öâ—°¢–b‚—FVÒÇÂFVf–æ—F–öâÇÂ—FVÒæ–BÓÖFVf–æ—F–öâæ–B—²&WGW&â—FVÓ²Ğ¢°¢&æÖR"Â&–6öâ"Â'G—R"Â'&–6R"Â'6WD–B"Â'F–W$¶W’"Â&ÆVv7•F–W$¶W’"Â&f–Æ&ÆR"Â'ÆææVB"Â&&ÇVW&–çE6Æ÷B"À¢'FÆ—6ÖäVffV7B"Â'FÆ—6ÖäGW&F–öâ"Â'F–W$6†æ6R"Â'6†&VE6¶–ÆÄ–B"Â'FÆ—6Öå6¶–ÆÄÆWfVÂ ¢Òæf÷$V6‚†¶W“Óç°¢–b„ö&¦V7Bç&÷F÷G—Ræ†4÷vå&÷W'G’æ6ÆÂ†FVf–æ—F–öâÆ¶W’’—°¢—FVÕ¶¶W•ÓÖFVf–æ—F–öå¶¶W•Ó°¢Ğ¢Ò“°¢–b‚—FVÒç7FG2ÇÂG—Vöb—FVÒç7FG2ÓÒ&ö&¦V7B"—²—FVÒç7FG3×·Ó²Ğ¢&WGW&â—FVÓ°¢Ğ ¢gVæ7F–öâ‡–G&FT÷væVE7FF–46öçFVçE&W6VçFF–öâ‚—°¢6öç7BFVf–æ—F–öç3ÕµÒæ6öæ6B‡FÆ—6ÖäFVf–æ—F–öç2Æ÷&TFVf–æ—F–öç2Æ&ÇVW&–çDFVf–æ—F–öç2“°¢6öç7BFVf–æ—F–öä'”–CÖæWrÖ†FVf–æ—F–öç2æÖ†FVf–æ—F–öãÓå¶FVf–æ—F–öâæ–BÆFVf–æ—F–öåÒ’“°¢–çfVçF÷'”—FV×2æf÷$V6‚†—FVÓÓç°¢6öç7BFVf–æ—F–öãÖ—FVÒbfFVf–æ—F–öä'”–BævWB†—FVÒæ–B“°¢–b†FVf–æ—F–öâ—²7–æ57FF–46öçFVçE&W6VçFF–öâ†—FVÒÆFVf–æ—F–öâ“²Ğ¢Ò“°¢Ğ  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢bâŠ9ŞX)ZY~Š9ŞiÊÎš¹NûÈƒNXX>{J9rK»nûÈÎX[CK»nûÈ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢ò ¢jøşX¾XX>{JZY~Š9ÓK»nûÉÓ^X¾˜:KØŞ8jøşX¾˜:KØŞYC.zŠîŠè®š¹@¢ûÈxšynY	ûÈşk9^Š>Y	ûÈûÈÎ[ŞhxX‹iz.iÈy¨CnX¾Š9ŞX)jÈNKØŞKŠŞy¨@¢^X¾ûÈ††VBö†æB÷6†÷VÆFW"ö&Ö÷"÷6†öW>ûÈûÈÎ‹yşŠ9ŞX)¢ŠŠŞŠˆYÉn{Ikk^‰8¾y¨N˜:KØŞZèÎXZ[Ş›Ø®ûÈÎh‰.hÈr‡&–ær˜	jÊk).iÈ¢ZY~Š9ŞjËî[ÈşûÈÎ{jŞhÈXéşiÈXúşŠ9ŞX)xšY8XÛ>Xúş8 ¢¢ğ ¢6öç7BUT•ÔTåEõ4UEõ”T4U3Õ°¢¶¶W“¢&&ÆFR"Ç6Æ÷C¢'vVöâ"ÆæÖS¢.Xˆ"Ç7FG3§¶GF6³£Çf—FÆ—G“¢Ó'×ÒÀ¢¶¶W“¢&fâ"Ç6Æ÷C¢'vVöâ"ÆæÖS¢.h˜r"Ç7FG3§¶–çFVÆÆ–vVæ6S£Çf—FÆ—G“¢Ó'×ÒÀ¢¶¶W“¢&†Vg”&Ö÷""Ç6Æ÷C¢&&Ö÷""ÆæÖS¢.˜ê~yK""Ç7FG3§¶GF6³£RÇ7—&—C£W×ÒÀ¢¶¶W“¢'&ö&R"Ç6Æ÷C¢&&Ö÷""ÆæÖS¢.Š(Ò"Ç7FG3§¶–çFVÆÆ–vVæ6S£RÇ7—&—C£W×ÒÀ¢¶¶W“¢&&ö÷G2"Ç6Æ÷C¢'6†öW2"ÆæÖS¢.™ÛB"Ç7FG3§¶v–Æ—G“£×ÒÀ¢¶¶W“¢'6†öW2"Ç6Æ÷C¢'6†öW2"ÆæÖS¢.[R"Ç7FG3§¶v–Æ—G“£×ÒÀ¢¶¶W“¢&†VÆÒ"Ç6Æ÷C¢&†VB"ÆæÖS¢.y¹B"Ç7FG3§¶GF6³£'×ÒÀ¢¶¶W“¢&7&÷vâ"Ç6Æ÷C¢&†VB"ÆæÖS¢.Xj"Ç7FG3§¶–çFVÆÆ–vVæ6S£'×ÒÀ¢¶¶W“¢'w&—7FwV&B"Ç6Æ÷C¢'6†÷VÆFW""ÆæÖS¢.ŠÛ~ˆYR"Ç7FG3§¶GF6³£'×ÒÀ¢¶¶W“¢&fö7W2"Ç6Æ÷C¢'6†÷VÆFW""ÆæÖS¢.k9^y+"Ç7FG3§¶–çFVÆÆ–vVæ6S£'×Ğ¢Ó° ¢6öç7BUT•ÔTåEõ4UE3Õ°¢¶–C¢'6WDf—&R"ÆÆ&VÃ¢.‹ZNx(â"ÆVÆVÖVçC¢&f—&R'ÒÀ¢¶–C¢'6WEvFW""ÆÆ&VÃ¢.Zù.k8’"ÆVÆVÖVçC¢'vFW"'ÒÀ¢¶–C¢'6WDV'F‚"ÆÆ&VÃ¢.[*[+2"ÆVÆVÖVçC¢&V'F‚'ÒÀ¢¶–C¢'6WEv–æB"ÆÆ&VÃ¢.™Ù.[Y"ÆVÆVÖVçC¢'v–æB'Ğ¢Ó° ¢6öç7BWV—ÖVçE6WD—FVÔFVf–æ—F–öç3ÕµÓ°¢UT•ÔTåEõ4UE2æf÷$V6‚‡6WCÓç°¢UT•ÔTåEõ4UEõ”T4U2æf÷$V6‚‡–V6SÓç°¢WV—ÖVçE6WD—FVÔFVf–æ—F–öç2çW6‚‡°¢–C§6WBæ–B²%ò"·–V6Ræ¶W’À¢æÖS§6WBæÆ&VÂ·–V6RææÖRÀ¢–6öã¦WV—ÖVçE6WD–6öâ‡6WBæ–BÇ–V6Ræ¶W’’À¢G—S§–V6Rç6Æ÷BÀ¢6WD–C§6WBæ–BÀ¢ÆWfVÅ&WV—&VÖVçC£#À¢&–6S£À¢7FG3¤ö&¦V7Bæ76–vâ‡·ÒÇ–V6Rç7FG2¢Ò“°¢Ò“°¢Ò“° ¢gVæ7F–öâvWDWV—ÖVçE6WD—FVÔFVf–æ—F–öç2‡6WD–B—°¢&WGW&âWV—ÖVçE6WD—FVÔFVf–æ—F–öç2æf–ÇFW"†FVcÓæFVbç6WD–CÓÓ×6WD–B“°¢Ğ ¢gVæ7F–öâvWE6WDÆ&VÂ‡6WD–B—°¢6öç7B6WCÔUT•ÔTåEõ4UE2æf–æB‡3Óç2æ–CÓÓ×6WD–B“°¢&WGW&â6WBò6WBæÆ&VÂ¢6WD–C°¢Ğ ¢gVæ7F–öâvWE6WDVÆVÖVçB‡6WD–B—°¢6öç7B6WCÔUT•ÔTåEõ4UE2æf–æB‡3Óç2æ–CÓÓ×6WD–B“°¢&WGW&â6WBò6WBæVÆVÖVçB¢çVÆÃ°¢Ğ ¢ò ¢cCYh‰ûÈş{+îˆ»hè‰ŞX[yJ‹8~iij˜¾hê^8 ¢Y¹îX+>k{®h»~‹)Ş™š>X‰~ûÈÎ˜şXXŞZIn˜:Š9ÎKˆŠªNiKXéşZx¾Zé®{êkˆ^YjîûÉ¾YjîzØnZé®{êK¸ŞiŠğ¢YÎKˆX¾YJşŠè‹8~iixšK»nûÈÎˆ8ÎXÈ^XªXZ^i˜.iz.iÈX{Ş[ÈşiÊÎKèn[iÈ>ŠH~Š;ŞZè>8 ¢¢ğ¢v–æF÷rçc3$vWD÷&TFVf–æ—F–öãÖvWD÷&TFVf–æ—F–öã°¢v–æF÷rçc3$vWEF–6¶WDFVf–æ—F–öãÖvWEF–6¶WDFVf–æ—F–öã°¢v–æF÷rçc3$vWD&ÇVW&–çDFVf–æ—F–öãÖgVæ7F–öâ†–B—°¢&WGW&â&ÇVW&–çDFVf–æ—F–öç2æf–æB†FVcÓæFVbæ–CÓÓÖ–B—ÇÆçVÆÃ°¢Ó°¢v–æF÷rçc3$vWDWV—ÖVçE6WD—FVÔFVf–æ—F–öç3ÖvWDWV—ÖVçE6WD—FVÔFVf–æ—F–öç3°¢v–æF÷rçc3$vWD6öçFVçDFVf–æ—F–öç3ÖgVæ7F–öâ‚—°¢&WGW&â°¢FÆ—6Öç3§FÆ—6ÖäFVf–æ—F–öç2ç6Æ–6R‚’À¢÷&W3¦÷&TFVf–æ—F–öç2ç6Æ–6R‚’À¢&ÇVW&–çG3¦&ÇVW&–çDFVf–æ—F–öç2ç6Æ–6R‚’À¢F–6¶WG3§F–6¶WDFVf–æ—F–öç2ç6Æ–6R‚’À¢WV—ÖVçE6WG3¤UT•ÔTåEõ4UE2ç6Æ–6R‚’À¢WV—ÖVçE6WD—FV×3¦WV—ÖVçE6WD—FVÔFVf–æ—F–öç2ç6Æ–6R‚¢Ó°¢Ó°  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢râ˜	®yJ8ÎXªXZ^ˆ8ÎXÈ^8ŞX{Ş[ÈşûÈKˆŞ™™‰z^kNûÈÎiÙii’şzÊnY)"şŠŠŞŠˆYÉbğ¢h«ŞxØîX‹‚şŠ9ŞX)˜;Şˆ;ŞyJYÎKˆZY~Znyh®ŠhşX˜~ûÈ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢gVæ7F–öâvWD—FVÔ–çfVçF÷'”66—G’†FVf–æ—F–öâ—°¢–b‚FVf–æ—F–öâ—²&WGW&â²Ğ¢6öç7BÖ…7F6³Ö—4WV—ÖVçD–çfVçF÷'•G—R†FVf–æ—F–öâçG—R¢ò¢¢”ådTåDõ%•ôÔ…õ5D4µôDTdTÅC°¢6öç7BÖF6†–æu7F6·3Ö–çfVçF÷'”—FV×2æf–ÇFW"€¢—FVÓÓæ—FVÒbb—FVÒæ–CÓÓÖFVf–æ—F–öâæ–@¢“°¢6öç7B7F6´g&VU76SÖÖ…7F6³ÃÓ¢ò ¢¢ÖF6†–æu7F6·2ç&VGV6R€¢‡7VÒÆ—FVÒ“Óç7VÒ´ÖF‚æÖ‚ƒÆÖ…7F6²Ò„çVÖ&W"†—FVÒæ6÷VçB—ÇÃ’’À¢ ¢“°¢6öç7Bg&VU6Æ÷G3ÔÖF‚æÖ‚ƒÃ#Ö–çfVçF÷'”—FV×2æÆVæwF‚“°¢&WGW&â7F6´g&VU76R¶g&VU6Æ÷G2¦Ö…7F6³°¢Ğ ¢gVæ7F–öâ6äFD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÆÖ÷VçB—°¢6öç7BVçF—G“ÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢&WGW&âVçF—G“ÃÖvWD—FVÔ–çfVçF÷'”66—G’†FVf–æ—F–öâ“°¢Ğ¢v–æF÷rçc3$6äFD—FVÕFô–çfVçF÷'“Ö6äFD—FVÕFô–çfVçF÷'“° ¢gVæ7F–öâFD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÆÖ÷VçB—°¢–b‚FVf–æ—F–öâ—²&WGW&âfÇ6S²Ğ¢6öç7BVçF—G“ÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢6öç7BÖ…7F6³Ö—4WV—ÖVçD–çfVçF÷'•G—R†FVf–æ—F–öâçG—R¢ò¢¢”ådTåDõ%•ôÔ…õ5D4µôDTdTÅC° ¢ò ¢c3~ûÉ®ˆˆ®x˜iŠşKˆ˜(®Zî8Kˆ˜(®h˜Şjª.iúS.jÎKˆ®™™ûÈÎi[˜xş‹È>ZJ~i˜.Xúşˆ;Ğ¢[{.{i>iKîXZ^Kˆ˜:Xˆnh˜ŞY¹îX+6fÇ6^ûÈÎYÎXú¾zºşXÛ¾h¨®i[NzØnŠinx+®ZKiY~8 ¢XXzé~ZèÎi[NZë˜xşûÈÎz+®Zé®i[Nh›˜;ŞiKî[é~Kˆ¾h˜Ş™h¾Zx¾iKˆ8ÎXÈ^ûÈÎŠé>XªXZ^i8ŞKÙÀ¢X[~X)–ÆÂÖ÷"Öæ÷F†–æ~Š©îhHş8 ¢¢ğ¢–b‚6äFD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÇVçF—G’’—²&WGW&âfÇ6S²Ğ ¢–b†Ö…7F6³ÃÓ—°¢ÆWB&VÖ–æ–æs×VçF—G“°¢v†–ÆR‡&VÖ–æ–æsã—°¢–b†–çfVçF÷'”—FV×2æÆVæwFƒãÓ#—°¢&WGW&âfÇ6S°¢Ğ¢–çfVçF÷'”—FV×2çW6‚†6ÆöæT–çfVçF÷'•7F6´—FVÒ†FVf–æ—F–öâÃ’“°¢&VÖ–æ–ærÒÓ°¢Ğ¢&WGW&âG'VS°¢Ğ ¢ÆWB&VÖ–æ–æs×VçF—G“°¢6öç7B7F6·3Ö–çfVçF÷'”—FV×2æf–ÇFW"†—FVÓÓæ—FVÒbb—FVÒæ–CÓÓÖFVf–æ—F–öâæ–B“°¢6öç7BF–6¶WDFVf–æ—F–öãÖvWEF–6¶WDFVf–æ—F–öâ†FVf–æ—F–öâæ–B“°¢7F6·2æf÷$V6‚‡7F6³Óç°¢–b‡&VÖ–æ–æsÃÓ—²&WGW&ã²Ğ¢–b‡F–6¶WDFVf–æ—F–öâ—²7–æ5F–6¶WE&W6VçFF–öâ‡7F6²ÇF–6¶WDFVf–æ—F–öâ“²Ğ¢6öç7B7W'&VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡7F6²æ6÷VçB—ÇÃ’“°¢6öç7B76SÔÖF‚æÖ‚ƒÆÖ…7F6²Ö7W'&VçB“°¢6öç7BFCÔÖF‚æÖ–â‡76RÇ&VÖ–æ–ær“°¢7F6²æ6÷VçCÖ7W'&VçB¶FC°¢&VÖ–æ–ærÓÖFC°¢Ò“° ¢v†–ÆR‡&VÖ–æ–æsã—°¢–b†–çfVçF÷'”—FV×2æÆVæwFƒãÓ#—°¢&WGW&âfÇ6S°¢Ğ¢6öç7B7F6´6÷VçCÔÖF‚æÖ–â†Ö…7F6²Ç&VÖ–æ–ær“°¢–çfVçF÷'”—FV×2çW6‚†6ÆöæT–çfVçF÷'•7F6´—FVÒ†FVf–æ—F–öâÇ7F6´6÷VçB’“°¢&VÖ–æ–ærÓ×7F6´6÷VçC°¢Ğ ¢&WGW&âG'VS°¢Ğ ¢v–æF÷rçc3$FD—FVÕFô–çfVçF÷'“ÖFD—FVÕFô–çfVçF÷'“° ¢gVæ7F–öâ6ÆöæT–çfVçF÷'•6æ6†÷B‚—°¢&WGW&â–çfVçF÷'”—FV×2æÖ†—FVÓÓç°¢–b‚—FVÒÇÂG—Vöb—FVÒÓÒ&ö&¦V7B"—²&WGW&â—FVÓ²Ğ¢6öç7B6÷“×²ââæ—FV×Ó°¢6÷’ç7FG3Ö—FVÒç7FG2bbG—Vöb—FVÒç7FG3ÓÓÒ&ö&¦V7B ¢ò²ââæ—FVÒç7FG7Ğ¢¢·Ó°¢&WGW&â6÷“°¢Ò“°¢Ğ ¢gVæ7F–öâ&W7F÷&T–çfVçF÷'•6æ6†÷B‡6æ6†÷B—°¢–çfVçF÷'”—FV×2ç7Æ–6R€¢À¢–çfVçF÷'”—FV×2æÆVæwF‚À¢ââç6æ6†÷BæÖ†—FVÓÓç°¢–b‚—FVÒÇÂG—Vöb—FVÒÓÒ&ö&¦V7B"—²&WGW&â—FVÓ²Ğ¢6öç7B6÷“×²ââæ—FV×Ó°¢6÷’ç7FG3Ö—FVÒç7FG2bbG—Vöb—FVÒç7FG3ÓÓÒ&ö&¦V7B ¢ò²ââæ—FVÒç7FG7Ğ¢¢·Ó°¢&WGW&â6÷“°¢Ò¢“°¢Ğ ¢gVæ7F–öâ'Vä–çfVçF÷'•G&ç67F–öâ†÷W&F–öâ—°¢6öç7B6æ6†÷CÖ6ÆöæT–çfVçF÷'•6æ6†÷B‚“°¢ÆWBVæE&VÆV6T–çfVçF÷'”÷W&F–öãÖçVÆÃ°¢G'—°¢–b€¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRb`¢G—Vöbv–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ&Vv–ä7&—F–6Ä÷W&F–öãÓÓÒ&gVæ7F–öâ ¢—°¢VæE&VÆV6T–çfVçF÷'”÷W&F–öãĞ¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ&Vv–ä7&—F–6Ä÷W&F–öâ‚&–çfVçF÷'’×G&ç67F–öâ"“°¢Ğ¢Ö6F6‚…ò—²Ğ¢G'—°¢–b†÷W&F–öâ‚’—²&WGW&âG'VS²Ğ¢Ö6F6‚†W'&÷"—°¢6öç6öÆRæW'&÷"‚.ˆ8ÎXÈ^KªNi‰>ZKiY~ûÈÎ[{.˜(NXéşûÉ¢"ÆW'&÷"“°¢Öf–æÆÇ—°¢–b‡G—VöbVæE&VÆV6T–çfVçF÷'”÷W&F–öãÓÓÒ&gVæ7F–öâ"—°¢VæE&VÆV6T–çfVçF÷'”÷W&F–öâ‚“°¢Ğ¢Ğ¢&W7F÷&T–çfVçF÷'•6æ6†÷B‡6æ6†÷B“°¢&WGW&âfÇ6S°¢Ğ ¢ò ¢˜	®yJ8Î[éîˆ8ÎXÈ^hš>hè”îX¾iù”NxšY88Ş(	N(	NZûnzëşh«ŞxØîX‹™h¾YYş˜;ŞŠhyJX‹ ¢YÎKˆzŠî8Îkhˆ	~[ª¾ZÙ8Ş˜(ş‹ÊşûÈÎZú¾h‰X[yJx˜iÊÎûÈÎKˆŞyJjøşX¾ikxšY8šîYè°¢YNˆz®ŠH~Š;ŞKˆK»Şhš>[ª¾ZÙy¨N‹ûNYÈ8.h›îKˆŞX‹‹k>ZJ[ª¾ZÙi˜.ZèÎXZKˆŞX¹^ˆ8ÎXÈ^ûÈÀ¢Y¹îX+6fÇ6^8 ¢¢ğ¢gVæ7F–öâ6öç7VÖU7F6´—FVÒ†—FVÔ–BÆÖ÷VçB—°¢6öç7BæVVFVCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢6öç7B÷væVCÖ–çfVçF÷'”—FV×2ç&VGV6R‚‡7VÒÆ—FVÒ“Óç°¢–b‚—FVÒÇÂ—FVÒæ–BÓÖ—FVÔ–B—²&WGW&â7VÓ²Ğ¢&WGW&â7VÒ´ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†—FVÒæ6÷VçB—ÇÃ’“°¢ÒÃ“°¢–b†÷væVCÆæVVFVB—²&WGW&âfÇ6S²Ğ ¢ÆWB&VÖ–æ–æsÖæVVFVC°¢f÷"†ÆWB–æFWƒÖ–çfVçF÷'”—FV×2æÆVæwF‚Ó¶–æFWƒãÓbb&VÖ–æ–æsã¶–æFW‚ÒÒ—°¢6öç7B—FVÓÖ–çfVçF÷'”—FV×5¶–æFW…Ó°¢–b‚—FVÒÇÂ—FVÒæ–BÓÖ—FVÔ–B—²6öçF–çVS²Ğ¢6öç7B7W'&VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†—FVÒæ6÷VçB—ÇÃ’“°¢6öç7BF¶SÔÖF‚æÖ–â†7W'&VçBÇ&VÖ–æ–ær“°¢–b†7W'&VçB×F¶SÃÓ—°¢–çfVçF÷'”—FV×2ç7Æ–6R†–æFW‚Ã“°¢ÖVÇ6W°¢—FVÒæ6÷VçCÖ7W'&VçB×F¶S°¢Ğ¢&VÖ–æ–ærÓ×F¶S°¢Ğ¢&WGW&âG'VS°¢Ğ ¢ò¢cC'&–Fv^ûÉ®Yh‰{;¾{[k+şyJYÎKˆZY~XéşZÙˆ8ÎXÈ^KªNi‰>ˆˆ~hš>™šN˜(ş‹Êş8"¢ğ¢v–æF÷rçc3$6öç7VÖU7F6´—FVÓÖ6öç7VÖU7F6´—FVÓ°¢v–æF÷rçc3%'Vä–çfVçF÷'•G&ç67F–öã×'Vä–çfVçF÷'•G&ç67F–öã°  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢‚âKˆˆŠÎ{{NX©şhè‰ŞûÉ£NzŠîKØî™¨î˜>X[~YCR^ûÈjøş™«¾h
®xši8®jë®YNˆz ¢xÚz¸¾XŠNZé®ûÈ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢6öç7Bäõ$ÔÅôE$õõôôÃÕ°¢‚“ÓævWEFÆ—6ÖäFVf–æ—F–öâ‚&g&VW¦UFÆ—6ÖäÆ÷r"’À¢‚“ÓævWEFÆ—6ÖäFVf–æ—F–öâ‚'7FVÇF…FÆ—6ÖäÆ÷r"’À¢‚“ÓævWEFÆ—6ÖäFVf–æ—F–öâ‚&&'&–W%FÆ—6ÖäÆ÷r"’À¢‚“ÓævWD÷&TFVf–æ—F–öâ‚&÷&TÆ÷r"¢Ó° ¢gVæ7F–öâv&DÖöç7FW$ÖFW&–ÄG&÷†Ööç7FW"—°¢ò ¢)ˆRXšşiÊÎh‹šÊ^KˆŞZY~yJ˜	{XNKˆˆŠÎ{{NX©şhè‰Ş(	N(	NXšşiÊÎiÊÎ‹ª°¢iÈˆz®[{xÚz¸¾y¨NZûnzëxØîX»^kXzˆ¾ûÈŠh¾Kˆ¾ikzÊÃzøûÈûÈÀ¢XZ˜(®YNˆz®‹*‹*ÎYNˆz®y¨NxØîX»^ûÈÎKˆŞiÈ>yh®Xª8 ¢¢ğ¢–b‡v–æF÷rçc3$7F—fTGVævVöå'Vâ—²&WGW&ã²Ğ ¢6öç7Bv–æVCÕµÓ°¢äõ$ÔÅôE$õõôôÂæf÷$V6‚†vWDFVcÓç°¢–b„ÖF‚ç&æFöÒ‚’£ãÓR—²&WGW&ã²Ğ¢6öç7BFVf–æ—F–öãÖvWDFVb‚“°¢–b‚FVf–æ—F–öâ—²&WGW&ã²Ğ¢–b†FD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÃ’—°¢v–æVBçW6‚†FVf–æ—F–öâææÖR“°¢Ğ¢Ò“° ¢–b†v–æVBæÆVæwFƒã—°¢FD&GFÆTÆör€¢†Ööç7FW"bbÖöç7FW"ææÖRòÖöç7FW"ææÖR¢.h
®xš’"’°¢.hè‰ŞK¨b"¶v–æVBæ¦ö–â‚.8"’².8" ¢“°¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“°¢Ğ¢Ğ ¢–b‡G—Vöb¶–ÆÄÖöç7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ¶–ÆÄÖöç7FW#Ö¶–ÆÄÖöç7FW#°¢¶–ÆÄÖöç7FW#ÖgVæ7F–öâ†–æFW‚—°¢6öç7BÖöç7FW#ÖÖöç7FW'5¶–æFW…Ó°¢6öç7B&W7VÇCÖ÷&–v–æÄ¶–ÆÄÖöç7FW"æÇ’‡F†—2Æ&wVÖVçG2“°¢–b†Ööç7FW"—°¢v&DÖöç7FW$ÖFW&–ÄG&÷†Ööç7FW"“°¢Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢’âzÊnY).KÛşyJûÉ®XZjë^XŠNZé ¢’™¨î{I®Xú®k®Zé®8ÎyZ¾zÊnûÈşyIşiXYYşX¹^8Şj™şxè~ûÉ£3RóSRósRó^8 ¢"’yZ¾zÊnh‰X©ş[èÎûÈÎXhŞKº^ikŞiKîŠy.ˆ›.{J‹:®‹[[Şhxk»ş{I®h¨ˆ;Şy¨NYŞKŠŞŠhşX˜~8 ¢j™™¨âRKº>ŠKˆZé®yZ¾zÊnh‰X©şûÈÎKˆŞKº>Šhê~X‹nûÈşzÊnŠ>KˆZé®YŞKŠŞ8 ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢gVæ7F–öâvWEFÆ—6Öä7F—fF–öä6†æ6R†FVf–æ—F–öâ—°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚æÖ–âƒÄçVÖ&W"†FVf–æ—F–öâbfFVf–æ—F–öâçF–W$6†æ6R—ÇÃ’“°¢Ğ ¢gVæ7F–öâvWEFÆ—6Öå6†&VE6¶–ÆÂ†FVf–æ—F–öâ—°¢–b‚FVf–æ—F–öçÇÇG—Vöb6¶–ÆÄFF&6SÓÓÒ'VæFVf–æVB"—²&WGW&âçVÆÃ²Ğ¢6öç7BfÆÆ&6³×¶g&VW¦S¢&g&VW¦R"Ç7FVÇFƒ¢'7FVÇF…6¶–ÆÂ"Æ&'&–W#¢&&'&–W"'Ó°¢6öç7B6¶–ÆÄ–CÖFVf–æ—F–öâç6†&VE6¶–ÆÄ–GÇÆfÆÆ&6µ¶FVf–æ—F–öâçFÆ—6ÖäVffV7EÓ°¢&WGW&â6¶–ÆÄ–C÷6¶–ÆÄFF&6U·6¶–ÆÄ–E×ÇÆçVÆÃ¦çVÆÃ°¢Ğ ¢gVæ7F–öâvWEFÆ—6Öä67FW%7FG2†6†&7FW$–æFW‚Æ6†&7FW"—°¢–b‡G—VöbvWE'G”&GFÆU7FG3ÓÓÒ&gVæ7F–öâ"—°¢6öç7B7FG3ÖvWE'G”&GFÆU7FG2†6†&7FW$–æFW‚“°¢–b‡7FG2—²&WGW&â7FG3²Ğ¢Ğ¢–b†6†&7FW$–æFWƒÓÓÓbgG—VöbvWDÖ–ä6†&7FW%7FG3ÓÓÒ&gVæ7F–öâ"—°¢6öç7B7FG3ÖvWDÖ–ä6†&7FW%7FG2‚“°¢–b‡7FG2—²&WGW&â7FG3²Ğ¢Ğ¢&WGW&â6†&7FW'ÇÇ·Ó°¢Ğ ¢gVæ7F–öâ&öÆÅFÆ—6Öå6¶–ÆÄ†—B†FVf–æ—F–öâÆ6†&7FW$–æFW‚ÇF&vWDÖöç7FW"—°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†6†&7FW$–æFW‚“°¢–b‚6†&7FW"—²&WGW&âfÇ6S²Ğ¢6öç7B7FG3ÖvWEFÆ—6Öä67FW%7FG2†6†&7FW$–æFW‚Æ6†&7FW"“°¢6öç7B6¶–ÆÃÖvWEFÆ—6Öå6†&VE6¶–ÆÂ†FVf–æ—F–öâ“°¢–b‡6¶–ÆÂ—°¢FVf–æ—F–öâçFÆ—6Öå6¶–ÆÄÆWfVÃÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡6¶–ÆÂæÖ„ÆWfVÂ—ÇÃ’“°¢Ğ ¢–b†FVf–æ—F–öâçFÆ—6ÖäVffV7CÓÓÒ&g&VW¦R"bgF&vWDÖöç7FW"—°¢6öç7B6¶–ÆÄÆWfVÃÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†FVf–æ—F–öâçFÆ—6Öå6¶–ÆÄÆWfVÂ—ÇÃ’“°¢6öç7B&6T6†æ6SÔ'&’æ—4'&’‡6¶–ÆÂbg6¶–ÆÂæg&VW¦T6†æ6T'”ÆWfVÂ¢ôÖF‚æÖ‚ƒÄçVÖ&W"‡6¶–ÆÂæg&VW¦T6†æ6T'”ÆWfVÅ´ÖF‚æÖ–â‡6¶–ÆÂæg&VW¦T6†æ6T'”ÆWfVÂæÆVæwF‚ÓÇ6¶–ÆÄÆWfVÂÓ•Ò—ÇÃ¢¤ÖF‚æÖ‚ƒÄçVÖ&W"‡6¶–ÆÂbg6¶–ÆÂæg&VW¦T6†æ6R—ÇÃ“°¢6öç7B–çFVÆÆ–vVæ6SÔçVÖ&W"‡7FG2æ–çFVÆÆ–vVæ6RÓ×VæFVf–æVC÷7FG2æ–çFVÆÆ–vVæ6S¦6†&7FW"æ–çFVÆÆ–vVæ6R—ÇÃ°¢6öç7BF&vWE7—&—C×G—VöbvWDÖöç7FW$VffV7F—fU7—&—Eö–çG3ÓÓÒ&gVæ7F–öâ ¢ôçVÖ&W"†vWDÖöç7FW$VffV7F—fU7—&—Eö–çG2‡F&vWDÖöç7FW"’—ÇÃ ¢¤çVÖ&W"‡F&vWDÖöç7FW"ç7—&—Eö–çG7ÇÇF&vWDÖöç7FW"ç7—&—B—ÇÃ°¢6öç7B&æ³×G—VöbvWDÖöç7FW%&æ³ÓÓÒ&gVæ7F–öâ#övWDÖöç7FW%&æ²‡F&vWDÖöç7FW"“¢'&VwVÆ"#°¢–b‡G—Vöb&öÆÅ7FGW4VffV7D†—CÓÓÒ&gVæ7F–öâ"—°¢&WGW&â&öÆÅ7FGW4VffV7D†—B€¢&6T6†æ6RÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃÄçVÖ&W"‡F&vWDÖöç7FW"æÆWfVÂ—ÇÃÀ¢–çFVÆÆ–vVæ6RÇF&vWE7—&—BÇG'VRÇ&æ²Ã ¢“°¢Ğ¢Ğ ¢òò™«‹ª¾ûÈş{YyXÎiŠşXø¾ikzÊnŠ>ûÈÎKˆŞh»şXø¾‹¸Ş™h>˜şh{.{ÛikŞiKîˆ^ûÉ¾KÛşyJŠy.ˆ›.ˆz®‹ª¾YŞKŠŞXÎ8 ¢6öç7B67W&7“ÔçVÖ&W"‡7FG2æ67W&7’“°¢–b„çVÖ&W"æ—4f–æ—FR†67W&7’’bgG—Vöb&öÆÄ†—D6†æ6SÓÓÒ&gVæ7F–öâ"—°¢6öç7Bf–æÄ67W&7”&öçW3×G—Vöbv–æF÷rçcs4vWD7F—fT67W&7”&öçW5W&6VçCÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcs4vWD7F—fT67W&7”&öçW5W&6VçB†6†&7FW"¢£°¢&WGW&â&öÆÄ†—D6†æ6R†67W&7’ÃÃÆf–æÄ67W&7”&öçW2“°¢Ğ¢6öç7B–çFVÆÆ–vVæ6SÔçVÖ&W"‡7FG2æ–çFVÆÆ–vVæ6RÓ×VæFVf–æVC÷7FG2æ–çFVÆÆ–vVæ6S¦6†&7FW"æ–çFVÆÆ–vVæ6R—ÇÃ°¢–b‡G—Vöb&öÆÅ7FGW4VffV7D†—CÓÓÒ&gVæ7F–öâ"—°¢&WGW&â&öÆÅ7FGW4VffV7D†—BƒÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃÆ–çFVÆÆ–vVæ6RÃÆfÇ6RÂ'&VwVÆ""Ã“°¢Ğ¢&WGW&âG'VS°¢Ğ ¢v–æF÷rçcs3cvWEFÆ—6Öä7F—fF–öä6†æ6SÖvWEFÆ—6Öä7F—fF–öä6†æ6S°¢v–æF÷rçcs3c&öÆÅFÆ—6Öå6¶–ÆÄ†—C×&öÆÅFÆ—6Öå6¶–ÆÄ†—C° ¢gVæ7F–öâvWEFÆ—6Öä–çfVçF÷'”—FV×2‚—°¢6öç7B'”–CÖæWrÖ‚“°¢–çfVçF÷'”—FV×2æf÷$V6‚†—FVÓÓç°¢–b‚—FVÒÇÂ—FVÒçG—RÓÒ'FÆ—6Öâ"ÇÂ—FVÒæ–B—²&WGW&ã²Ğ¢6öç7B6÷VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†—FVÒæ6÷VçB—ÇÃ’“°¢–b†6÷VçCÃÓ—²&WGW&ã²Ğ¢–b‚'”–Bæ†2†—FVÒæ–B’—°¢'”–Bç6WB†—FVÒæ–BÇ²ââæ—FVÒÆ6÷VçC£Ò“°¢Ğ¢'”–BævWB†—FVÒæ–B’æ6÷VçB³Ö6÷VçC°¢Ò“°¢&WGW&â'&’æg&öÒ†'”–BçfÇVW2‚’“°¢Ğ ¢gVæ7F–öâ6öç7VÖUFÆ—6Öäg&öÔ–çfVçF÷'’‡FÆ—6Öä–B—°¢f÷"†ÆWB–æFWƒÖ–çfVçF÷'”—FV×2æÆVæwF‚Ó¶–æFWƒãÓ¶–æFW‚ÒÒ—°¢6öç7B—FVÓÖ–çfVçF÷'”—FV×5¶–æFW…Ó°¢–b‚—FVÒÇÂ—FVÒæ–BÓ×FÆ—6Öä–B—²6öçF–çVS²Ğ¢6öç7B7W'&VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†—FVÒæ6÷VçB—ÇÃ’“°¢–b†7W'&VçCÃÓ—°¢–çfVçF÷'”—FV×2ç7Æ–6R†–æFW‚Ã“°¢ÖVÇ6W°¢—FVÒæ6÷VçCÖ7W'&VçBÓ°¢Ğ¢&WGW&âG'VS°¢Ğ¢&WGW&âfÇ6S°¢Ğ ¢ò ¢)ˆRikZ)îûÈKéŞxZ~KÛşyJˆ^Šhk.ûÈÎ8Î›¹î˜zÊnY).k).iÈYXş˜i8~yºîj‰8ŞûÈûÉ ¢zÊnY).xûîYÊZèÎXZjùNxZ~h¨ˆ;Şy¨N˜yºîj‰kXzˆ¾(	N(	NXk[zÊnŠhxêZënˆz®[{›¹îŠhXk[¢Y:®Kˆ™«¾h
®ûÈÎ™«‹ª¾zÊbş{YyXÎzÊnŠhxêZënˆz®[{›¹îŠh{Znh‰ikY:®KˆKØŞŠy.ˆ›.8  ¢KÙÎk9^Kˆ®X‹¾hHş8ÎKˆŞ8Şˆz®[{˜
KˆZY~˜yºîj‰•TûÈÎˆÎiŠşy»Nhê^k+şyJ˜®h‹.iz.iÈy¨@¢˜*>Kˆi[NZY~ûÈ‡6WD&GFÆUF&vWE6VÆV7F–öäÖöFR÷6VÆV7D&GFÆUF&vWN8¢6WD&GFÆTÆÇ•F&vWE6VÆV7F–öäÖöFR÷6VÆV7D&GFÆTÆÇ•F&vWNûÈûÈÀ¢Xú®h¨®zÊnY)&–Ny[nh‰VæF–æt7F–öîX+>˜.Xë¾8.Z[Ş‰™^iŠşhùzK®ih~ZÙ~8XÚx˜~š¹Kªî8¢8Î‹ùNY¹î8ŞXùnkh8{Yzé~™¨îjë^ŠèVWVVBçF&vWB÷VWVVBçF&vWDÆÇ(
n(
`¢XZ˜:XéşiÊÎ[iŠş[Şy¨NûÈÎKˆŞyJ˜xŞZú¾K™şKˆŞiÈ>‹yşh¨ˆ;Şy¨NŠÎx+®KˆŞKˆˆ{N8  ¢)ˆR[{.z+®Š¨Şy¨Ny»Zëh
~˜xŞ›¹îûÈŠè˜ãÖÖ–âæ§>z+®Š¨ŞûÈûÉ ¢Ò6VÆV7D&GFÆUF&vWB‚ûÈƒûÈZèÎXZKˆŞiúW6¶–ÆÄFF&6^ûÈÎXú®h¨ ¢VæF–æt7F–öîXéş[KˆŞX¹^ZÙ˜'VWVVEÆ–W$7F–öç>ûÈÎh˜Kº^8Î˜h
®xš8Ğ¢˜	j)Ş‹zş[éKˆŞyJiKK»¾KÙ^iÛŠ[ş[ˆ;Şy»Nhê^yJzÊnY)&–N8 ¢Ò8Î˜h‰ik8Ş˜*>j)Ş‹zş[éKˆŞŠÎûÉ§6WD&GFÆTÆÇ•F&vWE6VÆV7F–öäÖöFR‚¢ûÈƒs>ûÈ‹y÷6VÆV7D&GFÆTÆÇ•F&vWB‚ûÈƒsCNûÈ˜;ŞiÈ>X ¢6¶–ÆÄFF&6U¶7F–öåG—UÒKŠnŠhk"F&vWEG—RiŠòÆÇ’öFVDÆÇûÈÀ¢zÊnY)&–Niú^KˆŞX‹[iÈ>i[NX¾y[nh‰xJiX8.h˜Kº^Kˆ¾™Ú.Š9ÎK¨n˜	XZX¾y¨NŠhnZú¾ûÈÀ¢˜~X‹zÊnY)&–Ni˜.iKyJKˆX¾8Î™[~[é~X8şh¨ˆ;Ş8Şy¨NYh‰xšK»n‹[YÎKˆZY~XŠNikZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^·ã€‚
       - getBattleActionDisplayName()ï¼ˆ10609ï¼‰æŸ¥ä¸åˆ°æœƒç›´æ¥å›å‚³åŸå§‹idï¼Œ
         æç¤ºæœƒè®Šæˆã€Œé¸æ“‡ [freezeTalismanLow]ã€é€™ç¨®é†œæ±è¥¿ï¼Œä¹Ÿä¸€èµ·è¦†å¯«ã€‚
    */
    function getTalismanTargetKind(definition){
        if(!definition){ return null; }
        return definition.talismanEffect==="freeze" ? "monster" : "ally";
    }

    /* çµ¦æ—¢æœ‰çš„æˆ‘æ–¹é¸ç›®æ¨™æµç¨‹ç”¨çš„ã€ŒåˆæˆæŠ€èƒ½ç‰©ä»¶ã€â€”â€”åªéœ€è¦
       targetType è·Ÿ name é€™å…©å€‹æ¬„ä½å°±èƒ½è®“é‚£å¥—é‚è¼¯æ­£å¸¸é‹ä½œã€‚ */
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
                promptAction.textContent="é¸æ“‡ ["+definition.name+"] çš„æˆ‘æ–¹ç›®æ¨™";
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
            if(targetText){ targetText.textContent="ç›®æ¨™ï¼šè«‹é¸æ“‡æˆ‘æ–¹è§’è‰²"; }
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
           â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ã€Œä¸‰å€‹äººéƒ½ä½¿ç”¨ç¬¦å’’ï¼Œçµæœéƒ½æ˜¯ä¸€å€‹äºº
           åœ¨ä½¿ç”¨ã€çš„ç¬¬äºŒå€‹æˆå› ï¼‰ï¼šå®£å‘Šéšæ®µè¦æŠŠã€Œå·²ç¶“è¢«å…¶ä»–è§’è‰²é å®š
           èµ°çš„ç¬¦å’’ã€ä¹Ÿç®—é€²å»ã€‚åŸæœ¬åªçœ‹èƒŒåŒ…å‰©å¹¾å¼µï¼Œä¸‰å€‹è§’è‰²å¯ä»¥åŒæ™‚
           å®£å‘ŠåŒä¸€å¼µæœ€å¾Œä¸€å¼µç¬¦å’’ï¼Œçµç®—æ™‚å…ˆæ‰‹ç”¨æ‰ã€å¾Œé¢å…©ä½æ’åˆ°
           ã€Œå·²ç¶“æ²’æœ‰åº«å­˜äº†ã€ç™½ç™½æµªè²»ä¸€æ•´å€‹å›åˆã€‚
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
                    ? "å‰©ä¸‹çš„æ•¸é‡å·²ç¶“è¢«é€™å›åˆå…¶ä»–è§’è‰²é å®šäº†ã€‚"
                    : "ç›®å‰æ²’æœ‰åº«å­˜ã€‚")
            );
            renderBattleItemMenu();
            return;
        }

        /*
           â˜… é€²å…¥é¸ç›®æ¨™éšæ®µï¼ˆè€Œä¸æ˜¯ç›´æ¥å®£å‘Šå®Œç•¢ï¼‰ï¼šç¬¦å’’idç›´æ¥ç•¶æˆ
           pendingActionï¼Œä¹‹å¾Œç”±æ—¢æœ‰çš„selectBattleTarget()ï¼
           selectBattleAllyTarget()è² è²¬å¯«é€²queuedPlayerActionsã€‚
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
            addBattleLog(definition.name+"å·²ç¶“æ²’æœ‰åº«å­˜äº†ã€‚");
            finishPlayerAction();
            return;
        }
        rebuildInventorySlots();

        /*
           â˜… ä¿®æ­£ï¼ˆé€™å°±æ˜¯ä½¿ç”¨è€…èªªã€Œä¸‰å€‹äººéƒ½ä½¿ç”¨ç¬¦å’’ï¼Œçµæœéƒ½æ˜¯ä¸€å€‹äºº
           åœ¨ä½¿ç”¨ã€çš„çœŸæ­£åŸå› ï¼‰ï¼šlungePlayerCard()è·ŸshowSkillNameBadge()
           çš„æœ€å¾Œä¸€å€‹åƒæ•¸éƒ½æ˜¯characterIndexï¼Œå…§éƒ¨æ˜¯
           $("battlePlayerCard"+(characterIndex||0))â€”â€”åŸæœ¬é€™å…©å€‹å‘¼å«
           éƒ½æ²’æœ‰å‚³ï¼Œæ‰€ä»¥ä¸ç®¡æ˜¯èª°æ–½æ”¾ï¼Œå‰å‚¾å‹•ç•«è·ŸæŠ€èƒ½åç¨±éƒ½æ°¸é æ¼”åœ¨
           0è™Ÿè§’è‰²çš„å¡ç‰‡ä¸Šã€‚äºŒä¸‰è™Ÿè§’è‰²å…¶å¯¦æœ‰æ­£å¸¸çµç®—ï¼ˆæˆ°é¬¥ç´€éŒ„æœ‰å°ã€
           buffä¹Ÿæœ‰ä¸Šï¼‰ï¼Œä½†ç•«é¢çœ‹èµ·ä¾†å°±åƒã€Œåªæœ‰ç¬¬ä¸€å€‹äººåœ¨ç”¨ã€ã€‚
           ï¼ˆåŒä¸€å€‹å‡½å¼ä¸‹é¢çš„showMissEffect()æœ¬ä¾†å°±æœ‰æ­£ç¢ºå‚³ï¼Œæ‰€ä»¥
           ã€Œç•«ç¬¦å¤±æ•—ã€åè€Œä¸€ç›´æ˜¯æ¼”åœ¨å°çš„å¡ç‰‡ä¸Šï¼Œå‰›å¥½å¯ä»¥å°ç…§ã€‚ï¼‰
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
                    addBattleLog(definition.name+"æ²’æœ‰å¯ä»¥ç”Ÿæ•ˆçš„ç›®æ¨™ã€‚");
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
            addBattleLog((character.id||"ä½ ")+"ä½¿ç”¨"+definition.name+"ï¼Œç•«ç¬¦å¤±æ•—ï¼");
            showMissEffect(true,characterIndex,"ç•«ç¬¦å¤±æ•—");
            finishPlayerAction();
            return;
        }

        if(!rollTalismanSkillHit(definition,characterIndex,targetMonster)){
            if(definition.talismanEffect==="freeze"&&targetMonster){
                addBattleLog(targetMonster.name+"æŠµæŠ—äº†"+definition.name+"çš„å†°å°æ•ˆæœã€‚");
            }else{
                addBattleLog((character.id||"ä½ ")+"çš„"+definition.name+"ç•«ç¬¦æˆåŠŸï¼Œä½†ç¬¦è¡“æœªå‘½ä¸­ã€‚");
            }
            showMissEffect(true,characterIndex,"MISS");
            finishPlayerAction();
            return;
        }

        if(definition.talismanEffect==="freeze"){
            applyFreezeEffect(targetMonster,definition.talismanDuration);
            addBattleLog(
                (character.id||"ä½ ")+"ä½¿ç”¨"+definition.name+"ï¼Œ"+
                targetMonster.name+"è¢«å†°å°äº†ï¼"
            );
        }
        else{
            /*
               â˜… éš±èº«ç¬¦/çµç•Œç¬¦æ”¹æˆä½œç”¨åœ¨ç©å®¶é¸çš„æˆ‘æ–¹è§’è‰²
               ï¼ˆqueued.targetAllyï¼‰ï¼Œæ²’æœ‰é¸æˆ–é‚£ä½å·²ç¶“å€’ä¸‹æ™‚æ‰é€€å›
               æ–½æ³•è€…è‡ªå·±ã€‚
            */
            allyCharacter.activeBuffs=allyCharacter.activeBuffs||[];
            const buff={type:buffType,turnsLeft:definition.talismanDuration};
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,buffType);
            }
            allyCharacter.activeBuffs.push(buff);

            const allyName=allyIndex===characterIndex
                ? (character.id||"ä½ ")
                : (allyCharacter.id||("è§’è‰²"+(allyIndex+1)));

            addBattleLog(
                definition.talismanEffect==="stealth"
                    ? (character.id||"ä½ ")+"ä½¿ç”¨"+definition.name+"ï¼Œ"+allyName+
                      "é€²å…¥éš±èº«ï¼Œç„¡æ³•è¢«å–®é«”æ”»æ“Šé¸ä¸­ï¼ŒæŒçºŒ"+definition.talismanDuration+"å›åˆã€‚"
                    : (character.id||"ä½ ")+"ä½¿ç”¨"+definition.name+"ï¼Œ"+allyName+
                      "ç²å¾—çµç•Œï¼Œå¯æŠµæ“‹æ‰€æœ‰å‚·å®³ï¼ŒæŒçºŒ"+definition.talismanDuration+"å›åˆã€‚"
            );
        }

        updateUI();
        finishPlayerAction();
    }
    window.applyTalismanEffect=applyTalismanEffect;

    /*
       â˜… æ¥é€²æ—¢æœ‰çš„ã€Œå®£å‘Šå¾Œçµç®—ã€dispatché»â€”â€”è·Ÿpotion
       åŒä¸€å€‹ä½ç½®ï¼Œæ‰¾ä¸åˆ°å°±ä»£è¡¨é€™å€‹ç‰ˆæœ¬çš„00-main.jsçµæ§‹
       è·Ÿé æœŸä¸åŒï¼Œä¸»å‹•å°å‡ºè­¦å‘Šæ–¹ä¾¿ä¹‹å¾Œæ’æŸ¥ï¼Œä¸è¦é»˜é»˜å¤±æ•ˆã€‚
    */
    if(typeof resolveQueuedPlayerAction==="function"){
        const originalResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=queuedPlayerActions[characterIndex];

            /*
               â˜… æ”¹æˆç”¨ã€Œqueued.actionæœ¬èº«æ˜¯ä¸æ˜¯ä¸€å€‹ç¬¦å’’idã€ä¾†åˆ¤æ–·ã€‚
               ä»¥å‰æ˜¯å¯«æ­» action==="talisman" å†å¦å¤–å­˜ talismanIdï¼Œ
               ä½†ç¾åœ¨ç¬¦å’’è¦èµ°æ—¢æœ‰çš„é¸ç›®æ¨™æµç¨‹ï¼Œè€Œé‚£å¥—æµç¨‹
               ï¼ˆselectBattleTarget/selectBattleAllyTargetï¼‰æ˜¯æŠŠ
               pendingActionåŸå°ä¸å‹•å¯«é€²queued.actionçš„ï¼Œæ²’è¾¦æ³•é †ä¾¿
               å¤šå¡ä¸€å€‹talismanIdæ¬„ä½â€”â€”æ‰€ä»¥ç›´æ¥è®“actionå¸¶ç¬¦å’’idï¼Œ
               é€™è£¡ç”¨getTalismanDefinition()åæŸ¥å³å¯ã€‚
               åŒæ™‚æŠŠæ•´å€‹queuedå‚³ä¸‹å»ï¼Œè®“çµç®—ç«¯è®€å¾—åˆ°ç©å®¶é¸çš„
               targetï¼targetAllyã€‚
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
        console.warn("V132ï¼šæ‰¾ä¸åˆ°resolveQueuedPlayerAction()ï¼Œç¬¦å’’å¯èƒ½ç„¡æ³•åœ¨æˆ°é¬¥ä¸­çµç®—ï¼Œéœ€è¦äººå·¥æª¢æŸ¥00-main.jsçš„å‡½å¼åç¨±ã€‚");
    }

    /* å•Ÿç”¨æˆ°é¬¥ç¬¦å’’æ¸…å–®æŒ‰éˆ•ï¼ˆåŸæœ¬disabledï¼Œåªåˆ—æ¸…å–®ï¼‰ã€‚ */
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
                    '<span class="battle-item-badge">ç¬¦</span>'+
                    '<span class="battle-item-name">'+escapeHtml(item.name)+'</span>'+
                    '<span class="battle-item-effect">ç”Ÿæ•ˆæ©Ÿç‡ '+chanceLabel+'</span>'+
                    '<span class="battle-item-count">Ã—'+item.count+'</span>'+
                    '</button>'
                );
            }).join("");

            return result;
        };
    }


    /* =====================================================
       10. è£å‚™å¥—è£åŠ æˆï¼ˆ3ä»¶ï¼šå…­åœå…¨éƒ¨+1ï¼5ä»¶ï¼šå°æ‡‰å…ƒç´ 
           æŠ€èƒ½å‚·å®³+2%ï¼‰ï¼Œæ¥é€²æ—¢æœ‰å…©å€‹å”¯ä¸€çµç®—å…¥å£
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
       11. è£å‚™ç­‰ç´šé™åˆ¶ï¼ˆ20LVæ‰èƒ½ç©¿æˆ´å¥—è£è£å‚™ï¼‰
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
                    item.name+"éœ€è¦è§’è‰²ç­‰ç´šé”åˆ°"+
                    item.levelRequirement+"ç´šæ‰èƒ½ç©¿æˆ´ï¼Œ"+
                    "ç›®å‰ç­‰ç´šï¼š"+(character.level||1)+"ã€‚"
                );
                return;
            }

            return originalEquipSelectedItem.apply(this,arguments);
        };
    }


    /* =====================================================
       12. æŠ½çåˆ¸ä½¿ç”¨ï¼ˆé–‹å•Ÿå¾Œéš¨æ©Ÿç²å¾—è©²ç³»åˆ—è£å‚™å…¶ä¸­ä¸€ä»¶ï¼‰
    ===================================================== */

    function useEquipmentTicket(ticketId){
        const definition=getTicketDefinition(ticketId);
        if(!definition){ return; }

        const owned=inventoryItems.some(item=>item && item.id===ticketId && Number(item.count)>0);
        if(!owned){
            alert(definition.name+"ç›®å‰æ²’æœ‰åº«å­˜ã€‚");
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
            alert("èƒŒåŒ…ç©ºé–“ä¸è¶³ï¼Œ"+won.name+"ç„¡æ³•æ”¾å…¥èƒŒåŒ…ï¼›æŠ½çåˆ¸æœªæ¶ˆè€—ã€‚");
            return;
        }

        saveGame();
        alert("ä½¿ç”¨"+definition.name+"ï¼Œç²å¾—ã€"+won.name+"ã€‘ï¼");
    }
    window.useEquipmentTicket=useEquipmentTicket;

    /*
       é–‹å•Ÿå¯¶ç®±/æŠ½çåˆ¸ä¹‹å‰ï¼Œå…ˆè®“ç©å®¶çœ‹çœ‹ã€Œé€™å€‹æ±è¥¿é–‹äº†å¯èƒ½æ‹¿åˆ°
       ä»€éº¼ã€â€”â€”é‡ç”¨æ—¢æœ‰çš„v132ShowRewardModalå½ˆçª—ï¼Œä¸ç”¨å¦å¤–åš
       ä¸€æ•´å¥—æ–°UIã€‚
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
            '<span>'+escapeHtml(name)+(amount ? ' Ã—'+amount : '')+'</span>'+
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
                '<h3>'+escapeHtml(item.name)+' é–‹å•Ÿé è¦½</h3>'+
                '<p>æ¯æ¬¡é–‹å•Ÿæœƒå„ç²å¾—1çµ„ç¤¦çŸ³èˆ‡1ç¨®è£å‚™è¨­è¨ˆåœ–ï¼›å…©é¡çå‹µåˆ†é–‹æŠ½å–ã€‚</p>'+
                '<div class="v132-preview-section-title">å¯èƒ½ç²å¾—çš„ç¤¦çŸ³</div>'+
                '<div class="v132-preview-list">'+oreRows+'</div>'+
                '<div class="v132-preview-section-title">å¯èƒ½ç²å¾—çš„è£å‚™è¨­è¨ˆåœ–</div>'+
                '<div class="v132-preview-list v132-preview-list-scroll">'+blueprintRows+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="bµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥ëZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^utton" onclick="v132CloseRewardModal()">é—œé–‰</button>'+
                '</div></div>';
        }
        else if(item.type==="ticket"){
            const ticketDef=getTicketDefinition(item.id);
            const pieces=ticketDef ? getEquipmentSetItemDefinitions(ticketDef.setId) : [];
            const chance=pieces.length ? 100/pieces.length : 0;
            const grid=pieces.map(p=>
                '<button type="button" class="v132-preview-item" data-item-id="'+escapeHtml(p.id)+'" '+
                'aria-label="æŸ¥çœ‹'+escapeHtml(p.name)+'è©³ç´°è³‡æ–™" '+
                'onclick="v132OpenPreviewEquipmentDetail(this.dataset.itemId)">'+
                '<span class="v132-preview-icon">'+p.icon+'</span>'+
                '<span class="v132-preview-item-name">'+escapeHtml(p.name)+'</span>'+
                '<b>'+formatPreviewProbability(chance)+'</b>'+
                '</button>'
            ).join("");
            html=
                '<div class="v132-reward-modal-inner v132-ticket-preview-modal">'+
                '<h3>'+escapeHtml(item.name)+' é–‹å•Ÿé è¦½</h3>'+
                '<p>é–‹å•Ÿå¾Œï¼Œå¾ä»¥ä¸‹10ä»¶['+(ticketDef ? getSetLabel(ticketDef.setId) : "")+']å¥—è£éƒ¨ä½ä¸­'+
                'éš¨æ©Ÿç²å¾—1ä»¶ï¼š</p>'+
                '<div class="v132-preview-grid">'+grid+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">é—œé–‰</button>'+
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
       â˜… ç‰©å“è©³ç´°å½ˆçª—è£œä¸Šç¬¦å’’/æŠ½çåˆ¸/å¯¶ç®±çš„ã€Œé–‹å•Ÿã€è·Ÿã€Œé è¦½ã€
       æŒ‰éˆ•â€”â€”é€™å¹¾ç¨®æ±è¥¿ä¸æ˜¯è—¥æ°´ï¼ˆä¸èµ°usePotion()é‚£æ¢è·¯ï¼‰ã€
       ä¹Ÿä¸æ˜¯è£å‚™ï¼ˆä¸èƒ½ç©¿æˆ´ï¼‰ï¼ŒåŸæœ¬çš„itemEquipButtonåœ¨é€™å¹¾ç¨®
       é¡å‹ä¸Šåªæœƒè¢«åˆ¤æˆã€Œä¸å¯è£å‚™ã€æ•´å€‹é–æ­»ä½†é‚„æ˜¯é¡¯ç¤ºè‘—ï¼Œé€™è£¡
       ä¾ç…§ V138 æœ€æ–°è¦æ ¼ï¼Œå¯¶ç®±/æŠ½çåˆ¸é»é–‹åªé¡¯ç¤ºã€Œé–‹å•Ÿï¼é è¦½ã€
       å…©å€‹ç‰©å“å‹•ä½œï¼›ç©¿æˆ´èˆ‡å”®å‡ºéƒ½éš±è—ï¼Œé¿å…é›¶å”®åƒ¹ç‰©å“è¢«èª¤å”®ã€‚
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
               â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ï¼‰ï¼šç¬¦å’’ä¸æ˜¯è£å‚™ï¼Œä½†åŸæœ¬çš„
               openItemModal()åªé‡å° type==="potion" æŠŠã€Œç©¿æˆ´ã€éµé–ä½
               ï¼ˆjs/00-main.js:30447ï¼‰ï¼Œç¬¦å’’æœƒè½åˆ°elseåˆ†æ”¯è®Šæˆä¸€é¡†
               å¯ä»¥æŒ‰çš„ã€Œç©¿æˆ´ã€éµâ€”â€”æŒ‰ä¸‹å»å› ç‚º
               getInventoryEquipmentSlot("talisman")æŸ¥ä¸åˆ°å°æ‡‰æ¬„ä½ï¼Œ
               equipSelectedItem()åªæ˜¯éœé»˜returnï¼Œç­‰æ–¼æ˜¯ä¸€é¡†é¨™äººçš„
               æ­»æŒ‰éˆ•ã€‚ä¾ä½¿ç”¨è€…æ±ºå®šã€Œç¬¦å’’ä¸èƒ½åœ¨æˆ°é¬¥å¤–ä½¿ç”¨ã€ï¼Œé€™è£¡
               åªæŠŠé€™é¡†éŒ¯èª¤çš„æŒ‰éˆ•è—æ‰ï¼Œä¸å¦å¤–è£œã€Œä½¿ç”¨ã€éµã€‚
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
                        if((child.textContent||"").includes("å”®åƒ¹ï¼š")){
                            child.remove();
                        }
                    });
                }
            }

            if(useButton){
                if(item && item.type==="ticket"){
                    useButton.style.display="";
                    useButton.textContent="é–‹å•Ÿ";
                    useButton.onclick=function(){
                        useEquipmentTicket(item.id);
                        closeItemModal();
                    };
                }
                else if(item && item.type==="chest"){
                    useButton.style.display="";
                    useButton.textContent="é–‹å•Ÿ";
                    useButton.onclick=function(){
                        const opened=openSingleMaterialChestFromInventory();
                        closeItemModal();
                        if(opened){
                            alert("é–‹å•Ÿ"+item.name+"ï¼Œç²å¾—ï¼š\n"+opened.join("\n"));
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
                    previewButton.textContent="é è¦½";
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
       13. æ—¥å¸¸å‰¯æœ¬ï¼šæ¯æ—¥æ¬¡æ•¸ç‹€æ…‹ï¼ˆç¨ç«‹å­˜æª”ï¼Œæ ¼å¼è·Ÿ
           å…ƒç´ åŒ£stateåŒä¸€å¥—æ…£ä¾‹ï¼Œdateè·Ÿä»Šå¤©ä¸åŒå°±é‡ç½®ï¼‰
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
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå‰¯æœ¬å…ˆå–æ¶ˆæŒ‘æˆ°æ¬¡æ•¸ï¼Œæ–¹ä¾¿æˆ‘é »ç¹
       æ¸¬è©¦ã€ï¼‰ï¼šå…ˆé—œæ‰æ¯æ—¥æ¬¡æ•¸é™åˆ¶ï¼Œåªè¦æŠŠé€™å€‹å¸¸æ•¸æ”¹å›trueï¼Œ
       markDungeonUsed()å°±æœƒæ¢å¾©æ­£å¸¸è¨˜éŒ„ã€Œä»Šå¤©æŒ‘æˆ°éäº†ã€ï¼Œ
       isDungeonAvailable()/dungeonEntryCard()çš„UIä¹Ÿæœƒè‡ªå‹•æ¢å¾©
       æ“‹ä¸‹é‡è¤‡æŒ‘æˆ°ï¼Œä¸ç”¨å†æ”¹åˆ¥çš„åœ°æ–¹ã€‚
    */
    const DUNGEON_DAILY_LIMIT_ENABLED=false;

    function markDungeonUsed(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return; }
        ensureDungeonStateCurrent();
        dungeonState.used[type]=true;
        persistDungeonState();
    }

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…å›å ±ã€Œåˆªé™¤è§’è‰²äº†ï¼Œç‚ºä½•å‰¯æœ¬æ¬¡æ•¸æ²’æœ‰é‡ç½®ã€ï¼‰ï¼š
       ä¸Šä¸€ç‰ˆåªåœ¨ã€Œå¯«å…¥ã€ç«¯ï¼ˆmarkDungeonUsedï¼‰æ“‹äº†æ——æ¨™ï¼Œã€Œè®€å–ã€ç«¯
       ï¼ˆé€™è£¡è·ŸdungeonEntryCardï¼‰å»ç…§æ¨£ç›´æ¥è®€dungeonState.usedâ€”â€”
       çµæœæ˜¯æ——æ¨™é—œæ‰ä¹‹å‰å°±å·²ç¶“å­˜é€²localStorageçš„used:trueï¼Œæœƒç¹¼çºŒ
       è®“æŒ‰éˆ•æ°¸ä¹…disabledåˆ°éš”å¤©ç‚ºæ­¢ï¼Œçœ‹èµ·ä¾†å°±åƒã€Œæ¬¡æ•¸æ ¹æœ¬æ²’è§£é™¤ã€ã€‚
       è®€å–ç«¯ä¹Ÿè¦ä¸€èµ·çœ‹æ——æ¨™ï¼Œé—œé–‰æ™‚ä¸€å¾‹è¦–ç‚ºå¯æŒ‘æˆ°ã€‚
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
       â˜… ä¿®æ­£ï¼ˆåŒä¸€å€‹å›å ±çš„å¦ä¸€åŠï¼‰ï¼šå‰¯æœ¬æ¬¡æ•¸æ˜¯å­˜åœ¨
       v132_daily_dungeon_stateé€™å€‹ã€Œç¨ç«‹çš„localStorage keyã€è£¡ï¼Œ
       è€Œåˆªè§’è‰²ç”¨çš„resetGame()ï¼ˆjs/00-main.jsï¼‰åªæ¸…SAVE_KEYè·Ÿå…©å€‹
       èˆŠç‰ˆå­˜æª”keyï¼Œå¾ä¾†æ²’æœ‰ç¢°éé€™å€‹keyâ€”â€”æ‰€ä»¥åˆªå®Œè§’è‰²é‡æ–°å‰µè§’ï¼Œ
       å‰¯æœ¬æ¬¡æ•¸é‚„æ˜¯ä¸Šä¸€å€‹è§’è‰²ç”¨æ‰çš„ç‹€æ…‹ã€‚

       é€™è£¡ä¸å»åŒ…resetGame()ï¼ˆå®ƒæ˜¯å…ˆå–å¾—ç©å®¶ç¢ºèªå†location.reload()ï¼Œ
       åŒ…åœ¨å¤–é¢æœƒè®Šæˆã€Œä½¿ç”¨è€…æŒ‰äº†å–æ¶ˆï¼Œè³‡æ–™å»å·²ç¶“è¢«æ¸…æ‰ã€ï¼‰ï¼Œæ”¹æˆ
       åœ¨è…³æœ¬è¼‰å…¥æ™‚åˆ¤æ–·ã€Œç›®å‰æ ¹æœ¬æ²’æœ‰ä»»ä½•è§’è‰²ã€â€”â€”resetGame()æœƒ
       reloadï¼Œreloadå¾ŒloadGame()æ‰¾ä¸åˆ°å­˜æª”ï¼Œplayer.idæœƒæ˜¯ç©ºå­—ä¸²ï¼Œ
       é€™å€‹æ™‚æ©Ÿé»å°±æ˜¯æœ€ä¹¾æ·¨çš„ã€Œå…¨æ–°é–‹å§‹ã€ä¿¡è™Ÿï¼Œé †æ‰‹æŠŠé€™å…©å€‹å´é‚Š
       keyä¸€èµ·æ¸…ä¹¾æ·¨ã€‚
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
       14. å‰¯æœ¬æ€ªç‰©ç­‰ç´šå…¬å¼ï¼šç©å®¶ç¸½è§’è‰²ç­‰ç´šåŠ ç¸½ Ã· è§’è‰²æ•¸é‡
    ===================================================== */

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…æ˜ç¢ºæŒ‡æ­£ï¼‰ï¼š
       åŸæœ¬ã€Œæ‰€æœ‰å·²å»ºç«‹è§’è‰²ç­‰ç´šç¸½å’ŒÃ·è§’è‰²æ•¸é‡ã€çš„ç®—æ³•ï¼Œ
       åœ¨é«˜ç­‰ä¸»åŠ›å¸¶ä½ç­‰è§’è‰²æ™‚æœƒæŠŠå‰¯æœ¬ç­‰ç´šå¹³å‡å¾—å¾ˆä½
       ï¼ˆä¾‹å¦‚Lv.50+Lv.20+Lv.10åªæœƒç®—å‡ºç´„Lv.27ï¼‰ï¼Œé€ æˆ
       å‰¯æœ¬æ˜é¡¯åç°¡å–®ã€‚æ”¹æˆã€ŒéšŠä¼æœ€é«˜è§’è‰²ç­‰ç´šÃ—0.70ï¼‹
       éšŠä¼å¹³å‡è§’è‰²ç­‰ç´šÃ—0.30ã€ï¼Œè®“å‰¯æœ¬ç­‰ç´šä¸»è¦è·Ÿè‘—éšŠä¼
       è£¡æœ€å¼·çš„è§’è‰²èµ°ï¼Œå¹³å‡å€¼åªç”¨ä¾†åšå°å¹…åº¦çš„å¾®èª¿ï¼Œ
       ä¸æœƒå†è¢«ä½ç­‰è§’è‰²æ‹–ç´¯å¤ªå¤šã€‚åªæœ‰ä¸€åè§’è‰²æ™‚ï¼Œ
       æœ€é«˜ç­‰ç´šè·Ÿå¹³å‡ç­‰ç´šç›¸åŒï¼Œç®—å‡ºä¾†é‚„æ˜¯åŸæœ¬çš„è§’è‰²
       ç­‰ç´šï¼Œè¡Œç‚ºä¸è®Šã€‚
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

    /* å‰¯æœ¬æ™®é€šæ€ªçš„ HPï¼SPï¼é˜²ç¦¦æ²¿ç”¨æ—¢æœ‰è€ä¹…åŸºæº–ï¼›æ”»æ“Šèˆ‡é­”æ”»
       ä¸åœ¨å»ºæ€ªéšæ®µæ”¾å¤§ï¼Œæ€ªç‰©å°ç©å®¶çš„è¼¸å‡ºçµ±ä¸€äº¤ç”±æ•µæ–¹å£“åŠ›å€ç‡ã€‚ */
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
       â˜… æ–°å¢ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå‰¯æœ¬æ€ªç‰©æ•´é«”ä»ç„¶åå¼±ã€çš„
       ç¬¬äºŒè¼ªèª¿æ•´ï¼‰ï¼š
       ä¸Šé¢çš„DUNGEON_MONSTER_STRENGTHï¼ˆÃ—1.30ï¼‰åªè®“å‰¯æœ¬æ€ª
       æ‰“å¹³ä¸€èˆ¬é‡æ€ªï¼Œé€™è£¡ç–ŠåŠ ã€Œå‰¯æœ¬æ™®é€šæ€ªã€è‡ªå·±çš„é¡å¤–å¼·åŒ–
       ï¼ˆÃ—1.10ï¼Œå«SPï¼‰ï¼Œè®“åŒç­‰ç´šçš„å‰¯æœ¬æ™®é€šæ€ªæœ¬ä¾†å°±æ‡‰è©²æ¯”
       é‡å¤–æ™®é€šæ€ªå†å¼·ä¸€æˆªï¼ˆ1.30Ã—1.10â‰ˆ1.43å€ï¼‰ã€‚ç²¾è‹±/BOSS
       éƒ½æ˜¯å…ˆå¢Šåˆ°é€™ä¸€å±¤ã€Œå‰¯æœ¬æ™®é€šæ€ªã€çš„å®Œæ•´æ•¸å€¼ï¼Œæ‰å„è‡ªå†
       ç–ŠåŠ ç²¾è‹±/BOSSå°ˆå±¬å€ç‡ï¼ˆè¦‹ä¸‹é¢applyDungeonRankStrengthï¼‰ï¼Œ
       ä¸æ˜¯å¦å¤–å¾è£¸æ•¸å€¼é‡ç®—ï¼Œä¹Ÿä¸æœƒè®“Ã—1.30è¢«å¥—ç”¨ç¬¬äºŒæ¬¡
       â€”â€”é€™äº”å€‹å‡½å¼ï¼ˆmakeZoneMonsterâ†’
       applyDungeonMonsterStrengthâ†’applyDungeonNormalBonusâ†’
       applyDungeonRankStrengthï¼Œå…¨éƒ¨åŒ…åœ¨buildDungeonMonster()
       è£¡ï¼‰å°±æ˜¯å”¯ä¸€è² è²¬å‰¯æœ¬æ€ªæ•¸å€¼çš„åœ°æ–¹ï¼Œä¸€èˆ¬é‡æ€ªå®Œå…¨ä¸æœƒ
       ç¶“éé€™è£¡ï¼Œä¸å—å½±éŸ¿ã€‚
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
       ç²¾è‹±/BOSSå°ˆå±¬å€ç‡ï¼Œéƒ½æ˜¯å¾ã€Œå‰¯æœ¬æ™®é€šæ€ªã€çš„å®Œæ•´æ•¸å€¼
       ï¼ˆå·²ç¶“å¥—éÃ—1.30è·ŸÃ—1.10ï¼‰å†å¾€ä¸Šç–ŠåŠ ï¼Œä¸é‡æ–°å¾è£¸æ•¸å€¼
       ç®—èµ·ã€‚V138 ä¾æœ€æ–°è¦æ ¼åœ¨åŸæœ‰å¼·åº¦ä¸Šå†åŠ ï¼šç²¾è‹±æœ€çµ‚HP
       å†+100%ã€SP+100%ï¼›BOSSæœ€çµ‚HPå†+50%ã€SP+100%ã€‚
       V173.38 èµ· rank åªæ”¾å¤§ç”Ÿå­˜è³‡æºï¼›æ”»æ“Šï¼é­”æ”»ä¸å†æ–¼å»ºæ€ªéšæ®µ
       ä¹˜ç®—ï¼Œæ•µæ–¹è¼¸å‡ºå£“åŠ›çµ±ä¸€äº¤ç”±æ­£å¼ enemyPressure åŠ ç®—æ¡¶æ§åˆ¶ã€‚
       HPå€ç‡åˆ†åˆ¥ç‚º3.20ã€4.50ï¼ŒSPå…©è€…çš†Ã—2.00ï¼Œé˜²ç¦¦å€ç‡ä¿ç•™ã€‚
       åªèªmonster.rankï¼ˆmakeZoneMonster()ç¬¬4å€‹åƒæ•¸æ±ºå®šï¼‰ï¼Œ
       ä¸€èˆ¬æ€ªï¼ˆrankæ˜¯undefinedï¼‰é€™è£¡ä»€éº¼éƒ½ä¸åšï¼Œç›´æ¥è·³éã€‚
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

    /* å…±ç”¨å‰¯æœ¬ï¼æ·±æ·µå…¥å£ï¼šå®Œæ•´æ™®é€šåŸºæº–å¾Œå¥—å…±ç”¨ rank å€ç‡ã€‚
       è£å‚™å‰¯æœ¬ä½¿ç”¨ä¸‹æ–¹å°ˆç”¨å…¥å£ï¼Œé¿å…èˆ‡å…±ç”¨ rank å€ç‡ç–Šä¹˜ã€‚ */
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
       15. å‰¯æœ¬æˆ°é¬¥å•Ÿå‹•å™¨ï¼ˆå€Ÿç”¨monstersæ•´åŒ…æ›¿æ›çš„æ—¢æœ‰æ…£ä¾‹ï¼Œ
           çµæŸå¾Œå®Œæ•´é‚„åŸï¼Œä¸å½±éŸ¿å·¡æ€ªç³»çµ±ï¼‰
    ===================================================== */

    window.v132ActiveDungeonRun=null;

    function launchDungeonBattle(monsterList,onComplete,options){
        const opts=options&&typeof options==="object"?options:{};
        if(battleActive){
            alert("ç›®å‰æ­£åœ¨æˆ°é¬¥ä¸­ï¼Œç„¡æ³•é–‹å§‹å‰¯æœ¬ã€‚");
            return false;
        }

        window.v132ActiveDungeonRun={
            identityVersion:1,
            mode:String(opts.mode||"legacy-dungeon"),
            gameplayMode:opts.gameplayMode?String(opts.gameplayMode):null,
            dailyDungeonType:opts.dailyDungeonType?String(opts.dailyDungeonType):null,
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
           V137ï¼šå‰¯æœ¬èˆŠç‰ˆæ¯æ¬¡launchï¼ˆç¶“é©—å‰¯æœ¬ä¸‰å€‹stageä¹Ÿå„ç®—ä¸€æ¬¡ï¼‰
           éƒ½æŠŠç¬¬äºŒã€ç¬¬ä¸‰è§’è‰²è£œæ»¿ï¼Œä¸»è§’å»ä¿ç•™æ®˜è¡€ï¼Œé€ æˆå…è²»è£œè¡€èˆ‡
           è»Šè¼ªæˆ°é›£åº¦å¤±çœŸã€‚æ¯”ç…§ä¸€èˆ¬æˆ°é¬¥ï¼Œä¸‰åè§’è‰²ä¸€å¾‹åªå¤¾åœ¨ç›®å‰
           ä¸Šé™å…§ï¼Œä¸å¹³ç™½å›å¾©HP/SPã€‚
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
        addBattleLog("å‰¯æœ¬æˆ°é¬¥é–‹å§‹ï¼");
        addBattleLog("æ•µäººå…±æœ‰"+currentBattleMonsters.length+"éš»ã€‚");

        startTurn(battleToken);
        return true;
    }
    window.v132LaunchDungeonBattle=launchDungeonBattle;

    /*
       â˜… winBattle()/loseBattle()æ˜¯æ—¢æœ‰å·¡æ€ªç³»çµ±å‹è² çµç®—
       çš„å”¯ä¸€å…¥å£ï¼Œå‰¯æœ¬å€Ÿç”¨åŒä¸€å¥—å›åˆå¼•æ“ï¼Œå‹è² ç•¶ç„¶ä¹Ÿæœƒ
       ç¶“éé€™è£¡â€”â€”ç”¨window.v132ActiveDungeonRuné€™å€‹æ——æ¨™
       åˆ¤æ–·ã€Œé€™å ´æ˜¯ä¸æ˜¯å‰¯æœ¬æˆ°é¬¥ã€ï¼Œæ˜¯çš„è©±æ•´æ®µå°å»å‰¯æœ¬
       å°ˆå±¬çš„çµç®—æµç¨‹ï¼Œä¸¦ä¸”å®Œæ•´é‚„åŸmonsters/currentZoneï¼Œ
       ä¸åŸ·è¡Œå·¡æ€ªé‚£ä¸€å¥—ï¼ˆé‡ç”Ÿæ€ªç‰©ã€å›åœ°åœ–â€¦â€¦ï¼‰ã€‚
    */
    function restoreDungeonMonsters(){
        const run=window.v132ActiveDungeonRun;
        if(!run){ return; }
        monsters=run.previousMonsters;
        currentZone=run.previousZone;
    }

    function abortDungeonBattle(reason){
        const run=window.v132ActiveDungeonRun;
        if(!run){ return false; }
        battleActive=false;
        clearBattleRoundPrompt();
        finishBattleStatisticsSession(String(reason||"escape"));
        autoBattle=false;
        actionReady=false;
        pendingAction=null;
        clearInterval(timerId);
        timerId=null;
        if(battleAdvanceTimeoutId){ clearTimeout(battleAdvanceTimeoutId); battleAdvanceTimeoutId=null; }
        battleAdvanceScheduled=false;
        battleToken++;
        closeMenus();
        restoreDungeonMonsters();
        window.v132ActiveDungeonRun=null;
        updateUI();
        saveGame();
        if(run.onComplete){ run.onComplete({result:String(reason||"escape"),turnsUsed:turn}); }
        return true;
    }
    window.v132AbortDungeonBattle=abortDungeonBattle;

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

            addBattleLog("å‰¯æœ¬é€™ä¸€å ´æˆ°é¬¥å‹åˆ©ï¼");

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
               ä¸å‘¼å«ä¸€èˆ¬loseBattle()ï¼šå®ƒæœƒæ’ä¸€å€‹2.2ç§’å¾Œè¿”å›å·¡æ€ªåœ°åœ–çš„
               timeoutã€‚èˆŠç‰ˆé›–ç„¶å…ˆé¡¯ç¤ºå‰¯æœ¬é ï¼Œä»æœƒè¢«é‚£å€‹å»¶é²å›å‘¼è¸¢å›
               åœ°åœ–ã€‚å‰¯æœ¬å¤±æ•—åœ¨é€™è£¡å®Œæ•´æ”¶å°¾ä¸¦è£œæ»¿éšŠä¼ï¼Œå†äº¤çµ¦å‰¯æœ¬
               callbackå›åˆ°æ—¥å¸¸å‰¯æœ¬é ã€‚
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
            addBattleLog("å‰¯æœ¬æŒ‘æˆ°å¤±æ•—â€¦â€¦");
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
       16. ç¶“é©—å‰¯æœ¬ï¼šå–®ä¸€è§’è‰²10ç´šé–‹æ”¾ï¼Œé€£çºŒ3å ´è»Šè¼ªæˆ°
    ===================================================== */

    function startExpDungeonBattle(stage,rewardExp){
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<10;i++){
            const monster=buildDungeonMonster(
                "ç¶“é©—è»åœ˜å…µ",
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
        },{mode:"daily",dailyDungeonType:"exp"});
    }

    /*
       V139ç¶“é©—å‰¯æœ¬åŸºç¤çå‹µå›ºå®šç‚ºã€Œç›®å‰å…¨éšŠå‡ç´šéœ€æ±‚å¹³å‡å€¼çš„11%ã€ï¼Œ
       æ­£å¼ç¶­æŒã€ŒéšŠä¼ç•¶ç´š expNext å¹³å‡ Ã—33%ã€ï¼›çœ‹å»£å‘Šé›™å€æ²¿ç”¨æ—¢æœ‰
       æµç¨‹ï¼Œå› æ­¤ä¸€èˆ¬é ˜å–ç´„33%ã€é›™å€é ˜å–ç´„66%ã€‚
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
            '<h3>ç¶“é©—å‰¯æœ¬æŒ‘æˆ°æˆåŠŸï¼</h3>'+
            '<p>å¯ç²å¾—ç¶“é©—å€¼ï¼š<b>'+Math.floor(rewardExp).toLocaleString("zh-TW")+'</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(false)">ç›´æ¥é ˜å–</button>'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(true)">çœ‹å»£å‘Šé›™å€é ˜å–</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    function confirmDungeonEntry(title,details){
        if(typeof window.rpgConfirm!=="function"){
            return Promise.resolve(false);
        }
        return window.rpgConfirm(
            "ç¢ºå®šè¦é€²å…¥ã€Œ"+title+"ã€å—ï¼Ÿ\n\n"+
            details+"\n\n"+
            "é€²å…¥å¾Œæ‰æœƒé–‹å§‹æˆ°é¬¥ï¼›æŒ‘æˆ°å¤±æ•—ä¸æœƒæ‰£é™¤ä»Šæ—¥æ¬¡æ•¸ã€‚",
            {
                title:"å‰¯æœ¬ç¢ºèª",
                confirmText:"é€²å…¥å‰¯æœ¬",
                cancelText:"è¿”å›"
            }
        );
    }

    window.v132ClaimExpDungeonReward=function(doubled){
        function grant(){
            const rewardMultiplier=doubled ? 2 : 1;
            const rewardExp=Math.floor(getExpDungeonRewardExp()*rewardMultiplier);
            sharedExp+=rewardExp;
            markDungeonUsed("exp");
            addBattleLog("ç¶“é©—å‰¯æœ¬çµç®—ï¼Œç²å¾—"+rewardExp+"EXPï¼Œå·²å­˜å…¥ç¶“é©—æ± ã€‚");
            saveGame();
            v132CloseRewardModal();
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("å»£å‘Šæœªå®Œæˆï¼Œæœªç²å¾—é›™å€çå‹µã€‚");
            });
        }else{
            grant();
        }
    };

    async function beginExpDungeon(){
        if(!isDungeonAvailable("exp")){
            alert("ç¶“é©—å‰¯æœ¬ä»Šå¤©å·²ç¶“æŒ‘æˆ°éäº†ã€‚");
            return;
        }
        const mainCharacter=getPartyCharacterByIndex(0);
        if(!mainCharacter || (mainCharacter.level||1)<10){
            alert("ç¶“é©—å‰¯æœ¬éœ€è¦ä¸»è§’è‰²ç­‰ç´šé”åˆ°10ç´šæ‰èƒ½é–‹å•Ÿã€‚");
            return;
        }
        if(!await confirmDungeonEntry(
            "ç¶“é©—å‰¯æœ¬",
            "å°‡é€£çºŒé€²è¡Œ3å ´æˆ°é¬¥ï¼ŒåŸºç¤çå‹µç‚ºç›®å‰å…¨éšŠå‡ç´šéœ€æ±‚å¹³å‡å€¼çš„11%ã€‚"
        )){
            return;
        }
        const rewardExp=getExpDungeonRewardExp();
        startExpDungeonBattle(1,rewardExp);
    }
    window.v132BeginExpDungeon=beginExpDungeon;


    /* =====================================================
       17. ææ–™å‰¯æœ¬ï¼šé›™è§’è‰²20ç´šé–‹æ”¾ï¼Œ5ç²¾è‹±+5æ™®é€šï¼Œå¯¶ç®±çå‹µ
    ===================================================== */

    async function beginMaterialDungeon(){
        if(!isDungeonAvailable("material")){
            alert("ææ–™å‰¯æœ¬ä»Šå¤©å·²ç¶“æŒ‘æˆ°éäº†ã€‚");
            return;
        }
        if(!hasLevel10CharacterForDailyDungeon()){
            alert("ææ–™å‰¯æœ¬éœ€è¦ä»»ä¸€è§’è‰²é”åˆ°10ç´šæ‰èƒ½é–‹å•Ÿã€‚");
            return;
        }
        if(!canAddItemToInventory(materialChestDefinition,3)){
            alert("è«‹å…ˆé ç•™å¯æ”¾å…¥3å€‹ææ–™å¯¶ç®±çš„èƒŒåŒ…ç©ºé–“ï¼Œå†æŒ‘æˆ°ææ–™å‰¯æœ¬ã€‚");
            return;
        }
        if(!await confirmDungeonEntry(
            "ææ–™å‰¯æœ¬",
            "æœ¬å ´å…±æœ‰10éš»æ€ªç‰©ï¼›é€šé—œå¾Œææ–™å¯¶ç®±åªæœƒæ”¾é€²èƒŒåŒ…ï¼Œä¸æœƒè‡ªå‹•é–‹å•Ÿã€‚"
        )){
            return;
        }

        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("ç¤¦è„ˆå®ˆè¡›ç²¾è‹±",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("ç¤¦è„ˆå®ˆè¡›",level,randomElement());
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
        },{mode:"daily",dailyDungeonType:"material"});
    }
    window.v132BeginMaterialDungeon=beginMaterialDungeon;

    /*
       â˜… ä¿®æ­£ï¼ˆä¾ç…§ä½¿ç”¨è€…è¦æ±‚ï¼Œã€Œå‰¯æœ¬å¯¶ç®±é ˜å–æ™‚ï¼Œä¸æ‡‰è©²ç›´æ¥
       é–‹å•Ÿï¼Œè€Œæ˜¯æ”¾é€²åŒ…åŒ…çµ¦ç©å®¶è‡ªä¸»é–‹èµ·ã€ï¼‰ï¼š
       åŸæœ¬ã€Œææ–™å‰¯æœ¬æŒ‘æˆ°æˆåŠŸã€æŒ‰ã€Œç›´æ¥é ˜å–ã€å°±æœƒé¦¬ä¸ŠæŠŠå¯¶ç®±
       å…¨éƒ¨æ‹†é–‹ã€ææ–™ç›´æ¥é€²èƒŒåŒ…ï¼Œç©å®¶å®Œå…¨æ²’æœ‰æ©Ÿæœƒè‡ªå·±é¸æ™‚æ©Ÿ
       é–‹ã€‚æ”¹æˆï¼šé ˜å–åªæŠŠã€Œææ–™å¯¶ç®±ã€é€™å€‹æ–°ç‰©å“ï¼ˆå¯å †ç–Šï¼‰
       æ”¾é€²èƒŒåŒ…ï¼ŒçœŸæ­£çš„é–‹ç®±ï¼ˆéª°ç¤¦çŸ³/è¨­è¨ˆåœ–éšç´šï¼‰å»¶å¾Œåˆ°ç©å®¶
       åœ¨èƒŒåŒ…è£¡é»é–‹é€™å€‹ç‰©å“ã€æŒ‰ä¸‹ã€Œé–‹å•Ÿã€çš„é‚£ä¸€åˆ»æ‰é€²è¡Œã€‚
    */
    const CHEST_TIER_WEIGHTS=[
        {key:"white",label:"ç™½éš",weight:40},
        {key:"blue",label:"è—éš",weight:30},
        {key:"purple",label:"ç´«éš",weight:20},
        {key:"orange",label:"æ©™éš",weight:10}
    ];

    const materialChestDefinition={
        id:"materialChest",
        name:"ææ–™å¯¶ç®±",
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

    /* éª°ã€Œé–‹1å€‹ææ–™å¯¶ç®±ã€æœƒæ‹¿åˆ°çš„å…§å®¹ï¼Œç´”è¨ˆç®—ã€ä¸ç¢°èƒŒåŒ…ã€‚ */
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
       å¾èƒŒåŒ…å¯¦éš›é–‹å•Ÿ1å€‹ææ–™å¯¶ç®±ï¼šå…ˆç¢ºèªåº«å­˜å¤ ã€æ‰£æ‰1å€‹å¯¶ç®±ï¼Œ
       å†éª°å…§å®¹ã€åŠ é€²èƒŒåŒ…ã€‚å›å‚³çµæœå­—ä¸²é™£åˆ—çµ¦å‘¼å«ç«¯é¡¯ç¤ºï¼Œ
       æ‰£å¯¶ç®±å¤±æ•—ï¼ˆæ²’åº«å­˜ï¼‰å›å‚³nullã€‚
    */
    function openSingleMaterialChestFromInventory(){
        const rewards=rollMaterialChestRewards();
        const opened=runInventoryTransaction(()=>{
            if(!consumeStackItem("materialChest",1)){ return false; }
            return rewards.every(r=>addItemToInventory(r.def,r.amount));
        });
        rebuildInventorySlots();
        if(!opened){
            alert("èƒŒåŒ…ç©ºé–“ä¸è¶³ï¼Œææ–™å¯¶ç®±æœªæ¶ˆè€—ã€‚è«‹å…ˆæ•´ç†èƒŒåŒ…ã€‚");
            return null;
        }
        saveGame();
        return rewards.map(r=>r.def.name+"Ã—"+r.amount);
    }
    window.v132OpenMaterialChest=openSingleMaterialChestFromInventory;

    function showMaterialDungeonRewardModal(chestCount){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>ææ–™å‰¯æœ¬æŒ‘æˆ°æˆåŠŸï¼</h3>'+
            '<p>ç²å¾—ææ–™å¯¶ç®± Ã—'+chestCount+'</p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',false)">ç›´æ¥é ˜å–</button>'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',true)">çœ‹å»£å‘Šé›™å€é ˜å–</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132ClaimMaterialDungeonReward=function(chestCount,doubled){
        function grant(){
            const finalCount=doubled ? chestCount*2 : chestCount;
            const added=addItemToInventory(materialChestDefinition,finalCount);
            rebuildInventorySlots();
            if(!added){
                alert("èƒŒåŒ…ç©ºé–“ä¸è¶³ï¼Œææ–™å¯¶ç®±å°šæœªé ˜å–ï¼›è«‹å…ˆæ•´ç†èƒŒåŒ…å¾Œå†è©¦ã€‚");
                return;
            }
            markDungeonUsed("material");
            saveGame();
            v132CloseRewardModal();
            alert("ç²å¾—ææ–™å¯¶ç®±Ã—"+finalCount+"ï¼Œè«‹åˆ°èƒŒåŒ…è‡ªè¡Œé–‹å•Ÿã€‚");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("å»£å‘Šæœªå®Œæˆï¼Œæœªç²å¾—é›™å€çå‹µã€‚");
            });
        }else{
            grant();
        }
    };


    /* =====================================================
       18. è£å‚™å‰¯æœ¬ï¼šé›™è§’è‰²20ç´šé–‹æ”¾ï¼Œ1BOSS+4ç²¾è‹±ï¼Œé«˜æ¥µè£å‚™å¯¶ç®±
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
                "è£å‚™æ®¿å®ˆè­·è€…",level,randomElement(),"boss"
            );
            setMonsterMaxTierSkills(boss,0.7);
            lockDungeonSkillConfiguration(boss,3);
            roster.push(boss);
        }
        for(let i=0;i<composition.eliteCount;i++){
            const monster=buildEquipmentDungeonMonster("æ®¿å‰è­·è¡›ç²¾è‹±",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            lockDungeonSkillConfiguration(monster,2);
            roster.push(monster);
        }
        return roster;
    }
    window.v132BuildEquipmentDungeonRoster=buildEquipmentDungeonRoster;

    async function beginEquipmentDungeon(){
        if(!isDungeonAvailable("equipment")){
            alert("è£å‚™å‰¯æœ¬ä»Šå¤©å·²ç¶“æŒ‘æˆ°éäº†ã€‚");
        µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥â&WGW&ã°¢Ğ¢–b‚†4ÆWfVÃ6†&7FW$f÷$F–Ç”GVævVöâ‚’—°¢ÆW'B‚.Š9ŞX)XšşiÊÎ™ÈŠhK»¾KˆŠy.ˆ›.˜NX‹{I®h˜Şˆ;Ş™h¾YYş8""“°¢&WGW&ã°¢Ğ¢–b‚F–6¶WDFVf–æ—F–öç2ç6öÖR†FVf–æ—F–öãÓæ6äFD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÃ’’—°¢ÆW'B‚.Š¸¾XXš	yYˆ{>[	[Ë^Š9ŞX)h«ŞxØîX‹y¨Nˆ8ÎXÈ^z›®™i>ûÈÎXhŞhÉh‹Š9ŞX)XšşiÊÎ8""“°¢&WGW&ã°¢Ğ ¢6öç7B6ö×÷6—F–öãÖvWDWV—ÖVçDGVævVöä6ö×÷6—F–öâ‚“°¢–b‚v—B6öæf—&ÔGVævVöäVçG'’€¢.Š9ŞX)XšşiÊÂ"À¢.Y»®Zé®{zh‰ûÉ£™«´$õ5>ˆˆsN™«¾{+îˆ»h
®ûÈÎX[^YŞi[^K«®8" ¢’—°¢&WGW&ã°¢Ğ ¢6öç7B&÷7FW#Ö'V–ÆDWV—ÖVçDGVævVöå&÷7FW"‚“° ¢ÆVæ6„GVævVöä&GFÆR‡&÷7FW"ÆgVæ7F–öâ†÷WF6öÖR—°¢–b†÷WF6öÖRç&W7VÇBÓÒ'v–â"—°¢6†÷uvR‚&GVævVöâ"“°¢7v—F6„GVævVöåF"‚&F–Ç’"“°¢&WGW&ã°¢Ğ¢6†÷tWV—ÖVçDGVævVöå&Wv&DÖöFÂ‚“°¢ÒÇ¶ÖöFS¢&F–Ç’"ÆF–Ç”GVævVöåG—S¢&WV—ÖVçB'Ò“°¢Ğ¢v–æF÷rçc3$&Vv–äWV—ÖVçDGVævVöãÖ&Vv–äWV—ÖVçDGVævVöã° ¢gVæ7F–öâ6†÷tWV—ÖVçDGVævVöå&Wv&DÖöFÂ‚—°¢6öç7B‡FÖÃĞ¢sÆF—b6Æ73Ò'c3"×&Wv&BÖÖöFÂÖ–ææW"#âr°¢sÆƒ3îŠ9ŞX)XšşiÊÎhÉh‹h‰X©şûÈÂöƒ3âr°¢sÇîxÛ.[é~š¹j[^Š9ŞX)Zûnzë9sûÈÎŠ¸¾˜i8s[Ë^h«ŞxØîX‹ûÉ£Â÷âr°¢sÆF—b6Æ73Ò'c3"×F–6¶WBÖ6†ö–6W2#âr°¢F–6¶WDFVf–æ—F–öç2æÖ†FVcÓà¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'c3"×F–6¶WBÖ6†ö–6R"öæ6Æ–6³Ò'c3$6Æ–ÔWV—ÖVçDGVævVöå&Wv&B…Ârr¶FVbæ–B²uÂrÆfÇ6R’#âr°¢sÇ7â6Æ73Ò'c3"×F–6¶WBÖ–6öâ#âr¶FVbæ–6öâ²sÂ÷7ãâr°¢sÇ7â6Æ73Ò'c3"×F–6¶WBÖæÖR#âr¶FVbææÖR²sÂ÷7ãâr°¢sÂö'WGFöãâp¢’æ¦ö–â‚""’°¢sÂöF—câr°¢sÆF—b6Æ73Ò'c3"×&Wv&BÖ7F–öç2#âr°¢sÇ7â6Æ73Ò'c3"×&Wv&BÖæ÷FR#î˜Z[ŞK˜¾[èÎXúşXhŞ˜i8~iŠşY
nyÈ¾[º>Y®™¹XŞš	XùnûÈ™¹XŞûÉŞYÎjËîh«ŞxØîX‹Œ9s.ûÈ“Â÷7ãâr°¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'c3"×&Wv&BÖ&6²"öæ6Æ–6³Ò'c3$ÆVfTWV—ÖVçE&Wv&B‚’#î‹ùNY¹ãÂö'WGFöãâr°¢sÂöF—cãÂöF—câs°¢c3%6†÷u&Wv&DÖöFÂ†‡FÖÂ“°¢Ğ ¢v–æF÷rçc3$ÆVfTWV—ÖVçE&Wv&CÖgVæ7F–öâ‚—°¢c3$6Æ÷6U&Wv&DÖöFÂ‚“°¢6†÷uvR‚&GVævVöâ"“°¢7v—F6„GVævVöåF"‚&F–Ç’"“°¢Ó° ¢v–æF÷rçc3$6Æ–ÔWV—ÖVçDGVævVöå&Wv&CÖ7–æ2gVæ7F–öâ‡F–6¶WD–BÆF÷V&ÆVB—°¢gVæ7F–öâw&çB†Ö÷VçB—°¢6öç7BFVf–æ—F–öãÖvWEF–6¶WDFVf–æ—F–öâ‡F–6¶WD–B“°¢–b‚FVf–æ—F–öâ—²&WGW&ã²Ğ¢–b‚FD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÆÖ÷VçB’—°¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“°¢ÆW'B‚.ˆ8ÎXÈ^z›®™i>KˆŞ‹k>ûÈÎh«ŞxØîX‹[	®iÊ®š	XùnûÉ¾Š¸¾XXi[Nynˆ8ÎXÈ^[èÎXhŞŠšn8""“°¢&WGW&ã°¢Ğ¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“°¢Ö&´GVævVöåW6VB‚&WV—ÖVçB"“°¢6fTvÖR‚“°¢c3$6Æ÷6U&Wv&DÖöFÂ‚“°¢ÆW'B‚.xÛ.[ér"¶FVf–æ—F–öâææÖR²,9r"¶Ö÷VçB².ûÈ"“°¢6†÷uvR‚&GVævVöâ"“°¢7v—F6„GVævVöåF"‚&F–Ç’"“°¢Ğ ¢–b†F÷V&ÆVB—°¢w&çBƒ"“°¢&WGW&ã°¢Ğ ¢–b‚F÷V&ÆVB—°¢6öç7B6´F÷V&ÆSĞ¢G—Vöbv–æF÷rç't6öæf—&ÓÓÓÒ&gVæ7F–öâ"b`¢v—Bv–æF÷rç't6öæf—&Ò€¢.ŠhyÈ¾[º>Y®™¹XŞš	Xùn˜	[Ë^h«ŞxØîX‹YxîûÉò"À¢°¢F—FÆS¢.Š9ŞX)XšşiÊÎxØîX»R"À¢6öæf—&ÕFW‡C¢.ŠxyÈ¾[º>Y®™¹XÒ"À¢6æ6VÅFW‡C¢.y»Nhê^š	Xùb ¢Ğ¢“°¢–b†6´F÷V&ÆR—°¢6†÷u&Wv&FVDB†gVæ7F–öâ‚—²w&çBƒ"“²ÒÆgVæ7F–öâ‚—°¢ÆW'B‚.[º>Y®iÊ®ZèÎh‰ûÈÎiKx+®y»Nhê^š	Xùn8""“°¢w&çBƒ“°¢Ò“°¢&WGW&ã°¢Ğ¢Ğ¢w&çBƒ“°¢Ó°  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢’â˜	®yJxØîX»^[Øz©~ûÈ{
YjîŠhn‰8¾[NûÈÎ‹yş˜®h‹.iz.iÈk{ˆ›.{;¾Kˆˆ{NûÈ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢gVæ7F–öâVç7W&U&Wv&DÖöFÄVÆVÖVçB‚—°¢ÆWBÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'c3%&Wv&DÖöFÂ"“°¢–b†ÖöFÂ—²&WGW&âÖöFÃ²Ğ¢ÖöFÃÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢ÖöFÂæ–CÒ'c3%&Wv&DÖöFÂ#°¢ÖöFÂæ6Æ74æÖSÒ'c3"×&Wv&BÖÖöFÂ#°¢Fö7VÖVçBæ&öG’æVæD6†–ÆB†ÖöFÂ“°¢&WGW&âÖöFÃ°¢Ğ ¢v–æF÷rçc3%6†÷u&Wv&DÖöFÃÖgVæ7F–öâ†–ææW$‡FÖÂ—°¢6öç7BÖöFÃÖVç7W&U&Wv&DÖöFÄVÆVÖVçB‚“°¢ÖöFÂæ–ææW$…DÔÃÖ–ææW$‡FÖÃ°¢ÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"“°¢Ó° ¢v–æF÷rçc3$6Æ÷6U&Wv&DÖöFÃÖgVæ7F–öâ‚—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'c3%&Wv&DÖöFÂ"“°¢–b†ÖöFÂ—²ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“²Ğ¢Ó°  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢#âiz^[‹XšşiÊÎš™Ú.XZ~ZëûÈhê^˜.iz.iÈ—&VæFW$GVævVöåF$6öçFVç@¢y¨N8Îiz^[‹XšşiÊÎ[	®iÊ®ŠŠŞŠˆZèÎh‰8Şz›®jëÎûÈ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢gVæ7F–öâGVævVöäVçG'”6&B‡G—RÇF—FÆRÇ&WV—&VÖVçBÇ&Wv&E&Wf–WrÆöä6Æ–6²—°¢ò¢)ˆRiKyJ†—4GVævVöåW6VEFöF’‚ûÈÎ˜	jŠ>jøşiz^jÊi[iy~j‰™yÎ™hi˜.ûÈÀ¢yZ¾™Ú.K™şKˆZé®‹yş‰~šşzK®8ÎXúşhÉh‹8ŞûÈÎKˆŞiÈ>X{®xûî8ÎhÈ˜‰^iŠşxy¨N8¢KØnX[nZún˜(ş‹ÊşXXŠ‹hÉh‹8Ş˜	zŠîˆz®y»yù¾y»îy¨Nx¸hX¾8"¢ğ¢6öç7BW6VCÖ—4GVævVöåW6VEFöF’‡G—R“°¢&WGW&â€¢sÆF—b6Æ73Ò'c3"ÖGVævVöâÖ6&B#âr°¢sÆF—b6Æ73Ò'c3"ÖGVævVöâÖ6&B×F—FÆR#âr·F—FÆR°¢‡W6VBòsÇ7â6Æ73Ò'c3"ÖGVævVöâÖFöæR#îK¸®iz^[{.ZèÎh‰Â÷7ãâr¢rr’°¢sÂöF—câr°¢sÆF—b6Æ73Ò'c3"ÖGVævVöâÖ6&B×&W#î™h¾iKîj)ŞK»nûÉ¢r·&WV—&VÖVçB²sÂöF—câr°¢sÆF—b6Æ73Ò'c3"ÖGVævVöâÖ6&B×&Wv&B#îxØîX»^ûÉ¢r·&Wv&E&Wf–Wr²sÂöF—câr°¢sÆ'WGFöâG—SÒ&'WGFöâ"6Æ73Ò'c3"ÖGVævVöâÖVçFW"Ö'Fâ"r°¢‡W6VBò&F—6&ÆVB"¢vöæ6Æ–6³Ò"r¶öä6Æ–6²²r‚’"r’°¢sâr²‡W6VBò.K¸®iz^[{.hÉh‹"¢.hÉh‹"’²sÂö'WGFöãâr°¢sÂöF—câp¢“°¢Ğ ¢gVæ7F–öâ&VæFW$F–Ç”GVævVöäÆ—7B‚—°¢&WGW&â€¢sÆF—b6Æ73Ò'c3"ÖGVævVöâÖÆ—7B#âr°¢GVævVöäVçG'”6&B€¢&W‡"Â.{i>š™~XšşiÊÂ"Â.YjîKˆŠy.ˆ›.˜NX‹{I¢"À¢.XZ™¨®XØ~Kˆ¾Kˆ{I®h˜™È{‹Ş{i>š™~[›>YØ~XÎy¨C^ûÈ[º>Y®Xúş™¹XŞûÈ’"Â'c3$&Vv–äW‡GVævVöâ ¢’°¢GVævVöäVçG'”6&B€¢&ÖFW&–Â"Â.iÙiiXšşiÊÂ"Â.K»¾KˆŠy.ˆ›.˜NX‹{I¢"À¢.iÙiiZûnzë9sûÙã>ûÈKéŞ˜	®™yÎY¹îYi[ûÈ’"Â'c3$&Vv–äÖFW&–ÄGVævVöâ ¢’°¢GVævVöäVçG'”6&B€¢&WV—ÖVçB"Â.Š9ŞX)XšşiÊÂ"Â.K»¾KˆŠy.ˆ›.˜NX‹{I¢"À¢.š¹j[^Š9ŞX)Zûnzë9sûÈˆz®˜h«ŞxØîX‹ûÈ’"Â'c3$&Vv–äWV—ÖVçDGVævVöâ ¢’°¢sÆF—b7G–ÆSÒ&föçB×6—¦S£ƒ¶6öÆ÷#¢3vfcV3¶Ö&v–â×F÷£gƒ²#âr°¢„ETätTôåôD”Å•ôÄ”Ô•EôTä$ÄT@¢ò~jøşX¾XšşiÊÎjøşiz^Xú®ˆ;ŞhÉh‹jÊûÈÎhÉh‹ZKiY~KˆŞiÈ>hš>™šNjÊi[ûÈÂr°¢~š	XùnxØîX»^K˜¾[èÎh˜ŞiÈ>ŠˆXZ^K¸®iz^[{.ZèÎh‰8"p¢¢~)©ûˆòkŠÎŠšnjŠ[ÈşûÉ®jøşiz^hÉh‹jÊi[™™X‹nyºîX˜Şx+®™yÎ™hx¸hX¾ûÈÂr°¢~h˜iÈXšşiÊÎ˜;ŞXúşKº^xJ™™jÊ˜xŞŠH~hÉh‹8"r’°¢sÂöF—câr°¢sÂöF—câp¢“°¢Ğ ¢–b‡G—Vöb&VæFW$GVævVöåF$6öçFVçCÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ&VæFW$GVævVöåF$6öçFVçC×&VæFW$GVævVöåF$6öçFVçC°¢&VæFW$GVævVöåF$6öçFVçCÖgVæ7F–öâ‡F$æÖR—°¢–b‡F$æÖSÓÓÒ&F–Ç’"—°¢&WGW&â&VæFW$F–Ç”GVævVöäÆ—7B‚“°¢Ğ¢&WGW&â÷&–v–æÅ&VæFW$GVævVöåF$6öçFVçBæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ §Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó#‚×c32ÖV6öæö×’×&V&Ææ6Ræ§2¢ğ¢ò ¢c32(	B{i>kùşûÈşšH®h‰˜xŞikŠŠŞŠˆ‚÷væW ¢U…K¸ŞXú®˜.iz.iÈ’6†&VDW‡ûÈşŠy.ˆ›"W‡ûÉ¾ˆz®xKnXX^ˆ;ŞXú®KùŞZÙi˜.™i>h‹>ˆˆ~Šz>˜énx¸hX¾8 ¢¢ğ¢†gVæ7F–öâ–ç7FÆÅc34V6öæö×•&V&Ææ6R‚—°¢'W6R7G&–7B#° ¢6öç7BÔ…ô4„$5DU%ôÄUdTÃÓ°¢6öç7BD•ôÕ3Ó#B£c£c£°¢6öç7B4„$tUôÔ…ôÕ3Ós"£c£c£°¢6öç7Bu$õuD…õ5DDUô´U“×v–æF÷räf÷W%7–Ö&öÇ466÷VçE6fRæ66÷VçD¶W’‚&W‡×ööÂÖw&÷wF‚×7FFR"“° ¢6öç7BE$”ä”äuõ¤ôäUôU…õ$ôd”ÄU3Õ°¢¶Ö–äÆWfVÃ£ÆÖ„ÆWfVÃ£Æ¶W“¢&f÷&W7B"ÆfW&vTw&÷W6—¦S£"ÆfÆÆ&6´fW&vTW‡£sWÒÀ¢¶Ö–äÆWfVÃ£ÆÖ„ÆWfVÃ£#Æ¶W“¢&FW6W'B"ÆfW&vTw&÷W6—¦S£"ÆfÆÆ&6´fW&vTW‡£ƒWÒÀ¢¶Ö–äÆWfVÃ£#ÆÖ„ÆWfVÃ£3Æ¶W“¢&–6R"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£CS#‡ÒÀ¢¶Ö–äÆWfVÃ£3ÆÖ„ÆWfVÃ£CÆ¶W“¢'¦öæSB"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£cCƒGÒÀ¢¶Ö–äÆWfVÃ£CÆÖ„ÆWfVÃ£SÆ¶W“¢'¦öæSR"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£ƒ3#ÒÀ¢¶Ö–äÆWfVÃ£SÆÖ„ÆWfVÃ£cÆ¶W“¢'¦öæSb"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£S—ÒÀ¢¶Ö–äÆWfVÃ£cÆÖ„ÆWfVÃ£sÆ¶W“¢'¦öæSr"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£““gÒÀ¢¶Ö–äÆWfVÃ£sÆÖ„ÆWfVÃ£ƒÆ¶W“¢'¦öæS‚"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£scÒÀ¢¶Ö–äÆWfVÃ£ƒÆÖ„ÆWfVÃ£“Æ¶W“¢'¦öæS’"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£333WÒÀ¢¶Ö–äÆWfVÃ£“ÆÖ„ÆWfVÃ£“’Æ¶W“¢'¦öæS"ÆfW&vTw&÷W6—¦S£BãRÆfÆÆ&6´fW&vTW‡£C“Ğ¢Ó°¢6öç7BD$tUEô$EDÄUôä4„õ%3Õ°¢¶ÆWfVÃ£Æ&GFÆW3£7ÒÇ¶ÆWfVÃ£Æ&GFÆW3£WÒÇ¶ÆWfVÃ£#Æ&GFÆW3£CWÒÀ¢¶ÆWfVÃ£3Æ&GFÆW3£ÒÇ¶ÆWfVÃ£CÆ&GFÆW3£#SÒÇ¶ÆWfVÃ£SÆ&GFÆW3£CÒÀ¢¶ÆWfVÃ£cÆ&GFÆW3£cSÒÇ¶ÆWfVÃ£sÆ&GFÆW3£“ÒÇ¶ÆWfVÃ£ƒÆ&GFÆW3£#ÒÀ¢¶ÆWfVÃ£“Æ&GFÆW3£sÒÇ¶ÆWfVÃ£“RÆ&GFÆW3£#cÒÇ¶ÆWfVÃ£“‚Æ&GFÆW3£3SÒÀ¢¶ÆWfVÃ£“’Æ&GFÆW3£CĞ¢Ó° ¢ò¢Çc(i##[ú¾˜	şiÉş{jŞhÈiz.iÈ™ÙÎhX¾™Èk.ûÉ¾[éâÇc#(i##‹[~ûÈÆW‡æW‡BYJşKˆKéŞi9 ¢x+®8ÎŠ›.{I®{{NX©şXØjÚ>[Èş[›>YØ~h‹šÊRU…9rD$tUEô$EDÄUôä4„õ%>8Ş8"¢ğ¢6öç7BäUt4ôÔU%ôU…õ$UT•$TÔTåEôä4„õ%3Õ°¢¶ÆWfVÃ£ÇfÇVS£3ÒÇ¶ÆWfVÃ£RÇfÇVS£cÒÇ¶ÆWfVÃ£ÇfÇVS£#ÒÀ¢¶ÆWfVÃ£RÇfÇVS£#SÒÇ¶ÆWfVÃ£#ÇfÇVS£ƒĞ¢Ó°¢6öç7BäEU$Åô4„$tUôÄUdTÅ5õU%ôD“Õ°¢¶ÆWfVÃ£#ÇfÇVS£ã3ÒÇ¶ÆWfVÃ£3’ÇfÇVS£ã#WÒÇ¶ÆWfVÃ£C’ÇfÇVS£ã'ÒÀ¢¶ÆWfVÃ£SÇfÇVS£ãÒÇ¶ÆWfVÃ£c’ÇfÇVS¢ãƒÒÇ¶ÆWfVÃ£ƒBÇfÇVS¢ãcÒÀ¢¶ÆWfVÃ£“BÇfÇVS¢ãC7ÒÇ¶ÆWfVÃ£“’ÇfÇVS¢ã3'Ğ¢Ó°¢6öç7BD”Å•õTU5EôÄUdTÅ5õU%ôD“Õ°¢¶ÆWfVÃ£#ÇfÇVS¢ãƒWÒÇ¶ÆWfVÃ£3’ÇfÇVS¢ãƒ'ÒÇ¶ÆWfVÃ£C’ÇfÇVS¢ãsÒÀ¢¶ÆWfVÃ£SÇfÇVS¢ãc—ÒÇ¶ÆWfVÃ£c’ÇfÇVS¢ãS'ÒÇ¶ÆWfVÃ£ƒBÇfÇVS¢ãCÒÀ¢¶ÆWfVÃ£“BÇfÇVS¢ã3ÒÇ¶ÆWfVÃ£“’ÇfÇVS¢ã#GĞ¢Ó°¢6öç7BD”Å•õDõDÅõD$tUE3Õ°¢¶ÆWfVÃ£#ÇfÇVS£2ãÒÇ¶ÆWfVÃ£3’ÇfÇVS£2ãÒÇ¶ÆWfVÃ£C’ÇfÇVS£"ãCÒÀ¢¶ÆWfVÃ£SÇfÇVS£"ã3gÒÇ¶ÆWfVÃ£cÇfÇVS£"ãWÒÇ¶ÆWfVÃ£c’ÇfÇVS£"ãÒÀ¢¶ÆWfVÃ£sÇfÇVS£ã“wÒÇ¶ÆWfVÃ£ƒÇfÇVS£ãs'ÒÇ¶ÆWfVÃ£ƒBÇfÇVS£ãcÒÀ¢¶ÆWfVÃ£ƒRÇfÇVS£ãSwÒÇ¶ÆWfVÃ£“ÇfÇVS£ãCÒÇ¶ÆWfVÃ£“BÇfÇVS£ã3ÒÀ¢¶ÆWfVÃ£“RÇfÇVS£ã#wÒÇ¶ÆWfVÃ£“’ÇfÇVS£ãĞ¢Ó°¢ò¢˜	KˆzØnXú®YÊ[‹>‰™şzÊÎKˆjÊ8K‰N[	®iÊ¤Çc#i˜.YNš	KˆjÊûÈÎŠé>ikh˜¾XZ~ZëˆÎ™Ùà¢˜xŞŠH~‹ë.h
®h›şi9N{HCbÃU…ûÉ¾X[nšIK¸ŞyKjÚ>[‹h‹šÊ^ûÈşXéşK»¾X¹xØîX»^Š9Î‹k>8"¢ğ¢6öç7BäUt4ôÔU%ôD”Å•ô$ôåU4U3×·v–ã3£#Ç6¶–ÆÇ3S£SÆ¶–ÆÃ£#SÓ° ¢v–æF÷rçc34Ö„ÆWfVÃÔÔ…ô4„$5DU%ôÄUdTÃ° ¢gVæ7F–öâ–çFW'öÆFTæ6†÷'2†ÆWfVÂÆæ6†÷'2—°¢6öç7B6fSÔÖF‚æÖ‚†æ6†÷'5³ÒæÆWfVÂÄÖF‚æÖ–â†æ6†÷'5¶æ6†÷'2æÆVæwF‚ÓÒæÆWfVÂÄçVÖ&W"†ÆWfVÂ—ÇÆæ6†÷'5³ÒæÆWfVÂ’“°¢–b‡6fSÃÖæ6†÷'5³ÒæÆWfVÂ—²&WGW&âæ6†÷'5³ÒçfÇVS²Ğ¢f÷"†ÆWB“Ó¶“Ææ6†÷'2æÆVæwFƒ¶’²²—°¢6öç7B&–v‡CÖæ6†÷'5¶•Ó°¢–b‡6fSç&–v‡BæÆWfVÂ—²6öçF–çVS²Ğ¢6öç7BÆVgCÖæ6†÷'5¶’ÓÓ°¢6öç7BCÒ‡6fRÖÆVgBæÆWfVÂ’ò‡&–v‡BæÆWfVÂÖÆVgBæÆWfVÂ“°¢&WGW&âÆVgBçfÇVR²‡&–v‡BçfÇVRÖÆVgBçfÇVR’§C°¢Ğ¢&WGW&âæ6†÷'5¶æ6†÷'2æÆVæwF‚ÓÒçfÇVS°¢Ğ ¢gVæ7F–öâvWD7W'fTÖöç7FW%&æ´×VÇF—Æ–W"†Ööç7FW"—°¢–b†Ööç7FW"bdçVÖ&W"æ—4f–æ—FR„çVÖ&W"†Ööç7FW"çcC7W'fTVÆ—FU&FR’’—°¢6öç7B&FSÔÖF‚æÖ‚ƒÄÖF‚æÖ–âƒÄçVÖ&W"†Ööç7FW"çcC7W'fTVÆ—FU&FR’’“°¢&WGW&â·&FR¢ãS°¢Ğ¢ÆWB&æ³Ò'&VwVÆ"#°¢–b‡G—VöbvWDÖöç7FW%&æ³ÓÓÒ&gVæ7F–öâ"—²&æ³ÖvWDÖöç7FW%&æ²†Ööç7FW"“²Ğ¢VÇ6R–b†Ööç7FW"bfÖöç7FW"ç&æ²—²&æ³ÖÖöç7FW"ç&æ³²Ğ¢–b‡&æ³ÓÓÒ&&÷72"—²&WGW&â3²Ğ¢–b‡&æ³ÓÓÒ&VÆ—FR"—²&WGW&âãS²Ğ¢&WGW&â°¢Ğ ¢gVæ7F–öâvWEG&–æ–ætW‡&öf–ÆR†ÆWfVÂ—°¢6öç7B6fTÆWfVÃÔÖF‚æÖ–âƒ“’ÄÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†ÆWfVÂ—ÇÃ’’“°¢&WGW&âE$”ä”äuõ¤ôäUôU…õ$ôd”ÄU2æf–æB‡&öf–ÆSÓç6fTÆWfVÃã×&öf–ÆRæÖ–äÆWfVÂbg6fTÆWfVÃÃ×&öf–ÆRæÖ„ÆWfVÂ—ÇÅE$”ä”äuõ¤ôäUôU…õ$ôd”ÄU5³•Ó°¢Ğ¢gVæ7F–öâvWEG&–æ–æu¦öæU&÷7FW"‡&öf–ÆR—°¢G'—°¢–b‡G—Vöb¦öæT6öæf–sÓÓÒ'VæFVf–æVB'ÇÂ¦öæT6öæf–u·&öf–ÆRæ¶W•Ò—²&WGW&âçVÆÃ²Ğ¢6öç7B6÷W&6S×¦öæT6öæf–u·&öf–ÆRæ¶W•ÒæÖöç7FW'3°¢6öç7B&÷7FW#×G—Vöb6÷W&6SÓÓÒ&gVæ7F–öâ#÷6÷W&6R‚“§6÷W&6S°¢&WGW&â'&’æ—4'&’‡&÷7FW"’bg&÷7FW"æÆVæwFƒ÷&÷7FW#¦çVÆÃ°¢Ö6F6‚…ò—²&WGW&âçVÆÃ²Ğ¢Ğ¢gVæ7F–öâvWEG&–æ–æu¦öæTfW&vTW‡f÷$ÆWfVÂ†ÆWfVÂ—°¢6öç7B&öf–ÆSÖvWEG&–æ–ætW‡&öf–ÆR†ÆWfVÂ“°¢6öç7B&÷7FW#ÖvWEG&–æ–æu¦öæU&÷7FW"‡&öf–ÆR“°¢–b‚&÷7FW"—²&WGW&â&öf–ÆRæfÆÆ&6´fW&vTW‡²Ğ¢6öç7BfW&vS×&÷7FW"ç&VGV6R‚‡7VÒÆÖöç7FW"“Óç°¢–b‚Ööç7FW"—²&WGW&â7VÓ²Ğ¢6öç7Bf÷&ÖÄ&6S×G—Vöbv–æF÷rçcs4vWDf÷&ÖÄÖöç7FW$&6TW‡ÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcs4vWDf÷&ÖÄÖöç7FW$&6TW‡†Ööç7FW"¢¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‚„çVÖ&W"†Ööç7FW"æÆWfVÂ—ÇÃ’£3R’“°¢&WGW&â7VÒ¶f÷&ÖÄ&6R¦vWD7W'fTÖöç7FW%&æ´×VÇF—Æ–W"†Ööç7FW"“°¢ÒÃ’÷&÷7FW"æÆVæwFƒ°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚ç&÷VæB†fW&vR§&öf–ÆRæfW&vTw&÷W6—¦R’“°¢Ğ¢gVæ7F–öâvWEF&vWD&GFÆW4f÷$ÆWfVÂ†ÆWfVÂ—°¢6öç7B6fSÔÖF‚æÖ–âƒ“’ÄÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†ÆWfVÂ—ÇÃ’’“°¢–b‡6fSÃÕD$tUEô$EDÄUôä4„õ%5³ÒæÆWfVÂ—²&WGW&âD$tUEô$EDÄUôä4„õ%5³Òæ&GFÆW3²Ğ¢f÷"†ÆWB“Ó¶“ÅD$tUEô$EDÄUôä4„õ%2æÆVæwFƒ¶’²²—°¢6öç7B&–v‡CÕD$tUEô$EDÄUôä4„õ%5¶•Ó°¢–b‡6fSç&–v‡BæÆWfVÂ—²6öçF–çVS²Ğ¢6öç7BÆVgCÕD$tUEô$EDÄUôä4„õ%5¶’ÓÓ°¢6öç7BCÒ‡6fRÖÆVgBæÆWfVÂ’ò‡&–v‡BæÆWfVÂÖÆVgBæÆWfVÂ“°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚ç&÷VæB†ÆVgBæ&GFÆW2²‡&–v‡Bæ&GFÆW2ÖÆVgBæ&GFÆW2’§B’“°¢Ğ¢&WGW&âD$tUEô$EDÄUôä4„õ%5µD$tUEô$EDÄUôä4„õ%2æÆVæwF‚ÓÒæ&GFÆW3°¢Ğ¢gVæ7F–öâvWDW‡æW‡Df÷$ÆWfVÂ†ÆWfVÂ—°¢6öç7B6fSÔÖF‚æÖ–âƒ“’ÄÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†ÆWfVÂ—ÇÃ’’“°¢–b‡6fSÃ#—°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚ç&÷VæB†–çFW'öÆFTæ6†÷'2‡6fRÄäUt4ôÔU%ôU…õ$UT•$TÔTåEôä4„õ%2’’“°¢Ğ¢6öç7BfW&vT&GFÆTW‡ÖvWEG&–æ–æu¦öæTfW&vTW‡f÷$ÆWfVÂ‡6fR“°¢6öç7BF&vWD&GFÆW3ÖvWEF&vWD&GFÆW4f÷$ÆWfVÂ‡6fR“°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚ç&÷VæB†fW&vT&GFÆTW‡§F&vWD&GFÆW2’“°¢Ğ¢v–æF÷rçc34vWDW‡æW‡Df÷$ÆWfVÃÖvWDW‡æW‡Df÷$ÆWfVÃ°¢v–æF÷rçc3”vWEG&–æ–æu¦öæTfW&vTW‡f÷$ÆWfVÃÖvWEG&–æ–æu¦öæTfW&vTW‡f÷$ÆWfVÃ°¢v–æF÷rçc3”vWEF&vWD&GFÆW4f÷$ÆWfVÃÖvWEF&vWD&GFÆW4f÷$ÆWfVÃ° ¢gVæ7F–öâvWD†–v†W7D7&VFVD6†&7FW$ÆWfVÂ‚—°¢–b‡G—VöbvWDW†—7F–æu'G”–æFW†W2ÓÒ&gVæ7F–öâ"—²&WGW&â²Ğ¢&WGW&âvWDW†—7F–æu'G”–æFW†W2‚’ç&VGV6R‚†Ö‚Æ–æFW‚“Óç°¢6öç7B6†&7FW#×G—VöbvWE'G”6†&7FW$'”–æFWƒÓÓÒ&gVæ7F–öâ#övWE'G”6†&7FW$'”–æFW‚†–æFW‚“¦çVÆÃ°¢&WGW&â6†&7FW#ôÖF‚æÖ‚†Ö‚ÄçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“¦Öƒ°¢ÒÃ“°¢Ğ¢v–æF÷rçc34vWD†–v†W7D7&VFVD6†&7FW$ÆWfVÃÖvWD†–v†W7D7&VFVD6†&7FW$ÆWfVÃ° ¢gVæ7F–öâ†4æöäÖ„6†&7FW"‚—°¢&WGW&âG—VöbvWDW†—7F–æu'G”–æFW†W3ÓÓÒ&gVæ7F–öâ"bfvWDW†—7F–æu'G”–æFW†W2‚’ç6öÖR†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢&WGW&â†6†&7FW"bb„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“ÄÔ…ô4„$5DU%ôÄUdTÂ“°¢Ò“°¢Ğ¢gVæ7F–öâvWDæGW&Ä6†&vTÆWfVÇ5W$F’†ÆWfVÂ—°¢&WGW&â„çVÖ&W"†ÆWfVÂ—ÇÃ“Ã#ó¤ÖF‚æÖ‚ƒÆ–çFW'öÆFTæ6†÷'2†ÆWfVÂÄäEU$Åô4„$tUôÄUdTÅ5õU%ôD’’“°¢Ğ¢gVæ7F–öâvWDF–Ç•VW7DÆWfVÇ5W$F’†ÆWfVÂ—°¢&WGW&â„çVÖ&W"†ÆWfVÂ—ÇÃ“Ã#ó¤ÖF‚æÖ‚ƒÆ–çFW'öÆFTæ6†÷'2†ÆWfVÂÄD”Å•õTU5EôÄUdTÅ5õU%ôD’’“°¢Ğ¢gVæ7F–öâvWDF–Ç•F÷FÅF&vWB†ÆWfVÂ—°¢&WGW&â„çVÖ&W"†ÆWfVÂ—ÇÃ“Ã#ó¤ÖF‚æÖ‚ƒÆ–çFW'öÆFTæ6†÷'2†ÆWfVÂÄD”Å•õDõDÅõD$tUE2’“°¢Ğ¢v–æF÷rçcs4vWDæGW&Ä6†&vTÆWfVÇ5W$F“ÖvWDæGW&Ä6†&vTÆWfVÇ5W$F“°¢v–æF÷rçcs4vWDF–Ç•VW7DÆWfVÇ5W$F“ÖvWDF–Ç•VW7DÆWfVÇ5W$F“°¢v–æF÷rçcs4vWDF–Ç•F÷FÅF&vWCÖvWDF–Ç•F÷FÅF&vWC° ¢gVæ7F–öâvWDW‡ööÄ6F6…W×VÇF—Æ–W$f÷$ÆWfVÂ†ÆWfVÂ—°¢6öç7BvÔÖF‚æÖ‚ƒÆvWD†–v†W7D7&VFVD6†&7FW$ÆWfVÂ‚’ÔÖF‚æÖ‚ƒÄçVÖ&W"†ÆWfVÂ—ÇÃ’“°¢–b†vãÓ3—²&WGW&âãS²Ğ¢–b†vãÓ#—²&WGW&âã3²Ğ¢–b†vãÓ—²&WGW&âãS²Ğ¢&WGW&âã°¢Ğ¢gVæ7F–öâvWD6†&7FW%'G”–æFW‚†6†&7FW"—°¢–b‚6†&7FW"—²&WGW&âÓ²Ğ¢–b‡G—VöbvWDW†—7F–æu'G”–æFW†W3ÓÓÒ&gVæ7F–öâ"bgG—VöbvWE'G”6†&7FW$'”–æFWƒÓÓÒ&gVæ7F–öâ"—°¢6öç7B–æFWƒÖvWDW†—7F–æu'G”–æFW†W2‚’ç6Æ–6RƒÃ2’æf–æB‡fÇVSÓævWE'G”6†&7FW$'”–æFW‚‡fÇVR“ÓÓÖ6†&7FW"“°¢–b„çVÖ&W"æ—4–çFVvW"†–æFW‚’—²&WGW&â–æFWƒ²Ğ¢Ğ¢–b‡G—VöbÆ–W#"ÓÒ'VæFVf–æVB"bf6†&7FW#ÓÓ×Æ–W#"—²&WGW&â²Ğ¢–b‡G—VöbÆ–W#2ÓÒ'VæFVf–æVB"bf6†&7FW#ÓÓ×Æ–W#2—²&WGW&â#²Ğ¢–b‡G—VöbÆ–W"ÓÒ'VæFVf–æVB"bf6†&7FW#ÓÓ×Æ–W"—²&WGW&â²Ğ¢&WGW&âÓ°¢Ğ¢gVæ7F–öâvWDFF—F–öæÄ6†&7FW%ööÄ×VÇF—Æ–W"†6†&7FW"ÆÆWfVÂ—°¢6öç7B6fTÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"†ÆWfVÂ—ÇÄçVÖ&W"†6†&7FW"bf6†&7FW"æÆWfVÂ—ÇÃ“°¢–b‡6fTÆWfVÃãÓ#—²&WGW&â²Ğ¢6öç7B–æFWƒÖvWD6†&7FW%'G”–æFW‚†6†&7FW"“°¢–b†–æFWƒÓÓÓ"—²&WGW&â"ã²Ğ¢–b†–æFWƒÓÓÓ—²&WGW&âãS²Ğ¢&WGW&â°¢Ğ¢gVæ7F–öâvWDW‡ööÄ6F6…W×VÇF—Æ–W$DÆWfVÂ†6†&7FW"ÆÆWfVÂ—°¢6öç7B6Æ÷D×VÇF—Æ–W#ÖvWDFF—F–öæÄ6†&7FW%ööÄ×VÇF—Æ–W"†6†&7FW"ÆÆWfVÂ“°¢–b‡6Æ÷D×VÇF—Æ–W#ã—²&WGW&â6Æ÷D×VÇF—Æ–W#²Ğ¢&WGW&âvWDW‡ööÄ6F6…W×VÇF—Æ–W$f÷$ÆWfVÂ†ÆWfVÂ“°¢Ğ¢gVæ7F–öâvWDW‡ööÄ6F6…W×VÇF—Æ–W"†6†&7FW"—°¢&WGW&âvWDW‡ööÄ6F6…W×VÇF—Æ–W$DÆWfVÂ†6†&7FW"Æ6†&7FW"bf6†&7FW"æÆWfVÂ“°¢Ğ¢gVæ7F–öâvWDF—&V7D6F6…WW‡×VÇF—Æ–W"†6†&7FW"—°¢–b‚6†&7FW'ÇÂ„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“ãÓ#—²&WGW&â²Ğ¢6öç7B–æFWƒÖvWD6†&7FW%'G”–æFW‚†6†&7FW"“°¢–b†–æFWƒÓÓÓ"—²&WGW&â3²Ğ¢–b†–æFWƒÓÓÓ—²&WGW&â#²Ğ¢&WGW&â°¢Ğ¢v–æF÷rçcs4vWDW‡ööÄ6F6…W×VÇF—Æ–W$f÷$ÆWfVÃÖvWDW‡ööÄ6F6…W×VÇF—Æ–W$f÷$ÆWfVÃ°¢v–æF÷rçcs4vWDW‡ööÄ6F6…W×VÇF—Æ–W#ÖvWDW‡ööÄ6F6…W×VÇF—Æ–W#°¢v–æF÷rçcs4vWDF—&V7D6F6…WW‡×VÇF—Æ–W#ÖvWDF—&V7D6F6…WW‡×VÇF—Æ–W#° ¢gVæ7F–öâÆöDw&÷wF…7FFR‚—°¢G'—°¢6öç7B&sÔ¥4ôâç'6R†Æö6Å7F÷&vRævWD—FVÒ„u$õuD…õ5DDUô´U’—ÇÂ'·Ò"“°¢&WGW&â°¢–æ—F–Æ—¦VC§&ræ–æ—F–Æ—¦VCÓÓ×G'VRÀ¢VæÆö6¶VC§&rçVæÆö6¶VCÓÓ×G'VRÀ¢Æ7DC¤çVÖ&W"æ—4f–æ—FR„çVÖ&W"‡&ræÆ7DB’“ôÖF‚æÖ‚ƒÄçVÖ&W"‡&ræÆ7DB’“£À¢æ÷F–6U6†÷vã§&rææ÷F–6U6†÷vãÓÓ×G'VRÀ¢Æ7D6VC§&ræÆ7D6VCÓÓ×G'VRÀ¢æWv6öÖW%&Wv&G3§&rææWv6öÖW%&Wv&G2bgG—Vöb&rææWv6öÖW%&Wv&G3ÓÓÒ&ö&¦V7B#ôö&¦V7Bæ76–vâ‡·ÒÇ&rææWv6öÖW%&Wv&G2“§·Ğ¢Ó°¢Ö6F6‚…ò—°¢&WGW&â¶–æ—F–Æ—¦VC¦fÇ6RÇVæÆö6¶VC¦fÇ6RÆÆ7DC£Ææ÷F–6U6†÷vã¦fÇ6RÆÆ7D6VC¦fÇ6RÆæWv6öÖW%&Wv&G3§·×Ó°¢Ğ¢Ğ¢6öç7Bw&÷wF…7FFSÖÆöDw&÷wF…7FFR‚“°¢gVæ7F–öâW'6—7Dw&÷wF…7FFR‚—°¢G'—²Æö6Å7F÷&vRç6WD—FVÒ„u$õuD…õ5DDUô´U’Ä¥4ôâç7G&–æv–g’†w&÷wF…7FFR’“²Ö6F6‚…ò—²Ğ¢Ğ¢gVæ7F–öâ&W6WDw&÷wF…7FFTf÷$æô6†&7FW"‚—°¢w&÷wF…7FFRæ–æ—F–Æ—¦VCÖfÇ6S°¢w&÷wF…7FFRçVæÆö6¶VCÖfÇ6S°¢w&÷wF…7FFRæÆ7DCÓ°¢w&÷wF…7FFRææ÷F–6U6†÷vãÖfÇ6S°¢w&÷wF…7FFRæÆ7D6VCÖfÇ6S°¢w&÷wF…7FFRææWv6öÖW%&Wv&G3×·Ó°¢W'6—7Dw&÷wF…7FFR‚“°¢Ğ¢gVæ7F–öâ6†÷t6†&vUVæÆö6´æ÷F–6R‚—°¢–b†w&÷wF…7FFRææ÷F–6U6†÷vâ—²&WGW&ã²Ğ¢w&÷wF…7FFRææ÷F–6U6†÷vã×G'VS°¢W'6—7Dw&÷wF…7FFR‚“°¢ÆW'B‚.{i>š™~khÈ{¨ÎXX^ˆ;Ş[{.Šz>˜éeÆîXÛ>KÛşKˆŞhé¾j™şûÈÎ{i>š™~kK™şiÈ>hÈ{¨Î{Jşz˜ŞKúîx+®8""“°¢Ğ¢gVæ7F–öâVç7W&TW‡ööÄ6†&vUVæÆö6¶VB†æ÷rÇ6†÷tæ÷F–6R—°¢6öç7BF–ÖW7F×ÔçVÖ&W"æ—4f–æ—FR„çVÖ&W"†æ÷r’“ôçVÖ&W"†æ÷r“¤FFRææ÷r‚“°¢6öç7B†46†&7FW#×G—VöbvWDW†—7F–æu'G”–æFW†W3ÓÓÒ&gVæ7F–öâ"bfvWDW†—7F–æu'G”–æFW†W2‚’æÆVæwFƒã°¢–b‚†46†&7FW"—°¢–b†w&÷wF…7FFRæ–æ—F–Æ—¦VGÇÆw&÷wF…7FFRçVæÆö6¶VGÇÆw&÷wF…7FFRæÆ7DCã—²&W6WDw&÷wF…7FFTf÷$æô6†&7FW"‚“²Ğ¢&WGW&âfÇ6S°¢Ğ¢6öç7B†–v†W7CÖvWD†–v†W7D7&VFVD6†&7FW$ÆWfVÂ‚“°¢–b‚w&÷wF…7FFRæ–æ—F–Æ—¦VB—°¢w&÷wF…7FFRæ–æ—F–Æ—¦VC×G'VS°¢w&÷wF…7FFRæÆ7DC×F–ÖW7F×°¢w&÷wF…7FFRçVæÆö6¶VCÖ†–v†W7CãÓ#°¢w&÷wF…7FFRæÆ7D6VCÖfÇ6S°¢W'6—7Dw&÷wF…7FFR‚“°¢–b†w&÷wF…7FFRçVæÆö6¶VBbg6†÷tæ÷F–6R—²6†÷t6†&vUVæÆö6´æ÷F–6R‚“²Ğ¢&WGW&âw&÷wF…7FFRçVæÆö6¶VC°¢Ğ¢–b‚w&÷wF…7FFRçVæÆö6¶VBbf†–v†W7CÃ#—°¢w&÷wF…7FFRæÆ7DC×F–ÖW7F×°¢W'6—7Dw&÷wF…7FFR‚“°¢&WGW&âfÇ6S°¢Ğ¢–b‚w&÷wF…7FFRçVæÆö6¶VBbf†–v†W7CãÓ#—°¢w&÷wF…7FFRçVæÆö6¶VC×G'VS°¢w&÷wF…7FFRæÆ7DC×F–ÖW7F×°¢w&÷wF…7FFRæÆ7D6VCÖfÇ6S°¢W'6—7Dw&÷wF…7FFR‚“°¢–b‡6†÷tæ÷F–6R—²6†÷t6†&vUVæÆö6´æ÷F–6R‚“²Ğ¢&WGW&âG'VS°¢Ğ¢–b‚†w&÷wF…7FFRæÆ7DCã’—°¢w&÷wF…7FFRæÆ7DC×F–ÖW7F×°¢W'6—7Dw&÷wF…7FFR‚“°¢Ğ¢–b‡6†÷tæ÷F–6Rbbw&÷wF…7FFRææ÷F–6U6†÷vâ—²6†÷t6†&vUVæÆö6´æ÷F–6R‚“²Ğ¢&WGW&âw&÷wF…7FFRçVæÆö6¶VC°¢Ğ¢v–æF÷rçcs4Vç7W&TW‡ööÄ6†&vUVæÆö6¶VCÖVç7W&TW‡ööÄ6†&vUVæÆö6¶VC° ¢gVæ7F–öâvWD6†&vU&Wf–Wr†æ÷r—°¢6öç7BF–ÖW7F×ÔçVÖ&W"æ—4f–æ—FR„çVÖ&W"†æ÷r’“ôçVÖ&W"†æ÷r“¤FFRææ÷r‚“°¢6öç7B†–v†W7CÖvWD†–v†W7D7&VFVD6†&7FW$ÆWfVÂ‚“°¢–b‚w&÷wF…7FFRæ–æ—F–Æ—¦VGÇÂw&÷wF…7FFRçVæÆö6¶VGÇÆ†–v†W7CÃ#ÇÂ†4æöäÖ„6†&7FW"‚’—°¢&WGW&â¶v–ã£ÆVÆ6VD×3£Æ6VC¦fÇ6RÆÆWfVÇ5W$F“£Ç&VfW&Væ6TÆWfVÃ¦†–v†W7GÓ°¢Ğ¢6öç7B&tVÆ6VC×F–ÖW7F×ãÖw&÷wF…7FFRæÆ7DC÷F–ÖW7F×Öw&÷wF…7FFRæÆ7DC£°¢6öç7BVÆ6VCÔÖF‚æÖ–â„4„$tUôÔ…ôÕ2ÄÖF‚æÖ‚ƒÇ&tVÆ6VB’“°¢6öç7B&VfW&Væ6TÆWfVÃÔÖF‚æÖ–âƒ“’ÄÖF‚æÖ‚ƒ#Æ†–v†W7B’“°¢6öç7BÆWfVÇ5W$F“ÖvWDæGW&Ä6†&vTÆWfVÇ5W$F’‡&VfW&Væ6TÆWfVÂ“°¢6öç7Bv–ãÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†vWDW‡æW‡Df÷$ÆWfVÂ‡&VfW&Væ6TÆWfVÂ’¦ÆWfVÇ5W$F’¢†VÆ6VBôD•ôÕ2’’“°¢&WGW&â¶v–ã¦v–âÆVÆ6VD×3¦VÆ6VBÆ6VC§&tVÆ6VCãÔ4„$tUôÔ…ôÕ2ÆÆWfVÇ5W$F“¦ÆWfVÇ5W$F’Ç&VfW&Væ6TÆWfVÃ§&VfW&Væ6TÆWfVÇÓ°¢Ğ¢v–æF÷rçcs5&Wf–WtW‡ööÄ6†&vSÖvWD6†&vU&Wf–Ws° ¢gVæ7F–öâvWDf–Æ&ÆTW‡ööÂ†æ÷r—°¢&WGW&âÖF‚æÖ‚ƒÄçVÖ&W"‹ZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^typeof sharedExp!=="undefined"?sharedExp:0)||0)+getChargePreview(now).gain;
    }
    window.v173GetAvailableExpPool=getAvailableExpPool;

    function settleExpPoolCharge(now){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const wasInitialized=growthState.initialized;
        if(!ensureExpPoolChargeUnlocked(timestamp,false)){ return 0; }
        if(!wasInitialized){ return 0; }
        /* è£ç½®æ™‚é–“å€’é€€æ™‚åªæ‹’çµ•é€™æ®µæ™‚é–“ï¼Œä¸æŠŠæ¬Šå¨åŸºæº–å¾€å›ç§»ï¼›å¦å‰‡å…ˆ
           å€’é€€å†èª¿å›æ­£ç¢ºæ™‚é–“æœƒå†æ¬¡ç”¢ç”ŸåŒä¸€æ®µè‡ªç„¶å……èƒ½ã€‚ */
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
            const match=text.match(/â†’\s*Lv\.(\d+)/);
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
            meta.innerHTML="ç›®å‰ "+currentExp.toLocaleString("zh-TW")+" / "+next.toLocaleString("zh-TW")+" EXP"+
                (multiplier>1?'<b>è¿½è¶•åŠ æˆ Ã—'+multiplier.toFixed(2)+"</b>":"");

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
            summary.textContent="æœ¬æ¬¡åˆ†é…ï¼š"+cost.toLocaleString("zh-TW")+" EXP";
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
                alert("ç¶“é©—æ± ä¸è¶³ï¼Œé‚„éœ€è¦ "+(discounted-actual).toLocaleString("zh-TW")+" EXPã€‚");
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
                if(discounted>actual){ alert("ç¶“é©—æ± ä¸è¶³ï¼Œç„¡æ³•å®Œæˆæœ¬æ¬¡åˆ†é…ã€‚"); }
                return false;
            }
            const levelCount=Object.values(counts).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
            const confirmMessage="ç¢ºå®šè¦æ¶ˆè€— "+discounted.toLocaleString("zh-TW")+" EXPï¼Œå®Œæˆ "+levelCount+" æ¬¡å‡ç´šå—ï¼Ÿ";
            if(typeof window.rpgConfirm!=="function"){
                v173ScheduleExpPoolDecoration(viewport);
                return false;
            }
            const approved=await window.rpgConfirm(confirmMessage,{
                title:"ç¢ºèªç¶“é©—æ± å‡ç´š",
                confirmText:"ç¢ºå®šå‡ç´š",
                cancelText:"è¿”å›"
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
            if(title){ title.textContent="Lv20 è§£é–æŒçºŒå……èƒ½"; }
            if(rate){ rate.textContent="æœªå•Ÿå‹•"; }
            if(text){ text.textContent="é”åˆ° Lv20 å¾Œï¼Œå³ä½¿é›¢ç·šä¹ŸæœƒæŒçºŒç´¯ç©ç¶“é©—æ± ã€‚"; }
            lateState.visualGain=null;
            return;
        }
        const preview=getChargePreview(Date.now());
        if(title){ title.textContent=preview.capped?"å……èƒ½å·²æ»¿":"æŒçºŒå……èƒ½ä¸­"; }
        if(rate){ rate.textContent="ç´„ "+Math.round(preview.levelsPerDay*100)+"% ç­‰ç´šé€²åº¦ï¼æ—¥"; }
        if(text){ text.textContent="è‡ªç„¶å……èƒ½æœ€å¤šç´¯ç© 72 å°æ™‚ï¼›åœ¨ç·šã€é›¢ç·šéƒ½æœƒè¨ˆç®—ã€‚"; }
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
            small.textContent=small.dataset.v173BaseLabel+(bonus>0?"ï¼‹"+bonus.toLocaleString("zh-TW")+"EXP":" ");
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
        /* 4ç§’ timer åªé‡ç¹ªï¼è¨ˆç®—ç•«é¢ï¼Œå¾ä¸ç›´æ¥å¢åŠ  sharedExpã€‚ */
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
        character.µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥æÆWfVÃÔÖF‚æÖ–â„Ô…ô4„$5DU%ôÄUdTÂÄÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ’’“°¢–b†6†&7FW"æÆWfVÃãÔÔ…ô4„$5DU%ôÄUdTÂ—²6†&7FW"æW‡Ó²Ğ¢6†&7FW"æW‡æW‡CÖvWDW‡æW‡Df÷$ÆWfVÂ†6†&7FW"æÆWfVÂ“°¢Ğ  ¢gVæ7F–öâw&çDF—&V7D6F6…WW‡†6†&7FW"Æ&6TW‡—°¢–b‚6†&7FW'ÇÂ„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“ãÔÔ…ô4„$5DU%ôÄUdTÂ—²&WGW&â¶&6TW‡£Æ×VÇF—Æ–W#£Æw&çFVDW‡£Ó²Ğ¢6öç7B&sÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†&6TW‡—ÇÃ’“°¢6öç7B×VÇF—Æ–W#ÖvWDF—&V7D6F6…WW‡×VÇF—Æ–W"†6†&7FW"“°¢6öç7Bw&çFVCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‡&r¦×VÇF—Æ–W"’“°¢–b†w&çFVCÃÓ—²&WGW&â¶&6TW‡§&rÆ×VÇF—Æ–W#¦×VÇF—Æ–W"Æw&çFVDW‡£Ó²Ğ¢6†&7FW"æW‡ÔÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æW‡—ÇÃ’¶w&çFVC°¢ÆWBwV&CÓ°¢v†–ÆR‚„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“ÄÔ…ô4„$5DU%ôÄUdTÂbf6†&7FW"æW‡ãÔÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æW‡æW‡B—ÇÆvWDW‡æW‡Df÷$ÆWfVÂ†6†&7FW"æÆWfVÂ’’bfwV&CÃ—°¢6öç7B&Vf÷&SÔçVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ°¢–b‡G—Vöb6†V6´ÆWfVÅWÓÓÒ&gVæ7F–öâ"—²6†V6´ÆWfVÅW†6†&7FW"“²Ğ¢VÇ6W°¢6†&7FW"æW‡ÓÔÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æW‡æW‡B—ÇÆvWDW‡æW‡Df÷$ÆWfVÂ†6†&7FW"æÆWfVÂ’“°¢6†&7FW"æÆWfVÂ²³°¢&V6Æ–'&FT6†&7FW$W‡æW‡B†6†&7FW"“°¢Ğ¢–b‚„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“ÓÓÖ&Vf÷&R—²'&V³²Ğ¢wV&B²³°¢Ğ¢–b‡G—Vöb&Vg&W6„6†&7FW$fF$ÆWfVÇ3ÓÓÒ&gVæ7F–öâ"—²&Vg&W6„6†&7FW$fF$ÆWfVÇ2‚“²Ğ¢–b‡G—VöbWFFUT“ÓÓÒ&gVæ7F–öâ"—²WFFUT’‚“²Ğ¢–b‡G—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢&WGW&â¶&6TW‡§&rÆ×VÇF—Æ–W#¦×VÇF—Æ–W"Æw&çFVDW‡¦w&çFVGÓ°¢Ğ¢v–æF÷rçcs4w&çD6†&7FW$6F6…WW‡Öw&çDF—&V7D6F6…WW‡° ¢&V6Æ–'&FT6†&7FW$W‡æW‡B‡Æ–W"“°¢–b‡G—VöbÆ–W#"ÓÒ'VæFVf–æVB"bgÆ–W#"—²&V6Æ–'&FT6†&7FW$W‡æW‡B‡Æ–W#"“²Ğ¢–b‡G—VöbÆ–W#2ÓÒ'VæFVf–æVB"bgÆ–W#2—²&V6Æ–'&FT6†&7FW$W‡æW‡B‡Æ–W#2“²Ğ ¢6öç7Bw&÷wF…v4–æ—F–Æ—¦VCÖw&÷wF…7FFRæ–æ—F–Æ—¦VC°¢Vç7W&TW‡ööÄ6†&vUVæÆö6¶VB„FFRææ÷r‚’ÆfÇ6R“°¢–b†w&÷wF…v4–æ—F–Æ—¦VB—²6WGFÆTW‡ööÄ6†&vR„FFRææ÷r‚’“²Ğ ¢–b‡G—Vöb6†V6´ÆWfVÅWÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ6†V6´ÆWfVÅWÖ6†V6´ÆWfVÅW°¢6†V6´ÆWfVÅWÖgVæ7F–öâ‡F&vWD6†&7FW"—°¢6WGFÆTW‡ööÄ6†&vR„FFRææ÷r‚’“°¢6öç7B6†&7FW#×F&vWD6†&7FW'ÇÇÆ–W#°¢6öç7BÆWfVÄ&Vf÷&SÖ6†&7FW"æÆWfVÃ°¢–b†ÆWfVÄ&Vf÷&SãÔÔ…ô4„$5DU%ôÄUdTÂ—°¢&V6Æ–'&FT6†&7FW$W‡æW‡B†6†&7FW"“°¢–b‡G—Vöb&Vg&W6„6†&7FW$fF$ÆWfVÇ3ÓÓÒ&gVæ7F–öâ"—²&Vg&W6„6†&7FW$fF$ÆWfVÇ2‚“²Ğ¢–b‡G—VöbWFFUT“ÓÓÒ&gVæ7F–öâ"—²WFFUT’‚“²Ğ¢–b‡G—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢&WGW&âfÇ6S°¢Ğ¢6öç7B&W7VÇCÖ÷&–v–æÄ6†V6´ÆWfVÅWæÇ’‡F†—2Æ&wVÖVçG2“°¢–b†6†&7FW"æÆWfVÃäÔ…ô4„$5DU%ôÄUdTÂ—°¢6öç7BW†6W74ÆWfVÇ3Ö6†&7FW"æÆWfVÂÔÔ…ô4„$5DU%ôÄUdTÃ°¢6†&7FW"æÆWfVÃÔÔ…ô4„$5DU%ôÄUdTÃ°¢6†&7FW"æGG&–'WFUö–çG3ÔÖF‚æÖ‚ƒÂ„çVÖ&W"†6†&7FW"æGG&–'WFUö–çG2—ÇÃ’ÖW†6W74ÆWfVÇ2£R“°¢6†&7FW"ç6¶–ÆÅö–çG3ÔÖF‚æÖ‚ƒÂ„çVÖ&W"†6†&7FW"ç6¶–ÆÅö–çG2—ÇÃ’ÖW†6W74ÆWfVÇ2£"“°¢6†&7FW"æ&öçW4…ÔÖF‚æÖ‚ƒÂ„çVÖ&W"†6†&7FW"æ&öçW4…—ÇÃ’ÖW†6W74ÆWfVÇ2£3“°¢6†&7FW"æ&öçW55ÔÖF‚æÖ‚ƒÂ„çVÖ&W"†6†&7FW"æ&öçW55—ÇÃ’ÖW†6W74ÆWfVÇ2£“°¢6†&7FW"æW‡Ó°¢Ğ¢–b†6†&7FW"æÆWfVÂÓÖÆWfVÄ&Vf÷&R—°¢&V6Æ–'&FT6†&7FW$W‡æW‡B†6†&7FW"“°¢Vç7W&TW‡ööÄ6†&vUVæÆö6¶VB„FFRææ÷r‚’ÇG'VR“°¢–b‡G—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b‡G—VöbF—7G&–'WFTW‡Fô6†&7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄF—7G&–'WFTW‡Fô6†&7FW%c33ÖF—7G&–'WFTW‡Fô6†&7FW#°¢F—7G&–'WFTW‡Fô6†&7FW#ÖgVæ7F–öâ†6†&7FW"—°¢6WGFÆTW‡ööÄ6†&vR„FFRææ÷r‚’“°¢–b†6†&7FW"bb„çVÖ&W"†6†&7FW"æÆWfVÂ—ÇÃ“ãÔÔ…ô4„$5DU%ôÄUdTÂ—°¢ÆW'B‚†6†&7FW"æ–GÇÂ.Šy.ˆ›""’².[{.˜BÇbâ"´Ô…ô4„$5DU%ôÄUdTÂ²"k»şzØ8""“°¢&WGW&âfÇ6S°¢Ğ¢&WGW&â÷&–v–æÄF—7G&–'WFTW‡Fô6†&7FW%c32æÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡G—Vöb7&VFT6†&7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ7&VFT6†&7FW#Ö7&VFT6†&7FW#°¢7&VFT6†&7FW#ÖgVæ7F–öâ‚—°¢6öç7B&W7VÇCÖ÷&–v–æÄ7&VFT6†&7FW"æÇ’‡F†—2Æ&wVÖVçG2“°¢&V6Æ–'&FT6†&7FW$W‡æW‡B‡Æ–W"“°¢Vç7W&TW‡ööÄ6†&vUVæÆö6¶VB„FFRææ÷r‚’ÆfÇ6R“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ¢–b‡G—Vöb7&VFTFF—F–öæÄ6†&7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ7&VFTFF—F–öæÄ6†&7FW#Ö7&VFTFF—F–öæÄ6†&7FW#°¢7&VFTFF—F–öæÄ6†&7FW#ÖgVæ7F–öâ‡6Æ÷DçVÖ&W"—°¢6öç7B&W7VÇCÖ÷&–v–æÄ7&VFTFF—F–öæÄ6†&7FW"æÇ’‡F†—2Æ&wVÖVçG2“°¢6öç7B6†&7FW#×6Æ÷DçVÖ&W#ÓÓÓ3÷Æ–W#3§Æ–W##°¢&V6Æ–'&FT6†&7FW$W‡æW‡B†6†&7FW"“°¢Vç7W&TW‡ööÄ6†&vUVæÆö6¶VB„FFRææ÷r‚’ÆfÇ6R“°¢–b‡G—VöbWFFUT“ÓÓÒ&gVæ7F–öâ"—²WFFUT’‚“²Ğ¢–b‡G—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ¢–b‡G—VöbFö7VÖVçBÓÒ'VæFVf–æVB"bgG—VöbFö7VÖVçBæFDWfVçDÆ—7FVæW#ÓÓÒ&gVæ7F–öâ"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"Â‚“Óç²–b‚Fö7VÖVçBæ†–FFVâ—²6WGFÆTW‡ööÄ6†&vR„FFRææ÷r‚’“²ÒÒ“°¢Ğ¢–b‡G—Vöbv–æF÷rÓÒ'VæFVf–æVB"bgG—Vöbv–æF÷ræFDWfVçDÆ—7FVæW#ÓÓÒ&gVæ7F–öâ"—°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'vW6†÷r"Â‚“Óç6WGFÆTW‡ööÄ6†&vR„FFRææ÷r‚’’“°¢Ğ¢–b‡G—Vöb&VæFW$W‡F—7G&–'WFTÆ—7CÓÓÒ&gVæ7F–öâ"—²&VæFW$W‡F—7G&–'WFTÆ—7B‚“²Ğ¢–b‡G—Vöb6WEF–ÖV÷WCÓÓÒ&gVæ7F–öâ"—²6WEF–ÖV÷WB†–ç7FÆÄÆFTw&÷wF„Væ†æ6VÖVçG2Ã“²Ğ ¢ò¢"âh
®xš˜y[š>hè‰×&æ¾XŞxèr¢ğ¢–b‡G—VöbvWDÖöç7FW$vöÆDG&÷ÓÓÒ&gVæ7F–öâ"—°¢vWDÖöç7FW$vöÆDG&÷ÖgVæ7F–öâ†Ööç7FW"—°¢–b‚Ööç7FW"—²&WGW&â²Ğ¢6öç7BÆWfVÃÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ööç7FW"æÆWfVÂ—ÇÃ’“°¢6öç7B&æ³ÖvWDÖöç7FW%&æ²†Ööç7FW"“°¢6öç7B&æ´×VÇF—Æ–W#×&æ³ÓÓÒ&&÷72#óS§&æ³ÓÓÒ&VÆ—FR#ó#£°¢6öç7B&6SÖÆWfVÂ£"³3°¢6öç7Bf&–æ6SÓãƒR´ÖF‚ç&æFöÒ‚’£ã3°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†&6R§&æ´×VÇF—Æ–W"§f&–æ6R’“°¢Ó°¢Ğ ¢ò¢2âYXn[©~X;jÂ¢ğ¢6öç7B4„õõ$”4UõD”U%3Õ°¢¶Ö„ÆWfVÃ£3Æ×VÇF—Æ–W#£ÆÆ&VÃ¢$ÇbãûÙã3'ÒÇ¶Ö„ÆWfVÃ£CÆ×VÇF—Æ–W#£ãRÆÆ&VÃ¢$Çbã3ûÙãC'ÒÀ¢¶Ö„ÆWfVÃ£SÆ×VÇF—Æ–W#£"ÆÆ&VÃ¢$ÇbãCûÙãS'ÒÇ¶Ö„ÆWfVÃ£cÆ×VÇF—Æ–W#£"ãRÆÆ&VÃ¢$ÇbãSûÙãc'ÒÀ¢¶Ö„ÆWfVÃ£sÆ×VÇF—Æ–W#£2ÆÆ&VÃ¢$ÇbãcûÙãs'ÒÇ¶Ö„ÆWfVÃ£ƒÆ×VÇF—Æ–W#£2ãRÆÆ&VÃ¢$ÇbãsûÙãƒ'ÒÀ¢¶Ö„ÆWfVÃ£“Æ×VÇF—Æ–W#£BÆÆ&VÃ¢$ÇbãƒûÙã“'ÒÇ¶Ö„ÆWfVÃ£Æ×VÇF—Æ–W#£BãRÆÆ&VÃ¢$Çbã“ûÙã'Ğ¢Ó°¢gVæ7F–öâvWE6†÷&–6UF–W"‚—°¢6öç7B†–v†W7DÆWfVÃÖvWD†–v†W7D7&VFVD6†&7FW$ÆWfVÂ‚“°¢f÷"†6öç7BF–W"öb4„õõ$”4UõD”U%2—²–b††–v†W7DÆWfVÃÃ×F–W"æÖ„ÆWfVÂ—²&WGW&âF–W#²ÒĞ¢&WGW&â4„õõ$”4UõD”U%5µ4„õõ$”4UõD”U%2æÆVæwF‚ÓÓ°¢Ğ¢gVæ7F–öâvWE6†÷—FVÕ&–6R‡6†÷—FVÒ—°¢–b‚6†÷—FV×ÇÂçVÖ&W"æ—4f–æ—FR‡6†÷—FVÒç&–6R’—²&WGW&â6†÷—FVÓ÷6†÷—FVÒç&–6S¦çVÆÃ²Ğ¢&WGW&âÖF‚ç&÷VæB‡6†÷—FVÒç&–6R¦vWE6†÷&–6UF–W"‚’æ×VÇF—Æ–W"“°¢Ğ¢v–æF÷rçc34vWE6†÷—FVÕ&–6SÖvWE6†÷—FVÕ&–6S° ¢ò¢Bâ‰z^kNŠ9ÎY8¢ğ¢6öç7B4„õõõD”ôåô$4Uõ$”4U3×¶‡÷F–öã£#Æ‡÷F–öã3£SÆ‡÷F–öãS£ƒÇ7÷F–öã£#RÇ7÷F–öã3£cRÇ7÷F–öãS£Ó°¢6öç7B4„õõõD”ôåô”E3Ôö&¦V7Bæ¶W—2…4„õõõD”ôåô$4Uõ$”4U2“°¢6öç7B4„õõU$4„4UôÔ…õTåD•E“Ó“““°¢gVæ7F–öâæ÷&ÖÆ—¦U6†÷W&6†6UVçF—G’‡fÇVR—°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚æÖ–â…4„õõU$4„4UôÔ…õTåD•E’ÄÖF‚æfÆö÷"„çVÖ&W"‡fÇVR—ÇÃ’’“°¢Ğ¢v–æF÷rææ÷&ÖÆ—¦U6†÷W&6†6UVçF—G“Öæ÷&ÖÆ—¦U6†÷W&6†6UVçF—G“°¢v–æF÷rçc34æ÷&ÖÆ—¦U6†÷VçF—G”–çWCÖgVæ7F–öâ†–çWBÆ÷F–öç2—°¢–b‚–çWB—²&WGW&â²Ğ¢6öç7B6öÖÖ—CÒ†÷F–öç2bf÷F–öç2æ6öÖÖ—B“°¢6öç7B&sÕ7G&–ær†–çWBçfÇVSÓÖçVÆÃò"#¦–çWBçfÇVR’çG&–Ò‚“°¢–b‡&sÓÓÒ""bb6öÖÖ—B—²&WGW&âçVÆÃ²Ğ¢6öç7BVçF—G“Öæ÷&ÖÆ—¦U6†÷W&6†6UVçF—G’‡&r“°¢–çWBçfÇVSÕ7G&–ær‡VçF—G’“°¢&WGW&âVçF—G“°¢Ó°¢–b‡G—Vöb÷F–öäFVf–æ—F–öç2ÓÒ'VæFVf–æVB"bd'&’æ—4'&’‡÷F–öäFVf–æ—F–öç2’—°¢ÆWB‡÷F–öã3×÷F–öäFVf–æ—F–öç2æf–æB‡Óçbgæ–CÓÓÒ&‡÷F–öã3"“°¢–b‚‡÷F–öã3—°¢‡÷F–öã3×¶–C¢&‡÷F–öã3"ÆæÖS¢.Y¹î[ê“3T…‰z^kB"Ç6†÷'DæÖS¢$…3R"Æ–6öã¢""ÇG—S¢'÷F–öâ"Ç&W6÷W&6S¢&‡"Ç&V6÷fW'•W&6VçC£3Ç&–6S£SÇ7FG3§·×Ó°¢÷F–öäFVf–æ—F–öç2çW6‚†‡÷F–öã3“°¢Ğ¢‡÷F–öã3ç&–6SÓS°¢ÆWB7÷F–öã3×÷F–öäFVf–æ—F–öç2æf–æB‡Óçbgæ–CÓÓÒ'7÷F–öã3"“°¢–b‚7÷F–öã3—°¢7÷F–öã3×¶–C¢'7÷F–öã3"ÆæÖS¢.Y¹î[ê“3U5‰z^kB"Ç6†÷'DæÖS¢%53R"Æ–6öã¢""ÇG—S¢'÷F–öâ"Ç&W6÷W&6S¢'7"Ç&V6÷fW'•W&6VçC£3Ç&–6S£cRÇ7FG3§·×Ó°¢÷F–öäFVf–æ—F–öç2çW6‚‡7÷F–öã3“°¢Ğ¢7÷F–öã3ç&–6SÓcS°¢÷F–öäFVf–æ—F–öç2æf÷$V6‚†—FVÓÓç°¢–b†—FVÒbdö&¦V7Bç&÷F÷G—Ræ†4÷vå&÷W'G’æ6ÆÂ…4„õõõD”ôåô$4Uõ$”4U2Æ—FVÒæ–B’—°¢—FVÒç&–6SÕ4„õõõD”ôåô$4Uõ$”4U5¶—FVÒæ–EÓ°¢Ğ¢Ò“°¢Ğ¢gVæ7F–öâvWE6†÷&ÆU÷F–öç2‚—°¢–b‡G—Vöb÷F–öäFVf–æ—F–öç3ÓÓÒ'VæFVf–æVB'ÇÂ'&’æ—4'&’‡÷F–öäFVf–æ—F–öç2’—²&WGW&âµÓ²Ğ¢&WGW&â4„õõõD”ôåô”E2æÖ†–CÓç÷F–öäFVf–æ—F–öç2æf–æB†—FVÓÓæ—FVÒbf—FVÒæ–CÓÓÖ–B’’æf–ÇFW"„&ööÆVâ“°¢Ğ¢–b‡G—Vöb&VæFW%6†÷6öçFVçCÓÓÒ&gVæ7F–öâ"—°¢&VæFW%6†÷6öçFVçCÖgVæ7F–öâ‚—°¢6öç7BF–W#ÖvWE6†÷&–6UF–W"‚“°¢6öç7B6&G3ÖvWE6†÷&ÆU÷F–öç2‚’æÖ‡6†÷—FVÓÓç°¢6öç7B6÷VçC×G—VöbvWE÷F–öä6÷VçCÓÓÒ&gVæ7F–öâ#övWE÷F–öä6÷VçB‡6†÷—FVÒæ–B“£°¢6öç7B&W6÷W&6TÆ&VÃ×6†÷—FVÒç&W6÷W&6SÓÓÒ&‡#ò$…#¢%5#°¢6öç7BVffV7EFW‡CÖY¹î[êiÈZJrG·&W6÷W&6TÆ&VÇŞy¨BG·6†÷—FVÒç&V6÷fW'•W&6VçGÒV°¢6öç7BF—7Æ•&–6SÖvWE6†÷—FVÕ&–6R‡6†÷—FVÒ“°¢6öç7B†5&–6SÔçVÖ&W"æ—4f–æ—FR†F—7Æ•&–6R“°¢6öç7BF—6&ÆVCÒ†5&–6WÇÆvöÆCÆF—7Æ•&–6S°¢6öç7B'WGFöåFW‡CÒ†5&–6Sò.X;jÎ[è^Zé¢#¦G¶F—7Æ•&–6WÒ˜y[š6°¢&WGW&âÆF—b6Æ73Ò'6†÷×÷F–öâÖ6&BG·6†÷—FVÒç&W6÷W&6WÒ#à¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖ6&BÖ†VB#ãÇ7â6Æ73Ò'6†÷×÷F–öâ×G—R#âG·&W6÷W&6TÆ&VÇÓÂ÷7ããÇ7â6Æ73Ò'6†÷×÷F–öâ×7Fö6²#îhÈiÈ’G¶6÷VçGÓÂ÷7ããÂöF—cà¢ÆF—b6Æ73Ò'6†÷×÷F–öâÖæÖR#âG·6†÷—FVÒææÖWÓÂöF—cãÆF—b6Æ73Ò'6†÷×÷F–öâÖVffV7B#âG¶VffV7EFW‡GÓÂöF—cà¢ÆF—b6Æ73Ò'6†÷×÷F–öâ×W&6†6R×&÷r#ãÆÆ&VÂf÷#Ò'6†÷VçF—G’ÒG·6†÷—FVÒæ–GÒ#îi[˜xóÂöÆ&VÃà¢Æ–çWB–CÒ'6†÷VçF—G’ÒG·6†÷—FVÒæ–GÒ"6Æ73Ò'6†÷×÷F–öâ×VçF—G’"G—SÒ&çVÖ&W""–çWFÖöFSÒ&çVÖW&–2"Ö–ãÒ#"ÖƒÒ#““’"7FWÒ#"fÇVSÒ#"öæ–çWCÒ'c34æ÷&ÖÆ—¦U6†÷VçF—G”–çWB‡F†—2’"öæ&ÇW#Ò'c34æ÷&ÖÆ—¦U6†÷VçF—G”–çWB‡F†—2Ç¶6öÖÖ—C§G'VWÒ’#à¢Æ'WGFöâ6Æ73Ò&†öÖRÖfVGW&RÖ'W’Ö'Fâ6†÷×÷F–öâÖ'W’"G¶F—6&ÆVCò&F—6&ÆVB#¢"'Òöæ6Æ–6³Ò&'W•6†÷—FVÒ‚rG·6†÷—FVÒæ–GÒrÆFö7VÖVçBævWDVÆVÖVçD'”–B‚w6†÷VçF—G’ÒG·6†÷—FVÒæ–GÒr’çfÇVR’#âG¶'WGFöåFW‡GÓÂö'WGFöããÂöF—cãÂöF—cæ°¢Ò’æ¦ö–â‚""“°¢&WGW&âÆF—b6Æ73Ò'6†÷×÷F–öâÖ–çFW&f6R#ãÆF—b6Æ73Ò'6†÷×÷F–öâÖæ÷FR#îXú®‹*YJâ…ûÈõ5Y¹î[ê‰z^kCÂöF—cà¢ÆF—b6Æ73Ò'c32×6†÷×F–W"Öæ÷FR#îyºîX˜ŞYXn[©~™¨î{I®ûÉ¢G·F–W"æÆ&VÇŞûÈX;jÌ9rG·F–W"æ×VÇF—Æ–W'ŞûÈ“ÂöF—cãÆF—b6Æ73Ò'6†÷×÷F–öâÖÆ—7B#âG¶6&G7ÓÂöF—cãÂöF—cæ°¢Ó°¢Ğ¢–b‡G—Vöb'W•6†÷—FVÓÓÓÒ&gVæ7F–öâ"—°¢'W•6†÷—FVÓÖgVæ7F–öâ†—FVÔ–BÇ&WVW7FVEVçF—G’—°¢6öç7B6†÷—FVÓ×G—VöbvWE÷F–öäFVf–æ—F–öãÓÓÒ&gVæ7F–öâ#övWE÷F–öäFVf–æ—F–öâ†—FVÔ–B“¦çVÆÃ°¢–b‚6†÷—FV×ÇÂ4„õõõD”ôåô”E2æ–æ6ÇVFW2†—FVÔ–B’—²&WGW&ã²Ğ¢6öç7BVæ—E&–6SÖvWE6†÷—FVÕ&–6R‡6†÷—FVÒ“°¢–b‚çVÖ&W"æ—4f–æ—FR‡Væ—E&–6R’—²ÆW'B‚.˜	X¾‰z^kNy¨NX;jÎ[	®iÊ®ŠŠŞZé®8""“²&WGW&ã²Ğ¢6öç7BVçF—G“Öæ÷&ÖÆ—¦U6†÷W&6†6UVçF—G’‡&WVW7FVEVçF—G’“°¢6öç7BF÷FÅ&–6S×Væ—E&–6R§VçF—G“°¢–b†vöÆCÇF÷FÅ&–6R—²ÆW'B‚.˜y[š>KˆŞZJûÈÎiÊÎjÊ™ÈŠh"·F÷FÅ&–6RçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’²"˜y[š>8""“²&WGW&ã²Ğ¢–b‚FE÷F–öåFô–çfVçF÷'’†—FVÔ–BÇVçF—G’’—²ÆW'B‚.ˆ8ÎXÈ^[{.k»şûÈÎh‰nŠ›.‰z^kN[{.k).iÈXúşyJy¨NZnyh®z›®™i>8""“²&WGW&ã²Ğ¢vöÆBÓ×F÷FÅ&–6S°¢&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“²WFFTvöÆDF—7Æ’‚“²6fTvÖR‚“°¢6öç7B&öG”VÃÒB‚&†öÖTfVGW&TÖöFÄ&öG’"“°¢–b†&öG”VÂ—²&öG”VÂæ–ææW$…DÔÃ×&VæFW%6†÷6öçFVçB‚“²Ğ¢Ó°¢Ğ ¢ò¢RâX[yJ˜y[š>khˆ	~[z^X[r¢ğ¢gVæ7F–öâ7VæDvöÆDf÷$gWGW&U7—7FVÒ†Ö÷VçB—°¢6öç7B6÷7CÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢–b†6÷7CÃÓ—²&WGW&âG'VS²Ğ¢–b†vöÆCÆ6÷7B—²&WGW&âfÇ6S²Ğ¢vöÆBÓÖ6÷7C°¢–b‡G—VöbWFFTvöÆDF—7Æ“ÓÓÒ&gVæ7F–öâ"—²WFFTvöÆDF—7Æ’‚“²Ğ¢6fTvÖR‚“°¢&WGW&âG'VS°¢Ğ¢v–æF÷rçc357VæDvöÆDf÷$gWGW&U7—7FVÓ×7VæDvöÆDf÷$gWGW&U7—7FVÓ°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó#’×c3BÖf—†W2æ§2¢ğ¢ò ¢c3B(	B&GFÆRÆ–fV7–6ÆR6ö×F–&–Æ—G’f—‚à ¢F†Rf÷&ÖW"–çfVçF÷'’&WGW&âw&W"v2&WF—&VBgFW"–çfVçF÷'’6öçFW‡@¢&V6ÖR'BöbF†R6æöæ–6ÂvR&÷WFW"âF†—2f–ÆRæ÷r6öçF–ç2öæÇ’F†P¢Vç&VÆFVB&GFÆR…TB†æFöfc²–çfVçF÷'’†2æòÆVv7’w&W"†W&Rà¢¢ğ¢†gVæ7F–öâ–ç7FÆÅc3Df—†W2‚—°¢'W6R7G&–7B#° ¢–b‡G—Vöb&Vv–ä6†&7FW%GW&âÓÒ&gVæ7F–öâ"—²&WGW&ã²Ğ¢6öç7B÷&–v–æÄ&Vv–ä6†&7FW%GW&ãÖ&Vv–ä6†&7FW%GW&ã°¢&Vv–ä6†&7FW%GW&ãÖgVæ7F–öâ‡Fö¶Vâ—°¢6öç7B&W7VÇCÖ÷&–v–æÄ&Vv–ä6†&7FW%GW&âæÇ’‡F†—2Æ&wVÖVçG2“°¢–b‡G—VöbWFFT7F–öä‡VEf—6–&–Æ—G“ÓÓÒ&gVæ7F–öâ"—°¢WFFT7F–öä‡VEf—6–&–Æ—G’‚“°¢Ğ¢&WGW&â&W7VÇC°¢Ó°§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó3×c3RÖf—†W2æ§2¢ğ¢ò ¢c3R(	B˜	Kˆ‹Ê®y¨BBš^Y¹îZûÉ ¢âˆz®X¹^h‹šÊ^8ÎiˆîiˆîiÈ•5˜(NiŠşišî˜	®iK¾i8®8Ş(	N(	NiKh‰8ÎyÈ¾Zún™©¾{YiéÎ8Şy¨NY¹îšX¾ûÈÀ¢KˆŞXhŞXú®iŠşŠH~Š;ŞKˆK»Ş[É^i8îy¨NXŠNik~j)ŞK»nXë¾xÉÀ¢"âh¨ˆ;ŞŠhšşzK®KÙÎyJ[Ş‹ˆˆ~i[˜xşûÈˆz®X¹^h‹šÊ^ŠŠŞZé®8h˜¾X¹^h¨ˆ;ŞjÎ8˜yºîj‰hùzK®ûÈ¢2âŠÛ~y»îYÊk»şŠi˜.yÈ¾KˆŞX‹(	N(	NŠj)Şˆˆ~ŠÛ~y»îiKh‰X[yJYÎKˆX¾jùNKè¾Yû®k©`¢Bâh˜iÈX{®h˜¾ûÈşY¹îY™i>™©N{[KˆŠ«şh‰ã#Rzy ¢¢ğ¢†gVæ7F–öâ–ç7FÆÅc3Tf—†W2‚—°¢'W6R7G&–7B#° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢âˆz®X¹^h‹šÊ^Y¹îšX¾ûÉ®iKh‰8ÎKº^Zún™©¾{YiéÎx+®k©n8Ğ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢ò ¢)ˆRx+®K¸›«ÎŠh˜xŞX®ûÈ…c3By¨NX®k9^KˆŞZJZ[ŞûÈûÉ ¢c3BiŠşYÊXéşX{Ş[Èş‹yK˜¾X˜ŞûÈÎˆz®[{8ÎŠH~Š;ŞKˆK»Ş8Ş[É^i8îy¨NY¹¾X¾XŠNik~j)ŞK»`¢ûÈh¨ˆ;ŞKˆŞZÙYÊûÈşk).ZÛiÈ>ûÈõ5KˆŞ‹k>ûÈşšîYè¾KˆŞiJşhûNûÈXë¾š	kŠÎiÈ>KˆŞiÈ>˜Y¹à¢išîiK¾8.YXşšÎiŠş(	N(	NZh.iéÎ[É^i8îYºx+®iùX¾h‰k).ŠH~Š;ŞX‹y¨NynyK˜Y¹îišîiK¾ûÈÀ¢h‰y¨Nš	XŠNiÈ>XZ˜:˜	®˜î8ikÎiŠşK¸›«Î˜;ŞKˆŞXÛûÈÎxêZënyÈ¾X‹y¨N˜(NiŠş8Îˆê¾YŞX[nZi¢[iŠşišîiK¾8ˆÎK‰Njú¾xJŠª®iˆî8Ş8.KÛşyJˆ^˜	jÊY¹îZ8Îh‰[èz+®Zé®iÈ•5ûÈÀ¢ˆz®X¹^h‹šÊ^˜(NiŠşKÛşyJišî˜	®iK¾i8®8ŞjÚ>iŠş˜	zŠîh8^k8ûÉ¥5iˆîiˆîZJûÈÎh˜KºP¢c3By¨B5XŠNik~KˆŞiÈ>Š{y›ÎûÈÎKØnZún™©¾{YiéÎ˜(NiŠşišîiK¾8  ¢˜	Kˆx˜iKh‰ZèÎXZKˆŞxÉÎûÉ®XXŠ‰Kˆ¾xêZënŠŠŞZé®y¨Nh¨ˆ;ŞûÈÎŠé>XéşX{Ş[ÈşxZ~[‹‹yûÈÀ¢‹yZèÎK˜¾[èÎy»Nhê^yÈ²VWVVEÆ–W$7F–öç2Š:8ÎZún™©¾Š*¾hé.˜.Xë¾y¨NŠÎX¹^8Ğ¢iŠşK¸›«Î8.Xú®Šh8ÎŠŠŞZé®y¨NiŠşh¨ˆ;Ş8Zún™©¾hé.˜.Xë¾y¨NXÛ¾iŠşišî˜	®iK¾i8®8ŞûÈÀ¢[KˆZé®iÈ>XÛX{®Šª®iˆî(	N(	Nˆ;Ş[ŞKˆ®XéşYº[XÛX[~š¹NXéşYºûÈÎ[ŞKˆŞKˆ®[iˆîŠÉ°¢8ÎXéşYºKˆŞiˆî8ŞKŠnh¨®™yÎ˜Û^i[XÎKˆ‹[~XÛX{®Kèn8.˜	jŠ>KˆŞzê[É^i8îx+®K¸›«Î˜Y¹îûÈÀ¢xêZënûÈ‹yşK˜¾[èÎ™šN˜Êşy¨NK«®ûÈ˜;ŞKˆZé®yÈ¾[é~X‹{y®{J.ûÈÎKˆŞiÈ>XhŞiÈ™ÙÎ›¹ZKiY~8 ¢¢ğ¢6öç7Bc3TÆ7E&V6öã×·Ó° ¢gVæ7F–öâW‡Æ–äWFôfÆÆ&6²†6†&7FW$–æFW‚Æ6öæf–wW&VE6¶–ÆÄ–B—°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†6†&7FW$–æFW‚“°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶6öæf–wW&VE6¶–ÆÄ–EÓ°¢6öç7BæÖSÒ†6†&7FW"bb6†&7FW"æ–B—ÇÂ‚.Šy.ˆ›""²†6†&7FW$–æFW‚³’“° ¢–b‚6¶–ÆÂ—°¢&WGW&â.h›îKˆŞX‹8Â"¶6öæf–wW&VE6¶–ÆÄ–B².8Ş˜	X¾h¨ˆ;Ş‹8~iiûÈÎiKyJišî˜	®iK¾i8®8"#°¢Ğ ¢6öç7B6¶–ÆÄ¶W“ÖvWE'G”6†&7FW$¶W’†6†&7FW$–æFW‚“°¢6öç7BÆWfVÃÖvWE6¶–ÆÄÆWfVÂ‡6¶–ÆÄ¶W’Æ6öæf–wW&VE6¶–ÆÄ–B“°¢–b†ÆWfVÃÃÓ—°¢&WGW&âæÖR².˜(Nk).ZÛiÈ>8Â"·6¶–ÆÂææÖR².8ŞûÈÎiKyJišî˜	®iK¾i8®8"#°¢Ğ ¢6öç7B76÷7C×6¶–ÆÂç76÷7BÓ×VæFVf–æVBò6¶–ÆÂç76÷7B¢‡6¶–ÆÂæ6÷7GÇÃ“°¢–b†6†&7FW"bb6†&7FW"ç7Ç76÷7B—°¢&WGW&âæÖR²%5KˆŞ‹k>ûÈ‚"´ÖF‚æfÆö÷"†6†&7FW"ç7’²"ò"·76÷7B°¢.ûÈûÈÎxJk9^KÛşyJ8Â"·6¶–ÆÂææÖR².8ŞûÈÎiKyJišî˜	®iK¾i8®8"#°¢Ğ ¢–b…²&'Vfb"Â'76—fR"Â&†VÂ"Â'&Wf—fR%Òæ–æ6ÇVFW2‡6¶–ÆÂæ6FVv÷'’’—°¢6öç7BÆ&VÃĞ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"ò.k+¾y˜"" ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"ò.[êkK²" ¢6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"ò.Z)îy¸¢"¢.Š*¾X¹R#°¢&WGW&â.8Â"·6¶–ÆÂææÖR².8Ş[ÎikÂ"¶Æ&VÂ².šîh¨ˆ;ŞûÈÎˆz®X¹^h‹šÊ^yºîX˜ŞKˆŞiJşhûNûÈÎiKyJišî˜	®iK¾i8®8"#°¢Ğ ¢ò¢Y¹¾X¾[{.yú^XéşYº˜;Ş[ŞKˆŞKˆ®(	N(	NiˆîŠÉ¾XéşYºKˆŞiˆîûÈÎKŠn™˜NKˆ®XŠNik~yJy¨Ni[XÎûÈÀ¢Šé>xêZënXúşKº^y»Nhê^Y¹îZ˜	KˆŠÎûÈÎKˆŞyJXhŞxÉÎ8"¢ğ¢&WGW&â.8Â"·6¶–ÆÂææÖR².8ŞŠ*¾iKh‰išî˜	®iK¾i8®ûÈÎXéşYºKˆŞiˆâ"°¢.ûÈzØ{I¢"¶ÆWfVÂ².85"²†6†&7FW"òÖF‚æfÆö÷"†6†&7FW"ç7’¢#ò"’²"ò"·76÷7B°¢.8šîYè²"·6¶–ÆÂæ6FVv÷'’².ûÈ8.Š¸¾h¨®˜	ŠÎY¹îZ{Zn™h¾y›Îˆ^8"#°¢Ğ ¢–b‡G—VöbWFô7F–öäf÷$6†&7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄWFô7F–öäf÷$6†&7FW#ÖWFô7F–öäf÷$6†&7FW#°¢WFô7F–öäf÷$6†&7FW#ÖgVæ7F–öâ†6†&7FW$–æFW‚ÇFö¶Vâ—°¢6öç7B6öæf–sÖvWE'G”WFô6öæf–r†6†&7FW$–æFW‚“°¢6öç7B6öæf–wW&VE6¶–ÆÄ–CÖ6öæf–rò6öæf–rç6¶–ÆÂ¢çVÆÃ° ¢6öç7B&W7VÇCÖ÷&–v–æÄWFô7F–öäf÷$6†&7FW"æÇ’‡F†—2Æ&wVÖVçG2“° ¢G'—°¢ò¢c3b[{.hê^zêŠŠŞZé®hÈK˜^XÉn8fÆÆ&6²Šª®iˆîˆˆ~Zún™©²VWVVB7F–öà¢j
jÚ>ûÉ¾YÊ˜	Š:XÛ>i˜.XŠNik~iy~j‰ûÈÎ˜şXXŞXZ[NYÎi˜.XÛ˜xŞŠH~Šˆ®hş8 ¢KˆŞzêc3Rõc3bXZiJşX¹^hX²67&—BŠ«XXKˆ¾‹ÈZèÎh‰˜;ŞZèXZ8"¢ğ¢–b‡v–æF÷rçc3dWFô&GFÆTf—„–ç7FÆÆVB—°¢&WGW&â&W7VÇC°¢Ğ ¢ò¢Xú®iÈ8ÎxêZënyÉşy¨NŠŠŞK¨nKˆX¾h¨ˆ;Ş8Şh˜Ş™ÈŠhjª.iú^ûÉ¶æ÷&ÖÂöFVfVæ@¢iÊÎKèn[KˆŞiŠşh¨ˆ;ŞûÈÎk).iÈ8ÎŠ*¾˜Y¹î8Ş˜	Y¹îK¨¾8"¢ğ¢–b€¢6öæf–wW&VE6¶–ÆÄ–Bb`¢6öæf–wW&VE6¶–ÆÄ–BÓÒ&æ÷&ÖÂ"b`¢6öæf–wW&VE6¶–ÆÄ–BÓÒ&FVfVæB ¢—°¢6öç7BVWVVC×VWVVEÆ–W$7F–öç5¶6†&7FW$–æFW…Ó°¢6öç7B7GVÄ7F–öã×VWVVBòVWVVBæ7F–öâ¢çVÆÃ° ¢–b†7GVÄ7F–öãÓÓÒ&æ÷&ÖÂ"—°¢6öç7B&V6öãÖW‡Æ–äWFôfÆÆ&6²†6†&7FW$–æFW‚Æ6öæf–wW&VE6¶–ÆÄ–B“°¢–b‡c3TÆ7E&V6öå¶6†&7FW$–æFW…ÒÓ×&V6öâ—°¢c3TÆ7E&V6öå¶6†&7FW$–æFW…Ó×&V6öã°¢FD&GFÆTÆör‚.)ªûˆò"·&V6öâ“°¢Ğ¢Ğ¢VÇ6R–b†7GVÄ7F–öãÓÓÖ6öæf–wW&VE6¶–ÆÄ–B—°¢ò¢˜	jÊh‰X©şiKîX{®h¨ˆ;ŞK¨nûÈÎkˆ^hèXë¾˜xŞ{H˜ÈNûÈÀ¢Kˆ¾jÊyÉşy¨NXø˜Y¹îi˜.h˜ŞiÈ>˜xŞikXÛKˆjÊ8"¢ğ¢c3TÆ7E&V6öå¶6†&7FW$–æFW…ÓÖçVÆÃ°¢Ğ¢Ğ¢Ö6F6‚†W'&÷"—°¢6öç6öÆRæW'&÷"‚%c3Rˆz®X¹^h‹šÊ^Y¹îšX¾XŠNik~ZKiY~ûÉ¢"ÆW'&÷"“°¢Ğ ¢&WGW&â&W7VÇC°¢Ó°¢Ğ  ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢"âh¨ˆ;ŞKÙÎyJ[Ş‹ûÈşi[˜xşj‰zK ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ ¢ò ¢)ˆRKéŞxZ~KÛşyJˆ^Šhk.ûÈÎh¨®jøşX¾h¨ˆ;Ş8Îh™>Š«8h™>[›îX¾8Şy»Nhê^Zú¾YÊyZ¾™Ú.Kˆ®ûÈÀ¢KˆX¾YËik˜;ŞŠhiÈûÉ®ˆz®X¹^h‹šÊ^ŠŠŞZé®y¨Nh¨ˆ;ŞKˆ¾h¸8h˜¾X¹^h‹šÊ^y¨Nh¨ˆ;ŞjÎ8¢Kº^Xø®˜Z[Şh¨ˆ;ŞK˜¾[èÎy¨N˜yºîj‰hùzK®8  ¢[ŞxZr§2ó#R×c3Öf—‚Ö&F6‚æ§2y¨BvWE6¶–ÆÅF&vWG2‚’Zún™©¾ŠÎx+ ¢ûÈ˜*>h˜ŞiŠşyÉşjÚ>k®Zé®h™>X‹Š«y¨NYËikûÈûÉ ¢6–ævÆR(i"Xú®h™>KŠŞ[ø>˜*>KˆX°¢G&’(i"XùnKŠŞ[ø>h˜YÊ˜*>Kˆhé.y¨N8Î[znKŠŞXû>8ŞiÈZI£>X°¢&÷r(i"KŠŞ[ø>h˜YÊ˜*>Kˆi[Nhé ¢ÆÂ(i"ZNKˆ®XZ˜:ZÙkK¾h
®xš¢ÆÇ’(i"h‰ikYjîKˆyºîj‰¢ÆÇ”ÆÂ(i"h‰ikXZš¹NûÈ†67D'Vfe6¶–ÆÂiÈ>XùnX˜Ó>K«®ûÈ¢FVDÆÇ(i"h‰ik™š>Kªy¨NYjîKˆyºîj‰¢æöæR(i"KˆŞyJ˜yºîj‰ûÈ[Şˆz®[{şXZZNyIşiXûÈ¢¢ğ¢6öç7B4´”ÄÅõD$tUEõ44õUôÄ$TÅ3×°¢6–ævÆS¢.i[^ikKˆK«¢"À¢ò¢KˆŞyJhºÎ‰™şZú¾8ÎûÈYÎhé.[znKŠŞXû>ûÈ8Ş(	N(	N˜	K©¾j‰{NYÊˆz®X¹^h‹šÊ^Kˆ¾h¸Š:¢iÊÎKèn[iÈ>Š*¾XÈ^˜.Kˆ[NhºÎ‰™şûÈÎXhŞiÈXZ~[NhºÎ‰™şiÈ>Šè®h‰ ¢8ÎXkix¾Kˆ™h>ûÈi[^ikKˆK«®ûÈYÎhé.[znKŠŞXû>ûÈûÈûÈ8Ş[è™º>ŠèûÈÎiKyJKŠŞ›¹î8"¢ğ¢G&“¢.i[^ikKˆK«®8;¾YÎhé.[znKŠŞXû2"À¢&÷s¢.i[^iki[Nhé""À¢6öÇVÖã¢.i[^ikX˜Ş[èÃ.K«®8;¾YÎKØŞ{Úâ"À¢ÆÃ¢.i[^ikXZš¹B"À¢ÆÇ“¢.h‰ikKˆK«¢"À¢ÆÇ”ÆÃ¢.h‰ikXZš¹B"À¢FVDÆÇ“¢.h‰ik™š>KªKˆK«¢"À¢æöæS¢.ˆz®‹ª² ¢Ó° ¢gVæ7F–öâvWE6¶–ÆÅF&vWE66÷TÆ&VÂ‡6¶–ÆÂ—°¢–b‚6¶–ÆÂ—²&WGW&â"#²Ğ¢&WGW&â4´”ÄÅõD$tUEõ44õUôÄ$TÅ5·6¶–ÆÂçF&vWEG—U×ÇÂ"#°¢Ğ¢v–æF÷rçc3TvWE6¶–ÆÅF&vWE66÷TÆ&VÃÖvWE6¶–ÆÅF&vWE66÷TÆ&VÃ° ¢ò¢ÒÒÒ&âh˜¾X¹^h‹šÊ^h¨ˆ;ŞjÎ[{.yK§2óÖÖ–âæ§26æöæ–6Â÷væW"y»NhêP¢KºRc3TvWE6¶–ÆÅF&vWE66÷TÆ&VÂ‚’X¢F–fbWFF^ûÈÎKˆŞXhŞXÈ^Š9Ğ¢÷VÆFU6¶–ÆÅV–6´&"‚8"¢ğ ¢ò¢ÒÒÒ&"âˆz®X¹^h‹šÊ^ŠŠŞZé®y¨Nh¨ˆ;ŞKˆ¾h¸ûÉ®˜š^ih~ZÙ~[èÎ™Ú.Š9ÎKÙÎyJ[Ş‹ÒÒÒ¢ğ¢gVæ7F–öâFV6÷&FTWFõ6WGF–æw56¶–ÆÄ÷F–öç2‚—°¢6öç7B6VÆV7CÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&WFõ6WGF–æw47F–öå6VÆV7B"“°¢–b‚6VÆV7BÇÂ6VÆV7Bæ÷F–öç2—²&WGW&ã²Ğ ¢ÆWB6†ævVCÖfÇ6S°¢'&’æg&öÒ‡6VÆV7Bæ÷F–öç2’æf÷$V6‚†÷F–öãÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶÷F–öâçfÇVUÓ°¢6öç7BÆ&VÃÖvWE6¶–ÆÅF&vWE66÷TÆ&VÂ‡6¶–ÆÂ“°¢–b‚Æ&VÂ—²&WGW&ã²Ğ¢–b†÷F–öâçFW‡D6öçFVçBæ–æFW„öb‚.ûÈ‚"¶Æ&VÂ².ûÈ’"’ÓÒÓ—²&WGW&ã²Ğ¢÷F–öâçFW‡D6öçFVçCÖ÷F–öâçFW‡D6öçFVçB².ûÈ‚"¶Æ&VÂ².ûÈ’#°¢6†ævVC×G'VS°¢Ò“° ¢ò ¢)ˆR˜	Š:KˆZé®Šh˜xŞikhÈ~kKîKˆjÊçfÇV^ûÉ®˜	[›îX²Ç;ZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^elect> åœ¨é–‹å ´æ™‚
           è¢« initCustomDropdown()/makeSelectValueReactive() æ›æˆäº†è‡ªè¨‚çš„
           å‡ä¸‹æ‹‰ï¼ˆè¦‹ js/00-main.js:4326 èµ·ï¼‰ï¼Œç•«é¢ä¸ŠçœŸæ­£çœ‹å¾—åˆ°çš„æ˜¯é‚£ä»½
           å¦å¤–æ¸²æŸ“çš„æ¸…å–®ï¼Œè€Œå®ƒåªæœ‰åœ¨ .value è¢«è¨­å®šæ™‚æ‰æœƒé‡æ–°æ¸²æŸ“ã€‚
           åªæ”¹ <option> çš„æ–‡å­—ä¸æœƒåæ˜ åˆ°ç•«é¢ä¸Šï¼Œå¿…é ˆé é€™ä¸€è¡Œè§¸ç™¼é‡ç¹ªã€‚
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
       â˜… æ³¨æ„ï¼šsaveAutoSettingsFormToCharacter() å­˜çš„æ˜¯ <option> çš„
       valueï¼ˆæŠ€èƒ½idï¼‰ï¼Œä¸æ˜¯é¡¯ç¤ºæ–‡å­—ï¼Œæ‰€ä»¥ä¸Šé¢åœ¨æ–‡å­—å¾Œé¢åŠ è¨»è¨˜
       å®Œå…¨ä¸æœƒå½±éŸ¿å­˜æª”å…§å®¹ï¼Œä¹Ÿä¸æœƒè®“ stillValid åˆ¤æ–·å¤±æ•ˆã€‚
    */

    /* --- 2c. é¸ç›®æ¨™éšæ®µï¼šæç¤ºåˆ—è£œä¸Šã€Œé€™æ‹›æ‰“èª°ã€æ‰“å¹¾å€‹ã€ --- */
    /*
       ç¬¦å’’ä¹Ÿè¦æœ‰ä½œç”¨å°è±¡æç¤ºâ€”â€”å®ƒå€‘ä¸åœ¨ skillDatabase è£¡ï¼ˆæ˜¯ js/27
       è‡ªå·±çš„ talismanDefinitionsï¼‰ï¼Œæ‰€ä»¥è¦å¦å¤–æŸ¥ä¸€æ¬¡ã€‚å†°å°ç¬¦æ‰“æ•µæ–¹
       å–®é«”ã€éš±èº«ç¬¦/çµç•Œç¬¦çµ¦æˆ‘æ–¹å–®é«”ï¼Œè·Ÿ js/27 çš„
       getTalismanTargetKind() åˆ†æµä¸€è‡´ã€‚
    */
    function getTalismanScopeLabel(actionType){
        if(typeof window.v132GetTalismanDefinition!=="function"){ return ""; }
        const definition=window.v132GetTalismanDefinition(actionType);
        if(!definition){ return ""; }
        return definition.talismanEffect==="freeze" ? "æ•µæ–¹ä¸€äºº" : "æˆ‘æ–¹ä¸€äºº";
    }

    function appendScopeToTargetPrompt(actionType){
        const promptAction=document.getElementById("battleTargetPromptAction");
        if(!promptAction){ return; }

        const label=
            getSkillTargetScopeLabel(skillDatabase[actionType]) ||
            getTalismanScopeLabel(actionType);
        if(!label){ return; }

        if(promptAction.textContent.indexOf(label)!==-1){ return; }
        promptAction.textContent=promptAction.textContent+"ã€€â†’ã€€"+label;
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
       3. è­·ç›¾åœ¨æ»¿è¡€æ™‚çœ‹ä¸è¦‹
       ===================================================== */

    /*
       â˜… æ ¹å› ï¼šupdateSingleCharacterBars()ï¼ˆjs/00-main.js:22793ï¼‰æŠŠ
       è¡€æ¢å¯¬åº¦ç®—æˆ hp/maxHPï¼Œè­·ç›¾å‰‡æ˜¯
         left  = hpPercent
         width = shieldRemaining/maxHP
       å…©è€…å…±ç”¨åŒä¸€å€‹ maxHP åŸºæº–ã€è€Œä¸”è­·ç›¾æ˜¯ã€Œæ¥åœ¨è¡€æ¢å³é‚Šã€ç•«çš„ã€‚
       æ»¿è¡€æ™‚ hpPercent æ­£å¥½æ˜¯ 100ï¼Œè­·ç›¾çš„èµ·é»å°±è¢«æ¨åˆ°è¡€æ¢æœ€å³ç·£ä¹‹å¤–ï¼Œ
       åˆå› ç‚º .hp-bar æ˜¯ overflow:hiddenï¼Œæ•´æ®µç™½è‰²è­·ç›¾ç›´æ¥è¢«è£æ‰â€”â€”
       é€™å°±æ˜¯ä½¿ç”¨è€…èªªçš„ã€Œæ»¿è¡€æœ‰è­·ç›¾æ™‚å®Œå…¨çœ‹ä¸å‡ºä¾†ã€ã€‚

       ä¾ä½¿ç”¨è€…æŒ‡å®šçš„åšæ³•ä¿®ï¼šæŠŠè¡€æ¢å’Œè­·ç›¾æ”¾é€²åŒä¸€å€‹ã€Œç¸½é•·åº¦ã€è£¡æŒ‰
       æ¯”ä¾‹åˆ†é…ï¼ˆç¸½é•· = maxHP + è­·ç›¾é‡ï¼‰ï¼Œæ»¿è¡€æ™‚è¡€æ¢æœƒå¾€å·¦ç¸®ä¸€é»ï¼Œ
       ç©ºå‡ºä¾†çš„ä½ç½®æ­£å¥½å¡å¾—ä¸‹ç­‰å€¼çš„è­·ç›¾ï¼Œå…©æ®µåŠ èµ·ä¾†å‰›å¥½å¡«æ»¿æ•´æ¢ã€‚
       æ²’æœ‰è­·ç›¾æ™‚åˆ†æ¯å°±æ˜¯ maxHPï¼Œè¡Œç‚ºè·ŸåŸæœ¬å®Œå…¨ä¸€æ¨£ï¼Œä¸å½±éŸ¿ä¸€èˆ¬æƒ…æ³ã€‚
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

                /* æ²’æœ‰è­·ç›¾å°±ç¶­æŒåŸæœ¬çš„ç®—æ³•ï¼Œå®Œå…¨ä¸å‹•ã€‚ */
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
                console.error("V135 è­·ç›¾è¡€æ¢é¡¯ç¤ºå¤±æ•—ï¼š",error);
            }

            return result;
        };
    }

})();


/* bundled source: js/31-v136-auto-battle-fix.js */
/*
   V136 â€” è‡ªå‹•æˆ°é¬¥æŠ€èƒ½è¨­å®šæŒä¹…åŒ–èˆ‡å¼·åˆ¶æ ¡æ­£

   é€™ä¸€ç‰ˆè™•ç†å…©å€‹æœƒè®“ç©å®¶çœ‹åˆ°ã€Œæ˜æ˜æœ‰ SP å»ä¸€ç›´æ™®é€šæ”»æ“Šã€çš„ä¾†æºï¼š
   1. è‡ªå‹•æŠ€èƒ½åªåœ¨æŒ‰ä¸‹å¥—ç”¨æ™‚æ‰å¯«å…¥ï¼›ä¸­é€”åˆ‡æ›ã€å»£å‘Šæµç¨‹å–æ¶ˆæˆ–èˆŠç‰ˆåŒæ­¥
      éƒ½å¯èƒ½è®“å¯¦éš›è¨­å®šä»åœåœ¨ normalã€‚
   2. èˆŠç‰ˆåŒæ­¥å‡½å¼æœƒåœ¨åˆ¤å®šé¸é …ç„¡æ•ˆæ™‚ç›´æ¥æŠŠè¨­å®šæ´—æˆ normalï¼Œæ²’æœ‰ç•™ä¸‹
      ç©å®¶æœ€å¾Œä¸€æ¬¡æ˜ç¢ºé¸éå“ªå€‹æŠ€èƒ½ï¼Œä¹Ÿæ²’æœ‰ä»»ä½•æç¤ºã€‚

   V136 æœƒåœ¨ç©å®¶é¸æ“‡è‡ªå‹•è¡Œå‹•çš„ç•¶ä¸‹ç«‹åˆ»å­˜æª”ï¼Œè¨˜ä½ã€Œæ™®é€šæ”»æ“Šï¼é˜²ç¦¦ï¼
   æŠ€èƒ½ã€çš„æ˜ç¢ºæ„åœ–ï¼›å¦‚æœèˆŠç‰ˆåŒæ­¥èª¤æŠŠä¸€å€‹ä»ç„¶æœ‰æ•ˆçš„æŠ€èƒ½æ´—æˆæ™®é€šæ”»æ“Šï¼Œ
   æœƒè‡ªå‹•æ¢å¾©ã€‚æˆ°é¬¥å®£å‘Šæ™‚å†ä»¥çœŸæ­£æ’å…¥ queuedPlayerActions çš„çµæœæ ¡æ­£ï¼Œ
   æ‰€æœ‰é€€å›æ™®é€šæ”»æ“Šçš„æƒ…æ³éƒ½æœƒç•™ä¸‹å¯è®€åŸå› ã€‚
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

    /* èˆŠå­˜æª”è‹¥æœ¬ä¾†å°±é¸äº†æŠ€èƒ½ï¼Œå…ˆè£œä¸Šæ„åœ–æ¬„ä½ï¼Œä¹‹å¾Œä¸æœƒå†è¢«åŒæ­¥æ´—æ‰ã€‚ */
    [0,1,2].forEach(migrateCurrentIntent);

    /*
       å…±ç”¨å„²å­˜å…¥å£ä¹Ÿè¨˜éŒ„æ„åœ–ã€‚å³ä½¿ä¹‹å¾Œ UI åˆå¢åŠ æ–°çš„ç¢ºèªæŒ‰éˆ•ï¼Œåªè¦ä»
       ç¶“é saveAutoSettingsFormToCharacter()ï¼Œå°±ä¸æœƒæ¼æ‰é€™å±¤ä¿è­·ã€‚
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
       è‡ªè¨‚ä¸‹æ‹‰é¸å–®æœƒæ‰‹å‹• dispatch changeï¼›å› æ­¤ç©å®¶é»åˆ°æŠ€èƒ½çš„ç•¶ä¸‹å°±ç«‹åˆ»
       å¯«å…¥è¨­å®šèˆ‡ localStorageï¼Œä¸å¿…ç­‰æœ€å¾Œä¸€é¡†æŒ‰éˆ•æ‰ç¬¬ä¸€æ¬¡ä¿å­˜ã€‚
    */
    const actionSelect=document.getElementById("autoSettingsActionSelect");
    if(actionSelect && actionSelect.dataset.v136ImmediateSave!=="1"){
        actionSelect.dataset.v136ImmediateSave="1";
        actionSelect.addEventListener("change",saveCurrentActionFromPanel);
    }

    /*
       capture éšæ®µå…ˆå­˜ä¸€æ¬¡ï¼Œé¿å…å…ƒç´ åŒ£æ™‚æ•¸ï¼å»£å‘Šæµç¨‹åœ¨å¤–å±¤ wrapper æå‰
       return æ™‚ï¼Œç•«é¢ä¸Šå·²é¸å¥½çš„æŠ€èƒ½å®Œå…¨æ²’æœ‰è½ç›¤ã€‚
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
       ä¿è­·å…©å€‹èˆŠç‰ˆé¸å–®åŒæ­¥å‡½å¼ï¼šåªæœ‰åœ¨ç©å®¶æœ€å¾Œæ˜ç¢ºé¸çš„æ˜¯æŠ€èƒ½ã€è€Œä¸”è©²
       æŠ€èƒ½ç¾åœ¨ä»å·²è£å‚™ä¸”å·²å­¸æœƒæ™‚æ‰æ¢å¾©ã€‚ç©å®¶æ˜ç¢ºé¸ã€Œæ™®é€šæ”»æ“Šã€æˆ–
       ã€Œé˜²ç¦¦ã€æ™‚çµ•ä¸æœƒè¢«æ“…è‡ªæ”¹æ‰ã€‚
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
        const name=(character && character.id)||("è§’è‰²"+(characterIndex+1));

        if(action==="normal"){
            return {
                kind:"normal",
                action,
                message:name+"ç›®å‰çš„è‡ªå‹•è¡Œå‹•è¨­å®šæ˜¯ã€Œæ™®é€šæ”»æ“Šã€ï¼›SPå……è¶³ä¸æœƒè‡ªå‹•æ”¹æ”¾æŠ€èƒ½ï¼Œè«‹åœ¨å…ƒç´ åŒ£é¸æ“‡è¦æ–½æ”¾çš„æŠ€èƒ½ã€‚"
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
                message:"æ‰¾ä¸åˆ°ã€Œ"+action+"ã€çš„æŠ€èƒ½è³‡æ–™ï¼Œå·²æ”¹ç”¨æ™®é€šæ”»æ“Šã€‚"
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
                message:name+"æ²’æœ‰è£å‚™ã€Œ"+skill.name+"ã€ï¼Œå·²æ”¹ç”¨æ™®é€šæ”»æ“Šã€‚"
            };
        }

        const level=getSkillLevel(skillKey,action);
        if(level<=0){
            return {
                kind:"fallback",
                action,
                message:name+"å°šæœªå­¸æœƒã€Œ"+skill.name+"ã€ï¼Œå·²æ”¹ç”¨æ™®é€šæ”»æ“Šã€‚"
            };
        }

        if(isUnsupportedAutoCategory(skill)){
            return {
                kind:"fallback",
                action,
                message:"ã€Œ"+skill.name+"ã€ä¸æ˜¯è‡ªå‹•æˆ°é¬¥å¯æ–½æ”¾çš„æ”»æ“ŠæŠ€èƒ½ï¼Œå·²æ”¹ç”¨æ™®é€šæ”»æ“Šã€‚"
            };
        }

        const spCost=getSkillCost(skill);
        const currentSP=character ? Number(character.sp)||0 : 0;
        if(currentSP<spCost){
            return {
                kind:"fallback",
                action,
                message:name+"çš„SPä¸è¶³ï¼ˆ"+Math.floor(currentSP)+"/"+spCost+
                    "ï¼‰ï¼Œç„¡æ³•æ–½æ”¾ã€Œ"+skill.name+"ã€ï¼Œå·²æ”¹ç”¨æ™®é€šæ”»æ“Šã€‚"
            };
        }

        return {kind:"skill",action,skill,spCost};
    }

    function addNoticeOnce(characterIndex,key,message){
        if(lastNoticeByCharacter[characterIndex]===key){ return; }
        lastNoticeByCharacter[characterIndex]=key;
        addBattleLog("âš ï¸ "+message);
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
       æœ€å¾Œä¸€é“ä¿è­·ï¼šåŸå¼•æ“è·‘å®Œå¾Œç›´æ¥æª¢æŸ¥å¯¦éš› queued actionã€‚å¦‚æœæ‰€æœ‰
       åˆæ³•æ¢ä»¶éƒ½é€šéã€å»ä»è¢«æ’æˆ normalï¼Œå°±æŠŠè©²ç­†ä½‡åˆ—æ ¡æ­£å›ç©å®¶é¸çš„
       æŠ€èƒ½ã€‚é€™ä¸€å±¤åªè™•ç†ã€Œå·²è£å‚™ã€å·²å­¸æœƒã€é¡å‹æ­£ç¢ºã€SPè¶³å¤ ã€çš„æŠ€èƒ½ï¼Œ
       ä¸æœƒç¹éä»»ä½•åˆæ³•é™åˆ¶ã€‚
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
                            "åµæ¸¬åˆ°ã€Œ"+decision.skill.name+"ã€è¢«éŒ¯èª¤æ’æˆæ™®é€šæ”»æ“Šï¼Œå·²è‡ªå‹•æ ¡æ­£ä¸¦æ–½æ”¾æŠ€èƒ½ã€‚"
                        );
                    }
                    else if(queued && queued.action===decision.action){
                        lastNoticeByCharacter[characterIndex]=null;
                    }
                }
                else if(decision.kind==="fallback" && queued){
                    /* èˆŠå¼•æ“æ²’æœ‰æª¢æŸ¥ã€ŒæŠ€èƒ½ä»åœ¨è£å‚™æ¬„ã€ï¼›è¨­å®šæ®˜ç•™æ™‚ç”šè‡³å¯èƒ½
                       åéä¾†æ–½æ”¾æœªè£å‚™æŠ€èƒ½ã€‚V136 åœ¨åŒä¸€å€‹æ±ºç­–é»ä¸€èµ·æ”¶å£ã€‚ */
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
                   #2 â†’ #3 â†’ #4 â†’ #5 only after the earlier position dies. */
                enforceAutoTargetPriority(queued);
            }
            catch(error){
                console.error("V136 è‡ªå‹•æˆ°é¬¥æ ¡æ­£å¤±æ•—ï¼š",error);
            }

            return result;
        };
    }

    /* æä¾›çµ¦ç€è¦½å™¨æ¸¬è©¦ï¼ä¹‹å¾Œé™¤éŒ¯ï¼Œç›´æ¥è®€åˆ°å¼•æ“åŒä¸€ä»½åˆ¤æ–·çµæœã€‚ */
    window.v136GetAutoBattleDecision=getAutoDecision;
    window.v136GetPriorityAutoTarget=getPriorityAutoTarget;
})();


/* bundled source: js/32-v139-rested-experience.js */
/*
   V139 â€” ä¼‘æ¯ç¶“é©—

   - é›¢ç·šï¼åˆ‡åˆ°èƒŒæ™¯æ¯2åˆ†é˜ç´¯ç©1å ´ï¼Œæœ€å¤š300å ´ã€‚
   - ä¸€èˆ¬ç·´åŠŸå‹åˆ©æ¶ˆè€—1å ´ï¼Œè©²å ´EXPè®Šæˆ2å€ã€‚
   - å…ƒç´ åŒ£å•Ÿç”¨æœŸé–“ä¸ç´¯ç©ï¼›å…ƒç´ åŒ£èˆ‡å‰¯æœ¬ä¹Ÿä¸ä½¿ç”¨ã€ä¸æ¶ˆè€—ã€‚
   - ç‹€æ…‹å­˜æ–¼ç¨ç«‹localStorage keyï¼Œä¸æ”¹æ—¢æœ‰ä¸»å­˜æª”çµæ§‹ã€‚
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
          µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥â’À¢Æ7E6VVäC¤çVÖ&W"æ—4f–æ—FR„çVÖ&W"‡6÷W&6RæÆ7E6VVäB’¢òÖF‚æÖ–â†æ÷rÄçVÖ&W"‡6÷W&6RæÆ7E6VVäB’¢¢æ÷rÀ¢&Æö6¶VD'”VÆVÖVçD&÷ƒ§6÷W&6Ræ&Æö6¶VD'”VÆVÖVçD&÷ƒÓÓ×G'VP¢Ó°¢Ğ ¢gVæ7F–öâ&VE&W7FVE7FFR†æ÷r—°¢–b‚†47&VFVD6†&7FW"‚’—°¢G'—²Æö6Å7F÷&vRç&VÖ÷fT—FVÒ…$U5DTEôU…õ5Dõ$tUô´U’“²Ö6F6‚…ò—²Ğ¢&WGW&âV×G•&W7FVE7FFR†æ÷r“°¢Ğ¢G'—°¢6öç7B&sÔ¥4ôâç'6R†Æö6Å7F÷&vRævWD—FVÒ…$U5DTEôU…õ5Dõ$tUô´U’—ÇÂ&çVÆÂ"“°¢&WGW&â6æ—F—¦U&W7FVE7FFR‡&rÆæ÷r“°¢Ö6F6‚…ò—°¢&WGW&âV×G•&W7FVE7FFR†æ÷r“°¢Ğ¢Ğ ¢ÆWB&W7FVE7FFS×&VE&W7FVE7FFR„FFRææ÷r‚’“° ¢gVæ7F–öâW'6—7E&W7FVE7FFR‚—°¢–b‚†47&VFVD6†&7FW"‚’—°¢G'—²Æö6Å7F÷&vRç&VÖ÷fT—FVÒ…$U5DTEôU…õ5Dõ$tUô´U’“²Ö6F6‚…ò—²Ğ¢&WGW&ã°¢Ğ¢G'—°¢Æö6Å7F÷&vRç6WD—FVÒ€¢$U5DTEôU…õ5Dõ$tUô´U’À¢¥4ôâç7G&–æv–g’‡°¢&GFÆW3§&W7FVE7FFRæ&GFÆW2À¢&öw&W74×3§&W7FVE7FFRç&öw&W74×2À¢Æ7E6VVäC§&W7FVE7FFRæÆ7E6VVäBÀ¢&Æö6¶VD'”VÆVÖVçD&÷ƒ§&W7FVE7FFRæ&Æö6¶VD'”VÆVÖVçD&÷€¢Ò¢“°¢Ö6F6‚…ò—²Ğ¢Ğ ¢gVæ7F–öâ67'VU&W7FVDÖ–ÆÆ—6V6öæG2†VÆ6VD×2—°¢6öç7B6fTVÆ6VCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†VÆ6VD×2—ÇÃ’“°¢–b‡6fTVÆ6VCÃÓÇÂ&W7FVE7FFRæ&GFÆW3ãÕ$U5DTEôU…ôÔ…ô$EDÄU2—°¢–b‡&W7FVE7FFRæ&GFÆW3ãÕ$U5DTEôU…ôÔ…ô$EDÄU2—°¢&W7FVE7FFRç&öw&W74×3Ó°¢Ğ¢&WGW&â°¢Ğ ¢ò¢‹h^˜î{Jşz˜ŞKˆ®™™h˜™Èy¨Ni˜.™i>k).iÈ[zîXŠ^ûÈÎXX[š.˜şXXŞy[[‹i˜.™	€¢yJ.yIşKˆŞ[ø^Šhy¨NZJ~i[ZÙ~8"¢ğ¢6öç7B6VDVÆ6VCÔÖF‚æÖ–â€¢6fTVÆ6VBÀ¢$U5DTEôU…ôÔ…ô$EDÄU2¥$U5DTEôU…ôÕ5õU%ô$EDÄP¢“°¢6öç7BF÷FÄ×3×&W7FVE7FFRç&öw&W74×2¶6VDVÆ6VC°¢6öç7BV&æVCÔÖF‚æfÆö÷"‡F÷FÄ×2õ$U5DTEôU…ôÕ5õU%ô$EDÄR“°¢6öç7B66WFVCÔÖF‚æÖ–â€¢V&æVBÀ¢$U5DTEôU…ôÔ…ô$EDÄU2×&W7FVE7FFRæ&GFÆW0¢“° ¢&W7FVE7FFRæ&GFÆW2³Ö66WFVC°¢&W7FVE7FFRç&öw&W74×3×&W7FVE7FFRæ&GFÆW3ãÕ$U5DTEôU…ôÔ…ô$EDÄU0¢ò ¢¢F÷FÄ×2ÖV&æVB¥$U5DTEôU…ôÕ5õU%ô$EDÄS°¢&WGW&â66WFVC°¢Ğ ¢gVæ7F–öâvWDæW‡E&W7FVD&GFÆUFW‡B‚—°¢–b‡&W7FVE7FFRæ&GFÆW3ãÕ$U5DTEôU…ôÔ…ô$EDÄU2—°¢&WGW&â.[{.˜N{Jşz˜ŞKˆ®™™#°¢Ğ¢6öç7B&VÖ–æ–æt×3ÔÖF‚æÖ‚€¢À¢$U5DTEôU…ôÕ5õU%ô$EDÄR×&W7FVE7FFRç&öw&W74×0¢“°¢&WGW&â.‹yŞ™º.Kˆ¾KˆZN{HB"´ÖF‚æ6V–Â‡&VÖ–æ–æt×2óc’²"Xˆn™	‚#°¢Ğ ¢gVæ7F–öâWFFU&W7FVDW‡W&–Væ6TF—7Æ’‚—°¢6öç7B6÷VçCÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'c3•&W7FVDW‡6÷VçB"“°¢6öç7BæW‡CÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'c3•&W7FVDW‡æW‡B"“°¢–b†6÷VçB—²6÷VçBçFW‡D6öçFVçCÕ7G&–ær‡&W7FVE7FFRæ&GFÆW2“²Ğ¢–b†æW‡B—²æW‡BçFW‡D6öçFVçCÖvWDæW‡E&W7FVD&GFÆUFW‡B‚“²Ğ¢Ğ ¢gVæ7F–öâ&VæFW%&W7FVDW‡W&–Væ6UæVÂ‚—°¢&WGW&â€¢sÇ6V7F–öâ6Æ73Ò'c3’×&W7FVBÖW‡×æVÂ"&–ÖÆ&VÃÒ.KÉhş{i>š™r#âr°¢sÆF—b6Æ73Ò'c3’×&W7FVBÖW‡Ö†VF–ær#îKÉhş{i>š™sÂöF—câr°¢sÆF—b6Æ73Ò'c3’×&W7FVBÖW‡Ö6÷VçB#âr°¢sÇ7G&öær–CÒ'c3•&W7FVDW‡6÷VçB#âr·&W7FVE7FFRæ&GFÆW2²sÂ÷7G&öæsâr°¢sÇ7ãîûÈòrµ$U5DTEôU…ôÔ…ô$EDÄU2²rZCÂ÷7ãâr°¢sÂöF—câr°¢sÇîKˆˆŠÎ{{NX©şX¹ŞXŠ’U…9s.ûÉ¾XX>{JXÊ>YYşyJiÉş™i>KˆŞ{Jşz˜ŞûÈÎXX>{JXÊ>ˆˆ~XšşiÊÎK™şKˆŞiÈ>KÛşyJh‰nkhˆ	~8#Â÷âr°¢sÆF—b6Æ73Ò'c3’×&W7FVBÖW‡ÖÖWF#âr°¢~jøş™º.{y¢rµ$U5DTEôU…ôÔ”åUDU5õU%ô$EDÄR²rXˆn™	{Jşz˜ÒZN8;²r°¢sÇ7â–CÒ'c3•&W7FVDW‡æW‡B#âr¶vWDæW‡E&W7FVD&GFÆUFW‡B‚’²sÂ÷7ãâr°¢sÂöF—câr°¢sÂ÷6V7F–öãâp¢“°¢Ğ ¢–b‡G—Vöb&VæFW$öffÆ–æTW‡6öçFVçCÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ&VæFW$öffÆ–æTW‡6öçFVçC×&VæFW$öffÆ–æTW‡6öçFVçC°¢&VæFW$öffÆ–æTW‡6öçFVçCÖgVæ7F–öâ‚—°¢&WGW&â÷&–v–æÅ&VæFW$öffÆ–æTW‡6öçFVçBæÇ’‡F†—2Æ&wVÖVçG2’°¢&VæFW%&W7FVDW‡W&–Væ6UæVÂ‚“°¢Ó°¢Ğ ¢gVæ7F–öâ—4VÆVÖVçD&÷„7F—fR‚—°¢–b‡G—Vöbv–æF÷rçc3vWDVÆVÖVçD&÷…7FFRÓÒ&gVæ7F–öâ"—²&WGW&âfÇ6S²Ğ¢G'—°¢6öç7B7FFS×v–æF÷rçc3vWDVÆVÖVçD&÷…7FFR‚“°¢&WGW&â‡7FFRbb7FFRæ7F—fR“°¢Ö6F6‚…ò—°¢&WGW&âfÇ6S°¢Ğ¢Ğ ¢gVæ7F–öâ7–æ467'VÅFôæ÷r‚—°¢6öç7Bæ÷sÔFFRææ÷r‚“°¢–b‚&W7FVE7FFRæ&Æö6¶VD'”VÆVÖVçD&÷‚bb—4VÆVÖVçD&÷„7F—fR‚’—°¢67'VU&W7FVDÖ–ÆÆ—6V6öæG2†æ÷r×&W7FVE7FFRæÆ7E6VVäB“°¢Ğ¢&W7FVE7FFRæÆ7E6VVäCÖæ÷s°¢&W7FVE7FFRæ&Æö6¶VD'”VÆVÖVçD&÷ƒÖ—4VÆVÖVçD&÷„7F—fR‚“°¢W'6—7E&W7FVE7FFR‚“°¢WFFU&W7FVDW‡W&–Væ6TF—7Æ’‚“°¢Ğ ¢ò¢zÊÎKˆjÊ‹ÈXZ^i˜.ûÈÎh¨®Kˆ®jÊ[ø>‹{>X‹xûîYÊy¨Ni˜.™i>Šinx+®™º.{y®i˜.™i>8 ¢ik{;¾{[zÊÎKˆjÊX{®xûîi˜.k).iÈˆˆ®x¸hX¾ûÈÎKˆŞiÈ>X	.hêy›Î˜KˆŞZÙYÊy¨NZNi[8"¢ğ¢–b††47&VFVD6†&7FW"‚’—°¢7–æ467'VÅFôæ÷r‚“°¢Ğ ¢v–æF÷rçc3•&W7FVDW‡6öæf–sÔö&¦V7Bæg&VW¦R‡°¢Ö„&GFÆW3¥$U5DTEôU…ôÔ…ô$EDÄU2À¢Ö–çWFW5W$&GFÆS¥$U5DTEôU…ôÔ”åUDU5õU%ô$EDÄRÀ¢×VÇF—Æ–W#£ ¢Ò“° ¢v–æF÷rçc3”vWE&W7FVDW‡7FFSÖgVæ7F–öâ‚—°¢&WGW&â°¢&GFÆW3§&W7FVE7FFRæ&GFÆW2À¢&öw&W74×3§&W7FVE7FFRç&öw&W74×2À¢Ö„&GFÆW3¥$U5DTEôU…ôÔ…ô$EDÄU2À¢Ö–çWFW5W$&GFÆS¥$U5DTEôU…ôÔ”åUDU5õU%ô$EDÄRÀ¢&Æö6¶VD'”VÆVÖVçD&÷ƒ§&W7FVE7FFRæ&Æö6¶VD'”VÆVÖVçD&÷€¢Ó°¢Ó° ¢v–æF÷rçc3”67'VU&W7FVDÖ–çWFW3ÖgVæ7F–öâ†Ö–çWFW2—°¢6öç7BV&æVCÖ67'VU&W7FVDÖ–ÆÆ—6V6öæG2€¢ÖF‚æÖ‚ƒÄçVÖ&W"†Ö–çWFW2—ÇÃ’£c£ ¢“°¢&W7FVE7FFRæÆ7E6VVäCÔFFRææ÷r‚“°¢W'6—7E&W7FVE7FFR‚“°¢WFFU&W7FVDW‡W&–Væ6TF—7Æ’‚“°¢&WGW&âV&æVC°¢Ó° ¢v–æF÷rçc3•G'”6öç7VÖU&W7FVD&GFÆSÖgVæ7F–öâ‚—°¢–b‡&W7FVE7FFRæ&GFÆW3ÃÓ—°¢&WGW&â¶Æ–VC¦fÇ6RÇ&VÖ–æ–æt&GFÆW3£Ó°¢Ğ¢&W7FVE7FFRæ&GFÆW2ÒÓ°¢&W7FVE7FFRæÆ7E6VVäCÔFFRææ÷r‚“°¢W'6—7E&W7FVE7FFR‚“°¢WFFU&W7FVDW‡W&–Væ6TF—7Æ’‚“°¢&WGW&â°¢Æ–VC§G'VRÀ¢&VÖ–æ–æt&GFÆW3§&W7FVE7FFRæ&GFÆW0¢Ó°¢Ó° ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"ÆgVæ7F–öâ‚—°¢–b†Fö7VÖVçBæ†–FFVâ—°¢&W7FVE7FFRæÆ7E6VVäCÔFFRææ÷r‚“°¢&W7FVE7FFRæ&Æö6¶VD'”VÆVÖVçD&÷ƒÖ—4VÆVÖVçD&÷„7F—fR‚“°¢W'6—7E&W7FVE7FFR‚“°¢&WGW&ã°¢Ğ¢7–æ467'VÅFôæ÷r‚“°¢Ò“° ¢gVæ7F–öâÖ&µf—6–&ÆT†V'F&VB‚—°¢–b†Fö7VÖVçBæ†–FFVâ—²&WGW&ã²Ğ¢&W7FVE7FFRæÆ7E6VVäCÔFFRææ÷r‚“°¢&W7FVE7FFRæ&Æö6¶VD'”VÆVÖVçD&÷ƒÖ—4VÆVÖVçD&÷„7F—fR‚“°¢W'6—7E&W7FVE7FFR‚“°¢Ğ ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'vV†–FR"ÆgVæ7F–öâ‚—°¢–b‚Fö7VÖVçBæ†–FFVâ—²Ö&µf—6–&ÆT†V'F&VB‚“²Ğ¢Ò“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&&Vf÷&WVæÆöB"ÆÖ&µf—6–&ÆT†V'F&VB“°¢6WD–çFW'fÂ†Ö&µf—6–&ÆT†V'F&VBÅ$U5DTEôU…ô„T%D$TEôÕ2“° §Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó32×cCÖf÷W"ÖVÆVÖVçBÖ&Ææ6Ræ§2¢ğ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢cC(	BY¹¾XX>{Jh¨ˆ;Ş[›>ŠZé®j€ ¢KºR##bÓ‚Ó#rxêZënhùKé¾y¨NZèÎi[NY¹¾XX>{Jh¨ˆ;ŞŠx+®k©nûÉ ¢âj
jÚ>Y¹¾XX>{Jh¨ˆ;Şi[XÎˆˆ~Šª®iˆà¢"âxšynûÈşk9^Š>h¨ˆ;Şy¨Ny[[‹YŞKŠŞ[Îh
~Kènk© ¢2âkN{;¾Kˆ>h¹¾YŠXú®Y¹î[ê’… ¢Bâh	.x¾y¨Nxˆni8®xè~ˆˆ~xˆni8®X+~Zë>Xˆn™h¾Šˆzép¢Râk+¾y˜.Š>Xú®iÈ>x+®X[nK¹nXø¾ikyºîj‰Y¹î[ê’5ûÈÎKˆŞŠ9ÎikŞiKîˆ^iÊÎK«¢5 ¢bâh¨ˆ;Ş8Î{YyXÎ8ŞXú®i8²RjÊy»Nhê^X+~Zë>8iÈZI¢RY¹îYûÈÄDõBz›ş˜ğ¢râiÈ{X.YŞKŠŞxè~Kˆ¾™™cR(i"SP ¢KˆŞ˜xŞjx¾X[nK¹nh‹šÊ^{;¾{[ûÈÎKˆŞiKxêZënˆ;ŞX©¾8ZÙj©N{Yjx¾ûÈÀ¢zÊnY).ˆˆ~[Şhxh¨ˆ;ŞX[yJYÎKˆZY~iXiéÎŠhşX˜~8 £ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢†gVæ7F–öâÇ•cCf÷W$VÆVÖVçD&Ææ6R‚—°¢'W6R7G&–7B#° ¢6öç7BÄ”dU5DTÅô%•õ4´”ÄÃ×°¢vFW$¶æ–fS¥³BÃRÃbÃrÃ…ÒÀ¢g&÷7EVæ6ƒ¥³BÃRÃbÃrÃ…ÒÀ¢–6U7–ã¥³2ÃBÃRÃbÃuÒÀ¢g&÷7D7'W6ƒ¥³BÃRÃbÃrÃ…ÒÀ¢vFW$&ÆÃ¥³2ÃBÃRÃbÃuÒÀ¢fÆööD&V7C¥³BÃRÃbÃrÃ…ÒÀ¢–6T'&÷u&–ã¥³Ã"Ã2ÃBÃUĞ¢Ó° ¢gVæ7F–öâçVÖW&–2‡fÇVR—°¢6öç7B&W7VÇCÔçVÖ&W"‡fÇVR“°¢&WGW&âçVÖ&W"æ—4f–æ—FR‡&W7VÇB“÷&W7VÇC£°¢Ğ ¢gVæ7F–öâ6Æ×‡fÇVRÆÖ–âÆÖ‚—°¢&WGW&âÖF‚æÖ‚†Ö–âÄÖF‚æÖ–â†Ö‚ÇfÇVR’“°¢Ğ ¢gVæ7F–öâ6WDFÖvU6¶–ÆÂ‡6¶–ÆÄ–BÆ&6TFÖvRÆFÖvUW$ÆWfVÂÆFW67&—F–öâ—°¢ò¢&WF—&VBFFw&—FW"âcs2ãcB÷vç2Æ–W"6¶–ÆÂfÇVW2â¢ğ¢fö–B6¶–ÆÄ–C²fö–B&6TFÖvS²fö–BFÖvUW$ÆWfVÃ²fö–BFW67&—F–öã°¢Ğ ¢gVæ7F–öâ6WDÆ–fW7FVÅ6¶–ÆÂ‡6¶–ÆÄ–BÇfÇVW2ÆFW67&—F–öâ—°¢ò¢&WF—&VBFFw&—FW"â'VçF–ÖRÆ–fW7FVÂ&VG2F†Rf÷&ÖÂ7V2â¢ğ¢fö–B6¶–ÆÄ–C²fö–BfÇVW3²fö–BFW67&—F–öã°¢Ğ ¢gVæ7F–öâ6WE6¶–ÆÄf–VÆG2‡6¶–ÆÄ–BÆf–VÆG2—°¢ò¢&WF—&VBFFw&—FW"â¶VW6ÆÂ6—FW22Ö–w&F–öâFö7VÖVçFF–öââ¢ğ¢fö–B6¶–ÆÄ–C²fö–Bf–VÆG3°¢Ğ ¢6WDFÖvU6¶–ÆÂ€¢&f—&U&ö6¶WB"À¢rÀ¢‚À¢.[ŞYÎKˆjš¾hé.[zn8KŠŞ8Xû>iÈZI£>YŞyºîj‰YN˜
h‰~›¹îYû®zHîk9^Š>X+~Zë>ûÈÎiÈš¹ƒ^{I®ûÈÎjøşXØs{I®X+~Zë2³8" ¢“° ¢6WE6¶–ÆÄf–VÆG2‚&fÆÖUF÷&æFò"Ç°¢'W&åW&6VçD'”ÆWfVÃ¥³2ÃBÃRÃbÃ…ÒÀ¢FW67&—F–öã¢.[ŞK»¾Kˆjš¾hé.yºîj‰YN˜
h‰C›¹îYû®zHîk9^Š>X+~Zë>ûÉ³3^Yû®zHîj™şxè~xx>xy#.Y¹îYûÈÎjøşY¹îY˜
h‰yºîj‰iÈZJt…y¨C2RóBRóRRóbRó‚^X+~Zë>8" ¢Ò“° ¢6WE6¶–ÆÄf–VÆG2‚'†öVæ—„7'’"Ç°¢'W&åW&6VçD'”ÆWfVÃ¥³RÃrÃ’ÃÃ5ÒÀ¢FW67&—F–öã¢.[Şi[^ikXZš¹NYN˜
h‰S>›¹îYû®zHîk9^Š>X+~Zë>ûÉ³S^Yû®zHîj™şxè~xx>xy#.Y¹îYûÈÎjøşY¹îY˜
h‰yºîj‰iÈZJt…y¨CRRórRó’RóRó2^X+~Zë>8" ¢Ò“° ¢6WE6¶–ÆÄf–VÆG2‚'&vR"Ç°¢ò¢ˆˆ®[É^i8îK¸ŞŠè7&—D&öçW4'”ÆWfVÎûÈÎŠé>Zè>Kº>Šxˆni8®xè~Kº^KùŞyYy»Zë8"¢ğ¢7&—D&öçW4'”ÆWfVÃ¥³RÃÃRÃ#Ã#UÒÀ¢7&—D6†æ6T&öçW4'”ÆWfVÃ¥³RÃÃRÃ#Ã#UÒÀ¢7&—DFÖvT&öçW4'”ÆWfVÃ¥³Ã#Ã3ÃCÃSÒÀ¢FW67&—F–öã¢.hùš¹h‰ikiÈZI£>YŞZÙkK¾Šy.ˆ›.y¨Nxˆni8®xèsRRóRóRRó#Ró#R^ˆˆ~xˆni8®X+~Zë3Ró#Ró3RóCRóS^ûÈÎhÈ{¨Ã.Y¹îY8" ¢Ò“° ¢6WE6¶–ÆÄf–VÆG2‚'7F÷&Ôf—7B"Ç°¢v–Æ—G”F÷vä'”ÆWfVÃ¥³3ÃCÃSÃcÃsÒÀ¢FW67&—F–öã¢.[ŞYjîš¹N˜
h‰N›¹îYû®zHîX+~Zë>ûÉ³S^Yû®zHîj™şxè~™˜ŞKØîiXşhÛsY¹îYûÈÎ™˜ŞKØã3RóCRóSRócRós^8" ¢Ò“° ¢6WE6¶–ÆÄf–VÆG2‚&†VÅ7VÆÂ"Ç°¢FW67&—F–öã¢.i8~KˆXø¾ikyºîj‰ûÈÎh.[ê”…ˆˆu58$…Yû®zHãC85Yû®zHã^ûÈÎXZˆ^jøşXØs{I®Yû®zHîh.[ê˜xò³^ûÉ¾KùŞyYiz.iÈi›®X©¾ˆˆ~kNXX>{JUY¹î[êXªh‰ûÈÎikŞiKîˆ^iÊÎK«®KˆŞY¹î[ê•58" ¢Ò“° ¢6WE6¶–ÆÄf–VÆG2‚&&'&–W""Ç°¢76÷7C£CÀ¢GW&F–öã£RÀ¢&'&–W$&Æö6´6÷VçC£RÀ¢FW67&—F–öã¢.KÛşh‰ikYjîKˆyºîj‰xÛ.[é~{YyXÎûÈÎZèÎXZh«^i8¾hê^Kˆ¾Kèc^jÊy»Nhê^X+~Zë>ûÈÎiÈZI®ZÙYÊƒ^Y¹îYûÉ¾xx>xy.8jù.zØhÈ{¨ÎX+~Zë>KˆŞiÈ>Š*¾h«^i8¾ûÈÎK™şKˆŞkhˆ	~jÊi[8" ¢Ò“° ¢6WDFÖvU6¶–ÆÂ€¢&g&÷7EVæ6‚"À¢3À¢‚À¢.[ŞYjîš¹N˜
h‰3›¹îYû®zHîX+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨CBRóRRóbRórRó‚^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“° ¢6WDFÖvU6¶–ÆÂ€¢'7FöæT'&Vµ6·’"À¢cRÀ¢’À¢.[ŞYjîš¹N˜
h‰c^›¹îYû®zHîX+~Zë>ûÉ¾x+®h‰ikXZš¹NZ)îXªó#RóSósRó#›¹îŠÛ~y»îûÈÎhÈ{¨Ã.Y¹îY8" ¢“° ¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢'vFW$¶æ–fR"À¢Ä”dU5DTÅô%•õ4´”ÄÂçvFW$¶æ–fRÀ¢.[ŞYjîš¹N˜
h‰>›¹îYû®zHîX+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨CBRóRRóbRórRó‚^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“°¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢&g&÷7EVæ6‚"À¢Ä”dU5DTÅô%•õ4´”ÄÂæg&÷7EVæ6‚À¢.[ŞYjîš¹N˜
h‰3›¹îYû®zHîX+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨CBRóRRóbRórRó‚^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“°¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢&–6U7–â"À¢Ä”dU5DTÅô%•õ4´”ÄÂæ–6U7–âÀ¢.[ŞYÎKˆjš¾hé.[zn8KŠŞ8Xû>iÈZI£>YŞyºîj‰YN˜
h‰#^›¹îYû®zHîX+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨C2RóBRóRRóbRór^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“°¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢&g&÷7D7'W6‚"À¢Ä”dU5DTÅô%•õ4´”ÄÂæg&÷7D7'W6‚À¢.[ŞYjîš¹N˜
h‰›¹îYû®zHîX+~Zë>ûÉ³CR^j™şxè~Xk[Y¹îYûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨CBRóRRóbRórRó‚^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“°¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢'vFW$&ÆÂ"À¢Ä”dU5DTÅô%•õ4´”ÄÂçvFW$&ÆÂÀ¢.[ŞYÎKˆjš¾hé.[zn8KŠŞ8Xû>iÈZI£>YŞyºîj‰YN˜
h‰~›¹îYû®zHîk9^Š>X+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨C2RóBRóRRóbRór^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“°¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢&fÆööD&V7B"À¢Ä”dU5DTÅô%•õ4´”ÄÂæfÆööD&V7BÀ¢.[ŞYjîš¹N˜
h‰3^›¹îYû®zHîk9^Š>X+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨CBRóRRóbRórRó‚^ûÈÎXú®h.[êˆz®‹ª´…8" ¢“°¢6WDÆ–fW7FVÅ6¶–ÆÂ€¢&–6T'&÷u&–â"À¢Ä”dU5DTÅô%•õ4´”ÄÂæ–6T'&÷u&–âÀ¢.[Şi[^ikXZš¹NYN˜
h‰3›¹îYû®zHîk9^Š>X+~Zë>ûÉ¾YXùnZún™©¾˜
h‰X+~Zë>y¨CRó"Ró2RóBRóR^ûÈÎXú®h.[êˆz®‹ª´…ûÉ¾KŠniÈ“S^Yû®zHîj™şxè~KÛş™ªj™şYjîKˆyºîj‰Xk[.Y¹îY8" ¢“° ¢ò ¢YŞKŠŞûÈşy[[‹j™şxè~XZÎ[Èş[{.iKnih.Y¹â§2óÖÖ–âæ§2YJşKˆ÷væW.8 ¢cCXú®KùŞyYY¹¾XX>{J‹8~iiˆˆ~jÛ~Xû.y»ZëŠÎx+®ûÈÎKˆŞXhŞŠhnZú°¢6Æ7VÆFU7FGW4VffV7D6†æ6R‚’h‰b&öÆÄ†—D6†æ6R‚8 ¢¢ğ ¢ò ¢h	.x¾iKx+®XZ{XNxÚz¸¾i[XÎ8.ˆˆ®X{Ş[ÈşKˆjÊXú®Šè&öçW5W&6VçNûÈÀ¢YºjÚNXXKº^xˆni8®xè~Xªh‰Šé>ˆˆ®X{Ş[ÈşZèÎh‰i;.š«ûÈÎYŞKŠŞxˆni8®[èÀ¢XhŞXú®Š9ÎKˆ®xˆnX+~[zîšŞûÉ¾X[nK¹nˆz®xKnxˆni8®8x´Uˆˆ~h©~i«NXZÎ[ÈşKˆŞŠè®8 ¢¢ğ¢6öç7B&Wf–÷W5&öÆÄ7&—F–6Ã×&öÆÄ7&—F–6Ã°¢&öÆÄ7&—F–6ÃÖgVæ7F–öâ†6†&7FW"Æ6FVv÷'’ÇF&vWDçF”7&—EW&6VçB—°¢6öç7B&vT'VfcÒ†6†&7FW"bf6†&7FW"æ7F—fT'Vfg7ÇÅµÒ¢æf–æB†'VfcÓæ'Vfbbf'VfbçG—SÓÓÒ'&vR"“° ¢–b€¢&vT'VfgÇÀ¢&vT'Vfbæ7&—D6†æ6T&öçW5W&6VçCÓÓ×VæFVf–æVGÇÀ¢&vT'Vfbæ7&—DFÖvT&öçW5W&6VçCÓÓ×VæFVf–æV@¢—°¢&WGW&â&Wf–÷W5&öÆÄ7&—F–6ÂæÇ’‡F†—2Æ&wVÖVçG2“°¢Ğ ¢6öç7B&Wf–÷W4&öçW3×&vT'Vfbæ&öçW5W&6VçC°¢6öç7B6†æ6T&öçW3ÖçVÖW&–2‡&vT'Vfbæ7&—D6†æ6T&öçW5W&6VçB“°¢6öç7BFÖvT&öçW3ÖçVÖW&–2‡&vT'Vfbæ7&—DFÖvT&öçW5W&6VçB“°¢ÆWB&W7VÇC° ¢&vT'Vfbæ&öçW5W&6VçCÖ6†æ6T&öçW3°¢G'—°¢&W7VÇC×&Wf–÷W5&öÆÄ7&—F–6ÂæÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢&vT'Vfbæ&öçW5W&6VçC×&Wf–÷W4&öçW3°¢Ğ ¢–b‡&W7VÇBbg&W7VÇBæ—47&—B—°¢&WGW&âö&¦V7Bæ76–vâ‡·ÒÇ&W7VÇBÇ°¢×VÇF—Æ–W#¤ÖF‚æÖ–â€¢G—Vöb5$•EôÕTÅD•Ä”U%ôÔƒÓÓÒ&çVÖ&W"#ô5$•EôÕTÅD•Ä”U%ôÔƒ£"ã#RÀ¢&W7VÇBæ×VÇF—Æ–W"²†FÖvT&öçW2Ö6†æ6T&öçW2’ó ¢¢Ò“°¢Ğ¢&WGW&â&W7VÇC°¢Ó° ¢ò¢ˆ8ÎXÈ^Šy.ˆ›.Š›>h8^K™şŠhšşzK®YÎKˆ{XNZún™©¾h‹šÊ^i[XÎ8"¢ğ¢–b‡G—VöbvWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG3ÓÓÒ&gVæ7F–öâ"—°¢6öç7B&Wf–÷W4vWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG3Ğ¢vWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG3° ¢vWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG3ÖgVæ7F–öâ†–æFW‚—°¢6öç7B6†&7FW#×G—VöbvWD&6·6´6†&7FW#ÓÓÒ&gVæ7F–öâ ¢òvWD&6·6´6†&7FW"†–æFW‚¢¢çVÆÃ°¢6öç7B'Vfg3Ö6†&7FW"bd'&’æ—4'&’†6†&7FW"æ7F—fT'Vfg2¢ò6†&7FW"æ7F—fT'Vfg0¢¢çVÆÃ°¢6öç7B&vT'VfcÖ'Vfg2bf'Vfg2æf–æB†'VfcÓà¢'Vfbb`¢'VfbçG—SÓÓÒ'&vR"b`¢'Vfbæ7&—D6†æ6T&öçW5W&6VçBÓ×VæFVf–æVBb`¢'Vfbæ7&—DFÖvT&öçW5W&6VçBÓ×VæFVf–æV@¢“° ¢–b‚&vT'Vfb—°¢&WGW&â&Wf–÷W4vWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG2æÇ’‡F†—2Æ&wVÖVçG2“°¢Ğ ¢6†&7FW"æ7F—fT'Vfg3Ö'Vfg2æf–ÇFW"†'VfcÓæ'VfbÓ×&vT'Vfb“°¢ÆWB&W7VÇC°¢G'—°¢&W7VÇC×&Wf–÷W4vWD–çfVçF÷'”6†&7FW$7&—F–6Å7FG2æÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢6†&7FW"æ7F—fT'Vfg3Ö'Vfg3°¢Ğ ¢–b‚&W7VÇB—²&WGW&â&W7VÇC²Ğ¢6öç7B6†æ6T&öçW3ÖçVÖW&–2‡&vT'Vfbæ7&—D6†æ6T&öçW5W&6VçB“°¢6öç7BFÖvT&öçW3ÖçVÖW&–2‡&vT'Vfbæ7&—DFÖvT&öçW5W&6VçB’ó°¢²'‡—6–6Â"Â&Öv–2%Òæf÷$V6‚†¶W“Óç°¢–b‚&W7VÇE¶¶W•Ò—²&WGW&ã²Ğ¢&W7VÇE¶¶W•Òæ6†æ6R³Ö6†æ6T&öçW3°¢&W7VÇE¶¶W•Òæ×VÇF—Æ–W"³ÖFÖvT&öçW3°¢Ò“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢gVæ7F–öâvWEcC&vUfÇVW2†ÆWfVÂ—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6Rç&vWÇÇ·Ó°¢6öç7B–æFWƒÔÖF‚æÖ‚ƒÆçVÖW&–2†ÆWfVÂ’Ó“°¢&WGW&â°¢6†æ6S¦çVÖW&–2‚‡6¶–ÆÂæ7&—D6†æ6T&öçW4'”ÆWfVÇÇÅµÒ•¶–æFW…Ò’À¢FÖvS¦çVÖW&–2‚‡6¶–ÆÂæ7&—DFÖvT&öçW4'”ÆWfVÇÇÅµÒ•¶–æFW…Ò¢Ó°¢Ğ ¢gVæ7F–öâ—5cC6¶–ÆÄ&'&–W"†'Vfb—°¢&WGW&â€¢'Vfbb`¢'VfbçG—SÓÓÒ&&'&–W""b`¢'VfbçGW&ç4ÆVgCã ¢“°¢Ğ ¢ÆWBF—&V7D&'&–W$67D6öçFW‡CÖçVÆÃ°¢gVæ7F–öâ6öç7VÖUcCF—&V7D&'&–W"†6†&7FW"—°¢ò¢cs2ãcB÷vç2&'&–W"2GW&F–öâÖ&6VBgVÆÂ&÷FV7F–öââ¶VWF†—0¢†—7F÷&–6ÂW‡÷'BöæÇ’f÷"6ÆÆW'2F†B†fRæ÷BÖ–w&FVB–WBâ¢ğ¢&WGW&â—5cC6¶–ÆÄ&'&–W"†6†&7FW"bd'&’æ—4'&’†6†&7FW"æ7F—fT'Vfg2¢ö6†&7FW"æ7F—fT'Vfg2æf–æB†—5cC6¶–ÆÄ&'&–W"“¦çVÆÂ“°¢Ğ ¢v–æF÷rçcC6öç7VÖTF—&V7D&'&–W#Ö6öç7VÖUcCF—&V7D&'&–W#°¢v–æF÷rçcs5v—F„F—&V7D&'&–W$67CÖgVæ7F–öâ†6ÆÆ&6²—°¢&WGW&â6ÆÆ&6²‚“°¢Ó° ¢ò¢Šé>h¨ˆ;ŞikŞiKî[èÎy¨B'Vfb[‹niÈikŠhşjÎ™ÈŠhy¨NxÚz¸¾jÈNKØŞ8"¢ğ¢6öç7B&Wf–÷W467D'Vfe6¶–ÆÃÖ67D'Vfe6¶–ÆÃ°¢67D'Vfe6¶–ÆÃÖgVæ7F–öâ‡6¶–ÆÄ–BÇF&vWD–æFW‚—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢6öç7BÆWfVÃ×6¶–ÆÂbgG—VöbvWE6¶–ÆÄÆWfVÃÓÓÒ&gVæ7F–öâ ¢òvWE6¶–ÆÄÆWfVÂ‚&f—&R"Ç6¶–ÆÄ–B¢¢°¢6öç7B&vUfÇVW3ÖvWEcC&vUfÇVW2†ÆWfVÂ“°¢ÆWBF–D67CÖfÇ6S° ¢6öç7B&Wf–÷W4&FvS×G—Vöb6†÷u6¶–ÆÄæÖT&FvSÓÓÒ&gVæ7F–öâ ¢ò6†÷u6¶–ÆÄæÖT&FvP¢¢çVÆÃ°¢6öç7B&Wf–÷W4Æös×G—VöbFD&GFÆTÆösÓÓÒ&gVæ7F–öâ ¢òFD&GFÆTÆöp¢¢çVÆÃ° ¢–b‡&Wf–÷W4&FvR—°¢6†÷u6¶–ÆÄæÖT&FvSÖgVæ7F–öâ‡6¶–ÆÄæÖR—°¢–b‡6¶–ÆÂbg6¶–ÆÄæÖSÓÓ×6¶–ÆÂææÖR—²F–D67C×G'VS²Ğ¢&WGW&â&Wf–÷W4&FvRæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡&Wf–÷W4Æörbb‡6¶–ÆÄ–CÓÓÒ'&vR'ÇÇ6¶–ÆÄ–CÓÓÒ&&'&–W""’—°¢FD&GFÆTÆösÖgVæ7F–öâ†ÖW76vR—°¢6öç7B&w3Ô'&’ç&÷F÷G—Rç6Æ–6Ræ6ÆÂ†&wVÖVçG2“°¢–b‡6¶–ÆÄ–CÓÓÒ'&vR"be7G&–ær†ÖW76vR’æ–æ6ÇVFW2‚.h	.x¾yIşiX‚"’—°¢&w5³ÓĞ¢.h	.x¾yIşiXûÈh‰ikiÈZI£>K«®xˆni8®xè~hùXØr"°¢&vUfÇVW2æ6†æ6R²"^8xˆni8®X+~Zë>hùXØr"°¢&vUfÇVW2æFÖvR²"^ûÈÎhÈ{¨Â"·6¶–ÆÂæGW&F–öâ².Y¹îY8"#°¢Ğ¢&WGW&â&Wf–÷W4ÆöræÇ’‡F†—2Æ&w2“°¢Ó°¢Ğ ¢ÆWB&W7VÇC°¢G'—°¢&W7VÇC×&Wf–÷W467D'Vfe6¶–ÆÂæÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢–b‡&Wf–÷W4&FvR—²6†÷u6¶–ÆÄæÖT&FvS×&Wf–÷W4&FvS²Ğ¢–b‡&Wf–÷W4Æörbg6¶–ÆÄ–CÓÓÒ'&vR"—°¢FD&GFÆTÆös×&Wf–÷W4Æös°¢Ğ¢Ğ ¢–b‚F–D67B—²&WGW&â&W7VÇC²Ğ ¢–b‡6¶–ÆÄ–CÓÓÒ'&vR"bgG—VöbvWD7F—fUÆ–W$6†&7FW'3ÓÓÒ&gVæ7F–öâ"—°¢vWD7F—fUÆ–W$6†&7FW'2‚’ç6Æ–6RƒÃ2’æf÷$V6‚†6†&7FW#Óç°¢6öç7B'VfcÒ†6†&7FW"æ7F—fT'Vfg7ÇÅµÒ¢æf–æB†VçG'“ÓæVçG'’çG—SÓÓÒ'&vR"bfVçG'’çGW&ç4ÆVgCã“°¢–b‚'Vfb—²&WGW&ã²Ğ¢'Vfbæ&öçW5W&6VçC×&vUfÇVW2æ6†æ6S°¢'Vfbæ7&—D6†æ6T&öçW5W&6VçC×&vUfÇVW2æ6†æ6S°¢'Vfbæ7&—DFÖvT&öçW5W&6VçC×&vUfÇVW2æFÖvS°¢Ò“°¢Ğ ¢&WGW&â&W7VÇC°¢Ó° ¢ò ¢zÊnY).KˆŞXúnZú¾KˆK»ŞhÈ{¨ÎY¹îYˆˆ~{YyXÎŠhşX˜~ûÉ®Xk[zÊn8™«‹ª¾zÊn8¢{YyXÎzÊnXˆnXŠ^Šè[Şhxh¨ˆ;Ş8.™¨î{I®j™şxè~Xú®‹*‹*ÎyZ¾zÊnYYşX¹^ûÉ¾yZ¾zÊnh‰X©ş[èÎXhŞKéŞŠy.ˆ›.{J‹:®ZY~yJ[Şhxh¨ˆ;ŞYŞKŠŞŠhşX˜~8 ¢¢ğ¢gVæ7F–öâ7–æ5cCFÆ—6ÖäFVf–æ—F–öç2‚—°¢–b‡G—Vöbv–æF÷rçc3$vWEFÆ—6ÖäFVf–æ—F–öâÓÒ&gVæ7F–öâ"—²&WGW&ã²Ğ ¢6öç7BVffV7G3×°¢g&VW¦S§°¢6¶–ÆÄ–C¢&g&VW¦R"À¢GW&F–öã¦çVÖW&–2‡6¶–ÆÄFF&6Ræg&VW¦Rbg6¶–ÆÄFF&6Ræg&VW¦Ræg&VW¦TGW&F–öâ¢ÒÀ¢7FVÇFƒ§°¢6¶–ÆÄ–C¢'7FVÇF…6¶–ÆÂ"À¢GW&F–öã¦çVÖW&–2‡6¶–ÆÄFF&6Rç7FVÇF…6¶–ÆÂbg6¶–ÆÄFF&6Rç7FVÇF…6¶–ÆÂæGW&F–öâ¢ÒÀ¢&'&–W#§·6¶–ÆÄ–C¢&&'&–W""ÆGW&F–öã¦çVÖW&–2‡6¶–ÆÄFF&6Ræ&'&–W"bg6¶–ÆÄFF&6Ræ&'&–W"æGW&F–öâ—Ğ¢Ó°¢6öç7BF–W'3Õ²$Æ÷r"Â$Ö–B"Â$†–v‚"Â%W&fV7B%Ó° ¢ö&¦V7BæVçG&–W2†VffV7G2’æf÷$V6‚‚…¶VffV7D¶W’ÆVffV7EÒ“Óç°¢F–W'2æf÷$V6‚‡F–W#Óç°¢6öç7BFVf–æ—F–öã×v–æF÷rçc3$vWEFÆ—6ÖäFVf–æ—F–öâ€¢VffV7D¶W’²%FÆ—6Öâ"·F–W ¢“°¢–b‚FVf–æ—F–öâ—²&WGW&ã²Ğ¢FVf–æ—F–öâç6†&VE6¶–ÆÄ–CÖVffV7Bç6¶–ÆÄ–C°¢FVf–æ—F–öâçFÆ—6Öå6¶–ÆÄÆWfVÃÔÖF‚æÖ‚ƒÆçVÖW&–2‡6¶–ÆÄFF&6U¶VffV7Bç6¶–ÆÄ–EÒbg6¶–ÆÄFF&6U¶VffV7Bç6¶–ÆÄ–EÒæÖ„ÆWfVÂ—ÇÃ“°¢–b†VffV7BæGW&F–öãã—²FVf–æ—F–öâçFÆ—6ÖäGW&F–öãÖVffV7BæGW&F–öã²Ğ¢–b†VffV7Bæ&Æö6´6÷VçCã—²FVf–æ—F–öâæ&'&–W$&Æö6´6÷VçCÖVffV7Bæ&Æö6´6÷VçC²Ğ¢Ò“°¢Ò“°¢Ğ ¢7–æ5cCFÆ—6ÖäFVf–æ—F–öç2‚“° ¢–b€¢G—Vöb&W6öÇfUVWVVEÆ–W$7F–öãÓÓÒ&gVæ7F–öâ"b`¢G—Vöbv–æF÷rçc3$vWEFÆ—6ÖäFVf–æ—F–öãÓÓÒ&gVæ7F–öâ ¢—°¢6öç7B&Wf–÷W5&W6öÇfUVWVVEÆ–W$7F–öã×&W6öÇfUVWVVEÆ–W$7F–öã°¢&W6öÇfUVWVVEÆ–W$7F–öãÖgVæ7F–öâ†6†&7FW$–æFW‚ÇFö¶Vâ—°¢6öç7BVWVVC×G—VöbVWVVEÆ–W$7F–öç2ÓÒ'VæFVf–æVB ¢òVWVVEÆ–W$7F–öç5¶6†&7FW$–æFW…Ğ¢¢çVÆÃ°¢6öç7BFVf–æ—F–öã×VWVVBbgVWVVBæ7F–öà¢òv–æF÷rçc3$vWEFÆ—6ÖäFVf–æ—F–öâ‡VWVVBæ7F–öâ¢¢çVÆÃ° ¢–b‚FVf–æ—F–öâ—°¢&WGW&â&Wf–÷W5&W6öÇfUVWVVEÆ–W$7F–öâæÇ’‡F†—2Æ&wVÖVçG2“°¢Ğ ¢ÆWBF&vWCÖçVÆÃ°¢ÆWB&Wf–÷W4'Vfg3ÕµÓ°¢–b†FVf–æ—F–öâçFÆ—6ÖäVffV7CÓÓÒ&&'&–W""—°¢6öç7B67FW#ÖvWD&GFÆT6†&7FW$'”–æFW‚†6†&7FW$–æFW‚“°¢F&vWC×VWVVBbdçVÖ&W"æ—4–çFVvW"‡VWVVBçF&vWDÆÇ’¢òvWD&GFÆT6†&7FW$'”–æFW‚‡VWVVBçF&vWDÆÇ’¢¢67FW#°¢–b‚F&vWGÇÇF&vWBæ‡ÃÓ—²F&vWCÖ67FW#²Ğ¢&Wf–÷W4'Vfg3×F&vWBbd'&’æ—4'&’‡F&vWBæ7F—fT'Vfg2¢òF&vWBæ7F—fT'VkZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^µ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥æg2ç6Æ–6R‚¢¢µÓ°¢Ğ ¢6öç7B&Wf–÷W4Æös×G—VöbFD&GFÆTÆösÓÓÒ&gVæ7F–öâ#öFD&GFÆTÆös¦çVÆÃ°¢ÆWB&W7VÇC°¢G'—°¢&W7VÇC×&Wf–÷W5&W6öÇfUVWVVEÆ–W$7F–öâæÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢–b‡&Wf–÷W4Æör—²FD&GFÆTÆös×&Wf–÷W4Æös²Ğ¢Ğ ¢–b‡F&vWBbfFVf–æ—F–öâçFÆ—6ÖäVffV7CÓÓÒ&&'&–W""—°¢6öç7B'VfcÒ‡F&vWBæ7F—fT'Vfg7ÇÅµÒ’æf–æB†VçG'“Óà¢VçG'’b`¢VçG'’çG—SÓÓÒ&&'&–W""b`¢&Wf–÷W4'Vfg2æ–æ6ÇVFW2†VçG'’¢“°¢–b†'Vfb—°¢'VfbçGW&ç4ÆVgCÖçVÖW&–2‡6¶–ÆÄFF&6Ræ&'&–W"æGW&F–öâ—ÇÃS°¢FVÆWFR'Vfbç&VÖ–æ–æt&Æö6·3°¢'Vfbç6÷W&6UFÆ—6ÖãÖFVf–æ—F–öâæ–C°¢'Vfbæ&'&–W%'VÆSÒ'6†&VB#°¢Ğ¢Ğ ¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢gVæ7F–öâ‡öæÇ”Æ–fW7FVÅFW‡B‡fÇVR—°¢&WGW&â7G&–ær‡fÇVR¢ç&WÆ6R‚şiK¾i8®h¨ˆ;ŞXúşYXùd…ˆˆu5örÂ.iK¾i8®h¨ˆ;ŞXúşYXùd…"¢ç&WÆ6R‚ô…Âõ5YXùbörÂ$…YXùb"¢ç&WÆ6R‚şzØ˜xşY¹î[êˆz®‹ª´…ˆˆu5örÂ.Xú®Y¹î[êˆz®‹ª´…"¢ç&WÆ6R‚şzØ˜xşh.[êˆz®‹ª´…ˆˆu5örÂ.Xú®h.[êˆz®‹ª´…"¢ç&WÆ6R‚şûÈY¹î[ê”…Âõ5ûÈ’örÂ.ûÈXú®Y¹î[ê”…ûÈ’"“°¢Ğ ¢gVæ7F–öâ‡öæÇ”&GFÆTÆöuFW‡B‡fÇVR—°¢&WGW&â‡öæÇ”Æ–fW7FVÅFW‡B‡fÇVR¢ç&WÆ6R‚ş›¹ä…ˆˆu5örÂ.›¹ä…"¢ç&WÆ6R‚şY¹î[ê”…ˆˆu5örÂ.Y¹î[ê”…"¢ç&WÆ6R‚şh.[ê’…ÆB²›¹ä…8ÆB¾›¹å5örÂ.h.[ê’C›¹ä…"“°¢Ğ ¢gVæ7F–öâ6÷'&V7EcC6¶–ÆÅFW‡B‡fÇVRÇ6¶–ÆÂÆÆWfVÂ—°¢ÆWBFW‡CÖ‡öæÇ”Æ–fW7FVÅFW‡B‡fÇVR“° ¢6öç7B&vS×6¶–ÆÄFF&6Rç&vS°¢–b‚&vR—²&WGW&âFW‡C²Ğ ¢6öç7B&WÆ6TDÆWfVÃÒ‡F&vWDÆWfVÂ“Óç°¢6öç7BfÇVW3ÖvWEcC&vUfÇVW2‡F&vWDÆWfVÂ“°¢°¢.xˆni8®xè~ûÈşxˆni8®X+~Zë2²"·fÇVW2æ6†æ6R²"R"À¢.h‰ikxˆni8®xè~ˆˆ~xˆni8®X+~Zë2²"·fÇVW2æ6†æ6R²"R ¢Òæf÷$V6‚†öÆEFW‡CÓç°¢FW‡C×FW‡Bç7Æ—B†öÆEFW‡B’æ¦ö–â€¢†öÆEFW‡Bç7F'G5v—F‚‚.h‰ik’"“ò.h‰ik’#¢""’°¢.xˆni8®xèr²"·fÇVW2æ6†æ6R²"^8xˆni8®X+~Zë2²"°¢fÇVW2æFÖvR²"R ¢“°¢Ò“°¢Ó° ¢–b‡6¶–ÆÂbg6¶–ÆÂæ–CÓÓÒ'&vR"bfçVÖW&–2†ÆWfVÂ“ã—°¢&WÆ6TDÆWfVÂ†ÆWfVÂ“°¢Ğ¢VÇ6W°¢f÷"†ÆWBÇcÓ¶ÇcÃÒ‡&vRæÖ„ÆWfVÇÇÃR“¶Çb²²—°¢&WÆ6TDÆWfVÂ†Çb“°¢Ğ¢Ğ¢&WGW&âFW‡C°¢Ğ ¢gVæ7F–öâ&Vg&W6…T”gFW%76÷'&V7F–öâ‚—°¢G'—°¢–b‡G—VöbWFFUT“ÓÓÒ&gVæ7F–öâ"—°¢WFFUT’‚“°¢Ğ¢Ö6F6‚†W'&÷"—°¢6öç6öÆRæW'&÷"‚%cCi»Nik5šşzK®ZKiY~ûÉ¢"ÆW'&÷"“°¢Ğ¢Ğ ¢gVæ7F–öâ'VåÆ–W%6¶–ÆÅv—F…cC6öçFW‡B‡6¶–ÆÂÆ67FW"Ç7FG2ÆW†V7WFR—°¢–b‚6¶–ÆÇÇÂ67FW'ÇÂ7FG2—°¢&WGW&âW†V7WFR‚“°¢Ğ ¢6öç7B6öçFW‡C×°¢6¶–ÆÃ§6¶–ÆÂÀ¢‡—6–6ÄGF6³¦çVÖW&–2‡7FG2æGF6²’À¢–çFVÆÆ–vVæ6S¦çVÖW&–2‡7FG2æ–çFVÆÆ–vVæ6R’À¢7gFW$6÷7C¦çVÆÀ¢Ó° ¢6öç7B—4Æ–fW7FVÃÔ'&’æ—4'&’‡6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂ“°¢6öç7B&Wf–÷W4Æös×G—VöbFD&GFÆTÆösÓÓÒ&gVæ7F–öâ#öFD&GFÆTÆös¦çVÆÃ°¢6öç7B&Wf–÷W4&FvS×G—Vöb6†÷u6¶–ÆÄæÖT&FvSÓÓÒ&gVæ7F–öâ#÷6†÷u6¶–ÆÄæÖT&FvS¦çVÆÃ° ¢–b†—4Æ–fW7FVÂbg&Wf–÷W4Æör—°¢FD&GFÆTÆösÖgVæ7F–öâ†ÖW76vR—°¢6öç7B&w3Ô'&’ç&÷F÷G—Rç6Æ–6Ræ6ÆÂ†&wVÖVçG2“°¢&w5³ÓÖ‡öæÇ”&GFÆTÆöuFW‡B†ÖW76vR“°¢&WGW&â&Wf–÷W4ÆöræÇ’‡F†—2Æ&w2“°¢Ó°¢Ğ ¢–b†—4Æ–fW7FVÂbg&Wf–÷W4&FvR—°¢6†÷u6¶–ÆÄæÖT&FvSÖgVæ7F–öâ‚—°¢–b†6öçFW‡Bç7gFW$6÷7CÓÓÖçVÆÂ—°¢6öçFW‡Bç7gFW$6÷7CÖçVÖW&–2†67FW"ç7“°¢Ğ¢&WGW&â&Wf–÷W4&FvRæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢ÆWB&W7VÇC°¢G'—°¢&W7VÇCÖW†V7WFR‚“°¢Öf–æÆÇ—°¢–b†—4Æ–fW7FVÂbg&Wf–÷W4&FvR—°¢6†÷u6¶–ÆÄæÖT&FvS×&Wf–÷W4&FvS°¢Ğ¢–b†—4Æ–fW7FVÂbg&Wf–÷W4Æör—°¢FD&GFÆTÆös×&Wf–÷W4Æös°¢Ğ¢–b€¢—4Æ–fW7FVÂb`¢6öçFW‡Bç7gFW$6÷7BÓÖçVÆÂb`¢çVÖW&–2†67FW"ç7“æ6öçFW‡Bç7gFW$6÷7@¢—°¢67FW"ç7Ö6öçFW‡Bç7gFW$6÷7C°¢&Vg&W6…T”gFW%76÷'&V7F–öâ‚“°¢Ğ¢Ğ¢&WGW&â&W7VÇC°¢Ğ ¢6öç7B&Wf–÷W467DFÖvU6¶–ÆÃÖ67DFÖvU6¶–ÆÃ°¢67DFÖvU6¶–ÆÃÖgVæ7F–öâ‡6¶–ÆÄ–B—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢6öç7B7FG3×G—VöbvWDÖ–ä6†&7FW%7FG3ÓÓÒ&gVæ7F–öâ ¢òvWDÖ–ä6†&7FW%7FG2‚¢¢çVÆÃ°¢&WGW&â'VåÆ–W%6¶–ÆÅv—F…cC6öçFW‡B€¢6¶–ÆÂÀ¢G—VöbÆ–W"ÓÒ'VæFVf–æVB#÷Æ–W#¦çVÆÂÀ¢7FG2À¢‚“Óç&Wf–÷W467DFÖvU6¶–ÆÂæÇ’‡F†—2Æ&wVÖVçG2¢“°¢Ó° ¢6öç7B&Wf–÷W467E6V6öæF'”6†&7FW%6¶–ÆÃÖ67E6V6öæF'”6†&7FW%6¶–ÆÃ°¢67E6V6öæF'”6†&7FW%6¶–ÆÃÖgVæ7F–öâ†6†&7FW$–æFW‚Ç6¶–ÆÄ–B—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢6öç7B6†&7FW#×G—VöbvWE'G”6†&7FW$'”–æFWƒÓÓÒ&gVæ7F–öâ ¢òvWE'G”6†&7FW$'”–æFW‚†6†&7FW$–æFW‚¢¢çVÆÃ°¢6öç7B7FG3×G—VöbvWE'G”&GFÆU7FG3ÓÓÒ&gVæ7F–öâ ¢òvWE'G”&GFÆU7FG2†6†&7FW$–æFW‚¢¢çVÆÃ°¢&WGW&â'VåÆ–W%6¶–ÆÅv—F…cC6öçFW‡B€¢6¶–ÆÂÀ¢6†&7FW"À¢7FG2À¢‚“Óç&Wf–÷W467E6V6öæF'”6†&7FW%6¶–ÆÂæÇ’‡F†—2Æ&wVÖVçG2¢“°¢Ó° ¢6öç7B&Wf–÷W467EÆ–W#%6¶–ÆÃÖ67EÆ–W#%6¶–ÆÃ°¢67EÆ–W#%6¶–ÆÃÖgVæ7F–öâ‡6¶–ÆÄ–B—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢6öç7B7FG3×G—VöbvWEÆ–W#$&GFÆU7FG3ÓÓÒ&gVæ7F–öâ ¢òvWEÆ–W#$&GFÆU7FG2‚¢¢çVÆÃ°¢&WGW&â'VåÆ–W%6¶–ÆÅv—F…cC6öçFW‡B€¢6¶–ÆÂÀ¢G—VöbÆ–W#"ÓÒ'VæFVf–æVB#÷Æ–W##¦çVÆÂÀ¢7FG2À¢‚“Óç&Wf–÷W467EÆ–W#%6¶–ÆÂæÇ’‡F†—2Æ&wVÖVçG2¢“°¢Ó° ¢gVæ7F–öâvWDÖöç7FW%‡—6–6ÄGF6²†Ööç7FW"—°¢–b‚Ööç7FW"—²&WGW&â²Ğ¢6öç7B&VGV7F–öã×G—VöbvWE7FDF÷våW&6VçDf÷#ÓÓÒ&gVæ7F–öâ ¢òçVÖW&–2†vWE7FDF÷våW&6VçDf÷"†Ööç7FW"Â&GF6²"’¢¢°¢&WGW&âÖF‚æÖ‚ƒÆçVÖW&–2†Ööç7FW"æGF6²’¢ƒ×&VGV7F–öâó’“°¢Ğ ¢gVæ7F–öâvWDÖöç7FW$–çFVÆÆ–vVæ6R†Ööç7FW"—°¢–b‚Ööç7FW"—²&WGW&â²Ğ¢–b‡G—VöbvWDÖöç7FW$VffV7F—fT&–Æ—G•ö–çG3ÓÓÒ&gVæ7F–öâ"—°¢&WGW&âçVÖW&–2†vWDÖöç7FW$VffV7F—fT&–Æ—G•ö–çG2†Ööç7FW"Â&–çFVÆÆ–vVæ6R"’“°¢Ğ¢&WGW&âçVÖW&–2†Ööç7FW"æ–çFVÆÆ–vVæ6Uö–çG2“°¢Ğ ¢gVæ7F–öâf–æE6¶–ÆÄ'”æÖR†æÖR—°¢&WGW&âö&¦V7Bæ¶W—2‡6¶–ÆÄFF&6R¢æÖ†–CÓç6¶–ÆÄFF&6U¶–EÒ¢æf–æB‡6¶–ÆÃÓç6¶–ÆÂbg6¶–ÆÂææÖSÓÓÖæÖR—ÇÆçVÆÃ°¢Ğ ¢ò¢FõB&÷FV7F–öâ—2æ÷r'BöbF†R6æöæ–6Â&'&–W"'VÆS²cCæğ¢ÆöævW"'—76W2—Bv—F‚FV×÷&'’†47F—fT'Vfb÷fW'&–FRâ¢ğ ¢6öç7B&Wf–÷W5&ö6W756–ævÆTÖöç7FW$GF6³×&ö6W756–ævÆTÖöç7FW$GF6³°¢&ö6W756–ævÆTÖöç7FW$GF6³ÖgVæ7F–öâ†Ööç7FW$–æFW‚—°¢6öç7BÖöç7FW#×G—VöbÖöç7FW'2ÓÒ'VæFVf–æVB#öÖöç7FW'5¶Ööç7FW$–æFW…Ó¦çVÆÃ°¢–b‚Ööç7FW"—°¢&WGW&â&Wf–÷W5&ö6W756–ævÆTÖöç7FW$GF6²æÇ’‡F†—2Æ&wVÖVçG2“°¢Ğ ¢6öç7B&Wf–÷W4&'&–W$6öçFW‡CÖF—&V7D&'&–W$67D6öçFW‡C°¢F—&V7D&'&–W$67D6öçFW‡C×¶&Æö6¶VD6†&7FW'3¦æWr6WB‚—Ó°¢6öç7B6öçFW‡C×°¢6¶–ÆÃ¦çVÆÂÀ¢‡—6–6ÄGF6³¦vWDÖöç7FW%‡—6–6ÄGF6²†Ööç7FW"’À¢–çFVÆÆ–vVæ6S¦vWDÖöç7FW$–çFVÆÆ–vVæ6R†Ööç7FW"’À¢7gFW$6÷7C¦çVÆÀ¢Ó° ¢6öç7B&Wf–÷W4&FvS×G—Vöb6†÷tÖöç7FW%6¶–ÆÄæÖT&FvSÓÓÒ&gVæ7F–öâ ¢ò6†÷tÖöç7FW%6¶–ÆÄæÖT&FvP¢¢çVÆÃ°¢6öç7B&Wf–÷W4Æös×G—VöbFD&GFÆTÆösÓÓÒ&gVæ7F–öâ#öFD&GFÆTÆös¦çVÆÃ°¢6öç7B&Wf–÷W4†47F—fT'VfcÖ†47F—fT'Vfc° ¢†47F—fT'VfcÖgVæ7F–öâ†6†&7FW"Æ'VfeG—R—°¢–b†'VfeG—SÓÓÒ&&'&–W""bf6öç7VÖUcCF—&V7D&'&–W"†6†&7FW"’—°¢&WGW&âG'VS°¢Ğ¢&WGW&â&Wf–÷W4†47F—fT'VfbæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó° ¢–b‡&Wf–÷W4&FvR—°¢6†÷tÖöç7FW%6¶–ÆÄæÖT&FvSÖgVæ7F–öâ‡6¶–ÆÄæÖR—°¢6öçFW‡Bç6¶–ÆÃÖf–æE6¶–ÆÄ'”æÖR‡6¶–ÆÄæÖR“°¢–b†6öçFW‡Bç6¶–ÆÂbf6öçFW‡Bç6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂ—°¢6öçFW‡Bç7gFW$6÷7CÖçVÖW&–2†Ööç7FW"ç7“°¢Ğ¢&WGW&â&Wf–÷W4&FvRæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡&Wf–÷W4Æör—°¢FD&GFÆTÆösÖgVæ7F–öâ†ÖW76vR—°¢6öç7B&w3Ô'&’ç&÷F÷G—Rç6Æ–6Ræ6ÆÂ†&wVÖVçG2“°¢–b†6öçFW‡Bç6¶–ÆÂbf6öçFW‡Bç6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂ—°¢&w5³ÓÖ‡öæÇ”&GFÆTÆöuFW‡B†ÖW76vR“°¢Ğ¢&WGW&â&Wf–÷W4ÆöræÇ’‡F†—2Æ&w2“°¢Ó°¢Ğ ¢ÆWB&W7VÇC°¢G'—°¢&W7VÇC×&Wf–÷W5&ö6W756–ævÆTÖöç7FW$GF6²æÇ’‡F†—2Æ&wVÖVçG2“°¢Öf–æÆÇ—°¢–b‡&Wf–÷W4&FvR—²6†÷tÖöç7FW%6¶–ÆÄæÖT&FvS×&Wf–÷W4&FvS²Ğ¢–b‡&Wf–÷W4Æör—²FD&GFÆTÆös×&Wf–÷W4Æös²Ğ¢†47F—fT'Vfc×&Wf–÷W4†47F—fT'Vfc°¢F—&V7D&'&–W$67D6öçFW‡C×&Wf–÷W4&'&–W$6öçFW‡C° ¢–b€¢6öçFW‡Bç6¶–ÆÂb`¢6öçFW‡Bç6¶–ÆÂæÆ–fW7FVÅW&6VçD'”ÆWfVÂb`¢6öçFW‡Bç7gFW$6÷7BÓÖçVÆÂb`¢çVÖW&–2†Ööç7FW"ç7“æ6öçFW‡Bç7gFW$6÷7@¢—°¢Ööç7FW"ç7Ö6öçFW‡Bç7gFW$6÷7C°¢&Vg&W6…T”gFW%76÷'&V7F–öâ‚“°¢Ğ¢Ğ¢&WGW&â&W7VÇC°¢Ó° ¢ò¢KúîjÚ>h¨ˆ;ŞZÛ{ù.šˆˆ~h¨ˆ;ŞŠ›>{KŠinz©~Š:yKˆˆ®X{Ş[ÈşX¹^hX¾{XNX{®y¨B…õ5ZÙ~jŠ>8"¢ğ¢gVæ7F–öâw&FW‡E&W7VÇB†gVæ7F–öäæÖR—°¢6öç7B&Wf–÷W3×v–æF÷u¶gVæ7F–öäæÖUÓ°¢–b‡G—Vöb&Wf–÷W2ÓÒ&gVæ7F–öâ"—²&WGW&ã²Ğ¢v–æF÷u¶gVæ7F–öäæÖUÓÖgVæ7F–öâ‚—°¢&WGW&â6÷'&V7EcC6¶–ÆÅFW‡B€¢&Wf–÷W2æÇ’‡F†—2Æ&wVÖVçG2’À¢&wVÖVçG5³ÒÀ¢&wVÖVçG5³Ğ¢“°¢Ó°¢Ğ ¢w&FW‡E&W7VÇB‚&vWE6¶–ÆÄVffV7E&Wf–WuFW‡B"“°¢w&FW‡E&W7VÇB‚&'V–ÆE6¶–ÆÄÆWfVÄ'&V¶F÷vä…DÔÂ"“° ¢gVæ7F–öâ6÷'&V7D7&VF–öäÆ–fW7FVÅFW‡B‚—°¢–b‡G—VöbFö7VÖVçCÓÓÒ'VæFVf–æVB"—²&WGW&ã²Ğ¢°¢&7&VF–öäVÆVÖVçDFW67&—F–öâ"À¢&7&VF–öäVÆVÖVçEFw2"À¢&7&VF–öå6¶–ÆÄFWF–ÄFW67&—F–öâ"À¢&7&VF–öå6¶–ÆÄFWF–ÄÆWfVÇ2 ¢Òæf÷$V6‚†–CÓç°¢6öç7B&ö÷CÖFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°¢–b‚&ö÷B—²&WGW&ã²Ğ¢6öç7BVÆVÖVçG3Õ·&ö÷EÒæ6öæ6B„'&’æg&öÒ‡&ö÷BçVW'•6VÆV7F÷$ÆÂ‚"¢"’’“°¢VÆVÖVçG2æf÷$V6‚†VÆVÖVçCÓç°¢'&’æg&öÒ†VÆVÖVçBæ6†–ÆDæöFW7ÇÅµÒ’æf÷$V6‚†æöFSÓç°¢–b†æöFRææöFUG—SÓÓÓ2—°¢æöFRææöFUfÇVSÖ6÷'&V7EcC6¶–ÆÅFW‡B†æöFRææöFUfÇVRÆçVÆÂÆçVÆÂ“°¢Ğ¢Ò“°¢Ò“°¢Ò“°¢Ğ ¢gVæ7F–öâw&7&VF–öägVæ7F–öâ†gVæ7F–öäæÖR—°¢6öç7B&Wf–÷W3×v–æF÷u¶gVæ7F–öäæÖUÓ°¢–b‡G—Vöb&Wf–÷W2ÓÒ&gVæ7F–öâ"—²&WGW&ã²Ğ¢v–æF÷u¶gVæ7F–öäæÖUÓÖgVæ7F–öâ‚—°¢6öç7B&W7VÇC×&Wf–÷W2æÇ’‡F†—2Æ&wVÖVçG2“°¢6÷'&V7D7&VF–öäÆ–fW7FVÅFW‡B‚“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢w&7&VF–öägVæ7F–öâ‚'6VÆV7DVÆVÖVçB"“°¢w&7&VF–öägVæ7F–öâ‚'6†÷t7&VF–öâ"“°¢w&7&VF–öägVæ7F–öâ‚'6†÷t7&VF–öå6¶–ÆÄFWF–Â"“°¢6÷'&V7D7&VF–öäÆ–fW7FVÅFW‡B‚“° ¢ò¢Š9ÎKˆYÊX‰ŞZx¾yZ¾™Ú.k‹.iù>[èÎh˜Ş‹ÈXZ^ûÈÎz¸¾XÛ>˜xŞ{š®KˆjÊiz.iÈh¨ˆ;ŞX‰~Š8"¢ğ¢G'—°¢–b‡G—Vöb&VæFW%6¶–ÆÄÆöF÷WCÓÓÒ&gVæ7F–öâ"—°¢&VæFW%6¶–ÆÄÆöF÷WB‚“°¢Ğ¢–b€¢G—VöbFö7VÖVçBÓÒ'VæFVf–æVB"b`¢G—VöbFö7VÖVçBçVW'•6VÆV7F÷$ÆÃÓÓÒ&gVæ7F–öâ ¢—°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"æ7&VF–öâ×6¶–ÆÂÖ6†—¶FF×6¶–ÆÂÖ–EÒ"¢æf÷$V6‚†6†—Óç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶6†—æFF6WBç6¶–ÆÄ–EÓ°¢–b‡6¶–ÆÂ—²6†—çF—FÆS×6¶–ÆÂæFW67&—F–öçÇÇ6¶–ÆÂææÖS²Ğ¢Ò“°¢Ğ¢Ö6F6‚†W'&÷"—°¢6öç6öÆRæW'&÷"‚%cCi»Nikh¨ˆ;ŞšşzK®ZKiY~ûÉ¢"ÆW'&÷"“°¢Ğ ¢v–æF÷rçcCvWE6¶–ÆÄ&Ææ6TVF—CÖgVæ7F–öâ‚—°¢6öç7B–G3Õ°¢&fÆÖU6Æ6‚"Â&f—&T7&—F–6Â"Â&W‡Æ÷6—fTfÇW''’"Â&G&vöå6Æ6‚"À¢&f—&U&ö6¶WB"Â&&Æ¦U7VÆÂ"Â&fÆÖUF÷&æFò"Â'†öVæ—„7'’"Â'&vR"Â&f—&TU‚"À¢'vFW$¶æ–fR"Â&g&÷7EVæ6‚"Â&–6U7–â"Â&g&÷7D7'W6‚"À¢'vFW$&ÆÂ"Â&fÆööD&V7B"Â&–6T'&÷u&–â"Â&g&VW¦R"Â&†VÅ7VÆÂ"Â'&Wf—fR"Â'vFW$U‚"À¢'7F÷&Ôf—7B"Â'7F÷&ÔfÇW''’"Â'v–æD7&÷756Æ6‚"Â&F—§§”f—7B"À¢'v–æE7VÆÂ"Â'7F÷&Ô6—&6ÆR"Â'v–æD†÷vÄÆ–v‡Fæ–ær"Â'7F÷&Õ&–â"À¢&FöFvU6¶–ÆÂ"Â'7FVÇF…6¶–ÆÂ"Â&F–æv†—6†Vç¦†Vâ"Â'v–æDU‚"À¢'7FöæU6Æ6‚"Â'WG&–g”f—7B"Â'7FöæT'&Vµ6·’"Â&V'F‡V¶T7'W6‚"À¢'7FöæUF‡&÷r"Â'6æEv–æB"Â&fÇ––æu6æE7G&–¶R"Â&GW7E7F÷&Ò"À¢&V'F…6†–VÆB"Â'&ö6µvÆÂ"Â&&'&–W""Â&V'F„U‚ ¢Ó°¢6öç7Bf–VÆG3Õ°¢&–B"Â&æÖR"Â&VÆVÖVçB"Â&6FVv÷'’"Â'F&vWEG—R"Â&ÆV&ä6÷7B"Â&Ö„ÆWfVÂ"À¢&&6TFÖvR"Â&FÖvUW$ÆWfVÂ"Â'76÷7B"Â&GW&F–öâ"Â'&WV—&W2"À¢&'W&ä6†æ6R"Â&'W&äGW&F–öâ"Â&'W&åW&6VçD'”ÆWfVÂ"À¢&7&—D6†æ6T&öçW4'”ÆWfVÂ"Â&7&—DFÖvT&öçW4'”ÆWfVÂ"À¢&Æ–fW7FVÅW&6VçD'”ÆWfVÂ"Â&g&VW¦T6†æ6R"Â&g&VW¦TGW&F–öâ"À¢&&6T†VÂ"Â&†VÅW$ÆWfVÂ"Â&&6T†VÅ5"Â&†VÅ5W$ÆWfVÂ"À¢'&Wf—fT†VÅW&6VçD'”ÆWfVÂ"Â&v–Æ—G”F÷vä6†æ6R"Â&v–Æ—G”F÷vä'”ÆWfVÂ"À¢&v–Æ—G”F÷väGW&F–öâ"Â&FÖvTF÷vä6†æ6R"Â&FÖvTF÷vä'”ÆWfVÂ"À¢&FÖvTF÷väGW&F–öâ"Â'7GVä6†æ6R"Â&Ö—74&öçW4'”ÆWfVÂ"Â'7GVäGW&F–öâ"À¢&Wf6–öä&öçW5W&6VçB"Â'7FGW5&W6—7D&öçW2"Â&FVfVç6TF÷vä6†æ6R"À¢&FVfVç6TF÷vä'”ÆWfVÂ"Â&FVfVç6TF÷väGW&F–öâ"Â&ÆÇ•6†–VÆD'”ÆWfVÂ"À¢'6VÆe6†–VÆD'”ÆWfVÂ"Â'6†–VÆDGW&F–öâ"Â'WG&–g”6†æ6T'”ÆWfVÂ"À¢'WG&–g”GW&F–öâ"Â'&VfÆV7EW&6VçB"Â&FVfVç6T&öçW5W&6VçB"À¢&&'&–W$&Æö6´6÷VçB"Â&FÖvT&öçW5W&6VçB"Â&7&—D6†æ6T&öçW5W&6VçB"À¢&7&—DFÖvT&öçW5W&6VçB"Â&†VÄ&öçW5W&6VçB ¢Ó°¢&WGW&âö&¦V7Bæg&öÔVçG&–W2†–G2æÖ†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢–b‚6¶–ÆÂ—²&WGW&â¶–BÆçVÆÅÓ²Ğ¢6öç7BVçG'“×·Ó°¢f–VÆG2æf÷$V6‚†f–VÆCÓç°¢–b‡6¶–ÆÅ¶f–VÆEÓÓÓ×VæFVf–æVB—²&WGW&ã²Ğ¢VçG'•¶f–VÆEÓÔ'&’æ—4'&’‡6¶–ÆÅ¶f–VÆEÒ¢ò6¶–ÆÅ¶f–VÆEÒç6Æ–6R‚¢¢6¶–ÆÅ¶f–VÆEÓ°¢Ò“°¢&WGW&â¶–BÆVçG'•Ó°¢Ò’“°¢Ó° ¢ò¢†—Bò7FGW2f÷&×VÆ2&R÷væVB'’§2óÖÖ–âæ§2à¢cCFVÆ–&W&FVÇ’W‡÷'G2æò&Wf–÷W2öÇFW&æFRf÷&×VÆ&VfW&Væ6Râ¢ğ§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó3B×cCÖ6÷&R×7—7FV×2æ§2¢ğ¢ò ¢cC(	B6÷&R7—7FV×0¢ÒW‡Æ–6—BÖöç7FW"&æ²²Rv–ÆBVÆ—FR&W&F–öâ†öö·0¢ÒÖöç7FW"6'&–VB×6¶–ÆÂ6÷VçBöÆWfVÂ'VÆW0¢ÒVÆ—FRÖöæÇ’6–ævÆR×&öÆÂG&÷F&ÆP¢ÒgVæ7F–öæÂÖöç7FW"6†–VÆG2æB7W÷'B’†öö°¢Ò†–v†W7BÖ6†&7FW"öffÆ–æRU…×VÇF—Æ–W ¢ÒW‡æFVBVW7G2ö6†–WfVÖVçG2æB&ö6VGW&Â&GFÆRVF–ğ¢¢ğ¢†gVæ7F–öâ–ç7FÆÅcC6÷&U7—7FV×2‚—°¢'W6R7G&–7B#° ¢6öç7B”ådTåDõ%•ô44•E“Ó#°¢6öç7BdÄ”Eõ$äµ3ÖæWr6WB…²'&VwVÆ""Â&VÆ—FR"Â&&÷72%Ò“°¢6öç7Bt”ÄEôTÄ•DUõ$DSÓã°¢6öç7Bt”ÄEõ¤ôäUõ5E$TäuD…3×v–æF÷rçcs5v–ÆE¦öæU7G&VæwF„×VÇF—Æ–W'3°¢6öç7BcCõ$ôu$U55ô´U“×v–æF÷räf÷W%7–Ö&öÇ466÷VçE6fRæ66÷VçD¶W’‚'&öw&W72"“° ¢v–æF÷råcCô”ådTåDõ%•ô44•E“Ô”ådTåDõ%•ô44•E“°¢v–æF÷rçcC7—7FVÔ6öæf–sÔö&¦V7Bæg&VW¦R‡°¢–çfVçF÷'”66—G“¤”ådTåDõ%•ô44•E’À¢–çfVçF÷'•vU6—¦S£#BÀ¢–çfVçF÷'•vW3£RÀ¢v–ÆDVÆ—FU&FS¥t”ÄEôTÄ•DUõ$DRÀ¢VÆ—FU7V6–ÄG&÷&FS£ã¢Ò“° ¢gVæ7F–öâvWD†–v†W7D6†&7FW$ÆWfVÂ‚—°¢–b‡G—VöbvWDW†—7F–æu'G”–æFW†W2ÓÒ&gVæ7F–öâ"—²&WGW&â²Ğ¢&WGW&âÖF‚æÖ‚ƒÂââævWDW†—7F–æu'G”–æFW†W2‚’æÖ†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢&WGW&âÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†6†&7FW"bf6†&7FW"æÆWfVÂ—ÇÃ’“°¢Ò’“°¢Ğ¢v–æF÷rçcCvWD†–v†W7D6†&7FW$ÆWfVÃÖvWD†–v†W7D6†&7FW$ÆWfVÃ° ¢gVæ7F–öâÆöD66÷VçE&öw&W72‚—°¢G'—°¢6öç7B&sÔ¥4ôâç'6R†Æö6Å7F÷&vRævWD—FVÒ…cCõ$ôu$U55ô´U’—ÇÂ'·Ò"“°¢&WGW&â°¢VÆ—FT¶–ÆÇ3¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡&ræVÆ—FT¶–ÆÇ2—ÇÃ’’À¢GVævVöåv–ç3¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡&ræGVævVöåv–ç2—ÇÃ’’À¢'—746ÆV'3¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡&ræ'—746ÆV'2—ÇÃ’¢Ó°¢Ö6F6‚…ò—°¢&WGW&â¶VÆ—FT¶–ÆÇ3£ÆGVævVöåv–ç3£Æ'—746ÆV'3£Ó°¢Ğ¢Ğ ¢6öç7B66÷VçE&öw&W73ÖÆöD66÷VçE&öw&W72‚“° ¢gVæ7F–öâW'6—7D66÷VçE&öw&W72‚—°¢G'—²Æö6Å7F÷&vRç6WD—FVÒ…cCõ$ôu$U55ô´U’Ä¥4ôâç7G&–æv–g’†66÷VçE&öw&W72’“²Ğ¢6F6‚…ò—²Ğ¢Ğ¢v–æF÷rçcCvWD66÷VçE&öw&W73ÖgVæ7F–öâ‚—²&WGW&âö&¦V7Bæ76–vâ‡·ÒÆ66÷VçE&öw&W72“²Ó°¢v–æF÷rçcC&V6÷&D'—746ÆV#ÖgVæ7F–öâ‚—°¢66÷VçE&öw&W72æ'—746ÆV'2²³°¢W'6—7D66÷VçE&öw&W72‚“°¢Ó° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢v–ÆB&÷7FW"W‡ç6–öâæBW‡Æ–6—B&æ°¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâvWEv–ÆE¦öæU7V72‚—°¢&WGW&â°¢·G—Vöbf÷&W7DÖöç7FW'2ÓÒ'VæFVf–æVB#öf÷&W7DÖöç7FW'3¦çVÆÂÃ2Â.ié~™i>š*™Ø‚"Â.ˆ¹N[*xÛ‚"Åt”ÄEõ¤ôäUõ5E$TäuD…5³ÕÒÀ¢·G—VöbFW6W'DÖöç7FW'2ÓÒ'VæFVf–æVB#öFW6W'DÖöç7FW'3¦çVÆÂÃrÂ.š*k)™«Â"Â.[*yK.ŠÒ"Åt”ÄEõ¤ôäUõ5E$TäuD…5³ÕÒÀ¢·G—Vöb–6TÖ÷VçF–äÖöç7FW'2ÓÒ'VæFVf–æVB#ö–6TÖ÷VçF–äÖöç7FW'3¦çVÆÂÃ#RÂ.™ÉÎš*Zib"Â.XxŞ[*xÛ‚"Åt”ÄEõ¤ôäUõ5E$TäuD…5³%ÕÒÀ¢·G—Vöb¦öæSDÖöç7FW'2ÓÒ'VæFVf–æVB#÷¦öæSDÖöç7FW'3¦çVÆÂÃ3RÂ.xKš*šËÂ"Â.xiN[*yû>h
¢"Åt”ÄEõ¤ôäUõ5E$TäuD…5³5ÕÒÀ¢·G—Vöb¦öæSTÖöç7FW'2ÓÒ'VæFVf–æVB#÷¦öæSTÖöç7FW'3¦çVÆÂÃCRÂ.‰+Îš*[zxÛ‚"Â.[[+>[zxÛ‚"Åt”ÄEõ¤ôäUõ5E$TäuD…5³EÕÒÀ¢·G—Vöb¦öæSdÖöç7FW'2ÓÒ'VæFVf–æVB#÷¦öæSdÖöç7FW'3¦çVÆÂÃSRÂ.š*Xˆ>Kúî{èR"Â.[*˜ê~Kúî{èR"Åt”ÄEõ¤ôäUõ5E$TäuD…5³UÕÒÀ¢·G—Vöb¦öæStÖöç7FW'2ÓÒ'VæFVf–æVB#÷¦öæStÖöç7FW'3¦çVÆÂÃcRÂ.[Y[ÛšÙNY	²"Â.[+>šØ.šÙNY	²"Åt”ÄEõ¤ôäUõ5E$TäuD…5³eÕÒÀ¢·G—Vöb¦öæS„Ööç7FW'2ÓÒ'VæFVf–æVB#÷¦öæS„Ööç7FW'3¦çVÆÂÃsRÂ.™Ù.[Y›èŞŠ²"Â.[*[+>›èŞŠ²"Åt”ÄEõ¤ôäUõ5E$TäuD…5³uÕÒÀ¢·G—Vöb¦öæS”Ööç7FW'2ÓÒ'VæFVf–æVB#÷¦öæS”Ööç7FW'3¦çVÆÂÃƒRÂ.‰™¾z›®š*™Ø‚"Â.‰™¾z›®[*™Ø‚"Åt”ÄEõ¤ôäUõ5E$TäuD…5³…ÕÒÀ¢·G—Vöb¦öæSÖöç7FW'2ÓÒ'VæFVf–æVB#÷¦öæSÖöç7FW'3¦çVÆÂÃ“RÂ.{X.xHš*zYâ"Â.{X.xHYËzYâ"Åt”ÄEõ¤ôäUõ5E$TäuD…5³•ÕĞ¢Òæf–ÇFW"†VçG'“Óä'&’æ—4'&’†VçG'•³Ò’“°¢Ğ ¢gVæ7F–öâ7G&VæwF†VäæWuv–ÆDÖöç7FW"†Ööç7FW"Æ×VÇF—Æ–W"—°¢–b‚Ööç7FW"ÇÂÖöç7FW"å÷c37G&VæwF„Æ–VB—²&WGW&âÖöç7FW#²Ğ¢6öç7B7G&VæwF„×VÇF—Æ–W#ÔçVÖ&W"æ—4f–æ—FR„çVÖ&W"†×VÇF—Æ–W"’¢òçVÖ&W"†×VÇF—Æ–W"¢¢t”ÄEõ¤ôäUõ5E$TäuD…5µt”ÄEõ¤ôäUõ5E$TäuD…2æÆVæwF‚ÓÓ°¢Ööç7FW"å÷c37G&VæwF„Æ–VC×G'VS°¢²&Ö„…"Â&Ö…5"Â&GF6²"Â&FVfVç6R"Â&Öv–4GF6²%Òæf÷$V6‚†¶W“Óç°¢–b„çVÖ&W"æ—4f–æ—FR„çVÖ&W"†Ööç7FW%¶¶W•Ò’’—°¢Ööç7FW%¶¶W•ÓÔÖF‚æÖ‚ƒÄÖF‚ç&÷VæB„çVÖ&W"†Ööç7FW%¶¶W•Ò’§7G&VæwF„×VÇF—Æ–W"’“°¢Ğ¢Ò“°¢Ööç7FW"æ‡ÖÖöç7FW"æÖ„…°¢Ööç7FW"ç7ÖÖöç7FW"æÖ…5°¢&WGW&âÖöç7FW#°¢Ğ ¢gVæ7F–öâFEv–æDæDV'F…v–ÆDÖöç7FW'2‚—°¢vWEv–ÆE¦öæU7V72‚’æf÷$V6‚‚…·¦öæRÆÆWfVÂÇv–æDæÖRÆV'F„æÖRÇ7G&VæwF„×VÇF—Æ–W%Ò“Óç°¢¦öæRæf÷$V6‚†Ööç7FW#Óç°¢–b†Ööç7FW"—°¢Ööç7FW"ç&æ³Ò'&VwVÆ"#°¢Ööç7FW"çcC7W'fTVÆ—FU&FSÕt”ÄEôTÄ•DUõ$DS°¢Ğ¢Ò“°¢–b‚¦öæRç6öÖR†Ööç7FW#ÓæÖöç7FW"bfÖöç7FW"ææÖSÓÓ×v–æDæÖR’—°¢6öç7BÖöç7FW#×7G&VæwF†VäæWuv–ÆDÖöç7FW"€¢Ö¶U¦öæTÖöç7FW"‡v–æDæÖRÆÆWfVÂÂ'v–æB"Â'&VwVÆ""’À¢7G&VæwF„×VÇF—Æ–W ¢“°¢Ööç7FW"çcC7W'fTVÆ—FU&FSÕt”ÄEôTÄ•DUõ$DS°¢¦öæRçW6‚†Ööç7FW"“°¢Ğ¢–b‚¦öæRç6öÖR†Ööç7FW#ÓæÖöç7FW"bfÖöç7FW"ææÖSÓÓÖV'F„æÖR’—°¢6öç7BÖöç7FW#×7G&VæwF†VäæWuv–ÆDÖöç7FW"€¢Ö¶U¦öæTÖöç7FW"†V'F„æÖRÆÆWfVÂÂ&V'F‚"Â'&VwVÆ""’À¢7G&VæwF„×VÇF—Æ–W ¢“°¢Ööç7FW"çcC7W'fTVÆ—FU&FSÕt”ÄEôTÄ•DUõ$DS°¢¦öæRçW6‚†Ööç7FW"“°¢Ğ¢Ò“°¢Ğ ¢–b‡G—VöbvWDÖöç7FW%&æ³ÓÓÒ&gVæ7F–öâ"—°¢vWDÖöç7FW%&æ³ÖgVæ7F–öâ†Ööç7FW"—°¢–b‚Ööç7FW"—²&WGW&â'&VwVÆ"#²Ğ¢–b…dÄ”Eõ$äµ2æ†2†Ööç7FW"çcC&GFÆU&æ²’—²&WGW&âÖöç7FW"çcC&GFÆU&æ³²Ğ¢–b…dÄ”Eõ$äµ2æ†2†Ööç7FW"ç&æ²’—²&WGW&âÖöç7FW"ç&æ³²Ğ¢&WGW&â'&VwVÆ"#°¢Ó°¢Ğ ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢Ööç7FW"6'&–VB6¶–ÆÇ0¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâvWDÖöç7FW%6¶–ÆÄ6''”Æ–Ö—B†ÆWfVÂ—°¢6öç7BÇcÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†ÆWfVÂ—ÇÃ’“°¢–b†ÇcÃÓ#—²&WGW&â²Ğ¢–b†ÇcÃÓC—²&WGW&â#²Ğ¢&WGW&â3°¢Ğ ¢gVæ7F–öâvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÂ†ÆWfVÂ—°¢6öç7BÇcÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†ÆWfVÂ—ÇÃ’“°¢–b†ÇcÃÓ#—²&WGW&â²Ğ¢–b†ÇcÃÓC—²&WGW&â#²Ğ¢–b†ÇcÃÓc—²&WGW&â3²Ğ¢–b†ÇcÃÓƒ—²&WGW&âC²Ğ¢&WGW&âS°¢Ğ ¢gVæ7F–öâ6‡VffÆVD6÷’‡fÇVW2—°¢6öç7BÆ—7CÒ‡fÇVW7ÇÅµÒ’ç6Æ–6R‚“°¢f÷"†ÆWB“ÖÆ—7BæÆVæwF‚Ó¶“ã¶’ÒÒ—°¢6öç7B£ÔÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¢†’³’“°¢¶Æ—7E¶•ÒÆÆ—7E¶¥ÕÓÕ¶Æ—7E¶¥ÒÆÆ—7E¶•ÕÓ°¢Ğ¢&WGW&âÆ—7C°¢Ğ ¢gVæ7F–öâ6öæf–wW&TÖöç7FW%6¶–ÆÇ2†Ööç7FW"Æ÷F–öç2—°¢–b‚Ööç7FW"ÇÂÖöç7FW"çcC'—72—²&WGW&âÖöç7FW#²Ğ¢6öç7B6WGF–æw3Ö÷F–öç7ÇÇ·Ó°¢6öç7B6÷W&6SÔ'&’æ—4'&’‡6WGF–æw2çööÂ¢ò6WGF–æw2çööÀ¢¢'&’æ—4'&’†Ööç7FW"ç6¶–ÆÄ–G2¢òÖöç7FW"ç6¶–ÆÄ–G0¢¢µÓ°¢6öç7BVÆ–v–&ÆSÕ²ââææWr6WB‡6÷W&6R•Òæf–ÇFW"†–CÓç°¢6öç7B6¶–ÆÃ×G—Vöb6¶–ÆÄFF&6RÓÒ'VæFVf–æVB"ò6¶–ÆÄFF&6U¶–EÒ¢çVÆÃ°¢&WGW&â€¢6¶–ÆÂb`¢‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â"ÇÂ6¶–ÆÂæ6FVv÷'“ÓÓÒ&Öv–2"’b`¢‡G—Vöbv–æF÷rçcCD—4Ööç7FW%6¶–ÆÄVÆVÖVçDÆVvÃÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcCD—4Ööç7FW%6¶–ÆÄVÆVÖVçDÆVvÂ†Ööç7FW"Æ–B¢¢6¶–ÆÂæVÆVÖVçBbg6¶–ÆÂæVÆVÖVçCÓÓÖÖöç7FW"æVÆVÖVçB¢“°¢Ò“°¢6öç7BÆ–Ö—CÖvWDÖöç7FW%6¶–ÆÄ6''”Æ–Ö—B†Ööç7FW"æÆWfVÂ“°¢Ööç7FW"ç6¶–ÆÄ–G3Ò‡6WGF–æw2æ¶VW÷&FW"òVÆ–v–&ÆR¢6‡VffÆVD6÷’†VÆ–v–&ÆR’’ç6Æ–6RƒÆÆ–Ö—B“°¢Ööç7FW"çcC6¶–ÆÄÆWfVÃÖvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÂ†Ööç7FW"æÆWfVÂ“°¢&WGW&âÖöç7FW#°¢Ğ ¢v–æF÷rçcCvWDÖöç7FW%6¶–ÆÄ6''”Æ–Ö—CÖvWDÖöç7FW%6¶–ÆÄ6''”Æ–Ö—C°¢v–æF÷rçcCvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÃÖvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÃ°¢v–æF÷rçcC6öæf–wW&TÖöç7FW%6¶–ÆÇ3Ö6öæf–wW&TÖöç7FW%6¶–ÆÇ3° ¢–b‡G—VöbÖ¶U¦öæTÖöç7FW#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄÖ¶U¦öæTÖöç7FW#ÖÖ¶U¦öæTÖöç7FW#°¢Ö¶U¦öæTÖöç7FW#ÖgVæ7F–öâ‚—°¢6öç7BÖöç7FW#Ö÷&–v–æÄÖ¶U¦öæTÖöç7FW"æÇ’‡F†—2Æ&wVÖVçG2“°¢–b†Ööç7FW"bbÖöç7FW"ç&æ²—²Ööç7FW"ç&æ³Ò'&VwVÆ"#²Ğ¢&WGW&â6öæf–wW&TÖöç7FW%6¶–ÆÇ2†Ööç7FW"“°¢Ó°¢Ğ ¢FEv–æDæDV'F…v–ÆDÖöç7FW'2‚“°¢vWEv–ÆE¦öæU7V72‚’æf÷$V6‚‚…·¦öæUÒ“Óç¦öæRæf÷$V6‚†6öæf–wW&TÖöç7FW%6¶–ÆÇ2’“° ¢ò¢c3>izikÎiÊÎ[N‹ÈXZ^ûÉ¾XªXZ^š*ûÈşYÉşh
®ˆˆs^{+îˆ»iÉşiÉ¾XÎ[èÎûÈÎz¸¾XÛ>yJiÈ{X ¢YËYÉn‹8~ii˜xŞzé~yºîX˜ŞzØ{I®™Èk.8.iz.iÈzØ{I®8[{.{Jşz˜ÔU…ˆˆ~X[nK¹nZÙj©NKˆŞX¹^8"¢ğ¢–b‡G—Vöbv–æF÷rçc34vWDW‡æW‡Df÷$ÆWfVÃÓÓÒ&gVæ7F–öâ"—°¢vWDW†—7F–æu'G”–æFW†W2‚’æf÷$V6‚†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢–b†6†&7FW"bf6†&7FW"æÆWfVÃÃ—°¢6†&7FW"æW‡æW‡C×v–æF÷rçc34vWDW‡æW‡Df÷$ÆWfVÂ†6†&7FW"æÆWfVÂ“°¢Ğ¢Ò“°¢Ğ ¢v–æF÷rçcC&öÆÅv–ÆDÖöç7FW%&æ·3ÖgVæ7F–öâ†–æFW†W2—°¢†–æFW†W7ÇÅµÒ’æf÷$V6‚†–æFWƒÓç°¢6öç7BÖöç7FW#×G—VöbÖöç7FW'2ÓÒ'VæFVf–æVB"òÖöç7FW'5¶–æFW…Ò¢çVÆÃ°¢–b‚Ööç7FW"—²&WGW&ã²Ğ¢Ööç7FW"ç&æ³Ò'&VwVÆ"#°¢Ööç7FW"çcC&GFÆU&æ³ÔÖF‚ç&æFöÒ‚“Åt”ÄEôTÄ•DUõ$DRò&VÆ—FR"¢'&VwVÆ"#°¢6öæf–wW&TÖöç7FW%6¶–ÆÇ2†Ööç7FW"“°¢Ò“°¢Ó° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢gVæ7F–öæÂÖöç7FW"6†–VÆ@¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâvWDÖöç7FW%6†–VÆE&VÖ–æ–ær†Ööç7FW"—°¢6öç7B6†–VÆCÖÖöç7FW"bfÖöç7FW"çcC6†–VÆC°¢&WGW&â6†–VÆBòÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡6†–VÆBç&VÖ–æ–ær—ÇÃ’’¢°¢Ğ ¢gVæ7F–öâ&VÖ÷fTÖöç7FW%6†–VÆB†Ööç7FW"—°¢6öç7B6†–VÆCÖÖöç7FW"bfÖöç7FW"çcC6†–VÆC°¢–b‚6†–VÆB—²&WGW&ã²Ğ¢6öç7B&VÖ–æ–æsÖvWDÖöç7FW%6†–VÆE&VÖ–æ–ær†Ööç7FW"“°¢6öç7B&6T‡ÔÖF‚æÖ‚ƒÂ„çVÖ&W"†Ööç7FW"æ‡—ÇÃ’×&VÖ–æ–ær“°¢Ööç7FW"æÖ„…ÔÖF‚æÖ‚ƒÄçVÖ&W"‡6†–VÆBæ&6TÖ„…—ÇÃ“°¢Ööç7FW"æ‡ÔÖF‚æÖ–â†Ööç7FW"æÖ„…Æ&6T‡“°¢Ööç7FW"çcC6†–VÆCÖçVÆÃ°¢Ööç7FW"æ7F—fT'Vfg3Ò†Ööç7FW"æ7F—fT'Vfg7ÇÅµÒ’æf–ÇFW"†'VfcÓæ'VfbÓ×6†–VÆBbf'VfbçG—RÓÒ'6†–VÆB"“°¢Ğ ¢gVæ7F–öâ7–æ4Ööç7FW%6†–VÆB†Ööç7FW"—°¢6öç7B6†–VÆCÖÖöç7FW"bfÖöç7FW"çcC6†–VÆC°¢–b‚6†–VÆB—²&WGW&â²Ğ¢6†–VÆBç&VÖ–æ–æsÔÖF‚æÖ‚€¢À¢ÖF‚æÖ–â€¢çVÖ&W"‡6†–VÆBæÖ÷VçB—ÇÃÀ¢„çVÖ&W"†Ööç7FW"æ‡—ÇÃ’Ò„çVÖ&W"‡6†–VÆBæ&6T‡—ÇÃ¢¢“°¢–b‡6†–VÆBç&VÖ–æ–æsÃÓ—°¢6öç7B7W'&VçD‡ÔÖF‚æÖ‚ƒÄçVÖ&W"†Ööç7FW"æ‡—ÇÃ“°¢Ööç7FW"æÖ„…ÔÖF‚æÖ‚ƒÄçVÖ&W"‡6†–VÆBæ&6TÖ„…—ÇÃ“°¢Ööç7FW"æ‡ÔÖF‚æÖ–â†Ööç7FW"æÖ„…Æ7W'&VçD‡“°¢Ööç7FW"çcC6†–VÆCÖçVÆÃ°¢Ööç7FW"æ7F—fT'Vfg3Ò†Ööç7FW"æ7F—fT'Vfg7ÇÅµÒ’æf–ÇFW"†'VfcÓæ'VfbÓ×6†–VÆBbf'VfbçG—RÓÒ'6†–VÆB"“°¢&WGW&â°¢Ğ¢&WGW&â6†–VÆBç&VÖ–æ–æs°¢Ğ ¢gVæ7F–öâÇ”Ööç7FW%6†–VÆB†Ööç7FW"ÆÖ÷VçBÇGW&ç2—°¢–b‚Ööç7FW"ÇÂÖöç7FW"æÆ—fR—²&WGW&â²Ğ¢–b†Ööç7FW"çcC6†–VÆB—²&VÖ÷fTÖöç7FW%6†–VÆB†Ööç7FW"“²Ğ¢6öç7B6fTÖ÷VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢6öç7B6†–VÆC×°¢G—S¢'6†–VÆB"À¢Ö÷VçC§6fTÖ÷VçBÀ¢&VÖ–æ–æs§6fTÖ÷VçBÀ¢GW&ç4ÆVgC¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"‡GW&ç2—ÇÃ"’’À¢&6TÖ„…¤ÖF‚æÖ‚ƒÄçVÖ&W"†Ööç7FW"æÖ„…—ÇÃ’À¢&6T‡¤ÖF‚æÖ‚ƒÄçVÖ&W"†Ööç7FW"æ‡—ÇÃ’À¢cCÖöç7FW%6†–VÆC§G'VP¢Ó°¢Ööç7FW"æÖ„…×6†–VÆBæ&6TÖ„…·6fTÖ÷VçC°¢Ööç7FW"æ‡×6†–VÆBæ&6T‡·6fTÖ÷VçC°¢Ööç7FW"çcC6†–VÆC×6†–VÆC°¢Ööç7FW"æ7F—fT'Vfg3Ò†Ööç7FW"æ7F—fT'Vfg7ÇÅµÒ’æf–ÇFW"†'VfcÓæ'VfbçG—RÓÒ'6†–VÆB"“°¢Ööç7FW"æ7F—fT'Vfg2çW6‚‡6†–VÆB“°¢&WGW&â6fTÖ÷VçC°¢Ğ ¢gVæ7F–öâ†VÄÖöç7FW%&W6W'f–æu6†–VÆB†Ööç7FW"ÆÖ÷VçB—°¢–b‚Ööç7FW"ÇÂÖöç7FW"æÆ—fR—²&WGW&â²Ğ¢6öç7B6†–VÆE&VÖ–æ–æs×7–æ4Ööç7FW%6†–VÆB†Ööç7FW"“°¢6öç7B6†–VÆCÖÖöç7FW"çcC6†–VÆC°¢6öç7B&6TÖƒ×6†–VÆBò6†–VÆBæ&6TÖ„…¢Ööç7FW"æÖ„…°¢6öç7B&6T‡×6†–VÆ@¢òÖF‚æÖ‚ƒÆÖöç7FW"æ‡×6†–VÆE&VÖ–æ–ær¢¢ÖF‚æÖ‚ƒÆÖöç7FW"æ‡“°¢6öç7B†VÆVCÔÖF‚æÖ‚ƒÄÖF‚æÖ–â„ÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’Æ&6TÖ‚Ö&6T‡’“°¢Ööç7FW"æ‡Ö&6T‡¶†VÆVB·6†–VÆE&VÖ–æ–æs°¢–b‡6†–VÆB—²6†–VÆBæ&6T‡Ö&6T‡¶†VÆVC²Ğ¢&WGW&â†VÆVC°¢Ğ ¢v–æF÷rçcCvWDÖöç7FW%6†–VÆE&VÖ–æ–æsÖvWDÖöç7FW%6†–VÆE&VÖ–æ–æs°¢v–æF÷rçcC7–æ4Ööç7FW%6†–VÆC×7–æ4Ööç7FW%6†–VÆC°¢v–æF÷rçcCÇ”Ööç7FW%6†–VÆCÖÇ”Ööç7FW%6†–VÆC°¢v–æF÷rçcC†VÄÖöç7FW%&W6W'f–æu6†–VÆCÖ†VÄÖöç7FW%&W6W'f–æu6†–VÆC° ¢–b‡G—Vöb6¶–ÆÄFF&6RÓÒ'VæFVf–æVB"—°¢–b‚6¶–ÆÄFF&6Rç—Vå†–ætwVætÖ–ær—°¢6¶–ÆÄFF&6Rç—Vå†–ætwVætÖ–æs×°¢–C¢'—Vå†–ætwVætÖ–ær"ÆæÖS¢.XX>y»XXiˆâ"ÆVÆVÖVçC¢&Æ–v‡B"À¢6FVv÷'“¢&†VÂ"ÇF&vWEG—S¢&ÆÇ”ÆÂ"ÆÖ„ÆWfVÃ£RÇ76÷7C£3RÆ&6T†VÃ£3SÀ¢FW67&—F–öã¢.h‰ikXZš¹NY¹î[ê“3S…8" ¢Ó°¢Ğ¢–b‚6¶–ÆÄFF&6Rç—VäwVæu6†–VÆB—°¢6¶–ÆÄFF&6Rç—VäwVæu6†–VÆC×°¢–C¢'—VäwVæu6†–VÆB"ÆæÖS¢.XX>XXŠÛ~š¹B"ÆVÆVÖVçC¢&Æ–v‡B"À¢6FVv÷'“¢&'Vfb"ÇF&vWEG—S¢&ÆÇ”ÆÂ"ÆÖ„ÆWfVÃ£RÇ76÷7C£CÀ¢6†–VÆDÖ÷VçC£#Ç6†–VÆDGW&F–öã£"À¢FW67&—F–öã¢.h‰ikXZš¹NxÛ.[és#ŠÛ~y»îûÈÎhÈ{¨Ã.Y¹îY8" ¢Ó°¢Ğ¢Ğ ¢ÆWBÆ7DÖöç7FW%6¶–ÆÄ'”–æFWƒÖæWrÖ‚“°¢6öç7B4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄSÓ#° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢&ö6VGW&ÂVF–ğ¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢6öç7BVF–ôVæv–æSÒ†gVæ7F–öâ‚—°¢ÆWB6öçFW‡CÖçVÆÃ°¢ÆWBÖ7FW#ÖçVÆÃ°¢6öç7B4´”ÄÅõdôÅTÔUõ44ÄSÓ#°¢6öç7B4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄSÓ#°¢ÆWBÆ–&6´v–å66ÆSÓ° ¢gVæ7F–öâVç7W&R‚—°¢–b†6öçFW‡B—°¢–b†6öçFW‡Bç7FFSÓÓÒ'7W7VæFVB"—²6öçFW‡Bç&W7VÖR‚’æ6F6‚‚‚“Óç·Ò“²Ğ¢&WGW&â6öçFW‡C°¢Ğ¢6öç7BVF–ô6öçFW‡D7F÷#×v–æF÷räVF–ô6öçFW‡GÇÇv–æF÷rçvV&¶—DVF–ô6öçFW‡C°¢–b‚VF–ô6öçFW‡D7F÷"—²&WGW&âçVÆÃ²Ğ¢6öçFW‡CÖæWrVF–ô6öçFW‡D7F÷"‚“°¢Ö7FW#Ö6öçFW‡Bæ7&VFTv–â‚“°¢Ö7FW"æv–âçfÇVSÓã3°¢Ö7FW"æ6öææV7B†6öçFW‡BæFW7F–æF–öâ“°¢&WGW&â6öçFW‡C°¢Ğ ¢gVæ7F–öâFöæR†g&WVVæ7’ÆGW&F–öâÆ÷F–öç2—°¢6öç7B7GƒÖVç7W&R‚“°¢–b‚7G‚ÇÂÖ7FW"—²&WGW&ã²Ğ¢6öç7B÷G3Ö÷F–öç7ÇÇ·Ó°¢6öç7Bæ÷sÖ7G‚æ7W'&VçEF–ÖR²„çVÖ&W"†÷G2æFVÆ’—ÇÃ“°¢6öç7B÷63Ö7G‚æ7&VFT÷66–ÆÆF÷"‚“°¢6öç7Bv–ãÖ7G‚æ7&VFTv–â‚“°¢÷62çG—SÖ÷G2çvfWÇÂ'6–æR#°¢÷62æg&WVVæ7’ç6WEfÇVTEF–ÖR„ÖF‚æÖ‚ƒ#Æg&WVVæ7’’Ææ÷r“°¢–b†÷G2çFò—²÷62æg&WVVæ7’æW‡öæVçF–Å&×FõfÇVTEF–ÖR„ÖF‚æÖ‚ƒ#Æ÷G2çFò’Ææ÷r¶GW&F–öâ“²Ğ¢v–âæv–âç6WEfÇVTEF–ÖRƒãÆæ÷r“°¢v–âæv–âæW‡öæVçF–Å&×FõfÇVTEF–ÖR„ÖF‚æÖ‚ƒãÂ„çVÖ&W"†÷G2çföÇVÖR—ÇÃãb’§Æ–&6´v–å66ÆR’Ææ÷r³ã"“°¢v–âæv–âæW‡öæVçF–Å&×FõfÇVTEF–ÖRƒãÆæ÷r¶GW&F–öâ“°¢÷62æ6öææV7B†v–â“²v–âæ6öææV7B†Ö7FW"“°¢÷62ç7F'B†æ÷r“²÷62ç7F÷†æ÷r¶GW&F–öâ³ã"“°¢Ğ ¢gVæ7F–öâæö—6R†GW&F–öâÆ÷F–öç2—°¢6öç7B7GƒÖVç7W&R‚“°¢–b‚7G‚ÇÂÖ7FW"—²&WGW&ã²Ğ¢6öç7B÷G3Ö÷F–öç7ÇÇ·Ó°¢6öç7BÆVæwFƒÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"†7G‚ç6×ÆU&FR¦GW&F–öâ’“°¢6öç7B'VffW#Ö7G‚æ7&VFT'VffW"ƒÆÆVæwF‚Æ7G‚ç6×ÆU&FR“°¢6öç7BFFÖ'VffW"ævWD6†ææVÄFFƒ“°¢f÷"†ÆWB“Ó¶“ÆÆVæwFƒ¶’²²—°¢6öç7BVçfVÆ÷SÓÖ’öÆVæwFƒ°¢FF¶•ÓÒ„ÖF‚ç&æFöÒ‚’£"Ó’¦VçfVÆ÷S°¢Ğ¢6öç7B6÷W&6SÖ7G‚æ7&VFT'VffW%6÷W&6R‚“°¢6öç7Bf–ÇFW#Ö7G‚æ7&VFT&—VDf–ÇFW"‚“°¢6öç7Bv–ãÖ7G‚æ7&VFTv–â‚“°¢f–ÇFW"çG—SÖ÷G2æf–ÇFW'ÇÂ&&æG72#°¢f–ÇFW"æg&WVVæ7’çfÇVSÔçVÖ&W"†÷G2æg&WVVæ7’—ÇÃ“°¢f–ÇFW"åçfÇVSÔçVÖ&W"†÷G2ç—ÇÃãƒ°¢v–âæv–âçfÇVSÒ„çVÖ&W"†÷G2çföÇVÖR—ÇÃãB’§Æ–&6´v–å66ÆS°¢6÷W&6Ræ'VffW#Ö'VffW#°¢6÷W&6Ræ6öææV7B†f–ÇFW"“²f–ÇFW"æ6öææV7B†v–â“²v–âæ6öææV7B†Ö7FW"“°¢6÷W&6Rç7F'B†7G‚æ7W'&VçEF–ÖR²„çVÖ&W"†÷G2æFVÆ’—ÇÃ’“°¢Ğ ¢gVæ7F–öâÆ’†¶–æBÇföÇVÖU66ÆR—°¢6öç7B&Wf–÷W566ÆS×Æ–&6´v–å66ÆS°¢6öç7B&WVW7FVE66ÆSÔçVÖ&W"‡föÇVÖU66ÆR“°¢Æ–&6´v–å66ÆSÔçVÖ&W"æ—4f–æ—FR‡&WVW7FVE66ÆR’bg&WVW7FVE66ÆSã÷&WVW7FVE66ÆS£°¢G'—°¢7v—F6‚†¶–æB—°¢66R'7v–ær#¢æö—6R‚ãBÇ¶g&WVVæ7“£#ÇföÇVÖS¢ãWÒ“²FöæRƒS#Âã2Ç·Fó£ƒÇvfS¢'6wFö÷F‚"ÇföÇVÖS¢ãwÒ“²'&V³°¢66R&†—B#¢æö—6R‚ã"Ç¶g&WVVæ7“£#cÇföÇVÖS¢ã#'Ò“²FöæRƒÂãBÇ·Fó£SRÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ã‡Ò“²'&V³°¢66R&FÖvR#¢æö—6R‚ãRÇ¶g&WVVæ7“£3CÇföÇVÖS¢ã'Ò“²FöæRƒCRÂã‚Ç·Fó£c"ÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ãGÒ“²'&V³°¢66R&†Vg’#¢æö—6R‚ã#‚Ç¶g&WVVæ7“£sÇföÇVÖS¢ã#WÒ“²FöæRƒƒRÂã3"Ç·Fó£3‚ÇvfS¢'6–æR"ÇföÇVÖS¢ã#WÒ“²'&V³°¢66R&7&—B#¢FöæRƒsƒÂã"Ç·Fó£ScÇvfS¢'7V&R"ÇföÇVÖS¢ã'Ò“²æö—6R‚ã#"Ç¶g&WVVæ7“£ƒÇföÇVÖS¢ã#"ÆFVÆ“¢ãWÒ“²'&V³°¢66R&&Æö6²#¢FöæRƒ“#ÂãÇ·Fó£3“ÇvfS¢'7V&R"ÇföÇVÖS¢ãÒ“²æö—6R‚ã2Ç¶g&WVVæ7“£“ÇföÇVÖS¢ã7Ò“²'&V³°¢66R&FöFvR#¢æö—6R‚ã"Ç¶f–ÇFW#¢&†–v‡72"Æg&WVVæ7“£##ÇföÇVÖS¢ãÒ“²FöæRƒSÂãRÇ·Fó£S#ÇvfS¢'6–æR"ÇföÇVÖS¢ãWÒ“²'&V³°¢66R&Öv–2#¢FöæRƒ#CÂã3BÇ·Fó£“#ÇvfS¢'6–æR"ÇföÇVÖS¢ã'Ò“²FöæRƒCƒÂã#‚Ç·Fó£#ƒÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ã‚ÆFVÆ“¢ãGÒ“²'&V³°¢66R&6†&vR#¢FöæRƒ“RÂãSRÇ·Fó£c#ÇvfS¢'6wFö÷F‚"ÇföÇVÖS¢ã‡Ò“²'&V³°¢66R&W‡Æ÷6–öâ#¢æö—6R‚ã3‚Ç¶f–ÇFW#¢&Æ÷w72"Æg&WVVæ7“£CƒÇföÇVÖS¢ã#gÒ“²FöæRƒ“"Âã3BÇ·Fó£3RÇvfS¢'7V&R"ÇföÇVÖS¢ã‡Ò“²'&V³°¢66R&f—&R#¢æö—6R‚ãC"Ç¶g&WVVæ7“£c#ÇföÇVÖS¢ã‡Ò“²FöæRƒ#Âã3bÇ·Fó£CRÇvfS¢'6wFö÷F‚"ÇföÇVÖS¢ã"ÆFVÆ“¢ãgÒ“²'&V³°¢66R&–6R#¢FöæRƒCƒÂã#RÇ·Fó£C#ÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ã'Ò“²æö—6R‚ã#RÇ¶g&WVVæ7“£#3ÇföÇVÖS¢ãbÆFVÆ“¢ãgÒ“²'&V³°¢66R'vFW"#¢æö—6R‚ãC‚Ç¶f–ÇFW#¢&Æ÷w72"Æg&WVVæ7“£ÇföÇVÖS¢ã7Ò“²FöæRƒ33ÂãC"Ç·Fó£“ÇvfS¢'6–æR"ÇföÇVÖS¢ã—Ò“²'&V³°¢66R'v–æB#¢æö—6R‚ã3‚Ç¶f–ÇFW#¢&†–v‡72"Æg&WVVæ7“£SÇföÇVÖS¢ãGÒ“²FöæRƒ“Âã#RÇ·Fó£#cÇvfS¢'6–æR"ÇföÇVÖS¢ãgÒ“²'&V³°¢66R&V'F‚#¢FöæRƒs"Âã3bÇ·Fó£3‚ÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ã#7Ò“²æö—6R‚ã2Ç¶g&WVVæ7“£#ÇföÇVÖS¢ã#'Ò“²'&V³°¢66R&'Vfb#¢FöæRƒ3“Âã3BÇ·Fó£scÇvfS¢'6–æR"ÇföÇVÖS¢ãÒ“²FöæRƒS“Âã3"Ç·Fó£“ƒÇvfS¢'6–æR"ÇföÇVÖS¢ã‚ÆFVÆ“¢ã‡Ò“²'&V³°¢66R&FV'Vfb#¢FöæRƒ3CÂã3‚Ç·Fó£“RÇvfS¢'6wFö÷F‚"ÇföÇVÖS¢ãÒ“²'&V³°¢66R'6†–VÆB#¢FöæRƒ##Âã3‚Ç·Fó£ccÇvfS¢'6–æR"ÇföÇVÖS¢ã'Ò“²FöæRƒƒƒÂã#BÇ·Fó£CCÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ã‚ÆFVÆ“¢ã‡Ò“²'&V³°¢66R&†VÂ#¢FöæRƒCCÂãCbÇ·Fó£ƒƒÇvfS¢'6–æR"ÇföÇVÖS¢ã'Ò“²FöæRƒccÂã3‚Ç·Fó£ÇvfS¢'6–æR"ÇföÇVÖS¢ã‚ÆFVÆ“¢ãÒ“²'&V³°¢66R'&Wf—fR#¢FöæRƒ##ÂãcRÇ·Fó£ƒƒÇvfS¢'6–æR"ÇföÇVÖS¢ãGÒ“²FöæRƒCCÂãc"Ç·Fó£3#ÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ã’ÆFVÆ“¢ã‡Ò“²'&V³°¢66R&&÷72#¢FöæRƒS‚Âã3‚Ç·Fó£3BÇvfS¢'6wFö÷F‚"ÇföÇVÖS¢ã‡Ò“²'&V³°¢66R&Ööç7FW"#¢FöæRƒ#RÂã’Ç·Fó£s"ÇvfS¢'G&–ævÆR"ÇföÇVÖS¢ãÒ“²'&V³°¢66R&FVF‚#¢FöæRƒcÂãRÇ·Fó£C"ÇvfS¢'6wFö÷F‚"ÇföÇVÖS¢ã‡Ò“²æö—6R‚ã3"Ç¶g&WVVæ7“£“ÇföÇVÖS¢ãgÒ“²'&V³°¢Ğ¢Öf–æÆÇ—°¢Æ–&6´v–å66ÆS×&Wf–÷W566ÆS°¢Ğ¢Ğ ¢gVæ7F–öâÆ•6¶–ÆÂ‡6¶–ÆÂÆæÖR—°¢6öç7BÆ&VÃÕ7G&–ær†æÖWÇÇ6¶–ÆÂbg6¶–ÆÂææÖWÇÂ""“°¢–b†Æ&VÃÓÓÒ.išî˜	®iK¾i8¢"—²Æ’‚'7v–ær"Å4´”ÄÅõdôÅTÔUõ44ÄR“²6WEF–ÖV÷WB‚‚“ÓçÆ’‚&†—B"Å4´”ÄÅõdôÅTÔUõ44ÄR’ÃSR“²&WGW&ã²Ğ¢–b‚6¶–ÆÂ—²Æ’‚&†—B"Å4´”ÄÅõdôÅTÔUõ44ÄR“²&WGW&ã²Ğ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"—²Æ’‚&†VÂ"Å4´”ÄÅõdôÅTÔUõ44ÄR“²&WGW&ã²Ğ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"—²Æ’‚'&Wf—fR"Å4´”ÄÅõdôÅTÔUõ44ÄR“²&WGW&ã²Ğ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"—°¢Æ’‚şy»çÎŠÛ~š¹GÎ{YyXÂòçFW7B†Æ&VÂ“ò'6†–VÆB#¢&'Vfb"Å4´”ÄÅõdôÅTÔUõ44ÄR“°¢&WGW&ã°¢Ğ¢Æ’‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'‡—6–6Â#ò'7v–ær#¢&Öv–2"Å4´”ÄÅõdôÅTÔUõ44ÄR“°¢6WEF–ÖV÷WB‚‚“Óç°¢6öç7BVÆVÖVçD¶–æC×¶f—&S¢&f—&R"ÇvFW#¢'vFW""Çv–æC¢'v–æB"ÆV'Fƒ¢&V'F‚"ÆÆ–v‡C¢&'Vfb'Õ·6¶–ÆÂæVÆVÖVçEÓ°¢–b†VÆVÖVçD¶–æB—²Æ’†VÆVÖVçD¶–æBÅ4´”ÄÅõdôÅTÔUõ44ÄR“²Ğ¢–b‚şxˆgÎx+‡Î›;7Î›èÒòçFW7B†Æ&VÂ’—²6WEF–ÖV÷WB‚‚“ÓçÆ’‚&W‡Æ÷6–öâ"Å4´”ÄÅõdôÅTÔUõ44ÄR’ÃCR“²Ğ¢VÇ6W²Æ’‚ş˜x×ÎŠ8'ÎxÉ·ÎzBòçFW7B†Æ&VÂ“ò&†Vg’#¢&†—B"Å4´”ÄÅõdôÅTÔUõ44ÄR“²Ğ¢ÒÃcR“°¢Ğ ¢&WGW&â¶Vç7W&RÇÆ’ÇÆ•6¶–ÆÂÇ6¶–ÆÅföÇVÖU66ÆS¥4´”ÄÅõdôÅTÔUõ44ÄRÆ6öÖ&DfVVF&6µföÇVÖU66ÆS¤4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄWÓ°¢Ò’‚“°¢v–æF÷rçcCVF–óÖVF–ôVæv–æS°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"Â‚“ÓæVF–ôVæv–æRæVç7W&R‚’Ç¶öæ6S§G'VRÇ76—fS§G'VWÒ“° ¢–b‡G—Vöb6†÷u6¶–ÆÄæÖT&FvSÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷u6¶–ÆÄæÖT&FvS×6†÷u6¶–ÆÄæÖT&FvS°¢ÆWBÆ7EVW7E6¶–ÆÄ¶W“Ò"#°¢6†÷u6¶–ÆÄæÖT&FvSÖgVæ7F–öâ‡6¶–ÆÄæÖRÆVÆVÖVçEG—RÆ6†&7FW$–æFW‚—°¢6öç7B&W7VÇCÖ÷&–v–æÅ6†÷u6¶–ÆÄæÖT&FvRæÇ’‡F†—2Æ&wVÖVçG2“°¢6öç7B6¶–ÆÃÔö&¦V7BçfÇVW2‡6¶–ÆÄFF&6R’æf–æB†FFÓæFFbfFFææÖSÓÓ×6¶–ÆÄæÖR—ÇÆçVÆÃ°¢VF–ôVæv–æRçÆ•6¶–ÆÂ‡6¶–ÆÂÇ6¶–ÆÄæÖR“°¢–b†&GFÆT7F—fRbb6¶–ÆÄæÖRÓÒ.išî˜	®iK¾i8¢"—°¢6öç7B¶W“Õ¶&GFÆUFö¶VâÇGW&âÇG—Vöb–æ—F–F—fT–æFW‚ÓÒ'VæFVf–æVB#ö–æ—F–F—fT–æFWƒ£Æ6†&7FW$–æFW‚Ç6¶–ÆÄæÖUÒæ¦ö–â‚#¢"“°¢–b†¶W’ÓÖÆ7EVW7E6¶–ÆÄ¶W’—°¢Æ7EVW7E6¶–ÆÄ¶W“Ö¶W“°¢&V6÷&EVW7E&öw&W72‚'6¶–ÆÇ3R"ÃÂ&F–Ç’"“°¢&V6÷&EVW7E&öw&W72‚'6¶–ÆÇ3R"ÃÂ&6öÖÖ—76–öâ"“°¢Ğ¢Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b‡G—Vöb6†÷tÖöç7FW%6¶–ÆÄæÖT&FvSÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷tÖöç7FW%6¶–ÆÄæÖT&FvS×6†÷tÖöç7FW%6¶–ÆÄæÖT&FvS°¢6†÷tÖöç7FW%6¶–ÆÄæÖT&FvSÖgVæ7F–öâ‡6¶–ÆÄæÖRÆVÆVÖVçEG—RÆÖöç7FW$–æFW‚—°¢6öç7B6¶–ÆÄ–CÔö&¦V7Bæ¶W—2‡6¶–ÆÄFF&6R’æf–æB†–CÓç6¶–ÆÄFF&6U¶–EÒbg6¶–ÆÄFF&6U¶–EÒææÖSÓÓ×6¶–ÆÄæÖR—ÇÆçVÆÃ°¢–b‡6¶–ÆÄ–B—²Æ7DÖöç7FW%6¶–ÆÄ'”–æFW‚ç6WB†Ööç7FW$–æFW‚Ç6¶–ÆÄ–B“²Ğ¢VF–ôVæv–æRçÆ•6¶–ÆÂ‡6¶–ÆÄ–C÷6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ¦çVÆÂÇ6¶–ÆÄæÖR“°¢6öç7BÖöç7FW#×G—VöbÖöç7FW'2ÓÒ'VæFVf–æVB#öÖöç7FW'5¶Ööç7FW$–æFW…Ó¦çVÆÃ°¢–b†Ööç7FW"bgG—VöbvWDÖöç7FW%&æ³ÓÓÒ&gVæ7F–öâ"bfvWDÖöç7FW%&æ²†Ööç7FW"“ÓÓÒ&&÷72"—°¢6WEF–ÖV÷WB‚‚“ÓæVF–ôVæv–æRçÆ’‚&&÷72"Ä4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄR’Ã#‚“°¢Ğ¢&WGW&â÷&–v–æÅ6†÷tÖöç7FW%6¶–ÆÄæÖT&FvRæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡G—Vöb6†÷tÖ—74VffV7CÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷tÖ—74VffV7C×6†÷tÖ—74VffV7C°¢6†÷tÖ—74VffV7CÖgVæ7F–öâ‚—°¢VF–ôVæv–æRçÆ’‚&FöFvR"Ä4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄR“°¢&WGW&â÷&–v–æÅ6†÷tÖ—74VffV7BæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡G—Vöb6†÷u6†–VÆD'6÷&#ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷u6†–VÆD'6÷&#×6†÷u6†–VÆD'6÷&#°¢6†÷u6†–VÆD'6÷&#ÖgVæ7F–öâ‚—°¢VF–ôVæv–æRçÆ’‚&&Æö6²"Ä4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄR“°¢&WGW&â÷&–v–æÅ6†÷u6†–VÆD'6÷&"æÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡G—Vöb6†÷tÖöç7FW$†—CÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷tÖöç7FW$†—C×6†÷tÖöç7FW$†—C°¢6†÷tÖöç7FW$†—CÖgVæ7F–öâ†–æFW‚ÆÖ÷VçBÇG—RÆ—47&—B—°¢–b‡G—SÓÓÒ&‡"bdçVÖ&W"†Ö÷VçB“ã—²VF–ôVæv–æRçÆ’†—47&—Cò&7&—B#¢&FÖvR"Ä4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄR“²Ğ¢&WGW&â÷&–v–æÅ6†÷tÖöç7FW$†—BæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢–b‡G—Vöb6†÷uÆ–W$†—CÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷uÆ–W$†—C×6†÷uÆ–W$†—C°¢6†÷uÆ–W$†—CÖgVæ7F–öâ†Ö÷VçBÇG—RÆ–æFW‚Æ—5÷6—F—fRÆ—47&—B—°¢–b‡G—SÓÓÒ&‡"bdçVÖ&W"†Ö÷VçB“ã—²VF–ôVæv–æRçÆ’†—47&—Cò&7&—B#¢&FÖvR"Ä4ôÔ$EôdTTD$4µõdôÅTÔUõ44ÄR“²Ğ¢&WGW&â÷&–v–æÅ6†÷uÆ–W$†—BæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢gVæ7F–öâÇ”Ööç7FW%6¶–ÆÅ6†–VÆB†Ööç7FW$–æFW‚Ç6¶–ÆÄ–BÆÆWfVÂ—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢6öç7B67FW#ÖÖöç7FW'5¶Ööç7FW$–æFW…Ó°¢–b‚6¶–ÆÂÇÂ67FW"ÇÂ67FW"æÆ—fR—²&WGW&ã²Ğ¢6öç7B6fTÆWfVÃÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡6¶–ÆÂæÖ„ÆWfVÇÇÃÄÖF‚æfÆö÷"„çVÖ&W"†ÆWfVÂ—ÇÃ’’“°¢–b‡6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÂ—°¢6öç7BÖ÷VçC×6¶–ÆÂç6VÆe6†–VÆD'”ÆWfVÅ·6fTÆWfVÂÓÓ°¢Ç”Ööç7FW%6†–VÆB†67FW"ÆÖ÷VçBÇ6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"“°¢FD&GFÆTÆör†67FW"ææÖR².xÛ.[ér"¶Ö÷VçB².›¹îŠÛ~y»î8""“°¢Ğ¢–b‡6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÂ—°¢6öç7BÖ÷VçC×6¶–ÆÂæÆÇ•6†–VÆD'”ÆWfVÅ·6fTÆWfVÂÓÓ°¢7W'&VçD&GFÆTÖöç7FW'2æf÷$V6‚†–æFWƒÓç°¢6öç7BÆÇ“ÖÖöç7FW'5¶–æFW…Ó°¢–b†ÆÇ’bfÆÇ’æÆ—fR—²Ç”Ööç7FW%6†–VÆB†ÆÇ’ÆÖ÷VçBÇ6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"“²Ğ¢Ò“°¢FD&GFÆTÆör‚.i[^ikXZš¹NxÛ.[ér"¶Ö÷VçB².›¹îŠÛ~y»îûÈÎhÈ{¨Â"²‡6¶–ÆÂç6†–VÆDGW&F–öçÇÃ"’².Y¹îY8""“°¢Ğ¢Ğ ¢gVæ7F–öâ7W÷'DÖöç7FW$7F–öâ†Ööç7FW$–æFW‚—°¢6öç7BÖöç7FW#ÖÖöç7FW'5¶Ööç7FW$–æFW…Ó°¢–b‚Ööç7FW"ÇÂÖöç7FW"æÆ—fR—²f–æ—6…Æ–W$7F–öâ‚“²&WGW&ã²Ğ¢–b‚‡G—Vöb—4Ööç7FW$g&÷¦VãÓÓÒ&gVæ7F–öâ"bf—4Ööç7FW$g&÷¦Vâ†Ööç7FW"’’ÇÀ¢‡G—Vöb—4Ööç7FW%WG&–f–VCÓÓÒ&gVæ7F–öâ"bf—4Ööç7FW%WG&–f–VB†Ööç7FW"’’—°¢&WGW&âçVÆÃ°¢Ğ¢6öç7BÆÆ–W3Ö7W'&VçD&GFÆTÖöç7FW'2æÖ†–æFWƒÓæÖöç7FW'5¶–æFW…Ò’æf–ÇFW"†ÆÇ“ÓæÆÇ’bfÆÇ’æÆ—fR“°¢6öç7B–æ§W&VCÖÆÆ–W2æf–ÇFW"†ÆÇ“Óç°¢6öç7B6†–VÆCÖvWDÖöç7FW%6†–VÆE&VÖ–æ–ær†ÆÇ’“°¢6öç7BÖƒÖÆÇ’çcC6†–VÆCöÆÇ’çcC6†–VÆBæ&6TÖ„…¦ÆÇ’æÖ„…°¢&WGW&âÖF‚æÖ‚ƒÆÆÇ’æ‡×6†–VÆB“ÆÖƒ°¢Ò“°¢6öç7B7W÷'D–G3×G—Vöbv–æF÷rçcCDvWDÆVvÄÖöç7FW%6¶–ÆÄ–G3ÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcCDvWDÆVvÄÖöç7FW%6¶–ÆÄ–G2†Ööç7FW"Â'7W÷'B"¢¢†Ööç7FW"çcC7W÷'E6¶–ÆÄ–G7ÇÅµÒ’æf–ÇFW"†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢&WGW&â‡6¶–ÆÂbg6¶–ÆÂæVÆVÖVçBbg6¶–ÆÂæVÆVÖVçCÓÓÖÖöç7FW"æVÆVÖVçB“°¢Ò“°¢6öç7B†VÅ6¶–ÆÃ×7W÷'D–G2æ–æ6ÇVFW2‚'—Vå†–ætwVætÖ–ær"“÷6¶–ÆÄFF&6Rç—Vå†–ætwVætÖ–æs¦çVÆÃ°¢6öç7B6†–VÆE6¶–ÆÃ×7W÷'D–G2æ–æ6ÇVFW2‚'—VäwVæu6†–VÆB"“÷6¶–ÆÄFF&6Rç—VäwVæu6†–VÆC¦çVÆÃ° ¢–b††VÅ6¶–ÆÂbf–æ§W&VBæÆVæwFƒãbbÖöç7FW"ç7ãÖ†VÅ6¶–ÆÂç76÷7B—°¢Ööç7FW"ç7ÓÖ†VÅ6¶–ÆÂç76÷7C°¢6†÷tÖöç7FW%6¶–ÆÄæÖT&FvR††VÅ6¶–ÆÂææÖRÂ&Æ–v‡B"ÆÖöç7FW$–æFW‚“°¢ÆWBF÷FÃÓ°¢ÆÆ–W2æf÷$V6‚†ÆÇ“Óç²F÷FÂ³Ö†VÄÖöç7FW%&W6W'f–æu6†–VÆB†ÆÇ’Ã3S“²Ò“°¢FD&GFÆTÆör†Ööç7FW"ææÖR².ikŞiKîXX>y»XXiˆîûÈÎi[^ikXZš¹NX[Y¹î[ê’"·F÷FÂ²"…8""“°¢WFFUT’‚“°¢f–æ—6…Æ–W$7F–öâ‚“°¢&WGW&âG'VS°¢Ğ ¢–b‡6†–VÆE6¶–ÆÂbfÆÆ–W2ç6öÖR†ÆÇ“ÓævWDÖöç7FW%6†–VÆE&VÖ–æ–ær†ÆÇ’“ÃÓ’bbÖöç7FW"ç7ã×6†–VÆE6¶–ÆÂç76÷7B—°¢Ööç7FW"ç7Ó×6†–VÆE6¶–ÆÂç76÷7C°¢6†÷tÖöç7FW%6¶–ÆÄæÖT&FvR‡6†–VÆE6¶–ÆÂææÖRÂ&Æ–v‡B"ÆÖöç7FW$–æFW‚“°¢ÆÆ–W2æf÷$V6‚†ÆÇ“ÓæÇ”Ööç7FW%6†–VÆB†ÆÇ’Ã#Ã"’“°¢FD&GFÆTÆör†Ööç7FW"ææÖR².ikŞiKîXX>XXŠÛ~š¹NûÈÎi[^ikXZš¹NxÛ.[és#ŠÛ~y»îûÈÎhÈ{¨Ã.Y¹îY8""“°¢WFFUT’‚“°¢f–æ—6…Æ–W$7F–öâ‚“°¢&WGW&âG'VS°¢Ğ¢&WGW&âfÇ6S°¢Ğ ¢–b‡G—Vöb&ö6W756–ævÆTÖöç7FW$GF6³ÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ&ö6W756–ævÆTÖöç7FW$GF6³×&ö6W756–ævÆTÖöç7FW$GF6³°¢&ö6W756–ævÆTÖöç7FW$GF6³ÖgVæ7F–öâ†Ööç7FW$–æFW‚ÇFö¶Vâ—°¢6öç7BÖöç7FW#ÖÖöç7FW'5¶Ööç7FW$–æFW…Ó°¢–b†Ööç7FW"bgG—Vöbv–æF÷rçcCDæ÷&ÖÆ—¦TÖöç7FW%6¶–ÆÄÆöF÷WCÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcCDæ÷&ÖÆ—¦TÖöç7FW%6¶–ÆÄÆöF÷WB†Ööç7FW"“°¢Ğ¢–b€¢Ööç7FW"bd'&’æ—4'&’†Ööç7FW"çcC7W÷'E6¶–ÆÄ–G2’bfÖöç7FW"çcC7W÷'E6¶–ÆÄ–G2æÆVæwFƒãb`¢G—Vöbv–æF÷rçcCG'”Ööç7FW%7V6–Ä7F–öãÓÓÒ&gVæ7F–öâ ¢—°¢6öç7B†æFÆVC×v–æF÷rçcCG'”Ööç7FW%7V6–Ä7F–öâ†Ööç7FW$–æFW‚ÇFö¶Vâ“°¢–b††æFÆVCÓÓ×G'VR—²&WGW&ã²Ğ¢Ğ¢–b†Ööç7FW"bfÖöç7FW"çcC'—74“ÓÓÒ'7W÷'B"—°¢6öç7B7W÷'E&W7VÇC×7W÷'DÖöç7FW$7F–öâ†Ööç7FW$–æFW‚“°¢–b‡7W÷'E&W7VÇBÓÖfÇ6Rbb7W÷'E&W7VÇBÓÖçVÆÂ—²&WGW&â7W÷'E&W7VÇC²Ğ¢–b‡7W÷'E&W7VÇCÓÓÖçVÆÂ—²&WGW&â÷&–v–æÅ&ö6W756–ævÆTÖöç7FW$GF6²æÇ’‡F†—2Æ&wVÖVçG2“²Ğ¢Ğ ¢–b‚Ööç7FW"—²&WGW&â÷&–v–æÅ&ö6W756–ævÆTÖöç7FW$GF6²æÇ’‡F†—2Æ&wVÖVçG2“²Ğ¢Æ7DÖöç7FW%6¶–ÆÄ'”–æFW‚æFVÆWFR†Ööç7FW$–æFW‚“°¢6öç7Bf÷&6VDÆWfVÃÖÖöç7FW"çcCf÷&6U6¶–ÆÄÆWfVÇÇÆÖöç7FW"çcC6¶–ÆÄÆWfVÇÇÆvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÂ†Ööç7FW"æÆWfVÂ“°¢6öç7B&6·W3ÕµÓ°¢†Ööç7FW"ç6¶–ÆÄ–G7ÇÅµÒ’æf÷$V6‚†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢–b‚6¶–ÆÂ—²&WGW&ã²Ğ¢&6·W2çW6‚…·6¶–ÆÂÇ6¶–ÆÂæÖ„ÆWfVÅÒ“°¢6¶–ÆÂæÖ„ÆWfVÃÔÖF‚æÖ–â„ÖF‚æÖ‚ƒÆf÷&6VDÆWfVÂ’ÄÖF‚æÖ‚ƒÇ6¶–ÆÂæÖ„ÆWfVÇÇÃ’“°¢Ò“° ¢ÆWB&W7VÇC°¢G'—²&W7VÇCÖ÷&–v–æÅ&ö6W756–ævÆTÖöç7FW$GF6²æÇ’‡F†—2Æ&wVÖVçG2“²Ğ¢f–æÆÇ—²&6·W2æf÷$V6‚‚…·6¶–ÆÂÆÖ„ÆWfVÅÒ“Óç²6¶–ÆÂæÖ„ÆWfVÃÖÖ„ÆWfVÃ²Ò“²Ğ ¢6öç7B67E6¶–ÆÄ–CÖÆ7DÖöç7FW%6¶–ÆÄ'”–æFW‚ævWB†Ööç7FW$–æFW‚“°¢–b†67E6¶–ÆÄ–B—°¢Ç”Ööç7FW%6¶–ÆÅ6†–VÆB†Ööç7FW$–æFW‚Æ67E6¶–ÆÄ–BÆf÷&6VDÆWfVÂ“°¢–b‡G—VöbWFFUT“ÓÓÒ&gVæ7F–öâ"—²WFFUT’‚“²Ğ¢Ğ¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b€¢v–æF÷räf÷W%7–Ö&öÇ4GW&F–öäÆ–fV7–6ÆRbkZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^
        typeof window.FourSymbolsDurationLifecycle.registerBuffExpiryHandler==="function"
    ){
        window.FourSymbolsDurationLifecycle.registerBuffExpiryHandler(({entity,buff})=>{
            if(entity&&entity.v141Shield===buff){
                removeMonsterShield(entity);
                return true;
            }
            return false;
        });
    }

    /* =====================================================
       Elite single-roll drops + quest progress    /* =====================================================
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
            addBattleLog(monster.name+"å‡ºç¾ç‰¹æ®Šæ‰è½ï¼Œä½†èƒŒåŒ…å·²æ»¿ï¼Œæœªèƒ½æ”¾å…¥ã€‚");
            return null;
        }
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        addBattleLog(monster.name+"æ‰è½äº†"+definition.name+"Ã—1ã€‚");
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
        {id:"kill10",name:"æ¸…æƒå‘¨é‚Š",desc:"ä»Šå¤©ç´¯è¨ˆæ“Šæ•—10éš»æ€ªç‰©",goal:10,reward:{gold:130,exp:60}},
        {id:"win3",name:"é€£æˆ°ä¸‰å ´",desc:"ä»Šå¤©æ‰“è´3å ´æˆ°é¬¥",goal:3,reward:{gold:120,exp:80}},
        {id:"skills5",name:"ç†Ÿç·´æ‹›å¼",desc:"ä»Šå¤©åœ¨æˆ°é¬¥ä¸­æ–½æ”¾5æ¬¡æŠ€èƒ½",goal:5,reward:{gold:90}}
    ];
    const extraCommissionQuests=[
        {id:"kill30",name:"å§”è¨—ï¼šè¨ä¼30éš»æ€ªç‰©",desc:"ä»Šå¤©ç´¯è¨ˆæ“Šæ•—30éš»æ€ªç‰©",goal:30,reward:{gold:350,exp:180}},
        {id:"win5",name:"å§”è¨—ï¼šäº”æˆ°å‘Šæ·",desc:"ä»Šå¤©æ‰“è´5å ´æˆ°é¬¥",goal:5,reward:{gold:300,exp:220}},
        {id:"elite2",name:"å§”è¨—ï¼šç²¾è‹±çµæ‰‹",desc:"ä»Šå¤©æ“Šæ•—2éš»ç²¾è‹±æ€ª",goal:2,reward:{gold:260,exp:120}},
        {id:"skills15",name:"å§”è¨—ï¼šæ‹›å¼æ¼”ç·´",desc:"ä»Šå¤©åœ¨æˆ°é¬¥ä¸­æ–½æ”¾15æ¬¡æŠ€èƒ½",goal:15,reward:{gold:220,exp:150}}
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
        {id:"kill500",name:"ç™¾æˆ°ä¸æ®†",desc:"ç´¯è¨ˆæ“Šæ•—500éš»æ€ªç‰©",reward:{gold:500},check:()=>getTotalMonsterKills()>=500},
        {id:"kill1000",name:"åƒè»è¾Ÿæ˜“",desc:"ç´¯è¨ˆæ“Šæ•—1000éš»æ€ªç‰©",reward:{gold:900},check:()=>getTotalMonsterKills()>=1000},
        {id:"elite10",name:"ç²¾è‹±å‰‹æ˜Ÿ",desc:"ç´¯è¨ˆæ“Šæ•—10éš»ç²¾è‹±æ€ª",reward:{gold:300},check:()=>accountProgress.eliteKills>=10},
        {id:"elite50",name:"ç²¾è‹±çµ‚çµè€…",desc:"ç´¯è¨ˆæ“Šæ•—50éš»ç²¾è‹±æ€ª",reward:{gold:800},check:()=>accountProgress.eliteKills>=50},
        {id:"level30",name:"è¡Œèµ°æ±Ÿæ¹–",desc:"ä»»ä¸€è§’è‰²é”åˆ°30ç´š",reward:{gold:250},check:()=>highestLevelAtLeast(30)},
        {id:"level60",name:"ä¸€ä»£å®—å¸«",desc:"ä»»ä¸€è§’è‰²é”åˆ°60ç´š",reward:{gold:650},check:()=>highestLevelAtLeast(60)},
        {id:"level80",name:"ç™»å³°é€ æ¥µ",desc:"ä»»ä¸€è§’è‰²é”åˆ°80ç´š",reward:{gold:1000},check:()=>highestLevelAtLeast(80)},
        {id:"level100",name:"ç™¾ç´šå‚³èªª",desc:"ä»»ä¸€è§’è‰²é”åˆ°100ç´š",reward:{gold:1800},check:()=>highestLevelAtLeast(100)},
        {id:"gold5000",name:"ç©å°‘æˆå¤š",desc:"æŒæœ‰é‡‘å¹£é”åˆ°5,000",reward:{gold:250},check:()=>gold>=5000},
        {id:"gold20000",name:"å¯Œç”²ä¸€æ–¹",desc:"æŒæœ‰é‡‘å¹£é”åˆ°20,000",reward:{gold:700},check:()=>gold>=20000}
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
   V141 â€” mobile UI and battle presentation
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
       Backpack: 18 slots Ã— 7 pages (the final page keeps the 120-slot cap)
    ===================================================== */
    function ensureInventoryPager(){
        const scroller=document.getElementById("inventoryGridScroll");
        if(!scroller||document.getElementById("v141InventoryPager")){ return; }
        const pager=document.createElement("div");
        pager.id="v141InventoryPager";
        pager.className="v141-inventory-pager";
        pager.innerHTML=
            '<button type="button" aria-label="ä¸Šä¸€é " onclick="v141ChangeInventoryPage(-1)">â†</button>'+
            '<span id="v141InventoryPageLabel">1 / 7</span>'+
            '<button type="button" aria-label="ä¸‹ä¸€é " onclick="v141ChangeInventoryPage(1)">â†’</button>';
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
                        '<div class="inventory-icon">'+(item.icon||"â—†")+'</div>'+
                        '<div class="inventory-count">'+((Number(item.count)||0)>1?"Ã—"+item.count:"")+'</div>';
                    const realIndex=inventoryItems.indexOf(item);
                    box.onclick=()=>openItemModal(realIndex);
                    box.setAttribute("aria-label",item.name||"èƒŒåŒ…ç‰©å“");
                }else{
                    box.innerHTML='<div class="inventory-empty-dot">Â·</div>';
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
                '<button type="button" class="inventory-character-arrow" aria-label="ä¸Šä¸€å€‹è§’è‰²" onclick="changeInventoryCharacter(-1)">â€¹</button>'+
                '<div class="inventory-character-name"><span>'+escapeHtml(character&&character.id||"è§’è‰²")+'</span>'+
                '<small class="inventory-character-level">'+(character?"Lv."+(character.level||1):"å°šæœªå»ºç«‹")+'</small></div>'+
                '<button type="button" class="inventory-character-arrow" aria-label="ä¸‹ä¸€å€‹è§’è‰²" onclick="changeInventoryCharacter(1)">â€º</button>';
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
                '<section class="v141-item-reforge"><b>ã€å†¶ç…‰ã€‘</b>'+getStatText(item.reforgeStats)+'</section>'
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
        button.textContent="åˆ†è§£æˆ10ç¢ç‰‡";
        button.onclick=()=>{
            if(typeof window.v141DecomposeSeriesItem==="function"){
                window.v141DecomposeSeriesItem(slotIndex);
            }
        };
    }


    /* V173.42 â€” backpack potion use follows the currently selected backpack character. */
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
        button.textContent="ä½¿ç”¨";
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
            alert((character.id||"è§’è‰²")+(resource==="hp"?" HP":" SP")+"ç›®å‰ä¸éœ€è¦è£œå……ã€‚");
            return false;
        }
        if(typeof consumePotionFromInventory!=="function"||!consumePotionFromInventory(definition.id,1)){
            alert(definition.name+"æ•¸é‡ä¸è¶³ã€‚");
            return false;
        }
        const planned=definition.recoveryPercent>=100
            ?maxValue-currentValue
            :Math.max(1,Math.round(maxValue*Number(defµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥æ–æ—F–öâç&V6÷fW'•W&6VçGÇÃ’ó’“°¢6öç7B&V6÷fW&VCÔÖF‚æÖ‚ƒÄÖF‚æÖ–â†Ö…fÇVRÖ7W'&VçEfÇVRÇÆææVB’“°¢6†&7FW%·&W6÷W&6UÓÔÖF‚æÖ–â†Ö…fÇVRÆ7W'&VçEfÇVR·&V6÷fW&VB“°¢–b‡G—Vöb&V'V–ÆD–çfVçF÷'•6Æ÷G3ÓÓÒ&gVæ7F–öâ"—²&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“²Ğ¢–b‡G—Vöb&VæFW$–çfVçF÷'”—FV×3ÓÓÒ&gVæ7F–öâ"—²&VæFW$–çfVçF÷'”—FV×2‚“²Ğ¢–b‡G—Vöb&VæFW$–çfVçF÷'“ÓÓÒ&gVæ7F–öâ"—²&VæFW$–çfVçF÷'’‚“²Ğ¢–b‡G—VöbWFFUT“ÓÓÒ&gVæ7F–öâ"—²WFFUT’‚“²Ğ¢–b‡G—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢–b‡G—Vöb6Æ÷6T—FVÔÖöFÃÓÓÒ&gVæ7F–öâ"—²6Æ÷6T—FVÔÖöFÂ‚“²Ğ¢ÆW'B‚†6†&7FW"æ–GÇÂ.Šy.ˆ›""’².KÛşyJ‚"¶FVf–æ—F–öâææÖR².ûÈÎh.[ê’"·&V6÷fW&VB²""·&W6÷W&6RçFõWW$66R‚’².8""“°¢&WGW&âG'VS°¢Ó° ¢–b‡G—Vöb÷Vä—FVÔÖöFÃÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ÷Vä—FVÔÖöFÃÖ÷Vä—FVÔÖöFÃ°¢÷Vä—FVÔÖöFÃÖgVæ7F–öâ‡6Æ÷D–æFW‚—°¢6öç7B&W7VÇCÖ÷&–v–æÄ÷Vä—FVÔÖöFÂæÇ’‡F†—2Æ&wVÖVçG2“°¢6öç7B—FVÓÖ–çfVçF÷'•6Æ÷G5·6Æ÷D–æFW…Ó°¢6öç7B–6öãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&—FVÔÖöFÄ–6öâ"“°¢–b†–6öâbf—FVÒ—²–6öâæ–ææW$…DÔÃÖ—FVÒæ–6öçÇÂ.)xb#²Ğ¢VæE&Vf÷&vU7FG5FôÖöFÂ†—FVÒ“°¢7–æ4FV6ö×÷6T'WGFöâ†—FVÒÇ6Æ÷D–æFW‚“°¢7–æ4–çfVçF÷'•÷F–öåW6T'WGFöâ†—FVÒÇ6Æ÷D–æFW‚“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b‡G—Vöb÷VäWV—VD—FVÓÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ÷VäWV—VD—FVÓÖ÷VäWV—VD—FVÓ°¢÷VäWV—VD—FVÓÖgVæ7F–öâ†—FVÒ—°¢6öç7B&W7VÇCÖ÷&–v–æÄ÷VäWV—VD—FVÒæÇ’‡F†—2Æ&wVÖVçG2“°¢6öç7B–6öãÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&—FVÔÖöFÄ–6öâ"“°¢–b†–6öâbf—FVÒ—²–6öâæ–ææW$…DÔÃÖ—FVÒæ–6öçÇÂ.)xb#²Ğ¢VæE&Vf÷&vU7FG5FôÖöFÂ†—FVÒ“°¢7–æ4FV6ö×÷6T'WGFöâ†çVÆÂÆçVÆÂ“°¢7–æ4–çfVçF÷'•÷F–öåW6T'WGFöâ†çVÆÂÆçVÆÂ“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚&G&w7F'B"ÆWfVçCÓç°¢–b†WfVçBçF&vWBbfWfVçBçF&vWBæ6Æ÷6W7BbfWfVçBçF&vWBæ6Æ÷6W7B‚"6–çfVçF÷'•vRÂ6—FVÔÖöFÂ"’—°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ğ¢Ò“° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢FF—F–öæÂ6†&7FW'26âÖçVÆÇ’67B7W÷'B6¶–ÆÇ0¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢–b‡G—Vöb&W&T7F–öãÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ&W&T7F–öã×&W&T7F–öã°¢&W&T7F–öãÖgVæ7F–öâ‡G—R—°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·G—UÓ°¢–b€¢7F—fT&GFÆT6†&7FW$–æFWƒÃÓÇÀ¢6¶–ÆÂÇÀ¢²&'Vfb"Â&†VÂ"Â'&Wf—fR%Òæ–æ6ÇVFW2‡6¶–ÆÂæ6FVv÷'’¢—°¢&WGW&â÷&–v–æÅ&W&T7F–öâæÇ’‡F†—2Æ&wVÖVçG2“°¢Ğ¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†7F—fT&GFÆT6†&7FW$–æFW‚“°¢6öç7BWFôöãÖvWE'G”WFô6öæf–r†7F—fT&GFÆT6†&7FW$–æFW‚’æVæ&ÆVC°¢–b‚&GFÆT7F—fWÇÂ6†&7FW'ÇÆ6†&7FW"æ‡ÃÓÇÆWFôöçÇÆ7F–öå&VG’—²&WGW&ã²Ğ¢6öç7B76÷7C×6¶–ÆÂç76÷7BÓ×VæFVf–æVC÷6¶–ÆÂç76÷7C§6¶–ÆÂæ6÷7C°¢–b†6†&7FW"ç7Ç76÷7B—°¢FD&GFÆTÆör‚%5KˆŞ‹k>ûÈÎxJk9^KÛşyJ‚"·6¶–ÆÂææÖR“°¢&WGW&ã°¢Ğ ¢–b‡6¶–ÆÂçF&vWEG—SÓÓÒ&ÆÇ’'ÇÇ6¶–ÆÂçF&vWEG—SÓÓÒ&ÆÇ•G&’'ÇÇ6¶–ÆÂçF&vWEG—SÓÓÒ&FVDÆÇ’"—°¢6öç7B†5F&vWCÕ³ÃÃ%Òç6öÖR†–æFWƒÓæ—5fÆ–DÆÇ•F&vWDf÷%6¶–ÆÂ€¢6¶–ÆÂÆvWD&GFÆT6†&7FW$'”–æFW‚†–æFW‚’Æ–æFW€¢’“°¢–b‚†5F&vWB—°¢FD&GFÆTÆör‡6¶–ÆÂçF&vWEG—SÓÓÒ&FVDÆÇ’#ò.yºîX˜Şk).iÈ™š>Kªy¨N™¨®Xø¾XúşKé¾[êkK¾8"#¢.yºîX˜Şk).iÈXúş˜i8~y¨NXø¾ikyºîj‰8""“°¢&WGW&ã°¢Ğ¢7F–öå&VG“×G'VS°¢VæF–æt7F–öã×G—S°¢6Æ÷6TÖVçW2‚“°¢6WD&GFÆTÆÇ•F&vWE6VÆV7F–öäÖöFR‡G—R“°¢&WGW&ã°¢Ğ ¢7F–öå&VG“×G'VS°¢VWVVEÆ–W$7F–öç5¶7F—fT&GFÆT6†&7FW$–æFW…Ó×¶7F–öã§G—RÇF&vWC¦çVÆÂÇF&vWDÆÇ“¦çVÆÇÓ°¢6Æ÷6TÖVçW2‚“°¢WFFUT’‚“°¢f–æ—6…Æ–W$7F–öâ‚“°¢Ó°¢Ğ ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢6&BVffV7G2†ÆVv7’f—7VÂ&VæFW&W"&WF—&VC²FF÷7FGW2öæÇ’¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâ6&Df÷"‡6–FRÆ–æFW‚—°¢&WGW&âFö7VÖVçBævWDVÆVÖVçD'”–B‡6–FSÓÓÒ&Ööç7FW"#ò&&GFÆTÖöç7FW""¶–æFWƒ¢&&GFÆUÆ–W$6&B"¶–æFW‚“°¢Ğ ¢ò¢W'6—7FVçBf—7VÂ&VæFW&–ær—2÷væVB'’cC2â¶VWöæÇ’F†—27F&ÆP¢6ö×F–&–Æ—G’6ÆÂ7W&f6R&V6W6RöÆFW"7W÷'B7F–öç27F–ÆÂ–çfö¶R—@¢gFW"F†V—"vÖWÆ’&W7VÇB—26öÖÖ—GFVBâ¢ğ¢v–æF÷rçcCÆ”6&DVffV7CÖgVæ7F–öâ‚—²&WGW&âfÇ6S²Ó°  ¢gVæ7F–öâW†V7WFTFF—F–öæÅ7W÷'D7F–öâ†6†&7FW$–æFW‚ÇVWVVBÇ6¶–ÆÂ—°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†6†&7FW$–æFW‚“°¢6öç7B6†&7FW$¶W“ÖvWE'G”6†&7FW$¶W’†6†&7FW$–æFW‚“°¢6öç7B67FW%7FG3ÖvWE'G”&GFÆU7FG2†6†&7FW$–æFW‚“°¢6öç7BÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"†vWE6¶–ÆÄÆWfVÂ†6†&7FW$¶W’Ç6¶–ÆÂæ–B’—ÇÃ“°¢6öç7B6÷7CÔçVÖ&W"‡6¶–ÆÂç76÷7BÓ×VæFVf–æVC÷6¶–ÆÂç76÷7C§6¶–ÆÂæ6÷7B—ÇÃ°¢6öç7BF&vWD–æFWƒÔçVÖ&W"æ—4–çFVvW"‡VWVVBçF&vWDÆÇ’“÷VWVVBçF&vWDÆÇ“¦6†&7FW$–æFWƒ°¢6öç7BF&vWCÖvWD&GFÆT6†&7FW$'”–æFW‚‡F&vWD–æFW‚“° ¢gVæ7F–öâ7F÷†ÖW76vR—°¢–b†ÖW76vR—²FD&GFÆTÆör†ÖW76vR“²Ğ¢WFFUT’‚“°¢f–æ—6…Æ–W$7F–öâ‚“°¢&WGW&âG'VS°¢Ğ ¢–b‚6†&7FW'ÇÂ67FW%7FG2—²&WGW&â7F÷‚.Šy.ˆ›.x¸hX¾xJk9^ŠèXùnûÈÎiÊÎjÊŠÎX¹^[{.yZ^˜î8""“²Ğ¢–b†ÆWfVÃÃÓ—²&WGW&â7F÷‚†6†&7FW"æ–GÇÂ.Šy.ˆ›""’².[	®iÊ®ZÛ{ù""·6¶–ÆÂææÖR².8""“²Ğ¢–b†6†&7FW"ç7Æ6÷7B—²&WGW&â7F÷‚†6†&7FW"æ–GÇÂ.Šy.ˆ›""’²%5KˆŞ‹k>ûÈÎxJk9^KÛşyJ‚"·6¶–ÆÂææÖR².8""“²Ğ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"bb‚F&vWGÇÇF&vWBæ‡ÃÓ’—²&WGW&â7F÷‡6¶–ÆÂææÖR².y¨Nyºîj‰xJk9^hê^Xù~k+¾y˜.8""“²Ğ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"bb‚F&vWGÇÇF&vWBæ‡ã’—²&WGW&â7F÷‚.yºîX˜Ş˜i8~y¨Nyºîj‰KˆŞ™ÈŠh[êkK¾8""“²Ğ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"bg6¶–ÆÂçF&vWEG—SÓÓÒ&ÆÇ’"bb‚F&vWGÇÇF&vWBæ‡ÃÓ’—°¢&WGW&â7F÷‡6¶–ÆÂææÖR².y¨Nyºîj‰xJk9^hê^Xù~iXiéÎ8""“°¢Ğ ¢6†&7FW"ç7ÓÖ6÷7C°¢ÇVævUÆ–W$6&B†6†&7FW$–æFW‚“°¢6†÷u6¶–ÆÄæÖT&FvR‡6¶–ÆÂææÖRÇ6¶–ÆÂæVÆVÖVçBÆ6†&7FW$–æFW‚“°¢6WEF–ÖV÷WB‚‚“Óç6†÷uÆ–W%7÷W†6÷7BÆ6†&7FW$–æFW‚’ÃS“° ¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"—°¢6öç7BF&vWG3×6¶–ÆÂçF&vWEG—SÓÓÒ&ÆÇ”ÆÂ ¢òvWDW†—7F–æu'G”–æFW†W2‚’æÖ†vWE'G”6†&7FW$'”–æFW‚’æf–ÇFW"†—FVÓÓæ—FVÒbf—FVÒæ‡ã¢¢·F&vWGÇÆ6†&7FW%Ó°¢ÆWBW‡G&×·Ó°¢–b‡6¶–ÆÂæ–CÓÓÒ'&vR"—°¢6öç7B6†æ6SÒ‡6¶–ÆÂæ7&—D6†æ6T&öçW4'”ÆWfVÇÇÇ6¶–ÆÂæ7&—D&öçW4'”ÆWfVÇÇÅµÒ•¶ÆWfVÂÓ×ÇÃ°¢6öç7BFÖvSÒ‡6¶–ÆÂæ7&—DFÖvT&öçW4'”ÆWfVÇÇÇ6¶–ÆÂæ7&—D&öçW4'”ÆWfVÇÇÅµÒ•¶ÆWfVÂÓ×ÇÃ°¢W‡G&×°¢&öçW5W&6VçC¦6†æ6RÀ¢7&—D6†æ6T&öçW5W&6VçC¦6†æ6RÀ¢7&—DFÖvT&öçW5W&6VçC¦FÖvP¢Ó°¢Ğ¢VÇ6R–b‡6¶–ÆÂæ–CÓÓÒ&FöFvU6¶–ÆÂ"—²W‡G&×·W&6VçC§6¶–ÆÂæWf6–öä&öçW5W&6VçGÓ²Ğ¢VÇ6R–b‡6¶–ÆÂæ–CÓÓÒ'&ö6µvÆÂ"—²W‡G&×·W&6VçC§6¶–ÆÂæFVfVç6T&öçW5W&6VçGÓ²Ğ¢VÇ6R–b‡6¶–ÆÂæ–CÓÓÒ&V'F…6†–VÆB"—²W‡G&×·W&6VçC§6¶–ÆÂç&VfÆV7EW&6VçGÓ²Ğ¢VÇ6R–b‡6¶–ÆÂæ–CÓÓÒ&F–æv†—6†Vç¦†Vâ"—²W‡G&×·&W6—7D&öçW3§6¶–ÆÂç7FGW5&W6—7D&öçW7Ó²Ğ¢VÇ6R–b‡6¶–ÆÂæ–CÓÓÒ&&'&–W""—°¢W‡G&×°¢6÷W&6U6¶–ÆÃ¢&&'&–W""À¢&'&–W%'VÆS¢'6†&VB"À¢&VÖ–æ–æt&Æö6·3¤çVÖ&W"‡6¶–ÆÂæ&'&–W$&Æö6´6÷VçB—ÇÃP¢Ó°¢Ğ¢F&vWG2æf÷$V6‚†ÆÇ“Óç°¢ÆÇ’æ7F—fT'Vfg3Ò†ÆÇ’æ7F—fT'Vfg7ÇÅµÒ’æf–ÇFW"†'VfcÓæ'VfbçG—RÓ×6¶–ÆÂæ–B“°¢ÆÇ’æ7F—fT'Vfg2çW6‚„ö&¦V7Bæ76–vâ‡·G—S§6¶–ÆÂæ–BÇGW&ç4ÆVgC§6¶–ÆÂæGW&F–öçÇÃ'ÒÆW‡G&’“°¢6öç7B7GVÄ–æFWƒÖvWE'G”6†&7FW$–æFW‚†ÆÇ’“°¢–b†7GVÄ–æFWƒãÓ—²v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""Æ7GVÄ–æFW‚Â÷6†–VÆGÆ&'&–W'ÎŠÛ~y»çÎ{YyXÂö’çFW7B‡6¶–ÆÂæ–B·6¶–ÆÂææÖR“ò'6†–VÆB#¢&'Vfb"“²Ğ¢Ò“°¢FD&GFÆTÆör‚†6†&7FW"æ–GÇÂ.Šy.ˆ›""’².ikŞiKâ"·6¶–ÆÂææÖR².ûÈÎZ)îy¸®iXiéÎ[{.ZY~yJ8""“°¢ÖVÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"—°¢6öç7BF&vWE7FG3ÖvWE'G”&GFÆU7FG2‡F&vWD–æFW‚“°¢6öç7BW„–C×6¶–ÆÂæVÆVÖVçB²$U‚#°¢6öç7BW…6¶–ÆÃ×6¶–ÆÄFF&6U¶W„–EÓ°¢6öç7BW„ÆWfVÃÖvWE6¶–ÆÄÆWfVÂ†6†&7FW$¶W’ÆW„–B“°¢6öç7B×VÇF—Æ–W#ÖW…6¶–ÆÂbfW„ÆWfVÃãbfW…6¶–ÆÂæ†VÄ&öçW5W&6VçCó¶W…6¶–ÆÂæ†VÄ&öçW5W&6VçBó£°¢6öç7B&6T‡Ò„çVÖ&W"‡6¶–ÆÂæ&6T†VÂ—ÇÃ’²„çVÖ&W"‡6¶–ÆÂæ†VÅW$ÆWfVÂ—ÇÃ’¢†ÆWfVÂÓ“°¢6öç7BÆææVD‡ÔÖF‚æfÆö÷"†6Æ7VÆFT†VÆ–ætÖ÷VçB†&6T‡Æ67FW%7FG2æ–çFVÆÆ–vVæ6R’¦×VÇF—Æ–W"“°¢6öç7B7GVÄ‡ÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡ÆææVD‡ÇF&vWE7FG2æÖ„…×F&vWBæ‡’“°¢6öç7B&6U7Ò„çVÖ&W"‡6¶–ÆÂæ&6T†VÅ5—ÇÃ’²„çVÖ&W"‡6¶–ÆÂæ†VÅ5W$ÆWfVÂ—ÇÃ’¢†ÆWfVÂÓ“°¢6öç7BÆææVE7×F&vWCÓÓÖ6†&7FW#ó¤ÖF‚æfÆö÷"†6Æ7VÆFU5†VÆ–ætÖ÷VçB†&6U7Æ67FW%7FG2æ–çFVÆÆ–vVæ6R’¦×VÇF—Æ–W"“°¢6öç7B7GVÅ7ÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡ÆææVE7ÇF&vWE7FG2æÖ…5×F&vWBç7’“°¢F&vWBæ‡ÔÖF‚æÖ–â‡F&vWE7FG2æÖ„…ÇF&vWBæ‡·ÆææVD‡“°¢–b‡F&vWBÓÖ6†&7FW"—²F&vWBç7ÔÖF‚æÖ–â‡F&vWE7FG2æÖ…5ÇF&vWBç7·ÆææVE7“²Ğ¢–b†7GVÄ‡ã—²6†÷uÆ–W$†—B†7GVÄ‡Â&†VÂ"ÇF&vWD–æFW‚ÇG'VR“²Ğ¢v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""ÇF&vWD–æFW‚Â&†VÂ"“°¢FD&GFÆTÆör‡6¶–ÆÂææÖR².KÛò"²‡F&vWBæ–GÇÂ.™¨®Xø²"’².h.[ê’"¶7GVÄ‡²"…"²‡F&vWCÓÓÖ6†&7FW#ò.ûÉ¾ikŞiKîˆ^iÊÎK«®KˆŞY¹î[ê•58"#¢.8"¶7GVÅ7²"58""’“°¢ÖVÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"—°¢6öç7BF&vWE7FG3ÖvWE'G”&GFÆU7FG2‡F&vWD–æFW‚“°¢6öç7BW„–C×6¶–ÆÂæVÆVÖVçB²$U‚#°¢6öç7BW…6¶–ÆÃ×6¶–ÆÄFF&6U¶W„–EÓ°¢6öç7BW„ÆWfVÃÖvWE6¶–ÆÄÆWfVÂ†6†&7FW$¶W’ÆW„–B“°¢6öç7B×VÇF—Æ–W#ÖW…6¶–ÆÂbfW„ÆWfVÃãbfW…6¶–ÆÂæ†VÄ&öçW5W&6VçCó¶W…6¶–ÆÂæ†VÄ&öçW5W&6VçBó£°¢6öç7BW&6VçCÒ‡6¶–ÆÂç&Wf—fT†VÅW&6VçD'”ÆWfVÇÇÅ³#Ò•´ÖF‚æÖ–â†ÆWfVÂÓÂ‡6¶–ÆÂç&Wf—fT†VÅW&6VçD'”ÆWfVÇÇÅ³#Ò’æÆVæwF‚Ó•Ó°¢F&vWBæ‡ÔÖF‚æÖ‚ƒÄÖF‚æÖ–â‡F&vWE7FG2æÖ„…ÄÖF‚æfÆö÷"‡F&vWE7FG2æÖ„…§W&6VçBó¦×VÇF—Æ–W"’’“°¢6WEF–ÖV÷WB‚‚“Óç6†÷uÆ–W$†—B‡F&vWBæ‡Â&†VÂ"ÇF&vWD–æFW‚ÇG'VR’Ã3“°¢v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""ÇF&vWD–æFW‚Â'&Wf—fR"“°¢FD&GFÆTÆör‚‡F&vWBæ–GÇÂ.™¨®Xø²"’².Š*²"·6¶–ÆÂææÖR².[êkK¾ûÈÎh.[ê’"·F&vWBæ‡²"…8""“°¢Ğ ¢WFFUT’‚“°¢f–æ—6…Æ–W$7F–öâ‚“°¢&WGW&âG'VS°¢Ğ ¢gVæ7F–öâcC&Vf÷&TÖöç7FW%V•WFFR†–æFW‚ÆÖöç7FW"—°¢–b‡G—Vöbv–æF÷rçcC7–æ4Ööç7FW%6†–VÆCÓÓÒ&gVæ7F–öâ"bfÖöç7FW"—°¢v–æF÷rçcC7–æ4Ööç7FW%6†–VÆB†Ööç7FW"“°¢Ğ¢Ğ ¢gVæ7F–öâcCgFW$Ööç7FW%V•WFFR†–æFW‚ÆÖöç7FW"—°¢–b‚Ööç7FW"—²&WGW&ã²Ğ¢6öç7Bæ÷&ÖÄ&#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW$&""¶–æFW‚“°¢6öç7B6†–VÆD&#ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW%6†–VÆD&""¶–æFW‚“°¢6öç7B‡FW‡CÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW$…FW‡B"¶–æFW‚“°¢6öç7B6†–VÆCÖÖöç7FW"çcC6†–VÆC°¢6öç7B&VÖ–æ–æs×6†–VÆCôÖF‚æÖ‚ƒÄçVÖ&W"‡6†–VÆBç&VÖ–æ–ær—ÇÃ“£°¢–b‡6†–VÆBbg&VÖ–æ–æsã—°¢6öç7B&6TÖƒ×6†–VÆBæ&6TÖ„…°¢6öç7B&6T‡ÔÖF‚æÖ‚ƒÆÖöç7FW"æ‡×&VÖ–æ–ær“°¢6öç7Bf—6–&ÆU6†–VÆC×6†–VÆBæ—4&'&–W#ö&6TÖƒ§&VÖ–æ–æs°¢6öç7BF÷FÃÔÖF‚æÖ‚ƒÆ&6TÖ‚·f—6–&ÆU6†–VÆB“°¢–b†æ÷&ÖÄ&"—²æ÷&ÖÄ&"ç7G–ÆRçv–GFƒÒ†&6T‡÷F÷FÂ£’²"R#²Ğ¢–b‡6†–VÆD&"—°¢6†–VÆD&"ç7G–ÆRæÆVgCÒ†&6T‡÷F÷FÂ£’²"R#°¢6†–VÆD&"ç7G–ÆRçv–GFƒÒ‡f—6–&ÆU6†–VÆB÷F÷FÂ£’²"R#°¢Ğ¢–b†‡FW‡B—°¢‡FW‡BçFW‡D6öçFVçC×6†–VÆBæ—4&'&–W ¢ôÖF‚æfÆö÷"†&6T‡’²"ò"¶&6TÖ‚².8{YyXÂ ¢¤ÖF‚æfÆö÷"†&6T‡’²"ò"¶&6TÖ‚²"²"´ÖF‚æfÆö÷"‡&VÖ–æ–ær“°¢Ğ¢ÖVÇ6R–b‡6†–VÆD&"—°¢6†–VÆD&"ç7G–ÆRæÆVgCÒ##°¢6†–VÆD&"ç7G–ÆRçv–GFƒÒ##°¢Ğ¢Ğ¢v–æF÷rçcC&Vf÷&TÖöç7FW%V•WFFS×cC&Vf÷&TÖöç7FW%V•WFFS°¢v–æF÷rçcCgFW$Ööç7FW%V•WFFS×cCgFW$Ööç7FW%V•WFFS° ¢–b‡G—Vöb&W6öÇfUVWVVEÆ–W$7F–öãÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ&W6öÇfUVWVVEÆ–W$7F–öã×&W6öÇfUVWVVEÆ–W$7F–öã°¢&W6öÇfUVWVVEÆ–W$7F–öãÖgVæ7F–öâ†6†&7FW$–æFW‚ÇFö¶Vâ—°¢6öç7BVWVVC×VWVVEÆ–W$7F–öç5¶6†&7FW$–æFW…Ğ¢òö&¦V7Bæ76–vâ‡·ÒÇVWVVEÆ–W$7F–öç5¶6†&7FW$–æFW…Ò¢¢çVÆÃ°¢6öç7B6¶–ÆÃ×VWVVBbg6¶–ÆÄFF&6U·VWVVBæ7F–öåÓ°¢6öç7BFÆ—6Öã×VWVVBbgv–æF÷rçc3$vWEFÆ—6ÖäFVf–æ—F–öà¢òv–æF÷rçc3$vWEFÆ—6ÖäFVf–æ—F–öâ‡VWVVBæ7F–öâ¢¢çVÆÃ°¢–b€¢6†&7FW$–æFWƒãbgVWVVBbg6¶–ÆÂb`¢²&'Vfb"Â&†VÂ"Â'&Wf—fR%Òæ–æ6ÇVFW2‡6¶–ÆÂæ6FVv÷'’¢—°¢&WGW&âW†V7WFTFF—F–öæÅ7W÷'D7F–öâ†6†&7FW$–æFW‚ÇVWVVBÇ6¶–ÆÂ“°¢Ğ¢6öç7B&W7VÇCÖ÷&–v–æÅ&W6öÇfUVWVVEÆ–W$7F–öâæÇ’‡F†—2Æ&wVÖVçG2“°¢6WEF–ÖV÷WB‚‚“Óç°¢–b‚VWVVB—²&WGW&ã²Ğ¢–b‡VWVVBæ7F–öãÓÓÒ'÷F–öâ"—°¢v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""Æ6†&7FW$–æFW‚Â'÷F–öâ"“°¢ÖVÇ6R–b‡FÆ—6Öâ—°¢6öç7B6–FS×FÆ—6ÖâçFÆ—6ÖäVffV7CÓÓÒ&g&VW¦R#ò&Ööç7FW"#¢'Æ–W"#°¢6öç7BF&vWC×6–FSÓÓÒ&Ööç7FW"#÷VWVVBçF&vWC§VWVVBçF&vWDÆÇ“°¢–b„çVÖ&W"æ—4–çFVvW"‡F&vWB’—²v–æF÷rçcCÆ”6&DVffV7B‡6–FRÇF&vWBÂ'FÆ—6Öâ"“²Ğ¢ÖVÇ6R–b‡6¶–ÆÂ—°¢–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&†VÂ"bdçVÖ&W"æ—4–çFVvW"‡VWVVBçF&vWDÆÇ’’—°¢v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""ÇVWVVBçF&vWDÆÇ’Â&†VÂ"“°¢ÖVÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ'&Wf—fR"bdçVÖ&W"æ—4–çFVvW"‡VWVVBçF&vWDÆÇ’’—°¢v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""ÇVWVVBçF&vWDÆÇ’Â'&Wf—fR"“°¢ÖVÇ6R–b‡6¶–ÆÂæ6FVv÷'“ÓÓÒ&'Vfb"—°¢6öç7BG—SÒ÷6†–VÆGÆ&'&–W'ÎŠÛ~y»çÎ{YyXÂö’çFW7B‡6¶–ÆÂæ–B·6¶–ÆÂææÖR“ò'6†–VÆB#¢&'Vfb#°¢–b‡6¶–ÆÂçF&vWEG—SÓÓÒ&ÆÇ”ÆÂ"—°¢vWDW†—7F–æu'G”–æFW†W2‚’æf÷$V6‚†–æFWƒÓçv–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""Æ–æFW‚ÇG—R’“°¢ÖVÇ6R–b„çVÖ&W"æ—4–çFVvW"‡VWVVBçF&vWDÆÇ’’—°¢v–æF÷rçcCÆ”6&DVffV7B‚'Æ–W""ÇVWVVBçF&vWDÆÇ’ÇG—R“°¢Ğ¢Ğ¢Ğ¢ÒÃ“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢GVævVöâ&GFÆR&VæFW&–æp¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâÇ”f—†VD'—74f÷&ÖF–öâ‚—°¢6öç7B&VÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW$&V"“°¢–b‚&V—²&WGW&ã²Ğ¢6öç7Bf—†VCÖ7W'&VçD&GFÆTÖöç7FW'0¢æÖ†–æFWƒÓâ‡¶–æFW‚ÆÖöç7FW#¦Ööç7FW'5¶–æFW…×Ò’¢æf–ÇFW"†VçG'“ÓæVçG'’æÖöç7FW"bdçVÖ&W"æ—4–çFVvW"†VçG'’æÖöç7FW"çcCf÷&ÖF–öå&÷r’“°¢–b‚f—†VBæÆVæwF‚—²&WGW&ã²Ğ¢6öç7B6&G3ÖæWrÖ†f—†VBæÖ†VçG'“Óå¶VçG'’æ–æFW‚ÆFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW""¶VçG'’æ–æFW‚•Ò’“°¢&Væ–ææW$…DÔÃÒ"#°¢&Væ6Æ74Æ—7BæFB‚'c3Öf÷&ÖF–öâ"Â'cCÖf—†VBÖf÷&ÖF–öâ"“°¢³ÃÒæf÷$V6‚‡&÷tçVÖ&W#Óç°¢6öç7B&÷sÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢&÷ræ6Æ74æÖSÒ'c3ÖÖöç7FW"×&÷rc3ÖÖöç7FW"×&÷rÒ"²‡&÷tçVÖ&W"³“°¢f—†VBæf–ÇFW"†VçG'“ÓæVçG'’æÖöç7FW"çcCf÷&ÖF–öå&÷sÓÓ×&÷tçVÖ&W"¢ç6÷'B‚†Æ"“Óâ†æÖöç7FW"çcCf÷&ÖF–öå÷6—F–öçÇÃ’Ò†"æÖöç7FW"çcCf÷&ÖF–öå÷6—F–öçÇÃ’¢æf÷$V6‚†VçG'“Óç°¢6öç7B6&CÖ6&G2ævWB†VçG'’æ–æFW‚“°¢–b†6&B—²&÷ræVæD6†–ÆB†6&B“²Ğ¢Ò“°¢&VæVæD6†–ÆB‡&÷r“°¢Ò“°¢Ğ¢v–æF÷rçcCÇ”f—†VD'—74f÷&ÖF–öãÖÇ”f—†VD'—74f÷&ÖF–öã° ¢gVæ7F–öâVç7W&TÖöç7FW%6†–VÆD&'2‚—°¢7W'&VçD&GFÆTÖöç7FW'2æf÷$V6‚†–æFWƒÓç°¢6öç7B‡ÖFö7VÖVçBçVW'•6VÆV7F÷"‚"6&GFÆTÖöç7FW""¶–æFW‚²"æÖöç7FW"Ö‡"“°¢–b‚‡ÇÆFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW%6†–VÆD&""¶–æFW‚’—²&WGW&ã²Ğ¢6öç7B&#ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢&"æ–CÒ&&GFÆTÖöç7FW%6†–VÆD&""¶–æFWƒ°¢&"æ6Æ74æÖSÒ'cCÖÖöç7FW"×6†–VÆBÖ&"#°¢6öç7BFW‡CÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆTÖöç7FW$…FW‡B"¶–æFW‚“°¢‡æ–ç6W'D&Vf÷&R†&"ÇFW‡GÇÆçVÆÂ“°¢Ò“°¢Ğ ¢gVæ7F–öâFV6÷&FT&GFÆT6&G2‚—°¢Vç7W&TÖöç7FW%6†–VÆD&'2‚“°¢7W'&VçD&GFÆTÖöç7FW'2æf÷$V6‚†–æFWƒÓç°¢6öç7B6&CÖ6&Df÷"‚&Ööç7FW""Æ–æFW‚“°¢6öç7BÖöç7FW#ÖÖöç7FW'5¶–æFW…Ó°¢–b†6&BbfÖöç7FW"—°¢6&BæFF6WBæVÆVÖVçCÖÖöç7FW"æVÆVÖVçGÇÂ'Væ¶æ÷vâ#°¢6&BæFF6WBç&æ³ÖvWDÖöç7FW%&æ²†Ööç7FW"“°¢WFFTÖöç7FW%T’†–æFW‚“°¢Ğ¢Ò“°¢Ç”f—†VD'—74f÷&ÖF–öâ‚“°¢Ğ ¢6öç7B7F'FVDVçG'•Fö¶Vç3ÖæWr6WB‚“° ¢gVæ7F–öâcC&W&T&GFÆU&VæFW"‚—°¢6öç7B7F—fTGVævVöå'Vã×v–æF÷rçc3$7F—fTGVævVöå'VçÇÆçVÆÃ°¢6öç7B—4GVævVöãÒ7F—fTGVævVöå'Vã°¢–b‚—4GVævVöâbbÆ7Ev–ÆE&æµFö¶VâÓÖ&GFÆUFö¶Vâ—°¢Æ7Ev–ÆE&æµFö¶VãÖ&GFÆUFö¶Vã°¢–b‡G—Vöbv–æF÷rçcC&öÆÅv–ÆDÖöç7FW%&æ·3ÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcC&öÆÅv–ÆDÖöç7FW%&æ·2†7W'&VçD&GFÆTÖöç7FW'2“°¢Ğ¢Ğ¢&GFÆU6æ6†÷C×°¢Fö¶Vã¦&GFÆUFö¶VâÀ¢vöÆC¤ÖF‚æÖ‚ƒÄçVÖ&W"†vöÆB—ÇÃ’À¢W‡¤ÖF‚æÖ‚ƒÄçVÖ&W"‡6†&VDW‡—ÇÃ’À¢—FV×3¦vWD—FVÔ6÷VçG2‚’À¢GVævVöã¦—4GVævVöâÀ¢GVævVöäÖöFS¦7F—fTGVævVöå'Vâbf7F—fTGVævVöå'VâæÖöFWÇÆçVÆÀ¢Ó°¢Ğ ¢gVæ7F–öâcCgFW$&GFÆU&VæFW"‚—°¢FV6÷&FT&GFÆT6&G2‚“°¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢ò¢&V–æf÷&6VÖVçG2&VG&rF†RW†—7F–ær&GFÆRâ—G2VçG'’†2Ç&VG¢7F'FVBÂ6ò7F'EGW&âv–ÆÂæ÷B'VâF†RVçG'’6ÆVçWv–ââ¢ğ¢–b‡vRbb7F'FVDVçG'•Fö¶Vç2æ†2†&GFÆUFö¶Vâ’—°¢vRæ6Æ74Æ—7Bç&VÖ÷fR‚'cCÖVçG'’ÖÖ÷f–ær"Â'cCÖW†—B×Æ–W""Â'cCÖW†—BÖÖöç7FW""“°¢vRæ6Æ74Æ—7BæFB‚'cC×&W&–ærÖVçG'’"“°¢Ğ¢Ğ ¢v–æF÷rçcC&W&T&GFÆU&VæFW#×cC&W&T&GFÆU&VæFW#°¢v–æF÷rçcCgFW$&GFÆU&VæFW#×cCgFW$&GFÆU&VæFW#° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢&GFÆRG&ç6—F–öç2æB÷7BÖ&GFÆR&Wv&BF–Ö–æp¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâVç7W&T&GFÆUG&ç6—F–öä÷fW&Æ’‚—°¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢–b‚vR—²&WGW&âçVÆÃ²Ğ¢ÆWB÷fW&Æ“ÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'cC&GFÆUG&ç6—F–öâ"“°¢–b‚÷fW&Æ’—°¢÷fW&Æ“ÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢÷fW&Æ’æ–CÒ'cC&GFÆUG&ç6—F–öâ#°¢÷fW&Æ’æ6Æ74æÖSÒ'cCÖ&GFÆR×G&ç6—F–öâ#°¢÷fW&Æ’æ–ææW$…DÔÃÒsÇ7ããÂ÷7ããÆ#îh‹Âö#ãÇ7ããÂ÷7ãâs°¢vRæVæD6†–ÆB†÷fW&Æ’“°¢Ğ¢&WGW&â÷fW&Æ“°¢Ğ ¢–b‡G—Vöb7F'EGW&ãÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ7F'EGW&ã×7F'EGW&ã°¢7F'EGW&ãÖgVæ7F–öâ‡Fö¶Vâ—°¢–b‚&GFÆT7F—fWÇÇ7F'FVDVçG'•Fö¶Vç2æ†2‡Fö¶Vâ’—°¢&WGW&â÷&–v–æÅ7F'EGW&âæÇ’‡F†—2Æ&wVÖVçG2“°¢Ğ¢7F'FVDVçG'•Fö¶Vç2æFB‡Fö¶Vâ“°¢6öç7B÷fW&Æ“ÖVç7W&T&GFÆUG&ç6—F–öä÷fW&Æ’‚“°¢6öç7BvSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&&GFÆUvR"“°¢G&ç6—F–öå'Vææ–æs×G'VS°¢–b†÷fW&Æ’—²÷fW&Æ’æ6Æ74Æ—7BæFB‚'6†÷r"“²Ğ¢6WEF–ÖV÷WB‚‚“Óç°¢–b†÷fW&Æ’—²÷fW&Æ’æ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“²Ğ¢–b‡vR—°¢vRæ6Æ74Æ—7Bç&VÖ÷fR‚'cC×&W&–ærÖVçG'’"“°¢vRæ6Æ74Æ—7BæFB‚'cCÖVçG'’ÖÖ÷f–ær"“°¢Ğ¢6WEF–ÖV÷WB‚‚“Óç°¢–b‡vR—²vRæ6Æ74Æ—7Bç&VÖ÷fR‚'cCÖVçG'’ÖÖ÷f–ær"“²Ğ¢G&ç6—F–öå'Vææ–æsÖfÇ6S°¢–b†&GFÆT7F—fRbgFö¶VãÓÓÖ&GFÆUFö¶Vâ—²÷&–v–æÅ7F'EGW&âæ6ÆÂ‡F†—2ÇFö¶Vâ“²Ğ¢ÒÃs#“°¢ÒÃ“°¢Ó°¢Ğ ¢gVæ7F–öâ6öÆÆV7E&Wv&E7VÖÖ'’‚—°¢6öç7B6æ6†÷CÖ&GFÆU6æ6†÷C°¢–b‚6æ6†÷B—²&WGW&â¶W‡£ÆvöÆC£Æ—FV×3¥µ×Ó²Ğ¢6öç7Bæ÷t—FV×3ÖvWD—FVÔ6÷VçG2‚“°¢6öç7B—FV×3ÕµÓ°¢æ÷t—FV×2æf÷$V6‚‚†VçG'’Æ–B“Óç°¢6öç7B&Vf÷&S×6æ6†÷Bæ—FV×2ævWB†–B“°¢6öç7BFVÇFÖVçG'’æ6÷VçBÒ†&Vf÷&Sö&Vf÷&Ræ6÷VçC£“°¢–b†FVÇFã—°¢—FV×2çW6‚‡°¢–BÀ¢æÖS¦VçG'’ææÖRÀ¢6÷VçC¦FVÇF¢Ò“°¢Ğ¢Ò“°¢&WGW&â°¢W‡¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‚„çVÖ&W"‡6†&VDW‡—ÇÃ’×6æ6†÷BæW‡’’À¢vöÆC¤ÖF‚æÖ‚ƒÄÖF‚æfÆö÷"‚„çVÖ&W"†vöÆB—ÇÃ’×6æ6†÷BævöÆB’’À¢—FV×3¦—FV×0¢Ó°¢Ğ ¢gVæ7F–öâ6†÷t&Æ6´vöÆE&Wv&B‡7VÖÖ'’—°¢ÆWBFö7CÖFö7VÖVçBævWDVÆVÖVçD'”–B‚'cC&Wv&EFö7B"“°¢–b‚Fö7B—°¢Fö7CÖFö7VÖVçBæ7&VFTVÆVÖVçB‚&F—b"“°¢Fö7Bæ–CÒ'cC&Wv&EFö7B#°¢Fö7Bæ6Æ74æÖSÒ'cC×&Wv&B×Fö7B#°¢Fö7VÖVçBæ&öG’æVæD6†–ÆB‡Fö7B“°¢Ğ¢6öç7B'G3ÕµÓ°¢–b‡7VÖÖ'’æW‡ã—²'G2çW6‚‚sÇ7ããÆ#äU…Âö#â²r·7VÖÖ'’æW‡çFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’²sÂ÷7ãâr“²Ğ¢–b‡7VÖÖ'’ævöÆCã—²'G2çW6‚‚sÇ7ããÆ#î˜y[š3Âö#â²r·7VÖÖ'’ævöÆBçFôÆö6ÆU7G&–ær‚'¦‚ÕEr"’²sÂ÷7ãâr“²Ğ¢7VÖÖ'’æ—FV×2æf÷$V6‚†—FVÓÓç°¢6öç7B6æöæ–6Ä–6öãÖvWD6æöæ–6ÅF–6¶WD–6öâ†—FVÒ“°¢6öç7B–6öãÖ6æöæ–6Ä–6öà¢òsÆ’6Æ73Ò'cC×&Wv&BÖ—FVÒÖ–6öâ"&–Ö†–FFVãÒ'G'VR#âr¶6æöæ–6Ä–6öâ²sÂö“âp¢¢"#°¢'G2çW6‚€¢sÇ7â6Æ73Ò'cC×&Wv&BÖ—FVÒ#âr¶–6öâ°¢sÇ7ããÆ#îxšY8Âö#âr¶W66T‡FÖÂ†—FVÒææÖR’²r9rr¶—FVÒæ6÷VçB²sÂ÷7ããÂ÷7ãâp¢“°¢Ò“°¢–b‚'G2æÆVæwF‚—²&WGW&ã²Ğ¢Fö7Bæ–ææW$…DÔÃÒsÇ7G&öæsîh‹šÊ^xØîX»SÂ÷7G&öæsãÆF—câr·'G2æ¦ö–â‚""’²sÂöF—câs°¢Fö7Bæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"“°¢fö–BFö7Bæöfg6WEv–GFƒ°¢Fö7Bæ6Æ74Æ—7BæFB‚'6†÷r"“°¢6ÆV%F–ÖV÷WB‡Fö7Båö†–FUF–ÖW"“°¢Fö7Båö†–FUF–ÖW#×6WEF–ÖV÷WB‚‚“ÓçFö7Bæ6Æ74Æ—7Bç&VÖ÷fR‚'6†÷r"’ÃC#“°¢Ğ¢v–æF÷rçcC6†÷t&Æ6´vöÆE&Wv&C×6†÷t&Æ6´vöÆE&WvZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^rd;

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
                if(label){ label.textContent=kind==="win"?"å‹åˆ©":"æˆ°é¬¥å¤±æ•—"; }
                overlay.dataset.v144Kind=kind==="win"?"win":"lose";
                overlay.classList.add("show");
            }
        },1450);
        setTimeout(()=>{
            /* èˆŠ winBattle æœƒå†å»¶é²å‘¼å«ä¸€æ¬¡ showExpToastï¼›å¿…é ˆåœ¨é€²å…¥èˆŠ
               çµç®—å‰å…ˆæŠ‘åˆ¶ï¼Œå¦å‰‡æœƒå…ˆè·³å–®ç¨ EXPï¼Œå†è·³æœ¬å±¤æ•´åˆçå‹µã€‚ */
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

    window.v141PlayEscapeBattleExit=function(onCovered){
        if(transitionRunning){ return Promise.resolve(false); }
        transitionRunning=true;
        const overlay=ensureBattleTransitionOverlay();
        const label=overlay&&overlay.querySelector("b");
        if(label){ label.textContent="æ’¤é›¢"; }
        if(overlay){
            overlay.dataset.v144Kind="escape";
            overlay.classList.add("show");
        }
        return new Promise(resolve=>{
            setTimeout(()=>{
                let result;
                try{
                    result=typeof onCovered==="function"?onCovered():true;
                }finally{
                    setTimeout(()=>{
                        if(overlay){
                            overlay.classList.remove("show");
                            delete overlay.dataset.v144Kind;
                        }
                        if(label){ label.textContent="æˆ°"; }
                        transitionRunning=false;
                        resolve(result);
                    },120);
                }
            },460);
        });
    };

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
        const rows=[["æ¯æ—¥",daily,dailyQuestState],["å§”è¨—",commission,commissionQuestState]]
            .filter(entry=>entry[1])
            .map(([label,quest,state])=>{
                const progress=Math.min(quest.goal,Number(state.progress[quest.id])||0);
                return '<div><b>'+label+'</b><span>'+escapeHtml(quest.name)+'</span><em>'+progress+'/'+quest.goal+'</em></div>';
            }).join("");
        if(body.dataset.rows!==rows){ body.dataset.rows=rows; body.innerHTML=rows||'<div><span>ä»Šæ—¥ä»»å‹™å·²å®Œæˆ</span></div>'; }
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
            '<button type="button" class="v141-task-collapse" aria-label="éš±è—æˆ–å±•é–‹ä»»å‹™">â€¹</button>'+
            '<div class="v141-task-tracker-title">ä»»å‹™è¿½è¹¤</div>'+
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
        return [reward.gold?reward.gold+"é‡‘":null,reward.exp?reward.exp+"EXP":null].filter(Boolean).join("ï¼‹");
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
                    '<span>'+(claimed?"å·²é ˜":reached?"é ˜å–":"å¯¶ç®±")+'</span><small>'+rewardLabel(reward)+'</small></button></div>';
            }).join("");
            return '<div class="quest-completion-head"><span>å®Œæˆåº¦å¯¶ç®±</span><strong>'+display+'%</strong></div>'+
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
                '<section><small>ä¾å¸³è™Ÿæœ€é«˜è§’è‰² Lv.'+(window.v141GetHighestCharacterLevel?window.v141GetHighestCharacterLevel():1)+'</small>'+
                '<strong>'+Math.floor(pendingOfflineExp).toLocaleString("zh-TW")+' EXP</strong>'+
                '<span>é›¢ç·šå€ç‡ Ã—'+multiplier.toFixed(1)+'ãƒ»ä¸Šé™ '+OFFLINE_EXP_MAX_MINUTES+' åˆ†é˜</span></section>'+
                '<div class="v141-offline-actions">'+
                '<button type="button" '+(pendingOfflineExp<=0?"disabled":"")+' onclick="claimOfflineExp(false)">ç›´æ¥é ˜å–</button>'+
                '<button type="button" '+(pendingOfflineExp<=0?"disabled":"")+' onclick="claimOfflineExpWithAd()">å»£å‘Šé›™å€</button></div>'+
                '<section class="rested"><small>ä¼‘æ¯ç¶“é©—</small><strong>'+rested.battles+' / '+rested.maxBattles+' å ´</strong>'+
                '<span>ä¸€èˆ¬ç·´åŠŸ EXP Ã—2ï¼›å…ƒç´ åŒ£èˆ‡å‰¯æœ¬ä¸æ¶ˆè€—</span></section></div>';
        };
    }

    /* Shop render/purchase ownership is finalized by V144; legacy V141 wrappers removed. */

    function compactElementBoxPanel(){
        const panel=document.getElementById("autoBattleSettingsPanel");
        const stats=document.getElementById("v131ElementBoxStats");
        if(!panel||!stats){ return; }
        const state=window.v131GetElementBoxState?window.v131GetElementBoxState():{remainingMs:0};
        const totalMinutes=Math.floor(state.remainingMs/60000);
        const text=Math.floor(totalMinutes/60)+"å°æ™‚ "+(totalMinutes%60)+"åˆ†é˜";
        stats.innerHTML=
            '<div class="v141-element-box-remaining"><span>å…ƒç´ åŒ£å‰©é¤˜æ™‚é–“</span><strong id="v131EbRemaining">'+text+'</strong></div>'+
            '<button type="button" class="v141-element-box-ad" onclick="v141WatchElementBoxAd()">è§€çœ‹å»£å‘Š ï¼‹8å°æ™‚</button>'+
            '<small>æœ€å¤šå¯ç´¯ç©32å°æ™‚ï¼Œå¯éš¨æ™‚å¢åŠ ã€‚</small>';
        panel.classList.add("v141-compact-element-box");
    }

    window.v141WatchElementBoxAd=function(){
        const state=window.v131GetElementBoxState?window.v131GetElementBoxState():{remainingMs:0};
        if(state.remainingMs>=32*60*60*1000){ alert("å…ƒç´ åŒ£å·²é”32å°æ™‚ä¸Šé™ã€‚"); return; }
        showRewardedAd(()=>{
            if(window.v131GrantElementBoxHours){ window.v131GrantElementBoxHours(8,32); }
            compactElementBoxPanel();
            addBattleLog("å…ƒç´ åŒ£å¢åŠ 8å°æ™‚ï¼Œæœ€å¤šç´¯ç©32å°æ™‚ã€‚");
        },()=>alert("å»£å‘Šæœªå®Œæˆï¼Œæœªå¢åŠ å…ƒç´ åŒ£æ™‚æ•¸ã€‚"));
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
        exp:{title:"ç¶“é©—å‰¯æœ¬",requirement:"ä»»ä¸€è§’è‰²é”åˆ°10ç´š",reward:"å…±ç”¨ç¶“é©—æ±  EXP",action:"v132BeginExpDungeon"},
        material:{title:"ææ–™å‰¯æœ¬",requirement:"ä»»ä¸€è§’è‰²é”åˆ°10ç´š",reward:"ææ–™å¯¶ç®± Ã—1ï½3",action:"v132BeginMaterialDungeon"},
        equipment:{title:"è£å‚™å‰¯æœ¬",requirement:"ä»»ä¸€è§’è‰²é”åˆ°10ç´š",reward:"è‡ªé¸ç³»åˆ—è£å‚™æŠ½çåˆ¸",action:"v132BeginEquipmentDungeon"}
    };

    function renderDungeonCoverCard(type){
        const data=dungeonCoverData[type];
        const available=!window.v132IsDungeonAvailable||window.v132IsDungeonAvailable(type);
        return '<article class="v141-dungeon-cover-card" data-dungeon-cover="'+type+'">'+
            '<div class="v141-dungeon-cover-art"><span>'+data.title+'</span><small>å°é¢åœ–é ç•™å€</small></div>'+
            '<div class="v141-dungeon-cover-info"><b>'+data.title+'</b><span>é–‹æ”¾ï¼š'+data.requirement+'</span></div>'+
            '<div class="v141-dungeon-cover-actions">'+
            '<button type="button" onclick="v141ShowDungeonRewardPreview(\''+type+'\')">çå‹µé è¦½</button>'+
            '<button type="button" '+(available?'onclick="'+data.action+'()"':'disabled')+'>æŒ‘æˆ°</button></div>'+
            '<div class="v141-dungeon-remaining">å‰©é¤˜æ¬¡æ•¸ï¼š'+(available?'1':'0')+' / 1</div></article>';
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){
                return '<div class="v141-dungeon-cover-list">'+Object.keys(dungeonCoverDataµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥â’æÖ‡&VæFW$GVævVöä6÷fW$6&B’æ¦ö–â‚""’²sÂöF—câs°¢Ğ¢&WGW&â÷&–v–æÅ&VæFW$GVævVöåF$6öçFVçBæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢v–æF÷rçcC6†÷tGVævVöå&Wv&E&Wf–WsÖgVæ7F–öâ‡G—R—°¢6öç7BFFÖGVævVöä6÷fW$FF·G—UÓ°¢–b‚FF—²&WGW&ã²Ğ¢6öç7B‡FÖÃÒsÆF—b6Æ73Ò'c3"×&Wv&BÖÖöFÂÖ–ææW"#ãÆƒ3âr¶FFçF—FÆR²~xØîX»^š	ŠkÓÂöƒ3ãÇâr¶FFç&Wv&B²sÂ÷âr°¢sÆF—b6Æ73Ò'c3"×&Wv&BÖ7F–öç2#ãÆ'WGFöâG—SÒ&'WGFöâ"öæ6Æ–6³Ò'c3$6Æ÷6U&Wv&DÖöFÂ‚’#î‹ùNY¹ãÂö'WGFöããÂöF—cãÂöF—câs°¢–b‡v–æF÷rçc3%6†÷u&Wv&DÖöFÂ—²v–æF÷rçc3%6†÷u&Wv&DÖöFÂ†‡FÖÂ“²Ğ¢Ó° ¢gVæ7F–öâ–ç7FÆÄGVævVöäæf–vF–öâ‚—°¢ò¢F†RÆVv7’cCÖGVævVöâ×&WGW&âöæbÖ&·W÷væW"—2&WF—&VBà¢F†Rf–æÂcC‚6öçFW‡BÖæb÷væW"7&VFW2æB&VæFW'2F†R6†VÆÂâ¢ğ¢–b‡G—Vöbv–æF÷rçcC…7–æ46öçFW‡Dæf–vF–öãÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcC…7–æ46öçFW‡Dæf–vF–öâ‚“°¢ÖVÇ6R–b‡G—Vöbv–æF÷rçcC…7–æ4GVævVöå6†VÆÃÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcC…7–æ4GVævVöå6†VÆÂ‚“°¢Ğ¢Ğ ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢æ÷F–f–6F–öâF÷G0¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢gVæ7F–öâ6WDæ÷F–f–6F–öäF÷B‡F&vWBÇ6†÷rÆÆ&VÂ—°¢–b‚F&vWB—²&WGW&ã²Ğ¢ÆWBF÷C×F&vWBçVW'•6VÆV7F÷"‚#§66÷RâçcCÖæ÷F–6RÖF÷B"“°¢–b‡6†÷rbbF÷B—°¢F÷CÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'7â"“°¢F÷Bæ6Æ74æÖSÒ'cCÖæ÷F–6RÖF÷B#°¢F÷Bç6WDGG&–'WFR‚&&–ÖÆ&VÂ"ÆÆ&VÇÇÂ.iÈikXZ~Zë’"“°¢F&vWBæVæD6†–ÆB†F÷B“°¢ÖVÇ6R–b‚6†÷rbfF÷B—²F÷Bç&VÖ÷fR‚“²Ğ¢Ğ ¢gVæ7F–öâWFFTæ÷F–f–6F–öäF÷G2‚—°¢–b‡G—VöbVç7W&TF–Ç•VW7G47W'&VçCÓÓÒ&gVæ7F–öâ"—²Vç7W&TF–Ç•VW7G47W'&VçB‚“²Ğ¢6öç7B†5VW7Dæ÷F–6SÕ°¢ââæF–Ç•VW7DFVf–æ—F–öç2æÖ‡VW7CÓå·VW7BÆF–Ç•VW7E7FFUÒ’À¢ââæ6öÖÖ—76–öåVW7DFVf–æ—F–öç2æÖ‡VW7CÓå·VW7BÆ6öÖÖ—76–öåVW7E7FFUÒ¢Òç6öÖR‚…·VW7BÇ7FFUÒ“Óâ7FFRæ6Æ–ÖVE·VW7Bæ–EÒ“°¢6öç7B†46†–WfVÖVçCÖ6†–WfVÖVçDFVf–æ—F–öç2ç6öÖR†—FVÓÓæ—FVÒæ6†V6²‚’bb6†–WfVÖVçE7FFU¶—FVÒæ–EÒ“°¢6öç7B†4W‡ÆWfVÅW×G—VöbvWDW†—7F–æu'G”–æFW†W3ÓÓÒ&gVæ7F–öâ"bfvWDW†—7F–æu'G”–æFW†W2‚’ç6öÖR†–æFWƒÓç°¢6öç7B6†&7FW#ÖvWE'G”6†&7FW$'”–æFW‚†–æFW‚“°¢6öç7BÖ„ÆWfVÃÔÖF‚æÖ‚ƒÄçVÖ&W"‡v–æF÷rçc34Ö„ÆWfVÂ—ÇÃ“°¢&WGW&â†6†&7FW"bdçVÖ&W"†6†&7FW"æÆWfVÂ“ÆÖ„ÆWfVÂbdçVÖ&W"‡6†&VDW‡“ãÔÖF‚æÖ‚ƒÄçVÖ&W"†6†&7FW"æW‡æW‡B—ÇÃ’“°¢Ò“°¢6öç7B&VÆV6Tææ÷Væ6VÖVçEVç&VCĞ¢€¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRb`¢G—Vöbv–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ†5Vç&VE&VÆV6Tæ÷F–6SÓÓÒ&gVæ7F–öâ"b`¢v–æF÷räf÷W%7–Ö&öÇ5&VÆV6UWFFRæ†5Vç&VE&VÆV6Tæ÷F–6R‚¢“°¢6öç7Bææ÷Væ6VÖVçEVç&VCĞ¢Æö6Å7F÷&vRævWD—FVÒ„ääõTä4TÔTåEõ$TEô´U’’ÓÒ#'ÇÀ¢&VÆV6Tææ÷Væ6VÖVçEVç&VC°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT–6öåVW7B"“òç&VçDVÆVÖVçBÆ†5VW7Dæ÷F–6RÂ.K»¾X¹iÈik˜.[ªb"“°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT–6öä6†–WfVÖVçB"“òç&VçDVÆVÖVçBÆ†46†–WfVÖVçBÂ.h‰[Xúşš	Xùb"“°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT–6öä6†&7FW""“òç&VçDVÆVÖVçBÆ†4W‡ÆWfVÅWÂ.{i>š™~kXúşŠé>Šy.ˆ›.XØ~{I¢"“°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT‡VDW‡fÇVR"“òç&VçDVÆVÖVçBÆ†4W‡ÆWfVÅWÂ.{i>š™~kXúşŠé>Šy.ˆ›.XØ~{I¢"“°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT–6öäöffÆ–æTW‡"“òç&VçDVÆVÖVçBÇVæF–ætöffÆ–æTW‡ãÂ.iÈ™º.{y®{i>š™~Xúşš	Xùb"“°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖT–6öäææ÷Væ6VÖVçB"“òç&VçDVÆVÖVçBÆææ÷Væ6VÖVçEVç&VBÂ.XZÎY®iÊ®Šè"“°¢6öç7BGVævVöåVæF–æsÕ²&W‡"Â&ÖFW&–Â"Â&WV—ÖVçB%Òç6öÖR‡G—SÓà¢v–æF÷rçc3$—4GVævVöåW6VEFöF—ÇÂv–æF÷rçc3$—4GVævVöåW6VEFöF’‡G—R¢“°¢6WDæ÷F–f–6F–öäF÷B†Fö7VÖVçBævWDVÆVÖVçD'”–B‚&GVævVöäæb"’ÆGVævVöåVæF–ærÂ.XšşiÊÎ[	®iÊ®ZèÎh‰"“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"6ÖvTæb'WGFöå¶&–ÖÆ&VÃÒ~K»¾X¹’uÒÂ7cCGVævVöäæb'WGFöå¶&–ÖÆ&VÃÒ~K»¾X¹’uÒ"¢æf÷$V6‚†'WGFöãÓç6WDæ÷F–f–6F–öäF÷B†'WGFöâÆ†5VW7Dæ÷F–6RÂ.K»¾X¹iÈik˜.[ªb"’“°¢Ğ¢v–æF÷rçcCWFFTæ÷F–f–6F–öäF÷G3×WFFTæ÷F–f–6F–öäF÷G3° ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢6†&VB÷Vâ÷6†÷r÷WFFRw&W'0¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢–b‡G—Vöb÷Vä†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ÷Vä†öÖTfVGW&SÖ÷Vä†öÖTfVGW&S°¢÷Vä†öÖTfVGW&SÖgVæ7F–öâ‡G—R—°¢6öç7B&W7VÇCÖ÷&–v–æÄ÷Vä†öÖTfVGW&RæÇ’‡F†—2Æ&wVÖVçG2“°¢–b‡G—SÓÓÒ&ææ÷Væ6VÖVçB"—°¢G'—²Æö6Å7F÷&vRç6WD—FVÒ„ääõTä4TÔTåEõ$TEô´U’Â#"“²Ö6F6‚…ò—²Ğ¢Ğ¢–b‡G—SÓÓÒ&WFô&GFÆU6WGF–æw2"—²6WEF–ÖV÷WB†6ö×7DVÆVÖVçD&÷…æVÂÃ“²Ğ¢WFFTæ÷F–f–6F–öäF÷G2‚“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢–b‡G—Vöb6†÷uvSÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÅ6†÷uvS×6†÷uvS°¢6†÷uvSÖgVæ7F–öâ‡vR—°¢6öç7B&W7VÇCÖ÷&–v–æÅ6†÷uvRæÇ’‡F†—2Æ&wVÖVçG2“°¢6öç7BÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&"“°¢–b†—²æ6Æ74Æ—7BçFövvÆR‚'cCÖGVævVöâÖ7F—fR"ÇvSÓÓÒ&GVævVöâ"“²Ğ¢–b‡vSÓÓÒ&GVævVöâ"—°¢–ç7FÆÄGVævVöäæf–vF–öâ‚“°¢6öç7B6öçFVçCÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&GVævVöåF$6öçFVçB"“°¢–b†6öçFVçBbb6öçFVçBæ–ææW$…DÔÂçG&–Ò‚’—²7v—F6„GVævVöåF"‚&F–Ç’"“²Ğ¢Ğ¢–b‡vSÓÓÒ&Ö"—°¢–ç7FÆÅG&öÄ6Æ–6´Ö÷fVÖVçB‚“°¢Ğ¢WFFTæ÷F–f–6F–öäF÷G2‚“°¢&WGW&â&W7VÇC°¢Ó°¢Ğ ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢vÆö&ÂFfVVF&6°¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢ÆWBvÆö&ÅF&—ÆTæöFSÖçVÆÃ°¢ÆWBvÆö&ÅF&—ÆU&VÖ÷fÅF–ÖW#Ó°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"ÆgVæ7F–öâ†WfVçB—°¢–b†WfVçBçö–çFW%G—SÓÓÒ&Ö÷W6R"bfWfVçBæ'WGFöâÓÓ—²&WGW&ã²Ğ¢–b†WfVçBçF&vWBbgG—VöbWfVçBçF&vWBæ6Æ÷6W7CÓÓÒ&gVæ7F–öâ"bfWfVçBçF&vWBæ6Æ÷6W7B‚"6&GFÆUvR"’—²&WGW&ã²Ğ¢ÆWB&—ÆSÖvÆö&ÅF&—ÆTæöFS°¢–b‚&—ÆWÇÂ&—ÆRæ—46öææV7FVB—°¢&—ÆSÖFö7VÖVçBæ7&VFTVÆVÖVçB‚'7â"“°¢&—ÆRæ6Æ74æÖSÒ'cC×F×&—ÆR#°¢vÆö&ÅF&—ÆTæöFS×&—ÆS°¢Fö7VÖVçBæ&öG’æVæD6†–ÆB‡&—ÆR“°¢Ğ¢&—ÆRç7G–ÆRæÆVgCÖWfVçBæ6Æ–VçE‚²'‚#°¢&—ÆRç7G–ÆRçF÷ÖWfVçBæ6Æ–VçE’²'‚#°¢&—ÆRæ6Æ74Æ—7Bç&VÖ÷fR‚&—2Ö7F—fR"“°¢fö–B&—ÆRæöfg6WEv–GFƒ°¢&—ÆRæ6Æ74Æ—7BæFB‚&—2Ö7F—fR"“°¢–b†vÆö&ÅF&—ÆU&VÖ÷fÅF–ÖW"—²6ÆV%F–ÖV÷WB†vÆö&ÅF&—ÆU&VÖ÷fÅF–ÖW"“²Ğ¢vÆö&ÅF&—ÆU&VÖ÷fÅF–ÖW#×6WEF–ÖV÷WB‚‚“Óç°¢vÆö&ÅF&—ÆU&VÖ÷fÅF–ÖW#Ó°¢–b‡&—ÆSÓÓÖvÆö&ÅF&—ÆTæöFR—°¢&—ÆRç&VÖ÷fR‚“°¢vÆö&ÅF&—ÆTæöFSÖçVÆÃ°¢Ğ¢ÒÃS#“°¢ÒÇ·76—fS§G'VWÒ“° ¢gVæ7F–öâ&ö÷B‚—°¢–ç7FÆÄGVævVöäæf–vF–öâ‚“°¢–ç7FÆÅG&öÄ6Æ–6´Ö÷fVÖVçB‚“°¢–ç7FÆÅF6µG&6¶W"‚“°¢Vç7W&T–çfVçF÷'•vW"‚“°¢WFFTæ÷F–f–6F–öäF÷G2‚“°¢6öç7B&Wf–WsÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆÄVÆVÖVçE6¶–ÆÅ&Wf–WtÖöFÂ"“°¢–b‡&Wf–Wrbg&Wf–Wrç&VçDVÆVÖVçBÓÖFö7VÖVçBæ&öG’—²Fö7VÖVçBæ&öG’æVæD6†–ÆB‡&Wf–Wr“²&Wf–Wræ6Æ74Æ—7BæFB‚'cCÖ&öG’×&Wf–Wr"“²Ğ¢Ğ¢–b†Fö7VÖVçBç&VG•7FFSÓÓÒ&ÆöF–ær"—°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚$DôÔ6öçFVçDÆöFVB"Æ&ö÷BÇ¶öæ6S§G'VWÒ“°¢ÖVÇ6W²&ö÷B‚“²Ğ§Ò’‚“°  ¢ò¢'VæFÆVB6÷W&6S¢§2ó3b×cCÖ6öçFVçB×7—7FV×2æ§2¢ğ¢ò ¢cC(	B7–çF†W6—2æBf—fRÖfÆö÷"'—72GVævVöâà¢F†—2Æ–W"&WW6W2c3"–çfVçF÷'’öGVævVöâ'&–FvW2æB¶VW2F†RÆVv7’6öÖ&@¢Væv–æR–çF7Bà¢¢ğ¢†gVæ7F–öâ–ç7FÆÅcC6öçFVçE7—7FV×2‚—°¢'W6R7G&–7B#° ¢6öç7B%•55õ5Dõ$tUô´U“×v–æF÷räf÷W%7–Ö&öÇ466÷VçE6fRæ66÷VçD¶W’‚&ÆVv7’Ö'—72×7FFR"“°¢6öç7BD”U%ôÄ”4U3×¶Æ÷s¢'v†—FR"ÆÖ–C¢&&ÇVR"Æ†–vƒ¢'W'ÆR"ÇW&fV7C¢&÷&ævR'Ó°¢6öç7BD”U%ôõ$DU#Õ²'v†—FR"Â&&ÇVR"Â'W'ÆR"Â&÷&ævR"Â'–æ²"Â&f÷W"×7–Ö&öÂ%Ó°¢6öç7BDÄ•4ÔåõD”U%ôõ$DU#Õ²'v†—FR"Â&&ÇVR"Â'W'ÆR"Â&÷&ævR%Ó°¢6öç7BD”U%ôÔUD×°¢v†—FS§¶Æ&VÃ¢.y›Ş™¨â"Æf–Æ&ÆS§G'VRÆ7&gDvöÆC£SÇ&Vf÷&vTvöÆC£ÆÖ–ã¥³ÃUÒÇ&Vf÷&vTÖ–ã¥³Ã5×ÒÀ¢&ÇVS§¶Æ&VÃ¢.‰xŞ™¨â"Æf–Æ&ÆS§G'VRÆ7&gDvöÆC£SÇ&Vf÷&vTvöÆC£3ÆÖ–ã¥³2Ã…ÒÇ&Vf÷&vTÖ–ã¥³"ÃU×ÒÀ¢W'ÆS§¶Æ&VÃ¢.{J¾™¨â"Æf–Æ&ÆS§G'VRÆ7&gDvöÆC£CÇ&Vf÷&vTvöÆC£ƒÆÖ–ã¥³RÃÒÇ7V#¥³Ã5ÒÇ&Vf÷&vTÖ–ã¥³BÃuÒÇ&Vf÷&vU7V#¥³Ã%×ÒÀ¢÷&ævS§¶Æ&VÃ¢.j™™¨â"Æf–Æ&ÆS§G'VRÆ7&gDvöÆC£Ç&Vf÷&vTvöÆC£#ÆÖ–ã¥³rÃEÒÇ7V#¥³"ÃUÒÇ&Vf÷&vTÖ–ã¥³bÃÒÇ&Vf÷&vU7V#¥³"ÃE×ÒÀ¢–æ³§¶Æ&VÃ¢.j>{H^™¨â"Æf–Æ&ÆS¦fÇ6RÇÆææVC§G'VWÒÀ¢&f÷W"×7–Ö&öÂ#§¶Æ&VÃ¢.Y¹¾‹™¨â"Æf–Æ&ÆS¦fÇ6RÇÆææVC§G'VWĞ¢Ó°¢gVæ7F–öâæ÷&ÖÆ—¦UF–W$¶W’‡fÇVR—°¢6öç7B¶W“Õ7G&–ær‡fÇVWÇÂ""’çFôÆ÷vW$66R‚“°¢&WGW&âD”U%ôÄ”4U5¶¶W•×ÇÆ¶W“°¢Ğ¢6öç7B4ÄõEôÔUD×°¢†VC§¶Æ&VÃ¢.š
Ş˜:‚"ÇG—S¢&†VB"ÆvÇ—ƒ¢.Xj'ÒÀ¢6†÷VÆFW#§¶Æ&VÃ¢.ŠÛ~ˆYR"ÇG—S¢'6†÷VÆFW""ÆvÇ—ƒ¢.ˆYR'ÒÀ¢6†öW3§¶Æ&VÃ¢.™è¾ZÙ"ÇG—S¢'6†öW2"ÆvÇ—ƒ¢.[R'ÒÀ¢†æC§¶Æ&VÃ¢.jÚnYš‚"ÇG—S¢'vVöâ"ÆvÇ—ƒ¢.Xˆ2'ÒÀ¢&Ö÷#§¶Æ&VÃ¢.Š>iÈÒ"ÇG—S¢&&Ö÷""ÆvÇ—ƒ¢.yK"'Ğ¢Ó°¢6öç7B4U$”U3Õ°¢·6WD–C¢'6WDf—&R"ÆÆ&VÃ¢.‹ZNx(â"ÆVÆVÖVçC¢&f—&R"Æ6öÆ÷#¢"6S#F#3"'ÒÀ¢·6WD–C¢'6WEvFW""ÆÆ&VÃ¢.Zù.k8’"ÆVÆVÖVçC¢'vFW""Æ6öÆ÷#¢"3F&#–S‚'ÒÀ¢·6WD–C¢'6WDV'F‚"ÆÆ&VÃ¢.[*[+2"ÆVÆVÖVçC¢&V'F‚"Æ6öÆ÷#¢"63S–SB'ÒÀ¢·6WD–C¢'6WEv–æB"ÆÆ&VÃ¢.™Ù.[Y"ÆVÆVÖVçC¢'v–æB"Æ6öÆ÷#¢"3SV6F2'Ğ¢Ó°¢6öç7B5DEôÄ$TÃ×¶GF6³¢.iK¾i8¢"Æ–çFVÆÆ–vVæ6S¢.i›®X©²"Çf—FÆ—G“¢.š¹N‹:¢"ÆVæW&w“¢.ˆ;Ş˜xò"Æv–Æ—G“¢.iXşhÛr"Ç7—&—C¢.{+îzYâ'Ó°¢6öç7BÔ”åõ5DE3Õ²&GF6²"Â&–çFVÆÆ–vVæ6R%Ó°¢6öç7B5T%õ5DE3Õ²'f—FÆ—G’"Â&VæW&w’"Â&v–Æ—G’"Â'7—&—B%Ó°¢6öç7BDÄ•4ÔåôtôÄC×·v†—FS£3Æ&ÇVS£ÇW'ÆS£3Ó°¢6öç7B7–çF†W6—57FFS×°¢F#¢'&Vf÷&vR"Æ&ÇVW&–çD–C¦çVÆÂÇ6W&–W4–C¢'6WDf—&R"Ç&Vf÷&vUV–C¦çVÆÂÀ¢&Vf÷&vTÖFW&–ÅF–W#¢'v†—FR"ÆÆö6¶VE&Vf÷&vT¶W—3¥µÒÀ¢FÆ—6Öä–C¦çVÆÂÇFÆ—6ÖåG“£Æg&vÖVçEG“§·6WDf—&S£Ç6WEvFW#£Ç6WDV'Fƒ£Ç6WEv–æC£ÒÀ¢VæF–æu&Vf÷&vS¦çVÆÀ¢Ó° ¢gVæ7F–öâW66T‡FÖÂ‡fÇVR—°¢&WGW&â7G&–ær‡fÇVSÓÖçVÆÃò"#§fÇVR’ç&WÆ6R‚òbörÂ"f×²"’ç&WÆ6R‚óÂörÂ"fÇC²"¢ç&WÆ6R‚óâörÂ"fwC²"’ç&WÆ6R‚ò"örÂ"gV÷C²"’ç&WÆ6R‚òrörÂ"b33“²"“°¢Ğ ¢gVæ7F–öâFVf–æ—F–öç2‚—°¢&WGW&âv–æF÷rçc3$vWD6öçFVçDFVf–æ—F–öç3÷v–æF÷rçc3$vWD6öçFVçDFVf–æ—F–öç2‚“§°¢FÆ—6Öç3¥µÒÆ÷&W3¥µÒÆ&ÇVW&–çG3¥µÒÇF–6¶WG3¥µÒÆWV—ÖVçE6WG3¥µÒÆWV—ÖVçE6WD—FV×3¥µĞ¢Ó°¢Ğ ¢gVæ7F–öâ7ft–6öâ†vÇ—‚Æ6öÆ÷"—°¢&WGW&âsÇ7frf–Wt&÷ƒÒ#cBcB"&–Ö†–FFVãÒ'G'VR#ãÆFVg3ãÆÆ–æV$w&F–VçB–CÒ'cCr"ƒÒ#"“Ò#"ƒ#Ò#"“#Ò##ãÇ7F÷7F÷Ö6öÆ÷#Ò"3&##b"óãÇ7F÷öfg6WCÒ#"7F÷Ö6öÆ÷#Ò"3ƒsb"óãÂöÆ–æV$w&F–VçCãÂöFVg3ãÇ&V7BƒÒ#2"“Ò#2"v–GFƒÒ#S‚"†V–v‡CÒ#S‚"'ƒÒ#""f–ÆÃÒ'W&Â‚7cCr’"7G&ö¶SÒ"r¶6öÆ÷"²r"7G&ö¶R×v–GFƒÒ#2"óãÆ6—&6ÆR7ƒÒ#3""7“Ò#3""#Ò#’"f–ÆÃÒ&æöæR"7G&ö¶SÒ"r¶6öÆ÷"²r"7G&ö¶RÖ÷6—G“Ò"ãCR"7G&ö¶R×v–GFƒÒ#""óãÇFW‡BƒÒ#3""“Ò#C"FW‡BÖæ6†÷#Ò&Ö–FFÆR"föçB×6—¦SÒ##""föçB×vV–v‡CÒ#“"f–ÆÃÒ"r¶6öÆ÷"²r#âr¶vÇ—‚²sÂ÷FW‡CãÂ÷7fsâs°¢Ğ ¢6öç7Bg&vÖVçDFVf–æ—F–öç3Õ4U$”U2æÖ‡6W&–W3Óâ‡°¢–C¢&g&vÖVçB"·6W&–W2ç6WD–Bæ6†$Bƒ’çFõWW$66R‚’·6W&–W2ç6WD–Bç6Æ–6Rƒ’À¢æÖS§6W&–W2æÆ&VÂ².z(îx˜r"ÇG—S¢&ÖFW&–Â"Ç6WD–C§6W&–W2ç6WD–BÇF–W$¶W“¢&g&vÖVçB"À¢–6öã§7ft–6öâ‚.z(â"Ç6W&–W2æ6öÆ÷"’Ç&–6S£Ç7FG3§·Ğ¢Ò’“°¢gVæ7F–öâvWDg&vÖVçDFVf–æ—F–öâ‡6WD–B—²&WGW&âg&vÖVçDFVf–æ—F–öç2æf–æB†—FVÓÓæ—FVÒç6WD–CÓÓ×6WD–B—ÇÆçVÆÃ²Ğ ¢gVæ7F–öâ6÷VçD—FVÒ†—FVÔ–B—°¢&WGW&â–çfVçF÷'”—FV×2ç&VGV6R‚‡7VÒÆ—FVÒ“Óç7VÒ²†—FVÒbf—FVÒæ–CÓÓÖ—FVÔ–CôÖF‚æÖ‚ƒÄçVÖ&W"†—FVÒæ6÷VçB—ÇÃ“£’Ã“°¢Ğ¢gVæ7F–öâ6÷VçDÖF6†–ær‡&VF–6FR—°¢&WGW&â–çfVçF÷'”—FV×2ç&VGV6R‚‡7VÒÆ—FVÒ“Óç7VÒ²†—FVÒbg&VF–6FR†—FVÒ“ôÖF‚æÖ‚ƒÄçVÖ&W"†—FVÒæ6÷VçB—ÇÃ“£’Ã“°¢Ğ¢gVæ7F–öâ6öç7VÖTÖF6†–ær‡&VF–6FRÆÖ÷VçB—°¢ÆWB&VÖ–æ–æsÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢–b†6÷VçDÖF6†–ær‡&VF–6FR“Ç&VÖ–æ–ær—²&WGW&âfÇ6S²Ğ¢f÷"†ÆWB–æFWƒÖ–çfVçF÷'”—FV×2æÆVæwF‚Ó¶–æFWƒãÓbg&VÖ–æ–æsã¶–æFW‚ÒÒ—°¢6öç7B—FVÓÖ–çfVçF÷'”—FV×5¶–æFW…Ó°¢–b‚—FV×ÇÂ&VF–6FR†—FVÒ’—²6öçF–çVS²Ğ¢6öç7B6÷VçCÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†—FVÒæ6÷VçB—ÇÃ’“°¢6öç7BF¶SÔÖF‚æÖ–â†6÷VçBÇ&VÖ–æ–ær“°¢–b†6÷VçCÓÓ×F¶R—²–çfVçF÷'”—FV×2ç7Æ–6R†–æFW‚Ã“²Ğ¢VÇ6W²—FVÒæ6÷VçCÖ6÷VçB×F¶S²Ğ¢&VÖ–æ–ærÓ×F¶S°¢Ğ¢&WGW&â&VÖ–æ–æsÓÓÓ°¢Ğ ¢gVæ7F–öâ'Vä–çfVçF÷'•G&ç67F–öâ†÷W&F–öâ—°¢&WGW&âv–æF÷rçc3%'Vä–çfVçF÷'•G&ç67F–öã÷v–æF÷rçc3%'Vä–çfVçF÷'•G&ç67F–öâ†÷W&F–öâ“¢÷W&F–öâ‚“°¢Ğ¢gVæ7F–öâFD—FVÒ†FVf–æ—F–öâÆÖ÷VçB—°¢&WGW&â‡v–æF÷rçc3$FD—FVÕFô–çfVçF÷'’bgv–æF÷rçc3$FD—FVÕFô–çfVçF÷'’†FVf–æ—F–öâÆÖ÷VçB’“°¢Ğ ¢gVæ7F–öâÖ¶UV–B‡&Vf—‚—°¢&WGW&â&Vf—‚²%ò"´FFRææ÷r‚’çFõ7G&–ærƒ3b’²%ò"´ÖF‚ç&æFöÒ‚’çFõ7G&–ærƒ3b’ç6Æ–6Rƒ"Ã’“°¢Ğ¢gVæ7F–öâVç7W&TWV—ÖVçEV–G2‚—°¢ÆWB6†ævVCÖfÇ6S°¢–çfVçF÷'”—FV×2æf÷$V6‚†—FVÓÓç°¢–b†—FVÒbf—4WV—ÖVçD–çfVçF÷'•G—R†—FVÒçG—R’bb—FVÒçcCV–B—²—FVÒçcCV–CÖÖ¶UV–B‚&&r"“²6†ævVC×G'VS²Ğ¢Ò“°¢ö&¦V7BçfÇVW2†6†&7FW$WV—ÖVçGÇÇ·Ò’æf÷$V6‚†WV—ÖVçCÓç°¢ö&¦V7BçfÇVW2†WV—ÖVçGÇÇ·Ò’æf÷$V6‚†—FVÓÓç°¢–b†—FVÒbb—FVÒçcCV–B—²—FVÒçcCV–CÖÖ¶UV–B‚&WV—"“²6†ævVC×G'VS²Ğ¢Ò“°¢Ò“°¢–b†6†ævVBbgG—Vöb6fTvÖSÓÓÒ&gVæ7F–öâ"—²6fTvÖR‚“²Ğ¢Ğ ¢gVæ7F–öâ&Vf÷&vU6Æ÷D6÷VçB†—FVÒ—°¢–b‚—FVÒ—²&WGW&â²Ğ¢6öç7BW‡Æ–6—CÔÖF‚æÖ‚ƒÄÖF‚æfÆö÷"„çVÖ&W"†—FVÒç&Vf÷&vU6Æ÷G2—ÇÃ’“°¢6öç7BW†—7F–æsÖ—FVÒç&Vf÷&vU7FG2bgG—Vöb—FVÒç&Vf÷&vU7FG3ÓÓÒ&ö&¦V7B#ôö&¦V7Bæ¶W—2†—FVÒç&Vf÷&vU7FG2’æÆVæwFƒ£°¢6öç7B6Æ÷G3ÔÖF‚æÖ‚†W‡Æ–6—BÆW†—7F–ær“°¢–b‡6Æ÷G3æW‡Æ–6—B—²—FVÒç&Vf÷&vU6Æ÷G3×6Æ÷G3²Ğ¢–b†—FVÒç&Vf÷&vUW6VB—²—FVÒç&Vf÷&vUW6VCÓ²Ğ¢&WGW&â6Æ÷G3°¢Ğ¢gVæ7F–öâ6ä7GVÆÇ•&Vf÷&vR†—FVÒ—°¢&WGW&â†—FVÒbf—FVÒçcs3SÆö6¶VBÓ×G'VRbg&Vf÷&vU6Æ÷D6÷VçB†—FVÒ“ã“°¢Ğ¢gVæ7F–öâ&Vf÷&vTÖFW&–Ä–æfò‡F–W$¶W’—°¢6öç7Bæ÷&ÖÆ—¦VCÖæ÷&ÖÆ—¦UF–W$¶W’‡F–W$¶W’“°¢6öç7BF–W#ÕD”U%ôÔUD¶æ÷&ÖÆ—¦VEÓöæ÷&ÖÆ—¦VC¢'v†—FR#°¢6öç7BÖWFÕD”U%ôÔUD·F–W%Ó°¢6öç7B÷&SÖFVf–æ—F–öç2‚’æ÷&W2æf–æB†—FVÓÓææ÷&ÖÆ—¦UF–W$¶W’†—FVÒçF–W$¶W’“ÓÓ×F–W"—ÇÆçVÆÃ°¢6öç7B&ÇVW&–çD6÷VçCÖ6÷VçDÖF6†–ær†—FVÓÓæ—FVÒbf—FVÒæ&ÇVW&–çE6Æ÷Bbfæ÷&ÖÆ—¦UF–W$¶W’†—FVÒçF–W$¶W’“ÓÓ×F–W"“°¢6öç7B÷&T6÷VçCÖ÷&Sö6÷VçD—FVÒ†÷&Ræ–B“£°¢&WGW&â·F–W"ÆÖWFÆ÷&RÆ&ÇVW&–çD6÷VçBÆ÷&T6÷VçGÓ°¢Ğ¢gVæ7F–öâ&Vf÷&vTÖFW&–Ä6÷7B†Æö6´6÷VçB—°¢6öç7BÆö6·3ÔÖF‚æÖ‚ƒÄÖF‚æÖ–âƒ"ÄÖF‚æfÆö÷"„çVÖ&W"†Æö6´6÷VçB—ÇÃ’’“°¢&WGW&âÆö6·3ÓÓÓóS¢†Æö6·3ÓÓÓó£S“°¢Ğ¢gVæ7F–öâæ÷&ÖÆ—¦U&Vf÷&vTÆö6·2†—FVÒ—°¢6öç7B7W'&VçCÖ—FVÒbf—FVÒç&Vf÷&vU7FG2bgG—Vöb—FVÒç&Vf÷&vU7FG3ÓÓÒ&ö&¦V7B#ôö&¦V7Bæ¶W—2†—FVÒç&Vf÷&vU7FG2“¥µÓ°¢6öç7BÖ„Æö6·3ÔÖF‚æÖ–âƒ"ÄÖF‚æÖ‚ƒÇ&Vf÷&vU6Æ÷D6÷VçB†—FVÒ’Ó’“°¢7–çF†W6—57FFRæÆö6¶VE&Vf÷&vT¶W—3Ò‡7–çF†W6—57FFRæÆö6¶VE&Vf÷&vT¶W—7ÇÅµÒ¢æf–ÇFW"†¶W“Óæ7W'&VçBæ–æ6ÇVFW2†¶W’’’ç6Æ–6RƒÆÖ„Æö6·2“°¢&WGW&â7–çF†W6—57FFRæÆö6¶VE&Vf÷&vT¶W—3°¢Ğ¢gVæ7F–öâÆÅ&Vf–æ&ÆTWV—ÖVçB‚—°¢Vç7W&TWV—ÖVçEV–G2‚“°¢6öç7B&W7VÇG3ÕµÓ°¢–çfVçF÷'”—FV×2æf÷$V6‚†—FVÓÓç°¢–b†—FVÒbf—4WV—ÖVçD–çfVçF÷'•G—R†—FVÒçG—R’bf6ä7GVÆÇ•&Vf÷&vR†—FVÒ’—²&W7VÇG2çW6‚‡¶—FVÒÇ6÷W&6S¢.ˆ8ÎXÈR'Ò“²Ğ¢Ò“°¢ö&¦V7Bæ¶W—2†6†&7FW$WV—ÖVçGÇÇ·Ò’æf÷$V6‚†6†&7FW$¶W“Óç°¢ö&¦V7BçfÇVW2†6†&7FW$WV—ÖVçE¶6†&7FW$¶W•×ÇÇ·Ò’æf÷$V6‚†—FVÓÓç°¢–b†—FVÒbf6ä7GVÆÇ•&Vf÷&vR†—FVÒ’—²&W7VÇG2çW6‚‡¶—FVÒÇ6÷W&6S¢.[{.Š9ŞX)’'Ò“²Ğ¢Ò“°¢Ò“°¢&WGW&â&W7VÇG3°¢Ğ¢gVæ7F–öâf–æDWV—ÖVçD'•V–B‡V–B—°¢6öç7BVçG'“ÖÆÅ&Vf–æ&ÆTWV—ÖVçB‚’æf–æB†6æF–FFSÓæ6æF–FFRæ—FVÒçcCV–CÓÓ×V–B“°¢&WGW&âVçG'“öVçG'’æ—FVÓ¦çVÆÃ°¢Ğ ¢gVæ7F–öâ–æfW%F–W"†—FVÒ—°¢6öç7BFV6Æ&VCÖæ÷&ÖÆ—¦UF–W$¶W’†—FVÒbf—FVÒçF–W$¶W’“°¢–b…D”U%ôÔUD¶FV6Æ&VEÒ—²&WGW&âFV6Æ&VC²Ğ¢–b†—FVÒbf—FVÒç6WD–B—²&WGW&â&÷&ævR#²Ğ¢6öç7BF÷FÃÔö&¦V7BçfÇVW2†—FVÒbf—FVÒç7FG7ÇÇ·Ò’ç&VGV6R‚‡7VÒÇfÇVR“Óç7VÒ´ÖF‚æ'2„çVÖ&W"‡fÇVR—ÇÃ’Ã“°¢–b‡F÷FÃãÓ‚—²&WGW&â&÷&ævR#²Ğ¢–b‡F÷FÃãÓ—²&WGW&â'W'ÆR#²Ğ¢–b‡F÷FÃãÓR—²&WGW&â&&ÇVR#²Ğ¢&WGW&â'v†—FR#°¢Ğ ¢gVæ7F–öâ&öÆÅVæ–f÷&Ò†Ö–âÆÖ‚—²&WGW&âÖ–â´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¢†Ö‚ÖÖ–â³’“²Ğ¢gVæ7F–öâ&öÆÅ6–ævÆUV²‡&ævR—°¢&WGW&âÖF‚ç&æFöÒ‚“Âã÷&ævU³Ó§&öÆÅVæ–f÷&Ò‡&ævU³ÒÄÖF‚æÖ‚‡&ævU³ÒÇ&ævU³ÒÓ’“°¢Ğ¢gVæ7F–öâ&öÆÄff—†W2‡F–W$¶W’Æ—5&Vf÷&vR—°¢6öç7BF–W#Öæ÷&ÖÆ—¦UF–W$¶W’‡F–W$¶W’“°¢6öç7BÖWFÕD”U%ôÔUD·F–W%Ó°¢–b‚ÖWFÇÆÖWFæf–Æ&ÆSÓÓÖfÇ6WÇÂ'&’æ—4'&’†ÖWFæÖ–â’—²F‡&÷ræWrW'&÷"‚.jÚN™¨î{I®[	®iÊ®™h¾iKîi[XÎŠŠŞZé®ûÉ¢"·F–W"“²Ğ¢6öç7BÖ–å&ævSÖ—5&Vf÷&vSöÖWFç&Vf÷&vTÖ–ã¦ÖWFæÖ–ã°¢6öç7B7V%&ævSÖ—5&Vf÷&vSöÖWFç&Vf÷&vU7V#¦ÖWFç7V#°¢6öç7B7FG3×·Ó°¢6öç7BÖ–ãÔÔ”åõ5DE5´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¤Ô”åõ5DE2æÆVæwF‚•Ó°¢–b‚7V%&ævR—²7FG5¶Ö–åÓ×&öÆÅ6–ævÆUV²†Ö–å&ævR“²&WGW&â7FG3²Ğ¢6öç7B7V#Õ5T%õ5DE5´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¥5T%õ5DE2æÆVæwF‚•Ó°¢–b„ÖF‚ç&æFöÒ‚“ÂãR—°¢7FG5¶Ö–åÓÖÖ–å&ævU³Ó°¢7FG5·7V%Ó×7V%&ævU³Ó°¢&WGW&â7FG3°¢Ğ¢ÆWBÖ–åfÇVS×&öÆÅVæ–f÷&Ò†Ö–å&ævU³ÒÆÖ–å&ævU³Ò“°¢ÆWB7V%fÇVS×&öÆÅVæ–f÷&Ò‡7V%&ævU³ÒÇ7V%&ævU³Ò“°¢–b†Ö–åfÇVSÓÓÖÖ–å&ævU³Òbg7V%fÇVSÓÓ×7V%&ævU³Ò—°¢–b„ÖF‚ç&æFöÒ‚“ÂãR—²Ö–åfÇVS×&öÆÅVæ–f÷&Ò†Ö–å&ævU³ÒÄÖF‚æÖ‚†Ö–å&ævU³ÒÆÖ–å&ævU³ÒÓ’“²Ğ¢VÇ6W²7V%fÇVS×&öÆÅVæ–f÷&Ò‡7V%&ævU³ÒÄÖF‚æÖ‚‡7V%&ævU³ÒÇ7V%&ævU³ÒÓ’“²Ğ¢Ğ¢7FG5¶Ö–åÓÖÖ–åfÇVS°¢7FG5·7V%Ó×7V%fÇVS°¢&WGW&â7FG3°¢Ğ¢v–æF÷rçcC&öÆÄ7&gDff—†W3×&öÆÄff—†W3° ¢gVæ7F–öâ&Vf÷&vU&ævTf÷%6Æ÷B‡F–W$¶W’Ç6Æ÷D–æFW‚—°¢6öç7BÖWFÕD”U%ôÔUD¶æ÷&ÖÆ—¦UF–W$¶W’‡F–W$¶W’•×ÇÅD”U%ôÔUDçv†—FS°¢–b†ÖWFæf–Æ&ÆSÓÓÖfÇ6WÇÂ'&’æ—4'&’†ÖWFç&Vf÷&vTÖ–â’—²&WGW&âçVÆÃ²Ğ¢–b‡6Æ÷D–æFWƒÃÓ—²&WGW&âÖWFç&Vf÷&vTÖ–ã²Ğ¢&WGW&âÖWFç&Vf÷&vU7V'ÇÆÖWFç&Vf÷&vTÖ–ã°¢Ğ¢gVæ7F–öâ&Vf÷&vU&ævUFW‡B‡F–W$¶W’Ç6Æ÷D6÷VçB—°¢6öç7BÖWFÕD”U%ôÔUD¶æ÷&ÖÆ—¦UF–W$¶W’‡F–W$¶W’•×ÇÅD”U%ôÔUDçv†—FS°¢–b†ÖWFæf–Æ&ÆSÓÓÖfÇ6WÇÂ'&’æ—4'&’†ÖWFç&Vf÷&vTÖ–â’—²&WGW&â.[	®iÊ®™h¾iKî8;¾i[XÎ[è^Zé¢#²Ğ¢6öç7BÖ–ãÖÖWFç&Vf÷&vTÖ–ã°¢6öç7B7V#ÖÖWFç&Vf÷&vU7V'ÇÆÖWFç&Vf÷&vTÖ–ã°¢&WGW&â6Æ÷D6÷VçCÃÓ¢ò.Š™îj)Ò"¶Ö–å³Ò².ûÙâ"¶Ö–å³Ğ¢¢.K‹¾j{Ò"¶Ö–å³Ò².ûÙâ"¶Ö–å³Ò².8;¾X[nšIj{Ò"·7V%³Ò².ûÙâ"·7V%³Ó°¢Ğ¢gVæ7F–öâ&öÆÅ&Vf÷&vTff—†W2†—FVÒÇF–W$¶W’ÆÆö6¶VD¶W—2—°¢6öç7B6Æ÷G3×&Vf÷&vU6Æ÷D6÷VçB†—FVÒ“°¢6öç7B7W'&VçCÖ—FVÒbf—FVÒç&Vf÷&vU7FG2bgG—Vöb—FVÒç&Vf÷&vU7FG3ÓÓÒ&ö&¦V7B#ö—FVÒç&Vf÷&vU7FG3§·Ó°¢6öç7B&W7VÇC×·Ó°¢6öç7BW6VCÖæWr6WB‚“°¢6öç7BÆö6·3Ò†Æö6¶VD¶W—7ÇÅµÒ’æf–ÇFW"†¶W“Óäö&¦V7Bç&÷F÷G—Ræ†4÷vå&÷W'G’æ6ÆÂ†7W'&VçBÆ¶W’’’ç6Æ–6RƒÄÖF‚æÖ–âƒ"ÄÖF‚æÖ‚ƒÇ6Æ÷G2Ó’’“°¢Æö6·2æf÷$V6‚†¶W“Óç²&W7VÇE¶¶W•ÓÖ7W'&VçE¶¶W•Ó²W6VBæFB†¶W’“²Ò“°¢6öç7BÖWFÕD”U%ôÔUD¶æ÷&ÖÆ—¦UF–W$¶W’‡F–W$¶W’•×ÇÅD”U%ôÔUDçv†—FS°¢–b†ÖWFæf–Æ&ÆSÓÓÖfÇ6R—²F‡&÷ræWrW'&÷"‚.jÚN™¨î{I®XknxX[	®iÊ®™h¾iKâ"“²Ğ¢6öç7BVæÆö6¶VD6÷VçCÔÖF‚æÖ‚ƒÇ6Æ÷G2ÖÆö6·2æÆVæwF‚“°¢6öç7Bf÷&6TGVÅV³ÖÆö6·2æÆVæwFƒÓÓÓbg6Æ÷G3ãÓ"bbÖWFç&Vf÷&vU7V"bdÖF‚ç&æFöÒ‚“ÂãS°¢ÆWBvVæW&FVCÓ°¢v†–ÆR„ö&¦V7Bæ¶W—2‡&W7VÇB’æÆVæwFƒÇ6Æ÷G2—°¢6öç7BæVVDÖ–ãÒ'&’æg&öÒ‡W6VB’ç6öÖR†¶W“ÓäÔ”åõ5DE2æ–æ6ÇVFW2†¶W’’“°¢6öç7B6Æ÷D–æFWƒÖæVVDÖ–ãó¤ÖF‚æÖ‚ƒÄö&¦V7Bæ¶W—2‡&W7VÇB’æÆVæwF‚“°¢ÆWBööÃÖæVVDÖ–ãôÔ”åõ5DE3¥5T%õ5DE3°¢ÆWBf–Æ&ÆS×ööÂæf–ÇFW"†¶W“ÓâW6VBæ†2†¶W’’“°¢–b‚f–Æ&ÆRæÆVæwF‚—²f–Æ&ÆSÔÔ”åõ5DE2æ6öæ6B…5T%õ5DE2’æf–ÇFW"†¶W“ÓâW6VBæ†2†¶W’’“²Ğ¢–b‚f–Æ&ÆRæÆVæwF‚—²'&V³²Ğ¢6öç7B¶W“Öf–Æ&ÆU´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¦f–Æ&ÆRæÆVæwF‚’Vf–Æ&ÆRæÆVæwF…Ó°¢6öç7B&ævS×&Vf÷&vU&ævTf÷%6Æ÷B‡F–W$¶W’Ç6Æ÷D–æFW‚“°¢ÆWBfÇVS°¢–b†f÷&6TGVÅV²bfvVæW&FVCÃ"—²fÇVS×&ævU³Ó²Ğ¢VÇ6R–b‚ÖWFç&Vf÷&vU7V'ÇÇ6Æ÷G3ÓÓÓ—²fÇVS×&öÆÅ6–ævÆUV²‡&ævR“²Ğ¢VÇ6W²fÇVS×&öÆÅVæ–f÷&Ò‡&ævU³ÒÇ&ævU³Ò“²Ğ¢&W7VÇE¶¶W•Ó×fÇVS°¢W6VBæFB†¶W’“°¢vVæW&FVB²³°¢Ğ¢–b‚f÷&6TGVÅV²bfÆö6·2æÆVæwFƒÓÓÓbg6Æ÷G3ãÓ"bfÖWFç&Vf÷&vU7V"—°¢6öç7BÖ–ä¶W“Ôö&¦V7Bæ¶W—2‡&W7VÇB’æf–æB†¶W“ÓäÔ”åõ5DE2æ–æ6ÇVFW2†¶W’’“°¢6öç7B7V$¶W“Ôö&¦V7Bæ¶W—2‡&W7VÇB’æf–æB†¶W“Óå5T%õ5DE2æ–æ6ÇVFW2†¶W’’“°¢–b†Ö–ä¶W’bg7V$¶W’bg&W7VÇE¶Ö–ä¶W•ÓÓÓÖÖWFç&Vf÷&vTÖ–å³Òbg&W7VÇE·7V$¶W•ÓÓÓÖÖWFç&Vf÷&vU7V%³Ò—°¢–b„ÖF‚ç&æFöÒ‚“ÂãR—²&W7VÇE¶Ö–ä¶W•Ó×&öÆÅVæ–f÷&Ò†ÖWFç&Vf÷&vTÖ–å³ÒÄÖF‚æÖ‚†ÖWFç&Vf÷&vTÖ–å³ÒÆÖWFç&Vf÷&vTÖ–å³ÒÓ’“²Ğ¢VÇ6W²&W7VÇE·7V$¶W•Ó×&öÆÅVæ–f÷&Ò†ÖWFç&Vf÷&vU7V%³ÒÄÖF‚æÖ‚†ÖWFç&Vf÷&vU7V%³ÒÆÖWFç&Vf÷&vU7V%³ÒÓ’“²Ğ¢Ğ¢Ğ¢&WGW&â&W7VÇC°¢Ğ¢v–æF÷rçcs3S…&öÆÅ&Vf÷&vTff—†W3×&öÆÅ&Vf÷&vTff—†W3° ¢gVæ7F–öâ7FG4‡FÖÂ‡7FG2—°¢6öç7BVçG&–W3Ôö&¦V7BæVçG&–W2‡7FG7ÇÇ·Ò“°¢–b‚VçG&–W2æÆVæwF‚—²&WGW&âsÇ7â6Æ73Ò&×WFVB#î[	®xJXknxXŠ™îj)ÓÂ÷7ãâs²Ğ¢&WGW&âVçG&–W2æÖ‚…¶¶W’ÇfÇVUÒ“ÓâsÇ7ãâr¶W66T‡FÖÂ…5DEôÄ$TÅ¶¶W•×ÇÆ¶W’’²rÆ#â²r·fÇVR²sÂö#ãÂ÷7ãâr’æ¦ö–â‚""“°¢Ğ¢gVæ7F–öâ&ævUFW‡B‡F–W$¶W’Æ—5&Vf÷&vR—°¢6öç7BÖWFÕD”U%ôÔUD¶æ÷&ÖÆ—¦UF–W$¶W’‡F–W$¶W’•Ó°¢–b‚ÖWFÇÆÖWFæf–Æ&ÆSÓÓÖfÇ6R—²&WGW&â.[	®iÊ®™h¾iKî8;¾i[XÎ[è^Zé¢#²Ğ¢6öç7BÖ–ãÖ—5&Vf÷&vSöÖWFç&Vf÷&vTÖ–ã¦ÖWFæÖ–ã°¢6öç7B7V#Ö—5&Vf÷&vSöÖWFç&Vf÷&vU7V#¦ÖWFç7V#°¢&WGW&â~K‹¾Š™îj)Òr¶Ö–å³Ò²~ûÙâr¶Ö–å³Ò²‡7V#ò~8;¾XšşŠ™îj)Òr·7V%³Ò²~ûÙâr·7V%³Ó¢rr“°¢Ğ ¢gVæ7F–öâ6†÷u7–çF†W6—5&W7VÇB‡F—FÆRÆ&öG’—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b†ÖöFÂ—°¢ÖöFÂæ6Æ74Æ—7BæFB‚'cCÖ7&gF–ærÖfÆ6‚"“°¢6WEF–ÖV÷WB‚‚“ÓæÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'cCÖ7&gF–ærÖfÆ6‚"’ÃcS“°¢Ğ¢6WEF–ÖV÷WB‚‚“Óç°¢–b‡v–æF÷rçc3%6†÷u&Wv&DÖöFÂ—°¢v–æF÷rçc3%6†÷u&Wv&DÖöFÂ€¢sÆF—b6Æ73Ò'c3"×&Wv&BÖÖöFÂÖ–ææW"#ãÆƒ3âr¶W66T‡FÖÂ‡F—FÆR’²sÂöƒ3âr¶&öG’°¢sÆF—b6Æ73Ò'c3"×&Wv&BÖ7F–öç2#ãÆ'WGFöâG—SÒ&'WGFöâ"öæ6Æ–6³Ò'c3$6Æ÷6U&Wv&DÖöFÂ‚’#îz+®Zé£Âö'WGFöããÂöF—cãÂöF—câp¢ZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^             );
            }
        },480);
    }

    function renderSynthesisTabs(){
        const tabs=[
            ["reforge","è£å‚™å†¶ç…‰"],["talisman","ç¬¦å’’åˆæˆ"],["fragment","ç¢ç‰‡åˆæˆ"]
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
            return '<div class="v141-synthesis-empty">èƒŒåŒ…å…§æ²’æœ‰è£å‚™è¨­è¨ˆåœ–ç´™ã€‚<small>ææ–™å¯¶ç®±å¯å–å¾—åœ–ç´™èˆ‡ç¤¦çŸ³ã€‚</small></div>';
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
            '<label>1ã€€é¸æ“‡è¨­è¨ˆåœ–ç´™<select onchange="v141SelectCraftBlueprint(this.value)">'+blueprints.map(item=>
                '<option value="'+escapeHtml(item.id)+'" '+(item.id===blueprint.id?'selected':'')+'>'+escapeHtml(item.name)+'ï¼ˆ'+countItem(item.id)+'ï¼‰</option>'
            ).join("")+'</select></label>'+
            (blueprintSeries
                ?'<div class="v141-blueprint-series"><span>2ã€€è£å‚™ç³»åˆ—</span><b>'+series.label+'ï¼ˆç”±åœ–ç´™æ±ºå®šï¼‰</b></div>'
                :'<label>2ã€€èˆŠåœ–ç´™ç³»åˆ—<select onchange="v141SelectCraftSeries(this.value)">'+SERIES.map(item=>
                    '<option value="'+item.setId+'" '+(item.setId===series.setId?'selected':'')+'>'+item.label+'</option>'
                ).join("")+'</select><small>åƒ…èˆŠå­˜æª”æ—¢æœ‰åœ–ç´™æ²’æœ‰ç³»åˆ—æ¬„ä½ï¼›æ–°å–å¾—åœ–ç´™æœƒè‡ªå‹•æŒ‡å®šç³»åˆ—ã€‚</small></label>')+
            '<section class="v141-craft-preview"><div class="v141-craft-icon">'+svgIcon(slot.glyph,series.color)+'</div><div><b>'+series.label+meta.label+slot.label+'</b><span>'+rangeText(tier,false)+'</span></div></section>'+
            '<div class="v141-material-lines"><span>åœ–ç´™ <b class="'+(blueprintCount>=50?'ok':'lack')+'">'+blueprintCount+' / 50</b></span>'+
            '<span>'+escapeHtml(ore&&ore.name||meta.label+'ç¤¦çŸ³')+' <b class="'+(oreCount>=50?'ok':'lack')+'">'+oreCount+' / 50</b></span>'+
            '<span>é‡‘å¹£ <b class="'+(gold>=meta.craftGold?'ok':'lack')+'">'+meta.craftGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<button type="button" class="v141-synthesis-primary" '+(canCraft?'':'disabled')+' onclick="v141CraftEquipment()">é–‹å§‹åˆæˆ</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">â“˜ è©æ¢æ©Ÿç‡</button></div>';
    }

    function renderReforgeTab(){
        const entries=allRefinableEquipment();
        if(!entries.length){ return '<div class="v141-synthesis-empty">æ²’æœ‰å¯å†¶ç…‰çš„è£å‚™ã€‚<small>åªæœ‰å…·å‚™è‡³å°‘ 1 å€‹å†¶ç…‰æ§½ã€ä¸”æœªé–å®šçš„è£å‚™æœƒå‡ºç¾åœ¨é€™è£¡ã€‚</small></div>'; }
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
            compare='<div class="v141-reforge-compare"><section><small>ç›®å‰å†¶ç…‰æ•ˆæœ</small>'+statsHtml(item.reforgeStats)+'</section><b>VS</b><section><small>æœ¬æ¬¡æ–°æ•ˆæœãƒ»'+pendingLabel+'ææ–™</small>'+statsHtml(pending.stats)+'</section>'+
                '<div><button onclick="v141ResolveReforge(false)">ä¿ç•™åŸæ•ˆæœ</button><button onclick="v141ResolveReforge(true)">å¥—ç”¨æ–°æ•ˆæœ</button></div></div>';
        }
        const tierButtons=TIER_ORDER.map(key=>{
            const info=reforgeMaterialInfo(key);
            const unavailable=info.meta.available===false;
            return '<button type="button" class="v17358-reforge-tier '+(key===tier?'active ':'')+(unavailable?'planned':'')+'" '+
                (unavailable?'disabled aria-disabled="true"':'onclick="v141SelectReforgeMaterialTier(\''+key+'\')"')+'>'+
                '<b>'+info.meta.label+'ææ–™</b><span>'+(unavailable?'å°šæœªé–‹æ”¾':'åœ–ç´™ '+info.blueprintCount+'ãƒ»ç¤¦çŸ³ '+info.oreCount)+'</span><small>'+reforgeRangeText(key,slotCount)+'</small></button>';
        }).join("");
        const lockHtml=currentEntries.length
            ?currentEntries.map(([key,value])=>{
                const selected=lockSet.has(key);
                return '<button type="button" class="v17358-affix-lock '+(selected?'locked':'')+'" '+(synthesisState.pendingReforge?'disabled':'')+' onclick="v141ToggleReforgeLock(\''+escapeHtml(key)+'\')">'+
                    '<span>'+(selected?'ğŸ”’':'â—‡')+'</span><b>'+escapeHtml(STAT_LABEL[key]||key)+' +'+value+'</b><small>'+(selected?'å·²é–å®š':'é»æ“Šé–å®š')+'</small></button>';
            }).join("")
            :'<div class="v17358-no-affix-lock">é¦–æ¬¡å†¶ç…‰å°šç„¡è©æ¢å¯é–å®šã€‚</div>';
        return '<div class="v141-synthesis-card v17358-reforge-card">'+
            '<label>é¸æ“‡è£å‚™<select onchange="v141SelectReforgeItem(this.value)">'+entries.map(entry=>
                '<option value="'+entry.item.v141Uid+'" '+(entry.item.v141Uid===item.v141Uid?'selected':'')+'>'+escapeHtml(entry.item.name)+'ï¼»'+entry.source+'ï¼½</option>'
            ).join("")+'</select></label>'+
            '<section class="v141-reforge-current"><b>'+escapeHtml(item.name)+'</b><small>å†¶ç…‰æ§½ '+slotCount+' æ ¼ãƒ»å¯ä¸é™æ¬¡æ•¸é‡æ´—</small><div><em>åŸå§‹è©æ¢</em>'+statsHtml(item.stats)+'</div><div><em>ç›®å‰å†¶ç…‰</em>'+statsHtml(item.reforgeStats)+'</div></section>'+
            '<section class="v17358-reforge-material"><div class="v17358-section-title"><b>é¸æ“‡å†¶ç…‰ææ–™éšç´š</b><span>è£å‚™å“è³ªä¸é™åˆ¶ææ–™ï¼›ææ–™éšç´šåªæ±ºå®šæœ¬æ¬¡æ•¸å€¼ç¯„åœã€‚</span></div><div class="v17358-reforge-tiers">'+tierButtons+'</div></section>'+
            '<section class="v17358-reforge-lock-panel"><div class="v17358-section-title"><b>é–å®šè©æ¢</b><span>æœ€å¤šé– 2 æ¢ï¼Œä¸”è‡³å°‘ä¿ç•™ 1 å€‹æ§½ä½é‡æ–°å†¶ç…‰ã€‚</span></div><div class="v17358-reforge-lock-list">'+lockHtml+'</div><small>ç›®å‰é–å®š '+locks.length+' / '+maxLocks+' æ¢</small></section>'+
            '<div class="v141-material-lines v17358-reforge-cost"><span>è¨­è¨ˆåœ– <b class="'+(material.blueprintCount>=materialCost?'ok':'lack')+'">'+material.blueprintCount+' / '+materialCost+'</b></span>'+
            '<span>'+escapeHtml(material.ore&&material.ore.name||material.meta.label+'ç¤¦çŸ³')+' <b class="'+(material.oreCount>=materialCost?'ok':'lack')+'">'+material.oreCount+' / '+materialCost+'</b></span>'+
            '<span>é‡‘å¹£ <b class="'+(gold>=material.meta.reforgeGold?'ok':'lack')+'">'+material.meta.reforgeGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<div class="v17358-reforge-cost-note">æœªé–å®šï¼š50 åœ–ç´™ï¼‹50 ç¤¦çŸ³ãƒ»é– 1 æ¢ï¼š100ï¼‹100ãƒ»é– 2 æ¢ï¼š150ï¼‹150</div>'+
            '<button type="button" class="v141-synthesis-primary" '+(can&&!synthesisState.pendingReforge?'':'disabled')+' onclick="v141StartReforge()">é–‹å§‹å†¶ç…‰</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">â“˜ å†¶ç…‰è¦å‰‡</button>'+compare+'</div>';
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
        if(!list.length){ return '<div class="v141-synthesis-empty">æ²’æœ‰å¯å‡éšçš„ç™½ï¼è—ï¼ç´«éšç¬¦å’’ã€‚</div>'; }
        if(!list.some(item=>item.id===synthesisState.talismanId)){ synthesisState.talismanId=list[0].id; synthesisState.talismanQty=1; }
        const source=list.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        const owned=countItem(source.id);
        const max=Math.min(Math.floor(owned/3),Math.floor(gold/TALISMAN_GOLD[normalizeTierKey(source.tierKey)]));
        synthesisState.talismanQty=Math.max(1,Math.min(Math.max(1,max),synthesisState.talismanQty));
        const qty=synthesisState.talismanQty;
        const can=max>=qty&&target;
        return '<div class="v141-synthesis-card v141-talisman-craft">'+
            '<label>é¸æ“‡ç¬¦å’’<select onchange="v141SelectTalisman(this.value)">'+list.map(item=>
                '<option value="'+item.id+'" '+(item.id===source.id?'selected':'')+'>'+escapeHtml(item.name)+'ï¼ˆ'+countItem(item.id)+'ï¼‰</option>'
            ).join("")+'</select></label>'+
            '<div class="v141-upgrade-flow"><section class="v141-talisman-source" aria-label="åˆæˆææ–™">'+source.icon+'<b>'+escapeHtml(source.name)+' Ã—'+(qty*3)+'</b></section><i aria-hidden="true">â†’</i><section class="v141-talisman-target" aria-label="åˆæˆç›®æ¨™">'+target.icon+'<b>'+escapeHtml(target.name)+' Ã—'+qty+'</b></section></div>'+
            '<div class="v141-quantity"><button onclick="v141AdjustTalismanQty(-1)">ï¼</button><strong>'+qty+'</strong><button onclick="v141AdjustTalismanQty(1)">ï¼‹</button><button onclick="v141AdjustTalismanQty(\'max\')">MAX</button></div>'+
            '<div class="v141-material-lines"><span>æŒæœ‰ '+owned+'</span><span>æ¶ˆè€— '+(qty*3)+'</span><span>é‡‘å¹£ '+(TALISMAN_GOLD[normalizeTierKey(source.tierKey)]*qty).toLocaleString('zh-TW')+'</span></div>'+
            '<button class="v141-synthesis-primary" '+(can?'':'disabled')+' onclick="v141CraftTalismans()">é–‹å§‹åˆæˆ</button></div>';
    }

    function renderFragmentTab(){
        const data=definitions();
        return '<div class="v141-fragment-list">'+SERIES.map(series=>{
            const fragment=getFragmentDefinition(series.setId);
            const count=countItem(fragment.id);
            const max=Math.min(Math.floor(count/100),Math.floor(gold/500));
            const qty=Math.max(1,Math.min(Math.max(1,max),synthesisState.fragmentQty[series.setId]||1));
            synthesisState.fragmentQty[series.setId]=qty;
            return '<section class="v141-fragment-row"><div class="v141-fragment-icon">'+fragment.icon+'</div><div class="v141-fragment-main"><b>'+series.label+'ç¢ç‰‡</b><span>'+count+' / 100</span><div class="v141-fragment-progress"><i style="width:'+Math.min(100,count)+'%"></i></div></div>'+
                '<div class="v141-fragment-controls"><div><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',-1)">ï¼</button><strong>'+qty+'</strong><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',1)">ï¼‹</button><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',\'max\')">MAX</button></div>'+
                '<button '+(max>=qty?'':'disabled')+' onclick="v141CraftFragmentTicket(\''+series.setId+'\')">åˆæˆæŠ½çåˆ¸<br><small>500é‡‘å¹£ï¼å¼µ</small></button></div></section>';
        }).join('')+'</div>';
    }

    function renderSynthesis(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const renderers={reforge:renderReforgeTab,talisman:renderTalismanTab,fragment:renderFragmentTab};
        if(!renderers[synthesisState.tab]){ synthesisState.tab="reforge"; }
        const content=renderers[synthesisState.tab]();
        body.innerHTML='<div class="v141-synthesis"><div class="v141-synthesis-wallet"><span>åˆæˆ</span><b>é‡‘å¹£ '+Math.floor(gold).toLocaleString('zh-TW')+'</b></div>'+renderSynthesisTabs()+'<div class="v141-synthesis-body">'+content+'</div></div>';
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
                alert(maxLocks<=0?"é€™ä»¶è£å‚™åªæœ‰ 1 å€‹å†¶ç…‰æ§½ï¼Œä¸èƒ½æŠŠå”¯ä¸€è©æ¢é–ä½ã€‚":"è‡³å°‘è¦ä¿ç•™ 1 å€‹æœªé–å®šæ§½ä½æ‰èƒ½é‡æ–°å†¶ç…‰ã€‚");
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
            const cost=meta.available===false?'å°šæœªé–‹æ”¾ãƒ»æ•¸å€¼å¾…å®š':'é‡‘å¹£ '+meta.reforgeGold.toLocaleString('zh-TW');
            return '<div><b>'+meta.label+'ææ–™</b>ã€€'+reforgeRangeText(tier,2)+'ã€€ï¼ã€€'+cost+'</div>';
        }).join('');
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>å†¶ç…‰è¦å‰‡</h3><p>è£å‚™å“è³ªä¸é™åˆ¶ææ–™éšç´šã€‚é¸ç”¨å“ªä¸€éšææ–™ï¼Œæœ¬æ¬¡é‡æ´—å°±ä½¿ç”¨å“ªä¸€éšçš„æ•¸å€¼ç¯„åœã€‚</p>'+lines+'<p>æ¡ƒç´…éšã€å››è±¡éšå·²é ç•™æ­£å¼éšç´šï¼Œä½†ç›®å‰ä¸é–‹æ”¾æ•¸å€¼èˆ‡å–å¾—ä¾†æºã€‚</p><p>æ¯æ¬¡æœƒé‡æ´—æ‰€æœ‰æœªé–å®šçš„å†¶ç…‰æ§½ï¼›å·²é–å®šè©æ¢ä¿æŒåŸæ•¸å€¼ã€‚å†¶ç…‰æ¬¡æ•¸ä¸é™ã€‚</p><p>æ¶ˆè€—ï¼šæœªé–å®š 50 å¼µè¨­è¨ˆåœ–ï¼‹50 ç¤¦çŸ³ï¼›é– 1 æ¢å„ 100ï¼›é– 2 æ¢å„ 150ã€‚æœ€å¤šé– 2 æ¢ï¼Œä¸”è‡³å°‘ä¿ç•™ 1 å€‹æ§½ä½é‡æ´—ã€‚</p><p>å–®æ§½æœ€é«˜å€¼å›ºå®š10%ï¼›å…·å‰¯è©æ¢ç¯„åœçš„ææ–™ï¼Œé›™è©æ¢åŒæ™‚æœ€é«˜å›ºå®š5%ã€‚</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">è¿”å›</button></div></div>');
    };

    window.v141CraftEquipment=function(){
        const blueprint=heldBlueprints().find(item=>item.id===synthesisState.blueprintId);
        if(!blueprint){ return; }
        const series=SERIES.find(item=>item.setId===(blueprint.setId||synthesisState.seriesId))||SERIES[0];
        const tier=normalizeTierKey(blueprint.tierKey);
        const meta=TIER_META[tier];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const ore=definitions().ores.find(item=>normalizeTierKey(item.tierKey)===tier);
        if(!ore||countItem(blueprint.id)<50||countItem(ore.id)<50||gold<meta.craftGold){ alert("ç´ ææˆ–é‡‘å¹£ä¸è¶³ã€‚"); return; }
        const stats=rollAffixes(tier,false);
        const item={
            id:makeUid("crafted"),v141Uid:makeUid("gear"),name:series.label+meta.label+slot.label,
            icon:svgIcon(slot.glyph,series.color),type:slot.type,setId:series.setId,tierKey:tier,
            levelRequirement:1,price:0,count:1,stats:stats,reforgeStats:null,v141Crafted:true
        };
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("èƒŒåŒ…ç©ºé–“ä¸è¶³ã€‚"); return; }
        const success=runInventoryTransaction(()=>{
            return window.v132ConsumeStackItem(blueprint.id,50)&&window.v132ConsumeStackItem(ore.id,50)&&addItem(item,1);
        });
        if(!success){ alert("åˆæˆå¤±æ•—ï¼Œç´ æå·²è‡ªå‹•é‚„åŸã€‚"); return; }
        gold-=meta.craftGold;
        rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("åˆæˆæˆåŠŸ",'<div class="v141-result-item">'+item.icon+'<b>'+escapeHtml(item.name)+'</b>'+statsHtml(stats)+'</div>');
    };

    window.v141StartReforge=function(){
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||synthesisState.pendingReforge){ return; }
        const slotCount=reforgeSlotCount(item);
        if(slotCount<=0){ alert("é€™ä»¶è£å‚™æ²’æœ‰å†¶ç…‰æ§½ã€‚"); return; }
        const locks=normalizeReforgeLocks(item).slice();
        if(locks.length>=slotCount){ alert("è‡³å°‘è¦ä¿ç•™ 1 å€‹æœªé–å®šæ§½ä½æ‰èƒ½é‡æ–°å†¶ç…‰ã€‚"); return; }
        const tier=normalizeTierKey(synthesisState.reforgeMaterialTier);
        const info=reforgeMaterialInfo(tier);
        if(!info.meta||info.meta.available===false){ alert("æ­¤ææ–™éšç´šå°šæœªé–‹æ”¾ã€‚"); return; }
        const cost=reforgeMaterialCost(locks.length);
        if(!info.ore||info.blueprintCount<cost||info.oreCount<cost||gold<info.meta.reforgeGold){
            alert(info.meta.label+"å†¶ç…‰ææ–™æˆ–é‡‘å¹£ä¸è¶³ã€‚");
            return;
        }
        const success=runInventoryTransaction(()=>
            consumeMatching(candidate=>candidate&&candidate.blueprintSlot&&normalizeTierKey(candidate.tierKey)===tier,cost)&&
            window.v132ConsumeStackItem(info.ore.id,cost)
        );
        if(!success){ alert("å†¶ç…‰ç´ ææ‰£é™¤å¤±æ•—ï¼Œå·²è‡ªå‹•é‚„åŸã€‚"); return; }
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
        showSynthesisResult(applyNew?"å·²å¥—ç”¨æ–°å†¶ç…‰æ•ˆæœ":"å·²ä¿ç•™åŸå†¶ç…‰æ•ˆæœ",applyNew&&item?'<div class="v141-result-item"><b>'+escapeHtml(item.name)+'</b>'+statsHtml(item.reforgeStats)+'</div>':'<p>æœ¬æ¬¡ææ–™èˆ‡é‡‘å¹£å·²æ¶ˆè€—ï¼ŒåŸæœ‰æ•ˆæœç¶­æŒä¸è®Šãµ¨¥zºè¯
â¶)à²Ö§uªİ¢ëiºĞk¢G§¦*^m«ëŒ+Š×®º+º$zzb¥è#Â÷âr“°¢Ó° ¢v–æF÷rçcC7&gEFÆ—6Öç3ÖgVæ7F–öâ‚—°¢6öç7B6÷W&6SÖFVf–æ—F–öç2‚’çFÆ—6Öç2æf–æB†—FVÓÓæ—FVÒæ–CÓÓ×7–çF†W6—57FFRçFÆ—6Öä–B“°¢6öç7BF&vWCÖæW‡EFÆ—6Öâ‡6÷W&6R“°¢–b‚6÷W&6WÇÂF&vWB—²&WGW&ã²Ğ¢6öç7BG“ÔÖF‚æÖ‚ƒÇ7–çF†W6—57FFRçFÆ—6ÖåG’“°¢6öç7B6÷7CÕDÄ•4ÔåôtôÄE¶æ÷&ÖÆ—¦UF–W$¶W’‡6÷W&6RçF–W$¶W’•Ò§G“°¢–b†6÷VçD—FVÒ‡6÷W&6Ræ–B“ÇG’£7ÇÆvöÆCÆ6÷7B—²ÆW'B‚.zÊnY).h‰n˜y[š>KˆŞ‹k>8""“²&WGW&ã²Ğ¢–b‡v–æF÷rçc3$6äFD—FVÕFô–çfVçF÷'’bbv–æF÷rçc3$6äFD—FVÕFô–çfVçF÷'’‡F&vWBÇG’’—²ÆW'B‚.ˆ8ÎXÈ^z›®™i>KˆŞ‹k>8""“²&WGW&ã²Ğ¢6öç7B7V66W73×'Vä–çfVçF÷'•G&ç67F–öâ‚‚“Óçv–æF÷rçc3$6öç7VÖU7F6´—FVÒ‡6÷W&6Ræ–BÇG’£2’bfFD—FVÒ‡F&vWBÇG’’“°¢–b‚7V66W72—²ÆW'B‚.Yh‰ZKiY~ûÈÎ{JiÙ[{.ˆz®X¹^˜(NXéş8""“²&WGW&ã²Ğ¢vöÆBÓÖ6÷7C²&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“²WFFTvöÆDF—7Æ’‚“²6fTvÖR‚“²&VæFW%7–çF†W6—2‚“°¢6†÷u7–çF†W6—5&W7VÇB‚.zÊnY).Yh‰h‰X©ò"ÂsÆF—b6Æ73Ò'cC×&W7VÇBÖ—FVÒ#âr·F&vWBæ–6öâ²sÆ#âr¶W66T‡FÖÂ‡F&vWBææÖR’²r9rr·G’²sÂö#ãÂöF—câr“°¢Ó° ¢v–æF÷rçcC7&gDg&vÖVçEF–6¶WCÖgVæ7F–öâ‡6WD–B—°¢6öç7Bg&vÖVçCÖvWDg&vÖVçDFVf–æ—F–öâ‡6WD–B“°¢6öç7BF–6¶WCÖFVf–æ—F–öç2‚’çF–6¶WG2æf–æB†—FVÓÓæ—FVÒç6WD–CÓÓ×6WD–B“°¢6öç7BG“ÔÖF‚æÖ‚ƒÇ7–çF†W6—57FFRæg&vÖVçEG•·6WD–E×ÇÃ“°¢–b‚g&vÖVçGÇÂF–6¶WGÇÆ6÷VçD—FVÒ†g&vÖVçBæ–B“ÇG’£ÇÆvöÆCÇG’£S—²ÆW'B‚.z(îx˜~h‰n˜y[š>KˆŞ‹k>8""“²&WGW&ã²Ğ¢–b‡v–æF÷rçc3$6äFD—FVÕFô–çfVçF÷'’bbv–æF÷rçc3$6äFD—FVÕFô–çfVçF÷'’‡F–6¶WBÇG’’—²ÆW'B‚.ˆ8ÎXÈ^z›®™i>KˆŞ‹k>8""“²&WGW&ã²Ğ¢6öç7B7V66W73×'Vä–çfVçF÷'•G&ç67F–öâ‚‚“Óçv–æF÷rçc3$6öç7VÖU7F6´—FVÒ†g&vÖVçBæ–BÇG’£’bfFD—FVÒ‡F–6¶WBÇG’’“°¢–b‚7V66W72—²ÆW'B‚.Yh‰ZKiY~ûÈÎ{JiÙ[{.ˆz®X¹^˜(NXéş8""“²&WGW&ã²Ğ¢vöÆBÓ×G’£S²&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“²WFFTvöÆDF—7Æ’‚“²6fTvÖR‚“²&VæFW%7–çF†W6—2‚“°¢6†÷u7–çF†W6—5&W7VÇB‚.z(îx˜~Yh‰h‰X©ò"ÂsÆF—b6Æ73Ò'cC×&W7VÇBÖ—FVÒ#âr·F–6¶WBæ–6öâ²sÆ#âr¶W66T‡FÖÂ‡F–6¶WBææÖR’²r9rr·G’²sÂö#ãÂöF—câr“°¢Ó° ¢v–æF÷rçcCFV6ö×÷6U6W&–W4—FVÓÖ7–æ2gVæ7F–öâ‡6Æ÷D–æFW‚—°¢6öç7B—FVÓÖ–çfVçF÷'•6Æ÷G5·6Æ÷D–æFW…Ó°¢6öç7Bg&vÖVçCÖ—FVÒbfvWDg&vÖVçDFVf–æ—F–öâ†—FVÒç6WD–B“°¢–b‚—FV×ÇÂg&vÖVçGÇÂ—4WV—ÖVçD–çfVçF÷'•G—R†—FVÒçG—R’—²&WGW&ã²Ğ¢–b€¢G—Vöbv–æF÷rç't6öæf—&ÒÓÒ&gVæ7F–öâ"ÇÀ¢v—Bv–æF÷rç't6öæf—&Ò€¢.z+®Zé®XˆnŠz>8Â"¶—FVÒææÖR².8ŞûÉõÆî[~Y»®Zé®xÛ.[ér"¶g&vÖVçBææÖR²,9sûÈÎŠ9ŞX)xJk9^[êXéş8""À¢°¢F—FÆS¢.XˆnŠz>Š9ŞX)’"À¢6öæf—&ÕFW‡C¢.z+®Zé®XˆnŠz2"À¢6æ6VÅFW‡C¢.‹ùNY¹â"À¢FævW#§G'VP¢Ğ¢¢—°¢&WGW&ã°¢Ğ¢–b†–çfVçF÷'•6Æ÷G5·6Æ÷D–æFW…ÒÓÖ—FVÒ—²&WGW&ã²Ğ¢6öç7B&VÄ–æFWƒÖ–çfVçF÷'”—FV×2æ–æFW„öb†—FVÒ“°¢–b‡&VÄ–æFWƒÃ—²&WGW&ã²Ğ¢6öç7B7V66W73×'Vä–çfVçF÷'•G&ç67F–öâ‚‚“Óç°¢–çfVçF÷'”—FV×2ç7Æ–6R‡&VÄ–æFW‚Ã“°¢&WGW&âFD—FVÒ†g&vÖVçBÃ“°¢Ò“°¢–b‚7V66W72—²ÆW'B‚.ˆ8ÎXÈ^z›®™i>KˆŞ‹k>ûÈÎXˆnŠz>[{.Xùnkh8""“²&WGW&ã²Ğ¢6Æ÷6T—FVÔÖöFÂ‚“²&V'V–ÆD–çfVçF÷'•6Æ÷G2‚“²6fTvÖR‚“²&VæFW$–çfVçF÷'’‚“°¢ÆW'B‚.XˆnŠz>ZèÎh‰ûÈÎxÛ.[ér"¶g&vÖVçBææÖR²,9s8""“°¢Ó° ¢–b‡G—Vöb÷Vä†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ÷Vä†öÖTfVGW&SÖ÷Vä†öÖTfVGW&S°¢÷Vä†öÖTfVGW&SÖgVæ7F–öâ‡G—R—°¢–b‡G—RÓÒ'7–çF†W6—2"—²&WGW&â÷&–v–æÄ÷Vä†öÖTfVGW&RæÇ’‡F†—2Æ&wVÖVçG2“²Ğ¢6Æ÷6T†öÖTfVGW&R‚“°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢6öç7BF—FÆSÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÅF—FÆR"“°¢–b‡F—FÆR—²F—FÆRçFW‡D6öçFVçCÒ.Yh‰#²Ğ¢–b†ÖöFÂ—²ÖöFÂæ6Æ74Æ—7BæFB‚'6†÷r"Â'cC×7–çF†W6—2ÖÖöFÂ"“²Ğ¢Vç7W&TWV—ÖVçEV–G2‚“°¢òò&÷WFRF†RfW'’f—'7B÷VâF‡&÷Vv‚F†R7W'&VçBV&Æ–2&VæFW&W"à¢òò6ÆÆ–ærF†R6Æ÷7W&RF—&V7FÇ’'—76W2ÆFW"&W6VçFF–öâ÷væW'0¢òòæB—2v‡’WV—ÖVçB÷FÆ—6Öâ'BöæÇ’V'2gFW"6Æ–6²à¢–b‡G—Vöbv–æF÷rçcC&VæFW%7–çF†W6—3ÓÓÒ&gVæ7F–öâ"—²v–æF÷rçcC&VæFW%7–çF†W6—2‚“²Ğ¢VÇ6W²&VæFW%7–çF†W6—2‚“²Ğ¢Ó°¢Ğ¢–b‡G—Vöb6Æ÷6T†öÖTfVGW&SÓÓÒ&gVæ7F–öâ"—°¢6öç7B÷&–v–æÄ6Æ÷6T†öÖTfVGW&SÖ6Æ÷6T†öÖTfVGW&S°¢6Æ÷6T†öÖTfVGW&SÖgVæ7F–öâ‚—°¢6öç7BÖöFÃÖFö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖTfVGW&TÖöFÂ"“°¢–b†ÖöFÂ—²ÖöFÂæ6Æ74Æ—7Bç&VÖ÷fR‚'cC×7–çF†W6—2ÖÖöFÂ"“²Ğ¢&WGW&â÷&–v–æÄ6Æ÷6T†öÖTfVGW&RæÇ’‡F†—2Æ&wVÖVçG2“°¢Ó°¢Ğ ¢ò¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢'—72GVævVöà¢ÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÒ¢ğ¢–b‚6¶–ÆÄFF&6Rç7F÷&Õ7VÆÂ—°¢6¶–ÆÄFF&6Rç7F÷&Õ7VÆÃÔö&¦V7Bæ76–vâ‡·ÒÇ6¶–ÆÄFF&6Rçv–æD†÷vÄÆ–v‡Fæ–ærÇ¶–C¢'7F÷&Õ7VÆÂ"ÆæÖS¢.i«Nš*Š2"ÇF–W#£BÇF&vWEG—S¢&ÆÂ'Ò“°¢Ğ¢gVæ7F–öâFVfVÇD'—757FFR‚—²&WGW&â¶7F—fS¦fÇ6RÆfÆö÷#£Ç†6S¢&&÷72"Çƒ£SÇ“£ƒBÆÖW76vS¢""Æ6ÆV'3£Ç&Wv&EfW'6–öã£Ó²Ğ¢gVæ7F–öâÆöD'—757FFR‚—°¢G'—°¢6öç7B&sÔ¥4ôâç'6R†Æö6Å7F÷&vRævWD—FVÒ„%•55õ5Dõ$tUô´U’—ÇÂ'·Ò"“°¢6öç7B7FFSÔö&¦V7Bæ76–vâ†FVfVÇD'—757FFR‚’Ç&rÇ¶fÆö÷#¤ÖF‚æÖ‚ƒÄÖF‚æÖ–âƒRÄçVÖ&W"‡&ræfÆö÷"—ÇÃ’—Ò“°¢ò¢&Vf÷&RfÆö÷"6†W7G2W†—7FVBÂ†6S×÷'FÂÖVçBF†Bæò&Wv&B†@¢&VVâ6Æ–ÖVBâÖ–w&FRF†BöæRÆVv7’†6R&6²Fò—G26†W7Bâ¢ğ¢–b‡&rç†6SÓÓÒ'÷'FÂ"bdçVÖ&W"‡&rç&Wv&EfW'6–öçÇÃ“Ã—°¢7FFRç†6SÒ&6†W7B#°¢7FFRæÖW76vSÒ.Zè™yÎZûnzë[{.Š9ÎKˆ®8.Š¸¾XXš	XùnxØîX»^ûÈÎXhŞKÛşyJX+>˜›¹î8"#°¢Ğ¢&WGW&â7FFS°¢Ö6F6‚…ò—²&WGW&âFVfVÇD'—757FFR‚“²Ğ¢Ğ¢ÆWB'—757FFSÖÆöD'—757FFR‚“°¢ò¢v†WF†W"F†—2vRf—6—B†2VçFW&VBF†RW'6—7FVB'VââæWfW"W'6—7B—C¢¢&VÆöB÷"ÆFW"f—6—B×W7B&WGW&âFòF†R&öw&W72vFRf—'7Bâ¢ğ¢ÆWB'—74ÖVçFW&VCÖfÇ6S°¢ÆWB'—74&GFÆU7F'F–æsÖfÇ6S°¢ÆWB7F—fT'—74F–ÆöwVTGfæ6SÖçVÆÃ°¢gVæ7F–öâW'6—7D'—72‚—²G'—²Æö6Å7F÷&vRç6WD—FVÒ„%•55õ5Dõ$tUô´U’Ä¥4ôâç7G&–æv–g’†'—757FFR’“²Ö6F6‚…ò—²ÒĞ ¢6öç7B'—74fÆö÷'3×°¢§¶&÷73¢.iÛ[‰Ò"ÆVÆVÖVçC¢&V'F‚"Ç6¶–ÆÇ3¥²&fÇ––æu6æE7G&–¶R"Â&GW7E7F÷&Ò"Â'7FöæU6Æ6‚%ÒÆVÆ—FU6¶–ÆÃ¢'WG&–g”f—7B"ÇFVçG3¥².XzK«®K™şiZ.‹ˆşXZ^[‰ŞZ(>ûÉò"Â.›¸>k)iÈ>Yø¾‰ÎKÚy¨NYŞZÙ~8""Â.XX˜îZJX[^˜	Kˆ™yÎXhŞŠª®ûÈ%×ÒÀ¢#§¶&÷73¢.XÙ~[‰Ò"ÆVÆVÖVçC¢&f—&R"Ç6¶–ÆÇ3¥²&W‡Æ÷6—fTfÇW''’"Â&G&vöå6Æ6‚"Â&f—&U&ö6¶WB%ÒÆVÆ—FU6¶–ÆÃ¢&f—&T7&—F–6Â"ÇFVçG3¥².x8x¾iÈ>h¨®KÚy¨NX¸~k
>xy.XX8""Â.XhŞY	X˜ŞKˆjÚ^ûÈÎKëşiŠşxx{Î8""Â.KÚi)KˆŞ˜îXÙ~ZJK˜¾xKûÈ%×ÒÀ¢3§¶&÷73¢.ZJ[‰Ò"ÆVÆVÖVçC¢'v–æB"Ç6¶–ÆÇ3¥²'v–æD†÷vÄÆ–v‡Fæ–ær"Â'7F÷&ÔfÇW''’"Â'v–æD7&÷756Æ6‚%ÒÆVÆ—FU6¶–ÆÃ¢'7F÷&Ôf—7B"ÇFVçG3¥².š*‹[~K˜¾i˜.ûÈÎxJK«®ˆ;Şz¸¾8""Â.KÚy¨Nh¹¾[ÈşZJ®hZ.K¨n8""Â.ZJZˆKˆŞiŠşXzK«®ˆ;ŞhÉh‹y¨NûÈ%×ÒÀ¢C§¶&÷73¢.XÉ~[‰Ò"ÆVÆVÖVçC¢'vFW""Ç6¶–ÆÇ3¥²&fÆööD&V7B"Â&g&÷7EVæ6‚"Â'vFW$¶æ–fR%ÒÆVÆ—FU6¶–ÆÃ¢'vFW$&ÆÂ"ÇFVçG3¥².Zù.k8[{.[KØşKÚy¨N˜‹zş8""Â.Šé>Xk™ÉÎi»şKÚ™[~yÊ8""Â.XÉ~Z(>K˜¾X˜ŞûÈÎjÚ.jÚ^Y
~ûÈ%×Ğ¢Ó°¢6öç7BVÆVÖVçDÆ&VÃ×¶f—&S¢.x²"ÇvFW#¢.kB"ÆV'Fƒ¢.YÉò"Çv–æC¢.š*‚"ÆÆ–v‡C¢.XX’'Ó° ¢gVæ7F–öâÖ¶T'—74Ööç7FW"†æÖRÆÆWfVÂÆVÆVÖVçBÇ&æ²ÆW‡G&‡Ç6¶–ÆÇ2Æf÷&6TÆWfVÂ—°¢6öç7BÖöç7FW#×v–æF÷rçc3$'V–ÆDGVævVöäÖöç7FW"†æÖRÆÆWfVÂÆVÆVÖVçBÇ&æ²“°¢Ööç7FW"æÖ„…³ÖW‡G&‡°¢Ööç7FW"æ‡ÖÖöç7FW"æÖ„…°¢Ööç7FW"çcC'—73×G'VS°¢Ööç7FW"çcCW‡G&…ÖW‡G&‡°¢Ööç7FW"çcCf÷&6U6¶–ÆÄÆWfVÃÖf÷&6TÆWfVÃ°¢Ööç7FW"çcC6¶–ÆÄÆWfVÃÖf÷&6TÆWfVÃ°¢Ööç7FW"çcCE6¶–ÆÄÆWfVÃÖf÷&6TÆWfVÃ°¢Ööç7FW"ç6¶–ÆÄ–G3Ò‡6¶–ÆÇ7ÇÅµÒ’ç6Æ–6R‚“°¢Ööç7FW"ç6¶–ÆÄ6†æ6SÒãsƒ°¢Ööç7FW"æ7F—fT'Vfg3ÕµÓ°¢&WGW&âÖöç7FW#°¢Ğ ¢gVæ7F–öâ'V–ÆD'—75&÷7FW"†fÆö÷"—°¢6öç7BÆWfVÃ×v–æF÷rçc3$vWDGVævVöäÖöç7FW$ÆWfVÃ÷v–æF÷rçc3$vWDGVævVöäÖöç7FW$ÆWfVÂ‚“¤ÖF‚æÖ‚ƒÇv–æF÷rçcCvWD†–v†W7D6†&7FW$ÆWfVÂ‚’“°¢–b†fÆö÷#ÃR—°¢6öç7BFFÖ'—74fÆö÷'5¶fÆö÷%Ó°¢6öç7B6¶–ÆÄÆWfVÃ×G—Vöbv–æF÷rçcCvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÃÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcCvWDÖöç7FW$f—†VE6¶–ÆÄÆWfVÂ†ÆWfVÂ¢¢†ÆWfVÃÃÓ#ó¦ÆWfVÃÃÓCó#¦ÆWfVÃÃÓcó3¦ÆWfVÃÃÓƒóC£R“°¢6öç7B&÷73ÖÖ¶T'—74Ööç7FW"†FFæ&÷72ÆÆWfVÂÆFFæVÆVÖVçBÂ&&÷72"ÃSÆFFç6¶–ÆÇ2Ç6¶–ÆÄÆWfVÂ“°¢6öç7B&÷7FW#Õ¶&÷75Ó°¢f÷"†ÆWB“Ó¶“ÃC¶’²²—°¢&÷7FW"çW6‚†Ö¶T'—74Ööç7FW"‚.ZJX[^ZJ[r"ÆÆWfVÂÆFFæVÆVÖVçBÂ&VÆ—FR"Ã#SÅ¶FFæVÆ—FU6¶–ÆÅÒÇ6¶–ÆÄÆWfVÂ’“°¢Ğ¢&WGW&â&÷7FW#°¢Ğ ¢6öç7B&÷7FW#ÕµÓ°¢6öç7B&÷757V73Õ°¢².iÛ[‰ŞZJ[¢"Â&V'F‚"Å²&GW7E7F÷&Ò"Â'7FöæT'&Vµ6·’%ÒÅ²&&'&–W"%ÕÒÀ¢².ZJ[‰ŞZJ[¢"Â'v–æB"Å²'v–æD†÷vÄÆ–v‡Fæ–ær"Â'7F÷&Õ&–â"Â'7F÷&Õ7VÆÂ%ÒÅµÕÒÀ¢².j[^[‰ŞZJ[¢"Â&Æ–v‡B"ÅµÒÅ²'—Vå†–ætwVætÖ–ær"Â'—VäwVæu6†–VÆB"Â'—Vå§T&ÆW76–ær%ÕÒÀ¢².XÉ~[‰ŞZJ[¢"Â'vFW""Å²&–6T'&÷u&–â"Â&g&VW¦R%ÒÅ²&†VÅ7VÆÂ%ÕÒÀ¢².XÙ~[‰ŞZJ[¢"Â&f—&R"Å²'†öVæ—„7'’"Â&G&vöå6Æ6‚%ÒÅ²'&vR%ÕĞ¢Ó°¢&÷757V72æf÷$V6‚‚‡7V2Ç÷6—F–öâ“Óç°¢6öç7BÖöç7FW#ÖÖ¶T'—74Ööç7FW"‡7V5³ÒÆÆWfVÂÇ7V5³ÒÂ&&÷72"ÃÇ7V5³%ÒÃR“°¢Ööç7FW"çcC7W÷'E6¶–ÆÄ–G3×7V5³5Ó°¢–b‡7V5³ÓÓÓÒ.j[^[‰ŞZJ[¢"—²Ööç7FW"çcC'—74“Ò'7W÷'B#²Ööç7FW"ç6¶–ÆÄ6†æ6SÓ²Ğ¢Ööç7FW"çcCf÷&ÖF–öå&÷sÓ°¢Ööç7FW"çcCf÷&ÖF–öå÷6—F–öã×÷6—F–öã°¢&÷7FW"çW6‚†Ööç7FW"“°¢Ò“°¢6öç7BVÆ—FW3Õ°¢²'vFW""ÆçVÆÂÂ&†VÅ7VÆÂ%ÒÅ²&V'F‚"Â'7FöæT'&Vµ6·’"ÆçVÆÅÒÅ²&f—&R"Â'†öVæ—„7'’"ÆçVÆÅÒÀ¢²'v–æB"ÆçVÆÂÂ&FöFvU6¶–ÆÂ%ÒÅ²'vFW""ÆçVÆÂÂ&†VÅ7VÆÂ%Ğ¢Ó°¢VÆ—FW2æf÷$V6‚‚‡7V2Ç÷6—F–öâ“Óç°¢6öç7BÖöç7FW#ÖÖ¶T'—74Ööç7FW"‚.ZJX[^ZJ[r"ÆÆWfVÂÇ7V5³ÒÂ&VÆ—FR"Ã3SÇ7V5³Óõ·7V5³ÕÓ¥µÒÃR“°¢Ööç7FW"çcC7W÷'E6¶–ÆÄ–G3×7V5³%Óõ·7V5³%ÕÓ¥µÓ°¢Ööç7FW"çcCf÷&6U6¶–ÆÄÆWfVÃÓS°¢Ööç7FW"çcCf÷&ÖF–öå&÷sÓ°¢Ööç7FW"çcCf÷&ÖF–öå÷6—F–öã×÷6—F–öã°¢&÷7FW"çW6‚†Ööç7FW"“°¢Ò“°¢&WGW&â&÷7FW#°¢Ğ¢v–æF÷rçcC'V–ÆD'—75&÷7FW#Ö'V–ÆD'—75&÷7FW#° ¢gVæ7F–öâÖöç7FW$&6T‡†Ööç7FW"—°¢6öç7B6†–VÆCÖÖöç7FW"bfÖöç7FW"çcC6†–VÆC°¢&WGW&â6†–VÆCôÖF‚æÖ‚ƒÆÖöç7FW"æ‡Ò‡6†–VÆBç&VÖ–æ–æwÇÃ’“¦Ööç7FW"æ‡°¢Ğ ¢gVæ7F–öâÖöç7FW$&6TÖ„‡†Ööç7FW"—°¢6öç7B6†–VÆCÖÖöç7FW"bfÖöç7FW"çcC6†–VÆC°¢&WGW&âÖF‚æÖ‚ƒÄçVÖ&W"‡6†–VÆBbg6†–VÆBæ&6TÖ„…—ÇÄçVÖ&W"†Ööç7FW"bfÖöç7FW"æÖ„…—ÇÃ“°¢Ğ ¢gVæ7F–öâvWDÖöç7FW$ÆÇ•G&•F&vWF–ær†67FW$–æFW‚ÆVçG&–W2—°¢6öç7BÆ—f–æsÒ†VçG&–W7ÇÆ7W'&VçD&GFÆTÖöç7FW'2æÖ†–æFWƒÓâ‡¶–æFWƒ¦–æFW‚ÆÖöç7FW#¦Ööç7FW'5¶–æFW…×Ò’’¢æf–ÇFW"†VçG'“ÓæVçG'’bfVçG'’æÖöç7FW"bfVçG'’æÖöç7FW"æÆ—fRÓÖfÇ6RbdçVÖ&W"†VçG'’æÖöç7FW"æ‡“ã“°¢6öç7BÆ—f–æt'”–æFWƒÖæWrÖ†Æ—f–æræÖ†VçG'“Óå¶VçG'’æ–æFW‚ÆVçG'•Ò’“°¢6öç7B÷væW#×v–æF÷räf÷W%7–Ö&öÇ4&GFÆVf–VÆE6Æ÷G7ÇÆçVÆÃ°¢6öç7B6æ6†÷CÖ÷væW"bgG—Vöb÷væW"ævWD7F—fTVæV×•6æ6†÷CÓÓÒ&gVæ7F–öâ#ö÷væW"ævWD7F—fTVæV×•6æ6†÷B‚“¦çVÆÃ°¢ÆWB&W7CÕµÓ°¢ÆWB&W7E&–Ö'“ÖçVÆÃ°¢ÆWB&W7E66÷&SÒÓ°¢Æ—f–æræf÷$V6‚†6VçFW$VçG'“Óç°¢6öç7B6VçFW#Ö6VçFW$VçG'’æ–æFWƒ°¢6öç7BF&vWF–æt÷væW#×v–æF÷räf÷W%7–Ö&öÇ4&GFÆU6¶–ÆÅF&vWF–æs°¢6öç7B–æFW†W3×F&vWF–æt÷væW"bgG—VöbF&vWF–æt÷væW"ç&W6öÇfUF&vWG3ÓÓÒ&gVæ7F–öâ ¢÷F&vWF–æt÷væW"ç&W6öÇfUF&vWG2‚&Ööç7FW""Æ6VçFW"Â&ÆÇ•G&’"Ç¶†÷7F–ÆU&–Ö'“¦fÇ6WÒ¢¢†÷væW"bg6æ6†÷BbgG—Vöb÷væW"ç&W6öÇfTVæV×•F&vWG3ÓÓÒ&gVæ7F–öâ ¢ö÷væW"ç&W6öÇfTVæV×•F&vWG2‡6æ6†÷BÆ6VçFW"Â'G&’"Æ–æFWƒÓæÆ—f–æt'”–æFW‚æ†2†–æFW‚’¢¥¶6VçFW%Ò“°¢6öç7BG&–óÖ–æFW†W2æÖ†–æFWƒÓæÆ—f–æt'”–æFW‚ævWB†–æFW‚’’æf–ÇFW"„&ööÆVâ“°¢6öç7B66÷&S×G&–òç&VGV6R‚‡7VÒÆVçG'’“Óç°¢6öç7BÆÇ“ÖVçG'’æÖöç7FW#°¢6öç7B‡æVVCÒ†Ööç7FW$&6TÖ„‡†ÆÇ’’ÖÖöç7FW$&6T‡†ÆÇ’’’öÖöç7FW$&6TÖ„‡†ÆÇ’“°¢6öç7BÖ…5ÔÖF‚æÖ‚ƒÄçVÖ&W"†ÆÇ’æÖ…5—ÇÃ“°¢6öç7B7æVVCÒ†Ö…5ÔÖF‚æÖ‚ƒÄçVÖ&W"†ÆÇ’ç7—ÇÃ’’öÖ…5°¢&WGW&â7VÒ´ÖF‚æÖ‚ƒÆ‡æVVB’´ÖF‚æÖ‚ƒÇ7æVVB“°¢ÒÃ’²‡G&–òç6öÖR†VçG'“ÓæVçG'’æ–æFWƒÓÓÖ67FW$–æFW‚“óã£“°¢–b‡66÷&Sæ&W7E66÷&R—²&W7C×G&–ó²&W7E&–Ö'“Ö6VçFW#²&W7E66÷&S×66÷&S²Ğ¢Ò“°¢&WGW&â¶VçG&–W3¦&W7Bç6Æ–6RƒÃ2’Ç&–Ö'”–æFWƒ¤çVÖ&W"æ—4–çFVvW"†&W7E&–Ö'’“ö&W7E&–Ö'“¢†&W7E³Óö&W7E³Òæ–æFWƒ¦çVÆÂ—Ó°¢Ğ¢gVæ7F–öâvWDÖöç7FW$ÆÇ•G&•F&vWG2†67FW$–æFW‚ÆVçG&–W2—°¢&WGW&âvWDÖöç7FW$ÆÇ•G&•F&vWF–ær†67FW$–æFW‚ÆVçG&–W2’æVçG&–W3°¢Ğ¢gVæ7F–öâvWDÖöç7FW%7W÷'EF&vWF–ær‡6¶–ÆÂÆ67FW$–æFW‚ÆVçG&–W2—°¢6öç7BF&vWEG—SÕ7G&–ær‡6¶–ÆÂbg6¶–ÆÂçF&vWEG—WÇÂ&ÆÇ”ÆÂ"“°¢–b‡F&vWEG—SÓÓÒ&ÆÇ•G&’"—²&WGW&âvWDÖöç7FW$ÆÇ•G&•F&vWF–ær†67FW$–æFW‚ÆVçG&–W2“²Ğ¢6öç7BÆ—f–æsÒ†VçG&–W7ÇÅµÒ’æf–ÇFW"†VçG'“ÓæVçG'’bfVçG'’æÖöç7FW"bfVçG'’æÖöç7FW"æÆ—fRÓÖfÇ6RbdçVÖ&W"†VçG'’æÖöç7FW"æ‡“ã“°¢–b‡F&vWEG—SÓÓÒ&ÆÇ’"—°¢6öç7B6VÆcÖÆ—f–æræf–æB†VçG'“ÓæVçG'’æ–æFWƒÓÓÖ67FW$–æFW‚—ÇÆÆ—f–æu³×ÇÆçVÆÃ°¢&WGW&â¶VçG&–W3§6VÆcõ·6VÆeÓ¥µÒÇ&–Ö'”–æFWƒ§6VÆc÷6VÆbæ–æFWƒ¦çVÆÇÓ°¢Ğ¢&WGW&â¶VçG&–W3¦Æ—f–ærÇ&–Ö'”–æFWƒ¦çVÆÇÓ°¢Ğ¢v–æF÷rçcCvWDÖöç7FW$ÆÇ•G&•F&vWF–æsÖvWDÖöç7FW$ÆÇ•G&•F&vWF–æs°¢v–æF÷rçcCvWDÖöç7FW$ÆÇ•G&•F&vWG3ÖvWDÖöç7FW$ÆÇ•G&•F&vWG3° ¢gVæ7F–öâÇ•F–ÖVDÖöç7FW$'Vfb†Ööç7FW'5Fô'VfbÇG—RÇGW&ç2ÆÖ÷VçBÆ÷F–öç2—°¢6öç7B÷G3Ö÷F–öç2bgG—Vöb÷F–öç3ÓÓÒ&ö&¦V7B#ö÷F–öç3§·Ó°¢Ööç7FW'5Fô'Vfbæf÷$V6‚†Ööç7FW#Óç°¢–b‚Ööç7FW'ÇÂÖöç7FW"æÆ—fR—²&WGW&ã²Ğ¢6öç7BÖöç7FW$–æFWƒ×G—VöbÖöç7FW'2ÓÒ'VæFVf–æVB#öÖöç7FW'2æ–æFW„öb†Ööç7FW"“¢Ó°¢–b€¢G—Vöbv–æF÷rçcs46äÇ”æÖVEW'6—7FVçE7FFSÓÓÒ&gVæ7F–öâ"b`¢v–æF÷rçcs46äÇ”æÖVEW'6—7FVçE7FFR€¢Ööç7FW"ÇG—RÂ&Ööç7FW""ÆÖöç7FW$–æFWƒãÓöÖöç7FW$–æFWƒ§VæFVf–æVBÀ¢G—SÓÓÒ'&vR#ò.h	.x²#§G—SÓÓÒ'&W6—7Fæ6R#ò.k
>Zé®zYî™i"#¢.™h>‹«.Š2 ¢¢—²&WGW&ã²Ğ¢–b†Ööç7FW"çcCFVÔ'Vfg3òç6öÖR†'VfcÓæ'VfbçG—SÓÓ×G—Rbf'VfbçGW&ç4ÆVgCã’—²&WGW&ã²Ğ¢Ööç7FW"çcCFVÔ'Vfg3ÖÖöç7FW"çcCFVÔ'Vfg7ÇÅµÓ°¢6öç7B'Vfc×·G—RÇGW&ç4ÆVgC§GW&ç2ÆÖ÷VçGÓ°¢–b‡G—SÓÓÒ'&vR"—°¢'Vfbæ÷&–v–æÄGF6³ÖÖöç7FW"æGF6³²'Vfbæ÷&–v–æÄÖv–4GF6³ÖÖöç7FW"æÖv–4GF6³°¢'Vfbæ&öçW5W&6VçCÓ#S°¢'Vfbæ7&—D6†æ6T&öçW5W&6VçCÓ#S°¢'Vfbæ7&—DFÖvT&öçW5W&6VçCÓS°¢ÖVÇ6R–b‡G—SÓÓÒ'&W6—7Fæ6R"—°¢'Vfbæ67W&7”&öçW5W&6VçCÔÖF‚æÖ‚ƒÄçVÖ&W"†÷G2æ67W&7”&öçW5W&6VçB—ÇÃ“°¢Ööç7FW"ç&W6—7Fæ6SÒ„çVÖ&W"†Ööç7FW"ç&W6—7Fæ6R—ÇÃ’¶Ö÷VçC°¢ÖVÇ6R–b‡G—SÓÓÒ&FöFvR"—°¢'Vfbæ÷&–v–æÄWf6–öãÖÖöç7FW"æWf6–öã°¢Ööç7FW"æWf6–öã×G—Vöbv–æF÷rçcs46öÖ&–æTWf6–öå&FW3ÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcs46öÖ&–æTWf6–öå&FW2…¶'Vfbæ÷&–v–æÄWf6–öâÆÖ÷VçEÒ¢¤ÖF‚æÖ–âƒƒRÂ„çVÖ&W"†'Vfbæ÷&–v–æÄWf6–öâ—ÇÃ’²„çVÖ&W"†Ö÷VçB—ÇÃ’“°¢Ğ¢6öç7BF—7Æ”'Vfc×°¢G—S§G—SÓÓÒ'&vR#ò'&vR#¢'cCFVÔ'Vfb"À¢cC'VfeG—S§G—RÀ¢GW&ç4ÆVgC§GW&ç0¢Ó°¢–b‡G—SÓÓÒ'&W6—7Fæ6R"—°¢F—7Æ”'Vfbæ67W&7”&öçW5W&6VçCÖ'Vfbæ67W&7”&öçW5W&6VçC°¢Ğ¢–b‡G—SÓÓÒ'&vR"—°¢F—7Æ”'Vfbæ&öçW5W&6VçCÖ'Vfbæ&öçW5W&6VçC°¢F—7Æ”'Vfbæ7&—D6†æ6T&öçW5W&6VçCÖ'Vfbæ7&—D6†æ6T&öçW5W&6VçC°¢F—7Æ”'Vfbæ7&—DFÖvT&öçW5W&6VçCÖ'Vfbæ7&—DFÖvT&öçW5W&6VçC°¢Ğ¢–b‡G—Vöbv–æF÷rçcs4Ö&µW'6—7FVçE7FFTæÖSÓÓÒ&gVæ7F–öâ"—°¢v–æF÷rçcs4Ö&µW'6—7FVçE7FFTæÖR†'VfbÇG—R“°¢v–æF÷rçcs4Ö&µW'6—7FVçE7FFTæÖR†F—7Æ”'VfbÇG—R“°¢Ğ¢'VfbæF—7Æ”'VfcÖF—7Æ”'Vfc°¢Ööç7FW"çcCFVÔ'Vfg2çW6‚†'Vfb“°¢Ööç7FW"æ7F—fT'Vfg3ÖÖöç7FW"æ7F—fT'Vfg7ÇÅµÓ°¢Ööç7FW"æ7F—fT'Vfg2çW6‚†F—7Æ”'Vfb“°¢Ò“°¢Ğ ¢v–æF÷rçcCG'”Ööç7FW%7V6–Ä7F–öãÖgVæ7F–öâ†Ööç7FW$–æFW‚—°¢6öç7BÖöç7FW#ÖÖöç7FW'5¶Ööç7FW$–æFW…Ó°¢6öç7B7W÷'D–G3ÖÖöç7FW"bgG—Vöbv–æF÷rçcCDvWDÆVvÄÖöç7FW%6¶–ÆÄ–G3ÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcCDvWDÆVvÄÖöç7FW%6¶–ÆÄ–G2†Ööç7FW"Â'7W÷'B"¢¢†Ööç7FW"bfÖöç7FW"çcC7W÷'E6¶–ÆÄ–G7ÇÅµÒ’æf–ÇFW"†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢&WGW&â‡6¶–ÆÂbg6¶–ÆÂæVÆVÖVçBbg6¶–ÆÂæVÆVÖVçCÓÓÖÖöç7FW"æVÆVÖVçB“°¢Ò“°¢–b‚Ööç7FW'ÇÂÖöç7FW"æÆ—fWÇÂ7W÷'D–G2æÆVæwF‚—²&WGW&âfÇ6S²Ğ¢6öç7BÆÇ”VçG&–W3Ö7W'&VçD&GFÆTÖöç7FW'2æÖ†–æFWƒÓâ‡¶–æFWƒ¦–æFW‚ÆÖöç7FW#¦Ööç7FW'5¶–æFW…×Ò’¢æf–ÇFW"†VçG'“ÓæVçG'’æÖöç7FW"bfVçG'’æÖöç7FW"æÆ—fR“°¢6öç7BÆÆ–W3ÖÆÇ”VçG&–W2æÖ†VçG'“ÓæVçG'’æÖöç7FW"“°¢6öç7Bf÷&6VE7W÷'E6¶–ÆÄ–CÖÖöç7FW"bfÖöç7FW"çcsTf÷&6VE7W÷'E6¶–ÆÄ–C°¢–b†Ööç7FW"—²FVÆWFRÖöç7FW"çcsTf÷&6VE7W÷'E6¶–ÆÄ–C²Ğ¢ÆWB6¶–ÆÄ–CÖf÷&6VE7W÷'E6¶–ÆÄ–Bbg7W÷'D–G2æ–æ6ÇVFW2†f÷&6VE7W÷'E6¶–ÆÄ–B¢bg6¶–ÆÄFF&6U¶f÷&6VE7W÷'E6¶–ÆÄ–EÓöf÷&6VE7W÷'E6¶–ÆÄ–C¦çVÆÃ°¢ÆWBF&vWCÖçVÆÃ°¢ÆWB†VÅF&vWG3ÕµÓ°¢ÆWB7W÷'EF&vWF–æsÖçVÆÃ°¢6öç7BÆÄÆÆ–W4æVVD†VÆ–æsÖÆÇ”VçG&–W2ç6öÖR†VçG'“Óà¢Ööç7FW$&6T‡†VçG'’æÖöç7FW"“ÆÖöç7FW$&6TÖ„‡†VçG'’æÖöç7FW"’¢ãs ¢“°¢6öç7B†VÅ6¶–ÆÃ×6¶–ÆÄFF&6Ræ†VÅ7VÆÃ°¢–b‚6¶–ÆÄ–Bbg7W÷'D–G2æ–æ6ÇVFW2‚&†VÅ7VÆÂ"’bfÆÄÆÆ–W4æVVD†VÆ–ærbf†VÅ6¶–ÆÂbfÖöç7FW"ç7ãÒ††VÅ6¶–ÆÂç76÷7GÇÃ’—°¢7W÷'EF&vWF–æsÖvWDÖöç7FW$ÆÇ•G&•F&vWF–ær†Ööç7FW$–æFW‚ÆÆÇ”VçG&–W2“°¢†VÅF&vWG3×7W÷'EF&vWF–æræVçG&–W3°¢–b††VÅF&vWG2æÆVæwF‚—²6¶–ÆÄ–CÒ&†VÅ7VÆÂ#²Ğ¢Ğ¢6öç7B6'&–VDGF6·3×G—Vöbv–æF÷rçcCDvWDÆVvÄÖöç7FW%6¶–ÆÄ–G3ÓÓÒ&gVæ7F–öâ ¢÷v–æF÷rçcCDvWDÆVvÄÖöç7FW%6¶–ÆÄ–G2†Ööç7FW"Â&GF6²"¢¢†Ööç7FW"ç6¶–ÆÄ–G7ÇÅµÒ’æf–ÇFW"†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢&WGW&â‡6¶–ÆÂbg6¶–ÆÂæVÆVÖVçBbg6¶–ÆÂæVÆVÖVçCÓÓÖÖöç7FW"æVÆVÖVçB“°¢Ò“°¢6öç7Bff÷&F&ÆTGF6·3Ö6'&–VDGF6·2æf–ÇFW"†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢&WGW&â‡6¶–ÆÂbfÖöç7FW"ç7ãÒ‡6¶–ÆÂç76÷7GÇÃ’“°¢Ò“°¢6öç7Bff÷&F&ÆT'Vfg3×7W÷'D–G2æf–ÇFW"†–CÓç°¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U¶–EÓ°¢&WGW&â–BÓÒ&†VÅ7VÆÂ"bb‡6¶–ÆÂbfÖöç7FW"ç7ãÒ‡6¶–ÆÂç76÷7GÇÃ’“°¢Ò“°¢–b‚6¶–ÆÄ–B—°¢6öç7B6FVv÷'“×v–æF÷räf÷W%7–Ö&öÇ4VæV×•6¶–ÆÄ¢÷v–æF÷räf÷W%7–Ö&öÇ4VæV×•6¶–ÆÄ’æ6†ö÷6T6FVv÷'’†ff÷&F&ÆTGF6·2Æff÷&F&ÆT'Vfg2ÄÖF‚ç&æFöÒ‚’¢¢„ÖF‚ç&æFöÒ‚“Âãsò&GF6²#¢&'Vfb"“°¢–b†6FVv÷'“ÓÓÒ&GF6²"bfff÷&F&ÆTGF6·2æÆVæwF‚—°¢Ööç7FW"çcsTf÷&6VDGF6µ6¶–ÆÄ–CÖff÷&F&ÆTGF6·5´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¦ff÷&F&ÆTGF6·2æÆVæwF‚•Ó°¢&WGW&âfÇ6S°¢Ğ¢–b†6FVv÷'’ÓÒ&'Vfb"bfff÷&F&ÆT'Vfg2æÆVæwF‚—°¢ò¢âVæff÷&F&ÆRöÖ—76–ærGF6²ööÂfÆÇ2&6²öæ6RFò'Vfg2â¢ğ¢ÖVÇ6R–b†6FVv÷'“ÓÓÒ&æ÷&ÖÂ"—²&WGW&âfÇ6S²Ğ¢Ğ¢–b‚6¶–ÆÄ–Bbg7W÷'D–G2æ–æ6ÇVFW2‚&&'&–W""’—°¢F&vWCÖÆÆ–W2æf–æB†—FVÓÓâ†—FVÒçcC6†–VÆBbf—FVÒçcC6†–VÆBæ—4&'&–W"’“°¢–b‡F&vWB—²6¶–ÆÄ–CÒ&&'&–W"#²Ğ¢Ğ¢–b‚6¶–ÆÄ–Bbg7W÷'D–G2æ–æ6ÇVFW2‚'&vR"’bbÆÆ–W2ç6öÖR†—FVÓÓæ—FVÒçcCFVÔ'Vfg3òç6öÖR†'VfcÓæ'VfbçG—SÓÓÒ'&vR"bf'VfbçGW&ç4ÆVgCã’’—²6¶–ÆÄ–CÒ'&vR#²Ğ¢–b‚6¶–ÆÄ–Bbg7W÷'D–G2æ–æ6ÇVFW2‚&F–æv†—6†Vç¦†Vâ"’bbÆÆ–W2ç6öÖR†—FVÓÓæ—FVÒçcCFVÔ'Vfg3òç6öÖR†'VfcÓæ'VfbçG—SÓÓÒ'&W6—7Fæ6R"bf'VfbçGW&ç4ÆVgCã’’—²6¶–ÆÄ–CÒ&F–æv†—6†Vç¦†Vâ#²Ğ¢–b‚6¶–ÆÄ–Bbg7W÷'D–G2æ–æ6ÇVFW2‚&FöFvU6¶–ÆÂ"’bbÆÆ–W2ç6öÖR†—FVÓÓæ—FVÒçcCFVÔ'Vfg3òç6öÖR†'VfcÓæ'VfbçG—SÓÓÒ&FöFvR"bf'VfbçGW&ç4ÆVgCã’’—²6¶–ÆÄ–CÒ&FöFvU6¶–ÆÂ#²Ğ¢–b‚6¶–ÆÄ–B—°¢–b†ff÷&F&ÆTGF6·2æÆVæwF‚—°¢Ööç7FW"çcsTf÷&6VDGF6µ6¶–ÆÄ–CÖff÷&F&ÆTGF6·5´ÖF‚æfÆö÷"„ÖF‚ç&æFöÒ‚’¦ff÷&F&ÆTGF6·2æÆVæwF‚•Ó°¢Ğ¢&WGW&âfÇ6S°¢Ğ¢6öç7B6¶–ÆÃ×6¶–ÆÄFF&6U·6¶–ÆÄ–EÓ°¢–b†Ööç7FW"ç7Â‡6¶–ÆÂç76÷7GÇÃ’—²&WGW&âfÇ6S²Ğ¢–b‚7W÷'EF&vWF–ær—°¢–b‡6¶–ÆÄ–CÓÓÒ&&'&–W""bgF&vWB—°¢6öç7BVçG'“ÖÆÇ”VçG&–W2æf–æB†—FVÓÓæ—FVÒæÖöç7FW#ÓÓ×F&vWB—ÇÆçVÆÃ°¢7W÷'EF&vWF–æs×¶VçG&–W3¦VçG'“õ¶VçG'•Ó¥µÒÇ&–Ö'”–æFWƒ¦VçG'“öVçG'’æ–æFWƒ¦çVÆÇÓ°¢ÖVÇ6W°¢7W÷'EF&vWF–æsÖvWDÖöç7FW%7W÷'EF&vWF–ær‡6¶–ÆÂÆÖöç7FW$–æFW‚ÆÆÇ”VçG&–W2“°¢Ğ¢Ğ¢6öç7B7W÷'EF&vWD–G3Ò‡7W÷'EF&vWF–æræVçG&–W7ÇÅµÒ’æÖ†VçG'“ÓæVçG'’æ–æFW‚“°¢Ööç7FW"ç7Ó×6¶–ÆÂç76÷7GÇÃ°¢6†÷tÖöç7FW%6¶–ÆÄæÖT&FvR‡6¶–ÆÂææÖRÇ6¶–ÆÂæVÆVÖVçGÇÆÖöç7FW"æVÆVÖVçBÆÖöç7FW$–æFW‚Ç7W÷'EF&vWF–ærç&–Ö'”–æFW‚Ç7W÷'EF&vWD–G2Â&Ööç7FW""Ç6¶–ÆÂçF&vWEG—R“°¢6öç7BÆWfVÃÔÖF‚æÖ‚ƒÄÖF‚æÖ–â€¢çVÖ&W"‡6¶–ÆÂæÖ„ÆWfVÂ—ÇÃÀ¢çVÖ&W"†Ööç7FW"çcCf÷&6U6¶–ÆÄÆWfVÇÇÆÖöç7FW"çcC6¶–ÆÄÆWfVÂ—ÇÃ¢’“°¢6öç7BÆWfVÅfÇVSÒ‡fÇVW2ÆfÆÆ&6²“Óç°¢–b‚'&’æ—4'&’‡fÇVW2—ÇÂfÇVW2æÆVæwF‚—²&WGW&âçVÖ&W"†fÆÆ&6²—ÇÃ²Ğ¢&WGW&âçVÖ&W"‡fÇVW5´ÖF‚æÖ‚ƒÄÖF‚æÖ–â‡fÇVW2æÆVæwF‚ÓÆÆWfVÂÓ’•Ò—ÇÃ°¢Ó°¢–b‡6¶–ÆÄ–CÓÓÒ&†VÅ7VÆÂ"—°¢6öç7B‡Ö÷VçCÖÆWfVÅfÇVR€¢6¶–ÆÂæ†VÄ‡'”ÆWfVÂÀ¢„çVÖ&W"‡6¶–ÆÂæ&6T†VÂ—ÇÃ’²„çVÖ&W"‡6¶–ÆÂæ†VÅW$ÆWfVÂ—ÇÃ’¢†ÆWfVÂÓ¢“°¢6öç7B7W&6VçCÖÆWfVÅfÇVR‡6¶–ÆÂç7&W7F÷&UW&6VçD'”ÆWfVÂÃ“°¢ÆWB‡F÷FÃÓ°¢ÆWB7F÷FÃÓ°¢†VÅF&vWG2æf÷$V6‚†VçG'“Óç°¢6öç7BÆÇ“ÖVçG'’æÖöç7FW#°¢6öç7B†VÆVC×v–æF÷rçcC†VÄÖöç7FW%&W6W'f–æu6†–VÆB†ÆÇ’Æ‡Ö÷VçB“°¢6öç7B&Vf÷&U5ÔÖF‚æÖ‚ƒÄçVÖ&W"†ÆÇ’ç7—ÇÃ“°¢6öç7B7Ö÷VçCÖVçG'’æ–æFWƒÓÓÖÖöç7FW$–æFW€¢ó ¢¤ÖF‚æfÆö÷"„ÖF‚æÖ‚ƒÄçVÖ&W"†ÆÇ’æÖ…5—ÇÃ’§7W&6VçBó“°¢ÆÇ’ç7ÔÖF‚æÖ–â„ÖF‚æÖ‚†&Vf÷&U5ÄçVÖ&W"†ÆÇ’æÖ…5—ÇÃ’Æ&Vf÷&U5·7Ö÷VçB“°¢6öç7B&W7F÷&VE5ÖÆÇ’ç7Ö&Vf÷&U5°¢‡F÷FÂ³Ö†VÆVC°¢7F÷FÂ³×&W7F÷&VE5°¢–b††VÆVCãbgG—Vöb6†÷tÖöç7FW$†—CÓÓÒ&gVæ7F–öâ"—²6†÷tÖöç7FW$†—B†VçG'’æ–æFW‚Æ†VÆVBÂ&†VÂ"“²Ğ¢–b‡G—Vöbv–æF÷rçcCÆ”6&DVffV7CÓÓÒ&gVæ7F–öâ"—²v–æF÷rçcCÆ”6&DVffV7B‚&Ööç7FW""ÆVçG'’æ–æFW‚Â&†VÂ"“²Ğ¢ZŠW«®Šğ®+b-jwZ­Ú.¶›­º$zzb¥æÚ±î¸Â¸­yêë¢°k¢G§¦*^