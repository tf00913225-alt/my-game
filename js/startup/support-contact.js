/* =====================================================
   Shared customer-support contact owner
   - Available in Critical Boot before authentication.
   - Login, system settings and paid-service disclosure all read one email.
===================================================== */
(function installFourSymbolsSupportContact(global){
    "use strict";

    if(!global||global.FourSymbolsSupport){ return; }

    const EMAIL="tf00913225@gmail.com";
    const OVERLAY_ID="fourSymbolsSupportOverlay";

    function close(){
        const overlay=document.getElementById(OVERLAY_ID);
        if(!overlay){ return false; }
        overlay.hidden=true;
        overlay.setAttribute("aria-hidden","true");
        return true;
    }

    function ensureOverlay(){
        let overlay=document.getElementById(OVERLAY_ID);
        if(overlay){ return overlay; }

        overlay=document.createElement("section");
        overlay.id=OVERLAY_ID;
        overlay.className="support-contact-overlay";
        overlay.hidden=true;
        overlay.setAttribute("aria-hidden","true");
        overlay.innerHTML=[
            '<div class="support-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="supportContactTitle">',
                '<div class="support-contact-eyebrow">FOUR SYMBOLS SUPPORT</div>',
                '<h2 id="supportContactTitle">聯絡客服</h2>',
                '<p>客服信箱</p>',
                '<a class="support-contact-email" href="mailto:'+EMAIL+'">'+EMAIL+'</a>',
                '<button id="supportContactCloseButton" type="button">關閉</button>',
            '</div>'
        ].join("");

        overlay.addEventListener("click",event=>{
            if(event.target===overlay){ close(); }
        });
        overlay.querySelector("#supportContactCloseButton").addEventListener("click",close);
        document.body.appendChild(overlay);
        return overlay;
    }

    function show(){
        const overlay=ensureOverlay();
        overlay.hidden=false;
        overlay.setAttribute("aria-hidden","false");
        const closeButton=overlay.querySelector("#supportContactCloseButton");
        if(closeButton){ closeButton.focus({preventScroll:true}); }
        return EMAIL;
    }

    document.addEventListener("keydown",event=>{
        if(event.key==="Escape"){ close(); }
    });

    global.FourSymbolsSupport=Object.freeze({email:EMAIL,show,close});
})(window);
