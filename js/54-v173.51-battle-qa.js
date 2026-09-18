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
document.addEventListener("click",e=>{if(!inBattle())return;const b=e.target?.closest?.("button,[role=button]");if(!b)return;const s=String(b.getAttribute?.("onclick")||"");if(!/(addPoint|removePoint|confirmStatus|learnSkill|upgradeSkill)\s*\(/.test(s))return;e.preventDefault();e.stopImmediatePropagation();blocked();},true);

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
   layering and transient animation. It deliberately contains no Slot/Unit/HUD
   top/left/right/bottom/inset/width/height positioning rules. */
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
function syncUnitArtwork(card,kind){
    if(!card)return;
    card.classList.add("v174-cardless-unit");
    let art=card.querySelector(":scope > .v174-battle-art");
    if(!art){art=document.createElement("div");art.className="v174-battle-art";card.insertBefore(art,card.firstChild);}
    const source=battleArtworkSource(card,kind);
    if(source)art.style.backgroundImage=source;
    card.style.setProperty("background-image","none","important");
}
function syncResourceNumbers(){
    document.querySelectorAll("#battlePage .battle-player[id^='battlePlayerCard']").forEach(card=>{
        const index=Number(String(card.id).replace("battlePlayerCard",""));
        let character=null;
        try{if(Number.isInteger(index)&&typeof getPartyCharacterByIndex==="function")character=getPartyCharacterByIndex(index);}catch(_){}
        if(!character)return;
        const hp=card.querySelector(".hp-bar-text"),sp=card.querySelector(".sp-bar-text");
        setTextIfChanged(hp,String(numericValue(character.hp)));
        setTextIfChanged(sp,String(numericValue(character.sp)));
    });
    document.querySelectorAll("#battlePage .battle-monster[id^='battleMonster']").forEach(card=>{
        const index=Number(String(card.id).replace("battleMonster",""));
        let monster=null;
        try{if(Number.isInteger(index)&&typeof monsters!=="undefined")monster=monsters[index];}catch(_){}
        if(!monster)return;
        const hp=card.querySelector(".monster-hp .monster-bar-text"),sp=card.querySelector(".monster-sp .monster-bar-text");
        setTextIfChanged(hp,String(numericValue(monster.hp)));
        setTextIfChanged(sp,String(numericValue(monster.sp)));
    });
}
function syncBattlePresentation(){
    removeRetiredPresentationStyles();
    document.querySelectorAll("#battlePage .battle-player").forEach(card=>syncUnitArtwork(card,"player"));
    document.querySelectorAll("#battlePage .battle-monster").forEach(card=>syncUnitArtwork(card,"monster"));
    syncResourceNumbers();
}
window.FourSymbolsBattlePresentation=Object.freeze({
    version:"cardless-presentation-v2",
    applyUnit:syncUnitArtwork,
    sync:syncBattlePresentation
});
function shakeArtForPopup(node){
    if(!(node instanceof Element))return;
    const popups=node.matches?.(".damage-popup.hp-popup")?[node]:Array.from(node.querySelectorAll?.(".damage-popup.hp-popup")||[]);
    popups.forEach(popup=>{
        const owner=window.FourSymbolsBattlefieldSlots;
        const slot=popup.dataset?.slot||owner?.getSlotFromElement?.(popup)||null;
        const slotElement=slot&&owner?.getSlotElement?.(slot);
        const card=slotElement?.querySelector?.(".battle-player,.battle-monster")||popup.closest(".battle-player,.battle-monster");
        if(card?.classList?.contains("battle-monster"))return;
        const art=card?.querySelector(":scope > .v174-battle-art");
        if(!art)return;
        art.classList.remove("v174-hit-shake");void art.offsetWidth;art.classList.add("v174-hit-shake");
        setTimeout(()=>art.classList.remove("v174-hit-shake"),300);
    });
}

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

function adLayer(){let l=document.getElementById("v17351AdSimulator");if(l)return l;l=document.createElement("div");l.id="v17351AdSimulator";l.className="v17351-ad-simulator";l.setAttribute("aria-hidden","true");l.innerHTML='<section class="v17351-ad-panel" role="dialog" aria-modal="true"><div class="v17351-ad-badge">AD</div><h2>模擬觀看廣告</h2><p>測試模式：播放完成後才發放獎勵。</p><strong id="v17351AdCountdown">3</strong><span id="v17351AdStatus">秒後完成</span></section>';document.body.appendChild(l);return l;}
window.showRewardedAd=function(onSuccess,onFail){if(adRunning)return false;adRunning=true;const l=adLayer(),num=l.querySelector("#v17351AdCountdown"),status=l.querySelector("#v17351AdStatus");l.classList.add("show");l.setAttribute("aria-hidden","false");let remain=3;num.textContent="3";status.textContent="秒後完成";const timer=setInterval(()=>{remain--;if(remain>0){num.textContent=String(remain);return}clearInterval(timer);num.textContent="✓";status.textContent="觀看完成";setTimeout(()=>{l.classList.remove("show");l.setAttribute("aria-hidden","true");adRunning=false;try{if(typeof onSuccess==="function")onSuccess()}catch(err){console.error(err);if(typeof onFail==="function")onFail(err)}},280)},1000);return true;};

const observer=new MutationObserver(mutations=>{
    let needsResourceSync=false;
    mutations.forEach(record=>record.addedNodes.forEach(node=>{
        shakeArtForPopup(node);
        if(!(node instanceof Element)){ return; }
        const units=node.matches?.(".battle-player,.battle-monster")
            ?[node]:Array.from(node.querySelectorAll?.(".battle-player,.battle-monster")||[]);
        units.forEach(card=>syncUnitArtwork(card,card.classList.contains("battle-monster")?"monster":"player"));
        if(units.length){ needsResourceSync=true; }
    }));
    if(needsResourceSync){ syncResourceNumbers(); }
});
observer.observe(document.body,{subtree:true,childList:true});
syncManagement();
})();
