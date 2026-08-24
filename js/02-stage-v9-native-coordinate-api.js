
/* ============================================================
   V9 — NATIVE 1080×1920 COORDINATE API

   New features MUST use these helpers instead of browser
   viewport coordinates.

   Existing game logic is intentionally untouched.
============================================================ */
(function installNativeGameCoordinateAPI(){
    const GAME_W = 1080;
    const GAME_H = 1920;

    function getStage(){
        return document.getElementById("game-stage");
    }

    function getOverlay(){
        return document.getElementById("game-overlay-layer");
    }

    function screenToGame(clientX, clientY){
        const stage = getStage();
        if(!stage){
            return {x: clientX, y: clientY};
        }

        const rect = stage.getBoundingClientRect();
        const scale = window.gameStageScale || 1;

        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    }

    function gameToScreen(x, y){
        const stage = getStage();
        if(!stage){
            return {x, y};
        }

        const rect = stage.getBoundingClientRect();

        return {
            x: rect.left + x * (rect.width / GAME_W),
            y: rect.top + y * (rect.height / GAME_H)
        };
    }

    function eventToGame(event){
        const point = event.touches && event.touches.length
            ? event.touches[0]
            : event.changedTouches && event.changedTouches.length
                ? event.changedTouches[0]
                : event;

        return screenToGame(point.clientX, point.clientY);
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

    window.GAME_NATIVE_WIDTH = GAME_W;
    window.GAME_NATIVE_HEIGHT = GAME_H;

    window.screenToGame = screenToGame;
    window.gameToScreen = gameToScreen;
    window.eventToGame = eventToGame;
    window.createNativeGameElement = createNativeElement;
    window.setNativeGameRect = setNativeRect;
    window.setNativeGamePosition = setNativePosition;
})();
