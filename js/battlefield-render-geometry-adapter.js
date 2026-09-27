/* Fixed Slot Battlefield Rendering V2 — render geometry adapter.
   FourSymbolsBattlefieldSlots remains the only Slot/formation geometry owner.
   This adapter only reconciles legacy renderers/popups back onto that owner. */
(function installFixedSlotBattlefieldRenderGeometryV2(){
    "use strict";

    if(typeof window==="undefined"||window.__fixedSlotBattlefieldRenderGeometryV2Installed){ return; }
    const slots=window.FourSymbolsBattlefieldSlots;
    if(!slots){ return; }
    window.__fixedSlotBattlefieldRenderGeometryV2Installed=true;

    const VERSION="fixed-slot-render-v2";
    const LEGACY_PRESENTATION_STYLE_ID="v174-cardless-battle-style";
    const POPUP_ANCHORS=Object.freeze({
        damage:Object.freeze({x:.5,y:.28}),
        critical:Object.freeze({x:.5,y:.24}),
        heal:Object.freeze({x:.5,y:.28}),
        shield:Object.freeze({x:.5,y:.30}),
        miss:Object.freeze({x:.5,y:.26}),
        status:Object.freeze({x:.5,y:.42})
    });
    const VFX_SCALE_CONTRACT=Object.freeze({
        single:Object.freeze({shape:"single",scale:1}),
        tri:Object.freeze({shape:"tri",scale:1}),
        row:Object.freeze({shape:"row",scale:1}),
        column:Object.freeze({shape:"column",scale:1}),
        all:Object.freeze({shape:"all",scale:1})
    });

    let reconciling=false;
    let reconcileQueued=false;

    /* Cardless presentation is source CSS only. Remove the retired runtime
       stylesheet if an old session created it; never inject a replacement. */
    function neutralizeLegacyPresentationGeometry(){
        if(typeof document==="undefined"){ return; }
        const style=document.getElementById(LEGACY_PRESENTATION_STYLE_ID);
        if(style){ style.remove(); }
    }

    function integerIndexes(value){
        return Array.isArray(value)?value.filter(Number.isInteger).slice(0,10):[];
    }

    function activeEnemyIndexes(){
        try{
            return integerIndexes(typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]);
        }catch(_){ return []; }
    }

    function enemyRankWeight(index){
        try{
            const monster=typeof monsters!=="undefined"?monsters[index]:null;
            const rank=typeof getMonsterRank==="function"?getMonsterRank(monster):(monster&&monster.rank);
            return rank==="boss"?3:(rank==="elite"?2:1);
        }catch(_){ return 1; }
    }

    function activeEnemySnapshot(indexes){
        let snapshot=slots.getActiveEnemySnapshot();
        const requested=integerIndexes(indexes);
        const boss=bossBattleOwner();
        const bossActive=!!(boss&&typeof boss.isActive==="function"&&boss.isActive());
        if(bossActive){
            const unslotted=requested.filter(index=>{
                const monster=typeof monsters!=="undefined"?monsters[index]:null;
                return !!(monster&&monster.alive!==false&&Number(monster.hp)>0)&&
                    !(snapshot&&slots.getEnemySlotForMonster(snapshot,index));
            });
            if(unslotted.length){
                if(boss&&typeof boss.recordLifecycleViolation==="function"){
                    boss.recordLifecycleViolation("boss-active-entity-without-slot",{
                        indexes:unslotted,
                        snapshotKind:snapshot&&snapshot.kind||null,
                        snapshotBossOwned:!!(snapshot&&snapshot.bossBattleSnapshot)
                    });
                }
                /* Boss geometry cannot degrade into a normal formation. The
                   unassigned entity is refused by this render pass so the
                   formal B1/B5/F1/F5/Boss footprint remains intact. */
                return snapshot;
            }
            return snapshot;
        }
        const complete=snapshot&&requested.every(index=>!!slots.getEnemySlotForMonster(snapshot,index));
        if(!complete&&requested.length){
            snapshot=slots.createEnemyFormationSnapshot(requested,{
                originalFormationType:requested.length,
                rankWeight:enemyRankWeight
            });
            slots.setActiveEnemySnapshot(snapshot);
        }
        return snapshot;
    }

    function makeSlot(className,slot){
        const node=document.createElement("div");
        node.className=className;
        node.dataset.slot=slot;
        node.dataset.geometryOwner="fixed-slot";
        return node;
    }

    function applyPresentation(card,kind){
        const owner=window.FourSymbolsBattlePresentation;
        if(owner&&typeof owner.applyUnit==="function"){ owner.applyUnit(card,kind); }
    }

    function bossBattleOwner(){ return window.FourSymbolsBossBattle||null; }

    function canonicalizeEnemyZone(){
        const area=document.getElementById("battleMonsterArea");
        if(!area){ return; }
        const indexes=activeEnemyIndexes();
        const snapshot=activeEnemySnapshot(indexes);
        if(!snapshot){ return; }

        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battleMonster"+index);
            if(card){ applyPresentation(card,"monster");cards.set(index,card); }
        });
        const bossOwner=bossBattleOwner();
        const bossIndex=bossOwner&&typeof bossOwner.getBossIndex==="function"?bossOwner.getBossIndex():null;
        const bossCard=Number.isInteger(bossIndex)?cards.get(bossIndex):null;

        const fragment=document.createDocumentFragment();
        [slots.enemyBackSlots,slots.enemyFrontSlots].forEach((rowSlots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-slot-row v-fixed-enemy-row";
            row.dataset.slotRow=rowIndex===0?"back":"front";
            row.dataset.geometryOwner="fixed-slot";
            rowSlots.forEach(slot=>{
                const holder=makeSlot("v-fixed-battle-slot v-fixed-enemy-slot",slot);
                const index=slots.getAssignedMonsterAtEnemySlot(snapshot,slot);
                const card=Number.isInteger(index)&&index!==bossIndex?cards.get(index):null;
                if(card){
                    card.dataset.slot=slot;
                    card.dataset.geometryOwner="fixed-slot";
                    holder.appendChild(card);
                }
                row.appendChild(holder);
            });
            fragment.appendChild(row);
        });
        if(bossCard){
            const footprint=document.createElement("div");
            footprint.className="v-fixed-boss-footprint";
            footprint.dataset.geometryOwner="fixed-slot";
            footprint.dataset.slots=slots.bossFootprintSlots.join(" ");
            bossCard.classList.add("gameplay-boss-card");
            bossCard.dataset.slot="ENEMY_B3";
            bossCard.dataset.geometryOwner="fixed-slot";
            footprint.appendChild(bossCard);
            fragment.appendChild(footprint);
        }
        area.replaceChildren(fragment);
        area.classList.add("v-fixed-enemy-zone","v-fixed-zone-v2");
        area.classList.remove("battle-monsters","v131-formation","v141-fixed-formation");
        area.dataset.geometryOwner="fixed-slot";
        area.dataset.monsterCount=String(indexes.length);
        area.dataset.formationType=String(snapshot.originalFormationType||indexes.length);
        area.classList.toggle("gameplay-boss-active",!!bossCard);
    }

    function partyIndexes(){
        try{
            if(typeof getExistingPartyIndexes==="function"){
                return getExistingPartyIndexes().filter(Number.isInteger).slice(0,6);
            }
        }catch(_){ }
        return [0,1,2,3,4,5].filter(index=>!!document.getElementById("battlePlayerCard"+index));
    }

    function canonicalizeAllyZone(){
        const area=document.getElementById("battlePlayerRow");
        if(!area||typeof slots.ensureAllyFormation!=="function"){ return; }
        const indexes=partyIndexes();
        const formation=slots.ensureAllyFormation(indexes);
        if(!formation){ return; }
        const cards=new Map();
        indexes.forEach(index=>{
            const card=document.getElementById("battlePlayerCard"+index);
            if(card){ applyPresentation(card,"player");cards.set(index,card); }
        });

        const fragment=document.createDocumentFragment();
        [slots.allyFrontSlots,slots.allyBackSlots].forEach((rowSlots,rowIndex)=>{
            const row=document.createElement("div");
            row.className="v-fixed-slot-row v-fixed-ally-slot-row v-fixed-ally-slot-row-"+(rowIndex===0?"front":"back");
            row.dataset.slotRow=rowIndex===0?"front":"back";
            row.dataset.geometryOwner="fixed-slot";
            rowSlots.forEach(slot=>{
                const holder=makeSlot("v-fixed-unit-slot v-fixed-ally-slot",slot);
                const index=slots.getCharacterAtAllySlot(slot);
                const card=Number.isInteger(index)?cards.get(index):null;
                if(card){
                    card.dataset.slot=slot;
                    card.dataset.geometryOwner="fixed-slot";
                    holder.appendChild(card);
                }
                row.appendChild(holder);
            });
            fragment.appendChild(row);
        });
        area.replaceChildren(fragment);
        area.classList.add("v-fixed-ally-formation","v-fixed-ally-zone","v-fixed-zone-v2");
        area.classList.remove("battle-player-row");
        area.dataset.geometryOwner="fixed-slot";
    }

    function markBattlefieldZones(){
        const page=document.getElementById("battlePage");
        if(page){ page.classList.add("v-fixed-slot-render-v2"); page.dataset.geometryOwner="fixed-slot"; }
        const info=document.querySelector("#battlePage .battle-info-region");
        if(info){ info.classList.add("v-fixed-battle-info-zone"); info.dataset.geometryOwner="fixed-slot"; }
        const action=document.getElementById("battleActionRegion")||document.getElementById("battleCommandRow");
        if(action){ action.classList.add("v-fixed-action-zone"); action.dataset.geometryOwner="fixed-slot"; }
    }

    function reconcile(){
        if(reconciling||typeof document==="undefined"){ return; }
        reconciling=true;
        try{
            neutralizeLegacyPresentationGeometry();
            markBattlefieldZones();
            canonicalizeEnemyZone();
            canonicalizeAllyZone();
        }finally{
            reconciling=false;
        }
    }

    function queueReconcile(){
        if(reconcileQueued){ return; }
        reconcileQueued=true;
        queueMicrotask(()=>{
            reconcileQueued=false;
            reconcile();
        });
    }

    function slotForElement(element){
        if(!element){ return null; }
        const direct=slots.getSlotFromElement(element);
        if(direct){ return direct; }
        const id=String(element.id||"");
        let match=id.match(/^battleMonster(\d+)$/);
        if(match){
            const snapshot=activeEnemySnapshot(activeEnemyIndexes());
            return snapshot?slots.getEnemySlotForMonster(snapshot,Number(match[1])):null;
        }
        match=id.match(/^battlePlayerCard(\d+)$/);
        if(match){ return slots.getAllySlotForCharacter(Number(match[1])); }
        return null;
    }

    function anchorForSlot(slot,kind){
        const rect=slot?slots.getSlotRect(slot):null;
        if(!rect){ return null; }
        const contract=POPUP_ANCHORS[kind]||POPUP_ANCHORS.damage;
        return {
            slot:slot,
            x:rect.left+rect.width*contract.x,
            y:rect.top+rect.height*contract.y,
            rect:rect
        };
    }

    function plainRect(rect){
        if(!rect){ return null; }
        const left=Number(rect.left)||0,top=Number(rect.top)||0;
        const width=Math.max(0,Number(rect.width)||0),height=Math.max(0,Number(rect.height)||0);
        return {left:left,top:top,right:left+width,bottom:top+height,width:width,height:height};
    }

    function battlefieldOverlayGeometry(){
        if(typeof document==="undefined"){ return null; }
        const host=document.getElementById("game-stage")||document.getElementById("battlePage");
        if(!host||typeof host.getBoundingClientRect!=="function"){ return null; }
        const raw=plainRect(host.getBoundingClientRect());
        if(!raw){ return null; }
        const viewportWidth=Math.max(0,Number(window.innerWidth)||raw.right);
        const viewportHeight=Math.max(0,Number(window.innerHeight)||raw.bottom);
        const left=Math.max(0,raw.left),top=Math.max(0,raw.top);
        const right=Math.min(viewportWidth,raw.right),bottom=Math.min(viewportHeight,raw.bottom);
        const rect={
            left:left,top:top,right:Math.max(left,right),bottom:Math.max(top,bottom),
            width:Math.max(0,right-left),height:Math.max(0,bottom-top)
        };
        return {owner:"fixed-slot",rect:rect,center:{x:rect.left+rect.width/2,y:rect.top+rect.height/2}};
    }

    function unitGeometry(side,index){
        const targetSide=side==="monster"?"monster":"player";
        const unitIndex=Number(index);
        if(!Number.isInteger(unitIndex)){ return null; }
        const card=document.getElementById((targetSide==="monster"?"battleMonster":"battlePlayerCard")+unitIndex);
        if(!card||typeof card.getBoundingClientRect!=="function"){ return null; }
        const slot=slotForElement(card);
        const slotRect=slot?plainRect(slots.getSlotRect(slot)):null;
        const carrier=typeof card.closest==="function"
            ?card.closest(".v-fixed-boss-footprint,.v-fixed-enemy-slot,.v-fixed-ally-slot")
            :null;
        const carrierRect=carrier&&typeof carrier.getBoundingClientRect==="function"
            ?plainRect(carrier.getBoundingClientRect())
            :null;
        const cardRect=plainRect(card.getBoundingClientRect());
        const isBossFootprint=!!(carrier&&carrier.classList&&carrier.classList.contains("v-fixed-boss-footprint"));
        const unitRect=isBossFootprint?(carrierRect||cardRect):(slotRect||carrierRect||cardRect);
        if(!unitRect){ return null; }

        const art=card.querySelector(".v174-battle-art,img.v162-abyss-battle-portrait-art,.battle-monster-icon,.battle-player-icon");
        const portraitRect=art&&typeof art.getBoundingClientRect==="function"
            ?plainRect(art.getBoundingClientRect())
            :unitRect;
        const hudNodes=Array.from(card.querySelectorAll(
            ".monster-hp,.monster-sp,.hp-bar,.sp-bar,.battle-monster-name,.battle-player-id,.monster-status-badges"
        ));
        const hudRects=hudNodes
            .map(node=>typeof node.getBoundingClientRect==="function"?plainRect(node.getBoundingClientRect()):null)
            .filter(rect=>rect&&rect.width>0&&rect.height>0);
        const hudTop=hudRects.length?Math.min(...hudRects.map(rect=>rect.top)):unitRect.bottom;
        const hudBottom=hudRects.length?Math.max(...hudRects.map(rect=>rect.bottom)):unitRect.bottom;
        const safeHudTop=Math.max(unitRect.top,Math.min(unitRect.bottom,hudTop));
        const hudSafeRect={
            left:unitRect.left,top:safeHudTop,right:unitRect.right,
            bottom:Math.max(safeHudTop,Math.min(unitRect.bottom,hudBottom)),
            width:unitRect.width,height:Math.max(0,Math.min(unitRect.bottom,hudBottom)-safeHudTop)
        };

        let feedbackTop=Math.max(unitRect.top+6,Math.min(unitRect.bottom-24,portraitRect.top+6));
        let feedbackBottom=Math.min(unitRect.bottom-6,safeHudTop-8);
        if(feedbackBottom-feedbackTop<26){
            feedbackTop=unitRect.top+6;
            feedbackBottom=Math.min(unitRect.bottom-6,Math.max(feedbackTop+26,safeHudTop-4));
        }
        if(feedbackBottom<=feedbackTop){
            feedbackBottom=Math.min(unitRect.bottom-4,feedbackTop+24);
        }
        const feedbackSafeRect={
            left:unitRect.left+4,top:feedbackTop,right:unitRect.right-4,bottom:feedbackBottom,
            width:Math.max(0,unitRect.width-8),height:Math.max(0,feedbackBottom-feedbackTop)
        };

        return {
            owner:"fixed-slot",side:targetSide,index:unitIndex,slot:slot,
            unitRect:unitRect,portraitRect:portraitRect,hudSafeRect:hudSafeRect,
            feedbackSafeRect:feedbackSafeRect,
            center:{x:unitRect.left+unitRect.width/2,y:unitRect.top+unitRect.height/2},
            feedbackAnchor:{
                x:unitRect.left+unitRect.width/2,
                y:Math.max(feedbackSafeRect.top+11,feedbackSafeRect.bottom-12)
            },
            highlightRect:{
                left:Math.max(0,unitRect.left-3),top:Math.max(0,unitRect.top-3),
                width:unitRect.width+6,height:unitRect.height+6
            }
        };
    }

    function geometryForVfx(targetSide,primarySlot,shape){
        const contract=VFX_SCALE_CONTRACT[shape]||VFX_SCALE_CONTRACT.single;
        let rect=null;
        if(contract.shape==="all"){
            rect=slots.getSideRect(targetSide);
        }else if(primarySlot){
            rect=slots.getGeometryRectFromShape(targetSide,primarySlot,contract.shape);
        }
        if(!rect){ return null; }
        return {
            owner:"fixed-slot",
            shape:contract.shape,
            scale:contract.scale,
            baseWidth:rect.width,
            baseHeight:rect.height,
            rect:rect,
            center:{x:rect.left+rect.width/2,y:rect.top+rect.height/2}
        };
    }

    const api=Object.freeze({
        version:VERSION,
        popupAnchors:POPUP_ANCHORS,
        vfxScaleContract:VFX_SCALE_CONTRACT,
        reconcile:reconcile,
        queueReconcile:queueReconcile,
        getSlotForElement:slotForElement,
        getAnchorForSlot:anchorForSlot,
        getVfxGeometry:geometryForVfx,
        getUnitGeometry:unitGeometry,
        getBattlefieldOverlayGeometry:battlefieldOverlayGeometry,
        neutralizeLegacyPresentationGeometry:neutralizeLegacyPresentationGeometry
    });
    window.FourSymbolsBattlefieldRenderGeometry=api;

    window.vFixedSlotAfterBattleRender=reconcile;

    neutralizeLegacyPresentationGeometry();

    /* renderBattle() and explicit battle lifecycle hooks are the geometry authority.
       This adapter publishes geometry only. Battle Floating Feedback is the sole
       DOM/queue/typography owner for transient combat text. */

    reconcile();
})();
