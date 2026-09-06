/* =====================================================
   V169 — RPG dialogs, character layout, shop and dungeon UI
===================================================== */
(function installV169RpgUi(){
    "use strict";

    if(
        typeof window==="undefined" ||
        typeof document==="undefined" ||
        window.__v169RpgUiInstalled
    ){
        return;
    }
    window.__v169RpgUiInstalled=true;

    const dialogQueue=[];
    let activeDialog=null;
    let dialogElements=null;

    function ensureDialogElements(){
        if(dialogElements&&dialogElements.layer.isConnected){
            return dialogElements;
        }

        const layer=document.createElement("div");
        layer.id="v169RpgDialogLayer";
        layer.className="v169-rpg-dialog-layer";
        layer.setAttribute("aria-hidden","true");

        const panel=document.createElement("section");
        panel.className="v169-rpg-dialog";
        panel.setAttribute("role","alertdialog");
        panel.setAttribute("aria-modal","true");
        panel.setAttribute("aria-labelledby","v169RpgDialogTitle");
        panel.setAttribute("aria-describedby","v169RpgDialogMessage");

        const crest=document.createElement("div");
        crest.className="v169-rpg-dialog-crest";
        crest.setAttribute("aria-hidden","true");
        crest.textContent="✦";

        const title=document.createElement("h2");
        title.id="v169RpgDialogTitle";

        const message=document.createElement("div");
        message.id="v169RpgDialogMessage";
        message.className="v169-rpg-dialog-message";

        const actions=document.createElement("div");
        actions.className="v169-rpg-dialog-actions";

        const cancelButton=document.createElement("button");
        cancelButton.type="button";
        cancelButton.className="v169-rpg-dialog-button secondary";

        const confirmButton=document.createElement("button");
        confirmButton.type="button";
        confirmButton.className="v169-rpg-dialog-button primary";

        actions.append(cancelButton,confirmButton);
        panel.append(crest,title,message,actions);
        layer.appendChild(panel);
        document.body.appendChild(layer);

        cancelButton.addEventListener("click",()=>settleDialog(false));
        confirmButton.addEventListener("click",()=>settleDialog(true));
        layer.addEventListener("keydown",event=>{
            if(event.key!=="Escape"||!activeDialog){ return; }
            event.preventDefault();
            settleDialog(activeDialog.kind==="alert");
        });

        dialogElements={
            layer,
            panel,
            crest,
            title,
            message,
            cancelButton,
            confirmButton
        };
        return dialogElements;
    }

    function normalizeDialogOptions(kind,options){
        const supplied=options&&typeof options==="object"?options:{};
        return {
            title:String(
                supplied.title ||
                (kind==="confirm"?"冒險確認":"冒險提示")
            ),
            confirmText:String(
                supplied.confirmText ||
                (kind==="confirm"?"確定":"知道了")
            ),
            cancelText:String(supplied.cancelText||"返回"),
            tone:supplied.danger?"danger":String(supplied.tone||"normal")
        };
    }

    function pumpDialogQueue(){
        if(activeDialog||dialogQueue.length===0){ return; }

        activeDialog=dialogQueue.shift();
        const elements=ensureDialogElements();
        const options=activeDialog.options;
        activeDialog.previousFocus=document.activeElement;

        elements.panel.dataset.kind=activeDialog.kind;
        elements.panel.dataset.tone=options.tone;
        elements.crest.textContent=options.tone==="danger"?"⚠":"✦";
        elements.title.textContent=options.title;
        elements.message.textContent=activeDialog.message;
        elements.cancelButton.textContent=options.cancelText;
        elements.confirmButton.textContent=options.confirmText;
        elements.cancelButton.hidden=activeDialog.kind!=="confirm";
        elements.confirmButton.classList.toggle("danger",options.tone==="danger");

        elements.layer.classList.add("show");
        elements.layer.setAttribute("aria-hidden","false");
        elements.confirmButton.focus({preventScroll:true});
    }

    function settleDialog(accepted){
        if(!activeDialog){ return; }

        const completed=activeDialog;
        const elements=ensureDialogElements();
        activeDialog=null;
        elements.layer.classList.remove("show");
        elements.layer.setAttribute("aria-hidden","true");

        if(
            completed.previousFocus&&
            completed.previousFocus.isConnected&&
            typeof completed.previousFocus.focus==="function"
        ){
            completed.previousFocus.focus({preventScroll:true});
        }

        completed.resolve(!!accepted);
        Promise.resolve().then(pumpDialogQueue);
    }

    function enqueueDialog(kind,message,options){
        return new Promise(resolve=>{
            dialogQueue.push({
                kind,
                message:String(message===undefined?"":message),
                options:normalizeDialogOptions(kind,options),
                resolve,
                previousFocus:null
            });
            pumpDialogQueue();
        });
    }

    window.rpgAlert=function(message,options){
        return enqueueDialog("alert",message,options);
    };

    window.rpgConfirm=function(message,options){
        return enqueueDialog("confirm",message,options);
    };

    /* Existing alert call sites are intentionally retained as the common
       notification entry point, but they now render through the RPG queue. */
    window.alert=function(message){
        void window.rpgAlert(message);
    };

    /* A synchronous custom confirmation is impossible in the browser.
       Known confirmation paths use rpgConfirm/await; this guard prevents a
       missed legacy call from ever opening a native browser dialog. */
    window.confirm=function(message){
        void window.rpgConfirm(message);
        return false;
    };

    window.v169GetRpgDialogState=function(){
        return {
            active:activeDialog?activeDialog.kind:null,
            queued:dialogQueue.length
        };
    };

    /* ----- Shop: keep the proven potion grid and add the equipment preview page. ----- */
    function arrangeShopColumns(markup){
        if(typeof markup!=="string"||markup.indexOf("shop-potion-list")<0){
            return markup;
        }

        try{
            const template=document.createElement("template");
            template.innerHTML=markup;
            const list=template.content.querySelector(".shop-potion-list");
            if(!list){ return markup; }

            const cards=Array.from(list.querySelectorAll(":scope > .shop-potion-card"));
            const hpCards=cards.filter(card=>card.classList.contains("hp"));
            const spCards=cards.filter(card=>card.classList.contains("sp"));
            if(hpCards.length===0&&spCards.length===0){ return markup; }

            const otherCards=cards.filter(card=>
                !card.classList.contains("hp")&&
                !card.classList.contains("sp")
            );
            const orderedCards=[];
            const rowCount=Math.max(hpCards.length,spCards.length);
            for(let index=0;index<rowCount;index++){
                if(hpCards[index]){ orderedCards.push(hpCards[index]); }
                if(spCards[index]){ orderedCards.push(spCards[index]); }
            }
            orderedCards.push(...otherCards);

            list.textContent="";
            list.classList.remove("v169-shop-columns");
            orderedCards.forEach(card=>list.appendChild(card));
            return template.innerHTML;
        }catch(_){
            return markup;
        }
    }
    window.v169ArrangeShopColumns=arrangeShopColumns;

    const SHOP_REFRESH_STORAGE_KEY="v169_equipment_shop_daily";
    const SHOP_FREE_REFRESHES=5;
    const SHOP_MAX_REFRESHES=10;
    let shopPage="potion";
    const SHOP_EQUIPMENT_PREVIEW=[
        {name:"青鋒長劍",slot:"武器",glyph:"劍"},{name:"厚背砍刀",slot:"武器",glyph:"刀"},
        {name:"沉木法杖",slot:"武器",glyph:"杖"},{name:"竹骨法扇",slot:"武器",glyph:"扇"},
        {name:"烏金戰甲",slot:"衣服",glyph:"甲"},{name:"素紋法袍",slot:"衣服",glyph:"袍"},
        {name:"鐵紋護腕",slot:"護腕",glyph:"腕"},{name:"雲紗護腕",slot:"護腕",glyph:"袖"},
        {name:"玄鐵戰靴",slot:"鞋子",glyph:"靴"},{name:"行雲法履",slot:"鞋子",glyph:"履"},
        {name:"束髮戰冠",slot:"頭部",glyph:"冠"},{name:"青布法帽",slot:"頭部",glyph:"帽"},
        {name:"精鐵短劍",slot:"武器",glyph:"鋒"},{name:"斬馬闊刀",slot:"武器",glyph:"斬"},
        {name:"檀木短杖",slot:"武器",glyph:"木"},{name:"素竹羽扇",slot:"武器",glyph:"羽"},
        {name:"護心皮甲",slot:"衣服",glyph:"護"},{name:"清風道袍",slot:"衣服",glyph:"道"}
    ];

    function shopEscape(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function shopDateKey(){
        const now=new Date();
        return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
    }

    function loadEquipmentShopRefreshState(){
        const today=shopDateKey();
        let state={date:today,refreshCount:0};
        try{
            const stored=JSON.parse(localStorage.getItem(SHOP_REFRESH_STORAGE_KEY)||"{}");
            if(stored&&stored.date===today){
                state.refreshCount=Math.max(0,Math.min(SHOP_MAX_REFRESHES,Math.floor(Number(stored.refreshCount)||0)));
            }
        }catch(_){ }
        return state;
    }

    function saveEquipmentShopRefreshState(state){
        try{ localStorage.setItem(SHOP_REFRESH_STORAGE_KEY,JSON.stringify(state)); }catch(_){ }
    }

    function equipmentShopOffers(refreshCount){
        const count=Math.max(0,Math.floor(Number(refreshCount)||0));
        const start=count*5%SHOP_EQUIPMENT_PREVIEW.length;
        return Array.from({length:6},(_,offset)=>
            SHOP_EQUIPMENT_PREVIEW[(start+offset)%SHOP_EQUIPMENT_PREVIEW.length]
        );
    }

    function renderShopTabs(){
        return '<div class="v17345-shop-tabs" role="tablist" aria-label="商店分類">'+
            '<button type="button" class="'+(shopPage==="potion"?'active':'')+'" onclick="v169SwitchShopPage(\'potion\')">補品</button>'+
            '<button type="button" class="'+(shopPage==="equipment"?'active':'')+'" onclick="v169SwitchShopPage(\'equipment\')">裝備</button></div>';
    }

    function renderEquipmentShop(){
        const state=loadEquipmentShopRefreshState();
        const offers=equipmentShopOffers(state.refreshCount);
        const freeRemaining=Math.max(0,SHOP_FREE_REFRESHES-state.refreshCount);
        const paidPending=state.refreshCount>=SHOP_FREE_REFRESHES&&state.refreshCount<SHOP_MAX_REFRESHES;
        const goldText=typeof gold!=="undefined"?Math.max(0,Math.floor(Number(gold)||0)).toLocaleString("zh-TW"):"0";
        const refreshLabel=freeRemaining>0
            ?"免費刷新（剩"+freeRemaining+"次）"
            :state.refreshCount>=SHOP_MAX_REFRESHES?"今日刷新已達上限":"金幣刷新・價格待設定";
        return '<div class="v17345-equipment-shop">'+
            '<div class="v17345-equipment-wallet"><span>裝備商店</span><b>金幣 '+goldText+'</b></div>'+
            '<div class="v17345-equipment-grid">'+offers.map(item=>
                '<article class="v17345-equipment-card"><div class="v17345-equipment-icon" aria-hidden="true">'+shopEscape(item.glyph)+'</div>'+
                '<b>'+shopEscape(item.name)+'</b><span>'+shopEscape(item.slot)+'・普通裝備</span>'+
                '<button type="button" disabled>售價待設定</button></article>'
            ).join("")+'</div>'+
            '<div class="v17345-equipment-refresh"><div><b>今日刷新 '+state.refreshCount+' / '+SHOP_MAX_REFRESHES+'</b>'+
            '<span>前5次免費；第6～10次使用金幣，價格待下一步確認。</span></div>'+
            '<button type="button" '+(freeRemaining>0?'onclick="v17345RefreshEquipmentShop()"':'disabled')+'>'+refreshLabel+'</button></div>'+
            (paidPending?'<p class="v17345-equipment-pending">金幣刷新版面已保留，等確認刷新價格後再開放第6～10次。</p>':'')+
            '</div>';
    }

    function rerenderShop(){
        const body=document.getElementById("homeFeatureModalBody");
        if(body&&typeof renderShopContent==="function"){ body.innerHTML=renderShopContent(); }
    }

    window.v169SwitchShopPage=function(page){
        shopPage=page==="equipment"?"equipment":"potion";
        rerenderShop();
    };

    window.v17345RefreshEquipmentShop=function(){
        const state=loadEquipmentShopRefreshState();
        if(state.refreshCount>=SHOP_FREE_REFRESHES){ return; }
        state.refreshCount++;
        saveEquipmentShopRefreshState(state);
        rerenderShop();
    };

    if(typeof renderShopContent==="function"){
        const previousRenderShopContent=renderShopContent;
        renderShopContent=function(){
            const content=shopPage==="equipment"
                ?renderEquipmentShop()
                :arrangeShopColumns(previousRenderShopContent.apply(this,arguments));
            return '<div class="v17345-shop-shell">'+renderShopTabs()+content+'</div>';
        };
    }

    if(typeof buyShopItem==="function"){
        const previousBuyShopItem=buyShopItem;
        buyShopItem=function(itemId,requestedQuantity){
            const item=typeof getPotionDefinition==="function"
                ?getPotionDefinition(itemId)
                :null;
            const beforeCount=typeof getPotionCount==="function"
                ?Math.max(0,Number(getPotionCount(itemId))||0)
                :0;
            const beforeGold=typeof gold!=="undefined"
                ?Math.max(0,Number(gold)||0)
                :0;

            const announcePurchase=()=>{
                const afterCount=typeof getPotionCount==="function"
                    ?Math.max(0,Number(getPotionCount(itemId))||0)
                    :beforeCount;
                const afterGold=typeof gold!=="undefined"
                    ?Math.max(0,Number(gold)||0)
                    :beforeGold;
                const purchased=Math.max(0,afterCount-beforeCount);
                const spent=Math.max(0,beforeGold-afterGold);
                if(!item||purchased<=0||spent<=0){ return; }
                void window.rpgAlert(
                    "已購買「"+item.name+"」×"+purchased+"。\n花費 "+spent.toLocaleString("zh-TW")+" 金幣。",
                    {
                        title:"購買成功",
                        tone:"success",
                        confirmText:"收下物品"
                    }
                );
            };

            const result=previousBuyShopItem.apply(this,arguments);
            if(result&&typeof result.then==="function"){
                return result.then(value=>{
                    announcePurchase();
                    return value;
                });
            }
            announcePurchase();
            return result;
        };
    }

    /* V173.46 equipment progression is a first-class feature module. It is
       deliberately loaded after the shared RPG UI so it can reuse the final
       shop/dungeon/modal authorities without creating another legacy wrapper chain. */
    function loadEquipmentProgression(){
        if(document.getElementById("equipment-progression-runtime")){ return; }
        const script=document.createElement("script");
        script.id="equipment-progression-runtime";
        script.src="js/equipment-progression.js?v=173.53";
        script.async=false;
        script.onload=function(){
            if(typeof window.__v173ReportRuntimeProgress==="function"){
                window.__v173ReportRuntimeProgress("equipment-progression-runtime","裝備與商店系統");
            }
        };
        script.onerror=function(){
            if(typeof window.__v17347RuntimeGateFail==="function"){
                window.__v17347RuntimeGateFail("裝備與商店系統載入失敗，請重新整理。");
            }
        };
        document.head.appendChild(script);
    }
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",loadEquipmentProgression,{once:true});
    }else{
        loadEquipmentProgression();
    }

    /* ----- Dungeon backpack: reuse the one inventory DOM above the map. ----- */
    if(typeof openMapInventoryOverlay==="function"){
        const previousOpenMapInventoryOverlay=openMapInventoryOverlay;
        openMapInventoryOverlay=function(){
            const dungeonPage=document.getElementById("dungeonPage");
            const mapPage=document.getElementById("mapPage");
            const inventoryPage=document.getElementById("inventoryPage");
            const fromDungeon=!!(
                dungeonPage&&
                dungeonPage.classList.contains("active")
            );

            if(!fromDungeon){
                if(inventoryPage){
                    inventoryPage.classList.remove("v169-dungeon-inventory-overlay");
                }
                return previousOpenMapInventoryOverlay.apply(this,arguments);
            }

            if(typeof battleActive!=="undefined"&&battleActive){ return; }
            const mapWasActive=!!(
                mapPage&&
                mapPage.classList.contains("active")
            );
            if(mapPage&&!mapWasActive){ mapPage.classList.add("active"); }

            let result;
            try{
                result=previousOpenMapInventoryOverlay.apply(this,arguments);
            }finally{
                if(mapPage&&!mapWasActive){ mapPage.classList.remove("active"); }
            }

            if(
                inventoryPage&&
                inventoryPage.classList.contains("map-inventory-overlay-open")
            ){
                inventoryPage.classList.add("v169-dungeon-inventory-overlay");
            }
            return result;
        };
    }

    if(typeof closeMapInventoryOverlay==="function"){
        const previousCloseMapInventoryOverlay=closeMapInventoryOverlay;
        closeMapInventoryOverlay=function(){
            const inventoryPage=document.getElementById("inventoryPage");
            if(inventoryPage){
                inventoryPage.classList.remove("v169-dungeon-inventory-overlay");
            }
            return previousCloseMapInventoryOverlay.apply(this,arguments);
        };
    }
})();