/* =====================================================
   V173.63 — requested functional fixes (runtime authority)
   - maximum character canvas
   - canonical item art + formal rarity frames
   - premium text-only daily dungeon reward previews
===================================================== */
(function installV17363FunctionalFixes(){
"use strict";
if(typeof window==="undefined"||typeof document==="undefined"||window.__v17363FunctionalFixesInstalled){return;}
window.__v17363FunctionalFixesInstalled=true;

const TIER_ALIAS={low:"white",mid:"blue",high:"purple",perfect:"orange"};

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
function setImp(node,key,value){if(node&&node.style){node.style.setProperty(key,value,"important");}}
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
/* ---------- 5. Actual text-only premium reward previews (no pseudo-image preview). ---------- */
function previewMarkup(title,eyebrow,groups,note){
    return '<div class="v132-reward-modal-inner v17361-reward-preview v17363-text-reward-preview">'+
        '<div class="v17363-preview-heading"><small>'+esc(eyebrow||"獎勵預覽")+'</small><h3>'+esc(title)+'</h3></div>'+
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
        ],note:"共用經驗可於角色頁分配，用於角色升級。"},
        material:{title:"材料副本獎勵預覽",groups:[
            {title:"材料寶箱",badge:"×1～3",text:"通關回合越少，取得寶箱數越高；寶箱內含白／藍／紫／橙階礦石、基礎／30%／50%補品及還魂丹；分布暫定。"},
            {title:"用途",text:"礦石可用於冶煉與礦石升階；補品與還魂丹供戰鬥使用。裝備設計圖已取消。"}
        ],note:"寶箱數量依副本結算規則決定。"},
        gold:{title:"金幣副本獎勵預覽",groups:[
            {title:"金幣獎勵",badge:"金幣",text:"依目前副本難度與結算規則獲得金幣，通關後直接入帳。"},
            {title:"加倍選項",text:"若結算提供廣告加倍，可選擇觀看廣告取得加倍金幣，不影響直接領取。"}
        ],note:"金幣數量依目前副本難度與結算結果決定。"}
    };
    const meta=table[type]||table.exp;
    window.v132ShowRewardModal(previewMarkup(meta.title,"日常副本",meta.groups,meta.note));
};

/* ---------- 8. Equipment dungeon art path authority. ---------- */
function ensureFunctionalStyles(){
    if(document.getElementById("v17363-functional-fixes-style")){return;}
    const style=document.createElement("style");
    style.id="v17363-functional-fixes-style";
    style.textContent=`
:is(#game-stage,#game-ui) .v169-material-art:not(.inventory-backpack-rarity-neutral){box-sizing:border-box!important;border:calc(2 * var(--ui-length-unit,1px)) solid currentColor!important;border-radius:calc(8 * var(--ui-length-unit,1px))!important;padding:calc(2 * var(--ui-length-unit,1px))!important;background:#090b0f!important;}
:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-white:not(.inventory-backpack-rarity-neutral),:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-low:not(.inventory-backpack-rarity-neutral){color:#D8D8D8!important;border-color:#D8D8D8!important;box-shadow:0 0 calc(7 * var(--ui-length-unit,1px)) rgba(216,216,216,.78),inset 0 0 calc(7 * var(--ui-length-unit,1px)) rgba(216,216,216,.24)!important;}
:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-blue:not(.inventory-backpack-rarity-neutral),:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-mid:not(.inventory-backpack-rarity-neutral){color:#42A5FF!important;border-color:#42A5FF!important;box-shadow:0 0 calc(8 * var(--ui-length-unit,1px)) rgba(66,165,255,.88),inset 0 0 calc(7 * var(--ui-length-unit,1px)) rgba(66,165,255,.32)!important;}
:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-purple:not(.inventory-backpack-rarity-neutral),:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-high:not(.inventory-backpack-rarity-neutral){color:#B05CFF!important;border-color:#B05CFF!important;box-shadow:0 0 calc(8 * var(--ui-length-unit,1px)) rgba(176,92,255,.88),inset 0 0 calc(7 * var(--ui-length-unit,1px)) rgba(176,92,255,.34)!important;}
:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-orange:not(.inventory-backpack-rarity-neutral),:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-perfect:not(.inventory-backpack-rarity-neutral){color:#FF9F38!important;border-color:#FF9F38!important;box-shadow:0 0 calc(9 * var(--ui-length-unit,1px)) rgba(255,159,56,.9),inset 0 0 calc(8 * var(--ui-length-unit,1px)) rgba(255,159,56,.35)!important;}
:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-pink:not(.inventory-backpack-rarity-neutral){color:#FF4FA7!important;border-color:#FF4FA7!important;box-shadow:0 0 calc(10 * var(--ui-length-unit,1px)) rgba(255,79,167,.92),inset 0 0 calc(8 * var(--ui-length-unit,1px)) rgba(255,79,167,.36)!important;}
:is(#game-stage,#game-ui) .v169-material-art.v169-rarity-four-symbol:not(.inventory-backpack-rarity-neutral){color:#fff!important;border-color:transparent!important;background:linear-gradient(#090b0f,#090b0f) padding-box,conic-gradient(#42A5FF,#47D6A3,#C89B45,#FF5A36,#42A5FF) border-box!important;box-shadow:0 0 calc(9 * var(--ui-length-unit,1px)) rgba(255,90,54,.32),0 0 calc(13 * var(--ui-length-unit,1px)) rgba(66,165,255,.32)!important;}
#game-stage #dungeonPage:not(.v146-abyss-active) [data-dungeon-cover="equipment"] .v141-dungeon-cover-art{background-image:linear-gradient(180deg,transparent 58%,rgba(7,5,3,.38)),url("assets/dungeons/covers/equipment-v17363.png"),url("assets/dungeons/covers/equipment-v17343.png")!important;background-size:cover!important;background-position:center!important;}

`;
    document.head.appendChild(style);
}

/* ---------- 4. Force current return artwork on patrol/dungeon navigation. ---------- */
function syncReturnIcons(){
    document.querySelectorAll('img[src*="map-return.png"]').forEach(img=>{
        if(img.src&&!/assets\/ui\/map-return\.png(?:\?|$)/.test(img.getAttribute("src")||"")){img.setAttribute("src","assets/ui/map-return.png");}
    });
}

function runRepairs(){
    ensureFunctionalStyles();syncCanonicalItemArt();maximizeCharacterPanel();syncReturnIcons();
}
window.v17363SyncFunctionalFixes=runRepairs;
ensureFunctionalStyles();runRepairs();
})();
