/* Sole equipment instance, identity, ordinary name and price owner.
   Definitions describe content; only create() establishes a new instance.
   Local identity is not proof of server ownership. */
(function(root,factory){
    const api=factory(typeof module==="object"&&module.exports?require("../functions/src/equipment-reforge.js"):root.FourSymbolsEquipmentReforge);
    if(typeof module==="object"&&module.exports){ module.exports=api; }
    else{ root.FourSymbolsEquipmentFactory=api; }
})(typeof window!=="undefined"?window:globalThis,function(reforge){
    "use strict";
    const TYPES=new Set(["weapon","hand","head","helmet","armor","shoes","shoulder","ring","accessory"]);
    const STATS=["attack","intelligence","vitality","energy","defensePoints","agility"];
    const BASE_PRICE={white:500,blue:1500,purple:4000,orange:10000};
    const MIN_STAT={white:5,blue:11,purple:17,orange:23};
    const PREFIXES=["青嵐","寒星","赤霄","玄霜","碧雲","銀羽","蒼雷","暮雪","流光","紫霞","墨竹","孤峰","清泉","燎原","逐風","霜華","雲影","月華","星河","晨曦","玉衡","凌霄","雪松","金麟","白虹","翠微","秋水","夜雨","丹楓","飛鴻","長歌","海棠","天青","煙霞","寒川","曉露","春山","素心","落英","晴空"];
    const STARTERS={
        ironSword:{type:"weapon",classType:"warrior",stats:{attack:3},assetPath:"assets/equipment/warrior/weapon-01.png",price:120},
        woodStaff:{type:"weapon",classType:"mage",stats:{intelligence:3},assetPath:"assets/equipment/mage/weapon-01.png",price:100},
        leatherHelmet:{type:"helmet",classType:"warrior",stats:{vitality:1},assetPath:"assets/equipment/warrior/head-01.png",price:80},
        leatherArmor:{type:"armor",classType:"warrior",stats:{vitality:2},assetPath:"assets/equipment/warrior/armor-01.png",price:150},
        leatherShoes:{type:"shoes",classType:"warrior",stats:{agility:2},assetPath:"assets/equipment/warrior/shoes-01.png",price:90}
    };
    let sequence=0;
    function hash(text){ let n=2166136261; for(const ch of String(text)){n=Math.imul(n^ch.charCodeAt(0),16777619);} return (n>>>0).toString(36); }
    function uid(){
        if(typeof globalThis.crypto?.randomUUID==="function"){ return "gear_"+globalThis.crypto.randomUUID(); }
        return "gear_"+Date.now().toString(36)+"_"+(++sequence).toString(36)+"_"+Math.random().toString(36).slice(2);
    }
    function validUid(value){ return typeof value==="string"&&value.trim().length>0; }
    function suffix(item){
        const mage=item.classType==="mage";
        return ({weapon:mage?(/weapon-(?:03|04)\.png/.test(item.assetPath||"")?"法扇":"法杖"):"戰刃",hand:mage?"法杖":"戰刃",head:mage?"法冠":"戰盔",helmet:mage?"法冠":"戰盔",armor:mage?"法袍":"戰甲",shoes:mage?"法履":"戰靴",shoulder:mage?"法環":"護腕",ring:"玉環",accessory:"玉環"})[item.type];
    }
    function validName(name){ return typeof name==="string"&&/^[\u3400-\u9fff]{3,5}$/.test(name)&&!/(.{1,2})\1/.test(name); }
    function nameFor(item,attempt=0){
        const index=(parseInt(hash(item.v141Uid),36)+attempt)%PREFIXES.length;
        return PREFIXES[index]+suffix(item);
    }
    function art(path){ return path?'<span class="v169-item-art v169-equipment-art"><img src="'+path+'" alt="" draggable="false" onerror="this.parentElement.dataset.assetState=\'broken\';this.parentElement.setAttribute(\'role\',\'img\');this.parentElement.setAttribute(\'aria-label\',\'裝備圖片無法載入\');this.parentElement.textContent=\'◇\'"></span>':""; }
    function mainStat(item){
        const entries=Object.entries(item.stats||{});
        if(entries.length!==1||!STATS.includes(entries[0][0])||!Number.isSafeInteger(entries[0][1])){ throw Error("普通裝備必須只有一條整數基礎主能力"); }
        return entries[0];
    }
    function prices(item){
        if(item.equipmentFactoryVersion===1&&item.ordinaryEquipment===true){
            const [,value]=mainStat(item);
            const starter=STARTERS[item.definitionId];
            // Preserve established tier/starter baselines. No unapproved stat-type
            // economic weights: only a one-gold integer quality increment for now.
            const base=starter?starter.price*5:BASE_PRICE[item.rarityKey];
            const reference=starter?Object.values(starter.stats)[0]:MIN_STAT[item.rarityKey];
            if(!Number.isFinite(base)||!TYPES.has(item.type)){ throw Error("裝備價格資料異常"); }
            const shop=base+value-reference;
            if(!Number.isSafeInteger(shop)||shop<=0){ throw Error("裝備價格超出範圍"); }
            return {shop,sell:Math.floor(shop*.2)};
        }
        // Legacy/special items keep recorded economics until explicitly migrated.
        return {shop:Number(item.shopPrice)||0,sell:Number(item.price)||0};
    }
    function create(definition,options={}){
        if(!definition||!TYPES.has(definition.type)){ throw Error("裝備定義無效"); }
        const identity=options.uid||uid();
        if(!validUid(identity)){ throw Error("裝備 UID 無效"); }
        const ordinary=options.ordinary===true;
        if(ordinary&&!Object.hasOwn(BASE_PRICE,definition.rarityKey||"white")){throw Error("特殊裝備不使用一般生成規則");}
        if(ordinary){mainStat(definition);}
        const item={...definition,id:identity,v141Uid:identity,definitionId:definition.definitionId||definition.id||"ordinary_"+hash(JSON.stringify(definition)),
            count:1,stats:{...definition.stats},equipmentCombatPercentUnitVersion:2,equipmentFactoryVersion:1,
            ordinaryEquipment:ordinary,rarityKey:definition.rarityKey||"white",quality:definition.rarityKey||"white",
            classType:definition.classType||(definition.stats?.intelligence?"mage":"warrior"),
            reforgeStats:null,reforgeUsed:0,reforgeAffixes:[],reforgeVersion:reforge.VERSION};
        if(item.assetPath){item.icon=art(item.assetPath);}
        if(ordinary){ item.name=nameFor(item); }
        reforge.migrateItem(item);
        const price=prices(item); item.shopPrice=price.shop;item.price=price.sell;
        return item;
    }
    function starter(id){const definition=STARTERS[id];if(!definition){throw Error("起始裝備定義不存在");}return create({...definition,id,rarityKey:"white"},{ordinary:true});}
    function migrateItem(item){
        if(!item||!TYPES.has(item.type)){return item;}
        // Never generate stats or erase any recorded reforge result on load.
        const starter=STARTERS[item.definitionId||item.id];
        if(!item.classType&&starter){item.classType=starter.classType;}
        if(!item.rarityKey&&starter){item.rarityKey="white";item.quality="white";}
        if(!item.assetPath&&starter){item.assetPath=starter.assetPath;}
        if(!/<(?:img|svg)\b/i.test(String(item.icon||""))&&item.assetPath){item.icon=art(item.assetPath);}
        if(validUid(item.v141Uid)&&!item.setId&&!validName(item.name)){item.name=nameFor(item);}
        reforge.migrateItem(item);
        return item;
    }
    function migrateGraph(inventory,equipment){
        const refs=[];
        inventory.forEach((item,index)=>{if(item&&TYPES.has(item.type)){refs.push({item,path:"bag:"+index,set:value=>inventory[index]=value,bag:true});}});
        Object.entries(equipment||{}).forEach(([owner,slots])=>Object.entries(slots||{}).forEach(([slot,item])=>{if(item&&TYPES.has(item.type)){refs.push({item,path:owner+":"+slot,set:value=>slots[slot]=value});}}));
        const signature=item=>JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key])=>key!=="v141Uid").sort(([a],[b])=>a.localeCompare(b))));
        const canonical=new Map(),assignments=[],planned=new Map(),seen=new Set();
        for(const ref of refs){
            reforge.slots(ref.item); // Validate before assigning identities/references.
            let item=ref.item;
            if(validUid(item.v141Uid)&&canonical.has(item.v141Uid)){
                const previous=canonical.get(item.v141Uid);
                if(previous!==item&&(ref.bag||signature(previous)!==signature(item))){throw Error("裝備 UID 重複且資料不一致，保留原資料");}
                item=previous;
            }else if(!validUid(item.v141Uid)){
                if(item.v141Uid!=null&&item.v141Uid!==""){throw Error("既有裝備 UID 異常，保留原資料");}
                const matches=!ref.bag?refs.filter(r=>r.bag&&signature(r.item)===signature(item)):[];
                if(matches.length===1){item=matches[0].item;}
                if(!planned.has(item)){planned.set(item,"legacy_"+hash(signature(item)+"|"+ref.path));}
            }
            const identity=item.v141Uid||planned.get(item);
            if(canonical.has(identity)&&canonical.get(identity)!==item){throw Error("裝備 UID 遷移衝突，保留原資料");}
            canonical.set(identity,item);assignments.push([ref,item]);seen.add(item);
        }
        planned.forEach((identity,item)=>{item.v141Uid=identity;});
        assignments.forEach(([ref,item])=>ref.set(item));
        seen.forEach(migrateItem);
        return [...seen];
    }
    function uniqueNames(items){const names=new Set();for(const item of items){let attempt=0;while(names.has(item.name)&&attempt<PREFIXES.length){item.name=nameFor(item,++attempt);}names.add(item.name);}return items;}
    return Object.freeze({create,starter,migrateItem,migrateGraph,prices,validUid,validName,uniqueNames,hash,STARTERS});
});
