/* =====================================================
   V125 — PRE-PAINT NATIVE CREATION BOOTSTRAP
   The creation page starts inside #app for legacy HTML
   compatibility. Move it while it is still visibility:hidden,
   before js/00-main.js builds the 420px legacy wrapper.
   This prevents Samsung Browser from compositing one portrait
   across both the legacy and native transformed layers.
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

    page.dataset.nativePrepaint="true";
    overlay.removeAttribute("aria-hidden");
})();
