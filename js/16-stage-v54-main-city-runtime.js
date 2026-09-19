(function(){
    "use strict";
    window.GAME_NATIVE_CONFIRMED_BASELINE = "V51";
    window.GAME_NATIVE_CURRENT_VERSION = "V54";
    window.GAME_NATIVE_LAST_SCOPE = "main-city-moderate-scale";

    const AD_FREE_MODE_CLASS="ad-free-service-info-mode";
    const AD_FREE_CONFIG_KEY="SIXIANG_AD_FREE_SERVICE_CONFIG";
    const AD_FREE_DISPLAY_POLICY=Object.freeze({mode:"manual"});
    const DEFAULT_AD_FREE_CONFIG=Object.freeze({
        supportEmail:"",
        refundPolicyUrl:"",
        termsUrl:"",
        privacyPolicyUrl:"",
        purchaseUrl:"",
        purchaseEnabled:false
    });

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

    function openAdFreeServiceInfoModal(){
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

    window.AD_FREE_SERVICE_DISPLAY_POLICY=AD_FREE_DISPLAY_POLICY;
    window.openAdFreeServiceInfoModal=openAdFreeServiceInfoModal;
    window.closeAdFreeServiceInfoModal=closeAdFreeServiceInfoModal;


    function rosterNumber(value){
        const number=Number(value);
        return Number.isFinite(number)?number:0;
    }
    function rosterEscape(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function rosterResourceText(value){
        const whole=Math.max(0,Math.floor(rosterNumber(value)));
        if(whole>=100000000){
            const compact=whole/100000000;
            return compact.toFixed(compact>=10?1:2).replace(/\.?0+$/g,"")+"億";
        }
        if(whole>=10000){ return Math.floor(whole/10000)+"萬"; }
        return whole.toLocaleString("zh-TW");
    }
    function syncRosterResource(node,value){
        if(!node){ return; }
        const whole=Math.max(0,Math.floor(rosterNumber(value)));
        const full=whole.toLocaleString("zh-TW");
        node.textContent=rosterResourceText(whole);
        node.title=full; node.setAttribute("aria-label",full);
    }
    const HOME_RELIC_SUMMARY_CATALOG=Object.freeze({
        relic_qiankun_flask:Object.freeze({name:"乾坤玉壺",triggerText:"奇數回合結束時"}),
        relic_sun_orb:Object.freeze({name:"烈陽神珠",triggerText:"偶數回合開始時"}),
        relic_xuanwu_seal:Object.freeze({name:"玄武靈印",triggerText:"每第3回合開始時"}),
        relic_soul_bell:Object.freeze({name:"鎮魂古鐘",triggerText:"每第4回合開始時"}),
        relic_tiangang_banner:Object.freeze({name:"天罡戰旗",triggerText:"我方累積受到6次敵方有效攻擊後"}),
        relic_nine_dragon_fire:Object.freeze({name:"九龍神火罩",triggerText:"敵方累積完成7次有效行動後"}),
        relic_cold_spring_jade:Object.freeze({name:"寒泉玉珮",triggerText:"任一我方角色在傷害結算後低於35%最大HP時"}),
        relic_qinglan_feather:Object.freeze({name:"青嵐羽符",triggerText:"戰鬥開始時"}),
        relic_rock_mountain_seal:Object.freeze({name:"岩岳鎮印",triggerText:"開場；另於我方累積受8次有效攻擊時"}),
        relic_returning_wheel:Object.freeze({name:"回天寶輪",triggerText:"本場第一次有我方角色將受到致命傷害時"}),
        relic_origin_talisman:Object.freeze({name:"太初聖符",triggerText:"每第4回合結束"}),
        relic_broken_army_scroll:Object.freeze({name:"破軍殘卷",triggerText:"角色攻擊／技能擊敗敵人後"}),
        relic_red_sky_war_mark:Object.freeze({name:"赤霄戰紋",triggerText:"戰鬥開始時"}),
        relic_ice_mirror_heart:Object.freeze({name:"玄冰鏡心",triggerText:"每第3回合結束"}),
        relic_wind_chasing_talisman:Object.freeze({name:"追風行符",triggerText:"每第3回合開始"}),
        relic_mountain_river_cauldron:Object.freeze({name:"山河寶鼎",triggerText:"我方累積受7次有效攻擊後"}),
        relic_burning_star_mark:Object.freeze({name:"焚星殘印",triggerText:"偶數回合結束"}),
        relic_spirit_spring_bottle:Object.freeze({name:"靈泉法瓶",triggerText:"每第3回合結束"}),
        relic_demon_suppressing_seal:Object.freeze({name:"伏魔金印",triggerText:"戰鬥開始；首次成功受到一般負面狀態"}),
        relic_all_returning_array:Object.freeze({name:"萬象歸元盤",triggerText:"每第4回合開始"})
    });

    function homeRosterPlaceholder(index){
        return '<article class="v146-home-character v146-home-character-placeholder" data-home-roster-slot="'+index+'" aria-busy="true">'+
            '<div class="v146-home-avatar" aria-hidden="true"></div>'+
            '<div class="v146-home-character-main"><div><b>隊伍資料載入中</b><span>--</span></div>'+
            '<div class="v146-home-resource hp"><i style="width:0%"></i><strong>HP --</strong></div>'+
            '<div class="v146-home-resource sp"><i style="width:0%"></i><strong>SP --</strong></div></div></article>';
    }

    function ensureHomeRosterShell(){
        const page=document.getElementById("homePage");
        const grid=page&&page.querySelector(".home-card-grid");
        if(!page||!grid){ return null; }
        let roster=document.getElementById("v146HomeRoster");
        if(!roster){
            roster=document.createElement("section");
            roster.id="v146HomeRoster";
            roster.className="v146-home-roster";
            roster.setAttribute("aria-label","冒險隊伍");
            grid.insertAdjacentElement("afterend",roster);
        }
        if(!roster.querySelector(":scope > header")){
            const header=document.createElement("header");
            header.innerHTML='<b>冒險隊伍</b><span class="v146-home-roster-count">隊伍 -- / 6</span><button type="button" class="v-fixed-formation-entry" data-feature="gameplay-core" onclick="openHomeFeature(\'formation\')">佈陣</button>';
            roster.appendChild(header);
        }
        if(!roster.querySelector(".v146-home-character")){
            for(let index=0;index<3;index++){
                roster.insertAdjacentHTML("beforeend",homeRosterPlaceholder(index));
            }
        }
        let relicSlot=roster.querySelector(".team-relic-loadout-slot");
        if(!relicSlot){
            relicSlot=document.createElement("div");
            relicSlot.className="team-relic-loadout-slot";
            relicSlot.dataset.ready="false";
            relicSlot.innerHTML='<span>隊伍秘寶</span><b>秘寶資料載入中</b><small>等待正式存檔完成解析</small><button type="button" data-feature="relic" onclick="openHomeFeature(\'relic\')" disabled>選擇</button>';
            roster.appendChild(relicSlot);
        }
        return roster;
    }

    function readHomeRelicSave(){
        try{
            const repository=window.FourSymbolsAccountSave;
            const uid=repository&&repository.getActiveUid();
            if(!repository||!uid){ return null; }
            const result=repository.readForUid(uid);
            return result&&result.status==="ready"&&result.save&&typeof result.save==="object"
                ?result.save
                :null;
        }catch(_){
            return null;
        }
    }

    function syncHomeRelicSummary(){
        const roster=ensureHomeRosterShell();
        const slot=roster&&roster.querySelector(".team-relic-loadout-slot");
        if(!slot){ return false; }
        const save=readHomeRelicSave();
        if(!save){
            slot.dataset.ready="false";
            return false;
        }
        const relicId=save.teamLoadout&&typeof save.teamLoadout==="object"
            ?String(save.teamLoadout.relicId||"")
            :"";
        const definition=relicId?HOME_RELIC_SUMMARY_CATALOG[relicId]:null;
        const owned=relicId&&save.playerRelics&&typeof save.playerRelics==="object"
            ?save.playerRelics[relicId]
            :null;
        const level=Math.max(1,Math.min(20,Math.floor(rosterNumber(owned&&owned.level)||1)));
        slot.innerHTML=definition
            ?'<span>隊伍秘寶</span><b>'+rosterEscape(definition.name)+' Lv.'+level+'</b><small>'+rosterEscape(definition.triggerText)+'</small><button type="button" data-feature="relic" onclick="openHomeFeature(\'relic\')">更換</button>'
            :'<span>隊伍秘寶</span><b>尚未裝備</b><small>每隊僅能裝備1件秘寶</small><button type="button" data-feature="relic" onclick="openHomeFeature(\'relic\')">選擇</button>';
        slot.dataset.ready="true";
        return true;
    }

    function renderHomeRoster(){
        const roster=ensureHomeRosterShell();
        if(!roster||typeof getExistingPartyIndexes!=="function"){ return false; }
        const partyIndexes=getExistingPartyIndexes().slice(0,3);
        const availableExp=typeof window.v173GetAvailableExpPool==="function"
            ?window.v173GetAvailableExpPool(Date.now())
            :(typeof sharedExp!=="undefined"?sharedExp:0);
        syncRosterResource(document.getElementById("homeHudGoldValue"),typeof gold!=="undefined"?gold:0);
        syncRosterResource(document.getElementById("homeHudExpValue"),availableExp);
        const count=roster.querySelector(".v146-home-roster-count");
        if(count){ count.textContent="隊伍 "+partyIndexes.length+" / 6"; }

        const cards=[];
        for(let slotIndex=0;slotIndex<3;slotIndex++){
            const index=partyIndexes[slotIndex];
            const character=typeof index==="number"&&typeof getPartyCharacterByIndex==="function"
                ?getPartyCharacterByIndex(index)
                :null;
            const stats=typeof index==="number"&&typeof getPartyBattleStats==="function"
                ?getPartyBattleStats(index)
                :null;
            if(!character||!stats){
                cards.push('<article class="v146-home-character v146-home-character-empty" data-home-roster-slot="'+slotIndex+'"><div class="v146-home-avatar" aria-hidden="true"></div><div class="v146-home-character-main"><div><b>隊伍空位</b><span>--</span></div><div class="v146-home-resource hp"><i style="width:0%"></i><strong>HP --</strong></div><div class="v146-home-resource sp"><i style="width:0%"></i><strong>SP --</strong></div></div></article>');
                continue;
            }
            const hp=Math.max(0,Math.min(rosterNumber(stats.maxHP),rosterNumber(character.hp)));
            const sp=Math.max(0,Math.min(rosterNumber(stats.maxSP),rosterNumber(character.sp)));
            const hpPercent=rosterNumber(stats.maxHP)>0?hp/rosterNumber(stats.maxHP)*100:0;
            const spPercent=rosterNumber(stats.maxSP)>0?sp/rosterNumber(stats.maxSP)*100:0;
            const artwork=typeof getCharacterArtworkPath==="function"?getCharacterArtworkPath(character):"";
            cards.push('<article class="v146-home-character" data-home-roster-slot="'+slotIndex+'" data-element="'+rosterEscape(character.element||"fire")+'">'+
                '<div class="v146-home-avatar"><img src="'+rosterEscape(artwork)+'" alt="'+rosterEscape(character.id||"角色")+'頭像"></div>'+
                '<div class="v146-home-character-main"><div><b>'+rosterEscape(character.id||("角色"+(index+1)))+'</b><span>Lv.'+Math.max(1,Math.floor(rosterNumber(character.level)||1))+'</span></div>'+
                '<div class="v146-home-resource hp"><i style="width:'+hpPercent+'%"></i><strong>HP '+Math.floor(hp)+' / '+Math.floor(rosterNumber(stats.maxHP))+'</strong></div>'+
                '<div class="v146-home-resource sp"><i style="width:'+spPercent+'%"></i><strong>SP '+Math.floor(sp)+' / '+Math.floor(rosterNumber(stats.maxSP))+'</strong></div></div></article>');
        }

        roster.querySelectorAll(".v146-home-character").forEach(node=>node.remove());
        const relicSlot=roster.querySelector(".team-relic-loadout-slot");
        if(relicSlot){ relicSlot.insertAdjacentHTML("beforebegin",cards.join("")); }
        else{ roster.insertAdjacentHTML("beforeend",cards.join("")); }
        roster.dataset.ready="true";
        syncHomeRelicSummary();
        return true;
    }
    window.v54RenderHomeRoster=renderHomeRoster;
    window.FourSymbolsHomeRelicSummary=Object.freeze({
        ensureShell:ensureHomeRosterShell,
        sync:syncHomeRelicSummary
    });
    document.addEventListener("four-symbols:startup-ready",function(){
        renderHomeRoster();
        syncHomeRelicSummary();
    });

    function boot(){
        apply();
        ensureAdFreeConfig();
        ensureHomeRosterShell();
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    }else{
        boot();
    }
})();
