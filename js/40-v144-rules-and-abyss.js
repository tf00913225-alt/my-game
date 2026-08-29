/* =====================================================
   V144 — shop, carried monster skills, hard-control flow,
   transition labels, support skills and Abyss floor 5.
===================================================== */
(function installV144RulesAndAbyss(){
    "use strict";

    if(typeof window==="undefined"||window.__v144RulesInstalled){ return; }
    window.__v144RulesInstalled=true;

    const VERSION="144";
    const SHOP_POTION_PRICES={
        hpPotion10:20,hpPotion20:45,hpPotion30:75,
        spPotion10:25,spPotion20:55,spPotion30:90
    };
    const SHOP_POTION_IDS=Object.keys(SHOP_POTION_PRICES);
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

    function numeric(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }

    function clampLevel(value){ return Math.max(1,Math.floor(numeric(value)||1)); }

    function escapeHtml(value){
        return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
    }

    /* ----- Revised player support skills. ----- */
    function patchSkillData(){
        if(typeof skillDatabase==="undefined"){ return; }
        const heal=skillDatabase.healSpell;
        if(heal){
            Object.assign(heal,{
                learnCost:20,maxLevel:5,spCost:40,targetType:"allyAll",
                baseHeal:350,healPerLevel:30,baseHealSP:35,healSPPerLevel:30,
                requires:["iceArrowRain","iceSpin"],
                description:"需先學習冰霜箭雨或冰旋一閃其一。對我方全體恢復350 HP與35 SP；每升1級，HP與SP恢復量各提升30點。"
            });
        }
        const dodge=skillDatabase.dodgeSkill;
        if(dodge){
            Object.assign(dodge,{
                learnCost:10,maxLevel:1,spCost:20,targetType:"allyAll",duration:2,
                evasionBonusPercent:60,requires:["windCrossSlash","windHowlLightning"],
                description:"需先學習風旋十字斬或風哮電擊其一。使我方全體閃躲率提升60%，持續2回合。"
            });
        }
        const stealth=skillDatabase.stealthSkill;
        if(stealth){
            Object.assign(stealth,{
                learnCost:15,maxLevel:1,spCost:45,targetType:"ally",duration:2,
                requires:["dodgeSkill"],
                description:"需先學習閃躲術。使單一友方隱身2回合；無法被單體技能選中，但仍會受到範圍技能波及。"
            });
        }
        const calm=skillDatabase.dinghaishenzhen;
        if(calm){
            Object.assign(calm,{
                learnCost:20,maxLevel:1,spCost:77,targetType:"allyAll",duration:3,
                statusResistBonus:45,accuracyBonusPercent:50,requires:["stealthSkill"],
                description:"需先學習隱身術。使我方全體異常狀態抗性提升45%、命中提升50%，持續3回合。"
            });
        }
        const earthShield=skillDatabase.earthShield;
        if(earthShield){
            Object.assign(earthShield,{
                learnCost:10,maxLevel:1,spCost:66,targetType:"allyAll",duration:3,
                reflectPercent:50,requires:["stoneBreakSky","flyingSandStrike"],
                description:"需先學習石破天驚或飛沙瞬擊其一。使我方全體獲得50%反傷土盾，持續3回合。"
            });
        }
        const rockWall=skillDatabase.rockWall;
        if(rockWall){
            Object.assign(rockWall,{
                learnCost:15,maxLevel:1,spCost:45,targetType:"allyAll",duration:4,
                defenseBonusPercent:30,requires:["barrier"],
                description:"需先學習結界。使我方全體防禦力提升30%，持續4回合。"
            });
        }
        const waterEX=skillDatabase.waterEX;
        if(waterEX){
            Object.assign(waterEX,{
                learnCost:25,maxLevel:1,damageBonusPercent:5,healBonusPercent:10,statusResistBonus:10,
                description:"永久提升水元素傷害5%、回復系技能回復量10%、異常狀態抗性10%。"
            });
        }
        const frostCrush=skillDatabase.frostCrush;
        if(frostCrush){
            Object.assign(frostCrush,{
                learnCost:30,maxLevel:5,baseDamage:100,damagePerLevel:15,spCost:50,
                freezeChance:75,freezeDuration:2,lifestealPercentByLevel:[4,5,6,7,8],
                requires:["iceSpin"],
                description:"需先學習冰旋一閃。對單體造成100點基礎傷害，每升1級傷害+15；75%基礎機率冰封2回合，並吸取實際傷害的4%/5%/6%/7%/8%恢復自身HP。"
            });
        }
        const rain=skillDatabase.iceArrowRain;
        if(rain){
            Object.assign(rain,{
                learnCost:20,maxLevel:5,baseDamage:30,damagePerLevel:12,spCost:75,
                freezeChance:50,freezeDuration:2,freezeSingleTarget:false,
                lifestealPercentByLevel:[1,2,3,4,5],requires:["floodBeast"],
                description:"需先學習洪水猛獸。對敵方全體各造成30點基礎傷害，每升1級傷害+12；吸取實際傷害的1%/2%/3%/4%/5%恢復自身HP，每個命中目標各有50%基礎機率冰封2回合。"
            });
        }
        const rage=skillDatabase.rage;
        if(rage){
            Object.assign(rage,{
                learnCost:25,maxLevel:5,spCost:50,targetType:"allyAll",duration:2,
                critBonusByLevel:[5,10,15,20,25],critChanceBonusByLevel:[5,10,15,20,25],
                critDamageBonusByLevel:[10,20,30,40,50],requires:["explosiveFlurry","flameTornado"],
                description:"需先學習火爆亂擊或烈焰龍捲其一。提高我方中、左、右最多3名存活角色的爆擊率5%/10%/15%/20%/25%與爆擊傷害10%/20%/30%/40%/50%，持續2回合。"
            });
        }
        const phoenix=skillDatabase.phoenixCry;
        if(phoenix){
            Object.assign(phoenix,{
                learnCost:45,maxLevel:5,baseDamage:53,damagePerLevel:15,spCost:62,
                burnChance:70,burnDuration:2,burnPercentByLevel:[5,7,9,11,13],
                requires:["flameTornado"],
                description:"需先學習烈焰龍捲。對敵方全體各造成53點基礎傷害，每升1級傷害+15；70%基礎機率燃燒2回合，每回合造成目標最大HP的5%/7%/9%/11%/13%傷害。"
            });
        }
        const holy=skillDatabase.yuanXiangGuangMing;
        if(holy){
            Object.assign(holy,{
                targetType:"allyAll",baseHeal:450,baseHealSP:95,
                cleanseAll:true,agilityBonusPercent:75,duration:2,
                description:"敵方全體回復450 HP、95 SP，解除所有負面狀態，並提升75%敏捷2回合。"
            });
        }
    }
    patchSkillData();

    /* 舊預覽仍會自行補上智力係數與「施放者不回SP」文字；本次治療術
       已改為明確固定值，因此詳細頁也必須使用同一份最終規格。 */
    if(typeof getSkillEffectPreviewText==="function"){
        const previousSkillEffectPreview=getSkillEffectPreviewText;
        getSkillEffectPreviewText=function(skill,level){
            if(skill&&skill.id==="healSpell"){
                const lv=Math.max(1,Math.min(5,Math.floor(numeric(level)||1)));
                return "我方全體回復 "+(350+30*(lv-1))+" HP、"+(35+30*(lv-1))+" SP";
            }
            if(skill&&skill.id==="dinghaishenzhen"){
                return "我方全體異常狀態抗性 +45%、命中 +50%，持續3回合";
            }
            return previousSkillEffectPreview.apply(this,arguments);
        };
    }

    if(typeof buildSkillLevelBreakdownHTML==="function"){
        const previousSkillLevelBreakdown=buildSkillLevelBreakdownHTML;
        buildSkillLevelBreakdownHTML=function(skill){
            if(skill&&skill.id==="healSpell"){
                return Array.from({length:5},(_,index)=>{
                    const level=index+1;
                    return '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);"><span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.'+level+'</span><span style="flex:1;">我方全體回復 '+(350+30*index)+' HP、'+(35+30*index)+' SP</span></div>';
                }).join("");
            }
            if(skill&&skill.id==="dinghaishenzhen"){
                return '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(240,180,41,.12);"><span style="flex:0 0 40px;color:#f0b429;font-weight:bold;">Lv.1</span><span style="flex:1;">我方全體異常狀態抗性 +45%、命中 +50%，持續3回合</span></div>';
            }
            return previousSkillLevelBreakdown.apply(this,arguments);
        };
    }

    if(typeof getSkillPreviewSummary==="function"){
        const previousSkillPreviewSummary=getSkillPreviewSummary;
        getSkillPreviewSummary=function(skill){
            if(skill&&skill.id==="dinghaishenzhen"){
                return "支援我方全體；提升異常狀態抗性與命中。";
            }
            return previousSkillPreviewSummary.apply(this,arguments);
        };
    }

    /* 氣定神閒的命中提升要進入實際戰鬥能力，而不只停在描述。 */
    function accuracyMultiplier(character){
        if(!character||!Array.isArray(character.activeBuffs)){ return 1; }
        const active=character.activeBuffs.some(buff=>
            buff&&buff.type==="dinghaishenzhen"&&numeric(buff.turnsLeft)>0
        );
        return active?1+(numeric(skillDatabase.dinghaishenzhen&&skillDatabase.dinghaishenzhen.accuracyBonusPercent)||50)/100:1;
    }

    function wrapAccuracyStats(name,characterFromArgs){
        const previous=window[name];
        if(typeof previous!=="function"){ return; }
        window[name]=function(){
            const stats=previous.apply(this,arguments);
            const character=characterFromArgs(arguments);
            if(!stats||!character){ return stats; }
            return Object.assign({},stats,{accuracy:Math.round(numeric(stats.accuracy)*accuracyMultiplier(character))});
        };
    }
    wrapAccuracyStats("getMainCharacterStats",()=>typeof player!=="undefined"?player:null);
    wrapAccuracyStats("getAdditionalCharacterBattleStats",args=>args[0]);

    /* ----- Shop: only 10/20/30% potions, with the existing level multiplier. ----- */
    function ensurePotion(id,resource,percent,price){
        if(typeof potionDefinitions==="undefined"||!Array.isArray(potionDefinitions)){ return null; }
        let potion=potionDefinitions.find(item=>item&&item.id===id);
        if(!potion){
            potion={id:id,name:"",shortName:"",icon:"",type:"potion",resource:resource,recoveryPercent:percent,price:price,stats:{}};
            potionDefinitions.push(potion);
        }
        Object.assign(potion,{
            name:"回復"+percent+"%"+resource.toUpperCase()+"藥水",
            shortName:resource.toUpperCase()+" "+percent+"%",
            type:"potion",resource:resource,recoveryPercent:percent,price:price,stats:potion.stats||{}
        });
        return potion;
    }

    ensurePotion("hpPotion10","hp",10,SHOP_POTION_PRICES.hpPotion10);
    ensurePotion("hpPotion20","hp",20,SHOP_POTION_PRICES.hpPotion20);
    ensurePotion("hpPotion30","hp",30,SHOP_POTION_PRICES.hpPotion30);
    ensurePotion("spPotion10","sp",10,SHOP_POTION_PRICES.spPotion10);
    ensurePotion("spPotion20","sp",20,SHOP_POTION_PRICES.spPotion20);
    ensurePotion("spPotion30","sp",30,SHOP_POTION_PRICES.spPotion30);

    function shopTier(){
        const highest=typeof window.v133GetHighestCreatedCharacterLevel==="function"
            ?clampLevel(window.v133GetHighestCreatedCharacterLevel()):1;
        return SHOP_PRICE_TIERS.find(tier=>highest<=tier.maxLevel)||SHOP_PRICE_TIERS[SHOP_PRICE_TIERS.length-1];
    }

    function shopUnitPrice(item){
        if(typeof window.v133GetShopItemPrice==="function"){ return window.v133GetShopItemPrice(item); }
        return Math.round(numeric(item&&item.price)*shopTier().multiplier);
    }

    function shoppablePotions(){
        return SHOP_POTION_IDS.map(id=>potionDefinitions.find(item=>item&&item.id===id)).filter(Boolean);
    }

    if(typeof renderShopContent==="function"){
        renderShopContent=function(){
            const tier=shopTier();
            const cards=shoppablePotions().map(item=>{
                const label=item.resource==="hp"?"HP":"SP";
                const price=shopUnitPrice(item);
                return '<div class="shop-potion-card '+item.resource+'">'+
                    '<div class="shop-potion-card-head"><span class="shop-potion-type">'+label+'</span><span class="shop-potion-stock">持有 '+getPotionCount(item.id)+'</span></div>'+
                    '<div class="shop-potion-name">'+escapeHtml(item.name)+'</div><div class="shop-potion-effect">回復最大'+label+'的 '+item.recoveryPercent+'%</div>'+
                    '<div class="shop-potion-purchase-row"><label for="shopQuantity-'+item.id+'">數量</label><input id="shopQuantity-'+item.id+'" class="shop-potion-quantity" data-unit-price="'+price+'" type="number" inputmode="numeric" min="1" max="9999" step="1" value="1" oninput="v146UpdateShopTotal(\''+item.id+'\')">'+
                    '<span class="v146-shop-total" id="shopTotal-'+item.id+'">'+price+' 金幣</span><button class="home-feature-buy-btn shop-potion-buy" '+(gold<price?'disabled':'')+' onclick="buyShopItem(\''+item.id+'\',document.getElementById(\'shopQuantity-'+item.id+'\').value)">購買</button></div></div>';
            }).join("");
            return '<div class="shop-potion-interface"><div class="shop-potion-note">只販售 HP／SP 10%、20%、30% 回復藥水</div>'+
                '<div class="v133-shop-tier-note">目前商店階級：'+tier.label+'（價格×'+tier.multiplier+'）</div><div class="shop-potion-list">'+cards+'</div></div>';
        };
    }

    if(typeof buyShopItem==="function"){
        buyShopItem=function(itemId,requestedQuantity){
            if(!SHOP_POTION_IDS.includes(itemId)){ return; }
            const item=getPotionDefinition(itemId);
            if(!item){ return; }
            const quantity=Math.max(1,Math.min(9999,Math.floor(numeric(requestedQuantity)||1)));
            const unitPrice=shopUnitPrice(item);
            const totalPrice=unitPrice*quantity;
            if(gold<totalPrice){ alert("金幣不夠，本次需要 "+totalPrice.toLocaleString("zh-TW")+" 金幣。"); return; }
            if(!addPotionToInventory(itemId,quantity)){ alert("背包已滿，或該藥水已沒有可用的堆疊空間。"); return; }
            gold-=totalPrice;
            rebuildInventorySlots(); updateGoldDisplay(); saveGame();
            const body=document.getElementById("homeFeatureModalBody");
            if(body){ body.innerHTML=renderShopContent(); }
        };
    }

    /* ----- General monster carried skills: sample once per encounter. ----- */
    function monsterCarryLimit(level){
        const lv=clampLevel(level);
        return lv<=20?1:lv<=40?2:3;
    }

    function monsterSkillLevel(level){
        const lv=clampLevel(level);
        if(lv<=20){ return 1; }
        if(lv<=40){ return 2; }
        if(lv<=60){ return 3; }
        if(lv<=80){ return 4; }
        return 5;
    }

    function tierLimit(level){
        if(typeof getMonsterSkillTierAndChance==="function"){
            return Math.max(0,Math.floor(numeric(getMonsterSkillTierAndChance(level).maxTier)));
        }
        const lv=clampLevel(level);
        return lv<=10?0:lv<=40?1:lv<=70?2:3;
    }

    function legalMonsterSkillPool(monster){
        if(!monster||monster.v141Abyss||typeof skillDatabase==="undefined"){ return []; }
        const maxTier=tierLimit(monster.level);
        if(maxTier<=0){ return []; }
        return Object.keys(skillDatabase).filter(id=>{
            const skill=skillDatabase[id];
            return skill&&skill.element===monster.element&&
                (skill.category==="physical"||skill.category==="magic")&&
                numeric(skill.tier)>0&&numeric(skill.tier)<=maxTier;
        });
    }

    function shuffled(values){
        const list=values.slice();
        for(let index=list.length-1;index>0;index--){
            const other=Math.floor(Math.random()*(index+1));
            [list[index],list[other]]=[list[other],list[index]];
        }
        return list;
    }

    let encounterSequence=0;
    function configureEncounterSkills(monster,encounterId){
        if(!monster||monster.v141Abyss){ return monster; }
        const pool=legalMonsterSkillPool(monster);
        monster.v144LegalSkillPool=pool.slice();
        monster.skillIds=shuffled(pool).slice(0,monsterCarryLimit(monster.level));
        monster.v141SkillLevel=monsterSkillLevel(monster.level);
        monster.v144SkillLevel=monster.v141SkillLevel;
        monster.v144SkillEncounter=encounterId||("generated-"+(++encounterSequence));
        return monster;
    }

    window.v144GetMonsterSkillCarryLimit=monsterCarryLimit;
    window.v144GetMonsterFixedSkillLevel=monsterSkillLevel;
    window.v144GetMonsterLegalSkillPool=legalMonsterSkillPool;
    window.v144ConfigureMonsterEncounterSkills=configureEncounterSkills;

    if(typeof makeZoneMonster==="function"){
        const previousMakeZoneMonster=makeZoneMonster;
        makeZoneMonster=function(){
            return configureEncounterSkills(previousMakeZoneMonster.apply(this,arguments));
        };
    }

    if(typeof window.v141RollWildMonsterRanks==="function"){
        const previousRollWildRanks=window.v141RollWildMonsterRanks;
        window.v141RollWildMonsterRanks=function(indexes){
            const result=previousRollWildRanks.apply(this,arguments);
            const encounterId="wild-"+(++encounterSequence);
            (indexes||[]).forEach(index=>{
                const monster=typeof monsters!=="undefined"?monsters[index]:null;
                configureEncounterSkills(monster,encounterId);
            });
            return result;
        };
    }

    /* ----- Hard control skips manual declaration instead of accepting a fake action. ----- */
    function hardControlName(character){
        if(!character){ return ""; }
        if(typeof isMonsterFrozen==="function"&&isMonsterFrozen(character)){ return "冰封"; }
        if(typeof isMonsterPetrified==="function"&&isMonsterPetrified(character)){ return "石化"; }
        return "";
    }

    if(typeof beginCharacterTurn==="function"){
        const previousBeginCharacterTurn=beginCharacterTurn;
        beginCharacterTurn=function(token){
            if(
                typeof battleActive!=="undefined"&&battleActive&&
                typeof battlePhase!=="undefined"&&battlePhase==="declare"&&
                typeof activeBattleCharacterIndex!=="undefined"
            ){
                const index=activeBattleCharacterIndex;
                const character=getPartyCharacterByIndex(index);
                const control=character&&character.hp>0?hardControlName(character):"";
                if(control){
                    if(typeof declaredCharacterIndexes!=="undefined"&&declaredCharacterIndexes.has(index)){ return; }
                    if(typeof declaredCharacterIndexes!=="undefined"){ declaredCharacterIndexes.add(index); }
                    actionReady=false; pendingAction=null;
                    if(typeof closeMenus==="function"){ closeMenus(); }
                    if(typeof clearBattleTargetSelectionMode==="function"){ clearBattleTargetSelectionMode(); }
                    if(typeof clearActiveCharacterHighlight==="function"){ clearActiveCharacterHighlight(); }
                    if(typeof addBattleLog==="function"){ addBattleLog((character.id||"角色")+"正處於"+control+"，本回合直接跳過。"); }
                    if(typeof updateActionHudVisibility==="function"){ updateActionHudVisibility(); }
                    finishPlayerAction();
                    return;
                }
            }
            return previousBeginCharacterTurn.apply(this,arguments);
        };
    }

    if(typeof buildInitiativeQueue==="function"){
        const previousBuildInitiativeQueue=buildInitiativeQueue;
        buildInitiativeQueue=function(){
            return previousBuildInitiativeQueue.apply(this,arguments).filter(entry=>
                entry.type!=="player"||!hardControlName(getPartyCharacterByIndex(entry.characterIndex))
            );
        };
    }

    /* ----- Heal Spell resolves its exact flat values for every living ally. ----- */
    function resolveAllPartyHeal(characterIndex){
        const skill=skillDatabase.healSpell;
        const caster=getPartyCharacterByIndex(characterIndex);
        const characterKey=getPartyCharacterKey(characterIndex);
        const level=Math.max(0,Math.floor(numeric(getSkillLevel(characterKey,"healSpell"))));
        const cost=numeric(skill.spCost);
        if(!caster||caster.hp<=0||level<=0||caster.sp<cost){
            if(typeof addBattleLog==="function"){ addBattleLog(!caster||level<=0?"角色尚未學習治療術。":"SP不足，無法使用治療術。"); }
            finishPlayerAction(); return true;
        }
        caster.sp-=cost;
        if(typeof lungePlayerCard==="function"){ lungePlayerCard(characterIndex); }
        showSkillNameBadge(skill.name,skill.element,characterIndex);
        if(typeof showPlayerSpPopup==="function"){ setTimeout(()=>showPlayerSpPopup(cost,characterIndex),500); }
        const exLevel=Math.max(0,Math.floor(numeric(getSkillLevel(characterKey,"waterEX"))));
        const recoveryMultiplier=exLevel>0?1+(numeric(skillDatabase.waterEX&&skillDatabase.waterEX.healBonusPercent)||10)/100:1;
        const hpAmount=Math.floor((350+30*(level-1))*recoveryMultiplier);
        const spAmount=Math.floor((35+30*(level-1))*recoveryMultiplier);
        let hpTotal=0;
        let spTotal=0;
        getExistingPartyIndexes().forEach(index=>{
            const target=getPartyCharacterByIndex(index);
            const stats=getPartyBattleStats(index);
            if(!target||!stats||target.hp<=0){ return; }
            const hp=Math.max(0,Math.min(hpAmount,stats.maxHP-target.hp));
            const sp=Math.max(0,Math.min(spAmount,stats.maxSP-target.sp));
            target.hp+=hp; target.sp+=sp;
            hpTotal+=hp; spTotal+=sp;
            if(hp>0&&typeof showPlayerHit==="function"){ showPlayerHit(hp,"heal",index,true); }
            if(sp>0&&typeof showPlayerHit==="function"){ showPlayerHit(sp,"sp",index,true); }
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("player",index,"heal"); }
        });
        addBattleLog((caster.id||"角色")+"施放治療術，我方全體共恢復"+hpTotal+" HP、"+spTotal+" SP。");
        updateUI(); finishPlayerAction();
        return true;
    }

    if(typeof resolveQueuedPlayerAction==="function"){
        const previousResolveQueuedPlayerAction=resolveQueuedPlayerAction;
        resolveQueuedPlayerAction=function(characterIndex){
            const queued=typeof queuedPlayerActions!=="undefined"?queuedPlayerActions[characterIndex]:null;
            if(queued&&queued.action==="healSpell"){ return resolveAllPartyHeal(characterIndex); }
            return previousResolveQueuedPlayerAction.apply(this,arguments);
        };
    }

    /* ----- Exact transition wording. ----- */
    function setTransitionLabel(label,kind){
        const overlay=document.getElementById("v141BattleTransition");
        const text=overlay&&overlay.querySelector("b");
        if(!overlay||!text){ return; }
        text.textContent=label;
        overlay.dataset.v144Kind=kind;
    }

    if(typeof startTurn==="function"){
        const previousStartTurnForLabel=startTurn;
        startTurn=function(){
            const result=previousStartTurnForLabel.apply(this,arguments);
            setTransitionLabel("進入戰場","entry");
            setTimeout(()=>setTransitionLabel("進入戰場","entry"),0);
            return result;
        };
    }
    if(typeof winBattle==="function"){
        const previousWinBattleForLabel=winBattle;
        winBattle=function(){
            const result=previousWinBattleForLabel.apply(this,arguments);
            setTransitionLabel("勝利","win");
            return result;
        };
    }
    if(typeof loseBattle==="function"){
        const previousLoseBattleForLabel=loseBattle;
        loseBattle=function(){
            const result=previousLoseBattleForLabel.apply(this,arguments);
            setTransitionLabel("戰鬥失敗","lose");
            return result;
        };
    }

    /* ----- Abyss floor 5 exact formation and carried skills. ----- */
    const FINAL_BOSS_ORDER=["東帝天尊","天帝天尊","極帝天尊","北帝天尊","南帝天尊"];
    const FINAL_BOSS_RULES={
        東帝天尊:{element:"earth",skills:["flyingSandStrike","stoneBreakSky"],supports:["barrier"]},
        天帝天尊:{element:"wind",skills:["stormRain","stormSpell"],supports:["dinghaishenzhen"]},
        極帝天尊:{element:"light",skills:[],supports:["yuanXiangGuangMing","yuanGuangShield"]},
        北帝天尊:{element:"water",skills:["iceArrowRain"],supports:["revive","healSpell"]},
        南帝天尊:{element:"fire",skills:["phoenixCry","dragonSlash"],supports:["rage"]}
    };
    const FINAL_ELITES=[
        {element:"water",skill:"frostCrush"},{element:"earth",skill:"stoneThrow"},
        {element:"fire",skill:"fireCritical"},{element:"wind",skill:"dodgeSkill"},
        {element:"water",skill:"frostCrush"}
    ];

    function isFinalAbyssRoster(roster){
        return Array.isArray(roster)&&roster.length===10&&FINAL_BOSS_ORDER.every(name=>roster.some(monster=>monster&&monster.name===name&&monster.v141Abyss));
    }

    function patchFinalAbyssRoster(roster){
        if(!isFinalAbyssRoster(roster)){ return roster; }
        const bosses=FINAL_BOSS_ORDER.map(name=>roster.find(monster=>monster&&monster.name===name));
        const elites=roster.filter(monster=>monster&&monster.name==="天兵天將").slice(0,5);
        bosses.forEach((monster,position)=>{
            const rule=FINAL_BOSS_RULES[monster.name];
            monster.element=rule.element;
            monster.skillIds=rule.skills.slice();
            monster.v141SupportSkillIds=rule.supports.slice();
            monster.v141ForceSkillLevel=5;
            monster.v141FormationRow=0;
            monster.v141FormationPosition=position;
            monster.skillChance=monster.name==="極帝天尊"?1:.78;
        });
        elites.forEach((monster,position)=>{
            const rule=FINAL_ELITES[position];
            monster.name="天兵天將";
            monster.element=rule.element;
            monster.skillIds=rule.skill==="dodgeSkill"?[]:[rule.skill];
            monster.v141SupportSkillIds=rule.skill==="dodgeSkill"?["dodgeSkill"]:[];
            monster.v141ForceSkillLevel=5;
            monster.v141FormationRow=1;
            monster.v141FormationPosition=position;
        });
        roster.splice(0,roster.length,...bosses,...elites);
        roster.v144FinalAbyss=true;
        return roster;
    }
    window.v144PatchFinalAbyssRoster=patchFinalAbyssRoster;

    if(typeof window.v132LaunchDungeonBattle==="function"){
        const previousLaunchDungeonBattle=window.v132LaunchDungeonBattle;
        window.v132LaunchDungeonBattle=function(roster){
            if(isFinalAbyssRoster(roster)){ patchFinalAbyssRoster(roster); }
            else{
                const encounterId="dungeon-"+(++encounterSequence);
                (roster||[]).forEach(monster=>configureEncounterSkills(monster,encounterId));
            }
            return previousLaunchDungeonBattle.apply(this,arguments);
        };
    }

    /* 日常副本的舊啟動器保留在 V132 私有閉包內；在真正 renderBattle
       完成元素平均化後再鎖定一次，涵蓋所有副本入口且不會每回合重抽。 */
    let configuredDungeonBattleToken=null;
    if(typeof renderBattle==="function"){
        const previousRenderBattleForSkills=renderBattle;
        renderBattle=function(){
            const roster=typeof monsters!=="undefined"?monsters:null;
            if(isFinalAbyssRoster(roster)){ patchFinalAbyssRoster(roster); }
            const result=previousRenderBattleForSkills.apply(this,arguments);
            const token=typeof battleToken!=="undefined"?battleToken:null;
            if(
                window.v132ActiveDungeonRun&&
                token!==configuredDungeonBattleToken&&
                !isFinalAbyssRoster(roster)
            ){
                configuredDungeonBattleToken=token;
                const encounterId="dungeon-render-"+(++encounterSequence);
                (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[]).forEach(index=>
                    configureEncounterSkills(monsters[index],encounterId)
                );
            }
            return result;
        };
    }

    function abyssAllies(){
        return (typeof currentBattleMonsters!=="undefined"?currentBattleMonsters:[])
            .map(index=>({index:index,monster:monsters[index]}));
    }

    function monsterControlled(monster){
        return (typeof isMonsterFrozen==="function"&&isMonsterFrozen(monster))||
            (typeof isMonsterPetrified==="function"&&isMonsterPetrified(monster));
    }

    function spendAndBadge(monster,index,skillId){
        const skill=skillDatabase[skillId];
        if(!skill||numeric(monster.sp)<numeric(skill.spCost)){ return false; }
        monster.sp=Math.max(0,numeric(monster.sp)-numeric(skill.spCost));
        showMonsterSkillNameBadge(skill.name,skill.element||monster.element,index);
        return true;
    }

    function applyExtremeAgility(monster){
        if(!monster||!monster.alive){ return; }
        let buff=monster.v142AgilityBlessing;
        if(!buff){
            const display={type:"v141TeamBuff",v141BuffType:"agility",turnsLeft:2};
            buff={originalAgility:numeric(monster.agility),turnsLeft:2,displayBuff:display};
            monster.v142AgilityBlessing=buff;
            monster.agility=Math.round(buff.originalAgility*1.75);
            monster.activeBuffs=monster.activeBuffs||[];
            monster.activeBuffs.push(display);
        }else{
            buff.turnsLeft=2;
            buff.displayBuff.turnsLeft=2;
        }
    }

    function castExtremeEmperor(monsterIndex){
        const monster=monsters[monsterIndex];
        if(!monster||monster.name!=="極帝天尊"||monsterControlled(monster)){ return false; }
        const allies=abyssAllies().filter(entry=>entry.monster&&entry.monster.alive);
        const needsLight=allies.some(entry=>{
            const ally=entry.monster;
            const shield=ally.v141Shield;
            const baseHp=shield?numeric(ally.hp)-numeric(shield.remaining):numeric(ally.hp);
            const maxHp=shield?numeric(shield.baseMaxHP):numeric(ally.maxHP);
            return baseHp<maxHp||numeric(ally.sp)<numeric(ally.maxSP)||
                (Array.isArray(ally.statusEffects)&&ally.statusEffects.length>0)||
                !(ally.v142AgilityBlessing&&ally.v142AgilityBlessing.turnsLeft>0);
        });
        const needsShield=allies.some(entry=>!(entry.monster.v141Shield&&numeric(entry.monster.v141Shield.remaining)>0));
        const skillId=needsLight?"yuanXiangGuangMing":needsShield?"yuanGuangShield":null;
        if(!skillId||!spendAndBadge(monster,monsterIndex,skillId)){ return false; }
        if(skillId==="yuanXiangGuangMing"){
            let hpTotal=0,spTotal=0,removed=0;
            allies.forEach(entry=>{
                const ally=entry.monster;
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,450):0;
                hpTotal+=healed;
                const before=numeric(ally.sp);
                ally.sp=Math.min(numeric(ally.maxSP),before+95);
                const restoredSp=ally.sp-before;
                spTotal+=restoredSp;
                removed+=Array.isArray(ally.statusEffects)?ally.statusEffects.length:0;
                ally.statusEffects=[];
                applyExtremeAgility(ally);
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restoredSp>0&&typeof showDamagePopup==="function"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restoredSp+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            addBattleLog("極帝天尊施放元相光明：全體回復"+hpTotal+" HP、"+spTotal+" SP，解除"+removed+"個負面狀態並提升75%敏捷2回合。");
        }else{
            allies.forEach(entry=>{
                window.v141ApplyMonsterShield(entry.monster,200,2);
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"shield"); }
            });
            addBattleLog("極帝天尊施放元光護體：全體獲得200護盾，持續2回合。");
        }
        updateUI(); finishPlayerAction();
        return true;
    }

    function castNorthSupport(monsterIndex){
        const monster=monsters[monsterIndex];
        if(!monster||monster.name!=="北帝天尊"||monsterControlled(monster)){ return false; }
        const entries=abyssAllies();
        const dead=entries.find(entry=>entry.monster&&(!entry.monster.alive||numeric(entry.monster.hp)<=0));
        const living=entries.filter(entry=>entry.monster&&entry.monster.alive);
        let skillId=dead?"revive":living.some(entry=>{
            const ally=entry.monster;
            const shield=ally.v141Shield;
            const hp=shield?numeric(ally.hp)-numeric(shield.remaining):numeric(ally.hp);
            const max=shield?numeric(shield.baseMaxHP):numeric(ally.maxHP);
            return hp<max||numeric(ally.sp)<numeric(ally.maxSP);
        })?"healSpell":null;
        if(!skillId||Math.random()>.55||!spendAndBadge(monster,monsterIndex,skillId)){ return false; }
        if(skillId==="revive"){
            const target=dead.monster;
            target.alive=true;
            target.v141Shield=null;
            target.hp=Math.max(1,numeric(target.maxHP));
            target.statusEffects=[];
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",dead.index,"revive"); }
            addBattleLog("北帝天尊施放最高等級復活術，"+target.name+"以100% HP復活。");
        }else{
            let hpTotal=0,spTotal=0;
            living.forEach(entry=>{
                const ally=entry.monster;
                const healed=typeof window.v141HealMonsterPreservingShield==="function"
                    ?window.v141HealMonsterPreservingShield(ally,470):0;
                hpTotal+=healed;
                const before=numeric(ally.sp);
                ally.sp=Math.min(numeric(ally.maxSP),before+155);
                const restoredSp=ally.sp-before;
                spTotal+=restoredSp;
                if(healed>0&&typeof showMonsterHit==="function"){ showMonsterHit(entry.index,healed,"heal"); }
                if(restoredSp>0&&typeof showDamagePopup==="function"){
                    const card=document.getElementById("battleMonster"+entry.index);
                    if(card){ showDamagePopup(card,"+"+restoredSp+" SP","sp"); }
                }
                if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"heal"); }
            });
            addBattleLog("北帝天尊施放最高等級治療術：全體回復"+hpTotal+" HP、"+spTotal+" SP。");
        }
        updateUI(); finishPlayerAction();
        return true;
    }

    function hasV144Buff(monster,key){ return !!(monster&&monster[key]&&numeric(monster[key].turnsLeft)>0); }

    function castCalmOrDodge(monsterIndex){
        const monster=monsters[monsterIndex];
        if(!monster||monsterControlled(monster)||Math.random()>.55){ return false; }
        const calm=monster.name==="天帝天尊";
        const dodge=monster.name==="天兵天將"&&monster.element==="wind"&&
            (monster.v141SupportSkillIds||[]).includes("dodgeSkill");
        if(!calm&&!dodge){ return false; }
        const key=calm?"v144CalmBuff":"v144DodgeBuff";
        const allies=abyssAllies().filter(entry=>entry.monster&&entry.monster.alive);
        if(allies.every(entry=>hasV144Buff(entry.monster,key))){ return false; }
        const skillId=calm?"dinghaishenzhen":"dodgeSkill";
        if(!spendAndBadge(monster,monsterIndex,skillId)){ return false; }
        allies.forEach(entry=>{
            const ally=entry.monster;
            if(hasV144Buff(ally,key)){
                ally[key].turnsLeft=calm?3:2;
                ally[key].display.turnsLeft=ally[key].turnsLeft;
                return;
            }
            const display={type:"v141TeamBuff",v141BuffType:calm?"accuracy":"dodge",turnsLeft:calm?3:2};
            const buff={turnsLeft:display.turnsLeft,display:display};
            if(calm){
                buff.originalAccuracy=numeric(ally.accuracy);
                buff.originalResistance=numeric(ally.resistance);
                ally.accuracy=Math.round(buff.originalAccuracy*1.5);
                ally.resistance=buff.originalResistance+45;
            }else{
                buff.originalEvasion=numeric(ally.evasion);
                ally.evasion=Math.round(buff.originalEvasion*1.6);
            }
            ally[key]=buff;
            ally.activeBuffs=ally.activeBuffs||[];
            ally.activeBuffs.push(display);
            if(typeof window.v141PlayCardEffect==="function"){ window.v141PlayCardEffect("monster",entry.index,"buff"); }
        });
        addBattleLog(monster.name+"施放"+skillDatabase[skillId].name+"：敵方全體"+
            (calm?"異常抗性提升45%、命中提升50%，持續3回合。":"閃躲率提升60%，持續2回合。"));
        updateUI(); finishPlayerAction();
        return true;
    }

    if(typeof window.v141TryMonsterSpecialAction==="function"){
        const previousTryMonsterSpecialAction=window.v141TryMonsterSpecialAction;
        window.v141TryMonsterSpecialAction=function(monsterIndex){
            const monster=typeof monsters!=="undefined"?monsters[monsterIndex]:null;
            if(monster&&monster.v141Abyss){
                if(monster.name==="極帝天尊"){ return castExtremeEmperor(monsterIndex); }
                if(monster.name==="北帝天尊"){ return castNorthSupport(monsterIndex); }
                if(monster.name==="天帝天尊"||(monster.name==="天兵天將"&&monster.element==="wind")){
                    return castCalmOrDodge(monsterIndex);
                }
            }
            return previousTryMonsterSpecialAction.apply(this,arguments);
        };
    }

    let v144AbyssBuffTick="";
    if(typeof startTurn==="function"){
        const previousStartTurnForBuffs=startTurn;
        startTurn=function(token){
            const key=String(token)+":"+String(typeof turn!=="undefined"?turn:"");
            if(key!==v144AbyssBuffTick){
                v144AbyssBuffTick=key;
                abyssAllies().forEach(entry=>{
                    const monster=entry.monster;
                    if(!monster||!monster.v141Abyss){ return; }
                    ["v144CalmBuff","v144DodgeBuff"].forEach(prop=>{
                        const buff=monster[prop];
                        if(!buff){ return; }
                        if(typeof turn!=="undefined"&&turn>1){ buff.turnsLeft--; }
                        buff.display.turnsLeft=buff.turnsLeft;
                        if(buff.turnsLeft>0){ return; }
                        if(prop==="v144CalmBuff"){
                            monster.accuracy=buff.originalAccuracy;
                            monster.resistance=buff.originalResistance;
                        }else{ monster.evasion=buff.originalEvasion; }
                        monster.activeBuffs=(monster.activeBuffs||[]).filter(item=>item!==buff.display);
                        delete monster[prop];
                    });
                });
            }
            return previousStartTurnForBuffs.apply(this,arguments);
        };
    }

    window.v144RuleDiagnostics=function(){
        return {
            version:VERSION,
            shopPotionIds:SHOP_POTION_IDS.slice(),
            hardControlSkip:true,
            monsterCarryLimits:[monsterCarryLimit(20),monsterCarryLimit(21),monsterCarryLimit(41)],
            monsterSkillLevels:[monsterSkillLevel(20),monsterSkillLevel(21),monsterSkillLevel(41),monsterSkillLevel(61),monsterSkillLevel(81)]
        };
    };
})();
