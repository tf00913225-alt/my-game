/*
   V133 — 經濟／養成重新設計：
   1. Lv.1~100升級曲線依各練功區實際平均EXP反推
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
       V139不再用expNext×1.20，也不再用單一Lv^2.5公式猜產出。
       每一級需求改成：

         該級練功區實際平均每場EXP × 該級目標有效戰鬥場數

       「實際平均」直接讀目前zoneConfig的六隻怪物，逐隻套用
       等級×10、普通×1／精英×1.5／BOSS×3、現有EXP×3.5，
       再乘上遭遇系統真正的平均怪物數（前兩區1～3隻平均2隻，
       其餘區3～6隻平均4.5隻）。fallback只在測試或資料尚未
       初始化時使用，數值同樣由目前main的怪物編成算出。

       目標場數用少量錨點線性插值，讓前期快、中期漸慢、後期
       明顯變慢；Lv.1→100合計69,760場，Lv.99→100為4,000場。
    */
    const MAX_CHARACTER_LEVEL=100;
    const TRAINING_EXP_MULTIPLIER=3.5;

    const TRAINING_ZONE_EXP_PROFILES=[
        {minLevel:1,maxLevel:10,key:"forest",averageGroupSize:2,fallbackAverageExp:175},
        {minLevel:11,maxLevel:20,key:"desert",averageGroupSize:2,fallbackAverageExp:1085},
        {minLevel:21,maxLevel:30,key:"ice",averageGroupSize:4.5,fallbackAverageExp:4528},
        {minLevel:31,maxLevel:40,key:"zone4",averageGroupSize:4.5,fallbackAverageExp:6484},
        {minLevel:41,maxLevel:50,key:"zone5",averageGroupSize:4.5,fallbackAverageExp:8321},
        {minLevel:51,maxLevel:60,key:"zone6",averageGroupSize:4.5,fallbackAverageExp:10159},
        {minLevel:61,maxLevel:70,key:"zone7",averageGroupSize:4.5,fallbackAverageExp:11996},
        {minLevel:71,maxLevel:80,key:"zone8",averageGroupSize:4.5,fallbackAverageExp:11760},
        {minLevel:81,maxLevel:90,key:"zone9",averageGroupSize:4.5,fallbackAverageExp:13335},
        {minLevel:91,maxLevel:99,key:"zone10",averageGroupSize:4.5,fallbackAverageExp:14910}
    ];

    const TARGET_BATTLE_ANCHORS=[
        {level:1,battles:3},
        {level:10,battles:15},
        {level:20,battles:45},
        {level:30,battles:100},
        {level:40,battles:250},
        {level:50,battles:400},
        {level:60,battles:650},
        {level:70,battles:900},
        {level:80,battles:1200},
        {level:90,battles:1700},
        {level:95,battles:2600},
        {level:98,battles:3500},
        {level:99,battles:4000}
    ];

    window.v133MaxLevel=MAX_CHARACTER_LEVEL;

    function getCurveMonsterRankMultiplier(monster){
        let rank="regular";
        if(typeof getMonsterRank==="function"){
            rank=getMonsterRank(monster);
        }else if(monster && monster.rank){
            rank=monster.rank;
        }else if(monster && monster.name && monster.name.endsWith("王")){
            rank="elite";
        }
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    function getTrainingExpProfile(level){
        const safeLevel=Math.min(
            MAX_CHARACTER_LEVEL-1,
            Math.max(1,Math.floor(Number(level)||1))
        );
        return TRAINING_ZONE_EXP_PROFILES.find(profile=>
            safeLevel>=profile.minLevel && safeLevel<=profile.maxLevel
        )||TRAINING_ZONE_EXP_PROFILES[TRAINING_ZONE_EXP_PROFILES.length-1];
    }

    function getTrainingZoneRoster(profile){
        try{
            if(typeof zoneConfig==="undefined" || !zoneConfig[profile.key]){
                return null;
            }
            const source=zoneConfig[profile.key].monsters;
            const roster=typeof source==="function" ? source() : source;
            return Array.isArray(roster) && roster.length>0 ? roster : null;
        }catch(_){
            return null;
        }
    }

    function getTrainingZoneAverageExpForLevel(level){
        const profile=getTrainingExpProfile(level);
        const roster=getTrainingZoneRoster(profile);
        if(!roster){ return profile.fallbackAverageExp; }

        const averageWeightedMonsterExp=roster.reduce((sum,monster)=>{
            if(!monster){ return sum; }
            const monsterLevel=Math.max(1,Number(monster.level)||1);
            return sum+monsterLevel*10*getCurveMonsterRankMultiplier(monster);
        },0)/roster.length;

        return Math.max(
            1,
            Math.round(
                averageWeightedMonsterExp*
                profile.averageGroupSize*
                TRAINING_EXP_MULTIPLIER
            )
        );
    }

    function getTargetBattlesForLevel(level){
        const safeLevel=Math.min(
            MAX_CHARACTER_LEVEL-1,
            Math.max(1,Math.floor(Number(level)||1))
        );
        if(safeLevel<=TARGET_BATTLE_ANCHORS[0].level){
            return TARGET_BATTLE_ANCHORS[0].battles;
        }
        for(let index=1;index<TARGET_BATTLE_ANCHORS.length;index++){
            const right=TARGET_BATTLE_ANCHORS[index];
            if(safeLevel>right.level){ continue; }
            const left=TARGET_BATTLE_ANCHORS[index-1];
            const progress=(safeLevel-left.level)/(right.level-left.level);
            return Math.max(
                1,
                Math.round(left.battles+(right.battles-left.battles)*progress)
            );
        }
        return TARGET_BATTLE_ANCHORS[TARGET_BATTLE_ANCHORS.length-1].battles;
    }

    function getExpNextForLevel(level){
        return Math.max(
            1,
            Math.round(
                getTrainingZoneAverageExpForLevel(level)*
                getTargetBattlesForLevel(level)
            )
        );
    }
    window.v133GetExpNextForLevel=getExpNextForLevel;
    window.v139GetTrainingZoneAverageExpForLevel=getTrainingZoneAverageExpForLevel;
    window.v139GetTargetBattlesForLevel=getTargetBattlesForLevel;
    window.v139GetExpCurveAudit=function(){
        const checkpoints=[10,30,50,70,80,90,99].map(level=>({
            level:level,
            averageBattleExp:getTrainingZoneAverageExpForLevel(level),
            targetBattles:getTargetBattlesForLevel(level),
            expNext:getExpNextForLevel(level)
        }));
        let totalEffectiveBattles=0;
        for(let level=1;level<MAX_CHARACTER_LEVEL;level++){
            totalEffectiveBattles+=getTargetBattlesForLevel(level);
        }
        return {totalEffectiveBattles:totalEffectiveBattles,checkpoints:checkpoints};
    };

    function recalibrateCharacterExpNext(character){
        if(!character){ return; }
        character.level=Math.min(
            MAX_CHARACTER_LEVEL,
            Math.max(1,Math.floor(Number(character.level)||1))
        );
        if(character.level>=MAX_CHARACTER_LEVEL){
            character.exp=0;
        }
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

            /* V133規格以Lv.100為滿等；舊版只做了1~100曲線，卻沒有
               真正的上限，Lv.100仍可繼續升到101以上。 */
            if(levelBefore>=MAX_CHARACTER_LEVEL){
                recalibrateCharacterExpNext(character);
                if(typeof refreshCharacterAvatarLevels==="function"){
                    refreshCharacterAvatarLevels();
                }
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                return false;
            }

            const result=originalCheckLevelUp.apply(this,arguments);
            if(character.level>MAX_CHARACTER_LEVEL){
                const excessLevels=character.level-MAX_CHARACTER_LEVEL;
                character.level=MAX_CHARACTER_LEVEL;
                character.attributePoints=Math.max(
                    0,
                    (Number(character.attributePoints)||0)-excessLevels*5
                );
                character.skillPoints=Math.max(
                    0,
                    (Number(character.skillPoints)||0)-excessLevels*2
                );
                character.bonusHP=Math.max(
                    0,
                    (Number(character.bonusHP)||0)-excessLevels*30
                );
                character.bonusSP=Math.max(
                    0,
                    (Number(character.bonusSP)||0)-excessLevels*10
                );
                character.exp=0;
            }
            if(character.level!==levelBefore){
                recalibrateCharacterExpNext(character);
                if(typeof saveGame==="function"){ saveGame(); }
            }
            return result;
        };
    }

    if(typeof distributeExpToCharacter==="function"){
        const originalDistributeExpToCharacterV133=distributeExpToCharacter;
        distributeExpToCharacter=function(character){
            if(character && (Number(character.level)||1)>=MAX_CHARACTER_LEVEL){
                alert((character.id||"角色")+"已達 Lv."+MAX_CHARACTER_LEVEL+" 滿等。");
                return false;
            }
            return originalDistributeExpToCharacterV133.apply(this,arguments);
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

    if(typeof renderExpDistributeList==="function"){
        renderExpDistributeList();
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
       補出指定的30%階」）：HP 30%=50、SP 30%=65。這裡直接把
       新定義push進既有的
       potionDefinitions陣列（同一個陣列參照，背包/戰鬥道具欄/
       商店本來就都是讀這個陣列，不用另外改讀取端）。
    */
    const SHOP_POTION_BASE_PRICES={
        hpPotion10:20,
        hpPotion30:50,
        hpPotion50:80,
        spPotion10:25,
        spPotion30:65,
        spPotion50:100
    };
    const SHOP_POTION_IDS=Object.keys(SHOP_POTION_BASE_PRICES);

    if(typeof potionDefinitions!=="undefined" && Array.isArray(potionDefinitions)){
        let hpPotion30=potionDefinitions.find(p=>p && p.id==="hpPotion30");
        if(!hpPotion30){
            hpPotion30={
                id:"hpPotion30",
                name:"回復30%HP藥水",
                shortName:"HP 30%",
                icon:"",
                type:"potion",
                resource:"hp",
                recoveryPercent:30,
                price:50,
                stats:{}
            };
            potionDefinitions.push(hpPotion30);
        }
        hpPotion30.price=50;

        let spPotion30=potionDefinitions.find(p=>p && p.id==="spPotion30");
        if(!spPotion30){
            spPotion30={
                id:"spPotion30",
                name:"回復30%SP藥水",
                shortName:"SP 30%",
                icon:"",
                type:"potion",
                resource:"sp",
                recoveryPercent:30,
                price:65,
                stats:{}
            };
            potionDefinitions.push(spPotion30);
        }
        spPotion30.price=65;

        /* 六種一般商店藥水的基礎價是正式規格。即使舊資料或其他
           補丁曾改過價錢，載入V139時也會回到這份唯一價格表。 */
        potionDefinitions.forEach(item=>{
            if(item && Object.prototype.hasOwnProperty.call(SHOP_POTION_BASE_PRICES,item.id)){
                item.price=SHOP_POTION_BASE_PRICES[item.id];
            }
        });
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
        return SHOP_POTION_IDS
            .map(itemId=>potionDefinitions.find(item=>item && item.id===itemId))
            .filter(Boolean);
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
            if(!shopItem || !SHOP_POTION_IDS.includes(itemId)){ return; }

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
