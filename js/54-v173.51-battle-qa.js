"use strict";
/* V174 formal battle presentation owner.
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
    inset:-8px -8px 30px!important;
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
    inset:-5px!important;
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
    if(!node.classList.contains("damage-popup")&&!node.classList.contains("hp-popup"))return;
    const card=node.closest(".v174-cardless-unit");
    if(!card)return;
    const art=card.querySelector(":scope > .v174-battle-art");
    if(!art)return;
    art.classList.remove("v174-hit-shake");
    void art.offsetWidth;
    art.classList.add("v174-hit-shake");
    setTimeout(()=>art.classList.remove("v174-hit-shake"),320);
}
function installBattlePresentationObserver(){
    const root=document.getElementById("battlePage")||document.body;
    const observer=new MutationObserver(records=>{
        let presentationDirty=false;
        for(const record of records){
            if(record.type==="childList"){
                for(const node of record.addedNodes){
                    shakeArtForPopup(node);
                    if(node instanceof Element&&(node.matches(".battle-player,.battle-monster")||node.querySelector(".battle-player,.battle-monster")))presentationDirty=true;
                }
            }
        }
        if(presentationDirty)syncBattlePresentation();
    });
    observer.observe(root,{childList:true,subtree:true});
}
if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{syncBattlePresentation();installBattlePresentationObserver();},{once:true});
}else{
    syncBattlePresentation();installBattlePresentationObserver();
}
