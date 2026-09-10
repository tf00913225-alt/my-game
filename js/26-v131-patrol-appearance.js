/* Patrol appearance owner: ordinary cacheable WebP assets, loaded only with feature-patrol. */
(function installPatrolAppearance(){
    "use strict";

    const ART={
        female:{
            fire:{front:"assets/characters/patrol/patrol-female-fire-front.6cb6c8d514b1.webp",back:"assets/characters/patrol/patrol-female-fire-back.c12817139add.webp"},
            water:{front:"assets/characters/patrol/patrol-female-water-front.5269ab380524.webp",back:"assets/characters/patrol/patrol-female-water-back.67b1492aecc7.webp"},
            wind:{front:"assets/characters/patrol/patrol-female-wind-front.75dc64898d71.webp",back:"assets/characters/patrol/patrol-female-wind-back.bf0f5c5067c9.webp"},
            earth:{front:"assets/characters/patrol/patrol-female-earth-front.cc9b1898e7c0.webp",back:"assets/characters/patrol/patrol-female-earth-back.18f5c279c47f.webp"}
        },
        male:{
            fire:{front:"assets/characters/patrol/patrol-male-fire-front.e8288d5dfe71.webp",back:"assets/characters/patrol/patrol-male-fire-back.e987b7a8e45f.webp"},
            water:{front:"assets/characters/patrol/patrol-male-water-front.67d1d8aebfc8.webp",back:"assets/characters/patrol/patrol-male-water-back.db1078669837.webp"},
            wind:{front:"assets/characters/patrol/patrol-male-wind-front.ee42171e1658.webp",back:"assets/characters/patrol/patrol-male-wind-back.cb339ccc0db5.webp"},
            earth:{front:"assets/characters/patrol/patrol-male-earth-front.0677960124f5.webp",back:"assets/characters/patrol/patrol-male-earth-back.a421cb635062.webp"}
        }
    };
    const localKey=()=>{
        try{
            const repo=window.FourSymbolsAccountSave;
            return repo&&repo.getActiveUid()?repo.accountKey("patrol-character-index"):null;
        }catch(_){ return null; }
    };
    function readSelection(){
        const key=localKey();
        if(!key){ return 0; }
        const value=Number(localStorage.getItem(key));
        return Number.isInteger(value)?value:0;
    }
    let selectedIndex=readSelection();

    function indexes(){
        if(typeof getExistingPartyIndexes==="function"){
            return getExistingPartyIndexes().filter(index=>getCharacter(index));
        }
        return [0,1,2].filter(index=>getCharacter(index));
    }
    function getCharacter(index){
        if(typeof getPartyCharacterByIndex==="function"){ return getPartyCharacterByIndex(index); }
        return index===0?window.player:index===1?window.player2:window.player3;
    }
    function normalize(){
        const available=indexes();
        if(!available.length){ selectedIndex=0; return 0; }
        if(!available.includes(selectedIndex)){ selectedIndex=available[0]; }
        return selectedIndex;
    }
    function artFor(character,facing){
        const gender=character&&character.gender==="male"?"male":"female";
        const element=String(character&&(character.element||character.elementType)||"fire").toLowerCase();
        return (ART[gender][element]||ART[gender].fire)[facing];
    }
    function applyPatrolArt(facingBack){
        const image=document.getElementById("patrolCharacterImg");
        if(!image){ return; }
        const index=normalize();
        const character=getCharacter(index);
        if(!character){ return; }
        const facing=facingBack?"back":"front";
        image.classList.add("v131-patrol-q-art");
        image.style.setProperty("width","70px","important");
        image.style.setProperty("height","105px","important");
        image.src=artFor(character,facing);
        image.alt=(character.id||("角色"+(index+1)))+"巡怪形象";
        image.dataset.v131PatrolCharacter=String(index);
        image.dataset.v131Facing=facing;
    }
    window.v131ApplyPatrolArt=applyPatrolArt;

    function refreshPanel(){
        const panel=document.getElementById("v131PatrolAppearancePanel");
        if(!panel){ return; }
        normalize(); panel.replaceChildren();
        indexes().forEach(index=>{
            const character=getCharacter(index);
            const button=document.createElement("button");
            button.type="button";
            button.className="v131-patrol-choice"+(index===selectedIndex?" active":"");
            button.textContent=character.id||("角色"+(index+1));
            button.setAttribute("aria-pressed",index===selectedIndex?"true":"false");
            button.addEventListener("click",event=>{
                event.preventDefault(); event.stopPropagation(); select(index); panel.classList.remove("show");
            });
            panel.appendChild(button);
        });
    }
    function select(index){
        index=Number(index);
        if(!indexes().includes(index)){ return; }
        selectedIndex=index;
        const key=localKey();
        if(key){ localStorage.setItem(key,String(index)); }
        const image=document.getElementById("patrolCharacterImg");
        applyPatrolArt(!!(image&&image.dataset.v131Facing==="back"));
        refreshPanel();
    }
    window.v131SelectPatrolCharacter=select;

    function installSwitcher(){
        const page=document.getElementById("mapPage");
        if(!page||document.getElementById("v131PatrolAppearanceSwitchWrap")){ return; }
        const wrap=document.createElement("div"); wrap.id="v131PatrolAppearanceSwitchWrap";
        const button=document.createElement("button"); button.id="v131PatrolAppearanceSwitch"; button.type="button";
        button.setAttribute("aria-label","形象切換"); button.title="形象切換";
        const viewport=document.createElement("span"); viewport.className="v131-switch-icon-viewport";
        const icon=document.createElement("span"); icon.className="v131-switch-icon-sprite";
        icon.style.backgroundImage='url("assets/ui/patrol-appearance-switch-icon.png")';
        viewport.appendChild(icon); button.appendChild(viewport);
        const panel=document.createElement("div"); panel.id="v131PatrolAppearancePanel";
        panel.setAttribute("aria-label","選擇巡怪角色形象");
        button.addEventListener("click",event=>{ event.preventDefault(); event.stopPropagation(); refreshPanel(); panel.classList.toggle("show"); });
        wrap.addEventListener("click",event=>event.stopPropagation());
        page.addEventListener("click",()=>panel.classList.remove("show"));
        wrap.append(button,panel); page.appendChild(wrap); refreshPanel();
    }
    if(typeof resetPatrolCharacterToIdle==="function"){
        const original=resetPatrolCharacterToIdle;
        resetPatrolCharacterToIdle=function(){ const result=original.apply(this,arguments); applyPatrolArt(false); refreshPanel(); return result; };
    }
    if(typeof movePatrolCharacterRandomly==="function"){
        const original=movePatrolCharacterRandomly;
        movePatrolCharacterRandomly=function(){
            if(typeof patrolInFightAnimation!=="undefined"&&patrolInFightAnimation){ return original.apply(this,arguments); }
            const before=typeof patrolCurrentTop==="number"?patrolCurrentTop:37;
            const result=original.apply(this,arguments);
            applyPatrolArt((typeof patrolCurrentTop==="number"?patrolCurrentTop:before)<before);
            return result;
        };
    }
    function boot(){ normalize(); installSwitcher(); applyPatrolArt(false); }
    if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",boot,{once:true}); }else{ boot(); }
})();
