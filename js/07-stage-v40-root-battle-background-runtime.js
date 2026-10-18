/* Shared battlefield background. Every mode uses battlePage; patrol scenery
   no longer controls battle presentation. No battle state is changed here. */
(function(){
    "use strict";
    const BACKGROUND="assets/battle/moonlit-sanctuary-depth-20261018.webp";
    function syncBattleBackground(){
        const battle=document.getElementById("battlePage");
        if(!battle)return false;
        let layer=battle.querySelector(":scope > .battle-bg-shared");
        if(!layer){
            layer=document.createElement("div");layer.className="battle-bg-shared";
            layer.setAttribute("aria-hidden","true");battle.insertBefore(layer,battle.firstChild);
        }
        const image='url("'+BACKGROUND+'")';
        if(layer.style.backgroundImage!==image)layer.style.backgroundImage=image;
        return true;
    }
    function init(){
        syncBattleBackground();
        const content=document.getElementById("game-content");
        if(content)new MutationObserver(syncBattleBackground).observe(content,{childList:true,subtree:true});
    }
    // Compatibility entry point only: never reads or observes patrol scenery.
    window.syncBattleBackgroundToCurrentMap=syncBattleBackground;
    window.getV40BattleVisualDiagnostics=function(){
        const layer=document.querySelector("#battlePage > .battle-bg-shared");
        return {asset:BACKGROUND,battleBackground:layer?getComputedStyle(layer).backgroundImage:null};
    };
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
