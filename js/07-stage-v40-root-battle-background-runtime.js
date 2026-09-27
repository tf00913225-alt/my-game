
(function(){
    "use strict";

    window.GAME_NATIVE_CONFIRMED_BASELINE = "V39";
    window.GAME_NATIVE_CURRENT_VERSION = "V40";

    const LEGACY_WIDTH = 420;
    const NATIVE_WIDTH = 1080;
    function ensureBattleBackgroundLayer(){
        const battle = document.getElementById("battlePage");
        if(!battle) return null;

        let layer = battle.querySelector(":scope > .battle-bg-shared");
        if(!layer){
            layer = document.createElement("div");
            layer.className = "battle-bg-shared";
            layer.setAttribute("aria-hidden","true");
            battle.insertBefore(layer, battle.firstChild);
        }
        return layer;
    }

    function getActualPatrolBackground(){
        /*
         * SOURCE OF TRUTH:
         * enterMap() calls applyMapZoneBackground(currentZone),
         * which writes the current map image to #mapPageBgLayer.
         *
         * We read that exact rendered layer rather than guessing
         * from #mapPage itself.
         */
        const mapLayer = document.getElementById("mapPageBgLayer");
        if(mapLayer){
            const bg = getComputedStyle(mapLayer).backgroundImage;
            if(bg && bg !== "none"){
                return bg;
            }
            if(mapLayer.style.backgroundImage){
                return mapLayer.style.backgroundImage;
            }
        }

        /*
         * Fallback only if the map layer is not available:
         * use the game's actual map-zone table and currentZone.
         */
        try{
            if(typeof mapZoneBackgroundImages !== "undefined"){
                const url = mapZoneBackgroundImages[currentZone] ||
                            mapZoneBackgroundImages.forest;
                if(url){
                    return "url(" + url + ")";
                }
            }
        }catch(e){}

        return null;
    }

    function syncBattleBackgroundToCurrentMap(){
        const layer = ensureBattleBackgroundLayer();
        if(!layer) return false;

        const bg = getActualPatrolBackground();
        if(!bg) return false;

        layer.style.setProperty("background-image", "linear-gradient(rgba(0,0,0,.52), rgba(0,0,0,.52)), " + bg, "important");
        layer.style.setProperty("background-size", "cover", "important");
        layer.style.setProperty("background-position", "center top", "important");
        layer.style.setProperty("background-repeat", "no-repeat", "important");

        return true;
    }

    function init(){
        ensureBattleBackgroundLayer();
        syncBattleBackgroundToCurrentMap();

        /*
         * When currentZone/map background changes, #mapPageBgLayer is
         * updated by applyMapZoneBackground(). MutationObserver on the
         * style attribute guarantees battle receives the same image.
         */
        const mapLayer = document.getElementById("mapPageBgLayer");
        if(mapLayer){
            const mapObserver = new MutationObserver(
                syncBattleBackgroundToCurrentMap
            );
            mapObserver.observe(mapLayer,{attributes:true,attributeFilter:["style"]});
        }

        /*
         * Also resync when the battle page is rendered/activated.
         */
        const content = document.getElementById("game-content");
        if(content){
            const pageObserver = new MutationObserver(function(){
                if(document.getElementById("battlePage")){
                    syncBattleBackgroundToCurrentMap();
                }
            });
            pageObserver.observe(content,{childList:true,subtree:true});
        }

        window.syncBattleBackgroundToCurrentMap =
            syncBattleBackgroundToCurrentMap;
    }

    window.getV40BattleVisualDiagnostics = function(){
        const layer = document.querySelector(
            "#game-stage > #app > #game-content #battlePage > .battle-bg-shared"
        );
        return {
            currentZone:
                (typeof currentZone !== "undefined" ? currentZone : null),
            battleBackground:
                layer ? getComputedStyle(layer).backgroundImage : null
        };
    };

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",init,{once:true});
    }else{
        init();
    }
})();
