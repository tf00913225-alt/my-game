
(function(){
    "use strict";

    /*
     * Convert the existing bottom navigation into a native-coordinate
     * overlay without changing its click handlers or game logic.
     *
     * We clone no buttons and do not replace existing event listeners.
     * The original nav is moved into the native overlay layer.
     */
    function migrateBottomNav(){
        const overlay = document.getElementById("game-overlay-layer");
        if(!overlay) return;

        const candidates = [
            document.getElementById("bottomNav"),
            document.getElementById("mapPageNav"),
            document.querySelector("#game-content .bottom-nav")
        ].filter(Boolean);

        candidates.forEach(function(nav){
            if(!nav || nav.dataset.nativeV11 === "true") return;

            /*
             * Only migrate nav elements that are actual game navigation.
             * Do not touch unrelated fixed controls.
             */
            const isBottomNav =
                nav.id === "bottomNav" ||
                nav.id === "mapPageNav" ||
                nav.classList.contains("bottom-nav");

            if(!isBottomNav) return;

            const wrapper = document.createElement("div");
            wrapper.className = "native-bottom-nav-layer";
            wrapper.dataset.nativeV11 = "true";

            const nativeNav = document.createElement("div");
            nativeNav.className = "native-bottom-nav";
            nativeNav.dataset.nativeV11 = "true";

            /*
             * Move the existing element, preserving its existing DOM,
             * children, IDs, and event listeners.
             */
            nav.parentNode.insertBefore(wrapper, nav);
            wrapper.appendChild(nativeNav);
            nativeNav.appendChild(nav);

            /*
             * Remove legacy viewport positioning from the moved element.
             * Its visual size is preserved by the existing child styles.
             */
            nav.style.position = "relative";
            nav.style.left = "auto";
            nav.style.right = "auto";
            nav.style.top = "auto";
            nav.style.bottom = "auto";
            nav.style.transform = "none";
            nav.style.marginLeft = "0";
            nav.style.marginRight = "0";
            nav.style.width = "100%";

            nav.dataset.nativeV11 = "true";
        });
    }

    /*
     * Run after existing initialization and after DOM changes.
     * This is migration-only; it does not alter game mechanics.
     */
    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", migrateBottomNav, {once:true});
    }else{
        migrateBottomNav();
    }

    const observer = new MutationObserver(function(){
        migrateBottomNav();
    });

    observer.observe(document.body, {
        childList:true,
        subtree:true
    });

    window.migrateBottomNavToNative1080 = migrateBottomNav;
})();
