/*
   V141 — synthesis and five-floor Abyss dungeon.
   This layer reuses V132 inventory/dungeon bridges and keeps the legacy combat
   engine intact.
*/
(function installV141ContentSystems(){
    "use strict";

    const ABYSS_STORAGE_KEY="v141_abyss_state";
    const TIER_ORDER=["low","mid","high","perfect"];
    const TIER_META={
        low:{label:"低階",craftGold:500,reforgeGold:1000,main:[1,5],reforgeMain:[1,3]},
        mid:{label:"中階",craftGold:1500,reforgeGold:3000,main:[3,8],reforgeMain:[2,5]},
        high:{label:"高階",craftGold:4000,reforgeGold:8000,main:[5,11],sub:[1,3],reforgeMain:[4,7],reforgeSub:[1,2]},
        perfect:{label:"極品",craftGold:10000,reforgeGold:20000,main:[7,14],sub:[2,5],reforgeMain:[6,10],reforgeSub:[2,4]}
    };
    const SLOT_META={
        head:{label:"頭部",type:"head",glyph:"冠"},
        shoulder:{label:"護腕",type:"shoulder",glyph:"腕"},
        shoes:{label:"鞋子",type:"shoes",glyph:"履"},
        hand:{label:"武器",type:"weapon",glyph:"刃"},
        armor:{label:"衣服",type:"armor",glyph:"甲"}
    };
    const SERIES=[
        {setId:"setFire",label:"赤炎",element:"fire",color:"#e24b32"},
        {setId:"setWater",label:"寒泉",element:"water",color:"#4bb9e8"},
        {setId:"setEarth",label:"岩岳",element:"earth",color:"#c59a54"},
        {setId:"setWind",label:"青嵐",element:"wind",color:"#55cda3"}
    ];
    const STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",energy:"能量",agility:"敏捷",spirit:"精神"};
    const MAIN_STATS=["attack","intelligence"];
    const SUB_STATS=["vitality","energy","agility","spirit"];
    const TALISMAN_GOLD={low:300,mid:1000,high:3000};
    const synthesisState={
        tab:"craft",blueprintId:null,seriesId:"setFire",reforgeUid:null,
        talismanId:null,talismanQty:1,fragmentQty:{setFire:1,setWater:1,setEarth:1,setWind:1},
        pendingReforge:null
    };

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

    function allRefinableEquipment(){
        ensureEquipmentUids();
        const results=[];
        inventoryItems.forEach(item=>{
            if(item&&isEquipmentInventoryType(item.type)){ results.push({item,source:"背包"}); }
        });
        Object.keys(characterEquipment||{}).forEach(characterKey=>{
            Object.values(characterEquipment[characterKey]||{}).forEach(item=>{
                if(item){ results.push({item,source:"已裝備"}); }
            });
        });
        return results;
    }
    function findEquipmentByUid(uid){
        const entry=allRefinableEquipment().find(candidate=>candidate.item.v141Uid===uid);
        return entry?entry.item:null;
    }

    function inferTier(item){
        if(item&&TIER_META[item.tierKey]){ return item.tierKey; }
        if(item&&item.setId){ return "high"; }
        const total=Object.values(item&&item.stats||{}).reduce((sum,value)=>sum+Math.abs(Number(value)||0),0);
        if(total>=18){ return "perfect"; }
        if(total>=10){ return "high"; }
        if(total>=5){ return "mid"; }
        return "low";
    }

    function rollUniform(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
    function rollSinglePeak(range){
        return Math.random()<.10?range[1]:rollUniform(range[0],Math.max(range[0],range[1]-1));
    }
    function rollAffixes(tierKey,isReforge){
        const meta=TIER_META[tierKey];
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

    function statsHtml(stats){
        const entries=Object.entries(stats||{});
        if(!entries.length){ return '<span class="muted">尚無冶煉詞條</span>'; }
        return entries.map(([key,value])=>'<span>'+escapeHtml(STAT_LABEL[key]||key)+' <b>+'+value+'</b></span>').join("");
    }
    function rangeText(tierKey,isReforge){
        const meta=TIER_META[tierKey];
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
            ["craft","裝備合成"],["reforge","裝備冶煉"],["talisman","符咒合成"],["fragment","碎片合成"]
        ];
        return '<div class="v141-synthesis-tabs">'+tabs.map(([id,label])=>
            '<button type="button" class="'+(synthesisState.tab===id?'active':'')+'" onclick="v141SwitchSynthesisTab(\''+id+'\')">'+label+'</button>'
        ).join("")+'</div>';
    }

    function heldBlueprints(){
        const byId=new Map();
        inventoryItems.forEach(item=>{
            if(!item||!item.blueprintSlot||!TIER_META[item.tierKey]){ return; }
            if(!byId.has(item.id)){ byId.set(item.id,item); }
        });
        return [...byId.values()];
    }

    function renderCraftTab(){
        const blueprints=heldBlueprints();
        if(!blueprints.length){
            return '<div class="v141-synthesis-empty">背包內沒有裝備設計圖紙。<small>材料寶箱可取得圖紙與礦石。</small></div>';
        }
        if(!blueprints.some(item=>item.id===synthesisState.blueprintId)){ synthesisState.blueprintId=blueprints[0].id; }
        const blueprint=blueprints.find(item=>item.id===synthesisState.blueprintId);
        const tier=blueprint.tierKey;
        const meta=TIER_META[tier];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const blueprintSeries=SERIES.find(item=>item.setId===blueprint.setId)||null;
        const series=blueprintSeries||SERIES.find(item=>item.setId===synthesisState.seriesId)||SERIES[0];
        const ore=definitions().ores.find(item=>item.tierKey===tier);
        const blueprintCount=countItem(blueprint.id);
        const oreCount=ore?countItem(ore.id):0;
        const canCraft=blueprintCount>=50&&oreCount>=50&&gold>=meta.craftGold&&inventoryItems.length<120;
        return '<div class="v141-synthesis-card">'+
            '<label>1　選擇設計圖紙<select onchange="v141SelectCraftBlueprint(this.value)">'+blueprints.map(item=>
                '<option value="'+escapeHtml(item.id)+'" '+(item.id===blueprint.id?'selected':'')+'>'+escapeHtml(item.name)+'（'+countItem(item.id)+'）</option>'
            ).join("")+'</select></label>'+
            (blueprintSeries
                ?'<div class="v141-blueprint-series"><span>2　裝備系列</span><b>'+series.label+'（由圖紙決定）</b></div>'
                :'<label>2　舊圖紙系列<select onchange="v141SelectCraftSeries(this.value)">'+SERIES.map(item=>
                    '<option value="'+item.setId+'" '+(item.setId===series.setId?'selected':'')+'>'+item.label+'</option>'
                ).join("")+'</select><small>僅舊存檔既有圖紙沒有系列欄位；新取得圖紙會自動指定系列。</small></label>')+
            '<section class="v141-craft-preview"><div class="v141-craft-icon">'+svgIcon(slot.glyph,series.color)+'</div><div><b>'+series.label+meta.label+slot.label+'</b><span>'+rangeText(tier,false)+'</span></div></section>'+
            '<div class="v141-material-lines"><span>圖紙 <b class="'+(blueprintCount>=50?'ok':'lack')+'">'+blueprintCount+' / 50</b></span>'+
            '<span>'+escapeHtml(ore&&ore.name||meta.label+'礦石')+' <b class="'+(oreCount>=50?'ok':'lack')+'">'+oreCount+' / 50</b></span>'+
            '<span>金幣 <b class="'+(gold>=meta.craftGold?'ok':'lack')+'">'+meta.craftGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<button type="button" class="v141-synthesis-primary" '+(canCraft?'':'disabled')+' onclick="v141CraftEquipment()">開始合成</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">ⓘ 詞條機率</button></div>';
    }

    function renderReforgeTab(){
        const entries=allRefinableEquipment();
        if(!entries.length){ return '<div class="v141-synthesis-empty">沒有可冶煉的裝備。</div>'; }
        if(!entries.some(entry=>entry.item.v141Uid===synthesisState.reforgeUid)){ synthesisState.reforgeUid=entries[0].item.v141Uid; }
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        const tier=inferTier(item);
        const meta=TIER_META[tier];
        const blueprintCount=countMatching(candidate=>candidate.blueprintSlot&&candidate.tierKey===tier);
        const ore=definitions().ores.find(candidate=>candidate.tierKey===tier);
        const oreCount=ore?countItem(ore.id):0;
        const can=blueprintCount>=100&&oreCount>=100&&gold>=meta.reforgeGold;
        let compare="";
        if(synthesisState.pendingReforge&&synthesisState.pendingReforge.uid===item.v141Uid){
            compare='<div class="v141-reforge-compare"><section><small>目前冶煉效果</small>'+statsHtml(item.reforgeStats)+'</section><b>VS</b><section><small>本次新效果</small>'+statsHtml(synthesisState.pendingReforge.stats)+'</section>'+
                '<div><button onclick="v141ResolveReforge(false)">保留原效果</button><button onclick="v141ResolveReforge(true)">套用新效果</button></div></div>';
        }
        return '<div class="v141-synthesis-card">'+
            '<label>選擇裝備<select onchange="v141SelectReforgeItem(this.value)">'+entries.map(entry=>
                '<option value="'+entry.item.v141Uid+'" '+(entry.item.v141Uid===item.v141Uid?'selected':'')+'>'+escapeHtml(entry.item.name)+'［'+entry.source+'］</option>'
            ).join("")+'</select></label>'+
            '<section class="v141-reforge-current"><b>'+escapeHtml(item.name)+'</b><small>'+meta.label+'・'+rangeText(tier,true)+'</small><div><em>原始詞條</em>'+statsHtml(item.stats)+'</div><div><em>目前冶煉</em>'+statsHtml(item.reforgeStats)+'</div></section>'+
            '<div class="v141-material-lines"><span>同階圖紙 <b class="'+(blueprintCount>=100?'ok':'lack')+'">'+blueprintCount+' / 100</b></span>'+
            '<span>'+escapeHtml(ore&&ore.name||meta.label+'礦石')+' <b class="'+(oreCount>=100?'ok':'lack')+'">'+oreCount+' / 100</b></span>'+
            '<span>金幣 <b class="'+(gold>=meta.reforgeGold?'ok':'lack')+'">'+meta.reforgeGold.toLocaleString('zh-TW')+'</b></span></div>'+
            '<button type="button" class="v141-synthesis-primary" '+(can&&!synthesisState.pendingReforge?'':'disabled')+' onclick="v141StartReforge()">開始冶煉</button>'+
            '<button type="button" class="v141-affix-info" onclick="v141ShowAffixInfo()">ⓘ 詞條機率</button>'+compare+'</div>';
    }

    function availableTalismans(){
        return definitions().talismans.filter(item=>item.tierKey!=="perfect"&&countItem(item.id)>0);
    }
    function nextTalisman(source){
        if(!source){ return null; }
        const nextTier=TIER_ORDER[TIER_ORDER.indexOf(source.tierKey)+1];
        return definitions().talismans.find(item=>item.talismanEffect===source.talismanEffect&&item.tierKey===nextTier)||null;
    }
    function renderTalismanTab(){
        const list=availableTalismans();
        if(!list.length){ return '<div class="v141-synthesis-empty">沒有可升階的低／中／高階符咒。</div>'; }
        if(!list.some(item=>item.id===synthesisState.talismanId)){ synthesisState.talismanId=list[0].id; synthesisState.talismanQty=1; }
        const source=list.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        const owned=countItem(source.id);
        const max=Math.min(Math.floor(owned/3),Math.floor(gold/TALISMAN_GOLD[source.tierKey]));
        synthesisState.talismanQty=Math.max(1,Math.min(Math.max(1,max),synthesisState.talismanQty));
        const qty=synthesisState.talismanQty;
        const can=max>=qty&&target;
        return '<div class="v141-synthesis-card v141-talisman-craft">'+
            '<label>選擇符咒<select onchange="v141SelectTalisman(this.value)">'+list.map(item=>
                '<option value="'+item.id+'" '+(item.id===source.id?'selected':'')+'>'+escapeHtml(item.name)+'（'+countItem(item.id)+'）</option>'
            ).join("")+'</select></label>'+
            '<div class="v141-upgrade-flow"><section>'+source.icon+'<b>'+escapeHtml(source.name)+' ×'+(qty*3)+'</b></section><i>→</i><section>'+target.icon+'<b>'+escapeHtml(target.name)+' ×'+qty+'</b></section></div>'+
            '<div class="v141-quantity"><button onclick="v141AdjustTalismanQty(-1)">－</button><strong>'+qty+'</strong><button onclick="v141AdjustTalismanQty(1)">＋</button><button onclick="v141AdjustTalismanQty(\'max\')">MAX</button></div>'+
            '<div class="v141-material-lines"><span>持有 '+owned+'</span><span>消耗 '+(qty*3)+'</span><span>金幣 '+(TALISMAN_GOLD[source.tierKey]*qty).toLocaleString('zh-TW')+'</span></div>'+
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

    function renderSynthesis(){
        const body=document.getElementById("homeFeatureModalBody");
        if(!body){ return; }
        const content={craft:renderCraftTab,reforge:renderReforgeTab,talisman:renderTalismanTab,fragment:renderFragmentTab}[synthesisState.tab]();
        body.innerHTML='<div class="v141-synthesis"><div class="v141-synthesis-wallet"><span>合成</span><b>金幣 '+Math.floor(gold).toLocaleString('zh-TW')+'</b></div>'+renderSynthesisTabs()+'<div class="v141-synthesis-body">'+content+'</div></div>';
    }
    window.v141RenderSynthesis=renderSynthesis;
    window.v141SwitchSynthesisTab=function(tab){ synthesisState.tab=tab; synthesisState.pendingReforge=null; renderSynthesis(); };
    window.v141SelectCraftBlueprint=function(id){ synthesisState.blueprintId=id; renderSynthesis(); };
    window.v141SelectCraftSeries=function(id){ synthesisState.seriesId=id; renderSynthesis(); };
    window.v141SelectReforgeItem=function(uid){ synthesisState.reforgeUid=uid; synthesisState.pendingReforge=null; renderSynthesis(); };
    window.v141SelectTalisman=function(id){ synthesisState.talismanId=id; synthesisState.talismanQty=1; renderSynthesis(); };

    window.v141AdjustTalismanQty=function(change){
        const source=definitions().talismans.find(item=>item.id===synthesisState.talismanId);
        if(!source){ return; }
        const max=Math.min(Math.floor(countItem(source.id)/3),Math.floor(gold/TALISMAN_GOLD[source.tierKey]));
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
        const lines=TIER_ORDER.map(tier=>'<div><b>'+TIER_META[tier].label+'</b>　合成：'+rangeText(tier,false)+'　／　冶煉：'+rangeText(tier,true)+'</div>').join('');
        window.v132ShowRewardModal('<div class="v132-reward-modal-inner v141-affix-modal"><h3>詞條機率</h3><p>主詞條：攻擊／智力。<br>副詞條：體質／能量／敏捷／精神。</p>'+lines+'<p>單詞條最高值固定10%；雙詞條同時最高固定5%，失敗後的一般抽取不會再次產生雙峰頂。</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">返回</button></div></div>');
    };

    window.v141CraftEquipment=function(){
        const blueprint=heldBlueprints().find(item=>item.id===synthesisState.blueprintId);
        if(!blueprint){ return; }
        const series=SERIES.find(item=>item.setId===(blueprint.setId||synthesisState.seriesId))||SERIES[0];
        const tier=blueprint.tierKey;
        const meta=TIER_META[tier];
        const slot=SLOT_META[blueprint.blueprintSlot]||SLOT_META.hand;
        const ore=definitions().ores.find(item=>item.tierKey===tier);
        if(!ore||countItem(blueprint.id)<50||countItem(ore.id)<50||gold<meta.craftGold){ alert("素材或金幣不足。"); return; }
        const stats=rollAffixes(tier,false);
        const item={
            id:makeUid("crafted"),v141Uid:makeUid("gear"),name:series.label+meta.label+slot.label,
            icon:svgIcon(slot.glyph,series.color),type:slot.type,setId:series.setId,tierKey:tier,
            levelRequirement:1,price:0,count:1,stats:stats,reforgeStats:null,v141Crafted:true
        };
        if(window.v132CanAddItemToInventory&&!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return; }
        const success=runInventoryTransaction(()=>{
            return window.v132ConsumeStackItem(blueprint.id,50)&&window.v132ConsumeStackItem(ore.id,50)&&addItem(item,1);
        });
        if(!success){ alert("合成失敗，素材已自動還原。"); return; }
        gold-=meta.craftGold;
        rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
        showSynthesisResult("合成成功",'<div class="v141-result-item">'+item.icon+'<b>'+escapeHtml(item.name)+'</b>'+statsHtml(stats)+'</div>');
    };

    window.v141StartReforge=function(){
        const item=findEquipmentByUid(synthesisState.reforgeUid);
        if(!item||synthesisState.pendingReforge){ return; }
        const tier=inferTier(item);
        const meta=TIER_META[tier];
        const ore=definitions().ores.find(candidate=>candidate.tierKey===tier);
        const hasBlueprint=countMatching(candidate=>candidate.blueprintSlot&&candidate.tierKey===tier)>=100;
        if(!ore||!hasBlueprint||countItem(ore.id)<100||gold<meta.reforgeGold){ alert("同階素材或金幣不足。"); return; }
        const success=runInventoryTransaction(()=>consumeMatching(candidate=>candidate.blueprintSlot&&candidate.tierKey===tier,100)&&window.v132ConsumeStackItem(ore.id,100));
        if(!success){ alert("冶煉素材扣除失敗，已自動還原。"); return; }
        gold-=meta.reforgeGold;
        synthesisState.pendingReforge={uid:item.v141Uid,stats:rollAffixes(tier,true)};
        rebuildInventorySlots(); updateGoldDisplay(); saveGame(); renderSynthesis();
    };

    window.v141ResolveReforge=function(applyNew){
        const pending=synthesisState.pendingReforge;
        if(!pending){ return; }
        const item=findEquipmentByUid(pending.uid);
        if(applyNew&&item){ item.reforgeStats=Object.assign({},pending.stats); }
        synthesisState.pendingReforge=null;
        saveGame(); updateUI(); renderSynthesis();
        showSynthesisResult(applyNew?"已套用新冶煉效果":"已保留原冶煉效果",applyNew&&item?'<div class="v141-result-item"><b>'+escapeHtml(item.name)+'</b>'+statsHtml(item.reforgeStats)+'</div>':'<p>本次材料與金幣已消耗，原有效果維持不變。</p>');
    };

    window.v141CraftTalismans=function(){
        const source=definitions().talismans.find(item=>item.id===synthesisState.talismanId);
        const target=nextTalisman(source);
        if(!source||!target){ return; }
        const qty=Math.max(1,synthesisState.talismanQty);
        const cost=TALISMAN_GOLD[source.tierKey]*qty;
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
                "確定分解「"+item.name+"」？\n將固定獲得"+fragment.name+"×10，裝備無法復原。",
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
            return addItem(fragment,10);
        });
        if(!success){ alert("背包空間不足，分解已取消。"); return; }
        closeItemModal(); rebuildInventorySlots(); saveGame(); renderInventory();
        alert("分解完成，獲得"+fragment.name+"×10。");
    };

    if(typeof openHomeFeature==="function"){
        const originalOpenHomeFeature=openHomeFeature;
        openHomeFeature=function(type){
            if(type!=="synthesis"){ return originalOpenHomeFeature.apply(this,arguments); }
            closeHomeFeature();
            const modal=document.getElementById("homeFeatureModal");
            const title=document.getElementById("homeFeatureModalTitle");
            if(title){ title.textContent="合成"; }
            if(modal){ modal.classList.add("show","v141-synthesis-modal"); }
            ensureEquipmentUids();
            renderSynthesis();
        };
    }
    if(typeof closeHomeFeature==="function"){
        const originalCloseHomeFeature=closeHomeFeature;
        closeHomeFeature=function(){
            const modal=document.getElementById("homeFeatureModal");
            if(modal){ modal.classList.remove("v141-synthesis-modal"); }
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
    function persistAbyss(){ try{ localStorage.setItem(ABYSS_STORAGE_KEY,JSON.stringify(abyssState)); }catch(_){ } }

    const abyssFloors={
        1:{boss:"東帝",element:"earth",skills:["flyingSandStrike","dustStorm","stoneSlash"],eliteSkill:"petrifyFist",taunts:["凡人也敢踏入帝境？","黃沙會埋葬你的名字。","先過天兵這一關再說！"]},
        2:{boss:"南帝",element:"fire",skills:["explosiveFlurry","dragonSlash","fireRocket"],eliteSkill:"fireCritical",taunts:["烈火會把你的勇氣燒光。","再向前一步，便是灰燼。","你撐不過南天之焰！"]},
        3:{boss:"天帝",element:"wind",skills:["windHowlLightning","stormFlurry","windCrossSlash"],eliteSkill:"stormFist",taunts:["風起之時，無人能立。","你的招式太慢了。","天威不是凡人能挑戰的！"]},
        4:{boss:"北帝",element:"water",skills:["floodBeast","frostPunch","waterKnife"],eliteSkill:"waterBall",taunts:["寒泉已封住你的退路。","讓冰霜替你長眠。","北境之前，止步吧！"]}
    };
    const elementLabel={fire:"火",water:"水",earth:"土",wind:"風",light:"光"};

    function makeAbyssMonster(name,level,element,rank,extraHp,skills,forceLevel){
        const monster=window.v132BuildDungeonMonster(name,level,element,rank);
        monster.maxHP+=extraHp;
        monster.hp=monster.maxHP;
        monster.v141Abyss=true;
        monster.v141ForceSkillLevel=forceLevel;
        monster.skillIds=(skills||[]).slice();
        monster.skillChance=.78;
        monster.activeBuffs=[];
        return monster;
    }

    function buildAbyssRoster(floor){
        const level=window.v132GetDungeonMonsterLevel?window.v132GetDungeonMonsterLevel():Math.max(1,window.v141GetHighestCharacterLevel());
        if(floor<5){
            const data=abyssFloors[floor];
            const boss=makeAbyssMonster(data.boss,level,data.element,"boss",5000,data.skills,1);
            const roster=[boss];
            for(let i=0;i<4;i++){
                roster.push(makeAbyssMonster("天兵天將",level,data.element,"elite",2500,[data.eliteSkill],1));
            }
            return roster;
        }

        const roster=[];
        const bossSpecs=[
            ["東帝天尊","earth",["dustStorm","stoneBreakSky"],["barrier"]],
            ["天帝天尊","wind",["stormRain","stormSpell"],["dinghaishenzhen"]],
            ["極帝天尊","light",[],["yuanXiangGuangMing","yuanGuangShield"]],
            ["北帝天尊","water",["iceArrowRain","freeze"],["healSpell"]],
            ["南帝天尊","fire",["phoenixCry","dragonSlash"],["rage"]]
        ];
        bossSpecs.forEach((spec,position)=>{
            const monster=makeAbyssMonster(spec[0],level,spec[1],"boss",10000,spec[2],5);
            monster.v141SupportSkillIds=spec[3];
            if(spec[0]==="極帝天尊"){ monster.v141AbyssAi="support"; monster.skillChance=1; }
            monster.v141FormationRow=0;
            monster.v141FormationPosition=position;
            roster.push(monster);
        });
        const elites=[
            ["water","frostCrush"],["earth","stoneThrow"],["fire","fireCritical"],["wind",null],["water","frostCrush"]
        ];
        elites.forEach((spec,position)=>{
            const monster=makeAbyssMonster("天兵天將",level,spec[0],"elite",3500,spec[1]?[spec[1]]:[],1);
            if(spec[0]==="wind"){ monster.v141SupportSkillIds=["dodgeSkill"]; }
            monster.v141FormationRow=1;
            monster.v141FormationPosition=position;
            roster.push(monster);
        });
        return roster;
    }

    function monsterBaseHp(monster){
        const shield=monster&&monster.v141Shield;
        return shield?Math.max(0,monster.hp-(shield.remaining||0)):monster.hp;
    }

    function applyTimedMonsterBuff(monstersToBuff,type,turns,amount){
        monstersToBuff.forEach(monster=>{
            if(!monster||!monster.alive||monster.v141TeamBuffs?.some(buff=>buff.type===type&&buff.turnsLeft>0)){ return; }
            monster.v141TeamBuffs=monster.v141TeamBuffs||[];
            const buff={type,turnsLeft:turns,amount};
            if(type==="rage"){
                buff.originalAttack=monster.attack; buff.originalMagicAttack=monster.magicAttack;
                monster.attack=Math.round(monster.attack*(1+amount/100));
                monster.magicAttack=Math.round(monster.magicAttack*(1+amount/100));
            }else if(type==="resistance"){
                monster.resistance=(Number(monster.resistance)||0)+amount;
            }else if(type==="dodge"){
                buff.originalEvasion=monster.evasion;
                monster.evasion=Math.round((Number(monster.evasion)||0)*(1+amount/100));
            }
            const displayBuff={
                type:type==="rage"?"rage":"v141TeamBuff",
                v141BuffType:type,
                turnsLeft:turns
            };
            buff.displayBuff=displayBuff;
            monster.v141TeamBuffs.push(buff);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(displayBuff);
        });
    }

    window.v141TryMonsterSpecialAction=function(monsterIndex){
        const monster=monsters[monsterIndex];
        const supportIds=monster&&monster.v141SupportSkillIds||[];
        if(!monster||!monster.alive||!supportIds.length||Math.random()>.55){ return false; }
        const allies=currentBattleMonsters.map(index=>monsters[index]).filter(item=>item&&item.alive);
        let skillId=null;
        let target=null;
        if(supportIds.includes("healSpell")){
            target=allies.sort((a,b)=>monsterBaseHp(a)/(a.v141Shield?a.v141Shield.baseMaxHP:a.maxHP)-monsterBaseHp(b)/(b.v141Shield?b.v141Shield.baseMaxHP:b.maxHP))[0];
            const max=target&&(target.v141Shield?target.v141Shield.baseMaxHP:target.maxHP);
            if(target&&monsterBaseHp(target)<max){ skillId="healSpell"; }
        }
        if(!skillId&&supportIds.includes("barrier")){
            target=allies.find(item=>!(item.v141Shield&&item.v141Shield.isBarrier));
            if(target){ skillId="barrier"; }
        }
        if(!skillId&&supportIds.includes("rage")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="rage"&&buff.turnsLeft>0))){ skillId="rage"; }
        if(!skillId&&supportIds.includes("dinghaishenzhen")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="resistance"&&buff.turnsLeft>0))){ skillId="dinghaishenzhen"; }
        if(!skillId&&supportIds.includes("dodgeSkill")&&!allies.some(item=>item.v141TeamBuffs?.some(buff=>buff.type==="dodge"&&buff.turnsLeft>0))){ skillId="dodgeSkill"; }
        if(!skillId){ return false; }
        const skill=skillDatabase[skillId];
        if(monster.sp<(skill.spCost||0)){ return false; }
        monster.sp-=skill.spCost||0;
        showMonsterSkillNameBadge(skill.name,skill.element||monster.element,monsterIndex);
        if(skillId==="healSpell"){
            const healed=window.v141HealMonsterPreservingShield(target,350);
            addBattleLog(monster.name+"施放治療術，為"+target.name+"回復"+healed+" HP。");
        }else if(skillId==="barrier"){
            window.v141ApplyMonsterShield(target,999999,4);
            target.v141Shield.isBarrier=true;
            addBattleLog(monster.name+"為"+target.name+"施放結界，完全防護4回合。");
        }else if(skillId==="rage"){
            applyTimedMonsterBuff(allies,"rage",2,50);
            addBattleLog(monster.name+"施放怒火，敵方全體攻擊提升2回合。");
        }else if(skillId==="dinghaishenzhen"){
            applyTimedMonsterBuff(allies,"resistance",3,35);
            addBattleLog(monster.name+"施放氣定神閒，敵方全體抗性提升3回合。");
        }else if(skillId==="dodgeSkill"){
            applyTimedMonsterBuff(allies,"dodge",2,30);
            addBattleLog(monster.name+"施放閃躲術，敵方全體閃躲提升2回合。");
        }
        updateUI(); finishPlayerAction();
        return true;
    };

    let lastAbyssBuffTick="";
    if(typeof startTurn==="function"){
        const originalStartTurn=startTurn;
        startTurn=function(token){
            const key=token+":"+turn;
            if(key!==lastAbyssBuffTick){
                lastAbyssBuffTick=key;
                currentBattleMonsters.forEach(index=>{
                    const monster=monsters[index];
                    if(!monster||!monster.v141Abyss||!monster.v141TeamBuffs){ return; }
                    monster.v141TeamBuffs.forEach(buff=>{
                        if(turn>1){ buff.turnsLeft--; }
                        if(buff.displayBuff){ buff.displayBuff.turnsLeft=buff.turnsLeft; }
                        if(buff.turnsLeft>0){ return; }
                        if(buff.type==="rage"){
                            monster.attack=buff.originalAttack; monster.magicAttack=buff.originalMagicAttack;
                        }else if(buff.type==="resistance"){
                            monster.resistance=Math.max(0,(Number(monster.resistance)||0)-buff.amount);
                        }else if(buff.type==="dodge"){
                            monster.evasion=buff.originalEvasion;
                        }
                    });
                    monster.v141TeamBuffs=monster.v141TeamBuffs.filter(buff=>buff.turnsLeft>0);
                    monster.activeBuffs=(monster.activeBuffs||[]).filter(buff=>{
                        if(!buff||buff.turnsLeft<=0){ return false; }
                        if(buff.type==="v141TeamBuff"){
                            return monster.v141TeamBuffs.some(team=>team.displayBuff===buff);
                        }
                        if(buff.type==="rage"){
                            return monster.v141TeamBuffs.some(team=>team.displayBuff===buff);
                        }
                        return true;
                    });
                });
            }
            return originalStartTurn.apply(this,arguments);
        };
    }

    function bossPosition(){ return [50,33]; }
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
        const boss=abyssState.phase==="boss"?'<button type="button" class="v141-abyss-boss" data-abyss-boss-control="true" style="left:'+pos[0]+'%;top:'+pos[1]+'%" onclick="v141HandleAbyssBossInteraction(event)"><b>'+escapeHtml(info.boss)+'</b><span>'+elementLabel[info.element]+'元素・點擊挑戰</span></button>':'';
        const hasFloorReward=floor<5&&(abyssState.phase==="chest"||abyssState.phase==="portal");
        const portal=hasFloorReward?'<button class="v141-abyss-portal'+(abyssState.phase==="chest"?' locked':'')+'" style="left:50%;top:10%" aria-disabled="'+(abyssState.phase==="chest"?'true':'false')+'" onclick="event.stopPropagation();v141UseAbyssPortal()"><i></i><span>'+(abyssState.phase==="chest"?'先開啟寶箱':'前往下一層')+'</span></button>':'';
        const showChest=abyssState.phase==="chest"||abyssState.phase==="portal";
        const chest=showChest?'<button class="v141-abyss-chest'+(abyssState.phase==="portal"?' open':'')+'" style="left:'+pos[0]+'%;top:'+pos[1]+'%" '+(abyssState.phase==="portal"?'aria-disabled="true"':'onclick="event.stopPropagation();v141OpenAbyssChest()"')+'><i></i><span>'+(abyssState.phase==="portal"?'寶箱已開啟':'深淵寶箱')+'</span></button>':'';
        return '<div class="v141-abyss-shell"><header><b>深淵 第'+floor+'/5層</b><span>'+escapeHtml(abyssState.message||'點擊地面移動角色')+'</span></header>'+
            '<div id="v141AbyssMap" class="v141-abyss-map floor-'+floor+'" onclick="v141AbyssMoveByEvent(event)">'+
            '<div id="v141AbyssSpeech" class="v141-abyss-speech"></div>'+boss+portal+chest+
            '<div id="v141AbyssPlayer" class="v141-abyss-player" style="left:'+abyssState.x+'%;top:'+abyssState.y+'%"><span></span><small>玩家</small></div></div></div>';
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
            if(page!=="dungeon"&&page!=="battle"){ abyssMapEntered=false; }
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
        setTimeout(()=>{ playerEl.classList.remove("walking"); if(callback){ callback(); } },duration*1000+30);
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
        if(abyssState.phase!=="boss"){ return false; }
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
            });
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
        const lines=(ABYSS_DIALOGUE[floor]||ABYSS_DIALOGUE[1]).slice();
        let index=0;
        const overlay=document.createElement("button");
        overlay.type="button";
        overlay.className="v143-abyss-dialogue";
        overlay.setAttribute("aria-label","守關者對話，點擊繼續");
        overlay.innerHTML='<small>'+escapeHtml(boss&&boss.textContent||"守關者")+'</small><b></b><span>點擊對話繼續　'+(index+1)+' / '+lines.length+'</span>';
        const text=overlay.querySelector("b");
        const hint=overlay.querySelector("span");
        text.textContent=lines[index];
        overlay.onclick=event=>{
            event.preventDefault(); event.stopPropagation();
            index++;
            if(index<lines.length){
                text.textContent=lines[index];
                hint.textContent="點擊對話繼續　"+(index+1)+" / "+lines.length;
                return;
            }
            text.textContent="進入戰鬥……";
            hint.textContent="";
            overlay.disabled=true;
            setTimeout(()=>{
                overlay.remove();
                launchAbyssBossBattle();
            },180);
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
            const exp=Math.max(100,Math.floor(avgNeed*.15));
            const rewardGold=2000+window.v141GetHighestCharacterLevel()*50;
            if(ticket&&!addItem(ticket,1)){ alert("背包空間不足，寶箱尚未開啟。"); return; }
            sharedExp+=exp; gold+=rewardGold; abyssState.phase="complete"; abyssState.clears=(abyssState.clears||0)+1;
            persistAbyss(); rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            if(window.v141RecordAbyssClear){ window.v141RecordAbyssClear(); }
            refreshAbyssPage();
            window.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>深淵寶箱</h3><p>獲得 EXP '+exp.toLocaleString('zh-TW')+'<br>金幣 '+rewardGold.toLocaleString('zh-TW')+(ticket?'<br>'+escapeHtml(ticket.name)+' ×1':'')+'</p><div class="v132-reward-actions"><button onclick="v132CloseRewardModal()">收下</button></div></div>');
        });
    };
})();
