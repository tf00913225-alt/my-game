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
        return new Date().toISOString().slice(0,10);
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

    if(typeof openItemModal==="function"){
        const originalOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=originalOpenItemModal.apply(this,arguments);
            fixItemModalIconRendering();
            return result;
        };
    }

    if(typeof openEquippedItem==="function"){
        const originalOpenEquippedItem=openEquippedItem;
        openEquippedItem=function(item,slot){
            const result=originalOpenEquippedItem.apply(this,arguments);
            fixItemModalIconRendering();
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

    function addItemToInventory(definition,amount){
        if(!definition){ return false; }
        const quantity=Math.max(1,Math.floor(Number(amount)||1));
        const maxStack=isEquipmentInventoryType(definition.type)
            ? 1
            : INVENTORY_MAX_STACK_DEFAULT;

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

        const owned=inventoryItems.some(item=>item && item.id===talismanId && Number(item.count)>0);
        if(!owned){
            addBattleLog(definition.name+"目前沒有庫存。");
            renderBattleItemMenu();
            return;
        }

        actionReady=true;
        queuedPlayerActions[activeBattleCharacterIndex]={
            action:"talisman",
            talismanId:talismanId,
            target:null
        };

        closeMenus();
        updateUI();
        finishPlayerAction();
    }
    window.useTalisman=useTalisman;

    function applyTalismanEffect(talismanId,characterIndex){
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

        lungePlayerCard();
        showSkillNameBadge(definition.name,definition.talismanEffect==="freeze" ? "water" : "wind");

        if(!success){
            addBattleLog((character.id||"你")+"使用"+definition.name+"，畫符失敗！");
            showMissEffect(true,characterIndex,"畫符失敗");
            finishPlayerAction();
            return;
        }

        if(definition.talismanEffect==="freeze"){
            const aliveTargets=currentBattleMonsters.filter(i=>monsters[i] && monsters[i].alive);
            if(aliveTargets.length===0){
                addBattleLog(definition.name+"沒有可以生效的目標。");
                finishPlayerAction();
                return;
            }
            const targetIndex=aliveTargets[Math.floor(Math.random()*aliveTargets.length)];
            applyFreezeEffect(monsters[targetIndex],definition.talismanDuration);
            addBattleLog(
                (character.id||"你")+"使用"+definition.name+"，"+
                monsters[targetIndex].name+"被冰封了！"
            );
        }
        else if(definition.talismanEffect==="stealth"){
            character.activeBuffs=(character.activeBuffs||[]).filter(b=>b.type!=="stealthSkill");
            character.activeBuffs.push({type:"stealthSkill",turnsLeft:definition.talismanDuration});
            addBattleLog(
                (character.id||"你")+"使用"+definition.name+"，進入隱身，"+
                "無法被單體攻擊選中，持續"+definition.talismanDuration+"回合。"
            );
        }
        else if(definition.talismanEffect==="barrier"){
            character.activeBuffs=(character.activeBuffs||[]).filter(b=>b.type!=="barrier");
            character.activeBuffs.push({type:"barrier",turnsLeft:definition.talismanDuration});
            addBattleLog(
                (character.id||"你")+"使用"+definition.name+"，獲得結界，"+
                "可抵擋所有傷害，持續"+definition.talismanDuration+"回合。"
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
            if(queued && queued.action==="talisman"){
                activeBattleCharacterIndex=characterIndex;
                applyTalismanEffect(queued.talismanId,characterIndex);
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

        for(let index=inventoryItems.length-1;index>=0;index--){
            const item=inventoryItems[index];
            if(!item || item.id!==ticketId){ continue; }
            const current=Math.max(0,Math.floor(Number(item.count)||0));
            if(current<=1){ inventoryItems.splice(index,1); }
            else{ item.count=current-1; }
            break;
        }

        const added=addItemToInventory(won,1);
        rebuildInventorySlots();
        renderInventoryItems();
        saveGame();

        if(!added){
            alert("背包空間不足，"+won.name+"無法放入背包，抽獎券已消耗。");
            return;
        }

        alert("使用"+definition.name+"，獲得【"+won.name+"】！");
    }
    window.useEquipmentTicket=useEquipmentTicket;

    /*
       ★ 物品詳細彈窗補上符咒/抽獎券的「使用」按鈕——
       這兩種東西不是藥水（不走usePotion()那條路）、
       也不是裝備（不能穿戴），原本的itemEquipButton
       在這兩種類型上會被判成「不可裝備」整個鎖死，
       這裡另外接一顆「使用」按鈕上去。
    */
    if(typeof openItemModal==="function"){
        const afterOpenItemModal=openItemModal;
        openItemModal=function(slotIndex){
            const result=afterOpenItemModal.apply(this,arguments);

            const item=inventorySlots[slotIndex];
            const equipButton=document.getElementById("itemEquipButton");
            let useButton=document.getElementById("v132ItemUseButton");

            if(!useButton && equipButton && equipButton.parentElement){
                useButton=document.createElement("button");
                useButton.id="v132ItemUseButton";
                useButton.type="button";
                useButton.className=equipButton.className;
                equipButton.parentElement.insertBefore(useButton,equipButton.nextSibling);
            }

            if(!useButton){ return result; }

            if(item && item.type==="ticket"){
                useButton.style.display="";
                useButton.textContent="開啟";
                useButton.onclick=function(){
                    useEquipmentTicket(item.id);
                    closeItemModal();
                };
            }
            else{
                useButton.style.display="none";
                useButton.onclick=null;
            }

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

    function markDungeonUsed(type){
        ensureDungeonStateCurrent();
        dungeonState.used[type]=true;
        persistDungeonState();
    }

    function isDungeonAvailable(type){
        ensureDungeonStateCurrent();
        return !dungeonState.used[type];
    }


    /* =====================================================
       14. 副本怪物等級公式：玩家總角色等級加總 ÷ 角色數量
    ===================================================== */

    function getDungeonMonsterLevel(){
        const indexes=getExistingPartyIndexes();
        if(indexes.length===0){ return 1; }
        const totalLevel=indexes.reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            return sum+((character && character.level)||1);
        },0);
        return Math.max(1,Math.round(totalLevel/indexes.length));
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

        player.activeBuffs=[];
        player.statusEffects=[];
        player.isDefending=false;

        if(player2){
            const stats2=getPlayer2BattleStats();
            player2.hp=stats2.maxHP;
            player2.sp=stats2.maxSP;
            player2.activeBuffs=[];
            player2.statusEffects=[];
            player2.isDefending=false;
        }
        if(player3){
            const stats3=getPartyBattleStats(2);
            player3.hp=stats3.maxHP;
            player3.sp=stats3.maxSP;
            player3.activeBuffs=[];
            player3.statusEffects=[];
            player3.isDefending=false;
        }

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

            const result=originalLoseBattle.apply(this,arguments);

            restoreDungeonMonsters();
            window.v132ActiveDungeonRun=null;

            if(run.onComplete){
                run.onComplete({result:"lose"});
            }

            return result;
        };
    }


    /* =====================================================
       16. 經驗副本：單一角色10級開放，連續3場車輪戰
    ===================================================== */

    function startExpDungeonBattle(stage,rewardExp){
        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<10;i++){
            const monster=applyDungeonMonsterStrength(makeZoneMonster("經驗軍團兵",level,randomElement()));
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

            markDungeonUsed("exp");
            showExpDungeonRewardModal(rewardExp);
        });
    }

    function getNextLevelExpTotal(){
        return getExistingPartyIndexes().reduce((sum,index)=>{
            const character=getPartyCharacterByIndex(index);
            if(!character){ return sum; }
            const needed=typeof getExpToNextLevel==="function"
                ? getExpToNextLevel(character)
                : Math.max(0,(character.level||1)*100);
            return sum+Math.max(0,needed);
        },0);
    }

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

    window.v132ClaimExpDungeonReward=function(doubled){
        function grant(){
            const rewardMultiplier=doubled ? 2 : 1;
            const rewardExp=Math.floor(getNextLevelExpTotal()*0.5*rewardMultiplier);
            sharedExp+=rewardExp;
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
        const rewardExp=getNextLevelExpTotal()*0.5;
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
        if(getExistingPartyIndexes().length<2){
            alert("材料副本需要雙角色（至少建立第二角色）才能開啟。");
            return;
        }
        const mainCharacter=getPartyCharacterByIndex(0);
        if(!mainCharacter || (mainCharacter.level||1)<20){
            alert("材料副本需要角色等級達到20級才能開啟。");
            return;
        }

        const level=getDungeonMonsterLevel();
        const roster=[];
        for(let i=0;i<5;i++){
            const monster=applyDungeonMonsterStrength(makeZoneMonster("礦脈守衛精英",level,randomElement(),"elite"));
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }
        for(let i=0;i<5;i++){
            const monster=applyDungeonMonsterStrength(makeZoneMonster("礦脈守衛",level,randomElement()));
            setMonsterSkillTier(monster,2,0.7);
            roster.push(monster);
        }

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            markDungeonUsed("material");
            const chestCount=outcome.turnsUsed<5 ? 3 : (outcome.turnsUsed<10 ? 2 : 1);
            showMaterialDungeonRewardModal(chestCount);
        });
    }
    window.v132BeginMaterialDungeon=beginMaterialDungeon;

    function pickWeightedTier(){
        const roll=Math.random()*100;
        if(roll<40){ return "low"; }
        if(roll<70){ return "mid"; }
        if(roll<90){ return "high"; }
        return "perfect";
    }

    function openMaterialChests(chestCount){
        const rewards=[];
        for(let i=0;i<chestCount;i++){
            const oreTier=pickWeightedTier();
            const oreDef=getOreDefinition("ore"+oreTier.charAt(0).toUpperCase()+oreTier.slice(1));
            const oreAmount=oreTier==="perfect" ? 5 : 10;
            addItemToInventory(oreDef,oreAmount);
            rewards.push(oreDef.name+"×"+oreAmount);

            const blueprintTier=pickWeightedTier();
            const blueprintPool=getBlueprintDefinitionsByTier(blueprintTier);
            const blueprintDef=blueprintPool[Math.floor(Math.random()*blueprintPool.length)];
            const blueprintAmount=blueprintTier==="perfect" ? 5 : 10;
            addItemToInventory(blueprintDef,blueprintAmount);
            rewards.push(blueprintDef.name+"×"+blueprintAmount);
        }
        rebuildInventorySlots();
        saveGame();
        return rewards;
    }

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
            const rewards=openMaterialChests(finalCount);
            v132CloseRewardModal();
            alert("開啟"+finalCount+"個寶箱，獲得：\n"+rewards.join("\n"));
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

    function beginEquipmentDungeon(){
        if(!isDungeonAvailable("equipment")){
            alert("裝備副本今天已經挑戰過了。");
            return;
        }
        if(getExistingPartyIndexes().length<2){
            alert("裝備副本需要雙角色（至少建立第二角色）才能開啟。");
            return;
        }
        const mainCharacter=getPartyCharacterByIndex(0);
        if(!mainCharacter || (mainCharacter.level||1)<20){
            alert("裝備副本需要角色等級達到20級才能開啟。");
            return;
        }

        const level=getDungeonMonsterLevel();
        const bossElement=randomElement();
        const roster=[];
        const boss=applyDungeonMonsterStrength(makeZoneMonster("裝備殿守護者",Math.round(level*1.15),bossElement,"boss"));
        setMonsterMaxTierSkills(boss,0.7);
        roster.push(boss);
        for(let i=0;i<4;i++){
            const monster=applyDungeonMonsterStrength(makeZoneMonster("殿前護衛精英",level,randomElement(),"elite"));
            setMonsterSkillTier(monster,3,0.7);
            roster.push(monster);
        }

        launchDungeonBattle(roster,function(outcome){
            if(outcome.result!=="win"){
                showPage("dungeon");
                switchDungeonTab("daily");
                return;
            }
            markDungeonUsed("equipment");
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
        function grant(){
            const definition=getTicketDefinition(ticketId);
            if(!definition){ return; }
            const amount=doubled ? 2 : 1;
            addItemToInventory(definition,amount);
            rebuildInventorySlots();
            saveGame();
            v132CloseRewardModal();
            alert("獲得"+definition.name+"×"+amount+"！");
            showPage("dungeon");
            switchDungeonTab("daily");
        }

        if(!doubled){
            const askDouble=window.confirm("要看廣告雙倍領取這張抽獎券嗎？");
            if(askDouble){
                showRewardedAd(function(){ grant2(ticketId); },function(){
                    alert("廣告未完成，改為直接領取。");
                    grant();
                });
                return;
            }
        }
        grant();

        function grant2(id){
            const definition=getTicketDefinition(id);
            if(!definition){ return; }
            addItemToInventory(definition,2);
            rebuildInventorySlots();
            saveGame();
            v132CloseRewardModal();
            alert("獲得"+definition.name+"×2！");
            showPage("dungeon");
            switchDungeonTab("daily");
        }
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
        ensureDungeonStateCurrent();
        const used=dungeonState.used[type];
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
                "當前所有角色升下一級所需經驗總和的50%","v132BeginExpDungeon"
            )+
            dungeonEntryCard(
                "material","材料副本","雙角色達到20級",
                "材料寶箱×1～3（依通關回合數）","v132BeginMaterialDungeon"
            )+
            dungeonEntryCard(
                "equipment","裝備副本","雙角色達到20級",
                "高極裝備寶箱×1（自選抽獎券）","v132BeginEquipmentDungeon"
            )+
            '<div style="font-size:11px;color:#7a6f5c;margin-top:6px;">'+
            '每個副本每日只能挑戰1次，挑戰失敗不會扣除次數，'+
            '領取獎勵之後才會計入今日已完成。'+
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
