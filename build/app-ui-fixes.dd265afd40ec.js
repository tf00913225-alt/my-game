
/* bundled source: js/62-v174-current-ui-fixes.js */
/* =====================================================
   V174 — current UI regression repairs
   DOM-only owner for missing static navigation controls and main-city art.
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

    function ensureRelicHomeArt(){
        const glyph=document.querySelector("#homePage .team-relic-home-entry .team-relic-home-glyph");
        if(!glyph){ return; }
        let image=glyph.querySelector("img.v174-relic-home-art");
        if(!image){
            glyph.textContent="";
            image=document.createElement("img");
            image.className="v174-relic-home-art";
            image.alt="";
            image.draggable=false;
            image.decoding="async";
            glyph.appendChild(image);
        }
        if(image.getAttribute("src")!=="assets/ui/home-relic-v174.webp"){
            image.setAttribute("src","assets/ui/home-relic-v174.webp");
        }
    }

    function apply(){
        ensureGameplayHomeBack();
        ensureRelicHomeArt();
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",apply,{once:true});
    }else{
        apply();
    }
    window.addEventListener("four-symbols:feature-ready",apply,{passive:true});
})();
