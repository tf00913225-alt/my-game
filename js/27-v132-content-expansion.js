/*
   V132 — 新增道具（符咒）、材料（礦石／裝備設計圖）、
   裝備套裝（赤炎／寒泉／岩岳／青嵐）、抽獎券、
   三個日常副本（經驗／材料／裝備）。

   ★ 整體設計原則：
   1. 儘量重用既有函式（makeZoneMonster()產生怪物、
      processNextCombatant()等回合引擎、renderBattle()/
      showPage()等既有UI渲染、showRewardedAd()廣告雙倍
      領取），不重新發明一套戰鬥/渲染邏輯，降低風險。
   2. 副本怪物借用「monsters這個全域陣列本來就是可以整包
      替換」的既有慣例（切換練功區域時就是直接整包换成
      對應區域的陣列，見js/00-main.js「目前所在區域的怪物
      資料」那段註解）——進副本前先記住原本的monsters/
      currentZone，副本結束後完整還原，不會弄壞巡怪系統。
   3. 素材/裝備視覺先用純CSS+inline SVG做出有辨識度的
      色塊圖示（依照使用者指示「先暫時用CSS/JavaScript
      動畫+Canvas/SVG/WebGL/Shader做出來，後期再用美術
      更改」），不做過度複雜的即時運算圖形，先求正確、
      好維護。
*/
(function installV132ContentExpansion(){
    "use strict";

    /* =====================================================
       0. 共用小工具
    ===================================================== */

    function todayString(){
        const now=new Date();
        const year=now.getFullYear();
        const month=String(now.getMonth()+1).padStart(2,"0");
        const day=String(now.getDate()).padStart(2,"0");
        return year+"-"+month+"-"+day;
    }

    function escapeHtml(text){
        return String(text==null ? "" : text)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    /*
       ★ 修正（根源問題）：物品清單格（inventory-icon）跟
       裝備欄（inventory-equipment-icon）都是用innerHTML
       塞item.icon，SVG字串能正常渲染；但物品詳細彈窗
       （openItemModal()/openEquippedItem()）是用
       textContent塞item.icon，SVG字串會被當成純文字
       原樣印出來，變成一整串看不懂的<svg>標籤文字。
       這裡在DOM渲染完之後，把圖示元素從textContent
       改回innerHTML，兩個函式都補這個收尾，不用整個
       複寫這兩個函式本體。
    */
    function fixItemModalIconRendering(){
        const iconEl=document.getElementById("itemModalIcon");
        if(!iconEl){ return; }
        const raw=iconEl.textContent;
        if(raw && raw.indexOf("<")!==-1){
            iconEl.innerHTML=raw;
        }
    }

    /*
       ★ 新增（依照使用者要求，「套裝效果顯示再點擊裝備的時候
       就應該顯示」）：不管是點背包裡還沒穿的套裝物品，還是點
       已經穿在身上的套裝物品，都在物品詳細彈窗補上「目前這件
       所屬套裝，這個角色身上已經穿了幾件／5件」跟兩條套裝加成
       說明，未達成的門檻用「未啟動」+較暗的樣式呈現，已達成的
       用「已啟動」+較亮的樣式呈現，一眼就能看出離下一階效果
       還差幾件。這裡刻意只「附加」在既有stats區塊後面，不去
       動getStatText()本身的輸出，一般裝備/非套裝物品完全不受
       影響（item.setId不存在時直接跳過）。
    */
    function appendEquipmentSetInfo(item){
        if(!item || !item.setId){ return; }
        const equipmentKey=getBackpackEquipmentKey(inventoryCharacterIndex);
        if(!equipmentKey){ return; }
        const counts=getEquipmentSetCounts(equipmentKey);
        const count=counts[item.setId]||0;
        const label=getSetLabel(item.setId);
        const elementKey=getSetElement(item.setId);
        const elementName=(elementKey && elementDatabase[elementKey]) ? elementDatabase[elementKey].name : "";
        const threeActive=count>=3;
        const fiveActive=count>=5;
        const html=
            '<div class="v132-set-info">'+
            '<div class="v132-set-title">['+escapeHtml(label)+']'+count+'/5</div>'+
            '<div class="v132-set-bonus'+(threeActive ? " active" : " inactive")+'">'+
            '裝備三件　全能力+1　'+(threeActive ? "[已啟動]" : "[未啟動]")+
            '</div>'+
            '<div class="v132-set-bonus'+(fiveActive ? " active" : " inactive")+'">'+
            '裝備五件　'+escapeHtml(elementName)+'元素技能傷害+2%　'+(fiveActive ? "[已啟動]" : "[未啟動]")+
            '</div>'+
            '</div>';
        const statsEl=document.getElementById("itemModalStats");
        if(statsEl){ statsEl.insertAdjacentHTML("beforeend",html); }
    }

    if(typeof openItemModal==="function"){
        const originalOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=originalOpenItemModal.apply(this,arguments);
            fixItemModalIconRendering();
            appendEquipmentSetInfo(inventorySlots[slotIndex]);
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const originalOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item,slot){
            const result=originalOpenEquippedItem.apply(this,arguments);
            fixItemModalIconRendering();
            appendEquipmentSetInfo(item);
            return result;
        };
    }


    /* =====================================================
       1. 圖示產生器（純CSS/SVG色塊，先求有辨識度）
    ===================================================== */

    const TIER_COLORS={
        low:{main:"#8a9a8a",glow:"#c9d6c9"},
        mid:{main:"#4a90d9",glow:"#9ecbf5"},
        high:{main:"#a25fd9",glow:"#d9b3f5"},
        perfect:{main:"#e8a93c",glow:"#ffe08a"}
    };

    function svgWrap(inner,glow){
        return (
            '<svg viewBox="0 0 64 64" width="100%" height="100%" '+
            'xmlns="http://www.w3.org/2000/svg" style="display:block;">'+
            '<defs><filter id="v132glow" x="-50%" y="-50%" width="200%" height="200%">'+
            '<feGaussianBlur stdDeviation="2.2" result="b"/>'+
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'+
            '</filter></defs>'+
            '<g filter="url(#v132glow)">'+inner+'</g>'+
            '</svg>'
        );
    }

    function talismanIcon(tier){
        const c=TIER_COLORS[tier]||TIER_COLORS.low;
        return svgWrap(
            '<rect x="14" y="6" width="36" height="52" rx="4" '+
            'fill="#241a10" stroke="'+c.main+'" stroke-width="2.5"/>'+
            '<line x1="32" y1="12" x2="32" y2="52" stroke="'+c.glow+'" stroke-width="1.2" stroke-dasharray="2,3"/>'+
            '<circle cx="32" cy="20" r="4" fill="'+c.main+'"/>'+
            '<path d="M22 30 L42 30 M22 38 L42 38 M22 46 L42 46" stroke="'+c.glow+'" stroke-width="2"/>',
            c.glow
        );
    }

    function oreIcon(tier){
        const c=TIER_COLORS[tier]||TIER_COLORS.low;
        return svgWrap(
            '<polygon points="32,6 52,22 44,56 20,56 12,22" '+
            'fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2.5"/>'+
            '<polygon points="32,6 44,56 20,56" fill="'+c.glow+'" opacity="0.28"/>',
            c.glow
        );
    }

    function blueprintIcon(tier){
        const c=TIER_COLORS[tier]||TIER_COLORS.low;
        return svgWrap(
            '<rect x="10" y="8" width="44" height="48" rx="2" '+
            'fill="#12251f" stroke="'+c.main+'" stroke-width="2.5"/>'+
            '<path d="M16 18 H48 M16 26 H48 M16 34 H36 M16 42 H40" '+
            'stroke="'+c.glow+'" stroke-width="1.6"/>'+
            '<circle cx="46" cy="46" r="6" fill="none" stroke="'+c.glow+'" stroke-width="2"/>',
            c.glow
        );
    }

    function chestIcon(){
        const c=TIER_COLORS.mid;
        return svgWrap(
            '<rect x="8" y="26" width="48" height="30" rx="3" '+
            'fill="#2a1c0e" stroke="'+c.main+'" stroke-width="2.5"/>'+
            '<path d="M8 30 Q32 12 56 30" fill="#3a270f" stroke="'+c.main+'" stroke-width="2.5"/>'+
            '<rect x="27" y="26" width="10" height="18" fill="'+c.glow+'" opacity="0.85"/>'+
            '<circle cx="32" cy="34" r="3.4" fill="#2a1c0e" stroke="'+c.glow+'" stroke-width="1.4"/>',
            c.glow
        );
    }

    function ticketIcon(elementKey){
        const palette={
            fire:{main:"#d94a2a",glow:"#ffb37a"},
            water:{main:"#2a7ed9",glow:"#9ed4ff"},
            earth:{main:"#b3792a",glow:"#f0c987"},
            wind:{main:"#2fa870",glow:"#a8f0cf"}
        };
        const c=palette[elementKey]||palette.fire;
        return svgWrap(
            '<rect x="6" y="18" width="52" height="28" rx="5" '+
            'fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2.5"/>'+
            '<circle cx="6" cy="32" r="5" fill="#12100c"/>'+
            '<circle cx="58" cy="32" r="5" fill="#12100c"/>'+
            '<line x1="24" y1="18" x2="24" y2="46" stroke="'+c.glow+'" stroke-width="1.5" stroke-dasharray="2,3"/>'+
            '<circle cx="42" cy="32" r="7" fill="'+c.glow+'" opacity="0.85"/>',
            c.glow
        );
    }

    const SET_PALETTE={
        setFire:{main:"#d94a2a",glow:"#ffb37a",label:"赤炎"},
        setWater:{main:"#2a7ed9",glow:"#9ed4ff",label:"寒泉"},
        setEarth:{main:"#b3792a",glow:"#f0c987",label:"岩岳"},
        setWind:{main:"#2fa870",glow:"#a8f0cf",label:"青嵐"}
    };

    function equipmentSetIcon(setId,pieceKey){
        const c=SET_PALETTE[setId]||SET_PALETTE.setFire;
        const shapes={
            blade:'<path d="M32 6 L38 40 L32 58 L26 40 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            fan:'<path d="M32 58 L14 20 A22 22 0 0 1 50 20 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            heavyArmor:'<path d="M16 14 L32 6 L48 14 L46 40 L32 58 L18 40 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            robe:'<path d="M22 8 H42 L48 56 H16 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            boots:'<path d="M22 6 H38 V34 L50 46 V58 H20 V40 H22 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            shoes:'<path d="M18 10 H36 V30 L52 40 V54 H16 V20 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            helm:'<path d="M32 6 A20 20 0 0 1 52 26 V38 H12 V26 A20 20 0 0 1 32 6 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            crown:'<path d="M12 42 L16 18 L26 30 L32 12 L38 30 L48 18 L52 42 Z" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            wristguard:'<rect x="16" y="22" width="32" height="20" rx="6" fill="'+c.main+'" stroke="'+c.glow+'" stroke-width="2"/>',
            focus:'<circle cx="32" cy="32" r="20" fill="none" stroke="'+c.main+'" stroke-width="4"/><circle cx="32" cy="32" r="8" fill="'+c.glow+'"/>'
        };
        return svgWrap(shapes[pieceKey]||shapes.blade,c.glow);
    }


    /* =====================================================
       2. 符咒（3種效果 × 4階，共12件）
    ===================================================== */

    const TALISMAN_TIERS=[
        {key:"low",label:"低階",chance:35},
        {key:"mid",label:"中階",chance:55},
        {key:"high",label:"高階",chance:75},
        {key:"perfect",label:"極品",chance:100}
    ];

    const TALISMAN_EFFECTS=[
        {key:"freeze",label:"冰封符",duration:4},
        {key:"stealth",label:"隱身符",duration:2},
        {key:"barrier",label:"結界符",duration:4}
    ];

    const talismanDefinitions=[];
    TALISMAN_EFFECTS.forEach(effect=>{
        TALISMAN_TIERS.forEach(tier=>{
            talismanDefinitions.push({
                id:effect.key+"Talisman"+tier.key.charAt(0).toUpperCase()+tier.key.slice(1),
                name:tier.label+effect.label,
                icon:talismanIcon(tier.key),
                type:"talisman",
                talismanEffect:effect.key,
                talismanDuration:effect.duration,
                tierChance:tier.chance,
                tierKey:tier.key,
                price:0,
                stats:{}
            });
        });
    });

    function getTalismanDefinition(id){
        return talismanDefinitions.find(def=>def.id===id)||null;
    }
    /* 暴露出去給 js/30-v135-fixes.js 的「作用對象標示」用——符咒不在
       skillDatabase 裡，那邊沒有別的方法可以認出一個符咒id。 */
    window.v132GetTalismanDefinition=getTalismanDefinition;


    /* =====================================================
       3. 礦石材料（4階）
    ===================================================== */

    const oreDefinitions=TALISMAN_TIERS.map(tier=>({
        id:"ore"+tier.key.charAt(0).toUpperCase()+tier.key.slice(1),
        name:tier.label+"礦石",
        icon:oreIcon(tier.key),
        type:"material",
        tierKey:tier.key,
        price:0,
        stats:{}
    }));

    function getOreDefinition(id){
        return oreDefinitions.find(def=>def.id===id)||null;
    }


    /* =====================================================
       4. 裝備設計圖紙（頭／護腕／鞋子／武器／衣服 × 4階，共20件）
    ===================================================== */

    const BLUEPRINT_SLOTS=[
        {key:"head",label:"頭部"},
        {key:"shoulder",label:"護腕"},
        {key:"shoes",label:"鞋子"},
        {key:"hand",label:"武器"},
        {key:"armor",label:"衣服"}
    ];

    const blueprintDefinitions=[];
    BLUEPRINT_SLOTS.forEach(slot=>{
        TALISMAN_TIERS.forEach(tier=>{
            blueprintDefinitions.push({
                id:"blueprint"+slot.key.charAt(0).toUpperCase()+slot.key.slice(1)+tier.key.charAt(0).toUpperCase()+tier.key.slice(1),
                name:tier.label+slot.label+"設計圖",
                icon:blueprintIcon(tier.key),
                type:"material",
                blueprintSlot:slot.key,
                tierKey:tier.key,
                price:0,
                stats:{}
            });
        });
    });

    function getBlueprintDefinitionsByTier(tierKey){
        return blueprintDefinitions.filter(def=>def.tierKey===tierKey);
    }


    /* =====================================================
       5. 裝備套裝抽獎券（赤炎／寒泉／岩岳／青嵐）
    ===================================================== */

    const ticketDefinitions=[
        {id:"ticketSetFire",name:"赤炎裝備抽獎券",setId:"setFire",icon:ticketIcon("fire")},
        {id:"ticketSetWater",name:"寒泉裝備抽獎券",setId:"setWater",icon:ticketIcon("water")},
        {id:"ticketSetEarth",name:"岩岳裝備抽獎券",setId:"setEarth",icon:ticketIcon("earth")},
        {id:"ticketSetWind",name:"青嵐裝備抽獎券",setId:"setWind",icon:ticketIcon("wind")}
    ].map(base=>Object.assign({
        type:"ticket",
        price:0,
        stats:{}
    },base));

    function getTicketDefinition(id){
        return ticketDefinitions.find(def=>def.id===id)||null;
    }


    /* =====================================================
       6. 裝備套裝本體（4元素 × 10件，共40件）
    ===================================================== */

    /*
       每個元素套裝10件＝5個部位、每個部位各2種變體
       （物理向／法術向），對應到既有的6個裝備欄位中的
       5個（head/hand/shoulder/armor/shoes），跟裝備
       設計圖紙涵蓋的部位完全對齊，戒指(ring)這次沒有
       套裝款式，維持原有可裝備物品即可。
    */

    const EQUIPMENT_SET_PIECES=[
        {key:"blade",slot:"weapon",name:"刀",stats:{attack:10,vitality:-2}},
        {key:"fan",slot:"weapon",name:"扇",stats:{intelligence:10,vitality:-2}},
        {key:"heavyArmor",slot:"armor",name:"鎧甲",stats:{attack:5,spirit:5}},
        {key:"robe",slot:"armor",name:"袍",stats:{intelligence:5,spirit:5}},
        {key:"boots",slot:"shoes",name:"靴",stats:{agility:10}},
        {key:"shoes",slot:"shoes",name:"履",stats:{agility:10}},
        {key:"helm",slot:"head",name:"盔",stats:{attack:12}},
        {key:"crown",slot:"head",name:"冠",stats:{intelligence:12}},
        {key:"wristguard",slot:"shoulder",name:"護腕",stats:{attack:12}},
        {key:"focus",slot:"shoulder",name:"法環",stats:{intelligence:12}}
    ];

    const EQUIPMENT_SETS=[
        {id:"setFire",label:"赤炎",element:"fire"},
        {id:"setWater",label:"寒泉",element:"water"},
        {id:"setEarth",label:"岩岳",element:"earth"},
        {id:"setWind",label:"青嵐",element:"wind"}
    ];

    const equipmentSetItemDefinitions=[];
    EQUIPMENT_SETS.forEach(set=>{
        EQUIPMENT_SET_PIECES.forEach(piece=>{
            equipmentSetItemDefinitions.push({
                id:set.id+"_"+piece.key,
                name:set.label+piece.name,
                icon:equipmentSetIcon(set.id,piece.key),
                type:piece.slot,
                setId:set.id,
                levelRequirement:20,
                price:0,
                stats:Object.assign({},piece.stats)
            });
        });
    });

    function getEquipmentSetItemDefinitions(setId){
        return equipmentSetItemDefinitions.filter(def=>def.setId===setId);
    }

    function getSetLabel(setId){
        const set=EQUIPMENT_SETS.find(s=>s.id===setId);
        return set ? set.label : setId;
    }

    function getSetElement(setId){
        const set=EQUIPMENT_SETS.find(s=>s.id===setId);
        return set ? set.element : null;
    }


    /* =====================================================
       7. 通用「加入背包」函式（不限藥水，材料/符咒/設計圖/
          抽獎券/裝備都能用同一套堆疊規則）
    ===================================================== */

    function getItemInventoryCapacity(definition){
        if(!definition){ return 0; }
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;
        const matchingStacks=inventoryItems.filter(
            item=>item && item.id===definition.id
        );
        const stackFreeSpace=maxStack<=1
            ? 0
            : matchingStacks.reduce(
                (sum,item)=>sum+Math.max(0,maxStack-(Number(item.count)||0)),
                0
            );
        const freeSlots=Math.max(0,102-inventoryItems.length);
        return stackFreeSpace+freeSlots*maxStack;
    }

    function canAddItemToInventory(definition,amount){
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        return quantity<=getItemInventoryCapacity(definition);
    }
    window.v132CanAddItemToInventory=canAddItemToInventory;

    function addItemToInventory(definition,amount){
        if(!definition){ return false; }
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;

        /*
           V137：舊版是一邊塞、一邊才檢查102格上限，數量較大時可能
           已經放入一部分才回傳false，呼叫端卻把整筆視為失敗。
           先算完整容量，確定整批都放得下才開始改背包，讓加入操作
           具備all-or-nothing語意。
        */
        if(!canAddItemToInventory(definition,quantity)){ return false; }

        if(maxStack<=1){
            let remaining=quantity;
            while(remaining>0){
                if(inventoryItems.length>=102){
                    return false;
                }
                inventoryItems.push(cloneInventoryStackItem(definition,1));
                remaining--;
            }
            return true;
        }

        let remaining=quantity;
        const stacks=inventoryItems.filter(item=>item && item.id===definition.id);
        stacks.forEach(stack=>{
            if(remaining<=0){ return; }
            const current=Math.max(0,Math.floor(Number(stack.count)||0));
            const space=Math.max(0,maxStack-current);
            const add=Math.min(space,remaining);
            stack.count=current+add;
            remaining-=add;
        });

        while(remaining>0){
            if(inventoryItems.length>=102){
                return false;
            }
            const stackCount=Math.min(maxStack,remaining);
            inventoryItems.push(cloneInventoryStackItem(definition,stackCount));
            remaining-=stackCount;
        }

        return true;
    }

    window.v132AddItemToInventory=addItemToInventory;

    function cloneInventorySnapshot(){
        return inventoryItems.map(item=>{
            if(!item || typeof item!=="object"){ return item; }
            const copy={...item};
            copy.stats=item.stats && typeof item.stats==="object"
                ? {...item.stats}
                : {};
            return copy;
        });
    }

    function restoreInventorySnapshot(snapshot){
        inventoryItems.splice(
            0,
            inventoryItems.length,
            ...snapshot.map(item=>{
                if(!item || typeof item!=="object"){ return item; }
                const copy={...item};
                copy.stats=item.stats && typeof item.stats==="object"
                    ? {...item.stats}
                    : {};
                return copy;
            })
        );
    }

    function runInventoryTransaction(operation){
        const snapshot=cloneInventorySnapshot();
        try{
            if(operation()){ return true; }
        }catch(error){
            console.error("背包交易失敗，已還原：",error);
        }
        restoreInventorySnapshot(snapshot);
        return false;
    }

    /*
       通用「從背包扣掉N個某ID物品」——寶箱/抽獎券開啟都要用到
       同一種「消耗庫存」邏輯，寫成共用版本，不用每個新物品類型
       各自複製一份扣庫存的迴圈。找不到足夠庫存時完全不動背包，
       回傳false。
    */
    function consumeStackItem(itemId,amount){
        const needed=Math.max(1,Math.floor(Number(amount)||1));
        const owned=inventoryItems.reduce((sum,item)=>{
            if(!item || item.id!==itemId){ return sum; }
            return sum+Math.max(0,Math.floor(Number(item.count)||0));
        },0);
        if(owned<needed){ return false; }

        let remaining=needed;
        for(let index=inventoryItems.length-1;index>=0 && remaining>0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==itemId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            const take=Math.min(current,remaining);
            if(current-take<=0){
                inventoryItems.splice(index,1);
            }else{
                item.count=current-take;
            }
            remaining-=take;
        }
        return true;
    }


    /* =====================================================
       8. 一般練功掉落：4種低階道具各5%（每隻怪物擊殺各自
          獨立判定）
    ===================================================== */

    const NORMAL_DROP_POOL=[
        ()=>getTalismanDefinition("freezeTalismanLow"),
        ()=>getTalismanDefinition("stealthTalismanLow"),
        ()=>getTalismanDefinition("barrierTalismanLow"),
        ()=>getOreDefinition("oreLow")
    ];

    function awardMonsterMaterialDrop(monster){
        /*
           ★ 副本戰鬥不套用這組一般練功掉落——副本本身
           有自己獨立的寶箱獎勵流程（見下方第11節），
           兩邊各自負責各自的獎勵，不會疊加。
        */
        if(window.v132ActiveDungeonRun){ return; }

        const gained=[];
        NORMAL_DROP_POOL.forEach(getDef=>{
            if(Math.random()*100>=5){ return; }
            const definition=getDef();
            if(!definition){ return; }
            if(addItemToInventory(definition,1)){
                gained.push(definition.name);
            }
        });

        if(gained.length>0){
            addBattleLog(
                (monster && monster.name ? monster.name : "怪物")+
                "掉落了"+gained.join("、")+"。"
            );
            rebuildInventorySlots();
        }
    }

    if(typeof killMonster==="function"){
        const originalKillMonster=killMonster;
        killMonster=function(index){
            const monster=monsters[index];
            const result=originalKillMonster.apply(this,arguments);
            if(monster){
                awardMonsterMaterialDrop(monster);
            }
            return result;
        };
    }


    /* =====================================================
       9. 符咒使用（戰鬥中消耗品，命中率＝階級機率＋角色
          智力加成，依角色素質判定是否命中）
    ===================================================== */

    function getTalismanHitChance(definition,character){
        const intelligence=(character && Number(character.intelligence))||0;
        const bonus=Math.floor(intelligence/10);
        return Math.min(100,Math.max(0,definition.tierChance+bonus));
    }

    function getTalismanInventoryItems(){
        const byId=new Map();
        inventoryItems.forEach(item=>{
            if(!item || item.type!=="talisman" || !item.id){ return; }
            const count=Math.max(0,Math.floor(Number(item.count)||0));
            if(count<=0){ return; }
            if(!byId.has(item.id)){
                byId.set(item.id,{...item,count:0});
            }
            byId.get(item.id).count+=count;
        });
        return Array.from(byId.values());
    }

    function consumeTalismanFromInventory(talismanId){
        for(let index=inventoryItems.length-1;index>=0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==talismanId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            if(current<=1){
                inventoryItems.splice(index,1);
            }else{
                item.count=current-1;
            }
            return true;
        }
        return false;
    }

    /*
       ★ 新增（依照使用者要求，「點選符咒沒有問選擇目標」）：
       符咒現在完全比照技能的選目標流程——冰封符要玩家自己點要冰封
       哪一隻怪，隱身符/結界符要玩家自己點要給我方哪一位角色。

       作法上刻意「不」自己造一套選目標UI，而是直接沿用遊戲既有的
       那一整套（setBattleTargetSelectionMode/selectBattleTarget、
       setBattleAllyTargetSelectionMode/selectBattleAllyTarget），
       只把符咒id當成pendingAction傳進去。好處是提示文字、卡片高亮、
       「返回」取消、結算階段讀queued.target/queued.targetAlly……
       全部原本就是對的，不用重寫也不會跟技能的行為不一致。

       ★ 已確認的相容性重點（讀過00-main.js確認）：
       - selectBattleTarget()（11119）完全不查skillDatabase，只把
         pendingAction原封不動存進queuedPlayerActions，所以「選怪物」
         這條路徑不用改任何東西就能直接用符咒id。
       - 「選我方」那條路徑不行：setBattleAllyTargetSelectionMode()
         （10713）跟selectBattleAllyTarget()（10744）都會做
         skillDatabase[actionType] 並要求 targetType 是 ally/deadAlly，
         符咒id查不到就會整個當成無效。所以下面補了這兩個的覆寫，
         遇到符咒id時改用一個「長得像技能」的合成物件走同一套判斷。
       - getBattleActionDisplayName()（10609）查不到會直接回傳原始id，
         提示會變成「選擇 [freezeTalismanLow]」這種醜東西，也一起覆寫。
    */
    function getTalismanTargetKind(definition){
        if(!definition){ return null; }
        return definition.talismanEffect==="freeze" ? "monster" : "ally";
    }

    /* 給既有的我方選目標流程用的「合成技能物件」——只需要
       targetType 跟 name 這兩個欄位就能讓那套邏輯正常運作。 */
    function makeTalismanPseudoSkill(definition){
        return {
            id:definition.id,
            name:definition.name,
            targetType:"ally",
            category:"buff"
        };
    }

    if(typeof getBattleActionDisplayName==="function"){
        const originalGetBattleActionDisplayName=getBattleActionDisplayName;
        getBattleActionDisplayName=function(actionType){
            const definition=getTalismanDefinition(actionType);
            if(definition){ return definition.name; }
            return originalGetBattleActionDisplayName.apply(this,arguments);
        };
    }

    if(typeof setBattleAllyTargetSelectionMode==="function"){
        const originalSetBattleAllyTargetSelectionMode=setBattleAllyTargetSelectionMode;
        setBattleAllyTargetSelectionMode=function(actionType){
            const definition=getTalismanDefinition(actionType);
            if(!definition){
                return originalSetBattleAllyTargetSelectionMode.apply(this,arguments);
            }

            const pseudoSkill=makeTalismanPseudoSkill(definition);
            const region=document.getElementById("battleActionRegion");
            const promptAction=document.getElementById("battleTargetPromptAction");

            if(region){ region.classList.add("target-selecting"); }
            if(promptAction){
                promptAction.textContent="選擇 ["+definition.name+"] 的我方目標";
            }

            currentBattleMonsters.forEach(index=>{
                const card=document.getElementById("battleMonster"+index);
                if(card){ card.classList.remove("targetable","target"); }
            });

            [0,1,2].forEach(index=>{
                const character=getBattleCharacterByIndex(index);
                const card=document.getElementById("battlePlayerCard"+index);
                if(card){
                    card.classList.toggle(
                        "ally-targetable",
                        isValidAllyTargetForSkill(pseudoSkill,character,index)
                    );
                }
            });

            const targetText=document.getElementById("battleTarget");
            if(targetText){ targetText.textContent="目標：請選擇我方角色"; }
        };
    }

    if(typeof selectBattleAllyTarget==="function"){
        const originalSelectBattleAllyTarget=selectBattleAllyTarget;
        selectBattleAllyTarget=function(index){
            const definition=getTalismanDefinition(pendingAction);
            if(!definition){
                return originalSelectBattleAllyTarget.apply(this,arguments);
            }

            if(!battleActive || battlePhase!=="declare" || !actionReady || !pendingAction){
                return;
            }

            const pseudoSkill=makeTalismanPseudoSkill(definition);
            const character=getBattleCharacterByIndex(index);
            if(!isValidAllyTargetForSkill(pseudoSkill,character,index)){ return; }

            const action=pendingAction;
            actionReady=false;
            pendingAction=null;
            clearBattleTargetSelectionMode();

            queuedPlayerActions[activeBattleCharacterIndex]={
                action:action,
                target:null,
                targetAlly:index
            };

            finishPlayerAction();
        };
    }

    function useTalisman(talismanId){
        const definition=getTalismanDefinition(talismanId);
        if(!definition){ return; }

        const autoOn=
            activeBattleCharacterIndex===0
            ? autoBattle
            : getPartyAutoConfig(activeBattleCharacterIndex).enabled;

        if(!battleActive || autoOn || actionReady){ return; }

        const activeCharacter=getPartyCharacterByIndex(activeBattleCharacterIndex);
        if(!activeCharacter || activeCharacter.hp<=0){ return; }

        /*
           ★ 修正（依照使用者回報「三個人都使用符咒，結果都是一個人
           在使用」的第二個成因）：宣告階段要把「已經被其他角色預定
           走的符咒」也算進去。原本只看背包剩幾張，三個角色可以同時
           宣告同一張最後一張符咒，結算時先手用掉、後面兩位撞到
           「已經沒有庫存了」白白浪費一整個回合。
        */
        const ownedCount=inventoryItems.reduce((sum,item)=>{
            if(!item || item.id!==talismanId){ return sum; }
            return sum+Math.max(0,Math.floor(Number(item.count)||0));
        },0);

        const reservedCount=Object.keys(queuedPlayerActions).reduce((sum,key)=>{
            const queued=queuedPlayerActions[key];
            if(!queued || Number(key)===activeBattleCharacterIndex){ return sum; }
            return sum+(queued.action===talismanId ? 1 : 0);
        },0);

        if(ownedCount-reservedCount<=0){
            addBattleLog(
                definition.name+
                (reservedCount>0
                    ? "剩下的數量已經被這回合其他角色預定了。"
                    : "目前沒有庫存。")
            );
            renderBattleItemMenu();
            return;
        }

        /*
           ★ 進入選目標階段（而不是直接宣告完畢）：符咒id直接當成
           pendingAction，之後由既有的selectBattleTarget()／
           selectBattleAllyTarget()負責寫進queuedPlayerActions。
        */
        actionReady=true;
        pendingAction=talismanId;
        closeMenus();

        if(getTalismanTargetKind(definition)==="monster"){
            setBattleTargetSelectionMode(talismanId);
        }else{
            setBattleAllyTargetSelectionMode(talismanId);
        }

        updateUI();
    }
    window.useTalisman=useTalisman;

    function applyTalismanEffect(talismanId,characterIndex,queued){
        const definition=getTalismanDefinition(talismanId);
        const character=getPartyCharacterByIndex(characterIndex);

        if(!definition || !character){
            finishPlayerAction();
            return;
        }

        if(!consumeTalismanFromInventory(talismanId)){
            addBattleLog(definition.name+"已經沒有庫存了。");
            finishPlayerAction();
            return;
        }
        rebuildInventorySlots();

        const hitChance=getTalismanHitChance(definition,character);
        const success=Math.random()*100<hitChance;

        /*
           ★ 修正（這就是使用者說「三個人都使用符咒，結果都是一個人
           在使用」的真正原因）：lungePlayerCard()跟showSkillNameBadge()
           的最後一個參數都是characterIndex，內部是
           $("battlePlayerCard"+(characterIndex||0))——原本這兩個呼叫
           都沒有傳，所以不管是誰施放，前傾動畫跟技能名稱都永遠演在
           0號角色的卡片上。二三號角色其實有正常結算（戰鬥紀錄有印、
           buff也有上），但畫面看起來就像「只有第一個人在用」。
           （同一個函式下面的showMissEffect()本來就有正確傳，所以
           「畫符失敗」反而一直是演在對的卡片上，剛好可以對照。）
        */
        lungePlayerCard(characterIndex);
        showSkillNameBadge(
            definition.name,
            definition.talismanEffect==="freeze" ? "water" : "wind",
            characterIndex
        );

        if(!success){
            addBattleLog((character.id||"你")+"使用"+definition.name+"，畫符失敗！");
            showMissEffect(true,characterIndex,"畫符失敗");
            finishPlayerAction();
            return;
        }

        if(definition.talismanEffect==="freeze"){
            /*
               ★ 改成優先使用玩家在宣告階段選的目標（queued.target），
               只有在那隻怪已經死掉/不存在時才退回「隨機挑一隻活的」
               當保險，不會因為目標中途死亡就整張符咒白白浪費。
            */
            let targetIndex=queued && Number.isInteger(queued.target) ? queued.target : null;

            if(targetIndex===null || !monsters[targetIndex] || !monsters[targetIndex].alive){
                const aliveTargets=currentBattleMonsters.filter(i=>monsters[i] && monsters[i].alive);
                if(aliveTargets.length===0){
                    addBattleLog(definition.name+"沒有可以生效的目標。");
                    finishPlayerAction();
                    return;
                }
                targetIndex=aliveTargets[Math.floor(Math.random()*aliveTargets.length)];
            }

            applyFreezeEffect(monsters[targetIndex],definition.talismanDuration);
            addBattleLog(
                (character.id||"你")+"使用"+definition.name+"，"+
                monsters[targetIndex].name+"被冰封了！"
            );
        }
        else{
            /*
               ★ 隱身符/結界符改成作用在玩家選的我方角色
               （queued.targetAlly），沒有選或那位已經倒下時才退回
               施法者自己。
            */
            let allyIndex=queued && Number.isInteger(queued.targetAlly) ? queued.targetAlly : characterIndex;
            let allyCharacter=getBattleCharacterByIndex(allyIndex);

            if(!allyCharacter || allyCharacter.hp<=0){
                allyIndex=characterIndex;
                allyCharacter=character;
            }

            const buffType=definition.talismanEffect==="stealth" ? "stealthSkill" : "barrier";
            allyCharacter.activeBuffs=(allyCharacter.activeBuffs||[]).filter(b=>b.type!==buffType);
            allyCharacter.activeBuffs.push({type:buffType,turnsLeft:definition.talismanDuration});

            const allyName=allyIndex===characterIndex
                ? (character.id||"你")
                : (allyCharacter.id||("角色"+(allyIndex+1)));

            addBattleLog(
                definition.talismanEffect==="stealth"
                    ? (character.id||"你")+"使用"+definition.name+"，"+allyName+
                      "進入隱身，無法被單體攻擊選中，持續"+definition.talismanDuration+"回合。"
                    : (character.id||"你")+"使用"+definition.name+"，"+allyName+
                      "獲得結界，可抵擋所有傷害，持續"+definition.talismanDuration+"回合。"
            );
        }

        updateUI();
        finishPlayerAction();
    }
    window.applyTalismanEffect=applyTalismanEffect;

    /*
       ★ 接進既有的「宣告後結算」dispatch點——跟potion
       同一個位置，找不到就代表這個版本的00-main.js結構
       跟預期不同，主動印出警告方便之後排查，不要默默失效。
    */
    if(typeof resolveQueuedPlayerAction==="function"){
        const originalResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex,token){
            const queued=queuedPlayerActions[characterIndex];

            /*
               ★ 改成用「queued.action本身是不是一個符咒id」來判斷。
               以前是寫死 action==="talisman" 再另外存 talismanId，
               但現在符咒要走既有的選目標流程，而那套流程
               （selectBattleTarget/selectBattleAllyTarget）是把
               pendingAction原封不動寫進queued.action的，沒辦法順便
               多塞一個talismanId欄位——所以直接讓action帶符咒id，
               這裡用getTalismanDefinition()反查即可。
               同時把整個queued傳下去，讓結算端讀得到玩家選的
               target／targetAlly。
            */
            const talismanId=queued && queued.action ? queued.action : null;
            if(talismanId && getTalismanDefinition(talismanId)){
                activeBattleCharacterIndex=characterIndex;
                applyTalismanEffect(talismanId,characterIndex,queued);
                return;
            }

            return originalResolveQueuedPlayerAction.apply(this,arguments);
        };
    }
    else{
        console.warn("V132：找不到resolveQueuedPlayerAction()，符咒可能無法在戰鬥中結算，需要人工檢查00-main.js的函式名稱。");
    }

    /* 啟用戰鬥符咒清單按鈕（原本disabled，只列清單）。 */
    if(typeof renderBattleItemMenu==="function"){
        const originalRenderBattleItemMenu=renderBattleItemMenu;
        renderBattleItemMenu=function(){
            const result=originalRenderBattleItemMenu.apply(this,arguments);

            if(battleItemCategory!=="talisman"){ return result; }

            const list=document.getElementById("battlePotionList");
            if(!list){ return result; }

            const talismans=getTalismanInventoryItems();
            if(talismans.length===0){ return result; }

            list.innerHTML=talismans.map(item=>{
                const definition=getTalismanDefinition(item.id);
                const chanceLabel=definition ? definition.tierChance+"%" : "";
                return (
                    '<button type="button" class="battle-item-card talisman" '+
                    'onclick="useTalisman(\''+item.id+'\')" title="'+escapeHtml(item.name)+'">'+
                    '<span class="battle-item-badge">符</span>'+
                    '<span class="battle-item-name">'+escapeHtml(item.name)+'</span>'+
                    '<span class="battle-item-effect">生效機率 '+chanceLabel+'</span>'+
                    '<span class="battle-item-count">×'+item.count+'</span>'+
                    '</button>'
                );
            }).join("");

            return result;
        };
    }


    /* =====================================================
       10. 裝備套裝加成（3件：六圍全部+1／5件：對應元素
           技能傷害+2%），接進既有兩個唯一結算入口
    ===================================================== */

    function getEquipmentSetCounts(characterId){
        const equipment=characterEquipment[characterId];
        const counts={};
        if(!equipment){ return counts; }
        Object.values(equipment).forEach(item=>{
            if(item && item.setId){
                counts[item.setId]=(counts[item.setId]||0)+1;
            }
        });
        return counts;
    }
    window.v132GetEquipmentSetCounts=getEquipmentSetCounts;

    if(typeof getEquipmentBonus==="function"){
        const originalGetEquipmentBonus=getEquipmentBonus;
        getEquipmentBonus=function(characterId){
            const bonus=originalGetEquipmentBonus.apply(this,arguments);
            const counts=getEquipmentSetCounts(characterId);

            Object.keys(counts).forEach(setId=>{
                if(counts[setId]>=3){
                    ["attack","vitality","energy","intelligence","spirit","agility"].forEach(stat=>{
                        bonus[stat]=(bonus[stat]||0)+1;
                    });
                }
            });

            return bonus;
        };
    }

    if(typeof getElementDamagePassiveMultiplier==="function"){
        const originalGetElementDamagePassiveMultiplier=getElementDamagePassiveMultiplier;
        getElementDamagePassiveMultiplier=function(character){
            let multiplier=originalGetElementDamagePassiveMultiplier.apply(this,arguments);

            if(!character || !character.element){ return multiplier; }

            const key=typeof getCharacterSkillKey==="function" ? getCharacterSkillKey(character) : null;
            const equipmentKey=key==="fire" ? "fire" : key;
            if(!equipmentKey){ return multiplier; }

            const counts=getEquipmentSetCounts(equipmentKey);
            Object.keys(counts).forEach(setId=>{
                if(counts[setId]>=5 && getSetElement(setId)===character.element){
                    multiplier+=0.02;
                }
            });

            return multiplier;
        };
    }


    /* =====================================================
       11. 裝備等級限制（20LV才能穿戴套裝裝備）
    ===================================================== */

    if(typeof equipSelectedItem==="function"){
        const originalEquipSelectedItem=equipSelectedItem;
        equipSelectedItem=function(){
            const item=inventorySlots[selectedInventorySlot];
            const character=getBackpackCharacter(inventoryCharacterIndex);

            if(
                item &&
                item.levelRequirement &&
                character &&
                (character.level||1)<item.levelRequirement
            ){
                alert(
                    item.name+"需要角色等級達到"+
                    item.levelRequirement+"級才能穿戴，"+
                    "目前等級："+(character.level||1)+"。"
                );
                return;
            }

            return originalEquipSelectedItem.apply(this,arguments);
        };
    }


    /* =====================================================
       12. 抽獎券使用（開啟後隨機獲得該系列裝備其中一件）
    ===================================================== */

    function useEquipmentTicket(ticketId){
        const definition=getTicketDefinition(ticketId);
        if(!definition){ return; }

        const owned=inventoryItems.some(item=>item && item.id===ticketId && Number(item.count)>0);
        if(!owned){
            alert(definition.name+"目前沒有庫存。");
            return;
        }

        const pieces=getEquipmentSetItemDefinitions(definition.setId);
        if(pieces.length===0){ return; }

        const won=pieces[Math.floor(Math.random()*pieces.length)];

        const added=runInventoryTransaction(()=>{
            return consumeStackItem(ticketId,1) && addItemToInventory(won,1);
        });
        rebuildInventorySlots();
        renderInventoryItems();

        if(!added){
            alert("背包空間不足，"+won.name+"無法放入背包；抽獎券未消耗。");
            return;
        }

        saveGame();
        alert("使用"+definition.name+"，獲得【"+won.name+"】！");
    }
    window.useEquipmentTicket=useEquipmentTicket;

    /*
       開啟寶箱/抽獎券之前，先讓玩家看看「這個東西開了可能拿到
       什麼」——重用既有的v132ShowRewardModal彈窗，不用另外做
       一整套新UI。
    */
    function formatPreviewProbability(value){
        const rounded=Math.round(Number(value)*10)/10;
        return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1))+"%";
    }

    function previewRow(icon,name,amount,probability){
        return (
            '<div class="v132-preview-row">'+
            '<span class="v132-preview-row-main">'+
            (icon ? '<span class="v132-preview-icon">'+icon+'</span>' : '')+
            '<span>'+escapeHtml(name)+(amount ? ' ×'+amount : '')+'</span>'+
            '</span>'+
            '<b>'+formatPreviewProbability(probability)+'</b>'+
            '</div>'
        );
    }

    function showItemPreview(item){
        if(!item){ return; }
        let html;

        if(item.type==="chest"){
            const oreRows=CHEST_TIER_WEIGHTS.map(tier=>{
                const oreDef=getOreDefinition(
                    "ore"+tier.key.charAt(0).toUpperCase()+tier.key.slice(1)
                );
                const amount=tier.key==="perfect" ? 5 : 10;
                return oreDef ? previewRow(oreDef.icon,oreDef.name,amount,tier.weight) : "";
            }).join("");
            const blueprintRows=CHEST_TIER_WEIGHTS.map(tier=>{
                const pool=getBlueprintDefinitionsByTier(tier.key);
                const eachChance=pool.length ? tier.weight/pool.length : 0;
                const amount=tier.key==="perfect" ? 5 : 10;
                return pool.map(definition=>
                    previewRow(definition.icon,definition.name,amount,eachChance)
                ).join("");
            }).join("");
            html=
                '<div class="v132-reward-modal-inner">'+
                '<h3>'+escapeHtml(item.name)+' 開啟預覽</h3>'+
                '<p>每次開啟會各獲得1組礦石與1種裝備設計圖；兩類獎勵分開抽取。</p>'+
                '<div class="v132-preview-section-title">可能獲得的礦石</div>'+
                '<div class="v132-preview-list">'+oreRows+'</div>'+
                '<div class="v132-preview-section-title">可能獲得的裝備設計圖</div>'+
                '<div class="v132-preview-list v132-preview-list-scroll">'+blueprintRows+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">關閉</button>'+
                '</div></div>';
        }
        else if(item.type==="ticket"){
            const ticketDef=getTicketDefinition(item.id);
            const pieces=ticketDef ? getEquipmentSetItemDefinitions(ticketDef.setId) : [];
            const chance=pieces.length ? 100/pieces.length : 0;
            const grid=pieces.map(p=>
                '<div class="v132-preview-item">'+
                '<span class="v132-preview-icon">'+p.icon+'</span>'+
                '<span class="v132-preview-item-name">'+escapeHtml(p.name)+'</span>'+
                '<b>'+formatPreviewProbability(chance)+'</b>'+
                '</div>'
            ).join("");
            html=
                '<div class="v132-reward-modal-inner">'+
                '<h3>'+escapeHtml(item.name)+' 開啟預覽</h3>'+
                '<p>開啟後，從以下10件['+(ticketDef ? getSetLabel(ticketDef.setId) : "")+']套裝部位中'+
                '隨機獲得1件：</p>'+
                '<div class="v132-preview-grid">'+grid+'</div>'+
                '<div class="v132-reward-actions">'+
                '<button type="button" onclick="v132CloseRewardModal()">關閉</button>'+
                '</div></div>';
        }
        else{
            return;
        }

        v132ShowRewardModal(html);
    }
    window.v132ShowItemPreview=showItemPreview;

    /*
       ★ 物品詳細彈窗補上符咒/抽獎券/寶箱的「開啟」跟「預覽」
       按鈕——這幾種東西不是藥水（不走usePotion()那條路）、
       也不是裝備（不能穿戴），原本的itemEquipButton在這幾種
       類型上只會被判成「不可裝備」整個鎖死但還是顯示著，這裡
       依照 V138 最新規格，寶箱/抽獎券點開只顯示「開啟／預覽」
       兩個物品動作；穿戴與售出都隱藏，避免零售價物品被誤售。
    */
    if(typeof openItemModal==="function"){
        const afterOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=afterOpenItemModal.apply(this,arguments);

            const item=inventorySlots[slotIndex];
            const equipButton=document.getElementById("itemEquipButton");
            const sellButton=document.querySelector("#itemModal .sell-button");
            let useButton=document.getElementById("v132ItemUseButton");
            let previewButton=document.getElementById("v132ItemPreviewButton");

            if(!useButton && equipButton && equipButton.parentElement){
                useButton=document.createElement("button");
                useButton.id="v132ItemUseButton";
                useButton.type="button";
                useButton.className=equipButton.className;
                equipButton.parentElement.insertBefore(useButton,equipButton.nextSibling);
            }

            if(!previewButton && useButton && useButton.parentElement){
                previewButton=document.createElement("button");
                previewButton.id="v132ItemPreviewButton";
                previewButton.type="button";
                previewButton.className=useButton.className;
                useButton.parentElement.insertBefore(previewButton,useButton.nextSibling);
            }

            const isChestOrTicket=item && (item.type==="chest" || item.type==="ticket");

            /*
               ★ 修正（依照使用者回報）：符咒不是裝備，但原本的
               openItemModal()只針對 type==="potion" 把「穿戴」鍵鎖住
               （js/00-main.js:30447），符咒會落到else分支變成一顆
               可以按的「穿戴」鍵——按下去因為
               getInventoryEquipmentSlot("talisman")查不到對應欄位，
               equipSelectedItem()只是靜默return，等於是一顆騙人的
               死按鈕。依使用者決定「符咒不能在戰鬥外使用」，這裡
               只把這顆錯誤的按鈕藏掉，不另外補「使用」鍵。
            */
            const isBattleOnlyItem=item && item.type==="talisman";

            if(equipButton){
                equipButton.style.display=
                    (isChestOrTicket || isBattleOnlyItem) ? "none" : "";
            }

            if(sellButton){
                sellButton.style.display=isChestOrTicket ? "none" : "";
            }

            if(isChestOrTicket){
                const statsEl=document.getElementById("itemModalStats");
                if(statsEl){
                    Array.from(statsEl.children).forEach(child=>{
                        if((child.textContent||"").includes("售價：")){
                            child.remove();
                        }
                    });
                }
            }

            if(useButton){
                if(item && item.type==="ticket"){
                    useButton.style.display="";
                    useButton.textContent="開啟";
                    useButton.onclick=function(){
                        useEquipmentTicket(item.id);
                        closeItemModal();
                    };
                }
                else if(item && item.type==="chest"){
                    useButton.style.display="";
                    useButton.textContent="開啟";
                    useButton.onclick=function(){
                        const opened=openSingleMaterialChestFromInventory();
                        closeItemModal();
                        if(opened){
                            alert("開啟"+item.name+"，獲得：\n"+opened.join("\n"));
                        }
                    };
                }
                else{
                    useButton.style.display="none";
                    useButton.onclick=null;
                }
            }

            if(previewButton){
                if(isChestOrTicket){
                    previewButton.style.display="";
                    previewButton.textContent="預覽";
                    previewButton.onclick=function(){
                        showItemPreview(item);
                    };
                }
                else{
                    previewButton.style.display="none";
                    previewButton.onclick=null;
                }
            }

            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const afterOpenEquippedItemActions=openEquippedItem;
        openEquippedItem=function(){
            const result=afterOpenEquippedItemActions.apply(this,arguments);
            const sellButton=document.querySelector("#itemModal .sell-button");
            const useButton=document.getElementById("v132ItemUseButton");
            const previewButton=document.getElementById("v132ItemPreviewButton");
            if(sellButton){ sellButton.style.display=""; }
            if(useButton){ useButton.style.display="none"; useButton.onclick=null; }
            if(previewButton){ previewButton.style.display="none"; previewButton.onclick=null; }
            return result;
        };
    }


    /* =====================================================
       13. 日常副本：每日次數狀態（獨立存檔，格式跟
           元素匣state同一套慣例，date跟今天不同就重置）
    ===================================================== */

    const DUNGEON_STATE_KEY="v132_daily_dungeon_state";
    const DUNGEON_TYPES=["exp","material","equipment"];

    function loadDungeonState(){
        try{
            const parsed=JSON.parse(localStorage.getItem(DUNGEON_STATE_KEY)||"{}");
            const state={date:parsed.date||todayString(),used:{}};
            DUNGEON_TYPES.forEach(type=>{
                state.used[type]=!!(parsed.used && parsed.used[type]);
            });
            return state;
        }catch(_){
            return {date:todayString(),used:{exp:false,material:false,equipment:false}};
        }
    }

    let dungeonState=loadDungeonState();

    function persistDungeonState(){
        try{
            localStorage.setItem(DUNGEON_STATE_KEY,JSON.stringify(dungeonState));
        }catch(_){ }
    }

    function ensureDungeonStateCurrent(){
        const today=todayString();
        if(dungeonState.date!==today){
            dungeonState={date:today,used:{exp:false,material:false,equipment:false}};
            persistDungeonState();
        }
    }

    /*
       ★ 修正（依照使用者要求，「副本先取消挑戰次數，方便我頻繁
       測試」）：先關掉每日次數限制，只要把這個常數改回true，
       markDungeonUsed()就會恢復正常記錄「今天挑戰過了」，
       isDungeonAvailable()/dungeonEntryCard()的UI也會自動恢復
       擋下重複挑戰，不用再改別的地方。
    */
    const DUNGEON_DAILY_LIMIT_ENABLED=false;

    function markDungeonUsed(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return; }
        ensureDungeonStateCurrent();
        dungeonState.used[type]=true;
        persistDungeonState();
    }

    /*
       ★ 修正（依照使用者回報「刪除角色了，為何副本次數沒有重置」）：
       上一版只在「寫入」端（markDungeonUsed）擋了旗標，「讀取」端
       （這裡跟dungeonEntryCard）卻照樣直接讀dungeonState.used——
       結果是旗標關掉之前就已經存進localStorage的used:true，會繼續
       讓按鈕永久disabled到隔天為止，看起來就像「次數根本沒解除」。
       讀取端也要一起看旗標，關閉時一律視為可挑戰。
    */
    function isDungeonUsedToday(type){
        if(!DUNGEON_DAILY_LIMIT_ENABLED){ return false; }
        ensureDungeonStateCurrent();
        return !!dungeonState.used[type];
    }

    function isDungeonAvailable(type){
        return !isDungeonUsedToday(type);
    }

    function hasTwoCharactersAtLevel20(){
        return getExistingPartyIndexes().filter(index=>{
            const character=getPartyCharacterByIndex(index);
            return character && (Number(character.level)||1)>=20;
        }).length>=2;
    }
    window.v132HasTwoCharactersAtLevel20=hasTwoCharactersAtLevel20;

    /*
       ★ 修正（同一個回報的另一半）：副本次數是存在
       v132_daily_dungeon_state這個「獨立的localStorage key」裡，
       而刪角色用的resetGame()（js/00-main.js）只清SAVE_KEY跟兩個
       舊版存檔key，從來沒有碰過這個key——所以刪完角色重新創角，
       副本次數還是上一個角色用掉的狀態。

       這裡不去包resetGame()（它是先confirm()再location.reload()，
       包在外面會變成「使用者按了取消，資料卻已經被清掉」），改成
       在腳本載入時判斷「目前根本沒有任何角色」——resetGame()會
       reload，reload後loadGame()找不到存檔，player.id會是空字串，
       這個時機點就是最乾淨的「全新開始」信號，順手把這兩個側邊
       key一起清乾淨。
    */
    (function resetSideCarStateWhenNoCharacter(){
        const hasAnyCharacter=
            (typeof player!=="undefined" && player && player.id) ||
            (typeof player2!=="undefined" && player2 && player2.id) ||
            (typeof player3!=="undefined" && player3 && player3.id);

        if(hasAnyCharacter){ return; }

        try{
            localStorage.removeItem(DUNGEON_STATE_KEY);
            localStorage.removeItem("v131_element_box_state");
        }catch(_){ }

        dungeonState={date:todayString(),used:{exp:false,material:false,equipment:false}};
    })();


    /* =====================================================
       14. 副本怪物等級公式：玩家總角色等級加總 ÷ 角色數量
    ===================================================== */

    /*
       ★ 修正（依照使用者明確指正）：
       原本「所有已建立角色等級總和÷角色數量」的算法，
       在高等主力帶低等角色時會把副本等級平均得很低
       （例如Lv.50+Lv.20+Lv.10只會算出約Lv.27），造成
       副本明顯偏簡單。改成「隊伍最高角色等級×0.70＋
       隊伍平均角色等級×0.30」，讓副本等級主要跟著隊伍
       裡最強的角色走，平均值只用來做小幅度的微調，
       不會再被低等角色拖累太多。只有一名角色時，
       最高等級跟平均等級相同，算出來還是原本的角色
       等級，行為不變。
    */
    function getDungeonMonsterLevel(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 1; }
        const levels=indexes.map(index=>{
            const character=getPartyCharacterByIndex(index);
            return (character && character.level)||1;
        });
        const maxLevel=Math.max(...levels);
        const avgLevel=levels.reduce((sum,l)=>sum+l,0)/levels.length;
        return Math.max(1,Math.round(maxLevel*0.70+avgLevel*0.30));
    }

    const DUNGEON_ELEMENTS=["fire","water","earth","wind"];

    function randomElement(){
        return DUNGEON_ELEMENTS[Math.floor(Math.random()*DUNGEON_ELEMENTS.length)];
    }

    /*
       ★ 新增（依照使用者回報「副本的怪物感覺太弱了」）：
       makeZoneMonster()做出來的是「裸的」基礎數值，一般
       練功區域的怪物實際上都會再套用js/25-v131-fix-batch.js
       裡strengthenMonster()那套+30%強化（HP/SP/攻擊/防禦/
       魔攻各×1.30，見該檔案V131_MONSTER_STRENGTH常數），
       但副本怪物是這次新增的、繞過了那條強化路徑，直接用
       makeZoneMonster()的原始數值——等於同一等級下，副本
       怪物比一般練功區域怪物弱了整整30%，這正是使用者
       感覺到的落差。這裡套用完全相同的倍率，讓副本怪物至少
       跟一般練功區域同等級怪物打平（副本本身難度更高，用
       更高等級/更多精英/BOSS去堆疊挑戰性，不需要再讓
       同等級怪物本身數值更弱）。
    */
    const DUNGEON_MONSTER_STRENGTH=1.30;

    function applyDungeonMonsterStrength(monster){
        if(!monster){ return monster; }
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*DUNGEON_MONSTER_STRENGTH));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       ★ 新增（依照使用者要求，「副本怪物整體仍然偏弱」的
       第二輪調整）：
       上面的DUNGEON_MONSTER_STRENGTH（×1.30）只讓副本怪
       打平一般野怪，這裡疊加「副本普通怪」自己的額外強化
       （×1.10，含SP），讓同等級的副本普通怪本來就應該比
       野外普通怪再強一截（1.30×1.10≈1.43倍）。精英/BOSS
       都是先墊到這一層「副本普通怪」的完整數值，才各自再
       疊加精英/BOSS專屬倍率（見下面applyDungeonRankStrength），
       不是另外從裸數值重算，也不會讓×1.30被套用第二次
       ——這五個函式（makeZoneMonster→
       applyDungeonMonsterStrength→applyDungeonNormalBonus→
       applyDungeonRankStrength，全部包在buildDungeonMonster()
       裡）就是唯一負責副本怪數值的地方，一般野怪完全不會
       經過這裡，不受影響。
    */
    const DUNGEON_NORMAL_BONUS=1.10;

    function applyDungeonNormalBonus(monster){
        if(!monster){ return monster; }
        ["maxHP","maxSP","attack","defense","magicAttack"].forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*DUNGEON_NORMAL_BONUS));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       精英/BOSS專屬倍率，都是從「副本普通怪」的完整數值
       （已經套過×1.30跟×1.10）再往上疊加，不重新從裸數值
       算起。V138 依最新規格在原有強度上再加：精英最終HP
       再+100%、SP+100%；BOSS最終HP再+50%、SP+100%。
       因此保留既有的攻擊／魔攻／防禦倍率，HP倍率分別由
       1.60×2.00＝3.20、3.00×1.50＝4.50，SP則兩者皆×2.00。
       只認monster.rank（makeZoneMonster()第4個參數決定），
       一般怪（rank是undefined）這裡什麼都不做，直接跳過。
    */
    const DUNGEON_ELITE_MULTIPLIERS={maxHP:3.20,maxSP:2.00,attack:1.30,magicAttack:1.30,defense:1.25};
    const DUNGEON_BOSS_MULTIPLIERS={maxHP:4.50,maxSP:2.00,attack:1.50,magicAttack:1.50,defense:1.40};

    function applyDungeonRankStrength(monster){
        if(!monster){ return monster; }
        const multipliers=
            monster.rank==="elite" ? DUNGEON_ELITE_MULTIPLIERS :
            monster.rank==="boss" ? DUNGEON_BOSS_MULTIPLIERS :
            null;
        if(!multipliers){ return monster; }
        Object.keys(multipliers).forEach(key=>{
            if(Number.isFinite(Number(monster[key]))){
                monster[key]=Math.max(1,Math.round(Number(monster[key])*multipliers[key]));
            }
        });
        monster.hp=monster.maxHP;
        monster.sp=monster.maxSP;
        return monster;
    }

    /*
       ★ 副本怪物唯一的建構入口——取代原本呼叫端各自寫
       applyDungeonMonsterStrength(makeZoneMonster(...))的
       寫法，把「makeZoneMonster()→套×1.30→套副本普通怪
       ×1.10→套精英/BOSS專屬倍率」這整條固定順序收在同一個
       函式裡，避免之後新增副本怪物時漏掉某一步、或不小心
       把倍率套錯順序/套第二次。
    */
    function buildDungeonMonster(name,level,element,rank){
        const monster=makeZoneMonster(name,level,element,rank);
        applyDungeonMonsterStrength(monster);
        applyDungeonNormalBonus(monster);
        applyDungeonRankStrength(monster);
        return monster;
    }

    function setMonsterSkillTier(monster,tier,chance){
        const pool=Object.keys(skillDatabase).filter(skillId=>{
            const skill=skillDatabase[skillId];
            return (
                skill.element===monster.element &&
                (skill.category==="physical" || skill.category==="magic") &&
                skill.tier===tier
            );
        });
        monster.skillIds=pool;
        monster.skillChance=chance;
    }

    function setMonsterMaxTierSkills(monster,chance){
        const pool=Object.keys(skillDatabase).filter(skillId=>{
            const skill=skillDatabase[skillId];
            return (
                skill.element===monster.element &&
                (skill.category==="physical" || skill.category==="magic") &&
                skill.tier===4
            );
        });
        monster.skillIds=pool;
        monster.skillChance=chance;
    }


    /* =====================================================
       15. 副本戰鬥啟動器（借用monsters整包替換的既有慣例，
           結束後完整還原，不影響巡怪系統）
    ===================================================== */

    window.v132ActiveDungeonRun=null;

    function launchDungeonBattle(monsterList,onComplete){
        if(battleActive){
            alert("目前正在戰鬥中，無法開始副本。");
            return false;
        }

        window.v132ActiveDungeonRun={
            previousMonsters:monsters,
            previousZone:currentZone,
            onComplete:onComplete,
            startedAt:Date.now()
        };

        monsters=monsterList;
        currentZone="dungeon";

        battleActive=true;
        battleToken++;
        stopMonsterMovement();
        clearInterval(timerId);
        if(battleAdvanceTimeoutId){
            clearTimeout(battleAdvanceTimeoutId);
            battleAdvanceTimeoutId=null;
        }
        battleAdvanceScheduled=false;
        closeMenus();

        selectedMonster=0;
        turn=1;
        actionReady=false;
        pendingAction=null;

        /*
           V137：副本舊版每次launch（經驗副本三個stage也各算一次）
           都把第二、第三角色補滿，主角卻保留殘血，造成免費補血與
           車輪戰難度失真。比照一般戰鬥，三名角色一律只夾在目前
           上限內，不平白回復HP/SP。
        */
        getExistingPartyIndexes().forEach(characterIndex=>{
            const character=getPartyCharacterByIndex(characterIndex);
            const stats=getPartyBattleStats(characterIndex);
            if(!character || !stats){ return; }
            character.hp=Number.isFinite(Number(character.hp))
                ? Math.max(0,Math.min(stats.maxHP,Number(character.hp)))
                : stats.maxHP;
            character.sp=Number.isFinite(Number(character.sp))
                ? Math.max(0,Math.min(stats.maxSP,Number(character.sp)))
                : stats.maxSP;
            character.activeBuffs=[];
            character.statusEffects=[];
            character.isDefending=false;
        });

        currentBattleMonsters=monsterList.map((m,i)=>i);
        currentBattleMonsters.forEach(i=>{
            monsters[i].alive=true;
            monsters[i].hp=monsters[i].maxHP;
            monsters[i].sp=monsters[i].maxSP;
            monsters[i].statusEffects=[];
        });

        renderBattle();
        showPage("battle");

        autoBattle=autoConfig.enabled;
        if(typeof window.v131SyncElementBoxForBattle==="function"){
            window.v131SyncElementBoxForBattle({silent:true});
        }
        syncBattleAutoSettings();
        updateAutoButton();

        selectBattleTarget(0);
        clearBattleLog();
        addBattleLog("副本戰鬥開始！");
        addBattleLog("敵人共有"+currentBattleMonsters.length+"隻。");

        startTurn(battleToken);
        return true;
    }

    /*
       ★ winBattle()/loseBattle()是既有巡怪系統勝負結算
       的唯一入口，副本借用同一套回合引擎，勝負當然也會
       經過這裡——用window.v132ActiveDungeonRun這個旗標
       判斷「這場是不是副本戰鬥」，是的話整段導去副本
       專屬的結算流程，並且完整還原monsters/currentZone，
       不執行巡怪那一套（重生怪物、回地圖……）。
    */
    function restoreDungeonMonsters(){
        const run=window.v132ActiveDungeonRun;
        if(!run){ return; }
        monsters=run.previousMonsters;
        currentZone=run.previousZone;
    }

    if(typeof winBattle==="function"){
        const originalWinBattle=winBattle;
        winBattle=function(){
            const run=window.v132ActiveDungeonRun;
            if(!run){
                return originalWinBattle.apply(this,arguments);
            }

            battleActive=false;
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            clearInterval(timerId);
            timerId=null;
            if(battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId);
                battleAdvanceTimeoutId=null;
            }
            battleAdvanceScheduled=false;
            battleToken++;
            closeMenus();

            addBattleLog("副本這一場戰鬥勝利！");

            const turnsUsed=turn;
            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            applyPostBattleAutoRecovery();
            saveGame();

            if(run.onComplete){
                run.onComplete({result:"win",turnsUsed:turnsUsed});
            }
        };
    }

    if(typeof loseBattle==="function"){
        const originalLoseBattle=loseBattle;
        loseBattle=function(){
            const run=window.v132ActiveDungeonRun;
            if(!run){
                return originalLoseBattle.apply(this,arguments);
            }

            /*
               不呼叫一般loseBattle()：它會排一個2.2秒後返回巡怪地圖的
               timeout。舊版雖然先顯示副本頁，仍會被那個延遲回呼踢回
               地圖。副本失敗在這裡完整收尾並補滿隊伍，再交給副本
               callback回到日常副本頁。
            */
            battleActive=false;
            autoBattle=false;
            actionReady=false;
            pendingAction=null;
            clearInterval(timerId);
            timerId=null;
            if(battleAdvanceTimeoutId){
                clearTimeout(battleAdvanceTimeoutId);
                battleAdvanceTimeoutId=null;
            }
            battleAdvanceScheduled=false;
            battleToken++;
            closeMenus();
            addBattleLog("副本挑戰失敗……");
            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            getExistingPartyIndexes().forEach(characterIndex=>{
                const character=getPartyCharacterByIndex(characterIndex);
                const stats=getPartyBattleStats(characterIndex);
                if(!character || !stats){ return; }
                character.hp=stats.maxHP;
                character.sp=stats.maxSP;
            });
            updateUI();
            saveGame();

            if(run.onComplete){
                run.onComplete({result:"lose"});
            }
        };
    }


    /* =====================================================
       16. 經驗副本：單一角色10級開放，連續3場車輪戰
    ===================================================== */

    function startExpDungeonBattle(stage,rewardExp){
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<10;i++){
            const monster=buildDungeonMonster("經驗軍團兵",level,randomElement());
            roster.push(monster);
        }
        roster.forEach(monster=>{ setMonsterSkillTier(monster,2,0.5); });

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }

            if(stage<3){
                setTimeout(()=>{
                    startExpDungeonBattle(stage+1,rewardExp);
                },600);
                return;
            }

            showExpDungeonRewardModal(rewardExp);
        });
    }

    /*
       V139經驗副本基礎獎勵固定為「目前全隊升級需求平均值的11%」，
       落在使用者指定的每日約10～12%區間。看廣告雙倍仍沿用既有
       流程，因此一般領取約11%、雙倍領取約22%。
    */
    const EXP_DUNGEON_REWARD_RATIO=0.11;

    function getExpDungeonRewardExp(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 0; }
        const total=indexes.reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            if(!character){ return sum; }
            return sum+Math.max(0,Number(character.expNext)||0);
        },0);
        return Math.floor((total/indexes.length)*EXP_DUNGEON_REWARD_RATIO);
    }
    window.v138GetExpDungeonRewardExp=getExpDungeonRewardExp;
    window.v139GetExpDungeonRewardExp=getExpDungeonRewardExp;

    function showExpDungeonRewardModal(rewardExp){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>經驗副本挑戰成功！</h3>'+
            '<p>可獲得經驗值：<b>'+Math.floor(rewardExp).toLocaleString("zh-TW")+'</b></p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(false)">直接領取</button>'+
            '<button type="button" onclick="v132ClaimExpDungeonReward(true)">看廣告雙倍領取</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    function confirmDungeonEntry(title,details){
        return window.confirm(
            "確定要進入「"+title+"」嗎？\n\n"+
            details+"\n\n"+
            "進入後才會開始戰鬥；挑戰失敗不會扣除今日次數。"
        );
    }

    window.v132ClaimExpDungeonReward=function(doubled){
        function grant(){
            const rewardMultiplier=doubled ? 2 : 1;
            const rewardExp=Math.floor(getExpDungeonRewardExp()*rewardMultiplier);
            sharedExp+=rewardExp;
            markDungeonUsed("exp");
            addBattleLog("經驗副本結算，獲得"+rewardExp+"EXP，已存入經驗池。");
            saveGame();
            v132CloseRewardModal();
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("廣告未完成，未獲得雙倍獎勵。");
            });
        }else{
            grant();
        }
    };

    function beginExpDungeon(){
        if(!isDungeonAvailable("exp")){
            alert("經驗副本今天已經挑戰過了。");
            return;
        }
        const mainCharacter=getPartyCharacterByIndex(0);
        if(!mainCharacter || (mainCharacter.level||1)<10){
            alert("經驗副本需要主角色等級達到10級才能開啟。");
            return;
        }
        if(!confirmDungeonEntry(
            "經驗副本",
            "將連續進行3場戰鬥，基礎獎勵為目前全隊升級需求平均值的11%。"
        )){
            return;
        }
        const rewardExp=getExpDungeonRewardExp();
        startExpDungeonBattle(1,rewardExp);
    }
    window.v132BeginExpDungeon=beginExpDungeon;


    /* =====================================================
       17. 材料副本：雙角色20級開放，5精英+5普通，寶箱獎勵
    ===================================================== */

    function beginMaterialDungeon(){
        if(!isDungeonAvailable("material")){
            alert("材料副本今天已經挑戰過了。");
            return;
        }
        if(!hasTwoCharactersAtLevel20()){
            alert("材料副本需要至少兩名角色都達到20級才能開啟。");
            return;
        }
        if(!canAddItemToInventory(materialChestDefinition,3)){
            alert("請先預留可放入3個材料寶箱的背包空間，再挑戰材料副本。");
            return;
        }
        if(!confirmDungeonEntry(
            "材料副本",
            "本場共有10隻怪物；通關後材料寶箱只會放進背包，不會自動開啟。"
        )){
            return;
        }

        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("礦脈守衛精英",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }
        for(let i=0;i<5;i++){
            const monster=buildDungeonMonster("礦脈守衛",level,randomElement());
            setMonsterSkillTier(monster,2,0.7);
            roster.push(monster);
        }

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            const chestCount=outcome.turnsUsed<5 ? 3 : (outcome.turnsUsed<10 ? 2 : 1);
            showMaterialDungeonRewardModal(chestCount);
        });
    }
    window.v132BeginMaterialDungeon=beginMaterialDungeon;

    /*
       ★ 修正（依照使用者要求，「副本寶箱領取時，不應該直接
       開啟，而是放進包包給玩家自主開起」）：
       原本「材料副本挑戰成功」按「直接領取」就會馬上把寶箱
       全部拆開、材料直接進背包，玩家完全沒有機會自己選時機
       開。改成：領取只把「材料寶箱」這個新物品（可堆疊）
       放進背包，真正的開箱（骰礦石/設計圖階級）延後到玩家
       在背包裡點開這個物品、按下「開啟」的那一刻才進行。
    */
    const CHEST_TIER_WEIGHTS=[
        {key:"low",label:"低階",weight:40},
        {key:"mid",label:"中階",weight:30},
        {key:"high",label:"高階",weight:20},
        {key:"perfect",label:"極品",weight:10}
    ];

    const materialChestDefinition={
        id:"materialChest",
        name:"材料寶箱",
        icon:chestIcon(),
        type:"chest",
        price:0,
        stats:{}
    };

    function pickWeightedTier(){
        const roll=Math.random()*100;
        let acc=0;
        for(const tier of CHEST_TIER_WEIGHTS){
            acc+=tier.weight;
            if(roll<acc){ return tier.key; }
        }
        return CHEST_TIER_WEIGHTS[CHEST_TIER_WEIGHTS.length-1].key;
    }

    /* 骰「開1個材料寶箱」會拿到的內容，純計算、不碰背包。 */
    function rollMaterialChestRewards(){
        const oreTier=pickWeightedTier();
        const oreDef=getOreDefinition("ore"+oreTier.charAt(0).toUpperCase()+oreTier.slice(1));
        const oreAmount=oreTier==="perfect" ? 5 : 10;

        const blueprintTier=pickWeightedTier();
        const blueprintPool=getBlueprintDefinitionsByTier(blueprintTier);
        const blueprintDef=blueprintPool[Math.floor(Math.random()*blueprintPool.length)];
        const blueprintAmount=blueprintTier==="perfect" ? 5 : 10;

        return [
            {def:oreDef,amount:oreAmount},
            {def:blueprintDef,amount:blueprintAmount}
        ];
    }

    /*
       從背包實際開啟1個材料寶箱：先確認庫存夠、扣掉1個寶箱，
       再骰內容、加進背包。回傳結果字串陣列給呼叫端顯示，
       扣寶箱失敗（沒庫存）回傳null。
    */
    function openSingleMaterialChestFromInventory(){
        const rewards=rollMaterialChestRewards();
        const opened=runInventoryTransaction(()=>{
            if(!consumeStackItem("materialChest",1)){ return false; }
            return rewards.every(r=>addItemToInventory(r.def,r.amount));
        });
        rebuildInventorySlots();
        if(!opened){
            alert("背包空間不足，材料寶箱未消耗。請先整理背包。");
            return null;
        }
        saveGame();
        return rewards.map(r=>r.def.name+"×"+r.amount);
    }
    window.v132OpenMaterialChest=openSingleMaterialChestFromInventory;

    function showMaterialDungeonRewardModal(chestCount){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>材料副本挑戰成功！</h3>'+
            '<p>獲得材料寶箱 ×'+chestCount+'</p>'+
            '<div class="v132-reward-actions">'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',false)">直接領取</button>'+
            '<button type="button" onclick="v132ClaimMaterialDungeonReward('+chestCount+',true)">看廣告雙倍領取</button>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132ClaimMaterialDungeonReward=function(chestCount,doubled){
        function grant(){
            const finalCount=doubled ? chestCount*2 : chestCount;
            const added=addItemToInventory(materialChestDefinition,finalCount);
            rebuildInventorySlots();
            if(!added){
                alert("背包空間不足，材料寶箱尚未領取；請先整理背包後再試。");
                return;
            }
            markDungeonUsed("material");
            saveGame();
            v132CloseRewardModal();
            alert("獲得材料寶箱×"+finalCount+"，請到背包自行開啟。");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            showRewardedAd(grant,function(){
                alert("廣告未完成，未獲得雙倍獎勵。");
            });
        }else{
            grant();
        }
    };


    /* =====================================================
       18. 裝備副本：雙角色20級開放，1BOSS+4精英，高極裝備寶箱
    ===================================================== */

    function getEquipmentDungeonComposition(){
        const playerCount=Math.max(1,getExistingPartyIndexes().length);
        const bossCount=Math.min(5,playerCount);
        return {
            playerCount:playerCount,
            bossCount:bossCount,
            eliteCount:Math.max(0,5-bossCount),
            total:5
        };
    }
    window.v138GetEquipmentDungeonComposition=getEquipmentDungeonComposition;

    function beginEquipmentDungeon(){
        if(!isDungeonAvailable("equipment")){
            alert("裝備副本今天已經挑戰過了。");
            return;
        }
        if(!hasTwoCharactersAtLevel20()){
            alert("裝備副本需要至少兩名角色都達到20級才能開啟。");
            return;
        }
        if(!ticketDefinitions.some(definition=>canAddItemToInventory(definition,1))){
            alert("請先預留至少1張裝備抽獎券的背包空間，再挑戰裝備副本。");
            return;
        }

        const composition=getEquipmentDungeonComposition();
        if(!confirmDungeonEntry(
            "裝備副本",
            "偵測到"+composition.playerCount+"名玩家：本場將出現"+
            composition.bossCount+"隻BOSS與"+composition.eliteCount+"隻精英怪。"
        )){
            return;
        }

        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<composition.bossCount;i++){
            const boss=buildDungeonMonster(
                "裝備殿守護者",
                Math.round(level*1.15),
                randomElement(),
                "boss"
            );
            setMonsterMaxTierSkills(boss,0.7);
            roster.push(boss);
        }
        for(let i=0;i<composition.eliteCount;i++){
            const monster=buildDungeonMonster("殿前護衛精英",level,randomElement(),"elite");
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            showEquipmentDungeonRewardModal();
        });
    }
    window.v132BeginEquipmentDungeon=beginEquipmentDungeon;

    function showEquipmentDungeonRewardModal(){
        const html=
            '<div class="v132-reward-modal-inner">'+
            '<h3>裝備副本挑戰成功！</h3>'+
            '<p>獲得高極裝備寶箱 ×1，請選擇1張抽獎券：</p>'+
            '<div class="v132-ticket-choices">'+
            ticketDefinitions.map(def=>
                '<button type="button" class="v132-ticket-choice" onclick="v132ClaimEquipmentDungeonReward(\''+def.id+'\',false)">'+
                '<span class="v132-ticket-icon">'+def.icon+'</span>'+
                '<span>'+def.name+'</span>'+
                '</button>'
            ).join("")+
            '</div>'+
            '<div class="v132-reward-actions">'+
            '<span style="font-size:12px;color:#b3a58c;">選好之後可再選擇是否看廣告雙倍領取（雙倍＝同款抽獎券×2）</span>'+
            '</div></div>';
        v132ShowRewardModal(html);
    }

    window.v132ClaimEquipmentDungeonReward=function(ticketId,doubled){
        function grant(amount){
            const definition=getTicketDefinition(ticketId);
            if(!definition){ return; }
            if(!addItemToInventory(definition,amount)){
                rebuildInventorySlots();
                alert("背包空間不足，抽獎券尚未領取；請先整理背包後再試。");
                return;
            }
            rebuildInventorySlots();
            markDungeonUsed("equipment");
            saveGame();
            v132CloseRewardModal();
            alert("獲得"+definition.name+"×"+amount+"！");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(doubled){
            grant(2);
            return;
        }

        if(!doubled){
            const askDouble=window.confirm("要看廣告雙倍領取這張抽獎券嗎？");
            if(askDouble){
                showRewardedAd(function(){ grant(2); },function(){
                    alert("廣告未完成，改為直接領取。");
                    grant(1);
                });
                return;
            }
        }
        grant(1);
    };


    /* =====================================================
       19. 通用獎勵彈窗（簡單覆蓋層，跟遊戲既有深色系一致）
    ===================================================== */

    function ensureRewardModalElement(){
        let modal=document.getElementById("v132RewardModal");
        if(modal){ return modal; }
        modal=document.createElement("div");
        modal.id="v132RewardModal";
        modal.className="v132-reward-modal";
        document.body.appendChild(modal);
        return modal;
    }

    window.v132ShowRewardModal=function(innerHtml){
        const modal=ensureRewardModalElement();
        modal.innerHTML=innerHtml;
        modal.classList.add("show");
    };

    window.v132CloseRewardModal=function(){
        const modal=document.getElementById("v132RewardModal");
        if(modal){ modal.classList.remove("show"); }
    };


    /* =====================================================
       20. 日常副本頁面內容（接進既有renderDungeonTabContent
           的「日常副本尚未設計完成」空殼）
    ===================================================== */

    function dungeonEntryCard(type,title,requirement,rewardPreview,onClick){
        /* ★ 改用isDungeonUsedToday()，這樣每日次數旗標關閉時，
           畫面也一定跟著顯示「可挑戰」，不會出現「按鈕是灰的、
           但其實邏輯允許挑戰」這種自相矛盾的狀態。 */
        const used=isDungeonUsedToday(type);
        return (
            '<div class="v132-dungeon-card">'+
            '<div class="v132-dungeon-card-title">'+title+
            (used ? '<span class="v132-dungeon-done">今日已完成</span>' : '')+
            '</div>'+
            '<div class="v132-dungeon-card-req">開放條件：'+requirement+'</div>'+
            '<div class="v132-dungeon-card-reward">獎勵：'+rewardPreview+'</div>'+
            '<button type="button" class="v132-dungeon-enter-btn" '+
            (used ? "disabled" : 'onclick="'+onClick+'()"')+
            '>'+(used ? "今日已挑戰" : "挑戰")+'</button>'+
            '</div>'
        );
    }

    function renderDailyDungeonList(){
        return (
            '<div class="v132-dungeon-list">'+
            dungeonEntryCard(
                "exp","經驗副本","單一角色達到10級",
                "全隊升下一級所需總經驗平均值的11%（廣告可雙倍）","v132BeginExpDungeon"
            )+
            dungeonEntryCard(
                "material","材料副本","至少兩名角色達到20級",
                "材料寶箱×1～3（依通關回合數）","v132BeginMaterialDungeon"
            )+
            dungeonEntryCard(
                "equipment","裝備副本","至少兩名角色達到20級",
                "高極裝備寶箱×1（自選抽獎券）","v132BeginEquipmentDungeon"
            )+
            '<div style="font-size:11px;color:#7a6f5c;margin-top:6px;">'+
            (DUNGEON_DAILY_LIMIT_ENABLED
                ? '每個副本每日只能挑戰1次，挑戰失敗不會扣除次數，'+
                  '領取獎勵之後才會計入今日已完成。'
                : '⚙️ 測試模式：每日挑戰次數限制目前為關閉狀態，'+
                  '所有副本都可以無限次重複挑戰。')+
            '</div>'+
            '</div>'
        );
    }

    if(typeof renderDungeonTabContent==="function"){
        const originalRenderDungeonTabContent=renderDungeonTabContent;
        renderDungeonTabContent=function(tabName){
            if(tabName==="daily"){
                return renderDailyDungeonList();
            }
            return originalRenderDungeonTabContent.apply(this,arguments);
        };
    }

})();
