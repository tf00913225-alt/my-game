/*
   V133 — 經濟／養成重新設計：
   1. Lv.1~100升級曲線與經驗池基礎成長
   2. 怪物金幣掉落rank倍率調整（精英×2、BOSS×5，取代原本的×3/×8）
   3. 商店價格改成看「帳號內已建立角色的最高等級」決定階級倍率
   4. 藥水補品重新整理（新增30%階、商店下架100%階但保留道具資料）
   5. 預留未來金幣消耗系統的共用工具函式

   ★ 整體原則：EXP仍只進既有sharedExp／角色exp資料流；持續充能只保存
   時間戳與解鎖狀態，不建立第二個經驗池。戰鬥能力、掉落與副本強度不動。
*/
(function installV133EconomyRebalance(){
    "use strict";

    /* =====================================================
       1. Lv.1~100 升級曲線 + Lv20後經驗池持續充能
       ===================================================== */
    const MAX_CHARACTER_LEVEL=100;
    const TRAINING_EXP_MULTIPLIER=3.5;
    const DAY_MS=24*60*60*1000;
    const CHARGE_MAX_MS=72*60*60*1000;
    const GROWTH_STATE_KEY="v173_exp_pool_growth_state";

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

    /* 保留既有戰鬥場數audit，供野怪產出檢查；正式升級需求不再被
       練功區切換綁死，避免Lv10/20等區域交界形成EXP斷層。 */
    const TARGET_BATTLE_ANCHORS=[
        {level:1,battles:3},{level:10,battles:15},{level:20,battles:45},
        {level:30,battles:100},{level:40,battles:250},{level:50,battles:400},
        {level:60,battles:650},{level:70,battles:900},{level:80,battles:1200},
        {level:90,battles:1700},{level:95,battles:2600},{level:98,battles:3500},
        {level:99,battles:4000}
    ];

    /* Lv1~20快速成長；Lv20後平滑銜接長期曲線。 */
    const EXP_REQUIREMENT_ANCHORS=[
        {level:1,value:300},{level:5,value:600},{level:10,value:1200},
        {level:15,value:2500},{level:20,value:8000},{level:30,value:60000},
        {level:40,value:120000},{level:49,value:200000},{level:50,value:215000},
        {level:60,value:400000},{level:70,value:650000},{level:80,value:1000000},
        {level:90,value:1500000},{level:95,value:2000000},{level:99,value:2800000}
    ];
    const NATURAL_CHARGE_LEVELS_PER_DAY=[
        {level:20,value:1.30},{level:39,value:1.25},{level:49,value:1.02},
        {level:50,value:1.00},{level:69,value:.80},{level:84,value:.60},
        {level:94,value:.43},{level:99,value:.32}
    ];
    const DAILY_QUEST_LEVELS_PER_DAY=[
        {level:20,value:.85},{level:39,value:.82},{level:49,value:.70},
        {level:50,value:.69},{level:69,value:.52},{level:84,value:.40},
        {level:94,value:.30},{level:99,value:.24}
    ];
    const DAILY_TOTAL_TARGETS=[
        {level:20,value:3.00},{level:39,value:3.00},{level:49,value:2.40},
        {level:50,value:2.36},{level:60,value:2.15},{level:69,value:2.00},
        {level:70,value:1.97},{level:80,value:1.72},{level:84,value:1.60},
        {level:85,value:1.57},{level:90,value:1.40},{level:94,value:1.30},
        {level:95,value:1.27},{level:99,value:1.00}
    ];
    const NEWCOMER_DAILY_BONUSES={win3:5000,skills5:4000,kill10:6000};

    window.v133MaxLevel=MAX_CHARACTER_LEVEL;

    function interpolateAnchors(level,anchors){
        const safe=Math.max(anchors[0].level,Math.min(anchors[anchors.length-1].level,Number(level)||anchors[0].level));
        if(safe<=anchors[0].level){ return anchors[0].value; }
        for(let i=1;i<anchors.length;i++){
            const right=anchors[i];
            if(safe>right.level){ continue; }
            const left=anchors[i-1];
            const t=(safe-left.level)/(right.level-left.level);
            return left.value+(right.value-left.value)*t;
        }
        return anchors[anchors.length-1].value;
    }

    function getCurveMonsterRankMultiplier(monster){
        if(monster&&Number.isFinite(Number(monster.v141CurveEliteRate))){
            const rate=Math.max(0,Math.min(1,Number(monster.v141CurveEliteRate)));
            return 1+rate*.5;
        }
        let rank="regular";
        if(typeof getMonsterRank==="function"){ rank=getMonsterRank(monster); }
        else if(monster&&monster.rank){ rank=monster.rank; }
        if(rank==="boss"){ return 3; }
        if(rank==="elite"){ return 1.5; }
        return 1;
    }

    function getTrainingExpProfile(level){
        const safeLevel=Math.min(MAX_CHARACTER_LEVEL-1,Math.max(1,Math.floor(Number(level)||1)));
        return TRAINING_ZONE_EXP_PROFILES.find(profile=>
            safeLevel>=profile.minLevel&&safeLevel<=profile.maxLevel
        )||TRAINING_ZONE_EXP_PROFILES[TRAINING_ZONE_EXP_PROFILES.length-1];
    }

    function getTrainingZoneRoster(profile){
        try{
            if(typeof zoneConfig==="undefined"||!zoneConfig[profile.key]){ return null; }
            const source=zoneConfig[profile.key].monsters;
            const roster=typeof source==="function"?source():source;
            return Array.isArray(roster)&&roster.length>0?roster:null;
        }catch(_){ return null; }
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
        return Math.max(1,Math.round(
            averageWeightedMonsterExp*profile.averageGroupSize*TRAINING_EXP_MULTIPLIER
        ));
    }

    function getTargetBattlesForLevel(level){
        const safeLevel=Math.min(MAX_CHARACTER_LEVEL-1,Math.max(1,Math.floor(Number(level)||1)));
        if(safeLevel<=TARGET_BATTLE_ANCHORS[0].level){ return TARGET_BATTLE_ANCHORS[0].battles; }
        for(let index=1;index<TARGET_BATTLE_ANCHORS.length;index++){
            const right=TARGET_BATTLE_ANCHORS[index];
            if(safeLevel>right.level){ continue; }
            const left=TARGET_BATTLE_ANCHORS[index-1];
            const progress=(safeLevel-left.level)/(right.level-left.level);
            return Math.max(1,Math.round(left.battles+(right.battles-left.battles)*progress));
        }
        return TARGET_BATTLE_ANCHORS[TARGET_BATTLE_ANCHORS.length-1].battles;
    }

    function getExpNextForLevel(level){
        const safeLevel=Math.min(MAX_CHARACTER_LEVEL-1,Math.max(1,Math.floor(Number(level)||1)));
        return Math.max(1,Math.round(interpolateAnchors(safeLevel,EXP_REQUIREMENT_ANCHORS)));
    }
    window.v133GetExpNextForLevel=getExpNextForLevel;
    window.v139GetTrainingZoneAverageExpForLevel=getTrainingZoneAverageExpForLevel;
    window.v139GetTargetBattlesForLevel=getTargetBattlesForLevel;

    function getHighestCreatedCharacterLevel(){
        if(typeof getExistingPartyIndexes!=="function"){ return 1; }
        return getExistingPartyIndexes().reduce((max,index)=>{
            const character=typeof getPartyCharacterByIndex==="function"?getPartyCharacterByIndex(index):null;
            return character?Math.max(max,Number(character.level)||1):max;
        },1);
    }
    window.v133GetHighestCreatedCharacterLevel=getHighestCreatedCharacterLevel;

    function hasNonMaxCharacter(){
        return typeof getExistingPartyIndexes==="function"&&getExistingPartyIndexes().some(index=>{
            const character=getPartyCharacterByIndex(index);
            return !!(character&&(Number(character.level)||1)<MAX_CHARACTER_LEVEL);
        });
    }

    function getNaturalChargeLevelsPerDay(level){
        if((Number(level)||1)<20){ return 0; }
        return Math.max(0,interpolateAnchors(level,NATURAL_CHARGE_LEVELS_PER_DAY));
    }
    function getDailyQuestLevelsPerDay(level){
        if((Number(level)||1)<20){ return 0; }
        return Math.max(0,interpolateAnchors(level,DAILY_QUEST_LEVELS_PER_DAY));
    }
    function getDailyTotalTarget(level){
        if((Number(level)||1)<20){ return 0; }
        return Math.max(0,interpolateAnchors(level,DAILY_TOTAL_TARGETS));
    }
    window.v173GetNaturalChargeLevelsPerDay=getNaturalChargeLevelsPerDay;
    window.v173GetDailyQuestLevelsPerDay=getDailyQuestLevelsPerDay;
    window.v173GetDailyTotalTarget=getDailyTotalTarget;

    function getExpPoolCatchUpMultiplierForLevel(level){
        const gap=Math.max(0,getHighestCreatedCharacterLevel()-Math.max(1,Number(level)||1));
        if(gap>=30){ return 1.50; }
        if(gap>=20){ return 1.30; }
        if(gap>=10){ return 1.15; }
        return 1.00;
    }
    function getExpPoolCatchUpMultiplier(character){
        return getExpPoolCatchUpMultiplierForLevel(character&&character.level);
    }
    window.v173GetExpPoolCatchUpMultiplierForLevel=getExpPoolCatchUpMultiplierForLevel;
    window.v173GetExpPoolCatchUpMultiplier=getExpPoolCatchUpMultiplier;

    function loadGrowthState(){
        try{
            const raw=JSON.parse(localStorage.getItem(GROWTH_STATE_KEY)||"{}");
            return {
                initialized:raw.initialized===true,
                unlocked:raw.unlocked===true,
                lastAt:Number.isFinite(Number(raw.lastAt))?Math.max(0,Number(raw.lastAt)):0,
                noticeShown:raw.noticeShown===true,
                lastCapped:raw.lastCapped===true,
                newcomerRewards:raw.newcomerRewards&&typeof raw.newcomerRewards==="object"
                    ?Object.assign({},raw.newcomerRewards):{}
            };
        }catch(_){
            return {initialized:false,unlocked:false,lastAt:0,noticeShown:false,lastCapped:false,newcomerRewards:{}};
        }
    }
    const growthState=loadGrowthState();
    function persistGrowthState(){
        try{ localStorage.setItem(GROWTH_STATE_KEY,JSON.stringify(growthState)); }catch(_){ }
    }

    function showChargeUnlockNotice(){
        if(growthState.noticeShown){ return; }
        growthState.noticeShown=true;
        persistGrowthState();
        alert("經驗池持續充能已解鎖\n即使不掛機，經驗池也會持續累積修為。");
    }

    function ensureExpPoolChargeUnlocked(now,showNotice){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const hasCharacter=typeof getExistingPartyIndexes==="function"&&getExistingPartyIndexes().length>0;
        if(!hasCharacter){ return false; }
        const highest=getHighestCreatedCharacterLevel();
        if(!growthState.initialized){
            growthState.initialized=true;
            growthState.lastAt=timestamp;
            growthState.unlocked=highest>=20;
            growthState.lastCapped=false;
            persistGrowthState();
            if(growthState.unlocked&&showNotice){ showChargeUnlockNotice(); }
            return growthState.unlocked;
        }
        if(!growthState.unlocked&&highest<20){
            growthState.lastAt=timestamp;
            persistGrowthState();
            return false;
        }
        if(!growthState.unlocked&&highest>=20){
            growthState.unlocked=true;
            growthState.lastAt=timestamp;
            growthState.lastCapped=false;
            persistGrowthState();
            if(showNotice){ showChargeUnlockNotice(); }
            return true;
        }
        if(!(growthState.lastAt>0)){
            growthState.lastAt=timestamp;
            persistGrowthState();
        }
        if(showNotice&&!growthState.noticeShown){ showChargeUnlockNotice(); }
        return growthState.unlocked;
    }
    window.v173EnsureExpPoolChargeUnlocked=ensureExpPoolChargeUnlocked;

    function getChargePreview(now){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        if(!growthState.initialized||!growthState.unlocked||!hasNonMaxCharacter()){
            return {gain:0,elapsedMs:0,capped:false,levelsPerDay:0,referenceLevel:getHighestCreatedCharacterLevel()};
        }
        const rawElapsed=timestamp>=growthState.lastAt?timestamp-growthState.lastAt:0;
        const elapsed=Math.min(CHARGE_MAX_MS,Math.max(0,rawElapsed));
        const referenceLevel=Math.min(99,Math.max(20,getHighestCreatedCharacterLevel()));
        const levelsPerDay=getNaturalChargeLevelsPerDay(referenceLevel);
        const gain=Math.max(0,Math.floor(
            getExpNextForLevel(referenceLevel)*levelsPerDay*(elapsed/DAY_MS)
        ));
        return {gain:gain,elapsedMs:elapsed,capped:rawElapsed>=CHARGE_MAX_MS,levelsPerDay:levelsPerDay,referenceLevel:referenceLevel};
    }
    window.v173PreviewExpPoolCharge=getChargePreview;

    function settleExpPoolCharge(now){
        const timestamp=Number.isFinite(Number(now))?Number(now):Date.now();
        const wasInitialized=growthState.initialized;
        if(!ensureExpPoolChargeUnlocked(timestamp,false)){ return 0; }
        if(!wasInitialized){ return 0; }
        if(timestamp<growthState.lastAt){
            growthState.lastAt=timestamp;
            growthState.lastCapped=false;
            persistGrowthState();
            return 0;
        }
        if(!hasNonMaxCharacter()){
            growthState.lastAt=timestamp;
            growthState.lastCapped=false;
            persistGrowthState();
            return 0;
        }
        const preview=getChargePreview(timestamp);
        growthState.lastAt=timestamp;
        growthState.lastCapped=preview.capped;
        persistGrowthState();
        if(preview.gain>0){
            sharedExp=Math.max(0,(Number(sharedExp)||0)+preview.gain);
            if(typeof saveGame==="function"){ saveGame(); }
        }
        return preview.gain;
    }
    window.v173SettleExpPoolCharge=settleExpPoolCharge;
    window.v173GetExpPoolChargeState=function(){
        return {
            initialized:growthState.initialized,unlocked:growthState.unlocked,
            lastAt:growthState.lastAt,noticeShown:growthState.noticeShown,
            lastCapped:growthState.lastCapped,maxHours:72
        };
    };

    function getDailyGrowthRewardBreakdown(level){
        const referenceLevel=Math.min(99,Math.max(20,Math.floor(Number(level)||getHighestCreatedCharacterLevel())));
        if(referenceLevel<20){ return {totalExp:0,taskExp:0,chestExp:0,levelsPerDay:0}; }
        const levelsPerDay=getDailyQuestLevelsPerDay(referenceLevel);
        const totalExp=Math.max(0,Math.round(getExpNextForLevel(referenceLevel)*levelsPerDay));
        const taskExp=Math.round(totalExp*.70);
        return {totalExp:totalExp,taskExp:taskExp,chestExp:Math.max(0,totalExp-taskExp),levelsPerDay:levelsPerDay};
    }
    window.v173GetDailyGrowthRewardBreakdown=getDailyGrowthRewardBreakdown;

    function grantNewcomerDailyBonus(questId){
        const bonus=Math.max(0,Number(NEWCOMER_DAILY_BONUSES[questId])||0);
        if(!bonus||getHighestCreatedCharacterLevel()>=20||growthState.newcomerRewards[questId]){ return 0; }
        growthState.newcomerRewards[questId]=true;
        persistGrowthState();
        sharedExp=Math.max(0,(Number(sharedExp)||0)+bonus);
        if(typeof updateUI==="function"){ updateUI(); }
        if(typeof saveGame==="function"){ saveGame(); }
        if(typeof window.v141ShowBlackGoldReward==="function"){
            window.v141ShowBlackGoldReward({exp:bonus,gold:0,items:[]});
        }
        return bonus;
    }

    if(typeof claimDailyQuest==="function"){
        const originalClaimDailyQuest=claimDailyQuest;
        claimDailyQuest=function(questId){
            const wasClaimed=!!(typeof dailyQuestState!=="undefined"&&dailyQuestState.claimed&&dailyQuestState.claimed[questId]);
            const result=originalClaimDailyQuest.apply(this,arguments);
            const isClaimed=!!(typeof dailyQuestState!=="undefined"&&dailyQuestState.claimed&&dailyQuestState.claimed[questId]);
            if(!wasClaimed&&isClaimed){ grantNewcomerDailyBonus(questId); }
            return result;
        };
    }

    window.v139GetExpCurveAudit=function(){
        const checkpoints=[10,20,30,40,49,50,60,70,80,90,95,99].map(level=>({
            level:level,
            averageBattleExp:getTrainingZoneAverageExpForLevel(level),
            targetBattles:getTargetBattlesForLevel(level),
            expNext:getExpNextForLevel(level),
            naturalLevelsPerDay:getNaturalChargeLevelsPerDay(level),
            dailyQuestLevelsPerDay:getDailyQuestLevelsPerDay(level),
            dailyTotalTarget:getDailyTotalTarget(level)
        }));
        let totalEffectiveBattles=0;
        for(let level=1;level<MAX_CHARACTER_LEVEL;level++){
            totalEffectiveBattles+=getTargetBattlesForLevel(level);
        }
        let beginnerTotalExp=0;
        for(let level=1;level<20;level++){ beginnerTotalExp+=getExpNextForLevel(level); }
        return {totalEffectiveBattles:totalEffectiveBattles,beginnerTotalExp:beginnerTotalExp,checkpoints:checkpoints};
    };
    window.v173GetBeginnerGrowthAudit=function(){
        let total=0;
        const requirements=[];
        for(let level=1;level<20;level++){
            const exp=getExpNextForLevel(level);
            total+=exp;
            requirements.push({level:level,expNext:exp});
        }
        return {totalExpTo20:total,requirements:requirements,newcomerOneTimeExp:15000};
    };

    function recalibrateCharacterExpNext(character){
        if(!character){ return; }
        character.level=Math.min(MAX_CHARACTER_LEVEL,Math.max(1,Math.floor(Number(character.level)||1)));
        if(character.level>=MAX_CHARACTER_LEVEL){ character.exp=0; }
        character.expNext=getExpNextForLevel(character.level);
    }

    recalibrateCharacterExpNext(player);
    if(typeof player2!=="undefined"&&player2){ recalibrateCharacterExpNext(player2); }
    if(typeof player3!=="undefined"&&player3){ recalibrateCharacterExpNext(player3); }

    const growthWasInitialized=growthState.initialized;
    ensureExpPoolChargeUnlocked(Date.now(),false);
    if(growthWasInitialized){ settleExpPoolCharge(Date.now()); }

    if(typeof checkLevelUp==="function"){
        const originalCheckLevelUp=checkLevelUp;
        checkLevelUp=function(targetCharacter){
            settleExpPoolCharge(Date.now());
            const character=targetCharacter||player;
            const levelBefore=character.level;
            if(levelBefore>=MAX_CHARACTER_LEVEL){
                recalibrateCharacterExpNext(character);
                if(typeof refreshCharacterAvatarLevels==="function"){ refreshCharacterAvatarLevels(); }
                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                return false;
            }
            const result=originalCheckLevelUp.apply(this,arguments);
            if(character.level>MAX_CHARACTER_LEVEL){
                const excessLevels=character.level-MAX_CHARACTER_LEVEL;
                character.level=MAX_CHARACTER_LEVEL;
                character.attributePoints=Math.max(0,(Number(character.attributePoints)||0)-excessLevels*5);
                character.skillPoints=Math.max(0,(Number(character.skillPoints)||0)-excessLevels*2);
                character.bonusHP=Math.max(0,(Number(character.bonusHP)||0)-excessLevels*30);
                character.bonusSP=Math.max(0,(Number(character.bonusSP)||0)-excessLevels*10);
                character.exp=0;
            }
            if(character.level!==levelBefore){
                recalibrateCharacterExpNext(character);
                ensureExpPoolChargeUnlocked(Date.now(),true);
                if(typeof saveGame==="function"){ saveGame(); }
            }
            return result;
        };
    }

    if(typeof distributeExpToCharacter==="function"){
        const originalDistributeExpToCharacterV133=distributeExpToCharacter;
        distributeExpToCharacter=function(character){
            settleExpPoolCharge(Date.now());
            if(character&&(Number(character.level)||1)>=MAX_CHARACTER_LEVEL){
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
            ensureExpPoolChargeUnlocked(Date.now(),false);
            return result;
        };
    }

    if(typeof createAdditionalCharacter==="function"){
        const originalCreateAdditionalCharacter=createAdditionalCharacter;
        createAdditionalCharacter=function(slotNumber){
            const result=originalCreateAdditionalCharacter.apply(this,arguments);
            recalibrateCharacterExpNext(slotNumber===3?player3:player2);
            ensureExpPoolChargeUnlocked(Date.now(),false);
            return result;
        };
    }

    if(typeof document!=="undefined"&&typeof document.addEventListener==="function"){
        document.addEventListener("visibilitychange",()=>{
            if(!document.hidden){ settleExpPoolCharge(Date.now()); }
        });
    }
    if(typeof window!=="undefined"&&typeof window.addEventListener==="function"){
        window.addEventListener("pageshow",()=>settleExpPoolCharge(Date.now()));
    }

    if(typeof renderExpDistributeList==="function"){ renderExpDistributeList(); }

    /* =====================================================
       2. 怪物金幣掉落rank倍率調整（精英×2、BOSS×5）
       ===================================================== */
    if(typeof getMonsterGoldDrop==="function"){
        getMonsterGoldDrop=function(monster){
            if(!monster){ return 0; }
            const level=Math.max(1,Math.floor(Number(monster.level)||1));
            const rank=getMonsterRank(monster);
            const rankMultiplier=rank==="boss"?5:rank==="elite"?2:1;
            const base=level*2+3;
            const variance=0.85+Math.random()*0.30;
            return Math.max(1,Math.floor(base*rankMultiplier*variance));
        };
    }

    /* =====================================================
       3. 商店價格：看帳號內已建立角色的最高等級
       ===================================================== */
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

    function getShopPriceTier(){
        const highestLevel=getHighestCreatedCharacterLevel();
        for(const tier of SHOP_PRICE_TIERS){
            if(highestLevel<=tier.maxLevel){ return tier; }
        }
        return SHOP_PRICE_TIERS[SHOP_PRICE_TIERS.length-1];
    }

    function getShopItemPrice(shopItem){
        if(!shopItem||!Number.isFinite(shopItem.price)){ return shopItem?shopItem.price:null; }
        return Math.round(shopItem.price*getShopPriceTier().multiplier);
    }
    window.v133GetShopItemPrice=getShopItemPrice;

    /* =====================================================
       4. 藥水補品重新整理：新增30%階、商店下架100%階
       ===================================================== */
    const SHOP_POTION_BASE_PRICES={
        hpPotion10:20,hpPotion30:50,hpPotion50:80,
        spPotion10:25,spPotion30:65,spPotion50:100
    };
    const SHOP_POTION_IDS=Object.keys(SHOP_POTION_BASE_PRICES);

    if(typeof potionDefinitions!=="undefined"&&Array.isArray(potionDefinitions)){
        let hpPotion30=potionDefinitions.find(p=>p&&p.id==="hpPotion30");
        if(!hpPotion30){
            hpPotion30={id:"hpPotion30",name:"回復30%HP藥水",shortName:"HP 30%",icon:"",type:"potion",resource:"hp",recoveryPercent:30,price:50,stats:{}};
            potionDefinitions.push(hpPotion30);
        }
        hpPotion30.price=50;
        let spPotion30=potionDefinitions.find(p=>p&&p.id==="spPotion30");
        if(!spPotion30){
            spPotion30={id:"spPotion30",name:"回復30%SP藥水",shortName:"SP 30%",icon:"",type:"potion",resource:"sp",recoveryPercent:30,price:65,stats:{}};
            potionDefinitions.push(spPotion30);
        }
        spPotion30.price=65;
        potionDefinitions.forEach(item=>{
            if(item&&Object.prototype.hasOwnProperty.call(SHOP_POTION_BASE_PRICES,item.id)){
                item.price=SHOP_POTION_BASE_PRICES[item.id];
            }
        });
    }

    function getShoppablePotions(){
        if(typeof potionDefinitions==="undefined"||!Array.isArray(potionDefinitions)){ return []; }
        return SHOP_POTION_IDS.map(itemId=>potionDefinitions.find(item=>item&&item.id===itemId)).filter(Boolean);
    }

    if(typeof renderShopContent==="function"){
        renderShopContent=function(){
            const tier=getShopPriceTier();
            const cards=getShoppablePotions().map(shopItem=>{
                const count=typeof getPotionCount==="function"?getPotionCount(shopItem.id):0;
                const resourceLabel=shopItem.resource==="hp"?"HP":"SP";
                const effectText=`回復最大${resourceLabel}的 ${shopItem.recoveryPercent}%`;
                const displayPrice=getShopItemPrice(shopItem);
                const hasPrice=Number.isFinite(displayPrice);
                const disabled=!hasPrice||gold<displayPrice;
                const buttonText=!hasPrice?"價格待定":`${displayPrice} 金幣`;
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
                            <input id="shopQuantity-${shopItem.id}" class="shop-potion-quantity" type="number" inputmode="numeric" min="1" max="9999" step="1" value="1">
                            <button class="home-feature-buy-btn shop-potion-buy" ${disabled?"disabled":""}
                                onclick="buyShopItem('${shopItem.id}',document.getElementById('shopQuantity-${shopItem.id}').value)">${buttonText}</button>
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
            const shopItem=typeof getPotionDefinition==="function"?getPotionDefinition(itemId):null;
            if(!shopItem||!SHOP_POTION_IDS.includes(itemId)){ return; }
            const unitPrice=getShopItemPrice(shopItem);
            if(!Number.isFinite(unitPrice)){ alert("這個藥水的價格尚未設定。"); return; }
            const quantity=Math.max(1,Math.min(9999,Math.floor(Number(requestedQuantity)||1)));
            const totalPrice=unitPrice*quantity;
            if(gold<totalPrice){ alert("金幣不夠，本次需要 "+totalPrice.toLocaleString("zh-TW")+" 金幣。"); return; }
            if(!addPotionToInventory(itemId,quantity)){ alert("背包已滿，或該藥水已沒有可用的堆疊空間。"); return; }
            gold=gold-totalPrice;
            rebuildInventorySlots();
            updateGoldDisplay();
            saveGame();
            const bodyEl=$("homeFeatureModalBody");
            if(bodyEl){ bodyEl.innerHTML=renderShopContent(); }
        };
    }

    /* =====================================================
       5. 預留未來金幣消耗系統共用工具
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
