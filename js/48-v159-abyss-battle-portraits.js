/* V159 — retired legacy portrait timing bridge.
   Portrait rendering is now lifecycle-owned by V154 selection + V174
   presentation + Fixed Slot reconcile. This file intentionally installs no
   wrapper, timer, RAF or observer. */
(function retireV159PortraitBridge(){
    "use strict";
    if(typeof window==="undefined"){ return; }
    window.__v159AbyssBattlePortraitsRetired=true;
})();