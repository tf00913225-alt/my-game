/* Read-only acquisition Owner. Structured reward metadata is generated from gameplay
   definitions by the existing production build; opening this UI never loads grant modules. */
(function(global){
 "use strict";
 const empty="目前版本尚無正式取得途徑";
 const tiers=["white","blue","purple","orange","pink","four-symbol"];
 const fragment=id=>"relicFragment_"+id.replace(/^relic_/,"");
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function getSources(itemOrId){
  const item=typeof itemOrId==="object"?itemOrId:{id:itemOrId},id=String(item?.id||"");
  const data=global.FourSymbolsItemAcquisitionData;if(!data)return [];
  const rows=[];
  const add=row=>rows.push(Object.freeze({itemId:id,availability:"available",...row}));
  for(const row of data.wildDrops){if(row.itemId===id)add({sourceType:"wild",sourceId:"regular-wild",mode:"野怪區",location:"主城 → 野怪區 → 任一區域普通怪",chance:row.chance,quantity:row.quantity,repeatable:true});}
  for(const row of data.eliteDrops){if(row.itemId===id)add({sourceType:"wild",sourceId:"elite-wild",mode:"野怪區",location:"主城 → 野怪區 → 任一區域精英怪",chance:row.chance,quantity:row.quantity,repeatable:true,notes:"精英特殊池單次抽選；81%不掉特殊道具"});}
  if(Object.hasOwn(data.shopPotions,id))add({sourceType:"shop",sourceId:"city-potion-shop",mode:"商店",location:"主城 → 商店 → 補品",quantity:1,chance:1,repeatable:true,notes:"價格依最高已建立角色等級調整"});
  for(const row of data.materialChest){if(row.itemId===id)add({sourceType:"chest",sourceId:"materialChest",chestId:"materialChest",chestName:"材料寶箱",mode:"材料寶箱",quantity:row.amount,chance:row.provisional?null:row.weight/100,provisionalChance:row.weight/100,repeatable:true,notes:"暫定分布"+row.weight+"%；正式掉率待核定"});}
  const oreIds=["oreLow","oreMid","oreHigh","orePerfect","orePink","oreFourSymbol"],oreIndex=oreIds.indexOf(id);
  if(oreIndex>0)add({sourceType:"synthesis",sourceId:"ore-promotion",materialItemId:oreIds[oreIndex-1],mode:"礦石升階",location:"主城 → 合成 → 材料合成",quantity:10,chance:1,repeatable:true,notes:"50個前一階礦石換10個；高階礦石合成不表示材料寶箱開放該階"});
  const talisman=id.match(/^(freeze|stealth|barrier)Talisman(Mid|High|Perfect)$/);
  if(talisman){const tierIndex=["Low","Mid","High","Perfect"].indexOf(talisman[2]);add({sourceType:"synthesis",sourceId:"talisman-promotion",materialItemId:talisman[1]+"Talisman"+["Low","Mid","High"][tierIndex-1],mode:"符咒合成",location:"主城 → 合成 → 符咒合成",quantity:1,chance:1,repeatable:true,notes:"3張同款前一階符咒＋"+data.talismanGold[tiers[tierIndex-1]]+"金幣"});}
  if(id==="materialChest")add({sourceType:"dungeon",sourceId:"material",mode:"材料副本",location:"主城 → 副本 → 每日副本 → 材料副本",quantityRange:[1,3],repeatable:true,chance:1,unlockRequirement:"任一角色Lv.10",notes:"通關3輪；總回合少於15給3箱、15～29給2箱、30以上給1箱；每日1次；可選廣告雙倍"});
  if(id==="equipmentChest")add({sourceType:"dungeon",sourceId:"equipment",mode:"裝備副本",location:"主城 → 副本 → 每日副本 → 裝備副本",quantity:2,chance:1,repeatable:true,unlockRequirement:"任一角色Lv.10",notes:"通關3輪；每日1次；可選廣告雙倍×4"});
  if(/^ticketSet(Fire|Water|Earth|Wind)$/.test(id)){
   for(const difficulty of Object.values(data.abyssDifficulties)){
    const region=data.abyssRegions.find(region=>region.ticketId===id);
    const base={sourceType:"abyss",mode:"深淵",quantity:1,firstClearOnly:true,repeatable:false,unlockRequirement:"任一角色Lv."+difficulty.unlockLevel,notes:"通關該區4場前置戰與帝王戰後，手動領取寶箱；永久領取記錄按難度與區域獨立"};
    if(region)add({...base,sourceId:"abyss-"+difficulty.id+"-"+region.id,location:difficulty.title+" → "+region.name+" → 帝王寶箱",chance:1});
    add({...base,sourceId:"abyss-"+difficulty.id+"-extreme",location:difficulty.title+" → 第五區極帝領域 → 帝王寶箱",chance:.25});
   }
   add({sourceType:"synthesis",sourceId:id.replace('ticket','fragment'),mode:"合成",location:"主城 → 合成 → 碎片合成",quantity:1,chance:1,repeatable:true,notes:"100枚對應系列碎片＋500金幣"});
  }
  for(const [floor,reward] of Object.entries(data.tower.majorMilestones)){if(id===reward.boxId)add({sourceType:"tower",sourceId:"tower-"+floor,mode:"四象塔",floor:Number(floor),quantity:1,chance:1,firstClearOnly:true,repeatable:false,location:"主城 → 玩法 → 四象塔"});}
  const relic=data.relics.find(r=>fragment(r.id)===id||r.id===id);
  if(relic){
   if(id===relic.id){add({sourceType:"synthesis",sourceId:fragment(id),mode:"秘寶合成",location:"主城 → 秘寶 → "+relic.name,quantity:1,chance:1,repeatable:false,notes:"100專屬碎片；最多以100通用碎片替代50專屬碎片"});}
   else{
    for(const [boxId,box] of Object.entries(data.materials.choiceBoxes)){if(tiers.indexOf(relic.rarity)<=tiers.indexOf(box.maxRarity))add({sourceType:"chest",sourceId:boxId,chestId:boxId,chestName:box.name,mode:"秘寶碎片自選箱",quantity:box.fragmentAmount,chance:1,repeatable:false,notes:"開箱手動指定此秘寶"});}
   }
  }
  for(const boss of [...data.personalBosses,...data.worldBosses]){
   const world=boss.id.startsWith("world"),mode=world?"世界Boss":"個人Boss";
   for(const stage of (world?[1,2,3,4]:[1])){
   const cfg=data.difficulties[world?(stage===4?"special":stage===3?"hell":"hard"):boss.level>=100?"special":boss.level>=80?"hell":boss.level>=50?"hard":"normal"];
   const base={sourceType:"boss",sourceId:boss.id,mode,bossId:boss.id,bossName:boss.name,bossLevel:boss.level,stage:world?stage:null,location:"主城 → 玩法 → "+mode,unlockRequirement:"隊伍達到Lv."+boss.level,repeatable:true,notes:world?"第"+stage+"階段通關後":"通關後"};
   if(relic&&id!==relic.id&&(data.bossPools[boss.id]||[]).includes(relic.id)){
    const pool=data.bossPools[boss.id].map(rid=>data.relics.find(r=>r.id===rid)),total=pool.reduce((n,r)=>n+data.rarityWeights[r.rarity],0);
    add({...base,quantityRange:cfg.fragment,chance:data.rarityWeights[relic.rarity]/total*data.rarityChances[relic.rarity]});
   }
   if(id===data.materials.essenceItemId)add({...base,quantityRange:cfg.essence,chance:1});
   if(id===data.materials.universalItemId)add({...base,quantityRange:cfg.universal.count,chance:cfg.universal.chance});
   if(id===data.materials.breakthroughItemId&&cfg.breakthrough.chance)add({...base,quantityRange:cfg.breakthrough.count,chance:cfg.breakthrough.chance});
   if(id===data.materials.breakthroughItemId&&((!world&&boss.level>=70)||(world&&stage===4)))add({...base,quantity:1,chance:1,firstClearOnly:true,repeatable:false,notes:"此階段首通額外保底"});
   if(id===boss.ore&&(!world||stage===4)){
    add({...base,quantity:boss.firstOre,chance:1,firstClearOnly:true,repeatable:false});
    if(!world)add({...base,quantity:1,chance:1,notes:"再戰通關；背包無法放入時改給500金幣"});
   }
   }
  }
  for(let floor=1;floor<=data.tower.floorCount;floor++){
   let quantity=0;
   if(id===data.materials.essenceItemId){quantity=data.tower.essenceByFloor[floor-1];}
   if(id===data.materials.universalItemId&&floor%5===0)quantity=floor%10===0?data.tower.universal.ten[floor-1]:data.tower.universal.five[floor-1];
   if(id===data.materials.breakthroughItemId&&floor%10===0)quantity=data.tower.breakthrough.everyTen;
   if(quantity)add({sourceType:"tower",sourceId:"tower-"+floor,mode:"四象塔",floor,quantity,chance:1,repeatable:true,notes:"每週各層首次通關"});
  }
  for(const [rewardId,reward] of Object.entries(data.adventureRewards))for(const potion of reward.potions||[])if(potion.id===id)add({sourceType:"adventure",sourceId:rewardId,mode:"主線冒險",chapter:1,location:rewardId==="road_chest"?"第一章 → 舊驛箱":rewardId==="chapter_v1_clear"?"第一章主線通關":rewardId,quantity:potion.count,chance:1,firstClearOnly:true,repeatable:false});
  const merchant=data.adventureMerchants.find(row=>row.id===id);
  if(merchant)add({sourceType:"shop",sourceId:"adventure-merchant",mode:"主線冒險",chapter:1,location:"第一章 → 行腳商人",quantity:1,repeatable:false,notes:"商人隨機商品池；庫存"+merchant.quantity+"件；"+merchant.price+"金幣／件",chance:null});
  if(item.v17346GeneratedEquipment){
   const rarity=data.equipmentChest.find(row=>row.key===(item.rarityKey||item.quality));
   if(rarity)add({sourceType:"chest",sourceId:"equipmentChest",chestId:"equipmentChest",chestName:"裝備寶箱",mode:"裝備寶箱",quantity:1,chance:null,notes:"每箱3件隨機裝備；每件"+rarity.label+"機率"+rarity.chance+"%；職業、部位、屬性與數值隨機；此成品無固定命中率",repeatable:true});
   add({sourceType:"shop",sourceId:"equipment-shop",mode:"商店",location:"主城 → 商店 → 裝備",quantity:1,chance:null,repeatable:true,notes:"每日隨機商品；此成品無固定出現機率"});
  }
  if(/^set(Fire|Water|Earth|Wind)_/.test(id))add({sourceType:"chest",sourceId:"ticketSet"+id.slice(3).split('_')[0],chestId:"ticketSet"+id.slice(3).split('_')[0],chestName:"對應系列裝備抽獎券",mode:"系列裝備抽獎券",quantity:1,chance:.1,repeatable:true});
  return rows;
 }
 function formatSource(row){
  const where=row.bossName?row.bossName+" Lv."+row.bossLevel+(row.stage?" 第"+row.stage+"階段":""):row.floor?"第"+row.floor+"層":row.chestName||row.location||row.sourceId;
  const count=row.quantityRange?" ×"+row.quantityRange.join("～"):row.quantity!=null?" ×"+row.quantity:"";
  const chance=row.chance==null?"取得機率尚未定案":row.chance===1?"必定取得":Number((row.chance*100).toFixed(2))+"%機率取得";
  return row.mode+"｜"+(row.firstClearOnly?"首次":"")+where+"，"+chance+count+(row.repeatable?"（可重複）":"")+(row.unlockRequirement?"；解鎖："+row.unlockRequirement:"")+(row.notes?"；"+row.notes:"");
 }
 function trace(item,seen=new Set()){
  const id=String(typeof item==="object"?item.id:item);if(seen.has(id))return [];
  const next=new Set(seen);next.add(id);
  return getSources(item).map(row=>({source:row,parents:row.chestId?trace(row.chestId,next):row.materialItemId?trace(row.materialItemId,next):[]}));
 }
 function renderTree(nodes){return nodes.map(node=>'<p>'+esc(formatSource(node.source))+'</p>'+(node.parents.length?'<div class="v132-preview-section-title">'+esc(node.source.chestName||"所需材料")+'的獲取途徑</div>'+renderTree(node.parents):'')).join('');}
 function show(item){
  const tree=trace(item),name=typeof item==="object"?item.name:item;
  if(typeof global.v132ShowRewardModal!=="function")return false;
  global.v132ShowRewardModal('<div class="v132-reward-modal-inner"><h3>'+esc(name)+'｜獲取途徑</h3><div class="v132-preview-list v132-preview-list-scroll">'+(tree.length?renderTree(tree):'<p>'+empty+'</p>')+'</div><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>');return true;
 }
 global.FourSymbolsItemAcquisition=Object.freeze({getSources,formatSource,trace,show,empty});
 global.showSelectedItemAcquisition=function(){const item=global.FourSymbolsCurrentItemDetail;if(item)show(item);};
})(window);
