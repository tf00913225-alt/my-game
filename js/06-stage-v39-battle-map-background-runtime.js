
(function(){
    "use strict";

    window.GAME_NATIVE_CONFIRMED_BASELINE = "V38";
    window.GAME_NATIVE_CURRENT_VERSION = "V39";

    /*
     * V39 map-background bridge.
     *
     * Priority:
     *  1) Existing current patrol/map background element's computed/current
     *     background image.
     *  2) Existing map data/background variables if exposed by the game.
     *
     * We do not replace the game's map state or battle state.
     */

    function getBattlePage(){
        return document.getElementById("battlePage");
    }

    function getPatrolMapBackground(){
        const candidates = [
            document.getElementById("patrolPage"),
            document.getElementById("mapPage"),
            document.getElementById("trainingPage"),
            document.getElementById("mapBackground"),
            document.querySelector("#game-content .map-background"),
            document.querySelector("#game-content .patrol-background"),
            document.querySelector("#game-content .training-background")
        ].filter(Boolean);

        for(const el of candidates){
            const cs = getComputedStyle(el);
            const bg = cs.backgroundImage;
            if(bg && bg !== "none"){
                return bg;
            }
            const inline = el.style.backgroundImage;
            if(inline){
                return inline;
            }
        }
        return null;
    }

    function applyCurrentMapBackground(){
        const battle = getBattlePage();
        if(!battle) return false;

        const bg = getPatrolMapBackground();
        if(!bg) return false;

        battle.style.setProperty("background-image", bg, "important");
        battle.style.setProperty("background-size", "cover", "important");
        battle.style.setProperty("background-position", "center", "important");
        battle.style.setProperty("background-repeat", "no-repeat", "important");

        return true;
    }

    /*
     * Battle may be rendered after map navigation. Observe only the
     * game-content subtree for battlePage/map-page changes and reapply
     * the current map image. This does not alter battle mechanics.
     */
    function init(){
        applyCurrentMapBackground();

        const root = document.getElementById("game-content") ||
                     document.getElementById("game-stage");
        if(!root) return;

        const observer = new MutationObserver(function(){
            if(document.getElementById("battlePage")){
                applyCurrentMapBackground();
            }
        });

        observer.observe(root, {childList:true, subtree:true});

        window.addEventListener("resize", applyCurrentMapBackground);
    }

    window.syncBattleBackgroundToCurrentMap = applyCurrentMapBackground;

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", init, {once:true});
    }else{
        init();
    }
})();
