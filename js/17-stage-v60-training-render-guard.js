
(function(){
"use strict";
window.GAME_NATIVE_CONFIRMED_BASELINE="V54";
window.GAME_NATIVE_CURRENT_VERSION="V60";
window.GAME_NATIVE_LAST_SCOPE="training-full-source-audit";

const V17344_ZONE_ART={
    desert:"assets/maps/desert-v17344.png",
    ice:"assets/maps/ice-v17344.png",
    zone4:"assets/maps/zone4-v17344.png",
    zone5:"assets/maps/zone5-v17344.png",
    zone6:"assets/maps/zone6-v17344.png",
    zone7:"assets/maps/zone7-v17344.png",
    zone8:"assets/maps/zone8-v17344.png",
    zone9:"assets/maps/zone9-v17344.png",
    zone10:"assets/maps/zone10-v17344.png"
};
try{ if(typeof zoneBackgroundImages!=="undefined"){ Object.assign(zoneBackgroundImages,V17344_ZONE_ART); } }catch(_){ }
try{ if(typeof mapZoneBackgroundImages!=="undefined"){ Object.assign(mapZoneBackgroundImages,V17344_ZONE_ART); } }catch(_){ }

function enforceTrainingRender(){
    const page=document.getElementById("trainingPage");
    if(page){
        page.querySelectorAll(".training-zone-item").forEach(function(el){
            el.style.setProperty("font-size","20px","important");
            el.style.setProperty("padding","6px 14px","important");
            el.style.setProperty("min-height","42px","important");
            el.style.setProperty("line-height","1.15","important");
            el.style.setProperty("box-sizing","border-box","important");
        });
    }

    /*
       The training zone information modal used to receive width/max-height/
       overflow inline styles here. Those declarations fought the shared UI
       sizing authority and made the whole frame the scroll owner. Geometry is
       now owned by css/20-stage-v60-training-only-safety.css; this runtime guard
       intentionally touches only the training-zone list items above.
    */
}
if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",enforceTrainingRender,{once:true});
}else{
    enforceTrainingRender();
}
})();
