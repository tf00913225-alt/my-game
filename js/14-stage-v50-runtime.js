
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V49";
    window.GAME_NATIVE_CURRENT_VERSION = "V50";

    function fixBattleBackgroundEdge(){
        const stage = document.getElementById("game-stage");
        const battle = document.getElementById("battlePage");
        const bg = battle && battle.querySelector(".battle-bg-shared");
        if(!stage || !battle || !bg) return;

        /* Use the actual battle viewport dimensions, never Legacy 420px. */
        bg.style.setProperty("left","0","important");
        bg.style.setProperty("top","0","important");
        bg.style.setProperty("width","100%","important");
        bg.style.setProperty("height","100%","important");
        bg.style.setProperty("right","0","important");
        bg.style.setProperty("bottom","0","important");
        bg.style.setProperty("border","0","important");
        bg.style.setProperty("outline","0","important");
        bg.style.setProperty("box-shadow","none","important");

        battle.style.setProperty("overflow","hidden","important");
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", fixBattleBackgroundEdge, {once:true});
    }else{
        fixBattleBackgroundEdge();
    }
})();
