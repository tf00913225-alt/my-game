/* =====================================================
   V159 — deterministic Abyss battle portrait synchronization
===================================================== */
(function installV159AbyssBattlePortraits(){
    "use strict";

    if(typeof window==="undefined"||window.__v159AbyssBattlePortraitsInstalled){ return; }
    window.__v159AbyssBattlePortraitsInstalled=true;

    function syncPortraits(){
        if(typeof window.v154SyncAbyssPortraits==="function"){
            window.v154SyncAbyssPortraits();
        }
    }

    function syncAfterDomSettles(){
        syncPortraits();
        if(typeof requestAnimationFrame==="function"){
            requestAnimationFrame(syncPortraits);
        }
        if(typeof setTimeout==="function"){
            setTimeout(syncPortraits,120);
        }
    }

    if(typeof window.v132LaunchDungeonBattle==="function"){
        const previousLaunchDungeonBattle=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=function(){
            const result=previousLaunchDungeonBattle.apply(this,arguments);
            if(result){ syncAfterDomSettles(); }
            return result;
        };
    }

    if(typeof updateUI==="function"){
        const previousUpdateUI=updateUI;
        updateUI=function(){
            const result=previousUpdateUI.apply(this,arguments);
            syncPortraits();
            return result;
        };
    }

    if(typeof document!=="undefined"&&document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",syncAfterDomSettles,{once:true});
    }else{
        syncAfterDomSettles();
    }
})();
