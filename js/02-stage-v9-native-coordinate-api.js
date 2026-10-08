
/* ============================================================
   V9 — NATIVE 1080×1920 COORDINATE API

   Stage-bound features use these compatibility aliases. General UI
   uses browser CSS pixels through the existing display owner.

   Existing game logic is intentionally untouched.
============================================================ */
(function installNativeGameCoordinateAPI(){
    function getOverlay(){
        return document.getElementById("game-overlay-layer");
    }

    function createNativeElement(className){
        const overlay = getOverlay();
        if(!overlay){
            return null;
        }

        const el = document.createElement("div");
        el.className = "game-native-element " + (className || "");
        overlay.appendChild(el);
        return el;
    }

    function setNativeRect(el, x, y, width, height){
        if(!el) return;

        el.style.position = "absolute";
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.width = width + "px";
        el.style.height = height + "px";
    }

    function setNativePosition(el, x, y){
        if(!el) return;

        el.style.position = "absolute";
        el.style.left = x + "px";
        el.style.top = y + "px";
    }

    window.GAME_NATIVE_WIDTH = window.FourSymbolsDisplay.dimensions.nativeWidth;
    window.GAME_NATIVE_HEIGHT = window.FourSymbolsDisplay.dimensions.nativeHeight;

    window.screenToGame = window.screenToGamePoint;
    window.gameToScreen = window.gameToScreenPoint;
    window.eventToGame = window.eventToGamePoint;
    window.createNativeGameElement = createNativeElement;
    window.setNativeGameRect = setNativeRect;
    window.setNativeGamePosition = setNativePosition;
})();
