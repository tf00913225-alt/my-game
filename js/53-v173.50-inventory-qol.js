/* =====================================================
   V173.50 — inventory quality-of-life
   - equipment bulk sell by rarity threshold
   - batch use/open for stacked potions, chests and tickets
   - no duplicate business rules: reuse existing inventory/content authorities
===================================================== */
(function installV17350InventoryQol(){
    "use strict";

    if(typeof window==="undefined"||typeof document==="undefined"||window.__v17350InventoryQolInstalled){ return; }
    window.__v17350InventoryQolInstalled=true;

    const BULK_SELL_KEY="v17350_bulk_sell_quality";
    const EQUIPMENT_TYPES=new Set(["head","shoulder","shoes","weapon","hand","armor"]);
    const QUALITY_ORDER=["white","blue","purple","orange"];
    const QUALITY_LABEL={white:"白裝",blue:"藍裝",purple:"紫裝",orange:"橙裝"};
    const TIER_TO_QUALITY={low:"white",mid:"blue",high:"purple",perfect:"orange"};

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function clampInteger(value,min,max){
        const numeric=Math.floor(Number(value)||0);
        return Math.max(min,Math.min(max,numeric));
    }

    function ownedCountById(itemId){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return 0; }
        return inventoryItems.reduce((sum,item)=>{
            if(!item||item.id!==itemId){ return sum; }
            return sum+Math.max(1,Math.floor(Number(item.count)||1));
        },0);
    }

    function equipmentQuality(item){
        if(!item){ return null; }
        const direct=String(item.rarityKey||item.quality||"").toLowerCase();
        if(QUALITY_ORDER.includes(direct)){ return direct; }
        if(item.setId){ return "orange"; }
        const tier=String(item.tierKey||"").toLowerCase();
        if(TIER_TO_QUALITY[tier]){ return TIER_TO_QUALITY[tier]; }
        const icon=String(item.icon||"");
        for(const quality of QUALITY_ORDER){
            if(icon.includes("rarity-"+quality)){ return quality; }
        }
        return null;
    }

    function isInventoryEquipment(item){
        if(!item){ return false; }
        if(typeof isEquipmentInventoryType==="function"){
            try{ return !!isEquipmentInventoryType(item.type); }catch(_){ }
        }
        return EQUIPMENT_TYPES.has(String(item.type||""));
    }

    function readBulkSellThreshold(){
        let stored="white";
        try{ stored=localStorage.getItem(BULK_SELL_KEY)||"white"; }catch(_){ }
        return QUALITY_ORDER.includes(stored)?stored:"white";
    }

    function writeBulkSellThreshold(value){
        const quality=QUALITY_ORDER.includes(value)?value:"white";
        try{ localStorage.setItem(BULK_SELL_KEY,quality); }catch(_){ }
        return quality;
    }

    function bulkSellCandidates(threshold){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return []; }
        const maxRank=QUALITY_ORDER.indexOf(threshold);
        if(maxRank<0){ return []; }
        return inventoryItems.filter(item=>{
            if(!isInventoryEquipment(item)){ return false; }
            const quality=equipmentQuality(item);
            const rank=QUALITY_ORDER.indexOf(quality);
            /* Unknown/future rarities are deliberately excluded rather than guessed. */
            return rank>=0&&rank<=maxRank;
        });
    }

    function candidateSummary(threshold){
        const candidates=bulkSellCandidates(threshold);
        let units=0;
        let goldValue=0;
        let hasOrangeOrAbove=false;
        candidates.forEach(item=>{
            const count=Math.max(1,Math.floor(Number(item.count)||1));
            units+=count;
            goldValue+=Math.max(0,Math.floor(Number(item.price)||0))*count;
            const rank=QUALITY_ORDER.indexOf(equipmentQuality(item));
            if(rank>=QUALITY_ORDER.indexOf("orange")){ hasOrangeOrAbove=true; }
        });
        return {candidates,units,goldValue,hasOrangeOrAbove};
    }

    function refreshInventoryViews(){
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        if(typeof renderInventory==="function"){ renderInventory(); }
        else if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
    }

    function ensureBulkSellBar(){
        const gridScroll=document.getElementById("inventoryGridScroll");
        if(!gridScroll||!gridScroll.parentNode){ return; }
        let bar=document.getElementById("v17350BulkSellBar");
        if(!bar){
            bar=document.createElement("section");
            bar.id="v17350BulkSellBar";
            bar.className="v17350-bulk-sell-bar";
            bar.setAttribute("aria-label","裝備一鍵售出");
            bar.innerHTML=
                '<b>一鍵售出</b>'+
                '<select id="v17350BulkSellQuality" aria-label="售出品質上限">'+
                    '<option value="white">白裝以下</option>'+
                    '<option value="blue">藍裝以下</option>'+
                    '<option value="purple">紫裝以下</option>'+
                    '<option value="orange">橙裝以下</option>'+
                '</select>'+
                '<button id="v17350BulkSellButton" type="button" onclick="v17350BulkSellEquipment()">售出 0 件</button>'+
                '<small id="v17350BulkSellMeta">僅售出背包內未穿戴裝備</small>';
            gridScroll.parentNode.insertBefore(bar,gridScroll);
            const select=bar.querySelector("#v17350BulkSellQuality");
            if(select){
                select.value=readBulkSellThreshold();
                select.addEventListener("change",()=>{
                    writeBulkSellThreshold(select.value);
                    syncBulkSellBar();
                });
            }
        }
        syncBulkSellBar();
    }

    function syncBulkSellBar(){
        const bar=document.getElementById("v17350BulkSellBar");
        if(!bar){ return; }
        const visible=typeof inventoryFilter!=="undefined"&&inventoryFilter==="equipment";
        bar.hidden=!visible;
        if(!visible){ return; }
        const select=bar.querySelector("#v17350BulkSellQuality");
        const threshold=select&&QUALITY_ORDER.includes(select.value)?select.value:readBulkSellThreshold();
        if(select&&!select.value){ select.value=threshold; }
        const summary=candidateSummary(threshold);
        const button=bar.querySelector("#v17350BulkSellButton");
        const meta=bar.querySelector("#v17350BulkSellMeta");
        if(button){
            button.disabled=summary.units<=0;
            button.textContent="售出 "+summary.units+" 件";
            button.classList.toggle("danger",summary.hasOrangeOrAbove);
        }
        if(meta){
            meta.textContent=summary.units>0
                ?"預計獲得 "+summary.goldValue.toLocaleString("zh-TW")+" 金幣"
                :"目前沒有符合條件的裝備";
        }
    }

    window.v17350BulkSellEquipment=async function(){
        const select=document.getElementById("v17350BulkSellQuality");
        const threshold=writeBulkSellThreshold(select&&select.value||readBulkSellThreshold());
        const summary=candidateSummary(threshold);
        if(summary.units<=0){
            if(typeof window.rpgAlert==="function"){
                await window.rpgAlert("目前沒有符合「"+QUALITY_LABEL[threshold]+"以下」條件的背包裝備。",{
                    title:"一鍵售出",confirmText:"知道了"
                });
            }
            return false;
        }

        if(summary.hasOrangeOrAbove){
            const accepted=typeof window.rpgConfirm==="function"&&await window.rpgConfirm(
                "這次一鍵售出包含橙裝。\n將售出 "+summary.units+" 件裝備，獲得 "+summary.goldValue.toLocaleString("zh-TW")+" 金幣。\n橙裝售出後無法復原，確定繼續嗎？",
                {title:"高品質裝備警告",confirmText:"確認售出",cancelText:"取消",danger:true}
            );
            if(!accepted){ return false; }
        }

        const selected=new Set(summary.candidates);
        for(let index=inventoryItems.length-1;index>=0;index--){
            if(selected.has(inventoryItems[index])){ inventoryItems.splice(index,1); }
        }
        if(typeof gold!=="undefined"){ gold+=summary.goldValue; }
        if(typeof selectedInventorySlot!=="undefined"){ selectedInventorySlot=null; }
        if(typeof closeItemModal==="function"){ closeItemModal(); }
        refreshInventoryViews();
        ensureBulkSellBar();

        if(typeof window.rpgAlert==="function"){
            await window.rpgAlert(
                "已售出 "+summary.units+" 件裝備。\n獲得 "+summary.goldValue.toLocaleString("zh-TW")+" 金幣。",
                {title:"一鍵售出完成",confirmText:"知道了",tone:"success"}
            );
        }
        return true;
    };

    function getBatchDescriptor(item){
        if(!item){ return null; }
        const total=ownedCountById(item.id);
        if(total<=1){ return null; }
        if(typeof getPotionDefinition==="function"){
            const definition=getPotionDefinition(item.id);
            if(definition){ return {kind:"potion",label:"批量使用",total,definition}; }
        }
        if(item.type==="chest"&&item.id==="materialChest"&&typeof window.v132OpenMaterialChest==="function"){
            return {kind:"chest",label:"批量開啟",total};
        }
        if(item.type==="ticket"&&typeof window.useEquipmentTicket==="function"){
            return {kind:"ticket",label:"批量開啟",total};
        }
        return null;
    }

    function removeBatchActions(){
        const old=document.getElementById("v17350BatchAction");
        if(old){ old.remove(); }
    }

    function syncBatchActions(item){
        removeBatchActions();
        const descriptor=getBatchDescriptor(item);
        if(!descriptor){ return; }
        const buttons=document.querySelector("#itemModal .item-modal-buttons");
        if(!buttons||!buttons.parentNode){ return; }
        const panel=document.createElement("section");
        panel.id="v17350BatchAction";
        panel.className="v17350-batch-action";
        panel.dataset.itemId=String(item.id||"");
        panel.dataset.kind=descriptor.kind;
        panel.innerHTML=
            '<label for="v17350BatchQuantity">數量</label>'+
            '<input id="v17350BatchQuantity" type="number" inputmode="numeric" min="1" max="'+descriptor.total+'" value="'+descriptor.total+'" aria-label="批量數量">'+
            '<span class="v17350-batch-max">/ '+descriptor.total+'</span>'+
            '<button type="button" onclick="v17350RunBatchAction()">'+descriptor.label+'</button>';
        buttons.parentNode.insertBefore(panel,buttons);
        const input=panel.querySelector("#v17350BatchQuantity");
        if(input){
            const normalize=()=>{ input.value=String(clampInteger(input.value,1,descriptor.total)); };
            input.addEventListener("change",normalize);
            input.addEventListener("blur",normalize);
        }
    }

    function parseRewardLine(line,map){
        const text=String(line||"").trim();
        const match=text.match(/^(.*)×(\d+)$/);
        if(match){
            map.set(match[1],(map.get(match[1])||0)+Number(match[2]));
        }else if(text){
            map.set(text,(map.get(text)||0)+1);
        }
    }

    function formatRewardMap(map){
        return [...map.entries()].map(([name,count])=>name+"×"+count).join("、");
    }

    function batchPotion(item,requested){
        const definition=typeof getPotionDefinition==="function"?getPotionDefinition(item.id):null;
        const character=typeof getBackpackCharacter==="function"?getBackpackCharacter(inventoryCharacterIndex):null;
        const stats=typeof getPartyBattleStats==="function"?getPartyBattleStats(inventoryCharacterIndex):null;
        if(!definition||!character||!stats){ return {used:0,message:"目前無法使用這項補品。"}; }
        const resource=definition.resource;
        const maxValue=resource==="hp"?Number(stats.maxHP):Number(stats.maxSP);
        if(!(maxValue>0)){ return {used:0,message:"角色目前沒有可恢復的資源上限。"}; }
        let used=0;
        let recoveredTotal=0;
        while(used<requested){
            const current=Math.max(0,Number(character[resource])||0);
            if(current>=maxValue){ break; }
            if(typeof consumePotionFromInventory!=="function"||!consumePotionFromInventory(definition.id,1)){ break; }
            const planned=definition.recoveryPercent>=100
                ?maxValue-current
                :Math.max(1,Math.round(maxValue*Number(definition.recoveryPercent||0)/100));
            const recovered=Math.max(0,Math.min(maxValue-current,planned));
            character[resource]=Math.min(maxValue,current+recovered);
            recoveredTotal+=recovered;
            used++;
            if(recovered<=0){ break; }
        }
        return {
            used,
            message:used>0
                ?(character.id||"角色")+"使用「"+definition.name+"」×"+used+"，共恢復 "+recoveredTotal+" "+String(resource).toUpperCase()+"。"
                :(character.id||"角色")+(resource==="hp"?" HP":" SP")+"目前不需要補充。"
        };
    }

    function batchChest(item,requested){
        const rewardMap=new Map();
        const notices=[];
        const originalAlert=window.alert;
        let used=0;
        window.alert=message=>{ notices.push(String(message||"")); };
        try{
            for(let index=0;index<requested;index++){
                const opened=window.v132OpenMaterialChest();
                if(!opened){ break; }
                used++;
                opened.forEach(line=>parseRewardLine(line,rewardMap));
            }
        }finally{
            window.alert=originalAlert;
        }
        let message=used>0
            ?"已開啟「"+(item.name||"材料寶箱")+"」×"+used+"。\n獲得："+(formatRewardMap(rewardMap)||"獎勵已入背包")
            :"沒有成功開啟寶箱。";
        if(used<requested&&notices.length){ message+="\n\n"+notices[notices.length-1]; }
        return {used,message};
    }

    function batchTicket(item,requested){
        const rewardMap=new Map();
        const notices=[];
        const originalAlert=window.alert;
        let used=0;
        window.alert=message=>{ notices.push(String(message||"")); };
        try{
            for(let index=0;index<requested;index++){
                const before=ownedCountById(item.id);
                if(before<=0){ break; }
                const noticeStart=notices.length;
                window.useEquipmentTicket(item.id);
                const after=ownedCountById(item.id);
                if(after>=before){ break; }
                used++;
                const latest=notices.slice(noticeStart).join(" ");
                const match=latest.match(/獲得【([^】]+)】/);
                if(match){ rewardMap.set(match[1],(rewardMap.get(match[1])||0)+1); }
            }
        }finally{
            window.alert=originalAlert;
        }
        let message=used>0
            ?"已開啟「"+(item.name||"裝備券")+"」×"+used+"。\n獲得："+(formatRewardMap(rewardMap)||"裝備已放入背包")
            :"沒有成功開啟裝備券。";
        if(used<requested&&notices.length){
            const failure=notices[notices.length-1];
            if(!/獲得【/.test(failure)){ message+="\n\n"+failure; }
        }
        return {used,message};
    }

    window.v17350RunBatchAction=async function(){
        const panel=document.getElementById("v17350BatchAction");
        if(!panel){ return false; }
        const itemId=panel.dataset.itemId||"";
        const item=typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)
            ?inventoryItems.find(entry=>entry&&entry.id===itemId)
            :null;
        const descriptor=getBatchDescriptor(item);
        if(!item||!descriptor){ removeBatchActions(); return false; }
        const input=document.getElementById("v17350BatchQuantity");
        const requested=clampInteger(input&&input.value||descriptor.total,1,descriptor.total);
        if(input){ input.value=String(requested); }

        let result={used:0,message:"目前無法進行批量操作。"};
        if(descriptor.kind==="potion"){ result=batchPotion(item,requested); }
        else if(descriptor.kind==="chest"){ result=batchChest(item,requested); }
        else if(descriptor.kind==="ticket"){ result=batchTicket(item,requested); }

        if(result.used>0){
            if(typeof closeItemModal==="function"){ closeItemModal(); }
            refreshInventoryViews();
        }
        if(typeof window.rpgAlert==="function"){
            await window.rpgAlert(result.message,{
                title:descriptor.kind==="potion"?"批量使用完成":"批量開啟完成",
                confirmText:"知道了",
                tone:result.used>0?"success":"normal"
            });
        }
        return result.used>0;
    };

    function decorateOpenItemModal(slotIndex){
        const item=typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null;
        syncBatchActions(item);
    }

    if(typeof openItemModal==="function"){
        const previousOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=previousOpenItemModal.apply(this,arguments);
            decorateOpenItemModal(slotIndex);
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const previousOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(){
            const result=previousOpenEquippedItem.apply(this,arguments);
            removeBatchActions();
            return result;
        };
    }

    if(typeof closeItemModal==="function"){
        const previousCloseItemModal=closeItemModal;
        closeItemModal=function(){
            removeBatchActions();
            return previousCloseItemModal.apply(this,arguments);
        };
    }

    if(typeof renderInventoryItems==="function"){
        const previousRenderInventoryItems=renderInventoryItems;
        renderInventoryItems=function(){
            const result=previousRenderInventoryItems.apply(this,arguments);
            ensureBulkSellBar();
            return result;
        };
    }

    if(typeof renderInventory==="function"){
        const previousRenderInventory=renderInventory;
        renderInventory=function(){
            const result=previousRenderInventory.apply(this,arguments);
            ensureBulkSellBar();
            return result;
        };
    }

    if(typeof setInventoryFilter==="function"){
        const previousSetInventoryFilter=setInventoryFilter;
        setInventoryFilter=function(){
            const result=previousSetInventoryFilter.apply(this,arguments);
            ensureBulkSellBar();
            return result;
        };
    }

    ensureBulkSellBar();

    function loadV17351Qa(){
        if(typeof document==="undefined"||!document.head){ return; }
        if(!document.getElementById("v17351-qa-style")){
            const link=document.createElement("link");
            link.id="v17351-qa-style";
            link.rel="stylesheet";
            link.href="css/53-v173.51-qa.css?v=173.58";
            document.head.appendChild(link);
        }
        const queue=[
            ["v17351-battle-qa","js/54-v173.51-battle-qa.js?v=173.58"],
            ["v17351-inventory-qa","js/55-v173.51-inventory-qa.js?v=173.58"],
            ["v17351-shop-qa","js/56-v173.51-shop-qa.js?v=173.58"],
            ["v17351-quest-qa","js/57-v173.51-quest-qa.js?v=173.58"]
        ];
        let index=0;
        let readySent=false;
        const finish=function(){
            if(readySent){ return; }
            readySent=true;
            window.__v17351QaReady=true;
            try{ document.dispatchEvent(new CustomEvent("v17351:qa-ready",{detail:{loaded:queue.length,total:queue.length}})); }catch(_){ }
        };
        const failed=function(pair){
            if(typeof window.__v17347RuntimeGateFail==="function"){
                window.__v17347RuntimeGateFail("功能模組載入失敗："+String(pair&&pair[0]||"未知模組")+"。請重新整理。");
            }
        };
        const reportAndNext=function(pair,script){
            if(script){ script.dataset.loaded="1"; }
            if(typeof window.__v173ReportRuntimeProgress==="function"){
                window.__v173ReportRuntimeProgress(pair[0],pair[1]);
            }
            next();
        };
        const next=function(){
            if(index>=queue.length){ finish(); return; }
            const pair=queue[index++];
            const existing=document.getElementById(pair[0]);
            if(existing){
                if(existing.dataset.loaded==="1"){
                    if(typeof window.__v173ReportRuntimeProgress==="function"){
                        window.__v173ReportRuntimeProgress(pair[0],pair[1]);
                    }
                    next();
                    return;
                }
                existing.addEventListener("load",()=>reportAndNext(pair,existing),{once:true});
                existing.addEventListener("error",()=>failed(pair),{once:true});
                return;
            }
            const script=document.createElement("script");
            script.id=pair[0];
            script.src=pair[1];
            script.async=false;
            script.addEventListener("load",()=>reportAndNext(pair,script),{once:true});
            script.addEventListener("error",()=>failed(pair),{once:true});
            document.head.appendChild(script);
        };
        next();
    }
    loadV17351Qa();

})();
