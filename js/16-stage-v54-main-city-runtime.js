
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V51";
    window.GAME_NATIVE_CURRENT_VERSION = "V54";
    window.GAME_NATIVE_LAST_SCOPE = "main-city-moderate-scale";

    const labels = new Set([
        "休息","商店","角色","離線經驗","任務",
        "圖鑑","成就","公告","合成","系統"
    ]);

    function apply(){
        const home = document.getElementById("homePage");
        if(!home) return;

        const walker = document.createTreeWalker(home, NodeFilter.SHOW_TEXT);
        let n;
        while(n = walker.nextNode()){
            if(!labels.has(n.nodeValue.trim())) continue;

            const el = n.parentElement;
            if(!el) continue;

            el.style.setProperty("font-size","18px","important");
            el.style.setProperty("line-height","1.05","important");
            el.style.setProperty("white-space","nowrap","important");

            const card = el.closest("button,a,[role='button'],div");
            if(card){
                card.style.setProperty("font-size","18px","important");
            }
        }

        const title = home.querySelector("h1,h2,.title,.page-title,.city-title");
        if(title){
            title.style.setProperty("font-size","28px","important");
            title.style.setProperty("white-space","nowrap","important");
        }
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",apply,{once:true});
    }else{
        apply();
    }
})();
