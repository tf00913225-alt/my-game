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

    /* ----- Shop: keep the proven flat grid, ordered HP-left / SP-right. ----- */
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

    if(typeof renderShopContent==="function"){
        const previousRenderShopContent=renderShopContent;
        renderShopContent=function(){
            return arrangeShopColumns(
                previousRenderShopContent.apply(this,arguments)
            );
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
