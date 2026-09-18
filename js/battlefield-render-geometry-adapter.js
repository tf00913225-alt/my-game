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
    const pendingPopupAnchors=[];

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

    function popupKind(popup,args){
        if(popup&&popup.classList&&popup.classList.contains("miss-popup")){ return "miss"; }
        const text=String((popup&&popup.textContent)||"");
        const type=String((args&&args[2])||"").toLowerCase();
        if(type.includes("heal")||text.startsWith("+")){ return "heal"; }
        if(type.includes("shield")){ return "shield"; }
        if(type.includes("buff")||type.includes("debuff")||type.includes("status")){ return "status"; }
        if(args&&args[3]===true){ return "critical"; }
        return "damage";
    }

    function applyPopupAnchor(popup,slot,kind){
        if(!popup||!slot){ return false; }
        const anchor=anchorForSlot(slot,kind);
        if(!anchor){ return false; }
        popup.dataset.slot=slot;
        popup.dataset.geometryOwner="fixed-slot";
        popup.dataset.popupKind=kind||"damage";
        popup.classList.add("v-fixed-slot-popup");
        popup.style.setProperty("position","fixed","important");
        popup.style.setProperty("left",anchor.x+"px","important");
        popup.style.setProperty("top",anchor.y+"px","important");
        popup.style.setProperty("font-size",kind==="critical"?"20px":"18px","important");
        popup.style.setProperty("transform","translate(-50%,-50%)","important");
        if(document.body&&popup.parentNode!==document.body){ document.body.appendChild(popup); }
        return true;
    }

    function newestPopup(before,selector,scope){
        const candidates=[];
        if(scope&&scope.querySelectorAll){ candidates.push(...scope.querySelectorAll(selector)); }
        if(document.body&&document.body.querySelectorAll){ candidates.push(...document.body.querySelectorAll(selector)); }
        for(let index=candidates.length-1;index>=0;index--){
            if(!before.has(candidates[index])){ return candidates[index]; }
        }
        return null;
    }

    function rememberPending(slot,kind){
        if(!slot){ return; }
        pendingPopupAnchors.push({slot:slot,kind:kind,expiresAt:Date.now()+2400});
        while(pendingPopupAnchors.length>24){ pendingPopupAnchors.shift(); }
    }

    function consumePending(popup){
        const now=Date.now();
        while(pendingPopupAnchors.length&&pendingPopupAnchors[0].expiresAt<now){ pendingPopupAnchors.shift(); }
        const pending=pendingPopupAnchors.shift();
        return pending?applyPopupAnchor(popup,pending.slot,pending.kind):false;
    }

    function wrapDamagePopup(){
        if(typeof window.showDamagePopup!=="function"||window.showDamagePopup.__fixedSlotPopupOwner){ return; }
        const previous=window.showDamagePopup;
        const wrapped=function(element){
            const args=Array.prototype.slice.call(arguments);
            const slot=slotForElement(element);
            const before=new Set(document.querySelectorAll(".damage-popup"));
            rememberPending(slot,"damage");
            const result=previous.apply(this,args);
            const popup=newestPopup(before,".damage-popup",element);
            if(popup){
                const kind=popupKind(popup,args);
                if(applyPopupAnchor(popup,slot,kind)){ pendingPopupAnchors.pop(); }
            }
            return result;
        };
        wrapped.__fixedSlotPopupOwner=true;
        wrapped.__previous=previous;
        window.showDamagePopup=wrapped;
        try{ showDamagePopup=wrapped; }catch(_){ }
    }

    function wrapMissPopup(){
        if(typeof window.showMissEffect!=="function"||window.showMissEffect.__fixedSlotPopupOwner){ return; }
        const previous=window.showMissEffect;
        const wrapped=function(isPlayerTarget,index){
            const side=isPlayerTarget?"player":"monster";
            const slot=slots.getSlotForCombatant(side,Number(index)||0,{enemySnapshot:slots.getActiveEnemySnapshot()});
            rememberPending(slot,"miss");
            return previous.apply(this,arguments);
        };
        wrapped.__fixedSlotPopupOwner=true;
        wrapped.__previous=previous;
        window.showMissEffect=wrapped;
        try{ showMissEffect=wrapped; }catch(_){ }
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
        neutralizeLegacyPresentationGeometry:neutralizeLegacyPresentationGeometry
    });
    window.FourSymbolsBattlefieldRenderGeometry=api;

    if(typeof window.renderBattle==="function"&&!window.renderBattle.__fixedSlotRenderV2){
        const previous=window.renderBattle;
        const wrapped=function(){
            const result=previous.apply(this,arguments);
            reconcile();
            return result;
        };
        wrapped.__fixedSlotRenderV2=true;
        window.renderBattle=wrapped;
        try{ renderBattle=wrapped; }catch(_){ }
    }

    neutralizeLegacyPresentationGeometry();
    wrapDamagePopup();
    wrapMissPopup();

    function isOwnedFixedStructure(node){
        if(!(node instanceof Element)||node.dataset.geometryOwner!=="fixed-slot"){ return false; }
        return !!node.matches?.(".v-fixed-slot-row,.v-fixed-enemy-slot,.v-fixed-ally-slot,.v-fixed-boss-footprint");
    }

    const observer=new MutationObserver(records=>{
        let needsReconcile=false;
        records.forEach(record=>{
            record.addedNodes.forEach(node=>{
                if(!(node instanceof Element)){ return; }
                const popups=node.matches&&node.matches(".damage-popup")?[node]:Array.from(node.querySelectorAll?.(".damage-popup")||[]);
                popups.forEach(popup=>{
                    if(popup.dataset.geometryOwner==="fixed-slot"){ return; }
                    const card=popup.closest?.(".battle-player,.battle-monster,[data-slot]");
                    const slot=card?slotForElement(card):null;
                    if(slot){ applyPopupAnchor(popup,slot,popupKind(popup,[])); }
                    else{ consumePending(popup); }
                });
                /* Reconcile only legacy/new combat content. The fixed rows and
                   holders below are created by reconcile() itself; observing them
                   must not recursively schedule another reconcile forever. */
                if(isOwnedFixedStructure(node)){ return; }
                if(
                    node.id==="battleMonsterArea"||node.id==="battlePlayerRow"||
                    node.matches?.(".battle-monster,.battle-player,.v131-monster-row")||
                    node.querySelector?.(".battle-monster,.battle-player")
                ){
                    needsReconcile=true;
                }
            });
        });
        if(needsReconcile){ queueReconcile(); }
    });
    if(document.body){ observer.observe(document.body,{subtree:true,childList:true}); }

    reconcile();
})();
