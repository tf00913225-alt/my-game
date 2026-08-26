/*
   V133 — 經濟／養成重新設計：
   1. Lv.1~100升級曲線重做（長期單機養成節奏，不是快速衝滿等）
   2. 怪物金幣掉落rank倍率調整（精英×2、BOSS×5，取代原本的×3/×8）
   3. 商店價格改成看「帳號內已建立角色的最高等級」決定階級倍率
   4. 藥水補品重新整理（新增30%階、商店下架100%階但保留道具資料）
   5. 預留未來金幣消耗系統的共用工具函式

   ★ 整體原則：只處理EXP成長／掛機EXP效率／經驗副本EXP／怪物EXP・
   金幣rank倍率／商店價格／補品配置這幾塊，完全不動玩家戰鬥能力
   公式、技能傷害、野怪強度公式、副本怪物強度、裝備屬性、材料/裝備
   掉率、戰鬥回合邏輯——這些全部沿用既有邏輯，這個檔案完全不去
   override這些函式。
*/
(function installV133EconomyRebalance(){
    "use strict";

    /* =====================================================
       1. Lv.1~100 升級曲線重做
       ===================================================== */

    /*
       ★ 新增（依照使用者要求，重新設計升級曲線）：
       原本checkLevelUp()裡expNext是「每次升級後，用舊的expNext
       乘1.2（或至少+1）」這種複利型公式，早期還好，等級一高
       會爆炸性成長、而且成長節奏完全不受控制（無法個別調整
       某個等級區間要多快/多慢）。

       改成直接用「目標等級」算出一個平滑的公式：
         expNext(Lv) = round(400 × Lv^2.5)
       這是純粹的次方成長（不是逐級複利），本身就是平滑曲線，
       而且指數2.5能自然做出「前期快、後期非常慢」的節奏，不用
       為每個等級區間各自寫死一段。

       ★ 校準依據（詳細算式見這次交接文件/PR說明，這裡摘要）：
       - 假設「正常練功一場戰鬥」的平均EXP≈105×怪物等級
         （對應現有機制：一般練功區平均3隻怪、每隻等級≈玩家
         等級、每隻基礎EXP=等級×10、再套既有×3.5倍加成，
         3×10×3.5=105，跟怪物等級同乘）。
       - 用這個換算出Lv.1→100全程總戰鬥場數≈150,481場，
         跟使用者要求的「總量約等同150,000場正常100%效率戰鬥」
         幾乎完全吻合。
       - 各區間換算出的場數分布（1~20約2,898場、21~40約13,006場、
         41~60約27,476場、61~80約45,214場、81~100約61,886場）
         本身就自然呈現「前期快、後期非常慢」，不需要另外分段
         微調，81~100這個區間單獨就佔了全程超過4成的場數，
         符合「Lv.90~100每級需要大量戰鬥」的要求。
       - 用「1分鐘5場＋元素匣掛機只拿70%EXP＋每天掛8小時」反推
         Lv.1→100所需天數≈89.6天，跟使用者要求的「約90天左右」
         幾乎精確吻合；24小時掛機則約30天，超過「一兩週」的下限，
         符合「24小時極端掛機也不應該一兩週滿等」的要求。

       實際驗證數字（真的用Playwright測過，不是純理論）：
       見這次PR說明／HANDOFF.md，這裡不重複貼一次。
    */
    const EXP_CURVE_BASE=400;
    const EXP_CURVE_EXPONENT=2.5;

    function getExpNextForLevel(level){
        const safeLevel=Math.max(1,Math.floor(Number(level)||1));
        return Math.max(1,Math.round(EXP_CURVE_BASE*Math.pow(safeLevel,EXP_CURVE_EXPONENT)));
    }
    window.v133GetExpNextForLevel=getExpNextForLevel;

    function recalibrateCharacterExpNext(character){
        if(!character){ return; }
        character.expNext=getExpNextForLevel(character.level);
    }

    /*
       腳本載入的當下，立刻依照「現在的等級」重算一次expNext——
       不管是舊存檔停在某個等級（原本的複利公式留下的舊數字），
       還是剛創好的Lv.1新角色（物件字面量預設的100），這裡都會
       校正成新曲線該有的正確值，不用等到下一次升級才生效。
       這個動作只讀character.level（現有進度），完全不動exp／
       金幣／道具／裝備等其他任何欄位，不會弄丟玩家原本的進度。
    */
    recalibrateCharacterExpNext(player);
    if(typeof player2!=="undefined" && player2){ recalibrateCharacterExpNext(player2); }
    if(typeof player3!=="undefined" && player3){ recalibrateCharacterExpNext(player3); }

    /*
       之後每次升級，checkLevelUp()本體自己的while迴圈還是照舊
       跑（attributePoints/skillPoints/bonusHP/bonusSP、升級提示
       這些全部原封不動，這裡完全不重寫），只在它跑完、真的有
       升級發生時，把expNext覆蓋成用新公式重算的正確值——原本
       每次迭代自己用複利公式疊代出來的expNext會被這裡蓋掉，
       不會影響其他任何欄位。
    */
    if(typeof checkLevelUp==="function"){
        const originalCheckLevelUp=checkLevelUp;
        checkLevelUp=function(targetCharacter){
            const character=targetCharacter||player;
            const levelBefore=character.level;
            const result=originalCheckLevelUp.apply(this,arguments);
            if(character.level!==levelBefore){
                recalibrateCharacterExpNext(character);
            }
            return result;
        };
    }

    if(typeof createCharacter==="function"){
        const originalCreateCharacter=createCharacter;
        createCharacter=function(){
            const result=originalCreateCharacter.apply(this,arguments);
            recalibrateCharacterExpNext(player);
            return result;
        };
    }

    if(typeof createAdditionalCharacter==="function"){
        const originalCreateAdditionalCharacter=createAdditionalCharacter;
        createAdditionalCharacter=function(slotNumber){
            const result=originalCreateAdditionalCharacter.apply(this,arguments);
            recalibrateCharacterExpNext(slotNumber===3 ? player3 : player2);
            return result;
        };
    }


    /* =====================================================
       2. 怪物金幣掉落rank倍率調整（精英×2、BOSS×5）
       ===================================================== */

    /*
       ★ 修正（依照使用者要求）：原本精英×3、BOSS×8，使用者
       指出後期會通膨太快，改成精英×2、BOSS×5。基礎公式
       （等級×2+3，±15%隨機浮動）完全不動，使用者明確要求保留。
    */
    if(typeof getMonsterGoldDrop==="function"){
        getMonsterGoldDrop=function(monster){
            if(!monster){ return 0; }
            const level=Math.max(1,Math.floor(Number(monster.level)||1));
            const rank=getMonsterRank(monster);
            const rankMultiplier=
                rank==="boss" ? 5 :
                rank==="elite" ? 2 :
                1;
            const base=level*2+3;
            const variance=0.85+Math.random()*0.30;
            return Math.max(1,Math.floor(base*rankMultiplier*variance));
        };
    }


    /* =====================================================
       3. 商店價格：改成看帳號內已建立角色的最高等級
       ===================================================== */

    /*
       ★ 修正（依照使用者要求，「不能依目前選中的角色，也不能用
       三角色平均等級，必須用帳號內已建立角色的最高等級」）：
       避免玩家用高等角色打寶賺錢、切到低等角色用低價格買補品
       的套利漏洞。
    */
    const SHOP_PRICE_TIERS=[
        {maxLevel:30,multiplier:1,label:"Lv.1～30"},
        {maxLevel:40,multiplier:1.5,label:"Lv.31～40"},
        {maxLevel:50,multiplier:2,label:"Lv.41～50"},
        {maxLevel:60,multiplier:2.5,label:"Lv.51～60"},
        {maxLevel:70,multiplier:3,label:"Lv.61～70"},
        {maxLevel:80,multiplier:3.5,label:"Lv.71～80"},
        {maxLevel:90,multiplier:4,label:"Lv.81～90"},
        {maxLevel:100,multiplier:4.5,label:"Lv.91～100"}
    ];

    function getHighestCreatedCharacterLevel(){
        return getExistingPartyIndexes().reduce((max,index)=>{
            const character=getPartyCharacterByIndex(index);
            return character ? Math.max(max,character.level||1) : max;
        },1);
    }
    window.v133GetHighestCreatedCharacterLevel=getHighestCreatedCharacterLevel;

    function getShopPriceTier(){
        const highestLevel=getHighestCreatedCharacterLevel();
        for(const tier of SHOP_PRICE_TIERS){
            if(highestLevel<=tier.maxLevel){ return tier; }
        }
        return SHOP_PRICE_TIERS[SHOP_PRICE_TIERS.length-1];
    }

    function getShopItemPrice(shopItem){
        if(!shopItem || !Number.isFinite(shopItem.price)){ return shopItem ? shopItem.price : null; }
        return Math.round(shopItem.price*getShopPriceTier().multiplier);
    }
    window.v133GetShopItemPrice=getShopItemPrice;


    /* =====================================================
       4. 藥水補品重新整理：新增30%階、商店下架100%階
       ===================================================== */

    /*
       ★ 新增（依照使用者要求，「請根據目前10%與50%的基礎價格
       補出合理中間價格...讓大容量藥水有一點單位價格優惠」）：
       10%單位價最貴（方便）、50%單位價最划算（但單瓶最貴）、
       30%取中間——用10%跟50%兩點的「每%單價」線性內插算出
       30%那一點的每%單價，再乘30算出價格，最後湊整到5的倍數。
       HP：10%單價20/10=2.0、50%單價80/50=1.6，內插30%≈1.8→54
       湊整成55；SP：10%單價25/10=2.5、50%單價100/50=2.0，
       內插30%≈2.25→68湊整成70。這裡直接把新定義push進既有的
       potionDefinitions陣列（同一個陣列參照，背包/戰鬥道具欄/
       商店本來就都是讀這個陣列，不用另外改讀取端）。
    */
    if(typeof potionDefinitions!=="undefined" && Array.isArray(potionDefinitions)){
        if(!potionDefinitions.some(p=>p && p.id==="hpPotion30")){
            potionDefinitions.push({
                id:"hpPotion30",
                name:"回復30%HP藥水",
                shortName:"HP 30%",
                icon:"",
                type:"potion",
                resource:"hp",
                recoveryPercent:30,
                price:55,
                stats:{}
            });
        }
        if(!potionDefinitions.some(p=>p && p.id==="spPotion30")){
            potionDefinitions.push({
                id:"spPotion30",
                name:"回復30%SP藥水",
                shortName:"SP 30%",
                icon:"",
                type:"potion",
                resource:"sp",
                recoveryPercent:30,
                price:70,
                stats:{}
            });
        }
    }

    /*
       ★ 修正（依照使用者要求，「一般商店取消販售100%恢復藥，
       原本100%HP／SP藥水不要刪除道具資料，改成較稀有來源」）：
       shopItems是既有程式碼裡`const shopItems=potionDefinitions;`
       這種「同一個陣列參照」的寫法，const沒辦法從外面重新賦值成
       過濾後的新陣列，所以這裡改成整個覆寫renderShopContent()／
       buyShopItem()——渲染/購買時都改成從potionDefinitions動態
       篩選掉recoveryPercent>=100的項目，potionDefinitions陣列
       本身完全沒有被刪減，100%藥水的道具定義還在，之後其他系統
       （BOSS掉落／副本獎勵／任務獎勵／成就獎勵）要發放這兩個
       id（hpPotion100／spPotion100）一樣可以正常運作，只是玩家
       没辦法在商店直接花錢買到。城鎮／休息功能本來就是另一套
       獨立邏輯（直接把HP/SP灌滿，不經過potionDefinitions），
       這裡完全沒有動到，仍然可以直接回滿100%。
    */
    function getShoppablePotions(){
        if(typeof potionDefinitions==="undefined" || !Array.isArray(potionDefinitions)){ return []; }
        return potionDefinitions.filter(item=>item && item.recoveryPercent<100);
    }

    if(typeof renderShopContent==="function"){
        renderShopContent=function(){
            const tier=getShopPriceTier();
            const cards=getShoppablePotions().map(shopItem=>{
                const count=typeof getPotionCount==="function" ? getPotionCount(shopItem.id) : 0;
                const resourceLabel=shopItem.resource==="hp" ? "HP" : "SP";
                const effectText=`回復最大${resourceLabel}的 ${shopItem.recoveryPercent}%`;
                const displayPrice=getShopItemPrice(shopItem);
                const hasPrice=Number.isFinite(displayPrice);
                const disabled=!hasPrice || gold<displayPrice;
                const buttonText=!hasPrice ? "價格待定" : `${displayPrice} 金幣`;

                return `
                    <div class="shop-potion-card ${shopItem.resource}">
                        <div class="shop-potion-card-head">
                            <span class="shop-potion-type">${resourceLabel}</span>
                            <span class="shop-potion-stock">持有 ${count}</span>
                        </div>
                        <div class="shop-potion-name">${shopItem.name}</div>
                        <div class="shop-potion-effect">${effectText}</div>
                        <div class="shop-potion-purchase-row">
                            <label for="shopQuantity-${shopItem.id}">數量</label>
                            <input
                                id="shopQuantity-${shopItem.id}"
                                class="shop-potion-quantity"
                                type="number"
                                inputmode="numeric"
                                min="1"
                                max="9999"
                                step="1"
                                value="1"
                            >
                            <button
                                class="home-feature-buy-btn shop-potion-buy"
                                ${disabled ? "disabled" : ""}
                                onclick="buyShopItem('${shopItem.id}',document.getElementById('shopQuantity-${shopItem.id}').value)"
                            >${buttonText}</button>
                        </div>
                    </div>
                `;
            }).join("");

            return `
                <div class="shop-potion-interface">
                    <div class="shop-potion-note">只販售 HP／SP 回復藥水</div>
                    <div class="v133-shop-tier-note">目前商店階級：${tier.label}（價格×${tier.multiplier}）</div>
                    <div class="shop-potion-list">${cards}</div>
                </div>
            `;
        };
    }

    if(typeof buyShopItem==="function"){
        buyShopItem=function(itemId,requestedQuantity){
            const shopItem=typeof getPotionDefinition==="function" ? getPotionDefinition(itemId) : null;
            if(!shopItem || shopItem.recoveryPercent>=100){ return; }

            const unitPrice=getShopItemPrice(shopItem);
            if(!Number.isFinite(unitPrice)){
                alert("這個藥水的價格尚未設定。");
                return;
            }

            const quantity=Math.max(1,Math.min(9999,Math.floor(Number(requestedQuantity)||1)));
            const totalPrice=unitPrice*quantity;

            if(gold<totalPrice){
                alert("金幣不夠，本次需要 "+totalPrice.toLocaleString("zh-TW")+" 金幣。");
                return;
            }

            if(!addPotionToInventory(itemId,quantity)){
                alert("背包已滿，或該藥水已沒有可用的堆疊空間。");
                return;
            }

            gold=gold-totalPrice;

            rebuildInventorySlots();
            updateGoldDisplay();
            saveGame();

            const bodyEl=$("homeFeatureModalBody");
            if(bodyEl){
                bodyEl.innerHTML=renderShopContent();
            }
        };
    }


    /* =====================================================
       5. 預留未來金幣消耗系統（裝備強化／製作／洗鍊／合成／
          材料升階）的共用工具——這次不實作實際玩法，只留一個
          共用的「花費金幣」函式，之後要加新玩法直接呼叫這個，
          不用重新設計一次「扣錢＋防呆＋存檔」。
       ===================================================== */

    function spendGoldForFutureSystem(amount){
        const cost=Math.max(0,Math.floor(Number(amount)||0));
        if(cost<=0){ return true; }
        if(gold<cost){ return false; }
        gold-=cost;
        if(typeof updateGoldDisplay==="function"){ updateGoldDisplay(); }
        saveGame();
        return true;
    }
    window.v133SpendGoldForFutureSystem=spendGoldForFutureSystem;

})();
