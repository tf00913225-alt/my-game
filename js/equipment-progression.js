/* =====================================================
   Equipment progression authority
   - four elemental set stats / orange quality
   - explicit reforge-slot rule
   - ordinary equipment generator shared by shop + equipment chests
   - equipment dungeon chest rewards
===================================================== */
(function installEquipmentProgression(){
    "use strict";
    if(typeof window==="undefined"||window.__equipmentProgressionInstalled){ return; }
    window.__equipmentProgressionInstalled=true;

    const RARITIES=[
        {key:"white",label:"白階",chance:40,min:5,max:10,reforgeSlots:0,shopPrice:500,color:"#D8D8D8",available:true},
        {key:"blue",label:"藍階",chance:40,min:11,max:16,reforgeSlots:0,shopPrice:1500,color:"#42A5FF",available:true},
        {key:"purple",label:"紫階",chance:15,min:17,max:22,reforgeSlots:1,shopPrice:4000,color:"#B05CFF",available:true},
        {key:"orange",label:"橙階",chance:5,min:23,max:28,reforgeSlots:1,shopPrice:10000,color:"#FF9F38",available:true},
        {key:"pink",label:"桃紅階",chance:0,available:false,planned:true,color:"#FF4FA7"},
        {key:"four-symbol",label:"四象階",chance:0,available:false,planned:true,fourSymbol:true,color:null}
    ];
    const RARITY_BY_KEY=Object.fromEntries(RARITIES.map(item=>[item.key,item]));
    const EQUIPMENT_SHOP_DROP_TABLE=[
        {key:"white",label:"白階",chance:70},
        {key:"blue",label:"藍階",chance:15},
        {key:"purple",label:"紫階",chance:10},
        {key:"orange",label:"橙階",chance:5}
    ];
    const EQUIPMENT_CHEST_DROP_TABLE=[
        {key:"white",label:"白階",chance:40},
        {key:"blue",label:"藍階",chance:40},
        {key:"purple",label:"紫階",chance:15},
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
        {"name":"紫霞銀龍戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"vitality":17}},
        {"name":"幽月銀龍戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"agility":20}},
        {"name":"日曜銀龍戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"vitality":23}},
        {"name":"天衡銀龍戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-001.webp","stats":{"agility":26}},
        {"name":"紫霞赤焰戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"vitality":18}},
        {"name":"幽月赤焰戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"agility":21}},
        {"name":"日曜赤焰戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"vitality":24}},
        {"name":"天衡赤焰戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-002.webp","stats":{"agility":27}},
        {"name":"紫霞赤羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"vitality":19}},
        {"name":"幽月赤羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"attack":22}},
        {"name":"日曜赤羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"vitality":25}},
        {"name":"天衡赤羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-003.webp","stats":{"attack":28}},
        {"name":"紫霞金龍戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"attack":20}},
        {"name":"幽月金龍戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"defensePoints":17}},
        {"name":"日曜金龍戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"attack":26}},
        {"name":"天衡金龍戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-004.webp","stats":{"defensePoints":23}},
        {"name":"紫霞玄紅戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"attack":21}},
        {"name":"幽月玄紅戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"vitality":18}},
        {"name":"日曜玄紅戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"attack":27}},
        {"name":"天衡玄紅戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-005.webp","stats":{"vitality":24}},
        {"name":"紫霞紫晶長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":22}},
        {"name":"幽月紫晶長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":19}},
        {"name":"日曜紫晶長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":28}},
        {"name":"天衡紫晶長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-006.webp","stats":{"attack":25}},
        {"name":"紫霞墨龍戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"agility":17}},
        {"name":"幽月墨龍戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"defensePoints":20}},
        {"name":"日曜墨龍戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"agility":23}},
        {"name":"天衡墨龍戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-007.webp","stats":{"defensePoints":26}},
        {"name":"紫霞冰晶長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":18}},
        {"name":"幽月冰晶長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":21}},
        {"name":"日曜冰晶長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":24}},
        {"name":"天衡冰晶長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-008.webp","stats":{"attack":27}},
        {"name":"紫霞碧玉長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":19}},
        {"name":"幽月碧玉長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":22}},
        {"name":"日曜碧玉長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":25}},
        {"name":"天衡碧玉長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-009.webp","stats":{"attack":28}},
        {"name":"紫霞白羽長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":20}},
        {"name":"幽月白羽長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":17}},
        {"name":"日曜白羽長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":26}},
        {"name":"天衡白羽長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-010.webp","stats":{"attack":23}},
        {"name":"紫霞霜雪戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":21}},
        {"name":"幽月霜雪戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":18}},
        {"name":"日曜霜雪戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":27}},
        {"name":"天衡霜雪戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-011.webp","stats":{"attack":24}},
        {"name":"紫霞血影戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"vitality":22}},
        {"name":"幽月血影戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"agility":19}},
        {"name":"日曜血影戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"vitality":28}},
        {"name":"天衡血影戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-012.webp","stats":{"agility":25}},
        {"name":"紫霞翠龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"vitality":17}},
        {"name":"幽月翠龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"attack":20}},
        {"name":"日曜翠龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"vitality":23}},
        {"name":"天衡翠龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-013.webp","stats":{"attack":26}},
        {"name":"紫霞赤龍戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":18}},
        {"name":"幽月赤龍戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":21}},
        {"name":"日曜赤龍戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":24}},
        {"name":"天衡赤龍戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-014.webp","stats":{"attack":27}},
        {"name":"紫霞黑翼護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"defensePoints":19}},
        {"name":"幽月黑翼護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"vitality":22}},
        {"name":"日曜黑翼護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"defensePoints":25}},
        {"name":"天衡黑翼護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-015.webp","stats":{"vitality":28}},
        {"name":"紫霞玄金戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"vitality":20}},
        {"name":"幽月玄金戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"attack":17}},
        {"name":"日曜玄金戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"vitality":26}},
        {"name":"天衡玄金戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-016.webp","stats":{"attack":23}},
        {"name":"紫霞赤鱗戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"attack":21}},
        {"name":"幽月赤鱗戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"defensePoints":18}},
        {"name":"日曜赤鱗戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"attack":27}},
        {"name":"天衡赤鱗戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-017.webp","stats":{"defensePoints":24}},
        {"name":"紫霞赤金長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":22}},
        {"name":"幽月赤金長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":19}},
        {"name":"日曜赤金長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":28}},
        {"name":"天衡赤金長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-018.webp","stats":{"attack":25}},
        {"name":"紫霞翠龍戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":17}},
        {"name":"幽月翠龍戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":20}},
        {"name":"日曜翠龍戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":23}},
        {"name":"天衡翠龍戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-019.webp","stats":{"attack":26}},
        {"name":"紫霞滄浪戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":18}},
        {"name":"幽月滄浪戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":21}},
        {"name":"日曜滄浪戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":24}},
        {"name":"天衡滄浪戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-020.webp","stats":{"attack":27}},
        {"name":"紫霞玄金戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"agility":19}},
        {"name":"幽月玄金戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"attack":22}},
        {"name":"日曜玄金戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"agility":25}},
        {"name":"天衡玄金戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-021.webp","stats":{"attack":28}},
        {"name":"紫霞雷霆戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":20}},
        {"name":"幽月雷霆戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":17}},
        {"name":"日曜雷霆戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":26}},
        {"name":"天衡雷霆戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-022.webp","stats":{"attack":23}},
        {"name":"紫霞金羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"agility":21}},
        {"name":"幽月金羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"defensePoints":18}},
        {"name":"日曜金羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"agility":27}},
        {"name":"天衡金羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-023.webp","stats":{"defensePoints":24}},
        {"name":"紫霞滄龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"attack":22}},
        {"name":"幽月滄龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"defensePoints":19}},
        {"name":"日曜滄龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"attack":28}},
        {"name":"天衡滄龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-024.webp","stats":{"defensePoints":25}},
        {"name":"紫霞白羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"vitality":17}},
        {"name":"幽月白羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"attack":20}},
        {"name":"日曜白羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"vitality":23}},
        {"name":"天衡白羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-025.webp","stats":{"attack":26}},
        {"name":"紫霞玄鐵長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":18}},
        {"name":"幽月玄鐵長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":21}},
        {"name":"日曜玄鐵長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":24}},
        {"name":"天衡玄鐵長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-026.webp","stats":{"attack":27}},
        {"name":"紫霞翡翠戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":19}},
        {"name":"幽月翡翠戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":22}},
        {"name":"日曜翡翠戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":25}},
        {"name":"天衡翡翠戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-027.webp","stats":{"attack":28}},
        {"name":"紫霞寒霜戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"agility":20}},
        {"name":"幽月寒霜戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"defensePoints":17}},
        {"name":"日曜寒霜戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"agility":26}},
        {"name":"天衡寒霜戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-028.webp","stats":{"defensePoints":23}},
        {"name":"紫霞紫金戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"vitality":21}},
        {"name":"幽月紫金戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"agility":18}},
        {"name":"日曜紫金戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"vitality":27}},
        {"name":"天衡紫金戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-029.webp","stats":{"agility":24}},
        {"name":"紫霞金獅護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"vitality":22}},
        {"name":"幽月金獅護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"attack":19}},
        {"name":"日曜金獅護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"vitality":28}},
        {"name":"天衡金獅護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-030.webp","stats":{"attack":25}},
        {"name":"紫霞魔角戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"vitality":17}},
        {"name":"幽月魔角戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"attack":20}},
        {"name":"日曜魔角戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"vitality":23}},
        {"name":"天衡魔角戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-031.webp","stats":{"attack":26}},
        {"name":"紫霞墨影長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":18}},
        {"name":"幽月墨影長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":21}},
        {"name":"日曜墨影長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":24}},
        {"name":"天衡墨影長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-032.webp","stats":{"attack":27}},
        {"name":"紫霞血羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"agility":19}},
        {"name":"幽月血羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"defensePoints":22}},
        {"name":"日曜血羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"agility":25}},
        {"name":"天衡血羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-033.webp","stats":{"defensePoints":28}},
        {"name":"紫霞赤金戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"vitality":20}},
        {"name":"幽月赤金戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"agility":17}},
        {"name":"日曜赤金戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"vitality":26}},
        {"name":"天衡赤金戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-034.webp","stats":{"agility":23}},
        {"name":"紫霞青金戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":21}},
        {"name":"幽月青金戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":18}},
        {"name":"日曜青金戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":27}},
        {"name":"天衡青金戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-035.webp","stats":{"attack":24}},
        {"name":"紫霞紫晶護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"defensePoints":22}},
        {"name":"幽月紫晶護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"vitality":19}},
        {"name":"日曜紫晶護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"defensePoints":28}},
        {"name":"天衡紫晶護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-036.webp","stats":{"vitality":25}},
        {"name":"紫霞烈焰長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":17}},
        {"name":"幽月烈焰長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":20}},
        {"name":"日曜烈焰長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":23}},
        {"name":"天衡烈焰長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-037.webp","stats":{"attack":26}},
        {"name":"紫霞冰龍戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"attack":18}},
        {"name":"幽月冰龍戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"defensePoints":21}},
        {"name":"日曜冰龍戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"attack":24}},
        {"name":"天衡冰龍戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-038.webp","stats":{"defensePoints":27}},
        {"name":"紫霞翠鱗戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"vitality":19}},
        {"name":"幽月翠鱗戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"agility":22}},
        {"name":"日曜翠鱗戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"vitality":25}},
        {"name":"天衡翠鱗戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-039.webp","stats":{"agility":28}},
        {"name":"紫霞古銀戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"attack":20}},
        {"name":"幽月古銀戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"vitality":17}},
        {"name":"日曜古銀戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"attack":26}},
        {"name":"天衡古銀戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-040.webp","stats":{"vitality":23}},
        {"name":"紫霞炎龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"attack":21}},
        {"name":"幽月炎龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"defensePoints":18}},
        {"name":"日曜炎龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"attack":27}},
        {"name":"天衡炎龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-041.webp","stats":{"defensePoints":24}},
        {"name":"紫霞寒泉長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":22}},
        {"name":"幽月寒泉長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":19}},
        {"name":"日曜寒泉長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":28}},
        {"name":"天衡寒泉長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-042.webp","stats":{"attack":25}},
        {"name":"紫霞日曜戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"attack":17}},
        {"name":"幽月日曜戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"defensePoints":20}},
        {"name":"日曜日曜戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"attack":23}},
        {"name":"天衡日曜戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-043.webp","stats":{"defensePoints":26}},
        {"name":"紫霞霜鋼戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"agility":18}},
        {"name":"幽月霜鋼戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"attack":21}},
        {"name":"日曜霜鋼戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"agility":24}},
        {"name":"天衡霜鋼戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-044.webp","stats":{"attack":27}},
        {"name":"紫霞烏鐵戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":19}},
        {"name":"幽月烏鐵戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":22}},
        {"name":"日曜烏鐵戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":25}},
        {"name":"天衡烏鐵戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-045.webp","stats":{"attack":28}},
        {"name":"紫霞白凰戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"vitality":20}},
        {"name":"幽月白凰戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"agility":17}},
        {"name":"日曜白凰戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"vitality":26}},
        {"name":"天衡白凰戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-046.webp","stats":{"agility":23}},
        {"name":"紫霞鎖龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"vitality":21}},
        {"name":"幽月鎖龍護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"attack":18}},
        {"name":"日曜鎖龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"vitality":27}},
        {"name":"天衡鎖龍護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-047.webp","stats":{"attack":24}},
        {"name":"紫霞碧紋戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"vitality":22}},
        {"name":"幽月碧紋戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"agility":19}},
        {"name":"日曜碧紋戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"vitality":28}},
        {"name":"天衡碧紋戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-048.webp","stats":{"agility":25}},
        {"name":"紫霞龍爪戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"attack":17}},
        {"name":"幽月龍爪戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"vitality":20}},
        {"name":"日曜龍爪戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"attack":23}},
        {"name":"天衡龍爪戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-049.webp","stats":{"vitality":26}},
        {"name":"紫霞炎牙戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":18}},
        {"name":"幽月炎牙戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":21}},
        {"name":"日曜炎牙戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":24}},
        {"name":"天衡炎牙戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-050.webp","stats":{"attack":27}},
        {"name":"紫霞銅羽長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":19}},
        {"name":"幽月銅羽長槍","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":22}},
        {"name":"日曜銅羽長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":25}},
        {"name":"天衡銅羽長槍","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-051.webp","stats":{"attack":28}},
        {"name":"紫霞冰晶護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"defensePoints":20}},
        {"name":"幽月冰晶護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"vitality":17}},
        {"name":"日曜冰晶護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"defensePoints":26}},
        {"name":"天衡冰晶護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-052.webp","stats":{"vitality":23}},
        {"name":"紫霞鳳羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"vitality":21}},
        {"name":"幽月鳳羽戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"attack":18}},
        {"name":"日曜鳳羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"vitality":27}},
        {"name":"天衡鳳羽戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-053.webp","stats":{"attack":24}},
        {"name":"紫霞虎嘯戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"agility":22}},
        {"name":"幽月虎嘯戰盔","rarityKey":"purple","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"defensePoints":19}},
        {"name":"日曜虎嘯戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"agility":28}},
        {"name":"天衡虎嘯戰盔","rarityKey":"orange","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/catalog-054.webp","stats":{"defensePoints":25}},
        {"name":"紫霞赤角護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"attack":17}},
        {"name":"幽月赤角護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"defensePoints":20}},
        {"name":"日曜赤角護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"attack":23}},
        {"name":"天衡赤角護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-055.webp","stats":{"defensePoints":26}},
        {"name":"紫霞赤凰護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"vitality":18}},
        {"name":"幽月赤凰護腕","rarityKey":"purple","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"attack":21}},
        {"name":"日曜赤凰護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"vitality":24}},
        {"name":"天衡赤凰護腕","rarityKey":"orange","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/catalog-056.webp","stats":{"attack":27}},
        {"name":"紫霞黑鋼戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"agility":19}},
        {"name":"幽月黑鋼戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"attack":22}},
        {"name":"日曜黑鋼戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"agility":25}},
        {"name":"天衡黑鋼戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-057.webp","stats":{"attack":28}},
        {"name":"紫霞棕革戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"vitality":20}},
        {"name":"幽月棕革戰靴","rarityKey":"purple","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"agility":17}},
        {"name":"日曜棕革戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"vitality":26}},
        {"name":"天衡棕革戰靴","rarityKey":"orange","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/catalog-058.webp","stats":{"agility":23}},
        {"name":"紫霞白金戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":21}},
        {"name":"幽月白金戰刀","rarityKey":"purple","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":18}},
        {"name":"日曜白金戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":27}},
        {"name":"天衡白金戰刀","rarityKey":"orange","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/catalog-059.webp","stats":{"attack":24}},
        {"name":"紫霞墨金戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"attack":22}},
        {"name":"幽月墨金戰甲","rarityKey":"purple","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"defensePoints":19}},
        {"name":"日曜墨金戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"attack":28}},
        {"name":"天衡墨金戰甲","rarityKey":"orange","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/catalog-060.webp","stats":{"defensePoints":25}},
        {"name":"紫霞滄玉法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"vitality":17}},
        {"name":"幽月滄玉法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"intelligence":20}},
        {"name":"日曜滄玉法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"vitality":23}},
        {"name":"天衡滄玉法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-001.webp","stats":{"intelligence":26}},
        {"name":"紫霞紫月法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":18}},
        {"name":"幽月紫月法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":21}},
        {"name":"日曜紫月法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":24}},
        {"name":"天衡紫月法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-002.webp","stats":{"intelligence":27}},
        {"name":"紫霞星藍法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"vitality":19}},
        {"name":"幽月星藍法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"agility":22}},
        {"name":"日曜星藍法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"vitality":25}},
        {"name":"天衡星藍法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-003.webp","stats":{"agility":28}},
        {"name":"紫霞星紋法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"vitality":20}},
        {"name":"幽月星紋法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"agility":17}},
        {"name":"日曜星紋法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"vitality":26}},
        {"name":"天衡星紋法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-004.webp","stats":{"agility":23}},
        {"name":"紫霞寒羽法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"intelligence":21}},
        {"name":"幽月寒羽法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"vitality":18}},
        {"name":"日曜寒羽法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"intelligence":27}},
        {"name":"天衡寒羽法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-005.webp","stats":{"vitality":24}},
        {"name":"紫霞桃晶法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":22}},
        {"name":"幽月桃晶法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":19}},
        {"name":"日曜桃晶法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":28}},
        {"name":"天衡桃晶法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-006.webp","stats":{"intelligence":25}},
        {"name":"紫霞墨月法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":17}},
        {"name":"幽月墨月法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":20}},
        {"name":"日曜墨月法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":23}},
        {"name":"天衡墨月法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-007.webp","stats":{"intelligence":26}},
        {"name":"紫霞雪霜法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"vitality":18}},
        {"name":"幽月雪霜法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"intelligence":21}},
        {"name":"日曜雪霜法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"vitality":24}},
        {"name":"天衡雪霜法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-008.webp","stats":{"intelligence":27}},
        {"name":"紫霞翠羽法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":19}},
        {"name":"幽月翠羽法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":22}},
        {"name":"日曜翠羽法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":25}},
        {"name":"天衡翠羽法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-009.webp","stats":{"intelligence":28}},
        {"name":"紫霞墨金法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":20}},
        {"name":"幽月墨金法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":17}},
        {"name":"日曜墨金法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":26}},
        {"name":"天衡墨金法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-010.webp","stats":{"intelligence":23}},
        {"name":"紫霞青山法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":21}},
        {"name":"幽月青山法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":18}},
        {"name":"日曜青山法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":27}},
        {"name":"天衡青山法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-011.webp","stats":{"intelligence":24}},
        {"name":"紫霞翠雲法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"intelligence":22}},
        {"name":"幽月翠雲法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"defensePoints":19}},
        {"name":"日曜翠雲法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"intelligence":28}},
        {"name":"天衡翠雲法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-012.webp","stats":{"defensePoints":25}},
        {"name":"紫霞冰翼法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"defensePoints":17}},
        {"name":"幽月冰翼法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"vitality":20}},
        {"name":"日曜冰翼法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"defensePoints":23}},
        {"name":"天衡冰翼法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-013.webp","stats":{"vitality":26}},
        {"name":"紫霞霜紋法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"agility":18}},
        {"name":"幽月霜紋法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"intelligence":21}},
        {"name":"日曜霜紋法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"agility":24}},
        {"name":"天衡霜紋法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-014.webp","stats":{"intelligence":27}},
        {"name":"紫霞冰花法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":19}},
        {"name":"幽月冰花法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":22}},
        {"name":"日曜冰花法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":25}},
        {"name":"天衡冰花法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-015.webp","stats":{"intelligence":28}},
        {"name":"紫霞冰蓮法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"agility":20}},
        {"name":"幽月冰蓮法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"defensePoints":17}},
        {"name":"日曜冰蓮法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"agility":26}},
        {"name":"天衡冰蓮法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-016.webp","stats":{"defensePoints":23}},
        {"name":"紫霞流藍法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"vitality":21}},
        {"name":"幽月流藍法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"agility":18}},
        {"name":"日曜流藍法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"vitality":27}},
        {"name":"天衡流藍法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-017.webp","stats":{"agility":24}},
        {"name":"紫霞紫晶法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"intelligence":22}},
        {"name":"幽月紫晶法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"defensePoints":19}},
        {"name":"日曜紫晶法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"intelligence":28}},
        {"name":"天衡紫晶法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-018.webp","stats":{"defensePoints":25}},
        {"name":"紫霞翡翠法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"vitality":17}},
        {"name":"幽月翡翠法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"intelligence":20}},
        {"name":"日曜翡翠法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"vitality":23}},
        {"name":"天衡翡翠法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-019.webp","stats":{"intelligence":26}},
        {"name":"紫霞星辰法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"intelligence":18}},
        {"name":"幽月星辰法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"vitality":21}},
        {"name":"日曜星辰法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"intelligence":24}},
        {"name":"天衡星辰法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-020.webp","stats":{"vitality":27}},
        {"name":"紫霞紫月法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"vitality":19}},
        {"name":"幽月紫月法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"intelligence":22}},
        {"name":"日曜紫月法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"vitality":25}},
        {"name":"天衡紫月法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-021.webp","stats":{"intelligence":28}},
        {"name":"紫霞玄金法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"vitality":20}},
        {"name":"幽月玄金法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"agility":17}},
        {"name":"日曜玄金法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"vitality":26}},
        {"name":"天衡玄金法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-022.webp","stats":{"agility":23}},
        {"name":"紫霞炎晶法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":21}},
        {"name":"幽月炎晶法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":18}},
        {"name":"日曜炎晶法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":27}},
        {"name":"天衡炎晶法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-023.webp","stats":{"intelligence":24}},
        {"name":"紫霞寒星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"agility":22}},
        {"name":"幽月寒星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"intelligence":19}},
        {"name":"日曜寒星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"agility":28}},
        {"name":"天衡寒星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-024.webp","stats":{"intelligence":25}},
        {"name":"紫霞冰雲法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"intelligence":17}},
        {"name":"幽月冰雲法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"defensePoints":20}},
        {"name":"日曜冰雲法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"intelligence":23}},
        {"name":"天衡冰雲法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-025.webp","stats":{"defensePoints":26}},
        {"name":"紫霞血影法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":18}},
        {"name":"幽月血影法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":21}},
        {"name":"日曜血影法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":24}},
        {"name":"天衡血影法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-026.webp","stats":{"intelligence":27}},
        {"name":"紫霞翠環法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":19}},
        {"name":"幽月翠環法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":22}},
        {"name":"日曜翠環法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":25}},
        {"name":"天衡翠環法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-027.webp","stats":{"intelligence":28}},
        {"name":"紫霞翠羽法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":20}},
        {"name":"幽月翠羽法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":17}},
        {"name":"日曜翠羽法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":26}},
        {"name":"天衡翠羽法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-028.webp","stats":{"intelligence":23}},
        {"name":"紫霞冰蓮法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":21}},
        {"name":"幽月冰蓮法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":18}},
        {"name":"日曜冰蓮法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":27}},
        {"name":"天衡冰蓮法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-029.webp","stats":{"intelligence":24}},
        {"name":"紫霞藍金法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"defensePoints":22}},
        {"name":"幽月藍金法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"vitality":19}},
        {"name":"日曜藍金法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"defensePoints":28}},
        {"name":"天衡藍金法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-030.webp","stats":{"vitality":25}},
        {"name":"紫霞日曜法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"vitality":17}},
        {"name":"幽月日曜法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"agility":20}},
        {"name":"日曜日曜法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"vitality":23}},
        {"name":"天衡日曜法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-031.webp","stats":{"agility":26}},
        {"name":"紫霞紫星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"vitality":18}},
        {"name":"幽月紫星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"agility":21}},
        {"name":"日曜紫星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"vitality":24}},
        {"name":"天衡紫星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-032.webp","stats":{"agility":27}},
        {"name":"紫霞墨金法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":19}},
        {"name":"幽月墨金法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":22}},
        {"name":"日曜墨金法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":25}},
        {"name":"天衡墨金法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-033.webp","stats":{"intelligence":28}},
        {"name":"紫霞白金法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"intelligence":20}},
        {"name":"幽月白金法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"vitality":17}},
        {"name":"日曜白金法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"intelligence":26}},
        {"name":"天衡白金法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-034.webp","stats":{"vitality":23}},
        {"name":"紫霞墨竹法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":21}},
        {"name":"幽月墨竹法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":18}},
        {"name":"日曜墨竹法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":27}},
        {"name":"天衡墨竹法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-035.webp","stats":{"intelligence":24}},
        {"name":"紫霞紫晶法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"intelligence":22}},
        {"name":"幽月紫晶法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"defensePoints":19}},
        {"name":"日曜紫晶法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"intelligence":28}},
        {"name":"天衡紫晶法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-036.webp","stats":{"defensePoints":25}},
        {"name":"紫霞墨紫法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"intelligence":17}},
        {"name":"幽月墨紫法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"defensePoints":20}},
        {"name":"日曜墨紫法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"intelligence":23}},
        {"name":"天衡墨紫法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-037.webp","stats":{"defensePoints":26}},
        {"name":"紫霞金星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"agility":18}},
        {"name":"幽月金星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"intelligence":21}},
        {"name":"日曜金星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"agility":24}},
        {"name":"天衡金星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-038.webp","stats":{"intelligence":27}},
        {"name":"紫霞烈焰法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":19}},
        {"name":"幽月烈焰法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":22}},
        {"name":"日曜烈焰法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":25}},
        {"name":"天衡烈焰法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-039.webp","stats":{"intelligence":28}},
        {"name":"紫霞滄玉法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"vitality":20}},
        {"name":"幽月滄玉法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"agility":17}},
        {"name":"日曜滄玉法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"vitality":26}},
        {"name":"天衡滄玉法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-040.webp","stats":{"agility":23}},
        {"name":"紫霞紫晶法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":21}},
        {"name":"幽月紫晶法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":18}},
        {"name":"日曜紫晶法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":27}},
        {"name":"天衡紫晶法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-041.webp","stats":{"intelligence":24}},
        {"name":"紫霞白星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"vitality":22}},
        {"name":"幽月白星法履","rarityKey":"purple","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"agility":19}},
        {"name":"日曜白星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"vitality":28}},
        {"name":"天衡白星法履","rarityKey":"orange","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/catalog-042.webp","stats":{"agility":25}},
        {"name":"紫霞炎羽法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"vitality":17}},
        {"name":"幽月炎羽法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"intelligence":20}},
        {"name":"日曜炎羽法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"vitality":23}},
        {"name":"天衡炎羽法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-043.webp","stats":{"intelligence":26}},
        {"name":"紫霞赤金法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"intelligence":18}},
        {"name":"幽月赤金法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"defensePoints":21}},
        {"name":"日曜赤金法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"intelligence":24}},
        {"name":"天衡赤金法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-044.webp","stats":{"defensePoints":27}},
        {"name":"紫霞藍月法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"agility":19}},
        {"name":"幽月藍月法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"defensePoints":22}},
        {"name":"日曜藍月法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"agility":25}},
        {"name":"天衡藍月法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-045.webp","stats":{"defensePoints":28}},
        {"name":"紫霞血月法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"vitality":20}},
        {"name":"幽月血月法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"agility":17}},
        {"name":"日曜血月法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"vitality":26}},
        {"name":"天衡血月法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-046.webp","stats":{"agility":23}},
        {"name":"紫霞金星法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"vitality":21}},
        {"name":"幽月金星法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"intelligence":18}},
        {"name":"日曜金星法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"vitality":27}},
        {"name":"天衡金星法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-047.webp","stats":{"intelligence":24}},
        {"name":"紫霞青風法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":22}},
        {"name":"幽月青風法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":19}},
        {"name":"日曜青風法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":28}},
        {"name":"天衡青風法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-048.webp","stats":{"intelligence":25}},
        {"name":"紫霞古玉法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"defensePoints":17}},
        {"name":"幽月古玉法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"vitality":20}},
        {"name":"日曜古玉法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"defensePoints":23}},
        {"name":"天衡古玉法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-049.webp","stats":{"vitality":26}},
        {"name":"紫霞金輪法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":18}},
        {"name":"幽月金輪法杖","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":21}},
        {"name":"日曜金輪法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":24}},
        {"name":"天衡金輪法杖","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-050.webp","stats":{"intelligence":27}},
        {"name":"紫霞流藍法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"intelligence":19}},
        {"name":"幽月流藍法袍","rarityKey":"purple","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"defensePoints":22}},
        {"name":"日曜流藍法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"intelligence":25}},
        {"name":"天衡流藍法袍","rarityKey":"orange","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/catalog-051.webp","stats":{"defensePoints":28}},
        {"name":"紫霞桃花法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":20}},
        {"name":"幽月桃花法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":17}},
        {"name":"日曜桃花法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":26}},
        {"name":"天衡桃花法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-052.webp","stats":{"intelligence":23}},
        {"name":"紫霞墨玉法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"agility":21}},
        {"name":"幽月墨玉法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"defensePoints":18}},
        {"name":"日曜墨玉法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"agility":27}},
        {"name":"天衡墨玉法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-053.webp","stats":{"defensePoints":24}},
        {"name":"紫霞幽月法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"vitality":22}},
        {"name":"幽月幽月法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"intelligence":19}},
        {"name":"日曜幽月法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"vitality":28}},
        {"name":"天衡幽月法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-054.webp","stats":{"intelligence":25}},
        {"name":"紫霞翠竹法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"agility":17}},
        {"name":"幽月翠竹法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"defensePoints":20}},
        {"name":"日曜翠竹法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"agility":23}},
        {"name":"天衡翠竹法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-055.webp","stats":{"defensePoints":26}},
        {"name":"紫霞炎羽法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"vitality":18}},
        {"name":"幽月炎羽法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"intelligence":21}},
        {"name":"日曜炎羽法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"vitality":24}},
        {"name":"天衡炎羽法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-056.webp","stats":{"intelligence":27}},
        {"name":"紫霞月銀法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"intelligence":19}},
        {"name":"幽月月銀法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"defensePoints":22}},
        {"name":"日曜月銀法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"intelligence":25}},
        {"name":"天衡月銀法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-057.webp","stats":{"defensePoints":28}},
        {"name":"紫霞赤金法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"agility":20}},
        {"name":"幽月赤金法冠","rarityKey":"purple","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"defensePoints":17}},
        {"name":"日曜赤金法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"agility":26}},
        {"name":"天衡赤金法冠","rarityKey":"orange","classType":"mage","type":"head","assetPath":"assets/equipment/mage/catalog-058.webp","stats":{"defensePoints":23}},
        {"name":"紫霞白金法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"vitality":21}},
        {"name":"幽月白金法腕","rarityKey":"purple","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"intelligence":18}},
        {"name":"日曜白金法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"vitality":27}},
        {"name":"天衡白金法腕","rarityKey":"orange","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/catalog-059.webp","stats":{"intelligence":24}},
        {"name":"紫霞赤凰法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":22}},
        {"name":"幽月赤凰法扇","rarityKey":"purple","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":19}},
        {"name":"日曜赤凰法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":28}},
        {"name":"天衡赤凰法扇","rarityKey":"orange","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/catalog-060.webp","stats":{"intelligence":25}},
        {"name":"素棕革戰甲","rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-01.png","stats":{"vitality":5}},
        {"name":"樸棕革戰甲","rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-01.png","stats":{"agility":8}},
        {"name":"青紋棕革戰甲","rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-01.png","stats":{"vitality":11}},
        {"name":"靈紋棕革戰甲","rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-01.png","stats":{"agility":14}},
        {"name":"素青鋼戰甲","rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-02.png","stats":{"attack":6}},
        {"name":"樸青鋼戰甲","rarityKey":"white","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-02.png","stats":{"defensePoints":9}},
        {"name":"青紋青鋼戰甲","rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-02.png","stats":{"attack":12}},
        {"name":"靈紋青鋼戰甲","rarityKey":"blue","classType":"warrior","type":"armor","assetPath":"assets/equipment/warrior/armor-02.png","stats":{"defensePoints":15}},
        {"name":"素皮紋護腕","rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-01.png","stats":{"vitality":7}},
        {"name":"樸皮紋護腕","rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-01.png","stats":{"attack":10}},
        {"name":"青紋皮紋護腕","rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-01.png","stats":{"vitality":13}},
        {"name":"靈紋皮紋護腕","rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-01.png","stats":{"attack":16}},
        {"name":"素烏鋼護腕","rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-02.png","stats":{"defensePoints":8}},
        {"name":"樸烏鋼護腕","rarityKey":"white","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-02.png","stats":{"vitality":5}},
        {"name":"青紋烏鋼護腕","rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-02.png","stats":{"defensePoints":14}},
        {"name":"靈紋烏鋼護腕","rarityKey":"blue","classType":"warrior","type":"shoulder","assetPath":"assets/equipment/warrior/bracer-02.png","stats":{"vitality":11}},
        {"name":"素素鐵戰盔","rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-01.png","stats":{"vitality":9}},
        {"name":"樸素鐵戰盔","rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-01.png","stats":{"attack":6}},
        {"name":"青紋素鐵戰盔","rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-01.png","stats":{"vitality":15}},
        {"name":"靈紋素鐵戰盔","rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-01.png","stats":{"attack":12}},
        {"name":"素墨鋼戰盔","rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-02.png","stats":{"agility":10}},
        {"name":"樸墨鋼戰盔","rarityKey":"white","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-02.png","stats":{"defensePoints":7}},
        {"name":"青紋墨鋼戰盔","rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-02.png","stats":{"agility":16}},
        {"name":"靈紋墨鋼戰盔","rarityKey":"blue","classType":"warrior","type":"head","assetPath":"assets/equipment/warrior/head-02.png","stats":{"defensePoints":13}},
        {"name":"素粗革戰靴","rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-01.png","stats":{"vitality":5}},
        {"name":"樸粗革戰靴","rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-01.png","stats":{"agility":8}},
        {"name":"青紋粗革戰靴","rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-01.png","stats":{"vitality":11}},
        {"name":"靈紋粗革戰靴","rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-01.png","stats":{"agility":14}},
        {"name":"素鐵獅戰靴","rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-02.png","stats":{"attack":6}},
        {"name":"樸鐵獅戰靴","rarityKey":"white","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-02.png","stats":{"vitality":9}},
        {"name":"青紋鐵獅戰靴","rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-02.png","stats":{"attack":12}},
        {"name":"靈紋鐵獅戰靴","rarityKey":"blue","classType":"warrior","type":"shoes","assetPath":"assets/equipment/warrior/shoes-02.png","stats":{"vitality":15}},
        {"name":"素鈍鐵戰刀","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-01.png","stats":{"attack":7}},
        {"name":"樸鈍鐵戰刀","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-01.png","stats":{"attack":10}},
        {"name":"青紋鈍鐵戰刀","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-01.png","stats":{"attack":13}},
        {"name":"靈紋鈍鐵戰刀","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-01.png","stats":{"attack":16}},
        {"name":"素銅紋戰刀","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-02.png","stats":{"attack":8}},
        {"name":"樸銅紋戰刀","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-02.png","stats":{"attack":5}},
        {"name":"青紋銅紋戰刀","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-02.png","stats":{"attack":14}},
        {"name":"靈紋銅紋戰刀","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-02.png","stats":{"attack":11}},
        {"name":"素金穗長劍","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-03.png","stats":{"attack":9}},
        {"name":"樸金穗長劍","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-03.png","stats":{"attack":6}},
        {"name":"青紋金穗長劍","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-03.png","stats":{"attack":15}},
        {"name":"靈紋金穗長劍","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-03.png","stats":{"attack":12}},
        {"name":"素藍穗長劍","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-04.png","stats":{"attack":10}},
        {"name":"樸藍穗長劍","rarityKey":"white","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-04.png","stats":{"attack":7}},
        {"name":"青紋藍穗長劍","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-04.png","stats":{"attack":16}},
        {"name":"靈紋藍穗長劍","rarityKey":"blue","classType":"warrior","type":"weapon","assetPath":"assets/equipment/warrior/weapon-04.png","stats":{"attack":13}},
        {"name":"素雲藍法袍","rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-01.png","stats":{"vitality":5}},
        {"name":"樸雲藍法袍","rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-01.png","stats":{"agility":8}},
        {"name":"青紋雲藍法袍","rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-01.png","stats":{"vitality":11}},
        {"name":"靈紋雲藍法袍","rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-01.png","stats":{"agility":14}},
        {"name":"素墨紅法袍","rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-02.png","stats":{"intelligence":6}},
        {"name":"樸墨紅法袍","rarityKey":"white","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-02.png","stats":{"defensePoints":9}},
        {"name":"青紋墨紅法袍","rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-02.png","stats":{"intelligence":12}},
        {"name":"靈紋墨紅法袍","rarityKey":"blue","classType":"mage","type":"armor","assetPath":"assets/equipment/mage/armor-02.png","stats":{"defensePoints":15}},
        {"name":"素銀浪法腕","rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-01.png","stats":{"vitality":7}},
        {"name":"樸銀浪法腕","rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-01.png","stats":{"intelligence":10}},
        {"name":"青紋銀浪法腕","rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-01.png","stats":{"vitality":13}},
        {"name":"靈紋銀浪法腕","rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-01.png","stats":{"intelligence":16}},
        {"name":"素玄卦法腕","rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-02.png","stats":{"defensePoints":8}},
        {"name":"樸玄卦法腕","rarityKey":"white","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-02.png","stats":{"vitality":5}},
        {"name":"青紋玄卦法腕","rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-02.png","stats":{"defensePoints":14}},
        {"name":"靈紋玄卦法腕","rarityKey":"blue","classType":"mage","type":"shoulder","assetPath":"assets/equipment/mage/bracer-02.png","stats":{"vitality":11}},
        {"name":"素藍月法冠","rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-01.png","stats":{"vitality":9}},
        {"name":"樸藍月法冠","rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-01.png","stats":{"intelligence":6}},
        {"name":"青紋藍月法冠","rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-01.png","stats":{"vitality":15}},
        {"name":"靈紋藍月法冠","rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-01.png","stats":{"intelligence":12}},
        {"name":"素赤結法冠","rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-02.png","stats":{"agility":10}},
        {"name":"樸赤結法冠","rarityKey":"white","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-02.png","stats":{"defensePoints":7}},
        {"name":"青紋赤結法冠","rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-02.png","stats":{"agility":16}},
        {"name":"靈紋赤結法冠","rarityKey":"blue","classType":"mage","type":"head","assetPath":"assets/equipment/mage/head-02.png","stats":{"defensePoints":13}},
        {"name":"素冰紋法履","rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-01.png","stats":{"vitality":5}},
        {"name":"樸冰紋法履","rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-01.png","stats":{"agility":8}},
        {"name":"青紋冰紋法履","rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-01.png","stats":{"vitality":11}},
        {"name":"靈紋冰紋法履","rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-01.png","stats":{"agility":14}},
        {"name":"素紫玉法履","rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-02.png","stats":{"intelligence":6}},
        {"name":"樸紫玉法履","rarityKey":"white","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-02.png","stats":{"vitality":9}},
        {"name":"青紋紫玉法履","rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-02.png","stats":{"intelligence":12}},
        {"name":"靈紋紫玉法履","rarityKey":"blue","classType":"mage","type":"shoes","assetPath":"assets/equipment/mage/shoes-02.png","stats":{"vitality":15}},
        {"name":"素金環法杖","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-01.png","stats":{"intelligence":7}},
        {"name":"樸金環法杖","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-01.png","stats":{"intelligence":10}},
        {"name":"青紋金環法杖","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-01.png","stats":{"intelligence":13}},
        {"name":"靈紋金環法杖","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-01.png","stats":{"intelligence":16}},
        {"name":"素冰環法杖","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-02.png","stats":{"intelligence":8}},
        {"name":"樸冰環法杖","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-02.png","stats":{"intelligence":5}},
        {"name":"青紋冰環法杖","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-02.png","stats":{"intelligence":14}},
        {"name":"靈紋冰環法杖","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-02.png","stats":{"intelligence":11}},
        {"name":"素青竹法扇","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-03.png","stats":{"intelligence":9}},
        {"name":"樸青竹法扇","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-03.png","stats":{"intelligence":6}},
        {"name":"青紋青竹法扇","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-03.png","stats":{"intelligence":15}},
        {"name":"靈紋青竹法扇","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-03.png","stats":{"intelligence":12}},
        {"name":"素滄浪法扇","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-04.png","stats":{"intelligence":10}},
        {"name":"樸滄浪法扇","rarityKey":"white","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-04.png","stats":{"intelligence":7}},
        {"name":"青紋滄浪法扇","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-04.png","stats":{"intelligence":16}},
        {"name":"靈紋滄浪法扇","rarityKey":"blue","classType":"mage","type":"weapon","assetPath":"assets/equipment/mage/weapon-04.png","stats":{"intelligence":13}}
    ];
    window.v17346GetEquipmentCatalog=()=>EQUIPMENT_CATALOG.map(entry=>({...entry,stats:{...entry.stats}}));
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
    function rarityFromRandom(random=Math.random,table=RARITIES){
        const roll=random()*100;
        let cursor=0;
        for(const rarity of table){ cursor+=rarity.chance; if(roll<cursor){ return RARITY_BY_KEY[rarity.key]; } }
        throw new Error("裝備階級抽取超出範圍");
    }
    function artMarkup(path,rarityKey){
        if(!path){ return '<span class="v169-item-art v169-equipment-art" data-asset-state="missing" role="img" aria-label="裝備素材尚未就緒" title="裝備素材尚未就緒">◇</span>'; }
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarityKey+'"><img src="'+path+'" alt="" draggable="false" onerror="this.parentElement.dataset.assetState=\'broken\';this.parentElement.setAttribute(\'role\',\'img\');this.parentElement.setAttribute(\'aria-label\',\'裝備圖片無法載入\');this.parentElement.textContent=\'◇\'"></span>';
    }
    const LEGACY_STARTER_EQUIPMENT_ART={
        ironSword:{path:"assets/equipment/warrior/weapon-01.png",classType:"warrior"},
        woodStaff:{path:"assets/equipment/mage/weapon-01.png",classType:"mage"},
        leatherHelmet:{path:"assets/equipment/warrior/head-01.png"},
        leatherArmor:{path:"assets/equipment/warrior/armor-01.png"},
        leatherShoes:{path:"assets/equipment/warrior/shoes-01.png"},
        powerRing:{ring:true}
    };
    /* Starter equipment retains its fixed legacy values independently of ordinary drops. */
    const STARTER_WHITE_STATS={
        ironSword:{attack:3},
        woodStaff:{intelligence:3},
        leatherHelmet:{vitality:1},
        leatherArmor:{vitality:2},
        leatherShoes:{agility:2}
    };
    function repairStarterWhiteStats(item){
        if(!item){ return false; }
        const expected=STARTER_WHITE_STATS[String(item.id||"")];
        if(!expected){ return false; }
        const current=item.stats&&typeof item.stats==="object"?item.stats:{};
        const currentKeys=Object.keys(current);
        const expectedKeys=Object.keys(expected);
        const same=currentKeys.length===expectedKeys.length&&expectedKeys.every(key=>Number(current[key])===Number(expected[key]));
        if(same){ return false; }
        item.stats={...expected};
        return true;
    }
    function legacyStarterRingMarkup(){
        return '<span class="v169-item-art v169-equipment-art v17346-rarity-white v17357-starter-ring"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style="width:100%;height:100%;display:block"><defs><radialGradient id="v17357RingGem" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#d49a36"/><stop offset="1" stop-color="#6f4517"/></radialGradient><linearGradient id="v17357RingGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8dd86"/><stop offset=".55" stop-color="#b97623"/><stop offset="1" stop-color="#674016"/></linearGradient></defs><ellipse cx="32" cy="38" rx="18" ry="15" fill="none" stroke="url(#v17357RingGold)" stroke-width="7"/><path d="M21 24l6-8h10l6 8-6 7H27z" fill="url(#v17357RingGem)" stroke="#f6d47a" stroke-width="2"/><circle cx="32" cy="22" r="3" fill="#fff6c8" opacity=".9"/></svg></span>';
    }
    function repairLegacyStarterEquipmentIcons(){
        if(typeof inventoryItems==="undefined"||!Array.isArray(inventoryItems)){ return false; }
        let changed=false;
        inventoryItems.forEach(item=>{
            if(!item){ return; }
            const spec=LEGACY_STARTER_EQUIPMENT_ART[String(item.id||"")];
            if(!spec){ return; }
            if(repairStarterWhiteStats(item)){ changed=true; }
            const iconText=String(item.icon||"");
            const hasRealArt=/<(?:img|svg)\\b/i.test(iconText);
            if(!hasRealArt){
                item.icon=spec.ring?legacyStarterRingMarkup():artMarkup(spec.path,"white");
                changed=true;
            }
            if(spec.path&&item.assetPath!==spec.path){ item.assetPath=spec.path; changed=true; }
            if(spec.classType&&!item.classType){ item.classType=spec.classType; changed=true; }
            if(item.rarityKey!=="white"){ item.rarityKey="white"; changed=true; }
            if(item.quality!=="white"){ item.quality="white"; changed=true; }
            if(Number(item.reforgeSlots)!==0){ item.reforgeSlots=0; changed=true; }
            if(Number(item.reforgeUsed)!==0){ item.reforgeUsed=0; changed=true; }
        });
        /* Existing saves may already have a starter piece equipped rather than in inventory. */
        if(typeof characterEquipment!=="undefined"&&characterEquipment&&typeof characterEquipment==="object"){
            Object.values(characterEquipment).forEach(slots=>{
                if(!slots||typeof slots!=="object"){ return; }
                Object.values(slots).forEach(item=>{
                    if(repairStarterWhiteStats(item)){ changed=true; }
                });
            });
        }
        return changed;
    }
    window.v17357RepairLegacyStarterEquipmentIcons=repairLegacyStarterEquipmentIcons;
    window.v17362StarterWhiteStats=Object.fromEntries(Object.entries(STARTER_WHITE_STATS).map(([id,stats])=>[id,{...stats}]));
    function makeUid(prefix){ return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8); }
    function mageWeaponSuffix(asset){
        return /weapon-(?:03|04)\.png(?:\?|$)/i.test(String(asset||""))?"法扇":"法杖";
    }
    function normalizeGeneratedMageWeaponName(item){
        if(!item||!item.v17346GeneratedEquipment||item.classType!=="mage"||item.type!=="weapon"){ return item; }
        const source=item.assetPath||item.icon||"";
        const suffix=mageWeaponSuffix(source);
        if(/法器$/.test(String(item.name||""))){ item.name=String(item.name).replace(/法器$/,suffix); }
        return item;
    }
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
        const asset=entry.assetPath,name=entry.name;
        return {
            equipmentCombatPercentUnitVersion:2,
            id:makeUid("gear"),v141Uid:makeUid("gearuid"),name,
            icon:artMarkup(asset,rarity.key),type:slot,count:1,price:Math.floor(rarity.shopPrice*.2),
            stats:{...entry.stats},reforgeStats:null,reforgeSlots:rarity.reforgeSlots,reforgeUsed:0,
            rarityKey:rarity.key,quality:rarity.key,classType,assetPath:asset,
            shopPrice:rarity.shopPrice,v17346GeneratedEquipment:true
        };
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

    function addOrangeClass(icon){
        if(typeof icon!=="string"||icon.includes("v17346-rarity-orange")){ return icon; }
        return icon.replace(/class="([^"]*v169-item-art[^"]*)"/,(_m,classes)=>'class="'+classes+' v17346-rarity-orange"');
    }
    function applySetRule(item){
        const defs=typeof window.v132GetContentDefinitions==="function"?window.v132GetContentDefinitions():null;
        if(!(defs?.equipmentSetItems||[]).some(def=>def.id===item?.id&&def.setId===item?.setId)){ return item; }
        migrateLegacyEquipmentStats(item);
        window.v132NormalizeEquipmentSetItem(item);
        item.quality="orange";
        item.rarityKey="orange";
        const legacyAffixCount=item.reforgeStats&&typeof item.reforgeStats==="object"?Object.keys(item.reforgeStats).length:0;
        item.reforgeSlots=Math.max(1,legacyAffixCount,Math.floor(Number(item.reforgeSlots)||0));
        // V173.58: reforgeUsed is retained only for old-save compatibility.
        // Reforging is now unlimited; reforgeSlots means affix-slot count.
        item.reforgeUsed=0;
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
        repairLegacyStarterEquipmentIcons();
        syncEquipmentChestPresentation();
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
    if(typeof rebuildInventorySlots==="function"){
        const previousV17357RebuildInventorySlots=rebuildInventorySlots;
        rebuildInventorySlots=function(){ repairLegacyStarterEquipmentIcons(); syncEquipmentChestPresentation(); return previousV17357RebuildInventorySlots.apply(this,arguments); };
    }
    if(typeof renderInventoryItems==="function"){
        const previousV17357RenderInventoryItems=renderInventoryItems;
        renderInventoryItems=function(){ repairLegacyStarterEquipmentIcons(); syncEquipmentChestPresentation(); return previousV17357RenderInventoryItems.apply(this,arguments); };
    }
    if(typeof document!=="undefined"){
        const repairAfterLoad=()=>{ repairLegacyStarterEquipmentIcons(); syncEquipmentChestPresentation(); };
        if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",repairAfterLoad,{once:true});
        else setTimeout(repairAfterLoad,0);
    }

    function remainingReforgeSlots(item){
        return window.FourSymbolsReforge?window.FourSymbolsReforge.slotCount(item):0;
    }
    window.v17346RemainingReforgeSlots=remainingReforgeSlots;

    function appendReforgeMarkers(item){
        const stats=document.getElementById("itemModalStats");
        if(!stats){ return; }
        stats.querySelectorAll(".v17346-reforge-slot").forEach(node=>node.remove());
        const count=remainingReforgeSlots(item);
        const owner=window.FourSymbolsReforge;
        const reason=owner?owner.reason(item):"冶煉功能尚未就緒。";
        for(let index=0;index<count;index++){
            stats.insertAdjacentHTML("beforeend",'<div class="v17346-reforge-slot">'+(reason?escapeHtml(reason)+'（冶煉槽 '+(index+1)+' / '+count+'）':'[可冶煉]')+'</div>');
        }
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
.v17346-rarity-white:not(.inventory-backpack-rarity-neutral){border:2px solid #D8D8D8!important;box-shadow:0 0 7px rgba(216,216,216,.55)!important}
.v17346-rarity-blue:not(.inventory-backpack-rarity-neutral){border:2px solid #42A5FF!important;box-shadow:0 0 9px rgba(66,165,255,.7)!important}
.v17346-rarity-purple:not(.inventory-backpack-rarity-neutral){border:2px solid #B05CFF!important;box-shadow:0 0 10px rgba(176,92,255,.75)!important}
.v17346-rarity-orange:not(.inventory-backpack-rarity-neutral){border:3px solid #FF9F38!important;box-shadow:0 0 5px #FF9F38,0 0 14px rgba(255,159,56,.9),inset 0 0 8px rgba(255,159,56,.3)!important}
.v17346-rarity-pink:not(.inventory-backpack-rarity-neutral){border:3px solid #FF4FA7!important;box-shadow:0 0 6px #FF4FA7,0 0 16px rgba(255,79,167,.88),inset 0 0 9px rgba(255,79,167,.42)!important}
.v17346-rarity-four-symbol:not(.inventory-backpack-rarity-neutral){border:3px solid transparent!important;background:linear-gradient(#090807,#090807) padding-box,conic-gradient(from 0deg,#42A5FF 0 25%,#47D6A3 25% 50%,#C89B45 50% 75%,#FF5A36 75% 100%) border-box!important;box-shadow:0 0 8px rgba(255,90,54,.34),0 0 12px rgba(66,165,255,.32),0 0 16px rgba(71,214,163,.26)!important;animation:v17360FourSymbolRarityBreath 2.8s ease-in-out infinite!important}
@keyframes v17360FourSymbolRarityBreath{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.14)}}
.v17346-reforge-slot{margin-top:7px;color:#ffbf5b!important;font-weight:900;letter-spacing:.06em}
#game-ui #itemModal #v17342InventoryPotionUse{-webkit-appearance:none!important;appearance:none!important;background:linear-gradient(180deg,#d9ad55 0%,#9c641c 100%)!important;border:1px solid #f2cf83!important;color:#1a1007!important;opacity:1!important;font-weight:900!important;text-shadow:none!important;box-shadow:inset 0 1px 0 rgba(255,242,192,.42),0 3px 8px rgba(0,0,0,.34)!important}
#game-ui #itemModal #v17342InventoryPotionUse:focus,#game-ui #itemModal #v17342InventoryPotionUse:focus-visible,#game-ui #itemModal #v17342InventoryPotionUse:active{background:linear-gradient(180deg,#edc66d 0%,#ad7524 100%)!important;color:#160d05!important;outline:2px solid rgba(255,220,139,.72)!important;outline-offset:1px!important}
#game-ui #itemModal #v17342InventoryPotionUse:disabled{background:#33291f!important;border-color:#66533d!important;color:#8f806b!important;box-shadow:none!important;opacity:.68!important}
.v132-reward-modal-inner.v17346-preview-modal{width:min(360px,calc(100% - 24px))!important;height:min(540px,calc(100dvh - 24px))!important;max-height:calc(100dvh - 24px)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:16px!important;box-sizing:border-box!important}
.v132-reward-modal-inner.v17346-preview-modal>h3{position:static!important;flex:0 0 auto!important;margin:0 0 12px!important;padding:0!important;background:transparent!important}
.v132-reward-modal-inner.v17346-preview-modal .v132-preview-list-scroll{flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;touch-action:pan-y;scrollbar-gutter:stable}
.v132-reward-modal-inner.v17346-preview-modal .v132-reward-actions{position:static!important;flex:0 0 auto!important;margin-top:12px!important;padding-top:0!important;background:transparent!important}
.v17346-shop-card{position:relative;overflow:hidden;padding:10px 9px 9px!important;cursor:pointer;transition:filter .16s ease,background .16s ease,border-color .16s ease}.v17346-shop-card .v17346-gear-art{width:74px;height:74px;margin:0 auto 7px}.v17346-gear-art .v169-item-art{width:100%!important;height:100%!important}.v17346-shop-card .v17346-shop-name{display:block;color:#f6e7c2!important;font-size:17px!important;line-height:1.22!important;font-weight:900!important;letter-spacing:.02em}.v17346-shop-card .v17346-shop-slot{display:block;margin-top:3px;color:#c9b894!important;font-size:14px!important;line-height:1.25!important}.v17346-shop-card .v17346-stat{display:block;margin-top:3px;color:#ffe0a0!important;font-size:15px!important;line-height:1.3!important;font-weight:800!important}.v17346-shop-card .v17346-reforge-mini{display:block;margin-top:2px;color:#ffbf5b;font-size:12px;font-weight:800}.v17346-shop-card .v17346-shop-buy{-webkit-appearance:none;appearance:none;width:100%;min-height:42px;margin-top:8px;border:1px solid rgba(226,181,87,.76);border-radius:7px;font-size:15px;font-weight:900;line-height:1.15}.v17346-shop-card.is-affordable{background:linear-gradient(180deg,rgba(51,36,19,.94),rgba(19,14,10,.96))!important;box-shadow:inset 0 0 0 1px rgba(225,179,83,.08),0 0 10px rgba(211,155,54,.08)}.v17346-shop-card.is-affordable .v17346-shop-buy{background:linear-gradient(180deg,#f4d477 0%,#cf942d 58%,#a76518 100%)!important;border-color:#ffe5a0!important;color:#241506!important;text-shadow:0 1px rgba(255,239,185,.35)!important;box-shadow:inset 0 1px 0 rgba(255,248,211,.62),0 0 10px rgba(236,183,71,.32)!important}.v17346-shop-card.is-affordable .v17346-shop-buy:active{background:linear-gradient(180deg,#fff0ad,#d69a32)!important;color:#160d05!important}.v17346-shop-card.is-unaffordable{background:linear-gradient(180deg,rgba(38,29,24,.94),rgba(17,14,12,.98))!important;border-color:rgba(119,83,61,.72)!important}.v17346-shop-card.is-unaffordable .v17346-gear-art img{filter:saturate(.48) brightness(.72)}.v17346-shop-card.is-unaffordable .v17346-shop-name{color:#b9aa98!important}.v17346-shop-card.is-unaffordable[data-rarity="orange"] .v17346-shop-name{color:#d7944d!important}.v17346-shop-card.is-unaffordable .v17346-shop-slot,.v17346-shop-card.is-unaffordable .v17346-stat{color:#978878!important}.v17346-shop-card .v17346-shop-buy:disabled{background:linear-gradient(180deg,rgba(91,43,31,.82),rgba(48,27,23,.92))!important;border-color:rgba(167,79,56,.7)!important;color:#d79279!important;box-shadow:none!important;opacity:.86!important;cursor:not-allowed}.v17346-equipment-dungeon-card .v141-dungeon-cover-art{background-image:linear-gradient(rgba(5,4,3,.2),rgba(5,4,3,.68)),url('assets/ui/dungeon-equipment-v17346.png')!important;background-size:cover!important;background-position:center!important}
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
            if(!stored||typeof stored.date!=="string"||!Number.isInteger(stored.refreshCount)||stored.refreshCount<0||stored.refreshCount>10){ return null; }
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
        return Array.from({length:6},(_,index)=>{
            const offerId=state.date+":"+state.refreshCount+":"+index;
            const random=seededRandom(offerId);
            const rarity=rarityFromRandom(random,EQUIPMENT_SHOP_DROP_TABLE);
            return {...generateEquipment(random,{rarity:rarity.key}),offerId};
        });
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
        const html='<div class="v132-reward-modal-inner v17346-shop-preview-modal item-presentation-frame" data-presentation-mode="shop-preview" data-rarity="'+escapeHtml(item.rarityKey)+'"><h3>'+escapeHtml(item.name)+'</h3><div class="item-presentation-scroll" data-scroll-owner="y"><div class="v17346-shop-preview-art">'+item.icon+'</div><div class="v17346-shop-preview-info"><span>'+escapeHtml(SLOT_META[item.type].label)+'</span><strong>'+escapeHtml(statLine(item))+'</strong></div><div class="v17346-shop-preview-price">'+rarity.shopPrice.toLocaleString("zh-TW")+' 金幣</div>'+(item.reforgeSlots?'<div class="v17346-shop-preview-reforge">[可冶煉]</div>':'')+'</div><div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button><button type="button" onclick="v17346ShowShopOfferAcquisition('+safeIndex+')">獲取途徑</button></div></div>';
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
            const canBuy=!sold&&currentGold>=rarity.shopPrice&&typeof window.v132CanAddItemToInventory==="function"&&window.v132CanAddItemToInventory(item,1);
            return '<article class="v17345-equipment-card v17346-shop-card '+(sold?'purchased':canBuy?'is-affordable':'is-unaffordable')+'" data-offer-id="'+escapeHtml(item.offerId)+'" data-rarity="'+escapeHtml(item.rarityKey)+'" role="button" tabindex="0" aria-label="預覽 '+escapeHtml(item.name)+'" onclick="v17346PreviewEquipmentShopOffer('+index+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();v17346PreviewEquipmentShopOffer('+index+')}"><div class="v17345-equipment-icon v17346-gear-art">'+item.icon+'</div><b class="v17346-shop-name">'+escapeHtml(item.name)+'</b><span class="v17346-shop-slot">'+escapeHtml(SLOT_META[item.type].label)+'</span><span class="v17346-stat">'+escapeHtml(statLine(item))+'</span>'+(item.reforgeSlots?'<span class="v17346-reforge-mini">[可冶煉]</span>':'')+'<button class="v17346-shop-buy" type="button" '+(canBuy?'onclick="event.stopPropagation();v17346BuyEquipmentShopOffer('+index+',\''+escapeHtml(item.offerId)+'\')"':'disabled aria-disabled="true"')+'>'+(sold?'已購買':rarity.shopPrice.toLocaleString("zh-TW")+' 金幣')+'</button></article>';
        }).join("")+'</div><div class="v17345-equipment-refresh"><div><b>今日刷新 '+state.refreshCount+' / 10</b><span>前5次免費；第6～10次尚未開放。</span></div><button type="button" '+(freeRemaining>0?'onclick="v17345RefreshEquipmentShop()"':'disabled')+'>'+(freeRemaining>0?'免費刷新（剩'+freeRemaining+'次）':'免費刷新已用完')+'</button></div></div>';
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
        const cost=Math.max(0,Number(item.shopPrice)||0);
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
    window.FourSymbolsEquipmentShop=Object.freeze({render:renderEquipmentShop});
    window.v17345RefreshEquipmentShop=function(){
        if(shopPurchaseInProgress){ return false; }
        const state=shopState();
        if(!state||state.refreshCount>=5){ return false; }
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
