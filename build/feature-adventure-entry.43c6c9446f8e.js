/* =====================================================
   出城冒險 V1 — app-shell entry owner
   Only owns the main-city entrance and lightweight attention state.
===================================================== */
(function installAdventureHomeEntryV1(){
    "use strict";
    if(typeof window==="undefined"||window.__adventureHomeEntryV1Installed){ return; }
    window.__adventureHomeEntryV1Installed=true;

    function getAdventureProgress(){
        try{
            return typeof player!=="undefined"&&player&&player.adventureProgress&&typeof player.adventureProgress==="object"
                ?player.adventureProgress:null;
        }catch(_){ return null; }
    }

    function hasAttention(){
        const progress=getAdventureProgress();
        if(!progress||!progress.chapters){ return false; }
        return Object.values(progress.chapters).some(chapter=>{
            if(!chapter||typeof chapter!=="object"){ return false; }
            if(chapter.chapterCompleted&&!chapter.chapterRewardClaimed){ return true; }
            const objective=chapter.objective;
            if(objective&&objective.active&&objective.ready&&!objective.turnedIn){ return true; }
            const rewards=chapter.rewardClaims||{};
            return Object.values(rewards).some(value=>value==="ready");
        });
    }

    function syncAttention(explicit){
        const dot=document.getElementById("adventureHomeNotice");
        if(!dot){ return; }
        const visible=typeof explicit==="boolean"?explicit:hasAttention();
        dot.hidden=!visible;
        dot.setAttribute("aria-hidden",visible?"false":"true");
    }

    function openAdventure(){
        if(window.FourSymbolsAdventure&&typeof window.FourSymbolsAdventure.open==="function"){
            window.FourSymbolsAdventure.open();
            return;
        }
        if(window.FourSymbolsFeatures&&typeof window.FourSymbolsFeatures.ensure==="function"){
            window.FourSymbolsFeatures.ensure("adventure","home-entry").then(()=>{
                if(window.FourSymbolsAdventure&&typeof window.FourSymbolsAdventure.open==="function"){
                    window.FourSymbolsAdventure.open();
                }
            }).catch(error=>console.error("[adventure] feature load failed",error));
        }
    }
    window.openAdventure=window.openAdventure||openAdventure;

    function ensureEntry(){
        if(typeof document==="undefined"){ return null; }
        const home=document.getElementById("homePage");
        if(!home){ return null; }
        let axis=document.getElementById("adventureHomeAxis");
        if(!axis){
            axis=document.createElement("div");
            axis.id="adventureHomeAxis";
            axis.className="adventure-home-axis";
            axis.innerHTML=
                '<span class="adventure-home-gate" aria-hidden="true"></span>'+
                '<button id="adventureHomeEntry" type="button" class="adventure-home-entry" data-feature="adventure" aria-label="出城冒險，江湖主線章節推進" onclick="openAdventure()">'+
                    '<span class="adventure-home-kicker">江湖主線 · 章節推進</span>'+
                    '<strong>出城冒險</strong>'+
                    '<span id="adventureHomeNotice" class="adventure-home-notice" hidden aria-hidden="true"></span>'+
                '</button>';
            home.appendChild(axis);
        }
        syncAttention();
        return axis;
    }

    function maybeResumeObjective(){
        const progress=getAdventureProgress();
        if(!progress||!progress.chapters||!window.FourSymbolsFeatures||typeof window.FourSymbolsFeatures.ensure!=="function"){ return; }
        const active=Object.values(progress.chapters).some(chapter=>chapter&&chapter.objective&&chapter.objective.active&&!chapter.objective.turnedIn);
        if(active){
            window.FourSymbolsFeatures.ensure("adventure","objective-resume").catch(error=>{
                console.error("[adventure] objective resume load failed",error);
            });
        }
    }

    if(typeof document!=="undefined"){
        if(document.readyState==="loading"){
            document.addEventListener("DOMContentLoaded",ensureEntry,{once:true});
        }else{ ensureEntry(); }
        document.addEventListener("four-symbols:startup-ready",()=>{
            ensureEntry();
            maybeResumeObjective();
        });
        document.addEventListener("four-symbols:adventure-state-change",event=>{
            syncAttention(event&&event.detail&&typeof event.detail.attention==="boolean"?event.detail.attention:undefined);
        });
    }
})();
