
(function(){
    "use strict";

    function migrateMapNav(){
        const overlay = document.getElementById("game-overlay-layer");
        if(!overlay) return;

        const nav = document.getElementById("mapPageNav");
        if(!nav || nav.dataset.nativeV13 === "true") return;

        /*
         * Only migrate the map/training navigation.
         * Existing DOM, children, IDs and event listeners are preserved.
         */
        const wrapper = document.createElement("div");
        wrapper.className = "native-map-nav-layer";
        wrapper.dataset.nativeV13 = "true";

        const nativeNav = document.createElement("div");
        nativeNav.className = "native-map-nav";
        nativeNav.dataset.nativeV13 = "true";

        nav.parentNode.insertBefore(wrapper, nav);
        wrapper.appendChild(nativeNav);
        nativeNav.appendChild(nav);

        nav.style.position = "relative";
        nav.style.left = "auto";
        nav.style.right = "auto";
        nav.style.top = "auto";
        nav.style.bottom = "auto";
        nav.style.transform = "none";
        nav.style.marginLeft = "0";
        nav.style.marginRight = "0";
        nav.style.width = "100%";

        nav.dataset.nativeV13 = "true";
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", migrateMapNav, {once:true});
    }else{
        migrateMapNav();
    }

    const observer = new MutationObserver(function(){
        migrateMapNav();
    });

    observer.observe(document.body, {
        childList:true,
        subtree:true
    });

    window.migrateMapNavToNative1080 = migrateMapNav;
})();
