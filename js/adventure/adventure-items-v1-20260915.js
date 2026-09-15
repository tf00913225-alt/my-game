/* =====================================================
   出城冒險 V1 — rare potion integration owner
   Reuses the existing potion/inventory/battle runtime.
===================================================== */
(function installAdventureRarePotionsV1(){
    "use strict";
    if(typeof window==="undefined"||window.FourSymbolsAdventureItems){ return; }

    const ORANGE="#FF9F38";
    const ORANGE_LIGHT="#FFC46B";

    function pillIcon(mark){
        return '<span class="adventure-pill-art" aria-hidden="true">'+
            '<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">'+
            '<defs><radialGradient id="advPill'+mark+'" cx="36%" cy="30%" r="70%">'+
            '<stop offset="0" stop-color="#fff1bd"/><stop offset=".28" stop-color="'+ORANGE_LIGHT+'"/>'+
            '<stop offset="1" stop-color="'+ORANGE+'"/></radialGradient></defs>'+
            '<circle cx="32" cy="32" r="20" fill="url(#advPill'+mark+')" stroke="#f5d88f" stroke-width="2.6"/>'+
            '<path d="M23 23c5-4 13-5 18 0M22 42c6 4 14 4 20-1" fill="none" stroke="#8c4617" stroke-width="2" stroke-linecap="round"/>'+
            '<text x="32" y="38" text-anchor="middle" font-size="17" font-weight="700" fill="#4d260f">'+mark+'</text>'+ 
            '</svg></span>';
    }

    const definitions=Object.freeze({
        nineTurnRestorationPill:Object.freeze({
            id:"nineTurnRestorationPill",
            name:"九轉回元丹",
            shortName:"九轉回元丹",
            icon:pillIcon("九"),
            type:"potion",
            resource:"hp",
            recoveryPercent:100,
            price:null,
            stats:{},
            tierKey:"orange",
            manualOnly:true,
            adventureRarePotion:true,
            description:"戰鬥中指定 1 名存活角色，HP 立即恢復至 100%。不能復活。使用後消耗該角色本回合行動。"
        }),
        taichingQiPill:Object.freeze({
            id:"taichingQiPill",
            name:"太清聚氣丹",
            shortName:"太清聚氣丹",
            icon:pillIcon("氣"),
            type:"potion",
            resource:"sp",
            recoveryPercent:100,
            price:null,
            stats:{},
            tierKey:"orange",
            manualOnly:true,
            adventureRarePotion:true,
            description:"戰鬥中指定 1 名角色，SP 立即恢復至 100%。使用後消耗該角色本回合行動。"
        })
    });

    function definitionList(){ return Object.values(definitions); }

    function installDefinitions(){
        if(typeof potionDefinitions==="undefined"||!Array.isArray(potionDefinitions)){ return false; }
        definitionList().forEach(def=>{
            const existing=potionDefinitions.find(item=>item&&item.id===def.id);
            if(existing){ Object.assign(existing,def); }
            else{ potionDefinitions.push(Object.assign({},def)); }
        });
        hydrateOwnedPresentation();
        return true;
    }

    function hydrateOwnedPresentation(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return; }
        inventoryItems.forEach(item=>{
            const def=item&&definitions[item.id];
            if(!def){ return; }
            ["name","shortName","icon","type","resource","recoveryPercent","tierKey","manualOnly","adventureRarePotion","description"].forEach(key=>{
                if(Object.prototype.hasOwnProperty.call(def,key)){ item[key]=def[key]; }
            });
            if(!item.stats||typeof item.stats!=="object"){ item.stats={}; }
        });
    }

    let autoPotionGuardInstalled=false;
    function installAutoPotionGuard(){
        if(autoPotionGuardInstalled||typeof getAutoPotionId!=="function"){ return false; }
        const previousGetAutoPotionId=getAutoPotionId;
        getAutoPotionId=function(resource){
            if(typeof potionDefinitions!=="undefined"&&Array.isArray(potionDefinitions)&&typeof getPotionCount==="function"){
                const candidate=potionDefinitions
                    .filter(definition=>definition&&definition.resource===resource&&definition.manualOnly!==true)
                    .slice()
                    .sort((a,b)=>(Number(a.recoveryPercent)||0)-(Number(b.recoveryPercent)||0))
                    .find(definition=>Math.max(0,Number(getPotionCount(definition.id))||0)>0);
                if(candidate){ return candidate.id; }
                return null;
            }
            const fallback=previousGetAutoPotionId.apply(this,arguments);
            const definition=fallback&&typeof getPotionDefinition==="function"?getPotionDefinition(fallback):null;
            return definition&&definition.manualOnly===true?null:fallback;
        };
        autoPotionGuardInstalled=true;
        return true;
    }

    function count(itemId){
        if(typeof getPotionCount==="function"){ return Math.max(0,Number(getPotionCount(itemId))||0); }
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            return inventoryItems.reduce((sum,item)=>item&&item.id===itemId?sum+Math.max(1,Number(item.count)||1):sum,0);
        }
        return 0;
    }

    function add(itemId,quantity){
        const def=definitions[itemId];
        const amount=Math.max(0,Math.floor(Number(quantity)||0));
        if(!def||amount<=0){ return amount===0; }
        installDefinitions();
        if(typeof addPotionToInventory!=="function"){ return false; }
        const result=!!addPotionToInventory(itemId,amount);
        if(result){
            hydrateOwnedPresentation();
            if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        }
        return result;
    }

    window.FourSymbolsAdventureItems=Object.freeze({
        definitions:definitions,
        install:installDefinitions,
        installAutoPotionGuard:installAutoPotionGuard,
        hydrate:hydrateOwnedPresentation,
        count:count,
        add:add
    });

    installAutoPotionGuard();

    if(!installDefinitions()&&typeof setTimeout==="function"){
        let attempts=0;
        const retry=function(){
            attempts++;
            const definitionsReady=installDefinitions();
            installAutoPotionGuard();
            if(definitionsReady||attempts>=80){ return; }
            setTimeout(retry,50);
        };
        setTimeout(retry,0);
    }
})();
