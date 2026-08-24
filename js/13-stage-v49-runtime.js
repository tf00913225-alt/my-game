
(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V48";
    window.GAME_NATIVE_CURRENT_VERSION = "V49";
    window.GAME_CAST_SKILL_BADGE_STROKE = "none";

    function removeSkillWhiteStroke(){
        document.querySelectorAll(".skill-name-badge").forEach(function(el){
            el.style.setProperty("-webkit-text-stroke","0","important");
            el.style.setProperty("text-stroke","0","important");
            el.style.setProperty("border","0","important");
            el.style.setProperty("outline","0","important");
        });
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", removeSkillWhiteStroke, {once:true});
    }else{
        removeSkillWhiteStroke();
    }
})();
