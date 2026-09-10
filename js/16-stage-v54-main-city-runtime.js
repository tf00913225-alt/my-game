(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V51";
    window.GAME_NATIVE_CURRENT_VERSION = "V54";
    window.GAME_NATIVE_LAST_SCOPE = "main-city-moderate-scale";

    const AD_FREE_MODE_CLASS="ad-free-service-info-mode";
    const AD_FREE_CONFIG_KEY="SIXIANG_AD_FREE_SERVICE_CONFIG";
    const AD_FREE_DISPLAY_POLICY=Object.freeze({mode:"every-entry"});
    const DEFAULT_AD_FREE_CONFIG=Object.freeze({
        supportEmail:"",
        refundPolicyUrl:"",
        termsUrl:"",
        privacyPolicyUrl:"",
        purchaseUrl:"",
        purchaseEnabled:false
    });
    const adFreeState={
        shownThisEntry:false,
        observer:null,
        armed:false
    };

    function apply(){
        const home = document.getElementById("homePage");
        if(!home) return;
        home.classList.add("main-city-lobby-ready");
    }

    function ensureAdFreeConfig(){
        const formalSupportEmail=String(window.FourSymbolsSupport&&window.FourSymbolsSupport.email||"").trim();
        const existing=window[AD_FREE_CONFIG_KEY]&&typeof window[AD_FREE_CONFIG_KEY]==="object"
            ? window[AD_FREE_CONFIG_KEY]
            : {};
        const config=Object.assign({},DEFAULT_AD_FREE_CONFIG,existing);
        if(formalSupportEmail){ config.supportEmail=formalSupportEmail; }
        window[AD_FREE_CONFIG_KEY]=config;
        return config;
    }

    function getModalParts(){
        const modal=document.getElementById("homeFeatureModal");
        if(!modal){ return null; }
        const box=modal.querySelector(".home-feature-modal-box");
        const title=document.getElementById("homeFeatureModalTitle");
        const body=document.getElementById("homeFeatureModalBody");
        if(!box||!title||!body){ return null; }
        return {modal,box,title,body};
    }

    function resolveConfiguredUrl(value){
        const raw=String(value||"").trim();
        if(!raw){ return ""; }
        try{
            const url=new URL(raw,window.location.href);
            return url.protocol==="https:"||url.protocol==="http:" ? url.href : "";
        }catch(_){
            return "";
        }
    }

    function configurePolicyButton(buttonId,configuredUrl,todoLabel){
        const button=document.getElementById(buttonId);
        if(!button){ return; }
        const url=resolveConfiguredUrl(configuredUrl);
        if(!url){
            button.disabled=true;
            button.title="TODO：待接正式"+todoLabel+"頁面";
            return;
        }
        button.disabled=false;
        button.title="";
        button.addEventListener("click",function(){
            window.open(url,"_blank","noopener,noreferrer");
        });
    }

    function renderAdFreeServiceBody(body){
        const config=ensureAdFreeConfig();
        const configuredEmail=String(config.supportEmail||"").trim();
        body.innerHTML=[
            '<section class="ad-free-service-panel" data-ad-free-service-info="true">',
                '<div class="ad-free-service-hero">',
                    '<div class="ad-free-service-subtitle">30 天免廣告服務</div>',
                    '<div class="ad-free-service-price" aria-label="價格 NT$99">NT$99</div>',
                    '<div class="ad-free-service-badge">單次購買・非自動續訂</div>',
                '</div>',
                '<div class="ad-free-service-copy">',
                    '<p>一次付款，提供 30 天免廣告權益。</p>',
                    '<p>本服務為單次購買，不會自動續訂。</p>',
                    '<p>購買成功後，免廣告權益將綁定玩家帳號，自付款成功起生效 30 天。</p>',
                    '<p>此服務不提供額外角色、裝備、能力、遊戲幣或其他戰力加成。</p>',
                '</div>',
                '<section class="ad-free-service-support" aria-label="客服與條款">',
                    '<div class="ad-free-service-support-row">',
                        '<span>客服 Email：</span>',
                        '<b id="adFreeSupportEmail">'+configuredEmail+'</b>',
                    '</div>',
                    '<div class="ad-free-service-policy-actions">',
                        '<button id="adFreeRefundPolicyButton" type="button">查看退款規則</button>',
                        '<button id="adFreeTermsButton" type="button">查看服務條款</button>',
                        '<button id="adFreePrivacyButton" type="button">查看隱私權政策</button>',
                    '</div>',
                    '<p class="ad-free-service-todo-note">退款規則、服務條款與隱私權政策頁面尚待設定；未設定前不會導向不存在的網址。</p>',
                '</section>',
                '<div class="ad-free-service-actions">',
                    '<button id="adFreePurchaseButton" class="ad-free-service-purchase" type="button" disabled aria-label="購買 30 天免廣告 NT$99，目前付款服務準備中">付款服務準備中</button>',
                    '<button id="adFreeAcknowledgeButton" class="ad-free-service-acknowledge" type="button">我知道了</button>',
                '</div>',
            '</section>'
        ].join("");

        const supportEmail=document.getElementById("adFreeSupportEmail");
        if(supportEmail){
            supportEmail.textContent=configuredEmail;
            supportEmail.dataset.todo="false";
        }

        configurePolicyButton("adFreeRefundPolicyButton",config.refundPolicyUrl,"退款規則");
        configurePolicyButton("adFreeTermsButton",config.termsUrl,"服務條款");
        configurePolicyButton("adFreePrivacyButton",config.privacyPolicyUrl,"隱私權政策");

        const purchaseButton=document.getElementById("adFreePurchaseButton");
        const purchaseUrl=resolveConfiguredUrl(config.purchaseUrl);
        if(purchaseButton&&config.purchaseEnabled===true&&purchaseUrl){
            purchaseButton.disabled=false;
            purchaseButton.textContent="購買 30 天免廣告 NT$99";
            purchaseButton.setAttribute("aria-label","購買 30 天免廣告 NT$99");
            purchaseButton.addEventListener("click",function(){
                window.open(purchaseUrl,"_blank","noopener,noreferrer");
            });
        }

        const acknowledgeButton=document.getElementById("adFreeAcknowledgeButton");
        if(acknowledgeButton){
            acknowledgeButton.addEventListener("click",closeAdFreeServiceInfoModal);
        }

        // TODO(ECPay): 填入正式退款規則、服務條款、隱私權政策網址。
        // TODO(ECPay): 完成綠界付款與付款結果驗證後，才可設定 purchaseEnabled=true 與 purchaseUrl。
    }

    function disconnectAdFreeObserver(){
        if(adFreeState.observer){
            adFreeState.observer.disconnect();
            adFreeState.observer=null;
        }
    }

    function openAdFreeServiceInfoModal(options){
        const manual=Boolean(options&&options.manual);
        if(!manual&&adFreeState.shownThisEntry){ return false; }
        const parts=getModalParts();
        if(!parts){ return false; }
        if(parts.modal.classList.contains("show")&&!parts.modal.classList.contains(AD_FREE_MODE_CLASS)){
            return false;
        }

        parts.title.textContent="《四象江湖傳》";
        renderAdFreeServiceBody(parts.body);
        parts.body.scrollTop=0;
        parts.modal.classList.add(AD_FREE_MODE_CLASS);
        parts.modal.setAttribute("role","dialog");
        parts.modal.setAttribute("aria-modal","true");
        parts.modal.setAttribute("aria-labelledby","homeFeatureModalTitle");
        parts.modal.classList.add("show");
        adFreeState.shownThisEntry=true;
        disconnectAdFreeObserver();
        return true;
    }

    function closeAdFreeServiceInfoModal(){
        const parts=getModalParts();
        if(!parts||!parts.modal.classList.contains(AD_FREE_MODE_CLASS)){ return false; }
        if(typeof window.closeHomeFeature==="function"){
            window.closeHomeFeature();
        }else{
            parts.modal.classList.remove("show");
        }
        parts.modal.classList.remove(AD_FREE_MODE_CLASS);
        parts.modal.removeAttribute("role");
        parts.modal.removeAttribute("aria-modal");
        parts.modal.removeAttribute("aria-labelledby");
        return true;
    }

    function isVisible(element){
        if(!element||element.hidden){ return false; }
        if(typeof window.getComputedStyle!=="function"){ return true; }
        const style=window.getComputedStyle(element);
        return style.display!=="none"&&style.visibility!=="hidden";
    }

    function shouldAutoShowAdFreeServiceInfo(){
        return AD_FREE_DISPLAY_POLICY.mode==="every-entry"&&!adFreeState.shownThisEntry;
    }

    function isHomeReadyForAdFreeDisclosure(){
        const startup=document.getElementById("startupLoader");
        const game=document.getElementById("gameInterface");
        const home=document.getElementById("homePage");
        const modal=document.getElementById("homeFeatureModal");
        if(startup&&isVisible(startup)){ return false; }
        if(!isVisible(game)){ return false; }
        if(!home||!home.classList.contains("active")){ return false; }
        if(modal&&modal.classList.contains("show")){ return false; }
        return true;
    }

    function tryAutoShowAdFreeServiceInfo(){
        if(!shouldAutoShowAdFreeServiceInfo()||!isHomeReadyForAdFreeDisclosure()){
            return false;
        }
        return openAdFreeServiceInfoModal({manual:false});
    }

    function scheduleAutoShowAdFreeServiceInfo(){
        if(!shouldAutoShowAdFreeServiceInfo()){ return; }
        if(typeof window.requestAnimationFrame==="function"){
            window.requestAnimationFrame(tryAutoShowAdFreeServiceInfo);
        }else{
            window.setTimeout(tryAutoShowAdFreeServiceInfo,0);
        }
    }

    function armAdFreeServiceInfo(){
        if(adFreeState.armed){ return; }
        adFreeState.armed=true;
        ensureAdFreeConfig();

        document.addEventListener("v173.20:startup-entered",scheduleAutoShowAdFreeServiceInfo);
        window.addEventListener("pageshow",scheduleAutoShowAdFreeServiceInfo);

        if(typeof MutationObserver==="function"){
            const observer=new MutationObserver(scheduleAutoShowAdFreeServiceInfo);
            ["startupLoader","gameInterface","homePage","homeFeatureModal"].forEach(function(id){
                const element=document.getElementById(id);
                if(element){
                    observer.observe(element,{attributes:true,attributeFilter:["class","style","hidden"]});
                }
            });
            adFreeState.observer=observer;
        }

        scheduleAutoShowAdFreeServiceInfo();
    }

    window.AD_FREE_SERVICE_DISPLAY_POLICY=AD_FREE_DISPLAY_POLICY;
    window.openAdFreeServiceInfoModal=function(){
        return openAdFreeServiceInfoModal({manual:true});
    };
    window.closeAdFreeServiceInfoModal=closeAdFreeServiceInfoModal;

    function boot(){
        apply();
        armAdFreeServiceInfo();
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{
        boot();
    }
})();
