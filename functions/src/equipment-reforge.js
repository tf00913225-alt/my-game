/* Sole reforge slot/model owner. Pure reads never migrate saved equipment. */
(function(root,factory){
    const api=factory();
    if(typeof module==="object"&&module.exports){ module.exports=api; }
    else{ root.FourSymbolsEquipmentReforge=api; }
})(typeof window!=="undefined"?window:globalThis,function(){
    "use strict";
    const VERSION=1;
    const STATS=Object.freeze(["attack","intelligence","vitality","energy","defensePoints","agility"]);
    const HISTORICAL=new Set([...STATS,"accuracy","evasion","antiCrit","statusAccuracy","statusResistance","crit","criticalChance","criticalDamage","maxHP","maxSP","defense"]);
    const SLOTS=Object.freeze({white:1,blue:1,purple:2,orange:2,pink:3,"four-symbol":4});
    const TIERS=Object.freeze(Object.fromEntries(Object.keys(SLOTS).map((key,index)=>[key,Object.freeze({range:Object.freeze([5+index*6,10+index*6]),gold:[1000,3000,8000,20000,30000,50000][index],available:index<4})])));
    const ALIASES={low:"white",mid:"blue",high:"purple",perfect:"orange",red:"pink",myriad:"four-symbol"};
    function rarity(item){
        for(const raw of [item?.rarityKey,item?.quality,item?.tierKey,item?.legacyTierKey]){
            const key=ALIASES[raw]||raw;
            if(Object.hasOwn(SLOTS,key)){ return key; }
        }
        return item?.setId?"orange":"white";
    }
    function validAffix(affix){
        return affix!==null&&typeof affix==="object"&&!Array.isArray(affix)&&
            Object.keys(affix).length===2&&HISTORICAL.has(affix.stat)&&
            typeof affix.value==="number"&&Number.isFinite(affix.value)&&Math.abs(affix.value)<=Number.MAX_SAFE_INTEGER;
    }
    function affixes(item){
        if(!item){ return []; }
        if(item.reforgeVersion!==undefined&&item.reforgeVersion!==VERSION){ throw Error("未知冶煉資料版本，請保留原資料"); }
        if(item.reforgeAffixes!==undefined){
            if(!Array.isArray(item.reforgeAffixes)||!item.reforgeAffixes.every(a=>a===null||validAffix(a))){ throw Error("冶煉詞條資料異常，請保留原資料"); }
            return item.reforgeAffixes.map(a=>a===null?null:{...a});
        }
        const legacy=item.reforgeStats;
        if(legacy==null){ return []; }
        if(typeof legacy!=="object"||Array.isArray(legacy)){ throw Error("舊冶煉資料異常，請保留原資料"); }
        const result=Object.entries(legacy).map(([stat,value])=>({stat,value}));
        if(!result.every(validAffix)){ throw Error("舊冶煉詞條無法安全轉換，請保留原資料"); }
        return result;
    }
    function slotCount(item){
        if(!item){ return 0; }
        if(item.reforgeSlots!=null&&(!Number.isSafeInteger(item.reforgeSlots)||item.reforgeSlots<0)){ throw Error("冶煉槽資料異常，請保留原資料"); }
        return Math.max(SLOTS[rarity(item)],item.reforgeSlots||0,affixes(item).length);
    }
    function slots(item){
        const result=affixes(item);
        while(result.length<slotCount(item)){ result.push(null); }
        return result;
    }
    function aggregate(item){
        const result={};
        affixes(item).forEach(a=>{ if(a){ result[a.stat]=(result[a.stat]||0)+a.value; } });
        return result;
    }
    function migrateItem(item){
        const next=slots(item); // Validate everything before writing anything.
        item.reforgeAffixes=next;
        item.reforgeSlots=next.length;
        item.reforgeVersion=VERSION;
        // reforgeStats is retained solely as historical recovery evidence. Readers
        // must use aggregate(), which never adds it to the canonical slot array.
        return item;
    }
    function maxLocks(item){ return Math.min(2,Math.max(0,slotCount(item)-1)); }
    function locks(item,indexes){
        const current=slots(item);
        return [...new Set(indexes||[])].filter(i=>Number.isSafeInteger(i)&&current[i]!=null&&i>=0).slice(0,maxLocks(item));
    }
    function roll(item,tier,indexes,random=Math.random){
        const meta=TIERS[tier];
        if(!meta||!meta.available){ throw Error("此階級冶煉尚未開放"); }
        const current=slots(item),locked=new Set(locks(item,indexes));
        return current.map((a,index)=>{
            if(locked.has(index)){ return {...a}; }
            const stat=STATS[Math.floor(random()*STATS.length)];
            const [min,max]=meta.range;
            const value=random()<.1?max:min+Math.floor(random()*(max-min));
            return {stat,value};
        });
    }
    return Object.freeze({VERSION,STATS,SLOTS,TIERS,rarity,affixes,slots,slotCount,aggregate,migrateItem,maxLocks,locks,roll});
});
