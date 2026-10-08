/*
   V141 — synthesis and five-floor Abyss dungeon.
   This layer reuses V132 inventory/dungeon bridges and keeps the legacy combat
   engine intact.
*/
(function installV141ContentSystems(){
    "use strict";

    const ABYSS_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("legacy-abyss-state");
    const TIER_ALIASES={low:"white",mid:"blue",high:"purple",perfect:"orange"};
    const TIER_ORDER=["white","blue","purple","orange","pink","four-symbol"];
    const TALISMAN_TIER_ORDER=["white","blue","purple","orange"];
    const TIER_META={
        white:{label:"白階",available:true,reforgeGold:1000,main:[1,5],reforgeMain:[5,10]},
        blue:{label:"藍階",available:true,reforgeGold:3000,main:[3,8],reforgeMain:[11,16]},
        purple:{label:"紫階",available:true,reforgeGold:8000,main:[5,11],sub:[1,3],reforgeMain:[17,22],reforgeSub:[11,16]},
        orange:{label:"橙階",available:true,reforgeGold:20000,main:[7,14],sub:[2,5],reforgeMain:[23,28],reforgeSub:[11,16]},
        pink:{label:"桃紅階",available:false,planned:true},
        "four-symbol":{label:"四象階",available:false,planned:true}
    };
    function normalizeTierKey(value){
        const key=String(value||"").toLowerCase();
        return TIER_ALIASES[key]||key;
    }
    const SLOT_META={
        head:{label:"頭部",type:"head",glyph:"冠"},
        shoulder:{label:"護腕",type:"shoulder",glyph:"腕"},
        shoes:{label:"鞋子",type:"shoes",glyph:"履"},
        hand:{label:"武器",type:"weapon",glyph:"刃"},
        armor:{label:"衣服",type:"armor",glyph:"甲"}
    };
    const SERIES_DISMANTLE_FRAGMENT_COUNT=10;
    const SERIES=[
        {setId:"setFire",label:"赤炎",element:"fire",color:"#e24b32"},
        {setId:"setWater",label:"寒泉",element:"water",color:"#4bb9e8"},
        {setId:"setEarth",label:"岩岳",element:"earth",color:"#c59a54"},
        {setId:"setWind",label:"青嵐",element:"wind",color:"#55cda3"}
    ];
    const STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",energy:"能量",defensePoints:"防禦",agility:"敏捷",accuracy:"命中",evasion:"閃避",antiCrit:"抗暴",statusAccuracy:"異常命中",statusResistance:"異常抗性"};
    const MAIN_STATS=["attack","intelligence"];
    const SUB_STATS=["vitality","energy","defensePoints","agility","statusResistance"];
    const TALISMAN_GOLD={white:300,blue:1000,purple:3000};
    const synthesisState={
        tab:"talisman",forgeTab:"reforge",socketUid:null,gemId:null,reforgeUid:null,
        reforgeMaterialTier:"white",lockedReforgeKeys:[],
        talismanId:null,talismanQty:1,fragmentQty:{setFire:1,setWater:1,setEarth:1,setWind:1},
        pendingReforge:null
    };
    let activeFeature="synthesis";

    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function definitions(){
        return window.v132GetContentDefinitions?window.v132GetContentDefinitions():{
            talismans:[],ores:[],blueprints:[],tickets:[],equipmentSets:[],equipmentSetItems:[]
        };
    }

    function svgIcon(glyph,color){
        return '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="v141g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2b2116"/><stop offset="1" stop-color="#080706"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="12" fill="url(#v141g)" stroke="'+color+'" stroke-width="3"/><circle cx="32" cy="32" r="19" fill="none" stroke="'+color+'" stroke-opacity=".45" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="'+color+'">'+glyph+'</text></svg>';
    }

    const fragmentDefinitions=SERIES.map(series=>({
        id:"fragment"+series.setId.charAt(0).toUpperCase()+series.setId.slice(1),
        name:series.label+"碎片",type:"material",setId:series.setId,tierKey:"fragment",
        icon:svgIcon("碎",series.color),price:0,stats:{}
    }));
    window.v141GetSeriesFragmentDefinition=setId=>getFragmentDefinition(setId);
    function getFragmentDefinition(setId){ return fragmentDefinitions.find(item=>item.setId===setId)||null; }

    function countItem(itemId){
        return inventoryItems.reduce((sum,item)=>sum+(item&&item.id===itemId?Math.max(0,Number(item.count)||0):0),0);
    }
    function countMatching(predicate){
        return inventoryItems.reduce((sum,item)=>sum+(item&&predicate(item)?Math.max(1,Number(item.count)||1):0),0);
    }
    function consumeMatching(predicate,amount){
        let remaining=Math.max(0,Math.floor(Number(amount)||0));
        if(countMatching(predicate)<remaining){ return false; }
        for(let index=inventoryItems.length-1;index>=0&&remaining>0;index--){
            const item=inventoryItems[index];
            if(!item||!predicate(item)){ continue; }
            const count=Math.max(1,Math.floor(Number(item.count)||1));
            const take=Math.min(count,remaining);
            if(count===take){ inventoryItems.splice(index,1); }
            else{ item.count=count-take; }
            remaining-=take;
        }
        return remaining===0;
    }

    function runInventoryTransaction(operation){
        return window.v132RunInventoryTransaction?window.v132RunInventoryTransaction(operation):!!operation();
    }
    function addItem(definition,amount){
        return !!(window.v132AddItemToInventory&&window.v132AddItemToInventory(definition,amount));
    }

    function makeUid(prefix){
        return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,9);
    }
    function ensureEquipmentUids(){
        let changed=false;
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)&&!item.v141Uid){ item.v141Uid=makeUid("bag"); changed=true; }
        });
        Object.values(characterEquipment||{}).forEach(equipment=>{
            Object.values(equipment||{}).forEach(item=>{
                if(item&&!item.v141Uid){ item.v141Uid=makeUid("equip"); changed=true; }
            });
        });
        if(changed&&typeof saveGame==="function"){ saveGame(); }
    }

    function reforgeSlotCount(item){
        if(!item){ return 0; }
        const value=Number(item.reforgeSlots)||0;
        const explicit=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
        const existing=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;
        const slots=Math.max(explicit,existing);
        return slots;
    }
    function canActuallyReforge(item,explain=false){
        let reason="";
        if(!item||!isEquipmentInventoryType(item.type)){ reason="這不是合法裝備。"; }
        else if(typeof item.v141Uid!=="string"||!item.v141Uid.trim()){ reason="裝備 UID 無效，無法冶煉。"; }
        else if(findEquipmentByUid(item.v141Uid)!==item){ reason="裝備已失效或 UID 重複，無法冶煉。"; }
        else if((item.reforgeSlots!=null&&(!Number.isSafeInteger(Number(item.reforgeSlots))||Number(item.reforgeSlots)<0))||
            (item.reforgeStats!=null&&(typeof item.reforgeStats!=="object"||Array.isArray(item.reforgeStats)||
                Object.entries(item.reforgeStats).some(([key,value])=>!Object.prototype.hasOwnProperty.call(STAT_LABEL,key)||typeof value!=="number"||!Number.isFinite(value))))){ reason="冶煉資料異常，無法冶煉。"; }
        else if(reforgeSlotCount(item)<=0){ reason="這件裝備沒有冶煉槽。"; }
        else if(item.v17351Locked===true){ reason="裝備已鎖定，無法冶煉"; }
        return explain?reason:!reason;
    }
    window.FourSymbolsReforge={canReforge:canActuallyReforge,slotCount:reforgeSlotCount,
        reason:item=>canActuallyReforge(item,true)};
    function reforgeMaterialInfo(tierKey){
        const normalized=normalizeTierKey(tierKey);
        const tier=TIER_META[normalized]?normalized:"white";
        const meta=TIER_META[tier];
        const ore=definitions().ores.find(item=>normalizeTierKey(item.tierKey)===tier)||null;
        const oreCount=ore?countItem(ore.id):0;
        return {tier,meta,ore,oreCount};
    }
    function reforgeMaterialCost(lockCount){
        const locks=Math.max(0,Math.min(2,Math.floor(Number(lockCount)||0)));
        return locks===0?50:(locks===1?100:150);
    }
    function normalizeReforgeLocks(item){
        const current=item&&item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats):[];
        const maxLocks=Math.min(2,Math.max(0,reforgeSlotCount(item)-1));
        synthesisState.lockedReforgeKeys=(synthesisState.lockedReforgeKeys||[])
            .filter(key=>current.includes(key)).slice(0,maxLocks);
        return synthesisState.lockedReforgeKeys;
    }
    function allRefinableEquipment(){
        ensureEquipmentUids();
        const results=[];
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)&&canActuallyReforge(item)){ results.push({item,source:"背包"}); }
        });
        Object.keys(characterEquipment||{}).forEach(characterKey=>{
            Object.values(characterEquipment[characterKey]||{}).forEach(item=>{
                if(item&&isEquipmentInventoryType(item.type)&&canActuallyReforge(item)){ results.push({item,source:"已裝備"}); }
            });
        });
        return results;
    }
    function findEquipmentByUid(uid){
        if(typeof uid!=="string"||!uid.trim()){ return null; }
        const matches=allEquipment().filter(item=>item.v141Uid===uid);
        return matches.length===1?matches[0]:null;
    }

    function socketEquipment(){
        ensureEquipmentUids();
        const result=[];
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)&&window.FourSymbolsEquipmentGems.capacity(item)>0){ result.push({item,source:"背包"}); }
        });
        Object.values(characterEquipment||{}).forEach(slots=>Object.values(slots||{}).forEach(item=>{
            if(item&&window.FourSymbolsEquipmentGems.capacity(item)>0){ result.push({item,source:"已裝備"}); }
        }));
        return result;
    }
    function canUseLocalSockets(){
        // This first-stage operation belongs only to the existing UID-local
        // prototype. An authoritative cloud character must wait for a backend
        // operation; local metadata never grants cloud write authority.
        try{
            const repo=window.FourSymbolsAccountSave;
            if(!repo||typeof repo.readActive!=="function"){ return false; }
            const state=repo.readActive();
            return state.status==="ready"&&state.metadata&&state.metadata.ownerUid===state.uid&&
                state.metadata.cloudBaseFingerprint==null&&state.metadata.source!=="authoritative-cloud-read";
        }catch(_){ return false; }
    }
    function nextSocketIndex(item){
        const capacity=window.FourSymbolsEquipmentGems.capacity(item);
        if(item&&item.sockets!==undefined&&!Array.isArray(item.sockets)){ return -1; }
        const sockets=item&&item.sockets||[];
        const defs=window.FourSymbolsEquipmentGems.definitions;
        if(sockets.length>capacity||sockets.some(id=>id!=null&&
            (typeof id!=="string"||!Object.prototype.hasOwnProperty.call(defs,id)))){ return -1; }
        for(let index=0;index<capacity;index++){
            if(sockets[index]==null){ return index; }
        }
        return -1;
    }
    function renderForgePicker(label,entries,selected,handler){
        const current=entries.find(entry=>entry.value===selected)||entries[0];
        if(!current){ return ""; }
        return '<details class="v141-forge-picker"><summary><span>'+escapeHtml(label)+'</span><b>'+escapeHtml(current.label)+'</b><i aria-hidden="true">▾</i></summary>'+
            '<div class="v141-forge-options" role="group" aria-label="'+escapeHtml(label)+'">'+entries.map(entry=>
                '<button type="button" class="v141-forge-option'+(entry.value===selected?' selected':'')+'" aria-pressed="'+(entry.value===selected)+'" data-forge-value="'+escapeHtml(entry.value)+'" onclick="'+handler+'(this.dataset.forgeValue)">'+
                '<span>'+escapeHtml(entry.label)+'</span><b aria-hidden="true">'+(entry.value===selected?'✓':'')+'</b></button>'
            ).join('')+'</div></details>';
    }
    function renderSocketTab(){
        const entries=socketEquipment();
        if(!entries.length){ return '<div class="v141-synthesis-empty">目前沒有可鑲嵌的橙階以上裝備。</div>'; }
        if(!entries.some(entry=>entry.item.v141Uid===synthesisState.socketUid)){ synthesisState.socketUid=entries[0].item.v141Uid; }
        const item=entries.find(entry=>entry.item.v141Uid===synthesisState.socketUid).item;
        const capacity=window.FourSymbolsEquipmentGems.capacity(item);
        const sockets=Array.isArray(item.sockets)?item.sockets.slice(0,capacity):[];
        const defs=window.FourSymbolsEquipmentGems.definitions;
        const gems=inventoryItems.filter(candidate=>candidate&&typeof candidate.id==="string"&&Object.prototype.hasOwnProperty.call(defs,candidate.id)&&Number(candidate.count)>0);
        if(!gems.some(gem=>gem.id===synthesisState.gemId)){ synthesisState.gemId=gems[0]&&gems[0].id||null; }
        const available=nextSocketIndex(item)>=0;
        const local=canUseLocalSockets();
        return '<div class="v141-synthesis-card v141-socket-card">'+
            renderForgePicker('選擇裝備',entries.map(entry=>({value:entry.item.v141Uid,label:entry.item.name+'［'+entry.source+'］'})),synthesisState.socketUid,'v141SelectSocketItem')+
            '<div class="v141-socket-list" aria-label="鑲嵌孔">'+Array.from({length:capacity},(_,index)=>{
                const id=sockets[index];
                const gem=typeof id==="string"&&Object.prototype.hasOwnProperty.call(defs,id)?defs[id]:null;
                const unknown=id!=null&&!gem;
                return '<div class="v141-socket"><span aria-hidden="true">'+(gem?escapeHtml(gem.icon):'◇')+'</span><b>'+(gem?escapeHtml(gem.name):unknown?'無法識別':'空孔')+'</b><small>'+(gem?statsHtml(gem.stats):unknown?'請保留原資料':'可鑲嵌')+'</small></div>';
            }).join('')+'</div>'+
            (gems.length?renderForgePicker('選擇寶石',gems.map(gem=>({value:gem.id,label:defs[gem.id].name+' ×'+Math.floor(Number(gem.count))+'（'+Object.entries(defs[gem.id].stats).map(([key,value])=>(STAT_LABEL[key]||key)+' +'+value).join('、')+'）'})),synthesisState.gemId,'v141SelectSocketGem'):'<p>背包沒有可鑲嵌的寶石。</p>')+
            (!local?'<p>目前角色尚未開放鑲嵌。</p>':!available?'<p>孔位已滿或孔位資料無法使用。</p>':'')+
            '<button type="button" class="v141-synthesis-primary" '+(gems.length&&available&&local?'':'disabled')+' onclick="v141SocketGem()">鑲嵌寶石</button></div>';
    }

    function inferTier(item){
        const declared=normalizeTierKey(item&&item.tierKey);
        if(TIER_META[declared]){ return declared; }
        if(item&&item.setId){ return "orange"; }
        const total=Object.values(item&&item.stats||{}).reduce((sum,value)=>sum+Math.abs(Number(value)||0),0);
        if(total>=18){ return "orange"; }
        if(total>=10){ return "purple"; }
        if(total>=5){ return "blue"; }
        return "white";
    }

    function rollUniform(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
    function rollSinglePeak(range){
        return Math.random()<.10?range[1]:rollUniform(range[0],Math.max(range[0],range[1]-1));
    }
    function rollAffixes(tierKey,isReforge){
        const tier=normalizeTierKey(tierKey);
        const meta=TIER_META[tier];
        if(!meta||meta.available===false||!Array.isArray(meta.main)){ throw new Error("此階級尚未開放數值設定："+tier); }
        const mainRange=isReforge?meta.reforgeMain:meta.main;
        const subRange=isReforge?meta.reforgeSub:meta.sub;
        const stats={};
        const main=MAIN_STATS[Math.floor(Math.random()*MAIN_STATS.length)];
        if(!subRange){ stats[main]=rollSinglePeak(mainRange); return stats; }
        const sub=SUB_STATS[Math.floor(Math.random()*SUB_STATS.length)];
        if(Math.random()<.05){
            stats[main]=mainRange[1];
            stats[sub]=subRange[1];
            return stats;
        }
        let mainValue=rollUniform(mainRange[0],mainRange[1]);
        let subValue=rollUniform(subRange[0],subRange[1]);
        if(mainValue===mainRange[1]&&subValue===subRange[1]){
            if(Math.random()<.5){ mainValue=rollUniform(mainRange[0],Math.max(mainRange[0],mainRange[1]-1)); }
            else{ subValue=rollUniform(subRange[0],Math.max(subRange[0],subRange[1]-1)); }
        }
        stats[main]=mainValue;
        stats[sub]=subValue;
        return stats;
    }
    window.v141RollCraftAffixes=rollAffixes;

    function reforgeRangeForSlot(tierKey,slotIndex){
        const meta=TIER_META[normalizeTierKey(tierKey)];
        if(!meta||meta.available===false||!Array.isArray(meta.reforgeMain)){ return null; }
        if(slotIndex<=0){ return meta.reforgeMain; }
        return meta.reforgeSub||null;
    }
    function reforgeRangeText(tierKey,slotCount){
        const meta=TIER_META[normalizeTierKey(tierKey)]||TIER_META.white;
        if(meta.available===false||!Array.isArray(meta.reforgeMain)){ return "尚未開放・數值待定"; }
        const main=meta.reforgeMain;
        const sub=meta.reforgeSub;
        if(!sub){ return "主槽 "+main[0]+"～"+main[1]+"・無副屬性"; }
        return slotCount<=1
            ?"詞條 "+main[0]+"～"+main[1]
            :"主槽 "+main[0]+"～"+main[1]+"・其餘槽 "+sub[0]+"～"+sub[1];
    }
    function rollReforgeAffixes(item,tierKey,lockedKeys){
        const slots=reforgeSlotCount(item);
        const current=item&&item.reforgeStats&&typeof item.reforgeStats==="object"?item.reforgeStats:{};
        const result={};
        const used=new Set();
        const locks=(lockedKeys||[]).filter(key=>Object.prototype.hasOwnProperty.call(current,key)).slice(0,Math.min(2,Math.max(0,slots-1)));
        locks.forEach(key=>{ result[key]=current[key]; used.add(key); });
        const meta=TIER_META[normalizeTierKey(tierKey)];
        if(!meta||meta.available===false){ throw new Error("此階級冶煉尚未開放"); }
        const unlockedCount=Math.max(0,slots-locks.length);
        const forceDualPeak=locks.length===0&&slots>=2&&!!meta.reforgeSub&&Math.random()<.05;
        let generated=0;
        while(Object.keys(result).length<slots){
            const needMain=!Array.from(used).some(key=>MAIN_STATS.includes(key));
            const slotIndex=needMain?0:Math.max(1,Object.keys(result).length);
            const range=reforgeRangeForSlot(tierKey,slotIndex);
            if(!range){ break; }
            let pool=needMain?MAIN_STATS:SUB_STATS;
            let available=pool.filter(key=>!used.has(key));
            if(!available.length){ available=MAIN_STATS.concat(SUB_STATS).filter(key=>!used.has(key)); }
            if(!available.length){ break; }
            const key=available[Math.floor(Math.random()*available.length)%available.length];
            let value;
            if(forceDualPeak&&generated<2){ value=range[1]; }
            else if(!meta.reforgeSub||slots===1){ value=rollSinglePeak(range); }
            else{ value=rollUniform(range[0],range[1]); }
            result[key]=value;
            used.add(key);
            generated++;
        }
        if(!forceDualPeak&&locks.length===0&&slots>=2&&meta.reforgeSub){
            const mainKey=Object.keys(result).find(key=>MAIN_STATS.includes(key));
            const subKey=Object.keys(result).find(key=>SUB_STATS.includes(key));
            if(mainKey&&subKey&&result[mainKey]===meta.reforgeMain[1]&&result[subKey]===meta.reforgeSub[1]){
                if(Math.random()<.5){ result[mainKey]=rollUniform(meta.reforgeMain[0],Math.max(meta.reforgeMain[0],meta.reforgeMain[1]-1)); }
                else{ result[subKey]=rollUniform(meta.reforgeSub[0],Math.max(meta.reforgeSub[0],meta.reforgeSub[1]-1)); }
            }
        }
        return result;
    }
    window.v17358RollReforgeAffixes=rollReforgeAffixes;

    function statsHtml(stats){
        const entries=Object.entries(stats||{});
        if(!entries.length){ return '<span class="muted">尚無冶煉詞條</span>'; }
        return entries.map(([key,value])=>'<span>'+escapeHtml(STAT_LABEL[key]||key)+' <b>+'+value+(["accuracy","evasion"].includes(key)?"%":"")+'</b></span>').join("");
    }
    function rangeText(tierKey,isReforge){
        const meta=TIER_META[normalizeTierKey(tierKey)];
        if(!meta||meta.available===false){ return "尚未開放・數值待定"; }
        const main=isReforge?meta.reforgeMain:meta.main;
        const sub=isReforge?meta.reforgeSub:meta.sub;
        return '主詞條 '+main[0]+'～'+main[1]+(sub?'・副詞條 '+sub[0]+'～'+sub[1]:'');
    }

    function showSynthesisResult(title,body){
        const modal=document.getElementById("homeFeatureModal");
        if(modal){
            modal.classList.add("v141-crafting-flash");
            setTimeout(()=>modal.classList.remove("v141-crafting-flash"),650);
        }
        setTimeout(()=>{
            if(window.v132ShowRewardModal){
                window.v132ShowRewardModal(
                    '<div class="v132-reward-modal-inner"><h3>'+escapeHtml(title)+'</h3>'+body+
                    '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">確定</button></div></div>'
                );
            }
        },480);
    }

    function renderSynthesisTabs(){
        const tabs=[
            ["talisman","符咒合成"],["fragment","碎片合成"],["material","材料合成"]
        ];
        return '<div class="v141-synthesis-tabs">'+tabs.map(([id,label])=>
            '<button type="button" class="'+(synthesisState.tab===id?'active':'')+'" onclick="v141SwitchSynthesisTab(\''+id+'\')">'+label+'</button>'
        ).join("")+'</div>';
    }

    function renderReforgeTab(){
        const entries=allRefinableEquipment();
        if(synthesisState.reforgeUid===null&&entries.length){
            synthesisState.reforgeUid=entries[0].item.v141Uid;
            synthesisState.lockedReforgeKeys=[];
        }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!canActuallyReforge(item)){
            const reason=item?canActuallyReforge(item,true):synthesisState.reforgeUid?"裝備已失效或 UID 重複，請重新選擇裝備。":"沒有可冶煉的裝備。";
            return '<div class="v141-synthesis-empty">'+escapeHtml(reason)+
                '<small>只有具備至少 1 個冶煉槽、且未鎖定的裝備會出現在這裡。</small>'+
                renderForgePicker('選擇裝備',entries.map(entry=>({value:entry.item.v141Uid,label:entry.item.name+'［'+entry.source+'］'})),synthesisState.reforgeUid,'v141SelectReforgeItem')+
                (synthesisState.pendingReforge?'<button type="button" onclick="v141ResolveReforge(false)">保留原效果</button>':'')+'</div>';
        }
        const slotCount=reforgeSlotCount(item);
        const locks=normalizeReforgeLocks(item);
        const lockSet=new Set(locks);
        const maxLocks=Math.min(2,Math.max(0,slotCount-1));
        const requestedTier=normalizeTierKey(synthesisState.reforgeMaterialTier);
        const tier=TIER_META[requestedTier]&&TIER_META[requestedTier].available!==false?requestedTier:"white";
        synthesisState.reforgeMaterialTier=tier;
        const material=reforgeMaterialInfo(tier);
        const materialCost=reforgeMaterialCost(locks.length);
        const currentEntries=Object.entries(item.reforgeStats||{});
        const can=material.meta.available!==false&&!!material.ore&&material.oreCount>=materialCost&&gold>=material.meta.reforgeGold&&slotCount>locks.length;
        let compare="";
        if(synthesisState.pendingReforge&&synthesisState.pendingReforge.uid===item.v141Uid){
            const pending=synthesisState.pendingReforge;
            const pendingLabel=(TIER_META[pending.materialTier]||material.meta).label;
            compare='<div class="v141-reforge-compare"><section><small>目前冶煉效果</small>'+statsHtml(item.reforgeStats)+'</section><b>VS</b><section><small>本次新效果・'+pendingLabel+'材料</small>'+statsHtml(pending.stats)+'</section>'+
                '<div><button onclick="v141ResolveReforge(false)">保留原效果</button><button onclick="v141ResolveReforge(true)">套用新效果</button></div></div>';
        }
        const tierButtons=TIER_ORDER.map(key=>{
            const info=reforgeMaterialInfo(key);
            const unavailable=info.meta.available===false;
            return '<button type="button" class="v17358-reforge-tier '+(key===tier?'active ':'')+(unavailable?'planned':'')+'" '+
                (unavailable?'disabled aria-disabled="true"':'onclick="v141SelectReforgeMaterialTier(\''+key+'\')"')+'>'+
                '<b>'+info.meta.label+'材料</b><span>'+(unavailable?'尚未開放':'礦石 '+info.oreCount)+'</span><small>'+reforgeRangeText(key,slotCount)+'</small></button>';
        }).join("");
        const lockHtml=currentEntries.length
            ?currentEntries.map(([key,value])=>{
                const selected=lockSet.has(key);
                return '<button type="button" class="v17358-affix-lock '+(selected?'locked':'')+'" '+(synthesisState.pendingReforge?'disabled':'')+' onclick="v141ToggleReforgeLock(\''+escapeHtml(key)+'\')">'+
                    '<span>'+(selected?'🔒':'◇')+'</span><b>'+escapeHtml(STAT_LABEL[key]||key)+' +'+value+(["accuracy","evasion"].includes(key)?"%":"")+'</b><small>'+(selected?'已鎖定':'點擊鎖定')+'</small></button>';
            }).join("")
            :'<div class="v17358-no-affix-lock">首次冶煉尚無詞條可鎖定。</div>';
        return '<div class="v141-synthesis-card v17358-reforge-card">'+
            renderForgePicker('選擇裝備',entries.map(entry=>({value:entry.item.v141Uid,label:entry.item.name+'［'+entry.source+'］'})),synthesisState.reforgeUid,'v141SelectReforgeItem')+
            '<section class="v141-reforge-current"><b>'+escapeHtml(item.name)+'</b><small>冶煉槽 '+slotCount+' 格・可不限次數重洗</small><div><em>原始詞條</em>'+statsHtml(item.stats)+'</div><div><em>目前冶煉</em>'+statsHtml(item.reforgeStats)+'</div></section>'+
            '<section class="v17358-reforge-material"><div class="v17358-section-title"><b>選擇冶煉材料階級</b><span>裝備品質不限制材料；材料階級只決定本次數值範圍。</span></div><div class="v17358-reforge-tiers">'+tierButtons+'</div></section>'+
            '<section class="v17358-reforge-lock-panel"><div class="v17358-section-title"><b>鎖定詞條</b><span>最多鎖 2 條，且至少保留 1 個槽位重新冶煉。</span></div><div class="v17358-reforge-lock-list">'+lockHtml+'</div><small>目前鎖定 '+locks.length+' / '+maxLocks+' 條</small></section>'+
            '<div class="v141-material-lines v17358-reforge-cost">'+
            '<span>'+escapeHtml(material.ore&&material.ore.name||material.meta.label+'礦石')+' <b class="'+(material.oreCount>=materialCost?'ok':'lack')+'">'+material.oreCount+' / '+materialCost+'</b></span>'+
            '<span>金幣 <b class="'+(gold>=material.meta.reforgeGold?'ok':'lack')+'">'+material.meta.reforgeGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<div class="v17358-reforge-cost-note">礦石消耗：未鎖定 50・鎖 1 條 100・鎖 2 條 150</div>'+
            '<button type="button" class="v141-synthesis-primary" '+(can&&!synthesisState.pendingReforge?'':'disabled')+' onclick="v141StartReforge()">開始冶煉</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">ⓘ 冶煉規則</button>'+compare+'</div>';
    }

    function availableTalismans(){
        return definitions().talismans.filter(item=>TALISMAN_TIER_ORDER.slice(0,3).includes(normalizeTierKey(item.tierKey))&&countItem(item.id)>0);
    }
    function nextTalisman(source){
        if(!source){ return null; }
        const sourceTier=normalizeTierKey(source.tierKey);
        const nextTier=TALISMAN_TIER_ORDER[TALISMAN_TIER_ORDER.indexOf(sourceTier)+1];
        return definitions().talismans.find(item=>item.talismanEffect===source.talismanEffect&&normalizeTierKey(item.tierKey)===nextTier)||null;
    }
    function allEquipment(){
        const result=[];
        (inventoryItems||[]).forEach(item=>{ if(item&&item.v141Uid){ result.push(item); } });
        Object.values(typeof characterEquipment!=="undefined"&&characterEquipment||{}).forEach(slots=>
            Object.values(slots||{}).forEach(item=>{ if(item&&item.v141Uid){ result.push(item); } })
        );
        return result;
    }
    function iconForPickerValue(value){
        const content=definitions();
        const canonical=[content.talismans,content.ores,content.blueprints,content.tickets,content.equipmentSetItems].filter(Array.isArray).flat().find(item=>item&&item.id===value);
        const item=canonical||(inventoryItems||[]).find(candidate=>candidate&&(candidate.id===value||candidate.v141Uid===value))||allEquipment().find(candidate=>candidate.v141Uid===value);
        if(item&&item.assetPath){
            const rarity=escapeHtml(normalizeTierKey(item.rarityKey||item.quality||item.tierKey||"white"));
            return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+'"><img src="'+escapeHtml(item.assetPath)+'" alt="" draggable="false" decoding="async"></span>';
        }
        return item&&item.icon?item.icon:svgIcon("物","#caa461");
    }

    function renderItemPicker(label,entries,selected,handler){
        return '<div class="v141-picker-field"><span>'+escapeHtml(label)+'</span><div class="v143-item-picker" role="group" aria-label="'+escapeHtml(label)+'">'+entries.map(entry=>
            '<button type="button" class="'+(entry.value===selected?'selected':'')+'" aria-pressed="'+(entry.value===selected)+'" aria-label="'+escapeHtml(entry.label)+'" title="'+escapeHtml(entry.label)+'" data-picker-value="'+escapeHtml(entry.value)+'" onclick="'+handler+'(this.dataset.pickerValue)"><i>'+iconForPickerValue(entry.value)+'</i></button>'
        ).join('')+'</div></div>';
    }

    function renderTalismanTab(){
        const list=availableTalismans();
        if(!list.length){ return '<div class="v141-synthesis-empty">沒有可升階的白／藍／紫階符咒。</div>'; }
        if(!list.some(item=>item.id===synthesisState.talismanId)){ synthesisState.talismanId=list[0].id; synthesisState.talismanQty=1; }
        const source=list.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        const owned=countItem(source.id);
        const max=Math.min(Math.floor(owned/3),Math.floor(gold/TALISMAN_GOLD[normalizeTierKey(source.tierKey)]));
        synthesisState.talismanQty=Math.max(1,Math.min(Math.max(1,max),synthesisState.talismanQty));
        const qty=synthesisState.talismanQty;
        const can=max>=qty&&target;
        return '<div class="v141-synthesis-card v141-talisman-craft">'+
            renderItemPicker('選擇符咒',list.map(item=>({value:item.id,label:item.name+'（'+countItem(item.id)+'）'})),source.id,'v141SelectTalisman')+
            '<div class="v141-upgrade-flow"><section class="v141-talisman-source" aria-label="合成材料">'+source.icon+'<b>'+escapeHtml(source.name)+' ×'+(qty*3)+'</b></section><i aria-hidden="true">→</i><section class="v141-talisman-target" aria-label="合成目標">'+target.icon+'<b>'+escapeHtml(target.name)+' ×'+qty+'</b></section></div>'+
            '<div class="v141-quantity"><button onclick="v141AdjustTalismanQty(-1)">－</button><strong>'+qty+'</strong><button onclick="v141AdjustTalismanQty(1)">＋</button><button onclick="v141AdjustTalismanQty(\'max\')">MAX</button></div>'+
            '<div class="v141-material-lines"><span>持有 '+owned+'</span><span>消耗 '+(qty*3)+'</span><span>金幣 '+(TALISMAN_GOLD[normalizeTierKey(source.tierKey)]*qty).toLocaleString('zh-TW')+'</span></div>'+
            '<button class="v141-synthesis-primary" '+(can?'':'disabled')+' onclick="v141CraftTalismans()">開始合成</button></div>';
    }

    function renderFragmentTab(){
        const data=definitions();
        return '<div class="v141-fragment-list">'+SERIES.map(series=>{
            const fragment=getFragmentDefinition(series.setId);
            const count=countItem(fragment.id);
            const max=Math.min(Math.floor(count/100),Math.floor(gold/500));
            const qty=Math.max(1,Math.min(Math.max(1,max),synthesisState.fragmentQty[series.setId]||1));
            synthesisState.fragmentQty[series.setId]=qty;
            return '<section class="v141-fragment-row"><div class="v141-fragment-icon">'+fragment.icon+'</div><div class="v141-fragment-main"><b>'+series.label+'碎片</b><span>'+count+' / 100</span><div class="v141-fragment-progress"><i style="width:'+Math.min(100,count)+'%"></i></div></div>'+
                '<div class="v141-fragment-controls"><div><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',-1)">－</button><strong>'+qty+'</strong><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',1)">＋</button><button onclick="v141AdjustFragmentQty(\''+series.setId+'\',\'max\')">MAX</button></div>'+
                '<button '+(max>=qty?'':'disabled')+' onclick="v141CraftFragmentTicket(\''+series.setId+'\')">合成抽獎券<br><small>500金幣／張</small></button></div></section>';
        }).join('')+'</div>';
    }

    const MATERIAL_STATE={oreTier:"white"};
    const MATERIAL_TIER_LABEL={white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"};
    function materialOwnedCount(id){
        return inventoryItems.reduce((sum,item)=>sum+(item&&item.id===id?Math.max(1,Math.floor(Number(item.count)||1)):0),0);
    }
    function refreshMaterialInventory(){
        if(typeof window.v17361SyncItemArt==="function"){try{window.v17361SyncItemArt();}catch(_){}}
        if(typeof rebuildInventorySlots==="function"){try{rebuildInventorySlots();}catch(_){}}
        if(typeof renderInventoryItems==="function"){try{renderInventoryItems();}catch(_){}}
        else if(typeof renderInventory==="function"){try{renderInventory();}catch(_){}}
        if(typeof updateGoldDisplay==="function"){try{updateGoldDisplay();}catch(_){}}
        if(typeof saveGame==="function"){try{saveGame();}catch(_){}}
    }

    /* ---------- 9. Material synthesis helpers. ---------- */
    function oreByTier(tier){return definitions().ores.find(item=>normalizeTierKey(item&&item.tierKey)===tier)||null;}
    function canAdd(definition,amount){return !window.v132CanAddItemToInventory||window.v132CanAddItemToInventory(definition,amount);}

    /* ---------- 10. Material promotion: 50 same-tier -> 10 next-tier. ---------- */
    function nextTier(tier){const index=TIER_ORDER.indexOf(normalizeTierKey(tier));return index>=0&&index<TIER_ORDER.length-1?TIER_ORDER[index+1]:null;}
    function tierChoices(){
        return TIER_ORDER.slice(0,-1).map(tier=>({value:tier,label:MATERIAL_TIER_LABEL[tier]+" → "+MATERIAL_TIER_LABEL[nextTier(tier)],tier}));
    }
    function materialGameSelect(key,label,choices,selected){
        const normalized=(choices||[]).map(choice=>Array.isArray(choice)?{value:String(choice[0]),label:String(choice[1])}:{value:String(choice.value),label:String(choice.label),tier:choice.tier});
        const current=normalized.find(choice=>choice.value===String(selected))||normalized[0]||{value:"",label:"未設定"};
        const dot=current.tier?'<i class="v17363-menu-rarity-dot '+escapeHtml(current.tier)+'"></i>':'';
        return '<div class="v17363-material-field"><span class="v17363-material-field-label">'+escapeHtml(label)+'</span><div class="v17363-game-select" data-material-key="'+escapeHtml(key)+'">'+
            '<button class="v17363-game-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" onclick="v17363ToggleMaterialMenu(this)">'+dot+'<span>'+escapeHtml(current.label)+'</span><b aria-hidden="true">▾</b></button>'+
            '<div class="v17363-game-select-menu" role="listbox">'+normalized.map(choice=>'<button class="v17363-game-select-option'+(choice.value===current.value?' selected':'')+'" type="button" role="option" aria-selected="'+(choice.value===current.value?'true':'false')+'" data-material-key="'+escapeHtml(key)+'" data-material-value="'+escapeHtml(choice.value)+'" onclick="v17363ChooseMaterialOption(this.dataset.materialKey,this.dataset.materialValue)">'+(choice.tier?'<i class="v17363-menu-rarity-dot '+escapeHtml(choice.tier)+'"></i>':'<i class="v17363-menu-rarity-dot neutral"></i>')+'<span>'+escapeHtml(choice.label)+'</span><b aria-hidden="true">'+(choice.value===current.value?'✓':'')+'</b></button>').join("")+'</div></div></div>';
    }
    function renderMaterialSynthesis(){
        const oreSource=oreByTier(MATERIAL_STATE.oreTier),oreTarget=oreByTier(nextTier(MATERIAL_STATE.oreTier));
        return '<div class="v17363-material-synthesis">'+
            '<section class="v17363-material-card"><h4>礦石升階</h4><p>同階礦石 50 個，可合成下一階礦石 10 個；最高可合至四象階。</p><div class="v17363-material-controls single">'+materialGameSelect("oreTier","升階路線",tierChoices(),MATERIAL_STATE.oreTier)+'</div>'+materialFlow(oreSource,oreTarget)+
            '<button class="v17363-craft-button" type="button" '+(!oreSource||materialOwnedCount(oreSource.id)<50?'disabled':'')+' onclick="v17363CraftMaterial(&quot;ore&quot;)">合成下一階礦石 ×10</button></section></div>';
    }
    function materialFlow(source,target){
        const sourceCount=source?materialOwnedCount(source.id):0;
        return '<div class="v17363-material-flow"><section>'+(source&&source.icon||'')+'<b>'+escapeHtml(source&&source.name||"來源未建立")+'</b><span>'+sourceCount+' / 50</span></section><i>→</i><section>'+(target&&target.icon||'')+'<b>'+escapeHtml(target&&target.name||"已達最高階")+'</b><span>×10</span></section></div>';
    }
    window.v17363ToggleMaterialMenu=function(trigger){
        const root=trigger&&trigger.closest&&trigger.closest(".v17363-game-select");if(!root){return;}
        const opening=!root.classList.contains("open");
        document.querySelectorAll(".v17363-game-select.open").forEach(item=>{item.classList.remove("open");const button=item.querySelector(".v17363-game-select-trigger");if(button){button.setAttribute("aria-expanded","false");}});
        root.classList.toggle("open",opening);trigger.setAttribute("aria-expanded",opening?"true":"false");
    };
    window.v17363ChooseMaterialOption=function(key,value){
        if(!Object.prototype.hasOwnProperty.call(MATERIAL_STATE,key)){return;}
        MATERIAL_STATE[key]=String(value||"");renderSynthesis();
    };
    window.v17363SetMaterialOption=window.v17363ChooseMaterialOption;
    const functionalModalRoot=document.getElementById("homeFeatureModal");
    if(functionalModalRoot){functionalModalRoot.addEventListener("click",event=>{
        functionalModalRoot.querySelectorAll(".v17363-game-select.open").forEach(root=>{if(root.contains(event.target)){return;}root.classList.remove("open");const button=root.querySelector(".v17363-game-select-trigger");if(button){button.setAttribute("aria-expanded","false");}});
    });}
    window.v17363CraftMaterial=function(kind){
        if(kind!=="ore"){return false;}
        const tier=MATERIAL_STATE.oreTier;
        const targetTier=nextTier(tier);
        const source=oreByTier(tier);
        const target=oreByTier(targetTier);
        if(!source||!target||!targetTier){alert("此道具已達最高可合成階級。");return false;}
        if(materialOwnedCount(source.id)<50){alert("素材不足，需要「"+source.name+"」×50。");return false;}
        if(!canAdd(target,10)){alert("背包空間不足，無法放入合成結果。");return false;}
        const transaction=window.v132RunInventoryTransaction||function(operation){return !!operation();};
        const success=transaction(()=>window.v132ConsumeStackItem&&window.v132ConsumeStackItem(source.id,50)&&addItem(target,10));
        if(!success){alert("材料合成失敗，素材已自動還原。");return false;}
        refreshMaterialInventory();
        renderSynthesis();
        if(typeof window.rpgAlert==="function"){void window.rpgAlert("消耗「"+source.name+"」×50\n獲得「"+target.name+"」×10",{title:"材料合成成功",confirmText:"知道了",tone:"success"});}
        return true;
    };

    function renderSynthesis(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        if(typeof window.v17346SyncFourElementSets==="function"){ window.v17346SyncFourElementSets(); }
        const forge=activeFeature==="forge";
        const renderers=forge?{reforge:renderReforgeTab,socket:renderSocketTab}:{talisman:renderTalismanTab,fragment:renderFragmentTab,material:renderMaterialSynthesis};
        const tab=forge?synthesisState.forgeTab:synthesisState.tab;
        const content=renderers[tab]();
        const tabs=forge?'<div class="v141-synthesis-tabs v141-forge-tabs"><button type="button" class="'+(tab==="reforge"?'active':'')+'" onclick="v141SwitchForgeTab(\'reforge\')">冶煉</button><button type="button" class="'+(tab==="socket"?'active':'')+'" onclick="v141SwitchForgeTab(\'socket\')">鑲嵌</button></div>':renderSynthesisTabs();
        body.innerHTML='<div class="v141-synthesis"><div class="v141-synthesis-wallet"><span>'+(forge?'鍛造':'合成')+'</span><b>金幣 '+Math.floor(gold).toLocaleString('zh-TW')+'</b></div>'+tabs+'<div class="v141-synthesis-body">'+content+'</div></div>';
    }
    window.v141RenderSynthesis=renderSynthesis;
    window.v141SwitchForgeTab=function(tab){
        if(synthesisState.pendingReforge){ return; }
        synthesisState.forgeTab=tab==="socket"?"socket":"reforge";
        renderSynthesis();
    };
    window.v141SelectSocketItem=function(uid){ synthesisState.socketUid=uid; renderSynthesis(); };
    window.v141SelectSocketGem=function(id){ synthesisState.gemId=id; renderSynthesis(); };
    window.v141SocketGem=function(){
        if(activeFeature!=="forge"||synthesisState.pendingReforge||!canUseLocalSockets()){ return false; }
        const candidates=socketEquipment().filter(entry=>entry.item.v141Uid===synthesisState.socketUid);
        if(candidates.length!==1){ return false; }
        const item=candidates[0].item;
        const index=nextSocketIndex(item);
        const gem=window.FourSymbolsEquipmentGems.definitions[synthesisState.gemId];
        const sockets=Array.isArray(item&&item.sockets)?item.sockets:[];
        if(index<0||!Object.prototype.hasOwnProperty.call(window.FourSymbolsEquipmentGems.definitions,synthesisState.gemId)||!gem||countItem(gem.id)<1){ return false; }
        const hadSockets=Object.prototype.hasOwnProperty.call(item,"sockets");
        const previousSockets=item.sockets;
        const next=sockets.slice();
        next[index]=gem.id;
        const success=runInventoryTransaction(()=>{
            if(!window.v132ConsumeStackItem(gem.id,1)){ return false; }
            item.sockets=next;
            return saveGame()!==false;
        });
        if(!success){
            if(hadSockets){ item.sockets=previousSockets; }else{ delete item.sockets; }
            rebuildInventorySlots(); renderSynthesis();
            return false;
        }
        rebuildInventorySlots(); updateUI(); renderSynthesis();
        return true;
    };
    window.v141SwitchSynthesisTab=function(tab){
        synthesisState.tab=["talisman","fragment","material"].includes(tab)?tab:"talisman";
        synthesisState.pendingReforge=null;
        renderSynthesis();
    };
    window.v141SelectReforgeItem=function(uid){
        if(synthesisState.pendingReforge){ return; }
        const item=findEquipmentByUid(uid);
        if(!canActuallyReforge(item)){
            synthesisState.reforgeUid=typeof uid==="string"?uid:"";
            synthesisState.lockedReforgeKeys=[];
            renderSynthesis();
            alert(item?canActuallyReforge(item,true):"裝備已失效或 UID 重複，請重新選擇裝備。");
            return false;
        }
        synthesisState.reforgeUid=uid;
        synthesisState.lockedReforgeKeys=[];
        renderSynthesis();
    };
    window.v141SelectReforgeMaterialTier=function(tier){
        const normalized=normalizeTierKey(tier);
        if(!TIER_META[normalized]||TIER_META[normalized].available===false||synthesisState.pendingReforge){ return; }
        synthesisState.reforgeMaterialTier=normalized;
        renderSynthesis();
    };
    window.v141ToggleReforgeLock=function(key){
        if(synthesisState.pendingReforge){ return; }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||!Object.prototype.hasOwnProperty.call(item.reforgeStats||{},key)){ return; }
        const locks=normalizeReforgeLocks(item).slice();
        const at=locks.indexOf(key);
        if(at>=0){ locks.splice(at,1); }
        else{
            const maxLocks=Math.min(2,Math.max(0,reforgeSlotCount(item)-1));
            if(locks.length>=maxLocks){
                alert(maxLocks<=0?"這件裝備只有 1 個冶煉槽，不能把唯一詞條鎖住。":"至少要保留 1 個未鎖定槽位才能重新冶煉。");
                return;
            }
            locks.push(key);
        }
        synthesisState.lockedReforgeKeys=locks;
        renderSynthesis();
    };
    window.v141SelectTalisman=function(id){ synthesisState.talismanId=id; synthesisState.talismanQty=1; renderSynthesis(); };

    window.v141AdjustTalismanQty=function(change){
        const source=definitions().talismans.find(item=>item.id===synthesisState.talismanId);
        if(!source){ return; }
        const max=Math.min(Math.floor(countItem(source.id)/3),Math.floor(gold/TALISMAN_GOLD[normalizeTierKey(source.tierKey)]));
        synthesisState.talismanQty=change==="max"?Math.max(1,max):Math.max(1,Math.min(Math.max(1,max),synthesisState.talismanQty+Number(change)));
        renderSynthesis();
    };
    window.v141AdjustFragmentQty=function(setId,change){
        const count=countItem(getFragmentDefinition(setId).id);
        const max=Math.min(Math.floor(count/100),Math.floor(gold/500));
        const current=synthesisState.fragmentQty[setId]||1;
        synthesisState.fragmentQty[setId]=change==="max"?Math.max(1,max):Math.max(1,Math.min(Math.max(1,max),current+Number(change)));
        renderSynthesis();
    };

    window.v141ShowAffixInfo=function(){
        const lines=TIER_ORDER.map(tier=>{
            const meta=TIER_META[tier];
            const cost=meta.available===false?'尚未開放・數值待定':'金幣 '+meta.reforgeGold.toLocaleString('zh-TW');
            return '<div><b>'+meta.label+'材料</b>　'+reforgeRangeText(tier,2)+'　／　'+cost+'</div>';
        }).join('');
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>冶煉規則</h3><p>裝備品質不限制材料階級。選用哪一階材料，本次重洗就使用哪一階的數值範圍。</p>'+lines+'<p>桃紅階、四象階已預留正式階級，但目前不開放數值與取得來源。</p><p>每次會重洗所有未鎖定的冶煉槽；已鎖定詞條保持原數值。冶煉次數不限。</p><p>消耗：未鎖定消耗 50 礦石；鎖 1 條 100 礦石；鎖 2 條 150 礦石。最多鎖 2 條，且至少保留 1 個槽位重洗。</p><p>單槽最高值固定10%；具副詞條範圍的材料，雙詞條同時最高固定5%。</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">返回</button></div></div>');
    };

    window.v141StartReforge=function(){
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(synthesisState.pendingReforge){ return false; }
        if(!canActuallyReforge(item)){
            alert(item?canActuallyReforge(item,true):"裝備已失效或 UID 重複，請重新選擇裝備。");
            return false;
        }
        if(typeof window.v132RunInventoryTransaction!=="function"||typeof window.v132ConsumeStackItem!=="function"||typeof saveGame!=="function"){
            alert("冶煉交易或存檔系統尚未準備完成，無法安全扣除材料。");
            return false;
        }
        const slotCount=reforgeSlotCount(item);
        if(slotCount<=0){ alert("這件裝備沒有冶煉槽。"); return; }
        const locks=normalizeReforgeLocks(item).slice();
        if(locks.length>=slotCount){ alert("至少要保留 1 個未鎖定槽位才能重新冶煉。"); return; }
        const tier=normalizeTierKey(synthesisState.reforgeMaterialTier);
        const info=reforgeMaterialInfo(tier);
        if(!TIER_META[tier]||!info.meta||info.meta.available===false){ alert("此材料階級尚未開放。"); return false; }
        const cost=reforgeMaterialCost(locks.length);
        if(!info.ore||!Number.isFinite(info.oreCount)||info.oreCount<cost||!Number.isFinite(gold)||gold<info.meta.reforgeGold){
            alert(info.meta.label+"冶煉材料或金幣不足。");
            return;
        }
        const pending={
            uid:item.v141Uid,
            item,
            stats:rollReforgeAffixes(item,tier,locks),
            materialTier:tier,
            lockedKeys:locks.slice(),
            materialCost:cost
        };
        const previousGold=gold;
        const success=runInventoryTransaction(()=>{
            if(!window.v132ConsumeStackItem(info.ore.id,cost)){ return false; }
            gold-=info.meta.reforgeGold;
            return saveGame()!==false;
        });
        if(!success){
            gold=previousGold;
            rebuildInventorySlots(); updateGoldDisplay(); renderSynthesis();
            alert("冶煉交易或存檔失敗，金幣與素材已還原。"); return false;
        }
        synthesisState.pendingReforge=pending;
        rebuildInventorySlots(); updateGoldDisplay(); renderSynthesis();
        return true;
    };

    window.v141ResolveReforge=function(applyNew){
        const pending=synthesisState.pendingReforge;
        if(!pending){ return; }
        const item=findEquipmentByUid(pending.uid);
        if(applyNew&&(!canActuallyReforge(item)||item!==pending.item)){
            alert(item?canActuallyReforge(item,true)||"裝備已變更，無法套用冶煉效果。":"裝備已失效或 UID 重複，無法套用冶煉效果。");
            return false;
        }
        const oldStats=item&&item.reforgeStats,oldUsed=item&&item.reforgeUsed;
        if(applyNew&&item){
            // Replace the unlocked result as one full roll; locked keys were already
            // copied into pending.stats by rollReforgeAffixes(). No additive stacking.
            item.reforgeStats=Object.assign({},pending.stats);
            item.reforgeUsed=0;
        }
        if(saveGame()===false){
            if(applyNew&&item){
                if(oldStats===undefined){ delete item.reforgeStats; }else{ item.reforgeStats=oldStats; }
                if(oldUsed===undefined){ delete item.reforgeUsed; }else{ item.reforgeUsed=oldUsed; }
            }
            alert("冶煉結果存檔失敗，請重試。"); return false;
        }
        synthesisState.pendingReforge=null;
        if(item){ normalizeReforgeLocks(item); }
        updateUI(); renderSynthesis();
        showSynthesisResult(applyNew?"已套用新冶煉效果":"已保留原冶煉效果",applyNew&&item?'<div class="v141-result-item"><b>'+escapeHtml(item.name)+'</b>'+statsHtml(item.reforgeStats)+'</div>':'<p>本次材料與金幣已消耗，原有效果維持不變。</p>');
        return true;
    };

    window.v141CraftTalismans=function(){
        const source=definitions().talismans.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        if(!source||!target){ return; }
        const qty=Math.max(1,synthesisState.talismanQty);
        const cost=TALISMAN_GOLD[normalizeTierKey(source.tierKey)]*qty;
        if(countItem(source.id)<qty*3||gold<cost){ alert("符咒或金幣不足。"); return; }
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(target,qty)){ alert("背包空間不足。"); return; }
        const success=runInventoryTransaction(()=>window.v132ConsumeStackItem(source.id,qty*3)&&addItem(target,qty));
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=cost; rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("符咒合成成功",'<div class="v141-result-item">'+target.icon+'<b>'+escapeHtml(target.name)+' ×'+qty+'</b></div>');
    };

    window.v141CraftFragmentTicket=function(setId){
        const fragment=getFragmentDefinition(setId);
        const ticket=definitions().tickets.find(item=>item.setId===setId);
        const qty=Math.max(1,synthesisState.fragmentQty[setId]||1);
        if(!fragment||!ticket||countItem(fragment.id)<qty*100||gold<qty*500){ alert("碎片或金幣不足。"); return; }
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(ticket,qty)){ alert("背包空間不足。"); return; }
        const success=runInventoryTransaction(()=>window.v132ConsumeStackItem(fragment.id,qty*100)&&addItem(ticket,qty));
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=qty*500; rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("碎片合成成功",'<div class="v141-result-item">'+ticket.icon+'<b>'+escapeHtml(ticket.name)+' ×'+qty+'</b></div>');
    };

    window.v141DecomposeSeriesItem=async function(slotIndex){
        const item=inventorySlots[slotIndex];
        const fragment=item&&getFragmentDefinition(item.setId);
        if(!item||!fragment||!isEquipmentInventoryType(item.type)){ return; }
        if(
            typeof window.rpgConfirm!=="function" ||
            !await window.rpgConfirm(
                "確定分解「"+item.name+"」？\n將固定獲得"+fragment.name+"×"+SERIES_DISMANTLE_FRAGMENT_COUNT+"，裝備無法復原。",
                {
                    title:"分解裝備",
                    confirmText:"確定分解",
                    cancelText:"返回",
                    danger:true
                }
            )
        ){
            return;
        }
        if(inventorySlots[slotIndex]!==item){ return; }
        const realIndex=inventoryItems.indexOf(item);
        if(realIndex<0){ return; }
        const success=runInventoryTransaction(()=>{
            inventoryItems.splice(realIndex,1);
            return addItem(fragment,SERIES_DISMANTLE_FRAGMENT_COUNT);
        });
        if(!success){ alert("背包空間不足，分解已取消。"); return; }
        closeItemModal(); rebuildInventorySlots(); saveGame(); renderInventory();
        alert("分解完成，獲得"+fragment.name+"×"+SERIES_DISMANTLE_FRAGMENT_COUNT+"。");
    };

    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            if(type!=="synthesis"&&type!=="forge"){ return originalOpenHomeFeature.apply(this,arguments); }
            closeHomeFeature();
            activeFeature=type;
            const modal=document.getElementById("homeFeatureModal");
            const title=document.getElementById("homeFeatureModalTitle");
            if(title){ title.textContent=type==="forge"?"鍛造":"合成"; }
            if(modal){ modal.dataset.craftingFeature=type; modal.classList.add("show","v141-synthesis-modal"); window.FourSymbolsBottomNav?.syncContext(); }
            ensureEquipmentUids();
            renderSynthesis();
        };
    }
    if(typeof closeHomeFeature==="function"){
        const originalCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.remove("v141-synthesis-modal"); delete modal.dataset.craftingFeature; }
            return originalCloseHomeFeature.apply(this,arguments);
        };
    }

    /* =====================================================
       Abyss dungeon
    ===================================================== */
    if(!skillDatabase.stormSpell){
        skillDatabase.stormSpell=Object.assign({},skillDatabase.windHowlLightning,{id:"stormSpell",name:"暴風術",tier:4,targetType:"all"});
    }
    function defaultAbyssState(){ return {active:false,floor:1,phase:"boss",x:50,y:84,message:"",clears:0,rewardVersion:1}; }
    function loadAbyssState(){
        try{
            const raw=JSON.parse(localStorage.getItem(ABYSS_STORAGE_KEY)||"{}");
            const state=Object.assign(defaultAbyssState(),raw,{floor:Math.max(1,Math.min(5,Number(raw.floor)||1))});
            /* Before floor chests existed, phase=portal meant that no reward had
               been claimed. Migrate that one legacy phase back to its chest. */
            if(raw.phase==="portal"&&Number(raw.rewardVersion||0)<1){
                state.phase="chest";
                state.message="守關寶箱已補上。請先領取獎勵，再使用傳送點。";
            }
            return state;
        }catch(_){ return defaultAbyssState(); }
    }
    let abyssState=loadAbyssState();
    /* Whether this page visit has entered the persisted run. Never persist it: a
       reload or a later visit must return to the progress gate first. */
    let abyssMapEntered=false;
    let abyssBattleStarting=false;
    let activeAbyssDialogueAdvance=null;
    function persistAbyss(){ try{ localStorage.setItem(ABYSS_STORAGE_KEY,JSON.stringify(abyssState)); }catch(_){ } }

    const abyssFloors={
        1:{boss:"東帝",element:"earth",skills:["flyingSandStrike","dustStorm","stoneSlash"],eliteSkill:"petrifyFist",taunts:["凡人也敢踏入帝境？","黃沙會埋葬你的名字。","先過天兵這一關再說！"]},
        2:{boss:"南帝",element:"fire",skills:["explosiveFlurry","dragonSlash","fireRocket"],eliteSkill:"fireCritical",taunts:["烈火會把你的勇氣燒光。","再向前一步，便是灰燼。","你撐不過南天之焰！"]},
        3:{boss:"天帝",element:"wind",skills:["windHowlLightning","stormFlurry","windCrossSlash"],eliteSkill:"stormFist",taunts:["風起之時，無人能立。","你的招式太慢了。","天威不是凡人能挑戰的！"]},
        4:{boss:"北帝",element:"water",skills:["floodBeast","frostPunch","waterKnife"],eliteSkill:"waterBall",taunts:["寒泉已封住你的退路。","讓冰霜替你長眠。","北境之前，止步吧！"]}
    };
    const elementLabel={fire:"火",water:"水",earth:"土",wind:"風",light:"光"};

    // Compatibility entry only: the two-tier owner owns roster/progression;
    // this retired five-floor path has no monster-stat construction authority.
    function buildAbyssRoster(floor){
        if(typeof window.v174AbyssBuildRoster!=="function"){
            throw new Error("Load formal two-tier Abyss before building an encounter.");
        }
        return window.v174AbyssBuildRoster(40,Math.max(0,Math.min(4,Number(floor)-1)),4);
    }
    window.v141BuildAbyssRoster=buildAbyssRoster;

    function monsterBaseHp(monster){
        const shield=monster&&monster.v141Shield;
        return shield?Math.max(0,monster.hp-(shield.remaining||0)):monster.hp;
    }

    function monsterBaseMaxHp(monster){
        const shield=monster&&monster.v141Shield;
        return Math.max(1,Number(shield&&shield.baseMaxHP)||Number(monster&&monster.maxHP)||1);
    }

    function getMonsterAllyTriTargeting(casterIndex,entries){
        const living=(entries||currentBattleMonsters.map(index=>({index:index,monster:monsters[index]})))
            .filter(entry=>entry&&entry.monster&&entry.monster.alive!==false&&Number(entry.monster.hp)>0);
        const livingByIndex=new Map(living.map(entry=>[entry.index,entry]));
        const owner=window.FourSymbolsBattlefieldSlots||null;
        const snapshot=owner&&typeof owner.getActiveEnemySnapshot==="function"?owner.getActiveEnemySnapshot():null;
        let best=[];
        let bestPrimary=null;
        let bestScore=-1;
        living.forEach(centerEntry=>{
            const center=centerEntry.index;
            const targetingOwner=window.FourSymbolsBattleSkillTargeting;
            const indexes=targetingOwner&&typeof targetingOwner.resolveTargets==="function"
                ?targetingOwner.resolveTargets("monster",center,"allyTri",{hostilePrimary:false})
                :(owner&&snapshot&&typeof owner.resolveEnemyTargets==="function"
                    ?owner.resolveEnemyTargets(snapshot,center,"tri",index=>livingByIndex.has(index))
                    :[center]);
            const trio=indexes.map(index=>livingByIndex.get(index)).filter(Boolean);
            const score=trio.reduce((sum,entry)=>{
                const ally=entry.monster;
                const hpNeed=(monsterBaseMaxHp(ally)-monsterBaseHp(ally))/monsterBaseMaxHp(ally);
                const maxSP=Math.max(1,Number(ally.maxSP)||1);
                const spNeed=(maxSP-Math.max(0,Number(ally.sp)||0))/maxSP;
                return sum+Math.max(0,hpNeed)+Math.max(0,spNeed);
            },0)+(trio.some(entry=>entry.index===casterIndex)?0.0001:0);
            if(score>bestScore){ best=trio; bestPrimary=center; bestScore=score; }
        });
        return {entries:best.slice(0,3),primaryIndex:Number.isInteger(bestPrimary)?bestPrimary:(best[0]?best[0].index:null)};
    }
    function getMonsterAllyTriTargets(casterIndex,entries){
        return getMonsterAllyTriTargeting(casterIndex,entries).entries;
    }
    function getMonsterSupportTargeting(skill,casterIndex,entries){
        const targetType=String(skill&&skill.targetType||"allyAll");
        if(targetType==="allyTri"){ return getMonsterAllyTriTargeting(casterIndex,entries); }
        const living=(entries||[]).filter(entry=>entry&&entry.monster&&entry.monster.alive!==false&&Number(entry.monster.hp)>0);
        if(targetType==="ally"){
            const self=living.find(entry=>entry.index===casterIndex)||living[0]||null;
            return {entries:self?[self]:[],primaryIndex:self?self.index:null};
        }
        return {entries:living,primaryIndex:null};
    }
    window.v141GetMonsterAllyTriTargeting=getMonsterAllyTriTargeting;
    window.v141GetMonsterAllyTriTargets=getMonsterAllyTriTargets;

    function applyTimedMonsterBuff(monstersToBuff,type,turns,amount,options){
        const opts=options&&typeof options==="object"?options:{};
        monstersToBuff.forEach(monster=>{
            if(!monster||!monster.alive){ return; }
            const monsterIndex=typeof monsters!=="undefined"?monsters.indexOf(monster):-1;
            if(
                typeof window.v173CanApplyNamedPersistentState==="function"&&
                !window.v173CanApplyNamedPersistentState(
                    monster,type,"monster",monsterIndex>=0?monsterIndex:undefined,
                    type==="rage"?"怒火":type==="resistance"?"氣定神閒":"閃躲術"
                )
            ){ return; }
            if(monster.v141TeamBuffs?.some(buff=>buff.type===type&&buff.turnsLeft>0)){ return; }
            monster.v141TeamBuffs=monster.v141TeamBuffs||[];
            const buff={type,turnsLeft:turns,amount};
            if(type==="rage"){
                buff.originalAttack=monster.attack; buff.originalMagicAttack=monster.magicAttack;
                buff.bonusPercent=25;
                buff.critChanceBonusPercent=25;
                buff.critDamageBonusPercent=50;
            }else if(type==="resistance"){
                buff.accuracyBonusPercent=Math.max(0,Number(opts.accuracyBonusPercent)||0);
                monster.resistance=(Number(monster.resistance)||0)+amount;
            }else if(type==="dodge"){
                buff.originalEvasion=monster.evasion;
                monster.evasion=typeof window.v173CombineEvasionRates==="function"
                    ?window.v173CombineEvasionRates([buff.originalEvasion,amount])
                    :Math.max(0,(Number(buff.originalEvasion)||0)+(Number(amount)||0));
            }
            const displayBuff={
                type:type==="rage"?"rage":"v141TeamBuff",
                v141BuffType:type,
                turnsLeft:turns
            };
            if(type==="resistance"){
                displayBuff.accuracyBonusPercent=buff.accuracyBonusPercent;
            }
            if(type==="rage"){
                displayBuff.bonusPercent=buff.bonusPercent;
                displayBuff.critChanceBonusPercent=buff.critChanceBonusPercent;
                displayBuff.critDamageBonusPercent=buff.critDamageBonusPercent;
            }
            if(typeof window.v173MarkPersistentStateName==="function"){
                window.v173MarkPersistentStateName(buff,type);
                window.v173MarkPersistentStateName(displayBuff,type);
            }
            buff.displayBuff=displayBuff;
            monster.v141TeamBuffs.push(buff);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(displayBuff);
        });
    }

    window.v141TryMonsterSpecialAction=function(monsterIndex){
        const monster=monsters[monsterIndex];
        const supportIds=monster&&typeof window.v144GetLegalMonsterSkillIds==="function"
            ?window.v144GetLegalMonsterSkillIds(monster,"support")
            :(monster&&monster.v141SupportSkillIds||[]).filter(id=>{
                const skill=skillDatabase[id];
                return !!(skill&&skill.element&&skill.element===monster.element);
            });
        if(!monster||!monster.alive||!supportIds.length){ return false; }
        const allyEntries=currentBattleMonsters.map(index=>({index:index,monster:monsters[index]}))
            .filter(entry=>entry.monster&&entry.monster.alive);
        const allies=allyEntries.map(entry=>entry.monster);
        const forcedSupportSkillId=monster&&monster.v175ForcedSupportSkillId;
        if(monster){ delete monster.v175ForcedSupportSkillId; }
        let skillId=forcedSupportSkillId&&supportIds.includes(forcedSupportSkillId)
            &&skillDatabase[forcedSupportSkillId]?forcedSupportSkillId:null;
        let target=null;
        let healTargets=[];
        let supportTargeting=null;
        const allAlliesNeedHealing=allyEntries.some(entry=>
            monsterBaseHp(entry.monster)<monsterBaseMaxHp(entry.monster)*.70
        );
        const healSkill=skillDatabase.healSpell;
        if(!skillId&&supportIds.includes("healSpell")&&allAlliesNeedHealing&&healSkill&&monster.sp>=(healSkill.spCost||0)){
            supportTargeting=getMonsterAllyTriTargeting(monsterIndex,allyEntries);
            healTargets=supportTargeting.entries;
            if(healTargets.length){ skillId="healSpell"; }
        }
        const carriedAttacks=typeof window.v144GetLegalMonsterSkillIds==="function"
            ?window.v144GetLegalMonsterSkillIds(monster,"attack")
            :(monster.skillIds||[]).filter(id=>{
                const skill=skillDatabase[id];
                return !!(skill&&skill.element&&skill.element===monster.element);
            });
        const affordableAttacks=carriedAttacks.filter(id=>{
            const skill=skillDatabase[id];
            return !!(skill&&monster.sp>=(skill.spCost||0));
        });
        const affordableBuffs=supportIds.filter(id=>{
            const skill=skillDatabase[id];
            return id!=="healSpell"&&!!(skill&&monster.sp>=(skill.spCost||0));
        });
        if(!skillId){
            const category=window.FourSymbolsEnemySkillAI
                ?window.FourSymbolsEnemySkillAI.chooseCategory(affordableAttacks,affordableBuffs,Math.random(),monster)
                :(Math.random()<.70?"attack":"buff");
            if(category==="attack"&&affordableAttacks.length){
                const preferredAttacks=monster.vGameplayTower===true&&monster.element==="water"&&affordableAttacks.includes("freeze")&&Math.random()<.5
                    ?["freeze"]:affordableAttacks;
                monster.v175ForcedAttackSkillId=preferredAttacks[Math.floor(Math.random()*preferredAttacks.length)];
                return false;
            }
            if(category!=="buff"&&affordableBuffs.length){
                /* An unaffordable/missing attack pool falls back once to buffs. */
            }else if(category==="normal"){ return false; }
        }
        if(!skillId&&supportIds.includes("barrier")){
            target=allies.find(item=>!(item.v141Shield&&item.v141Shield.isBarrier));
            if(target){ skillId="barrier"; }
        }
        if(!skillId&&supportIds.includes("rage")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="rage"&&buff.turnsLeft>0))){ skillId="rage"; }
        if(!skillId&&supportIds.includes("dinghaishenzhen")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="resistance"&&buff.turnsLeft>0))){ skillId="dinghaishenzhen"; }
        if(!skillId&&supportIds.includes("dodgeSkill")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="dodge"&&buff.turnsLeft>0))){ skillId="dodgeSkill"; }
        if(!skillId){
            if(affordableAttacks.length){
                const preferredAttacks=monster.vGameplayTower===true&&monster.element==="water"&&affordableAttacks.includes("freeze")&&Math.random()<.5
                    ?["freeze"]:affordableAttacks;
                monster.v175ForcedAttackSkillId=preferredAttacks[Math.floor(Math.random()*preferredAttacks.length)];
            }
            return false;
        }
        const skill=skillDatabase[skillId];
        if(monster.sp<(skill.spCost||0)){ return false; }
        if(!supportTargeting){
            if(skillId==="barrier"&&target){
                const entry=allyEntries.find(item=>item.monster===target)||null;
                supportTargeting={entries:entry?[entry]:[],primaryIndex:entry?entry.index:null};
            }else{
                supportTargeting=getMonsterSupportTargeting(skill,monsterIndex,allyEntries);
            }
        }
        const supportTargetIds=(supportTargeting.entries||[]).map(entry=>entry.index);
        monster.sp-=skill.spCost||0;
        showMonsterSkillNameBadge(skill.name,skill.element||monster.element,monsterIndex,supportTargeting.primaryIndex,supportTargetIds,"monster",skill.targetType);
        const level=Math.max(1,Math.min(
            Number(skill.maxLevel)||1,
            Number(monster.v141ForceSkillLevel||monster.v141SkillLevel)||1
        ));
        const levelValue=(values,fallback)=>{
            if(!Array.isArray(values)||!values.length){ return Number(fallback)||0; }
            return Number(values[Math.max(0,Math.min(values.length-1,level-1))])||0;
        };
        if(skillId==="healSpell"){
            const hpAmount=levelValue(
                skill.healHpByLevel,
                (Number(skill.baseHeal)||0)+(Number(skill.healPerLevel)||0)*(level-1)
            );
            const spPercent=levelValue(skill.spRestorePercentByLevel,0);
            let hpTotal=0;
            let spTotal=0;
            healTargets.forEach(entry=>{
                const ally=entry.monster;
                const healed=window.v141HealMonsterPreservingShield(ally,hpAmount,monster);
                const beforeSP=Math.max(0,Number(ally.sp)||0);
                const spAmount=entry.index===monsterIndex
                    ?0
                    :Math.floor(Math.max(0,Number(ally.maxSP)||0)*spPercent/100);
                ally.sp=Math.min(Math.max(beforeSP,Number(ally.maxSP)||0),beforeSP+spAmount);
                const restoredSP=ally.sp-beforeSP;
                hpTotal+=healed;
                spTotal+=restoredSP;
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            addBattleLog(monster.name+"施放治療術，為同排最多"+healTargets.length+"名友方共回復"+hpTotal+" HP、"+spTotal+" SP。");
        }else if(skillId==="barrier"){
            const duration=Math.max(1,Math.floor(levelValue(skill.durationByLevel,skill.duration||3)));
            const blocks=Math.max(1,Math.floor(levelValue(skill.barrierBlockCountByLevel,skill.barrierBlockCount||3)));
            window.v141ApplyMonsterShield(target,999999,duration,blocks);
            target.v141Shield.isBarrier=true;
            addBattleLog(monster.name+"為"+target.name+"施放結界，可抵擋"+blocks+"次直接傷害，最多持續"+duration+"回合。");
        }else if(skillId==="rage"){
            applyTimedMonsterBuff((supportTargeting.entries||[]).map(entry=>entry.monster),"rage",3,0);
            addBattleLog(monster.name+"施放怒火，敵方全體爆擊率與爆擊傷害提升3回合。");
        }else if(skillId==="dinghaishenzhen"){
            const resist=levelValue(skill.statusResistBonusByLevel,skill.statusResistBonus||0);
            const accuracy=levelValue(skill.accuracyBonusPercentByLevel,skill.accuracyBonusPercent||0);
            applyTimedMonsterBuff((supportTargeting.entries||[]).map(entry=>entry.monster),"resistance",3,resist,{accuracyBonusPercent:accuracy});
            addBattleLog(monster.name+"施放氣定神閒，敵方全體異常抗性提升"+resist+"%、命中提升"+accuracy+"%，持續3回合。");
        }else if(skillId==="dodgeSkill"){
            const evasion=levelValue(skill.evasionBonusPercentByLevel,skill.evasionBonusPercent||0);
            const dodgeTargets=(supportTargeting.entries||[]).map(entry=>entry.monster);
            applyTimedMonsterBuff(dodgeTargets,"dodge",3,evasion);
            addBattleLog(monster.name+"施放閃躲術，同排最多"+dodgeTargets.length+"名友方最終閃躲提升"+evasion+"%，持續3回合。");
        }
        updateUI(); finishPlayerAction();
        return true;
    };

    /* Timed support buffs consume on each affected monster's formal
       action boundary through FourSymbolsDurationLifecycle. */

    function bossPosition(){ return [61,21]; }
    const ABYSS_DIALOGUE={
        1:["凡人也敢踏入帝境？","黃沙會埋葬你的名字。","先過天兵這一關再說！"],
        2:["烈火會把你的勇氣燒光。","再向前一步，便是灰燼。","你撐不過南天之焰！"],
        3:["風起之時，無人能立。","你的招式太慢了。","天威不是凡人能挑戰的！"],
        4:["寒泉已封住你的退路。","讓冰霜替你長眠。","北境之前，止步吧！"],
        5:["五帝同臨，你已無路可退。","極光會照見你的敗亡。","此處便是深淵盡頭！"]
    };
    function abyssProgressLabel(){
        const phaseLabels={boss:"等待挑戰",chest:"寶箱待開啟",portal:"寶箱已領取・傳送點已開啟"};
        return "目前進度：第 "+abyssState.floor+" / 5 層・"+(phaseLabels[abyssState.phase]||"挑戰進行中");
    }
    function abyssBattleInfoMarkup(){
        const source=document.getElementById("battleInfo");
        const html=source&&String(source.innerHTML||"").trim();
        return html||'<div class="v17342-abyss-battle-empty">尚無戰鬥資訊</div>';
    }

    function renderAbyss(){
        if(abyssState.phase==="complete"){
            return '<div class="v141-abyss-intro complete"><div class="v141-abyss-seal">破</div><h3>本輪深淵已通關</h3><p>深淵寶箱已開啟。可重新開始下一輪挑戰。</p><button onclick="v141ResetAbyss()">重新挑戰</button></div>';
        }
        if(!abyssState.active||!abyssMapEntered){
            const resume=abyssState.active;
            return '<div class="v141-abyss-intro'+(resume?' v169-abyss-resume':'')+'"><div class="v141-abyss-seal">深淵</div><h3>五帝深淵</h3><p>共5張地圖、5場戰鬥。擊敗守關者、領取寶箱，再由傳送點前往下一層。</p>'+
                (resume?'<strong class="v169-abyss-progress">'+escapeHtml(abyssProgressLabel())+'</strong>':'')+
                '<button onclick="v141StartAbyss()">'+(resume?'繼續挑戰':'進入深淵')+'</button></div>';
        }
        const floor=abyssState.floor;
        const info=floor<5?abyssFloors[floor]:{boss:"五帝聯軍",element:"light"};
        const pos=bossPosition(floor);
        const boss=abyssState.phase==="boss"&&floor<5?'<button type="button" class="v141-abyss-boss" data-abyss-boss-control="true" style="left:'+pos[0]+'%;top:'+pos[1]+'%" onclick="v141HandleAbyssBossInteraction(event)"><b>'+escapeHtml(info.boss)+'</b><span>'+elementLabel[info.element]+'元素・點擊挑戰</span></button>':'';
        const hasFloorReward=floor<5&&(abyssState.phase==="chest"||abyssState.phase==="portal");
        const portal=hasFloorReward?'<button class="v141-abyss-portal'+(abyssState.phase==="chest"?' locked':'')+'" style="left:50%;top:10%" aria-disabled="'+(abyssState.phase==="chest"?'true':'false')+'" onclick="event.stopPropagation();v141UseAbyssPortal()"><i></i><span>'+(abyssState.phase==="chest"?'先開啟寶箱':'前往下一層')+'</span></button>':'';
        const showChest=abyssState.phase==="chest"||abyssState.phase==="portal";
        const chest=showChest?'<button class="v141-abyss-chest'+(abyssState.phase==="portal"?' open':'')+'" style="left:'+pos[0]+'%;top:'+pos[1]+'%" '+(abyssState.phase==="portal"?'aria-disabled="true"':'onclick="event.stopPropagation();v141OpenAbyssChest()"')+'><i></i><span>'+(abyssState.phase==="portal"?'寶箱已開啟':'深淵寶箱')+'</span></button>':'';
        return '<div class="v141-abyss-shell"><header><b>深淵 第'+floor+'/5層</b><span>'+escapeHtml(abyssState.message||'點擊地面移動角色')+'</span></header>'+
            '<div id="v141AbyssMap" class="v141-abyss-map floor-'+floor+'" onclick="v141AbyssMoveByEvent(event)">'+
            '<div id="v141AbyssSpeech" class="v141-abyss-speech"></div>'+boss+portal+chest+
            '<div id="v141AbyssPlayer" class="v141-abyss-player" style="left:'+abyssState.x+'%;top:'+abyssState.y+'%"><span></span><small>玩家</small></div></div>'+
            '<section class="v17342-abyss-battle-info" aria-label="戰鬥資訊"><b>戰鬥資訊</b><div class="v17342-abyss-battle-log">'+abyssBattleInfoMarkup()+'</div></section></div>';
    }

    function syncAbyssPlayerArt(){
        const target=document.querySelector("#v141AbyssPlayer > span");
        const source=document.getElementById("patrolCharacterImg");
        if(target&&source){
            const src=source.currentSrc||source.src||"";
            target.style.backgroundImage=src?'url("'+src.replace(/"/g,"%22")+'")':"none";
            target.style.backgroundSize="contain";
            target.style.backgroundPosition="center";
            target.style.backgroundRepeat="no-repeat";
        }
        installAbyssBossInputBridge();
    }

    function refreshAbyssPage(){
        const content=document.getElementById("dungeonTabContent");
        if(content){ content.innerHTML=renderAbyss(); requestAnimationFrame(syncAbyssPlayerArt); }
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="abyss"){ return renderAbyss(); }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }
    if(typeof switchDungeonTab==="function"){
        const originalSwitchDungeonTab=switchDungeonTab;
        switchDungeonTab=function(tabName){
            if(tabName!=="abyss"){ abyssMapEntered=false; }
            const result=originalSwitchDungeonTab.apply(this,arguments);
            if(tabName==="abyss"){ requestAnimationFrame(syncAbyssPlayerArt); }
            return result;
        };
    }
    if(typeof showPage==="function"){
        const originalShowPage=showPage;
        showPage=function(page){
            /* Entering battle is part of the same map visit. Every other page
               exit must pause the run at its progress gate. */
            if(page!=="dungeon"&&page!=="battle"&&!(page==="inventory"&&
               typeof inventoryOpenContext!=="undefined"&&inventoryOpenContext?.closeBehavior==="restore-source")){ abyssMapEntered=false; }
            return originalShowPage.apply(this,arguments);
        };
    }

    window.v141StartAbyss=function(){
        if(!abyssState.active){ abyssState=Object.assign(defaultAbyssState(),{active:true,clears:abyssState.clears||0}); }
        abyssMapEntered=true;
        abyssState.x=50; abyssState.y=84;
        persistAbyss(); refreshAbyssPage();
    };
    window.v141ResetAbyss=function(){
        abyssState=Object.assign(defaultAbyssState(),{active:true,clears:abyssState.clears||0});
        abyssMapEntered=true;
        persistAbyss(); refreshAbyssPage();
    };
    window.v141GetAbyssState=function(){ return Object.assign({mapEntered:abyssMapEntered},abyssState); };
    window.v141LeaveAbyssMap=function(){ abyssMapEntered=false; };

    function moveAbyssPlayer(x,y,callback){
        const playerEl=document.getElementById("v141AbyssPlayer");
        if(!playerEl){ if(callback){ callback(); } return; }
        const distance=Math.hypot(x-abyssState.x,y-abyssState.y);
        const duration=Math.max(.45,Math.min(2.4,distance/28));
        abyssState.x=x; abyssState.y=y; persistAbyss();
        playerEl.style.transition="left "+duration+"s cubic-bezier(.22,.61,.36,1),top "+duration+"s cubic-bezier(.22,.61,.36,1)";
        playerEl.style.left=x+"%"; playerEl.style.top=y+"%";
        playerEl.classList.add("walking");
        setTimeout(()=>{
            playerEl.classList.remove("walking");
            if(callback){ callback(); }
            else{ maybeTriggerFinalAbyssEncounter(); }
        },duration*1000+30);
    }
    window.v141ApproachAbyssBoss=function(callback){
        if(abyssState.phase!=="boss"){ return false; }
        const pos=bossPosition(abyssState.floor);
        const approachY=Math.min(84,pos[1]+27);
        if(Math.hypot(abyssState.x-pos[0],abyssState.y-approachY)<=8){
            if(callback){ callback(); }
        }else{
            moveAbyssPlayer(pos[0],approachY,callback);
        }
        return true;
    };
    function finalAbyssApproachPoint(){
        const pos=bossPosition(5);
        return [pos[0],Math.min(84,pos[1]+27)];
    }

    function maybeTriggerFinalAbyssEncounter(){
        if(
            abyssState.floor!==5||abyssState.phase!=="boss"||abyssBattleStarting||
            activeAbyssDialogueAdvance
        ){ return false; }
        const approach=finalAbyssApproachPoint();
        if(Math.hypot(abyssState.x-approach[0],abyssState.y-approach[1])>10){ return false; }
        return openAbyssBossDialogue();
    }

    function isAbyssMapControlHit(event,control){
        if(!event||!control){ return false; }
        const target=event.target;
        if(target&&typeof target.closest==="function"&&target.closest("button")===control){
            return true;
        }
        const x=Number(event.clientX);
        const y=Number(event.clientY);
        if(!Number.isFinite(x)||!Number.isFinite(y)){ return false; }
        const rect=control.getBoundingClientRect();
        return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
    }

    /*
       All BOSS input enters here.  It is used both by the visible button and
       by a capture-phase pointer bridge on the map, so a portrait/pseudo-layer
       cannot turn a BOSS tap into a ground-movement request.
    */
    window.v141HandleAbyssBossInteraction=function(event){
        if(event){
            if(event.preventDefault){ event.preventDefault(); }
            if(event.stopPropagation){ event.stopPropagation(); }
        }
        if(abyssState.phase!=="boss"||abyssState.floor===5){ return false; }
        window.v141ChallengeAbyssBoss();
        return true;
    };

    function installAbyssBossInputBridge(){
        const map=document.getElementById("v141AbyssMap");
        if(!map||map.dataset.v173BossInputBridge==="1"){ return; }
        map.dataset.v173BossInputBridge="1";
        ["pointerup","click"].forEach(type=>map.addEventListener(type,event=>{
            /*
               The dialogue itself occupies the map.  Capture handlers run before
               its own click handler, so never route a dialogue click back into
               the guardian trigger.
            */
            if(event.target&&typeof event.target.closest==="function"&&event.target.closest(".v143-abyss-dialogue")){ return; }
            const boss=abyssState.phase==="boss"?map.querySelector(".v141-abyss-boss"):null;
            if(!isAbyssMapControlHit(event,boss)){ return; }
            window.v141HandleAbyssBossInteraction(event);
        },true));
    }

    window.v141AbyssMoveByEvent=function(event){
        const map=document.getElementById("v141AbyssMap");
        if(!map||map.dataset.v169DialogueApproaching==="1"){ return; }
        if(activeAbyssDialogueAdvance){
            if(event&&event.preventDefault){ event.preventDefault(); }
            if(event&&event.stopPropagation){ event.stopPropagation(); }
            activeAbyssDialogueAdvance();
            return;
        }
        const boss=abyssState.phase==="boss"?map.querySelector(".v141-abyss-boss"):null;
        /*
           Mobile browsers may report the portrait pseudo-element as the map
           target.  Route the touch by the guardian button's rendered bounds
           before treating it as a ground-movement request.
        */
        if(isAbyssMapControlHit(event,boss)){
            if(event.preventDefault){ event.preventDefault(); }
            if(event.stopPropagation){ event.stopPropagation(); }
            window.v141HandleAbyssBossInteraction(event);
            return;
        }
        if(event.target&&typeof event.target.closest==="function"&&event.target.closest("button")){ return; }
        const rect=map.getBoundingClientRect();
        /* V143：地圖放大後同步放寬可走區，保留角色半身安全邊界即可。 */
        const x=Math.max(4,Math.min(96,(event.clientX-rect.left)/rect.width*100));
        const y=Math.max(8,Math.min(94,(event.clientY-rect.top)/rect.height*100));
        if(abyssState.floor===5&&abyssState.phase==="boss"){
            const emperorPos=bossPosition(5);
            const nearFiveEmperors=Math.hypot(x-emperorPos[0],y-emperorPos[1])<=36||y<=62;
            if(nearFiveEmperors){
                const approach=finalAbyssApproachPoint();
                moveAbyssPlayer(approach[0],approach[1],maybeTriggerFinalAbyssEncounter);
                return;
            }
        }
        moveAbyssPlayer(x,y);
    };

    function launchAbyssBossBattle(){
        if(abyssBattleStarting||abyssState.phase!=="boss"){ return false; }
        abyssBattleStarting=true;
        const floor=abyssState.floor;
        setTimeout(()=>{
            const roster=buildAbyssRoster(floor);
            const started=window.v132LaunchDungeonBattle(roster,function(outcome){
                abyssBattleStarting=false;
                showPage("dungeon");
                /* Returning from combat must preserve the entered-map state.
                   showPage/switchDungeonTab may restore the daily tab first,
                   which otherwise clears this flag and reopens the cover. */
                abyssMapEntered=true;
                if(outcome.result!=="win"){
                    abyssState.message="挑戰失敗，守關者仍在等待。";
                    persistAbyss(); switchDungeonTab("abyss"); return;
                }
                abyssState.phase="chest";
                abyssState.message=floor<5
                    ?abyssFloors[floor].boss+"已退場。請開啟寶箱，再使用上方傳送點。"
                    :"五帝聯軍消失，深淵寶箱已出現。";
                persistAbyss(); switchDungeonTab("abyss");
            },{mode:"abyss"});
            if(!started){ abyssBattleStarting=false; }
        },180);
        return true;
    }

    function positionAbyssBossDialogue(map,overlay,bossButton){
        if(
            !map||!overlay||typeof map.getBoundingClientRect!=="function"||
            !overlay.style
        ){ return false; }
        const mapRect=map.getBoundingClientRect();
        const renderedWidth=Number(mapRect&&mapRect.width);
        const renderedHeight=Number(mapRect&&mapRect.height);
        if(!(renderedWidth>0)||!(renderedHeight>0)){ return false; }

        /* The map is rendered inside the scaled 1080x1920 stage. Convert the
           guardian's viewport rectangle back into map-local logical pixels. */
        const logicalWidth=Number(map.offsetWidth)>0?Number(map.offsetWidth):renderedWidth;
        const logicalHeight=Number(map.offsetHeight)>0?Number(map.offsetHeight):renderedHeight;
        const scaleX=logicalWidth/renderedWidth;
        const scaleY=logicalHeight/renderedHeight;
        const dialogueWidth=Math.max(0,Math.min(logicalWidth,Number(overlay.offsetWidth)||0));
        const dialogueHeight=Math.max(0,Math.min(logicalHeight,Number(overlay.offsetHeight)||0));
        const inset=12;
        const minLeft=Math.min(logicalWidth/2,dialogueWidth/2+inset);
        const maxLeft=Math.max(minLeft,logicalWidth-dialogueWidth/2-inset);
        const minTop=Math.min(logicalHeight,dialogueHeight+inset);
        const maxTop=Math.max(minTop,logicalHeight-inset);
        let desiredLeft=logicalWidth/2;
        let desiredTop=minTop;

        if(bossButton&&typeof bossButton.getBoundingClientRect==="function"){
            const bossRect=bossButton.getBoundingClientRect();
            const bossWidth=Number(bossRect&&bossRect.width);
            const bossLeft=Number(bossRect&&bossRect.left);
            const bossTop=Number(bossRect&&bossRect.top);
            if(Number.isFinite(bossLeft)&&Number.isFinite(bossTop)&&Number.isFinite(bossWidth)){
                desiredLeft=(bossLeft+bossWidth/2-mapRect.left)*scaleX;
                desiredTop=(bossTop-mapRect.top-8)*scaleY;
            }
        }

        const left=Math.max(minLeft,Math.min(maxLeft,desiredLeft))+"px";
        const top=Math.max(minTop,Math.min(maxTop,desiredTop))+"px";
        overlay.style.left=left;
        overlay.style.top=top;
        if(typeof overlay.style.setProperty==="function"){
            /* Final Abyss CSS must override the legacy full-map inset:0 rule.
               Custom properties carry these measured coordinates through that
               important rule without introducing another runtime wrapper. */
            overlay.style.setProperty("--v141-abyss-dialogue-left",left);
            overlay.style.setProperty("--v141-abyss-dialogue-top",top);
        }
        return true;
    }

    function openAbyssBossDialogue(){
        if(abyssBattleStarting||abyssState.phase!=="boss"){ return false; }
        const map=document.getElementById("v141AbyssMap");
        if(!map||map.dataset.v141AbyssDialogueOpening==="1"){ return false; }
        const bossButton=map.querySelector(".v141-abyss-boss");
        const existingDialogue=map.querySelector(".v143-abyss-dialogue");
        if(existingDialogue){
            return positionAbyssBossDialogue(map,existingDialogue,bossButton);
        }
        map.dataset.v141AbyssDialogueOpening="1";
        const floor=Math.max(1,Math.min(5,Number(abyssState.floor)||1));
        const boss=bossButton&&bossButton.querySelector("b");
        const speaker=boss&&boss.textContent||(floor===5?"五帝聯軍":"守關者");
        const lines=(ABYSS_DIALOGUE[floor]||ABYSS_DIALOGUE[1]).slice();
        let index=0;
        const overlay=document.createElement("button");
        overlay.type="button";
        overlay.className="v143-abyss-dialogue";
        overlay.setAttribute("aria-label","守關者對話，點擊繼續");
        overlay.innerHTML='<small>'+escapeHtml(speaker)+'</small><b></b><span>點擊空白處繼續　'+(index+1)+' / '+lines.length+'</span>';
        const text=overlay.querySelector("b");
        const hint=overlay.querySelector("span");
        text.textContent=lines[index];
        const advanceDialogue=()=>{
            index++;
            if(index<lines.length){
                text.textContent=lines[index];
                hint.textContent="點擊空白處繼續　"+(index+1)+" / "+lines.length;
                return;
            }
            text.textContent="進入戰鬥……";
            hint.textContent="";
            overlay.disabled=true;
            activeAbyssDialogueAdvance=null;
            delete map.dataset.v141DialogueOpen;
            setTimeout(()=>{
                overlay.remove();
                launchAbyssBossBattle();
            },180);
        };
        activeAbyssDialogueAdvance=advanceDialogue;
        map.dataset.v141DialogueOpen="1";
        overlay.onclick=event=>{
            event.preventDefault(); event.stopPropagation();
            advanceDialogue();
        };
        map.appendChild(overlay);
        positionAbyssBossDialogue(map,overlay,bossButton);
        delete map.dataset.v141AbyssDialogueOpening;
        return true;
    }

    window.v141ChallengeAbyssBoss=function(){
        return openAbyssBossDialogue();
    };

    window.v141UseAbyssPortal=function(){
        if(abyssState.floor>=5){ return; }
        if(abyssState.phase==="chest"){
            abyssState.message="請先點擊守關者位置的寶箱領取獎勵。";
            persistAbyss(); refreshAbyssPage();
            return;
        }
        if(abyssState.phase!=="portal"){ return; }
        moveAbyssPlayer(50,18,()=>{
            abyssState.floor=Math.min(5,abyssState.floor+1);
            abyssState.phase="boss"; abyssState.x=50; abyssState.y=84; abyssState.message="";
            persistAbyss(); refreshAbyssPage();
        });
    };

    window.v141OpenAbyssChest=function(){
        if(abyssState.phase!=="chest"){ return; }
        const pos=bossPosition(abyssState.floor);
        moveAbyssPlayer(pos[0],Math.min(84,pos[1]+27),()=>{
            const data=definitions();
            const floorTickets={1:"ticketSetEarth",2:"ticketSetFire",3:"ticketSetWind",4:"ticketSetWater"};
            const ticket=abyssState.floor<5
                ?data.tickets.find(item=>item.id===floorTickets[abyssState.floor])
                :data.tickets[Math.floor(Math.random()*data.tickets.length)];
            if(ticket&&window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(ticket,1)){ alert("背包空間不足，請整理後再開啟深淵寶箱。"); return; }
            if(abyssState.floor<5){
                if(ticket&&!addItem(ticket,1)){ alert("背包空間不足，寶箱尚未開啟。"); return; }
                abyssState.phase="portal";
                abyssState.message="寶箱已開啟。請點擊上方傳送點前往下一層。";
                persistAbyss(); rebuildInventorySlots(); saveGame(); refreshAbyssPage();
                if(ticket&&window.v141ShowBlackGoldReward){
                    window.v141ShowBlackGoldReward({
                        exp:0,
                        gold:0,
                        items:[{
                            id:ticket.id,
                            name:ticket.name,
                            count:1,
                            icon:ticket.icon
                        }]
                    });
                }
                return;
            }
            const indexes=getExistingPartyIndexes();
            const avgNeed=indexes.length?indexes.reduce((sum,index)=>sum+(Number(getPartyCharacterByIndex(index).expNext)||0),0)/indexes.length:0;
            const exp=Math.max(300,Math.floor(avgNeed*.45));
            const rewardGold=(2000+window.v141GetHighestCharacterLevel()*50)*5;
            if(ticket&&!addItem(ticket,1)){ alert("背包空間不足，寶箱尚未開啟。"); return; }
            sharedExp+=exp; gold+=rewardGold; abyssState.phase="complete"; abyssState.clears=(abyssState.clears||0)+1;
            persistAbyss(); rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            if(window.v141RecordAbyssClear){ window.v141RecordAbyssClear(); }
            refreshAbyssPage();
            window.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>深淵寶箱</h3><p>獲得 EXP '+exp.toLocaleString('zh-TW')+'<br>金幣 '+rewardGold.toLocaleString('zh-TW')+(ticket?'<br>'+escapeHtml(ticket.name)+' ×1':'')+'</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">收下</button></div></div>');
        });
    };
})();
