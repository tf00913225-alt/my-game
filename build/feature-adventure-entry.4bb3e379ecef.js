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

    function openAdventureMap(){
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
    window.openAdventureMap=openAdventureMap;
    window.openTaoxiExploration=async function(source){
        try{const uid=window.FourSymbolsAccountSave?.getActiveUid();const route=source==='adventure'?'adventure':'home';
            if(!uid||!document.getElementById(route+'Page')?.classList.contains('active'))return false;
            await window.FourSymbolsFeatures.ensure('adventure','taoxi-entry');
            if(window.FourSymbolsAccountSave?.getActiveUid()!==uid||!document.getElementById(route+'Page')?.classList.contains('active'))return false;
            return window.FourSymbolsTaoxi.open(source);}
        catch(error){console.error('[exploration] entry refused',error);if(typeof showMessage==='function')showMessage('探索載入失敗，請重試。');return false;}
    };

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
                '<button id="adventureHomeEntry" type="button" class="adventure-home-entry" data-feature="adventure" aria-label="出城冒險，江湖主線章節推進" onclick="openAdventureMap()">'+
                    '<strong>出城冒險　›</strong>'+
                    '<span class="adventure-home-kicker">江湖主線 · 章節推進</span>'+
                    '<span id="adventureHomeNotice" class="adventure-home-notice" hidden aria-hidden="true"></span>'+
                '</button>';
            const explore=document.createElement('button');explore.id='taoxiHomeEntry';explore.type='button';explore.className='taoxi-home-entry';explore.textContent='江湖探索';explore.addEventListener('click',()=>window.openTaoxiExploration('home'));axis.append(explore);
            home.appendChild(axis);
        }
        syncAttention();
        return axis;
    }

    function maybeResumeObjective(){
        const progress=getAdventureProgress();
        if(!progress||!progress.chapters||!window.FourSymbolsFeatures||typeof window.FourSymbolsFeatures.ensure!=="function"){ return; }
        const onboarding=Object.values(progress.chapters).some(chapter=>chapter?.onboarding?.active);
        if(progress.pendingStoryOpening||onboarding){
            window.FourSymbolsFeatures.ensure("adventure","story-resume").then(()=>{
                if(progress.pendingStoryOpening){window.FourSymbolsAdventure?.startFreshStory();}
                else{window.FourSymbolsAdventure?.open({story:true});}
            }).catch(error=>console.error("[adventure] story resume pending retry",error));
            return;
        }
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
