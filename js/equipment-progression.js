/* =====================================================
   Equipment progression authority
   - delegates elemental set data to the formal set definitions
   - explicit reforge-slot rule
   - ordinary equipment generator shared by shop + equipment chests
   - equipment dungeon chest rewards
===================================================== */
(function installEquipmentProgression(){
    "use strict";
    if(typeof window==="undefined"||window.__equipmentProgressionInstalled){ return; }
    window.__equipmentProgressionInstalled=true;

    const RARITIES=[
        {key:"white",label:"白階",min:5,max:10,reforgeSlots:1,available:true},
        {key:"blue",label:"藍階",min:11,max:16,reforgeSlots:1,available:true},
        {key:"purple",label:"紫階",min:17,max:22,reforgeSlots:2,available:true},
        {key:"orange",label:"橙階",min:23,max:28,reforgeSlots:2,available:true},
        {key:"pink",label:"桃紅階",reforgeSlots:3,available:false,planned:true},
        {key:"four-symbol",label:"四象階",reforgeSlots:5,available:false,planned:true,fourSymbol:true}
    ];
    RARITIES.forEach(rarity=>{ rarity.color=window.getEquipmentNameColor({rarityKey:rarity.key}); });
    const RARITY_BY_KEY=Object.fromEntries(RARITIES.map(item=>[item.key,item]));
    const EQUIPMENT_SHOP_DROP_TABLE=[
        {key:"white",label:"白階",chance:70},
        {key:"blue",label:"藍階",chance:19},
        {key:"purple",label:"紫階",chance:10},
        {key:"orange",label:"橙階",chance:1}
    ];
    const EQUIPMENT_CHEST_DROP_TABLE=[
        {key:"white",label:"白階",chance:50},
        {key:"blue",label:"藍階",chance:35},
        {key:"purple",label:"紫階",chance:10},
        {key:"orange",label:"橙階",chance:5}
    ];
    const STAT_LABEL={attack:"攻擊",intelligence:"智力",vitality:"體質",energy:"能量",defensePoints:"防禦",agility:"敏捷",accuracy:"命中",evasion:"閃避",crit:"爆擊",criticalChance:"爆擊",antiCrit:"抗暴",statusAccuracy:"異常命中",statusResistance:"異常抗性"};
    const SLOT_META={
        shoulder:{label:"護腕",warrior:["vitality","attack","defensePoints"],mage:["vitality","intelligence","defensePoints"]},
        head:{label:"頭盔",warrior:["vitality","attack","agility","defensePoints"],mage:["vitality","intelligence","agility","defensePoints"]},
        shoes:{label:"鞋子",warrior:["vitality","agility","attack"],mage:["vitality","agility","intelligence"]},
        armor:{label:"衣服",warrior:["vitality","agility","attack","defensePoints"],mage:["vitality","agility","intelligence","defensePoints"]},
        weapon:{label:"武器",warrior:["attack"],mage:["intelligence"]}
    };
    // Fixed ordinary definitions; random acquisition selects an entry, never its base stats.
    const EQUIPMENT_CATALOG=[
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-001.webp","stats":{"vitality":5}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-002.webp","stats":{"attack":6}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-003.webp","stats":{"agility":13}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-004.webp","stats":{"defensePoints":8}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-005.webp","stats":{"vitality":9}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-006.webp","stats":{"attack":16}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-007.webp","stats":{"agility":11}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-008.webp","stats":{"defensePoints":6}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-009.webp","stats":{"vitality":7}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-010.webp","stats":{"attack":14}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-011.webp","stats":{"agility":9}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-012.webp","stats":{"defensePoints":16}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-013.webp","stats":{"vitality":11}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-014.webp","stats":{"attack":12}},
        {"rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-015.webp","stats":{"agility":7}},
        {"rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/legacy-016.webp","stats":{"defensePoints":14}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-017.webp","stats":{"attack":9}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-018.webp","stats":{"attack":10}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-019.webp","stats":{"attack":11}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-020.webp","stats":{"attack":6}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-021.webp","stats":{"attack":7}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-022.webp","stats":{"attack":8}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-023.webp","stats":{"attack":15}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-024.webp","stats":{"attack":16}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-025.webp","stats":{"attack":5}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-026.webp","stats":{"attack":12}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-027.webp","stats":{"attack":13}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-028.webp","stats":{"attack":14}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-029.webp","stats":{"attack":9}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-030.webp","stats":{"attack":10}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-031.webp","stats":{"attack":11}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-032.webp","stats":{"attack":12}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-033.webp","stats":{"attack":7}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-034.webp","stats":{"attack":8}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-035.webp","stats":{"attack":9}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-036.webp","stats":{"attack":16}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-037.webp","stats":{"attack":5}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-038.webp","stats":{"attack":12}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-039.webp","stats":{"attack":13}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-040.webp","stats":{"attack":8}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-041.webp","stats":{"attack":15}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-042.webp","stats":{"attack":16}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-043.webp","stats":{"attack":5}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-044.webp","stats":{"attack":6}},
        {"rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-045.webp","stats":{"attack":7}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-046.webp","stats":{"attack":14}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-047.webp","stats":{"attack":15}},
        {"rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/legacy-048.webp","stats":{"attack":16}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-049.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-050.webp","stats":{"agility":12}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-051.webp","stats":{"attack":7}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-052.webp","stats":{"defensePoints":14}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-053.webp","stats":{"vitality":9}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-054.webp","stats":{"agility":16}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-055.webp","stats":{"attack":5}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-056.webp","stats":{"defensePoints":6}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-057.webp","stats":{"vitality":7}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-058.webp","stats":{"agility":14}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-059.webp","stats":{"attack":9}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-060.webp","stats":{"defensePoints":16}},
        {"rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-061.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-062.webp","stats":{"agility":12}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-063.webp","stats":{"attack":13}},
        {"rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/legacy-064.webp","stats":{"defensePoints":14}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-065.webp","stats":{"attack":9}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-066.webp","stats":{"defensePoints":10}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-067.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-068.webp","stats":{"attack":12}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-069.webp","stats":{"defensePoints":7}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-070.webp","stats":{"vitality":14}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-071.webp","stats":{"attack":9}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-072.webp","stats":{"defensePoints":16}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-073.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-074.webp","stats":{"attack":12}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-075.webp","stats":{"defensePoints":7}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-076.webp","stats":{"vitality":14}},
        {"rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-077.webp","stats":{"attack":9}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-078.webp","stats":{"defensePoints":16}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-079.webp","stats":{"vitality":11}},
        {"rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/legacy-080.webp","stats":{"attack":12}},
        {"rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-081.webp","stats":{"attack":7}},
        {"rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-082.webp","stats":{"vitality":14}},
        {"rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-083.webp","stats":{"agility":15}},
        {"rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-084.webp","stats":{"attack":16}},
        {"rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-085.webp","stats":{"vitality":11}},
        {"rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-086.webp","stats":{"agility":6}},
        {"rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-087.webp","stats":{"attack":7}},
        {"rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-088.webp","stats":{"vitality":14}},
        {"rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-089.webp","stats":{"agility":9}},
        {"rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/legacy-090.webp","stats":{"attack":10}},
        {"rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-001.webp","stats":{"vitality":11}},
        {"rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-002.webp","stats":{"intelligence":6}},
        {"rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-003.webp","stats":{"agility":13}},
        {"rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-004.webp","stats":{"defensePoints":8}},
        {"rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-005.webp","stats":{"vitality":15}},
        {"rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-006.webp","stats":{"intelligence":10}},
        {"rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-007.webp","stats":{"agility":11}},
        {"rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-008.webp","stats":{"defensePoints":12}},
        {"rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-009.webp","stats":{"vitality":7}},
        {"rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-010.webp","stats":{"intelligence":14}},
        {"rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-011.webp","stats":{"agility":9}},
        {"rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/legacy-012.webp","stats":{"defensePoints":10}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-013.webp","stats":{"intelligence":5}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-014.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-015.webp","stats":{"intelligence":7}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-016.webp","stats":{"intelligence":14}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-017.webp","stats":{"intelligence":9}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-018.webp","stats":{"intelligence":16}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-019.webp","stats":{"intelligence":5}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-020.webp","stats":{"intelligence":12}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-021.webp","stats":{"intelligence":13}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-022.webp","stats":{"intelligence":8}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-023.webp","stats":{"intelligence":15}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-024.webp","stats":{"intelligence":16}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-025.webp","stats":{"intelligence":5}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-026.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-027.webp","stats":{"intelligence":7}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-028.webp","stats":{"intelligence":8}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-029.webp","stats":{"intelligence":9}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-030.webp","stats":{"intelligence":16}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-031.webp","stats":{"intelligence":11}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-032.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-033.webp","stats":{"intelligence":7}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-034.webp","stats":{"intelligence":8}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-035.webp","stats":{"intelligence":9}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-036.webp","stats":{"intelligence":10}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-037.webp","stats":{"intelligence":11}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-038.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-039.webp","stats":{"intelligence":7}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-040.webp","stats":{"intelligence":14}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-041.webp","stats":{"intelligence":9}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-042.webp","stats":{"intelligence":16}},
        {"rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-043.webp","stats":{"intelligence":5}},
        {"rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/legacy-044.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-045.webp","stats":{"vitality":7}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-046.webp","stats":{"agility":8}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-047.webp","stats":{"intelligence":9}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-048.webp","stats":{"defensePoints":16}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-049.webp","stats":{"vitality":11}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-050.webp","stats":{"agility":12}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-051.webp","stats":{"intelligence":7}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-052.webp","stats":{"defensePoints":8}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-053.webp","stats":{"vitality":9}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-054.webp","stats":{"agility":10}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-055.webp","stats":{"intelligence":11}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-056.webp","stats":{"defensePoints":12}},
        {"rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-057.webp","stats":{"vitality":7}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-058.webp","stats":{"agility":14}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-059.webp","stats":{"intelligence":15}},
        {"rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/legacy-060.webp","stats":{"defensePoints":16}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-061.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-062.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-063.webp","stats":{"defensePoints":7}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-064.webp","stats":{"vitality":8}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-065.webp","stats":{"intelligence":15}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-066.webp","stats":{"defensePoints":10}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-067.webp","stats":{"vitality":11}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-068.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-069.webp","stats":{"defensePoints":7}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-070.webp","stats":{"vitality":14}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-071.webp","stats":{"intelligence":15}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-072.webp","stats":{"defensePoints":10}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-073.webp","stats":{"vitality":11}},
        {"rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-074.webp","stats":{"intelligence":12}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-075.webp","stats":{"defensePoints":7}},
        {"rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/legacy-076.webp","stats":{"vitality":8}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-077.webp","stats":{"agility":9}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-078.webp","stats":{"intelligence":10}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-079.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-080.webp","stats":{"agility":12}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-081.webp","stats":{"intelligence":13}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-082.webp","stats":{"vitality":8}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-083.webp","stats":{"agility":15}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-084.webp","stats":{"intelligence":10}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-085.webp","stats":{"vitality":5}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-086.webp","stats":{"agility":12}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-087.webp","stats":{"intelligence":13}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-088.webp","stats":{"vitality":8}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-089.webp","stats":{"agility":15}},
        {"rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-090.webp","stats":{"intelligence":16}},
        {"rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/legacy-091.webp","stats":{"vitality":5}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"agility":20}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"agility":26}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"vitality":18}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"agility":21}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"vitality":24}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"agility":27}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"vitality":19}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"vitality":25}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"attack":20}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"defensePoints":17}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"attack":26}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"defensePoints":23}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"attack":21}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"vitality":18}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"attack":27}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"vitality":24}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":22}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":19}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":28}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":25}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"agility":17}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"defensePoints":20}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"agility":23}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"defensePoints":26}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":19}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":25}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":20}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":17}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":26}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":23}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":21}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":18}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":27}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":24}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"vitality":22}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"agility":19}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"vitality":28}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"agility":25}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"attack":20}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"attack":26}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"defensePoints":19}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"vitality":22}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"defensePoints":25}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"vitality":28}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"attack":17}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"attack":23}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"attack":21}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"defensePoints":18}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"attack":27}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"defensePoints":24}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":22}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":19}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":28}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":25}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":17}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":20}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":23}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":26}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"agility":19}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"agility":25}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":20}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":17}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":26}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":23}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"agility":21}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"defensePoints":18}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"agility":27}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"defensePoints":24}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"attack":22}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"defensePoints":19}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"attack":28}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"defensePoints":25}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"attack":20}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"attack":26}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":19}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":25}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"agility":20}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"defensePoints":17}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"agility":26}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"defensePoints":23}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"vitality":21}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"agility":18}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"vitality":27}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"agility":24}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"vitality":22}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"attack":19}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"vitality":28}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"attack":25}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"attack":20}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"attack":26}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"agility":19}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"defensePoints":22}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"agility":25}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"defensePoints":28}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":21}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":18}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":27}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":24}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"defensePoints":22}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"vitality":19}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"defensePoints":28}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"vitality":25}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":17}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":20}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":23}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":26}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"defensePoints":21}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"defensePoints":27}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"vitality":19}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"agility":22}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"vitality":25}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"agility":28}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"attack":20}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"vitality":17}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"attack":26}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"vitality":23}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"attack":21}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"defensePoints":18}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"attack":27}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"defensePoints":24}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":22}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":19}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":28}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":25}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"attack":17}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"defensePoints":20}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"attack":23}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"defensePoints":26}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"agility":18}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"agility":24}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":19}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":25}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"vitality":21}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"attack":18}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"vitality":27}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"attack":24}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"vitality":22}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"agility":19}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"vitality":28}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"agility":25}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"attack":17}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"vitality":20}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"attack":23}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"vitality":26}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":18}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":24}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":19}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":25}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"defensePoints":20}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"vitality":17}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"defensePoints":26}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"vitality":23}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"vitality":21}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"attack":18}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"vitality":27}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"attack":24}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"agility":22}},
        {"rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"defensePoints":19}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"agility":28}},
        {"rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"defensePoints":25}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"attack":17}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"defensePoints":20}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"attack":23}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"defensePoints":26}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"vitality":18}},
        {"rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"attack":21}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"vitality":24}},
        {"rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"attack":27}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"agility":19}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"attack":22}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"agility":25}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"attack":28}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":21}},
        {"rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":18}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":27}},
        {"rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":24}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"attack":22}},
        {"rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"defensePoints":19}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"attack":28}},
        {"rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"defensePoints":25}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"intelligence":20}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"intelligence":26}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":18}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":24}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"vitality":19}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"agility":22}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"vitality":25}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"agility":28}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"intelligence":21}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"vitality":18}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"intelligence":27}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"vitality":24}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":22}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":19}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":28}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":25}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":17}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":20}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":23}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":26}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"vitality":18}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"vitality":24}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":22}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":28}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":20}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":17}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":26}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":23}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":21}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":27}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"intelligence":22}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"defensePoints":19}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"intelligence":28}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"defensePoints":25}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"defensePoints":17}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"vitality":20}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"defensePoints":23}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"vitality":26}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"agility":18}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"agility":24}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":22}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":28}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"agility":20}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"defensePoints":17}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"agility":26}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"defensePoints":23}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"vitality":21}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"agility":18}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"vitality":27}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"agility":24}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"intelligence":22}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"defensePoints":19}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"intelligence":28}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"defensePoints":25}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"intelligence":20}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"intelligence":26}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"intelligence":18}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"vitality":21}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"intelligence":24}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"vitality":27}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"vitality":19}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"intelligence":22}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"vitality":25}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"intelligence":28}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":21}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":27}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"agility":22}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"intelligence":19}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"agility":28}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"intelligence":25}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"intelligence":17}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"defensePoints":20}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"intelligence":23}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"defensePoints":26}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":18}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":24}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":22}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":28}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":20}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":17}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":26}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":23}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":21}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":27}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"defensePoints":22}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"vitality":19}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"defensePoints":28}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"vitality":25}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"agility":20}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"agility":26}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"vitality":18}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"agility":21}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"vitality":24}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"agility":27}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":22}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":28}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"intelligence":20}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"vitality":17}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"intelligence":26}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"vitality":23}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":21}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":27}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"intelligence":22}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"defensePoints":19}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"intelligence":28}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"defensePoints":25}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"intelligence":17}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"defensePoints":20}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"intelligence":23}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"defensePoints":26}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"agility":18}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"agility":24}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":22}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":28}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":21}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":27}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"vitality":22}},
        {"rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"agility":19}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"vitality":28}},
        {"rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"agility":25}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"vitality":17}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"intelligence":20}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"vitality":23}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"intelligence":26}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"intelligence":18}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"defensePoints":21}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"intelligence":24}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"defensePoints":27}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"agility":19}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"defensePoints":22}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"agility":25}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"defensePoints":28}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"vitality":20}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"agility":17}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"vitality":26}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"agility":23}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"vitality":21}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"vitality":27}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":22}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":19}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":28}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":25}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"defensePoints":17}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"vitality":20}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"defensePoints":23}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"vitality":26}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":18}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":24}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"defensePoints":22}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"defensePoints":28}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":20}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":17}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":26}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":23}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"agility":21}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"defensePoints":18}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"agility":27}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"defensePoints":24}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"vitality":22}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"intelligence":19}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"vitality":28}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"intelligence":25}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"agility":17}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"defensePoints":20}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"agility":23}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"defensePoints":26}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"vitality":18}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"intelligence":21}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"vitality":24}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"intelligence":27}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"intelligence":19}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"defensePoints":22}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"intelligence":25}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"defensePoints":28}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"agility":20}},
        {"rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"defensePoints":17}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"agility":26}},
        {"rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"defensePoints":23}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"vitality":21}},
        {"rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"intelligence":18}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"vitality":27}},
        {"rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"intelligence":24}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":22}},
        {"rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":19}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":28}},
        {"rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":25}},
    ];
    window.v17346GetEquipmentCatalog=()=>EQUIPMENT_CATALOG.map(entry=>({...entry,stats:{...entry.stats}}));
    // Temporary product test switch. false restores the existing daily UI/limit.
    const SHOP_UNLIMITED_REFRESH_TEST_MODE=true;
    const SHOP_STORAGE_KEY=window.FourSymbolsAccountSave.accountKey("equipment-shop-daily");
    const EQUIPMENT_DUNGEON_FRAGMENT_REWARD=Object.freeze({setIds:Object.freeze(["setFire","setWater","setEarth","setWind"]),count:10,provisional:true});
    let equipmentDungeonReward=null;
    let equipmentDungeonClaiming=false;
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
    function rarityFromRandom(random=Math.random,table=EQUIPMENT_CHEST_DROP_TABLE){
        const roll=random()*100;
        let cursor=0;
        for(const rarity of table){ cursor+=rarity.chance; if(roll<cursor){ return RARITY_BY_KEY[rarity.key]; } }
        throw new Error("裝備階級抽取超出範圍");
    }
    function artMarkup(path,rarityKey,type){
        if(!path){ return window.FourSymbolsItemSlot.art('<span class="v169-item-art v169-equipment-art" data-asset-state="missing" role="img" aria-label="裝備素材尚未就緒" title="裝備素材尚未就緒">◇</span>',{type,rarityKey}); }
        return window.FourSymbolsItemSlot.art('<span class="v169-item-art v169-equipment-art"><img src="'+path+'" alt="" draggable="false" onerror="this.parentElement.dataset.assetState=\'broken\';this.parentElement.setAttribute(\'role\',\'img\');this.parentElement.setAttribute(\'aria-label\',\'裝備圖片無法載入\');this.parentElement.textContent=\'◇\'"></span>',{type,rarityKey});
    }
    function legacyStarterRingMarkup(){
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-white v17357-starter-ring"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style="width:100%;height:100%;display:block"><defs><radialGradient id="v17357RingGem" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#d49a36"/><stop offset="1" stop-color="#6f4517"/></radialGradient><linearGradient id="v17357RingGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8dd86"/><stop offset=".55" stop-color="#b97623"/><stop offset="1" stop-color="#674016"/></linearGradient></defs><ellipse cx="32" cy="38" rx="18" ry="15" fill="none" stroke="url(#v17357RingGold)" stroke-width="7"/><path d="M21 24l6-8h10l6 8-6 7H27z" fill="url(#v17357RingGem)" stroke="#f6d47a" stroke-width="2"/><circle cx="32" cy="22" r="3" fill="#fff6c8" opacity=".9"/></svg></span>';
    }
    function repairLegacyStarterEquipmentIcons(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){return false;}
        window.FourSymbolsEquipmentFactory.migrateGraph(inventoryItems,typeof characterEquipment!=="undefined"?characterEquipment:{});
        for(const item of inventoryItems){
            if(item&&item.id==="powerRing"&&!/<(?:img|svg)\b/i.test(String(item.icon||""))){item.icon=legacyStarterRingMarkup();}
        }
        return true;
    }
    window.v17357RepairLegacyStarterEquipmentIcons=repairLegacyStarterEquipmentIcons;
    window.v17362StarterWhiteStats=Object.fromEntries(Object.entries(window.FourSymbolsEquipmentFactory.STARTERS).map(([id,entry])=>[id,{...entry.stats}]));
    function generateEquipment(random=Math.random,forced={}){
        const forcedRarity=forced.rarity?RARITY_BY_KEY[forced.rarity]:null;
        if(forced.rarity&&(!forcedRarity||forcedRarity.available===false)){ throw new Error("特殊裝備不使用一般生成規則"); }
        const rarity=forcedRarity||rarityFromRandom(random);
        const classType=forced.classType||(random()<.5?"warrior":"mage");
        const slots=Object.keys(SLOT_META);
        const slot=forced.slot||slots[Math.floor(random()*slots.length)%slots.length];
        const candidates=EQUIPMENT_CATALOG.filter(entry=>entry.rarityKey===rarity.key&&entry.classType===classType&&entry.type===slot);
        if(!candidates.length){ throw new Error("裝備固定清單無符合項目"); }
        const entry=candidates[Math.floor(random()*candidates.length)%candidates.length];
        return window.FourSymbolsEquipmentFactory.create({...entry,icon:artMarkup(entry.assetPath,rarity.key,slot),v17346GeneratedEquipment:true},{ordinary:true,uid:forced.uid});
    }
    window.v17346GenerateEquipment=generateEquipment;
    window.v17346EquipmentRarityTable=RARITIES.map(item=>({...item}));
    window.v17346EquipmentShopDropTable=EQUIPMENT_SHOP_DROP_TABLE.map(item=>({...item}));
    window.v17346RollEquipmentShopRarity=random=>rarityFromRandom(random,EQUIPMENT_SHOP_DROP_TABLE).key;

    function equipmentChestIcon(){
        if(typeof window.v17361GeneralDungeonChestIcon==="function"){
            return window.v17361GeneralDungeonChestIcon();
        }
        return '<span class="v169-item-art v169-chest-art v169-rarity-blue"><img src="assets/items/chests/dungeon-chest.png" alt="" aria-hidden="true" draggable="false" onerror="this.hidden=true"></span>';
    }
    const EQUIPMENT_CHEST_DEFINITION={
        id:"equipmentChest",
        name:"裝備寶箱",
        icon:equipmentChestIcon(),
        type:"chest",
        tierKey:"blue",
        price:0,
        stats:{}
    };
    function equipmentChestRarityFromRandom(random=Math.random){
        const roll=random()*100;
        let cursor=0;
        for(const rarity of EQUIPMENT_CHEST_DROP_TABLE){
            cursor+=rarity.chance;
            if(roll<cursor){ return rarity; }
        }
        return EQUIPMENT_CHEST_DROP_TABLE[EQUIPMENT_CHEST_DROP_TABLE.length-1];
    }
    function rollEquipmentChestItems(random=Math.random){
        return Array.from({length:3},()=>{
            const rarity=equipmentChestRarityFromRandom(random);
            return generateEquipment(random,{rarity:rarity.key});
        });
    }
    function equipmentChestOddsText(separator="・"){
        return EQUIPMENT_CHEST_DROP_TABLE.map(entry=>entry.label+entry.chance+"%").join(separator);
    }
    function syncEquipmentChestPresentation(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return; }
        inventoryItems.forEach(item=>{
            if(!item||item.id!==EQUIPMENT_CHEST_DEFINITION.id){ return; }
            item.name=EQUIPMENT_CHEST_DEFINITION.name;
            item.icon=EQUIPMENT_CHEST_DEFINITION.icon;
            item.type=EQUIPMENT_CHEST_DEFINITION.type;
            item.tierKey=EQUIPMENT_CHEST_DEFINITION.tierKey;
            item.price=0;
            if(!item.stats||typeof item.stats!=="object"){ item.stats={}; }
        });
    }
    function showEquipmentChestPreview(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        const html='<div class="v132-reward-modal-inner v17346-preview-modal"><h3>裝備寶箱開啟預覽</h3><p>每個裝備寶箱開啟後固定隨機獲得3件裝備。</p><p>'+escapeHtml(equipmentChestOddsText("・"))+'</p><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
        window.v132ShowRewardModal(html);
    }
    function openEquipmentChest(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){
            alert("背包資料尚未就緒，請稍後再試。");
            return null;
        }
        const owned=inventoryItems.some(item=>item&&item.id===EQUIPMENT_CHEST_DEFINITION.id&&Math.max(0,Math.floor(Number(item.count)||0))>0);
        if(!owned){
            alert("目前沒有裝備寶箱。");
            return null;
        }
        if(
            typeof window.v132RunInventoryTransaction!=="function"||
            typeof window.v132ConsumeStackItem!=="function"||
            typeof window.v132AddItemToInventory!=="function"
        ){
            alert("裝備寶箱系統尚未就緒，請重新整理後再試。");
            return null;
        }
        const rewards=rollEquipmentChestItems(Math.random);
        const opened=window.v132RunInventoryTransaction(()=>
            window.v132ConsumeStackItem(EQUIPMENT_CHEST_DEFINITION.id,1)&&
            rewards.every(item=>window.v132AddItemToInventory(item,1))
        );
        if(!opened){
            alert("背包空間不足，裝備寶箱未消耗。請先整理背包。");
            return null;
        }
        syncEquipmentChestPresentation();
        if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
        if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        if(typeof saveGame==="function"){ saveGame(); }
        return rewards;
    }
    window.v17346EquipmentChestDropTable=EQUIPMENT_CHEST_DROP_TABLE.map(entry=>({...entry}));
    window.v17346GetEquipmentChestDefinition=function(){ return {...EQUIPMENT_CHEST_DEFINITION,stats:{}}; };
    window.v17346RollEquipmentChestItems=rollEquipmentChestItems;
    window.v17346OpenEquipmentChest=openEquipmentChest;
    window.v17346ShowEquipmentChestPreview=showEquipmentChestPreview;

    function applySetRule(item){
        const defs=typeof window.v132GetContentDefinitions==="function"?window.v132GetContentDefinitions():null;
        if(!(defs?.equipmentSetItems||[]).some(def=>def.id===(item?.definitionId||item?.id)&&def.setId===item?.setId)){ return item; }
        migrateLegacyEquipmentStats(item);
        window.v132NormalizeEquipmentSetItem(item);
        window.FourSymbolsEquipmentReforge.migrateItem(item);
        item.icon=window.FourSymbolsItemSlot.art(item.icon,item);
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
            const displaced=Object.keys(elementSlots).map(slot=>partySlots[slot]&&elementSlots[slot]&&partySlots[slot]!==elementSlots[slot]?elementSlots[slot]:null).filter(Boolean);
            if(displaced.length){
                if(typeof inventoryItems==="undefined"||inventoryItems.length+displaced.filter(item=>!inventoryItems.includes(item)).length>120){
                    throw Error("裝備引用同步容量不足，保留原穿戴資料");
                }
                displaced.forEach(item=>{if(!inventoryItems.includes(item)){inventoryItems.push(item);}});
            }
            Object.keys(partySlots).forEach(slot=>{
                if(!partySlots[slot]&&elementSlots[slot]){ partySlots[slot]=elementSlots[slot]; }
            });
        }
        characterEquipment[elementKey]=partySlots;
    }
    window.v17346SyncMainCharacterEquipmentStorage=syncMainCharacterEquipmentStorage;

    function syncFourElementSets(){
        repairLegacyStarterEquipmentIcons();
        syncEquipmentChestPresentation();
        syncMainCharacterEquipmentStorage();
        try{
            const defs=typeof window.v132GetContentDefinitions==="function"?window.v132GetContentDefinitions():null;
            (defs&&defs.equipmentSetItems||[]).forEach(applySetRule);
        }catch(_){ }
        if(typeof inventoryItems!=="undefined"&&Array.isArray(inventoryItems)){
            window.FourSymbolsEquipmentFactory.migrateGraph(inventoryItems,typeof characterEquipment!=="undefined"?characterEquipment:{});
            inventoryItems.forEach(item=>{ applySetRule(item); });
        }
        if(typeof characterEquipment!=="undefined"&&characterEquipment){
            Object.values(characterEquipment).forEach(slots=>Object.values(slots||{}).forEach(item=>{
                applySetRule(item);

            }));
        }
    }
    syncFourElementSets();
    window.v17346SyncFourElementSets=syncFourElementSets;
    function remainingReforgeSlots(item){
        if(!item||!isEquipmentInventoryType(item.type)){ return 0; }
        return window.FourSymbolsReforge?window.FourSymbolsReforge.slots(item).filter(affix=>affix===null).length:0;
    }
    window.v17346RemainingReforgeSlots=remainingReforgeSlots;

    function appendReforgeMarkers(item){
        const stats=document.getElementById("itemModalStats");
        if(!stats){ return; }
        stats.querySelectorAll(".v17346-reforge-slot").forEach(node=>node.remove());
        if(!item||!isEquipmentInventoryType(item.type)){ return; }
        const owner=window.FourSymbolsReforge;
        if(!owner){ return; }
        let slots;
        try{ slots=owner.slots(item); }
        catch(_){ stats.insertAdjacentHTML("beforeend",'<div class="v17346-reforge-slot">冶煉資料異常，請保留原資料。</div>');return; }
        slots.forEach((affix,index)=>stats.insertAdjacentHTML("beforeend",'<div class="v17346-reforge-slot" data-reforge-slot="'+index+'">'+escapeHtml(owner.slotText(affix))+'</div>'));
        const reason=owner.reason(item);
        if(reason){ stats.insertAdjacentHTML("beforeend",'<div class="v17346-reforge-slot v17346-reforge-reason">'+escapeHtml(reason)+'</div>'); }
    }
    window.v17346AppendReforgeMarkers=appendReforgeMarkers;
    function configureEquipmentChestModal(item){
        if(!item||item.id!==EQUIPMENT_CHEST_DEFINITION.id){ return; }
        const modal=document.getElementById("itemModal");
        const equipButton=document.getElementById("itemEquipButton");
        const sellButton=document.querySelector("#itemModal .sell-button");
        const useButton=document.getElementById("v132ItemUseButton");
        const previewButton=document.getElementById("v132ItemPreviewButton");
        if(modal&&typeof window.setItemModalPresentationMode==="function"){
            window.setItemModalPresentationMode("compact");
        }
        if(equipButton){ equipButton.style.display="none"; }
        if(sellButton){ sellButton.style.display="none"; }
        if(useButton){
            useButton.style.display="";
            useButton.textContent="開啟";
            useButton.onclick=function(){
                const rewards=openEquipmentChest();
                if(!rewards){ return; }
                if(typeof closeItemModal==="function"){ closeItemModal(); }
                const summary=rewards.map(item=>item.name+"（"+(RARITY_BY_KEY[item.rarityKey]||RARITIES[0]).label+"・"+statLine(item)+(item.reforgeSlots?"・可冶煉":"")+"）").join("\n");
                if(typeof window.rpgAlert==="function"){
                    void window.rpgAlert("開啟裝備寶箱，獲得3件裝備：\n"+summary,{title:"裝備寶箱",confirmText:"知道了",tone:"success"});
                }else{
                    alert("開啟裝備寶箱，獲得：\n"+summary);
                }
            };
        }
        if(previewButton){
            previewButton.style.display="";
            previewButton.textContent="預覽";
            previewButton.onclick=showEquipmentChestPreview;
        }
    }
    if(typeof openItemModal==="function"){
        const previousOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            syncMainCharacterEquipmentStorage();
            syncEquipmentChestPresentation();
            const result=previousOpenItemModal.apply(this,arguments);
            const item=typeof inventorySlots!=="undefined"?inventorySlots[slotIndex]:null;
            if(item){ applySetRule(item); appendReforgeMarkers(item); configureEquipmentChestModal(item); }
            return result;
        };
    }
    if(typeof openEquippedItem==="function"){
        const previousOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item){
            syncMainCharacterEquipmentStorage();
            const result=previousOpenEquippedItem.apply(this,arguments);
            if(item){ applySetRule(item); appendReforgeMarkers(item); }
            return result;
        };
    }
    if(typeof closeItemModal==="function"){
        const previousCloseItemModal=closeItemModal;
        closeItemModal=function(){
            return previousCloseItemModal.apply(this,arguments);
        };
    }

    function injectStyles(){
        if(document.getElementById("equipment-progression-style")){ return; }
        const style=document.createElement("style");
        style.id="equipment-progression-style";
        style.textContent=`
.v17346-reforge-slot{margin-top:calc(7 * var(--ui-length-unit,1px));color:#ffbf5b!important;font-weight:900;letter-spacing:.06em}
#game-ui #itemModal #v17342InventoryPotionUse{-webkit-appearance:none!important;appearance:none!important;background:linear-gradient(180deg,#d9ad55 0%,#9c641c 100%)!important;border:calc(1 * var(--ui-length-unit,1px)) solid #f2cf83!important;color:#1a1007!important;opacity:1!important;font-weight:900!important;text-shadow:none!important;box-shadow:inset 0 calc(1 * var(--ui-length-unit,1px)) 0 rgba(255,242,192,.42),0 calc(3 * var(--ui-length-unit,1px)) calc(8 * var(--ui-length-unit,1px)) rgba(0,0,0,.34)!important}
#game-ui #itemModal #v17342InventoryPotionUse:focus,#game-ui #itemModal #v17342InventoryPotionUse:focus-visible,#game-ui #itemModal #v17342InventoryPotionUse:active{background:linear-gradient(180deg,#edc66d 0%,#ad7524 100%)!important;color:#160d05!important;outline:calc(2 * var(--ui-length-unit,1px)) solid rgba(255,220,139,.72)!important;outline-offset:calc(1 * var(--ui-length-unit,1px))!important}
#game-ui #itemModal #v17342InventoryPotionUse:disabled{background:#33291f!important;border-color:#66533d!important;color:#8f806b!important;box-shadow:none!important;opacity:.68!important}
.v17346-shop-card{position:relative;overflow:hidden;padding:calc(10 * var(--ui-length-unit,1px)) calc(9 * var(--ui-length-unit,1px)) calc(9 * var(--ui-length-unit,1px))!important;cursor:pointer;transition:filter .16s ease,background .16s ease,border-color .16s ease}.v17346-shop-card .v17346-gear-art{width:calc(74 * var(--ui-length-unit,1px));height:calc(74 * var(--ui-length-unit,1px));margin:0 auto calc(7 * var(--ui-length-unit,1px))}.v17346-gear-art .v169-item-art{width:100%!important;height:100%!important}.v17346-shop-card .v17346-shop-name{display:block;font-size:calc(17 * var(--ui-length-unit,1px))!important;line-height:1.22!important;font-weight:900!important;letter-spacing:.02em}.v17346-shop-card .v17346-shop-slot{display:block;margin-top:calc(3 * var(--ui-length-unit,1px));color:#c9b894!important;font-size:calc(14 * var(--ui-length-unit,1px))!important;line-height:1.25!important}.v17346-shop-card .v17346-stat{display:block;margin-top:calc(3 * var(--ui-length-unit,1px));color:#ffe0a0!important;font-size:calc(15 * var(--ui-length-unit,1px))!important;line-height:1.3!important;font-weight:800!important}.v17346-shop-card .v17346-reforge-mini{display:block;margin-top:calc(2 * var(--ui-length-unit,1px));color:#ffbf5b;font-size:calc(12 * var(--ui-length-unit,1px));font-weight:800}.v17346-shop-card .v17346-shop-buy{-webkit-appearance:none;appearance:none;width:100%;min-height:calc(42 * var(--ui-length-unit,1px));margin-top:calc(8 * var(--ui-length-unit,1px));border:calc(1 * var(--ui-length-unit,1px)) solid rgba(226,181,87,.76);border-radius:calc(7 * var(--ui-length-unit,1px));font-size:calc(15 * var(--ui-length-unit,1px));font-weight:900;line-height:1.15}.v17346-shop-card.is-affordable{background:linear-gradient(180deg,rgba(51,36,19,.94),rgba(19,14,10,.96))!important;box-shadow:inset 0 0 0 calc(1 * var(--ui-length-unit,1px)) rgba(225,179,83,.08),0 0 calc(10 * var(--ui-length-unit,1px)) rgba(211,155,54,.08)}.v17346-shop-card.is-affordable .v17346-shop-buy{background:linear-gradient(180deg,#f4d477 0%,#cf942d 58%,#a76518 100%)!important;border-color:#ffe5a0!important;color:#241506!important;text-shadow:0 calc(1 * var(--ui-length-unit,1px)) rgba(255,239,185,.35)!important;box-shadow:inset 0 calc(1 * var(--ui-length-unit,1px)) 0 rgba(255,248,211,.62),0 0 calc(10 * var(--ui-length-unit,1px)) rgba(236,183,71,.32)!important}.v17346-shop-card.is-affordable .v17346-shop-buy:active{background:linear-gradient(180deg,#fff0ad,#d69a32)!important;color:#160d05!important}.v17346-shop-card.is-unaffordable{background:linear-gradient(180deg,rgba(38,29,24,.94),rgba(17,14,12,.98))!important;border-color:rgba(119,83,61,.72)!important}.v17346-shop-card.is-unaffordable .v17346-gear-art img{filter:saturate(.48) brightness(.72)}.v17346-shop-card.is-unaffordable .v17346-shop-slot,.v17346-shop-card.is-unaffordable .v17346-stat{color:#978878!important}.v17346-shop-card .v17346-shop-buy:disabled{background:linear-gradient(180deg,rgba(91,43,31,.82),rgba(48,27,23,.92))!important;border-color:rgba(167,79,56,.7)!important;color:#d79279!important;box-shadow:none!important;opacity:.86!important;cursor:not-allowed}.v17346-equipment-dungeon-card .v141-dungeon-cover-art{background-image:linear-gradient(rgba(5,4,3,.2),rgba(5,4,3,.68)),url('assets/ui/dungeon-equipment-v17346.png')!important;background-size:cover!important;background-position:center!important}
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
        const fresh={date:today,refreshCount:0,soldOfferIds:[]};
        try{
            const raw=localStorage.getItem(SHOP_STORAGE_KEY);
            if(raw===null){ return fresh; }
            const stored=JSON.parse(raw);
            if(!stored||typeof stored.date!=="string"||!Number.isSafeInteger(stored.refreshCount)||stored.refreshCount<0){ return null; }
            if(stored.date!==today){ return fresh; }
            // Existing date/refresh-only records migrate in place. Inventory
            // names and generated instance UIDs are never purchase receipts.
            const sold=stored.soldOfferIds===undefined?[]:stored.soldOfferIds;
            if(!Array.isArray(sold)||sold.some(id=>typeof id!=="string"||!id.startsWith(today+":")||!/^\d{4}-\d{2}-\d{2}:\d+:\d$/.test(id))){ return null; }
            return {date:today,refreshCount:stored.refreshCount,soldOfferIds:[...new Set(sold)]};
        }catch(_){ return null; }
    }
    function currentShopOffers(state=shopState()){
        if(!state){ return []; }
        return window.FourSymbolsEquipmentFactory.uniqueNames(Array.from({length:6},(_,index)=>{
            const offerId=state.date+":"+state.refreshCount+":"+index;
            const random=seededRandom(offerId);
            const rarity=rarityFromRandom(random,EQUIPMENT_SHOP_DROP_TABLE);
            return {...generateEquipment(random,{rarity:rarity.key,uid:"shop_"+encodeURIComponent(SHOP_STORAGE_KEY)+"_"+offerId}),offerId};
        }));
    }
    function statLine(item){
        const [key,value]=Object.entries(item.stats||{})[0]||["",0];
        return (STAT_LABEL[key]||key)+(Number(value)>=0?" +":" ")+value+(["accuracy","evasion"].includes(key)?"%":"");
    }
    window.v17346ShowShopOfferAcquisition=function(index){
        const item=currentShopOffers()[Math.max(0,Math.min(5,Math.floor(Number(index)||0)))];
        return item&&window.FourSymbolsItemAcquisition?.show(item);
    };
    window.v17346PreviewEquipmentShopOffer=function(index){
        const safeIndex=Math.max(0,Math.min(5,Math.floor(Number(index)||0)));
        const item=currentShopOffers()[safeIndex];
        if(!item||typeof window.v132ShowRewardModal!=="function"){ return; }
        const rarity=RARITY_BY_KEY[item.rarityKey]||RARITIES[0];
        const html='<div class="v132-reward-modal-inner v17346-shop-preview-modal item-presentation-frame" data-presentation-mode="shop-preview" data-rarity="'+escapeHtml(item.rarityKey)+'"><h3>'+window.FourSymbolsItemSlot.name(item.name,item)+'</h3><div class="item-presentation-scroll" data-scroll-owner="y"><div class="v17346-shop-preview-art">'+window.FourSymbolsItemSlot.art(item.icon,item)+'</div><div class="v17346-shop-preview-info"><span>'+escapeHtml(SLOT_META[item.type].label)+'</span><strong>'+escapeHtml(statLine(item))+'</strong></div><div class="v17346-shop-preview-price">'+window.FourSymbolsEquipmentFactory.prices(item).shop.toLocaleString("zh-TW")+' 金幣</div>'+(item.reforgeSlots?'<div class="v17346-shop-preview-reforge">[可冶煉]</div>':'')+'</div><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button><button type="button" onclick="v17346ShowShopOfferAcquisition('+safeIndex+')">獲取途徑</button></div></div>';
        window.v132ShowRewardModal(html);
    };
    function renderEquipmentShop(){
        const state=shopState();
        if(!state){ return '<div class="v17345-equipment-shop"><p role="alert">裝備商店資料無法讀取，購買與刷新已暫停。</p></div>'; }
        const offers=currentShopOffers(state);
        const freeRemaining=Math.max(0,5-state.refreshCount);
        const currentGold=typeof gold!=="undefined"?Math.max(0,Math.floor(Number(gold)||0)):0;
        const goldText=currentGold.toLocaleString("zh-TW");
        return '<div class="v17345-equipment-shop"><div class="v17345-equipment-wallet"><span>目前金幣</span><b>'+goldText+'</b></div><div class="v17345-equipment-grid">'+offers.map((item,index)=>{
            const rarity=RARITY_BY_KEY[item.rarityKey];
            const sold=state.soldOfferIds.includes(item.offerId);
            const canBuy=!sold&&currentGold>=window.FourSymbolsEquipmentFactory.prices(item).shop&&typeof window.v132CanAddItemToInventory==="function"&&window.v132CanAddItemToInventory(item,1);
            return '<article class="v17345-equipment-card v17346-shop-card '+(sold?'purchased':canBuy?'is-affordable':'is-unaffordable')+'" data-offer-id="'+escapeHtml(item.offerId)+'" data-rarity="'+escapeHtml(item.rarityKey)+'" role="button" tabindex="0" aria-label="預覽 '+escapeHtml(item.name)+'" onclick="v17346PreviewEquipmentShopOffer('+index+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();v17346PreviewEquipmentShopOffer('+index+')}"><div class="v17345-equipment-icon v17346-gear-art">'+window.FourSymbolsItemSlot.art(item.icon,item)+'</div><b class="v17346-shop-name">'+window.FourSymbolsItemSlot.name(item.name,item)+'</b><span class="v17346-shop-slot">'+escapeHtml(SLOT_META[item.type].label)+'</span><span class="v17346-stat">'+escapeHtml(statLine(item))+'</span>'+(item.reforgeSlots?'<span class="v17346-reforge-mini">[可冶煉]</span>':'')+'<button class="v17346-shop-buy" type="button" '+(canBuy?'onclick="event.stopPropagation();v17346BuyEquipmentShopOffer('+index+',\''+escapeHtml(item.offerId)+'\')"':'disabled aria-disabled="true"')+'>'+(sold?'已購買':window.FourSymbolsEquipmentFactory.prices(item).shop.toLocaleString("zh-TW")+' 金幣')+'</button></article>';
        }).join("")+(SHOP_UNLIMITED_REFRESH_TEST_MODE?'</div><div class="v17345-equipment-refresh"><button type="button" onclick="v17345RefreshEquipmentShop()">刷新商品</button></div></div>':'</div><div class="v17345-equipment-refresh"><div><b>今日刷新 '+state.refreshCount+' / 10</b><span>前5次免費；第6～10次尚未開放。</span></div><button type="button" '+(freeRemaining>0?'onclick="v17345RefreshEquipmentShop()"':'disabled')+'>'+(freeRemaining>0?'免費刷新（剩'+freeRemaining+'次）':'免費刷新已用完')+'</button></div></div>');
    }
    function replaceEquipmentShop(){
        const body=document.getElementById("homeFeatureModalBody");
        if(body&&body.querySelector(".v17345-equipment-shop")&&typeof renderShopContent==="function"){ body.innerHTML=renderShopContent(); }
    }
    let shopPurchaseInProgress=false;
    window.v17346BuyEquipmentShopOffer=function(index,expectedOfferId){
        if(shopPurchaseInProgress||!Number.isInteger(Number(index))||Number(index)<0||Number(index)>5){ return false; }
        const state=shopState();
        const item=currentShopOffers(state)[Number(index)];
        if(!item||(expectedOfferId&&expectedOfferId!==item.offerId)||state.soldOfferIds.includes(item.offerId)){ return false; }
        const cost=window.FourSymbolsEquipmentFactory.prices(item).shop;
        if(typeof gold==="undefined"||!Number.isFinite(Number(gold))||Number(gold)<cost){ void (window.rpgAlert?window.rpgAlert("金幣不足。",{title:"無法購買"}):Promise.resolve()); return false; }
        if(typeof window.v132CanAddItemToInventory!=="function"||!window.v132CanAddItemToInventory(item,1)){ alert("背包空間不足。"); return false; }
        if(typeof window.v132RunInventoryTransaction!=="function"||typeof window.v132AddItemToInventory!=="function"||typeof saveGame!=="function"){ return false; }
        const beforeGold=gold;
        const {offerId,...instance}=item;
        const nextState={...state,soldOfferIds:[...state.soldOfferIds,offerId]};
        shopPurchaseInProgress=true;
        let committed=false;
        try{
            committed=window.v132RunInventoryTransaction(()=>{
                gold-=cost;
                if(!window.v132AddItemToInventory(instance,1)){ return false; }
                return saveGame({source:"equipment-shop-purchase",equipmentShopState:nextState})===true;
            });
            if(!committed){ gold=beforeGold; }
        }finally{ shopPurchaseInProgress=false; }
        if(!committed){
            if(window.rpgAlert){ void window.rpgAlert("購買未完成，金幣與裝備已還原。",{title:"無法購買"}); }
            return false;
        }
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
        replaceEquipmentShop();
        if(window.rpgAlert){ void window.rpgAlert("已購買「"+item.name+"」。",{title:"購買成功",tone:"success"}); }
        return true;
    };
    window.FourSymbolsEquipmentShop=Object.freeze({render:renderEquipmentShop,offers:currentShopOffers,unlimitedRefreshTestMode:SHOP_UNLIMITED_REFRESH_TEST_MODE});
    window.v17345RefreshEquipmentShop=function(){
        if(shopPurchaseInProgress){ return false; }
        const state=shopState();
        if(!state||(!SHOP_UNLIMITED_REFRESH_TEST_MODE&&state.refreshCount>=5)||state.refreshCount>=Number.MAX_SAFE_INTEGER){ return false; }
        try{ localStorage.setItem(SHOP_STORAGE_KEY,JSON.stringify({...state,refreshCount:state.refreshCount+1})); }
        catch(_){ if(window.rpgAlert){ void window.rpgAlert("商店刷新未完成，請稍後再試。",{title:"無法刷新"}); } return false; }
        replaceEquipmentShop();
        return true;
    };

    function showEquipmentReward(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        if(!equipmentDungeonReward){
            const config=EQUIPMENT_DUNGEON_FRAGMENT_REWARD;
            const setId=config.setIds[Math.min(config.setIds.length-1,Math.floor(Math.random()*config.setIds.length))];
            const fragment=typeof window.v141GetSeriesFragmentDefinition==="function"?window.v141GetSeriesFragmentDefinition(setId):null;
            if(!fragment){ return; }
            equipmentDungeonReward={fragment:fragment,count:config.count};
        }
        const html='<div class="v132-reward-modal-inner"><h3>裝備副本挑戰成功！</h3><p>獲得裝備寶箱 ×2；每個寶箱開啟後隨機獲得3件裝備。</p><p>'+escapeHtml(equipmentDungeonReward.fragment.name)+' ×'+equipmentDungeonReward.count+'（暫定；廣告雙倍亦適用）</p><p>'+escapeHtml(equipmentChestOddsText("・"))+'</p><div class="v132-reward-actions"><button type="button" onclick="v17346ClaimEquipmentDungeon(false)">直接領取</button><button type="button" onclick="v17346ClaimEquipmentDungeon(true)">看廣告雙倍領取</button></div></div>';
        window.v132ShowRewardModal(html);
    }
    window.v17346ClaimEquipmentDungeon=function(doubled){
        if(!equipmentDungeonReward||equipmentDungeonClaiming){ return false; }
        const receipt=equipmentDungeonReward;
        equipmentDungeonClaiming=true;
        const grant=multiplier=>{
            if(equipmentDungeonReward!==receipt){ return false; }
            const chestCount=2*multiplier,fragmentCount=receipt.count*multiplier;
            const committed=typeof window.v132RunInventoryTransaction==="function"&&
                typeof window.v132AddItemToInventory==="function"&&typeof saveGame==="function"&&
                window.v132RunInventoryTransaction(()=>
                    window.v132AddItemToInventory(EQUIPMENT_CHEST_DEFINITION,chestCount)&&
                    window.v132AddItemToInventory(receipt.fragment,fragmentCount)&&saveGame()===true);
            equipmentDungeonClaiming=false;
            if(!committed){ alert("獎勵尚未領取，請確認背包空間與存檔後再試。"); return false; }
            equipmentDungeonReward=null;
            syncEquipmentChestPresentation();
            if(typeof rebuildInventorySlots==="function"){ rebuildInventorySlots(); }
            if(typeof renderInventoryItems==="function"){ renderInventoryItems(); }
            if(typeof window.v132CloseRewardModal==="function"){ window.v132CloseRewardModal(); }
            if(typeof window.rpgAlert==="function"){
                void window.rpgAlert("獲得裝備寶箱×"+chestCount+"、"+receipt.fragment.name+"×"+fragmentCount+"。",{title:"裝備副本獎勵",confirmText:"知道了",tone:"success"});
            }
            if(typeof showPage==="function"){ showPage("dungeon"); }
            if(typeof switchDungeonTab==="function"){ switchDungeonTab("daily"); }
            return true;
        };
        if(doubled&&typeof showRewardedAd==="function"){
            showRewardedAd(()=>grant(2),()=>{ if(equipmentDungeonReward===receipt){ equipmentDungeonClaiming=false; alert("廣告未完成，未獲得雙倍獎勵。"); } });
            return true;
        }
        return grant(1);
    };

    async function beginEquipmentDungeon(){
        if(equipmentDungeonReward){ showEquipmentReward(); return; }
        if(equipmentDungeonRunning||typeof window.v148BuildDailyDungeonWaves!=="function"||typeof window.v132LaunchDungeonBattle!=="function"){ return; }
        const built=window.v148BuildDailyDungeonWaves("gold");
        const waves=built&&built.waves||[];
        if(waves.length!==3){ return; }
        const accepted=window.rpgConfirm?await window.rpgConfirm("裝備副本共3輪，每輪6名敵人。\n勝利後獲得2個裝備寶箱，以及隨機一種元素系列碎片 ×"+EQUIPMENT_DUNGEON_FRAGMENT_REWARD.count+"（暫定），獎勵會放入背包；每箱開啟後隨機獲得3件裝備。\n是否開始挑戰？",{title:"裝備副本",confirmText:"開始挑戰"}):true;
        if(!accepted){ return; }
        if(typeof window.v154PrepareDailyDungeonPortraits==="function"){
            const prepared=await window.v154PrepareDailyDungeonPortraits("gold");
            if(!prepared||prepared.state!=="ready"){
                alert("每日副本立繪尚未就緒，請重新進入副本。");
                return;
            }
        }
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
            },{mode:"daily",dailyDungeonType:"gold"});
            if(started===false){ equipmentDungeonRunning=false; equipmentDungeonWaveIndex=-1; }
        };
        launch(0);
    }
    window.v17346BeginEquipmentDungeon=beginEquipmentDungeon;

    window.v17346ShowEquipmentDungeonPreview=function(){
        if(typeof window.v132ShowRewardModal!=="function"){ return; }
        const odds=equipmentChestOddsText("　・　");
        const html='<div class="v132-reward-modal-inner v17361-reward-preview v17363-text-reward-preview">'+
            '<div class="v17363-preview-heading"><small>DAILY DUNGEON</small><h3>裝備副本獎勵預覽</h3></div>'+
            '<div class="v17363-preview-groups">'+
                '<section class="v17363-preview-group"><b>裝備寶箱</b><em>×2</em><p>勝利後取得 2 個裝備寶箱；每個寶箱固定隨機取得 3 件裝備。</p></section>'+
                '<section class="v17363-preview-group"><b>元素系列碎片</b><em>隨機一種 ×'+EQUIPMENT_DUNGEON_FRAGMENT_REWARD.count+'</em><p>赤炎／寒泉／岩岳／青嵐等機率；暫定，每種'+(100/EQUIPMENT_DUNGEON_FRAGMENT_REWARD.setIds.length)+'%；廣告雙倍亦適用。</p></section>'+
                '<section class="v17363-preview-group"><b>裝備品階機率</b><p>'+escapeHtml(odds)+'</p></section>'+
            '</div>'+
            '<div class="v17363-preview-note">機率直接取自正式裝備寶箱掉落表，不載入大型裝備預覽圖。</div>'+
            '<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';
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

    /* Inventory QoL follows this source inside gameplay-core. */
})();
