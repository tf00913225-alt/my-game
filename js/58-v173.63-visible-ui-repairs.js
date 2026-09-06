/* =====================================================
   V173.63 — visible UI owner repairs
   These repairs target the actual runtime/DOM owners that kept overriding the
   V173.62 stylesheet-only changes on mobile.
===================================================== */
(function installV17363VisibleUiRepairs(){
    "use strict";

    if(typeof window==="undefined"||window.__v17363VisibleUiRepairsInstalled){ return; }
    window.__v17363VisibleUiRepairsInstalled=true;

    let queued=false;

    function setImportant(node,name,value){
        if(node&&node.style){ node.style.setProperty(name,value,"important"); }
    }

    function contentDefinitions(){
        if(typeof window.v132GetContentDefinitions!=="function"){
            return {talismans:[],ores:[],blueprints:[],tickets:[],equipmentSetItems:[]};
        }
        const content=window.v132GetContentDefinitions()||{};
        return {
            talismans:content.talismans||[],
            ores:content.ores||[],
            blueprints:content.blueprints||[],
            tickets:content.tickets||[],
            equipmentSetItems:content.equipmentSetItems||[]
        };
    }

    function allOwnedItems(){
        const result=[];
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            inventoryItems.forEach(item=>{ if(item){ result.push(item); } });
        }
        if(typeof characterEquipment!=="undefined"&&characterEquipment&&typeof characterEquipment==="object"){
            Object.values(characterEquipment).forEach(slots=>{
                Object.values(slots||{}).forEach(item=>{ if(item){ result.push(item); } });
            });
        }
        return result;
    }

    function findOwnedItem(value){
        const key=String(value||"");
        return allOwnedItems().find(item=>
            item&&(String(item.v141Uid||"")===key||String(item.id||"")===key)
        )||null;
    }

    function findDefinition(id){
        const key=String(id||"");
        const content=contentDefinitions();
        const groups=[
            content.talismans,
            content.ores,
            content.blueprints,
            content.tickets,
            content.equipmentSetItems
        ];
        for(const group of groups){
            const match=group.find(item=>item&&String(item.id||"")===key);
            if(match){ return match; }
        }
        return null;
    }

    function escapeAttribute(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/"/g,"&quot;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    function equipmentArtFromAsset(item){
        const path=String(item&&item.assetPath||"");
        if(!path){ return ""; }
        const rarity=String(item.rarityKey||item.quality||item.tierKey||"white");
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+escapeAttribute(rarity)+'"><img src="'+escapeAttribute(path)+'" alt="" draggable="false" onerror="this.hidden=true"></span>';
    }

    function canonicalPickerIcon(value){
        const owned=findOwnedItem(value);
        const definition=findDefinition(owned&&owned.id||value);

        /* Static materials/talismans/set pieces must use their canonical art,
           not the stale generic icon copied into older save data. */
        if(definition&&definition.icon){ return String(definition.icon); }

        /* Generated/starter equipment owns a concrete asset path. */
        const assetArt=equipmentArtFromAsset(owned);
        if(assetArt){ return assetArt; }

        if(owned&&owned.icon){ return String(owned.icon); }
        return "";
    }

    function repairSynthesisPicker(picker){
        if(!picker){ return; }
        const label=picker.closest("label");
        const select=label&&label.querySelector("select");
        if(!select){ return; }
        const options=Array.from(select.options||[]);
        const buttons=Array.from(picker.querySelectorAll("button"));

        buttons.forEach((button,index)=>{
            const option=options[index];
            if(!option){ return; }
            button.dataset.v17363PickerValue=String(option.value||"");
            button.classList.toggle("selected",String(option.value)===String(select.value));
            const iconHost=button.querySelector("i");
            const art=canonicalPickerIcon(option.value);
            if(iconHost&&art&&iconHost.innerHTML!==art){ iconHost.innerHTML=art; }
        });
    }

    function repairSynthesis(){
        const modal=document.getElementById("homeFeatureModal");
        if(modal&&modal.classList.contains("v141-synthesis-modal")){
            const box=modal.querySelector(".home-feature-modal-box");
            setImportant(modal,"padding","4px");
            setImportant(box,"width","calc(100% - 8px)");
            setImportant(box,"max-width","none");
            setImportant(box,"height","calc(100% - 8px)");
            setImportant(box,"max-height","calc(100% - 8px)");
            setImportant(box,"min-height","0");
        }
        document.querySelectorAll(".v143-item-picker").forEach(repairSynthesisPicker);
    }

    function removePowerSaveEntry(){
        const button=document.getElementById("quickPowerSavingToggle");
        if(button){ button.remove(); }
    }

    function repairDungeonInventory(){
        const app=document.getElementById("app");
        const inventory=document.getElementById("inventoryPage");
        if(!app||!inventory||!app.classList.contains("v141-dungeon-active")||
            !inventory.classList.contains("map-inventory-overlay-open")||
            !inventory.classList.contains("v169-dungeon-inventory-overlay")){
            return;
        }

        setImportant(inventory,"inset","0");
        setImportant(inventory,"left","0");
        setImportant(inventory,"right","0");
        setImportant(inventory,"top","0");
        setImportant(inventory,"bottom","0");
        setImportant(inventory,"width","100%");
        setImportant(inventory,"max-width","none");
        setImportant(inventory,"height","100%");
        setImportant(inventory,"max-height","none");
        setImportant(inventory,"transform","none");
        setImportant(inventory,"padding","8px");
        setImportant(inventory,"box-sizing","border-box");

        const shell=inventory.querySelector(".inventory-classic-shell");
        setImportant(shell,"width","100%");
        setImportant(shell,"max-width","none");
        setImportant(shell,"min-height","100%");
        setImportant(shell,"margin","0");
    }

    function runRepairs(){
        queued=false;
        removePowerSaveEntry();
        repairSynthesis();
        repairDungeonInventory();
    }

    function scheduleRepairs(){
        if(queued){ return; }
        queued=true;
        if(typeof requestAnimationFrame==="function"){
            requestAnimationFrame(runRepairs);
        }else{
            setTimeout(runRepairs,0);
        }
    }

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",scheduleRepairs,{once:true});
    }else{
        scheduleRepairs();
    }

    if(typeof MutationObserver!=="undefined"&&document.body){
        const observer=new MutationObserver(scheduleRepairs);
        observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    }

    document.addEventListener("change",scheduleRepairs,true);
    document.addEventListener("click",scheduleRepairs,true);
    window.addEventListener("resize",scheduleRepairs,{passive:true});

    window.v17363RunVisibleUiRepairs=runRepairs;
})();
