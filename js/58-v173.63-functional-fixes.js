/* =====================================================
   V173.63 — requested functional fixes (runtime authority)
   - maximum character, synthesis and dungeon-backpack canvases
   - canonical item art + formal rarity frames
   - premium text-only dungeon reward previews
   - equipment dungeon material drops
   - material promotion synthesis through Four-Symbol tier
===================================================== */
(function installV17363FunctionalFixes(){
"use strict";
if(typeof window==="undefined"||typeof document==="undefined"||window.__v17363FunctionalFixesInstalled){return;}
window.__v17363FunctionalFixesInstalled=true;

const TIER_ORDER=["white","blue","purple","orange","pink","four-symbol"];
const TIER_LABEL={white:"白階",blue:"藍階",purple:"紫階",orange:"橙階",pink:"桃紅階","four-symbol":"四象階"};
const TIER_ALIAS={low:"white",mid:"blue",high:"purple",perfect:"orange"};
const DROP_TIER_LABEL={white:"低階（白階）",blue:"中階（藍階）",purple:"高階（紫階）",orange:"極品（橙階）"};
const EQUIPMENT_DROP_TIERS=[
    {tier:"white",chance:40},
    {tier:"blue",chance:30},
    {tier:"purple",chance:20},
    {tier:"orange",chance:10}
];
const BLUEPRINT_SLOTS=["head","shoulder","armor","shoes","hand"];
const SLOT_LABEL={head:"頭部",shoulder:"護腕",armor:"衣服",shoes:"腳",hand:"武器"};
const MATERIAL_STATE={oreTier:"white",blueprintTier:"white",blueprintSet:"setFire",blueprintSlot:"head"};
let materialTabActive=false;
let equipmentDungeonRunning=false;
let equipmentDungeonWaveIndex=-1;
let repairQueued=false;

function normalizeTier(value){
    const key=String(value||"").toLowerCase();
    return TIER_ALIAS[key]||key;
}
function esc(value){
    return String(value==null?"":value)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function defs(){
    const content=typeof window.v132GetContentDefinitions==="function"?(window.v132GetContentDefinitions()||{}):{};
    return {
        ores:Array.isArray(content.ores)?content.ores:[],
        blueprints:Array.isArray(content.blueprints)?content.blueprints:[],
        talismans:Array.isArray(content.talismans)?content.talismans:[],
        tickets:Array.isArray(content.tickets)?content.tickets:[],
        equipmentSetItems:Array.isArray(content.equipmentSetItems)?content.equipmentSetItems:[]
    };
}
function ownedCount(id){
    if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){return 0;}
    return inventoryItems.reduce((sum,item)=>sum+(item&&item.id===id?Math.max(1,Math.floor(Number(item.count)||1)):0),0);
}
function setImp(node,key,value){if(node&&node.style){node.style.setProperty(key,value,"important");}}
function refreshInventory(){
    if(typeof window.v17361SyncItemArt==="function"){try{window.v17361SyncItemArt();}catch(_){}}
    if(typeof rebuildInventorySlots==="function"){try{rebuildInventorySlots();}catch(_){}}
    if(typeof renderInventoryItems==="function"){try{renderInventoryItems();}catch(_){}}
    else if(typeof renderInventory==="function"){try{renderInventory();}catch(_){}}
    if(typeof updateGoldDisplay==="function"){try{updateGoldDisplay();}catch(_){}}
    if(typeof saveGame==="function"){try{saveGame();}catch(_){}}
}

/* ---------- 2 / 6 / 7. Use the maximum game canvas. ---------- */
function maximizeCharacterPanel(){
    const modal=document.getElementById("homeFeatureModal");
    if(!modal||!modal.classList.contains("show")){return;}
    const box=modal.querySelector(".home-feature-modal-box.wide");
    const body=document.getElementById("homeFeatureModalBody");
    const root=document.getElementById("characterTabContent");
    if(!box||!root){return;}
    setImp(modal,"padding","4px");
    setImp(box,"width","calc(100% - 8px)");
    setImp(box,"max-width","none");
    setImp(box,"height","calc(100% - 8px)");
    setImp(box,"max-height","calc(100% - 8px)");
    setImp(box,"min-height","0");
    setImp(box,"display","flex");
    setImp(box,"flex-direction","column");
    setImp(box,"overflow","hidden");
    setImp(body,"flex","1 1 auto");
    setImp(body,"min-height","0");
    setImp(body,"overflow","hidden");
    setImp(root,"flex","1 1 auto");
    setImp(root,"min-height","0");
    setImp(root,"max-height","none");
    setImp(root,"overflow-x","hidden");
    setImp(root,"overflow-y","auto");
    setImp(root,"touch-action","pan-y");
}
function maximizeSynthesisPanel(){
    const modal=document.getElementById("homeFeatureModal");
    if(!modal||!modal.classList.contains("v141-synthesis-modal")){return;}
    const box=modal.querySelector(".home-feature-modal-box");
    const body=document.getElementById("homeFeatureModalBody");
    setImp(modal,"padding","4px");
    setImp(box,"width","calc(100% - 8px)");
    setImp(box,"max-width","none");
    setImp(box,"height","calc(100% - 8px)");
    setImp(box,"max-height","calc(100% - 8px)");
    setImp(box,"min-height","0");
    setImp(box,"display","flex");
    setImp(box,"flex-direction","column");
    setImp(box,"overflow","hidden");
    setImp(body,"flex","1 1 auto");
    setImp(body,"min-height","0");
    setImp(body,"overflow-x","hidden");
    setImp(body,"overflow-y","auto");
    setImp(body,"touch-action","pan-y");
}
function maximizeDungeonBackpack(){
    const app=document.getElementById("app");
    const page=document.getElementById("inventoryPage");
    if(!app||!page||!app.classList.contains("v141-dungeon-active")||!page.classList.contains("map-inventory-overlay-open")){return;}
    page.classList.add("v169-dungeon-inventory-overlay");
    [["inset","0"],["left","0"],["right","0"],["top","0"],["bottom","0"],["width","100%"],["max-width","none"],["height","100%"],["max-height","none"],["transform","none"],["padding","8px"],["box-sizing","border-box"]].forEach(([k,v])=>setImp(page,k,v));
    const shell=page.querySelector(".inventory-classic-shell");
    setImp(shell,"width","100%");setImp(shell,"max-width","none");setImp(shell,"min-height","100%");setImp(shell,"margin","0");
}

/* ---------- 3 / 7. Canonical item icons and explicit rarity frames. ---------- */
function canonicalDefinition(id){
    const content=defs();
    for(const group of [content.ores,content.blueprints,content.talismans,content.tickets,content.equipmentSetItems]){
        const found=group.find(item=>item&&item.id===id);
        if(found){return found;}
    }
    return null;
}
function syncCanonicalItemArt(){
    if(typeof window.v17361SyncItemArt==="function"){try{window.v17361SyncItemArt();}catch(_){}}
    if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){return;}
    inventoryItems.forEach(item=>{
        if(!item||!item.id){return;}
        const definition=canonicalDefinition(item.id);
        if(definition&&definition.icon){
            item.icon=definition.icon;
            if(definition.tierKey){item.tierKey=normalizeTier(definition.tierKey);}
        }
    });
}
function equipmentArt(item){
    if(!item){return "";}
    if(item.assetPath){
        const rarity=esc(normalizeTier(item.rarityKey||item.quality||item.tierKey||"white"));
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+'"><img src="'+esc(item.assetPath)+'" alt="" draggable="false" onerror="this.hidden=true"></span>';
    }
    return String(item.icon||"");
}
function findOwned(value){
    const key=String(value||"");
    const bag=typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)?inventoryItems:[];
    let found=bag.find(item=>item&&(String(item.id||"")===key||String(item.v141Uid||"")===key));
    if(found){return found;}
    if(typeof characterEquipment!=="undefined"&&characterEquipment){
        for(const slots of Object.values(characterEquipment||{})){
            found=Object.values(slots||{}).find(item=>item&&(String(item.id||"")===key||String(item.v141Uid||"")===key));
            if(found){return found;}
        }
    }
    return null;
}
function pickerArt(value){
    const owned=findOwned(value);
    const definition=canonicalDefinition(owned&&owned.id||value);
    if(definition&&definition.icon){return String(definition.icon);}
    return equipmentArt(owned);
}
function repairPicker(picker){
    const label=picker&&picker.closest("label");
    const select=label&&label.querySelector("select");
    if(!select){return;}
    const options=Array.from(select.options||[]);
    Array.from(picker.querySelectorAll("button")).forEach((button,index)=>{
        const option=options[index];if(!option){return;}
        const host=button.querySelector("i");
        const art=pickerArt(option.value);
        if(host&&art&&host.innerHTML!==art){host.innerHTML=art;}
        button.classList.toggle("selected",String(option.value)===String(select.value));
    });
}
function repairSynthesisIcons(){document.querySelectorAll(".v143-item-picker").forEach(repairPicker);}

/* ---------- 5. Actual text-only premium reward previews (no pseudo-image preview). ---------- */
function previewMarkup(title,eyebrow,groups,note){
    return '<div class="v132-reward-modal-inner v17361-reward-preview v17363-text-reward-preview">'+
        '<div class="v17363-preview-heading"><small>'+esc(eyebrow||"REWARD PREVIEW")+'</small><h3>'+esc(title)+'</h3></div>'+
        '<div class="v17363-preview-groups">'+groups.map(group=>
            '<section class="v17363-preview-group"><b>'+esc(group.title)+'</b>'+
            (group.badge?'<em>'+esc(group.badge)+'</em>':'')+
            '<p>'+esc(group.text)+'</p></section>'
        ).join("")+'</div>'+
        (note?'<div class="v17363-preview-note">'+esc(note)+'</div>':'')+
        '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
}
window.v148ShowDailyDungeonPreview=function(type){
    if(typeof window.v132ShowRewardModal!=="function"){return;}
    const table={
        exp:{title:"經驗副本獎勵預覽",groups:[
            {title:"共用經驗池",badge:"EXP",text:"通關所得經驗直接存入共用經驗池，不綁定單一角色，可自由分配給隊伍角色。"},
            {title:"結算方式",text:"完成副本後直接結算；若該結算提供廣告加倍，可自行選擇是否加倍領取。"}
        ],note:"重點養成資源一眼看懂，不再用獎勵圖片佔據版面。"},
        material:{title:"材料副本獎勵預覽",groups:[
            {title:"材料寶箱",badge:"×1～3",text:"通關回合越少，取得寶箱數越高；寶箱內含礦石、裝備設計圖等養成材料。"},
            {title:"用途",text:"礦石與同部位設計圖可用於裝備製作、冶煉，以及材料升階合成。"}
        ],note:"寶箱數量依副本結算規則決定。"},
        gold:{title:"金幣副本獎勵預覽",groups:[
            {title:"金幣獎勵",badge:"GOLD",text:"依目前副本難度與結算規則獲得金幣，通關後直接入帳。"},
            {title:"加倍選項",text:"若結算提供廣告加倍，可選擇觀看廣告取得加倍金幣，不影響直接領取。"}
        ],note:"僅顯示實際會影響玩家決策的資訊。"}
    };
    const meta=table[type]||table.exp;
    window.v132ShowRewardModal(previewMarkup(meta.title,"DAILY DUNGEON",meta.groups,meta.note));
};

/* ---------- 8. Equipment dungeon art path authority. ---------- */
function ensureFunctionalStyles(){
    if(document.getElementById("v17363-functional-fixes-style")){return;}
    const style=document.createElement("style");
    style.id="v17363-functional-fixes-style";
    style.textContent=`
#game-stage .v169-material-art{box-sizing:border-box!important;border:2px solid currentColor!important;border-radius:8px!important;padding:2px!important;background:#090b0f!important;}
#game-stage .v169-material-art.v169-rarity-white,#game-stage .v169-material-art.v169-rarity-low{color:#D8D8D8!important;border-color:#D8D8D8!important;box-shadow:0 0 7px rgba(216,216,216,.78),inset 0 0 7px rgba(216,216,216,.24)!important;}
#game-stage .v169-material-art.v169-rarity-blue,#game-stage .v169-material-art.v169-rarity-mid{color:#42A5FF!important;border-color:#42A5FF!important;box-shadow:0 0 8px rgba(66,165,255,.88),inset 0 0 7px rgba(66,165,255,.32)!important;}
#game-stage .v169-material-art.v169-rarity-purple,#game-stage .v169-material-art.v169-rarity-high{color:#B05CFF!important;border-color:#B05CFF!important;box-shadow:0 0 8px rgba(176,92,255,.88),inset 0 0 7px rgba(176,92,255,.34)!important;}
#game-stage .v169-material-art.v169-rarity-orange,#game-stage .v169-material-art.v169-rarity-perfect{color:#FF9F38!important;border-color:#FF9F38!important;box-shadow:0 0 9px rgba(255,159,56,.9),inset 0 0 8px rgba(255,159,56,.35)!important;}
#game-stage .v169-material-art.v169-rarity-pink{color:#FF4FA7!important;border-color:#FF4FA7!important;box-shadow:0 0 10px rgba(255,79,167,.92),inset 0 0 8px rgba(255,79,167,.36)!important;}
#game-stage .v169-material-art.v169-rarity-four-symbol{color:#fff!important;border-color:transparent!important;background:linear-gradient(#090b0f,#090b0f) padding-box,conic-gradient(#42A5FF,#47D6A3,#C89B45,#FF5A36,#42A5FF) border-box!important;box-shadow:0 0 9px rgba(255,90,54,.32),0 0 13px rgba(66,165,255,.32)!important;}
#game-stage #homeFeatureModal.v141-synthesis-modal{padding:4px!important;}
#game-stage #homeFeatureModal.v141-synthesis-modal .home-feature-modal-box{width:calc(100% - 8px)!important;max-width:none!important;height:calc(100% - 8px)!important;max-height:calc(100% - 8px)!important;}
#game-stage #dungeonPage:not(.v146-abyss-active) [data-dungeon-cover="equipment"] .v141-dungeon-cover-art{background-image:linear-gradient(180deg,transparent 58%,rgba(7,5,3,.38)),url("assets/dungeons/covers/equipment-v17363.png"),url("assets/dungeons/covers/equipment-v17343.png")!important;background-size:cover!important;background-position:center!important;}
#game-stage .v17363-text-reward-preview{width:min(392px,calc(100% - 18px))!important;max-width:392px!important;padding:18px!important;border:1px solid rgba(213,164,82,.82)!important;border-radius:15px!important;background:radial-gradient(circle at 50% 0,rgba(232,177,77,.16),transparent 36%),linear-gradient(160deg,#22170e,#090807 76%)!important;box-shadow:0 22px 52px rgba(0,0,0,.78),inset 0 0 0 1px rgba(255,231,171,.07)!important;}
#game-stage .v17363-preview-heading{text-align:left;padding-bottom:11px;margin-bottom:11px;border-bottom:1px solid rgba(196,149,75,.4);}
#game-stage .v17363-preview-heading small{display:block;color:#8f7956;font:700 9px/1.2 Cinzel,serif;letter-spacing:.2em;}
#game-stage .v17363-preview-heading h3{margin:4px 0 0;color:#f4d78f;font-family:"Noto Serif TC",serif;font-size:20px;line-height:1.35;letter-spacing:.04em;}
#game-stage .v17363-preview-groups{display:grid;gap:8px;}
#game-stage .v17363-preview-group{position:relative;padding:12px 13px;border:1px solid rgba(119,89,52,.7);border-radius:10px;background:linear-gradient(180deg,rgba(31,23,15,.96),rgba(13,10,8,.98));text-align:left;}
#game-stage .v17363-preview-group b{display:block;padding-right:80px;color:#f0d39a;font-size:14px;line-height:1.4;}
#game-stage .v17363-preview-group em{position:absolute;right:12px;top:11px;color:#e5b966;font:900 11px/1.4 Cinzel,"Noto Sans TC",sans-serif;font-style:normal;}
#game-stage .v17363-preview-group p{margin:6px 0 0;color:#cdbfa7;font-size:12px;line-height:1.72;}
#game-stage .v17363-preview-note{margin:10px 1px 0;padding:8px 10px;border-left:2px solid #b98b45;color:#9f927d;background:rgba(184,134,62,.06);font-size:11px;line-height:1.6;text-align:left;}
#game-stage .v17363-material-synthesis{display:grid;gap:10px;padding-bottom:10px;}
#game-stage .v17363-material-card{padding:13px;border:1px solid rgba(154,112,58,.7);border-radius:11px;background:linear-gradient(180deg,#20170f,#0e0b08);}
#game-stage .v17363-material-card h4{margin:0 0 4px;color:#f0ce85;font:900 16px/1.4 "Noto Serif TC",serif;}
#game-stage .v17363-material-card>p{margin:0 0 10px;color:#9f927f;font-size:11px;line-height:1.55;}
#game-stage .v17363-material-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
#game-stage .v17363-material-controls label{display:grid;gap:4px;color:#bbaa8c;font-size:10px;}
#game-stage .v17363-material-controls select{width:100%;min-height:38px;padding:5px 8px;border:1px solid #76572f;border-radius:7px;color:#ead9b5;background:#0b0907;font-size:12px;}
#game-stage .v17363-material-flow{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:10px 0;padding:10px;border:1px solid rgba(116,87,49,.55);border-radius:9px;background:#090806;}
#game-stage .v17363-material-flow section{display:grid;gap:3px;text-align:center;color:#cab996;font-size:11px;}
#game-stage .v17363-material-flow section b{color:#f1d698;font-size:13px;}
#game-stage .v17363-material-flow i{color:#d3a34f;font-size:19px;font-style:normal;}
#game-stage .v17363-material-card .v17363-craft-button{width:100%;min-height:42px;border:1px solid #b88740;border-radius:8px;color:#1c1207;background:linear-gradient(180deg,#efd17f,#bd7d2c);font-weight:900;}
#game-stage .v17363-material-card .v17363-craft-button:disabled{filter:grayscale(.7);opacity:.45;}
`;
    document.head.appendChild(style);
}

/* ---------- 9. Equipment dungeon drops: ore + blueprint material bundles. ---------- */
function weightedDropTier(){
    const roll=Math.random()*100;let cursor=0;
    for(const entry of EQUIPMENT_DROP_TIERS){cursor+=entry.chance;if(roll<cursor){return entry.tier;}}
    return "orange";
}
function oreByTier(tier){return defs().ores.find(item=>normalizeTier(item&&item.tierKey)===tier)||null;}
function blueprintsBy(tier,setId,slot){
    return defs().blueprints.filter(item=>item&&normalizeTier(item.tierKey)===tier&&(!setId||item.setId===setId)&&(!slot||item.blueprintSlot===slot));
}
function randomBlueprintByTier(tier){
    const slot=BLUEPRINT_SLOTS[Math.floor(Math.random()*BLUEPRINT_SLOTS.length)%BLUEPRINT_SLOTS.length];
    let pool=blueprintsBy(tier,null,slot);
    if(!pool.length){pool=blueprintsBy(tier,null,null);}
    return pool.length?pool[Math.floor(Math.random()*pool.length)%pool.length]:null;
}
function canAdd(definition,amount){return !window.v132CanAddItemToInventory||window.v132CanAddItemToInventory(definition,amount);}
function add(definition,amount){return !!(definition&&window.v132AddItemToInventory&&window.v132AddItemToInventory(definition,amount));}
function equipmentRewardPreviewGroups(){
    const odds=EQUIPMENT_DROP_TIERS.map(x=>DROP_TIER_LABEL[x.tier]+" "+x.chance+"%").join("　・　");
    return [
        {title:"第一種｜礦石",badge:"×10",text:odds+"。每次通關抽取一個階級。"},
        {title:"第二種｜裝備設計圖",badge:"×20",text:odds+"。階級抽取後，頭、護腕、衣服、腳、武器部位隨機；四大系列同步隨機。"}
    ];
}
window.v17346ShowEquipmentDungeonPreview=function(){
    if(typeof window.v132ShowRewardModal!=="function"){return;}
    window.v132ShowRewardModal(previewMarkup("裝備副本獎勵預覽","EQUIPMENT DUNGEON",equipmentRewardPreviewGroups(),"兩種材料獎勵各自獨立抽取；直接領取為礦石 ×10 ＋ 設計圖 ×20。"));
};
function showEquipmentClearReward(){
    if(typeof window.v132ShowRewardModal!=="function"){return;}
    const html='<div class="v132-reward-modal-inner v17363-text-reward-preview"><div class="v17363-preview-heading"><small>EQUIPMENT DUNGEON CLEAR</small><h3>裝備副本挑戰成功</h3></div><div class="v17363-preview-groups">'+
        equipmentRewardPreviewGroups().map(group=>'<section class="v17363-preview-group"><b>'+esc(group.title)+'</b><em>'+esc(group.badge)+'</em><p>'+esc(group.text)+'</p></section>').join("")+
        '</div><div class="v132-reward-actions"><button type="button" onclick="v17363ClaimEquipmentDungeon(false)">直接領取</button><button type="button" onclick="v17363ClaimEquipmentDungeon(true)">看廣告雙倍領取</button></div></div>';
    window.v132ShowRewardModal(html);
}
function grantEquipmentMaterials(multiplier){
    const multi=Math.max(1,Math.floor(Number(multiplier)||1));
    const oreTier=weightedDropTier();
    const blueprintTier=weightedDropTier();
    const ore=oreByTier(oreTier);
    const blueprint=randomBlueprintByTier(blueprintTier);
    const oreQty=10*multi,blueprintQty=20*multi;
    if(!ore||!blueprint){alert("裝備副本獎勵資料尚未就緒，請重新進入副本。");return false;}
    if(!canAdd(ore,oreQty)||!canAdd(blueprint,blueprintQty)){alert("背包空間不足，請先整理背包。");return false;}
    const transaction=window.v132RunInventoryTransaction||function(operation){return !!operation();};
    const success=transaction(()=>add(ore,oreQty)&&add(blueprint,blueprintQty));
    if(!success){alert("獎勵寫入失敗，背包已還原，請再試一次。");return false;}
    refreshInventory();
    if(typeof window.v132CloseRewardModal==="function"){window.v132CloseRewardModal();}
    const message="獲得「"+ore.name+"」×"+oreQty+"\n獲得「"+blueprint.name+"」×"+blueprintQty;
    if(typeof window.rpgAlert==="function"){void window.rpgAlert(message,{title:"裝備副本獎勵",confirmText:"知道了",tone:"success"});}
    if(typeof showPage==="function"){showPage("dungeon");}
    if(typeof switchDungeonTab==="function"){switchDungeonTab("daily");}
    return true;
}
window.v17363ClaimEquipmentDungeon=function(doubled){
    if(doubled&&typeof showRewardedAd==="function"){
        showRewardedAd(()=>grantEquipmentMaterials(2),()=>alert("廣告未完成，未獲得雙倍獎勵。"));
        return;
    }
    grantEquipmentMaterials(1);
};
/* Retain the old public name only as a forwarder so any cached button cannot
   grant the obsolete six random-equipment reward. */
window.v17346ClaimEquipmentDungeon=window.v17363ClaimEquipmentDungeon;

if(typeof applyPostBattleAutoRecovery==="function"&&!applyPostBattleAutoRecovery.__v17363EquipmentDungeon){
    const previousRecovery=applyPostBattleAutoRecovery;
    const guardedRecovery=function(){
        if(equipmentDungeonRunning&&equipmentDungeonWaveIndex>=0&&equipmentDungeonWaveIndex<2){return;}
        return previousRecovery.apply(this,arguments);
    };
    guardedRecovery.__v17363EquipmentDungeon=true;
    applyPostBattleAutoRecovery=guardedRecovery;
    window.applyPostBattleAutoRecovery=guardedRecovery;
}
window.v17346BeginEquipmentDungeon=async function(){
    if(equipmentDungeonRunning||typeof window.v148BuildDailyDungeonWaves!=="function"||typeof window.v132LaunchDungeonBattle!=="function"){return;}
    const built=window.v148BuildDailyDungeonWaves("gold");
    const waves=built&&Array.isArray(built.waves)?built.waves:[];
    if(waves.length!==3){return;}
    const accepted=typeof window.rpgConfirm==="function"?await window.rpgConfirm(
        "裝備副本共3輪，每輪6名敵人。\n通關固定獲得兩種材料：礦石 ×10 與隨機部位裝備設計圖 ×20。\n是否開始挑戰？",
        {title:"裝備副本",confirmText:"開始挑戰",cancelText:"取消"}
    ):true;
    if(!accepted){return;}
    equipmentDungeonRunning=true;
    const launch=index=>{
        equipmentDungeonWaveIndex=index;
        const started=window.v132LaunchDungeonBattle(waves[index],function(outcome){
            const won=outcome&&outcome.result==="win";
            if(!won){
                equipmentDungeonRunning=false;equipmentDungeonWaveIndex=-1;
                if(typeof showPage==="function"){showPage("dungeon");}
                if(typeof switchDungeonTab==="function"){switchDungeonTab("daily");}
                return;
            }
            if(index<2){setTimeout(()=>launch(index+1),320);return;}
            equipmentDungeonRunning=false;equipmentDungeonWaveIndex=-1;showEquipmentClearReward();
        });
        if(started===false){equipmentDungeonRunning=false;equipmentDungeonWaveIndex=-1;}
    };
    launch(0);
};

/* ---------- 10. Material promotion: 50 same-tier -> 10 next-tier. ---------- */
function nextTier(tier){const index=TIER_ORDER.indexOf(normalizeTier(tier));return index>=0&&index<TIER_ORDER.length-1?TIER_ORDER[index+1]:null;}
function blueprintDef(tier,setId,slot){return blueprintsBy(normalizeTier(tier),setId,slot)[0]||null;}
function setOptions(){
    const map=new Map();
    defs().blueprints.forEach(item=>{if(item&&item.setId&&!map.has(item.setId)){const prefix=String(item.name||"").replace(/(白階|藍階|紫階|橙階|桃紅階|四象階).*$/,'');map.set(item.setId,prefix||item.setId);}});
    return [...map.entries()];
}
function tierOptions(selected){
    return TIER_ORDER.slice(0,-1).map(tier=>'<option value="'+tier+'" '+(tier===selected?'selected':'')+'>'+TIER_LABEL[tier]+' → '+TIER_LABEL[nextTier(tier)]+'</option>').join("");
}
function renderMaterialSynthesis(){
    const body=document.querySelector("#homeFeatureModalBody .v141-synthesis-body");
    if(!body){return;}
    const oreSource=oreByTier(MATERIAL_STATE.oreTier),oreTarget=oreByTier(nextTier(MATERIAL_STATE.oreTier));
    const bpSource=blueprintDef(MATERIAL_STATE.blueprintTier,MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    const bpTarget=blueprintDef(nextTier(MATERIAL_STATE.blueprintTier),MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    const sets=setOptions();
    body.innerHTML='<div class="v17363-material-synthesis">'+
        '<section class="v17363-material-card"><h4>礦石升階</h4><p>同階礦石 50 個，可合成下一階礦石 10 個；最高可合至四象階。</p><div class="v17363-material-controls"><label>升階路線<select onchange="v17363SetMaterialOption(\'oreTier\',this.value)">'+tierOptions(MATERIAL_STATE.oreTier)+'</select></label></div>'+materialFlow(oreSource,oreTarget)+
        '<button class="v17363-craft-button" type="button" '+(!oreSource||ownedCount(oreSource.id)<50?'disabled':'')+' onclick="v17363CraftMaterial(\'ore\')">合成下一階礦石 ×10</button></section>'+
        '<section class="v17363-material-card"><h4>設計圖升階</h4><p>同系列、同部位、同階設計圖 50 張，可合成下一階同款設計圖 10 張。</p><div class="v17363-material-controls">'+
        '<label>系列<select onchange="v17363SetMaterialOption(\'blueprintSet\',this.value)">'+sets.map(([id,label])=>'<option value="'+esc(id)+'" '+(id===MATERIAL_STATE.blueprintSet?'selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label>'+
        '<label>部位<select onchange="v17363SetMaterialOption(\'blueprintSlot\',this.value)">'+BLUEPRINT_SLOTS.map(slot=>'<option value="'+slot+'" '+(slot===MATERIAL_STATE.blueprintSlot?'selected':'')+'>'+SLOT_LABEL[slot]+'</option>').join("")+'</select></label>'+
        '<label>升階路線<select onchange="v17363SetMaterialOption(\'blueprintTier\',this.value)">'+tierOptions(MATERIAL_STATE.blueprintTier)+'</select></label></div>'+materialFlow(bpSource,bpTarget)+
        '<button class="v17363-craft-button" type="button" '+(!bpSource||ownedCount(bpSource.id)<50?'disabled':'')+' onclick="v17363CraftMaterial(\'blueprint\')">合成下一階設計圖 ×10</button></section></div>';
    repairSynthesisIcons();
}
function materialFlow(source,target){
    const sourceCount=source?ownedCount(source.id):0;
    return '<div class="v17363-material-flow"><section>'+(source&&source.icon||'')+'<b>'+esc(source&&source.name||"來源未建立")+'</b><span>'+sourceCount+' / 50</span></section><i>→</i><section>'+(target&&target.icon||'')+'<b>'+esc(target&&target.name||"已達最高階")+'</b><span>×10</span></section></div>';
}
window.v17363SetMaterialOption=function(key,value){
    if(!Object.prototype.hasOwnProperty.call(MATERIAL_STATE,key)){return;}
    MATERIAL_STATE[key]=String(value||"");renderMaterialSynthesis();
};
window.v17363CraftMaterial=function(kind){
    const isOre=kind==="ore";
    const tier=isOre?MATERIAL_STATE.oreTier:MATERIAL_STATE.blueprintTier;
    const targetTier=nextTier(tier);
    const source=isOre?oreByTier(tier):blueprintDef(tier,MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    const target=isOre?oreByTier(targetTier):blueprintDef(targetTier,MATERIAL_STATE.blueprintSet,MATERIAL_STATE.blueprintSlot);
    if(!source||!target||!targetTier){alert("此道具已達最高可合成階級。");return false;}
    if(ownedCount(source.id)<50){alert("素材不足，需要「"+source.name+"」×50。");return false;}
    if(!canAdd(target,10)){alert("背包空間不足，無法放入合成結果。");return false;}
    const transaction=window.v132RunInventoryTransaction||function(operation){return !!operation();};
    const success=transaction(()=>window.v132ConsumeStackItem&&window.v132ConsumeStackItem(source.id,50)&&add(target,10));
    if(!success){alert("材料合成失敗，素材已自動還原。");return false;}
    refreshInventory();
    renderMaterialSynthesis();
    if(typeof window.rpgAlert==="function"){void window.rpgAlert("消耗「"+source.name+"」×50\n獲得「"+target.name+"」×10",{title:"材料合成成功",confirmText:"知道了",tone:"success"});}
    return true;
};
function ensureMaterialTab(){
    const tabs=document.querySelector("#homeFeatureModalBody .v141-synthesis-tabs");
    if(!tabs){return;}
    let button=tabs.querySelector('[data-v17363-material-tab="1"]');
    if(!button){
        button=document.createElement("button");button.type="button";button.dataset.v17363MaterialTab="1";button.textContent="材料合成";button.onclick=window.v17363OpenMaterialSynthesis;tabs.appendChild(button);
    }
    Array.from(tabs.querySelectorAll("button")).forEach(item=>item.classList.toggle("active",materialTabActive&&item===button||!materialTabActive&&item!==button&&item.classList.contains("active")));
    if(materialTabActive){Array.from(tabs.querySelectorAll("button")).forEach(item=>item.classList.toggle("active",item===button));}
}
const originalRenderSynthesis=typeof window.v141RenderSynthesis==="function"?window.v141RenderSynthesis:null;
const originalSwitchSynthesis=typeof window.v141SwitchSynthesisTab==="function"?window.v141SwitchSynthesisTab:null;
window.v17363OpenMaterialSynthesis=function(){
    materialTabActive=true;
    if(originalRenderSynthesis){originalRenderSynthesis();}
    ensureMaterialTab();renderMaterialSynthesis();maximizeSynthesisPanel();
};
if(originalRenderSynthesis){
    window.v141RenderSynthesis=function(){
        const result=originalRenderSynthesis.apply(this,arguments);
        ensureMaterialTab();if(materialTabActive){renderMaterialSynthesis();}scheduleRepairs();return result;
    };
}
if(originalSwitchSynthesis){
    window.v141SwitchSynthesisTab=function(){
        materialTabActive=false;const result=originalSwitchSynthesis.apply(this,arguments);ensureMaterialTab();scheduleRepairs();return result;
    };
}

/* ---------- 4. Force current return artwork on patrol/dungeon navigation. ---------- */
function syncReturnIcons(){
    document.querySelectorAll('img[src*="map-return.png"],img[src*="patrol-back.png"]').forEach(img=>{
        if(img.src&&!/assets\/ui\/map-return\.png(?:\?|$)/.test(img.getAttribute("src")||"")){img.setAttribute("src","assets/ui/map-return.png");}
    });
}

function runRepairs(){
    repairQueued=false;ensureFunctionalStyles();syncCanonicalItemArt();maximizeCharacterPanel();maximizeSynthesisPanel();maximizeDungeonBackpack();repairSynthesisIcons();ensureMaterialTab();syncReturnIcons();
}
function scheduleRepairs(){
    if(repairQueued){return;}repairQueued=true;
    if(typeof requestAnimationFrame==="function"){requestAnimationFrame(runRepairs);}else{setTimeout(runRepairs,0);}
}

/* Re-run after the established owners render or move the shared DOM. */
["renderInventoryItems","renderInventory","rebuildInventorySlots","openMapInventoryOverlay"].forEach(name=>{
    const previous=window[name];if(typeof previous!=="function"||previous.__v17363Wrapped){return;}
    const wrapped=function(){const result=previous.apply(this,arguments);scheduleRepairs();return result;};wrapped.__v17363Wrapped=true;window[name]=wrapped;
    try{if(name in globalThis){globalThis[name]=wrapped;}}catch(_){ }
});

ensureFunctionalStyles();runRepairs();
if(typeof MutationObserver!=="undefined"&&document.body){new MutationObserver(scheduleRepairs).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});}
document.addEventListener("click",scheduleRepairs,true);document.addEventListener("change",scheduleRepairs,true);window.addEventListener("resize",scheduleRepairs,{passive:true});
})();