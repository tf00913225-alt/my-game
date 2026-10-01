/* V173.51 — backpack compare / lock / shared quick-sell modal */
(function(){
"use strict";
if(typeof window==="undefined"||window.__v17351InventoryQaInstalled)return;
window.__v17351InventoryQaInstalled=true;
const TYPES=new Set(["head","shoulder","shoes","weapon","hand","armor"]),QUICK_SELL_QUALITY_KEYS=["white","blue","purple","orange","pink","four-symbol"],QUICK_SELL_QUALITY_KEY=window.FourSymbolsAccountSave.accountKey("bulk-sell-quality");
const num=v=>Number.isFinite(Number(v))?Number(v):0,integer=(v,f=0)=>Math.max(0,Math.floor(Number.isFinite(Number(v))?Number(v):f));
const alertRpg=(m,o)=>typeof window.rpgAlert==="function"?window.rpgAlert(m,o||{}):Promise.resolve(),confirmRpg=(m,o)=>typeof window.rpgConfirm==="function"?window.rpgConfirm(m,o||{}):Promise.resolve(false);
function equipment(i){if(!i)return false;try{if(typeof isEquipmentInventoryType==="function")return !!isEquipmentInventoryType(i.type)}catch(_){}return TYPES.has(String(i.type||""));}
function quality(i){if(!i)return null;return typeof getInventoryRarityDataKey==="function"?getInventoryRarityDataKey(i):String(i.rarityKey||i.quality||"").toLowerCase()||null;}
function locked(i){return !!(i&&i.v17351Locked===true)}
function statText(i){const all=Object.assign({},i?.stats||{});Object.entries(i?.reforgeStats||{}).forEach(([k,v])=>all[k]=num(all[k])+num(v));const L={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",energy:"能量",defensePoints:"防禦",accuracy:"命中",evasion:"閃避",antiCrit:"抗暴",statusAccuracy:"異常命中",statusResistance:"異常抗性"};const a=Object.entries(all).filter(([,v])=>num(v)!==0).map(([k,v])=>(L[k]||k)+" "+(num(v)>0?"+":"")+num(v));return a.length?a.join("　"):"無額外能力";}
const SLOT_ALIAS={weapon:"hand",hand:"hand",head:"head",helmet:"head",shoulder:"shoulder",wristguard:"shoulder",armor:"armor",robe:"armor",shoes:"shoes",boots:"shoes"};
const SLOT_STORAGE_ALIASES={hand:["hand","weapon"],head:["head","helmet"],shoulder:["shoulder","wristguard"],armor:["armor","robe"],shoes:["shoes","boots"]};
const SLOT_LABEL={head:"頭部",hand:"武器",shoulder:"護腕",armor:"衣服",shoes:"鞋子"};
const COMPARE_STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",agility:"敏捷",energy:"能量",defensePoints:"防禦",accuracy:"命中",evasion:"閃避",antiCrit:"抗暴",statusAccuracy:"異常命中",statusResistance:"異常抗性"};
function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function slot(t){const key=String(t||"").toLowerCase();return SLOT_ALIAS[key]||key}
function equippedFor(i){if(!i||typeof characterEquipment==="undefined")return null;let k=null;try{k=typeof getBackpackEquipmentKey==="function"?getBackpackEquipmentKey(typeof inventoryCharacterIndex!=="undefined"?inventoryCharacterIndex:0):null}catch(_){}if(!k)return null;const slots=characterEquipment[k]||{},target=slot(i.type),keys=SLOT_STORAGE_ALIASES[target]||[target];for(const key of keys){if(slots[key])return slots[key]}return null;}
function itemArt(i){if(!i)return"";if(i.assetPath){const q=quality(i)||"white";return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+esc(q)+'"><img src="'+esc(i.assetPath)+'" alt="" draggable="false" decoding="async"></span>'}return String(i.icon||"◆")}
function compareStats(i){if(!i)return '<div class="v17351-compare-empty">未穿戴此部位裝備</div>';const all=Object.assign({},i.stats||{});Object.entries(i.reforgeStats||{}).forEach(([k,v])=>all[k]=num(all[k])+num(v));const rows=Object.entries(all).filter(([,v])=>num(v)!==0).map(([k,v])=>'<div class="v17351-compare-stat"><span>'+esc(COMPARE_STAT_LABEL[k]||k)+'</span><b>'+(num(v)>0?"+":"")+num(v)+'</b></div>');return rows.length?rows.join(""):'<div class="v17351-compare-empty">無額外能力</div>'}
function saveRefresh(){if(typeof rebuildInventorySlots==="function")rebuildInventorySlots();if(typeof renderInventoryItems==="function")renderInventoryItems();if(typeof renderInventory==="function")renderInventory();if(typeof updateUI==="function")updateUI();if(typeof saveGame==="function")saveGame();}
function clearEquipmentComparison(){const modal=document.getElementById("itemModal");if(!modal)return;modal.querySelectorAll("#v17351EquipmentCompare,#v17351EquipmentLockButton").forEach(n=>n.remove());modal.classList.remove("v17351-equipment-comparison","v17351-locked-equipment");}
function syncDetail(item,slotIndex){
const modal=document.getElementById("itemModal"),buttons=modal?.querySelector?.(".item-modal-buttons");if(!modal||!buttons)return;
clearEquipmentComparison();
if(!equipment(item))return;
const worn=equippedFor(item),targetSlot=slot(item.type),box=document.createElement("section");
const sourceIcon=modal.querySelector("#itemModalIcon"),sourceName=modal.querySelector("#itemModalName"),sourceStats=modal.querySelector("#itemModalStats");
const selectedArt=itemArt(item);
const selectedName=sourceName&&sourceName.textContent?sourceName.textContent:String(item.name||"背包装備");
const selectedStats=sourceStats&&sourceStats.innerHTML?sourceStats.innerHTML:compareStats(item);
box.id="v17351EquipmentCompare";box.className="v17351-equipment-compare";
box.innerHTML='<header class="v17351-compare-header"><div><small>EQUIPMENT COMPARE</small><b>裝備比較</b><span>同部位對照・'+esc(SLOT_LABEL[targetSlot]||targetSlot)+'</span></div><button class="v17351-compare-back" type="button" onclick="closeItemModal()">返回</button></header>'+
'<div class="v17351-compare-grid">'+
'<article class="v17351-compare-pane selected"><em>背包装備</em><div class="v17351-compare-art">'+selectedArt+'</div><strong>'+esc(selectedName)+'</strong><div class="v17351-compare-stats selected-stats">'+selectedStats+'</div></article>'+
'<article class="v17351-compare-pane current"><em>目前裝備</em>'+(worn?'<div class="v17351-compare-art">'+itemArt(worn)+'</div><strong>'+esc(worn.name||"目前裝備")+'</strong><div class="v17351-compare-stats">'+compareStats(worn)+'</div>':'<div class="v17351-compare-art empty">—</div><strong>此部位尚未裝備</strong><div class="v17351-compare-stats">'+compareStats(null)+'</div>')+'</article></div>';
buttons.parentNode.insertBefore(box,buttons);modal.classList.add("v17351-equipment-comparison");
const b=document.createElement("button");b.id="v17351EquipmentLockButton";b.type="button";b.className="item-modal-button v17351-lock-button"+(locked(item)?" locked":"");b.textContent=locked(item)?"🔒 已鎖定・點擊解除":"🔓 鎖定裝備";b.onclick=()=>{item.v17351Locked=!locked(item);if(typeof saveGame==="function")saveGame();syncDetail(item,slotIndex);syncSellUi();};buttons.appendChild(b);modal.classList.toggle("v17351-locked-equipment",locked(item));
}
if(typeof window.openItemModal==="function"){const old=window.openItemModal;window.openItemModal=function(idx){const r=old.apply(this,arguments);const hasSelected=typeof selectedInventorySlot!=="undefined"&&selectedInventorySlot!==null&&Number.isInteger(Number(selectedInventorySlot)),selected=hasSelected?Number(selectedInventorySlot):Number(idx),i=typeof inventorySlots!=="undefined"?inventorySlots[selected]:null;syncDetail(i,selected);return r}}
/* Equipped slots are already the reference side; comparing them against themselves is meaningless.
   Always strip the backpack-only comparison after the canonical equipped-item modal opens. */
if(typeof window.openEquippedItem==="function"){const old=window.openEquippedItem;window.openEquippedItem=function(){const r=old.apply(this,arguments);clearEquipmentComparison();return r}}
if(typeof window.sellSelectedItem==="function"){const old=window.sellSelectedItem;window.sellSelectedItem=async function(){const i=typeof selectedInventorySlot!=="undefined"&&selectedInventorySlot!==null&&typeof inventorySlots!=="undefined"?inventorySlots[selectedInventorySlot]:null;if(locked(i)){await alertRpg("這件裝備已鎖定，請先解除鎖定後才能出售。",{title:"裝備已鎖定",confirmText:"知道了",danger:true});return false}return old.apply(this,arguments)}}
function selectedForge(){const s=["#v141ReforgeItemSelect","#reforgeItemSelect",'select[onchange*="v141SelectReforgeItem"]'].map(x=>document.querySelector(x)).find(Boolean);if(!s||typeof inventoryItems==="undefined")return null;const v=String(s.value||""),nidx=Number(v);if(Number.isInteger(nidx)&&nidx>=0&&inventoryItems[nidx])return inventoryItems[nidx];return inventoryItems.find(i=>i&&[i.v141Uid,i.uid,i.id].some(x=>x!=null&&String(x)===v))||null;}
if(typeof window.v141StartReforge==="function"){const old=window.v141StartReforge;window.v141StartReforge=function(){const i=selectedForge();if(locked(i)){void alertRpg("這件裝備已鎖定，無法進行冶煉。\n請先在背包解除鎖定。",{title:"裝備已鎖定",confirmText:"知道了",danger:true});return false}return old.apply(this,arguments)}}
function writeQuickSellQuality(value){const quality=QUICK_SELL_QUALITY_KEYS.includes(value)?value:"white";try{localStorage.setItem(QUICK_SELL_QUALITY_KEY,quality)}catch(_){}return quality;}
function syncSellUi(){if(typeof window.v17350SyncQuickSellModal==="function")window.v17350SyncQuickSellModal();}
window.v17351ToggleQualityMenu=()=>{};
window.v17351ChooseQuality=v=>{const s=document.getElementById("v17350QuickSellQuality");if(s){s.value=writeQuickSellQuality(v);s.dispatchEvent(new Event("change"))}syncSellUi()};
/* Backpack geometry is owned by the canonical inventory CSS and render lifecycle. */
syncSellUi();
})();
