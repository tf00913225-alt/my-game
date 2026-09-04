
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
    const modal=document.getElementById("trainingZoneModal");
    if(!modal)return;
    const box=modal.querySelector(".home-feature-modal-box");
    const title=modal.querySelector(".home-feature-modal-title");
    const body=document.getElementById("trainingZoneModalBody");
    if(box){
        box.style.setProperty("width","94%","important");
        box.style.setProperty("max-width","400px","important");
        box.style.setProperty("max-height","640px","important");
        box.style.setProperty("overflow-y","auto","important");
        box.style.setProperty("padding","18px","important");
    }
    if(title)title.style.setProperty("font-size","22px","important");
    if(body){
        body.style.setProperty("font-size","16px","important");
        body.style.setProperty("line-height","1.9","important");
    }
    modal.querySelectorAll(".home-feature-buy-btn").forEach(function(btn){
        btn.style.setProperty("font-size","16px","important");
        btn.style.setProperty("min-height","46px","important");
        btn.style.setProperty("padding","10px 12px","important");
    });
}
if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",enforceTrainingRender,{once:true});
}else{
    enforceTrainingRender();
}
})();
