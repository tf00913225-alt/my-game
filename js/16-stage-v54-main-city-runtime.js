
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V51";
    window.GAME_NATIVE_CURRENT_VERSION = "V54";
    window.GAME_NATIVE_LAST_SCOPE = "main-city-moderate-scale";

    function apply(){
        const home = document.getElementById("homePage");
        if(!home) return;
        home.classList.add("main-city-lobby-ready");
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",apply,{once:true});
    }else{
        apply();
    }
})();
