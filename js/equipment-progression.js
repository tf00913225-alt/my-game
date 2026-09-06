/* =====================================================
   Equipment progression authority
   - four elemental set stats / orange quality
   - explicit reforge-slot rule
   - ordinary equipment generator shared by shop + dungeon
   - equipment dungeon rewards
===================================================== */
(function installEquipmentProgression(){
    "use strict";
    if(typeof window==="undefined"||window.__equipmentProgressionInstalled){ return; }
    window.__equipmentProgressionInstalled=true;

    const RARITIES=[
        {key:"white",label:"白裝",chance:40,min:1,max:3,reforgeSlots:0,shopPrice:500,color:"#d8d8d8"},
        {key:"blue",label:"藍裝",chance:40,min:4,max:6,reforgeSlots:0,shopPrice:1500,color:"#42a5ff"},
        {key:"purple",label:"紫裝",chance:15,min:7,max:9,reforgeSlots:1,shopPrice:4000,color:"#b05cff"},
        {key:"orange",label:"橙裝",chance:5,min:10,max:12,reforgeSlots:1,shopPrice:10000,color:"#ff9f38"}
    ];
    const RARITY_BY_KEY=Object.fromEntries(RARITIES.map(item=>[item.key,item]));
    const STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",spirit:"精神",energy:"能量"};
    const SLOT_META={
        shoulder:{label:"護腕",warrior:["vitality","attack"],mage:["vitality","intelligence"]},
        head:{label:"頭盔",warrior:["vitality","attack","agility"],mage:["vitality","intelligence","agility"]},
        shoes:{label:"鞋子",warrior:["vitality","agility","attack"],mage:["vitality","agility","intelligence"]},
        armor:{label:"衣服",warrior:["vitality","agility","attack"],mage:["vitality","agility","intelligence"]},
        weapon:{label:"武器",warrior:["attack"],mage:["intelligence"]}
    };
    const ASSETS={
        warrior:{
            shoulder:["assets/equipment/warrior/bracer-01.png","assets/equipment/warrior/bracer-02.png"],
            head:["assets/equipment/warrior/head-01.png","assets/equipment/warrior/head-02.png"],
            armor:["assets/equipment/warrior/armor-01.png","assets/equipment/warrior/armor-02.png"],
            shoes:["assets/equipment/warrior/shoes-01.png","assets/equipment/warrior/shoes-02.png"],
            weapon:["assets/equipment/warrior/weapon-01.png","assets/equipment/warrior/weapon-02.png","assets/equipment/warrior/weapon-03.png","assets/equipment/warrior/weapon-04.png"]
        },
        mage:{
            shoulder:["assets/equipment/mage/bracer-01.png","assets/equipment/mage/bracer-02.png"],
            head:["assets/equipment/mage/head-01.png","assets/equipment/mage/head-02.png"],
            armor:["assets/equipment/mage/armor-01.png","assets/equipment/mage/armor-02.png"],
            shoes:["assets/equipment/mage/shoes-01.png","assets/equipment/mage/shoes-02.png"],
            weapon:["assets/equipment/mage/weapon-01.png","assets/equipment/mage/weapon-02.png","assets/equipment/mage/weapon-03.png","assets/equipment/mage/weapon-04.png"]
        }
    };
    const NAME_PREFIX={
        white:["素鐵","粗革","舊紋","樸木","灰鋼","素麻"],
        blue:["青鋼","凝霜","玄紋","碧影","寒星","靈木"],
        purple:["紫霞","幽月","星隕","玄冥","流光","凌霄"],
        orange:["日曜","龍炎","天衡","帝曜","神鑄","無極"]
    };
    const NAME_SUFFIX={
        warrior:{shoulder:"戰腕",head:"戰盔",armor:"戰甲",shoes:"戰靴",weapon:"戰刃"},
        mage:{shoulder:"法環",head:"法冠",armor:"法袍",shoes:"法履",weapon:"法杖"}
    };
    const SET_RULES={
        blade:{stats:{attack:15,vitality:-2}},
        fan:{stats:{intelligence:15,vitality:-2}},
        heavyArmor:{stats:{attack:7,spirit:5}},
        robe:{stats:{intelligence:7,spirit:5}},
        boots:{stats:{attack:2,agility:13}},
        shoes:{stats:{intelligence:2,agility:13}},
        helm:{stats:{attack:15}},
        crown:{stats:{intelligence:15}},
        wristguard:{stats:{attack:15}},
        focus:{stats:{intelligence:15}}
    };
    const SET_IDS=new Set(["setFire","setWater","setEarth","setWind"]);
    const SHOP_STORAGE_KEY="v169_equipment_shop_daily";
    let activeReforgeSnapshot=null;
    let equipmentDungeonRunning=false;
    let equipmentDungeonWaveIndex=-1;

    if(typeof applyPostBattleAutoRecovery==="function"){
        const previousEquipmentPostBattleAutoRecovery=applyPostBattleAutoRecovery;
        applyPostBattleAutoRecovery=function(){
            if(equipmentDungeonRunning&&equipmentDungeonWaveIndex>=0&&equipmentDungeonWaveIndex<2){
                return;
            }
            return previousEquipmentPostBattleAutoRecovery.apply(this,arguments);
        };
    }

    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function randomInt(min,max,random=Math.random){ return Math.floor(random()*(max-min+1))+min; }
    function hashSeed(value){
        let hash=2166136261;
        for(const ch of String(value)){ hash^=ch.charCodeAt(0); hash=Math.imul(hash,16777619); }
        return hash>>>0;
    }
    function seededRandom(seed){
        let state=hashSeed(seed)||1;
        return function(){ state=(state+0x6D2B79F5)|0; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
    }
    function rarityFromRandom(random=Math.random){
        const roll=random()*100;
        let cursor=0;
        for(const rarity of RARITIES){ cursor+=rarity.chance; if(roll<cursor){ return rarity; } }
        return RARITIES[RARITIES.length-1];
    }
    function artMarkup(path,rarityKey){
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarityKey+'"><img src="'+path+'" alt="" draggable="false" onerror="this.hidden=true"></span>';
    }
    function makeUid(prefix){ return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8); }
    function assetVariant(classType,slot,random){
        const list=ASSETS[classType]&&ASSETS[classType][slot]||[];
        return list.length?list[Math.floor(random()*list.length)%list.length]:"";
    }
    function mageWeaponSuffix(asset){
        const source=String(asset||"");
        return /weapon-(?:03|04)\.png(?:\?|$)/i.test(source)?"法扇":"法杖";
    }
    function generatedName(rarity,classType,slot,random,asset){
        const prefixes=NAME_PREFIX[rarity.key];
        const prefix=prefixes[Math.floor(random()*prefixes.length)%prefixes.length];
        const suffix=classType==="mage"&&slot==="weapon"
            ?mageWeaponSuffix(asset)
            :NAME_SUFFIX[classType][slot];
        return prefix+suffix;
    }
    function normalizeGeneratedMageWeaponName(item){
        if(!item||!item.v17346GeneratedEquipment||item.classType!=="mage"||item.type!=="weapon"){ return item; }
        const source=item.assetPath||item.icon||"";
        const suffix=mageWeaponSuffix(source);
        if(/法器$/.test(String(item.name||""))){ item.name=String(item.name).replace(/法器$/,suffix); }
        return item;
    }
    function generateEquipment(random=Math.random,forced={}){
        const rarity=forced.rarity?RARITY_BY_KEY[forced.rarity]||rarityFromRandom(random):rarityFromRandom(random);
        const classType=forced.classType||(random()<.5?"warrior":"mage");
        const slots=Object.keys(SLOT_META);
        const slot=forced.slot||slots[Math.floor(random()*slots.length)%slots.length];
        const statPool=SLOT_META[slot][classType];
        const stat=forced.stat||statPool[Math.floor(random()*statPool.length)%statPool.length];
        const value=forced.value==null?randomInt(rarity.min,rarity.max,random):Number(forced.value);
        const asset=assetVariant(classType,slot,random);
        const name=generatedName(rarity,classType,slot,random,asset);
        return {
            id:makeUid("gear"),v141Uid:makeUid("gearuid"),name,
            icon:artMarkup(asset,rarity.key),type:slot,count:1,price:Math.floor(rarity.shopPrice*.2),
            stats:{[stat]:value},reforgeStats:null,reforgeSlots:rarity.reforgeSlots,reforgeUsed:0,
            rarityKey:rarity.key,quality:rarity.key,classType,assetPath:asset,
            shopPrice:rarity.shopPrice,v17346GeneratedEquipment:true
        };
    }
    window.v17346GenerateEquipment=generateEquipment;
    window.v17346EquipmentRarityTable=RARITIES.map(item=>({...item}));

    function setPieceKey(item){
        const id=String(item&&item.id||"");
        return Object.keys(SET_RULES).find(key=>id.endsWith("_"+key))||null;
    }
    function addOrangeClass(icon){
        if(typeof icon!=="string"||icon.includes("v17346-rarity-orange")){ return icon; }
        return icon.replace(/class="([^"]*v169-item-art[^"]*)"/,(_m,classes)=>'class="'+classes+' v17346-rarity-orange"');
    }
    function applySetRule(item){
        if(!item||!SET_IDS.has(item.setId)){ return item; }
        const key=setPieceKey(item);
        if(!key){ return item; }
        item.stats={...SET_RULES[key].stats};
        item.quality="orange";
        item.rarityKey="orange";
        item.reforgeSlots=Math.max(1,Math.floor(Number(item.reforgeSlots)||0));
        const hasRecordedUse=Object.prototype.hasOwnProperty.call(item,"reforgeUsed");
        const migratedUse=hasRecordedUse
            ?Math.max(0,Math.floor(Number(item.reforgeUsed)||0))
            :(item.reforgeStats&&Object.keys(item.reforgeStats).length?1:0);
        item.reforgeUsed=Math.min(item.reforgeSlots,migratedUse);
        item.icon=addOrangeClass(item.icon);
        return item;
    }

    /*
       First-character equipment has two legacy identities in the current runtime:
       backpack/equip uses the party-slot key ("fire"), while getMainCharacterStats()
       still asks getEquipmentBonus(player.element). Keep both keys pointed at the same
       slot object so non-fire first characters receive the equipment they visibly wear.
       Existing element-key pieces are merged into empty slots before the alias is made.
    */
    function syncMainCharacterEquipmentStorage(){
        if(
            typeof player==="undefined"||!player||
            typeof characterEquipment==="undefined"||!characterEquipment
        ){ return; }
        const elementKey=String(player.element||"");
        const partyKey=typeof getBackpackEquipmentKey==="function"
            ?getBackpackEquipmentKey(0)
            :"fire";
        if(!elementKey||!partyKey||elementKey===partyKey){ return; }
        const partySlots=characterEquipment[partyKey];
        const elementSlots=characterEquipment[elementKey];
        if(!partySlots||typeof partySlots!=="object"){ return; }
        if(elementSlots&&typeof elementSlots==="object"&&elementSlots!==partySlots){
            Object.keys(partySlots).forEach(slot=>{
                if(!partySlots[slot]&&elementSlots[slot]){ partySlots[slot]=elementSlots[slot]; }
            });
        }
        characterEquipment[elementKey]=partySlots;
    }
    window.v17346SyncMainCharacterEquipmentStorage=syncMainCharacterEquipmentStorage;

    function syncFourElementSets(){
        syncMainCharacterEquipmentStorage();
        try{
            const defs=typeof window.v132GetContentDefinitions==="function"?window.v132GetContentDefinitions():null;
            (defs&&defs.equipmentSetItems||[]).forEach(applySetRule);
        }catch(_){ }
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            inventoryItems.forEach(item=>{ applySetRule(item); normalizeGeneratedMageWeaponName(item); });
        }
        if(typeof characterEquipment!=="undefined"&&characterEquipment){
            Object.values(characterEquipment).forEach(slots=>Object.values(slots||{}).forEach(item=>{
                applySetRule(item);
                normalizeGeneratedMageWeaponName(item);
            }));
        }
    }
    syncFourElementSets();
    window.v17346SyncFourElementSets=syncFourElementSets;

    function remainingReforgeSlots(item){
        return Math.max(0,Math.floor(Number(item&&item.reforgeSlots)||0)-Math.floor(Number(item&&item.reforgeUsed)||0));
    }
    window.v17346RemainingReforgeSlots=remainingReforgeSlots;

    function appendReforgeMarkers(item){
        const stats=document.getElementById("itemModalStats");
        if(!stats){ return; }
        stats.querySelectorAll(".v17346-reforge-slot").forEach(node=>node.remove());
        const count=remainingReforgeSlots(item);
        for(let index=0;index<count;index++){
            stats.insertAdjacentHTML("beforeend",'<div class="v17346-reforge-slot">[可冶煉]</div>');
        }
    }
    if(typeof openItemModal==="function"){
        const previousOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            syncMainCharacterEquipmentStorage();
            const result=previousOpenItemModal.apply(this,arguments);
            const item=typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null;
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.toggle("v17346-potion-detail",!!(item&&item.type==="potion")); }
            if(item){ applySetRule(item); appendReforgeMarkers(item); }
            return result;
        };
    }
    if(typeof openEquippedItem==="function"){
        const previousOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item){
            syncMainCharacterEquipmentStorage();
            const result=previousOpenEquippedItem.apply(this,arguments);
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v17346-potion-detail"); }
            if(item){ applySetRule(item); appendReforgeMarkers(item); }
            return result;
        };
    }
    if(typeof closeItemModal==="function"){
        const previousCloseItemModal=closeItemModal;
        closeItemModal=function(){
            const modal=document.getElementById("itemModal");
            if(modal){ modal.classList.remove("v17346-potion-detail"); }
            return previousCloseItemModal.apply(this,arguments);
        };
    }

    function allEquipment(){
        const result=[];
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){ result.push(...inventoryItems); }
        if(typeof characterEquipment!=="undefined"&&characterEquipment){ Object.values(characterEquipment).forEach(slots=>result.push(...Object.values(slots||{}))); }
        return result.filter(Boolean);
    }
    function selectedReforgeItem(){
        const select=document.querySelector('select[onchange*="v141SelectReforgeItem"]');
        const uid=select&&select.value;
        return uid?allEquipment().find(item=>item&&item.v141Uid===uid)||null:null;
    }
    if(typeof window.v141StartReforge==="function"){
        const previousStartReforge=window.v141StartReforge;
        window.v141StartReforge=function(){
            const item=selectedReforgeItem();
            if(!item||remainingReforgeSlots(item)<=0){
                if(typeof window.rpgAlert==="function"){ void window.rpgAlert("這件裝備沒有可用的［可冶煉］詞條槽。",{title:"無法冶煉"}); }
                else{ alert("這件裝備沒有可用的［可冶煉］詞條槽。"); }
                return;
            }
            activeReforgeSnapshot={uid:item.v141Uid,used:Math.max(0,Number(item.reforgeUsed)||0),stats:{...(item.reforgeStats||{})}};
            return previousStartReforge.apply(this,arguments);
        };
    }
    if(typeof window.v141ResolveReforge==="function"){
        const previousResolveReforge=window.v141ResolveReforge;
        window.v141ResolveReforge=function(apply){
            const snapshot=activeReforgeSnapshot;
            const item=snapshot?allEquipment().find(entry=>entry&&entry.v141Uid===snapshot.uid):null;
            const result=previousResolveReforge.apply(this,arguments);
            if(apply&&item&&snapshot){
                const rolled={...(item.reforgeStats||{})};
                const merged={...snapshot.stats};
                Object.entries(rolled).forEach(([key,value])=>{ merged[key]=(Number(merged[key])||0)+(Number(value)||0); });
                item.reforgeStats=merged;
                item.reforgeUsed=Math.min(Math.floor(Number(item.reforgeSlots)||0),snapshot.used+1);
                if(typeof saveGame==="function"){ saveGame(); }
                if(typeof window.v141RenderSynthesis==="function"){ window.v141RenderSynthesis(); }
            }
            activeReforgeSnapshot=null;
            return result;
        };
    }

    function injectStyles(){
        if(document.getElementById("equipment-progression-style")){ return; }
        const style=document.createElement("style");
        style.id="equipment-progression-style";
        style.textContent=`
.v17346-rarity-white{border:2px solid #d8d8d8!important;box-shadow:0 0 7px rgba(216,216,216,.55)!important}
.v17346-rarity-blue{border:2px solid #42a5ff!important;box-shadow:0 0 9px rgba(66,165,255,.7)!important}
.v17346-rarity-purple{border:2px solid #b05cff!important;box-shadow:0 0 10px rgba(176,92,255,.75)!important}
.v17346-rarity-orange{border:3px solid #ff8a1f!important;box-shadow:0 0 5px #ff7a16,0 0 14px rgba(255,136,31,.95),inset 0 0 8px rgba(255,159,56,.3)!important}
.v17346-reforge-slot{margin-top:7px;color:#ffbf5b!important;font-weight:900;letter-spacing:.06em}
#game-stage #itemModal.v17346-potion-detail .item-modal-box{height:auto!important;min-height:0!important;max-height:calc(100% - 28px)!important;flex:0 0 auto!important;align-self:center!important;justify-content:flex-start!important}
#game-stage #itemModal.v17346-potion-detail #itemModalStats{flex:0 0 auto!important;min-height:0!important;max-height:180px!important}
#game-stage #itemModal.v17346-potion-detail .item-modal-buttons{margin-top:0!important}
#game-stage #itemModal #v17342InventoryPotionUse{-webkit-appearance:none!important;appearance:none!important;background:linear-gradient(180deg,#d9ad55 0%,#9c641c 100%)!important;border:1px solid #f2cf83!important;color:#1a1007!important;opacity:1!important;font-weight:900!important;text-shadow:none!important;box-shadow:inset 0 1px 0 rgba(255,242,192,.42),0 3px 8px rgba(0,0,0,.34)!important}
#game-stage #itemModal #v17342InventoryPotionUse:focus,#game-stage #itemModal #v17342InventoryPotionUse:focus-visible,#game-stage #itemModal #v17342InventoryPotionUse:active{background:linear-gradient(180deg,#edc66d 0%,#ad7524 100%)!important;color:#160d05!important;outline:2px solid rgba(255,220,139,.72)!important;outline-offset:1px!important}
#game-stage #itemModal #v17342InventoryPotionUse:disabled{background:#33291f!important;border-color:#66533d!important;color:#8f806b!important;box-shadow:none!important;opacity:.68!important}
.v132-reward-modal-inner.v17346-preview-modal{width:min(360px,calc(100% - 24px))!important;height:min(540px,calc(100dvh - 24px))!important;max-height:calc(100dvh - 24px)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:16px!important;box-sizing:border-box!important}
.v132-reward-modal-inner.v17346-preview-modal>h3{position:static!important;flex:0 0 auto!important;margin:0 0 12px!important;padding:0!important;background:transparent!important}
.v132-reward-modal-inner.v17346-preview-modal .v132-preview-list-scroll{flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;touch-action:pan-y;scrollbar-gutter:stable}
.v132-reward-modal-inner.v17346-preview-modal .v132-reward-actions{position:static!important;flex:0 0 auto!important;margin-top:12px!important;padding-top:0!important;background:transparent!important}
.v17346-shop-card{position:relative;overflow:hidden;padding:10px 9px 9px!important;cursor:pointer;transition:filter .16s ease,background .16s ease,border-color .16s ease}.v17346-shop-card .v17346-gear-art{width:74px;height:74px;margin:0 auto 7px}.v17346-gear-art .v169-item-art{width:100%!important;height:100%!important}.v17346-shop-card .v17346-shop-name{display:block;color:#f6e7c2!important;font-size:17px!important;line-height:1.22!important;font-weight:900!important;letter-spacing:.02em}.v17346-shop-card .v17346-shop-slot{display:block;margin-top:3px;color:#c9b894!important;font-size:14px!important;line-height:1.25!important}.v17346-shop-card .v17346-stat{display:block;margin-top:3px;color:#ffe0a0!important;font-size:15px!important;line-height:1.3!important;font-weight:800!important}.v17346-shop-card .v17346-reforge-mini{display:block;margin-top:2px;color:#ffbf5b;font-size:12px;font-weight:800}.v17346-shop-card .v17346-shop-buy{-webkit-appearance:none;appearance:none;width:100%;min-height:42px;margin-top:8px;border:1px solid rgba(226,181,87,.76);border-radius:7px;font-size:15px;font-weight:900;line-height:1.15}.v17346-shop-card.is-affordable{background:linear-gradient(180deg,rgba(51,36,19,.94),rgba(19,14,10,.96))!important;box-shadow:inset 0 0 0 1px rgba(225,179,83,.08),0 0 10px rgba(211,155,54,.08)}.v17346-shop-card.is-affordable .v17346-shop-buy{background:linear-gradient(180deg,#f4d477 0%,#cf942d 58%,#a76518 100%)!important;border-color:#ffe5a0!important;color:#241506!important;text-shadow:0 1px rgba(255,239,185,.35)!important;box-shadow:inset 0 1px 0 rgba(255,248,211,.62),0 0 10px rgba(236,183,71,.32)!important}.v17346-shop-card.is-affordable .v17346-shop-buy:active{background:linear-gradient(180deg,#fff0ad,#d69a32)!important;color:#160d05!important}.v17346-shop-card.is-unaffordable{background:linear-gradient(180deg,rgba(38,29,24,.94),rgba(17,14,12,.98))!important;border-color:rgba(119,83,61,.72)!important}.v17346-shop-card.is-unaffordable .v17346-gear-art img{filter:saturate(.48) brightness(.72)}.v17346-shop-card.is-unaffordable .v17346-shop-name{color:#b9aa98!important}.v17346-shop-card.is-unaffordable[data-rarity="orange"] .v17346-shop-name{color:#d7944d!important}.v17346-shop-card.is-unaffordable .v17346-shop-slot,.v17346-shop-card.is-unaffordable .v17346-stat{color:#978878!important}.v17346-shop-card .v17346-shop-buy:disabled{background:linear-gradient(180deg,rgba(91,43,31,.82),rgba(48,27,23,.92))!important;border-color:rgba(167,79,56,.7)!important;color:#d79279!important;box-shadow:none!important;opacity:.86!important;cursor:not-allowed}.v17346-shop-preview-modal{width:min(340px,calc(100% - 26px))!important;max-height:calc(100dvh - 30px)!important;padding:18px!important;box-sizing:border-box!important;text-align:center!important}.v17346-shop-preview-modal>h3{margin:0 0 12px!important;color:#f7e7be!important;font-size:22px!important;line-height:1.25!important}.v17346-shop-preview-art{width:168px;height:168px;margin:0 auto 14px;display:grid;place-items:center}.v17346-shop-preview-art .v169-item-art{width:100%!important;height:100%!important}.v17346-shop-preview-info{display:grid;gap:7px;padding:11px 12px;border:1px solid rgba(197,151,72,.55);border-radius:9px;background:rgba(12,9,6,.7);font-size:16px}.v17346-shop-preview-info strong{color:#ffe09a;font-size:18px}.v17346-shop-preview-price{margin-top:11px;color:#ffd078;font-size:18px;font-weight:900}.v17346-shop-preview-reforge{margin-top:6px;color:#ffbf5b;font-weight:900}.v17346-shop-preview-modal .v132-reward-actions{margin-top:14px!important}.v17346-equipment-dungeon-card .v141-dungeon-cover-art{background-image:linear-gradient(rgba(5,4,3,.2),rgba(5,4,3,.68)),url('assets/ui/dungeon-equipment-v17346.png')!important;background-size:cover!important;background-position:center!important}
`;
        document.head.appendChild(style);
    }
    injectStyles();

    if(typeof window.v132ShowRewardModal==="function"){
        const previousShowRewardModal=window.v132ShowRewardModal;
        window.v132ShowRewardModal=function(html){
            let markup=html;
            if(typeof markup==="string"&&markup.includes("v132-preview-list-scroll")){
                markup=markup.replace('class="v132-reward-modal-inner"','class="v132-reward-modal-inner v17346-preview-modal"');
            }
            return previousShowRewardModal.call(this,markup);
        };
    }

    function shopState(){
        const today=(()=>{const now=new Date();return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");})();
        try{ const stored=JSON.parse(localStorage.getItem(SHOP_STORAGE_KEY)||"{}"); return stored&&stored.date===today?{date:today,refreshCount:Math.max(0,Math.min(10,Math.floor(Number(stored.refreshCount)||0)))}:{date:today,refreshCount:0}; }catch(_){ return {date:today,refreshCount:0}; }
    }
    function currentShopOffers(){
        const state=shopState();
        return Array.from({length:6},(_,index)=>generateEquipment(seededRandom(state.date+":"+state.refreshCount+":"+index)));
    }
    function statLine(item){
        const [key,value]=Object.entries(item.stats||{})[0]||["",0];
        return (STAT_LABEL[key]||key)+(Number(value)>=0?" +":" ")+value;
    }
    window.v17346PreviewEquipmentShopOffer=function(index){
        const safeIndex=Math.max(0,Math.min(5,Math.floor(Number(index)||0)));
        const item=currentShopOffers()[safeIndex];
        if(!item||typeof window.v132ShowRewardModal!=="function"){ return; }
        const rarity=RARITY_BY_KEY[item.rarityKey]||RARITIES[0];
        const html='<div class="v132-reward-modal-inner v17346-shop-preview-modal" data-rarity="'+escapeHtml(item.rarityKey)+'"><h3>'+escapeHtml(item.name)+'</h3><div class="v17346-shop-preview-art">'+item.icon+'</div><div class="v17346-shop-preview-info"><span>'+escapeHtml(SLOT_META[item.type].label)+'</span><strong>'+escapeHtml(statLine(item))+'</strong></div><div class="v17346-shop-preview-price">'+rarity.shopPrice.toLocaleString("zh-TW")+' 金幣</div>'+(item.reforgeSlots?'<div class="v17346-shop-preview-reforge">[可冶煉]</div>':'')+'<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };
    function replaceEquipmentShop(){
        const root=document.querySelector("#homeFeatureModalBody .v17345-equipment-shop");
        if(!root){ return; }
        const state=shopState();
        const offers=currentShopOffers();
        const freeRemaining=Math.max(0,5-state.refreshCount);
        const currentGold=typeof gold!=="undefined"?Math.max(0,Math.floor(Number(gold)||0)):0;
        const goldText=currentGold.toLocaleString("zh-TW");
        root.innerHTML='<div class="v17345-equipment-wallet"><span>裝備商店</span><b>金幣 '+goldText+'</b></div><div class="v17345-equipment-grid">'+offers.map((item,index)=>{
            const rarity=RARITY_BY_KEY[item.rarityKey];
            const canBuy=currentGold>=rarity.shopPrice;
            return '<article class="v17345-equipment-card v17346-shop-card '+(canBuy?'is-affordable':'is-unaffordable')+'" data-rarity="'+escapeHtml(item.rarityKey)+'" role="button" tabindex="0" aria-label="預覽 '+escapeHtml(item.name)+'" onclick="v17346PreviewEquipmentShopOffer('+index+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();v17346PreviewEquipmentShopOffer('+index+')}"><div class="v17345-equipment-icon v17346-gear-art">'+item.icon+'</div><b class="v17346-shop-name">'+escapeHtml(item.name)+'</b><span class="v17346-shop-slot">'+escapeHtml(SLOT_META[item.type].label)+'</span><span class="v17346-stat">'+escapeHtml(statLine(item))+'</span>'+(item.reforgeSlots?'<span class="v17346-reforge-mini">[可冶煉]</span>':'')+'<button class="v17346-shop-buy" type="button" '+(canBuy?'onclick="event.stopPropagation();v17346BuyEquipmentShopOffer('+index+')"':'disabled aria-disabled="true"')+'>'+rarity.shopPrice.toLocaleString("zh-TW")+' 金幣</button></article>';
        }).join("")+'</div><div class="v17345-equipment-refresh"><div><b>今日刷新 '+state.refreshCount+' / 10</b><span>前5次免費；第6～10次尚未開放。</span></div><button type="button" '+(freeRemaining>0?'onclick="v17345RefreshEquipmentShop()"':'disabled')+'>'+(freeRemaining>0?'免費刷新（剩'+freeRemaining+'次）':'免費刷新已用完')+'</button></div>';
    }
    window.v17346BuyEquipmentShopOffer=function(index){
        const item=currentShopOffers()[Math.max(0,Math.min(5,Math.floor(Number(index)||0)))];
        if(!item){ return; }
        const cost=Math.max(0,Number(item.shopPrice)||0);
        if(typeof gold==="undefined"||Number(gold)<cost){ void (window.rpgAlert?window.rpgAlert("金幣不足。",{title:"無法購買"}):Promise.resolve()); return; }
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return; }
        gold-=cost;
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){ inventoryItems.push({...item}); }
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        if(typeof saveGame==="function"){ saveGame(); }
        replaceEquipmentShop();
        if(window.rpgAlert){ void window.rpgAlert("已購買「"+item.name+"」。",{title:"購買成功",tone:"success"}); }
    };
    if(typeof window.v169SwitchShopPage==="function"){
        const previousSwitch=window.v169SwitchShopPage;
        window.v169SwitchShopPage=function(page){ const result=previousSwitch.apply(this,arguments); if(page==="equipment"){ replaceEquipmentShop(); } return result; };
    }
    if(typeof window.v17345RefreshEquipmentShop==="function"){
        const previousRefresh=window.v17345RefreshEquipmentShop;
        window.v17345RefreshEquipmentShop=function(){ const result=previousRefresh.apply(this,arguments); replaceEquipmentShop(); return result; };
    }

    let pendingEquipmentRewards=[];
    function equipmentRewardItems(multiplier){
        const count=6*Math.max(1,Math.floor(Number(multiplier)||1));
        return Array.from({length:count},()=>generateEquipment(Math.random));
    }
    function showEquipmentReward(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        const html='<div class="v132-reward-modal-inner"><h3>裝備副本挑戰成功！</h3><p>獲得裝備寶箱 ×2，每個寶箱隨機掉落3件裝備。</p><p>白裝40%・藍裝40%・紫裝15%・橙裝5%</p><div class="v132-reward-actions"><button type="button" onclick="v17346ClaimEquipmentDungeon(false)">直接領取</button><button type="button" onclick="v17346ClaimEquipmentDungeon(true)">看廣告雙倍領取</button></div></div>';
        window.v132ShowRewardModal(html);
    }
    window.v17346ClaimEquipmentDungeon=function(doubled){
        const grant=multiplier=>{
            pendingEquipmentRewards=equipmentRewardItems(multiplier);
            if(
                typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)||
                inventoryItems.length+pendingEquipmentRewards.length>120
            ){
                alert("背包空間不足，請先整理背包。");
                pendingEquipmentRewards=[];
                return;
            }
            pendingEquipmentRewards.forEach(item=>inventoryItems.push(item));
            if(typeof saveGame==="function"){ saveGame(); }
            if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
            if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
            const summary=pendingEquipmentRewards.map(item=>item.name+"（"+RARITY_BY_KEY[item.rarityKey].label+"・"+statLine(item)+(item.reforgeSlots?"・可冶煉":"")+"）").join("\n");
            if(window.rpgAlert){ void window.rpgAlert("已獲得 "+pendingEquipmentRewards.length+" 件裝備：\n"+summary,{title:"裝備寶箱",tone:"success"}); }
            pendingEquipmentRewards=[];
            if(typeof showPage==="function"){ showPage("dungeon"); }
            if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
        };
        if(doubled&&typeof showRewardedAd==="function"){ showRewardedAd(()=>grant(2),()=>alert("廣告未完成，未獲得雙倍獎勵。")); }
        else{ grant(1); }
    };

    async function beginEquipmentDungeon(){
        if(equipmentDungeonRunning||typeof window.v148BuildDailyDungeonWaves!=="function"||typeof window.v132LaunchDungeonBattle!=="function"){ return; }
        const built=window.v148BuildDailyDungeonWaves("gold");
        const waves=built&&built.waves||[];
        if(waves.length!==3){ return; }
        const accepted=window.rpgConfirm?await window.rpgConfirm("裝備副本共3輪，每輪6名敵人。\n勝利後獲得2個裝備寶箱，每箱3件隨機裝備。\n是否開始挑戰？",{title:"裝備副本",confirmText:"開始挑戰"}):true;
        if(!accepted){ return; }
        equipmentDungeonRunning=true;
        const launch=index=>{
            equipmentDungeonWaveIndex=index;
            const started=window.v132LaunchDungeonBattle(waves[index],function(outcome){
                const win=outcome&&outcome.result==="win";
                if(!win){ equipmentDungeonRunning=false; equipmentDungeonWaveIndex=-1; if(typeof showPage==="function"){ showPage("dungeon"); } if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); } return; }
                if(index<2){ setTimeout(()=>launch(index+1),320); return; }
                equipmentDungeonRunning=false;
                equipmentDungeonWaveIndex=-1;
                showEquipmentReward();
            });
            if(started===false){ equipmentDungeonRunning=false; equipmentDungeonWaveIndex=-1; }
        };
        launch(0);
    }
    window.v17346BeginEquipmentDungeon=beginEquipmentDungeon;

    window.v17346ShowEquipmentDungeonPreview=function(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        const html='<div class="v132-reward-modal-inner v17346-preview-modal"><h3>裝備副本獎勵預覽</h3><div class="v132-preview-list-scroll"><div class="v132-preview-reward"><span>⬜</span><b>白裝</b><strong>40%</strong><small>固定1詞條 +1～3</small></div><div class="v132-preview-reward"><span>🟦</span><b>藍裝</b><strong>40%</strong><small>固定1詞條 +4～6</small></div><div class="v132-preview-reward"><span>🟪</span><b>紫裝</b><strong>15%</strong><small>固定1詞條 +7～9・可冶煉×1</small></div><div class="v132-preview-reward"><span>🟧</span><b>橙裝</b><strong>5%</strong><small>固定1詞條 +10～12・可冶煉×1</small></div><p>勝利獲得2個寶箱，每箱3件；看廣告雙倍為12件裝備。</p></div><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    };

    if(typeof renderDungeonTabContent==="function"){
        const previousRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            const html=previousRenderDungeonTabContent.apply(this,arguments);
            if(tabName!=="daily"||typeof html!=="string"||html.includes("v17346-equipment-dungeon-card")){ return html; }
            const card='<article class="v141-dungeon-cover-card v17346-equipment-dungeon-card" data-dungeon-cover="equipment"><div class="v141-dungeon-cover-art"><span>裝備副本</span><small>3輪 × 每輪6隻</small></div><div class="v141-dungeon-cover-info"><b>裝備副本</b><span>難度：與一般副本相同</span></div><div class="v141-dungeon-cover-actions"><button type="button" onclick="v17346ShowEquipmentDungeonPreview()">獎勵預覽</button><button type="button" onclick="v17346BeginEquipmentDungeon()">挑戰</button></div><div class="v141-dungeon-remaining">可挑戰</div></article>';
            return html.replace(/<\/div>\s*$/,card+'</div>');
        };
    }

    syncMainCharacterEquipmentStorage();
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",syncMainCharacterEquipmentStorage,{once:true});
    }else{
        setTimeout(syncMainCharacterEquipmentStorage,0);
    }

    if(typeof saveGame==="function"){ try{ saveGame(); }catch(_){ } }

    function releaseV17350RuntimeGate(){
        if(typeof window.__v17347RuntimeGateRelease==="function"){
            window.__v17347RuntimeGateRelease();
        }
    }
    function failV17350RuntimeGate(message){
        if(typeof window.__v17347RuntimeGateFail==="function"){
            window.__v17347RuntimeGateFail(message||"背包與批量操作系統載入失敗，請重新整理。");
        }
    }
    function loadV17350InventoryQol(){
        if(typeof document==="undefined"||!document.head){
            releaseV17350RuntimeGate();
            return;
        }
        if(!document.getElementById("v17350-inventory-qol-style")){
            const link=document.createElement("link");
            link.id="v17350-inventory-qol-style";
            link.rel="stylesheet";
            link.href="css/52-v173.50-inventory-qol.css?v=173.55";
            link.onerror=function(){ failV17350RuntimeGate("背包介面樣式載入失敗，請重新整理。"); };
            document.head.appendChild(link);
        }
        if(document.getElementById("v17350-inventory-qol-runtime")){
            releaseV17350RuntimeGate();
            return;
        }
        const script=document.createElement("script");
        script.id="v17350-inventory-qol-runtime";
        script.src="js/53-v173.50-inventory-qol.js?v=173.55";
        script.async=false;
        script.onload=function(){
        if(typeof window.__v173ReportRuntimeProgress==="function"){
            window.__v173ReportRuntimeProgress("v17350-inventory-qol-runtime","背包與批量操作系統");
        }
        if(window.__v17351QaReady){
            releaseV17350RuntimeGate();
            return;
        }
        let qaSettled=false;
        const onQaReady=function(){
            if(qaSettled){ return; }
            qaSettled=true;
            document.removeEventListener("v17351:qa-ready",onQaReady);
            releaseV17350RuntimeGate();
        };
        document.addEventListener("v17351:qa-ready",onQaReady,{once:true});
        setTimeout(function(){
            if(qaSettled||window.__v17351QaReady){
                if(!qaSettled){ onQaReady(); }
                return;
            }
            qaSettled=true;
            document.removeEventListener("v17351:qa-ready",onQaReady);
            failV17350RuntimeGate("功能模組載入時間過長，請重新整理後再試。");
        },30000);
    };
        script.onerror=function(){ failV17350RuntimeGate("背包與批量操作系統載入失敗，請重新整理。"); };
        document.head.appendChild(script);
    }
    loadV17350InventoryQol();
})();
