/* =====================================================
   V128 — PRE-PAINT FIXED NATIVE CREATION BOOTSTRAP
   The creation page starts inside #app for legacy HTML
   compatibility. Move it while it is still visibility:hidden,
   before js/00-main.js builds the 420px legacy wrapper.
   This prevents the legacy layer from painting and locks Chrome's
   document gestures before the main runtime is ready.
===================================================== */
(function bootstrapNativeCreationPage(){
    "use strict";

    const page=document.getElementById("creationPage");
    const overlay=document.getElementById("game-overlay-layer");
    const stage=document.getElementById("game-stage");
    const app=document.getElementById("app");

    if(!page || !overlay){
        return;
    }

    if(page.parentElement!==overlay){
        overlay.appendChild(page);
    }

    /* Keep the whole legacy app out of the paint tree while creation is
       visible. Samsung Browser must never have old city/nav tiles available
       to composite underneath the native scrolling page. */
    if(stage){
        stage.classList.add("creation-native-active");
    }

    [
        document.documentElement,
        document.body,
        document.getElementById("game-viewport"),
        stage,
        overlay
    ].forEach(function(node){
        if(node){
            node.classList.add("creation-fixed-active");
        }
    });
    if(app){
        app.inert=true;
        app.setAttribute("aria-hidden","true");
    }

    page.dataset.nativePrepaint="v128-fixed-two-step";
    overlay.removeAttribute("aria-hidden");
})();
