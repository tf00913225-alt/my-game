/* V173.51 — battle / targeting / EXP visibility / ad QA */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351BattleQaInstalled)return;
window.__v17351BattleQaInstalled=true;
let lastBlockedAt=0,adRunning=false;
const visible=el=>{if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden";};
const alertRpg=(m,o)=>typeof window.rpgAlert==="function"?window.rpgAlert(m,o||{}):Promise.resolve(window.alert?.(m));
function inBattle(){try{return typeof battleActive!=="undefined"&&!!battleActive}catch(_){return false}}
function blocked(){const now=Date.now();if(now-lastBlockedAt<600)return;lastBlockedAt=now;void alertRpg("戰鬥進行中無法調整能力值，也無法學習或升級技能。\n請先結束戰鬥後再操作。",{title:"戰鬥中禁止養成操作",confirmText:"知道了",danger:true});}
function guard(name){const old=window[name];if(typeof old!=="function"||old.__v17351Guard)return;const fn=function(){if(inBattle()){blocked();return false}return old.apply(this,arguments)};fn.__v17351Guard=true;window[name]=fn;}
["addPoint","removePoint","confirmStatus","learnSkill","upgradeSkill"].forEach(guard);

function fivePriority(indexes){
    const list=(indexes||[]).filter(Number.isInteger);
    if(list.length!==5)return null;
    try{
        if(typeof window.v148GetAutoTargetPriority==="function"){
            return window.v148GetAutoTargetPriority(list).slice();
        }
    }catch(_){}
    return [list[3],list[1],list[4],list[2],list[0]].filter(Number.isInteger);
}
window.v17351FiveEnemyAutoTargetPriority=fivePriority;

/* V174 battle presentation owner.
   Slot geometry is owned exclusively by FourSymbolsBattlefieldSlots plus the
   formal render-geometry adapter. This layer owns only artwork decoration,
   layering and transient animation. Document HUD placement consumes only the
   formal adapter projection; no Slot/Unit/Boss coordinate formula lives here. */
function removeRetiredPresentationStyles(){
    const style=document.getElementById("v174-cardless-battle-style");
    if(style){ style.remove(); }
}
function numericValue(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;}
function setTextIfChanged(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function battleArtworkSource(card,kind){
    if(!card)return "";
    const computed=getComputedStyle(card);
    let source="";
    if(kind==="monster")source=String(computed.getPropertyValue("--v152-abyss-portrait")||"").trim();
    if(!source||source==="none")source=String(card.style.backgroundImage||"").trim();
    if(!source||source==="none")source=String(computed.backgroundImage||"").trim();
    if(source&&source!=="none"&&!/^linear-gradient/i.test(source))card.dataset.v174BattleArtwork=source;
    return card.dataset.v174BattleArtwork||"";
}
function syncUnitArtwork(card,kind,selectedRecord){
    if(!card)return;
    card.classList.add("v174-cardless-unit");
    let art=card.querySelector(":scope > .v174-battle-art");
    if(!art){art=document.createElement("div");art.className="v174-battle-art";card.insertBefore(art,card.firstChild);}
    let record=null,monster=null;
    if(kind==="monster"){
        try{monster=monsters[Number(String(card.id).replace("battleMonster",""))];}catch(_){}
        if(selectedRecord!==undefined)record=selectedRecord;
        else if(typeof window.v154ResolveMonsterPortraitRecord==="function")record=window.v154ResolveMonsterPortraitRecord(monster);
    }
    const source=kind==="monster"?(record&&record.path?'url("'+record.path+'")':""):battleArtworkSource(card,kind);
    art.style.backgroundImage=source||"none";
    let action=art.querySelector(":scope > .v174-action-motion");
    if(!action){action=document.createElement("div");action.className="v174-action-motion";art.appendChild(action);}
    // One stationary manual-turn marker shares the formal art frame. CSS uses
    // the existing active-turn state; no second selection or coordinate owner.
    if(kind==="player"&&!art.querySelector(":scope > .v174-manual-turn-arrow")){
        const arrow=document.createElement("span");arrow.className="v174-manual-turn-arrow";
        arrow.setAttribute("aria-hidden","true");art.appendChild(arrow);
    }
    let paint=action.querySelector(":scope > .v174-portrait-paint");
    if(record?.generic){if(paint)paint.remove();paint=null;}
    else if(!paint){paint=document.createElement("div");paint.className="v174-portrait-paint";action.appendChild(paint);}
    // Slot identity gives repeatable, unsynchronised breathing without RNG.
    const phase=Number(String(card.id).replace(/\D/g,""))||0;
    art.style.setProperty("--battle-idle-phase",String(-((phase*613+(kind==="monster"?271:0))%3400))+"ms");
    const metadata=record&&record.path&&window.v154GetPortraitPresentation?.(record.path);
    art.classList.toggle("v174-normalized-portrait",!!metadata);
    art.classList.toggle("v174-generic-portrait",!!(record&&record.generic));
    const rank=monster&&(monster.rank||monster.v141BattleRank)||record?.rank;
    const sizeClass=monster?.vGameplayBoss&&!monster?.vGameplayTowerBoss?"BIG_BOSS":rank==="boss"||rank==="smallBoss"?"SMALL_BOSS":rank==="elite"?"ELITE":"STANDARD";
    if(record)card.dataset.portraitSizeClass=sizeClass;
    const classContract=record&&window.v154GetPortraitScaleContract?.()?.[sizeClass];
    if(classContract){
        art.style.setProperty("--portrait-body-height",String(classContract.bodyHeight*100)+"%");
        art.style.setProperty("--portrait-baseline",String(classContract.baseline*100)+"%");
    }
    if(metadata){
        const contract=window.v154GetPortraitScaleContract()[sizeClass];
        const [left,top,right,bottom]=metadata.alphaBounds;
        const aspect=metadata.width/metadata.height,bw=(right-left)/metadata.width,bh=(bottom-top)/metadata.height;
        const width='min('+1/bw*100+'cqw, calc(var(--battle-portrait-visible-height, '+contract.bodyHeight*100+'cqh) * '+aspect/bh+'))';
        paint.style.setProperty("--portrait-width",width);
        paint.style.setProperty("--portrait-aspect",String(aspect));
        paint.style.setProperty("--portrait-center",String((left+right)/2/metadata.width));
        paint.style.setProperty("--portrait-bottom",String(bottom/metadata.height));
        paint.style.setProperty("--portrait-baseline","var(--battle-portrait-baseline, "+String(contract.baseline*100)+"%)");
        card.dataset.portraitSizeClass=sizeClass;
    }else{
        if(paint)for(const property of ["--portrait-width","--portrait-aspect","--portrait-center","--portrait-bottom","--portrait-baseline"]){paint.style.removeProperty(property);}
        if(!record)delete card.dataset.portraitSizeClass;
    }
    if(record){
        card.dataset.monsterPortraitKey=record.portraitKey;
        card.dataset.portraitFallback=record.fallbackReason||"none";
    }
    card.style.setProperty("background-image","none","important");
    prepareUnitHud(card,kind);
    syncUnitMotion(card);
}
/* Character motion has one presentation state owner. Existing Core classes
   remain the action clock; V143 alone supplies cast/hit timing. No frame loop,
   geometry writer, gameplay lock or additional action timer belongs here. */
function syncUnitMotion(card){
    const art=card?.querySelector(":scope > .v174-battle-art");
    if(!art)return;
    const side=String(card.id).startsWith("battleMonster")?"monster":"player";
    const index=Number(String(card.id).replace(/\D/g,""));
    let entity=null;
    try{entity=side==="monster"?monsters[index]:getPartyCharacterByIndex(index);}catch(_){}
    const previousEntity=art.v174MotionEntity;
    art.v174MotionEntity=entity;
    if(previousEntity!==undefined&&previousEntity!==entity){
        card.classList.remove("attacker-lunge-up","attacker-lunge-down","dodge-back");
        if(art.v174Cast)endCharacterCast(card,art.v174Cast);
    }
    // Formal HP/alive wins over a delayed historical dying/dead CSS class.
    const defeated=entity?(Number(entity.hp)<=0||entity.alive===false):
        ["dying","dead","down","v146-defeated"].some(name=>card.classList.contains(name));
    if(defeated&&art.v174Cast){endCharacterCast(card,art.v174Cast);}
    art.dataset.motion=defeated?"dying":art.v174FireDodge||card.classList.contains("dodge-back")?"dodging":
        art.v143ImpactRecoil?"hit":art.v174Cast?"casting":
        card.classList.contains("attacker-lunge-up")||card.classList.contains("attacker-lunge-down")?"attacking":"idle";
}
function endCharacterCast(card,motion){
    const art=card?.querySelector(":scope > .v174-battle-art");
    if(!art||!motion||art.v174Cast!==motion)return;
    art.v174Cast=null;
    fireFieldShakes.forEach(animation=>animation.cancel());fireFieldShakes.clear();
    motion.fireAura?.animation?.cancel();
    motion.fireAura?.node?.remove();
    motion.cancel();
    syncUnitMotion(card);
}
function startCharacterCast(card,config,duration){
    const art=card?.querySelector(":scope > .v174-battle-art");
    const action=art?.querySelector(":scope > .v174-action-motion");
    const fireSample=config.id==="explosiveFlurry";
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if(!art||!action||typeof action.animate!=="function"||config.id==="normal"||config.category==="physical"&&!fireSample||
       art.dataset.motion==="dying"||reduced&&!fireSample)return null;
    if(art.v174Cast)endCharacterCast(card,art.v174Cast);
    // The same declaration previously requested a generic lunge. Cast replaces
    // that presentation only; Core's 450ms removal and skill duration stay put.
    card.classList.remove("attacker-lunge-up","attacker-lunge-down");
    const direction=String(card.id).startsWith("battleMonster")?1:-1;
    const motion=reduced?{cancel(){}}:action.animate(fireSample?[
        {transform:"translateY(0) scale(1)",offset:0},
        {transform:"translateY("+(-direction*4)+"px) scale(.98)",offset:.18},
        {transform:"translateY("+(direction*26)+"px) scale(1.045)",offset:.38},
        {transform:"translateY("+(direction*10)+"px) scale(1.015)",offset:.68},
        {transform:"translateY(0) scale(1)",offset:1}
    ]:[
        {transform:"translateY(0) scale(1)"},
        {transform:"translateY(-2px) scale(1.012)",offset:.45},
        {transform:"translateY(0) scale(1)"}
    ],{duration:fireSample?450:Math.max(150,Math.min(350,Number(duration)*.25)),easing:"ease-in-out"});
    if(fireSample){
        const node=document.createElement("div");node.className="v174-fire-cast-ring";
        node.setAttribute("aria-hidden","true");
        node.style.setProperty("--fire-cast-duration",Math.max(1,Number(duration))+"ms");
        if(!reduced)for(let i=0;i<6;i++){
            const ember=document.createElement("i");ember.className="v174-fire-cast-ember";
            ember.style.setProperty("--ember-phase",String(i/6));node.appendChild(ember);
        }
        art.insertBefore(node,art.firstChild);
        const animation=reduced?null:node.animate([
            {opacity:0,transform:"translate(-50%,-50%) scale(.65)"},
            {opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.1},
            {opacity:1,transform:"translate(-50%,-50%) scale(1.04)",offset:.75},
            {opacity:0,transform:"translate(-50%,-50%) scale(1.1)"}
        ],{duration:duration,easing:"ease-out",fill:"both"});
        motion.fireAura={node,animation};
    }
    art.v174Cast=motion;
    motion.onfinish=()=>{if(art.v174Cast===motion&&!fireSample){art.v174Cast=null;syncUnitMotion(card);}};
    syncUnitMotion(card);
    return motion;
}
let lastFireShakeSequence=null;
const fireFieldShakes=new Map();
function fireDodge(card){
    const art=card?.querySelector(":scope > .v174-battle-art"),action=art?.querySelector(":scope > .v174-action-motion");
    if(!action||art.dataset.motion==="dying"||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    card.classList.remove("dodge-back");
    art.v143ImpactRecoil?.cancel();
    const direction=String(card.id).startsWith("battleMonster")?-1:1;
    const animation=action.animate([{translate:"0px 0px"},{translate:"0px "+direction*24+"px",offset:.35},{translate:"0px "+direction*18+"px",offset:.6},{translate:"0px 0px"}],{duration:300,easing:"ease-out"});
    art.v143ImpactRecoil=animation;art.v174FireDodge=true;syncUnitMotion(card);
    animation.onfinish=()=>{if(art.v143ImpactRecoil===animation){art.v143ImpactRecoil=null;art.v174FireDodge=false;syncUnitMotion(card);}};
}
function fireCriticalShake(sequence){
    if(lastFireShakeSequence===sequence||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    lastFireShakeSequence=sequence;
    // Only artwork paints shake; slots, HUD, controls, targets never move.
    document.querySelectorAll("#battlePage .v174-portrait-paint").forEach(paint=>{
        fireFieldShakes.get(paint)?.cancel();
        const animation=paint.animate([{translate:"0px 0px"},{translate:"-3px 1px",offset:.2},{translate:"3px -1px",offset:.4},{translate:"-1px 0px",offset:.65},{translate:"0px 0px"}],{duration:160,easing:"ease-out"});
        fireFieldShakes.set(paint,animation);
        animation.onfinish=()=>{if(fireFieldShakes.get(paint)===animation)fireFieldShakes.delete(paint);};
    });
}
function clearCharacterMotions(){
    fireFieldShakes.forEach(animation=>animation.cancel());fireFieldShakes.clear();lastFireShakeSequence=null;
    document.querySelectorAll("#battlePage .v174-cardless-unit").forEach(card=>{
        const art=card.querySelector(":scope > .v174-battle-art");
        if(art?.v174FireDodge){art.v143ImpactRecoil?.cancel();art.v143ImpactRecoil=null;art.v174FireDodge=false;}
        if(!art)return;
        if(art.v174Cast)endCharacterCast(card,art.v174Cast);
        card.classList.remove("attacker-lunge-up","attacker-lunge-down","dodge-back");
        art.dataset.motion="stopped";
    });
}
/* One real HUD per unit. Nodes keep their IDs and settlement writers; only
   this presentation owner mounts them above document-level battle VFX. */
const HUD_SELECTOR=":scope > .monster-status-badges,:scope > .monster-hp,:scope > .monster-sp,:scope > .hp-bar,:scope > .sp-bar,:scope > .battle-monster-name,:scope > .battle-player-id";
let hudLayer=null;
function unitHud(card){ return card&&card.v174UnitHud||card; }
function syncIdentity(card,side,entity){
    if(!card)return;
    if(!entity){
        const index=Number(String(card.id).replace(side==="monster"?"battleMonster":"battlePlayerCard",""));
        try{entity=side==="monster"?monsters[index]:getPartyCharacterByIndex(index);}catch(_){}
    }
    if(!entity)return;
    const identity=unitHud(card).querySelector(side==="monster"?".battle-monster-name":".battle-player-id");
    if(!identity)return;
    let emblem=identity.querySelector(".battle-identity-element");
    if(!emblem){
        identity.replaceChildren();
        emblem=document.createElement("span");emblem.className="battle-identity-element";
        const copy=document.createElement("span");copy.className="battle-identity-copy";
        const name=document.createElement("span");name.className="battle-identity-name";
        const level=document.createElement("span");level.className="battle-identity-level";
        copy.append(name,level);identity.append(emblem,copy);
    }
    const element=String(entity.element||"");
    const meta=typeof elementDatabase!=="undefined"?elementDatabase[element]:null;
    if(emblem.dataset.element!==element){
        emblem.dataset.element=element;
        emblem.setAttribute("aria-label",meta?.name||"無屬性");
        if(meta){
            const glyph=document.createElement("span");
            glyph.className="elem-icon elem-icon-"+element;
            glyph.setAttribute("aria-hidden","true");
            emblem.replaceChildren(glyph);
        }else setTextIfChanged(emblem,"無");
    }
    setTextIfChanged(identity.querySelector(".battle-identity-name"),String(side==="monster"?entity.name||"":entity.id||entity.name||""));
    setTextIfChanged(identity.querySelector(".battle-identity-level"),"Lv."+numericValue(entity.level));
}
function prepareUnitHud(card,side){
    let hud=card.v174UnitHud;
    if(!hud){
        hud=document.createElement("div");
        hud.className="v174-unit-hud";
        hud.dataset.side=side;
        hud.dataset.index=String(card.id).replace(side==="monster"?"battleMonster":"battlePlayerCard","");
        hud.v174Card=card;
        card.v174UnitHud=hud;
        card.appendChild(hud);
        if(side==="monster")hud.addEventListener("click",event=>{
            const band=event.target?.closest?.('.monster-status-badges');
            if(event.defaultPrevented||!band||!hud.contains(band)||card.contains(hud)||!card.isConnected)return;
            // Detached HUDs preserve the original Core card target/detail click.
            // In-card badges bubble normally; the gesture Owner suppresses drags.
            event.stopPropagation();card.click();
        });
    }
    card.querySelectorAll(HUD_SELECTOR).forEach(node=>hud.appendChild(node));
    hud.dataset.boss=String(card.classList.contains("gameplay-boss-card"));
    if(side==="monster")hud.dataset.enemyProfile=card.closest('#battlePage')?.dataset.enemyBattlefieldProfile||"";
    if(side==="monster"){
        const badges=hud.querySelector('.monster-status-badges');
        if(badges)badges.dataset.scrollOwner="x";
    }
    hud.dataset.anchor=side==="monster"?"top":"bottom";
    syncIdentity(card,side);
    return hud;
}
function clearUnitHud(side){
    if(!hudLayer){ return; }
    Array.from(hudLayer.children).forEach(hud=>{
        if(side&&hud.dataset.side!==side){ return; }
        const card=hud.v174Card;
        if(card?.isConnected){
            card.appendChild(hud);
            for(const property of ["left","top","width","height","transform","opacity","visibility"]){ hud.style.removeProperty(property); }
        }else{ if(card){ card.v174UnitHud=null; } hud.remove(); }
    });
    if(!hudLayer.children.length){
        window.FourSymbolsGestureArbiter?.unregisterSurface?.(hudLayer);
        hudLayer.remove();hudLayer=null;
    }
}
function syncHud(){
    const page=document.getElementById("battlePage");
    if(!page||!page.classList.contains("active")||typeof battleActive!=="undefined"&&!battleActive&&!window.v143HasTerminalImpactPresentation?.()||document.body.classList.contains("v174-battle-reading-open")||
       !document.querySelector(".v143-hit-feedback-overlay,.v143-skill-stage")){ clearUnitHud(); return; }
    const geometry=window.FourSymbolsBattlefieldRenderGeometry;
    if(!geometry){ return; }
    if(hudLayer){
        Array.from(hudLayer.children).forEach(hud=>{
            if(!hud.v174Card?.isConnected){ hud.remove(); }
        });
    }
    page.querySelectorAll(".battle-monster[id^='battleMonster'],.battle-player[id^='battlePlayerCard']").forEach(card=>{
        const side=card.id.startsWith("battleMonster")?"monster":"player";
        const hud=prepareUnitHud(card,side);
        const projection=geometry.getUnitGeometry(side,Number(hud.dataset.index))?.hudSurface;
        if(!projection||!projection.rect.width||!projection.rect.height){ hud.style.visibility="hidden"; return; }
        if(!hudLayer){
            hudLayer=document.createElement("div");
            hudLayer.className="v174-battle-hud-layer";
            document.body.appendChild(hudLayer);
            window.FourSymbolsGestureArbiter?.registerSurface?.(hudLayer);
        }
        hudLayer.appendChild(hud);
        hud.style.visibility="visible";
        hud.style.left=projection.rect.left+"px";
        hud.style.top=projection.rect.top+"px";
        hud.style.width=projection.width+"px";
        hud.style.height=projection.height+"px";
        hud.style.transform="scale("+projection.scaleX+","+projection.scaleY+")";
        hud.style.opacity=card.classList.contains("dead")?.16:card.classList.contains("down")?.35:1;
    });
}
function syncResourceNumbers(){
    document.querySelectorAll("#battlePage .battle-player[id^='battlePlayerCard']").forEach(card=>{
        const index=Number(String(card.id).replace("battlePlayerCard",""));
        let character=null;
        try{if(Number.isInteger(index)&&typeof getPartyCharacterByIndex==="function")character=getPartyCharacterByIndex(index);}catch(_){}
        if(!character)return;
        const apply=()=>{
            const current=getPartyCharacterByIndex(index);
            if(current!==character){ return; }
            const hp=unitHud(card).querySelector(".hp-bar-text"),sp=unitHud(card).querySelector(".sp-bar-text");
            setTextIfChanged(hp,String(numericValue(character.hp)));
            const resource=getBattleSecondaryResource(character);
            setTextIfChanged(sp,resource.kind==="rage"?"怒氣 "+numericValue(resource.current)+"/12":String(numericValue(resource.current)));
        };
        if(typeof window!=="undefined"&&typeof window.v143SchedulePlayerStatusUiUpdate==="function"){
            window.v143SchedulePlayerStatusUiUpdate(index,apply,"labels");
        }else{ apply(); }
    });
    document.querySelectorAll("#battlePage .battle-monster[id^='battleMonster']").forEach(card=>{
        const index=Number(String(card.id).replace("battleMonster",""));
        if(Number.isInteger(index))syncEnemyResourceHud(index);
    });
}
function syncBattlePresentation(){
    removeRetiredPresentationStyles();
    document.querySelectorAll("#battlePage .battle-player").forEach(card=>syncUnitArtwork(card,"player"));
    document.querySelectorAll("#battlePage .battle-monster").forEach(card=>syncUnitArtwork(card,"monster"));
    syncResourceNumbers();
}
let activeEscapePresentation=null;
function escapeGeometry(characterIndex){
    const geometry=window.FourSymbolsBattlefieldRenderGeometry;
    if(!geometry||typeof geometry.getUnitGeometry!=="function"){ return null; }
    const unit=geometry.getUnitGeometry("player",characterIndex);
    const overlay=typeof geometry.getBattlefieldOverlayGeometry==="function"
        ?geometry.getBattlefieldOverlayGeometry()
        :null;
    return unit&&unit.unitRect?{unit:unit,overlay:overlay}:null;
}
function acquireBattlePresentationLock(owner){
    const flow=window.FourSymbolsBattleFlow;
    return flow&&typeof flow.acquirePresentationLock==="function"
        ?flow.acquirePresentationLock(owner)
        :function(){};
}
function cleanupEscapePresentation(){
    const state=activeEscapePresentation;
    activeEscapePresentation=null;
    if(!state){ return; }
    if(state.animation&&typeof state.animation.cancel==="function"){
        try{ state.animation.cancel(); }catch(_){}
    }
    if(state.card){
        state.card.classList.remove("v174-escape-presenting","v174-escape-success","v174-escape-failure");
        state.card.style.removeProperty("transform");
        state.card.style.removeProperty("opacity");
        state.card.style.removeProperty("will-change");
    }
    if(typeof state.release==="function"){ state.release(); }
}
function playEscapePresentation(characterIndex,succeeded){
    cleanupEscapePresentation();
    const index=Number(characterIndex)||0;
    const card=document.getElementById("battlePlayerCard"+index);
    const geometry=escapeGeometry(index);
    if(!card||!geometry){ return Promise.resolve(false); }
    const unitRect=geometry.unit.unitRect;
    const overlayRect=geometry.overlay&&geometry.overlay.rect;
    const surfaceBottom=overlayRect?overlayRect.bottom:Math.max(unitRect.bottom,window.innerHeight||unitRect.bottom);
    const fullDistance=Math.max(unitRect.height*2.1,surfaceBottom-unitRect.top+unitRect.height*.35);
    const halfDistance=Math.max(unitRect.height*.8,Math.min(unitRect.height*1.55,fullDistance*.42));
    const release=acquireBattlePresentationLock("escape-presentation");
    card.classList.add("v174-escape-presenting",succeeded?"v174-escape-success":"v174-escape-failure");
    card.style.setProperty("will-change","transform,opacity");
    const frames=succeeded
        ?[
            {transform:"translateY(0)",opacity:1,offset:0},
            {transform:"translateY("+Math.round(fullDistance)+"px)",opacity:.12,offset:.9},
            {transform:"translateY("+Math.round(fullDistance)+"px)",opacity:0,offset:1}
        ]
        :[
            {transform:"translateY(0)",opacity:1,offset:0},
            {transform:"translateY("+Math.round(halfDistance)+"px)",opacity:1,offset:.42},
            {transform:"translateY("+Math.round(halfDistance)+"px)",opacity:1,offset:.62},
            {transform:"translateY(0)",opacity:1,offset:1}
        ];
    const duration=succeeded?760:820;
    const animation=typeof card.animate==="function"
        ?card.animate(frames,{duration:duration,easing:succeeded?"cubic-bezier(.35,.04,.7,.3)":"cubic-bezier(.25,.7,.3,1)",fill:succeeded?"forwards":"none"})
        :null;
    const state={card:card,animation:animation,release:release,succeeded:!!succeeded};
    activeEscapePresentation=state;
    const completed=animation&&animation.finished
        ?animation.finished.catch(()=>{})
        :new Promise(resolve=>setTimeout(resolve,duration));
    return Promise.resolve(completed).then(()=>{
        if(activeEscapePresentation!==state){ return false; }
        if(!succeeded){
            cleanupEscapePresentation();
        }
        return true;
    }).catch(()=>{
        if(activeEscapePresentation===state){ cleanupEscapePresentation(); }
        return false;
    });
}

window.FourSymbolsBattlePresentation=Object.freeze({
    version:"cardless-presentation-v3",
    applyUnit:syncUnitArtwork,
    syncIdentity:syncIdentity,
    sync:syncBattlePresentation,
    syncMotion:syncUnitMotion,
    startCast:startCharacterCast,
    fireDodge:fireDodge,
    fireCriticalShake:fireCriticalShake,
    endCast:endCharacterCast,
    clearMotions:clearCharacterMotions,
    playEscape:playEscapePresentation,
    cleanupEscape:cleanupEscapePresentation,
    getUnitHud:unitHud,
    syncHud:syncHud,
    clearHud:clearUnitHud
});
window.addEventListener("resize",syncHud,{passive:true});
window.addEventListener("pagehide",()=>{ window.v143ClearImpactOverlays?.(); clearUnitHud(); clearCharacterMotions(); });
if(typeof document.addEventListener==="function")document.addEventListener("visibilitychange",()=>{
    if(document.hidden)clearCharacterMotions();else syncBattlePresentation();
});
/* V173.51: keep EXP row metadata stable after legacy list rerenders. */
function decorateExpRows(){
    if(typeof window.v173DecorateExpPoolDistributionUi==="function")window.v173DecorateExpPoolDistributionUi();
}
if(typeof renderExpDistributeList==="function"&&!renderExpDistributeList.__v17351ExpStable){
    const previousRenderExpDistributeList=renderExpDistributeList;
    const stableRender=function(){const result=previousRenderExpDistributeList.apply(this,arguments);decorateExpRows();return result;};
    stableRender.__v17351ExpStable=true;renderExpDistributeList=stableRender;window.renderExpDistributeList=stableRender;
}
function ensureExpRowsVisible(){
    const list=document.getElementById("expDistributeList");if(!list)return;
    const rows=Array.from(list.querySelectorAll(".v131-exp-row"));if(rows.length&&rows.some(row=>!row.querySelector(".v173-exp-row-meta")))decorateExpRows();
}
decorateExpRows();

function syncManagement(){
    /* VFX lifecycle belongs exclusively to the battle VFX owner. */
    document.body.classList.remove("v17351-management-open");
    document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice");});
    ensureExpRowsVisible();syncBattlePresentation();
}
window.v17351SyncManagement=syncManagement;

function adLayer(){let l=document.getElementById("v17351AdSimulator");if(l)return l;l=document.createElement("div");l.id="v17351AdSimulator";l.className="v17351-ad-simulator";l.setAttribute("aria-hidden","true");l.innerHTML='<section class="v17351-ad-panel" role="dialog" aria-modal="true"><div class="v17351-ad-badge">AD</div><h2>模擬觀看廣告</h2><p>測試模式：播放完成後才發放獎勵。</p><strong id="v17351AdCountdown">3</strong><span id="v17351AdStatus">秒後完成</span></section>';(document.getElementById("game-ui")||document.body).appendChild(l);return l;}
window.showRewardedAd=function(onSuccess,onFail){if(adRunning)return false;adRunning=true;const l=adLayer(),num=l.querySelector("#v17351AdCountdown"),status=l.querySelector("#v17351AdStatus");l.classList.add("show");l.setAttribute("aria-hidden","false");let remain=3;num.textContent="3";status.textContent="秒後完成";const timer=setInterval(()=>{remain--;if(remain>0){num.textContent=String(remain);return}clearInterval(timer);num.textContent="✓";status.textContent="觀看完成";setTimeout(()=>{l.classList.remove("show");l.setAttribute("aria-hidden","true");adRunning=false;try{if(typeof onSuccess==="function")onSuccess()}catch(err){console.error(err);if(typeof onFail==="function")onFail(err)}},280)},1000);return true;};

window.v17351AfterBattleRender=syncBattlePresentation;
syncManagement();
})();
