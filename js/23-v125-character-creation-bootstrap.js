/* =====================================================
   V128 — PRE-PAINT FIXED NATIVE CREATION BOOTSTRAP
   The creation page starts inside #app for legacy HTML
   compatibility. Move it while it is still visibility:hidden,
   before js/00-main.js builds the 420px legacy wrapper.

   IMPORTANT: this bootstrap only prepares the DOM location. It must never
   decide that character creation is active, because persisted characters
   have not been restored yet at this point. The runtime showCreation()
   remains the sole owner of creation visibility / touch isolation.
===================================================== */
(function bootstrapNativeCreationPage(){
    "use strict";

    const page=document.getElementById("creationPage");
    const overlay=document.getElementById("game-overlay-layer");

    if(!page || !overlay){
        return;
    }

    if(page.parentElement!==overlay){
        overlay.appendChild(page);
    }

    page.dataset.nativePrepaint="v128-fixed-two-step";
})();
