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

function fivePriority(indexes){const list=(indexes||[]).filter(Number.isInteger);if(list.length!==5)return null;let rows=null;try{if(typeof window.v148GetFormationRows==="function")rows=window.v148GetFormationRows(list);else if(typeof window.v138GetFormationRows==="function")rows=window.v138GetFormationRows(list)}catch(_){}const row=Array.isArray(rows)&&Array.isArray(rows[0])&&rows[0].length===5?rows[0].slice():list.slice();return [row[2],row[1],row[3],row[0],row[4]].filter(Number.isInteger);}
if(typeof window.v148GetAutoTargetPriority==="function"){const old=window.v148GetAutoTargetPriority;window.v148GetAutoTargetPriority=function(indexes){return fivePriority(indexes)||old.apply(this,arguments)}}
window.v17351FiveEnemyAutoTargetPriority=fivePriority;

/* V174 battle presentation owner.
   Keep the proven 10-seat geometry and action/turn UI untouched. Only the
   visual shell inside each existing combat slot changes: the card frame is
   transparent, artwork gets its own presentation layer, HP/SP text shows the
   current value only, and the already-existing lunge classes animate artwork
   instead of dragging the HUD bars with the portrait. */
function ensureBattlePresentationStyles(){
    if(document.getElementById("v174-cardless-battle-style"))return;
    const style=document.createElement("style");
    style.id="v174-cardless-battle-style";
    style.textContent=`
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit,
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit{
    border:0!important;outline:0!important;box-shadow:none!important;
    background-color:transparent!important;background-image:none!important;
    isolation:isolate!important;
    transition-property:opacity!important;transition-duration:.15s!important;
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art{
    position:absolute!important;inset:0!important;z-index:1!important;
    display:block!important;pointer-events:none!important;
    background-repeat:no-repeat!important;background-color:transparent!important;
    transform-origin:50% 82%!important;will-change:transform,filter!important;
    animation:v174BattleIdle 3.4s ease-in-out infinite!important;
    filter:drop-shadow(0 7px 4px rgba(0,0,0,.52));
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.v174-battle-art{
    inset:0 0 30px!important;
    background-size:contain!important;background-position:center bottom!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.hp-bar{
    position:absolute!important;left:50%!important;bottom:13px!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.sp-bar{
    position:absolute!important;left:50%!important;bottom:0!important;
    margin:0!important;transform:translateX(-50%)!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit>.battle-player-id{
    z-index:20!important;
}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>.v174-battle-art{
    background-size:cover!important;background-position:center center!important;
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art::after{
    content:"";position:absolute;left:50%;bottom:-2px;width:66%;height:10px;
    border-radius:50%;background:rgba(0,0,0,.42);filter:blur(2px);
    transform:translateX(-50%);pointer-events:none;
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art~*{z-index:6;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .hp-bar,
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .sp-bar,
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .monster-hp,
#game-stage > #app > #game-content #battlePage .v174-cardless-unit .monster-sp{z-index:20!important;}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit>img.v162-abyss-battle-portrait-art{
    opacity:0!important;pointer-events:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit.active-turn::after{
    border:0!important;background:none!important;box-shadow:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit.ally-targetable{box-shadow:none!important;}
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit.target{
    border:0!important;box-shadow:none!important;
}
#game-stage > #app > #game-content #battlePage .battle-player.v174-cardless-unit.active-turn>.v174-battle-art,
#game-stage > #app > #game-content #battlePage .battle-monster.v174-cardless-unit.target>.v174-battle-art{
    filter:drop-shadow(0 7px 4px rgba(0,0,0,.52)) drop-shadow(0 0 7px var(--v138-element-glow,rgba(255,220,120,.7)));
}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-up{animation:none!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-down{animation:none!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-up>.v174-battle-art{animation:v174BattleLungeUp .45s ease!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit.attacker-lunge-down>.v174-battle-art{animation:v174BattleLungeDown .45s ease!important;}
#game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art.v174-hit-shake{animation:v174BattleHitShake .28s ease!important;}
@keyframes v174BattleIdle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.015)}}
@keyframes v174BattleLungeUp{0%,100%{transform:translateY(0) scale(1)}38%{transform:translateY(-13px) scale(1.035)}68%{transform:translateY(-5px) scale(1.015)}}
@keyframes v174BattleLungeDown{0%,100%{transform:translateY(0) scale(1)}38%{transform:translateY(13px) scale(1.035)}68%{transform:translateY(5px) scale(1.015)}}
@keyframes v174BattleHitShake{0%,100%{transform:translate(0,0)}18%{transform:translate(-4px,1px)}36%{transform:translate(4px,-1px)}54%{transform:translate(-3px,0)}72%{transform:translate(2px,1px)}}
@media (prefers-reduced-motion:reduce){
    #game-stage > #app > #game-content #battlePage .v174-cardless-unit>.v174-battle-art{animation:none!important;}
}
`;
    document.head.appendChild(style);
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
    ensureBattlePresentationStyles();
    document.querySelectorAll("#battlePage .battle-player").forEach(card=>syncUnitArtwork(card,"player"));
    document.querySelectorAll("#battlePage .battle-monster").forEach(card=>syncUnitArtwork(card,"monster"));
    syncResourceNumbers();
}
function shakeArtForPopup(node){
    if(!(node instanceof Element))return;
    const popups=node.matches?.(".damage-popup.hp-popup")?[node]:Array.from(node.querySelectorAll?.(".damage-popup.hp-popup")||[]);
    popups.forEach(popup=>{
        const card=popup.closest(".battle-player,.battle-monster");
        const art=card?.querySelector(":scope > .v174-battle-art");
        if(!art)return;
        art.classList.remove("v174-hit-shake");void art.offsetWidth;art.classList.add("v174-hit-shake");
        setTimeout(()=>art.classList.remove("v174-hit-shake"),300);
    });
}

/* V173.51: the EXP-row metadata is injected by V133 after the V131 list render.
   A later list rerender could replace those rows and momentarily/permanently remove
   the "目前 EXP / 升下一級需求" line. Decorate synchronously after every render
   so the requirement never disappears while the EXP pool is open. */
function decorateExpRows(){
    if(typeof window.v173DecorateExpPoolDistributionUi==="function"){
        window.v173DecorateExpPoolDistributionUi();
    }
}
if(typeof renderExpDistributeList==="function"&&!renderExpDistributeList.__v17351ExpStable){
    const previousRenderExpDistributeList=renderExpDistributeList;
    const stableRender=function(){
        const result=previousRenderExpDistributeList.apply(this,arguments);
        decorateExpRows();
        return result;
    };
    stableRender.__v17351ExpStable=true;
    renderExpDistributeList=stableRender;
    window.renderExpDistributeList=stableRender;
}
function ensureExpRowsVisible(){
    const list=document.getElementById("expDistributeList");
    if(!list)return;
    const rows=Array.from(list.querySelectorAll(".v131-exp-row"));
    if(rows.length&&rows.some(row=>!row.querySelector(".v173-exp-row-meta")))decorateExpRows();
}
decorateExpRows();

function syncManagement(){
    /*
       VFX lifecycle belongs exclusively to V142/V143. This management QA
       observer used to hide #v143-skill-stage every 300ms when its broad
       non-battle heuristic became true. During a terminal hit battleActive
       can change before the last visual finishes, which made the final skill
       name/damage appear while the actual Sprite/VFX vanished.
       Never write VFX visibility from this subsystem.
    */
    document.body.classList.remove("v17351-management-open");
    document.querySelectorAll(".v17342-element-box-use-notice").forEach(n=>{
        if(!n.classList.contains("v17351-large-use-notice"))n.classList.add("v17351-large-use-notice");
    });
    ensureExpRowsVisible();
    syncBattlePresentation();
}
window.v17351SyncManagement=syncManagement;

function adLayer(){let l=document.getElementById("v17351AdSimulator");if(l)return l;l=document.createElement("div");l.id="v17351AdSimulator";l.className="v17351-ad-simulator";l.setAttribute("aria-hidden","true");l.innerHTML='<section class="v17351-ad-panel" role="dialog" aria-modal="true"><div class="v17351-ad-badge">AD</div><h2>模擬觀看廣告</h2><p>測試模式：播放完成後才發放獎勵。</p><strong id="v17351AdCountdown">3</strong><span id="v17351AdStatus">秒後完成</span></section>';document.body.appendChild(l);return l;}
window.showRewardedAd=function(onSuccess,onFail){if(adRunning)return false;adRunning=true;const l=adLayer(),num=l.querySelector("#v17351AdCountdown"),status=l.querySelector("#v17351AdStatus");l.classList.add("show");l.setAttribute("aria-hidden","false");let remain=3;num.textContent="3";status.textContent="秒後完成";const timer=setInterval(()=>{remain--;if(remain>0){num.textContent=String(remain);return}clearInterval(timer);num.textContent="✓";status.textContent="觀看完成";setTimeout(()=>{l.classList.remove("show");l.setAttribute("aria-hidden","true");adRunning=false;try{if(typeof onSuccess==="function")onSuccess()}catch(err){console.error(err);if(typeof onFail==="function")onFail(err)}},280)},1000);return true;};

const observer=new MutationObserver(mutations=>{syncManagement();mutations.forEach(record=>record.addedNodes.forEach(shakeArtForPopup));});
observer.observe(document.body,{subtree:true,childList:true});
setInterval(syncManagement,300);
syncManagement();
})();