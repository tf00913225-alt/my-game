
/* bundled source: js/62-v174-current-ui-fixes.js */
/* =====================================================
   V174 — current UI regression repairs
   DOM-only owner for missing static navigation controls.
   No gameplay state, save data or reward logic is changed here.
===================================================== */
(function installV174CurrentUiFixes(){
    "use strict";
    if(typeof window==="undefined"||typeof document==="undefined"||window.__v174CurrentUiFixesInstalled){ return; }
    window.__v174CurrentUiFixesInstalled=true;

    function ensureGameplayHomeBack(){
        const page=document.getElementById("gameplayPage");
        const header=page&&page.querySelector(".gameplay-large-panel > .gameplay-panel-header");
        if(!header||header.querySelector(".v174-gameplay-home-back")){ return; }

        const button=document.createElement("button");
        button.type="button";
        button.className="gameplay-back-button v174-gameplay-home-back";
        button.textContent="返回";
        button.setAttribute("aria-label","返回主城");
        button.addEventListener("click",function(){
            if(typeof window.showPage==="function"){ window.showPage("home"); }
        });
        header.appendChild(button);
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",ensureGameplayHomeBack,{once:true});
    }else{
        ensureGameplayHomeBack();
    }
    window.addEventListener("four-symbols:feature-ready",ensureGameplayHomeBack,{passive:true});
})();
