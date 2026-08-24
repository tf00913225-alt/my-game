
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V50";
    window.GAME_NATIVE_CURRENT_VERSION = "V93";

    /*
      Restore white outline only on combat result nodes.
      Do not touch skill-name-badge.
    */
    const combatResultSelector = [
        ".battle-damage",
        ".battle-damage-number",
        ".damage-number",
        ".damage-text",
        ".combat-damage",
        ".combat-result",
        ".combat-result-text",
        ".battle-miss",
        ".miss-text",
        ".battle-heal",
        ".heal-number",
        ".hp-change",
        ".hp-change-number"
    ].join(",");

    function applyCombatResultStroke(root){
        const base = root && root.querySelectorAll ? root : document;
        base.querySelectorAll(combatResultSelector).forEach(function(el){
            el.style.setProperty("-webkit-text-stroke","3px #ffffff","important");
            el.style.setProperty("text-stroke","3px #ffffff","important");
        });
    }

    function init(){
        applyCombatResultStroke(document);

        const stage = document.getElementById("game-stage");
        if(stage){
            new MutationObserver(function(){
                applyCombatResultStroke(stage);
            }).observe(stage, {childList:true, subtree:true});
        }
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", init, {once:true});
    }else{
        init();
    }
})();
