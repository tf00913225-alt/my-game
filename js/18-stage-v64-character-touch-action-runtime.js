
(function(){
"use strict";
function setCharacterTouchMode(active){
    /* Retired bridge: characterTabContent declares its own scroll owner. */
}
function syncCharacterTouchMode(){
    const modal=document.getElementById("homeFeatureModal");
    const tabs=document.getElementById("characterTabContent");
    const active=!!(modal && tabs && getComputedStyle(modal).display!=="none" && modal.classList.contains("show"));
    setCharacterTouchMode(active);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncCharacterTouchMode,{once:true});
else syncCharacterTouchMode();
const characterModal=document.getElementById("homeFeatureModal");
if(characterModal&&typeof MutationObserver!=="undefined"){
    const observer=new MutationObserver(syncCharacterTouchMode);
    observer.observe(characterModal,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});
}
window.syncCharacterTouchMode=syncCharacterTouchMode;
})();
