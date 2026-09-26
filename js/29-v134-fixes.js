/*
   V134 — battle lifecycle compatibility fix.

   The former inventory return wrapper was retired after Inventory Context
   became part of the canonical page router. This file now contains only the
   unrelated battle HUD handoff; inventory has no legacy wrapper here.
*/
(function installV134Fixes(){
    "use strict";

    if(typeof beginCharacterTurn!=="function"){ return; }
    const originalBeginCharacterTurn=beginCharacterTurn;
    beginCharacterTurn=function(token){
        const result=originalBeginCharacterTurn.apply(this,arguments);
        if(typeof updateActionHudVisibility==="function"){
            updateActionHudVisibility();
        }
        return result;
    };
})();
